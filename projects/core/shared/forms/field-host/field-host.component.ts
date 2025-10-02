import { CommonModule } from '@angular/common';
import { Component, Input, OnChanges, SimpleChanges, Type } from '@angular/core';
import { AbstractControl, FormControl, ReactiveFormsModule } from '@angular/forms';

import { FieldComponent, FieldConfig, FieldType } from '@cadai/pxs-ng-core/interfaces';

// Use relative imports (same shared entry point)
import { AutocompleteComponent } from '../fields/autocomplete/autocomplete.component';
import { ChipsComponent } from '../fields/chips/chips.component';
import { DatepickerComponent } from '../fields/date-picker/datepicker.component';
import { InputFileComponent } from '../fields/file/file.component';
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
  select: SelectComponent,
  autocomplete: AutocompleteComponent,
  chips: ChipsComponent,
  toggle: ToggleComponent,
  range: RangeComponent,
  file: InputFileComponent,

  // date
  datepicker: DatepickerComponent,
};
@Component({
  selector: 'app-field-host',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <ng-container *ngComponentOutlet="componentType; inputs: inputsObj"> </ng-container>
  `,
})
export class FieldHostComponent implements OnChanges {
  @Input({ required: true }) field!: FieldConfig;
  @Input({ required: true }) control!: AbstractControl;

  componentType: Type<FieldComponent> | null = null;
  inputsObj: Record<string, unknown> = {};

  ngOnChanges(_: SimpleChanges): void {
    const key = (this.field?.type ?? '').toString().toLowerCase();
    this.componentType = (FIELD_MAP[key] ?? null) as Type<FieldComponent> | null;

    this.inputsObj = {
      field: this.field,
      control: this.control,
    };
  }

  get fc(): FormControl {
    return this.control as FormControl;
  }
}
