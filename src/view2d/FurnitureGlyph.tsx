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
    case 'fridge':
    case 'waterServer':
    case 'microwave':
    case 'fridgeMicrowave':
      // 정면 쪽에 선을 그어 앞뒤를 구분
      return (
        <>
          {base}
          <line x1={x0 + 2} y1={-y0 - 3} x2={-x0 - 2} y2={-y0 - 3} {...line} />
        </>
      );
    case 'officeChair': {
      // 별 모양 다리 바닥 원 + 좌판 + 등받이
      const r = Math.min(w, d) / 2;
      return (
        <>
          <rect x={x0} y={y0} width={w} height={d} fill="transparent" stroke="none" />
          <circle cx={0} cy={0} r={r} fill="none" {...line} stroke-dasharray="3 3" />
          <rect x={-w * 0.38} y={-d * 0.3} width={w * 0.76} height={d * 0.7} rx={6} fill={fill} {...line} />
          <rect x={-w * 0.36} y={-d * 0.42} width={w * 0.72} height={d * 0.1} rx={2} {...detail} />
        </>
      );
    }
    case 'standingDesk': {
      const lx = w / 2 - Math.min(18, w * 0.15);
      return (
        <>
          {base}
          {[-1, 1].map((s) => (
            <line key={s} x1={s * lx} y1={y0 + 3} x2={s * lx} y2={-y0 - 3} {...line} stroke-dasharray="4 3" />
          ))}
        </>
      );
    }
    case 'drawers':
      return (
        <>
          {base}
          <line x1={x0 + 2} y1={-y0 - 3} x2={-x0 - 2} y2={-y0 - 3} {...line} />
          <circle cx={0} cy={-y0 - 1.5} r={1.8} fill="#4a4a4a" />
        </>
      );
    case 'metalShelf': {
      const t = 4;
      return (
        <>
          {base}
          {[
            [x0, y0],
            [-x0 - t, y0],
            [x0, -y0 - t],
            [-x0 - t, -y0 - t],
          ].map(([px, py], i) => (
            <rect key={i} x={px} y={py} width={t} height={t} fill="#000" />
          ))}
          <line x1={x0 + t} y1={y0 + t} x2={-x0 - t} y2={-y0 - t} {...line} stroke-opacity={0.3} />
          <line x1={-x0 - t} y1={y0 + t} x2={x0 + t} y2={-y0 - t} {...line} stroke-opacity={0.3} />
        </>
      );
    }
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
