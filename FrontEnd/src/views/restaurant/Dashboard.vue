<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import {
  Activity, BellRing, ChefHat, Clock3, CookingPot, CreditCard, DollarSign,
  Plus, Receipt, ShoppingBag, Table2, Users, UtensilsCrossed, Wallet
} from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import RoleLayout from '@/components/RoleLayout.vue'
import PageHeader from '@/components/PageHeader.vue'
import StatCard from '@/components/StatCard.vue'
import Button from '@/components/ui/Button.vue'
import Badge from '@/components/ui/Badge.vue'
import { restaurantNav } from '@/lib/nav'
import { getOrders, getPayments, getRestaurantById, getUsersByRestaurant } from '@/lib/api'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const loading = ref(true)
const orders = ref<any[]>([])
const payments = ref<any[]>([])
const staffList = ref<any[]>([])
const restaurant = ref<any>(null)
let interval: any

const STATUS_TONE: Record<string, string> = {
  PENDING: "bg-info/10 text-info border-info/20",
  PREPARING: "bg-warning/15 text-warning border-warning/25",
  READY: "bg-success/15 text-success border-success/25",
  SERVED: "bg-success/15 text-success border-success/25",
  COMPLETED: "bg-emerald-500/10 text-emerald-500 border-emerald-500/25",
  CANCELLED: "bg-destructive/15 text-destructive border-destructive/25",
}

const TABLE_TONE: Record<string, string> = {
  available: "border-success/30 bg-success/5 text-success",
  occupied: "border-primary/30 bg-primary/5 text-primary",
  reserved: "border-warning/30 bg-warning/5 text-warning",
}

async function fetchDashboardData() {
  if (!auth.user?.restaurantId) return
  const restaurantId = typeof auth.user.restaurantId === 'string'
    ? auth.user.restaurantId
    : (auth.user.restaurantId as any).id || (auth.user.restaurantId as any)._id

  try {
    const [ordRes, payRes, restRes, staffRes] = await Promise.all([
      getOrders(restaurantId, 1, 100),
      getPayments(restaurantId, 1, 100),
      getRestaurantById(restaurantId),
      getUsersByRestaurant(restaurantId, 1, 100)
    ])
    
    orders.value = ordRes.data || []
    payments.value = payRes.data || []
    restaurant.value = restRes.data
    staffList.value = staffRes.data || []
  } catch (err: any) {
    console.error('Failed to load restaurant dashboard data', err)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  fetchDashboardData()
  interval = setInterval(fetchDashboardData, 5000)
})

onUnmounted(() => {
  clearInterval(interval)
})

// Metrics computation
const todayRevenue = computed(() => {
  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)
  
  const completed = payments.value.filter(p => {
    const pDate = new Date(p.paidAt || p.createdAt)
    return p.status === 'COMPLETED' && pDate >= startOfToday
  })
  return completed.reduce((sum, p) => sum + p.totalAmount, 0)
})

const activeOrders = computed(() => {
  return orders.value.filter(o => ['PENDING', 'PREPARING', 'READY', 'SERVED'].includes(o.status))
})

const tablesCount = computed(() => {
  const max = restaurant.value?.maxTables || 16
  const activeTables = new Set(activeOrders.value.map(o => o.tableNumber || o.table))
  
  return {
    occupied: activeTables.size,
    total: max,
    list: Array.from({ length: max }, (_, i) => {
      const tNum = i + 1
      return {
        number: tNum,
        status: activeTables.has(tNum) ? 'occupied' : 'available'
      }
    })
  }
})

const pendingBillsCount = computed(() => {
  return activeOrders.value.filter(o => o.status === 'SERVED' && o.paymentStatus !== 'COMPLETED').length
})

const kitchenQueue = computed(() => {
  // Orders waiting for preparation or currently being prepared
  return orders.value.filter(o => ['PENDING', 'PREPARING'].includes(o.status))
})

const avgOrderTime = computed(() => {
  const completed = orders.value.filter(o => o.status === 'COMPLETED' && o.servedAt && o.createdAt)
  if (completed.length > 0) {
    const sumDiffs = completed.reduce((sum, o) => {
      const diff = new Date(o.servedAt).getTime() - new Date(o.createdAt).getTime()
      return sum + diff
    }, 0)
    const avgMin = Math.round(sumDiffs / completed.length / 60000)
    return `${avgMin}m`
  }
  return '12m'
})

// Charts aggregation
const hourlySales = computed(() => {
  const sales = []
  for (let i = 7; i >= 0; i--) {
    const d = new Date()
    d.setHours(d.getHours() - i)
    const hourLabel = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    
    const hrStart = new Date(d)
    hrStart.setMinutes(0, 0, 0)
    const hrEnd = new Date(d)
    hrEnd.setMinutes(59, 59, 999)

    const hrPayments = payments.value.filter(p => {
      const pDate = new Date(p.paidAt || p.createdAt)
      return p.status === 'COMPLETED' && pDate >= hrStart && pDate <= hrEnd
    })
    const total = hrPayments.reduce((sum, p) => sum + p.totalAmount, 0)
    sales.push({ h: hourLabel, sales: total })
  }
  return sales
})

const areaOptions = computed(() => ({
  chart: { type: 'area', toolbar: { show: false } },
  stroke: { curve: 'smooth', width: 2.5, colors: ['var(--primary)'] },
  fill: { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.35, opacityTo: 0, stops: [0, 100] }, colors: ['var(--primary)'] },
  xaxis: { categories: hourlySales.value.map(d => d.h), axisBorder: { show: false }, axisTicks: { show: false }, labels: { style: { colors: 'var(--muted-foreground)' } } },
  yaxis: { labels: { style: { colors: 'var(--muted-foreground)' } } },
  dataLabels: { enabled: false },
  grid: { strokeDashArray: 3, borderColor: 'var(--border)' },
  tooltip: { theme: 'dark' }
}))

const areaSeries = computed(() => [{
  name: 'Sales',
  data: hourlySales.value.map(d => d.sales)
}])

const paymentMix = computed(() => {
  let cash = 0, card = 0, wallet = 0
  const completed = payments.value.filter(p => p.status === 'COMPLETED')
  completed.forEach(p => {
    if (p.paymentMethod === 'CASH') cash++
    else if (p.paymentMethod === 'CARD') card++
    else if (p.paymentMethod === 'DIGITAL_WALLET') wallet++
  })
  const total = completed.length || 1
  return [
    { name: 'Card', value: Math.round((card / total) * 100) },
    { name: 'UPI/Wallet', value: Math.round((wallet / total) * 100) },
    { name: 'Cash', value: Math.round((cash / total) * 100) }
  ]
})

const pieOptions = computed(() => ({
  chart: { type: 'donut' },
  labels: paymentMix.value.map(d => d.name),
  dataLabels: { enabled: false },
  plotOptions: { pie: { donut: { size: '60%' } } },
  stroke: { show: false },
  legend: { show: false },
  colors: ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)'],
  tooltip: { theme: 'dark' }
}))

const pieSeries = computed(() => paymentMix.value.map(d => d.value))

const orderSourceMix = computed(() => {
  let waiter = 0, admin = 0, others = 0
  orders.value.forEach(o => {
    const creator = typeof o.createdBy === 'object' ? o.createdBy : null
    const role = creator?.role || 'WAITER'
    if (role === 'WAITER') waiter++
    else if (role === 'RESTAURANT_ADMIN' || role === 'MAIN_ADMIN') admin++
    else others++
  })
  const total = orders.value.length || 1
  return [
    { name: 'Waiters', value: waiter },
    { name: 'Admin/POS', value: admin },
    { name: 'Others', value: others }
  ]
})

const barOptions = computed(() => ({
  chart: { type: 'bar', toolbar: { show: false } },
  colors: ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)'],
  plotOptions: { bar: { borderRadius: 4, distributed: true } },
  xaxis: { categories: orderSourceMix.value.map(d => d.name), axisBorder: { show: false }, axisTicks: { show: false }, labels: { style: { colors: 'var(--muted-foreground)' } } },
  yaxis: { labels: { style: { colors: 'var(--muted-foreground)' } } },
  dataLabels: { enabled: false },
  grid: { strokeDashArray: 3, borderColor: 'var(--border)' },
  tooltip: { theme: 'dark' },
  legend: { show: false }
}))

const barSeries = computed(() => [{
  name: 'Orders',
  data: orderSourceMix.value.map(d => d.value)
}])

const topSellers = computed(() => {
  const counts: Record<string, { qty: number, price: number, category: string }> = {}
  orders.value.forEach(o => {
    if (o.status === 'COMPLETED' && o.items) {
      o.items.forEach((item: any) => {
        if (!counts[item.name]) {
          counts[item.name] = { qty: 0, price: item.price, category: item.category || 'Food' }
        }
        counts[item.name].qty += item.qty || item.quantity || 1
      })
    }
  })
  return Object.entries(counts)
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 5)
})

function formatTime(ts: string) {
  if (!ts) return ''
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
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
      title="Operations Center"
      subtitle="Live restaurant performance across the floor, kitchen, and POS."
    >
      <template #action>
        <div class="flex items-center gap-2">
          <Badge variant="outline" class="gap-1.5 px-2.5 py-1 border-success/30 text-success bg-success/5 font-semibold">
            <span class="pulse-dot" /> Live
          </Badge>
          <Button variant="ghost" size="sm" class="h-9 px-3" @click="fetchDashboardData">
            <RefreshCw :class="['h-4 w-4 mr-2', loading && 'animate-spin']" /> Sync Data
          </Button>
        </div>
      </template>
    </PageHeader>

    <div v-if="loading && orders.length === 0" class="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
      <RefreshCw class="h-8 w-8 animate-spin text-primary" />
      <span class="text-sm font-medium">Connecting to operations database...</span>
    </div>

    <template v-else>
      <!-- KPI strip -->
      <div class="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-4 gap-4 mb-6">
        <StatCard label="Today's Revenue" :value="`$${todayRevenue.toFixed(2)}`" delta="Live sales" :icon="DollarSign" tone="success" />
        <StatCard label="Active Orders" :value="activeOrders.length.toString()" :delta="`${kitchenQueue.length} in kitchen`" :icon="ShoppingBag" tone="primary" />
        <StatCard label="Tables Occupied" :value="`${tablesCount.occupied}/${tablesCount.total}`" :delta="`${Math.round((tablesCount.occupied / (tablesCount.total || 1)) * 100)}% occupancy`" :icon="Table2" tone="info" />
        <StatCard label="Avg Prep Time" :value="avgOrderTime" delta="Since order open" :icon="Clock3" tone="warning" />
      </div>

      <!-- Row 1: live orders + kitchen queue -->
      <div class="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-4">
        <!-- Live Orders List -->
        <div class="xl:col-span-2 rounded-xl bg-card border border-border shadow-soft overflow-hidden">
          <div class="flex items-center justify-between p-4 border-b border-border">
            <div>
              <h3 class="text-sm font-semibold">Live Orders</h3>
              <p class="text-xs text-muted-foreground mt-0.5">Real-time view of every active ticket on the floor</p>
            </div>
            <router-link to="/restaurant/orders">
              <Button variant="ghost" size="sm" class="text-xs h-8">View all →</Button>
            </router-link>
          </div>
          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead class="bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th class="text-left font-semibold px-4 py-2.5">Order ID</th>
                  <th class="text-left font-semibold px-4 py-2.5">Table</th>
                  <th class="text-right font-semibold px-4 py-2.5">Amount</th>
                  <th class="text-left font-semibold px-4 py-2.5">Order Status</th>
                  <th class="text-left font-semibold px-4 py-2.5">Payment</th>
                  <th class="text-left font-semibold px-4 py-2.5">Server</th>
                  <th class="text-right font-semibold px-4 py-2.5">Time</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-border">
                <tr v-if="activeOrders.length === 0">
                  <td colspan="7" class="px-4 py-8 text-center text-muted-foreground text-xs">
                    No active orders on the floor.
                  </td>
                </tr>
                <tr v-for="o in activeOrders.slice(0, 5)" :key="o.id || o._id" class="hover:bg-muted/30 transition">
                  <td class="px-4 py-3 font-mono text-xs font-semibold">{{ String(o.id || o._id).slice(-6) }}</td>
                  <td class="px-4 py-3 font-medium">Table {{ o.tableNumber || o.table }}</td>
                  <td class="px-4 py-3 text-right font-semibold">${{ (o.totalAmount || 0).toFixed(2) }}</td>
                  <td class="px-4 py-3">
                    <span :class="['inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded border', STATUS_TONE[o.status] || 'bg-muted border-border']">
                      {{ o.status }}
                    </span>
                  </td>
                  <td class="px-4 py-3">
                    <span :class="[
                      'inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded border',
                      o.paymentStatus === 'COMPLETED' ? 'bg-success/10 text-success border-success/20' : 'bg-amber-500/10 text-amber-600 border-amber-500/20'
                    ]">
                      {{ o.paymentStatus }}
                    </span>
                  </td>
                  <td class="px-4 py-3 text-muted-foreground text-xs">{{ o.createdBy?.name || 'Waiter' }}</td>
                  <td class="px-4 py-3 text-right text-xs text-muted-foreground tabular-nums">{{ timeSince(o.createdAt) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Kitchen queue list -->
        <div class="rounded-xl bg-card border border-border shadow-soft flex flex-col">
          <div class="p-4 border-b border-border flex items-center justify-between">
            <div class="flex items-center gap-2">
              <div class="h-7 w-7 rounded-lg bg-warning/15 text-warning grid place-items-center">
                <ChefHat class="h-3.5 w-3.5" />
              </div>
              <div>
                <h3 class="text-sm font-semibold">Kitchen Queue</h3>
                <p class="text-[11px] text-muted-foreground">{{ kitchenQueue.length }} active tickets</p>
              </div>
            </div>
          </div>
          <div class="p-3 space-y-2 flex-1 overflow-y-auto max-h-[350px]">
            <div v-if="kitchenQueue.length === 0" class="text-center py-10 text-muted-foreground text-xs">
              Kitchen queue is clear!
            </div>
            <div v-for="q in kitchenQueue" :key="q.id || q._id" class="rounded-lg border border-border bg-background p-3 hover:border-primary/40 transition">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <span :class="`h-1.5 w-1.5 rounded-full ${q.status === 'READY' ? 'bg-success' : 'bg-warning'}`" />
                  <span class="font-mono text-xs font-bold">{{ String(q.id || q._id).slice(-6) }}</span>
                  <span class="text-xs text-muted-foreground">· Table {{ q.tableNumber || q.table }}</span>
                </div>
                <span :class="['text-[10px] font-semibold px-1.5 py-0.5 rounded border', STATUS_TONE[q.status]]">{{ q.status }}</span>
              </div>
              <div class="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                <span>{{ q.items?.length || 0 }} distinct dishes</span>
                <span class="font-mono">{{ timeSince(q.createdAt) }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Row 2: hourly sales + tables grid -->
      <div class="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-4">
        <!-- Chart -->
        <div class="xl:col-span-2 rounded-xl bg-card border border-border shadow-soft p-5">
          <div class="flex items-start justify-between mb-4">
            <div>
              <h3 class="text-sm font-semibold">Hourly Sales</h3>
              <p class="text-xs text-muted-foreground mt-0.5">Real-time checkout volume (today)</p>
            </div>
          </div>
          <apexchart type="area" height="260" :options="areaOptions" :series="areaSeries" />
        </div>

        <!-- Floor plan -->
        <div class="rounded-xl bg-card border border-border shadow-soft p-5 flex flex-col justify-between">
          <div>
            <div class="flex items-center justify-between mb-3">
              <div>
                <h3 class="text-sm font-semibold">Floor Plan</h3>
                <p class="text-[11px] text-muted-foreground">{{ tablesCount.occupied }} of {{ tablesCount.total }} tables active</p>
              </div>
            </div>
            <div class="grid grid-cols-4 gap-2 max-h-[220px] overflow-y-auto pr-1">
              <div
                v-for="t in tablesCount.list"
                :key="t.number"
                :class="`aspect-square rounded-lg border-2 grid place-items-center text-center transition hover:scale-105 cursor-pointer ${TABLE_TONE[t.status]}`"
              >
                <div>
                  <div class="text-sm font-bold">T-{{ String(t.number).padStart(2, "0") }}</div>
                  <div class="text-[9px] uppercase tracking-wider opacity-85 mt-0.5">{{ t.status }}</div>
                </div>
              </div>
            </div>
          </div>
          <div class="mt-3 pt-3 border-t border-border flex items-center gap-3 text-[11px] text-muted-foreground">
            <span class="flex items-center gap-1.5"><span class="h-2.5 w-2.5 rounded-sm bg-success/20 border border-success/40" /> Available</span>
            <span class="flex items-center gap-1.5"><span class="h-2.5 w-2.5 rounded-sm bg-primary/20 border border-primary/40" /> Active</span>
          </div>
        </div>
      </div>

      <!-- Row 3: quick actions + top sellers + payment methods -->
      <div class="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <!-- Top Sellers -->
        <div class="rounded-xl bg-card border border-border shadow-soft p-5">
          <h3 class="text-sm font-semibold mb-1">Top Sellers</h3>
          <p class="text-[11px] text-muted-foreground mb-3">Highest grossing items from live orders</p>
          <div class="space-y-2">
            <div v-if="topSellers.length === 0" class="text-center py-10 text-muted-foreground text-xs">
              No sales data found.
            </div>
            <div v-for="(m, i) in topSellers" :key="m.name" class="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/40 transition">
              <div class="h-7 w-7 rounded-md bg-muted grid place-items-center text-xs font-bold text-muted-foreground">
                {{ i + 1 }}
              </div>
              <div class="flex-1 min-w-0">
                <div class="text-[13px] font-medium truncate text-foreground">{{ m.name }}</div>
                <div class="text-[11px] text-muted-foreground">{{ m.category }}</div>
              </div>
              <div class="text-right">
                <div class="text-[13px] font-semibold tabular-nums">${{ m.price.toFixed(2) }}</div>
                <div class="text-[10px] text-success font-medium">{{ m.qty }} sold</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Payment mix breakdown -->
        <div class="rounded-xl bg-card border border-border shadow-soft p-5">
          <div class="flex items-center justify-between mb-4">
            <div>
              <h3 class="text-sm font-semibold">Payment Methods</h3>
              <p class="text-[11px] text-muted-foreground">Distribution of completed checkouts</p>
            </div>
            <Wallet class="h-4 w-4 text-muted-foreground" />
          </div>
          <div class="grid grid-cols-2 gap-4 items-center min-h-[180px]">
            <apexchart type="donut" height="180" :options="pieOptions" :series="pieSeries" />
            <div class="space-y-2">
              <div v-for="(p, i) in paymentMix" :key="p.name" class="flex items-center gap-2 text-xs">
                <span class="h-2.5 w-2.5 rounded-sm" :style="{ background: `var(--chart-${i + 1})` }" />
                <span class="flex-1 text-muted-foreground">{{ p.name }}</span>
                <span class="font-semibold tabular-nums text-foreground">{{ p.value }}%</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Order sources breakdown -->
        <div class="rounded-xl bg-card border border-border shadow-soft p-5">
          <div class="flex items-center justify-between mb-4">
            <div>
              <h3 class="text-sm font-semibold">Order Channels</h3>
              <p class="text-[11px] text-muted-foreground">Who registers floor tickets</p>
            </div>
            <Activity class="h-4 w-4 text-muted-foreground" />
          </div>
          <apexchart type="bar" height="200" :options="barOptions" :series="barSeries" />
        </div>
      </div>
    </template>
  </RoleLayout>
</template>

<style scoped>
.pulse-dot {
  display: inline-block;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background-color: var(--success);
  box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.7);
  animation: pulse 1.6s infinite;
}

@keyframes pulse {
  0% {
    transform: scale(0.95);
    box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.7);
  }
  70% {
    transform: scale(1);
    box-shadow: 0 0 0 6px rgba(34, 197, 94, 0);
  }
  100% {
    transform: scale(0.95);
    box-shadow: 0 0 0 0 rgba(34, 197, 94, 0);
  }
}
</style>
