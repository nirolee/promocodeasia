#!/usr/bin/env node
/**
 * 生成「随手回帖用」的码速查表（本地工具，不上站）。
 *
 * 为什么不做成网站页面：2026-09-21 实测「玉山 優惠碼」0 月搜、「國泰世華 優惠碼」0 词，
 * 按银行建页没有搜索量支撑——这类问题发生在论坛对话里，不发生在搜索框里。
 * 所以它是工作流工具，输出到 /mnt/home_niro/docs/ 手机上开着对答即可。
 *
 * 用法: node scripts/cheatsheet.mjs [输出路径]
 */
import { readFileSync, writeFileSync } from 'node:fs';

const src = readFileSync(new URL('../src/data/brands.ts', import.meta.url), 'utf8');
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai' }).format(new Date());

// 按品牌块切分，再抽每块里的码
const blocks = src.split(/\n  \{\n    slug: '/).slice(1);
const brands = blocks.map((b) => {
  const slug = b.slice(0, b.indexOf("'"));
  const name = (b.match(/name: '([^']+)'/) || [])[1];
  const codes = [...b.matchAll(
    /code: '([^']+)',\s*\n\s*benefit: '([^']+)',\s*\n\s*restriction: '([^']+)',\s*\n\s*verifiedAt: '([^']+)',\s*\n\s*source: '[^']*',(?:\s*\n\s*expiresAt: '([^']+)',)?/g
  )].map((m) => ({ code: m[1], benefit: m[2], restriction: m[3], verifiedAt: m[4], expiresAt: m[5] || null }));
  return { slug, name, codes };
}).filter((x) => x.codes.length);

// 发卡行/支付方式：回帖时对方问的是「我某某卡能用吗」，所以按这个归组
const issuerOf = (r) => {
  const m = r.match(/限([^；;]+?)(?:卡|銀行全卡|銀行|全卡)(?:；|$|，)/);
  if (m) return m[1].replace(/銀行$/, '').trim();
  if (/全支付/.test(r)) return '全支付';
  if (/APP/.test(r)) return 'APP 首購';
  return '其他';
};

const rows = brands.flatMap((b) => b.codes.map((c) => ({ ...c, brand: b.name, issuer: issuerOf(c.restriction) })));
const byIssuer = {};
for (const r of rows) (byIssuer[r.issuer] ||= []).push(r);

const expired = (c) => c.expiresAt && c.expiresAt < today;
const soon = (c) => c.expiresAt && !expired(c) && c.expiresAt <= new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);

let md = `# 優惠碼速查（${today} 生成）\n\n`;
md += `共 ${rows.length} 組，涵蓋 ${brands.length} 個品牌。\n`;
md += `⚠️ 回帖前先看失效日；标 **已過期** 的别再贴出去。\n\n`;
for (const [issuer, list] of Object.entries(byIssuer).sort((a, b) => b[1].length - a[1].length)) {
  md += `## ${issuer}（${list.length} 組）\n\n`;
  for (const c of list) {
    const flag = expired(c) ? ' ❌**已過期**' : soon(c) ? ' ⚠️即將到期' : '';
    md += `- **${c.code}** — ${c.brand}｜${c.benefit}\n`;
    md += `  - 條件：${c.restriction}\n`;
    md += `  - 失效：${c.expiresAt || '官方未標注'}${flag}　核對：${c.verifiedAt}\n`;
  }
  md += '\n';
}
const out = process.argv[2] || '/mnt/home_niro/docs/promocode-cheatsheet.md';
writeFileSync(out, md);
console.log(`✅ ${out}（${rows.length} 组码 / ${Object.keys(byIssuer).length} 个发卡行分组）`);
