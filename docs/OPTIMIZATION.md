# 工程优化清单与技术债

> 基线：`dev` 分支 `20b2317`（2026-10-31），覆盖后端、前端、部署与工程化。
> 本文只列「可优化项」，不包含已排期的功能需求（功能路线见 [ROADMAP.md](ROADMAP.md)）。
>
> 优先级：**P0** 稳定性 / 安全 → **P1** 性能 / 可维护性 → **P2** 体验 / 工程化。
> 工作量：**S**（< 1 人日）、**M**（1–3 人日）、**L**（> 3 人日）。

## 0. 建议先做的 5 件

| 顺序 | 事项 | 原因 |
| ---- | ---- | ---- |
| 1 | 补测试 + CI（A1/A2） | 编辑器、TOC、分享等交互复杂，没有回归网，后续改动风险最高 |
| 2 | 登录限流 + refresh token 清理/自动续期（A3/A4） | 安全风险 + Redis 键持续膨胀，前端刷新体验也依赖它 |
| 3 | 搜索改用 FULLTEXT（A6） | 索引已建但没用，改造成本低、性能收益最直接 |
| 4 | 业务异常统一 HTTP 状态码（A5） | 影响监控、网关、浏览器行为，越晚改成本越高 |
| 5 | 标签批量插入 + 阅读量 pipeline（B2/B3） | 低风险、可量化的性能收益 |

---

## 1. 稳定性与安全（P0）

| # | 现状 / 问题 | 建议 | 收益 | 工作量 |
| - | ----------- | ---- | ---- | ------ |
| A1 | 自动化测试基本空白：[backend/pom.xml](../backend/pom.xml) 未引入 `spring-boot-starter-test`，`backend/src/test` 为空；前端没有 Vitest / Playwright | 后端 JUnit 5 + Testcontainers 覆盖认证、文章 CRUD、评论审核、统计；前端 Vitest 覆盖 TOC 解析、格式化、Markdown 工具；Playwright 覆盖登录、编辑器渲染、分享弹窗 | 防止回归，敢重构 | L |
| A2 | 没有 CI：仓库没有 `.github/workflows` | 增加三条流水线：后端 `mvn verify`、前端 `lint + build + test`、`docker compose build` | PR 质量门禁 | S |
| A3 | 登录 / 注册 / 评论 / 上传都没有限流，存在爆破与刷接口风险 | Redis 滑动窗口：登录按 IP + 账号 5 次/分钟，注册 / 评论按 IP 限制，用 Filter 或 Interceptor 实现 | 安全 | M |
| A4 | refresh token 无上限且前端不自动续期：[request.js](../frontend/src/api/request.js) 收到 401 直接清 session，[auth store](../frontend/src/store/auth.js) 的 `refreshSession` 未被拦截器使用；实测 Redis 已积累 150+ 个 `refresh:*` 键 | 登录时按用户只保留最近 N 个 refresh token（如 5 个）；前端 401 做单飞刷新 + 请求队列重放，失败再登出 | 安全 + Redis 减负 + 登录态更稳 | M |
| A5 | 业务错误返回 HTTP 200：[GlobalExceptionHandler.java](../backend/src/main/java/com/blog/common/GlobalExceptionHandler.java) 中参数校验、404、409 都返回 200，只有 401/403 用对应状态 | 统一为 4xx/5xx（前端拦截器已兼容 body `code`，可平滑迁移）；或明确约定并在网关层处理 | 监控、网关、缓存语义正确 | M |
| A6 | 搜索没有用上已有的全文索引：[init.sql](../sql/init.sql) 已建 `FULLTEXT ft_article_ngram`，但 [ArticleMapper.xml](../backend/src/main/resources/mapper/ArticleMapper.xml) 仍用 `LIKE CONCAT('%', #{keyword}, '%')` 扫正文 | 改为 `MATCH(...) AGAINST(... IN BOOLEAN MODE)` + 相关度排序，标签匹配保留 `EXISTS`；先用 `EXPLAIN` 对比 | 搜索从全表扫描降为索引检索 | M |
| A7 | 唯一键并发冲突未映射：标签 / 分类重名等场景可能抛 `DuplicateKeyException` 落到兜底 500 | 在 `GlobalExceptionHandler` 增加 `DataIntegrityViolationException → 409` | 错误语义准确 | S |
| A8 | 生产配置存在默认弱值：[application.yml](../backend/src/main/resources/application.yml) 的 JWT secret、MySQL 密码、admin 密码均带默认值 | 增加 `prod` profile 启动校验（缺环境变量直接 fail-fast），删除弱默认；README 标注生产必改项 | 避免误用默认密钥 | S |
| A9 | CORS 与端口暴露：[SecurityConfig.java](../backend/src/main/java/com/blog/config/SecurityConfig.java) 的 `allowedOriginPatterns("*")` 无条件生效，compose 把 backend 8080 直接映射到宿主机 | 按环境收紧 CORS；生产环境后端只走 Nginx 内网，不直接暴露端口 | 降低攻击面 | S |

---

## 2. 性能热点（P1）

| # | 现状 / 问题 | 建议 | 收益 | 工作量 |
| - | ----------- | ---- | ---- | ------ |
| B1 | 文章详情每次请求都 `selectViewCountById` 查库，缓存 miss 时没有互斥重建，热点文章并发会打穿 | 缓存互斥 / 逻辑过期 + TTL 随机抖动；浏览基数并入缓存，只在落库时校准 | 降低 DB 压力、避免击穿 | M |
| B2 | 记录访问统计一次 4 条 Redis 命令（INCR / PFADD / HINCRBY / SADD） | 用 `executePipelined` 合并为一次往返 | 详情页延迟更低 | S |
| B3 | 保存文章标签循环单条 INSERT：[ArticleServiceImpl.java](../backend/src/main/java/com/blog/service/impl/ArticleServiceImpl.java) 每篇标签一条 SQL | 给 `ArticleTagMapper` 增加批量 `INSERT ... VALUES (...),(...)` | 保存文章少 N 次 RTT | S |
| B4 | 阅读量落库逐篇 UPDATE：[ViewCountSyncTask.java](../backend/src/main/java/com/blog/task/ViewCountSyncTask.java) 对每篇文章单独 UPDATE | `UPDATE article SET view_count = view_count + CASE id ... END WHERE id IN (...)` 一次落库 | 定时任务更快 | M |
| B5 | 分享卡片每次请求重绘：[ArticleController.java](../backend/src/main/java/com/blog/controller/ArticleController.java) 只加了 HTTP `Cache-Control`，服务端仍每次 Java2D 重绘 | 按 `articleId + updateTime` 缓存 PNG（Caffeine / Redis） | 分享弹窗秒开、降低 CPU | M |
| B6 | 看板每次全量计算 365 天热力图：[StatsServiceImpl.java](../backend/src/main/java/com/blog/service/impl/StatsServiceImpl.java) 每次请求多次 count + 365 天循环 | 看板结果缓存 1–5 分钟（管理端可接受轻微延迟），或拆分为按需接口 | 后台首屏更快 | S |
| B7 | 标签计数每次 JOIN 聚合：[TagServiceImpl.java](../backend/src/main/java/com/blog/service/impl/TagServiceImpl.java) 的 `selectWithCount` 全量 join | 标签量大时加缓存，或给 `tag` 表增加 `article_count` 冗余字段（文章标签变更时维护） | 标签页更快 | M |

---

## 3. 可维护性（P1 / P2）

| # | 现状 / 问题 | 建议 | 收益 | 工作量 |
| - | ----------- | ---- | ---- | ------ |
| C1 | 分页归一化逻辑仍在 9 个 Service 里重复（常量已抽出，表达式未收敛） | 抽 `PageQuery.normalize(pageNum, pageSize)` 返回统一值对象 | 减少重复、统一行为 | S |
| C2 | 手工映射重复：`AuthServiceImpl.toUserVO` 与 `UserServiceImpl.toVO` 几乎相同，文章实体到 VO 的映射也散落多处 | 抽 Converter（或引入 MapStruct，需权衡编译期生成） | 改字段时少漏改 | M |
| C3 | `ArticleServiceImpl` 约 630 行，列表 / 详情 / 互动 / 回收站 / 批量 / 缓存全在一个类 | 拆 `ArticleQueryService`、`ArticleCommandService`、`ArticleCacheService` | 单类职责清晰、易测试 | M |
| C4 | 关联表 SQL 写在注解里：[ArticleTagMapper.java](../backend/src/main/java/com/blog/mapper/ArticleTagMapper.java) 与其余 XML Mapper 风格不一致 | 迁到 XML，表名 / 列名更易审阅，也方便 DBA 看执行计划 | 统一数据访问风格 | S |
| C5 | MinIO 初始化阻塞启动：[MinioInitializer.java](../backend/src/main/java/com/blog/config/MinioInitializer.java) 在 `ApplicationRunner` 里同步重试 10×3s，MinIO 不可用时最多阻塞 30s | 改异步或监听 `ApplicationReadyEvent` | 启动更快、健康检查更稳 | S |
| C6 | 孤儿文件无清理：`file_object` 只增不减，删除文章不会清理封面 / 正文图片 | 定期巡检任务（MinIO 列举 + 引用检查）或软删标记 | 节省对象存储 | M |
| C7 | 日志与可观测性不足：没有 `logback-spring.xml`，只有控制台输出；无 traceId、无访问日志、无业务指标 | MDC Filter（traceId）+ JSON 日志（容器 stdout）+ Micrometer 关键指标（登录失败、缓存命中率） | 线上排障更快 | M |
| C8 | `SecurityConfig` 放行清单硬编码，`/api/articles/**` 的 GET 全部放行（含 `/mine`，靠 Service 兜底） | `/api/articles/mine` 改为需要认证，放行清单配置化 | 权限边界更清晰 | S |
| C9 | Locale 不一致：[FileServiceImpl.java](../backend/src/main/java/com/blog/service/impl/FileServiceImpl.java) 的 `toLowerCase()`、[UserServiceImpl.java](../backend/src/main/java/com/blog/service/impl/UserServiceImpl.java) 的 `toUpperCase()` 未指定 `Locale.ROOT` | 统一使用 `Locale.ROOT`（MinIO 那边已这样做） | 避免土耳其语等环境出现 i/I 问题 | S |
| C10 | 最后一个管理员没有保护：`updateStatus` / `updateRole` 只阻止操作自己，仍可禁用或降级最后一个 ADMIN | 增加「至少保留一个启用管理员」校验 | 防误操作锁死后台 | S |
| C11 | OpenAPI 错误响应未统一建模：Knife4j 能自动生成接口，但统一 `Result`、错误码、分页结构没有全局 schema / 示例 | 补全局响应描述和 `@Operation` 示例 | 联调成本更低 | S |
| C12 | 数据库变更无版本管理：目前靠手工执行 `sql/*.sql`（`init.sql` 含 DROP） | 引入 Flyway / Liquibase，把已有脚本转成版本化迁移 | 部署可重复、可审计 | M |

---

## 4. 前端体验与工程化（P1 / P2）

| # | 现状 / 问题 | 建议 | 收益 | 工作量 |
| - | ----------- | ---- | ---- | ------ |
| D1 | 巨型组件 / 文件：[MarkdownEditor.vue](../frontend/src/components/MarkdownEditor.vue) 约 40KB、[vditorEnhance.js](../frontend/src/components/vditorEnhance.js) 约 52KB、[ArticleDetail.vue](../frontend/src/views/ArticleDetail.vue) 约 26KB | 抽 composables：`useVditorHint`、`useArticleToc`、`useShareCard`，便于单测与复用 | 可读性 + 可测试性 | M |
| D2 | 静态资源体积与缓存：`frontend/public/vditor` 约 10.8MB，文件名不带 hash，Nginx 配了 7 天 immutable 缓存，升级 Vditor 后可能继续用旧文件 | 版本目录（`/vditor/4.0.1/`）或构建 hash；裁剪未用的 highlight 主题 / emoji | 升级不脏缓存、减小体积 | M |
| D3 | 首屏拆包：[vite.config.js](../frontend/vite.config.js) 只设了 `chunkSizeWarningLimit`，没有 `manualChunks` | 用 `rollup-plugin-visualizer` 评估，把 editor / reader / pdf 拆成独立 chunk（PDF 的 jspdf/html2canvas 已是动态 import） | 首屏更快 | S |
| D4 | 无前端错误上报：线上白屏只能靠用户反馈 | `app.config.errorHandler` + `window.onerror` + 简单上报端点 | 线上问题可发现 | S |
| D5 | SEO / 分享预览：SPA 的 OG meta 只在 [ArticleDetail.vue](../frontend/src/views/ArticleDetail.vue) 挂载后注入，不执行 JS 的爬虫拿不到 | 预渲染文章页，或让 Nginx / 后端对 crawler UA 返回带 OG 的 HTML | 分享卡片、搜索收录更好 | L |
| D6 | Nginx 生产配置：[nginx.conf](../frontend/nginx.conf) 有 gzip 和静态缓存，但缺 CSP、X-Frame-Options、Referrer-Policy、Permissions-Policy，也没有 brotli | 补安全头，并显式设置 `index.html` 为 no-cache | 安全 + 缓存正确 | S |
| D7 | 模态框缺少 focus trap：[SketchModal.vue](../frontend/src/components/SketchModal.vue) 已有 `aria-modal`、Esc 关闭和初始 focus，但 Tab 可以跑到弹窗外 | 增加 Tab 循环与关闭后焦点恢复 | 无障碍 | S |
| D8 | 图片可再优化：[ArticleCard.vue](../frontend/src/components/ArticleCard.vue) 已有 `loading="lazy"` 和 alt | 补 `decoding="async"`；封面按需加 `srcset` | 加载更快 | S |
| D9 | 依赖偏旧：Spring Boot 3.3.5、MyBatis-Plus 3.5.7、Vite 5、Vditor 4.0.1、ESLint 8 | 先补 A1/A2 的测试与 CI，再逐项升级；编辑器相关升级风险最高 | 安全补丁与新特性 | L |
| D10 | 开发脚本与常量不同步：[scripts/seed-demo.mjs](../scripts/seed-demo.mjs) 里仍硬编码 `"article:views:"` 等 Redis key | 复用同一份 key 约定，或至少在脚本里注释同步来源 | 避免脚本与后端漂移 | S |

---

## 5. 不建议现在做

| 事项 | 原因 |
| ---- | ---- |
| 全量引入 TypeScript | 收益大但改动面广，先把测试和关键 composables 拆出来更划算 |
| 直接上 SSR | 当前是纯 SPA + Nginx，改造成本高；先做预渲染 / 爬虫分流 |
| 用 Elasticsearch 替换 MySQL 搜索 | 项目已留 `SearchService` 扩展点，先让 FULLTEXT 索引真正用起来即可 |

---

## 6. 维护约定

- 新的优化项先加到本文对应优先级表格，完成后在 PR 里删除该行或标记完成。
- 如果优化项需要产品排期（如 SSR、版本历史），应移到 [ROADMAP.md](ROADMAP.md) 并标注依赖。
- 每次完成一项后同步更新本文的基线说明（分支 + commit），避免清单与代码脱节。
