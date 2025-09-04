# PXS‑NG Core — Charts in Host Apps

> _Last updated: 2025-09-02_

This guide shows how to use **Chart.js v4** through the `<pxs-chart>` wrapper from `@cadai/pxs-ng-core` in your Host App. It covers installation, bootstrap, sizing, click events, and several ready‑to‑use examples (bar, line with time scale, pie, doughnut, radar, polar area).

> Works with Angular 19/20 and Chart.js 4.x.

---

## 1) Install peer deps in the Host

```bash
npm i chart.js@^4.5.0 chartjs-adapter-luxon@^1.3.1 luxon@^3
```

These are **peerDependencies** of the Core SDK, so hosts must install them.

---

## 2) Bootstrap in the Host

You have two options. **Either** import the Luxon adapter at the Host entrypoint (recommended), **or** rely on the Core provider if it imports the adapter internally.

### Option A — Import adapter in the Host (recommended)

```ts
// main.ts (Host)
import 'chartjs-adapter-luxon'; // register Luxon adapter for Chart.js

import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';

bootstrapApplication(AppComponent, appConfig);
```

### Add Core charts provider

```ts
// app.config.ts (Host)
import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';
import { provideAppStore } from '@cadai/pxs-ng-core/store';
import { provideCharts } from '@cadai/pxs-ng-core/charts'; // exported by Core SDK

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    ...provideAppStore(),
    ...provideCharts({
      defaults: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 250 },
        plugins: {
          legend: { position: 'bottom', labels: { usePointStyle: true } },
          tooltip: { intersect: false, mode: 'index' },
        },
      },
      plugins: [], // optional global plugins
    }),
  ],
};
```

> `provideCharts()` calls `Chart.register(...registerables)` and can set global defaults/plugins.

---

## 3) Sizing (important)

Chart.js is responsive and the canvas will collapse if the parent has no height. Use one of these:

- Wrap with a fixed-height container:

  ```html
  <div style="height:320px">
    <pxs-chart [type]="'bar'" [data]="barData" [options]="barOptions"></pxs-chart>
  </div>
  ```

- Or pass `[height]="300"` to the component:

  ```html
  <pxs-chart [type]="'bar'" [data]="barData" [height]="300"></pxs-chart>
  ```

- Or set `maintainAspectRatio:false` and size the parent with CSS.

---

## 4) Basic usage

```html
<!-- Bar -->
<pxs-chart
  [type]="'bar'"
  [data]="barData"
  [options]="barOptions"
  (elementClick)="onBarClick($event)"
></pxs-chart>

<!-- Line (time scale) -->
<pxs-chart [type]="'line'" [data]="tsData" [options]="tsOptions"></pxs-chart>
```

```ts
import { Component } from '@angular/core';
import { ChartData, ChartOptions, ChartEvent, ActiveElement } from 'chart.js';
import { DateTime } from 'luxon';

@Component({
  selector: 'host-dashboard',
  standalone: true,
  templateUrl: './dashboard.html',
})
export class HostDashboardComponent {
  // BAR
  barData: ChartData<'bar'> = {
    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
    datasets: [{ label: 'Hours', data: [7, 8, 6, 9, 5] }],
  };

  barOptions: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    scales: { y: { beginAtZero: true } },
  };

  onBarClick(e: { event: ChartEvent; elements: ActiveElement[] }) {
    const el = e.elements[0];
    if (!el) return;
    const label = this.barData.labels?.[el.index];
    const value = (this.barData.datasets[el.datasetIndex].data as number[])[el.index];
    console.log('Clicked bar', { label, value });
  }

  // LINE (time)
  // Choose ONE shape for x: Date OR epoch millis.
  tsData: ChartData<'line', { x: Date; y: number }[]> = {
    datasets: [
      {
        label: 'Throughput',
        data: [
          { x: DateTime.now().minus({ days: 4 }).toJSDate(), y: 12 },
          { x: DateTime.now().minus({ days: 3 }).toJSDate(), y: 18 },
          { x: DateTime.now().minus({ days: 2 }).toJSDate(), y: 15 },
          { x: DateTime.now().minus({ days: 1 }).toJSDate(), y: 22 },
          { x: DateTime.now().toJSDate(), y: 19 },
        ],
        tension: 0.25,
      },
    ],
  };

  tsOptions: ChartOptions<'line'> = {
    scales: { x: { type: 'time', time: { unit: 'day' } }, y: { beginAtZero: true } },
  };
}
```

> If you prefer numbers, use `ChartData<'line', {x:number; y:number}[]>` and set `unit: 'millisecond'` when you pass epoch millis.

---

## 5) More examples

### Pie

```html
<pxs-chart
  [type]="'pie'"
  [data]="pieData"
  [options]="pieOptions"
  (elementClick)="onPieClick($event)"
></pxs-chart>
```

```ts
pieData: ChartData<'pie'> = {
  labels: ['Chrome','Safari','Firefox','Edge'],
  datasets: [{ label: 'Share', data: [63,20,10,7] }]
};
pieOptions: ChartOptions<'pie'> = {
  plugins: {
    legend: { position: 'bottom', labels: { usePointStyle: true } },
    tooltip: { callbacks: { label: ctx => `${ctx.label}: ${ctx.formattedValue}%` } }
  }
};
onPieClick(e: { event: ChartEvent; elements: ActiveElement[] }) {
  const el = e.elements[0]; if (!el) return;
  const label = this.pieData.labels?.[el.index];
  const value = (this.pieData.datasets[el.datasetIndex].data as number[])[el.index];
  console.log('Pie clicked:', { label, value });
}
```

### Doughnut

```html
<pxs-chart [type]="'doughnut'" [data]="doughnutData" [options]="doughnutOptions"></pxs-chart>
```

```ts
doughnutData: ChartData<'doughnut'> = {
  labels: ['Completed', 'In Progress', 'Blocked'],
  datasets: [{ label: 'Tasks', data: [42, 18, 5] }],
};
doughnutOptions: ChartOptions<'doughnut'> = {
  cutout: '60%',
  plugins: { legend: { position: 'bottom' } },
};
```

### Radar

```html
<pxs-chart [type]="'radar'" [data]="radarData" [options]="radarOptions"></pxs-chart>
```

```ts
radarData: ChartData<'radar'> = {
  labels: ['Perf', 'A11y', 'Best Practices', 'SEO', 'Security'],
  datasets: [
    { label: 'Project A', data: [85, 72, 80, 68, 74], fill: true },
    { label: 'Project B', data: [78, 66, 75, 80, 70], fill: true },
  ],
};
radarOptions: ChartOptions<'radar'> = {
  scales: { r: { beginAtZero: true, suggestedMax: 100, ticks: { stepSize: 20 } } },
};
```

### Polar Area

```html
<pxs-chart [type]="'polarArea'" [data]="polarData" [options]="polarOptions"></pxs-chart>
```

```ts
polarData: ChartData<'polarArea'> = {
  labels: ['North', 'East', 'South', 'West'],
  datasets: [{ label: 'Wind', data: [11, 7, 14, 9] }],
};
polarOptions: ChartOptions<'polarArea'> = {
  scales: { r: { beginAtZero: true } },
  plugins: { legend: { position: 'right' } },
};
```

---

## 6) Using `{x,y}` points (typing hints)

- If you pass `{x,y}` points, set the **second generic** of `ChartData`:

  ```ts
  // Dates
  const data: ChartData<'line', { x: Date; y: number }[]> = { ... };

  // Epoch millis
  const data: ChartData<'line', { x: number; y: number }[]> = { ... };
  ```

- **Don’t mix** `Date`, `number`, and `string` unless your component input is widened. The Core wrapper can normalize mixed inputs if it implements that feature (optional).

- With time scale:
  ```ts
  options: ChartOptions<'line'> = {
    scales: { x: { type: 'time', time: { unit: 'day' } } },
  };
  ```
  If you use epoch millis, change `unit` to `'millisecond'` or convert to `Date`.

---

## 7) Handling clicks

Every chart emits `(elementClick)` with the active elements and the native event:

```html
<pxs-chart [type]="'bar'" [data]="barData" (elementClick)="onBarClick($event)"></pxs-chart>
```

```ts
onBarClick(e: { event: ChartEvent; elements: ActiveElement[] }) {
  const first = e.elements[0]; if (!first) return;
  const label = this.barData.labels?.[first.index];
  const value = (this.barData.datasets[first.datasetIndex].data as number[])[first.index];
  // Do something...
}
```

---

## 8) Common troubleshooting

- **Nothing displays** → The canvas has no height. Give the parent a height (e.g., `style="height:300px"`) or pass `[height]="300"` and set `maintainAspectRatio:false`.
- **Time scale error (`adapters.date` undefined)** → Ensure the adapter is imported at Host startup:
  ```ts
  import 'chartjs-adapter-luxon';
  ```
  Make sure there’s only **one** `chart.js` in `npm ls chart.js` (deduped).
- **TypeScript error when passing `{x,y}`** → Use `ChartData<'line', {x: Date|number; y: number}[]>` or unify all `x` values to the same type.
- **Changing chart type dynamically** → Prefer destroying and recreating the chart on type change instead of mutating `config.type`.

---

## 9) Quick reference

```html
<div style="height:320px">
  <pxs-chart [type]="'line'" [data]="tsData" [options]="tsOptions"> </pxs-chart>
</div>
```

```ts
tsData: ChartData<'line', { x: Date; y: number }[]> = {
  datasets: [{ label: 'Throughput', data: [{ x: new Date(), y: 1 }] }],
};
tsOptions: ChartOptions<'line'> = { scales: { x: { type: 'time', time: { unit: 'day' } } } };
```

That’s it — happy charting! 🎉

## 🧑‍💻 Author

**Angular Product Skeleton**  
Built by **Tarik Haddadi** using Angular 19 and modern best practices (2025).
