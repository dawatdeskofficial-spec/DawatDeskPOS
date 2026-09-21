<script setup lang="ts">
withDefaults(defineProps<{
  type?: 'card' | 'list' | 'stat' | 'table'
  count?: number
}>(), {
  type: 'card',
  count: 3
})
</script>

<template>
  <div class="space-y-3 animate-pulse">
    <!-- Stat Skeleton -->
    <template v-if="type === 'stat'">
      <div class="grid grid-cols-2 gap-3">
        <div v-for="i in count" :key="i" class="h-24 rounded-2xl bg-muted/60" />
      </div>
    </template>

    <!-- Card Skeleton -->
    <template v-else-if="type === 'card'">
      <div v-for="i in count" :key="i" class="p-4 rounded-2xl border border-border bg-card space-y-3">
        <div class="flex justify-between items-center">
          <div class="h-4 w-28 bg-muted rounded-md" />
          <div class="h-5 w-16 bg-muted rounded-full" />
        </div>
        <div class="h-3 w-44 bg-muted/70 rounded-md" />
        <div class="h-9 w-full bg-muted/50 rounded-xl" />
      </div>
    </template>

    <!-- List Skeleton -->
    <template v-else-if="type === 'list'">
      <div v-for="i in count" :key="i" class="flex items-center gap-3 p-3 rounded-2xl border border-border bg-card">
        <div class="h-10 w-10 rounded-xl bg-muted shrink-0" />
        <div class="flex-1 space-y-2">
          <div class="h-3.5 w-32 bg-muted rounded-md" />
          <div class="h-2.5 w-20 bg-muted/70 rounded-md" />
        </div>
        <div class="h-6 w-12 bg-muted rounded-md" />
      </div>
    </template>

    <!-- Table Grid Skeleton -->
    <template v-else-if="type === 'table'">
      <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div v-for="i in count" :key="i" class="h-32 rounded-2xl bg-muted/60" />
      </div>
    </template>
  </div>
</template>
