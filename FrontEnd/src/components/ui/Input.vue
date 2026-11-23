<script setup lang="ts">
import { cn } from '@/lib/utils'

interface Props {
  modelValue?: string | number
  class?: any
  type?: string
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: '',
  type: 'text'
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: string | number): void
}>()
</script>

<template>
  <input
    :type="type"
    :value="modelValue"
    @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
    :class="cn('flex h-10 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm shadow-2xs transition-all placeholder:text-muted-foreground outline-none focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none', props.class)"
    v-bind="$attrs"
  />
</template>
