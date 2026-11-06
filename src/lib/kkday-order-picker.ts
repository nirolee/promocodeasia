import type { Code } from '../data/brands';
import { isExpired, isStale, versionStale } from './codes';
import { estimateOffer } from './coupon-math.mjs';

export const productOptions = [
  ['jp-kr-tickets', '日本／韓國門票'],
  ['jp-kr-experience', '日本／韓國行程、體驗'],
  ['rail-shuttle', '日本鐵路／韓國演唱會接駁'],
  ['jp-kr-transport', '其他日本／韓國交通'],
  ['hk-mo-th-vn', '港澳、泰國、越南門票或體驗'],
  ['taiwan', '台灣商品'],
  ['other', '其他商品'],
] as const;

type Product = typeof productOptions[number][0];
type Payment = 'next' | 'jcb';
type Discount = { kind: 'fixed'; amountCents: number } |
  { kind: 'rate'; discountPercent: number; capCents: number };
type Rule = Discount & {
  checkedAt: string;
  minimumCents: number;
  products: readonly Product[];
  payment: Payment;
  travelEnd: string;
  claimFirst?: true;
};

// 僅收錄已逐條核對的試算條件；原券更新後，須同步複核此處才會重新納入。
const rules: Partial<Record<string, Rule>> = {
  '26JCB11': {
    checkedAt: '2026-11-02', kind: 'fixed', amountCents: 20000, minimumCents: 200000,
    products: ['jp-kr-tickets', 'jp-kr-experience', 'rail-shuttle', 'hk-mo-th-vn'],
    payment: 'jcb', travelEnd: '2027-02-28',
  },
  NEXT600NOV: {
    checkedAt: '2026-11-05', kind: 'fixed', amountCents: 60000, minimumCents: 350000,
    products: ['jp-kr-experience'], payment: 'next', travelEnd: '2027-02-28', claimFirst: true,
  },
  NEXT300NOV: {
    checkedAt: '2026-11-05', kind: 'fixed', amountCents: 30000, minimumCents: 250000,
    products: ['jp-kr-tickets', 'rail-shuttle', 'jp-kr-transport'],
    payment: 'next', travelEnd: '2027-02-28', claimFirst: true,
  },
  NEXT8NOV26: {
    checkedAt: '2026-11-05', kind: 'rate', discountPercent: 20, capCents: 15000, minimumCents: 0,
    products: ['taiwan'], payment: 'next', travelEnd: '2027-02-28', claimFirst: true,
  },
};

export type PickerOffer = { coupon: Code; rule: Rule };

export function currentPickerOffers(offers: PickerOffer[], today: string) {
  return offers.filter(({ coupon, rule }) => coupon.verifiedAt === rule.checkedAt
    && coupon.verifiedAt <= today && !coupon.availability
    && !isExpired(coupon, today) && !isStale(coupon, today) && !versionStale(coupon, today));
}

export function kkdayPickerOffers(codes: Code[], today: string) {
  const offers = codes.flatMap(coupon => {
    const rule = rules[coupon.code];
    return rule ? [{ coupon, rule }] : [];
  });
  return currentPickerOffers(offers, today);
}

export function assessOffer(offer: PickerOffer, amount: number, product: string, payment: string, travel: string) {
  const { coupon, rule } = offer;
  const excluded: string[] = [];
  const pending: string[] = [];
  const estimate = estimateOffer({ ...rule, code: coupon.code }, amount);
  if (!estimate.applicable) excluded.push('未達此券低消');
  else if (estimate.savingCents === 0) excluded.push('按此金額試算無折抵');
  if (!product) pending.push('請確認商品類型');
  else if (!rule.products.some(option => option === product)) excluded.push('商品類型不符');
  if (!payment) pending.push(`需以${coupon.card}直接付款`);
  else if (payment !== 'both' && payment !== rule.payment) excluded.push('付款方式不符');
  if (!travel) pending.push(`請確認使用日在 ${rule.travelEnd} 或之前`);
  else if (travel > rule.travelEnd) excluded.push('超過優惠的使用期限');
  return {
    ...offer,
    estimate,
    status: excluded.length ? 'excluded' : pending.length ? 'pending' : 'match',
    reasons: excluded.length ? excluded : pending,
  } as const;
}
