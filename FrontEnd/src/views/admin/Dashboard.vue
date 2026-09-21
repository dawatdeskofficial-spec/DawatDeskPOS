<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import {
  Building2, DollarSign, ShoppingBag, Users, RefreshCw,
  Search, Clock, UtensilsCrossed, ArrowRight, Eye,
  ChevronDown, Activity, Sparkles, TrendingUp, Plus,
  ShieldCheck, Server, Zap, CheckCircle2, ChevronRight,
  ArrowUpRight, Receipt, ChefHat, LayoutDashboard, FileText,
  Sliders, Lock, MapPin
} from 'lucide-vue-next'
import RoleLayout from '@/components/RoleLayout.vue'
import PageHeader from '@/components/PageHeader.vue'
import StatCard from '@/components/StatCard.vue'
import Badge from '@/components/ui/Badge.vue'
import Button from '@/components/ui/Button.vue'
import Input from '@/components/ui/Input.vue'
import { adminNav } from '@/lib/nav'
import { getRestaurants, getOrders, getPayments, getAllUsers } from '@/lib/api'
import { consolidateOrderItems } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth'
import { toast } from 'vue-sonner'

const auth = useAuthStore()
const router = useRouter()

const loading = ref(true)
const syncing = ref(false)
const selectedVenueId = ref<string>('ALL')
const activeFeedTab = ref<'live_orders' | 'settlements'>('live_orders')
const autoSync = ref(true)
let syncInterval: any = null

const restaurants = ref<any[]>([])
const allOrders = ref<any[]>([])
const allPayments = ref<any[]>([])
const allUsers = ref<any[]>([])

// Activity Filters
const feedSearch = ref('')
const statusFilter = ref<string>('ALL')

// Status badges helper
const STATUS_BADGES: Record<string, { label: string; class: string }> = {
  PENDING: { label: 'Pending', class: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20' },
  PREPARING: { label: 'Cooking', class: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20' },
  READY: { label: 'Ready', class: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' },
  SERVED: { label: 'Served', class: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20' },
  COMPLETED: { label: 'Paid', class: 'bg-muted text-muted-foreground border-border' },
  CANCELLED: { label: 'Cancelled', class: 'bg-destructive/10 text-destructive border-destructive/20' },
}

function getStatusBadge(status: string) {
  const normalized = (status || 'PENDING').toUpperCase()
  return STATUS_BADGES[normalized] || { label: status || 'Unknown', class: 'bg-muted text-muted-foreground' }
}

// Sync / Fetch all network data
async function loadNetworkData(silent = false) {
  if (!silent) loading.value = true
  else syncing.value = true

  try {
    const [restRes, usersRes, ordersRes, paymentsRes] = await Promise.all([
      getRestaurants(silent),
      getAllUsers(1, 1000, silent),
      getOrders('all', 1, 500, undefined, silent).catch(() => ({ data: [] })),
      getPayments('all', 1, 500, silent).catch(() => ({ data: [] })),
    ])

    allUsers.value = usersRes.data || []
    const rawRestaurants = restRes.data || []
    const rawOrders: any[] = ordersRes.data || []
    const rawPayments: any[] = paymentsRes.data || []

    const getRId = (val: any) => {
      if (!val) return ''
      if (typeof val === 'string') return val
      return (val._id || val.id || '').toString()
    }

    const restaurantById = new Map<string, any>()
    rawRestaurants.forEach((r: any) => {
      const id = (r._id || r.id || '').toString()
      restaurantById.set(id, r)
    })

    const ordersByRestaurant = new Map<string, any[]>()
    const paymentsByRestaurant = new Map<string, any[]>()

    const ordersAcc: any[] = rawOrders.map((o: any) => {
      const rId = getRId(o.restaurantId)
      const rObj = typeof o.restaurantId === 'object' && o.restaurantId ? o.restaurantId : restaurantById.get(rId)
      const mapped = {
        ...o,
        restaurantName: rObj?.name || 'Restaurant',
        restaurantLocation: rObj?.location || 'Main Branch',
        restaurantId: rId,
      }
      if (!ordersByRestaurant.has(rId)) ordersByRestaurant.set(rId, [])
      ordersByRestaurant.get(rId)!.push(mapped)
      return mapped
    })

    const paymentsAcc: any[] = rawPayments.map((p: any) => {
      const rId = getRId(p.restaurantId)
      const rObj = typeof p.restaurantId === 'object' && p.restaurantId ? p.restaurantId : restaurantById.get(rId)
      const mapped = {
        ...p,
        restaurantName: rObj?.name || 'Restaurant',
        restaurantLocation: rObj?.location || 'Main Branch',
        restaurantId: rId,
      }
      if (!paymentsByRestaurant.has(rId)) paymentsByRestaurant.set(rId, [])
      paymentsByRestaurant.get(rId)!.push(mapped)
      return mapped
    })

    // Today start timestamp for Today's revenue calculation
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    const todayStartTime = todayStart.getTime()

    const hydrated = rawRestaurants.map((r: any) => {
      const rId = (r._id || r.id || '').toString()
      const rOrders = ordersByRestaurant.get(rId) || []
      const rPayments = paymentsByRestaurant.get(rId) || []
      const todayCompletedPayments = rPayments.filter((p: any) => {
        const pTime = new Date(p.paidAt || p.createdAt).getTime()
        return p.status === 'COMPLETED' && pTime >= todayStartTime
      })
      const todayVenueRevenue = todayCompletedPayments.reduce((sum: number, p: any) => sum + (Number(p.totalAmount) || 0), 0)
      const totalVenueRevenue = rPayments.filter((p: any) => p.status === 'COMPLETED').reduce((sum: number, p: any) => sum + (Number(p.totalAmount) || 0), 0)
      const activeOrders = rOrders.filter((o: any) => ['PENDING', 'PREPARING', 'READY', 'SERVED'].includes((o.status || '').toUpperCase()))

      return {
        ...r,
        id: rId,
        city: r.location || 'Main',
        ordersCount: rOrders.length,
        activeOrdersCount: activeOrders.length,
        todayRevenue: todayVenueRevenue,
        totalRevenue: totalVenueRevenue,
        staffCount: allUsers.value.filter((u: any) => {
          const uRId = typeof u.restaurantId === 'string' ? u.restaurantId : (u.restaurantId?._id || u.restaurantId?.id || '').toString()
          return uRId === rId
        }).length,
        status: (r.status || (r.isActive !== false ? 'ACTIVE' : 'INACTIVE')).toUpperCase(),
      }
    })

    restaurants.value = hydrated
    allOrders.value = ordersAcc.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    allPayments.value = paymentsAcc.sort((a, b) => new Date(b.paidAt || b.createdAt).getTime() - new Date(a.paidAt || a.createdAt).getTime())
  } catch (err: any) {
    if (!silent) {
      toast.error(err.message || 'Failed to sync restaurant network data')
    }
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
  }, 10000)
})

onUnmounted(() => {
  if (syncInterval) clearInterval(syncInterval)
})

// ── Selected Restaurant Helper ────────────────────────────────────────────────
const selectedRestaurantObj = computed(() => {
  if (selectedVenueId.value === 'ALL') return null
  return restaurants.value.find(r => r.id === selectedVenueId.value)
})

// ── Today Start Timestamp ─────────────────────────────────────────────────────
const todayStartTs = computed(() => {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.getTime()
})

// ── Executive Real-Time KPIs (Today & Live Focused) ───────────────────────────
const todayRevenueMetric = computed(() => {
  return allPayments.value
    .filter((p: any) => {
      if (selectedVenueId.value !== 'ALL' && p.restaurantId !== selectedVenueId.value) return false
      const pTime = new Date(p.paidAt || p.createdAt).getTime()
      return p.status === 'COMPLETED' && pTime >= todayStartTs.value
    })
    .reduce((sum: number, p: any) => sum + (Number(p.totalAmount) || 0), 0)
})

const todayOrdersCount = computed(() => {
  return allOrders.value.filter(o => {
    if (selectedVenueId.value !== 'ALL' && o.restaurantId !== selectedVenueId.value) return false
    const oTime = new Date(o.createdAt).getTime()
    return oTime >= todayStartTs.value
  }).length
})

const liveActiveOrdersCount = computed(() => {
  return allOrders.value.filter(o => {
    if (selectedVenueId.value !== 'ALL' && o.restaurantId !== selectedVenueId.value) return false
    const s = (o.status || '').toUpperCase()
    return ['PENDING', 'PREPARING', 'READY', 'SERVED'].includes(s)
  }).length
})

const activeStaffCount = computed(() => {
  if (selectedVenueId.value === 'ALL') {
    return allUsers.value.filter((u: any) => u.isActive !== false).length
  }
  return allUsers.value.filter((u: any) => {
    const uRId = typeof u.restaurantId === 'string' ? u.restaurantId : u.restaurantId?._id || u.restaurantId?.id
    return uRId === selectedVenueId.value && u.isActive !== false
  }).length
})

// ── Filtered Live Orders ──────────────────────────────────────────────────────
const liveOrdersList = computed(() => {
  let list = allOrders.value.filter(o => {
    if (selectedVenueId.value !== 'ALL' && o.restaurantId !== selectedVenueId.value) return false
    return true
  })

  if (statusFilter.value !== 'ALL') {
    list = list.filter(o => (o.status || '').toUpperCase() === statusFilter.value)
  }

  if (feedSearch.value.trim()) {
    const q = feedSearch.value.toLowerCase().trim()
    list = list.filter(o => {
      const rest = String(o.restaurantName || '').toLowerCase()
      const tbl = String(o.tableNumber || '')
      const guest = String(o.customerName || '').toLowerCase()
      const itemMatch = (o.items || []).some((it: any) => (it.name || '').toLowerCase().includes(q))
      return rest.includes(q) || tbl.includes(q) || guest.includes(q) || itemMatch
    })
  }

  return list
})

// ── Filtered Settlements ──────────────────────────────────────────────────────
const recentSettlementsList = computed(() => {
  let list = allPayments.value.filter(p => {
    if (selectedVenueId.value !== 'ALL' && p.restaurantId !== selectedVenueId.value) return false
    return p.status === 'COMPLETED'
  })

  if (feedSearch.value.trim()) {
    const q = feedSearch.value.toLowerCase().trim()
    list = list.filter(p => {
      const rest = String(p.restaurantName || '').toLowerCase()
      const method = String(p.paymentMethod || '').toLowerCase()
      const tx = String(p.transactionId || '').toLowerCase()
      return rest.includes(q) || method.includes(q) || tx.includes(q)
    })
  }

  return list
})

// ── Jump / Inspect Portal Launcher ───────────────────────────────────────────
function inspectVenue(r: any) {
  const rId = r.id || r._id
  if (!rId) return
  auth.setInspectedRestaurant(rId)
  toast.success(`Switched to ${r.name}. Viewing as Restaurant Admin.`)
  router.push('/restaurant/dashboard')
}

function timeSince(dateStr: string) {
  if (!dateStr) return 'Just now'
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (diff < 60) return `${diff}s ago`
  const m = Math.floor(diff / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  return `${h}h ago`
}

function formatCurrency(n: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)
}
</script>

<template>
  <RoleLayout role="main_admin" :nav="adminNav">
    <!-- Executive Command Center Header -->
    <PageHeader
      title="Admin Command Center"
      subtitle="Real-time multi-branch operations, live kitchen & dining stream, and platform health."
    >
      <template #action>
        <div class="flex items-center gap-2 flex-wrap">
          <!-- Venue Filter Dropdown -->
          <div class="relative">
            <select
              v-model="selectedVenueId"
              class="h-9 pl-3 pr-8 rounded-xl border border-border bg-card text-xs font-bold text-foreground focus:outline-none focus:ring-1 focus:ring-primary shadow-2xs appearance-none cursor-pointer"
            >
              <option value="ALL">All Restaurant Branches ({{ restaurants.length }})</option>
              <option v-for="r in restaurants" :key="r.id" :value="r.id">
                {{ r.name }} ({{ r.city }})
              </option>
            </select>
            <ChevronDown class="h-3.5 w-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          </div>

          <!-- Manual Refresh Button -->
          <Button
            variant="outline"
            size="sm"
            class="h-9 px-3 text-xs font-semibold gap-1.5 rounded-xl shadow-2xs cursor-pointer"
            @click="loadNetworkData(false)"
            :disabled="syncing"
          >
            <RefreshCw :class="['h-3.5 w-3.5 text-primary', syncing && 'animate-spin']" />
            <span class="hidden sm:inline">Sync Now</span>
          </Button>

          <!-- Live Pulse Toggle -->
          <button
            @click="autoSync = !autoSync"
            :class="[
              'h-9 px-3 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition shadow-2xs cursor-pointer',
              autoSync
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25'
                : 'bg-muted text-muted-foreground border-border'
            ]"
            :title="autoSync ? 'Auto-sync active every 10s' : 'Auto-sync paused'"
          >
            <span :class="['h-2 w-2 rounded-full', autoSync ? 'bg-emerald-500 animate-pulse' : 'bg-muted-foreground']" />
            <span>{{ autoSync ? 'Live Sync' : 'Paused' }}</span>
          </button>
        </div>
      </template>
    </PageHeader>

    <!-- ── 1. REAL-TIME PLATFORM KPI GRID ───────────────────────────────────── -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-3.5 mb-5">
      <StatCard
        label="Today's Revenue"
        :value="formatCurrency(todayRevenueMetric)"
        :delta="`${todayOrdersCount} orders placed today`"
        :icon="DollarSign"
        tone="success"
      />
      <StatCard
        label="Live Active Orders"
        :value="liveActiveOrdersCount.toString()"
        delta="Cooking & dining right now"
        :icon="ShoppingBag"
        tone="primary"
      />
      <StatCard
        :label="selectedVenueId === 'ALL' ? 'Connected Branches' : 'Venue Status'"
        :value="selectedVenueId === 'ALL' ? restaurants.length.toString() : 'Active'"
        :delta="selectedVenueId === 'ALL' ? '100% Operational' : (selectedRestaurantObj?.city || 'Main Branch')"
        :icon="Building2"
        tone="info"
      />
      <StatCard
        label="Active Staff"
        :value="activeStaffCount.toString()"
        :delta="selectedVenueId === 'ALL' ? 'Across all venues' : 'Assigned to venue'"
        :icon="Users"
        tone="warning"
      />
    </div>

    <!-- ── 2. QUICK ACTION LAUNCHPAD (Executive Shortcuts) ──────────────────── -->
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
      <router-link
        to="/admin/restaurants"
        class="p-3.5 rounded-2xl bg-card border border-border hover:border-primary/50 hover:bg-primary/5 transition flex items-center justify-between gap-2 group shadow-2xs cursor-pointer"
      >
        <div class="flex items-center gap-2.5 min-w-0">
          <div class="h-9 w-9 rounded-xl gradient-primary text-primary-foreground flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition">
            <Building2 class="h-4.5 w-4.5" />
          </div>
          <div class="min-w-0">
            <div class="font-bold text-xs text-foreground group-hover:text-primary transition truncate">Manage Venues</div>
            <div class="text-[10.5px] text-muted-foreground truncate">{{ restaurants.length }} Connected</div>
          </div>
        </div>
        <ChevronRight class="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition shrink-0" />
      </router-link>

      <router-link
        to="/admin/users"
        class="p-3.5 rounded-2xl bg-card border border-border hover:border-emerald-500/50 hover:bg-emerald-500/5 transition flex items-center justify-between gap-2 group shadow-2xs cursor-pointer"
      >
        <div class="flex items-center gap-2.5 min-w-0">
          <div class="h-9 w-9 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition">
            <Users class="h-4.5 w-4.5" />
          </div>
          <div class="min-w-0">
            <div class="font-bold text-xs text-foreground group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition truncate">Staff &amp; Users</div>
            <div class="text-[10.5px] text-muted-foreground truncate">{{ allUsers.length }} Registered</div>
          </div>
        </div>
        <ChevronRight class="h-4 w-4 text-muted-foreground group-hover:text-emerald-500 group-hover:translate-x-0.5 transition shrink-0" />
      </router-link>

      <router-link
        to="/restaurant/reports"
        class="p-3.5 rounded-2xl bg-card border border-border hover:border-amber-500/50 hover:bg-amber-500/5 transition flex items-center justify-between gap-2 group shadow-2xs cursor-pointer"
      >
        <div class="flex items-center gap-2.5 min-w-0">
          <div class="h-9 w-9 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition">
            <TrendingUp class="h-4.5 w-4.5" />
          </div>
          <div class="min-w-0">
            <div class="font-bold text-xs text-foreground group-hover:text-amber-600 dark:group-hover:text-amber-400 transition truncate">Financial Reports</div>
            <div class="text-[10.5px] text-muted-foreground truncate">Detailed Sales</div>
          </div>
        </div>
        <ChevronRight class="h-4 w-4 text-muted-foreground group-hover:text-amber-500 group-hover:translate-x-0.5 transition shrink-0" />
      </router-link>

      <router-link
        to="/admin/logs"
        class="p-3.5 rounded-2xl bg-card border border-border hover:border-purple-500/50 hover:bg-purple-500/5 transition flex items-center justify-between gap-2 group shadow-2xs cursor-pointer"
      >
        <div class="flex items-center gap-2.5 min-w-0">
          <div class="h-9 w-9 rounded-xl bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/30 flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition">
            <FileText class="h-4.5 w-4.5" />
          </div>
          <div class="min-w-0">
            <div class="font-bold text-xs text-foreground group-hover:text-purple-600 dark:group-hover:text-purple-400 transition truncate">Audit &amp; Logs</div>
            <div class="text-[10.5px] text-muted-foreground truncate">System History</div>
          </div>
        </div>
        <ChevronRight class="h-4 w-4 text-muted-foreground group-hover:text-purple-500 group-hover:translate-x-0.5 transition shrink-0" />
      </router-link>
    </div>

    <!-- ── 3. CONNECTED RESTAURANT BRANCHES OVERVIEW (Interactive Cards Grid) ─ -->
    <div class="mb-6">
      <div class="flex items-center justify-between mb-3">
        <div>
          <h2 class="font-display font-bold text-base text-foreground flex items-center gap-2">
            <Building2 class="h-4 w-4 text-primary" /> Branch Operations Hub
          </h2>
          <p class="text-[11px] text-muted-foreground">Live operational status and 1-tap portal access per restaurant</p>
        </div>
        <router-link
          to="/admin/restaurants"
          class="text-xs text-primary font-bold hover:underline flex items-center gap-1"
        >
          <span>All Restaurants</span>
          <ArrowRight class="h-3 w-3" />
        </router-link>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div
          v-for="r in restaurants"
          :key="r.id"
          class="p-4 rounded-2xl bg-card border border-border/80 shadow-soft hover:border-primary/40 transition-all flex flex-col justify-between gap-3 group"
        >
          <!-- Top: Avatar + Name + Status -->
          <div class="flex items-start justify-between gap-2">
            <div class="flex items-center gap-2.5 min-w-0">
              <div class="h-10 w-10 rounded-xl gradient-primary text-primary-foreground flex items-center justify-center font-black text-sm shadow-xs shrink-0 group-hover:scale-105 transition">
                {{ r.name.charAt(0) }}
              </div>
              <div class="min-w-0">
                <h3 class="font-bold text-xs sm:text-sm text-foreground truncate" :title="r.name">
                  {{ r.name }}
                </h3>
                <div class="flex items-center gap-1 text-[11px] text-muted-foreground truncate mt-0.5">
                  <MapPin class="h-3 w-3 text-primary shrink-0" />
                  <span class="truncate">{{ r.city }}</span>
                </div>
              </div>
            </div>

            <Badge
              v-if="r.status === 'ACTIVE'"
              class="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-[9.5px] font-bold px-1.5 py-0 h-4 gap-1 shrink-0"
            >
              <span class="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Active
            </Badge>
            <Badge
              v-else
              class="bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20 text-[9.5px] font-bold px-1.5 py-0 h-4 gap-1 shrink-0"
            >
              <Lock class="h-2.5 w-2.5" /> Inactive
            </Badge>
          </div>

          <!-- Mid: Quick Metric Chips -->
          <div class="grid grid-cols-3 gap-1 p-2 rounded-xl bg-muted/40 text-[10.5px]">
            <div class="text-center">
              <span class="text-[9px] uppercase font-bold text-muted-foreground block">Tables</span>
              <span class="font-extrabold text-foreground">{{ r.maxTables || 20 }}</span>
            </div>
            <div class="text-center border-x border-border/60">
              <span class="text-[9px] uppercase font-bold text-muted-foreground block">Active</span>
              <span class="font-extrabold text-primary">{{ r.activeOrdersCount }} Cooking</span>
            </div>
            <div class="text-center">
              <span class="text-[9px] uppercase font-bold text-muted-foreground block">Today</span>
              <span class="font-extrabold text-emerald-600 dark:text-emerald-400">₹{{ r.todayRevenue.toFixed(0) }}</span>
            </div>
          </div>

          <!-- Bottom: Inspect Portal Button -->
          <Button
            size="sm"
            class="w-full h-8.5 rounded-xl gradient-primary text-primary-foreground font-bold text-xs shadow-2xs gap-1.5 active:scale-95 transition cursor-pointer"
            @click="inspectVenue(r)"
          >
            <Eye class="h-3.5 w-3.5" />
            <span>Inspect Portal</span>
          </Button>
        </div>
      </div>
    </div>

    <!-- ── 4. REAL-TIME ACTIVITY & LIVE ORDER STREAM ───────────────────────── -->
    <div class="rounded-2xl bg-card border border-border shadow-soft overflow-hidden">
      <!-- Activity Feed Header & Filters -->
      <div class="p-3.5 sm:p-4 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-muted/20">
        <!-- Feed Tab Switcher -->
        <div class="flex items-center gap-1 bg-muted/50 p-1 rounded-xl border border-border text-xs font-bold shrink-0">
          <button
            @click="activeFeedTab = 'live_orders'"
            :class="[
              'px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5',
              activeFeedTab === 'live_orders' ? 'bg-card text-foreground shadow-2xs' : 'text-muted-foreground hover:text-foreground'
            ]"
          >
            <Activity class="h-3.5 w-3.5 text-primary" />
            <span>Live Orders</span>
            <span class="px-1.5 py-0.2 rounded-full bg-primary/10 text-primary text-[10px] font-extrabold">
              {{ liveOrdersList.length }}
            </span>
          </button>

          <button
            @click="activeFeedTab = 'settlements'"
            :class="[
              'px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5',
              activeFeedTab === 'settlements' ? 'bg-card text-foreground shadow-2xs' : 'text-muted-foreground hover:text-foreground'
            ]"
          >
            <Receipt class="h-3.5 w-3.5 text-emerald-500" />
            <span>Recent Payments</span>
            <span class="px-1.5 py-0.2 rounded-full bg-muted text-muted-foreground text-[10px] font-bold">
              {{ recentSettlementsList.length }}
            </span>
          </button>
        </div>

        <!-- Search & Status Selectors -->
        <div class="flex items-center gap-2 flex-1 max-w-md w-full justify-end">
          <div class="relative flex-1">
            <Search class="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              v-model="feedSearch"
              placeholder="Search table, venue, dishes..."
              class="h-9 pl-9 text-xs bg-background rounded-xl border-border w-full"
            />
          </div>

          <!-- Status Filter for Live Orders -->
          <div v-if="activeFeedTab === 'live_orders'" class="relative shrink-0">
            <select
              v-model="statusFilter"
              class="h-9 pl-2.5 pr-7 rounded-xl border border-border bg-background text-xs font-semibold text-foreground focus:outline-none shadow-2xs appearance-none cursor-pointer"
            >
              <option value="ALL">All Status</option>
              <option value="PENDING">Pending</option>
              <option value="PREPARING">Cooking</option>
              <option value="READY">Ready</option>
              <option value="SERVED">Served</option>
              <option value="COMPLETED">Paid</option>
            </select>
            <ChevronDown class="h-3 w-3 absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          </div>
        </div>
      </div>

      <!-- ── TAB 1: LIVE ORDERS STREAM ── -->
      <div v-if="activeFeedTab === 'live_orders'">
        <div v-if="loading" class="p-12 text-center text-muted-foreground text-xs">
          Loading live orders stream...
        </div>

        <div v-else-if="liveOrdersList.length === 0" class="p-12 text-center text-muted-foreground">
          <UtensilsCrossed class="h-8 w-8 mx-auto mb-2 opacity-30 text-primary" />
          <p class="font-semibold text-sm text-foreground">No matching orders found</p>
          <p class="text-xs text-muted-foreground mt-0.5">Orders placed by waiters will appear here instantly.</p>
        </div>

        <div v-else class="divide-y divide-border/60">
          <div
            v-for="order in liveOrdersList.slice(0, 25)"
            :key="order.id || order._id"
            class="p-3.5 sm:p-4 hover:bg-muted/15 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3"
          >
            <!-- Left: Table & Branch -->
            <div class="flex items-start gap-3 min-w-0 flex-1">
              <div class="h-10 w-10 rounded-2xl bg-muted/50 border border-border flex flex-col items-center justify-center shrink-0">
                <span class="text-[9px] font-bold text-muted-foreground uppercase leading-none">
                  {{ order.orderType === 'PARCEL' || Number(order.tableNumber) === 0 ? 'PK' : 'TBL' }}
                </span>
                <span class="font-display font-black text-sm text-foreground leading-none mt-0.5">
                  {{ order.orderType === 'PARCEL' || Number(order.tableNumber) === 0 ? 'P' : order.tableNumber }}
                </span>
              </div>

              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-2 flex-wrap">
                  <span class="font-bold text-xs sm:text-sm text-foreground">
                    {{ order.restaurantName }}
                  </span>
                  <Badge variant="outline" class="text-[9.5px] px-1.5 py-0 h-4 bg-muted">
                    {{ order.orderType === 'PARCEL' || Number(order.tableNumber) === 0 ? `Parcel (${order.customerName || 'Takeaway'})` : `Table ${order.tableNumber}` }}
                  </Badge>
                  <span :class="['text-[9.5px] font-bold px-1.5 py-0 rounded border', getStatusBadge(order.status).class]">
                    {{ getStatusBadge(order.status).label }}
                  </span>
                </div>

                <!-- Consolidated Dishes Snippet -->
                <div class="text-xs text-muted-foreground mt-1 truncate">
                  {{ consolidateOrderItems(order.items).map((i: any) => `${i.qty}× ${i.name}`).join(', ') || 'No items' }}
                </div>
              </div>
            </div>

            <!-- Right: Price & Time Elapsed -->
            <div class="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-1 sm:pt-0 border-t sm:border-0 border-border/40">
              <div class="text-right">
                <div class="font-display font-extrabold text-sm text-foreground tabular-nums">
                  ₹{{ Number(order.totalAmount || 0).toFixed(0) }}
                </div>
                <div class="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                  <Clock class="h-3 w-3 text-amber-500" />
                  <span>{{ timeSince(order.createdAt) }}</span>
                </div>
              </div>

              <Button
                size="sm"
                variant="outline"
                class="h-8 px-2.5 text-xs font-semibold rounded-xl hover:border-primary/40 hover:text-primary cursor-pointer"
                @click="inspectVenue({ id: order.restaurantId, name: order.restaurantName })"
              >
                <ArrowUpRight class="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      <!-- ── TAB 2: RECENT SETTLEMENTS ── -->
      <div v-else-if="activeFeedTab === 'settlements'">
        <div v-if="recentSettlementsList.length === 0" class="p-12 text-center text-muted-foreground">
          <Receipt class="h-8 w-8 mx-auto mb-2 opacity-30 text-emerald-500" />
          <p class="font-semibold text-sm text-foreground">No recent payment settlements</p>
        </div>

        <div v-else class="divide-y divide-border/60">
          <div
            v-for="p in recentSettlementsList.slice(0, 25)"
            :key="p.id || p._id"
            class="p-3.5 sm:p-4 hover:bg-muted/15 transition flex items-center justify-between gap-3"
          >
            <div class="flex items-center gap-3 min-w-0">
              <div class="h-9 w-9 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center justify-center shrink-0 font-bold">
                ₹
              </div>
              <div class="min-w-0">
                <div class="flex items-center gap-2">
                  <span class="font-bold text-xs sm:text-sm text-foreground">{{ p.restaurantName }}</span>
                  <Badge class="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[9.5px] font-bold px-1.5 py-0">
                    PAID
                  </Badge>
                </div>
                <div class="text-[11px] text-muted-foreground mt-0.5">
                  Method: <strong class="text-foreground">{{ p.paymentMethod || 'CASH' }}</strong> · Tx: {{ p.transactionId ? String(p.transactionId).slice(-6) : 'Cash Settle' }}
                </div>
              </div>
            </div>

            <div class="text-right shrink-0">
              <div class="font-display font-bold text-sm text-emerald-600 dark:text-emerald-400 tabular-nums">
                +₹{{ Number(p.totalAmount || 0).toFixed(0) }}
              </div>
              <div class="text-[10px] text-muted-foreground mt-0.5">
                {{ timeSince(p.paidAt || p.createdAt) }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ── 5. PLATFORM SYSTEM HEALTH BANNER ─────────────────────────────────── -->
    <div class="mt-5 p-4 rounded-2xl bg-card border border-border shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
      <div class="flex items-center gap-3">
        <div class="h-8 w-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
          <Server class="h-4 w-4" />
        </div>
        <div>
          <div class="font-bold text-foreground flex items-center gap-2">
            <span>DawatDesk Platform Core</span>
            <Badge variant="outline" class="text-[9.5px] font-bold bg-emerald-500/10 text-emerald-600 border-emerald-500/30">v2.4 Online</Badge>
          </div>
          <p class="text-[11px] text-muted-foreground mt-0.5">Multi-tenant sync active · API latency normal (&lt;45ms)</p>
        </div>
      </div>

      <div class="flex items-center gap-2 shrink-0">
        <span class="text-muted-foreground text-[11px]">System Status:</span>
        <span class="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 text-[11px]">
          <CheckCircle2 class="h-3.5 w-3.5" /> 100% Operational
        </span>
      </div>
    </div>
  </RoleLayout>
</template>
