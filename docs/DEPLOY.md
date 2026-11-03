# 生产部署：Docker + GitHub Actions + GHCR + 阿里云 Ubuntu 24.04

> 适用仓库：`fullofstar-p/blog`（Vue 3 + Spring Boot 3 + MySQL 8 + Redis 7 + S3 兼容对象存储）。
> 本文给出一条可复现的上线路径：**代码推到 GitHub → Actions 构建镜像推到 GHCR → 阿里云 ECS 拉镜像用 Docker Compose 运行 → 宿主机 Nginx 反代并签发 HTTPS**。
> 本地开发与联调见 [LOCAL_DEV.md](LOCAL_DEV.md)，工程优化清单见 [OPTIMIZATION.md](OPTIMIZATION.md)。

本文涉及的部署文件：

| 文件 | 作用 |
| ---- | ---- |
| [docker-compose.prod.yml](../docker-compose.prod.yml) | 生产编排：GHCR 镜像、资源限制、日志轮转、端口只绑 127.0.0.1 |
| [.env.prod.example](../.env.prod.example) | 服务器 `.env` 模板（密码、JWT、域名、镜像 tag） |
| [deploy/deploy.sh](../deploy/deploy.sh) | 服务器端发布脚本：拉镜像 → 重建容器 → 等健康检查 |
| [deploy/backup.sh](../deploy/backup.sh) | MySQL + 对象存储数据卷备份脚本 |
| [deploy/nginx/blog.conf.template](../deploy/nginx/blog.conf.template) | 宿主机 Nginx 反代模板（含 `/files/` 图片直链） |
| [.github/workflows/ci.yml](../.github/workflows/ci.yml) | PR / 推送时校验前后端构建 |
| [.github/workflows/release.yml](../.github/workflows/release.yml) | 构建镜像推 GHCR，可选的 SSH 自动部署 |

---

## 0. 一页速览

```bash
# ① 服务器一次性初始化（第 3 节）：装 Docker、登录 GHCR、克隆仓库
# ② 配置环境变量（第 4.1 节）
cd /opt/blog
cp .env.prod.example .env && chmod 600 .env
vim .env

# ③ 让 GitHub Actions 先产出镜像（第 4.2 节）：把 dev 合到 master 并 push，
#    或在 Actions 页面手动 Run workflow，等 Release 工作流变绿。

# ④ 发布（第 4.3 节）
./deploy/deploy.sh

# ⑤ 宿主机 Nginx + 证书（第 6 节）
sudo sed "s/__DOMAIN__/blog.example.com/g" deploy/nginx/blog.conf.template \
  | sudo tee /etc/nginx/sites-available/blog.conf >/dev/null
sudo ln -sf /etc/nginx/sites-available/blog.conf /etc/nginx/sites-enabled/blog.conf
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d blog.example.com --redirect --agree-tos -m you@example.com --no-eff-email
```

后续日常发布：`dev` 合并到 `master` 并 push → Actions 自动构建 `latest` →（可选）自动 SSH 执行 `./deploy/deploy.sh`；手动发布就是 `git pull && ./deploy/deploy.sh`。

---

## 1. 部署架构

### 1.1 拓扑

```text
开发者
  │ git push
  ▼
GitHub 仓库（dev 日常 / master 发布）
  ├── Actions: ci.yml      → Maven 打包 + ESLint + Vite 构建
  └── Actions: release.yml → 构建镜像并推送 GHCR
                              ghcr.io/<owner>/<repo>/backend:<tag>
                              ghcr.io/<owner>/<repo>/frontend:<tag>
                                        │
                                        │ docker compose pull
阿里云 ECS（Ubuntu 24.04）               ▼
  ┌────────────────────────────────────────────────────────────────────┐
  │ 宿主机 Nginx :80 / :443                                            │
  │   ├── /        → 127.0.0.1:8081  frontend 容器（Nginx）             │
  │   └── /files/  → 127.0.0.1:9000  objectstore 容器（S3 API）         │
  │                                                                    │
  │  compose 内部网络 blog-prod-net：                                  │
  │    frontend ──/api──▶ backend:8080 ──▶ mysql:3306 / redis:6379      │
  │                                                                    │
  │  数据卷：blog-prod_mysql-data / blog-prod_redis-data /              │
  │          blog-prod_objectstore-data                                │
  └────────────────────────────────────────────────────────────────────┘
```

### 1.2 请求链路

| 请求 | 链路 |
| ---- | ---- |
| 页面 / 静态资源 | 浏览器 → 宿主机 Nginx → frontend 容器 Nginx → `dist` 静态文件 |
| API | 浏览器 → 宿主机 Nginx → frontend 容器 Nginx → `backend:8080/api/...` |
| 上传的图片 | 浏览器 → 宿主机 Nginx `/files/...` → `objectstore:9000`（S3 path-style） |
| 后端 → 依赖 | backend → `mysql:3306`、`redis:6379`、`objectstore:9000`（compose 内部 DNS） |

### 1.3 端口与暴露面

| 端口 | 监听地址 | 归属 | 是否公网 |
| ---- | -------- | ---- | -------- |
| 80 / 443 | `0.0.0.0` | 宿主机 Nginx | ✅ 安全组放行 |
| 22 | `0.0.0.0` | SSH | ✅ 建议只放行自己的 IP |
| 8081 | `127.0.0.1` | frontend 容器映射 | ❌ 仅本机 Nginx 访问 |
| 9000 | `127.0.0.1` | objectstore S3 API 映射 | ❌ 仅本机 Nginx 访问 |
| 3306 / 6379 / 8080 | 不发布 | mysql / redis / backend | ❌ 仅 compose 网络内 |

> 生产编排刻意**不发布** MySQL、Redis、后端端口：数据库和缓存不暴露到公网，后端只允许前端容器访问。不要为了“方便连库”把 3306 放到安全组。

---

## 2. 前置准备

### 2.1 阿里云资源

| 资源 | 建议 | 说明 |
| ---- | ---- | ---- |
| ECS 实例 | Ubuntu 24.04 64 位，2 vCPU / 4 GiB 起，4C8G 更稳 | 全家桶含 MySQL/Redis/对象存储，2C2G 也能跑但需下调 compose 内存限制 |
| 系统盘 | ESSD 40–60 GiB | 镜像 + 数据卷 + 日志；图片多的话对象存储数据也在盘上 |
| 带宽 | 3–5 Mbps 起 | 图片多的站点建议 5 Mbps 以上，或把 `/files/` 接 CDN |
| 安全组 | 入方向：22（限自己 IP）、80、443 | **不要**放行 3306 / 6379 / 8081 / 9000 / 8080 |
| 域名 | A 记录指向 ECS 公网 IP | 中国大陆地域的 80/443 需要 ICP 备案 |

不需要额外购买 RDS / Redis：MySQL 与 Redis 都跑在 compose 里。如果已有云数据库，删掉 compose 里的 `mysql`/`redis` 服务、把 `MYSQL_HOST`/`REDIS_HOST` 指向云实例即可（注意同步改 `depends_on`）。

### 2.2 域名与备案

1. 在域名解析里加 `A` 记录：`@ → ECS 公网 IP`；需要 `www` 再加一条 `CNAME`。
2. 中国大陆地域：域名绑定 80/443 前必须有 ICP 备案，否则会被拦截。没有备案时可选：
   - 用香港/海外地域的 ECS；
   - 临时只通过 `https://IP:端口` 访问（不推荐，且 Let's Encrypt 不给 IP 签证书）。
3. 等 `dig +short blog.example.com` 返回 ECS IP 后再申请证书。

### 2.3 仓库准备

| 项 | 设置 |
| ---- | ---- |
| 分支策略 | `dev` 日常开发（CI + dev 镜像）；`master` 发布（latest 镜像 + 可选自动部署）；`v1.2.3` 标签发语义化版本 |
| Actions 权限 | `Settings → Actions → General → Workflow permissions` 选 **Read and write permissions**（否则 `GITHUB_TOKEN` 推不了 GHCR） |
| 包可见性 | 首次构建后到个人/组织的 Packages 里决定 GHCR 包公开或私有（见 5.3） |
| 仓库变量/密钥 | 只有启用自动部署时才需要（见 5.4） |

---

## 3. 服务器初始化（Ubuntu 24.04）

> 下面的命令默认用 `deploy` 用户执行，需要提权的地方写了 `sudo`。
> 阿里云 Ubuntu 镜像默认允许 `root` 密码登录，建议先建普通用户并改成密钥登录（第 9 节）。

### 3.1 基础设置

```bash
# 系统更新与时区
sudo apt-get update && sudo apt-get -y upgrade
sudo apt-get install -y ca-certificates curl gnupg git vim unzip
sudo timedatectl set-timezone Asia/Shanghai
timedatectl status

# 2 GiB swap（2C4G 实例建议开，防止构建/峰值时 OOM）
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
free -h
```

创建部署用户（已有普通用户可跳过）：

```bash
sudo adduser --gecos "" deploy
sudo usermod -aG sudo deploy
# 之后用 deploy 登录；把本地公钥放进 /home/deploy/.ssh/authorized_keys
```

### 3.2 安装 Docker CE（含 compose 插件）

用阿里云镜像源装 Docker CE，避免 `docker.io` 旧版本缺少 `docker compose`：

```bash
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://mirrors.aliyun.com/docker-ce/linux/ubuntu/gpg \
  | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
https://mirrors.aliyun.com/docker-ce/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
  | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io \
  docker-buildx-plugin docker-compose-plugin

# 让 deploy 用户免 sudo 使用 docker（重新登录后生效）
sudo usermod -aG docker deploy

docker --version           # Docker version 27.x（或更新）
docker compose version     # Docker Compose version v2.2x+
```

> Ubuntu 24.04 的 `docker.io` 包也能用，但 compose 插件版本偏旧；认证不支持 `docker compose` 子命令时请按上面装官方 CE。

### 3.3 配置 Docker daemon（镜像加速 + 日志轮转）

MySQL / Redis / RustFS / Alpine 都来自 Docker Hub，国内拉取建议配阿里云镜像加速器（控制台 → 容器镜像服务 → 镜像工具 → 镜像加速器，每个账号有独立地址）。
注意：**`registry-mirrors` 只加速 Docker Hub，不会加速 `ghcr.io`**，GHCR 的处理见 5.3 与附录 C。

```bash
sudo mkdir -p /etc/docker
sudo tee /etc/docker/daemon.json > /dev/null <<'JSON'
{
  "log-driver": "json-file",
  "log-opts": { "max-size": "20m", "max-file": "3" },
  "registry-mirrors": ["https://<你的加速器ID>.mirror.aliyuncs.com"],
  "live-restore": true
}
JSON

sudo systemctl daemon-reload
sudo systemctl enable --now docker
sudo systemctl restart docker
docker info | grep -A3 "Registry Mirrors"
```

### 3.4 安全组与防火墙

- 阿里云安全组（推荐，云层生效）：入方向只留 `22`（来源填自己固定 IP）、`80`、`443`。
- 服务器上 `ufw` 保持关闭即可；如果要开，注意 Docker 发布的端口会绕过 ufw，真正的边界仍是安全组（本编排所有业务端口都只绑 `127.0.0.1`，公网只有 Nginx 的 80/443）。

```bash
sudo ufw status          # 一般为 inactive，不用动
```

### 3.5 登录 GHCR（包为私有时必须）

先在 GitHub 生成 Personal Access Token（classic）：`Settings → Developer settings → Personal access tokens → Tokens (classic)`，勾选 **`read:packages`** 即可（需要能读仓库代码时再加 `repo`）。

```bash
# 在服务器上执行（把 <PAT> 换成 token）
echo '<PAT>' | docker login ghcr.io -u fullofstar-p --password-stdin
# 凭据保存在 ~/.docker/config.json；之后 docker compose pull 才能拉私有包
```

如果选择把 GHCR 包设为 Public，服务器不需要登录也能 pull，可跳过这步。

### 3.6 目录与代码

```bash
sudo mkdir -p /opt/blog
sudo chown deploy:deploy /opt/blog

# 公开仓库
git clone https://github.com/fullofstar-p/blog.git /opt/blog

# 私有仓库二选一：
#   a) 用 PAT（会留在 .git/config，注意权限）：git clone https://<PAT>@github.com/fullofstar-p/blog.git /opt/blog
#   b) 用只读 Deploy Key：仓库 Settings → Deploy keys 添加公钥后 git clone git@github.com:fullofstar-p/blog.git /opt/blog

cd /opt/blog
git checkout master
git log --oneline -1
```

服务器上的仓库只用来放部署文件（compose、sql、脚本），**不要在这里改代码**；自动部署会执行 `git reset --hard`。

---

## 4. 首次部署（先手动跑通，再开自动化）

### 4.1 配置 `.env`

```bash
cd /opt/blog
cp .env.prod.example .env
chmod 600 .env

# 生成随机密码（MySQL root / 对象存储 / 管理员各一个）
openssl rand -base64 24

# 生成 JWT 密钥（≥ 64 字符）
openssl rand -base64 64 | tr -d '\n'; echo

vim .env
```

必填项（留空 compose 会直接报错退出）：

| 变量 | 示例 | 说明 |
| ---- | ---- | ---- |
| `IMAGE_NAMESPACE` | `ghcr.io/fullofstar-p/blog` | GHCR 上的镜像命名空间，须与 Actions 产出一致 |
| `IMAGE_TAG` | `latest` | 默认分支最新构建；回滚用 `sha-xxxxxxx` |
| `PUBLIC_BASE_URL` | `https://blog.example.com` | 图片 URL 前缀，不能以 `/` 结尾 |
| `MYSQL_ROOT_PASSWORD` | 随机串 | 首次启动固化到数据卷，之后改这里不会改库里密码 |
| `MINIO_ROOT_USER` / `MINIO_ROOT_PASSWORD` | 随机串 | 对象存储凭据，后端同时用作 S3 access/secret key |
| `JWT_SECRET` | 64+ 随机字符 | 换掉会让所有用户重新登录 |
| `ADMIN_PASSWORD` | 随机强密码 | 仅在库里没有 ADMIN 用户时创建 |

其余项（`MYSQL_DATABASE=blog`、`MINIO_BUCKET=blog`、`FRONTEND_HOST_PORT=8081`、`OBJECTSTORE_HOST_PORT=9000`、token 有效期、站点名）一般保持默认。

校验配置是否完整：

```bash
docker compose -f docker-compose.prod.yml --env-file .env config -q && echo "compose 配置 OK"
```

### 4.2 准备镜像（先让 Actions 跑一次）

首次部署前 GHCR 里必须已有镜像。任选一种：

1. **推荐：走正常发布流程**（第 5.5 节）：把 `dev` 合并到 `master` 后 push（`latest` 只跟随 `master`，master 落后时先合并），等 `Release · GHCR 镜像` 工作流完成；
2. Actions 页面手动触发：`Actions → Release · GHCR 镜像 → Run workflow`，分支选 `master`；
3. **服务器本地构建兜底**（没有 Actions 时）：

   ```bash
   cd /opt/blog
   docker build -t ghcr.io/fullofstar-p/blog/backend:local ./backend
   docker build -t ghcr.io/fullofstar-p/blog/frontend:local ./frontend
   # .env 里临时 IMAGE_TAG=local
   ```

确认镜像存在：

```bash
docker pull ghcr.io/fullofstar-p/blog/backend:latest
docker pull ghcr.io/fullofstar-p/blog/frontend:latest
```

### 4.3 启动

```bash
cd /opt/blog
./deploy/deploy.sh
```

脚本会依次：校验 compose 配置 → `pull` → `up -d` → 强制重建 frontend 刷新 backend 的容器 DNS → 等 backend/frontend 健康 → 本地探活 → 清理悬空镜像。

首次启动的初始化顺序：

1. MySQL 空数据卷 → 执行 `sql/init.sql`（建库建表 + 演示分类/标签；`upgrade-*.sql` 不会被自动执行）；
2. backend 启动 → 创建初始管理员（BCrypt）、给对象存储建 bucket 并设置公共读；
3. frontend 启动 → 托管静态资源并反代 `/api`。

首次 `up` 通常需要 1–3 分钟（MySQL 健康检查 `start_period: 40s` + backend 建桶重试）。耐心等脚本结束；中途失败会打印最近 100 行 backend 日志。

### 4.4 验收清单

```bash
cd /opt/blog

# 1) 容器状态：mysql/redis/objectstore/backend/frontend 均为 Up（healthy）
docker compose -f docker-compose.prod.yml --env-file .env ps

# 2) 后端健康（容器内探，不经过公网）
docker exec blog-prod-backend wget -qO- http://127.0.0.1:8080/actuator/health

# 3) 后端接口（经 frontend 容器 Nginx）
curl -fsS "http://127.0.0.1:8081/api/articles?page=1&size=3" | head -c 300; echo

# 4) 数据库已建表
docker compose -f docker-compose.prod.yml --env-file .env exec -T mysql \
  sh -c 'exec mysql -uroot -p"$MYSQL_ROOT_PASSWORD" -e "SHOW TABLES" blog'

# 5) 管理员登录（返回 JSON，code=200，data.accessToken 非空）
curl -s -X POST http://127.0.0.1:8081/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"<ADMIN_PASSWORD>"}'

# 6) 上传图片（把 <accessToken> 换成上一步返回值）
curl -s -X POST http://127.0.0.1:8081/api/files/upload \
  -H "Authorization: Bearer <accessToken>" \
  -F "file=@/tmp/demo.png" -F "category=content"
```

等第 6 节配完 Nginx/证书后，再验证公网：

```bash
curl -I https://blog.example.com/
curl -I https://blog.example.com/files/blog/<objectKey>   # 200 且 Content-Type: image/png
```

| 验收项 | 期望 |
| ---- | ---- |
| `compose ps` | 5 个服务 `Up`，mysql/redis/objectstore/backend/frontend 健康状态正常 |
| `/api/articles` | `code=200`，有分页数据 |
| `SHOW TABLES` | 12 张表（user/article/comment/... + 统计表） |
| 管理员登录 | `code=200`，返回 access/refresh token |
| 上传图片 | 返回 `url=https://<域名>/files/blog/...`，浏览器可打开 |
| 分享卡片 | 文章详情「分享」弹窗能预览 1200×630 PNG（中文字体正常） |

---

## 5. GitHub Actions 流水线

### 5.1 CI（[ci.yml](../.github/workflows/ci.yml)）

| 触发 | 内容 |
| ---- | ---- |
| push `dev` / `master` | 后端 `mvn package`；前端 `npm ci` + `npm run lint` + `npm run build` |
| 任意到 `dev` / `master` 的 PR | 同上，作为合并门禁 |
| 手动 `workflow_dispatch` | 同上 |

- 后端用 `actions/setup-java` 的 Maven 缓存；前端用 `actions/setup-node` 的 npm 缓存。
- 产物 jar / dist 以 3 天保留期的 Artifact 上传，方便排查（不参与部署）。
- 仓库目前没有单元测试，`package` 等价于编译 + 打包；补测试后把命令换成 `mvn -B -ntp verify` 即可。

### 5.2 发布镜像（[release.yml](../.github/workflows/release.yml)）

| 触发 | 产生的镜像 tag |
| ---- | ---- |
| push `dev` | `dev`、`sha-xxxxxxx` |
| push `master` | `master`、`latest`、`sha-xxxxxxx` |
| push `v1.2.3` | `v1.2.3`、`1.2.3`、`sha-xxxxxxx` |
| 手动 Run workflow | 按所选分支/标签同上 |

镜像地址：

```text
ghcr.io/<owner>/<repo>/backend:<tag>
ghcr.io/<owner>/<repo>/frontend:<tag>
```

构建使用 Buildx + GitHub Actions 缓存（`type=gha`，backend/frontend 分开 scope），矩阵并行构建两个镜像，`platforms: linux/amd64`（ARM ECS 见注释改成 `linux/arm64`）。

> 参考耗时：本仓库首次在 `dev` 上实跑（2026-11-03，GitHub 托管 runner）：CI 45s；Release 3m28s（frontend 1m5s、backend 3m19s）。Maven 依赖进缓存后会快一些。

> **两条容易踩的坑**
> 1. `GITHUB_TOKEN` 默认权限不够时推包会 403：到 `Settings → Actions → General → Workflow permissions` 选 **Read and write permissions**（本仓库已改为该设置）。
> 2. 仓库名含大写时 GHCR 会报 invalid reference：工作流已用 `${GITHUB_REPOSITORY,,}` 转小写，但 `.env` 里的 `IMAGE_NAMESPACE` 必须自己也写小写。

### 5.3 GHCR 包可见性与服务器拉取

首次发布后，在 GitHub 个人主页（或组织）`Packages` 里能看到 `blog/backend`、`blog/frontend` 两个包。

| 方案 | 服务器操作 | 适用 |
| ---- | ---- | ---- |
| 私有包（默认） | `docker login ghcr.io -u <user> --password-stdin`，PAT 勾 `read:packages`；建议每 90 天轮换 | 推荐，镜像不公开 |
| 公开包 | 无需登录；`Package settings → Change visibility → Public` | 开源、图省事 |

> 中国大陆 ECS 拉 `ghcr.io` 偶尔慢或超时，处理方式：
> - 重试 `docker compose pull`，或先用 `docker pull` 单独拉两个镜像；
> - 在 Actions 里同时推一份到阿里云 ACR，服务器从 ACR 拉（附录 C，最稳）；
> - 不要在服务器上配置 `registry-mirrors` 来加速 GHCR，它只对 Docker Hub 生效。

### 5.4 自动部署（可选）

默认**关闭**：Actions 只产出镜像，服务器用 `./deploy/deploy.sh` 手动发布。想开自动部署按下面配置。

1. 生成专用 SSH 密钥（本地 Git Bash / macOS / WSL）：

   ```bash
   ssh-keygen -t ed25519 -C "github-actions-blog" -f ~/.ssh/blog_deploy -N ""
   ssh-copy-id -i ~/.ssh/blog_deploy.pub deploy@<ECS 公网 IP>
   ```

2. 仓库 Secrets（`Settings → Secrets and variables → Actions → Secrets`）：

   | Secret | 值 |
   | ---- | ---- |
   | `SSH_HOST` | ECS 公网 IP 或域名 |
   | `SSH_USER` | `deploy` |
   | `SSH_PRIVATE_KEY` | `cat ~/.ssh/blog_deploy` 的完整内容（含 BEGIN/END 行） |
   | `SSH_PORT` | 可选，默认 22 |

3. 仓库 Variables：`ENABLE_AUTO_DEPLOY=true`。

4. 可选卡点：`Settings → Environments → New environment → production`，配置 Required reviewers，发布前需人工批准。

开启后：`master` 的镜像推送成功 → Actions 通过 SSH 执行

```bash
cd /opt/blog
git fetch --prune origin master
git reset --hard FETCH_HEAD
IMAGE_TAG=sha-xxxxxxx ./deploy/deploy.sh
```

> 注意：自动部署会**硬重置**服务器仓库，别在 `/opt/blog` 里留未提交改动。
> 生产环境更稳的做法是保持自动部署关闭，发布时人工确认一次 `./deploy/deploy.sh`。

### 5.5 发布节奏与回滚

```bash
# 日常开发：只跑 CI + dev 镜像
git checkout dev
git push origin dev

# 发布：dev → master（PR 或本地 merge）
git checkout master
git merge --no-ff dev
git push origin master        # 触发 release：master / latest / sha-xxx

# 可选：打语义化版本（只出镜像，不触发自动部署）
git tag v1.0.0
git push origin v1.0.0
```

回滚见 7.2：用 `sha-xxxxxxx` 重新发布即可，镜像带 tag 不会被 `image prune` 清掉。

> 想在正式发布前先看 `dev` 的效果，可临时 `IMAGE_TAG=dev ./deploy/deploy.sh`（验证完记得发回 `latest`）。
> 注意 `latest` 只跟随 `master`：如果 `master` 落后于 `dev`，先合并再发布，否则线上还是旧版本。

---

## 6. 宿主机 Nginx + HTTPS

### 6.1 安装与站点配置

```bash
sudo apt-get install -y nginx
sudo systemctl enable --now nginx

cd /opt/blog
# 把 __DOMAIN__ 换成你的域名后写入 sites-available
sudo sed "s/__DOMAIN__/blog.example.com/g" deploy/nginx/blog.conf.template \
  | sudo tee /etc/nginx/sites-available/blog.conf >/dev/null

sudo ln -sf /etc/nginx/sites-available/blog.conf /etc/nginx/sites-enabled/blog.conf
sudo rm -f /etc/nginx/sites-enabled/default

sudo nginx -t
sudo systemctl reload nginx
```

模板做的事：

- `location /` → `127.0.0.1:8081`（frontend 容器 Nginx，SPA + `/api`）；
- `location ^~ /files/` → `127.0.0.1:9000/`，**去掉 `/files/` 前缀**后转发给对象存储。后端按 `{PUBLIC_BASE_URL}/files/{bucket}/{key}` 拼接图片地址，S3 是 path-style，所以代理要剥前缀；同时 `limit_except GET` 禁止匿名写操作；
- `client_max_body_size 10m`（后端单文件 5MB，留余量）；上传链路是 浏览器 → 宿主机 Nginx → frontend 容器 Nginx → backend，两处 Nginx 都限制 10m。

> 如果你改了 `.env` 里的 `FRONTEND_HOST_PORT` / `OBJECTSTORE_HOST_PORT`，记得同步改 Nginx 模板里的 `127.0.0.1:8081` / `127.0.0.1:9000`。

### 6.2 申请证书

```bash
# 先确认 DNS 已生效
dig +short blog.example.com

sudo apt-get install -y certbot python3-certbot-nginx

sudo certbot --nginx -d blog.example.com \
  --redirect --agree-tos -m you@example.com --no-eff-email

# 自动续期由 systemd timer 负责，验证一下
systemctl list-timers | grep certbot
sudo certbot renew --dry-run
```

certbot 会自动：

- 申请 Let's Encrypt 证书（90 天）；
- 往 `sites-available/blog.conf` 里补 `listen 443 ssl`、证书路径；
- 加 80 → 443 跳转（`--redirect`）。

阿里云免费证书也可以手动配：下载 Nginx 格式证书到 `/etc/nginx/ssl/`，在 server 块里加 `ssl_certificate` / `ssl_certificate_key`，这里不展开。

### 6.3 验证

```bash
curl -I http://blog.example.com/           # 301 → https
curl -I https://blog.example.com/          # 200
curl -I https://blog.example.com/api/articles?page=1&size=1   # 200 JSON
curl -I https://blog.example.com/files/blog/<objectKey>       # 200 image/png，且 Cache-Control 30 天
echo | openssl s_client -connect blog.example.com:443 -servername blog.example.com 2>/dev/null | openssl x509 -noout -dates
```

---

## 7. 日常运维

### 7.1 更新发布（手动）

```bash
cd /opt/blog
git fetch --prune origin master
git reset --hard FETCH_HEAD        # 仅同步部署文件（compose/sql/脚本）
./deploy/deploy.sh                 # 用 .env 的 IMAGE_TAG（默认 latest）
```

只更新某一个服务时也可以直接：

```bash
docker compose -f docker-compose.prod.yml --env-file .env pull backend
docker compose -f docker-compose.prod.yml --env-file .env up -d backend
docker compose -f docker-compose.prod.yml --env-file .env up -d --no-deps --force-recreate frontend
# ↑ 必须重建 frontend：它的 nginx 缓存了 backend 的容器 IP
```

### 7.2 回滚

```bash
# 1) 查可用版本（每次构建都有 sha-xxxxxxx）
docker compose -f docker-compose.prod.yml --env-file .env images

# 2) 回滚到某个 sha（deploy.sh 第一个参数即 IMAGE_TAG）
./deploy/deploy.sh sha-1a2b3c4

# 3) 或写进 .env 固化：IMAGE_TAG=sha-1a2b3c4 后 ./deploy/deploy.sh
```

> 回滚只回退镜像，**不会回退数据库**。如果新版本执行了破坏性迁移，需要先恢复备份（7.5）再回滚。

### 7.3 日志与状态

```bash
cd /opt/blog
COMPOSE="docker compose -f docker-compose.prod.yml --env-file .env"

$COMPOSE ps
$COMPOSE logs -f --tail=200 backend
$COMPOSE logs --since 30m frontend
$COMPOSE logs mysql | grep -i "ready for connections"

docker stats --no-stream
docker system df
journalctl -u docker --since today | tail -100
```

日志已按容器轮转（单文件 10MB × 3），长期看日志用 `journalctl` 或接入阿里云日志服务。

### 7.4 数据库迁移

`sql/init.sql` 只在**空数据卷**首次启动时执行；之后的表结构变更都是手动执行 `sql/upgrade-*.sql`，**发布前先备份**：

```bash
cd /opt/blog
docker compose -f docker-compose.prod.yml --env-file .env exec -T mysql \
  sh -c 'exec mysql -uroot -p"$MYSQL_ROOT_PASSWORD" blog' < sql/upgrade-2026-11-p1-community.sql
```

顺序建议：备份 → 执行 SQL → 再发布新镜像。全新环境直接 `up` 即可（`init.sql` 已包含全部变更）。

### 7.5 备份与恢复

```bash
# 备份目录（deploy 用户可写）
sudo install -d -m 700 -o deploy -g deploy /var/backups/blog

cd /opt/blog && ./deploy/backup.sh
# 输出：
#   /var/backups/blog/mysql-20261103-030000.sql.gz
#   /var/backups/blog/objectstore-20261103-030000.tar.gz
```

每天 03:00 定时（`crontab -e`，用 deploy 用户）：

```cron
0 3 * * * cd /opt/blog && ./deploy/backup.sh >> /var/log/blog-backup.log 2>&1
```

恢复 MySQL：

```bash
gunzip -c /var/backups/blog/mysql-20261103-030000.sql.gz \
  | docker compose -f docker-compose.prod.yml --env-file .env exec -T mysql \
      sh -c 'exec mysql -uroot -p"$MYSQL_ROOT_PASSWORD"'
```

恢复对象存储（会覆盖卷内容，先停相关服务）：

```bash
docker compose -f docker-compose.prod.yml --env-file .env stop backend objectstore
docker run --rm -i -v blog-prod_objectstore-data:/data alpine:3.20 \
  sh -c 'tar xzf - -C /data' < /var/backups/blog/objectstore-20261103-030000.tar.gz
docker compose -f docker-compose.prod.yml --env-file .env up -d objectstore backend frontend
```

备份要落到**另一块盘或对象存储**才算数：可再用 `ossutil` / `rclone` 把 `/var/backups/blog` 同步到阿里云 OSS，并定期做一次恢复演练。

### 7.6 监控、磁盘与重启

- 站点可用性：阿里云云监控「站点监控」或自建 Uptime Kuma，探测 `https://<域名>/` 与 `/api/articles?page=1&size=1`。
- 资源：`docker stats`、`df -h`、`free -h`；内存吃紧就调大实例或下调 compose 的 `deploy.resources.limits`。
- 磁盘：`docker system df`；镜像/构建缓存增长时 `docker image prune -f`（不要 `-a`，会删掉回滚用的 tag）、`docker builder prune -f`。
- 重启：`sudo reboot` 后 Docker 自动拉起 `restart: unless-stopped` 的容器；用 `$COMPOSE ps` 复核。`sudo systemctl restart docker` 也会按策略恢复容器。

### 7.7 编排内外的配置边界

| 配置 | 位置 | 改完怎么生效 |
| ---- | ---- | ---- |
| 密码 / JWT / 域名 / 镜像 tag | `/opt/blog/.env` | `./deploy/deploy.sh`（JWT 变更会让所有用户重新登录） |
| 端口 / 内存限制 / 日志 | `docker-compose.prod.yml` | `git pull` 后 `./deploy/deploy.sh` |
| Nginx / 证书 | `/etc/nginx/sites-available/blog.conf` | `sudo nginx -t && sudo systemctl reload nginx` |
| 表结构 | `sql/upgrade-*.sql` | 手动执行（7.4） |

---

## 8. 故障排查

| 现象 | 常见原因 | 处理 |
| ---- | ---- | ---- |
| `docker compose pull` 401 / denied | GHCR 包私有但没登录，或 PAT 过期/缺 `read:packages` | 重新 `docker login ghcr.io`；或把包设为 Public |
| 拉 `ghcr.io` 超时 | 国内网络到 GHCR 不稳定 | 重试；或按附录 C 同时推阿里云 ACR 后从 ACR 拉 |
| `compose config` 报 `MYSQL_ROOT_PASSWORD is required` | `.env` 必填项为空 | 按 4.1 填全；`docker compose --env-file .env config -q` 自检 |
| 启动后站点 502 | backend 未健康 / frontend 缓存了旧 backend IP | `$COMPOSE ps`、`logs backend`；执行 `--force-recreate frontend`（deploy.sh 已自动做） |
| 80 端口被占用 | 宿主机已有 nginx/apache，或本地 dev 栈在跑 | `sudo ss -lntp \| grep :80`；停掉多余服务 |
| 上传图片 413 | Nginx `client_max_body_size` 或后端 multipart 限制 | 宿主机/容器 Nginx 都设 10m；后端单文件上限 5MB 是业务限制 |
| 图片 404 | `MINIO_PUBLIC_ENDPOINT` 不对、`/files/` 反代没配、objectstore 没起 | 对比容器内 URL 与 Nginx 模板；`$COMPOSE ps`、`logs objectstore` |
| 图片 403 | bucket 不是公共读 / 策略设置失败 | 看 backend 日志 `MinIO bucket [...] 初始化完成（公共读）`；必要时重建卷 |
| 首次启动 MySQL 没建表 | 数据卷非空，`init.sql` 被跳过 | `logs mysql` 找 `Ignoring`；空卷重来：`$COMPOSE down -v`（**会删数据**） |
| admin 密码不对 | 库里已有 ADMIN 用户，`ADMIN_PASSWORD` 不再生效 | 用旧密码；或改库/删该用户后重启 backend |
| 改了 `JWT_SECRET` 后全部掉登录 | 旧 token 验签失败（预期） | 重新登录即可；如需平滑切换需做双密钥过渡（未实现） |
| 分享卡片中文变方块 | 后端运行镜像缺中文字体 | 不要改回 alpine 基础镜像；`backend/Dockerfile` 已装 `fonts-noto-cjk` |
| 时区差 8 小时 | 容器 `TZ` / MySQL `default-time-zone` 不一致 | 检查 `.env` 的 `TZ=Asia/Shanghai`；MySQL 已固定 `+08:00` |
| backend 反复 unhealthy | 连不上 MySQL/Redis，或 JWT_SECRET 太短 | `logs backend`；确认 `MYSQL_HOST=mysql` 等内部变量没被覆盖 |
| `docker compose` 不认子命令 | 只装了旧版 `docker-compose` | 安装 `docker-compose-plugin`（3.2 节） |
| 部署脚本 Permission denied | 执行位丢了（从 Windows 拷贝/解压） | `chmod +x deploy/*.sh`；或 `git update-index --chmod=+x deploy/*.sh` |
| 磁盘满导致容器异常 | 镜像/日志/备份堆积 | `docker system df`；清理悬空镜像与旧备份；`df -h` |

---

## 9. 安全清单（上线前逐条确认）

- [ ] `.env` 里 **MySQL root / 对象存储 / 管理员 / JWT** 全部换成随机值，没有沿用仓库示例（`.env.example` 的值只用于本地开发）。
- [ ] `chmod 600 .env`，且 `.env` 从未进过 Git（`.gitignore` 已忽略）。
- [ ] 安全组只放行 22 / 80 / 443；22 限制来源 IP。
- [ ] SSH 改密钥登录、禁用 root 密码登录；安装 fail2ban（可选）。
- [ ] 3306 / 6379 / 8080 / 9000 / 9001 不对公网发布（本编排已保证，且不要额外加端口映射）。
- [ ] HTTPS 生效、自动续期验证通过；必要时加 HSTS（确认全站 https 后再加）。
- [ ] GHCR 用私有包 + 最小权限 PAT；或公开包但确认镜像不含密钥（镜像里只有代码和配置，不含 `.env`）。
- [ ] 定期更新基础镜像（`docker compose pull` 后重建），关注 MySQL/Redis/Nginx 安全公告。
- [ ] 备份任务在跑、备份文件在另一块盘/OSS、做过至少一次恢复演练。
- [ ] 阿里云账号开启 MFA，ECS 快照策略按需开启。

---

## 附录 A：生产环境变量

| 变量 | 默认 | 必填 | 说明 |
| ---- | ---- | ---- | ---- |
| `IMAGE_NAMESPACE` | — | ✅ | 如 `ghcr.io/fullofstar-p/blog`，小写 |
| `IMAGE_TAG` | `latest` | | `latest` / `dev` / `master` / `sha-xxxxxxx` / `v1.0.0` |
| `OBJECTSTORE_IMAGE` | `rustfs/rustfs:latest` | | 可换成自备 S3 兼容镜像 |
| `TZ` | `Asia/Shanghai` | | 所有容器时区 |
| `PUBLIC_BASE_URL` | — | ✅ | `https://blog.example.com`，图片 URL 前缀 |
| `FRONTEND_HOST_PORT` | `8081` | | 只绑 `127.0.0.1` |
| `OBJECTSTORE_HOST_PORT` | `9000` | | 只绑 `127.0.0.1` |
| `MYSQL_ROOT_PASSWORD` | — | ✅ | 首次启动固化 |
| `MYSQL_DATABASE` | `blog` | | `sql/init.sql` 中库名固定为 `blog` |
| `MINIO_ROOT_USER` / `MINIO_ROOT_PASSWORD` | — | ✅ | S3 access/secret key |
| `MINIO_BUCKET` | `blog` | | 后端启动时自动创建 |
| `JWT_SECRET` | — | ✅ | ≥ 64 随机字符 |
| `JWT_ACCESS_EXPIRE` / `JWT_REFRESH_EXPIRE` | `7200` / `604800` | | 秒 |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | `admin` / — | ✅ | 仅在无 ADMIN 用户时创建 |
| `BLOG_SITE_NAME` | `技术分享博客` | | 分享卡片底部站点名 |

## 附录 B：常用命令

```bash
cd /opt/blog
COMPOSE="docker compose -f docker-compose.prod.yml --env-file .env"

$COMPOSE ps                       # 状态
$COMPOSE logs -f --tail=200       # 全部日志
$COMPOSE pull && ./deploy/deploy.sh
$COMPOSE images                   # 当前镜像与 tag
$COMPOSE exec backend sh          # 进后端容器
$COMPOSE exec mysql sh            # 进 MySQL 容器
$COMPOSE restart backend          # 只重启后端
$COMPOSE down                     # 停止（保留数据卷）
$COMPOSE down -v                  # 停止并删除数据卷（危险）

docker exec blog-prod-backend wget -qO- http://127.0.0.1:8080/actuator/health
docker exec blog-prod-frontend wget -qO- http://127.0.0.1/
sudo tail -f /var/log/nginx/error.log
```

## 附录 C：改用阿里云 ACR 拉镜像（可选，国内更稳）

GHCR 在国内偶尔慢。如果服务器拉取困难，可以让 Actions 同时推一份到阿里云容器镜像服务 ACR（个人版免费），服务器从 ACR 拉：

1. 在 ACR 控制台创建个人版实例、命名空间（如 `blog`）、镜像仓库 `backend`/`frontend`；
2. 服务器登录：`docker login registry.cn-hangzhou.aliyuncs.com -u <阿里云账号>`（密码用 ACR 的固定密码）；
3. 在 [release.yml](../.github/workflows/release.yml) 的 `images` job 里增加 ACR 登录步骤，并把镜像地址再加一条 tag（示例）：

   ```yaml
   - name: 登录阿里云 ACR
     uses: docker/login-action@v3
     with:
       registry: registry.cn-hangzhou.aliyuncs.com
       username: ${{ secrets.ACR_USERNAME }}
       password: ${{ secrets.ACR_PASSWORD }}
   ```

   同时把 `docker/metadata-action` 的 `images` 改成多行（GHCR + ACR），或用一个额外的 `docker tag && docker push` 步骤；
4. 服务器 `.env` 改成 `IMAGE_NAMESPACE=registry.cn-hangzhou.aliyuncs.com/<命名空间>`，`docker compose pull` 即走 ACR。

## 附录 D：改用阿里云 OSS 作为对象存储（可选）

后端只依赖 S3 API，可以把 `objectstore` 容器换成 OSS：

1. 创建 Bucket（读权限设为公共读，或用自定义域名/CDN），创建 RAM 用户并只授予该 Bucket 的 `oss:GetObject` / `oss:PutObject` / `oss:DeleteObject`；
2. `.env` 增加/修改：

   ```dotenv
   MINIO_ENDPOINT=https://oss-cn-hangzhou.aliyuncs.com
   MINIO_ACCESS_KEY=<RAM AccessKeyId>
   MINIO_SECRET_KEY=<RAM AccessKeySecret>
   MINIO_REGION=oss-cn-hangzhou
   MINIO_BUCKET=<bucket 名>
   MINIO_PUBLIC_ENDPOINT=https://oss-cn-hangzhou.aliyuncs.com
   ```

3. 从 `docker-compose.prod.yml` 删掉 `objectstore` 服务和对应的 `depends_on`、`volumes`；Nginx 模板里的 `/files/` 也可以删掉（图片直链直接走 OSS 域名）。

注意：后端启动时的 `MinioInitializer` 会尝试给 Bucket 设置 AWS 风格的公共读策略，OSS 的策略语法不同，日志里可能出现策略设置失败告警（不影响上传/读取，公共读请在 OSS 控制台配置）。`MINIO_PUBLIC_ENDPOINT` 用 OSS 服务域名时，图片地址是 `https://oss-cn-hangzhou.aliyuncs.com/<bucket>/<key>`，必须保证 Bucket 公共读。

## 附录 E：常见运维问题补充

- **单机没有零停机**：`--force-recreate frontend` 会产生 1–2 秒 502；要求零停机需要多副本 + 负载均衡（当前单机编排不提供）。
- **对象存储数据卷在系统盘**：图片多的站点建议挂数据盘到 `/var/lib/docker` 或用 OSS，避免系统盘被写满。
- **改 `.env` 端口不生效**：compose 端口映射变更需要 `up -d` 重建对应容器；只 `restart` 不重新读 `.env`。
- **想恢复“全新初始化”**：`$COMPOSE down -v` 会删 mysql/redis/objectstore 数据卷，再 `./deploy/deploy.sh` 会重新执行 `init.sql`；生产环境操作前务必先备份。

## 附录 F：对象存储公共读自检（RustFS / MinIO）

后端启动时 `MinioInitializer` 会创建 bucket 并写入「公共读」bucket policy。日志里出现下面这行才算初始化成功：

```bash
cd /opt/blog
docker compose -f docker-compose.prod.yml --env-file .env logs backend | grep "初始化完成（公共读）"
```

RustFS 实现了 `PutBucketPolicy` / `GetBucketPolicy` 等标准接口（[官方文档](https://docs.rustfs.com.cn/zh/administration/data/bucket/policy)），但 Bucket 如果开了「公共访问阻止（BlockPublicPolicy）」，通配符 Principal 的策略会被拒绝，图片直链就会 403。用一次真实上传的 objectKey 自检（绕过 Nginx 直接打对象存储）：

```bash
docker compose -f docker-compose.prod.yml --env-file .env exec -T backend \
  wget -S -O /dev/null http://objectstore:9000/blog/<objectKey> 2>&1 | head -5
```

如果返回 403 / 策略未生效：

1. 临时打开 RustFS 控制台：把 `docker-compose.prod.yml` 里 `RUSTFS_CONSOLE_ENABLE` 改成 `"true"`，并临时加一行端口 `"127.0.0.1:9001:9001"`，然后 `docker compose -f docker-compose.prod.yml --env-file .env up -d objectstore`；
2. 本地 `ssh -L 9001:127.0.0.1:9001 deploy@<ECS IP>`，浏览器打开 `http://127.0.0.1:9001`，在 Bucket 的 Policy / Public Access 设置里允许匿名 `s3:GetObject`（或关闭 Public Access Block）；
3. 改回 `"false"`、删掉 9001 端口映射，再 `up -d objectstore`。

等价策略 JSON（后端自动写入的就是这个语义）：

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": "*",
      "Action": ["s3:GetObject"],
      "Resource": ["arn:aws:s3:::blog/*"]
    }
  ]
}
```

如果换成自备 MinIO 镜像（`OBJECTSTORE_IMAGE=<你的镜像>`），行为与本地开发一致，一般不需要手动处理。

