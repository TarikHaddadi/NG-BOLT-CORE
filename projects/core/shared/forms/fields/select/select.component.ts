import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import {
  AbstractControl,
  FormControl,
  ReactiveFormsModule,
  ValidationErrors,
} from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { FieldConfig } from '@cadai/pxs-ng-core/interfaces';

type SelValue = string | number;
type SelCtrl = AbstractControl<SelValue | SelValue[] | null>;

@Component({
  selector: 'app-select',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatSelectModule,
    TranslateModule,
  ],
  template: `
    <mat-form-field
      appearance="outline"
      class="w-full"
      floatLabel="always"
      [color]="field.color || 'primary'"
      [class]="field.layoutClass"
    >
      <mat-label>{{ field.label | translate }}</mat-label>

      <mat-select
        [formControl]="fc"
        [multiple]="field['multiple'] || false"
        [attr.aria-label]="field.label | translate"
        [attr.aria-describedby]="ariaDescribedBy"
        [attr.aria-invalid]="fc.invalid || null"
        [attr.aria-required]="field.required || null"
        [attr.aria-disabled]="fc.disabled || null"
        (selectionChange)="markTouched()"
        (closed)="markTouched()"
      >
        @for (option of field.options ?? []; track option.value) {
          <mat-option [value]="option.value">
            {{ field['translateOptionLabels'] ? (option.label | translate) : option.label }}
          </mat-option>
        }
      </mat-select>

      @if (field.helperText && !showError) {
        <mat-hint [id]="hintId">
          {{ field.helperText | translate }}
        </mat-hint>
      }

      @if (showError) {
        <mat-error [id]="errorId" role="alert" aria-live="polite">
          {{ errorText | translate }}
        </mat-error>
      }
    </mat-form-field>
  `,
  styleUrls: ['./select.component.scss'],
})
export class SelectComponent {
  @Input({ required: true }) field!: FieldConfig & {
    multiple?: boolean;
    translateOptionLabels?: boolean;
  };
  @Input({ required: true }) control!: SelCtrl;

  constructor(private t: TranslateService) {}

  // ARIA + states
  get showError() {
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

  markTouched() {
    this.fc?.markAsTouched();
  }

  // Errors with fallback + params
  get errorText(): string {
    const errs = this.fc?.errors ?? {};
    if (!errs || !Object.keys(errs).length) return '';

    // Include array-length keys first for multi-select
    const order = [
      'required',
      'optionNotAllowed',
      'minlengthArray',
      'maxlengthArray',
      'minlength',
      'maxlength',
    ];
    const key = order.find((k) => k in errs) || Object.keys(errs)[0];

    const i18nKey = this.field.errorMessages?.[key] ?? `form.errors.${this.field.name}.${key}`;

    return this.t.instant(i18nKey, this.paramsFor(key, errs[key]));
  }

  private paramsFor(key: string, val: ValidationErrors[keyof ValidationErrors]): ValidationErrors {
    // Multi-select: show the number of selected items
    if (key === 'minlengthArray' || key === 'maxlengthArray') {
      const requiredLength = (val as { requiredLength?: number })?.requiredLength;
      const actualLength = Array.isArray(this.fc.value) ? this.fc.value.length : 0;
      return { requiredLength, actualLength };
    }

    // If someone used string minlength/maxlength by mistake,
    // still try to pass the expected params through.
    if (
      (key === 'minlength' || key === 'maxlength') &&
      typeof val === 'object' &&
      val !== null &&
      'requiredLength' in val &&
      'actualLength' in val
    ) {
      const { requiredLength, actualLength } = val as {
        requiredLength: number;
        actualLength: number;
      };
      return { requiredLength, actualLength };
    }

    // Others (required, optionNotAllowed, etc.) don’t need params
    return {};
  }

  // TrackBy
  trackByValue = (_: number, opt: { value: SelValue }) => opt.value;

  get fc(): FormControl {
    return this.control as FormControl;
  }
}
