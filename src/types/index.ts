// ============================================================
// 试卷标注系统 — 类型定义
// ============================================================

/** 坐标点 [x, y] */
export type Point = [number, number];

/** 标注模式 */
export type AnnotationMode = 'select' | 'question' | 'answer' | 'correction';

/** 单个标注区域 (polygon 在某一页上) */
export interface AnnotationLocation {
  image_id: string;
  polygon: Point[];
}

/** 答案标注 */
export interface AnswerAnnotation {
  id: string;
  answer_text: string;
  location: AnnotationLocation[];
}

/** 批改标注 */
export interface CorrectionAnnotation {
  id: string;
  correct_text: string;
  location: AnnotationLocation[];
}

/** 题目标注 (顶层，包含答案和批改) */
export interface QuestionAnnotation {
  question_id: string;
  question_text: string;
  location: AnnotationLocation[];
  answer: AnswerAnnotation[];
  correct: CorrectionAnnotation[];
}

/** 试卷页面图片 */
export interface ExamImage {
  id: string;
  url: string;
  rotation: number; // 0 | 90 | 180 | 270
  ignored?: boolean; // 新增：是否作废/不需要这张图片
}

/** 试卷数据 (导入/导出格式) */
export interface ExamData {
  images: ExamImage[];
  labels: QuestionAnnotation[];
}

/** 标注类别颜色配置 */
export const ANNOTATION_COLORS: Record<
  'question' | 'answer' | 'correction',
  { fill: string; stroke: string; label: string }
> = {
  question: {
    fill: 'rgba(124, 174, 255, 0.5)',
    stroke: 'rgba(123, 170, 248, 1)',
    label: '题目',
  },
  answer: {
    fill: 'rgba(150, 246, 185, 0.26)',
    stroke: 'rgba(131, 255, 177, 1)',
    label: '答案',
  },
  correction: {
    fill: 'rgba(252, 191, 148, 0.5)',
    stroke: 'rgba(241, 175, 128, 1)',
    label: '批改',
  },
};

/** 标注颜色 (用于选中高亮) */
export const ANNOTATION_COLORS_SELECTED: Record<
  'question' | 'answer' | 'correction',
  { fill: string; stroke: string }
> = {
  question: {
    fill: 'rgba(161, 197, 255, 0.2)',
    stroke: 'rgba(122, 170, 249, 0.6)',
  },
  answer: {
    fill: 'rgba(172, 243, 198, 0.23)',
    stroke: 'rgba(154, 248, 189, 0.53)',
  },
  correction: {
    fill: 'rgba(252, 191, 148, 0.26)',
    stroke: 'rgba(252, 198, 160, 0.55)',
  },
};
