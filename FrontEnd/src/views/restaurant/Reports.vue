<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import {
  BarChart3, Calendar, CheckCircle2, ChevronRight, Clock, Clock3,
  CreditCard, DollarSign, Download, FileSpreadsheet, FileText,
  Filter, HelpCircle, IndianRupee, Layers, PieChart, Printer,
  RefreshCw, Search, ShoppingBag, Table2, TrendingDown,
  TrendingUp, User, Users, Utensils, UtensilsCrossed, Wallet, X,
  Building2, ChevronDown, Receipt, Percent
} from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import RoleLayout from '@/components/RoleLayout.vue'
import PageHeader from '@/components/PageHeader.vue'
import StatCard from '@/components/StatCard.vue'
import Button from '@/components/ui/Button.vue'
import Input from '@/components/ui/Input.vue'
import Badge from '@/components/ui/Badge.vue'
import { restaurantNav, adminNav } from '@/lib/nav'
import { getOrders, getPayments, getRestaurantById, getUsersByRestaurant, getRestaurants, getAllUsers } from '@/lib/api'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const loading = ref(true)
const orders = ref<any[]>([])
const payments = ref<any[]>([])
const staffList = ref<any[]>([])
const restaurant = ref<any>(null)
const restaurants = ref<any[]>([])
const selectedRestaurantId = ref<string>('ALL')

// Date Range filter
type DateRange = 'today' | 'yesterday' | '7days' | 'month' | 'last_month' | 'custom_month' | 'all'
const selectedRange = ref<DateRange>('month')

// Custom Month Picker (Default to current YYYY-MM)
const now = new Date()
const selectedMonthStr = ref<string>(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`)

// Search & Payment Method filter
const searchQuery = ref('')
const selectedPaymentMethod = ref('ALL')
const selectedStatus = ref('ALL')

// Transaction details modal
const selectedTransaction = ref<any | null>(null)
const isModalOpen = ref(false)

const isMainAdmin = computed(() => auth.user?.role?.toLowerCase() === 'main_admin')

const currentNav = computed(() => {
  return isMainAdmin.value && !auth.inspectedRestaurantId ? adminNav : restaurantNav
})

const currentRole = computed(() => {
  return (auth.user?.role?.toLowerCase() as any) || 'restaurant_admin'
})

async function fetchAnalyticsData() {
  loading.value = true
  const resId = auth.effectiveRestaurantId

  try {
    if (isMainAdmin.value) {
      const restRes = await getRestaurants()
      restaurants.value = restRes.data || []
      
      const targetVenues = selectedRestaurantId.value === 'ALL' 
        ? restaurants.value 
        : restaurants.value.filter(r => (r._id || r.id) === selectedRestaurantId.value)

      const ordersAcc: any[] = []
      const paymentsAcc: any[] = []

      await Promise.all(
        targetVenues.map(async (r: any) => {
          const rId = r._id || r.id
          try {
            const [oRes, pRes] = await Promise.all([
              getOrders(rId, 1, 500).catch(() => ({ data: [] })),
              getPayments(rId, 1, 500).catch(() => ({ data: [] }))
            ])
            const rOrders = (oRes.data || []).map((o: any) => ({ ...o, restaurantName: r.name, restaurantId: rId }))
            const rPayments = (pRes.data || []).map((p: any) => ({ ...p, restaurantName: r.name, restaurantId: rId }))
            ordersAcc.push(...rOrders)
            paymentsAcc.push(...rPayments)
          } catch {
            // ignore
          }
        })
      )

      orders.value = ordersAcc
      payments.value = paymentsAcc

      const usersRes = await getAllUsers(1, 1000).catch(() => ({ data: [] }))
      staffList.value = usersRes.data || []

      if (selectedRestaurantId.value !== 'ALL') {
        restaurant.value = restaurants.value.find(r => (r._id || r.id) === selectedRestaurantId.value)
      } else {
        restaurant.value = null
      }
    } else {
      if (!resId) {
        loading.value = false
        return
      }
      const [ordRes, payRes, staffRes, restRes] = await Promise.all([
        getOrders(resId, 1, 500),
        getPayments(resId, 1, 500),
        getUsersByRestaurant(resId, 1, 100).catch(() => ({ data: [] })),
        getRestaurantById(resId).catch(() => ({ data: null }))
      ])

      orders.value = ordRes.data || []
      payments.value = payRes.data || []
      staffList.value = staffRes.data || []
      restaurant.value = restRes.data
    }
  } catch (err: any) {
    console.error('Failed to load analytics data', err)
    toast.error('Failed to load analytics data.')
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  fetchAnalyticsData()
})

watch(selectedRestaurantId, () => {
  fetchAnalyticsData()
})

// Helper: Filter records based on selected date range / month-wise
function isWithinRange(dateStr: string) {
  if (!dateStr) return false
  if (selectedRange.value === 'all') return true

  const d = new Date(dateStr)
  const currentNow = new Date()
  const todayStart = new Date(currentNow.getFullYear(), currentNow.getMonth(), currentNow.getDate()).getTime()

  if (selectedRange.value === 'today') {
    return d.getTime() >= todayStart
  }
  if (selectedRange.value === 'yesterday') {
    const yesterdayStart = todayStart - 24 * 60 * 60 * 1000
    return d.getTime() >= yesterdayStart && d.getTime() < todayStart
  }
  if (selectedRange.value === '7days') {
    const sevenDaysAgo = todayStart - 7 * 24 * 60 * 60 * 1000
    return d.getTime() >= sevenDaysAgo
  }
  if (selectedRange.value === 'month') {
    // Current Month (1st of this month to end of this month)
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

// Month Display Label
const activePeriodLabel = computed(() => {
  if (selectedRange.value === 'today') return 'Today'
  if (selectedRange.value === 'yesterday') return 'Yesterday'
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


// Filtered Datasets
const filteredPayments = computed(() => {
  return payments.value.filter(p => {
    const dateMatches = isWithinRange(p.paidAt || p.createdAt)
    const methodMatches = selectedPaymentMethod.value === 'ALL' || p.paymentMethod === selectedPaymentMethod.value
    const statusMatches = selectedStatus.value === 'ALL' || p.status === selectedStatus.value

    if (!dateMatches || !methodMatches || !statusMatches) return false

    const q = searchQuery.value.trim().toLowerCase()
    if (!q) return true

    const receipt = (p.receiptNumber || '').toLowerCase()
    const pMethod = (p.paymentMethod || '').toLowerCase()
    const cashier = (p.createdBy?.name || '').toLowerCase()
    const orderId = (typeof p.orderId === 'object' ? (p.orderId?.id || p.orderId?._id) : p.orderId || '').toLowerCase()
    const tableNum = String(p.orderId?.tableNumber || p.orderId?.table || '')

    return receipt.includes(q) || pMethod.includes(q) || cashier.includes(q) || orderId.includes(q) || tableNum.includes(q)
  })
})

const filteredOrders = computed(() => {
  return orders.value.filter(o => {
    const dateMatches = isWithinRange(o.createdAt)
    const statusMatches = selectedStatus.value === 'ALL' || o.status === selectedStatus.value

    if (!dateMatches || !statusMatches) return false

    const q = searchQuery.value.trim().toLowerCase()
    if (!q) return true

    const id = String(o.id || o._id).toLowerCase()
    const table = String(o.tableNumber || o.table).toLowerCase()
    const waiter = (o.createdBy?.name || '').toLowerCase()
    const itemsMatch = o.items?.some((i: any) => (i.name || '').toLowerCase().includes(q))

    return id.includes(q) || table.includes(q) || waiter.includes(q) || itemsMatch
  })
})

// KPI Calculations
const totalGrossRevenue = computed(() => {
  return filteredPayments.value
    .filter(p => p.status === 'COMPLETED')
    .reduce((sum, p) => sum + (p.totalAmount || 0), 0)
})

const totalDiscountGiven = computed(() => {
  return filteredPayments.value
    .filter(p => p.status === 'COMPLETED')
    .reduce((sum, p) => sum + (p.discount || 0), 0)
})

const totalGstCollected = computed(() => {
  return filteredPayments.value
    .filter(p => p.status === 'COMPLETED')
    .reduce((sum, p) => {
      const explicitGst = Number(p.gstAmount) || Number(p.tax)
      if (explicitGst > 0) return sum + explicitGst

      const sub = Number(p.subtotal) || 0
      const rate = Number(p.gstPercentage) || Number(restaurant.value?.gstPercentage) || 5
      if (sub > 0) {
        return sum + (sub * (rate / 100))
      }

      const total = Number(p.totalAmount) || 0
      if (total > 0) {
        return sum + (total * (rate / (100 + rate)))
      }
      return sum
    }, 0)
})

const totalCompletedOrders = computed(() => {
  return filteredOrders.value.filter(o => o.status === 'COMPLETED').length
})

const averageOrderValue = computed(() => {
  const completedCount = filteredPayments.value.filter(p => p.status === 'COMPLETED').length
  if (completedCount === 0) return 0
  return totalGrossRevenue.value / completedCount
})

const averagePrepTimeMinutes = computed(() => {
  const completedWithTimes = filteredOrders.value.filter(o => o.status === 'COMPLETED' && o.servedAt && o.createdAt)
  if (completedWithTimes.length === 0) return 11
  const sumDiffs = completedWithTimes.reduce((sum, o) => {
    const diff = new Date(o.servedAt).getTime() - new Date(o.createdAt).getTime()
    return sum + Math.max(0, diff)
  }, 0)
  return Math.round(sumDiffs / completedWithTimes.length / 60000)
})

const tableOccupancy = computed(() => {
  const activeOrders = orders.value.filter(o => ['PENDING', 'PREPARING', 'READY', 'SERVED'].includes(o.status))
  const occupiedSet = new Set(activeOrders.map(o => o.tableNumber || o.table))
  const max = restaurant.value?.maxTables || 20
  return {
    occupied: occupiedSet.size,
    total: max,
    percent: Math.round((occupiedSet.size / (max || 1)) * 100)
  }
})

// Top Selling Dishes
const topSellingDishes = computed(() => {
  const itemMap: Record<string, { name: string; qty: number; revenue: number; category: string }> = {}

  filteredOrders.value.forEach(o => {
    if (o.items && o.status !== 'CANCELLED') {
      o.items.forEach((item: any) => {
        const name = item.name || 'Dish'
        if (!itemMap[name]) {
          itemMap[name] = {
            name,
            qty: 0,
            revenue: 0,
            category: item.category || 'Food'
          }
        }
        const quantity = item.quantity || item.qty || 1
        const price = item.price || 0
        itemMap[name].qty += quantity
        itemMap[name].revenue += (price * quantity)
      })
    }
  })

  return Object.values(itemMap)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 6)
})

// Payment Method Distribution
const paymentMethodBreakdown = computed(() => {
  let cash = 0, card = 0, wallet = 0
  const completed = filteredPayments.value.filter(p => p.status === 'COMPLETED')
  completed.forEach(p => {
    if (p.paymentMethod === 'CASH') cash += p.totalAmount || 0
    else if (p.paymentMethod === 'CARD') card += p.totalAmount || 0
    else wallet += p.totalAmount || 0
  })

  const total = (cash + card + wallet) || 1
  return [
    { name: 'Card / POS', amount: card, percent: Math.round((card / total) * 100), color: '#3b82f6' },
    { name: 'Cash Register', amount: cash, percent: Math.round((cash / total) * 100), color: '#10b981' },
    { name: 'UPI / Digital', amount: wallet, percent: Math.round((wallet / total) * 100), color: '#8b5cf6' }
  ]
})

// Category Breakdown
const categoryBreakdown = computed(() => {
  const catMap: Record<string, { name: string; revenue: number; count: number }> = {}

  filteredOrders.value.forEach(o => {
    if (o.items && o.status !== 'CANCELLED') {
      o.items.forEach((item: any) => {
        const catName = item.category || 'General'
        if (!catMap[catName]) {
          catMap[catName] = { name: catName, revenue: 0, count: 0 }
        }
        const qty = item.quantity || item.qty || 1
        const price = item.price || 0
        catMap[catName].count += qty
        catMap[catName].revenue += price * qty
      })
    }
  })

  return Object.values(catMap).sort((a, b) => b.revenue - a.revenue)
})

// Server & Staff Productivity
const staffPerformance = computed(() => {
  const stats: Record<string, { name: string; email: string; role: string; ordersHandled: number; revenue: number }> = {}

  filteredOrders.value.forEach(o => {
    const creator = typeof o.createdBy === 'object' ? o.createdBy : null
    const name = creator?.name || 'Staff'
    const email = creator?.email || 'N/A'
    const role = creator?.role || 'WAITER'
    const id = creator?._id || creator?.id || name

    if (!stats[id]) {
      stats[id] = { name, email, role, ordersHandled: 0, revenue: 0 }
    }
    stats[id].ordersHandled++
    if (o.status === 'COMPLETED') {
      stats[id].revenue += o.totalAmount || 0
    }
  })

  return Object.values(stats).sort((a, b) => b.ordersHandled - a.ordersHandled)
})

// ── Dynamic Trend Aggregation (Real Month-wise & Daily Breakdown) ──────────
const dynamicTrendData = computed(() => {
  const completed = filteredPayments.value.filter(p => p.status === 'COMPLETED')

  if (selectedRange.value === 'today' || selectedRange.value === 'yesterday') {
    const slots = [
      { label: '8 AM', startHr: 8, endHr: 10 },
      { label: '10 AM', startHr: 10, endHr: 12 },
      { label: '12 PM', startHr: 12, endHr: 14 },
      { label: '2 PM', startHr: 14, endHr: 16 },
      { label: '4 PM', startHr: 16, endHr: 18 },
      { label: '6 PM', startHr: 18, endHr: 20 },
      { label: '8 PM', startHr: 20, endHr: 22 },
      { label: '10 PM+', startHr: 22, endHr: 24 }
    ]

    const categories = slots.map(s => s.label)
    const revenues = slots.map(slot => {
      const slotSum = completed.reduce((sum, p) => {
        const d = new Date(p.paidAt || p.createdAt)
        const hr = d.getHours()
        if (hr >= slot.startHr && hr < slot.endHr) {
          return sum + (p.totalAmount || 0)
        }
        return sum
      }, 0)
      return Math.round(slotSum * 100) / 100
    })

    return { categories, revenues }
  }

  if (selectedRange.value === '7days') {
    const days: string[] = []
    const revenues: number[] = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const dayLabel = d.toLocaleDateString('en-US', { weekday: 'short', month: 'numeric', day: 'numeric' })
      days.push(dayLabel)

      const start = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
      const end = start + 24 * 60 * 60 * 1000

      const daySum = completed.reduce((sum, p) => {
        const pTime = new Date(p.paidAt || p.createdAt).getTime()
        if (pTime >= start && pTime < end) {
          return sum + (p.totalAmount || 0)
        }
        return sum
      }, 0)
      revenues.push(Math.round(daySum))
    }
    return { categories: days, revenues }
  }

  // Month-wise breakdown: Generates each day of the selected month
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
    const categories: string[] = []
    const revenues: number[] = []

    for (let day = 1; day <= numDays; day++) {
      const dayDate = new Date(targetYear, targetMonth, day)
      const dayStart = new Date(targetYear, targetMonth, day, 0, 0, 0, 0).getTime()
      const dayEnd = new Date(targetYear, targetMonth, day, 23, 59, 59, 999).getTime()

      categories.push(`${day}`)

      const dayTotal = completed.reduce((sum, p) => {
        const pTime = new Date(p.paidAt || p.createdAt).getTime()
        if (pTime >= dayStart && pTime <= dayEnd) {
          return sum + (p.totalAmount || 0)
        }
        return sum
      }, 0)

      revenues.push(Math.round(dayTotal))
    }

    return { categories, revenues }
  }

  // All Time: Group by past 6-12 Months
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const categories: string[] = []
  const revenues: number[] = []

  for (let i = 5; i >= 0; i--) {
    const d = new Date()
    d.setMonth(d.getMonth() - i)
    const mLabel = `${monthNames[d.getMonth()]} ${d.getFullYear().toString().slice(-2)}`
    categories.push(mLabel)

    const mStart = new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0).getTime()
    const mEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59).getTime()

    const mTotal = completed.reduce((sum, p) => {
      const pTime = new Date(p.paidAt || p.createdAt).getTime()
      if (pTime >= mStart && pTime <= mEnd) {
        return sum + (p.totalAmount || 0)
      }
      return sum
    }, 0)
    revenues.push(Math.round(mTotal))
  }

  return { categories, revenues }
})

// Charts Options & Series
const salesTrendOptions = computed(() => ({
  chart: {
    type: 'area',
    toolbar: { show: false },
    zoom: { enabled: false },
    selection: { enabled: false },
    fontFamily: 'inherit',
    parentHeightOffset: 0
  },
  colors: ['#f97316'],
  stroke: { curve: 'smooth', width: 2.5 },
  fill: {
    type: 'gradient',
    gradient: {
      shadeIntensity: 1,
      opacityFrom: 0.35,
      opacityTo: 0.02,
      stops: [0, 100]
    }
  },
  xaxis: {
    categories: dynamicTrendData.value.categories,
    axisBorder: { show: false },
    axisTicks: { show: false },
    labels: {
      offsetY: 2,
      style: {
        colors: '#94a3b8',
        fontSize: '11px',
        fontWeight: 500
      }
    }
  },
  yaxis: {
    labels: {
      formatter: (val: number) => `₹${Math.round(val).toLocaleString('en-IN')}`,
      style: {
        colors: '#94a3b8',
        fontSize: '11px',
        fontWeight: 500
      }
    }
  },
  dataLabels: { enabled: false },
  markers: { size: 0, hover: { size: 4 } },
  grid: {
    strokeDashArray: 3,
    borderColor: 'rgba(148, 163, 184, 0.15)',
    padding: { left: 10, right: 15, bottom: 5, top: 0 }
  },
  states: {
    normal: { filter: { type: 'none' } },
    hover: { filter: { type: 'none' } },
    active: { allowMultipleDataPointsSelection: false, filter: { type: 'none' } }
  },
  tooltip: {
    theme: 'dark',
    x: { show: true },
    y: {
      formatter: (val: number) => `₹${val.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
    }
  }
}))

const salesTrendSeries = computed(() => [{
  name: 'Revenue',
  data: dynamicTrendData.value.revenues
}])

const paymentDonutOptions = computed(() => {
  return {
    chart: {
      type: 'donut',
      toolbar: { show: false },
      selection: { enabled: false },
      fontFamily: 'inherit',
      parentHeightOffset: 0
    },
    labels: paymentMethodBreakdown.value.map(p => p.name),
    colors: ['#3b82f6', '#10b981', '#8b5cf6'],
    dataLabels: { enabled: false },
    plotOptions: {
      pie: {
        expandOnClick: false,
        donut: {
          size: '72%',
          labels: {
            show: true,
            name: {
              show: true,
              fontSize: '12px',
              fontWeight: 600,
              color: '#94a3b8',
              offsetY: -5
            },
            value: {
              show: true,
              fontSize: '18px',
              fontWeight: 700,
              color: 'var(--foreground)',
              offsetY: 4,
              formatter: (val: any) => `₹${Math.round(Number(val)).toLocaleString('en-IN')}`
            },
            total: {
              show: true,
              label: 'Total Billed',
              fontSize: '11px',
              fontWeight: 600,
              color: '#94a3b8',
              formatter: (w: any) => {
                const totals = w?.globals?.seriesTotals
                if (totals && totals.length > 0) {
                  const sum = totals.reduce((a: number, b: number) => a + b, 0)
                  return `₹${Math.round(sum).toLocaleString('en-IN')}`
                }
                const fallback = paymentMethodBreakdown.value.reduce((a, b) => a + (Number(b.amount) || 0), 0)
                return `₹${Math.round(fallback).toLocaleString('en-IN')}`
              }
            }
          }
        }
      }
    },
    stroke: { width: 0 },
    legend: { show: false },
    states: {
      normal: { filter: { type: 'none' } },
      hover: { filter: { type: 'none' } },
      active: { allowMultipleDataPointsSelection: false, filter: { type: 'none' } }
    },
    tooltip: {
      theme: 'dark',
      y: {
        formatter: (val: number) => `₹${Number(val).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
      }
    }
  }
})

const paymentDonutSeries = computed(() => {
  return paymentMethodBreakdown.value.map(p => Number(p.amount) || 0)
})

// Category Bar Chart Options
const categoryBarOptions = computed(() => ({
  chart: {
    type: 'bar',
    toolbar: { show: false },
    zoom: { enabled: false },
    selection: { enabled: false },
    fontFamily: 'inherit',
    parentHeightOffset: 0
  },
  colors: ['#06b6d4', '#3b82f6', '#8b5cf6', '#10b981', '#f59e0b'],
  plotOptions: {
    bar: {
      borderRadius: 6,
      distributed: true,
      horizontal: true,
      barHeight: '55%'
    }
  },
  xaxis: {
    categories: categoryBreakdown.value.slice(0, 5).map(c => c.name),
    labels: {
      formatter: (val: number) => `₹${Math.round(val).toLocaleString('en-IN')}`,
      style: { colors: '#94a3b8', fontSize: '11px', fontWeight: 600 }
    },
    axisBorder: { show: false },
    axisTicks: { show: false }
  },
  yaxis: {
    labels: {
      style: { colors: '#94a3b8', fontSize: '11px', fontWeight: 600 }
    }
  },
  dataLabels: {
    enabled: true,
    formatter: (val: number) => `₹${Math.round(val).toLocaleString('en-IN')}`,
    offsetX: 10,
    style: { fontSize: '10px', fontWeight: 700, colors: ['#ffffff'] }
  },
  grid: {
    strokeDashArray: 4,
    borderColor: 'rgba(148, 163, 184, 0.15)',
    padding: { left: 10, right: 20, bottom: 0, top: 0 }
  },
  legend: { show: false },
  states: {
    normal: { filter: { type: 'none' } },
    hover: { filter: { type: 'none' } },
    active: { allowMultipleDataPointsSelection: false, filter: { type: 'none' } }
  },
  tooltip: {
    theme: 'dark',
    y: {
      formatter: (val: number) => `₹${val.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
    }
  }
}))

const categoryBarSeries = computed(() => [{
  name: 'Sales',
  data: categoryBreakdown.value.slice(0, 5).map(c => c.revenue)
}])

// Export Report as CSV
function exportToCSV() {
  try {
    if (filteredPayments.value.length === 0) {
      toast.info('No transactions found to export.')
      return
    }

    const headers = ['Receipt Number', 'Restaurant', 'Table', 'Payment Method', 'Subtotal', 'Discount', 'GST Tax', 'Total Amount', 'Status', 'Date Time']
    const rows = filteredPayments.value.map(p => [
      `"${p.receiptNumber || ''}"`,
      `"${p.restaurantName || restaurant.value?.name || 'Restaurant'}"`,
      `"${p.orderId?.tableNumber || p.orderId?.table || 'N/A'}"`,
      `"${p.paymentMethod || 'CASH'}"`,
      (p.subtotal || 0).toFixed(2),
      (p.discount || 0).toFixed(2),
      (p.tax || 0).toFixed(2),
      (p.totalAmount || 0).toFixed(2),
      `"${p.status || 'COMPLETED'}"`,
      `"${new Date(p.paidAt || p.createdAt).toLocaleString()}"`
    ])

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `Analytics_Report_${activePeriodLabel.value.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast.success('Analytics CSV report exported successfully!')
  } catch (err: any) {
    toast.error('Failed to export CSV: ' + err.message)
  }
}

function openTransactionModal(tx: any) {
  selectedTransaction.value = tx
  isModalOpen.value = true
}

function formatCurrency(amount: number) {
  return `₹${(amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatDateTime(dateStr: string) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}
</script>

<template>
  <RoleLayout :role="currentRole" :nav="currentNav">
    <!-- Header with Multi-Venue & Month-Wise Controls -->
    <PageHeader
      :title="isMainAdmin ? 'Analytics & Reports' : 'Restaurant Analytics & Performance'"
      :subtitle="`Financial performance, sales intelligence, and monthly breakdown · ${activePeriodLabel}`"
    >
      <template #action>
        <div class="flex flex-wrap items-center gap-2.5">
          <!-- Restaurant Selector (for Main Admin) -->
          <div v-if="isMainAdmin" class="relative">
            <select
              v-model="selectedRestaurantId"
              class="h-8.5 pl-3 pr-8 text-xs font-semibold rounded-lg bg-card border border-border text-foreground hover:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary shadow-2xs cursor-pointer appearance-none transition"
            >
              <option value="ALL">All Restaurants (Network Aggregate)</option>
              <option v-for="r in restaurants" :key="r._id || r.id" :value="r._id || r.id">
                {{ r.name }} ({{ r.location || r.city || 'Main' }})
              </option>
            </select>
            <ChevronDown class="h-3.5 w-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          </div>

          <!-- Date / Month Range Selector -->
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

          <Button variant="outline" size="sm" class="h-8.5 text-xs gap-1.5 cursor-pointer shadow-2xs" @click="fetchAnalyticsData" :disabled="loading">
            <RefreshCw :class="['h-3.5 w-3.5', loading && 'animate-spin text-primary']" />
            <span class="hidden sm:inline">Refresh</span>
          </Button>

          <Button size="sm" class="h-8.5 gap-1.5 text-xs font-semibold shadow-2xs cursor-pointer" @click="exportToCSV">
            <Download class="h-3.5 w-3.5" />
            <span>Export CSV</span>
          </Button>
        </div>
      </template>
    </PageHeader>


    <!-- KPI Metric Summary Grid -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <StatCard
        label="Total Revenue"
        :value="formatCurrency(totalGrossRevenue)"
        :delta="`${filteredPayments.filter(p => p.status === 'COMPLETED').length} settled bills`"
        :icon="DollarSign"
        tone="success"
      />
      <StatCard
        label="Average Order Value"
        :value="formatCurrency(averageOrderValue)"
        :delta="`${totalCompletedOrders} completed orders`"
        :icon="ShoppingBag"
        tone="primary"
      />
      <StatCard
        label="Avg Prep & Serve Time"
        :value="`${averagePrepTimeMinutes} min`"
        delta="Kitchen ticket speed"
        :icon="Clock3"
        tone="warning"
      />
      <StatCard
        label="Floor Occupancy"
        :value="`${tableOccupancy.occupied} / ${tableOccupancy.total}`"
        :delta="`${tableOccupancy.percent}% active tables`"
        :icon="Table2"
        tone="info"
      />
    </div>

    <!-- Additional Financial Highlights -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
      <div class="rounded-xl border border-border bg-card p-3.5 flex items-center gap-3">
        <div class="h-10 w-10 rounded-lg bg-emerald-500/10 text-emerald-600 grid place-items-center">
          <TrendingUp class="h-5 w-5" />
        </div>
        <div>
          <span class="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block">Net Sales</span>
          <span class="text-base font-bold">{{ formatCurrency(totalGrossRevenue - totalGstCollected) }}</span>
        </div>
      </div>

      <div class="rounded-xl border border-border bg-card p-3.5 flex items-center gap-3">
        <div class="h-10 w-10 rounded-lg bg-blue-500/10 text-blue-600 grid place-items-center">
          <Receipt class="h-5 w-5" />
        </div>
        <div>
          <span class="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block">GST Tax Collected</span>
          <span class="text-base font-bold">{{ formatCurrency(totalGstCollected) }}</span>
        </div>
      </div>

      <div class="rounded-xl border border-border bg-card p-3.5 flex items-center gap-3">
        <div class="h-10 w-10 rounded-lg bg-purple-500/10 text-purple-600 grid place-items-center">
          <UtensilsCrossed class="h-5 w-5" />
        </div>
        <div>
          <span class="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block">Total Discounts</span>
          <span class="text-base font-bold">{{ formatCurrency(totalDiscountGiven) }}</span>
        </div>
      </div>

      <div class="rounded-xl border border-border bg-card p-3.5 flex items-center gap-3">
        <div class="h-10 w-10 rounded-lg bg-amber-500/10 text-amber-600 grid place-items-center">
          <Users class="h-5 w-5" />
        </div>
        <div>
          <span class="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block">Active Staff</span>
          <span class="text-base font-bold">{{ staffList.length }} Members</span>
        </div>
      </div>
    </div>

    <!-- Charts & Intelligence Row -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
      <!-- Revenue Trend Chart -->
      <div class="lg:col-span-2 rounded-2xl bg-card border border-border p-5 shadow-soft flex flex-col justify-between">
        <div class="flex items-center justify-between mb-2">
          <div>
            <h3 class="text-base font-bold">Revenue Velocity & Peak Volume</h3>
            <p class="text-xs text-muted-foreground">Dynamic sales distribution across selected timeframe</p>
          </div>
          <Badge variant="outline" class="gap-1.5 text-xs text-primary font-semibold border-primary/30 bg-primary/5">
            <TrendingUp class="h-3.5 w-3.5" /> Live Data
          </Badge>
        </div>
        <div class="pt-2 min-h-[300px] w-full">
          <apexchart type="area" height="290" :options="salesTrendOptions" :series="salesTrendSeries" />
        </div>
      </div>

      <!-- Payment Method Breakdown -->
      <div class="rounded-2xl bg-card border border-border p-5 shadow-soft flex flex-col justify-between">
        <div>
          <h3 class="text-base font-bold mb-1">Settlement Modes</h3>
          <p class="text-xs text-muted-foreground mb-2">Payment volume by tender type</p>
          <div class="min-h-[220px] grid place-items-center">
            <apexchart type="donut" height="220" :options="paymentDonutOptions" :series="paymentDonutSeries" />
          </div>
        </div>

        <div class="space-y-2 mt-3 pt-3 border-t border-border">
          <div
            v-for="method in paymentMethodBreakdown"
            :key="method.name"
            class="flex items-center justify-between text-xs"
          >
            <div class="flex items-center gap-2">
              <span class="h-2.5 w-2.5 rounded-full" :style="{ backgroundColor: method.color }" />
              <span class="font-medium">{{ method.name }}</span>
            </div>
            <div class="flex items-center gap-2 font-semibold">
              <span>{{ formatCurrency(method.amount) }}</span>
              <span class="text-muted-foreground font-mono">({{ method.percent }}%)</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Category Sales Bar Chart & Top Selling Dishes Row -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
      <!-- Sales by Category Chart -->
      <div class="rounded-2xl bg-card border border-border p-5 shadow-soft">
        <div class="flex items-center justify-between mb-3">
          <div>
            <h3 class="text-base font-bold">Category Sales Revenue</h3>
            <p class="text-xs text-muted-foreground">Revenue contribution grouped by menu categories</p>
          </div>
          <Layers class="h-4 w-4 text-muted-foreground" />
        </div>

        <div v-if="categoryBreakdown.length === 0" class="py-14 text-center text-xs text-muted-foreground">
          No category sales recorded for this timeframe.
        </div>
        <div v-else class="min-h-[260px]">
          <apexchart type="bar" height="260" :options="categoryBarOptions" :series="categoryBarSeries" />
        </div>
      </div>

      <!-- Top Selling Dishes -->
      <div class="rounded-2xl bg-card border border-border p-5 shadow-soft flex flex-col justify-between">
        <div>
          <div class="flex items-center justify-between mb-3">
            <div>
              <h3 class="text-base font-bold">Top Performing Menu Items</h3>
              <p class="text-xs text-muted-foreground">Best sellers ranked by total revenue contribution</p>
            </div>
            <Utensils class="h-4 w-4 text-muted-foreground" />
          </div>

          <div v-if="topSellingDishes.length === 0" class="py-14 text-center text-xs text-muted-foreground">
            No dish sales recorded for the selected timeframe.
          </div>
          <div v-else class="space-y-3.5 mt-2">
            <div
              v-for="(dish, idx) in topSellingDishes"
              :key="dish.name"
              class="space-y-1"
            >
              <div class="flex items-center justify-between text-xs">
                <div class="flex items-center gap-2 min-w-0">
                  <span class="font-bold font-mono text-xs text-primary/80">#{{ idx + 1 }}</span>
                  <span class="font-semibold truncate">{{ dish.name }}</span>
                  <Badge variant="secondary" class="text-[10px] px-1.5 py-0">{{ dish.category }}</Badge>
                </div>
                <div class="flex items-center gap-2.5 font-semibold text-xs shrink-0">
                  <span class="text-muted-foreground">{{ dish.qty }} sold</span>
                  <span>{{ formatCurrency(dish.revenue) }}</span>
                </div>
              </div>
              <div class="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                <div
                  class="h-full gradient-primary rounded-full transition-all duration-500"
                  :style="{ width: `${Math.min(100, Math.round((dish.revenue / (topSellingDishes[0]?.revenue || 1)) * 100))}%` }"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Staff Productivity -->
    <div class="rounded-2xl bg-card border border-border p-5 shadow-soft mb-8">
      <div class="flex items-center justify-between mb-4">
        <div>
          <h3 class="text-base font-bold">Staff & Server Productivity</h3>
          <p class="text-xs text-muted-foreground">Fulfillment volume and table order attribution</p>
        </div>
        <Users class="h-4 w-4 text-muted-foreground" />
      </div>

      <div v-if="staffPerformance.length === 0" class="py-10 text-center text-xs text-muted-foreground">
        No staff activity recorded for the selected timeframe.
      </div>
      <div v-else class="overflow-x-auto">
        <table class="w-full text-xs">
          <thead class="bg-muted/40 uppercase tracking-wider text-[10px] text-muted-foreground font-semibold">
            <tr>
              <th class="text-left px-4 py-2.5">Staff Member</th>
              <th class="text-left px-4 py-2.5">Role</th>
              <th class="text-right px-4 py-2.5">Orders Handled</th>
              <th class="text-right px-4 py-2.5">Total Sales Attributed</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-border">
            <tr v-for="s in staffPerformance" :key="s.email" class="hover:bg-muted/20 transition">
              <td class="px-4 py-2.5">
                <div class="font-semibold text-foreground">{{ s.name }}</div>
                <div class="text-[10px] text-muted-foreground truncate">{{ s.email }}</div>
              </td>
              <td class="px-4 py-2.5">
                <Badge variant="outline" class="text-[10px] capitalize">{{ s.role.toLowerCase() }}</Badge>
              </td>
              <td class="px-4 py-2.5 text-right font-bold font-mono">{{ s.ordersHandled }}</td>
              <td class="px-4 py-2.5 text-right font-bold text-emerald-600 dark:text-emerald-400">
                {{ formatCurrency(s.revenue) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Comprehensive Filter & Transactions Log Section -->
    <div class="rounded-2xl bg-card border border-border shadow-soft overflow-hidden mb-10">
      <div class="p-5 border-b border-border space-y-4">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 class="text-base font-bold">Transaction & Audit Records</h3>
            <p class="text-xs text-muted-foreground">Search and audit every settled or active bill in the system</p>
          </div>
          <div class="text-xs font-semibold text-muted-foreground">
            Showing {{ filteredPayments.length }} transaction records
          </div>
        </div>

        <!-- Search and Tender Filter Bar -->
        <div class="flex flex-col md:flex-row gap-3">
          <div class="relative flex-1">
            <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              v-model="searchQuery"
              placeholder="Search by receipt number, table, cashier, waiter..."
              class="pl-9 bg-muted/30 border-input text-sm"
            />
          </div>

          <div class="flex gap-2">
            <select
              v-model="selectedPaymentMethod"
              class="h-9 rounded-lg border border-input bg-card px-3 text-xs font-semibold focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="ALL">All Payment Methods</option>
              <option value="CASH">Cash</option>
              <option value="CARD">Card / Credit</option>
              <option value="DIGITAL_WALLET">UPI / Digital</option>
            </select>

            <select
              v-model="selectedStatus"
              class="h-9 rounded-lg border border-input bg-card px-3 text-xs font-semibold focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="ALL">All Statuses</option>
              <option value="COMPLETED">Completed</option>
              <option value="PENDING">Pending</option>
              <option value="REFUNDED">Refunded</option>
            </select>
          </div>
        </div>
      </div>

      <!-- Transactions Table -->
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
            <tr>
              <th class="text-left px-4 py-3">Receipt ID</th>
              <th class="text-left px-4 py-3">Table</th>
              <th class="text-left px-4 py-3">Payment Method</th>
              <th class="text-right px-4 py-3">Subtotal</th>
              <th class="text-right px-4 py-3">Discount</th>
              <th class="text-right px-4 py-3">Total Billed</th>
              <th class="text-left px-4 py-3">Status</th>
              <th class="text-right px-4 py-3">Timestamp</th>
              <th class="text-right px-4 py-3">Action</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-border">
            <tr v-if="filteredPayments.length === 0">
              <td colspan="9" class="px-4 py-12 text-center text-xs text-muted-foreground">
                No matching transactions found for your query.
              </td>
            </tr>
            <tr
              v-for="tx in filteredPayments"
              :key="tx.id || tx._id"
              class="hover:bg-muted/30 transition cursor-pointer"
              @click="openTransactionModal(tx)"
            >
              <td class="px-4 py-3 font-mono text-xs font-bold text-primary">
                {{ tx.receiptNumber || `BILL-${String(tx.id || tx._id).slice(-6)}` }}
              </td>
              <td class="px-4 py-3 font-semibold">
                Table {{ tx.orderId?.tableNumber || tx.orderId?.table || '—' }}
              </td>
              <td class="px-4 py-3">
                <span class="inline-flex items-center gap-1.5 text-xs font-medium">
                  <CreditCard v-if="tx.paymentMethod === 'CARD'" class="h-3.5 w-3.5 text-blue-500" />
                  <DollarSign v-else-if="tx.paymentMethod === 'CASH'" class="h-3.5 w-3.5 text-emerald-500" />
                  <Wallet v-else class="h-3.5 w-3.5 text-purple-500" />
                  {{ tx.paymentMethod || 'CASH' }}
                </span>
              </td>
              <td class="px-4 py-3 text-right font-mono text-xs text-muted-foreground">
                {{ formatCurrency(tx.subtotal || tx.totalAmount) }}
              </td>
              <td class="px-4 py-3 text-right font-mono text-xs text-muted-foreground">
                {{ tx.discount ? `-${formatCurrency(tx.discount)}` : '—' }}
              </td>
              <td class="px-4 py-3 text-right font-bold text-foreground">
                {{ formatCurrency(tx.totalAmount) }}
              </td>
              <td class="px-4 py-3">
                <Badge
                  :variant="tx.status === 'COMPLETED' ? 'default' : 'outline'"
                  class="rounded-full text-[10px]"
                >
                  {{ tx.status || 'COMPLETED' }}
                </Badge>
              </td>
              <td class="px-4 py-3 text-right text-xs text-muted-foreground tabular-nums">
                {{ formatDateTime(tx.paidAt || tx.createdAt) }}
              </td>
              <td class="px-4 py-3 text-right">
                <Button size="icon" variant="ghost" class="h-7 w-7 rounded-full">
                  <ChevronRight class="h-4 w-4" />
                </Button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Transaction Modal View -->
    <div
      v-if="isModalOpen && selectedTransaction"
      class="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm grid place-items-center p-4 animate-in fade-in"
      @click.self="isModalOpen = false"
    >
      <div class="bg-card border border-border rounded-2xl max-w-md w-full shadow-2xl overflow-hidden p-6 space-y-5">
        <div class="flex items-center justify-between border-b border-border pb-3">
          <div class="flex items-center gap-2">
            <Receipt class="h-5 w-5 text-primary" />
            <h3 class="font-bold text-base">Receipt Overview</h3>
          </div>
          <Button size="icon" variant="ghost" class="h-8 w-8 rounded-full cursor-pointer" @click="isModalOpen = false">
            <X class="h-4 w-4" />
          </Button>
        </div>

        <div class="space-y-3 text-xs">
          <div class="flex justify-between py-1 border-b border-border/50">
            <span class="text-muted-foreground">Receipt Number</span>
            <span class="font-mono font-bold">{{ selectedTransaction.receiptNumber }}</span>
          </div>
          <div class="flex justify-between py-1 border-b border-border/50">
            <span class="text-muted-foreground">Table Assignment</span>
            <span class="font-bold">Table {{ selectedTransaction.orderId?.tableNumber || selectedTransaction.orderId?.table || '—' }}</span>
          </div>
          <div class="flex justify-between py-1 border-b border-border/50">
            <span class="text-muted-foreground">Payment Method</span>
            <span class="font-bold">{{ selectedTransaction.paymentMethod }}</span>
          </div>
          <div class="flex justify-between py-1 border-b border-border/50">
            <span class="text-muted-foreground">Subtotal</span>
            <span>{{ formatCurrency(selectedTransaction.subtotal) }}</span>
          </div>
          <div class="flex justify-between py-1 border-b border-border/50">
            <span class="text-muted-foreground">Discount</span>
            <span>-{{ formatCurrency(selectedTransaction.discount || 0) }}</span>
          </div>
          <div class="flex justify-between py-1 border-b border-border/50">
            <span class="text-muted-foreground">GST Tax</span>
            <span>+{{ formatCurrency(selectedTransaction.tax || 0) }}</span>
          </div>
          <div class="flex justify-between py-2 text-sm font-bold border-t border-border">
            <span>Final Settlement</span>
            <span class="text-emerald-600 dark:text-emerald-400 text-base font-bold">
              {{ formatCurrency(selectedTransaction.totalAmount) }}
            </span>
          </div>
        </div>

        <div class="flex justify-end gap-2 pt-2">
          <Button variant="outline" size="sm" class="cursor-pointer" @click="isModalOpen = false">Close</Button>
        </div>
      </div>
    </div>
  </RoleLayout>
</template>
