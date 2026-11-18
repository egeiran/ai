// Heuristikker: sann restkostnad h*, admissibilitet og konsistens (exam-conventions § 1.5).

import { adjacency, compareIds, type Graph, type NodeId } from "./graph";
import type { Heuristic } from "./search";

/** Sann restkostnad h*(n): korteste vei fra n til målet (Dijkstra baklengs fra målet). */
export function trueCosts(graph: Graph): Record<NodeId, number> {
  const adj = adjacency(graph);
  const dist: Record<NodeId, number> = {};
  for (const n of graph.nodes) dist[n.id] = Infinity;
  dist[graph.goal] = 0;
  const done = new Set<NodeId>();
  while (done.size < graph.nodes.length) {
    let best: NodeId | null = null;
    for (const n of graph.nodes) {
      if (done.has(n.id)) continue;
      if (
        best === null ||
        dist[n.id]! < dist[best]! ||
        (dist[n.id] === dist[best] && compareIds(n.id, best) < 0)
      ) {
        best = n.id;
      }
    }
    if (best === null || dist[best] === Infinity) break;
    done.add(best);
    for (const nb of adj.get(best) ?? []) {
      const d = dist[best]! + nb.cost;
      if (d < dist[nb.id]!) dist[nb.id] = d;
    }
  }
  return dist;
}

export interface AdmissibleViolation {
  id: NodeId;
  h: number;
  hStar: number;
}

/** Admissibel: h(n) ≤ h*(n) for alle n. Gir nodene der h overestimerer. */
export function admissibilityViolations(graph: Graph, h: Heuristic): AdmissibleViolation[] {
  const hStar = trueCosts(graph);
  const out: AdmissibleViolation[] = [];
  for (const n of graph.nodes) {
    const v = h[n.id] ?? 0;
    const s = hStar[n.id] ?? Infinity;
    if (v > s) out.push({ id: n.id, h: v, hStar: s });
  }
  return out;
}

export interface ConsistencyViolation {
  from: NodeId;
  to: NodeId;
  cost: number;
  hFrom: number;
  hTo: number;
}

/**
 * Konsistent: h(n) ≤ c(n, n′) + h(n′) for hver kant, sjekket i begge retninger (urettet graf),
 * og h(mål) = 0.
 */
export function consistencyViolations(graph: Graph, h: Heuristic): ConsistencyViolation[] {
  const out: ConsistencyViolation[] = [];
  for (const e of graph.edges) {
    const ha = h[e.a] ?? 0;
    const hb = h[e.b] ?? 0;
    if (ha > e.cost + hb) out.push({ from: e.a, to: e.b, cost: e.cost, hFrom: ha, hTo: hb });
    if (hb > e.cost + ha) out.push({ from: e.b, to: e.a, cost: e.cost, hFrom: hb, hTo: ha });
  }
  return out;
}

export function isAdmissible(graph: Graph, h: Heuristic): boolean {
  return (h[graph.goal] ?? 0) === 0 && admissibilityViolations(graph, h).length === 0;
}

export function isConsistent(graph: Graph, h: Heuristic): boolean {
  return (h[graph.goal] ?? 0) === 0 && consistencyViolations(graph, h).length === 0;
}
