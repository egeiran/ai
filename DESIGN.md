# Frontier — designdokument

> Et 3D-spill der algoritmene fra TDT4136 (Introduksjon til kunstig intelligens) er selve
> spillmekanikken. Du kommer ikke videre uten å forstå dem.
>
> Retningen ble satt i en skisse med spørsmål og svar (november 2026). Dette dokumentet er den
> kanoniske versjonen. Endrer vi retning, endrer vi her først.

## 1. Retningsvalg

| Spørsmål | Valg | Hvorfor |
|---|---|---|
| Målgruppe | TDT4136-studenter | Tett på eksamen: samme konvensjoner og oppgavetyper som faget i Kort-Forklart. |
| Spillfølelse | Rolige puslespill | Du tenker i ditt eget tempo. Ingen tidspress i sporingsoppgavene. |
| Hovedmekanikk | **Spor** og **Bygg**, blandet i hvert nivå | Spor trener håndsporing (det eksamen spør om). Bygg gir forståelse: du ser konsekvensen av valgene dine i 3D. «Forutsi» er en kort runde, ikke en egen mekanikk. |
| Kamera | Diorama på skrå ovenfra, roter og zoom | Hele nivået er synlig, og overgangen fra grotte til graf blir enkel. |
| Ramme | Reparer stasjons-KI-en KAI | Hver verden er en modul av stasjonen. Finalen handler om hva KI-en skal optimere. |
| KAI sin rolle | Hjelper som våkner | Starter nesten stum og blir klarere for hver evne du gir den tilbake. |
| Fremgang | Stasjonen bygges opp, og uendelig øving | Moduler lyser opp når de er reparert. Etterpå lager spillet nye oppgaver automatisk. |
| Språk | Norsk med engelske fagbegreper | Engelsk begrep i parentes første gang (frontier, reached, admissible), siden eksamen er på engelsk. |
| Plattform | Nettleser på PC | Mus og tastatur. Mobil kan komme senere. |
| Visuell stil | «Lykt i mørket» | Kantete lavpoly-stein i mørket. Robotens lykt, lampene og krystallene er nesten det eneste lyset. |
| Teknologi | Vite, TypeScript, React Three Fiber | Puslespill har mye grensesnitt rundt 3D-scenen, og React gjør den delen enkel. |

## 2. Kjerneidé

**Algoritmen er mekanikken.** Ingen quiz med 3D rundt. Hver handling spilleren gjør, er et steg i
en algoritme fra pensum, og spillet sjekker steget mot en motor som følger eksamenskonvensjonene.

- **Spor:** Du *er* algoritmen. Du klikker kassen algoritmen tar ut av frontier neste gang. Feil
  kasse gir en forklaring (med hint: hvilken kasse som var riktig og hvorfor).
- **Bygg:** Du setter opp det agenten bruker, for eksempel heuristikk-skilt, og ser den kjøre.
  Et skilt som overestimerer, blir avslørt før søket starter.
- **Verden ↔ graf:** Hvert nivå er både en fysisk grotte og en tilstandsgraf. «Graf»-knappen
  løfter kameraet, steinen smelter ned og grafen vokser opp. Det er problemformulering (kap 2)
  gjort synlig.
- **Trapp i hver verden:** lær grepet med hjelpemidler → bruk det uten → kombiner → sjefsnivå i
  eksamensformat. Hint kan slås av (`H`).

## 3. Rammen

Du våkner på en forskningsstasjon bygd inn i en asteroide. Stasjons-KI-en KAI er slått ut, og
bare én vedlikeholdsrobot svarer. Hver modul av stasjonen er et tema i TDT4136. Du gir KAI
tilbake én evne om gangen, og evnen er algoritmen du nettopp har lært. KAI blir klarere i talen
for hvert nivå. I kjernen til slutt er KAI hel igjen og spør hva den skal optimere: kapittel 0 og
19 (standardmodellen, verdijustering, etikk).

## 4. Stasjonens moduler

Søk, heuristikker, FOL-resolusjon og CSP kom på alle seks eksamenene i Kort-Forklart sin
analyse (`docs/ai/research.md` § 2c), så de veier tyngst.

| Modul | Kap | Mekanikk | Status |
|---|---|---|---|
| Gruvesjaktene | 2–3 | Søk og A*: frontier som transportbånd, heuristikk-skilt som kan lyve | **Spillbar skive (3 nivåer)** |
| Sikkerhetsdørene | 13–14 | FOL: dører åpnes med riktig unifikator, resolusjonsbeviset bygger broen | Idé |
| Kraftnettet | 9–10 | CSP: ingen nabomoduler med samme frekvens, AC-3 som bølge | Idé |
| Mørkesonen | 11–12 | Utsagnslogikk: gå bare inn i rom du kan bevise er trygge | Idé |
| Simulatoren | 6–7 | Minimax, alfa-beta og MCTS mot KAI i treningssimulatoren | Idé |
| Handelsdokken | 8 | Spillteori: finn Nash-likevekten før skipene velger | Idé |
| Lasterommet | 16–17 | Planlegging: handlingskort med forutsetninger og effekter | Idé |
| Overflaten | 4 | Lokalt søk: finn høyeste topp til antenna i støvtåke | Idé |
| Strålingssonen | 5 | Usikkerhet: spøkelseskopier av roboten er oppfatningstilstanden | Idé |
| Radioen | 18 | NLP: dekod nødmeldinger med n-gram, CYK som trappepyramide | Idé |
| Kjernen | 0–1, 19 | PEAS vekker roboten; finalen om hva KI-en skal optimere | Idé |

## 5. Gruvesjaktene: nivåplan

Fasitene er låst i `src/game/levels.test.ts` og regnes ut av motoren.

### Nivå 1 — Transportbåndet (BFS, spor)

Sju rom, alle ganger koster 1. Frontier er en kø på båndet: nye kasser inn til høyre.
Spilleren lærer FIFO, reached-mengden og **tidlig måltest**: søket stopper når G genereres fra C.

- Ekspansjoner: `S, A, B, C` · sti `S → A → C → G`.

### Nivå 2 — Vekta (UCS, spor)

Ny grotte med kostnader på gangene. Kassene viser g. Nivået er bygd for å vise tre ting:
decrease-key (B, E og G får billigere sti), et **ikke-strengt** tilfelle (D via B gir 5 = 5,
blir liggende) og **sen måltest**.

- Ekspansjoner: `S, A, B, D, C, E, (G)` · sti `S → A → D → E → G`, kostnad 9.
- Med hint vises reached-tabellen (rom, g, forelder), slik eksamen ber om.

### Nivå 3 — Skiltene (A*, bygg → spor → bygg om)

Samme grotte som nivå 2, så spilleren kan sammenligne med UCS (6 ekspansjoner).

1. **Bygg:** sett h på hvert skilt (G er låst til 0). «Test skiltene» avslører skilt som
   overestimerer (h > h*), uten å vise h*.
2. **Spor:** A* med spillerens h. Kassene viser g og h; med hint også f = g + h.
3. **Bygg om:** hvis A* brukte mer enn 5 ekspansjoner, justerer spilleren skiltene og kjører A*
   automatisk til målet er nådd. Lærdommen: skiltet ved C må være sterkt nok (h(C) ≥ 4) til at
   A* lar C ligge.

- h* = `S 9, A 7, B 5, C 7, D 4, E 2, G 0`. Med h = h*: `S, A, B, D, E, (G)`.
- Stjerner: én for å nå målet, én for konsistente skilt, én for feilfri sporing.

Nivå 1 og 2 gir stjerner etter antall feil (0 → 3, 1–2 → 2, ellers 1).

## 6. Konvensjoner for søk

Samme regler som TDT4136 i Kort-Forklart (`docs/ai/exam-conventions.md` § 1). Hvert nivå
oppgir reglene sine i «Regler i dette nivået», slik en eksamensoppgave gjør.

- Graf-søk med reached-tabell. Barn genereres i alfabetisk rekkefølge.
- **BFS:** FIFO, måltest ved generering, en nådd node legges ikke inn igjen. Målet står ikke i
  ekspansjonsrekkefølgen.
- **UCS / A\*:** prioritetskø på g / f = g + h, lik prioritet → alfabetisk laveste id, måltest ved
  uttak (`(G)` i rekkefølgen). Ny sti legges inn bare når den er **strengt** billigere:
  decrease-key i frontier, gjenåpning av ekspanderte noder (R&N 4. utg.).
- **Admissibel:** h(n) ≤ h*(n). **Konsistent:** h(n) ≤ c(n, n′) + h(n′) for hver kant, begge
  retninger, og h(mål) = 0.

## 7. Arkitektur

```
src/
  engine/   Ren TypeScript uten grafikk: graf, søk (BFS/UCS/A*), heuristikker. Testet med Vitest.
  game/     Nivådata, forklaringstekster og spilltilstand (zustand). Sjekker hvert trekk mot motoren.
  scene/    React Three Fiber: dioramaet (bygd fra nivåets graf), frontier-båndet, kamera, effekter.
  ui/       HUD og meny i vanlig React/DOM over lerretet.
```

- **Motoren er rene funksjoner** (`initSearch`, `step`, `nextIndex`, `runSearch`). Spillet
  spør motoren hva som er riktig neste trekk; spillet har ingen egen søkelogikk.
- **Dioramaet er ren three.js** (`scene/caveBuilder.ts`) og bygges fra en `Graph`. Nye nivåer
  trenger bare nye noder og kanter med posisjoner.
- **Frontier i to former:** 3D-kasser på båndet (diegetisk) og knapper i panelet (presist og
  tilgjengelig). Taster `1`–`9` velger kasse, `G` bytter visning, `H` slår hint av og på.

## 8. Ytelse og grafikk

Kvalitet: **Auto** (standard) starter på Høy og går ett hakk ned når bildefrekvensen ligger under
48 fps over tid. Manuelt: Lav, Middels, Høy, Ultra.

| Nivå | Oppløsning | AO (GTAO) | Skyggekart |
|---|---|---|---|
| Lav | 1× | av | 1024 / 512 |
| Middels | ≤ 1,25× | av | 2048 / 1024 |
| Høy | ≤ 1,5× | halv oppløsning | 2048 / 1024 |
| Ultra | 2× | full oppløsning | 4096 / 2048 |

Lærdommer fra skissen som er bygd inn:

- **Lykta lager skygge med et spotlys**, ikke et punktlys (ett skyggepass i stedet for seks).
- **Hovedskyggen oppdateres hvert tredje bilde.** Lite i scenen beveger seg.
- **Steiner og sviller er bakt til én geometri**, ikke instansiert. Ett draw-kall, og AO-passet
  kan ikke miste instansmatrisene.
- **GTAO-normalpasset kjøres uten scenebakgrunn.** En teksturbakgrunn tegnes ellers som en flate
  rundt origo og gir en svart flekk.
- **`scene.environmentIntensity` styrer miljølyset** (three r163+), ikke materialets
  `envMapIntensity`. Den står på 0,12 så scenen forblir mørk.
- **Ingen `backdrop-filter` over lerretet.** Uskarphet over et bilde som tegnes hvert bilde,
  kostet merkbart.
- **GLSL:** `smoothstep(a, b, x)` krever a < b, og `pow(x, y)` krever x ≥ 0. Begge ga svart skjerm
  på ekte GPU-er i skissen.

## 9. Kvalitetssjekker

```bash
pnpm run format:check
pnpm run lint
pnpm run typecheck
pnpm run test
pnpm run build
```

## 10. Veien videre

1. **Nivågenerator:** nye grotter fra et frø, sjekket av motoren så fasiten er entydig også med
   alternativ tie-break (samme idé som `tieCheck` i Kort-Forklart). Grunnlaget for uendelig øving.
2. **Spilletest:** noen som skal ta TDT4136 spiller skiva og løser en ekte søkeoppgave etterpå.
3. **DFS, IDS og grådig best-først** som ekstranivåer i Gruvesjaktene.
4. **Neste modul:** Kraftnettet (CSP) eller Sikkerhetsdørene (FOL), på samme skjelett.
5. **Kobling til Kort-Forklart:** «Les kap 3» fra spillet og «Spill kapitlet» fra faget.

## 11. Opphav

All tekst, alle grotter og alle tall er laget for Frontier. Ingen eksempler er hentet fra
læreboka (ingen støvsugerverden, ingen Wumpus) eller fra NTNU-materiale, samme linje som faget
i Kort-Forklart.
