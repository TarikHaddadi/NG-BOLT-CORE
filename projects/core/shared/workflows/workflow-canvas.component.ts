import { CdkDragDrop, CdkDragMove, DragDropModule } from '@angular/cdk/drag-drop';
import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  EventEmitter,
  Input,
  Output,
  signal,
  TemplateRef,
  ViewChild,
} from '@angular/core';
import { FormBuilder, FormGroup, FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import {
  DfConnectionPoint,
  DfDataConnection,
  DfDataModel,
  DfDataNode,
  NgDrawFlowComponent,
} from '@ng-draw-flow/core';

import {
  ActionDefinitionLite,
  FieldConfig,
  WorkflowEdge,
  WorkflowNode,
  WorkflowNodeDataBase,
  WorkflowNodeType,
} from '@cadai/pxs-ng-core/interfaces';
import { FieldConfigService } from '@cadai/pxs-ng-core/services';

import { ConfirmDialogComponent, DynamicFormComponent } from '../public-api';
import { ACTION_FORMS, makeFallback } from './action-forms.component';
import { WfNodeComponent } from './action-node.component';
import { DRAW_FLOW_PROVIDER } from './workflow-config';
@Component({
  selector: 'app-workflow-canvas-df',
  standalone: true,
  imports: [
    CommonModule,
    DynamicFormComponent,
    DragDropModule,
    MatButtonModule,
    NgDrawFlowComponent,
    MatDialogModule,
    FormsModule,
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
  nodeCmp = WfNodeComponent;
  @ViewChild('actionInspectorTpl', { static: true })
  private actionInspectorTpl!: TemplateRef<unknown>;

  @Input({ required: true }) set nodes(value: WorkflowNode[]) {
    this._nodes.set(value);
  }
  @Input({ required: true }) set edges(value: WorkflowEdge[]) {
    this._edges.set(value);
  }

  // palette inputs/state
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
  // capture pointer while dragging (for browsers that don’t include dropPoint)
  onPaletteDragMoved(e: CdkDragMove<unknown>): void {
    this.lastClient = { x: e.pointerPosition.x, y: e.pointerPosition.y };
  }

  onScale(z: number): void {
    this.zoom.set(z);
  }

  onDrop(ev: CdkDragDrop<{}, any, any>): void {
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

  // ===== Map to DrawFlow model (top-left positions) =====
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
        connectorType: DfConnectionPoint.Output, // ✅ enum, not string
        connectorId: e.sourcePort,
      },
      target: {
        nodeId: e.target,
        connectorType: DfConnectionPoint.Input, // ✅ enum, not string
        connectorId: e.targetPort,
      },
    }));

    return { nodes: nodesArr, connections: conns } satisfies DfDataModel;
  });

  // Write-back when DrawFlow changes (CVA change)
  onModelChange = (m: DfDataModel): void => {
    const nextNodes: WorkflowNode[] = [];

    for (const node of m.nodes) {
      const prev = this._nodes().find((x) => x.id === node.id);

      // node.data always exists, but we only read .position if it’s a DfDataNode
      const type = (node.data as { type: WorkflowNodeType }).type;
      const ports = (node.data as { ports?: WorkflowNode['ports'] }).ports ??
        prev?.ports ?? { inputs: [], outputs: [] };

      const { x, y } =
        'position' in node && node.position
          ? { x: node.position.x, y: node.position.y }
          : { x: prev?.x ?? 0, y: prev?.y ?? 0 }; // fallback for DfDataInitialNode

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

  // ===== Public helpers =====

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
    // NgModel (dfModel) recomputes and updates <ng-draw-flow> automatically
  }

  // Optional: selection / scale / connection hooks (already available as outputs)
  onNodeSelected(e: unknown): void {
    // Adjust key if your event payload differs (some builds use { id }, others { nodeId })
    const nodeId = (e as { id?: string; nodeId?: string }).id ?? (e as { nodeId?: string }).nodeId;
    if (!nodeId) return;
    this.openInspectorFor(nodeId);
  }

  private openInspectorFor(nodeId: string): void {
    const n = this._nodes().find((x) => x.id === nodeId);
    if (!n) return;

    // Read aiType from your node data
    const aiType = (n.data as WorkflowNodeDataBase & { aiType?: string }).aiType ?? 'action';
    const spec = ACTION_FORMS[aiType];

    this.inspectorConfig = spec ? spec.make(this.fields) : makeFallback(this.fields);

    // Create the form; DynamicFormComponent will register controls on init
    this.inspectorForm = this.fb.group({});

    // Patch defaults + current values on the next microtask so controls exist
    queueMicrotask(() => {
      const defaults = spec?.defaults ?? {};
      const current = (n.data as { params?: Record<string, unknown> }).params ?? {};
      const toPatch: Record<string, unknown> = { ...defaults, ...current };
      if (Object.keys(toPatch).length) {
        this.inspectorForm.patchValue(toPatch, { emitEvent: false });
      }
    });

    const title = (n.data as { label?: string }).label ?? 'Configure';

    // Open your existing ConfirmDialogComponent using the template + getResult
    const ref = this.dialog.open<
      ConfirmDialogComponent,
      {
        title: string;
        contentTpl: TemplateRef<unknown>;
        // If your ConfirmDialog expects context, include it:
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
        context: { form: this.inspectorForm, title }, // include if your dialog projects it
        getResult: () => (this.inspectorForm.valid ? this.inspectorForm.getRawValue() : null),
      },
    });

    ref.afterClosed().subscribe((result) => {
      if (!result) return;

      // Persist params back into the node’s data
      const updatedNodes = this._nodes().map((node) =>
        node.id === n.id ? { ...node, data: { ...node.data, params: result } } : node,
      );

      this._nodes.set(updatedNodes);
      this.change.emit({ nodes: updatedNodes, edges: this._edges() });
    });
  }

  onNodeMoved(_evt: unknown): void {
    /* already reflected in ngModel */
  }
  onConnectionCreated(_evt: unknown): void {
    /* optional validation */
  }
  onConnectionDeleted(_evt: unknown): void {
    /* … */
  }
  onConnectionSelected(_evt: unknown): void {
    /* context menu */
  }
}
