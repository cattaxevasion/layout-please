// 3D 뷰: store를 구독해 장면을 맞추고, 궤도 카메라와 가구 선택·드래그를 처리한다.
// 바뀐 것이 있을 때만 다시 그린다.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { cross, sub } from '../geometry/vec';
import { wallFrame } from '../logic/openings';
import { snapRect, snapTargets } from '../logic/snap';
import type { Furniture, House, Id, Vec2 } from '../model/types';
import { actions, store } from '../store';
import type { AppState } from '../store/appState';
import { selectCollisions, selectFurnitureList } from '../store/selectors';
import { houseBounds } from '../view2d/camera';
import { buildFurniture, disposeGroup, furnitureShapeKey } from './furnitureMesh';
import { buildHouse, disposeHouse, type HouseObjects } from './houseMesh';

interface FurnitureObject {
  key: string;
  group: THREE.Group;
  outline: THREE.LineSegments | null;
  /** 마지막으로 적용한 강조 상태 (바뀐 가구만 다시 칠하기 위해) */
  highlight: string;
}

const ACCENT = new THREE.Color('#2f6fde');
const DANGER = new THREE.Color('#d33a2c');
const BLACK = new THREE.Color('#000000');

/** 이 높이각보다 위에서 내려다보면 벽을 반투명하게 하지 않는다 */
const TOP_VIEW_POLAR = THREE.MathUtils.degToRad(20);

export class Scene3D {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(50, 1, 1, 20000);
  private controls: OrbitControls;
  private sun = new THREE.DirectionalLight('#ffffff', 1.5);
  private house: HouseObjects | null = null;
  private furnitureRoot = new THREE.Group();
  private items = new Map<Id, FurnitureObject>();
  private raycaster = new THREE.Raycaster();
  private ro: ResizeObserver;
  private unsub: () => void;
  private raf = 0;
  private dirty = true;
  private last: Partial<{
    house: House;
    list: readonly Furniture[];
    collisions: ReturnType<typeof selectCollisions>;
    selection: AppState['ui']['selection'];
    walls3d: AppState['ui']['walls3d'];
  }> = {};
  private drag: { id: Id; offset: Vec2; targets: ReturnType<typeof snapTargets> } | null = null;
  private down: { x: number; y: number; onFurniture: boolean } | null = null;

  constructor(private container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);
    this.renderer.domElement.style.touchAction = 'none';

    this.scene.background = new THREE.Color('#e9e6e0');
    this.scene.add(new THREE.HemisphereLight('#ffffff', '#b8ab98', 1.6));
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.bias = -0.0005;
    this.scene.add(this.sun, this.sun.target);
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(20000, 20000),
      new THREE.MeshStandardMaterial({ color: '#dcd8d0', roughness: 1 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.5;
    ground.receiveShadow = true;
    this.scene.add(ground);
    this.scene.add(this.furnitureRoot);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.12;
    this.controls.maxPolarAngle = THREE.MathUtils.degToRad(88);
    this.controls.minDistance = 50;
    this.controls.maxDistance = 5000;
    this.controls.addEventListener('change', () => (this.dirty = true));

    // OrbitControls보다 먼저 받기 위해 캡처 단계에서 듣는다
    container.addEventListener('pointerdown', this.onPointerDown, true);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    window.addEventListener('pointercancel', this.onPointerUp);

    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(container);
    this.resize();

    this.sync(store.getState());
    this.resetView();
    this.unsub = store.subscribe(() => this.sync(store.getState()));
    this.loop();
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    this.unsub();
    this.ro.disconnect();
    this.container.removeEventListener('pointerdown', this.onPointerDown, true);
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
    window.removeEventListener('pointercancel', this.onPointerUp);
    this.controls.dispose();
    if (this.house) disposeHouse(this.house);
    this.items.forEach((it) => disposeGroup(it.group));
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  /** 집 전체가 보이도록 남동쪽 위에서 비스듬히 */
  resetView() {
    const { center, size } = this.frame();
    this.controls.target.copy(center);
    this.camera.position.set(center.x + size * 0.45, size * 1.05, center.z + size * 1.15);
    this.controls.update();
    this.dirty = true;
  }

  /** 위에서 내려다보기 (평면도와 같은 방향: 위쪽이 북쪽) */
  topView() {
    const { center, size } = this.frame();
    this.controls.target.copy(center);
    this.camera.position.set(center.x, size * 1.6, center.z + 1);
    this.controls.update();
    this.dirty = true;
  }

  private frame() {
    const b = houseBounds(store.getState().history.present.house);
    const center = new THREE.Vector3((b.minX + b.maxX) / 2, 0, (b.minY + b.maxY) / 2);
    const size = Math.max(200, b.maxX - b.minX, b.maxY - b.minY);
    return { center, size };
  }

  private resize() {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    if (w === 0 || h === 0) return;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.dirty = true;
  }

  private loop = () => {
    this.raf = requestAnimationFrame(this.loop);
    const moved = this.controls.update();
    if (moved || this.dirty) {
      this.updateWallVisibility();
      this.renderer.render(this.scene, this.camera);
      this.dirty = false;
    }
  };

  // ───────── store와 동기화 ─────────

  private sync(s: AppState) {
    const house = s.history.present.house;
    const list = selectFurnitureList(s);
    const collisions = selectCollisions(s);
    const { selection, walls3d } = s.ui;
    const L = this.last;
    if (house !== L.house) this.rebuildHouse(house);
    if (list !== L.list) this.syncFurniture(list);
    if (list !== L.list || collisions !== L.collisions || selection !== L.selection) {
      this.updateHighlights(list, collisions, selection);
    }
    if (house !== L.house || walls3d !== L.walls3d) this.dirty = true;
    this.last = { house, list, collisions, selection, walls3d };
    this.dirty = true;
  }

  private rebuildHouse(house: House) {
    if (this.house) {
      this.scene.remove(this.house.root);
      disposeHouse(this.house);
    }
    this.house = buildHouse(house);
    this.scene.add(this.house.root);

    // 그림자 범위를 집 크기에 맞춘다
    const { center, size } = this.frame();
    this.sun.position.set(center.x - size * 0.4, size * 1.5, center.z - size * 0.2);
    this.sun.target.position.copy(center);
    const cam = this.sun.shadow.camera;
    cam.left = cam.bottom = -size;
    cam.right = cam.top = size;
    cam.near = 1;
    cam.far = size * 4;
    cam.updateProjectionMatrix();
  }

  private syncFurniture(list: readonly Furniture[]) {
    const seen = new Set<Id>();
    for (const f of list) {
      seen.add(f.id);
      const key = furnitureShapeKey(f);
      let it = this.items.get(f.id);
      if (!it || it.key !== key) {
        if (it) {
          this.furnitureRoot.remove(it.group);
          disposeGroup(it.group);
        }
        const group = buildFurniture(f);
        group.userData.fid = f.id;
        this.furnitureRoot.add(group);
        it = { key, group, outline: null, highlight: '' };
        this.items.set(f.id, it);
      }
      it.group.position.set(f.x, 0, f.y);
      it.group.rotation.y = -THREE.MathUtils.degToRad(f.rotation);
    }
    for (const [id, it] of this.items) {
      if (!seen.has(id)) {
        this.furnitureRoot.remove(it.group);
        disposeGroup(it.group);
        this.items.delete(id);
      }
    }
  }

  private updateHighlights(
    list: readonly Furniture[],
    collisions: ReturnType<typeof selectCollisions>,
    selection: AppState['ui']['selection'],
  ) {
    const selectedId = selection?.kind === 'furniture' ? selection.id : null;
    for (const f of list) {
      const it = this.items.get(f.id);
      if (!it) continue;
      const problem = collisions.has(f.id);
      const selected = selectedId === f.id;
      const state = `${problem}|${selected}|${it.key}`;
      if (state === it.highlight) continue;
      it.highlight = state;
      it.group.traverse((o) => {
        const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
        if (m && 'emissive' in m && o !== it.outline) {
          m.emissive.copy(problem ? DANGER : BLACK);
          m.emissiveIntensity = problem ? 0.55 : 0;
        }
      });
      const wantOutline = selected || problem;
      if (it.outline) {
        it.group.remove(it.outline);
        it.outline.geometry.dispose();
        (it.outline.material as THREE.Material).dispose();
        it.outline = null;
      }
      if (wantOutline) {
        const g = new THREE.EdgesGeometry(new THREE.BoxGeometry(f.width + 2, f.height + 2, f.depth + 2));
        const line = new THREE.LineSegments(
          g,
          new THREE.LineBasicMaterial({ color: selected ? ACCENT : DANGER, depthTest: false, transparent: true }),
        );
        line.position.y = f.height / 2;
        line.renderOrder = 10;
        it.group.add(line);
        it.outline = line;
      }
    }
  }

  /** 벽 표시: 자동(카메라와 방 사이 벽은 반투명) / 불투명 / 낮게 */
  private updateWallVisibility() {
    if (!this.house) return;
    const mode = store.getState().ui.walls3d;
    const cam: Vec2 = { x: this.camera.position.x, y: this.camera.position.z };
    const target: Vec2 = { x: this.controls.target.x, y: this.controls.target.z };
    const topDown = this.controls.getPolarAngle() < TOP_VIEW_POLAR;
    const H = store.getState().history.present.house.ceilingHeight;
    for (const w of this.house.walls) {
      let opacity = 1;
      if (mode === 'auto' && !topDown) {
        const { u } = wallFrame(w.wall);
        const sc = cross(u, sub(cam, w.wall.a));
        const st = cross(u, sub(target, w.wall.a));
        if (sc * st < 0) opacity = 0.12;
      }
      w.material.opacity = opacity;
      w.material.depthWrite = opacity === 1;
      w.leaf.opacity = opacity === 1 ? 1 : 0.2;
      w.leaf.depthWrite = opacity === 1;
      w.edges.opacity = opacity === 1 ? 1 : 0.35;
      w.group.scale.y = mode === 'hidden' ? Math.min(1, 15 / H) : 1;
      w.group.traverse((o) => {
        if (o.userData.glass) o.visible = mode !== 'hidden';
      });
    }
  }

  // ───────── 선택과 드래그 ─────────

  private pointerNdc(e: PointerEvent) {
    const r = this.renderer.domElement.getBoundingClientRect();
    return new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  }

  private pickFurniture(e: PointerEvent): Id | null {
    this.raycaster.setFromCamera(this.pointerNdc(e), this.camera);
    const hits = this.raycaster.intersectObjects(this.furnitureRoot.children, true);
    for (const h of hits) {
      let o: THREE.Object3D | null = h.object;
      while (o && !o.userData.fid) o = o.parent;
      if (o) return o.userData.fid as Id;
    }
    return null;
  }

  private groundPoint(e: PointerEvent): Vec2 | null {
    this.raycaster.setFromCamera(this.pointerNdc(e), this.camera);
    const p = new THREE.Vector3();
    const hit = this.raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), p);
    return hit ? { x: p.x, y: p.z } : null;
  }

  private onPointerDown = (e: PointerEvent) => {
    if (e.button !== 0) return;
    const id = this.pickFurniture(e);
    this.down = { x: e.clientX, y: e.clientY, onFurniture: !!id };
    if (!id) return;
    const s = store.getState();
    actions.select({ kind: 'furniture', id });
    if (s.ui.readOnly || s.ui.mode !== 'arrange') return;
    const f = selectFurnitureList(s).find((x) => x.id === id);
    const p = this.groundPoint(e);
    if (!f || !p) return;
    // 가구를 잡았으면 카메라는 움직이지 않는다
    e.stopPropagation();
    this.controls.enabled = false;
    actions.beginGesture();
    this.drag = {
      id,
      offset: { x: f.x - p.x, y: f.y - p.y },
      targets: snapTargets(s.history.present.house, selectFurnitureList(s), id, s.ui.snap),
    };
  };

  private onPointerMove = (e: PointerEvent) => {
    if (!this.drag) return;
    const p = this.groundPoint(e);
    const s = store.getState();
    const f = selectFurnitureList(s).find((x) => x.id === this.drag!.id);
    if (!p || !f) return;
    const raw = { ...f, x: p.x + this.drag.offset.x, y: p.y + this.drag.offset.y };
    const r = e.altKey ? raw : snapRect(raw, { ...s.ui.snap, targets: this.drag.targets });
    actions.moveFurniture(f.id, Math.round(r.x * 10) / 10, Math.round(r.y * 10) / 10);
  };

  private onPointerUp = (e: PointerEvent) => {
    if (this.drag) {
      this.drag = null;
      actions.endGesture();
      this.controls.enabled = true;
    } else if (this.down && !this.down.onFurniture && e.target === this.renderer.domElement) {
      // 빈 곳을 클릭(드래그 없이)하면 선택 해제
      if (Math.hypot(e.clientX - this.down.x, e.clientY - this.down.y) < 4) actions.select(null);
    }
    this.down = null;
  };
}
