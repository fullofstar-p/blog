<script setup>
const year = new Date().getFullYear()
</script>

<template>
  <footer class=" mt-16 border-t-2 border-dashed border-pencil bg-paper-deep/60">
    <div class="mx-auto grid max-w-6xl gap-8 px-4 py-12 md:grid-cols-3 md:px-6">
      <div>
        <p class="font-serif text-lg italic text-pencil">✎ 技术分享博客</p>
        <p class="mt-3 max-w-xs font-serif text-sm leading-relaxed text-ink-500">
          一本摊在桌上的手绘笔记：记录后端、前端、数据库与运维的工程实践，也记录踩过的坑。
        </p>
      </div>

      <div>
        <h2 class="font-serif text-base italic text-pencil">翻阅</h2>
        <ul class="mt-3 space-y-1">
          <li>
            <RouterLink :to="{ name: 'home' }" class="sketch-link inline-flex min-h-[44px] items-center">
              首页
            </RouterLink>
          </li>
          <li>
            <RouterLink :to="{ name: 'archive' }" class="sketch-link inline-flex min-h-[44px] items-center">
              归档
            </RouterLink>
          </li>
          <li>
            <RouterLink :to="{ name: 'about' }" class="sketch-link inline-flex min-h-[44px] items-center">
              关于
            </RouterLink>
          </li>
        </ul>
      </div>

      <div>
        <h2 class="font-serif text-base italic text-pencil">本站由这些组成</h2>
        <p class="mt-3 font-serif text-sm leading-relaxed text-ink-500">
          Vue 3 · Tailwind CSS · Spring Boot 3 · MySQL 8 · Redis · MinIO · Docker Compose
        </p>
        <p class="mt-4 font-serif text-xs italic text-ink-300">
          © {{ year }} 技术分享博客 · 手绘素描本风格
        </p>
      </div>
    </div>
  </footer>
</template>
