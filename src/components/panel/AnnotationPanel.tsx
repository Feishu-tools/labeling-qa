// ============================================================
// 右侧标注面板 — 层级树展示
// ============================================================
import { useAppStore } from '../../store';
import { ANNOTATION_COLORS } from '../../types';
import {
  FileText,
  PenLine,
  CheckCircle,
  Trash2,
  ChevronDown,
  ChevronRight,
  Layers,
} from 'lucide-react';
import { useState, useMemo } from 'react';

export default function AnnotationPanel() {
  const {
    examData,
    annotationMode,
    selectedQuestionId,
    selectedAnnotationId,
    hoveredAnnotationId,
    selectQuestion,
    selectAnnotation,
    setHoveredAnnotation,
    deleteQuestion,
    deleteAnswer,
    deleteCorrection,
  } = useAppStore();

  const [expandedQuestions, setExpandedQuestions] = useState<Set<string>>(new Set());

  // 获取当前悬停的标注所属的题目 ID
  const hoveredQuestionId = useMemo(() => {
    if (!hoveredAnnotationId) return null;
    for (const q of examData.labels) {
      if (q.question_id === hoveredAnnotationId) return q.question_id;
      if (q.answer.some(a => a.id === hoveredAnnotationId)) return q.question_id;
      if (q.correct.some(c => c.id === hoveredAnnotationId)) return q.question_id;
    }
    return null;
  }, [hoveredAnnotationId, examData.labels]);

  const toggleExpanded = (qId: string) => {
    setExpandedQuestions((prev) => {
      const next = new Set(prev);
      if (next.has(qId)) {
        next.delete(qId);
      } else {
        next.add(qId);
      }
      return next;
    });
  };

  const labelCount = examData.labels.length;
  const totalAnnotations = examData.labels.reduce(
    (sum, q) => sum + 1 + q.answer.length + q.correct.length,
    0
  );

  return (
    <aside className="annotation-panel" id="annotation-panel">
      {/* 面板头部 */}
      <div className="panel-header">
        <div className="panel-header-title">
          <Layers size={16} />
          <span>标注列表</span>
        </div>
        <div className="panel-header-stats">
          {labelCount} 题 · {totalAnnotations} 标注
        </div>
      </div>

      {/* 当前模式提示 */}
      {annotationMode !== 'select' && (
        <div
          className="panel-mode-indicator"
          style={{
            borderColor: ANNOTATION_COLORS[annotationMode as 'question' | 'answer' | 'correction']?.stroke,
            backgroundColor: ANNOTATION_COLORS[annotationMode as 'question' | 'answer' | 'correction']?.fill,
          }}
        >
          <span>
            当前模式：
            <strong>{ANNOTATION_COLORS[annotationMode as 'question' | 'answer' | 'correction']?.label}</strong>
          </span>
          {(annotationMode === 'answer' || annotationMode === 'correction') && (
            <span className="panel-mode-hint">
              {selectedQuestionId
                ? `→ 归属 Q${examData.labels.findIndex((q) => q.question_id === selectedQuestionId) + 1}`
                : '⚠ 请先选择题目'}
            </span>
          )}
        </div>
      )}

      {/* 标注树 */}
      <div className="panel-tree">
        {examData.labels.length === 0 ? (
          <div className="panel-empty">
            <p>暂无任何标注</p>
            <p className="panel-empty-hint">
              按 <strong>空格键</strong> 开始新题目<br />按住键盘 1/2/3 滑动鼠标完成标注
            </p>
          </div>
        ) : (
          examData.labels.map((question, qi) => {
            const isExpanded = expandedQuestions.has(question.question_id);
            const isSelectedQuestion = selectedQuestionId === question.question_id;
            const isSelectedAnnotation = selectedAnnotationId === question.question_id;
            const pageIds = [...new Set(question.location.map((l) => l.image_id))];
            const pageIndices = pageIds.map((pid) =>
              examData.images.findIndex((img) => img.id === pid)
            );

            return (
              <div
                key={question.question_id}
                className={`panel-question-group ${isSelectedQuestion ? 'panel-question-group--active' : ''} ${hoveredQuestionId === question.question_id && !isSelectedQuestion ? 'panel-question-group--hovered' : ''}`}
              >
                {/* 题目行 */}
                <div
                  className={`panel-tree-item panel-tree-item--question ${isSelectedAnnotation ? 'panel-tree-item--selected' : ''}`}
                  onClick={() => {
                    selectQuestion(question.question_id);
                    selectAnnotation(question.question_id, 'question');
                    if (!isExpanded) toggleExpanded(question.question_id);
                  }}
                  onMouseEnter={() => setHoveredAnnotation(question.question_id)}
                  onMouseLeave={() => setHoveredAnnotation(null)}
                >
                  <button
                    className="panel-expand-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleExpanded(question.question_id);
                    }}
                  >
                    {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </button>

                  <div
                    className="panel-color-dot"
                    style={{ backgroundColor: ANNOTATION_COLORS.question.stroke }}
                  />

                  <FileText size={14} className="panel-item-icon" style={{ color: ANNOTATION_COLORS.question.stroke }} />

                  <span className="panel-item-label">
                    题目 {qi + 1}
                    {question.question_text && (
                      <span className="panel-item-text"> · {question.question_text}</span>
                    )}
                  </span>

                  {/* 页码标签 */}
                  {pageIndices.length > 0 && (
                    <span className="panel-page-tags">
                      {pageIndices.map((pi) => (
                        <span key={pi} className="panel-page-tag">
                          P{pi + 1}
                        </span>
                      ))}
                    </span>
                  )}

                  <button
                    className="panel-delete-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteQuestion(question.question_id);
                    }}
                    title="删除题目"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>

                {/* 答案和批改 */}
                {isExpanded && (
                  <div className="panel-children">
                    {/* 答案列表 */}
                    {question.answer.map((answer, ai) => (
                      <div
                        key={answer.id}
                        className={`panel-tree-item panel-tree-item--answer ${selectedAnnotationId === answer.id ? 'panel-tree-item--selected' : ''}`}
                        onClick={() => {
                          selectQuestion(question.question_id);
                          selectAnnotation(answer.id, 'answer');
                        }}
                        onMouseEnter={() => setHoveredAnnotation(answer.id)}
                        onMouseLeave={() => setHoveredAnnotation(null)}
                      >
                        <div className="panel-indent" />
                        <div
                          className="panel-color-dot"
                          style={{ backgroundColor: ANNOTATION_COLORS.answer.stroke }}
                        />
                        <PenLine
                          size={13}
                          className="panel-item-icon"
                          style={{ color: ANNOTATION_COLORS.answer.stroke }}
                        />
                        <span className="panel-item-label">
                          答案 {ai + 1}
                          {answer.answer_text && (
                            <span className="panel-item-text"> · {answer.answer_text}</span>
                          )}
                        </span>
                        <button
                          className="panel-delete-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteAnswer(question.question_id, answer.id);
                          }}
                          title="删除答案"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}

                    {/* 批改列表 */}
                    {question.correct.map((correction, ci) => (
                      <div
                        key={correction.id}
                        className={`panel-tree-item panel-tree-item--correction ${selectedAnnotationId === correction.id ? 'panel-tree-item--selected' : ''}`}
                        onClick={() => {
                          selectQuestion(question.question_id);
                          selectAnnotation(correction.id, 'correction');
                        }}
                        onMouseEnter={() => setHoveredAnnotation(correction.id)}
                        onMouseLeave={() => setHoveredAnnotation(null)}
                      >
                        <div className="panel-indent" />
                        <div
                          className="panel-color-dot"
                          style={{ backgroundColor: ANNOTATION_COLORS.correction.stroke }}
                        />
                        <CheckCircle
                          size={13}
                          className="panel-item-icon"
                          style={{ color: ANNOTATION_COLORS.correction.stroke }}
                        />
                        <span className="panel-item-label">
                          批改 {ci + 1}
                          {correction.correct_text && (
                            <span className="panel-item-text"> · {correction.correct_text}</span>
                          )}
                        </span>
                        <button
                          className="panel-delete-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteCorrection(question.question_id, correction.id);
                          }}
                          title="删除批改"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}

                    {/* 空状态 */}
                    {question.answer.length === 0 && question.correct.length === 0 && (
                      <div className="panel-tree-empty-children">
                      按住键盘 2(答案) 或 3(批改)<br />滑动鼠标，松开按键完成标注
                    </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
}
