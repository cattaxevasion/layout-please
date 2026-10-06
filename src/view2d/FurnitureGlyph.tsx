// 가구 위에서 본 모양. 로컬 좌표(중심 원점, 정면이 +y)로 그리고 바깥에서 이동·회전시킨다.

import type { Furniture } from '../model/types';

interface Props {
  f: Furniture;
  fill: string;
  stroke: string;
  strokeWidth: number;
}

export function FurnitureGlyph({ f, fill, stroke, strokeWidth }: Props) {
  const w = f.width;
  const d = f.depth;
  const x0 = -w / 2;
  const y0 = -d / 2;
  const line = { stroke, 'stroke-width': strokeWidth, 'vector-effect': 'non-scaling-stroke' };
  const base = <rect x={x0} y={y0} width={w} height={d} fill={fill} {...line} />;
  const detail = { fill: 'rgba(0,0,0,0.12)', ...line };

  switch (f.shape) {
    case 'bed': {
      const head = Math.min(8, d * 0.06);
      const pillowD = Math.min(35, d * 0.18);
      return (
        <>
          {base}
          <rect x={x0} y={y0} width={w} height={head} {...detail} />
          <rect
            x={x0 + w * 0.1}
            y={y0 + head + 4}
            width={w * 0.8}
            height={pillowD}
            rx={4}
            fill="rgba(255,255,255,0.6)"
            {...line}
          />
        </>
      );
    }
    case 'sofa': {
      const back = d * 0.25;
      const arm = Math.min(20, w * 0.12);
      return (
        <>
          {base}
          <rect x={x0} y={y0} width={w} height={back} {...detail} />
          <rect x={x0} y={y0} width={arm} height={d} {...detail} />
          <rect x={-x0 - arm} y={y0} width={arm} height={d} {...detail} />
        </>
      );
    }
    case 'chair': {
      const back = d * 0.18;
      return (
        <>
          {base}
          <rect x={x0} y={y0} width={w} height={back} {...detail} />
        </>
      );
    }
    case 'storage':
    case 'bookshelf':
    case 'tvStand':
      // 정면 쪽에 선을 그어 앞뒤를 구분
      return (
        <>
          {base}
          <line x1={x0 + 2} y1={-y0 - 3} x2={-x0 - 2} y2={-y0 - 3} {...line} />
        </>
      );
    case 'box':
      return (
        <>
          {base}
          <line x1={x0} y1={y0} x2={-x0} y2={-y0} {...line} stroke-opacity={0.3} />
          <line x1={-x0} y1={y0} x2={x0} y2={-y0} {...line} stroke-opacity={0.3} />
        </>
      );
    default:
      return base;
  }
}
