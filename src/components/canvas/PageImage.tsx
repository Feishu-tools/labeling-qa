// ============================================================
// 单页图片组件 — 渲染图片 + SVG polygon overlay
// ============================================================
import { useRef, useCallback, useState, useEffect } from 'react';
import { useAppStore } from '../../store';
import type { Point, ExamImage } from '../../types';
import { ANNOTATION_COLORS, ANNOTATION_COLORS_SELECTED } from '../../types';
import { polygonToSvgPath } from '../../utils/geometry';
import { RotateCw } from 'lucide-react';

const getCustomCursor = (mode: string) => {
  if (mode === 'select') return 'default';
  const colorMap: Record<string, string> = {
    question: '#3b82f6',
    answer: '#22c55e',
    correction: '#f97316',
  };
  const color = colorMap[mode] || '#000000';
  const svg = `<svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg"><circle cx="16" cy="16" r="12" fill="none" stroke="white" stroke-width="4"/><circle cx="16" cy="16" r="12" fill="none" stroke="${color}" stroke-width="2"/><line x1="16" y1="0" x2="16" y2="32" stroke="white" stroke-width="4"/><line x1="0" y1="16" x2="32" y2="16" stroke="white" stroke-width="4"/><line x1="16" y1="0" x2="16" y2="32" stroke="${color}" stroke-width="2"/><line x1="0" y1="16" x2="32" y2="16" stroke="${color}" stroke-width="2"/><circle cx="16" cy="16" r="5" fill="#ef4444"/></svg>`;
  return `url('data:image/svg+xml;utf8,${encodeURIComponent(svg)}') 16 16, crosshair`;
};

interface PageImageProps {
  image: ExamImage;
  index: number;
}

export default function PageImage({ image, index }: PageImageProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [imgSize, setImgSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  const [isHovered, setIsHovered] = useState(false);

  const {
    examData,
    annotationMode,
    isDrawing,
    currentPoints,
    drawingImageId,
    selectedAnnotationId,
    hoveredAnnotationId,
    activeHotkey,
    startDrawing,
    addDrawingPoint,
    finishDrawing,
    rotateImage,
    selectAnnotation,
    setHoveredAnnotation,
  } = useAppStore();

  // 获取图片实际渲染尺寸
  const updateImgSize = useCallback(() => {
    if (imgRef.current) {
      const { naturalWidth, naturalHeight } = imgRef.current;
      if (naturalWidth > 0) {
        setImgSize({ w: naturalWidth, h: naturalHeight });
      }
    }
  }, []);

  useEffect(() => {
    const img = imgRef.current;
    if (img && img.complete) {
      updateImgSize();
    }
  }, [updateImgSize]);

  // 将鼠标位置转换为图片坐标
  const getImageCoords = useCallback(
    (e: React.PointerEvent | React.MouseEvent): Point | null => {
      const svg = containerRef.current?.querySelector('svg.page-svg-overlay');
      if (!svg || imgSize.w === 0) return null;

      const rect = svg.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * imgSize.w;
      const y = ((e.clientY - rect.top) / rect.height) * imgSize.h;

      return [Math.round(x), Math.round(y)];
    },
    [imgSize]
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (e.button !== 0) return;
      if (activeHotkey) return; // 热键模式下忽略鼠标按下，避免冲突
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch (e) {}
      const point = getImageCoords(e);
      if (point) {
        startDrawing(image.id, point);
      }
    },
    [getImageCoords, image.id, startDrawing, activeHotkey]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      const point = getImageCoords(e);
      if (!point) return;

      // 如果按住了热键，并且还没开始画，此时移动鼠标就自动开始画！
      if (activeHotkey && !isDrawing) {
        startDrawing(image.id, point);
        return;
      }

      if (!isDrawing || drawingImageId !== image.id) return;
      addDrawingPoint(point);
    },
    [isDrawing, drawingImageId, image.id, getImageCoords, addDrawingPoint, activeHotkey, startDrawing]
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (!isDrawing || drawingImageId !== image.id) return;
      if (activeHotkey) return; // 如果在使用热键模式，鼠标松开不应该结束绘制，必须等热键松开
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch (err) {}
      finishDrawing();
    },
    [isDrawing, drawingImageId, image.id, finishDrawing, activeHotkey]
  );

  // 收集当前页面的所有 polygon
  const polygons: {
    id: string;
    type: 'question' | 'answer' | 'correction';
    polygon: Point[];
    questionId: string;
    label: string;
  }[] = [];

  examData.labels.forEach((q, qi) => {
    q.location.forEach((loc) => {
      if (loc.image_id === image.id) {
        polygons.push({
          id: q.question_id,
          type: 'question',
          polygon: loc.polygon,
          questionId: q.question_id,
          label: `Q${qi + 1}`,
        });
      }
    });
    q.answer.forEach((a, ai) => {
      a.location.forEach((loc) => {
        if (loc.image_id === image.id) {
          polygons.push({
            id: a.id,
            type: 'answer',
            polygon: loc.polygon,
            questionId: q.question_id,
            label: `Q${qi + 1}-A${ai + 1}`,
          });
        }
      });
    });
    q.correct.forEach((c, ci) => {
      c.location.forEach((loc) => {
        if (loc.image_id === image.id) {
          polygons.push({
            id: c.id,
            type: 'correction',
            polygon: loc.polygon,
            questionId: q.question_id,
            label: `Q${qi + 1}-C${ci + 1}`,
          });
        }
      });
    });
  });

  // 旋转样式
  const rotationStyle: React.CSSProperties = {
    transform: `rotate(${image.rotation}deg)`,
  };

  // 判断是否是旋转了 90° 或 270° — 需要交换宽高
  const isRotated90 = image.rotation === 90 || image.rotation === 270;

  return (
    <div
      className="page-image-container"
      ref={containerRef}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      data-page-index={index}
    >
      {/* 页码标签 */}
      <div className="page-number-badge">{index + 1}</div>

      {/* 旋转按钮 */}
      {isHovered && (
        <button
          className="page-rotate-btn"
          onClick={(e) => {
            e.stopPropagation();
            rotateImage(image.id);
          }}
          title="旋转 90°"
        >
          <RotateCw size={14} />
        </button>
      )}

      {/* 图片 + SVG 叠加层 */}
      <div
        className="page-image-wrapper"
        style={isRotated90 ? { aspectRatio: `${imgSize.h || 3} / ${imgSize.w || 4}` } : undefined}
      >
        <div className="page-image-inner" style={rotationStyle}>
          <img
            ref={imgRef}
            src={image.url}
            alt={`试卷第 ${index + 1} 页`}
            className="page-image"
            onLoad={updateImgSize}
            draggable={false}
          />

          {/* SVG overlay */}
          {imgSize.w > 0 && (
            <svg
              className="page-svg-overlay"
              viewBox={`0 0 ${imgSize.w} ${imgSize.h}`}
              preserveAspectRatio="none"
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              style={{
                touchAction: 'none',
                cursor: isDrawing ? getCustomCursor(annotationMode) : 'default',
              }}
            >
              {/* 透明的背景矩形，确保整个画布能响应指针事件 */}
              <rect
                x="0"
                y="0"
                width={imgSize.w}
                height={imgSize.h}
                fill="transparent"
                style={{ pointerEvents: 'all' }}
              />

              {/* 已有标注 */}
              {polygons.map((p) => {
                const isSelected = selectedAnnotationId === p.id;
                const isHoveredPolygon = hoveredAnnotationId === p.id;
                const colors = isSelected
                  ? ANNOTATION_COLORS_SELECTED[p.type]
                  : ANNOTATION_COLORS[p.type];

                return (
                  <g key={`${p.id}-${p.polygon.length}`}>
                    <path
                      d={polygonToSvgPath(p.polygon)}
                      fill={colors.fill}
                      stroke={colors.stroke}
                      strokeWidth={isSelected || isHoveredPolygon ? 3 : 1.5}
                      vectorEffect="non-scaling-stroke"
                      strokeLinejoin="round"
                      className={`polygon-path ${isSelected ? 'polygon-selected' : ''} ${isHoveredPolygon ? 'polygon-hovered' : ''}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (annotationMode === 'select') {
                          selectAnnotation(p.id, p.type);
                        }
                      }}
                      onMouseEnter={() => {
                        if (annotationMode === 'select') setHoveredAnnotation(p.id);
                      }}
                      onMouseLeave={() => {
                        if (annotationMode === 'select') setHoveredAnnotation(null);
                      }}
                      style={{ pointerEvents: annotationMode === 'select' ? 'all' : 'none' }}
                    />
                    {/* Label */}
                    {p.polygon.length > 0 && (
                      <text
                        x={p.polygon[0][0] + 4}
                        y={p.polygon[0][1] - 6}
                        className="polygon-label"
                        fill={ANNOTATION_COLORS[p.type].stroke}
                        fontSize={Math.max(12, imgSize.w * 0.015)}
                        fontWeight="600"
                        style={{ pointerEvents: 'none' }}
                      >
                        {p.label}
                      </text>
                    )}
                  </g>
                );
              })}

              {/* 正在绘制的 polygon */}
              {isDrawing && drawingImageId === image.id && currentPoints.length > 1 && (
                <path
                  d={polygonToSvgPath(currentPoints)}
                  fill={
                    ANNOTATION_COLORS[
                      annotationMode as 'question' | 'answer' | 'correction'
                    ]?.fill || 'rgba(100,100,100,0.2)'
                  }
                  stroke={
                    ANNOTATION_COLORS[
                      annotationMode as 'question' | 'answer' | 'correction'
                    ]?.stroke || '#666'
                  }
                  strokeWidth={2}
                  vectorEffect="non-scaling-stroke"
                  strokeDasharray="6 3"
                  strokeLinejoin="round"
                  className="drawing-polygon"
                  style={{ pointerEvents: 'none' }}
                />
              )}
            </svg>
          )}
        </div>
      </div>
    </div>
  );
}
