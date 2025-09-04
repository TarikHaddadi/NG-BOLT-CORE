/**
 * Call once at app bootstrap (Host or Core provideAppStore-style)
 * Registers controllers/elements and sets optional global defaults/plugins.
 */
import 'chartjs-adapter-luxon';
import { InjectionToken, Provider } from '@angular/core';
import { Chart, ChartOptions, Plugin, registerables } from 'chart.js';

export const PXS_CHART_DEFAULTS = new InjectionToken<ChartOptions>('PXS_CHART_DEFAULTS');
export const PXS_CHART_PLUGINS = new InjectionToken<Plugin[]>('PXS_CHART_PLUGINS');

export function provideCharts(opts?: { defaults?: any; plugins?: Plugin[] }): Provider[] {
  Chart.register(...registerables);
  if (opts?.defaults) Object.assign(Chart.defaults, opts.defaults);
  if (opts?.plugins?.length) Chart.register(...opts.plugins);
  return [
    { provide: PXS_CHART_DEFAULTS, useValue: opts?.defaults ?? {} },
    { provide: PXS_CHART_PLUGINS, useValue: opts?.plugins ?? [] },
  ];
}
