import React, { useState } from 'react';

interface Props {
  assetCount: number;
  exporting: boolean;
  onExport: (includeQr: boolean) => void;
  onClose: () => void;
}

const ExcelExportModal: React.FC<Props> = ({ assetCount, exporting, onExport, onClose }) => {
  const [includeQr, setIncludeQr] = useState(false);

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="font-bold text-gray-900 text-base">Excel 다운로드</h3>
            <p className="text-xs text-gray-500 mt-0.5">자산 {assetCount}개를 내보냅니다</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={exporting}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-3 mb-6">
          <p className="text-xs font-medium text-gray-600 mb-2">포함 항목</p>
          <div className="bg-gray-50 rounded-xl p-3 text-xs text-gray-600 space-y-1">
            <p>• 자산명(소분류), 품명, 식별번호, 부서명</p>
            <p>• 분류별 커스텀 필드</p>
          </div>

          <label className="flex items-start gap-3 p-3 rounded-xl border border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors">
            <input
              type="checkbox"
              checked={includeQr}
              onChange={(e) => setIncludeQr(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded text-indigo-600 accent-indigo-600"
            />
            <div>
              <p className="text-sm font-medium text-gray-800">QR 코드 포함</p>
              <p className="text-xs text-gray-500 mt-0.5">QR이 없는 자산은 자동 생성됩니다. 자산 수에 따라 시간이 소요됩니다.</p>
            </div>
          </label>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={exporting}
            className="flex-1 py-2.5 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
          >
            취소
          </button>
          <button
            type="button"
            onClick={() => onExport(includeQr)}
            disabled={exporting}
            className="flex-1 py-2.5 text-sm font-semibold bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
          >
            {exporting ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                생성 중...
              </>
            ) : (
              '다운로드'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExcelExportModal;
