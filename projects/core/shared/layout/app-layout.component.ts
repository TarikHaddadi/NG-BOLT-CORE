import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  effect,
  inject,
  Injector,
  OnInit,
  TemplateRef,
  ViewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatMenuModule } from '@angular/material/menu';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterModule, RouterOutlet } from '@angular/router';
import { Store } from '@ngrx/store';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { firstValueFrom, map, Observable } from 'rxjs';

import {
  AppFeature,
  AuthProfile,
  ConfirmDialogData,
  FeatureNavItem,
  FieldConfig,
  RuntimeConfig,
  SwitchersResult,
} from '@cadai/pxs-ng-core/interfaces';
import {
  ConfigService,
  FeatureService,
  KeycloakService,
  LayoutService,
  ThemeService,
} from '@cadai/pxs-ng-core/services';
import { AppActions, AppSelectors } from '@cadai/pxs-ng-core/store';

import { ConfirmDialogComponent } from '../dialog/dialog.component';
import { SelectComponent } from '../forms/fields/select/select.component';
import { ToggleComponent } from '../forms/fields/toggle/toggle.component';

@Component({
  selector: 'app-layout',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    RouterOutlet,
    RouterModule,
    // Material
    MatSidenavModule,
    MatToolbarModule,
    MatIconModule,
    MatButtonModule,
    MatTooltipModule,
    MatListModule,
    MatMenuModule,
    MatChipsModule,
    MatDialogModule,
    // Fields
    TranslateModule,
    SelectComponent,
    ToggleComponent,
  ],
  templateUrl: './app-layout.component.html',
  styleUrls: ['./app-layout.component.scss'],
})
export class AppLayoutComponent implements OnInit, AfterViewInit {
  @ViewChild('switchersTpl', { static: true }) switchersTpl!: TemplateRef<unknown>;

  // Sidebar + header
  public isOpen = true;
  public title$!: Observable<string>;
  public version!: string;

  // Menu (typed for @for track item.route)
  public menuItems: FeatureNavItem[] = [];

  // Theme toggle config
  public themeField: FieldConfig = {
    name: 'themeSwitcher',
    label: 'form.labels.themeSwitcher',
    type: 'toggle',
    color: 'accent',
    toggleIcons: { on: 'dark_mode', off: 'light_mode', position: 'start' },
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

  // AI Variant selectors (scope → key → value)
  public aiScopeField: FieldConfig = {
    name: 'aiScope',
    label: 'ai.scope',
    type: 'dropdown',
    options: [],
  };
  public aiScopeControl!: FormControl<string>; // '' = global; else featureKey

  public aiKeyField: FieldConfig = {
    name: 'aiKey',
    label: 'ai.variant',
    type: 'dropdown',
    options: [],
  };
  public aiKeyControl!: FormControl<string>;

  public aiValueField: FieldConfig = {
    name: 'aiValue',
    label: 'ai.value',
    type: 'dropdown',
    options: [],
  };
  public aiValueControl!: FormControl<string>;

  profile$!: Observable<AuthProfile | null>;
  roles$!: Observable<string[]>;

  private cfg!: RuntimeConfig;

  // inject()
  private destroyRef = inject(DestroyRef);
  private cdr = inject(ChangeDetectorRef);
  private injector = inject(Injector);
  private layoutService = inject(LayoutService);
  private configService = inject(ConfigService);
  public translate = inject(TranslateService);
  public theme = inject(ThemeService);
  private store = inject(Store);
  private features = inject(FeatureService);
  private keycloak = inject(KeycloakService);
  private dialog = inject(MatDialog);

  ngAfterViewInit(): void {
    // Toolbar title initial push, etc.
    this.cdr.detectChanges();
  }

  ngOnInit(): void {
    this.title$ = this.layoutService.title$;
    this.cfg = this.configService.getAll() as RuntimeConfig;
    this.version = this.cfg.version || '0.0.0';

    // Theme toggle
    this.themeControl = new FormControl<boolean>(this.theme.isDark(), { nonNullable: true });
    this.themeControl.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((wantDark) => {
        if (wantDark !== this.theme.isDark()) this.theme.toggleTheme();
      });

    // Mirror theme -> control via effect (no loops)
    effect(
      () => {
        const isDark = this.theme.isDark();
        if (this.themeControl.value !== isDark) {
          this.themeControl.setValue(isDark, { emitEvent: false });
        }
      },
      { injector: this.injector },
    );

    // Language
    this.langControl = new FormControl<string>(this.translate.getCurrentLang(), {
      nonNullable: true,
    });
    this.langControl.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((lang) => {
      if (lang) this.translate.use(lang);
    });

    // Auth → roles/menus
    this.profile$ = this.store.select(AppSelectors.AuthSelectors.selectProfile);
    this.roles$ = this.profile$.pipe(map((p) => p?.authorization ?? []));

    // Initialize menu and react to auth context
    this.menuItems = this.features.visibleFeatures();
    this.profile$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((p) => {
      const roles = p?.authorization ?? [];
      const { isAuthenticated, tenant } = this.keycloak.getUserCtx();
      this.features.setUser({ isAuthenticated, roles, tenant });
      this.menuItems = this.features.visibleFeatures();
      this.cdr.markForCheck();
    });

    // AI Variant selectors
    const featuresWithVariants = () =>
      Object.entries(this.cfg.features ?? {})
        .filter(([, f]) => f?.variants && typeof f.variants === 'object')
        .map(([k]) => k);

    const buildScopeOptions = () => {
      this.aiScopeField.options = [
        { label: this.translate.instant('ai.global'), value: '' },
        ...featuresWithVariants().map((k) => ({ label: this.translate.instant(k), value: k })),
      ];
    };

    const refreshKeys = (scope: string) => {
      const keys = scope
        ? Object.keys(this.cfg.features?.[scope]?.variants ?? {})
        : Array.from(
            new Set(
              Object.values(this.cfg.features ?? {}).flatMap((f: AppFeature) =>
                f?.variants ? Object.keys(f.variants) : [],
              ),
            ),
          );

      this.aiKeyField.options = keys.map((k) => ({ label: this.translate.instant(k), value: k }));

      const nextKey = keys.includes(this.aiKeyControl.value)
        ? this.aiKeyControl.value
        : (keys[0] ?? '');
      this.aiKeyControl.setValue(nextKey ?? '', { emitEvent: true });
    };

    const refreshValues = (scope: string, key: string) => {
      const valuesFromConfig: unknown[] = scope
        ? [this.cfg.features?.[scope]?.variants?.[key]].filter((v) => v !== undefined)
        : Array.from(
            new Set(
              Object.values(this.cfg.features ?? {})
                .map((f: AppFeature) => f?.variants?.[key])
                .filter((v) => v !== undefined),
            ),
          );

      const effective = this.features.variant<unknown>(key, undefined, scope || undefined);
      const asString = (v: unknown) => (v == null ? '' : String(v));

      const optionValues = [...valuesFromConfig.map(asString)];
      const effStr = asString(effective);
      if (effStr && !optionValues.includes(effStr)) optionValues.unshift(effStr);

      const finalValues = optionValues.length ? optionValues : [''];

      this.aiValueField.options = finalValues.map((v) => ({
        label: this.translate.instant(v) || '(empty)',
        value: v,
      }));

      const nextVal = finalValues.includes(this.aiValueControl.value)
        ? this.aiValueControl.value
        : finalValues[0];
      this.aiValueControl.setValue(nextVal, { emitEvent: false });
    };

    // Controls
    this.aiScopeControl = new FormControl<string>('', { nonNullable: true });
    this.aiKeyControl = new FormControl<string>('', { nonNullable: true });
    this.aiValueControl = new FormControl<string>('', { nonNullable: true });

    // i18n re-compute labels
    this.translate.onLangChange.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      buildScopeOptions();
      const scope = this.aiScopeControl.value;
      const key = this.aiKeyControl.value;
      refreshKeys(scope);
      if (key) refreshValues(scope, key);
      this.cdr.markForCheck();
    });

    // React to scope/key/value changes
    this.aiScopeControl.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((scope) => refreshKeys(scope));

    this.aiKeyControl.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((key) => {
      const scope = this.aiScopeControl.value;
      if (key) refreshValues(scope, key);
    });

    this.aiValueControl.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => {
        const scope = this.aiScopeControl.value;
        const key = this.aiKeyControl.value;
        if (!key) return;
        this.store.dispatch(
          AppActions.AiVariantsActions.setVariant({
            path: key,
            value,
            featureKey: scope || undefined,
          }),
        );
      });

    // Seed initial selections
    buildScopeOptions();
    refreshKeys(this.aiScopeControl.value);
    if (this.aiKeyControl.value) {
      refreshValues(this.aiScopeControl.value, this.aiKeyControl.value);
    }
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

  resetVariant(): void {
    const scope = this.aiScopeControl.value;
    const key = this.aiKeyControl.value;
    if (!key) return;
    this.store.dispatch(
      AppActions.AiVariantsActions.setVariant({
        path: key,
        value: undefined,
        featureKey: scope || undefined,
      }),
    );
  }

  async openSwitchers(): Promise<void> {
    const ref = this.dialog.open<ConfirmDialogComponent, ConfirmDialogData, SwitchersResult>(
      ConfirmDialogComponent,
      {
        width: '520px',
        maxWidth: '95vw',
        panelClass: 'switchers-dialog-panel',
        backdropClass: 'app-overlay-backdrop',
        data: {
          title: 'quick_settings',
          contentTpl: this.switchersTpl,
          getResult: () => ({
            theme: this.themeControl.value,
            lang: this.langControl.value,
            scope: this.aiScopeControl.value,
            key: this.aiKeyControl.value,
            value: this.aiValueControl.value,
          }),
        },
      },
    );

    const result = await firstValueFrom(ref.afterClosed());
    if (!result) return;
    // You can handle persisted quick-settings here if needed
  }
}
