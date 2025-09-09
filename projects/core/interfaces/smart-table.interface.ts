export type SmartCellType = 'text' | 'number' | 'date' | 'chip' | 'actions' | 'selection';

export interface SmartActionButton {
  id: string;
  icon: string;
  label?: string;
  tooltip?: string;
  color?: 'primary' | 'accent' | 'warn' | undefined;
  disabledWhen?: (row: any) => boolean;
}

export interface SmartColumn {
  id: string;
  header?: string;
  type: SmartCellType;
  width?: number | string;
  minWidth?: number | string;
  maxWidth?: number | string;
  sortable?: boolean;
  filtrable?: boolean;
  visible?: boolean; // default true
  sticky?: boolean; // sticky start
  stickyEnd?: boolean; // sticky end
  format?: string; // e.g. date format
  cellClass?: (row: any) => string | string;
  cellButtons?: SmartActionButton[]; // for actions col
  value?: (row: any) => any; // custom accessor
  _menuOpen?: boolean; // internal
  draggable?: boolean; // default true
}

export interface ServerPage<T = any> {
  data: T[];
  total: number;
}
