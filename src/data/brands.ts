/**
 * 券的唯一真源。
 *
 * 设计约束（不是建议，是硬性的）：
 *   1. 每个 code 必须有 `verifiedAt` + `source`，否则 scripts/lint-codes.mjs 会让 build 失败。
 *      理由：2026-09 实测，聚合站标着 "Verified" 的码大面积是废的——
 *      Klook 的 HUWNAN2640009（真码是 HUWNAN269509）、Spaceship 的 SPST25（其实是 .net 的码）、
 *      couponfollow 的 Caraway 页 20 条码没有一条标验证日期，还有一条到期日写着 2/19/2133。
 *      「码是真的、且标明什么时候验的」是这个站唯一的护城河，不能靠自觉。
 *   2. `restriction` 必填。台湾的券绝大多数绑定特定发卡行或新客身份，
 *      不写清楚等于骗读者点进去再失望。
 *   3. 没有已验证的码时，`codes: []` —— 页面会明说「目前没有可用的公开码」，
 *      不允许拿过期码凑数。这是和 couponfollow 那种站的根本区别。
 *
 * affiliateUrl 留空时，页面不渲染任何追踪链接（program 还没批下来）。
 * Admitad feed 接上后，这里由 scripts/sync-admitad.mjs 生成，字段对齐 feed 的
 * promocode / gotolink / date_start / date_end / exclusive / customer_type。
 */

export type Code = {
  /** 结账时输入的字符串 */
  code: string;
  /** 折扣内容，用读者能直接判断「关不关我事」的话写 */
  benefit: string;
  /** 使用条件：发卡行、新客限定、次数上限、最低消费。没有条件就写「無」 */
  restriction: string;
  /** 我们最后一次亲自核对这个码的日期 YYYY-MM-DD */
  verifiedAt: string;
  /** 核对的出处，必须是品牌官方页或联盟后台，不能是别的券站 */
  source: string;
  /** 官方标注的失效日，未知则省略 */
  expiresAt?: string;
};

export type Brand = {
  slug: string;
  /** 繁中显示名 */
  name: string;
  /** 英文名，用于 URL 之外的场合 */
  nameEn: string;
  /** 页面 H1 之外的一句话定位 */
  tagline: string;
  officialUrl: string;
  /** Admitad program 名称，批下来前仅作备注 */
  admitadProgram: string;
  /** 追踪链接；空字符串 = program 未批准，页面不渲染出站按钮 */
  affiliateUrl: string;
  codes: Code[];
  /** 非码类优惠（活动、信用卡回馈），同样要求出处 */
  campaigns: { title: string; detail: string; period: string; source: string }[];
};

export const BRANDS: Brand[] = [
  {
    slug: 'klook',
    name: 'Klook 客路',
    nameEn: 'Klook',
    tagline: '景點門票、交通票券、當地體驗',
    officialUrl: 'https://www.klook.com/zh-TW/',
    admitadProgram: 'Klook WW（1.60–8%）',
    affiliateUrl: '',
    codes: [
      {
        code: 'CTBCLP26102',
        benefit: '海外商品 9 折',
        restriction: '限中國信託 LINE Pay 卡；每帳號全年限用 10 次，每筆最高加碼 1,000 點',
        verifiedAt: '2026-09-20',
        source: 'https://www.klook.com/zh-TW/blog/klook-discount-collection/',
      },
      {
        code: 'VISA269209',
        benefit: '海外全商品 92 折',
        restriction: '限 Visa 卡；每月每帳號限用 1 次，需先點擊活動連結',
        verifiedAt: '2026-09-20',
        source: 'https://www.klook.com/zh-TW/blog/klook-discount-collection/',
      },
      {
        code: 'VSKB269309',
        benefit: '海外全商品 93 折',
        restriction: '限 Visa 新光卡；每月每帳號限用 1 次',
        verifiedAt: '2026-09-20',
        source: 'https://www.klook.com/zh-TW/blog/klook-discount-collection/',
      },
      {
        code: 'HUWNAN269509',
        benefit: '海外全商品 95 折',
        restriction: '限華南銀行卡；每月每帳號限用 1 次',
        verifiedAt: '2026-09-20',
        source: 'https://www.klook.com/zh-TW/blog/klook-discount-collection/',
      },
      {
        code: 'ESUN269509',
        benefit: '海外全商品 95 折',
        restriction: '限玉山銀行卡；每月每帳號限用 1 次',
        verifiedAt: '2026-09-20',
        source: 'https://www.klook.com/zh-TW/blog/klook-discount-collection/',
      },
      {
        code: 'CUBE269509',
        benefit: '海外全商品 95 折',
        restriction: '限國泰世華銀行卡；每月每帳號限用 1 次',
        verifiedAt: '2026-09-20',
        source: 'https://www.klook.com/zh-TW/blog/klook-discount-collection/',
      },
    ],
    campaigns: [
      {
        title: '12 週年慶 全站最高折 NT$1,212',
        detail: '週週推出全球熱門商品買 1 送 1，週末全站 88 折。不綁信用卡，數量有限、以結帳順序為準。',
        period: '2026-09-18 ~ 2026-10-11',
        source: 'https://www.klook.com/zh-TW/blog/klook-discount-collection/',
      },
    ],
  },
  {
    slug: 'iherb',
    name: 'iHerb',
    nameEn: 'iHerb',
    tagline: '保健食品、維他命、美妝海淘',
    officialUrl: 'https://www.iherb.com/',
    admitadProgram: 'iHerb.com INT（0.80–4%）',
    affiliateUrl: '',
    codes: [],
    campaigns: [],
  },
  {
    slug: 'trip-com',
    name: 'Trip.com',
    nameEn: 'Trip.com',
    tagline: '機票、飯店、火車票',
    officialUrl: 'https://tw.trip.com/',
    admitadProgram: 'Trip.com WW',
    affiliateUrl: '',
    codes: [],
    campaigns: [],
  },
  {
    slug: 'kkday',
    name: 'KKday',
    nameEn: 'KKday',
    tagline: '在地體驗、一日遊、票券',
    officialUrl: 'https://www.kkday.com/zh-tw',
    admitadProgram: 'KKday WW（7.79%）',
    affiliateUrl: '',
    codes: [
      {
        code: 'CUBE26SEP600',
        benefit: '全球商品滿 $6,000 折 $600',
        restriction: '限國泰世華銀行 CUBE 卡',
        verifiedAt: '2026-09-21',
        source: 'https://www.kkday.com/zh-tw/blog/25229/kkday-bank-coupon',
        expiresAt: '2026-09-30',
      },
      {
        code: 'ESUN26SEP1200',
        benefit: '全球商品滿 $9,000 折 $1,200',
        restriction: '限玉山銀行全卡',
        verifiedAt: '2026-09-21',
        source: 'https://www.kkday.com/zh-tw/blog/25229/kkday-bank-coupon',
        expiresAt: '2026-09-30',
      },
      {
        code: 'SKBINF7509',
        benefit: '全球商品單筆滿 $3,000 享 75 折',
        restriction: '限新光銀行 VISA 無限卡；此碼每月更換',
        verifiedAt: '2026-09-21',
        source: 'https://www.kkday.com/zh-tw/blog/25229/kkday-bank-coupon',
        expiresAt: '2026-09-30',
      },
      {
        code: 'JCARD091200',
        benefit: '日本機加酒滿額折 $1,200',
        restriction: '限台北富邦 J 卡',
        verifiedAt: '2026-09-21',
        source: 'https://www.kkday.com/zh-tw/blog/25229/kkday-bank-coupon',
        expiresAt: '2026-09-30',
      },
      {
        code: 'NEXT8SEP26',
        benefit: '台灣商品全 8 折',
        restriction: '限將來銀行 將將卡',
        verifiedAt: '2026-09-21',
        source: 'https://www.kkday.com/zh-tw/blog/25229/kkday-bank-coupon',
        expiresAt: '2026-09-30',
      },
      {
        code: 'PX8826',
        benefit: '全球行程體驗 88 折',
        restriction: '限全支付',
        verifiedAt: '2026-09-21',
        source: 'https://www.kkday.com/zh-tw/blog/25229/kkday-bank-coupon',
        expiresAt: '2026-09-30',
      },
      {
        code: 'APP90',
        benefit: 'APP 首購折 90 元',
        restriction: '限 KKday APP 首次購買',
        verifiedAt: '2026-09-21',
        source: 'https://www.kkday.com/zh-tw/blog/25229/kkday-bank-coupon',
      },
    ],
    campaigns: [],
  },
  {
    slug: 'surfshark',
    name: 'Surfshark',
    nameEn: 'Surfshark',
    tagline: 'VPN 訂閱',
    officialUrl: 'https://surfshark.com/',
    admitadProgram: 'Surfshark WW（US$24.50–31.50／單）',
    affiliateUrl: '',
    codes: [],
    campaigns: [],
  },
  {
    slug: 'casetify',
    name: 'CASETiFY',
    nameEn: 'CASETiFY',
    tagline: '手機殼、3C 配件',
    officialUrl: 'https://www.casetify.com/zh_TW/',
    admitadProgram: 'CASETiFY WW（3.50%）',
    affiliateUrl: '',
    codes: [],
    campaigns: [],
  },
];

export const getBrand = (slug: string) => BRANDS.find((b) => b.slug === slug);
