<script setup lang="ts">
import { isOnline, connectionState, queuedOperationsCount } from '@/lib/network'
import { WifiOff, RefreshCw, CheckCircle2, AlertTriangle } from 'lucide-vue-next'
</script>

<template>
  <div>
    <!-- Offline persistent alert banner -->
    <Transition name="slide-down">
      <div
        v-if="!isOnline || connectionState === 'OFFLINE'"
        class="bg-amber-500/95 text-white px-4 py-2.5 text-xs font-semibold flex items-center justify-between shadow-md sticky top-0 z-50 backdrop-blur-sm"
      >
        <div class="flex items-center gap-2">
          <WifiOff class="h-4 w-4 shrink-0 animate-pulse" />
          <span>You're offline. Changes are saved locally and will sync when connection returns.</span>
        </div>
        <span
          v-if="queuedOperationsCount > 0"
          class="bg-white/20 px-2 py-0.5 rounded-full text-[11px] font-bold shrink-0 ml-2"
        >
          {{ queuedOperationsCount }} queued
        </span>
      </div>

      <!-- Syncing notification -->
      <div
        v-else-if="connectionState === 'SYNCING'"
        class="bg-blue-600/95 text-white px-4 py-2 text-xs font-semibold flex items-center justify-between shadow-md sticky top-0 z-50 backdrop-blur-sm"
      >
        <div class="flex items-center gap-2">
          <RefreshCw class="h-3.5 w-3.5 animate-spin shrink-0" />
          <span>Reconnecting &amp; syncing data...</span>
        </div>
      </div>

      <!-- Sync completed notification -->
      <div
        v-else-if="connectionState === 'SYNC_COMPLETED'"
        class="bg-emerald-600/95 text-white px-4 py-2 text-xs font-semibold flex items-center justify-between shadow-md sticky top-0 z-50 backdrop-blur-sm"
      >
        <div class="flex items-center gap-2">
          <CheckCircle2 class="h-3.5 w-3.5 shrink-0" />
          <span>All changes synced successfully!</span>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.slide-down-enter-active,
.slide-down-leave-active {
  transition: transform 0.2s ease, opacity 0.2s ease;
}
.slide-down-enter-from,
.slide-down-leave-to {
  transform: translateY(-100%);
  opacity: 0;
}
</style>
