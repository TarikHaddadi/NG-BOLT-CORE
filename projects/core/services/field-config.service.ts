import { Injectable } from '@angular/core';
import { ValidatorFn, Validators } from '@angular/forms';

import { FieldConfig } from '@cadai/pxs-ng-core/interfaces';
import {
  allowedCharsValidator,
  datePatternFromPlaceholder,
  emailTldValidator,
  fileAcceptValidator,
  maxFileSizeValidator,
  maxFilesValidator,
  maxTotalSizeValidator,
  minArrayLength,
  optionInListValidator,
  passwordStrengthValidator,
  phoneDigitCount,
} from '@cadai/pxs-ng-core/utils';

type ErrMap = FieldConfig['errorMessages'];

function mergeField<T extends FieldConfig>(base: T, over?: Partial<T>): T {
  if (!over) return base;

  const merged = {
    ...base,
    ...over,
  } as T;

  const baseErr = (base.errorMessages ?? {}) as ErrMap;
  const overErr = (over.errorMessages ?? {}) as ErrMap;
  merged.errorMessages = { ...baseErr, ...overErr };

  const maybeReplace = (key: keyof T) => {
    if (key in over) {
      (merged as any)[key] = (over as any)[key];
    } else {
      (merged as any)[key] = (base as any)[key];
    }
  };

  (
    ['validators', 'children', 'options', 'chipOptions', 'autocompleteOptions'] as (keyof T)[]
  ).forEach(maybeReplace);

  return merged;
}

@Injectable({ providedIn: 'root' })
export class FieldConfigService {
  getTextAreaField(overrides: Partial<FieldConfig> = {}): FieldConfig {
    const defaults: FieldConfig = {
      type: 'textarea',
      name: 'textarea',
      label: 'textarea',
      placeholder: 'Write your text',
      helperText: 'form.hints.textarea',
      required: false,
      minLength: 0,
      maxLength: 500,
      autoResize: true,
      rows: 3,
      maxRows: 10,
      showCounter: true,
      validators: [Validators.maxLength(500)],
      errorMessages: {
        minlength: 'form.errors.textarea.minlength',
        maxlength: 'form.errors.textarea.maxlength',
      },
      layoutClass: 'primary',
    };
    return mergeField(defaults, { ...overrides, type: 'textarea' });
  }

  /**
   * File picker field
   * Supported extras on FieldConfig (kept as plain props for your renderer):
   * - accept?: string            (".pdf,image/*")
   * - multiple?: boolean         (default false)
   * - maxFiles?: number
   * - maxFileSize?: number       (bytes)
   * - maxTotalSize?: number      (bytes)
   */
  getFileField(overrides: Partial<FieldConfig> = {}): FieldConfig {
    const accept = overrides.accept;
    const multiple = !!overrides.multiple;
    const maxFiles = overrides.maxFiles;
    const maxFileSize = overrides.maxFileSize; // bytes
    const maxTotalSize = overrides.maxTotalSize; // bytes
    const required = overrides.required ?? true;
    const fileVariant = overrides.fileVariant ?? 'input';

    const defaults: FieldConfig = {
      type: 'file',
      name: 'file',
      label: 'form.labels.file',
      placeholder: 'form.placeholders.file', // used by the read-only text input
      required,
      helperText: 'form.hints.file',
      // UI hints used by your renderer component (app-input-file)
      accept,
      multiple,
      maxFiles,
      maxFileSize,
      maxTotalSize,
      fileVariant,
      // Validators: compose requirements based on provided constraints
      validators: [
        ...(required ? [Validators.required] : []),
        fileAcceptValidator(accept),
        maxFilesValidator(multiple ? maxFiles : 1), // single mode => max 1
        maxFileSizeValidator(maxFileSize),
        maxTotalSizeValidator(maxTotalSize),
      ],

      disabled: false,
      hidden: false,

      children: [],
      errorMessages: {
        required: 'form.errors.file.required',
        accept: 'form.errors.file.accept',
        maxFiles: 'form.errors.file.maxFiles',
        maxFileSize: 'form.errors.file.maxFileSize',
        maxTotalSize: 'form.errors.file.maxTotalSize',
      },
      layoutClass: 'primary',
      chipOptions: [],
      autocompleteOptions: [],
    };

    // Force type to 'file', let overrides customize the rest
    return mergeField(defaults, { ...overrides, type: 'file' });
  }

  getTextField(overrides: Partial<FieldConfig> = {}): FieldConfig {
    const disallowed = new RegExp('[^\\p{L}0-9_\\-. ]', 'u');

    const defaults: FieldConfig = {
      type: 'text',
      name: 'input',
      label: 'Username',
      placeholder: 'Enter username',
      required: true,
      helperText: 'form.hints.input',
      minLength: 3,
      maxLength: 50,
      validators: [
        Validators.required,
        Validators.minLength(3),
        Validators.maxLength(50),
        allowedCharsValidator(disallowed),
      ],
      disabled: false,
      hidden: false,
      children: [],
      errorMessages: {
        required: 'form.errors.input.required',
        minlength: 'form.errors.input.minlength',
        maxlength: 'form.errors.input.maxlength',
        invalidChars: 'form.errors.input.invalidChars',
      },
      layoutClass: 'primary',
      chipOptions: [],
      autocompleteOptions: [],
    };
    return mergeField(defaults, { ...overrides, type: 'text' });
  }

  getEmailField(overrides: Partial<FieldConfig> = {}): FieldConfig {
    const defaults: FieldConfig = {
      type: 'email',
      name: 'email',
      label: 'Email',
      placeholder: 'Enter your email',
      required: true,
      helperText: 'form.hints.email',
      maxLength: 254,
      validators: [
        Validators.required,
        Validators.email,
        Validators.maxLength(254),
        emailTldValidator(2),
      ],
      errorMessages: {
        required: 'form.errors.email.required',
        email: 'form.errors.email.invalid',
        emailTld: 'form.errors.email.tld',
        emailDomain: 'form.errors.email.domain',
        maxlength: 'form.errors.email.maxlength',
      },
      disabled: false,
      hidden: false,
      children: [],
      layoutClass: 'primary',
      chipOptions: [],
      autocompleteOptions: [],
    };
    return mergeField(defaults, { ...overrides, type: 'email' });
  }

  getPasswordField(overrides: Partial<FieldConfig> = {}): FieldConfig {
    const minLength = 8;
    const defaults: FieldConfig = {
      type: 'password',
      name: 'password',
      label: 'Password',
      placeholder: 'Enter password',
      required: true,
      helperText: 'form.hints.password',
      minLength,
      maxLength: 128,
      validators: [
        Validators.required,
        Validators.maxLength(128),
        passwordStrengthValidator({ minLength, minUpper: 1, minDigits: 1 }),
      ],
      disabled: false,
      hidden: false,
      children: [],
      errorMessages: {
        required: 'form.errors.password.required',
        minlength: 'form.errors.password.minlength',
        maxlength: 'form.errors.password.maxlength',
        uppercase: 'form.errors.password.uppercase',
        digit: 'form.errors.password.digit',
        special: 'form.errors.password.special',
      },
      layoutClass: 'primary',
      chipOptions: [],
      autocompleteOptions: [],
    };
    return mergeField(defaults, { ...overrides, type: 'password' });
  }

  getPhoneField(overrides: Partial<FieldConfig> = {}): FieldConfig {
    const phoneRegex = '^\\+?[1-9][0-9 \\-]{7,14}$';
    const defaults: FieldConfig = {
      type: 'phone',
      name: 'phone',
      label: 'Phone Number',
      placeholder: '+35212345678',
      required: true,
      pattern: phoneRegex,
      validators: [Validators.required, Validators.pattern(phoneRegex), phoneDigitCount(8, 15)],
      errorMessages: {
        required: 'form.errors.phone.required',
        pattern: 'form.errors.phone.invalid',
        phoneDigitsLen: 'form.errors.phone.invalid',
      },
      layoutClass: 'primary',
      defaultValue: '+352',
    };
    return mergeField(defaults, { ...overrides, type: 'phone' });
  }

  getToggleField(overrides: Partial<FieldConfig> = {}): FieldConfig {
    const defaults: FieldConfig = {
      type: 'toggle',
      name: 'notify',
      label: 'Enable notifications',
      placeholder: '',
      required: false,
      helperText: 'form.hints.notify',
      validators: [],
      disabled: false,
      hidden: false,
      children: [],
      errorMessages: {
        required: 'form.errors.notify.required',
      },
      layoutClass: 'primary',
      chipOptions: [],
      autocompleteOptions: [],
    };
    return mergeField(defaults, { ...overrides, type: 'toggle' });
  }

  getDropdownField(overrides: Partial<FieldConfig> = {}): FieldConfig {
    const defaults: FieldConfig = {
      type: 'dropdown',
      name: 'role',
      label: 'Role',
      placeholder: 'Select a role',
      required: true,
      helperText: 'form.hints.role',
      options: [
        { label: 'Admin', value: 'admin' },
        { label: 'User', value: 'user' },
        { label: 'Manager', value: 'manager' },
      ],
      multiple: false,
      validators: [Validators.required as unknown as ValidatorFn],
      disabled: false,
      hidden: false,
      children: [],
      errorMessages: {
        required: 'form.errors.role.required',
      },
      layoutClass: 'primary',
      chipOptions: [],
      autocompleteOptions: [],
    };
    return mergeField(defaults, { ...overrides, type: 'dropdown' });
  }

  getRangeField(overrides: Partial<FieldConfig> = {}): FieldConfig {
    const min = overrides.min ?? 0;
    const max = overrides.max ?? 100;

    const defaults: FieldConfig = {
      type: 'range',
      name: 'volume',
      label: 'Notification Volume',
      placeholder: '',
      required: true,
      helperText: 'form.hints.volume',
      min,
      max,
      step: overrides.step ?? 5,
      validators: [Validators.required, Validators.min(min), Validators.max(max)],
      disabled: false,
      hidden: false,
      children: [],
      errorMessages: {
        required: 'form.errors.volume.required',
        min: 'form.errors.volume.min',
        max: 'form.errors.volume.max',
      },
      layoutClass: 'primary',
      chipOptions: [],
      autocompleteOptions: [],
      defaultValue: 20,
    };
    return mergeField(defaults, { ...overrides, type: 'range' });
  }

  getDatepickerField(overrides: Partial<FieldConfig> = {}): FieldConfig {
    const placeholder = overrides.placeholder ?? 'YYYY-MM-DD';
    const pattern = datePatternFromPlaceholder(placeholder);

    const defaults: FieldConfig = {
      type: 'datepicker',
      name: 'dob',
      label: 'Date of Birth',
      placeholder,
      pattern,
      required: true,
      helperText: 'form.hints.dob',
      validators: [Validators.required],
      errorMessages: {
        required: 'form.errors.dob.required',
        format: 'form.errors.dob.format',
        matDatepickerParse: 'form.errors.dob.parse',
        matDatepickerMin: 'form.errors.dob.minDate',
        matDatepickerMax: 'form.errors.dob.maxDate',
        matDatepickerFilter: 'form.errors.dob.dateNotAllowed',
      },
      layoutClass: 'primary',
    };
    return mergeField(defaults, { ...overrides, type: 'datepicker' });
  }

  getChipsField(overrides: Partial<FieldConfig> = {}): FieldConfig {
    const defaults: FieldConfig = {
      type: 'chips',
      name: 'tags',
      label: 'Tags',
      placeholder: 'Add tags',
      required: true,
      helperText: 'form.hints.tags',
      validators: [minArrayLength(1)],
      disabled: false,
      hidden: false,
      multiple: false,
      children: [],
      errorMessages: {
        minlengthArray: 'form.errors.tags.minOne',
      },
      layoutClass: 'primary',
      chipOptions: ['Angular', 'React', 'Vue'],
      autocompleteOptions: [],
    };
    return mergeField(defaults, { ...overrides, type: 'chips' });
  }

  getAutocompleteField(overrides: Partial<FieldConfig> = {}): FieldConfig {
    const opts = overrides.autocompleteOptions ?? ['Luxembourg', 'Germany', 'France'];
    const defaults: FieldConfig = {
      type: 'autocomplete',
      name: 'country',
      label: 'Country',
      placeholder: 'Start typing…',
      required: true,
      helperText: 'form.hints.country',
      minLength: 2,
      maxLength: 56,
      validators: [Validators.required, optionInListValidator(opts)],
      disabled: false,
      hidden: false,
      children: [],
      errorMessages: {
        required: 'form.errors.country.required',
        optionNotAllowed: 'form.errors.country.notAllowed',
      },
      layoutClass: 'primary',
      chipOptions: [],
      autocompleteOptions: opts,
    };
    return mergeField(defaults, { ...overrides, type: 'autocomplete' });
  }

  getAllFields(overrides: Partial<FieldConfig>[] = []): FieldConfig[] {
    return [
      this.getTextField(overrides[0]),
      this.getEmailField(overrides[1]),
      this.getPasswordField(overrides[2]),
      this.getPhoneField(overrides[3]),
      this.getToggleField(overrides[4]),
      this.getDropdownField(overrides[5]),
      this.getRangeField(overrides[6]),
      this.getDatepickerField(overrides[7]),
      this.getChipsField(overrides[8]),
      this.getAutocompleteField(overrides[9]),
      this.getTextAreaField(overrides[10]),
      this.getFileField(overrides[11]),
    ];
  }
}
