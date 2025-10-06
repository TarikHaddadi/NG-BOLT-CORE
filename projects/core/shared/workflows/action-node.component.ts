import { Component } from '@angular/core';
import { DfInputComponent, DfOutputComponent,DrawFlowBaseNode } from '@ng-draw-flow/core';

import { NodeModelShape, WorkflowNodeType,WorkflowPorts } from '@cadai/pxs-ng-core/interfaces';

function isNodeModelShape(x: unknown): x is NodeModelShape {
  if (typeof x !== 'object' || x === null) return false;
  const t = (x as { type?: unknown }).type;
  if (t !== 'input' && t !== 'action' && t !== 'result') return false;
  const ports = (x as { ports?: unknown }).ports;
  if (ports === undefined) return true;
  if (typeof ports !== 'object' || ports === null) return false;
  const inp = (ports as { inputs?: unknown }).inputs;
  const out = (ports as { outputs?: unknown }).outputs;
  return (inp === undefined || Array.isArray(inp)) && (out === undefined || Array.isArray(out));
}

@Component({
  selector: 'wf-node',
  standalone: true,
  imports: [DfInputComponent, DfOutputComponent],
  template: `
    <div
      class="wf-node"
      [class.input]="type() === 'input'"
      [class.result]="type() === 'result'"
      [class.action]="type() === 'action'"
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
  /** Safely view the incoming model (provided by DrawFlowBaseNode) with strict typing. */
  private get safeModel(): NodeModelShape {
    const m = this.model; // inherited — do not redeclare/override
    if (isNodeModelShape(m)) return m;
    return { type: 'action', label: 'Action', ports: { inputs: [], outputs: [] } };
  }

  // Helpers used by the template
  type(): WorkflowNodeType {
    return this.safeModel.type;
  }

  label(): string {
    const l = (this.safeModel as { label?: unknown }).label;
    return typeof l === 'string' && l.trim().length ? l : this.safeModel.type;
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
}
