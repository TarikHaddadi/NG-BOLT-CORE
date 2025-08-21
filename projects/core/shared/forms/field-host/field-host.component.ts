import { CommonModule } from '@angular/common';
import { Component, Input, OnChanges, SimpleChanges, Type } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';

import { FieldComponent, FieldConfig, FieldType } from '@cadai/pxs-ng-core/interfaces';

// Use relative imports (same shared entry point)
import { AutocompleteComponent } from '../fields/autocomplete/autocomplete.component';
import { ChipsComponent } from '../fields/chips/chips.component';
import { DatepickerComponent } from '../fields/date-picker/datepicker.component';
import { RangeComponent } from '../fields/range/range.component';
import { SelectComponent } from '../fields/select/select.component';
import { TextFieldComponent } from '../fields/text-field/text-field.component';
import { TextInputComponent } from '../fields/text-input/text-input.component';
import { ToggleComponent } from '../fields/toggle/toggle.component';

const FIELD_MAP: Partial<Record<FieldType | string, Type<FieldComponent>>> = {
  // text-ish
  textarea: TextFieldComponent,
  text: TextInputComponent,
  email: TextInputComponent,
  phone: TextInputComponent,
  password: TextInputComponent,

  // selections
  dropdown: SelectComponent,
  select: SelectComponent, // alias
  autocomplete: AutocompleteComponent,
  chips: ChipsComponent,
  toggle: ToggleComponent,
  range: RangeComponent,

  // date
  datepicker: DatepickerComponent,
};

@Component({
  selector: 'app-field-host',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <ng-container *ngIf="componentType as cmp; else fallback">
      <ng-container *ngComponentOutlet="cmp; inputs: inputsObj"></ng-container>
    </ng-container>

    <ng-template #fallback></ng-template>
  `,
})
export class FieldHostComponent implements OnChanges {
  @Input({ required: true }) field!: FieldConfig;
  @Input({ required: true }) control!: FormControl;

  componentType?: Type<FieldComponent>;
  inputsObj: Record<string, unknown> = {};

  ngOnChanges(_changes: SimpleChanges): void {
    const key = (this.field?.type ?? '').toString().toLowerCase();
    this.componentType = FIELD_MAP[key] ?? undefined;

    // Only pass what child components actually declare as @Input()
    this.inputsObj = {
      field: this.field,
      control: this.control,
    };
  }
}
