import { db, generateClientId, type PendingOperation, type LocalEntityRecord } from './db'
import { networkDetector } from './networkDetector'
import { syncManager } from './syncManager'
import { toast } from 'vue-sonner'

export function isOfflineOrServerError(error: any): boolean {
  if (!navigator.onLine) return true
  const msg = error?.message || String(error)
  return (
    msg.includes('Failed to fetch') ||
    msg.includes('NetworkError') ||
    msg.includes('timeout') ||
    msg.includes('ECONNREFUSED') ||
    msg.includes('Network request failed') ||
    msg.includes('Load failed') ||
    msg.includes('500') ||
    msg.includes('502') ||
    msg.includes('503') ||
    msg.includes('504')
  )
}

/**
 * Extract entity type from endpoint URL
 */
export function deriveEntityFromPath(path: string): string {
  if (path.includes('/orders')) return 'orders'
  if (path.includes('/menu')) return 'menu'
  if (path.includes('/categories')) return 'categories'
  if (path.includes('/waiting-queue')) return 'waiting_queue'
  if (path.includes('/payments')) return 'payments'
  if (path.includes('/restaurants')) return 'restaurants'
  if (path.includes('/users')) return 'users'
  if (path.includes('/settings')) return 'settings'
  return 'general'
}

/**
 * Cache GET response in IndexedDB
 */
export async function cacheApiResponse(cacheKey: string, data: any, entity: string, ttlSeconds = 86400) {
  try {
    await db.cachedData.put({
      cacheKey,
      entity,
      data,
      timestamp: Date.now(),
      expiresAt: Date.now() + ttlSeconds * 1000,
    })
  } catch (e) {
    console.warn('[OfflineDB] Failed to cache API response:', e)
  }
}

/**
 * Retrieve cached GET response from IndexedDB
 */
export async function getCachedApiResponse(cacheKey: string): Promise<any | null> {
  try {
    const entry = await db.cachedData.get(cacheKey)
    if (!entry) return null
    return entry.data
  } catch (e) {
    console.warn('[OfflineDB] Failed to get cached API response:', e)
    return null
  }
}

/**
 * Save an optimistic mutation in IndexedDB and enqueue for synchronization
 */
export async function handleOfflineMutation(
  path: string,
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  payload: any,
  entity: string
): Promise<any> {
  const opId = generateClientId('op')
  let clientRecordId: string | undefined = undefined
  let localData: any = { ...payload }

  // 1. Determine operation type & mock ID for newly created entities
  if (method === 'POST') {
    if (entity === 'orders') {
      clientRecordId = generateClientId('temp_ord')
      localData = {
        _id: clientRecordId,
        id: clientRecordId,
        tableNumber: payload.tableNumber,
        restaurantId: payload.restaurantId,
        orderType: payload.orderType || 'DINE_IN',
        customerName: payload.customerName || 'Offline Guest',
        customerPhone: payload.customerPhone || '',
        status: 'PENDING',
        paymentStatus: 'PENDING',
        notes: payload.notes || '',
        items: (payload.items || []).map((item: any) => ({
          _id: generateClientId('temp_item'),
          menuItemId: item.menuItemId,
          quantity: item.quantity,
          specialInstructions: item.specialInstructions || '',
          status: 'PENDING',
        })),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        _syncStatus: 'pending',
        _isLocal: true,
      }
    } else if (entity === 'waiting_queue') {
      clientRecordId = generateClientId('temp_wq')
      localData = {
        _id: clientRecordId,
        id: clientRecordId,
        ...payload,
        status: 'WAITING',
        queueNumber: Math.floor(100 + Math.random() * 900),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        _syncStatus: 'pending',
        _isLocal: true,
      }
    } else if (entity === 'payments') {
      clientRecordId = generateClientId('temp_pay')
      localData = {
        _id: clientRecordId,
        id: clientRecordId,
        ...payload,
        status: 'COMPLETED',
        createdAt: new Date().toISOString(),
        _syncStatus: 'pending',
        _isLocal: true,
      }
    } else {
      clientRecordId = generateClientId(`temp_${entity}`)
      localData = {
        _id: clientRecordId,
        id: clientRecordId,
        ...payload,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        _syncStatus: 'pending',
        _isLocal: true,
      }
    }
  } else if (method === 'PUT' || method === 'PATCH') {
    // Extract ID from URL if present
    const segments = path.split('/')
    const lastOrSecondLast = segments[segments.length - 1] || segments[segments.length - 2]
    clientRecordId = lastOrSecondLast
    localData = { ...payload, _syncStatus: 'pending', updatedAt: new Date().toISOString() }
  }

  const pendingOp: PendingOperation = {
    id: opId,
    operation: method === 'POST' ? 'CREATE' : method === 'DELETE' ? 'DELETE' : 'UPDATE',
    entity,
    endpoint: path,
    method,
    payload,
    clientRecordId,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    retryCount: 0,
    status: 'pending',
  }

  // 2. Persist in IndexedDB pendingOperations & localEntities
  try {
    await db.pendingOperations.put(pendingOp)

    if (clientRecordId) {
      const existing = await db.localEntities.get(clientRecordId)
      await db.localEntities.put({
        id: clientRecordId,
        entity,
        data: existing ? { ...existing.data, ...localData } : localData,
        syncStatus: 'pending',
        isLocal: true,
        createdAt: existing ? existing.createdAt : Date.now(),
        updatedAt: Date.now(),
      })
    }

    await syncManager.refreshCounts()
  } catch (err) {
    console.error('[OfflineDB] Error writing pending operation:', err)
  }

  // 3. User notification
  toast('💾 Saved offline', {
    description: 'Will automatically synchronize when connection is restored.',
    duration: 4000,
    style: {
      background: 'hsl(var(--warning) / 0.15)',
      border: '1px solid hsl(var(--warning) / 0.4)',
      color: 'hsl(var(--warning))',
    },
  })

  // 4. Return standard mock response structure
  return {
    success: true,
    message: 'Saved offline — waiting for synchronization',
    data: localData,
    _isOffline: true,
    _clientOperationId: opId,
  }
}

/**
 * Merge cached API list with locally stored pending entities
 */
export async function mergeWithLocalEntities(entity: string, serverList: any[] = []): Promise<any[]> {
  try {
    const localRecords = await db.localEntities.where('entity').equals(entity).toArray()
    if (localRecords.length === 0) return serverList

    const listMap = new Map<string, any>()

    // Add server items
    for (const item of serverList) {
      const id = String(item._id || item.id)
      listMap.set(id, item)
    }

    // Overlay local items
    for (const record of localRecords) {
      const id = String(record.id)
      if (record.syncStatus === 'pending' || record.syncStatus === 'failed') {
        const existing = listMap.get(id) || {}
        listMap.set(id, {
          ...existing,
          ...record.data,
          _syncStatus: record.syncStatus,
          _isLocal: record.isLocal,
        })
      }
    }

    return Array.from(listMap.values())
  } catch (e) {
    console.warn('[OfflineDB] Merge local entities error:', e)
    return serverList
  }
}
