export type WorkflowNodeType = 'input' | 'action' | 'result';

export interface WorkflowEdge {
  id: string;
  source: string;
  label?: string;
  sourcePort?: string;
  targetPort?: string;
  target: string;
  style: Record<string, string | undefined | null>;
}

export interface ActionDefinition {
  type: string;
  params?: Record<string, any>;
}

export type ContextMenuTarget = { type: 'node' | 'edge'; id: string; x: number; y: number } | null;

export type EdgeStyle = {
  stroke?: string; // '#4caf50', 'currentColor', etc.
  strokeWidth?: number; // 1..4
  dasharray?: string; // '4 4', '8 4', etc.
  marker?: 'solid' | 'hollow' | 'round' | 'warn';
  labelColor?: string;
};

export type ExtendedWorkflowEdge = WorkflowEdge & { style?: EdgeStyle };

export type Port = { id: string; label: string; type?: string }; // type optional: 'json' | 'text' | 'image' etc.
export type WorkflowNode = {
  id: string;
  type: WorkflowNodeType;
  x?: number; // px (optional, for manual layouts)
  y?: number;
  data: WorkflowNodeData;
  ports?: Ports;
};

export interface Ports {
  inputs?: Port[];
  outputs?: Port[];
}

export type EdgeWithPorts = WorkflowEdge & {
  sourcePort?: string;
  targetPort?: string;
};

export type AiActionType = 'chat-basic' | 'chat-on-file' | 'compare' | 'summarize' | 'extract';

export type FileRef = string; // e.g. blob URL, storage key, API id
export type RuntimeFile = File | Blob;
export type PersistableFile = FileRef | RuntimeFile;

export type AiActionParams =
  | { type: 'chat-basic'; prompt: string }
  | { type: 'chat-on-file'; prompt: string; files: File[] | string[] }
  | { type: 'compare'; leftFile: File | string; rightFile: File | string }
  | { type: 'summarize'; file: File | string }
  | { type: 'extract'; text?: string; entities: string }; // entities = "person,location,..."

// ---- Action-specific node data + params ----
export interface NodeData {
  label: string; // display label
}

export interface ChatBasicNodeData extends NodeData {
  aiType: 'chat-basic';
  params: {
    prompt: string;
  };
}

export interface ChatOnFileNodeData extends NodeData {
  aiType: 'chat-on-file';
  params: {
    prompt: string;
    /** allow one or many; when saving to backend, convert RuntimeFile -> FileRef[] */
    files: PersistableFile[];
  };
}

export interface CompareNodeData extends NodeData {
  aiType: 'compare';
  params: {
    leftFile: PersistableFile | null;
    rightFile: PersistableFile | null;
  };
}

export interface SummarizeNodeData extends NodeData {
  aiType: 'summarize';
  params: {
    file: PersistableFile | null;
  };
}

export interface ExtractNodeData extends NodeData {
  aiType: 'extract';
  params: {
    /** optional free text to analyze (can also come from upstream node via ports) */
    text?: string;
    /** comma-separated list of entities: "person, location, organization" */
    entities: string;
  };
}

export type WorkflowNodeData = NodeData | ActionNodeData;

/** All “action” nodes are discriminated by aiType */
export type ActionNodeData =
  | ChatBasicNodeData
  | ChatOnFileNodeData
  | CompareNodeData
  | SummarizeNodeData
  | ExtractNodeData;

// -------------------------------
// Helpful label map (UI sugar)
// -------------------------------
export const ACTION_LABEL: Record<AiActionType, string> = {
  'chat-basic': 'Chat (basic)',
  'chat-on-file': 'Chat on file(s)',
  compare: 'Compare two files',
  summarize: 'Summarize file',
  extract: 'Extract entities',
};
