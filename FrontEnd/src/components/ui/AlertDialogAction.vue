<script setup lang="ts">
import { AlertDialogAction, type AlertDialogActionProps } from 'radix-vue'
import { cn } from '@/lib/utils'
import Button from './Button.vue'

const props = withDefaults(
  defineProps<AlertDialogActionProps & { class?: any; variant?: any }>(),
  {
    variant: 'default'
  }
)
</script>

<template>
  <AlertDialogAction v-bind="props" as-child>
    <Button :variant="variant" :class="cn(props.class)">
      <slot />
    </Button>
  </AlertDialogAction>
</template>
