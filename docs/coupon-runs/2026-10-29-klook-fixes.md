# Klook 优惠纠错与十一月准备：本地候选

日期：2026-10-29。基线：5d7f3372841966a64738c4c8332c9d644602ed3e，fetch 后确认原工作区 HEAD=origin/master。独立副本：/tmp/promocodeasia-fixes-20261029。原工作区历史未跟踪日志与快照保留。未提交、未推送、未部署。

## 范围与官方依据

仅修正 CTBCLP26102 与 KJCB2610 两条数据，更新变更日志与既有十一月计划。没有其他站点、支付、归因或 Travelpayouts 修改；没有付款、点击转化链接或验证剩余配额。

- 中信：https://www.ctbcbank.com/content/dam/minisite/long/creditcard/LINEPay/page_travel.html
- Klook 次数冲突参照：https://www.klook.com/zh-TW/blog/klook-discount-collection/
- JCB 月份表与支付限制：https://www.specialoffers.jcb/zh-tw/services/travel/klook2026/
- KKday 当前十月汇总：https://www.kkday.com/zh-tw/blog/25229/kkday-bank-coupon

中信最高 10% 为含一般消费 1% 的 LINE POINTS 回馈，非结账九折，每笔最高 1,000 点；银行写每帐号每月一次、每月限 100 组，Klook 总览写全年十次，保留冲突提示。购买截止 2026/12/31，使用／出发／入住截止 2027/3/31；完成后才入点，保留指定入口与支付要求。改以银行明确购买期限，不再套十月月版。

JCB 十月码补明确 10/31 期限、国内指定玩乐商品、台湾发行合资格极致／晶致卡、直接刷卡与排除行动／电子／第三方支付、门槛、每月名额和每码每帐号一次。十一月 KJCB2611 仅列计划，不提前进入可复制码。KKday 没有十一月完整条款证据，不猜码或延长期限。

## 验证

- git diff --check：通过。
- npm run build：通过，含 prebuild 券校验 107 条，生成 18 页；保留全站已有过期／久未复核警告，不据此声称所有来源本轮已联网核实。
- /tmp/promocodeasia-fixes-20261029-qa.mjs：22 项通过，覆盖两条优惠数据、生成 HTML 的来源／期限与无十一月可复制码、KKday 原 11 条十月到期记录、实际生成客户端脚本在台湾午夜的日期判定。
- JCB：2026-10-31T15:59:59Z（台北 23:59:59）保留；16:00:00Z（11/1 零点）移除。中信跨十月不误删，12/31 最后一秒保留，2027/1/1 零点移除。
- 未修改日期引擎，复用 liveCodes 和现有客户端过期兜底。静态 HTML 在换月仍依赖正常重建，客户端隐藏不代表静态 HTML 已更新。
- 原 /data/projects/promocodeasia-work 只有先前十个未跟踪项，无已跟踪修改。

构建日志：/tmp/promocodeasia-fixes-20261029-build.log。候选差异：/tmp/promocodeasia-fixes-20261029.patch。不存在执行阻塞；仍需主线程审阅和后续发布决定。
