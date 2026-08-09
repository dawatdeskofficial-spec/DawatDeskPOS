<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch } from 'vue'
import { Terminal, RefreshCw, Play, Pause, Download, Search, AlertOctagon, Info, AlertTriangle } from 'lucide-vue-next'
import RoleLayout from '@/components/RoleLayout.vue'
import PageHeader from '@/components/PageHeader.vue'
import { adminNav } from '@/lib/nav'
import { getSystemLogs } from '@/lib/api'
import Button from '@/components/ui/Button.vue'
import Input from '@/components/ui/Input.vue'
import { toast } from 'vue-sonner'

const loading = ref(true)
const logType = ref<'info' | 'error'>('info')
const limit = ref(100)
const search = ref('')
const rawLogs = ref<string[]>([])
const autoRefresh = ref(false)
const refreshIntervalId = ref<any>(null)

async function fetchLogs(silent = false) {
  if (!silent) loading.value = true
  try {
    const res = await getSystemLogs(logType.value, limit.value)
    if (res.success && res.data && Array.isArray(res.data.logs)) {
      rawLogs.value = res.data.logs
    }
  } catch (err: any) {
    toast.error(err.message || 'Failed to fetch system logs')
  } finally {
    if (!silent) loading.value = false
  }
}

// Filtered logs list
const filteredLogs = computed(() => {
  if (!search.value.trim()) return rawLogs.value
  const query = search.value.toLowerCase()
  return rawLogs.value.filter(line => line.toLowerCase().includes(query))
})

// Log line formatter to inject rich HTML styles
function formatLogLine(line: string) {
  if (!line) return ''
  
  // Format: [2026-05-30T17:19:19.456Z] INFO: message
  const regex = /^\[([^\]]+)\]\s+(INFO|ERROR|WARN|DEBUG):\s+(.*)$/
  const match = line.match(regex)
  
  if (match) {
    const [_, timestamp, level, message] = match
    const date = new Date(timestamp)
    const timeFormatted = isNaN(date.getTime()) 
      ? timestamp 
      : date.toLocaleDateString() + ' ' + date.toLocaleTimeString()
    
    let levelClass = 'text-emerald-400 font-semibold'
    if (level === 'ERROR') levelClass = 'text-red-400 font-bold bg-red-950/40 px-1.5 py-0.5 rounded border border-red-900/30'
    else if (level === 'WARN') levelClass = 'text-amber-400 font-semibold'
    else if (level === 'DEBUG') levelClass = 'text-sky-400'
    
    return `<span class="text-zinc-500">${timeFormatted}</span> <span class="${levelClass}">${level}</span>: <span class="text-zinc-200">${message}</span>`
  }
  
  // Fallbacks if regex doesn't match perfectly
  if (line.includes('ERROR:')) {
    return line.replace('ERROR:', '<span class="text-red-400 font-bold bg-red-950/40 px-1.5 py-0.5 rounded border border-red-900/30">ERROR</span>:')
  }
  if (line.includes('WARN:')) {
    return line.replace('WARN:', '<span class="text-amber-400 font-semibold">WARN</span>:')
  }
  if (line.includes('INFO:')) {
    return line.replace('INFO:', '<span class="text-emerald-400 font-semibold">INFO</span>:')
  }
  
  return `<span class="text-zinc-400">${line}</span>`
}

function handleDownload() {
  const blob = new Blob([rawLogs.value.join('\n')], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `savoria-${logType.value}-logs-${Date.now()}.log`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
  toast.success('Log file downloaded successfully')
}

// Watchers
watch([logType, limit], () => {
  fetchLogs()
})

watch(autoRefresh, (newVal) => {
  if (newVal) {
    refreshIntervalId.value = setInterval(() => {
      fetchLogs(true)
    }, 5000)
    toast.info('Auto-refresh enabled (every 5s)')
  } else {
    if (refreshIntervalId.value) {
      clearInterval(refreshIntervalId.value)
      refreshIntervalId.value = null
    }
    toast.info('Auto-refresh disabled')
  }
})

onMounted(() => {
  fetchLogs()
})

onUnmounted(() => {
  if (refreshIntervalId.value) {
    clearInterval(refreshIntervalId.value)
  }
})
</script>

<template>
  <RoleLayout role="main_admin" :nav="adminNav">
    <PageHeader
      title="System Logs"
      subtitle="View, monitor, and filter live diagnostics and server events."
    >
      <template #action>
        <div class="flex flex-wrap items-center gap-2">
          <!-- Log File Type Selector -->
          <div class="flex items-center rounded-lg border border-border p-0.5 bg-muted">
            <button
              @click="logType = 'info'"
              :class="['px-3 py-1.5 text-xs font-semibold rounded-md transition-colors', logType === 'info' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground']"
            >
              App Logs
            </button>
            <button
              @click="logType = 'error'"
              :class="['px-3 py-1.5 text-xs font-semibold rounded-md transition-colors', logType === 'error' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground']"
            >
              Error Logs
            </button>
          </div>

          <!-- Refresh Buttons -->
          <Button variant="ghost" size="sm" class="h-9 px-3" @click="fetchLogs(false)" :disabled="loading">
            <RefreshCw :class="['h-4 w-4 mr-2', loading && 'animate-spin']" /> Manual Refresh
          </Button>

          <!-- Auto Refresh Polling -->
          <Button
            variant="outline"
            size="sm"
            :class="['h-9 px-3 border', autoRefresh ? 'border-primary text-primary bg-primary/5' : '']"
            @click="autoRefresh = !autoRefresh"
          >
            <component :is="autoRefresh ? Pause : Play" class="h-4 w-4 mr-2" />
            {{ autoRefresh ? 'Pause Auto' : 'Auto Live' }}
          </Button>

          <!-- Export Log -->
          <Button variant="outline" size="sm" class="h-9 px-3" @click="handleDownload" :disabled="rawLogs.length === 0">
            <Download class="h-4 w-4 mr-2" /> Export Log
          </Button>
        </div>
      </template>
    </PageHeader>

    <div class="space-y-4">
      <!-- Search and Count Controllers -->
      <div class="flex flex-col sm:flex-row gap-3 justify-between items-center bg-card border border-border p-4 rounded-2xl shadow-soft">
        <div class="relative w-full sm:max-w-md">
          <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search terminal output by message, path, or level…"
            v-model="search"
            class="pl-9 bg-muted/30 border-border text-sm"
          />
        </div>

        <div class="flex items-center gap-2 self-stretch sm:self-auto justify-between">
          <span class="text-xs text-muted-foreground whitespace-nowrap">Lines to fetch:</span>
          <select
            v-model.number="limit"
            class="flex h-9 w-24 rounded-md border border-input bg-transparent px-3 text-xs text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option :value="50">50 lines</option>
            <option :value="100">100 lines</option>
            <option :value="250">250 lines</option>
            <option :value="500">500 lines</option>
          </select>

          <span class="h-4 w-px bg-border hidden sm:block mx-1" />

          <span class="text-xs text-muted-foreground whitespace-nowrap">
            Showing {{ filteredLogs.length }} of {{ rawLogs.length }}
          </span>
        </div>
      </div>

      <!-- Terminal Console Window -->
      <div class="rounded-2xl border border-zinc-800 bg-zinc-950 shadow-soft overflow-hidden flex flex-col">
        <!-- Terminal Header Headerbar -->
        <div class="bg-zinc-900 border-b border-zinc-800 px-4 py-3 flex items-center justify-between">
          <div class="flex items-center gap-2">
            <div class="flex gap-1.5">
              <span class="h-3 w-3 rounded-full bg-red-500/80 inline-block" />
              <span class="h-3 w-3 rounded-full bg-yellow-500/80 inline-block" />
              <span class="h-3 w-3 rounded-full bg-green-500/80 inline-block" />
            </div>
            <span class="h-4 w-px bg-zinc-800 mx-2" />
            <div class="flex items-center gap-1.5 text-xs font-mono text-zinc-400">
              <Terminal class="h-3.5 w-3.5" />
              <span>bash - Savoria diagnostics - {{ logType === 'error' ? 'error.log' : 'app.log' }}</span>
            </div>
          </div>

          <div class="flex items-center gap-1.5 text-[10px] font-mono text-zinc-500 uppercase tracking-wider">
            <span>lines: {{ limit }}</span>
            <span class="h-2.5 w-2.5 rounded-full inline-block" :class="[autoRefresh ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-600']" />
          </div>
        </div>

        <!-- Terminal Body Content -->
        <div class="p-5 font-mono text-[12.5px] leading-relaxed overflow-y-auto max-h-[550px] min-h-[300px] flex flex-col gap-1 select-text">
          <div v-if="loading" class="flex flex-col items-center justify-center py-20 text-zinc-500 gap-2">
            <RefreshCw class="h-6 w-6 animate-spin text-zinc-600" />
            <span>Streaming log buffers...</span>
          </div>

          <div v-else-if="filteredLogs.length === 0" class="flex flex-col items-center justify-center py-20 text-zinc-500 gap-2">
            <AlertOctagon class="h-6 w-6 text-zinc-600" />
            <span>No log lines matched search query.</span>
          </div>

          <template v-else>
            <div
              v-for="(line, idx) in filteredLogs"
              :key="idx"
              v-html="formatLogLine(line)"
              class="hover:bg-zinc-900/60 px-2 py-0.5 rounded transition-colors whitespace-pre-wrap break-all"
            />
          </template>
        </div>
      </div>
    </div>
  </RoleLayout>
</template>

<style scoped>
/* Custom styled scrollbars for a neat terminal layout */
.overflow-y-auto::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}
.overflow-y-auto::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.2);
}
.overflow-y-auto::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 4px;
}
.overflow-y-auto::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.2);
}
</style>
