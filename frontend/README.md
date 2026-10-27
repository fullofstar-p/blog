# 技术分享博客 · 前端

Vue 3 + Vite + Tailwind CSS 实现的手绘素描本（Sketch Style）博客前端，接口契约见
[`../docs/API.md`](../docs/API.md)。

## 技术栈

- Vue 3（`<script setup>` + Composition API）
- Vite 5 / Vue Router 4 / Pinia
- Tailwind CSS 3（自绘手写体主题，不依赖重型 UI 库）
- Axios（统一请求/响应拦截器）
- Vditor（正文即时渲染编辑，支持 wysiwyg / ir / sv 三种模式）+ md-editor-v3（详情页预览）+ highlight.js（代码高亮）
- ESLint + Prettier

## 常用命令

```bash
npm install        # 安装依赖
npm run dev        # 开发服务器，/api 代理到 http://localhost:8080
npm run build      # 生产构建（dist/）
npm run preview    # 预览构建产物
npm run lint       # ESLint（--max-warnings=0）
npm run format     # Prettier 格式化
```

## 目录

```
src/
├── api/         # 按 docs/API.md 封装的接口模块 + Axios 实例
├── components/  # Sketch 通用组件、上传、Markdown、评论、管理布局
├── router/      # 路由与登录/管理员守卫
├── store/       # auth（token 持久化）、meta（分类/标签缓存）
├── styles/      # Tailwind 入口、纸张纹理、手绘组件类、编辑器覆盖
├── utils/       # 格式化、Toast
└── views/       # 前台页面 + admin/ 管理后台
```

## Sketch Style 设计令牌

| 令牌 | 值 | 用途 |
| ---- | -- | ---- |
| `paper` | `#f5f0e8` | 纸张底色（禁止纯白） |
| `paper.deep` | `#efe7d8` | 加深纸色（代码块、侧栏） |
| `pencil` | `#2c2c2c` | 铅笔灰主色 |
| 强调色 | `#b23b2e` / `#2b6e96` / `#1f7a4d` / `#7a5300` | 低饱和红蓝绿黄（已按 AA 对比度加深） |
| `shadow-sketch` | `3px 3px 0 rgba(44,44,44,.15)` | 手绘硬阴影 |

- 边框统一 `border-2 border-dashed`（全局默认 `border-style: dashed`）。
- 标题使用 `font-serif italic`；卡片/元素交替 `rotate-[-0.5deg]` / `rotate-[0.5deg]`。
- 手绘组件类：`sketch-card`、`sketch-btn`、`sketch-input`、`sketch-badge`、`sketch-wavy`、
  `sketch-skeleton`、`sketch-tape`。
- 交互三态：`hover` 铅笔涂黑反白、`active` 压纸（位移 + 阴影减小）、`focus-visible` 虚线描边。
- 所有动画在 `prefers-reduced-motion: reduce` 下降级；可交互元素最小 44px。

## Markdown / 代码高亮

- 后台写文章用 **Vditor**「即时渲染（IR）」模式：在书写位置直接渲染标题、列表、代码块，
  类似 Typora，不再左右分栏；只保留即时渲染，不再提供所见即所得 / 分屏切换。
  工具栏按钮带中文名称（`vditorEnhance.js` 补挂），鼠标悬停显示功能名与快捷键。
  表格支持悬停浮出操作条：插行、删行、插列、删列、整列左/中/右对齐；操作条贴在编辑器
  右侧留白处竖排显示，不压住表格与正文（窄屏退化为表格右上角的小面板）。
  大纲点击会滚动正文容器到对应标题（不再调用 `window.scrollTo` 导致整页跳顶）；
  全屏时临时清除祖先卡片 `rotate` 变换，避免 `position: fixed` 被卡片限制。
  Vditor 的 lute / 中文语言包 / 图标 / 高亮样式在 `predev`、`prebuild` 时由
  `scripts/copy-vditor.mjs` 拷到 `public/vditor`（已 gitignore），不依赖外网 CDN。
- 前台阅读用 `MarkdownViewer`（md-editor-v3 预览），与后台编辑器解耦。
- `src/styles/markdown.css` 通过 CSS 变量与类覆盖把编辑器/预览的底色、工具栏、边框改为纸色，
  并把 highlight.js 的 `.hljs-*` 令牌映射到低饱和手绘四色；代码块底色为 `#efe7d8`，不使用纯白。

## Docker

`Dockerfile` 多阶段构建（node:20-alpine → nginx:1.27-alpine），`nginx.conf` 负责 SPA 回退、
静态资源缓存、`/api` 反向代理到 `http://backend:8080`、`client_max_body_size 10m` 与 gzip。
在仓库根目录执行 `docker compose up -d --build` 即可。
