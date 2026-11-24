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

export const isPageVisible = ref(typeof document !== 'undefined' ? !document.hidden : true)

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    isPageVisible.value = !document.hidden
  })
}

/**
 * Creates an interval timer that automatically pauses when the browser tab is hidden/minimized
 * and resumes immediately with an immediate refresh call when the tab is focused.
 */
export function createVisibleInterval(callback: () => void, ms: number) {
  let intervalId: any = null

  const start = () => {
    if (!intervalId && (typeof document === 'undefined' || !document.hidden)) {
      intervalId = setInterval(callback, ms)
    }
  }

  const stop = () => {
    if (intervalId) {
      clearInterval(intervalId)
      intervalId = null
    }
  }

  if (typeof document !== 'undefined') {
    const onVisibilityChange = () => {
      if (document.hidden) {
        stop()
      } else {
        try {
          callback()
        } catch {}
        start()
      }
    }

    document.addEventListener('visibilitychange', onVisibilityChange)
    start()

    return () => {
      stop()
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }

  start()
  return stop
}
