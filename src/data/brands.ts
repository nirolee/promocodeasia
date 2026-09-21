/**
 * 券的唯一真源。
 *
 * 设计约束（不是建议，是硬性的）：
 *   1. 每个 code 必须有 `verifiedAt` + `source`，否则 scripts/lint-codes.mjs 会让 build 失败。
 *      理由：优惠码有到期日，银行合作码多半每月换一次，而多数整理页只在页首写一个
 *      「最后更新」，不交代每组码各自何时核对。实测过的例子：couponfollow 的 Caraway 页
 *      20 条码没有一条标验证日期，还有一条到期日写着 2/19/2133；Spaceship 的 SPST25 是 .net 的码。
 *
 *      ⚠️ 2026-09-21 更正：这里原本写「聚合站的 HUWNAN2640009 是废码，真码是 HUWNAN269509」——
 *      **是我错了**。用真浏览器打开 Klook 官方页（curl 会被 403 挡掉）才看到，两个码都在官方页上，
 *      分属两个活动表：HUWNAN269509 = 海外全商品 95 折；HUWNAN2640009 = 全站满 $5,000 折 $400。
 *      教训：一个品牌页上可能有多张活动表，在其中一张里没找到某个码，不等于那个码是假的。
 *      「码是真的、且标明什么时候验的」是这个站唯一的护城河，不能靠自觉。
 *   2. `restriction` 必填。台湾的券绝大多数绑定特定发卡行或新客身份，
 *      不写清楚等于骗读者点进去再失望。
 *   3. 没有已验证的码时，`codes: []` —— 页面会明说「目前没有可用的公开码」，
 *      不允许拿过期码凑数。这是和 couponfollow 那种站的根本区别。
 *   4. 只能放品牌公开发布或联盟后台授权的码。渠道专属码（博客读者专属之类）不能转贴——
 *      2026-09-21 在 Involve Asia 看 Klook 的费率表，里面明写着一行
 *      「Unsuitable promo code redeemed —— 0%」：用户用了不该用的码，整单佣金归零。
 *      所以转贴专属码不只是违规，**还会把这单的佣金一起赔进去**，读者也核销不了。
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
  /**
   * 这组码能不能拿到佣金。出站埋点会带上它，目的是不要把注定零佣金的点击算进收入预期。
   *
   * 'no' 必须有依据 —— 目前只有 Klook：其联盟条款明写「银行/支付/会员合作码不计佣」，
   * 且 Involve Asia 的费率表上有一行「Unsuitable promo code redeemed —— 0%」，
   * 意思是读者用了这类码，整单佣金归零。
   * **没查证过条款的一律 'unknown'，不要凭「看起来像银行码」就标 'no'。**
   */
  commissionable?: 'yes' | 'no' | 'unknown';
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
        code: 'HUWNAN269509',
        benefit: '海外全商品 95 折',
        restriction: '限華南銀行；每帳號每月限用 1 次，需先點擊官方活動連結；銀行碼每月更換，此為官方 9 月版本',
        verifiedAt: '2026-09-21',
        source: 'https://www.klook.com/zh-TW/blog/klook-discount-collection/',
        commissionable: 'no',
      },
      {
        code: 'UBOT269509',
        benefit: '海外全商品 95 折',
        restriction: '限聯邦銀行；每帳號每月限用 1 次，需先點擊官方活動連結；銀行碼每月更換，此為官方 9 月版本',
        verifiedAt: '2026-09-21',
        source: 'https://www.klook.com/zh-TW/blog/klook-discount-collection/',
        commissionable: 'no',
      },
      {
        code: 'FCB269509',
        benefit: '海外全商品 95 折',
        restriction: '限第一銀行；每帳號每月限用 1 次，需先點擊官方活動連結；銀行碼每月更換，此為官方 9 月版本',
        verifiedAt: '2026-09-21',
        source: 'https://www.klook.com/zh-TW/blog/klook-discount-collection/',
        commissionable: 'no',
      },
      {
        code: 'ESUN269509',
        benefit: '海外全商品 95 折',
        restriction: '限玉山銀行；每帳號每月限用 1 次，需先點擊官方活動連結；銀行碼每月更換，此為官方 9 月版本',
        verifiedAt: '2026-09-21',
        source: 'https://www.klook.com/zh-TW/blog/klook-discount-collection/',
        commissionable: 'no',
      },
      {
        code: 'DBS269509',
        benefit: '海外全商品 95 折',
        restriction: '限星展銀行；每帳號每月限用 1 次，需先點擊官方活動連結；銀行碼每月更換，此為官方 9 月版本',
        verifiedAt: '2026-09-21',
        source: 'https://www.klook.com/zh-TW/blog/klook-discount-collection/',
        commissionable: 'no',
      },
      {
        code: 'CHB269509',
        benefit: '海外全商品 95 折',
        restriction: '限彰化銀行；每帳號每月限用 1 次，需先點擊官方活動連結；銀行碼每月更換，此為官方 9 月版本',
        verifiedAt: '2026-09-21',
        source: 'https://www.klook.com/zh-TW/blog/klook-discount-collection/',
        commissionable: 'no',
      },
      {
        code: 'CUBE269509',
        benefit: '海外全商品 95 折',
        restriction: '限國泰世華銀行；每帳號每月限用 1 次，需先點擊官方活動連結；銀行碼每月更換，此為官方 9 月版本',
        verifiedAt: '2026-09-21',
        source: 'https://www.klook.com/zh-TW/blog/klook-discount-collection/',
        commissionable: 'no',
      },
      {
        code: 'CTBCLP26102',
        benefit: '海外商品 9 折',
        restriction: '限中國信託 Line Pay 卡；每帳號全年限用 10 次，每筆最高加碼 1,000 點，需先點擊官方活動連結；銀行碼每月更換，此為官方 9 月版本',
        verifiedAt: '2026-09-21',
        source: 'https://www.klook.com/zh-TW/blog/klook-discount-collection/',
        commissionable: 'no',
      },
      {
        code: 'CTBCCI269509',
        benefit: '海外全商品 95 折',
        restriction: '限中國信託 華航聯名卡；每帳號每月限用 1 次，需先點擊官方活動連結；銀行碼每月更換，此為官方 9 月版本',
        verifiedAt: '2026-09-21',
        source: 'https://www.klook.com/zh-TW/blog/klook-discount-collection/',
        commissionable: 'no',
      },
      {
        code: 'VISA269209',
        benefit: '海外全商品 92 折',
        restriction: '限Visa；每帳號每月限用 1 次，需先點擊官方活動連結；銀行碼每月更換，此為官方 9 月版本',
        verifiedAt: '2026-09-21',
        source: 'https://www.klook.com/zh-TW/blog/klook-discount-collection/',
        commissionable: 'no',
      },
      {
        code: 'VSKB269309',
        benefit: '海外全商品 93 折',
        restriction: '限Visa 新光；每帳號每月限用 1 次，需先點擊官方活動連結；銀行碼每月更換，此為官方 9 月版本',
        verifiedAt: '2026-09-21',
        source: 'https://www.klook.com/zh-TW/blog/klook-discount-collection/',
        commissionable: 'no',
      },
      {
        code: 'AFTEE269509',
        benefit: '海外全商品 95 折',
        restriction: '限AFTEE；每帳號每月限用 1 次，需先點擊官方活動連結；銀行碼每月更換，此為官方 9 月版本',
        verifiedAt: '2026-09-21',
        source: 'https://www.klook.com/zh-TW/blog/klook-discount-collection/',
        commissionable: 'no',
      },
      {
        code: 'JCARD269509',
        benefit: '海外全商品 95 折',
        restriction: '限富邦J卡；每帳號每月限用 1 次，需先點擊官方活動連結；銀行碼每月更換，此為官方 9 月版本',
        verifiedAt: '2026-09-21',
        source: 'https://www.klook.com/zh-TW/blog/klook-discount-collection/',
        commissionable: 'no',
      },
      {
        code: 'UBOTTM2625009',
        benefit: '全球體驗/交通 85 折，最高折抵 $250 元',
        restriction: '限聯邦銀行；每帳號每月限用 1 次，需先點擊官方活動連結；銀行碼每月更換，此為官方 9 月版本',
        verifiedAt: '2026-09-21',
        source: 'https://www.klook.com/zh-TW/blog/klook-discount-collection/',
        commissionable: 'no',
      },
      {
        code: 'HUWNAN2640009',
        benefit: '全卡全站商品滿 $5,000 元折 $400 元',
        restriction: '限華南銀行；每帳號每月限用 1 次，需先點擊官方活動連結；銀行碼每月更換，此為官方 9 月版本',
        verifiedAt: '2026-09-21',
        source: 'https://www.klook.com/zh-TW/blog/klook-discount-collection/',
        commissionable: 'no',
      },
      {
        code: 'FCBHOT268509',
        benefit: '全球飯店 85 折，最高折抵 $400 元',
        restriction: '限第一銀行；每帳號每月限用 1 次，需先點擊官方活動連結；銀行碼每月更換，此為官方 9 月版本',
        verifiedAt: '2026-09-21',
        source: 'https://www.klook.com/zh-TW/blog/klook-discount-collection/',
        commissionable: 'no',
      },
      {
        code: 'DBS2645009',
        benefit: '全站商品滿 $3,000 元折 $450 元',
        restriction: '限星展銀行；每帳號每月限用 1 次，需先點擊官方活動連結；銀行碼每月更換，此為官方 9 月版本',
        verifiedAt: '2026-09-21',
        source: 'https://www.klook.com/zh-TW/blog/klook-discount-collection/',
        commissionable: 'no',
      },
      {
        code: 'CHB26909',
        benefit: '全站商品滿千享 9 折，最高折抵 $150 元',
        restriction: '限彰化銀行；每帳號每月限用 1 次，需先點擊官方活動連結；銀行碼每月更換，此為官方 9 月版本',
        verifiedAt: '2026-09-21',
        source: 'https://www.klook.com/zh-TW/blog/klook-discount-collection/',
        commissionable: 'no',
      },
      {
        code: 'KJCB2609',
        benefit: '指定商品滿 $2,000 元折 $200 元',
        restriction: '限JCB；每帳號每月限用 1 次，需先點擊官方活動連結；銀行碼每月更換，此為官方 9 月版本',
        verifiedAt: '2026-09-21',
        source: 'https://www.klook.com/zh-TW/blog/klook-discount-collection/',
        commissionable: 'no',
      },
      {
        code: 'VSKBHOT267509',
        benefit: '海外飯店 75 折，最高折抵 $800 元',
        restriction: '限Visa新光三越聯名卡；每帳號每月限用 1 次，需先點擊官方活動連結；銀行碼每月更換，此為官方 9 月版本',
        verifiedAt: '2026-09-21',
        source: 'https://www.klook.com/zh-TW/blog/klook-discount-collection/',
        commissionable: 'no',
      },
      {
        code: 'POSTHS268509',
        benefit: '高鐵國旅聯票滿 $1,000 折 $100',
        restriction: '限中華郵政VISA金融卡；每帳號每月限用 1 次，需先點擊官方活動連結；銀行碼每月更換，此為官方 9 月版本',
        verifiedAt: '2026-09-21',
        source: 'https://www.klook.com/zh-TW/blog/klook-discount-collection/',
        commissionable: 'no',
      },
      {
        code: 'POSTKLBT267509',
        benefit: '全海外商品 75 折起，最高折抵 $500 元',
        restriction: '限中華郵政VISA金融卡；每帳號每月限用 1 次，需先點擊官方活動連結；銀行碼每月更換，此為官方 9 月版本',
        verifiedAt: '2026-09-21',
        source: 'https://www.klook.com/zh-TW/blog/klook-discount-collection/',
        commissionable: 'no',
      },
      {
        code: 'KLEHOT7526Q3',
        benefit: '海外飯店每晚 75 折優惠，折抵上限 NT$1,500',
        restriction: '限國泰世華銀行長榮航空聯名卡 無限卡；每帳號每月限用 1 次，需先點擊官方活動連結；銀行碼每月更換，此為官方 9 月版本',
        verifiedAt: '2026-09-21',
        source: 'https://www.klook.com/zh-TW/blog/klook-discount-collection/',
        commissionable: 'no',
      },
      {
        code: 'KLEHOT8526Q3',
        benefit: '海外飯店每晚 85 折優惠，折抵上限 NT$500',
        restriction: '限國泰世華銀行長榮航空聯名卡 御璽卡；每帳號每月限用 1 次，需先點擊官方活動連結；銀行碼每月更換，此為官方 9 月版本',
        verifiedAt: '2026-09-21',
        source: 'https://www.klook.com/zh-TW/blog/klook-discount-collection/',
        commissionable: 'no',
      },
      {
        code: 'MCWORLD10OFF',
        benefit: '全站滿 $11,010 元享 9 折，最高折抵 $1,101 元',
        restriction: '限Mastercard 萬事達指定卡；每帳號每月限用 1 次，需先點擊官方活動連結；銀行碼每月更換，此為官方 9 月版本',
        verifiedAt: '2026-09-21',
        source: 'https://www.klook.com/zh-TW/blog/klook-discount-collection/',
        commissionable: 'no',
      },
      {
        code: 'JCARDHO0909',
        benefit: '星野集團指定飯店 9 折，最高折 $500',
        restriction: '限富邦J卡；每帳號每月限用 1 次，需先點擊官方活動連結；銀行碼每月更換，此為官方 9 月版本',
        verifiedAt: '2026-09-21',
        source: 'https://www.klook.com/zh-TW/blog/klook-discount-collection/',
        commissionable: 'no',
      },
      {
        code: 'JCARDKR7509',
        benefit: '韓國鐵路 75 折，最高折 $200',
        restriction: '限富邦J卡；每帳號每月限用 1 次，需先點擊官方活動連結；銀行碼每月更換，此為官方 9 月版本',
        verifiedAt: '2026-09-21',
        source: 'https://www.klook.com/zh-TW/blog/klook-discount-collection/',
        commissionable: 'no',
      },
      {
        code: 'CTBCCIHOT262H85',
        benefit: '海外飯店 85 折，最高折抵 NT$700',
        restriction: '限中國信託華航卡 璀璨無限；每帳號每月限用 1 次，需先點擊官方活動連結；銀行碼每月更換，此為官方 9 月版本',
        verifiedAt: '2026-09-21',
        source: 'https://www.klook.com/zh-TW/blog/klook-discount-collection/',
        commissionable: 'no',
      },
      {
        code: 'CTBCCIHOT262H8',
        benefit: '海外飯店 8 折，最高折抵 NT$1,000',
        restriction: '限中國信託華航卡 鼎尊無限；每帳號每月限用 1 次，需先點擊官方活動連結；銀行碼每月更換，此為官方 9 月版本',
        verifiedAt: '2026-09-21',
        source: 'https://www.klook.com/zh-TW/blog/klook-discount-collection/',
        commissionable: 'no',
      },
      {
        code: 'ESUNSKS2688',
        benefit: '日本新幹線享 88 折，最高折抵 $300 元',
        restriction: '限玉山銀行；每帳號每月限用 1 次，需先點擊官方活動連結；銀行碼每月更換，此為官方 9 月版本',
        verifiedAt: '2026-09-21',
        source: 'https://www.klook.com/zh-TW/blog/klook-discount-collection/',
        commissionable: 'no',
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
    // 注意：/deals 頁確實沒有碼（折扣掛在商品上自動套用），但**首頁橫幅有季節活動碼**。
    // 2026-09-21 第一次只查 /deals 就誤判成「不發碼」，查首頁才發現 26MOON24。
    codes: [
      {
        code: '26MOON24',
        benefit: '中秋佳節好禮特惠 76 折',
        restriction: '部分特殊商品不參與；以官方頁面標示的適用範圍為準',
        verifiedAt: '2026-09-21',
        source: 'https://tw.iherb.com/',
      },
    ],
    campaigns: [
      {
        title: '中秋佳節好禮特惠 76 折酬賓',
        detail: '折扣於商品頁直接呈現、結帳自動套用，不需要輸入優惠碼。',
        period: '以官方頁面公告為準（2026-09-21 核對時進行中）',
        source: 'https://tw.iherb.com/deals',
      },
      {
        title: '購物滿 NT$790 免運費',
        detail: '台灣地區常態門檻，不需要輸入優惠碼。',
        period: '常態',
        source: 'https://tw.iherb.com/deals',
      },
      {
        title: '定期購訂單最多省 10%',
        detail: '把常買的商品設成定期購，折扣自動套用，不需要輸入優惠碼。買保健品長期回購的話，這個比任何一次性折扣碼都划算。',
        period: '常態',
        source: 'https://tw.iherb.com/',
      },
      {
        title: '新客首購優惠（需訂閱電子報領取）',
        detail: '首頁彈窗輸入 Email 可領取新客折扣，僅限新客戶、部分特殊商品不參與。',
        period: '常態',
        source: 'https://tw.iherb.com/',
      },
    ],
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
        restriction: '限國泰世華銀行 CUBE 卡；銀行碼每月更換，此為官方 9 月版本',
        verifiedAt: '2026-09-21',
        source: 'https://www.kkday.com/zh-tw/blog/25229/kkday-bank-coupon',
        expiresAt: '2026-09-30',
        commissionable: 'unknown',
      },
      {
        code: 'ESUN26SEP1200',
        benefit: '全球商品滿 $9,000 折 $1,200',
        restriction: '限玉山銀行全卡；銀行碼每月更換，此為官方 9 月版本',
        verifiedAt: '2026-09-21',
        source: 'https://www.kkday.com/zh-tw/blog/25229/kkday-bank-coupon',
        expiresAt: '2026-09-30',
        commissionable: 'unknown',
      },
      {
        code: 'SKBINF7509',
        benefit: '全球商品單筆滿 $3,000 享 75 折',
        restriction: '限新光銀行 VISA 無限卡；官方註明此碼每月不同；銀行碼每月更換，此為官方 9 月版本',
        verifiedAt: '2026-09-21',
        source: 'https://www.kkday.com/zh-tw/blog/25229/kkday-bank-coupon',
        expiresAt: '2026-09-30',
        commissionable: 'unknown',
      },
      {
        code: 'JCARD091200',
        benefit: '日本機加酒滿額折 $1,200',
        restriction: '限台北富邦 J 卡；銀行碼每月更換，此為官方 9 月版本',
        verifiedAt: '2026-09-21',
        source: 'https://www.kkday.com/zh-tw/blog/25229/kkday-bank-coupon',
        expiresAt: '2026-09-30',
        commissionable: 'unknown',
      },
      {
        code: '26JCB09',
        benefit: '日、韓、港、澳、泰、越滿額 9 折',
        restriction: '限 JCB 晶緻卡／極緻卡；官方註明此碼每月不同；銀行碼每月更換，此為官方 9 月版本',
        verifiedAt: '2026-09-21',
        source: 'https://www.kkday.com/zh-tw/blog/25229/kkday-bank-coupon',
        expiresAt: '2026-09-30',
        commissionable: 'unknown',
      },
      {
        code: 'NEXT8SEP26',
        benefit: '台灣商品全 8 折',
        restriction: '限將來銀行 將將卡；銀行碼每月更換，此為官方 9 月版本',
        verifiedAt: '2026-09-21',
        source: 'https://www.kkday.com/zh-tw/blog/25229/kkday-bank-coupon',
        expiresAt: '2026-09-30',
        commissionable: 'unknown',
      },
      {
        code: 'PX8826',
        benefit: '全球行程體驗 88 折',
        restriction: '限全支付；銀行碼每月更換，此為官方 9 月版本',
        verifiedAt: '2026-09-21',
        source: 'https://www.kkday.com/zh-tw/blog/25229/kkday-bank-coupon',
        expiresAt: '2026-09-30',
        commissionable: 'unknown',
      },
      {
        code: 'WIN600',
        benefit: '冬季超早鳥行程體驗滿 $5,000 折 $600',
        restriction: '限冬季超早鳥指定行程體驗',
        verifiedAt: '2026-09-21',
        source: 'https://www.kkday.com/zh-tw/blog/25229/kkday-bank-coupon',
        expiresAt: '2026-09-30',
        commissionable: 'unknown',
      },
      {
        code: 'WIN1200',
        benefit: '冬季超早鳥行程體驗滿 $10,000 折 $1,200',
        restriction: '限冬季超早鳥指定行程體驗',
        verifiedAt: '2026-09-21',
        source: 'https://www.kkday.com/zh-tw/blog/25229/kkday-bank-coupon',
        expiresAt: '2026-09-30',
        commissionable: 'unknown',
      },
      {
        code: 'KKSUMMERTOUR',
        benefit: '日本指定行程輸碼再享 8 折',
        restriction: '限日本指定行程',
        verifiedAt: '2026-09-21',
        source: 'https://www.kkday.com/zh-tw/blog/25229/kkday-bank-coupon',
        expiresAt: '2026-09-30',
        commissionable: 'unknown',
      },
      {
        code: '26AWJPTOUR',
        benefit: '日本行程／體驗／包車／租車不限金額 93 折',
        restriction: '限日本行程、體驗、包車、租車；官方頁上此碼標了兩個期限（9/30 與 12/31），我們取較早的',
        verifiedAt: '2026-09-21',
        source: 'https://www.kkday.com/zh-tw/blog/25229/kkday-bank-coupon',
        expiresAt: '2026-09-30',
        commissionable: 'unknown',
      },
      {
        code: '26TRANS',
        benefit: '點對點機場接送 94 折',
        restriction: '限機場接送商品',
        verifiedAt: '2026-09-21',
        source: 'https://www.kkday.com/zh-tw/blog/25229/kkday-bank-coupon',
        expiresAt: '2026-12-31',
        commissionable: 'unknown',
      },
      {
        code: 'JPTRAIN',
        benefit: '日本鐵路不限金額 95 折，最高折 $150',
        restriction: '限日本鐵路商品',
        verifiedAt: '2026-09-21',
        source: 'https://www.kkday.com/zh-tw/blog/25229/kkday-bank-coupon',
        expiresAt: '2026-12-31',
        commissionable: 'unknown',
      },
      {
        code: 'JPNEWTRAIN',
        benefit: '日本鐵路新戶限定不限金額 93 折，最高折 $100',
        restriction: '限日本鐵路商品，且限 KKday 新客',
        verifiedAt: '2026-09-21',
        source: 'https://www.kkday.com/zh-tw/blog/25229/kkday-bank-coupon',
        expiresAt: '2026-12-31',
        commissionable: 'unknown',
      },
      {
        code: 'KKHOTELNEW',
        benefit: '新客住宿 92 折',
        restriction: '限住宿商品，且限 KKday 新客',
        verifiedAt: '2026-09-21',
        source: 'https://www.kkday.com/zh-tw/blog/25229/kkday-bank-coupon',
        expiresAt: '2026-12-31',
        commissionable: 'unknown',
      },
      {
        code: 'KKHOTEL',
        benefit: '會員住宿 95 折',
        restriction: '限住宿商品，需為 KKday 會員',
        verifiedAt: '2026-09-21',
        source: 'https://www.kkday.com/zh-tw/blog/25229/kkday-bank-coupon',
        expiresAt: '2026-12-31',
        commissionable: 'unknown',
      },
      {
        code: 'THSRHL8000',
        benefit: '高鐵假期限時快閃優惠',
        restriction: '限高鐵假期商品；官方註明搭配國旅卡更優惠',
        verifiedAt: '2026-09-21',
        source: 'https://www.kkday.com/zh-tw/blog/25229/kkday-bank-coupon',
        expiresAt: '2026-12-31',
        commissionable: 'unknown',
      },
      {
        code: 'THSR26OF5',
        benefit: '高鐵國旅聯票老朋友優惠',
        restriction: '限高鐵國旅聯票；官方註明搭配國旅卡更優惠',
        verifiedAt: '2026-09-21',
        source: 'https://www.kkday.com/zh-tw/blog/25229/kkday-bank-coupon',
        expiresAt: '2026-12-31',
        commissionable: 'unknown',
      },
      {
        code: 'HMCDAY',
        benefit: '港澳中商品滿 $1,500 享 94 折',
        restriction: '限星期一下單，且限港澳中商品',
        verifiedAt: '2026-09-21',
        source: 'https://www.kkday.com/zh-tw/blog/25229/kkday-bank-coupon',
        expiresAt: '2026-12-31',
        commissionable: 'unknown',
      },
      {
        code: 'BSDAY',
        benefit: '釜山全商品滿 $2,200 享 96 折',
        restriction: '限星期二下單，且限釜山商品',
        verifiedAt: '2026-09-21',
        source: 'https://www.kkday.com/zh-tw/blog/25229/kkday-bank-coupon',
        expiresAt: '2026-12-31',
        commissionable: 'unknown',
      },
      {
        code: 'SEADAY',
        benefit: '東南亞商品滿 $1,700 享 93 折',
        restriction: '限星期三下單，且限東南亞商品',
        verifiedAt: '2026-09-21',
        source: 'https://www.kkday.com/zh-tw/blog/25229/kkday-bank-coupon',
        expiresAt: '2026-12-31',
        commissionable: 'unknown',
      },
      {
        code: 'WEDKKHOTEL',
        benefit: '飯店晚鳥享 9 折',
        restriction: '限星期三下單，且限飯店商品',
        verifiedAt: '2026-09-21',
        source: 'https://www.kkday.com/zh-tw/blog/25229/kkday-bank-coupon',
        expiresAt: '2026-12-31',
        commissionable: 'unknown',
      },
      {
        code: 'SELDAY',
        benefit: '首爾商品滿 $2,500 享 93 折',
        restriction: '限星期四下單，且限首爾商品',
        verifiedAt: '2026-09-21',
        source: 'https://www.kkday.com/zh-tw/blog/25229/kkday-bank-coupon',
        expiresAt: '2026-12-31',
        commissionable: 'unknown',
      },
      {
        code: 'JPDAY',
        benefit: '日本商品滿 $1,000 享 94 折',
        restriction: '限星期四下單，且限日本商品',
        verifiedAt: '2026-09-21',
        source: 'https://www.kkday.com/zh-tw/blog/25229/kkday-bank-coupon',
        expiresAt: '2026-12-31',
        commissionable: 'unknown',
      },
      {
        code: 'TWDAY',
        benefit: '台灣指定商品滿 $1,800 享 92 折',
        restriction: '限星期五下單，且限台灣指定商品',
        verifiedAt: '2026-09-21',
        source: 'https://www.kkday.com/zh-tw/blog/25229/kkday-bank-coupon',
        expiresAt: '2026-12-31',
        commissionable: 'unknown',
      },
      {
        code: 'EADAY',
        benefit: '歐美全商品滿 $6,000 享 94 折',
        restriction: '限星期六下單，且限歐美商品',
        verifiedAt: '2026-09-21',
        source: 'https://www.kkday.com/zh-tw/blog/25229/kkday-bank-coupon',
        expiresAt: '2026-12-31',
        commissionable: 'unknown',
      },
      {
        code: 'OCDAY',
        benefit: '紐澳全商品滿 $5,000 享 93 折',
        restriction: '限星期日下單，且限紐澳商品',
        verifiedAt: '2026-09-21',
        source: 'https://www.kkday.com/zh-tw/blog/25229/kkday-bank-coupon',
        expiresAt: '2026-12-31',
        commissionable: 'unknown',
      },
      {
        code: 'F1ZONE4',
        benefit: 'F1 新加坡站 Zone 4 一日入場券 95 折',
        restriction: '限 Zone 4 Walkabout Pass',
        verifiedAt: '2026-09-21',
        source: 'https://www.kkday.com/zh-tw/blog/25229/kkday-bank-coupon',
        expiresAt: '2026-10-11',
        commissionable: 'unknown',
      },
      {
        code: 'F1PREMWALK',
        benefit: 'F1 新加坡站全區一日入場券 97 折',
        restriction: '限 Premier Walkabout Pass',
        verifiedAt: '2026-09-21',
        source: 'https://www.kkday.com/zh-tw/blog/25229/kkday-bank-coupon',
        expiresAt: '2026-10-11',
        commissionable: 'unknown',
      },
      {
        code: 'APP90',
        benefit: 'APP 首購折 90 元',
        restriction: '限 KKday APP 首次購買',
        verifiedAt: '2026-09-21',
        source: 'https://www.kkday.com/zh-tw/blog/25229/kkday-bank-coupon',
        commissionable: 'unknown',
      },
    ],
    campaigns: [
      {
        title: '星展銀行 饗樂生活卡｜全站不限金額 8 折',
        detail: '折扣碼不是固定字串，是「你的卡號前 8 碼 + DBS26」，所以做不成可複製的碼——請照這個規則自行組出來再輸入。',
        period: '2026-09-30 前（官方 9 月版本，每月更換）',
        source: 'https://www.kkday.com/zh-tw/blog/25229/kkday-bank-coupon',
      },
      {
        title: '台新銀行 Richart 卡｜切換玩旅刷方案最高 16.6% 回饋',
        detail: '回饋走銀行方案，不需要輸入優惠碼。',
        period: '2026-09-30 前（官方 9 月版本）',
        source: 'https://www.kkday.com/zh-tw/blog/25229/kkday-bank-coupon',
      },
    ],
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
    slug: 'nordvpn',
    name: 'NordVPN',
    nameEn: 'NordVPN',
    tagline: 'VPN 訂閱',
    officialUrl: 'https://nordvpn.com/zh-tw/',
    admitadProgram: 'NordVPN WW（40%）',
    affiliateUrl: '',
    // 2026-09-21 查官方首頁無可輸入的碼；折扣走方案頁的限時價，不是優惠碼
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
