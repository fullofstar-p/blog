-- ============================================================================
-- 技术分享博客 · 增量升级：P1-1 评论楼中楼/通知、P1-2 点赞收藏
--
-- 适用：已有库（执行一次即可）
--   mysql -h <host> -uroot -p blog < sql/upgrade-2026-11-p1-community.sql
--
-- 说明：
-- 1. 不删除、不清空任何现有数据；
-- 2. comment 已有数据会按 parent_id 回填 root_id / reply_to_user_id / depth；
-- 3. 新表使用 IF NOT EXISTS，重复执行时只有 ALTER 会报“列已存在”，
--    此时说明已升级过，无需再次执行。
-- ============================================================================

USE `blog`;

SET NAMES utf8mb4;

-- ----------------------------------------------------------------------------
-- 1. article：点赞/收藏冗余计数
-- ----------------------------------------------------------------------------
ALTER TABLE `article`
  ADD COLUMN `like_count`     INT NOT NULL DEFAULT 0 COMMENT '点赞数' AFTER `view_count`,
  ADD COLUMN `favorite_count` INT NOT NULL DEFAULT 0 COMMENT '收藏数' AFTER `like_count`;

-- ----------------------------------------------------------------------------
-- 2. comment：楼中楼字段
--    parent_id 语义改为“直接父评论 ID”；root_id 指向楼层根评论
-- ----------------------------------------------------------------------------
ALTER TABLE `comment`
  ADD COLUMN `root_id`          BIGINT  DEFAULT NULL COMMENT '楼中楼根评论 ID' AFTER `parent_id`,
  ADD COLUMN `reply_to_user_id` BIGINT  DEFAULT NULL COMMENT '被回复用户 ID' AFTER `root_id`,
  ADD COLUMN `depth`            TINYINT NOT NULL DEFAULT 0 COMMENT '嵌套层级：0 为一级，最多 4' AFTER `reply_to_user_id`,
  ADD KEY `idx_comment_root` (`root_id`),
  ADD KEY `idx_comment_article_status_time` (`article_id`, `status`, `create_time`);

-- 回填历史评论：一级评论 root_id=自身；回复 root_id=父评论的 root_id（旧数据父级必为根）
UPDATE `comment` c
LEFT JOIN `comment` p ON p.id = c.parent_id
SET c.root_id = COALESCE(p.root_id, c.parent_id, c.id),
    c.reply_to_user_id = p.user_id,
    c.depth = IF(c.parent_id IS NULL, 0, 1)
WHERE c.root_id IS NULL;

-- ----------------------------------------------------------------------------
-- 3. 站内通知
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `notification` (
  `id`          BIGINT       NOT NULL AUTO_INCREMENT COMMENT '主键',
  `user_id`     BIGINT       NOT NULL COMMENT '接收人 ID',
  `type`        VARCHAR(20)  NOT NULL COMMENT 'COMMENT 评论 / REPLY 回复 / COMMENT_AUDIT 审核',
  `title`       VARCHAR(120) NOT NULL COMMENT '通知标题',
  `content`     VARCHAR(500) DEFAULT NULL COMMENT '通知内容摘要',
  `article_id`  BIGINT       DEFAULT NULL COMMENT '关联文章 ID',
  `comment_id`  BIGINT       DEFAULT NULL COMMENT '关联评论 ID',
  `sender_id`   BIGINT       DEFAULT NULL COMMENT '触发人 ID',
  `is_read`     TINYINT      NOT NULL DEFAULT 0 COMMENT '0 未读 / 1 已读',
  `create_time` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  KEY `idx_notification_user_read` (`user_id`, `is_read`, `create_time`),
  KEY `idx_notification_article` (`article_id`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = '站内通知';

-- ----------------------------------------------------------------------------
-- 4. 文章点赞 / 收藏
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `article_like` (
  `id`          BIGINT   NOT NULL AUTO_INCREMENT COMMENT '主键',
  `article_id`  BIGINT   NOT NULL COMMENT '文章 ID',
  `user_id`     BIGINT   NOT NULL COMMENT '用户 ID',
  `create_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '点赞时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_article_like` (`article_id`, `user_id`),
  KEY `idx_article_like_user` (`user_id`, `create_time`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = '文章点赞';

CREATE TABLE IF NOT EXISTS `article_favorite` (
  `id`          BIGINT   NOT NULL AUTO_INCREMENT COMMENT '主键',
  `article_id`  BIGINT   NOT NULL COMMENT '文章 ID',
  `user_id`     BIGINT   NOT NULL COMMENT '用户 ID',
  `create_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '收藏时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_article_favorite` (`article_id`, `user_id`),
  KEY `idx_article_favorite_user` (`user_id`, `create_time`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = '文章收藏';
