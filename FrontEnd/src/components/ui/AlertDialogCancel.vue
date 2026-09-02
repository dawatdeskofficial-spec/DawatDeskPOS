<script setup lang="ts">
import { AlertDialogCancel, type AlertDialogCancelProps } from 'radix-vue'
import { cn } from '@/lib/utils'
import Button from './Button.vue'

const props = withDefaults(
  defineProps<AlertDialogCancelProps & { class?: any; variant?: any }>(),
  {
    variant: 'outline'
  }
)
</script>

<template>
  <AlertDialogCancel v-bind="props" as-child>
    <Button :variant="variant" :class="cn('mt-2 sm:mt-0', props.class)">
      <slot />
    </Button>
  </AlertDialogCancel>
</template>
