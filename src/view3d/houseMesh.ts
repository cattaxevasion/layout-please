// 집 구조 3D: 방 바닥, 벽(문·창 자리를 비운 조각들), 문짝, 창 유리, 붙박이 설비.
// 마감재가 지정된 바닥·벽·문에는 질감을 입힌다.

import * as THREE from 'three';
import { PLAIN } from '../model/finishes';
import { solidIntervals, wallFrame } from '../logic/openings';
import type { Door, House, Wall } from '../model/types';
import { buildFurniture } from './furnitureMesh';
import { cmUvBox, finishTexture } from './textures';

export interface WallObject {
  wall: Wall;
  group: THREE.Group;
  material: THREE.MeshStandardMaterial;
  edges: THREE.LineBasicMaterial;
  /** 이 벽에 달린 문짝 재질들 (벽과 함께 반투명해진다) */
  leaves: THREE.MeshStandardMaterial[];
}

export interface HouseObjects {
  root: THREE.Group;
  walls: WallObject[];
}

const WALL_COLOR = '#f3f0ea';
const DOOR_COLOR = '#e4dccd';
/** 문짝 두께 */
const LEAF_T = 3;
/** 미닫이 문짝끼리 겹치는 폭 */
const LEAF_OVERLAP = 3;

function surface(finishId: string | undefined, plainColor: string, roughness: number) {
  const tex = finishTexture(finishId);
  return new THREE.MeshStandardMaterial({
    color: tex ? '#ffffff' : plainColor,
    map: tex?.texture ?? null,
    roughness,
    transparent: true,
    opacity: 1,
  });
}

export function buildHouse(house: House): HouseObjects {
  const root = new THREE.Group();
  const H = house.ceilingHeight;

  // 바닥: 평면도 (x, y) → 3D (x, 0, y). Shape는 (x, -y)로 만들고 X축으로 -90° 돌린다.
  // ShapeGeometry의 UV는 Shape 좌표(cm) 그대로라 질감 repeat만 맞추면 된다.
  for (const r of house.rooms) {
    if (r.points.length < 3) continue;
    const shape = new THREE.Shape(r.points.map((p) => new THREE.Vector2(p.x, -p.y)));
    const tex = finishTexture(r.floorFinish);
    const mesh = new THREE.Mesh(
      new THREE.ShapeGeometry(shape),
      new THREE.MeshStandardMaterial({
        color: tex ? '#ffffff' : r.floorColor,
        map: tex?.texture ?? null,
        roughness: 0.85,
      }),
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.receiveShadow = true;
    mesh.userData.floor = true;
    root.add(mesh);
  }

  const walls: WallObject[] = [];
  for (const w of house.walls) {
    const { length, u } = wallFrame(w);
    if (length < 0.1) continue;
    const wallFinish = w.finish === PLAIN ? undefined : (w.finish ?? house.wallFinish);
    const material = surface(wallFinish, WALL_COLOR, 0.9);
    const edges = new THREE.LineBasicMaterial({ color: '#c9c2b6', transparent: true, opacity: 1 });
    const leaves: THREE.MeshStandardMaterial[] = [];
    const group = new THREE.Group();
    group.position.set(w.a.x, 0, w.a.y);
    group.rotation.y = -Math.atan2(u.y, u.x);

    const piece = (s: number, e: number, y0: number, y1: number) => {
      if (e - s < 0.1 || y1 - y0 < 0.1) return;
      const g = new THREE.BoxGeometry(e - s, y1 - y0, w.thickness);
      cmUvBox(g, e - s, y1 - y0, w.thickness, s, y0);
      const m = new THREE.Mesh(g, material);
      m.position.set((s + e) / 2, (y0 + y1) / 2, 0);
      m.receiveShadow = true;
      group.add(m);
      const line = new THREE.LineSegments(new THREE.EdgesGeometry(g), edges);
      line.position.copy(m.position);
      group.add(line);
    };

    const leaf = (d: Door, s: number, e: number) => {
      const mat = surface(d.finish, DOOR_COLOR, 0.7);
      leaves.push(mat);
      const h = Math.min(d.height, H) - 0.5;
      const width = e - s;
      // 미닫이 문짝이 여러 장이면 조금씩 겹치게 앞뒤로 엇갈려 놓는다
      const n = d.type === 'sliding' ? Math.max(1, Math.min(4, Math.round(d.panels ?? 1))) : 1;
      const pw = n === 1 ? width - 1 : width / n + LEAF_OVERLAP;
      for (let i = 0; i < n; i++) {
        const cx = s + (width / n) * (i + 0.5);
        const z = n === 1 ? 0 : (i % 2 === 0 ? -1 : 1) * (LEAF_T / 2 + 0.3);
        const g = new THREE.BoxGeometry(pw, h, LEAF_T);
        cmUvBox(g, pw, h, LEAF_T, cx - pw / 2, 0);
        const m = new THREE.Mesh(g, mat);
        m.position.set(cx, h / 2, z);
        m.castShadow = true;
        m.receiveShadow = true;
        group.add(m);
        const line = new THREE.LineSegments(new THREE.EdgesGeometry(g), edges);
        line.position.copy(m.position);
        group.add(line);
      }
    };

    const doors = house.doors.filter((d) => d.wallId === w.id);
    const wins = house.windows.filter((d) => d.wallId === w.id);
    for (const [s, e] of solidIntervals(length, [...doors, ...wins])) piece(s, e, 0, H);
    for (const d of doors) {
      const s = Math.max(0, d.offset);
      const e = Math.min(length, d.offset + d.width);
      piece(s, e, Math.min(d.height, H), H);
      // 문짝 (닫힌 상태). 개구부는 문짝 없이 뚫어 둔다.
      if (d.type !== 'opening' && e - s > 1) leaf(d, s, e);
    }
    for (const win of wins) {
      const s = Math.max(0, win.offset);
      const e = Math.min(length, win.offset + win.width);
      const top = Math.min(H, win.sillHeight + win.height);
      piece(s, e, 0, win.sillHeight);
      piece(s, e, top, H);
      const glass = new THREE.Mesh(
        new THREE.BoxGeometry(e - s, top - win.sillHeight, 1),
        new THREE.MeshStandardMaterial({ color: '#a9d6f5', transparent: true, opacity: 0.35, roughness: 0.1 }),
      );
      glass.position.set((s + e) / 2, (win.sillHeight + top) / 2, 0);
      glass.userData.glass = true;
      group.add(glass);
    }
    group.userData.wallId = w.id;
    root.add(group);
    walls.push({ wall: w, group, material, edges, leaves });
  }

  for (const f of house.fixtures) {
    let g: THREE.Group;
    if (f.shape) {
      g = buildFurniture({ shape: f.shape, width: f.width, depth: f.depth, height: f.height, color: f.color });
    } else {
      g = new THREE.Group();
      const m = new THREE.Mesh(
        new THREE.BoxGeometry(f.width, f.height, f.depth),
        new THREE.MeshStandardMaterial({ color: f.color, roughness: 0.6 }),
      );
      m.position.y = f.height / 2;
      m.castShadow = true;
      m.receiveShadow = true;
      g.add(m);
    }
    g.position.set(f.x, 0, f.y);
    g.rotation.y = -THREE.MathUtils.degToRad(f.rotation);
    root.add(g);
  }

  return { root, walls };
}

/** 지오메트리와 재질만 정리한다 (질감은 캐시에서 계속 쓴다) */
export function disposeHouse(objs: HouseObjects) {
  objs.root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    mesh.geometry?.dispose();
    const m = mesh.material;
    if (Array.isArray(m)) m.forEach((x) => x.dispose());
    else m?.dispose();
  });
}
