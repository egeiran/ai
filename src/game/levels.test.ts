import { describe, expect, it } from "vitest";
import { adjacency } from "../engine/graph";
import { trueCosts, isAdmissible } from "../engine/heuristic";
import { formatExpansions, runSearch } from "../engine/search";
import { LEVELS, levelById } from "./levels";

describe("nivåene", () => {
  it("har gyldige grafer der målet kan nås", () => {
    for (const l of LEVELS) {
      expect(() => adjacency(l.graph)).not.toThrow();
      expect(trueCosts(l.graph)[l.graph.start]).toBeLessThan(Infinity);
    }
  });

  it("nivå 1 (BFS) stopper når G genereres fra C", () => {
    const run = runSearch(levelById("bfs").graph, "bfs");
    expect(formatExpansions(run.final)).toBe("S, A, B, C");
    expect(run.final.result?.path).toEqual(["S", "A", "C", "G"]);
  });

  it("nivå 2 (UCS) har decrease-key og et ikke-strengt tilfelle", () => {
    const run = runSearch(levelById("ucs").graph, "ucs");
    expect(formatExpansions(run.final)).toBe("S, A, B, D, C, E, (G)");
    expect(run.final.result).toMatchObject({ path: ["S", "A", "D", "E", "G"], cost: 9 });
    const actions = run.steps.flatMap((s) =>
      s.children.map((c) => `${s.taken.id}>${c.id}:${c.action}`),
    );
    expect(actions).toContain("A>B:updated");
    expect(actions).toContain("B>D:reached");
    expect(actions).toContain("D>E:updated");
    expect(actions).toContain("E>G:updated");
  });

  it("nivå 3 (A*) kan klares innenfor målet med en admissibel heuristikk", () => {
    const level = levelById("astar");
    const hStar = trueCosts(level.graph);
    expect(hStar).toEqual({ S: 9, A: 7, B: 5, C: 7, D: 4, E: 2, G: 0 });
    const best = runSearch(level.graph, "astar", hStar);
    expect(formatExpansions(best.final)).toBe("S, A, B, D, E, (G)");
    expect(best.final.expanded.length).toBeLessThanOrEqual(level.maxExpansions!);

    // Uten skilt (h = 0) er A* det samme som UCS og bruker for mange ekspansjoner.
    const zero = Object.fromEntries(level.graph.nodes.map((n) => [n.id, 0]));
    expect(isAdmissible(level.graph, zero)).toBe(true);
    expect(runSearch(level.graph, "astar", zero).final.expanded.length).toBe(6);

    // Skiltet ved C må være sterkt nok (h(C) ≥ 4) for at C ikke skal ekspanderes.
    const weakC = { ...hStar, C: 3 };
    expect(runSearch(level.graph, "astar", weakC).final.expanded).toContain("C");
    const okC = { ...hStar, C: 4 };
    expect(runSearch(level.graph, "astar", okC).final.expanded).not.toContain("C");
  });
});
