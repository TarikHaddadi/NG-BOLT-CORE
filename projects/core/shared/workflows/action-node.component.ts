import { Component, ElementRef, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import {
  DfConnectorPosition,
  DfInputComponent,
  DfOutputComponent,
  DrawFlowBaseNode,
} from '@ng-draw-flow/core';
import { TranslateModule } from '@ngx-translate/core';

import {
  InspectorActionType,
  NodeModelShape,
  PaletteType,
  WorkflowPorts,
} from '@cadai/pxs-ng-core/interfaces';

import { WfCanvasBus } from './wf-canvas-bus';

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
    'jira',
  ];
  if (!allowed.includes(t as PaletteType)) return false;
  const ports = (x as { ports?: unknown }).ports;
  if (ports === undefined) return true;
  if (typeof ports !== 'object' || ports === null) return false;
  const ins = (ports as { inputs?: unknown }).inputs;
  const outs = (ports as { outputs?: unknown }).outputs;
  return (ins === undefined || Array.isArray(ins)) && (outs === undefined || Array.isArray(outs));
}

@Component({
  selector: 'wf-node',
  standalone: true,
  imports: [DfInputComponent, DfOutputComponent, MatButtonModule, MatIconModule, TranslateModule],
  template: `
    <div
      class="wf-node"
      [attr.data-node-id]="nodeId"
      [class.input]="visualType() === 'input'"
      [class.result]="visualType() === 'result'"
      [class.action]="visualType() !== 'input' && visualType() !== 'result'"
    >
      @if (visualType() === 'input') {
        <button
          mat-mini-fab
          class="primary"
          color="neutral"
          aria-label="start"
          matTooltip="play workflow"
          (click)="(null)"
        >
          <mat-icon>play_arrow</mat-icon>
        </button>
      } @else if (visualType() === 'result') {
        <button
          mat-mini-fab
          class="primary"
          color="neutral"
          aria-label="start"
          matTooltip="Go to results"
          (click)="(null)"
        >
          <mat-icon>forward</mat-icon>
        </button>
      } @else {
        <div class="title">{{ displayLabel() | translate }}</div>
      }
      <!-- Inputs (left) -->
      <div class="ports left">
        @for (p of inPorts(); track p.id) {
          <df-input
            [position]="positions.Left"
            [connectorData]="{ nodeId: nodeId, connectorId: p.id, single: false }"
          >
          </df-input>
        }
      </div>

      <!-- Outputs (right) -->
      <div class="ports right">
        @for (p of outPorts(); track p.id) {
          <df-output
            [position]="positions.Right"
            [connectorData]="{ nodeId: nodeId, connectorId: p.id, single: false }"
          >
          </df-output>
        }
      </div>

      @if (visualType() !== 'result' && visualType() !== 'input') {
        <button
          mat-mini-fab
          color="neutral"
          class="neutral"
          aria-label="configure"
          (click)="onMenuClick($event)"
        >
          <mat-icon>menu</mat-icon>
        </button>
      }
    </div>
  `,
  styles: [
    `
      .wf-node {
        /* connector colors (docs: --df-connector-color / hover) */
        --df-connector-color: var(--mat-accent);
        --df-connector-color-hover: #ffe066;
        min-height: 36px;
        min-width: 220px;
        border-radius: 8px;
        padding: 8px 12px;
        color: #fff;
        position: relative;
        user-select: none;
      }
      .wf-node.input {
        background: var(--mat-success, #2e7d32);
        display: flex;
        align-items: center;
        justify-content: space-between;
        min-width: 40px;
      }
      .wf-node.result {
        background: var(--mat-accent, #7b1fa2);
        display: flex;
        align-items: center;
        justify-content: space-between;
        min-width: 40px;
      }
      .wf-node.action {
        background: var(--mat-primary, #1976d2);
        display: flex;
        align-items: center;
        justify-content: space-between;
      }

      .wf-node.is-selected {
        outline: 2px solid #42a5f5;
        outline-offset: 2px;
      }

      .title {
        font-weight: 600;
        margin-bottom: 4px;
        color: var(--mdc-filled-button-label-text-color, #fff);
      }

      /* Connector rails */
      .ports.left,
      .ports.right {
        position: absolute;
        top: 17px;
        bottom: 10px;
        display: flex;
        flex-direction: column;
        gap: 10px;
        height: 15px;
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
  private bus = inject(WfCanvasBus);
  private host = inject(ElementRef<HTMLElement>);
  positions = DfConnectorPosition;
  private get safeModel(): NodeModelShape {
    return this.model && isNodeModelShape(this.model) ? this.model : { type: 'input' };
  }

  visualType(): PaletteType {
    const t = this.safeModel.type as PaletteType;
    return t;
  }

  displayLabel(): string {
    const t = this.safeModel.type?.toLowerCase();
    if (t === 'input' || t === 'result') return t.charAt(0).toUpperCase() + t.slice(1);
    const nice: Record<InspectorActionType, string> = {
      'chat-basic': 'chat-basic',
      'chat-on-file': 'chat-on-file',
      compare: 'compare',
      summarize: 'summarize',
      extract: 'extract',
      jira: 'jira',
    };
    return nice[t as InspectorActionType];
  }
  inPorts(): WorkflowPorts['inputs'] {
    return this.safeModel.ports?.inputs ?? [];
  }
  outPorts(): WorkflowPorts['outputs'] {
    return this.safeModel.ports?.outputs ?? [];
  }
  onMenuClick(ev: MouseEvent): void {
    ev.stopPropagation(); // don’t toggle selection
    this.bus.openMenu$.next({
      nodeId: this.nodeId,
      clientX: ev.clientX,
      clientY: ev.clientY,
    });
  }
}
