// ============================================================
// 标注画布 — 水平排列所有页面
// ============================================================
import { useRef, useCallback, useEffect } from 'react';
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

/** 可排序的页面包装器 */
function SortablePageItem({ image, index, isControlPressed }: { image: ExamImage; index: number; isControlPressed: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: image.id,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : 1,
    cursor: isControlPressed ? 'grab' : 'default',
  };

  return (
    <div ref={setNodeRef} style={style} className="sortable-page-item" {...(isControlPressed ? attributes : {})} {...(isControlPressed ? listeners : {})}>
      {/* 始终渲染拖拽把手，当没有按 control 时可以通过它拖拽 */}
      {!isControlPressed && (
        <div className="drag-handle" {...attributes} {...listeners} title="拖拽排序">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
            <circle cx="3" cy="3" r="1.2" />
            <circle cx="9" cy="3" r="1.2" />
            <circle cx="3" cy="6" r="1.2" />
            <circle cx="9" cy="6" r="1.2" />
            <circle cx="3" cy="9" r="1.2" />
            <circle cx="9" cy="9" r="1.2" />
          </svg>
        </div>
      )}
      {/* 当按住 control 时，为了视觉提示，直接显示把手图标但不再需要单独绑事件 */}
      {isControlPressed && (
        <div className="drag-handle" title="按住 Control 全局拖拽" style={{ opacity: 1 }}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
            <circle cx="3" cy="3" r="1.2" />
            <circle cx="9" cy="3" r="1.2" />
            <circle cx="3" cy="6" r="1.2" />
            <circle cx="9" cy="6" r="1.2" />
            <circle cx="3" cy="9" r="1.2" />
            <circle cx="9" cy="9" r="1.2" />
          </svg>
        </div>
      )}
      <PageImage image={image} index={index} />
    </div>
  );
}

export default function AnnotationCanvas() {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const { examData, zoom, reorderImages, isDrawing, finishDrawing, cancelDrawing, loadExamData, showToast, setActiveHotkey, setAnnotationMode, setControlPressed, isControlPressed } = useAppStore();

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

  // 全局事件监听：处理鼠标松开、取消绘制及快捷键
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      const state = useAppStore.getState();
      // 如果没有按住快捷键，则鼠标松开结束绘制
      if (state.isDrawing && !state.activeHotkey) {
        state.finishDrawing();
        state.setAnnotationMode('select');
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // 忽略输入框内的按键
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
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
      }
      if (e.key === '1') {
        setActiveHotkey('1');
        setAnnotationMode('question');
      } else if (e.key === '2') {
        setActiveHotkey('2');
        setAnnotationMode('answer');
      } else if (e.key === '3') {
        setActiveHotkey('3');
        setAnnotationMode('correction');
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
      
      if (e.key === 'Control' || e.key === 'Meta') {
        setControlPressed(false);
      }

      if (e.key === '1' || e.key === '2' || e.key === '3') {
        const state = useAppStore.getState();
        // 松开快捷键时结束绘制
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
  }, [isDrawing, finishDrawing, cancelDrawing, setActiveHotkey, setControlPressed]);

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
    <div className="canvas-area" id="canvas-area">
      <div
        className="canvas-scroll-container"
        ref={scrollContainerRef}
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
                transformOrigin: 'top center',
                transition: 'transform 0.2s ease-out'
              }}
            >
              {examData.images.map((image, index) => (
                <SortablePageItem key={image.id} image={image} index={index} isControlPressed={isControlPressed} />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </div>
    </div>
  );
}
