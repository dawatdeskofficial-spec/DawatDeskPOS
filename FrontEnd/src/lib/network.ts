import { ref } from 'vue'

export type ConnectionState = 'ONLINE' | 'OFFLINE' | 'SYNCING' | 'SYNC_COMPLETED' | 'SYNC_FAILED'

export const isOnline = ref(typeof navigator !== 'undefined' ? navigator.onLine : true)
export const connectionState = ref<ConnectionState>(isOnline.value ? 'ONLINE' : 'OFFLINE')
export const queuedOperationsCount = ref<number>(0)

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    isOnline.value = true
    connectionState.value = 'SYNCING'
    // Simulate completing synchronization of any cached data
    setTimeout(() => {
      connectionState.value = 'SYNC_COMPLETED'
      setTimeout(() => {
        connectionState.value = 'ONLINE'
      }, 2500)
    }, 1200)
  })

  window.addEventListener('offline', () => {
    isOnline.value = false
    connectionState.value = 'OFFLINE'
  })
}

export function setSyncing(syncing: boolean) {
  if (!isOnline.value) {
    connectionState.value = 'OFFLINE'
    return
  }
  connectionState.value = syncing ? 'SYNCING' : 'ONLINE'
}
