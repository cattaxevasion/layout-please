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

/** 짙은 금속·손잡이용 재질 (가구 색과 상관없이) */
const METAL = new THREE.MeshStandardMaterial({ color: '#3c3d3f', roughness: 0.45, metalness: 0.4 });
const KNOB = new THREE.MeshStandardMaterial({ color: '#4a4a4a', roughness: 0.5 });
const GLASS = new THREE.MeshStandardMaterial({ color: '#141414', roughness: 0.15, metalness: 0.2 });
/** 여러 가구가 같이 쓰는 재질. 가구마다 복제해서 쓰고, 지울 때 원본은 남긴다 */
const SHARED = new Set<THREE.Material>([METAL, KNOB, GLASS]);

/** 바닥 기준 원기둥 (반지름 r, 높이 h) */
function cylinder(parent: THREE.Object3D, mat: THREE.Material, r: number, h: number, x: number, y0: number, z: number) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 16), mat);
  m.position.set(x, y0 + h / 2, z);
  m.castShadow = true;
  parent.add(m);
  return m;
}

/** 두 점을 잇는 가는 막대 (보강대 등). 점은 그룹 로컬 좌표 */
function bar(parent: THREE.Object3D, mat: THREE.Material, a: THREE.Vector3, b: THREE.Vector3, t: number) {
  const len = a.distanceTo(b);
  const m = new THREE.Mesh(new THREE.BoxGeometry(t, len, t), mat);
  m.position.copy(a).add(b).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
  m.castShadow = true;
  parent.add(m);
}

function legs(g: THREE.Group, mat: THREE.Material, W: number, D: number, h: number, size: number, inset: number) {
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      box(g, mat, size, h, size, sx * (W / 2 - inset), 0, sz * (D / 2 - inset));
    }
  }
}

/** 냉장실(위)·냉동실(아래) 두 문과 사이 손잡이 줄 */
function buildFridge(g: THREE.Group, W: number, D: number, H: number, p: Palette) {
  const doorT = 2;
  box(g, p.main, W, H, D - doorT, 0, 0, -doorT / 2);
  const split = H * 0.4;
  box(g, p.main, W - 0.6, split - 1.5, doorT, 0, 0.5, D / 2 - doorT / 2); // 냉동실 문
  box(g, p.main, W - 0.6, H - split - 1.5, doorT, 0, split + 1, D / 2 - doorT / 2); // 냉장실 문
  box(g, METAL, W - 2, 1.2, 1.5, 0, split - 1.2, D / 2 + 0.3); // 손잡이 줄
}

/** 전자레인지: 받침 다리, 왼쪽 검은 유리문과 손잡이, 오른쪽 조작부(표시창, 다이얼 2개) */
function buildMicrowave(g: THREE.Group, W: number, D: number, H: number, p: Palette) {
  const foot = 1.5;
  const bodyD = D - 2;
  box(g, p.main, W, H - foot, bodyD, 0, foot, -1);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(g, KNOB, 3, foot, 3, sx * (W / 2 - 4), 0, sz * (bodyD / 2 - 4) - 1);
  const front = D / 2 - 1;
  const doorW = W * 0.74;
  const doorX = -W / 2 + doorW / 2 + 1;
  box(g, GLASS, doorW, H - foot - 4, 0.8, doorX, foot + 2, front + 0.4);
  box(g, p.main, 2.2, H - foot - 6, 2, doorX + doorW / 2 - 2, foot + 3, front + 1.4); // 손잡이
  const panelX = W / 2 - (W - doorW) / 2;
  box(g, GLASS, 5, 2.2, 0.5, panelX, H * 0.78, front + 0.3); // 표시창
  for (const [y, r] of [
    [H * 0.55, 2.4],
    [H * 0.25, 3],
  ]) {
    const knob = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 1.6, 20), p.main);
    knob.rotation.x = Math.PI / 2;
    knob.position.set(panelX, y, front + 0.8);
    knob.castShadow = true;
    g.add(knob);
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

  // 상판 + T자 다리 두 개 (가로 막대 받침, 기둥, 상판 아래 보)
  standingDesk(g, W, D, H, p) {
    const top = 2.5;
    box(g, p.main, W, top, D, 0, H - top, 0);
    const lx = W / 2 - Math.min(18, W * 0.15);
    for (const s of [-1, 1]) {
      box(g, METAL, 6, 3, D - 6, s * lx, 0, 0); // 바닥 받침
      box(g, METAL, 7, H - top - 3, 5, s * lx, 3, 0); // 기둥
      box(g, METAL, 5, 4, D - 14, s * lx, H - top - 4, 0); // 상판 아래 받침
    }
    box(g, METAL, lx * 2, 5, 5, 0, H - top - 6, -D * 0.15); // 두 다리를 잇는 보
  },

  // 별 모양 다리 다섯 개 + 바퀴 + 가스 실린더 + 좌판 + 높은 메쉬 등받이 + 머리받침 + 팔걸이
  officeChair(g, W, D, H, p) {
    const r = Math.min(W, D) / 2 - 3;
    const seatH = Math.min(47, H * 0.38);
    const seatW = Math.min(51.5, W * 0.77);
    const seatD = Math.min(47, D * 0.7);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const leg = new THREE.Group();
      box(leg, p.dark, r, 4, 5, r / 2, 6, 0);
      box(leg, KNOB, 5, 6, 5, r - 2, 0, 0); // 바퀴
      leg.rotation.y = a;
      g.add(leg);
    }
    cylinder(g, METAL, 2.5, seatH - 12, 0, 8, 0);
    box(g, p.dark, seatW * 0.5, 4, seatD * 0.5, 0, seatH - 10, 0); // 좌판 아래 기구
    box(g, p.main, seatW, 6, seatD, 0, seatH - 6, 3);
    const backH = Math.min(58.5, H - seatH - 18);
    const back = new THREE.Group();
    box(back, p.main, seatW * 0.95, backH, 4, 0, 0, 0);
    box(back, p.main, seatW * 0.72, 14, 4, 0, backH + 3, 0); // 머리받침
    back.position.set(0, seatH + 2, -seatD / 2 - 1);
    back.rotation.x = -0.12; // 뒤로 살짝 젖힘
    g.add(back);
    for (const s of [-1, 1]) {
      const ax = s * (seatW / 2 + 4);
      box(g, p.dark, 4, 20, 6, ax, seatH - 2, -2);
      box(g, p.main, 8, 3, 26, ax, seatH + 18, 0);
    }
  },

  // 서랍 3칸 + 손잡이 + 아래 받침
  drawers(g, W, D, H, p) {
    const plinth = Math.min(8, H * 0.12);
    box(g, p.main, W, H, D - 1, 0, 0, -0.5);
    box(g, p.dark, W - 6, plinth - 1, 1, 0, 0, D / 2 - 1.5); // 들어간 받침 그림자
    const n = 3;
    const fh = (H - plinth - 2) / n;
    for (let i = 0; i < n; i++) {
      const y0 = plinth + i * fh + 0.4;
      box(g, p.light, W - 4, fh - 0.8, 1.5, 0, y0, D / 2 - 0.25);
      const knob = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 1.8, 2.5, 16), KNOB);
      knob.rotation.x = Math.PI / 2;
      knob.position.set(0, y0 + fh / 2, D / 2 + 1.5);
      knob.castShadow = true;
      g.add(knob);
    }
  },

  fridge: buildFridge,
  microwave: buildMicrowave,

  // 냉장고 위에 전자레인지 (전자레인지는 냉장고 앞면에 맞춰 올린다)
  fridgeMicrowave(g, W, D, H, p) {
    const mwH = Math.min(29.6, H * 0.3);
    const mwD = Math.min(41.2, D);
    const fridge = new THREE.Group();
    buildFridge(fridge, Math.min(W, 48), D, H - mwH, p);
    g.add(fridge);
    const mw = new THREE.Group();
    buildMicrowave(mw, W, mwD, mwH, p);
    mw.position.set(0, H - mwH, D / 2 - mwD / 2);
    g.add(mw);
  },

  // 아래 몸통 + 뒤 기둥 + 위 헤드(앞으로 튀어나옴), 그 사이가 물 받는 칸
  waterServer(g, W, D, H, p) {
    const lower = H * 0.48;
    const headY = H * 0.78;
    box(g, p.main, W, lower, D, 0, 0, 0);
    box(g, p.main, W, H - lower, D * 0.75, 0, lower, -D * 0.125);
    box(g, p.main, W, H - headY, D, 0, headY, 0);
    box(g, p.dark, W * 0.6, 1.5, D * 0.2, 0, lower, D * 0.38); // 받침
    cylinder(g, METAL, 1.2, 4, 0, headY - 4, D * 0.3); // 꼭지
  },

  // 모서리 기둥 4개 + 선반 3단 + 뒤·옆 X자 보강대
  metalShelf(g, W, D, H, p) {
    const post = 4;
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) box(g, p.main, post, H, post, sx * (W / 2 - post / 2), 0, sz * (D / 2 - post / 2));
    }
    const levels = [Math.min(18, H * 0.16), H * 0.5, H - 3];
    for (const y of levels) box(g, p.main, W - 1, 3, D - 1, 0, y, 0);
    const bx = W / 2 - post;
    const bz = D / 2 - post;
    const back = -D / 2 + 1;
    for (let i = 0; i < 2; i++) {
      const y0 = levels[i] + 3;
      const y1 = levels[i + 1];
      bar(g, p.main, new THREE.Vector3(-bx, y0, back), new THREE.Vector3(bx, y1, back), 1.5);
      bar(g, p.main, new THREE.Vector3(bx, y0, back), new THREE.Vector3(-bx, y1, back), 1.5);
      for (const s of [-1, 1]) {
        const x = s * (W / 2 - 1);
        bar(g, p.main, new THREE.Vector3(x, y0, -bz), new THREE.Vector3(x, y1, bz), 1.5);
        bar(g, p.main, new THREE.Vector3(x, y0, bz), new THREE.Vector3(x, y1, -bz), 1.5);
      }
    }
  },
};

/** 가구 하나의 3D 그룹 (위치·회전은 바깥에서 지정) */
export function buildFurniture(f: Pick<Furniture, 'shape' | 'width' | 'depth' | 'height' | 'color'>): THREE.Group {
  const g = new THREE.Group();
  const build = builders[f.shape] ?? builders.box;
  build(g, f.width, f.depth, f.height, palette(f.color));
  // 공용 재질(금속, 손잡이)은 가구마다 복제한다: 충돌 표시로 한 가구만 빨갛게 칠할 수 있도록
  const clones = new Map<THREE.Material, THREE.Material>();
  g.traverse((o) => {
    const mesh = o as THREE.Mesh;
    const m = mesh.material as THREE.Material | undefined;
    if (m && SHARED.has(m)) {
      if (!clones.has(m)) clones.set(m, m.clone());
      mesh.material = clones.get(m)!;
    }
  });
  return g;
}

/** 형태가 다시 만들어져야 하는지 판단하는 키 */
export const furnitureShapeKey = (f: Pick<Furniture, 'shape' | 'width' | 'depth' | 'height' | 'color'>) =>
  `${f.shape}|${f.width}|${f.depth}|${f.height}|${f.color}`;

/** 그룹 안의 재질과 지오메트리 정리 (공유 박스 지오메트리는 남겨 둔다) */
export function disposeGroup(g: THREE.Object3D) {
  g.traverse((o) => {
    const m = (o as THREE.Mesh).material;
    const keep = (x: THREE.Material) => SHARED.has(x);
    if (Array.isArray(m)) m.forEach((x) => !keep(x) && x.dispose());
    else if (m && !keep(m)) m.dispose();
    const geom = (o as THREE.Mesh).geometry;
    if (geom && !shared.has(geom)) geom.dispose();
  });
}
