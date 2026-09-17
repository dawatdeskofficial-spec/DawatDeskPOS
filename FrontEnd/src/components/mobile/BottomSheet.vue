<script setup lang="ts">
import { watch } from 'vue'
import { X } from 'lucide-vue-next'

const props = withDefaults(defineProps<{
  open: boolean
  title?: string
  subtitle?: string
  maxHeight?: string
}>(), {
  maxHeight: 'max-h-[88vh]'
})

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'update:open', val: boolean): void
}>()

function handleClose() {
  emit('update:open', false)
  emit('close')
}

// Disable body scroll while bottom sheet is open
watch(() => props.open, (isOpen) => {
  if (typeof document !== 'undefined') {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
  }
})
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div
        v-if="open"
        class="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex flex-col justify-end"
        @click.self="handleClose"
      >
        <Transition name="slide-up">
          <div
            v-if="open"
            :class="[
              'w-full bg-card rounded-t-3xl border-t border-border shadow-2xl flex flex-col overflow-hidden',
              maxHeight
            ]"
            @click.stop
          >
            <!-- Drag handle -->
            <div class="pt-3 pb-1 flex justify-center shrink-0 cursor-grab" @click="handleClose">
              <div class="w-12 h-1.5 rounded-full bg-muted-foreground/30" />
            </div>

            <!-- Header -->
            <div v-if="title || $slots.header" class="px-5 py-3 border-b border-border flex items-center justify-between shrink-0">
              <slot name="header">
                <div>
                  <h3 class="text-base font-bold text-foreground font-display leading-tight">{{ title }}</h3>
                  <p v-if="subtitle" class="text-xs text-muted-foreground mt-0.5">{{ subtitle }}</p>
                </div>
                <button
                  type="button"
                  @click="handleClose"
                  class="h-8 w-8 rounded-full bg-muted/60 hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer transition"
                >
                  <X class="h-4 w-4" />
                </button>
              </slot>
            </div>

            <!-- Scrollable Content -->
            <div class="flex-1 overflow-y-auto p-5 overscroll-contain">
              <slot />
            </div>

            <!-- Optional sticky footer -->
            <div v-if="$slots.footer" class="p-4 border-t border-border bg-card/95 backdrop-blur-md shrink-0 pb-safe">
              <slot name="footer" />
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.slide-up-enter-active,
.slide-up-leave-active {
  transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}
.slide-up-enter-from,
.slide-up-leave-to {
  transform: translateY(100%);
}

.pb-safe {
  padding-bottom: max(1rem, env(safe-area-inset-bottom));
}
</style>
