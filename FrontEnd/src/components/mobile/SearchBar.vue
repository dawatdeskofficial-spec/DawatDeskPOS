<script setup lang="ts">
import { Search, X } from 'lucide-vue-next'

const props = withDefaults(defineProps<{
  modelValue: string
  placeholder?: string
  chips?: string[]
  selectedChip?: string
}>(), {
  placeholder: 'Search...',
  chips: () => []
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'selectChip', chip: string): void
}>()

function clear() {
  emit('update:modelValue', '')
}
</script>

<template>
  <div class="space-y-2.5">
    <div class="relative flex items-center">
      <Search class="absolute left-3.5 h-4 w-4 text-muted-foreground pointer-events-none" />
      <input
        type="text"
        :value="modelValue"
        @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
        :placeholder="placeholder"
        class="w-full h-11 pl-10 pr-10 rounded-2xl border border-border bg-card text-foreground placeholder:text-muted-foreground text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition shadow-xs"
      />
      <button
        v-if="modelValue"
        type="button"
        @click="clear"
        class="absolute right-3 h-6 w-6 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer"
      >
        <X class="h-3.5 w-3.5" />
      </button>
    </div>

    <!-- Optional horizontal scrollable filter chips -->
    <div v-if="chips.length > 0" class="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
      <button
        v-for="chip in chips"
        :key="chip"
        type="button"
        @click="$emit('selectChip', chip)"
        :class="[
          'px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer shrink-0 border',
          selectedChip === chip
            ? 'bg-primary text-primary-foreground border-primary shadow-xs'
            : 'bg-card text-muted-foreground border-border hover:bg-muted/50'
        ]"
      >
        {{ chip }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.no-scrollbar::-webkit-scrollbar {
  display: none;
}
.no-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
</style>
