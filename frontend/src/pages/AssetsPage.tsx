import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import * as assetsApi from '../api/assets';
import * as categoriesApi from '../api/categories';
import * as departmentsApi from '../api/departments';
import * as inspectionsApi from '../api/inspections';
import type { Asset, Category, Department } from '../api/types';
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

  const HDR_REQUIRED = '4F46E5'; // 필수 - 짙은 보라
  const HDR_OPT     = '818CF8'; // 선택 - 옅은 보라
  const HDR_CUSTOM  = '1E3A5F'; // 커스텀 - 남색
  const BORDER = { style: 'thin' as const, color: { argb: 'FFDDDDDD' } };

  // 업로드 양식과 동일한 컬럼 순서: 자산명,부서명,팀명,관리자,품명,식별번호,평가금액,[커스텀],[QR]
  const BASE_COLS = [
    { key: 'name',      header: '자산명',   width: 16, required: true  },
    { key: 'dept',      header: '부서명',   width: 16, required: true  },
    { key: 'team',      header: '팀명',     width: 14, required: false },
    { key: 'manager',   header: '관리자',   width: 12, required: false },
    { key: 'category',  header: '품명',     width: 24, required: true  },
    { key: 'serial',    header: '식별번호', width: 20, required: true  },
    { key: 'appraised', header: '평가금액', width: 18, required: true  },
  ];

  for (const parent of categories) {
    const catAssets = assets.filter(
      (a) => a.category_pid === parent.pid || parent.children.some((ch) => ch.pid === a.category_pid),
    );
    if (catAssets.length === 0) continue;

    const fieldDefs = parent.field_defs ?? [];
    const appraisedColNum = 7; // 평가금액 위치
    const qrColNum = BASE_COLS.length + fieldDefs.length + 1;

    const sheet = workbook.addWorksheet(parent.name.slice(0, 31));
    sheet.columns = [
      ...BASE_COLS.map((c) => ({ key: c.key, width: c.width })),
      ...fieldDefs.map((def) => ({ key: `field_${def.pid}`, width: 16 })),
      ...(includeQr ? [{ key: 'qr', width: 13 }] : []),
    ];

    const headers = [
      ...BASE_COLS.map((c) => c.header),
      ...fieldDefs.map((def) => def.field_label),
      ...(includeQr ? ['QR코드'] : []),
    ];
    const headerRow = sheet.addRow(headers);
    headerRow.height = 22;
    headerRow.eachCell((cell, colNum) => {
      const baseCol = BASE_COLS[colNum - 1];
      let color: string;
      if (!baseCol) {
        // 커스텀 필드 또는 QR
        const isQr = includeQr && colNum === BASE_COLS.length + fieldDefs.length + 1;
        color = isQr ? HDR_OPT : HDR_CUSTOM;
      } else {
        color = baseCol.required ? HDR_REQUIRED : HDR_OPT;
      }
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: `FF${color}` },
      };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = { bottom: BORDER, right: BORDER };
    });

    const ROW_HEIGHT = includeQr ? 72 : 18;

    for (const [i, asset] of catAssets.entries()) {
      const rowNum = i + 2;
      const customValues = fieldDefs.map((def) => {
        const fv = asset.field_values?.find((v) => v.field_def_pid === def.pid);
        return fv?.value ?? '';
      });
      const row = sheet.addRow([
        asset.category_name ?? '',
        asset.department_name ?? '',
        asset.team_name ?? '',
        asset.manager_name ?? '',
        asset.name,
        asset.serial_number ?? '',
        asset.appraised_value || null,
        ...customValues,
        ...(includeQr ? [''] : []),
      ]);
      row.height = ROW_HEIGHT;

      row.eachCell((cell, col) => {
        cell.alignment = { vertical: 'middle', horizontal: 'left' };
        cell.border = { bottom: BORDER, right: BORDER };
        if (col === appraisedColNum) {
          cell.numFmt = '#,##0';
          cell.alignment = { vertical: 'middle', horizontal: 'right' };
        }
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

interface SelectOption {
  value: string;
  label: string;
  indent?: boolean;
}

const MultiSelectDropdown: React.FC<{
  options: SelectOption[];
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder: string;
}> = ({ options, selected, onChange, placeholder }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const toggle = (value: string) => {
    onChange(
      selected.includes(value)
        ? selected.filter((v) => v !== value)
        : [...selected, value],
    );
  };

  const buttonLabel = selected.length === 0 ? placeholder : `${placeholder} (${selected.length})`;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-1.5 px-3 py-2.5 border rounded-xl text-sm bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
          selected.length > 0
            ? 'border-indigo-400 text-indigo-700 bg-indigo-50/30'
            : 'border-gray-200 text-gray-600'
        }`}
      >
        <span className="whitespace-nowrap">{buttonLabel}</span>
        <svg
          className={`w-3.5 h-3.5 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="absolute z-50 mt-1 min-w-full w-max max-w-xs bg-white border border-gray-200 rounded-xl shadow-lg py-1 max-h-60 overflow-y-auto">
          {selected.length > 0 && (
            <div className="px-3 py-1.5 border-b border-gray-100">
              <button
                type="button"
                onClick={() => onChange([])}
                className="text-xs text-indigo-500 hover:text-indigo-700"
              >
                전체 해제
              </button>
            </div>
          )}
          {options.map((opt) => (
            <label
              key={opt.value}
              className="flex items-center gap-2 px-3 py-2 hover:bg-indigo-50 cursor-pointer text-sm"
            >
              <input
                type="checkbox"
                checked={selected.includes(opt.value)}
                onChange={() => toggle(opt.value)}
                className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 flex-shrink-0"
              />
              <span className={opt.indent ? 'text-gray-500 pl-2' : 'text-gray-700'}>
                {opt.label}
              </span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
};

const AssetsPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCategoryPids, setFilterCategoryPids] = useState<string[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Asset | null>(null);
  const [exporting, setExporting] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [showExcelModal, setShowExcelModal] = useState(false);
  const [showLabelModal, setShowLabelModal] = useState(false);
  const [selectedPids, setSelectedPids] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [filterDeptPids, setFilterDeptPids] = useState<string[]>([]);
  const [filterTeamPids, setFilterTeamPids] = useState<string[]>([]);
  const [filterInspectionResults, setFilterInspectionResults] = useState<string[]>([]);
  const [filterYear, setFilterYear] = useState<string>(String(new Date().getFullYear()));
  const [yearInspectionMap, setYearInspectionMap] = useState<Map<string, { date: string | null; result: string | null }>>(new Map());
  const [sortConfig, setSortConfig] = useState<{ key: string; dir: 'asc' | 'desc' } | null>(null);
  const [drawerPid, setDrawerPid] = useState<string | null>(() => searchParams.get('open'));
  const [deletingPids, setDeletingPids] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const allCheckboxRef = useRef<HTMLInputElement>(null);

  const fetchAll = async () => {
    try {
      const [assetData, catData, deptData] = await Promise.all([
        assetsApi.list(),
        categoriesApi.list(),
        departmentsApi.list(),
      ]);
      setAssets(assetData);
      setCategories(catData);
      setDepartments(deptData);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  // 필터 변경 시 선택 및 페이지 초기화
  useEffect(() => { setSelectedPids(new Set()); setPage(1); }, [search, filterCategoryPids, filterDeptPids, filterTeamPids, filterInspectionResults]);

  // 연도 선택 시 해당 연도의 점검 데이터 fetch
  useEffect(() => {
    if (!filterYear) {
      setYearInspectionMap(new Map());
      return;
    }
    inspectionsApi.list({
      date_from: `${filterYear}-01-01`,
      date_to: `${filterYear}-12-31`,
    }).then((items) => {
      const map = new Map<string, { date: string | null; result: string | null }>();
      for (const item of items) {
        if (!item.asset_pid) continue;
        const existing = map.get(item.asset_pid);
        if (
          !existing ||
          (item.inspection_date && (!existing.date || item.inspection_date > existing.date))
        ) {
          map.set(item.asset_pid, { date: item.inspection_date, result: item.inspection_result });
        }
      }
      setYearInspectionMap(map);
    });
  }, [filterYear]);

  // 부서 필터 변경 시 유효하지 않은 팀 선택 제거
  useEffect(() => {
    if (filterDeptPids.length === 0) return;
    const validTeamPids = new Set(
      departments
        .filter((d) => filterDeptPids.includes(d.pid))
        .flatMap((d) => d.teams.map((t) => t.pid)),
    );
    setFilterTeamPids((prev) => {
      const next = prev.filter((pid) => validTeamPids.has(pid));
      return next.length === prev.length ? prev : next;
    });
  }, [filterDeptPids, departments]);

  const openCreate = () => { setEditing(null); setShowModal(true); };
  const openEdit = (asset: Asset) => { setEditing(asset); setShowModal(true); };

  const handleDelete = async (pid: string) => {
    if (!confirm('이 자산을 삭제하시겠습니까?')) return;
    setDeletingPids((prev) => new Set(prev).add(pid));
    try {
      await assetsApi.remove(pid);
      fetchAll();
    } finally {
      setDeletingPids((prev) => { const next = new Set(prev); next.delete(pid); return next; });
    }
  };

  const handleBulkDelete = async () => {
    if (selectedPids.size === 0) return;
    if (!confirm(`선택한 ${selectedPids.size}개의 자산을 삭제하시겠습니까?`)) return;
    setBulkDeleting(true);
    try {
      await Promise.all([...selectedPids].map((pid) => assetsApi.remove(pid)));
      setSelectedPids(new Set());
      fetchAll();
    } finally {
      setBulkDeleting(false);
    }
  };

  const getFieldValue = (asset: Asset, label: string) =>
    asset.field_values?.find((fv) => fv.field_label === label || fv.field_name === label)?.value ?? null;

  // 선택된 분류에 해당하는 모든 category_pid 집합
  const filterCategoryPidSet = useMemo(() => {
    if (filterCategoryPids.length === 0) return null;
    const result = new Set<string>();
    for (const pid of filterCategoryPids) {
      const parent = categories.find((c) => c.pid === pid);
      if (parent) {
        result.add(parent.pid);
        parent.children.forEach((c) => result.add(c.pid));
      } else {
        result.add(pid);
      }
    }
    return result;
  }, [filterCategoryPids, categories]);

  const teamOptions = useMemo(
    () => filterDeptPids.length > 0
      ? departments.filter((d) => filterDeptPids.includes(d.pid)).flatMap((d) => d.teams)
      : departments.flatMap((d) => d.teams),
    [departments, filterDeptPids],
  );

  const yearOptions = useMemo(() => {
    const years = new Set<string>();
    for (const a of assets) {
      if (a.last_inspection_date) years.add(a.last_inspection_date.slice(0, 4));
    }
    return Array.from(years).sort((a, b) => Number(b) - Number(a));
  }, [assets]);

  const getDisplayInspection = (asset: Asset) => {
    if (filterYear) {
      const d = yearInspectionMap.get(asset.pid);
      return { date: d?.date ?? null, result: d?.result ?? null };
    }
    return { date: asset.last_inspection_date, result: asset.last_inspection_result };
  };

  const categoryOptions = useMemo(
    () => categories.flatMap((cat) => [
      { value: cat.pid, label: `${cat.name} (전체)`, indent: false },
      ...cat.children.map((child) => ({ value: child.pid, label: `↳ ${child.name}`, indent: true })),
    ]),
    [categories],
  );

  const deptOptions = useMemo(
    () => departments.map((d) => ({ value: d.pid, label: d.name, indent: false })),
    [departments],
  );

  const teamSelectOptions = useMemo(
    () => teamOptions.map((t) => ({ value: t.pid, label: t.name, indent: false })),
    [teamOptions],
  );

  const INSPECTION_RESULT_OPTIONS: SelectOption[] = [
    { value: '점검완료', label: '점검완료' },
    { value: '재점검필요', label: '재점검필요' },
    { value: '폐기처리', label: '폐기처리' },
    { value: '__none__', label: '미점검' },
  ];

  const filtered = assets.filter((a) => {
    const q = search.toLowerCase();
    const matchSearch =
      a.name.toLowerCase().includes(q) ||
      (a.serial_number ?? '').toLowerCase().includes(q) ||
      (a.manager_name ?? '').toLowerCase().includes(q);
    const matchCategory = !filterCategoryPidSet || filterCategoryPidSet.has(a.category_pid ?? '');
    const matchDept = filterDeptPids.length === 0 || filterDeptPids.includes(a.department_pid ?? '');
    const matchTeam = filterTeamPids.length === 0 || filterTeamPids.includes(a.team_pid ?? '');
    const matchInspection = filterInspectionResults.length === 0 || (
      filterInspectionResults.includes(a.last_inspection_result ?? '__none__') ||
      (!a.last_inspection_result && filterInspectionResults.includes('__none__'))
    );
    return matchSearch && matchCategory && matchDept && matchTeam && matchInspection;
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
      else if (sortConfig.key === 'location') { av = a.department_name ?? ''; bv = b.department_name ?? ''; }
      else if (sortConfig.key === '팀명') { av = a.team_name ?? ''; bv = b.team_name ?? ''; }
      else if (sortConfig.key === '관리자') { av = a.manager_name ?? ''; bv = b.manager_name ?? ''; }
      else if (sortConfig.key === 'appraised_value') {
        const cmp = (a.appraised_value ?? 0) - (b.appraised_value ?? 0);
        return sortConfig.dir === 'asc' ? cmp : -cmp;
      }
      else if (sortConfig.key === 'last_inspection_date') {
        av = a.last_inspection_date ?? ''; bv = b.last_inspection_date ?? '';
      }
      else if (sortConfig.key === 'last_inspection_result') {
        av = a.last_inspection_result ?? ''; bv = b.last_inspection_result ?? '';
      }
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

  const selectedAssets = sorted.filter((a) => selectedPids.has(a.pid));
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
  const targetAssets = selectedPids.size > 0 ? selectedAssets : sorted;

  const getCategoryLabel = (asset: Asset) => {
    if (!asset.category_name) return null;
    const parent = categories.find((c) => c.children.some((ch) => ch.pid === asset.category_pid));
    return parent ? `${parent.name} > ${asset.category_name}` : asset.category_name;
  };

  const categorizedCount = assets.filter((a) => a.category_pid).length;
  const hasFilter = filterCategoryPids.length > 0 || filterDeptPids.length > 0 || filterTeamPids.length > 0 || filterInspectionResults.length > 0 || filterYear !== '';

  return (
    <Layout>
      <div className="p-4 md:p-6 max-w-[1600px]">
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
                disabled={bulkDeleting}
                className="flex items-center gap-1.5 px-3 py-2 bg-red-50 border border-red-200 text-red-600 text-sm font-medium rounded-xl hover:bg-red-100 disabled:opacity-60 disabled:cursor-not-allowed transition-colors shadow-sm"
                title={`선택한 ${selectedPids.size}개 삭제`}
              >
                {bulkDeleting ? (
                  <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                )}
                <span>{bulkDeleting ? '삭제 중...' : `${selectedPids.size}개 삭제`}</span>
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
        <div className="grid grid-cols-3 gap-2 md:gap-3 mb-4 md:mb-6">
          <div className="bg-white rounded-xl border border-gray-200 p-3 md:p-4 shadow-sm">
            <p className="text-xs font-medium text-gray-500 mb-1 truncate">전체 자산</p>
            <p className="text-xl md:text-2xl font-bold text-gray-900">{loading ? '-' : assets.length}</p>
            <p className="text-xs text-gray-400 mt-0.5 hidden sm:block">등록된 자산</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-3 md:p-4 shadow-sm">
            <p className="text-xs font-medium text-gray-500 mb-1 truncate">평가금액</p>
            <p className="text-sm md:text-xl font-bold text-indigo-600 truncate">
              {loading ? '-' : filtered.reduce((s, a) => s + (a.appraised_value ?? 0), 0).toLocaleString('ko-KR')}
            </p>
            <p className="text-xs text-gray-400 mt-0.5 hidden sm:block">필터 적용 합계</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-3 md:p-4 shadow-sm">
            <p className="text-xs font-medium text-gray-500 mb-1 truncate">검색 결과</p>
            <p className="text-xl md:text-2xl font-bold text-gray-700">{loading ? '-' : filtered.length}</p>
            <p className="text-xs text-gray-400 mt-0.5 hidden sm:block">필터 적용 결과</p>
          </div>
        </div>

        {/* 검색 + 필터 */}
        <div className="mb-4 flex flex-wrap gap-2">
          <div className="relative w-full sm:flex-1 sm:max-w-sm">
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
          <MultiSelectDropdown
            options={categoryOptions}
            selected={filterCategoryPids}
            onChange={setFilterCategoryPids}
            placeholder="전체 분류"
          />
          <MultiSelectDropdown
            options={deptOptions}
            selected={filterDeptPids}
            onChange={setFilterDeptPids}
            placeholder="전체 부서"
          />
          <MultiSelectDropdown
            options={teamSelectOptions}
            selected={filterTeamPids}
            onChange={setFilterTeamPids}
            placeholder="전체 팀"
          />
          <select
            value={filterYear}
            onChange={(e) => setFilterYear(e.target.value)}
            className={`flex items-center px-3 py-2.5 border rounded-xl text-sm bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
              filterYear ? 'border-indigo-400 text-indigo-700 bg-indigo-50/30' : 'border-gray-200 text-gray-600'
            }`}
          >
            <option value="">전체 연도</option>
            {yearOptions.map((y) => (
              <option key={y} value={String(y)}>{y}년</option>
            ))}
          </select>
          <MultiSelectDropdown
            options={INSPECTION_RESULT_OPTIONS}
            selected={filterInspectionResults}
            onChange={setFilterInspectionResults}
            placeholder="점검결과"
          />
          {(hasFilter) && (
            <button
              type="button"
              onClick={() => { setFilterCategoryPids([]); setFilterDeptPids([]); setFilterTeamPids([]); setFilterInspectionResults([]); setFilterYear(''); }}
              className="flex items-center gap-1 px-3 py-2.5 text-sm text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
              title="필터 초기화"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              <span className="hidden sm:inline text-xs">필터 초기화</span>
            </button>
          )}
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
              {search || hasFilter ? '검색 조건을 변경해 보세요' : '자산 등록 버튼을 눌러 첫 자산을 추가하세요'}
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
                      { key: 'category', label: '자산명' },
                      { key: 'location', label: '부서명' },
                      { key: '팀명', label: '팀명' },
                      { key: '관리자', label: '관리자' },
                      { key: 'name', label: '품명' },
                      { key: 'serial', label: '식별번호' },
                      { key: 'appraised_value', label: '평가금액' },
                      { key: 'last_inspection_date', label: '점검일자' },
                      { key: 'last_inspection_result', label: '점검결과' },
                    ].map(({ key, label }) => (
                      <th
                        key={key}
                        onClick={() => handleSort(key)}
                        className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer select-none hover:bg-gray-100 transition-colors whitespace-nowrap"
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
                          {getCategoryLabel(asset) ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-lg text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-100">
                              {getCategoryLabel(asset)}
                            </span>
                          ) : (
                            <span className="text-gray-300">-</span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-gray-500">{asset.department_name ?? '-'}</td>
                        <td className="px-5 py-3.5 text-gray-500">{asset.team_name ?? '-'}</td>
                        <td className="px-5 py-3.5 text-gray-500">{asset.manager_name ?? '-'}</td>
                        <td className="px-5 py-3.5">
                          <button
                            type="button"
                            onClick={() => setDrawerPid(asset.pid)}
                            className="font-medium text-indigo-600 hover:text-indigo-800 hover:underline text-left"
                          >
                            {asset.name}
                          </button>
                        </td>
                        <td className="px-5 py-3.5 text-gray-500 font-mono text-xs">{asset.serial_number ?? '-'}</td>
                        <td className="px-5 py-3.5 text-gray-500 text-right">
                          {asset.appraised_value > 0
                            ? `${asset.appraised_value.toLocaleString('ko-KR')}원`
                            : '-'}
                        </td>
                        <td className="px-5 py-3.5 text-gray-500 text-sm">
                          {(() => { const d = getDisplayInspection(asset); return d.date ?? '-'; })()}
                        </td>
                        <td className="px-5 py-3.5">
                          {(() => {
                            const d = getDisplayInspection(asset);
                            return d.result ? (
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${
                                d.result === '점검완료'
                                  ? 'bg-green-50 text-green-700 border border-green-200'
                                  : d.result === '재점검필요'
                                    ? 'bg-yellow-50 text-yellow-700 border border-yellow-200'
                                    : d.result === '폐기처리'
                                      ? 'bg-red-50 text-red-700 border border-red-200'
                                      : 'bg-gray-50 text-gray-600 border border-gray-200'
                              }`}>
                                {d.result}
                              </span>
                            ) : (
                              <span className="text-gray-300">-</span>
                            );
                          })()}
                        </td>
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
                              disabled={deletingPids.has(asset.pid)}
                              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-50 rounded-lg transition-colors"
                              title="삭제"
                            >
                              {deletingPids.has(asset.pid) ? (
                                <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                              ) : (
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              )}
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
                          disabled={deletingPids.has(asset.pid)}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-50 rounded-lg transition-colors"
                        >
                          {deletingPids.has(asset.pid) ? (
                            <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                          ) : (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          )}
                        </button>
                      </div>
                    </div>
                    <div className="mt-2 pl-7 space-y-1">
                      <div className="flex flex-wrap gap-1.5">
                        {getCategoryLabel(asset) && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-100">
                            {getCategoryLabel(asset)}
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
                      <div className="flex flex-wrap gap-1.5">
                        {asset.serial_number && (
                          <span className="text-xs text-gray-500 font-mono bg-gray-100 px-2 py-0.5 rounded">
                            {asset.serial_number}
                          </span>
                        )}
                        {asset.appraised_value > 0 && (
                          <span className="text-xs text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100 font-medium">
                            {asset.appraised_value.toLocaleString('ko-KR')}원
                          </span>
                        )}
                        {(() => {
                          const d = getDisplayInspection(asset);
                          return (
                            <>
                              {d.date && (
                                <span className="text-xs text-gray-500 bg-gray-50 px-2 py-0.5 rounded border border-gray-100">
                                  점검일 {d.date}
                                </span>
                              )}
                              {d.result && (
                                <span className={`text-xs px-2 py-0.5 rounded border font-medium ${
                                  d.result === '점검완료'
                                    ? 'bg-green-50 text-green-700 border-green-200'
                                    : d.result === '재점검필요'
                                      ? 'bg-yellow-50 text-yellow-700 border-yellow-200'
                                      : d.result === '폐기처리'
                                        ? 'bg-red-50 text-red-700 border-red-200'
                                        : 'bg-gray-50 text-gray-600 border-gray-200'
                                }`}>
                                  {d.result}
                                </span>
                              )}
                            </>
                          );
                        })()}
                      </div>
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
        onClose={() => { setDrawerPid(null); setSearchParams({}); }}
        onSaved={() => fetchAll()}
      />
    </Layout>
  );
};

export default AssetsPage;
