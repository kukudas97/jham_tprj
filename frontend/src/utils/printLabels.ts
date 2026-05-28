import * as assetsApi from '../api/assets';
import type { Asset, Category } from '../api/types';

function escapeHtml(str: string) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function fetchQrDataUrl(pid: string): Promise<string | null> {
  try {
    let res = await fetch(`/api/qr_codes/image/${pid}.png`);
    if (!res.ok) {
      await assetsApi.getQr(pid);
      res = await fetch(`/api/qr_codes/image/${pid}.png`);
    }
    if (!res.ok) return null;
    const blob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

// Formtec 3106: 64×34mm, 3열×8행, 24칸/A4
export async function printLabels(
  assets: Asset[],
  categories: Category[],
  logoDataUrl: string | null,
) {
  const qrMap: Record<string, string> = {};
  await Promise.all(
    assets.map(async (asset) => {
      const url = await fetchQrDataUrl(asset.pid);
      if (url) qrMap[asset.pid] = url;
    }),
  );

  const getParentName = (asset: Asset) => {
    const parent = categories.find(
      (c) => c.pid === asset.category_pid || c.children.some((ch) => ch.pid === asset.category_pid),
    );
    return parent?.name ?? '';
  };

  const logoHtml = logoDataUrl
    ? `<img class="logo" src="${logoDataUrl}" alt="logo">`
    : '';

  const LABELS_PER_PAGE = 24; // 3열 × 8행

  const labelHtml = (asset: Asset) => {
    const parentName = getParentName(asset);
    const qrSrc = qrMap[asset.pid] ?? '';
    return `
      <div class="label">
        <div class="top">
          <div class="table-part">
            <div class="row">
              <div class="lbl">구&nbsp;&nbsp;분</div>
              <div class="val">${escapeHtml(parentName)}</div>
            </div>
            <div class="row">
              <div class="lbl">품&nbsp;&nbsp;목</div>
              <div class="val bold">${escapeHtml(asset.name)}</div>
            </div>
            <div class="row">
              <div class="lbl">일련번호</div>
              <div class="val mono">${escapeHtml(asset.serial_number ?? '-')}</div>
            </div>
          </div>
          <div class="qr-part">
            ${qrSrc
              ? `<img class="qr" src="${qrSrc}" alt="QR">`
              : '<div class="qr-empty"></div>'
            }
          </div>
        </div>
        <div class="bottom">
          ${logoHtml}
        </div>
      </div>`;
  };

  // 24개씩 페이지 분할
  const sheetsHtml = Array.from(
    { length: Math.ceil(assets.length / LABELS_PER_PAGE) },
    (_, pageIdx) => {
      const pageAssets = assets.slice(pageIdx * LABELS_PER_PAGE, (pageIdx + 1) * LABELS_PER_PAGE);
      return `<div class="sheet">${pageAssets.map(labelHtml).join('')}</div>`;
    },
  ).join('');

  const html = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<title>자산 라벨 인쇄 (폼텍 3106)</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  @page { size: A4 portrait; margin: 0; }

  body {
    font-family: 'Malgun Gothic', '맑은 고딕', AppleGothic, sans-serif;
    background: #fff;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .sheet {
    width: 210mm;
    height: 297mm;
    padding: 10mm 7mm;
    display: grid;
    grid-template-columns: repeat(3, 64mm);
    grid-template-rows: repeat(8, 34mm);
    column-gap: 2mm;
    row-gap: 0.7mm;
    overflow: hidden;
    page-break-after: always;
    break-after: page;
  }

  /* 라벨 전체 */
  .label {
    width: 64mm;
    height: 34mm;
    display: flex;
    flex-direction: column;
    border: 0.3mm solid #999;
    overflow: hidden;
  }

  /* 상단: 표 + QR */
  .top {
    flex: 1;
    display: flex;
    border-bottom: 0.3mm solid #999;
    min-height: 0;
  }

  /* 좌측 표 */
  .table-part {
    flex: 1;
    display: flex;
    flex-direction: column;
    border-right: 0.3mm solid #999;
    min-width: 0;
  }

  .row {
    display: flex;
    flex: 1;
    border-bottom: 0.2mm solid #ccc;
  }
  .row:last-child { border-bottom: none; }

  .lbl {
    width: 13mm;
    flex-shrink: 0;
    background: #ebebeb;
    font-size: 5.5pt;
    font-weight: bold;
    color: #333;
    display: flex;
    align-items: center;
    justify-content: center;
    border-right: 0.2mm solid #ccc;
    text-align: center;
  }

  .val {
    flex: 1;
    font-size: 6.5pt;
    color: #111;
    display: flex;
    align-items: center;
    padding: 0 1mm;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    min-width: 0;
  }
  .val.bold { font-weight: bold; font-size: 7pt; }
  .val.mono { font-family: 'Courier New', monospace; font-size: 6pt; color: #444; }

  /* 우측 QR */
  .qr-part {
    width: 22mm;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1mm;
  }

  .qr {
    width: 19mm;
    height: 19mm;
    object-fit: contain;
  }

  .qr-empty {
    width: 19mm;
    height: 19mm;
    border: 0.3mm dashed #ccc;
  }

  /* 하단 로고 영역 */
  .bottom {
    height: 10mm;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1mm 2mm;
    background: #fff;
  }

  .logo {
    max-height: 8mm;
    max-width: 58mm;
    object-fit: contain;
  }

  @media print {
    .label { border-color: #999; }
  }
</style>
</head>
<body>
  ${sheetsHtml}
</body>
</html>`;

  const win = window.open('', '_blank');
  if (!win) {
    alert('팝업이 차단되었습니다. 팝업을 허용해 주세요.');
    return;
  }
  win.document.write(html);
  win.document.close();
  win.onload = () => setTimeout(() => win.print(), 300);
}
