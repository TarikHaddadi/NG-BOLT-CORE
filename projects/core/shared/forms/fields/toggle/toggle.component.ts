import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { AbstractControl, FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { FieldConfig } from '@cadai/pxs-ng-core/interfaces';

@Component({
  selector: 'app-toggle',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatSlideToggleModule,
    MatIconModule,
    TranslateModule,
  ],
  template: `
    <div class="toggle-field">
      <mat-slide-toggle
        [formControl]="fc"
        [color]="field.color || 'accent'"
        [attr.aria-label]="field.label | translate"
        [attr.aria-checked]="fc.value"
        [attr.aria-invalid]="fc.invalid || null"
        [attr.aria-required]="field.required || null"
        [attr.aria-describedby]="ariaDescribedBy"
        [attr.aria-disabled]="fc.disabled || null"
        (change)="markTouched()"
        (blur)="markTouched()"
      >
        @if (field.toggleIcons?.position !== 'end') {
          <mat-icon class="toggle-icon" aria-hidden="true">
            {{ fc.value ? field.toggleIcons?.on || 'check' : field.toggleIcons?.off || 'close' }}
          </mat-icon>
        }

        <span class="toggle-label">{{ field.label | translate }}</span>

        @if (field.toggleIcons?.position === 'end') {
          <mat-icon class="toggle-icon" aria-hidden="true">
            {{ fc.value ? field.toggleIcons?.on || 'check' : field.toggleIcons?.off || 'close' }}
          </mat-icon>
        }
      </mat-slide-toggle>

      @if (field.helperText && !showError) {
        <div class="toggle-hint" [id]="hintId">
          {{ field.helperText | translate }}
        </div>
      }

      @if (showError) {
        <div class="toggle-error" [id]="errorId" role="alert" aria-live="polite">
          {{ errorText }}
        </div>
      }
    </div>
  `,
  styleUrls: ['./toggle.component.scss'],
})
export class ToggleComponent {
  @Input({ required: true }) field!: FieldConfig & {
    toggleIcons?: { on: string; off: string; position?: 'start' | 'end' };
    color?: 'primary' | 'accent' | 'warn';
  };
  @Input({ required: true }) control!: AbstractControl<boolean>;

  constructor(private t: TranslateService) {}

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

  get errorText(): string {
    const errs = this.fc?.errors ?? {};
    if (!errs || !Object.keys(errs).length) return '';

    // prioritize boolean-toggle errors
    const order = ['requiredTrue', 'required'];
    const rawKey = order.find((k) => k in errs) || Object.keys(errs)[0];

    // normalize requiredTrue -> required for i18n reuse
    const mapped = rawKey === 'requiredTrue' ? 'required' : rawKey;

    const i18nKey =
      this.field.errorMessages?.[mapped] ?? `form.errors.${this.field.name}.${mapped}`;

    return this.t.instant(i18nKey);
  }

  get fc(): FormControl {
    return this.control as FormControl;
  }
}
