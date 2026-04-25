// ============================================================
// localStorage 自动保存/恢复
// ============================================================
import type { ExamData } from '../types';

const STORAGE_KEY = 'labeling-qa-data';

/**
 * 保存到 localStorage
 */
export function saveToLocalStorage(data: ExamData): void {
  try {
    const json = JSON.stringify(data);
    localStorage.setItem(STORAGE_KEY, json);
  } catch (e) {
    console.error('Failed to save to localStorage:', e);
  }
}

/**
 * 从 localStorage 恢复
 */
export function loadFromLocalStorage(): ExamData | null {
  try {
    const json = localStorage.getItem(STORAGE_KEY);
    if (!json) return null;
    return JSON.parse(json) as ExamData;
  } catch (e) {
    console.error('Failed to load from localStorage:', e);
    return null;
  }
}

/**
 * 清除 localStorage 数据
 */
export function clearLocalStorage(): void {
  localStorage.removeItem(STORAGE_KEY);
}

/**
 * 导出为 JSON 文件下载
 */
export function exportToJsonFile(data: ExamData, filename: string = 'annotations.json'): void {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * 从文件读取 JSON 数据
 */
export function importFromJsonFile(): Promise<ExamData> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) {
        reject(new Error('No file selected'));
        return;
      }
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const raw = JSON.parse(ev.target?.result as string);
          // 兼容处理: 如果 images 是字符串数组，转换为对象数组
          const examData: ExamData = {
            images: (raw.images || []).map((img: string | { id: string; url: string; rotation?: number }, i: number) => {
              if (typeof img === 'string') {
                return { id: `img_${i}`, url: img, rotation: 0 };
              }
              return { ...img, rotation: img.rotation ?? 0 };
            }),
            labels: raw.labels || [],
          };
          resolve(examData);
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsText(file);
    };
    input.click();
  });
}

/**
 * 生成唯一 ID
 */
export function generateId(prefix: string = 'id'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
