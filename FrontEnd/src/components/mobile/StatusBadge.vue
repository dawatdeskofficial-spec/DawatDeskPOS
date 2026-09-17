<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  status: string
  size?: 'sm' | 'md'
}>(), {
  size: 'md'
})

const normalizedStatus = computed(() => (props.status || '').toUpperCase())

const statusConfig = computed(() => {
  switch (normalizedStatus.value) {
    case 'AVAILABLE':
      return {
        label: 'Available',
        badgeClass: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
        dotClass: 'bg-emerald-500'
      }
    case 'OCCUPIED':
      return {
        label: 'Occupied',
        badgeClass: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
        dotClass: 'bg-blue-500'
      }
    case 'PENDING':
      return {
        label: 'Pending',
        badgeClass: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
        dotClass: 'bg-amber-500'
      }
    case 'PREPARING':
      return {
        label: 'Preparing',
        badgeClass: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20',
        dotClass: 'bg-orange-500 animate-pulse'
      }
    case 'READY':
      return {
        label: 'Ready to Serve',
        badgeClass: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
        dotClass: 'bg-emerald-500 animate-ping'
      }
    case 'SERVED':
      return {
        label: 'Served',
        badgeClass: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20',
        dotClass: 'bg-indigo-500'
      }
    case 'COMPLETED':
      return {
        label: 'Completed',
        badgeClass: 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20',
        dotClass: 'bg-zinc-400'
      }
    case 'CANCELLED':
      return {
        label: 'Cancelled',
        badgeClass: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
        dotClass: 'bg-red-500'
      }
    case 'RESERVED':
      return {
        label: 'Reserved',
        badgeClass: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
        dotClass: 'bg-purple-500'
      }
    default:
      return {
        label: props.status,
        badgeClass: 'bg-muted text-muted-foreground border-border',
        dotClass: 'bg-muted-foreground'
      }
  }
})
</script>

<template>
  <span
    :class="[
      'inline-flex items-center gap-1.5 font-semibold border rounded-full uppercase tracking-wider',
      size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs',
      statusConfig.badgeClass
    ]"
  >
    <span :class="['rounded-full shrink-0', size === 'sm' ? 'h-1.5 w-1.5' : 'h-2 w-2', statusConfig.dotClass]" />
    <span>{{ statusConfig.label }}</span>
  </span>
</template>
