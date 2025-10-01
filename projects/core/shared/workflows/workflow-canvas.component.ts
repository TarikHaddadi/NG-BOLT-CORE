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
import { Edge as GEdge,NgxGraphModule, Node as GNode } from '@swimlane/ngx-graph';
import { Subject } from 'rxjs';

import { ActionDefinition, WorkflowEdge, WorkflowNode } from '@cadai/pxs-ng-core/interfaces';

type ContextMenuTarget = { type: 'node' | 'edge'; id: string; x: number; y: number } | null;

@Component({
  selector: 'app-workflow-canvas',
  standalone: true,
  imports: [CommonModule, DragDropModule, NgxGraphModule],
  templateUrl: './workflow-canvas.component.html',
  styleUrls: ['./workflow-canvas.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WorkflowCanvasComponent implements OnInit, AfterViewInit, OnDestroy {
  @Input({ required: true }) nodes: WorkflowNode[] = [];
  @Input({ required: true }) edges: WorkflowEdge[] = [];
  @Input() disabled = signal<boolean>(false);
  @Input() availableActions = signal<ActionDefinition[]>([]);
  @Output() change = new EventEmitter<{ nodes: WorkflowNode[]; edges: WorkflowEdge[] }>();
  @Output() validityChange = new EventEmitter<boolean>();
  @ViewChild('graphHost', { static: true }) graphHost!: ElementRef<HTMLElement>;

  canvasW = signal(900);
  canvasH = signal(580);

  // graph store
  private _nodes = signal<GNode[]>([]);
  private _links = signal<GEdge[]>([]);
  update$ = new Subject<boolean>();
  private ro?: ResizeObserver;

  // connection state: remember selected SOURCE node
  private pendingSource = signal<string | null>(null);

  contextMenu = signal<ContextMenuTarget>(null);

  gNodes = computed(() => this._nodes());
  gLinks = computed(() => this._links());

  ngAfterViewInit() {
    const el = this.graphHost?.nativeElement;
    if (!el || !('ResizeObserver' in window)) return;

    const resize = () => {
      // Full width of the host
      const w = Math.max(0, el.clientWidth);
      // Height: use actual height if set, otherwise derive from width or fallback
      const computedH = el.clientHeight > 0 ? el.clientHeight : Math.max(560, Math.round(w * 0.6));
      this.canvasW.set(w);
      this.canvasH.set(computedH);
      this.update$.next(true); // trigger re-render
    };

    this.ro = new ResizeObserver(resize);
    this.ro.observe(el);
    // initial size
    resize();
  }

  ngOnDestroy() {
    this.ro?.disconnect();
  }

  ngOnInit() {
    if (!this.nodes?.length) {
      const input: WorkflowNode = {
        id: 'input-node',
        type: 'input',
        x: 0,
        y: 0,
        data: { label: 'Input' },
      };
      const result: WorkflowNode = {
        id: 'result-node',
        type: 'result',
        x: 0,
        y: 0,
        data: { label: 'Result' },
      };
      this.nodes = [input, result];
      this.emitChange();
    }
    this.recomputeGraph();
  }

  // palette drop → add node (let dagre place it)
  onDrop(ev: any) {
    if (this.disabled()) return;
    const action = ev.item?.data as ActionDefinition | undefined;
    if (!action) return;

    const node: WorkflowNode = {
      id: crypto.randomUUID(),
      type: 'action',
      x: 0,
      y: 0, // dagre will place it
      data: { label: this.titleize(action.type), params: { ...(action.params ?? {}) } },
    };
    this.nodes = [...this.nodes, node];
    this.recomputeGraph();
    this.emitChange();
  }

  // Handles on SVG nodes:
  // - click source  → remember it
  // - click target  → if we have a pending source, create edge source -> this node
  clickHandle(nodeId: string, kind: 'source' | 'target', e: MouseEvent) {
    e.stopPropagation();
    if (this.disabled()) return;

    if (kind === 'source') {
      this.pendingSource.set(nodeId);
      return;
    }

    // target clicked
    const from = this.pendingSource();
    if (from && from !== nodeId) {
      const id = `${from}-${nodeId}`;
      if (!this.edges.some((e) => e.id === id)) {
        this.edges = [...this.edges, { id, source: from, target: nodeId, label: '' }];
        this.recomputeGraph();
        this.emitChange();
      }
    }
    this.pendingSource.set(null);
  }

  // (optional) keep these for selecting via ngx-graph events if you like
  onNodeSelected(_: any) {}
  onEdgeSelected(_: any) {}

  // context menu
  openContextMenu(e: MouseEvent) {
    e.preventDefault();
    const hit = this.pickHit(e);
    if (!hit) return this.contextMenu.set(null);
    this.contextMenu.set({ ...hit, x: e.clientX, y: e.clientY });
  }
  closeContextMenu() {
    this.contextMenu.set(null);
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

  // graph rebuild
  private recomputeGraph() {
    const nodes: GNode[] = this.nodes.map((n) => ({
      id: n.id,
      label: n.data?.label ?? (n.type === 'action' ? 'Action' : n.type),
      data: { ...n.data, type: n.type },
      // no 'position' with dagre; let layout place them
    }));
    const links: GEdge[] = this.edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      label: e['label'] || '',
    }));

    this._nodes.set(nodes);
    this._links.set(links);

    this.update$.next(true); // tell ngx-graph to recompute
    this.emitValidity();
  }

  // validity and change events
  private emitChange() {
    this.change.emit({ nodes: this.nodes, edges: this.edges });
    this.emitValidity();
  }
  private emitValidity() {
    const ids = new Set(this.nodes.map((n) => n.id));
    const connected = new Set<string>();
    this.edges.forEach((e) => {
      connected.add(e.source);
      connected.add(e.target);
    });
    const allConnected = [...ids].every((id) => connected.has(id));
    const hasIn = this.edges.some((e) => e.source === 'input-node');
    const hasOut = this.edges.some((e) => e.target === 'result-node');
    this.validityChange.emit(allConnected && hasIn && hasOut);
  }

  // helpers
  nodeFill(type?: string) {
    if (type === 'input') return '#e3f2fd';
    if (type === 'result') return '#e8f5e9';
    return '#ffffff';
  }
  titleize(s: string) {
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
  }

  private pickHit(e: MouseEvent): { type: 'node' | 'edge'; id: string } | null {
    const el = (e.target as HTMLElement)?.closest?.('[ngx-graph-node],[ngx-graph-link]');
    if (!el) return null;
    const nodeId = el.getAttribute('ng-reflect-node-id') || el.getAttribute('node-id');
    const linkId = el.getAttribute('ng-reflect-link-id') || el.getAttribute('link-id');
    if (nodeId) return { type: 'node', id: nodeId };
    if (linkId) return { type: 'edge', id: linkId };
    return null;
  }
}
