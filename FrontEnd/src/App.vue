<script setup lang="ts">
import { onMounted } from 'vue'
import { RouterView } from 'vue-router'
import { Toaster } from 'vue-sonner'
import { networkDetector } from '@/lib/offline/networkDetector'
import { syncManager } from '@/lib/offline/syncManager'
import { WifiOff, ServerOff, RefreshCw } from 'lucide-vue-next'

const state = networkDetector.state
const isSyncing = syncManager.isSyncing
const pendingCount = syncManager.pendingCount

onMounted(() => {
  // Trigger initial health check and count refresh
  networkDetector.checkHealth()
  syncManager.refreshCounts()
})
</script>

<template>
  <div class="min-h-screen flex flex-col">
    <!-- Non-disruptive global offline strip if connection dropped -->
    <div
      v-if="state === 'OFFLINE' || state === 'SERVER_UNAVAILABLE'"
      class="bg-amber-600 text-white text-xs px-4 py-1.5 flex items-center justify-between font-medium shadow-sm transition-all animate-in slide-in-from-top duration-300 z-50 shrink-0"
    >
      <div class="flex items-center gap-2">
        <WifiOff v-if="state === 'OFFLINE'" class="w-3.5 h-3.5" />
        <ServerOff v-else class="w-3.5 h-3.5" />
        <span>
          <strong>{{ state === 'OFFLINE' ? 'Offline Mode:' : 'Server Unavailable:' }}</strong>
          Changes are stored securely on this device and will synchronize automatically once reconnected.
        </span>
      </div>

      <div v-if="pendingCount > 0" class="flex items-center gap-2 text-[11px] bg-black/20 px-2 py-0.5 rounded-full">
        <span>{{ pendingCount }} pending change{{ pendingCount > 1 ? 's' : '' }}</span>
      </div>
    </div>

    <div class="flex-1">
      <RouterView />
    </div>

    <Toaster position="bottom-right" rich-colors />
  </div>
</template>

