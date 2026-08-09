<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import {
  Table2, Plus, Minus, RefreshCw, Clock, User, DollarSign,
  AlertCircle, CheckCircle2, ChevronRight, LayoutGrid, ClipboardList
} from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import RoleLayout from '@/components/RoleLayout.vue'
import PageHeader from '@/components/PageHeader.vue'
import StatCard from '@/components/StatCard.vue'
import Button from '@/components/ui/Button.vue'
import Badge from '@/components/ui/Badge.vue'
import Input from '@/components/ui/Input.vue'
import { restaurantNav } from '@/lib/nav'
import { getOrders, getRestaurantById, updateRestaurant } from '@/lib/api'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const loading = ref(true)
const updating = ref(false)
const restaurant = ref<any>(null)
const orders = ref<any[]>([])
let interval: any

const restaurantId = computed(() => {
  if (!auth.user || !auth.user.restaurantId) return ""
  return typeof auth.user.restaurantId === "string" 
    ? auth.user.restaurantId 
    : (auth.user.restaurantId as any)._id || (auth.user.restaurantId as any).id
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

// Build dynamic tables details list
const tablesList = computed(() => {
  return Array.from({ length: maxTablesCount.value }, (_, i) => {
    const number = i + 1
    const activeOrder = activeOrdersMap.value.get(number)
    return {
      number,
      status: activeOrder ? 'occupied' : 'available',
      order: activeOrder || null
    }
  })
})

// Increment total tables in DB
async function handleAddTable() {
  if (!restaurant.value || updating.value) return
  updating.value = true
  const newMax = maxTablesCount.value + 1
  try {
    const res = await updateRestaurant(restaurantId.value, {
      maxTables: newMax
    })
    if (res.success) {
      restaurant.value = res.data
      toast.success(`Table T-${String(newMax).padStart(2, '0')} added successfully!`)
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

  // If reducing tables, verify no active orders exist on the table indexes being cut
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
    const res = await updateRestaurant(restaurantId.value, {
      maxTables: newMax
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
      title="Tables & Floor Plan"
      subtitle="Configure dynamic dining floor capacity and monitor live table sessions."
    >
      <template #action>
        <div class="flex items-center gap-2">
          <Button variant="ghost" size="sm" class="h-9 px-3" @click="fetchTablesData(false)" :disabled="loading || updating">
            <RefreshCw :class="['h-4 w-4 mr-2', loading && 'animate-spin']" /> Sync Floor
          </Button>
          <Button variant="outline" size="sm" class="h-9 px-3 text-destructive hover:bg-destructive/10" @click="handleRemoveTable" :disabled="maxTablesCount <= 1 || updating">
            <Minus class="h-4 w-4 mr-1.5" /> Remove Last
          </Button>
          <Button class="gradient-primary text-primary-foreground h-9 px-3 shadow-glow" @click="handleAddTable" :disabled="updating">
            <Plus class="h-4 w-4 mr-1.5" /> Add Table
          </Button>
        </div>
      </template>
    </PageHeader>

    <div v-if="loading && !restaurant" class="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
      <RefreshCw class="h-8 w-8 animate-spin text-primary" />
      <span class="text-sm font-medium">Loading floor arrangements...</span>
    </div>

    <template v-else>
      <!-- Table Metrics Overview -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Floor Tables" :value="maxTablesCount.toString()" delta="Operational tables" :icon="Table2" tone="primary" />
        <StatCard label="Occupied Tables" :value="occupiedTablesCount.toString()" :delta="`${occupancyRate}% Floor Occupancy`" :icon="ClipboardList" tone="warning" />
        <StatCard label="Available Tables" :value="availableTablesCount.toString()" delta="Ready for guests" :icon="CheckCircle2" tone="success" />
        <StatCard label="Live Sessions" :value="occupiedTablesCount.toString()" delta="Active dining tickets" :icon="LayoutGrid" tone="info" />
      </div>

      <div class="grid lg:grid-cols-[1fr_360px] gap-6 items-start">
        <!-- Live Table Grid -->
        <div class="space-y-4">
          <div class="rounded-2xl border border-border bg-card shadow-soft p-5">
            <h3 class="font-display font-bold text-lg mb-1">Floor Plan Layout</h3>
            <p class="text-xs text-muted-foreground mb-4">Live status and session details for each dining table.</p>

            <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              <div
                v-for="t in tablesList"
                :key="t.number"
                :class="[
                  'rounded-2xl border-2 p-4 transition-all duration-300 flex flex-col justify-between min-h-[140px]',
                  t.status === 'occupied' 
                    ? 'border-primary/30 bg-primary/5 text-foreground hover:border-primary/50' 
                    : 'border-success/35 bg-success/5 text-foreground hover:border-success/60'
                ]"
              >
                <!-- Card Header Info -->
                <div class="flex justify-between items-start">
                  <div>
                    <span class="font-display font-bold text-lg">Table {{ String(t.number).padStart(2, '0') }}</span>
                    <span :class="['block text-[10px] uppercase font-semibold tracking-wider mt-0.5', t.status === 'occupied' ? 'text-primary' : 'text-success']">
                      ● {{ t.status }}
                    </span>
                  </div>
                  <div :class="['h-8 w-8 rounded-xl grid place-items-center', t.status === 'occupied' ? 'bg-primary/10 text-primary' : 'bg-success/10 text-success']">
                    <Table2 class="h-4.5 w-4.5" />
                  </div>
                </div>

                <!-- Card Body details (order summary if occupied) -->
                <div class="mt-4 pt-3 border-t border-border/50 text-xs">
                  <div v-if="t.order" class="space-y-1">
                    <div class="flex justify-between font-semibold">
                      <span>Total Bill:</span>
                      <span class="tabular-nums">${{ (t.order.totalAmount || 0).toFixed(2) }}</span>
                    </div>
                    <div class="flex justify-between text-muted-foreground text-[10px]">
                      <span>Server:</span>
                      <span class="truncate max-w-[80px]">{{ t.order.createdBy?.name || 'Waiter' }}</span>
                    </div>
                    <div class="flex justify-between text-muted-foreground text-[10px]">
                      <span>Active:</span>
                      <span>{{ timeSince(t.order.createdAt) }}</span>
                    </div>
                  </div>
                  <div v-else class="text-muted-foreground italic text-[11px] text-center py-2">
                    Table is vacant
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Sidebar controls (bulk configuration) -->
        <aside class="rounded-2xl border border-border bg-card p-6 shadow-soft space-y-6">
          <div class="border-b border-border pb-4">
            <h3 class="font-display font-bold text-base">Floor Controls</h3>
            <p class="text-xs text-muted-foreground mt-0.5">Quickly adjust floor plan configuration</p>
          </div>

          <!-- Add/Remove quick section -->
          <div class="space-y-3.5">
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
              <span>Updating tables count modifies the store configuration dynamically. You cannot reduce table capacity below occupied table indexes.</span>
            </p>
          </div>
        </aside>
      </div>
    </template>
  </RoleLayout>
</template>
