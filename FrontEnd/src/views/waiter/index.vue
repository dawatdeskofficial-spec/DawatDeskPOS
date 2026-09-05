<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import {
  Minus, Plus, Send, Trash2, CheckCircle2, Clock,
  BellRing, ShoppingBag, ArrowLeft, UtensilsCrossed, X,
  ChevronRight, Receipt, Search,
  ArrowRight, FileText, Sparkles,
  Edit, Flame, AlertCircle, Check, Lock, Unlock
} from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import RoleLayout from '@/components/RoleLayout.vue'
import { waiterNav } from '@/lib/nav'
import {
  getMenuItems, createOrder, getOrders, getRestaurantById,
  updateOrderStatus, getCategoriesByRestaurant, getWaitingQueue, type MenuCategory,
  batchUpdateOrderItems, cancelOrder
} from '@/lib/api'
import { useAuthStore } from '@/stores/auth'
import Button from '@/components/ui/Button.vue'
import Badge from '@/components/ui/Badge.vue'
import Input from '@/components/ui/Input.vue'
import Dialog from '@/components/ui/Dialog.vue'
import DialogContent from '@/components/ui/DialogContent.vue'
import DialogHeader from '@/components/ui/DialogHeader.vue'
import DialogTitle from '@/components/ui/DialogTitle.vue'
import DialogDescription from '@/components/ui/DialogDescription.vue'

interface CartLine {
  id: string
  name: string
  price: number
  qty: number
  emoji: string
  specialInstructions?: string
}

const auth = useAuthStore()
const view = ref<'take_order' | 'ready_orders' | 'history'>('take_order')
const table = ref<number | null>(null)
const cat = ref('All')
const cart = ref<CartLine[]>([])
const orderNotes = ref('')

const menuCategories = ref<MenuCategory[]>([])
const menuItems = ref<any[]>([])
const tables = ref<any[]>([])
const maxTables = ref(20)
const loading = ref(true)
const placingOrder = ref(false)
const allOrders = ref<any[]>([])
const prevReadyIds = ref<Set<string>>(new Set())
const mobileCartOpen = ref(false)
let interval: any

// Search and filter states
const menuSearch = ref('')
const readySearch = ref('')
const historySearch = ref('')
const tableSearchQuery = ref('')
const tableStatusFilter = ref<'ALL' | 'available' | 'occupied'>('ALL')

async function loadStaticData() {
  if (!auth.user?.restaurantId) return
  const restaurantId =
    typeof auth.user.restaurantId === 'string'
      ? auth.user.restaurantId
      : (auth.user.restaurantId as any).id || (auth.user.restaurantId as any)._id

  try {
    const [menuRes, restaurantRes, categoryRes] = await Promise.all([
      getMenuItems(restaurantId),
      getRestaurantById(restaurantId),
      getCategoriesByRestaurant(restaurantId),
    ])

    const restaurant = restaurantRes.data as any
    maxTables.value = restaurant?.maxTables || 20

    const categoryList: MenuCategory[] = categoryRes.data || []
    const categoryById = new Map(
      categoryList.map((c) => [c._id || c.id, c])
    )
    menuItems.value = (menuRes.data || []).map((m: any) => {
      const categoryId =
        typeof m.categoryId === 'string'
          ? m.categoryId
          : m.categoryId?._id || m.categoryId?.id || ''
      return {
        ...m,
        id: m._id || m.id,
        categoryId,
        categoryName:
          typeof m.categoryId === 'object' && m.categoryId?.name
            ? m.categoryId.name
            : categoryById.get(categoryId)?.name || m.category || 'Uncategorized',
        emoji: m.image || '🍴',
        available: m.isAvailable ?? true,
      }
    })
    menuCategories.value = categoryList
  } catch (err) {
    console.error(err)
  }
}

async function loadDynamicData() {
  if (!auth.user?.restaurantId) return
  const restaurantId =
    typeof auth.user.restaurantId === 'string'
      ? auth.user.restaurantId
      : (auth.user.restaurantId as any).id || (auth.user.restaurantId as any)._id

  try {
    const [ordersRes, queueRes] = await Promise.all([
      getOrders(restaurantId, 1, 100),
      getWaitingQueue(restaurantId).catch(() => ({ data: [] })),
    ])

    const rawOrders = ordersRes.data || []

    // Detect newly-ready orders and notify the waiter
    const newReadyOrders = (rawOrders as any[]).filter(
      (o: any) => (o.status || '').toUpperCase() === 'READY'
    )
    const newReadyIds = new Set<string>(
      newReadyOrders.map((o: any) => String(o.id || o._id))
    )
    newReadyOrders.forEach((o: any) => {
      const oid = String(o.id || o._id)
      if (!prevReadyIds.value.has(oid)) {
        const itemCount = (o.items || []).length
        const isParcel = o.orderType === 'PARCEL' || Number(o.tableNumber) === 0
        const title = isParcel ? `📦 Parcel for ${o.customerName || 'Takeaway'} is ready!` : `🔔 Table ${o.tableNumber} is ready!`
        const desc = isParcel
          ? `${itemCount} item${itemCount !== 1 ? 's' : ''} packed in kitchen — ready for handover.`
          : `${itemCount} item${itemCount !== 1 ? 's' : ''} waiting in kitchen — pick up now.`
        
        toast.success(title, { description: desc, duration: 8000 })
      }
    })
    prevReadyIds.value = newReadyIds
    allOrders.value = rawOrders

    const activeTables = new Set(
      rawOrders
        .filter((o: any) => {
          const s = (o.status || '').toLowerCase()
          const p = (o.paymentStatus || '').toLowerCase()
          return !['completed', 'billed', 'cancelled'].includes(s) && p !== 'completed'
        })
        .map((o: any) => Number(o.tableNumber || o.table))
    )

    // Include tables allocated to seated queue guests until order is completed
    const rawQueue = queueRes.data || []
    rawQueue.forEach((q: any) => {
      if (q.status === 'SEATED' && q.assignedTable) {
        const tbl = Number(q.assignedTable)
        const hasCompletedOrder = rawOrders.some((o: any) => {
          const orderTbl = Number(o.tableNumber || o.table)
          const isCompleted = (o.status || '').toUpperCase() === 'COMPLETED' || o.paymentStatus === 'COMPLETED'
          if (orderTbl === tbl && isCompleted) {
            const seatedTime = q.seatedAt ? new Date(q.seatedAt).getTime() : 0
            const orderTime = o.updatedAt || o.createdAt ? new Date(o.updatedAt || o.createdAt).getTime() : 0
            return orderTime >= seatedTime
          }
          return false
        })
        if (!hasCompletedOrder) {
          activeTables.add(tbl)
        }
      }
    })

    const activeOrderMap = new Map<number, any>()
    rawOrders.forEach((o: any) => {
      const s = (o.status || '').toUpperCase()
      const p = (o.paymentStatus || '').toUpperCase()
      const tbl = Number(o.tableNumber || o.table)
      if (tbl > 0 && !['COMPLETED', 'CANCELLED'].includes(s) && p !== 'COMPLETED') {
        if (!activeOrderMap.has(tbl)) {
          activeOrderMap.set(tbl, o)
        }
      }
    })

    tables.value = Array.from({ length: maxTables.value }, (_, i) => {
      const num = i + 1
      const isOccupied = activeTables.has(num)
      const order = activeOrderMap.get(num)
      const orderStatus = order ? (order.status || '').toUpperCase() : null

      return {
        id: `t${num}`,
        number: num,
        status: isOccupied ? 'occupied' : 'available',
        activeOrder: order || null,
        kitchenStatus: orderStatus as 'PENDING' | 'PREPARING' | 'READY' | 'SERVED' | null,
      }
    })
  } catch (err) {
    console.error(err)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadStaticData()
  loadDynamicData()
  interval = setInterval(loadDynamicData, 5000)
})
onUnmounted(() => clearInterval(interval))

/* ── Cart helpers ── */
function getCartItemQty(id: string): number {
  const found = cart.value.find((l) => l.id === id)
  return found ? found.qty : 0
}

function add(m: any) {
  const found = cart.value.find((l) => l.id === m.id)
  if (found) {
    found.qty++
  } else {
    cart.value.push({ id: m.id, name: m.name, price: m.price, qty: 1, emoji: m.emoji })
  }
}

function dec(id: string) {
  const idx = cart.value.findIndex((l) => l.id === id)
  if (idx !== -1) {
    if (cart.value[idx].qty > 1) {
      cart.value[idx].qty--
    } else {
      cart.value.splice(idx, 1)
    }
  }
}

function remove(id: string) {
  cart.value = cart.value.filter((l) => l.id !== id)
}

const totalCartItems = computed(() => cart.value.reduce((s, l) => s + l.qty, 0))
const subtotal = computed(() => cart.value.reduce((s, l) => s + l.price * l.qty, 0))
const tax = computed(() => subtotal.value * 0.08)
const total = computed(() => subtotal.value + tax.value)

async function place() {
  if (!table.value) return toast.error('Pick a table first')
  if (cart.value.length === 0) return toast.error('Add some items to order')
  const restaurantId =
    typeof auth.user?.restaurantId === 'string'
      ? auth.user.restaurantId
      : (auth.user?.restaurantId as any)?.id || (auth.user?.restaurantId as any)?._id

  placingOrder.value = true
  try {
    await createOrder({
      restaurantId,
      tableNumber: String(table.value),
      notes: orderNotes.value.trim() || undefined,
      items: cart.value.map((item) => ({
        menuItemId: item.id,
        quantity: item.qty,
        specialInstructions: item.specialInstructions || undefined
      })),
    })
    toast.success(`Order placed for Table ${table.value} · ₹${total.value.toFixed(0)} sent to kitchen!`)
    cart.value = []
    orderNotes.value = ''
    table.value = null
    mobileCartOpen.value = false
    loadDynamicData()
  } catch (err: any) {
    toast.error(err.message || 'Failed to place order')
  } finally {
    placingOrder.value = false
  }
}

async function handleServe(orderId: string, tableNumber: number, isParcel = false, customerName = '') {
  try {
    await updateOrderStatus(orderId, 'SERVED')
    if (isParcel) {
      toast.success(`Parcel for ${customerName || 'Takeaway'} has been handed over!`)
    } else {
      toast.success(`Table ${tableNumber} marked as served!`)
    }
    loadDynamicData()
  } catch (err: any) {
    toast.error(err.message || 'Failed to mark as served')
  }
}

function selectTable(num: number) {
  table.value = num
  cat.value = 'All'
  menuSearch.value = ''
}

const activeOrderModalOpen = ref(false)
const expandedReadyOrders = ref<Set<string>>(new Set())

function toggleExpandReady(orderId: string) {
  const s = new Set(expandedReadyOrders.value)
  s.has(orderId) ? s.delete(orderId) : s.add(orderId)
  expandedReadyOrders.value = s
}

function elapsed(ts: string) {
  if (!ts) return ''
  const diff = Date.now() - new Date(ts).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'Just now'
  if (m > 60) return `${Math.floor(m / 60)}h ${m % 60}m`
  return `${m}m`
}

const activeOrderForTable = computed(() =>
  allOrders.value.find(
    (o: any) =>
      Number(o.tableNumber) === table.value &&
      !['COMPLETED', 'CANCELLED'].includes((o.status || '').toUpperCase()) &&
      (o.paymentStatus || '').toUpperCase() !== 'COMPLETED'
  )
)

const isOrderPending = computed(() => {
  if (!activeOrderForTable.value) return false
  return (activeOrderForTable.value.status || '').toUpperCase() === 'PENDING'
})

const isOrderCooking = computed(() => {
  if (!activeOrderForTable.value) return false
  return (activeOrderForTable.value.status || '').toUpperCase() === 'PREPARING'
})

const isOrderReady = computed(() => {
  if (!activeOrderForTable.value) return false
  return (activeOrderForTable.value.status || '').toUpperCase() === 'READY'
})

// ── Update Order State (strictly allowed ONLY until Chef starts cooking) ──
const updateOrderModalOpen = ref(false)
const editableOrderItems = ref<any[]>([])
const editableOrderNotes = ref('')
const savingOrderUpdate = ref(false)
const cancelingOrder = ref(false)
const addItemSearch = ref('')
const showAddDishPicker = ref(false)

function openUpdateOrderModal() {
  if (!activeOrderForTable.value) return
  const currentStatus = (activeOrderForTable.value.status || '').toUpperCase()
  if (currentStatus !== 'PENDING') {
    toast.error('Cannot update order: Chef has already started cooking!')
    return
  }

  // Clone items from activeOrderForTable
  editableOrderItems.value = (activeOrderForTable.value.items || []).map((it: any) => ({
    id: String(it.id || it._id),
    menuItemId: it.menuItemId || it.id || it._id,
    name: it.name,
    price: it.price,
    qty: it.qty,
    originalQty: it.qty,
    specialInstructions: it.note || it.specialInstructions || '',
    isNew: false,
    status: it.status || 'PENDING',
    emoji: it.emoji || '🍴',
  }))
  editableOrderNotes.value = activeOrderForTable.value.notes || ''
  showAddDishPicker.value = false
  addItemSearch.value = ''
  updateOrderModalOpen.value = true
}

function incEditQty(index: number) {
  editableOrderItems.value[index].qty++
}

function decEditQty(index: number) {
  if (editableOrderItems.value[index].qty > 1) {
    editableOrderItems.value[index].qty--
  } else {
    removeEditItem(index)
  }
}

function removeEditItem(index: number) {
  editableOrderItems.value.splice(index, 1)
}

function addDishToEditableOrder(menuItem: any) {
  const existing = editableOrderItems.value.find(
    (i) => (i.menuItemId === menuItem.id || i.name === menuItem.name)
  )
  if (existing) {
    existing.qty++
  } else {
    editableOrderItems.value.push({
      id: `new_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      menuItemId: menuItem.id,
      name: menuItem.name,
      price: menuItem.price,
      qty: 1,
      originalQty: 0,
      specialInstructions: '',
      isNew: true,
      emoji: menuItem.emoji || '🍴',
    })
  }
  toast.success(`Added "${menuItem.name}" to ticket update`)
}

const editableSubtotal = computed(() =>
  editableOrderItems.value.reduce((sum, item) => sum + (item.price * item.qty), 0)
)
const editableTax = computed(() => editableSubtotal.value * 0.08)
const editableTotal = computed(() => editableSubtotal.value + editableTax.value)

const addableMenuItems = computed(() => {
  let list = menuItems.value.filter((m) => m.available)
  if (addItemSearch.value.trim()) {
    const q = addItemSearch.value.toLowerCase().trim()
    list = list.filter(
      (m) =>
        m.name?.toLowerCase().includes(q) ||
        m.categoryName?.toLowerCase().includes(q)
    )
  }
  return list
})

async function handleSaveOrderUpdate() {
  if (!activeOrderForTable.value) return
  const orderId = String(activeOrderForTable.value.id || activeOrderForTable.value._id)

  // Re-verify current live status before submitting
  const currentStatus = (activeOrderForTable.value.status || '').toUpperCase()
  if (currentStatus !== 'PENDING') {
    toast.error('Chef has already started cooking this order! Modifications are locked.', { duration: 5000 })
    updateOrderModalOpen.value = false
    return
  }

  if (editableOrderItems.value.length === 0) {
    toast.error('Order cannot be empty. Please keep at least one dish or cancel the order.')
    return
  }

  savingOrderUpdate.value = true
  try {
    const originalItems: any[] = activeOrderForTable.value.items || []
    const currentItemIds = new Set(editableOrderItems.value.filter(i => !i.isNew).map(i => i.id))
    const itemIdsToDelete = originalItems
      .filter(i => !currentItemIds.has(String(i.id || i._id)))
      .map(i => String(i.id || i._id))

    const itemsToAdd = editableOrderItems.value
      .filter(i => i.isNew)
      .map(i => ({
        menuItemId: i.menuItemId,
        qty: i.qty,
        specialInstructions: i.specialInstructions || undefined,
      }))

    const itemsToUpdate = editableOrderItems.value
      .filter(i => !i.isNew && (i.qty !== i.originalQty || i.specialInstructions !== (i.note || '')))
      .map(i => ({
        id: i.id,
        qty: i.qty,
        specialInstructions: i.specialInstructions || undefined,
      }))

    await batchUpdateOrderItems(orderId, {
      itemsToUpdate,
      itemsToAdd,
      itemIdsToDelete,
      notes: editableOrderNotes.value.trim() || undefined,
    })

    toast.success(`Table ${table.value} order updated! Kitchen ticket refreshed.`)
    updateOrderModalOpen.value = false
    await loadDynamicData()
  } catch (err: any) {
    toast.error(err.message || 'Failed to update order')
    await loadDynamicData()
  } finally {
    savingOrderUpdate.value = false
  }
}

async function handleCancelPendingOrder() {
  if (!activeOrderForTable.value) return
  const orderId = String(activeOrderForTable.value.id || activeOrderForTable.value._id)

  const currentStatus = (activeOrderForTable.value.status || '').toUpperCase()
  if (currentStatus !== 'PENDING') {
    toast.error('Cannot cancel: Chef has already started cooking!')
    return
  }

  const confirmCancel = window.confirm(
    `Are you sure you want to cancel Table ${table.value}'s pending order? This will void the ticket.`
  )
  if (!confirmCancel) return

  cancelingOrder.value = true
  try {
    await cancelOrder(orderId, 'Cancelled by waiter before cooking started')
    toast.success(`Order for Table ${table.value} has been cancelled.`)
    updateOrderModalOpen.value = false
    activeOrderModalOpen.value = false
    table.value = null
    await loadDynamicData()
  } catch (err: any) {
    toast.error(err.message || 'Failed to cancel order')
  } finally {
    cancelingOrder.value = false
  }
}

// Real-time notification if chef starts cooking while update modal is open
watch(
  () => activeOrderForTable.value?.status,
  (newStatus) => {
    if (updateOrderModalOpen.value && newStatus && (newStatus as string).toUpperCase() !== 'PENDING') {
      toast.warning('⚠️ Chef has just started cooking! This order is now locked.', { duration: 6000 })
    }
  }
)

// Computed filtered lists
const filteredTables = computed(() => {
  let list = tables.value
  if (tableStatusFilter.value !== 'ALL') {
    list = list.filter(t => t.status === tableStatusFilter.value)
  }
  if (tableSearchQuery.value.trim()) {
    const q = tableSearchQuery.value.trim().toLowerCase()
    list = list.filter(t => String(t.number).includes(q) || `table ${t.number}`.includes(q))
  }
  return list
})

const readyOrders = computed(() => allOrders.value.filter((o) => (o.status || '').toUpperCase() === 'READY'))

const filteredReadyOrders = computed(() => {
  let list = readyOrders.value
  if (readySearch.value.trim()) {
    const q = readySearch.value.toLowerCase().trim()
    list = list.filter((o) => {
      const tbl = String(o.tableNumber || '')
      const cName = String(o.customerName || '').toLowerCase()
      const phone = String(o.customerPhone || '').toLowerCase()
      const itemMatch = (o.items || []).some((it: any) => it.name?.toLowerCase().includes(q))
      return tbl.includes(q) || cName.includes(q) || phone.includes(q) || itemMatch
    })
  }
  return list
})

const filteredHistoryOrders = computed(() => {
  let list = allOrders.value
  if (historySearch.value.trim()) {
    const q = historySearch.value.toLowerCase().trim()
    list = list.filter((o) => {
      const tbl = String(o.tableNumber || '')
      const cName = String(o.customerName || '').toLowerCase()
      const status = String(o.status || '').toLowerCase()
      const itemMatch = (o.items || []).some((it: any) => it.name?.toLowerCase().includes(q))
      return tbl.includes(q) || cName.includes(q) || status.includes(q) || itemMatch
    })
  }
  return list
})

const filteredMenuItems = computed(() => {
  let list = menuItems.value.filter(
    (m) => (cat.value === 'All' || m.categoryId === cat.value) && m.available
  )
  if (menuSearch.value.trim()) {
    const q = menuSearch.value.toLowerCase().trim()
    list = list.filter(
      (m) =>
        m.name?.toLowerCase().includes(q) ||
        m.description?.toLowerCase().includes(q) ||
        m.categoryName?.toLowerCase().includes(q)
    )
  }
  return list
})

function formatTime(ts: string) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}
</script>

<template>
  <RoleLayout role="waiter" :nav="waiterNav">
    <!-- ══════════════════════════════════════════ -->
    <!--  Top Segmented Navigation Tab Bar          -->
    <!-- ══════════════════════════════════════════ -->
    <div class="flex items-center justify-center mb-6">
      <div class="grid grid-cols-3 gap-1 p-1 rounded-2xl bg-muted/60 max-w-lg w-full border border-border/60 shadow-xs">
          <!-- Take Order Tab -->
          <button
            @click="view = 'take_order'"
            :class="[
              'py-2 px-2 rounded-xl text-xs sm:text-sm font-bold transition flex items-center justify-center gap-1.5 shadow-xs',
              view === 'take_order'
                ? 'bg-background text-foreground shadow-sm ring-1 ring-border/50'
                : 'text-muted-foreground hover:text-foreground'
            ]"
          >
            <UtensilsCrossed class="h-3.5 w-3.5 shrink-0" />
            <span class="truncate">{{ table ? `Table ${table}` : 'Take Order' }}</span>
          </button>

          <!-- Ready Orders Tab -->
          <button
            @click="view = 'ready_orders'"
            :class="[
              'py-2 px-2 rounded-xl text-xs sm:text-sm font-bold transition flex items-center justify-center gap-1.5 shadow-xs relative',
              view === 'ready_orders'
                ? 'bg-background text-foreground shadow-sm ring-1 ring-border/50'
                : 'text-muted-foreground hover:text-foreground'
            ]"
          >
            <BellRing class="h-3.5 w-3.5 shrink-0" />
            <span class="truncate">Ready</span>
            <span
              v-if="readyOrders.length > 0"
              class="h-4.5 min-w-[18px] px-1 rounded-full bg-destructive text-[10px] font-black text-destructive-foreground flex items-center justify-center ring-2 ring-background animate-pulse shrink-0"
            >
              {{ readyOrders.length }}
            </span>
          </button>

          <!-- History Tab -->
          <button
            @click="view = 'history'"
            :class="[
              'py-2 px-2 rounded-xl text-xs sm:text-sm font-bold transition flex items-center justify-center gap-1.5 shadow-xs',
              view === 'history'
                ? 'bg-background text-foreground shadow-sm ring-1 ring-border/50'
                : 'text-muted-foreground hover:text-foreground'
            ]"
          >
            <Clock class="h-3.5 w-3.5 shrink-0" />
            <span class="truncate">History</span>
          </button>
        </div>
      </div>

    <!-- ══════════════════════════════════════════ -->
    <!--  1. READY ORDERS VIEW                      -->
    <!-- ══════════════════════════════════════════ -->
    <template v-if="view === 'ready_orders'">
      <div class="mb-4 space-y-3">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h1 class="font-display text-xl sm:text-2xl font-bold tracking-tight">Ready for Pickup</h1>
            <p class="text-xs text-muted-foreground">Kitchen has finished cooking these orders. Pick up & serve.</p>
          </div>
          <Badge v-if="readyOrders.length > 0" class="bg-success text-success-foreground font-bold px-3 py-1 text-xs w-fit">
            {{ readyOrders.length }} Order{{ readyOrders.length !== 1 ? 's' : '' }} Ready
          </Badge>
        </div>

        <!-- Search input for ready pickup -->
        <div class="relative max-w-md">
          <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            v-model="readySearch"
            placeholder="Search table, parcel, dish name…"
            class="pl-9 pr-8 h-9 text-xs bg-card"
          />
          <button
            v-if="readySearch"
            @click="readySearch = ''"
            class="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X class="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div v-if="readyOrders.length === 0" class="rounded-3xl border-2 border-dashed border-border p-12 text-center text-muted-foreground">
        <CheckCircle2 class="h-10 w-10 mx-auto mb-2 opacity-30 text-success" />
        <p class="text-base font-display font-bold text-foreground">Kitchen is all clear!</p>
        <p class="text-xs mt-1 text-muted-foreground">When chefs finish preparing dishes, they will notify you here immediately.</p>
      </div>

      <div v-else-if="filteredReadyOrders.length === 0" class="rounded-3xl border-2 border-dashed border-border p-10 text-center text-muted-foreground">
        <Search class="h-8 w-8 mx-auto mb-2 opacity-40 text-muted-foreground" />
        <p class="font-semibold text-xs sm:text-sm">No ready tickets match "{{ readySearch }}"</p>
        <Button size="sm" variant="ghost" class="mt-2 text-xs" @click="readySearch = ''">Clear Search</Button>
      </div>

      <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
        <div
          v-for="o in filteredReadyOrders"
          :key="o.id || o._id"
          class="rounded-2xl bg-card border-2 border-success/50 shadow-soft overflow-hidden flex flex-col justify-between"
        >
          <!-- Card Header -->
          <div :class="['p-3.5 border-b border-border flex items-center justify-between', (o.orderType === 'PARCEL' || Number(o.tableNumber) === 0) ? 'bg-purple-500/10' : 'bg-success/5']">
            <div>
              <div v-if="o.orderType === 'PARCEL' || Number(o.tableNumber) === 0">
                <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-500/20 text-purple-700 dark:text-purple-300 font-bold text-[10px] uppercase">
                  <ShoppingBag class="h-3 w-3" /> Parcel Takeaway
                </span>
                <div class="font-display text-lg font-bold text-foreground mt-0.5">
                  {{ o.customerName || 'Takeaway' }}
                </div>
              </div>
              <div v-else class="font-display text-2xl font-black text-foreground">
                Table {{ o.tableNumber }}
              </div>
              <div class="text-[11px] font-medium text-muted-foreground mt-0.5 flex items-center gap-1.5">
                <Clock class="h-3 w-3 text-muted-foreground" /> {{ formatTime(o.createdAt) }}
                <span>·</span>
                <strong class="text-success">{{ (o.items || []).length }} item{{ (o.items || []).length !== 1 ? 's' : '' }} ready</strong>
              </div>
            </div>
            <div :class="['h-9 w-9 rounded-full grid place-items-center animate-pulse', (o.orderType === 'PARCEL' || Number(o.tableNumber) === 0) ? 'bg-purple-500/20 text-purple-600' : 'bg-success/15 text-success']">
              <BellRing class="h-4.5 w-4.5" />
            </div>
          </div>

          <!-- Dishes dropdown preview -->
          <div class="p-3 bg-muted/10 border-b border-border">
            <button
              @click="toggleExpandReady(String(o.id || o._id))"
              class="w-full py-1 px-2.5 rounded-lg text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/40 transition flex items-center justify-between"
            >
              <span>{{ expandedReadyOrders.has(String(o.id || o._id)) ? 'Hide dishes list ▲' : `View dishes (${(o.items || []).length}) ▼` }}</span>
              <span class="text-[10px] text-muted-foreground">Tap to view</span>
            </button>
            <div v-if="expandedReadyOrders.has(String(o.id || o._id))" class="mt-2 space-y-1 pt-1.5 border-t border-border/40">
              <div v-for="(it, i) in (o.items || [])" :key="i" class="flex items-center justify-between text-xs py-1 px-2 rounded-md bg-card border border-border/40">
                <span class="font-medium truncate"><span class="font-bold text-primary mr-1">{{ it.qty }}×</span>{{ it.name }}</span>
                <span class="text-muted-foreground shrink-0 text-[10px]">₹{{ (it.price * it.qty).toFixed(0) }}</span>
              </div>
            </div>
          </div>

          <!-- Action Button -->
          <div class="p-3 bg-card">
            <Button
              @click="handleServe(o.id || o._id, o.tableNumber, o.orderType === 'PARCEL' || Number(o.tableNumber) === 0, o.customerName)"
              class="w-full h-10 gradient-success text-success-foreground font-bold shadow-glow text-xs sm:text-sm cursor-pointer"
            >
              <CheckCircle2 class="h-4 w-4 mr-1.5" />
              {{ (o.orderType === 'PARCEL' || Number(o.tableNumber) === 0) ? 'Handover Parcel' : `Mark Table ${o.tableNumber} as Served` }}
            </Button>
          </div>
        </div>
      </div>
    </template>

    <!-- ══════════════════════════════════════════ -->
    <!--  2. HISTORY VIEW                           -->
    <!-- ══════════════════════════════════════════ -->
    <template v-else-if="view === 'history'">
      <div class="mb-4 space-y-3">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h1 class="font-display text-xl sm:text-2xl font-bold tracking-tight">Table History</h1>
            <p class="text-xs text-muted-foreground">Review recent and completed dining sessions.</p>
          </div>
        </div>
        <div class="relative max-w-md">
          <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            v-model="historySearch"
            placeholder="Search table, customer, dish, status…"
            class="pl-9 pr-8 h-9 text-xs bg-card"
          />
          <button
            v-if="historySearch"
            @click="historySearch = ''"
            class="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X class="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div v-if="allOrders.length === 0" class="rounded-3xl border-2 border-dashed border-border p-12 text-center text-muted-foreground">
        <UtensilsCrossed class="h-10 w-10 mx-auto mb-2 opacity-30" />
        <p class="text-base font-display">No past orders yet.</p>
      </div>
      <div v-else-if="filteredHistoryOrders.length === 0" class="rounded-3xl border-2 border-dashed border-border p-10 text-center text-muted-foreground">
        <Search class="h-8 w-8 mx-auto mb-2 opacity-40 text-muted-foreground" />
        <p class="font-semibold text-xs sm:text-sm">No orders match "{{ historySearch }}"</p>
        <Button size="sm" variant="ghost" class="mt-2 text-xs" @click="historySearch = ''">Clear Search</Button>
      </div>
      <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
        <div v-for="o in filteredHistoryOrders" :key="o.id || o._id" class="rounded-2xl bg-card border border-border shadow-soft overflow-hidden flex flex-col justify-between">
          <div class="p-3.5 border-b border-border flex items-center justify-between bg-muted/20">
            <div>
              <div class="font-display text-lg font-bold">{{ (o.orderType === 'PARCEL' || Number(o.tableNumber) === 0) ? `Parcel` : `Table ${o.tableNumber}` }}</div>
              <div class="text-[10px] text-muted-foreground">{{ (o.orderType === 'PARCEL' || Number(o.tableNumber) === 0) ? (o.customerName || 'Takeaway') : 'Dine-In' }}</div>
            </div>
            <span :class="['px-2 py-0.5 rounded-md border text-[10px] font-bold uppercase', o.status === 'COMPLETED' ? 'bg-success/10 text-success border-success/20' : o.status === 'CANCELLED' ? 'bg-destructive/10 text-destructive border-destructive/20' : o.status === 'READY' ? 'bg-success/10 text-success border-success/20' : 'bg-primary/10 text-primary border-primary/20']">
              {{ o.status }}
            </span>
          </div>
          <div class="p-3.5 space-y-1.5 max-h-40 overflow-y-auto">
            <div v-for="(it, i) in (o.items || [])" :key="i" class="flex justify-between text-xs">
              <span class="truncate mr-2"><strong class="text-primary font-bold">{{ it.qty }}×</strong> {{ it.name }}</span>
              <span class="tabular-nums text-muted-foreground shrink-0">₹{{ (it.price * it.qty).toFixed(0) }}</span>
            </div>
          </div>
          <div class="p-3 bg-muted/10 border-t border-border flex justify-between items-center text-xs">
            <span class="text-muted-foreground flex items-center gap-1"><Clock class="h-3 w-3" />{{ formatTime(o.createdAt) }}</span>
            <span class="font-display font-bold text-foreground">₹{{ (o.totalAmount || 0).toFixed(0) }}</span>
          </div>
        </div>
      </div>
    </template>

    <!-- ══════════════════════════════════════════ -->
    <!--  3. TAKE ORDER — Table Picker Mode         -->
    <!-- ══════════════════════════════════════════ -->
    <template v-else-if="!table">
      <div class="mb-4 space-y-3">
        <div>
          <h1 class="font-display text-xl sm:text-2xl font-bold tracking-tight">Select Table</h1>
          <p class="text-xs text-muted-foreground">Tap a table number to start taking the customer's order.</p>
        </div>

        <!-- Table search and filter pills -->
        <div class="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 p-2.5 rounded-2xl bg-card border border-border shadow-xs">
          <div class="relative flex-1 max-w-sm">
            <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              v-model="tableSearchQuery"
              placeholder="Search table # (e.g. 5, 12)…"
              class="pl-9 pr-8 h-8 text-xs bg-muted/30"
            />
            <button
              v-if="tableSearchQuery"
              @click="tableSearchQuery = ''"
              class="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X class="h-3.5 w-3.5" />
            </button>
          </div>

          <div class="flex items-center gap-1.5 shrink-0">
            <button
              @click="tableStatusFilter = 'ALL'"
              :class="['px-2.5 py-1 rounded-xl text-xs font-bold transition border', tableStatusFilter === 'ALL' ? 'bg-primary text-primary-foreground border-transparent' : 'bg-background border-border text-muted-foreground']"
            >
              All ({{ tables.length }})
            </button>
            <button
              @click="tableStatusFilter = 'available'"
              :class="['px-2.5 py-1 rounded-xl text-xs font-bold transition border', tableStatusFilter === 'available' ? 'bg-emerald-600 text-white border-transparent' : 'bg-background border-border text-muted-foreground']"
            >
              Free ({{ tables.filter(t => t.status === 'available').length }})
            </button>
            <button
              @click="tableStatusFilter = 'occupied'"
              :class="['px-2.5 py-1 rounded-xl text-xs font-bold transition border', tableStatusFilter === 'occupied' ? 'bg-primary text-primary-foreground border-transparent' : 'bg-background border-border text-muted-foreground']"
            >
              Occupied ({{ tables.filter(t => t.status === 'occupied').length }})
            </button>
          </div>
        </div>
      </div>

      <div v-if="loading" class="grid grid-cols-3 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-2.5">
        <div v-for="i in 16" :key="i" class="aspect-square rounded-2xl bg-muted/40 animate-pulse" />
      </div>
      <div v-else-if="filteredTables.length === 0" class="rounded-3xl border-2 border-dashed border-border p-10 text-center text-muted-foreground">
        <Search class="h-8 w-8 mx-auto mb-2 opacity-40 text-muted-foreground" />
        <p class="font-semibold text-xs sm:text-sm">No tables match "{{ tableSearchQuery }}"</p>
        <Button size="sm" variant="ghost" class="mt-2 text-xs" @click="tableSearchQuery = ''; tableStatusFilter = 'ALL'">Reset Filter</Button>
      </div>
      <div v-else class="grid grid-cols-3 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-2.5">
        <button
          v-for="t in filteredTables"
          :key="t.id"
          @click="selectTable(t.number)"
          :class="[
            'aspect-square rounded-2xl border-2 flex flex-col items-center justify-center p-2 transition-all active:scale-95 shadow-soft group relative',
            t.status === 'available'
              ? 'border-emerald-500/30 bg-emerald-500/5 hover:border-emerald-500/70 hover:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
              : t.kitchenStatus === 'PENDING'
                ? 'border-orange-500/60 bg-orange-500/10 hover:border-orange-500 hover:bg-orange-500/15 text-orange-700 dark:text-orange-400 ring-2 ring-orange-500/25'
                : t.kitchenStatus === 'PREPARING'
                  ? 'border-sky-500/50 bg-sky-500/10 hover:border-sky-500 hover:bg-sky-500/15 text-sky-700 dark:text-sky-400'
                  : t.kitchenStatus === 'READY'
                    ? 'border-purple-500 bg-purple-500/15 hover:bg-purple-500/20 text-purple-700 dark:text-purple-300 ring-2 ring-purple-500/30'
                    : 'border-primary/40 bg-primary/8 hover:border-primary text-primary'
          ]"
        >
          <!-- Corner pill for kitchen status -->
          <div v-if="t.kitchenStatus === 'PENDING'" class="absolute top-1.5 right-1.5 flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-orange-600 text-white text-[8px] font-black uppercase tracking-wider shadow-xs">
            <span>Edit</span>
          </div>
          <div v-else-if="t.kitchenStatus === 'PREPARING'" class="absolute top-1.5 right-1.5 flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-sky-600 text-white text-[8px] font-black uppercase tracking-wider shadow-xs">
            <span>Cooking</span>
          </div>
          <div v-else-if="t.kitchenStatus === 'READY'" class="absolute top-1.5 right-1.5 flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-purple-600 text-white text-[8px] font-black uppercase tracking-wider shadow-xs animate-pulse">
            <span>Ready</span>
          </div>

          <div class="text-[9px] uppercase tracking-wider font-bold opacity-75">T-{{ String(t.number).padStart(2, '0') }}</div>
          <div class="font-display text-2xl sm:text-3xl font-black leading-none my-0.5">{{ t.number }}</div>
          <div class="text-[9px] font-bold uppercase tracking-wider truncate max-w-full text-center">
            <span v-if="t.status === 'available'">● Free</span>
            <span v-else-if="t.kitchenStatus === 'PENDING'">● Pending (Edit)</span>
            <span v-else-if="t.kitchenStatus === 'PREPARING'">● Cooking 🔒</span>
            <span v-else-if="t.kitchenStatus === 'READY'">● Ready! 🔔</span>
            <span v-else>● Dining</span>
          </div>
        </button>
      </div>
    </template>

    <!-- ══════════════════════════════════════════ -->
    <!--  4. TAKE ORDER — Menu Ordering POS Mode    -->
    <!-- ══════════════════════════════════════════ -->
    <template v-else>
      <!-- Sub-header: Table Details, Active bill badge, and View Mode Switcher -->
      <div class="flex items-center justify-between gap-2.5 mb-3.5">
        <div class="flex items-center gap-2 min-w-0">
          <button
            @click="table = null"
            class="h-9 w-9 rounded-xl border border-border bg-card hover:bg-muted flex items-center justify-center shadow-xs transition shrink-0"
            title="Change Table"
          >
            <ArrowLeft class="h-4 w-4" />
          </button>
          <div class="min-w-0">
            <div class="flex items-center gap-1.5">
              <h1 class="font-display text-lg sm:text-xl font-bold leading-none truncate">Table {{ table }}</h1>
              <span class="px-2 py-0.5 rounded-md bg-primary/10 text-primary text-[10px] font-bold uppercase">
                POS
              </span>
            </div>
            <p class="text-[11px] text-muted-foreground truncate mt-0.5">Punch in items below</p>
          </div>
        </div>

        <!-- Right: Active Bill Pill (If dining) -->
        <div class="flex items-center gap-1.5 shrink-0">
          <button
            v-if="activeOrderForTable"
            @click="activeOrderModalOpen = true"
            class="h-9 px-2.5 rounded-xl border border-primary/40 bg-primary/10 hover:bg-primary/20 text-primary flex items-center gap-1.5 text-xs font-bold shadow-xs transition cursor-pointer"
          >
            <Receipt class="h-3.5 w-3.5" />
            <span class="hidden sm:inline">Active Bill:</span>
            <span>₹{{ (activeOrderForTable.totalAmount || 0).toFixed(0) }}</span>
          </button>
        </div>
      </div>

      <!-- ── Active Order Kitchen Status Banner (Interactive Workflow) ── -->
      <div v-if="activeOrderForTable" class="mb-4">
        <!-- 1. PENDING: Chef has NOT pressed Start Cooking (Waiter CAN update order) -->
        <div
          v-if="isOrderPending"
          class="p-3.5 sm:p-4 rounded-2xl bg-orange-500/10 border-2 border-orange-500/40 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3"
        >
          <div class="flex items-start sm:items-center gap-3">
            <div class="h-10 w-10 rounded-xl bg-orange-500/20 text-orange-600 dark:text-orange-400 grid place-items-center shrink-0">
              <Clock class="h-5 w-5" />
            </div>
            <div>
              <div class="flex items-center gap-2 flex-wrap">
                <span class="font-display font-bold text-sm sm:text-base text-foreground">
                  Order Pending in Kitchen
                </span>
                <Badge class="bg-orange-500/20 text-orange-800 dark:text-orange-200 border-orange-500/30 text-[10px] font-bold">
                  Chef hasn't started cooking yet
                </Badge>
              </div>
              <p class="text-xs text-muted-foreground mt-0.5">
                You can change quantities, add dishes, or delete items until chef clicks "Start Cooking".
              </p>
            </div>
          </div>

          <div class="flex items-center gap-2 shrink-0">
            <Button
              @click="openUpdateOrderModal"
              size="sm"
              class="h-9 px-3.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <Edit class="h-3.5 w-3.5" />
              <span>Update Order</span>
            </Button>
            <Button
              @click="activeOrderModalOpen = true"
              variant="outline"
              size="sm"
              class="h-9 px-3 rounded-xl border-orange-500/40 text-orange-800 dark:text-orange-200 hover:bg-orange-500/10 text-xs font-semibold cursor-pointer"
            >
              <Receipt class="h-3.5 w-3.5 mr-1" />
              <span>View Ticket</span>
            </Button>
          </div>
        </div>

        <!-- 2. PREPARING: Chef HAS pressed Start Cooking (Order LOCKED for waiter) -->
        <div
          v-else-if="isOrderCooking"
          class="p-3.5 sm:p-4 rounded-2xl bg-blue-500/10 border-2 border-blue-500/30 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3"
        >
          <div class="flex items-start sm:items-center gap-3">
            <div class="h-10 w-10 rounded-xl bg-blue-500/20 text-blue-600 dark:text-blue-400 grid place-items-center shrink-0">
              <Flame class="h-5 w-5 animate-pulse text-amber-500" />
            </div>
            <div>
              <div class="flex items-center gap-2 flex-wrap">
                <span class="font-display font-bold text-sm sm:text-base text-foreground">
                  Cooking in Progress
                </span>
                <Badge class="bg-blue-500/20 text-blue-700 dark:text-blue-300 border-blue-500/30 text-[10px] font-bold">
                  🔒 Order Locked
                </Badge>
              </div>
              <p class="text-xs text-muted-foreground mt-0.5">
                Chef has pressed "Start Cooking". These items can no longer be updated or cancelled.
              </p>
            </div>
          </div>

          <div class="flex items-center gap-2 shrink-0">
            <Button
              @click="activeOrderModalOpen = true"
              variant="outline"
              size="sm"
              class="h-9 px-3.5 rounded-xl border-blue-500/40 text-blue-700 dark:text-blue-300 text-xs font-bold cursor-pointer"
            >
              <Receipt class="h-3.5 w-3.5 mr-1.5" />
              <span>View Live Ticket</span>
            </Button>
          </div>
        </div>

        <!-- 3. READY: Food is ready for pickup -->
        <div
          v-else-if="isOrderReady"
          class="p-3.5 sm:p-4 rounded-2xl bg-success/10 border-2 border-success/40 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3"
        >
          <div class="flex items-start sm:items-center gap-3">
            <div class="h-10 w-10 rounded-xl bg-success/20 text-success grid place-items-center shrink-0 animate-bounce">
              <BellRing class="h-5 w-5" />
            </div>
            <div>
              <div class="flex items-center gap-2 flex-wrap">
                <span class="font-display font-bold text-sm sm:text-base text-foreground">
                  Dishes Ready for Handover!
                </span>
                <Badge class="bg-success/20 text-success border-success/30 text-[10px] font-bold">
                  Kitchen Finished
                </Badge>
              </div>
              <p class="text-xs text-muted-foreground mt-0.5">
                Kitchen has completed preparing this table. Pick up dishes from the counter and serve.
              </p>
            </div>
          </div>

          <div class="flex items-center gap-2 shrink-0">
            <Button
              @click="handleServe(activeOrderForTable.id || activeOrderForTable._id, activeOrderForTable.tableNumber)"
              size="sm"
              class="h-9 px-4 rounded-xl gradient-success text-success-foreground text-xs font-bold shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <CheckCircle2 class="h-3.5 w-3.5" />
              <span>Mark Served</span>
            </Button>
          </div>
        </div>
      </div>

      <!-- Main Ordering Area: Two-Column (Menu + Desktop Sticky Cart) -->
      <div class="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-6 items-start pb-24 lg:pb-8">
        
        <!-- Left: Search + Category Pills + Menu Items Grid / List -->
        <div class="min-w-0 space-y-3">
          
          <!-- Search Bar -->
          <div class="relative">
            <Search class="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              v-model="menuSearch"
              placeholder="Search dishes, drinks (e.g. dosa, tea, burger)…"
              class="pl-10 pr-9 h-10 rounded-2xl bg-card border-border shadow-xs text-xs sm:text-sm"
            />
            <button
              v-if="menuSearch"
              @click="menuSearch = ''"
              class="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1"
            >
              <X class="h-3.5 w-3.5" />
            </button>
          </div>

          <!-- Category Pills (Horizontal Touch Carousel) -->
          <div class="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none -mx-1 px-1">
            <button
              @click="cat = 'All'"
              :class="[
                'shrink-0 px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition border',
                cat === 'All'
                  ? 'gradient-primary text-primary-foreground border-transparent shadow-xs'
                  : 'bg-card border-border text-muted-foreground hover:text-foreground'
              ]"
            >
              All Dishes
            </button>
            <button
              v-for="category in menuCategories"
              :key="category._id || category.id"
              @click="cat = category._id || category.id || ''"
              :class="[
                'shrink-0 px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition border',
                cat === (category._id || category.id)
                  ? 'gradient-primary text-primary-foreground border-transparent shadow-xs'
                  : 'bg-card border-border text-muted-foreground hover:text-foreground'
              ]"
            >
              {{ category.name }}
            </button>
            <span class="ml-auto text-xs text-muted-foreground font-medium hidden sm:inline whitespace-nowrap">
              {{ filteredMenuItems.length }} item{{ filteredMenuItems.length !== 1 ? 's' : '' }}
            </span>
          </div>

          <!-- Zero Match Search State -->
          <div v-if="filteredMenuItems.length === 0" class="rounded-3xl border-2 border-dashed border-border p-10 text-center text-muted-foreground">
            <Search class="h-8 w-8 mx-auto mb-2 opacity-30 text-muted-foreground" />
            <p class="font-semibold text-xs sm:text-sm">No dishes found{{ menuSearch ? ` matching "${menuSearch}"` : ' in this category' }}.</p>
            <Button v-if="menuSearch" size="sm" variant="ghost" class="mt-2 text-xs" @click="menuSearch = ''; cat = 'All'">
              Reset Filters
            </Button>
          </div>

          <!-- ── Static Responsive Menu View ── -->
          <div v-else>
            <!-- Laptop / Screen larger than phone (>= sm): Box-type Menu Cards matching img1 -->
            <div class="hidden sm:grid sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-3.5">
              <div
                v-for="m in filteredMenuItems"
                :key="'desktop-' + m.id"
                @click="getCartItemQty(m.id) === 0 && add(m)"
                :class="[
                  'rounded-[26px] bg-card border p-4 sm:p-5 flex flex-col justify-between transition-all duration-200 shadow-xs hover:shadow-md relative overflow-hidden select-none',
                  getCartItemQty(m.id) === 0 ? 'cursor-pointer hover:border-primary/50' : '',
                  getCartItemQty(m.id) > 0
                    ? 'border-primary ring-2 ring-primary/20 bg-primary/[0.02]'
                    : 'border-border/80'
                ]"
              >
                <!-- Card Top: Fork/Knife Icon & Category Label (img1 design) -->
                <div>
                  <div class="flex items-center justify-between mb-2">
                    <div class="flex items-center gap-1.5">
                      <span v-if="m.emoji && m.emoji !== '🍴'" class="text-xl select-none">{{ m.emoji }}</span>
                      <span v-else class="text-lg select-none">🍴</span>
                    </div>
                    <span class="text-[10px] sm:text-[11px] font-bold text-muted-foreground uppercase tracking-widest truncate max-w-[130px]">
                      {{ m.categoryName }}
                    </span>
                  </div>

                  <!-- Dish Title & Description (img1 design) -->
                  <div class="font-bold text-base sm:text-lg leading-snug text-foreground mt-1 line-clamp-1" :title="m.name">
                    {{ m.name }}
                  </div>
                  <div class="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed min-h-[34px]">
                    {{ m.description || 'Single-serve chilled item maintained with finest ingredients.' }}
                  </div>
                </div>

                <!-- Card Bottom: Divider + Price & Add Button (img1 design) -->
                <div class="mt-3.5 pt-3 border-t border-border/60 flex items-center justify-between gap-2">
                  <div class="font-display text-xl sm:text-2xl font-black text-primary tabular-nums tracking-tight">
                    ₹{{ m.price.toFixed(0) }}
                  </div>

                  <!-- Stepper control if in cart -->
                  <div v-if="getCartItemQty(m.id) > 0" class="flex items-center gap-1 bg-background rounded-full p-0.5 border border-primary/40 shadow-xs" @click.stop>
                    <button
                      @click.stop="dec(m.id)"
                      class="h-7 w-7 rounded-full bg-muted/60 hover:bg-muted active:scale-90 flex items-center justify-center text-foreground transition cursor-pointer"
                      aria-label="Decrease quantity"
                    >
                      <Minus class="h-3 w-3" />
                    </button>
                    <span class="w-6 text-center text-xs font-black text-primary tabular-nums">
                      {{ getCartItemQty(m.id) }}
                    </span>
                    <button
                      @click.stop="add(m)"
                      class="h-7 w-7 rounded-full gradient-primary text-primary-foreground active:scale-90 flex items-center justify-center transition shadow-xs cursor-pointer"
                      aria-label="Increase quantity"
                    >
                      <Plus class="h-3 w-3" />
                    </button>
                  </div>

                  <!-- Single Add Button if not in cart (img1 pill button) -->
                  <button
                    v-else
                    @click.stop="add(m)"
                    class="h-8 px-4 rounded-full border border-border/80 bg-card hover:bg-primary hover:text-primary-foreground text-foreground font-semibold text-xs sm:text-sm flex items-center gap-1.5 shadow-xs transition active:scale-95 cursor-pointer"
                  >
                    <Plus class="h-3.5 w-3.5" />
                    <span>Add</span>
                  </button>
                </div>
              </div>
            </div>

            <!-- Mobile Screen (< sm / Phone Screen): Small Rectangle Box for Efficient Ordering -->
            <div class="block sm:hidden space-y-2">
              <div
                v-for="m in filteredMenuItems"
                :key="'mobile-' + m.id"
                :class="[
                  'p-3 rounded-2xl bg-card border flex items-center justify-between gap-3 transition shadow-xs',
                  getCartItemQty(m.id) > 0
                    ? 'border-primary ring-1 ring-primary/30 bg-primary/5'
                    : 'border-border'
                ]"
              >
                <!-- Left: Dish Emoji/Icon + Information -->
                <div class="flex items-center gap-3 min-w-0 flex-1">
                  <div class="h-11 w-11 rounded-xl bg-muted/50 border border-border/60 flex items-center justify-center text-xl shrink-0 select-none">
                    <span v-if="m.emoji && m.emoji !== '🍴'">{{ m.emoji }}</span>
                    <span v-else>🍴</span>
                  </div>
                  <div class="min-w-0 flex-1">
                    <div class="text-[9.5px] uppercase font-bold text-muted-foreground tracking-wider truncate max-w-[120px]">
                      {{ m.categoryName }}
                    </div>
                    <div class="font-bold text-sm text-foreground truncate leading-tight mt-0.5">
                      {{ m.name }}
                    </div>
                    <div class="font-bold text-sm text-primary tabular-nums mt-0.5">
                      ₹{{ m.price.toFixed(0) }}
                    </div>
                  </div>
                </div>

                <!-- Right: Fast Add Button / Stepper -->
                <div class="shrink-0">
                  <div v-if="getCartItemQty(m.id) > 0" class="flex items-center gap-1 bg-background rounded-full p-0.5 border border-primary/40 shadow-xs">
                    <button
                      @click="dec(m.id)"
                      class="h-8 w-8 rounded-full bg-muted/70 hover:bg-muted active:scale-90 flex items-center justify-center text-foreground transition cursor-pointer"
                      aria-label="Decrease quantity"
                    >
                      <Minus class="h-3.5 w-3.5" />
                    </button>
                    <span class="w-6 text-center text-xs font-black text-primary tabular-nums">
                      {{ getCartItemQty(m.id) }}
                    </span>
                    <button
                      @click="add(m)"
                      class="h-8 w-8 rounded-full gradient-primary text-primary-foreground active:scale-90 flex items-center justify-center transition shadow-xs cursor-pointer"
                      aria-label="Increase quantity"
                    >
                      <Plus class="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <button
                    v-else
                    @click="add(m)"
                    class="h-8 px-3.5 rounded-full border border-border/80 bg-card hover:bg-primary hover:text-primary-foreground text-foreground font-semibold text-xs flex items-center gap-1 shadow-xs transition active:scale-95 cursor-pointer"
                  >
                    <Plus class="h-3.5 w-3.5" />
                    <span>Add</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- ── Right: Desktop Sticky Cart Sidebar ── -->
        <aside class="hidden lg:flex flex-col rounded-3xl bg-card border border-border shadow-card sticky top-20 max-h-[calc(100vh-6rem)] overflow-hidden">
          <!-- Cart Header -->
          <div class="p-4 border-b border-border flex items-center justify-between shrink-0 bg-muted/20">
            <div>
              <div class="font-display text-base font-bold">Table {{ table }} Ticket</div>
              <div class="text-xs text-muted-foreground">{{ totalCartItems }} items in order</div>
            </div>
            <button @click="table = null" class="text-xs text-muted-foreground hover:text-foreground transition px-2 py-1 rounded-lg hover:bg-muted">
              Change Table
            </button>
          </div>

          <!-- Items list -->
          <div class="flex-1 overflow-y-auto p-3 space-y-2">
            <div v-if="cart.length === 0" class="text-center py-12 text-muted-foreground text-xs flex flex-col items-center gap-2">
              <ShoppingBag class="h-8 w-8 opacity-20" />
              <span>Cart is empty.<br />Tap menu items to add.</span>
            </div>
            <div v-for="l in cart" :key="l.id" class="p-2.5 rounded-2xl bg-muted/30 border border-border/40 space-y-1.5">
              <div class="flex items-center justify-between gap-2">
                <div class="flex items-center gap-2 min-w-0">
                  <span class="text-lg">{{ l.emoji }}</span>
                  <div class="min-w-0">
                    <div class="font-semibold text-xs truncate">{{ l.name }}</div>
                    <div class="text-[10px] text-muted-foreground">₹{{ l.price.toFixed(0) }} × {{ l.qty }} = <strong>₹{{ (l.price * l.qty).toFixed(0) }}</strong></div>
                  </div>
                </div>
                <div class="flex items-center gap-1 shrink-0">
                  <button @click="dec(l.id)" class="h-6 w-6 grid place-items-center rounded-lg bg-background hover:bg-muted border border-border transition">
                    <Minus class="h-3 w-3" />
                  </button>
                  <span class="w-5 text-center text-xs font-bold tabular-nums">{{ l.qty }}</span>
                  <button @click="add(menuItems.find(m => m.id === l.id)!)" class="h-6 w-6 grid place-items-center rounded-lg bg-background hover:bg-muted border border-border transition">
                    <Plus class="h-3 w-3" />
                  </button>
                  <button @click="remove(l.id)" class="h-6 w-6 grid place-items-center rounded-lg text-destructive hover:bg-destructive/10 ml-0.5 transition">
                    <Trash2 class="h-3 w-3" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Kitchen notes + totals + Place button -->
          <div class="p-4 border-t border-border space-y-2 shrink-0 bg-muted/10">
            <div>
              <Input
                v-model="orderNotes"
                placeholder="Kitchen note (e.g. spicy, no onion)…"
                class="h-8 text-xs bg-background"
              />
            </div>
            <div class="flex justify-between text-xs text-muted-foreground"><span>Subtotal</span><span class="tabular-nums">₹{{ subtotal.toFixed(0) }}</span></div>
            <div class="flex justify-between text-xs text-muted-foreground"><span>Tax (8% GST)</span><span class="tabular-nums">₹{{ tax.toFixed(0) }}</span></div>
            <div class="flex justify-between font-display text-lg font-bold pt-1 border-t border-border"><span>Total</span><span class="tabular-nums text-primary">₹{{ total.toFixed(0) }}</span></div>
            <Button
              @click="place"
              :disabled="cart.length === 0 || placingOrder"
              class="w-full h-11 gradient-primary text-primary-foreground font-bold shadow-glow text-sm rounded-xl"
            >
              <Send class="h-4 w-4 mr-1.5" />
              {{ placingOrder ? 'Placing Order...' : 'Send to Kitchen' }}
            </Button>
          </div>
        </aside>
      </div>

      <!-- ══════════════════════════════════════════ -->
      <!--  Mobile Persistent Floating Bottom Bar     -->
      <!-- ══════════════════════════════════════════ -->
      <div
        v-if="cart.length > 0"
        class="lg:hidden fixed bottom-0 left-0 right-0 z-40 p-3 bg-background/95 backdrop-blur-md border-t border-border shadow-2xl safe-area-bottom animate-in slide-in-from-bottom duration-200"
      >
        <div class="flex items-center justify-between gap-3 max-w-lg mx-auto">
          <!-- Left: Cart Summary Pill (Tap to open sheet) -->
          <button
            @click="mobileCartOpen = true"
            class="flex items-center gap-2.5 text-left min-w-0 flex-1 group"
          >
            <div class="h-10 w-10 rounded-xl gradient-primary text-primary-foreground grid place-items-center font-black text-xs shrink-0 shadow-soft">
              {{ totalCartItems }}
            </div>
            <div class="min-w-0">
              <div class="text-xs font-bold text-foreground truncate">Table {{ table }} Order</div>
              <div class="text-xs text-primary font-bold">
                ₹{{ total.toFixed(0) }}
                <span class="text-[10px] text-muted-foreground font-normal">incl. tax</span>
              </div>
            </div>
          </button>

          <!-- Right: View & Place Button -->
          <Button
            @click="mobileCartOpen = true"
            class="gradient-primary text-primary-foreground font-bold text-xs px-4 h-10 shadow-glow rounded-xl flex items-center gap-1.5 shrink-0"
          >
            <ShoppingBag class="h-4 w-4" />
            <span>Review & Place ({{ cart.length }})</span>
            <ArrowRight class="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

    </template>

    <!-- ══════════════════════════════════════════ -->
    <!--  Mobile Slide-up Cart Bottom Sheet Drawer  -->
    <!-- ══════════════════════════════════════════ -->
    <Teleport to="body">
      <Transition name="drawer">
        <div v-if="mobileCartOpen" class="lg:hidden fixed inset-0 z-50 flex flex-col justify-end">
          <div class="absolute inset-0 bg-black/60 backdrop-blur-xs" @click="mobileCartOpen = false" />
          <div class="relative bg-background rounded-t-3xl shadow-card flex flex-col max-h-[85dvh] overflow-hidden border-t border-border/60">
            <!-- Drag handle -->
            <div class="flex justify-center pt-3 pb-1 shrink-0 cursor-pointer" @click="mobileCartOpen = false">
              <div class="h-1.5 w-12 rounded-full bg-border" />
            </div>

            <!-- Sheet Header -->
            <div class="px-5 py-3 border-b border-border flex items-center justify-between shrink-0 bg-muted/20">
              <div>
                <div class="font-display text-lg font-bold">Table {{ table }} Ticket</div>
                <div class="text-xs text-muted-foreground">{{ totalCartItems }} items in order</div>
              </div>
              <button
                @click="mobileCartOpen = false"
                class="h-8 w-8 rounded-xl bg-muted hover:bg-muted/80 grid place-items-center text-muted-foreground hover:text-foreground"
              >
                <X class="h-4 w-4" />
              </button>
            </div>

            <!-- Items List -->
            <div class="flex-1 overflow-y-auto p-4 space-y-2.5">
              <div v-if="cart.length === 0" class="text-center py-10 text-muted-foreground text-sm flex flex-col items-center gap-2">
                <ShoppingBag class="h-8 w-8 opacity-20" />
                <span>Cart is empty.</span>
              </div>
              <div
                v-for="l in cart"
                :key="l.id"
                class="p-3 rounded-2xl bg-card border border-border/80 shadow-xs flex items-center justify-between gap-3"
              >
                <div class="flex items-center gap-2.5 min-w-0 flex-1">
                  <span class="text-2xl shrink-0">{{ l.emoji }}</span>
                  <div class="min-w-0">
                    <div class="font-bold text-xs sm:text-sm truncate">{{ l.name }}</div>
                    <div class="text-[11px] text-muted-foreground">
                      ₹{{ l.price.toFixed(0) }} · <strong>₹{{ (l.price * l.qty).toFixed(0) }}</strong>
                    </div>
                  </div>
                </div>

                <div class="flex items-center gap-1.5 shrink-0">
                  <button
                    @click="dec(l.id)"
                    class="h-8 w-8 grid place-items-center rounded-xl bg-muted hover:bg-muted/80 border border-border transition active:scale-90"
                  >
                    <Minus class="h-3.5 w-3.5" />
                  </button>
                  <span class="w-6 text-center text-xs font-black tabular-nums text-primary">
                    {{ l.qty }}
                  </span>
                  <button
                    @click="add(menuItems.find(m => m.id === l.id)!)"
                    class="h-8 w-8 grid place-items-center rounded-xl gradient-primary text-primary-foreground shadow-xs active:scale-90"
                  >
                    <Plus class="h-3.5 w-3.5" />
                  </button>
                  <button
                    @click="remove(l.id)"
                    class="h-8 w-8 grid place-items-center rounded-xl text-destructive hover:bg-destructive/10 ml-1"
                  >
                    <Trash2 class="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>

            <!-- Notes & Totals & Submit Footer -->
            <div class="p-4 border-t border-border space-y-2.5 shrink-0 bg-muted/10 pb-safe">
              <div>
                <Input
                  v-model="orderNotes"
                  placeholder="Special instructions for kitchen (e.g. less spicy)…"
                  class="h-9 text-xs bg-background"
                />
              </div>

              <div class="space-y-1 pt-1">
                <div class="flex justify-between text-xs text-muted-foreground">
                  <span>Subtotal</span>
                  <span class="tabular-nums font-semibold">₹{{ subtotal.toFixed(0) }}</span>
                </div>
                <div class="flex justify-between text-xs text-muted-foreground">
                  <span>GST (8%)</span>
                  <span class="tabular-nums font-semibold">₹{{ tax.toFixed(0) }}</span>
                </div>
                <div class="flex justify-between font-display text-lg font-bold pt-1.5 border-t border-border text-foreground">
                  <span>Total Amount</span>
                  <span class="tabular-nums text-primary">₹{{ total.toFixed(0) }}</span>
                </div>
              </div>

              <Button
                @click="place"
                :disabled="cart.length === 0 || placingOrder"
                class="w-full h-12 gradient-primary text-primary-foreground font-bold shadow-glow text-sm rounded-2xl"
              >
                <Send class="h-4 w-4 mr-2" />
                {{ placingOrder ? 'Sending Order...' : `Send to Kitchen · ₹${total.toFixed(0)}` }}
              </Button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- ── Live Table Order Details Modal ── -->
    <Dialog :open="activeOrderModalOpen" @update:open="activeOrderModalOpen = $event">
      <DialogContent class="sm:max-w-lg max-h-[85vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader class="p-5 pb-3 border-b border-border bg-card">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2.5">
              <div class="h-9 w-9 rounded-xl gradient-primary grid place-items-center text-primary-foreground">
                <Receipt class="h-4.5 w-4.5" />
              </div>
              <div>
                <DialogTitle class="font-display text-xl font-bold">
                  Table {{ table }} — Live Dining Ticket
                </DialogTitle>
                <DialogDescription class="text-xs text-muted-foreground mt-0.5">
                  Ordered {{ elapsed(activeOrderForTable?.createdAt) }} ago · Dining in progress
                </DialogDescription>
              </div>
            </div>
            <Badge :variant="activeOrderForTable?.status === 'READY' ? 'default' : 'secondary'" class="text-xs font-bold px-2.5 py-1">
              {{ activeOrderForTable?.status }}
            </Badge>
          </div>
        </DialogHeader>

        <!-- Kitchen Cooking State Banner -->
        <div class="px-5 pt-3">
          <div
            v-if="isOrderPending"
            class="p-3 rounded-xl bg-orange-500/10 border border-orange-500/30 text-orange-800 dark:text-orange-200 flex items-center justify-between gap-2 text-xs"
          >
            <div class="flex items-center gap-2">
              <Clock class="h-4 w-4 shrink-0 text-orange-600 dark:text-orange-400" />
              <span><strong>Cooking Not Started:</strong> You can still edit dishes or quantities.</span>
            </div>
            <Button
              @click="activeOrderModalOpen = false; openUpdateOrderModal()"
              size="sm"
              class="h-7 px-2.5 bg-orange-600 hover:bg-orange-700 text-white font-bold text-[11px] shrink-0 cursor-pointer shadow-xs"
            >
              <Edit class="h-3 w-3 mr-1" /> Edit Order
            </Button>
          </div>
          <div
            v-else-if="isOrderCooking"
            class="p-3 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-700 dark:text-blue-300 flex items-center gap-2 text-xs"
          >
            <Lock class="h-4 w-4 shrink-0 text-blue-500" />
            <span><strong>Cooking in Progress:</strong> Chef pressed "Start Cooking". Order is locked for modifications.</span>
          </div>
          <div
            v-else-if="isOrderReady"
            class="p-3 rounded-xl bg-success/10 border border-success/30 text-success flex items-center gap-2 text-xs"
          >
            <BellRing class="h-4 w-4 shrink-0" />
            <span><strong>Ready for Pickup:</strong> Chef finished cooking. Pick up and serve.</span>
          </div>
        </div>

        <!-- Items Breakdown -->
        <div class="flex-1 overflow-y-auto p-5 space-y-3 min-h-[200px]">
          <div class="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center justify-between">
            <span>Ordered Dishes ({{ activeOrderForTable?.items?.length || 0 }})</span>
            <span>Status</span>
          </div>

          <div
            v-for="(item, idx) in (activeOrderForTable?.items || [])"
            :key="idx"
            class="flex items-center justify-between p-3 rounded-xl border border-border bg-muted/20 hover:bg-muted/40 transition gap-3"
          >
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-2">
                <span class="font-bold text-primary tabular-nums text-sm">{{ item.qty }}×</span>
                <span class="font-semibold text-sm text-foreground truncate">{{ item.name }}</span>
              </div>
              <div class="text-xs text-muted-foreground mt-0.5">
                ₹{{ item.price }} each · <strong class="text-foreground font-semibold">₹{{ (item.price * item.qty).toFixed(0) }}</strong>
                <span v-if="item.note" class="text-destructive ml-2 font-medium">({{ item.note }})</span>
              </div>
            </div>
            <div class="shrink-0">
              <span
                :class="[
                  'px-2 py-0.5 rounded-md text-[10px] font-bold uppercase border',
                  item.status === 'DELIVERED' ? 'bg-success/15 text-success border-success/30' :
                  item.status === 'READY' ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 animate-pulse' :
                  item.status === 'PREPARING' ? 'bg-primary/15 text-primary border-primary/30' :
                  'bg-muted text-muted-foreground border-border'
                ]"
              >
                {{ item.status || 'PENDING' }}
              </span>
            </div>
          </div>

          <!-- Totals Summary -->
          <div class="mt-4 pt-4 border-t border-border space-y-2 bg-card p-4 rounded-xl border">
            <div class="flex justify-between text-xs text-muted-foreground">
              <span>Subtotal</span>
              <span class="tabular-nums font-medium">₹{{ ((activeOrderForTable?.items || []).reduce((s: number, i: any) => s + (i.price * i.qty), 0)).toFixed(0) }}</span>
            </div>
            <div class="flex justify-between text-xs text-muted-foreground">
              <span>GST</span>
              <span class="tabular-nums font-medium">₹{{ (activeOrderForTable?.gst || 0).toFixed(0) }}</span>
            </div>
            <div class="flex justify-between text-base font-display font-bold pt-2 border-t border-border text-foreground">
              <span>Current Total</span>
              <span class="tabular-nums text-primary font-bold">₹{{ (activeOrderForTable?.totalAmount || 0).toFixed(0) }}</span>
            </div>
          </div>
        </div>

        <!-- Dialog Footer -->
        <div class="p-3.5 border-t border-border bg-card flex items-center justify-between gap-2">
          <div v-if="isOrderPending">
            <Button
              @click="handleCancelPendingOrder"
              :disabled="cancelingOrder"
              variant="ghost"
              size="sm"
              class="h-8 text-xs text-destructive hover:bg-destructive/10 font-bold"
            >
              <Trash2 class="h-3 w-3 mr-1" />
              Cancel Order
            </Button>
          </div>
          <div v-else class="text-[11px] text-muted-foreground flex items-center gap-1">
            <Lock class="h-3.5 w-3.5" /> Order locked (cooking started)
          </div>

          <div class="flex items-center gap-2">
            <Button
              @click="activeOrderModalOpen = false"
              variant="outline"
              size="sm"
              class="h-8 text-xs font-semibold"
            >
              Close
            </Button>
            <Button
              v-if="isOrderPending"
              @click="activeOrderModalOpen = false; openUpdateOrderModal()"
              size="sm"
              class="h-8 px-3.5 bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold shadow-xs flex items-center gap-1 cursor-pointer"
            >
              <Edit class="h-3.5 w-3.5" /> Update Order
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>

    <!-- ── Update / Edit Kitchen Order Modal (Available strictly until Chef starts cooking) ── -->
    <Dialog :open="updateOrderModalOpen" @update:open="updateOrderModalOpen = $event">
      <DialogContent class="sm:max-w-xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader class="p-5 pb-3 border-b border-border bg-card">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2.5">
              <div class="h-9 w-9 rounded-xl bg-orange-500/20 text-orange-600 dark:text-orange-400 grid place-items-center">
                <Edit class="h-4.5 w-4.5" />
              </div>
              <div>
                <DialogTitle class="font-display text-xl font-bold">
                  Update Table {{ table }} Order
                </DialogTitle>
                <DialogDescription class="text-xs text-muted-foreground mt-0.5">
                  Editable while Chef has not started cooking
                </DialogDescription>
              </div>
            </div>
            <Badge class="bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30 text-xs font-bold px-2.5 py-1">
              {{ activeOrderForTable?.status || 'PENDING' }}
            </Badge>
          </div>
        </DialogHeader>

        <div class="flex-1 overflow-y-auto p-5 space-y-4">
          <!-- Live Status Guard Banner -->
          <div
            v-if="!isOrderPending"
            class="p-3 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive flex items-start gap-2 text-xs"
          >
            <AlertCircle class="h-4 w-4 shrink-0 mt-0.5" />
            <div>
              <strong>Order is now locked!</strong>
              <p>Chef has pressed "Start Cooking". You can no longer update this order.</p>
            </div>
          </div>
          <div
            v-else
            class="p-3 rounded-xl bg-orange-500/10 border border-orange-500/30 text-orange-800 dark:text-orange-200 flex items-start gap-2 text-xs"
          >
            <Clock class="h-4 w-4 shrink-0 mt-0.5 text-orange-600 dark:text-orange-400" />
            <div>
              <strong>Kitchen Status: Pending Cooking</strong>
              <p>You can modify items, adjust quantities, or add more dishes. Once chef clicks "Start Cooking", modifications are locked.</p>
            </div>
          </div>

          <!-- Items in Order -->
          <div class="space-y-2">
            <div class="flex items-center justify-between text-xs font-bold text-muted-foreground uppercase tracking-wider">
              <span>Ordered Dishes ({{ editableOrderItems.length }})</span>
              <span>Quantity & Price</span>
            </div>

            <div v-if="editableOrderItems.length === 0" class="text-center py-8 text-muted-foreground text-xs border border-dashed rounded-xl p-4">
              All items removed. Add a dish below or cancel the order.
            </div>

            <div
              v-for="(item, idx) in editableOrderItems"
              :key="item.id"
              class="p-3 rounded-2xl bg-card border border-border/80 shadow-xs flex flex-col gap-2 transition hover:border-border"
            >
              <div class="flex items-center justify-between gap-3">
                <div class="min-w-0 flex-1">
                  <div class="flex items-center gap-1.5">
                    <span v-if="item.isNew" class="px-1.5 py-0.2 rounded bg-primary/20 text-primary text-[9px] font-black uppercase">
                      NEW
                    </span>
                    <span class="font-bold text-sm text-foreground truncate">{{ item.name }}</span>
                  </div>
                  <div class="text-xs text-muted-foreground mt-0.5">
                    ₹{{ item.price }} each · <strong class="text-foreground">₹{{ (item.price * item.qty).toFixed(0) }}</strong>
                  </div>
                </div>

                <!-- Quantity controls -->
                <div class="flex items-center gap-1.5 shrink-0">
                  <button
                    @click="decEditQty(idx)"
                    :disabled="!isOrderPending || savingOrderUpdate"
                    class="h-8 w-8 grid place-items-center rounded-xl bg-muted hover:bg-muted/80 border border-border transition active:scale-95 disabled:opacity-40 cursor-pointer"
                    title="Decrease quantity"
                  >
                    <Minus class="h-3.5 w-3.5" />
                  </button>
                  <span class="w-6 text-center text-xs font-black tabular-nums text-primary">
                    {{ item.qty }}
                  </span>
                  <button
                    @click="incEditQty(idx)"
                    :disabled="!isOrderPending || savingOrderUpdate"
                    class="h-8 w-8 grid place-items-center rounded-xl gradient-primary text-primary-foreground shadow-xs active:scale-95 disabled:opacity-40 cursor-pointer"
                    title="Increase quantity"
                  >
                    <Plus class="h-3.5 w-3.5" />
                  </button>
                  <button
                    @click="removeEditItem(idx)"
                    :disabled="!isOrderPending || savingOrderUpdate"
                    class="h-8 w-8 grid place-items-center rounded-xl text-destructive hover:bg-destructive/10 ml-1 transition disabled:opacity-40 cursor-pointer"
                    title="Remove item"
                  >
                    <Trash2 class="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              <!-- Special note input -->
              <div class="pt-1 border-t border-border/40">
                <Input
                  v-model="item.specialInstructions"
                  :disabled="!isOrderPending || savingOrderUpdate"
                  placeholder="Special instructions (e.g. less spicy, no onion)…"
                  class="h-7 text-[11px] bg-muted/20"
                />
              </div>
            </div>
          </div>

          <!-- Add More Dishes to this Order -->
          <div class="pt-2">
            <button
              v-if="!showAddDishPicker"
              @click="showAddDishPicker = true"
              :disabled="!isOrderPending || savingOrderUpdate"
              class="w-full py-2.5 px-3 rounded-xl border border-dashed border-primary/40 hover:border-primary text-primary hover:bg-primary/5 text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40"
            >
              <Plus class="h-4 w-4" />
              <span>Add Another Dish from Menu</span>
            </button>

            <!-- Expanded Dish Picker -->
            <div v-else class="p-3.5 rounded-2xl bg-muted/30 border border-border space-y-2.5">
              <div class="flex items-center justify-between">
                <span class="text-xs font-bold text-foreground">Select Dish to Add:</span>
                <button @click="showAddDishPicker = false" class="text-xs text-muted-foreground hover:text-foreground cursor-pointer">
                  <X class="h-3.5 w-3.5" />
                </button>
              </div>

              <div class="relative">
                <Search class="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  v-model="addItemSearch"
                  placeholder="Search dish name…"
                  class="pl-8 h-8 text-xs bg-card"
                />
              </div>

              <div class="max-h-48 overflow-y-auto space-y-1 pr-1">
                <div
                  v-for="dish in addableMenuItems"
                  :key="dish.id"
                  class="flex items-center justify-between p-2 rounded-xl bg-card border border-border/60 hover:border-primary text-xs transition cursor-pointer"
                  @click="addDishToEditableOrder(dish)"
                >
                  <div class="min-w-0 flex-1 mr-2">
                    <div class="font-bold truncate">{{ dish.name }}</div>
                    <div class="text-[10px] text-muted-foreground">₹{{ dish.price.toFixed(0) }} · {{ dish.categoryName }}</div>
                  </div>
                  <Button size="sm" class="h-6 px-2.5 text-[10px] gradient-primary text-primary-foreground font-bold rounded-lg shrink-0">
                    <Plus class="h-3 w-3 mr-0.5" /> Add
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <!-- Order Kitchen Note -->
          <div class="space-y-1">
            <label class="text-xs font-bold text-muted-foreground">Kitchen Ticket Notes</label>
            <Input
              v-model="editableOrderNotes"
              :disabled="!isOrderPending || savingOrderUpdate"
              placeholder="Overall note for kitchen (e.g. serve quick, pack extra chutney)…"
              class="h-9 text-xs bg-card"
            />
          </div>

          <!-- Updated Totals Summary -->
          <div class="p-4 rounded-2xl bg-muted/20 border border-border space-y-1.5 text-xs">
            <div class="flex justify-between text-muted-foreground">
              <span>Subtotal</span>
              <span class="tabular-nums font-semibold">₹{{ editableSubtotal.toFixed(0) }}</span>
            </div>
            <div class="flex justify-between text-muted-foreground">
              <span>GST (8%)</span>
              <span class="tabular-nums font-semibold">₹{{ editableTax.toFixed(0) }}</span>
            </div>
            <div class="flex justify-between font-display text-base font-bold pt-1.5 border-t border-border text-foreground">
              <span>New Total</span>
              <span class="tabular-nums text-primary font-bold">₹{{ editableTotal.toFixed(0) }}</span>
            </div>
          </div>
        </div>

        <!-- Dialog Footer Actions -->
        <div class="p-4 border-t border-border bg-card flex flex-col sm:flex-row items-center justify-between gap-2.5">
          <Button
            @click="handleCancelPendingOrder"
            :disabled="!isOrderPending || cancelingOrder || savingOrderUpdate"
            variant="ghost"
            class="w-full sm:w-auto h-10 text-xs text-destructive hover:bg-destructive/10 font-bold cursor-pointer"
          >
            <Trash2 class="h-3.5 w-3.5 mr-1" />
            {{ cancelingOrder ? 'Cancelling...' : 'Cancel Entire Order' }}
          </Button>

          <div class="flex items-center gap-2 w-full sm:w-auto">
            <Button
              @click="updateOrderModalOpen = false"
              variant="outline"
              class="flex-1 sm:flex-none h-10 text-xs font-bold cursor-pointer"
            >
              Close
            </Button>
            <Button
              @click="handleSaveOrderUpdate"
              :disabled="!isOrderPending || savingOrderUpdate || editableOrderItems.length === 0"
              class="flex-1 sm:flex-none h-10 px-5 gradient-primary text-primary-foreground text-xs font-bold shadow-glow cursor-pointer"
            >
              <Check class="h-4 w-4 mr-1.5" />
              {{ savingOrderUpdate ? 'Updating...' : `Save Changes · ₹${editableTotal.toFixed(0)}` }}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>

  </RoleLayout>
</template>

<style scoped>
.drawer-enter-active,
.drawer-leave-active {
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}
.drawer-enter-from,
.drawer-leave-to {
  transform: translateY(100%);
  opacity: 0;
}
.scrollbar-none::-webkit-scrollbar {
  display: none;
}
.scrollbar-none {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
.pb-safe {
  padding-bottom: max(1rem, env(safe-area-inset-bottom));
}
</style>
