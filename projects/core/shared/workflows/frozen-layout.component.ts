// frozen-layout.ts
import { Edge,Graph, Layout, Node } from '@swimlane/ngx-graph';

export type XY = { x: number; y: number };

export class FrozenLayout implements Layout {
  name = 'frozen';
   
  settings?: any;

  constructor(
    private getPosTL: (id: string) => XY | undefined, // top-left you store in nodePos
    private computeEdgePoints?: (
      graph: Graph,
      edgeId?: string,
    ) => { x: number; y: number }[] | undefined,
  ) {}

  private centerFor(n: Node): XY | undefined {
    const tl = this.getPosTL(n.id);
    if (!tl) return;
    const w = n.dimension?.width ?? 220;
    const h = n.dimension?.height ?? 60;
    return { x: tl.x + w / 2, y: tl.y + h / 2 }; // ⬅️ center expected by ngx-graph
    // (height is approximate before measure; it's ok—first tick will correct it)
  }

  run(graph: Graph): Graph {
    for (const n of graph.nodes) {
      const c = this.centerFor(n);
      if (c) (n as Node).position = c;
    }
    if (this.computeEdgePoints) {
      for (const e of graph.edges) {
        const pts = this.computeEdgePoints(graph, e.id);
        if (pts?.length) (e as any).points = pts;
      }
    }
    return graph;
  }

  updateEdge(graph: Graph, edge: Edge): Graph {
    if (this.computeEdgePoints) {
      const pts = this.computeEdgePoints(graph, edge.id);
      if (pts?.length) (edge as any).points = pts;
    }
    return graph;
  }

  updateNode(graph: Graph, node: Node): Graph {
    const c = this.centerFor(node);
    if (c) (node as Node).position = c;
    return graph;
  }
}
