# ✦ 造梦街机 · 自然语言单位工坊

**赞助支持 · SPONSOR — RunningHub API**

[![RunningHub API — Access 400+ leading AI models via API. Test the API for Free.](assets/sponsors/runninghub-api-banner.png)](https://www.runninghub.ai/call-api?source=github)

本项目由 **RunningHub** 提供支持。单一接口直连 400+ 主流大模型，支持 LLM、多模态、工作流 API 与 AI 应用。

**[免费测试 RunningHub API →](https://www.runninghub.ai/call-api?source=github)** · 折扣获取与免费测试联系：[zhenyuedong@haima.me](mailto:zhenyuedong@haima.me)

**脑洞成兵，马上开战。** 用一句话创造队员，生成专属素材、属性和技能，再带进三种经典玩法。

**[在线试玩 →](https://ritrls.github.io/dream-arcade-demo/)**

[![检查与部署](https://github.com/Ritrls/dream-arcade-demo/actions/workflows/pages.yml/badge.svg)](https://github.com/Ritrls/dream-arcade-demo/actions/workflows/pages.yml)

[更新记录](CHANGELOG.md) · [参与改进](CONTRIBUTING.md) · [反馈问题](https://github.com/Ritrls/dream-arcade-demo/issues/new?template=bug-report.yml)

![项目预览](docs/preview.png)

第一次来？打开试玩链接，载入“免费体验 AI 成品”，选一个模板就能开玩。自由生成专属单位时，再连接你自己的 RunningHub。

## 三种可以真正玩的模板

- **庭院守卫**：五路六列布阵，抵御五波来客。下一次来客的路线和倒计时会提前提示，空地预览显示所选单位的射程；远程输出、前排护盾和减速可以配合。每次击杀回收能量。
- **口袋战场**：150 秒的口袋 RTS。点击单位卡派兵，点击地图移动或集结；小队保持间距，驻守据点增加能量收入，组织小队攻破敌方核心。点一名队员可以单独调动并查看射程，单兵命令不会改变后续增援的集结点；“全军集结”切回整队指挥。
- **增量矿场**：点击或长按矿石开采，雇佣单位自动生产，升级工具和推进矿层。每十块矿脉有一次四倍收益。离线采集最多结算两小时。

月光秘境和霓虹边境两套预设包含真实 RunningHub 生成的单位美术。无需注册或 API Key 就能试玩，支持电脑、手机和键盘操作。

创作区的“免费体验 AI 成品”可以直接载入实际生成过的疾火灵狐，连同素材、生命、攻击、速度和爆发技能一起上场；它是固定示例，不会假装再次调用模型。

## 自然语言造单位

例如：**“一只跑得快但很脆的喷火小狐狸，连续三次攻击能爆发。”**

1. 在网页连接自己的 RunningHub API Key。
2. 输入描述，点击“AI 造个单位”。
3. RunningHub 文本模型设计名称、生命、攻击、射程、攻击间隔、移动速度和技能；图片模型绘制专属单位素材。
4. 单位经过边界检查和费用平衡后加入阵容，可以在当前局使用。

**属性参与真实模拟**：生命决定耐久，攻击和间隔决定输出，射程影响开火距离，速度影响 RTS 行军，技能改变减速、爆发或减伤效果。矿场将单位攻击力 ÷ 攻击间隔转为生产效率，雇佣费用按效率平衡。

目前技能库为**稳定攻击、冰霜减速、三击爆发、护盾减伤**。游戏规则和技能由固定模板提供，AI 不生成任意可执行代码。

“免费试配”根据关键词调整预设单位的属性，使用预设美术，页面会明确标注为规则试配；它不调用模型，也不冒充 AI 生图。

自建单位保存在本机浏览器，最多八名同时上阵。在“队员档案”中可以收起或重新上阵；收起仍保留原画与属性，不会挤掉之前生成的队员，也不会影响已雇佣的矿工。满员时会在付费提交前提示腾出阵容位置。

矿场班表支持休息和免费复工，最多同时安排十二类队员采集；休息保留已雇佣数量，暂停该班组的在线及离线产出。不同采集属性的班组分别计数，换主题或更新单位时仍按各班组实际雇佣的数值产出。

分享链接携带玩法和世界选择，自建阵容可通过“导出离线游戏”打包给朋友。离线文件内嵌当前单位、矿工素材、游戏和矿场进度，也能安排换班，不含 Key。

## 本地运行与检查

Node.js 22 或更新版本，零第三方运行依赖。

```sh
npm run dev
```

打开 http://127.0.0.1:4173 。不需要 npm install。

```sh
npm test
npm run build
```

构建结果在 dist/。源码使用相对路径，支持 GitHub Pages 仓库子路径。

检查覆盖属性边界与费用、技能效果、真实伤害、占点、生成矿工产量、低帧率一致性、离线结算、接口生命周期、生成恢复及离线导出。

## RunningHub 接入

### 赞助商介绍

以下为 RunningHub 提供的官方宣传资料；模型、价格及免费测试条件以平台当前说明为准。

[![RunningHub API 官方介绍：模型接入、按需付费、在线工具及免费测试联系方式](assets/sponsors/runninghub-api-details.png)](https://www.runninghub.ai/call-api?source=github)

Access **400+ leading AI models** via API — Seedance, Kling, MiniMax, Nano Banana, Veo, and more — at highly competitive prices.

High-Concurrency Support · Free API Testing · End-to-End Encryption

**[Test the API for Free →](https://www.runninghub.ai/call-api?source=github)** · [联系 RunningHub 获取折扣与测试](mailto:zhenyuedong@haima.me)

### 本项目如何使用 API

使用官方国际站网关 `https://www.runninghub.ai/openapi/v2`：

- 文本任务：`POST /rhart-text-qwen-27b/chat`，请求字段 `prompt`。
- 单位图片：`POST /rhart-image-v1/text-to-image`，请求字段 `prompt` 和 `aspectRatio: "1:1"`。
- 状态查询：`POST /query`，请求字段 `taskId`。
- 认证：`Authorization: Bearer <visitor-provided-key>`。

完整单位通常需要一次文本设计和一次生图，按平台账户规则计费。模型 API 需要具有相应权限的企业共享 Key。Key 只在当前页面内存中，刷新即清除，不进入仓库、浏览器长期存储或导出文件。

每五秒查询状态，每阶段最多等待十分钟。已取得的任务编号保存在当前标签页，可以继续制造。停止等待不会取消平台任务或撤销费用。提交响应丢失时不会自动再次创建付费任务，请先查看平台调用记录。

等待界面显示本阶段耗时与最近一次平台响应，区分排队、模型处理、查询响应较慢和下载素材；超过九十秒会解释当前等待状态。计时器在本地刷新，不会额外调用生成接口。平台不提供完成百分比，因此页面不会展示虚构进度。

响应丢失后可在页面填入平台记录中的当前阶段任务编号，找回任务继续查询。素材链接下载失败后，继续制造会从同一个图片任务重新获取链接；不会重新提交已创建的设计或生图任务。浏览器无法保存任务进度时，会在付费提交前拦截并提示。

预设美术已下载并处理成约 192px 的透明像素素材。游戏加载不依赖临时生成链接；自建单位完成后同样保存内嵌图片。生成模型偶尔可能未遵循独立角色或纯色背景要求，页面提供备用图形，建议按模板内示例描述单个完整单位。

官方来源：[接口契约](https://github.com/HM-RunningHub/ComfyUI_RH_OpenAPI/blob/main/developer-kit/rh-api-contract.md)、[模型参数表](https://github.com/HM-RunningHub/ComfyUI_RH_OpenAPI/blob/main/developer-kit/model-registry.public.json)。生成记录保存在 assets/provenance.json。

## 部署

GitHub Actions 会在推送 main 后运行检查、构建并发布 Pages。首次在 Settings → Pages 选择 GitHub Actions。不需要把 RunningHub Key 配置为仓库 Secret。

## 源码

```text
lab.js              页面、阵容、自然语言制造与本地保存
battle.js           线路防守、RTS、矿场的统一模拟与绘制
unit-model.js       单位参数、技能枚举与费用平衡
unit-generator.js   文本设计 → 生图，两阶段可恢复任务
unit-store.js       本地单位库
unit-library.js     八位上阵、可恢复收起与旧档案迁移
mining-rules.js     采矿经济、雇佣产量与离线收益
portable.js         单文件离线游戏打包
runninghub.js       官方 API 提交、查询与错误处理
```

## 致谢与许可

受 [PixelRunner](https://github.com/XIAOTsune/PixelRunner) 将 RunningHub 接入具体创作工具的思路启发，独立实现代码和品牌。线路塔防借鉴经典玩法，单位美术为原创生成。

AI 能力由 RunningHub API 提供。本项目为独立演示，并非平台官方产品。代码采用 MIT；生成图片同时遵循平台与模型服务条款。
