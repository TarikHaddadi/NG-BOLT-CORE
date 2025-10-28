import { CommonModule } from '@angular/common';
import { Component, ElementRef, Input, OnDestroy, OnInit, ViewChild } from '@angular/core';
import {
  AbstractControl,
  FormControl,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Subscription } from 'rxjs';

import { FieldConfig } from '@cadai/pxs-ng-core/interfaces';
import { isFiles, isStrings } from '@cadai/pxs-ng-core/utils';

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
      [hideRequiredMarker]="false"
    >
      <mat-label>{{ field.label | translate }}</mat-label>

      <input
        matInput
        [id]="field.name"
        [value]="displayValue"
        [formControl]="fc"
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

    @if (filesCount > 0) {
      <div class="pxs-file-list">
        @for (f of filesView; track f.key) {
          <div class="pxs-file-row">
            <div class="pxs-file-name" [title]="f.name">{{ f.name }}</div>
            @if (f.size !== undefined) {
              <span class="pxs-file-meta">{{ humanSize(f.size) }}</span>
            }
            <button mat-button type="button" (click)="removeByKey(f.key)">
              {{ 'form.actions.remove' | translate: emptyParams }}
            </button>
          </div>
        }
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
export class InputFileComponent implements OnInit, OnDestroy {
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
  private sub?: Subscription;

  constructor(private t: TranslateService) {}

  ngOnInit(): void {
    if (this.field?.required) {
      this.fc.addValidators(this.hasFilesValidator);
    }

    // Evaluate once for initial state
    this.applyFileErrors(this.currentFiles());

    // Keep custom file-size/count errors in sync
    this.sub = this.fc.valueChanges.subscribe(() => {
      this.applyFileErrors(this.currentFiles());
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

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

  // ---------- UI actions ----------
  openPicker() {
    this.fc.markAsTouched();
    this.fc.updateValueAndValidity({ onlySelf: true, emitEvent: false });
    this.applyFileErrors(this.currentFiles());
    this.fileInputRef?.nativeElement?.click();
  }

  onFilesSelected(ev: Event) {
    const input = ev.target as HTMLInputElement;
    const list = input.files;
    if (!list) {
      this.fc.markAsTouched();
      this.fc.markAsDirty();
      this.fc.updateValueAndValidity({ onlySelf: true });
      this.applyFileErrors([]);
      return;
    }

    const selected = Array.from(list);
    const curRaw = this.rawArray();

    const merged = this.multiple
      ? curRaw.some((x) => typeof x === 'string')
        ? selected
        : [...(curRaw as File[]), ...selected]
      : selected.slice(0, 1);

    const { accepted, rejectedCount } = this.filterByAccept(merged);
    this.lastRejectedByAccept = rejectedCount;

    const limited = this.enforceCounts(accepted);
    const final = limited;

    this.fc.setValue(this.multiple ? final : (final[0] ?? null));
    this.fc.markAsTouched();
    this.fc.markAsDirty();
    this.fc.updateValueAndValidity({ onlySelf: true });
    this.applyFileErrors(final);

    input.value = '';
  }

  private rawArray(): Array<File | string> {
    const v = this.fc.value as any;
    if (v == null) return [];
    return Array.isArray(v) ? v.slice() : [v];
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
  get filesView(): Array<{ key: string; name: string; size?: number }> {
    const v = this.fc.value as File | string | Array<File | string> | null;
    if (!v) return [];

    const toVm = (x: File | string, idx: number) => {
      if (typeof x === 'string') return { key: `str:${idx}:${x}`, name: x };
      // include size + lastModified to disambiguate same-named files
      const lm = (x as any).lastModified ?? 0;
      return { key: `file:${idx}:${x.name}:${x.size}:${lm}`, name: x.name, size: x.size };
    };

    if (Array.isArray(v)) return v.map(toVm);
    if (typeof v === 'string') return [toVm(v, 0)];
    if (v instanceof File) return [toVm(v, 0)];
    return [];
  }

  removeByKey(key: string) {
    const raw = this.rawArray();
    const idx = this.filesView.findIndex((f) => f.key === key);
    if (idx < 0) return;

    // remove same index in raw (filesView mirrors order of rawArray)
    raw.splice(idx, 1);

    // normalize and always set a NEW array in multi-mode
    let next: FileControlValue;

    if (this.multiple) {
      if (isFiles(raw)) {
        next = [...raw];
      } else if (isStrings(raw)) {
        next = [...raw];
      } else {
        const filesOnly = raw.filter((x) => x instanceof File) as File[];
        next = [...filesOnly];
      }
    } else {
      next = raw.length ? (raw[0] as any) : null;
    }

    this.fc.setValue(next);
    this.fc.markAsTouched();
    this.fc.markAsDirty();
    this.fc.updateValueAndValidity({ onlySelf: true });

    const filesOnly = Array.isArray(next)
      ? (next.filter((x) => x instanceof File) as File[])
      : next instanceof File
        ? [next]
        : [];
    this.applyFileErrors(filesOnly);
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

    const errs: ValidationErrors = { ...(this.fc.errors ?? {}) };

    if (this.lastRejectedByAccept > 0) errs['accept'] = true;
    else delete errs['accept'];

    if (maxOne && files.some((f) => f.size > maxOne)) errs['maxFileSize'] = { max: maxOne };
    else delete errs['maxFileSize'];

    // total size
    if (maxTotal) {
      const total = files.reduce((s, f) => s + f.size, 0);
      if (total > maxTotal) errs['maxTotalSize'] = { max: maxTotal, total };
      else delete errs['maxTotalSize'];
    } else delete errs['maxTotalSize'];

    const rawLen = this.rawArray().length;
    if (maxFiles && rawLen > maxFiles) errs['maxFiles'] = { max: maxFiles };
    else delete errs['maxFiles'];

    if (this.field?.required) {
      if (rawLen === 0) errs['required'] = true;
      else delete errs['required'];
    }

    this.fc.setErrors(Object.keys(errs).length ? errs : null);

    // Ensure `invalid` is recomputed for your `showError` binding
    this.fc.updateValueAndValidity({ onlySelf: true, emitEvent: false });
  }

  // ---------- Error/i18n ----------
  get errorMessage(): string {
    const errs = this.fc.errors ?? {};
    if (!errs || !Object.keys(errs).length) return '';

    // Priority similar to your text input
    const order = ['required', 'maxFiles', 'maxFileSize', 'maxTotalSize', 'accept'];
    const key = order.find((k) => k in errs) || Object.keys(errs)[0];

    // 1) per-field override from config
    const overrideKey = this.field.errorMessages?.[key];

    // 2) per-field fallback (like text input)
    const perFieldFallback = `form.errors.${this.field.name}.${key}`;

    // 3) generic file fallback
    const genericFallback = `form.errors.file.${key}`;

    const i18nKey = overrideKey ?? perFieldFallback ?? genericFallback;

    const params = this.paramsFor(key, (errs as any)[key]);
    return this.t.instant(i18nKey, params);
  }

  private paramsFor(key: string, val: any): Record<string, any> {
    switch (key) {
      case 'accept': {
        const tokens = (this.field?.accept ?? '')
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
        return { requiredTypes: tokens.length ? tokens.join(', ') : '*' };
      }
      case 'maxFiles':
        return {
          requiredLength: val?.max ?? this.field?.maxFiles ?? 0,
          actualLength: this.filesCount,
        };
      case 'maxFileSize':
        return { requiredLength: this.humanSize(val?.max ?? this.field?.maxFileSize) };
      case 'maxTotalSize':
        return { requiredLength: this.humanSize(val?.max ?? this.field?.maxTotalSize) };
      default:
        return {};
    }
  }

  hasFilesValidator: ValidatorFn = (c) => {
    const v = c.value;
    const len = Array.isArray(v) ? v.length : v ? 1 : 0;
    return len > 0 ? null : { required: true };
  };
}
