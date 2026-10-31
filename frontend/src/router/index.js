import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/store/auth'

const routes = [
  {
    path: '/',
    name: 'home',
    component: () => import('@/views/Home.vue'),
    meta: { title: '首页' }
  },
  {
    path: '/article/:id',
    name: 'article',
    component: () => import('@/views/ArticleDetail.vue'),
    props: true,
    meta: { title: '文章详情' }
  },
  {
    path: '/category/:id',
    name: 'category',
    component: () => import('@/views/CategoryPage.vue'),
    props: true,
    meta: { title: '分类' }
  },
  {
    path: '/tag/:id',
    name: 'tag',
    component: () => import('@/views/TagPage.vue'),
    props: true,
    meta: { title: '标签' }
  },
  {
    path: '/archive',
    name: 'archive',
    component: () => import('@/views/ArchivePage.vue'),
    meta: { title: '归档' }
  },
  {
    path: '/search',
    name: 'search',
    component: () => import('@/views/SearchPage.vue'),
    meta: { title: '搜索' }
  },
  {
    path: '/about',
    name: 'about',
    component: () => import('@/views/AboutPage.vue'),
    meta: { title: '关于' }
  },
  {
    path: '/login',
    name: 'login',
    component: () => import('@/views/Login.vue'),
    meta: { title: '登录' }
  },
  {
    path: '/register',
    name: 'register',
    component: () => import('@/views/Register.vue'),
    meta: { title: '注册' }
  },
  {
    path: '/profile',
    name: 'profile',
    component: () => import('@/views/Profile.vue'),
    meta: { title: '个人中心', requiresAuth: true }
  },
  {
    path: '/notifications',
    name: 'notifications',
    component: () => import('@/views/Notifications.vue'),
    meta: { title: '消息通知', requiresAuth: true }
  },
  {
    path: '/admin',
    component: () => import('@/components/AdminLayout.vue'),
    meta: { requiresAuth: true, requiresAdmin: true },
    children: [
      { path: '', redirect: { name: 'admin-dashboard' } },
      {
        path: 'dashboard',
        name: 'admin-dashboard',
        component: () => import('@/views/admin/AdminDashboard.vue'),
        meta: { title: '内容看板' }
      },
      {
        path: 'articles',
        name: 'admin-articles',
        component: () => import('@/views/admin/AdminArticles.vue'),
        meta: { title: '文章管理' }
      },
      {
        path: 'articles/new',
        name: 'admin-article-new',
        component: () => import('@/views/admin/AdminArticleEdit.vue'),
        meta: { title: '写文章' }
      },
      {
        path: 'articles/:id/edit',
        name: 'admin-article-edit',
        component: () => import('@/views/admin/AdminArticleEdit.vue'),
        props: true,
        meta: { title: '编辑文章' }
      },
      {
        path: 'recycle',
        name: 'admin-recycle',
        component: () => import('@/views/admin/AdminRecycle.vue'),
        meta: { title: '回收站' }
      },
      {
        path: 'comments',
        name: 'admin-comments',
        component: () => import('@/views/admin/AdminComments.vue'),
        meta: { title: '评论审核' }
      },
      {
        path: 'categories',
        name: 'admin-categories',
        component: () => import('@/views/admin/AdminCategories.vue'),
        meta: { title: '分类管理' }
      },
      {
        path: 'tags',
        name: 'admin-tags',
        component: () => import('@/views/admin/AdminTags.vue'),
        meta: { title: '标签管理' }
      },
      {
        path: 'users',
        name: 'admin-users',
        component: () => import('@/views/admin/AdminUsers.vue'),
        meta: { title: '用户管理' }
      }
    ]
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: () => import('@/views/NotFound.vue'),
    meta: { title: '页面不存在' }
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) return savedPosition
    return { top: 0 }
  }
})

/** 路由守卫：requiresAuth 校验登录，requiresAdmin 校验 ADMIN 角色 */
router.beforeEach(async (to) => {
  const auth = useAuthStore()
  const needAuth = Boolean(to.meta.requiresAuth || to.meta.requiresAdmin)

  if (!needAuth) return true

  if (!auth.isLoggedIn) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }

  if (!auth.user) {
    try {
      await auth.loadMe()
    } catch (error) {
      console.warn('[router] 用户信息加载失败', error)
      return { name: 'login', query: { redirect: to.fullPath } }
    }
  }

  if (to.meta.requiresAdmin && !auth.isAdmin) {
    return { name: 'home' }
  }

  return true
})

router.afterEach((to) => {
  const base = '技术分享博客'
  document.title = to.meta && to.meta.title ? `${to.meta.title} · ${base}` : base
})

export default router
