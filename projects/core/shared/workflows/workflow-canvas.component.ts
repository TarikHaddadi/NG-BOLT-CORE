import { DragDropModule } from '@angular/cdk/drag-drop';
import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  EventEmitter,
  Input,
  Output,
  signal,
} from '@angular/core';
import { Edge as GEdge, NgxGraphModule, Node as GNode } from '@swimlane/ngx-graph';
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
export class WorkflowCanvasComponent {
  @Input({ required: true }) nodes: WorkflowNode[] = [];
  @Input({ required: true }) edges: WorkflowEdge[] = [];
  @Input() disabled = signal<boolean>(false);
  @Input() availableActions = signal<ActionDefinition[]>([]);
  @Output() change = new EventEmitter<{ nodes: WorkflowNode[]; edges: WorkflowEdge[] }>();
  @Output() validityChange = new EventEmitter<boolean>();
  update$ = new Subject<boolean>();
  canvasW = signal(800);
  canvasH = signal(550);

  private selectedForConnect = signal<string | null>(null);
  // store graph in two arrays to avoid shape mismatches
  private _nodes = signal<GNode[]>([]);
  private _links = signal<GEdge[]>([]);

  contextMenu = signal<ContextMenuTarget>(null);

  gNodes = computed<GNode[]>(() => this._nodes());
  gLinks = computed<GEdge[]>(() => this._links());

  constructor() {}

  ngOnInit() {
    if (!this.nodes?.length) {
      const input: WorkflowNode = { id: 'input-node', type: 'input', x: 50, y: 200, data: {} };
      const result: WorkflowNode = { id: 'result-node', type: 'result', x: 600, y: 200, data: {} };
      this.nodes = [input, result];
      this.emitChange();
    }
    this.recomputeGraph();
  }

  nodeFill(type?: string) {
    if (type === 'input') return '#e3f2fd';
    if (type === 'result') return '#e8f5e9';
    return '#ffffff';
  }

  private recomputeGraph() {
    const nodes: GNode[] = this.nodes.map((n) => ({
      id: n.id,
      label: n.data?.label ?? (n.type === 'action' ? 'Action' : n.type),
      data: { ...n.data, type: n.type },
      position: n.x != null && n.y != null ? { x: n.x, y: n.y } : undefined,
    }));
    const links: GEdge[] = this.edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      label: '',
    }));
    this._nodes.set(nodes);
    this._links.set(links);
    this.update$.next(true);
    this.emitValidity();
  }

  onDrop(ev: any) {
    if (this.disabled()) return;
    const action = ev.item?.data as ActionDefinition | undefined;
    if (!action) return;

    const hostRect = (ev.event?.target as HTMLElement)?.getBoundingClientRect?.() ?? {
      left: 0,
      top: 0,
    };
    const x = (ev.dropPoint?.x ?? ev.event?.clientX ?? 100) - hostRect.left;
    const y = (ev.dropPoint?.y ?? ev.event?.clientY ?? 100) - hostRect.top;

    const id = crypto.randomUUID();
    const node: WorkflowNode = {
      id,
      type: 'action',
      x,
      y,
      data: { label: action.type, params: { ...(action.params ?? {}) } },
    };
    this.nodes = [...this.nodes, node];
    this.recomputeGraph();
    this.emitChange();
  }

  onNodeSelected(node: any) {
    if (this.disabled()) return;
    const current = this.selectedForConnect();
    if (!current) {
      this.selectedForConnect.set(node.id);
      return;
    }
    if (current === node.id) {
      this.selectedForConnect.set(null);
      return;
    }

    const id = `${current}-${node.id}`;
    if (!this.edges.some((e) => e.id === id)) {
      this.edges = [...this.edges, { id, source: current, target: node.id }];
      this.recomputeGraph();
      this.emitChange();
    }
    this.selectedForConnect.set(null);
  }
  onEdgeSelected(_: any) {}

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

  private pickHit(e: MouseEvent): { type: 'node' | 'edge'; id: string } | null {
    const el = (e.target as HTMLElement)?.closest?.('[ngx-graph-node],[ngx-graph-link]');
    if (!el) return null;
    const nodeId = el.getAttribute('ng-reflect-node-id') || el.getAttribute('node-id');
    const linkId = el.getAttribute('ng-reflect-link-id') || el.getAttribute('link-id');
    if (nodeId) return { type: 'node', id: nodeId };
    if (linkId) return { type: 'edge', id: linkId };
    return null;
  }

  private emitChange() {
    this.change.emit({ nodes: this.nodes, edges: this.edges });
    this.emitValidity();
  }
  private emitValidity() {
    const nodeIds = new Set(this.nodes.map((n) => n.id));
    const connected = new Set<string>();
    this.edges.forEach((e) => {
      connected.add(e.source);
      connected.add(e.target);
    });
    const allConnected = [...nodeIds].every((id) => connected.has(id));
    const hasIn = this.edges.some((e) => e.source === 'input-node');
    const hasOut = this.edges.some((e) => e.target === 'result-node');
    this.validityChange.emit(allConnected && hasIn && hasOut);
  }
}
