# Workflow Builder & Canvas — Usage & Integration Guide

_Last updated: 2025-10-02_

Angular 19+ • Standalone components • Signals • `@swimlane/ngx-graph` • CDK Drag&Drop • Dynamic Form (PXS‑NG‑CORE)

This guide adds **light implementation details** on top of the “How to Use” doc—enough to integrate and extend the builder without digging into internal code.

---

## 1) What’s in the box

- **Palette → Canvas**: drag any action from the palette to create a node (infinite palette; items don’t disappear).
- **Ports & Links**: click **right port** (output) then **left port** (input) to connect.
- **Context Menu**: right‑click node/link → `Configure | Delete | Close`.
- **Inspector**: per‑action form (Dynamic Form) appears on select/configure.
- **Validation**: canvas emits a boolean when the graph satisfies wiring rules.
- **Stable sizing**: fixed canvas height (e.g., 640px) to avoid infinite layout growth.

---

## 2) Quick integration (Host page)

Minimal wrapper to host the canvas and save workflows:

```ts
@Component({
  standalone: true,
  selector: 'app-workflow-builder',
  imports: [CommonModule, ReactiveFormsModule, WorkflowCanvasComponent, DynamicFormComponent],
  template: `
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
  `,
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

## 3) Inputs / Outputs (Component contract)

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

Keep your own typings, but the canvas expects these properties:

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
  data: { label: string; aiType?: string; params?: any };
  ports?: { inputs?: Port[]; outputs?: Port[] };
}

interface WorkflowEdge {
  id: string; // recommended: "src:port -> tgt:port"
  source: string; // node id
  target: string; // node id
  sourcePort?: string;
  targetPort?: string;
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

## 5) Actions & the Inspector (how it decides which fields to show)

- The canvas looks at `node.data.aiType` (for action nodes) and builds the Inspector form from an internal **action registry** (maps action type → field list and defaults).
- Default actions provided:
  - `chat-basic` — textarea `prompt`; optional `temperature` select.
  - `chat-on-file` — textarea `prompt` + **files[]** (multi).
  - `compare` — **leftFile** + **rightFile**.
  - `summarize` — **file** + summary `length` select.
  - `extract` — `entities` + optional `text`.

**To add a new action** (example):

1. Define it in your palette `availableActions` with a `type` and optional `params` defaults.
2. Add its field list in the action registry (one place).
3. The Inspector will render it automatically when that node is selected.

> Files: upload on save, then store **file references** (IDs/URLs) inside `node.data.params` for persistence.

---

## 6) Drag & Drop semantics

- Dragging an item from the **Palette** creates a **new** node (copy behavior).
- The palette button remains in place (you can drag it **infinitely**).
- If the drop is canceled/outside, the button **returns** to the palette.
- The canvas drop is gated by `disabled()` to prevent edits when needed.

---

## 7) Ports, links & validity (the rules)

**Connecting**

- Click **source** node’s **right** port → click **target** node’s **left** port.
- Edge IDs usually include port ids: `A:out -> B:in` (recommended for uniqueness).

**Compatibility**

- If both ports specify `type` (e.g., `"json"`), they must match; otherwise, connection is ignored.

**Validity (emitted via `validityChange`)**

- **Input** must have **≥1 outgoing** edge.
- **Result** must have **≥1 incoming** edge.
- Every **Action** must have **≥1 incoming** **and** **≥1 outgoing** edge.

Your host page can disable the Save button until `validityChange === true`.

---

## 8) Sizing & layout (important for stability)

- The canvas uses a fixed **height** (e.g., 640px) so the SVG **won’t grow the page**.
- Width follows the parent container via a `ResizeObserver`.
- Graph updates are throttled with `requestAnimationFrame` and pushed via `update$`.
- `autoCenter` is enabled; `autoZoom` is conservative to avoid layout thrash.

**Tip**: Place the canvas in a container that has a definite width and a fixed (or predictable) height.

---

## 9) Styling & theming

- Nodes get light fills by type (Input = blue tint, Result = green tint); override in your global/theme SCSS:

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
```

- The canvas clamps height and hides overflow; adjust to fit your layout:

```scss
.pxs-wf-canvas {
  height: 640px;
  overflow: hidden;
}
```

---

## 10) Persistence format (recommendation)

Store and reload **verbatim**:

```json
{
  "name": "My Workflow",
  "nodes": [
    {
      "id": "input-node",
      "type": "input",
      "data": { "label": "Input" },
      "ports": { "outputs": [{ "id": "out", "label": "out", "type": "json" }] }
    },
    {
      "id": "action-1",
      "type": "action",
      "data": { "label": "Summarize", "aiType": "summarize", "params": { "file": "file-123" } },
      "ports": {
        "inputs": [{ "id": "in", "label": "in", "type": "json" }],
        "outputs": [{ "id": "out", "label": "out", "type": "json" }]
      }
    },
    {
      "id": "result-node",
      "type": "result",
      "data": { "label": "Result" },
      "ports": { "inputs": [{ "id": "in", "label": "in", "type": "json" }] }
    }
  ],
  "edges": [
    {
      "id": "input-node:out -> action-1:in",
      "source": "input-node",
      "target": "action-1",
      "sourcePort": "out",
      "targetPort": "in"
    },
    {
      "id": "action-1:out -> result-node:in",
      "source": "action-1",
      "target": "result-node",
      "sourcePort": "out",
      "targetPort": "in"
    }
  ]
}
```

> If files are local during editing, convert them to **references** before saving.

---

## 11) i18n (labels & errors)

- Node labels are plain strings (e.g., `"Summarize"`). You can pass translated values when creating nodes.
- File‑field errors—recommended keys (English/French examples):

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

## 12) Extending the system (new actions)

To add `translate-text` as a new action:

1. **Palette**: add `{ type: 'translate-text', params: { targetLang: 'en', text: '' } }`.
2. **Registry**: define an Inspector form (fields: `text`, `targetLang`).
3. **Backend**: teach your executor how to run it using the saved `params`.
4. **(Optional)**: enforce port `type` if needed (e.g., `"text"`).

No other changes are needed in the canvas; it will render ports, allow wiring, and persist `params`.

---

## 13) Troubleshooting quick table

| Symptom                   | Cause                              | Fix                                                       |
| ------------------------- | ---------------------------------- | --------------------------------------------------------- |
| Canvas keeps growing      | SVG measured itself                | Fix container height (e.g., 640px)                        |
| Items vanish from palette | Move instead of copy               | Ensure palette drag **copies** and resets item            |
| Can’t connect nodes       | Click order wrong or type mismatch | Click **output → input**; align port `type` values        |
| Save disabled             | Graph invalid                      | Wire Input → … → Result; ensure every Action has in & out |
| Touch scroll lag          | Non‑passive listeners              | Add `touch-action: none` to interactive areas             |

---

## 14) Versioning & assumptions

- Tested with Angular 16–19; `@swimlane/ngx-graph` Dagre layout.
- Uses Signals and standalone components.
- Depends on your Dynamic Form adapters (`FieldConfigService`, `DynamicFormComponent`).

---

**That’s it** — with the above you can embed the builder, configure the palette, validate graphs, and persist workflows without diving into implementation internals.

## 🧑‍💻 Author

**Angular Product Skeleton**  
Built by **Tarik Haddadi** using Angular 19+and modern best practices (2025).
