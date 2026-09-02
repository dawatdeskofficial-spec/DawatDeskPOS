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
  <div class="rounded-2xl bg-card border border-border p-5 shadow-soft hover:shadow-glow transition-all">
    <div class="flex items-center justify-between gap-2">
      <div class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{{ label }}</div>
      <div :class="['h-9 w-9 rounded-xl border grid place-items-center flex-none', TONE_BG[tone]]">
        <component :is="icon" v-if="icon" class="h-4.5 w-4.5" />
      </div>
    </div>
    <div class="mt-4 flex items-baseline justify-between gap-2 flex-wrap">
      <div class="text-2xl lg:text-3xl font-extrabold tracking-tight font-display">{{ value }}</div>
      <span v-if="delta" :class="['text-xs font-semibold px-2 py-0.5 rounded-full border', deltaClass]">
        {{ delta }}
      </span>
    </div>
  </div>
</template>
