# 技术分享博客 · Sketch Style

前后端分离的技术分享博客：**Vue 3 + Tailwind CSS 手绘素描本风格**前端，**Spring Boot 3 + MyBatis-Plus** 后端，MySQL 8 存储、Redis 缓存与计数、MinIO（S3 兼容）对象存储，Docker Compose 一键部署。

## 技术栈

| 层 | 技术 |
| ---- | ---- |
| 前端 | Vue 3（Composition API + `<script setup>`）、Vite 5、Vue Router 4、Pinia、Tailwind CSS 3、Axios、Vditor（即时渲染 Markdown 编辑）、md-editor-v3（正文预览）、highlight.js、jsPDF + html2canvas（浏览器端导出 PDF）、ESLint + Prettier |
| 后端 | Spring Boot 3.3、JDK 17、Spring Security + JWT、MyBatis-Plus、Jakarta Validation、Knife4j（OpenAPI 3） |
| 数据 | MySQL 8.0、Redis 7 |
| 存储 | MinIO，使用 **AWS SDK for Java v2（S3Client）**，不依赖 MinIO 专属 SDK，便于迁移 OSS |
| 部署 | Docker Compose：mysql / redis / minio / backend / frontend(Nginx) |

## 目录结构

```
.
├── .env.example              # 环境变量模板（复制为 .env）
├── .gitignore
├── docker-compose.yml        # 五服务编排 + 数据卷 + healthcheck（完整栈）
├── docker-compose.infra.yml  # 仅基础设施：MySQL/Redis/对象存储，免 .env 直接跑
├── README.md
├── docs/
│   ├── API.md                # 前后端接口契约（唯一真源）
│   ├── LOCAL_DEV.md          # 本地开发/联调与冒烟说明
│   └── ROADMAP.md            # 后续功能清单、迭代排期与里程碑
├── sql/
│   └── init.sql              # MySQL 8 建表 SQL（首次启动自动执行）
├── backend/                  # Spring Boot 3 后端
│   ├── Dockerfile            # 多阶段：maven build → jre run
│   ├── pom.xml
│   └── src/main/
│       ├── java/com/blog/
│       │   ├── common/       # Result / PageResult / 异常 / 全局处理
│       │   ├── config/       # MyBatis-Plus / Redis / Security / S3 / MinIO 初始化 / Knife4j
│       │   ├── security/     # JWT 工具、过滤器、UserDetails、SecurityUtils
│       │   ├── entity/       # 7 张表实体
│       │   ├── mapper/       # Mapper 接口（复杂 SQL 用 XML）
│       │   ├── dto/ vo/      # 入参 / 出参
│       │   ├── service/      # 业务接口与实现
│       │   ├── storage/      # FileStorageService + MinioFileStorageService
│       │   ├── search/       # SearchService + MysqlSearchService（ES 扩展点）
│       │   ├── task/         # 阅读量定时落库
│       │   ├── init/         # 管理员账号初始化
│       │   └── controller/   # REST 接口
│       └── resources/
│           ├── application.yml
│           └── mapper/       # MyBatis XML
└── frontend/                 # Vue 3 前端
    ├── Dockerfile            # node build → nginx 托管
    ├── nginx.conf            # SPA fallback + /api 反向代理
    ├── package.json / vite.config.js / tailwind.config.js / postcss.config.js
    ├── .eslintrc.cjs / .prettierrc / index.html
    └── src/
        ├── api/              # Axios 实例与各模块 API
        ├── assets/           # 纸张纹理等静态资源
        ├── components/       # Sketch 通用组件 + 业务组件
        ├── router/ store/    # 路由与 Pinia
        ├── styles/           # Tailwind 入口、纸张纹理、手绘动效、编辑器覆盖
        ├── utils/            # 时间格式化等
        └── views/            # 前台页面 + admin 管理页
```

## 快速开始（容器编排）

```bash
cp .env.example .env       # 修改密码、JWT_SECRET 等
docker compose up -d --build        # Docker
# 或 Rocky Linux / Podman：
# podman-compose up -d --build
```

> **对象存储镜像提示**：MinIO 社区版已停止发布镜像，2026-09 起 Docker Hub 上的 `minio/minio` 已下架。
> 部署前把 `MINIO_IMAGE` 指向自备的镜像仓库（或改用 RustFS 等 S3 兼容实现），
> 本地只想起依赖服务时用 [`docker-compose.infra.yml`](docker-compose.infra.yml) 即可，后端不需要改代码。

启动后：

| 服务 | 地址 |
| ---- | ---- |
| 站点 | http://localhost |
| 后端 API | http://localhost:8080/api |
| Knife4j 文档 | http://localhost:8080/doc.html |
| MinIO 控制台 | http://localhost:9001 |
| 健康检查 | http://localhost:8080/actuator/health |

默认管理员（首次启动由后端自动创建，**生产环境务必在 `.env` 中改掉**）：

- 用户名：`admin`
- 密码：`admin123456`

对应环境变量：`ADMIN_USERNAME`、`ADMIN_PASSWORD`。

初始化顺序：MySQL 首次启动执行 `sql/init.sql`（建库建表 + 演示分类/标签）→ 后端启动时自动创建管理员、创建 MinIO bucket 并设置公共读 → 前端 Nginx 托管静态资源并代理 `/api`。

## 环境变量

完整清单见 `.env.example`，关键项：

| 变量 | 说明 |
| ---- | ---- |
| `MYSQL_ROOT_PASSWORD` | MySQL root 密码（必填） |
| `MYSQL_DATABASE` | 数据库名，默认 `blog`；`sql/init.sql` 中库名固定为 `blog`，如需改名请同步修改该 SQL 与后端 `MYSQL_DATABASE` |
| `JWT_SECRET` | JWT 签名密钥，HS256，生产环境务必使用随机长字符串（≥ 64 字符） |
| `JWT_ACCESS_EXPIRE` / `JWT_REFRESH_EXPIRE` | access / refresh token 有效期（秒） |
| `MINIO_ROOT_USER` / `MINIO_ROOT_PASSWORD` | MinIO 凭据，同时供后端 access-key / secret-key 使用 |
| `MINIO_BUCKET` | bucket 名称，默认 `blog` |
| `MINIO_PUBLIC_ENDPOINT` | 浏览器可访问的 MinIO 地址，用于拼接图片 URL，如 `http://localhost:9000` |
| `BACKEND_PORT` / `FRONTEND_PORT` | 宿主机映射端口 |

## MinIO 初始化与公共读策略

采用**后端启动时自动初始化**（推荐：少一个容器、少一处凭据配置）：

1. `MinioInitializer`（`ApplicationRunner`）启动时调用 `HeadBucket` 检查 bucket；
2. 不存在则 `CreateBucket`；
3. 随后 `PutBucketPolicy` 设置公共读策略：

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": { "AWS": ["*"] },
      "Action": ["s3:GetObject"],
      "Resource": ["arn:aws:s3:::blog/*"]
    }
  ]
}
```

4. 初始化失败只记录告警、不阻断启动（便于本地无 MinIO 时调试其它模块）。

图片访问使用「公共读 + 随机 objectKey」：objectKey 形如 `cover-3f6c1d2e-....png`，扁平、随机、不可遍历；删除接口仍由后端做归属校验。生产环境建议进一步前置 CDN 或 Nginx 缓存。

如果希望用 `mc` 容器初始化，可把下面的服务加入 `docker-compose.yml` 并去掉后端初始化逻辑（两种方式二选一）：

```yaml
  minio-init:
    image: minio/mc:latest
    depends_on:
      minio:
        condition: service_healthy
    entrypoint: >
      /bin/sh -c "
      mc alias set local http://minio:9000 $MINIO_ROOT_USER $MINIO_ROOT_PASSWORD &&
      mc mb -p local/blog &&
      mc anonymous set download local/blog
      "
    networks: [blog-net]
```

## 本地开发

本地依赖、启动脚本与联调结论见 [docs/LOCAL_DEV.md](docs/LOCAL_DEV.md)。最短路径：

```bash
# 方式一：先起基础设施（推荐，默认值开箱即用，无需 .env）
#   Rocky Linux 9 + Podman：
podman-compose -f docker-compose.infra.yml up -d
#   或 Docker：
docker compose -f docker-compose.infra.yml up -d

# 方式二：本机已有 MySQL/Redis/对象存储，按下表环境变量启动后端
cd backend
mvn spring-boot:run

# 前端
cd frontend
npm install
npm run dev        # http://localhost:5173，/api 代理到 http://localhost:8080
npm run lint
npm run build
```

冒烟与演示数据（需后端已启动）：

```bash
node scripts/seed-demo.mjs   # 3 篇演示文章 + 评论/点赞 + 1 篇草稿
node scripts/smoke-api.mjs   # 认证/文章/搜索/评论/上传/管理端 40 项断言
```

## 设计说明

### 后端要点

- **统一返回体** `{ code, message, data }`，业务异常与参数校验由 `@RestControllerAdvice` 统一转换；分页统一 `PageResult`。
- **JWT 双 Token**：access token（短有效期）用于业务请求，refresh token（长有效期）存 Redis 白名单；登出时 access token 的 `jti` 进入 Redis 黑名单，refresh token 从白名单删除。
- **阅读量**：文章详情读取时在 Redis 自增，定时任务每 60 秒批量落库，避免高并发写爆 MySQL；文章详情缓存 10 分钟，写操作时主动失效。
- **分页性能**：列表/搜索的 COUNT 单独走 `selectSummaryCount` / `selectSearchCount`，标签改为按当前页 `articleId` 批量查询（`ArticleTagAssembler`），不再在列表 SQL 里用相关子查询聚合标签。这样分页插件不会把复杂 SQL 包成 `SELECT COUNT(*) FROM (整段查询)` 全量执行——这是之前文章分页约 5s 的根因。3 万篇文章实测首页约 0.3s。
- **对象存储**：`FileStorageService` 接口 + `MinioFileStorageService` 实现，底层 `S3Client`，配置 `endpoint/access-key/secret-key/bucket/public-endpoint`；上传限制 jpg/jpeg/png/webp/gif，最大 5 MB。
- **搜索抽象**：`SearchService` 接口，当前 `MysqlSearchService` 用 LIKE + 相关度权重（标题 5 / 摘要 3 / 标签 2 / 正文 1），预留 Elasticsearch 实现位；表上已建 ngram 全文索引，可平滑升级。
- **评论**：两级树，待审核/通过/拒绝状态，管理端审核；点赞用 Redis Set 去重，支持取消点赞（`DELETE` 幂等），`CommentVO.liked` 返回当前用户的点赞状态。
- **回收站**：文章删除改为逻辑删除（`deleted=1` + `deleted_time`，保留文章标签关联），管理端 `GET /api/admin/articles/recycle` 分页查看，`PUT /{id}/restore` 恢复、`DELETE /{id}/purge` 彻底删除（同时清理标签关联与评论）；列表 / 搜索 / 归档 / 详情 / 上下篇统一过滤已删除文章，删除与恢复时主动失效详情缓存。

### 前端 Sketch Style 要点

- 设计令牌集中在 `tailwind.config.js`：纸张米色 `#f5f0e8`、铅笔灰 `#2c2c2c`、低饱和强调色（红 `#e74c3c` / 蓝 `#3498db` / 绿 `#27ae60` / 黄 `#f39c12`）。
- 全局 SVG 纸张纹理背景；卡片与控件统一使用虚线边框、衬线斜体标题、轻微倾斜、手绘硬阴影 `3px 3px 0 rgba(44,44,44,.15)`。
- 交互：hover 铅笔涂黑反白（Pencil Shading）、active 减少阴影并加大倾斜（Paper Press）、强调文本用波浪/虚线标注；所有动效在 `prefers-reduced-motion: reduce` 下关闭。
- **自动保存草稿**：编辑器内容变化后 700ms 防抖写 `localStorage`，草稿每 15 秒写回服务端（`status=0`）；新文章首次自动保存会创建草稿并记住 ID，已发布文章只保留本地草稿、不改线上内容；刷新/重进可恢复本地草稿，关闭页面或站内跳转会提示未保存修改（详见 [frontend/README.md](frontend/README.md)）。
- Markdown：后台写文章用 Vditor 的**即时渲染（IR）**内核 + **Typora 式外壳**——顶部「文件 / 编辑 / 段落 / 格式 / 视图」菜单栏代替图标工具栏，「文件」菜单支持新建、导入 / 导出 Markdown（也可以把 `.md` 文件直接拖进编辑器）、导出独立 HTML 与直接下载的 PDF（浏览器端按块分页 + SVG foreignObject 原生渲染，不弹打印框，300 页约 10s；长文档的 Markdown 文本会缓存、大纲/字数走防抖，十几万字导入与切换源码模式不再反复全量序列化，详见 [frontend/README.md](frontend/README.md)），右侧「大纲」展开标题侧栏（点击跳转、随滚动高亮）、「源码」在 IR / SV 之间切换（`Ctrl+/`）、「全屏」铺满视口（优先 Fullscreen API，被拒时退回 CSS 全屏）；表格悬停时在表格左上角浮出一排图标按钮（插入/删除行列、删除整张表格，带 tooltip）；代码块右下角可直接点选语言（常用语言下拉），代码块内 `Tab` / `Shift+Tab` 缩进；底部状态栏显示当前模式与实时字数；快捷键沿用 Typora（`Ctrl+1~6`/`Ctrl+0` 标题、`Ctrl+B` 粗体、`Ctrl+I` 斜体、`Ctrl+K` 链接）。Markdown 快捷输入与 Typora 一致：`#` + 空格渲染标题、`-` + 空格渲染列表、```` + 回车渲染代码块、表格源码（表头 + `---` 分隔行）回车后转成真正的表格。手写 `2.` + 空格时保留起始序号（同时写 `ol` 的 `start` / `data-marker` 与 `li` 的 `data-marker`，存成 Markdown 也是 `2.`），被代码块等隔断的有序列表不会又回到 1，回车继续编号 3、4；已经在列表项里时不接管空格，避免改坏原列表。行内标记即时渲染：输入完 `**加粗**`、`` `行内代码` `` 的闭合标记后立刻收起源标记，选中文字用「格式」菜单或 `Ctrl+B/I/U` 也只显示渲染结果（Vditor 默认要再按空格或方向键才收起），光标进入节点内部时标记会自动展开方便改源码。代码块编辑态也直接渲染成高亮代码：预览层始终显示并决定高度，可编辑的源码层透明叠在上面，输入时看到的就是高亮后的代码，展开/收起高度不变、不会再跳动；围栏反引号与顶部语言行不显示，语言标识在右下角（新建时输入语言也显示在同一位置），悬停代码块右上角出现复制按钮、提示在按钮右侧；单行与多行代码块的复制/语言按钮不会再重叠。语言按钮和下拉改成了带图标的列表：品牌色图标 + 完整语言名，下拉样式与顶部菜单一致，单击出列表、双击变成输入框可手写任意语言标识（输入框直接在按钮原位、同尺寸显示，不会重叠）；语言栏里按 `Backspace` 不会再插出空行（Vditor 原本会在标记开头插入段落）。代码块底色是纯纸张色（`#efe9db`），Vditor 自带的那张 20×20 网格底图已去掉，阅读页同样处理。水平分隔线（`---` + 回车生成的 hr）在 IR 模式下不可编辑，Vditor 只在 Firefox 里处理相邻删除，Chromium 下删不掉：这里补上单击选中（蓝色高亮）后按 `Backspace` / `Delete` 删除，以及光标在 hr 后一段开头按 `Backspace`、前一段末尾按 `Delete` 删除，hr 加高到 13px 方便点中，删除后 Markdown 与撤销/重做正常同步。正文排版参考 **Typora**：系统无衬线字体、粗体标题、实线细边框、灰底代码块与 GitHub 高亮配色，但底色仍用站点纸张色（`#f5f0e8` / 代码块 `#efe9db`），不再使用纯白。前台阅读页把正文放进一张**纸张页面卡片**（`src/styles/markdown-reading.css`：纸张底 `#faf6ee`、1px 浅灰实线、小圆角、860px 居中），代码块沿用 `markdown.css` 的纸色（`#efe9db`、14px、无边框），`markdown-reading.css` 只补代码块 chrome（语言名在右下角、复制按钮悬停出现在右上角）；代码高亮走**本地 highlight.js + GitHub 浅色主题**（`public/highlight/github.css` 由 `scripts/copy-vditor.mjs` 生成），不再从 unpkg 拉 CDN，离线也有高亮。页面其它外壳仍是手绘纸张风。阅读页还带右侧 sticky 目录（点击平滑跳转、滚动时高亮当前标题，窄屏为右下角「目录」抽屉）和顶部 3px 阅读进度条。另外修复了编辑页「正文模块不见了」：编辑已有文章时 `loading` 初始为 `true`，数据回来前不挂载表单，避免 `MarkdownEditor` 在 Vditor 初始化完成前被卸载销毁而抛错。

## 接口文档

- 运行期：http://localhost:8080/doc.html （Knife4j）
- 契约文件：[docs/API.md](docs/API.md)（字段、错误码、权限、前端路由映射）
- **版本约束**：Knife4j 4.5.0 必须搭配 springdoc **2.3.0**（见 `backend/pom.xml` 的 `springdoc.version`）。
  把 springdoc 单独升到 2.6.x 会让 `/v3/api-docs` 返回 500
  （`NoSuchMethodError: SpringDocConfigProperties.getGroupConfigs`），表现为 `/doc.html` 空白或报错。
