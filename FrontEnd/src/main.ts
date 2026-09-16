import { createApp } from 'vue'
import { createPinia } from 'pinia'
import VueApexCharts from 'vue3-apexcharts'
import App from './App.vue'
import router from './router'
import './style.css'

// Proactively unregister any legacy service workers and clear browser cache storage to prevent blank page issues
if (typeof window !== 'undefined') {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      for (const registration of registrations) {
        registration.unregister().then((success) => {
          if (success) {
            console.log('[App] Unregistered stale service worker');
          }
        });
      }
    }).catch(() => {});
  }

  if ('caches' in window) {
    caches.keys().then((keys) => {
      for (const key of keys) {
        caches.delete(key);
      }
    }).catch(() => {});
  }
}

const app = createApp(App)

app.use(createPinia())
app.use(router)
app.use(VueApexCharts)

app.mount('#app')
