import { ref, computed } from 'vue'
import { db, type PendingOperation, type OperationStatus } from './db'
import { networkDetector } from './networkDetector'
import { toast } from 'vue-sonner'
import { buildUrl } from '../api'

const TOKEN_KEY = 'SERVIA_AUTH_TOKEN'

class SyncManager {
  private _isSyncing = ref(false)
  private _pendingCount = ref(0)
  private _failedCount = ref(0)
  private _lastSyncTime = ref<number | null>(null)
  private _syncListeners: Array<(event: { type: string; details?: any }) => void> = []

  public isSyncing = computed(() => this._isSyncing.value)
  public pendingCount = computed(() => this._pendingCount.value)
  public failedCount = computed(() => this._failedCount.value)
  public lastSyncTime = computed(() => this._lastSyncTime.value)

  constructor() {
    if (typeof window !== 'undefined') {
      this.refreshCounts()

      // Auto-trigger sync when network transitions to ONLINE
      networkDetector.subscribe((state) => {
        if (state === 'ONLINE') {
          this.syncPendingOperations({ silent: false })
        }
      })

      // Initial check on startup
      setTimeout(() => {
        if (networkDetector.isOnline.value) {
          this.syncPendingOperations({ silent: true })
        }
      }, 3000)
    }
  }

  public subscribe(listener: (event: { type: string; details?: any }) => void): () => void {
    this._syncListeners.push(listener)
    return () => {
      this._syncListeners = this._syncListeners.filter((l) => l !== listener)
    }
  }

  private emit(type: string, details?: any) {
    this._syncListeners.forEach((listener) => {
      try {
        listener({ type, details })
      } catch (e) {
        console.error('[SyncManager] Listener error:', e)
      }
    })
  }

  public async refreshCounts() {
    try {
      const pending = await db.pendingOperations
        .where('status')
        .equals('pending')
        .count()

      const failed = await db.pendingOperations
        .where('status')
        .equals('failed')
        .count()

      this._pendingCount.value = pending
      this._failedCount.value = failed

      const meta = await db.syncMetadata.get('lastSyncTime')
      if (meta) {
        this._lastSyncTime.value = meta.value
      }
    } catch (err) {
      console.error('[SyncManager] Failed to refresh counts:', err)
    }
  }

  /**
   * Resolves any temporary IDs in endpoint URL or payload body
   * using mapped server IDs from previous successful operations.
   */
  private async resolveTemporaryIds(endpoint: string, payload: any): Promise<{ endpoint: string; payload: any }> {
    const mappings = await db.idMappings.toArray()
    let resolvedEndpoint = endpoint
    let resolvedPayload = payload ? JSON.parse(JSON.stringify(payload)) : payload

    for (const mapping of mappings) {
      if (resolvedEndpoint.includes(mapping.tempId)) {
        resolvedEndpoint = resolvedEndpoint.split(mapping.tempId).join(mapping.serverId)
      }

      if (resolvedPayload && typeof resolvedPayload === 'object') {
        const replaceInObj = (obj: any) => {
          for (const key of Object.keys(obj)) {
            if (typeof obj[key] === 'string' && obj[key] === mapping.tempId) {
              obj[key] = mapping.serverId
            } else if (typeof obj[key] === 'object' && obj[key] !== null) {
              replaceInObj(obj[key])
            }
          }
        }
        replaceInObj(resolvedPayload)
      }
    }

    return { endpoint: resolvedEndpoint, payload: resolvedPayload }
  }

  public async syncPendingOperations(options: { silent?: boolean } = {}): Promise<boolean> {
    if (this._isSyncing.value) return false
    if (!networkDetector.isOnline.value) return false

    // Fetch operations sorted by createdAt ascending (FIFO)
    const operations = await db.pendingOperations
      .filter((op) => op.status === 'pending' || op.status === 'failed')
      .sortBy('createdAt')

    if (operations.length === 0) {
      await this.refreshCounts()
      return true
    }

    this._isSyncing.value = true
    networkDetector.setSyncing(true)

    const totalToSync = operations.length
    if (!options.silent) {
      toast.info(`🔄 Synchronizing ${totalToSync} offline change${totalToSync > 1 ? 's' : ''}...`, {
        duration: 3000,
      })
    }

    let successCount = 0
    let failureCount = 0
    const token = typeof window !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null

    try {
      for (const op of operations) {
        // Mark as syncing in DB
        await db.pendingOperations.update(op.id, {
          status: 'syncing',
          updatedAt: Date.now(),
        })

        try {
          const { endpoint, payload } = await this.resolveTemporaryIds(op.endpoint, op.payload)
          const fullUrl = buildUrl(endpoint)

          const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            'x-client-op-id': op.id,
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          }

          const response = await fetch(fullUrl, {
            method: op.method,
            headers,
            body: ['POST', 'PUT', 'PATCH'].includes(op.method) && payload ? JSON.stringify(payload) : undefined,
          })

          const text = await response.text()
          let responseData: any = {}
          try {
            responseData = text ? JSON.parse(text) : {}
          } catch {
            // non-json response
          }

          if (response.ok) {
            // Check if a new ID was generated by the backend
            const serverEntity = responseData.data || responseData
            const serverId = serverEntity?._id || serverEntity?.id

            if (op.clientRecordId && serverId && op.clientRecordId !== serverId) {
              await db.idMappings.put({
                tempId: op.clientRecordId,
                serverId: String(serverId),
                entity: op.entity,
                createdAt: Date.now(),
              })

              // Update local entity record to point to server ID and mark synced
              const localRecord = await db.localEntities.get(op.clientRecordId)
              if (localRecord) {
                await db.localEntities.delete(op.clientRecordId)
                await db.localEntities.put({
                  ...localRecord,
                  id: String(serverId),
                  syncStatus: 'synced',
                  updatedAt: Date.now(),
                })
              }
            } else if (op.clientRecordId) {
              const localRecord = await db.localEntities.get(op.clientRecordId)
              if (localRecord) {
                await db.localEntities.update(op.clientRecordId, {
                  syncStatus: 'synced',
                  updatedAt: Date.now(),
                })
              }
            }

            // Remove synced operation from queue
            await db.pendingOperations.delete(op.id)
            successCount++
          } else {
            // Handle client error vs server error
            const errorMsg = responseData?.message || response.statusText || 'Sync error'

            if (response.status >= 400 && response.status < 500) {
              // Permanent client error (e.g. invalid permissions or duplicate cancelled)
              console.warn(`[SyncManager] Client error for op ${op.id}:`, errorMsg)
              await db.pendingOperations.update(op.id, {
                status: 'failed',
                error: errorMsg,
                updatedAt: Date.now(),
                retryCount: op.retryCount + 1,
              })
              failureCount++
            } else {
              // 5xx Server error: retryable
              console.error(`[SyncManager] Server error for op ${op.id}:`, errorMsg)
              await db.pendingOperations.update(op.id, {
                status: 'failed',
                error: errorMsg,
                updatedAt: Date.now(),
                retryCount: op.retryCount + 1,
              })
              failureCount++
              // Abort remaining queue if server is erroring
              break
            }
          }
        } catch (netErr: any) {
          console.error(`[SyncManager] Network error syncing op ${op.id}:`, netErr)
          await db.pendingOperations.update(op.id, {
            status: 'failed',
            error: netErr.message || 'Network error during sync',
            updatedAt: Date.now(),
            retryCount: op.retryCount + 1,
          })
          failureCount++
          networkDetector.reportApiFailure(netErr)
          break // Stop queue on network disconnection
        }
      }

      this._lastSyncTime.value = Date.now()
      await db.syncMetadata.put({
        key: 'lastSyncTime',
        value: this._lastSyncTime.value,
        updatedAt: Date.now(),
      })

      if (successCount > 0 && failureCount === 0) {
        toast.success(`✓ All changes synchronized (${successCount} record${successCount > 1 ? 's' : ''})`, {
          duration: 4000,
        })
      } else if (failureCount > 0) {
        toast.warning(`⚠ ${failureCount} record${failureCount > 1 ? 's' : ''} could not be synchronized`, {
          description: 'Will retry automatically when connection is stable.',
          duration: 5000,
        })
      }

      this.emit('sync-complete', { successCount, failureCount })
    } finally {
      this._isSyncing.value = false
      networkDetector.setSyncing(false)
      await this.refreshCounts()
    }

    return failureCount === 0
  }

  public async syncNow(): Promise<boolean> {
    const isOnline = await networkDetector.checkHealth()
    if (!isOnline) {
      toast.error('Cannot sync: server is currently unreachable.')
      return false
    }
    return this.syncPendingOperations({ silent: false })
  }

  public async clearFailedOperations() {
    await db.pendingOperations.where('status').equals('failed').delete()
    await this.refreshCounts()
  }

  public async retryFailedOperations() {
    await db.pendingOperations
      .where('status')
      .equals('failed')
      .modify({ status: 'pending', retryCount: 0 })
    return this.syncNow()
  }
}

export const syncManager = new SyncManager()
