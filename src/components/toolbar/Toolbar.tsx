// ============================================================
// 工具栏组件
// ============================================================
import { useAppStore } from '../../store';
import { importFromJsonFile, exportToJsonFile } from '../../utils/storage';
import type { AnnotationMode } from '../../types';
import { writeDataToField, getRowAllFields } from '../../utils/get_structured_data';
import type { FieldData } from '../../utils/get_structured_data';
import {
  MousePointer2,
  FileText,
  PenLine,
  CheckCircle,
  ZoomIn,
  ZoomOut,
  Maximize,
  Upload,
  Download,
  Eye,
  EyeOff,
  PanelRightClose,
  PanelRightOpen,
  ChevronLeft,
  ChevronRight,
  Save,
  Check,
} from 'lucide-react';

const modeConfig: {
  mode: AnnotationMode;
  label: string;
  icon: React.ReactNode;
  color: string;
  activeColor: string;
}[] = [
  {
    mode: 'select',
    label: '选择 (~)',
    icon: <MousePointer2 size={16} />,
    color: 'text-slate-400',
    activeColor: 'bg-slate-600 text-white',
  },
  {
    mode: 'question',
    label: '题目 (1)',
    icon: <FileText size={16} />,
    color: 'text-blue-400',
    activeColor: 'bg-blue-500/20 text-blue-400 ring-1 ring-blue-500/40',
  },
  {
    mode: 'answer',
    label: '答案 (2)',
    icon: <PenLine size={16} />,
    color: 'text-emerald-400',
    activeColor: 'bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/40',
  },
  {
    mode: 'correction',
    label: '批改 (3)',
    icon: <CheckCircle size={16} />,
    color: 'text-orange-400',
    activeColor: 'bg-orange-500/20 text-orange-400 ring-1 ring-orange-500/40',
  },
];

export default function Toolbar() {
  const {
    annotationMode,
    setAnnotationMode,
    zoom,
    setZoom,
    examData,
    loadExamData,
    showToast,
    showLabels,
    toggleShowLabels,
    showPanel,
    toggleShowPanel,
    isFeishuEnv,
    feishuCurrentIndex,
    feishuRecordIds,
    feishuTableId,
    setFeishuState,
    handleSaveFeishuData,
  } = useAppStore();

  const handleImport = async () => {
    try {
      const data = await importFromJsonFile();
      loadExamData(data);
      showToast(`成功导入 ${data.images.length} 页试卷`);
    } catch {
      showToast('导入失败，请检查文件格式');
    }
  };

  const handleExport = () => {
    exportToJsonFile(examData);
    showToast('已导出标注数据');
  };

  // 飞书相关：解析行数据
  const processFeishuRowData = (data: FieldData[]) => {
    const outputJsonField = data.find((f) => f.fieldName === '输出json');
    const inputJsonField = data.find((f) => f.fieldName === '输入json');

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
          loadExamData(JSON.parse(structuredDataStr));
        } else {
          loadExamData({ images: [], labels: [] });
        }
      } catch (error) {
        console.error('解析JSON出错', error);
        loadExamData({ images: [], labels: [] });
      }
    } else {
      loadExamData({ images: [], labels: [] });
    }
  };

  // 上一行
  const handlePrevRow = async () => {
    if (feishuCurrentIndex > 0) {
      const prevIndex = feishuCurrentIndex - 1;
      const prevId = feishuRecordIds[prevIndex];
      const res = await getRowAllFields({ tableId: feishuTableId, recordId: prevId, useCurrentSelection: false });
      if (res.success && res.data) {
        setFeishuState({ feishuCurrentIndex: prevIndex });
        processFeishuRowData(res.data);
      }
    }
  };

  // 下一行
  const handleNextRow = async () => {
    if (feishuCurrentIndex < feishuRecordIds.length - 1) {
      const nextIndex = feishuCurrentIndex + 1;
      const nextId = feishuRecordIds[nextIndex];
      const res = await getRowAllFields({ tableId: feishuTableId, recordId: nextId, useCurrentSelection: false });
      if (res.success && res.data) {
        setFeishuState({ feishuCurrentIndex: nextIndex });
        processFeishuRowData(res.data);
      }
    }
  };

  // 保存数据
  const handleSaveFeishuDataBtn = async (isComplete: boolean = false) => {
    await handleSaveFeishuData(isComplete);
    if (isComplete) {
      handleNextRow();
    }
  };

  return (
    <header className="toolbar" id="toolbar">
      {/* Logo */}
      <div className="toolbar-brand">
        <div className="toolbar-logo">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <rect x="3" y="3" width="18" height="18" rx="3" stroke="currentColor" strokeWidth="2" />
            <path d="M8 12h8M12 8v8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </div>
        <span className="toolbar-title">试卷标注</span>
      </div>

      {/* 分隔线 */}
      <div className="toolbar-divider" />

      {/* 标注模式 */}
      <div className="toolbar-group">
        <span className="toolbar-group-label">标注模式</span>
        <div className="toolbar-mode-buttons">
          {modeConfig.map(({ mode, label, icon, activeColor }) => (
            <button
              key={mode}
              id={`mode-${mode}`}
              className={`toolbar-mode-btn ${annotationMode === mode ? activeColor : 'text-slate-400 hover:text-slate-200'}`}
              onClick={() => setAnnotationMode(mode)}
              title={label}
            >
              {icon}
              <span>{label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="toolbar-divider" />

      {/* 缩放与显示控制 */}
      <div className="toolbar-group">
        <span className="toolbar-group-label">视图</span>
        <div className="toolbar-zoom-controls">
          <button
            className={`toolbar-icon-btn ${showLabels ? 'text-blue-400' : ''}`}
            onClick={toggleShowLabels}
            title={showLabels ? "隐藏标注文字" : "显示标注文字"}
          >
            {showLabels ? <Eye size={16} /> : <EyeOff size={16} />}
          </button>
          <button
            className={`toolbar-icon-btn ${showPanel ? 'text-blue-400' : ''}`}
            onClick={toggleShowPanel}
            title={showPanel ? "隐藏标注列表" : "显示标注列表"}
          >
            {showPanel ? <PanelRightClose size={16} /> : <PanelRightOpen size={16} />}
          </button>
          <div className="toolbar-divider" style={{ height: 16, margin: '0 8px' }} />
          <button
            className="toolbar-icon-btn"
            onClick={() => setZoom(zoom - 0.1)}
            title="缩小"
          >
            <ZoomOut size={16} />
          </button>
          <span className="toolbar-zoom-value">{Math.round(zoom * 100)}%</span>
          <button
            className="toolbar-icon-btn"
            onClick={() => setZoom(zoom + 0.1)}
            title="放大"
          >
            <ZoomIn size={16} />
          </button>
          <button
            className="toolbar-icon-btn"
            onClick={() => setZoom(1)}
            title="适应屏幕"
          >
            <Maximize size={16} />
          </button>
        </div>
      </div>

      {/* 右侧操作 */}
      <div className="toolbar-spacer" />

      {isFeishuEnv ? (
        <div className="toolbar-group">
          <div className="toolbar-zoom-controls">
            <button
              className="toolbar-icon-btn"
              onClick={handlePrevRow}
              disabled={feishuCurrentIndex <= 0}
              title="上一题"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="toolbar-zoom-value" style={{ width: 60, textAlign: 'center' }}>
              {feishuRecordIds.length > 0 ? `${feishuCurrentIndex + 1} / ${feishuRecordIds.length}` : '-'}
            </span>
            <button
              className="toolbar-icon-btn"
              onClick={handleNextRow}
              disabled={feishuCurrentIndex >= feishuRecordIds.length - 1}
              title="下一题"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          <div className="toolbar-divider" />

          <button className="toolbar-action-btn" onClick={() => handleSaveFeishuDataBtn(false)}>
            <Save size={15} />
            <span>保存</span>
          </button>
          <button
            className="toolbar-action-btn toolbar-action-btn--primary"
            onClick={() => handleSaveFeishuDataBtn(true)}
          >
            <Check size={15} />
            <span>完成</span>
          </button>
        </div>
      ) : (
        <div className="toolbar-group">
          <button className="toolbar-action-btn" onClick={handleImport}>
            <Upload size={15} />
            <span>导入</span>
          </button>
          <button
            className="toolbar-action-btn toolbar-action-btn--primary"
            onClick={handleExport}
            disabled={examData.images.length === 0}
          >
            <Download size={15} />
            <span>导出</span>
          </button>
        </div>
      )}
    </header>
  );
}
