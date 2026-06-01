import React, { useEffect, useState } from 'react';
import type { InspectionResult, InspectionTemplate, InspectionTemplateParams, InspectionType } from '../api/types';
import * as inspectionTemplatesApi from '../api/inspectionTemplates';

interface Props {
  onClose: () => void;
}

const INSPECTION_TYPES: InspectionType[] = ['일반점검', '기간점검'];
const INSPECTION_RESULTS: InspectionResult[] = ['점검완료', '재점검필요', '폐기처리', '기타'];

const RESULT_BADGE: Record<InspectionResult, string> = {
  점검완료: 'bg-emerald-100 text-emerald-700',
  재점검필요: 'bg-amber-100 text-amber-700',
  폐기처리: 'bg-red-100 text-red-700',
  기타: 'bg-gray-100 text-gray-600',
};

const emptyForm = (): InspectionTemplateParams => ({
  title: '',
  inspection_type: '일반점검',
  inspection_result: undefined,
  inspector_name: '',
  note: '',
  remarks: '',
  sort_order: 0,
});

const InspectionTemplatesModal: React.FC<Props> = ({ onClose }) => {
  const [templates, setTemplates] = useState<InspectionTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<InspectionTemplate | null | 'new'>(null);
  const [form, setForm] = useState<InspectionTemplateParams>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const reload = async () => {
    setLoading(true);
    try {
      const data = await inspectionTemplatesApi.list();
      setTemplates(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { reload(); }, []);

  const openNew = () => {
    setForm(emptyForm());
    setError('');
    setEditing('new');
  };

  const openEdit = (tpl: InspectionTemplate) => {
    setForm({
      title: tpl.title,
      inspection_type: tpl.inspection_type,
      inspection_result: tpl.inspection_result ?? undefined,
      inspector_name: tpl.inspector_name ?? '',
      note: tpl.note ?? '',
      remarks: tpl.remarks ?? '',
      sort_order: tpl.sort_order,
    });
    setError('');
    setEditing(tpl);
  };

  const handleDelete = async (tpl: InspectionTemplate) => {
    if (!confirm(`"${tpl.title}" 기본입력사항을 삭제할까요?`)) return;
    await inspectionTemplatesApi.remove(tpl.pid);
    reload();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!form.title.trim()) { setError('이름을 입력하세요.'); return; }
    setSaving(true);
    try {
      const params: InspectionTemplateParams = {
        ...form,
        title: form.title.trim(),
        inspector_name: form.inspector_name?.trim() || undefined,
        note: form.note?.trim() || undefined,
        remarks: form.remarks?.trim() || undefined,
      };
      if (editing === 'new') {
        await inspectionTemplatesApi.create(params);
      } else if (editing) {
        await inspectionTemplatesApi.update(editing.pid, params);
      }
      setEditing(null);
      reload();
    } catch {
      setError('저장 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
          <h2 className="font-semibold text-gray-900">기본입력사항 관리</h2>
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

        <div className="flex-1 overflow-y-auto">
          {/* 폼 영역 */}
          {editing !== null && (
            <form onSubmit={handleSubmit} className="p-5 border-b border-gray-100 bg-gray-50/60 space-y-3">
              <p className="text-sm font-medium text-gray-700">
                {editing === 'new' ? '새 기본입력사항 추가' : '기본입력사항 수정'}
              </p>

              {/* 이름 */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">이름 *</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="예: 연간 정기점검"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* 점검유형 */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">점검유형</label>
                <div className="flex gap-2">
                  {INSPECTION_TYPES.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, inspection_type: t }))}
                      className={`flex-1 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                        form.inspection_type === t
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* 점검결과 */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">점검결과</label>
                <div className="flex flex-wrap gap-1.5">
                  {INSPECTION_RESULTS.map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, inspection_result: f.inspection_result === r ? undefined : r }))}
                      className={`px-2.5 py-1 text-xs font-medium rounded-lg border transition-colors ${
                        form.inspection_result === r
                          ? RESULT_BADGE[r] + ' border-transparent'
                          : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              {/* 점검자 이름 */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">점검자 이름</label>
                <input
                  type="text"
                  value={form.inspector_name ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, inspector_name: e.target.value }))}
                  placeholder="기본 점검자 이름"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* 점검내용 */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">점검내용</label>
                <textarea
                  value={form.note ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                  placeholder="기본 점검 내용"
                />
              </div>

              {/* 비고 */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">비고</label>
                <textarea
                  value={form.remarks ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, remarks: e.target.value }))}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                  placeholder="기본 비고 내용"
                />
              </div>

              {error && <p className="text-xs text-red-500">{error}</p>}

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setEditing(null)}
                  className="flex-1 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-2 text-sm bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                >
                  {saving ? '저장 중...' : '저장'}
                </button>
              </div>
            </form>
          )}

          {/* 목록 */}
          <div className="p-5 space-y-2">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-gray-500">저장된 기본입력사항을 점검 등록 시 불러올 수 있습니다.</p>
              <button
                type="button"
                onClick={openNew}
                className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded-lg hover:bg-indigo-700 transition-colors flex-shrink-0"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                추가
              </button>
            </div>

            {loading ? (
              <p className="text-center text-sm text-gray-400 py-8">불러오는 중...</p>
            ) : templates.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-gray-400">
                <svg className="w-8 h-8 mb-2 text-gray-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                <p className="text-sm">저장된 기본입력사항이 없습니다</p>
                <p className="text-xs mt-1">위의 추가 버튼으로 등록하세요</p>
              </div>
            ) : (
              templates.map((tpl) => (
                <div
                  key={tpl.pid}
                  className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800">{tpl.title}</p>
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${tpl.inspection_type === '기간점검' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                        {tpl.inspection_type}
                      </span>
                      {tpl.inspection_result && (
                        <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${RESULT_BADGE[tpl.inspection_result]}`}>
                          {tpl.inspection_result}
                        </span>
                      )}
                    </div>
                    {(tpl.inspector_name || tpl.note || tpl.remarks) && (
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-xs text-gray-400">
                        {tpl.inspector_name && <span className="truncate max-w-[120px]">점검자: {tpl.inspector_name}</span>}
                        {tpl.note && <span className="truncate max-w-[120px]">내용: {tpl.note}</span>}
                        {tpl.remarks && <span className="truncate max-w-[120px]">비고: {tpl.remarks}</span>}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => openEdit(tpl)}
                      className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                      title="수정"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(tpl)}
                      className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      title="삭제"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default InspectionTemplatesModal;
