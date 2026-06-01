import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as assetsApi from '../api/assets';
import * as categoriesApi from '../api/categories';
import type { Asset, Category, Inspection, InspectionResult, QrCode } from '../api/types';
import { isCurrencyField, formatCurrency } from '../utils/format';
import AssetFormModal from './AssetFormModal';
import InspectionModal from './InspectionModal';

interface Props {
  pid: string | null;
  onClose: () => void;
  onSaved?: (asset: Asset) => void;
}

const RESULT_BADGE: Record<InspectionResult, string> = {
  점검완료: 'bg-emerald-100 text-emerald-700',
  재점검필요: 'bg-amber-100 text-amber-700',
  폐기처리: 'bg-red-100 text-red-700',
  기타: 'bg-gray-100 text-gray-600',
};

const AssetDetailDrawer: React.FC<Props> = ({ pid, onClose, onSaved }) => {
  const [asset, setAsset] = useState<Asset | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [qr, setQr] = useState<QrCode | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [loading, setLoading] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [inspectionModalTarget, setInspectionModalTarget] = useState<Inspection | null | 'new'>(
    undefined as unknown as null,
  );
  const [showInspectionModal, setShowInspectionModal] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const fetchData = useCallback(async (assetPid: string) => {
    setLoading(true);
    setAsset(null);
    setQr(null);
    setInspections([]);
    try {
      const [assetData, inspectionsData, qrData, catData] = await Promise.all([
        assetsApi.get(assetPid),
        assetsApi.listInspections(assetPid),
        assetsApi.getQr(assetPid).catch(() => null),
        categoriesApi.list(),
      ]);
      setAsset(assetData);
      setInspections(inspectionsData);
      setQr(qrData);
      setCategories(catData);
    } finally {
      setLoading(false);
    }
  }, []);

  const reloadInspections = useCallback(async (assetPid: string) => {
    const data = await assetsApi.listInspections(assetPid);
    setInspections(data);
  }, []);

  useEffect(() => {
    if (pid) fetchData(pid);
  }, [pid, fetchData]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !showInspectionModal && !showEditModal) onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose, showInspectionModal, showEditModal]);

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
      onSaved?.(updated);
    } finally {
      setUploadingPhoto(false);
      if (photoInputRef.current) photoInputRef.current.value = '';
    }
  };

  const openNewInspection = () => {
    setInspectionModalTarget(null);
    setShowInspectionModal(true);
  };

  const openEditInspection = (ins: Inspection) => {
    setInspectionModalTarget(ins);
    setShowInspectionModal(true);
  };

  const handleInspectionSaved = () => {
    setShowInspectionModal(false);
    if (pid) reloadInspections(pid);
  };

  const isOpen = !!pid;

  const categoryLabel = (() => {
    if (!asset?.category_name) return null;
    const parent = categories.find((c) => c.children.some((ch) => ch.pid === asset.category_pid));
    return parent ? `${parent.name} > ${asset.category_name}` : asset.category_name;
  })();

  const parentCategory = categories.find(
    (c) => c.pid === asset?.category_pid || c.children.some((ch) => ch.pid === asset?.category_pid),
  );
  const fieldDefs = parentCategory?.field_defs ?? [];

  return (
    <>
      {/* 배경 오버레이 */}
      <div
        className={`fixed inset-0 bg-black/30 z-40 transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />

      {/* 드로어 패널 */}
      <div
        className={`fixed top-0 right-0 h-full w-full sm:w-[520px] bg-white shadow-2xl z-50 flex flex-col transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
          <h2 className="font-semibold text-gray-900 text-base">자산 상세</h2>
          <div className="flex items-center gap-2">
            {asset && (
              <button
                type="button"
                onClick={() => setShowEditModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white text-xs font-semibold rounded-lg hover:bg-indigo-700 transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                수정
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* 본문 */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-48">
              <div className="flex flex-col items-center gap-2 text-gray-400">
                <svg className="w-6 h-6 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span className="text-sm">불러오는 중...</span>
              </div>
            </div>
          ) : !asset ? null : (
            <div className="p-5 space-y-5">
              {/* 자산 기본 정보 */}
              <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                {asset.photo_url ? (
                  <div className="relative group bg-gray-50">
                    <img src={asset.photo_url} alt="자산 사진" className="w-full max-h-52 object-contain" />
                    <label className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer bg-black/60 text-white text-xs px-2.5 py-1 rounded-lg backdrop-blur-sm">
                      사진 변경
                      <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} disabled={uploadingPhoto} />
                    </label>
                    {uploadingPhoto && (
                      <div className="absolute inset-0 flex items-center justify-center bg-white/70">
                        <span className="text-xs text-gray-500">업로드 중...</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center gap-2 h-24 bg-gray-50 cursor-pointer hover:bg-indigo-50/50 transition-colors border-b border-gray-100 group">
                    {uploadingPhoto ? (
                      <span className="text-xs text-gray-400">업로드 중...</span>
                    ) : (
                      <>
                        <div className="w-8 h-8 bg-gray-200 group-hover:bg-indigo-100 rounded-xl flex items-center justify-center transition-colors">
                          <svg className="w-4 h-4 text-gray-400 group-hover:text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                        <span className="text-xs text-gray-400">사진 추가</span>
                      </>
                    )}
                    <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} disabled={uploadingPhoto} />
                  </label>
                )}

                <div className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-4">
                    <h3 className="text-lg font-bold text-gray-900">{asset.name}</h3>
                    {categoryLabel && (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-100 flex-shrink-0">
                        {categoryLabel}
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="bg-gray-50 rounded-xl p-3">
                      <dt className="text-xs text-gray-400 mb-1">식별번호</dt>
                      <dd className="text-gray-800 font-medium font-mono text-xs">{asset.serial_number ?? '-'}</dd>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-3">
                      <dt className="text-xs text-gray-400 mb-1">부서명</dt>
                      <dd className="text-gray-800 font-medium">{asset.department_name ?? '-'}</dd>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-3">
                      <dt className="text-xs text-gray-400 mb-1">팀명</dt>
                      <dd className="text-gray-800 font-medium">{asset.team_name ?? '-'}</dd>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-3">
                      <dt className="text-xs text-gray-400 mb-1">관리자</dt>
                      <dd className="text-gray-800 font-medium">{asset.manager_name ?? '-'}</dd>
                    </div>
                    {asset.location && (
                      <div className="bg-gray-50 rounded-xl p-3">
                        <dt className="text-xs text-gray-400 mb-1">위치</dt>
                        <dd className="text-gray-800 font-medium">{asset.location}</dd>
                      </div>
                    )}
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
                                {isCurrencyField(def.field_label) ? formatCurrency(saved?.value) : (saved?.value ?? '-')}
                              </dd>
                            </div>
                          );
                        })
                      : asset.field_values.map((fv) => (
                          <div key={fv.field_def_pid} className="bg-gray-50 rounded-xl p-3">
                            <dt className="text-xs text-gray-400 mb-1">{fv.field_label}</dt>
                            <dd className="text-gray-800 font-medium">
                              {isCurrencyField(fv.field_label) ? formatCurrency(fv.value) : (fv.value ?? '-')}
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

              {/* QR 코드 */}
              <div className="bg-white rounded-2xl border border-gray-200 p-4">
                <h4 className="font-semibold text-gray-900 mb-3">QR 코드</h4>
                {qr ? (
                  <div className="flex items-center gap-4">
                    <div className="w-28 flex-shrink-0 bg-gray-50 rounded-xl p-2 border border-gray-100">
                      <img src={`/api/qr_codes/image/${qr.image_path.split('/').pop()}`} alt="QR Code" className="w-full rounded" />
                    </div>
                    <div className="flex flex-col gap-2">
                      <p className="text-xs text-gray-400">스캔 시 자산 상세 페이지로 이동</p>
                      <a
                        href={`/api/qr_codes/image/${qr.image_path.split('/').pop()}`}
                        download={`qr-${asset.pid}.png`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50 transition-colors font-medium w-fit"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        다운로드
                      </a>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-4">
                    <div className="w-28 flex-shrink-0 aspect-square bg-gray-50 rounded-xl border border-dashed border-gray-200 flex items-center justify-center">
                      <svg className="w-8 h-8 text-gray-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                          d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                      </svg>
                    </div>
                    <div className="flex flex-col gap-2">
                      <p className="text-xs text-gray-400">QR 코드가 없습니다</p>
                      <button
                        type="button"
                        onClick={handleGetQr}
                        disabled={qrLoading}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white text-xs font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors w-fit"
                      >
                        {qrLoading ? '생성 중...' : 'QR 코드 생성'}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* 점검 이력 */}
              <div className="bg-white rounded-2xl border border-gray-200 p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h4 className="font-semibold text-gray-900">점검 이력</h4>
                    <p className="text-xs text-gray-400 mt-0.5">총 {inspections.length}건</p>
                  </div>
                  <button
                    type="button"
                    onClick={openNewInspection}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white text-xs font-semibold rounded-lg hover:bg-indigo-700 transition-colors"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    점검 추가
                  </button>
                </div>

                {inspections.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-6 text-gray-400">
                    <svg className="w-7 h-7 mb-2 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    <p className="text-sm">점검 이력이 없습니다</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-gray-100">
                          <th className="text-left text-gray-400 font-medium pb-2 pr-3">점검일자</th>
                          <th className="text-left text-gray-400 font-medium pb-2 pr-3">점검유형</th>
                          <th className="text-left text-gray-400 font-medium pb-2 pr-3">점검결과</th>
                          <th className="text-left text-gray-400 font-medium pb-2 pr-3">점검내용</th>
                          <th className="text-left text-gray-400 font-medium pb-2">비고</th>
                        </tr>
                      </thead>
                      <tbody>
                        {inspections.map((ins) => (
                          <tr
                            key={ins.pid}
                            onClick={() => openEditInspection(ins)}
                            className="border-b border-gray-50 hover:bg-indigo-50/40 cursor-pointer transition-colors"
                          >
                            <td className="py-2 pr-3 text-gray-700 whitespace-nowrap">
                              {ins.inspection_date ?? (ins.period_start ? `${ins.period_start} ~ ${ins.period_end}` : '-')}
                            </td>
                            <td className="py-2 pr-3 whitespace-nowrap">
                              <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${ins.inspection_type === '기간점검' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                                {ins.inspection_type}
                              </span>
                            </td>
                            <td className="py-2 pr-3 whitespace-nowrap">
                              {ins.inspection_result ? (
                                <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${RESULT_BADGE[ins.inspection_result]}`}>
                                  {ins.inspection_result}
                                </span>
                              ) : '-'}
                            </td>
                            <td className="py-2 pr-3 text-gray-500 max-w-[80px] truncate">
                              {ins.note ?? '-'}
                            </td>
                            <td className="py-2 text-gray-500 max-w-[80px] truncate">
                              {ins.remarks ?? '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {showEditModal && asset && (
        <AssetFormModal
          editing={asset}
          categories={categories}
          onClose={() => setShowEditModal(false)}
          onSave={(saved) => {
            setAsset(saved);
            setShowEditModal(false);
            onSaved?.(saved);
          }}
        />
      )}

      {showInspectionModal && pid && (
        <InspectionModal
          assetPid={pid}
          inspection={inspectionModalTarget as Inspection | null}
          onClose={() => setShowInspectionModal(false)}
          onSaved={handleInspectionSaved}
        />
      )}
    </>
  );
};

export default AssetDetailDrawer;
