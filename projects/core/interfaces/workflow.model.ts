export type WorkflowNodeType = 'input' | 'action' | 'result';

export interface WorkflowNodeData {
  label?: string;
  params?: Record<string, any> | null;
}

export interface WorkflowNode {
  id: string;
  type: WorkflowNodeType;
  x?: number; // px (optional, for manual layouts)
  y?: number;
  data: WorkflowNodeData;
}

export interface WorkflowEdge {
  id: string;
  source: string;
  label: string;
  target: string;
}

export interface ActionDefinition {
  type: string;
  params?: Record<string, any>;
}
