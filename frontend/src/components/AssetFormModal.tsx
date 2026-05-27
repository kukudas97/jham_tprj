import React, { useEffect, useState } from 'react';
import * as assetsApi from '../api/assets';
import type { Asset, AssetParams, Category, CategoryRequiredFields, FieldDef } from '../api/types';

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
  });
  const [selectedParentPid, setSelectedParentPid] = useState('');
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

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
      });
      const fvMap: Record<string, string> = {};
      for (const fv of editing.field_values ?? []) {
        fvMap[fv.field_def_pid] = fv.value ?? '';
      }
      setCustomFieldValues(fvMap);
      setPhotoPreview(editing.photo_url ?? null);
    } else {
      setForm({ name: '', serial_number: '', location: '', note: '', category_pid: '' });
      setSelectedParentPid('');
      setCustomFieldValues({});
      setPhotoPreview(null);
    }
    setPhotoFile(null);
    setFormError('');
  }, [editing, categories]);

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

      const params: AssetParams = {
        name: form.name,
        serial_number: form.serial_number || undefined,
        location: form.location || undefined,
        note: form.note || undefined,
        category_pid: form.category_pid || undefined,
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

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] flex flex-col">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">{editing ? '자산 수정' : '자산 등록'}</h3>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <form onSubmit={handleSave} className="p-6 space-y-4 overflow-y-auto flex-1">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">자산명 *</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">분류 *</label>
            <div className="flex gap-2">
              <select
                value={selectedParentPid}
                onChange={(e) => handleParentChange(e.target.value)}
                className={`flex-1 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white ${
                  !selectedParentPid ? 'border-red-300' : 'border-gray-300'
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
                  className={`flex-1 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white ${
                    !form.category_pid ? 'border-red-300' : 'border-gray-300'
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

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              시리얼 번호 {activeRequiredFields.serial_number && <span className="text-red-500">*</span>}
            </label>
            <input
              type="text"
              value={form.serial_number ?? ''}
              onChange={(e) => setForm({ ...form, serial_number: e.target.value })}
              className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                activeRequiredFields.serial_number && !form.serial_number?.trim() ? 'border-red-300' : 'border-gray-300'
              }`}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              위치 {activeRequiredFields.location && <span className="text-red-500">*</span>}
            </label>
            <input
              type="text"
              value={form.location ?? ''}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
              className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                activeRequiredFields.location && !form.location?.trim() ? 'border-red-300' : 'border-gray-300'
              }`}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              비고 {activeRequiredFields.note && <span className="text-red-500">*</span>}
            </label>
            <textarea
              value={form.note ?? ''}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
              rows={2}
              className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none ${
                activeRequiredFields.note && !form.note?.trim() ? 'border-red-300' : 'border-gray-300'
              }`}
            />
          </div>

          {activeFieldDefs.length > 0 && (
            <div className="border-t border-gray-100 pt-4 space-y-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">추가 정보</p>
              {activeFieldDefs.map((def) => (
                <div key={def.pid}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {def.field_label}
                    {def.is_required && <span className="text-red-500 ml-0.5">*</span>}
                  </label>
                  <input
                    type="text"
                    value={customFieldValues[def.pid] ?? ''}
                    onChange={(e) =>
                      setCustomFieldValues((prev) => ({ ...prev, [def.pid]: e.target.value }))
                    }
                    className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      def.is_required && !customFieldValues[def.pid]?.trim() ? 'border-red-300' : 'border-gray-300'
                    }`}
                  />
                </div>
              ))}
            </div>
          )}

          <div className="border-t border-gray-100 pt-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">사진</label>
            {photoPreview && (
              <div className="mb-2 relative w-full">
                <img
                  src={photoPreview}
                  alt="자산 사진"
                  className="w-full max-h-40 object-contain rounded-lg border border-gray-200 bg-gray-50"
                />
                <button
                  type="button"
                  onClick={() => { setPhotoFile(null); setPhotoPreview(null); }}
                  className="absolute top-1 right-1 w-6 h-6 bg-black/50 text-white rounded-full flex items-center justify-center text-xs hover:bg-black/70"
                >
                  ✕
                </button>
              </div>
            )}
            <label className="flex items-center gap-2 px-3 py-2 border border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors">
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
            <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{formError}</p>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {saving ? '저장 중...' : '저장'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AssetFormModal;
