import { CdkDragDrop, CdkDragMove, DragDropModule } from '@angular/cdk/drag-drop';
import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  EventEmitter,
  HostListener,
  inject,
  Input,
  Output,
  signal,
  TemplateRef,
  ViewChild,
} from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import {
  DfArrowhead,
  DfConnectionPoint,
  DfConnectionType,
  DfDataConnection,
  DfDataModel,
  DfDataNode,
  dfPanZoomOptionsProvider,
  NgDrawFlowComponent,
  provideNgDrawFlowConfigs,
} from '@ng-draw-flow/core';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import {
  ActionDefinitionLite,
  FieldConfig,
  InspectorActionType,
  PaletteType,
  WorkflowEdge,
  WorkflowNode,
  WorkflowNodeDataBase,
} from '@cadai/pxs-ng-core/interfaces';
import { FieldConfigService } from '@cadai/pxs-ng-core/services';

import { ConfirmDialogComponent } from '../dialog/dialog.component';
import { DynamicFormComponent } from '../forms/dynamic-form.component';
import { ACTION_FORMS, makeFallback } from './action-forms';
import { WfNodeComponent } from './action-node.component';
import { WfCanvasBus } from './wf-canvas-bus';

function defaultPortsFor(type: string): WorkflowNode['ports'] {
  if (type === 'input') return { inputs: [], outputs: [{ id: 'out', label: 'out', type: 'json' }] };
  if (type === 'result') return { inputs: [{ id: 'in', label: 'in', type: 'json' }], outputs: [] };
  // generic action-like node
  return {
    inputs: [{ id: 'in', label: 'in', type: 'json' }],
    outputs: [{ id: 'out', label: 'out', type: 'json' }],
  };
}
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
    TranslateModule,
    MatTooltipModule,
  ],
  providers: [
    WfCanvasBus,
    dfPanZoomOptionsProvider({
      leftPosition: 0,
    }),
    provideNgDrawFlowConfigs({
      nodes: {
        input: WfNodeComponent,
        result: WfNodeComponent,
        'chat-basic': WfNodeComponent,
        'chat-on-file': WfNodeComponent,
        compare: WfNodeComponent,
        summarize: WfNodeComponent,
        extract: WfNodeComponent,
        jira: WfNodeComponent,
      },
      connection: {
        type: DfConnectionType.SmoothStep,
        arrowhead: { type: DfArrowhead.ArrowClosed, height: 5, width: 5 },
        curvature: 10,
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
  private suppressExternal = false;
  translate = inject(TranslateService);
  // Inputs from parent: accept plain values, keep internal signals
  @Input({ required: true })
  set nodes(value: WorkflowNode[]) {
    if (this.suppressExternal) return; // ignore the echo we just emitted

    const byId = new Map(this._nodes().map((n) => [n.id, n]));
    const merged = value.map((v) => {
      const cur = byId.get(v.id);
      return cur
        ? // keep our positions; merge parent’s other fields
          { ...v, x: cur.x, y: cur.y }
        : v;
    });
    this._nodes.set(merged);
  }

  @Input({ required: true })
  set edges(value: WorkflowEdge[]) {
    if (this.suppressExternal) return;
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

  selectedNodeId = signal<string | null>(null);
  contextMenu = signal<{ id: string; x: number; y: number } | null>(null);

  // Close menu on ESC
  @HostListener('document:keydown.escape')
  onEsc(): void {
    this.closeContextMenu();
    this.setSelectedNode(null);
  }

  // state
  private pan = signal<{ x: number; y: number }>({ x: 0, y: 0 });

  // hook wired in the template: (pan)="onPan($any($event))"
  onPan(ev: unknown): void {
    const p = ev as Partial<{ x: number; y: number }>;
    if (typeof p?.x === 'number' && typeof p?.y === 'number') {
      this.pan.set({ x: p.x, y: p.y }); // absolute pan from the library
    }
  }

  // ===== Map domain -> DrawFlow =====
  dfModel = computed<DfDataModel>(() => {
    const nodesArr: DfDataNode[] = this._nodes().map((n) => {
      const ports = n.ports ?? defaultPortsFor(n.type);

      return {
        id: n.id,
        data: { type: n.type, ...n.data, ports },
        position: { x: n.x, y: n.y },
        startNode: n.type === 'input',
        endNode: n.type === 'result',
      };
    });

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

  constructor(
    private bus: WfCanvasBus,
    private readonly dialog: MatDialog,
    private readonly fb: FormBuilder,
    private readonly fields: FieldConfigService,
  ) {
    // Listen for node menu clicks
    this.bus.openMenu$.subscribe(({ nodeId, clientX, clientY }) => {
      const wrap = this.flowElementRef.nativeElement;
      const rect = wrap.getBoundingClientRect();
      this.contextMenu.set({
        id: nodeId,
        x: clientX - rect.left,
        y: clientY - rect.top,
      });
      this.setSelectedNode(nodeId);
    });
  }

  private humanLabelFor(t: PaletteType): string {
    if (t === 'input' || t === 'result') return t.charAt(0).toUpperCase() + t.slice(1);
    const pretty: Record<InspectorActionType, string> = {
      'chat-basic': 'chat',
      'chat-on-file': 'chat-on-file',
      compare: 'compare',
      summarize: 'summarize',
      extract: 'extract',
      jira: 'jira',
    };
    return pretty[t].toLocaleLowerCase();
  }

  // ===== Palette → canvas drop =====
  onPaletteDragMoved(e: CdkDragMove<unknown>): void {
    this.lastClient = { x: e.pointerPosition.x, y: e.pointerPosition.y };
  }

  onScale(z: number): void {
    this.zoom.set(z);
  }
  private clientToWorld(client: { x: number; y: number }) {
    // Pick the element that actually has the transform. Often the inner viewport within <ng-draw-flow>.
    const root = this.flowElementRef.nativeElement as HTMLElement;
    const viewport = root;

    //const rect = viewport.getBoundingClientRect();
    const style = getComputedStyle(viewport);

    // CSS transform + origin
    const t = style.transform === 'none' ? undefined : style.transform;
    const [ox, oy] = style.transformOrigin.split(' ').map((v) => parseFloat(v)) as [number, number];

    // Build matrices. We must account for transform-origin: translate(origin) * M * translate(-origin)
    const M = new DOMMatrixReadOnly(t);
    const pre = new DOMMatrixReadOnly().translate(ox, oy);
    const post = new DOMMatrixReadOnly().translate(-ox, -oy);

    // Inverse total transform
    const inv = post.multiply(M).multiply(pre).inverse();

    // Point in viewport local coords (before transform)
    const local = new DOMPoint(client.x, client.y);

    // Map through inverse -> world coords
    const world = local.matrixTransform(inv);
    return { x: world.x, y: world.y };
  }

  onDrop(ev: CdkDragDrop<{}, unknown, unknown>): void {
    if (this.disabledSig()) return;

    const action = ev.item?.data as ActionDefinitionLite | undefined;
    if (!action) return;

    const client = (ev as any).dropPoint ?? this.lastClient; // {x,y} in viewport coords
    const { x, y } = this.clientToWorld(client); // ← robust world coords

    const id = crypto?.randomUUID?.() ?? 'node-' + Math.random().toString(36).slice(2, 9);
    const node: WorkflowNode = {
      id,
      type: action.type,
      x,
      y,
      data: {
        label: this.humanLabelFor(action.type),
        aiType: action.type,
        params: action.params ?? {},
      },
      ports: {
        inputs: [{ id: 'in', label: 'in', type: 'json' }],
        outputs: [{ id: 'out', label: 'out', type: 'json' }],
      },
    };

    this._nodes.set([...this._nodes(), node]);
  }

  // ===== Write-back (CVA change) =====
  onModelChange = (m: DfDataModel): void => {
    const nextNodes: WorkflowNode[] = [];
    for (const node of m.nodes) {
      const prev = this._nodes().find((x) => x.id === node.id);
      const type = (node.data as { type: PaletteType }).type;
      const ports = (node.data as { ports?: WorkflowNode['ports'] }).ports ??
        prev?.ports ?? { inputs: [], outputs: [] };

      let { x, y } =
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

    // prevent parent echo from immediately stomping our positions
    this.suppressExternal = true;
    this.change.emit({ nodes: nextNodes, edges: nextEdges });
    queueMicrotask(() => (this.suppressExternal = false));

    const current = this.selectedNodeId();
    if (current) this.setSelectedNode(current);
  };

  // ===== Selection → open inspector dialog =====
  onNodeSelected(e: unknown): void {
    const nodeId =
      (e as { id?: string; nodeId?: string }).id ?? (e as { nodeId?: string }).nodeId ?? null;
    this.setSelectedNode(nodeId);
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

    const title = this.translate.instant((n.data as { label?: string }).label ?? 'configure');

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

  onCanvasContextMenu(ev: MouseEvent): void {
    ev.preventDefault();
    const host = this.flowElementRef.nativeElement.closest('.pxs-wf-canvas-wrap') as HTMLElement;
    const rect = host.getBoundingClientRect();

    // find the node element clicked
    const el = (ev.target as HTMLElement)?.closest('[data-node-id]');
    if (!el) {
      this.closeContextMenu();
      this.setSelectedNode(null);
      return;
    }
    const id = el.getAttribute('data-node-id');
    if (!id) {
      this.closeContextMenu();
      this.setSelectedNode(null);
      return;
    }

    // position relative to wrapper
    const x = ev.clientX - rect.left;
    const y = ev.clientY - rect.top;

    this.contextMenu.set({ id, x, y });
    this.setSelectedNode(id);
  }

  // Click-out closes menu
  closeContextMenu(): void {
    this.contextMenu.set(null);
  }

  // Selection: add outline via CSS class on the node element
  setSelectedNode(id: string | null): void {
    const host = this.flowElementRef?.nativeElement;
    if (!host) {
      this.selectedNodeId.set(id);
      return;
    }

    // remove previous
    const prev = this.selectedNodeId();
    if (prev) {
      const prevEl = host.querySelector(`[data-node-id="${prev}"]`) as HTMLElement | null;
      prevEl?.classList.remove('is-selected');
    }

    // set new
    this.selectedNodeId.set(id);
    if (id) {
      const el = host.querySelector(`[data-node-id="${id}"]`) as HTMLElement | null;
      el?.classList.add('is-selected');
    }
  }

  // Menu actions
  onConfigureNode(id: string): void {
    if (this.isTerminal(id)) return;
    this.closeContextMenu();
    this.openInspectorFor(id);
  }

  onDeleteNode(id: string): void {
    if (this.isTerminal(id)) return;
    this.closeContextMenu();
    // remove node and its edges
    const nodes = this._nodes().filter((n) => n.id !== id);
    const edges = this._edges().filter((e) => e.source !== id && e.target !== id);
    this._nodes.set(nodes);
    this._edges.set(edges);
    // clear selection if deleted
    if (this.selectedNodeId() === id) this.setSelectedNode(null);
    this.change.emit({ nodes, edges });
  }

  isTerminal(id: string | null): boolean {
    if (!id) return false;
    const n = this._nodes().find((x) => x.id === id);
    return !!n && (n.type === 'input' || n.type === 'result');
  }
}
