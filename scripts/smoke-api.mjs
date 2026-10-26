/**
 * 本地全链路冒烟测试：认证 / 文章 / 搜索 / 评论 / 点赞 / 文件 / 管理端。
 * 前置：backend 已启动；默认连接 http://127.0.0.1:8080（可用 API_BASE 覆盖）。
 * 运行：node scripts/smoke-api.mjs
 */
const BASE = process.env.API_BASE || 'http://127.0.0.1:8080'
const results = []
let tokens = {}
let state = {}

function ok(name, extra = '') {
  results.push({ name, pass: true, extra })
  console.log(`PASS  ${name}${extra ? '  ' + extra : ''}`)
}
function fail(name, detail) {
  results.push({ name, pass: false, detail })
  console.log(`FAIL  ${name}  ${detail}`)
}

async function req(method, path, { token, body, form, raw } = {}) {
  const headers = {}
  if (token) headers.Authorization = `Bearer ${token}`
  let payload
  if (form) {
    payload = form
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
    payload = JSON.stringify(body)
  }
  const res = await fetch(BASE + path, { method, headers, body: payload })
  const text = await res.text()
  let json = null
  try { json = JSON.parse(text) } catch { /* not json */ }
  return { status: res.status, json, text, headers: res.headers }
}

function expectData(name, r, predicate, extra = '') {
  if (r.json && r.json.code === 200 && predicate(r.json.data)) {
    ok(name, extra)
    return r.json.data
  }
  fail(name, `HTTP ${r.status} body=${r.text.slice(0, 300)}`)
  return null
}

// 生成一个 1x1 PNG，用于上传测试
const PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
function pngBlob() {
  return new Blob([Buffer.from(PNG_BASE64, 'base64')], { type: 'image/png' })
}

async function uploadFile(token, filename, category) {
  const form = new FormData()
  form.append('file', pngBlob(), filename)
  form.append('category', category)
  return req('POST', '/api/files/upload', { token, form })
}

async function main() {
  // 1. 健康检查
  const health = await req('GET', '/actuator/health')
  if (health.status === 200 && health.json && health.json.status === 'UP') ok('健康检查 UP')
  else fail('健康检查', `HTTP ${health.status} ${health.text.slice(0, 200)}`)

  // 2. 管理员登录
  const adminLogin = await req('POST', '/api/auth/login', {
    body: { username: 'admin', password: 'admin123456' }
  })
  const adminToken = expectData('管理员登录', adminLogin, (d) => d && d.accessToken && d.user.role === 'ADMIN')
  if (adminToken) tokens.admin = adminToken.accessToken

  // 3. 注册普通用户（若已存在则忽略冲突）
  const reg = await req('POST', '/api/auth/register', {
    body: { username: 'tester', password: 'test123456', nickname: '冒烟测试用户', email: 'tester@example.com' }
  })
  if ((reg.json && reg.json.code === 200) || (reg.json && reg.json.code === 409)) ok('注册用户 tester', reg.json.message)
  else fail('注册用户 tester', `HTTP ${reg.status} ${reg.text.slice(0, 200)}`)

  // 4. 普通用户登录
  const userLogin = await req('POST', '/api/auth/login', {
    body: { username: 'tester', password: 'test123456' }
  })
  const userToken = expectData('普通用户登录', userLogin, (d) => d && d.accessToken && d.user.role === 'USER')
  if (userToken) tokens.user = userToken.accessToken

  // 5. 当前用户
  const me = await req('GET', '/api/users/me', { token: tokens.user })
  expectData('GET /users/me', me, (d) => d && d.username === 'tester')

  // 6. 刷新 Token
  const refreshed = await req('POST', '/api/auth/refresh', {
    body: { refreshToken: userToken.refreshToken }
  })
  const newTokens = expectData('刷新 Token', refreshed, (d) => d && d.accessToken)
  if (newTokens) {
    tokens.userOld = tokens.user
    tokens.user = newTokens.accessToken
  }

  // 7. 登出旧 Token 并验证黑名单
  if (tokens.userOld) {
    const logout = await req('POST', '/api/auth/logout', {
      token: tokens.userOld,
      body: { refreshToken: userToken.refreshToken }
    })
    if (logout.json && logout.json.code === 200) ok('登出接口')
    else fail('登出接口', `HTTP ${logout.status} ${logout.text.slice(0, 200)}`)
    const meOld = await req('GET', '/api/users/me', { token: tokens.userOld })
    if (meOld.status === 401 || (meOld.json && meOld.json.code === 401)) ok('登出后旧 accessToken 进入黑名单')
    else fail('登出后旧 accessToken 仍可用', `HTTP ${meOld.status} ${meOld.text.slice(0, 200)}`)
  }

  // 8. 管理端：分类 / 标签
  const cat = await req('POST', '/api/admin/categories', { token: tokens.admin, body: { name: '冒烟测试分类', sort: 9 } })
  const category = expectData('创建分类', cat, (d) => d && d.id)
  if (category) state.categoryId = category.id
  const tag = await req('POST', '/api/admin/tags', { token: tokens.admin, body: { name: '冒烟测试标签' } })
  const tagData = expectData('创建标签', tag, (d) => d && d.id)
  if (tagData) state.tagId = tagData.id

  // 9. 创建并发布文章
  const articleBody = {
    title: '冒烟测试文章：Sketch 博客跑通',
    summary: '用于验证文章创建、发布、搜索、评论与上传。',
    content: '# 冒烟测试\n\n这是 **Markdown** 正文，包含 `code`。\n\n```java\nSystem.out.println("hello");\n```',
    categoryId: state.categoryId,
    tagIds: state.tagId ? [state.tagId] : [],
    status: 1,
    isTop: 1
  }
  const created = await req('POST', '/api/articles', { token: tokens.admin, body: articleBody })
  const article = expectData('创建并发布文章', created, (d) => d && d.id)
  if (article) state.articleId = article.id

  // 10. 文章列表 / 详情（阅读量）
  const list = await req('GET', '/api/articles?pageNum=1&pageSize=10')
  expectData('GET /articles 分页', list, (d) => d && Array.isArray(d.records) && d.records.length >= 1,
    list.json ? `total=${list.json.data.total}` : '')

  const detail1 = await req('GET', `/api/articles/${state.articleId}`)
  const views1 = expectData('文章详情（首次阅读）', detail1, (d) => d && d.content && d.tags.length >= 1)
  const detail2 = await req('GET', `/api/articles/${state.articleId}`)
  const views2 = expectData('文章详情（阅读量 +1）', detail2, (d) => d && d.viewCount > (views1 ? views1.viewCount : 0),
    `viewCount ${views1 ? views1.viewCount : '?'} -> ${detail2.json && detail2.json.data ? detail2.json.data.viewCount : '?'}`)

  // 11. 搜索 / 归档 / 置顶
  const search = await req('GET', '/api/search?keyword=' + encodeURIComponent('冒烟测试') + '&pageNum=1&pageSize=10')
  expectData('搜索（相关度）', search, (d) => d && d.total >= 1, search.json ? `total=${search.json.data.total}` : '')
  const searchTime = await req('GET', '/api/search?keyword=' + encodeURIComponent('冒烟测试') + '&sort=time')
  expectData('搜索（时间排序）', searchTime, (d) => d && d.total >= 1)
  const archive = await req('GET', '/api/articles/archive')
  expectData('归档统计', archive, (d) => Array.isArray(d) && d.length >= 1)
  const top = await req('GET', '/api/articles/top?limit=5')
  expectData('置顶文章', top, (d) => Array.isArray(d) && d.some((a) => a.id === state.articleId))

  // 12. 评论：发表（待审核） -> 管理端审核通过 -> 列表 / 点赞
  const comment = await req('POST', '/api/comments', {
    token: tokens.user,
    body: { articleId: state.articleId, content: '第一条冒烟测试评论' }
  })
  // CommentVO 按契约不返回审核状态（前端只展示已通过评论），这里只校验创建成功
  const commentData = expectData('发表评论（待审核）', comment, (d) => d && d.id && d.content)
  if (commentData) state.commentId = commentData.id

  const pending = await req('GET', '/api/admin/comments?pageNum=1&pageSize=10&status=0', { token: tokens.admin })
  expectData('管理端待审核评论列表', pending, (d) => d && d.records.some((c) => c.id === state.commentId))

  const audit = await req('PUT', `/api/admin/comments/${state.commentId}/audit`, {
    token: tokens.admin,
    body: { status: 1 }
  })
  if (audit.json && audit.json.code === 200) ok('评论审核通过')
  else fail('评论审核通过', `HTTP ${audit.status} ${audit.text.slice(0, 200)}`)

  const commentTree = await req('GET', `/api/articles/${state.articleId}/comments`)
  expectData('前台评论树', commentTree, (d) => Array.isArray(d) && d.length >= 1 && d[0].id === state.commentId)

  const like1 = await req('POST', `/api/comments/${state.commentId}/like`, { token: tokens.user })
  const likeData = expectData('评论点赞', like1, (d) => d && d.likeCount >= 1 && d.liked === true)
  const like2 = await req('POST', `/api/comments/${state.commentId}/like`, { token: tokens.user })
  expectData('评论点赞去重', like2, (d) => d && likeData && d.likeCount === likeData.likeCount)

  const unlike1 = await req('DELETE', `/api/comments/${state.commentId}/like`, { token: tokens.user })
  expectData('取消点赞', unlike1, (d) => d && d.liked === false && d.likeCount === (likeData ? likeData.likeCount - 1 : 0))
  const unlike2 = await req('DELETE', `/api/comments/${state.commentId}/like`, { token: tokens.user })
  expectData('取消点赞幂等', unlike2, (d) => d && d.liked === false && d.likeCount === 0)
  const likedTree = await req('GET', `/api/articles/${state.articleId}/comments`, { token: tokens.user })
  expectData('评论返回 liked 状态', likedTree,
    (d) => Array.isArray(d) && d.length >= 1 && d[0].liked === false)

  // 13. 文件上传 -> 公共读访问 -> 删除鉴权
  // 上传头像
  const userUpload = await uploadFile(tokens.user, 'avatar.png', 'avatar')
  const userFile = expectData('上传头像文件', userUpload, (d) => d && d.url && d.objectKey)
  if (userFile) state.userFile = userFile
  // 上传封面
  const coverUpload = await uploadFile(tokens.admin, 'cover.png', 'cover')
  const coverFile = expectData('上传封面文件', coverUpload, (d) => d && d.url && d.objectKey)
  if (coverFile) state.coverFile = coverFile
  // 公共读访问
  if (userFile) {
    const img = await fetch(userFile.url)
    if (img.status === 200) ok('MinIO 公共读 URL 可访问', `HTTP ${img.status}`)
    else fail('MinIO 公共读 URL 可访问', `HTTP ${img.status}`)
  }
  // 普通用户不能删除管理员的文件
  if (state.coverFile) {
    const forbidden = await req('DELETE', `/api/files/${state.coverFile.objectKey}`, { token: tokens.user })
    if (forbidden.status === 403 || (forbidden.json && forbidden.json.code === 403)) ok('越权删除文件被拒绝（403）')
    else fail('越权删除文件被拒绝', `HTTP ${forbidden.status} ${forbidden.text.slice(0, 200)}`)
  }
  // 本人可以删除自己的文件
  if (state.userFile) {
    const del = await req('DELETE', `/api/files/${state.userFile.objectKey}`, { token: tokens.user })
    if (del.json && del.json.code === 200) ok('删除本人文件')
    else fail('删除本人文件', `HTTP ${del.status} ${del.text.slice(0, 200)}`)
  }

  // 14. 管理端：用户列表 / 文章置顶 / 用户状态
  const users = await req('GET', '/api/admin/users?pageNum=1&pageSize=10', { token: tokens.admin })
  expectData('管理端用户列表', users, (d) => d && d.records.length >= 2)
  const topToggle = await req('PUT', `/api/admin/articles/${state.articleId}/top`, {
    token: tokens.admin,
    body: { isTop: 0 }
  })
  if (topToggle.json && topToggle.json.code === 200) ok('管理端取消置顶')
  else fail('管理端取消置顶', `HTTP ${topToggle.status} ${topToggle.text.slice(0, 200)}`)
  const statusToggle = await req('PUT', `/api/admin/users/${userToken.user.id}/status`, {
    token: tokens.admin,
    body: { status: 0 }
  })
  if (statusToggle.json && statusToggle.json.code === 200) ok('管理端禁用用户')
  else fail('管理端禁用用户', `HTTP ${statusToggle.status} ${statusToggle.text.slice(0, 200)}`)
  // 禁用后登录应失败
  const disabledLogin = await req('POST', '/api/auth/login', { body: { username: 'tester', password: 'test123456' } })
  if (disabledLogin.json && (disabledLogin.json.code === 403 || disabledLogin.json.code === 400)) ok('禁用用户无法登录')
  else fail('禁用用户无法登录', `HTTP ${disabledLogin.status} ${disabledLogin.text.slice(0, 200)}`)
  // 恢复启用
  await req('PUT', `/api/admin/users/${userToken.user.id}/status`, { token: tokens.admin, body: { status: 1 } })

  // 15. 权限校验：普通用户不能访问管理端
  const adminApiByUser = await req('GET', '/api/admin/users', { token: tokens.user })
  if (adminApiByUser.status === 403 || (adminApiByUser.json && adminApiByUser.json.code === 403)) ok('普通用户访问管理端被拒绝（403）')
  else fail('普通用户访问管理端被拒绝', `HTTP ${adminApiByUser.status} ${adminApiByUser.text.slice(0, 200)}`)

  // 16. 清理：文章 -> 分类 -> 标签
  const delArticle = await req('DELETE', `/api/articles/${state.articleId}`, { token: tokens.admin })
  if (delArticle.json && delArticle.json.code === 200) ok('删除文章')
  else fail('删除文章', `HTTP ${delArticle.status} ${delArticle.text.slice(0, 200)}`)
  const delCat = await req('DELETE', `/api/admin/categories/${state.categoryId}`, { token: tokens.admin })
  if (delCat.json && delCat.json.code === 200) ok('删除测试分类')
  else fail('删除测试分类', `HTTP ${delCat.status} ${delCat.text.slice(0, 300)}`)
  const delTag = await req('DELETE', `/api/admin/tags/${state.tagId}`, { token: tokens.admin })
  if (delTag.json && delTag.json.code === 200) ok('删除测试标签')
  else fail('删除测试标签', `HTTP ${delTag.status} ${delTag.text.slice(0, 300)}`)

  // 汇总
  const failed = results.filter((r) => !r.pass)
  console.log('\n============================')
  console.log(`总计 ${results.length} 项，通过 ${results.length - failed.length} 项，失败 ${failed.length} 项`)
  if (failed.length) {
    console.log('失败项：')
    failed.forEach((f) => console.log(` - ${f.name}: ${f.detail}`))
    process.exitCode = 1
  }
}

main().catch((err) => {
  console.error('冒烟脚本异常：', err)
  process.exit(2)
})
