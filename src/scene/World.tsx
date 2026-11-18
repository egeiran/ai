import { Canvas } from "@react-three/fiber";
import * as THREE from "three";
import { levelById } from "../game/levels";
import { useGame } from "../game/store";
import { CameraRig } from "./CameraRig";
import { CaveScene } from "./CaveScene";
import { Effects } from "./Effects";
import { FrontierBelt } from "./FrontierBelt";

export function World() {
  const screen = useGame((s) => s.screen);
  const levelId = useGame((s) => s.levelId);
  const level = levelById(levelId);
  return (
    <Canvas
      shadows="percentage"
      dpr={[1, 2]}
      gl={{ antialias: false, powerPreference: "high-performance" }}
      camera={{ fov: 36, near: 0.1, far: 260, position: [0.6, 11.8, 19.6] }}
      onCreated={({ gl, scene }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.3;
        scene.background = new THREE.Color("#04060a");
        scene.fog = new THREE.FogExp2("#04060a", 0.014);
      }}
    >
      <CaveScene key={level.id} level={level} />
      {screen === "level" && <FrontierBelt key={`belt-${level.id}`} level={level} />}
      <CameraRig autoRotate={screen === "menu"} />
      <Effects />
    </Canvas>
  );
}
