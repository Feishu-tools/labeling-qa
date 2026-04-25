// ============================================================
// 主应用组件
// ============================================================
import { useEffect } from 'react';
import { useAppStore } from './store';
import Toolbar from './components/toolbar/Toolbar';
import AnnotationCanvas from './components/canvas/AnnotationCanvas';
import AnnotationPanel from './components/panel/AnnotationPanel';

function App() {
  const { initFromStorage, toastMessage, clearToast, examData } = useAppStore();

  useEffect(() => {
    initFromStorage();
  }, [initFromStorage]);

  return (
    <div className="app-container">
      <Toolbar />

      <main className="app-main">
        <AnnotationCanvas />
        {examData.images.length > 0 && <AnnotationPanel />}
      </main>

      {/* Toast 消息 */}
      {toastMessage && (
        <div className="toast" onClick={clearToast}>
          {toastMessage}
        </div>
      )}
    </div>
  );
}

export default App;
