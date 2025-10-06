import { Component } from '@angular/core';
import { DfInputComponent, DfOutputComponent, DrawFlowBaseNode } from '@ng-draw-flow/core';

import {
  InspectorActionType,
  NodeModelShape,
  PaletteType,
  WorkflowNodeType,
  WorkflowPorts,
} from '@cadai/pxs-ng-core/interfaces';

function isNodeModelShape(x: unknown): x is NodeModelShape {
  if (typeof x !== 'object' || x === null) return false;
  const t = (x as { type?: unknown }).type;
  const allowed: ReadonlyArray<PaletteType> = [
    'input',
    'result',
    'chat-basic',
    'chat-on-file',
    'compare',
    'summarize',
    'extract',
  ];
  if (!allowed.includes(t as PaletteType)) return false;

  const ports = (x as { ports?: unknown }).ports;
  if (ports === undefined) return true;
  if (typeof ports !== 'object' || ports === null) return false;
  const ins = (ports as { inputs?: unknown }).inputs;
  const outs = (ports as { outputs?: unknown }).outputs;
  return (ins === undefined || Array.isArray(ins)) && (outs === undefined || Array.isArray(outs));
}

function normalizeVisualType(t: PaletteType): WorkflowNodeType {
  if (t === 'input') return 'input';
  if (t === 'result') return 'result';
  return 'action';
}

@Component({
  selector: 'wf-node',
  standalone: true,
  imports: [DfInputComponent, DfOutputComponent],
  template: `
    <div
      class="wf-node"
      [class.input]="visualType() === 'input'"
      [class.result]="visualType() === 'result'"
      [class.action]="visualType() === 'action'"
    >
      <div class="title">{{ label() }}</div>

      <!-- Left side inputs -->
      <div class="ports left">
        <df-input
          *ngFor="let p of inPorts(); trackBy: trackPort"
          class="input"
          [connectorData]="{ nodeId: nodeId, connectorId: p.id, single: true }"
        >
        </df-input>
      </div>

      <!-- Right side outputs -->
      <div class="ports right">
        <df-output
          *ngFor="let p of outPorts(); trackBy: trackPort"
          class="output"
          [connectorData]="{ nodeId: nodeId, connectorId: p.id, single: false }"
        >
        </df-output>
      </div>
    </div>
  `,
  styles: [
    `
      .wf-node {
        min-width: 220px;
        border-radius: 8px;
        padding: 8px 12px;
        color: #fff;
        position: relative;
        user-select: none;
      }
      .wf-node.input {
        background: var(--mat-success, #2e7d32);
      }
      .wf-node.result {
        background: var(--mat-accent, #7b1fa2);
      }
      .wf-node.action {
        background: var(--mat-primary, #1976d2);
      }
      .title {
        font-weight: 600;
        margin-bottom: 4px;
      }

      /* Connector placement is CSS-based */
      .ports.left,
      .ports.right {
        position: absolute;
        top: 10px;
        bottom: 10px;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .ports.left {
        left: -8px;
      }
      .ports.right {
        right: -8px;
      }
      .input,
      .output {
        position: relative;
        z-index: 1;
      }
    `,
  ],
})
export class WfNodeComponent extends DrawFlowBaseNode {
  /** Safe view of the incoming model (do not override `model` itself). */
  private get safeModel(): NodeModelShape {
    const m = this.model;
    if (isNodeModelShape(m)) return m;

    // ✅ Fallback must use a valid PaletteType (not 'action' literal)
    const fallback: NodeModelShape = {
      type: 'chat-basic', // pick any default inspector type
      aiType: 'chat-basic', // keep it explicit if you use aiType elsewhere
      label: 'Action',
      ports: { inputs: [], outputs: [] },
    };
    return fallback;
  }

  /** Visual class/type the component uses for styling/layout. */
  visualType(): WorkflowNodeType {
    return normalizeVisualType(this.safeModel.type);
  }

  /** Title: prefer explicit label, else a readable label from type/aiType. */
  displayLabel(): string {
    const explicit = (this.safeModel as { label?: unknown }).label;
    if (typeof explicit === 'string' && explicit.trim()) return explicit;

    const t = this.safeModel.type;
    if (t === 'input' || t === 'result') return t.charAt(0).toUpperCase() + t.slice(1);

    // inspector types → nicer defaults
    const nice: Record<InspectorActionType, string> = {
      'chat-basic': 'Chat',
      'chat-on-file': 'Chat on File',
      compare: 'Compare',
      summarize: 'Summarize',
      extract: 'Extract',
    };
    return nice[t] ?? 'Action';
  }

  inPorts(): WorkflowPorts['inputs'] {
    return this.safeModel.ports?.inputs ?? [];
  }
  outPorts(): WorkflowPorts['outputs'] {
    return this.safeModel.ports?.outputs ?? [];
  }
  trackPort(_: number, p: { id: string }): string {
    return p.id;
  }

  label(): string {
    const l = (this.safeModel as { label?: unknown }).label;
    return typeof l === 'string' && l.trim().length ? l : this.safeModel.type;
  }
}
