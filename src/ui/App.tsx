import { useApp } from '../store';
import { Plan2D } from '../view2d/Plan2D';
import { Palette } from './Palette';
import { PropertiesPanel } from './PropertiesPanel';
import { StructurePanel, StructureTools } from './StructurePanel';
import { Toolbar } from './Toolbar';

export function App() {
  const view = useApp((s) => s.ui.view);
  const structure = useApp((s) => s.ui.mode === 'structure');
  return (
    <div class="app">
      <Toolbar />
      <div class="workspace">
        {structure ? <StructureTools /> : <Palette />}
        <main class={`views views-${view}`}>
          {view !== '3d' && <Plan2D />}
          {view !== '2d' && (
            <div class="view3d-placeholder">
              <p>3D 뷰는 (e) 단계에서 추가됩니다.</p>
            </div>
          )}
        </main>
        {structure ? <StructurePanel /> : <PropertiesPanel />}
      </div>
    </div>
  );
}
