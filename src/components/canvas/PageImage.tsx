// ============================================================
// 单页图片组件 — 渲染图片 + SVG polygon overlay
// ============================================================
import { useRef, useCallback, useState, useEffect, useMemo } from 'react';
import { useAppStore } from '../../store';
import type { Point, ExamImage } from '../../types';
import { ANNOTATION_COLORS, ANNOTATION_COLORS_SELECTED } from '../../types';
import { polygonToSvgPath, getClosestEdge } from '../../utils/geometry';
import { RotateCw } from 'lucide-react';

const getCustomCursor = (mode: string) => {
  if (mode === 'select') return 'default';
  const svg = `<svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg"><circle cx="16" cy="16" r="5" fill="#ef4444"/></svg>`;
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
  const [draggedPointInfo, setDraggedPointInfo] = useState<{ id: string, type: 'question'|'answer'|'correction', locIndex?: number, pointIndex: number } | null>(null);
  const [insertPointInfo, setInsertPointInfo] = useState<{ id: string, type: 'question'|'answer'|'correction', locIndex?: number, insertIndex: number, point: Point } | null>(null);
  const [draggedPolygonInfo, setDraggedPolygonInfo] = useState<{ id: string, type: 'question'|'answer'|'correction', locIndex?: number, startPoint: Point, originalPolygon: Point[] } | null>(null);

  const {
    examData,
    annotationMode,
    isDrawing,
    currentPoints,
    hoverPoint,
    drawingImageId,
    selectedQuestionId,
    selectedAnnotationId,
    selectedLocIndex,
    hoveredAnnotationId,
    showLabels,
    startDrawing,
    addDrawingPoint,
    updateHoverPoint,
    finishDrawing,
    rotateImage,
    selectAnnotation,
    setHoveredAnnotation,
    setHoveredImage,
    setAnnotationMode,
    toggleImageIgnored,
    isWPressed,
    detachAnnotationToNewGroup,
    updateAnnotationPolygon,
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
      const svg = containerRef.current?.querySelector('svg.page-svg-overlay') as SVGSVGElement | null;
      if (!svg || imgSize.w === 0) return null;

      // 使用 SVG 内置的矩阵系，能完美兼容任何角度的 CSS transform 旋转和缩放
      const pt = svg.createSVGPoint();
      pt.x = e.clientX;
      pt.y = e.clientY;

      const ctm = svg.getScreenCTM();
      if (!ctm) return null;

      const svgPt = pt.matrixTransform(ctm.inverse());
      return [Math.round(svgPt.x), Math.round(svgPt.y)];
    },
    [imgSize]
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (e.button !== 0) return;
      
      // 只有在画图模式下点击空白处才开始画图或加点
      if (annotationMode !== 'select' && !isWPressed) {
        try {
            e.currentTarget.setPointerCapture(e.pointerId);
          } catch (e) {}
          const point = getImageCoords(e);
          if (point) {
            if (!isDrawing) {
              startDrawing(image.id, point);
            } else if (drawingImageId === image.id) {
              addDrawingPoint(point);
            } else if (currentPoints.length === 0) {
              // 修复串扰：如果按下了快捷键但还没点任何点，鼠标移到了另一张图片上点击，应该切换到这张图片开始画
              startDrawing(image.id, point);
            }
          }
        }
    },
      [getImageCoords, image.id, isDrawing, drawingImageId, currentPoints.length, startDrawing, addDrawingPoint, annotationMode, isWPressed]
    );

  // 收集当前页面的所有 polygon
  const polygons: {
    id: string;
    type: 'question' | 'answer' | 'correction';
    polygon: Point[];
    questionId: string;
    label: string;
    locIndex?: number;
  }[] = useMemo(() => {
    const result: any[] = [];
    examData.labels.forEach((q, qi) => {
      q.location.forEach((loc, locIndex) => {
        if (loc.image_id === image.id) {
          result.push({ id: q.question_id, type: 'question', polygon: loc.polygon, questionId: q.question_id, label: `Q${qi + 1}`, locIndex });
        }
      });
      q.answer.forEach((a, ai) => {
        a.location.forEach((loc) => {
          if (loc.image_id === image.id) {
            result.push({ id: a.id, type: 'answer', polygon: loc.polygon, questionId: q.question_id, label: `Q${qi + 1}-A${ai + 1}` });
          }
        });
      });
      q.correct.forEach((c, ci) => {
        c.location.forEach((loc) => {
          if (loc.image_id === image.id) {
            result.push({ id: c.id, type: 'correction', polygon: loc.polygon, questionId: q.question_id, label: `Q${qi + 1}-C${ci + 1}` });
          }
        });
      });
    });
    const typeOrder = { question: 0, answer: 1, correction: 2 };
    result.sort((a, b) => typeOrder[a.type] - typeOrder[b.type]);
    return result;
  }, [examData.labels, image.id]);

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      const point = getImageCoords(e);
      if (!point) return;

      if (isDrawing && drawingImageId === image.id) {
        updateHoverPoint(point);
        return;
      }

      if (draggedPointInfo) {
        const { id, type, locIndex, pointIndex } = draggedPointInfo;
        const p = polygons.find(p => p.id === id && p.locIndex === locIndex && p.type === type);
        if (p) {
          const newPolygon = [...p.polygon];
          newPolygon[pointIndex] = point;
          updateAnnotationPolygon(id, type, locIndex, newPolygon, false);
        }
        return;
      }

      if (draggedPolygonInfo) {
        const { id, type, locIndex, startPoint, originalPolygon } = draggedPolygonInfo;
        const dx = point[0] - startPoint[0];
        const dy = point[1] - startPoint[1];
        const newPolygon = originalPolygon.map(pt => [pt[0] + dx, pt[1] + dy] as Point);
        updateAnnotationPolygon(id, type, locIndex, newPolygon, false);
        return;
      }

      if (annotationMode === 'select' && selectedAnnotationId) {
        let foundInsert = false;
        for (const p of polygons) {
          if (p.id === selectedAnnotationId && (p.type !== 'question' || selectedLocIndex === p.locIndex || selectedLocIndex === null)) {
            const closest = getClosestEdge(point, p.polygon);
            if (closest && closest.distance < 10) {
              setInsertPointInfo({
                id: p.id,
                type: p.type,
                locIndex: p.locIndex,
                insertIndex: closest.index + 1,
                point: closest.point
              });
              foundInsert = true;
              break;
            }
          }
        }
        if (!foundInsert && insertPointInfo) {
          setInsertPointInfo(null);
        }
      }
    },
    [isDrawing, drawingImageId, image.id, getImageCoords, updateHoverPoint, draggedPointInfo, draggedPolygonInfo, annotationMode, selectedAnnotationId, selectedLocIndex, polygons, insertPointInfo, updateAnnotationPolygon]
  );

  const handlePointerUp = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    if (draggedPointInfo) {
      const { id, type, locIndex } = draggedPointInfo;
      const p = polygons.find(p => p.id === id && p.locIndex === locIndex && p.type === type);
      if (p) {
        updateAnnotationPolygon(id, type, locIndex, p.polygon, true);
      }
      setDraggedPointInfo(null);
      try { (e.target as Element).releasePointerCapture(e.pointerId); } catch(e) {}
    }
    if (draggedPolygonInfo) {
      const { id, type, locIndex } = draggedPolygonInfo;
      const p = polygons.find(p => p.id === id && p.locIndex === locIndex && p.type === type);
      if (p) {
        updateAnnotationPolygon(id, type, locIndex, p.polygon, true);
      }
      setDraggedPolygonInfo(null);
      try { (e.target as Element).releasePointerCapture(e.pointerId); } catch(e) {}
    }
  }, [draggedPointInfo, draggedPolygonInfo, polygons, updateAnnotationPolygon]);

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (isDrawing && drawingImageId === image.id) {
        e.stopPropagation();
        finishDrawing();
        setAnnotationMode('select');
      }
    },
    [isDrawing, drawingImageId, image.id, finishDrawing, setAnnotationMode]
  );

  // 获取当前悬停的多边形所属的题目 ID
  const hoveredQuestionId = useMemo(() => {
    if (!hoveredAnnotationId) return null;
    for (const q of examData.labels) {
      if (q.question_id === hoveredAnnotationId) return q.question_id;
      if (q.answer.some(a => a.id === hoveredAnnotationId)) return q.question_id;
      if (q.correct.some(c => c.id === hoveredAnnotationId)) return q.question_id;
    }
    return null;
  }, [hoveredAnnotationId, examData.labels]);

  // 判断是否是旋转了 90° 或 270° — 需要交换宽高
  const isRotated90 = image.rotation === 90 || image.rotation === 270;

  // 旋转样式：如果旋转了 90 度，应用缩放使其视觉大小完美契合 wrapper 容器，防止溢出或被遮挡
  const scale = isRotated90 && imgSize.h ? imgSize.w / imgSize.h : 1;
  const rotationStyle: React.CSSProperties = {
    transform: `rotate(${image.rotation}deg) scale(${scale})`,
  };

  return (
    <div
      className="page-image-container"
      ref={containerRef}
      onMouseEnter={() => {
        setIsHovered(true);
        setHoveredImage(image.id);
      }}
      onMouseLeave={() => {
        setIsHovered(false);
        setHoveredImage(null);
      }}
      data-page-index={index}
    >
      {/* 页码标签 */}
      <div className="page-number-badge">{index + 1}</div>

      {/* 作废图片勾选框 */}
      <label
        className="image-ignore-checkbox"
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <input
          type="checkbox"
          checked={!!image.ignored}
          onChange={() => toggleImageIgnored(image.id)}
        />
        <span>{image.ignored ? '已作废' : '作废该页'}</span>
      </label>

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
        className={`page-image-wrapper ${image.ignored ? 'page-image-ignored' : ''}`}
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
                onDoubleClick={handleDoubleClick}
              style={{
                touchAction: 'none',
                cursor: isWPressed ? 'pointer' : isDrawing ? getCustomCursor(annotationMode) : 'default',
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
              {polygons.map((p, polygonIndex) => {
                // 判断当前多边形是否属于被选中的题目组
                const isGroupSelected = selectedQuestionId === p.questionId;
                
                // 判断当前多边形本身是否被精确选中 (题目需要匹配 locIndex)
                const isSelected = selectedAnnotationId === p.id && (p.type !== 'question' || selectedLocIndex === p.locIndex || selectedLocIndex === null);
                // 判断当前多边形是否属于被悬停的题目组
                const isHoveredGroup = hoveredQuestionId === p.questionId;
                
                // 如果当前多边形本身被选中，使用选中颜色；
                // 否则，如果它所在的题目组被选中，也给予一定的亮度/颜色加成；
                // 如果都没选中，使用基础颜色。
                let colors = ANNOTATION_COLORS[p.type];
                if (isSelected) {
                  colors = {
                    ...ANNOTATION_COLORS_SELECTED[p.type],
                    label: ANNOTATION_COLORS[p.type].label
                  };
                } else if (isGroupSelected || isHoveredGroup) {
                  // 同组高亮
                  colors = {
                    fill: ANNOTATION_COLORS_SELECTED[p.type].fill.replace(/[\d.]+\)$/, '0.35)'), 
                    stroke: ANNOTATION_COLORS_SELECTED[p.type].stroke,
                    label: ANNOTATION_COLORS[p.type].label
                  };
                } else {
                  // 未选中且未悬停，置为灰色
                  colors = {
                    fill: 'rgba(93, 94, 96, 0.22)', // tailwind gray-400
                    stroke: 'rgba(85, 89, 94, 0.6)',
                    label: 'rgba(48, 54, 64, 0.8)'
                  };
                }

                return (
                  <g key={`${p.id}-loc${polygonIndex}`}>
                    <path
                      d={polygonToSvgPath(p.polygon)}
                      fill={colors.fill}
                      stroke={colors.stroke}
                      strokeWidth={isSelected || isHoveredGroup ? 3 : 1.5}
                      vectorEffect="non-scaling-stroke"
                      strokeLinejoin="round"
                      className={`polygon-path ${isSelected ? 'polygon-selected' : ''} ${isHoveredGroup ? 'polygon-hovered' : ''}`}
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        
                        // 处理按下 W 键的分离逻辑
                        if (isWPressed) {
                          detachAnnotationToNewGroup(p.id, p.type, p.questionId, p.locIndex);
                          return;
                        }

                        // 只有在选择模式下，点击已有的标注才会被选中
                        if (annotationMode === 'select') {
                          selectAnnotation(p.id, p.type, p.locIndex);
                          
                          if (isSelected) {
                            const point = getImageCoords(e);
                            if (point) {
                              try { e.currentTarget.setPointerCapture(e.pointerId); } catch(e) {}
                              setDraggedPolygonInfo({
                                id: p.id,
                                type: p.type,
                                locIndex: p.locIndex,
                                startPoint: point,
                                originalPolygon: [...p.polygon]
                              });
                            }
                          }
                        } else {
                          // 在画图模式下，点击已有标注框等同于在画布上打点
                          const point = getImageCoords(e);
                          if (point) {
                            if (!isDrawing) {
                              startDrawing(image.id, point);
                            } else if (drawingImageId === image.id) {
                              addDrawingPoint(point);
                            }
                          }
                        }
                      }}
                      onMouseEnter={() => {
                        if (annotationMode === 'select' || isWPressed) setHoveredAnnotation(p.id);
                      }}
                      onMouseLeave={() => {
                        if (annotationMode === 'select' || isWPressed) setHoveredAnnotation(null);
                      }}
                      style={{ pointerEvents: (annotationMode === 'select' || isWPressed) ? 'all' : 'none' }}
                    />
                    {/* Label */}
                    {p.polygon.length > 0 && showLabels && (
                      <text
                        x={p.polygon[0][0] + 4}
                        y={p.polygon[0][1] - 6}
                        className="polygon-label"
                        fill={colors.label}
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

              {/* 选中状态下的多边形编辑锚点 */}
              {annotationMode === 'select' && selectedAnnotationId && polygons
                .filter(p => p.id === selectedAnnotationId && (p.type !== 'question' || selectedLocIndex === p.locIndex || selectedLocIndex === null))
                .map(p => (
                  <g key={`edit-${p.id}-${p.locIndex}`}>
                    {p.polygon.map((pt, i) => (
                      <circle
                        key={`pt-${i}`}
                        cx={pt[0]}
                        cy={pt[1]}
                        r={4}
                        fill="white"
                        stroke={ANNOTATION_COLORS_SELECTED[p.type].stroke}
                        strokeWidth={2}
                        vectorEffect="non-scaling-stroke"
                        style={{ cursor: 'move', pointerEvents: 'all' }}
                        onPointerDown={(e) => {
                          e.stopPropagation();
                          try { e.currentTarget.setPointerCapture(e.pointerId); } catch(e) {}
                          setDraggedPointInfo({
                            id: p.id,
                            type: p.type,
                            locIndex: p.locIndex,
                            pointIndex: i
                          });
                        }}
                      />
                    ))}
                    {insertPointInfo && insertPointInfo.id === p.id && insertPointInfo.locIndex === p.locIndex && (
                      <circle
                        cx={insertPointInfo.point[0]}
                        cy={insertPointInfo.point[1]}
                        r={4}
                        fill="white"
                        stroke={ANNOTATION_COLORS_SELECTED[p.type].stroke}
                        strokeWidth={2}
                        vectorEffect="non-scaling-stroke"
                        strokeDasharray="2 2"
                        style={{ cursor: 'pointer', pointerEvents: 'all' }}
                        onPointerDown={(e) => {
                          e.stopPropagation();
                          try { e.currentTarget.setPointerCapture(e.pointerId); } catch(e) {}
                          const newPolygon = [...p.polygon];
                          newPolygon.splice(insertPointInfo.insertIndex, 0, insertPointInfo.point);
                          updateAnnotationPolygon(p.id, p.type, p.locIndex, newPolygon, false);
                          setDraggedPointInfo({
                            id: p.id,
                            type: p.type,
                            locIndex: p.locIndex,
                            pointIndex: insertPointInfo.insertIndex
                          });
                          setInsertPointInfo(null);
                        }}
                      />
                    )}
                  </g>
                ))}

              {/* 正在绘制的 polygon */}
              {isDrawing && drawingImageId === image.id && currentPoints.length > 0 && (
                <path
                  d={polygonToSvgPath(hoverPoint ? [...currentPoints, hoverPoint] : currentPoints)}
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
              {/* 绘制中的顶点提示 */}
              {isDrawing && drawingImageId === image.id && currentPoints.map((pt, i) => (
                <circle
                  key={i}
                  cx={pt[0]}
                  cy={pt[1]}
                  r={3}
                  fill="white"
                  stroke={ANNOTATION_COLORS[annotationMode as 'question' | 'answer' | 'correction']?.stroke || '#666'}
                  strokeWidth={2}
                  vectorEffect="non-scaling-stroke"
                  style={{ pointerEvents: 'none' }}
                />
              ))}
            </svg>
          )}
        </div>
      </div>
    </div>
  );
}
