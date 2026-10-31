# 技术分享博客 · 前后端接口契约

> 本文件是前后端唯一接口契约。前端 `src/api/*` 与后端 Controller 必须严格按此实现，字段名不得随意改动。

## 通用约定

- 基础路径：`/api`
- 认证：除放行清单外，请求头携带 `Authorization: Bearer <accessToken>`
- 时间格式：`yyyy-MM-dd HH:mm:ss`（字符串）
- 分页请求参数：`pageNum`（从 1 开始，默认 1）、`pageSize`（默认 10，最大 50）
- 统一响应体：

```json
{ "code": 200, "message": "success", "data": null }
```

- 分页数据体：

```json
{ "records": [], "total": 0, "pageNum": 1, "pageSize": 10 }
```

- 业务错误码（HTTP 状态码仍为 200，业务码在 body 的 `code` 中）：

| code | 含义 |
| ---- | ---- |
| 200 | 成功 |
| 400 | 参数校验失败 / 业务参数错误 |
| 401 | 未登录、Token 无效或已过期 |
| 403 | 已登录但无权限 |
| 404 | 资源不存在 |
| 409 | 资源冲突（重名、重复操作等） |
| 500 | 服务器内部错误 |

> 说明：登录态失效时后端返回 HTTP 401 + `code=401`，前端 Axios 拦截器据此跳转登录页。

## 放行清单（无需 Token）

- `POST /api/auth/**`
- `GET /api/articles/**`（公开文章列表、详情、归档、置顶、互动状态、相关文章、分享卡片）
- `GET /api/categories`、`GET /api/tags`
- `GET /api/search`
- `GET /api/articles/{id}/comments`
- `/doc.html`、`/swagger-ui/**`、`/v3/api-docs/**`、`/actuator/health`

其余接口均需登录；管理接口需 `ADMIN` 角色。`/api/notifications/**` 与 `/api/favorites` 需要登录。

## 枚举约定

- 用户角色 `role`：`ADMIN` | `USER`
- 用户状态 `status`：`1` 启用 | `0` 禁用
- 文章状态 `status`：`0` 草稿 | `1` 已发布
- 置顶 `isTop`：`0` 否 | `1` 是
- 评论状态 `status`：`0` 待审核 | `1` 已通过 | `2` 已拒绝
- 通知类型 `type`：`COMMENT` 文章收到评论 | `REPLY` 有人回复我 | `COMMENT_AUDIT` 评论审核结果
- 上传分类 `category`：`avatar` | `cover` | `content`

## 视图对象（VO）

```ts
UserVO      { id, username, nickname, avatar, email, role, status, createTime }
TokenVO     { accessToken, refreshToken, tokenType: "Bearer", expiresIn, user: UserVO }
TagVO       { id, name, articleCount }
CategoryVO  { id, name, sort, articleCount }
ArticleSummaryVO {
  id, title, summary, cover, categoryId, categoryName,
  authorId, authorName, authorAvatar,
  status, isTop, viewCount, likeCount, favoriteCount,
  tags: TagVO[], createTime, updateTime,
  favoriteTime?   // 仅「我的收藏」接口返回
}
ArticleDetailVO = ArticleSummaryVO & {
  content, prev: { id, title } | null, next: { id, title } | null
}
CommentVO   { id, articleId, userId, nickname, avatar, parentId, rootId,
              replyToUserId, replyToNickname, depth, content, likeCount, liked,
              createTime, replies: CommentVO[] }
CommentAdminVO = CommentVO & { articleTitle, status, username }
NotificationVO { id, type, title, content, articleId, articleTitle, commentId,
                 senderId, senderName, senderAvatar, isRead, createTime }
ArticleInteractionVO { liked, favorited, likeCount, favoriteCount }
ArchiveVO   { year, months: [{ month, count }] }
FileVO      { url, objectKey, originalName, size, contentType }
```

## 1. 认证模块 `/api/auth`

| 方法 | 路径 | 入参 | 出参 data |
| ---- | ---- | ---- | --------- |
| POST | `/api/auth/register` | `{ username, password, nickname?, email? }` | `null` |
| POST | `/api/auth/login` | `{ username, password }` | `TokenVO` |
| POST | `/api/auth/refresh` | `{ refreshToken }` | `TokenVO` |
| POST | `/api/auth/logout` | 请求头 Token；body 可选 `{ refreshToken }` | `null` |

- 注册：`username` 4-20 位字母/数字/下划线；`password` 6-32 位；用户名重复返回 `409`。
- 登录：用户名不存在 / 密码错误返回 `400`；账号禁用返回 `403`。
- 刷新：refreshToken 无效、过期或已登出返回 `401`。
- 登出：accessToken 加入 Redis 黑名单（TTL = 剩余有效期），refreshToken 从白名单删除。

## 2. 用户模块 `/api/users`

| 方法 | 路径 | 权限 | 入参 | 出参 data |
| ---- | ---- | ---- | ---- | --------- |
| GET | `/api/users/me` | 登录 | - | `UserVO` |
| PUT | `/api/users/me` | 登录 | `{ nickname?, email?, avatar? }` | `UserVO` |
| PUT | `/api/users/me/password` | 登录 | `{ oldPassword, newPassword }` | `null` |

## 3. 文章模块 `/api/articles`

| 方法 | 路径 | 权限 | 入参 | 出参 data |
| ---- | ---- | ---- | ---- | --------- |
| GET | `/api/articles` | 公开 | `pageNum, pageSize, categoryId?, tagId?, keyword?, year?, month?, sort?`（`sort=time\|views`，默认 time） | `PageResult<ArticleSummaryVO>` |
| GET | `/api/articles/top` | 公开 | `limit?`（默认 5，最大 10） | `ArticleSummaryVO[]` |
| GET | `/api/articles/{id}` | 公开 | - | `ArticleDetailVO`（阅读量 +1） |
| GET | `/api/articles/{id}/interaction` | 公开 | - | `ArticleInteractionVO`（未登录 liked/favorited=false） |
| POST | `/api/articles/{id}/like` | 登录 | - | `{ liked: true, likeCount }`（幂等） |
| DELETE | `/api/articles/{id}/like` | 登录 | - | `{ liked: false, likeCount }`（幂等） |
| POST | `/api/articles/{id}/favorite` | 登录 | - | `{ favorited: true, favoriteCount }`（幂等） |
| DELETE | `/api/articles/{id}/favorite` | 登录 | - | `{ favorited: false, favoriteCount }`（幂等） |
| GET | `/api/articles/{id}/related` | 公开 | `limit?`（默认 6，最大 12） | `ArticleSummaryVO[]`（共同标签 *3 + 同分类 +2，排除自身/草稿） |
| GET | `/api/articles/{id}/share-card.png` | 公开 | - | `image/png` 1200×630 分享卡片；仅已发布；`Cache-Control: public, max-age=3600` |
| GET | `/api/articles/archive` | 公开 | - | `ArchiveVO[]` |
| GET | `/api/articles/mine` | 登录 | `pageNum, pageSize, status?` | `PageResult<ArticleSummaryVO>` |
| POST | `/api/articles` | 登录 | `ArticleSaveDTO` | `ArticleSummaryVO` |
| PUT | `/api/articles/{id}` | 登录（作者或 ADMIN） | `ArticleSaveDTO` | `ArticleSummaryVO` |
| DELETE | `/api/articles/{id}` | 登录（作者或 ADMIN） | - | `null`（逻辑删除） |

`ArticleSaveDTO`：

```json
{
  "title": "必填，<= 200 字",
  "summary": "可选，<= 500 字；为空时取正文前 120 字",
  "content": "Markdown 正文；发布时必填",
  "cover": "可选，MinIO 图片 URL",
  "categoryId": 1,
  "tagIds": [1, 2],
  "status": 1,
  "isTop": 0
}
```

- 未发布草稿仅作者本人与 ADMIN 可见；公开列表只返回 `status=1`。
- `isTop` 仅 ADMIN 可设置，普通用户传入忽略。
- 阅读量：Redis 先自增，定时任务每 60 秒批量落库；缓存文章详情 10 分钟，更新/删除时失效。
- 互动：点赞/收藏写入 `article_like` / `article_favorite` 唯一键，重复调用幂等；文章表
  `like_count` / `favorite_count` 为冗余计数；点赞、收藏、取消后主动失效文章详情缓存。
- 分享卡片：服务端 Java2D 生成 1200×630 PNG（纸张底色 + 标题 + 摘要 + 分类/标签 + 作者/日期 + 站点名），
  草稿/回收站/不存在返回 404。
- 相关文章：共同标签数 × 3 + 同分类 + 2 排序，再按发布时间倒序；无共同标签/分类时自然退化为最新文章。

## 4. 分类模块

| 方法 | 路径 | 权限 | 入参 | 出参 data |
| ---- | ---- | ---- | ---- | --------- |
| GET | `/api/categories` | 公开 | - | `CategoryVO[]`（含 articleCount） |
| POST | `/api/admin/categories` | ADMIN | `{ name, sort? }` | `CategoryVO` |
| PUT | `/api/admin/categories/{id}` | ADMIN | `{ name, sort? }` | `CategoryVO` |
| DELETE | `/api/admin/categories/{id}` | ADMIN | - | `null`（有文章引用时返回 400） |

## 5. 标签模块

| 方法 | 路径 | 权限 | 入参 | 出参 data |
| ---- | ---- | ---- | ---- | --------- |
| GET | `/api/tags` | 公开 | - | `TagVO[]`（含 articleCount） |
| POST | `/api/admin/tags` | ADMIN | `{ name }` | `TagVO` |
| PUT | `/api/admin/tags/{id}` | ADMIN | `{ name }` | `TagVO` |
| DELETE | `/api/admin/tags/{id}` | ADMIN | - | `null` |

## 6. 评论模块

| 方法 | 路径 | 权限 | 入参 | 出参 data |
| ---- | ---- | ---- | ---- | --------- |
| GET | `/api/articles/{articleId}/comments` | 公开 | - | `CommentVO[]`（仅已通过，任意层级楼中楼树） |
| POST | `/api/comments` | 登录 | `{ articleId, parentId?, content }` | `CommentVO`（状态为待审核） |
| DELETE | `/api/comments/{id}` | 登录（本人或 ADMIN） | - | `null`（递归删除整棵子树） |
| POST | `/api/comments/{id}/like` | 登录 | - | `{ liked: true, likeCount }` |
| DELETE | `/api/comments/{id}/like` | 登录 | - | `{ liked: false, likeCount }` |
| GET | `/api/admin/comments` | ADMIN | `pageNum, pageSize, status?` | `PageResult<CommentAdminVO>` |
| PUT | `/api/admin/comments/{id}/audit` | ADMIN | `{ status: 1 \| 2 }` | `null`（状态变化时发通知） |
| DELETE | `/api/admin/comments/{id}` | ADMIN | - | `null`（递归删除整棵子树） |

- 楼中楼：`parentId` 直接指向被回复的评论；后端记录 `rootId`（楼层根）、`replyToUserId`、
  `depth`（0 为一级，最大 4，即最多 5 层），超过返回 400「回复层级过深」。
- 只能回复**已通过审核**的评论（否则 400「只能回复已通过的评论」）；回复提交后同样待审核。
- 删除父评论会递归删除所有子孙评论，并清理对应评论点赞缓存。
- 审核通过时通知：根评论 → 文章作者（`COMMENT`，自己评论自己的文章不发）；回复 → 直接父评论作者
  （`REPLY`）；审核结果 → 评论作者（`COMMENT_AUDIT`）。通知发送失败不影响审核事务。
- 点赞可取消：再次点击调用 `DELETE /api/comments/{id}/like`；`DELETE` 幂等（未点赞时直接返回当前计数）。
  `CommentVO.liked` 表示当前登录用户是否已赞，未登录时为 `null`。

## 7. 搜索模块 `/api/search`

| 方法 | 路径 | 权限 | 入参 | 出参 data |
| ---- | ---- | ---- | ---- | --------- |
| GET | `/api/search` | 公开 | `keyword, pageNum, pageSize, sort?`（`relevance\|time`，默认 relevance） | `PageResult<ArticleSummaryVO>` |

- 匹配范围：标题、摘要、正文、标签名；只搜已发布文章。
- 相关度排序：标题命中权重 5，摘要 3，标签 2，正文 1，按命中字段数加总降序；`sort=time` 时按发布时间降序。
- 当前实现 `MysqlSearchService`（LIKE），预留 `SearchService` 接口与 `ElasticsearchSearchServiceImpl` 扩展点（本次不实现）。

## 8. 文件模块 `/api/files`

| 方法 | 路径 | 权限 | 入参 | 出参 data |
| ---- | ---- | ---- | ---- | --------- |
| POST | `/api/files/upload` | 登录 | `multipart/form-data`：`file`、`category`（avatar/cover/content） | `FileVO` |
| DELETE | `/api/files/{objectKey}` | 登录（上传者或 ADMIN） | - | `null` |

- 允许类型：`image/jpeg`、`image/png`、`image/webp`、`image/gif`，后缀 `jpg/jpeg/png/webp/gif`。
- 大小限制：5 MB（`spring.servlet.multipart.max-file-size=5MB`）。
- objectKey 规则：`{category}-{uuid}.{ext}`（扁平、随机、不含 `/`，不可遍历）。
- 返回的 `url` 使用 `minio.public-endpoint + / + bucket + / + objectKey` 拼接。
- bucket 由后端启动时自动创建，并设置为公共读策略（见 README 部署说明）。

## 9. 管理端用户模块

| 方法 | 路径 | 权限 | 入参 | 出参 data |
| ---- | ---- | ---- | ---- | --------- |
| GET | `/api/admin/users` | ADMIN | `pageNum, pageSize, keyword?, role?, status?` | `PageResult<UserVO>` |
| PUT | `/api/admin/users/{id}/status` | ADMIN | `{ status: 0 \| 1 }` | `null` |
| PUT | `/api/admin/users/{id}/role` | ADMIN | `{ role: "ADMIN" \| "USER" }` | `null` |

## 10. 管理端文章模块

| 方法 | 路径 | 权限 | 入参 | 出参 data |
| ---- | ---- | ---- | ---- | --------- |
| GET | `/api/admin/articles` | ADMIN | `pageNum, pageSize, status?, keyword?, categoryId?` | `PageResult<ArticleSummaryVO>` |
| PUT | `/api/admin/articles/{id}/top` | ADMIN | `{ isTop: 0 \| 1 }` | `null` |
| DELETE | `/api/admin/articles/{id}` | ADMIN | - | `null`（逻辑删除，进入回收站） |
| GET | `/api/admin/articles/recycle` | ADMIN | `pageNum, pageSize, keyword?` | `PageResult<ArticleSummaryVO>`（含 `deletedTime`） |
| PUT | `/api/admin/articles/{id}/restore` | ADMIN | - | `ArticleSummaryVO` |
| DELETE | `/api/admin/articles/{id}/purge` | ADMIN | - | `null`（彻底删除，不可恢复） |
| PUT | `/api/admin/articles/batch/top` | ADMIN | `{ ids: number[], isTop: 0 \| 1 }` | 受影响文章数 |
| POST | `/api/admin/articles/batch/delete` | ADMIN | `{ ids: number[] }` | 进入回收站的文章数 |
| POST | `/api/admin/articles/batch/restore` | ADMIN | `{ ids: number[] }` | 恢复的文章数 |
| POST | `/api/admin/articles/batch/purge` | ADMIN | `{ ids: number[] }` | 彻底删除的文章数（仅回收站中的文章） |

批量接口单次最多 100 篇；`ids` 会去空、去重。批量彻底删除同时清理标签关联、评论与每日统计。

## 10.1 管理端内容看板

| 方法 | 路径 | 权限 | 入参 | 出参 data |
| ---- | ---- | ---- | ---- | --------- |
| GET | `/api/admin/stats/dashboard` | ADMIN | `days?`（7–90，默认 30） | `DashboardVO`：totals / today / range / trend / topArticles / publish（365 天热力图 + 连续天数） |

统计说明：访问已发布文章详情时记录 PV 与 UV（HyperLogLog，按日去重），Redis 每 60 秒落库到
`site_daily_stat` / `article_daily_stat`；发布热力图按已发布文章的 `create_time` 聚合。

## 10.2 互动、收藏、通知与分享

### 10.2.1 点赞 / 收藏

| 方法 | 路径 | 权限 | 入参 | 出参 data |
| ---- | ---- | ---- | ---- | --------- |
| GET | `/api/articles/{id}/interaction` | 公开 | - | `ArticleInteractionVO` |
| POST | `/api/articles/{id}/like` | 登录 | - | `{ liked: true, likeCount }` |
| DELETE | `/api/articles/{id}/like` | 登录 | - | `{ liked: false, likeCount }` |
| POST | `/api/articles/{id}/favorite` | 登录 | - | `{ favorited: true, favoriteCount }` |
| DELETE | `/api/articles/{id}/favorite` | 登录 | - | `{ favorited: false, favoriteCount }` |
| GET | `/api/favorites` | 登录 | `pageNum, pageSize` | `PageResult<ArticleSummaryVO>`（按收藏时间倒序，含 `favoriteTime`） |

- 点赞/收藏/取消均幂等：`article_like` / `article_favorite` 唯一键保证同一用户只计一次；
  `like_count` / `favorite_count` 与关系表在同一事务里同步增减。
- 草稿、回收站、不存在的文章返回 404；未登录调用 `interaction` 时 `liked/favorited` 均为 `false`，
  `likeCount/favoriteCount` 仍返回。
- 我的收藏只返回已发布且未删除的文章；彻底删除文章时同步清理其点赞/收藏记录。

### 10.2.2 站内通知

| 方法 | 路径 | 权限 | 入参 | 出参 data |
| ---- | ---- | ---- | ---- | --------- |
| GET | `/api/notifications` | 登录 | `pageNum, pageSize, unreadOnly?` | `PageResult<NotificationVO>` |
| GET | `/api/notifications/unread-count` | 登录 | - | `{ count: number }` |
| PUT | `/api/notifications/{id}/read` | 登录 | - | `null`（只能操作自己的通知） |
| PUT | `/api/notifications/read-all` | 登录 | - | `{ updated: number }` |

通知类型见「枚举约定」；触发时机见评论模块审核说明。通知表只存站内消息，
评论审核失败/通知插入失败不会影响审核事务。

### 10.2.3 分享卡片

`GET /api/articles/{id}/share-card.png`（公开）返回 1200×630 PNG：

- 纸张底色 + 手绘虚线边框 + 标题（最多 3 行）+ 摘要（最多 2 行）+ 分类/标签 + 作者/日期 + 站点名；
- 仅已发布文章可生成，草稿/回收站/不存在返回 HTTP 404；
- 响应头 `Cache-Control: public, max-age=3600`；
- 服务端 Java2D 渲染，Docker 运行镜像已安装 `fontconfig` + `fonts-noto-cjk`，并启用
  `-Djava.awt.headless=true`。

## 11. 健康检查

| 方法 | 路径 | 权限 | 出参 |
| ---- | ---- | ---- | ---- |
| GET | `/actuator/health` | 公开 | `{ "status": "UP" }` |

## 前端路由与页面映射

| 路由 | 页面 | 说明 |
| ---- | ---- | ---- |
| `/` | Home | 文章列表 + 置顶 + 分类/标签侧栏 |
| `/article/:id` | ArticleDetail | Markdown 渲染（公式/Mermaid/ECharts）、点赞收藏分享、相关文章、楼中楼评论 |
| `/category/:id` | CategoryPage | 分类下文章 |
| `/tag/:id` | TagPage | 标签下文章 |
| `/archive` | ArchivePage | 按年月归档 |
| `/search` | SearchPage | `?keyword=` 搜索 |
| `/about` | AboutPage | 关于 |
| `/login`、`/register` | Login / Register | 认证 |
| `/profile` | Profile | 个人资料、头像上传、我的收藏 |
| `/notifications` | Notifications | 消息通知（评论/回复/审核结果、未读筛选、全部已读） |
| `/admin` | AdminLayout | 需 ADMIN，默认跳转内容看板 |
| `/admin/dashboard` | AdminDashboard | 内容看板（PV/UV、趋势、热门、发布热力图） |
| `/admin/articles`、`/admin/articles/new`、`/admin/articles/:id/edit` | 文章管理/编辑（编辑器内含自动保存草稿） |
| `/admin/recycle` | 回收站（恢复 / 彻底删除） |
| `/admin/comments` | 评论审核 |
| `/admin/categories`、`/admin/tags`、`/admin/users` | 分类/标签/用户管理 |
