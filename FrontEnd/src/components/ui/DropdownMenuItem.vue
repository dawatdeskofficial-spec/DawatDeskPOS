<script setup lang="ts">
import { DropdownMenuItem, type DropdownMenuItemProps, type DropdownMenuItemEmits } from 'radix-vue'
import { cn } from '@/lib/utils'

const props = defineProps<DropdownMenuItemProps & { class?: any }>()
const emit = defineEmits<DropdownMenuItemEmits>()
</script>

<template>
  <DropdownMenuItem
    v-bind="props"
    @select="emit('select', $event)"
    :class="cn('relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50', props.class)"
  >
    <slot />
  </DropdownMenuItem>
</template>
