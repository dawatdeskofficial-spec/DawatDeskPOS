<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { 
  ShoppingBag, Receipt, Calendar, User, Clock, CreditCard, Search, RefreshCw, 
  XCircle, CheckCircle2, ChevronRight, Utensils, AlertTriangle, ArrowLeft 
} from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import RoleLayout from '@/components/RoleLayout.vue'
import PageHeader from '@/components/PageHeader.vue'
import { restaurantNav } from '@/lib/nav'
import { getOrders, getPayments, getRestaurantById } from '@/lib/api'
import { useAuthStore } from '@/stores/auth'
import Button from '@/components/ui/Button.vue'
import Badge from '@/components/ui/Badge.vue'
import Input from '@/components/ui/Input.vue'

const auth = useAuthStore()
const loading = ref(true)
const selectedId = ref<string | null>(null)
const statusFilter = ref<string>('ALL')
const searchQuery = ref<string>('')

const orders = ref<any[]>([])
const payments = ref<any[]>([])
const restaurant = ref<any>(null)

const STATUS_OPTIONS = [
  { value: 'ALL', label: 'All Orders' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'PREPARING', label: 'Preparing' },
  { value: 'READY', label: 'Ready' },
  { value: 'SERVED', label: 'Served' },
  { value: 'COMPLETED', label: 'Completed (Billed)' },
  { value: 'CANCELLED', label: 'Cancelled' }
]

const STATUS_BADGES: Record<string, string> = {
  PENDING: 'bg-info/15 text-info border-info/20',
  PREPARING: 'bg-warning/15 text-warning border-warning/25',
  READY: 'bg-success/15 text-success border-success/25',
  SERVED: 'bg-primary/15 text-primary border-primary/25',
  COMPLETED: 'bg-emerald-500/15 text-emerald-500 border-emerald-500/25',
  CANCELLED: 'bg-destructive/15 text-destructive border-destructive/25'
}

const PAYMENT_BADGES: Record<string, string> = {
  PENDING: 'bg-amber-500/15 text-amber-600 border-amber-500/20',
  COMPLETED: 'bg-emerald-500/15 text-emerald-500 border-emerald-500/25',
  CANCELLED: 'bg-zinc-500/15 text-zinc-500 border-zinc-500/20'
}

async function fetchOrdersData() {
  if (!auth.user?.restaurantId) return
  const restaurantId = typeof auth.user.restaurantId === 'string'
    ? auth.user.restaurantId
    : (auth.user.restaurantId as any).id || (auth.user.restaurantId as any)._id

  loading.value = true
  try {
    const [ordRes, payRes, restRes] = await Promise.all([
      getOrders(restaurantId, 1, 150),
      getPayments(restaurantId, 1, 150),
      getRestaurantById(restaurantId)
    ])
    
    orders.value = ordRes.data || []
    payments.value = payRes.data || []
    restaurant.value = restRes.data
  } catch (err: any) {
    toast.error(err.message || 'Failed to load orders')
  } finally {
    loading.value = false
  }
}

// Build a fast map to associate order ID with its payment transaction record
const paymentsMap = computed(() => {
  const map = new Map<string, any>()
  payments.value.forEach(p => {
    const oId = typeof p.orderId === 'object' && p.orderId ? (p.orderId._id || p.orderId.id) : p.orderId
    if (oId) {
      map.set(oId.toString(), p)
    }
  })
  return map
})

// Filter and search logic
const filteredOrders = computed(() => {
  let list = orders.value

  if (statusFilter.value !== 'ALL') {
    list = list.filter(o => o.status === statusFilter.value)
  }

  if (searchQuery.value.trim()) {
    const query = searchQuery.value.toLowerCase().trim()
    list = list.filter(o => {
      const idStr = String(o.id || o._id).toLowerCase()
      const tblStr = String(o.tableNumber || o.table)
      return idStr.includes(query) || tblStr.includes(query)
    })
  }

  return list
})

const selectedOrder = computed(() => {
  return orders.value.find(o => (o.id || o._id) === selectedId.value)
})

const matchedPayment = computed(() => {
  if (!selectedOrder.value) return null
  const id = selectedOrder.value.id || selectedOrder.value._id
  return paymentsMap.value.get(id)
})

watch(filteredOrders, (newList) => {
  if (!selectedId.value && newList.length > 0) {
    selectedId.value = newList[0].id || newList[0]._id
  } else if (newList.length === 0) {
    selectedId.value = null
  }
}, { immediate: true })

onMounted(() => {
  fetchOrdersData()
})

function formatDateTime(ds: string) {
  if (!ds) return ''
  return new Date(ds).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })
}

function getPaymentMethodLabel(method: string) {
  if (!method) return '—'
  if (method === 'CASH') return 'Cash'
  if (method === 'CARD') return 'Debit/Credit Card'
  if (method === 'DIGITAL_WALLET') return 'Digital Wallet (UPI)'
  if (method === 'CHEQUE') return 'Cheque'
  return method
}
</script>

<template>
  <RoleLayout role="restaurant_admin" :nav="restaurantNav">
    <PageHeader
      title="Order Management"
      subtitle="Track, filter, and review details of live restaurant orders and billing settlements."
    >
      <template #action>
        <Button variant="ghost" size="sm" class="h-9 px-3" @click="fetchOrdersData" :disabled="loading">
          <RefreshCw :class="['h-4 w-4 mr-2', loading && 'animate-spin']" /> Sync Orders
        </Button>
      </template>
    </PageHeader>

    <div v-if="loading && orders.length === 0" class="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
      <RefreshCw class="h-8 w-8 animate-spin text-primary" />
      <span class="text-sm font-medium">Fetching restaurant orders…</span>
    </div>

    <div v-else class="grid lg:grid-cols-[400px_1fr] gap-6">
      <!-- Left: Filter, search & list -->
      <div class="space-y-4">
        <!-- Search & Status Selectors -->
        <div class="rounded-2xl border border-border bg-card p-4 shadow-soft space-y-3">
          <div class="relative">
            <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search table or order ID…" 
              v-model="searchQuery" 
              class="pl-9 bg-muted/40 border-border text-sm" 
            />
          </div>

          <div class="space-y-1.5">
            <label class="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Filter by Status</label>
            <div class="flex flex-wrap gap-1.5">
              <button
                v-for="opt in STATUS_OPTIONS"
                :key="opt.value"
                @click="statusFilter = opt.value"
                :class="[
                  'px-2.5 py-1 text-xs font-medium rounded-full border transition-all',
                  statusFilter === opt.value
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-background hover:bg-muted text-muted-foreground border-border'
                ]"
              >
                {{ opt.label }}
              </button>
            </div>
          </div>
        </div>

        <!-- Orders List Container -->
        <div class="rounded-2xl border border-border bg-card shadow-soft overflow-hidden">
          <div class="p-4 border-b border-border bg-muted/20">
            <h3 class="text-xs font-bold uppercase tracking-wider text-muted-foreground">Orders List</h3>
          </div>
          
          <div class="divide-y divide-border overflow-y-auto max-h-[600px]">
            <div v-if="filteredOrders.length === 0" class="p-10 text-center text-muted-foreground text-sm">
              <ShoppingBag class="h-8 w-8 mx-auto mb-2 opacity-30" />
              No matching orders found.
            </div>

            <button
              v-else
              v-for="o in filteredOrders"
              :key="o.id || o._id"
              @click="selectedId = o.id || o._id"
              :class="[
                'w-full p-4 text-left flex items-start justify-between transition-colors border-l-4',
                selectedId === (o.id || o._id) 
                  ? 'bg-primary/5 border-primary' 
                  : 'hover:bg-muted/30 border-transparent'
              ]"
            >
              <div class="space-y-1 min-w-0">
                <div class="flex items-center gap-2">
                  <span class="font-bold text-sm">Table {{ o.tableNumber || o.table }}</span>
                  <span :class="['inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full border', STATUS_BADGES[o.status] || 'bg-muted border-border']">
                    {{ o.status }}
                  </span>
                </div>
                <div class="text-[11px] font-mono text-muted-foreground truncate max-w-[200px]">
                  ID: {{ o.id || o._id }}
                </div>
                <div class="text-[11px] text-muted-foreground">
                  Ordered {{ formatDateTime(o.createdAt) }}
                </div>
              </div>

              <div class="text-right">
                <div class="font-bold tabular-nums text-sm">
                  ${{ (o.totalAmount || 0).toFixed(2) }}
                </div>
                <Badge 
                  v-if="o.paymentStatus === 'COMPLETED'" 
                  class="bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/15 font-normal text-[10px] mt-1.5"
                >
                  Paid
                </Badge>
                <Badge 
                  v-else-if="o.status === 'CANCELLED'" 
                  class="bg-destructive/10 text-destructive font-normal text-[10px] mt-1.5"
                >
                  Void
                </Badge>
                <Badge 
                  v-else 
                  class="bg-amber-500/10 text-amber-600 hover:bg-amber-500/15 font-normal text-[10px] mt-1.5"
                >
                  Unpaid
                </Badge>
              </div>
            </button>
          </div>
        </div>
      </div>

      <!-- Right: Detailed invoice check -->
      <div class="space-y-4">
        <div v-if="!selectedOrder" class="rounded-2xl border border-border bg-card p-20 text-center text-muted-foreground flex flex-col items-center justify-center gap-3 shadow-soft min-h-[500px]">
          <ShoppingBag class="h-10 w-10 opacity-30 text-primary" />
          <div>
            <h4 class="font-bold text-base">Select an order</h4>
            <p class="text-xs max-w-xs mt-1">
              Choose an order from the list on the left to see its itemized breakdown, waiter info, and cashier transaction receipts.
            </p>
          </div>
        </div>

        <div v-else class="rounded-2xl border border-border bg-card shadow-soft overflow-hidden min-h-[500px] flex flex-col">
          <!-- Ticket Header -->
          <div class="p-6 border-b border-border bg-muted/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div class="flex items-center gap-3">
                <h3 class="font-display font-bold text-xl">Table {{ selectedOrder.tableNumber || selectedOrder.table }}</h3>
                <span :class="['inline-flex items-center text-xs font-semibold px-2.5 py-0.5 rounded-full border', STATUS_BADGES[selectedOrder.status] || 'bg-muted border-border']">
                  {{ selectedOrder.status }}
                </span>
                <span :class="['inline-flex items-center text-xs font-semibold px-2.5 py-0.5 rounded-full border', PAYMENT_BADGES[selectedOrder.paymentStatus] || 'bg-muted border-border']">
                  Payment: {{ selectedOrder.paymentStatus }}
                </span>
              </div>
              <p class="text-xs font-mono text-muted-foreground mt-1">ID: {{ selectedOrder.id || selectedOrder._id }}</p>
            </div>

            <div class="text-sm text-right text-muted-foreground">
              <span class="block">Opened: {{ formatDateTime(selectedOrder.createdAt) }}</span>
              <span v-if="selectedOrder.completedAt" class="block text-emerald-500 font-medium">Billed: {{ formatDateTime(selectedOrder.completedAt) }}</span>
            </div>
          </div>

          <div class="p-6 space-y-6 flex-1">
            <!-- Details Grid: Metadata -->
            <div class="grid gap-4 sm:grid-cols-2 md:grid-cols-5 bg-muted/20 border border-border rounded-xl p-4">
              <div class="space-y-1">
                <span class="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block">Server/Waiter</span>
                <div class="text-sm font-semibold flex items-center gap-1.5">
                  <User class="h-4 w-4 text-muted-foreground" />
                  <span>{{ selectedOrder.createdBy?.name || 'Unknown' }}</span>
                </div>
                <span class="text-[10px] text-muted-foreground block truncate">{{ selectedOrder.createdBy?.email || 'N/A' }}</span>
              </div>

              <div class="space-y-1">
                <span class="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block">Served At</span>
                <div class="text-sm font-semibold flex items-center gap-1.5">
                  <Clock class="h-4 w-4 text-muted-foreground" />
                  <span>{{ selectedOrder.servedAt ? formatDateTime(selectedOrder.servedAt) : 'Not served yet' }}</span>
                </div>
              </div>

              <div class="space-y-1">
                <span class="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block">Cashier</span>
                <div class="text-sm font-semibold flex items-center gap-1.5">
                  <User class="h-4 w-4 text-muted-foreground" />
                  <span>{{ matchedPayment?.createdBy?.name || '—' }}</span>
                </div>
                <span class="text-[10px] text-muted-foreground block truncate">{{ matchedPayment?.createdBy?.email || 'N/A' }}</span>
              </div>

              <div class="space-y-1">
                <span class="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block">Payment Method</span>
                <div class="text-sm font-semibold flex items-center gap-1.5">
                  <CreditCard class="h-4 w-4 text-muted-foreground" />
                  <span>{{ matchedPayment ? getPaymentMethodLabel(matchedPayment.paymentMethod) : '—' }}</span>
                </div>
              </div>

              <div class="space-y-1">
                <span class="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block">Receipt ID</span>
                <div class="text-sm font-semibold flex items-center gap-1.5 font-mono">
                  <Receipt class="h-4 w-4 text-muted-foreground" />
                  <span class="truncate">{{ matchedPayment?.receiptNumber || '—' }}</span>
                </div>
              </div>
            </div>

            <!-- Cancel Warning Panel -->
            <div v-if="selectedOrder.status === 'CANCELLED'" class="rounded-xl border border-destructive/20 bg-destructive/5 p-4 flex gap-3 text-destructive">
              <XCircle class="h-5 w-5 shrink-0 mt-0.5" />
              <div>
                <h4 class="font-bold text-sm">Order Cancelled/Voided</h4>
                <p class="text-xs opacity-90 mt-1">
                  <strong>Reason:</strong> {{ selectedOrder.cancelReason || 'No reason provided' }}
                </p>
                <p class="text-[11px] opacity-80 mt-1">
                  Cancelled at: {{ formatDateTime(selectedOrder.cancelledAt) }}
                </p>
              </div>
            </div>

            <!-- Items breakdown -->
            <div class="space-y-3">
              <h4 class="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Utensils class="h-4 w-4" /> Ordered Items ({{ selectedOrder.items?.length || 0 }})
              </h4>

              <div class="border border-border rounded-xl overflow-hidden">
                <table class="w-full text-sm">
                  <thead class="bg-muted/40 text-muted-foreground text-xs uppercase tracking-wider">
                    <tr>
                      <th class="text-left px-4 py-2.5 font-semibold">Dish</th>
                      <th class="text-center px-4 py-2.5 font-semibold">Qty</th>
                      <th class="text-right px-4 py-2.5 font-semibold">Unit Price</th>
                      <th class="text-right px-4 py-2.5 font-semibold">Total</th>
                      <th class="text-center px-4 py-2.5 font-semibold">Kitchen Status</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-border">
                    <tr v-if="!selectedOrder.items || selectedOrder.items.length === 0">
                      <td colspan="5" class="px-4 py-6 text-center text-muted-foreground text-xs">
                        No items added to this order.
                      </td>
                    </tr>
                    <tr v-for="item in selectedOrder.items" :key="item.id" class="hover:bg-muted/20 transition">
                      <td class="px-4 py-3 font-medium">
                        <div>{{ item.name }}</div>
                        <div v-if="item.note" class="text-[11px] text-amber-600 font-normal">Note: {{ item.note }}</div>
                      </td>
                      <td class="px-4 py-3 text-center tabular-nums font-medium">{{ item.qty }}</td>
                      <td class="px-4 py-3 text-right tabular-nums text-muted-foreground">${{ item.price.toFixed(2) }}</td>
                      <td class="px-4 py-3 text-right tabular-nums font-semibold">${{ (item.price * item.qty).toFixed(2) }}</td>
                      <td class="px-4 py-3 text-center">
                        <span :class="[
                          'text-[10px] font-semibold px-2 py-0.5 rounded border',
                          item.status === 'DELIVERED' ? 'bg-success/10 text-success border-success/20' : 
                          item.status === 'READY' ? 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20' : 
                          item.status === 'PREPARING' ? 'bg-warning/10 text-warning border-warning/20' : 
                          item.status === 'CANCELLED' ? 'bg-destructive/10 text-destructive border-destructive/20' :
                          'bg-zinc-500/10 text-zinc-500 border-zinc-500/20'
                        ]">
                          {{ item.status }}
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <!-- Notes Section -->
            <div v-if="selectedOrder.notes" class="space-y-1.5">
              <span class="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block">Order Notes</span>
              <p class="text-xs bg-muted/30 border border-border rounded-lg p-3 text-muted-foreground leading-relaxed">
                {{ selectedOrder.notes }}
              </p>
            </div>
          </div>

          <!-- Bottom: Financial Details Invoice -->
          <div class="bg-muted/10 border-t border-border p-6 mt-auto">
            <div class="max-w-md ml-auto space-y-2 text-sm">
              <div class="flex justify-between text-muted-foreground">
                <span>Subtotal</span>
                <span class="tabular-nums">${{ ((selectedOrder.totalAmount - (selectedOrder.gst || 0)) + (selectedOrder.discount || 0)).toFixed(2) }}</span>
              </div>

              <div v-if="selectedOrder.discount > 0" class="flex justify-between text-emerald-500 font-medium">
                <span>Discount</span>
                <span class="tabular-nums">-${{ selectedOrder.discount.toFixed(2) }}</span>
              </div>

              <div class="flex justify-between text-muted-foreground">
                <span>VAT / GST ({{ restaurant?.gstPercentage ?? 5 }}%)</span>
                <span class="tabular-nums">${{ (selectedOrder.gst || 0).toFixed(2) }}</span>
              </div>

              <div class="flex justify-between font-display text-2xl font-bold pt-3 border-t border-border mt-3 text-foreground">
                <span>Grand Total</span>
                <span class="tabular-nums">${{ (selectedOrder.totalAmount || 0).toFixed(2) }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </RoleLayout>
</template>

<style scoped>
/* Scrollbar tweaks */
.divide-y::-webkit-scrollbar {
  width: 6px;
}
.divide-y::-webkit-scrollbar-track {
  background: transparent;
}
.divide-y::-webkit-scrollbar-thumb {
  background: rgba(var(--muted-foreground-rgb), 0.15);
  border-radius: 4px;
}
.divide-y::-webkit-scrollbar-thumb:hover {
  background: rgba(var(--muted-foreground-rgb), 0.3);
}
</style>
