# 优惠维护：实际取条款，持久化失败状态，核验通过直接发布

本流程由本对话定时任务执行，服务器存队列，不是独立服务器爬虫。不依赖 19222/19223，不开启设备、不改代理、不绕过访问挑战。

## 来源队列

SSH `admin@10.86.32.85`，目录 `/data/projects/promocodeasia-work`。读适用 AGENTS.md；fetch 后确认 origin 为 nirolee/promocodeasia、master、HEAD=origin/master。仅安全落后可快进。无关已跟踪/暂存改动、分叉、未知未推送提交或并行修改即停止发布，不覆盖/stash/reset/rebase/force。

`npm run refresh` 或 `python3 scripts/coupon-sync.py plan` 列出 due/skipped。只读 due，一轮最多 4 个来源，优先已有完整条款的 KKday/Klook，再轮换。新来源必须来自真实官方链接；不要猜 API 或 URL。

## 采集与条款

公开 HTTP 可直接读则用；403 后不刷请求，改用当前内置浏览器。实际加载后，通过 `tab.playwright.evaluate` 执行 `scripts/coupon-snapshot.js` 的只读函数。确认标题/正文已加载再提取；快照是函数实际返回的 JSON，不手写条款摘要、不修改 capturedAt。不读 Cookie/身份/私信/运行时隐藏状态，不反复点领券撞登录。

保存到服务器 `.cache/coupon-sync/incoming/来源ID.json`，导入：

```sh
python3 scripts/coupon-sync.py ingest kkday-aftee --input .cache/coupon-sync/incoming/kkday-aftee.json
```

URL 必须与登记来源一致；拒绝超过六小时、短正文、访问挑战。报告在 reports/、去重证据在 evidence/，均位于被 Git 忽略的状态目录。并发锁不自动抢，异常先查进程。

AFTEE 适配器按券卡明确月份、优惠金额与唯一当前订购/出发区块绑定，提取低消、折扣/封顶、限量、次数、支付和旅行期；不套九月条款，不为矛盾会员日推定期限。通用提取仅为候选。

`terms_complete` 仅是适配器字段完整，**不是已实测/已发布**。仍须实际官方证据确认币种、地区/身份、领取/导购入口、银行/新旧客/商品排除、数量和转载条件；全局细则在别页则实际读。未知不写无限制；总览未出现不删除。银行限定入口原样保留；佣金有明确依据才 yes，不凭联盟 CTA 推断。禁止转个人码或其他读者专属码。

完整审阅后执行 `review 来源ID --reason "核验范围、对应码和证据；非付款实测"` 记 source 审阅并恢复正常周期；部分歧义仍留逐码候选，不声称全站通过。无数据变化不刷 verifiedAt，不为日期造提交。

## 失败冷却和去重

- `defer 来源ID --status fetch_failed --reason "具体失败"`：1/3/7/14 天冷却。
- `defer 来源ID --status needs_terms --reason "缺失字段及查过的入口"`：7/14/30 天冷却。
- `defer 来源ID --status needs_user --reason "用户需做的操作"`：等待会话/授权变化，不自动日常重试。
- `wake 来源ID --reason "新官方线索链接或已解决条件"`：仅真实新证据、会话变化或月初新期需要时唤醒，不每天强制 wake。
- 指纹含条款、券卡、表格、限制句和详情入口，不只比码名；忽略采集时间、普通商品价格。候选按来源+码持久化去重，同内容不重复通知。
- 已知 ALL95/ALL200/ALL600 缺细则、过期 flashday、免费 eSIM iframe、会员日矛盾进入冷却，不当每日必查清单。过期活动不发；URL 新期复用须新证据或到期再读。
- 邮箱从 plan 的 checkpoints.mail_after 起，只读本站相关新通知；成功后 `checkpoint mail_after 实际查询截止ISO时间`。社区发现记录 discovery_after，只处理新帖/新链接，不反复搜相同候选。社区/竞品仅作线索。

## 发布

用户已授权官方核验通过后直接编辑、提交、推送、上线，无需再要许可。每轮最多 20 条数据变更。用 apply_patch 改 brands.ts、必要 changelog.ts 和当天运行报告，保留证据/发现/完整核验/写入/上线/失败数量与范围；纯无变化日志留本地。

1. `git diff --check`、`npm run check`、`npm run build` 全过；查生成 HTML 的真实优惠/条件/来源和过期隐藏，区分过期区和可复制码。
2. 只暂存本轮明确文件，禁止 add -A；审查无凭据/无关改动，保留原有未跟踪日志/快照。
3. 提交前再 fetch，远端前进即停。简洁中文提交无 AI 署名，正常 push origin master；拒绝不自动合并。
4. CF 自动部署后最多约 5 分钟查生产对应页 HTTP 200 与实际条件、码、日期及来源；推送不等于上线。未确认报告 commit/待上线，不重复提交。
5. 有意义新增/修订/失效、部署成功、首次重要阻塞或需用户动作才通知。同一阻塞不每天重复通知，无变化且无行动保持安静，部分来源失败要说明，不能说全站已核验。

## 联盟基线与边界

Trip.com 自营已接入本站 SID333721088，不同于被拒 Admitad Trip.com；Klook/CASETiFY 已接入，银行码仍依其条款。Admitad iHerb/Surfshark/Trip.com 及 Agoda 自营被拒，不重记为待审。Klook 15216/PROMOASIA 无新批准前不发；LinkHaitao/Partnerize 据新通知和后台核实。Travelpayouts 不安装 Drive/自动换链。不自动接受新合同/提交身份税务银行信息/变更权限，不发邮件/Threads，不关机/改代理/购买。
