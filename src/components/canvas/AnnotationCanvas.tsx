// ============================================================
// 标注画布 — 水平排列所有页面
// ============================================================
import { useRef, useCallback, useEffect, useState } from 'react';
import { useAppStore } from '../../store';
import PageImage from './PageImage';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  horizontalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { ExamImage } from '../../types';
import { FileUp } from 'lucide-react';
import { importFromJsonFile } from '../../utils/storage';

import { getRowAllFields } from '../../utils/get_structured_data';
import type { FieldData } from '../../utils/get_structured_data';

/** 可排序的页面包装器 */
function SortablePageItem({ image, index }: { image: ExamImage; index: number }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: image.id,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="sortable-page-item" {...attributes} {...listeners}>
      <PageImage image={image} index={index} />
    </div>
  );
}

export default function AnnotationCanvas() {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [activeKey, setLocalActiveKey] = useState<string | null>(null); // 用于提示组件的视觉高亮
  const {
    examData,
    zoom,
    reorderImages,
    isDrawing,
    finishDrawing,
    cancelDrawing,
    loadExamData,
    showToast,
    setActiveHotkey,
    setAnnotationMode,
    setControlPressed,
    undo,
    isFeishuEnv,
    handleSaveFeishuData,
    feishuCurrentIndex,
    feishuRecordIds,
    feishuTableId,
    setFeishuState,
  } = useAppStore();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (over && active.id !== over.id) {
        const fromIndex = examData.images.findIndex((img) => img.id === active.id);
        const toIndex = examData.images.findIndex((img) => img.id === over.id);
        if (fromIndex !== -1 && toIndex !== -1) {
          reorderImages(fromIndex, toIndex);
        }
      }
    },
    [examData.images, reorderImages]
  );

  // 鼠标拖拽平移画布
  const [isPanning, setIsPanning] = useState(false);
  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    // 中键点击，或者点击在空白背景上时，开始平移
    const target = e.target as HTMLElement;
    if (e.button === 1 || target.classList.contains('canvas-scroll-container') || target.classList.contains('canvas-pages-row')) {
      setIsPanning(true);
      e.currentTarget.setPointerCapture(e.pointerId);
    }
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (isPanning && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop -= e.movementY;
      scrollContainerRef.current.scrollLeft -= e.movementX;
    }
  }, [isPanning]);

  const handlePointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (isPanning) {
      setIsPanning(false);
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  }, [isPanning]);

  // 飞书相关：解析行数据
  const processFeishuRowData = useCallback((data: FieldData[]) => {
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
  }, [loadExamData]);

  // 下一行
  const handleNextRow = useCallback(async () => {
    if (feishuCurrentIndex < feishuRecordIds.length - 1) {
      const nextIndex = feishuCurrentIndex + 1;
      const nextId = feishuRecordIds[nextIndex];
      const res = await getRowAllFields({ tableId: feishuTableId, recordId: nextId, useCurrentSelection: false });
      if (res.success && res.data) {
        setFeishuState({ feishuCurrentIndex: nextIndex });
        processFeishuRowData(res.data);
      }
    }
  }, [feishuCurrentIndex, feishuRecordIds, feishuTableId, setFeishuState, processFeishuRowData]);

  // 原生滚轮缩放监听
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const state = useAppStore.getState();
        // 根据滚轮方向调整缩放，步长 0.05
        const newZoom = Math.max(0.1, Math.min(5, state.zoom - e.deltaY * 0.005));
        state.setZoom(newZoom);
      }
    };

    // { passive: false } 允许 e.preventDefault() 阻止默认的网页缩放
    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      container.removeEventListener('wheel', handleWheel);
    };
  }, []);

  // 全局事件监听：处理鼠标松开、取消绘制及快捷键
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      // 移除原有的自动完成绘制逻辑，现在由用户手动回车或双击完成
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // 忽略输入框内的按键
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      const keyStr = e.key.toLowerCase();
      if (e.code === 'Space') {
        setLocalActiveKey('space');
      } else if (keyStr === 'control' || keyStr === 'meta') {
        setLocalActiveKey('ctrl');
      } else {
        setLocalActiveKey(keyStr);
      }
      
      if (keyStr === 's' && isFeishuEnv) {
        handleSaveFeishuData(true).then(() => {
          handleNextRow();
        });
        return;
      }
      if (e.key === 'Control' || e.key === 'Meta') {
        setControlPressed(true);
      }

      if (e.code === 'Space') {
        e.preventDefault(); // 阻止页面滚动
        const state = useAppStore.getState();
        if (!state.isDrawing) {
          state.prepareNewQuestion();
        }
        return;
      }

      if (e.key === 'Escape') {
        cancelDrawing();
        setAnnotationMode('select');
      }
      if (e.key === 'Enter') {
        const state = useAppStore.getState();
        if (state.isDrawing) {
          state.finishDrawing();
          state.setAnnotationMode('select');
        }
      }
      if (e.key === 'r' || e.key === 'R') {
        undo();
        return;
      }
      if (e.key === 'e' || e.key === 'E') {
        const state = useAppStore.getState();
        if (state.hoveredImageId) {
          state.rotateImage(state.hoveredImageId);
        }
        return;
      }
      const state = useAppStore.getState();
      if (e.key === '1') {
        if (state.activeHotkey !== '1') {
          setActiveHotkey('1');
          setAnnotationMode('question');
          if (state.hoveredImageId) {
            state.startDrawing(state.hoveredImageId);
          }
        }
      } else if (e.key === '2') {
        if (state.activeHotkey !== '2') {
          setActiveHotkey('2');
          setAnnotationMode('answer');
          if (state.hoveredImageId) {
            state.startDrawing(state.hoveredImageId);
          }
        }
      } else if (e.key === '3') {
        if (state.activeHotkey !== '3') {
          setActiveHotkey('3');
          setAnnotationMode('correction');
          if (state.hoveredImageId) {
            state.startDrawing(state.hoveredImageId);
          }
        }
      } else if (e.key === '`' || e.key === '~') {
        setActiveHotkey(null);
        setAnnotationMode('select');
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      // 忽略输入框内的按键
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      
      const keyStr = e.key.toLowerCase();
      if (e.code === 'Space') {
        setLocalActiveKey((prev) => prev === 'space' ? null : prev);
      } else if (keyStr === 'control' || keyStr === 'meta') {
        setLocalActiveKey((prev) => prev === 'ctrl' ? null : prev);
      } else {
        setLocalActiveKey((prev) => prev === keyStr ? null : prev);
      }

      if (e.key === 'Control' || e.key === 'Meta') {
        setControlPressed(false);
      }

      if (e.key === '1' || e.key === '2' || e.key === '3') {
        const state = useAppStore.getState();
        // 松开 1/2/3 时，自动完成绘制并闭合多边形
        if (state.isDrawing) {
          state.finishDrawing();
        }
        state.setActiveHotkey(null);
        state.setAnnotationMode('select');
      }
    };

    window.addEventListener('mouseup', handleGlobalMouseUp);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('mouseup', handleGlobalMouseUp);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [
    isDrawing,
    finishDrawing,
    cancelDrawing,
    setActiveHotkey,
    setControlPressed,
    undo,
    isFeishuEnv,
    handleSaveFeishuData,
    handleNextRow,
  ]);

  const handleImport = async () => {
    try {
      const data = await importFromJsonFile();
      loadExamData(data);
      showToast(`成功导入 ${data.images.length} 页试卷`);
    } catch {
      showToast('导入失败，请检查文件格式');
    }
  };

  if (examData.images.length === 0) {
    return (
      <div className="canvas-empty">
        <div className="canvas-empty-content">
          <div className="canvas-empty-icon">
            <FileUp size={48} strokeWidth={1.2} />
          </div>
          <h2>导入试卷开始标注</h2>
          <p>支持 JSON 格式文件，包含试卷图片 URL</p>
          <button className="canvas-import-btn" onClick={handleImport}>
            <FileUp size={18} />
            选择文件导入
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="canvas-area" id="canvas-area" style={{ position: 'relative' }}>
      {/* 快捷键提示组件 */}
      <div className="hotkey-hint-overlay">
        <div className={`hotkey-item ${activeKey === 'space' ? 'active' : ''}`}><kbd>Space</kbd> <span>新题</span></div>
        <div className={`hotkey-item ${activeKey === '1' ? 'active' : ''}`}><kbd>1</kbd> <span className="text-blue-400">题目</span></div>
        <div className={`hotkey-item ${activeKey === '2' ? 'active' : ''}`}><kbd>2</kbd> <span className="text-emerald-400">答案</span></div>
        <div className={`hotkey-item ${activeKey === '3' ? 'active' : ''}`}><kbd>3</kbd> <span className="text-orange-400">批改</span></div>
        <div className={`hotkey-item ${activeKey === 'e' ? 'active' : ''}`}><kbd>E</kbd> <span>旋转</span></div>
        <div className={`hotkey-item ${activeKey === 'r' ? 'active' : ''}`}><kbd>R</kbd> <span>撤销</span></div>
        {isFeishuEnv && (
          <div className={`hotkey-item ${activeKey === 's' ? 'active' : ''}`}><kbd>S</kbd> <span>保存并下一题</span></div>
        )}
      </div>

      <div
        className={`canvas-scroll-container ${isPanning ? 'panning' : ''}`}
        ref={scrollContainerRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext
            items={examData.images.map((img) => img.id)}
            strategy={horizontalListSortingStrategy}
          >
            <div
              className="canvas-pages-row"
              style={{
                transform: `scale(${zoom})`,
                transformOrigin: 'center center',
                transition: 'transform 0.15s ease-out'
              }}
            >
              {examData.images.map((image, index) => (
                <SortablePageItem key={image.id} image={image} index={index} />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </div>
    </div>
  );
}
