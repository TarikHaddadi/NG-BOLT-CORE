# Workflow Builder & Canvas — README

_Last updated: 2025-10-02_

Angular 16–19 • Standalone components • Signals • `@swimlane/ngx-graph` • CDK Drag&Drop • Dynamic Form (PXS‑NG‑CORE)

This guide shows how to **use**, **extend**, and **embed** the Workflow Builder (`WorkflowBuilderComponent`) and Workflow Canvas (`WorkflowCanvasComponent`) for node‑based workflows with draggable **Actions**, connectable **ports**, stylable **edges**, and an **Inspector** powered by your Dynamic Form system.

---

## Table of Contents

- [Quick Start](#quick-start)
- [Architecture](#architecture)
- [Key Concepts](#key-concepts)
- [Data Models (updated)](#data-models-updated)
- [Host App Integration](#host-app-integration)
- [Canvas API](#canvas-api)
- [Inspector & Dynamic Form](#inspector--dynamic-form)
- [File Input Field (new)](#file-input-field-new)
- [Validation Rules](#validation-rules)
- [Persistence](#persistence)
- [Internationalization (i18n)](#internationalization-i18n)
- [Styling & Theming](#styling--theming)
- [Performance Tips](#performance-tips)
- [Troubleshooting](#troubleshooting)
- [Changelog](#changelog)

---

## Quick Start

### Install deps (align versions to your workspace)

```bash
npm i @swimlane/ngx-graph d3 @angular/cdk
npm i @ngx-translate/core
# @cadai/pxs-ng-core already in repo
```

### Add a route in the Host App

```ts
{
  path: 'workflows/new',
  canActivate: [featureGuard('ai.workflows', { forbid: '/403' })],
  data: { roles: [UserRole.ROLE_admin, UserRole.ROLE_user] },
  loadComponent: () => import('@cadai/pxs-ng-core/shared').then(m => m.WorkflowBuilderComponent),
},
{
  path: 'workflows/:id/edit',
  canActivate: [featureGuard('ai.workflows', { forbid: '/403' })],
  data: { roles: [UserRole.ROLE_admin, UserRole.ROLE_user] },
  loadComponent: () => import('@cadai/pxs-ng-core/shared').then(m => m.WorkflowBuilderComponent),
},
```

### Minimal host wrapper

```ts
@Component({
  standalone: true,
  selector: 'app-workflow-builder',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    TranslateModule,
    MatButtonModule,
    DynamicFormComponent,
    WorkflowCanvasComponent,
  ],
  template: `
    <div class="card">
      <app-dynamic-form [config]="headerConfig" [form]="headerForm"></app-dynamic-form>
    </div>

    <div class="card">
      <app-workflow-canvas
        [nodes]="nodes"
        [edges]="edges"
        [disabled]="disabled"
        [availableActions]="availableActions"
        (change)="onCanvasChange($event)"
        (validityChange)="graphValid = $event"
      >
      </app-workflow-canvas>
    </div>

    <div class="footer">
      <button
        mat-raised-button
        color="primary"
        [disabled]="headerForm.invalid || !graphValid"
        (click)="save()"
      >
        Save
      </button>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WorkflowBuilderComponent {
  headerForm = new FormGroup({ name: new FormControl('', { nonNullable: true }) });
  headerConfig = [
    this.fields.getTextField({ name: 'name', label: 'Workflow name', required: true }),
  ];

  nodes: WorkflowNode[] = [];
  edges: WorkflowEdge[] = [];
  disabled = signal(false);

  // Your palette — now using the new AI actions
  availableActions = signal<ActionDefinition[]>([
    { type: 'chat-basic', params: { prompt: '' } },
    { type: 'chat-on-file', params: { prompt: '', files: [] } },
    { type: 'compare', params: { leftFile: null, rightFile: null } },
    { type: 'summarize', params: { file: null } },
    { type: 'extract', params: { text: '', entities: '' } },
  ]);

  onCanvasChange(e: { nodes: WorkflowNode[]; edges: WorkflowEdge[] }) {
    this.nodes = e.nodes;
    this.edges = e.edges;
  }

  save() {
    const dto = { name: this.headerForm.getRawValue().name, nodes: this.nodes, edges: this.edges };
    // persist
  }
  constructor(private fields: FieldConfigService) {}
}
```

> **Note**: You can fetch `availableActions` from your API; the canvas just needs `type` + `params` defaults.

---

## Architecture

- **WorkflowCanvasComponent**
  - Renders **palette** (CDK drag).
  - Renders **graph** (`ngx-graph` Dagre) with **nodes/edges**.
  - Supports **ports** per node; clicks on port connect nodes.
  - Has **context menu** (Configure/Delete).
  - Shows **Inspector** (DynamicForm) to edit node params.
  - Emits `(change)` and `(validityChange)`.

- **DynamicFormComponent**
  - Interprets `FieldConfig[]` into Angular Material controls.
  - New `file` field support included.

---

## Key Concepts

- **Action types (updated)**:
  - `chat-basic` (textarea prompt)
  - `chat-on-file` (prompt + 1..n files)
  - `compare` (left + right files)
  - `summarize` (single file)
  - `extract` (entities CSV, optional text)
- **Ports**: `inputs/outputs` arrays per node for precise wiring.
- **Edges**: store style (`stroke`, `dasharray`, `marker`) and port IDs.
- **Inspector**: per-node form based on `aiType` → field config.

---

## Data Models (updated)

```ts
export type WorkflowNodeType = 'input' | 'action' | 'result';

export interface Ports {
  inputs?: Port[];
  outputs?: Port[];
}
export interface Port {
  id: string;
  label: string;
  type?: string;
}

export type WorkflowNode = {
  id: string;
  type: WorkflowNodeType;
  x?: number;
  y?: number;
  data: WorkflowNodeData;
  ports?: Ports;
};

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  sourcePort?: string;
  targetPort?: string;
  style: Record<string, string | undefined | null>; // or EdgeStyle if you prefer
}

export type WorkflowNodeData = InputNodeData | ResultNodeData | ActionNodeData;
export interface InputNodeData {
  label: string;
  kind?: 'input';
}
export interface ResultNodeData {
  label: string;
  kind?: 'result';
}

export type AiActionType = 'chat-basic' | 'chat-on-file' | 'compare' | 'summarize' | 'extract';
export type FileRef = string;
export type PersistableFile = FileRef | File | Blob;

export type ActionNodeData =
  | { label: string; aiType: 'chat-basic'; params: { prompt: string } }
  | { label: string; aiType: 'chat-on-file'; params: { prompt: string; files: PersistableFile[] } }
  | {
      label: string;
      aiType: 'compare';
      params: { leftFile: PersistableFile | null; rightFile: PersistableFile | null };
    }
  | { label: string; aiType: 'summarize'; params: { file: PersistableFile | null } }
  | { label: string; aiType: 'extract'; params: { text?: string; entities: string } };

export const ACTION_LABEL: Record<AiActionType, string> = {
  'chat-basic': 'Chat (basic)',
  'chat-on-file': 'Chat on file(s)',
  compare: 'Compare two files',
  summarize: 'Summarize file',
  extract: 'Extract entities',
};
```

---

## Host App Integration

You can **eagerly** declare the palette (as shown in Quick Start) or **fetch** it from your API. The canvas only needs a list of `{ type, params }`.

If you embed within an existing layout, ensure the canvas container has a **non‑zero width/height** to avoid SVG `getScreenCTM` issues (see Troubleshooting).

---

## Canvas API

### Inputs

- `nodes: WorkflowNode[]`
- `edges: WorkflowEdge[]`
- `disabled: Signal<boolean>`
- `availableActions: Signal<ActionDefinition[]>`

### Outputs

- `(change): { nodes, edges }`
- `(validityChange): boolean`

### Behavior & Fixes

- Uses a **ResizeObserver** to set `canvasW/H`; height is clamped to avoid infinite page scroll.
- First render / layout happens **after view init**; `[autoCenter]` and `[autoZoom]` are gated by `ready()`.
- Graph updates are **coalesced** with `requestAnimationFrame` before pushing to `update$`.
- Ports are included in `gNodes[].data.ports` so the SVG template can render handles.

### Connecting by ports

- Click a **source** (right) → click a **target** (left).
- Edge ID includes port IDs: `sourceId:port -> targetId:port`.
- Compatibility check is lenient unless both ports define `type` and they mismatch.

---

## Inspector & Dynamic Form

- Selecting a node opens an Inspector that builds `FieldConfig[]` based on `aiType`.
- Builders for 5 action types:
  - `chat-basic`: textarea `prompt`
  - `chat-on-file`: textarea `prompt` + **file** field (`multiple: true`)
  - `compare`: two **file** fields (`leftFile/rightFile`)
  - `summarize`: single **file** field
  - `extract`: textarea `text` (optional) + text `entities`

Apply guardrails in `applyInspector()` to enforce file counts (e.g., compare requires both files).

---

## File Input Field (new)

### FieldConfig additions

```ts
export interface FieldConfig {
  defaultValue?: string | number | boolean | File | File[] | string[]; // for text/email/phone/password, etc.
  accept?: string;
  maxFiles?: number;
  maxFileSize?: number; // bytes
  maxTotalSize?: number; // bytes
  multiple?: boolean;
}
```

### Field generator

```ts
getFileField(overrides: Partial<FieldConfig> = {}): FieldConfig { /* see service */ }
```

### DynamicForm control

```ts
case 'file': { /* see DynamicForm code */ }
```

### FieldHost mapping

```ts
file: InputFileComponent;
```

### File component highlights

- Handles single/multiple values and string refs.
- Client‑side checks for `accept`, `maxFiles`, `maxFileSize`, `maxTotalSize`.
- Error mapping aligned with i18n (see below).
- Fixes: placeholder pipe precedence; `setErrors(null)` when cleared.

---

## Validation Rules

Canvas emits `validityChange = true` when:

1. Every node is present in edges (source or target), and
2. At least one edge from **input-node** and one edge to **result-node**.

---

## Persistence

Upload files first and replace `File` with `FileRef` in `params` before saving. On load, you can keep `string[]` to show in the file list.

---

## Internationalization (i18n)

**English**:

```json
"file": {
  "accept": "Field only accepts the following types: {{requiredTypes}}.",
  "required": "Field is required.",
  "maxFiles": "Maximum {{requiredLength}} file(s) allowed (you selected {{actualLength}}).",
  "maxFileSize": "Maximum file size {{requiredLength}} allowed.",
  "maxTotalSize": "Maximum total size {{requiredLength}} allowed."
}
```

**French**:

```json
"file": {
  "accept": "Ce champ accepte uniquement les types suivants : {{requiredTypes}}.",
  "required": "Ce champ est obligatoire.",
  "maxFiles": "Nombre maximal de fichiers autorisés : {{requiredLength}} (vous en avez sélectionné {{actualLength}}).",
  "maxFileSize": "Taille maximale de fichier autorisée : {{requiredLength}}.",
  "maxTotalSize": "Taille totale maximale autorisée : {{requiredLength}}."
}
```

---

## Styling & Theming

```scss
$shadow-color: #000;

.pxs-wf-root {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.pxs-wf-canvas {
  position: relative;
  min-height: 640px;
  border: 1px solid var(--pxs-border, #e0e0e0);
  border-radius: 8px;
  overflow: hidden;
}

.chart-container,
.chart-container svg {
  width: 100%;
  height: 100%;
  display: block;
}

.node.input rect {
  fill: #e3f2fd;
}
.node.result rect {
  fill: #e8f5e9;
}

.edge .line {
  stroke: var(--pxs-primary, #1976d2);
  fill: none;
}

.wf-handle {
  fill: #fff;
  stroke: #1976d2;
  stroke-width: 3px;
  cursor: pointer;
  filter: drop-shadow(0 0 2px rgba($shadow-color, 0.3));
}
```

---

## Performance Tips

- Signals + `OnPush`.
- New array references on changes.
- `track p.id` in `@for`.
- rAF coalescing for `update$`.
- Gated `autoCenter/autoZoom` with `ready()`.

---

## Troubleshooting

### `Cannot read properties of null (reading 'getScreenCTM')`

- Run first layout after `ngAfterViewInit`.
- Use `[autoCenter]="ready()"`, `[autoZoom]="ready()"`.
- Guard size in `ResizeObserver`.

### Infinite page scroll

- Clamp height in CSS and compute with fallback.

### Can't bind to `[nodeTemplate]`

- Do not bind; just declare `#nodeTemplate`, `#linkTemplate`, `#defsTemplate` inside `<ngx-graph>`.

---

## Changelog

- Replaced actions with **chat-basic, chat-on-file, compare, summarize, extract**.
- Added **ActionNodeData** union.
- Implemented **file** field with validators + i18n.
- DynamicForm: `file` control support + widened `defaultValue` type.
- Fixed SVG timing & infinite scroll.
- Fixed SCSS `$shadow-color` usage.
- Added FR translations for file errors.
- Simplified `ngx-graph` templates.

## 🧑‍💻 Author

**Angular Product Skeleton**  
Built by **Tarik Haddadi** using Angular 19+and modern best practices (2025).
