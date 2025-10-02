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

    <!-- File list + actions -->
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
    accept?: string; // e.g. "image/*,.pdf"
    multiple?: boolean; // default false
    maxFiles?: number; // count
    maxTotalSize?: number; // bytes
    maxFileSize?: number; // bytes
  };

  @Input({ required: true }) control!: AbstractControl<FileControlValue>;

  @ViewChild('fileInput') private fileInputRef!: ElementRef<HTMLInputElement>;

  emptyParams: Record<string, never> = {};
  private lastRejectedByAccept = 0; // track how many were dropped by accept

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
    return !!((this.fc?.touched || this.fc?.dirty) && this.fc?.invalid);
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

  // ---------- UI actions ----------
  openPicker() {
    this.fc.markAsTouched();
    // We don't want to blow away programmatic errors here.
    this.fc.updateValueAndValidity({ onlySelf: true, emitEvent: false });
    this.fileInputRef?.nativeElement?.click();
  }

  onFilesSelected(ev: Event) {
    const input = ev.target as HTMLInputElement;
    const list = input.files;
    if (!list) {
      // dialog canceled
      this.fc.markAsTouched();
      this.fc.updateValueAndValidity({ onlySelf: true });
      return;
    }

    const selected = Array.from(list);
    const cur = this.currentFiles();
    const merged = this.multiple ? [...cur, ...selected] : selected.slice(0, 1);

    const { accepted, rejectedCount } = this.filterByAccept(merged);
    this.lastRejectedByAccept = rejectedCount;

    const limited = this.enforceCounts(accepted);
    const final = limited; // sizes & other errors handled in applyFileErrors

    // 1) set the value
    this.fc.setValue(this.multiple ? final : (final[0] ?? null));
    this.fc.markAsTouched();
    this.fc.markAsDirty();

    // 2) run built-ins (required, etc.) first
    this.fc.updateValueAndValidity({ onlySelf: true, emitEvent: false });

    // 3) now apply custom file errors (this will STICK)
    this.applyFileErrors(final);

    // reset native input value so same file can be re-picked
    input.value = '';
  }

  removeAt(i: number) {
    const cur = this.currentFiles();
    cur.splice(i, 1);
    const next = this.multiple ? cur : (cur[0] ?? null);

    this.fc.setValue(next);
    this.fc.markAsTouched();
    this.fc.markAsDirty();
    this.fc.updateValueAndValidity({ onlySelf: true, emitEvent: false });

    this.applyFileErrors(this.multiple ? (next as File[]) : next ? [next as File] : []);
  }

  clear() {
    this.fc.setValue(this.multiple ? [] : null);
    this.fc.markAsTouched();
    this.fc.markAsDirty();
    this.fc.updateValueAndValidity({ onlySelf: true, emitEvent: false });
    this.applyFileErrors([]);
    if (this.fileInputRef?.nativeElement) this.fileInputRef.nativeElement.value = '';
  }

  // ---------- View / display ----------
  get filesView(): Array<{ name: string; size?: number }> {
    const v = this.fc.value as File | string | Array<File | string> | null;
    if (!v) return [];

    if (Array.isArray(v)) {
      return v.map((x) => {
        if (isString(x)) return { name: x };
        if (isFile(x)) return { name: x.name, size: x.size };
        return { name: String(x) };
      });
    }

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
    return this.t.instant('form.files.count', { count: this.filesCount });
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

  /** returns accepted files and how many got rejected by accept rules */
  private filterByAccept(files: File[]): { accepted: File[]; rejectedCount: number } {
    const accept = this.field?.accept as string | undefined;
    if (!accept) return { accepted: files, rejectedCount: 0 };

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

    const accepted = files.filter(ok);
    return { accepted, rejectedCount: files.length - accepted.length };
  }

  private enforceCounts(files: File[]): File[] {
    const maxFiles = this.field?.maxFiles as number | undefined;
    if (!this.multiple) return files.slice(0, 1);
    if (!maxFiles || maxFiles <= 0) return files;
    return files.slice(0, maxFiles);
  }

  /** Compute and APPLY custom errors AFTER setValue()/updateValueAndValidity(). */
  private applyFileErrors(files: File[]): void {
    const maxTotal = this.field?.maxTotalSize as number | undefined;
    const maxOne = this.field?.maxFileSize as number | undefined;
    const maxFiles = this.field?.maxFiles as number | undefined;

    // Start with validator-produced errors (if any) to avoid nuking them.
    const errs: ValidationErrors = { ...(this.fc.errors ?? {}) };

    // accept: if any were rejected, show error
    if (this.lastRejectedByAccept > 0) {
      errs['accept'] = true;
    } else {
      delete errs['accept'];
    }

    // max single file size
    if (maxOne && files.some((f) => f.size > maxOne)) {
      errs['maxFileSize'] = { max: maxOne };
    } else {
      delete errs['maxFileSize'];
    }

    // max total size
    if (maxTotal) {
      const total = files.reduce((s, f) => s + f.size, 0);
      if (total > maxTotal) {
        errs['maxTotalSize'] = { max: maxTotal, total };
      } else {
        delete errs['maxTotalSize'];
      }
    } else {
      delete errs['maxTotalSize'];
    }

    // max files count
    if (maxFiles && files.length > maxFiles) {
      errs['maxFiles'] = { max: maxFiles };
    } else {
      delete errs['maxFiles'];
    }

    // ensure required shows when empty if field.required = true
    const isEmpty = files.length === 0;
    if (this.field?.required) {
      if (isEmpty) errs['required'] = true;
      else delete errs['required'];
    }

    this.fc.setErrors(Object.keys(errs).length ? errs : null);
  }

  // ---------- Error/i18n ----------
  get errorMessage(): string {
    const errs = this.fc.errors ?? {};
    if (!errs || !Object.keys(errs).length) return '';

    const order = ['required', 'maxFiles', 'maxFileSize', 'maxTotalSize', 'accept'];
    const key = order.find((k) => k in errs) || Object.keys(errs)[0];

    const overrideKey = this.field.errorMessages?.[key];
    const fallbackKey = `form.errors.file.${key}`;
    const i18nKey = overrideKey ?? fallbackKey;

    const params = this.paramsFor(key, (errs as any)[key]);
    return this.t.instant(i18nKey, params);
  }

  private paramsFor(key: string, val: any): Record<string, any> {
    switch (key) {
      case 'accept': {
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
        const requiredLength = val?.max ?? this.field?.maxFiles ?? 0;
        const actualLength = this.filesCount;
        return { requiredLength, actualLength };
      }

      case 'maxFileSize': {
        const requiredLength = this.humanSize(val?.max ?? this.field?.maxFileSize);
        return { requiredLength };
      }

      case 'maxTotalSize': {
        const requiredLength = this.humanSize(val?.max ?? this.field?.maxTotalSize);
        return { requiredLength };
      }

      case 'required':
      default:
        return {};
    }
  }
}
