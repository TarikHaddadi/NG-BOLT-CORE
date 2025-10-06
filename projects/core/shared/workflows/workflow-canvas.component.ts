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
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import {
  DfConnectionPoint,
  DfDataConnection,
  DfDataModel,
  DfDataNode,
  NgDrawFlowComponent,
  provideNgDrawFlowConfigs,
} from '@ng-draw-flow/core';

import {
  ActionDefinitionLite,
  FieldConfig,
  InspectorActionType,
  PaletteType,
  WorkflowEdge,
  WorkflowNode,
  WorkflowNodeDataBase,
  WorkflowNodeType,
} from '@cadai/pxs-ng-core/interfaces';
import { FieldConfigService } from '@cadai/pxs-ng-core/services';

import { ConfirmDialogComponent } from '../dialog/dialog.component';
import { DynamicFormComponent } from '../forms/dynamic-form.component';
import { ACTION_FORMS, makeFallback } from './action-forms';
import { WfNodeComponent } from './action-node.component';
import { DRAW_FLOW_PROVIDER } from './workflow-config';

@Component({
  selector: 'app-workflow-canvas-df',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    DragDropModule,
    MatButtonModule,
    MatDialogModule,
    NgDrawFlowComponent,
    DynamicFormComponent,
  ],
  providers: [
    DRAW_FLOW_PROVIDER,
    provideNgDrawFlowConfigs({
      nodes: {
        input: WfNodeComponent,
        action: WfNodeComponent,
        result: WfNodeComponent,
      },
    }),
  ],
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

  // Inputs from parent: accept plain values, keep internal signals
  @Input({ required: true }) set nodes(value: WorkflowNode[]) {
    this._nodes.set(value);
  }
  @Input({ required: true }) set edges(value: WorkflowEdge[]) {
    this._edges.set(value);
  }
  @Input() set disabled(value: boolean) {
    this.disabledSig.set(!!value);
  }
  @Input() set availableActions(value: ActionDefinitionLite[]) {
    this.availableActionsSig.set(value ?? []);
  }

  @Output() change = new EventEmitter<{ nodes: WorkflowNode[]; edges: WorkflowEdge[] }>();

  // Internal state (signals)
  disabledSig = signal<boolean>(false);
  availableActionsSig = signal<ActionDefinitionLite[]>([]);
  isPaletteDragging = signal<boolean>(false);

  private _nodes = signal<WorkflowNode[]>([]);
  private _edges = signal<WorkflowEdge[]>([]);
  private zoom = signal<number>(1);
  private lastClient = { x: 0, y: 0 };

  // Inspector
  inspectorForm!: FormGroup;
  inspectorConfig: FieldConfig[] = [];

  constructor(
    private readonly dialog: MatDialog,
    private readonly fb: FormBuilder,
    private readonly fields: FieldConfigService,
  ) {}

  private pan = signal<{ x: number; y: number }>({ x: 0, y: 0 });
  onPan(ev: unknown): void {
    const p = ev as Partial<{ x: number; y: number }>;
    if (typeof p?.x === 'number' && typeof p?.y === 'number') {
      this.pan.set({ x: p.x, y: p.y });
    }
    // else: ignore unexpected payloads gracefully
  }

  private humanLabelFor(t: PaletteType): string {
    if (t === 'input' || t === 'result') return t.charAt(0).toUpperCase() + t.slice(1);
    const pretty: Record<InspectorActionType, string> = {
      'chat-basic': 'Chat',
      'chat-on-file': 'Chat on File',
      compare: 'Compare',
      summarize: 'Summarize',
      extract: 'Extract',
    };
    return pretty[t] ?? 'Action';
  }

  // ===== Palette → canvas drop =====
  onPaletteDragMoved(e: CdkDragMove<unknown>): void {
    this.lastClient = { x: e.pointerPosition.x, y: e.pointerPosition.y };
  }

  onScale(z: number): void {
    this.zoom.set(z);
  }

  onDrop(ev: CdkDragDrop<{}, unknown, unknown>): void {
    if (this.disabledSig()) return;
    const action = ev.item?.data as ActionDefinitionLite | undefined;
    if (!action) return;

    const client =
      (ev as unknown as { dropPoint?: { x: number; y: number } }).dropPoint ?? this.lastClient;
    const rect = this.flowElementRef.nativeElement.getBoundingClientRect();
    const scale = this.zoom() || 1;
    const pan = this.pan();

    // client → canvas space (account for pan & scale)
    const x = (client.x - rect.left - pan.x) / scale;
    const y = (client.y - rect.top - pan.y) / scale;

    const t: PaletteType = action.type;
    const visualType: WorkflowNodeType = t === 'input' || t === 'result' ? t : 'action';

    const id = crypto?.randomUUID?.() ?? 'node-' + Math.random().toString(36).slice(2, 9);
    const node: WorkflowNode = {
      id,
      type: visualType,
      x,
      y,
      data: {
        label: this.humanLabelFor(t),
        ...(visualType === 'action' ? { aiType: t as InspectorActionType } : {}),
        params: action.params ?? {},
      },
      ports: {
        inputs: visualType === 'input' ? [] : [{ id: 'in', label: 'in', type: 'json' }],
        outputs: visualType === 'result' ? [] : [{ id: 'out', label: 'out', type: 'json' }],
      },
    };

    this._nodes.set([...this._nodes(), node]);
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

    return { nodes: nodesArr, connections: conns } satisfies DfDataModel;
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

  // ===== Public helpers =====
  private addNodeAt(t: PaletteType, client: { x: number; y: number }): void {
    const visualType: WorkflowNodeType = t === 'input' || t === 'result' ? t : 'action';
    const id = crypto?.randomUUID?.() ?? 'node-' + Math.random().toString(36).slice(2, 9);
    const node: WorkflowNode = {
      id,
      type: visualType,
      x: client.x,
      y: client.y,
      data: {
        label: this.humanLabelFor(t),
        ...(visualType === 'action' ? { aiType: t as InspectorActionType } : {}),
      },
      ports: {
        inputs: visualType === 'input' ? [] : [{ id: 'in', label: 'in', type: 'json' }],
        outputs: visualType === 'result' ? [] : [{ id: 'out', label: 'out', type: 'json' }],
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

  // Optional hooks
  onNodeMoved(_evt: unknown): void {}
  onConnectionCreated(_evt: unknown): void {}
  onConnectionDeleted(_evt: unknown): void {}
  onConnectionSelected(_evt: unknown): void {}
}
