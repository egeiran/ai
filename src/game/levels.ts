// Nivåene i Gruvesjaktene. Hvert nivå er en grotte (graf) og en algoritme.
// Fasitene er låst i levels.test.ts og regnes ut av motoren, aldri for hånd i koden.

import type { Graph } from "../engine/graph";
import type { Algorithm } from "../engine/search";

export type LevelId = "bfs" | "ucs" | "astar";
export type Phase = "build" | "trace" | "tune";

export interface Level {
  id: LevelId;
  number: number;
  title: string;
  /** Hva grepet heter i pensum. */
  topic: string;
  algorithm: Algorithm;
  graph: Graph;
  showCosts: boolean;
  /** Fasene i rekkefølge. Spor = trace, bygg = build, bygg om = tune. */
  phases: Phase[];
  /** Det KAI sier når nivået starter. KAI blir klarere for hvert nivå. */
  intro: string;
  /** Det KAI sier når nivået er klart. */
  outro: string;
  goal: string;
  /** Reglene som avgjør svaret, slik en eksamensoppgave oppgir dem. */
  rules: string[];
  /** Bygg om: høyeste antall ekspansjoner som godkjennes. */
  maxExpansions?: number;
}

// Grotta fra skissen: sju rom, alle ganger like lange.
const shaft1: Graph = {
  nodes: [
    { id: "S", x: -5.75, z: 0.03, r: 1.0, name: "Sjaktinngangen" },
    { id: "A", x: -2.38, z: -2.33, r: 0.92 },
    { id: "B", x: -2.5, z: 2.33, r: 0.92 },
    { id: "C", x: 1.5, z: -2.83, r: 0.92 },
    { id: "D", x: 1.13, z: 0.13, r: 0.92 },
    { id: "E", x: 1.8, z: 2.83, r: 0.92 },
    { id: "G", x: 5.75, z: -0.13, r: 1.25, name: "Krystallhula" },
  ],
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

// Den dype sjakta: gangene har ulik kostnad (ras, vann, smale passasjer).
const shaft2: Graph = {
  nodes: [
    { id: "S", x: -5.6, z: 0.2, r: 1.0, name: "Heisen" },
    { id: "A", x: -2.8, z: -2.4, r: 0.92 },
    { id: "B", x: -2.6, z: 2.3, r: 0.92 },
    { id: "C", x: 0.4, z: -2.6, r: 0.92 },
    { id: "D", x: 0.2, z: 0.4, r: 0.92 },
    { id: "E", x: 2.8, z: 2.6, r: 0.92 },
    { id: "G", x: 5.6, z: -0.3, r: 1.25, name: "Kjernekammeret" },
  ],
  edges: [
    { a: "S", b: "A", cost: 2 },
    { a: "S", b: "B", cost: 5 },
    { a: "A", b: "B", cost: 2 },
    { a: "A", b: "C", cost: 4 },
    { a: "A", b: "D", cost: 3 },
    { a: "B", b: "D", cost: 1 },
    { a: "B", b: "E", cost: 6 },
    { a: "C", b: "G", cost: 7 },
    { a: "D", b: "E", cost: 2 },
    { a: "E", b: "G", cost: 2 },
  ],
  start: "S",
  goal: "G",
};

export const LEVELS: Level[] = [
  {
    id: "bfs",
    number: 1,
    title: "Transportbåndet",
    topic: "Bredde-først-søk (BFS)",
    algorithm: "bfs",
    graph: shaft1,
    showCosts: false,
    phases: ["trace"],
    intro:
      "…kø… jeg husker ikke hvordan en kø virker. Rommene jeg vet om, ligger på båndet. Vis meg hvilket jeg skal utforske først.",
    outro: "Først inn, først ut. Jeg husker det nå. Takk.",
    goal: "Før vedlikeholdsroboten fra S til krystallhula G. Klikk kassen BFS tar ut neste gang.",
    rules: [
      "Graf-søk: et rom som er nådd, legges ikke inn igjen.",
      "Barn genereres i alfabetisk rekkefølge og legges inn bakerst.",
      "BFS måltester når et rom genereres, ikke når det tas ut.",
    ],
  },
  {
    id: "ucs",
    number: 2,
    title: "Vekta",
    topic: "Uniform-kostnad-søk (UCS)",
    algorithm: "ucs",
    graph: shaft2,
    showCosts: true,
    phases: ["trace"],
    intro:
      "Gangene her er ikke like tunge å komme gjennom. Tallene viser hva hver av dem koster. Jeg trenger den billigste veien, ikke den med færrest rom.",
    outro:
      "Billigst først. Nå skjønner jeg hvorfor jeg ikke kan stole på den første veien jeg ser.",
    goal: "Finn den billigste veien til kjernekammeret G. Kassene viser stikostnaden g.",
    rules: [
      "Prioritetskø på g, stikostnaden fra S. Lik g: alfabetisk første går foran.",
      "Et rom legges inn igjen bare hvis den nye stien er strengt billigere (decrease-key).",
      "UCS måltester når et rom tas ut.",
    ],
  },
  {
    id: "astar",
    number: 3,
    title: "Skiltene",
    topic: "A* og heuristikker",
    algorithm: "astar",
    graph: shaft2,
    showCosts: true,
    phases: ["build", "trace", "tune"],
    intro:
      "Jeg kan gjette hvor langt det er igjen fra hvert rom, men jeg trenger skilt. Sett dem opp, og ikke la dem lyve: et skilt som sier at det er lenger igjen enn det egentlig er, kan få meg til å velge bort den beste veien.",
    outro: "Med gode skilt leter jeg bare der det lønner seg. Jeg ser stasjonen klarere nå.",
    goal: "Sett opp heuristikk-skilt, spor A* med dem, og juster dem til A* ekspanderer høyst 5 rom.",
    rules: [
      "Prioritetskø på f = g + h. Lik f: alfabetisk første går foran.",
      "Et skilt er admissibelt når det aldri overestimerer den sanne restkostnaden h*.",
      "A* måltester når et rom tas ut. Billigere sti til et ekspandert rom åpner det igjen.",
    ],
    maxExpansions: 5,
  },
];

export function levelById(id: LevelId): Level {
  const l = LEVELS.find((x) => x.id === id);
  if (!l) throw new RangeError(`Ukjent nivå ${id}`);
  return l;
}

export function nextLevel(id: LevelId): Level | undefined {
  const i = LEVELS.findIndex((x) => x.id === id);
  return LEVELS[i + 1];
}
