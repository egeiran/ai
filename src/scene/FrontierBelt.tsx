// Frontier som et transportbånd foran asteroiden. Kassene står i innsettingsrekkefølge:
// nye kommer inn fra høyre. Spilleren klikker kassen algoritmen tar ut neste gang.

import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { FrontierEntry } from "../engine/search";
import { useGame } from "../game/store";
import type { Level } from "../game/levels";
import { crateTexture, drawCrate } from "./labels";

const BELT_Z = 6.1;
const BELT_Y = -0.2;
const SPACING = 0.95;
const BELT_LEN = 6.4;
const ENTRY_X = BELT_LEN / 2 + 0.4;

export function crateSubtitle(level: Level, e: FrontierEntry, hints: boolean): string {
  if (level.algorithm === "bfs") return "";
  if (level.algorithm === "ucs") return `g = ${e.g}`;
  return hints ? `${e.g}+${e.h} = ${e.priority}` : `g${e.g} · h${e.h}`;
}

function Crate({ entry, index, level }: { entry: FrontierEntry; index: number; level: Level }) {
  const ref = useRef<THREE.Group>(null);
  const [hover, setHover] = useState(false);
  const hints = useGame((s) => s.hints);
  const pick = useGame((s) => s.pick);
  const { canvas, tex } = useMemo(() => crateTexture(), []);
  const sub = crateSubtitle(level, entry, hints);

  useEffect(() => {
    drawCrate(canvas, entry.id, sub, hover);
    tex.needsUpdate = true;
  }, [canvas, tex, entry.id, sub, hover]);
  useEffect(() => () => tex.dispose(), [tex]);
  useEffect(() => {
    document.body.style.cursor = hover ? "pointer" : "";
    return () => {
      document.body.style.cursor = "";
    };
  }, [hover]);

  const mats = useMemo(() => {
    const side = new THREE.MeshStandardMaterial({
      map: tex,
      roughness: 0.75,
      metalness: 0.05,
      envMapIntensity: 0.2,
    });
    return [side, side, side, side, side, side];
  }, [tex]);
  useEffect(() => () => mats[0]!.dispose(), [mats]);

  useFrame((_, dt) => {
    const g = ref.current;
    if (!g) return;
    const x = -BELT_LEN / 2 + 0.7 + index * SPACING;
    g.position.x += (x - g.position.x) * Math.min(1, dt * 6);
    const wp = useGame.getState().wrongPick;
    const shake =
      wp && wp.order === entry.order ? Math.max(0, 1 - (performance.now() - wp.at) / 400) : 0;
    g.position.z = BELT_Z + Math.sin(performance.now() / 30) * 0.06 * shake;
    const lift = hover ? 0.12 : 0;
    g.position.y += (BELT_Y + 0.42 + lift - g.position.y) * Math.min(1, dt * 10);
    g.rotation.y = Math.sin(performance.now() / 40) * 0.12 * shake;
  });

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    pick(index);
  };
  return (
    <group ref={ref} position={[ENTRY_X, BELT_Y + 0.42, BELT_Z]}>
      <mesh
        castShadow
        material={mats}
        onClick={onClick}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHover(true);
        }}
        onPointerOut={() => setHover(false)}
      >
        <boxGeometry args={[0.72, 0.72, 0.72]} />
      </mesh>
    </group>
  );
}

function beltSign(text: string, sub: string): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 1024;
  c.height = 192;
  const x = c.getContext("2d")!;
  x.fillStyle = "rgba(18,11,6,0.88)";
  x.fillRect(0, 0, 1024, 192);
  x.strokeStyle = "#c98a3e";
  x.lineWidth = 6;
  x.strokeRect(3, 3, 1018, 186);
  x.fillStyle = "#ffd9a0";
  x.font = "600 72px 'IBM Plex Mono', ui-monospace, monospace";
  x.textBaseline = "middle";
  x.fillText(text, 36, 66);
  x.fillStyle = "#e0a865";
  x.font = "500 46px 'IBM Plex Sans', system-ui, sans-serif";
  x.fillText(sub, 36, 140);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function FrontierBelt({ level }: { level: Level }) {
  const frontier = useGame((s) => s.search?.frontier ?? null);
  const rollers = useRef<THREE.Group>(null);
  const signTex = useMemo(
    () =>
      beltSign(
        "FRONTIER",
        level.algorithm === "bfs"
          ? "Kø (queue): først inn, først ut"
          : level.algorithm === "ucs"
            ? "Prioritetskø: lavest g først"
            : "Prioritetskø: lavest f = g + h først",
      ),
    [level],
  );
  useEffect(() => () => signTex.dispose(), [signTex]);

  const rollerXs = useMemo(
    () => Array.from({ length: 15 }, (_, i) => -BELT_LEN / 2 + 0.25 + (i * (BELT_LEN - 0.5)) / 14),
    [],
  );
  useFrame((_, dt) => {
    if (!rollers.current) return;
    for (const r of rollers.current.children) r.rotation.x -= dt * 2.2;
  });

  return (
    <group>
      {/* Selve båndet */}
      <mesh position={[0, BELT_Y, BELT_Z]} receiveShadow castShadow>
        <boxGeometry args={[BELT_LEN, 0.08, 1.0]} />
        <meshStandardMaterial color="#26201b" roughness={0.6} metalness={0.5} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[0, BELT_Y + 0.06, BELT_Z + s * 0.54]} castShadow>
          <boxGeometry args={[BELT_LEN + 0.1, 0.14, 0.08]} />
          <meshStandardMaterial color="#6b5a49" roughness={0.45} metalness={0.7} />
        </mesh>
      ))}
      <group ref={rollers}>
        {rollerXs.map((x) => (
          <mesh key={x} position={[x, BELT_Y - 0.06, BELT_Z]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.06, 0.06, 0.98, 10]} />
            <meshStandardMaterial color="#8d939a" roughness={0.35} metalness={0.85} />
          </mesh>
        ))}
      </group>
      {/* Stag opp til asteroiden */}
      {[-2.2, 2.2].map((x) => (
        <mesh
          key={x}
          position={[x, BELT_Y - 0.15, BELT_Z - 0.9]}
          rotation={[0.55, 0, 0]}
          castShadow
        >
          <boxGeometry args={[0.1, 0.1, 1.6]} />
          <meshStandardMaterial color="#3a2f25" roughness={0.7} metalness={0.5} />
        </mesh>
      ))}
      {/* Varsellys i enden der nye kasser kommer inn */}
      <mesh position={[BELT_LEN / 2 - 0.05, BELT_Y + 0.25, BELT_Z + 0.54]}>
        <sphereGeometry args={[0.05, 12, 8]} />
        <meshStandardMaterial color="#ffd59a" emissive="#ffae42" emissiveIntensity={2.4} />
      </mesh>
      <sprite
        position={[BELT_LEN / 2 - 1.3, BELT_Y + 1.25, BELT_Z - 0.1]}
        scale={[3.2, 0.6, 1]}
        renderOrder={18}
      >
        <spriteMaterial map={signTex} transparent depthWrite={false} />
      </sprite>

      {frontier?.map((e, i) => (
        <Crate key={e.order} entry={e} index={i} level={level} />
      ))}
    </group>
  );
}
