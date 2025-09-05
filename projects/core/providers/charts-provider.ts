import 'chartjs-adapter-luxon';
import { InjectionToken, Provider } from '@angular/core';
import { Chart, ChartOptions, Colors, Plugin, registerables } from 'chart.js';

export const PXS_CHART_DEFAULTS = new InjectionToken<ChartOptions>('PXS_CHART_DEFAULTS');
export const PXS_CHART_PLUGINS = new InjectionToken<Plugin[]>('PXS_CHART_PLUGINS');

function isPlainObject(v: any): v is Record<string, any> {
  return v && typeof v === 'object' && !Array.isArray(v);
}
function deepMerge<T>(target: T, source: any): T {
  if (!isPlainObject(source)) return target;
  const t: any = target ?? {};
  for (const k of Object.keys(source)) {
    const sv = source[k];
    const tv = (t as any)[k];
    if (isPlainObject(sv)) {
      (t as any)[k] = deepMerge(isPlainObject(tv) ? tv : {}, sv);
    } else {
      (t as any)[k] = sv; // arrays/primitives replace
    }
  }
  return t;
}

export function provideCharts(opts?: { defaults?: ChartOptions; plugins?: Plugin[] }): Provider[] {
  // 1) Register controllers/elements/scales + Colors
  Chart.register(...registerables, Colors);

  // 2) Make sure Luxon date adapter is pinned on THIS Chart instance
  const luxon = (Chart as any)?._adapters?._date;
  (Chart.defaults as any).adapters = (Chart.defaults as any).adapters ?? {};
  if (luxon && typeof luxon.parse === 'function') {
    (Chart.defaults as any).adapters.date = luxon;
  }

  // 3) Sane globals (don’t remove built-ins!)
  Chart.defaults.responsive = true;
  Chart.defaults.maintainAspectRatio = false;
  Chart.defaults.elements.point.radius = 3;
  Chart.defaults.elements.point.hitRadius = 6;

  // Keep tooltips ON everywhere unless a chart disables them explicitly
  Chart.defaults.plugins.tooltip = {
    ...Chart.defaults.plugins.tooltip,
    enabled: true,
    // leave position at default "average" unless user overrides
  };

  // 4) Deep-merge caller defaults so we don’t blow away plugins/scales like tooltip/r
  if (opts?.defaults) deepMerge(Chart.defaults as any, opts.defaults as any);
  if (opts?.plugins?.length) Chart.register(...opts.plugins);

  return [
    { provide: PXS_CHART_DEFAULTS, useValue: opts?.defaults ?? {} },
    { provide: PXS_CHART_PLUGINS, useValue: opts?.plugins ?? [] },
  ];
}
