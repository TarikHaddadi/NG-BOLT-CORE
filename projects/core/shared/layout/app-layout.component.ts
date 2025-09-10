import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  Inject,
  inject,
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
import { combineLatest, firstValueFrom, Observable } from 'rxjs';
import { distinctUntilChanged, filter, map, startWith, switchMap } from 'rxjs/operators';

import {
  AuthProfile,
  ConfirmDialogData,
  CoreOptions,
  FeatureNavItem,
  FieldConfig,
  Lang,
  SwitchersResult,
} from '@cadai/pxs-ng-core/interfaces';
import {
  FeatureService,
  KeycloakService,
  LayoutService,
  ThemeService,
  ToolbarActionsService,
} from '@cadai/pxs-ng-core/services';
import { AppActions, AppSelectors } from '@cadai/pxs-ng-core/store';

const VarSel = AppSelectors.AiVariantsSelectors;

import { CORE_OPTIONS } from '@cadai/pxs-ng-core/tokens';

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
  constructor(@Inject(CORE_OPTIONS) private readonly coreOpts: Required<CoreOptions>) {}

  public toolbarActions$ = inject(ToolbarActionsService).actions$;

  @ViewChild('switchersTpl', { static: true }) switchersTpl!: TemplateRef<unknown>;
  public isDark$!: Observable<boolean>;
  public isOpen = true;
  public title$!: Observable<string>;
  public version!: string;
  public menuItems: FeatureNavItem[] = [];

  // Theme
  public themeField: FieldConfig = {
    name: 'themeSwitcher',
    label: 'form.labels.themeSwitcher',
    type: 'toggle',
    toggleIcons: { on: 'dark_mode', off: 'light_mode', position: 'start' },
    color: 'primary',
    layoutClass: 'primary',
  };
  public themeControl!: FormControl<boolean>;

  // Language
  public langField: FieldConfig = {
    name: 'language',
    label: 'form.labels.language',
    type: 'dropdown',
    options: [
      { label: 'English', value: 'en' },
      { label: 'Français', value: 'fr' },
    ],
    color: 'primary',
    layoutClass: 'primary',
  };
  public langControl!: FormControl<string>;

  // AI Variants (feature scope → key → value)
  public aiScopeField: FieldConfig = {
    name: 'aiScope',
    label: 'ai.scope',
    type: 'dropdown',
    options: [],
    color: 'primary',
    layoutClass: 'primary',
  };
  public aiScopeControl!: FormControl<string>;

  public aiKeyField: FieldConfig = {
    name: 'aiKey',
    label: 'ai.variant',
    type: 'dropdown',
    options: [
      { label: 'ai.provider', value: 'ai.provider' },
      { label: 'ai.model', value: 'ai.model' },
    ],
    color: 'primary',
    layoutClass: 'primary',
  };
  public aiKeyControl!: FormControl<string>;

  public aiValueField: FieldConfig = {
    name: 'aiValue',
    label: 'ai.value',
    type: 'dropdown',
    options: [],
    color: 'primary',
    layoutClass: 'primary',
  };
  public aiValueControl!: FormControl<string>;

  profile$!: Observable<AuthProfile | null>;
  roles$!: Observable<string[]>;

  // inject()
  private destroyRef = inject(DestroyRef);
  private cdr = inject(ChangeDetectorRef);
  private layoutService = inject(LayoutService);
  public translate = inject(TranslateService);
  public theme = inject(ThemeService);
  private store = inject(Store);
  private features = inject(FeatureService);
  private keycloak = inject(KeycloakService);
  private dialog = inject(MatDialog);

  ngAfterViewInit(): void {
    this.cdr.detectChanges();
  }

  ngOnInit(): void {
    // ----- App basics -----
    this.title$ = this.layoutService.title$;
    this.version = this.coreOpts.appVersion || '0.0.0';
    this.menuItems = this.features.visibleFeaturesSig();

    // ----- Theme (store ↔ control) -----
    this.isDark$ = this.store.select(AppSelectors.ThemeSelectors.selectIsDark);
    this.themeControl = new FormControl<boolean>(false, { nonNullable: true });

    this.store
      .select(AppSelectors.ThemeSelectors.selectIsDark)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((isDark) => {
        if (this.themeControl.value !== isDark) {
          this.themeControl.setValue(isDark, { emitEvent: false });
        }
      });

    this.themeControl.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((isDark) => {
      this.store.dispatch(AppActions.ThemeActions.setTheme({ mode: isDark ? 'dark' : 'light' }));
    });

    // ----- Language (store ↔ control) -----
    this.langControl = new FormControl<string>('', { nonNullable: true });

    this.store
      .select(AppSelectors.LangSelectors.selectLang)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        filter((lang: Lang | null): lang is Lang => !!lang),
        distinctUntilChanged(),
      )
      .subscribe((lang) => {
        if (this.langControl.value !== lang) {
          this.langControl.setValue(lang, { emitEvent: false });
        }
      });

    this.langControl.valueChanges
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        distinctUntilChanged(),
        filter((lang): lang is Lang => !!lang),
      )
      .subscribe((lang) => {
        this.store.dispatch(AppActions.LangActions.setLang({ lang }));
      });

    // ----- Auth → roles/menus -----
    this.profile$ = this.store.select(AppSelectors.AuthSelectors.selectProfile);
    this.roles$ = this.profile$.pipe(map((p) => p?.authorization ?? []));
    this.profile$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((p) => {
      const roles = p?.authorization ?? [];
      const { isAuthenticated, tenant } = this.keycloak.getUserCtx();
      this.features.setUser({ isAuthenticated, roles, tenant });
      this.menuItems = this.features.visibleFeaturesSig();
      this.cdr.markForCheck();
    });

    // ----- AI VARIANTS (feature-only, store-driven) -----

    // Controls
    this.aiScopeControl = new FormControl<string>('', { nonNullable: true });
    this.aiKeyControl = new FormControl<string>('ai.provider', { nonNullable: true });
    this.aiValueControl = new FormControl<string>('', { nonNullable: true });

    // 1) Build scope options from features that expose AI meta
    this.store
      .select(VarSel.selectFeatureVariants)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((featuresMap) => {
        const scopes = Object.entries(featuresMap)
          .filter(([k, rec]) => k !== '' && !!(rec as any)['__ai.modelsByProvider'])
          .map(([k]) => k);

        this.aiScopeField.options = scopes.map((k) => ({
          label: this.translate.instant(`${k}`) || k,
          value: k,
        }));

        const current = this.aiScopeControl.value;
        const next = scopes.includes(current) ? current : (scopes[0] ?? '');
        if (next !== current) this.aiScopeControl.setValue(next, { emitEvent: !!next });
      });

    // 2) Keep aiKey labels translated (optional)
    const setKeyLabels = () => {
      this.aiKeyField.options = [
        { label: this.translate.instant('ai.provider') || 'ai.provider', value: 'ai.provider' },
        { label: this.translate.instant('ai.model') || 'ai.model', value: 'ai.model' },
      ];
    };
    setKeyLabels();
    this.translate.onLangChange
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => setKeyLabels());

    // 3) Streams by current scope
    const scope$ = this.aiScopeControl.valueChanges.pipe(
      startWith(this.aiScopeControl.value),
      distinctUntilChanged(),
    );

    const providers$ = scope$.pipe(
      switchMap((scope) => this.store.select(VarSel.selectFeatureRecord(scope || ''))),
      map((rec) => (rec['__ai.providers'] as string[] | undefined) ?? []),
    );

    const modelsByProvider$ = scope$.pipe(
      switchMap((scope) => this.store.select(VarSel.selectModelsByProvider(scope || ''))),
    );

    const selectedProvider$ = scope$.pipe(
      switchMap((scope) => this.store.select(VarSel.selectProviderInFeature(scope || ''))),
    );

    const selectedModel$ = scope$.pipe(
      switchMap((scope) => this.store.select(VarSel.selectModelInFeature(scope || ''))),
    );

    const key$ = this.aiKeyControl.valueChanges.pipe(
      startWith(this.aiKeyControl.value),
      distinctUntilChanged(),
    );

    // key === 'ai.provider' → just show options & mirror store; DO NOT pick a new value
    combineLatest([
      key$,
      providers$,
      selectedProvider$.pipe(startWith<string | undefined>(undefined)),
    ])
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(([key, providers, selProvider]) => {
        if (key !== 'ai.provider') return;

        this.aiValueField.options = providers.map((p) => ({ label: p, value: p }));

        const next = selProvider && providers.includes(selProvider) ? selProvider : '';
        if (this.aiValueControl.value !== next) {
          this.aiValueControl.setValue(next, { emitEvent: false });
        }
      });

    // key === 'ai.model' → show models for the currently selected provider; DO NOT pick a new value
    combineLatest([
      key$,
      modelsByProvider$,
      selectedProvider$.pipe(startWith<string | undefined>(undefined)),
      selectedModel$.pipe(startWith<string | undefined>(undefined)),
    ])
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(([key, byProv, selProvider, selModel]) => {
        if (key !== 'ai.model') return;

        const models = selProvider ? (byProv[selProvider] ?? []) : [];
        this.aiValueField.options = models.map((m) => ({ label: m, value: m }));

        const next = selModel && models.includes(selModel) ? selModel : '';
        if (this.aiValueControl.value !== next) {
          this.aiValueControl.setValue(next, { emitEvent: false });
        }
      });

    // When user picks a value for the CURRENT key, then persist
    this.aiValueControl.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => {
        const scope = this.aiScopeControl.value;
        const key = this.aiKeyControl.value;
        if (!scope || !key) return;
        this.store.dispatch(
          AppActions.AiVariantsActions.setVariant({
            featureKey: scope,
            path: key,
            value,
          }),
        );
      });
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
    // Persist quick-settings if desired
  }
}
