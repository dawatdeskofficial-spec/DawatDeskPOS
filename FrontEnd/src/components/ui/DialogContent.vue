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
        <!-- Static / Sticky Close Cross Button (stays fixed at top-right while scrolling) -->
        <div class="sticky top-0 z-50 flex justify-end h-0 pointer-events-none -mb-6">
          <DialogClose
            class="pointer-events-auto rounded-xl p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors border-0 outline-none focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 shadow-none cursor-pointer"
          >
            <X class="h-4 w-4" />
            <span class="sr-only">Close</span>
          </DialogClose>
        </div>
        <slot />
      </DialogContent>
    </div>
  </DialogPortal>
</template>
