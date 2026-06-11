import React, { useEffect, useState } from 'react';
import * as assetsApi from '../api/assets';
import * as departmentsApi from '../api/departments';
import type { Asset, AssetParams, Category, CategoryRequiredFields, Department, FieldDef } from '../api/types';
import { isCurrencyField, formatCurrency } from '../utils/format';

interface Props {
  editing: Asset | null;
  categories: Category[];
  onClose: () => void;
  onSave: (saved: Asset) => void;
}

const defaultRequired = (): CategoryRequiredFields => ({
  serial_number: false,
  location: false,
  note: false,
});

const AssetFormModal: React.FC<Props> = ({ editing, categories, onClose, onSave }) => {
  const [form, setForm] = useState<AssetParams>({
    name: '', serial_number: '', location: '', note: '', category_pid: '',
    department_pid: '', team_pid: '', manager_name: '', appraised_value: undefined,
  });
  const [appraisedInput, setAppraisedInput] = useState('');
  const [selectedParentPid, setSelectedParentPid] = useState('');
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);

  useEffect(() => {
    departmentsApi.list().then(setDepartments).catch(() => {});
  }, []);

  useEffect(() => {
    if (editing) {
      const parent = categories.find(
        (c) => c.pid === editing.category_pid || c.children.some((ch) => ch.pid === editing.category_pid),
      );
      const parentPid = parent ? parent.pid : '';
      setSelectedParentPid(parentPid);
      setForm({
        name: editing.name,
        serial_number: editing.serial_number ?? '',
        location: editing.location ?? '',
        note: editing.note ?? '',
        category_pid: editing.category_pid ?? '',
        department_pid: editing.department_pid ?? '',
        team_pid: editing.team_pid ?? '',
        manager_name: editing.manager_name ?? '',
        appraised_value: editing.appraised_value || undefined,
      });
      setAppraisedInput(
        editing.appraised_value > 0
          ? editing.appraised_value.toLocaleString('ko-KR')
          : '',
      );
      const fvMap: Record<string, string> = {};
      for (const fv of editing.field_values ?? []) {
        fvMap[fv.field_def_pid] = fv.value ?? '';
      }
      setCustomFieldValues(fvMap);
      setPhotoPreview(editing.photo_url ?? null);
    } else {
      setForm({ name: '', serial_number: '', location: '', note: '', category_pid: '',
        department_pid: '', team_pid: '', manager_name: '', appraised_value: undefined });
      setAppraisedInput('');
      setSelectedParentPid('');
      setCustomFieldValues({});
      setPhotoPreview(null);
    }
    setPhotoFile(null);
    setFormError('');
  }, [editing, categories]);

  const selectedDept = departments.find((d) => d.pid === form.department_pid);
  const teamOptions = selectedDept?.teams ?? [];

  const childCategories = selectedParentPid
    ? (categories.find((c) => c.pid === selectedParentPid)?.children ?? [])
    : [];

  const activeRequiredFields: CategoryRequiredFields = (() => {
    if (!selectedParentPid) return defaultRequired();
    return categories.find((c) => c.pid === selectedParentPid)?.required_fields ?? defaultRequired();
  })();

  const activeFieldDefs: FieldDef[] = (() => {
    if (!selectedParentPid) return [];
    return categories.find((c) => c.pid === selectedParentPid)?.field_defs ?? [];
  })();

  const handleParentChange = (pid: string) => {
    setSelectedParentPid(pid);
    setCustomFieldValues({});
    const parent = categories.find((c) => c.pid === pid);
    if (parent && parent.children.length === 0) {
      setForm((f) => ({ ...f, category_pid: pid }));
    } else {
      setForm((f) => ({ ...f, category_pid: '' }));
    }
  };

  const handleDeptChange = (pid: string) => {
    setForm((f) => ({ ...f, department_pid: pid, team_pid: '' }));
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setPhotoFile(file);
    if (file) setPhotoPreview(URL.createObjectURL(file));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!selectedParentPid) { setFormError('대분류를 선택해주세요.'); return; }
    if (childCategories.length > 0 && !form.category_pid) { setFormError('소분류를 선택해주세요.'); return; }
    if (activeRequiredFields.serial_number && !form.serial_number?.trim()) {
      setFormError('이 분류는 시리얼 번호가 필수입니다.'); return;
    }
    if (activeRequiredFields.location && !form.location?.trim()) {
      setFormError('이 분류는 위치가 필수입니다.'); return;
    }
    if (activeRequiredFields.note && !form.note?.trim()) {
      setFormError('이 분류는 비고가 필수입니다.'); return;
    }
    for (const def of activeFieldDefs) {
      if (def.is_required && !customFieldValues[def.pid]?.trim()) {
        setFormError(`"${def.field_label}" 항목은 필수입니다.`); return;
      }
    }

    setSaving(true);
    try {
      const fieldValuesPayload = activeFieldDefs
        .map((def) => ({ field_def_pid: def.pid, value: customFieldValues[def.pid] || undefined }))
        .filter((fv) => fv.value);

      const rawAppraised = appraisedInput.replace(/,/g, '');
      const appraisedNum = rawAppraised ? Number(rawAppraised) : undefined;

      const params: AssetParams = {
        name: form.name,
        serial_number: form.serial_number || undefined,
        location: form.location || undefined,
        note: form.note || undefined,
        category_pid: form.category_pid || undefined,
        department_pid: form.department_pid || undefined,
        team_pid: form.team_pid || undefined,
        manager_name: form.manager_name || undefined,
        appraised_value: appraisedNum && !isNaN(appraisedNum) ? appraisedNum : 0,
        field_values: fieldValuesPayload,
      };

      let saved: Asset;
      if (editing) {
        saved = await assetsApi.update(editing.pid, params);
      } else {
        saved = await assetsApi.create(params);
      }
      if (photoFile) {
        saved = await assetsApi.uploadPhoto(saved.pid, photoFile);
      }
      onSave(saved);
    } finally {
      setSaving(false);
    }
  };

  const inputCls = (hasError: boolean) =>
    `w-full px-3 py-2.5 border rounded-xl text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors ${
      hasError ? 'border-red-300 bg-red-50' : 'border-gray-200'
    }`;

  const selectCls = `w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors`;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-gray-900">{editing ? '자산 수정' : '자산 등록'}</h3>
            <p className="text-xs text-gray-400 mt-0.5">{editing ? '자산 정보를 수정합니다' : '새 자산을 등록합니다'}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <form onSubmit={handleSave} className="p-6 space-y-4 overflow-y-auto flex-1">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">자산명 *</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              autoFocus
              placeholder="자산 이름을 입력하세요"
              className={inputCls(false)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">분류 *</label>
            <div className="flex gap-2">
              <select
                value={selectedParentPid}
                onChange={(e) => handleParentChange(e.target.value)}
                className={`flex-1 px-3 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-gray-50 focus:bg-white transition-colors ${
                  !selectedParentPid ? 'border-red-300' : 'border-gray-200'
                }`}
              >
                <option value="">대분류 선택 *</option>
                {categories.map((cat) => (
                  <option key={cat.pid} value={cat.pid}>{cat.name}</option>
                ))}
              </select>
              {childCategories.length > 0 && (
                <select
                  value={form.category_pid ?? ''}
                  onChange={(e) => setForm({ ...form, category_pid: e.target.value })}
                  className={`flex-1 px-3 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-gray-50 focus:bg-white transition-colors ${
                    !form.category_pid ? 'border-red-300' : 'border-gray-200'
                  }`}
                >
                  <option value="">소분류 선택 *</option>
                  {childCategories.map((child) => (
                    <option key={child.pid} value={child.pid}>{child.name}</option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {/* 부서 / 팀 */}
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">부서</label>
              <select
                value={form.department_pid ?? ''}
                onChange={(e) => handleDeptChange(e.target.value)}
                className={selectCls}
              >
                <option value="">부서 선택</option>
                {departments.map((d) => (
                  <option key={d.pid} value={d.pid}>{d.name}</option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">팀</label>
              <select
                value={form.team_pid ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, team_pid: e.target.value }))}
                disabled={!form.department_pid || teamOptions.length === 0}
                className={`${selectCls} disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                <option value="">팀 선택</option>
                {teamOptions.map((t) => (
                  <option key={t.pid} value={t.pid}>{t.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* 관리자 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">관리자</label>
            <input
              type="text"
              value={form.manager_name ?? ''}
              onChange={(e) => setForm({ ...form, manager_name: e.target.value })}
              placeholder="담당자 이름"
              className={inputCls(false)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">평가금액</label>
            <input
              type="text"
              inputMode="numeric"
              value={appraisedInput}
              onChange={(e) => {
                const raw = e.target.value.replace(/,/g, '');
                const num = Number(raw);
                if (raw === '' || (!isNaN(num) && raw !== '')) {
                  setAppraisedInput(raw === '' ? '' : num.toLocaleString('ko-KR'));
                }
              }}
              placeholder="0"
              className={inputCls(false)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              시리얼 번호 {activeRequiredFields.serial_number && <span className="text-red-500">*</span>}
            </label>
            <input
              type="text"
              value={form.serial_number ?? ''}
              onChange={(e) => setForm({ ...form, serial_number: e.target.value })}
              placeholder="시리얼 번호"
              className={inputCls(activeRequiredFields.serial_number && !form.serial_number?.trim())}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              위치 {activeRequiredFields.location && <span className="text-red-500">*</span>}
            </label>
            <input
              type="text"
              value={form.location ?? ''}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
              placeholder="위치"
              className={inputCls(activeRequiredFields.location && !form.location?.trim())}
            />
          </div>

          {activeRequiredFields.note && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                비고 <span className="text-red-500">*</span>
              </label>
              <textarea
                value={form.note ?? ''}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
                rows={2}
                placeholder="비고 내용"
                className={`${inputCls(!form.note?.trim())} resize-none`}
              />
            </div>
          )}

          {activeFieldDefs.length > 0 && (
            <div className="border-t border-gray-100 pt-4 space-y-3">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">추가 정보</p>
              {activeFieldDefs.map((def) => {
                const isCurrency = isCurrencyField(def.field_label);
                return (
                  <div key={def.pid}>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      {def.field_label}
                      {def.is_required && <span className="text-red-500 ml-0.5">*</span>}
                    </label>
                    <input
                      type="text"
                      inputMode={isCurrency ? 'numeric' : 'text'}
                      value={isCurrency
                        ? formatCurrency(customFieldValues[def.pid])
                        : (customFieldValues[def.pid] ?? '')}
                      onChange={(e) => {
                        const raw = isCurrency
                          ? e.target.value.replace(/,/g, '')
                          : e.target.value;
                        setCustomFieldValues((prev) => ({ ...prev, [def.pid]: raw }));
                      }}
                      className={inputCls(def.is_required && !customFieldValues[def.pid]?.trim())}
                    />
                  </div>
                );
              })}
            </div>
          )}

          <div className="border-t border-gray-100 pt-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">사진</label>
            {photoPreview && (
              <div className="mb-2 relative w-full bg-gray-50 rounded-xl overflow-hidden border border-gray-200">
                <img
                  src={photoPreview}
                  alt="자산 사진"
                  className="w-full max-h-40 object-contain"
                />
                <button
                  type="button"
                  onClick={() => { setPhotoFile(null); setPhotoPreview(null); }}
                  className="absolute top-2 right-2 w-6 h-6 bg-black/50 text-white rounded-full flex items-center justify-center text-xs hover:bg-black/70 backdrop-blur-sm"
                >
                  ✕
                </button>
              </div>
            )}
            <label className="flex items-center gap-2 px-3 py-2.5 border border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/50 transition-colors">
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span className="text-sm text-gray-500">
                {photoFile ? photoFile.name : '사진 선택 (선택사항)'}
              </span>
              <input type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
            </label>
          </div>

          {formError && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-100 rounded-xl">
              <svg className="w-4 h-4 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm text-red-600">{formError}</p>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 border border-gray-200 text-gray-600 text-sm font-medium rounded-xl hover:bg-gray-50 transition-colors"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-sm"
            >
              {saving ? '저장 중...' : (editing ? '저장' : '등록')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AssetFormModal;
