<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import {
  Building2, DollarSign, ShoppingBag, Users, RefreshCw,
  Search, Clock, UtensilsCrossed, ArrowRight, Eye,
  ChevronDown, Activity, Sparkles, TrendingUp
} from 'lucide-vue-next'
import RoleLayout from '@/components/RoleLayout.vue'
import PageHeader from '@/components/PageHeader.vue'
import StatCard from '@/components/StatCard.vue'
import Badge from '@/components/ui/Badge.vue'
import Button from '@/components/ui/Button.vue'
import Input from '@/components/ui/Input.vue'
import { adminNav } from '@/lib/nav'
import { getRestaurants, getOrders, getPayments, getAllUsers } from '@/lib/api'
import { toast } from 'vue-sonner'

const loading = ref(true)
const syncing = ref(false)
const selectedVenueId = ref<string>('ALL')
const activeTab = ref<'orders' | 'venues'>('orders')
const autoSync = ref(true)
let syncInterval: any = null

const restaurants = ref<any[]>([])
const allOrders = ref<any[]>([])
const allPayments = ref<any[]>([])
const allUsers = ref<any[]>([])

// Activity / Orders Table Filters
const orderSearch = ref('')
const orderStatusFilter = ref<string>('ALL')

// Sync / Fetch all network data
async function loadNetworkData(silent = false) {
  if (!silent) loading.value = true
  else syncing.value = true

  try {
    const [restRes, usersRes] = await Promise.all([
      getRestaurants(),
      getAllUsers(1, 1000)
    ])

    allUsers.value = usersRes.data || []
    const rawRestaurants = restRes.data || []

    const ordersAcc: any[] = []
    const paymentsAcc: any[] = []

    const hydrated = await Promise.all(
      rawRestaurants.map(async (r: any) => {
        const rId = r._id || r.id
        try {
          const [ordersRes, paymentsRes] = await Promise.all([
            getOrders(rId, 1, 500).catch(() => ({ data: [] })),
            getPayments(rId, 1, 500).catch(() => ({ data: [] }))
          ])

          const rOrders = (ordersRes.data || []).map((o: any) => ({
            ...o,
            restaurantName: r.name,
            restaurantLocation: r.location || 'Main Branch',
            restaurantId: rId,
          }))

          const rPayments = (paymentsRes.data || []).map((p: any) => ({
            ...p,
            restaurantName: r.name,
            restaurantId: rId,
          }))

          ordersAcc.push(...rOrders)
          paymentsAcc.push(...rPayments)

          const completedPayments = rPayments.filter((p: any) => p.status === 'COMPLETED')
          const venueRevenue = completedPayments.reduce((sum: number, p: any) => sum + (Number(p.totalAmount) || 0), 0)
          const activeOrders = rOrders.filter((o: any) => !['COMPLETED', 'CANCELLED'].includes((o.status || '').toUpperCase()))

          return {
            ...r,
            id: rId,
            city: r.location || 'Main',
            ordersCount: rOrders.length,
            activeOrdersCount: activeOrders.length,
            revenue: venueRevenue,
            staffCount: allUsers.value.filter((u: any) => {
              const uRId = typeof u.restaurantId === 'string' ? u.restaurantId : u.restaurantId?._id || u.restaurantId?.id
              return uRId === rId
            }).length,
            status: r.status?.toLowerCase() || 'active'
          }
        } catch {
          return {
            ...r,
            id: rId,
            city: r.location || 'Main',
            ordersCount: 0,
            activeOrdersCount: 0,
            revenue: 0,
            staffCount: 0,
            status: r.status?.toLowerCase() || 'active'
          }
        }
      })
    )

    restaurants.value = hydrated
    allOrders.value = ordersAcc.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    allPayments.value = paymentsAcc
  } catch (err: any) {
    toast.error(err.message || 'Failed to sync restaurant network data')
  } finally {
    loading.value = false
    syncing.value = false
  }
}

onMounted(async () => {
  await loadNetworkData()
  syncInterval = setInterval(() => {
    if (autoSync.value) {
      loadNetworkData(true)
    }
  }, 12000)
})

onUnmounted(() => {
  if (syncInterval) clearInterval(syncInterval)
})

// Time Range Filters
type TimeRange = 'today' | '7days' | 'month' | 'last_month' | 'custom_month' | 'all'
const selectedRange = ref<TimeRange>('month')
const now = new Date()
const selectedMonthStr = ref<string>(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`)

function isWithinRange(dateStr: string) {
  if (!dateStr) return false
  if (selectedRange.value === 'all') return true

  const d = new Date(dateStr)
  const currentNow = new Date()
  const todayStart = new Date(currentNow.getFullYear(), currentNow.getMonth(), currentNow.getDate()).getTime()

  if (selectedRange.value === 'today') {
    return d.getTime() >= todayStart
  }
  if (selectedRange.value === '7days') {
    const sevenDaysAgo = todayStart - 7 * 24 * 60 * 60 * 1000
    return d.getTime() >= sevenDaysAgo
  }
  if (selectedRange.value === 'month') {
    return d.getFullYear() === currentNow.getFullYear() && d.getMonth() === currentNow.getMonth()
  }
  if (selectedRange.value === 'last_month') {
    const lastMonthDate = new Date(currentNow.getFullYear(), currentNow.getMonth() - 1, 1)
    return d.getFullYear() === lastMonthDate.getFullYear() && d.getMonth() === lastMonthDate.getMonth()
  }
  if (selectedRange.value === 'custom_month') {
    if (!selectedMonthStr.value) return true
    const [y, m] = selectedMonthStr.value.split('-').map(Number)
    return d.getFullYear() === y && (d.getMonth() + 1) === m
  }
  return true
}

const activePeriodLabel = computed(() => {
  if (selectedRange.value === 'today') return 'Today'
  if (selectedRange.value === '7days') return 'Last 7 Days'
  if (selectedRange.value === 'month') {
    return new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  }
  if (selectedRange.value === 'last_month') {
    const d = new Date()
    d.setMonth(d.getMonth() - 1)
    return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  }
  if (selectedRange.value === 'custom_month') {
    if (!selectedMonthStr.value) return 'Selected Month'
    const [y, m] = selectedMonthStr.value.split('-').map(Number)
    const d = new Date(y, m - 1, 1)
    return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  }
  return 'All Time'
})

// ── Filtered Dataset based on Selected Venue & Time Range ─────────────────────
const filteredOrders = computed(() => {
  let list = allOrders.value
  if (selectedVenueId.value !== 'ALL') {
    list = list.filter(o => o.restaurantId === selectedVenueId.value)
  }
  return list.filter(o => isWithinRange(o.createdAt))
})

const filteredPayments = computed(() => {
  let list = allPayments.value
  if (selectedVenueId.value !== 'ALL') {
    list = list.filter(p => p.restaurantId === selectedVenueId.value)
  }
  return list.filter(p => isWithinRange(p.paidAt || p.createdAt))
})

const selectedRestaurantObj = computed(() => {
  if (selectedVenueId.value === 'ALL') return null
  return restaurants.value.find(r => r.id === selectedVenueId.value)
})

// ── Summary KPI Metrics ───────────────────────────────────────────────────────
const totalRevenueMetric = computed(() => {
  return filteredPayments.value
    .filter((p: any) => p.status === 'COMPLETED')
    .reduce((sum: number, p: any) => sum + (Number(p.totalAmount) || 0), 0)
})

const totalOrdersMetric = computed(() => filteredOrders.value.length)

const liveActiveOrdersMetric = computed(() => {
  return allOrders.value.filter(o => {
    if (selectedVenueId.value !== 'ALL' && o.restaurantId !== selectedVenueId.value) return false
    const s = (o.status || '').toUpperCase()
    return ['PENDING', 'PREPARING', 'READY', 'SERVED'].includes(s)
  }).length
})

const activeStaffMetric = computed(() => {
  if (selectedVenueId.value === 'ALL') {
    return allUsers.value.filter((u: any) => u.isActive !== false).length
  }
  return allUsers.value.filter((u: any) => {
    const uRId = typeof u.restaurantId === 'string' ? u.restaurantId : u.restaurantId?._id || u.restaurantId?.id
    return uRId === selectedVenueId.value && u.isActive !== false
  }).length
})

// ── Chart Data (Month-Wise & Time Range Dynamic Breakdown) ───────────────────
const chartDays = computed(() => {
  const completed = filteredPayments.value.filter(p => p.status === 'COMPLETED')

  if (selectedRange.value === '7days' || selectedRange.value === 'today') {
    const days = []
    const weekdayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    for (let i = 6; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0).getTime()
      const dayEnd = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999).getTime()

      const dayPayments = completed.filter(p => {
        const pDate = new Date(p.paidAt || p.createdAt).getTime()
        return pDate >= dayStart && pDate <= dayEnd
      })
      const dayOrders = filteredOrders.value.filter(o => {
        const oDate = new Date(o.createdAt).getTime()
        return oDate >= dayStart && oDate <= dayEnd
      })

      days.push({
        label: `${weekdayNames[d.getDay()]} (${d.getDate()}/${d.getMonth() + 1})`,
        revenue: dayPayments.reduce((sum, p) => sum + (Number(p.totalAmount) || 0), 0),
        orders: dayOrders.length
      })
    }
    return days
  }

  // Month-wise daily breakdown
  if (selectedRange.value === 'month' || selectedRange.value === 'last_month' || selectedRange.value === 'custom_month') {
    let targetYear = new Date().getFullYear()
    let targetMonth = new Date().getMonth()

    if (selectedRange.value === 'last_month') {
      const lm = new Date()
      lm.setMonth(lm.getMonth() - 1)
      targetYear = lm.getFullYear()
      targetMonth = lm.getMonth()
    } else if (selectedRange.value === 'custom_month' && selectedMonthStr.value) {
      const [y, m] = selectedMonthStr.value.split('-').map(Number)
      targetYear = y
      targetMonth = m - 1
    }

    const numDays = new Date(targetYear, targetMonth + 1, 0).getDate()
    const days = []

    for (let day = 1; day <= numDays; day++) {
      const dayStart = new Date(targetYear, targetMonth, day, 0, 0, 0, 0).getTime()
      const dayEnd = new Date(targetYear, targetMonth, day, 23, 59, 59, 999).getTime()

      const dayPayments = completed.filter(p => {
        const pDate = new Date(p.paidAt || p.createdAt).getTime()
        return pDate >= dayStart && pDate <= dayEnd
      })
      const dayOrders = filteredOrders.value.filter(o => {
        const oDate = new Date(o.createdAt).getTime()
        return oDate >= dayStart && oDate <= dayEnd
      })

      days.push({
        label: `${day}`,
        revenue: dayPayments.reduce((sum, p) => sum + (Number(p.totalAmount) || 0), 0),
        orders: dayOrders.length
      })
    }
    return days
  }

  // All Time: 6 Months
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const days = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date()
    d.setMonth(d.getMonth() - i)
    const mStart = new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0).getTime()
    const mEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59).getTime()

    const mPayments = completed.filter(p => {
      const pDate = new Date(p.paidAt || p.createdAt).getTime()
      return pDate >= mStart && pDate <= mEnd
    })
    const mOrders = filteredOrders.value.filter(o => {
      const oDate = new Date(o.createdAt).getTime()
      return oDate >= mStart && oDate <= mEnd
    })

    days.push({
      label: `${monthNames[d.getMonth()]} ${d.getFullYear().toString().slice(-2)}`,
      revenue: mPayments.reduce((sum, p) => sum + (Number(p.totalAmount) || 0), 0),
      orders: mOrders.length
    })
  }
  return days
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
  stroke: { curve: 'smooth', width: 2.5, colors: ['#f97316'] },
  fill: {
    type: 'gradient',
    gradient: { shadeIntensity: 1, opacityFrom: 0.35, opacityTo: 0.05, stops: [0, 100] },
    colors: ['#f97316']
  },
  xaxis: {
    categories: chartDays.value.map(d => d.label),
    axisBorder: { show: false },
    axisTicks: { show: false },
    labels: { style: { colors: '#94a3b8', fontSize: '11px', fontWeight: 500 } }
  },
  yaxis: {
    labels: {
      formatter: (val: number) => `₹${Math.round(val).toLocaleString('en-IN')}`,
      style: { colors: '#94a3b8', fontSize: '11px', fontWeight: 500 }
    }
  },
  dataLabels: { enabled: false },
  markers: { size: 0, hover: { size: 4 } },
  grid: { strokeDashArray: 3, borderColor: 'rgba(148, 163, 184, 0.15)' },
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
  name: 'Revenue',
  data: chartDays.value.map(d => d.revenue)
}])

const barOptions = computed(() => ({
  chart: {
    type: 'bar',
    toolbar: { show: false },
    zoom: { enabled: false },
    selection: { enabled: false },
    fontFamily: 'inherit',
  },
  colors: ['#f97316'],
  plotOptions: { bar: { borderRadius: 4, columnWidth: '40%' } },
  xaxis: {
    categories: chartDays.value.map(d => d.label),
    axisBorder: { show: false },
    axisTicks: { show: false },
    labels: { style: { colors: '#94a3b8', fontSize: '11px', fontWeight: 500 } }
  },
  yaxis: {
    labels: { style: { colors: '#94a3b8', fontSize: '11px', fontWeight: 500 } }
  },
  dataLabels: { enabled: false },
  grid: { strokeDashArray: 3, borderColor: 'rgba(148, 163, 184, 0.15)' },
  states: {
    normal: { filter: { type: 'none' } },
    hover: { filter: { type: 'none' } },
    active: { allowMultipleDataPointsSelection: false, filter: { type: 'none' } }
  },
  tooltip: {
    theme: 'dark',
    y: {
      formatter: (val: number) => `${val} order${val !== 1 ? 's' : ''}`
    }
  }
}))

const barSeries = computed(() => [{
  name: 'Orders',
  data: chartDays.value.map(d => d.orders)
}])

// ── Revenue by Venue Share (Donut Chart) ──────────────────────────────────────
const venueShareOptions = computed(() => ({
  chart: {
    type: 'donut',
    toolbar: { show: false },
    selection: { enabled: false },
    fontFamily: 'inherit',
  },
  labels: restaurants.value.map(r => r.name),
  colors: ['#f97316', '#3b82f6', '#10b981', '#8b5cf6', '#06b6d4', '#ec4899'],
  dataLabels: { enabled: false },
  plotOptions: {
    pie: {
      expandOnClick: false,
      donut: { size: '70%' }
    }
  },
  stroke: { show: false },
  legend: { show: false },
  states: {
    normal: { filter: { type: 'none' } },
    hover: { filter: { type: 'none' } },
    active: { allowMultipleDataPointsSelection: false, filter: { type: 'none' } }
  },
  tooltip: {
    theme: 'dark',
    y: {
      formatter: (val: number) => `₹${Number(val).toLocaleString('en-IN', { minimumFractionDigits: 0 })}`
    }
  }
}))

const venueShareSeries = computed(() => {
  const series = restaurants.value.map(r => r.revenue)
  const sum = series.reduce((a, b) => a + b, 0)
  return sum > 0 ? series : [100]
})

// ── Displayed Live Orders List ────────────────────────────────────────────────
const displayedOrders = computed(() => {
  let list = filteredOrders.value

  if (orderStatusFilter.value === 'LIVE') {
    list = list.filter(o => ['PENDING', 'PREPARING', 'READY', 'SERVED'].includes((o.status || '').toUpperCase()))
  } else if (orderStatusFilter.value === 'COMPLETED') {
    list = list.filter(o => (o.status || '').toUpperCase() === 'COMPLETED')
  } else if (orderStatusFilter.value === 'PARCEL') {
    list = list.filter(o => o.orderType === 'PARCEL' || Number(o.tableNumber) === 0)
  }

  if (orderSearch.value.trim()) {
    const q = orderSearch.value.toLowerCase()
    list = list.filter(o => {
      const idStr = String(o.id || o._id || '').toLowerCase()
      const custStr = String(o.customerName || '').toLowerCase()
      const restStr = String(o.restaurantName || '').toLowerCase()
      const tableStr = String(o.tableNumber || '').toLowerCase()
      return idStr.includes(q) || custStr.includes(q) || restStr.includes(q) || tableStr.includes(q)
    })
  }

  return list.slice(0, 20)
})

function formatTimeAgo(ts: string) {
  if (!ts) return ''
  const m = Math.floor((Date.now() - new Date(ts).getTime()) / 60000)
  if (m > 1440) return `${Math.floor(m / 1440)}d ago`
  if (m > 60) return `${Math.floor(m / 60)}h ago`
  if (m <= 0) return 'Just now'
  return `${m}m ago`
}

function getStatusBadge(status: string) {
  const s = (status || '').toUpperCase()
  switch (s) {
    case 'PENDING':
      return { label: 'Pending', class: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20' }
    case 'PREPARING':
      return { label: 'Preparing', class: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20' }
    case 'READY':
      return { label: 'Ready', class: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' }
    case 'SERVED':
      return { label: 'Served', class: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20' }
    case 'COMPLETED':
      return { label: 'Completed', class: 'bg-muted text-muted-foreground border-border' }
    case 'CANCELLED':
      return { label: 'Cancelled', class: 'bg-destructive/10 text-destructive border-destructive/20' }
    default:
      return { label: s, class: 'bg-muted text-muted-foreground border-border' }
  }
}
</script>

<template>
  <RoleLayout role="main_admin" :nav="adminNav">
    <!-- Header with Clean Multi-Venue Selector & Sync -->
    <PageHeader
      title="Admin Dashboard"
      :subtitle="`Real-time overview of restaurant performance, sales, and operations · ${activePeriodLabel}`"
    >
      <template #action>
        <div class="flex flex-wrap items-center gap-2.5">
          <!-- Restaurant Selector -->
          <div class="relative">
            <select
              v-model="selectedVenueId"
              class="h-8.5 pl-3 pr-8 text-xs font-semibold rounded-lg bg-card border border-border text-foreground hover:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary shadow-2xs cursor-pointer appearance-none transition"
            >
              <option value="ALL">All Restaurants</option>
              <option v-for="r in restaurants" :key="r.id" :value="r.id">
                {{ r.name }} ({{ r.city }})
              </option>
            </select>
            <ChevronDown class="h-3.5 w-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          </div>

          <!-- Time Range Selector -->
          <div class="inline-flex items-center rounded-lg bg-muted/40 p-0.5 border border-border">
            <button
              v-for="r in ([
                { id: 'today', label: 'Today' },
                { id: '7days', label: '7 Days' },
                { id: 'month', label: 'This Month' },
                { id: 'last_month', label: 'Last Month' },
                { id: 'all', label: 'All Time' },
              ] as const)"
              :key="r.id"
              @click="selectedRange = r.id"
              :class="[
                'px-2.5 py-1 text-xs font-medium rounded-md transition cursor-pointer',
                selectedRange === r.id
                  ? 'bg-card text-foreground font-semibold shadow-2xs'
                  : 'text-muted-foreground hover:text-foreground'
              ]"
            >
              {{ r.label }}
            </button>
          </div>

          <!-- Specific Month Picker Input -->
          <div class="relative flex items-center">
            <input
              type="month"
              v-model="selectedMonthStr"
              @change="selectedRange = 'custom_month'"
              :class="[
                'h-8.5 px-2.5 rounded-lg border text-xs font-medium transition cursor-pointer bg-card',
                selectedRange === 'custom_month'
                  ? 'border-primary text-primary font-semibold ring-1 ring-primary'
                  : 'border-border text-muted-foreground hover:border-primary/40'
              ]"
              title="Pick a specific month"
            />
          </div>

          <!-- Refresh Button -->
          <Button
            variant="outline"
            size="sm"
            class="h-8.5 text-xs font-medium gap-1.5 shadow-2xs cursor-pointer"
            @click="loadNetworkData(false)"
            :disabled="syncing || loading"
          >
            <RefreshCw :class="['h-3.5 w-3.5', (syncing || loading) && 'animate-spin text-primary']" />
            <span class="hidden sm:inline">{{ syncing ? 'Syncing...' : 'Refresh' }}</span>
          </Button>

          <!-- Live Indicator Badge -->
          <div
            @click="autoSync = !autoSync"
            :class="[
              'h-8.5 px-3 rounded-lg border text-xs font-medium flex items-center gap-2 transition cursor-pointer select-none',
              autoSync
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                : 'bg-muted/40 text-muted-foreground border-border'
            ]"
            :title="autoSync ? 'Live updates active (auto-refresh every 12s)' : 'Live updates paused'"
          >
            <span :class="['h-2 w-2 rounded-full', autoSync ? 'bg-emerald-500 animate-pulse' : 'bg-muted-foreground']" />
            <span>{{ autoSync ? 'Live' : 'Paused' }}</span>
          </div>
        </div>
      </template>
    </PageHeader>

    <!-- Selected Venue Notice (Minimal & Clean) -->
    <div
      v-if="selectedRestaurantObj"
      class="mb-6 px-4 py-3 rounded-xl bg-card border border-border flex items-center justify-between gap-3 shadow-2xs"
    >
      <div class="flex items-center gap-3">
        <div class="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold text-sm">
          {{ selectedRestaurantObj.name.charAt(0) }}
        </div>
        <div>
          <div class="flex items-center gap-2">
            <h3 class="text-sm font-semibold text-foreground">{{ selectedRestaurantObj.name }}</h3>
            <Badge variant="outline" class="text-[10px] py-0 px-1.5 bg-muted">
              {{ selectedRestaurantObj.location || selectedRestaurantObj.city }}
            </Badge>
          </div>
          <p class="text-xs text-muted-foreground mt-0.5">
            Max Tables: {{ selectedRestaurantObj.maxTables || 20 }} · Staff: {{ selectedRestaurantObj.staffCount }}
          </p>
        </div>
      </div>

      <div class="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          class="h-8 text-xs font-medium text-muted-foreground hover:text-foreground"
          @click="selectedVenueId = 'ALL'"
        >
          View All Restaurants
        </Button>
      </div>
    </div>

    <!-- KPI Metric Cards -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <StatCard
        label="Total Revenue"
        :value="`₹${totalRevenueMetric.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`"
        delta="Completed payments"
        :icon="DollarSign"
        tone="success"
      />
      <StatCard
        label="Active Orders"
        :value="liveActiveOrdersMetric.toString()"
        :delta="`${totalOrdersMetric} total orders today`"
        :icon="ShoppingBag"
        tone="primary"
      />
      <StatCard
        :label="selectedVenueId === 'ALL' ? 'Restaurants' : 'Venue Status'"
        :value="selectedVenueId === 'ALL' ? restaurants.length.toString() : 'Active'"
        :delta="selectedVenueId === 'ALL' ? 'Connected branches' : (selectedRestaurantObj?.city || 'Main Branch')"
        :icon="Building2"
        tone="info"
      />
      <StatCard
        label="Active Staff"
        :value="activeStaffMetric.toString()"
        :delta="selectedVenueId === 'ALL' ? 'Across all venues' : 'Assigned to venue'"
        :icon="Users"
        tone="warning"
      />
    </div>

    <!-- Analytics Charts Section -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
      <!-- 7-Day Revenue Trend -->
      <div class="lg:col-span-2 rounded-xl bg-card border border-border p-5 shadow-2xs">
        <div class="flex items-center justify-between mb-4">
          <div>
            <h3 class="text-sm font-semibold text-foreground">Revenue Trend</h3>
            <p class="text-xs text-muted-foreground">
              {{ selectedVenueId === 'ALL' ? 'Daily revenue across all restaurants (Last 7 Days)' : `Daily revenue for ${selectedRestaurantObj?.name}` }}
            </p>
          </div>
          <Badge variant="secondary" class="text-xs font-medium">INR (₹)</Badge>
        </div>
        <apexchart type="area" height="240" :options="areaOptions" :series="areaSeries" />
      </div>

      <!-- Breakdown Chart: Donut if ALL, Bar if Single Venue -->
      <div class="rounded-xl bg-card border border-border p-5 shadow-2xs flex flex-col justify-between">
        <div v-if="selectedVenueId === 'ALL'">
          <div class="flex items-center justify-between mb-1">
            <h3 class="text-sm font-semibold text-foreground">Revenue by Branch</h3>
            <Badge variant="outline" class="text-[10px]">Share</Badge>
          </div>
          <p class="text-xs text-muted-foreground mb-3">Contribution per restaurant</p>
          <div class="py-1">
            <apexchart type="donut" height="200" :options="venueShareOptions" :series="venueShareSeries" />
          </div>

          <!-- Branch Revenue Summary List -->
          <div class="pt-3 border-t border-border space-y-1.5 text-xs">
            <div
              v-for="r in restaurants.slice(0, 3)"
              :key="r.id"
              class="flex items-center justify-between py-1 px-2 rounded-lg bg-muted/30"
            >
              <span class="truncate text-muted-foreground font-medium">{{ r.name }}</span>
              <span class="font-semibold text-foreground">₹{{ r.revenue.toLocaleString('en-IN', { maximumFractionDigits: 0 }) }}</span>
            </div>
          </div>
        </div>

        <div v-else>
          <h3 class="text-sm font-semibold text-foreground mb-1">Daily Order Volume</h3>
          <p class="text-xs text-muted-foreground mb-4">Orders generated over the last 7 days</p>
          <apexchart type="bar" height="240" :options="barOptions" :series="barSeries" />
        </div>
      </div>
    </div>

    <!-- Simplified Tabbed Content: Live Orders vs Connected Restaurants -->
    <div class="rounded-xl bg-card border border-border shadow-2xs overflow-hidden">
      <!-- Tab Header Bar -->
      <div class="p-4 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <!-- Navigation Tabs -->
        <div class="flex items-center gap-1 bg-muted/40 p-1 rounded-lg border border-border">
          <button
            @click="activeTab = 'orders'"
            :class="[
              'px-3 py-1.5 rounded-md text-xs font-semibold transition cursor-pointer flex items-center gap-1.5',
              activeTab === 'orders' ? 'bg-card text-foreground shadow-2xs' : 'text-muted-foreground hover:text-foreground'
            ]"
          >
            <Activity class="h-3.5 w-3.5" />
            <span>Live Activity</span>
            <span class="px-1.5 py-0.2 rounded-full bg-primary/10 text-primary text-[10px] font-bold">
              {{ displayedOrders.length }}
            </span>
          </button>

          <button
            @click="activeTab = 'venues'"
            :class="[
              'px-3 py-1.5 rounded-md text-xs font-semibold transition cursor-pointer flex items-center gap-1.5',
              activeTab === 'venues' ? 'bg-card text-foreground shadow-2xs' : 'text-muted-foreground hover:text-foreground'
            ]"
          >
            <Building2 class="h-3.5 w-3.5" />
            <span>Restaurants</span>
            <span class="px-1.5 py-0.2 rounded-full bg-muted text-muted-foreground text-[10px] font-bold">
              {{ restaurants.length }}
            </span>
          </button>
        </div>

        <!-- Orders Filters (Visible when Orders tab active) -->
        <div v-if="activeTab === 'orders'" class="flex flex-wrap items-center gap-2">
          <!-- Search -->
          <div class="relative w-full sm:w-48">
            <Search class="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              v-model="orderSearch"
              placeholder="Search orders..."
              class="h-8 pl-8 text-xs bg-background rounded-lg"
            />
          </div>

          <!-- Status Filters -->
          <div class="flex items-center gap-1">
            <button
              v-for="st in [
                { id: 'ALL', label: 'All' },
                { id: 'LIVE', label: 'Active' },
                { id: 'COMPLETED', label: 'Completed' },
                { id: 'PARCEL', label: 'Takeaway' }
              ]"
              :key="st.id"
              @click="orderStatusFilter = st.id"
              :class="[
                'px-2.5 py-1 rounded-md text-xs font-medium transition cursor-pointer',
                orderStatusFilter === st.id
                  ? 'bg-primary text-primary-foreground font-semibold shadow-2xs'
                  : 'bg-muted/40 text-muted-foreground hover:bg-muted'
              ]"
            >
              {{ st.label }}
            </button>
          </div>
        </div>

        <!-- Venues Action (Visible when Venues tab active) -->
        <div v-else class="flex items-center gap-2">
          <router-link to="/admin/restaurants">
            <Button variant="outline" size="sm" class="h-8 text-xs font-medium gap-1">
              Manage Restaurants <ArrowRight class="h-3 w-3" />
            </Button>
          </router-link>
        </div>
      </div>

      <!-- TAB 1: Live Orders Table -->
      <div v-if="activeTab === 'orders'" class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="bg-muted/30 text-muted-foreground text-[11px] uppercase tracking-wider font-semibold border-b border-border">
            <tr>
              <th class="text-left px-4 py-3">Order</th>
              <th v-if="selectedVenueId === 'ALL'" class="text-left px-4 py-3">Restaurant</th>
              <th class="text-left px-4 py-3">Table / Type</th>
              <th class="text-left px-4 py-3">Guest</th>
              <th class="text-left px-4 py-3">Items</th>
              <th class="text-left px-4 py-3">Status</th>
              <th class="text-right px-4 py-3">Amount</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-border">
            <tr v-if="displayedOrders.length === 0">
              <td :colspan="selectedVenueId === 'ALL' ? 7 : 6" class="py-12 text-center text-muted-foreground">
                <UtensilsCrossed class="h-8 w-8 mx-auto mb-2 opacity-30 text-primary" />
                <p class="font-semibold text-sm text-foreground">No orders found</p>
                <p class="text-xs mt-1">Live orders placed at any branch will appear here.</p>
              </td>
            </tr>

            <tr
              v-for="order in displayedOrders"
              :key="order._id || order.id"
              class="hover:bg-muted/20 transition"
            >
              <!-- Order ID & Time -->
              <td class="px-4 py-3">
                <div class="font-mono font-semibold text-xs text-foreground">
                  #{{ (order._id || order.id || '').slice(-6).toUpperCase() }}
                </div>
                <div class="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                  <Clock class="h-3 w-3" /> {{ formatTimeAgo(order.createdAt) }}
                </div>
              </td>

              <!-- Restaurant Name (when viewing all) -->
              <td v-if="selectedVenueId === 'ALL'" class="px-4 py-3">
                <button
                  @click="selectedVenueId = order.restaurantId"
                  class="text-xs font-medium text-foreground hover:text-primary transition text-left cursor-pointer flex items-center gap-1"
                >
                  <Building2 class="h-3 w-3 text-muted-foreground shrink-0" />
                  <span class="truncate max-w-[120px]">{{ order.restaurantName }}</span>
                </button>
              </td>

              <!-- Table / Type -->
              <td class="px-4 py-3">
                <Badge
                  v-if="order.orderType === 'PARCEL' || Number(order.tableNumber) === 0"
                  variant="outline"
                  class="bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20 text-[10px]"
                >
                  Takeaway
                </Badge>
                <Badge
                  v-else
                  variant="outline"
                  class="bg-primary/10 text-primary border-primary/20 text-[10px] font-semibold"
                >
                  Table {{ order.tableNumber }}
                </Badge>
              </td>

              <!-- Guest -->
              <td class="px-4 py-3">
                <div class="text-xs font-medium text-foreground">
                  {{ order.customerName || 'Walk-in' }}
                </div>
              </td>

              <!-- Items Summary -->
              <td class="px-4 py-3 max-w-[220px]">
                <div class="text-xs text-foreground truncate">
                  {{ (order.items || []).map((i: any) => `${i.quantity || 1}x ${i.name || i.menuItemId?.name || 'Item'}`).join(', ') || 'No items' }}
                </div>
              </td>

              <!-- Status Badge -->
              <td class="px-4 py-3">
                <Badge :class="[getStatusBadge(order.status).class, 'text-[10px] font-medium']">
                  {{ getStatusBadge(order.status).label }}
                </Badge>
              </td>

              <!-- Amount -->
              <td class="px-4 py-3 text-right font-semibold text-xs tabular-nums text-foreground">
                ₹{{ Number(order.totalAmount || 0).toFixed(0) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- TAB 2: Connected Restaurants Table -->
      <div v-else class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="bg-muted/30 text-muted-foreground text-[11px] uppercase tracking-wider font-semibold border-b border-border">
            <tr>
              <th class="text-left px-4 py-3">Restaurant</th>
              <th class="text-left px-4 py-3">Location</th>
              <th class="text-center px-4 py-3">Tables</th>
              <th class="text-center px-4 py-3">Staff</th>
              <th class="text-right px-4 py-3">Orders</th>
              <th class="text-right px-4 py-3">Revenue</th>
              <th class="text-left px-4 py-3">Status</th>
              <th class="text-right px-4 py-3">Action</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-border">
            <tr
              v-for="r in restaurants"
              :key="r.id"
              class="hover:bg-muted/20 transition"
            >
              <td class="px-4 py-3 font-semibold text-xs text-foreground">
                <div class="flex items-center gap-2">
                  <div class="h-7 w-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">
                    {{ r.name.charAt(0) }}
                  </div>
                  <span>{{ r.name }}</span>
                </div>
              </td>
              <td class="px-4 py-3 text-xs text-muted-foreground">{{ r.city }}</td>
              <td class="px-4 py-3 text-center text-xs">{{ r.maxTables || 20 }}</td>
              <td class="px-4 py-3 text-center text-xs">{{ r.staffCount }}</td>
              <td class="px-4 py-3 text-right text-xs tabular-nums">{{ r.ordersCount.toLocaleString() }}</td>
              <td class="px-4 py-3 text-right text-xs tabular-nums font-semibold text-foreground">
                ₹{{ r.revenue.toLocaleString('en-IN', { maximumFractionDigits: 0 }) }}
              </td>
              <td class="px-4 py-3">
                <Badge
                  :class="r.status === 'active' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' : 'bg-muted text-muted-foreground'"
                  class="text-[10px]"
                >
                  {{ r.status }}
                </Badge>
              </td>
              <td class="px-4 py-3 text-right">
                <Button
                  @click="selectedVenueId = r.id"
                  variant="outline"
                  size="sm"
                  class="h-7 px-2 text-[11px] font-medium gap-1 shadow-2xs"
                >
                  <Eye class="h-3 w-3" /> View
                </Button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </RoleLayout>
</template>

