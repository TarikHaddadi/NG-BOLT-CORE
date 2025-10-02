import { CommonModule } from '@angular/common';
import { Component, ElementRef, Input, ViewChild } from '@angular/core';
import {
  AbstractControl,
  FormControl,
  ReactiveFormsModule,
  ValidationErrors,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { FieldConfig } from '@cadai/pxs-ng-core/interfaces';
import { isFile, isString } from '@cadai/pxs-ng-core/utils';

type FileControlValue = File | File[] | string[] | null;

@Component({
  selector: 'app-input-file',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    TranslateModule,
  ],
  template: `
    <mat-form-field
      appearance="outline"
      [class]="field.layoutClass?.concat(' w-full') || 'w-full'"
      floatLabel="always"
      [color]="field.color || 'primary'"
    >
      <mat-label>{{ field.label | translate }}</mat-label>

      <!-- Display-only control showing a summary -->
      <input
        matInput
        [id]="field.name"
        [value]="displayValue"
        [readonly]="true"
        [placeholder]="field.placeholder || '' | translate"
        (blur)="fc.markAsTouched()"
        [attr.aria-label]="field.label | translate"
        [attr.aria-describedby]="ariaDescribedBy"
        [attr.aria-invalid]="fc.invalid || null"
        [attr.aria-required]="field.required || null"
      />

      <button mat-button matSuffix type="button" (click)="openPicker()">
        {{ 'form.actions.browse' | translate: emptyParams }}
      </button>

      <!-- Hidden native file input -->
      <input
        #fileInput
        type="file"
        class="sr-only"
        [attr.accept]="acceptAttr"
        [attr.multiple]="multiple ? '' : null"
        (change)="onFilesSelected($event)"
      />

      @if (field.helperText && !showError) {
        <mat-hint [id]="hintId">
          {{ field.helperText | translate }}
        </mat-hint>
      }

      @if (showError) {
        <mat-error [id]="errorId" role="alert" aria-live="polite">
          {{ errorMessage }}
        </mat-error>
      }
    </mat-form-field>

    <!-- File list + actions (outside the mat-form-field to avoid layout issues) -->
    @if (filesCount > 0) {
      <div class="pxs-file-list">
        <div class="pxs-file-row" *ngFor="let f of filesView; let i = index">
          <div class="pxs-file-name" [title]="f.name">{{ f.name }}</div>
          <div class="pxs-file-meta">
            <span *ngIf="f.size !== undefined">{{ humanSize(f.size) }}</span>
          </div>
          <button mat-button type="button" (click)="removeAt(i)">
            {{ 'form.actions.remove' | translate: emptyParams }}
          </button>
        </div>
        <div class="pxs-file-actions">
          <button mat-stroked-button type="button" (click)="openPicker()">
            {{
              multiple
                ? ('form.actions.addFiles' | translate: emptyParams)
                : ('form.actions.replaceFile' | translate: emptyParams)
            }}
          </button>
          <button mat-button type="button" color="warn" (click)="clear()">
            {{ 'form.actions.clear' | translate: emptyParams }}
          </button>
        </div>
      </div>
    }
  `,
  styleUrls: ['./file.component.scss'],
})
export class InputFileComponent {
  @Input({ required: true }) field!: FieldConfig & {
    // Optional extra options for file behavior
    accept?: string; // e.g. "image/*,.pdf"
    multiple?: boolean; // default false
    maxFiles?: number; // default unlimited
    maxTotalSize?: number; // bytes
    maxFileSize?: number; // bytes
  };

  @Input({ required: true }) control!: AbstractControl<FileControlValue>;

  @ViewChild('fileInput') private fileInputRef!: ElementRef<HTMLInputElement>;

  emptyParams: Record<string, never> = {};

  constructor(private t: TranslateService) {}

  // ---------- Config helpers ----------
  get multiple(): boolean {
    return !!this.field?.multiple;
  }
  get acceptAttr(): string | null {
    return this.field?.accept ?? null;
  }

  // ---------- Control plumbing ----------
  get fc(): FormControl<FileControlValue> {
    return this.control as FormControl<FileControlValue>;
  }

  get showError(): boolean {
    return !!(this.fc?.touched && this.fc?.invalid);
  }

  get hintId() {
    return `${this.field.name}-hint`;
  }
  get errorId() {
    return `${this.field.name}-error`;
  }

  get ariaDescribedBy(): string | null {
    if (this.showError) return this.errorId;
    if (this.field.helperText) return this.hintId;
    return null;
  }

  // ---------- UI state ----------
  openPicker() {
    this.fileInputRef?.nativeElement?.click();
  }

  onFilesSelected(ev: Event) {
    const input = ev.target as HTMLInputElement;
    const list = input.files;
    if (!list) return;

    const newFiles = Array.from(list);
    const cur = this.currentFiles();

    const merged = this.multiple ? [...cur, ...newFiles] : newFiles.slice(0, 1);

    const filtered = this.filterByAccept(merged);
    const limited = this.enforceCounts(filtered);
    const final = this.enforceSizes(limited);

    // write value
    this.fc.setValue(this.multiple ? final : (final[0] ?? null));
    this.fc.markAsDirty();
    this.fc.updateValueAndValidity();

    // reset native input so same file can be picked again
    input.value = '';
  }

  removeAt(i: number) {
    const cur = this.currentFiles();
    cur.splice(i, 1);
    const next = this.multiple ? cur : (cur[0] ?? null);
    this.fc.setValue(next);
    this.fc.markAsDirty();
    this.fc.updateValueAndValidity();
  }

  clear() {
    this.fc.setValue(this.multiple ? [] : null);
    this.fc.markAsDirty();
    this.fc.updateValueAndValidity();
    if (this.fileInputRef?.nativeElement) this.fileInputRef.nativeElement.value = '';
  }

  // ---------- View / display ----------

  // Replace your filesView getter with this:
  get filesView(): Array<{ name: string; size?: number }> {
    const v = this.fc.value as File | string | Array<File | string> | null;
    if (!v) return [];

    if (Array.isArray(v)) {
      // v: (File | string)[]
      return v.map((x) => {
        if (isString(x)) return { name: x };
        if (isFile(x)) return { name: x.name, size: x.size };
        return { name: String(x) };
      });
    }

    // single value: File | string
    if (isString(v)) return [{ name: v }];
    if (isFile(v)) return [{ name: v.name, size: v.size }];

    return [];
  }

  get filesCount(): number {
    return this.filesView.length;
  }

  get displayValue(): string {
    if (!this.filesCount) return '';
    if (this.filesCount === 1) return this.filesView[0].name;
    return this.t.instant('form.files.count', { count: this.filesCount }); // e.g., "3 files"
  }

  humanSize(bytes?: number): string {
    if (!bytes && bytes !== 0) return '';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    const num = (bytes / Math.pow(1024, i)).toFixed(1);
    const unit = ['B', 'KB', 'MB', 'GB', 'TB'][i] || 'B';
    return `${num} ${unit}`;
  }

  // ---------- Validation helpers ----------
  private currentFiles(): File[] {
    const v = this.fc.value;
    if (!v) return [];
    if (Array.isArray(v)) return v.filter((x) => x instanceof File) as File[];
    return v instanceof File ? [v] : [];
  }

  private filterByAccept(files: File[]): File[] {
    const accept = this.field?.accept as string | undefined;
    if (!accept) return files;

    // accept tokens are comma-separated: ".pdf,image/*"
    const tokens = accept
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);

    const ok = (f: File) => {
      const name = f.name.toLowerCase();
      const type = (f.type || '').toLowerCase();

      return tokens.some((t) => {
        if (t === '*') return true;
        if (t.endsWith('/*')) {
          const prefix = t.slice(0, -1); // "image/"
          return type.startsWith(prefix);
        }
        if (t.startsWith('.')) return name.endsWith(t);
        return type === t; // exact mime type
      });
    };

    return files.filter(ok);
  }

  private enforceCounts(files: File[]): File[] {
    const maxFiles = this.field?.maxFiles as number | undefined;
    if (!this.multiple) return files.slice(0, 1);
    if (!maxFiles || maxFiles <= 0) return files;
    return files.slice(0, maxFiles);
  }

  private enforceSizes(files: File[]): File[] {
    const maxTotal = this.field?.maxTotalSize as number | undefined;
    const maxOne = this.field?.maxFileSize as number | undefined;

    // carry forward any existing errors
    const errs: ValidationErrors = { ...(this.fc.errors ?? {}) };

    // per-file size check
    if (maxOne && files.some((f) => f.size > maxOne)) {
      errs['maxFileSize'] = { max: maxOne };
    } else if (errs['maxFileSize']) {
      delete errs['maxFileSize'];
    }

    // total size check
    if (maxTotal) {
      const total = files.reduce((s, f) => s + f.size, 0);
      if (total > maxTotal) {
        errs['maxTotalSize'] = { max: maxTotal, total };
      } else if (errs['maxTotalSize']) {
        delete errs['maxTotalSize'];
      }
    }

    // enforce max files (defensive; slice already limited earlier)
    const maxFiles = this.field?.maxFiles as number | undefined;
    if (maxFiles && files.length > maxFiles) {
      errs['maxFiles'] = { max: maxFiles };
    } else if (errs['maxFiles']) {
      delete errs['maxFiles'];
    }

    // preserve 'required' if it was set elsewhere
    const required = !!this.fc.errors?.['required'];
    const finalErrs = { ...(required ? { required: true } : {}), ...errs };

    // write back: use null to clear errors fully
    this.fc.setErrors(Object.keys(finalErrs).length ? finalErrs : null);

    return files;
  }

  // ---------- Error/i18n ----------
  get errorMessage(): string {
    const errs = this.fc.errors ?? {};
    if (!errs || !Object.keys(errs).length) return '';

    // Show in this order
    const order = ['required', 'maxFiles', 'maxFileSize', 'maxTotalSize', 'accept'];
    const key = order.find((k) => k in errs) || Object.keys(errs)[0];

    // Prefer per-field overrides, else generic "form.errors.file.*"
    const overrideKey = this.field.errorMessages?.[key];
    const fallbackKey = `form.errors.file.${key}`;
    const i18nKey = overrideKey ?? fallbackKey;

    const params = this.paramsFor(key, errs[key]);
    return this.t.instant(i18nKey, params);
  }

  private paramsFor(key: string, val: any): Record<string, any> {
    switch (key) {
      case 'accept': {
        // e.g. ".pdf,image/*" ➜ pretty list for message
        const raw = (this.field?.accept ?? '').trim();
        const tokens = raw
          ? raw
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean)
          : [];
        const requiredTypes = tokens.length ? tokens.join(', ') : '*';
        return { requiredTypes };
      }

      case 'maxFiles': {
        // expects: requiredLength, actualLength
        const requiredLength = val?.max ?? this.field?.maxFiles ?? 0;
        const actualLength = this.filesCount;
        return { requiredLength, actualLength };
      }

      case 'maxFileSize': {
        // expects: requiredLength
        const requiredLength = this.humanSize(val?.max ?? this.field?.maxFileSize);
        return { requiredLength };
      }

      case 'maxTotalSize': {
        // expects: requiredLength (optionally actualLength if you add it to the message)
        const requiredLength = this.humanSize(val?.max ?? this.field?.maxTotalSize);
        // If you later update the translation to include actualLength, you can add:
        // const actualLength = this.humanSize(val?.total);
        // return { requiredLength, actualLength };
        return { requiredLength };
      }

      case 'required':
      default:
        return {};
    }
  }
}
