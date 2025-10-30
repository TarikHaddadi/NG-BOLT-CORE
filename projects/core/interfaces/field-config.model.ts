import { ValidatorFn } from '@angular/forms';
import { ThemePalette } from '@angular/material/core';

export type FieldType =
  | 'text'
  | 'email'
  | 'phone'
  | 'password'
  | 'toggle'
  | 'dropdown'
  | 'range'
  | 'group'
  | 'array'
  | 'datepicker'
  | 'chips'
  | 'file'
  | 'autocomplete'
  | 'textarea';

export interface FieldComponent<T = unknown> {
  field: FieldConfig;
  control: import('@angular/forms').AbstractControl<T>;
}

export type FileVariant = 'input' | 'dropzone' | 'both';
export interface FileVM {
  key: string;
  name: string;
  size?: number;
  ext?: string;
  mime?: string;
}

export interface FieldConfig {
  type: FieldType;
  name: string;
  label?: string;
  placeholder?: string;
  required?: boolean;
  helperText?: string;
  options?: { label: string; value: string | number }[];
  min?: number;
  max?: number;
  step?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  validators?: ValidatorFn[];
  disabled?: boolean;
  hidden?: boolean;
  children?: FieldConfig[];
  multiple?: boolean;
  errorMessages?: Record<string, string>;
  layoutClass?: 'primary' | 'accent' | 'warn' | 'neutral' | 'success' | string;
  defaultValue?: string | number | boolean | File | File[] | string[]; // for text/email/phone/password, etc.
  chipOptions?: string[];
  autocompleteOptions?: string[];
  toggleIcons?: {
    on: string;
    off: string;
    position?: 'start' | 'end';
  };
  color?: ThemePalette;
  rows?: number;
  maxRows?: number;
  autoResize?: boolean;
  showCounter?: boolean;
  accept?: string;
  maxFiles?: number;
  maxFileSize?: number;
  maxTotalSize?: number;
  fileVariant?: FileVariant;
}
