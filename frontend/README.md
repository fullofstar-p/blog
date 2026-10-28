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
├── styles/      # Tailwind 入口、纸张纹理、手绘组件类、编辑器覆盖、阅读页纸张
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

后台编辑器的「内核」仍是 **Vditor 即时渲染（IR）**，交互与 UI 外壳按 **Typora** 重做：

- **顶部菜单栏**：`段落` / `格式` / `编辑` / `视图` 四个下拉菜单，替代原来一排图标工具栏
  （Vditor 自带工具栏仍在 DOM 里，只是由 CSS 隐藏，菜单命令直接点它的隐藏按钮，
  因此撤销栈、选区、Markdown 语法仍是 Vditor 原生实现）。
  菜单右侧固定「大纲」「源码」「全屏」三个开关。
- **底部状态栏**：显示 `Markdown`、当前模式（即时渲染 / 源码模式）与实时字数；
  字数由 `utils/wordCount.js` 去掉 Markdown 标记后统计，页面右侧不再重复显示。
- **大纲侧栏**：在左侧展开渲染后的标题树，点击精确滚动正文容器到对应标题；
  滚动时按可视区域高亮当前标题，不用 `window.scrollTo` 避免整页跳顶。
- **源码模式**：「源码」按钮或 `Ctrl+/` 在 IR / SV 之间切换，源码模式只显示
  Markdown textarea（`preview.mode: 'editor'`），修改通过 `input` 回调实时同步回
  v-model，切回即时渲染后恢复即时渲染视图。
- **表格工具条**：鼠标移到表格上时，表格左上角浮出一排图标按钮（插入/删除行列、
  删除整张表格），按钮带 `title` / `aria-label` tooltip；表格滚到编辑区顶部时
  工具条落到表格内部，保证始终可点。
- **Typora 快捷键**：`Ctrl+1`~`6` / `Ctrl+0` 设置标题与正文、`Ctrl+B` 加粗、
  `Ctrl+I` 斜体、`Ctrl+K` 链接、`Ctrl+/` 源码模式。
- **行内标记即时渲染**：输入完 `**加粗**`、`` `行内代码` ``、`*斜体*`、`~~删除~~`
  的闭合标记后立刻收起源标记（Vditor 默认会保持 `**` 展开，直到按空格或方向键才收起）；
  选中文字后用「格式」菜单或 `Ctrl+B/I/U` 加粗/斜体/删除线时同样直接显示渲染结果，
  光标移入节点内部时标记会自动重新展开，方便改源码。
- **代码块**：编辑态也直接显示**渲染后的高亮代码**——Vditor 的预览层始终显示并决定代码块尺寸，
  可编辑的源码层绝对定位叠在上面、文字透明（光标与选区正常），所以敲三个反引号创建后
  立刻就是高亮效果，直接在里面输入；展开/收起不再改变高度（marker 的 width/height 过渡也关掉了），
  不会再有跳动。不显示围栏和顶部语言行，语言标识浮在右下角（新建代码块、光标还在语言标记里
  输入时也显示在同一位置，避免和语言按钮叠成两个「js」）；悬停代码块时右上角浮出复制按钮，
  复制提示（`复制`）在按钮右侧；语言按钮点击可从常用语言下拉里选择，选择后直接改写 Markdown
  围栏语言并重新渲染；语言按钮和下拉改成**带图标的列表**：每项是品牌色图标 + 完整语言名
  （JavaScript、TypeScript、Python…），下拉样式与顶部菜单一致（纸张底、细边、浮起阴影）；
  **单击**按钮展开列表、**双击**按钮变成输入框，可手写任意语言标识（回车确认、Esc 取消）。
  代码块内 `Tab` 缩进 4 个空格、`Shift+Tab` 反缩进；中文输入法组词时
  临时显示源码文字（否则透明文字看不到候选词），组词结束回到高亮层。
  另外修了语言栏的 Backspace：Vditor 在语言标记开头按退格会插入空段落（看起来像换行），
  现在只有标记里还有字符时才正常删，删空后继续按 Backspace 不会插空行。
  代码块底色是纯纸张色（`--md-bg-code`），Vditor 自带的那张 20×20 网格底图
  （`.vditor-reset pre > code` 的 `background-image`）已去掉，阅读页同样处理。
- **水平分隔线**：`---` + 回车生成的 hr 在 IR 模式下没有可编辑内容，Vditor 只在 Firefox
  里支持「光标在 hr 后一段开头按 `Backspace`」删除，Chromium 下点不中也删不掉。这里补上：
  单击分隔线选中（蓝色高亮），`Backspace` / `Delete` 删除；光标在 hr 后一段开头按
  `Backspace`、在 hr 前一段末尾按 `Delete` 也能删除。hr 元素加高到 13px（1px 画线居中）
  方便点中，删除后光标落到相邻段落，Markdown 与撤销/重做正常同步。
- **Markdown 快捷输入**（与 Typora 一致）：`#` + 空格渲染标题、`-` / `1.` + 空格渲染列表
  （Vditor 原生要回车才转列表，这里在捕获阶段拦下空格并调用它的列表命令）、
  三个反引号 + 回车渲染代码块、表格源码（表头行 + `---` 分隔行）回车后转成真正的表格
  （转换时拦截 Vditor「表头换行就抢跑」的行为，避免分隔行被塞进单元格），转完光标落在第一格。
  有序列表手写 `2.` + 空格时保留起始序号（同时写 `ol` 的 `start` / `data-marker` 与每个
  `li` 的 `data-marker`，保存成 Markdown 也是 `2.`），被代码块等隔断的列表不会又回到 1，
  回车继续编号 3、4；已经在列表项里时不接管空格，避免把原列表改坏。
- **全屏**：优先用浏览器 Fullscreen API，被拒绝时退回 CSS 全屏（`setCssFullscreen`：此时才由
  `clearAncestors` 临时清掉祖先卡片的 `transform` / `filter`，否则 `position: fixed` 会以带变换的卡片为包含块）；
  退出全屏会清掉 CSS 兜底状态，正文窗口不会塌缩。
- 不显示行号（Typora 即时渲染也没有行号），左侧留白只保留标题标记。
  Vditor 的 lute / 中文语言包 / 图标 / 高亮样式在 `predev`、`prebuild` 时由
  `scripts/copy-vditor.mjs` 拷到 `public/vditor`（已 gitignore），不依赖外网 CDN。

**阅读页**用 `MarkdownViewer`（md-editor-v3 预览）与后台编辑器共用同一套 Typora 排版：

- 正文是一张 **Typora 式纸张页面**（`.typora-page`，样式在 `src/styles/markdown-reading.css`）：
  纸张底 `#faf6ee`、1px `#e4dac8` 实线边框、5px 圆角、最大宽度 860px 居中、
  上下 40px / 左右 48px 内边距；没有站点其它卡片的虚线边框和轻微倾斜。
- 阅读态代码高亮改为**本地 highlight.js + GitHub 浅色主题**：`MarkdownViewer.vue` 里把
  `highlight.js/lib/common` 实例交给 md-editor-v3，不再从 unpkg 运行时拉
  `highlight.min.js` / `atom-one-dark`；`scripts/copy-vditor.mjs` 会把
  `node_modules/highlight.js/styles/github.css` 拷到 `public/highlight/github.css`
  （predev / prebuild 自动执行，已 gitignore）。离线也有高亮，且配色与纸张色代码块（`#efe9db`）一致。
- 阅读态代码块沿用纸张配色（`#efe9db` 浅纸底、无边框无阴影、字号 14px，由
  `markdown.css` 的 `--md-bg-code` 等变量统一提供）；`markdown-reading.css` 只补代码块 chrome：
  语言名固定在代码块右下角，复制按钮默认隐藏、鼠标移入代码块才浮到右上角。
- 正文排版本身（标题 / 表格 / 引用 / 列表 / 代码高亮）仍由 `src/styles/markdown.css`
  统一提供：系统无衬线字体、1.65 行距、粗体标题（h1/h2 带细实线下边框）、
  实线表格边框 + 斑马纹、Typora 蓝链接、灰字左边线引用、GitHub 色系代码高亮；
  阅读页配色也用纸张基调（`--md-bg` #f5f0e8、`--md-bg-code` #efe9db、`--md-border` #ddd6c8）。
- 页面外壳（导航、卡片、按钮）保持 Sketch 手绘风，正文区域是纸张页面。

### 已修复：编辑页「正文模块不见」

`AdminArticleEdit.vue` 之前的 `loading` 初始值是 `false`：编辑已有文章时表单（含
`MarkdownEditor`）先挂载，随后 `loadArticle()` 把 `loading` 置 `true`，表单被 `v-if`
卸载；此时 Vditor 还没初始化完，`destroy()` 抛
`Cannot read properties of undefined (reading 'element')`，组件更新链中断，
文章数据不填充、正文区域只剩空壳。

修复方式：编辑态下 `loading` 初始值直接取 `isEdit`（新建文章仍是 `false`），
数据回来之前不挂载表单，`MarkdownEditor` 因此只会在有内容时创建一次，
不会再出现「初始化中被卸载」。`MarkdownEditor` 内部也补了初始化完成标记与
安全的 `destroyVditor()` 兜底。


## Docker

`Dockerfile` 多阶段构建（node:20-alpine → nginx:1.27-alpine），`nginx.conf` 负责 SPA 回退、
静态资源缓存、`/api` 反向代理到 `http://backend:8080`、`client_max_body_size 10m` 与 gzip。
在仓库根目录执行 `docker compose up -d --build` 即可。
