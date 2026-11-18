import { formatExpansions, nextIndex } from "../engine/search";
import { levelById, nextLevel, type Level } from "../game/levels";
import { useGame, type QualityMode } from "../game/store";
import { QUALITY } from "../scene/Effects";
import { crateSubtitle } from "../scene/FrontierBelt";
import { Stars } from "./Stars";

const PHASE_NAMES = { build: "Bygg", trace: "Spor", tune: "Bygg om", done: "Ferdig" } as const;

function TopBar({ level }: { level: Level }) {
  const openMenu = useGame((s) => s.openMenu);
  const view = useGame((s) => s.view);
  const setView = useGame((s) => s.setView);
  const hints = useGame((s) => s.hints);
  const toggleHints = useGame((s) => s.toggleHints);
  const fps = useGame((s) => s.fps);
  const mode = useGame((s) => s.qualityMode);
  const qLevel = useGame((s) => s.qualityLevel);
  const setMode = useGame((s) => s.setQualityMode);
  return (
    <header className="topbar">
      <button type="button" className="chip-btn" onClick={openMenu}>
        ← Meny
      </button>
      <div className="crumb">
        <span>Gruvesjaktene · nivå {level.number} av 3</span>
        <b>{level.title}</b>
      </div>
      <span className="spacer" />
      <div className="seg" role="group" aria-label="Visning">
        <button type="button" aria-pressed={view === "world"} onClick={() => setView("world")}>
          Grotte
        </button>
        <button type="button" aria-pressed={view === "graph"} onClick={() => setView("graph")}>
          Graf
        </button>
      </div>
      <button
        type="button"
        className="chip-btn"
        aria-pressed={hints}
        onClick={toggleHints}
        title="Snarvei: H"
      >
        Hint {hints ? "på" : "av"}
      </button>
      <span className="fps" aria-label="Bilder per sekund">
        {fps || "–"} fps
      </span>
      <label className="sel">
        <span className="sr-only">Kvalitet</span>
        <select value={mode} onChange={(e) => setMode(e.target.value as QualityMode)}>
          <option value="auto">Auto ({QUALITY[qLevel].label})</option>
          <option value="ultra">Ultra</option>
          <option value="hoy">Høy</option>
          <option value="middels">Middels</option>
          <option value="lav">Lav</option>
        </select>
      </label>
    </header>
  );
}

function StoryPanel({ level }: { level: Level }) {
  const phase = useGame((s) => s.phase);
  const message = useGame((s) => s.message);
  const mistakes = useGame((s) => s.mistakes);
  return (
    <aside className="panel story">
      <div className="kai">
        <span className="kai-name">KAI</span>
        <p>{phase === "done" ? level.outro : level.intro}</p>
      </div>
      <div className="phases" aria-label="Faser">
        {level.phases.map((p) => (
          <span key={p} className={p === phase ? "phase on" : "phase"}>
            {PHASE_NAMES[p]}
          </span>
        ))}
        {phase === "done" && <span className="phase on">Ferdig</span>}
      </div>
      <p className="goal">{level.goal}</p>
      {message.text && (
        <p key={message.id} className={`feedback ${message.kind}`} role="status" aria-live="polite">
          {message.text}
        </p>
      )}
      <div className="meta-row">
        <span>
          Feil: <b className="num">{mistakes}</b>
        </span>
        <span>{level.topic}</span>
      </div>
      <details className="rules">
        <summary>Regler i dette nivået</summary>
        <ul>
          {level.rules.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      </details>
    </aside>
  );
}

function FrontierPanel({ level }: { level: Level }) {
  const search = useGame((s) => s.search);
  const pick = useGame((s) => s.pick);
  const hints = useGame((s) => s.hints);
  const autoRunning = useGame((s) => s.autoRunning);
  if (!search) return null;
  const running = search.status === "running";
  const answer = hints && running ? nextIndex(search) : -1;
  const reached = Object.entries(search.reached).sort(([a], [b]) => (a < b ? -1 : 1));
  return (
    <section className="block">
      <h3>
        Frontier{" "}
        <span className="muted">{level.algorithm === "bfs" ? "kø (queue)" : "prioritetskø"}</span>
      </h3>
      <ol className="frontier" aria-label="Frontier i innsettingsrekkefølge">
        {search.frontier.map((e, i) => (
          <li key={e.order}>
            <button
              type="button"
              className="crate-btn"
              disabled={!running || autoRunning}
              onClick={() => pick(i)}
              aria-label={`Ta ut ${e.id}`}
            >
              <span className="k">{i + 1}</span>
              <b>{e.id}</b>
              <span className="sub">{crateSubtitle(level, e, hints)}</span>
            </button>
          </li>
        ))}
        {search.frontier.length === 0 && <li className="muted">Tom</li>}
      </ol>
      {answer >= 0 && level.number === 1 && (
        <p className="hint">Nye kasser kommer inn til høyre. Hvilken har ventet lengst?</p>
      )}
      <dl className="trace">
        <dt>Utforsket (expanded)</dt>
        <dd className="mono">{formatExpansions(search) || "–"}</dd>
        {search.result && (
          <>
            <dt>Sti</dt>
            <dd className="mono">
              {search.result.path.join(" → ")}
              {level.showCosts ? `, kostnad ${search.result.cost}` : ""}
            </dd>
          </>
        )}
      </dl>
      {hints && level.showCosts && (
        <table className="reached">
          <caption>Nådd (reached)</caption>
          <thead>
            <tr>
              <th>Rom</th>
              <th>g</th>
              <th>Forelder</th>
            </tr>
          </thead>
          <tbody>
            {reached.map(([id, r]) => (
              <tr key={id}>
                <td>{id}</td>
                <td className="num">{r.g}</td>
                <td>{r.parent ?? "–"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

function SignPanel({ level }: { level: Level }) {
  const h = useGame((s) => s.h);
  const setH = useGame((s) => s.setH);
  const liars = useGame((s) => s.liars);
  const phase = useGame((s) => s.phase);
  const testSigns = useGame((s) => s.testSigns);
  const runAuto = useGame((s) => s.runAuto);
  const autoRunning = useGame((s) => s.autoRunning);
  const last = useGame((s) => s.lastRunExpansions);
  const editable = (phase === "build" || phase === "tune") && !autoRunning;
  return (
    <section className="block">
      <h3>
        Heuristikk-skilt <span className="muted">h(n)</span>
      </h3>
      <p className="small">
        Anslå minste kostnad herfra til {level.graph.goal}. Et skilt som sier mer enn den sanne
        kostnaden, lyver.
      </p>
      <ul className="signs">
        {level.graph.nodes.map((n) => {
          const goal = n.id === level.graph.goal;
          const v = h[n.id] ?? 0;
          return (
            <li key={n.id} className={liars.includes(n.id) ? "liar" : ""}>
              <span className="mono">h({n.id})</span>
              <button
                type="button"
                disabled={!editable || goal || v <= 0}
                onClick={() => setH(n.id, v - 1)}
                aria-label={`Senk h(${n.id})`}
              >
                −
              </button>
              <b className="num">{v}</b>
              <button
                type="button"
                disabled={!editable || goal}
                onClick={() => setH(n.id, v + 1)}
                aria-label={`Øk h(${n.id})`}
              >
                +
              </button>
              {goal ? (
                <span className="muted">målet</span>
              ) : liars.includes(n.id) ? (
                <span className="lie">lyver</span>
              ) : (
                <span />
              )}
            </li>
          );
        })}
      </ul>
      {phase === "build" && (
        <button type="button" className="primary" onClick={testSigns}>
          Test skiltene
        </button>
      )}
      {phase === "tune" && (
        <>
          <p className="small">
            Mål: høyst <b>{level.maxExpansions}</b> ekspansjoner.{" "}
            {last !== null && (
              <>
                Forrige kjøring: <b>{last}</b>.
              </>
            )}
          </p>
          <button type="button" className="primary" disabled={autoRunning} onClick={runAuto}>
            {autoRunning ? "KAI kjører …" : "Kjør A*"}
          </button>
        </>
      )}
    </section>
  );
}

function DoneCard({ level }: { level: Level }) {
  const progress = useGame((s) => s.progress);
  const mistakes = useGame((s) => s.mistakes);
  const startLevel = useGame((s) => s.startLevel);
  const restart = useGame((s) => s.restartLevel);
  const openMenu = useGame((s) => s.openMenu);
  const search = useGame((s) => s.search);
  const next = nextLevel(level.id);
  return (
    <div className="done" role="dialog" aria-labelledby="done-h">
      <p className="eyebrow">Nivå {level.number} klart</p>
      <h2 id="done-h">{level.title}</h2>
      <Stars n={progress[level.id]?.stars ?? 0} />
      <p className="small">
        {search ? (
          <>
            Ekspansjoner: <span className="mono">{formatExpansions(search)}</span>.{" "}
          </>
        ) : null}
        Feil underveis: {mistakes}.
      </p>
      <div className="done-actions">
        {next ? (
          <button type="button" className="primary" onClick={() => startLevel(next.id)}>
            Neste: {next.title}
          </button>
        ) : (
          <button type="button" className="primary" onClick={openMenu}>
            Gruvesjaktene er reparert
          </button>
        )}
        <button type="button" className="chip-btn" onClick={restart}>
          Spill igjen
        </button>
      </div>
    </div>
  );
}

export function Hud() {
  const levelId = useGame((s) => s.levelId);
  const phase = useGame((s) => s.phase);
  const level = levelById(levelId);
  return (
    <div className="hud">
      <TopBar level={level} />
      <StoryPanel level={level} />
      <aside className="panel side">
        {level.algorithm === "astar" && <SignPanel level={level} />}
        <FrontierPanel level={level} />
      </aside>
      {phase === "done" && <DoneCard level={level} />}
    </div>
  );
}
