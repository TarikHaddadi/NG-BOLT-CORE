export interface ActionDefinition {
  type: string;
  params?: Record<string, any>;
}

export type FileRef = string; // e.g. blob URL, storage key, API id
export type RuntimeFile = File | Blob;
export type PersistableFile = FileRef | RuntimeFile;

// ---- Action-specific node data + params ----
export interface NodeData {
  label: string; // display label
}

export type PortType = 'json' | string;

export interface WorkflowPort {
  id: string;
  label: string;
  type?: PortType;
}

export interface WorkflowPorts {
  inputs: WorkflowPort[];
  outputs: WorkflowPort[];
}

export type InspectorActionType =
  | 'chat-basic'
  | 'chat-on-file'
  | 'compare'
  | 'summarize'
  | 'extract'
  | 'jira';

export type PaletteType = 'input' | 'result' | InspectorActionType;

export interface ActionDefinitionLite {
  type: PaletteType;
  params?: Record<string, unknown>;
}

export interface WorkflowNodeDataBase {
  label?: string;
  [k: string]: unknown;
}

export interface WorkflowNode {
  id: string;
  type: PaletteType;
  x: number;
  y: number;
  data: WorkflowNodeDataBase;
  ports: WorkflowPorts;
}

export interface WorkflowEdgeStyle {
  marker?: 'solid' | 'hollow' | 'round' | 'warn';
  stroke?: string;
  strokeWidth?: number;
  dasharray?: string;
  labelColor?: string;
  label?: 'auto' | string;
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  sourcePort: string;
  targetPort: string;
  label: string;
  style?: WorkflowEdgeStyle;
}

/** 🔧 Node view model: accepts PALETTE types (may be inspector strings) */
export type NodeModelShape = WorkflowNodeDataBase & {
  type: PaletteType;
  aiType?: InspectorActionType; // keep inspector type here for forms
  ports?: WorkflowPorts;
};
