<script setup lang="ts">
import { DropdownMenuRoot, type DropdownMenuRootProps, type DropdownMenuRootEmits, useForwardPropsEmits } from 'radix-vue'
import { cn } from '@/lib/utils'

const props = defineProps<DropdownMenuRootProps>()
const emit = defineEmits<DropdownMenuRootEmits>()
const forwarded = useForwardPropsEmits(props, emit)
</script>

<template>
  <DropdownMenuRoot v-bind="forwarded">
    <slot />
  </DropdownMenuRoot>
</template>
