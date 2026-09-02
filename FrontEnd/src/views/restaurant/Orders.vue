<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { 
  ShoppingBag, Receipt, Calendar, User, Clock, CreditCard, Search, RefreshCw, 
  XCircle, CheckCircle2, ChevronRight, Utensils, AlertTriangle, ArrowLeft, X 
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
const mobileDetailOpen = ref(false)
const statusFilter = ref<string>('ALL')
const searchQuery = ref<string>('')

function selectOrder(id: string) {
  selectedId.value = id
  mobileDetailOpen.value = true
}

const orders = ref<any[]>([])
const payments = ref<any[]>([])
const restaurant = ref<any>(null)

const STATUS_OPTIONS = [
  { label: 'All', value: 'ALL' },
  { label: 'Pending', value: 'PENDING' },
  { label: 'Preparing', value: 'PREPARING' },
  { label: 'Ready', value: 'READY' },
  { label: 'Served', value: 'SERVED' },
  { label: 'Completed', value: 'COMPLETED' },
  { label: 'Cancelled', value: 'CANCELLED' },
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
  const restaurantId = auth.effectiveRestaurantId
  if (!restaurantId) return

  loading.value = true
  try {
    const [ordRes, payRes, restRes] = await Promise.all([
      getOrders(restaurantId, 1, 100),
      getPayments(restaurantId, 1, 100),
      getRestaurantById(restaurantId)
    ])
    
    orders.value = ordRes.data || []
    payments.value = payRes.data || []
    restaurant.value = restRes.data
    
    // Auto-select first order if none selected
    if (!selectedId.value && orders.value.length > 0) {
      selectedId.value = orders.value[0].id || orders.value[0]._id
    }
  } catch (err: any) {
    console.error('Failed to load orders', err)
    toast.error('Failed to load restaurant orders.')
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
      const idStr = String(o.id || o._id || '').toLowerCase()
      const tblStr = String(o.tableNumber || o.table || '')
      const cName = String(o.customerName || '').toLowerCase()
      const phone = String(o.customerPhone || '').toLowerCase()
      const waiter = String(o.createdBy?.name || '').toLowerCase()
      const itemsMatch = (o.items || []).some((it: any) => (it.name || '').toLowerCase().includes(query))
      return idStr.includes(query) || tblStr.includes(query) || cName.includes(query) || phone.includes(query) || waiter.includes(query) || itemsMatch
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

    <div v-else class="grid grid-cols-1 xl:grid-cols-[360px_1fr] gap-6">
      <!-- Left: Filter, search & list -->
      <div class="space-y-4">
        <!-- Search & Status Selectors -->
        <div class="rounded-2xl border border-border bg-card p-4 shadow-soft space-y-3">
          <div class="relative">
            <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search table, customer, dishes, waiter…" 
              v-model="searchQuery" 
              class="pl-9 pr-8 bg-muted/40 border-border text-xs" 
            />
            <button
              v-if="searchQuery"
              @click="searchQuery = ''"
              class="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X class="h-3.5 w-3.5" />
            </button>
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
              @click="selectOrder(o.id || o._id)"
              :class="[
                'w-full p-4 text-left flex items-start justify-between transition-colors border-l-4 cursor-pointer',
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
                <div class="text-[11px] text-muted-foreground">
                  Ordered {{ formatDateTime(o.createdAt) }}
                </div>
              </div>

              <div class="text-right flex items-center gap-2">
                <div>
                  <div class="font-bold tabular-nums text-sm">
                    ₹{{ (o.totalAmount || 0).toFixed(0) }}
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
                <ChevronRight class="h-4 w-4 text-muted-foreground lg:hidden" />
              </div>
            </button>
          </div>
        </div>
      </div>

      <!-- Right: Detailed invoice check (Desktop View) -->
      <div class="hidden lg:block space-y-4">
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
            </div>

            <div class="text-sm text-right text-muted-foreground">
              <span class="block">Opened: {{ formatDateTime(selectedOrder.createdAt) }}</span>
              <span v-if="selectedOrder.completedAt" class="block text-emerald-500 font-medium">Billed: {{ formatDateTime(selectedOrder.completedAt) }}</span>
            </div>
          </div>

          <div class="p-6 space-y-6 flex-1">

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
                      <td class="px-4 py-3 text-right tabular-nums text-muted-foreground">₹{{ item.price.toFixed(0) }}</td>
                      <td class="px-4 py-3 text-right tabular-nums font-semibold">₹{{ (item.price * item.qty).toFixed(0) }}</td>
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
                <span class="tabular-nums">₹{{ ((selectedOrder.totalAmount - (selectedOrder.gst || 0)) + (selectedOrder.discount || 0)).toFixed(0) }}</span>
              </div>

              <div v-if="selectedOrder.discount > 0" class="flex justify-between text-emerald-500 font-medium">
                <span>Discount</span>
                <span class="tabular-nums">-₹{{ selectedOrder.discount.toFixed(0) }}</span>
              </div>

              <div class="flex justify-between text-muted-foreground">
                <span>VAT / GST ({{ restaurant?.gstPercentage ?? 5 }}%)</span>
                <span class="tabular-nums">₹{{ (selectedOrder.gst || 0).toFixed(0) }}</span>
              </div>

              <div class="flex justify-between font-display text-2xl font-bold pt-3 border-t border-border mt-3 text-foreground">
                <span>Grand Total</span>
                <span class="tabular-nums">₹{{ (selectedOrder.totalAmount || 0).toFixed(0) }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ── Mobile Full-Screen Order Detail Modal (Phone App Experience) ───── -->
    <Teleport to="body">
      <Transition name="fade">
        <div
          v-if="mobileDetailOpen && selectedOrder"
          class="fixed inset-0 z-50 bg-background flex flex-col lg:hidden"
        >
          <!-- Mobile Top Header -->
          <div class="p-3.5 border-b border-border flex items-center justify-between shrink-0 bg-muted/20">
            <button
              @click="mobileDetailOpen = false"
              class="flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-xl border border-border bg-card hover:bg-muted text-foreground shadow-2xs cursor-pointer"
            >
              <ArrowLeft class="h-3.5 w-3.5" />
              <span>Back</span>
            </button>

            <div class="text-center">
              <div class="font-bold text-sm">Table {{ selectedOrder.tableNumber || selectedOrder.table }}</div>
              <div class="text-[10px] text-muted-foreground">{{ formatDateTime(selectedOrder.createdAt) }}</div>
            </div>

            <div class="flex items-center gap-1.5">
              <span :class="['text-[10px] font-bold px-2 py-0.5 rounded border', STATUS_BADGES[selectedOrder.status]]">
                {{ selectedOrder.status }}
              </span>
            </div>
          </div>

          <!-- Mobile Scrollable Body -->
          <div class="flex-1 overflow-y-auto p-4 space-y-4">
            <!-- Cancelled Alert -->
            <div v-if="selectedOrder.status === 'CANCELLED'" class="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs space-y-1">
              <div class="font-bold flex items-center gap-1"><XCircle class="h-3.5 w-3.5" /> Order Cancelled</div>
              <div>Reason: {{ selectedOrder.cancelReason || 'None specified' }}</div>
            </div>

            <!-- Ordered Dishes List -->
            <div class="space-y-2">
              <h4 class="text-xs font-bold uppercase tracking-wider text-muted-foreground">Dishes ({{ selectedOrder.items?.length || 0 }})</h4>
              <div class="divide-y divide-border/60 rounded-xl border border-border bg-card overflow-hidden">
                <div
                  v-for="it in (selectedOrder.items || [])"
                  :key="it.id"
                  class="p-3 flex items-center justify-between gap-2"
                >
                  <div class="min-w-0 flex-1">
                    <div class="font-semibold text-xs text-foreground truncate">{{ it.qty }}× {{ it.name }}</div>
                    <div v-if="it.note" class="text-[10px] text-amber-600">Note: {{ it.note }}</div>
                    <div class="text-[10px] text-muted-foreground mt-0.5">₹{{ it.price.toFixed(0) }} each</div>
                  </div>
                  <div class="text-right shrink-0">
                    <div class="font-bold text-xs tabular-nums">₹{{ (it.price * it.qty).toFixed(0) }}</div>
                    <span :class="['text-[9px] font-semibold px-1.5 py-0.2 rounded border', it.status === 'READY' ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground']">
                      {{ it.status || 'Active' }}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Notes -->
            <div v-if="selectedOrder.notes" class="p-3 rounded-xl bg-muted/20 border border-border text-xs">
              <span class="font-bold block text-muted-foreground text-[10px] uppercase mb-1">Notes</span>
              <p class="text-foreground/90">{{ selectedOrder.notes }}</p>
            </div>
          </div>

          <!-- Mobile Pinned Invoice Totals -->
          <div class="p-4 border-t border-border bg-card shrink-0 space-y-1 text-xs shadow-lg">
            <div class="flex justify-between text-muted-foreground">
              <span>Subtotal</span>
              <span class="tabular-nums font-medium">₹{{ ((selectedOrder.totalAmount - (selectedOrder.gst || 0)) + (selectedOrder.discount || 0)).toFixed(0) }}</span>
            </div>
            <div v-if="selectedOrder.discount > 0" class="flex justify-between text-emerald-600 font-medium">
              <span>Discount</span>
              <span class="tabular-nums font-bold">− ₹{{ selectedOrder.discount.toFixed(0) }}</span>
            </div>
            <div class="flex justify-between text-muted-foreground">
              <span>GST ({{ restaurant?.gstPercentage ?? 5 }}%)</span>
              <span class="tabular-nums font-medium">₹{{ (selectedOrder.gst || 0).toFixed(0) }}</span>
            </div>
            <div class="flex justify-between font-display text-base font-extrabold pt-2 border-t border-border text-foreground">
              <span>Grand Total</span>
              <span class="text-primary font-black text-lg tabular-nums">₹{{ (selectedOrder.totalAmount || 0).toFixed(0) }}</span>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
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
