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
        defaultValue: 0.3,
      })!,
    ],
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
        defaultValue: 'bullets',
      }),
    ],
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
        defaultValue: 'json',
      }),
    ],
  },
  jira: {
    make: (F) => [
      F.getTextField({
        name: 'site',
        label: 'Jira site (cloud)',
        placeholder: 'your-domain.atlassian.net',
        validators: [Validators.required],
        errorMessages: { required: 'Enter your Jira site' },
        helperText: 'Cloud domain without protocol.',
      }),
      F.getTextField({
        name: 'email',
        label: 'Account email',
        placeholder: 'you@example.com',
        validators: [Validators.required, Validators.email],
        errorMessages: { required: 'Email required', email: 'Invalid email' },
      }),
      F.getPasswordField?.({
        name: 'apiToken',
        label: 'API token',
        placeholder: '************************',
        validators: [Validators.required],
        errorMessages: { required: 'API token required' },
        helperText: 'Create a token in https://id.atlassian.com/manage-profile/security/api-tokens',
      })!,

      F.getTextField({
        name: 'projectKey',
        label: 'Project key',
        placeholder: 'ABC',
        validators: [Validators.required],
        errorMessages: { required: 'Project key required' },
      }),
      F.getDropdownField({
        name: 'issueType',
        label: 'Issue type',
        options: [
          { label: 'Task', value: 'Task' },
          { label: 'Bug', value: 'Bug' },
          { label: 'Story', value: 'Story' },
          { label: 'Epic', value: 'Epic' },
        ],
        required: true,
        validators: [Validators.required],
        errorMessages: { required: 'Choose an issue type' },
        defaultValue: 'Task',
      }),
      F.getTextField({
        name: 'summary',
        label: 'Summary',
        placeholder: 'Short title…',
        validators: [Validators.required, Validators.maxLength(255)],
        errorMessages: { required: 'Summary required', maxLength: 'Max 255 chars' },
      }),
      F.getTextAreaField({
        name: 'description',
        label: 'Description',
        placeholder: 'Describe the issue…',
        rows: 6,
      }),
      F.getTextField({
        name: 'assignee',
        label: 'Assignee (accountId or email)',
        placeholder: 'user@example.com',
        helperText: 'Use email',
        validators: [Validators.required, Validators.email],
        errorMessages: { required: 'Email required', email: 'Invalid email' },
      }),
      F.getDropdownField({
        name: 'priority',
        label: 'Priority',
        options: [
          { label: 'Highest', value: 'Highest' },
          { label: 'High', value: 'High' },
          { label: 'Medium', value: 'Medium' },
          { label: 'Low', value: 'Low' },
          { label: 'Lowest', value: 'Lowest' },
        ],
        helperText: 'Choose the priority that you want',
        defaultValue: 'Medium',
      }),
    ],
    defaults: {
      issueType: 'Task',
      priority: 'Medium',
    },
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
