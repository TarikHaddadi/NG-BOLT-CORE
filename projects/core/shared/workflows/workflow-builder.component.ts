import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, signal } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { TranslateModule } from '@ngx-translate/core';
import { v4 as uuidv4 } from 'uuid';

import {
  ActionDefinition,
  FieldConfig,
  WorkflowEdge,
  WorkflowNode,
} from '@cadai/pxs-ng-core/interfaces';
import { FieldConfigService, LayoutService } from '@cadai/pxs-ng-core/services';

import { DynamicFormComponent } from '../public-api';
import { SeoComponent } from '../seo/seo.component';
import { WorkflowCanvasComponent } from './workflow-canvas.component';

@Component({
  selector: 'app-workflow-builder',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    WorkflowCanvasComponent,
    SeoComponent,
    TranslateModule,
    DynamicFormComponent,
    ReactiveFormsModule,
    MatButtonModule,
  ],
  template: `
    <app-seo
      [pageTitle]="'nav.genai-workflows' | translate"
      [description]="'This is the workflow builder of the AI product app.'"
      [keywords]="'workflows, workflow builder, ai'"
      (titleChange)="onTitleChange($event)"
    >
    </app-seo>

    <div class="card">
      <app-dynamic-form [config]="fieldConfig" [form]="form"></app-dynamic-form>
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
        mat-raised-button
        [disabled]="form.invalid || saving() || !isValid()"
        (click)="save()"
      >
        {{ saving() ? 'Saving…' : ('SAVE' | translate) }}
      </button>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WorkflowBuilderComponent implements OnInit {
  public form!: FormGroup;
  public fieldConfig: FieldConfig[] = [];

  // mock routing state / id
  editingId = signal<string | null>(null);

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

  constructor(
    private fb: FormBuilder,
    private layoutService: LayoutService,
    private fieldsConfigService: FieldConfigService,
  ) {}
  public onTitleChange(title: string): void {
    this.layoutService.setTitle(title);
  }

  ngOnInit(): void {
    this.form = this.fb.group({});
    this.fieldConfig = [
      this.fieldsConfigService.getTextField({
        name: 'name',
        label: 'form.labels.name',
        placeholder: 'form.placeholders.name',
        validators: [Validators.required, Validators.minLength(2), Validators.maxLength(80)],
        errorMessages: { required: 'form.errors.name.required' },
        color: 'primary',
        layoutClass: 'primary',
      }),
    ];
  }

  onCanvasChange(e: { nodes: WorkflowNode[]; edges: WorkflowEdge[] }) {
    this.nodes.set(e.nodes);
    this.edges.set(e.edges);
  }

  async save() {
    try {
      const raw = this.form.getRawValue();

      this.saving.set(true);
      // strip ephemeral flags if any
      const cleanedNodes = this.nodes().map((n) => ({ ...n }));
      const dto = {
        id: this.editingId() ?? uuidv4(),
        name: raw.name,
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
