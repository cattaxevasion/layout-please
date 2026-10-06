import { useEffect } from 'preact/hooks';
import { actions, useApp } from '../store';
import { selectSelectedFurniture } from '../store/selectors';
import { Plan2D } from '../view2d/Plan2D';
import { View3D } from '../view3d/View3D';
import { ShareBanner, Toast } from './Notices';
import { Palette } from './Palette';
import { PropertiesPanel } from './PropertiesPanel';
import { StructurePanel, StructureTools } from './StructurePanel';
import { Toolbar } from './Toolbar';
import { MOBILE_QUERY, useMedia } from './useMedia';

export function App() {
  const view = useApp((s) => s.ui.view);
  const mode = useApp((s) => s.ui.mode);
  const mobile = useMedia(MOBILE_QUERY);

  // 구조 편집은 PC 전용
  useEffect(() => {
    if (mobile && mode === 'structure') actions.setMode('arrange');
  }, [mobile, mode]);

  // 좁은 화면에서는 나란히 보기 대신 2D/3D 탭
  const shown = mobile && view === 'split' ? '2d' : view;
  const structure = mode === 'structure' && !mobile;

  return (
    <div class={`app${mobile ? ' mobile' : ''}`}>
      <ShareBanner />
      <Toolbar mobile={mobile} />
      <div class="workspace">
        {!mobile && (structure ? <StructureTools /> : <Palette />)}
        <main class={`views views-${shown}`}>
          {shown !== '3d' && <Plan2D />}
          {shown !== '2d' && <View3D />}
        </main>
        {!mobile && (structure ? <StructurePanel /> : <PropertiesPanel />)}
      </div>
      {mobile && <MobileSelectionBar />}
      <Toast />
    </div>
  );
}

/** 모바일에서 가구를 선택하면 아래에 뜨는 간단한 조작 막대 */
function MobileSelectionBar() {
  const f = useApp(selectSelectedFurniture);
  const readOnly = useApp((s) => s.ui.readOnly);
  if (!f) return null;
  return (
    <div class="mobile-bar">
      <span class="mobile-bar-name">
        {f.name} <span class="muted">{Math.round(f.width)}×{Math.round(f.depth)}</span>
      </span>
      {!readOnly && (
        <>
          <button onClick={() => actions.rotateFurniture(f.id, -90)} aria-label="반시계 90도">
            ⟲
          </button>
          <button onClick={() => actions.rotateFurniture(f.id, 90)} aria-label="시계 90도">
            ⟳
          </button>
          <button onClick={() => actions.duplicateFurniture(f.id)}>복제</button>
          <button class="danger" onClick={() => actions.deleteFurniture(f.id)}>
            삭제
          </button>
        </>
      )}
      <button onClick={() => actions.select(null)} aria-label="선택 해제">
        ✕
      </button>
    </div>
  );
}
