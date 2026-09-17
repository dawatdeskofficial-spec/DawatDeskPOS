<script setup lang="ts">
import type { Component } from 'vue'

defineProps<{
  label: string
  subtitle?: string
  icon: Component
  badge?: string | number
  colorScheme?: 'primary' | 'success' | 'warning' | 'info' | 'purple' | 'destructive'
}>()

defineEmits<{
  (e: 'click'): void
}>()
</script>

<template>
  <button
    type="button"
    @click="$emit('click')"
    class="flex flex-col items-center justify-center p-3 rounded-2xl border border-border bg-card hover:bg-muted/40 active:scale-95 transition-all text-center group cursor-pointer shadow-xs min-h-[82px]"
  >
    <div class="relative mb-2">
      <div
        :class="[
          'h-10 w-10 rounded-xl flex items-center justify-center transition-transform group-hover:scale-105',
          colorScheme === 'success' ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' :
          colorScheme === 'warning' ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400' :
          colorScheme === 'info' ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400' :
          colorScheme === 'purple' ? 'bg-purple-500/15 text-purple-600 dark:text-purple-400' :
          colorScheme === 'destructive' ? 'bg-red-500/15 text-red-600 dark:text-red-400' :
          'bg-primary/15 text-primary'
        ]"
      >
        <component :is="icon" class="h-5 w-5" />
      </div>
      <span
        v-if="badge !== undefined && badge !== null && badge !== 0"
        class="absolute -top-1 -right-2 min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center ring-2 ring-card"
      >
        {{ badge }}
      </span>
    </div>
    <span class="text-xs font-bold text-foreground line-clamp-1 leading-tight">{{ label }}</span>
    <span v-if="subtitle" class="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">{{ subtitle }}</span>
  </button>
</template>
