import { CommonModule } from '@angular/common';
import { Component, inject, Input, OnChanges, OnInit, SimpleChanges } from '@angular/core';
import {
  AbstractControl,
  FormArray,
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
} from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { FieldConfig } from '@cadai/pxs-ng-core/interfaces';
import { buildValidators } from '@cadai/pxs-ng-core/utils';

import { FieldHostComponent } from './field-host/field-host.component';

type SelValue = string | number;

@Component({
  selector: 'app-dynamic-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TranslateModule, FieldHostComponent],
  templateUrl: './dynamic-form.component.html',
  styleUrls: ['./dynamic-form.component.scss'],
})
export class DynamicFormComponent implements OnInit, OnChanges {
  @Input() config: FieldConfig[] = [];
  @Input() form!: FormGroup;

  private fb = inject(FormBuilder);
  public translateService = inject(TranslateService);
  public controls: Record<string, AbstractControl> = {};

  ngOnInit(): void {
    this.ensureControls();
  }

  ngOnChanges(_: SimpleChanges): void {
    // If config changes after init, add any missing controls (idempotent)
    this.ensureControls();
  }

  /** Build/patch the form based on config (safe to call multiple times) */
  private ensureControls(): void {
    if (!this.form) return;

    for (const field of this.config) {
      if (this.form.get(field.name)) continue;

      if (field.type === 'group') {
        const group = this.fb.group({});
        (field.children ?? []).forEach((ch) => group.addControl(ch.name, this.createControl(ch)));
        this.form.addControl(field.name, group);
        continue;
      }

      if (field.type === 'array') {
        const arr = new FormArray<AbstractControl>([]);
        if (field.children?.length) {
          const g = this.fb.group({});
          field.children.forEach((ch) => g.addControl(ch.name, this.createControl(ch)));
          arr.push(g);
        }
        this.form.addControl(field.name, arr);
        continue;
      }

      this.form.addControl(field.name, this.createControl(field));
    }

    // Rebuild the lookup after (idempotent)
    this.controls = this.form.controls;
  }

  /** Create a control for a single field */
  private createControl(field: FieldConfig): AbstractControl {
    const validators = buildValidators(field);

    switch (field.type) {
      case 'toggle':
        return new FormControl<boolean>(
          { value: field.defaultValue ? !!field.defaultValue : false, disabled: !!field.disabled },
          { nonNullable: true, validators },
        );

      case 'range':
        return new FormControl<number | null>(
          {
            value: field.defaultValue != null ? Number(field.defaultValue) : (field.min ?? 0),
            disabled: !!field.disabled,
          },
          { validators },
        );

      case 'datepicker':
        return new FormControl<Date | null>(
          { value: null, disabled: !!field.disabled },
          { validators },
        );

      case 'chips':
      case 'dropdown': {
        const multiple = field.multiple === true;
        if (multiple) {
          return new FormControl<SelValue[]>(
            { value: [], disabled: !!field.disabled },
            { validators },
          );
        }
        // single-select starts at null so "required" works
        return new FormControl<SelValue | null>(
          { value: null, disabled: !!field.disabled },
          { validators },
        );
      }

      case 'file': {
        const multiple = field.multiple === true;
        if (multiple) {
          // Multiple: File[] (for new uploads) or string[] (persisted refs)
          return new FormControl<File[] | string[]>(
            {
              value: Array.isArray(field.defaultValue) ? field.defaultValue : [],
              disabled: !!field.disabled,
            },
            { validators },
          );
        } else {
          // Single: File | string | null
          const initial =
            typeof field.defaultValue === 'string'
              ? field.defaultValue
              : field.defaultValue instanceof File
                ? field.defaultValue
                : null;
          return new FormControl<File | string | null>(
            { value: initial, disabled: !!field.disabled },
            { validators },
          );
        }
      }

      // text / email / phone / password / autocomplete / textarea / etc.
      default:
        return new FormControl<string>(
          { value: field.defaultValue?.toString() ?? '', disabled: !!field.disabled },
          { nonNullable: true, validators },
        );
    }
  }

  /** Helper used by the template */
  controlOf(name: string): FormControl {
    return this.form.get(name) as FormControl;
  }
}
