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
import { Edge as GEdge, NgxGraphModule, Node as GNode } from '@swimlane/ngx-graph';
import { Subject } from 'rxjs';

import {
  ACTION_LABEL,
  ActionDefinition,
  ActionNodeData,
  AiActionType,
  ChatBasicNodeData,
  ChatOnFileNodeData,
  CompareNodeData,
  ContextMenuTarget,
  ExtractNodeData,
  FieldConfig,
  SummarizeNodeData,
  WorkflowEdge,
  WorkflowNode,
  WorkflowNodeData,
} from '@cadai/pxs-ng-core/interfaces';
import { FieldConfigService } from '@cadai/pxs-ng-core/services';

import { DynamicFormComponent } from '../public-api';
import { ACTION_FORMS, makeFallback } from './action-forms.component';

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

  // Canvas viewport
  canvasW = signal(900);
  canvasH = signal(640); // fixed to CSS clamp

  // Graph store for ngx-graph
  private _nodes = signal<GNode[]>([]);
  private _links = signal<GEdge[]>([]);
  gNodes = computed(() => this._nodes());
  gLinks = computed(() => this._links());
  update$ = new Subject<boolean>();

  private ro?: ResizeObserver;
  ready = signal(false);

  // Port-aware connection (click-to-connect)
  pending = signal<{ nodeId: string; portId: string } | null>(null);

  // Context menu
  contextMenu = signal<ContextMenuTarget | null>(null);

  // Inspector
  selectedNode = signal<WorkflowNode | null>(null);
  inspectorForm!: FormGroup;
  inspectorConfig: FieldConfig[] = [];

  // rAF coalescing
  private rafId: number | null = null;

  mouse = signal<{ x: number; y: number } | null>(null);
  selectedEdgeId = signal<string | null>(null);
  autoCenter = signal(true); // we'll disable after first layout

  onCanvasMouseMove(evt: MouseEvent) {
    const svg = (evt.currentTarget as HTMLElement).querySelector('svg');
    if (!svg) return;
    const pt = svg.createSVGPoint?.() || { x: 0, y: 0, matrixTransform: () => ({ x: 0, y: 0 }) };
    if ('createSVGPoint' in svg) {
      pt.x = evt.clientX;
      pt.y = evt.clientY;
      const ctm = svg.getScreenCTM?.();
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

  selectEdge(edgeId: string, e?: MouseEvent) {
    e?.stopPropagation();
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
    if (ev.key === 'Delete' || ev.key === 'Backspace') {
      if (this.selectedEdgeId()) {
        ev.preventDefault();
        this.deleteSelectedEdge();
      }
    }
  }

  constructor(
    private fb: FormBuilder,
    private fields: FieldConfigService,
  ) {}

  private toSafeId(s: string): string {
    // keep letters, numbers, underscore, dash; replace everything else with '-'
    return String(s).replace(/[^A-Za-z0-9_-]/g, '-');
  }
  private makeEdgeId(
    srcNodeId: string,
    srcPortId: string,
    tgtNodeId: string,
    tgtPortId: string,
  ): string {
    // canonical and CSS-safe (no spaces/colons/arrows)
    return `e-${this.toSafeId(srcNodeId)}__${this.toSafeId(srcPortId)}--${this.toSafeId(tgtNodeId)}__${this.toSafeId(tgtPortId)}`;
  }

  isPending(nodeId: string, portId: string, kind: 'source' | 'target'): boolean {
    const p = this.pending();
    return !!p && kind === 'source' && p.nodeId === nodeId && p.portId === portId;
  }

  // ---------- Lifecycle ----------

  ngOnInit() {
    if (!this.nodes?.length) {
      const input: WorkflowNode = {
        id: 'input-node',
        type: 'input',
        x: 0,
        y: 0,
        data: { label: 'Input' },
        ports: {
          inputs: [],
          outputs: [{ id: 'out', label: 'out', type: 'json' }],
        },
      };
      const result: WorkflowNode = {
        id: 'result-node',
        type: 'result',
        x: 0,
        y: 0,
        data: { label: 'Result' },
        ports: {
          inputs: [{ id: 'in', label: 'in', type: 'json' }],
          outputs: [],
        },
      };
      this.nodes = [input, result];
    } else {
      this.ensureIoPorts();
    }
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

      // disable autoCenter after first stable frame to avoid jump on subsequent updates
      setTimeout(() => this.autoCenter.set(false));
    });
  }

  ngOnDestroy() {
    this.ro?.disconnect();
  }

  allowPaletteDrop = () => !this.disabled();

  onDrop(ev: CdkDragDrop<{}, any, any>) {
    if (this.disabled()) return;
    const action = ev.item?.data as ActionDefinition | undefined;
    if (!action) return;

    const type = action.type as AiActionType;
    const spec = ACTION_FORMS[type];
    const defaults = spec?.defaults ?? {};

    const node: WorkflowNode = {
      id: this.uid(),
      type: 'action',
      x: 0,
      y: 0,
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

    this.nodes = [...this.nodes, node];
    this.recomputeGraph();
    this.emitChange();

    // put dragged pill back into palette (infinite palette)
    const itemEl = ev.item?.element?.nativeElement as HTMLElement | undefined;
    const paletteEl = this.paletteHost?.nativeElement as HTMLElement | undefined;
    if (itemEl && paletteEl && !paletteEl.contains(itemEl)) {
      paletteEl.appendChild(itemEl);
    }
    if (ev.item?.reset) ev.item.reset();
  }

  // ---------- Node/Edge handlers ----------

  clickPort(nodeId: string, kind: 'source' | 'target', portId: string, e: MouseEvent) {
    e.stopPropagation();
    if (this.disabled()) return;

    if (kind === 'source') {
      this.pending.set({ nodeId, portId });
      return;
    }

    const from = this.pending();
    if (from && (from.nodeId !== nodeId || from.portId !== portId)) {
      if (!this.arePortsCompatible(from.nodeId, from.portId, nodeId, portId)) {
        this.pending.set(null);
        this.mouse.set(null);
        return;
      }
      const id = this.makeEdgeId(from.nodeId, from.portId, nodeId, portId);
      const exists = this.edges.some(
        (e) =>
          e.source === from.nodeId &&
          e.target === nodeId &&
          e.sourcePort === from.portId &&
          e.targetPort === portId,
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
        this.recomputeGraph();
        this.emitChange();
      }
    }
    this.pending.set(null);
    this.mouse.set(null);
  }

  onNodeSelected(e: any) {
    const nodeId: string = e?.id;
    const n = this.nodes.find((nn) => nn.id === nodeId);
    if (!n) return;

    this.selectedNode.set(n);

    // If it's an action node, load the action-specific form; otherwise fallback (e.g., just label)
    if (this.isActionNode(n)) {
      const aiType = n.data.aiType; // strongly typed now
      const spec = ACTION_FORMS[aiType] ?? null;

      this.inspectorConfig = spec ? spec.make(this.fields) : makeFallback(this.fields);

      this.inspectorForm = this.fb.group({});
      setTimeout(() => {
        const current = n.data.params; // typed
        const defaults = spec?.defaults ?? {};
        const toPatch = { ...defaults, ...current };
        if (Object.keys(toPatch).length) {
          this.inspectorForm.patchValue(toPatch, { emitEvent: false });
        }
      });
    } else {
      // input/result nodes: no aiType/params — provide a simple fallback config (e.g., label only)
      this.inspectorConfig = makeFallback(this.fields);
      this.inspectorForm = this.fb.group({});
      setTimeout(() => {
        // Example: patch only a label if your fallback has it; otherwise omit.
        const label = n.data?.label ?? '';
        if (label) this.inspectorForm.patchValue({ label }, { emitEvent: false });
      });
    }
  }

  onEdgeSelected(e: any) {
    // ngx-graph sends the edge object; we only need the id
    const id: string | undefined = e?.id;
    if (!id) return;

    // toggle selection if clicking the same edge again
    const currentlySelected = this.selectedEdgeId?.() ?? null;
    if (currentlySelected === id) {
      this.selectedEdgeId.set(null);
    } else {
      this.selectedEdgeId.set(id);
    }

    // ask ngx-graph to redraw so the selected style applies immediately
    this.nudgeGraph();
  }

  // ---------- Inspector ----------

  applyInspector() {
    const node = this.selectedNode();
    if (!node) return;

    const idx = this.nodes.findIndex((n) => n.id === node.id);
    if (idx < 0) return;

    // Only action nodes have params to apply
    if (!this.isActionNode(node)) {
      // For input/result nodes you might update only 'label' etc. If not needed, just return.
      this.closeInspector();
      return;
    }

    // Narrow by aiType and cast the form value to the *correct* params shape.
    // NOTE: getRawValue() is untyped; we narrow by switch for safety.
    switch (node.data.aiType) {
      case 'chat-basic': {
        const params = this.inspectorForm.getRawValue() as ChatBasicNodeData['params'];
        if (!params.prompt) return;
        const updated: WorkflowNode = {
          ...node,
          data: { ...node.data, params } satisfies ChatBasicNodeData,
        };
        this.nodes = [...this.nodes.slice(0, idx), updated, ...this.nodes.slice(idx + 1)];
        break;
      }

      case 'chat-on-file': {
        const params = this.inspectorForm.getRawValue() as ChatOnFileNodeData['params'];
        if (!params.prompt || !params.files || params.files.length === 0) return;
        const updated: WorkflowNode = {
          ...node,
          data: { ...node.data, params } satisfies ChatOnFileNodeData,
        };
        this.nodes = [...this.nodes.slice(0, idx), updated, ...this.nodes.slice(idx + 1)];
        break;
      }

      case 'compare': {
        const params = this.inspectorForm.getRawValue() as CompareNodeData['params'];
        if (!params.leftFile || !params.rightFile) return;
        const updated: WorkflowNode = {
          ...node,
          data: { ...node.data, params } satisfies CompareNodeData,
        };
        this.nodes = [...this.nodes.slice(0, idx), updated, ...this.nodes.slice(idx + 1)];
        break;
      }

      case 'summarize': {
        const params = this.inspectorForm.getRawValue() as SummarizeNodeData['params'];
        if (!params.file) return;
        const updated: WorkflowNode = {
          ...node,
          data: { ...node.data, params } satisfies SummarizeNodeData,
        };
        this.nodes = [...this.nodes.slice(0, idx), updated, ...this.nodes.slice(idx + 1)];
        break;
      }

      case 'extract': {
        const params = this.inspectorForm.getRawValue() as ExtractNodeData['params'];
        if (!params.entities || params.entities.trim().length === 0) return;
        const updated: WorkflowNode = {
          ...node,
          data: { ...node.data, params } satisfies ExtractNodeData,
        };
        this.nodes = [...this.nodes.slice(0, idx), updated, ...this.nodes.slice(idx + 1)];
        break;
      }

      default: {
        // Exhaustiveness guard — if a new aiType is added and not handled here, TS will error.
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
    const n = this.nodes.find((nn) => nn.id === m.id) as WorkflowNode | undefined;
    if (!n) return;
    this.onNodeSelected({ id: n.id });
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
          ports: {
            inputs: [],
            outputs: [{ id: 'out', label: 'out', type: 'json' }],
          },
        };
      }
      if (n.type === 'result') {
        return {
          ...n,
          ports: {
            inputs: [{ id: 'in', label: 'in', type: 'json' }],
            outputs: [],
          },
        };
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
    return '#e7e4eb';
  }

  titleize(s: string) {
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
  }

  private uid(): string {
    return crypto?.randomUUID?.() ?? 'id-' + Math.random().toString(36).slice(2, 9);
  }

  isActionNodeData(data: WorkflowNodeData): data is ActionNodeData {
    return (data as any)?.aiType !== undefined; // discriminant present only on action nodes
  }

  isActionNode(n: WorkflowNode): n is WorkflowNode & { data: ActionNodeData } {
    return this.isActionNodeData(n.data);
  }
}
