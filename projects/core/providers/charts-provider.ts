import 'chartjs-adapter-luxon';
import { InjectionToken, Provider } from '@angular/core';
import { Chart, ChartOptions, Colors, Plugin, registerables } from 'chart.js';

export const PXS_CHART_DEFAULTS = new InjectionToken<ChartOptions>('PXS_CHART_DEFAULTS');
export const PXS_CHART_PLUGINS = new InjectionToken<Plugin[]>('PXS_CHART_PLUGINS');

export function provideCharts(opts?: { defaults?: ChartOptions; plugins?: Plugin[] }): Provider[] {
  // Register built-ins
  Chart.register(...registerables, Colors);

  // Pin Luxon adapter to this Chart instance
  const luxonAdapter = (Chart as any)?._adapters?._date;
  (Chart.defaults as any).adapters = (Chart.defaults as any).adapters ?? {};
  if (luxonAdapter && typeof luxonAdapter.parse === 'function') {
    (Chart.defaults as any).adapters.date = luxonAdapter;
  }

  // Global defaults
  Chart.defaults.responsive = true;
  Chart.defaults.maintainAspectRatio = false;
  Chart.defaults.elements.point.radius = 3;
  Chart.defaults.elements.point.hitRadius = 6;

  if (opts?.defaults) Object.assign(Chart.defaults, opts.defaults);
  if (opts?.plugins?.length) Chart.register(...opts.plugins);

  // DEV: guard against multiple Chart instances
  if (typeof window !== 'undefined') {
    const g = window as any;
    if (g.__PXS_CHART__ && g.__PXS_CHART__ !== Chart) {
      console.warn('[PXS] Multiple Chart.js instances detected; expect hover/tooltip bugs.');
    }
    g.__PXS_CHART__ = Chart;
  }

  return [
    { provide: PXS_CHART_DEFAULTS, useValue: opts?.defaults ?? {} },
    { provide: PXS_CHART_PLUGINS, useValue: opts?.plugins ?? [] },
  ];
}
