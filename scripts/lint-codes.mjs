#!/usr/bin/env node
/**
 * 券数据的硬闸门。build 前跑，任何一条不合规就退出码 1。
 * 存在的理由见 src/data/brands.ts 顶部注释：这个站的唯一卖点是「码是真的」，
 * 靠自觉守不住，要靠 CI。
 */
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../src/data/brands.ts', import.meta.url), 'utf8');
const today = new Date().toISOString().slice(0, 10);
const errs = [];

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
}

if (errs.length) {
  console.error('❌ 券数据不合规，build 中止：');
  errs.forEach((e) => console.error('   · ' + e));
  process.exit(1);
}
console.log(`✅ 券数据检查通过（${blocks.length} 条码）`);
