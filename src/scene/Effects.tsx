// Etterbehandling og kvalitet: bloom, ambient occlusion (GTAO) og tone mapping, med Auto som
// går ned ett hakk når bildet hakker over tid. Erstatter R3F sin egen rendring (prioritet 1).

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { GTAOPass } from "three/examples/jsm/postprocessing/GTAOPass.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { useGame, type QualityLevel } from "../game/store";

interface Quality {
  dpr: (device: number) => number;
  shadow: number;
  spotShadow: number;
  ao: boolean;
  aoSamples: number;
  aoScale: number;
}

export const QUALITY: Record<QualityLevel, Quality & { label: string }> = {
  lav: {
    label: "Lav",
    dpr: () => 1,
    shadow: 1024,
    spotShadow: 512,
    ao: false,
    aoSamples: 8,
    aoScale: 0.5,
  },
  middels: {
    label: "Middels",
    dpr: (d) => Math.min(d, 1.25),
    shadow: 2048,
    spotShadow: 1024,
    ao: false,
    aoSamples: 8,
    aoScale: 0.5,
  },
  hoy: {
    label: "Høy",
    dpr: (d) => Math.min(d, 1.5),
    shadow: 2048,
    spotShadow: 1024,
    ao: true,
    aoSamples: 12,
    aoScale: 0.5,
  },
  ultra: {
    label: "Ultra",
    dpr: () => 2,
    shadow: 4096,
    spotShadow: 2048,
    ao: true,
    aoSamples: 16,
    aoScale: 1,
  },
};
const ORDER: QualityLevel[] = ["lav", "middels", "hoy", "ultra"];

export function Effects() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const setDpr = useThree((s) => s.setDpr);
  const dpr = useThree((s) => s.viewport.dpr);
  const level = useGame((s) => s.qualityLevel);

  const fx = useMemo(() => {
    const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
    const composer = new EffectComposer(gl, rt);
    composer.addPass(new RenderPass(scene, camera));
    const gtao = new GTAOPass(scene, camera, 1, 1);
    const state = { aoScale: 0.5, aoSamples: 0 };
    // AO i redusert oppløsning; blendingen skalerer den opp igjen.
    const setSize = gtao.setSize.bind(gtao);
    gtao.setSize = (w: number, h: number) =>
      setSize(
        Math.max(1, Math.round(w * state.aoScale)),
        Math.max(1, Math.round(h * state.aoScale)),
      );
    // Normalpasset skal bare se ugjennomsiktig geometri, og uten teksturbakgrunn (som ellers
    // tegnes som en flate rundt origo med normalmaterialet).
    // three r187: _overrideVisibility skjuler punkter og linjer og husker dem i _visibilityCache.
    const g = gtao as unknown as {
      _visibilityCache: THREE.Object3D[];
      _overrideVisibility: () => void;
      _restoreVisibility: () => void;
    };
    let savedBackground: THREE.Scene["background"] = null;
    g._overrideVisibility = () => {
      savedBackground = scene.background;
      scene.background = null;
      scene.traverse((o) => {
        if (!o.visible) return;
        const mat = (o as THREE.Mesh).material as THREE.Material | undefined;
        if (
          (o as THREE.Points).isPoints ||
          (o as THREE.Line).isLine ||
          (o as THREE.Sprite).isSprite ||
          mat?.transparent
        ) {
          o.visible = false;
          g._visibilityCache.push(o);
        }
      });
    };
    const restore = g._restoreVisibility.bind(gtao);
    g._restoreVisibility = () => {
      restore();
      scene.background = savedBackground;
    };
    gtao.updatePdMaterial({
      lumaPhi: 10,
      depthPhi: 2,
      normalPhi: 3,
      radius: 4,
      radiusExponent: 1,
      rings: 2,
      samples: 16,
    });
    gtao.blendIntensity = 0.75;
    gtao.enabled = false;
    composer.addPass(gtao);
    const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.55, 0.45, 0.82);
    composer.addPass(bloom);
    composer.addPass(new OutputPass());
    return { composer, gtao, state };
  }, [gl, scene, camera]);

  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
    scene.environment = env;
    // three r163+: scene.environment styres av scene.environmentIntensity, ikke materialets envMapIntensity.
    scene.environmentIntensity = 0.12;
    return () => {
      env.dispose();
      scene.environment = null;
    };
  }, [gl, scene]);

  useEffect(() => () => fx.composer.dispose(), [fx]);

  // Kvalitetsnivå: oppløsning, skyggekart og AO
  useEffect(() => {
    const q = QUALITY[level];
    setDpr(q.dpr(window.devicePixelRatio || 1));
    fx.state.aoScale = q.aoScale;
    fx.gtao.enabled = q.ao;
    if (q.ao && fx.state.aoSamples !== q.aoSamples) {
      fx.state.aoSamples = q.aoSamples;
      fx.gtao.updateGtaoMaterial({
        radius: 0.55,
        distanceExponent: 1.4,
        thickness: 1.4,
        scale: 1.15,
        samples: q.aoSamples,
      });
    }
    scene.traverse((o) => {
      const light = o as THREE.DirectionalLight | THREE.SpotLight;
      if (!light.isLight || !light.castShadow || !light.shadow) return;
      const sz = (light as THREE.SpotLight).isSpotLight ? q.spotShadow : q.shadow;
      if (light.shadow.mapSize.x !== sz) {
        light.shadow.mapSize.set(sz, sz);
        light.shadow.map?.dispose();
        light.shadow.map = null;
      }
      light.shadow.needsUpdate = true;
    });
  }, [level, fx, scene, setDpr]);

  useEffect(() => {
    fx.composer.setPixelRatio(dpr);
    fx.composer.setSize(size.width, size.height);
  }, [fx, size, dpr]);

  const meter = useRef({ frames: 0, time: 0, low: 0, since: 0 });
  useEffect(() => {
    meter.current.since = performance.now();
    meter.current.low = 0;
  }, [level]);

  useFrame((_, dt) => {
    fx.composer.render(dt);
    const m = meter.current;
    m.frames++;
    m.time += dt;
    if (m.time >= 0.5) {
      const fps = m.frames / m.time;
      m.frames = 0;
      m.time = 0;
      const st = useGame.getState();
      st.setFps(Math.round(fps));
      if (st.qualityMode === "auto" && performance.now() - m.since > 2500 && !document.hidden) {
        m.low = fps < 48 ? m.low + 1 : 0;
        if (m.low >= 3) {
          const i = ORDER.indexOf(st.qualityLevel);
          if (i > 0) st.setQualityLevel(ORDER[i - 1]!);
          m.low = 0;
        }
      }
    }
  }, 1);

  return null;
}
