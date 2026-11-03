# 本地开发与联调

本文记录本机 / 本地虚拟机的全链路联调方式，以及可复用的验证脚本。**生产部署见 [DEPLOY.md](DEPLOY.md)（Docker + GitHub Actions + GHCR + 阿里云）。**

## 已验证结果

| 验证项 | 结果 |
| ---- | ---- |
| API 冒烟（`scripts/smoke-api.mjs`） | 37 / 37 通过（旧脚本；本次新增互动/通知等由下方 P1 冒烟覆盖） |
| P1-1 / P1-2 / P1-4 / P1-5 API 冒烟（2026-10-31） | 26 / 26 通过：点赞/收藏幂等、收藏分页、相关文章、分享卡片 PNG 1200×630 + 缓存头 + 404、5 层楼中楼、递归删除、通知生成/未读/已读/越权 403 |
| P1 / P3-2 前端 E2E（无头 Edge，2026-10-31） | 20 / 20 通过：动作条、相关文章、分享弹窗、通知页、收藏夹、暗色/移动端、KaTeX/Mermaid/ECharts、编辑器菜单与 IR 公式、无 CDN 请求 |
| 页面渲染冒烟（jsdom 加载 `frontend/dist`） | 前台 11 项 + 管理端 9 项通过 |
| 对象存储公共读 URL（联调时用 MinIO 便携版验证） | HTTP 200，越权删除返回 403 |
| JWT 刷新 / 登出黑名单 | 刷新后旧 accessToken 立即失效 |
| 阅读量 | Redis 自增，文章详情连续访问 +1 |
| 评论 | 发表（待审核）→ 管理端审核通过 → 前台展示 → 点赞去重 / 取消点赞 |

## 1. 依赖准备

### 方式 A：容器起基础设施（推荐）

只起 MySQL / Redis / 对象存储三个依赖，后端和前端在宿主机（或虚拟机内）直接跑：

**Rocky Linux 9 + Podman（推荐）：**

```bash
sudo dnf install -y epel-release && sudo dnf install -y podman podman-compose
podman-compose -f docker-compose.infra.yml up -d
```

Podman 4.7+ 也可以直接用内置子命令（需要 provider，上面装了 `podman-compose` 就满足）：

```bash
podman compose -f docker-compose.infra.yml up -d
```

**Docker（备选，要求 compose v2）：**

```bash
docker compose -f docker-compose.infra.yml up -d
```

- **不需要 `.env`**：端口、密码都带开发默认值，虚拟机里直接能跑
- 首次启动自动执行 `sql/init.sql`（建表 + 初始化分类/标签）；`blog` bucket 由后端首次启动时创建并设置公共读
- **已有数据库升级**：
  - 回收站：执行一次 `sql/upgrade-2026-10-p0-8-recycle.sql`（新增 `article.deleted_time` 与索引）
  - 内容看板：执行一次 `sql/upgrade-2026-11-p1-8-dashboard.sql`（新增 `site_daily_stat` / `article_daily_stat`）
  - P1-1 楼中楼/通知 + P1-2 点赞收藏：执行一次 `sql/upgrade-2026-11-p1-community.sql`
    （`comment` 新增 `root_id/reply_to_user_id/depth`，新增 `notification` / `article_like` /
    `article_favorite`，`article` 新增 `like_count/favorite_count`）
  - 新的 `init.sql` 已包含上述变更，全新库无需执行
- 对象存储默认用 **RustFS**（S3 兼容，带 Web 控制台）：MinIO 社区版已停止发布镜像，
  2026-09-11 Docker Hub 上的 `minio/minio` / `minio/mc` 全部下架；后端只用标准 S3 API，不感知存储实现。
  若你有可用的 MinIO 镜像仓库，按 `docker-compose.infra.yml` 里的注释替换 `objectstore` 即可。
- 访问信息默认值：

  | 服务 | 地址 | 凭据 |
  | ---- | ---- | ---- |
  | MySQL | `127.0.0.1:3306` | root / `blog_dev_123456` |
  | Redis | `127.0.0.1:6379` | 无密码 |
  | 对象存储 S3 API | `http://127.0.0.1:9000` | `minioadmin` / `minioadmin` |
  | 对象存储控制台 | `http://127.0.0.1:9001` | 同上 |

- 停止：`podman-compose -f docker-compose.infra.yml down`（Docker 用 `docker compose`，下同；保留数据）；要清库重建加 `-v`
- 改端口/密码：复制 `.env.example` 为 `.env` 并覆盖同名变量（项目名 `blog-infra`，不会和完整栈混）
- 只想起 MySQL + Redis（暂时不碰对象存储）：`podman-compose -f docker-compose.infra.yml up -d mysql redis`
- **Podman / Rocky 注意**：
  - 用普通用户 rootless 跑即可（端口都 >1024），不需要 sudo，也不需要启动 docker 服务
  - SELinux 默认 enforcing：`sql/` 挂载已用长语法 `bind: {selinux: z}` 打标签
    （podman-compose 不认短语法 `:ro,z`，会报 `unknown mount option z`）；
    以后自己加宿主目录挂载也要按同样方式打 `z`/`Z`
  - 需要 `netavark + aardvark-dns`（Rocky 的 podman 包默认带）：`podman info --format '{{.Host.NetworkBackend}}'` 应输出 `netavark`
  - 从宿主机访问虚拟机里的服务要放行 firewalld（按需）：
    `sudo firewall-cmd --permanent --add-port={3306,6379,9000,9001,8080,5173}/tcp && sudo firewall-cmd --reload`
  - rootless 容器不随开机自启，开机后手动 `up` 即可
- **在虚拟机里跑**：后端 `MINIO_PUBLIC_ENDPOINT` 要填虚拟机 IP（如 `http://192.168.56.10:9000`），
  否则宿主机浏览器打不开上传的图片；MySQL/Redis/对象存储端口若和宿主机已有服务冲突，
  用 `.env` 或环境变量改 `MYSQL_PORT` / `REDIS_PORT` / `MINIO_PORT` / `MINIO_CONSOLE_PORT`。

> 若要把前后端也一起容器化，用完整栈 `docker-compose.yml`（需先 `cp .env.example .env`）。两套编排端口相同，**不要同时启动**。

### 方式 B：本机便携版（本次联调用法）

> 本机已有 MySQL 80 服务（端口 3306，root 密码未知），为避免影响现有实例，测试时另起了一个 **3307 端口、独立数据目录** 的实例。

**MySQL 8**（复用已安装的 mysqld）：

```powershell
$base = 'C:\Program Files\MySQL\MySQL Server 8.0'
mkdir .dev\mysql-data -Force
& "$base\bin\mysqld.exe" --no-defaults --initialize-insecure --basedir="$base" --datadir="$PWD\.dev\mysql-data" --console

# 启动（另开窗口）
& "$base\bin\mysqld.exe" --no-defaults --basedir="$base" --datadir="$PWD\.dev\mysql-data" `
  --port=3307 --bind-address=127.0.0.1 --skip-mysqlx `
  --log-error="$PWD\.dev\mysql.err"

# 导入表结构与演示分类/标签
& "$base\bin\mysql.exe" --host=127.0.0.1 --port=3307 --user=root `
  --default-character-set=utf8mb4 --execute="SOURCE $PWD/sql/init.sql;"
```

**Redis 7**

- 优先用 Docker：`docker run -d --name blog-redis -p 6379:6379 redis:7-alpine`
- 或 Memurai（Windows 原生 Redis 兼容服务）
- 说明：本机受限沙箱里 cygwin/msys2 版 Redis 会因命名管道被禁用而启动失败，联调时改用纯 Java 的 `jedis-mock` 作为替身；**生产/正常开发请使用真实 Redis 7**。此时启动后端需加 `--management.health.redis.enabled=false`（jedis-mock 的 `INFO` 字段不完整，会让 actuator 健康检查误报 DOWN），真实 Redis 不需要这个参数。
- **分享卡片字体（P1-4）**：`GET /api/articles/{id}/share-card.png` 用 Java2D 渲染中文，本机直接跑
  jar 时使用系统字体（Windows 回退微软雅黑）；Docker 运行镜像已安装
  `fontconfig` + `fonts-noto-cjk` 并加 `-Djava.awt.headless=true`，容器内无需额外配置。

**MinIO**

> 官方 `dl.min.io` 已停止分发开源社区二进制（返回 410）。可用中国镜像：

```powershell
curl.exe -L -o .dev\minio.exe https://dl.minio.org.cn/server/minio/release/windows-amd64/minio.exe
$env:MINIO_ROOT_USER='minioadmin'; $env:MINIO_ROOT_PASSWORD='minioadmin'
& .dev\minio.exe server .dev\minio-data --address 127.0.0.1:9000 --console-address 127.0.0.1:9001
```

## 2. 启动后端

要求 JDK 17 + Maven 3.6.3+（本机用 Maven 3.9.9 验证）。环境变量与 `docker-compose.yml` 中 backend 的变量一致。

**Rocky Linux / Podman 起依赖（用 `docker-compose.infra.yml` 的默认值）：**

```bash
cd backend
mvn -DskipTests package

export MYSQL_HOST=127.0.0.1 MYSQL_PORT=3306 MYSQL_DATABASE=blog
export MYSQL_USERNAME=root MYSQL_PASSWORD=blog_dev_123456
export REDIS_HOST=127.0.0.1 REDIS_PORT=6379
export MINIO_ENDPOINT=http://127.0.0.1:9000
export MINIO_ACCESS_KEY=minioadmin MINIO_SECRET_KEY=minioadmin
export MINIO_BUCKET=blog
# 从宿主机浏览器访问虚拟机时改成虚拟机 IP，例如 http://192.168.56.10:9000
export MINIO_PUBLIC_ENDPOINT=http://127.0.0.1:9000
export JWT_SECRET="$(openssl rand -base64 48 | tr -d '\n')"
export ADMIN_USERNAME=admin ADMIN_PASSWORD=admin123456

java -jar target/blog-backend.jar
```

**Windows（本机便携版，方式 B）：**

```powershell
$env:JAVA_HOME = 'C:\Program Files\Java\jdk-17'
cd backend
mvn -DskipTests package

$env:MYSQL_HOST='127.0.0.1'; $env:MYSQL_PORT='3307'; $env:MYSQL_DATABASE='blog'
$env:MYSQL_USERNAME='root'; $env:MYSQL_PASSWORD=''
$env:REDIS_HOST='127.0.0.1'; $env:REDIS_PORT='6379'
$env:MINIO_ENDPOINT='http://127.0.0.1:9000'
$env:MINIO_ACCESS_KEY='minioadmin'; $env:MINIO_SECRET_KEY='minioadmin'
$env:MINIO_BUCKET='blog'; $env:MINIO_PUBLIC_ENDPOINT='http://127.0.0.1:9000'
$env:JWT_SECRET='dev-local-secret-0123456789abcdef0123456789abcdef0123456789abcdef'
$env:ADMIN_USERNAME='admin'; $env:ADMIN_PASSWORD='admin123456'

java -jar target\blog-backend.jar
# 若 Redis 用 jedis-mock，追加：--management.health.redis.enabled=false
```

启动后：

- 健康检查：<http://127.0.0.1:8080/actuator/health>
- Knife4j：<http://127.0.0.1:8080/doc.html>
- 首次启动自动创建管理员 `admin / admin123456`，并创建对象存储 bucket、设置公共读

## 3. 启动前端

```bash
cd frontend
npm install
npm run dev        # http://127.0.0.1:5173
```

前端 `/api` 会代理到 `http://localhost:8080`（见 `vite.config.js`）。

## 4. 冒烟与演示数据

```bash
node scripts/seed-demo.mjs   # 3 篇已发布文章（含封面/标签/评论/点赞）+ 1 篇草稿
node scripts/smoke-api.mjs   # 40 项 API 断言（含点赞/取消点赞），全部通过即联调成功
```

页面渲染冒烟（可选，需要 `jsdom`）：用 Node + jsdom 加载 `frontend/dist`，复用真实后端接口，逐路由校验渲染结果。受限环境（无法启动 Chromium）可用；正常开发直接用浏览器打开即可。

## 5. 停止

```bash
# Rocky Linux / Podman：依赖容器
podman-compose -f docker-compose.infra.yml down
```

```powershell
# Windows 方式 B：关闭后端 / 对象存储 / Redis(mock) 的后台进程后
mysqladmin --host=127.0.0.1 --port=3307 --user=root shutdown
docker compose -f docker-compose.infra.yml down   # 若用 Docker 起的基础设施
docker compose down                               # 若用完整栈
```

## 6. 常见问题

- **端口冲突**：MySQL 3306、Redis 6379、对象存储 9000/9001、后端 8080、前端 5173；冲突时改 `.env`/环境变量。
- **MySQL 密码未知**：不要动现有服务，按上面方式起独立实例（3307）。
- **图片 403**：确认后端日志出现 `MinIO bucket [blog] 初始化完成`；公共读策略由后端 `PutBucketPolicy` 设置。
  用 RustFS 时若该策略调用被拒，可在控制台 `http://127.0.0.1:9001` 里给 `blog` 桶手动设公开读。
- **拉不到镜像（Rocky / Podman）**：在 `/etc/containers/registries.conf` 里给 `docker.io` 配镜像加速，例如：

  ```toml
  unqualified-search-registries = ["docker.io"]

  [[registry]]
  location = "docker.io"

  [[registry.mirror]]
  location = "docker.m.daocloud.io"
  ```

  配好后 `podman pull docker.io/library/mysql:8.0` 试一下；内网无外网时可先在有网机器 `podman save`，再 `podman load`。
- **Podman 报 SELinux 权限（Permission denied）**：宿主目录挂载要打 `z`/`Z` 标签；`sql/` 已经在
  `docker-compose.infra.yml` 里用长语法 `bind: {selinux: z}` 处理过，自己加的挂载漏了就会踩到。
  注意 podman-compose 不支持短语法 `:z`（会报 `unknown mount option z`），要写长语法。
- **RustFS 启动报写 `/data` 失败（rootless Podman）**：确认用的是 named volume（默认就是）；
  若改成宿主目录挂载，挂载点要加 `:U` 或先 `podman unshare chown -R 10001:10001 <目录>`。
- **接口文档（/doc.html）空白或报错**：先访问 `/v3/api-docs/blog`，若返回 500 且日志有
  `NoSuchMethodError: SpringDocConfigProperties.getGroupConfigs`，说明 springdoc 与 Knife4j 版本不匹配。
  Knife4j 4.5.0 必须用 springdoc **2.3.0**（`backend/pom.xml` 已锁定），不要单独升级 springdoc。
- **上传 400**：只允许 jpg/png/webp/gif，≤ 5MB。
- **登录 401 / 刷新失败**：确认 Redis 可用（Token 白名单/黑名单依赖 Redis）。
- **页面空白**：先看 `/actuator/health` 与浏览器 Network，再对照 `docs/API.md` 字段。
