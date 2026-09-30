<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import {
  Table2, Plus, Minus, RefreshCw, Clock, User, DollarSign,
  AlertCircle, CheckCircle2, ChevronRight, LayoutGrid, ClipboardList,
  Users, Sliders, Check, Sparkles, Settings2, Receipt, X, Search,
  ChefHat, CookingPot, Utensils, ArrowRight, ExternalLink, ShoppingBag,
  Flame, CheckCircle, Trash2, Layers, Info
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
const router = useRouter()
const loading = ref(true)
const updating = ref(false)
const restaurant = ref<any>(null)
const orders = ref<any[]>([])
const tableSearch = ref('')
const statusFilter = ref<'ALL' | 'available' | 'occupied'>('ALL')

// Modals State
const showAddTableModal = ref(false)
const showFloorSettingsModal = ref(false)
const addTableMode = ref<'single' | 'bulk'>('single')

// Add Table Form State
const newTableCapacity = ref(4)
const bulkAddCount = ref(3)
const bulkAddCapacity = ref(4)

// Selected Table Modal State (for viewing live order or editing single table)
const selectedTableModal = ref(false)
const selectedTable = ref<{
  number: number
  capacity: number
  status: string
  order: any
  stats?: {
    totalAmount: number
    items: any[]
    completedCount: number
    workingCount: number
    totalItemsCount: number
    completionPercent: number
  } | null
} | null>(null)
const editCapacityVal = ref(4)

// Custom total tables for floor settings
const customTablesInput = ref<number | string>('')

let interval: any

const restaurantId = computed(() => {
  return auth.effectiveRestaurantId || ""
})

// Item status helpers
const ITEM_STATUS_CONFIG: Record<string, { label: string; class: string; icon: any }> = {
  DELIVERED: {
    label: 'Served',
    class: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/25',
    icon: CheckCircle2
  },
  READY: {
    label: 'Ready',
    class: 'bg-teal-500/15 text-teal-600 dark:text-teal-400 border-teal-500/25',
    icon: CheckCircle
  },
  PREPARING: {
    label: 'Cooking',
    class: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/25',
    icon: CookingPot
  },
  PENDING: {
    label: 'Queued',
    class: 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/25',
    icon: Clock
  },
  CANCELLED: {
    label: 'Cancelled',
    class: 'bg-destructive/15 text-destructive border-destructive/25',
    icon: X
  }
}

function getItemStatusInfo(item: any, orderStatus: string) {
  const st = (item.status || '').toUpperCase()
  if (ITEM_STATUS_CONFIG[st]) return ITEM_STATUS_CONFIG[st]
  if (orderStatus === 'SERVED' || orderStatus === 'COMPLETED') {
    return ITEM_STATUS_CONFIG.DELIVERED
  }
  if (orderStatus === 'READY') {
    return ITEM_STATUS_CONFIG.READY
  }
  if (orderStatus === 'PREPARING') {
    return ITEM_STATUS_CONFIG.PREPARING
  }
  return ITEM_STATUS_CONFIG.PENDING
}

function getTableOrderStats(order: any) {
  if (!order) return null
  const totalAmount = order.totalAmount || 0
  const items: any[] = order.items || []
  
  let completedCount = 0
  let workingCount = 0
  let totalItemsCount = 0

  if (items.length > 0) {
    items.forEach((it: any) => {
      const qty = it.quantity || it.qty || 1
      totalItemsCount += qty
      const st = (it.status || '').toUpperCase()
      if (st === 'DELIVERED' || st === 'READY' || order.status === 'SERVED' || order.status === 'COMPLETED') {
        completedCount += qty
      } else {
        workingCount += qty
      }
    })
  } else {
    if (['READY', 'SERVED', 'COMPLETED'].includes(order.status)) {
      completedCount = 1
    } else {
      workingCount = 1
    }
    totalItemsCount = completedCount + workingCount
  }

  const completionPercent = totalItemsCount > 0 ? Math.round((completedCount / totalItemsCount) * 100) : 0

  return {
    totalAmount,
    items,
    completedCount,
    workingCount,
    totalItemsCount,
    completionPercent
  }
}

async function fetchStaticTablesData() {
  if (!restaurantId.value) return
  try {
    const restRes = await getRestaurantById(restaurantId.value)
    restaurant.value = restRes.data
    customTablesInput.value = restRes.data?.maxTables || 0
  } catch (err: any) {
    console.error('Failed to load floor tables static configuration', err)
  }
}

async function fetchDynamicTablesData(silent = false) {
  if (!restaurantId.value) return
  if (!silent) loading.value = true
  try {
    const ordersRes = await getOrders(restaurantId.value, 1, 100, undefined, silent)
    orders.value = ordersRes.data || []
  } catch (err: any) {
    console.error('Failed to load floor tables dynamic configuration', err)
  } finally {
    if (!silent) loading.value = false
  }
}

async function fetchTablesData(silent = false) {
  await Promise.all([
    fetchStaticTablesData(),
    fetchDynamicTablesData(silent)
  ])
}

onMounted(() => {
  fetchTablesData()
  interval = setInterval(() => fetchDynamicTablesData(true), 5000)
})

onUnmounted(() => {
  clearInterval(interval)
})

// Compute active/occupied orders per table
const activeOrdersMap = computed(() => {
  const map = new Map<number, any>()
  orders.value.forEach(o => {
    if (['PENDING', 'PREPARING', 'READY', 'SERVED'].includes(o.status)) {
      map.set(Number(o.tableNumber || o.table), o)
    }
  })
  return map
})

const maxTablesCount = computed(() => {
  return restaurant.value?.maxTables || 0
})

const nextTableNumber = computed(() => {
  return maxTablesCount.value + 1
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

// Total live occupied billing on floor
const totalLiveFloorBill = computed(() => {
  let sum = 0
  activeOrdersMap.value.forEach((ord) => {
    sum += ord.totalAmount || 0
  })
  return sum
})

// Build dynamic tables details list
const tablesList = computed(() => {
  return Array.from({ length: maxTablesCount.value }, (_, i) => {
    const number = i + 1
    const activeOrder = activeOrdersMap.value.get(number)
    const capacity = getTableCapacity(number)
    const stats = activeOrder ? getTableOrderStats(activeOrder) : null
    return {
      number,
      capacity,
      status: activeOrder ? 'occupied' : 'available',
      order: activeOrder || null,
      stats
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
function openTableDetails(t: any) {
  selectedTable.value = t
  editCapacityVal.value = t.capacity
  selectedTableModal.value = true
}

// Open Add Table Modal
function openAddTableModal() {
  newTableCapacity.value = 4
  bulkAddCount.value = 3
  bulkAddCapacity.value = 4
  addTableMode.value = 'single'
  showAddTableModal.value = true
}

// Open Floor Settings Modal
function openFloorSettingsModal() {
  customTablesInput.value = maxTablesCount.value
  showFloorSettingsModal.value = true
}

// Aggregate items so duplicate lines for the same dish are combined into one item with sum of quantities
const groupedSelectedTableItems = computed(() => {
  const rawItems = selectedTable.value?.order?.items || []
  if (!rawItems.length) return []

  const map = new Map<string, any>()

  rawItems.forEach((item: any) => {
    const name = String(item.name || '').trim()
    const instructions = String(item.specialInstructions || '').trim()
    const key = `${item.menuItemId || name}__${instructions}`
    const qty = Number(item.quantity || item.qty || 1)
    const price = Number(item.price || 0)

    if (map.has(key)) {
      const existing = map.get(key)
      existing.quantity += qty
      const currSt = (item.status || '').toUpperCase()
      const existSt = (existing.status || '').toUpperCase()
      if (currSt === 'PREPARING' || existSt === 'PREPARING') {
        existing.status = 'PREPARING'
      } else if (currSt === 'PENDING' || existSt === 'PENDING') {
        existing.status = 'PENDING'
      } else if (currSt === 'READY' || existSt === 'READY') {
        existing.status = 'READY'
      }
    } else {
      map.set(key, {
        ...item,
        name,
        specialInstructions: instructions,
        quantity: qty,
        price
      })
    }
  })

  return Array.from(map.values())
})

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
      toast.success(`All ${maxTablesCount.value} tables updated to ${capacity} seats!`)
      showFloorSettingsModal.value = false
    } else {
      toast.error(res.message || 'Failed to update table capacities')
    }
  } catch (err: any) {
    toast.error(err.message || 'Error occurred while updating capacities')
  } finally {
    updating.value = false
  }
}

// Add a single new table with chosen capacity
async function handleConfirmAddSingleTable() {
  if (!restaurant.value || updating.value) return
  updating.value = true
  const newMax = maxTablesCount.value + 1
  const chosenCap = newTableCapacity.value || 4

  try {
    const currentCaps: Record<string, number> = {}
    for (let i = 1; i < newMax; i++) {
      currentCaps[String(i)] = getTableCapacity(i)
    }
    currentCaps[String(newMax)] = chosenCap

    const res = await updateRestaurant(restaurantId.value, {
      maxTables: newMax,
      tableCapacities: currentCaps
    })
    if (res.success) {
      restaurant.value = res.data
      toast.success(`Table ${newMax} (${chosenCap} Seats) added to floor plan!`)
      showAddTableModal.value = false
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

// Bulk add multiple tables
async function handleConfirmBulkAddTables() {
  if (!restaurant.value || updating.value) return
  const count = Number(bulkAddCount.value)
  if (isNaN(count) || count < 1 || count > 50) {
    toast.error('Please enter a valid count between 1 and 50.')
    return
  }
  
  const chosenCap = Number(bulkAddCapacity.value) || 4
  const startNum = maxTablesCount.value + 1
  const newMax = maxTablesCount.value + count

  if (newMax > 150) {
    toast.error('Maximum allowed tables on floor plan is 150.')
    return
  }

  updating.value = true
  try {
    const currentCaps: Record<string, number> = {}
    for (let i = 1; i <= maxTablesCount.value; i++) {
      currentCaps[String(i)] = getTableCapacity(i)
    }
    for (let i = startNum; i <= newMax; i++) {
      currentCaps[String(i)] = chosenCap
    }

    const res = await updateRestaurant(restaurantId.value, {
      maxTables: newMax,
      tableCapacities: currentCaps
    })
    if (res.success) {
      restaurant.value = res.data
      toast.success(`Successfully added ${count} new tables (Tables ${startNum} to ${newMax}) with ${chosenCap} seats each!`)
      showAddTableModal.value = false
      fetchTablesData(true)
    } else {
      toast.error(res.message || 'Failed to bulk add tables')
    }
  } catch (err: any) {
    toast.error(err.message || 'Error occurred during bulk table creation')
  } finally {
    updating.value = false
  }
}

// Delete / Remove table with safety checks
async function handleRemoveSpecificTable(tableNum: number) {
  if (!restaurant.value || updating.value || maxTablesCount.value <= 1) return
  
  if (activeOrdersMap.value.has(tableNum)) {
    toast.error(`Cannot remove Table ${tableNum} because it currently has an active dining session!`)
    return
  }

  if (tableNum !== maxTablesCount.value) {
    toast.error(`To maintain sequential numbering, please remove the highest table (Table ${maxTablesCount.value}) or adjust total tables in Floor Settings.`)
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
      toast.success(`Table ${tableNum} removed from floor plan.`)
      selectedTableModal.value = false
      selectedTable.value = null
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

// Bulk update total tables directly from settings dialog
async function handleBulkUpdateTables() {
  const newMax = parseInt(String(customTablesInput.value), 10)
  if (isNaN(newMax) || newMax < 1 || newMax > 150) {
    toast.error('Please enter a valid table count between 1 and 150.')
    return
  }

  if (newMax < maxTablesCount.value) {
    for (let t = newMax + 1; t <= maxTablesCount.value; t++) {
      if (activeOrdersMap.value.has(t)) {
        toast.error(`Cannot reduce tables. Table ${t} currently has an active order.`)
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
      toast.success(`Floor capacity successfully set to ${newMax} tables!`)
      showFloorSettingsModal.value = false
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
    <!-- Clean, Professional Page Header -->
    <PageHeader
      title="Tables & Floor Plan"
      subtitle="Manage dining tables, seating arrangements, and live floor occupancy."
    >
      <template #action>
        <div class="flex items-center gap-2">
          <!-- Refresh Sync Button -->
          <Button
            variant="outline"
            size="sm"
            class="h-9 px-3 text-xs bg-background hover:bg-muted font-medium"
            @click="fetchTablesData(false)"
            :disabled="loading || updating"
            title="Refresh floor status"
          >
            <RefreshCw :class="['h-3.5 w-3.5 sm:mr-1.5', loading && 'animate-spin text-primary']" />
            <span class="hidden sm:inline">Refresh</span>
          </Button>

          <!-- Floor Settings Button -->
          <Button
            variant="outline"
            size="sm"
            class="h-9 px-3 text-xs bg-background hover:bg-muted font-medium"
            @click="openFloorSettingsModal"
            :disabled="loading || updating"
            title="Configure floor capacity and presets"
          >
            <Settings2 class="h-3.5 w-3.5 sm:mr-1.5 text-muted-foreground" />
            <span class="hidden sm:inline">Floor Settings</span>
          </Button>

          <!-- Primary + Add Table Button (Clear & Consistent) -->
          <Button
            class="gradient-primary text-primary-foreground h-9 px-3.5 text-xs font-semibold shadow-glow flex items-center gap-1.5"
            @click="openAddTableModal"
            :disabled="updating"
          >
            <Plus class="h-4 w-4" />
            <span>Add Table</span>
          </Button>
        </div>
      </template>
    </PageHeader>

    <!-- Loading State -->
    <div v-if="loading && !restaurant" class="flex flex-col items-center justify-center py-24 text-muted-foreground gap-3">
      <RefreshCw class="h-8 w-8 animate-spin text-primary" />
      <span class="text-sm font-medium">Loading floor arrangements...</span>
    </div>

    <template v-else>
      <!-- Desktop Stat Cards Overview -->
      <div class="hidden md:grid md:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Tables" :value="maxTablesCount.toString()" delta="Configured dining tables" :icon="Table2" tone="primary" />
        <StatCard label="Total Seating" :value="`${totalSeatsCount} Seats`" :delta="`${occupiedSeatsCount} seats currently occupied`" :icon="Users" tone="info" />
        <StatCard label="Available Tables" :value="availableTablesCount.toString()" delta="Ready for guest seating" :icon="CheckCircle2" tone="success" />
        <StatCard label="Floor Occupancy" :value="`${occupancyRate}%`" :delta="`${occupiedTablesCount} active dining sessions`" :icon="ClipboardList" tone="warning" />
      </div>

      <!-- Mobile Compact 2x2 KPI Capsule -->
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

      <!-- Main Full-Width Floor Plan Grid Area -->
      <div class="space-y-4">
        <div class="rounded-2xl border border-border bg-card shadow-soft p-4 sm:p-5">
          <!-- Section Header -->
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div>
              <h3 class="font-display font-bold text-base sm:text-lg text-foreground flex items-center gap-2">
                <span>Floor Plan Layout</span>
                <Badge variant="outline" class="text-[11px] font-semibold border-border">
                  {{ tablesList.length }} Tables
                </Badge>
              </h3>
              <p class="text-xs text-muted-foreground mt-0.5">Click any table card to view live orders or manage seating capacity.</p>
            </div>

            <!-- Quick Add Table button right on floor header -->
            <Button
              size="sm"
              variant="outline"
              @click="openAddTableModal"
              class="h-8 text-xs font-semibold self-start sm:self-auto border-primary/30 text-primary hover:bg-primary/10 flex items-center gap-1.5"
            >
              <Plus class="h-3.5 w-3.5" />
              <span>+ Add Table</span>
            </Button>
          </div>

          <!-- Search & Status Filter Ribbon -->
          <div class="mb-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 p-2.5 rounded-xl bg-muted/20 border border-border">
            <div class="relative flex-1 max-w-sm">
              <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                v-model="tableSearch"
                placeholder="Search table (e.g. 5, T-12, or guest name)…"
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
                :class="['px-2.5 py-1 rounded-lg text-xs font-semibold transition border cursor-pointer', statusFilter === 'ALL' ? 'bg-primary text-primary-foreground border-transparent shadow-xs' : 'bg-background border-border text-muted-foreground hover:text-foreground']"
              >
                All ({{ tablesList.length }})
              </button>
              <button
                @click="statusFilter = 'available'"
                :class="['px-2.5 py-1 rounded-lg text-xs font-semibold transition border cursor-pointer', statusFilter === 'available' ? 'bg-emerald-600 text-white border-transparent shadow-xs' : 'bg-background border-border text-muted-foreground hover:text-foreground']"
              >
                Available ({{ availableTablesCount }})
              </button>
              <button
                @click="statusFilter = 'occupied'"
                :class="['px-2.5 py-1 rounded-lg text-xs font-semibold transition border cursor-pointer', statusFilter === 'occupied' ? 'bg-primary text-primary-foreground border-transparent shadow-xs' : 'bg-background border-border text-muted-foreground hover:text-foreground']"
              >
                Occupied ({{ occupiedTablesCount }})
              </button>
            </div>
          </div>

          <!-- Empty state when no tables match search -->
          <div v-if="filteredTablesList.length === 0" class="p-12 text-center text-muted-foreground rounded-xl border border-dashed border-border">
            <Search class="h-8 w-8 mx-auto mb-2 opacity-30 text-muted-foreground" />
            <p class="font-semibold text-sm">No tables match "{{ tableSearch }}"</p>
            <Button size="sm" variant="ghost" class="mt-2 text-xs" @click="tableSearch = ''; statusFilter = 'ALL'">
              Clear Filters
            </Button>
          </div>

          <!-- Table Cards: Clean, responsive full-width grid -->
          <div v-else class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3.5 sm:gap-4">
            <button
              v-for="t in filteredTablesList"
              :key="t.number"
              type="button"
              @click="openTableDetails(t)"
              :class="[
                'rounded-2xl border-2 p-3.5 sm:p-4 text-left transition-all duration-200 flex flex-col justify-between min-h-[135px] hover:shadow-md hover:-translate-y-0.5 relative group cursor-pointer',
                t.status === 'occupied' 
                  ? 'border-primary/40 bg-primary/5 hover:border-primary shadow-2xs' 
                  : 'border-emerald-500/30 bg-emerald-500/5 hover:border-emerald-500/70'
              ]"
            >
              <!-- Card Top: Table Number & Status -->
              <div class="flex justify-between items-start w-full">
                <div>
                  <div class="flex items-center gap-1.5">
                    <span class="font-display font-bold text-base text-foreground group-hover:text-primary transition">
                      Table {{ String(t.number).padStart(2, '0') }}
                    </span>
                    <span v-if="t.status === 'occupied'" class="relative flex h-2 w-2">
                      <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                      <span class="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                    </span>
                  </div>
                  <span :class="['block text-[10px] uppercase font-bold tracking-wider mt-0.5', t.status === 'occupied' ? 'text-primary' : 'text-emerald-600 dark:text-emerald-400']">
                    ● {{ t.status }}
                  </span>
                </div>

                <div :class="['h-8 w-8 rounded-xl grid place-items-center shrink-0 transition', t.status === 'occupied' ? 'bg-primary/10 text-primary' : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400']">
                  <Table2 class="h-4 w-4" />
                </div>
              </div>

              <!-- Card Bottom: Capacity & Action Callout -->
              <div class="mt-3 pt-2.5 border-t border-border/40 flex items-center justify-between w-full">
                <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-background border border-border text-[11px] font-semibold text-foreground">
                  <Users class="h-3 w-3 text-primary" /> {{ t.capacity }} Seats
                </span>
                <span v-if="t.status === 'occupied'" class="text-[11px] font-bold text-primary group-hover:underline">
                  ₹{{ t.stats?.totalAmount || t.order?.totalAmount || 0 }} →
                </span>
                <span v-else class="text-[10px] font-medium text-muted-foreground group-hover:text-foreground">
                  Edit →
                </span>
              </div>
            </button>
          </div>
        </div>
      </div>
    </template>

    <!-- ═══════════════════════════════════════════════════════════════════════ -->
    <!-- MODAL 1: DEDICATED, INTUITIVE "ADD TABLE" DIALOG                        -->
    <!-- ═══════════════════════════════════════════════════════════════════════ -->
    <Dialog :open="showAddTableModal" @update:open="showAddTableModal = $event">
      <DialogContent class="sm:max-w-md p-6">
        <DialogHeader class="mb-4">
          <DialogTitle class="font-display text-lg font-bold flex items-center gap-2">
            <div class="h-8 w-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <Plus class="h-4 w-4" />
            </div>
            <span>Add Dining Table</span>
          </DialogTitle>
          <DialogDescription class="text-xs text-muted-foreground">
            Easily expand your restaurant floor with single or multiple tables.
          </DialogDescription>
        </DialogHeader>

        <!-- Segmented Tab: Single Table vs Bulk Add -->
        <div class="grid grid-cols-2 gap-1 p-1 rounded-xl bg-muted/60 border border-border mb-4 text-xs font-semibold">
          <button
            type="button"
            @click="addTableMode = 'single'"
            :class="['py-1.5 rounded-lg transition text-center cursor-pointer', addTableMode === 'single' ? 'bg-background text-foreground shadow-xs font-bold' : 'text-muted-foreground hover:text-foreground']"
          >
            Single Table
          </button>
          <button
            type="button"
            @click="addTableMode = 'bulk'"
            :class="['py-1.5 rounded-lg transition text-center cursor-pointer', addTableMode === 'bulk' ? 'bg-background text-foreground shadow-xs font-bold' : 'text-muted-foreground hover:text-foreground']"
          >
            Bulk Add
          </button>
        </div>

        <!-- MODE 1: SINGLE TABLE -->
        <div v-if="addTableMode === 'single'" class="space-y-4">
          <!-- Next Table Card Preview -->
          <div class="p-3.5 rounded-xl bg-primary/5 border border-primary/20 flex items-center justify-between">
            <div>
              <div class="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Table Identifier</div>
              <div class="font-display text-lg font-extrabold text-foreground mt-0.5">
                Table {{ String(nextTableNumber).padStart(2, '0') }}
              </div>
            </div>
            <Badge class="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-xs font-semibold">
              Ready to create
            </Badge>
          </div>

          <!-- Capacity Selector -->
          <div class="space-y-2.5">
            <div class="flex items-center justify-between">
              <label class="text-xs font-bold text-foreground flex items-center gap-1.5">
                <Users class="h-3.5 w-3.5 text-primary" /> Seating Capacity
              </label>
              <span class="text-xs font-bold text-primary">{{ newTableCapacity }} Persons</span>
            </div>

            <!-- Quick capacity preset pills -->
            <div class="grid grid-cols-4 gap-2">
              <button
                v-for="cap in [2, 4, 6, 8]"
                :key="cap"
                type="button"
                @click="newTableCapacity = cap"
                :class="[
                  'py-2 px-1 text-xs font-bold rounded-xl border transition text-center cursor-pointer',
                  newTableCapacity === cap
                    ? 'border-primary bg-primary text-primary-foreground shadow-xs'
                    : 'border-border bg-background hover:border-primary/40 text-foreground'
                ]"
              >
                {{ cap }} Seats
              </button>
            </div>

            <!-- Custom capacity stepper -->
            <div class="flex items-center justify-between pt-1 text-xs">
              <span class="text-muted-foreground">Custom seats count:</span>
              <div class="flex items-center gap-1.5">
                <button
                  type="button"
                  :disabled="newTableCapacity <= 1"
                  @click="newTableCapacity = Math.max(1, newTableCapacity - 1)"
                  class="h-8 w-8 rounded-lg border border-border bg-background flex items-center justify-center text-foreground hover:bg-muted cursor-pointer disabled:opacity-40"
                >
                  <Minus class="h-3 w-3" />
                </button>
                <input
                  v-model.number="newTableCapacity"
                  type="number"
                  min="1"
                  max="30"
                  class="w-14 h-8 text-center font-bold text-xs rounded-lg border border-border bg-background"
                />
                <button
                  type="button"
                  :disabled="newTableCapacity >= 30"
                  @click="newTableCapacity++"
                  class="h-8 w-8 rounded-lg border border-border bg-background flex items-center justify-center text-foreground hover:bg-muted cursor-pointer disabled:opacity-40"
                >
                  <Plus class="h-3 w-3" />
                </button>
              </div>
            </div>
          </div>

          <!-- Dialog Actions -->
          <div class="pt-3 border-t border-border flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              class="h-9 text-xs"
              @click="showAddTableModal = false"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              :disabled="updating"
              @click="handleConfirmAddSingleTable"
              class="h-9 text-xs font-bold gradient-primary text-primary-foreground shadow-glow flex items-center gap-1.5"
            >
              <Plus class="h-3.5 w-3.5" />
              <span>{{ updating ? 'Adding Table...' : `Add Table ${nextTableNumber} (${newTableCapacity} Seats)` }}</span>
            </Button>
          </div>
        </div>

        <!-- MODE 2: BULK ADD -->
        <div v-else class="space-y-4">
          <!-- How many tables to add -->
          <div class="space-y-2">
            <label class="text-xs font-bold text-foreground">How many tables would you like to add?</label>
            <div class="grid grid-cols-4 gap-2">
              <button
                v-for="count in [2, 3, 5, 10]"
                :key="count"
                type="button"
                @click="bulkAddCount = count"
                :class="[
                  'py-2 px-1 text-xs font-bold rounded-xl border transition text-center cursor-pointer',
                  bulkAddCount === count
                    ? 'border-primary bg-primary text-primary-foreground shadow-xs'
                    : 'border-border bg-background hover:border-primary/40 text-foreground'
                ]"
              >
                +{{ count }} Tables
              </button>
            </div>

            <div class="flex items-center justify-between pt-1 text-xs">
              <span class="text-muted-foreground">Or enter custom count:</span>
              <Input
                v-model.number="bulkAddCount"
                type="number"
                min="1"
                max="50"
                class="w-24 h-8 text-center font-bold text-xs"
              />
            </div>
          </div>

          <!-- Seating capacity for bulk added tables -->
          <div class="space-y-2">
            <label class="text-xs font-bold text-foreground">Default seats per table</label>
            <div class="grid grid-cols-4 gap-2">
              <button
                v-for="cap in [2, 4, 6, 8]"
                :key="cap"
                type="button"
                @click="bulkAddCapacity = cap"
                :class="[
                  'py-2 px-1 text-xs font-bold rounded-xl border transition text-center cursor-pointer',
                  bulkAddCapacity === cap
                    ? 'border-primary bg-primary text-primary-foreground shadow-xs'
                    : 'border-border bg-background hover:border-primary/40 text-foreground'
                ]"
              >
                {{ cap }} Seats
              </button>
            </div>
          </div>

          <!-- Preview summary banner -->
          <div class="p-3 rounded-xl bg-muted/30 border border-border text-xs text-muted-foreground flex items-start gap-2">
            <Info class="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <p>
              Will create <strong class="text-foreground font-semibold">{{ bulkAddCount }} tables</strong> (Table {{ nextTableNumber }} to {{ nextTableNumber + Number(bulkAddCount) - 1 }}) with <strong class="text-foreground font-semibold">{{ bulkAddCapacity }} seats</strong> each.
            </p>
          </div>

          <!-- Dialog Actions -->
          <div class="pt-3 border-t border-border flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              class="h-9 text-xs"
              @click="showAddTableModal = false"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              :disabled="updating || !bulkAddCount || bulkAddCount < 1"
              @click="handleConfirmBulkAddTables"
              class="h-9 text-xs font-bold gradient-primary text-primary-foreground shadow-glow flex items-center gap-1.5"
            >
              <Plus class="h-3.5 w-3.5" />
              <span>{{ updating ? 'Creating Tables...' : `Add ${bulkAddCount} Tables` }}</span>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>

    <!-- ═══════════════════════════════════════════════════════════════════════ -->
    <!-- MODAL 2: FLOOR SETTINGS & CAPACITY CONFIGURATION                        -->
    <!-- ═══════════════════════════════════════════════════════════════════════ -->
    <Dialog :open="showFloorSettingsModal" @update:open="showFloorSettingsModal = $event">
      <DialogContent class="sm:max-w-md p-6">
        <DialogHeader class="mb-4">
          <DialogTitle class="font-display text-lg font-bold flex items-center gap-2">
            <div class="h-8 w-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <Settings2 class="h-4 w-4" />
            </div>
            <span>Floor Settings</span>
          </DialogTitle>
          <DialogDescription class="text-xs text-muted-foreground">
            Configure global table capacities and total tables for your restaurant.
          </DialogDescription>
        </DialogHeader>

        <div class="space-y-5">
          <!-- 1. Bulk Capacity Presets -->
          <div class="space-y-2.5">
            <h4 class="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Sliders class="h-3.5 w-3.5 text-primary" /> Set Standard Capacity (All Tables)
            </h4>
            <div class="grid grid-cols-4 gap-2">
              <button
                v-for="cap in [2, 4, 6, 8]"
                :key="cap"
                type="button"
                @click="handleSetAllTablesCapacity(cap)"
                :disabled="updating"
                class="py-2.5 px-2 rounded-xl border border-border hover:border-primary/50 hover:bg-primary/5 text-xs font-bold text-center transition active:scale-95 disabled:opacity-40 cursor-pointer"
              >
                {{ cap }} Seats
              </button>
            </div>
            <p class="text-[11px] text-muted-foreground">
              Applies this seating capacity across all {{ maxTablesCount }} operational tables at once.
            </p>
          </div>

          <!-- 2. Set Total Tables Count Directly -->
          <div class="space-y-3 pt-4 border-t border-border">
            <h4 class="text-xs font-bold uppercase tracking-wider text-muted-foreground">Total Tables on Floor</h4>
            <div class="flex gap-2">
              <Input
                type="number"
                v-model="customTablesInput"
                :placeholder="`Current: ${maxTablesCount}`"
                min="1"
                max="150"
                class="flex-1 h-10 bg-muted/30 text-sm"
              />
              <Button
                class="h-10 px-4 text-xs font-bold gradient-primary text-primary-foreground"
                @click="handleBulkUpdateTables"
                :disabled="updating || !customTablesInput"
              >
                Apply Total
              </Button>
            </div>
            <p class="text-[11px] text-muted-foreground flex items-start gap-1.5 leading-relaxed">
              <AlertCircle class="h-3.5 w-3.5 mt-0.5 text-amber-500 shrink-0" />
              <span>Cannot decrease below tables that currently have active dining orders.</span>
            </p>
          </div>

          <!-- Modal Footer -->
          <div class="pt-3 border-t border-border flex justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              class="h-9 text-xs px-4"
              @click="showFloorSettingsModal = false"
            >
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>

    <!-- ═══════════════════════════════════════════════════════════════════════ -->
    <!-- MODAL 3: TABLE DETAILS, EDIT CAPACITY & ACTIVE ORDERS                    -->
    <!-- ═══════════════════════════════════════════════════════════════════════ -->
    <Dialog :open="selectedTableModal" @update:open="selectedTableModal = $event">
      <DialogContent class="sm:max-w-md p-5 max-h-[90vh] overflow-y-auto">
        <DialogHeader class="mb-3">
          <DialogTitle class="font-display text-lg font-bold flex items-center justify-between">
            <div class="flex items-center gap-2">
              <Table2 class="h-5 w-5 text-primary" />
              <span>Table {{ String(selectedTable?.number).padStart(2, '0') }}</span>
            </div>
            <Badge :class="selectedTable?.status === 'occupied' ? 'bg-primary/15 text-primary border-primary/25 font-bold text-[10px]' : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/25 font-bold text-[10px]'">
              ● {{ selectedTable?.status === 'occupied' ? 'Occupied' : 'Available' }}
            </Badge>
          </DialogTitle>
          <DialogDescription class="text-xs text-muted-foreground">
            <template v-if="selectedTable?.status === 'occupied' && selectedTable?.order">
              Server: <strong class="text-foreground font-semibold">{{ selectedTable.order.createdBy?.name || 'Staff' }}</strong> · {{ timeSince(selectedTable.order.createdAt) }}
            </template>
            <template v-else>
              Manage seating capacity and settings for this dining table.
            </template>
          </DialogDescription>
        </DialogHeader>

        <div class="space-y-3.5">
          <!-- ── OCCUPIED TABLE: RUNNING BILL & ORDERED DISHES ── -->
          <template v-if="selectedTable?.status === 'occupied' && selectedTable?.order">
            <!-- 1. Running Bill Box -->
            <div class="p-4 rounded-2xl bg-muted/30 border border-border shadow-2xs flex items-center justify-between gap-4">
              <div>
                <div class="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Current Running Bill</div>
                <div class="flex items-center gap-1.5 mt-2">
                  <span :class="['font-semibold px-2 py-0.5 rounded-md text-[10px] border', selectedTable.order.paymentStatus === 'COMPLETED' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20']">
                    {{ selectedTable.order.paymentStatus === 'COMPLETED' ? '✓ Paid' : '⏳ Unpaid' }}
                  </span>
                  <span v-if="selectedTable.stats?.workingCount === 0" class="font-semibold px-2 py-0.5 rounded-md text-[10px] border bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20">
                    ✓ All Served
                  </span>
                  <span v-else class="font-semibold px-2 py-0.5 rounded-md text-[10px] border bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20">
                    🍳 {{ selectedTable.stats?.workingCount }} Cooking
                  </span>
                </div>
              </div>

              <div class="text-right shrink-0">
                <div class="font-display text-2xl sm:text-3xl font-black text-foreground tabular-nums">
                  ₹{{ ((selectedTable.stats?.totalAmount ?? selectedTable.order.totalAmount) || 0).toLocaleString('en-IN') }}
                </div>
                <div class="text-[10px] font-medium text-muted-foreground">Total Bill</div>
              </div>
            </div>

            <!-- 2. Ordered Dishes List -->
            <div class="space-y-1.5">
              <div class="flex items-center justify-between text-xs font-bold text-foreground px-0.5">
                <span class="flex items-center gap-1.5 uppercase tracking-wider text-muted-foreground text-[10px]">
                  <Utensils class="h-3.5 w-3.5 text-primary" />
                  Ordered Items ({{ groupedSelectedTableItems.length }})
                </span>
                <span class="text-[10px] text-muted-foreground">
                  {{ selectedTable.capacity }} Seats Table
                </span>
              </div>

              <!-- Dishes Container -->
              <div v-if="groupedSelectedTableItems.length > 0" class="rounded-xl border border-border bg-muted/15 divide-y divide-border/60 max-h-56 overflow-y-auto">
                <div
                  v-for="(item, idx) in groupedSelectedTableItems"
                  :key="idx"
                  class="p-2.5 flex items-center justify-between gap-3 text-xs"
                >
                  <div class="min-w-0 flex-1">
                    <div class="flex items-center gap-1.5">
                      <span class="font-bold text-foreground">{{ item.quantity }}×</span>
                      <span class="font-semibold text-foreground truncate">{{ item.name }}</span>
                    </div>
                    <div v-if="item.specialInstructions" class="text-[10px] text-amber-600 dark:text-amber-400 italic">
                      Note: {{ item.specialInstructions }}
                    </div>
                  </div>

                  <div class="flex items-center gap-2.5 shrink-0">
                    <span class="font-bold text-foreground tabular-nums text-xs">
                      ₹{{ (item.price * item.quantity).toFixed(0) }}
                    </span>

                    <span :class="['inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold border', getItemStatusInfo(item, selectedTable.order.status).class]">
                      {{ getItemStatusInfo(item, selectedTable.order.status).label }}
                    </span>
                  </div>
                </div>
              </div>

              <div v-else class="p-4 rounded-xl border border-border text-center text-xs text-muted-foreground">
                No dishes in this active ticket.
              </div>
            </div>

            <!-- Modal Footer for Occupied -->
            <div class="pt-2 border-t border-border flex justify-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                class="h-8 text-xs px-4"
                @click="selectedTableModal = false"
              >
                Close
              </Button>
            </div>
          </template>

          <!-- ── AVAILABLE TABLE: SEATING CAPACITY CONFIGURATION ── -->
          <template v-else>
            <div class="p-4 rounded-xl bg-muted/20 border border-border space-y-3">
              <div class="flex items-center justify-between">
                <label class="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Users class="h-4 w-4 text-primary" /> Table Seating Capacity
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
                    'py-1.5 text-xs font-bold rounded-lg border transition text-center cursor-pointer',
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
                    class="h-8 w-8 rounded-lg border border-border bg-background flex items-center justify-center text-foreground hover:bg-muted cursor-pointer"
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
                    class="h-8 w-8 rounded-lg border border-border bg-background flex items-center justify-center text-foreground hover:bg-muted cursor-pointer"
                  >
                    <Plus class="h-3 w-3" />
                  </button>
                </div>
              </div>
            </div>

            <!-- Remove table option if this is the last table on floor -->
            <div
              v-if="selectedTable && selectedTable.number === maxTablesCount && maxTablesCount > 1"
              class="p-3 rounded-xl bg-destructive/5 border border-destructive/15 flex items-center justify-between"
            >
              <div>
                <div class="text-xs font-bold text-destructive">Remove Table {{ selectedTable.number }}</div>
                <div class="text-[10px] text-muted-foreground">Delete this table from floor plan</div>
              </div>
              <Button
                variant="outline"
                size="sm"
                class="h-8 text-xs text-destructive hover:bg-destructive/10 border-destructive/30"
                @click="handleRemoveSpecificTable(selectedTable.number)"
                :disabled="updating"
              >
                <Trash2 class="h-3.5 w-3.5 mr-1" />
                Delete
              </Button>
            </div>

            <!-- Modal Footer for Available -->
            <div class="pt-2 border-t border-border flex justify-end gap-2">
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
          </template>
        </div>
      </DialogContent>
    </Dialog>
  </RoleLayout>
</template>

