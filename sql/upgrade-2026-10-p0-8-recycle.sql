-- ----------------------------------------------------------------------------
-- P0-8 回收站：增量升级脚本（MySQL 8）
--
-- 全新初始化（sql/init.sql）已包含 `deleted_time` 字段与索引；
-- 已经在用的数据库执行本脚本一次即可。
-- ----------------------------------------------------------------------------
ALTER TABLE `article`
  ADD COLUMN `deleted_time` DATETIME DEFAULT NULL COMMENT '删除时间（回收站；NULL 表示未删除）' AFTER `deleted`;

ALTER TABLE `article`
  ADD KEY `idx_article_deleted_time` (`deleted`, `deleted_time`);
