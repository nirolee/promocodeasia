export const COMPARISON = Object.freeze({
  checkedAt: '2026-10-23',
  bookingStart: '2026-10-01',
  expiresAt: '2026-10-31',
  travelEnd: '2026-12-31',
  source: 'https://www.kkday.com/zh-tw/promo/aftee',
  currency: 'TWD',
  amountBasis: '假設已符合商品及支付條件的可折抵金額；不是實際報價或結帳驗證',
});

export const OFFERS = Object.freeze([
  Object.freeze({ code: 'AFTEE85OCT', label: '85 折，最高折 NT$80', kind: 'rate', discountPercent: 15, minimumCents: 0, capCents: 8000, uses: 1, quota: 125, experienceOnly: false }),
  Object.freeze({ code: 'AFTEE100OCT', label: '滿 NT$1,500 折 NT$100', kind: 'fixed', minimumCents: 150000, amountCents: 10000, uses: 2, quota: 300, experienceOnly: false }),
  Object.freeze({ code: 'AFTEE600OCT', label: '體驗／行程滿 NT$5,000 折 NT$600', kind: 'fixed', minimumCents: 500000, amountCents: 60000, uses: 1, quota: 150, experienceOnly: true }),
]);

export function taipeiDate(value = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit' }).format(value);
}

export function campaignActive(date) {
  return date >= COMPARISON.bookingStart && date <= COMPARISON.expiresAt;
}

export function parseAmount(raw) {
  if (typeof raw !== 'string' || !/^\d{1,7}(?:\.\d{1,2})?$/.test(raw.trim())) return null;
  const [whole, fraction = ''] = raw.trim().split('.');
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  return cents > 0 && cents <= 100000000 ? cents : null;
}

export function estimateOffer(offer, cents, experience = false) {
  if (!Number.isSafeInteger(cents) || cents <= 0) throw new TypeError('試算金額必須為正整數分');
  if (offer.experienceOnly && !experience) return { code: offer.code, applicable: false, reason: '僅限符合活動的體驗／行程商品', savingCents: 0, payableCents: cents };
  if (cents < offer.minimumCents) return { code: offer.code, applicable: false, reason: '未達此券低消', savingCents: 0, payableCents: cents };
  const calculated = offer.kind === 'rate' ? Math.min(Math.round(cents * offer.discountPercent / 100), offer.capCents) : offer.amountCents;
  const savingCents = Math.min(cents, calculated);
  return { code: offer.code, applicable: true, reason: '僅計算條款金額；資格、名額與捨入仍以官方結帳為準', savingCents, payableCents: cents - savingCents };
}

export function compareOffers(cents, experience = false) {
  return OFFERS.map(offer => ({ ...offer, ...estimateOffer(offer, cents, experience) }));
}

export function money(cents) {
  return 'NT$' + new Intl.NumberFormat('zh-TW', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(cents / 100);
}
