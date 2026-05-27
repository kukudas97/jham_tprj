import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { useNavigate } from 'react-router-dom';

interface Props {
  onClose: () => void;
}

const SCANNER_ID = 'qr-scanner-container';

const QrScannerModal: React.FC<Props> = ({ onClose }) => {
  const navigate = useNavigate();
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(true);

  useEffect(() => {
    const scanner = new Html5Qrcode(SCANNER_ID);
    scannerRef.current = scanner;

    scanner
      .start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 220, height: 220 } },
        (decodedText) => {
          // QR 코드 값에서 asset pid 추출 (순수 UUID 또는 URL 끝 경로)
          const pid = decodedText.trim().split('/').pop() ?? decodedText.trim();
          scanner.stop().catch(() => {});
          onClose();
          navigate(`/assets/${pid}`);
        },
        () => {},
      )
      .then(() => setStarting(false))
      .catch(() => {
        setError('카메라에 접근할 수 없습니다. 카메라 권한을 허용해 주세요.');
        setStarting(false);
      });

    return () => {
      scanner.stop().catch(() => {});
    };
  }, [navigate, onClose]);

  const handleClose = () => {
    scannerRef.current?.stop().catch(() => {});
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 overflow-hidden">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">QR 코드 스캔</h2>
          <button
            type="button"
            onClick={handleClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 스캐너 영역 */}
        <div className="p-5 space-y-4">
          {error ? (
            <div className="text-center py-8">
              <svg className="w-10 h-10 text-red-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm text-red-600">{error}</p>
            </div>
          ) : (
            <>
              <div id={SCANNER_ID} className="rounded-xl overflow-hidden" />
              {starting && (
                <p className="text-center text-sm text-gray-400">카메라 시작 중...</p>
              )}
              {!starting && (
                <p className="text-center text-xs text-gray-400">
                  자산 QR 코드를 카메라에 맞춰 주세요
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default QrScannerModal;
