// ============================================================
// 主应用组件
// ============================================================
import { useEffect } from 'react';
import { useAppStore } from './store';
import Toolbar from './components/toolbar/Toolbar';
import AnnotationCanvas from './components/canvas/AnnotationCanvas';
import AnnotationPanel from './components/panel/AnnotationPanel';
import { watchRowAllFields, getTableRecordIds } from './utils/get_structured_data';
import type { FieldData, RowData } from './utils/get_structured_data';
import './utils/feishu_open_api';

function App() {
  const { initFromStorage, toastMessage, clearToast, showPanel, loadExamData, setFeishuState, isFeishuEnv } = useAppStore();

  useEffect(() => {
    // 飞书小组件通常运行在iframe中，尝试初始化监听
    let unwatch: (() => void) | undefined;
    
    try {
      unwatch = watchRowAllFields(async (rowData: RowData) => {
        if (!rowData.success) {
          if (!isFeishuEnv) initFromStorage();
          return;
        }

        const state = useAppStore.getState();

        if (rowData.tableId && rowData.tableId !== state.feishuTableId) {
          setFeishuState({ isFeishuEnv: true, feishuTableId: rowData.tableId });
          const recordListData = await getTableRecordIds({ tableId: rowData.tableId, useCurrentSelection: false });
          if (recordListData.success && recordListData.recordIds) {
            setFeishuState({ feishuRecordIds: recordListData.recordIds });
          }
        } else {
          setFeishuState({ isFeishuEnv: true });
        }

        const { feishuRecordIds } = useAppStore.getState();
        if (rowData.recordId && feishuRecordIds.length > 0) {
          const index = feishuRecordIds.indexOf(rowData.recordId);
          setFeishuState({ feishuCurrentIndex: index });
        }

        if (rowData.data && rowData.data.length > 0) {
          const outputJsonField = rowData.data.find((f: FieldData) => f.fieldName === '输出json');
          const inputJsonField = rowData.data.find((f: FieldData) => f.fieldName === '输入json');

          let jsonDataToParse = null;
          if (outputJsonField && outputJsonField.value) {
            jsonDataToParse = outputJsonField.value;
          } else if (inputJsonField && inputJsonField.value) {
            jsonDataToParse = inputJsonField.value;
          }

          if (jsonDataToParse) {
            try {
              let structuredDataStr = '';
              for (const item of jsonDataToParse) {
                if (item.type === 'text' || item.type === 'url') {
                  structuredDataStr += item.text || '';
                }
              }
              if (structuredDataStr.trim()) {
                const parsedData = JSON.parse(structuredDataStr);
                loadExamData(parsedData);
              } else {
                loadExamData({ images: [], labels: [] });
              }
            } catch (error) {
              console.error('解析JSON时出错:', error);
              loadExamData({ images: [], labels: [] });
            }
          } else {
            loadExamData({ images: [], labels: [] });
          }
        }
      });
    } catch (e) {
      console.warn("Feishu Base SDK not available", e);
      initFromStorage();
    }

    return () => {
      if (unwatch) unwatch();
    };
  }, []);

  return (
    <div className="app-container">
      <Toolbar />

      <main className="app-main">
        <AnnotationCanvas />
        {showPanel && <AnnotationPanel />}
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
