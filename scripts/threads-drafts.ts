/**
 * Threads 草稿生成器：从 brands.ts 算出当天该发的帖子，直接给出可贴文案。
 *
 * 为什么是「算」不是「写」：Threads 上搬运优惠码的号一抓一把，我们唯一不同的是
 * 站上有别人没有的数据——星期码（每天能用的不一样）、官方失效日（能算倒数）、
 * 银行码月版本（月初换一轮）。这三样都在 brands.ts 里，手写只会写错、写漏、忘发。
 *
 * 三个固定栏目（对应 Threads 运营方案）：
 *   today  每天：今天（星期 X）能用的限定碼
 *   week   每週一：本週要失效的碼（含月底換版的銀行碼）
 *   month  每月 1–2 號：銀行碼換版，新一輪核完
 * 「更正」类帖子不自动生成——那是人的事，也是最不能套模板的东西。
 *
 * 口味（用户定的，见 memory feedback_social_copy_tone）：短、口语、一条一件事，
 * 不要金句、不要排比、不要 emoji 堆砌，宁平淡不精巧。码写在正文里能长按复制，链接放最后。
 * Threads 单帖上限 500 字，这里卡 480。
 *
 * 用法：
 *   npx tsx scripts/threads-drafts.ts                 # 按今天（台北）该发什么，输出适用的栏目
 *   npx tsx scripts/threads-drafts.ts --which week    # 强制出某一栏（today|week|month|all）
 *   npx tsx scripts/threads-drafts.ts --date 2026-10-01 --which all
 *   npx tsx scripts/threads-drafts.ts --json          # 给代发脚本用
 */
import { BRANDS } from '../src/data/brands';
import type { Brand, Code } from '../src/data/brands';
import { liveCodes, daysUntil, todayTW, weekdayTW, versionEnd, versionLabel } from '../src/lib/codes';

const SITE = 'promocodeasia.com';
const MAX = 480;
const WD = ['一', '二', '三', '四', '五', '六', '日'];

const args = process.argv.slice(2);
const opt = (k: string) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
const today = opt('--date') ?? todayTW();
const which = opt('--which') ?? 'auto';
const asJson = args.includes('--json');

const wd = weekdayTW(today);
const dom = Number(today.slice(8, 10));
const ym = today.slice(0, 7);

type Draft = { kind: 'today' | 'week' | 'month'; text: string; codes: string[] };
const drafts: Draft[] = [];

/** 「滿 $1,000 享 94 折」→ 去掉多余空格，保留读者能一眼看懂的写法 */
const tidy = (s: string) => s.replace(/\s+/g, ' ').trim();

// ── today ────────────────────────────────────────────────────────────────────
function draftToday(): Draft | null {
  const items: { b: Brand; c: Code }[] = [];
  for (const b of BRANDS) for (const c of liveCodes(b, today)) if (c.weekday === wd) items.push({ b, c });
  if (!items.length) return null;
  // 同一品牌的合成一句；多数情况只有 KKday
  const byBrand = new Map<string, { b: Brand; c: Code }[]>();
  for (const it of items) { if (!byBrand.has(it.b.slug)) byBrand.set(it.b.slug, []); byBrand.get(it.b.slug)!.push(it); }
  const lines: string[] = [`今天週${WD[wd]}。`];
  for (const [, arr] of byBrand) {
    const b = arr[0].b;
    const parts = arr.map(({ c }) => `${tidy(c.benefit)}，碼 ${c.code}`);
    lines.push(`${b.name} ${parts.join('；')}。${parts.length > 1 ? '都' : ''}限今天下單。`);
    lines.push(`其他不綁星期的碼照常，整理在 ${SITE}/store/${b.slug}`);
  }
  return { kind: 'today', text: lines.join('\n'), codes: items.map((i) => i.c.code) };
}

// ── week ─────────────────────────────────────────────────────────────────────
function draftWeek(): Draft | null {
  const soon: { b: Brand; c: Code; left: number }[] = [];
  for (const b of BRANDS) for (const c of liveCodes(b, today)) {
    if (c.expiresAt) { const left = daysUntil(c.expiresAt, today); if (left >= 0 && left <= 7) soon.push({ b, c, left }); }
  }
  // 月底换版的银行码：官方没给失效日，只说每月换，另起一句，不和上面混
  const rotating = new Map<string, { b: Brand; n: number; end: string; left: number }>();
  for (const b of BRANDS) for (const c of liveCodes(b, today)) {
    const end = versionEnd(c); if (!end) continue;
    const left = daysUntil(end, today); if (left < 0 || left > 7) continue;
    const r = rotating.get(b.slug) ?? { b, n: 0, end, left }; r.n++; rotating.set(b.slug, r);
  }
  if (!soon.length && !rotating.size) return null;
  const lines: string[] = [];
  if (soon.length) {
    const byBrand = new Map<string, typeof soon>();
    for (const s of soon) { if (!byBrand.has(s.b.slug)) byBrand.set(s.b.slug, []); byBrand.get(s.b.slug)!.push(s); }
    for (const [, arr] of byBrand) {
      const b = arr[0].b;
      const dates = [...new Set(arr.map((s) => s.c.expiresAt!))].sort();
      const when = dates.map((d) => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`).join('、');
      // 挑最值得点名的两组：先挑人人可用的（没绑卡），再按 benefit 短的排——
      // 银行码只对持卡人有意义，放在点名位置等于对大多数人说废话
      const pick = [...arr]
        .sort((x, y) => Number(!!x.c.card) - Number(!!y.c.card) || x.c.benefit.length - y.c.benefit.length)
        .slice(0, 2);
      const named = pick.map(({ c }) => `${c.code}（${tidy(c.benefit)}）`).join('、');
      lines.push(`${b.name} 有 ${arr.length} 組碼 ${when} 到期，包含 ${named}。要用的這週用掉。`);
    }
  }
  for (const [, r] of rotating) {
    const label = versionLabel(r.b.codes.find((c) => c.officialVersion)?.officialVersion ?? `${ym}-01`);
    lines.push(`${r.b.name}的 ${r.n} 組銀行碼是 ${label}版，官方頁寫每月更換，${Number(r.end.slice(5, 7))}/${Number(r.end.slice(8, 10))} 之後等我核完新一輪再說能不能用。`);
  }
  lines.push(`哪幾組、到哪天，列在這：${SITE}/changes`);
  return { kind: 'week', text: lines.join('\n'), codes: soon.map((s) => s.c.code) };
}

// ── month ────────────────────────────────────────────────────────────────────
function draftMonth(): Draft | null {
  const first = `${ym}-01`;
  const out: string[] = [];
  const codes: string[] = [];
  for (const b of BRANDS) {
    const ver = liveCodes(b, today).filter((c) => c.officialVersion === ym);
    if (!ver.length) continue;
    const fresh = ver.filter((c) => c.verifiedAt >= first);
    if (fresh.length < ver.length) {
      // 数据还没核完就别发——发了等于拿旧码冒充新版
      out.push(`（${b.name}：${ym} 版標了 ${ver.length} 組，但只有 ${fresh.length} 組是本月核的，先跑 npm run refresh 再發）`);
      continue;
    }
    const cards = [...new Set(ver.map((c) => c.card).filter(Boolean))] as string[];
    const shown = cards.slice(0, 5).join('、') + (cards.length > 5 ? `…共 ${cards.length} 家` : '');
    out.push(`${b.name} ${versionLabel(ym)}銀行碼換了，新一輪 ${ver.length} 組核完，${shown}。每組都標了發卡行和限制，用之前先看自己那張卡：${SITE}/store/${b.slug}`);
    codes.push(...ver.map((c) => c.code));
  }
  if (!out.length) {
    // 没有任何本月版的码：多半是 refresh 还没跑。给一句提示（不是帖子），别静默
    const prev = BRANDS.filter((b) => b.codes.some((c) => c.officialVersion && c.officialVersion < ym)).map((b) => b.name);
    if (prev.length) out.push(`（${prev.join('、')} 還沒有 ${versionLabel(ym)}版的碼——先跑 npm run refresh 核完新一輪再發這條）`);
  }
  if (!out.length) return null;
  return { kind: 'month', text: out.join('\n'), codes };
}

// ── 组装 ─────────────────────────────────────────────────────────────────────
const wantToday = which === 'all' || which === 'today' || which === 'auto';
const wantWeek = which === 'all' || which === 'week' || (which === 'auto' && wd === 0);
const wantMonth = which === 'all' || which === 'month' || (which === 'auto' && (dom === 1 || dom === 2));

if (wantToday) { const d = draftToday(); if (d) drafts.push(d); }
if (wantWeek) { const d = draftWeek(); if (d) drafts.push(d); }
if (wantMonth) { const d = draftMonth(); if (d) drafts.push(d); }

for (const d of drafts) {
  if (d.text.length > MAX) d.text = d.text.slice(0, MAX - 1) + '…';
}

if (asJson) {
  console.log(JSON.stringify({ date: today, weekday: WD[wd], drafts }, null, 2));
} else {
  console.log(`# ${today}（週${WD[wd]}）  ${drafts.length} 條`);
  for (const d of drafts) {
    console.log(`\n── ${d.kind} ── ${d.text.length} 字`);
    console.log(d.text);
  }
  if (!drafts.length) console.log('（今天沒有該發的固定欄目）');
}
