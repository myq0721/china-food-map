# 中国食物地图

社区共建的中国大陆美食推荐地图。每个人都可以投稿推荐好吃的饭店，数据存储在 GitHub 仓库中，通过 Pull Request 审核后展示。

**在线地址**：[https://myq0721.github.io/china-food-map/](https://myq0721.github.io/china-food-map/)

## 功能

- 首页展示最新推荐饭店（桌面端一行 4 张卡片）
- 按城市、菜系筛选与搜索
- 饭店详情页展示全部推荐者与评价（支持 GitHub / Twitter / B站 主页链接）及 1-5 星综合推荐指数
- 投稿入口：GitHub/Twitter 完整表单；B 站仅视频链接 + 自动解析 → 待审核区 → promote 后上线
- 博主探店半自动导入（B 站 API + 可选 OpenAI）
- 留言板与饭店详情评论区（Giscus + GitHub Discussions）

## 构建与推送

### 本地开发

```bash
git clone https://github.com/myq0721/china-food-map.git
cd china-food-map
npm install
cp .env.example .env.local   # 按需填写 OAuth / Turnstile / Giscus
npm run dev                  # http://localhost:5173/china-food-map/
```

### 本地构建验证

```bash
npm run build                # 生成 public/data/index.json + dist/
npm run preview              # 预览生产构建
```

### 推送到 GitHub

```bash
git add .
git commit -m "feat: your message"
git push origin master
```

推送后 GitHub Actions 会自动：

1. **Build and Deploy** — 构建并部署到 GitHub Pages
2. **Validate PR** — 校验投稿 PR 的 JSON 与 Turnstile
3. **Sync Creators** — 可手动触发，同步博主探店草稿

### 一次性仓库配置

1. **Settings → Pages → Source**：GitHub Actions
2. **Settings → Secrets and variables → Actions**：
   - Secret: `TURNSTILE_SECRET`, `OPENAI_API_KEY`（AI 打分与 B 站解析增强）
   - Variables: `VITE_GITHUB_CLIENT_ID`, `VITE_TURNSTILE_SITE_KEY`, `VITE_GISCUS_REPO_ID`, `VITE_GISCUS_CATEGORY_ID`
3. **Settings → General → Discussions**：启用，创建 `Guestbook` 分类
4. **OAuth App**（Device Flow）：Client ID 写入 `VITE_GITHUB_CLIENT_ID`

站点地址：https://myq0721.github.io/china-food-map/

## 数据格式

- 正式数据：`data/restaurants/*.json`
- 待审核：`data/pending/*.json`（不会出现在线上）
- 博主草稿：`data/imports/drafts.json`
- 博主配置：`data/meta/curated-creators.json`

推荐者 `platform` 支持：`github` | `twitter` | `bilibili`  
每条推荐含 `rating`（1-5 整数）与可选 `ratingSummary`。  
Twitter 主页自动生成：`https://x.com/{用户名}`

## 投稿流程

1. **GitHub / Twitter**：填写饭店信息 + 综合推荐指数（1-5 星）
2. **B 站**：粘贴探店视频链接，点击解析后提交
3. GitHub 登录 + Turnstile 人机验证
4. 自动创建 PR，写入 `data/pending/{uuid}.json`
5. **Enrich Pending** Action 自动补全星级与字段（可选 `USE_WHISPER=1` 启用音轨转写）
6. 维护者合并 PR 后，运行 **Promote Pending** Action（或本地 `node scripts/promote-pending.mjs --all`）
7. 数据合并进 `data/restaurants/` 并上线

## 博主探店导入

1. 在 `data/meta/curated-creators.json` 配置 B 站 UP 主（默认：特厨隋卞 `3546888255048212`）
2. **批量 AI 导入**（直接写入 `data/restaurants/`）：
   ```bash
   OPENAI_API_KEY=sk-... node scripts/import-bilibili-ai.mjs
   OPENAI_API_KEY=sk-... IMPORT_LIMIT=3 node scripts/import-bilibili-ai.mjs --dry-run
   ```
   或在 Actions 中手动触发 **Import Bilibili AI** workflow。
3. **草稿审阅流程**：运行 `node scripts/fetch-creator-videos.mjs` → 维护者访问 `/import` 审阅 → 批量提交待审核

## 维护者命令

```bash
# 将待审核投稿 AI 补全星级与字段
node scripts/enrich-submission.mjs
node scripts/enrich-submission.mjs <pending-uuid>

# B 站 UP 主批量 AI 导入（直接入库）
OPENAI_API_KEY=sk-... node scripts/import-bilibili-ai.mjs

# 同步博主视频草稿
node scripts/fetch-creator-videos.mjs

# 将待审核投稿合并入库
node scripts/promote-pending.mjs <pending-uuid>
node scripts/promote-pending.mjs --all

# 重建索引
node scripts/build-index.mjs
```

## 项目结构

```
data/
  restaurants/     # 已上线饭店数据
  pending/         # 待审核投稿
  imports/         # 博主探店草稿
  meta/            # 热门城市、菜系、博主配置
  schema/          # JSON Schema
public/data/       # 构建产物（自动生成）
scripts/           # 构建、校验、同步、promote
src/               # Vue 3 前端
.github/workflows/ # CI/CD
```

## 许可证

Apache License 2.0
