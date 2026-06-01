import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as assetsApi from '../api/assets';
import * as categoriesApi from '../api/categories';
import type { Asset, Category } from '../api/types';
import Layout from '../components/Layout';
import AssetFormModal from '../components/AssetFormModal';
import AssetDetailDrawer from '../components/AssetDetailDrawer';
import ExcelExportModal from '../components/ExcelExportModal';
import LabelPrintModal from '../components/LabelPrintModal';
import { printLabels } from '../utils/printLabels';

async function exportExcel(assets: Asset[], categories: Category[], includeQr: boolean) {
  const ExcelJS = (await import('exceljs')).default;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'JHAM';
  workbook.created = new Date();

  const HEADER_COLOR = '4F46E5';
  const ALT_ROW_COLOR = 'F5F5FF';
  const BORDER = { style: 'thin' as const, color: { argb: 'FFDDDDDD' } };

  for (const parent of categories) {
    const catAssets = assets.filter(
      (a) => a.category_pid === parent.pid || parent.children.some((ch) => ch.pid === a.category_pid),
    );
    if (catAssets.length === 0) continue;

    const fieldDefs = parent.field_defs ?? [];
    const qrColNum = 5 + fieldDefs.length + 1; // 1-indexed (순번~부서명=5 + 커스텀 + QR)

    const sheet = workbook.addWorksheet(parent.name.slice(0, 31));
    sheet.columns = [
      { key: 'idx', width: 6 },
      { key: 'asset_name', width: 14 },
      { key: 'name', width: 22 },
      { key: 'serial', width: 20 },
      { key: 'location', width: 16 },
      ...fieldDefs.map((def) => ({ key: `field_${def.pid}`, width: 16 })),
      ...(includeQr ? [{ key: 'qr', width: 13 }] : []),
    ];

    const headers = [
      '순번', '자산명', '품명', '식별번호', '부서명',
      ...fieldDefs.map((def) => def.field_label),
      ...(includeQr ? ['QR코드'] : []),
    ];
    const headerRow = sheet.addRow(headers);
    headerRow.height = 22;
    headerRow.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${HEADER_COLOR}` } };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = { bottom: BORDER, right: BORDER };
    });

    const ROW_HEIGHT = includeQr ? 72 : 20;

    for (const [i, asset] of catAssets.entries()) {
      const rowNum = i + 2;
      const customValues = fieldDefs.map((def) => {
        const fv = asset.field_values?.find((v) => v.field_def_pid === def.pid);
        return fv?.value ?? '';
      });
      const row = sheet.addRow([
        i + 1,
        asset.category_name ?? '',
        asset.name,
        asset.serial_number ?? '',
        asset.location ?? '',
        ...customValues,
        ...(includeQr ? [''] : []),
      ]);
      row.height = ROW_HEIGHT;

      if (i % 2 === 1) {
        row.eachCell((cell) => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${ALT_ROW_COLOR}` } };
        });
      }

      row.eachCell((cell, col) => {
        cell.alignment = { vertical: 'middle', horizontal: col === 1 ? 'center' : 'left' };
        cell.border = { bottom: BORDER, right: BORDER };
      });

      if (includeQr) {
        try {
          let buf: ArrayBuffer | null = null;
          const imgRes = await fetch(`/api/qr_codes/image/${asset.pid}.png`);
          if (imgRes.ok) {
            buf = await imgRes.arrayBuffer();
          } else {
            await assetsApi.getQr(asset.pid);
            const retry = await fetch(`/api/qr_codes/image/${asset.pid}.png`);
            if (retry.ok) buf = await retry.arrayBuffer();
          }
          if (buf) {
            const imgId = workbook.addImage({ buffer: buf, extension: 'png' });
            sheet.addImage(imgId, {
              tl: { col: qrColNum - 1, row: rowNum - 1 } as { col: number; row: number },
              ext: { width: 68, height: 68 },
            });
          }
        } catch {
          // skip image on error
        }
      }
    }
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `자산목록_${new Date().toISOString().slice(0, 10)}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

const AssetsPage: React.FC = () => {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCategoryPid, setFilterCategoryPid] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Asset | null>(null);
  const [exporting, setExporting] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [showExcelModal, setShowExcelModal] = useState(false);
  const [showLabelModal, setShowLabelModal] = useState(false);
  const [selectedPids, setSelectedPids] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [filterDept, setFilterDept] = useState('');
  const [filterTeam, setFilterTeam] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: string; dir: 'asc' | 'desc' } | null>(null);
  const [drawerPid, setDrawerPid] = useState<string | null>(null);
  const allCheckboxRef = useRef<HTMLInputElement>(null);

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

  // 필터 변경 시 선택 및 페이지 초기화
  useEffect(() => { setSelectedPids(new Set()); setPage(1); }, [search, filterCategoryPid, filterDept, filterTeam]);

  const openCreate = () => { setEditing(null); setShowModal(true); };
  const openEdit = (asset: Asset) => { setEditing(asset); setShowModal(true); };

  const handleDelete = async (pid: string) => {
    if (!confirm('이 자산을 삭제하시겠습니까?')) return;
    await assetsApi.remove(pid);
    fetchAll();
  };

  const handleBulkDelete = async () => {
    if (selectedPids.size === 0) return;
    if (!confirm(`선택한 ${selectedPids.size}개의 자산을 삭제하시겠습니까?`)) return;
    await Promise.all([...selectedPids].map((pid) => assetsApi.remove(pid)));
    setSelectedPids(new Set());
    fetchAll();
  };

  const getFieldValue = (asset: Asset, label: string) =>
    asset.field_values?.find((fv) => fv.field_label === label || fv.field_name === label)?.value ?? null;

  const filterPids = (() => {
    if (!filterCategoryPid) return null;
    const parent = categories.find((c) => c.pid === filterCategoryPid);
    if (parent) return [parent.pid, ...parent.children.map((c) => c.pid)];
    return [filterCategoryPid];
  })();

  const deptOptions = useMemo(
    () => [...new Set(assets.map((a) => a.department_name ?? '').filter(Boolean))].sort(),
    [assets],
  );
  const teamOptions = useMemo(
    () => [...new Set(assets.map((a) => a.team_name ?? '').filter(Boolean))].sort(),
    [assets],
  );

  const filtered = assets.filter((a) => {
    const q = search.toLowerCase();
    const matchSearch =
      a.name.toLowerCase().includes(q) ||
      (a.serial_number ?? '').toLowerCase().includes(q) ||
      (a.manager_name ?? '').toLowerCase().includes(q);
    const matchCategory = !filterPids || filterPids.includes(a.category_pid ?? '');
    const matchDept = !filterDept || (a.department_name ?? '') === filterDept;
    const matchTeam = !filterTeam || (a.team_name ?? '') === filterTeam;
    return matchSearch && matchCategory && matchDept && matchTeam;
  });

  const sorted = useMemo(() => {
    if (!sortConfig) return filtered;
    return [...filtered].sort((a, b) => {
      let av = '';
      let bv = '';
      if (sortConfig.key === 'name') { av = a.name; bv = b.name; }
      else if (sortConfig.key === 'category') {
        const label = (x: Asset) => {
          if (!x.category_name) return '';
          const p = categories.find((c) => c.children.some((ch) => ch.pid === x.category_pid));
          return p ? `${p.name} > ${x.category_name}` : x.category_name;
        };
        av = label(a); bv = label(b);
      }
      else if (sortConfig.key === 'serial') { av = a.serial_number ?? ''; bv = b.serial_number ?? ''; }
      else if (sortConfig.key === 'location') { av = a.location ?? ''; bv = b.location ?? ''; }
      else {
        const fv = (x: Asset) =>
          x.field_values?.find((v) => v.field_label === sortConfig.key || v.field_name === sortConfig.key)?.value ?? '';
        av = fv(a); bv = fv(b);
      }
      const cmp = av.localeCompare(bv, 'ko');
      return sortConfig.dir === 'asc' ? cmp : -cmp;
    });
  }, [filtered, sortConfig, categories]);

  // pageSize === 0 → 모두 표시
  const totalPages = pageSize === 0 ? 1 : Math.ceil(filtered.length / pageSize);
  const paginated = pageSize === 0 ? sorted : sorted.slice((page - 1) * pageSize, page * pageSize);
  const pageNumbers = (() => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    if (page <= 4) return [1, 2, 3, 4, 5, '...', totalPages];
    if (page >= totalPages - 3) return [1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    return [1, '...', page - 1, page, page + 1, '...', totalPages];
  })();
  const countLabel = pageSize === 0
    ? `전체 ${filtered.length}개`
    : `총 ${filtered.length}개 중 ${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, filtered.length)}개`;

  const selectedAssets = filtered.filter((a) => selectedPids.has(a.pid));
  const isAllSelected = paginated.length > 0 && paginated.every((a) => selectedPids.has(a.pid));
  const isIndeterminate = !isAllSelected && paginated.some((a) => selectedPids.has(a.pid));

  useEffect(() => {
    if (allCheckboxRef.current) allCheckboxRef.current.indeterminate = isIndeterminate;
  }, [isIndeterminate]);

  const toggleSelect = (pid: string) => {
    setSelectedPids((prev) => {
      const next = new Set(prev);
      if (next.has(pid)) next.delete(pid);
      else next.add(pid);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedPids((prev) => { const next = new Set(prev); paginated.forEach((a) => next.delete(a.pid)); return next; });
    } else {
      setSelectedPids((prev) => { const next = new Set(prev); paginated.forEach((a) => next.add(a.pid)); return next; });
    }
  };

  const handleSort = (key: string) => {
    setSortConfig((prev) =>
      prev?.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' },
    );
    setPage(1);
  };

  const sortIcon = (key: string) => {
    const active = sortConfig?.key === key;
    const dir = sortConfig?.dir ?? 'asc';
    return (
      <span className={`ml-1 text-xs ${active ? 'text-indigo-400' : 'text-gray-300'}`}>
        {active ? (dir === 'asc' ? '▲' : '▼') : '⇅'}
      </span>
    );
  };

  // 선택된 항목이 있으면 선택 기준, 없으면 필터 기준으로 처리
  const targetAssets = selectedPids.size > 0 ? selectedAssets : filtered;

  const getCategoryLabel = (asset: Asset) => {
    if (!asset.category_name) return null;
    const parent = categories.find((c) => c.children.some((ch) => ch.pid === asset.category_pid));
    return parent ? `${parent.name} > ${asset.category_name}` : asset.category_name;
  };

  const categorizedCount = assets.filter((a) => a.category_pid).length;

  return (
    <Layout>
      <div className="p-4 md:p-6 max-w-7xl">
        {/* 헤더 */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-gray-900">자산 목록</h2>
            <p className="text-sm text-gray-500 mt-0.5">등록된 모든 자산을 조회하고 관리합니다</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* 선택 삭제 버튼 */}
            {selectedPids.size > 0 && (
              <button
                type="button"
                onClick={handleBulkDelete}
                className="flex items-center gap-1.5 px-3 py-2 bg-red-50 border border-red-200 text-red-600 text-sm font-medium rounded-xl hover:bg-red-100 transition-colors shadow-sm"
                title={`선택한 ${selectedPids.size}개 삭제`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                <span>{selectedPids.size}개 삭제</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowExcelModal(true)}
              disabled={exporting || loading || targetAssets.length === 0}
              className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 text-gray-600 text-sm font-medium rounded-xl hover:bg-gray-50 disabled:opacity-50 transition-colors shadow-sm"
              title={selectedPids.size > 0
                ? `선택한 ${selectedPids.size}개 엑셀 다운로드`
                : '전체 필터 결과 엑셀 다운로드'}
            >
              {exporting ? (
                <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                </svg>
              )}
              <span className="hidden sm:inline">{exporting ? '생성 중...' : 'Excel'}</span>
            </button>
            <button
              type="button"
              onClick={() => setShowLabelModal(true)}
              disabled={loading || targetAssets.length === 0}
              className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 text-gray-600 text-sm font-medium rounded-xl hover:bg-gray-50 disabled:opacity-50 transition-colors shadow-sm"
              title={selectedPids.size > 0
                ? `선택한 ${selectedPids.size}개 라벨 인쇄`
                : '전체 필터 결과 라벨 인쇄'}
            >
              {printing ? (
                <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
              )}
              <span className="hidden sm:inline">라벨</span>
            </button>
            <button
              type="button"
              onClick={openCreate}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 transition-colors shadow-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span className="hidden sm:inline">자산 등록</span>
              <span className="sm:hidden">등록</span>
            </button>
          </div>
        </div>

        {/* 통계 카드 */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
            <p className="text-xs font-medium text-gray-500 mb-1">전체 자산</p>
            <p className="text-2xl font-bold text-gray-900">{loading ? '-' : assets.length}</p>
            <p className="text-xs text-gray-400 mt-0.5">등록된 자산</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
            <p className="text-xs font-medium text-gray-500 mb-1">분류 완료</p>
            <p className="text-2xl font-bold text-indigo-600">{loading ? '-' : categorizedCount}</p>
            <p className="text-xs text-gray-400 mt-0.5">분류가 지정된 자산</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
            <p className="text-xs font-medium text-gray-500 mb-1">검색 결과</p>
            <p className="text-2xl font-bold text-gray-700">{loading ? '-' : filtered.length}</p>
            <p className="text-xs text-gray-400 mt-0.5">필터 적용 결과</p>
          </div>
        </div>

        {/* 검색 + 분류 필터 */}
        <div className="mb-4 flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1 max-w-sm">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="품명, 식별번호, 관리자 검색..."
              className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent shadow-sm"
            />
          </div>
          <select
            value={filterCategoryPid}
            onChange={(e) => setFilterCategoryPid(e.target.value)}
            className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white shadow-sm"
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
          <select
            value={filterDept}
            onChange={(e) => setFilterDept(e.target.value)}
            className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white shadow-sm"
          >
            <option value="">전체 부서</option>
            {deptOptions.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
          <select
            value={filterTeam}
            onChange={(e) => setFilterTeam(e.target.value)}
            className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white shadow-sm"
          >
            <option value="">전체 팀</option>
            {teamOptions.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        {/* 선택 상태 표시 */}
        {selectedPids.size > 0 && (
          <div className="mb-3 flex items-center gap-3 px-4 py-2 bg-indigo-50 border border-indigo-200 rounded-xl text-sm">
            <span className="text-indigo-700 font-medium">{selectedPids.size}개 선택됨</span>
            <button
              type="button"
              onClick={() => setSelectedPids(new Set())}
              className="text-indigo-500 hover:text-indigo-700 text-xs underline"
            >
              선택 해제
            </button>
          </div>
        )}

        {/* 테이블 (md 이상) / 카드 목록 (모바일) */}
        {loading ? (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm flex items-center justify-center h-48">
            <div className="flex flex-col items-center gap-2 text-gray-400">
              <svg className="w-6 h-6 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span className="text-sm">불러오는 중...</span>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col items-center justify-center h-48">
            <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center mb-3">
              <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <p className="text-sm font-medium text-gray-500">자산이 없습니다</p>
            <p className="text-xs text-gray-400 mt-1">
              {search || filterCategoryPid ? '검색 조건을 변경해 보세요' : '자산 등록 버튼을 눌러 첫 자산을 추가하세요'}
            </p>
          </div>
        ) : (
          <>
            {/* 그리드 상단: 건수 (좌) + 페이지 크기 선택 (우) */}
            <div className="flex items-center justify-between mb-2 px-1">
              <p className="text-xs text-gray-500">{countLabel}</p>
              <select
                value={pageSize}
                onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
                className="text-xs border border-gray-200 rounded-lg px-2 py-1 text-gray-600 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400"
              >
                {[10, 25, 50, 100, 250, 500].map((n) => (
                  <option key={n} value={n}>{n}개씩</option>
                ))}
                <option value={0}>모두</option>
              </select>
            </div>

            {/* 데스크톱 테이블 */}
            <div className="hidden md:block bg-white rounded-xl border border-gray-200 overflow-hidden overflow-x-auto shadow-sm">
              <table className="w-full text-sm">
                <thead className="bg-gray-50/80 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3.5 w-10">
                      <input
                        ref={allCheckboxRef}
                        type="checkbox"
                        checked={isAllSelected}
                        onChange={toggleSelectAll}
                        className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                      />
                    </th>
                    <th className="text-center px-3 py-3.5 text-xs font-semibold text-gray-400 w-10">No.</th>
                    {[
                      { key: 'name', label: '품명', cls: '' },
                      { key: 'category', label: '분류', cls: '' },
                      { key: 'serial', label: '식별번호', cls: '' },
                      { key: 'location', label: '부서명', cls: 'hidden lg:table-cell' },
                      { key: '팀명', label: '팀명', cls: 'hidden lg:table-cell' },
                      { key: '관리자', label: '관리자', cls: 'hidden lg:table-cell' },
                    ].map(({ key, label, cls }) => (
                      <th
                        key={key}
                        onClick={() => handleSort(key)}
                        className={`text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer select-none hover:bg-gray-100 transition-colors ${cls}`}
                      >
                        <span className="flex items-center gap-0.5">
                          {label}{sortIcon(key)}
                        </span>
                      </th>
                    ))}
                    <th className="text-right px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">동작</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {paginated.map((asset, idx) => {
                    const isChecked = selectedPids.has(asset.pid);
                    return (
                      <tr
                        key={asset.pid}
                        className={`hover:bg-indigo-50/30 transition-colors group ${isChecked ? 'bg-indigo-50/50' : ''}`}
                      >
                        <td className="px-4 py-3.5">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleSelect(asset.pid)}
                            onClick={(e) => e.stopPropagation()}
                            className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                          />
                        </td>
                        <td className="px-3 py-3.5 text-center text-xs text-gray-400">{(page - 1) * pageSize + idx + 1}</td>
                        <td className="px-5 py-3.5">
                          <button
                            type="button"
                            onClick={() => setDrawerPid(asset.pid)}
                            className="font-medium text-indigo-600 hover:text-indigo-800 hover:underline text-left"
                          >
                            {asset.name}
                          </button>
                        </td>
                        <td className="px-5 py-3.5">
                          {getCategoryLabel(asset) ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-lg text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-100">
                              {getCategoryLabel(asset)}
                            </span>
                          ) : (
                            <span className="text-gray-300">-</span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-gray-500 font-mono text-xs">{asset.serial_number ?? '-'}</td>
                        <td className="px-5 py-3.5 text-gray-500 hidden lg:table-cell">{asset.department_name ?? '-'}</td>
                        <td className="px-5 py-3.5 text-gray-500 hidden lg:table-cell">{asset.team_name ?? '-'}</td>
                        <td className="px-5 py-3.5 text-gray-500 hidden lg:table-cell">{asset.manager_name ?? '-'}</td>
                        <td className="px-5 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              type="button"
                              onClick={() => openEdit(asset)}
                              className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
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
                              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="삭제"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* 페이지네이션 (버튼만) */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-1 mt-3">
                <button type="button" onClick={() => setPage(1)} disabled={page === 1}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed text-sm">«</button>
                <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed text-sm">‹</button>
                {pageNumbers.map((n, i) =>
                  n === '...' ? (
                    <span key={`ellipsis-${i}`} className="px-1 text-gray-400 text-sm">…</span>
                  ) : (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setPage(n as number)}
                      className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${page === n ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
                    >{n}</button>
                  )
                )}
                <button type="button" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed text-sm">›</button>
                <button type="button" onClick={() => setPage(totalPages)} disabled={page === totalPages}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed text-sm">»</button>
              </div>
            )}

            {/* 모바일 카드 목록 */}
            <div className="md:hidden space-y-2">
              {paginated.map((asset) => {
                const isChecked = selectedPids.has(asset.pid);
                return (
                  <div
                    key={asset.pid}
                    className={`bg-white rounded-xl border shadow-sm p-4 ${isChecked ? 'border-indigo-300 bg-indigo-50/30' : 'border-gray-200'}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleSelect(asset.pid)}
                          className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer mt-0.5 flex-shrink-0"
                        />
                        <button
                          type="button"
                          onClick={() => setDrawerPid(asset.pid)}
                          className="font-semibold text-gray-900 text-left hover:text-indigo-600 transition-colors flex-1 min-w-0 truncate"
                        >
                          {asset.name}
                        </button>
                      </div>
                      <div className="flex gap-1 flex-shrink-0">
                        <button
                          type="button"
                          onClick={() => openEdit(asset)}
                          className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(asset.pid)}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2 pl-7">
                      {getCategoryLabel(asset) && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-100">
                          {getCategoryLabel(asset)}
                        </span>
                      )}
                      {asset.serial_number && (
                        <span className="text-xs text-gray-500 font-mono bg-gray-100 px-2 py-0.5 rounded">
                          {asset.serial_number}
                        </span>
                      )}
                      {asset.department_name && (
                        <span className="text-xs text-gray-500 bg-gray-50 px-2 py-0.5 rounded border border-gray-100">
                          {asset.department_name}
                        </span>
                      )}
                      {asset.team_name && (
                        <span className="text-xs text-gray-500 bg-gray-50 px-2 py-0.5 rounded border border-gray-100">
                          {asset.team_name}
                        </span>
                      )}
                      {asset.manager_name && (
                        <span className="text-xs text-gray-500 bg-gray-50 px-2 py-0.5 rounded border border-gray-100">
                          {asset.manager_name}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {showModal && (
        <AssetFormModal
          editing={editing}
          categories={categories}
          onClose={() => setShowModal(false)}
          onSave={() => { setShowModal(false); fetchAll(); }}
        />
      )}

      {showExcelModal && (
        <ExcelExportModal
          assetCount={targetAssets.length}
          exporting={exporting}
          onClose={() => setShowExcelModal(false)}
          onExport={async (includeQr) => {
            setExporting(true);
            try {
              await exportExcel(targetAssets, categories, includeQr);
              setShowExcelModal(false);
            } finally {
              setExporting(false);
            }
          }}
        />
      )}

      {showLabelModal && (
        <LabelPrintModal
          printing={printing}
          onClose={() => setShowLabelModal(false)}
          onPrint={async (logoDataUrl) => {
            setPrinting(true);
            try {
              await printLabels(targetAssets, categories, logoDataUrl);
              setShowLabelModal(false);
            } finally {
              setPrinting(false);
            }
          }}
        />
      )}

      <AssetDetailDrawer
        pid={drawerPid}
        onClose={() => setDrawerPid(null)}
        onSaved={() => fetchAll()}
      />
    </Layout>
  );
};

export default AssetsPage;
