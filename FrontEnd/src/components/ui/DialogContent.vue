<script setup lang="ts">
import { DialogPortal, DialogOverlay, DialogContent, DialogClose, type DialogContentProps, type DialogContentEmits, useForwardPropsEmits } from 'radix-vue'
import { cn } from '@/lib/utils'
import { X } from 'lucide-vue-next'

const props = defineProps<DialogContentProps & { class?: any }>()
const emit = defineEmits<DialogContentEmits>()

const forwarded = useForwardPropsEmits(props, emit)
</script>

<template>
  <DialogPortal>
    <DialogOverlay
      class="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
    />
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 pointer-events-none">
      <DialogContent
        v-bind="forwarded"
        :class="cn('pointer-events-auto relative w-full max-w-lg max-h-[90vh] overflow-y-auto grid gap-4 border border-border bg-background p-6 shadow-2xl duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 rounded-3xl', props.class)"
      >
        <slot />
        <DialogClose
          class="absolute right-4 top-4 rounded-xl p-1 opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground hover:bg-muted"
        >
          <X class="h-4 w-4" />
          <span class="sr-only">Close</span>
        </DialogClose>
      </DialogContent>
    </div>
  </DialogPortal>
</template>
