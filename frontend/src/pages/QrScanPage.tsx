import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import * as assetsApi from '../api/assets';
import type { Asset, Inspection } from '../api/types';

const QrScanPage: React.FC = () => {
  const { pid } = useParams<{ pid: string }>();
  const [asset, setAsset] = useState<Asset | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [inspectorName, setInspectorName] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState<Inspection | null>(null);

  useEffect(() => {
    if (!pid) return;
    assetsApi
      .getPublic(pid)
      .then(setAsset)
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [pid]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pid) return;
    setSubmitting(true);
    try {
      const data = await assetsApi.addPublicInspection(pid, inspectorName, note || undefined);
      setSubmitted(data);
      setShowForm(false);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-400 text-sm">불러오는 중...</p>
      </div>
    );
  }

  if (notFound || !asset) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-gray-500 font-medium">자산을 찾을 수 없습니다</p>
          <p className="text-gray-400 text-sm mt-1">QR 코드가 유효하지 않거나 삭제된 자산입니다.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <div className="bg-blue-600 text-white px-4 py-4">
        <h1 className="font-bold text-lg">JHAM 자산 관리</h1>
        <p className="text-blue-200 text-xs mt-0.5">QR 코드로 조회된 자산</p>
      </div>

      <div className="max-w-sm mx-auto p-4 space-y-4">
        {/* 자산 정보 카드 */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <div>
              <h2 className="font-bold text-gray-900 text-lg leading-tight">{asset.name}</h2>
              <p className="text-xs text-gray-400 mt-0.5">자산 정보</p>
            </div>
          </div>

          <dl className="space-y-2 text-sm">
            {asset.serial_number && (
              <div className="flex justify-between">
                <dt className="text-gray-400">시리얼</dt>
                <dd className="text-gray-800 font-medium">{asset.serial_number}</dd>
              </div>
            )}
            {asset.location && (
              <div className="flex justify-between">
                <dt className="text-gray-400">위치</dt>
                <dd className="text-gray-800 font-medium">{asset.location}</dd>
              </div>
            )}
            {asset.note && (
              <div>
                <dt className="text-gray-400 mb-1">비고</dt>
                <dd className="text-gray-700 bg-gray-50 rounded-lg p-2 text-xs">{asset.note}</dd>
              </div>
            )}
          </dl>
        </div>

        {/* 점검 완료 메시지 */}
        {submitted && (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-4 text-center">
            <svg className="w-8 h-8 text-green-500 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <p className="font-semibold text-green-800">점검이 기록되었습니다</p>
            <p className="text-xs text-green-600 mt-0.5">점검자: {submitted.inspector_name}</p>
          </div>
        )}

        {/* 점검 추가 버튼 / 폼 */}
        {!submitted && !showForm && (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="w-full py-3 bg-blue-600 text-white font-semibold rounded-2xl hover:bg-blue-700 transition-colors shadow-sm"
          >
            점검 기록하기
          </button>
        )}

        {!submitted && showForm && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <h3 className="font-semibold text-gray-900 mb-4">점검 기록</h3>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">점검자 이름 *</label>
                <input
                  type="text"
                  value={inspectorName}
                  onChange={(e) => setInspectorName(e.target.value)}
                  required
                  placeholder="이름을 입력하세요"
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">점검 내용</label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="이상 없음, 수리 필요 등..."
                  rows={3}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="flex-1 py-2.5 border border-gray-300 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-50"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-50"
                >
                  {submitting ? '저장 중...' : '저장'}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};

export default QrScanPage;
