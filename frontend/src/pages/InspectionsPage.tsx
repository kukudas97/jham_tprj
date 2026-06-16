import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Layout from '../components/Layout';
import AssetDetailDrawer from '../components/AssetDetailDrawer';
import * as inspectionsApi from '../api/inspections';
import * as assetsApi from '../api/assets';
import * as departmentsApi from '../api/departments';
import type { Department, InspectionListItem, InspectionResult, InspectionType } from '../api/types';

const INSPECTION_TYPES: InspectionType[] = ['일반점검', '기간점검'];
const INSPECTION_RESULTS: InspectionResult[] = ['점검완료', '재점검필요', '폐기처리', '기타'];

const RESULT_BADGE: Record<InspectionResult, string> = {
  점검완료: 'bg-emerald-100 text-emerald-700',
  재점검필요: 'bg-amber-100 text-amber-700',
  폐기처리: 'bg-red-100 text-red-700',
  기타: 'bg-gray-100 text-gray-600',
};

const InspectionsPage: React.FC = () => {
  const [items, setItems] = useState<InspectionListItem[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(false);

  // 검색 조건
  const [filterAssetName, setFilterAssetName] = useState('');
  const [filterDeptPid, setFilterDeptPid] = useState('');
  const [filterTeamPid, setFilterTeamPid] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterResult, setFilterResult] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');

  // 체크박스 선택
  const [selectedPids, setSelectedPids] = useState<Set<string>>(new Set());

  // 자산 상세 드로어
  const [drawerAssetPid, setDrawerAssetPid] = useState<string | null>(null);

  // 정렬
  const [sortKey, setSortKey] = useState<string>('created_at');
  const [sortAsc, setSortAsc] = useState(false);

  useEffect(() => {
    departmentsApi.list().then(setDepartments).catch(() => {});
    handleSearch();
  }, []);

  const handleSearch = useCallback(() => {
    setLoading(true);
    setSelectedPids(new Set());
    inspectionsApi.list({
      asset_name: filterAssetName || undefined,
      department_pid: filterDeptPid || undefined,
      team_pid: filterTeamPid || undefined,
      inspection_type: filterType || undefined,
      inspection_result: filterResult || undefined,
      date_from: filterDateFrom || undefined,
      date_to: filterDateTo || undefined,
    }).then(setItems).catch(() => {}).finally(() => setLoading(false));
  }, [filterAssetName, filterDeptPid, filterTeamPid, filterType, filterResult, filterDateFrom, filterDateTo]);

  const teamOptions = useMemo(() => {
    if (!filterDeptPid) return departments.flatMap((d) => d.teams);
    return departments.find((d) => d.pid === filterDeptPid)?.teams ?? [];
  }, [departments, filterDeptPid]);

  const handleSort = (key: string) => {
    if (sortKey === key) setSortAsc((a) => !a);
    else { setSortKey(key); setSortAsc(true); }
  };

  const sorted = useMemo(() => {
    return [...items].sort((a, b) => {
      const av = (a as unknown as Record<string, unknown>)[sortKey] as string ?? '';
      const bv = (b as unknown as Record<string, unknown>)[sortKey] as string ?? '';
      return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av);
    });
  }, [items, sortKey, sortAsc]);

  const allSelected = sorted.length > 0 && sorted.every((item) => selectedPids.has(item.pid));
  const someSelected = selectedPids.size > 0;

  const handleSelectAll = () => {
    if (allSelected) {
      setSelectedPids(new Set());
    } else {
      setSelectedPids(new Set(sorted.map((item) => item.pid)));
    }
  };

  const handleTogglePid = (pid: string) => {
    setSelectedPids((prev) => {
      const next = new Set(prev);
      if (next.has(pid)) next.delete(pid);
      else next.add(pid);
      return next;
    });
  };

  const handleBulkDelete = async () => {
    if (selectedPids.size === 0) return;
    if (!window.confirm(`선택한 점검이력 ${selectedPids.size}건을 삭제하시겠습니까?`)) return;
    try {
      await assetsApi.bulkDeleteInspections(Array.from(selectedPids));
      setSelectedPids(new Set());
      handleSearch();
    } catch {
      alert('삭제 중 오류가 발생했습니다.');
    }
  };

  const SortIcon = ({ col }: { col: string }) => (
    <span className="ml-0.5 text-gray-300">
      {sortKey === col ? (sortAsc ? '↑' : '↓') : '↕'}
    </span>
  );

  return (
    <Layout>
      <div className="p-4 sm:p-6 space-y-4">
        <h1 className="text-xl font-bold text-gray-900">점검관리</h1>

        {/* 검색 조건 */}
        <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <input
              type="text"
              value={filterAssetName}
              onChange={(e) => setFilterAssetName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="자산명 검색"
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <select
              value={filterDeptPid}
              onChange={(e) => { setFilterDeptPid(e.target.value); setFilterTeamPid(''); }}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
            >
              <option value="">전체 부서</option>
              {departments.map((d) => (
                <option key={d.pid} value={d.pid}>{d.name}</option>
              ))}
            </select>
            <select
              value={filterTeamPid}
              onChange={(e) => setFilterTeamPid(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
            >
              <option value="">전체 팀</option>
              {teamOptions.map((t) => (
                <option key={t.pid} value={t.pid}>{t.name}</option>
              ))}
            </select>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
            >
              <option value="">전체 점검유형</option>
              {INSPECTION_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <select
              value={filterResult}
              onChange={(e) => setFilterResult(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
            >
              <option value="">전체 점검결과</option>
              {INSPECTION_RESULTS.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
            <div className="flex gap-2 items-center">
              <input
                type="date"
                value={filterDateFrom}
                onChange={(e) => setFilterDateFrom(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <span className="text-gray-400 text-xs flex-shrink-0">~</span>
              <input
                type="date"
                value={filterDateTo}
                onChange={(e) => setFilterDateTo(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleSearch}
              disabled={loading}
              className="px-5 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {loading ? '조회 중...' : '조회'}
            </button>
          </div>
        </div>

        {/* 그리드 */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <span className="text-sm text-gray-500">
              총 <span className="font-semibold text-gray-900">{items.length}</span>건
              {someSelected && (
                <span className="ml-2 text-indigo-600 font-medium">{selectedPids.size}건 선택됨</span>
              )}
            </span>
            {someSelected && (
              <button
                type="button"
                onClick={handleBulkDelete}
                className="px-4 py-1.5 bg-red-500 text-white text-sm font-medium rounded-lg hover:bg-red-600 transition-colors"
              >
                선택 삭제 ({selectedPids.size})
              </button>
            )}
          </div>

          {/* 데스크탑 테이블 */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-4 py-3 w-10">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={handleSelectAll}
                      className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                  </th>
                  {[
                    { key: 'asset_name', label: '자산명' },
                    { key: 'asset_serial_number', label: '자산번호' },
                    { key: 'department_name', label: '부서명' },
                    { key: 'team_name', label: '팀명' },
                    { key: 'inspection_date', label: '점검일자' },
                    { key: 'inspection_type', label: '점검유형' },
                    { key: 'inspection_result', label: '점검결과' },
                    { key: 'remarks', label: '비고' },
                  ].map(({ key, label }) => (
                    <th
                      key={key}
                      onClick={() => handleSort(key)}
                      className="text-left text-xs font-semibold text-gray-500 px-4 py-3 cursor-pointer hover:text-gray-700 whitespace-nowrap select-none"
                    >
                      {label}<SortIcon col={key} />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading ? (
                  <tr>
                    <td colSpan={9} className="text-center py-12 text-gray-400 text-sm">조회 중...</td>
                  </tr>
                ) : sorted.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center py-12 text-gray-400 text-sm">점검 이력이 없습니다</td>
                  </tr>
                ) : sorted.map((item) => (
                  <tr
                    key={item.pid}
                    onClick={() => { setDrawerAssetPid(item.asset_pid ?? null); }}
                    className={`hover:bg-indigo-50/30 cursor-pointer transition-colors ${selectedPids.has(item.pid) ? 'bg-indigo-50/50' : ''}`}
                  >
                    <td
                      className="px-4 py-3 w-10"
                      onClick={(e) => { e.stopPropagation(); handleTogglePid(item.pid); }}
                    >
                      <input
                        type="checkbox"
                        checked={selectedPids.has(item.pid)}
                        onChange={() => handleTogglePid(item.pid)}
                        className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                      />
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-800">{item.asset_name ?? '-'}</td>
                    <td className="px-4 py-3 text-gray-500 font-mono text-xs">{item.asset_serial_number ?? '-'}</td>
                    <td className="px-4 py-3 text-gray-600">{item.department_name ?? '-'}</td>
                    <td className="px-4 py-3 text-gray-600">{item.team_name ?? '-'}</td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                      {item.inspection_date ?? (item.period_start ? `${item.period_start}~${item.period_end}` : '-')}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-md text-xs font-medium ${item.inspection_type === '기간점검' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                        {item.inspection_type}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {item.inspection_result ? (
                        <span className={`px-2 py-0.5 rounded-md text-xs font-medium ${RESULT_BADGE[item.inspection_result]}`}>
                          {item.inspection_result}
                        </span>
                      ) : '-'}
                    </td>
                    <td className="px-4 py-3 text-gray-500 max-w-[160px] truncate">{item.remarks ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 모바일 카드 */}
          <div className="sm:hidden divide-y divide-gray-50">
            {loading ? (
              <div className="text-center py-10 text-gray-400 text-sm">조회 중...</div>
            ) : sorted.length === 0 ? (
              <div className="text-center py-10 text-gray-400 text-sm">점검 이력이 없습니다</div>
            ) : sorted.map((item) => (
              <div
                key={item.pid}
                className={`p-4 flex items-start gap-3 ${selectedPids.has(item.pid) ? 'bg-indigo-50/50' : 'hover:bg-indigo-50/30'}`}
              >
                <div
                  className="pt-0.5 flex-shrink-0"
                  onClick={(e) => { e.stopPropagation(); handleTogglePid(item.pid); }}
                >
                  <input
                    type="checkbox"
                    checked={selectedPids.has(item.pid)}
                    onChange={() => handleTogglePid(item.pid)}
                    className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                </div>
                <div
                  className="flex-1 cursor-pointer"
                  onClick={() => { setDrawerAssetPid(item.asset_pid ?? null); }}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <p className="font-medium text-gray-800 text-sm">{item.asset_name ?? '-'}</p>
                      <p className="text-xs text-gray-400 font-mono">{item.asset_serial_number ?? '-'}</p>
                    </div>
                    {item.inspection_result && (
                      <span className={`px-2 py-0.5 rounded-md text-xs font-medium flex-shrink-0 ${RESULT_BADGE[item.inspection_result]}`}>
                        {item.inspection_result}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs text-gray-500">
                    {item.department_name && <span>{item.department_name}</span>}
                    {item.team_name && <span>· {item.team_name}</span>}
                    <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${item.inspection_type === '기간점검' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                      {item.inspection_type}
                    </span>
                    <span>{item.inspection_date ?? (item.period_start ? `${item.period_start}~${item.period_end}` : '')}</span>
                  </div>
                  {item.remarks && <p className="text-xs text-gray-400 mt-1 truncate">{item.remarks}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <AssetDetailDrawer
        pid={drawerAssetPid}
        onClose={() => setDrawerAssetPid(null)}
        onSaved={() => handleSearch()}
      />
    </Layout>
  );
};

export default InspectionsPage;
