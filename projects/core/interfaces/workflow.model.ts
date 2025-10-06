export interface ActionDefinition {
  type: string;
  params?: Record<string, any>;
}

export type AiActionType = 'chat-basic' | 'chat-on-file' | 'compare' | 'summarize' | 'extract';

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

export type WorkflowNodeType = 'input' | 'action' | 'result';

export interface ActionDefinitionLite {
  type: 'input' | 'action' | 'result' | string;
  params?: Record<string, unknown>;
}

export interface WorkflowNodeDataBase {
  label?: string;
  [k: string]: unknown;
}

export interface WorkflowNode {
  id: string;
  type: WorkflowNodeType;
  x: number; // top-left, canvas-local
  y: number; // top-left, canvas-local
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

export type NodeModelShape = WorkflowNodeDataBase & {
  type: WorkflowNodeType;
  ports?: WorkflowPorts;
};
