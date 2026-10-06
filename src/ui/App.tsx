import { useApp } from '../store';
import { Plan2D } from '../view2d/Plan2D';
import { View3D } from '../view3d/View3D';
import { Palette } from './Palette';
import { ShareBanner, Toast } from './Notices';
import { PropertiesPanel } from './PropertiesPanel';
import { StructurePanel, StructureTools } from './StructurePanel';
import { Toolbar } from './Toolbar';

export function App() {
  const view = useApp((s) => s.ui.view);
  const structure = useApp((s) => s.ui.mode === 'structure');
  return (
    <div class="app">
      <ShareBanner />
      <Toolbar />
      <div class="workspace">
        {structure ? <StructureTools /> : <Palette />}
        <main class={`views views-${view}`}>
          {view !== '3d' && <Plan2D />}
          {view !== '2d' && <View3D />}
        </main>
        {structure ? <StructurePanel /> : <PropertiesPanel />}
      </div>
      <Toast />
    </div>
  );
}
