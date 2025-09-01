import { TemplateRef } from '@angular/core';

export interface ConfirmDialogData<TContext = unknown> {
  title?: string;
  message?: string;

  // Optional custom content/actions
  contentTpl?: TemplateRef<any>;
  actionsTpl?: TemplateRef<any>;
  context?: TContext;

  // Button labels
  confirmText?: string;
  cancelText?: string;

  // Optional: compute a value to return on confirm
  getResult?: () => SwitchersResult;
}

export interface SwitchersResult {
  theme: boolean;
  lang: string;
  scope: string;
  key: string;
  value: string;
}
