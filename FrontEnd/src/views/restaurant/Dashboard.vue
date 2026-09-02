<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import {
  Activity, BellRing, ChefHat, Clock3, CookingPot, CreditCard, DollarSign,
  Plus, Receipt, ShoppingBag, Table2, Users, UtensilsCrossed, Wallet,
  RefreshCw, ChevronRight, BarChart3, LayoutDashboard, Utensils, CheckCircle,
  ArrowRight, Grid, Sparkles, Layers, Package, Clock
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
const activeMobileTab = ref<'orders' | 'kitchen' | 'floor' | 'analytics' | 'quick_nav'>('orders')
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
  const restaurantId = auth.effectiveRestaurantId
  if (!restaurantId) return

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
  chart: {
    type: 'area',
    toolbar: { show: false },
    zoom: { enabled: false },
    selection: { enabled: false },
    animations: { enabled: true, easing: 'easeinout', speed: 400 },
    fontFamily: 'inherit',
  },
  stroke: { curve: 'smooth', width: 2.5, colors: ['var(--primary)'] },
  fill: {
    type: 'gradient',
    gradient: { shadeIntensity: 1, opacityFrom: 0.35, opacityTo: 0, stops: [0, 100] },
    colors: ['var(--primary)']
  },
  xaxis: {
    categories: hourlySales.value.map(d => d.h),
    axisBorder: { show: false },
    axisTicks: { show: false },
    labels: { style: { colors: 'var(--muted-foreground)', fontSize: '11px', fontWeight: 600 } }
  },
  yaxis: {
    labels: {
      formatter: (val: number) => `₹${Math.round(val).toLocaleString('en-IN')}`,
      style: { colors: 'var(--muted-foreground)', fontSize: '11px', fontWeight: 600 }
    }
  },
  dataLabels: { enabled: false },
  markers: { size: 0, hover: { size: 5 } },
  grid: { strokeDashArray: 3, borderColor: 'var(--border)' },
  states: {
    normal: { filter: { type: 'none' } },
    hover: { filter: { type: 'none' } },
    active: { allowMultipleDataPointsSelection: false, filter: { type: 'none' } }
  },
  tooltip: {
    theme: 'dark',
    x: { show: true },
    y: {
      formatter: (val: number) => `₹${Number(val).toLocaleString('en-IN', { minimumFractionDigits: 0 })}`
    }
  }
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
  chart: {
    type: 'donut',
    toolbar: { show: false },
    selection: { enabled: false },
    fontFamily: 'inherit',
  },
  labels: paymentMix.value.map(d => d.name),
  dataLabels: { enabled: false },
  plotOptions: {
    pie: {
      expandOnClick: false,
      donut: { size: '65%' }
    }
  },
  stroke: { show: false },
  legend: { show: false },
  colors: ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)'],
  states: {
    normal: { filter: { type: 'none' } },
    hover: { filter: { type: 'none' } },
    active: { allowMultipleDataPointsSelection: false, filter: { type: 'none' } }
  },
  tooltip: {
    theme: 'dark',
    y: { formatter: (val: number) => `${val}% of revenue` }
  }
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
  chart: {
    type: 'bar',
    toolbar: { show: false },
    zoom: { enabled: false },
    selection: { enabled: false },
    fontFamily: 'inherit',
  },
  colors: ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)'],
  plotOptions: {
    bar: {
      borderRadius: 4,
      distributed: true,
      columnWidth: '50%'
    }
  },
  xaxis: {
    categories: orderSourceMix.value.map(d => d.name),
    axisBorder: { show: false },
    axisTicks: { show: false },
    labels: { style: { colors: 'var(--muted-foreground)', fontSize: '11px', fontWeight: 600 } }
  },
  yaxis: {
    labels: { style: { colors: 'var(--muted-foreground)', fontSize: '11px', fontWeight: 600 } }
  },
  dataLabels: { enabled: false },
  grid: { strokeDashArray: 3, borderColor: 'var(--border)' },
  states: {
    normal: { filter: { type: 'none' } },
    hover: { filter: { type: 'none' } },
    active: { allowMultipleDataPointsSelection: false, filter: { type: 'none' } }
  },
  tooltip: {
    theme: 'dark',
    y: { formatter: (val: number) => `${val} order${val !== 1 ? 's' : ''}` }
  },
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
      <!-- ═════════════════════════════════════════════════════════════════════ -->
      <!-- MOBILE APP VIEW (Optimized specifically for phone screens)          -->
      <!-- ═════════════════════════════════════════════════════════════════════ -->
      <div class="block lg:hidden space-y-4">
        <!-- 1. Mobile Quick Status Header -->
        <div class="rounded-2xl bg-card border border-border p-4 shadow-soft">
          <div class="flex items-center justify-between">
            <div>
              <div class="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Restaurant Admin</div>
              <h2 class="font-display text-lg font-bold text-foreground truncate max-w-[200px]">{{ restaurant?.name || 'Restaurant' }}</h2>
            </div>
            <div class="flex items-center gap-2">
              <Badge class="border-success/30 text-success bg-success/10 font-bold text-[10px] gap-1 px-2 py-0.5">
                <span class="pulse-dot" /> Live Ops
              </Badge>
              <button
                @click="fetchDashboardData"
                class="h-8 w-8 rounded-xl border border-border bg-muted/30 hover:bg-muted text-muted-foreground flex items-center justify-center transition cursor-pointer"
                title="Refresh Live Data"
              >
                <RefreshCw :class="['h-3.5 w-3.5', loading && 'animate-spin text-primary']" />
              </button>
            </div>
          </div>

          <!-- 4 KPI Metrics (2x2 Grid) -->
          <div class="grid grid-cols-2 gap-2 mt-3.5 pt-3 border-t border-border">
            <div class="p-2.5 rounded-xl bg-primary/5 border border-primary/15">
              <div class="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Today Revenue</div>
              <div class="font-display text-base font-extrabold text-foreground mt-0.5">₹{{ todayRevenue.toFixed(0) }}</div>
            </div>
            <div class="p-2.5 rounded-xl bg-amber-500/5 border border-amber-500/15">
              <div class="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Active Orders</div>
              <div class="font-display text-base font-extrabold text-amber-600 dark:text-amber-400 mt-0.5">{{ activeOrders.length }} Tickets</div>
            </div>
            <div class="p-2.5 rounded-xl bg-emerald-500/5 border border-emerald-500/15">
              <div class="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Occupancy</div>
              <div class="font-display text-base font-extrabold text-emerald-600 dark:text-emerald-400 mt-0.5">{{ tablesCount.occupied }} / {{ tablesCount.total }} Tables</div>
            </div>
            <div class="p-2.5 rounded-xl bg-purple-500/5 border border-purple-500/15">
              <div class="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Kitchen Queue</div>
              <div class="font-display text-base font-extrabold text-purple-600 dark:text-purple-400 mt-0.5">{{ kitchenQueue.length }} Cooking</div>
            </div>
          </div>
        </div>

        <!-- 2. App-Style Segmented Navigation Tab Bar -->
        <div class="flex items-center gap-1.5 p-1 rounded-2xl bg-muted/60 border border-border overflow-x-auto no-scrollbar">
          <button
            @click="activeMobileTab = 'orders'"
            :class="['px-3 py-2 rounded-xl text-xs font-bold transition shrink-0 flex items-center gap-1.5 cursor-pointer', activeMobileTab === 'orders' ? 'bg-card text-foreground shadow-xs border border-border/60' : 'text-muted-foreground hover:text-foreground']"
          >
            <Receipt class="h-3.5 w-3.5 text-primary" />
            <span>Orders ({{ activeOrders.length }})</span>
          </button>
          <button
            @click="activeMobileTab = 'kitchen'"
            :class="['px-3 py-2 rounded-xl text-xs font-bold transition shrink-0 flex items-center gap-1.5 cursor-pointer', activeMobileTab === 'kitchen' ? 'bg-card text-foreground shadow-xs border border-border/60' : 'text-muted-foreground hover:text-foreground']"
          >
            <ChefHat class="h-3.5 w-3.5 text-amber-500" />
            <span>Kitchen ({{ kitchenQueue.length }})</span>
          </button>
          <button
            @click="activeMobileTab = 'floor'"
            :class="['px-3 py-2 rounded-xl text-xs font-bold transition shrink-0 flex items-center gap-1.5 cursor-pointer', activeMobileTab === 'floor' ? 'bg-card text-foreground shadow-xs border border-border/60' : 'text-muted-foreground hover:text-foreground']"
          >
            <Table2 class="h-3.5 w-3.5 text-emerald-500" />
            <span>Floor Plan</span>
          </button>
          <button
            @click="activeMobileTab = 'analytics'"
            :class="['px-3 py-2 rounded-xl text-xs font-bold transition shrink-0 flex items-center gap-1.5 cursor-pointer', activeMobileTab === 'analytics' ? 'bg-card text-foreground shadow-xs border border-border/60' : 'text-muted-foreground hover:text-foreground']"
          >
            <BarChart3 class="h-3.5 w-3.5 text-blue-500" />
            <span>Analytics</span>
          </button>
          <button
            @click="activeMobileTab = 'quick_nav'"
            :class="['px-3 py-2 rounded-xl text-xs font-bold transition shrink-0 flex items-center gap-1.5 cursor-pointer', activeMobileTab === 'quick_nav' ? 'bg-card text-foreground shadow-xs border border-border/60' : 'text-muted-foreground hover:text-foreground']"
          >
            <Grid class="h-3.5 w-3.5 text-purple-500" />
            <span>App Hub</span>
          </button>
        </div>

        <!-- 3. Tab Contents -->

        <!-- TAB: ORDERS -->
        <div v-if="activeMobileTab === 'orders'" class="space-y-3">
          <div class="flex items-center justify-between px-1">
            <span class="text-xs font-bold text-muted-foreground uppercase tracking-wider">Live Active Floor Orders</span>
            <router-link to="/restaurant/orders" class="text-xs text-primary font-bold hover:underline">View All →</router-link>
          </div>

          <div v-if="activeOrders.length === 0" class="p-8 text-center rounded-2xl bg-card border border-border text-muted-foreground">
            <CheckCircle class="h-8 w-8 mx-auto mb-2 text-emerald-500 opacity-60" />
            <p class="text-xs font-semibold">No active orders on floor right now.</p>
          </div>

          <div v-else class="space-y-2.5">
            <div
              v-for="(o, i) in activeOrders"
              :key="o.id || o._id"
              class="p-3.5 rounded-2xl bg-card border border-border shadow-soft flex flex-col gap-2"
            >
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <span class="font-bold text-sm text-foreground">
                    {{ (o.orderType === 'PARCEL' || Number(o.tableNumber) === 0) ? `Takeaway (${o.customerName || 'Parcel'})` : `Table ${o.tableNumber || o.table}` }}
                  </span>
                  <span :class="['text-[10px] font-bold px-2 py-0.5 rounded border', STATUS_TONE[o.status] || 'bg-muted border-border']">
                    {{ o.status }}
                  </span>
                </div>
                <div class="font-display text-base font-extrabold tabular-nums">
                  ₹{{ (o.totalAmount || 0).toFixed(0) }}
                </div>
              </div>

              <!-- Order items summary -->
              <div v-if="o.items && o.items.length" class="text-xs text-muted-foreground truncate">
                <span class="font-medium text-foreground/90">{{ o.items.map((it: any) => `${it.qty || 1}× ${it.name}`).join(', ') }}</span>
              </div>

              <div class="flex items-center justify-between text-[11px] text-muted-foreground pt-2 border-t border-border/50">
                <span>By: <strong class="text-foreground font-semibold">{{ o.createdBy?.name || 'Staff' }}</strong> · {{ timeSince(o.createdAt) }}</span>
                <span :class="['font-semibold', o.paymentStatus === 'COMPLETED' ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400']">
                  {{ o.paymentStatus === 'COMPLETED' ? '✓ Paid' : '⏳ Unpaid' }}
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- TAB: KITCHEN -->
        <div v-else-if="activeMobileTab === 'kitchen'" class="space-y-3">
          <div class="flex items-center justify-between px-1">
            <span class="text-xs font-bold text-muted-foreground uppercase tracking-wider">Kitchen Preparation Queue</span>
            <span class="text-xs font-bold text-amber-600 dark:text-amber-400">{{ kitchenQueue.length }} Active Tickets</span>
          </div>

          <div v-if="kitchenQueue.length === 0" class="p-8 text-center rounded-2xl bg-card border border-border text-muted-foreground">
            <ChefHat class="h-8 w-8 mx-auto mb-2 text-emerald-500 opacity-60" />
            <p class="text-xs font-semibold">Kitchen queue is all clear!</p>
          </div>

          <div v-else class="space-y-2.5">
            <div
              v-for="(q, idx) in kitchenQueue"
              :key="q.id || q._id"
              class="p-3.5 rounded-2xl bg-card border border-border shadow-soft flex flex-col gap-2"
            >
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <span class="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                  <span class="font-bold text-sm text-foreground">
                    {{ (q.orderType === 'PARCEL' || Number(q.tableNumber) === 0) ? `Takeaway · Ticket #${idx + 1}` : `Table ${q.tableNumber || q.table} · Ticket #${idx + 1}` }}
                  </span>
                </div>
                <span :class="['text-[10px] font-bold px-2 py-0.5 rounded border', STATUS_TONE[q.status]]">
                  {{ q.status }}
                </span>
              </div>

              <!-- Dishes in ticket -->
              <div v-if="q.items && q.items.length" class="space-y-1 py-1">
                <div v-for="(it, i) in q.items" :key="i" class="flex items-center justify-between text-xs py-0.5 text-foreground/90">
                  <span class="font-semibold">{{ it.qty || 1 }}× {{ it.name }}</span>
                </div>
              </div>

              <div class="text-[11px] text-muted-foreground pt-2 border-t border-border/50 flex items-center justify-between">
                <span class="flex items-center gap-1"><Clock class="h-3 w-3" /> Ordered {{ timeSince(q.createdAt) }}</span>
                <span class="font-semibold text-primary">{{ q.items?.length || 0 }} dishes</span>
              </div>
            </div>
          </div>
        </div>

        <!-- TAB: FLOOR PLAN -->
        <div v-else-if="activeMobileTab === 'floor'" class="space-y-3">
          <div class="rounded-2xl bg-card border border-border p-4 shadow-soft space-y-3">
            <div class="flex items-center justify-between">
              <div>
                <h3 class="font-bold text-sm text-foreground">Live Floor Plan</h3>
                <p class="text-[11px] text-muted-foreground">{{ tablesCount.occupied }} of {{ tablesCount.total }} tables occupied</p>
              </div>
              <router-link to="/restaurant/tables">
                <Button size="sm" variant="outline" class="h-7 text-xs px-2.5">Edit Tables</Button>
              </router-link>
            </div>

            <!-- Visual Table Grid -->
            <div class="grid grid-cols-4 gap-2">
              <div
                v-for="t in tablesCount.list"
                :key="t.number"
                :class="`p-2.5 rounded-xl border-2 grid place-items-center text-center transition ${TABLE_TONE[t.status]}`"
              >
                <div class="text-xs font-extrabold">T-{{ String(t.number).padStart(2, '0') }}</div>
                <div class="text-[8px] uppercase font-bold tracking-wider opacity-90 mt-0.5">{{ t.status }}</div>
              </div>
            </div>

            <!-- Legend -->
            <div class="pt-2 border-t border-border flex items-center justify-between text-[11px] text-muted-foreground">
              <span class="flex items-center gap-1.5"><span class="h-2.5 w-2.5 rounded-sm bg-success/20 border border-success/40" /> {{ tablesCount.total - tablesCount.occupied }} Vacant</span>
              <span class="flex items-center gap-1.5"><span class="h-2.5 w-2.5 rounded-sm bg-primary/20 border border-primary/40" /> {{ tablesCount.occupied }} Occupied</span>
            </div>
          </div>
        </div>

        <!-- TAB: ANALYTICS -->
        <div v-else-if="activeMobileTab === 'analytics'" class="space-y-3">
          <!-- Hourly sales -->
          <div class="rounded-2xl bg-card border border-border p-4 shadow-soft">
            <div class="flex items-center justify-between mb-2">
              <div>
                <h3 class="font-bold text-sm text-foreground">Hourly Sales Trend</h3>
                <p class="text-[10px] text-muted-foreground">Real-time checkout volume today</p>
              </div>
              <router-link to="/restaurant/reports" class="text-xs text-primary font-bold">Reports →</router-link>
            </div>
            <apexchart type="area" height="200" :options="areaOptions" :series="areaSeries" />
          </div>

          <!-- Top Sellers -->
          <div class="rounded-2xl bg-card border border-border p-4 shadow-soft">
            <h3 class="font-bold text-sm text-foreground mb-2">Top Selling Dishes</h3>
            <div class="divide-y divide-border">
              <div v-for="(m, i) in topSellers" :key="m.name" class="flex items-center justify-between py-2 text-xs">
                <div class="flex items-center gap-2">
                  <span class="h-5 w-5 rounded-md bg-muted text-muted-foreground font-bold flex items-center justify-center text-[10px]">{{ i + 1 }}</span>
                  <div>
                    <div class="font-semibold text-foreground">{{ m.name }}</div>
                    <div class="text-[10px] text-muted-foreground">{{ m.category }}</div>
                  </div>
                </div>
                <div class="text-right">
                  <div class="font-bold tabular-nums">₹{{ m.price.toFixed(0) }}</div>
                  <div class="text-[10px] text-emerald-600 font-semibold">{{ m.qty }} sold</div>
                </div>
              </div>
            </div>
          </div>

          <!-- Payment mix breakdown -->
          <div class="rounded-2xl bg-card border border-border p-4 shadow-soft">
            <h3 class="font-bold text-sm text-foreground mb-2">Payment Methods</h3>
            <div class="grid grid-cols-2 gap-3 items-center">
              <apexchart type="donut" height="150" :options="pieOptions" :series="pieSeries" />
              <div class="space-y-1.5 text-xs">
                <div v-for="(p, i) in paymentMix" :key="p.name" class="flex items-center gap-1.5">
                  <span class="h-2 w-2 rounded-sm" :style="{ background: `var(--chart-${i + 1})` }" />
                  <span class="flex-1 text-muted-foreground text-[11px]">{{ p.name }}</span>
                  <span class="font-bold text-[11px] tabular-nums">{{ p.value }}%</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- TAB: QUICK APP HUB -->
        <div v-else-if="activeMobileTab === 'quick_nav'" class="space-y-3">
          <div class="px-1">
            <span class="text-xs font-bold text-muted-foreground uppercase tracking-wider">Restaurant Management Hub</span>
          </div>

          <div class="grid grid-cols-2 gap-2.5">
            <!-- Menu -->
            <router-link
              to="/restaurant/menu"
              class="p-4 rounded-2xl bg-card border border-border shadow-soft flex flex-col gap-2 hover:border-primary/40 transition active:scale-98"
            >
              <div class="h-10 w-10 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-500">
                <UtensilsCrossed class="h-5 w-5" />
              </div>
              <div>
                <div class="font-bold text-sm text-foreground">Menu Items</div>
                <div class="text-[11px] text-muted-foreground">Dishes &amp; prices</div>
              </div>
            </router-link>

            <!-- Cashier & Billing -->
            <router-link
              to="/cashier"
              class="p-4 rounded-2xl bg-card border border-border shadow-soft flex flex-col gap-2 hover:border-primary/40 transition active:scale-98"
            >
              <div class="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                <Receipt class="h-5 w-5" />
              </div>
              <div>
                <div class="font-bold text-sm text-foreground">Cashier POS</div>
                <div class="text-[11px] text-muted-foreground">Settle &amp; bills</div>
              </div>
            </router-link>

            <!-- Staff Management -->
            <router-link
              to="/restaurant/staff"
              class="p-4 rounded-2xl bg-card border border-border shadow-soft flex flex-col gap-2 hover:border-primary/40 transition active:scale-98"
            >
              <div class="h-10 w-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-500">
                <Users class="h-5 w-5" />
              </div>
              <div>
                <div class="font-bold text-sm text-foreground">Staff &amp; Roles</div>
                <div class="text-[11px] text-muted-foreground">Waiters &amp; chefs</div>
              </div>
            </router-link>

            <!-- Reports & Analytics -->
            <router-link
              to="/restaurant/reports"
              class="p-4 rounded-2xl bg-card border border-border shadow-soft flex flex-col gap-2 hover:border-primary/40 transition active:scale-98"
            >
              <div class="h-10 w-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500">
                <BarChart3 class="h-5 w-5" />
              </div>
              <div>
                <div class="font-bold text-sm text-foreground">Reports</div>
                <div class="text-[11px] text-muted-foreground">Month &amp; GST data</div>
              </div>
            </router-link>

            <!-- Tables Setup -->
            <router-link
              to="/restaurant/tables"
              class="p-4 rounded-2xl bg-card border border-border shadow-soft flex flex-col gap-2 hover:border-primary/40 transition active:scale-98"
            >
              <div class="h-10 w-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500">
                <Table2 class="h-5 w-5" />
              </div>
              <div>
                <div class="font-bold text-sm text-foreground">Table Setup</div>
                <div class="text-[11px] text-muted-foreground">Capacities &amp; QRs</div>
              </div>
            </router-link>

            <!-- All Orders -->
            <router-link
              to="/restaurant/orders"
              class="p-4 rounded-2xl bg-card border border-border shadow-soft flex flex-col gap-2 hover:border-primary/40 transition active:scale-98"
            >
              <div class="h-10 w-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-500">
                <ShoppingBag class="h-5 w-5" />
              </div>
              <div>
                <div class="font-bold text-sm text-foreground">All Orders</div>
                <div class="text-[11px] text-muted-foreground">Order tickets log</div>
              </div>
            </router-link>
          </div>
        </div>
      </div>

      <!-- ═════════════════════════════════════════════════════════════════════ -->
      <!-- DESKTOP / LAPTOP VIEW (100% UNCHANGED)                              -->
      <!-- ═════════════════════════════════════════════════════════════════════ -->
      <div class="hidden lg:block">
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
                  <tr v-for="(o, i) in activeOrders.slice(0, 5)" :key="o.id || o._id" class="hover:bg-muted/30 transition">
                    <td class="px-4 py-3 font-semibold text-xs text-foreground">Order #{{ i + 1 }}</td>
                    <td class="px-4 py-3 font-medium">Table {{ o.tableNumber || o.table }}</td>
                    <td class="px-4 py-3 text-right font-semibold">₹{{ (o.totalAmount || 0).toFixed(0) }}</td>
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
              <div v-for="(q, idx) in kitchenQueue" :key="q.id || q._id" class="rounded-lg border border-border bg-background p-3 hover:border-primary/40 transition">
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-2">
                    <span :class="`h-1.5 w-1.5 rounded-full ${q.status === 'READY' ? 'bg-success' : 'bg-warning'}`" />
                    <span class="text-xs font-bold">Ticket #{{ idx + 1 }}</span>
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
                    <div class="text-sm font-bold">T-{{ String(t.number).padStart(2, '0') }}</div>
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
                  <div class="text-[13px] font-semibold tabular-nums">₹{{ m.price.toFixed(0) }}</div>
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
