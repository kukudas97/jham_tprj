import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import * as categoriesApi from '../api/categories';
import * as assetsApi from '../api/assets';
import type { Category, Asset, FieldDef } from '../api/types';
import { isCurrencyField, formatCurrency } from '../utils/format';
import Layout from '../components/Layout';

interface RequiredFieldsState {
  serial_number: boolean;
  location: boolean;
  note: boolean;
}

const emptyRequired = (): RequiredFieldsState => ({
  serial_number: false,
  location: false,
  note: false,
});

const RequiredFieldsCheckboxes: React.FC<{
  value: RequiredFieldsState;
  onChange: (v: RequiredFieldsState) => void;
}> = ({ value, onChange }) => (
  <div className="mt-2">
    <p className="text-xs text-gray-500 mb-1.5">이 분류에서 필수 입력 항목</p>
    <div className="flex gap-4">
      {[
        { key: 'serial_number' as const, label: '시리얼 번호' },
        { key: 'location' as const, label: '위치' },
        { key: 'note' as const, label: '비고' },
      ].map(({ key, label }) => (
        <label key={key} className="flex items-center gap-1.5 text-xs text-gray-700 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={value[key]}
            onChange={(e) => onChange({ ...value, [key]: e.target.checked })}
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          {label}
        </label>
      ))}
    </div>
  </div>
);

interface FieldDefModalProps {
  catPid: string;
  catName: string;
  fieldDefs: FieldDef[];
  onClose: () => void;
  onChanged: () => void;
}

const FieldDefModal: React.FC<FieldDefModalProps> = ({ catPid, catName, fieldDefs, onClose, onChanged }) => {
  const [defs, setDefs] = useState<FieldDef[]>(fieldDefs);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [newRequired, setNewRequired] = useState(false);
  const [editingPid, setEditingPid] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editLabel, setEditLabel] = useState('');
  const [editRequired, setEditRequired] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newLabel.trim()) return;
    setSaving(true);
    try {
      const created = await categoriesApi.createFieldDef(catPid, {
        field_name: newName.trim(),
        field_label: newLabel.trim(),
        is_required: newRequired,
        sort_order: defs.length,
      });
      setDefs([...defs, created]);
      setNewName('');
      setNewLabel('');
      setNewRequired(false);
      setShowAdd(false);
      onChanged();
    } catch {
      alert('필드 추가에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (def: FieldDef) => {
    setEditingPid(def.pid);
    setEditName(def.field_name);
    setEditLabel(def.field_label);
    setEditRequired(def.is_required);
  };

  const handleUpdate = async (e: React.FormEvent, def: FieldDef) => {
    e.preventDefault();
    if (!editName.trim() || !editLabel.trim()) return;
    setSaving(true);
    try {
      const updated = await categoriesApi.updateFieldDef(catPid, def.pid, {
        field_name: editName.trim(),
        field_label: editLabel.trim(),
        is_required: editRequired,
        sort_order: def.sort_order,
      });
      setDefs(defs.map((d) => (d.pid === def.pid ? updated : d)));
      setEditingPid(null);
      onChanged();
    } catch {
      alert('수정에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (def: FieldDef) => {
    if (!confirm(`"${def.field_label}" 필드를 삭제하시겠습니까? 기존 자산의 해당 값도 모두 삭제됩니다.`)) return;
    try {
      await categoriesApi.removeFieldDef(catPid, def.pid);
      setDefs(defs.filter((d) => d.pid !== def.pid));
      onChanged();
    } catch {
      alert('삭제에 실패했습니다.');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-gray-900">커스텀 필드 관리</h3>
            <p className="text-xs text-gray-500 mt-0.5">{catName}</p>
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          {defs.length === 0 && !showAdd && (
            <p className="text-sm text-gray-400 text-center py-4">필드가 없습니다</p>
          )}
          {defs.map((def) => (
            <div key={def.pid} className="border border-gray-200 rounded-lg p-3">
              {editingPid === def.pid ? (
                <form onSubmit={(e) => handleUpdate(e, def)} className="space-y-2">
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <label className="block text-xs text-gray-500 mb-1">컬럼명 (영문)</label>
                      <input
                        autoFocus
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="block text-xs text-gray-500 mb-1">표시명</label>
                      <input
                        type="text"
                        value={editLabel}
                        onChange={(e) => setEditLabel(e.target.value)}
                        className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                  <label className="flex items-center gap-1.5 text-xs text-gray-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editRequired}
                      onChange={(e) => setEditRequired(e.target.checked)}
                      className="rounded border-gray-300 text-blue-600"
                    />
                    필수 입력
                  </label>
                  <div className="flex gap-2">
                    <button type="submit" disabled={saving} className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 disabled:opacity-50">저장</button>
                    <button type="button" onClick={() => setEditingPid(null)} className="px-3 py-1.5 border border-gray-300 text-xs rounded">취소</button>
                  </div>
                </form>
              ) : (
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-mono text-gray-700">{def.field_name}</span>
                      <span className="text-sm text-gray-500">→ {def.field_label}</span>
                      {def.is_required && (
                        <span className="text-xs px-1.5 py-0.5 bg-orange-50 text-orange-600 rounded">필수</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => startEdit(def)}
                      className="p-1 text-gray-400 hover:text-blue-600 rounded"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(def)}
                      className="p-1 text-gray-400 hover:text-red-600 rounded"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}

          {showAdd && (
            <form onSubmit={handleAdd} className="border border-blue-200 bg-blue-50 rounded-lg p-3 space-y-2">
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="block text-xs text-gray-500 mb-1">컬럼명 (영문, 공백없이)</label>
                  <input
                    autoFocus
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="예: cpu_model"
                    className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-xs text-gray-500 mb-1">표시명</label>
                  <input
                    type="text"
                    value={newLabel}
                    onChange={(e) => setNewLabel(e.target.value)}
                    placeholder="예: CPU 모델"
                    className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>
              <label className="flex items-center gap-1.5 text-xs text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newRequired}
                  onChange={(e) => setNewRequired(e.target.checked)}
                  className="rounded border-gray-300 text-blue-600"
                />
                필수 입력
              </label>
              <div className="flex gap-2">
                <button type="submit" disabled={saving} className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 disabled:opacity-50">추가</button>
                <button type="button" onClick={() => setShowAdd(false)} className="px-3 py-1.5 border border-gray-300 text-xs rounded">취소</button>
              </div>
            </form>
          )}

          {!showAdd && (
            <button
              type="button"
              onClick={() => setShowAdd(true)}
              className="w-full py-2 border-2 border-dashed border-gray-300 text-gray-500 text-sm rounded-lg hover:border-blue-400 hover:text-blue-600 transition-colors"
            >
              + 필드 추가
            </button>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-100">
          <p className="text-xs text-gray-400">엑셀 업로드 시 컬럼명을 그대로 사용하세요.</p>
        </div>
      </div>
    </div>
  );
};

const AssetCategoriesPage: React.FC = () => {
  const navigate = useNavigate();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPid, setSelectedPid] = useState<string | null>(null);
  const [assetsInCategory, setAssetsInCategory] = useState<Asset[]>([]);
  const [assetsLoading, setAssetsLoading] = useState(false);

  const [showAddParent, setShowAddParent] = useState(false);
  const [showAddChild, setShowAddChild] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [newRequired, setNewRequired] = useState<RequiredFieldsState>(emptyRequired());
  const [editingPid, setEditingPid] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editRequired, setEditRequired] = useState<RequiredFieldsState>(emptyRequired());
  const [saving, setSaving] = useState(false);
  const [fieldModalCat, setFieldModalCat] = useState<Category | null>(null);
  const [collapsedPids, setCollapsedPids] = useState<Set<string>>(new Set());
  const [allAssets, setAllAssets] = useState<Asset[]>([]);
  const [sortConfig, setSortConfig] = useState<{ key: string; dir: 'asc' | 'desc' } | null>(null);
  const initialCollapseDone = React.useRef(false);

  const fetchCategories = useCallback(async () => {
    try {
      const data = await categoriesApi.list();
      setCategories(data);
      // 최초 로드 시 전체 대분류를 닫힌 상태로 초기화
      if (!initialCollapseDone.current) {
        setCollapsedPids(new Set(data.map((c) => c.pid)));
        initialCollapseDone.current = true;
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchCategories(); }, [fetchCategories]);
  useEffect(() => { assetsApi.list().then(setAllAssets); }, []);

  const toggleCollapse = (pid: string) => {
    setCollapsedPids((prev) => {
      const next = new Set(prev);
      if (next.has(pid)) next.delete(pid);
      else next.add(pid);
      return next;
    });
  };

  const assetCountByPid = useMemo(() => {
    const map: Record<string, number> = {};
    for (const a of allAssets) {
      if (a.category_pid) map[a.category_pid] = (map[a.category_pid] ?? 0) + 1;
    }
    return map;
  }, [allAssets]);

  const fetchAssets = useCallback(async (catPids: string[]) => {
    setAssetsLoading(true);
    try {
      const all = await assetsApi.list();
      setAssetsInCategory(all.filter((a) => a.category_pid && catPids.includes(a.category_pid)));
    } finally {
      setAssetsLoading(false);
    }
  }, []);

  const handleSelectCategory = (pid: string) => {
    setSelectedPid(pid);
    setSortConfig(null); // 분류 변경 시 정렬 초기화
    const parent = categories.find((c) => c.pid === pid);
    if (parent) {
      fetchAssets([pid, ...parent.children.map((ch) => ch.pid)]);
    } else {
      fetchAssets([pid]);
    }
  };

  const handleAddParent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setSaving(true);
    try {
      await categoriesApi.create({
        name: newName.trim(),
        require_serial_number: newRequired.serial_number,
        require_location: newRequired.location,
        require_note: newRequired.note,
      });
      setNewName('');
      setNewRequired(emptyRequired());
      setShowAddParent(false);
      fetchCategories();
    } catch {
      alert('대분류 추가에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handleAddChild = async (e: React.FormEvent, parentPid: string) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setSaving(true);
    try {
      await categoriesApi.create({ name: newName.trim(), parent_pid: parentPid });
      setNewName('');
      setShowAddChild(null);
      fetchCategories();
    } catch {
      alert('소분류 추가에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (cat: Category | { pid: string; name: string }, isParent: boolean) => {
    setEditingPid(cat.pid);
    setEditName(cat.name);
    if (isParent) {
      const c = cat as Category;
      setEditRequired({
        serial_number: c.required_fields?.serial_number ?? false,
        location: c.required_fields?.location ?? false,
        note: c.required_fields?.note ?? false,
      });
    } else {
      setEditRequired(emptyRequired());
    }
  };

  const handleUpdate = async (e: React.FormEvent, pid: string, isParent: boolean) => {
    e.preventDefault();
    if (!editName.trim()) return;
    setSaving(true);
    try {
      await categoriesApi.update(pid, {
        name: editName.trim(),
        ...(isParent ? {
          require_serial_number: editRequired.serial_number,
          require_location: editRequired.location,
          require_note: editRequired.note,
        } : {}),
      });
      setEditingPid(null);
      fetchCategories();
    } catch {
      alert('수정에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (pid: string, name: string) => {
    if (!confirm(`"${name}"을(를) 삭제하시겠습니까? 하위 분류도 함께 삭제됩니다.`)) return;
    try {
      await categoriesApi.remove(pid);
      if (selectedPid === pid) {
        setSelectedPid(null);
        setAssetsInCategory([]);
      }
      fetchCategories();
    } catch {
      alert('삭제에 실패했습니다.');
    }
  };

  const selectedCategory = categories.find((c) => c.pid === selectedPid)
    || categories.flatMap((c) => c.children).find((c) => c.pid === selectedPid);

  // 선택된 분류의 대분류(field_defs 보유)
  const parentCategory = selectedPid
    ? (categories.find((c) => c.pid === selectedPid)
       ?? categories.find((c) => c.children.some((ch) => ch.pid === selectedPid)))
    : null;
  const customFieldDefs = parentCategory?.field_defs ?? [];

  const getFieldValue = (asset: Asset, label: string) =>
    asset.field_values?.find((fv) => fv.field_label === label || fv.field_name === label)?.value ?? null;

  const handleSort = (key: string) => {
    setSortConfig((prev) =>
      prev?.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' },
    );
  };

  const sortIcon = (key: string) => {
    const active = sortConfig?.key === key;
    const dir = sortConfig?.dir ?? 'asc';
    return (
      <span className={`ml-1 text-xs ${active ? 'text-blue-500' : 'text-gray-300'}`}>
        {active ? (dir === 'asc' ? '▲' : '▼') : '⇅'}
      </span>
    );
  };

  const sortedAssets = useMemo(() => {
    if (!sortConfig) return assetsInCategory;
    return [...assetsInCategory].sort((a, b) => {
      let av = '';
      let bv = '';
      if (sortConfig.key === 'name') { av = a.name; bv = b.name; }
      else if (sortConfig.key === 'serial') { av = a.serial_number ?? ''; bv = b.serial_number ?? ''; }
      else if (sortConfig.key === 'department') { av = a.department_name ?? ''; bv = b.department_name ?? ''; }
      else if (sortConfig.key === 'team') { av = a.team_name ?? ''; bv = b.team_name ?? ''; }
      else if (sortConfig.key === 'manager') { av = a.manager_name ?? ''; bv = b.manager_name ?? ''; }
      else {
        av = a.field_values?.find((v) => v.field_label === sortConfig.key || v.field_name === sortConfig.key)?.value ?? '';
        bv = b.field_values?.find((v) => v.field_label === sortConfig.key || v.field_name === sortConfig.key)?.value ?? '';
      }
      const cmp = av.localeCompare(bv, 'ko');
      return sortConfig.dir === 'asc' ? cmp : -cmp;
    });
  }, [assetsInCategory, sortConfig]);

  return (
    <Layout>
      <div className="p-6 flex gap-6 h-full">
        {/* 왼쪽: 분류 트리 */}
        <div className="w-80 flex-shrink-0 flex flex-col gap-4 min-h-0">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900">자산 분류</h2>
            <button
              type="button"
              onClick={() => { setShowAddParent(true); setNewName(''); setNewRequired(emptyRequired()); }}
              className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              대분류 추가
            </button>
          </div>

          {showAddParent && (
            <form onSubmit={handleAddParent} className="bg-blue-50 rounded-lg p-3 space-y-2">
              <input
                autoFocus
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="대분류 이름"
                className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <RequiredFieldsCheckboxes value={newRequired} onChange={setNewRequired} />
              <div className="flex gap-2 pt-1">
                <button type="submit" disabled={saving} className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 disabled:opacity-50">추가</button>
                <button type="button" onClick={() => setShowAddParent(false)} className="px-3 py-1.5 border border-gray-300 text-gray-600 text-xs rounded hover:bg-gray-50">취소</button>
              </div>
            </form>
          )}

          <div className="bg-white rounded-xl border border-gray-200 overflow-y-auto flex-1">
            {loading ? (
              <div className="p-4 text-sm text-gray-400 text-center">불러오는 중...</div>
            ) : categories.length === 0 ? (
              <div className="p-6 text-sm text-gray-400 text-center">
                <p>분류가 없습니다</p>
                <p className="text-xs mt-1">대분류를 먼저 추가하세요</p>
              </div>
            ) : (
              <ul className="divide-y divide-gray-100">
                {categories.map((cat) => (
                  <li key={cat.pid}>
                    {/* 대분류 */}
                    <div className={`flex items-center justify-between px-3 py-2.5 group ${selectedPid === cat.pid ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
                      {editingPid === cat.pid ? (
                        <form onSubmit={(e) => handleUpdate(e, cat.pid, true)} className="flex-1 mr-1 space-y-2">
                          <div className="flex gap-1">
                            <input
                              autoFocus
                              type="text"
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                            <button type="submit" disabled={saving} className="px-2 py-1 bg-blue-600 text-white text-xs rounded">저장</button>
                            <button type="button" onClick={() => setEditingPid(null)} className="px-2 py-1 border border-gray-300 text-xs rounded">취소</button>
                          </div>
                          <RequiredFieldsCheckboxes value={editRequired} onChange={setEditRequired} />
                        </form>
                      ) : (
                        <>
                          <div className="flex-1 min-w-0 flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => toggleCollapse(cat.pid)}
                              className="p-0.5 text-gray-400 hover:text-gray-600 flex-shrink-0"
                            >
                              <svg
                                className={`w-3.5 h-3.5 transition-transform ${collapsedPids.has(cat.pid) ? '' : 'rotate-90'}`}
                                fill="none" stroke="currentColor" viewBox="0 0 24 24"
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                            </button>
                            <div className="flex-1 min-w-0">
                              <button
                                type="button"
                                onClick={() => handleSelectCategory(cat.pid)}
                                className={`text-left text-sm font-semibold ${selectedPid === cat.pid ? 'text-blue-700' : 'text-gray-800'}`}
                              >
                                {cat.name}
                                <span className="ml-1.5 text-xs font-normal text-gray-400">
                                  ({cat.children.reduce((s, ch) => s + (assetCountByPid[ch.pid] ?? 0), 0)})
                                </span>
                              </button>
                              <div className="flex gap-1 mt-0.5 flex-wrap">
                                {cat.required_fields?.serial_number && (
                                  <span className="text-xs px-1 py-0.5 bg-orange-50 text-orange-600 rounded">시리얼*</span>
                                )}
                                {cat.required_fields?.location && (
                                  <span className="text-xs px-1 py-0.5 bg-orange-50 text-orange-600 rounded">위치*</span>
                                )}
                                {cat.required_fields?.note && (
                                  <span className="text-xs px-1 py-0.5 bg-orange-50 text-orange-600 rounded">비고*</span>
                                )}
                                {cat.field_defs?.length > 0 && (
                                  <span className="text-xs px-1 py-0.5 bg-purple-50 text-purple-600 rounded">
                                    커스텀 {cat.field_defs.length}개
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="hidden group-hover:flex items-center gap-1 ml-2">
                            <button
                              type="button"
                              onClick={() => setFieldModalCat(cat)}
                              className="p-1 text-gray-400 hover:text-purple-600 rounded"
                              title="커스텀 필드 관리"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              </svg>
                            </button>
                            <button
                              type="button"
                              onClick={() => { setShowAddChild(cat.pid); setNewName(''); if (collapsedPids.has(cat.pid)) toggleCollapse(cat.pid); }}
                              className="p-1 text-gray-400 hover:text-blue-600 rounded"
                              title="소분류 추가"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                              </svg>
                            </button>
                            <button
                              type="button"
                              onClick={() => startEdit(cat, true)}
                              className="p-1 text-gray-400 hover:text-blue-600 rounded"
                              title="이름 수정"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(cat.pid, cat.name)}
                              className="p-1 text-gray-400 hover:text-red-600 rounded"
                              title="삭제"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </>
                      )}
                    </div>

                    {/* 소분류 추가 폼 + 소분류 목록 (접힘 제어) */}
                    {!collapsedPids.has(cat.pid) && (
                      <>
                        {showAddChild === cat.pid && (
                          <form
                            onSubmit={(e) => handleAddChild(e, cat.pid)}
                            className="bg-blue-50 px-3 py-2 flex gap-2"
                          >
                            <input
                              autoFocus
                              type="text"
                              value={newName}
                              onChange={(e) => setNewName(e.target.value)}
                              placeholder="소분류 이름"
                              className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                            <button type="submit" disabled={saving} className="px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 disabled:opacity-50">추가</button>
                            <button type="button" onClick={() => setShowAddChild(null)} className="px-2 py-1 border border-gray-300 text-xs rounded">취소</button>
                          </form>
                        )}

                        {cat.children.map((child) => (
                          <div
                            key={child.pid}
                            className={`flex items-center justify-between pl-6 pr-3 py-2 group ${selectedPid === child.pid ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                          >
                            {editingPid === child.pid ? (
                              <form onSubmit={(e) => handleUpdate(e, child.pid, false)} className="flex-1 flex gap-1 mr-1">
                                <input
                                  autoFocus
                                  type="text"
                                  value={editName}
                                  onChange={(e) => setEditName(e.target.value)}
                                  className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                                />
                                <button type="submit" disabled={saving} className="px-2 py-1 bg-blue-600 text-white text-xs rounded">저장</button>
                                <button type="button" onClick={() => setEditingPid(null)} className="px-2 py-1 border border-gray-300 text-xs rounded">취소</button>
                              </form>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleSelectCategory(child.pid)}
                                  className={`flex-1 text-left text-sm ${selectedPid === child.pid ? 'text-blue-600 font-medium' : 'text-gray-600'}`}
                                >
                                  ↳ {child.name}
                                  <span className="ml-1.5 text-xs font-normal text-gray-400">
                                    ({assetCountByPid[child.pid] ?? 0})
                                  </span>
                                </button>
                                <div className="hidden group-hover:flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => startEdit(child, false)}
                                    className="p-1 text-gray-400 hover:text-blue-600 rounded"
                                    title="이름 수정"
                                  >
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                    </svg>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDelete(child.pid, child.name)}
                                    className="p-1 text-gray-400 hover:text-red-600 rounded"
                                    title="삭제"
                                  >
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                        ))}
                      </>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* 오른쪽: 선택된 분류의 자산 목록 */}
        <div className="flex-1 flex flex-col gap-4 min-h-0">
          <div>
            <h2 className="text-lg font-bold text-gray-900">
              {selectedCategory ? `"${selectedCategory.name}" 자산 목록` : '분류를 선택하세요'}
            </h2>
            {selectedCategory && (
              <p className="text-sm text-gray-500 mt-0.5">{assetsInCategory.length}개 자산</p>
            )}
          </div>

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden flex-1 flex flex-col">
            {!selectedPid ? (
              <div className="flex items-center justify-center h-full text-gray-400 text-sm">
                왼쪽에서 분류를 선택하면 해당 자산이 표시됩니다
              </div>
            ) : assetsLoading ? (
              <div className="flex items-center justify-center h-40 text-gray-400 text-sm">
                불러오는 중...
              </div>
            ) : assetsInCategory.length === 0 ? (
              <div className="flex items-center justify-center h-40 text-gray-400 text-sm">
                이 분류에 자산이 없습니다
              </div>
            ) : (
              <div className="overflow-y-auto flex-1">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                    <tr>
                      <th className="text-center px-3 py-3 text-xs font-semibold text-gray-400 w-10">No.</th>
                      {[
                        { key: 'name', label: '품명' },
                        { key: 'serial', label: '식별번호' },
                        { key: 'department', label: '부서명' },
                        { key: 'team', label: '팀명' },
                        { key: 'manager', label: '관리자' },
                      ].map(({ key, label }) => (
                        <th
                          key={key}
                          onClick={() => handleSort(key)}
                          className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide cursor-pointer select-none hover:bg-gray-100 transition-colors"
                        >
                          <span className="flex items-center gap-0.5">{label}{sortIcon(key)}</span>
                        </th>
                      ))}
                      {customFieldDefs.map((def) => (
                        <th
                          key={def.pid}
                          onClick={() => handleSort(def.field_label)}
                          className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide cursor-pointer select-none hover:bg-gray-100 transition-colors"
                        >
                          <span className="flex items-center gap-0.5">{def.field_label}{sortIcon(def.field_label)}</span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {sortedAssets.map((asset, idx) => (
                      <tr key={asset.pid} className="hover:bg-gray-50 transition-colors">
                        <td className="px-3 py-3 text-center text-xs text-gray-400">{idx + 1}</td>
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => navigate(`/assets/${asset.pid}`)}
                            className="font-medium text-blue-700 hover:underline"
                          >
                            {asset.name}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-gray-500 font-mono text-xs">{asset.serial_number ?? '-'}</td>
                        <td className="px-4 py-3 text-gray-500">{asset.department_name ?? '-'}</td>
                        <td className="px-4 py-3 text-gray-500">{asset.team_name ?? '-'}</td>
                        <td className="px-4 py-3 text-gray-500">{asset.manager_name ?? '-'}</td>
                        {customFieldDefs.map((def) => (
                          <td key={def.pid} className="px-4 py-3 text-gray-500">
                            {isCurrencyField(def.field_label)
                              ? formatCurrency(getFieldValue(asset, def.field_label))
                              : (getFieldValue(asset, def.field_label) ?? '-')}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 커스텀 필드 관리 모달 */}
      {fieldModalCat && (
        <FieldDefModal
          catPid={fieldModalCat.pid}
          catName={fieldModalCat.name}
          fieldDefs={fieldModalCat.field_defs ?? []}
          onClose={() => setFieldModalCat(null)}
          onChanged={fetchCategories}
        />
      )}
    </Layout>
  );
};

export default AssetCategoriesPage;
