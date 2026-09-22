<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  label: string;
  value: string | number;
  delta?: string;
  deltaTone?: "success" | "destructive" | "muted";
  icon?: any;
  tone?: "primary" | "success" | "info" | "warning" | "destructive";
}>(), {
  deltaTone: 'success',
  tone: 'primary',
})

const TONE_BG: Record<string, string> = {
  primary: "bg-primary/10 text-primary border-primary/20",
  success: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  info: "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20",
  warning: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  destructive: "bg-destructive/10 text-destructive border-destructive/20",
};

const deltaClass = computed(() => {
  if (props.deltaTone === 'success') return "text-emerald-700 bg-emerald-500/10 border-emerald-500/20 dark:text-emerald-400";
  if (props.deltaTone === 'destructive') return "text-destructive bg-destructive/10 border-destructive/20";
  return "text-muted-foreground bg-muted border-border";
})
</script>

<template>
  <div class="rounded-2xl bg-card border border-border p-3.5 sm:p-4 lg:p-5 shadow-xs hover:shadow-soft transition-all flex flex-col justify-between min-w-0">
    <div class="flex items-center justify-between gap-1.5 min-w-0">
      <div class="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-muted-foreground truncate flex-1 min-w-0" :title="label">
        {{ label }}
      </div>
      <div :class="['h-7 w-7 sm:h-8 sm:w-8 lg:h-9 lg:w-9 rounded-xl border grid place-items-center shrink-0 shadow-2xs', TONE_BG[tone]]">
        <component :is="icon" v-if="icon" class="h-3.5 w-3.5 sm:h-4 sm:w-4" />
      </div>
    </div>
    <div class="mt-2.5 sm:mt-3.5 lg:mt-4 min-w-0">
      <div class="text-xl sm:text-2xl lg:text-3xl font-extrabold tracking-tight font-display text-foreground leading-tight truncate">
        {{ value }}
      </div>
      <div v-if="delta" class="mt-1 sm:mt-1.5 flex items-center min-w-0">
        <span :class="['inline-flex items-center text-[10px] sm:text-[11.5px] font-semibold px-2 py-0.5 rounded-md border truncate max-w-full leading-tight', deltaClass]" :title="delta">
          {{ delta }}
        </span>
      </div>
    </div>
  </div>
</template>
