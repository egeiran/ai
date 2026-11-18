// Gruvesjakta i scenen: bygges fra nivåets graf og oppdateres per bilde fra spilltilstanden.

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { Graph, NodeId } from "../engine/graph";
import { useGame } from "../game/store";
import type { Level } from "../game/levels";
import { buildCave, edgeKey, GRAPH_Y } from "./caveBuilder";
import { drawSign } from "./labels";

const ROBOT_SPEED = 2.4;
const tmpDir = new THREE.Vector3();

/** Rute mellom to rom gjennom ganger der begge ender er oppdaget (BFS på antall ganger). */
function route(graph: Graph, known: Set<NodeId>, from: NodeId, to: NodeId): NodeId[] {
  if (from === to) return [to];
  const prev = new Map<NodeId, NodeId>();
  const seen = new Set([from]);
  const q = [from];
  while (q.length) {
    const cur = q.shift()!;
    for (const e of graph.edges) {
      const nb = e.a === cur ? e.b : e.b === cur ? e.a : null;
      if (!nb || seen.has(nb) || (!known.has(nb) && nb !== to)) continue;
      seen.add(nb);
      prev.set(nb, cur);
      if (nb === to) {
        const path = [to];
        let c = to;
        while (prev.get(c) !== undefined && prev.get(c) !== from) {
          c = prev.get(c)!;
          path.unshift(c);
        }
        return path;
      }
      q.push(nb);
    }
  }
  return [to];
}

const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

export function CaveScene({ level }: { level: Level }) {
  const cave = useMemo(
    () =>
      buildCave(level.graph, { showCosts: level.showCosts, signs: level.algorithm === "astar" }),
    [level],
  );
  const pos = useMemo(
    () => new Map(level.graph.nodes.map((n) => [n.id, new THREE.Vector3(n.x, 0.05, n.z)])),
    [level],
  );

  const robot = useRef({ at: level.graph.start, queue: [] as NodeId[], heading: 0, bob: 0 });
  const morph = useRef(0);
  const frameNo = useRef(0);

  useEffect(() => () => cave.dispose(), [cave]);

  // Roboten går til rommet som ble tatt ut, og videre til målet når det er funnet.
  useEffect(() => {
    robot.current = { at: level.graph.start, queue: [], heading: 0, bob: 0 };
    cave.robot.position.copy(pos.get(level.graph.start)!);
    return useGame.subscribe((s, prev) => {
      if (s.search !== prev.search && s.search && s.search.expanded.length === 0 && !s.lastStep) {
        robot.current.queue = [];
        robot.current.at = level.graph.start;
        cave.robot.position.copy(pos.get(level.graph.start)!);
        return;
      }
      if (s.lastStep && s.lastStep !== prev.lastStep && s.search) {
        const known = new Set(Object.keys(s.search.reached));
        const last = robot.current.queue[robot.current.queue.length - 1] ?? robot.current.at;
        const targets = [s.lastStep.taken.id];
        if (s.search.status === "found" && s.search.result) {
          const goal = s.search.result.path[s.search.result.path.length - 1]!;
          if (goal !== s.lastStep.taken.id) targets.push(goal);
        }
        let from = last;
        for (const t of targets) {
          const r = route(level.graph, known, from, t);
          robot.current.queue.push(...r);
          from = t;
        }
      }
    });
  }, [cave, level, pos]);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const t = performance.now() / 1000;
    const st = useGame.getState();
    const search = st.search;

    // Hovedskyggen oppdateres hvert tredje bilde; lite i scenen beveger seg.
    if (++frameNo.current % 3 === 0) cave.sun.shadow.needsUpdate = true;

    // Grotte ↔ graf
    const target = st.view === "graph" ? 1 : 0;
    if (morph.current !== target) {
      const stepSize = dt / 1.2;
      morph.current =
        target > morph.current
          ? Math.min(target, morph.current + stepSize)
          : Math.max(target, morph.current - stepSize);
    }
    const e = ease(morph.current);
    cave.squash.scale.y = Math.max(0.001, 1 - 0.95 * e);
    cave.graph.visible = e > 0.002;
    cave.graph.position.y = (e - 1) * 1.0;
    let i = 0;
    for (const r of cave.rooms.values()) {
      const s = Math.max(0.0001, Math.min(1, (e - (i++ % 7) * 0.03) / 0.8));
      r.graphNode.scale.setScalar(s);
      r.label.position.y = 1.25 + e * (GRAPH_Y - 1.25 + 0.55);
      if (r.sign) r.sign.group.position.y = e * (GRAPH_Y - 0.35);
    }
    for (const ed of cave.edges.values()) {
      const s = Math.max(0.0001, Math.min(1, e / 0.8));
      ed.graphEdge.scale.set(s, ed.len * s, s);
    }
    for (const c of cave.costLabels)
      c.position.y = (c.userData.baseY as number) + e * (GRAPH_Y - 0.25);

    // Rom: utforsket = lampa lyser, i frontier = pulserende ring, ellers mørkt
    const expanded = new Set(search?.expanded ?? []);
    const inFrontier = new Set(search?.frontier.map((f) => f.id) ?? []);
    const path = search?.status === "found" ? (search.result?.path ?? []) : [];
    const pathSet = new Set(path);
    const pulse = 0.5 + 0.5 * Math.sin(t * 3.2);
    for (const r of cave.rooms.values()) {
      const isStart = r.id === level.graph.start;
      const lit = expanded.has(r.id) || (isStart && !search?.expanded.length) || pathSet.has(r.id);
      const lightTarget = lit ? 2.2 + Math.sin(t * 9 + r.id.charCodeAt(0)) * 0.1 : 0;
      r.light.intensity += (lightTarget - r.light.intensity) * Math.min(1, dt * 4);
      const emTarget = lit ? 2.4 : 0.05;
      r.bulb.emissiveIntensity += (emTarget - r.bulb.emissiveIntensity) * Math.min(1, dt * 4);
      const ringTarget = inFrontier.has(r.id) ? 0.25 + pulse * 0.35 : 0;
      r.ringMat.opacity += (ringTarget - r.ringMat.opacity) * Math.min(1, dt * 6);

      const isGoal = r.id === level.graph.goal;
      let color = "#5a3a1c";
      let intensity = 0.25;
      if (pathSet.has(r.id)) [color, intensity] = ["#ffb347", 2.0];
      else if (expanded.has(r.id)) [color, intensity] = ["#ff9d3c", 1.3];
      else if (inFrontier.has(r.id)) [color, intensity] = ["#ff7a1c", 0.5 + pulse * 0.6];
      else if (isGoal) [color, intensity] = ["#2fd8f0", 0.9];
      r.graphMat.emissive.set(color);
      r.graphMat.emissiveIntensity = intensity;

      // Heuristikk-skilt
      if (r.sign) {
        const hv = st.h[r.id] ?? 0;
        const liar = st.liars.includes(r.id);
        const key = `${hv}|${liar}`;
        if (r.sign.drawn !== key) {
          drawSign(r.sign.canvas, r.id, hv, liar, false);
          r.sign.tex.needsUpdate = true;
          r.sign.drawn = key;
        }
        const sc = liar ? 1 + Math.sin(t * 10) * 0.05 : 1;
        r.sign.board.scale.set(0.82 * sc, 0.41 * sc, 1);
      }
    }
    // Den funne stien lyser langs gangene
    const pathEdges = new Set<string>();
    for (let k = 0; k + 1 < path.length; k++) pathEdges.add(edgeKey(path[k]!, path[k + 1]!));
    for (const ed of cave.edges.values()) {
      const on = pathEdges.has(ed.key);
      ed.glowMat.opacity +=
        ((on ? 0.45 + pulse * 0.15 : 0) - ed.glowMat.opacity) * Math.min(1, dt * 3);
      ed.graphMat.emissiveIntensity = on ? 2.0 : 0.45;
      ed.graphMat.emissive.set(on ? "#ffb347" : "#a8611f");
    }

    // Roboten
    const R = robot.current;
    const next = R.queue[0];
    if (next) {
      const goalPos = pos.get(next)!;
      const d = cave.robot.position.distanceTo(goalPos);
      if (d < 0.03) {
        cave.robot.position.copy(goalPos);
        R.at = next;
        R.queue.shift();
      } else {
        const dir = tmpDir.copy(goalPos).sub(cave.robot.position).normalize();
        const want = Math.atan2(dir.x, dir.z);
        const diff = ((want - R.heading + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
        R.heading += diff * Math.min(1, dt * 8);
        cave.robot.position.addScaledVector(dir, Math.min(d, ROBOT_SPEED * dt));
        R.bob += dt * 9;
      }
    }
    cave.robot.rotation.y = R.heading;
    cave.robot.position.y = 0.05 + (next ? Math.abs(Math.sin(R.bob)) * 0.025 : 0);

    cave.crystalLight.intensity = 9 + Math.sin(t * 1.7) * 2 + Math.sin(t * 5.3) * 0.8;
    cave.lantern.intensity = 6 + Math.sin(t * 13) * 0.2;
    cave.dust.update(dt, t);
    cave.stars.rotation.y = t * 0.004;
  });

  return <primitive object={cave.root} />;
}
