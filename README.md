# Frontier

Et 3D-spill der algoritmene fra TDT4136 (Introduksjon til kunstig intelligens) er selve
spillmekanikken. Stasjons-KI-en KAI er slått ut, og du gir den tilbake én evne om gangen.

Første modul, **Gruvesjaktene**, er spillbar: tre nivåer med BFS, UCS og A* i en mørk
gruvesjakt i en flytende asteroide. Du sporer algoritmen kasse for kasse på et transportbånd,
setter opp heuristikk-skilt og ser roboten gå. Hvert trekk sjekkes mot en søkemotor som følger
eksamenskonvensjonene i faget.

## Kom i gang

```bash
pnpm install
pnpm run dev
```

Åpne adressen Vite skriver ut. Taster: `1`–`9` velger kasse, `G` bytter mellom grotte og graf,
`H` slår hint av og på, `Esc` går til menyen.

## Skript

| Skript | Hva |
|---|---|
| `pnpm run dev` | Utviklingsserver |
| `pnpm run build` | Typecheck og produksjonsbygg til `dist/` |
| `pnpm run test` | Tester for søkemotoren og nivåene (Vitest) |
| `pnpm run lint` | ESLint |
| `pnpm run typecheck` | `tsc --noEmit` |
| `pnpm run format` | Prettier |

## Mer

- [`DESIGN.md`](DESIGN.md): retningsvalg, nivåplan, konvensjoner, arkitektur og ytelse.
