import React, { useEffect, useRef, useState } from 'react';
import { uploadExcel } from '../api/upload';
import type { AssetUpload, Category } from '../api/types';
import Layout from '../components/Layout';

async function downloadTemplate(_categories: Category[]) {
  const ExcelJS = (await import('exceljs')).default;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'JHAM';

  const HDR_COLOR = '4F46E5';
  const HDR_OPT_COLOR = '818CF8';
  const BORDER = { style: 'thin' as const, color: { argb: 'FFDDDDDD' } };

  const COLS = [
    { header: '자산명', key: 'assetName', width: 16, required: true },
    { header: '부서명', key: 'dept', width: 16, required: true },
    { header: '팀명', key: 'team', width: 14, required: false },
    { header: '관리자', key: 'manager', width: 12, required: false },
    { header: '품명', key: 'product', width: 24, required: true },
    { header: '식별번호', key: 'idNum', width: 20, required: true },
  ];

  // 예시 시트 1개만 생성 — 시트명을 대분류 이름으로 변경하여 사용
  const sheet = workbook.addWorksheet('대분류명');
  sheet.columns = COLS.map((c) => ({ key: c.key, width: c.width }));

  const headerRow = sheet.addRow(COLS.map((c) => c.header));
  headerRow.height = 22;
  headerRow.eachCell((cell, colNum) => {
    const required = COLS[colNum - 1]?.required ?? false;
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: `FF${required ? HDR_COLOR : HDR_OPT_COLOR}` },
    };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = { bottom: BORDER, right: BORDER };
  });

  // 빈 입력 행 10개
  for (let i = 0; i < 10; i++) {
    const row = sheet.addRow(['', '', '', '', '', '']);
    row.height = 18;
    row.eachCell((cell) => {
      cell.border = { bottom: BORDER, right: BORDER };
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `자산업로드_양식.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

const UploadPage: React.FC = () => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<AssetUpload | null>(null);
  const [error, setError] = useState('');
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);

  const handleFile = async (file: File) => {
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      setError('xlsx 또는 xls 파일만 업로드 가능합니다.');
      return;
    }
    setError('');
    setResult(null);
    setUploading(true);
    try {
      const data = await uploadExcel(file);
      setResult(data);
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        '업로드에 실패했습니다.';
      setError(msg);
    } finally {
      setUploading(false);
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleDownloadTemplate = async () => {
    setDownloadingTemplate(true);
    try {
      await downloadTemplate([]);
    } finally {
      setDownloadingTemplate(false);
    }
  };

  return (
    <Layout>
      <div className="p-6 max-w-2xl">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Excel 업로드</h2>
            <p className="text-sm text-gray-500 mt-1">xlsx 파일로 자산을 일괄 등록합니다.</p>
          </div>
          <button
            type="button"
            onClick={handleDownloadTemplate}
            disabled={downloadingTemplate}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-sm flex-shrink-0"
            title="현재 등록된 분류 기준으로 양식을 다운로드합니다"
          >
            {downloadingTemplate ? (
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
            양식 다운로드
          </button>
        </div>

        {/* 양식 안내 */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
          <h4 className="text-sm font-semibold text-blue-800 mb-1">Excel 양식 안내</h4>
          <p className="text-xs text-blue-700 mb-3">
            시트명 = <strong>대분류</strong> 이름 / 첫 번째 행은 헤더입니다.
          </p>
          <div className="overflow-x-auto">
            <table className="text-xs text-blue-800 w-full">
              <thead>
                <tr className="border-b border-blue-200">
                  <th className="text-left py-1 pr-4">컬럼명</th>
                  <th className="text-left py-1 pr-4">필수</th>
                  <th className="text-left py-1">설명</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['자산명', '필수', '소분류 이름 (해당 대분류에 소분류가 있을 경우 정확히 일치해야 함)'],
                  ['부서명', '필수', '자산 사용 부서명'],
                  ['팀명', '선택', '팀 이름 (해당 분류에 팀명 커스텀 필드가 있으면 저장됨)'],
                  ['관리자', '선택', '담당자 이름 (해당 분류에 관리자 커스텀 필드가 있으면 저장됨)'],
                  ['품명', '필수', '자산 품명 (구체적인 모델/제품명)'],
                  ['식별번호', '필수', '자산 고유 식별번호 (시리얼, 자산번호 등)'],
                ].map(([col, req, desc]) => (
                  <tr key={col} className="border-b border-blue-100 last:border-0">
                    <td className="py-1.5 pr-4 font-bold">{col}</td>
                    <td className="py-1.5 pr-4">
                      <span
                        className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                          req === '필수'
                            ? 'bg-indigo-100 text-indigo-800'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {req}
                      </span>
                    </td>
                    <td className="py-1.5 text-blue-700">{desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 드래그 앤 드롭 영역 */}
        <div
          className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${
            dragging ? 'border-indigo-500 bg-indigo-50' : 'border-gray-300 hover:border-gray-400'
          }`}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => fileRef.current?.click()}
        >
          <svg className="w-10 h-10 text-gray-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          <p className="text-sm font-medium text-gray-700">
            {uploading ? '업로드 중...' : '클릭하거나 파일을 드래그하세요'}
          </p>
          <p className="text-xs text-gray-400 mt-1">.xlsx 파일</p>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
              e.target.value = '';
            }}
          />
        </div>

        {/* 에러 */}
        {error && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
            {error}
          </div>
        )}

        {/* 결과 */}
        {result && (
          <div
            className={`mt-4 p-4 rounded-xl border ${
              result.status === 'success'
                ? 'bg-green-50 border-green-200'
                : 'bg-red-50 border-red-200'
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              {result.status === 'success' ? (
                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
              <span
                className={`text-sm font-semibold ${
                  result.status === 'success' ? 'text-green-800' : 'text-red-800'
                }`}
              >
                {result.status === 'success' ? '업로드 성공' : '업로드 실패'}
              </span>
            </div>
            <p className="text-xs text-gray-600">파일: {result.filename}</p>
            {result.error_message && (
              <p className="text-xs text-red-600 mt-1">{result.error_message}</p>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default UploadPage;
