import { useEffect, useRef, useState } from 'preact/hooks';
import type { UiState } from '../model/types';
import { actions, useApp } from '../store';
import type { Scene3D } from './Scene3D';

const WALL_MODES: [UiState['walls3d'], string][] = [
  ['auto', '벽 자동'],
  ['solid', '벽 불투명'],
  ['hidden', '벽 낮게'],
];

/** three.js는 3D 뷰를 처음 열 때 불러온다 (첫 화면을 가볍게) */
export function View3D() {
  const ref = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<Scene3D | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const walls3d = useApp((s) => s.ui.walls3d);

  useEffect(() => {
    let disposed = false;
    import('./Scene3D')
      .then(({ Scene3D }) => {
        if (disposed) return;
        try {
          sceneRef.current = new Scene3D(ref.current!);
          // 개발 중 콘솔에서 장면을 들여다볼 수 있게
          if (import.meta.env.DEV) (window as unknown as { __scene3d: Scene3D }).__scene3d = sceneRef.current;
          setStatus('ready');
        } catch (err) {
          console.error(err);
          setStatus('error');
        }
      })
      .catch((err) => {
        console.error(err);
        setStatus('error');
      });
    return () => {
      disposed = true;
      sceneRef.current?.dispose();
      sceneRef.current = null;
    };
  }, []);

  return (
    <div class="view3d">
      <div class="view3d-canvas" ref={ref} />
      {status === 'loading' && <div class="view3d-msg">3D 불러오는 중…</div>}
      {status === 'error' && <div class="view3d-msg">이 브라우저에서는 3D(WebGL)를 표시할 수 없습니다.</div>}
      {status === 'ready' && (
        <div class="view3d-tools">
          <div class="segmented-inline">
            {WALL_MODES.map(([m, label]) => (
              <button key={m} class={walls3d === m ? 'active' : ''} onClick={() => actions.setWalls3d(m)}>
                {label}
              </button>
            ))}
          </div>
          <button onClick={() => sceneRef.current?.topView()}>위에서</button>
          <button onClick={() => sceneRef.current?.resetView()}>시점 초기화</button>
        </div>
      )}
    </div>
  );
}
