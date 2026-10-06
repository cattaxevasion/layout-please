// 모든 길이 단위는 cm.
// 평면도 좌표계: x는 오른쪽, y는 아래쪽(SVG와 동일). 3D에서는 (x, y) → (x, 0, y), 높이는 +Y.
// 각도는 도(degree) 단위이며 평면도에서 시계방향이 양수.

export const SCHEMA_VERSION = 1;

export type Id = string;

export interface Vec2 {
  x: number;
  y: number;
}

// ───────── 집 구조 ─────────

export interface House {
  ceilingHeight: number;
  rooms: Room[];
  walls: Wall[];
  doors: Door[];
  windows: HouseWindow[];
  /** 붙박이 설비(주방 카운터, 냉장고 자리 등). 구조에 속하며 배치안과 무관하게 고정된다. */
  fixtures: Fixture[];
  /** 집 기본 벽지 (마감재 id, finishes.ts). 없으면 단색 */
  wallFinish?: Id;
}

export interface Room {
  id: Id;
  name: string;
  /** 실내 면(줄자로 잰 안쪽 치수) 기준 꼭짓점. 화면상 시계방향으로 정규화해 저장한다. */
  points: Vec2[];
  floorColor: string;
  /** 바닥재 (마감재 id). 없으면 floorColor 단색 */
  floorFinish?: Id;
}

export interface Wall {
  id: Id;
  /** 벽 중심선 시작점 */
  a: Vec2;
  /** 벽 중심선 끝점 */
  b: Vec2;
  thickness: number;
  /** 방 둘레에서 자동 생성된 벽이면 그 방 id. 방 모양을 바꾸면 이 벽들이 다시 만들어진다. */
  roomId?: Id;
  /** 이 벽만 다른 벽지 (마감재 id, 'plain'이면 단색). 없으면 집 기본 벽지 */
  finish?: Id;
}

/** 문과 창은 벽에 붙어 있어 벽을 옮기면 함께 따라간다. */
export interface Opening {
  id: Id;
  wallId: Id;
  /** 벽 a점에서 개구부 시작까지 중심선을 따라 잰 거리 */
  offset: number;
  width: number;
}

/**
 * hinged: 여닫이(스윙 영역 있음), folding: 접이문(폭의 절반 정도가 튀어나옴),
 * sliding: 미닫이(스윙 영역 없음), opening: 문 없는 개구부
 */
export type DoorType = 'hinged' | 'folding' | 'sliding' | 'opening';

export interface Door extends Opening {
  type: DoorType;
  height: number;
  /** 경첩이 개구부의 어느 끝에 있는지 (벽 a쪽 = start, b쪽 = end) */
  hinge: 'start' | 'end';
  /** 열리는 쪽: 벽 진행방향(a→b) 기준 화면상 왼쪽(1) / 오른쪽(-1) */
  side: 1 | -1;
  swingRadius: number;
  swingAngle: number;
  /** 문짝 표면 (마감재 id). 없으면 기본 색 */
  finish?: Id;
  /** 미닫이 문짝 수 (옷장처럼 두 장이 겹치는 문은 2). 없으면 1 */
  panels?: number;
}

// 'Window'는 DOM 전역 타입과 이름이 겹쳐서 HouseWindow로 쓴다.
export interface HouseWindow extends Opening {
  /** 바닥에서 창 아래까지 */
  sillHeight: number;
  height: number;
}

export interface Fixture {
  id: Id;
  name: string;
  x: number;
  y: number;
  width: number;
  depth: number;
  height: number;
  rotation: number;
  color: string;
  /** 3D 모양 (없으면 박스). 냉장고처럼 가구 형태를 빌려 쓴다 */
  shape?: ShapeKind;
}

// ───────── 가구 ─────────

export type ShapeKind =
  | 'box'
  | 'bed'
  | 'sofa'
  | 'desk'
  | 'chair'
  | 'storage'
  | 'diningTable'
  | 'tvStand'
  | 'bookshelf'
  | 'standingDesk'
  | 'officeChair'
  | 'drawers'
  | 'metalShelf'
  | 'fridge'
  | 'waterServer'
  | 'microwave'
  | 'fridgeMicrowave';

export interface Furniture {
  id: Id;
  name: string;
  /** 3D 형태를 결정한다 */
  shape: ShapeKind;
  /** 어느 프리셋에서 만들어졌는지 (참고용) */
  presetId?: Id;
  /** 로컬 x 길이 (가로) */
  width: number;
  /** 로컬 y 길이 (세로). 정면(소파 앉는 쪽, 침대 발치)은 로컬 +y 방향 */
  depth: number;
  height: number;
  /** '#rrggbb' */
  color: string;
  /** 바닥 투영 사각형의 중심 */
  x: number;
  y: number;
  /** [0, 360) */
  rotation: number;
}

export interface FurniturePreset {
  id: Id;
  name: string;
  shape: ShapeKind;
  width: number;
  depth: number;
  height: number;
  color: string;
  builtin: boolean;
  /** 가구 목록에서 묶어 보여 줄 이름 */
  group?: string;
}

/** 배치안 (A안, B안 …) */
export interface Layout {
  id: Id;
  name: string;
  furniture: Furniture[];
  updatedAt: number;
}

// ───────── 저장 단위 ─────────

/** localStorage, JSON 내보내기, Undo의 대상 */
export interface ProjectDoc {
  version: number;
  house: House;
  layouts: Layout[];
  activeLayoutId: Id;
  userPresets: FurniturePreset[];
}

/** 공유 링크의 URL 해시에 압축해서 담는 내용 */
export interface SharePayload {
  version: number;
  house: House;
  layout: Layout;
}

// ───────── UI 상태 (저장하지 않으며 Undo 대상도 아님) ─────────

export type Mode = 'arrange' | 'structure';
export type ViewMode = 'split' | '2d' | '3d';

export type Selection =
  | { kind: 'furniture'; id: Id }
  | { kind: 'room'; id: Id; vertex?: number }
  | { kind: 'wall' | 'door' | 'window' | 'fixture'; id: Id };

export interface SnapSettings {
  grid: boolean;
  gridSize: number;
  walls: boolean;
  furniture: boolean;
  /** 이 거리(cm) 안으로 들어오면 벽/가구에 붙는다 */
  threshold: number;
}

export interface UiState {
  mode: Mode;
  view: ViewMode;
  selection: Selection | null;
  snap: SnapSettings;
  /** auto = 카메라 쪽 벽만 반투명 */
  walls3d: 'auto' | 'solid' | 'hidden';
  /** 공유 링크로 열었을 때 열람 상태 */
  readOnly: boolean;
  /** 화면 아래에 잠깐 띄우는 안내 문구 */
  notice: string | null;
}

// ───────── 충돌 결과 (계산값) ─────────

export type IssueType = 'outOfRoom' | 'wall' | 'overlap' | 'doorSwing';

export interface Issue {
  type: IssueType;
  /** 겹친 상대 가구/설비/문 id */
  otherId?: Id;
}

export type CollisionMap = Map<Id, Issue[]>;
