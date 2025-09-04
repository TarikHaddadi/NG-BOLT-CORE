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
  ActiveElement,
  Chart,
  ChartData,
  ChartEvent,
  ChartOptions,
  ChartType,
  Plugin,
} from 'chart.js';

import { PXS_CHART_DEFAULTS, PXS_CHART_PLUGINS } from '@cadai/pxs-ng-core/providers';

@Component({
  selector: 'pxs-chart',
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
  private lastType?: TType;

  @ViewChild('canvas', { static: true }) canvas!: ElementRef<HTMLCanvasElement>;

  // Required
  @Input({ required: true }) type!: TType;
  @Input({ required: true }) data!: ChartData<TType>;

  // Optional
  @Input() options?: ChartOptions<TType>;
  @Input() height?: number | string;
  @Input() width?: number | string;
  @Input() localPlugins?: Plugin[];

  // Events
  @Output() chartInit = new EventEmitter<Chart<TType>>();
  @Output() elementClick = new EventEmitter<{ event: ChartEvent; elements: ActiveElement[] }>();

  private chart?: Chart<TType>;
  private ro?: ResizeObserver;

  ngAfterViewInit() {
    this.createChart();
    this.lastType = this.type;

    // Click relay
    this.canvas.nativeElement.onclick = (e: MouseEvent) => {
      if (!this.chart) return;
      const pts = this.chart.getActiveElements();
      this.elementClick.emit({ event: e as unknown as ChartEvent, elements: pts });
    };

    // Responsive (when width/height are not hard-coded)
    if (!this.width && !this.height && 'ResizeObserver' in window) {
      this.ro = new ResizeObserver(() => this.chart?.resize());
      this.ro.observe(this.canvas.nativeElement);
    }

    // Clean up on destroy
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

    this.chart.data = this.data;
    this.chart.options = this.options as any;
    this.chart.update();
  }

  private mergedOptions(): ChartOptions<TType> {
    return {
      ...this.defaults,
      ...(this.options ?? {}),
    } as ChartOptions<TType>;
  }

  private createChart() {
    const ctx = this.canvas.nativeElement.getContext('2d')!;
    this.chart = new Chart<TType>(ctx, {
      type: this.type,
      data: this.data,
      options: this.mergedOptions(),
      plugins: [
        ...(this.plugins as unknown as Plugin<TType>[]),
        ...((this.localPlugins ?? []) as unknown as Plugin<TType>[]),
      ],
    });
    this.chartInit.emit(this.chart);
  }
}
