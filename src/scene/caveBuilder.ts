// Bygger gruvesjakta i stilen «Lykt i mørket» fra et nivås graf. Ren three.js, så R3F-
// komponentene bare legger objektene inn i scenen og styrer dem per bilde.

import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import type { Graph, GraphNode, NodeId } from "../engine/graph";
import { hash3, rngFrom, TAU } from "./random";
import { labelTexture, signTexture } from "./labels";

const V3 = THREE.Vector3;
export const SLAB = { rx: 7.7, rz: 4.7 };
export const TUNNEL_HW = 0.46;
export const GRAPH_Y = 1.75;

// ---------------------------------------------------------------- geometri-hjelpere
function slabR(th: number): number {
  return (
    1 +
    0.05 * Math.sin(3 * th + 0.7) +
    0.035 * Math.sin(7 * th + 2.1) +
    0.02 * Math.sin(13 * th + 0.3)
  );
}
function insideSlab(x: number, z: number, m = 0): boolean {
  const u = x / SLAB.rx;
  const v = z / SLAB.rz;
  return Math.hypot(u, v) < slabR(Math.atan2(v, u)) - m;
}
function segDist(px: number, pz: number, ax: number, az: number, bx: number, bz: number): number {
  const dx = bx - ax;
  const dz = bz - az;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz)));
  return Math.hypot(px - (ax + t * dx), pz - (az + t * dz));
}

export interface EdgeFrame {
  a: GraphNode;
  b: GraphNode;
  dx: number;
  dz: number;
  len: number;
  angle: number;
  cost: number;
  key: string;
}

export const edgeKey = (a: NodeId, b: NodeId) => (a < b ? `${a}-${b}` : `${b}-${a}`);

export function edgeFrames(graph: Graph): EdgeFrame[] {
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  return graph.edges.map((e) => {
    const a = byId.get(e.a)!;
    const b = byId.get(e.b)!;
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const len = Math.hypot(dx, dz);
    return {
      a,
      b,
      dx: dx / len,
      dz: dz / len,
      len,
      angle: Math.atan2(dx, dz),
      cost: e.cost,
      key: edgeKey(e.a, e.b),
    };
  });
}

const radius = (n: GraphNode) => n.r ?? 0.92;

function caveDist(graph: Graph, frames: EdgeFrame[], x: number, z: number): number {
  let d = Infinity;
  for (const n of graph.nodes) d = Math.min(d, Math.hypot(x - n.x, z - n.z) - radius(n));
  for (const f of frames) d = Math.min(d, segDist(x, z, f.a.x, f.a.z, f.b.x, f.b.z) - TUNNEL_HW);
  return d;
}

function asteroidGeometry(
  colorFn: (y: number, top: boolean, h: number, c: THREE.Color) => void,
): THREE.BufferGeometry {
  const depth = 4.8;
  const prof: [number, number][] = [
    [0.02, -depth],
    [0.17, -depth * 0.875],
    [0.36, -depth * 0.75],
    [0.56, -depth * 0.6],
    [0.74, -depth * 0.46],
    [0.88, -depth * 0.31],
    [0.97, -depth * 0.19],
    [1.0, -0.45],
    [1.0, 0],
    [0.7, 0],
    [0.35, 0],
    [0.0, 0],
  ];
  let g: THREE.BufferGeometry = new THREE.LatheGeometry(
    prof.map(([r, y]) => new THREE.Vector2(r, y)),
    56,
  );
  let pos = g.getAttribute("position") as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const th = Math.atan2(z, x);
    const kx = Math.round(x * 1000);
    const ky = Math.round(y * 1000);
    const kz = Math.round(z * 1000);
    const top = y > -1e-4;
    const tip = y < -depth + 1e-3;
    const jr = top ? 0 : (hash3(kx, ky, kz) - 0.5) * 0.26;
    const jy = top || tip ? 0 : (hash3(kz + 3, kx + 1, ky + 2) - 0.5) * 0.26 * 1.4;
    const s = slabR(th) * (1 + jr);
    pos.setXYZ(i, x * s * SLAB.rx, y + jy, z * s * SLAB.rz);
  }
  g = g.toNonIndexed();
  g.computeVertexNormals();
  pos = g.getAttribute("position") as THREE.BufferAttribute;
  const col = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i += 3) {
    const y0 = pos.getY(i);
    const y1 = pos.getY(i + 1);
    const y2 = pos.getY(i + 2);
    const top = Math.abs(y0) < 1e-3 && Math.abs(y1) < 1e-3 && Math.abs(y2) < 1e-3;
    const cy = (y0 + y1 + y2) / 3;
    const h = hash3(
      Math.round(pos.getX(i) * 100),
      Math.round(cy * 100),
      Math.round(pos.getZ(i) * 100),
    );
    colorFn(cy, top, h, c);
    for (let k = 0; k < 3; k++) c.toArray(col, (i + k) * 3);
  }
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  return g;
}

function rockGeometry(detail: number, amount: number, seed: number): THREE.BufferGeometry {
  const g = new THREE.IcosahedronGeometry(1, detail);
  const p = g.getAttribute("position") as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    const z = p.getZ(i);
    const n =
      1 +
      (hash3(Math.round(x * 1000) + seed, Math.round(y * 1000), Math.round(z * 1000)) - 0.5) *
        amount;
    p.setXYZ(i, x * n, y * n, z * n);
  }
  g.computeVertexNormals();
  return g;
}

/**
 * Slår sammen kopier av én geometri (med hver sin matrise og farge) til én geometri.
 * Ett draw-kall som instansiering, men uten instansmatriser som etterbehandlingspass kan miste.
 */
function bakeInstances(
  geo: THREE.BufferGeometry,
  mats: THREE.Matrix4[],
  cols: THREE.Color[],
): THREE.BufferGeometry {
  const P = (geo.getAttribute("position") as THREE.BufferAttribute).array;
  const N = (geo.getAttribute("normal") as THREE.BufferAttribute).array;
  const idx = geo.index ? geo.index.array : null;
  const vc = P.length / 3;
  const n = mats.length;
  const pos = new Float32Array(vc * 3 * n);
  const nor = new Float32Array(vc * 3 * n);
  const col = new Float32Array(vc * 3 * n);
  const nm = new THREE.Matrix3();
  for (let i = 0; i < n; i++) {
    const m = mats[i]!.elements;
    nm.getNormalMatrix(mats[i]!);
    const e = nm.elements;
    const c = cols[i]!;
    const o = i * vc * 3;
    for (let k = 0; k < vc; k++) {
      const x = P[k * 3]!;
      const y = P[k * 3 + 1]!;
      const z = P[k * 3 + 2]!;
      pos[o + k * 3] = m[0]! * x + m[4]! * y + m[8]! * z + m[12]!;
      pos[o + k * 3 + 1] = m[1]! * x + m[5]! * y + m[9]! * z + m[13]!;
      pos[o + k * 3 + 2] = m[2]! * x + m[6]! * y + m[10]! * z + m[14]!;
      const nx = N[k * 3]!;
      const ny = N[k * 3 + 1]!;
      const nz = N[k * 3 + 2]!;
      const ax = e[0]! * nx + e[3]! * ny + e[6]! * nz;
      const ay = e[1]! * nx + e[4]! * ny + e[7]! * nz;
      const az = e[2]! * nx + e[5]! * ny + e[8]! * nz;
      const l = Math.hypot(ax, ay, az) || 1;
      nor[o + k * 3] = ax / l;
      nor[o + k * 3 + 1] = ay / l;
      nor[o + k * 3 + 2] = az / l;
      col[o + k * 3] = c.r;
      col[o + k * 3 + 1] = c.g;
      col[o + k * 3 + 2] = c.b;
    }
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  out.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
  out.setAttribute("color", new THREE.BufferAttribute(col, 3));
  if (idx) {
    const I = new Uint32Array(idx.length * n);
    for (let i = 0; i < n; i++)
      for (let k = 0; k < idx.length; k++) I[i * idx.length + k] = idx[k]! + i * vc;
    out.setIndex(new THREE.BufferAttribute(I, 1));
  }
  out.computeBoundingSphere();
  return out;
}

interface RockSample {
  x: number;
  z: number;
  d: number;
  r: number;
  r2: number;
  r3: number;
  h: number;
}

function rockSamples(graph: Graph, frames: EdgeFrame[], step: number, seed: number): RockSample[] {
  const rnd = rngFrom(seed);
  const out: RockSample[] = [];
  for (let x = -SLAB.rx; x <= SLAB.rx; x += step) {
    for (let z = -SLAB.rz; z <= SLAB.rz; z += step) {
      const px = x + (rnd() - 0.5) * step * 0.7;
      const pz = z + (rnd() - 0.5) * step * 0.7;
      const r = rnd();
      const r2 = rnd();
      const r3 = rnd();
      if (!insideSlab(px, pz, 0.035)) continue;
      const d = caveDist(graph, frames, px, pz);
      if (d < 0.1) continue;
      out.push({ x: px, z: pz, d, r, r2, r3, h: 0 });
    }
  }
  return out;
}

function crystalCluster(
  cx: number,
  cz: number,
  o: {
    count: number;
    rMin: number;
    rMax: number;
    seed: number;
    mats: THREE.Material[];
    scale?: number;
    y?: number;
  },
): THREE.Group {
  const g = new THREE.Group();
  const geo = new THREE.OctahedronGeometry(1, 0);
  const rnd = rngFrom(o.seed);
  const up = new V3(0, 1, 0);
  const scale = o.scale ?? 1;
  for (let i = 0; i < o.count; i++) {
    const a = rnd() * TAU;
    const rad = o.rMin + Math.sqrt(rnd()) * (o.rMax - o.rMin);
    const h = (0.4 + rnd() * 0.65) * scale;
    const w = (0.09 + rnd() * 0.08) * scale;
    const m = new THREE.Mesh(geo, o.mats[i % o.mats.length]);
    m.scale.set(w, h, w);
    m.quaternion.setFromUnitVectors(
      up,
      new V3(Math.cos(a) * 0.45, 1, Math.sin(a) * 0.45).normalize(),
    );
    m.position.set(cx + Math.cos(a) * rad, (o.y ?? 0) + h * 0.5, cz + Math.sin(a) * rad);
    m.castShadow = true;
    g.add(m);
  }
  return g;
}

let dotTex: THREE.Texture | null = null;
function softDot(): THREE.Texture {
  if (dotTex) return dotTex;
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const x = c.getContext("2d")!;
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.35, "rgba(255,255,255,0.55)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  x.fillStyle = g;
  x.fillRect(0, 0, 64, 64);
  dotTex = new THREE.CanvasTexture(c);
  return dotTex;
}
export const isSharedTexture = (t: THREE.Texture) => t === dotTex;

function starField(count: number): THREE.Points {
  const g = new THREE.BufferGeometry();
  const p = new Float32Array(count * 3);
  const c = new Float32Array(count * 3);
  const rnd = rngFrom(99);
  const col = new THREE.Color();
  for (let i = 0; i < count; i++) {
    const u = rnd() * 2 - 1;
    const th = rnd() * TAU;
    const r = 110 + rnd() * 50;
    const s = Math.sqrt(1 - u * u);
    p.set([r * s * Math.cos(th), r * u, r * s * Math.sin(th)], i * 3);
    col.set("#cfdcff").multiplyScalar(0.35 + rnd() * 0.75);
    if (rnd() < 0.12) col.set("#ffd7a8").multiplyScalar(0.8);
    col.toArray(c, i * 3);
  }
  g.setAttribute("position", new THREE.BufferAttribute(p, 3));
  g.setAttribute("color", new THREE.BufferAttribute(c, 3));
  const m = new THREE.PointsMaterial({
    size: 1.6,
    sizeAttenuation: false,
    vertexColors: true,
    map: softDot(),
    transparent: true,
    depthWrite: false,
    fog: false,
    blending: THREE.AdditiveBlending,
  });
  return new THREE.Points(g, m);
}

function atmosphereShell(r: number, color: string, power: number, intensity: number): THREE.Mesh {
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uPow: { value: power },
      uInt: { value: intensity },
    },
    vertexShader: `varying vec3 vN; varying vec3 vV;
      void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }`,
    fragmentShader: `uniform vec3 uColor; uniform float uPow; uniform float uInt; varying vec3 vN; varying vec3 vV;
      void main(){ float f = pow(clamp(1.0 - abs(dot(normalize(vN), normalize(vV))), 0.0, 1.0), uPow); gl_FragColor = vec4(uColor * f * uInt, f); }`,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.BackSide,
    fog: false,
  });
  return new THREE.Mesh(new THREE.SphereGeometry(r, 64, 48), mat);
}

interface Dust {
  points: THREE.Points;
  update: (dt: number, t: number) => void;
}
function dust(count: number): Dust {
  const g = new THREE.BufferGeometry();
  const p = new Float32Array(count * 3);
  const rnd = rngFrom(4);
  const meta: { ph: number; sp: number }[] = [];
  const box = { x0: -7, x1: 7, y0: 0.1, y1: 2.6, z0: -4.2, z1: 4.2 };
  for (let i = 0; i < count; i++) {
    p[i * 3] = box.x0 + rnd() * (box.x1 - box.x0);
    p[i * 3 + 1] = box.y0 + rnd() * (box.y1 - box.y0);
    p[i * 3 + 2] = box.z0 + rnd() * (box.z1 - box.z0);
    meta.push({ ph: rnd() * TAU, sp: 0.08 + rnd() * 0.18 });
  }
  const attr = new THREE.BufferAttribute(p, 3);
  g.setAttribute("position", attr);
  const m = new THREE.PointsMaterial({
    size: 0.06,
    color: "#ffcf8a",
    map: softDot(),
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const points = new THREE.Points(g, m);
  return {
    points,
    update: (dt, t) => {
      for (let i = 0; i < count; i++) {
        let y = attr.getY(i) + meta[i]!.sp * dt;
        if (y > box.y1) y = box.y0;
        attr.setY(i, y);
        attr.setX(i, attr.getX(i) + Math.sin(t * 0.6 + meta[i]!.ph) * 0.0025);
      }
      attr.needsUpdate = true;
    },
  };
}

function lampSpot(graph: Graph, n: GraphNode): { x: number; z: number; a: number } {
  const dirs = graph.edges
    .filter((e) => e.a === n.id || e.b === n.id)
    .map((e) => {
      const o = graph.nodes.find((x) => x.id === (e.a === n.id ? e.b : e.a))!;
      return Math.atan2(o.z - n.z, o.x - n.x);
    });
  let best = 0;
  let bestScore = -1;
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * TAU;
    let score = Math.PI;
    for (const d of dirs)
      score = Math.min(score, Math.abs(((a - d + Math.PI * 3) % TAU) - Math.PI));
    if (score > bestScore) {
      bestScore = score;
      best = a;
    }
  }
  return {
    x: n.x + Math.cos(best) * radius(n) * 0.72,
    z: n.z + Math.sin(best) * radius(n) * 0.72,
    a: best,
  };
}

function makeRobot(): { group: THREE.Group; lantern: THREE.PointLight; beam: THREE.SpotLight } {
  const g = new THREE.Group();
  const M = {
    body: new THREE.MeshStandardMaterial({ color: "#d9cdb6", roughness: 0.5, metalness: 0.35 }),
    dark: new THREE.MeshStandardMaterial({ color: "#2b2826", roughness: 0.7, metalness: 0.4 }),
    visor: new THREE.MeshStandardMaterial({
      color: "#7ff4ff",
      emissive: "#38e6ff",
      emissiveIntensity: 3,
    }),
    accent: new THREE.MeshStandardMaterial({
      color: "#ff8058",
      emissive: "#ff5a2c",
      emissiveIntensity: 2.4,
    }),
    lamp: new THREE.MeshStandardMaterial({
      color: "#fff1d0",
      emissive: "#ffc46b",
      emissiveIntensity: 2.2,
    }),
  };
  const rb = (w: number, h: number, d: number, r: number) => new RoundedBoxGeometry(w, h, d, 3, r);
  const parts: [THREE.BufferGeometry, keyof typeof M, [number, number, number]][] = [
    [rb(0.11, 0.13, 0.38, 0.03), "dark", [0.15, 0.065, 0]],
    [rb(0.11, 0.13, 0.38, 0.03), "dark", [-0.15, 0.065, 0]],
    [rb(0.34, 0.28, 0.3, 0.05), "body", [0, 0.28, 0]],
    [new THREE.CylinderGeometry(0.035, 0.035, 0.08, 10), "dark", [0, 0.45, 0]],
    [rb(0.28, 0.17, 0.21, 0.05), "body", [0, 0.56, 0]],
    [new THREE.BoxGeometry(0.2, 0.055, 0.02), "visor", [0, 0.57, 0.108]],
    [new THREE.BoxGeometry(0.15, 0.07, 0.012), "accent", [0, 0.3, 0.153]],
    [new THREE.CylinderGeometry(0.01, 0.01, 0.18, 6), "dark", [0.09, 0.72, -0.03]],
    [new THREE.SphereGeometry(0.028, 12, 8), "accent", [0.09, 0.82, -0.03]],
    [new THREE.CylinderGeometry(0.014, 0.014, 0.26, 6), "dark", [-0.2, 0.5, 0.06]],
    [new THREE.SphereGeometry(0.05, 16, 10), "lamp", [-0.2, 0.66, 0.06]],
  ];
  for (const [geo, role, p] of parts) {
    const m = new THREE.Mesh(geo, M[role]);
    m.position.set(...p);
    m.castShadow = true;
    g.add(m);
  }
  g.scale.setScalar(1.35);
  const lantern = new THREE.PointLight("#ffb860", 6, 5, 2);
  lantern.position.set(-0.2, 0.66, 0.06);
  g.add(lantern);
  // Lyskjegle fremover: én skyggerendring per bilde, i stedet for seks fra et punktlys.
  const beam = new THREE.SpotLight("#ffc27a", 16, 9, 0.8, 0.6, 1.6);
  beam.position.set(-0.2, 0.72, 0.12);
  beam.castShadow = true;
  beam.shadow.mapSize.set(1024, 1024);
  beam.shadow.bias = -0.0012;
  beam.shadow.radius = 4;
  beam.shadow.normalBias = 0.02;
  beam.shadow.camera.near = 0.1;
  beam.shadow.camera.far = 9;
  const target = new THREE.Object3D();
  target.position.set(-0.1, 0, 2.4);
  g.add(target);
  beam.target = target;
  g.add(beam);
  return { group: g, lantern, beam };
}

// ---------------------------------------------------------------- selve dioramaet
export interface RoomParts {
  id: NodeId;
  bulb: THREE.MeshStandardMaterial;
  light: THREE.PointLight;
  ring: THREE.Mesh;
  ringMat: THREE.MeshBasicMaterial;
  label: THREE.Sprite;
  graphNode: THREE.Mesh;
  graphMat: THREE.MeshStandardMaterial;
  sign?: {
    group: THREE.Group;
    board: THREE.Sprite;
    canvas: HTMLCanvasElement;
    tex: THREE.CanvasTexture;
    drawn: string;
  };
}

export interface EdgeParts {
  key: string;
  graphEdge: THREE.Mesh;
  graphMat: THREE.MeshStandardMaterial;
  len: number;
  glow: THREE.Mesh;
  glowMat: THREE.MeshBasicMaterial;
}

export interface Cave {
  root: THREE.Group;
  /** Stein og annet som «smelter» ned når grafen vises. */
  squash: THREE.Group;
  graph: THREE.Group;
  rooms: Map<NodeId, RoomParts>;
  edges: Map<string, EdgeParts>;
  costLabels: THREE.Sprite[];
  robot: THREE.Group;
  lantern: THREE.PointLight;
  crystalLight: THREE.PointLight;
  sun: THREE.DirectionalLight;
  dust: Dust;
  stars: THREE.Points;
  dispose: () => void;
}

export interface CaveOptions {
  showCosts: boolean;
  signs: boolean;
}

export function buildCave(graph: Graph, opts: CaveOptions): Cave {
  const root = new THREE.Group();
  const squash = new THREE.Group();
  root.add(squash);
  const tmp = new THREE.Color();
  const frames = edgeFrames(graph);
  const goal = graph.nodes.find((n) => n.id === graph.goal)!;

  // Asteroiden
  const ast = new THREE.Mesh(
    asteroidGeometry((y, top, h, c) => {
      if (top) c.set("#3f332a").offsetHSL(0, 0, (h - 0.5) * 0.03);
      else
        c.set("#5a4a3d")
          .lerp(tmp.set("#211b17"), Math.min(1, -y / 4.6))
          .offsetHSL(0, 0, (h - 0.5) * 0.07);
    }),
    new THREE.MeshStandardMaterial({
      vertexColors: true,
      flatShading: true,
      roughness: 0.95,
      metalness: 0.02,
      envMapIntensity: 0.1,
    }),
  );
  ast.receiveShadow = true;
  ast.castShadow = true;
  root.add(ast);

  // Gulv i rom og ganger
  const floorMat = new THREE.MeshStandardMaterial({
    color: "#6a5544",
    roughness: 0.9,
    flatShading: true,
  });
  for (const n of graph.nodes) {
    const m = new THREE.Mesh(
      new THREE.CylinderGeometry(radius(n) * 0.98, radius(n) * 1.02, 0.05, 13),
      floorMat,
    );
    m.position.set(n.x, 0.02, n.z);
    m.receiveShadow = true;
    root.add(m);
  }
  for (const f of frames) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(TUNNEL_HW * 1.7, 0.04, f.len), floorMat);
    m.position.set((f.a.x + f.b.x) / 2, 0.015, (f.a.z + f.b.z) / 2);
    m.rotation.y = f.angle;
    m.receiveShadow = true;
    root.add(m);
  }

  // Steinene rundt gangene (bakt til én geometri)
  const pal = ["#6a5747", "#5c4b3e", "#776251", "#4f4137", "#83705c"];
  const samples = rockSamples(graph, frames, 0.44, 11);
  const rockGeo = rockGeometry(1, 0.38, 3);
  const mats: THREE.Matrix4[] = [];
  const cols: THREE.Color[] = [];
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  for (const o of samples) {
    const h = 0.5 + Math.min(o.d, 1.6) * 0.85 + o.r * 0.45;
    const w = 0.36 + o.r2 * 0.22;
    o.h = h;
    e.set((o.r2 - 0.5) * 0.35, o.r * TAU, (o.r3 - 0.5) * 0.35);
    q.setFromEuler(e);
    mats.push(
      new THREE.Matrix4().compose(
        new V3(o.x, h * 0.5 * 0.82, o.z),
        q,
        new V3(w, h * 0.5, w * (0.8 + o.r3 * 0.4)),
      ),
    );
    cols.push(
      new THREE.Color(pal[Math.floor(o.r3 * pal.length)]!).offsetHSL(0, 0, (o.r - 0.5) * 0.05),
    );
  }
  const rocks = new THREE.Mesh(
    bakeInstances(rockGeo, mats, cols),
    new THREE.MeshStandardMaterial({
      vertexColors: true,
      flatShading: true,
      roughness: 0.9,
      metalness: 0.05,
      envMapIntensity: 0.1,
    }),
  );
  rockGeo.dispose();
  rocks.castShadow = true;
  rocks.receiveShadow = true;
  squash.add(rocks);

  // Krystaller i målrommet og spredt i veggene
  const crysMats = [
    new THREE.MeshStandardMaterial({
      color: "#9ff6ff",
      emissive: "#1fd3f0",
      emissiveIntensity: 1.25,
      roughness: 0.15,
      metalness: 0.1,
      flatShading: true,
    }),
    new THREE.MeshStandardMaterial({
      color: "#d9b8ff",
      emissive: "#9b5cff",
      emissiveIntensity: 1.1,
      roughness: 0.15,
      metalness: 0.1,
      flatShading: true,
    }),
  ];
  squash.add(
    crystalCluster(goal.x, goal.z, {
      count: 16,
      rMin: 0.5,
      rMax: 1.1,
      seed: 5,
      mats: [crysMats[0]!, crysMats[0]!, crysMats[1]!],
      scale: 1.25,
    }),
  );
  const rnd = rngFrom(31);
  const walls = samples.filter((o) => o.d < 0.42);
  for (let i = 0; i < 18 && walls.length; i++) {
    const o = walls[Math.floor(rnd() * walls.length)]!;
    squash.add(
      crystalCluster(o.x, o.z, {
        count: 3,
        rMin: 0,
        rMax: 0.12,
        seed: 100 + i,
        mats: [crysMats[i % 2]!],
        scale: 0.55,
        y: o.h * 0.22,
      }),
    );
  }
  const crystalLight = new THREE.PointLight("#3be6ff", 9, 7, 2);
  crystalLight.position.set(goal.x, 1.1, goal.z);
  root.add(crystalLight);

  // Skinner og sviller
  const railMat = new THREE.MeshStandardMaterial({
    color: "#9aa0a6",
    metalness: 0.85,
    roughness: 0.35,
  });
  const sleeperGeo = new THREE.BoxGeometry(0.44, 0.035, 0.08);
  const sleeperMats: THREE.Matrix4[] = [];
  for (const f of frames) {
    const start = radius(f.a) * 0.35;
    const end = f.len - radius(f.b) * 0.35;
    const L = end - start;
    const mx = f.a.x + f.dx * (start + L / 2);
    const mz = f.a.z + f.dz * (start + L / 2);
    for (const side of [-1, 1]) {
      const r = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.035, L), railMat);
      r.position.set(mx + f.dz * 0.13 * side, 0.07, mz - f.dx * 0.13 * side);
      r.rotation.y = f.angle;
      r.castShadow = true;
      root.add(r);
    }
    const n = Math.floor(L / 0.3);
    for (let i = 0; i <= n; i++) {
      const t = start + (L * i) / Math.max(1, n);
      q.setFromAxisAngle(new V3(0, 1, 0), f.angle + Math.PI / 2);
      sleeperMats.push(
        new THREE.Matrix4().compose(
          new V3(f.a.x + f.dx * t, 0.05, f.a.z + f.dz * t),
          q,
          new V3(1, 1, 1),
        ),
      );
    }
  }
  const white = new THREE.Color(1, 1, 1);
  const sleepers = new THREE.Mesh(
    bakeInstances(
      sleeperGeo,
      sleeperMats,
      sleeperMats.map(() => white),
    ),
    new THREE.MeshStandardMaterial({ color: "#4a3324", roughness: 0.95, vertexColors: true }),
  );
  sleeperGeo.dispose();
  sleepers.receiveShadow = true;
  root.add(sleepers);

  // Rom: lampe som tennes når rommet er utforsket, ring når det ligger i frontier, etikett
  const rooms = new Map<NodeId, RoomParts>();
  const postMat = new THREE.MeshStandardMaterial({ color: "#3a2a1f", roughness: 0.9 });
  const postGeo = new THREE.CylinderGeometry(0.03, 0.04, 0.6, 6);
  const bulbGeo = new THREE.SphereGeometry(0.06, 12, 8);
  const ringGeo = new THREE.RingGeometry(0.86, 1, 64);
  const graphNodeGeo = new THREE.IcosahedronGeometry(0.3, 2);
  for (const n of graph.nodes) {
    const spot = lampSpot(graph, n);
    const post = new THREE.Mesh(postGeo, postMat);
    post.position.set(spot.x, 0.3, spot.z);
    post.castShadow = true;
    squash.add(post);
    const bulbMat = new THREE.MeshStandardMaterial({
      color: "#ffd59a",
      emissive: "#ffae42",
      emissiveIntensity: 0.05,
    });
    const bulb = new THREE.Mesh(bulbGeo, bulbMat);
    bulb.position.set(spot.x, 0.64, spot.z);
    squash.add(bulb);
    const light = new THREE.PointLight("#ff9f45", 0, 3.4, 2);
    light.position.set(spot.x, 0.72, spot.z);
    root.add(light);

    const ringMat = new THREE.MeshBasicMaterial({
      color: "#ffb347",
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(n.x, 0.06, n.z);
    ring.scale.setScalar(radius(n));
    root.add(ring);

    const label = labelTexture(n.id);
    label.position.set(n.x, 1.25, n.z);
    root.add(label);

    const graphMat = new THREE.MeshStandardMaterial({
      color: "#2a2018",
      emissive: "#5a3a1c",
      emissiveIntensity: 0.6,
      roughness: 0.4,
    });
    const graphNode = new THREE.Mesh(graphNodeGeo, graphMat);
    graphNode.position.set(n.x, GRAPH_Y, n.z);

    const parts: RoomParts = {
      id: n.id,
      bulb: bulbMat,
      light,
      ring,
      ringMat,
      label,
      graphNode,
      graphMat,
    };

    if (opts.signs && n.id !== graph.goal) {
      // Skiltet står ved siden av lampa, og tavla er en sprite som alltid vender mot kameraet.
      const sg = new THREE.Group();
      const a = spot.a + 0.6;
      sg.position.set(
        n.x + Math.cos(a) * radius(n) * 0.68,
        0,
        n.z + Math.sin(a) * radius(n) * 0.68,
      );
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.85, 6), postMat);
      pole.position.y = 0.42;
      pole.castShadow = true;
      sg.add(pole);
      const { canvas, tex } = signTexture();
      const board = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }),
      );
      board.position.y = 1.02;
      board.scale.set(0.82, 0.41, 1);
      board.renderOrder = 15;
      sg.add(board);
      sg.userData.baseY = 0;
      root.add(sg);
      parts.sign = { group: sg, board, canvas, tex, drawn: "" };
    }
    rooms.set(n.id, parts);
  }

  // Graf-laget: noder og kanter som vokser opp når grafen vises
  const graphGroup = new THREE.Group();
  for (const r of rooms.values()) graphGroup.add(r.graphNode);
  const edges = new Map<string, EdgeParts>();
  const cyl = new THREE.CylinderGeometry(0.05, 0.05, 1, 10, 1);
  const up = new V3(0, 1, 0);
  const glowGeo = new THREE.PlaneGeometry(1, 1);
  for (const f of frames) {
    const graphMat = new THREE.MeshStandardMaterial({
      color: "#2a1e14",
      emissive: "#a8611f",
      emissiveIntensity: 0.5,
    });
    const m = new THREE.Mesh(cyl, graphMat);
    m.position.set((f.a.x + f.b.x) / 2, GRAPH_Y, (f.a.z + f.b.z) / 2);
    m.quaternion.setFromUnitVectors(up, new V3(f.dx, 0, f.dz));
    m.scale.set(1, f.len, 1);
    graphGroup.add(m);
    // Glød langs gangen når den er en del av den funne stien
    const glowMat = new THREE.MeshBasicMaterial({
      color: "#ffb347",
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const glow = new THREE.Mesh(glowGeo, glowMat);
    glow.rotation.x = -Math.PI / 2;
    glow.rotation.z = -f.angle;
    glow.scale.set(0.34, f.len, 1);
    glow.position.set((f.a.x + f.b.x) / 2, 0.08, (f.a.z + f.b.z) / 2);
    root.add(glow);
    edges.set(f.key, { key: f.key, graphEdge: m, graphMat, len: f.len, glow, glowMat });
  }
  root.add(graphGroup);

  // Kostnader på gangene
  const costLabels: THREE.Sprite[] = [];
  if (opts.showCosts) {
    for (const f of frames) {
      const s = labelTexture(String(f.cost), "cost");
      s.position.set((f.a.x + f.b.x) / 2, 0.55, (f.a.z + f.b.z) / 2);
      s.userData.baseY = 0.55;
      root.add(s);
      costLabels.push(s);
    }
  }

  // Rommet rundt: stjerner, planet med atmosfære, støv i lyset
  const stars = starField(2600);
  root.add(stars);
  const planet = new THREE.Mesh(
    new THREE.SphereGeometry(26, 72, 54),
    new THREE.MeshStandardMaterial({
      color: "#b8693f",
      emissive: "#3a1a0c",
      emissiveIntensity: 0.6,
      roughness: 1,
    }),
  );
  planet.position.set(74, -26, -112);
  root.add(planet);
  const atm = atmosphereShell(27.4, "#ff9a5a", 3.2, 0.55);
  atm.position.copy(planet.position);
  root.add(atm);
  const dustFx = dust(320);
  root.add(dustFx.points);

  // Lys
  root.add(new THREE.HemisphereLight("#46587f", "#21170f", 0.75));
  const sun = new THREE.DirectionalLight("#a9c0ff", 1.15);
  sun.position.set(16, 14, -14);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, {
    left: -10,
    right: 10,
    top: 10,
    bottom: -10,
    near: 1,
    far: 60,
  });
  sun.shadow.bias = -0.0006;
  sun.shadow.radius = 3;
  sun.shadow.normalBias = 0.02;
  sun.shadow.autoUpdate = false;
  sun.shadow.needsUpdate = true;
  root.add(sun);
  const fill = new THREE.DirectionalLight("#ffb070", 0.25);
  fill.position.set(-8, 6, 10);
  root.add(fill);

  const robot = makeRobot();
  const s0 = graph.nodes.find((n) => n.id === graph.start)!;
  robot.group.position.set(s0.x, 0.05, s0.z);
  root.add(robot.group);

  const dispose = () => {
    root.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
      if (mat) {
        (Array.isArray(mat) ? mat : [mat]).forEach((m) => {
          const mm = m as THREE.MeshStandardMaterial;
          if (mm.map && !isSharedTexture(mm.map)) mm.map.dispose();
          m.dispose();
        });
      }
      const light = o as THREE.DirectionalLight;
      if (light.isLight && light.shadow) light.shadow.dispose();
    });
  };

  return {
    root,
    squash,
    graph: graphGroup,
    rooms,
    edges,
    costLabels,
    robot: robot.group,
    lantern: robot.lantern,
    crystalLight,
    sun,
    dust: dustFx,
    stars,
    dispose,
  };
}
