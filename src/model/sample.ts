// 첫 실행용 샘플: 사용자 집(LDK 8.5첩 + 양실 3.5첩), 실측값 기준.
// 원점은 LDK 실내 왼쪽 위 모서리.
// ※ 추정값: LDK 가로(365로 쟀지만 144+17+211=372로 계산), 양실 문 위치, 창문, 천장 높이, 외벽 두께.

import { wallsFromRoom } from '../logic/walls';
import { newId } from './ids';
import { BUILTIN_PRESETS, furnitureFromPreset } from './presets';
import { SCHEMA_VERSION } from './types';
import type { Door, Furniture, House, HouseWindow, Layout, ProjectDoc, Room } from './types';

// ── 실측값 ──
const COUNTER_TOP_GAP = 25.5; // 위쪽 벽 ~ 주방 카운터
const COUNTER_LEN = 150;
const LEFT_LOWER = 225; // 카운터 끝 ~ 세면실 벽
const KITCHEN_TO_CL = 173; // 카운터 앞면 ~ CL 왼쪽 벽
const CL_W = 133; // CL 왼쪽 벽 바깥면 ~ 오른쪽 벽
const CL_D = 68;
const LDK_RIGHT = 291; // CL 앞 ~ 양실 위쪽 벽
const BED_WALL = 12; // LDK–양실 사이 벽
const BED_W = 211;
const BED_H_RIGHT = 236;
const BED_H_LEFT = 229;
const PILLAR_W = 48.5; // 양실 왼쪽 아래 기둥 폭
const PASSAGE_W = 144; // 세면실 앞 통로 폭
const PASSAGE_WALL = 17; // 통로–양실 사이 벽
const WASHROOM_WALL_LEN = 73.5; // 통로 쪽 세면실 벽 (나머지가 문)
const DOOR_W = 68.5; // 미닫이 문 폭

// ── 파생값 ──
// LDK 가로는 365로 쟀지만 아래쪽 실측 합(144+17+211)이 372이고, 372일 때 카운터 깊이가
// 66으로 표준(65)에 가까워서 372를 쓴다.
const LDK_W = PASSAGE_W + PASSAGE_WALL + BED_W; // 372
const COUNTER_D = LDK_W - KITCHEN_TO_CL - CL_W; // 66
const CL_X = COUNTER_D + KITCHEN_TO_CL; // 239
const LDK_BOTTOM_RIGHT = CL_D + LDK_RIGHT; // 359
const LDK_BOTTOM_LEFT = COUNTER_TOP_GAP + COUNTER_LEN + LEFT_LOWER; // 400.5
const BED_TOP = LDK_BOTTOM_RIGHT + BED_WALL; // 371
const BED_LEFT = PASSAGE_W + PASSAGE_WALL; // 161

const EXT = 15; // 외벽 (추정)
const INT = 10; // 내벽 (추정)

function preset(id: string) {
  const found = BUILTIN_PRESETS.find((p) => p.id === id);
  if (!found) throw new Error(`unknown preset ${id}`);
  return found;
}

function place(presetId: string, x: number, y: number, rotation = 0): Furniture {
  return furnitureFromPreset(preset(presetId), { x, y }, rotation);
}

function sliding(wallId: string, offset: number, width: number): Door {
  return {
    id: newId('d'),
    wallId,
    type: 'sliding',
    offset,
    width,
    height: 200,
    hinge: 'start',
    side: -1,
    swingRadius: width,
    swingAngle: 90,
  };
}

export function createSampleHouse(): House {
  const ldk: Room = {
    id: newId('r'),
    name: 'LDK',
    floorColor: '#e8dcc8',
    points: [
      { x: 0, y: 0 },
      { x: CL_X, y: 0 },
      { x: CL_X, y: CL_D },
      { x: LDK_W, y: CL_D },
      { x: LDK_W, y: LDK_BOTTOM_RIGHT },
      { x: PASSAGE_W, y: LDK_BOTTOM_RIGHT },
      { x: PASSAGE_W, y: LDK_BOTTOM_LEFT },
      { x: 0, y: LDK_BOTTOM_LEFT },
    ],
  };
  const bedroom: Room = {
    id: newId('r'),
    name: '양실',
    floorColor: '#efe4d2',
    points: [
      { x: BED_LEFT, y: BED_TOP },
      { x: LDK_W, y: BED_TOP },
      { x: LDK_W, y: BED_TOP + BED_H_RIGHT },
      { x: BED_LEFT + PILLAR_W, y: BED_TOP + BED_H_RIGHT },
      { x: BED_LEFT + PILLAR_W, y: BED_TOP + BED_H_LEFT },
      { x: BED_LEFT, y: BED_TOP + BED_H_LEFT },
    ],
  };

  // LDK 변: 0 위(현관·화장실 쪽) 1 CL 옆 2 CL 앞 3 오른쪽 외벽 4 양실 위쪽 5 통로–양실(양실 쪽에서 생성) 6 세면실 7 왼쪽 외벽
  const ldkWalls = wallsFromRoom(ldk.points, [INT, INT, INT, EXT, BED_WALL, PASSAGE_WALL, INT, EXT], [5]);
  // 양실 변: 0 위(LDK와 공유하므로 생략) 1 오른쪽 외벽 2 발코니 3·4 기둥 5 왼쪽
  const bedroomWalls = wallsFromRoom(bedroom.points, [BED_WALL, EXT, EXT, INT, INT, PASSAGE_WALL], [0]);
  const [ldkTop, , ldkClosetFront, , ldkBedroomSide, ldkWashroomSide, ldkLeft] = ldkWalls;
  const [, bedroomBalcony] = bedroomWalls;

  // 벽 a점은 볼록 모서리에서 이웃 벽 두께만큼 늘어나 있으므로 offset에 그만큼 더한다.
  const doors: Door[] = [
    // 현관 → LDK: CL 왼쪽 벽에 붙어 있음
    sliding(ldkTop.id, EXT + CL_X - DOOR_W, DOOR_W),
    // CL 문
    sliding(ldkClosetFront.id, INT, CL_W - INT * 2),
    // LDK → 양실: 양실 왼쪽 끝에 있다고 가정 (위치 추정)
    sliding(ldkBedroomSide.id, EXT + BED_W - DOOR_W, DOOR_W),
    // 세면실 문: 통로 왼쪽 벽 73.5 다음부터 통로 오른쪽 끝까지
    sliding(ldkWashroomSide.id, PASSAGE_WALL, PASSAGE_W - WASHROOM_WALL_LEN),
  ];

  const windows: HouseWindow[] = [
    // LDK 왼쪽 창 (위치·크기 추정)
    { id: newId('n'), wallId: ldkLeft.id, offset: 25.5, width: 75, sillHeight: 90, height: 110 },
    // 양실 발코니 창: 기둥 옆부터 오른쪽 벽까지 (높이 추정)
    {
      id: newId('n'),
      wallId: bedroomBalcony.id,
      offset: EXT,
      width: BED_W - PILLAR_W,
      sillHeight: 10,
      height: 180,
    },
  ];

  return {
    ceilingHeight: 240,
    rooms: [ldk, bedroom],
    walls: [...ldkWalls, ...bedroomWalls],
    doors,
    windows,
    fixtures: [
      {
        id: newId('x'),
        name: '주방 카운터',
        x: COUNTER_D / 2,
        y: COUNTER_TOP_GAP + COUNTER_LEN / 2,
        width: COUNTER_LEN,
        depth: COUNTER_D,
        height: 85,
        rotation: 270,
        color: '#d9d9d9',
      },
      {
        id: newId('x'),
        name: '냉장고 자리',
        x: COUNTER_D / 2,
        y: COUNTER_TOP_GAP + COUNTER_LEN + 30,
        width: 60,
        depth: COUNTER_D,
        height: 180,
        rotation: 270,
        color: '#f2f2f2',
      },
    ],
  };
}

function layoutA(): Layout {
  return {
    id: newId('l'),
    name: 'A안',
    updatedAt: Date.now(),
    furniture: [
      place('sofa-2', 329.5, 250, 90),
      place('tv-stand', 20, 315, 270),
      place('dining-2', 150, 120),
      place('chair', 150, 60),
      place('chair', 150, 180, 180),
      place('bed-single', 322, 471),
      place('desk', 191, 530, 270),
      place('chair', 246, 530, 90),
    ],
  };
}

function layoutB(): Layout {
  return {
    id: newId('l'),
    name: 'B안',
    updatedAt: Date.now(),
    furniture: [
      place('sofa-2', 240, 310, 180),
      place('tv-stand', 290, 95),
      place('dining-2', 110, 280),
      place('chair', 110, 220),
      place('chair', 110, 340, 180),
      place('bed-single', 211, 471),
      place('desk', 342, 530, 90),
      place('bookshelf', 357, 420, 90),
    ],
  };
}

export function createSampleDoc(): ProjectDoc {
  const a = layoutA();
  return {
    version: SCHEMA_VERSION,
    house: createSampleHouse(),
    layouts: [a, layoutB()],
    activeLayoutId: a.id,
    userPresets: [],
  };
}
