import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { BRANDS } from './src/data/brands';
import { hasSubstance } from './src/lib/codes';

/**
 * 既没码也没活动的品牌页不进 sitemap。
 *
 * 和页面上的 noindex 用的是同一个判据（lib/codes.ts 的 hasSubstance），必须一致：
 * 把 noindex 的页放进 sitemap，等于一边告诉 Google「这页别收」一边又提交它，
 * Search Console 会报「已提交的网址标记为 noindex」。
 *
 * 判据是算出来的不是写死的清单 —— 某个品牌哪天核到码了，它自动回到 sitemap。
 */
const emptyBrandPaths = new Set(
  BRANDS.filter((b) => !hasSubstance(b)).map((b) => `/store/${b.slug}/`),
);

export default defineConfig({
  site: 'https://promocodeasia.com',
  trailingSlash: 'always',
  integrations: [
    sitemap({
      filter: (page) => !emptyBrandPaths.has(new URL(page).pathname),
    }),
  ],
  build: { format: 'directory' },
});
