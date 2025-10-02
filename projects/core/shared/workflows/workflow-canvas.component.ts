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

  // Canvas viewport
  canvasW = signal(900);
  canvasH = signal(640); // fixed default to match CSS

  // Graph store for ngx-graph
  private _nodes = signal<GNode[]>([]);
  private _links = signal<GEdge[]>([]);
  gNodes = computed(() => this._nodes());
  gLinks = computed(() => this._links());
  update$ = new Subject<boolean>();

  // Lifecycle
  private ro?: ResizeObserver;
  ready = signal(false);

  // Drag connection (simple handles)
  private pendingSource = signal<string | null>(null);

  // Port-aware connection
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
    // seed default graph if nothing provided
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

  ngAfterViewInit() {
    const el = this.graphHost?.nativeElement;
    if (el && 'ResizeObserver' in window) {
      let lastW = 0,
        lastH = 0;

      const resize = () => {
        let w = el.clientWidth || el.parentElement?.clientWidth || 900;
        // IMPORTANT: clamp height to CSS (prevents infinite page growth)
        const h = el.clientHeight > 0 ? el.clientHeight : 640;

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

    // Ensure the DOM / SVG exists before first compute
    setTimeout(() => {
      this.ready.set(true);
      this.recomputeGraph(); // compute once view is mounted
      this.emitChange();
      this.nudgeGraph();
    });
  }

  ngOnDestroy() {
    this.ro?.disconnect();
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

  // ---------- Palette / Drop ----------

  onDrop(ev: any) {
    if (this.disabled()) return;
    const action = ev.item?.data as ActionDefinition | undefined;
    if (!action) return;

    const type = action.type as AiActionType;
    const node: WorkflowNode = {
      id: this.uid(),
      type: 'action',
      x: 0,
      y: 0,
      data: {
        label: ACTION_LABEL[type] ?? this.titleize(type),
        params: { ...(action.params ?? {}) },
        aiType: type, // tag it for the inspector
      } as ActionNodeData,
      // Keep ports consistent for all actions (easy to wire graphs)
      ports: {
        inputs: [{ id: 'in', label: 'in', type: 'json' }],
        outputs: [{ id: 'out', label: 'out', type: 'json' }],
      },
    };

    this.nodes = [...this.nodes, node];
    this.recomputeGraph();
    this.emitChange();
  }

  // ---------- Node/Edge handlers ----------

  // Simple 1-handle per side support (kept for completeness)
  clickHandle(nodeId: string, kind: 'source' | 'target', e: MouseEvent) {
    e.stopPropagation();
    if (this.disabled()) return;

    if (kind === 'source') {
      this.pendingSource.set(nodeId);
      return;
    }
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
          } as any,
        ];
        this.recomputeGraph();
        this.emitChange();
      }
    }
    this.pendingSource.set(null);
  }

  // Port-aware connect
  clickPort(nodeId: string, kind: 'source' | 'target', portId: string, e: MouseEvent) {
    e.stopPropagation();
    if (this.disabled()) return;

    if (kind === 'source') {
      this.pending.set({ nodeId, portId });
      return;
    }

    const from = this.pending();
    if (from && (from.nodeId !== nodeId || from.portId !== portId)) {
      const id = `${from.nodeId}:${from.portId} -> ${nodeId}:${portId}`;
      if (!this.edges.some((e) => e.id === id)) {
        if (!this.arePortsCompatible(from.nodeId, from.portId, nodeId, portId)) {
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

  onNodeSelected(e: any) {
    const nodeId: string = e?.id;
    const n = this.nodes.find((nn) => nn.id === nodeId);
    if (!n) return;

    this.selectedNode.set(n);
    this.inspectorConfig = this.buildConfigFor(undefined);

    this.inspectorForm = this.fb.group({});
    setTimeout(() => {
      const params = (n.data as any)?.params;
      if (params) this.inspectorForm.patchValue(params);
    });
  }

  private buildConfigFor(_ignored: string | undefined): FieldConfig[] {
    const sel = this.selectedNode();
    const aiType = (sel?.data as ActionNodeData).aiType;

    switch (aiType) {
      case 'chat-basic':
        return [
          this.fields.getTextAreaField({
            name: 'prompt',
            label: 'Prompt',
            placeholder: 'Ask anything…',
            rows: 6,
            validators: [Validators.required],
          }),
        ];

      case 'chat-on-file': {
        const filesField = this.fields.getFileField({
          name: 'files',
          label: 'form.labels.files',
          multiple: true,
          accept: '.pdf,.docx,image/*',
          maxFiles: 10,
          maxTotalSize: 50 * 1024 * 1024, // 50 MB total
          required: true,
          validators: [Validators.required],
        });

        return [
          this.fields.getTextAreaField({
            name: 'prompt',
            label: 'Prompt',
            placeholder: 'Ask about the uploaded document(s)…',
            rows: 5,
            validators: [Validators.required],
          }),
          filesField as FieldConfig,
        ].filter(Boolean) as FieldConfig[];
      }

      case 'compare': {
        const left = this.fields.getFileField({
          name: 'files',
          label: 'form.labels.files',
          multiple: false,
          accept: '.pdf,.docx,image/*',
          maxTotalSize: 50 * 1024 * 1024, // 50 MB total
          required: true,
          validators: [Validators.required],
        });

        const right = this.fields.getFileField({
          name: 'files',
          label: 'form.labels.files',
          multiple: false,
          accept: '.pdf,.docx,image/*',
          maxTotalSize: 50 * 1024 * 1024, // 50 MB total
          required: true,
          validators: [Validators.required],
        });

        return [left, right].filter(Boolean) as FieldConfig[];
      }

      case 'summarize': {
        const single = this.fields.getFileField({
          name: 'files',
          label: 'form.labels.files',
          multiple: false,
          accept: '.pdf,.docx,image/*',
          maxTotalSize: 50 * 1024 * 1024, // 50 MB total
          required: true,
          validators: [Validators.required],
        });

        return [single].filter(Boolean) as FieldConfig[];
      }

      case 'extract':
        return [
          this.fields.getTextAreaField({
            name: 'text',
            label: 'Text (optional)',
            placeholder: 'Paste the text to analyze…',
            rows: 6,
          }),
          this.fields.getTextField({
            name: 'entities',
            label: 'Entities (comma separated)',
            placeholder: 'person, location, organization',
            validators: [Validators.required],
          }),
        ];

      default:
        // fallback: show params JSON for unknown action types
        return [
          this.fields.getTextAreaField({
            name: 'params',
            label: 'Params (JSON)',
            rows: 8,
          }),
        ];
    }
  }

  onEdgeSelected(_: any) {}

  closeInspector() {
    this.selectedNode.set(null);
  }

  applyInspector() {
    const node = this.selectedNode();
    if (!node) return;

    const params = this.inspectorForm.getRawValue();
    const aiType = (node.data as any)?.aiType as AiActionType | undefined;

    // Enforce your file-count rules
    switch (aiType) {
      case 'chat-on-file':
        if (!params?.files || (Array.isArray(params.files) && params.files.length < 1)) {
          // TODO: show a toast/snackbar in your UX
          return;
        }
        break;
      case 'compare':
        if (!params?.leftFile || !params?.rightFile) return;
        break;
      case 'summarize':
        if (!params?.file) return;
        break;
      case 'extract':
        if (!params?.entities) return;
        break;
    }

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

  // ---------- Context menu ----------

  openContextMenu(e: MouseEvent) {
    e.preventDefault();
    const hit = this.pickHit(e);
    if (!hit) return this.contextMenu.set(null);
    this.contextMenu.set({ ...hit, x: e.clientX, y: e.clientY });
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

  private pickHit(e: MouseEvent): { type: 'node' | 'edge'; id: string } | null {
    const el = (e.target as HTMLElement)?.closest?.('[ngx-graph-node],[ngx-graph-link]');
    if (!el) return null;
    const nodeId = el.getAttribute('ng-reflect-node-id') || el.getAttribute('node-id');
    const linkId = el.getAttribute('ng-reflect-link-id') || el.getAttribute('link-id');
    if (nodeId) return { type: 'node', id: nodeId };
    if (linkId) return { type: 'edge', id: linkId };
    return null;
  }

  // ---------- Graph projection ----------

  private recomputeGraph() {
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

  // ---------- Helpers ----------

  private arePortsCompatible(
    srcNodeId: string,
    srcPortId: string,
    tgtNodeId: string,
    tgtPortId: string,
  ): boolean {
    const nSrc = this.nodes.find((n) => n.id === srcNodeId) as WorkflowNode | undefined;
    const nTgt = this.nodes.find((n) => n.id === tgtNodeId) as WorkflowNode | undefined;
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

  // --- Field builders with safe fallbacks (keeps TS happy) ---
  private F() {
    return this.fields;
  }

  private uid(): string {
    return crypto?.randomUUID?.() ?? 'id-' + Math.random().toString(36).slice(2, 9);
  }
}
