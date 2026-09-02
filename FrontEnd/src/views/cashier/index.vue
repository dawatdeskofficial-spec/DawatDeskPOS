<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import {
  Banknote, CreditCard, Download, Receipt, Smartphone, CheckCircle2,
  IndianRupee, ArrowLeftRight, Pencil, Trash2, Tag, X, Save,
  Plus, Minus, Search, ShoppingBag, UtensilsCrossed, Users, Clock,
  Phone, Bell, UserPlus, Package, CheckCircle, Check, ArrowLeft, ArrowRight, ChevronRight
} from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import RoleLayout from '@/components/RoleLayout.vue'
import { cashierNav } from '@/lib/nav'
import {
  getOrders, getPayments, createPayment, getRestaurantById,
  removeItemFromOrder, updateOrderItemQuantity, addItemToOrder,
  getMenuItems, getCategoriesByRestaurant, createOrder,
  getWaitingQueue, addToWaitingQueue, updateWaitingQueueEntry,
  seatWaitingCustomer, deleteWaitingQueueEntry,
  type MenuCategory, type WaitingQueueEntry
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
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

interface EditableItem {
  id: string
  menuItemId: string
  name: string
  price: number
  qty: number
  isNew?: boolean
  originalQty?: number
}

interface ParcelCartItem {
  menuItemId: string
  name: string
  price: number
  quantity: number
  specialInstructions?: string
}

const auth = useAuthStore()

// ── Navigation & View Tabs ──────────────────────────────────────────────────
const activeTab = ref<'billing' | 'queue' | 'history'>('billing')
const orderFilter = ref<'all' | 'dine_in' | 'parcel'>('all')

// ── Billing State ────────────────────────────────────────────────────────────
const selectedId          = ref<string | null>(null)
const mobileInvoiceOpen   = ref(false)
const method              = ref<'CASH' | 'DIGITAL_WALLET' | 'CARD'>('CASH')
const cashGiven           = ref<string>('')
const orders              = ref<any[]>([])
const transactions        = ref<any[]>([])
const restaurant          = ref<any>(null)
const menuItems           = ref<any[]>([])
const categories          = ref<MenuCategory[]>([])
const loading       = ref(true)
const actionLoading = ref(false)
const billingSearch = ref('')
const historySearch = ref('')

// ── Edit-bill state ──────────────────────────────────────────────────────────
const editMode          = ref(false)
const editableItems     = ref<EditableItem[]>([])
const discountType      = ref<'fixed' | 'percent'>('fixed')
const discountInput     = ref<string>('')
const savingEdit        = ref(false)
const addItemDialogOpen = ref(false)
const menuSearchQuery   = ref('')
const selectedCategory  = ref('All')

// ── Waiting Queue State ───────────────────────────────────────────────────────
const waitingList         = ref<WaitingQueueEntry[]>([])
const queueSearch         = ref('')
const addQueueDialogOpen  = ref(false)
const seatCustomerModal   = ref(false)
const selectedQueueEntry  = ref<WaitingQueueEntry | null>(null)
const targetTableNumber   = ref<number | null>(null)
const queueActionLoading  = ref(false)

// Add queue form state
const newCustomerName     = ref('')
const newCustomerPhone    = ref('')
const newPartySize        = ref(2)
const newPriority         = ref<'NORMAL' | 'VIP' | 'HIGH'>('NORMAL')
const newEstimatedWait    = ref(15)
const newQueueNotes       = ref('')

// ── Parcel / Takeaway State ───────────────────────────────────────────────────
const parcelDialogOpen    = ref(false)
const parcelCustomerName  = ref('')
const parcelCustomerPhone = ref('')
const parcelNotes         = ref('')
const parcelCart          = ref<ParcelCartItem[]>([])
const parcelMenuSearch    = ref('')
const parcelCategory      = ref('All')
const parcelSubmitting    = ref(false)

let interval: any

// ── Data fetching ─────────────────────────────────────────────────────────────
async function fetchStaticDashboard() {
  if (!auth.user?.restaurantId) return
  const restaurantId =
    typeof auth.user.restaurantId === 'string'
      ? auth.user.restaurantId
      : (auth.user.restaurantId as any).id || (auth.user.restaurantId as any)._id
  try {
    const [restRes, menuRes, catRes] = await Promise.all([
      getRestaurantById(restaurantId),
      getMenuItems(restaurantId, 1, 500),
      getCategoriesByRestaurant(restaurantId),
    ])
    restaurant.value   = restRes.data
    menuItems.value    = menuRes.data || []
    categories.value   = catRes.data || []
  } catch (err) {
    console.error(err)
  }
}

async function fetchDashboard() {
  if (!auth.user?.restaurantId) return
  const restaurantId =
    typeof auth.user.restaurantId === 'string'
      ? auth.user.restaurantId
      : (auth.user.restaurantId as any).id || (auth.user.restaurantId as any)._id
  try {
    const [ordRes, payRes, queueRes] = await Promise.all([
      getOrders(restaurantId, 1, 100),
      getPayments(restaurantId, 1, 50),
      getWaitingQueue(restaurantId, undefined, false),
    ])
    orders.value       = ordRes.data || []
    transactions.value = payRes.data || []
    waitingList.value  = queueRes.data || []
  } catch (err) {
    console.error(err)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  fetchStaticDashboard()
  fetchDashboard()
  interval = setInterval(fetchDashboard, 5000)
})
onUnmounted(() => clearInterval(interval))

// ── Table Occupancy Stats ────────────────────────────────────────────────────
const maxTables = computed(() => restaurant.value?.maxTables || 20)

const occupiedTableNumbers = computed(() => {
  const occupied = new Set<number>()
  // 1. Tables with active dining orders (not yet completed or cancelled)
  orders.value.forEach((o: any) => {
    const isCompleted = (o.status || '').toUpperCase() === 'COMPLETED' || o.paymentStatus === 'COMPLETED'
    const isCancelled = (o.status || '').toUpperCase() === 'CANCELLED'
    const isParcel = o.orderType === 'PARCEL' || Number(o.tableNumber) === 0
    if (!isCompleted && !isCancelled && !isParcel && o.tableNumber) {
      occupied.add(Number(o.tableNumber))
    }
  })

  // 2. Tables booked/allocated to seated queue customers (held until cashier confirms bill for that table)
  waitingList.value.forEach((q: any) => {
    if (q.status === 'SEATED' && q.assignedTable) {
      occupied.add(Number(q.assignedTable))
    }
  })

  return occupied
})

const availableTablesList = computed(() => {
  const list: number[] = []
  for (let i = 1; i <= maxTables.value; i++) {
    if (!occupiedTableNumbers.value.has(i)) {
      list.push(i)
    }
  }
  return list
})

const activeWaitingEntries = computed(() => {
  return waitingList.value.filter(q => ['WAITING', 'CALLED'].includes(q.status))
})

const totalWaitingGuests = computed(() => {
  return activeWaitingEntries.value.reduce((sum, q) => sum + (q.partySize || 1), 0)
})

// ── Filtered Queue (Clean active list with search) ───────────────────────────
const displayedQueue = computed(() => {
  let list = activeWaitingEntries.value
  if (queueSearch.value.trim()) {
    const q = queueSearch.value.toLowerCase()
    list = list.filter(item =>
      item.customerName.toLowerCase().includes(q) ||
      (item.customerPhone && item.customerPhone.includes(q))
    )
  }
  return list
})

// ── Waiting Queue Actions ─────────────────────────────────────────────────────
async function handleAddToQueue() {
  if (!newCustomerName.value.trim()) {
    toast.error('Customer name is required')
    return
  }
  if (newPartySize.value < 1) {
    toast.error('Party size must be at least 1')
    return
  }

  const restaurantId =
    typeof auth.user?.restaurantId === 'string'
      ? auth.user.restaurantId
      : (auth.user?.restaurantId as any)?.id || (auth.user?.restaurantId as any)?._id

  queueActionLoading.value = true
  try {
    await addToWaitingQueue({
      restaurantId,
      customerName: newCustomerName.value.trim(),
      partySize: newPartySize.value || 2,
    })
    toast.success(`✓ Added ${newCustomerName.value} to Waiting Queue!`)
    addQueueDialogOpen.value = false
    newCustomerName.value = ''
    newPartySize.value = 2
    fetchDashboard()
  } catch (err: any) {
    toast.error(err.message || 'Failed to add customer to queue')
  } finally {
    queueActionLoading.value = false
  }
}

async function handleCallCustomer(entry: WaitingQueueEntry) {
  const id = entry._id || entry.id
  if (!id) return
  try {
    await updateWaitingQueueEntry(id, { status: 'CALLED' })
    toast.success(`🔔 Called ${entry.customerName}! Customer notified.`)
    fetchDashboard()
  } catch (err: any) {
    toast.error(err.message || 'Failed to call customer')
  }
}

function getTableCapacity(tableNumber: number): number {
  if (!restaurant.value?.tableCapacities) return 4
  const caps = restaurant.value.tableCapacities
  if (caps instanceof Map) {
    return caps.get(String(tableNumber)) || caps.get(tableNumber) || 4
  }
  return caps[String(tableNumber)] || caps[tableNumber] || 4
}

function hasAvailableTableFor(partySize: number): boolean {
  return availableTablesList.value.some(tbl => getTableCapacity(tbl) >= partySize)
}

function getFirstAvailableTableFor(partySize: number): number | null {
  const match = availableTablesList.value.find(tbl => getTableCapacity(tbl) >= partySize)
  return match || null
}

function getBestTableFor(entry: WaitingQueueEntry): number | null {
  const match = getFirstAvailableTableFor(entry.partySize || 1)
  return match || availableTablesList.value[0] || null
}

async function handleQuickSeat(entry: WaitingQueueEntry) {
  const id = entry._id || entry.id
  if (!id) return

  const targetTable = getBestTableFor(entry)
  if (!targetTable) {
    toast.error('No vacant tables available right now. Please free up a table first.')
    return
  }

  queueActionLoading.value = true
  try {
    await seatWaitingCustomer(id, targetTable)
    toast.success(`🎉 Seated ${entry.customerName} at Table ${targetTable}! Table allocated & customer removed from queue.`)
    fetchDashboard()
  } catch (err: any) {
    toast.error(err.message || 'Failed to seat customer')
  } finally {
    queueActionLoading.value = false
  }
}

function openSeatModal(entry: WaitingQueueEntry) {
  selectedQueueEntry.value = entry
  // Intelligently pre-select a vacant table that fits the guest's party size
  const bestFit = getFirstAvailableTableFor(entry.partySize || 1)
  targetTableNumber.value = bestFit || availableTablesList.value[0] || null
  seatCustomerModal.value = true
}

async function handleSeatCustomer() {
  if (!selectedQueueEntry.value || !targetTableNumber.value) {
    toast.error('Please select a table to seat the customer')
    return
  }
  const id = selectedQueueEntry.value._id || selectedQueueEntry.value.id
  if (!id) return

  queueActionLoading.value = true
  try {
    await seatWaitingCustomer(id, targetTableNumber.value)
    toast.success(`🎉 Seated ${selectedQueueEntry.value.customerName} at Table ${targetTableNumber.value}!`)
    seatCustomerModal.value = false
    selectedQueueEntry.value = null
    targetTableNumber.value = null
    fetchDashboard()
  } catch (err: any) {
    toast.error(err.message || 'Failed to seat customer')
  } finally {
    queueActionLoading.value = false
  }
}

async function handleCancelQueue(entry: WaitingQueueEntry) {
  const id = entry._id || entry.id
  if (!id) return
  try {
    await deleteWaitingQueueEntry(id)
    toast.info(`Removed ${entry.customerName} from queue`)
    fetchDashboard()
  } catch (err: any) {
    toast.error(err.message || 'Failed to remove queue entry')
  }
}

// ── Parcel / Takeaway Dialog & Management ────────────────────────────────────
const filteredParcelMenuItems = computed(() => {
  let list = menuItems.value.filter(m => m.isAvailable !== false)
  if (parcelCategory.value !== 'All') {
    list = list.filter(m => {
      const catName = typeof m.categoryId === 'object' ? m.categoryId?.name : m.category
      return catName === parcelCategory.value || m.category === parcelCategory.value
    })
  }
  if (parcelMenuSearch.value.trim()) {
    const q = parcelMenuSearch.value.toLowerCase()
    list = list.filter(m => m.name.toLowerCase().includes(q))
  }
  return list
})

function getParcelCartQty(menuItemId: string) {
  const found = parcelCart.value.find(i => i.menuItemId === menuItemId)
  return found ? found.quantity : 0
}

function addToParcelCart(menuItem: any) {
  const found = parcelCart.value.find(i => i.menuItemId === menuItem._id)
  if (found) {
    found.quantity++
  } else {
    parcelCart.value.push({
      menuItemId: menuItem._id,
      name: menuItem.name,
      price: menuItem.price,
      quantity: 1,
      specialInstructions: '',
    })
  }
}

function decParcelCart(menuItemId: string) {
  const idx = parcelCart.value.findIndex(i => i.menuItemId === menuItemId)
  if (idx !== -1) {
    if (parcelCart.value[idx].quantity > 1) {
      parcelCart.value[idx].quantity--
    } else {
      parcelCart.value.splice(idx, 1)
    }
  }
}

const parcelSubtotal = computed(() => {
  return parcelCart.value.reduce((sum, item) => sum + item.price * item.quantity, 0)
})

const parcelGstAmount = computed(() => {
  return (parcelSubtotal.value * gstPct.value) / 100
})

const parcelTotalAmount = computed(() => {
  return parcelSubtotal.value + parcelGstAmount.value
})

async function handleCreateParcelOrder(settleNow = false) {
  if (parcelCart.value.length === 0) {
    toast.error('Please add at least one item to the parcel order')
    return
  }

  const restaurantId =
    typeof auth.user?.restaurantId === 'string'
      ? auth.user.restaurantId
      : (auth.user?.restaurantId as any)?.id || (auth.user?.restaurantId as any)?._id

  parcelSubmitting.value = true
  try {
    const res = await createOrder({
      restaurantId,
      orderType: 'PARCEL',
      tableNumber: 0,
      customerName: parcelCustomerName.value.trim() || 'Parcel Customer',
      customerPhone: parcelCustomerPhone.value.trim(),
      notes: parcelNotes.value.trim(),
      items: parcelCart.value.map(i => ({
        menuItemId: i.menuItemId,
        quantity: i.quantity,
        specialInstructions: i.specialInstructions,
      })),
    })

    const newOrder = res.data
    const orderId = newOrder?.id || newOrder?._id

    toast.success(`📦 Parcel Order created! Sent to kitchen.`, { duration: 4000 })
    parcelDialogOpen.value = false

    // Reset parcel form
    parcelCustomerName.value = ''
    parcelCustomerPhone.value = ''
    parcelNotes.value = ''
    parcelCart.value = []

    fetchDashboard()

    if (settleNow && orderId) {
      activeTab.value = 'billing'
      selectedId.value = orderId
      toast.info('Loaded into Billing Drawer for immediate settlement')
    }
  } catch (err: any) {
    toast.error(err.message || 'Failed to create parcel order')
  } finally {
    parcelSubmitting.value = false
  }
}

// ── Orders Ready To Bill & Active Orders ──────────────────────────────────────
const activeOrdersList = computed(() => {
  return orders.value.filter(o => {
    const s = (o.status || '').toUpperCase()
    return !['CANCELLED'].includes(s) && o.paymentStatus !== 'COMPLETED'
  })
})

const filteredOrdersList = computed(() => {
  let list = activeOrdersList.value
  if (orderFilter.value === 'dine_in') {
    list = list.filter(o => o.orderType !== 'PARCEL' && Number(o.tableNumber) > 0)
  } else if (orderFilter.value === 'parcel') {
    list = list.filter(o => o.orderType === 'PARCEL' || Number(o.tableNumber) === 0)
  }
  if (billingSearch.value.trim()) {
    const q = billingSearch.value.toLowerCase().trim()
    list = list.filter(o => {
      const idStr = String(o.id || o._id || '').toLowerCase()
      const tblStr = String(o.tableNumber || '')
      const cName = String(o.customerName || '').toLowerCase()
      const phone = String(o.customerPhone || '').toLowerCase()
      const itemsMatch = (o.items || []).some((it: any) => it.name?.toLowerCase().includes(q))
      return idStr.includes(q) || tblStr.includes(q) || cName.includes(q) || phone.includes(q) || itemsMatch
    })
  }
  return list
})

const filteredTransactions = computed(() => {
  let list = transactions.value
  if (historySearch.value.trim()) {
    const q = historySearch.value.toLowerCase().trim()
    list = list.filter((t, idx) => {
      const txnCode = `txn-${String(idx + 1).padStart(3, '0')}`.toLowerCase()
      const receipt = String(t.receiptNumber || '').toLowerCase()
      const table = String(t.orderId?.tableNumber ?? '')
      const customer = String(t.orderId?.customerName || '').toLowerCase()
      const method = String(t.paymentMethod || '').toLowerCase()
      const cashier = String(t.createdBy?.name || '').toLowerCase()
      const amount = String(t.totalAmount || '')
      const itemMatch = (t.orderId?.items || []).some((it: any) => (it.name || '').toLowerCase().includes(q))
      return txnCode.includes(q) || receipt.includes(q) || table.includes(q) || customer.includes(q) || method.includes(q) || cashier.includes(q) || amount.includes(q) || itemMatch
    })
  }
  return list
})

const selectedOrder = computed(() => orders.value.find(o => (o.id || o._id) === selectedId.value))

watch(filteredOrdersList, (list) => {
  if (!selectedId.value && list.length > 0) {
    selectedId.value = list[0].id || list[0]._id
  }
}, { immediate: true })

// Reset state when selected order changes
watch(selectedId, () => {
  editMode.value          = false
  editableItems.value     = []
  discountInput.value     = ''
  cashGiven.value         = ''
  addItemDialogOpen.value = false
})

function selectOrder(orderId: string) {
  selectedId.value = orderId
}

watch(method, () => { cashGiven.value = '' })

const gstPct = computed(() => restaurant.value?.gstPercentage ?? 5)

// Current active items to display (in edit mode vs normal mode)
const displayItems = computed(() => {
  if (editMode.value) {
    return editableItems.value
  }
  if (!selectedOrder.value) return []
  return (selectedOrder.value.items || []).map((i: any) => ({
    id: i.id || i._id,
    menuItemId: i.menuItemId || i.id,
    name: i.name,
    price: Number(i.price ?? 0),
    qty: Number(i.qty ?? i.quantity ?? 1),
    isNew: false,
    originalQty: Number(i.qty ?? i.quantity ?? 1),
  }))
})

const subtotalBeforeDiscount = computed(() => {
  return displayItems.value.reduce((s: number, i: EditableItem) => s + i.price * i.qty, 0)
})

const discountValue = computed(() => {
  const v = parseFloat(discountInput.value) || 0
  if (discountType.value === 'percent') {
    return Math.min((subtotalBeforeDiscount.value * v) / 100, subtotalBeforeDiscount.value)
  }
  return Math.min(v, subtotalBeforeDiscount.value)
})

const subtotal = computed(() => Math.max(0, subtotalBeforeDiscount.value - discountValue.value))
const tax      = computed(() => (subtotal.value * gstPct.value) / 100)
const total    = computed(() => subtotal.value + tax.value)

// ── Edit Mode Actions ─────────────────────────────────────────────────────────
function enterEditMode() {
  if (!selectedOrder.value) return
  editableItems.value = (selectedOrder.value.items || []).map((i: any) => ({
    id: String(i.id || i._id),
    menuItemId: String(i.menuItemId || i.id || i._id),
    name: i.name,
    price: Number(i.price ?? 0),
    qty: Number(i.qty ?? i.quantity ?? 1),
    isNew: false,
    originalQty: Number(i.qty ?? i.quantity ?? 1),
  }))
  editMode.value = true
}

function cancelEdit() {
  editMode.value          = false
  editableItems.value     = []
  discountInput.value     = ''
  addItemDialogOpen.value = false
}

function increaseQty(item: EditableItem) {
  item.qty++
}

function decreaseQty(item: EditableItem) {
  if (item.qty > 1) {
    item.qty--
  } else {
    removeItem(item)
  }
}

function removeItem(item: EditableItem) {
  editableItems.value = editableItems.value.filter(i => i !== item)
}

function setItemQty(item: EditableItem, value: string) {
  const parsed = parseInt(value, 10)
  if (isNaN(parsed) || parsed <= 0) {
    removeItem(item)
  } else {
    item.qty = parsed
  }
}

// ── Menu Filtering for Adding Items ───────────────────────────────────────────
const filteredMenuItems = computed(() => {
  let list = menuItems.value.filter(m => m.isAvailable !== false)
  if (selectedCategory.value !== 'All') {
    list = list.filter(m => {
      const catName = typeof m.categoryId === 'object' ? m.categoryId?.name : m.category
      return catName === selectedCategory.value || m.category === selectedCategory.value
    })
  }
  if (menuSearchQuery.value.trim()) {
    const q = menuSearchQuery.value.toLowerCase()
    list = list.filter(m => m.name.toLowerCase().includes(q))
  }
  return list
})

function getItemQtyInEdit(menuItemId: string) {
  const found = editableItems.value.find(i => i.menuItemId === menuItemId)
  return found ? found.qty : 0
}

function addMenuItemToBill(menuItem: any) {
  const existing = editableItems.value.find(i => i.menuItemId === menuItem._id)
  if (existing) {
    existing.qty++
  } else {
    editableItems.value.push({
      id: `temp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      menuItemId: menuItem._id,
      name: menuItem.name,
      price: menuItem.price,
      qty: 1,
      isNew: true,
      originalQty: 0,
    })
  }
  toast.success(`Added ${menuItem.name} to bill`, { duration: 1500 })
}

// ── Save Edits to Backend ─────────────────────────────────────────────────────
async function saveEdits() {
  if (!selectedOrder.value) return
  if (editableItems.value.length === 0) {
    toast.error("Bill cannot be empty. Please keep at least one item.")
    return
  }

  savingEdit.value = true
  const orderId = selectedOrder.value.id || selectedOrder.value._id
  const originalItems: any[] = selectedOrder.value.items || []

  try {
    const currentItemIds = new Set(editableItems.value.filter(i => !i.isNew).map(i => i.id))
    const itemsToDelete = originalItems.filter(i => !currentItemIds.has(String(i.id || i._id)))
    
    for (const item of itemsToDelete) {
      await removeItemFromOrder(orderId, String(item.id || item._id))
    }

    const itemsToAdd = editableItems.value.filter(i => i.isNew)
    for (const item of itemsToAdd) {
      await addItemToOrder(orderId, item.menuItemId, item.qty)
    }

    const itemsToUpdate = editableItems.value.filter(i => !i.isNew && i.qty !== i.originalQty)
    for (const item of itemsToUpdate) {
      await updateOrderItemQuantity(orderId, item.id, item.qty)
    }

    toast.success("Bill updated successfully!")
    editMode.value          = false
    addItemDialogOpen.value = false
    fetchDashboard()
  } catch (err: any) {
    toast.error(err.message || "Failed to save bill changes")
  } finally {
    savingEdit.value = false
  }
}

// ── Cash Change Calculator ───────────────────────────────────────────────────
const cashGivenNum  = computed(() => parseFloat(cashGiven.value) || 0)
const changeAmount  = computed(() => Math.max(0, cashGivenNum.value - total.value))
const cashShortfall = computed(() =>
  cashGivenNum.value > 0 && cashGivenNum.value < total.value
    ? total.value - cashGivenNum.value : 0)
const cashValid = computed(() =>
  method.value !== 'CASH' || cashGivenNum.value >= total.value)


// ── Complete Payment ──────────────────────────────────────────────────────────
async function handleCompletePayment() {
  if (!selectedOrder.value) return
  if (editMode.value) {
    toast.error('Please save your bill edits before collecting payment.')
    return
  }
  if (!cashValid.value) {
    toast.error(`Cash given (₹${cashGivenNum.value.toFixed(0)}) is less than total (₹${total.value.toFixed(0)})`)
    return
  }

  actionLoading.value = true
  const orderId = selectedOrder.value.id || selectedOrder.value._id
  try {
    await createPayment({
      orderId,
      subtotal: subtotalBeforeDiscount.value,
      discount: discountValue.value,
      paymentMethod: method.value,
    })

    const changeMsg = method.value === 'CASH' && changeAmount.value > 0
      ? ` · Return ₹${changeAmount.value.toFixed(0)} change` : ''
    toast.success(`✅ Payment of ₹${total.value.toFixed(0)} received via ${method.value}${changeMsg}`)
    selectedId.value        = null
    mobileInvoiceOpen.value = false
    cashGiven.value         = ''
    discountInput.value     = ''
    fetchDashboard()
  } catch (err: any) {
    toast.error(err.message || 'Payment failed')
  } finally {
    actionLoading.value = false
  }
}

// ── PDF Receipt ───────────────────────────────────────────────────────────────
function downloadPDF(orderOrPayment: any, isPast = false) {
  if (!orderOrPayment) { toast.error('No receipt details found'); return }
  const doc      = new jsPDF()
  const restName = restaurant.value?.name || 'Restaurant'
  let orderObj   = orderOrPayment
  const paidDate = orderOrPayment.paidAt || orderOrPayment.createdAt || Date.now()
  if (isPast && orderOrPayment.orderId && typeof orderOrPayment.orderId === 'object')
    orderObj = orderOrPayment.orderId

  const orderId    = orderObj.id || orderObj._id || orderOrPayment.orderId || 'N/A'
  const isParcel   = orderObj.orderType === 'PARCEL' || Number(orderObj.tableNumber) === 0
  const tableNum   = orderObj.tableNumber
  const custName   = orderObj.customerName
  const custPhone  = orderObj.customerPhone
  const createdAt  = orderObj.createdAt || paidDate
  const items      = orderObj.items || []

  doc.setFontSize(22); doc.text(restName, 14, 20)
  doc.setFontSize(10); doc.setTextColor(100)
  doc.text(isParcel ? 'Invoice / Parcel Receipt' : 'Invoice / Dine-In Receipt', 14, 28)
  doc.text(`Order ID: ${String(orderId).slice(-8)}`, 14, 34)
  if (isParcel) {
    doc.text(`Type: TAKEAWAY / PARCEL`, 14, 40)
    if (custName) doc.text(`Customer: ${custName} ${custPhone ? '(' + custPhone + ')' : ''}`, 14, 46)
  } else if (tableNum) {
    doc.text(`Table: ${tableNum}`, 14, 40)
  }
  doc.text(`Date: ${new Date(createdAt).toLocaleString()}`, 14, isParcel && custName ? 52 : 46)

  let orderSubtotal = 0
  const tableBody = items.map((i: any) => {
    const qty   = Number(i.qty || i.quantity || 1)
    const price = Number(i.price ?? 0)
    const line  = price * qty
    orderSubtotal += line
    return [i.name || 'Item', qty, `Rs. ${price.toFixed(2)}`, `Rs. ${line.toFixed(2)}`]
  })
  const gstPctVal  = Number(restaurant.value?.gstPercentage ?? 5)
  const orderTax   = (orderSubtotal * gstPctVal) / 100
  const orderTotal = orderSubtotal + orderTax

  const startYPos = isParcel && custName ? 60 : 54

  autoTable(doc, {
    startY: startYPos,
    head: [['Item', 'Qty', 'Unit Price', 'Total']],
    body: tableBody,
    theme: 'grid',
    headStyles: { fillColor: [15, 23, 42] },
    styles: { fontSize: 10 },
  })
  const finalY = ((doc as any).lastAutoTable?.finalY ?? 55) + 10
  doc.setFontSize(10); doc.setTextColor(0)
  doc.text(`Subtotal: Rs. ${orderSubtotal.toFixed(2)}`, 130, finalY)
  doc.text(`Tax (${gstPctVal}%): Rs. ${orderTax.toFixed(2)}`, 130, finalY + 6)
  doc.setFontSize(13); doc.setFont('helvetica', 'bold')
  doc.text(`Total: Rs. ${orderTotal.toFixed(2)}`, 130, finalY + 16)
  if (isPast) { doc.setTextColor(34, 197, 94); doc.text('PAID', 14, finalY + 16) }
  doc.save(`Receipt_${String(orderId).slice(-6)}.pdf`)
  toast.success('PDF downloaded!')
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function elapsed(ts: string) {
  if (!ts) return '0m'
  const m = Math.floor((Date.now() - new Date(ts).getTime()) / 60000)
  return m > 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`
}

function formatTime(ts: string) {
  if (!ts) return ''
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function getKitchenStatusBadge(status: string) {
  const s = (status || '').toUpperCase()
  if (s === 'PENDING') return { label: 'Kitchen: Queued', color: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30' }
  if (s === 'PREPARING') return { label: 'Kitchen: Cooking 🔥', color: 'bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/30' }
  if (s === 'READY') return { label: 'Ready for Pickup 🟢', color: 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/40 font-bold animate-pulse' }
  if (s === 'SERVED') return { label: 'Delivered / Served', color: 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30' }
  return { label: s, color: 'bg-muted text-muted-foreground' }
}

const paymentMethods = [
  { k: 'CASH'           as const, label: 'Cash',       icon: Banknote   },
  { k: 'DIGITAL_WALLET' as const, label: 'UPI/Wallet', icon: Smartphone },
  { k: 'CARD'           as const, label: 'Card',       icon: CreditCard },
]
</script>

<template>
  <RoleLayout role="cashier" :nav="cashierNav">
    <!-- Header with Quick Action Buttons -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 mb-4 sm:mb-6">
      <div>
        <h1 class="font-display text-xl sm:text-3xl font-bold tracking-tight text-foreground">Cashier &amp; Operations</h1>
        <p class="hidden sm:block text-xs sm:text-sm text-muted-foreground mt-0.5 sm:mt-1">Manage live billing, take takeaway parcel orders, and seat waiting customers.</p>
      </div>

      <!-- Quick Action Buttons -->
      <div class="grid grid-cols-2 sm:flex sm:items-center gap-2 sm:gap-2.5">
        <Button
          @click="parcelDialogOpen = true"
          class="gradient-primary text-primary-foreground font-bold text-xs sm:text-sm h-9 sm:h-10 px-3 sm:px-4 shadow-glow flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <Package class="h-3.5 w-3.5 sm:h-4 sm:w-4" /> + New Parcel
        </Button>
        <Button
          @click="addQueueDialogOpen = true"
          variant="outline"
          class="font-bold text-xs sm:text-sm h-9 sm:h-10 px-3 sm:px-4 border-primary/40 hover:bg-primary/5 text-primary flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <UserPlus class="h-3.5 w-3.5 sm:h-4 sm:w-4" /> + Add to Queue
        </Button>
      </div>
    </div>

    <!-- ── Header Stats Banner (Desktop Only - Hidden on Mobile) ────────── -->
    <div class="hidden md:grid grid-cols-2 lg:grid-cols-4 gap-3.5 mb-6">
      <!-- Tables Occupancy -->
      <div class="p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-card border border-border shadow-soft flex items-center gap-2.5 sm:gap-3.5">
        <div class="h-9 w-9 sm:h-11 sm:w-11 rounded-lg sm:rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
          <UtensilsCrossed class="h-4 w-4 sm:h-5 sm:w-5" />
        </div>
        <div class="min-w-0">
          <div class="text-[10px] sm:text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Occupancy</div>
          <div class="font-display text-sm sm:text-lg font-bold truncate">
            {{ occupiedTableNumbers.size }}/{{ maxTables }} <span class="text-[10px] sm:text-xs font-normal text-muted-foreground">Tables</span>
          </div>
        </div>
      </div>

      <!-- Tables Available -->
      <div class="p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-card border border-border shadow-soft flex items-center gap-2.5 sm:gap-3.5">
        <div class="h-9 w-9 sm:h-11 sm:w-11 rounded-lg sm:rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500 shrink-0">
          <CheckCircle class="h-4 w-4 sm:h-5 sm:w-5" />
        </div>
        <div class="min-w-0">
          <div class="text-[10px] sm:text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Available</div>
          <div class="font-display text-sm sm:text-lg font-bold text-emerald-600 dark:text-emerald-400 truncate">
            {{ availableTablesList.length }} <span class="text-[10px] sm:text-xs font-normal text-muted-foreground">Vacant</span>
          </div>
        </div>
      </div>

      <!-- Waiting Queue Count -->
      <div class="p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-card border border-border shadow-soft flex items-center gap-2.5 sm:gap-3.5">
        <div class="h-9 w-9 sm:h-11 sm:w-11 rounded-lg sm:rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 shrink-0">
          <Users class="h-4 w-4 sm:h-5 sm:w-5" />
        </div>
        <div class="min-w-0">
          <div class="text-[10px] sm:text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Queue</div>
          <div class="font-display text-sm sm:text-lg font-bold text-amber-600 dark:text-amber-400 truncate">
            {{ activeWaitingEntries.length }} <span class="text-[10px] sm:text-xs font-normal text-muted-foreground">Groups</span>
          </div>
        </div>
      </div>

      <!-- Active Parcel Orders -->
      <div class="p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-card border border-border shadow-soft flex items-center gap-2.5 sm:gap-3.5">
        <div class="h-9 w-9 sm:h-11 sm:w-11 rounded-lg sm:rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-500 shrink-0">
          <Package class="h-4 w-4 sm:h-5 sm:w-5" />
        </div>
        <div class="min-w-0">
          <div class="text-[10px] sm:text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Takeaways</div>
          <div class="font-display text-sm sm:text-lg font-bold text-purple-600 dark:text-purple-400 truncate">
            {{ activeOrdersList.filter(o => o.orderType === 'PARCEL' || Number(o.tableNumber) === 0).length }} <span class="text-[10px] sm:text-xs font-normal text-muted-foreground">Orders</span>
          </div>
        </div>
      </div>
    </div>

    <!-- ── Tab Navigation Bar (Scrollable on Mobile) ───────────────────────── -->
    <div class="flex items-center gap-1.5 sm:gap-2 border-b border-border mb-4 sm:mb-6 pb-2 overflow-x-auto no-scrollbar">
      <button
        @click="activeTab = 'billing'"
        :class="['flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition shrink-0 cursor-pointer', activeTab === 'billing' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground hover:bg-muted/40']"
      >
        <Receipt class="h-4 w-4" /> Billing &amp; Orders
        <span v-if="filteredOrdersList.length > 0" class="ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-extrabold bg-background/20">
          {{ filteredOrdersList.length }}
        </span>
      </button>

      <button
        @click="activeTab = 'queue'"
        :class="['flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition shrink-0 cursor-pointer', activeTab === 'queue' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground hover:bg-muted/40']"
      >
        <Users class="h-4 w-4" /> Waiting Queue
        <span v-if="activeWaitingEntries.length > 0" class="ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500 text-white">
          {{ activeWaitingEntries.length }}
        </span>
      </button>

      <button
        @click="activeTab = 'history'"
        :class="['flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition shrink-0 cursor-pointer', activeTab === 'history' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground hover:bg-muted/40']"
      >
        <CreditCard class="h-4 w-4" /> Transactions
        <span v-if="transactions.length > 0" class="ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-muted text-muted-foreground">
          {{ transactions.length }}
        </span>
      </button>
    </div>

    <!-- ═══════════════════════════════════════════════════════════════════════ -->
    <!-- TAB 1: BILLING & ORDERS                                                 -->
    <!-- ═══════════════════════════════════════════════════════════════════════ -->
    <div v-if="activeTab === 'billing'">
      <div class="grid grid-cols-1 xl:grid-cols-[1fr_400px] gap-6 pb-16 xl:pb-0">

      <!-- Left: Active Orders List -->
      <div class="space-y-6">

        <section class="rounded-2xl bg-card border border-border shadow-soft overflow-hidden">
          <!-- Filter Header with Search -->
          <div class="p-3.5 sm:p-5 border-b border-border space-y-3 bg-muted/10">
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 class="font-display text-lg sm:text-xl font-bold">Active Orders &amp; Bills</h3>
                <p class="hidden sm:block text-xs text-muted-foreground mt-0.5">Select an order to review, edit items, and process settlement</p>
              </div>

              <!-- Filter Buttons: All / Dine-In / Parcel (Clean professional tabs) -->
              <div class="flex items-center gap-1 bg-muted/60 p-1 rounded-xl text-xs font-semibold shrink-0 overflow-x-auto">
                <button
                  @click="orderFilter = 'all'"
                  :class="['px-2.5 sm:px-3 py-1.5 rounded-lg transition whitespace-nowrap cursor-pointer', orderFilter === 'all' ? 'bg-background text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground']"
                >
                  All ({{ activeOrdersList.length }})
                </button>
                <button
                  @click="orderFilter = 'dine_in'"
                  :class="['px-2.5 sm:px-3 py-1.5 rounded-lg transition whitespace-nowrap flex items-center gap-1.5 cursor-pointer', orderFilter === 'dine_in' ? 'bg-background text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground']"
                >
                  <Utensils class="h-3.5 w-3.5" />
                  <span>Tables ({{ activeOrdersList.filter(o => o.orderType !== 'PARCEL' && Number(o.tableNumber) > 0).length }})</span>
                </button>
                <button
                  @click="orderFilter = 'parcel'"
                  :class="['px-2.5 sm:px-3 py-1.5 rounded-lg transition whitespace-nowrap flex items-center gap-1.5 cursor-pointer', orderFilter === 'parcel' ? 'bg-background text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground']"
                >
                  <Package class="h-3.5 w-3.5" />
                  <span>Takeaway ({{ activeOrdersList.filter(o => o.orderType === 'PARCEL' || Number(o.tableNumber) === 0).length }})</span>
                </button>
              </div>
            </div>

            <!-- Active Orders Search Bar -->
            <div class="relative">
              <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                v-model="billingSearch"
                placeholder="Search table, takeaway customer, phone, or dish item name…"
                class="pl-9 pr-9 h-9 text-xs bg-background"
              />
              <button
                v-if="billingSearch"
                @click="billingSearch = ''"
                class="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5 cursor-pointer"
              >
                <X class="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          <!-- Orders List -->
          <div class="divide-y divide-border">
            <div v-if="filteredOrdersList.length === 0" class="p-10 text-center text-muted-foreground flex flex-col items-center gap-2">
              <CheckCircle2 v-if="!billingSearch" class="h-10 w-10 opacity-30 text-success" />
              <Search v-else class="h-10 w-10 opacity-30 text-muted-foreground" />
              <p class="text-sm font-medium">
                {{ billingSearch ? `No active orders matching "${billingSearch}"` : 'No active orders in this filter.' }}
              </p>
              <Button v-if="billingSearch" @click="billingSearch = ''" variant="ghost" class="mt-1 text-xs cursor-pointer">
                Clear Search
              </Button>
              <Button v-else @click="parcelDialogOpen = true" variant="outline" class="mt-2 text-xs cursor-pointer">
                <Package class="h-3.5 w-3.5 mr-1" /> Create a Takeaway Order
              </Button>
            </div>

            <button
              v-for="o in filteredOrdersList"
              :key="o.id || o._id"
              @click="selectOrder(o.id || o._id)"
              :class="['w-full flex items-center justify-between p-3.5 sm:px-5 sm:py-4 text-left transition border-l-4 cursor-pointer', selectedId === (o.id || o._id) ? 'bg-primary/8 border-l-primary' : 'hover:bg-muted/30 border-l-transparent']"
            >
              <div class="min-w-0 flex-1 pr-3">
                <div class="flex items-center gap-2 flex-wrap">
                  <!-- Type Badge -->
                  <Badge v-if="o.orderType === 'PARCEL' || Number(o.tableNumber) === 0" class="bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/30 text-[10px] sm:text-[11px] font-bold inline-flex items-center gap-1">
                    <Package class="h-3 w-3" /> TAKEAWAY
                  </Badge>
                  <span v-else class="font-bold text-sm sm:text-base text-foreground">
                    Table {{ o.tableNumber }}
                  </span>

                  <!-- Customer Name if Parcel -->
                  <span v-if="o.customerName" class="text-xs sm:text-sm font-semibold text-foreground/90 truncate">
                    · {{ o.customerName }}
                  </span>

                  <!-- Kitchen Status Badge -->
                  <Badge :class="[getKitchenStatusBadge(o.status).color, 'text-[9px] sm:text-[10px] px-1.5 sm:px-2 py-0.5 border']">
                    {{ getKitchenStatusBadge(o.status).label }}
                  </Badge>
                </div>

                <div class="text-[11px] sm:text-xs text-muted-foreground mt-1 flex items-center gap-1.5 sm:gap-2">
                  <span>{{ o.items?.length || 0 }} items</span>
                  <span>·</span>
                  <span>{{ elapsed(o.createdAt) }} ago</span>
                  <span v-if="o.customerPhone" class="text-foreground/70 hidden sm:inline">· 📞 {{ o.customerPhone }}</span>
                </div>
              </div>

              <div class="text-right shrink-0 flex items-center gap-2">
                <div>
                  <div class="font-display text-lg sm:text-2xl font-bold tabular-nums">₹{{ (o.totalAmount || 0).toFixed(0) }}</div>
                  <Badge v-if="selectedId === (o.id || o._id)" class="bg-primary/20 text-primary mt-0.5 text-[9px] sm:text-[10px] hidden sm:inline-flex">Active Bill</Badge>
                </div>
                <ChevronRight class="h-4 w-4 text-muted-foreground xl:hidden" />
              </div>
            </button>
          </div>
        </section>
      </div>

      <!-- Right: Invoice & Bill Editing Panel (Desktop View) -->
      <aside class="hidden xl:flex rounded-2xl bg-card border border-border shadow-soft flex-col xl:sticky xl:top-24 min-w-0" style="max-height: calc(100vh - 7rem);">

        <!-- Header -->
        <div class="p-4 border-b border-border flex items-center justify-between shrink-0 bg-muted/10">
          <div>
            <div class="font-display text-lg font-bold flex items-center gap-1.5">
              <Receipt class="h-4 w-4 text-primary" /> Invoice
            </div>
            <div class="text-xs font-semibold text-muted-foreground">
              {{ selectedOrder ? (selectedOrder.orderType === 'PARCEL' || Number(selectedOrder.tableNumber) === 0 ? `Parcel: ${selectedOrder.customerName || 'Takeaway'}` : `Table ${selectedOrder.tableNumber}`) : 'No order selected' }}
            </div>
          </div>

          <div class="flex items-center gap-2">
            <!-- Edit / Cancel Edit Button -->
            <button
              v-if="selectedOrder && !editMode"
              @click="enterEditMode"
              class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-border hover:border-primary/40 hover:bg-primary/5 hover:text-primary transition cursor-pointer"
            >
              <Pencil class="h-3.5 w-3.5" /> Edit Bill
            </button>
            <button
              v-if="editMode"
              @click="cancelEdit"
              class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-destructive/30 text-destructive hover:bg-destructive/5 transition cursor-pointer"
            >
              <X class="h-3.5 w-3.5" /> Cancel
            </button>
          </div>
        </div>

        <!-- Edit Mode Banner -->
        <Transition name="slide-down">
          <div v-if="editMode" class="px-4 py-2.5 bg-amber-500/10 border-b border-amber-500/20 flex items-center justify-between shrink-0">
            <div class="flex items-center gap-2">
              <Pencil class="h-3.5 w-3.5 text-amber-500 shrink-0" />
              <span class="text-xs text-amber-600 dark:text-amber-400 font-semibold">
                Bill Edit Mode
              </span>
            </div>
            <button
              @click="addItemDialogOpen = true"
              class="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold bg-primary text-primary-foreground shadow-sm hover:opacity-90 transition cursor-pointer"
            >
              <Plus class="h-3.5 w-3.5" /> Add Items
            </button>
          </div>
        </Transition>

        <!-- Empty State -->
        <div v-if="!selectedOrder" class="p-12 text-center text-muted-foreground flex-1 flex flex-col items-center justify-center gap-3">
          <Receipt class="h-10 w-10 opacity-20" />
          <p class="text-sm">Select an order from the list to begin billing</p>
        </div>

        <template v-else>
          <!-- 1. Scrollable Items Area (Scrolls independently if order has many items) -->
          <div class="flex-1 overflow-y-auto min-h-[130px] p-3.5 space-y-1.5">
            <!-- Edit Mode Item Row -->
            <template v-if="editMode">
              <div v-if="editableItems.length === 0" class="p-6 text-center text-muted-foreground border border-dashed border-border rounded-xl">
                <UtensilsCrossed class="h-6 w-6 mx-auto mb-1 opacity-40" />
                <p class="text-xs font-medium">All items removed. Add items below.</p>
              </div>
              <div
                v-for="item in editableItems"
                :key="item.id"
                class="flex items-center justify-between gap-2 p-2 rounded-xl border border-border bg-muted/20 hover:bg-muted/40 transition"
              >
                <div class="flex-1 min-w-0">
                  <div class="text-xs font-semibold truncate flex items-center gap-1.5">
                    <span>{{ item.name }}</span>
                    <Badge v-if="item.isNew" class="bg-primary/20 text-primary text-[9px] px-1 py-0 h-4">NEW</Badge>
                  </div>
                  <div class="text-[11px] text-muted-foreground mt-0.5">₹{{ item.price }} each · <strong class="text-foreground font-semibold">₹{{ (item.price * item.qty).toFixed(0) }}</strong></div>
                </div>

                <!-- Quantity Controls -->
                <div class="flex items-center gap-1 shrink-0">
                  <button
                    @click="decreaseQty(item)"
                    class="h-6.5 w-6.5 rounded-md border border-border bg-background flex items-center justify-center text-foreground hover:bg-muted transition cursor-pointer"
                    title="Decrease quantity"
                  >
                    <Minus class="h-3 w-3" />
                  </button>
                  <input
                    :value="item.qty"
                    type="text"
                    inputmode="numeric"
                    class="w-8 h-6.5 text-center rounded-md border border-border bg-background text-xs font-bold tabular-nums focus:outline-none focus:ring-1 focus:ring-primary"
                    @change="(e) => setItemQty(item, (e.target as HTMLInputElement).value)"
                  />
                  <button
                    @click="increaseQty(item)"
                    class="h-6.5 w-6.5 rounded-md border border-border bg-background flex items-center justify-center text-foreground hover:bg-muted transition cursor-pointer"
                    title="Increase quantity"
                  >
                    <Plus class="h-3 w-3" />
                  </button>
                  <button
                    @click="removeItem(item)"
                    class="h-6.5 w-6.5 rounded-md border border-destructive/30 bg-destructive/10 text-destructive flex items-center justify-center hover:bg-destructive/20 transition ml-0.5 cursor-pointer"
                    title="Remove item from bill"
                  >
                    <Trash2 class="h-3 w-3" />
                  </button>
                </div>
              </div>

              <button
                @click="addItemDialogOpen = true"
                class="w-full py-2 rounded-xl border-2 border-dashed border-primary/30 text-primary hover:bg-primary/5 text-xs font-bold flex items-center justify-center gap-1.5 transition mt-1.5 cursor-pointer"
              >
                <Plus class="h-3.5 w-3.5" /> Add Item from Menu
              </button>
            </template>

            <!-- Normal Mode Item Row -->
            <template v-else>
              <div
                v-for="(i, idx) in selectedOrder.items"
                :key="idx"
                class="flex justify-between items-center text-xs py-1.5 px-1 border-b border-border/40 last:border-0"
              >
                <div class="flex items-center gap-2 truncate">
                  <span class="text-muted-foreground font-bold tabular-nums shrink-0">{{ i.qty }}×</span>
                  <span class="font-medium text-foreground truncate">{{ i.name }}</span>
                </div>
                <span class="tabular-nums font-semibold shrink-0 ml-2">₹{{ (i.price * i.qty).toFixed(0) }}</span>
              </div>
            </template>
          </div>

          <!-- 2. Pinned Bottom Panel (Zero Scrolling Required) -->
          <div class="border-t border-border bg-card shrink-0">
            <!-- Discount Section (in Edit Mode) -->
            <div v-if="editMode" class="p-3 border-b border-border bg-primary/5 space-y-2">
              <div class="flex items-center justify-between text-xs font-bold text-primary">
                <div class="flex items-center gap-1.5">
                  <Tag class="h-3.5 w-3.5" /> Discount
                </div>
                <span v-if="discountValue > 0" class="text-success font-semibold">− ₹{{ discountValue.toFixed(0) }}</span>
              </div>
              <div class="flex gap-2">
                <div class="flex rounded-lg border border-border overflow-hidden text-xs font-semibold">
                  <button
                    @click="discountType = 'fixed'"
                    :class="['px-2.5 py-1 transition cursor-pointer', discountType === 'fixed' ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-muted/40 text-muted-foreground']"
                  >
                    ₹ Flat
                  </button>
                  <button
                    @click="discountType = 'percent'"
                    :class="['px-2.5 py-1 transition cursor-pointer', discountType === 'percent' ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-muted/40 text-muted-foreground']"
                  >
                    % Off
                  </button>
                </div>
                <div class="relative flex-1">
                  <span class="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-xs font-bold">
                    {{ discountType === 'percent' ? '%' : '₹' }}
                  </span>
                  <input
                    v-model="discountInput"
                    type="text"
                    inputmode="numeric"
                    pattern="[0-9]*"
                    placeholder="0"
                    class="w-full pl-6 pr-3 py-1 rounded-lg border border-border bg-background text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary/40 tabular-nums"
                    @keydown="(e) => { if (!/^[0-9]$/.test(e.key) && !['Backspace','Delete','Tab','ArrowLeft','ArrowRight'].includes(e.key)) e.preventDefault() }"
                    @input="discountInput = discountInput.replace(/[^0-9]/g, '')"
                  />
                </div>
              </div>
            </div>

            <!-- Compact Totals Calculation -->
            <div class="px-3.5 py-2.5 bg-muted/15 border-b border-border/50 space-y-1 text-xs">
              <div class="flex justify-between text-muted-foreground">
                <span>Subtotal</span>
                <span class="tabular-nums font-medium">₹{{ subtotalBeforeDiscount.toFixed(0) }}</span>
              </div>
              <div v-if="discountValue > 0" class="flex justify-between text-success font-medium">
                <span class="flex items-center gap-1"><Tag class="h-3 w-3" /> Discount ({{ discountType === 'percent' ? discountInput + '%' : 'Flat' }})</span>
                <span class="tabular-nums font-bold">− ₹{{ discountValue.toFixed(0) }}</span>
              </div>
              <div class="flex justify-between text-muted-foreground">
                <span>GST ({{ gstPct }}%)</span>
                <span class="tabular-nums font-medium">₹{{ tax.toFixed(0) }}</span>
              </div>
              <div class="flex justify-between font-display text-base font-bold pt-1 border-t border-border/50 text-foreground">
                <span>Total Due</span>
                <span class="tabular-nums text-primary font-bold">₹{{ total.toFixed(0) }}</span>
              </div>
            </div>

            <!-- Payment Method & Cash Calculator (Normal Mode) -->
            <div v-if="!editMode" class="p-3 space-y-2">
              <!-- Compact 1-Row Payment Method Selector -->
              <div class="grid grid-cols-3 gap-1.5">
                <button
                  v-for="m in paymentMethods"
                  :key="m.k"
                  @click="method = m.k"
                  :class="[
                    'flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg border text-xs font-semibold transition cursor-pointer',
                    method === m.k
                      ? 'border-primary bg-primary/10 text-primary shadow-2xs font-bold'
                      : 'border-border hover:border-primary/40 text-muted-foreground'
                  ]"
                >
                  <component :is="m.icon" class="h-3.5 w-3.5" />
                  <span>{{ m.label }}</span>
                </button>
              </div>

              <!-- Instant Cash Input & Change Return Banner (Always Visible) -->
              <div v-if="method === 'CASH'" class="p-2.5 rounded-xl border border-border bg-muted/20 flex items-center justify-between gap-2.5">
                <div class="flex-1 min-w-0">
                  <label class="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-0.5">Customer Gives</label>
                  <div class="relative">
                    <span class="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-xs font-bold">₹</span>
                    <input
                      v-model="cashGiven"
                      type="text"
                      inputmode="numeric"
                      pattern="[0-9]*"
                      placeholder="e.g. 500"
                      class="w-full pl-6 pr-2 py-1 rounded-lg border border-border bg-background text-sm font-bold focus:outline-none focus:ring-1 focus:ring-primary tabular-nums"
                      @keydown="(e) => { if (!/^[0-9]$/.test(e.key) && !['Backspace','Delete','Tab','ArrowLeft','ArrowRight','Home','End'].includes(e.key)) e.preventDefault() }"
                      @input="cashGiven = cashGiven.replace(/[^0-9]/g, '')"
                    />
                  </div>
                </div>

                <!-- Live Return to Customer Display -->
                <div class="shrink-0 text-right">
                  <template v-if="cashGivenNum > 0">
                    <div v-if="cashShortfall > 0" class="px-2.5 py-1 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-right">
                      <div class="text-[9px] font-bold uppercase">Shortfall</div>
                      <div class="text-xs font-bold tabular-nums">₹{{ cashShortfall.toFixed(0) }}</div>
                    </div>
                    <div v-else class="px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-right">
                      <div class="text-[9px] font-bold uppercase tracking-wider">Return to Customer</div>
                      <div class="text-sm font-extrabold tabular-nums">₹{{ changeAmount.toFixed(0) }}</div>
                    </div>
                  </template>
                  <template v-else>
                    <div class="px-2.5 py-1 rounded-lg bg-muted/40 border border-border text-muted-foreground text-right">
                      <div class="text-[9px] font-medium">Exact Bill</div>
                      <div class="text-xs font-bold tabular-nums">₹{{ total.toFixed(0) }}</div>
                    </div>
                  </template>
                </div>
              </div>
            </div>

            <!-- Sticky Action Buttons at Bottom -->
            <div class="p-3 pt-0 space-y-1.5">
              <!-- Edit Mode: Save Changes & Cancel -->
              <template v-if="editMode">
                <Button
                  @click="saveEdits"
                  :disabled="savingEdit"
                  class="w-full h-9.5 gradient-primary text-primary-foreground font-bold shadow-soft text-xs cursor-pointer"
                >
                  <Save class="h-3.5 w-3.5 mr-1.5" />
                  {{ savingEdit ? 'Saving Changes...' : 'Save Bill Changes' }}
                </Button>
                <Button
                  @click="cancelEdit"
                  variant="outline"
                  class="w-full h-8 text-xs cursor-pointer"
                >
                  <X class="h-3.5 w-3.5 mr-1.5" /> Cancel
                </Button>
              </template>

              <!-- Normal Mode: Complete Payment & Download PDF -->
              <template v-else>
                <Button
                  @click="handleCompletePayment"
                  :disabled="actionLoading || !cashValid"
                  class="w-full h-10.5 gradient-primary text-primary-foreground font-bold shadow-soft text-xs sm:text-sm cursor-pointer"
                >
                  <CheckCircle2 class="h-4 w-4 mr-1.5" />
                  <span>{{ actionLoading ? 'Processing...' : (method === 'CASH' && changeAmount > 0 ? `Complete Payment · Return ₹${changeAmount.toFixed(0)}` : 'Complete Payment') }}</span>
                </Button>
                <Button
                  @click="downloadPDF(selectedOrder, false)"
                  variant="outline"
                  class="w-full h-8 text-xs cursor-pointer"
                >
                  <Download class="h-3.5 w-3.5 mr-1.5" /> Download Receipt PDF
                </Button>
              </template>
            </div>
          </div>
        </template>
      </aside>
    </div>

    <!-- ── Mobile Floating Quick Settlement Lower Bar (Waiter Style) ─────── -->
    <div
      v-if="selectedOrder && activeTab === 'billing' && !mobileInvoiceOpen"
      class="fixed bottom-4 left-3 right-3 z-40 p-3 sm:p-4 rounded-2xl bg-card/95 backdrop-blur-md border border-primary/40 shadow-2xl flex items-center justify-between xl:hidden cursor-pointer active:scale-[0.99] transition"
      @click="mobileInvoiceOpen = true"
    >
      <div class="min-w-0 pr-3">
        <div class="text-xs font-bold text-foreground truncate flex items-center gap-1.5">
          <span class="h-2.5 w-2.5 rounded-full bg-primary animate-pulse shrink-0" />
          <span class="truncate font-display font-extrabold text-sm">
            {{ selectedOrder.orderType === 'PARCEL' || Number(selectedOrder.tableNumber) === 0 ? `Takeaway: ${selectedOrder.customerName || 'Parcel'}` : `Table ${selectedOrder.tableNumber}` }}
          </span>
        </div>
        <div class="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5">
          <span>{{ selectedOrder.items?.length || 0 }} items</span>
          <span>·</span>
          <span>Bill: <strong class="text-primary font-bold text-sm">₹{{ total.toFixed(0) }}</strong></span>
        </div>
      </div>

      <Button
        @click.stop="mobileInvoiceOpen = true"
        class="h-10 px-4 gradient-primary text-primary-foreground font-bold text-xs shadow-glow flex items-center gap-1.5 cursor-pointer shrink-0"
      >
        <span>Complete Bill</span>
        <ArrowRight class="h-4 w-4" />
      </Button>
    </div>

    <!-- ── Mobile Fullscreen Billing & Invoice Modal (Clean & Fast on Phone) ─ -->
    <Teleport to="body">
      <Transition name="fade">
        <div
          v-if="mobileInvoiceOpen && selectedOrder"
          class="fixed inset-0 z-50 bg-background flex flex-col xl:hidden"
        >
          <!-- Mobile Top Navigation Header -->
          <div class="p-3 border-b border-border flex items-center justify-between shrink-0 bg-muted/20">
            <button
              @click="mobileInvoiceOpen = false"
              class="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl border border-border bg-card hover:bg-muted text-foreground shadow-2xs cursor-pointer"
            >
              <ArrowLeft class="h-3.5 w-3.5" />
              <span>Back</span>
            </button>

            <div class="text-center font-bold text-sm truncate max-w-[160px]">
              {{ selectedOrder.orderType === 'PARCEL' || Number(selectedOrder.tableNumber) === 0 ? `Takeaway: ${selectedOrder.customerName || 'Parcel'}` : `Table ${selectedOrder.tableNumber}` }}
            </div>

            <div class="flex items-center gap-1.5">
              <button
                v-if="!editMode"
                @click="enterEditMode"
                class="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold border border-border bg-card text-foreground cursor-pointer"
              >
                <Pencil class="h-3 w-3" /> Edit
              </button>
              <button
                v-else
                @click="cancelEdit"
                class="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold border border-destructive/30 text-destructive bg-destructive/5 cursor-pointer"
              >
                <X class="h-3 w-3" /> Cancel
              </button>
            </div>
          </div>

          <!-- Edit Mode Banner on Mobile -->
          <div v-if="editMode" class="px-4 py-2 bg-amber-500/10 border-b border-amber-500/20 flex items-center justify-between shrink-0">
            <span class="text-xs text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1.5">
              <Pencil class="h-3.5 w-3.5 text-amber-500" /> Bill Edit Mode
            </span>
            <button
              @click="addItemDialogOpen = true"
              class="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold bg-primary text-primary-foreground shadow-sm hover:opacity-90 transition cursor-pointer"
            >
              <Plus class="h-3.5 w-3.5" /> Add Items
            </button>
          </div>

          <!-- Scrollable Items Area on Mobile -->
          <div class="flex-1 overflow-y-auto p-3.5 space-y-1.5 min-h-0">
            <template v-if="editMode">
              <div v-if="editableItems.length === 0" class="p-6 text-center text-muted-foreground border border-dashed border-border rounded-xl">
                <UtensilsCrossed class="h-6 w-6 mx-auto mb-1 opacity-40" />
                <p class="text-xs font-medium">All items removed. Add items from menu.</p>
              </div>
              <div
                v-for="item in editableItems"
                :key="item.id"
                class="flex items-center justify-between gap-2 p-2 rounded-xl border border-border bg-muted/20"
              >
                <div class="flex-1 min-w-0">
                  <div class="text-xs font-semibold truncate flex items-center gap-1">
                    <span>{{ item.name }}</span>
                    <Badge v-if="item.isNew" class="bg-primary/20 text-primary text-[9px] px-1 py-0 h-4">NEW</Badge>
                  </div>
                  <div class="text-[11px] text-muted-foreground mt-0.5">₹{{ item.price }} each · <strong class="text-foreground">₹{{ (item.price * item.qty).toFixed(0) }}</strong></div>
                </div>
                <div class="flex items-center gap-1 shrink-0">
                  <button @click="decreaseQty(item)" class="h-6.5 w-6.5 rounded-md border border-border bg-background flex items-center justify-center cursor-pointer"><Minus class="h-3 w-3" /></button>
                  <span class="w-6 text-center font-bold text-xs tabular-nums">{{ item.qty }}</span>
                  <button @click="increaseQty(item)" class="h-6.5 w-6.5 rounded-md border border-border bg-background flex items-center justify-center cursor-pointer"><Plus class="h-3 w-3" /></button>
                  <button @click="removeItem(item)" class="h-6.5 w-6.5 rounded-md border border-destructive/30 bg-destructive/10 text-destructive flex items-center justify-center ml-1 cursor-pointer"><Trash2 class="h-3 w-3" /></button>
                </div>
              </div>
            </template>

            <template v-else>
              <div
                v-for="(i, idx) in selectedOrder.items"
                :key="idx"
                class="flex justify-between items-center text-xs py-2 px-1 border-b border-border/40 last:border-0"
              >
                <div class="flex items-center gap-2 truncate">
                  <span class="text-muted-foreground font-bold tabular-nums shrink-0">{{ i.qty }}×</span>
                  <span class="font-medium text-foreground truncate">{{ i.name }}</span>
                </div>
                <span class="tabular-nums font-semibold shrink-0 ml-2">₹{{ (i.price * i.qty).toFixed(0) }}</span>
              </div>
            </template>
          </div>

          <!-- Mobile Pinned Checkout Panel (Always visible at the bottom) -->
          <div class="border-t border-border bg-card shrink-0 shadow-lg">
            <!-- Discount in Edit Mode -->
            <div v-if="editMode" class="p-3 border-b border-border bg-primary/5 space-y-2">
              <div class="flex items-center justify-between text-xs font-bold text-primary">
                <div class="flex items-center gap-1.5"><Tag class="h-3.5 w-3.5" /> Discount</div>
                <span v-if="discountValue > 0" class="text-success font-semibold">− ₹{{ discountValue.toFixed(0) }}</span>
              </div>
              <div class="flex gap-2">
                <div class="flex rounded-lg border border-border overflow-hidden text-xs font-semibold">
                  <button @click="discountType = 'fixed'" :class="['px-2.5 py-1', discountType === 'fixed' ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground']">₹ Flat</button>
                  <button @click="discountType = 'percent'" :class="['px-2.5 py-1', discountType === 'percent' ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground']">% Off</button>
                </div>
                <input
                  v-model="discountInput"
                  type="text"
                  inputmode="numeric"
                  placeholder="0"
                  class="flex-1 px-3 py-1 rounded-lg border border-border bg-background text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary tabular-nums"
                />
              </div>
            </div>

            <!-- Totals -->
            <div class="px-3.5 py-2 bg-muted/15 border-b border-border/50 space-y-0.5 text-xs">
              <div class="flex justify-between text-muted-foreground">
                <span>Subtotal</span>
                <span class="tabular-nums font-medium">₹{{ subtotalBeforeDiscount.toFixed(0) }}</span>
              </div>
              <div v-if="discountValue > 0" class="flex justify-between text-success font-medium">
                <span>Discount</span>
                <span class="tabular-nums font-bold">− ₹{{ discountValue.toFixed(0) }}</span>
              </div>
              <div class="flex justify-between text-muted-foreground">
                <span>GST ({{ gstPct }}%)</span>
                <span class="tabular-nums font-medium">₹{{ tax.toFixed(0) }}</span>
              </div>
              <div class="flex justify-between font-display text-sm font-bold pt-1 border-t border-border/50 text-foreground">
                <span>Total Due</span>
                <span class="tabular-nums text-primary font-extrabold text-base">₹{{ total.toFixed(0) }}</span>
              </div>
            </div>

            <!-- Payment Methods & Cash Calculator on Mobile -->
            <div v-if="!editMode" class="p-2.5 space-y-2">
              <div class="grid grid-cols-3 gap-1.5">
                <button
                  v-for="m in paymentMethods"
                  :key="m.k"
                  @click="method = m.k"
                  :class="[
                    'flex items-center justify-center gap-1.5 py-1.5 px-1.5 rounded-lg border text-xs font-semibold transition cursor-pointer',
                    method === m.k ? 'border-primary bg-primary/10 text-primary font-bold shadow-2xs' : 'border-border text-muted-foreground'
                  ]"
                >
                  <component :is="m.icon" class="h-3.5 w-3.5" />
                  <span>{{ m.label }}</span>
                </button>
              </div>

              <!-- Cash Calculator on Mobile -->
              <div v-if="method === 'CASH'" class="p-2 rounded-xl border border-border bg-muted/20 flex items-center justify-between gap-2">
                <div class="flex-1 min-w-0">
                  <label class="text-[9px] font-bold uppercase tracking-wider text-muted-foreground block mb-0.5">Customer Gives</label>
                  <div class="relative">
                    <span class="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-xs font-bold">₹</span>
                    <input
                      v-model="cashGiven"
                      type="text"
                      inputmode="numeric"
                      pattern="[0-9]*"
                      placeholder="e.g. 500"
                      class="w-full pl-5 pr-2 py-1 rounded-lg border border-border bg-background text-xs font-bold focus:outline-none focus:ring-1 focus:ring-primary tabular-nums"
                      @keydown="(e) => { if (!/^[0-9]$/.test(e.key) && !['Backspace','Delete','Tab','ArrowLeft','ArrowRight','Home','End'].includes(e.key)) e.preventDefault() }"
                      @input="cashGiven = cashGiven.replace(/[^0-9]/g, '')"
                    />
                  </div>
                </div>

                <div class="shrink-0 text-right">
                  <template v-if="cashGivenNum > 0">
                    <div v-if="cashShortfall > 0" class="px-2 py-1 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-right">
                      <div class="text-[8px] font-bold uppercase">Shortfall</div>
                      <div class="text-xs font-bold tabular-nums">₹{{ cashShortfall.toFixed(0) }}</div>
                    </div>
                    <div v-else class="px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-right">
                      <div class="text-[8px] font-bold uppercase tracking-wider">Return Change</div>
                      <div class="text-sm font-extrabold tabular-nums">₹{{ changeAmount.toFixed(0) }}</div>
                    </div>
                  </template>
                  <template v-else>
                    <div class="px-2 py-1 rounded-lg bg-muted/40 border border-border text-muted-foreground text-right">
                      <div class="text-[8px] font-medium">Exact Bill</div>
                      <div class="text-xs font-bold tabular-nums">₹{{ total.toFixed(0) }}</div>
                    </div>
                  </template>
                </div>
              </div>
            </div>

            <!-- Action Buttons on Mobile -->
            <div class="p-2.5 pt-0 space-y-1.5">
              <template v-if="editMode">
                <Button @click="saveEdits" :disabled="savingEdit" class="w-full h-9.5 gradient-primary text-primary-foreground font-bold text-xs cursor-pointer shadow-soft">
                  <Save class="h-3.5 w-3.5 mr-1.5" /> Save Bill Changes
                </Button>
                <Button @click="cancelEdit" variant="outline" class="w-full h-8 text-xs cursor-pointer">
                  <X class="h-3.5 w-3.5 mr-1.5" /> Cancel
                </Button>
              </template>
              <template v-else>
                <Button
                  @click="handleCompletePayment"
                  :disabled="actionLoading || !cashValid"
                  class="w-full h-10.5 gradient-primary text-primary-foreground font-bold text-xs sm:text-sm cursor-pointer shadow-soft"
                >
                  <CheckCircle2 class="h-4 w-4 mr-1.5" />
                  <span>{{ actionLoading ? 'Processing...' : (method === 'CASH' && changeAmount > 0 ? `Complete Payment · Return ₹${changeAmount.toFixed(0)}` : 'Complete Payment') }}</span>
                </Button>
                <Button @click="downloadPDF(selectedOrder, false)" variant="outline" class="w-full h-8 text-xs cursor-pointer">
                  <Download class="h-3.5 w-3.5 mr-1.5" /> Download Receipt PDF
                </Button>
              </template>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
    </div>

    <!-- ═══════════════════════════════════════════════════════════════════════ -->
    <!-- TAB 2: WAITING QUEUE (Clean & Efficient)                               -->
    <!-- ═══════════════════════════════════════════════════════════════════════ -->
    <div v-else-if="activeTab === 'queue'" class="space-y-6">
      <!-- Clean Search Header without redundant filters/buttons -->
      <div class="rounded-2xl bg-card border border-border shadow-soft p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div class="space-y-0.5">
          <h3 class="font-display text-lg sm:text-xl font-bold flex items-center gap-2">
            <Users class="h-5 w-5 text-primary" /> Active Waiting Queue ({{ activeWaitingEntries.length }})
          </h3>
          <p class="hidden sm:block text-xs text-muted-foreground">Notify waiting guests or seat them at an available table when ready.</p>
        </div>

        <div class="relative w-full sm:w-72">
          <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            v-model="queueSearch"
            placeholder="Search waiting guest..."
            class="pl-9 h-9 text-xs bg-muted/20"
          />
        </div>
      </div>

      <!-- Queue Cards Grid -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div v-if="displayedQueue.length === 0" class="col-span-full py-16 text-center text-muted-foreground rounded-2xl bg-card border border-border p-8">
          <Users class="h-10 w-10 mx-auto mb-3 opacity-30 text-primary" />
          <h4 class="font-display text-base font-bold text-foreground">No customers in waiting queue</h4>
          <p class="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
            Use the <strong>+ Add to Queue</strong> button at the top to add walk-in customers when tables are occupied.
          </p>
        </div>

        <div
          v-for="(entry, index) in displayedQueue"
          :key="entry._id || entry.id"
          class="rounded-2xl bg-card border border-border shadow-soft p-4 sm:p-5 flex flex-col justify-between gap-3.5 transition hover:border-primary/40 relative overflow-hidden"
        >
          <!-- Top Row: Token Number & Customer Details -->
          <div>
            <div class="flex items-start justify-between gap-2">
              <div class="flex items-center gap-3">
                <span class="h-9 min-w-9 px-2.5 rounded-xl bg-primary text-primary-foreground font-display font-extrabold text-sm flex items-center justify-center shadow-xs">
                  #{{ entry.queueNumber || index + 1 }}
                </span>
                <div>
                  <h4 class="font-bold text-base text-foreground leading-tight">
                    {{ entry.customerName }}
                  </h4>
                  <div class="text-xs text-muted-foreground mt-0.5 flex items-center gap-2">
                    <span class="flex items-center gap-1"><Users class="h-3 w-3 text-primary" /> {{ entry.partySize || 2 }} Guests</span>
                    <span>·</span>
                    <span class="flex items-center gap-1 text-amber-600 dark:text-amber-400 font-medium"><Clock class="h-3 w-3" /> {{ elapsed(entry.createdAt) }}</span>
                  </div>
                </div>
              </div>

              <!-- Status Pill -->
              <Badge v-if="entry.status === 'CALLED'" class="bg-primary/20 text-primary border-primary/30 text-[10px] animate-pulse">
                🔔 Called
              </Badge>
              <Badge v-else class="bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30 text-[10px]">
                ⏳ Waiting
              </Badge>
            </div>

            <!-- Table Allocation Indicator -->
            <div v-if="getBestTableFor(entry)" class="mt-3 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between text-xs text-emerald-700 dark:text-emerald-400 font-semibold">
              <span class="flex items-center gap-1.5"><CheckCircle class="h-3.5 w-3.5" /> Empty table ready</span>
              <span class="font-bold">Table T-{{ getBestTableFor(entry) }} ({{ getTableCapacity(getBestTableFor(entry) || 1) }} Seats)</span>
            </div>
            <div v-else class="mt-3 px-3 py-1.5 rounded-xl bg-muted/40 border border-border flex items-center justify-between text-xs text-muted-foreground">
              <span>No {{ entry.partySize || 2 }}-seater tables vacant</span>
              <span class="text-[11px]">Waiting for free table</span>
            </div>
          </div>

          <!-- Simplified 1-Click Action: Tick Mark to Seat & Allocate Table -->
          <div class="pt-3 border-t border-border flex items-center gap-2">
            <button
              @click="handleQuickSeat(entry)"
              :disabled="queueActionLoading || !getBestTableFor(entry)"
              class="flex-1 h-10 rounded-xl gradient-primary text-primary-foreground font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-xs hover:opacity-90 active:scale-98 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              :title="getBestTableFor(entry) ? `Tick to allocate Table ${getBestTableFor(entry)} and remove from queue` : 'No vacant table available'"
            >
              <div class="h-5 w-5 rounded-full bg-white/25 flex items-center justify-center">
                <Check class="h-3.5 w-3.5 stroke-[3]" />
              </div>
              <span v-if="getBestTableFor(entry)">Tick to Seat at Table T-{{ getBestTableFor(entry) }}</span>
              <span v-else>No Vacant Tables</span>
            </button>

            <!-- Quick Remove button if customer left -->
            <button
              @click="handleCancelQueue(entry)"
              class="h-10 w-10 rounded-xl border border-border bg-background hover:bg-destructive/10 text-muted-foreground hover:text-destructive flex items-center justify-center transition shrink-0 cursor-pointer"
              title="Remove customer from queue"
            >
              <X class="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- ═══════════════════════════════════════════════════════════════════════ -->
    <!-- TAB 3: TRANSACTION HISTORY                                              -->
    <!-- ═══════════════════════════════════════════════════════════════════════ -->
    <div v-else-if="activeTab === 'history'" class="space-y-6">
      <section class="rounded-2xl bg-card border border-border shadow-soft overflow-hidden">
        <div class="p-4 sm:p-5 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 class="font-display text-xl font-bold">Transaction History</h3>
            <p class="hidden sm:block text-xs text-muted-foreground mt-0.5">Record of all paid invoices and takeaway orders</p>
          </div>
          <div class="relative w-full sm:w-80">
            <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              v-model="historySearch"
              placeholder="Search receipt, table, guest, method, dishes…"
              class="pl-9 pr-8 h-9 text-xs bg-muted/40"
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
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="bg-muted/40 text-muted-foreground text-xs uppercase tracking-wider">
              <tr>
                <th class="text-left px-5 py-3 font-medium">Txn</th>
                <th class="text-left px-5 py-3 font-medium">Order / Table</th>
                <th class="text-right px-5 py-3 font-medium">Amount</th>
                <th class="text-left px-5 py-3 font-medium">Method</th>
                <th class="text-left px-5 py-3 font-medium">Time</th>
                <th class="text-right px-5 py-3 font-medium">Receipt</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="filteredTransactions.length === 0">
                <td colspan="6" class="px-5 py-8 text-center text-muted-foreground">
                  <span v-if="historySearch">No transactions match "{{ historySearch }}"</span>
                  <span v-else>No transactions recorded yet.</span>
                </td>
              </tr>
              <tr v-for="(t, idx) in filteredTransactions" :key="t.id || t._id" class="border-t border-border hover:bg-muted/20 transition">
                <td class="px-5 py-3 font-semibold text-xs text-foreground">TXN-{{ String(idx + 1).padStart(3, '0') }}</td>
                <td class="px-5 py-3">
                  <div class="font-semibold flex items-center gap-1.5">
                    <span v-if="t.orderId?.orderType === 'PARCEL' || Number(t.orderId?.tableNumber) === 0" class="text-purple-600 dark:text-purple-400">
                      📦 Parcel: {{ t.orderId?.customerName || 'Takeaway' }}
                    </span>
                    <span v-else>
                      Table {{ t.orderId?.tableNumber ?? '—' }}
                    </span>
                  </div>
                  <div class="text-xs text-muted-foreground">{{ t.orderId?.items?.length || 0 }} items</div>
                </td>
                <td class="px-5 py-3 text-right tabular-nums font-bold">₹{{ (t.totalAmount || 0).toFixed(0) }}</td>
                <td class="px-5 py-3"><Badge variant="secondary" class="text-[10px]">{{ t.paymentMethod }}</Badge></td>
                <td class="px-5 py-3 text-muted-foreground text-xs">{{ formatTime(t.paidAt || t.createdAt) }}</td>
                <td class="px-5 py-3 text-right">
                  <Button variant="ghost" size="sm" @click="downloadPDF(t, true)" class="h-7 text-xs">
                    <Download class="h-3 w-3 mr-1" /> PDF
                  </Button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>

    <!-- ═══════════════════════════════════════════════════════════════════════ -->
    <!-- MODAL 1: NEW PARCEL / TAKEAWAY ORDER DIALOG                             -->
    <!-- ═══════════════════════════════════════════════════════════════════════ -->
    <Dialog :open="parcelDialogOpen" @update:open="parcelDialogOpen = $event">
      <DialogContent class="sm:max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader class="p-5 pb-3 border-b border-border bg-card">
          <DialogTitle class="font-display text-xl font-bold flex items-center gap-2">
            <Package class="h-5 w-5 text-purple-600" /> Create Takeaway / Parcel Order
          </DialogTitle>
          <DialogDescription class="text-xs text-muted-foreground">
            Add takeaway items for the customer. Kitchen chef will prepare and pack the parcel order.
          </DialogDescription>

          <!-- Customer details inputs -->
          <div class="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div>
              <label class="text-[11px] font-semibold text-foreground/80 block mb-1">Customer Name *</label>
              <Input
                v-model="parcelCustomerName"
                placeholder="e.g. Ramesh Shah"
                class="h-9 text-xs"
              />
            </div>
            <div>
              <label class="text-[11px] font-semibold text-foreground/80 block mb-1">Phone Number</label>
              <Input
                v-model="parcelCustomerPhone"
                placeholder="e.g. 9876543210"
                class="h-9 text-xs"
              />
            </div>
            <div>
              <label class="text-[11px] font-semibold text-foreground/80 block mb-1">Packing / Order Note</label>
              <Input
                v-model="parcelNotes"
                placeholder="e.g. Pack extra sauce / cutlery"
                class="h-9 text-xs"
              />
            </div>
          </div>
        </DialogHeader>

        <!-- Main Body: Menu Selector on Left, Parcel Cart on Right -->
        <div class="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-[1fr_320px] min-h-[350px]">

          <!-- Left: Menu Items with search and category filters -->
          <div class="flex flex-col border-r border-border overflow-hidden">
            <!-- Search & Filters -->
            <div class="p-3 border-b border-border space-y-2 bg-muted/20">
              <div class="relative">
                <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  v-model="parcelMenuSearch"
                  placeholder="Search dishes to pack..."
                  class="pl-8 h-8 text-xs bg-background"
                />
              </div>
              <div class="flex gap-1 overflow-x-auto pb-0.5 scrollbar-none">
                <button
                  @click="parcelCategory = 'All'"
                  :class="['px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition', parcelCategory === 'All' ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80 text-muted-foreground']"
                >
                  All
                </button>
                <button
                  v-for="c in categories"
                  :key="c.id || c._id"
                  @click="parcelCategory = c.name"
                  :class="['px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition', parcelCategory === c.name ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80 text-muted-foreground']"
                >
                  {{ c.name }}
                </button>
              </div>
            </div>

            <!-- Menu Grid -->
            <div class="flex-1 overflow-y-auto p-4 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div v-if="filteredParcelMenuItems.length === 0" class="col-span-full py-12 text-center text-muted-foreground text-xs">
                No menu items found.
              </div>
              <div
                v-for="item in filteredParcelMenuItems"
                :key="item._id"
                class="p-2.5 rounded-xl border border-border bg-card hover:border-primary/40 transition flex items-center justify-between gap-2"
              >
                <div class="min-w-0 flex-1">
                  <div class="font-semibold text-xs truncate text-foreground">{{ item.name }}</div>
                  <div class="text-xs font-bold text-primary mt-0.5">₹{{ item.price }}</div>
                </div>

                <div class="flex items-center gap-1 shrink-0">
                  <template v-if="getParcelCartQty(item._id) > 0">
                    <button
                      @click="decParcelCart(item._id)"
                      class="h-7 w-7 rounded-lg border border-border flex items-center justify-center hover:bg-muted"
                    >
                      <Minus class="h-3 w-3" />
                    </button>
                    <span class="w-6 text-center text-xs font-bold tabular-nums">
                      {{ getParcelCartQty(item._id) }}
                    </span>
                    <button
                      @click="addToParcelCart(item)"
                      class="h-7 w-7 rounded-lg bg-primary text-primary-foreground flex items-center justify-center hover:opacity-90"
                    >
                      <Plus class="h-3 w-3" />
                    </button>
                  </template>
                  <Button
                    v-else
                    @click="addToParcelCart(item)"
                    size="sm"
                    class="h-7 text-xs px-2.5 gradient-primary text-primary-foreground font-semibold"
                  >
                    + Add
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <!-- Right: Parcel Cart Summary -->
          <div class="flex flex-col bg-muted/10 overflow-hidden">
            <div class="p-3 border-b border-border font-display text-sm font-bold flex items-center justify-between">
              <span>Parcel Cart ({{ parcelCart.reduce((s, i) => s + i.quantity, 0) }})</span>
              <button
                v-if="parcelCart.length > 0"
                @click="parcelCart = []"
                class="text-[10px] text-destructive hover:underline font-semibold"
              >
                Clear
              </button>
            </div>

            <div class="flex-1 overflow-y-auto p-3 space-y-2">
              <div v-if="parcelCart.length === 0" class="py-12 text-center text-muted-foreground text-xs">
                <ShoppingBag class="h-6 w-6 mx-auto mb-1 opacity-40" />
                Select items from menu to add
              </div>

              <div
                v-for="item in parcelCart"
                :key="item.menuItemId"
                class="p-2 rounded-lg bg-card border border-border space-y-1"
              >
                <div class="flex justify-between items-center text-xs">
                  <span class="font-semibold text-foreground truncate max-w-[140px]">{{ item.name }}</span>
                  <span class="font-bold tabular-nums">₹{{ (item.price * item.quantity).toFixed(0) }}</span>
                </div>
                <div class="flex justify-between items-center text-[11px] text-muted-foreground">
                  <span>₹{{ item.price }} × {{ item.quantity }}</span>
                  <div class="flex items-center gap-1">
                    <button @click="decParcelCart(item.menuItemId)" class="h-5 w-5 rounded border border-border flex items-center justify-center hover:bg-muted">
                      <Minus class="h-2.5 w-2.5" />
                    </button>
                    <button @click="addToParcelCart({ _id: item.menuItemId, name: item.name, price: item.price })" class="h-5 w-5 rounded bg-primary text-primary-foreground flex items-center justify-center">
                      <Plus class="h-2.5 w-2.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <!-- Cart Totals -->
            <div class="p-3 border-t border-border bg-card space-y-1 text-xs">
              <div class="flex justify-between text-muted-foreground">
                <span>Subtotal</span>
                <span class="font-medium tabular-nums">₹{{ parcelSubtotal.toFixed(0) }}</span>
              </div>
              <div class="flex justify-between text-muted-foreground">
                <span>GST ({{ gstPct }}%)</span>
                <span class="font-medium tabular-nums">₹{{ parcelGstAmount.toFixed(0) }}</span>
              </div>
              <div class="flex justify-between font-bold text-sm text-foreground pt-1 border-t border-border mt-1">
                <span>Total Amount</span>
                <span class="text-primary tabular-nums">₹{{ parcelTotalAmount.toFixed(0) }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Dialog Footer Actions -->
        <div class="p-4 border-t border-border bg-card flex flex-col sm:flex-row items-center justify-between gap-3">
          <div class="text-xs text-muted-foreground">
            Total: <strong class="text-foreground text-sm font-bold">₹{{ parcelTotalAmount.toFixed(0) }}</strong>
          </div>

          <div class="flex items-center gap-2 w-full sm:w-auto">
            <Button
              @click="parcelDialogOpen = false"
              variant="outline"
              class="h-9 text-xs flex-1 sm:flex-initial"
            >
              Cancel
            </Button>
            <Button
              @click="handleCreateParcelOrder(true)"
              :disabled="parcelSubmitting || parcelCart.length === 0"
              class="h-9 px-4 text-xs font-bold gradient-primary text-primary-foreground shadow-glow flex-1 sm:flex-initial"
            >
              Send to Kitchen
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>

    <!-- ═══════════════════════════════════════════════════════════════════════ -->
    <!-- MODAL 2: ADD TO WAITING QUEUE DIALOG                                    -->
    <!-- ═══════════════════════════════════════════════════════════════════════ -->
    <Dialog :open="addQueueDialogOpen" @update:open="addQueueDialogOpen = $event">
      <DialogContent class="sm:max-w-md p-6">
        <DialogHeader class="mb-3">
          <DialogTitle class="font-display text-lg font-bold flex items-center gap-2">
            <UserPlus class="h-5 w-5 text-primary" /> Add Customer to Waiting Queue
          </DialogTitle>
          <DialogDescription class="text-xs text-muted-foreground">
            Enter the customer's name. A queue number is automatically assigned.
          </DialogDescription>
        </DialogHeader>

        <form @submit.prevent="handleAddToQueue" class="space-y-4">
          <!-- Auto Token Preview Badge -->
          <div class="p-3 bg-primary/10 rounded-xl border border-primary/20 flex items-center justify-between">
            <span class="text-xs font-semibold text-primary">Queue Token (Auto)</span>
            <span class="font-display text-base font-extrabold text-primary">
              Token #{{ activeWaitingEntries.length + 1 }}
            </span>
          </div>

          <div>
            <label class="text-xs font-semibold text-foreground/80 block mb-1">Customer Name *</label>
            <Input
              v-model="newCustomerName"
              placeholder="e.g. Ramesh"
              required
              autofocus
              class="h-10 text-sm font-medium"
            />
          </div>

          <div class="flex items-center justify-between pt-1">
            <span class="text-xs text-muted-foreground font-medium">Party Size (Optional)</span>
            <div class="flex items-center gap-1.5">
              <button
                type="button"
                @click="newPartySize = Math.max(1, newPartySize - 1)"
                class="h-8 w-8 rounded-lg border border-border flex items-center justify-center text-foreground hover:bg-muted"
              >
                <Minus class="h-3 w-3" />
              </button>
              <input
                v-model.number="newPartySize"
                type="number"
                min="1"
                max="50"
                class="w-12 h-8 text-center font-bold text-xs rounded-lg border border-border bg-background"
              />
              <button
                type="button"
                @click="newPartySize++"
                class="h-8 w-8 rounded-lg border border-border flex items-center justify-center text-foreground hover:bg-muted"
              >
                <Plus class="h-3 w-3" />
              </button>
            </div>
          </div>

          <div class="pt-3 border-t border-border flex justify-end gap-2">
            <Button
              type="button"
              @click="addQueueDialogOpen = false"
              variant="outline"
              class="h-9 text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              :disabled="queueActionLoading || !newCustomerName.trim()"
              class="h-9 text-xs font-bold gradient-primary text-primary-foreground shadow-glow px-4"
            >
              {{ queueActionLoading ? 'Adding...' : 'Add to Queue' }}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>

    <!-- ═══════════════════════════════════════════════════════════════════════ -->
    <!-- MODAL 3: SEAT CUSTOMER AT TABLE MODAL                                   -->
    <!-- ═══════════════════════════════════════════════════════════════════════ -->
    <Dialog :open="seatCustomerModal" @update:open="seatCustomerModal = $event">
      <DialogContent class="sm:max-w-md p-6">
        <DialogHeader class="mb-4">
          <DialogTitle class="font-display text-lg font-bold flex items-center gap-2">
            <UtensilsCrossed class="h-5 w-5 text-emerald-500" /> Seat Guest at Table
          </DialogTitle>
          <DialogDescription class="text-xs text-muted-foreground">
            Select an available table to seat {{ selectedQueueEntry?.customerName }} ({{ selectedQueueEntry?.partySize }} guests).
          </DialogDescription>
        </DialogHeader>

        <div class="space-y-4">
          <div class="p-3 bg-muted/20 rounded-xl border border-border flex items-center justify-between text-xs">
            <div>
              <span class="font-bold text-foreground">{{ selectedQueueEntry?.customerName }}</span>
              <div class="text-muted-foreground mt-0.5">Party of {{ selectedQueueEntry?.partySize || 2 }} Members · Waited {{ elapsed(selectedQueueEntry?.createdAt || '') }}</div>
            </div>
            <Badge class="bg-primary/10 text-primary border border-primary/20 text-xs font-bold">
              Token #{{ selectedQueueEntry?.queueNumber || '1' }}
            </Badge>
          </div>

          <div>
            <div class="flex items-center justify-between mb-2">
              <label class="text-xs font-semibold text-foreground/80 block">Select Table (Capacity Guide)</label>
              <span class="text-[11px] text-muted-foreground">Required: {{ selectedQueueEntry?.partySize || 2 }} Seats</span>
            </div>

            <div class="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-[240px] overflow-y-auto p-1">
              <button
                v-for="tbl in Array.from({ length: maxTables }, (_, i) => i + 1)"
                :key="tbl"
                type="button"
                :disabled="occupiedTableNumbers.has(tbl)"
                @click="targetTableNumber = tbl"
                :class="[
                  'p-2.5 rounded-xl border flex flex-col items-center justify-center gap-1 transition relative',
                  occupiedTableNumbers.has(tbl)
                    ? 'opacity-40 bg-muted/50 border-dashed border-border cursor-not-allowed text-muted-foreground'
                    : targetTableNumber === tbl
                      ? 'border-emerald-500 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 ring-2 ring-emerald-500/40 font-bold'
                      : getTableCapacity(tbl) >= (selectedQueueEntry?.partySize || 1)
                        ? 'border-emerald-500/40 bg-emerald-500/5 hover:border-emerald-500 hover:bg-emerald-500/10 text-foreground'
                        : 'border-amber-500/30 bg-amber-500/5 hover:border-amber-500/60 text-foreground'
                ]"
              >
                <div class="flex items-center justify-between w-full">
                  <span class="text-xs font-bold">T-{{ tbl }}</span>
                  <span class="text-[10px] text-muted-foreground font-semibold flex items-center gap-0.5">
                    <Users class="h-2.5 w-2.5 text-primary" /> {{ getTableCapacity(tbl) }}s
                  </span>
                </div>
                <div class="text-[9px] uppercase font-bold tracking-tight mt-0.5">
                  <span v-if="occupiedTableNumbers.has(tbl)" class="text-muted-foreground">Busy</span>
                  <span v-else-if="getTableCapacity(tbl) >= (selectedQueueEntry?.partySize || 1)" class="text-emerald-600 dark:text-emerald-400">
                    ✓ Fits
                  </span>
                  <span v-else class="text-amber-600 dark:text-amber-400">
                    ⚠ Small
                  </span>
                </div>
              </button>
            </div>
          </div>

          <div class="pt-3 border-t border-border flex justify-end gap-2">
            <Button
              type="button"
              @click="seatCustomerModal = false"
              variant="outline"
              class="h-9 text-xs"
            >
              Cancel
            </Button>
            <Button
              @click="handleSeatCustomer"
              :disabled="queueActionLoading || !targetTableNumber"
              class="h-9 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
            >
              {{ queueActionLoading ? 'Seating...' : `Seat at Table ${targetTableNumber || ''}` }}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>

    <!-- ═══════════════════════════════════════════════════════════════════════ -->
    <!-- MODAL 4: ADD ITEMS TO EXISTING BILL MODAL                               -->
    <!-- ═══════════════════════════════════════════════════════════════════════ -->
    <Dialog :open="addItemDialogOpen" @update:open="addItemDialogOpen = $event">
      <DialogContent class="sm:max-w-2xl max-h-[85vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader class="p-5 pb-3 border-b border-border bg-card">
          <DialogTitle class="font-display text-xl font-bold flex items-center gap-2">
            <UtensilsCrossed class="h-5 w-5 text-primary" /> Add Menu Items to Bill
          </DialogTitle>
          <DialogDescription class="text-xs text-muted-foreground">
            Search or filter dishes by category to add directly to {{ selectedOrder?.orderType === 'PARCEL' ? 'Parcel Bill' : `Table ${selectedOrder?.tableNumber}'s bill` }}.
          </DialogDescription>

          <!-- Search & Category Filters -->
          <div class="mt-3 space-y-2.5">
            <div class="relative">
              <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                v-model="menuSearchQuery"
                placeholder="Search food, beverages, desserts..."
                class="pl-9 h-9 text-sm bg-muted/40"
              />
            </div>
            <!-- Category Pills -->
            <div class="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              <button
                @click="selectedCategory = 'All'"
                :class="['px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition', selectedCategory === 'All' ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80 text-muted-foreground']"
              >
                All
              </button>
              <button
                v-for="c in categories"
                :key="c.id || c._id"
                @click="selectedCategory = c.name"
                :class="['px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition', selectedCategory === c.name ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80 text-muted-foreground']"
              >
                {{ c.name }}
              </button>
            </div>
          </div>
        </DialogHeader>

        <!-- Menu Item Cards List -->
        <div class="flex-1 overflow-y-auto p-5 grid grid-cols-1 sm:grid-cols-2 gap-3 min-h-[250px]">
          <div v-if="filteredMenuItems.length === 0" class="col-span-full py-12 text-center text-muted-foreground">
            <ShoppingBag class="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p class="text-sm font-medium">No menu items found</p>
          </div>
          <div
            v-for="item in filteredMenuItems"
            :key="item._id"
            class="p-3 rounded-xl border border-border bg-card hover:border-primary/40 hover:shadow-soft transition flex items-center justify-between gap-3 group"
          >
            <div class="min-w-0 flex-1">
              <div class="font-semibold text-sm truncate text-foreground">{{ item.name }}</div>
              <div class="text-xs font-bold text-primary mt-0.5">₹{{ item.price }}</div>
              <div class="text-[10px] text-muted-foreground truncate mt-0.5">{{ item.category || 'Menu' }}</div>
            </div>

            <!-- Add / Count Badge -->
            <div class="flex items-center gap-1.5 shrink-0">
              <span
                v-if="getItemQtyInEdit(item._id) > 0"
                class="h-6 px-2 rounded-full bg-primary/15 text-primary border border-primary/30 text-xs font-bold flex items-center justify-center"
              >
                {{ getItemQtyInEdit(item._id) }} in bill
              </span>
              <button
                @click="addMenuItemToBill(item)"
                class="h-8 px-3 rounded-lg bg-primary text-primary-foreground text-xs font-bold flex items-center gap-1 shadow-sm hover:opacity-90 active:scale-95 transition"
              >
                <Plus class="h-3.5 w-3.5" /> Add
              </button>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="p-4 border-t border-border bg-muted/20 flex items-center justify-between">
          <div class="text-xs text-muted-foreground font-medium">
            {{ editableItems.length }} total item line(s) in edited bill
          </div>
          <Button @click="addItemDialogOpen = false" class="gradient-primary text-primary-foreground font-bold text-xs h-8 px-4">
            Done Adding
          </Button>
        </div>
      </DialogContent>
    </Dialog>

  </RoleLayout>
</template>

<style scoped>
.slide-down-enter-active, .slide-down-leave-active { transition: all 0.2s ease; }
.slide-down-enter-from, .slide-down-leave-to { opacity: 0; transform: translateY(-6px); }
</style>
