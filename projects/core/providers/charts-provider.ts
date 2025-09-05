// Load Luxon adapter ONCE here so it binds to THIS Chart instance.
import 'chartjs-adapter-luxon';
import { InjectionToken, Provider } from '@angular/core';
import { Chart, ChartOptions, Colors, Plugin, registerables } from 'chart.js';

export const PXS_CHART_DEFAULTS = new InjectionToken<ChartOptions>('PXS_CHART_DEFAULTS');
export const PXS_CHART_PLUGINS = new InjectionToken<Plugin[]>('PXS_CHART_PLUGINS');

export function provideCharts(opts?: { defaults?: ChartOptions; plugins?: Plugin[] }): Provider[] {
  // 1) Register controllers/elements/scales + Colors plugin
  Chart.register(...registerables, Colors);

  // 2) Force-create defaults.adapters and pin the date adapter that Luxon attached
  const luxonAdapter = (Chart as any)?._adapters?._date;
  (Chart.defaults as any).adapters = (Chart.defaults as any).adapters ?? {};
  if (luxonAdapter && typeof luxonAdapter.parse === 'function') {
    (Chart.defaults as any).adapters.date = luxonAdapter;
  }

  // 3) Sane global defaults
  Chart.defaults.responsive = true;
  Chart.defaults.maintainAspectRatio = false;
  Chart.defaults.elements.point.radius = 3;
  Chart.defaults.elements.point.hitRadius = 6;

  // 4) Optional app-level defaults and plugins
  if (opts?.defaults) Object.assign(Chart.defaults, opts.defaults);
  if (opts?.plugins?.length) Chart.register(...opts.plugins);

  return [
    { provide: PXS_CHART_DEFAULTS, useValue: opts?.defaults ?? {} },
    { provide: PXS_CHART_PLUGINS, useValue: opts?.plugins ?? [] },
  ];
}
