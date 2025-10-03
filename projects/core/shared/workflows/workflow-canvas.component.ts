import { CdkDragDrop, DragDropModule } from '@angular/cdk/drag-drop';
import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  OnDestroy,
  OnInit,
  Output,
  signal,
  ViewChild,
} from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { TranslateModule } from '@ngx-translate/core';
import { Edge as GEdge, NgxGraphModule, Node as GNode } from '@swimlane/ngx-graph';
import * as d3 from 'd3-shape';
import { Subject } from 'rxjs';

import {
  ACTION_LABEL,
  ActionDefinition,
  ActionNodeData,
  AiActionType,
  ChatBasicNodeData,
  ChatOnFileNodeData,
  CompareNodeData,
  ConfirmDialogData,
  ContextMenuTarget,
  ExtractNodeData,
  FieldConfig,
  SummarizeNodeData,
  WorkflowEdge,
  WorkflowNode,
  WorkflowNodeData,
} from '@cadai/pxs-ng-core/interfaces';
import { FieldConfigService } from '@cadai/pxs-ng-core/services';

import { ConfirmDialogComponent, DynamicFormComponent } from '../public-api';
import { ACTION_FORMS, makeFallback } from './action-forms.component';
import { FrozenLayout, XY } from './frozen-layout.component';

type DropEv = CdkDragDrop<any, any, any>;

@Component({
  selector: 'app-workflow-canvas',
  standalone: true,
  imports: [
    CommonModule,
    DragDropModule,
    NgxGraphModule,
    DynamicFormComponent,
    ReactiveFormsModule,
    MatButtonModule,
    TranslateModule,
  ],
  templateUrl: './workflow-canvas.component.html',
  styleUrls: ['./workflow-canvas.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WorkflowCanvasComponent implements OnInit, AfterViewInit, OnDestroy {
  // Inputs / Outputs
  @Input({ required: true }) nodes: WorkflowNode[] = [];
  @Input({ required: true }) edges: WorkflowEdge[] = [];
  @Input() disabled = signal<boolean>(false);
  @Input() availableActions = signal<ActionDefinition[]>([]);
  @Output() change = new EventEmitter<{ nodes: WorkflowNode[]; edges: WorkflowEdge[] }>();
  @Output() validityChange = new EventEmitter<boolean>();

  @ViewChild('graphHost', { static: true }) graphHost!: ElementRef<HTMLElement>;
  @ViewChild('paletteHost', { static: true }) paletteHost!: ElementRef<HTMLElement>;
  @ViewChild('inspectorTpl', { static: true }) inspectorTpl!: any;
  @ViewChild('inspectorActionsTpl', { static: true }) inspectorActionsTpl!: any;

  private inspectorDialogRef: MatDialogRef<
    ConfirmDialogComponent<{ form: FormGroup; title: string }>,
    Record<string, unknown> | false
  > | null = null;

  // Canvas viewport
  canvasW = signal(900);
  canvasH = signal(640);

  // Graph store for ngx-graph
  private _nodes = signal<GNode[]>([]);
  private _links = signal<GEdge[]>([]);
  gNodes = computed(() => this._nodes());
  gLinks = computed(() => this._links());
  update$ = new Subject<boolean>();

  private ro?: ResizeObserver;
  ready = signal(false);

  // Manual positions (top-left corner of each node)
  private nodePos = new Map<string, XY>();
  frozenLayout = new FrozenLayout(
    (id) => this.nodePos.get(id),
    (_graph, edgeId) => this.edgePointsFromPorts(edgeId),
  );

  // Port-aware connection (click-to-connect + drag preview)
  pending = signal<{ nodeId: string; portId: string } | null>(null);
  mouse = signal<{ x: number; y: number } | null>(null);
  selectedEdgeId = signal<string | null>(null);

  // Context menu
  contextMenu = signal<ContextMenuTarget | null>(null);

  // Inspector
  selectedNode = signal<WorkflowNode | null>(null);
  inspectorForm!: FormGroup;
  inspectorConfig: FieldConfig[] = [];

  // rAF coalescing
  private rafId: number | null = null;

  curve = d3.curveLinear;

  constructor(
    private fb: FormBuilder,
    private fields: FieldConfigService,
    private dialog: MatDialog,
  ) {}

  // ---------- Lifecycle ----------

  ngOnInit() {
    if (!this.nodes?.length) {
      const input: WorkflowNode = {
        id: 'input-node',
        type: 'input',
        x: 60,
        y: 60,
        data: { label: 'Input' },
        ports: { inputs: [], outputs: [{ id: 'out', label: 'out', type: 'json' }] },
      };
      const result: WorkflowNode = {
        id: 'result-node',
        type: 'result',
        x: 360,
        y: 60,
        data: { label: 'Result' },
        ports: { inputs: [{ id: 'in', label: 'in', type: 'json' }], outputs: [] },
      };
      this.nodes = [input, result];
    }
    // seed positions from model if present
    for (const n of this.nodes) this.nodePos.set(n.id, { x: n.x ?? 0, y: n.y ?? 0 });
  }

  ngAfterViewInit() {
    const el = this.graphHost?.nativeElement;
    if (el && 'ResizeObserver' in window) {
      let lastW = 0,
        lastH = 0;
      const FIXED_H = 640;

      const resize = () => {
        const w = el.clientWidth || el.parentElement?.clientWidth || 900;
        const h = FIXED_H;
        if (w === lastW && h === lastH) return;
        lastW = w;
        lastH = h;
        this.canvasW.set(w);
        this.canvasH.set(h);
        this.nudgeGraph();
      };

      this.ro = new ResizeObserver(resize);
      this.ro.observe(el);
      resize();
    }

    setTimeout(() => {
      this.ready.set(true);
      this.recomputeGraph();
      this.emitChange();
      this.nudgeGraph();
    });
  }

  ngOnDestroy() {
    this.ro?.disconnect();
  }

  // ---------- DnD (palette -> canvas, copy semantics) ----------

  allowPaletteDrop = () => !this.disabled();

  onDrop(ev: CdkDragDrop<{}, any, any>) {
    if (this.disabled()) return;
    const action = ev.item?.data as ActionDefinition | undefined;
    if (!action) return;

    const type = action.type as AiActionType;
    const spec = ACTION_FORMS[type];
    const defaults = spec?.defaults ?? {};

    const hostEl = this.graphHost.nativeElement;
    const rect = hostEl.getBoundingClientRect();
    const client = this.getDropClientPoint(ev);
    const x = client.x - rect.left;
    const y = client.y - rect.top;

    const nodeId = this.uid();
    const node: WorkflowNode = {
      id: nodeId,
      type: 'action',
      x,
      y,
      data: {
        label: ACTION_LABEL[type] ?? this.titleize(type),
        params: { ...(action.params ?? {}), ...defaults },
        aiType: type,
      } as ActionNodeData,
      ports: {
        inputs: [{ id: 'in', label: 'in', type: 'json' }],
        outputs: [{ id: 'out', label: 'out', type: 'json' }],
      },
    };

    this.nodePos.set(nodeId, { x, y });
    this.nodes = [...this.nodes, node];
    this.recomputeGraph();
    this.emitChange();

    // return pill to palette
    const itemEl = ev.item?.element?.nativeElement as HTMLElement | undefined;
    const paletteEl = this.paletteHost?.nativeElement as HTMLElement | undefined;
    if (itemEl && paletteEl && !paletteEl.contains(itemEl)) paletteEl.appendChild(itemEl);
    if (ev.item?.reset) ev.item.reset();
  }

  isMouseLike(e: unknown): e is MouseEvent | PointerEvent {
    return !!e && typeof (e as { clientX?: unknown }).clientX === 'number';
  }

  isTouch(e: unknown): e is TouchEvent {
    return !!e && 'changedTouches' in (e as TouchEvent);
  }

  private getDropClientPoint(ev: DropEv): { x: number; y: number } {
    const anyEv = ev as unknown as { dropPoint?: { x: number; y: number }; event?: unknown };
    if (anyEv.dropPoint) return anyEv.dropPoint;
    const native = anyEv.event as any;
    if (native && typeof native.clientX === 'number')
      return { x: native.clientX, y: native.clientY };
    if (native?.changedTouches?.length) {
      const t = native.changedTouches[0];
      return { x: t.clientX, y: t.clientY };
    }
    return { x: 0, y: 0 };
  }

  // ---------- Node/Edge handlers ----------

  onCanvasMouseMove(evt: MouseEvent) {
    const svg = (evt.currentTarget as HTMLElement).querySelector('svg');
    if (!svg) return;
    if ('createSVGPoint' in svg) {
      const pt = (svg as any).createSVGPoint();
      pt.x = evt.clientX;
      pt.y = evt.clientY;
      const ctm = (svg as any).getScreenCTM?.();
      const p = ctm ? pt.matrixTransform(ctm.inverse()) : { x: evt.offsetX, y: evt.offsetY };
      this.mouse.set({ x: p.x, y: p.y });
    } else {
      this.mouse.set({ x: evt.offsetX, y: evt.offsetY });
    }
  }

  @HostListener('document:keydown.escape')
  cancelPending() {
    this.pending.set(null);
    this.mouse.set(null);
  }

  clickPort(nodeId: string, kind: 'source' | 'target', portId: string, e: MouseEvent) {
    e.stopPropagation();
    if (this.disabled()) return;

    if (kind === 'source') {
      this.pending.set({ nodeId, portId });
      return;
    }

    // kind === 'target'
    const from = this.pending();
    if (from && (from.nodeId !== nodeId || from.portId !== portId)) {
      if (!this.arePortsCompatible(from.nodeId, from.portId, nodeId, portId)) {
        this.pending.set(null);
        this.mouse.set(null);
        return;
      }
      const id = this.makeEdgeId(from.nodeId, from.portId, nodeId, portId);
      const exists = this.edges.some(
        (ee) =>
          ee.source === from.nodeId &&
          ee.target === nodeId &&
          ee.sourcePort === from.portId &&
          ee.targetPort === portId,
      );
      if (!exists) {
        this.edges = [
          ...this.edges,
          {
            id,
            source: from.nodeId,
            target: nodeId,
            label: '',
            sourcePort: from.portId,
            targetPort: portId,
            style: { marker: 'solid' },
          },
        ];
        this.recomputeGraph(); // nodes won't move; only edges refresh
        this.emitChange();
      }
    }
    this.pending.set(null);
    this.mouse.set(null);
  }

  onNodeSelected(e: GNode) {
    const n = this.nodes.find((nn) => nn.id === e.id);
    if (!n) return;
    this.selectedNode.set(n);
    this.openInspectorDialogFor(n);
  }

  onEdgeSelected(e: GEdge) {
    const id = e?.id;
    if (!id) return;
    this.selectedEdgeId.set(this.selectedEdgeId() === id ? null : id);
    this.nudgeGraph();
  }

  selectEdge(edgeId: string, ev?: MouseEvent) {
    ev?.stopPropagation();
    this.selectedEdgeId.set(edgeId);
  }

  isEdgeSelected(edgeId: string) {
    return this.selectedEdgeId() === edgeId;
  }

  deleteSelectedEdge() {
    const id = this.selectedEdgeId();
    if (!id) return;
    this.edges = this.edges.filter((e) => e.id !== id);
    this.selectedEdgeId.set(null);
    this.recomputeGraph();
    this.emitChange();
  }

  @HostListener('document:keydown', ['$event'])
  onKeyDown(ev: KeyboardEvent) {
    if ((ev.key === 'Delete' || ev.key === 'Backspace') && this.selectedEdgeId()) {
      ev.preventDefault();
      this.deleteSelectedEdge();
    }
  }

  // ---------- Inspector (dialog-driven) ----------

  private openInspectorDialogFor(node: WorkflowNode) {
    const isAction = this.isActionNode(node);
    const aiType = isAction ? node.data.aiType : undefined;
    const spec = isAction && aiType ? (ACTION_FORMS[aiType] ?? null) : null;

    this.inspectorConfig = spec ? spec.make(this.fields) : makeFallback(this.fields);

    this.inspectorForm = this.fb.group({});
    setTimeout(() => {
      const current = isAction ? node.data.params : {};
      const defaults = spec?.defaults ?? {};
      const toPatch = { ...defaults, ...(current as object) };
      if (Object.keys(toPatch).length) {
        this.inspectorForm.patchValue(toPatch, { emitEvent: false });
      }
    });

    this.inspectorDialogRef = this.dialog.open<
      ConfirmDialogComponent<{ form: FormGroup; title: string }>,
      ConfirmDialogData<{ form: FormGroup; title: string }>,
      Record<string, unknown> | false
    >(ConfirmDialogComponent, {
      width: '560px',
      maxWidth: '95vw',
      panelClass: 'inspector-dialog-panel',
      backdropClass: 'app-overlay-backdrop',
      data: {
        title: node.data?.label ?? 'configure',
        contentTpl: this.inspectorTpl,
        actionsTpl: this.inspectorActionsTpl,
        context: { form: this.inspectorForm, title: node.data?.label ?? '' },
        getResult: () => (this.inspectorForm.valid ? this.inspectorForm.getRawValue() : false),
      },
    });

    this.inspectorDialogRef.afterClosed().subscribe((result) => {
      this.inspectorDialogRef = null;
      if (!result) return; // cancelled or invalid
      this.applyInspector(node, result as Record<string, unknown>);
    });
  }

  dialogCancel() {
    this.inspectorDialogRef?.close(false);
  }
  dialogConfirm() {
    this.inspectorDialogRef?.componentInstance?.closeWithResult();
  }

  applyInspector(node: WorkflowNode, rawParams: Record<string, unknown>) {
    const idx = this.nodes.findIndex((n) => n.id === node.id);
    if (idx < 0) return;

    if (!this.isActionNode(node)) {
      this.closeInspector();
      return;
    }

    switch (node.data.aiType) {
      case 'chat-basic': {
        const params = rawParams as ChatBasicNodeData['params'];
        if (!params.prompt) return;
        const updated: WorkflowNode = { ...node, data: { ...node.data, params } };
        this.nodes = [...this.nodes.slice(0, idx), updated, ...this.nodes.slice(idx + 1)];
        break;
      }
      case 'chat-on-file': {
        const params = rawParams as ChatOnFileNodeData['params'];
        if (!params.prompt || !params.files?.length) return;
        const updated: WorkflowNode = { ...node, data: { ...node.data, params } };
        this.nodes = [...this.nodes.slice(0, idx), updated, ...this.nodes.slice(idx + 1)];
        break;
      }
      case 'compare': {
        const params = rawParams as CompareNodeData['params'];
        if (!params.leftFile || !params.rightFile) return;
        const updated: WorkflowNode = { ...node, data: { ...node.data, params } };
        this.nodes = [...this.nodes.slice(0, idx), updated, ...this.nodes.slice(idx + 1)];
        break;
      }
      case 'summarize': {
        const params = rawParams as SummarizeNodeData['params'];
        if (!params.file) return;
        const updated: WorkflowNode = { ...node, data: { ...node.data, params } };
        this.nodes = [...this.nodes.slice(0, idx), updated, ...this.nodes.slice(idx + 1)];
        break;
      }
      case 'extract': {
        const params = rawParams as ExtractNodeData['params'];
        if (!params.entities?.trim()) return;
        const updated: WorkflowNode = { ...node, data: { ...node.data, params } };
        this.nodes = [...this.nodes.slice(0, idx), updated, ...this.nodes.slice(idx + 1)];
        break;
      }
      default: {
        const _never: never = node.data;
        return _never;
      }
    }

    this.recomputeGraph();
    this.emitChange();
    this.closeInspector();
  }

  closeInspector() {
    this.selectedNode.set(null);
  }

  // ---------- Context menu ----------

  openCanvasContextMenu(e: MouseEvent) {
    e.preventDefault();
    const hit = this.pickHitFromEvent(e);
    if (!hit) return this.contextMenu.set(null);
    this.contextMenu.set({ ...hit, x: e.clientX, y: e.clientY });
  }
  openNodeContextMenu(nodeId: string, e: MouseEvent) {
    e.preventDefault();
    this.contextMenu.set({ type: 'node', id: nodeId, x: e.clientX, y: e.clientY });
  }
  openLinkContextMenu(linkId: string, e: MouseEvent) {
    e.preventDefault();
    this.contextMenu.set({ type: 'edge', id: linkId, x: e.clientX, y: e.clientY });
  }
  closeContextMenu() {
    this.contextMenu.set(null);
  }

  onConfigure() {
    const m = this.contextMenu();
    if (!m || m.type !== 'node') return;
    const n = this.nodes.find((nn) => nn.id === m.id);
    if (!n) return;
    this.selectedNode.set(n);
    this.openInspectorDialogFor(n);
    this.closeContextMenu();
  }

  onDelete() {
    const m = this.contextMenu();
    if (!m) return;
    if (m.type === 'node') {
      if (m.id === 'input-node' || m.id === 'result-node') {
        this.closeContextMenu();
        return;
      }
      this.nodes = this.nodes.filter((n) => n.id !== m.id);
      this.edges = this.edges.filter((e) => e.source !== m.id && e.target !== m.id);
    } else {
      this.edges = this.edges.filter((e) => e.id !== m.id);
    }
    this.recomputeGraph();
    this.emitChange();
    this.closeContextMenu();
  }

  private pickHitFromEvent(e: MouseEvent): { type: 'node' | 'edge'; id: string } | null {
    const el = (e.target as HTMLElement)?.closest?.('[data-node-id],[data-link-id]');
    if (!el) return null;
    const nodeId = el.getAttribute('data-node-id');
    const linkId = el.getAttribute('data-link-id');
    if (nodeId) return { type: 'node', id: nodeId };
    if (linkId) return { type: 'edge', id: linkId };
    return null;
  }

  // ---------- Graph projection & validity ----------

  private recomputeGraph() {
    this.ensureIoPorts();

    const nodes: GNode[] = this.nodes.map((n) => ({
      id: n.id,
      label: n.data?.label ?? (n.type === 'action' ? 'Action' : n.type),
      data: { ...n.data, type: n.type, ports: n.ports },
    }));

    const links: GEdge[] = this.edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      label: e.label || '',
      data: { style: e.style },
    }));

    this._nodes.set(nodes);
    this._links.set(links);

    if (this.ready()) this.nudgeGraph();
    this.emitValidity();
  }

  private emitValidity() {
    const ids = new Set(this.nodes.map((n) => n.id));
    const bySource = new Map<string, number>();
    const byTarget = new Map<string, number>();

    this.edges.forEach((e) => {
      bySource.set(e.source, (bySource.get(e.source) ?? 0) + 1);
      byTarget.set(e.target, (byTarget.get(e.target) ?? 0) + 1);
    });

    const valid = [...ids].every((id) => {
      if (id === 'input-node') return (bySource.get(id) ?? 0) >= 1;
      if (id === 'result-node') return (byTarget.get(id) ?? 0) >= 1;
      return (bySource.get(id) ?? 0) >= 1 && (byTarget.get(id) ?? 0) >= 1;
    });

    this.validityChange.emit(valid);
  }

  // ---------- Utilities ----------

  private nudgeGraph() {
    if (!this.ready()) return;
    if (this.rafId != null) return;
    this.rafId = requestAnimationFrame(() => {
      this.update$.next(true);
      this.rafId = null;
    });
  }

  private emitChange() {
    this.change.emit({ nodes: this.nodes, edges: this.edges });
  }

  private ensureIoPorts() {
    this.nodes = this.nodes.map((n) => {
      if (n.type === 'input') {
        return {
          ...n,
          ports: { inputs: [], outputs: [{ id: 'out', label: 'out', type: 'json' }] },
        };
      }
      if (n.type === 'result') {
        return { ...n, ports: { inputs: [{ id: 'in', label: 'in', type: 'json' }], outputs: [] } };
      }
      const hasIn = n.ports?.inputs?.length
        ? n.ports.inputs
        : [{ id: 'in', label: 'in', type: 'json' }];
      const hasOut = n.ports?.outputs?.length
        ? n.ports.outputs
        : [{ id: 'out', label: 'out', type: 'json' }];
      return { ...n, ports: { inputs: hasIn, outputs: hasOut } };
    });
  }

  private arePortsCompatible(
    srcNodeId: string,
    srcPortId: string,
    tgtNodeId: string,
    tgtPortId: string,
  ): boolean {
    const nSrc = this.nodes.find((n) => n.id === srcNodeId);
    const nTgt = this.nodes.find((n) => n.id === tgtNodeId);
    const out = nSrc?.ports?.outputs?.find((p) => p.id === srcPortId);
    const inp = nTgt?.ports?.inputs?.find((p) => p.id === tgtPortId);
    if (!out || !inp) return true;
    return !out.type || !inp.type || out.type === inp.type;
  }

  nodeFill(type?: string) {
    if (type === 'input') return '#e3f2fd';
    if (type === 'result') return '#e8f5e9';
    return '#e7e4eb'; // default for action/unknown
  }

  titleize(s: string) {
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
  }

  private uid(): string {
    return crypto?.randomUUID?.() ?? 'id-' + Math.random().toString(36).slice(2, 9);
  }

  private toSafeId(s: string): string {
    return String(s).replace(/[^A-Za-z0-9_-]/g, '-');
  }
  private makeEdgeId(
    srcNodeId: string,
    srcPortId: string,
    tgtNodeId: string,
    tgtPortId: string,
  ): string {
    return `e-${this.toSafeId(srcNodeId)}__${this.toSafeId(srcPortId)}--${this.toSafeId(tgtNodeId)}__${this.toSafeId(tgtPortId)}`;
  }

  isActionNodeData(data: WorkflowNodeData): data is ActionNodeData {
    return !!data && typeof data === 'object' && 'aiType' in data;
  }
  isActionNode(n: WorkflowNode): n is WorkflowNode & { data: ActionNodeData } {
    return this.isActionNodeData(n.data);
  }

  /** Match template rect sizing so port Y math stays in sync */
  private portCenterFromDom(
    nodeId: string,
    portKind: 'input' | 'output',
    portId: string,
  ): { x: number; y: number } | undefined {
    // In your nodeTemplate you already set data-node-id on the <g class="node"> wrapper
    const svg = this.graphHost.nativeElement.querySelector('svg') as SVGSVGElement | null;
    if (!svg) return;

    const nodeEl = this.graphHost.nativeElement.querySelector<SVGGElement>(
      `[data-node-id="${nodeId}"]`,
    );
    if (!nodeEl) return;

    // Port circles have classes .port-in .wf-handle.target and .port-out .wf-handle.source
    const selector =
      portKind === 'input' ? `.port-in .wf-handle.target` : `.port-out .wf-handle.source`;

    // Pick the right circle by index matching the id
    const ports = Array.from(nodeEl.querySelectorAll<SVGCircleElement>(selector));
    // Map your id to index
    const node = this.nodes.find((n) => n.id === nodeId);
    const list = portKind === 'input' ? (node?.ports?.inputs ?? []) : (node?.ports?.outputs ?? []);
    const idx = Math.max(
      0,
      list.findIndex((p) => p.id === portId),
    );
    const circle = ports[idx] ?? ports[0];
    if (!circle) return;

    const ctm = circle.getScreenCTM();
    if (!ctm) return;

    const pt = (svg as any).createSVGPoint();
    pt.x = circle.cx.baseVal.value;
    pt.y = circle.cy.baseVal.value;
    const sp = pt.matrixTransform((circle as any).getCTM()); // local → node space
    const gp = (svg as any).createSVGPoint();
    gp.x = sp.x;
    gp.y = sp.y;
    const result = gp.matrixTransform(ctm); // node → screen
    // Convert screen → SVG space
    const inv = (svg as any).getScreenCTM()?.inverse?.();
    if (!inv) return;
    const svgPt = (svg as any).createSVGPoint();
    svgPt.x = result.x;
    svgPt.y = result.y;
    const local = svgPt.matrixTransform(inv);
    return { x: local.x, y: local.y };
  }

  private edgePointsFromPorts(edgeId?: string) {
    const e = this.edges.find((x) => x.id === edgeId);
    if (!e) return;
    const s = this.portCenterFromDom(e.source, 'output', e.sourcePort!);
    const t = this.portCenterFromDom(e.target, 'input', e.targetPort!);
    if (!s || !t) return;

    const midX = (s.x + t.x) / 2;
    return [
      { x: s.x, y: s.y },
      { x: midX, y: s.y },
      { x: midX, y: t.y },
      { x: t.x, y: t.y },
    ];
  }

  ghostStart(): { x: number; y: number } {
    const p = this.pending();
    if (!p) return { x: 0, y: 0 };
    return this.portCenterFromDom(p.nodeId, 'output', p.portId) ?? { x: 0, y: 0 };
  }

  isPending(nodeId: string, portId: string, kind: 'source' | 'target'): boolean {
    const p = this.pending();
    return !!p && kind === 'source' && p.nodeId === nodeId && p.portId === portId;
  }
}
