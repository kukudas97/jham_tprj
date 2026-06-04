import React, { useEffect, useState } from 'react';
import * as assetsApi from '../api/assets';
import type { CategoryDeptCountResponse, DeptTeamCategoryResponse } from '../api/types';
import Layout from '../components/Layout';

const fmt = (v: number) => (v === 0 ? '-' : v.toLocaleString('ko-KR'));
const fmtMoney = (v: number) => (v === 0 ? '-' : v.toLocaleString('ko-KR'));

// ─── Excel export: Image 1 (부서/팀별 × 자산분류 평가금액) ───────────────────
async function exportImage1Excel(data: DeptTeamCategoryResponse) {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'JHAM';
  const ws = wb.addWorksheet('부서팀별_자산분류_평가금액');

  const INDIGO = 'FF4F46E5';
  const SUBTOTAL_BG = 'FFE0E7FF';
  const ALT = 'FFF8F8FF';
  const BORDER = { style: 'thin' as const, color: { argb: 'FFDDDDDD' } };
  const cats = data.categories.map((c) => c ?? '미분류');
  const n = cats.length;

  ws.columns = [
    { key: 'label', width: 28 },
    ...cats.map(() => ({ width: 16 })),
    { key: 'total', width: 18 },
  ];

  // 헤더
  const hdrRow = ws.addRow(['부서 / 팀', ...cats, '합계']);
  hdrRow.height = 22;
  hdrRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: INDIGO } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = { bottom: BORDER, right: BORDER };
  });

  let rowIdx = 0;
  for (const dept of data.departments) {
    const hasTeams =
      dept.teams.length > 1 || (dept.teams.length === 1 && dept.teams[0].team_name !== null);

    // 팀 행 먼저
    if (hasTeams) {
      for (const team of dept.teams) {
        const row = ws.addRow([
          `  ${team.team_name ?? '미지정'}`,
          ...team.values,
          team.total,
        ]);
        row.height = 20;
        if (rowIdx % 2 === 1) {
          row.eachCell((cell) => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ALT } };
          });
        }
        row.eachCell((cell, col) => {
          cell.border = { bottom: BORDER, right: BORDER };
          if (col > 1) {
            cell.numFmt = '#,##0';
            cell.alignment = { horizontal: 'right' };
          }
        });
        rowIdx++;
      }
    }

    // 부서 소계 행
    const subtotalRow = ws.addRow([
      `${dept.department_name ?? '미지정'} 합계`,
      ...dept.subtotal,
      dept.grand_total,
    ]);
    subtotalRow.height = 22;
    subtotalRow.eachCell((cell, col) => {
      cell.font = { bold: true };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: SUBTOTAL_BG } };
      cell.border = { bottom: { style: 'medium', color: { argb: 'FF4F46E5' } }, right: BORDER };
      if (col > 1) {
        cell.numFmt = '#,##0';
        cell.alignment = { horizontal: 'right' };
      }
    });
    rowIdx++;
  }

  // 전체 합계
  const totRow = ws.addRow(['전체 합계', ...data.grand_subtotal, data.grand_total]);
  totRow.height = 24;
  totRow.eachCell((cell, col) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: INDIGO } };
    cell.border = { bottom: BORDER, right: BORDER };
    if (col > 1) {
      cell.numFmt = '#,##0';
      cell.alignment = { horizontal: 'right' };
    }
  });

  // 열 너비 정리 (숫자 열)
  for (let i = 2; i <= n + 2; i++) {
    ws.getColumn(i).width = 15;
  }

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `부서팀별_자산분류_평가금액_${new Date().toISOString().slice(0, 10)}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── Excel export: Image 2 (대분류/세부분류 × 부서 수량) ─────────────────────
async function exportImage2Excel(data: CategoryDeptCountResponse) {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'JHAM';
  const ws = wb.addWorksheet('부서별_자산분류_현황');

  const INDIGO = 'FF4F46E5';
  const SUBTOTAL_BG = 'FFE0E7FF';
  const ALT = 'FFF8F8FF';
  const BORDER = { style: 'thin' as const, color: { argb: 'FFDDDDDD' } };
  const depts = data.departments.map((d) => d ?? '미지정');
  const n = depts.length;

  ws.columns = [
    { key: 'seq', width: 7 },
    { key: 'parent', width: 14 },
    { key: 'child', width: 20 },
    ...depts.map(() => ({ width: 12 })),
    { key: 'total', width: 10 },
  ];

  // 헤더
  const hdrRow = ws.addRow(['순번', '항목1', '항목2', ...depts, '합계']);
  hdrRow.height = 22;
  hdrRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: INDIGO } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = { bottom: BORDER, right: BORDER };
  });

  let seq = 1;
  let rowIdx = 0;
  for (const group of data.categories) {
    const hasSub =
      group.children.length > 1 ||
      (group.children.length === 1 && group.children[0].name !== null);

    if (hasSub) {
      for (const child of group.children) {
        const row = ws.addRow([
          seq,
          group.parent_name ?? '미분류',
          child.name ?? '',
          ...child.counts.map((c) => c || null),
          child.total || null,
        ]);
        row.height = 20;
        if (rowIdx % 2 === 1) {
          row.eachCell((cell) => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ALT } };
          });
        }
        row.eachCell((cell, col) => {
          cell.border = { bottom: BORDER, right: BORDER };
          if (col > 3) cell.alignment = { horizontal: 'center' };
        });
        seq++;
        rowIdx++;
      }
      // 소계
      const subRow = ws.addRow([
        '',
        `${group.parent_name ?? '미분류'} 합계`,
        '',
        ...group.subtotal.map((c) => c || null),
        group.grand_total || null,
      ]);
      subRow.height = 20;
      subRow.eachCell((cell, col) => {
        cell.font = { bold: true };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: SUBTOTAL_BG } };
        cell.border = { bottom: { style: 'medium', color: { argb: 'FF4F46E5' } }, right: BORDER };
        if (col > 3) cell.alignment = { horizontal: 'center' };
      });
      rowIdx++;
    } else {
      // 서브카테고리 없음 → 단일 행
      const child = group.children[0];
      const row = ws.addRow([
        seq,
        group.parent_name ?? '미분류',
        '',
        ...(child ? child.counts.map((c) => c || null) : new Array(n).fill(null)),
        child ? child.total || null : null,
      ]);
      row.height = 20;
      if (rowIdx % 2 === 1) {
        row.eachCell((cell) => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ALT } };
        });
      }
      row.eachCell((cell, col) => {
        cell.border = { bottom: BORDER, right: BORDER };
        if (col > 3) cell.alignment = { horizontal: 'center' };
      });
      seq++;
      rowIdx++;
    }
  }

  // 전체 합계
  const totRow = ws.addRow([
    '',
    '전체 합계',
    '',
    ...data.grand_subtotal.map((c) => c || null),
    data.grand_total || null,
  ]);
  totRow.height = 24;
  totRow.eachCell((cell, col) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: INDIGO } };
    cell.border = { bottom: BORDER, right: BORDER };
    if (col > 3) cell.alignment = { horizontal: 'center' };
  });

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `부서별_자산분류_현황_${new Date().toISOString().slice(0, 10)}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── Page ─────────────────────────────────────────────────────────────────────
type Tab = 'dept-team-cat' | 'cat-dept-count';

const ReportsPage: React.FC = () => {
  const [tab, setTab] = useState<Tab>('dept-team-cat');
  const [img1Data, setImg1Data] = useState<DeptTeamCategoryResponse | null>(null);
  const [img2Data, setImg2Data] = useState<CategoryDeptCountResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    if (tab === 'dept-team-cat') {
      assetsApi
        .getDeptTeamCategorySummary()
        .then(setImg1Data)
        .catch(() => setError('데이터를 불러오지 못했습니다.'))
        .finally(() => setLoading(false));
    } else {
      assetsApi
        .getCategoryDeptCountSummary()
        .then(setImg2Data)
        .catch(() => setError('데이터를 불러오지 못했습니다.'))
        .finally(() => setLoading(false));
    }
  }, [tab]);

  const handleExport = async () => {
    setExporting(true);
    try {
      if (tab === 'dept-team-cat' && img1Data) {
        await exportImage1Excel(img1Data);
      } else if (tab === 'cat-dept-count' && img2Data) {
        await exportImage2Excel(img2Data);
      }
    } finally {
      setExporting(false);
    }
  };

  const canExport = tab === 'dept-team-cat' ? !!img1Data : !!img2Data;

  return (
    <Layout>
      <div className="p-4 md:p-6 max-w-screen-2xl mx-auto">
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-lg font-bold text-gray-900">통계 리포트</h1>
            <p className="text-xs text-gray-500 mt-0.5">자산 현황을 집계하여 확인하고 엑셀로 다운로드합니다</p>
          </div>
          <button
            type="button"
            onClick={handleExport}
            disabled={exporting || loading || !canExport}
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
          {(
            [
              { id: 'dept-team-cat', label: '부서/팀별 자산분류 평가금액' },
              { id: 'cat-dept-count', label: '부서별 자산분류 수량 현황' },
            ] as { id: Tab; label: string }[]
          ).map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                tab === id
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

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

        {!loading && !error && tab === 'dept-team-cat' && img1Data && (
          <DeptTeamCatTable data={img1Data} />
        )}
        {!loading && !error && tab === 'cat-dept-count' && img2Data && (
          <CatDeptCountTable data={img2Data} />
        )}
      </div>
    </Layout>
  );
};

// ─── Tab 1: Image 1 스타일 (부서/팀 행 × 자산분류 열, 평가금액) ───────────────
const DeptTeamCatTable: React.FC<{ data: DeptTeamCategoryResponse }> = ({ data }) => {
  const cats = data.categories.map((c) => c ?? '미분류');

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-indigo-600 text-white">
              <th className="text-left px-4 py-3 font-semibold whitespace-nowrap border-r border-indigo-500 min-w-[180px]">
                부서 / 팀
              </th>
              {cats.map((cat) => (
                <th
                  key={cat}
                  className="text-right px-3 py-3 font-semibold whitespace-nowrap border-r border-indigo-500 min-w-[120px]"
                >
                  {cat}
                </th>
              ))}
              <th className="text-right px-3 py-3 font-semibold whitespace-nowrap min-w-[130px]">
                합계
              </th>
            </tr>
          </thead>
          <tbody>
            {data.departments.map((dept, di) => {
              const hasTeams =
                dept.teams.length > 1 ||
                (dept.teams.length === 1 && dept.teams[0].team_name !== null);
              return (
                <React.Fragment key={dept.department_name ?? `d${di}`}>
                  {/* 팀 행 */}
                  {hasTeams &&
                    dept.teams.map((team, ti) => (
                      <tr
                        key={team.team_name ?? `t${ti}`}
                        className={`border-t border-gray-50 ${ti % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}
                      >
                        <td className="px-4 py-2 pl-6 text-gray-700 border-r border-gray-100 whitespace-nowrap">
                          {team.team_name ?? '미지정'}
                        </td>
                        {team.values.map((v, ci) => (
                          <td
                            key={`v${ci}`}
                            className={`px-3 py-2 text-right border-r border-gray-100 ${
                              v === 0 ? 'text-gray-200' : 'text-gray-700'
                            }`}
                          >
                            {fmtMoney(v)}
                          </td>
                        ))}
                        <td className="px-3 py-2 text-right text-gray-800 font-medium">
                          {fmtMoney(team.total)}
                        </td>
                      </tr>
                    ))}
                  {/* 부서 소계 행 */}
                  <tr className="bg-indigo-50 border-t-2 border-indigo-200">
                    <td className="px-4 py-2.5 font-bold text-indigo-900 border-r border-indigo-200 whitespace-nowrap">
                      {dept.department_name ?? '미지정'} 합계
                    </td>
                    {dept.subtotal.map((v, ci) => (
                      <td
                        key={`s${ci}`}
                        className={`px-3 py-2.5 text-right font-semibold border-r border-indigo-200 ${
                          v === 0 ? 'text-indigo-200' : 'text-indigo-800'
                        }`}
                      >
                        {fmtMoney(v)}
                      </td>
                    ))}
                    <td className="px-3 py-2.5 text-right font-bold text-indigo-900">
                      {fmtMoney(dept.grand_total)}
                    </td>
                  </tr>
                </React.Fragment>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-indigo-600 text-white border-t-2 border-indigo-700">
              <td className="px-4 py-3 font-bold border-r border-indigo-500">전체 합계</td>
              {data.grand_subtotal.map((v, ci) => (
                <td key={`g${ci}`} className="px-3 py-3 text-right font-bold border-r border-indigo-500">
                  {v === 0 ? '-' : v.toLocaleString('ko-KR')}
                </td>
              ))}
              <td className="px-3 py-3 text-right font-bold">
                {data.grand_total.toLocaleString('ko-KR')}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
};

// ─── Tab 2: Image 2 스타일 (대분류/세부분류 행 × 부서 열, 수량) ───────────────
const CatDeptCountTable: React.FC<{ data: CategoryDeptCountResponse }> = ({ data }) => {
  const depts = data.departments.map((d) => d ?? '미지정');
  let seq = 1;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-indigo-600 text-white">
              <th className="text-center px-3 py-3 font-semibold border-r border-indigo-500 w-12">
                순번
              </th>
              <th className="text-left px-3 py-3 font-semibold border-r border-indigo-500 min-w-[100px] whitespace-nowrap">
                항목1
              </th>
              <th className="text-left px-3 py-3 font-semibold border-r border-indigo-500 min-w-[140px] whitespace-nowrap">
                항목2
              </th>
              {depts.map((dept) => (
                <th
                  key={dept}
                  className="text-center px-2 py-3 font-semibold border-r border-indigo-500 min-w-[80px] whitespace-nowrap text-xs"
                >
                  {dept}
                </th>
              ))}
              <th className="text-center px-3 py-3 font-semibold min-w-[70px]">합계</th>
            </tr>
          </thead>
          <tbody>
            {data.categories.map((group, gi) => {
              const hasSub =
                group.children.length > 1 ||
                (group.children.length === 1 && group.children[0].name !== null);
              return (
                <React.Fragment key={group.parent_name ?? `g${gi}`}>
                  {hasSub ? (
                    <>
                      {group.children.map((child, ci) => {
                        const s = seq++;
                        return (
                          <tr
                            key={child.name ?? `c${ci}`}
                            className={`border-t border-gray-50 ${ci % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}
                          >
                            <td className="px-3 py-2 text-center text-gray-400 border-r border-gray-100">
                              {s}
                            </td>
                            <td className="px-3 py-2 text-gray-600 border-r border-gray-100 whitespace-nowrap">
                              {group.parent_name ?? '미분류'}
                            </td>
                            <td className="px-3 py-2 text-gray-800 border-r border-gray-100 whitespace-nowrap">
                              {child.name ?? ''}
                            </td>
                            {child.counts.map((cnt, di) => (
                              <td
                                key={`cnt${di}`}
                                className={`px-2 py-2 text-center border-r border-gray-100 ${
                                  cnt === 0 ? 'text-gray-200' : 'text-gray-700'
                                }`}
                              >
                                {fmt(cnt)}
                              </td>
                            ))}
                            <td className="px-3 py-2 text-center font-medium text-gray-800">
                              {fmt(child.total)}
                            </td>
                          </tr>
                        );
                      })}
                      {/* 소계 */}
                      <tr className="bg-indigo-50 border-t-2 border-indigo-200">
                        <td className="px-3 py-2 border-r border-indigo-200" />
                        <td
                          className="px-3 py-2 font-bold text-indigo-900 border-r border-indigo-200 whitespace-nowrap"
                          colSpan={2}
                        >
                          {group.parent_name ?? '미분류'} 합계
                        </td>
                        {group.subtotal.map((cnt, di) => (
                          <td
                            key={`sub${di}`}
                            className={`px-2 py-2 text-center font-semibold border-r border-indigo-200 ${
                              cnt === 0 ? 'text-indigo-200' : 'text-indigo-800'
                            }`}
                          >
                            {fmt(cnt)}
                          </td>
                        ))}
                        <td className="px-3 py-2 text-center font-bold text-indigo-900">
                          {fmt(group.grand_total)}
                        </td>
                      </tr>
                    </>
                  ) : (
                    // 서브카테고리 없음 → 단일 행
                    <tr
                      className={`border-t border-gray-50 ${gi % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}
                    >
                      <td className="px-3 py-2 text-center text-gray-400 border-r border-gray-100">
                        {seq++}
                      </td>
                      <td
                        className="px-3 py-2 font-medium text-gray-800 border-r border-gray-100 whitespace-nowrap"
                        colSpan={2}
                      >
                        {group.parent_name ?? '미분류'}
                      </td>
                      {(group.children[0]?.counts ?? new Array(depts.length).fill(0)).map(
                        (cnt, di) => (
                          <td
                            key={`cnt${di}`}
                            className={`px-2 py-2 text-center border-r border-gray-100 ${
                              cnt === 0 ? 'text-gray-200' : 'text-gray-700'
                            }`}
                          >
                            {fmt(cnt)}
                          </td>
                        ),
                      )}
                      <td className="px-3 py-2 text-center font-medium text-gray-800">
                        {fmt(group.children[0]?.total ?? 0)}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-indigo-600 text-white border-t-2 border-indigo-700">
              <td className="px-3 py-3 border-r border-indigo-500" />
              <td className="px-3 py-3 font-bold border-r border-indigo-500" colSpan={2}>
                전체 합계
              </td>
              {data.grand_subtotal.map((cnt, di) => (
                <td key={`g${di}`} className="px-2 py-3 text-center font-bold border-r border-indigo-500">
                  {cnt === 0 ? '-' : cnt.toLocaleString('ko-KR')}
                </td>
              ))}
              <td className="px-3 py-3 text-center font-bold">
                {data.grand_total.toLocaleString('ko-KR')}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
};

export default ReportsPage;
