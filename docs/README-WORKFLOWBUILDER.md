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

## 🧩 Node component (ports)

**`./action-node.component.ts`**

```ts
import { Component } from '@angular/core';
import { DrawFlowBaseNode, DfInputComponent, DfOutputComponent } from '@ng-draw-flow/core';
import {
  WorkflowPorts,
  WorkflowNodeDataBase,
  WorkflowNodeType,
} from '@cadai/pxs-ng-core/interfaces';

type NodeModelShape = WorkflowNodeDataBase & {
  type: WorkflowNodeType;
  ports?: WorkflowPorts;
};

function isNodeModelShape(x: unknown): x is NodeModelShape {
  if (typeof x !== 'object' || x === null) return false;
  const t = (x as { type?: unknown }).type;
  const allowed: ReadonlyArray<PaletteType> = [
    'input',
    'result',
    'chat-basic',
    'chat-on-file',
    'compare',
    'summarize',
    'extract',
  ];
  if (!allowed.includes(t as PaletteType)) return false;

  const ports = (x as { ports?: unknown }).ports;
  if (ports === undefined) return true;
  if (typeof ports !== 'object' || ports === null) return false;
  const ins = (ports as { inputs?: unknown }).inputs;
  const outs = (ports as { outputs?: unknown }).outputs;
  return (ins === undefined || Array.isArray(ins)) && (outs === undefined || Array.isArray(outs));
}

@Component({
  selector: 'wf-node',
  standalone: true,
  imports: [DfInputComponent, DfOutputComponent],
  template: `
    <div
      class="wf-node"
      [class.input]="type() === 'input'"
      [class.result]="type() === 'result'"
      [class.action]="type() === 'action'"
    >
      <div class="title">{{ label() }}</div>

      <!-- Left side inputs -->
      <div class="ports left">
        <df-input
          *ngFor="let p of inPorts(); trackBy: trackPort"
          class="input"
          [connectorData]="{ nodeId: nodeId, connectorId: p.id, single: true }"
        >
        </df-input>
      </div>

      <!-- Right side outputs -->
      <div class="ports right">
        <df-output
          *ngFor="let p of outPorts(); trackBy: trackPort"
          class="output"
          [connectorData]="{ nodeId: nodeId, connectorId: p.id, single: false }"
        >
        </df-output>
      </div>
    </div>
  `,
  styles: [
    `
      .wf-node {
        min-width: 220px;
        border-radius: 8px;
        padding: 8px 12px;
        color: #fff;
        position: relative;
        user-select: none;
      }
      .wf-node.input {
        background: var(--mat-success, #2e7d32);
      }
      .wf-node.result {
        background: var(--mat-accent, #7b1fa2);
      }
      .wf-node.action {
        background: var(--mat-primary, #1976d2);
      }
      .title {
        font-weight: 600;
        margin-bottom: 4px;
      }

      /* Connector placement via CSS */
      .ports.left,
      .ports.right {
        position: absolute;
        top: 10px;
        bottom: 10px;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .ports.left {
        left: -8px;
      }
      .ports.right {
        right: -8px;
      }
      .input,
      .output {
        position: relative;
        z-index: 1;
      }
    `,
  ],
})
export class WfNodeComponent extends DrawFlowBaseNode {
  private get safeModel(): NodeModelShape {
    const m = this.model;
    if (isNodeModelShape(m)) return m;
    return { type: 'action', label: 'Action', ports: { inputs: [], outputs: [] } };
  }

  type(): WorkflowNodeType {
    return this.safeModel.type;
  }

  label(): string {
    const l = (this.safeModel as { label?: unknown }).label;
    return typeof l === 'string' && l.trim().length ? l : this.safeModel.type;
  }

  inPorts(): WorkflowPorts['inputs'] {
    return this.safeModel.ports?.inputs ?? [];
  }
  outPorts(): WorkflowPorts['outputs'] {
    return this.safeModel.ports?.outputs ?? [];
  }
  trackPort(_: number, p: { id: string }): string {
    return p.id;
  }
}
```

## 🧱 Action form registry (inspector)

**`./action-forms.ts`**

```ts
// (same as your shared snippet; trimmed here for brevity)
export type ActionFormFactory = (f: FieldConfigService) => FieldConfig[];
export interface ActionFormSpec {
  make: ActionFormFactory;
  defaults?: Record<string, unknown>;
}
export const ACTION_FORMS: Record<string, ActionFormSpec> = {
  /* chat-basic, chat-on-file, compare, summarize, extract */
};
export function makeFallback(F: FieldConfigService): FieldConfig[] {
  /* ... */
}
```

Use your full version with all validators and defaults.

## 🖼️ Canvas template

**`./workflow-canvas-df.component.html`**

```html
<!-- Palette -->
@if (availableActions().length) {
<div
  class="pxs-wf-palette"
  cdkDropList
  [cdkDropListSortingDisabled]="true"
  [cdkDropListConnectedTo]="[canvasList]"
  [cdkDropListData]="availableActions()"
>
  <div class="pxs-wf-palette-title">Actions:</div>

  <div class="pxs-wf-palette-items" #paletteHost>
    @for (a of availableActions(); track a.type) {
    <button
      mat-flat-button
      class="pxs-wf-pill"
      cdkDrag
      [cdkDragData]="a"
      [disabled]="disabled()"
      cdkDragRootElement=".pxs-wf-pill"
      (cdkDragMoved)="onPaletteDragMoved($event)"
      (cdkDragStarted)="isPaletteDragging.set(true)"
      (cdkDragEnded)="isPaletteDragging.set(false)"
    >
      {{ a.type }}
      <ng-template cdkDragPreview>
        <div class="pxs-wf-pill preview">{{ a.type }}</div>
      </ng-template>
      <ng-template cdkDragPlaceholder>
        <div class="pxs-wf-pill placeholder"></div>
      </ng-template>
    </button>
    }
  </div>
</div>
}

<!-- Canvas drop target -->
<div
  class="pxs-wf-canvas-wrap"
  cdkDropList
  #canvasList="cdkDropList"
  [cdkDropListDisabled]="!isPaletteDragging()"
  [cdkDropListData]="{}"
  (cdkDropListDropped)="onDrop($event)"
>
  <ng-draw-flow
    #flowEl
    #flow
    class="pxs-wf-canvas"
    [ngModel]="dfModel()"
    (ngModelChange)="onModelChange($event)"
    (nodeSelected)="onNodeSelected($event)"
    (nodeMoved)="onNodeMoved($event)"
    (connectionCreated)="onConnectionCreated($event)"
    (connectionDeleted)="onConnectionDeleted($event)"
    (connectionSelected)="onConnectionSelected($event)"
    (scale)="onScale($event)"
  >
    <ng-template ngdfNode="input" [ngdfComponent]="nodeCmp"></ng-template>
    <ng-template ngdfNode="action" [ngdfComponent]="nodeCmp"></ng-template>
    <ng-template ngdfNode="result" [ngdfComponent]="nodeCmp"></ng-template>
  </ng-draw-flow>
</div>

<!-- Inspector dialog content (projected into your ConfirmDialogComponent) -->
<ng-template #actionInspectorTpl let-form="form" let-title="title">
  <h3 class="mb-2">{{ title }}</h3>
  <app-dynamic-form [form]="inspectorForm" [config]="inspectorConfig"></app-dynamic-form>
</ng-template>
```

## 🎨 Canvas styles

**`./workflow-canvas-df.component.scss`**

```scss
.pxs-wf-canvas-wrap {
  width: 100%;
  height: 640px;
  display: block;
}
.pxs-wf-canvas {
  width: 100%;
  height: 100%;
  display: block;
}
.pxs-wf-palette {
  padding-right: 12px;
}
.pxs-wf-pill {
  margin: 4px 0;
}
```

## 🧠 Canvas logic

**`./workflow-canvas.component.ts`**

```ts
import { CommonModule } from '@angular/common';
import {
  Component,
  ChangeDetectionStrategy,
  ViewChild,
  Input,
  Output,
  EventEmitter,
  computed,
  signal,
  ElementRef,
  TemplateRef,
} from '@angular/core';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup } from '@angular/forms';
import {
  NgDrawFlowComponent,
  DfDataModel,
  DfDataNode,
  DfDataConnection,
  DfConnectionPoint,
} from '@ng-draw-flow/core';
import { WfNodeComponent } from './action-node.component';
import { DRAW_FLOW_PROVIDER } from './workflow-config';
import {
  WorkflowEdge,
  WorkflowNode,
  WorkflowNodeType,
  WorkflowNodeDataBase,
  FieldConfig,
} from '@cadai/pxs-ng-core/interfaces';
import { FieldConfigService } from '@cadai/pxs-ng-core/services';
import { ActionDefinitionLite } from 'projects/core/interfaces/workflow.model';
import { CdkDragDrop, CdkDragMove, DragDropModule } from '@angular/cdk/drag-drop';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { DynamicFormComponent, ConfirmDialogComponent } from '@cadai/pxs-ng-core/shared';
import { ACTION_FORMS, makeFallback } from './action-forms';

@Component({
  selector: 'app-workflow-canvas-df',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    DragDropModule,
    MatButtonModule,
    NgDrawFlowComponent,
    WfNodeComponent,
    DynamicFormComponent,
  ],
  providers: [DRAW_FLOW_PROVIDER],
  templateUrl: './workflow-canvas-df.component.html',
  styleUrls: ['./workflow-canvas-df.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WorkflowCanvasDfComponent {
  @ViewChild('flow', { static: true }) flow!: NgDrawFlowComponent;
  @ViewChild('flowEl', { static: true, read: ElementRef })
  private flowElementRef!: ElementRef<HTMLElement>;
  @ViewChild('actionInspectorTpl', { static: true })
  private actionInspectorTpl!: TemplateRef<unknown>;
  nodeCmp = WfNodeComponent;

  @Input({ required: true }) set nodes(value: WorkflowNode[]) {
    this._nodes.set(value);
  }
  @Input({ required: true }) set edges(value: WorkflowEdge[]) {
    this._edges.set(value);
  }

  @Input() disabled = signal<boolean>(false);
  @Input() availableActions = signal<ActionDefinitionLite[]>([]);
  isPaletteDragging = signal<boolean>(false);

  @Output() change = new EventEmitter<{ nodes: WorkflowNode[]; edges: WorkflowEdge[] }>();

  private _nodes = signal<WorkflowNode[]>([]);
  private _edges = signal<WorkflowEdge[]>([]);
  private zoom = signal<number>(1);
  private lastClient = { x: 0, y: 0 };

  inspectorForm!: FormGroup;
  inspectorConfig: FieldConfig[] = [];

  constructor(
    private readonly dialog: MatDialog,
    private readonly fb: FormBuilder,
    private readonly fields: FieldConfigService,
  ) {}

  // ===== Palette → canvas drop =====
  onPaletteDragMoved(e: CdkDragMove<unknown>): void {
    this.lastClient = { x: e.pointerPosition.x, y: e.pointerPosition.y };
  }
  onScale(z: number): void {
    this.zoom.set(z);
  }

  onDrop(ev: CdkDragDrop<unknown, unknown, unknown>): void {
    if (this.disabled()) return;
    const action = ev.item?.data as ActionDefinitionLite | undefined;
    if (!action) return;

    const client =
      (ev as unknown as { dropPoint?: { x: number; y: number } }).dropPoint ?? this.lastClient;
    const rect = this.flowElementRef.nativeElement.getBoundingClientRect();
    const scale = this.zoom() || 1;

    const x = (client.x - rect.left) / scale;
    const y = (client.y - rect.top) / scale;

    const nodeType: WorkflowNodeType =
      action.type === 'input' || action.type === 'result' || action.type === 'action'
        ? action.type
        : 'action';

    this.addNodeAt(nodeType, { x, y }, action.type);
  }

  // ===== Map domain -> DrawFlow =====
  dfModel = computed<DfDataModel>(() => {
    const nodesArr: DfDataNode[] = this._nodes().map((n) => ({
      id: n.id,
      data: { type: n.type, ...n.data, ports: n.ports },
      position: { x: n.x, y: n.y },
      startNode: n.type === 'input',
      endNode: n.type === 'result',
    }));

    const conns: DfDataConnection[] = this._edges().map((e) => ({
      source: {
        nodeId: e.source,
        connectorType: DfConnectionPoint.Output,
        connectorId: e.sourcePort,
      },
      target: {
        nodeId: e.target,
        connectorType: DfConnectionPoint.Input,
        connectorId: e.targetPort,
      },
    }));

    return { nodes: nodesArr, connections: conns };
  });

  // ===== Write-back (CVA change) =====
  onModelChange = (m: DfDataModel): void => {
    const nextNodes: WorkflowNode[] = [];

    for (const node of m.nodes) {
      const prev = this._nodes().find((x) => x.id === node.id);
      const type = (node.data as { type: WorkflowNodeType }).type;
      const ports = (node.data as { ports?: WorkflowNode['ports'] }).ports ??
        prev?.ports ?? { inputs: [], outputs: [] };

      const { x, y } =
        'position' in node && node.position
          ? { x: node.position.x, y: node.position.y }
          : { x: prev?.x ?? 0, y: prev?.y ?? 0 };

      nextNodes.push({
        id: node.id,
        type,
        x,
        y,
        data: { ...(prev?.data ?? {}), ...(node.data as object) },
        ports,
      });
    }

    const nextEdges: WorkflowEdge[] = m.connections.map((c) => ({
      id: `e-${c.source.nodeId}__${c.source.connectorId}--${c.target.nodeId}__${c.target.connectorId}`,
      source: c.source.nodeId,
      target: c.target.nodeId,
      sourcePort: c.source.connectorId,
      targetPort: c.target.connectorId,
      label: '',
      style: { marker: 'solid', stroke: '#607d8b', strokeWidth: 2 },
    }));

    this._nodes.set(nextNodes);
    this._edges.set(nextEdges);
    this.change.emit({ nodes: nextNodes, edges: nextEdges });
  };

  // ===== Node creation =====
  addNodeAt(type: WorkflowNodeType, client: { x: number; y: number }, label?: string): void {
    const id = crypto?.randomUUID?.() ?? 'node-' + Math.random().toString(36).slice(2, 9);
    const node: WorkflowNode = {
      id,
      type,
      x: client.x,
      y: client.y,
      data: { label: label ?? type.charAt(0).toUpperCase() + type.slice(1) },
      ports: {
        inputs: type === 'input' ? [] : [{ id: 'in', label: 'in', type: 'json' }],
        outputs: type === 'result' ? [] : [{ id: 'out', label: 'out', type: 'json' }],
      },
    };
    this._nodes.set([...this._nodes(), node]);
  }

  // ===== Selection → open inspector dialog =====
  onNodeSelected(e: unknown): void {
    const nodeId = (e as { id?: string; nodeId?: string }).id ?? (e as { nodeId?: string }).nodeId;
    if (!nodeId) return;
    this.openInspectorFor(nodeId);
  }

  private openInspectorFor(nodeId: string): void {
    const n = this._nodes().find((x) => x.id === nodeId);
    if (!n) return;

    const aiType = (n.data as WorkflowNodeDataBase & { aiType?: string }).aiType ?? 'action';
    const spec = ACTION_FORMS[aiType];

    this.inspectorConfig = spec ? spec.make(this.fields) : makeFallback(this.fields);
    this.inspectorForm = this.fb.group({});

    queueMicrotask(() => {
      const defaults = spec?.defaults ?? {};
      const current = (n.data as { params?: Record<string, unknown> }).params ?? {};
      const toPatch: Record<string, unknown> = { ...defaults, ...current };
      if (Object.keys(toPatch).length) {
        this.inspectorForm.patchValue(toPatch, { emitEvent: false });
      }
    });

    const title = (n.data as { label?: string }).label ?? 'Configure';

    const ref = this.dialog.open<
      ConfirmDialogComponent,
      {
        title: string;
        contentTpl: TemplateRef<unknown>;
        context?: { form: FormGroup; title: string };
        getResult: () => Record<string, unknown> | null;
      },
      Record<string, unknown> | null
    >(ConfirmDialogComponent, {
      width: '560px',
      maxWidth: '95vw',
      panelClass: 'inspector-dialog-panel',
      backdropClass: 'app-overlay-backdrop',
      data: {
        title,
        contentTpl: this.actionInspectorTpl,
        context: { form: this.inspectorForm, title },
        getResult: () => (this.inspectorForm.valid ? this.inspectorForm.getRawValue() : null),
      },
    });

    ref.afterClosed().subscribe((result) => {
      if (!result) return;
      const updatedNodes = this._nodes().map((node) =>
        node.id === n.id ? { ...node, data: { ...node.data, params: result } } : node,
      );
      this._nodes.set(updatedNodes);
      this.change.emit({ nodes: updatedNodes, edges: this._edges() });
    });
  }

  // hooks (optional)
  onNodeMoved(_e: unknown): void {}
  onConnectionCreated(_e: unknown): void {}
  onConnectionDeleted(_e: unknown): void {}
  onConnectionSelected(_e: unknown): void {}
}
```

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
  nodes = [
    {
      id: 'input-node',
      type: 'input',
      x: 60,
      y: 60,
      data: { label: 'Input' },
      ports: { inputs: [], outputs: [{ id: 'out', label: 'out', type: 'json' }] },
    },
  ];
  edges = [];
  availableActions = [{ type: 'action' }, { type: 'chat-basic' }, { type: 'summarize' }];

  onChange(e: { nodes: unknown; edges: unknown }) {
    console.log('changed', e);
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
