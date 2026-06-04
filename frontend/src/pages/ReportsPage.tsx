import React, { useEffect, useState } from 'react';
import * as assetsApi from '../api/assets';
import type { CategoryByDeptResponse, DepartmentValueSummary } from '../api/types';
import Layout from '../components/Layout';

const fmt = (v: number) => v.toLocaleString('ko-KR');

// ─── Excel export: 부서/팀별 평가금액 ────────────────────────────────────────
async function exportDeptValueExcel(data: DepartmentValueSummary[]) {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'JHAM';
  const ws = wb.addWorksheet('부서_팀별_평가금액');

  const INDIGO = 'FF4F46E5';
  const TEAL = 'FF0D9488';
  const ALT = 'FFF5F5FF';
  const BORDER = { style: 'thin' as const, color: { argb: 'FFDDDDDD' } };

  ws.columns = [
    { key: 'dept', width: 20 },
    { key: 'team', width: 20 },
    { key: 'count', width: 10 },
    { key: 'value', width: 18 },
  ];

  const hdr = ws.addRow(['부서', '팀', '자산 수', '평가금액 합계']);
  hdr.height = 22;
  hdr.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: INDIGO } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = { bottom: BORDER, right: BORDER };
  });

  let rowIdx = 0;
  for (const dept of data) {
    // 부서 합계 행
    const deptRow = ws.addRow([
      dept.department_name ?? '미지정',
      '(합계)',
      dept.asset_count,
      dept.total_appraised_value,
    ]);
    deptRow.height = 20;
    deptRow.getCell(1).font = { bold: true };
    deptRow.getCell(2).font = { bold: true, italic: true, color: { argb: 'FF888888' } };
    deptRow.getCell(3).alignment = { horizontal: 'center' };
    deptRow.getCell(4).numFmt = '#,##0';
    deptRow.getCell(4).alignment = { horizontal: 'right' };
    deptRow.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TEAL + '22' } };
      cell.border = { bottom: BORDER, right: BORDER };
    });
    rowIdx++;

    // 팀별 행 (팀이 1개이고 null이면 생략)
    const hasTeams = dept.teams.length > 1 || (dept.teams.length === 1 && dept.teams[0].team_name !== null);
    if (hasTeams) {
      for (const team of dept.teams) {
        const teamRow = ws.addRow([
          '',
          team.team_name ?? '미지정',
          team.asset_count,
          team.total_appraised_value,
        ]);
        teamRow.height = 20;
        teamRow.getCell(3).alignment = { horizontal: 'center' };
        teamRow.getCell(4).numFmt = '#,##0';
        teamRow.getCell(4).alignment = { horizontal: 'right' };
        if (rowIdx % 2 === 1) {
          teamRow.eachCell((cell) => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ALT } };
          });
        }
        teamRow.eachCell((cell) => {
          cell.border = { bottom: BORDER, right: BORDER };
        });
        rowIdx++;
      }
    }
  }

  // 전체 합계 행
  const grandCount = data.reduce((s, d) => s + d.asset_count, 0);
  const grandValue = data.reduce((s, d) => s + d.total_appraised_value, 0);
  const totalRow = ws.addRow(['전체 합계', '', grandCount, grandValue]);
  totalRow.height = 22;
  totalRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: INDIGO } };
    cell.border = { bottom: BORDER, right: BORDER };
  });
  totalRow.getCell(3).alignment = { horizontal: 'center' };
  totalRow.getCell(4).numFmt = '#,##0';
  totalRow.getCell(4).alignment = { horizontal: 'right' };

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `부서팀별_평가금액_${new Date().toISOString().slice(0, 10)}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── Excel export: 부서별 자산분류 ───────────────────────────────────────────
async function exportCategoryExcel(data: CategoryByDeptResponse) {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'JHAM';
  const ws = wb.addWorksheet('부서별_자산분류');

  const INDIGO = 'FF4F46E5';
  const ALT = 'FFF5F5FF';
  const BORDER = { style: 'thin' as const, color: { argb: 'FFDDDDDD' } };

  const cats = data.categories.map((c) => c ?? '미분류');

  // 헤더 행 1: 부서 + 분류별(2컬럼씩) + 합계
  ws.columns = [
    { key: 'dept', width: 18 },
    ...cats.flatMap((c) => [
      { key: `cnt_${c}`, width: 10 },
      { key: `val_${c}`, width: 14 },
    ]),
    { key: 'total_cnt', width: 10 },
    { key: 'total_val', width: 16 },
  ];

  // 헤더 행: 분류명 병합
  const hdrRow1 = ws.addRow(['부서', ...cats.flatMap((c) => [c, '']), '합계', '']);
  hdrRow1.height = 22;
  hdrRow1.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: INDIGO } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = { bottom: BORDER, right: BORDER };
  });
  // 분류명 셀 병합 (2열씩)
  for (let i = 0; i < cats.length; i++) {
    const col = 2 + i * 2;
    ws.mergeCells(1, col, 1, col + 1);
  }
  const totalStart = 2 + cats.length * 2;
  ws.mergeCells(1, totalStart, 1, totalStart + 1);

  // 헤더 행 2: 수량 / 금액 반복
  const hdrRow2 = ws.addRow(['', ...cats.flatMap(() => ['수량', '금액(원)']), '수량', '금액(원)']);
  hdrRow2.height = 18;
  hdrRow2.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 9 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: INDIGO } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = { bottom: BORDER, right: BORDER };
  });

  // 데이터 행
  for (const [i, row] of data.rows.entries()) {
    const cells = row.cells.flatMap((c) => [c.count, c.total]);
    const dataRow = ws.addRow([
      row.department_name ?? '미지정',
      ...cells,
      row.total_count,
      row.total_value,
    ]);
    dataRow.height = 20;
    if (i % 2 === 0) {
      dataRow.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ALT } };
      });
    }
    dataRow.eachCell((cell, col) => {
      cell.border = { bottom: BORDER, right: BORDER };
      if (col > 1) {
        cell.numFmt = '#,##0';
        cell.alignment = { horizontal: 'right' };
      }
    });
  }

  // 합계 행
  const totCells = data.col_totals.flatMap((c) => [c.count, c.total]);
  const totRow = ws.addRow([
    '합계',
    ...totCells,
    data.grand_total_count,
    data.grand_total_value,
  ]);
  totRow.height = 22;
  totRow.eachCell((cell, col) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: INDIGO } };
    cell.border = { bottom: BORDER, right: BORDER };
    if (col > 1) {
      cell.numFmt = '#,##0';
      cell.alignment = { horizontal: 'right' };
    }
  });

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `부서별_자산분류_${new Date().toISOString().slice(0, 10)}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── Page ─────────────────────────────────────────────────────────────────────
type Tab = 'dept-value' | 'category-dept';

const ReportsPage: React.FC = () => {
  const [tab, setTab] = useState<Tab>('dept-value');
  const [deptData, setDeptData] = useState<DepartmentValueSummary[] | null>(null);
  const [catData, setCatData] = useState<CategoryByDeptResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    if (tab === 'dept-value') {
      assetsApi
        .getDeptValueSummary()
        .then(setDeptData)
        .catch(() => setError('데이터를 불러오지 못했습니다.'))
        .finally(() => setLoading(false));
    } else {
      assetsApi
        .getCategoryByDeptSummary()
        .then(setCatData)
        .catch(() => setError('데이터를 불러오지 못했습니다.'))
        .finally(() => setLoading(false));
    }
  }, [tab]);

  const handleExport = async () => {
    setExporting(true);
    try {
      if (tab === 'dept-value' && deptData) {
        await exportDeptValueExcel(deptData);
      } else if (tab === 'category-dept' && catData) {
        await exportCategoryExcel(catData);
      }
    } finally {
      setExporting(false);
    }
  };

  return (
    <Layout>
      <div className="p-4 md:p-6 max-w-screen-xl mx-auto">
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-lg font-bold text-gray-900">통계 리포트</h1>
            <p className="text-xs text-gray-500 mt-0.5">자산 현황을 집계하여 확인하고 엑셀로 다운로드합니다</p>
          </div>
          <button
            type="button"
            onClick={handleExport}
            disabled={exporting || loading || (tab === 'dept-value' ? !deptData : !catData)}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-xl hover:bg-emerald-700 disabled:opacity-50 transition-colors"
          >
            {exporting ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                생성 중...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Excel 다운로드
              </>
            )}
          </button>
        </div>

        {/* 탭 */}
        <div className="flex gap-1 mb-5 border-b border-gray-200">
          <button
            type="button"
            onClick={() => setTab('dept-value')}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === 'dept-value'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            부서/팀별 평가금액
          </button>
          <button
            type="button"
            onClick={() => setTab('category-dept')}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === 'category-dept'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            부서별 자산분류
          </button>
        </div>

        {/* 콘텐츠 */}
        {loading && (
          <div className="flex items-center justify-center py-20 text-gray-400 text-sm">
            <svg className="w-5 h-5 animate-spin mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            불러오는 중...
          </div>
        )}

        {error && (
          <div className="bg-red-50 text-red-600 rounded-xl px-4 py-3 text-sm">{error}</div>
        )}

        {/* Tab 1: 부서/팀별 평가금액 */}
        {!loading && !error && tab === 'dept-value' && deptData && (
          <DeptValueTable data={deptData} />
        )}

        {/* Tab 2: 부서별 자산분류 */}
        {!loading && !error && tab === 'category-dept' && catData && (
          <CategoryDeptTable data={catData} />
        )}
      </div>
    </Layout>
  );
};

// ─── 부서/팀별 평가금액 테이블 ────────────────────────────────────────────────
const DeptValueTable: React.FC<{ data: DepartmentValueSummary[] }> = ({ data }) => {
  const grandCount = data.reduce((s, d) => s + d.asset_count, 0);
  const grandValue = data.reduce((s, d) => s + d.total_appraised_value, 0);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-indigo-600 text-white">
              <th className="text-left px-4 py-3 font-semibold">부서</th>
              <th className="text-left px-4 py-3 font-semibold">팀</th>
              <th className="text-right px-4 py-3 font-semibold">자산 수</th>
              <th className="text-right px-4 py-3 font-semibold">평가금액 합계</th>
            </tr>
          </thead>
          <tbody>
            {data.map((dept, di) => {
              const hasTeams =
                dept.teams.length > 1 ||
                (dept.teams.length === 1 && dept.teams[0].team_name !== null);
              return (
                <React.Fragment key={dept.department_name ?? `dept-${di}`}>
                  {/* 부서 합계 행 */}
                  <tr className="bg-indigo-50 border-t border-gray-100">
                    <td className="px-4 py-2.5 font-semibold text-indigo-800">
                      {dept.department_name ?? '미지정'}
                    </td>
                    <td className="px-4 py-2.5 text-gray-400 text-xs italic">합계</td>
                    <td className="px-4 py-2.5 text-right font-semibold text-indigo-800">
                      {fmt(dept.asset_count)}
                    </td>
                    <td className="px-4 py-2.5 text-right font-semibold text-indigo-800">
                      {fmt(dept.total_appraised_value)}원
                    </td>
                  </tr>
                  {/* 팀 행 */}
                  {hasTeams &&
                    dept.teams.map((team, ti) => (
                      <tr
                        key={team.team_name ?? `team-${ti}`}
                        className={`border-t border-gray-50 ${ti % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}
                      >
                        <td className="px-4 py-2 pl-8 text-gray-300">└</td>
                        <td className="px-4 py-2 text-gray-700">
                          {team.team_name ?? '미지정'}
                        </td>
                        <td className="px-4 py-2 text-right text-gray-600">
                          {fmt(team.asset_count)}
                        </td>
                        <td className="px-4 py-2 text-right text-gray-600">
                          {fmt(team.total_appraised_value)}원
                        </td>
                      </tr>
                    ))}
                </React.Fragment>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-indigo-600 text-white border-t-2 border-indigo-700">
              <td className="px-4 py-3 font-bold" colSpan={2}>전체 합계</td>
              <td className="px-4 py-3 text-right font-bold">{fmt(grandCount)}</td>
              <td className="px-4 py-3 text-right font-bold">{fmt(grandValue)}원</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
};

// ─── 부서별 자산분류 테이블 (피벗) ──────────────────────────────────────────
const CategoryDeptTable: React.FC<{ data: CategoryByDeptResponse }> = ({ data }) => {
  const cats = data.categories.map((c) => c ?? '미분류');

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-indigo-600 text-white">
              <th className="text-left px-4 py-3 font-semibold border-r border-indigo-500" rowSpan={2}>
                부서
              </th>
              {cats.map((cat) => (
                <th
                  key={cat}
                  className="text-center px-3 py-2 font-semibold border-r border-indigo-500"
                  colSpan={2}
                >
                  {cat}
                </th>
              ))}
              <th
                className="text-center px-3 py-2 font-semibold"
                colSpan={2}
              >
                합계
              </th>
            </tr>
            <tr className="bg-indigo-700 text-white text-xs">
              {cats.map((cat) => (
                <React.Fragment key={`sub-${cat}`}>
                  <th className="px-3 py-1.5 text-center border-r border-indigo-600 font-medium">수량</th>
                  <th className="px-3 py-1.5 text-center border-r border-indigo-500 font-medium">금액(원)</th>
                </React.Fragment>
              ))}
              <th className="px-3 py-1.5 text-center border-r border-indigo-600 font-medium">수량</th>
              <th className="px-3 py-1.5 text-center font-medium">금액(원)</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row, ri) => (
              <tr
                key={row.department_name ?? `row-${ri}`}
                className={`border-t border-gray-100 ${ri % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}
              >
                <td className="px-4 py-2.5 font-medium text-gray-800 border-r border-gray-100 whitespace-nowrap">
                  {row.department_name ?? '미지정'}
                </td>
                {row.cells.map((cell, ci) => (
                  <React.Fragment key={`cell-${ri}-${ci}`}>
                    <td className="px-3 py-2.5 text-right text-gray-600 border-r border-gray-100">
                      {cell.count > 0 ? fmt(cell.count) : <span className="text-gray-300">-</span>}
                    </td>
                    <td className="px-3 py-2.5 text-right text-gray-600 border-r border-gray-100">
                      {cell.total > 0 ? fmt(cell.total) : <span className="text-gray-300">-</span>}
                    </td>
                  </React.Fragment>
                ))}
                <td className="px-3 py-2.5 text-right font-semibold text-indigo-700 border-r border-gray-100">
                  {fmt(row.total_count)}
                </td>
                <td className="px-3 py-2.5 text-right font-semibold text-indigo-700">
                  {fmt(row.total_value)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-indigo-600 text-white border-t-2 border-indigo-700">
              <td className="px-4 py-3 font-bold border-r border-indigo-500">합계</td>
              {data.col_totals.map((cell, ci) => (
                <React.Fragment key={`tot-${ci}`}>
                  <td className="px-3 py-3 text-right font-semibold border-r border-indigo-500">
                    {fmt(cell.count)}
                  </td>
                  <td className="px-3 py-3 text-right font-semibold border-r border-indigo-500">
                    {fmt(cell.total)}
                  </td>
                </React.Fragment>
              ))}
              <td className="px-3 py-3 text-right font-bold border-r border-indigo-500">
                {fmt(data.grand_total_count)}
              </td>
              <td className="px-3 py-3 text-right font-bold">
                {fmt(data.grand_total_value)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
};

export default ReportsPage;
