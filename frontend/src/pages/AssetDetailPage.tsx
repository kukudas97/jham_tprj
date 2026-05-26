import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import * as assetsApi from '../api/assets';
import type { Asset, Inspection, QrCode } from '../api/types';
import Layout from '../components/Layout';

const AssetDetailPage: React.FC = () => {
  const { pid } = useParams<{ pid: string }>();
  const navigate = useNavigate();
  const [asset, setAsset] = useState<Asset | null>(null);
  const [qr, setQr] = useState<QrCode | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [loading, setLoading] = useState(true);

  const [showAddInspection, setShowAddInspection] = useState(false);
  const [inspectorName, setInspectorName] = useState('');
  const [inspectionNote, setInspectionNote] = useState('');
  const [addingInspection, setAddingInspection] = useState(false);

  const fetchData = useCallback(async () => {
    if (!pid) return;
    try {
      const [assetData, inspectionsData] = await Promise.all([
        assetsApi.get(pid),
        assetsApi.listInspections(pid),
      ]);
      setAsset(assetData);
      setInspections(inspectionsData);
    } finally {
      setLoading(false);
    }
  }, [pid]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleGetQr = async () => {
    if (!pid) return;
    setQrLoading(true);
    try {
      const data = await assetsApi.getQr(pid);
      setQr(data);
    } finally {
      setQrLoading(false);
    }
  };

  const handleAddInspection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pid) return;
    setAddingInspection(true);
    try {
      await assetsApi.addInspection(pid, inspectorName, inspectionNote || undefined);
      setInspectorName('');
      setInspectionNote('');
      setShowAddInspection(false);
      const data = await assetsApi.listInspections(pid);
      setInspections(data);
    } finally {
      setAddingInspection(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-full text-gray-400 text-sm">
          불러오는 중...
        </div>
      </Layout>
    );
  }

  if (!asset) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-full text-gray-400 text-sm">
          자산을 찾을 수 없습니다.
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-6 max-w-4xl">
        {/* 뒤로가기 */}
        <button
          type="button"
          onClick={() => navigate('/assets')}
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          자산 목록
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 자산 정보 */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="text-lg font-bold text-gray-900 mb-4">{asset.name}</h2>
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-gray-400">시리얼 번호</dt>
                  <dd className="text-gray-800 mt-0.5 font-medium">{asset.serial_number ?? '-'}</dd>
                </div>
                <div>
                  <dt className="text-gray-400">위치</dt>
                  <dd className="text-gray-800 mt-0.5 font-medium">{asset.location ?? '-'}</dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-gray-400">비고</dt>
                  <dd className="text-gray-800 mt-0.5">{asset.note ?? '-'}</dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-gray-400">자산 UUID</dt>
                  <dd className="text-gray-500 mt-0.5 font-mono text-xs">{asset.pid}</dd>
                </div>
              </dl>
            </div>

            {/* 점검 이력 */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900">점검 이력</h3>
                <button
                  type="button"
                  onClick={() => setShowAddInspection(!showAddInspection)}
                  className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  점검 추가
                </button>
              </div>

              {/* 점검 추가 폼 */}
              {showAddInspection && (
                <form onSubmit={handleAddInspection} className="mb-4 p-4 bg-blue-50 rounded-lg space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">점검자 이름 *</label>
                    <input
                      type="text"
                      value={inspectorName}
                      onChange={(e) => setInspectorName(e.target.value)}
                      required
                      className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">점검 내용</label>
                    <textarea
                      value={inspectionNote}
                      onChange={(e) => setInspectionNote(e.target.value)}
                      rows={2}
                      className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setShowAddInspection(false)}
                      className="px-3 py-1.5 text-xs text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
                    >
                      취소
                    </button>
                    <button
                      type="submit"
                      disabled={addingInspection}
                      className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                    >
                      {addingInspection ? '저장 중...' : '저장'}
                    </button>
                  </div>
                </form>
              )}

              {inspections.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-6">점검 이력이 없습니다.</p>
              ) : (
                <div className="space-y-2">
                  {inspections.map((ins) => (
                    <div key={ins.pid} className="flex gap-3 p-3 bg-gray-50 rounded-lg">
                      <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold flex-shrink-0">
                        {ins.inspector_name.charAt(0)}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-800">{ins.inspector_name}</p>
                        {ins.note && <p className="text-xs text-gray-500 mt-0.5">{ins.note}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* QR 코드 패널 */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 h-fit">
            <h3 className="font-semibold text-gray-900 mb-4">QR 코드</h3>
            {qr ? (
              <div className="space-y-3">
                <img
                  src={`/api/qr_codes/image/${qr.image_path.split('/').pop()}`}
                  alt="QR Code"
                  className="w-full rounded-lg border border-gray-200"
                />
                <a
                  href={`/api/qr_codes/image/${qr.image_path.split('/').pop()}`}
                  download={`qr-${asset.pid}.png`}
                  className="block text-center py-2 text-sm text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors"
                >
                  다운로드
                </a>
                <p className="text-xs text-gray-400 text-center">
                  QR 스캔 URL: /qr/{asset.pid}
                </p>
              </div>
            ) : (
              <div className="text-center">
                <div className="w-32 h-32 bg-gray-100 rounded-lg mx-auto mb-4 flex items-center justify-center">
                  <svg className="w-10 h-10 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                      d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                  </svg>
                </div>
                <p className="text-xs text-gray-400 mb-3">QR 코드가 없습니다</p>
                <button
                  type="button"
                  onClick={handleGetQr}
                  disabled={qrLoading}
                  className="w-full py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {qrLoading ? '생성 중...' : 'QR 코드 생성'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default AssetDetailPage;
