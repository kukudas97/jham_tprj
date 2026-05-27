import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as assetsApi from '../api/assets';
import * as categoriesApi from '../api/categories';
import type { Asset, AssetParams, Category, CategoryRequiredFields, FieldDef } from '../api/types';
import Layout from '../components/Layout';

const defaultRequired = (): CategoryRequiredFields => ({
  serial_number: false,
  location: false,
  note: false,
});

const AssetsPage: React.FC = () => {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCategoryPid, setFilterCategoryPid] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Asset | null>(null);
  const [form, setForm] = useState<AssetParams>({ name: '', serial_number: '', location: '', note: '', category_pid: '' });
  const [selectedParentPid, setSelectedParentPid] = useState('');
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const navigate = useNavigate();

  const fetchAll = async () => {
    try {
      const [assetData, catData] = await Promise.all([assetsApi.list(), categoriesApi.list()]);
      setAssets(assetData);
      setCategories(catData);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  const childCategories = selectedParentPid
    ? (categories.find((c) => c.pid === selectedParentPid)?.children ?? [])
    : [];

  const activeRequiredFields: CategoryRequiredFields = (() => {
    if (!selectedParentPid) return defaultRequired();
    const parent = categories.find((c) => c.pid === selectedParentPid);
    return parent?.required_fields ?? defaultRequired();
  })();

  const activeFieldDefs: FieldDef[] = (() => {
    if (!selectedParentPid) return [];
    const parent = categories.find((c) => c.pid === selectedParentPid);
    return parent?.field_defs ?? [];
  })();

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', serial_number: '', location: '', note: '', category_pid: '' });
    setSelectedParentPid('');
    setCustomFieldValues({});
    setFormError('');
    setPhotoFile(null);
    setPhotoPreview(null);
    setShowModal(true);
  };

  const openEdit = (asset: Asset) => {
    setEditing(asset);
    const parent = categories.find(
      (c) => c.pid === asset.category_pid || c.children.some((ch) => ch.pid === asset.category_pid),
    );
    const isChild = parent?.children.some((ch) => ch.pid === asset.category_pid) ?? false;
    const parentPid = parent ? (isChild ? parent.pid : parent.pid) : '';
    setSelectedParentPid(parentPid);
    setForm({
      name: asset.name,
      serial_number: asset.serial_number ?? '',
      location: asset.location ?? '',
      note: asset.note ?? '',
      category_pid: asset.category_pid ?? '',
    });
    const fvMap: Record<string, string> = {};
    for (const fv of asset.field_values ?? []) {
      fvMap[fv.field_def_pid] = fv.value ?? '';
    }
    setCustomFieldValues(fvMap);
    setFormError('');
    setPhotoFile(null);
    setPhotoPreview(asset.photo_url ?? null);
    setShowModal(true);
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setPhotoFile(file);
    if (file) {
      const url = URL.createObjectURL(file);
      setPhotoPreview(url);
    }
  };

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

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!selectedParentPid) {
      setFormError('대분류를 선택해주세요.');
      return;
    }
    if (childCategories.length > 0 && !form.category_pid) {
      setFormError('소분류를 선택해주세요.');
      return;
    }

    if (activeRequiredFields.serial_number && !form.serial_number?.trim()) {
      setFormError('이 분류는 시리얼 번호가 필수입니다.');
      return;
    }
    if (activeRequiredFields.location && !form.location?.trim()) {
      setFormError('이 분류는 위치가 필수입니다.');
      return;
    }
    if (activeRequiredFields.note && !form.note?.trim()) {
      setFormError('이 분류는 비고가 필수입니다.');
      return;
    }

    // validate required custom fields
    for (const def of activeFieldDefs) {
      if (def.is_required && !customFieldValues[def.pid]?.trim()) {
        setFormError(`"${def.field_label}" 항목은 필수입니다.`);
        return;
      }
    }

    setSaving(true);
    try {
      const fieldValuesPayload = activeFieldDefs
        .map((def) => ({
          field_def_pid: def.pid,
          value: customFieldValues[def.pid] || undefined,
        }))
        .filter((fv) => fv.value);

      const params: AssetParams = {
        name: form.name,
        serial_number: form.serial_number || undefined,
        location: form.location || undefined,
        note: form.note || undefined,
        category_pid: form.category_pid || undefined,
        field_values: fieldValuesPayload,
      };
      let saved: import('../api/types').Asset;
      if (editing) {
        saved = await assetsApi.update(editing.pid, params);
      } else {
        saved = await assetsApi.create(params);
      }
      if (photoFile) {
        await assetsApi.uploadPhoto(saved.pid, photoFile);
      }
      setShowModal(false);
      fetchAll();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (pid: string) => {
    if (!confirm('이 자산을 삭제하시겠습니까?')) return;
    await assetsApi.remove(pid);
    fetchAll();
  };

  const filterPids = (() => {
    if (!filterCategoryPid) return null;
    const parent = categories.find((c) => c.pid === filterCategoryPid);
    if (parent) return [parent.pid, ...parent.children.map((c) => c.pid)];
    return [filterCategoryPid];
  })();

  const filtered = assets.filter((a) => {
    const matchSearch =
      a.name.toLowerCase().includes(search.toLowerCase()) ||
      (a.serial_number ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (a.location ?? '').toLowerCase().includes(search.toLowerCase());
    const matchCategory = !filterPids || filterPids.includes(a.category_pid ?? '');
    return matchSearch && matchCategory;
  });

  const getCategoryLabel = (asset: Asset) => {
    if (!asset.category_name) return null;
    const parent = categories.find((c) => c.children.some((ch) => ch.pid === asset.category_pid));
    return parent ? `${parent.name} > ${asset.category_name}` : asset.category_name;
  };

  return (
    <Layout>
      <div className="p-6">
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-gray-900">자산 목록</h2>
            <p className="text-sm text-gray-500 mt-0.5">총 {assets.length}개 자산</p>
          </div>
          <button
            type="button"
            onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            자산 등록
          </button>
        </div>

        {/* 검색 + 분류 필터 */}
        <div className="mb-4 flex flex-wrap gap-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="이름, 시리얼, 위치 검색..."
            className="w-full max-w-sm px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <select
            value={filterCategoryPid}
            onChange={(e) => setFilterCategoryPid(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="">전체 분류</option>
            {categories.map((cat) => (
              <optgroup key={cat.pid} label={cat.name}>
                <option value={cat.pid}>{cat.name} (전체)</option>
                {cat.children.map((child) => (
                  <option key={child.pid} value={child.pid}>
                    &nbsp;&nbsp;↳ {child.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>

        {/* 테이블 */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-40 text-gray-400 text-sm">
              불러오는 중...
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-gray-400">
              <svg className="w-8 h-8 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
              <p className="text-sm">자산이 없습니다</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">자산명</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">분류</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">시리얼</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">위치</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">비고</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">동작</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((asset) => (
                  <tr key={asset.pid} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => navigate(`/assets/${asset.pid}`)}
                        className="font-medium text-blue-700 hover:underline"
                      >
                        {asset.name}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      {getCategoryLabel(asset) ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700">
                          {getCategoryLabel(asset)}
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500">{asset.serial_number ?? '-'}</td>
                    <td className="px-4 py-3 text-gray-500">{asset.location ?? '-'}</td>
                    <td className="px-4 py-3 text-gray-500 max-w-xs truncate">{asset.note ?? '-'}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => openEdit(asset)}
                        className="text-gray-400 hover:text-blue-600 px-2 py-1 rounded transition-colors"
                        title="수정"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(asset.pid)}
                        className="text-gray-400 hover:text-red-600 px-2 py-1 rounded transition-colors"
                        title="삭제"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* 자산 등록/수정 모달 */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">{editing ? '자산 수정' : '자산 등록'}</h3>
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

              {/* 분류 선택 (필수) */}
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

              {/* 커스텀 필드 */}
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
                          def.is_required && !customFieldValues[def.pid]?.trim()
                            ? 'border-red-300'
                            : 'border-gray-300'
                        }`}
                      />
                    </div>
                  ))}
                </div>
              )}

              {/* 사진 업로드 */}
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
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handlePhotoChange}
                  />
                </label>
              </div>

              {formError && (
                <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{formError}</p>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
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
      )}
    </Layout>
  );
};

export default AssetsPage;
