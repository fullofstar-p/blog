-- ============================================================================
-- 技术分享博客 · MySQL 8.0 初始化脚本
-- 由 docker-compose 挂载到 /docker-entrypoint-initdb.d，容器首次初始化时自动执行。
-- 表结构：用户 / 文章 / 分类 / 标签 / 文章标签 / 评论 / 点赞 / 收藏 / 站内通知 / 文件审计
-- 说明：初始管理员账号由后端启动时创建（BCrypt 加密），脚本中不写死密码哈希。
-- ============================================================================

CREATE DATABASE IF NOT EXISTS `blog`
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `blog`;

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ----------------------------------------------------------------------------
-- 用户表
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `user`;
CREATE TABLE `user` (
  `id`          BIGINT       NOT NULL AUTO_INCREMENT COMMENT '主键',
  `username`    VARCHAR(50)  NOT NULL COMMENT '登录名（唯一）',
  `password`    VARCHAR(100) NOT NULL COMMENT 'BCrypt 密码哈希',
  `nickname`    VARCHAR(50)  DEFAULT NULL COMMENT '昵称',
  `avatar`      VARCHAR(500) DEFAULT NULL COMMENT '头像 URL（MinIO）',
  `email`       VARCHAR(100) DEFAULT NULL COMMENT '邮箱',
  `role`        VARCHAR(20)  NOT NULL DEFAULT 'USER' COMMENT '角色：ADMIN / USER',
  `status`      TINYINT      NOT NULL DEFAULT 1 COMMENT '状态：1 启用 / 0 禁用',
  `create_time` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `update_time` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_user_username` (`username`),
  KEY `idx_user_role_status` (`role`, `status`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = '用户表';

-- ----------------------------------------------------------------------------
-- 分类表（文章与分类一对一：一篇文章一个分类）
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `category`;
CREATE TABLE `category` (
  `id`          BIGINT      NOT NULL AUTO_INCREMENT COMMENT '主键',
  `name`        VARCHAR(50) NOT NULL COMMENT '分类名（唯一）',
  `sort`        INT         NOT NULL DEFAULT 0 COMMENT '排序值，越小越靠前',
  `create_time` DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_category_name` (`name`),
  KEY `idx_category_sort` (`sort`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = '分类表';

-- ----------------------------------------------------------------------------
-- 标签表（与文章多对多）
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `tag`;
CREATE TABLE `tag` (
  `id`          BIGINT      NOT NULL AUTO_INCREMENT COMMENT '主键',
  `name`        VARCHAR(50) NOT NULL COMMENT '标签名（唯一）',
  `create_time` DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_tag_name` (`name`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = '标签表';

-- ----------------------------------------------------------------------------
-- 文章表
-- 状态：0 草稿 / 1 已发布；is_top：0 普通 / 1 置顶；deleted：逻辑删除
-- 全文索引使用 MySQL 8 内置 ngram 解析器（中文分词），作为搜索的增强项；
-- 当前 MysqlSearchService 以 LIKE + 权重排序实现，二者可平滑切换。
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `article`;
CREATE TABLE `article` (
  `id`          BIGINT       NOT NULL AUTO_INCREMENT COMMENT '主键',
  `title`       VARCHAR(200) NOT NULL COMMENT '标题',
  `summary`     VARCHAR(500) DEFAULT NULL COMMENT '摘要',
  `content`     LONGTEXT     DEFAULT NULL COMMENT 'Markdown 正文',
  `cover`       VARCHAR(500) DEFAULT NULL COMMENT '封面图 URL（MinIO）',
  `category_id` BIGINT       DEFAULT NULL COMMENT '分类 ID',
  `author_id`   BIGINT       NOT NULL COMMENT '作者 ID',
  `status`      TINYINT      NOT NULL DEFAULT 0 COMMENT '状态：0 草稿 / 1 已发布',
  `is_top`      TINYINT      NOT NULL DEFAULT 0 COMMENT '是否置顶：0 否 / 1 是',
  `view_count`  INT          NOT NULL DEFAULT 0 COMMENT '阅读量（Redis 计数定时落库）',
  `like_count`  INT          NOT NULL DEFAULT 0 COMMENT '点赞数',
  `favorite_count` INT       NOT NULL DEFAULT 0 COMMENT '收藏数',
  `create_time` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `update_time` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `deleted`     TINYINT      NOT NULL DEFAULT 0 COMMENT '逻辑删除：0 正常 / 1 已删除',
  `deleted_time` DATETIME    DEFAULT NULL COMMENT '删除时间（回收站；NULL 表示未删除）',
  PRIMARY KEY (`id`),
  KEY `idx_article_category` (`category_id`),
  KEY `idx_article_author` (`author_id`),
  KEY `idx_article_status_time` (`status`, `create_time`),
  KEY `idx_article_top` (`is_top`),
  KEY `idx_article_deleted_time` (`deleted`, `deleted_time`),
  FULLTEXT KEY `ft_article_ngram` (`title`, `summary`, `content`) WITH PARSER ngram
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = '文章表';

-- ----------------------------------------------------------------------------
-- 文章-标签关联表（多对多）
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `article_tag`;
CREATE TABLE `article_tag` (
  `article_id` BIGINT NOT NULL COMMENT '文章 ID',
  `tag_id`     BIGINT NOT NULL COMMENT '标签 ID',
  PRIMARY KEY (`article_id`, `tag_id`),
  KEY `idx_article_tag_tag` (`tag_id`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = '文章标签关联表';

-- ----------------------------------------------------------------------------
-- 站点每日统计（PV / UV）：由 Redis 增量定时落库
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `site_daily_stat`;
CREATE TABLE `site_daily_stat` (
  `stat_date`   DATE     NOT NULL COMMENT '统计日期',
  `pv`          BIGINT   NOT NULL DEFAULT 0 COMMENT '页面浏览量（PV）',
  `uv`          BIGINT   NOT NULL DEFAULT 0 COMMENT '独立访客（UV，按日去重）',
  `update_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`stat_date`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = '站点每日访问统计';

-- ----------------------------------------------------------------------------
-- 文章每日阅读统计：用于区间热门文章
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `article_daily_stat`;
CREATE TABLE `article_daily_stat` (
  `article_id`  BIGINT   NOT NULL COMMENT '文章 ID',
  `stat_date`   DATE     NOT NULL COMMENT '统计日期',
  `pv`          BIGINT   NOT NULL DEFAULT 0 COMMENT '当日阅读量',
  `update_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`article_id`, `stat_date`),
  KEY `idx_article_daily_date` (`stat_date`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = '文章每日阅读统计';

-- ----------------------------------------------------------------------------
-- 评论表（楼中楼：parent_id 为直接父评论，root_id 为楼层根评论）
-- 状态：0 待审核 / 1 已通过 / 2 已拒绝；depth：0 一级，最多 4（5 层）
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `comment`;
CREATE TABLE `comment` (
  `id`          BIGINT        NOT NULL AUTO_INCREMENT COMMENT '主键',
  `article_id`  BIGINT        NOT NULL COMMENT '文章 ID',
  `user_id`     BIGINT        NOT NULL COMMENT '评论人 ID',
  `parent_id`   BIGINT        DEFAULT NULL COMMENT '直接父评论 ID，NULL 表示一级评论',
  `root_id`     BIGINT        DEFAULT NULL COMMENT '楼中楼根评论 ID',
  `reply_to_user_id` BIGINT   DEFAULT NULL COMMENT '被回复用户 ID',
  `depth`       TINYINT       NOT NULL DEFAULT 0 COMMENT '嵌套层级：0 一级，最多 4',
  `content`     VARCHAR(1000) NOT NULL COMMENT '评论内容',
  `status`      TINYINT       NOT NULL DEFAULT 0 COMMENT '状态：0 待审核 / 1 通过 / 2 拒绝',
  `like_count`  INT           NOT NULL DEFAULT 0 COMMENT '点赞数',
  `create_time` DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  KEY `idx_comment_article_status` (`article_id`, `status`),
  KEY `idx_comment_article_status_time` (`article_id`, `status`, `create_time`),
  KEY `idx_comment_parent` (`parent_id`),
  KEY `idx_comment_root` (`root_id`),
  KEY `idx_comment_user` (`user_id`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = '评论表';

-- ----------------------------------------------------------------------------
-- 文章点赞 / 收藏（Redis 计数之外的持久化关系，唯一键保证幂等）
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `article_like`;
CREATE TABLE `article_like` (
  `id`          BIGINT   NOT NULL AUTO_INCREMENT COMMENT '主键',
  `article_id`  BIGINT   NOT NULL COMMENT '文章 ID',
  `user_id`     BIGINT   NOT NULL COMMENT '用户 ID',
  `create_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '点赞时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_article_like` (`article_id`, `user_id`),
  KEY `idx_article_like_user` (`user_id`, `create_time`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = '文章点赞';

DROP TABLE IF EXISTS `article_favorite`;
CREATE TABLE `article_favorite` (
  `id`          BIGINT   NOT NULL AUTO_INCREMENT COMMENT '主键',
  `article_id`  BIGINT   NOT NULL COMMENT '文章 ID',
  `user_id`     BIGINT   NOT NULL COMMENT '用户 ID',
  `create_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '收藏时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_article_favorite` (`article_id`, `user_id`),
  KEY `idx_article_favorite_user` (`user_id`, `create_time`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = '文章收藏';

-- ----------------------------------------------------------------------------
-- 站内通知：评论/回复/审核结果
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `notification`;
CREATE TABLE `notification` (
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
-- 文件对象审计表（可选，用于记录上传归属，支撑删除鉴权）
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `file_object`;
CREATE TABLE `file_object` (
  `id`            BIGINT       NOT NULL AUTO_INCREMENT COMMENT '主键',
  `object_key`    VARCHAR(255) NOT NULL COMMENT '对象键（随机、不含路径分隔符）',
  `original_name` VARCHAR(255) DEFAULT NULL COMMENT '原始文件名',
  `content_type`  VARCHAR(100) DEFAULT NULL COMMENT 'MIME 类型',
  `size`          BIGINT       DEFAULT 0 COMMENT '文件大小（字节）',
  `uploader_id`   BIGINT       DEFAULT NULL COMMENT '上传人 ID',
  `create_time`   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '上传时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_file_object_key` (`object_key`),
  KEY `idx_file_uploader` (`uploader_id`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = '文件对象审计表';

SET FOREIGN_KEY_CHECKS = 1;

-- ----------------------------------------------------------------------------
-- 初始演示数据：分类与标签（管理员账号由后端 DataInitializer 创建）
-- ----------------------------------------------------------------------------
INSERT IGNORE INTO `category` (`name`, `sort`) VALUES
  ('后端开发', 1),
  ('前端开发', 2),
  ('数据库', 3),
  ('运维部署', 4);

INSERT IGNORE INTO `tag` (`name`) VALUES
  ('Java'),
  ('Spring Boot'),
  ('Vue3'),
  ('Tailwind CSS'),
  ('MySQL'),
  ('Redis'),
  ('Docker'),
  ('MinIO');
