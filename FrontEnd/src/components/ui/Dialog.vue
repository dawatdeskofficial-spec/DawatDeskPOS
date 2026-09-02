<script setup lang="ts">
import {
  DialogRoot,
  type DialogRootProps,
  type DialogRootEmits,
  useForwardPropsEmits
} from 'radix-vue'

const props = defineProps<DialogRootProps>()
const emit = defineEmits<DialogRootEmits>()
const forwarded = useForwardPropsEmits(props, emit)
</script>

<template>
  <DialogRoot v-bind="forwarded">
    <slot />
  </DialogRoot>
</template>
