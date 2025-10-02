import { DragDropModule } from '@angular/cdk/drag-drop';
import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  EventEmitter,
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
  ContextMenuTarget,
  FieldConfig,
  WorkflowEdge,
  WorkflowNode,
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
  private pending = signal<{ nodeId: string; portId: string } | null>(null);

  // Context menu
  contextMenu = signal<ContextMenuTarget | null>(null);

  // Inspector
  selectedNode = signal<WorkflowNode | null>(null);
  inspectorForm!: FormGroup;
  inspectorConfig: FieldConfig[] = [];

  // rAF coalescing
  private rafId: number | null = null;

  constructor(
    private fb: FormBuilder,
    private fields: FieldConfigService,
  ) {}

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
    });
  }

  ngOnDestroy() {
    this.ro?.disconnect();
  }

  // ---------- DnD palette -> canvas (copy semantics) ----------

  allowPaletteDrop = () => !this.disabled();

  onDrop(ev: any) {
    if (this.disabled()) return;
    const action = ev.item?.data as ActionDefinition | undefined;
    if (!action) return;

    const type = action.type as AiActionType;
    const spec = ACTION_FORMS[type as any];
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
        return;
      }
      const id = `${from.nodeId}:${from.portId} -> ${nodeId}:${portId}`;
      if (!this.edges.some((e) => e.id === id)) {
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
          } as any,
        ];
        this.recomputeGraph();
        this.emitChange();
      }
    }
    this.pending.set(null);
  }

  onNodeSelected(e: any) {
    const nodeId: string = e?.id;
    const n = this.nodes.find((nn) => nn.id === nodeId);
    if (!n) return;

    this.selectedNode.set(n);

    // Build config from registry
    const aiType = (n.data as any)?.aiType as string | undefined;
    const spec = (aiType && ACTION_FORMS[aiType]) || null;
    this.inspectorConfig = spec ? spec.make(this.fields) : makeFallback(this.fields);

    // Init form & patch defaults + current params
    this.inspectorForm = this.fb.group({});
    setTimeout(() => {
      const current = (n.data as any)?.params ?? {};
      const defaults = spec?.defaults ?? {};
      const toPatch = { ...defaults, ...current };
      if (Object.keys(toPatch).length) {
        this.inspectorForm.patchValue(toPatch, { emitEvent: false });
      }
    });
  }

  onEdgeSelected(_: any) {}

  // ---------- Inspector ----------

  applyInspector() {
    const node = this.selectedNode();
    if (!node) return;

    const params = this.inspectorForm.getRawValue();
    const aiType = (node.data as any)?.aiType as string | undefined;

    // Minimal guards
    if (aiType === 'chat-basic' && !params?.prompt) return;
    if (aiType === 'chat-on-file' && (!params?.files || !params.files.length)) return;
    if (aiType === 'compare' && (!params?.leftFile || !params?.rightFile)) return;
    if (aiType === 'summarize' && !params?.file) return;
    if (aiType === 'extract' && !params?.entities) return;

    const idx = this.nodes.findIndex((n) => n.id === node.id);
    const updated: WorkflowNode = {
      ...(this.nodes[idx] as any),
      data: { ...(this.nodes[idx].data || {}), params },
    };

    this.nodes = [...this.nodes.slice(0, idx), updated, ...this.nodes.slice(idx + 1)];
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
      label: (e as any).label || '',
      data: { style: (e as any).style },
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
    return '#ffffff';
  }

  titleize(s: string) {
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
  }

  private uid(): string {
    return crypto?.randomUUID?.() ?? 'id-' + Math.random().toString(36).slice(2, 9);
  }
}
