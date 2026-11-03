# ✦ 造梦街机 · Dream Arcade

**把脑洞，变成下一局。** 选择星光收集、增量矿场或极速夜航，用 RunningHub 生成完整主题素材，立即进入可以游玩的迷你街机。

**[在线试玩 →](https://ritrls.github.io/dream-arcade-demo/)**

![造梦街机预览](docs/preview.png)

这是一个浏览器端演示项目：**AI 生成场景和玩家、资源、障碍、工具素材；三个游戏模板提供玩法**。不宣称自动生成任意游戏代码或游戏引擎。

随附的 `playable-demo.html` 已嵌入场景图片，可以直接双击离线试玩。

## 可以做什么

- **星光收集**：资源收集、最高五倍连击、主动护盾、每收集 12 个资源自动充能、逐渐增大的难度。
- **增量矿场**：点击或长按开采，升级工具提高伤害，雇佣自动采集，每 5 块矿脉深入下一层。升级、矿层与资源自动保存；这是持续经营模板，不受单局时长限制。
- **极速夜航**：三车道换道，超越障碍，收集氮气，按住加速冲过距离终点。每排障碍保留安全路线。
- 两个内置主题 **月光秘境 / 霓虹边境**，都包含真实 RunningHub 生成的场景和四种游戏素材，无需 Key 直接试玩。
- 自定义主题名、资源名及画风。更换主题会替换玩家 / 赛车、矿石 / 收集物、障碍、工具及场景。
- 键盘、鼠标和触屏操作；30/45/60 秒挑战、暂停、全屏。
- 导出当前模板、内嵌图片与矿场进度为独立 HTML，双击离线游玩。
- 查询真实 RunningHub 任务状态；支持停止等待、刷新后继续完成两阶段主题生成。

## 本地运行

需要 Node.js 22 或更新版本，无第三方依赖。

```sh
npm run dev
```

打开 http://127.0.0.1:4173 。不需要 npm install。

```sh
npm test
npm run build
```

构建结果在 `dist/`，可放在任意静态托管平台。源代码使用相对路径，支持 GitHub Pages 仓库子路径。

## RunningHub 接入

1. 在 [RunningHub](https://www.runninghub.cn/) 获取具有模型 API 权限的企业共享 Key。
2. 点击页面右上角「API 设置」并填写 Key。
3. 描述主题、填写主题名与资源名，选择画风，点击「生成完整主题」。每个完整主题需要 **2 次生图调用**：一张场景、一张包含四种游戏对象的素材图集。调用按照 RunningHub 账户规则计费。
4. 等待两部分完成后切换任意模板开始游戏，或导出离线文件。

使用官方模型接口：

```text
POST https://www.runninghub.ai/openapi/v2/rhart-image-v1/text-to-image
Authorization: Bearer <visitor-provided-key>
Content-Type: application/json

{"prompt":"...","aspectRatio":"16:9"}

素材图集使用同一接口，aspectRatio 为 1:1；按照固定 2×2 格式生成玩家载具、资源、障碍、工具。浏览器移除绿幕底色并按单元格绘制到游戏中。

POST https://www.runninghub.ai/openapi/v2/query
{"taskId":"..."}
```

每 5 秒查询一次，每个任务最长等待 10 分钟。失败、取消、网络错误和超时都会显示提示；两部分任务编号与已完成结果保存在当前标签页 sessionStorage，可使用原 Key 继续查询，不会重新提交已有任务。停止等待或清除本地记录不会取消 RunningHub 上的任务，也不会撤销可能产生的计费。提交请求不自动重试，以避免重复创建付费任务；查询可对临时故障进行有限重试。提交结果不明时，先检查平台调用记录再创建新主题。

Key **只存在当前页面内存中**，不会写入 localStorage、仓库、导出文件或服务端。刷新页面后需要重新填写。请求从浏览器直接发送至 RunningHub 官方国际站接口，依赖其跨域访问支持；本项目不使用第三方公共代理。浏览器联调发现 `.cn` 网关返回重复的跨域响应头，因此使用已验证的官方 `.ai` 网关。请勿把个人 Key 放进公开网页代码。

生成链接有时效，页面会将图片转为内嵌素材；请及时导出。若图片服务暂时限制跨域或链接已过期，会显示下载失败提示。全部预设素材已下载到仓库，不依赖临时结果 URL。生成式图集的对齐和绿幕纯度可能存在差异，固定格子和备用图形帮助保持游戏可用。

模型与协议来源：[官方接口契约](https://github.com/HM-RunningHub/ComfyUI_RH_OpenAPI/blob/main/developer-kit/rh-api-contract.md)、[官方模型参数表](https://github.com/HM-RunningHub/ComfyUI_RH_OpenAPI/blob/main/developer-kit/model-registry.public.json)。模型权限及费用以 RunningHub 当前规则为准。

## GitHub Pages 部署

仓库包含 `.github/workflows/pages.yml`：推送到 `main` 会先运行接口契约测试，再构建并部署。

首次部署时在仓库 **Settings → Pages → Build and deployment → Source** 选择 **GitHub Actions**。不需要把 RunningHub Key 添加到 GitHub Secrets；每位访问者使用自己的 Key。

## 项目结构

```text
index.html / style.css   页面、模板选择与响应式布局
workshop.js              创作、主题、设置和两阶段任务恢复
games.js                 三个 Canvas 游戏模板与可验证的纯规则
standalone.js            离线单文件打包
runninghub.js           RunningHub 提交与轮询
assets/                 内置场景、真实生成记录、品牌图标
tests/                  API 生命周期、挖矿经济、竞速与导出测试
build.mjs               零依赖静态构建
```

## 致谢

受 [PixelRunner](https://github.com/XIAOTsune/PixelRunner) 将 RunningHub 能力接入具体创作工具的思路启发。本项目独立实现，没有复制其代码或品牌素材。

AI 场景能力由 **RunningHub API** 提供。本项目为独立技术演示，并非 RunningHub 官方产品。其名称与商标属于各自权利人。

## 许可证

代码与手绘 SVG 示例采用 MIT 许可证。AI 图片的使用同时遵循 RunningHub 和相应模型的服务条款。
