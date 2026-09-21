<script setup lang="ts">
import type { Component } from 'vue'

defineProps<{
  label: string
  value: string | number
  icon: Component
  change?: string
  trend?: 'up' | 'down' | 'neutral'
  colorScheme?: 'primary' | 'success' | 'warning' | 'info' | 'purple'
}>()
</script>

<template>
  <div class="rounded-2xl border border-border bg-card p-3.5 shadow-xs flex flex-col justify-between transition active:scale-[0.98]">
    <div class="flex items-center justify-between gap-2 mb-2">
      <span class="text-xs font-semibold text-muted-foreground line-clamp-1">{{ label }}</span>
      <div
        :class="[
          'h-8 w-8 rounded-xl flex items-center justify-center shrink-0',
          colorScheme === 'success' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' :
          colorScheme === 'warning' ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400' :
          colorScheme === 'info' ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400' :
          colorScheme === 'purple' ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400' :
          'bg-primary/10 text-primary'
        ]"
      >
        <component :is="icon" class="h-4 w-4" />
      </div>
    </div>
    <div class="flex items-baseline justify-between gap-1">
      <span class="text-xl font-bold tracking-tight font-display text-foreground">{{ value }}</span>
      <span
        v-if="change"
        :class="[
          'text-[10px] font-bold px-1.5 py-0.5 rounded-md',
          trend === 'up' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' :
          trend === 'down' ? 'bg-red-500/10 text-red-600 dark:text-red-400' :
          'bg-muted text-muted-foreground'
        ]"
      >
        {{ change }}
      </span>
    </div>
  </div>
</template>
