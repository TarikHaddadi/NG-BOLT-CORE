# Workflow Canvas — Migration to `@ng-draw-flow/core`

> _Last updated: 2025-10-06_

This document explains how to migrate your workflow canvas from **ngx-graph** to **@ng-draw-flow/core** with strict typing, palette → canvas drag & drop, pan/zoom, arrowed connections, node selection, and an action-specific **inspector dialog** that uses your existing `ConfirmDialogComponent` + `DynamicFormComponent`.

> This guide assumes Angular 17–19, strict mode, and standalone components. It also assumes you already use your shared `ConfirmDialogComponent`, `DynamicFormComponent`, and the `FieldConfigService` API.

## ️📦 Install

```bash
npm i @ng-draw-flow/core
```

If you don’t already have them in this feature:

```bash
npm i @angular/cdk @angular/material
```

## 🗂️ File structure (suggested)

```
projects/core/shared/workflows/
  ├─ action-node.component.ts            # Node renderer (ports + styling)
  ├─ action-forms.ts                     # Registry of inspector forms per aiType
  ├─ draw-flow.config.ts                 # Global DrawFlow options provider
  ├─ workflow-canvas-df.component.html   # Canvas template (CDK palette + <ng-draw-flow>)
  ├─ workflow-canvas-df.component.scss   # Canvas styles
  └─ workflow-canvas.component.ts     # Canvas logic (data mapping, events, dialog)
```

## 🔧 Global options

**`./draw-flow.config.ts`**

```ts
import { FactoryProvider } from '@angular/core';
import { provideNgDrawFlowConfigs, DfOptions, DfConnectionType } from '@ng-draw-flow/core';

export const DRAW_FLOW_PROVIDER: FactoryProvider = provideNgDrawFlowConfigs({
  connection: {
    type: DfConnectionType.SmoothStep,
    arrowhead: 'triangle',
    curvature: 0.25,
  },
  nodes: {},
} as Partial<DfOptions>);
```

Provide this in the **standalone** canvas component via `providers: [DRAW_FLOW_PROVIDER]`.

## 🔗 Using the canvas

```ts
@Component({
  standalone: true,
  imports: [WorkflowCanvasDfComponent],
  template: `<app-workflow-canvas-df
    [nodes]="nodes"
    [edges]="edges"
    [availableActions]="availableActions"
    (change)="onChange($event)"
  ></app-workflow-canvas-df>`,
})
export class MyPageComponent {
  nodes: WorkflowNode[] = [
    {
      id: 'input-node',
      type: 'input',
      x: 60,
      y: 60,
      data: { label: 'Input' },
      ports: { inputs: [], outputs: [{ id: 'out', label: 'out', type: 'json' }] },
    },
  ];
  edges: WorkflowEdge[] = [];
  availableActions: ActionDefinitionLite[] = [
    { type: 'input' },
    { type: 'chat-basic' },
    { type: 'chat-on-file' },
    { type: 'compare' },
    { type: 'summarize' },
    { type: 'extract' },
    { type: 'result' },
  ];

  onChange(e: { nodes: WorkflowNode[]; edges: WorkflowEdge[] }) {
    this.nodes = e.nodes;
    this.edges = e.edges;
  }
}
```

## 🧪 Troubleshooting

- **`cdkDropList*` bindings not recognized** → ensure `DragDropModule` is in the component’s `imports`.
- **`[connectorData]` not found on `df-input`/`df-output`** → ensure the node component `imports: [DfInputComponent, DfOutputComponent]`.
- **Dropping at wrong position** → divide the client delta by current `(scale)` and use the `<ng-draw-flow>` element’s bounding rect (as implemented above).
- **Selection doesn’t open inspector** → check the event payload key (`id` vs `nodeId`) for your library version.

## ✅ Why this migration solves your old issues

- **No CTM headaches / double-SVG**: DrawFlow keeps logical scene coordinates; one canvas element.
- **Arrows & connections**: Provided by the library; arrowheads configured via provider.
- **Pan/zoom**: Built-in. We simply divide by `scale` for pallet drops.
- **Inspector**: Your existing dialog pattern is reused; `ACTION_FORMS` drive dynamic fields.

---

## 🧑‍💻 Author

**Angular Product Skeleton**  
Built by **Tarik Haddadi** using Angular 19+ and modern best practices (2025).
