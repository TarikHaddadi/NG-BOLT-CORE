# Workflow Builder & Canvas — README

> _Last updated: 2025-10-02_

> Angular 19+ • Standalone components • Signals • `@swimlane/ngx-graph` • CDK Drag&Drop • Dynamic Form (PXS‑NG‑CORE)

This document explains how to **use**, **extend**, and **embed** the Workflow Builder (`WorkflowBuilderComponent`) and Workflow Canvas (`WorkflowCanvasComponent`) used to design node‑based workflows with draggable **Actions**, connectable **ports**, configurable **edges** (arrows, styles), and a per‑node **Inspector** that renders **custom field configurations** via your Core SDK dynamic form.

---

## Table of Contents

- [Quick Start](#quick-start)
- [Architecture](#architecture)
- [Key Concepts](#key-concepts)
- [Data Models](#data-models)
- [Inputs / Outputs of Components](#inputs--outputs-of-components)
- [How to Use the Builder Screen](#how-to-use-the-builder-screen)
- [How to Use the Canvas](#how-to-use-the-canvas)
- [Customizing Nodes (Ports, Labels, Types)](#customizing-nodes-ports-labels-types)
- [Customizing Edges (Arrows, Style, Labels)](#customizing-edges-arrows-style-labels)
- [Inspector & Dynamic Form Integration](#inspector--dynamic-form-integration)
- [Validation Rules](#validation-rules)
- [Persistence (Save / Load DTO)](#persistence-save--load-dto)
- [Internationalization (i18n)](#internationalization-i18n)
- [Styling & Theming](#styling--theming)
- [Performance Tips](#performance-tips)
- [Troubleshooting](#troubleshooting)
- [Testing](#testing)
- [Changelog Hints](#changelog-hints)

---

## Quick Start

### Prerequisites

- Angular **19+** (standalone)
- `@swimlane/ngx-graph` (Dagre layout)
- `@angular/cdk` (Drag&Drop)
- `@cadai/pxs-ng-core` (FieldConfigService, DynamicForm, interfaces)
- `@ngx-translate/core` (optional, used in `WorkflowBuilderComponent` header)
- Angular Material (optional for buttons)

```bash
# install (example versions; align to your workspace)
npm i @swimlane/ngx-graph d3 @angular/cdk
npm i @ngx-translate/core
# Core SDK already in your monorepo:
# @cadai/pxs-ng-core
```

### Minimal Embed (Host App route/component)

```ts
@Component({
  selector: 'app-workflow-builder',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    TranslateModule,
    MatButtonModule,
    DynamicFormComponent,
    WorkflowCanvasComponent,
    SeoComponent,
  ],
  template: `
    <app-seo ... (titleChange)="onTitleChange($event)"></app-seo>

    <div class="card">
      <app-dynamic-form [config]="fieldConfig" [form]="form"></app-dynamic-form>
    </div>

    <div class="card">
      <app-workflow-canvas
        [nodes]="nodes()"
        [edges]="edges()"
        [disabled]="disabled"
        [availableActions]="availableActions"
        (change)="onCanvasChange($event)"
        (validityChange)="isValid.set($event)"
      >
      </app-workflow-canvas>
    </div>

    <div class="footer">
      <button
        mat-raised-button
        [disabled]="form.invalid || saving() || !isValid()"
        (click)="save()"
      >
        {{ saving() ? 'Saving…' : ('SAVE' | translate) }}
      </button>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WorkflowBuilderComponent {
  /* see source */
}
```

---

## Architecture

### Builder vs Canvas

- **WorkflowBuilderComponent**
  - Owns a small header form (e.g., workflow `name`).
  - Hosts `<app-workflow-canvas>`, listens to `(change)` and `(validityChange)`.
  - Packages a **DTO** for persistence (`id`, `name`, `nodes`, `edges`).

- **WorkflowCanvasComponent**
  - Renders a **palette** of actions (draggable pills).
  - Renders an `ngx-graph` canvas with **nodes** and **edges**.
  - Supports **ports** per node (multiple input/output handles).
  - Provides a right‑click **context menu** (Delete/Configure).
  - Provides an **Inspector** panel driven by your **Dynamic Form** fields.
  - Emits `change` with latest `nodes/edges`, and `validityChange` (boolean).

### Rendering Pipeline

1. Host provides domain `nodes`/`edges` (or canvas seeds defaults).
2. Canvas projects them into `GNode[]`/`GEdge[]` for `ngx-graph`.
3. A gated `update$` Subject triggers layout recompute (after view is ready).
4. ResizeObserver adapts canvas size; auto center/zoom happens only when **ready**.

---

## Key Concepts

- **Action**: a draggable item from palette (e.g., `fetch`, `transform`, `store`).
- **Node**: a vertex in the graph. Special types: `input`, `result`, and `action`.
- **Port**: a named input/output on a node, optionally typed (`json`, `text`, etc.).
- **Edge**: connection between two nodes; captures `sourcePort`/`targetPort`, label, and style.
- **Inspector**: side panel for per‑node configuration via dynamic fields.

---

## Data Models

> The interfaces below extend Core SDK interfaces **locally** with optional fields. You can keep the original Core types and add these as intersection types in your component code.

```ts
export type Port = { id: string; label: string; type?: string };

export type NodeWithPorts = WorkflowNode & {
  ports?: {
    inputs?: Port[];
    outputs?: Port[];
  };
  // Typical node.data usage:
  // data: { label: string; params?: any; ports?: { ... } }
};

export type EdgeStyle = {
  stroke?: string;
  strokeWidth?: number;
  dasharray?: string; // e.g., '4 4'
  marker?: 'solid' | 'hollow' | 'round' | 'warn';
  labelColor?: string;
};

export type EdgeWithPortsAndStyle = WorkflowEdge & {
  sourcePort?: string;
  targetPort?: string;
  style?: EdgeStyle;
};
```

### Default Seed

On first load (if no nodes provided) the canvas injects:

- `input-node` (type `input`), and
- `result-node` (type `result`).

---

## Inputs / Outputs of Components

### `<app-workflow-canvas>` Inputs

- `nodes: WorkflowNode[]` — domain nodes (can include ports via `data.ports`).
- `edges: WorkflowEdge[]` — domain edges (can include `sourcePort/targetPort/style`).
- `disabled: Signal<boolean>` — disables drag/connect/context menu.
- `availableActions: Signal<ActionDefinition[]>` — palette items to drag.

### Outputs

- `(change): { nodes: WorkflowNode[]; edges: WorkflowEdge[] }` — any structural change.
- `(validityChange): boolean` — validity result (see [Validation Rules](#validation-rules)).

---

## How to Use the Builder Screen

1. Fill the **Name** field in the top form.
2. Drag **Actions** from the left palette into the canvas.
3. Click an **output port** on a node, then an **input port** on another node to connect.
4. Right‑click a node → **Configure** to open the Inspector; set fields and **Apply**.
5. Press **Save** in the builder footer to persist the assembled DTO.

---

## How to Use the Canvas

### Adding Nodes

- Drag from the **palette** (uses CDK Drag&Drop).
- Nodes are auto‑laid out by `ngx-graph` (Dagre).

### Connecting Nodes

- Click an **output** port (right side) on the source node.
- Then click an **input** port (left side) on the target node.
- Edge will remember `sourcePort`/`targetPort` and adopt default style.

### Editing / Deleting

- **Context menu** (right‑click): Configure / Delete.
- **Inspector** (Configure): opens dynamic form for node params.

---

## Customizing Nodes (Ports, Labels, Types)

Nodes are rendered via `nodeTemplate`. You can:

- Bind **fill color** by type with `nodeFill(type)`.
- Render **multiple ports** with labels & consistent spacing.
- Compute node height from port count (so handles fit).

Example default ports for a dropped **action**:

```ts
const node: NodeWithPorts = {
  id: crypto.randomUUID(),
  type: 'action',
  x: 0,
  y: 0,
  data: {
    label: titleize(action.type),
    params: { ...(action.params ?? {}) },
    ports: {
      inputs: [{ id: 'in', label: 'in', type: 'json' }],
      outputs: [{ id: 'out', label: 'out', type: 'json' }],
    },
  },
};
```

Port compatibility hook:

```ts
private arePortsCompatible(srcNodeId: string, srcPortId: string, tgtNodeId: string, tgtPortId: string): boolean {
  const nSrc = this.nodes.find(n => n.id === srcNodeId) as NodeWithPorts | undefined;
  const nTgt = this.nodes.find(n => n.id === tgtNodeId) as NodeWithPorts | undefined;
  const out = nSrc?.ports?.outputs?.find(p => p.id === srcPortId);
  const inp = nTgt?.ports?.inputs?.find(p => p.id === tgtPortId);
  if (!out || !inp) return true;             // lenient default
  return !out.type || !inp.type || out.type === inp.type;
}
```

---

## Customizing Edges (Arrows, Style, Labels)

Define several markers in `defsTemplate`:

```html
<svg:marker id="arrow-solid" ...><svg:path d="M0,-5L10,0L0,5" fill="currentColor" /></svg:marker>
<svg:marker id="arrow-hollow" ...>
  <svg:path d="M0,-5L10,0L0,5" fill="none" stroke="currentColor" />
</svg:marker>
<svg:marker id="arrow-round" ...><svg:circle r="3" fill="currentColor" /></svg:marker>
<svg:marker id="arrow-warn" ...><svg:path d="M0,5 L10,0 L0,-5 Z" fill="currentColor" /></svg:marker>
```

Bind per‑edge style in the `linkTemplate`:

```html
<svg:path
  class="line"
  [attr.stroke]="link?.data?.style?.stroke || '#607d8b'"
  [attr.stroke-width]="link?.data?.style?.strokeWidth || 2"
  [attr.stroke-dasharray]="link?.data?.style?.dasharray || null"
  [attr.marker-end]="'url(#arrow-' + (link?.data?.style?.marker || 'solid') + ')'"
/>
```

Carry style into `GEdge`:

```ts
const links: GEdge[] = this.edges.map((e) => ({
  id: e.id,
  source: e.source,
  target: e.target,
  label: e['label'] || '',
  data: { style: (e as any).style },
}));
```

Set defaults on connect:

```ts
this.edges = [
  ...this.edges,
  {
    id,
    source: from.nodeId,
    target: nodeId,
    sourcePort: from.portId,
    targetPort: portId,
    label: '',
    style: { marker: 'solid', strokeWidth: 2, stroke: '#607d8b' },
  } as EdgeWithPortsAndStyle,
];
```

---

## Inspector & Dynamic Form Integration

- Selecting a node (or **Configure** via context) opens the Inspector.
- The Inspector hosts your **DynamicFormComponent**, driven by `FieldConfig[]` produced from `FieldConfigService` based on node type.

Typical flow:

```ts
selectedNode = signal<NodeWithPorts | null>(null);
inspectorForm!: FormGroup;
inspectorConfig: FieldConfig[] = [];

onNodeSelected(e: any) {
  const nodeId = e?.id;
  const n = this.nodes.find(x => x.id === nodeId) as NodeWithPorts | undefined;
  if (!n) return;
  selectedNode.set(n);

  const type = n.type === 'action' ? (n.data as any)?.label?.toLowerCase() : n.type;
  inspectorConfig = buildConfigFor(type, (n.data as any)?.params);

  inspectorForm = fb.group({});
  // Let DynamicForm create controls, then patch defaults
  queueMicrotask(() => inspectorForm.patchValue((n.data as any)?.params ?? {}));
}

applyInspector() {
  const node = selectedNode();
  if (!node) return;
  const idx = this.nodes.findIndex(x => x.id === node.id);
  const params = inspectorForm.getRawValue();
  const updated: NodeWithPorts = {
    ...(this.nodes[idx] as any),
    data: { ...(this.nodes[idx].data || {}), params },
  };
  this.nodes = [...this.nodes.slice(0, idx), updated, ...this.nodes.slice(idx + 1)];
  recomputeGraph(); emitChange(); selectedNode.set(null);
}
```

Example field builders:

```ts
switch (type) {
  case 'fetch':
    return [
      fields.getTextField({ name: 'url', label: 'URL', validators: [Validators.required] }),
      fields.getSelectField?.({
        name: 'method',
        label: 'Method',
        options: ['GET', 'POST', 'PUT', 'DELETE'].map((m) => ({ label: m, value: m })),
      }),
      fields.getTextareaField?.({ name: 'headers', label: 'Headers (JSON)', rows: 4 }),
      fields.getTextareaField?.({ name: 'body', label: 'Body (JSON)', rows: 6 }),
    ].filter(Boolean) as FieldConfig[];
  case 'transform':
    return [
      fields.getTextareaField?.({
        name: 'script',
        label: 'Script',
        rows: 8,
        monospace: true,
        validators: [Validators.required],
      }),
    ].filter(Boolean) as FieldConfig[];
  case 'store':
    return [
      fields.getTextField({
        name: 'collection',
        label: 'Collection',
        validators: [Validators.required],
      }),
      fields.getTextField({ name: 'key', label: 'Key expression' }),
    ];
  default:
    return [fields.getTextareaField?.({ name: 'params', label: 'Params (JSON)', rows: 8 })].filter(
      Boolean,
    ) as FieldConfig[];
}
```

---

## Validation Rules

`validityChange` emits **true** when:

1. **All nodes are connected** by at least one edge (either as source or target), and
2. There is at least one edge **from** `input-node` and at least one edge **to** `result-node`.

You can extend this to require a full **path** from input → result.

---

## Persistence (Save / Load DTO)

### Save

```ts
const dto = {
  id: editingId() ?? uuidv4(),
  name: form.getRawValue().name,
  nodes: nodes().map((n) => ({ ...n })), // strip ephemeral flags if needed
  edges: edges(),
};
// Send to your Host API
```

### Load

- Provide `nodes`/`edges` inputs from your backend response.
- The canvas will project and render them; remember to call your host store/router to manage navigation & UX.

---

## Internationalization (i18n)

- The builder header uses `TranslateModule` pipes for labels: `'nav.genai-workflows' | translate` etc.
- Node/Action labels can be translation keys; the canvas simply renders `node.label` as given.

---

## Styling & Theming

- Node colors via `nodeFill(type)`:
  - `input` → `#e3f2fd`
  - `result` → `#e8f5e9`
  - `action` → `#ffffff`
- Override with CSS/SCSS using `.node.input`, `.node.result`, `.node.action` classes.
- Edge color/dash/arrow via `edge.style` (see [Customizing Edges](#customizing-edges-arrows-style-labels)).
- The **palette** pills have `.pxs-wf-pill`; toggle `.disabled` when `[disabled]` signal is true.

---

## Performance Tips

- Use **signals** + `OnPush` to minimize CD. Avoid mutating arrays; create new arrays on changes.
- Always **track** items in `@for` (e.g., `track p.id`) to prevent DOM churn.
- Gate `update$` emissions until **after** `ngAfterViewInit` to avoid `getScreenCTM` errors and redundant layouts.
- If rendering in a hidden tab (`display:none`), force a refresh when the tab becomes visible: `update$.next(true)`.

---

## Troubleshooting

### `Cannot read properties of null (reading 'getScreenCTM')`

Cause: `autoCenter/autoZoom` fires before the SVG exists, or container width is `0`.

**Fix**

- Defer initial `recomputeGraph()`/`update$.next(true)` to `ngAfterViewInit`.
- Bind `[autoCenter]="ready()"` and `[autoZoom]="ready()"`.
- In `ResizeObserver`, guard width/height and fallback when `clientWidth` is `0`.

### Edges don’t follow style changes

Ensure you pass style in `GEdge.data` and trigger `update$.next(true)` after updating arrays by reference (no in‑place mutation).

### Ports overlap labels

Increase node height or vertical spacing (`28 + i*18`). Recompute height based on port count.

---

## Testing

- **Component tests**: Mock `availableActions`, simulate `cdkDropListDropped`, assert `(change)` emissions.
- **Graph projection tests**: Given `nodes/edges`, expect correct `GNode/GEdge` mapping (including `data.style`).
- **Inspector tests**: Select a node → expect `inspectorConfig` built for type and `inspectorForm` patched with params.
- **Validation tests**: Assert `validityChange` for various graphs (disconnected, missing input/result, etc.).

---

## Changelog Hints

When you ship updates, record:

- Added edge markers or styles.
- New action types and their field configurations.
- Validation rule changes.
- Breaking changes in node/edge data shape.

---

**That’s it!** You now have a robust, extensible Workflow Builder + Canvas with ports, stylable edges, and dynamic per‑node configuration wired to your Core SDK forms. Adapt the snippets to your exact service method names & theming tokens, and you’re production‑ready.

## 🧑‍💻 Author

**Angular Product Skeleton**  
Built by **Tarik Haddadi** using Angular 19+and modern best practices (2025).
