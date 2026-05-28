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
  const isStartedRef = useRef(false);
  const navigateRef = useRef(navigate);
  const onCloseRef = useRef(onClose);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(true);

  navigateRef.current = navigate;
  onCloseRef.current = onClose;

  useEffect(() => {
    const scanner = new Html5Qrcode(SCANNER_ID);
    scannerRef.current = scanner;
    let mounted = true;

    scanner
      .start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 220, height: 220 } },
        (decodedText) => {
          const pid = decodedText.trim().split('/').pop() ?? decodedText.trim();
          isStartedRef.current = false;
          scanner.stop().catch(() => {});
          onCloseRef.current();
          navigateRef.current(`/assets/${pid}`);
        },
        () => {},
      )
      .then(() => {
        if (mounted) {
          isStartedRef.current = true;
          setStarting(false);
        } else {
          scanner.stop().catch(() => {});
        }
      })
      .catch(() => {
        if (mounted) {
          setError('카메라에 접근할 수 없습니다. 카메라 권한을 허용해 주세요.');
          setStarting(false);
        }
      });

    return () => {
      mounted = false;
      if (isStartedRef.current) {
        isStartedRef.current = false;
        scanner.stop().catch(() => {});
      }
    };
  }, []);

  const handleClose = () => {
    if (isStartedRef.current) {
      isStartedRef.current = false;
      scannerRef.current?.stop().catch(() => {});
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 overflow-hidden">
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

        <div className="p-5 space-y-4">
          {error ? (
            <div className="text-center py-8">
              <svg className="w-10 h-10 text-red-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm text-red-600">{error}</p>
              <button
                type="button"
                onClick={handleClose}
                className="mt-4 px-4 py-2 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200 transition-colors"
              >
                닫기
              </button>
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
