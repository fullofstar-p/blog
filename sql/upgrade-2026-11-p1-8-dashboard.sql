-- ----------------------------------------------------------------------------
-- P1-8 内容看板：增量升级脚本（MySQL 8）
--
-- 新增站点每日 PV/UV 与文章每日阅读统计两张表；
-- sql/init.sql 已同步包含这两张表，全新库无需执行。
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `site_daily_stat` (
  `stat_date`   DATE     NOT NULL COMMENT '统计日期',
  `pv`          BIGINT   NOT NULL DEFAULT 0 COMMENT '页面浏览量（PV）',
  `uv`          BIGINT   NOT NULL DEFAULT 0 COMMENT '独立访客（UV，按日去重）',
  `update_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`stat_date`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = '站点每日访问统计';

CREATE TABLE IF NOT EXISTS `article_daily_stat` (
  `article_id`  BIGINT   NOT NULL COMMENT '文章 ID',
  `stat_date`   DATE     NOT NULL COMMENT '统计日期',
  `pv`          BIGINT   NOT NULL DEFAULT 0 COMMENT '当日阅读量',
  `update_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`article_id`, `stat_date`),
  KEY `idx_article_daily_date` (`stat_date`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = '文章每日阅读统计';
