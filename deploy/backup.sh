#!/usr/bin/env bash
# ============================================================================
# 技术分享博客 · 生产备份脚本（MySQL + 对象存储数据卷）
#
# 用法（服务器仓库根目录）：
#   ./deploy/backup.sh
#   BACKUP_DIR=/data/backups KEEP_DAYS=30 ./deploy/backup.sh
#
# 建议放进 deploy 用户的 crontab（见 docs/DEPLOY.md 第 7.5 节）：
#   0 3 * * * cd /opt/blog && ./deploy/backup.sh >> /var/log/blog-backup.log 2>&1
#
# 环境变量：
#   COMPOSE_FILE       默认 docker-compose.prod.yml
#   ENV_FILE           默认 .env
#   BACKUP_DIR         默认 /var/backups/blog
#   KEEP_DAYS          默认 14 天
#   OBJECTSTORE_VOLUME 默认 blog-prod_objectstore-data
# ============================================================================
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_DIR"

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
ENV_FILE="${ENV_FILE:-.env}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/blog}"
KEEP_DAYS="${KEEP_DAYS:-14}"
OBJECTSTORE_VOLUME="${OBJECTSTORE_VOLUME:-blog-prod_objectstore-data}"
TS="$(date +%Y%m%d-%H%M%S)"

log() { printf '[backup] %s\n' "$*"; }
die() { printf '[backup] %s\n' "$*" >&2; exit 1; }

[[ -f "$COMPOSE_FILE" ]] || die "未找到 $COMPOSE_FILE"
[[ -f "$ENV_FILE" ]] || die "未找到 $ENV_FILE"
command -v docker >/dev/null 2>&1 || die "未安装 docker"

COMPOSE=(docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE")
mkdir -p "$BACKUP_DIR"

log "备份目录：$BACKUP_DIR"

# ---------------------------------------------------------------------------
# 1) MySQL：--single-transaction 保证 InnoDB 一致性快照，不锁表
# ---------------------------------------------------------------------------
log "导出 MySQL ..."
mysql_dump="$BACKUP_DIR/mysql-$TS.sql.gz"
"${COMPOSE[@]}" exec -T mysql \
  sh -c 'exec mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" --single-transaction --routines --triggers --databases blog' \
  2>/dev/null | gzip > "$mysql_dump"
[[ -s "$mysql_dump" ]] || die "MySQL 备份文件为空：$mysql_dump"
log "  $(du -h "$mysql_dump" | cut -f1)  $mysql_dump"

# ---------------------------------------------------------------------------
# 2) 对象存储：把数据卷打成 tar.gz 输出到标准输出，文件由当前用户持有
# ---------------------------------------------------------------------------
log "备份对象存储数据卷 $OBJECTSTORE_VOLUME ..."
object_dump="$BACKUP_DIR/objectstore-$TS.tar.gz"
docker run --rm -v "$OBJECTSTORE_VOLUME:/data:ro" alpine:3.20 \
  sh -c 'tar czf - -C /data .' > "$object_dump"
[[ -s "$object_dump" ]] || die "对象存储备份文件为空：$object_dump"
log "  $(du -h "$object_dump" | cut -f1)  $object_dump"

# ---------------------------------------------------------------------------
# 3) 清理过期备份
# ---------------------------------------------------------------------------
log "清理超过 $KEEP_DAYS 天的备份 ..."
find "$BACKUP_DIR" -type f -name '*.gz' -mtime +"$KEEP_DAYS" -delete
log "完成。当前备份："
ls -lh "$BACKUP_DIR" | sed 's/^/    /'
