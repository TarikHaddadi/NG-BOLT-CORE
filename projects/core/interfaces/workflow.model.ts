export type WorkflowNodeType = 'input' | 'action' | 'result';

export interface WorkflowNodeData {
  label?: string;
  params?: Record<string, any> | null;
}

export interface WorkflowEdge {
  id: string;
  source: string;
  label: string;
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
};

export type NodeWithPorts = WorkflowNode & {
  ports?: {
    inputs?: Port[];
    outputs?: Port[];
  };
};

export type EdgeWithPorts = WorkflowEdge & {
  sourcePort?: string;
  targetPort?: string;
};
