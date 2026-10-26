/**
 * 为本地前端冒烟演示准备数据：3 篇已发布文章（含封面/标签/评论/点赞），1 篇草稿。
 * 前置：backend 已启动；默认连接 http://127.0.0.1:8080（可用 API_BASE 覆盖）。
 * 运行：node scripts/seed-demo.mjs
 */
const BASE = process.env.API_BASE || 'http://127.0.0.1:8080'

const PNG_COVER = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAGQAAABLCAYAAAA0YQ0kAAAAF0lEQVR42u3BAQEAAACCIP+vbkhAAQAAAAB4GQIAAAF6j0gAAAAASUVORK5CYII=',
  'base64'
)

async function api(method, path, { token, body } = {}) {
  const headers = {}
  if (token) headers.Authorization = `Bearer ${token}`
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  const res = await fetch(BASE + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) })
  const text = await res.text()
  try { return { status: res.status, json: JSON.parse(text) } } catch { return { status: res.status, text } }
}

async function uploadCover(token) {
  const form = new FormData()
  form.append('file', new Blob([PNG_COVER], { type: 'image/png' }), 'cover.png')
  form.append('category', 'cover')
  const res = await fetch(BASE + '/api/files/upload', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form
  })
  const json = await res.json()
  return json.data && json.data.url
}

const ARTICLES = [
  {
    title: '用 Tailwind 画一本手绘素描本：Sketch Style 实践',
    summary: '把纸张纹理、虚线边框、铅笔阴影和轻微倾斜组合起来，让前端界面像一页摊开的速写本。',
    content: [
      '# 为什么是手绘风',
      '',
      '技术博客不该只有冷冰冰的白色卡片。**Sketch Style** 用纸张色、衬线斜体、虚线边框和手绘阴影，把内容放回一本摊开的笔记里。',
      '',
      '## 设计令牌',
      '',
      '- 纸张米色 `#f5f0e8`',
      '- 铅笔灰 `#2c2c2c`',
      '- 手绘阴影 `3px 3px 0 rgba(44,44,44,.15)`',
      '',
      '```js',
      "const sketch = (paper) => paper + ' is a notebook'",
      "console.log(sketch('a page'))",
      '```',
      '',
      '> 好的排版不是装饰，而是让读者愿意停下来。',
      '',
      '## 交互细节',
      '',
      'hover 时线框涂黑反白，active 时减少阴影并轻微倾斜，模拟笔尖压纸的阻尼感；所有动画都在 `prefers-reduced-motion` 下关闭。'
    ].join('\n'),
    category: '前端开发',
    tags: ['Tailwind CSS', 'Vue3']
  },
  {
    title: 'Spring Boot 3 + MyBatis-Plus 的文章详情缓存与阅读量落库',
    summary: 'Redis 先计数、定时任务批量落库，缓存详情 10 分钟并在写操作时失效——一套不高并发但足够稳的组合。',
    content: [
      '# 阅读量为什么不能直接写库',
      '',
      '每次文章详情都 `UPDATE article SET view_count = view_count + 1`，在热点文章上会放大行锁竞争。更稳的做法是：',
      '',
      '1. 详情读取时在 Redis 上 `INCR`；',
      '2. 定时任务每 60 秒把增量写回 MySQL；',
      '3. 写操作主动失效详情缓存。',
      '',
      '```java',
      'Long delta = redis.opsForValue().increment("article:views:" + id);',
      'articleMapper.update(null, new LambdaUpdateWrapper<Article>()',
      '        .eq(Article::getId, id)',
      '        .setSql("view_count = view_count + " + delta));',
      '```',
      '',
      '## 一个容易忽略的坑',
      '',
      '详情缓存里的 `viewCount` 是写入缓存那一刻的快照；定时落库后 Redis 增量会归零，如果直接用缓存值合并，阅读量会**回跳**。所以基数要始终从数据库当前值取。'
    ].join('\n'),
    category: '后端开发',
    tags: ['Java', 'Spring Boot', 'Redis']
  },
  {
    title: 'Docker Compose 一键部署：MySQL + Redis + MinIO + 前后端',
    summary: '五个服务、三条健康检查、两个多阶段 Dockerfile，把本地跑通的项目原样搬到服务器。',
    content: [
      '# 一条命令起整套环境',
      '',
      '```bash',
      'cp .env.example .env',
      'docker compose up -d --build',
      '```',
      '',
      '## 服务拆分',
      '',
      '| 服务 | 作用 |',
      '| --- | --- |',
      '| mysql | 业务数据 |',
      '| redis | 缓存 / 阅读量 / Token |',
      '| minio | 头像、封面、Markdown 插图 |',
      '| backend | Spring Boot API |',
      '| frontend | Nginx 静态资源 + /api 反代 |',
      '',
      '## 上线前检查',
      '',
      '- `.env` 里的数据库密码、JWT 密钥、MinIO 凭证必须改掉；',
      '- MinIO bucket 由后端启动时创建并设置公共读；',
      '- Nginx 的 `/api` 反代要保留 `/api` 前缀，且用 `^~` 避免被静态资源正则截走。'
    ].join('\n'),
    category: '运维部署',
    tags: ['Docker', 'MinIO', 'MySQL']
  }
]

async function main() {
  const login = await api('POST', '/api/auth/login', { body: { username: 'admin', password: 'admin123456' } })
  const token = login.json && login.json.data && login.json.data.accessToken
  if (!token) throw new Error('管理员登录失败: ' + JSON.stringify(login))

  const cats = (await api('GET', '/api/categories')).json.data
  const tags = (await api('GET', '/api/tags')).json.data
  const catByName = Object.fromEntries(cats.map((c) => [c.name, c.id]))
  const tagByName = Object.fromEntries(tags.map((t) => [t.name, t.id]))

  const cover = await uploadCover(token)
  const created = []
  for (let i = 0; i < ARTICLES.length; i++) {
    const a = ARTICLES[i]
    const res = await api('POST', '/api/articles', {
      token,
      body: {
        title: a.title,
        summary: a.summary,
        content: a.content,
        cover: cover || undefined,
        categoryId: catByName[a.category] || null,
        tagIds: a.tags.map((t) => tagByName[t]).filter(Boolean),
        status: 1,
        isTop: i === 0 ? 1 : 0
      }
    })
    if (res.json && res.json.code === 200) created.push(res.json.data)
    else console.log('创建失败', a.title, JSON.stringify(res))
  }

  // 草稿
  await api('POST', '/api/articles', {
    token,
    body: {
      title: '【草稿】下一篇想写什么？',
      summary: '草稿只对作者和管理员可见。',
      content: '# 草稿\n\n还没写完。',
      categoryId: catByName['后端开发'] || null,
      tagIds: [],
      status: 0
    }
  })

  // 评论 + 审核 + 点赞（用 tester 账号，若不存在则注册）
  let userLogin = await api('POST', '/api/auth/login', { body: { username: 'tester', password: 'test123456' } })
  if (!userLogin.json || userLogin.json.code !== 200) {
    await api('POST', '/api/auth/register', { body: { username: 'tester', password: 'test123456', nickname: '冒烟测试用户' } })
    userLogin = await api('POST', '/api/auth/login', { body: { username: 'tester', password: 'test123456' } })
  }
  const userToken = userLogin.json && userLogin.json.data && userLogin.json.data.accessToken

  for (const article of created) {
    if (!userToken) break
    const c1 = await api('POST', '/api/comments', {
      token: userToken,
      body: { articleId: article.id, content: '这篇笔记很实用，收藏了！' }
    })
    const c2 = await api('POST', '/api/comments', {
      token: userToken,
      body: { articleId: article.id, content: '手绘风那一段能再展开讲讲吗？' }
    })
    for (const c of [c1, c2]) {
      if (c.json && c.json.data && c.json.data.id) {
        await api('PUT', `/api/admin/comments/${c.json.data.id}/audit`, { token, body: { status: 1 } })
        await api('POST', `/api/comments/${c.json.data.id}/like`, { token: userToken })
      }
    }
    // 二级回复
    if (c1.json && c1.json.data && c1.json.data.id) {
      const reply = await api('POST', '/api/comments', {
        token,
        body: { articleId: article.id, parentId: c1.json.data.id, content: '感谢支持，后面会补一篇细节。' }
      })
      if (reply.json && reply.json.data && reply.json.data.id) {
        await api('PUT', `/api/admin/comments/${reply.json.data.id}/audit`, { token, body: { status: 1 } })
      }
    }
  }

  console.log('演示数据准备完成：')
  created.forEach((a) => console.log(` - #${a.id} ${a.title}`))
  console.log(`分类：${cats.map((c) => c.name).join(' / ')}`)
  console.log(`标签：${tags.map((t) => t.name).join(' / ')}`)
}

main().catch((err) => {
  console.error('seed failed:', err)
  process.exit(1)
})
