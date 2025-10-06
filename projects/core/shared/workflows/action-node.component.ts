import { Component } from '@angular/core';
import {
  DfConnectorPosition,
  DfInputComponent,
  DfOutputComponent,
  DrawFlowBaseNode,
} from '@ng-draw-flow/core';

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
const normalizeVisualType = (t: PaletteType): WorkflowNodeType =>
  t === 'input' ? 'input' : t === 'result' ? 'result' : 'action';

@Component({
  selector: 'wf-node',
  standalone: true,
  imports: [DfInputComponent, DfOutputComponent],
  template: `
    <div
      class="wf-node"
      [attr.data-node-id]="nodeId"
      [class.input]="visualType() === 'input'"
      [class.result]="visualType() === 'result'"
      [class.action]="visualType() === 'action'"
    >
      <div class="title">{{ displayLabel() }}</div>

      <div class="ports left">
        @for (p of inPorts(); track p.id) {
          <df-input
            class="input"
            [position]="positions.Left"
            [connectorData]="{ nodeId: nodeId, connectorId: p.id, single: true }"
          >
          </df-input>
        }
      </div>

      <div class="ports right">
        @for (p of outPorts(); track p.id) {
          <df-output
            class="output"
            [position]="positions.Right"
            [connectorData]="{ nodeId: nodeId, connectorId: p.id, single: false }"
          >
          </df-output>
        }
      </div>
    </div>
  `,
  styles: [
    `
      .wf-node {
        /* connector colors (docs: --df-connector-color / hover) */
        --df-connector-color: #ffffff;
        --df-connector-color-hover: #ffe066;

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

      .wf-node.is-selected {
        outline: 2px solid #42a5f5;
        outline-offset: 2px;
      }

      .title {
        font-weight: 600;
        margin-bottom: 4px;
      }

      /* Connector rails */
      .ports.left,
      .ports.right {
        position: absolute;
        top: 10px;
        bottom: 10px;
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      .ports.left {
        left: -8px;
      }
      .ports.right {
        right: -8px;
      }
    `,
  ],
})
export class WfNodeComponent extends DrawFlowBaseNode {
  positions = DfConnectorPosition;
  private get safeModel(): NodeModelShape {
    const m = this.model;
    if (isNodeModelShape(m)) return m;
    return {
      type: 'chat-basic',
      aiType: 'chat-basic',
      label: 'Action',
      ports: { inputs: [], outputs: [] },
    };
  }

  visualType(): WorkflowNodeType {
    return normalizeVisualType(this.safeModel.type);
  }
  displayLabel(): string {
    const explicit = (this.safeModel as { label?: unknown }).label;
    if (typeof explicit === 'string' && explicit.trim()) return explicit;
    const t = this.safeModel.type;
    if (t === 'input' || t === 'result') return t.charAt(0).toUpperCase() + t.slice(1);
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
}
