import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  Input,
  OnChanges,
  OnInit,
  ViewChild,
} from '@angular/core';
import {
  AbstractControl,
  FormControl,
  ReactiveFormsModule,
  ValidationErrors,
} from '@angular/forms';
import { MatChipListbox, MatChipsModule } from '@angular/material/chips';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { FieldConfig } from '@cadai/pxs-ng-core/interfaces';

@Component({
  selector: 'app-chips',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatChipsModule, TranslateModule],
  template: `
    <div class="chips-field">
      <span
        class="chips-label"
        [id]="labelId"
        role="button"
        tabindex="0"
        [attr.aria-controls]="listboxId"
        (click)="focusListbox()"
        (keydown.enter)="focusListbox()"
        (keydown.space)="focusListbox()"
      >
        {{ field.label | translate }}
      </span>

      <mat-chip-listbox
        #listbox
        [id]="listboxId"
        [multiple]="field['multiple'] || false"
        [formControl]="fc"
        [attr.aria-labelledby]="labelId"
        [attr.aria-describedby]="ariaDescribedBy"
        [attr.aria-invalid]="fc.invalid || null"
        [attr.aria-required]="field.required || null"
        [attr.aria-disabled]="fc.disabled || null"
        (selectionChange)="markTouched()"
        (blur)="markTouched()"
      >
        @for (chip of field.chipOptions ?? []; track chip) {
          <mat-chip-option
            [value]="chip"
            [disabled]="fc.disabled"
            [class]="field.layoutClass"
            [color]="field.color || 'primary'"
          >
            {{ chip | translate }}
          </mat-chip-option>
        }
      </mat-chip-listbox>

      <!-- Error -->
      @if (showError) {
        <div class="chips-error" [id]="errorId" role="alert" aria-live="polite">
          {{ errorText }}
        </div>
      }

      <!-- Hint -->
      @if (field.helperText && !showError) {
        <div class="chips-hint" [id]="hintId">
          {{ field.helperText | translate }}
        </div>
      }
    </div>
  `,
  styleUrls: ['./chips.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChipsComponent implements OnInit, OnChanges {
  @Input({ required: true }) field!: FieldConfig;
  @Input({ required: true }) control!: AbstractControl<string[] | string | null>;
  @Input() multiple = false;
  @ViewChild('listbox') listbox!: MatChipListbox;

  constructor(private t: TranslateService) {}

  ngOnInit(): void {
    const v = this.fc.value;
    if (this.field['multiple']) {
      if (!Array.isArray(v)) this.fc.setValue([], { emitEvent: false });
    } else {
      if (Array.isArray(v)) this.fc.setValue(null, { emitEvent: false });
    }
  }

  ngOnChanges() {
    if (this.field.disabled) this.fc.disable({ emitEvent: false });
    else this.fc.enable({ emitEvent: false });
  }

  private length(v: unknown): number {
    if (Array.isArray(v)) return v.length;
    return v == null || v === '' ? 0 : 1; // single selection counts as 1
  }

  // IDs / ARIA wiring
  get labelId() {
    return `${this.field.name}-label`;
  }
  get listboxId() {
    return `${this.field.name}-listbox`;
  }
  get hintId() {
    return `${this.field.name}-hint`;
  }
  get errorId() {
    return `${this.field.name}-error`;
  }

  get showError(): boolean {
    return !!(this.fc?.touched && this.fc?.invalid);
  }

  get ariaDescribedBy(): string | null {
    if (this.showError) return this.errorId;
    if (this.field.helperText) return this.hintId;
    return null;
  }

  markTouched() {
    this.fc?.markAsTouched();
  }

  trackByIndex = (index: number) => index;

  get errorText(): string {
    const errs = this.fc?.errors ?? {};
    if (!errs || !Object.keys(errs).length) return '';

    // Priority for list selections
    const order = ['minlengthArray', 'required', 'maxlengthArray', 'optionNotAllowed'];
    const key = order.find((k) => this.fc.hasError(k)) || Object.keys(this.fc.errors ?? {})[0];

    const i18nKey = this.field.errorMessages?.[key] ?? `form.errors.${this.field.name}.${key}`;

    const params = this.paramsFor(key, errs[key]);
    return this.t.instant(i18nKey, params);
  }

  private paramsFor(key: string, val: ValidationErrors[keyof ValidationErrors]): ValidationErrors {
    switch (key) {
      case 'minlengthArray':
      case 'maxlengthArray':
        return {
          requiredLength: val?.requiredLength,
          actualLength: this.length(this.fc.value),
        };
      default:
        return {};
    }
  }

  focusListbox() {
    this.listbox?.focus?.();
  }

  get fc(): FormControl {
    return this.control as FormControl;
  }
}
