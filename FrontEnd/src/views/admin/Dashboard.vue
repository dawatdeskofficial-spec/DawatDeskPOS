<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { Building2, DollarSign, ShoppingBag, Users, MoreHorizontal } from 'lucide-vue-next'
import RoleLayout from '@/components/RoleLayout.vue'
import PageHeader from '@/components/PageHeader.vue'
import StatCard from '@/components/StatCard.vue'
import Badge from '@/components/ui/Badge.vue'
import { adminNav } from '@/lib/nav'
import { getRestaurants, getOrders, getPayments, getAllUsers } from '@/lib/api'

const restaurants = ref<any[]>([])
const totalOrders = ref(0)
const totalRevenue = ref(0)
const activeUsers = ref(0)

const chartData = ref<any[]>([])

const chartDays = computed(() => {
  const days = []
  const weekdayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    days.push({
      dateStr: d.toDateString(),
      dayLabel: weekdayNames[d.getDay()],
      revenue: 0,
      orders: 0
    })
  }
  return days
})

onMounted(async () => {
  try {
    const [restRes, usersRes] = await Promise.all([
      getRestaurants(),
      getAllUsers(1, 1000)
    ])
    
    activeUsers.value = (usersRes.data || []).filter((u: any) => u.isActive).length

    const rawRestaurants = restRes.data || []
    
    const days = chartDays.value
    const allOrdersList: any[] = []
    const allPaymentsList: any[] = []

    const hydratedRestaurants = await Promise.all(
      rawRestaurants.map(async (r: any) => {
        const rId = r._id || r.id
        try {
          const [ordersRes, paymentsRes] = await Promise.all([
            getOrders(rId, 1, 1000),
            getPayments(rId, 1, 1000)
          ])
          
          const ordersCount = (ordersRes.data || []).length
          const completedPayments = (paymentsRes.data || []).filter((p: any) => p.status === 'COMPLETED')
          const revenueSum = completedPayments.reduce((sum: number, p: any) => sum + p.totalAmount, 0)
          
          if (ordersRes.data) allOrdersList.push(...ordersRes.data)
          if (paymentsRes.data) allPaymentsList.push(...paymentsRes.data)

          return {
            ...r,
            id: rId,
            city: r.location || "Unknown",
            orders: ordersCount,
            revenue: revenueSum,
            status: r.status?.toLowerCase() || "active"
          }
        } catch (err) {
          console.error(`Failed to hydrate restaurant ${rId}`, err)
          return {
            ...r,
            id: rId,
            city: r.location || "Unknown",
            orders: 0,
            revenue: 0,
            status: r.status?.toLowerCase() || "active"
          }
        }
      })
    )

    restaurants.value = hydratedRestaurants
    totalOrders.value = hydratedRestaurants.reduce((sum, r) => sum + r.orders, 0)
    totalRevenue.value = hydratedRestaurants.reduce((sum, r) => sum + r.revenue, 0)

    // Compute chart values day by day
    days.forEach(day => {
      const dayStart = new Date(day.dateStr)
      dayStart.setHours(0, 0, 0, 0)
      const dayEnd = new Date(day.dateStr)
      dayEnd.setHours(23, 59, 59, 999)

      const dayPayments = allPaymentsList.filter(p => {
        const pDate = new Date(p.paidAt || p.createdAt)
        return p.status === 'COMPLETED' && pDate >= dayStart && pDate <= dayEnd
      })
      day.revenue = dayPayments.reduce((sum, p) => sum + p.totalAmount, 0)

      const dayOrders = allOrdersList.filter(o => {
        const oDate = new Date(o.createdAt)
        return oDate >= dayStart && oDate <= dayEnd
      })
      day.orders = dayOrders.length
    })

    chartData.value = days
  } catch (e) {
    console.error("Failed to load restaurants", e)
  }
})

const areaOptions = computed(() => ({
  chart: { type: 'area', toolbar: { show: false } },
  stroke: { curve: 'smooth', width: 2.5, colors: ['oklch(0.78 0.16 65)'] },
  fill: { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.5, opacityTo: 0, stops: [0, 100] }, colors: ['oklch(0.78 0.16 65)'] },
  xaxis: { categories: chartData.value.map(d => d.dayLabel), axisBorder: { show: false }, axisTicks: { show: false } },
  yaxis: { show: false },
  dataLabels: { enabled: false },
  grid: { strokeDashArray: 3, borderColor: 'oklch(1 0 0 / 0.06)' },
  tooltip: { theme: 'dark' }
}))

const areaSeries = computed(() => [{ 
  name: 'Revenue', 
  data: chartData.value.map(d => d.revenue) 
}])

const barOptions = computed(() => ({
  chart: { type: 'bar', toolbar: { show: false } },
  colors: ['oklch(0.78 0.16 65)'],
  plotOptions: { bar: { borderRadius: 4 } },
  xaxis: { categories: chartData.value.map(d => d.dayLabel), axisBorder: { show: false }, axisTicks: { show: false } },
  yaxis: { show: false },
  dataLabels: { enabled: false },
  grid: { strokeDashArray: 3, borderColor: 'oklch(1 0 0 / 0.06)' },
  tooltip: { theme: 'dark' }
}))

const barSeries = computed(() => [{ 
  name: 'Orders', 
  data: chartData.value.map(d => d.orders) 
}])
</script>

<template>
  <RoleLayout role="main_admin" :nav="adminNav">
    <PageHeader title="Overview" subtitle="Real-time database aggregated metrics across all Savoria venues." />

    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      <StatCard label="Total Restaurants" :value="restaurants.length.toString()" delta="Active" :icon="Building2" tone="primary" />
      <StatCard label="Total Orders" :value="totalOrders.toLocaleString()" delta="All-time" :icon="ShoppingBag" tone="info" />
      <StatCard label="Revenue" :value="`$${totalRevenue.toFixed(2)}`" delta="All-time" :icon="DollarSign" tone="success" />
      <StatCard label="Active Staff" :value="activeUsers.toString()" delta="Registered staff" :icon="Users" tone="warning" />
    </div>

    <div class="grid lg:grid-cols-3 gap-6 mb-8">
      <div class="lg:col-span-2 rounded-2xl bg-card border border-border p-6 shadow-soft">
        <div class="flex items-center justify-between mb-6">
          <div>
            <h3 class="font-display text-xl font-bold">Revenue trend</h3>
            <p class="text-sm text-muted-foreground">Last 7 days · all venues</p>
          </div>
          <Badge variant="secondary">USD</Badge>
        </div>
        <apexchart type="area" height="280" :options="areaOptions" :series="areaSeries" />
      </div>

      <div class="rounded-2xl bg-card border border-border p-6 shadow-soft">
        <h3 class="font-display text-xl font-bold mb-1">Orders</h3>
        <p class="text-sm text-muted-foreground mb-6">Daily volume</p>
        <apexchart type="bar" height="280" :options="barOptions" :series="barSeries" />
      </div>
    </div>

    <div class="rounded-2xl bg-card border border-border shadow-soft overflow-hidden">
      <div class="p-6 border-b border-border flex items-center justify-between">
        <div>
          <h3 class="font-display text-xl font-bold">Top performing venues</h3>
          <p class="text-sm text-muted-foreground">Ranked by overall database revenue</p>
        </div>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="bg-muted/40 text-muted-foreground text-xs uppercase tracking-wider">
            <tr>
              <th class="text-left px-6 py-3 font-medium">Restaurant</th>
              <th class="text-left px-6 py-3 font-medium">City</th>
              <th class="text-right px-6 py-3 font-medium">Orders</th>
              <th class="text-right px-6 py-3 font-medium">Revenue</th>
              <th class="text-left px-6 py-3 font-medium">Status</th>
              <th class="px-6 py-3" />
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in restaurants" :key="r.id" class="border-t border-border hover:bg-muted/30 transition">
              <td class="px-6 py-4 font-medium">{{ r.name }}</td>
              <td class="px-6 py-4 text-muted-foreground">{{ r.city }}</td>
              <td class="px-6 py-4 text-right tabular-nums">{{ r.orders.toLocaleString() }}</td>
              <td class="px-6 py-4 text-right tabular-nums font-semibold">
                ${{ r.revenue.toFixed(2) }}
              </td>
              <td class="px-6 py-4">
                <Badge
                  :variant="r.status === 'active' ? 'default' : 'secondary'"
                  :class="r.status === 'active' ? 'bg-success/15 text-success hover:bg-success/20' : ''"
                >
                  {{ r.status }}
                </Badge>
              </td>
              <td class="px-6 py-4">
                <button class="text-muted-foreground hover:text-foreground">
                  <MoreHorizontal class="h-4 w-4" />
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </RoleLayout>
</template>
