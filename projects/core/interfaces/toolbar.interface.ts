import { ThemePalette } from '@angular/material/core';
import { Observable } from 'rxjs';

export type ButtonVariant = 'icon' | 'stroked' | 'raised' | 'flat';

export interface ToolbarAction {
  id: string;
  icon?: string; // e.g. 'arrow_back', 'download'
  label?: string; // visible text for non-icon variants
  tooltip?: string; // hover tooltip
  color?: ThemePalette; // 'primary' | 'accent' | 'warn'
  class?: 'primary' | 'accent' | 'warn' | 'neutral' | 'success';
  variant?: ButtonVariant; // defaults to 'icon'
  visible$?: Observable<boolean>;
  disabled$?: Observable<boolean>;
  click: () => void; // handler
}
