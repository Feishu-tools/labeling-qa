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
import { simplifyPolygon } from '../utils/geometry';

interface AppState {
  // ---- 数据 ----
  examData: ExamData;
  hasUnsavedChanges: boolean;

  // ---- UI 状态 ----
  annotationMode: AnnotationMode;
  selectedQuestionId: string | null;
  selectedAnnotationId: string | null; // answer/correction id
  selectedAnnotationType: 'question' | 'answer' | 'correction' | null;
  hoveredAnnotationId: string | null;
  zoom: number;
  toastMessage: string | null;

  // ---- 绘制状态 ----
  isDrawing: boolean;
  activeHotkey: '1' | '2' | '3' | '`' | null; // 记录当前按下的热键
  currentPoints: Point[];
  drawingImageId: string | null;

  // ---- Actions ----
  loadExamData: (data: ExamData) => void;
  initFromStorage: () => boolean;

  setAnnotationMode: (mode: AnnotationMode) => void;
  setActiveHotkey: (key: '1' | '2' | '3' | '`' | null) => void;
  selectQuestion: (id: string | null) => void;
  selectAnnotation: (id: string | null, type: 'question' | 'answer' | 'correction' | null) => void;
  setHoveredAnnotation: (id: string | null) => void;
  setZoom: (zoom: number) => void;
  showToast: (msg: string) => void;
  clearToast: () => void;

  // 绘制
  startDrawing: (imageId: string, point: Point) => void;
  addDrawingPoint: (point: Point) => void;
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

  // 自动保存
  autoSave: () => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  // ---- 初始数据 ----
  examData: { images: [], labels: [] },
  hasUnsavedChanges: false,

  annotationMode: 'select',
  selectedQuestionId: null,
  selectedAnnotationId: null,
  selectedAnnotationType: null,
  hoveredAnnotationId: null,
  zoom: 1,
  toastMessage: null,

  isDrawing: false,
  activeHotkey: null,
  currentPoints: [],
  drawingImageId: null,

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

  setAnnotationMode: (mode) => set({ annotationMode: mode }),
  
  setActiveHotkey: (key) => set({ activeHotkey: key }),

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
      currentPoints: [point],
      drawingImageId: imageId,
    });
  },

  addDrawingPoint: (point) => {
    const { isDrawing, currentPoints } = get();
    if (!isDrawing) return;

    // 采样间隔：只有距离上一个点超过 3px 才添加新点
    const lastPoint = currentPoints[currentPoints.length - 1];
    if (lastPoint) {
      const dist = Math.hypot(point[0] - lastPoint[0], point[1] - lastPoint[1]);
      if (dist < 3) return;
    }

    set({ currentPoints: [...currentPoints, point] });
  },

  finishDrawing: () => {
    const { isDrawing, currentPoints, drawingImageId, annotationMode, examData, selectedQuestionId } = get();
    if (!isDrawing || !drawingImageId) {
      set({ isDrawing: false, currentPoints: [], drawingImageId: null, annotationMode: 'select' });
      return;
    }

    // 至少需要 3 个点
    if (currentPoints.length < 3) {
      set({ isDrawing: false, currentPoints: [], drawingImageId: null, annotationMode: 'select' });
      return;
    }

    // 简化 polygon
    const simplified = simplifyPolygon(currentPoints, 2);
    if (simplified.length < 3) {
      set({ isDrawing: false, currentPoints: [], drawingImageId: null, annotationMode: 'select' });
      return;
    }

    const location: AnnotationLocation = {
      image_id: drawingImageId,
      polygon: simplified,
    };

    const newLabels = [...examData.labels];

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
            isDrawing: false,
            currentPoints: [],
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
          isDrawing: false,
          currentPoints: [],
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
          isDrawing: false,
          currentPoints: [],
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
          isDrawing: false,
          currentPoints: [],
          drawingImageId: null,
          annotationMode: 'select',
          selectedAnnotationId: correctId,
          selectedAnnotationType: 'correction',
          hasUnsavedChanges: true,
        });
        saveToLocalStorage(newData);
      }
    } else {
      set({ isDrawing: false, currentPoints: [], drawingImageId: null, annotationMode: 'select' });
    }
  },

  cancelDrawing: () => {
    set({ isDrawing: false, currentPoints: [], drawingImageId: null, annotationMode: 'select' });
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
    set({ examData: newData, hasUnsavedChanges: true });
    saveToLocalStorage(newData);
  },

  autoSave: () => {
    const { examData } = get();
    saveToLocalStorage(examData);
    set({ hasUnsavedChanges: false });
  },
}));
