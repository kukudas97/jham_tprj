import React, { useRef, useState } from 'react';
import { uploadExcel } from '../api/upload';
import type { AssetUpload } from '../api/types';
import Layout from '../components/Layout';

const UploadPage: React.FC = () => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<AssetUpload | null>(null);
  const [error, setError] = useState('');

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
      const msg = (e as { response?: { data?: { error?: string } } })
        ?.response?.data?.error ?? '업로드에 실패했습니다.';
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

  return (
    <Layout>
      <div className="p-6 max-w-2xl">
        <div className="mb-6">
          <h2 className="text-xl font-bold text-gray-900">Excel 업로드</h2>
          <p className="text-sm text-gray-500 mt-1">xlsx 파일로 자산을 일괄 등록합니다.</p>
        </div>

        {/* 양식 안내 */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
          <h4 className="text-sm font-semibold text-blue-800 mb-2">Excel 양식 안내</h4>
          <p className="text-xs text-blue-700 mb-2">첫 번째 행은 헤더입니다. 아래 컬럼명을 사용하세요.</p>
          <div className="overflow-x-auto">
            <table className="text-xs text-blue-800 w-full">
              <thead>
                <tr className="border-b border-blue-200">
                  <th className="text-left py-1 pr-4">컬럼명</th>
                  <th className="text-left py-1 pr-4">필수</th>
                  <th className="text-left py-1">설명</th>
                </tr>
              </thead>
              <tbody className="space-y-1">
                {[
                  ['name', '필수', '자산 이름'],
                  ['serial_number', '선택', '시리얼 번호'],
                  ['location', '선택', '위치'],
                  ['note', '선택', '비고'],
                ].map(([col, req, desc]) => (
                  <tr key={col}>
                    <td className="py-1 pr-4 font-mono font-bold">{col}</td>
                    <td className="py-1 pr-4">
                      <span className={`px-1.5 py-0.5 rounded text-xs ${req === '필수' ? 'bg-blue-200' : 'bg-blue-100'}`}>
                        {req}
                      </span>
                    </td>
                    <td className="py-1">{desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 드래그 앤 드롭 영역 */}
        <div
          className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${
            dragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'
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
          <p className="text-xs text-gray-400 mt-1">.xlsx, .xls 파일</p>
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
          <div className={`mt-4 p-4 rounded-xl border ${
            result.status === 'success'
              ? 'bg-green-50 border-green-200'
              : 'bg-red-50 border-red-200'
          }`}>
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
              <span className={`text-sm font-semibold ${result.status === 'success' ? 'text-green-800' : 'text-red-800'}`}>
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
