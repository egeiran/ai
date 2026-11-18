// Diorama-kameraet: roter og zoom fritt, og glid opp til grafen når den vises.

import { OrbitControls } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef, type ComponentRef } from "react";
import * as THREE from "three";
import { useGame } from "../game/store";

const WORLD = { pos: new THREE.Vector3(0.6, 11.8, 19.6), target: new THREE.Vector3(0, -0.9, 1.4) };
const GRAPH = { pos: new THREE.Vector3(0.01, 23.5, 7.0), target: new THREE.Vector3(0, 0.4, 1.4) };

export function CameraRig({ autoRotate }: { autoRotate: boolean }) {
  const controls = useRef<ComponentRef<typeof OrbitControls>>(null);
  const camera = useThree((s) => s.camera);
  const width = useThree((s) => s.size.width);
  const view = useGame((s) => s.view);
  const screen = useGame((s) => s.screen);
  const levelId = useGame((s) => s.levelId);
  const tween = useRef<{
    fromP: THREE.Vector3;
    toP: THREE.Vector3;
    fromT: THREE.Vector3;
    toT: THREE.Vector3;
    t: number;
  } | null>(null);
  const first = useRef(true);

  // Ny visning, nytt nivå eller tilbake til menyen: gli til utgangsstillingen for visningen.
  useEffect(() => {
    const c = controls.current;
    if (!c) return;
    const base = view === "graph" ? GRAPH : WORLD;
    // Smalere vindu: trekk kameraet litt tilbake så hele grotta får plass mellom panelene.
    const k = screen === "level" ? Math.min(1.35, Math.max(1, 1500 / width)) : 1;
    const dest = {
      pos: base.target.clone().add(base.pos.clone().sub(base.target).multiplyScalar(k)),
      target: base.target,
    };
    if (first.current) {
      first.current = false;
      camera.position.copy(dest.pos);
      c.target.copy(dest.target);
      c.update();
      return;
    }
    tween.current = {
      fromP: camera.position.clone(),
      toP: dest.pos.clone(),
      fromT: c.target.clone(),
      toT: dest.target.clone(),
      t: 0,
    };
  }, [view, camera, screen, levelId, width]);

  useFrame((_, dt) => {
    const tw = tween.current;
    const c = controls.current;
    if (!tw || !c) return;
    tw.t = Math.min(1, tw.t + dt / 1.4);
    const u = tw.t * tw.t * (3 - 2 * tw.t);
    camera.position.lerpVectors(tw.fromP, tw.toP, u);
    c.target.lerpVectors(tw.fromT, tw.toT, u);
    if (tw.t >= 1) tween.current = null;
  });

  const reduce =
    typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enableDamping
      dampingFactor={0.06}
      enablePan={false}
      minDistance={7}
      maxDistance={32}
      maxPolarAngle={1.95}
      autoRotate={autoRotate && !reduce}
      autoRotateSpeed={0.45}
      onStart={() => {
        tween.current = null;
      }}
    />
  );
}
