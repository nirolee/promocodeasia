#!/usr/bin/env node
/**
 * 券数据的硬闸门。build 前跑，任何一条不合规就退出码 1。
 * 存在的理由见 src/data/brands.ts 顶部注释：这个站的唯一卖点是「码是真的」，
 * 靠自觉守不住，要靠 CI。
 */
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../src/data/brands.ts', import.meta.url), 'utf8');
// 用 Asia/Shanghai 的「今天」，不是 UTC 也不是机器本地时区。
// 开发机时区是 JST（比北京快 1 小时），toISOString() 取 UTC 又会比北京慢 8 小时——
// 两头都会把当天写的 verifiedAt 误判成未来日期（2026-09-21 实测被拦）。
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai' }).format(new Date());
const errs = [];
const warns = [];
const daysBetween = (from, to) => Math.round((Date.parse(to) - Date.parse(from)) / 86400000);

// 逐个 code 对象做浅解析（数据是手写字面量，不引入 TS 运行时）
const blocks = src.split(/\{\s*\n\s*code:/).slice(1);
for (const b of blocks) {
  const seg = b.slice(0, b.indexOf('},'));
  const get = (k) => (seg.match(new RegExp(k + ":\\s*'([^']*)'")) || [])[1];
  const code = (seg.match(/^\s*'([^']*)'/) || [])[1] || '(未知)';
  const v = get('verifiedAt');
  const s = get('source');
  const r = get('restriction');
  if (!v) errs.push(`${code}: 缺 verifiedAt`);
  else if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) errs.push(`${code}: verifiedAt 格式错 (${v})`);
  else if (v > today) errs.push(`${code}: verifiedAt 是未来日期 (${v})`);
  if (!s) errs.push(`${code}: 缺 source`);
  else if (/couponfollow|retailmenot|knoji|valuecom|worthepenny|dealy\.tw/i.test(s))
    errs.push(`${code}: source 指向别的券站（${s}）——只接受品牌官方页或联盟后台`);
  if (!r) errs.push(`${code}: 缺 restriction（没有条件就写「無」）`);

  // 到期不算「不合规」，所以只警告不拦 build：
  // 渲染层（src/lib/codes.ts）已经把过期码从 HTML 里摘掉了，留着数据不会骗到读者。
  // 但如果这里 exit 1，一条码过期就会连带堵死所有无关的部署，代价远大于收益。
  const e = get('expiresAt');
  if (e && e < today) warns.push(`${code}: 已於 ${e} 过期（页面已自动摘除，可以从 brands.ts 删掉了）`);
  else if (e && daysBetween(today, e) <= 7) warns.push(`${code}: ${daysBetween(today, e)} 天后（${e}）到期，该去官方页复核了`);
  else if (v && daysBetween(v, today) > 30) warns.push(`${code}: 已 ${daysBetween(v, today)} 天没复核（页面已降级成「可能已更新」）`);
}

if (warns.length) {
  console.warn('⚠️  券数据需要人工复核：');
  warns.forEach((w) => console.warn('   · ' + w));
}

if (errs.length) {
  console.error('❌ 券数据不合规，build 中止：');
  errs.forEach((e) => console.error('   · ' + e));
  process.exit(1);
}
console.log(`✅ 券数据检查通过（${blocks.length} 条码）`);
