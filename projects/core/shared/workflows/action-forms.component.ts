import { Validators } from '@angular/forms';

import { FieldConfig } from '@cadai/pxs-ng-core/interfaces';
import { FieldConfigService } from '@cadai/pxs-ng-core/services';

export type ActionFormFactory = (f: FieldConfigService) => FieldConfig[];

export interface ActionFormSpec {
  make: ActionFormFactory;
  defaults?: Record<string, unknown>;
}

/** Registry mapping AiActionType -> inspector form fields and defaults. */
export const ACTION_FORMS: Record<string, ActionFormSpec> = {
  'chat-basic': {
    make: (F) => [
      F.getTextAreaField({
        name: 'prompt',
        label: 'Prompt',
        placeholder: 'Ask anything…',
        rows: 6,
        validators: [Validators.required],
      }),
      F.getDropdownField?.({
        name: 'temperature',
        label: 'Temperature',
        options: [
          { label: '0 – Deterministic', value: 0 },
          { label: '0.3', value: 0.3 },
          { label: '0.7', value: 0.7 },
          { label: '1.0 – Creative', value: 1 },
        ],
      })!,
    ],
    defaults: { temperature: 0.3 },
  },

  'chat-on-file': {
    make: (F) => [
      F.getTextAreaField({
        name: 'prompt',
        label: 'Prompt',
        placeholder: 'Ask about the uploaded document(s)…',
        rows: 5,
        validators: [Validators.required],
      }),
      F.getFileField({
        name: 'files',
        label: 'form.labels.files',
        multiple: true,
        accept: '.pdf,.docx,image/*',
        maxFiles: 10,
        maxTotalSize: 50 * 1024 * 1024,
        required: true,
        validators: [Validators.required],
      }),
    ],
  },

  compare: {
    make: (F) => [
      F.getFileField({
        name: 'leftFile',
        label: 'Left file',
        multiple: false,
        accept: '.pdf,.docx,image/*',
        maxTotalSize: 50 * 1024 * 1024,
        required: true,
        validators: [Validators.required],
      }),
      F.getFileField({
        name: 'rightFile',
        label: 'Right file',
        multiple: false,
        accept: '.pdf,.docx,image/*',
        maxTotalSize: 50 * 1024 * 1024,
        required: true,
        validators: [Validators.required],
      }),
    ],
  },

  summarize: {
    make: (F) => [
      F.getFileField({
        name: 'file',
        label: 'File',
        multiple: false,
        accept: '.pdf,.docx,image/*',
        maxTotalSize: 50 * 1024 * 1024,
        required: true,
        validators: [Validators.required],
      }),
      F.getDropdownField({
        name: 'length',
        label: 'Summary length',
        options: [
          { label: 'Key bullets', value: 'bullets' },
          { label: 'Short (1–2 paragraphs)', value: 'short' },
          { label: 'Detailed (4–6 paragraphs)', value: 'detailed' },
        ],
      }),
    ],
    defaults: { length: 'bullets' },
  },

  extract: {
    make: (F) => [
      F.getTextAreaField({
        name: 'text',
        label: 'Text (optional)',
        placeholder: 'Paste the text to analyze…',
        rows: 6,
      }),
      F.getTextField({
        name: 'entities',
        label: 'Entities (comma separated)',
        placeholder: 'person, location, organization',
        validators: [Validators.required],
      }),
      F.getDropdownField({
        name: 'format',
        label: 'Return format',
        options: [
          { label: 'JSON', value: 'json' },
          { label: 'CSV', value: 'csv' },
        ],
      }),
    ],
    defaults: { format: 'json' },
  },
};

/** Fallback for unknown action types */
export function makeFallback(F: FieldConfigService): FieldConfig[] {
  return [
    F.getTextAreaField({
      name: 'params',
      label: 'Params (JSON)',
      rows: 8,
    }),
  ];
}
