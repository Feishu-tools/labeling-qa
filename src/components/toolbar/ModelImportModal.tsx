import React, { useState, useRef } from 'react';
import { X, Upload, FileJson } from 'lucide-react';
import { useAppStore } from '../../store';
import { parseModelData } from '../../utils/model_data_converter';

interface ModelImportModalProps {
  onClose: () => void;
}

export const ModelImportModal: React.FC<ModelImportModalProps> = ({ onClose }) => {
  const [jsonText, setJsonText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const { loadModelImportData, showToast } = useAppStore();

  const handleImport = async (text: string) => {
    if (!text.trim()) {
      showToast('请输入或上传 JSONL/JSON 数据');
      return;
    }
    
    setIsProcessing(true);
    try {
      const dataList = await parseModelData(text);
      if (dataList.length === 0) {
        showToast('未能解析出任何试卷数据');
      } else {
        loadModelImportData(dataList);
        showToast(`成功导入 ${dataList.length} 套试卷`);
        onClose();
      }
    } catch (e) {
      console.error(e);
      showToast('解析数据失败，请检查格式');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const result = event.target?.result;
      if (typeof result === 'string') {
        await handleImport(result);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center">
      <div className="bg-gray-800 rounded-xl shadow-2xl border border-gray-700 w-full max-w-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-700 flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-100 flex items-center gap-2">
            <FileJson className="w-5 h-5 text-blue-400" />
            导入模型推理结果
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white p-1 rounded-md hover:bg-gray-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 flex-1 flex flex-col gap-4">
          <p className="text-sm text-gray-300">
            支持单行或多行 (JSONL) 文本数据。您可以直接将内容粘贴在下方，或者上传 .json / .jsonl 文件。
          </p>
          
          <textarea
            className="w-full h-64 bg-gray-900 text-gray-200 border border-gray-700 rounded-lg p-4 font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
            placeholder={'{"messages": [{"role": "assistant", "content": "[{\\"question_id\\":\\"Q_1\\",...}]"}]}'}
            value={jsonText}
            onChange={(e) => setJsonText(e.target.value)}
            disabled={isProcessing}
          />

          <div className="flex justify-between items-center mt-2">
            <div>
              <input
                type="file"
                accept=".json,.jsonl,.txt"
                className="hidden"
                ref={fileInputRef}
                onChange={handleFileChange}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors text-sm font-medium"
                disabled={isProcessing}
              >
                <Upload className="w-4 h-4" />
                上传文件
              </button>
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="px-5 py-2 text-gray-300 hover:text-white transition-colors font-medium text-sm"
                disabled={isProcessing}
              >
                取消
              </button>
              <button
                onClick={() => handleImport(jsonText)}
                disabled={isProcessing || !jsonText.trim()}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors font-medium text-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isProcessing ? '处理中...' : '确认导入'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
