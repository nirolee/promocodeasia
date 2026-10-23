# Travelpayouts Drive 安装与验收

## 用户授权与范围

2026-10-23 用户明确表示“能用的话 安装也ok把”，覆盖先前不安装 Drive 的约束。仅为 PromoCodeAsia 项目 585872 安装后台提供的官方脚本，不注册新账号、不接受新合同、不填收款资料。

后台安装引导明确关联 https://promocodeasia.com，官方脚本为 https://tpembars.com/NTg1ODcy.js?t=585872。放入共用布局的 head 中，并补充第三方服务说明。

## 配置目标与验收

官方说明安装后功能默认开启，设置页需安装后才可访问。因此源码部署成功不等于完成配置。

1. 构建及部署后通过后台 Check Drive connection 验证。
2. 立即在 Advanced settings 关闭自动换链、关键词链接、推荐块、smart previews 和 Targeted offers，优先保护既有银行入口和读者体验。无法关闭则撤回脚本，不能宣称保护完成。
3. 核实 My Programs 的本站项目实际 Available 品牌，再读取券站流量规则与工具。欢迎邮件、通用品牌目录与费率营销邮件均不算本站批准证据。
4. 不拼造推广链接，不用 Travelpayouts 的费率描述现有 Admitad 链接，不把银行优惠改作可返佣。
5. 核对生产页面、脚本加载、链接和手机页面。后台配置结果保存在本轮本地证据；此操作流程文档本身不代表各验收项已经通过。

本次安装不改变优惠码、核验日期、领取与银行指定入口。

## 实际后台结果

- 2026-10-23 已通过 Check Drive connection，安装引导自动跳入 Dashboard，Drive 设置显示本站域名与 Active。
- 已关闭 Switch Links to Travelpayouts（含 affiliate networks 选项）、Display Smart Previews、Show Targeted Offers，页面分别显示 Off／turned off；Link Relevant Keywords 与 Insert Recommendations 对本站显示 Unavailable，不视作已启用，也不宣称手动关闭了这两项。
- My Programs 的本站项目显示 Available 25；Unlock more 20 不等于全部待审或获批，不提交新解锁申请。
- Available 包括 Klook、Yesim、Kiwitaxi、Localrent.com、Welcome Pickups、Tiqets、Kiwi.com、GigSky、Airalo、GetTransfer.com、Drimsim、GetRentacar.com、AirHelp、Go City、Economybookings.com、BikesBooking.com、QEEQ、WeGoTrip、AutoEurope (EU,UK)、Radical Storage、Aviasales、intui.travel、Compensair、Saily、KKday。此名单不是新增 25 组优惠或 25 个已经接站的品牌。

## KKday 手动接入

实际读取本站项目下 KKday 633 的详情与展开条款：目标地区 Worldwide、含繁体中文，Coupons or promo codes 为允许（Any channels）。品类佣金为 1%–5%，SIM/Wi-Fi 为 5%；实际需确认交易完成及平台归因，不保证每单返佣，更不据此把现有银行码的 unknown 改成 yes。

通过官方链接工具、本站项目及 Sub ID `promocodeasia_kkday` 生成 `https://kkday.tpx.gr/CnAlm6r5`，目标为 `https://www.kkday.com/zh-tw`。浏览器测试确认落至该目标，带平台生成的追踪参数；落地中的底层 network 名不代表本站此前被拒的 Involve Asia 申请已批准。仅一般预订入口使用该链接，银行／支付优惠仍从各码原官方 source 进入。

本次新增 1 个品牌的一般预订返佣入口，新增优惠码 0、修改优惠条件 0。KKday 10.10 活动新闻未提供本轮可完整核验的全部期限与限额，因此未新增新闻中的码。

Klook 在此项目也开放，且后台显示十月部分体验品类 12%、酒店至年底 8%的活动费率；已生成首页与 eSIM 链接作为备用，但本轮不替换本站既有 Admitad 链接，不把新费率套给旧链接，也不变更任何银行支付码的返佣标记。其余品牌仍须具体核验，不为放链接创建无实质优惠的空品牌页。

后台截图与完整可用名单保存在本轮本地 `D:/meixin/travelpayouts-install-20261023/evidence/`；最终生产生效状态以对应提交的 Cloudflare 部署和实际页面为准。

## 官方参考

- [Drive 功能与设置](https://support.travelpayouts.com/hc/en-us/articles/32083238510482-Drive-functionalities-and-settings)
- [Drive 常见问题](https://support.travelpayouts.com/hc/en-us/articles/32097258847378-FAQ-about-Drive)
- [项目与可用品牌](https://support.travelpayouts.com/hc/en-us/articles/360021216060-How-to-start-working-with-affiliate-programs)
