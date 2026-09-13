import { ref, computed } from 'vue'

export type NetworkState = 'ONLINE' | 'OFFLINE' | 'SERVER_UNAVAILABLE' | 'SYNCING'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5001'

class NetworkDetector {
  private _state = ref<NetworkState>(typeof navigator !== 'undefined' && navigator.onLine ? 'ONLINE' : 'OFFLINE')
  private _isChecking = false
  private _checkTimer: any = null
  private _consecutiveFailures = 0
  private _listeners: Array<(state: NetworkState) => void> = []

  public state = computed(() => this._state.value)
  public isOnline = computed(() => this._state.value === 'ONLINE' || this._state.value === 'SYNCING')
  public isOfflineOrUnavailable = computed(() => this._state.value === 'OFFLINE' || this._state.value === 'SERVER_UNAVAILABLE')

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.handleBrowserOnline())
      window.addEventListener('offline', () => this.handleBrowserOffline())

      // Initial check
      setTimeout(() => this.checkHealth(), 1000)
      this.startHeartbeat()
    }
  }

  public subscribe(listener: (state: NetworkState) => void): () => void {
    this._listeners.push(listener)
    return () => {
      this._listeners = this._listeners.filter((l) => l !== listener)
    }
  }

  private notifyListeners(newState: NetworkState) {
    this._listeners.forEach((listener) => {
      try {
        listener(newState)
      } catch (err) {
        console.error('[NetworkDetector] Listener error:', err)
      }
    })
  }

  public setState(newState: NetworkState) {
    if (this._state.value !== newState) {
      const prev = this._state.value
      this._state.value = newState
      console.log(`[NetworkDetector] State changed: ${prev} -> ${newState}`)
      this.notifyListeners(newState)
    }
  }

  public setSyncing(isSyncing: boolean) {
    if (isSyncing) {
      if (this._state.value === 'ONLINE') {
        this.setState('SYNCING')
      }
    } else {
      if (this._state.value === 'SYNCING') {
        this.setState('ONLINE')
      }
    }
  }

  private handleBrowserOnline() {
    console.log('[NetworkDetector] Browser reported online event')
    this.checkHealth()
  }

  private handleBrowserOffline() {
    console.log('[NetworkDetector] Browser reported offline event')
    this.setState('OFFLINE')
  }

  public async checkHealth(): Promise<boolean> {
    if (typeof window === 'undefined') return true
    if (!navigator.onLine) {
      this.setState('OFFLINE')
      return false
    }

    if (this._isChecking) return this.isOnline.value
    this._isChecking = true

    const base = API_BASE_URL.replace(/\/$/, '')
    const healthUrl = `${base}/api/health?t=${Date.now()}`

    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 4000)

      const response = await fetch(healthUrl, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        signal: controller.signal,
        cache: 'no-store',
      })

      clearTimeout(timeoutId)

      if (response.ok) {
        this._consecutiveFailures = 0
        if (this._state.value !== 'SYNCING') {
          this.setState('ONLINE')
        }
        return true
      } else {
        this._consecutiveFailures++
        this.setState('SERVER_UNAVAILABLE')
        return false
      }
    } catch (error: any) {
      this._consecutiveFailures++
      if (!navigator.onLine) {
        this.setState('OFFLINE')
      } else {
        // Internet is up, but server unreachable
        this.setState('SERVER_UNAVAILABLE')
      }
      return false
    } finally {
      this._isChecking = false
    }
  }

  public reportApiSuccess() {
    this._consecutiveFailures = 0
    if (this._state.value !== 'SYNCING' && this._state.value !== 'ONLINE') {
      this.setState('ONLINE')
    }
  }

  public reportApiFailure(error: any) {
    if (!navigator.onLine) {
      this.setState('OFFLINE')
    } else {
      // If network error, DNS error, connection refused, or 5xx server error
      const msg = error?.message || ''
      const isServerDown =
        msg.includes('Failed to fetch') ||
        msg.includes('NetworkError') ||
        msg.includes('timeout') ||
        msg.includes('ECONNREFUSED') ||
        msg.includes('500') ||
        msg.includes('502') ||
        msg.includes('503') ||
        msg.includes('504')

      if (isServerDown) {
        this.setState('SERVER_UNAVAILABLE')
      }
    }
  }

  private startHeartbeat() {
    const runCheck = async () => {
      await this.checkHealth()

      // Calculate next check delay (faster if down, 10s if online)
      let nextDelay = 15000
      if (this._state.value === 'SERVER_UNAVAILABLE' || this._state.value === 'OFFLINE') {
        // Retry faster when down to quickly detect restoration (5s -> 10s -> 20s backoff max)
        nextDelay = Math.min(5000 * Math.max(1, Math.min(this._consecutiveFailures, 4)), 25000)
      }

      this._checkTimer = setTimeout(runCheck, nextDelay)
    }

    this._checkTimer = setTimeout(runCheck, 10000)
  }

  public destroy() {
    if (this._checkTimer) clearTimeout(this._checkTimer)
  }
}

export const networkDetector = new NetworkDetector()
