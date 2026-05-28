import React, { useState } from 'react';
import Layout from '../components/Layout';

interface Step {
  number: number;
  title: string;
  description: string;
  details: string[];
  tip?: string;
}

const steps: Step[] = [
  {
    number: 1,
    title: '로그인',
    description: '이메일과 비밀번호로 로그인하여 시스템에 접근합니다.',
    details: [
      '이메일 주소와 비밀번호를 입력하고 로그인 버튼을 클릭합니다.',
      '로그인 후 좌측 사이드바 하단에 내 이름과 회사 초대 코드가 표시됩니다.',
      '초대 코드를 클릭하면 클립보드에 복사됩니다. 같은 회사 구성원에게 공유하면 동일 자산 데이터를 함께 사용할 수 있습니다.',
    ],
    tip: '초대 코드를 공유하면 팀원이 같은 회사 자산 목록에 접근할 수 있습니다.',
  },
  {
    number: 2,
    title: '자산 분류 설정',
    description: '자산을 등록하기 전에 분류 체계를 먼저 구성합니다.',
    details: [
      '사이드바의 "자산 분류" 메뉴로 이동합니다.',
      '대분류를 먼저 생성합니다. (예: IT장비, 사무용품, 시설물)',
      '대분류 하위에 소분류를 추가할 수 있습니다. (예: IT장비 > 노트북, 모니터)',
      '각 분류별로 시리얼 번호 / 위치 / 비고 항목을 필수로 지정할 수 있습니다.',
      '"추가 항목" 기능으로 분류별 커스텀 필드를 자유롭게 추가할 수 있습니다. (예: 구매일, 보증기간, 제조사)',
    ],
    tip: 'Excel 업로드 시 분류가 없어도 자동 생성되므로, 직접 등록 전에만 설정하면 됩니다.',
  },
  {
    number: 3,
    title: '자산 등록 (직접)',
    description: '자산 목록에서 자산을 하나씩 직접 입력합니다.',
    details: [
      '"자산 목록" 메뉴에서 우측 상단 "자산 등록" 버튼을 클릭합니다.',
      '품명(자산 이름)을 입력하고 대분류·소분류를 선택합니다.',
      '식별번호(시리얼), 부서명, 비고, 커스텀 항목을 입력한 후 저장합니다.',
      '자산 상세 페이지에서 사진을 촬영하거나 업로드할 수 있습니다.',
    ],
  },
  {
    number: 4,
    title: '자산 일괄 등록 (Excel 업로드)',
    description: 'Excel 파일로 여러 자산을 한 번에 등록합니다.',
    details: [
      '"Excel 업로드" 메뉴로 이동한 뒤 "양식 다운로드" 버튼으로 빈 양식을 받습니다.',
      '시트명을 대분류 이름으로 지정합니다. (예: 시트명 "IT장비")',
      '각 행에 자산명(소분류), 부서명, 팀명, 관리자, 품명, 식별번호를 입력합니다.',
      '시트명(대분류)이나 자산명(소분류)이 시스템에 없으면 업로드 시 자동으로 분류가 생성됩니다.',
      '식별번호 뒤에 컬럼을 추가하면 해당 대분류에 커스텀 필드가 자동 생성되고 값이 저장됩니다. (예: 구매일자, 제조사)',
      '대분류별로 시트를 여러 개 만들면 한 파일로 여러 분류의 자산을 한 번에 등록할 수 있습니다.',
    ],
    tip: '분류가 없어도 자동 생성되므로, 양식을 받아 바로 채워서 올리면 됩니다.',
  },
  {
    number: 5,
    title: '자산 검색 · 필터 · 다건 처리',
    description: '자산 목록에서 원하는 자산을 찾고 여러 건을 한 번에 처리합니다.',
    details: [
      '"자산 목록" 상단 검색창에 품명, 식별번호, 부서명을 입력하면 실시간으로 필터링됩니다.',
      '분류 필터 드롭다운으로 특정 대분류 또는 소분류에 속한 자산만 볼 수 있습니다.',
      '각 행 왼쪽 체크박스로 자산을 선택합니다. 헤더 체크박스로 전체 선택/해제가 가능합니다.',
      '1개 이상 선택 시 상단에 "N개 삭제" 버튼이 나타나 한 번에 삭제할 수 있습니다.',
      '체크박스로 선택한 자산만 Excel 다운로드 또는 라벨 인쇄 대상으로 지정됩니다. 선택 없이 Excel·라벨 버튼을 누르면 현재 필터 결과 전체가 대상이 됩니다.',
    ],
    tip: '삭제된 자산은 복구되지 않으므로 주의하세요.',
  },
  {
    number: 6,
    title: 'Excel 내보내기',
    description: '자산 목록을 QR 이미지가 포함된 Excel 파일로 다운로드합니다.',
    details: [
      '"자산 목록" 우측 상단 "Excel" 버튼을 클릭합니다.',
      '대분류별로 시트가 생성되며, 각 자산의 QR 이미지가 마지막 열에 자동 삽입됩니다.',
      '체크박스로 자산을 선택한 경우 선택된 자산만 포함됩니다.',
      '선택 없이 누르면 현재 검색·필터 결과 전체가 포함됩니다.',
    ],
    tip: 'QR 이미지 생성에 시간이 걸릴 수 있어 자산 수에 따라 다소 시간이 소요됩니다.',
  },
  {
    number: 7,
    title: '라벨 인쇄 (폼텍 3106)',
    description: '선택한 자산의 라벨을 폼텍 3106 규격으로 인쇄합니다.',
    details: [
      '"자산 목록" 우측 상단 "라벨" 버튼을 클릭합니다.',
      '회사 로고나 원하는 이미지를 업로드하면 라벨 하단에 출력됩니다. (브라우저에 저장되어 다음에도 유지됩니다)',
      '"인쇄" 버튼을 누르면 인쇄 미리보기 창이 열립니다.',
      '라벨에는 구분(대분류), 품목(품명), 일련번호, QR 코드가 포함됩니다.',
      'A4 용지 기준 3열 × 8행 = 24칸으로 출력됩니다.',
    ],
    tip: '체크박스로 선택한 자산만 인쇄하거나, 선택 없이 전체 필터 결과를 인쇄할 수 있습니다.',
  },
  {
    number: 8,
    title: 'QR 코드 생성',
    description: '자산마다 고유한 QR 코드를 생성합니다.',
    details: [
      '"자산 목록"에서 자산 이름을 클릭하면 자산 상세 페이지로 이동합니다.',
      '우측 "QR 코드" 패널에서 "QR 코드 생성" 버튼을 클릭합니다.',
      'QR 코드가 생성되면 이미지로 확인할 수 있습니다.',
      '"다운로드" 버튼으로 PNG 파일을 저장한 후 자산에 부착할 수 있습니다.',
    ],
    tip: '한 번 생성된 QR 코드는 자산이 삭제되기 전까지 영구적으로 유효합니다.',
  },
  {
    number: 9,
    title: 'QR 코드로 자산 조회 (관리자)',
    description: '앱 내 QR 스캐너로 카메라를 통해 자산을 빠르게 조회합니다.',
    details: [
      '사이드바 상단의 "QR 스캔" 버튼을 클릭합니다.',
      '카메라 권한 허용 팝업이 나타나면 허용을 선택합니다.',
      '자산에 부착된 QR 코드를 카메라에 맞추면 자동으로 자산 상세 페이지로 이동합니다.',
    ],
    tip: '로그인된 관리자용 스캔 기능입니다. 상세 정보 수정·삭제도 가능합니다.',
  },
  {
    number: 10,
    title: 'QR 코드로 점검 기록 (현장 작업자)',
    description: '로그인 없이 스마트폰으로 QR을 스캔하여 점검을 기록합니다.',
    details: [
      '스마트폰 기본 카메라 앱 또는 QR 리더 앱으로 자산의 QR 코드를 스캔합니다.',
      '브라우저가 열리며 자산 정보 페이지가 표시됩니다.',
      '"점검 기록하기" 버튼을 클릭하고 점검자 이름과 점검 내용을 입력 후 저장합니다.',
      '저장된 점검 이력은 관리자 화면의 자산 상세 페이지에서 확인할 수 있습니다.',
    ],
    tip: '로그인이 필요 없어 현장 작업자가 스마트폰으로 바로 점검을 기록할 수 있습니다.',
  },
  {
    number: 11,
    title: '점검 이력 확인',
    description: '자산별 점검 기록을 관리자 화면에서 조회합니다.',
    details: [
      '"자산 목록"에서 자산 이름을 클릭하여 상세 페이지로 이동합니다.',
      '"점검 이력" 섹션에서 점검자와 점검 내용을 확인합니다.',
      '"점검 추가" 버튼으로 관리자가 직접 점검 기록을 입력할 수도 있습니다.',
    ],
  },
];

const HelpPage: React.FC = () => {
  const [openStep, setOpenStep] = useState<number | null>(null);

  const toggle = (n: number) => setOpenStep((prev) => (prev === n ? null : n));

  return (
    <Layout>
      <div className="p-6 max-w-3xl">
        {/* 헤더 */}
        <div className="mb-8">
          <h2 className="text-xl font-bold text-gray-900">사용 방법</h2>
          <p className="text-sm text-gray-500 mt-1">
            JHAM 자산관리 시스템을 순서대로 따라하며 설정하고 운영하는 방법을 안내합니다.
          </p>
        </div>

        {/* 단계 목록 */}
        <div className="space-y-3">
          {steps.map((step) => {
            const isOpen = openStep === step.number;
            return (
              <div
                key={step.number}
                className="bg-white rounded-xl border border-gray-200 overflow-hidden"
              >
                {/* 단계 헤더 (클릭 토글) */}
                <button
                  type="button"
                  onClick={() => toggle(step.number)}
                  className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-gray-50 transition-colors"
                >
                  <span className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-600 text-white text-sm font-bold flex items-center justify-center">
                    {step.number}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900">{step.title}</p>
                    <p className="text-sm text-gray-500 truncate mt-0.5">{step.description}</p>
                  </div>
                  <svg
                    className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* 단계 상세 */}
                {isOpen && (
                  <div className="px-5 pb-5 border-t border-gray-100">
                    <ol className="mt-4 space-y-2">
                      {step.details.map((detail, i) => (
                        <li key={i} className="flex gap-3 text-sm text-gray-700">
                          <span className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-50 text-blue-600 text-xs font-semibold flex items-center justify-center mt-0.5">
                            {i + 1}
                          </span>
                          <span>{detail}</span>
                        </li>
                      ))}
                    </ol>
                    {step.tip && (
                      <div className="mt-4 flex gap-2 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
                        <svg className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <p className="text-sm text-amber-800">{step.tip}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* 하단 안내 */}
        <div className="mt-8 bg-gray-50 border border-gray-200 rounded-xl p-5">
          <p className="text-sm font-semibold text-gray-700 mb-2">권장 시작 순서</p>
          <div className="flex flex-wrap gap-2 text-xs text-gray-500">
            {['자산 분류 설정 (선택)', 'Excel 업로드 또는 자산 직접 등록', 'QR 코드 생성', '라벨 인쇄 후 자산에 부착', 'QR 스캔으로 점검 운영'].map(
              (label, i, arr) => (
                <React.Fragment key={label}>
                  <span className="bg-white border border-gray-200 rounded px-2 py-1">{label}</span>
                  {i < arr.length - 1 && <span className="text-gray-300 self-center">→</span>}
                </React.Fragment>
              ),
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default HelpPage;
