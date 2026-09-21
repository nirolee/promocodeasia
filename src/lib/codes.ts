/**
 * 码的时效判定。
 *
 * 为什么单独一个文件：过期判定要在三个地方用同一套口径——首页的计数、品牌页的渲染、
 * 以及页面里的客户端兜底脚本。写散了迟早会出现「首页说有 7 组、点进去只有 1 组」。
 *
 * 为什么「今天」要指定 Asia/Shanghai：开发机时区是 JST（比台北快 1 小时），
 * CI 机器多半是 UTC（比台北慢 8 小时）。不钉死时区的话，同一份数据在不同机器上
 * build 出来的结果会差一天——正好卡在「9-30 失效」这种边界上。
 */
import type { Brand, Code } from '../data/brands';

/** 台北时区的今天，YYYY-MM-DD。与 scripts/lint-codes.mjs 保持同一口径。 */
export function todayTW(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai' }).format(new Date());
}

/** 官方标注的失效日已过 = 过期。没标失效日的码不算过期（多数码不标）。 */
export function isExpired(c: Code, today: string = todayTW()): boolean {
  return !!c.expiresAt && c.expiresAt < today;
}

/** 距今天几天前核对的。 */
export function daysSince(date: string, today: string = todayTW()): number {
  return Math.round((Date.parse(today) - Date.parse(date)) / 86400000);
}

/**
 * 超过这个天数没重新核对，就把「✓ 已核对」降级成「⚠ 可能已更新」。
 *
 * 30 天的依据：站上占比最大的那批是银行合作码，KKday 自己在页面上写了
 * 「此碼每月更換」（见 brands.ts 里 SKBINF7509 的 restriction）。也就是说
 * 一个月没复核的银行码，本来就该默认当作不可信——即使它没标失效日。
 * 这类码不能直接删（可能还有效），但不能继续挂着绿色的「已核对」。
 */
export const STALE_AFTER_DAYS = 30;

export function isStale(c: Code, today: string = todayTW()): boolean {
  return daysSince(c.verifiedAt, today) > STALE_AFTER_DAYS;
}

/** 该显示给读者的码：过期的直接不进 HTML。 */
export function liveCodes(b: Brand, today: string = todayTW()): Code[] {
  return b.codes.filter((c) => !isExpired(c, today));
}

/** 已过期、被摘掉的码。用来在空态里说明「上一组什么时候失效的」。 */
export function expiredCodes(b: Brand, today: string = todayTW()): Code[] {
  return b.codes.filter((c) => isExpired(c, today));
}
