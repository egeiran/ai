// Grafen et søkenivå bygger på. Ren TypeScript uten grafikk, så motoren kan testes alene.

export type NodeId = string;

export interface GraphNode {
  id: NodeId;
  /** Posisjon i dioramaet (verdensenheter), brukt av scenen. Motoren bryr seg ikke. */
  x: number;
  z: number;
  /** Romradius i scenen. */
  r?: number;
  /** Stedsnavn som vises ved siden av bokstaven, f.eks. «Sjaktinngangen». */
  name?: string;
}

export interface GraphEdge {
  a: NodeId;
  b: NodeId;
  /** Stikostnad. Heltall, så summer blir eksakte. */
  cost: number;
}

export interface Graph {
  nodes: GraphNode[];
  /** Urettede kanter. */
  edges: GraphEdge[];
  start: NodeId;
  goal: NodeId;
}

export interface Neighbor {
  id: NodeId;
  cost: number;
}

/** Sammenligner id-er på tegnkode, som eksamenskonvensjonen («alfabetisk»). */
export function compareIds(a: NodeId, b: NodeId): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Naboliste per node, sortert alfabetisk: barn genereres i alfabetisk rekkefølge. */
export function adjacency(graph: Graph): Map<NodeId, Neighbor[]> {
  const adj = new Map<NodeId, Neighbor[]>();
  for (const n of graph.nodes) adj.set(n.id, []);
  for (const e of graph.edges) {
    const fromA = adj.get(e.a);
    const fromB = adj.get(e.b);
    if (!fromA || !fromB) throw new RangeError(`Kanten ${e.a}–${e.b} peker på en ukjent node`);
    if (!Number.isInteger(e.cost) || e.cost <= 0) {
      throw new RangeError(`Kanten ${e.a}–${e.b} må ha positiv heltallskostnad`);
    }
    fromA.push({ id: e.b, cost: e.cost });
    fromB.push({ id: e.a, cost: e.cost });
  }
  for (const list of adj.values()) list.sort((p, q) => compareIds(p.id, q.id));
  return adj;
}

export function edgeCost(graph: Graph, a: NodeId, b: NodeId): number | undefined {
  const e = graph.edges.find((x) => (x.a === a && x.b === b) || (x.a === b && x.b === a));
  return e?.cost;
}

export function nodeById(graph: Graph, id: NodeId): GraphNode {
  const n = graph.nodes.find((x) => x.id === id);
  if (!n) throw new RangeError(`Ukjent node ${id}`);
  return n;
}
