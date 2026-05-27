import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import * as assetsApi from '../api/assets';
import * as categoriesApi from '../api/categories';
import type { Asset, Category, Inspection, QrCode } from '../api/types';
import Layout from '../components/Layout';
import AssetFormModal from '../components/AssetFormModal';

const AssetDetailPage: React.FC = () => {
  const { pid } = useParams<{ pid: string }>();
  const navigate = useNavigate();
  const [asset, setAsset] = useState<Asset | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [qr, setQr] = useState<QrCode | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);

  const [showAddInspection, setShowAddInspection] = useState(false);
  const [inspectorName, setInspectorName] = useState('');
  const [inspectionNote, setInspectionNote] = useState('');
  const [addingInspection, setAddingInspection] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const fetchData = useCallback(async () => {
    if (!pid) return;
    try {
      const [assetData, inspectionsData, qrData, catData] = await Promise.all([
        assetsApi.get(pid),
        assetsApi.listInspections(pid),
        assetsApi.getQr(pid).catch(() => null),
        categoriesApi.list(),
      ]);
      setAsset(assetData);
      setInspections(inspectionsData);
      setQr(qrData);
      setCategories(catData);
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

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !pid) return;
    setUploadingPhoto(true);
    try {
      const updated = await assetsApi.uploadPhoto(pid, file);
      setAsset(updated);
    } finally {
      setUploadingPhoto(false);
      if (photoInputRef.current) photoInputRef.current.value = '';
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
      <div className="p-4 md:p-6 max-w-4xl">
        {/* 뒤로가기 + 수정 버튼 */}
        <div className="flex items-center justify-between mb-4">
          <button
            type="button"
            onClick={() => navigate('/assets')}
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            자산 목록
          </button>
          <button
            type="button"
            onClick={() => setShowEditModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            수정
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 자산 정보 */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="text-lg font-bold text-gray-900 mb-4">{asset.name}</h2>

              {/* 사진 */}
              <div className="mb-4">
                {asset.photo_url ? (
                  <div className="relative group">
                    <img
                      src={asset.photo_url}
                      alt="자산 사진"
                      className="w-full max-h-56 object-contain rounded-lg border border-gray-200 bg-gray-50"
                    />
                    <label className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer bg-black/60 text-white text-xs px-2 py-1 rounded-lg">
                      사진 변경
                      <input
                        ref={photoInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handlePhotoUpload}
                        disabled={uploadingPhoto}
                      />
                    </label>
                    {uploadingPhoto && (
                      <div className="absolute inset-0 flex items-center justify-center bg-white/70 rounded-lg">
                        <span className="text-xs text-gray-500">업로드 중...</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center gap-2 h-24 border border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors">
                    {uploadingPhoto ? (
                      <span className="text-xs text-gray-400">업로드 중...</span>
                    ) : (
                      <>
                        <svg className="w-6 h-6 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <span className="text-xs text-gray-400">사진 추가</span>
                      </>
                    )}
                    <input
                      ref={photoInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handlePhotoUpload}
                      disabled={uploadingPhoto}
                    />
                  </label>
                )}
              </div>

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
                {asset.category_name && (
                  <div className="col-span-2">
                    <dt className="text-gray-400">분류</dt>
                    <dd className="mt-0.5">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700">
                        {asset.category_name}
                      </span>
                    </dd>
                  </div>
                )}
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
                  QR 스캔 시 자산 상세 페이지로 이동합니다
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

      {showEditModal && (
        <AssetFormModal
          editing={asset}
          categories={categories}
          onClose={() => setShowEditModal(false)}
          onSave={(saved) => {
            setAsset(saved);
            setShowEditModal(false);
          }}
        />
      )}
    </Layout>
  );
};

export default AssetDetailPage;
