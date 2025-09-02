import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
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
import { distinctUntilChanged, filter, firstValueFrom, map, Observable } from 'rxjs';

import {
  AppFeature,
  AuthProfile,
  ConfirmDialogData,
  FeatureNavItem,
  FieldConfig,
  Lang,
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

  public isDark$!: Observable<boolean>;
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
      { label: 'English', value: 'English' },
      { label: 'Français', value: 'Français' },
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

    this.isDark$ = this.store.select(AppSelectors.ThemeSelectors.selectIsDark);

    // Theme toggle
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

    // Language
    this.langControl = new FormControl<string>(this.translate.getCurrentLang(), {
      nonNullable: true,
    });

    this.store
      .select(AppSelectors.LangSelectors.selectLang)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        filter((lang: string | null): lang is string => !!lang),
        distinctUntilChanged(),
      )
      .subscribe((lang: string) => {
        if (this.langControl.value !== lang) {
          this.langControl.setValue(lang, { emitEvent: false }); // avoid feedback loop
        }
      });

    this.langControl.valueChanges
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        distinctUntilChanged(),
        filter((lang): lang is string => !!lang),
      )
      .subscribe((lang) => {
        this.store.dispatch(AppActions.LangActions.setLang({ lang: lang as Lang }));
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
        .filter(
          ([, f]) =>
            f?.variants && typeof f.variants === 'object' && Object.keys(f.variants).length,
        )
        .map(([k]) => k);

    const buildScopeOptions = () => {
      const feats = featuresWithVariants();
      // If no features expose variants → hide everything by leaving options empty
      if (!feats.length) {
        this.aiScopeField.options = [];
        this.aiKeyField.options = [];
        this.aiValueField.options = [];
        // also clear controls to avoid stale values
        this.aiScopeControl.setValue('', { emitEvent: false });
        this.aiKeyControl.setValue('', { emitEvent: false });
        this.aiValueControl.setValue('', { emitEvent: false });
        return;
      }

      // Otherwise include "global" + feature-scoped entries
      this.aiScopeField.options = [
        { label: this.translate.instant('ai.global'), value: '' },
        ...feats.map((k) => ({ label: this.translate.instant(k), value: k })),
      ];
    };

    const refreshKeys = (scope: string) => {
      const feature = this.cfg.features?.[scope] as AppFeature | undefined;

      let keys: string[] = [];

      if (Array.isArray(feature?.variants)) {
        // array of objects → collect the object keys, not array indexes
        keys = Array.from(
          new Set(feature!.variants.flatMap((v) => Object.keys(v as Record<string, unknown>))),
        );
      } else if (feature?.variants && typeof feature.variants === 'object') {
        // single object
        keys = Object.keys(feature.variants as Record<string, unknown>);
      } else if (!scope) {
        // GLOBAL: union across all features, respecting array/object
        keys = Array.from(
          new Set(
            Object.values(this.cfg.features ?? {}).flatMap((f: AppFeature) => {
              if (Array.isArray(f?.variants)) {
                return f.variants.flatMap((v) => Object.keys(v as Record<string, unknown>));
              }
              if (f?.variants && typeof f.variants === 'object') {
                return Object.keys(f.variants as Record<string, unknown>);
              }
              return [];
            }),
          ),
        );
      }

      // Only show your known AI keys (optional guard)
      const allowed = new Set(['ai.provider', 'ai.model']);
      const filtered = keys.filter((k) => allowed.has(k));

      this.aiKeyField.options = filtered.map((k) => ({
        label: this.translate.instant(k), // you have i18n keys for labels
        value: k,
      }));

      const nextKey = filtered.includes(this.aiKeyControl.value)
        ? this.aiKeyControl.value
        : (filtered[0] ?? '');
      this.aiKeyControl.setValue(nextKey ?? '', { emitEvent: true });
    };

    const refreshValues = (scope: string, key: string) => {
      const feature = this.cfg.features?.[scope] as AppFeature | undefined;
      let finalValues: string[] = [];

      if (!key) {
        this.aiValueField.options = [];
        this.aiValueControl.setValue('', { emitEvent: false });
        return;
      }

      if (Array.isArray(feature?.variants)) {
        if (key === 'ai.provider') {
          finalValues = Array.from(
            new Set(
              feature!.variants
                .map((g) => (g as any)['ai.provider'])
                .filter((p): p is string => typeof p === 'string' && !!p),
            ),
          );
        } else if (key === 'ai.model') {
          // infer currently effective provider
          const effectiveProvider =
            (this.features.variant<string>('ai.provider', undefined, scope || undefined) as
              | string
              | undefined) || '';

          const modelsAcross = feature!.variants.flatMap((g) => {
            const models = (g as any)['ai.model'];
            if (Array.isArray(models)) return models;
            if (typeof models === 'string') return [models];
            return [];
          });

          const models = effectiveProvider
            ? feature!.variants
                .filter((g) => (g as any)['ai.provider'] === effectiveProvider)
                .flatMap((g) => {
                  const m = (g as any)['ai.model'];
                  return Array.isArray(m) ? m : typeof m === 'string' ? [m] : [];
                })
            : modelsAcross;

          finalValues = Array.from(new Set(models.map(String)));
        } else {
          // generic key
          finalValues = Array.from(
            new Set(
              feature!.variants.flatMap((g) => {
                const v = (g as any)[key];
                if (Array.isArray(v)) return v.map(String);
                if (v != null) return [String(v)];
                return [];
              }),
            ),
          );
        }
      } else if (feature?.variants && typeof feature.variants === 'object') {
        const v = (feature.variants as Record<string, unknown>)[key];
        finalValues = Array.isArray(v) ? v.map(String) : v != null ? [String(v)] : [];
      }

      // keep effective value even if not in list
      const effective = this.features.variant<unknown>(key, undefined, scope || undefined);
      const effStr = effective != null ? String(effective) : '';
      if (effStr && !finalValues.includes(effStr)) finalValues.unshift(effStr);

      this.aiValueField.options = finalValues.map((v) => ({ label: v, value: v }));

      const nextVal =
        finalValues.includes(this.aiValueControl.value) && this.aiValueControl.value
          ? this.aiValueControl.value
          : (finalValues[0] ?? '');
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

  get showAiScope(): boolean {
    return (this.aiScopeField.options?.length ?? 0) > 0;
  }
  get showAiKey(): boolean {
    return (this.aiKeyField.options?.length ?? 0) > 0;
  }
  get showAiValue(): boolean {
    return (this.aiValueField.options?.length ?? 0) > 0;
  }
}
