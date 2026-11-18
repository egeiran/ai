import { useEffect } from "react";
import { useGame } from "./game/store";
import { World } from "./scene/World";
import { Hud } from "./ui/Hud";
import { Menu } from "./ui/Menu";

function useShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "SELECT" || el.tagName === "TEXTAREA"))
        return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const st = useGame.getState();
      if (st.screen !== "level") return;
      if (/^[1-9]$/.test(e.key)) st.pick(Number(e.key) - 1);
      else if (e.key === "g" || e.key === "G") st.setView(st.view === "graph" ? "world" : "graph");
      else if (e.key === "h" || e.key === "H") st.toggleHints();
      else if (e.key === "Escape") st.openMenu();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}

export function App() {
  const screen = useGame((s) => s.screen);
  useShortcuts();
  return (
    <div className="app">
      <div className="stage">
        <World />
      </div>
      {screen === "menu" ? <Menu /> : <Hud />}
    </div>
  );
}
