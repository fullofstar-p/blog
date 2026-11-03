#!/usr/bin/env bash
# ============================================================================
# 技术分享博客 · 服务器端发布脚本（阿里云 Ubuntu 24.04 + Docker Compose）
#
# 做的事：校验 compose 配置 → 拉取 GHCR 镜像 → 重建容器 → 等健康检查 → 清理悬空镜像。
# 不负责：git pull（交给 GitHub Actions 或手动执行）、Nginx 证书（见 docs/DEPLOY.md）。
#
# 用法（仓库根目录）：
#   ./deploy/deploy.sh                  # 用 .env 里的 IMAGE_TAG（默认 latest）
#   ./deploy/deploy.sh sha-1a2b3c4      # 指定版本，可用于回滚
#   IMAGE_TAG=dev ./deploy/deploy.sh    # 临时发布 dev 标签
#
# 环境变量：
#   COMPOSE_FILE  默认 docker-compose.prod.yml
#   ENV_FILE      默认 .env
# ============================================================================
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
ENV_FILE="${ENV_FILE:-.env}"
BACKEND_CONTAINER="blog-prod-backend"
FRONTEND_CONTAINER="blog-prod-frontend"

cd "$REPO_DIR"

log() { printf '\033[1;32m[deploy]\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[deploy]\033[0m %s\n' "$*"; }
die() { printf '\033[1;31m[deploy]\033[0m %s\n' "$*" >&2; exit 1; }

usage() {
  sed -n '2,20p' "$0" | sed 's/^# \{0,1\}//'
  exit 0
}

case "${1:-}" in
  -h|--help) usage ;;
esac

[[ $# -le 1 ]] || die "参数过多。用法：$0 [镜像tag]"

[[ -f "$COMPOSE_FILE" ]] || die "未找到 $COMPOSE_FILE（请在仓库根目录执行）"
[[ -f "$ENV_FILE" ]] || die "未找到 $ENV_FILE：先 cp .env.prod.example .env 并填写密码"

# 可选：第一个参数指定镜像 tag，覆盖 .env 里的 IMAGE_TAG（便于回滚）
if [[ -n "${1:-}" ]]; then
  export IMAGE_TAG="$1"
  log "本次发布使用镜像 tag：$IMAGE_TAG"
else
  log "本次发布使用 .env 里的 IMAGE_TAG（默认 latest）"
fi

command -v docker >/dev/null 2>&1 || die "未安装 Docker，见 docs/DEPLOY.md 第 3 节"
docker compose version >/dev/null 2>&1 || die "未安装 Docker Compose v2 插件（docker-compose-plugin）"

perm="$(stat -c %a "$ENV_FILE" 2>/dev/null || echo '')"
if [[ -n "$perm" && "$perm" != "600" ]]; then
  warn "建议执行 chmod 600 $ENV_FILE（当前权限 $perm，内含数据库/JWT 密码）"
fi

COMPOSE=(docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE")

log "校验 compose 配置 ..."
"${COMPOSE[@]}" config -q

log "拉取业务镜像（backend / frontend）..."
# 只拉业务镜像：避免每次部署顺带升级 mysql / redis / rustfs 的 latest，
# 基础设施镜像需要升级时手动 docker compose pull mysql redis objectstore。
"${COMPOSE[@]}" pull backend frontend

log "启动 / 更新容器 ..."
"${COMPOSE[@]}" up -d --remove-orphans

# 前端容器的 nginx 在启动时解析 backend 的容器 IP 并缓存；
# backend 被重建后 IP 会变，必须强制重建 frontend，否则 /api 会 502。
log "重建 frontend 以刷新 backend 的容器 DNS 解析 ..."
"${COMPOSE[@]}" up -d --no-deps --force-recreate frontend

# 等待容器健康或运行（每 3 秒检查一次，共 timeout 次）
wait_ready() {
  local name="$1" timeout="$2" i status
  for ((i = 0; i < timeout; i++)); do
    status="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$name" 2>/dev/null || echo missing)"
    case "$status" in
      healthy|running) return 0 ;;
      unhealthy|missing|exited|dead) : ;;
    esac
    sleep 3
  done
  return 1
}

log "等待 backend 健康检查（最长约 3 分钟，首次启动会执行建库建表）..."
if ! wait_ready "$BACKEND_CONTAINER" 60; then
  "${COMPOSE[@]}" logs --tail=100 backend || true
  die "backend 未在预期时间内就绪，请查看上面的日志"
fi

log "等待 frontend 就绪 ..."
if ! wait_ready "$FRONTEND_CONTAINER" 20; then
  "${COMPOSE[@]}" logs --tail=50 frontend || true
  die "frontend 未在预期时间内就绪"
fi

# 宿主机本地探活（容器端口只绑 127.0.0.1，不经过公网）
local_port="$(awk -F= '/^FRONTEND_HOST_PORT=/{print $2; exit}' "$ENV_FILE" 2>/dev/null | tr -d '[:space:]')"
local_port="${local_port:-8081}"
if command -v curl >/dev/null 2>&1; then
  ok=0
  for _ in 1 2 3 4 5; do
    if curl -fsS -o /dev/null "http://127.0.0.1:${local_port}/"; then
      log "本地探活通过：http://127.0.0.1:${local_port}/"
      ok=1
      break
    fi
    sleep 3
  done
  [[ "$ok" -eq 1 ]] || warn "本地探活未通过（http://127.0.0.1:${local_port}/），请检查宿主机 Nginx 是否已配置"
fi

log "清理悬空镜像（保留带 tag 的历史镜像，便于回滚）..."
docker image prune -f >/dev/null || true

log "本次运行镜像："
"${COMPOSE[@]}" images | sed 's/^/    /'

log "容器状态："
"${COMPOSE[@]}" ps

log "发布完成。查看日志："
log "  docker compose -f $COMPOSE_FILE --env-file $ENV_FILE logs -f --tail=100 backend"
