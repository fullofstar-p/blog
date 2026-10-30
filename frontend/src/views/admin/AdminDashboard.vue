<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import SketchButton from '@/components/SketchButton.vue'
import SketchLoading from '@/components/SketchLoading.vue'
import { getAdminDashboard } from '@/api/admin'
import { formatDate, formatViews } from '@/utils/format'

const dashboard = ref(null)
const loading = ref(true)
const refreshing = ref(false)
const error = ref('')
const days = ref(30)
const hoverIndex = ref(null)
const rangeOptions = [7, 30, 90]

let refreshTimer = null

async function load(showLoading = true) {
  if (showLoading) loading.value = true
  refreshing.value = true
  error.value = ''
  try {
    dashboard.value = await getAdminDashboard({ days: days.value })
  } catch (err) {
    error.value = (err && err.message) || '看板数据加载失败'
  } finally {
    loading.value = false
    refreshing.value = false
  }
}

function changeDays(value) {
  if (value === days.value) return
  days.value = value
  load()
}

function formatCount(value) {
  return Number(value || 0).toLocaleString('zh-CN')
}

const totals = computed(() => dashboard.value?.totals || {})
const today = computed(() => dashboard.value?.today || {})
const range = computed(() => dashboard.value?.range || {})
const publish = computed(() => dashboard.value?.publish || {})
const trend = computed(() => dashboard.value?.trend || [])
const topArticles = computed(() => dashboard.value?.topArticles || [])

function niceMax(value) {
  if (!Number.isFinite(value) || value <= 0) return 1
  const power = Math.pow(10, Math.max(0, Math.floor(Math.log10(value))))
  const normalized = value / power
  const step = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10
  return step * power
}

/** SVG 折线图：PV、UV 共用一条 Y 轴，hover 显示当天数据 */
const chart = computed(() => {
  const data = trend.value
  if (data.length === 0) return null
  const width = 760
  const height = 248
  const left = 46
  const right = 18
  const top = 18
  const bottom = 36
  const plotWidth = width - left - right
  const plotHeight = height - top - bottom

  const maxValue = Math.max(1, ...data.map((item) => item.pv), ...data.map((item) => item.uv))
  const maxY = niceMax(maxValue)
  const step = data.length > 1 ? plotWidth / (data.length - 1) : 0
  const x = (index) => left + step * index
  const y = (value) => top + plotHeight - (value / maxY) * plotHeight

  const pvPoints = data.map((item, index) => ({
    x: x(index),
    y: y(item.pv),
    pv: item.pv,
    uv: item.uv,
    date: item.date
  }))
  const uvPoints = data.map((item, index) => ({
    x: x(index),
    y: y(item.uv),
    pv: item.pv,
    uv: item.uv,
    date: item.date
  }))
  const pvPath = pvPoints.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(' ')
  const uvPath = uvPoints.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(' ')
  const lastX = x(data.length - 1)
  const areaPath = `${pvPath} L ${lastX.toFixed(1)} ${(top + plotHeight).toFixed(1)} L ${left} ${(top + plotHeight).toFixed(1)} Z`
  const yTicks = [maxY, Math.round(maxY / 2), 0].map((value) => ({ value, y: y(value) }))
  const labelStep = Math.max(1, Math.ceil(data.length / 6))
  const xLabels = data
    .map((item, index) => ({ date: item.date, index }))
    .filter((item) => item.index % labelStep === 0 || item.index === data.length - 1)

  return {
    width,
    height,
    left,
    right,
    top,
    plotTop: top,
    plotBottom: top + plotHeight,
    step,
    hitWidth: Math.max(8, step),
    pvPoints,
    uvPoints,
    pvPath,
    uvPath,
    areaPath,
    yTicks,
    xLabels
  }
})

const hoverPoint = computed(() => {
  if (hoverIndex.value === null || !chart.value) return null
  return chart.value.pvPoints[hoverIndex.value] || null
})

const tooltipStyle = computed(() => {
  const point = hoverPoint.value
  const chartValue = chart.value
  if (!point || !chartValue) return {}
  const leftPercent = Math.min(86, Math.max(14, (point.x / chartValue.width) * 100))
  const topPercent = Math.min(78, Math.max(0, (point.y / chartValue.height) * 100))
  return { left: `${leftPercent}%`, top: `${topPercent}%` }
})

const allTrendZero = computed(() => trend.value.every((item) => !item.pv && !item.uv))

const heat = computed(() => {
  const data = publish.value?.days || []
  if (data.length === 0) return { weeks: [], months: [], maxCount: 1 }
  const first = new Date(`${data[0].date}T00:00:00`)
  const pad = (first.getDay() + 6) % 7
  const cells = [...Array(pad).fill(null), ...data]
  while (cells.length % 7 !== 0) cells.push(null)
  const weeks = []
  for (let index = 0; index < cells.length; index += 7) {
    weeks.push(cells.slice(index, index + 7))
  }
  let lastMonth = ''
  const months = weeks.map((week) => {
    const day = week.find(Boolean)
    if (!day) return ''
    const month = day.date.slice(5, 7)
    if (month !== lastMonth) {
      lastMonth = month
      return `${Number(month)}月`
    }
    return ''
  })
  return {
    weeks,
    months,
    maxCount: Math.max(1, publish.value?.maxCount || 1)
  }
})

function heatLevel(day) {
  if (!day || !day.count) return 0
  const ratio = day.count / heat.value.maxCount
  if (ratio <= 0.25) return 1
  if (ratio <= 0.5) return 2
  if (ratio <= 0.75) return 3
  return 4
}

const weekdayLabels = ['一', '', '三', '', '五', '', '日']
const levelClasses = ['heat-0', 'heat-1', 'heat-2', 'heat-3', 'heat-4']

onMounted(() => {
  load()
  refreshTimer = window.setInterval(() => load(false), 60_000)
})

onBeforeUnmount(() => {
  if (refreshTimer) window.clearInterval(refreshTimer)
})
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 class="font-serif text-2xl italic text-pencil md:text-3xl">内容看板</h2>
        <p class="mt-1 font-serif text-sm italic text-ink-500">
          实时 PV/UV、阅读趋势、热门文章与发布热力图；数据每 60 秒自动刷新。
        </p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <div class="flex border-2 border-dashed border-pencil/50 p-1" role="group" aria-label="统计区间">
          <button
            v-for="option in rangeOptions"
            :key="option"
            type="button"
            class="min-h-[44px] px-3 font-serif text-sm italic transition-colors"
            :class="days === option ? 'bg-pencil text-paper' : 'text-ink-700 hover:bg-pencil/10'"
            :aria-pressed="days === option ? 'true' : 'false'"
            @click="changeDays(option)"
          >
            近 {{ option }} 天
          </button>
        </div>
        <SketchButton variant="ghost" :disabled="refreshing" @click="load(false)">
          {{ refreshing ? '刷新中…' : '↻ 刷新' }}
        </SketchButton>
      </div>
    </div>

    <SketchLoading v-if="loading" :rows="4" label="正在加载内容看板" />

    <div
      v-else-if="error"
      class="flex flex-col items-start gap-3 border-2 border-dashed border-sketchred/60 bg-paper-soft/70 p-5"
    >
      <p class="font-serif text-sm italic text-sketchred" role="alert">{{ error }}</p>
      <button type="button" class="sketch-btn min-h-[44px] px-4" @click="load">重新加载</button>
    </div>

    <template v-else-if="dashboard">
      <!-- 概览卡片 -->
      <section class="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="内容概览">
        <div class="sketch-card p-4 md:p-5">
          <p class="font-serif text-xs italic text-ink-300">今日访问</p>
          <p class="mt-2 font-serif text-3xl italic text-pencil">{{ formatCount(today.pv) }}</p>
          <p class="mt-1 font-serif text-xs italic text-ink-500">
            UV {{ formatCount(today.uv) }} · {{ today.date || '—' }}
          </p>
        </div>
        <div class="sketch-card p-4 md:p-5">
          <p class="font-serif text-xs italic text-ink-300">近 {{ range.days || days }} 天访问</p>
          <p class="mt-2 font-serif text-3xl italic text-pencil">{{ formatCount(range.pv) }}</p>
          <p class="mt-1 font-serif text-xs italic text-ink-500">
            UV（按日去重合计）{{ formatCount(range.uv) }}
          </p>
        </div>
        <div class="sketch-card p-4 md:p-5">
          <p class="font-serif text-xs italic text-ink-300">总阅读量</p>
          <p class="mt-2 font-serif text-3xl italic text-pencil">{{ formatViews(totals.views) }}</p>
          <p class="mt-1 font-serif text-xs italic text-ink-500">
            已发布 {{ formatCount(totals.published) }} · 草稿 {{ formatCount(totals.drafts) }}
          </p>
        </div>
        <div class="sketch-card p-4 md:p-5">
          <p class="font-serif text-xs italic text-ink-300">内容与互动</p>
          <p class="mt-2 font-serif text-3xl italic text-pencil">{{ formatCount(totals.articles) }}</p>
          <p class="mt-1 font-serif text-xs italic text-ink-500">
            文章 · {{ formatCount(totals.comments) }} 评论 · {{ formatCount(totals.users) }} 用户
          </p>
        </div>
      </section>

      <!-- 阅读趋势 -->
      <section class="sketch-card p-4 md:p-6" aria-label="阅读趋势">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 class="font-serif text-xl italic text-pencil">阅读趋势</h3>
            <p class="mt-0.5 font-serif text-xs italic text-ink-500">
              {{ range.startDate || '—' }} ~ {{ range.endDate || '—' }}
            </p>
          </div>
          <div class="flex items-center gap-4 font-serif text-xs italic text-ink-500">
            <span class="inline-flex items-center gap-1">
              <span class="h-0.5 w-4 bg-sketchblue" aria-hidden="true"></span> PV
            </span>
            <span class="inline-flex items-center gap-1">
              <span class="h-0.5 w-4 border-t-2 border-dashed border-sketchred" aria-hidden="true"></span> UV
            </span>
          </div>
        </div>

        <div v-if="chart" class="relative mt-4">
          <svg
            :viewBox="`0 0 ${chart.width} ${chart.height}`"
            class="h-auto w-full overflow-visible"
            role="img"
            aria-label="PV 与 UV 阅读趋势折线图"
          >
            <g v-for="tick in chart.yTicks" :key="tick.value">
              <line
                :x1="chart.left"
                :x2="chart.width - chart.right"
                :y1="tick.y"
                :y2="tick.y"
                stroke="currentColor"
                class="text-pencil/15"
                stroke-dasharray="3 4"
              />
              <text
                :x="chart.left - 8"
                :y="tick.y + 3"
                text-anchor="end"
                class="fill-current text-pencil-faint"
                font-size="10"
              >
                {{ formatCount(tick.value) }}
              </text>
            </g>

            <path :d="chart.areaPath" class="text-sketchblue" fill="currentColor" fill-opacity="0.14" />
            <path
              :d="chart.pvPath"
              fill="none"
              stroke="currentColor"
              class="text-sketchblue"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
            <path
              :d="chart.uvPath"
              fill="none"
              stroke="currentColor"
              class="text-sketchred"
              stroke-width="1.6"
              stroke-dasharray="4 4"
              stroke-linecap="round"
              opacity="0.85"
            />

            <circle
              v-for="(point, index) in chart.pvPoints"
              :key="`pv-${point.date}`"
              :cx="point.x"
              :cy="point.y"
              :r="hoverIndex === index ? 4 : 2.4"
              class="text-sketchblue"
              fill="currentColor"
              stroke="currentColor"
              stroke-width="1"
              pointer-events="none"
            />
            <circle
              v-for="(point, index) in chart.uvPoints"
              :key="`uv-${point.date}`"
              :cx="point.x"
              :cy="point.y"
              :r="hoverIndex === index ? 3.4 : 2"
              class="text-sketchred"
              fill="currentColor"
              pointer-events="none"
            />

            <g v-for="(point, index) in chart.pvPoints" :key="`hit-${point.date}`">
              <rect
                :x="point.x - chart.hitWidth / 2"
                :y="chart.plotTop"
                :width="chart.hitWidth"
                :height="chart.plotBottom - chart.plotTop"
                fill="transparent"
                @mouseenter="hoverIndex = index"
                @mouseleave="hoverIndex = null"
              />
            </g>

            <text
              v-for="label in chart.xLabels"
              :key="`x-${label.date}`"
              :x="chart.pvPoints[label.index].x"
              :y="chart.height - 12"
              text-anchor="middle"
              class="fill-current text-pencil-faint"
              font-size="10"
            >
              {{ label.date.slice(5) }}
            </text>
          </svg>

          <div
            v-if="hoverPoint"
            class="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-[115%] border-2 border-dashed border-pencil bg-paper px-2.5 py-1.5 font-serif text-xs italic text-pencil shadow-sketchsm"
            :style="tooltipStyle"
          >
            {{ hoverPoint.date }} · PV {{ formatCount(hoverPoint.pv) }} · UV {{ formatCount(hoverPoint.uv) }}
          </div>

          <p
            v-if="allTrendZero"
            class="mt-2 border-l-2 border-dashed border-pencil/40 pl-3 font-serif text-xs italic text-ink-300"
          >
            这个区间还没有访问数据；访问一篇已发布文章后，PV/UV 会在 60 秒内出现在这里。
          </p>
        </div>
      </section>

      <!-- 发布热力图 + 热门文章 -->
      <section class="grid gap-6 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
        <div class="sketch-card min-w-0 p-4 md:p-6" aria-label="发布热力图">
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 class="font-serif text-xl italic text-pencil">发布热力图</h3>
              <p class="mt-0.5 font-serif text-xs italic text-ink-500">
                过去一年每天发布的文章数，类似 GitHub 贡献图
              </p>
            </div>
            <div class="flex flex-wrap gap-2 font-serif text-xs italic">
              <span class="sketch-badge">当前连续 {{ publish.currentStreak || 0 }} 天</span>
              <span class="sketch-badge">最长 {{ publish.longestStreak || 0 }} 天</span>
              <span class="sketch-badge">共 {{ formatCount(publish.total) }} 篇</span>
            </div>
          </div>

          <div class="mt-5 overflow-x-auto pb-2">
            <div class="dashboard-heatmap" role="img" aria-label="过去一年每日发布文章数热力图">
              <div class="dashboard-heatmap-months" aria-hidden="true">
                <span
                  v-for="(month, index) in heat.months"
                  :key="`month-${index}`"
                  class="dashboard-heatmap-month"
                  :style="month ? { left: `${21 + index * 14}px` } : null"
                >
                  {{ month }}
                </span>
              </div>
              <div class="dashboard-heatmap-body">
                <div class="dashboard-heatmap-weekdays" aria-hidden="true">
                  <span v-for="(label, index) in weekdayLabels" :key="`weekday-${index}`" class="dashboard-heatmap-weekday">
                    {{ label }}
                  </span>
                </div>
                <div class="dashboard-heatmap-weeks">
                  <div
                    v-for="(week, weekIndex) in heat.weeks"
                    :key="`week-${weekIndex}`"
                    class="dashboard-heatmap-week"
                  >
                    <span
                      v-for="(day, dayIndex) in week"
                      :key="`day-${weekIndex}-${dayIndex}`"
                      class="dashboard-heatmap-cell"
                      :class="levelClasses[heatLevel(day)]"
                      :title="day ? `${day.date}：${day.count} 篇文章` : ''"
                      :aria-label="day ? `${day.date}：${day.count} 篇文章` : ''"
                    ></span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="mt-3 flex flex-wrap items-center justify-between gap-2 font-serif text-xs italic text-ink-300">
            <span>数据来自已发布文章的创建时间</span>
            <span class="inline-flex items-center gap-1">
              少
              <span
                v-for="level in levelClasses"
                :key="level"
                class="dashboard-heatmap-cell inline-block"
                :class="level"
                aria-hidden="true"
              ></span>
              多
            </span>
          </div>
        </div>

        <div class="sketch-card min-w-0 p-4 md:p-6" aria-label="热门文章">
          <div class="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h3 class="font-serif text-xl italic text-pencil">热门文章</h3>
              <p class="mt-0.5 font-serif text-xs italic text-ink-500">
                {{ range.days || days }} 天窗口内按阅读量排序，没有区间数据时按总阅读量
              </p>
            </div>
            <RouterLink :to="{ name: 'admin-articles' }" class="sketch-link font-serif text-xs italic">
              全部文章 →
            </RouterLink>
          </div>

          <div v-if="topArticles.length === 0" class="mt-6 border-2 border-dashed border-pencil/40 p-5 font-serif text-sm italic text-ink-300">
            还没有可排名的文章。
          </div>
          <ol v-else class="mt-3 divide-y divide-dashed divide-pencil/20">
            <li
              v-for="(article, index) in topArticles"
              :key="article.id"
              class="flex items-start gap-3 py-3"
            >
              <span
                class="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center border border-dashed font-serif text-xs italic"
                :class="index < 3 ? 'border-sketchred/60 text-sketchred' : 'border-pencil/30 text-ink-300'"
              >
                {{ index + 1 }}
              </span>
              <div class="min-w-0 flex-1">
                <RouterLink
                  v-if="article.status === 1"
                  :to="{ name: 'article', params: { id: article.id } }"
                  class="line-clamp-2 font-serif text-sm italic text-pencil underline decoration-dashed underline-offset-4 hover:text-sketchblue"
                >
                  {{ article.title }}
                </RouterLink>
                <RouterLink
                  v-else
                  :to="{ name: 'admin-article-edit', params: { id: article.id } }"
                  class="line-clamp-2 font-serif text-sm italic text-pencil underline decoration-dashed underline-offset-4 hover:text-sketchblue"
                >
                  {{ article.title }}
                </RouterLink>
                <p class="mt-1 truncate font-serif text-xs italic text-ink-300">
                  {{ article.categoryName || '未分类' }} · {{ article.authorName || '—' }} ·
                  总阅读 {{ formatViews(article.viewCount) }} · {{ formatDate(article.createTime) }}
                </p>
              </div>
              <span class="shrink-0 font-serif text-xs italic text-ink-500">
                {{ article.rangePv ? `区间 ${formatCount(article.rangePv)}` : '' }}
              </span>
            </li>
          </ol>
        </div>
      </section>

      <p class="border-l-2 border-dashed border-pencil/30 pl-3 font-serif text-xs italic text-ink-300">
        统计说明：PV 按每次文章详情访问计数；UV 按登录用户 ID 或 IP + User-Agent 哈希后按日去重（HyperLogLog），
        不保存原始 IP；数据先写 Redis，每 60 秒落库。热力图按已发布文章的创建日期统计。
      </p>
    </template>
  </div>
</template>
