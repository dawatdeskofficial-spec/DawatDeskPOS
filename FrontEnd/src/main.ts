import { createApp } from 'vue'
import { createPinia } from 'pinia'
import VueApexCharts from 'vue3-apexcharts'
import App from './App.vue'
import router from './router'
import './style.css'

const app = createApp(App)

app.use(createPinia())
app.use(router)
app.use(VueApexCharts)

app.mount('#app')

// Register Service Worker for offline PWA app shell
if (typeof window !== 'undefined' && 'serviceWorker' in navigator && (import.meta.env.PROD || import.meta.env.MODE === 'production')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        console.log('[ServiceWorker] Registered successfully with scope:', reg.scope)
      })
      .catch((err) => {
        console.warn('[ServiceWorker] Registration failed:', err)
      })
  })
}

