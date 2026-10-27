# 技术分享博客 · Sketch Style

前后端分离的技术分享博客：**Vue 3 + Tailwind CSS 手绘素描本风格**前端，**Spring Boot 3 + MyBatis-Plus** 后端，MySQL 8 存储、Redis 缓存与计数、MinIO（S3 兼容）对象存储，Docker Compose 一键部署。

## 技术栈

| 层 | 技术 |
| ---- | ---- |
| 前端 | Vue 3（Composition API + `<script setup>`）、Vite 5、Vue Router 4、Pinia、Tailwind CSS 3、Axios、Vditor（即时渲染 Markdown 编辑）、md-editor-v3（正文预览）、highlight.js、ESLint + Prettier |
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
│   └── LOCAL_DEV.md          # 本地开发/联调与冒烟说明
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

### 前端 Sketch Style 要点

- 设计令牌集中在 `tailwind.config.js`：纸张米色 `#f5f0e8`、铅笔灰 `#2c2c2c`、低饱和强调色（红 `#e74c3c` / 蓝 `#3498db` / 绿 `#27ae60` / 黄 `#f39c12`）。
- 全局 SVG 纸张纹理背景；卡片与控件统一使用虚线边框、衬线斜体标题、轻微倾斜、手绘硬阴影 `3px 3px 0 rgba(44,44,44,.15)`。
- 交互：hover 铅笔涂黑反白（Pencil Shading）、active 减少阴影并加大倾斜（Paper Press）、强调文本用波浪/虚线标注；所有动效在 `prefers-reduced-motion: reduce` 下关闭。
- Markdown：后台写文章用 Vditor 的**即时渲染（IR）**模式，边写边在当前位置渲染，只保留这一种模式；工具栏按钮带中文名称，正文左侧显示渲染行号（随滚动同步、自动重排），表格悬停时在表格正下方横向浮出操作条（插行/删行/插列/删列/对齐），大纲点击精确滚动正文而不是整页跳顶，全屏铺满视口；工具栏不再显示字数，正文右上角按「去 Markdown 标记后的字数」统计。阅读端用 md-editor-v3 预览；两者均通过 CSS 变量/覆盖适配手绘风，不使用纯白背景，并补齐了 Tailwind preflight 清掉的列表序号。

## 接口文档

- 运行期：http://localhost:8080/doc.html （Knife4j）
- 契约文件：[docs/API.md](docs/API.md)（字段、错误码、权限、前端路由映射）
- **版本约束**：Knife4j 4.5.0 必须搭配 springdoc **2.3.0**（见 `backend/pom.xml` 的 `springdoc.version`）。
  把 springdoc 单独升到 2.6.x 会让 `/v3/api-docs` 返回 500
  （`NoSuchMethodError: SpringDocConfigProperties.getGroupConfigs`），表现为 `/doc.html` 空白或报错。
