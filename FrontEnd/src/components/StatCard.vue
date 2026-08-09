<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  label: string;
  value: string | number;
  delta?: string;
  deltaTone?: "success" | "destructive" | "muted";
  icon?: any;
  tone?: "primary" | "success" | "info" | "warning" | "destructive";
  spark?: number[];
}>(), {
  deltaTone: 'success',
  tone: 'primary',
  spark: () => [3, 5, 4, 6, 7, 6, 8, 7, 9]
})

const TONE_BG: Record<string, string> = {
  primary: "bg-primary/10 text-primary",
  success: "bg-success/10 text-success",
  info: "bg-info/10 text-info",
  warning: "bg-warning/15 text-warning",
  destructive: "bg-destructive/10 text-destructive",
};

const TONE_STROKE: Record<string, string> = {
  primary: "var(--primary)",
  success: "var(--success)",
  info: "var(--info)",
  warning: "var(--warning)",
  destructive: "var(--destructive)",
};

const deltaClass = computed(() => {
  if (props.deltaTone === 'success') return "text-success bg-success/10";
  if (props.deltaTone === 'destructive') return "text-destructive bg-destructive/10";
  return "text-muted-foreground bg-muted";
})

const series = computed(() => [{ name: 'trend', data: props.spark }])
const chartOptions = computed(() => ({
  chart: { type: 'area', sparkline: { enabled: true }, animations: { enabled: false } },
  stroke: { curve: 'smooth', width: 2, colors: [TONE_STROKE[props.tone]] },
  fill: {
    type: 'gradient',
    gradient: { shadeIntensity: 1, opacityFrom: 0.4, opacityTo: 0, stops: [0, 100] },
    colors: [TONE_STROKE[props.tone]]
  },
  tooltip: { fixed: { enabled: false }, x: { show: false }, y: { title: { formatter: () => '' } }, marker: { show: false } }
}))
</script>

<template>
  <div class="rounded-xl bg-card border border-border p-4 shadow-soft hover-lift animate-slide-up">
    <div class="flex items-start justify-between gap-3">
      <div>
        <div class="flex items-center gap-2">
          <div :class="['h-8 w-8 rounded-lg grid place-items-center', TONE_BG[tone]]">
            <component :is="icon" v-if="icon" class="h-4 w-4" />
          </div>
          <div class="text-xs font-medium text-muted-foreground">{{ label }}</div>
        </div>
        <div class="mt-3 flex items-baseline gap-2">
          <div class="text-2xl font-bold tracking-tight">{{ value }}</div>
          <span v-if="delta" :class="['text-[11px] font-semibold px-1.5 py-0.5 rounded', deltaClass]">{{ delta }}</span>
        </div>
      </div>
      <div class="w-20 h-12 -mr-1 -mt-1 opacity-90 flex-none overflow-hidden relative">
        <apexchart type="area" height="100%" width="100%" :options="chartOptions" :series="series" />
      </div>
    </div>
  </div>
</template>
