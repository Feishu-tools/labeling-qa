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
import { updateFeishuRecord, getFeishuRecord } from '../utils/feishu_open_api';

interface AppState {
  // ---- 数据 ----
  examData: ExamData;
  hasUnsavedChanges: boolean;
  undoHistory: ExamData[]; // 用于撤销的历史记录栈

  // ---- UI 状态 ----
  annotationMode: AnnotationMode;
  selectedQuestionId: string | null;
  selectedAnnotationId: string | null; // id for answer/correction, or question_id
  selectedLocIndex: number | null; // 记录题目中具体选中的题干框的索引
  selectedAnnotationType: 'question' | 'answer' | 'correction' | null;
  hoveredAnnotationId: string | null;
  hoveredImageId: string | null; // 记录当前鼠标悬停的图片 ID
  zoom: number;
  toastMessage: string | null;

  // ---- 绘制状态 ----
  isDrawing: boolean;
  activeHotkey: '1' | '2' | '3' | '`' | null; // 记录当前按下的热键
  isControlPressed: boolean; // 是否按下了 Control 键
  isWPressed: boolean; // 是否按下了 W 键
  reconstructTargetId: string | null; // 记录当前 W 键重构正在累加的目标题目 ID
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

  // ---- 飞书 OpenAPI 状态 ----
  isOpenApiMode: boolean;
  feishuAppId: string;
  feishuAppSecret: string;
  feishuAppToken: string;
  feishuRecords: any[]; // 存储通过 OpenAPI 获取的记录列表

  // ---- 本地模型导入状态 ----
  isModelImportMode: boolean;
  modelImportDataList: ExamData[];
  modelImportCurrentIndex: number;

  // ---- Actions ----
  loadExamData: (data: ExamData) => void;
  mergeExamData: (data: ExamData) => void;
  loadModelImportData: (dataList: ExamData[]) => void;
  nextModelImportData: () => void;
  prevModelImportData: () => void;
  initFromStorage: () => boolean;
  setFeishuState: (state: Partial<{ isFeishuEnv: boolean, feishuRecordIds: string[], feishuCurrentIndex: number, feishuTableId: string }>) => void;
  setFeishuOpenApiState: (state: Partial<{ isOpenApiMode: boolean, feishuAppId: string, feishuAppSecret: string, feishuAppToken: string, feishuRecords: any[] }>) => void;

  setAnnotationMode: (mode: AnnotationMode) => void;
  setActiveHotkey: (key: '1' | '2' | '3' | '`' | null) => void;
  setControlPressed: (pressed: boolean) => void;
  setWPressed: (pressed: boolean) => void;
  toggleShowLabels: () => void;
  toggleShowPanel: () => void;
  selectQuestion: (id: string | null) => void;
  selectAnnotation: (id: string | null, type: 'question' | 'answer' | 'correction' | null, locIndex?: number) => void;
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
  toggleImageIgnored: (imageId: string) => void; // 增加切换图片作废状态的方法

  // 标注操作
  detachAnnotationToNewGroup: (annotationId: string, type: 'question' | 'answer' | 'correction', originalQuestionId: string, locIndex?: number) => void;
  deleteQuestion: (questionId: string) => void;
  deleteQuestionLocation: (questionId: string, locIndex: number) => void;
  updateAnnotationPolygon: (id: string, type: 'question' | 'answer' | 'correction', locIndex: number | undefined, newPolygon: Point[], saveHistory?: boolean) => void;
  deleteAnswer: (questionId: string, answerId: string) => void;
  deleteCorrection: (questionId: string, correctionId: string) => void;
  updateQuestionText: (questionId: string, text: string) => void;
  undo: () => void;

  // 自动保存
  autoSave: () => void;
  
  // 飞书保存
  handleSaveFeishuData: (isComplete?: boolean) => Promise<void>;
  handleNextFeishuRow: () => Promise<void>;
  handlePrevFeishuRow: () => Promise<void>;
}

export const useAppStore = create<AppState>((set, get) => ({
  // ---- 初始数据 ----
  examData: { images: [], labels: [] },
  hasUnsavedChanges: false,
  undoHistory: [],

  annotationMode: 'select',
  selectedQuestionId: null,
  selectedAnnotationId: null,
  selectedLocIndex: null,
  selectedAnnotationType: null,
  hoveredAnnotationId: null,
  hoveredImageId: null,
  zoom: 1,
  toastMessage: null,

  isDrawing: false,
  activeHotkey: null,
  isControlPressed: false,
  isWPressed: false,
  reconstructTargetId: null,
  showLabels: false, // 默认隐藏
  showPanel: false, // 默认隐藏右侧面板
  currentPoints: [],
  hoverPoint: null,
  drawingImageId: null,

  isFeishuEnv: false,
  feishuRecordIds: [],
  feishuCurrentIndex: -1,
  feishuTableId: '',

  isOpenApiMode: false,
  feishuAppId: 'cli_a801922b07325013',
  feishuAppSecret: 'saBeFOLLaEay7Z2wDgtwxfl46RYfWNEs',
  feishuAppToken: '',
  feishuRecords: [],

  isModelImportMode: false,
  modelImportDataList: [],
  modelImportCurrentIndex: 0,

  // ---- Actions ----

  loadExamData: (data) => {
    set({ examData: data, hasUnsavedChanges: false });
    saveToLocalStorage(data);
  },

  loadModelImportData: (dataList) => {
    if (dataList.length > 0) {
      set({
        isModelImportMode: true,
        modelImportDataList: dataList,
        modelImportCurrentIndex: 0,
        examData: dataList[0],
        hasUnsavedChanges: false,
        undoHistory: []
      });
    }
  },

  nextModelImportData: () => set((state) => {
    if (!state.isModelImportMode || state.modelImportCurrentIndex >= state.modelImportDataList.length - 1) return {};
    const nextIndex = state.modelImportCurrentIndex + 1;
    return {
      modelImportCurrentIndex: nextIndex,
      examData: state.modelImportDataList[nextIndex],
      hasUnsavedChanges: false,
      undoHistory: []
    };
  }),

  prevModelImportData: () => set((state) => {
    if (!state.isModelImportMode || state.modelImportCurrentIndex <= 0) return {};
    const prevIndex = state.modelImportCurrentIndex - 1;
    return {
      modelImportCurrentIndex: prevIndex,
      examData: state.modelImportDataList[prevIndex],
      hasUnsavedChanges: false,
      undoHistory: []
    };
  }),

  mergeExamData: (data) => set((state) => {
    const newImages = [...state.examData.images];
    // 为了防止图片重复，如果有相同 URL 或者 ID，可以考虑过滤，这里简单地全部追加
    const existingUrls = new Set(state.examData.images.map(img => img.url));
    const addedImagesMap = new Map<string, string>(); // oldId -> newId (if needed)

    data.images.forEach(img => {
      if (!existingUrls.has(img.url)) {
        newImages.push(img);
        existingUrls.add(img.url);
      }
    });

    const newLabels = [...state.examData.labels, ...data.labels];

    const newData = {
      images: newImages,
      labels: newLabels,
    };

    saveToLocalStorage(newData);
    return {
      examData: newData,
      hasUnsavedChanges: true,
      undoHistory: [...state.undoHistory, state.examData].slice(-20),
    };
  }),

  initFromStorage: () => {
    const data = loadFromLocalStorage();
    if (data) {
      set({ examData: data });
      return true;
    }
    return false;
  },

  setFeishuState: (state) => set(state),
  setFeishuOpenApiState: (state) => set(state),

  setAnnotationMode: (mode) => set({ annotationMode: mode }),
  
  setActiveHotkey: (key) => set({ activeHotkey: key }),

  setControlPressed: (pressed) => set({ isControlPressed: pressed }),

  setWPressed: (pressed) => {
    set({ isWPressed: pressed });
    // 如果松开了 W 键，清除累加目标，下一次按 W 键会创建新题目
    if (!pressed) {
      set({ reconstructTargetId: null });
    }
  },

  toggleShowLabels: () => set((state) => ({ showLabels: !state.showLabels })),

  toggleShowPanel: () => set((state) => ({ showPanel: !state.showPanel })),

  selectQuestion: (id) =>
    set({
      selectedQuestionId: id,
      selectedAnnotationId: id,
      selectedLocIndex: null,
      selectedAnnotationType: id ? 'question' : null,
    }),

  selectAnnotation: (id, type, locIndex) =>
    set((state) => {
      const newState: Partial<AppState> = {
        selectedAnnotationId: id,
        selectedLocIndex: locIndex ?? null,
        selectedAnnotationType: type,
      };
      
      // 如果选中的是答案或批改，自动选中所属题目
      if (type === 'answer' || type === 'correction') {
        const question = state.examData.labels.find((q) =>
          type === 'answer'
            ? q.answer.some((a) => a.id === id)
            : q.correct.some((c) => c.id === id)
        );
        if (question) {
          newState.selectedQuestionId = question.question_id;
        }
      } else if (type === 'question') {
        newState.selectedQuestionId = id;
      }
      
      return newState;
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

  toggleImageIgnored: (imageId) => {
    const { examData } = get();
    const newImages = examData.images.map((img: ExamImage) =>
      img.id === imageId ? { ...img, ignored: !img.ignored } : img
    );
    const newData = { ...examData, images: newImages };
    set({ examData: newData, hasUnsavedChanges: true });
    saveToLocalStorage(newData);
  },

  // ---- 标注操作 ----

  detachAnnotationToNewGroup: (annotationId, type, originalQuestionId, locIndex) => {
    const { examData, undoHistory, reconstructTargetId } = get();
    const newLabels = [...examData.labels];
    const originalQIndex = newLabels.findIndex(q => q.question_id === originalQuestionId);
    if (originalQIndex === -1) return;

    // 如果点击的是已经被重构到目标题目里的框，就不做处理
    if (originalQuestionId === reconstructTargetId) return;

    const originalQ = { ...newLabels[originalQIndex] };
    const nextUndoHistory = [...undoHistory, examData].slice(-20);

    let targetQuestionId = reconstructTargetId;
    let targetQIndex = targetQuestionId ? newLabels.findIndex(q => q.question_id === targetQuestionId) : -1;
    let targetQuestion: QuestionAnnotation;

    if (targetQIndex !== -1) {
      // 累加到已有的重构题目上
      targetQuestion = { ...newLabels[targetQIndex] };
    } else {
      // 创建新的重构题目
      targetQuestionId = generateId('q');
      targetQuestion = {
        question_id: targetQuestionId,
        question_text: '',
        location: [],
        answer: [],
        correct: [],
      };
    }

    let extractedLocations: AnnotationLocation[] = [];
    let extractedAnswer: any = null;
    let extractedCorrection: any = null;

    if (type === 'question' && locIndex !== undefined) {
      const locToMove = originalQ.location[locIndex];
      if (!locToMove) return;
      originalQ.location = originalQ.location.filter((_, i) => i !== locIndex);
      extractedLocations = [locToMove];
    } else if (type === 'answer') {
      const ansIndex = originalQ.answer.findIndex(a => a.id === annotationId);
      if (ansIndex === -1) return;
      const ansToMove = originalQ.answer[ansIndex];
      originalQ.answer = originalQ.answer.filter(a => a.id !== annotationId);
      extractedAnswer = ansToMove;
    } else if (type === 'correction') {
      const corrIndex = originalQ.correct.findIndex(c => c.id === annotationId);
      if (corrIndex === -1) return;
      const corrToMove = originalQ.correct[corrIndex];
      originalQ.correct = originalQ.correct.filter(c => c.id !== annotationId);
      extractedCorrection = corrToMove;
    }

    // 将提取出的框按类别累加到目标题目中
    if (extractedLocations.length > 0) {
      targetQuestion.location = [...targetQuestion.location, ...extractedLocations];
    }
    if (extractedAnswer) {
      targetQuestion.answer = [...targetQuestion.answer, extractedAnswer];
    }
    if (extractedCorrection) {
      targetQuestion.correct = [...targetQuestion.correct, extractedCorrection];
    }

    newLabels[originalQIndex] = originalQ;
    
    if (targetQIndex !== -1) {
      newLabels[targetQIndex] = targetQuestion;
    } else {
      newLabels.push(targetQuestion);
    }

    // 如果分离后，原题目完全空了（没有题干、没有答案、没有批改），则删除它
    if (originalQ.location.length === 0 && originalQ.answer.length === 0 && originalQ.correct.length === 0) {
      const qIndexToRemove = newLabels.findIndex(q => q.question_id === originalQuestionId);
      if (qIndexToRemove !== -1) {
        newLabels.splice(qIndexToRemove, 1);
      }
    }

    const newData = { ...examData, labels: newLabels };
    set({
      examData: newData,
      undoHistory: nextUndoHistory,
      hasUnsavedChanges: true,
      selectedQuestionId: targetQuestionId,
      selectedAnnotationId: targetQuestionId,
      selectedAnnotationType: 'question',
      reconstructTargetId: targetQuestionId, // 记录当前重构的目标
    });
    saveToLocalStorage(newData);
    get().showToast(targetQIndex !== -1 ? '已追加到新题目' : '已重构为新题目');
  },

  deleteQuestionLocation: (questionId, locIndex) => {
    const { examData, selectedQuestionId } = get();
    const newLabels = [...examData.labels];
    const qIndex = newLabels.findIndex((q) => q.question_id === questionId);
    if (qIndex === -1) return;

    const originalQ = { ...newLabels[qIndex] };
    originalQ.location = originalQ.location.filter((_, i) => i !== locIndex);

    // 如果删除了最后一个框，且没有答案/批改，则删除整题
    if (originalQ.location.length === 0 && originalQ.answer.length === 0 && originalQ.correct.length === 0) {
      newLabels.splice(qIndex, 1);
      set({
        selectedQuestionId: selectedQuestionId === questionId ? null : selectedQuestionId,
        selectedAnnotationId: null,
        selectedLocIndex: null,
        selectedAnnotationType: null,
      });
    } else {
      newLabels[qIndex] = originalQ;
      set({
        selectedAnnotationId: null,
        selectedLocIndex: null,
      });
    }

    const newData = { ...examData, labels: newLabels };
    set({ examData: newData, hasUnsavedChanges: true });
    saveToLocalStorage(newData);
  },

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

  updateAnnotationPolygon: (id, type, locIndex, newPolygon, saveHistory = false) => {
    const { examData, undoHistory } = get();
    const newLabels = [...examData.labels];
    const nextUndoHistory = saveHistory ? [...undoHistory, examData].slice(-20) : undoHistory;

    for (let i = 0; i < newLabels.length; i++) {
      const q = { ...newLabels[i] };
      let changed = false;

      if (type === 'question' && q.question_id === id && locIndex !== undefined) {
        const newLocs = [...q.location];
        if (newLocs[locIndex]) {
          newLocs[locIndex] = { ...newLocs[locIndex], polygon: newPolygon };
          q.location = newLocs;
          changed = true;
        }
      } else if (type === 'answer') {
        const aIndex = q.answer.findIndex(a => a.id === id);
        if (aIndex !== -1) {
          const newAnswers = [...q.answer];
          const ans = { ...newAnswers[aIndex] };
          // 当前答案只有一个 location
          ans.location = [{ ...ans.location[0], polygon: newPolygon }];
          newAnswers[aIndex] = ans;
          q.answer = newAnswers;
          changed = true;
        }
      } else if (type === 'correction') {
        const cIndex = q.correct.findIndex(c => c.id === id);
        if (cIndex !== -1) {
          const newCorrects = [...q.correct];
          const corr = { ...newCorrects[cIndex] };
          corr.location = [{ ...corr.location[0], polygon: newPolygon }];
          newCorrects[cIndex] = corr;
          q.correct = newCorrects;
          changed = true;
        }
      }

      if (changed) {
        newLabels[i] = q;
        break;
      }
    }

    const newData = { ...examData, labels: newLabels };
    set({
      examData: newData,
      undoHistory: nextUndoHistory,
      hasUnsavedChanges: true,
    });
    if (saveHistory) {
      saveToLocalStorage(newData);
    }
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
    // 保存前，先完成当前可能的绘制动作，并清理选中状态（模拟一次空格操作），避免最后一笔未结束或选中状态污染下一题
    const state = get();
    if (state.isDrawing) {
      state.finishDrawing();
    }
    set({
      selectedQuestionId: null,
      selectedAnnotationId: null,
      selectedAnnotationType: null,
    });

    const { feishuRecordIds, feishuCurrentIndex, feishuTableId, examData, showToast, isOpenApiMode, feishuAppId, feishuAppSecret, feishuAppToken } = get();
    const currentId = feishuRecordIds[feishuCurrentIndex];
    if (!currentId || !feishuTableId) return;

    try {
      showToast('正在保存...');
      
      if (isOpenApiMode) {
        // 使用 OpenAPI 保存
        await updateFeishuRecord(
          { appId: feishuAppId, appSecret: feishuAppSecret, appToken: feishuAppToken, tableId: feishuTableId },
          currentId,
          {
            '输出json': JSON.stringify(examData, null, 4),
            '标注状态': isComplete ? '已标注' : '标注中',
          }
        );
      } else {
        // 使用小组件 SDK 保存
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
      }

      showToast(isComplete ? '保存成功并标记完成' : '保存成功');
      
      if (isComplete) {
        await get().handleNextFeishuRow();
      }
    } catch (e) {
      console.error(e);
      showToast('保存失败');
    }
  },

  handleNextFeishuRow: async () => {
    const { feishuCurrentIndex, feishuRecordIds, feishuTableId, isOpenApiMode, feishuAppId, feishuAppSecret, feishuAppToken, setFeishuState, loadExamData } = get();
    if (feishuCurrentIndex < feishuRecordIds.length - 1) {
      const nextIndex = feishuCurrentIndex + 1;
      
      const parseFeishuJson = (jsonDataToParse: any) => {
        if (jsonDataToParse) {
          try {
            let structuredDataStr = '';
            if (typeof jsonDataToParse === 'string') {
              structuredDataStr = jsonDataToParse;
            } else if (Array.isArray(jsonDataToParse)) {
              for (const item of jsonDataToParse) {
                if (item.type === 'text' || item.type === 'url') {
                  structuredDataStr += item.text || '';
                }
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

      if (isOpenApiMode) {
        setFeishuState({ feishuCurrentIndex: nextIndex });
        const nextId = feishuRecordIds[nextIndex];
        try {
          const record = await getFeishuRecord(
            { appId: feishuAppId, appSecret: feishuAppSecret, appToken: feishuAppToken, tableId: feishuTableId },
            nextId
          );
          if (record && record.fields) {
            parseFeishuJson(record.fields['输出json'] || record.fields['输入json']);
          }
        } catch (e) {
          console.error('获取飞书最新行数据失败', e);
          get().showToast('获取行数据失败');
        }
      } else {
        const nextId = feishuRecordIds[nextIndex];
        const res = await getRowAllFields({ tableId: feishuTableId, recordId: nextId, useCurrentSelection: false });
        if (res.success && res.data) {
          setFeishuState({ feishuCurrentIndex: nextIndex });
          const outputJsonField = res.data.find((f: FieldData) => f.fieldName === '输出json');
          const inputJsonField = res.data.find((f: FieldData) => f.fieldName === '输入json');
          let jsonDataToParse = null;
          if (outputJsonField && outputJsonField.value) {
            jsonDataToParse = outputJsonField.value;
          } else if (inputJsonField && inputJsonField.value) {
            jsonDataToParse = inputJsonField.value;
          }
          parseFeishuJson(jsonDataToParse);
        }
      }
    }
  },

  handlePrevFeishuRow: async () => {
    const { feishuCurrentIndex, feishuRecordIds, feishuTableId, isOpenApiMode, feishuAppId, feishuAppSecret, feishuAppToken, setFeishuState, loadExamData } = get();
    if (feishuCurrentIndex > 0) {
      const prevIndex = feishuCurrentIndex - 1;
      
      const parseFeishuJson = (jsonDataToParse: any) => {
        if (jsonDataToParse) {
          try {
            let structuredDataStr = '';
            if (typeof jsonDataToParse === 'string') {
              structuredDataStr = jsonDataToParse;
            } else if (Array.isArray(jsonDataToParse)) {
              for (const item of jsonDataToParse) {
                if (item.type === 'text' || item.type === 'url') {
                  structuredDataStr += item.text || '';
                }
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

      if (isOpenApiMode) {
        setFeishuState({ feishuCurrentIndex: prevIndex });
        const prevId = feishuRecordIds[prevIndex];
        try {
          const record = await getFeishuRecord(
            { appId: feishuAppId, appSecret: feishuAppSecret, appToken: feishuAppToken, tableId: feishuTableId },
            prevId
          );
          if (record && record.fields) {
            parseFeishuJson(record.fields['输出json'] || record.fields['输入json']);
          }
        } catch (e) {
          console.error('获取飞书最新行数据失败', e);
          get().showToast('获取行数据失败');
        }
      } else {
        const prevId = feishuRecordIds[prevIndex];
        const res = await getRowAllFields({ tableId: feishuTableId, recordId: prevId, useCurrentSelection: false });
        if (res.success && res.data) {
          setFeishuState({ feishuCurrentIndex: prevIndex });
          const outputJsonField = res.data.find((f: FieldData) => f.fieldName === '输出json');
          const inputJsonField = res.data.find((f: FieldData) => f.fieldName === '输入json');
          let jsonDataToParse = null;
          if (outputJsonField && outputJsonField.value) {
            jsonDataToParse = outputJsonField.value;
          } else if (inputJsonField && inputJsonField.value) {
            jsonDataToParse = inputJsonField.value;
          }
          parseFeishuJson(jsonDataToParse);
        }
      }
    }
  },
}));
