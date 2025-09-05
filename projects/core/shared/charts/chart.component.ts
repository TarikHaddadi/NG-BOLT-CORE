import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  EventEmitter,
  inject,
  Input,
  OnChanges,
  Output,
  ViewChild,
} from '@angular/core';
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

import { PXS_CHART_DEFAULTS, PXS_CHART_PLUGINS } from '@cadai/pxs-ng-core/providers';

type TimeUnit = 'millisecond' | 'second' | 'minute' | 'hour' | 'day' | 'month';

@Component({
  selector: 'app-chart',
  standalone: true,
  template: `<canvas
    #canvas
    [attr.height]="height"
    [attr.width]="width"
    style="display:block"
  ></canvas>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PxsChartComponent<TType extends ChartType = ChartType>
  implements AfterViewInit, OnChanges
{
  private destroyRef = inject(DestroyRef);
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

    if (!this.width && !this.height && 'ResizeObserver' in window) {
      this.ro = new ResizeObserver(() => this.chart?.resize());
      this.ro.observe(this.canvas.nativeElement);
    }

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

  /** Ensure x scale is 'time' and pick unit automatically if not provided */
  private buildOptionsWithTimeDefaults(opts?: ChartOptions<TType>): ChartOptions<TType> {
    const out: any = { ...(opts ?? {}) };

    // 1) Ensure global adapters exists
    const dateAdapter = (_adapters as any)._date;
    out.adapters = out.adapters ?? {};
    out.adapters.date = out.adapters.date ?? dateAdapter;

    if (!this.autoTime) return out as ChartOptions<TType>;

    // 2) Ensure x scale exists and is time
    out.scales = out.scales ?? {};
    const x = out.scales.x ?? {};

    if (!x.type) x.type = 'time';

    // 3) Ensure scale-level adapters exists (this is what TimeScale reads!)
    x.adapters = x.adapters ?? {};
    x.adapters.date = x.adapters.date ?? dateAdapter;

    // 4) Pick time unit automatically (or use provided)
    if (this.timeUnit === 'auto') {
      const span = this.estimateSpanMs(this.data);
      if (span != null) {
        x.time = x.time ?? {};
        x.time.unit = pickUnit(span);
      }
    } else {
      x.time = x.time ?? {};
      x.time.unit = this.timeUnit;
    }

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
}

/** Pick a nice unit from span in ms */
function pickUnit(spanMs: number): TimeUnit {
  const s = 1000;
  const m = 60 * s;
  const h = 60 * m;
  const d = 24 * h;

  if (spanMs <= 5 * s) return 'millisecond';
  if (spanMs <= 3 * m) return 'second';
  if (spanMs <= 3 * h) return 'minute';
  if (spanMs <= 4 * d) return 'hour';
  if (spanMs <= 60 * d) return 'day';
  return 'month';
}
