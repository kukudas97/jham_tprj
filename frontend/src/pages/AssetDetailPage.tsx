import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import * as assetsApi from '../api/assets';
import * as categoriesApi from '../api/categories';
import type { Asset, Category, Inspection, QrCode } from '../api/types';
import { isCurrencyField, formatCurrency } from '../utils/format';
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
      await assetsApi.addInspection(pid, { inspector_name: inspectorName, note: inspectionNote || undefined, inspection_type: '일반점검' });
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
        <div className="flex items-center justify-center h-full">
          <div className="flex flex-col items-center gap-2 text-gray-400">
            <svg className="w-6 h-6 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span className="text-sm">불러오는 중...</span>
          </div>
        </div>
      </Layout>
    );
  }

  if (!asset) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center h-full gap-3">
          <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center">
            <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          </div>
          <p className="text-sm text-gray-500">자산을 찾을 수 없습니다.</p>
          <button
            type="button"
            onClick={() => navigate('/assets')}
            className="text-sm text-indigo-600 hover:underline"
          >
            목록으로 돌아가기
          </button>
        </div>
      </Layout>
    );
  }

  const categoryLabel = (() => {
    if (!asset.category_name) return null;
    const parent = categories.find((c) => c.children.some((ch) => ch.pid === asset.category_pid));
    return parent ? `${parent.name} > ${asset.category_name}` : asset.category_name;
  })();

  const parentCategory = categories.find(
    (c) => c.pid === asset.category_pid || c.children.some((ch) => ch.pid === asset.category_pid),
  );
  const fieldDefs = parentCategory?.field_defs ?? [];

  return (
    <Layout>
      <div className="p-4 md:p-6 max-w-5xl">
        {/* 뒤로가기 + 수정 버튼 */}
        <div className="flex items-center justify-between mb-5">
          <button
            type="button"
            onClick={() => navigate('/assets')}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            자산 목록
          </button>
          <button
            type="button"
            onClick={() => setShowEditModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 transition-colors shadow-sm"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            수정
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* 자산 정보 */}
          <div className="lg:col-span-2 space-y-5">
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              {/* 사진 영역 */}
              {asset.photo_url ? (
                <div className="relative group bg-gray-50">
                  <img
                    src={asset.photo_url}
                    alt="자산 사진"
                    className="w-full max-h-64 object-contain"
                  />
                  <label className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer bg-black/60 text-white text-xs px-3 py-1.5 rounded-lg backdrop-blur-sm">
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
                    <div className="absolute inset-0 flex items-center justify-center bg-white/70">
                      <span className="text-xs text-gray-500">업로드 중...</span>
                    </div>
                  )}
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center gap-2 h-28 bg-gray-50 cursor-pointer hover:bg-indigo-50/50 transition-colors border-b border-gray-100 group">
                  {uploadingPhoto ? (
                    <span className="text-xs text-gray-400">업로드 중...</span>
                  ) : (
                    <>
                      <div className="w-10 h-10 bg-gray-200 group-hover:bg-indigo-100 rounded-xl flex items-center justify-center transition-colors">
                        <svg className="w-5 h-5 text-gray-400 group-hover:text-indigo-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
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

              {/* 자산 기본 정보 */}
              <div className="p-5">
                <div className="flex items-start justify-between gap-2 mb-4">
                  <h2 className="text-xl font-bold text-gray-900">{asset.name}</h2>
                  {categoryLabel && (
                    <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-100 flex-shrink-0">
                      {categoryLabel}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="bg-gray-50 rounded-xl p-3">
                    <dt className="text-xs text-gray-400 mb-1">식별번호</dt>
                    <dd className="text-gray-800 font-medium font-mono text-xs">{asset.serial_number ?? '-'}</dd>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-3">
                    <dt className="text-xs text-gray-400 mb-1">부서명</dt>
                    <dd className="text-gray-800 font-medium">{asset.location ?? '-'}</dd>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-3">
                    <dt className="text-xs text-gray-400 mb-1">평가금액</dt>
                    <dd className="text-gray-800 font-medium">
                      {asset.appraised_value > 0
                        ? `${asset.appraised_value.toLocaleString('ko-KR')}원`
                        : '-'}
                    </dd>
                  </div>
                  {asset.note && (
                    <div className="col-span-2 bg-gray-50 rounded-xl p-3">
                      <dt className="text-xs text-gray-400 mb-1">비고</dt>
                      <dd className="text-gray-700">{asset.note}</dd>
                    </div>
                  )}
                  {fieldDefs.length > 0
                    ? fieldDefs.map((def) => {
                        const saved = asset.field_values.find((v) => v.field_def_pid === def.pid);
                        return (
                          <div key={def.pid} className="bg-gray-50 rounded-xl p-3">
                            <dt className="text-xs text-gray-400 mb-1">{def.field_label}</dt>
                            <dd className="text-gray-800 font-medium">
                              {isCurrencyField(def.field_label)
                                ? formatCurrency(saved?.value)
                                : (saved?.value ?? '-')}
                            </dd>
                          </div>
                        );
                      })
                    : asset.field_values.map((fv) => (
                        <div key={fv.field_def_pid} className="bg-gray-50 rounded-xl p-3">
                          <dt className="text-xs text-gray-400 mb-1">{fv.field_label}</dt>
                          <dd className="text-gray-800 font-medium">
                            {isCurrencyField(fv.field_label)
                              ? formatCurrency(fv.value)
                              : (fv.value ?? '-')}
                          </dd>
                        </div>
                      ))}
                  <div className="col-span-2 border-t border-gray-100 pt-3 mt-1">
                    <dt className="text-xs text-gray-400 mb-0.5">자산 UUID</dt>
                    <dd className="text-gray-400 font-mono text-xs">{asset.pid}</dd>
                  </div>
                </div>
              </div>
            </div>

            {/* 점검 이력 */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-gray-900">점검 이력</h3>
                  <p className="text-xs text-gray-400 mt-0.5">총 {inspections.length}건</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddInspection(!showAddInspection)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white text-xs font-semibold rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  점검 추가
                </button>
              </div>

              {showAddInspection && (
                <form onSubmit={handleAddInspection} className="mb-4 p-4 bg-indigo-50 rounded-xl border border-indigo-100 space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">점검자 이름 *</label>
                    <input
                      type="text"
                      value={inspectorName}
                      onChange={(e) => setInspectorName(e.target.value)}
                      required
                      autoFocus
                      className="w-full px-3 py-2 border border-indigo-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">점검 내용</label>
                    <textarea
                      value={inspectionNote}
                      onChange={(e) => setInspectionNote(e.target.value)}
                      rows={2}
                      className="w-full px-3 py-2 border border-indigo-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none bg-white"
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
                      className="px-3 py-1.5 text-xs bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                    >
                      {addingInspection ? '저장 중...' : '저장'}
                    </button>
                  </div>
                </form>
              )}

              {inspections.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-gray-400">
                  <svg className="w-8 h-8 mb-2 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  <p className="text-sm">점검 이력이 없습니다</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {inspections.map((ins) => (
                    <div key={ins.pid} className="flex gap-3 p-3 bg-gray-50 rounded-xl">
                      <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold flex-shrink-0">
                        {ins.inspector_name.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
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
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 h-fit">
            <h3 className="font-semibold text-gray-900 mb-4">QR 코드</h3>
            {qr ? (
              <div className="space-y-3">
                <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                  <img
                    src={`/api/qr_codes/image/${qr.image_path.split('/').pop()}`}
                    alt="QR Code"
                    className="w-full rounded-lg"
                  />
                </div>
                <a
                  href={`/api/qr_codes/image/${qr.image_path.split('/').pop()}`}
                  download={`qr-${asset.pid}.png`}
                  className="flex items-center justify-center gap-2 py-2.5 text-sm text-indigo-600 border border-indigo-200 rounded-xl hover:bg-indigo-50 transition-colors font-medium"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  다운로드
                </a>
                <p className="text-xs text-gray-400 text-center">
                  스캔 시 자산 상세 페이지로 이동
                </p>
              </div>
            ) : (
              <div className="text-center">
                <div className="w-full aspect-square bg-gray-50 rounded-xl border border-dashed border-gray-200 flex items-center justify-center mb-4">
                  <svg className="w-12 h-12 text-gray-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                      d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                  </svg>
                </div>
                <p className="text-xs text-gray-400 mb-3">QR 코드가 없습니다</p>
                <button
                  type="button"
                  onClick={handleGetQr}
                  disabled={qrLoading}
                  className="w-full py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors"
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
