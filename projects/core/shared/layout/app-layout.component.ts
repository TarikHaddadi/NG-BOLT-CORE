import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  effect,
  Injector,
  OnInit,
} from '@angular/core';
import { FormControl } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatMenuModule } from '@angular/material/menu';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterModule, RouterOutlet } from '@angular/router';
import { Store } from '@ngrx/store';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { map, Observable } from 'rxjs';

import { AuthProfile, FieldConfig } from '@cadai/pxs-ng-core/interfaces';
import { ConfigService, LayoutService, ThemeService } from '@cadai/pxs-ng-core/services';
import { AppActions, AppSelectors } from '@cadai/pxs-ng-core/store';

import { SelectComponent } from '../forms/fields/select/select.component';
import { ToggleComponent } from '../forms/fields/toggle/toggle.component';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    MatSidenavModule,
    MatToolbarModule,
    MatIconModule,
    MatButtonModule,
    RouterModule,
    MatTooltipModule,
    MatListModule,
    TranslateModule,
    SelectComponent,
    ToggleComponent,
    MatMenuModule,
    MatChipsModule,
  ],
  templateUrl: './app-layout.component.html',
  styleUrls: ['./app-layout.component.scss'],
})
export class AppLayoutComponent implements OnInit, AfterViewInit {
  public menuItems = [
    { label: 'DASHBOARD_TITLE', icon: 'dashboard', route: '/dashboard' },
    { label: 'TEAM_MEMBERS', icon: 'group', route: '/team' },
  ];
  public isOpen = true;
  public title$!: Observable<string>;
  public version!: string;

  // Theme toggle config
  public themeField: FieldConfig = {
    name: 'themeSwitcher',
    label: 'form.labels.themeSwitcher',
    type: 'toggle',
    color: 'accent',
    toggleIcons: {
      on: 'dark_mode',
      off: 'light_mode',
      position: 'start',
    },
  };
  public themeControl!: FormControl<boolean>;

  // Language select config
  public langField: FieldConfig = {
    name: 'language',
    label: 'form.labels.language',
    type: 'dropdown',
    options: [
      { label: 'English', value: 'en' },
      { label: 'Français', value: 'fr' },
    ],
  };
  public langControl!: FormControl<string>;

  profile$!: Observable<AuthProfile | null>;
  roles$!: Observable<string[]>;

  constructor(
    private layoutService: LayoutService,
    private cdr: ChangeDetectorRef,
    private configService: ConfigService,
    public translate: TranslateService,
    public theme: ThemeService,
    private injector: Injector,
    private store: Store,
  ) {}

  public ngAfterViewInit(): void {
    this.cdr.detectChanges();
  }

  public ngOnInit(): void {
    this.title$ = this.layoutService.title$;
    // Env configs
    this.version = this.configService.getAll().version || '0.0.0';

    // IMPORTANT: nonNullable so the type is FormControl<boolean>, not boolean | null
    this.themeControl = new FormControl<boolean>(this.theme.isDark(), { nonNullable: true });
    this.langControl = new FormControl<string>(this.translate.getCurrentLang(), {
      nonNullable: true,
    });

    // 1) UI -> Service: when user toggles the control, call toggleTheme if different
    this.themeControl.valueChanges.subscribe((wantDark) => {
      const current = this.theme.isDark();
      if (wantDark !== current) this.theme.toggleTheme();
    });

    // 2) Service -> UI: keep control in sync if something else toggles the theme
    effect(
      () => {
        const isDark = this.theme.isDark();
        // avoid feedback loop
        if (this.themeControl.value !== isDark) {
          this.themeControl.setValue(isDark, { emitEvent: false });
        }
      },
      { injector: this.injector },
    );

    // Language control (optional)
    this.langControl.valueChanges.subscribe((lang) => {
      if (lang) this.translate.use(lang);
    });

    // User informations
    this.profile$ = this.store.select(AppSelectors.AuthSelectors.selectProfile);
    this.roles$ = this.profile$.pipe(map((p) => p?.authorization ?? []));
  }

  displayName(p: AuthProfile | null): string {
    if (!p) return '';
    return (
      p.name ||
      [p.given_name, p.family_name].filter(Boolean).join(' ') ||
      p.preferred_username ||
      ''
    );
  }

  logout(): void {
    this.store.dispatch(AppActions.AuthActions.logout());
  }
}
