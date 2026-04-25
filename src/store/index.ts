// ============================================================
// 全局状态管理 — Zustand Store
// ============================================================
import { create } from 'zustand';
import type {
  ExamData,
  ExamImage,
  AnnotationMode,
  Point,
  QuestionAnnotation,
  AnnotationLocation,
} from '../types';
import { saveToLocalStorage, loadFromLocalStorage, generateId } from '../utils/storage';
import { writeDataToField, getRowAllFields } from '../utils/get_structured_data';
import type { FieldData } from '../utils/get_structured_data';

interface AppState {
  // ---- 数据 ----
  examData: ExamData;
  hasUnsavedChanges: boolean;
  undoHistory: ExamData[]; // 用于撤销的历史记录栈

  // ---- UI 状态 ----
  annotationMode: AnnotationMode;
  selectedQuestionId: string | null;
  selectedAnnotationId: string | null; // answer/correction id
  selectedAnnotationType: 'question' | 'answer' | 'correction' | null;
  hoveredAnnotationId: string | null;
  hoveredImageId: string | null; // 记录当前鼠标悬停的图片 ID
  zoom: number;
  toastMessage: string | null;

  // ---- 绘制状态 ----
  isDrawing: boolean;
  activeHotkey: '1' | '2' | '3' | '`' | null; // 记录当前按下的热键
  isControlPressed: boolean; // 是否按下了 Control 键
  showLabels: boolean; // 是否显示画布上的标签文字
  showPanel: boolean; // 是否显示右侧标注列表面板
  currentPoints: Point[];
  hoverPoint: Point | null; // 记录当前鼠标悬停的坐标点
  drawingImageId: string | null;

  // ---- 飞书状态 ----
  isFeishuEnv: boolean;
  feishuRecordIds: string[];
  feishuCurrentIndex: number;
  feishuTableId: string;

  // ---- Actions ----
  loadExamData: (data: ExamData) => void;
  initFromStorage: () => boolean;
  setFeishuState: (state: Partial<{ isFeishuEnv: boolean, feishuRecordIds: string[], feishuCurrentIndex: number, feishuTableId: string }>) => void;

  setAnnotationMode: (mode: AnnotationMode) => void;
  setActiveHotkey: (key: '1' | '2' | '3' | '`' | null) => void;
  setControlPressed: (pressed: boolean) => void;
  toggleShowLabels: () => void;
  toggleShowPanel: () => void;
  selectQuestion: (id: string | null) => void;
  selectAnnotation: (id: string | null, type: 'question' | 'answer' | 'correction' | null) => void;
  setHoveredAnnotation: (id: string | null) => void;
  setHoveredImage: (id: string | null) => void;
  setZoom: (zoom: number) => void;
  showToast: (msg: string) => void;
  clearToast: () => void;

  // 绘制
  startDrawing: (imageId: string, point?: Point) => void;
  addDrawingPoint: (point: Point) => void;
  updateHoverPoint: (point: Point) => void; // 增加更新悬停点的动作
  finishDrawing: () => void;
  cancelDrawing: () => void;
  prepareNewQuestion: () => void;

  // 页面操作
  reorderImages: (fromIndex: number, toIndex: number) => void;
  rotateImage: (imageId: string) => void;

  // 标注操作
  deleteQuestion: (questionId: string) => void;
  deleteAnswer: (questionId: string, answerId: string) => void;
  deleteCorrection: (questionId: string, correctionId: string) => void;
  updateQuestionText: (questionId: string, text: string) => void;
  undo: () => void;

  // 自动保存
  autoSave: () => void;
  
  // 飞书保存
  handleSaveFeishuData: (isComplete?: boolean) => Promise<void>;
}

export const useAppStore = create<AppState>((set, get) => ({
  // ---- 初始数据 ----
  examData: { images: [], labels: [] },
  hasUnsavedChanges: false,
  undoHistory: [],

  annotationMode: 'select',
  selectedQuestionId: null,
  selectedAnnotationId: null,
  selectedAnnotationType: null,
  hoveredAnnotationId: null,
  hoveredImageId: null,
  zoom: 1,
  toastMessage: null,

  isDrawing: false,
  activeHotkey: null,
  isControlPressed: false,
  showLabels: false, // 默认隐藏
  showPanel: false, // 默认隐藏右侧面板
  currentPoints: [],
  hoverPoint: null,
  drawingImageId: null,

  isFeishuEnv: false,
  feishuRecordIds: [],
  feishuCurrentIndex: -1,
  feishuTableId: '',

  // ---- Actions ----

  loadExamData: (data) => {
    set({ examData: data, hasUnsavedChanges: false });
    saveToLocalStorage(data);
  },

  initFromStorage: () => {
    const data = loadFromLocalStorage();
    if (data) {
      set({ examData: data });
      return true;
    }
    return false;
  },

  setFeishuState: (state) => set(state),

  setAnnotationMode: (mode) => set({ annotationMode: mode }),
  
  setActiveHotkey: (key) => set({ activeHotkey: key }),

  setControlPressed: (pressed) => set({ isControlPressed: pressed }),

  toggleShowLabels: () => set((state) => ({ showLabels: !state.showLabels })),

  toggleShowPanel: () => set((state) => ({ showPanel: !state.showPanel })),

  selectQuestion: (id) =>
    set({
      selectedQuestionId: id,
      selectedAnnotationId: id,
      selectedAnnotationType: id ? 'question' : null,
    }),

  selectAnnotation: (id, type) =>
    set({
      selectedAnnotationId: id,
      selectedAnnotationType: type,
      // 如果选中的是答案或批改，自动选中所属题目
      ...(type === 'answer' || type === 'correction'
        ? (() => {
            const state = get();
            const question = state.examData.labels.find((q) =>
              type === 'answer'
                ? q.answer.some((a) => a.id === id)
                : q.correct.some((c) => c.id === id)
            );
            return question ? { selectedQuestionId: question.question_id } : {};
          })()
        : type === 'question'
          ? { selectedQuestionId: id }
          : {}),
    }),

  setHoveredAnnotation: (id) => set({ hoveredAnnotationId: id }),

  setHoveredImage: (id) => set({ hoveredImageId: id }),

  setZoom: (zoom) => set({ zoom: Math.max(0.2, Math.min(3, zoom)) }),

  showToast: (msg) => {
    set({ toastMessage: msg });
    setTimeout(() => {
      set({ toastMessage: null });
    }, 3000);
  },

  clearToast: () => set({ toastMessage: null }),

  // ---- 绘制 ----

  startDrawing: (imageId, point) => {
    const { annotationMode, selectedQuestionId } = get();

    // 答案/批改模式下，必须先选中题目
    if ((annotationMode === 'answer' || annotationMode === 'correction') && !selectedQuestionId) {
      get().showToast('请先在右侧面板选择一道题目');
      return;
    }

    if (annotationMode === 'select') return;

    set({
      isDrawing: true,
      currentPoints: point ? [point] : [],
      hoverPoint: point || null,
      drawingImageId: imageId,
    });
  },

  addDrawingPoint: (point) => {
    const { isDrawing, currentPoints } = get();
    if (!isDrawing) return;

    // 点击记录新点（多边形顶点）
    // 限制距离太近的点不被添加（防止双击或者手抖导致重复点）
    const lastPoint = currentPoints[currentPoints.length - 1];
    if (lastPoint) {
      const dist = Math.hypot(point[0] - lastPoint[0], point[1] - lastPoint[1]);
      if (dist < 5) return;
    }
    
    set({ currentPoints: [...currentPoints, point], hoverPoint: point });
  },

  updateHoverPoint: (point) => {
    const { isDrawing } = get();
    if (!isDrawing) return;
    set({ hoverPoint: point });
  },

  finishDrawing: () => {
    const { isDrawing, currentPoints, drawingImageId, annotationMode, examData, selectedQuestionId } = get();
    if (!isDrawing || !drawingImageId) {
      set({ isDrawing: false, currentPoints: [], hoverPoint: null, drawingImageId: null, annotationMode: 'select' });
      return;
    }

    // 多边形至少需要 3 个点
    if (currentPoints.length < 3) {
      // 这里去掉 Toast，因为用户可能只是按了一下热键没画点就松开了
      set({ isDrawing: false, currentPoints: [], hoverPoint: null, drawingImageId: null, annotationMode: 'select' });
      return;
    }

    const location: AnnotationLocation = {
      image_id: drawingImageId,
      polygon: currentPoints, // 点击多边形不再需要简化算法，直接使用用户的点击点
    };

    const newLabels = [...examData.labels];
    // 记录历史状态以便撤销
    const nextUndoHistory = [...get().undoHistory, examData].slice(-20); // 最多保留 20 步撤销

    if (annotationMode === 'question') {
      if (selectedQuestionId) {
        // 追加到当前题目（支持一个题目跨多页/多段）
        const qIndex = newLabels.findIndex((q) => q.question_id === selectedQuestionId);
        if (qIndex !== -1) {
          newLabels[qIndex] = {
            ...newLabels[qIndex],
            location: [...newLabels[qIndex].location, location],
          };
          const newData = { ...examData, labels: newLabels };
          set({
            examData: newData,
            undoHistory: nextUndoHistory,
            isDrawing: false,
            currentPoints: [],
            hoverPoint: null,
            drawingImageId: null,
            annotationMode: 'select',
            selectedAnnotationId: selectedQuestionId,
            selectedAnnotationType: 'question',
            hasUnsavedChanges: true,
          });
          saveToLocalStorage(newData);
        }
      } else {
        // 创建新题目
        const questionId = generateId('q');
        const newQuestion: QuestionAnnotation = {
          question_id: questionId,
          question_text: '',
          location: [location],
          answer: [],
          correct: [],
        };
        newLabels.push(newQuestion);
        const newData = { ...examData, labels: newLabels };
        set({
          examData: newData,
          undoHistory: nextUndoHistory,
          isDrawing: false,
          currentPoints: [],
          hoverPoint: null,
          drawingImageId: null,
          annotationMode: 'select',
          selectedQuestionId: questionId,
          selectedAnnotationId: questionId,
          selectedAnnotationType: 'question',
          hasUnsavedChanges: true,
        });
        saveToLocalStorage(newData);
      }
    } else if (annotationMode === 'answer' && selectedQuestionId) {
      const qIndex = newLabels.findIndex((q) => q.question_id === selectedQuestionId);
      if (qIndex !== -1) {
        const answerId = generateId('a');
        newLabels[qIndex] = {
          ...newLabels[qIndex],
          answer: [
            ...newLabels[qIndex].answer,
            { id: answerId, answer_text: '', location: [location] },
          ],
        };
        const newData = { ...examData, labels: newLabels };
        set({
          examData: newData,
          undoHistory: nextUndoHistory,
          isDrawing: false,
          currentPoints: [],
          hoverPoint: null,
          drawingImageId: null,
          annotationMode: 'select',
          selectedAnnotationId: answerId,
          selectedAnnotationType: 'answer',
          hasUnsavedChanges: true,
        });
        saveToLocalStorage(newData);
      }
    } else if (annotationMode === 'correction' && selectedQuestionId) {
      const qIndex = newLabels.findIndex((q) => q.question_id === selectedQuestionId);
      if (qIndex !== -1) {
        const correctId = generateId('c');
        newLabels[qIndex] = {
          ...newLabels[qIndex],
          correct: [
            ...newLabels[qIndex].correct,
            { id: correctId, correct_text: '', location: [location] },
          ],
        };
        const newData = { ...examData, labels: newLabels };
        set({
          examData: newData,
          undoHistory: nextUndoHistory,
          isDrawing: false,
          currentPoints: [],
          hoverPoint: null,
          drawingImageId: null,
          annotationMode: 'select',
          selectedAnnotationId: correctId,
          selectedAnnotationType: 'correction',
          hasUnsavedChanges: true,
        });
        saveToLocalStorage(newData);
      }
    } else {
      set({ isDrawing: false, currentPoints: [], hoverPoint: null, drawingImageId: null, annotationMode: 'select' });
    }
  },

  cancelDrawing: () => {
    set({ isDrawing: false, currentPoints: [], hoverPoint: null, drawingImageId: null, annotationMode: 'select' });
  },

  prepareNewQuestion: () => {
    set({
      selectedQuestionId: null,
      selectedAnnotationId: null,
      selectedAnnotationType: null,
    });
    get().showToast('已准备创建新题，请按住1并在试卷上滑动绘制');
  },

  // ---- 页面操作 ----

  reorderImages: (fromIndex, toIndex) => {
    const { examData } = get();
    const newImages = [...examData.images];
    const [moved] = newImages.splice(fromIndex, 1);
    newImages.splice(toIndex, 0, moved);
    const newData = { ...examData, images: newImages };
    set({ examData: newData, hasUnsavedChanges: true });
    saveToLocalStorage(newData);
  },

  rotateImage: (imageId) => {
    const { examData } = get();
    const newImages = examData.images.map((img: ExamImage) =>
      img.id === imageId ? { ...img, rotation: (img.rotation + 90) % 360 } : img
    );
    const newData = { ...examData, images: newImages };
    set({ examData: newData, hasUnsavedChanges: true });
    saveToLocalStorage(newData);
  },

  // ---- 标注操作 ----

  deleteQuestion: (questionId) => {
    const { examData, selectedQuestionId } = get();
    const newLabels = examData.labels.filter((q) => q.question_id !== questionId);
    const newData = { ...examData, labels: newLabels };
    set({
      examData: newData,
      hasUnsavedChanges: true,
      ...(selectedQuestionId === questionId
        ? { selectedQuestionId: null, selectedAnnotationId: null, selectedAnnotationType: null }
        : {}),
    });
    saveToLocalStorage(newData);
  },

  deleteAnswer: (questionId, answerId) => {
    const { examData } = get();
    const newLabels = examData.labels.map((q) =>
      q.question_id === questionId
        ? { ...q, answer: q.answer.filter((a) => a.id !== answerId) }
        : q
    );
    const newData = { ...examData, labels: newLabels };
    set({ examData: newData, hasUnsavedChanges: true });
    saveToLocalStorage(newData);
  },

  deleteCorrection: (questionId, correctionId) => {
    const { examData } = get();
    const newLabels = examData.labels.map((q) =>
      q.question_id === questionId
        ? { ...q, correct: q.correct.filter((c) => c.id !== correctionId) }
        : q
    );
    const newData = { ...examData, labels: newLabels };
    set({ examData: newData, hasUnsavedChanges: true });
    saveToLocalStorage(newData);
  },

  updateQuestionText: (questionId, text) => {
    const { examData } = get();
    const newLabels = examData.labels.map((q) =>
      q.question_id === questionId ? { ...q, question_text: text } : q
    );
    const newData = { ...examData, labels: newLabels };
    // 更新文本不进入撤销栈，仅标注时撤销
    set({ examData: newData, hasUnsavedChanges: true });
    saveToLocalStorage(newData);
  },

  undo: () => {
    const { undoHistory } = get();
    if (undoHistory.length === 0) {
      get().showToast('没有可撤销的操作');
      return;
    }
    const previousData = undoHistory[undoHistory.length - 1];
    const newHistory = undoHistory.slice(0, -1);
    set({
      examData: previousData,
      undoHistory: newHistory,
      hasUnsavedChanges: true,
      selectedQuestionId: null,
      selectedAnnotationId: null,
      selectedAnnotationType: null,
    });
    saveToLocalStorage(previousData);
    get().showToast('已撤销');
  },

  // 自动保存
  autoSave: () => {
    if (!get().hasUnsavedChanges) return;
    const { examData } = get();
    saveToLocalStorage(examData);
    set({ hasUnsavedChanges: false });
  },

  handleSaveFeishuData: async (isComplete: boolean = false) => {
    const { feishuRecordIds, feishuCurrentIndex, feishuTableId, examData, showToast } = get();
    const currentId = feishuRecordIds[feishuCurrentIndex];
    if (!currentId || !feishuTableId) return;

    try {
      showToast('正在保存...');
      await writeDataToField(JSON.stringify(examData, null, 4), {
        fieldName: '输出json',
        useCurrentSelection: false,
        tableId: feishuTableId,
        recordId: currentId,
      });

      await writeDataToField(isComplete ? '已标注' : '标注中', {
        fieldName: '标注状态',
        useCurrentSelection: false,
        tableId: feishuTableId,
        recordId: currentId,
      });

      showToast(isComplete ? '保存成功并标记完成' : '保存成功');
    } catch (e) {
      console.error(e);
      showToast('保存失败');
    }
  },
}));
