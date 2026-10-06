import { describe, expect, it } from 'vitest';
import { getActiveLayout } from '../model/ops';
import { createSampleDoc } from '../model/sample';
import { DocError } from '../model/migrate';
import {
  buildShareUrl,
  decodeShare,
  encodeShare,
  parseShareHash,
  SHARE_PREFIX,
  shareSizeLevel,
} from './share';

describe('공유 링크', () => {
  it('인코딩 → 디코딩 왕복', () => {
    const d = createSampleDoc();
    const layout = getActiveLayout(d);
    const decoded = decodeShare(encodeShare(d.house, layout));
    // id는 짧게 바뀌지만 내용과 관계는 같다
    const strip = <T extends { id: string }>(x: T) => ({ ...x, id: '' });
    expect(decoded.layout.name).toBe(layout.name);
    expect(decoded.layout.furniture.map(({ presetId: _p, ...f }) => strip(f))).toEqual(
      layout.furniture.map(({ presetId: _p, ...f }) => strip(f)),
    );
    expect(decoded.house.rooms.map(strip)).toEqual(d.house.rooms.map(strip));
    expect(decoded.house.walls).toHaveLength(d.house.walls.length);
    const wallIds = new Set(decoded.house.walls.map((w) => w.id));
    expect(decoded.house.doors.every((x) => wallIds.has(x.wallId))).toBe(true);
    const roomIds = new Set(decoded.house.rooms.map((r) => r.id));
    expect(decoded.house.walls.every((w) => !w.roomId || roomIds.has(w.roomId))).toBe(true);
  });

  it('URL에 쓸 수 있는 문자만 쓴다', () => {
    const d = createSampleDoc();
    const url = buildShareUrl('https://example.com/layout-please/', d.house, getActiveLayout(d));
    expect(url.startsWith('https://example.com/layout-please/#s=')).toBe(true);
    expect(/^[A-Za-z0-9+\-$_]*$/.test(url.split(SHARE_PREFIX)[1])).toBe(true);
  });

  it('샘플 집 + 가구 8개 링크는 경고 기준(2000자) 안쪽', () => {
    const d = createSampleDoc();
    const url = buildShareUrl('https://example.com/layout-please/', d.house, getActiveLayout(d));
    expect(url.length).toBeLessThan(2000);
    expect(shareSizeLevel(url)).toBe('ok');
  });

  it('크기 단계', () => {
    expect(shareSizeLevel('x'.repeat(100))).toBe('ok');
    expect(shareSizeLevel('x'.repeat(3000))).toBe('warn');
    expect(shareSizeLevel('x'.repeat(20000))).toBe('danger');
  });

  it('해시가 없으면 null, 잘린 링크는 한국어 오류', () => {
    expect(parseShareHash('')).toBeNull();
    expect(parseShareHash('#other')).toBeNull();
    const d = createSampleDoc();
    const enc = encodeShare(d.house, getActiveLayout(d));
    expect(() => parseShareHash(SHARE_PREFIX + enc.slice(0, enc.length / 2))).toThrow(DocError);
  });
});
