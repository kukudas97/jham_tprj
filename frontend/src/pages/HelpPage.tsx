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
    tip: '분류를 미리 잘 설계하면 나중에 자산 필터링과 검색이 훨씬 편리합니다.',
  },
  {
    number: 3,
    title: '자산 등록',
    description: '자산을 하나씩 직접 입력하거나 Excel 파일로 일괄 업로드합니다.',
    details: [
      '【직접 등록】 "자산 목록" 메뉴에서 우측 상단 "자산 등록" 버튼을 클릭합니다.',
      '자산명을 입력하고, 대분류·소분류를 선택합니다.',
      '시리얼 번호, 위치, 비고, 추가 항목을 입력한 후 저장합니다.',
      '【일괄 등록】 "Excel 업로드" 메뉴에서 엑셀 파일을 업로드합니다.',
      '엑셀 양식은 열 이름: name, serial_number, location, note 를 포함해야 합니다.',
    ],
    tip: '자산이 많은 경우 Excel 업로드를 사용하면 한 번에 등록할 수 있습니다.',
  },
  {
    number: 4,
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
    number: 5,
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
    number: 6,
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
    number: 7,
    title: '점검 이력 확인',
    description: '자산별 점검 기록을 관리자 화면에서 조회합니다.',
    details: [
      '"자산 목록"에서 자산 이름을 클릭하여 상세 페이지로 이동합니다.',
      '"점검 이력" 섹션에서 점검자와 점검 내용을 확인합니다.',
      '"점검 추가" 버튼으로 관리자가 직접 점검 기록을 입력할 수도 있습니다.',
    ],
  },
  {
    number: 8,
    title: '자산 검색 및 필터링',
    description: '자산 목록에서 원하는 자산을 빠르게 찾습니다.',
    details: [
      '"자산 목록" 상단 검색창에 자산명, 시리얼 번호, 위치를 입력하면 실시간으로 필터링됩니다.',
      '분류 필터 드롭다운으로 특정 대분류 또는 소분류에 속한 자산만 볼 수 있습니다.',
      '수정 버튼(연필 아이콘)으로 자산 정보를 편집하고, 삭제 버튼(휴지통 아이콘)으로 자산을 삭제할 수 있습니다.',
    ],
    tip: '삭제된 자산은 복구되지 않으므로 주의하세요.',
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
            {['자산 분류 설정', 'Excel 업로드 또는 자산 직접 등록', 'QR 코드 생성 및 인쇄', '현장 자산에 QR 부착', 'QR 스캔으로 점검 운영'].map(
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
