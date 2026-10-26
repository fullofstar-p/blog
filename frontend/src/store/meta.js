import { ref } from 'vue'
import { defineStore } from 'pinia'
import { listCategories } from '@/api/category'
import { listTags } from '@/api/tag'

/**
 * 公共元数据 store：分类、标签只加载一次，供导航 / 侧栏 / 编辑页复用。
 */
export const useMetaStore = defineStore('meta', () => {
  const categories = ref([])
  const tags = ref([])
  const categoriesLoaded = ref(false)
  const tagsLoaded = ref(false)

  async function loadCategories(force = false) {
    if (!force && categoriesLoaded.value) return categories.value
    const data = await listCategories()
    categories.value = Array.isArray(data) ? data : []
    categoriesLoaded.value = true
    return categories.value
  }

  async function loadTags(force = false) {
    if (!force && tagsLoaded.value) return tags.value
    const data = await listTags()
    tags.value = Array.isArray(data) ? data : []
    tagsLoaded.value = true
    return tags.value
  }

  function reset() {
    categories.value = []
    tags.value = []
    categoriesLoaded.value = false
    tagsLoaded.value = false
  }

  return { categories, tags, loadCategories, loadTags, reset }
})
