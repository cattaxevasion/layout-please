// 집 구조 3D: 방 바닥, 벽(문·창 자리를 비운 조각들), 창 유리, 붙박이 설비.

import * as THREE from 'three';
import { solidIntervals, wallFrame } from '../logic/openings';
import type { House, Wall } from '../model/types';

export interface WallObject {
  wall: Wall;
  group: THREE.Group;
  material: THREE.MeshStandardMaterial;
  edges: THREE.LineBasicMaterial;
}

export interface HouseObjects {
  root: THREE.Group;
  walls: WallObject[];
}

const WALL_COLOR = '#f3f0ea';

export function buildHouse(house: House): HouseObjects {
  const root = new THREE.Group();
  const H = house.ceilingHeight;

  // 바닥: 평면도 (x, y) → 3D (x, 0, y). Shape는 (x, -y)로 만들고 X축으로 -90° 돌린다.
  for (const r of house.rooms) {
    if (r.points.length < 3) continue;
    const shape = new THREE.Shape(r.points.map((p) => new THREE.Vector2(p.x, -p.y)));
    const mesh = new THREE.Mesh(
      new THREE.ShapeGeometry(shape),
      new THREE.MeshStandardMaterial({ color: r.floorColor, roughness: 0.95 }),
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
    const material = new THREE.MeshStandardMaterial({ color: WALL_COLOR, roughness: 0.9, transparent: true, opacity: 1 });
    const edges = new THREE.LineBasicMaterial({ color: '#b9b2a5', transparent: true, opacity: 1 });
    const group = new THREE.Group();
    group.position.set(w.a.x, 0, w.a.y);
    group.rotation.y = -Math.atan2(u.y, u.x);

    const piece = (s: number, e: number, y0: number, y1: number) => {
      if (e - s < 0.1 || y1 - y0 < 0.1) return;
      const g = new THREE.BoxGeometry(e - s, y1 - y0, w.thickness);
      const m = new THREE.Mesh(g, material);
      m.position.set((s + e) / 2, (y0 + y1) / 2, 0);
      m.receiveShadow = true;
      group.add(m);
      const line = new THREE.LineSegments(new THREE.EdgesGeometry(g), edges);
      line.position.copy(m.position);
      group.add(line);
    };

    const doors = house.doors.filter((d) => d.wallId === w.id);
    const wins = house.windows.filter((d) => d.wallId === w.id);
    for (const [s, e] of solidIntervals(length, [...doors, ...wins])) piece(s, e, 0, H);
    for (const d of doors) {
      const s = Math.max(0, d.offset);
      const e = Math.min(length, d.offset + d.width);
      piece(s, e, Math.min(d.height, H), H);
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
    walls.push({ wall: w, group, material, edges });
  }

  for (const f of house.fixtures) {
    const g = new THREE.Group();
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(f.width, f.height, f.depth),
      new THREE.MeshStandardMaterial({ color: f.color, roughness: 0.6 }),
    );
    m.position.y = f.height / 2;
    m.castShadow = true;
    m.receiveShadow = true;
    g.add(m);
    g.position.set(f.x, 0, f.y);
    g.rotation.y = -THREE.MathUtils.degToRad(f.rotation);
    root.add(g);
  }

  return { root, walls };
}

export function disposeHouse(objs: HouseObjects) {
  objs.root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    mesh.geometry?.dispose();
    const m = mesh.material;
    if (Array.isArray(m)) m.forEach((x) => x.dispose());
    else m?.dispose();
  });
}
