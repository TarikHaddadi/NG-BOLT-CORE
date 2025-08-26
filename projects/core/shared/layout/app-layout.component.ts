import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
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
import { MatDialogModule } from '@angular/material/dialog';
import { MatDialog } from '@angular/material/dialog';
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
  AuthProfile,
  FeatureNavItem,
  FieldConfig,
  RuntimeConfig,
} from '@cadai/pxs-ng-core/interfaces';
import {
  ConfigService,
  FeatureService,
  KeycloakService,
  LayoutService,
  ThemeService,
} from '@cadai/pxs-ng-core/services';
import { AppActions, AppSelectors } from '@cadai/pxs-ng-core/store';

import { ConfirmDialogComponent, ConfirmDialogData } from '../dialog/dialog.component';
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
    MatDialogModule,
  ],
  templateUrl: './app-layout.component.html',
  styleUrls: ['./app-layout.component.scss'],
})
export class AppLayoutComponent implements OnInit, AfterViewInit {
  public menuItems: FeatureNavItem[] = [];
  @ViewChild('switchersTpl', { static: true }) switchersTpl!: TemplateRef<any>;
  private destroyRef = inject(DestroyRef);

  public isOpen = true;
  public title$!: Observable<string>;
  public version!: string;

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

  // ───────────────────────────────────────────────────────────
  // AI Variant selectors (scope → key → value)
  public aiScopeField: FieldConfig = {
    name: 'aiScope',
    label: 'ai.scope',
    type: 'dropdown',
    options: [], // filled in ngOnInit
  };
  public aiScopeControl!: FormControl<string>; // '' means global; else featureKey

  public aiKeyField: FieldConfig = {
    name: 'aiKey',
    label: 'ai.variant',
    type: 'dropdown',
    options: [], // filled dynamically
  };
  public aiKeyControl!: FormControl<string>;

  public aiValueField: FieldConfig = {
    name: 'aiValue',
    label: 'ai.value',
    type: 'dropdown',
    options: [], // filled dynamically
  };
  public aiValueControl!: FormControl<string>;
  // ───────────────────────────────────────────────────────────

  profile$!: Observable<AuthProfile | null>;
  roles$!: Observable<string[]>;

  private cfg!: RuntimeConfig;

  constructor(
    private layoutService: LayoutService,
    private cdr: ChangeDetectorRef,
    private configService: ConfigService,
    public translate: TranslateService,
    public theme: ThemeService,
    private injector: Injector,
    private store: Store,
    private features: FeatureService,
    private keycloak: KeycloakService,
    private dialog: MatDialog,
  ) {}

  public ngAfterViewInit(): void {
    this.cdr.detectChanges();
  }

  public ngOnInit(): void {
    this.title$ = this.layoutService.title$;
    this.cfg = this.configService.getAll() as RuntimeConfig;
    this.version = this.cfg.version || '0.0.0';

    // Theme toggle
    this.themeControl = new FormControl<boolean>(this.theme.isDark(), { nonNullable: true });
    this.themeControl.valueChanges.subscribe((wantDark) => {
      const current = this.theme.isDark();
      if (wantDark !== current) this.theme.toggleTheme();
    });

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
    this.langControl.valueChanges.subscribe((lang) => lang && this.translate.use(lang));

    // Auth → roles/menus
    this.profile$ = this.store.select(AppSelectors.AuthSelectors.selectProfile);
    this.roles$ = this.profile$.pipe(map((p) => p?.authorization ?? []));

    this.menuItems = this.features.visibleFeatures();
    this.profile$.subscribe((p) => {
      const roles = p?.authorization ?? [];
      const { isAuthenticated, tenant } = this.keycloak.getUserCtx();
      this.features.setUser({ isAuthenticated, roles, tenant });
      this.menuItems = this.features.visibleFeatures();
    });

    // ───────────────────────────────────────────────────────────
    // AI Variant: build dynamic selectors
    // 1) Scope options: Global + features that declare variants
    const featuresWithVariants = Object.entries(this.cfg.features ?? {})
      .filter(([, f]) => f?.variants && typeof f.variants === 'object')
      .map(([k]) => k);

    this.aiScopeField.options = [
      { label: this.translate.instant('ai.global'), value: '' },
      ...featuresWithVariants.map((k) => ({
        label: this.translate.instant(k),
        value: k,
      })),
    ];

    // Controls
    this.aiScopeControl = new FormControl<string>('', { nonNullable: true }); // default: Global
    this.aiKeyControl = new FormControl<string>('', { nonNullable: true });
    this.aiValueControl = new FormControl<string>('', { nonNullable: true });

    // Initialize key/value lists based on scope
    const refreshKeys = (scope: string) => {
      // Collect variant keys either for a specific feature or union across features
      const keys = scope
        ? Object.keys(this.cfg.features?.[scope]?.variants ?? {})
        : Array.from(
            new Set(
              Object.values(this.cfg.features ?? {}).flatMap((f: any) =>
                f?.variants ? Object.keys(f.variants) : [],
              ),
            ),
          );

      this.aiKeyField.options = keys.map((k) => ({
        label: this.translate.instant(k),
        value: k,
      }));

      // Pick first key if none selected or selection no longer valid
      const nextKey = keys.includes(this.aiKeyControl.value)
        ? this.aiKeyControl.value
        : (keys[0] ?? '');
      this.aiKeyControl.setValue(nextKey ?? '', { emitEvent: true });
    };

    const refreshValues = (scope: string, key: string) => {
      // Values from config (either from that feature or union across features)
      const valuesFromConfig: unknown[] = scope
        ? [this.cfg.features?.[scope]?.variants?.[key]].filter((v) => v !== undefined)
        : Array.from(
            new Set(
              Object.values(this.cfg.features ?? {})
                .map((f: any) => f?.variants?.[key])
                .filter((v) => v !== undefined),
            ),
          );

      // Current effective value (from FeatureService which looks at store+config)
      const effective = this.features.variant<unknown>(key, undefined, scope || undefined);

      // Build options (stringify to display); include effective if not present
      const asString = (v: unknown) => (v === null || v === undefined ? '' : String(v));
      const optionValues = [...valuesFromConfig.map(asString)];
      const effStr = asString(effective);
      if (effStr && !optionValues.includes(effStr)) optionValues.unshift(effStr);

      // Fallback if empty: show a simple placeholder option
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

    this.translate.onLangChange.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      // Rebuild SCOPE options
      const featuresWithVariants = Object.entries(this.cfg.features ?? {})
        .filter(([, f]) => f?.variants && typeof f.variants === 'object')
        .map(([k]) => k);

      this.aiScopeField.options = [
        { label: this.translate.instant('ai.global'), value: '' },
        ...featuresWithVariants.map((k) => ({
          label: this.translate.instant(k),
          value: k,
        })),
      ];

      // Rebuild KEY and VALUE options for the current selections
      const scope = this.aiScopeControl.value;
      const key = this.aiKeyControl.value;
      refreshKeys(scope); // will re-fill aiKeyField.options with translated labels
      if (key) refreshValues(scope, key); // will re-fill aiValueField.options with translated labels
    });

    // React to scope changes → rebuild keys (and then values)
    this.aiScopeControl.valueChanges.subscribe((scope) => {
      refreshKeys(scope);
    });

    // React to key changes → rebuild values
    this.aiKeyControl.valueChanges.subscribe((key) => {
      const scope = this.aiScopeControl.value;
      if (!key) return;
      refreshValues(scope, key);
    });

    // Dispatch override on value change
    this.aiValueControl.valueChanges.subscribe((value) => {
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
    refreshKeys(this.aiScopeControl.value);
    if (this.aiKeyControl.value) {
      refreshValues(this.aiScopeControl.value, this.aiKeyControl.value);
    }
    // ───────────────────────────────────────────────────────────
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

  // Remove the current override so the value falls back to config
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
    const ref = this.dialog.open<ConfirmDialogComponent, ConfirmDialogData, any>(
      ConfirmDialogComponent,
      {
        width: '520px',
        maxWidth: '95vw',
        panelClass: 'switchers-dialog-panel', // (optional) for custom styling
        backdropClass: 'app-overlay-backdrop', // (optional)
        data: {
          title: 'quick_settings',
          contentTpl: this.switchersTpl,
          // Provide a function so the dialog can return a payload on confirm
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
    if (!result) return; // user canceled
  }
}
