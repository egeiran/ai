// Spilltilstanden. Hvert trekk spilleren gjør sjekkes mot motoren (src/engine).

import { create } from "zustand";
import type { NodeId } from "../engine/graph";
import { admissibilityViolations, isConsistent } from "../engine/heuristic";
import {
  initSearch,
  nextIndex,
  runSearch,
  step,
  type SearchState,
  type StepResult,
} from "../engine/search";
import { LEVELS, levelById, type LevelId, type Phase } from "./levels";
import { describeStep, explainWrongPick, listNo } from "./narrate";

export type Screen = "menu" | "level";
export type View = "world" | "graph";
export type QualityLevel = "lav" | "middels" | "hoy" | "ultra";
export type QualityMode = "auto" | QualityLevel;
export type MessageKind = "info" | "good" | "bad";

export interface Message {
  kind: MessageKind;
  text: string;
  /** Øker for hver ny melding, så UI kan animere den inn. */
  id: number;
}

export interface Progress {
  stars: number;
}

interface GameState {
  screen: Screen;
  levelId: LevelId;
  phase: Phase | "done";
  search: SearchState | null;
  lastStep: StepResult | null;
  h: Record<NodeId, number>;
  liars: NodeId[];
  mistakes: number;
  /** Siste feilklikk, så scenen kan riste riktig kasse. */
  wrongPick: { order: number; at: number } | null;
  message: Message;
  /** Logg over stegene i dette forsøket (siste først). */
  log: string[];
  view: View;
  hints: boolean;
  autoRunning: boolean;
  /** Antall ekspansjoner i siste A*-kjøring (bygg om). */
  lastRunExpansions: number | null;
  qualityMode: QualityMode;
  qualityLevel: QualityLevel;
  fps: number;
  progress: Partial<Record<LevelId, Progress>>;

  openMenu: () => void;
  startLevel: (id: LevelId) => void;
  pick: (frontierIndex: number) => void;
  setH: (id: NodeId, value: number) => void;
  testSigns: () => void;
  runAuto: () => void;
  stopAuto: () => void;
  restartLevel: () => void;
  setView: (v: View) => void;
  toggleHints: () => void;
  setQualityMode: (m: QualityMode) => void;
  setQualityLevel: (l: QualityLevel) => void;
  setFps: (fps: number) => void;
}

const STORAGE_KEY = "frontier.progress.v1";

function loadProgress(): Partial<Record<LevelId, Progress>> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Partial<Record<LevelId, Progress>>) : {};
  } catch {
    return {};
  }
}

function saveProgress(p: Partial<Record<LevelId, Progress>>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
  } catch {
    // Lagring er en bekvemmelighet; spillet virker uten.
  }
}

let msgId = 0;
const msg = (kind: MessageKind, text: string): Message => ({ kind, text, id: ++msgId });

function zeroH(id: LevelId): Record<NodeId, number> {
  return Object.fromEntries(levelById(id).graph.nodes.map((n) => [n.id, 0]));
}

function starsFor(mistakes: number): number {
  return mistakes === 0 ? 3 : mistakes <= 2 ? 2 : 1;
}

function isUnlocked(id: LevelId, progress: Partial<Record<LevelId, Progress>>): boolean {
  const i = LEVELS.findIndex((l) => l.id === id);
  return i <= 0 || !!progress[LEVELS[i - 1]!.id];
}

let autoTimer: ReturnType<typeof setInterval> | null = null;
function clearAuto() {
  if (autoTimer) clearInterval(autoTimer);
  autoTimer = null;
}

export const useGame = create<GameState>((set, get) => {
  /** Starter sporingen med nåværende heuristikk. */
  const beginTrace = () => {
    const level = levelById(get().levelId);
    const search = initSearch(
      level.graph,
      level.algorithm,
      level.algorithm === "astar" ? get().h : undefined,
    );
    set({
      phase: "trace",
      search,
      lastStep: null,
      mistakes: 0,
      log: [],
      message: msg("info", "Bare S ligger på båndet. Klikk kassen for å utforske rommet."),
    });
  };

  /** Kalles når søket i sporingsfasen er ferdig. */
  const finishTrace = (state: SearchState) => {
    const level = levelById(get().levelId);
    if (state.status === "failure") {
      set({ message: msg("bad", "Frontier ble tom uten at målet ble funnet.") });
      return;
    }
    if (level.id === "astar") {
      const n = state.expanded.length;
      const ok = n <= (level.maxExpansions ?? Infinity);
      set({
        phase: ok ? "done" : "tune",
        lastRunExpansions: n,
        message: ok
          ? msg(
              "good",
              `A* ekspanderte ${n} rom, mens UCS trengte 6. Skiltene dine sparte KAI for omveier.`,
            )
          : msg(
              "info",
              `A* ekspanderte ${n} rom, like mange som UCS uten skilt. Juster skiltene så A* ekspanderer høyst ${level.maxExpansions}, uten at noe skilt lyver, og trykk «Kjør A*».`,
            ),
      });
      if (ok) complete();
      return;
    }
    const res = state.result!;
    set({
      phase: "done",
      message: msg(
        "good",
        `Målet er funnet. Stien er ${res.path.join(" → ")}${level.showCosts ? `, kostnad ${res.cost}` : ""}.`,
      ),
    });
    complete();
  };

  const complete = () => {
    const { levelId, mistakes, progress, h } = get();
    const level = levelById(levelId);
    let stars = starsFor(mistakes);
    if (level.id === "astar") {
      // Én stjerne for å klare målet, én for konsistente skilt, én for feilfri sporing.
      stars = 1 + (isConsistent(level.graph, h) ? 1 : 0) + (mistakes === 0 ? 1 : 0);
    }
    const best = Math.max(stars, progress[levelId]?.stars ?? 0);
    const next = { ...progress, [levelId]: { stars: best } };
    saveProgress(next);
    set({ progress: next });
  };

  return {
    screen: "menu",
    levelId: "bfs",
    phase: "trace",
    search: null,
    lastStep: null,
    h: zeroH("bfs"),
    liars: [],
    mistakes: 0,
    wrongPick: null,
    message: msg("info", ""),
    log: [],
    view: "world",
    hints: true,
    autoRunning: false,
    lastRunExpansions: null,
    qualityMode: "auto",
    qualityLevel: "hoy",
    fps: 0,
    progress: loadProgress(),

    openMenu: () => {
      clearAuto();
      set({ screen: "menu", autoRunning: false });
    },

    startLevel: (id) => {
      clearAuto();
      if (!isUnlocked(id, get().progress)) return;
      const level = levelById(id);
      set({
        screen: "level",
        levelId: id,
        h: zeroH(id),
        liars: [],
        view: "world",
        autoRunning: false,
        lastRunExpansions: null,
        wrongPick: null,
        hints: level.number === 1 ? true : get().hints,
      });
      if (level.phases[0] === "build") {
        set({
          phase: "build",
          search: null,
          lastStep: null,
          mistakes: 0,
          log: [],
          message: msg(
            "info",
            "Sett et tall på hvert skilt: hvor mye tror du det minst koster å komme til G herfra? Trykk «Test skiltene» når du er ferdig.",
          ),
        });
      } else {
        beginTrace();
      }
    },

    restartLevel: () => get().startLevel(get().levelId),

    pick: (i) => {
      const { search, phase, hints, autoRunning } = get();
      if (!search || phase !== "trace" || search.status !== "running" || autoRunning) return;
      const level = levelById(get().levelId);
      const want = nextIndex(search);
      if (i !== want) {
        const entry = search.frontier[i];
        if (!entry) return;
        set({
          mistakes: get().mistakes + 1,
          wrongPick: { order: entry.order, at: performance.now() },
          message: msg("bad", explainWrongPick(search, i, hints)),
        });
        return;
      }
      const r = step(level.graph, search, level.algorithm === "astar" ? get().h : undefined);
      const text = describeStep(r);
      set({
        search: r.state,
        lastStep: r,
        message: msg(r.state.status === "found" ? "good" : "info", text),
        log: [text, ...get().log].slice(0, 30),
      });
      if (r.state.status !== "running") finishTrace(r.state);
    },

    setH: (id, value) => {
      const level = levelById(get().levelId);
      if (id === level.graph.goal) return;
      const v = Math.max(0, Math.min(20, Math.round(value)));
      set({ h: { ...get().h, [id]: v }, liars: get().liars.filter((x) => x !== id) });
    },

    testSigns: () => {
      const level = levelById(get().levelId);
      const v = admissibilityViolations(level.graph, get().h);
      if (v.length) {
        const ids = v.map((x) => x.id);
        set({
          liars: ids,
          message: msg(
            "bad",
            `${ids.length === 1 ? "Skiltet" : "Skiltene"} ved ${listNo(ids)} sier at det er lenger igjen enn det egentlig er. ${ids.length === 1 ? "Det overestimerer" : "De overestimerer"}, så heuristikken er ikke admissibel. Senk ${ids.length === 1 ? "det" : "dem"} og test igjen.`,
          ),
        });
        return;
      }
      set({ liars: [] });
      if (get().phase === "build") {
        beginTrace();
        set({
          message: msg(
            "good",
            "Ingen skilt lyver, så heuristikken er admissibel. Nå sporer du A* med dem: kassene viser g og h, og A* tar ut lavest f = g + h.",
          ),
        });
      }
    },

    runAuto: () => {
      const level = levelById(get().levelId);
      const v = admissibilityViolations(level.graph, get().h);
      if (v.length) {
        set({
          liars: v.map((x) => x.id),
          message: msg(
            "bad",
            `Skiltet ved ${listNo(v.map((x) => x.id))} lyver. Fiks det før du kjører.`,
          ),
        });
        return;
      }
      clearAuto();
      const run = runSearch(level.graph, level.algorithm, get().h);
      let state = initSearch(level.graph, level.algorithm, get().h);
      let k = 0;
      set({
        search: state,
        lastStep: null,
        autoRunning: true,
        liars: [],
        message: msg("info", "KAI kjører A* med skiltene dine …"),
      });
      const reduce =
        typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
      autoTimer = setInterval(
        () => {
          const r = run.steps[k++];
          if (!r) {
            clearAuto();
            set({ autoRunning: false });
            const n = state.expanded.length;
            const max = level.maxExpansions ?? Infinity;
            if (n <= max) {
              set({
                phase: "done",
                lastRunExpansions: n,
                message: msg(
                  "good",
                  `A* ekspanderte ${n} rom, mens UCS trengte 6. Skiltene dine sparte KAI for omveier.`,
                ),
              });
              complete();
            } else {
              const c = state.expanded.filter((x) => !run.final.result?.path.includes(x));
              set({
                lastRunExpansions: n,
                message: msg(
                  "info",
                  `A* ekspanderte ${n} rom. ${c.length ? `${listNo(c)} ligger ikke på den billigste veien, men ble likevel utforsket.` : ""} Gjør skiltene sterkere der, uten at de lyver.`,
                ),
              });
            }
            return;
          }
          state = r.state;
          set({ search: r.state, lastStep: r });
        },
        reduce ? 200 : 900,
      );
    },

    stopAuto: () => {
      clearAuto();
      set({ autoRunning: false });
    },

    setView: (view) => set({ view }),
    toggleHints: () => set({ hints: !get().hints }),
    setQualityMode: (m) => set({ qualityMode: m, qualityLevel: m === "auto" ? "hoy" : m }),
    setQualityLevel: (l) => set({ qualityLevel: l }),
    setFps: (fps) => set({ fps }),
  };
});

export { isUnlocked };
