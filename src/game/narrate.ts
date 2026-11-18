// Forklaringene spilleren får etter hvert trekk. Norsk, med engelsk fagbegrep der det hjelper.

import { compareIds } from "../engine/graph";
import {
  compareEntries,
  nextIndex,
  type FrontierEntry,
  type SearchState,
  type StepResult,
} from "../engine/search";

export function listNo(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} og ${items[items.length - 1]}`;
}

function fText(e: FrontierEntry): string {
  return `f = ${e.g} + ${e.h} = ${e.priority}`;
}

/** Hva som skjedde i ett steg, i én eller to setninger. */
export function describeStep(r: StepResult): string {
  const alg = r.state.algorithm;
  const t = r.taken;
  if (r.kind === "goal") {
    const res = r.state.result!;
    return `${t.id} tas ut med g = ${t.g} og måltestes: målet er funnet. Stien er ${res.path.join(" → ")}, kostnad ${res.cost}.`;
  }

  const goal = r.children.find((c) => c.action === "goal");
  if (goal) {
    const res = r.state.result!;
    return `Utforsket ${t.id}. ${goal.id} ble generert, og BFS måltester ved generering, så søket stopper her. Stien er ${res.path.join(" → ")}.`;
  }

  if (alg === "bfs") {
    const added = r.children.filter((c) => c.action === "added").map((c) => c.id);
    const seen = r.children.filter((c) => c.action === "reached").map((c) => c.id);
    let s = `Utforsket ${t.id}.`;
    s += added.length ? ` ${listNo(added)} ble lagt bakerst i køen.` : " Ingen nye rom.";
    if (seen.length) s += ` ${listNo(seen)} er allerede nådd (reached) og legges ikke inn igjen.`;
    return s;
  }

  const head = alg === "astar" ? `Tok ut ${t.id} (${fText(t)}).` : `Tok ut ${t.id} (g = ${t.g}).`;
  const parts: string[] = [];
  for (const c of r.children) {
    const sum = `${t.g} + ${c.cost} = ${c.g}`;
    if (c.action === "added") parts.push(`${c.id}: ${sum}, lagt inn.`);
    else if (c.action === "updated")
      parts.push(
        `${c.id}: ${sum} er billigere enn ${c.previousG}, så posten oppdateres (decrease-key).`,
      );
    else if (c.action === "reopened")
      parts.push(
        `${c.id}: ${sum} er billigere enn ${c.previousG}. Rommet er utforsket før, men åpnes igjen.`,
      );
    else if (c.action === "reached" && c.previousG !== undefined && c.g === c.previousG)
      parts.push(
        `${c.id}: ${sum} er ikke strengt billigere enn ${c.previousG}, så den blir liggende.`,
      );
  }
  if (r.state.status === "failure") parts.push("Frontier er tom: det finnes ingen vei til målet.");
  return [head, ...parts].join(" ");
}

/** Forklaring når spilleren klikker feil kasse. Med hint nevnes riktig kasse. */
export function explainWrongPick(state: SearchState, picked: number, hints: boolean): string {
  const alg = state.algorithm;
  const want = nextIndex(state);
  const p = state.frontier[picked]!;
  const w = state.frontier[want]!;
  if (alg === "bfs") {
    return hints
      ? `Ikke ${p.id}. BFS er en kø: rommet som har ventet lengst, tas ut først. Det er ${w.id}.`
      : `Ikke ${p.id}. BFS er en kø (først inn, først ut).`;
  }
  const label = alg === "astar" ? "f" : "g";
  const pv = p.priority;
  const wv = w.priority;
  if (pv === wv && compareEntries(alg, w, p) < 0) {
    return `${p.id} og ${w.id} har samme ${label} (${pv}). Ved lik verdi går den alfabetisk første foran${hints ? `: ${w.id}` : ""}.`;
  }
  if (alg === "astar") {
    const pf = `${p.id}: ${fText(p)}`;
    return hints
      ? `Ikke ${p.id}. A* tar ut posten med lavest f = g + h. ${pf}, men ${w.id} har ${fText(w)}.`
      : `Ikke ${p.id}. A* tar ut posten med lavest f = g + h, og ${p.id} har f = ${p.priority}. Det finnes en lavere.`;
  }
  return hints
    ? `Ikke ${p.id} (g = ${p.g}). UCS tar ut posten med lavest g. Det er ${w.id} med g = ${w.g}.`
    : `Ikke ${p.id} (g = ${p.g}). UCS tar ut posten med lavest g, og det finnes en lavere.`;
}

/** Sortert kopi av frontier for visning i fasit-rekkefølge (brukes bare i hint). */
export function sortedFrontier(state: SearchState): FrontierEntry[] {
  return [...state.frontier].sort(
    (a, b) => compareEntries(state.algorithm, a, b) || compareIds(a.id, b.id),
  );
}
