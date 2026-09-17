<script setup lang="ts">
import { computed } from 'vue'
import { isDarkMode } from '@/lib/theme'

const props = withDefaults(defineProps<{
  variant?: 'auto' | 'light' | 'dark'
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | string | number
  iconOnly?: boolean
  collapsed?: boolean
  showSubtitle?: boolean
  subtitle?: string
  to?: string
  alt?: string
}>(), {
  variant: 'auto',
  size: 'md',
  iconOnly: false,
  collapsed: false,
  showSubtitle: undefined,
  subtitle: 'Kitchen & Table',
  alt: 'DawatDesk'
})

const isIconOnly = computed(() => props.iconOnly || props.collapsed)

const effectiveTheme = computed<'dark' | 'light'>(() => {
  if (props.variant === 'dark') return 'dark'
  if (props.variant === 'light') return 'light'
  return isDarkMode.value ? 'dark' : 'light'
})

// Sizes for the circular emblem mark
const markSizeClass = computed(() => {
  switch (props.size) {
    case 'xs': return 'w-7 h-7'
    case 'sm': return 'w-8.5 h-8.5'
    case 'md': return 'w-10 h-10'
    case 'lg': return 'w-13 h-13'
    case 'xl': return 'w-16 h-16'
    default: return 'w-10 h-10'
  }
})

const markBgClass = computed(() => {
  if (effectiveTheme.value === 'dark') {
    // Exactly like img3: Dark circular disc with subtle ring
    return 'bg-[#11141c] text-white border border-white/12 shadow-sm'
  }
  // Exactly like img2: Clean crisp background with dark lines
  return 'bg-white text-[#181b22] border border-slate-200/80 shadow-xs'
})

const customMarkStyle = computed(() => {
  if (typeof props.size === 'number') {
    return { width: `${props.size}px`, height: `${props.size}px` }
  }
  if (typeof props.size === 'string' && props.size.includes('px')) {
    return { width: props.size, height: props.size }
  }
  return {}
})

const titleSizeClass = computed(() => {
  switch (props.size) {
    case 'xs': return 'text-sm'
    case 'sm': return 'text-base'
    case 'md': return 'text-xl'
    case 'lg': return 'text-2xl sm:text-3xl'
    case 'xl': return 'text-3xl sm:text-4xl'
    default: return 'text-xl'
  }
})

const subtitleSizeClass = computed(() => {
  switch (props.size) {
    case 'xs': return 'text-[7.5px]'
    case 'sm': return 'text-[8.5px]'
    case 'md': return 'text-[10px]'
    case 'lg': return 'text-[11px]'
    case 'xl': return 'text-xs'
    default: return 'text-[10px]'
  }
})

const shouldShowSubtitle = computed(() => {
  if (props.showSubtitle !== undefined) return props.showSubtitle
  return !isIconOnly.value && ['md', 'lg', 'xl'].includes(String(props.size))
})

const dawatColorClass = computed(() => {
  if (props.variant === 'dark') return 'text-white'
  if (props.variant === 'light') return 'text-slate-900'
  return 'text-foreground'
})

const subtitleColorClass = computed(() => {
  if (props.variant === 'dark') return 'text-white/60'
  if (props.variant === 'light') return 'text-slate-500'
  return 'text-muted-foreground'
})
</script>

<template>
  <component
    :is="to ? 'router-link' : 'div'"
    v-bind="to ? { to } : {}"
    class="group inline-flex items-center gap-2.5 select-none focus-visible:outline-2 focus-visible:outline-primary rounded-xl transition-all"
    :class="[to ? 'cursor-pointer hover:opacity-95' : '']"
    :aria-label="alt"
  >
    <!-- ── 1. Circular Vector Logo Emblem (Exact geometry from img2 & img3) ── -->
    <div
      :class="[
        'relative flex items-center justify-center shrink-0 rounded-full p-1 transition-transform duration-300 group-hover:scale-105',
        markSizeClass,
        markBgClass
      ]"
      :style="customMarkStyle"
    >
      <svg
        viewBox="0 0 200 200"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        class="w-full h-full"
      >
        <!-- Outer Ring with clearance gap for the golden dot -->
        <path
          d="M 169.5 91 A 78 78 0 1 0 166 126"
          stroke="currentColor"
          stroke-width="12.5"
          stroke-linecap="butt"
        />

        <!-- Horizontal Center Bar (extends from left outer ring across center) -->
        <line
          x1="15"
          y1="108.5"
          x2="158"
          y2="108.5"
          stroke="currentColor"
          stroke-width="12.5"
          stroke-linecap="butt"
        />

        <!-- Cloche Dome Arch (Floating with clean gap above horizontal bar) -->
        <path
          d="M 56 99 A 43 40 0 0 1 92 57.5 C 94 49 104 49 106 57.5 A 43 40 0 0 1 142 99"
          stroke="currentColor"
          stroke-width="12.5"
          stroke-linecap="butt"
          stroke-linejoin="round"
          fill="none"
        />
        <!-- Handle Knob apex fill -->
        <path
          d="M 92 57.5 C 94 49 104 49 106 57.5 Z"
          fill="currentColor"
        />

        <!-- Golden Amber Crescent inside Left Cloche Dome -->
        <path
          d="M 68 99 C 69 88.5 74 78.5 80.5 73 C 84 70 88 68 92.5 66.5 C 89 71.5 86 78.5 84 86 C 82.5 90.5 81.8 95 81.5 99 Z"
          fill="#c5982f"
        />

        <!-- Stylized Letter 'D' below Horizontal Bar -->
        <path
          d="M 72 114.5 V 137 C 72 147.5 78.5 147.5 89 147.5 H 106 C 124 147.5 134 135 134 114.5"
          stroke="currentColor"
          stroke-width="12.5"
          stroke-linecap="butt"
          stroke-linejoin="round"
          fill="none"
        />

        <!-- Golden Amber Dot at 3 o'clock in the ring gap -->
        <circle
          cx="176.5"
          cy="108.5"
          r="9.8"
          fill="#c5982f"
        />
      </svg>
    </div>

    <!-- ── 2. Brand Typography (Hidden when isIconOnly) ── -->
    <div v-if="!isIconOnly" class="flex flex-col leading-none">
      <div class="flex items-baseline tracking-tight font-bold" :class="titleSizeClass">
        <span class="font-brand tracking-tight" :class="dawatColorClass">Dawat</span>
        <span class="font-display font-extrabold ml-[2px] text-[#c89b3c]">Desk</span>
      </div>
      <span
        v-if="shouldShowSubtitle"
        :class="['uppercase tracking-[0.24em] font-semibold mt-0.5 select-none', subtitleSizeClass, subtitleColorClass]"
      >
        {{ subtitle }}
      </span>
    </div>
  </component>
</template>
