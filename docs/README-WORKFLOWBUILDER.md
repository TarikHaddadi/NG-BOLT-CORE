# Workflow Builder & Canvas — Usage & Integration Guide

_Last updated: 2025-10-03_

Angular 19+ • Standalone components • Signals • `@swimlane/ngx-graph` • CDK Drag&Drop • Dynamic Form (PXS‑NG‑CORE)

This guide adds **light implementation details** on top of the “How to Use” doc—enough to integrate and extend the builder without digging into internal code.

---

## 0) What’s new (compared to earlier drafts)

- **Frozen layout**: replaces Dagre auto-layout with a custom `FrozenLayout` so **nodes never jump** when you add/remove links or drop new nodes.
- **Manual placement**: nodes are placed **exactly** where you drop them; positions are persisted in a local `nodePos` map (and in `WorkflowNode.x/y` if you choose).
- **Port-anchored edges**: links are computed from **port centers** (not node boxes), so arrows **stick to the ports**.
- **Drag-to-connect**: click an output port and drag; a **rubber‑band** ghost line previews the connection.
- **Inspector in dialog**: selection opens a reusable **ConfirmDialog** that hosts the dynamic form; no more absolute overlay.
- **Safe IDs**: edge IDs are CSS‑safe to avoid `querySelector` errors.

---

## 1) What’s in the box

- **Palette → Canvas**: drag any action from the palette to create a node (infinite palette; items don’t disappear).
- **Ports & Links**: click **right port** (output) then **left port** (input) to connect; or click‑drag from output to input.
- **Context Menu**: right‑click node/link → `Configure | Delete | Close`.
- **Inspector**: per‑action form (Dynamic Form) appears in a dialog.
- **Validation**: emits a boolean when the graph satisfies wiring rules.
- **Stable layout**: positions do **not** change after drops/links/deletions.

---

## 2) Quick integration (Host page)

Minimal wrapper to host the canvas and save workflows:

```ts
@Component({
  standalone: true,
  selector: 'app-workflow-builder',
  imports: [CommonModule, ReactiveFormsModule, WorkflowCanvasComponent, DynamicFormComponent],
  template: \`
    <app-dynamic-form [config]="headerConfig" [form]="headerForm"></app-dynamic-form>

    <app-workflow-canvas
      [nodes]="nodes"
      [edges]="edges"
      [disabled]="disabled"
      [availableActions]="availableActions"
      (change)="onCanvasChange($event)"
      (validityChange)="graphValid = $event"
    >
    </app-workflow-canvas>

    <button
      mat-raised-button
      color="primary"
      [disabled]="headerForm.invalid || !graphValid"
      (click)="save()"
    >
      Save
    </button>
  \`,
})
export class WorkflowBuilderComponent {
  headerForm = new FormGroup({ name: new FormControl('', { nonNullable: true }) });
  headerConfig = [
    this.fields.getTextField({ name: 'name', label: 'Workflow name', required: true }),
  ];

  nodes: WorkflowNode[] = []; // initial seed optional
  edges: WorkflowEdge[] = [];
  disabled = signal(false);

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
    // TODO: send to backend
  }
  constructor(private fields: FieldConfigService) {}
}
```

> **Routing**: lazy‑load this builder where you need it. Ensure guards/roles are handled by the host app.

---

## 3) Component inputs / outputs

**Inputs**

- `nodes: WorkflowNode[]` — initial or loaded nodes.
- `edges: WorkflowEdge[]` — initial or loaded edges.
- `disabled: Signal<boolean>` — disables drag, connect, context menu.
- `availableActions: Signal<ActionDefinition[]>` — palette source.

**Outputs**

- `(change): { nodes, edges }` — emitted on any structural change.
- `(validityChange): boolean` — `true` only when graph is valid (see §7).

---

## 4) Data shapes (lightweight)

```ts
type WorkflowNodeType = 'input' | 'action' | 'result';

interface Port {
  id: string;
  label: string;
  type?: string;
}

interface WorkflowNode {
  id: string;
  type: WorkflowNodeType;
  x?: number; // optional but recommended if you also persist
  y?: number;
  data: { label: string; aiType?: string; params?: any };
  ports?: { inputs?: Port[]; outputs?: Port[] };
}

interface WorkflowEdge {
  id: string;
  source: string; // node id
  target: string; // node id
  sourcePort?: string; // port id on source
  targetPort?: string; // port id on target
  label?: string;
  style?: Record<string, any>; // stroke, dasharray, marker, etc.
}

interface ActionDefinition {
  type: string;
  params?: any;
}
```

**Special nodes**

- `input-node` is normalized to **have an output** port `{id:'out'}`.
- `result-node` is normalized to **have an input** port `{id:'in'}`.

---

## 5) Actions & the Inspector

- The canvas looks at `node.data.aiType` (for action nodes) and builds the Inspector form from an **action registry** (maps action type → field list and defaults).
- Defaults supported (examples):
  - `chat-basic` — `prompt` (textarea).
  - `chat-on-file` — `prompt` + `files[]`.
  - `compare` — `leftFile` + `rightFile`.
  - `summarize` — `file`.
  - `extract` — `entities` (+ optional `text`).

**Adding a new action**

1. Palette: add `{ type: 'translate-text', params: { targetLang: 'en', text: '' } }`.
2. Registry: define `fields` + `defaults` for that `aiType`.
3. Backend: implement execution using the saved `params`.

---

## 6) Drag & Drop semantics

- Dragging an item from the **Palette** creates a **new** node (copy).
- Palette buttons remain (infinite palette).
- If drop is canceled/outside, the button returns to the palette.
- The canvas drop is gated by `disabled()` to prevent edits.

---

## 7) Ports, links & validity

**Connecting**

- Click/drag from **output** → release on **input** to connect.
- Edge IDs should include port ids for uniqueness (e.g., `e-src__out--tgt__in`).

**Compatibility**

- If both ports specify a `type` (e.g., `"json"`), they must match; otherwise, the connection is ignored.

**Validity (`validityChange`)**

- **Input** must have **≥1 outgoing** edge.
- **Result** must have **≥1 incoming** edge.
- Every **Action** must have **≥1 incoming** **and** **≥1 outgoing** edge.

---

## 8) Layout & stability (frozen)

- Uses a custom **`FrozenLayout`** that **never** repositions nodes.
- Node positions are stored in a `Map<string, {x,y}>` and can be mirrored into each `WorkflowNode.x/y` for persistence.
- Width is responsive; height is fixed (e.g., 640px) for predictable SVG behavior.
- Graph redraws are batched via `requestAnimationFrame` and `update$`.

**Tip**: Persist `x/y` per node so reloading a workflow fully restores its layout.

---

## 9) Styling & theming

```scss
.node.input rect {
  fill: var(--pxs-node-input, #e3f2fd);
}
.node.result rect {
  fill: var(--pxs-node-result, #e8f5e9);
}
.edge .line {
  stroke: var(--pxs-edge, #607d8b);
}
.wf-handle {
  cursor: pointer;
}
.pxs-wf-canvas {
  height: 640px;
  overflow: hidden;
}
```

---

## 10) Persistence format (example)

```json
{
  "name": "My Workflow",
  "nodes": [
    {
      "id": "input-node",
      "type": "input",
      "x": 60,
      "y": 60,
      "data": { "label": "Input" },
      "ports": { "outputs": [{ "id": "out", "label": "out", "type": "json" }] }
    },
    {
      "id": "action-1",
      "type": "action",
      "x": 200,
      "y": 160,
      "data": { "label": "Summarize", "aiType": "summarize", "params": { "file": "file-123" } },
      "ports": {
        "inputs": [{ "id": "in", "label": "in", "type": "json" }],
        "outputs": [{ "id": "out", "label": "out", "type": "json" }]
      }
    },
    {
      "id": "result-node",
      "type": "result",
      "x": 460,
      "y": 60,
      "data": { "label": "Result" },
      "ports": { "inputs": [{ "id": "in", "label": "in", "type": "json" }] }
    }
  ],
  "edges": [
    {
      "id": "e-input-node__out--action-1__in",
      "source": "input-node",
      "target": "action-1",
      "sourcePort": "out",
      "targetPort": "in"
    },
    {
      "id": "e-action-1__out--result-node__in",
      "source": "action-1",
      "target": "result-node",
      "sourcePort": "out",
      "targetPort": "in"
    }
  ]
}
```

---

## 11) i18n (labels & errors)

- Node labels can be plain strings (already translated) or keys you translate in the host.
- Suggested file‑field error keys:

```json
"file": {
  "accept": "Field only accepts: {{requiredTypes}}.",
  "required": "Field is required.",
  "maxFiles": "Max {{requiredLength}} file(s). Selected: {{actualLength}}.",
  "maxFileSize": "Max size {{requiredLength}}.",
  "maxTotalSize": "Max total size {{requiredLength}}."
}
```

```json
"file": {
  "accept": "Types autorisés : {{requiredTypes}}.",
  "required": "Champ obligatoire.",
  "maxFiles": "Maximum {{requiredLength}} fichier(s). Sélectionné(s) : {{actualLength}}.",
  "maxFileSize": "Taille maximale {{requiredLength}}.",
  "maxTotalSize": "Taille totale maximale {{requiredLength}}."
}
```

---

## 🧑‍💻 Author

**Angular Product Skeleton**  
Built by **Tarik Haddadi** using Angular 19+ and modern best practices (2025).
