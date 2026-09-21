<script setup lang="ts">
import type { Component } from 'vue'

defineProps<{
  title: string
  description?: string
  icon?: Component
  actionLabel?: string
}>()

defineEmits<{
  (e: 'action'): void
}>()
</script>

<template>
  <div class="flex flex-col items-center justify-center p-8 text-center rounded-3xl border border-dashed border-border bg-card/50 my-4">
    <div v-if="icon" class="h-12 w-12 rounded-2xl bg-muted/70 flex items-center justify-center text-muted-foreground mb-3">
      <component :is="icon" class="h-6 w-6" />
    </div>
    <h3 class="text-sm font-bold text-foreground">{{ title }}</h3>
    <p v-if="description" class="text-xs text-muted-foreground mt-1 max-w-xs">{{ description }}</p>
    <button
      v-if="actionLabel"
      type="button"
      @click="$emit('action')"
      class="mt-4 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold shadow-xs hover:opacity-90 active:scale-95 transition cursor-pointer"
    >
      {{ actionLabel }}
    </button>
  </div>
</template>
