# 📰 dsh-ai-news

**DSH 的 AI 新闻与热点面板**：五个板块（大语言模型 / Agent / AI 内容创作趋势 / AI 圈热点 / 漫剧），用 DeepSeek 联网搜索抓取，点击展开 AI 摘要，所有联网搜索只在**手动点刷新**时才触发。

一个为 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (DSH) 打造的 Cordis 双面插件：Node 半负责 AI 搜索、缓存与 API 路由，浏览器半（纯 DOM，零 React 依赖）负责侧边栏入口与新闻面板。

---

## ✨ 功能特性

- **5 个板块**：大语言模型、Agent、AI 内容创作趋势、AI 圈热点、漫剧（红果/抖音/快手上的 AI 短剧）
- **时间范围选择**：今天 / 最近一周 / 最近一个月，选好再刷新，结果按所选时间窗展示
- **每次刷新换一批搜索词**：每个板块有 10 个搜索词池，每次刷新随机抽 4 个跑——连续刷新会看到不同内容，且每次刷新成本不变
- **点击展开 AI 摘要**：每条热点点开生成一段 AI 总结（首次生成后永久缓存，重复展开不再消耗）；漫剧条目额外给出「🔥 爆款原因」与「💡 值得借鉴」
- **手动刷新才消耗 token**：面板平时只读本地缓存，只有点「刷新」才执行联网搜索（DeepSeek 搜索 = 一次模型调用）
- **异步刷新**：点刷新立即响应，搜索在后台跑，完成后前端自动更新（无需手动刷网页）
- **5 个板块 × 15 条**：每板块默认展示 15 条（「今天」档可能不满，因当日内容有限）

---

## 📦 安装

### 前置条件

- DSH（`dsh web`）已安装并配置好 **DeepSeek 模型 / API Key**（`DEEPSEEK_API_KEY` 在 `~/.dsh/.credentials.yaml` 或环境变量中）
- Node.js 22+

### 安装到 web profile

```bash
# 从 npm 直接安装（推荐）
dsh plugin --profile web add dsh-ai-news

# 或从源码仓库安装
git clone https://github.com/li0823xy/dsh-ai-news.git
cd dsh-ai-news
dsh plugin --profile web add link:$(pwd)
```

Windows PowerShell 里 `link:` 用当前目录：

```powershell
dsh plugin --profile web add link:%CD%
```

或者手动方式：把整个目录复制进 profile 的 `node_modules`，并在 profile 的 `cordis.patch.yml` 增加：

```yaml
- insert:
    - id: ai-news
      name: 'dsh-ai-news'
```

安装后**重启 `dsh web`**，侧边栏出现「AI 新闻」入口；若入口未出现，请在浏览器 **Ctrl+Shift+R 硬刷新**一次。

### 卸载

```bash
dsh plugin --profile web remove dsh-ai-news
```

---

## 🚀 使用说明

1. 点击侧边栏「AI 新闻」打开面板
2. 右上角选择时间范围：**今天 / 最近一周 / 最近一个月**（默认最近一个月）
3. 点击「🔄 刷新」——搜索在后台进行（约 25~40 秒），期间可继续浏览旧数据，完成后自动更新
4. 点击任意一条展开 **AI 摘要**（首次约 2~5 秒生成，之后秒开）；漫剧条目额外显示「爆款原因」「值得借鉴」
5. 每条都带**原文链接**，点击可跳转查看原文

> 💡 不点刷新，面板永远显示上次刷新的结果，**零 token 消耗**。

---

## 💰 成本说明

- 搜索走 DeepSeek 的联网搜索能力（`deepseek-v4-flash` 模型），**每次刷新 ≈ 20 次搜索调用**（5 板块 × 随机 4 词）
- 展开摘要 = 1 次模型调用，**生成后永久缓存**，同一内容重复展开不花钱
- 不点刷新、不展开 → 零消耗

---

## 🔧 数据与缓存

- 搜索：`ctx.web`（DSH 内置的 DeepSeek 搜索能力）
- 缓存目录：`~/.dsh/plugins/dsh-ai-news/`
  - `news.json` —— 最近一次刷新的板块数据
  - `summaries.json` —— 已生成的 AI 摘要缓存
- 所有数据来自 DeepSeek 搜索返回的公开网页，本机不额外存储你的任何隐私

---

## ⚠️ 已知限制（请先阅读）

1. **时间范围是"尽力而为"**：搜索词会带上具体日期（如「今天 2026年8月22日」），后端也会剔除**能验证发布时间且超范围**的结果；但搜索引擎返回的条目**大部分不带时间戳**，这些无法验证是否真的属于所选时间窗——所以「今天」档可能混入前几天内容，无法 100% 保证精确。
2. **相关性由搜索引擎定义**：排序是 DeepSeek 搜索引擎的黑盒逻辑，插件只负责"搜什么词、取几条、去重"，不控制相关性排序。
3. **漫剧板块是"打折版"**：搜到的是公开报道与榜单文章，**不是**红果/抖音/快手的官方实时排行榜（平台榜单为动态数据，无法抓取）。
4. **「今天」档条数可能不满 15 条**：当日内容有限，显示多少算多少。

---

## 🗂️ 项目结构

```
dsh-ai-news/
├── lib/
│   ├── index.js      # Node 半：AI 搜索、时间过滤、缓存、/api 路由、摘要生成
│   └── client.js     # 浏览器半：侧边栏入口 + 新闻面板（纯 DOM，零依赖）
├── package.json      # 插件清单（dsh.bundle / dsh.client 声明）
├── cordis.patch.yml  # profile 挂载补丁
├── README.md
├── LICENSE           # MIT
└── .gitignore
```

---

## 🔌 API

| 端点 | 方法 | 说明 |
|---|---|---|
| `/api/ai-news` | GET | 读取最近一次刷新结果 + 摘要缓存 |
| `/api/ai-news/refresh` | POST | 触发后台搜索（body: `{ "window": "day" \| "week" \| "month" }`），立即返回 |
| `/api/ai-news/summary` | POST | 为指定条目生成 AI 摘要（body: `{ url, title, snippet, manju }`），结果缓存 |

所有端点仅限本机回环（loopback）访问。

---

## 🛠️ 开发

- **无构建**：核心代码为手写 ESM + 纯 DOM，不需要 tsc / tsdown
- 修改 `lib/index.js` / `lib/client.js` 后重启 `dsh web` 生效（浏览器需硬刷新一次）
- 插件依赖 DSH 的 `web` 服务（`ctx.web.search`），搜索 provider 由 DSH 内置的 `dsh-web-search-deepseek` 提供

---

## 📄 许可证

[MIT](LICENSE)
