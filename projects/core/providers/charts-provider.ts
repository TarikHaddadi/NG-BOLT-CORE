import 'chartjs-adapter-luxon';
import { InjectionToken, Provider } from '@angular/core';
import { _adapters, Chart, ChartOptions, Colors, Plugin, registerables } from 'chart.js';

export const PXS_CHART_DEFAULTS = new InjectionToken<ChartOptions>('PXS_CHART_DEFAULTS');
export const PXS_CHART_PLUGINS = new InjectionToken<Plugin[]>('PXS_CHART_PLUGINS');

const EnsureTimeAdapterPlugin: Plugin = {
  id: 'pxsEnsureTimeAdapter',
  beforeInit(chart) {
    // Ensure options.adapters exists
    (chart.options as any).adapters = (chart.options as any).adapters ?? {};

    const date = (_adapters as any)?._date;
    if (date && typeof date.parse === 'function') {
      (chart.options as any).adapters.date = (chart.options as any).adapters.date ?? date;
    }
  },
  beforeUpdate(chart) {
    const scales = (chart.options as any).scales;
    if (!scales) return;

    // Ensure each scale has adapters = {}
    for (const key of Object.keys(scales)) {
      const s = (scales as any)[key];
      if (!s) continue;
      s.adapters = s.adapters ?? {};

      if (s.type === 'time') {
        const date = (_adapters as any)?._date;
        if (date && typeof date.parse === 'function') {
          s.adapters.date = s.adapters.date ?? date;
        }
      }
    }
  },
};

export function provideCharts(opts?: { defaults?: ChartOptions; plugins?: Plugin[] }): Provider[] {
  // ✅ register everything you need
  Chart.register(...registerables, Colors, EnsureTimeAdapterPlugin);

  // Optional: set some sane element defaults (helps hover hitboxes)
  Chart.defaults.elements.point.radius = 3;
  Chart.defaults.elements.point.hitRadius = 6;

  if (opts?.defaults) Object.assign(Chart.defaults, opts.defaults);
  if (opts?.plugins?.length) Chart.register(...opts.plugins);

  return [
    { provide: PXS_CHART_DEFAULTS, useValue: opts?.defaults ?? {} },
    { provide: PXS_CHART_PLUGINS, useValue: opts?.plugins ?? [] },
  ];
}
