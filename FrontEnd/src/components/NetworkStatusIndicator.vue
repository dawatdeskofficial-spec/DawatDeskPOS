<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import {
  Wifi,
  WifiOff,
  ServerOff,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Layers,
  ChevronDown,
  X
} from 'lucide-vue-next'
import { networkDetector, type NetworkState } from '@/lib/offline/networkDetector'
import { syncManager } from '@/lib/offline/syncManager'
import { db, type PendingOperation } from '@/lib/offline/db'
import Button from '@/components/ui/Button.vue'
import Badge from '@/components/ui/Badge.vue'

const currentState = networkDetector.state
const isSyncing = syncManager.isSyncing
const pendingCount = syncManager.pendingCount
const failedCount = syncManager.failedCount
const lastSyncTime = syncManager.lastSyncTime

const isDetailsOpen = ref(false)
const pendingList = ref<PendingOperation[]>([])
let refreshTimer: any = null

const formattedLastSync = computed(() => {
  if (!lastSyncTime.value) return 'Never'
  const date = new Date(lastSyncTime.value)
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
})

const badgeConfig = computed(() => {
  if (isSyncing.value || currentState.value === 'SYNCING') {
    return {
      label: `Syncing${pendingCount.value ? ` (${pendingCount.value})` : '...'}`,
      icon: RefreshCw,
      class: 'bg-blue-500/10 text-blue-500 border-blue-500/20 animate-pulse',
      dotClass: 'bg-blue-500 animate-spin',
    }
  }

  switch (currentState.value) {
    case 'ONLINE':
      return {
        label: pendingCount.value > 0 ? `Online (${pendingCount.value} pending)` : 'Online',
        icon: Wifi,
        class: pendingCount.value > 0 ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
        dotClass: pendingCount.value > 0 ? 'bg-amber-500' : 'bg-emerald-500',
      }
    case 'OFFLINE':
      return {
        label: 'Offline',
        icon: WifiOff,
        class: 'bg-rose-500/10 text-rose-500 border-rose-500/20',
        dotClass: 'bg-rose-500',
      }
    case 'SERVER_UNAVAILABLE':
      return {
        label: 'Server Unavailable',
        icon: ServerOff,
        class: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
        dotClass: 'bg-amber-500',
      }
    default:
      return {
        label: 'Checking...',
        icon: RefreshCw,
        class: 'bg-muted text-muted-foreground border-border',
        dotClass: 'bg-muted-foreground',
      }
  }
})

async function loadPendingDetails() {
  try {
    pendingList.value = await db.pendingOperations
      .filter((op) => op.status === 'pending' || op.status === 'failed')
      .reverse()
      .sortBy('createdAt')
  } catch (err) {
    console.error('Failed to load pending operations:', err)
  }
}

function toggleDetails() {
  isDetailsOpen.value = !isDetailsOpen.value
  if (isDetailsOpen.value) {
    loadPendingDetails()
  }
}

async function handleManualSync() {
  await syncManager.syncNow()
  await loadPendingDetails()
}

async function handleRetryFailed() {
  await syncManager.retryFailedOperations()
  await loadPendingDetails()
}

onMounted(() => {
  refreshTimer = setInterval(() => {
    syncManager.refreshCounts()
    if (isDetailsOpen.value) {
      loadPendingDetails()
    }
  }, 4000)
})

onUnmounted(() => {
  if (refreshTimer) clearInterval(refreshTimer)
})
</script>

<template>
  <div class="relative inline-flex items-center">
    <!-- Trigger Button -->
    <button
      @click="toggleDetails"
      type="button"
      :class="[
        'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all hover:opacity-85 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-primary/40',
        badgeConfig.class
      ]"
      :title="`Network Status: ${currentState}. Click for details.`"
    >
      <span :class="['w-2 h-2 rounded-full', badgeConfig.dotClass]"></span>
      <component :is="badgeConfig.icon" class="w-3.5 h-3.5" :class="{ 'animate-spin': isSyncing }" />
      <span class="font-semibold">{{ badgeConfig.label }}</span>
      <ChevronDown class="w-3 h-3 opacity-60 ml-0.5" />
    </button>

    <!-- Details Modal / Popover -->
    <div
      v-if="isDetailsOpen"
      class="fixed inset-0 z-50 flex items-start justify-center pt-20 sm:pt-24 px-4 bg-background/60 backdrop-blur-xs"
      @click.self="isDetailsOpen = false"
    >
      <div
        class="w-full max-w-md bg-card border border-border rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
      >
        <!-- Header -->
        <div class="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/40">
          <div class="flex items-center gap-2">
            <Layers class="w-4 h-4 text-primary" />
            <h3 class="text-sm font-semibold text-foreground">Sync & Connection Status</h3>
          </div>
          <button
            @click="isDetailsOpen = false"
            class="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X class="w-4 h-4" />
          </button>
        </div>

        <!-- Body -->
        <div class="p-4 space-y-4 text-xs">
          <!-- Status Grid -->
          <div class="grid grid-cols-2 gap-2">
            <div class="p-2.5 rounded-lg bg-muted/30 border border-border/60">
              <span class="text-muted-foreground block text-[11px]">Connection Mode</span>
              <div class="flex items-center gap-1.5 mt-1 font-semibold text-foreground capitalize">
                <span :class="['w-2 h-2 rounded-full', badgeConfig.dotClass]"></span>
                {{ currentState.replace('_', ' ').toLowerCase() }}
              </div>
            </div>

            <div class="p-2.5 rounded-lg bg-muted/30 border border-border/60">
              <span class="text-muted-foreground block text-[11px]">Last Synchronized</span>
              <div class="flex items-center gap-1.5 mt-1 font-medium text-foreground">
                <Clock class="w-3.5 h-3.5 text-muted-foreground" />
                {{ formattedLastSync }}
              </div>
            </div>
          </div>

          <!-- Pending Summary Banner -->
          <div
            v-if="pendingCount > 0 || failedCount > 0"
            class="p-3 rounded-lg border bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400 space-y-1"
          >
            <div class="flex items-center justify-between font-semibold">
              <span class="flex items-center gap-1.5">
                <AlertTriangle class="w-4 h-4" />
                Offline Queue
              </span>
              <span>{{ pendingCount }} pending, {{ failedCount }} failed</span>
            </div>
            <p class="text-[11px] text-amber-600/90 dark:text-amber-400/90">
              Operations created while offline will automatically sync with the server database when connection returns.
            </p>
          </div>

          <div
            v-else
            class="p-3 rounded-lg border bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 flex items-center gap-2"
          >
            <CheckCircle2 class="w-4 h-4 shrink-0" />
            <span class="font-medium">All local data is fully synchronized with the cloud database.</span>
          </div>

          <!-- Pending Items List -->
          <div v-if="pendingList.length > 0" class="space-y-1.5 max-h-48 overflow-y-auto pr-1">
            <span class="text-muted-foreground font-semibold uppercase tracking-wider text-[10px]">Queue Details</span>
            <div
              v-for="op in pendingList"
              :key="op.id"
              class="flex items-center justify-between p-2 rounded-md bg-muted/40 border border-border/50 text-[11px]"
            >
              <div class="flex flex-col gap-0.5">
                <div class="flex items-center gap-1.5">
                  <span
                    :class="[
                      'px-1.5 py-0.2 rounded font-mono font-bold text-[10px]',
                      op.operation === 'CREATE' ? 'bg-emerald-500/20 text-emerald-600' :
                      op.operation === 'UPDATE' ? 'bg-blue-500/20 text-blue-600' : 'bg-rose-500/20 text-rose-600'
                    ]"
                  >
                    {{ op.operation }}
                  </span>
                  <span class="font-medium text-foreground capitalize">{{ op.entity.replace('_', ' ') }}</span>
                </div>
                <span class="text-muted-foreground text-[10px]">
                  {{ new Date(op.createdAt).toLocaleTimeString() }} • Retries: {{ op.retryCount }}
                </span>
                <span v-if="op.error" class="text-rose-500 text-[10px] truncate max-w-[240px]">
                  {{ op.error }}
                </span>
              </div>

              <Badge
                :variant="op.status === 'failed' ? 'destructive' : op.status === 'syncing' ? 'default' : 'secondary'"
                class="text-[10px] capitalize"
              >
                {{ op.status }}
              </Badge>
            </div>
          </div>
        </div>

        <!-- Footer Actions -->
        <div class="flex items-center justify-between px-4 py-3 border-t border-border bg-muted/30">
          <Button
            v-if="failedCount > 0"
            variant="outline"
            size="sm"
            @click="handleRetryFailed"
            :disabled="isSyncing"
            class="text-xs h-8"
          >
            Retry Failed
          </Button>
          <div v-else></div>

          <div class="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              @click="isDetailsOpen = false"
              class="text-xs h-8"
            >
              Close
            </Button>
            <Button
              size="sm"
              @click="handleManualSync"
              :disabled="isSyncing || currentState === 'OFFLINE'"
              class="text-xs h-8 gap-1.5"
            >
              <RefreshCw class="w-3.5 h-3.5" :class="{ 'animate-spin': isSyncing }" />
              {{ isSyncing ? 'Syncing...' : 'Sync Now' }}
            </Button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
