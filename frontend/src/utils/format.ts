const CURRENCY_KEYWORDS = ['금액', '단가', '비용', '가격'];

export function isCurrencyField(label: string): boolean {
  return CURRENCY_KEYWORDS.some((k) => label.includes(k));
}

export function formatCurrency(value: string | null | undefined): string {
  if (!value && value !== '0') return '-';
  const stripped = value.replace(/,/g, '');
  const num = Number(stripped);
  if (isNaN(num)) return value;
  return num.toLocaleString('ko-KR');
}
