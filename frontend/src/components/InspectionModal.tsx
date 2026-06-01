import React, { useEffect, useState } from 'react';
import type {
  Inspection,
  InspectionParams,
  InspectionResult,
  InspectionTemplate,
  InspectionType,
} from '../api/types';
import * as assetsApi from '../api/assets';
import * as inspectionTemplatesApi from '../api/inspectionTemplates';
import InspectionTemplatesModal from './InspectionTemplatesModal';

interface Props {
  assetPid: string;
  inspection: Inspection | null; // null = 신규 등록
  onClose: () => void;
  onSaved: () => void;
}

const INSPECTION_TYPES: InspectionType[] = ['일반점검', '기간점검'];
const INSPECTION_RESULTS: InspectionResult[] = ['점검완료', '재점검필요', '폐기처리', '기타'];

const RESULT_BADGE: Record<InspectionResult, string> = {
  점검완료: 'bg-emerald-100 text-emerald-700',
  재점검필요: 'bg-amber-100 text-amber-700',
  폐기처리: 'bg-red-100 text-red-700',
  기타: 'bg-gray-100 text-gray-600',
};

const InspectionModal: React.FC<Props> = ({ assetPid, inspection, onClose, onSaved }) => {
  const isNew = !inspection;

  const [inspectionType, setInspectionType] = useState<InspectionType>(
    inspection?.inspection_type ?? '일반점검',
  );
  const [inspectionResult, setInspectionResult] = useState<InspectionResult | ''>(
    inspection?.inspection_result ?? '',
  );
  const [inspectorName, setInspectorName] = useState(inspection?.inspector_name ?? '');
  const [note, setNote] = useState(inspection?.note ?? '');
  const [inspectionDate, setInspectionDate] = useState(inspection?.inspection_date ?? '');
  const [periodStart, setPeriodStart] = useState(inspection?.period_start ?? '');
  const [periodEnd, setPeriodEnd] = useState(inspection?.period_end ?? '');
  const [remarks, setRemarks] = useState(inspection?.remarks ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [templates, setTemplates] = useState<InspectionTemplate[]>([]);
  const [selectedTemplateIdx, setSelectedTemplateIdx] = useState('');
  const [showTemplatesManager, setShowTemplatesManager] = useState(false);

  const loadTemplates = () => {
    inspectionTemplatesApi.list().then(setTemplates).catch(() => {});
  };

  useEffect(() => { loadTemplates(); }, []);

  // ESC 키 닫기
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleTemplateSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const idx = e.target.value;
    setSelectedTemplateIdx(idx);
    if (!idx) return;
    const tpl = templates[Number(idx)];
    if (!tpl) return;
    setInspectionType(tpl.inspection_type);
    setInspectionResult(tpl.inspection_result ?? '');
    setInspectorName(tpl.inspector_name ?? '');
    setNote(tpl.note ?? '');
    setRemarks(tpl.remarks ?? '');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!inspectorName.trim()) { setError('점검자를 입력하세요.'); return; }
    if (inspectionResult === '기타' && !remarks.trim()) {
      setError('기타 선택 시 비고를 입력하세요.'); return;
    }
    if (inspectionType === '일반점검' && !inspectionDate) {
      setError('점검일자를 입력하세요.'); return;
    }
    if (inspectionType === '기간점검' && (!periodStart || !periodEnd)) {
      setError('기간점검의 시작일자와 종료일자를 입력하세요.'); return;
    }

    const params: InspectionParams = {
      inspector_name: inspectorName.trim(),
      note: note.trim() || undefined,
      inspection_type: inspectionType,
      inspection_result: inspectionResult || undefined,
      inspection_date: inspectionDate || undefined,
      period_start: inspectionType === '기간점검' ? periodStart || undefined : undefined,
      period_end: inspectionType === '기간점검' ? periodEnd || undefined : undefined,
      remarks: remarks.trim() || undefined,
    };

    setSaving(true);
    try {
      if (isNew) {
        await assetsApi.addInspection(assetPid, params);
      } else {
        await assetsApi.updateInspection(inspection.pid, params);
      }
      onSaved();
    } catch {
      setError('저장 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
    {showTemplatesManager && (
      <InspectionTemplatesModal
        onClose={() => { setShowTemplatesManager(false); loadTemplates(); }}
      />
    )}
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">
            {isNew ? '점검 등록' : '점검 상세'}
          </h2>
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

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* 기본입력사항 선택 */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-gray-500">기본입력사항</label>
              <button
                type="button"
                onClick={() => setShowTemplatesManager(true)}
                className="text-xs text-indigo-500 hover:text-indigo-700 hover:underline transition-colors"
              >
                관리
              </button>
            </div>
            <select
              value={selectedTemplateIdx}
              onChange={handleTemplateSelect}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
            >
              <option value="">{templates.length === 0 ? '저장된 기본입력사항 없음' : '선택하면 자동 입력됩니다'}</option>
              {templates.map((t, i) => (
                <option key={t.pid} value={i}>{t.title}</option>
              ))}
            </select>
          </div>

          {/* 점검유형 */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">점검유형 *</label>
            <div className="flex gap-2">
              {INSPECTION_TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setInspectionType(t)}
                  className={`flex-1 py-2 text-sm font-medium rounded-lg border transition-colors ${
                    inspectionType === t
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* 날짜 입력 */}
          {inspectionType === '일반점검' ? (
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">점검일자 *</label>
              <input
                type="date"
                value={inspectionDate}
                onChange={(e) => setInspectionDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">시작일자 *</label>
                  <input
                    type="date"
                    value={periodStart}
                    onChange={(e) => setPeriodStart(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">종료일자 *</label>
                  <input
                    type="date"
                    value={periodEnd}
                    onChange={(e) => setPeriodEnd(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">점검일자</label>
                <input
                  type="date"
                  value={inspectionDate}
                  onChange={(e) => setInspectionDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="개별 점검 실시일 (선택)"
                />
              </div>
            </>
          )}

          {/* 점검자 */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">점검자 *</label>
            <input
              type="text"
              value={inspectorName}
              onChange={(e) => setInspectorName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="점검자 이름"
            />
          </div>

          {/* 점검내용 */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">점검내용</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              placeholder="점검 내용을 입력하세요"
            />
          </div>

          {/* 점검결과 */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">점검결과</label>
            <div className="flex flex-wrap gap-2">
              {INSPECTION_RESULTS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setInspectionResult(inspectionResult === r ? '' : r)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                    inspectionResult === r
                      ? RESULT_BADGE[r] + ' border-transparent'
                      : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          {/* 비고 */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              비고{inspectionResult === '기타' && <span className="text-red-500 ml-0.5">*</span>}
            </label>
            <textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              placeholder={inspectionResult === '기타' ? '기타 내용을 입력하세요 (필수)' : '비고 사항'}
            />
          </div>

          {error && (
            <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
          )}

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-2 text-sm bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {saving ? '저장 중...' : isNew ? '등록' : '수정'}
            </button>
          </div>
        </form>
      </div>
    </div>
    </>
  );
};

export default InspectionModal;
