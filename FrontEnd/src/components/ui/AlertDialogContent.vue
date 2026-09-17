<script setup lang="ts">
import { AlertDialogPortal, AlertDialogOverlay, AlertDialogContent, type AlertDialogContentProps, type AlertDialogContentEmits } from 'radix-vue'
import { cn } from '@/lib/utils'

const props = defineProps<AlertDialogContentProps & { class?: any }>()
const emit = defineEmits<AlertDialogContentEmits>()
</script>

<template>
  <AlertDialogPortal>
    <AlertDialogOverlay
      class="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
    />
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 pointer-events-none">
      <AlertDialogContent
        v-bind="props"
        @escapeKeyDown="emit('escapeKeyDown', $event)"
        :class="cn('pointer-events-auto relative w-full max-w-lg max-h-[90vh] overflow-y-auto grid gap-4 border border-border bg-background p-6 shadow-2xl duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 rounded-3xl', props.class)"
      >
        <slot />
      </AlertDialogContent>
    </div>
  </AlertDialogPortal>
</template>
