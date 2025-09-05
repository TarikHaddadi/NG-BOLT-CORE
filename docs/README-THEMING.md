# Styling Guide for Dynamic Form Components

> _Last updated: 2025-09-02_

This document explains how **styling and coloring** works for dynamic
form components in the Core SDK.\
It focuses only on styling and theming so developers can easily apply
consistent colors across components.

---

## 1. Layout Classes

Each field in a form can define a `layoutClass` property.\
This property is directly applied to the host Material component via
`[class]="field.layoutClass"`.

### Example

```ts
field: FieldConfig = {
  name: 'username',
  type: 'text',
  label: 'User Name',
  layoutClass: 'success', // <- applied to the mat-form-field
  color: 'primary',
};
```

### Supported Layout Classes

- `primary`
- `accent`
- `warn`
- `success`
- `neutral`

> These map to custom CSS palettes defined in the global stylesheet.

---

## 2. Base CSS Variables

At the root level, we define a palette of custom CSS variables:

```css
:root {
  --mat-primary: #ca1149;
  --mat-primary-variant: #1e88e5;
  --mat-accent: #ff4081;
  --mat-warn: #ec9a00ff;
  --mat-neutral: #9e9e9e;
  --mat-success: #4caf50;
}
```

These variables represent the base colors for the theme.\
Components use them through Material Design tokens.

---

## 3. Hue Classes

Each layout class remaps the base Material roles (`primary`, `accent`,
`warn`) inside the component subtree.

```css
.primary {
  --mat-primary: var(--mat-primary);
}
.accent {
  --mat-primary: var(--mat-accent);
}
.warn {
  --mat-primary: var(--mat-warn);
}
.success {
  --mat-primary: var(--mat-success);
}
.neutral {
  --mat-primary: var(--mat-neutral);
}
```

All components keep `[color]="'primary'"`, but the meaning of "primary"
changes depending on the class.

---

## 4. Material Design Tokens

To ensure Angular Material components actually adopt the new colors, MDC
tokens are overridden inside each hue class.

Example for `.success`:

```css
.success {
  --mdc-outlined-text-field-outline-color: var(--mat-primary);
  --mdc-outlined-text-field-hover-outline-color: var(--mat-primary);
  --mdc-outlined-text-field-focus-outline-color: var(--mat-primary);
  --mdc-outlined-text-field-caret-color: var(--mat-primary);
  --mdc-slider-handle-color: var(--mat-primary);
  --mdc-switch-selected-handle-color: var(--mat-primary);
  --mat-datepicker-calendar-date-selected-state-background-color: var(--mat-primary);
}
```

This guarantees that borders, carets, slider thumbs, switches, chips,
and datepickers all reflect the field's hue.

---

## 5. Component Usage

All dynamic form components already bind `layoutClass` in their
templates.

Examples:

```html
<!-- Text Input -->
<mat-form-field [class]="field.layoutClass" [color]="'primary'"> ... </mat-form-field>

<!-- Select -->
<mat-form-field [class]="field.layoutClass" [color]="'primary'"> ... </mat-form-field>

<!-- Slider -->
<mat-slider [class]="field.layoutClass" [color]="'primary'"> ... </mat-slider>

<!-- Toggle -->
<mat-slide-toggle [class]="field.layoutClass" [color]="'primary'"> ... </mat-slide-toggle>

<!-- Chips -->
<mat-chip-option [class]="field.layoutClass" [color]="'primary'"> ... </mat-chip-option>

<!-- Datepicker -->
<mat-datepicker [class]="field.layoutClass"></mat-datepicker>
```

---

## 6. Adding a New Color

1.  Define the color in `:root`:

```css
:root {
  --mat-info: #2196f3;
}
```

2.  Add a hue class remap:

```css
.info {
  --mat-primary: var(--mat-info);
}
```

3.  Use it in a field config:

```ts
field.layoutClass = 'info';
```

The component will now be styled with the `info` hue.

---

## 7. Best Practices

- Always pass `[color]="'primary'"` to Material components.\
  The class remapping takes care of applying the actual hue.
- Use semantic `layoutClass` values (`success`, `neutral`, etc.)
  instead of hard-coded colors.
- Keep overrides **scoped** under classes to avoid global theme
  pollution.
- Extend only by defining new CSS variables + hue classes; no need to
  touch TypeScript.

---

## Summary

✔ `layoutClass` drives the per-field color.\
✔ Custom colors are managed via CSS variables in `:root`.\
✔ Hue classes remap Material's roles locally.\
✔ MDC tokens ensure all component parts adopt the hue.\
✔ Adding a new color = define var + hue class + use in field config.

This setup provides a **flexible, scalable, and theme-safe** way to
style all dynamic form components consistently.

## 🧑‍💻 Author

**Angular Product Skeleton**  
Built by **Tarik Haddadi** using Angular 19+and modern best practices (2025).
