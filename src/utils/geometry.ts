// ============================================================
// 几何工具函数
// ============================================================
import type { Point } from '../types';

/**
 * Douglas-Peucker 多边形简化算法
 * 减少采样点数量，保持形状特征
 */
export function simplifyPolygon(points: Point[], tolerance: number = 2): Point[] {
  if (points.length <= 3) return points;

  // 找到距离首尾连线最远的点
  const first = points[0];
  const last = points[points.length - 1];
  let maxDist = 0;
  let maxIndex = 0;

  for (let i = 1; i < points.length - 1; i++) {
    const dist = perpendicularDistance(points[i], first, last);
    if (dist > maxDist) {
      maxDist = dist;
      maxIndex = i;
    }
  }

  if (maxDist > tolerance) {
    const left = simplifyPolygon(points.slice(0, maxIndex + 1), tolerance);
    const right = simplifyPolygon(points.slice(maxIndex), tolerance);
    return [...left.slice(0, -1), ...right];
  }

  return [first, last];
}

/** 点到线段的垂直距离 */
function perpendicularDistance(point: Point, lineStart: Point, lineEnd: Point): number {
  const dx = lineEnd[0] - lineStart[0];
  const dy = lineEnd[1] - lineStart[1];

  if (dx === 0 && dy === 0) {
    return Math.hypot(point[0] - lineStart[0], point[1] - lineStart[1]);
  }

  const t = ((point[0] - lineStart[0]) * dx + (point[1] - lineStart[1]) * dy) / (dx * dx + dy * dy);
  const clampedT = Math.max(0, Math.min(1, t));
  const projX = lineStart[0] + clampedT * dx;
  const projY = lineStart[1] + clampedT * dy;

  return Math.hypot(point[0] - projX, point[1] - projY);
}

/**
 * 射线法判断点是否在多边形内
 */
export function isPointInPolygon(point: Point, polygon: Point[]): boolean {
  if (polygon.length < 3) return false;

  let inside = false;
  const [px, py] = point;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];

    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }

  return inside;
}

/**
 * 获取多边形的边界框
 */
export function getPolygonBounds(polygon: Point[]): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
} {
  if (polygon.length === 0) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 };
  }

  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;

  for (const [x, y] of polygon) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }

  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
}

/**
 * 计算两点之间的距离
 */
export function distanceBetweenPoints(a: Point, b: Point): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

/**
 * 生成 polygon SVG path 字符串
 */
export function polygonToSvgPath(polygon: Point[]): string {
  if (polygon.length === 0) return '';
  const parts = polygon.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0]},${p[1]}`);
  return parts.join(' ') + ' Z';
}
