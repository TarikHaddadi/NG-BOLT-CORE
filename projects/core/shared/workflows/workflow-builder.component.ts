import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { v4 as uuidv4 } from 'uuid';

import { ActionDefinition, WorkflowEdge, WorkflowNode } from '@cadai/pxs-ng-core/interfaces';

import { WorkflowCanvasComponent } from './workflow-canvas.component';

@Component({
  selector: 'app-workflow-builder',
  standalone: true,
  imports: [CommonModule, FormsModule, WorkflowCanvasComponent],
  template: `
    <div class="page">
      <div class="header">
        <h2>GenAI | {{ editingId() ? 'Edit Workflow' : 'New Workflow' }}</h2>
        <button class="btn outline" (click)="goBack()">Back to Workflows</button>
      </div>

      <div class="card">
        <label>Workflow Name</label>
        <input [(ngModel)]="name" placeholder="Enter workflow name" required />
      </div>

      <div class="card">
        <app-workflow-canvas
          [nodes]="nodes()"
          [edges]="edges()"
          [disabled]="disabled"
          [availableActions]="availableActions"
          (change)="onCanvasChange($event)"
          (validityChange)="isValid.set($event)"
        >
        </app-workflow-canvas>
      </div>

      <div class="footer">
        <button
          class="btn primary"
          [disabled]="!name.trim() || saving() || !isValid()"
          (click)="save()"
        >
          {{ saving() ? 'Saving…' : 'Save Workflow' }}
        </button>
      </div>
    </div>
  `,
  styles: [
    `
      .page {
        display: flex;
        flex-direction: column;
        gap: 1rem;
      }
      .header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 0.75rem 0;
        border-bottom: 1px solid #e0e0e0;
      }
      .card {
        padding: 1rem;
        border: 1px solid #e0e0e0;
        border-radius: 10px;
        background: #fff;
      }
      .card > label {
        display: block;
        margin-bottom: 0.4rem;
        font-weight: 600;
      }
      .card > input {
        width: 100%;
        padding: 0.45rem 0.6rem;
        border: 1px solid #ddd;
        border-radius: 8px;
      }
      .footer {
        display: flex;
        justify-content: flex-end;
      }
      .btn {
        padding: 0.5rem 0.9rem;
        border-radius: 8px;
        border: 1px solid #c8c8c8;
        background: #fff;
        cursor: pointer;
      }
      .btn.primary {
        background: #1976d2;
        color: #fff;
        border-color: #1976d2;
      }
      .btn.outline {
        background: transparent;
      }
      .btn:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WorkflowBuilderComponent {
  // mock routing state / id
  editingId = signal<string | null>(null);

  name = '';
  nodes = signal<WorkflowNode[]>([]);
  edges = signal<WorkflowEdge[]>([]);
  isValid = signal(false);
  saving = signal(false);

  // inject from API service in Host; here we expose signals for Core demo
  availableActions = signal<ActionDefinition[]>([
    { type: 'fetch', params: { url: '', method: 'GET' } },
    { type: 'transform', params: { script: '' } },
    { type: 'store', params: { collection: '' } },
  ]);

  disabled = signal<boolean>(false);

  onCanvasChange(e: { nodes: WorkflowNode[]; edges: WorkflowEdge[] }) {
    this.nodes.set(e.nodes);
    this.edges.set(e.edges);
  }

  async save() {
    try {
      this.saving.set(true);
      // strip ephemeral flags if any
      const cleanedNodes = this.nodes().map((n) => ({ ...n }));
      const dto = {
        id: this.editingId() ?? uuidv4(),
        name: this.name,
        nodes: cleanedNodes,
        edges: this.edges(),
      };
      // call Host API; here just console
      console.log('SAVE', dto);
      // success UX is Host responsibility (toast/router)
    } finally {
      this.saving.set(false);
    }
  }

  goBack() {
    // Delegate to Host router
    console.log('Navigate back');
  }
}
