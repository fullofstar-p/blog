<script setup>
import { computed, onMounted, ref } from 'vue'
import { getArchive } from '@/api/article'

const archive = ref([])
const loading = ref(false)
const error = ref('')

const totalArticles = computed(() =>
  archive.value.reduce(
    (sum, year) => sum + (year.months || []).reduce((count, month) => count + (month.count || 0), 0),
    0
  )
)
const totalMonths = computed(() =>
  archive.value.reduce((sum, year) => sum + (year.months ? year.months.length : 0), 0)
)

const stack = [
  'Vue 3 · Composition API',
  'Tailwind CSS · Sketch Style',
  'Spring Boot 3 · JDK 17',
  'Spring Security · JWT',
  'MyBatis-Plus',
  'MySQL 8 · Redis',
  'MinIO · S3 兼容存储',
  'Docker Compose'
]

async function load() {
  loading.value = true
  error.value = ''
  try {
    const data = await getArchive()
    archive.value = Array.isArray(data) ? data : []
  } catch (err) {
    error.value = (err && err.message) || '统计数据加载失败'
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<template>
  <div class="mx-auto max-w-6xl px-4 py-16 md:px-6 md:py-24">
    <header class="mb-12 border-b-2 border-dashed border-pencil/50 pb-8">
      <p class="font-serif text-sm italic text-ink-500">关于 · 这本手绘笔记</p>
      <h1 class="mt-2 font-serif text-3xl italic leading-tight text-pencil md:text-5xl">
        写给爱翻旧笔记的<span class="sketch-wavy text-sketchgreen">你</span>
      </h1>
      <p class="mt-4 max-w-2xl font-serif text-base leading-relaxed text-ink-500">
        这是一个技术分享博客。它不追求冷冰冰的精致排版，而是保留草稿、批注与折角——像一本摊在桌上、随手可写的手绘笔记。
      </p>
    </header>

    <div class="grid gap-6 md:grid-cols-3 md:gap-8">
      <section class="sketch-card rotate-[-0.4deg] p-6 md:p-8">
        <h2 class="font-serif text-xl italic text-pencil">写了多少</h2>
        <div v-if="loading" class="mt-4 space-y-2">
          <div class="sketch-skeleton h-8 w-20"></div>
          <div class="sketch-skeleton h-4 w-28"></div>
        </div>
        <p v-else-if="error" class="mt-4 font-serif text-sm italic text-sketchred" role="alert">
          {{ error }}
          <button type="button" class="sketch-link mt-2 block" @click="load">重新加载</button>
        </p>
        <template v-else>
          <p class="mt-4 font-serif text-4xl italic text-pencil">{{ totalArticles }}</p>
          <p class="mt-1 font-serif text-sm italic text-ink-500">篇文章，分布在 {{ totalMonths }} 个月里</p>
        </template>
      </section>

      <section class="sketch-card rotate-[0.4deg] p-6 md:p-8">
        <h2 class="font-serif text-xl italic text-pencil">技术栈</h2>
        <ul class="mt-4 space-y-2">
          <li
            v-for="item in stack"
            :key="item"
            class="border-b border-dashed border-pencil/30 pb-1 font-serif text-sm text-ink-700"
          >
            {{ item }}
          </li>
        </ul>
      </section>

      <section class="sketch-card rotate-[-0.4deg] p-6 md:p-8">
        <h2 class="font-serif text-xl italic text-pencil">写作方式</h2>
        <ul class="mt-4 space-y-3 font-serif text-sm leading-relaxed text-ink-700">
          <li>✎ Markdown 手写正文，代码块单独加注释</li>
          <li>✎ 每篇文章都可能被后来的自己划掉重写</li>
          <li>✎ 评论需要审核，但欢迎任何认真讨论</li>
        </ul>
      </section>
    </div>

    <section class="sketch-card mt-10 rotate-[0.2deg] p-6 md:p-8">
      <h2 class="font-serif text-2xl italic text-pencil md:text-3xl">联系</h2>
      <p class="mt-3 max-w-2xl font-serif text-sm leading-relaxed text-ink-500">
        想知道某个实现细节，或者发现了笔记里的错误？在任意文章下留言即可；管理员审核通过后，讨论会留在原地。
      </p>
      <RouterLink :to="{ name: 'home' }" class="sketch-btn sketch-btn-primary mt-4 inline-flex min-h-[44px] px-5">
        去读文章
      </RouterLink>
    </section>
  </div>
</template>
