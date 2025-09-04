import 'chartjs-adapter-luxon';
import { InjectionToken } from '@angular/core';
import { _adapters,Chart, ChartOptions, Plugin } from 'chart.js';

export const PXS_CHART_DEFAULTS = new InjectionToken<ChartOptions>('PXS_CHART_DEFAULTS');
export const PXS_CHART_PLUGINS = new InjectionToken<Plugin[]>('PXS_CHART_PLUGINS');

const EnsureTimeAdapterPlugin: Plugin = {
  id: 'pxsEnsureTimeAdapter',
  beforeInit(chart) {
    // Ensure root adapters exists
    const date = (_adapters as any)?._date;
    (chart.options as any).adapters = (chart.options as any).adapters ?? {};
    (chart.options as any).adapters.date = (chart.options as any).adapters.date ?? date;
  },
  beforeUpdate(chart) {
    const date = (_adapters as any)?._date;
    const scales = (chart.options as any).scales;
    if (!scales) return;
    for (const key of Object.keys(scales)) {
      const s = (scales as any)[key];
      if (s?.type === 'time') {
        s.adapters = s.adapters ?? {};
        s.adapters.date = s.adapters.date ?? date;
      }
    }
  },
};

// Call once at app bootstrap (keep your provideCharts; just also register this)
export function provideCharts(opts?: { defaults?: any; plugins?: any[] }) {
  // register controllers/elements
  Chart.register(...((Chart as any).registerables ?? []));
  // set global defaults/plugins
  if (opts?.defaults) Object.assign(Chart.defaults, opts.defaults);
  Chart.register(EnsureTimeAdapterPlugin); // <<< add this line
  if (opts?.plugins?.length) Chart.register(...opts.plugins);
  return [
    { provide: PXS_CHART_DEFAULTS, useValue: opts?.defaults ?? {} },
    { provide: PXS_CHART_PLUGINS, useValue: opts?.plugins ?? [] },
  ];
}
