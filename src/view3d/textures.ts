// 마감재 질감 불러오기와 캐시. 질감 한 장을 여러 벽·바닥이 같이 쓴다.
// UV를 cm 단위로 만들어 두고 repeat = 1 / 실제 타일 크기로 맞추면 어디서나 같은 크기로 보인다.

import * as THREE from 'three';
import { finishById, type Finish } from '../model/finishes';

const cache = new Map<string, THREE.Texture>();
let onLoaded: (() => void) | null = null;
let anisotropy = 1;

export function configureTextures(opts: { onLoad: () => void; anisotropy: number }) {
  onLoaded = opts.onLoad;
  anisotropy = opts.anisotropy;
}

export function finishTexture(id: string | undefined | null): { texture: THREE.Texture; finish: Finish } | null {
  const finish = finishById(id);
  if (!finish) return null;
  let texture = cache.get(finish.id);
  if (!texture) {
    texture = new THREE.TextureLoader().load(`${import.meta.env.BASE_URL}textures/${finish.file}`, () => onLoaded?.());
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.repeat.set(1 / finish.tileCm[0], 1 / finish.tileCm[1]);
    texture.anisotropy = anisotropy;
    cache.set(finish.id, texture);
  }
  return { texture, finish };
}

/**
 * 박스의 UV를 cm 단위로 바꾼다 (기본은 면마다 0~1).
 * u0, v0는 벽을 따라 무늬가 이어지도록 조각의 시작 위치를 더해 준다.
 */
export function cmUvBox(g: THREE.BoxGeometry, w: number, h: number, d: number, u0 = 0, v0 = 0) {
  const uv = g.attributes.uv as THREE.BufferAttribute;
  // 면 순서: +x, -x, +y, -y, +z, -z (면마다 꼭짓점 4개)
  const dims: [number, number][] = [
    [d, h],
    [d, h],
    [w, d],
    [w, d],
    [w, h],
    [w, h],
  ];
  for (let f = 0; f < 6; f++) {
    const [fw, fh] = dims[f];
    const side = f === 2 || f === 3;
    for (let i = 0; i < 4; i++) {
      const k = f * 4 + i;
      uv.setXY(k, uv.getX(k) * fw + (f >= 4 ? u0 : 0), uv.getY(k) * fh + (side ? 0 : v0));
    }
  }
  uv.needsUpdate = true;
}
