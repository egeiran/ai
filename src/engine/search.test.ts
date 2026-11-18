import { describe, expect, it } from "vitest";
import type { Graph } from "./graph";
import { formatExpansions, initSearch, nextIndex, runSearch, step } from "./search";
import {
  admissibilityViolations,
  consistencyViolations,
  isAdmissible,
  trueCosts,
} from "./heuristic";

const node = (id: string) => ({ id, x: 0, z: 0 });

// Grotta fra skissen: alle ganger koster 1.
const cave: Graph = {
  nodes: ["S", "A", "B", "C", "D", "E", "G"].map(node),
  edges: [
    { a: "S", b: "A", cost: 1 },
    { a: "S", b: "B", cost: 1 },
    { a: "A", b: "C", cost: 1 },
    { a: "A", b: "D", cost: 1 },
    { a: "B", b: "D", cost: 1 },
    { a: "B", b: "E", cost: 1 },
    { a: "C", b: "G", cost: 1 },
    { a: "E", b: "G", cost: 1 },
  ],
  start: "S",
  goal: "G",
};

// Liten graf med decrease-key på B, C og G.
const weighted: Graph = {
  nodes: ["S", "A", "B", "C", "G"].map(node),
  edges: [
    { a: "S", b: "A", cost: 1 },
    { a: "S", b: "B", cost: 4 },
    { a: "A", b: "B", cost: 2 },
    { a: "A", b: "C", cost: 5 },
    { a: "B", b: "C", cost: 1 },
    { a: "C", b: "G", cost: 3 },
    { a: "B", b: "G", cost: 6 },
  ],
  start: "S",
  goal: "G",
};

describe("BFS", () => {
  it("måltester ved generering og ekspanderer aldri målet", () => {
    const run = runSearch(cave, "bfs");
    expect(run.final.status).toBe("found");
    expect(run.final.expanded).toEqual(["S", "A", "B", "C"]);
    expect(formatExpansions(run.final)).toBe("S, A, B, C");
    expect(run.final.result).toEqual({
      path: ["S", "A", "C", "G"],
      cost: 3,
      goalTestAt: "generation",
    });
  });

  it("legger ikke inn en node som allerede er nådd", () => {
    let s = initSearch(cave, "bfs");
    s = step(cave, s).state; // S
    s = step(cave, s).state; // A: legger inn C, D
    const r = step(cave, s); // B: D er nådd, E er ny
    expect(r.taken.id).toBe("B");
    expect(r.children.map((c) => `${c.id}:${c.action}`)).toEqual([
      "D:reached",
      "E:added",
      "S:reached",
    ]);
    expect(r.state.frontier.map((e) => e.id)).toEqual(["C", "D", "E"]);
  });

  it("tar alltid ut den eldste posten (FIFO)", () => {
    let s = initSearch(cave, "bfs");
    s = step(cave, s).state;
    expect(s.frontier.map((e) => e.id)).toEqual(["A", "B"]);
    expect(nextIndex(s)).toBe(0);
  });
});

describe("UCS", () => {
  it("bruker decrease-key og måltester ved uttak", () => {
    const run = runSearch(weighted, "ucs");
    expect(formatExpansions(run.final)).toBe("S, A, B, C, (G)");
    expect(run.final.result).toEqual({
      path: ["S", "A", "B", "C", "G"],
      cost: 7,
      goalTestAt: "pop",
    });
    const afterA = run.steps[1]!;
    expect(afterA.children.find((c) => c.id === "B")).toMatchObject({
      action: "updated",
      g: 3,
      previousG: 4,
    });
  });

  it("oppdaterer bare når den nye stien er strengt billigere", () => {
    const g: Graph = {
      nodes: ["S", "A", "B", "G"].map(node),
      edges: [
        { a: "S", b: "A", cost: 2 },
        { a: "S", b: "B", cost: 3 },
        { a: "A", b: "B", cost: 1 },
        { a: "B", b: "G", cost: 1 },
      ],
      start: "S",
      goal: "G",
    };
    const run = runSearch(g, "ucs");
    const atA = run.steps[1]!;
    expect(atA.taken.id).toBe("A");
    expect(atA.children.find((c) => c.id === "B")).toMatchObject({
      action: "reached",
      g: 3,
      previousG: 3,
    });
    expect(run.final.reached["B"]).toEqual({ g: 3, parent: "S" });
  });

  it("bryter lik prioritet alfabetisk", () => {
    const g: Graph = {
      nodes: ["S", "B", "A", "G"].map(node),
      edges: [
        { a: "S", b: "B", cost: 2 },
        { a: "S", b: "A", cost: 2 },
        { a: "A", b: "G", cost: 5 },
        { a: "B", b: "G", cost: 5 },
      ],
      start: "S",
      goal: "G",
    };
    const run = runSearch(g, "ucs");
    expect(formatExpansions(run.final)).toBe("S, A, B, (G)");
    expect(run.final.result?.path).toEqual(["S", "A", "G"]);
  });
});

describe("A*", () => {
  const h = { S: 6, A: 5, B: 3, C: 2, G: 0 };

  it("finner den billigste stien med admissibel h", () => {
    expect(isAdmissible(weighted, h)).toBe(true);
    const run = runSearch(weighted, "astar", h);
    expect(formatExpansions(run.final)).toBe("S, A, B, C, (G)");
    expect(run.final.result?.cost).toBe(7);
  });

  it("gjenåpner en ekspandert node når en billigere sti dukker opp", () => {
    const g: Graph = {
      nodes: ["S", "A", "B", "G"].map(node),
      edges: [
        { a: "S", b: "A", cost: 3 },
        { a: "S", b: "B", cost: 1 },
        { a: "B", b: "A", cost: 1 },
        { a: "A", b: "G", cost: 3 },
      ],
      start: "S",
      goal: "G",
    };
    const hh = { S: 0, A: 0, B: 4, G: 0 };
    expect(isAdmissible(g, hh)).toBe(true);
    expect(consistencyViolations(g, hh).length).toBeGreaterThan(0);
    const run = runSearch(g, "astar", hh);
    expect(formatExpansions(run.final)).toBe("S, A, B, A, (G)");
    const atB = run.steps[2]!;
    expect(atB.children.find((c) => c.id === "A")).toMatchObject({
      action: "reopened",
      g: 2,
      previousG: 3,
    });
    expect(run.final.result).toMatchObject({ path: ["S", "B", "A", "G"], cost: 5 });
  });

  it("krever h for alle noder", () => {
    expect(() => initSearch(weighted, "astar", { S: 1 })).toThrow(RangeError);
  });
});

describe("heuristikker", () => {
  it("regner h* baklengs fra målet", () => {
    expect(trueCosts(weighted)).toEqual({ S: 7, A: 6, B: 4, C: 3, G: 0 });
  });

  it("finner skilt som overestimerer", () => {
    expect(admissibilityViolations(weighted, { S: 7, A: 7, B: 4, C: 3, G: 0 })).toEqual([
      { id: "A", h: 7, hStar: 6 },
    ]);
  });

  it("sjekker konsistens i begge retninger", () => {
    const v = consistencyViolations(weighted, { S: 0, A: 6, B: 1, C: 3, G: 0 });
    expect(v).toContainEqual({ from: "A", to: "B", cost: 2, hFrom: 6, hTo: 1 });
    expect(v).toContainEqual({ from: "A", to: "S", cost: 1, hFrom: 6, hTo: 0 });
  });
});
