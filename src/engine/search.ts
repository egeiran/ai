// Søkemotoren for Gruvesjaktene: BFS, UCS og A* som graf-søk.
//
// Konvensjoner (samme som TDT4136 i Kort-Forklart, docs/ai/exam-conventions.md § 1):
// - Barn genereres i alfabetisk rekkefølge.
// - BFS: FIFO-kø, måltest ved generering (tidlig). En node som er nådd, legges ikke inn igjen.
//   Målnoden ekspanderes aldri og står ikke i ekspansjonsrekkefølgen.
// - UCS og A*: prioritetskø på g (UCS) eller f = g + h (A*), måltest ved uttak (sen).
//   Lik prioritet → alfabetisk laveste id. En node legges inn når den ikke er nådd, eller når
//   den nye stien er strengt billigere enn den i reached (gjenåpning, R&N 4. utg.).
//   Billigere sti til en node i frontier er decrease-key: den gamle posten fjernes.
// - En ekspansjon er en node som tas ut og får barna sine generert. Målet som tas ut ved sen
//   måltest, skrives (G) og telles ikke som ekspansjon.
//
// Alle funksjoner er rene: de tar en tilstand og gir en ny.

import { adjacency, compareIds, type Graph, type Neighbor, type NodeId } from "./graph";

export type Algorithm = "bfs" | "ucs" | "astar";

export const ALGORITHM_NAMES: Record<Algorithm, string> = {
  bfs: "BFS",
  ucs: "UCS",
  astar: "A*",
};

export type Heuristic = Readonly<Record<NodeId, number>>;

export interface FrontierEntry {
  id: NodeId;
  g: number;
  h: number;
  /** Prioriteten køen bruker: g (UCS), g + h (A*). BFS bruker innsettingsrekkefølgen. */
  priority: number;
  parent: NodeId | null;
  /** Innsettingsnummer. En oppdatert post får nytt nummer, siden den legges inn på nytt. */
  order: number;
}

/**
 * Hva som skjedde med ett barn da en node ble ekspandert.
 * - `added`: ny post i frontier.
 * - `updated`: billigere sti til en node i frontier (decrease-key).
 * - `reopened`: billigere sti til en node som allerede er ekspandert; den legges inn igjen.
 * - `reached`: allerede nådd, og den nye stien er ikke strengt billigere.
 * - `goal`: målet ble generert (BFS, tidlig måltest). Søket stopper.
 */
export type ChildAction = "added" | "updated" | "reopened" | "reached" | "goal";

export interface ChildEvent {
  id: NodeId;
  cost: number;
  g: number;
  /** g i reached før denne ekspansjonen, hvis noden var nådd. */
  previousG?: number;
  action: ChildAction;
}

export type SearchStatus = "running" | "found" | "failure";

export interface SearchState {
  algorithm: Algorithm;
  /** Frontier i innsettingsrekkefølge (slik den står på båndet i spillet). */
  frontier: FrontierEntry[];
  reached: Record<NodeId, { g: number; parent: NodeId | null }>;
  /** Ekspanderte noder i rekkefølge. Samme node kan stå flere ganger ved gjenåpning. */
  expanded: NodeId[];
  status: SearchStatus;
  /** Satt når målet er funnet. */
  result?: { path: NodeId[]; cost: number; goalTestAt: "generation" | "pop" };
  nextOrder: number;
}

export interface StepResult {
  state: SearchState;
  /** Posten som ble tatt ut. */
  taken: FrontierEntry;
  /** `expand`: noden ble ekspandert. `goal`: målet ble tatt ut og testet (sen måltest). */
  kind: "expand" | "goal";
  children: ChildEvent[];
}

function hOf(h: Heuristic | undefined, id: NodeId): number {
  const v = h?.[id];
  return v === undefined ? 0 : v;
}

function priorityOf(alg: Algorithm, g: number, h: number): number {
  return alg === "astar" ? g + h : g;
}

function requireHeuristic(graph: Graph, alg: Algorithm, h: Heuristic | undefined) {
  if (alg !== "astar") return;
  for (const n of graph.nodes) {
    const v = h?.[n.id];
    if (v === undefined || !Number.isFinite(v) || v < 0) {
      throw new RangeError(`A* krever en ikke-negativ h(${n.id})`);
    }
  }
}

export function initSearch(graph: Graph, alg: Algorithm, h?: Heuristic): SearchState {
  requireHeuristic(graph, alg, h);
  const h0 = hOf(h, graph.start);
  const base: SearchState = {
    algorithm: alg,
    frontier: [
      {
        id: graph.start,
        g: 0,
        h: h0,
        priority: priorityOf(alg, 0, h0),
        parent: null,
        order: 0,
      },
    ],
    reached: { [graph.start]: { g: 0, parent: null } },
    expanded: [],
    status: "running",
    nextOrder: 1,
  };
  // BFS med tidlig måltest: er starten målet, er søket ferdig før det begynner.
  if (alg === "bfs" && graph.start === graph.goal) {
    return {
      ...base,
      frontier: [],
      status: "found",
      result: { path: [graph.start], cost: 0, goalTestAt: "generation" },
    };
  }
  return base;
}

/** Sammenligning for uttak. Negativ = `a` tas ut før `b`. */
export function compareEntries(alg: Algorithm, a: FrontierEntry, b: FrontierEntry): number {
  if (alg === "bfs") return a.order - b.order;
  return a.priority - b.priority || compareIds(a.id, b.id) || a.order - b.order;
}

/** Indeksen (i `state.frontier`) til posten algoritmen tar ut neste gang, eller -1. */
export function nextIndex(state: SearchState): number {
  if (state.status !== "running" || state.frontier.length === 0) return -1;
  let best = 0;
  for (let i = 1; i < state.frontier.length; i++) {
    const cand = state.frontier[i]!;
    const cur = state.frontier[best]!;
    if (compareEntries(state.algorithm, cand, cur) < 0) best = i;
  }
  return best;
}

/** Stien fra start til `id` etter foreldrepekerne i reached. */
export function pathTo(state: SearchState, id: NodeId): NodeId[] {
  const path: NodeId[] = [];
  let cur: NodeId | null = id;
  const guard = new Set<NodeId>();
  while (cur !== null) {
    if (guard.has(cur)) throw new Error("Løkke i foreldrepekerne");
    guard.add(cur);
    path.unshift(cur);
    cur = state.reached[cur]?.parent ?? null;
  }
  return path;
}

/** Tar ut neste post etter algoritmens regler og ekspanderer den (eller måltester den). */
export function step(
  graph: Graph,
  state: SearchState,
  h?: Heuristic,
  adj?: Map<NodeId, Neighbor[]>,
): StepResult {
  const idx = nextIndex(state);
  if (idx < 0) throw new Error("Søket er ferdig: frontier er tom eller målet er funnet");
  const alg = state.algorithm;
  const neighbors = adj ?? adjacency(graph);
  const frontier = state.frontier.slice();
  const taken = frontier.splice(idx, 1)[0]!;
  const reached = { ...state.reached };
  let nextOrder = state.nextOrder;

  // Sen måltest (UCS, A*): målet tas ut, testes og ekspanderes ikke.
  if (alg !== "bfs" && taken.id === graph.goal) {
    const next: SearchState = {
      ...state,
      frontier,
      reached,
      status: "found",
      result: { path: pathTo({ ...state, reached }, taken.id), cost: taken.g, goalTestAt: "pop" },
    };
    return { state: next, taken, kind: "goal", children: [] };
  }

  const expanded = [...state.expanded, taken.id];
  const children: ChildEvent[] = [];
  let status: SearchStatus = "running";
  let result: SearchState["result"];

  for (const nb of neighbors.get(taken.id) ?? []) {
    const g = taken.g + nb.cost;
    const prev = reached[nb.id];

    if (alg === "bfs") {
      // Tidlig måltest skjer før nådd-sjekken.
      if (nb.id === graph.goal) {
        reached[nb.id] = { g, parent: taken.id };
        children.push({ id: nb.id, cost: nb.cost, g, action: "goal", previousG: prev?.g });
        status = "found";
        const tmp: SearchState = { ...state, reached };
        result = { path: pathTo(tmp, nb.id), cost: g, goalTestAt: "generation" };
        break;
      }
      if (prev) {
        children.push({ id: nb.id, cost: nb.cost, g, action: "reached", previousG: prev.g });
        continue;
      }
      reached[nb.id] = { g, parent: taken.id };
      frontier.push({ id: nb.id, g, h: 0, priority: g, parent: taken.id, order: nextOrder++ });
      children.push({ id: nb.id, cost: nb.cost, g, action: "added" });
      continue;
    }

    if (prev && g >= prev.g) {
      children.push({ id: nb.id, cost: nb.cost, g, action: "reached", previousG: prev.g });
      continue;
    }
    const hv = hOf(h, nb.id);
    const inFrontier = frontier.findIndex((e) => e.id === nb.id);
    let action: ChildAction = "added";
    if (inFrontier >= 0) {
      frontier.splice(inFrontier, 1);
      action = "updated";
    } else if (prev) {
      action = "reopened";
    }
    reached[nb.id] = { g, parent: taken.id };
    frontier.push({
      id: nb.id,
      g,
      h: hv,
      priority: priorityOf(alg, g, hv),
      parent: taken.id,
      order: nextOrder++,
    });
    children.push({ id: nb.id, cost: nb.cost, g, action, previousG: prev?.g });
  }

  if (status === "running" && frontier.length === 0) status = "failure";
  const next: SearchState = {
    ...state,
    frontier: status === "found" ? frontier : frontier,
    reached,
    expanded,
    status,
    result,
    nextOrder,
  };
  return { state: next, taken, kind: "expand", children };
}

export interface SearchRun {
  steps: StepResult[];
  final: SearchState;
}

/** Kjører søket til det er ferdig. `maxSteps` sikrer mot løpske kjøringer. */
export function runSearch(graph: Graph, alg: Algorithm, h?: Heuristic, maxSteps = 500): SearchRun {
  const adj = adjacency(graph);
  let state = initSearch(graph, alg, h);
  const steps: StepResult[] = [];
  while (state.status === "running") {
    if (steps.length >= maxSteps) throw new Error("Søket stoppet ikke innen maxSteps");
    const r = step(graph, state, h, adj);
    steps.push(r);
    state = r.state;
  }
  return { steps, final: state };
}

/**
 * Ekspansjonsrekkefølgen slik eksamen skriver den: `S, A, B, C, (G)`.
 * `(G)` = målet ble tatt ut og testet (sen måltest). Med BFS står målet ikke i listen.
 */
export function formatExpansions(state: SearchState): string {
  const parts = [...state.expanded];
  if (state.result?.goalTestAt === "pop")
    parts.push(`(${state.result.path[state.result.path.length - 1]})`);
  return parts.join(", ");
}
