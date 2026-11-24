import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import './style.css'

// Proactively unregister any legacy service workers to prevent blank page issues
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
}

const app = createApp(App)

app.config.errorHandler = (err, instance, info) => {
  console.error('[Vue Error]:', err, info)
}

app.use(createPinia())
app.use(router)

app.mount('#app')
