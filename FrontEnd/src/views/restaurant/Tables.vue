<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import {
  Table2, Plus, Minus, RefreshCw, Clock, User, DollarSign,
  AlertCircle, CheckCircle2, ChevronRight, LayoutGrid, ClipboardList,
  Users, Sliders, Check, Sparkles, Settings2, Receipt, X, Search
} from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import RoleLayout from '@/components/RoleLayout.vue'
import PageHeader from '@/components/PageHeader.vue'
import StatCard from '@/components/StatCard.vue'
import Button from '@/components/ui/Button.vue'
import Badge from '@/components/ui/Badge.vue'
import Input from '@/components/ui/Input.vue'
import Dialog from '@/components/ui/Dialog.vue'
import DialogContent from '@/components/ui/DialogContent.vue'
import DialogHeader from '@/components/ui/DialogHeader.vue'
import DialogTitle from '@/components/ui/DialogTitle.vue'
import DialogDescription from '@/components/ui/DialogDescription.vue'
import { restaurantNav } from '@/lib/nav'
import { getOrders, getRestaurantById, updateRestaurant } from '@/lib/api'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const loading = ref(true)
const updating = ref(false)
const restaurant = ref<any>(null)
const orders = ref<any[]>([])
const tableSearch = ref('')
const statusFilter = ref<'ALL' | 'available' | 'occupied'>('ALL')

// Selected Table Modal State
const selectedTableModal = ref(false)
const selectedTable = ref<{ number: number; capacity: number; status: string; order: any } | null>(null)
const editCapacityVal = ref(4)

let interval: any

const restaurantId = computed(() => {
  return auth.effectiveRestaurantId || ""
})

async function fetchTablesData(silent = false) {
  if (!restaurantId.value) return
  if (!silent) loading.value = true
  try {
    const [restRes, ordersRes] = await Promise.all([
      getRestaurantById(restaurantId.value),
      getOrders(restaurantId.value, 1, 100)
    ])
    restaurant.value = restRes.data
    orders.value = ordersRes.data || []
  } catch (err: any) {
    toast.error(err.message || 'Failed to load floor tables configuration')
  } finally {
    if (!silent) loading.value = false
  }
}

onMounted(() => {
  fetchTablesData()
  interval = setInterval(() => fetchTablesData(true), 5000)
})

onUnmounted(() => {
  clearInterval(interval)
})

// Compute active/occupied orders per table
const activeOrdersMap = computed(() => {
  const map = new Map<number, any>()
  orders.value.forEach(o => {
    if (['PENDING', 'PREPARING', 'READY', 'SERVED'].includes(o.status)) {
      map.set(o.tableNumber || o.table, o)
    }
  })
  return map
})

const maxTablesCount = computed(() => {
  return restaurant.value?.maxTables || 0
})

const occupiedTablesCount = computed(() => {
  return activeOrdersMap.value.size
})

const availableTablesCount = computed(() => {
  return Math.max(0, maxTablesCount.value - occupiedTablesCount.value)
})

const occupancyRate = computed(() => {
  if (maxTablesCount.value === 0) return 0
  return Math.round((occupiedTablesCount.value / maxTablesCount.value) * 100)
})

// Table Capacities Map Helper
function getTableCapacity(tableNumber: number): number {
  if (!restaurant.value?.tableCapacities) return 4
  const caps = restaurant.value.tableCapacities
  if (caps instanceof Map) {
    return caps.get(String(tableNumber)) || caps.get(tableNumber) || 4
  }
  return caps[String(tableNumber)] || caps[tableNumber] || 4
}

const totalSeatsCount = computed(() => {
  let total = 0
  for (let i = 1; i <= maxTablesCount.value; i++) {
    total += getTableCapacity(i)
  }
  return total
})

const occupiedSeatsCount = computed(() => {
  let total = 0
  activeOrdersMap.value.forEach((_, tableNum) => {
    total += getTableCapacity(Number(tableNum))
  })
  return total
})

// Build dynamic tables details list
const tablesList = computed(() => {
  return Array.from({ length: maxTablesCount.value }, (_, i) => {
    const number = i + 1
    const activeOrder = activeOrdersMap.value.get(number)
    const capacity = getTableCapacity(number)
    return {
      number,
      capacity,
      status: activeOrder ? 'occupied' : 'available',
      order: activeOrder || null
    }
  })
})

const filteredTablesList = computed(() => {
  let list = tablesList.value
  if (statusFilter.value !== 'ALL') {
    list = list.filter(t => t.status === statusFilter.value)
  }
  if (tableSearch.value.trim()) {
    const q = tableSearch.value.toLowerCase().trim()
    list = list.filter(t => {
      const numStr = `table ${t.number}`.toLowerCase()
      const tNumStr = `t-${String(t.number).padStart(2, '0')}`.toLowerCase()
      const numOnly = String(t.number)
      const capStr = `${t.capacity} seats`.toLowerCase()
      const orderItems = (t.order?.items || []).some((it: any) => (it.name || '').toLowerCase().includes(q))
      const custName = (t.order?.customerName || '').toLowerCase()
      return numStr.includes(q) || tNumStr.includes(q) || numOnly === q || capStr.includes(q) || orderItems || custName.includes(q)
    })
  }
  return list
})

// Open table details modal
function openTableDetails(t: { number: number; capacity: number; status: string; order: any }) {
  selectedTable.value = t
  editCapacityVal.value = t.capacity
  selectedTableModal.value = true
}

// Update a specific table's capacity
async function handleSaveSelectedTableCapacity() {
  if (!selectedTable.value || !restaurant.value || updating.value || editCapacityVal.value < 1) return
  const tableNum = selectedTable.value.number
  const newCap = editCapacityVal.value
  updating.value = true

  const currentCaps: Record<string, number> = {}
  for (let i = 1; i <= maxTablesCount.value; i++) {
    currentCaps[String(i)] = getTableCapacity(i)
  }
  currentCaps[String(tableNum)] = newCap

  try {
    const res = await updateRestaurant(restaurantId.value, {
      tableCapacities: currentCaps
    })
    if (res.success) {
      restaurant.value = res.data
      toast.success(`Table T-${String(tableNum).padStart(2, '0')} capacity updated to ${newCap} seats!`)
      selectedTableModal.value = false
      selectedTable.value = null
    } else {
      toast.error(res.message || 'Failed to update capacity')
    }
  } catch (err: any) {
    toast.error(err.message || 'Error occurred while updating capacity')
  } finally {
    updating.value = false
  }
}

// Bulk update all tables capacity
async function handleSetAllTablesCapacity(capacity: number) {
  if (!restaurant.value || updating.value || capacity < 1) return
  updating.value = true

  const currentCaps: Record<string, number> = {}
  for (let i = 1; i <= maxTablesCount.value; i++) {
    currentCaps[String(i)] = capacity
  }

  try {
    const res = await updateRestaurant(restaurantId.value, {
      tableCapacities: currentCaps
    })
    if (res.success) {
      restaurant.value = res.data
      toast.success(`All ${maxTablesCount.value} tables set to ${capacity} seats!`)
    } else {
      toast.error(res.message || 'Failed to update table capacities')
    }
  } catch (err: any) {
    toast.error(err.message || 'Error occurred while updating capacities')
  } finally {
    updating.value = false
  }
}

// Increment total tables in DB
async function handleAddTable() {
  if (!restaurant.value || updating.value) return
  updating.value = true
  const newMax = maxTablesCount.value + 1
  try {
    const currentCaps: Record<string, number> = {}
    for (let i = 1; i < newMax; i++) {
      currentCaps[String(i)] = getTableCapacity(i)
    }
    currentCaps[String(newMax)] = 4 // default 4 seats for new table

    const res = await updateRestaurant(restaurantId.value, {
      maxTables: newMax,
      tableCapacities: currentCaps
    })
    if (res.success) {
      restaurant.value = res.data
      toast.success(`Table T-${String(newMax).padStart(2, '0')} (4 Seats) added successfully!`)
      fetchTablesData(true)
    } else {
      toast.error(res.message || 'Failed to add table')
    }
  } catch (err: any) {
    toast.error(err.message || 'Error occurred while adding table')
  } finally {
    updating.value = false
  }
}

// Decrement total tables in DB
async function handleRemoveTable() {
  if (!restaurant.value || updating.value || maxTablesCount.value <= 1) return
  const tableToRemove = maxTablesCount.value
  
  // Guard check: cannot remove table if it has active order
  if (activeOrdersMap.value.has(tableToRemove)) {
    toast.error(`Cannot remove Table T-${String(tableToRemove).padStart(2, '0')} as it has active orders!`)
    return
  }

  updating.value = true
  const newMax = maxTablesCount.value - 1
  try {
    const res = await updateRestaurant(restaurantId.value, {
      maxTables: newMax
    })
    if (res.success) {
      restaurant.value = res.data
      toast.success(`Table T-${String(tableToRemove).padStart(2, '0')} removed successfully.`)
      fetchTablesData(true)
    } else {
      toast.error(res.message || 'Failed to remove table')
    }
  } catch (err: any) {
    toast.error(err.message || 'Error occurred while removing table')
  } finally {
    updating.value = false
  }
}

// Bulk update tables count directly
const customTablesInput = ref('')
async function handleBulkUpdateTables() {
  const newMax = parseInt(customTablesInput.value, 10)
  if (isNaN(newMax) || newMax < 1 || newMax > 100) {
    toast.error('Please provide a valid table count between 1 and 100.')
    return
  }

  if (newMax < maxTablesCount.value) {
    for (let t = newMax + 1; t <= maxTablesCount.value; t++) {
      if (activeOrdersMap.value.has(t)) {
        toast.error(`Cannot reduce tables. Table T-${String(t).padStart(2, '0')} currently has an active order.`)
        return
      }
    }
  }

  updating.value = true
  try {
    const currentCaps: Record<string, number> = {}
    for (let i = 1; i <= newMax; i++) {
      currentCaps[String(i)] = getTableCapacity(i)
    }

    const res = await updateRestaurant(restaurantId.value, {
      maxTables: newMax,
      tableCapacities: currentCaps
    })
    if (res.success) {
      restaurant.value = res.data
      toast.success(`Floor capacity updated to ${newMax} tables!`)
      customTablesInput.value = ''
      fetchTablesData(true)
    } else {
      toast.error(res.message || 'Failed to update tables capacity')
    }
  } catch (err: any) {
    toast.error(err.message || 'Error occurred during floor plan update')
  } finally {
    updating.value = false
  }
}

function timeSince(ts: string) {
  if (!ts) return ''
  const m = Math.floor((Date.now() - new Date(ts).getTime()) / 60000)
  if (m > 60) return `${Math.floor(m / 60)}h ago`
  if (m <= 0) return 'Just now'
  return `${m}m ago`
}
</script>

<template>
  <RoleLayout role="restaurant_admin" :nav="restaurantNav">
    <PageHeader
      title="Tables &amp; Floor Plan"
      subtitle="Configure dining tables, seating capacities, and monitor live dining sessions."
    >
      <template #action>
        <div class="flex items-center gap-1.5 sm:gap-2">
          <Button variant="ghost" size="sm" class="h-8 sm:h-9 px-2 sm:px-3 text-xs" @click="fetchTablesData(false)" :disabled="loading || updating" title="Sync Floor">
            <RefreshCw :class="['h-3.5 w-3.5 sm:mr-2', loading && 'animate-spin']" />
            <span class="hidden sm:inline">Sync Floor</span>
          </Button>
          <Button variant="outline" size="sm" class="h-8 sm:h-9 px-2 sm:px-3 text-xs text-destructive hover:bg-destructive/10" @click="handleRemoveTable" :disabled="maxTablesCount <= 1 || updating" title="Remove Last Table">
            <Minus class="h-3.5 w-3.5 sm:mr-1.5" />
            <span class="hidden sm:inline">Remove Last</span>
            <span class="sm:hidden">− Table</span>
          </Button>
          <Button class="gradient-primary text-primary-foreground h-8 sm:h-9 px-2.5 sm:px-3 text-xs shadow-glow" @click="handleAddTable" :disabled="updating">
            <Plus class="h-3.5 w-3.5 sm:mr-1.5" />
            <span class="hidden sm:inline">Add Table</span>
            <span class="sm:hidden">+ Table</span>
          </Button>
        </div>
      </template>
    </PageHeader>

    <div v-if="loading && !restaurant" class="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
      <RefreshCw class="h-8 w-8 animate-spin text-primary" />
      <span class="text-sm font-medium">Loading floor arrangements...</span>
    </div>

    <template v-else>
      <!-- Desktop Stat Cards Overview (Hidden on Mobile) -->
      <div class="hidden md:grid md:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Tables" :value="maxTablesCount.toString()" delta="Operational tables" :icon="Table2" tone="primary" />
        <StatCard label="Total Capacity" :value="`${totalSeatsCount} Seats`" :delta="`${occupiedSeatsCount} seats occupied`" :icon="Users" tone="info" />
        <StatCard label="Available Tables" :value="availableTablesCount.toString()" delta="Ready for seating" :icon="CheckCircle2" tone="success" />
        <StatCard label="Floor Occupancy" :value="`${occupancyRate}%`" :delta="`${occupiedTablesCount} active sessions`" :icon="ClipboardList" tone="warning" />
      </div>

      <!-- Mobile Compact 2x2 KPI Capsule (Visible on Mobile) -->
      <div class="grid grid-cols-2 gap-2 mb-4 md:hidden">
        <div class="p-2.5 rounded-xl bg-card border border-border flex items-center justify-between shadow-2xs">
          <div>
            <div class="text-[9px] font-bold uppercase text-muted-foreground">Total Tables</div>
            <div class="font-display text-sm font-extrabold text-foreground mt-0.5">{{ maxTablesCount }} <span class="text-[10px] font-semibold text-muted-foreground font-sans">({{ totalSeatsCount }} seats)</span></div>
          </div>
          <div class="h-7 w-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
            <Table2 class="h-3.5 w-3.5" />
          </div>
        </div>

        <div class="p-2.5 rounded-xl bg-card border border-border flex items-center justify-between shadow-2xs">
          <div>
            <div class="text-[9px] font-bold uppercase text-muted-foreground">Available</div>
            <div class="font-display text-sm font-extrabold text-emerald-600 dark:text-emerald-400 mt-0.5">{{ availableTablesCount }} Tables</div>
          </div>
          <div class="h-7 w-7 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <CheckCircle2 class="h-3.5 w-3.5" />
          </div>
        </div>

        <div class="p-2.5 rounded-xl bg-card border border-border flex items-center justify-between shadow-2xs">
          <div>
            <div class="text-[9px] font-bold uppercase text-muted-foreground">Occupied</div>
            <div class="font-display text-sm font-extrabold text-primary mt-0.5">{{ occupiedTablesCount }} Tables</div>
          </div>
          <div class="h-7 w-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
            <Users class="h-3.5 w-3.5" />
          </div>
        </div>

        <div class="p-2.5 rounded-xl bg-card border border-border flex items-center justify-between shadow-2xs">
          <div>
            <div class="text-[9px] font-bold uppercase text-muted-foreground">Occupancy</div>
            <div class="font-display text-sm font-extrabold text-amber-600 dark:text-amber-400 mt-0.5">{{ occupancyRate }}%</div>
          </div>
          <div class="h-7 w-7 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
            <ClipboardList class="h-3.5 w-3.5" />
          </div>
        </div>
      </div>

      <div class="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-6 items-start">
        <!-- Clean, Modern Live Table Grid -->
        <div class="space-y-4">
          <div class="rounded-2xl border border-border bg-card shadow-soft p-4 sm:p-5">
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
              <div>
                <h3 class="font-display font-bold text-base sm:text-lg">Floor Plan Layout</h3>
                <p class="text-xs text-muted-foreground hidden sm:block">Click any table to view live order details or change its seating capacity.</p>
              </div>
              <Badge variant="outline" class="text-xs border-primary/30 text-primary w-fit font-semibold hidden sm:inline-flex">
                <Users class="h-3 w-3 mr-1" /> {{ totalSeatsCount }} Total Seats
              </Badge>
            </div>

            <!-- Search & Status Filter Ribbon -->
            <div class="mb-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 p-2.5 sm:p-3 rounded-xl bg-muted/20 border border-border">
              <div class="relative flex-1 max-w-sm">
                <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  v-model="tableSearch"
                  placeholder="Search table (e.g. 3, T-05)…"
                  class="pl-9 pr-8 h-8 text-xs bg-background"
                />
                <button
                  v-if="tableSearch"
                  @click="tableSearch = ''"
                  class="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  <X class="h-3.5 w-3.5" />
                </button>
              </div>

              <!-- Status Filter Pills -->
              <div class="flex items-center gap-1.5 shrink-0 overflow-x-auto no-scrollbar">
                <button
                  @click="statusFilter = 'ALL'"
                  :class="['px-2.5 py-1 rounded-lg text-xs font-semibold transition border cursor-pointer', statusFilter === 'ALL' ? 'bg-primary text-primary-foreground border-transparent' : 'bg-background border-border text-muted-foreground hover:text-foreground']"
                >
                  All ({{ tablesList.length }})
                </button>
                <button
                  @click="statusFilter = 'available'"
                  :class="['px-2.5 py-1 rounded-lg text-xs font-semibold transition border cursor-pointer', statusFilter === 'available' ? 'bg-emerald-600 text-white border-transparent' : 'bg-background border-border text-muted-foreground hover:text-foreground']"
                >
                  Available ({{ availableTablesCount }})
                </button>
                <button
                  @click="statusFilter = 'occupied'"
                  :class="['px-2.5 py-1 rounded-lg text-xs font-semibold transition border cursor-pointer', statusFilter === 'occupied' ? 'bg-primary text-primary-foreground border-transparent' : 'bg-background border-border text-muted-foreground hover:text-foreground']"
                >
                  Occupied ({{ occupiedTablesCount }})
                </button>
              </div>
            </div>

            <!-- Empty state if search returns zero -->
            <div v-if="filteredTablesList.length === 0" class="p-12 text-center text-muted-foreground rounded-xl border border-dashed border-border">
              <Search class="h-8 w-8 mx-auto mb-2 opacity-30 text-muted-foreground" />
              <p class="font-semibold text-sm">No tables match "{{ tableSearch }}"</p>
              <Button size="sm" variant="ghost" class="mt-2 text-xs" @click="tableSearch = ''; statusFilter = 'ALL'">
                Clear Filters
              </Button>
            </div>

            <!-- Table Cards: Clean, properly styled, responsive grid -->
            <div v-else class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3.5">
              <button
                v-for="t in filteredTablesList"
                :key="t.number"
                type="button"
                @click="openTableDetails(t)"
                :class="[
                  'rounded-2xl border-2 p-4 text-left transition-all duration-200 flex flex-col justify-between min-h-[140px] hover:shadow-md hover:-translate-y-0.5 relative group',
                  t.status === 'occupied' 
                    ? 'border-primary/40 bg-primary/5 hover:border-primary' 
                    : 'border-emerald-500/30 bg-emerald-500/5 hover:border-emerald-500/70'
                ]"
              >
                <!-- Card Header Info -->
                <div class="flex justify-between items-start w-full">
                  <div>
                    <span class="font-display font-bold text-base text-foreground group-hover:text-primary transition">
                      Table {{ String(t.number).padStart(2, '0') }}
                    </span>
                    <span :class="['block text-[10px] uppercase font-bold tracking-wider mt-0.5', t.status === 'occupied' ? 'text-primary' : 'text-emerald-600 dark:text-emerald-400']">
                      ● {{ t.status }}
                    </span>
                  </div>
                  <div :class="['h-8 w-8 rounded-xl grid place-items-center shrink-0 transition', t.status === 'occupied' ? 'bg-primary/10 text-primary' : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400']">
                    <Table2 class="h-4 w-4" />
                  </div>
                </div>

                <!-- Clean Capacity Pill -->
                <div class="mt-3 pt-2.5 border-t border-border/40 flex items-center justify-start w-full">
                  <span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-background border border-border text-[11px] font-semibold text-foreground">
                    <Users class="h-3 w-3 text-primary" /> {{ t.capacity }} Seats
                  </span>
                </div>
              </button>
            </div>
          </div>
        </div>

        <!-- Sidebar controls (bulk configuration & capacity templates) -->
        <aside class="rounded-2xl border border-border bg-card p-6 shadow-soft space-y-6">
          <div class="border-b border-border pb-4">
            <h3 class="font-display font-bold text-base">Floor Controls</h3>
            <p class="text-xs text-muted-foreground mt-0.5">Adjust floor plan and quick capacity presets</p>
          </div>

          <!-- Quick Bulk Capacity Templates -->
          <div class="space-y-3">
            <h4 class="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Sliders class="h-3.5 w-3.5 text-primary" /> Set All Tables Capacity
            </h4>
            <div class="grid grid-cols-4 gap-1.5">
              <button
                v-for="cap in [2, 4, 6, 8]"
                :key="cap"
                @click="handleSetAllTablesCapacity(cap)"
                :disabled="updating"
                class="py-2 px-2 rounded-xl border border-border hover:border-primary/50 hover:bg-primary/5 text-xs font-bold text-center transition active:scale-95 disabled:opacity-40"
              >
                {{ cap }} Seats
              </button>
            </div>
            <p class="text-[10px] text-muted-foreground">
              Applies standard capacity across all active floor tables at once.
            </p>
          </div>

          <!-- Add/Remove quick section -->
          <div class="space-y-3.5 pt-3 border-t border-border">
            <h4 class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Adjust Table Count</h4>
            <div class="grid grid-cols-2 gap-2">
              <Button variant="outline" class="w-full flex items-center justify-center gap-1.5 h-11" @click="handleRemoveTable" :disabled="maxTablesCount <= 1 || updating">
                <Minus class="h-4 w-4" /> Remove
              </Button>
              <Button class="w-full gradient-primary text-primary-foreground flex items-center justify-center gap-1.5 h-11 shadow-glow" @click="handleAddTable" :disabled="updating">
                <Plus class="h-4 w-4" /> Add One
              </Button>
            </div>
          </div>

          <!-- Bulk update input -->
          <div class="space-y-3 pt-3 border-t border-border">
            <h4 class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Set Total Tables</h4>
            <div class="flex gap-2">
              <Input
                type="number"
                v-model="customTablesInput"
                :placeholder="`e.g. ${maxTablesCount}`"
                min="1"
                max="100"
                class="flex-1 h-11 bg-muted/40 text-sm"
              />
              <Button class="h-11 px-4" @click="handleBulkUpdateTables" :disabled="updating || !customTablesInput">
                Apply
              </Button>
            </div>
            <p class="text-[10px] text-muted-foreground leading-relaxed mt-1 flex items-start gap-1">
              <AlertCircle class="h-3 w-3 mt-0.5 shrink-0 text-primary" />
              <span>Updating tables count modifies store configuration dynamically.</span>
            </p>
          </div>
        </aside>
      </div>
    </template>

    <!-- ═══════════════════════════════════════════════════════════════════════ -->
    <!-- MODAL: TABLE DETAILS & CAPACITY CONFIGURATION                           -->
    <!-- ═══════════════════════════════════════════════════════════════════════ -->
    <Dialog :open="selectedTableModal" @update:open="selectedTableModal = $event">
      <DialogContent class="sm:max-w-md p-6">
        <DialogHeader class="mb-4">
          <DialogTitle class="font-display text-lg font-bold flex items-center justify-between">
            <div class="flex items-center gap-2">
              <Table2 class="h-5 w-5 text-primary" /> Table {{ String(selectedTable?.number).padStart(2, '0') }} Settings
            </div>
            <Badge :class="selectedTable?.status === 'occupied' ? 'bg-primary/20 text-primary' : 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'">
              ● {{ selectedTable?.status }}
            </Badge>
          </DialogTitle>
          <DialogDescription class="text-xs text-muted-foreground">
            Configure seating capacity and review live session details for this table.
          </DialogDescription>
        </DialogHeader>

        <div class="space-y-4">
          <!-- Capacity Setting -->
          <div class="p-4 rounded-xl bg-muted/20 border border-border space-y-3">
            <div class="flex items-center justify-between">
              <label class="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Users class="h-4 w-4 text-primary" /> Seating Capacity
              </label>
              <span class="text-xs font-bold text-primary font-display">
                {{ editCapacityVal }} Persons
              </span>
            </div>

            <!-- Quick capacity preset pills -->
            <div class="grid grid-cols-5 gap-1.5">
              <button
                v-for="cap in [2, 4, 6, 8, 10]"
                :key="cap"
                type="button"
                @click="editCapacityVal = cap"
                :class="[
                  'py-1.5 text-xs font-bold rounded-lg border transition text-center',
                  editCapacityVal === cap
                    ? 'border-primary bg-primary text-primary-foreground shadow-xs'
                    : 'border-border bg-background hover:border-primary/40 text-foreground'
                ]"
              >
                {{ cap }}s
              </button>
            </div>

            <!-- Custom capacity stepper -->
            <div class="flex items-center justify-between pt-1">
              <span class="text-xs text-muted-foreground">Custom seats:</span>
              <div class="flex items-center gap-1.5">
                <button
                  type="button"
                  :disabled="editCapacityVal <= 1"
                  @click="editCapacityVal = Math.max(1, editCapacityVal - 1)"
                  class="h-8 w-8 rounded-lg border border-border bg-background flex items-center justify-center text-foreground hover:bg-muted"
                >
                  <Minus class="h-3 w-3" />
                </button>
                <input
                  v-model.number="editCapacityVal"
                  type="number"
                  min="1"
                  max="30"
                  class="w-14 h-8 text-center font-bold text-xs rounded-lg border border-border bg-background"
                />
                <button
                  type="button"
                  :disabled="editCapacityVal >= 30"
                  @click="editCapacityVal++"
                  class="h-8 w-8 rounded-lg border border-border bg-background flex items-center justify-center text-foreground hover:bg-muted"
                >
                  <Plus class="h-3 w-3" />
                </button>
              </div>
            </div>
          </div>

          <!-- Active Session Info (if occupied) -->
          <div v-if="selectedTable?.order" class="p-3.5 rounded-xl bg-primary/5 border border-primary/20 space-y-2 text-xs">
            <div class="font-bold text-foreground flex items-center gap-1.5">
              <ClipboardList class="h-4 w-4 text-primary" /> Active Dining Session
            </div>
            <div class="flex justify-between text-muted-foreground">
              <span>Server:</span>
              <span class="font-semibold text-foreground">{{ selectedTable.order.createdBy?.name || 'Staff' }}</span>
            </div>
            <div class="flex justify-between text-muted-foreground">
              <span>Session Started:</span>
              <span class="font-semibold text-foreground">{{ timeSince(selectedTable.order.createdAt) }}</span>
            </div>
            <div class="flex justify-between text-muted-foreground">
              <span>Status:</span>
              <Badge class="bg-primary/20 text-primary text-[10px]">
                {{ selectedTable.order.status || 'OCCUPIED' }}
              </Badge>
            </div>
          </div>

          <div class="pt-3 border-t border-border flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              class="h-9 text-xs"
              @click="selectedTableModal = false"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              :disabled="updating"
              @click="handleSaveSelectedTableCapacity"
              class="h-9 text-xs font-bold gradient-primary text-primary-foreground shadow-glow"
            >
              {{ updating ? 'Saving...' : 'Save Capacity' }}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>

  </RoleLayout>
</template>
