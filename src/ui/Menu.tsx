import { LEVELS } from "../game/levels";
import { isUnlocked, useGame } from "../game/store";
import { Stars } from "./Stars";

export function Menu() {
  const progress = useGame((s) => s.progress);
  const startLevel = useGame((s) => s.startLevel);
  const next = LEVELS.find((l) => !progress[l.id] && isUnlocked(l.id, progress)) ?? LEVELS[0]!;

  return (
    <div className="menu">
      <div className="menu-card">
        <p className="eyebrow">TDT4136 · Modul 1 av 11</p>
        <h1 className="brand">Frontier</h1>
        <p className="lede">
          Stasjons-KI-en KAI er slått ut, og bare vedlikeholdsroboten svarer. Gi KAI tilbake evnen
          til å lete, én algoritme om gangen. Første stopp er gruvesjaktene under stasjonen.
        </p>
        <h2 className="menu-h">Gruvesjaktene</h2>
        <ol className="levels">
          {LEVELS.map((l) => {
            const open = isUnlocked(l.id, progress);
            const stars = progress[l.id]?.stars ?? 0;
            return (
              <li key={l.id}>
                <button
                  type="button"
                  className="level-btn"
                  disabled={!open}
                  onClick={() => startLevel(l.id)}
                  aria-label={`Nivå ${l.number}: ${l.title}, ${l.topic}${open ? "" : " (låst)"}`}
                >
                  <span className="level-num">{l.number}</span>
                  <span className="level-text">
                    <b>{l.title}</b>
                    <span>{l.topic}</span>
                  </span>
                  <span className="level-state">
                    {open ? <Stars n={stars} /> : <span className="locked">Låst</span>}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
        <button type="button" className="primary" onClick={() => startLevel(next.id)}>
          {Object.keys(progress).length ? `Fortsett: ${next.title}` : "Start"}
        </button>
        <p className="fineprint">
          Dra for å rotere grotta. Fasiten følger eksamenskonvensjonene i TDT4136.
        </p>
      </div>
    </div>
  );
}
