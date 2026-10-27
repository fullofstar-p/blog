import { createApp } from 'vue'
import { createPinia } from 'pinia'
import 'md-editor-v3/lib/style.css'
// 预览主题 CSS 本地引入，避免 md-editor-v3 运行时从 CDN 拉取导致离线部署样式缺失
import 'md-editor-v3/lib/preview.css'
import './styles/main.css'
import './styles/markdown.css'
// 阅读页白纸外壳与阅读态代码块 chrome，需在 markdown.css 之后引入以覆盖
import './styles/markdown-reading.css'
import App from './App.vue'
import router from './router'

const app = createApp(App)

app.use(createPinia())
app.use(router)
app.mount('#app')
