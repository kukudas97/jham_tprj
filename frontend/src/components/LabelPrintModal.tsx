import React, { useRef, useState } from 'react';

interface Props {
  onPrint: (logoDataUrl: string | null) => void;
  onClose: () => void;
  printing: boolean;
}

const LOGO_KEY = 'jham_label_logo';

const LabelPrintModal: React.FC<Props> = ({ onPrint, onClose, printing }) => {
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(
    localStorage.getItem(LOGO_KEY),
  );
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      setLogoDataUrl(result);
      localStorage.setItem(LOGO_KEY, result);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = () => {
    setLogoDataUrl(null);
    localStorage.removeItem(LOGO_KEY);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-gray-900">라벨 인쇄</h3>
            <p className="text-xs text-gray-400 mt-0.5">폼텍 3106 · 현재 필터 기준</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              하단 로고 / 이미지 <span className="text-gray-400 font-normal">(선택)</span>
            </label>

            {logoDataUrl ? (
              <div className="relative border border-gray-200 rounded-xl overflow-hidden bg-gray-50 flex items-center justify-center h-20">
                <img src={logoDataUrl} alt="로고 미리보기" className="max-h-16 max-w-full object-contain" />
                <button
                  type="button"
                  onClick={handleRemoveLogo}
                  className="absolute top-2 right-2 w-6 h-6 bg-black/40 text-white rounded-full flex items-center justify-center text-xs hover:bg-black/60"
                >
                  ✕
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="w-full flex items-center gap-2 px-3 py-3 border border-dashed border-gray-300 rounded-xl text-sm text-gray-500 hover:border-indigo-400 hover:bg-indigo-50/50 transition-colors"
              >
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                이미지 선택 (PNG, JPG)
              </button>
            )}
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />

            {logoDataUrl && (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="mt-2 text-xs text-indigo-600 hover:underline"
              >
                이미지 변경
              </button>
            )}
          </div>

          <p className="text-xs text-gray-400">
            로고는 브라우저에 저장되어 다음에도 유지됩니다.
          </p>
        </div>

        <div className="px-6 pb-6 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 border border-gray-200 text-gray-600 text-sm font-medium rounded-xl hover:bg-gray-50"
          >
            취소
          </button>
          <button
            type="button"
            onClick={() => onPrint(logoDataUrl)}
            disabled={printing}
            className="flex-1 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {printing ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                준비 중...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                인쇄
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default LabelPrintModal;
