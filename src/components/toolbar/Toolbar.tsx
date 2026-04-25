// ============================================================
// 工具栏组件
// ============================================================
import { useState } from 'react';
import { useAppStore } from '../../store';
import { importFromJsonFile, exportToJsonFile } from '../../utils/storage';
import type { AnnotationMode } from '../../types';
import { parseFeishuUrl, fetchFeishuRecords } from '../../utils/feishu_open_api';
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
  Link,
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
    handleSaveFeishuData,
    handleNextFeishuRow,
    handlePrevFeishuRow,
    feishuAppId,
    feishuAppSecret,
    setFeishuOpenApiState,
  } = useAppStore();

  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);

  const handleConnectOpenApi = async () => {
    if (!url) {
      showToast('请输入飞书多维表格链接');
      return;
    }

    setLoading(true);
    try {
      const { appToken, tableId } = parseFeishuUrl(url);
      
      showToast('正在获取数据...');
      const records = await fetchFeishuRecords({ appId: feishuAppId, appSecret: feishuAppSecret, appToken, tableId });
      
      if (!records || records.length === 0) {
        showToast('获取到 0 条数据，请检查链接或权限');
        setLoading(false);
        return;
      }

      const recordIds = records.map(r => r.record_id);
      
      setFeishuOpenApiState({
        isOpenApiMode: true,
        feishuAppToken: appToken,
        feishuRecords: records,
      });

      // 复用原有的环境状态逻辑以适配上下题和保存功能
      useAppStore.getState().setFeishuState({
        isFeishuEnv: true,
        feishuTableId: tableId,
        feishuRecordIds: recordIds,
        feishuCurrentIndex: 0,
      });

      // 初始化第一条数据
      const firstRecord = records[0];
      const outputJsonStr = firstRecord.fields['输出json'];
      const inputJsonStr = firstRecord.fields['输入json'];
      
      let dataToParse = outputJsonStr || inputJsonStr;
      if (dataToParse) {
        try {
          const parsed = JSON.parse(dataToParse);
          loadExamData(parsed);
        } catch (e) {
          loadExamData({ images: [], labels: [] });
        }
      } else {
        loadExamData({ images: [], labels: [] });
      }

      showToast(`连接成功，共获取 ${records.length} 条记录`);
    } catch (e: any) {
      console.error(e);
      showToast(e.message || '连接失败，请检查配置');
    } finally {
      setLoading(false);
    }
  };

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
              onClick={handlePrevFeishuRow}
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
              onClick={handleNextFeishuRow}
              disabled={feishuCurrentIndex >= feishuRecordIds.length - 1}
              title="下一题"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          <div className="toolbar-divider" />

          <button className="toolbar-action-btn" onClick={() => handleSaveFeishuData(false)}>
            <Save size={15} />
            <span>保存</span>
          </button>
          <button
            className="toolbar-action-btn toolbar-action-btn--primary"
            onClick={() => handleSaveFeishuData(true)}
          >
            <Check size={15} />
            <span>完成</span>
          </button>
        </div>
      ) : (
        <div className="toolbar-group">
          <div className="flex items-center bg-slate-800/50 border border-slate-700/60 rounded-md overflow-hidden h-8 mr-2 transition-all focus-within:border-blue-500/50 focus-within:bg-slate-800">
            <div className="pl-2.5 text-slate-400">
              <Link size={14} />
            </div>
            <input
              type="text"
              placeholder="输入飞书多维表格链接进行直连..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="bg-transparent text-[13px] text-slate-200 px-2 w-[240px] focus:outline-none placeholder:text-slate-500"
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleConnectOpenApi();
              }}
            />
            <button
              className="px-3.5 h-full bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 text-[13px] font-medium transition-colors disabled:opacity-50 border-l border-slate-700/60"
              onClick={handleConnectOpenApi}
              disabled={loading || !url}
            >
              {loading ? '连接中...' : '连接'}
            </button>
          </div>
          
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
