// ============================================================
// 工具栏组件
// ============================================================
import { useAppStore } from '../../store';
import { importFromJsonFile, exportToJsonFile } from '../../utils/storage';
import type { AnnotationMode } from '../../types';
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
  const { annotationMode, setAnnotationMode, zoom, setZoom, examData, loadExamData, showToast } =
    useAppStore();

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

      {/* 缩放 */}
      <div className="toolbar-group">
        <span className="toolbar-group-label">缩放</span>
        <div className="toolbar-zoom-controls">
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
    </header>
  );
}
