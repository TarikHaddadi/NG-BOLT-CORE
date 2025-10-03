import { Edge,Graph, Layout, Node } from '@swimlane/ngx-graph';

export type XY = { x: number; y: number };

/**
 * A "do nothing" layout:
 * - never repositions nodes (uses external position map)
 * - optionally injects custom edge points (so edges can start/end at ports)
 */
export class FrozenLayout implements Layout {
  name = 'frozen';
  // optional; some versions have a loose 'settings' on Layout
   
  settings?: any;

  constructor(
    private getPos: (id: string) => XY | undefined,
    private computeEdgePoints?: (
      graph: Graph,
      edgeId?: string,
    ) => { x: number; y: number }[] | undefined,
  ) {}

  /** Initial layout pass — we just inject saved positions and (optionally) edge points */
  run(graph: Graph): Graph {
    for (const n of graph.nodes) {
      const p = this.getPos(n.id);
      if (p) {
        (n as Node).position = { x: p.x, y: p.y }; // top-left corner
      }
    }

    if (this.computeEdgePoints) {
      for (const e of graph.edges) {
        const pts = this.computeEdgePoints(graph, e.id);
        if (pts && pts.length) (e as any).points = pts;
      }
    }
    return graph;
  }

  /**
   * Called by ngx-graph when a single edge changes; keep points in sync
   * with our custom port-based router (no re-layout).
   */
  updateEdge(graph: Graph, edge: Edge): Graph {
    if (this.computeEdgePoints) {
      const pts = this.computeEdgePoints(graph, edge.id);
      if (pts && pts.length) (edge as any).points = pts;
    }
    return graph;
  }

  /**
   * (Optional) Called when a single node changes; we simply re-assert its frozen position.
   * Including this is harmless even if your Layout interface doesn’t require it.
   */
  updateNode(graph: Graph, node: Node): Graph {
    const p = this.getPos(node.id);
    if (p) (node as Node).position = { x: p.x, y: p.y };
    return graph;
  }
}
