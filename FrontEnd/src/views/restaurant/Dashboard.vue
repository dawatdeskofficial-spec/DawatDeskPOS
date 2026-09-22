<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import {
  Activity, BellRing, ChefHat, Clock3, CookingPot, CreditCard, DollarSign,
  Plus, Receipt, ShoppingBag, Table2, Users, UtensilsCrossed, Wallet,
  RefreshCw, ChevronRight, BarChart3, LayoutDashboard, Utensils, CheckCircle,
  ArrowRight, Grid, Sparkles, Layers, Package, Clock, TrendingUp, AlertCircle,
  Flame, CheckCircle2, QrCode, ArrowUpRight, ShieldCheck, Zap
} from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import RoleLayout from '@/components/RoleLayout.vue'
import PageHeader from '@/components/PageHeader.vue'
import Button from '@/components/ui/Button.vue'
import Badge from '@/components/ui/Badge.vue'
import { restaurantNav } from '@/lib/nav'
import { getOrders, getPayments, getRestaurantById, getUsersByRestaurant } from '@/lib/api'
import { consolidateOrderItems } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const loading = ref(true)
const activeMobileTab = ref<'live' | 'kitchen' | 'analytics' | 'hub'>('live')
const floorFilter = ref<'all' | 'occupied' | 'available'>('all')
const orders = ref<any[]>([])
const payments = ref<any[]>([])
const staffList = ref<any[]>([])
const restaurant = ref<any>(
  typeof auth.user?.restaurantId === 'object' && auth.user?.restaurantId ? auth.user.restaurantId : null
)
let interval: any

const STATUS_TONE: Record<string, string> = {
  PENDING: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/25",
  PREPARING: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/25",
  READY: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/25",
  SERVED: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/25",
  COMPLETED: "bg-muted text-muted-foreground border-border",
  CANCELLED: "bg-destructive/15 text-destructive border-destructive/25",
}

const TABLE_TONE: Record<string, string> = {
  available: "border-emerald-500/30 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400 hover:border-emerald-500/60",
  occupied: "border-primary/40 bg-primary/10 text-primary hover:border-primary",
  reserved: "border-amber-500/30 bg-amber-500/5 text-amber-600 dark:text-amber-400 hover:border-amber-500/60",
}

async function fetchStaticDashboardData() {
  const restaurantId = auth.effectiveRestaurantId
  if (!restaurantId) return

  try {
    const [restRes, staffRes] = await Promise.all([
      getRestaurantById(restaurantId),
      getUsersByRestaurant(restaurantId, 1, 100)
    ])
    
    restaurant.value = restRes.data
    staffList.value = staffRes.data || []
  } catch (err: any) {
    console.error('Failed to load static restaurant dashboard data', err)
  }
}

async function fetchDynamicDashboardData() {
  const restaurantId = auth.effectiveRestaurantId
  if (!restaurantId) return

  try {
    const [ordRes, payRes] = await Promise.all([
      getOrders(restaurantId, 1, 100, undefined, true),
      getPayments(restaurantId, 1, 100, true)
    ])
    
    orders.value = ordRes.data || []
    payments.value = payRes.data || []
  } catch (err: any) {
    console.error('Failed to load dynamic restaurant dashboard data', err)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  fetchStaticDashboardData()
  fetchDynamicDashboardData()
  interval = setInterval(fetchDynamicDashboardData, 5000)
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

const completedPaymentsTodayCount = computed(() => {
  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)
  return payments.value.filter(p => {
    const pDate = new Date(p.paidAt || p.createdAt)
    return p.status === 'COMPLETED' && pDate >= startOfToday
  }).length
})

const activeOrders = computed(() => {
  return orders.value.filter(o => ['PENDING', 'PREPARING', 'READY', 'SERVED'].includes(o.status))
})

const tablesCount = computed(() => {
  const max = restaurant.value?.maxTables || 16
  const activeOrdersMap = new Map<number, any>()
  activeOrders.value.forEach(o => {
    activeOrdersMap.set(Number(o.tableNumber || o.table), o)
  })
  
  const list = Array.from({ length: max }, (_, i) => {
    const tNum = i + 1
    const ord = activeOrdersMap.get(tNum)
    let completedCount = 0
    let workingCount = 0
    if (ord?.items && ord.items.length > 0) {
      ord.items.forEach((it: any) => {
        const q = it.quantity || it.qty || 1
        const st = (it.status || '').toUpperCase()
        if (st === 'DELIVERED' || st === 'READY' || ord.status === 'SERVED' || ord.status === 'COMPLETED') {
          completedCount += q
        } else {
          workingCount += q
        }
      })
    } else if (ord) {
      if (['READY', 'SERVED', 'COMPLETED'].includes(ord.status)) completedCount = 1
      else workingCount = 1
    }
    return {
      number: tNum,
      status: ord ? 'occupied' : 'available',
      order: ord || null,
      bill: ord?.totalAmount || 0,
      completedCount,
      workingCount
    }
  })

  return {
    occupied: activeOrdersMap.size,
    total: max,
    list
  }
})

const filteredFloorList = computed(() => {
  if (floorFilter.value === 'occupied') {
    return tablesCount.value.list.filter(t => t.status === 'occupied')
  }
  if (floorFilter.value === 'available') {
    return tablesCount.value.list.filter(t => t.status === 'available')
  }
  return tablesCount.value.list
})

const occupancyRate = computed(() => {
  if (!tablesCount.value.total) return 0
  return Math.round((tablesCount.value.occupied / tablesCount.value.total) * 100)
})

const pendingBillsCount = computed(() => {
  return activeOrders.value.filter(o => o.status === 'SERVED' && o.paymentStatus !== 'COMPLETED').length
})

const kitchenQueue = computed(() => {
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

const areaOptions = computed(() => {
  const maxSale = Math.max(...hourlySales.value.map(d => d.sales), 0)
  const isZeroAll = maxSale === 0

  return {
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
      tickAmount: 4,
      axisBorder: { show: false },
      axisTicks: { show: false },
      labels: {
        rotate: 0,
        rotateAlways: false,
        hideOverlappingLabels: true,
        style: { colors: 'var(--muted-foreground)', fontSize: '11px', fontWeight: 600 }
      }
    },
    yaxis: {
      min: 0,
      max: isZeroAll ? 500 : undefined,
      tickAmount: isZeroAll ? 4 : undefined,
      forceNiceScale: true,
      labels: {
        formatter: (val: number) => {
          if (val < 1 && val > 0) return ''
          return `₹${Math.round(val).toLocaleString('en-IN')}`
        },
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
    },
    responsive: [
      {
        breakpoint: 640,
        options: {
          xaxis: {
            tickAmount: 4,
            labels: {
              rotate: 0,
              rotateAlways: false,
              hideOverlappingLabels: true,
              style: { fontSize: '10px' }
            }
          },
          yaxis: {
            labels: { style: { fontSize: '10px' } }
          }
        }
      }
    ]
  }
})

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
  noData: {
    text: 'No payment data today',
    style: { color: 'var(--muted-foreground)', fontSize: '11px' }
  },
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
    <!-- Desktop-Only Page Header (Clean, unstacked layout on mobile) -->
    <div class="hidden lg:block">
      <PageHeader
        title="Operations Center"
        subtitle="Live restaurant performance across the floor, kitchen, and POS."
      >
        <template #action>
          <div class="flex items-center gap-2">
            <Badge variant="outline" class="gap-1.5 px-2.5 py-1 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-500/5 font-semibold">
              <span class="pulse-dot" /> Live
            </Badge>
            <Button variant="ghost" size="sm" class="h-9 px-3" @click="fetchDynamicDashboardData()">
              <RefreshCw :class="['h-4 w-4 mr-2', loading && 'animate-spin']" /> Sync Data
            </Button>
          </div>
        </template>
      </PageHeader>
    </div>

    <div v-if="loading && orders.length === 0" class="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
      <RefreshCw class="h-8 w-8 animate-spin text-primary" />
      <span class="text-sm font-medium">Connecting to operations database...</span>
    </div>

    <template v-else>
      <!-- ═════════════════════════════════════════════════════════════════════ -->
      <!-- MOBILE APP VIEW (Optimized specifically for phone screens)          -->
      <!-- ═════════════════════════════════════════════════════════════════════ -->
      <div class="block lg:hidden space-y-3.5 pb-8">
        
        <!-- 1. Executive Restaurant Hero Card -->
        <div class="relative overflow-hidden rounded-2xl bg-card border border-border p-3.5 shadow-sm">
          <!-- Subtle ambient glow background -->
          <div class="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-primary/10 blur-2xl pointer-events-none" />
          
          <div class="flex items-center justify-between gap-2 relative z-10">
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-1.5">
                <span class="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Restaurant Hub</span>
                <span class="inline-block w-1 h-1 rounded-full bg-muted-foreground/40" />
                <span class="text-[10px] font-semibold text-primary flex items-center gap-0.5">
                  <ShieldCheck class="h-3 w-3" /> Managed
                </span>
              </div>
              <h2 class="font-display text-lg font-bold text-foreground truncate mt-0.5 leading-tight">
                {{ restaurant?.name || 'Hariom Restaurant' }}
              </h2>
            </div>
            
            <div class="flex items-center gap-1.5 shrink-0">
              <div class="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shadow-xs">
                <span class="pulse-dot" /> Live Ops
              </div>
              <button
                @click="fetchDynamicDashboardData()"
                class="h-7.5 w-7.5 rounded-xl border border-border bg-muted/40 hover:bg-muted active:scale-95 text-foreground flex items-center justify-center transition cursor-pointer"
                title="Sync Live Data"
              >
                <RefreshCw :class="['h-3.5 w-3.5', loading && 'animate-spin text-primary']" />
              </button>
            </div>
          </div>

          <!-- 4 High-Impact KPI Stat Cards (2x2 Grid) -->
          <div class="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-border/70 relative z-10">
            <!-- Revenue Card -->
            <div class="p-2.5 rounded-xl bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border border-emerald-500/20 flex flex-col justify-between">
              <div class="flex items-center justify-between">
                <span class="text-[9.5px] font-bold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider">Today Revenue</span>
                <span class="h-5 w-5 rounded-lg bg-emerald-500/15 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                  <Wallet class="h-3 w-3" />
                </span>
              </div>
              <div class="mt-1">
                <div class="font-display text-lg font-extrabold text-foreground tabular-nums tracking-tight">
                  ₹{{ todayRevenue.toLocaleString('en-IN') }}
                </div>
                <div class="text-[10px] font-medium text-emerald-600 dark:text-emerald-400 mt-0.5">
                  {{ completedPaymentsTodayCount }} settled orders
                </div>
              </div>
            </div>

            <!-- Active Orders Card -->
            <div class="p-2.5 rounded-xl bg-gradient-to-br from-amber-500/10 to-amber-500/5 border border-amber-500/20 flex flex-col justify-between">
              <div class="flex items-center justify-between">
                <span class="text-[9.5px] font-bold text-amber-700 dark:text-amber-300 uppercase tracking-wider">Active Orders</span>
                <span class="h-5 w-5 rounded-lg bg-amber-500/15 flex items-center justify-center text-amber-600 dark:text-amber-400">
                  <Flame class="h-3 w-3" />
                </span>
              </div>
              <div class="mt-1">
                <div class="font-display text-lg font-extrabold text-amber-600 dark:text-amber-400 tabular-nums tracking-tight">
                  {{ activeOrders.length }} <span class="text-xs font-bold text-foreground">Tickets</span>
                </div>
                <div class="text-[10px] font-medium text-muted-foreground mt-0.5">
                  {{ pendingBillsCount }} waiting for bill
                </div>
              </div>
            </div>

            <!-- Table Occupancy Card -->
            <div class="p-2.5 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 flex flex-col justify-between">
              <div class="flex items-center justify-between">
                <span class="text-[9.5px] font-bold text-primary uppercase tracking-wider">Occupancy</span>
                <span class="h-5 w-5 rounded-lg bg-primary/15 flex items-center justify-center text-primary">
                  <Table2 class="h-3 w-3" />
                </span>
              </div>
              <div class="mt-1">
                <div class="font-display text-base font-extrabold text-foreground tabular-nums tracking-tight flex items-baseline gap-1">
                  <span>{{ tablesCount.occupied }}</span>
                  <span class="text-xs font-semibold text-muted-foreground">/ {{ tablesCount.total }} Tables</span>
                </div>
                <!-- Mini visual progress indicator -->
                <div class="mt-1.5 h-1.5 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    class="h-full rounded-full bg-primary transition-all duration-500"
                    :style="{ width: `${occupancyRate}%` }"
                  />
                </div>
              </div>
            </div>

            <!-- Kitchen Load Card -->
            <div class="p-2.5 rounded-xl bg-gradient-to-br from-purple-500/10 to-purple-500/5 border border-purple-500/20 flex flex-col justify-between">
              <div class="flex items-center justify-between">
                <span class="text-[9.5px] font-bold text-purple-700 dark:text-purple-300 uppercase tracking-wider">Kitchen Queue</span>
                <span class="h-5 w-5 rounded-lg bg-purple-500/15 flex items-center justify-center text-purple-600 dark:text-purple-400">
                  <ChefHat class="h-3 w-3" />
                </span>
              </div>
              <div class="mt-1">
                <div class="font-display text-lg font-extrabold text-purple-600 dark:text-purple-400 tabular-nums tracking-tight">
                  {{ kitchenQueue.length }} <span class="text-xs font-bold text-foreground">Cooking</span>
                </div>
                <div class="text-[10px] font-medium text-muted-foreground mt-0.5 flex items-center gap-1">
                  <Clock class="h-2.5 w-2.5" /> {{ avgOrderTime }} avg prep
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 2. Segmented Navigation Tab Bar -->
        <div class="grid grid-cols-4 gap-1 p-1 rounded-2xl bg-muted/60 border border-border shadow-xs">
          <button
            @click="activeMobileTab = 'live'"
            :class="[
              'py-2 rounded-xl text-[11px] font-bold transition flex flex-col items-center justify-center gap-0.5 cursor-pointer relative',
              activeMobileTab === 'live'
                ? 'bg-card text-foreground shadow-xs border border-border/80 font-extrabold'
                : 'text-muted-foreground hover:text-foreground'
            ]"
          >
            <Zap class="h-3.5 w-3.5 text-amber-500" />
            <span>Live Floor</span>
            <span v-if="activeOrders.length > 0" class="absolute top-1 right-2 h-1.5 w-1.5 rounded-full bg-amber-500" />
          </button>

          <button
            @click="activeMobileTab = 'kitchen'"
            :class="[
              'py-2 rounded-xl text-[11px] font-bold transition flex flex-col items-center justify-center gap-0.5 cursor-pointer relative',
              activeMobileTab === 'kitchen'
                ? 'bg-card text-foreground shadow-xs border border-border/80 font-extrabold'
                : 'text-muted-foreground hover:text-foreground'
            ]"
          >
            <ChefHat class="h-3.5 w-3.5 text-purple-500" />
            <span>KDS ({{ kitchenQueue.length }})</span>
            <span v-if="kitchenQueue.length > 0" class="absolute top-1 right-2 h-1.5 w-1.5 rounded-full bg-purple-500" />
          </button>

          <button
            @click="activeMobileTab = 'analytics'"
            :class="[
              'py-2 rounded-xl text-[11px] font-bold transition flex flex-col items-center justify-center gap-0.5 cursor-pointer',
              activeMobileTab === 'analytics'
                ? 'bg-card text-foreground shadow-xs border border-border/80 font-extrabold'
                : 'text-muted-foreground hover:text-foreground'
            ]"
          >
            <BarChart3 class="h-3.5 w-3.5 text-blue-500" />
            <span>Analytics</span>
          </button>

          <button
            @click="activeMobileTab = 'hub'"
            :class="[
              'py-2 rounded-xl text-[11px] font-bold transition flex flex-col items-center justify-center gap-0.5 cursor-pointer',
              activeMobileTab === 'hub'
                ? 'bg-card text-foreground shadow-xs border border-border/80 font-extrabold'
                : 'text-muted-foreground hover:text-foreground'
            ]"
          >
            <Grid class="h-3.5 w-3.5 text-primary" />
            <span>App Hub</span>
          </button>
        </div>

        <!-- 3. Dynamic Tab Content -->

        <!-- ── TAB 1: LIVE FLOOR & ACTIVE OPS ──────────────────────────────── -->
        <div v-if="activeMobileTab === 'live'" class="space-y-3">
          <!-- Floor Overview & Mini Table Matrix -->
          <div class="rounded-2xl bg-card border border-border p-3.5 shadow-sm space-y-2.5">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-1.5">
                <Table2 class="h-4 w-4 text-primary" />
                <h3 class="font-bold text-sm text-foreground">Live Floor Plan</h3>
              </div>
              
              <!-- Filter Segment -->
              <div class="flex items-center gap-1 bg-muted/60 p-0.5 rounded-lg text-[10px] font-bold">
                <button
                  @click="floorFilter = 'occupied'"
                  :class="['px-2 py-0.5 rounded-md transition cursor-pointer', floorFilter === 'occupied' ? 'bg-card text-primary shadow-2xs' : 'text-muted-foreground']"
                >
                  Active ({{ tablesCount.occupied }})
                </button>
                <button
                  @click="floorFilter = 'all'"
                  :class="['px-2 py-0.5 rounded-md transition cursor-pointer', floorFilter === 'all' ? 'bg-card text-foreground shadow-2xs' : 'text-muted-foreground']"
                >
                  All ({{ tablesCount.total }})
                </button>
              </div>
            </div>

            <!-- Empty state when occupied filter has no items -->
            <div v-if="floorFilter === 'occupied' && filteredFloorList.length === 0" class="py-6 text-center text-muted-foreground">
              <Table2 class="h-6 w-6 mx-auto mb-1 opacity-40 text-emerald-500" />
              <p class="text-xs font-semibold text-foreground">All tables are available</p>
              <p class="text-[10px] text-muted-foreground">No active orders on the floor</p>
            </div>

            <!-- Mini Interactive Table Grid with smooth max-height scroll -->
            <div v-else class="grid grid-cols-4 gap-1.5 max-h-[175px] overflow-y-auto pr-0.5">
              <router-link
                v-for="t in filteredFloorList"
                :key="t.number"
                to="/restaurant/tables"
                :class="[
                  'p-2 rounded-xl border flex flex-col justify-between transition-all active:scale-95 cursor-pointer relative min-h-[58px]',
                  TABLE_TONE[t.status]
                ]"
              >
                <div class="flex items-center justify-between">
                  <span class="font-extrabold text-[11px]">T-{{ String(t.number).padStart(2, '0') }}</span>
                  <span
                    :class="[
                      'h-2 w-2 rounded-full',
                      t.status === 'occupied' ? 'bg-primary animate-pulse' : 'bg-emerald-500'
                    ]"
                  />
                </div>
                <div class="mt-1 text-left">
                  <div v-if="t.status === 'occupied'" class="font-extrabold text-[11px] text-foreground tabular-nums">
                    ₹{{ Number(t.bill || 0).toFixed(0) }}
                  </div>
                  <div v-else class="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 uppercase">
                    Free
                  </div>
                </div>
              </router-link>
            </div>
            
            <div class="pt-2 border-t border-border/60 flex items-center justify-between text-[10px] text-muted-foreground">
              <span class="flex items-center gap-1.5">
                <span class="h-2 w-2 rounded-full bg-emerald-500" /> {{ tablesCount.total - tablesCount.occupied }} Free
              </span>
              <span class="flex items-center gap-1.5">
                <span class="h-2 w-2 rounded-full bg-primary" /> {{ tablesCount.occupied }} Active
              </span>
              <router-link to="/restaurant/tables" class="text-primary font-bold flex items-center gap-0.5">
                Full Map →
              </router-link>
            </div>
          </div>

          <!-- Live Active Orders Stream -->
          <div class="rounded-2xl bg-card border border-border p-3.5 shadow-sm space-y-3">
            <div class="flex items-center justify-between">
              <div>
                <h3 class="font-bold text-sm text-foreground">Active Orders Stream</h3>
                <p class="text-[10.5px] text-muted-foreground">Real-time floor tickets</p>
              </div>
              <router-link to="/restaurant/orders" class="text-xs font-bold text-primary flex items-center gap-0.5">
                All Orders ({{ orders.length }}) →
              </router-link>
            </div>

            <div v-if="activeOrders.length === 0" class="py-6 text-center text-muted-foreground">
              <ShoppingBag class="h-7 w-7 mx-auto mb-1.5 opacity-40" />
              <p class="text-xs font-medium">No active tickets on the floor right now.</p>
            </div>

            <div v-else class="space-y-2">
              <div
                v-for="(o, idx) in activeOrders.slice(0, 5)"
                :key="o.id || o._id"
                class="p-3 rounded-xl bg-muted/30 border border-border/70 flex flex-col gap-2 hover:border-primary/40 transition"
              >
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-2">
                    <span class="h-6 w-6 rounded-lg bg-card border border-border font-bold text-xs flex items-center justify-center">
                      #{{ idx + 1 }}
                    </span>
                    <div>
                      <div class="font-bold text-xs text-foreground">
                        {{ (o.orderType === 'PARCEL' || Number(o.tableNumber) === 0) ? 'Takeaway Order' : `Table ${o.tableNumber || o.table}` }}
                      </div>
                      <div class="text-[10px] text-muted-foreground flex items-center gap-1">
                        <span>{{ o.createdBy?.name || 'Waiter' }}</span>
                        <span>•</span>
                        <span>{{ timeSince(o.createdAt) }}</span>
                      </div>
                    </div>
                  </div>

                  <div class="text-right">
                    <div class="font-extrabold text-xs text-foreground tabular-nums">
                      ₹{{ Number(o.totalAmount || 0).toFixed(0) }}
                    </div>
                    <span :class="['inline-block text-[9.5px] font-bold px-1.5 py-0.2 rounded border mt-0.5', STATUS_TONE[o.status] || 'bg-muted border-border']">
                      {{ o.status }}
                    </span>
                  </div>
                </div>

                <!-- Items Preview (First 2 items) -->
                <div v-if="o.items && o.items.length" class="text-[11px] text-muted-foreground/90 bg-card/60 p-2 rounded-lg border border-border/40 flex items-center justify-between">
                  <span class="truncate max-w-[200px]">
                    {{ consolidateOrderItems(o.items).map((it: any) => `${it.qty}× ${it.name}`).slice(0, 2).join(', ') }}
                    <span v-if="consolidateOrderItems(o.items).length > 2" class="text-primary font-semibold"> +{{ consolidateOrderItems(o.items).length - 2 }} more</span>
                  </span>
                  <span class="font-semibold text-foreground text-[10px] shrink-0">
                    {{ o.items.reduce((s: number, i: any) => s + (i.qty || i.quantity || 1), 0) }} items
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- ── TAB 2: KITCHEN QUEUE & KDS ─────────────────────────────────── -->
        <div v-else-if="activeMobileTab === 'kitchen'" class="space-y-3.5">
          <div class="rounded-2xl bg-card border border-border p-3.5 shadow-sm">
            <div class="flex items-center justify-between mb-3">
              <div>
                <h3 class="font-bold text-sm text-foreground">Kitchen Display Queue</h3>
                <p class="text-[10.5px] text-muted-foreground">{{ kitchenQueue.length }} active tickets cooking</p>
              </div>
              <router-link
                to="/chef"
                class="px-2.5 py-1 rounded-xl bg-primary text-primary-foreground font-bold text-xs flex items-center gap-1 shadow-xs active:scale-95 transition"
              >
                <ChefHat class="h-3.5 w-3.5" /> Open KDS
              </router-link>
            </div>

            <div v-if="kitchenQueue.length === 0" class="p-8 text-center rounded-xl bg-muted/20 border border-border/60 text-muted-foreground">
              <ChefHat class="h-8 w-8 mx-auto mb-2 text-emerald-500 opacity-70" />
              <p class="text-xs font-bold text-foreground">Kitchen queue is all clear!</p>
              <p class="text-[11px] text-muted-foreground mt-0.5">All customer orders have been prepared and served.</p>
            </div>

            <div v-else class="space-y-2.5">
              <div
                v-for="(q, idx) in kitchenQueue"
                :key="q.id || q._id"
                class="p-3.5 rounded-2xl bg-card border border-border/80 shadow-xs flex flex-col gap-2.5"
              >
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-2">
                    <span class="h-2.5 w-2.5 rounded-full bg-amber-500 animate-pulse" />
                    <span class="font-extrabold text-sm text-foreground">
                      {{ (q.orderType === 'PARCEL' || Number(q.tableNumber) === 0) ? `Takeaway · KOT #${idx + 1}` : `Table ${q.tableNumber || q.table} · KOT #${idx + 1}` }}
                    </span>
                  </div>
                  <span :class="['text-[10px] font-bold px-2 py-0.5 rounded-full border', STATUS_TONE[q.status]]">
                    {{ q.status }}
                  </span>
                </div>

                <!-- Dishes in ticket (Consolidated so duplicate items combine into single line with total qty) -->
                <div v-if="q.items && q.items.length" class="space-y-1.5 py-1 px-2.5 rounded-xl bg-muted/40 border border-border/40">
                  <div v-for="(it, i) in consolidateOrderItems(q.items)" :key="i" class="flex items-center justify-between text-xs py-0.5 text-foreground">
                    <span class="font-bold flex items-center gap-1.5">
                      <span class="h-4.5 w-4.5 rounded-md bg-card border border-border/60 text-[10px] flex items-center justify-center font-extrabold text-primary">
                        {{ it.qty }}×
                      </span>
                      {{ it.name }}
                    </span>
                    <span class="text-[10px] font-semibold text-muted-foreground">
                      {{ it.notes || '' }}
                    </span>
                  </div>
                </div>

                <div class="text-[11px] text-muted-foreground pt-2 border-t border-border/50 flex items-center justify-between">
                  <span class="flex items-center gap-1 font-medium">
                    <Clock class="h-3 w-3 text-amber-500" /> Placed {{ timeSince(q.createdAt) }}
                  </span>
                  <span class="font-bold text-primary text-xs">
                    {{ consolidateOrderItems(q.items).length }} distinct dishes
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- ── TAB 3: ANALYTICS & SALES TRENDS ────────────────────────────── -->
        <div v-else-if="activeMobileTab === 'analytics'" class="space-y-3.5">
          <!-- Hourly sales chart -->
          <div class="rounded-2xl bg-card border border-border p-4 shadow-sm">
            <div class="flex items-center justify-between mb-2">
              <div>
                <h3 class="font-bold text-sm text-foreground">Hourly Sales Trend</h3>
                <p class="text-[10px] text-muted-foreground">Today's hourly checkout volume</p>
              </div>
              <router-link to="/restaurant/reports" class="text-xs text-primary font-bold">
                Full Report →
              </router-link>
            </div>
            <apexchart type="area" height="190" :options="areaOptions" :series="areaSeries" />
          </div>

          <!-- Top Sellers -->
          <div class="rounded-2xl bg-card border border-border p-4 shadow-sm">
            <div class="flex items-center justify-between mb-2">
              <h3 class="font-bold text-sm text-foreground">Top Selling Items</h3>
              <span class="text-[10px] font-bold text-muted-foreground uppercase">Today</span>
            </div>
            <div class="divide-y divide-border/60">
              <div v-if="topSellers.length === 0" class="py-6 text-center text-xs text-muted-foreground">
                No dish sales recorded yet today.
              </div>
              <div v-for="(m, i) in topSellers" :key="m.name" class="flex items-center justify-between py-2.5 text-xs">
                <div class="flex items-center gap-2.5">
                  <span
                    :class="[
                      'h-6 w-6 rounded-lg font-extrabold flex items-center justify-center text-[10.5px]',
                      i === 0 ? 'bg-amber-500/20 text-amber-600 border border-amber-500/30' :
                      i === 1 ? 'bg-muted text-foreground border border-border' :
                      'bg-muted/50 text-muted-foreground'
                    ]"
                  >
                    {{ i + 1 }}
                  </span>
                  <div>
                    <div class="font-bold text-foreground text-xs">{{ m.name }}</div>
                    <div class="text-[10px] text-muted-foreground">{{ m.category }}</div>
                  </div>
                </div>
                <div class="text-right">
                  <div class="font-extrabold tabular-nums text-foreground">₹{{ m.price.toFixed(0) }}</div>
                  <div class="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">{{ m.qty }} sold</div>
                </div>
              </div>
            </div>
          </div>

          <!-- Payment mix breakdown -->
          <div class="rounded-2xl bg-card border border-border p-4 shadow-sm">
            <h3 class="font-bold text-sm text-foreground mb-2">Payment Methods</h3>
            <div v-if="paymentMix.every(p => p.value === 0)" class="py-6 text-center text-xs text-muted-foreground">
              No payment checkouts recorded yet today.
            </div>
            <div v-else class="grid grid-cols-2 gap-3 items-center">
              <apexchart type="donut" height="140" :options="pieOptions" :series="pieSeries" />
              <div class="space-y-2 text-xs">
                <div v-for="(p, i) in paymentMix" :key="p.name" class="flex items-center gap-2">
                  <span class="h-2 w-2 rounded-full" :style="{ background: `var(--chart-${i + 1})` }" />
                  <span class="flex-1 text-muted-foreground text-[11px] font-medium">{{ p.name }}</span>
                  <span class="font-extrabold text-[11px] tabular-nums text-foreground">{{ p.value }}%</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- ── TAB 4: APP & RESTAURANT MANAGEMENT HUB ─────────────────────── -->
        <div v-else-if="activeMobileTab === 'hub'" class="space-y-3">
          <div class="px-1 flex items-center justify-between">
            <span class="text-xs font-extrabold text-muted-foreground uppercase tracking-wider">Restaurant Modules</span>
            <span class="text-[11px] font-bold text-primary">All Active</span>
          </div>

          <div class="grid grid-cols-2 gap-2.5">
            <!-- Cashier & POS -->
            <router-link
              to="/cashier"
              class="p-3.5 rounded-2xl bg-card border border-border shadow-xs flex flex-col gap-2 hover:border-primary/50 transition active:scale-95 group"
            >
              <div class="flex items-center justify-between">
                <div class="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-primary-foreground transition">
                  <Receipt class="h-5 w-5" />
                </div>
                <ArrowUpRight class="h-4 w-4 text-muted-foreground group-hover:text-primary transition" />
              </div>
              <div>
                <div class="font-extrabold text-sm text-foreground">Cashier POS</div>
                <div class="text-[11px] text-muted-foreground">Settle bills &amp; print</div>
              </div>
            </router-link>

            <!-- Staff & Roles -->
            <router-link
              to="/restaurant/staff"
              class="p-3.5 rounded-2xl bg-card border border-border shadow-xs flex flex-col gap-2 hover:border-primary/50 transition active:scale-95 group"
            >
              <div class="flex items-center justify-between">
                <div class="h-10 w-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-500 group-hover:bg-blue-500 group-hover:text-white transition">
                  <Users class="h-5 w-5" />
                </div>
                <ArrowUpRight class="h-4 w-4 text-muted-foreground group-hover:text-primary transition" />
              </div>
              <div>
                <div class="font-extrabold text-sm text-foreground">Staff &amp; Roles</div>
                <div class="text-[11px] text-muted-foreground">{{ staffList.length }} team members</div>
              </div>
            </router-link>

            <!-- Kitchen Display -->
            <router-link
              to="/chef"
              class="p-3.5 rounded-2xl bg-card border border-border shadow-xs flex flex-col gap-2 hover:border-primary/50 transition active:scale-95 group"
            >
              <div class="flex items-center justify-between">
                <div class="h-10 w-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 group-hover:bg-amber-500 group-hover:text-white transition">
                  <ChefHat class="h-5 w-5" />
                </div>
                <ArrowUpRight class="h-4 w-4 text-muted-foreground group-hover:text-primary transition" />
              </div>
              <div>
                <div class="font-extrabold text-sm text-foreground">Kitchen Display</div>
                <div class="text-[11px] text-muted-foreground">Live chef KDS screen</div>
              </div>
            </router-link>

            <!-- Menu & Items -->
            <router-link
              to="/restaurant/menu"
              class="p-3.5 rounded-2xl bg-card border border-border shadow-xs flex flex-col gap-2 hover:border-primary/50 transition active:scale-95 group"
            >
              <div class="flex items-center justify-between">
                <div class="h-10 w-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-500 group-hover:bg-purple-500 group-hover:text-white transition">
                  <UtensilsCrossed class="h-5 w-5" />
                </div>
                <ArrowUpRight class="h-4 w-4 text-muted-foreground group-hover:text-primary transition" />
              </div>
              <div>
                <div class="font-extrabold text-sm text-foreground">Menu &amp; Catalog</div>
                <div class="text-[11px] text-muted-foreground">Pricing &amp; 86 items</div>
              </div>
            </router-link>

            <!-- Floor & Tables -->
            <router-link
              to="/restaurant/tables"
              class="p-3.5 rounded-2xl bg-card border border-border shadow-xs flex flex-col gap-2 hover:border-primary/50 transition active:scale-95 group"
            >
              <div class="flex items-center justify-between">
                <div class="h-10 w-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500 group-hover:bg-emerald-500 group-hover:text-white transition">
                  <Table2 class="h-5 w-5" />
                </div>
                <ArrowUpRight class="h-4 w-4 text-muted-foreground group-hover:text-primary transition" />
              </div>
              <div>
                <div class="font-extrabold text-sm text-foreground">Tables &amp; QR</div>
                <div class="text-[11px] text-muted-foreground">{{ tablesCount.total }} floor tables</div>
              </div>
            </router-link>

            <!-- Reports & GST -->
            <router-link
              to="/restaurant/reports"
              class="p-3.5 rounded-2xl bg-card border border-border shadow-xs flex flex-col gap-2 hover:border-primary/50 transition active:scale-95 group"
            >
              <div class="flex items-center justify-between">
                <div class="h-10 w-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-500 group-hover:bg-rose-500 group-hover:text-white transition">
                  <BarChart3 class="h-5 w-5" />
                </div>
                <ArrowUpRight class="h-4 w-4 text-muted-foreground group-hover:text-primary transition" />
              </div>
              <div>
                <div class="font-extrabold text-sm text-foreground">Reports &amp; GST</div>
                <div class="text-[11px] text-muted-foreground">Z-report &amp; tax export</div>
              </div>
            </router-link>
          </div>
        </div>
      </div>

      <!-- ═════════════════════════════════════════════════════════════════════ -->
      <!-- DESKTOP / LAPTOP VIEW (100% UNCHANGED & PRISTINE)                   -->
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
            <div class="overflow-x-auto overflow-y-auto max-h-[380px] sidebar-scrollbar">
              <table class="w-full text-sm">
                <thead class="bg-muted/90 backdrop-blur-md sticky top-0 z-10 shadow-2xs text-[11px] uppercase tracking-wider text-muted-foreground">
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
                        o.paymentStatus === 'COMPLETED' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' : 'bg-amber-500/10 text-amber-600 border-amber-500/20'
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
                <div class="h-7 w-7 rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400 grid place-items-center">
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
                    <span :class="`h-1.5 w-1.5 rounded-full ${q.status === 'READY' ? 'bg-emerald-500' : 'bg-amber-500'}`" />
                    <span class="text-xs font-bold">Ticket #{{ idx + 1 }}</span>
                    <span class="text-xs text-muted-foreground">· Table {{ q.tableNumber || q.table }}</span>
                  </div>
                  <span :class="['text-[10px] font-semibold px-1.5 py-0.5 rounded border', STATUS_TONE[q.status]]">{{ q.status }}</span>
                </div>
                <div class="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                  <span>{{ consolidateOrderItems(q.items).length }} distinct dishes</span>
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
              <span class="flex items-center gap-1.5"><span class="h-2.5 w-2.5 rounded-sm bg-emerald-500/20 border border-emerald-500/40" /> Available</span>
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
                  <div class="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">{{ m.qty }} sold</div>
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
            <div v-if="paymentMix.every(p => p.value === 0)" class="py-12 text-center text-xs text-muted-foreground">
              No payment checkouts recorded yet today.
            </div>
            <div v-else class="grid grid-cols-2 gap-4 items-center min-h-[180px]">
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
  width: 6.5px;
  height: 6.5px;
  border-radius: 50%;
  background-color: #10b981;
  box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7);
  animation: pulse 1.6s infinite;
}

@keyframes pulse {
  0% {
    transform: scale(0.95);
    box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7);
  }
  70% {
    transform: scale(1);
    box-shadow: 0 0 0 6px rgba(16, 185, 129, 0);
  }
  100% {
    transform: scale(0.95);
    box-shadow: 0 0 0 0 rgba(16, 185, 129, 0);
  }
}
</style>
