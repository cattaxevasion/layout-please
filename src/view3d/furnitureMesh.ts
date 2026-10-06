// 가구 3D 형태: 기본 도형(박스) 조합만 쓴다.
// 로컬 좌표: 바닥 중심이 원점, x = 가로(width), z = 세로(depth, 정면이 +z), y = 위.

import * as THREE from 'three';
import type { Furniture, ShapeKind } from '../model/types';

interface Palette {
  main: THREE.MeshStandardMaterial;
  dark: THREE.MeshStandardMaterial;
  light: THREE.MeshStandardMaterial;
  soft: THREE.MeshStandardMaterial;
}

function palette(color: string): Palette {
  const base = new THREE.Color(color);
  const mat = (c: THREE.Color, roughness = 0.75) => new THREE.MeshStandardMaterial({ color: c, roughness, metalness: 0 });
  return {
    main: mat(base),
    dark: mat(base.clone().multiplyScalar(0.72)),
    light: mat(base.clone().lerp(new THREE.Color('#ffffff'), 0.35)),
    soft: mat(new THREE.Color('#f4f0e8'), 0.9),
  };
}

const boxGeo = new Map<string, THREE.BoxGeometry>();
const shared = new Set<THREE.BufferGeometry>();
/** 같은 크기 박스 지오메트리는 재사용한다 */
function geo(w: number, h: number, d: number) {
  const k = `${w.toFixed(1)}|${h.toFixed(1)}|${d.toFixed(1)}`;
  let g = boxGeo.get(k);
  if (!g) {
    g = new THREE.BoxGeometry(Math.max(w, 0.1), Math.max(h, 0.1), Math.max(d, 0.1));
    boxGeo.set(k, g);
    shared.add(g);
  }
  return g;
}

/** 크기 (w, h, d)인 박스를 바닥 기준 (x, y0, z)에 놓는다 (y0는 박스 아랫면 높이) */
function box(parent: THREE.Object3D, mat: THREE.Material, w: number, h: number, d: number, x: number, y0: number, z: number) {
  const m = new THREE.Mesh(geo(w, h, d), mat);
  m.position.set(x, y0 + h / 2, z);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}

function legs(g: THREE.Group, mat: THREE.Material, W: number, D: number, h: number, size: number, inset: number) {
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      box(g, mat, size, h, size, sx * (W / 2 - inset), 0, sz * (D / 2 - inset));
    }
  }
}

const builders: Record<ShapeKind, (g: THREE.Group, W: number, D: number, H: number, p: Palette) => void> = {
  box(g, W, D, H, p) {
    box(g, p.main, W, H, D, 0, 0, 0);
  },

  bed(g, W, D, H, p) {
    const frameH = Math.min(25, H * 0.5);
    box(g, p.dark, W, frameH, D, 0, 0, 0);
    box(g, p.soft, W - 4, H - frameH, D - 8, 0, frameH, 3);
    box(g, p.dark, W, H + 45, 6, 0, 0, -D / 2 + 3);
    box(g, p.soft, W * 0.7, 10, Math.min(35, D * 0.18), 0, H, -D / 2 + 8 + Math.min(35, D * 0.18) / 2);
  },

  sofa(g, W, D, H, p) {
    const seatH = H * 0.5;
    const backT = D * 0.25;
    const armW = Math.min(20, W * 0.12);
    box(g, p.dark, W, seatH * 0.55, D, 0, 0, 0);
    box(g, p.main, W - armW * 2, seatH * 0.45, D - backT, 0, seatH * 0.55, backT / 2);
    box(g, p.main, W, H, backT, 0, 0, -D / 2 + backT / 2);
    for (const s of [-1, 1]) box(g, p.main, armW, H * 0.72, D, s * (W / 2 - armW / 2), 0, 0);
  },

  desk(g, W, D, H, p) {
    const t = 3;
    box(g, p.main, W, t, D, 0, H - t, 0);
    legs(g, p.dark, W, D, H - t, 4, 4);
  },

  diningTable(g, W, D, H, p) {
    const t = 4;
    box(g, p.main, W, t, D, 0, H - t, 0);
    legs(g, p.dark, W, D, H - t, 6, 8);
  },

  chair(g, W, D, H, p) {
    const seatH = Math.min(45, H * 0.53);
    box(g, p.main, W, 5, D, 0, seatH - 5, 0);
    legs(g, p.dark, W, D, seatH - 5, 3, 3);
    box(g, p.main, W, H - seatH, 4, 0, seatH, -D / 2 + 2);
  },

  storage(g, W, D, H, p) {
    box(g, p.main, W, H, D, 0, 0, 0);
    const half = W / 2 - 3;
    for (const s of [-1, 1]) {
      box(g, p.light, half, H - 6, 1, (s * W) / 4, 3, D / 2 + 0.5);
      box(g, p.dark, 1.5, 10, 2, s * 3, H / 2 - 5, D / 2 + 1);
    }
  },

  tvStand(g, W, D, H, p) {
    box(g, p.main, W, H, D, 0, 0, 0);
    const n = 3;
    const pw = W / n - 3;
    for (let i = 0; i < n; i++) {
      box(g, p.light, pw, H - 8, 1, -W / 2 + (W / n) * (i + 0.5), 4, D / 2 + 0.5);
    }
  },

  bookshelf(g, W, D, H, p) {
    const t = 2;
    for (const s of [-1, 1]) box(g, p.main, t, H, D, s * (W / 2 - t / 2), 0, 0);
    box(g, p.main, W, t, D, 0, 0, 0);
    box(g, p.main, W, t, D, 0, H - t, 0);
    box(g, p.dark, W, H, 1, 0, 0, -D / 2 + 0.5);
    const n = Math.max(1, Math.floor(H / 35));
    for (let i = 1; i < n; i++) box(g, p.main, W - t * 2, t, D - 1, 0, (H / n) * i, 0.5);
  },
};

/** 가구 하나의 3D 그룹 (위치·회전은 바깥에서 지정) */
export function buildFurniture(f: Pick<Furniture, 'shape' | 'width' | 'depth' | 'height' | 'color'>): THREE.Group {
  const g = new THREE.Group();
  const build = builders[f.shape] ?? builders.box;
  build(g, f.width, f.depth, f.height, palette(f.color));
  return g;
}

/** 형태가 다시 만들어져야 하는지 판단하는 키 */
export const furnitureShapeKey = (f: Pick<Furniture, 'shape' | 'width' | 'depth' | 'height' | 'color'>) =>
  `${f.shape}|${f.width}|${f.depth}|${f.height}|${f.color}`;

/** 그룹 안의 재질과 지오메트리 정리 (공유 박스 지오메트리는 남겨 둔다) */
export function disposeGroup(g: THREE.Object3D) {
  g.traverse((o) => {
    const m = (o as THREE.Mesh).material;
    if (Array.isArray(m)) m.forEach((x) => x.dispose());
    else if (m) m.dispose();
    const geom = (o as THREE.Mesh).geometry;
    if (geom && !shared.has(geom)) geom.dispose();
  });
}
