import type { ExamData, ExamImage, QuestionAnnotation, Point, AnnotationLocation, AnswerAnnotation, CorrectionAnnotation } from '../types';

const generateId = () => Date.now().toString(36) + Math.random().toString(36).substring(2);

export interface ModelLabel {
  question_id: string;
  question_locations: {
    label: string;
    page: number;
    bbox_2d: [number, number, number, number];
  }[];
  answers: {
    label: string;
    page: number;
    bbox_2d: [number, number, number, number];
  }[];
  corrections: {
    label: string;
    page: number;
    bbox_2d: [number, number, number, number];
  }[];
}

export interface ModelPrediction {
  messages: {
    role: string;
    content: string;
  }[];
  images?: string[];
}

const getImageDimensions = (src: string): Promise<{ width: number; height: number }> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = reject;
    img.src = src;
  });
};

// [xmin, ymin, xmax, ymax]
const bboxToPolygon = (bbox: [number, number, number, number], imgW: number, imgH: number, isNormalized: boolean = true): Point[] => {
  let [xmin, ymin, xmax, ymax] = bbox;
  if (isNormalized) {
    xmin = (xmin / 1000) * imgW;
    ymin = (ymin / 1000) * imgH;
    xmax = (xmax / 1000) * imgW;
    ymax = (ymax / 1000) * imgH;
  }
  return [
    [xmin, ymin],
    [xmax, ymin],
    [xmax, ymax],
    [xmin, ymax],
  ];
};

export const parseModelData = async (jsonText: string): Promise<ExamData[]> => {
  const lines = jsonText.trim().split('\n').filter(line => line.trim().length > 0);
  const examDataList: ExamData[] = [];
  
  for (const line of lines) {
    try {
      const examData: ExamData = { images: [], labels: [] };
      const parsedLine = JSON.parse(line);
      let labelsJson: ModelLabel[] = [];
      let parsedImages: string[] = [];

      // 判断是完整对话格式还是纯标签格式
      if (parsedLine.messages) {
        const assistantMsg = parsedLine.messages.find((m: any) => m.role === 'assistant');
        if (!assistantMsg) continue;
        
        try {
          let contentStr = assistantMsg.content.replace(/```json/g, '').replace(/```/g, '').trim();
          
          // 如果遇到了带有 <bbox> 占位符且外部有 bboxes 数组的格式 (如 val.jsonl)
          if (contentStr.includes('<bbox>') && parsedLine.bboxes) {
            let bboxIndex = 0;
            const bboxes = parsedLine.bboxes[0] || []; // 假设 bboxes 是二维数组 [[...]]
            contentStr = contentStr.replace(/<bbox>/g, () => {
              const bbox = bboxes[bboxIndex++] || [0, 0, 0, 0];
              return JSON.stringify(bbox);
            });
          }
          
          labelsJson = JSON.parse(contentStr);
        } catch (e) {
          console.error("Failed to parse assistant content:", e);
          continue;
        }
        parsedImages = parsedLine.images || [];
      } else if (Array.isArray(parsedLine)) {
        labelsJson = parsedLine;
      } else {
        continue;
      }

      // 处理图片
      const imageOffset = examData.images.length;
      const imageDimensions: { width: number; height: number }[] = [];
      
      if (parsedImages.length > 0) {
        for (const base64 of parsedImages) {
          const imgId = generateId();
          examData.images.push({
            id: imgId,
            url: base64,
            rotation: 0,
            ignored: false,
          });
          try {
            const dims = await getImageDimensions(base64);
            imageDimensions.push(dims);
          } catch {
            imageDimensions.push({ width: 1000, height: 1000 }); // fallback
          }
        }
      }

      // 判断是否是归一化的坐标（如果最大值不超过1000，大概率是归一化）
      let isNormalized = true;
      for (const label of labelsJson) {
        const checkBbox = (bbox: number[]) => {
          if (bbox.some(v => v > 1000)) isNormalized = false;
        };
        label.question_locations?.forEach(loc => checkBbox(loc.bbox_2d));
        label.answers?.forEach(loc => checkBbox(loc.bbox_2d));
        label.corrections?.forEach(loc => checkBbox(loc.bbox_2d));
      }

      // 处理标注
      for (const label of labelsJson) {
        const questionId = label.question_id || generateId();
        
        const mapLocations = (locs: any[]): AnnotationLocation[] => {
          return (locs || []).map(loc => {
            const pageIndex = (loc.page || 1) - 1; // page 是 1-indexed
            const globalImageIndex = imageOffset + pageIndex;
            const imageId = examData.images[globalImageIndex]?.id || generateId();
            const dims = imageDimensions[pageIndex] || { width: 1000, height: 1000 };
            
            return {
              image_id: imageId,
              polygon: bboxToPolygon(loc.bbox_2d, dims.width, dims.height, isNormalized)
            };
          });
        };

        const questionLocs = mapLocations(label.question_locations);
        
        const answers: AnswerAnnotation[] = (label.answers || []).map((ans, idx) => ({
          id: `${questionId}-A${idx}`,
          answer_text: '',
          location: mapLocations([ans])
        }));

        const corrects: CorrectionAnnotation[] = (label.corrections || []).map((corr, idx) => ({
          id: `${questionId}-C${idx}`,
          correct_text: '',
          location: mapLocations([corr])
        }));

        examData.labels.push({
          question_id: questionId,
          question_text: '',
          location: questionLocs,
          answer: answers,
          correct: corrects
        });
      }
      
      examDataList.push(examData);
    } catch (e) {
      console.error("Failed to process line:", e);
    }
  }

  return examDataList;
};