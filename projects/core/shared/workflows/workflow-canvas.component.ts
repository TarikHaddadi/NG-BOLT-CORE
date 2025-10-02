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
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { Edge as GEdge, NgxGraphModule, Node as GNode } from '@swimlane/ngx-graph';
import { Subject } from 'rxjs';

import {
  ActionDefinition,
  ContextMenuTarget,
  FieldConfig,
  NodeWithPorts,
  WorkflowEdge,
  WorkflowNode,
} from '@cadai/pxs-ng-core/interfaces';
import { FieldConfigService } from '@cadai/pxs-ng-core/services';

import { DynamicFormComponent } from '../public-api';

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
  ready = signal(false);
  private pending = signal<{ nodeId: string; portId: string } | null>(null);

  selectedNode = signal<NodeWithPorts | null>(null);
  inspectorForm!: FormGroup;
  inspectorConfig: FieldConfig[] = [];

  constructor(
    private fb: FormBuilder,
    private fields: FieldConfigService,
  ) {}

  ngAfterViewInit() {
    const el = this.graphHost?.nativeElement;
    if (el && 'ResizeObserver' in window) {
      const resize = () => {
        // Defensive width calculation
        let w = el.clientWidth;
        if (!w) {
          // try parent, then fallback
          const parent = el.parentElement;
          w = parent?.clientWidth || 900;
        }
        const computedH =
          el.clientHeight > 0 ? el.clientHeight : Math.max(560, Math.round(w * 0.6));
        this.canvasW.set(w);
        this.canvasH.set(computedH);

        // only nudge the graph if ready
        if (this.ready()) this.update$.next(true);
      };
      this.ro = new ResizeObserver(resize);
      this.ro.observe(el);
      resize();
    }

    // Mark ready on next macrotask to ensure template rendered
    setTimeout(() => {
      this.ready.set(true);
      this.recomputeGraph(); // first compute AFTER view exists
      this.emitChange(); // also safe now
      this.update$.next(true); // first nudge
    });
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
    }
  }

  // palette drop → add node (let dagre place it)
  onDrop(ev: any) {
    if (this.disabled()) return;
    const action = ev.item?.data as ActionDefinition | undefined;
    if (!action) return;

    const node: NodeWithPorts = {
      id: crypto.randomUUID(),
      type: 'action',
      x: 0,
      y: 0, // dagre will place it
      data: {
        label: this.titleize(action.type),
        params: { ...(action.params ?? {}) },
      },
      ports: {
        inputs: [{ id: 'in', label: 'in', type: 'json' }],
        outputs: [{ id: 'out', label: 'out', type: 'json' }],
      },
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
        this.edges = [
          ...this.edges,
          {
            id,
            source: from,
            target: nodeId,
            label: '',
            style: { stroke: '#4caf50', marker: 'round', dasharray: '4 4' },
          },
        ];
        this.recomputeGraph();
        this.emitChange();
      }
    }
    this.pendingSource.set(null);
  }

  // (optional) keep these for selecting via ngx-graph events if you like
  onNodeSelected(e: any) {
    // e has the GNode; find domain node
    const nodeId: string = e?.id;
    const n = this.nodes.find((nn) => nn.id === nodeId) as NodeWithPorts | undefined;
    if (!n) return;

    this.selectedNode.set(n);
    const type = n?.type === 'action' ? (n.data as any)?.label?.toLowerCase() : n?.type;

    // Build FieldConfig[] based on node type
    this.inspectorConfig = this.buildConfigFor(type);

    // Build form seeded with params
    this.inspectorForm = this.fb.group({});
    // DynamicForm will create controls, but we often seed values separately:
    // If your DynamicForm binds to provided "form", ensure it uses existing value in "params"
    // or patch after view init:
    setTimeout(() => {
      // ensure the dynamic form component created controls
      if ((n.data as any)?.params) this.inspectorForm.patchValue((n.data as any).params);
    });
  }
  closeInspector() {
    this.selectedNode.set(null);
  }
  applyInspector() {
    const node = this.selectedNode();
    if (!node) return;
    const idx = this.nodes.findIndex((n) => n.id === node.id);
    const params = this.inspectorForm.getRawValue();

    const updated: NodeWithPorts = {
      ...(this.nodes[idx] as any),
      data: { ...(this.nodes[idx].data || {}), params },
    };
    this.nodes = [...this.nodes.slice(0, idx), updated, ...this.nodes.slice(idx + 1)];
    this.recomputeGraph();
    this.emitChange();
    this.closeInspector();
  }

  private buildConfigFor(type?: string): FieldConfig[] {
    switch (type) {
      case 'fetch':
        return [
          this.fields.getTextField({
            name: 'url',
            label: 'URL',
            placeholder: 'https://api.example.com/items',
            validators: [Validators.required],
          }),
          this.fields.getDropdownField({
            name: 'method',
            label: 'Method',
            options: [
              { label: 'GET', value: 'GET' },
              { label: 'POST', value: 'POST' },
              { label: 'PUT', value: 'PUT' },
              { label: 'DELETE', value: 'DELETE' },
            ],
            validators: [Validators.required],
          }),
          this.fields.getTextAreaField({
            name: 'headers',
            label: 'Headers (JSON)',
            rows: 4,
          }),
          this.fields.getTextAreaField({
            name: 'body',
            label: 'Body (JSON)',
            rows: 6,
          }),
        ].filter(Boolean) as FieldConfig[];

      case 'transform':
        return [
          this.fields.getTextAreaField?.({
            name: 'script',
            label: 'Script',
            placeholder: 'return {...data, foo: 1};',
            rows: 8,
            validators: [Validators.required],
          }),
        ].filter(Boolean) as FieldConfig[];

      case 'store':
        return [
          this.fields.getTextField({
            name: 'collection',
            label: 'Collection',
            placeholder: 'work-entries',
            validators: [Validators.required],
          }),
          this.fields.getTextField({
            name: 'key',
            label: 'Key expression',
            placeholder: 'id',
          }),
        ];

      case 'input': // special nodes can have configuration too
        return [
          this.fields.getTextField({
            name: 'label',
            label: 'Display label',
            placeholder: 'Input',
          }),
        ];

      case 'result':
        return [
          this.fields.getTextField({
            name: 'label',
            label: 'Result name',
            placeholder: 'Output',
          }),
        ];
      default:
        // fallback: generic key/value editor
        return [
          this.fields.getTextAreaField({
            name: 'params',
            label: 'Params (JSON)',
            rows: 8,
          }),
        ].filter(Boolean) as FieldConfig[];
    }
  }

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
    }));
    const links: GEdge[] = this.edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      label: e['label'] || '',
      data: { style: e.style },
    }));

    this._nodes.set(nodes);
    this._links.set(links);

    // Only notify ngx-graph once we’re ready
    if (this.ready()) this.update$.next(true);
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

  clickPort(nodeId: string, kind: 'source' | 'target', portId: string, e: MouseEvent) {
    e.stopPropagation();
    if (this.disabled()) return;

    // source: remember
    if (kind === 'source') {
      this.pending.set({ nodeId, portId });
      return;
    }

    // target: create edge if a source is pending
    const from = this.pending();
    if (from && (from.nodeId !== nodeId || from.portId !== portId)) {
      const id = `${from.nodeId}:${from.portId} -> ${nodeId}:${portId}`;
      if (!this.edges.some((e) => e.id === id)) {
        // OPTIONAL: validate type compatibility
        if (!this.arePortsCompatible(from.nodeId, from.portId, nodeId, portId)) {
          // your UX (toast/snackbar)
          this.pending.set(null);
          return;
        }

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

  private arePortsCompatible(
    srcNodeId: string,
    srcPortId: string,
    tgtNodeId: string,
    tgtPortId: string,
  ): boolean {
    const nSrc = this.nodes.find((n) => n.id === srcNodeId) as NodeWithPorts | undefined;
    const nTgt = this.nodes.find((n) => n.id === tgtNodeId) as NodeWithPorts | undefined;
    const out = nSrc?.ports?.outputs?.find((p) => p.id === srcPortId);
    const inp = nTgt?.ports?.inputs?.find((p) => p.id === tgtPortId);
    if (!out || !inp) return true; // lenient default
    return !out.type || !inp.type || out.type === inp.type;
  }

  onConfigure() {
    const m = this.contextMenu();
    if (!m || m.type !== 'node') return;
    const n = this.nodes.find((nn) => nn.id === m.id) as NodeWithPorts | undefined;
    if (!n) return;
    // fake an ngx-graph selection payload:
    this.onNodeSelected({ id: n.id });
    this.closeContextMenu();
  }
}
