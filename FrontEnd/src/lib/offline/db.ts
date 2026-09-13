import Dexie, { type Table } from 'dexie'

export type OperationType = 'CREATE' | 'UPDATE' | 'DELETE'
export type OperationStatus = 'pending' | 'syncing' | 'failed'

export interface PendingOperation {
  id: string // Unique client operation UUID (used for idempotency)
  operation: OperationType
  entity: string // e.g., 'orders', 'order_items', 'payments', 'waiting_queue', 'menu', 'categories'
  endpoint: string
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  payload: any
  clientRecordId?: string // Temporary or local record ID (e.g., 'temp_ord_...')
  parentClientRecordId?: string // For child operations (e.g. adding items to a temp order)
  createdAt: number
  updatedAt: number
  retryCount: number
  status: OperationStatus
  error?: string
}

export interface CachedDataEntry {
  cacheKey: string
  entity: string
  data: any
  timestamp: number
  expiresAt?: number
}

export interface LocalEntityRecord {
  id: string // Real ID or temporary ID
  entity: string
  data: any
  syncStatus: 'synced' | 'pending' | 'failed'
  isLocal: boolean
  createdAt: number
  updatedAt: number
}

export interface SyncMetadata {
  key: string
  value: any
  updatedAt: number
}

export interface IdMapping {
  tempId: string
  serverId: string
  entity: string
  createdAt: number
}

export class RestaurantOfflineDB extends Dexie {
  pendingOperations!: Table<PendingOperation, string>
  cachedData!: Table<CachedDataEntry, string>
  localEntities!: Table<LocalEntityRecord, string>
  syncMetadata!: Table<SyncMetadata, string>
  idMappings!: Table<IdMapping, string>

  constructor() {
    super('RestaurantOfflineDB')

    this.version(1).stores({
      pendingOperations: 'id, operation, entity, status, createdAt, clientRecordId, [status+retryCount]',
      cachedData: 'cacheKey, entity, timestamp',
      localEntities: 'id, entity, syncStatus, isLocal, createdAt, [entity+syncStatus]',
      syncMetadata: 'key',
      idMappings: 'tempId, serverId, entity',
    })
  }
}

export const db = new RestaurantOfflineDB()

/**
 * Utility to generate unique client operation / record IDs
 */
export function generateClientId(prefix = 'client'): string {
  const timestamp = Date.now().toString(36)
  const randomStr = Math.random().toString(36).substring(2, 9)
  return `${prefix}_${timestamp}_${randomStr}`
}
