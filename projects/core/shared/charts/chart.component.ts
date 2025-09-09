import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  EventEmitter,
  inject,
  Input,
  NgZone,
  OnChanges,
  Output,
  ViewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Store } from '@ngrx/store';
import { TranslateService } from '@ngx-translate/core';
import {
  _adapters,
  ActiveElement,
  Chart,
  ChartData,
  ChartEvent,
  ChartOptions,
  ChartType,
  Plugin,
} from 'chart.js';
import { Settings as LuxonSettings } from 'luxon';
import { distinctUntilChanged } from 'rxjs';

import { PXS_CHART_DEFAULTS, PXS_CHART_PLUGINS } from '@cadai/pxs-ng-core/providers';
import { AppSelectors } from '@cadai/pxs-ng-core/store';

type TimeUnit = 'millisecond' | 'second' | 'minute' | 'hour' | 'day' | 'month';

@Component({
  selector: 'app-chart',
  standalone: true,
  template: `
    <div class="pxs-chart-wrap" [style.--pxs-chart-h.px]="height ?? 300">
      <canvas #canvas></canvas>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    `
      :host {
        display: block;
        width: 100%;
      }
      .pxs-chart-wrap {
        width: 100%;
        height: var(--pxs-chart-h, 300px); /* default 300px */
        overflow: hidden; /* avoid accidental overflow */
      }
      .pxs-chart-wrap > canvas {
        display: block;
        width: 100% !important;
        height: 100% !important;
      }
    `,
  ],
})
export class ChartComponent<TType extends ChartType = ChartType>
  implements AfterViewInit, OnChanges
{
  private translate = inject(TranslateService, { optional: true });
  private destroyRef = inject(DestroyRef);
  private zone = inject(NgZone);
  private store = inject(Store);
  private defaults = (inject<ChartOptions>(PXS_CHART_DEFAULTS, { optional: true }) ??
    {}) as ChartOptions<TType>;
  private plugins = inject<Plugin[]>(PXS_CHART_PLUGINS, { optional: true }) ?? [];

  @ViewChild('canvas', { static: true }) canvas!: ElementRef<HTMLCanvasElement>;

  // Required
  @Input({ required: true }) type!: TType;
  @Input({ required: true }) data!: ChartData<TType, any>;

  // Optional
  @Input() options?: ChartOptions<TType>;
  @Input() height?: number | string;
  @Input() width?: number | string;
  @Input() localPlugins?: Plugin[];

  /** Auto-time behavior */
  @Input() autoTime: boolean = true; // if true, we auto-detect time scale
  @Input() timeUnit: TimeUnit | 'auto' = 'auto'; // override or let it auto-pick

  // Events
  @Output() chartInit = new EventEmitter<Chart<TType>>();
  @Output() elementClick = new EventEmitter<{ event: ChartEvent; elements: ActiveElement[] }>();

  private chart?: Chart<TType>;
  private ro?: ResizeObserver;
  private lastType?: TType;

  ngAfterViewInit() {
    this.createChart();
    this.lastType = this.type;

    this.canvas.nativeElement.onclick = (e: MouseEvent) => {
      if (!this.chart) return;
      const pts = this.chart.getActiveElements();
      this.elementClick.emit({ event: e as unknown as ChartEvent, elements: pts });
    };

    if ('ResizeObserver' in window) {
      // Observe the wrapper (better signal for width changes)
      const wrap = this.canvas.nativeElement.parentElement!;
      this.ro = new ResizeObserver(() => this.chart?.resize());
      this.ro.observe(wrap);
    }

    this.setupLangReactivity();
    this.setupThemeReactivity();

    this.destroyRef.onDestroy(() => {
      this.ro?.disconnect();
      this.chart?.destroy();
    });
  }

  ngOnChanges() {
    if (!this.chart) return;

    const typeChanged = this.lastType !== this.type;
    if (typeChanged) {
      this.chart.destroy();
      this.createChart();
      this.lastType = this.type;
      return;
    }

    // Update data/options & refresh
    this.chart.data = this.normalizeTimeDataIfNeeded(this.data) as any;
    this.chart.options = this.buildOptionsWithTimeDefaults(this.options) as any;
    this.chart.update();
  }

  private mergedOptions(): ChartOptions<TType> {
    const base = { ...this.defaults, ...(this.options ?? {}) } as ChartOptions<TType>;
    return this.buildOptionsWithTimeDefaults(base);
  }

  private createChart() {
    const ctx = this.canvas.nativeElement.getContext('2d')!;
    this.chart = new Chart<TType>(ctx, {
      type: this.type,
      data: this.normalizeTimeDataIfNeeded(this.data) as any,
      options: this.mergedOptions(),
      plugins: [
        ...(this.plugins as unknown as Plugin<TType>[]),
        ...((this.localPlugins ?? []) as unknown as Plugin<TType>[]),
      ],
    });
    this.chartInit.emit(this.chart);
  }

  // ===== Time helpers =====

  /** If datasets contain {x,y} points, normalize x to Date or ms and decide time unit */
  private normalizeTimeDataIfNeeded(data: ChartData<TType>): ChartData<TType> {
    if (!this.autoTime) return data;

    const { hasXY, xs } = this.collectXValues(data);
    if (!hasXY || xs.length === 0) return data;

    // Detect if anything needs converting (sec->ms, ISO->ms, Date->ms)
    const needsChange = xs.some((v) => {
      if (typeof v === 'number') return v < 1e12; // seconds
      if (typeof v === 'string') return !isNaN(new Date(v).getTime()); // ISO
      if (v instanceof Date) return true;
      return false;
    });
    if (!needsChange) return data;

    const toMs = (x: any): number | any => {
      if (typeof x === 'number') return x < 1e12 ? x * 1000 : x;
      if (typeof x === 'string') {
        const t = new Date(x).getTime();
        return isNaN(t) ? x : t;
      }
      if (x instanceof Date) return x.getTime();
      return x; // leave unknowns as-is
    };

    // Shallow-copy the ChartData and only rebuild dataset.data arrays
    const cloned: any = {
      ...data,
      datasets: (data.datasets as any[]).map((ds) => {
        if (!Array.isArray(ds.data)) return ds; // leave typed arrays/numbers alone
        const newData = ds.data.map((pt: any) => {
          if (pt && typeof pt === 'object' && 'x' in pt && 'y' in pt) {
            const ms = toMs(pt.x);
            return typeof ms === 'number' ? { ...pt, x: ms } : pt;
          }
          return pt;
        });
        return { ...ds, data: newData }; // keep other props (incl. functions) intact
      }),
    };

    return cloned as ChartData<TType>;
  }

  private buildOptionsWithTimeDefaults(opts?: ChartOptions<TType>): ChartOptions<TType> {
    const out: any = { ...(opts ?? {}) };

    if (!this.autoTime) return out as ChartOptions<TType>;

    const { hasXY } = this.collectXValues(this.data);
    if (!hasXY) return out as ChartOptions<TType>;

    out.scales = out.scales ?? {};
    const x = { ...(out.scales.x ?? {}) };

    // ✅ Keep whatever the caller set; default to 'timeseries' if missing
    if (!x.type) x.type = 'timeseries';

    // Ensure objects exist
    x.adapters = x.adapters ?? {};
    x.time = { ...(x.time ?? {}) };

    // ✅ Caller formats override defaults
    x.time.displayFormats = {
      millisecond: 'HH:mm:ss.SSS',
      second: 'HH:mm:ss',
      minute: 'HH:mm',
      hour: 'HH:mm',
      day: 'MMM d', // default (will be overridden by your 'MMMM dd')
      week: 'MMM d',
      month: 'MMM yyyy',
      quarter: 'qqq yyyy',
      year: 'yyyy',
      ...(x.time.displayFormats ?? {}),
    };

    // ✅ Only choose a unit if neither the options nor the input have decided
    if (!x.time.unit) {
      const span = this.estimateSpanMs(this.data);
      const fromInput = this.timeUnit !== 'auto' ? this.timeUnit : undefined;
      x.time.unit = fromInput ?? (span != null ? this.pickUnit(span) : 'day');
    }

    // Nice for day labels (optional)
    if (x.time.unit === 'day' && !x.time.round) x.time.round = 'day';

    // Keep ticks if the caller set them
    out.scales.x = x;
    return out as ChartOptions<TType>;
  }

  private collectXValues(data: ChartData<TType>): {
    hasXY: boolean;
    xs: Array<number | string | Date>;
  } {
    const xs: Array<number | string | Date> = [];
    let hasXY = false;

    (data.datasets as any[]).forEach((ds) => {
      if (Array.isArray(ds.data)) {
        ds.data.forEach((pt: any) => {
          if (pt && typeof pt === 'object' && 'x' in pt && 'y' in pt) {
            hasXY = true;
            xs.push(pt.x as any);
          }
        });
      }
    });
    return { hasXY, xs };
  }

  private estimateSpanMs(data: ChartData<TType>): number | null {
    const xs: number[] = [];
    (data.datasets as any[]).forEach((ds) => {
      if (!Array.isArray(ds.data)) return;
      ds.data.forEach((pt: any) => {
        if (pt && typeof pt === 'object' && 'x' in pt && 'y' in pt) {
          const v = pt.x;
          let ms: number | null = null;
          if (typeof v === 'number') ms = v < 1e12 ? v * 1000 : v;
          else if (typeof v === 'string') {
            const d = new Date(v).getTime();
            ms = isNaN(d) ? null : d;
          } else if (v instanceof Date) ms = v.getTime();
          if (ms != null) xs.push(ms);
        }
      });
    });
    if (xs.length < 2) return null;
    const min = Math.min(...xs);
    const max = Math.max(...xs);
    return max - min;
  }

  private setupLangReactivity() {
    if (!this.translate) return;

    // set once on init
    this.applyDateLocale(this.translate.getLangs()[0]);

    this.translate.onLangChange.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(({ lang }) => {
      this.applyDateLocale(lang);
      this.refreshForStyling();
    });

    // Language (prefer your own NgRx selector; fallback to TranslateService)
    const lang$ = this.store.select(AppSelectors.LangSelectors.selectLang);
    lang$.pipe(distinctUntilChanged(), takeUntilDestroyed(this.destroyRef)).subscribe((lang) => {
      this.applyDateLocale(lang);
      this.refreshForStyling();
    });
  }

  private applyDateLocale(lang: string | undefined) {
    if (!lang) return;

    // Works with date-fns adapter (has setLocale)
    try {
      const luxon = (Chart as any)?._adapters?._date;
      if (luxon?.setLocale) luxon.setLocale(lang); // e.g. 'fr', 'de', 'en-GB'
    } catch {}

    // Works with luxon adapter
    try {
      LuxonSettings.defaultLocale = lang;
    } catch {}
  }

  private setupThemeReactivity() {
    this.store
      .select(AppSelectors.ThemeSelectors.selectIsDark)
      .pipe(distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.refreshForStyling());
  }

  private refreshForStyling() {
    if (!this.chart) return;
    this.chart.options = this.mergedOptions() as any;

    // Run outside Angular to avoid change detection thrash
    this.zone.runOutsideAngular(() => {
      // schedule next frame so computed styles are up-to-date
      requestAnimationFrame(() => this.chart!.update());
    });
  }

  /** Pick a nice unit from span in ms */
  private pickUnit(spanMs: number): TimeUnit {
    const s = 1000,
      m = 60 * s,
      h = 60 * m,
      d = 24 * h;
    if (spanMs <= 30 * m) return 'second';
    if (spanMs <= 12 * h) return 'minute';
    if (spanMs <= 2 * d) return 'hour';
    if (spanMs <= 120 * d) return 'day'; // up to ~4 months stay on 'day'
    return 'month';
  }
}
