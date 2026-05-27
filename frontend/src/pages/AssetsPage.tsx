import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as assetsApi from '../api/assets';
import * as categoriesApi from '../api/categories';
import type { Asset, Category } from '../api/types';
import Layout from '../components/Layout';
import AssetFormModal from '../components/AssetFormModal';

const AssetsPage: React.FC = () => {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCategoryPid, setFilterCategoryPid] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Asset | null>(null);
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

  const openCreate = () => {
    setEditing(null);
    setShowModal(true);
  };

  const openEdit = (asset: Asset) => {
    setEditing(asset);
    setShowModal(true);
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
      <div className="p-4 md:p-6">
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
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden overflow-x-auto">
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
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">분류</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">시리얼</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden lg:table-cell">위치</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden lg:table-cell">비고</th>
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
                        className="font-medium text-blue-700 hover:underline text-left"
                      >
                        {asset.name}
                      </button>
                      <div className="md:hidden text-xs text-gray-400 mt-0.5">
                        {getCategoryLabel(asset) ?? '분류 없음'}
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      {getCategoryLabel(asset) ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700">
                          {getCategoryLabel(asset)}
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500 hidden md:table-cell">{asset.serial_number ?? '-'}</td>
                    <td className="px-4 py-3 text-gray-500 hidden lg:table-cell">{asset.location ?? '-'}</td>
                    <td className="px-4 py-3 text-gray-500 max-w-xs truncate hidden lg:table-cell">{asset.note ?? '-'}</td>
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

      {showModal && (
        <AssetFormModal
          editing={editing}
          categories={categories}
          onClose={() => setShowModal(false)}
          onSave={() => { setShowModal(false); fetchAll(); }}
        />
      )}
    </Layout>
  );
};

export default AssetsPage;
