<script setup lang="ts">
import { useSlots } from 'vue'
const props = defineProps<{
  title: string;
  subtitle?: string;
}>()
const slots = useSlots()
</script>

<template>
  <div class="flex flex-wrap items-center justify-between gap-4 mb-6">
    <div>
      <h1 class="font-display text-2xl sm:text-3xl font-bold tracking-tight">{{ title }}</h1>
      <p v-if="subtitle" class="text-sm text-muted-foreground mt-1 hidden sm:block">{{ subtitle }}</p>
    </div>
    <slot name="action" />
  </div>
</template>
