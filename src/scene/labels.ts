// Tekst i scenen tegnet på canvas: bokstaver over rommene, kostnader, skilt og kasser.

import * as THREE from "three";

const MONO = "'IBM Plex Mono', ui-monospace, Menlo, monospace";

function canvasTexture(canvas: HTMLCanvasElement): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** Rund etikett (rombokstav) eller liten kostnadsbrikke, som sprite. */
export function labelTexture(text: string, kind: "room" | "cost" = "room"): THREE.Sprite {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const x = c.getContext("2d")!;
  x.scale(2, 2);
  if (kind === "room") {
    x.fillStyle = "rgba(20,12,6,0.78)";
    x.beginPath();
    x.arc(64, 64, 50, 0, Math.PI * 2);
    x.fill();
    x.strokeStyle = "rgba(255,170,80,0.55)";
    x.lineWidth = 6;
    x.beginPath();
    x.arc(64, 64, 47, 0, Math.PI * 2);
    x.stroke();
    x.font = `600 64px ${MONO}`;
    x.fillStyle = "#ffd9a0";
  } else {
    x.fillStyle = "rgba(255,214,150,0.95)";
    roundRect(x, 30, 38, 68, 52, 12);
    x.fill();
    x.font = `600 44px ${MONO}`;
    x.fillStyle = "#2a1a0c";
  }
  x.textAlign = "center";
  x.textBaseline = "middle";
  x.fillText(text, 64, kind === "room" ? 68 : 66);
  const m = new THREE.SpriteMaterial({
    map: canvasTexture(c),
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });
  const s = new THREE.Sprite(m);
  s.scale.setScalar(kind === "room" ? 0.66 : 0.5);
  s.renderOrder = 20;
  return s;
}

function roundRect(
  x: CanvasRenderingContext2D,
  px: number,
  py: number,
  w: number,
  h: number,
  r: number,
) {
  x.beginPath();
  x.moveTo(px + r, py);
  x.arcTo(px + w, py, px + w, py + h, r);
  x.arcTo(px + w, py + h, px, py + h, r);
  x.arcTo(px, py + h, px, py, r);
  x.arcTo(px, py, px + w, py, r);
  x.closePath();
}

/** Tomt heuristikk-skilt; tegnes med `drawSign`. */
export function signTexture(): { canvas: HTMLCanvasElement; tex: THREE.CanvasTexture } {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 128;
  return { canvas, tex: canvasTexture(canvas) };
}

export function drawSign(
  canvas: HTMLCanvasElement,
  id: string,
  value: number,
  liar: boolean,
  selected: boolean,
) {
  const x = canvas.getContext("2d")!;
  x.clearRect(0, 0, 256, 128);
  x.fillStyle = liar ? "#5a1810" : "#2e2014";
  roundRect(x, 8, 8, 240, 112, 16);
  x.fill();
  x.lineWidth = selected ? 8 : 5;
  x.strokeStyle = liar ? "#ff6a4a" : selected ? "#ffd27a" : "#c98a3e";
  roundRect(x, 8, 8, 240, 112, 16);
  x.stroke();
  x.textBaseline = "middle";
  x.textAlign = "center";
  x.font = `600 58px ${MONO}`;
  x.fillStyle = liar ? "#ffd0c4" : "#ffe6bf";
  x.fillText(`h(${id})=${value}`, 128, 66);
}

/** Tekst på en frontier-kasse. */
export function drawCrate(canvas: HTMLCanvasElement, id: string, sub: string, highlight: boolean) {
  const x = canvas.getContext("2d")!;
  x.clearRect(0, 0, 256, 256);
  x.fillStyle = highlight ? "#6a4318" : "#4a2f17";
  x.fillRect(0, 0, 256, 256);
  x.strokeStyle = "#2a190c";
  x.lineWidth = 14;
  x.strokeRect(7, 7, 242, 242);
  x.strokeStyle = "rgba(255,190,110,0.35)";
  x.lineWidth = 4;
  x.beginPath();
  x.moveTo(20, 20);
  x.lineTo(236, 236);
  x.moveTo(236, 20);
  x.lineTo(20, 236);
  x.stroke();
  x.fillStyle = "rgba(20,12,6,0.82)";
  roundRect(x, 38, sub ? 34 : 58, 180, sub ? 188 : 140, 18);
  x.fill();
  x.textAlign = "center";
  x.textBaseline = "middle";
  x.fillStyle = "#ffe0ad";
  x.font = `600 110px ${MONO}`;
  x.fillText(id, 128, sub ? 104 : 130);
  if (sub) {
    x.font = `600 34px ${MONO}`;
    x.fillStyle = "#ffc477";
    x.fillText(sub, 128, 186);
  }
}

export function crateTexture(): { canvas: HTMLCanvasElement; tex: THREE.CanvasTexture } {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 256;
  return { canvas, tex: canvasTexture(canvas) };
}
