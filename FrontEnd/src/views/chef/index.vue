<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import {
  Clock, Flame, CheckCircle2, Check, CheckCheck,
  UtensilsCrossed, Bell, ArrowDownUp, AlertCircle, Sparkles,
  Search, PackageX, CheckCircle, ShoppingBag, XCircle, X, Printer
} from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import RoleLayout from '@/components/RoleLayout.vue'
import PageHeader from '@/components/PageHeader.vue'
import { chefNav } from '@/lib/nav'
import {
  getOrders, updateOrderStatus, getMenuItems, updateMenuItem,
  getCategoriesByRestaurant, type MenuCategory
} from '@/lib/api'
import { useAuthStore } from '@/stores/auth'
import Button from '@/components/ui/Button.vue'
import Badge from '@/components/ui/Badge.vue'
import Input from '@/components/ui/Input.vue'

const auth = useAuthStore()
const orders = ref<any[]>([])
const menuItems = ref<any[]>([])
const categories = ref<MenuCategory[]>([])
const loading = ref(true)
const actionLoading = ref<string | null>(null)
const view = ref<"active" | "availability" | "completed">("active")
const tick = ref(0)
let interval: any

// Search state
const activeSearch = ref('')
const completedSearch = ref('')
const menuSearch = ref('')
const selectedCategory = ref('All')
const togglingItemId = ref<string | null>(null)

function elapsed(ts: string) {
  if (!ts) return ''
  const diff = Date.now() - new Date(ts).getTime()
  const m = Math.floor(diff / 60000)
  return `${m}m`
}

function isUrgent(ts: string) {
  if (!ts) return false
  const diff = Date.now() - new Date(ts).getTime()
  return diff > 15 * 60 * 1000 // > 15 minutes
}

async function fetchStaticKitchenData() {
  if (!auth.user?.restaurantId) return
  const restaurantId = typeof auth.user.restaurantId === 'string' 
    ? auth.user.restaurantId 
    : (auth.user.restaurantId as any).id || (auth.user.restaurantId as any)._id

  try {
    const [menuRes, catRes] = await Promise.all([
      getMenuItems(restaurantId, 1, 500),
      getCategoriesByRestaurant(restaurantId),
    ])
    menuItems.value = menuRes.data || []
    categories.value = catRes.data || []
  } catch (err) {
    console.error("Failed to load static kitchen data", err)
  }
}

async function fetchKitchenData() {
  if (!auth.user?.restaurantId) return
  const restaurantId = typeof auth.user.restaurantId === 'string' 
    ? auth.user.restaurantId 
    : (auth.user.restaurantId as any).id || (auth.user.restaurantId as any)._id

  try {
    const ordersRes = await getOrders(restaurantId, 1, 100)
    orders.value = ordersRes.data || []
  } catch (err) {
    console.error("Failed to load dynamic kitchen data", err)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  fetchStaticKitchenData()
  fetchKitchenData()
  interval = setInterval(() => {
    tick.value++
    fetchKitchenData()
  }, 5000)
})

onUnmounted(() => {
  clearInterval(interval)
})

// Helper to check if a dish item is completed / ready
function isItemDone(item: any): boolean {
  const s = (item.status || '').toUpperCase()
  return s === 'READY' || s === 'DELIVERED' || s === 'SERVED'
}

// Toggle individual item ready / preparing in kitchen ticket
async function toggleItemReady(order: any, item: any) {
  if (order.allReady) return
  const orderId = order.id || order._id
  const itemId = item.id || item._id
  const isCurrentlyReady = isItemDone(item)
  const targetStatus = isCurrentlyReady ? 'PREPARING' : 'READY'
  
  actionLoading.value = `${orderId}_${itemId}`
  try {
    await updateOrderStatus(orderId, targetStatus, undefined, [itemId])
    if (!isCurrentlyReady) {
      toast.success(`✓ ${item.name} marked Ready!`)
    }
    fetchKitchenData()
  } catch (err: any) {
    toast.error(err.message || "Failed to update item status")
  } finally {
    actionLoading.value = null
  }
}

// Mark all items in ticket as READY
async function markAllReady(order: any) {
  const id = order.id || order._id
  actionLoading.value = id
  try {
    const isParcel = order.orderType === 'PARCEL' || Number(order.tableNumber) === 0
    const label = isParcel ? `Parcel (${order.customerName || 'Takeaway'})` : `Table ${order.tableNumber}`
    const itemIds = (order.kitchenItems || []).map((it: any) => it.id || it._id)
    await updateOrderStatus(id, 'READY', undefined, itemIds.length > 0 ? itemIds : undefined)
    toast.success(`🔔 ${label} is completely READY! Waiter / Cashier notified.`)
    fetchKitchenData()
  } catch (err: any) {
    toast.error(err.message || "Failed to update status")
  } finally {
    actionLoading.value = null
  }
}

// Serve order directly
async function serveOrderDirectly(order: any) {
  const id = order.id || order._id
  actionLoading.value = id
  try {
    const isParcel = order.orderType === 'PARCEL' || Number(order.tableNumber) === 0
    const label = isParcel ? `Parcel (${order.customerName || 'Takeaway'})` : `Table ${order.tableNumber}`
    await updateOrderStatus(id, 'SERVED')
    toast.success(`✓ ${label} marked as Handed Over / Served!`)
    fetchKitchenData()
  } catch (err: any) {
    toast.error(err.message || "Failed to mark as served")
  } finally {
    actionLoading.value = null
  }
}

// Helper to print kitchen ticket
function printTicket(order: any, kitchenItems: any[]) {
  const isParcel = order.orderType === 'PARCEL' || Number(order.tableNumber) === 0;
  
  // Basic KOT continuation logic using localStorage (resets if you clear history, handles simple sequence)
  const tblKey = isParcel ? `kot_parcel_${order.id}` : `kot_table_${order.tableNumber}`;
  let kotCount = parseInt(localStorage.getItem(tblKey) || '0', 10);
  kotCount++;
  localStorage.setItem(tblKey, kotCount.toString());
  
  const kotText = kotCount === 1 ? 'KOT - 1' : `KOT - ${kotCount} (Continued)`;
  const orderType = isParcel ? 'Takeaway' : 'Dine In';
  const tableText = isParcel ? (order.customerName ? `Customer: ${order.customerName}` : 'PARCEL') : `Table No: ${order.tableNumber}`;
  
  // Format Date exactly like 01/09/26 11:34
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' });
  const timeStr = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

  const phone = order.customerPhone ? `<div class="info-row"><span>Phone:</span> <span>${order.customerPhone}</span></div>` : '';
  const waiter = order.createdBy?.name || 'Waiter';

  // Filter to only print "remaining" (uncompleted) items
  const activeItems = kitchenItems.filter(it => !isItemDone(it));
  if (activeItems.length === 0) {
    toast.info("All items are already cooked! Nothing to print.");
    return;
  }

  const itemsHtml = activeItems.map((it: any) => `
    <div class="item-row">
      <div class="qty">${it.qty || 1}</div>
      <div class="details">
        <div class="name">${it.name}</div>
        ${it.notes || it.specialInstructions ? `<div class="note">Note: ${it.notes || it.specialInstructions}</div>` : ''}
      </div>
    </div>
  `).join('');

  const htmlContent = `
    <html>
      <head>
        <title>KOT Print</title>
        <style>
          body { 
            font-family: Arial, Helvetica, sans-serif;
            margin: 0; 
            padding: 20px; 
            width: 320px; 
            color: #000; 
            background: #fff;
          }
          * { box-sizing: border-box; }
          
          .print-container {
            border: 1px solid #000;
            padding: 15px;
            background: #fff;
          }
          
          .restaurant-title {
            text-align: center;
            font-size: 24px;
            font-weight: 900;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-bottom: 5px;
            border-bottom: 2px solid #000;
            padding-bottom: 10px;
          }
          
          .ticket-type {
            text-align: center;
            font-size: 18px;
            font-weight: 800;
            margin: 10px 0;
            text-transform: uppercase;
          }
          
          .table-title {
            text-align: center;
            font-size: 32px;
            font-weight: 900;
            margin: 10px 0 15px 0;
            border: 3px solid #000;
            padding: 8px 0;
          }
          
          .info-block {
            font-size: 14px;
            font-weight: bold;
            margin-bottom: 15px;
            border-bottom: 2px dashed #000;
            padding-bottom: 10px;
            line-height: 1.5;
          }
          
          .info-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 4px;
          }
          
          .items-header {
            display: flex;
            justify-content: space-between;
            font-size: 14px;
            text-transform: uppercase;
            font-weight: 900;
            margin-bottom: 10px;
            border-bottom: 2px solid #000;
            padding-bottom: 5px;
          }
          .items-header .h-qty { width: 40px; text-align: left; }
          .items-header .h-name { flex: 1; text-align: right; }

          .item-row {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            padding: 10px 0;
            border-bottom: 1px dotted #000;
          }
          .item-row:last-child { border-bottom: 2px dashed #000; margin-bottom: 15px; }
          
          .qty {
            width: 40px;
            font-size: 22px;
            font-weight: 900;
            text-align: left;
            line-height: 1;
          }
          .details {
            flex: 1;
            text-align: right;
          }
          .name {
            font-size: 18px;
            font-weight: 900;
            line-height: 1.2;
          }
          .note {
            font-size: 14px;
            font-weight: bold;
            margin-top: 5px;
            text-transform: uppercase;
          }
          
          .footer {
            font-size: 12px;
            font-weight: bold;
            text-align: center;
            text-transform: uppercase;
          }

          @media print {
            body { width: 100%; padding: 0; }
            .print-container { border: none; padding: 0; }
          }
        </style>
      </head>
      <body>
        <div class="print-container">
          <div class="restaurant-title">Hariom Restaurant</div>
          
          <div class="ticket-type">${orderType} - ${kotText.replace('KOT - ', '#')}</div>
          
          <div class="table-title">${tableText}</div>
          
          <div class="info-block">
            <div class="info-row"><span>Date:</span> <span>${dateStr}</span></div>
            <div class="info-row"><span>Time:</span> <span>${timeStr}</span></div>
            <div class="info-row"><span>Waiter:</span> <span>${waiter}</span></div>
            ${phone}
          </div>
          
          <div class="items-header">
            <div class="h-qty">QTY</div>
            <div class="h-name">ITEM DESCRIPTION</div>
          </div>

          <div class="items-list">
            ${itemsHtml}
          </div>
          
          ${(order.kitchenNote || order.notes) ? `
          <div style="margin-top: 15px; border-top: 2px dashed #000; padding-top: 15px;">
            <div style="font-weight: 900; font-size: 14px; margin-bottom: 5px; text-transform: uppercase;">SPECIAL NOTE:</div>
            <div style="font-size: 16px; font-weight: bold; text-transform: uppercase;">${order.kitchenNote || order.notes}</div>
          </div>
          ` : ''}

          <div class="footer">
            <br>
            --- End of Order ---
          </div>
        </div>
      </body>
    </html>
  `;

  const printWin = window.open('', '', 'width=400,height=600');
  if (printWin) {
    printWin.document.write(htmlContent);
    printWin.document.close();
    printWin.focus();
    setTimeout(() => {
      printWin.print();
      printWin.close();
    }, 500);
  } else {
    toast.warning("Popups are blocked. Please allow popups to print tickets.");
  }
}

// Start cooking (preparing)
async function startPreparing(order: any) {
  const id = order.id || order._id
  actionLoading.value = id
  try {
    const kitchenItems = (order.items || []).filter((it: any) => it.fulfillmentOwner !== 'WAITER')
    const itemIds = kitchenItems.map((it: any) => it.id || it._id)
    const isParcel = order.orderType === 'PARCEL' || Number(order.tableNumber) === 0
    const label = isParcel ? `Parcel (${order.customerName || 'Takeaway'})` : `Table ${order.tableNumber}`
    
    await updateOrderStatus(id, 'PREPARING', undefined, itemIds)
    toast.success(`Started cooking for ${label}`)
    
    // Automatically trigger print dialog
    try {
      printTicket(order, kitchenItems)
    } catch (e) {
      console.error("Print feature failed:", e)
    }

    fetchKitchenData()
  } catch (err: any) {
    toast.error(err.message || "Failed to start preparing")
  } finally {
    actionLoading.value = null
  }
}

// ── Chef Toggle Food Item Availability (Active / Inactive) ────────────────────
async function toggleFoodAvailability(item: any) {
  const itemId = item._id || item.id
  if (!itemId) return
  const newStatus = !(item.isAvailable ?? true)
  
  togglingItemId.value = itemId
  try {
    await updateMenuItem(itemId, { isAvailable: newStatus })
    item.isAvailable = newStatus
    if (newStatus) {
      toast.success(`✅ "${item.name}" is now IN STOCK & Active. Waiters can order!`)
    } else {
      toast.warning(`⚠️ "${item.name}" marked as SOLD OUT (Unavailable). Waiters & Cashier notified!`, { duration: 4000 })
    }
  } catch (err: any) {
    toast.error(err.message || "Failed to update food availability")
  } finally {
    togglingItemId.value = null
  }
}

// ── FIFO Queue of Active Orders ───────────────────────────────────────────────
const queueOrders = computed(() => {
  const list = orders.value
    .map((o) => {
      const allKitchenItems = (o.items || []).filter((it: any) => it.fulfillmentOwner !== 'WAITER')
      // Only show items that still need cooking/preparation (exclude items already delivered to the table)
      const activeKitchenItems = allKitchenItems.filter((it: any) => (it.status || '').toUpperCase() !== 'DELIVERED')
      const readyItemsCount = activeKitchenItems.filter((it: any) => (it.status || '').toUpperCase() === 'READY').length
      
      const oTime = new Date(o.createdAt).getTime()
      
      const tblKey = o.orderType === 'PARCEL' || Number(o.tableNumber) === 0 
        ? `kot_parcel_${o.id || o._id}` 
        : `kot_table_${o.tableNumber}`;
      const kotCount = parseInt(localStorage.getItem(tblKey) || '0', 10);

      // Has another order for the same table within the last 5 hours?
      const hasOlderOrder = o.orderType !== 'PARCEL' && Number(o.tableNumber) !== 0 && orders.value.some((other: any) => 
        other.tableNumber === o.tableNumber && 
        other.orderType !== 'PARCEL' &&
        new Date(other.createdAt).getTime() < oTime &&
        (oTime - new Date(other.createdAt).getTime()) < 18000000 // 5 hours
      );

      const isContinued = hasOlderOrder || kotCount > 0;
      
      return {
        ...o,
        kitchenItems: activeKitchenItems,
        readyItemsCount,
        totalItemsCount: activeKitchenItems.length,
        allReady: activeKitchenItems.length > 0 && readyItemsCount === activeKitchenItems.length,
        hasActiveItems: activeKitchenItems.length > 0,
        isContinued
      }
    })
    .filter((o) => {
      const s = (o.status || "").toLowerCase()
      const p = (o.paymentStatus || "").toLowerCase()

      // Exclude already completed, served, cancelled, or paid orders from active cooking queue
      if (['completed', 'served', 'cancelled'].includes(s) || p === 'completed') {
        return false
      }
      // If all kitchen items for this table are already delivered to the customer, exclude from active cooking queue
      if (!o.hasActiveItems) {
        return false
      }
      return ["pending", "preparing", "ready"].includes(s)
    })
    // FIFO Queue Order with Priority: Continued table orders get higher priority
    .sort((a, b) => {
      const aPriority = a.isContinued ? 1 : 0;
      const bPriority = b.isContinued ? 1 : 0;
      
      if (aPriority !== bPriority) {
        return bPriority - aPriority; // Higher priority (1) first
      }
      
      // Fallback to FIFO
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    })

  return list.map((order, idx) => ({
    ...order,
    queueIndex: idx + 1,
  }))
})

const pendingCount = computed(() => queueOrders.value.filter((o) => (o.status || '').toLowerCase() === "pending" && !o.allReady).length)
const prepCount    = computed(() => queueOrders.value.filter((o) => (o.status || '').toLowerCase() === "preparing" && !o.allReady).length)
const readyCount   = computed(() => queueOrders.value.filter((o) => o.allReady || (o.status || '').toLowerCase() === "ready").length)

const filteredQueueOrders = computed(() => {
  let list = queueOrders.value
  if (activeSearch.value.trim()) {
    const q = activeSearch.value.toLowerCase().trim()
    list = list.filter(o => {
      const tbl = String(o.tableNumber || '')
      const cName = String(o.customerName || '').toLowerCase()
      const itemMatch = (o.kitchenItems || []).some((it: any) => (it.name || '').toLowerCase().includes(q) || (it.specialInstructions || '').toLowerCase().includes(q))
      return tbl.includes(q) || cName.includes(q) || itemMatch
    })
  }
  return list
})

const completedOrders = computed(() => {
  return orders.value
    .map((o) => ({
      ...o,
      kitchenItems: (o.items || []).filter((it: any) => it.fulfillmentOwner !== 'WAITER'),
    }))
    .filter((o) => {
      const s = (o.status || "").toLowerCase()
      const p = (o.paymentStatus || "").toLowerCase()
      const allItemsDelivered = o.kitchenItems.length > 0 && o.kitchenItems.every((it: any) => (it.status || '').toUpperCase() === 'DELIVERED')
      return o.kitchenItems.length > 0 && (["served", "completed"].includes(s) || p === 'completed' || allItemsDelivered)
    })
    .sort((a, b) => new Date(b.completedAt || b.servedAt || b.createdAt).getTime() - new Date(a.completedAt || a.servedAt || a.createdAt).getTime())
})

const filteredCompletedOrders = computed(() => {
  let list = completedOrders.value
  if (completedSearch.value.trim()) {
    const q = completedSearch.value.toLowerCase().trim()
    list = list.filter(o => {
      const tbl = String(o.tableNumber || '')
      const cName = String(o.customerName || '').toLowerCase()
      const waiter = String(o.createdBy?.name || '').toLowerCase()
      const itemMatch = (o.kitchenItems || []).some((it: any) => (it.name || '').toLowerCase().includes(q))
      return tbl.includes(q) || `table ${tbl}`.includes(q) || cName.includes(q) || waiter.includes(q) || itemMatch
    })
  }
  return list
})

// Filtered Menu Items for Availability tab
const filteredMenuItems = computed(() => {
  let list = menuItems.value
  if (selectedCategory.value !== 'All') {
    list = list.filter((m) => {
      const catName = typeof m.categoryId === 'object' ? m.categoryId?.name : m.category
      return catName === selectedCategory.value || m.category === selectedCategory.value
    })
  }
  if (menuSearch.value.trim()) {
    const q = menuSearch.value.toLowerCase()
    list = list.filter((m) => m.name.toLowerCase().includes(q))
  }
  return list
})

const soldOutCount = computed(() => {
  return menuItems.value.filter((m) => m.isAvailable === false).length
})

function formatTime(ts: string) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute:'2-digit' })
}
</script>

<template>
  <RoleLayout role="chef" :nav="chefNav">
    <!-- ── Top Header with Queue Stats & Tab Switcher ── -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
      <div>
        <div class="flex items-center gap-2">
          <h1 class="font-display text-2xl font-bold tracking-tight">Kitchen Operations</h1>
          <Badge v-if="queueOrders.length > 0" class="bg-primary text-primary-foreground font-black text-xs px-2 py-0.5">
            {{ queueOrders.length }} In Queue
          </Badge>
          <Badge v-if="soldOutCount > 0" class="bg-destructive/15 text-destructive border border-destructive/30 text-xs font-bold">
            {{ soldOutCount }} Sold Out
          </Badge>
        </div>
        <p class="text-xs text-muted-foreground mt-0.5">
          <span v-if="view === 'active'">
            FIFO Queue Order · <strong class="text-warning">{{ pendingCount }} pending</strong> · <strong class="text-primary">{{ prepCount }} cooking</strong> · <strong class="text-success">{{ readyCount }} ready</strong>
          </span>
          <span v-else-if="view === 'availability'">
            Manage food stock · Toggle items unavailable when ingredients run out to prevent waiter orders.
          </span>
          <span v-else>{{ completedOrders.length }} recently completed tickets</span>
        </p>
      </div>

      <!-- Tab Switcher -->
      <div class="flex gap-1.5 p-1 rounded-xl bg-muted/40 shrink-0 self-start sm:self-auto flex-wrap">
        <button
          @click="view = 'active'"
          :class="['px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5', view === 'active' ? 'bg-card shadow-soft text-foreground' : 'text-muted-foreground hover:text-foreground']"
        >
          <Flame class="h-3.5 w-3.5 text-primary" />
          Active Queue ({{ queueOrders.length }})
        </button>
        <button
          @click="view = 'availability'"
          :class="['px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5', view === 'availability' ? 'bg-card shadow-soft text-foreground' : 'text-muted-foreground hover:text-foreground']"
        >
          <UtensilsCrossed class="h-3.5 w-3.5 text-amber-500" />
          Food Availability
          <span v-if="soldOutCount > 0" class="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-destructive text-destructive-foreground font-extrabold">
            {{ soldOutCount }}
          </span>
        </button>
        <button
          @click="view = 'completed'"
          :class="['px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5', view === 'completed' ? 'bg-card shadow-soft text-foreground' : 'text-muted-foreground hover:text-foreground']"
        >
          <CheckCircle2 class="h-3.5 w-3.5 text-success" />
          Completed ({{ completedOrders.length }})
        </button>
      </div>
    </div>

    <!-- ═══════════════════════════════════════════════════════════════════════ -->
    <!-- TAB 2: FOOD AVAILABILITY & STOCK TOGGLE (86'd DISHES)                   -->
    <!-- ═══════════════════════════════════════════════════════════════════════ -->
    <template v-if="view === 'availability'">
      <div class="space-y-4">
        <!-- Search & Category Filters -->
        <div class="rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-soft space-y-3">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 class="font-display font-bold text-lg flex items-center gap-2">
                <UtensilsCrossed class="h-5 w-5 text-primary" /> Menu Stock &amp; Dish Availability
              </h3>
              <p class="text-xs text-muted-foreground mt-0.5">
                Mark items as <strong>Sold Out</strong> if ingredients are finished. Waiters and cashier won't be able to take orders for unavailable food.
              </p>
            </div>

            <!-- Search Bar -->
            <div class="relative w-full sm:w-72">
              <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                v-model="menuSearch"
                placeholder="Search food item name..."
                class="pl-9 h-9 text-xs bg-muted/30"
              />
            </div>
          </div>

          <!-- Category Pills -->
          <div class="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none pt-1 border-t border-border/50">
            <button
              @click="selectedCategory = 'All'"
              :class="['px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition', selectedCategory === 'All' ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80 text-muted-foreground']"
            >
              All ({{ menuItems.length }})
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

        <!-- Ultra-Clean Food Items Grid (Dish Name & Availability Only) -->
        <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          <div v-if="filteredMenuItems.length === 0" class="col-span-full rounded-2xl border-2 border-dashed border-border p-12 text-center text-muted-foreground">
            <ShoppingBag class="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p class="text-sm font-medium">No food items found matching your search.</p>
          </div>

          <div
            v-for="item in filteredMenuItems"
            :key="item._id || item.id"
            :class="[
              'rounded-2xl border-2 p-3.5 transition-all flex flex-col justify-between gap-3 bg-card',
              item.isAvailable !== false
                ? 'border-emerald-500/30 bg-emerald-500/5'
                : 'border-destructive/40 bg-destructive/5'
            ]"
          >
            <!-- Dish Name -->
            <div class="font-bold text-sm text-foreground truncate" :title="item.name">
              {{ item.name }}
            </div>

            <!-- Single Availability Button -->
            <Button
              type="button"
              size="sm"
              :disabled="togglingItemId === (item._id || item.id)"
              @click="toggleFoodAvailability(item)"
              :class="[
                'w-full h-8 text-xs font-bold transition shadow-xs flex items-center justify-center gap-1.5',
                item.isAvailable !== false
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  : 'bg-destructive/15 text-destructive border border-destructive/30 hover:bg-destructive/25'
              ]"
            >
              <template v-if="togglingItemId === (item._id || item.id)">
                Updating...
              </template>
              <template v-else-if="item.isAvailable !== false">
                <CheckCircle class="h-3.5 w-3.5" /> Available
              </template>
              <template v-else>
                <XCircle class="h-3.5 w-3.5" /> Not Available
              </template>
            </Button>
          </div>
        </div>
      </div>
    </template>

    <!-- ── Completed Orders Tab ── -->
    <template v-else-if="view === 'completed'">
      <div class="space-y-4">
        <!-- Search bar for completed orders -->
        <div class="flex items-center justify-between gap-3 bg-card p-3.5 rounded-2xl border border-border shadow-soft">
          <div class="relative flex-1 max-w-sm">
            <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              v-model="completedSearch"
              placeholder="Search completed tickets by table, guest, dish…"
              class="pl-9 pr-8 h-9 text-xs bg-muted/30"
            />
            <button
              v-if="completedSearch"
              @click="completedSearch = ''"
              class="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X class="h-3.5 w-3.5" />
            </button>
          </div>
          <span class="text-xs text-muted-foreground font-semibold">
            {{ filteredCompletedOrders.length }} Served Ticket{{ filteredCompletedOrders.length !== 1 ? 's' : '' }}
          </span>
        </div>

        <div class="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-3.5 items-start">
          <div v-if="completedOrders.length === 0" class="col-span-full rounded-2xl border-2 border-dashed border-border p-12 text-center text-muted-foreground">
            No completed orders to show.
          </div>
          <div v-else-if="filteredCompletedOrders.length === 0" class="col-span-full rounded-2xl border-2 border-dashed border-border p-12 text-center text-muted-foreground">
            <Search class="h-8 w-8 mx-auto mb-2 opacity-30 text-muted-foreground" />
            <p class="font-semibold text-sm">No completed tickets match "{{ completedSearch }}"</p>
            <Button size="sm" variant="ghost" class="mt-2 text-xs" @click="completedSearch = ''">Clear Search</Button>
          </div>
          <div
            v-else
            v-for="o in filteredCompletedOrders"
            :key="o.id || o._id"
            class="rounded-2xl bg-card border border-border/80 shadow-soft overflow-hidden transition hover:border-border flex flex-col justify-between"
          >
            <div class="p-3.5 border-b border-border flex items-center justify-between bg-muted/20">
              <div>
                <div class="flex items-center gap-1.5">
                  <span class="font-display text-lg font-bold text-foreground">
                    {{ (o.orderType === 'PARCEL' || Number(o.tableNumber) === 0) ? `Parcel` : `Table ${o.tableNumber}` }}
                  </span>
                  <span v-if="o.customerName" class="text-xs font-semibold text-muted-foreground truncate max-w-[100px]">
                    · {{ o.customerName }}
                  </span>
                </div>
                <div class="text-[10px] text-muted-foreground mt-0.5">
                  By {{ o.createdBy?.name || 'Waiter' }}
                </div>
              </div>
              <span class="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-success/15 text-success border border-success/30">
                SERVED
              </span>
            </div>
            <div class="p-3.5 space-y-1.5 max-h-48 overflow-y-auto flex-1">
              <div v-for="(it, i) in o.kitchenItems" :key="i" class="flex items-start justify-between gap-2 text-xs">
                <span class="font-medium text-foreground truncate">
                  <span class="font-bold text-primary mr-1">{{ it.qty }}×</span>
                  {{ it.name }}
                </span>
                <span class="text-muted-foreground text-[10px] shrink-0">₹{{ (it.price * it.qty).toFixed(0) }}</span>
              </div>
            </div>
            <div class="px-3.5 py-2.5 bg-muted/30 flex items-center justify-between text-[10px] text-muted-foreground border-t border-border">
              <span class="flex items-center gap-1"><Clock class="h-3 w-3" />{{ formatTime(o.servedAt || o.completedAt || o.createdAt) }}</span>
              <span class="font-semibold">{{ o.kitchenItems.length }} item{{ o.kitchenItems.length !== 1 ? 's' : '' }}</span>
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- ── Loading State ── -->
    <template v-else-if="loading && orders.length === 0">
      <div class="flex items-center justify-center p-12 text-muted-foreground text-sm">Syncing kitchen display queue...</div>
    </template>

    <!-- ── Empty Queue State ── -->
    <template v-else-if="queueOrders.length === 0">
      <div class="rounded-2xl border-2 border-dashed border-border p-16 text-center text-muted-foreground animate-in fade-in zoom-in duration-500 max-w-lg mx-auto mt-6">
        <div class="h-12 w-12 rounded-full bg-primary/10 text-primary grid place-items-center mx-auto mb-3">
          <Flame class="h-6 w-6" />
        </div>
        <p class="text-lg font-display font-bold text-foreground">Kitchen Queue Empty</p>
        <p class="text-xs text-muted-foreground mt-1">All orders are cooked and ready. New orders from waiters will arrive here automatically in queue order.</p>
      </div>
    </template>

    <!-- ── Space-Efficient Kitchen Queue Grid ── -->
    <template v-else>
      <!-- Search bar for Active Queue -->
      <div class="mb-4 flex items-center justify-between gap-3 bg-card p-3.5 rounded-2xl border border-border shadow-soft">
        <div class="relative flex-1 max-w-sm">
          <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            v-model="activeSearch"
            placeholder="Search queue by table, guest, or dish name…"
            class="pl-9 pr-8 h-9 text-xs bg-muted/30"
          />
          <button
            v-if="activeSearch"
            @click="activeSearch = ''"
            class="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X class="h-3.5 w-3.5" />
          </button>
        </div>
        <span class="text-xs text-muted-foreground font-semibold">
          {{ filteredQueueOrders.length }} Order{{ filteredQueueOrders.length !== 1 ? 's' : '' }} in Queue
        </span>
      </div>

      <div v-if="filteredQueueOrders.length === 0" class="rounded-2xl border-2 border-dashed border-border p-12 text-center text-muted-foreground">
        <Search class="h-8 w-8 mx-auto mb-2 opacity-30 text-muted-foreground" />
        <p class="font-semibold text-sm">No kitchen tickets match "{{ activeSearch }}"</p>
        <Button size="sm" variant="ghost" class="mt-2 text-xs" @click="activeSearch = ''">Clear Search</Button>
      </div>

      <div v-else class="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-3.5 items-start">
        <div
          v-for="o in filteredQueueOrders"
          :key="o.id || o._id"
          :class="[
            'rounded-xl bg-card border-2 shadow-soft overflow-hidden transition-all flex flex-col',
            o.allReady ? 'border-success/60 bg-success/5 ring-1 ring-success/30' :
            (o.status || '').toUpperCase() === 'PREPARING' ? 'border-primary/50' : 'border-border'
          ]"
        >
          <!-- ── Ticket Header ── -->
          <div class="p-3 border-b border-border flex items-center justify-between bg-muted/30">
            <!-- Left: Queue rank + Table -->
            <div class="flex items-center gap-2">
              <span
                :class="[
                  'h-6 min-w-6 px-1.5 rounded-md text-xs font-black flex items-center justify-center shadow-xs',
                  o.queueIndex === 1 ? 'bg-primary text-primary-foreground animate-pulse' : 'bg-muted text-foreground border border-border font-bold'
                ]"
              >
                #{{ o.queueIndex }}
              </span>
              <div class="min-w-0">
                <div class="flex items-center gap-1.5 flex-wrap">
                  <!-- Parcel Badge -->
                  <Badge v-if="o.orderType === 'PARCEL' || Number(o.tableNumber) === 0" class="bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/30 text-[10px] font-bold px-2 py-0.5 whitespace-nowrap">
                    TAKEAWAY
                  </Badge>
                  <span v-else class="font-display font-black text-base text-foreground leading-none flex items-center gap-2">
                    <span class="whitespace-nowrap">T-{{ o.tableNumber }}</span>
                    <!-- Continued Badge -->
                    <Badge v-if="o.isContinued" class="bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30 text-[9px] font-black px-1.5 py-0 whitespace-nowrap">
                      CONTINUED
                    </Badge>
                  </span>
                  <span v-if="o.customerName" class="text-xs font-semibold text-foreground truncate max-w-[90px]">
                    {{ o.customerName }}
                  </span>
                </div>
                <div class="text-[10px] text-muted-foreground mt-0.5">
                  {{ o.createdBy?.name || 'Waiter' }}
                </div>
              </div>
            </div>

            <!-- Right: Timer + Status badge + Print -->
            <div class="text-right flex flex-col items-end gap-1">
              <div class="flex items-center gap-1.5">
                <button
                  @click="printTicket(o, o.kitchenItems)"
                  class="h-7 w-7 rounded-lg bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground transition flex items-center justify-center border border-primary/20 shadow-sm"
                  title="Print KOT"
                >
                  <Printer class="h-4 w-4" />
                </button>
                <span
                  :class="[
                  'inline-flex items-center gap-1 text-[11px] font-bold tabular-nums px-2 py-0.5 rounded-md',
                  isUrgent(o.createdAt) ? 'bg-destructive/15 text-destructive animate-bounce' : 'bg-muted text-foreground'
                ]"
                >
                  <Clock class="h-3 w-3" />
                  {{ elapsed(o.createdAt) }}
                </span>
              </div>
              <Badge
                v-if="o.allReady"
                class="bg-success text-success-foreground text-[9px] uppercase font-black tracking-wide"
              >
                READY
              </Badge>
              <Badge
                v-else-if="(o.status || '').toUpperCase() === 'PREPARING' || o.readyItemsCount > 0"
                class="bg-primary text-primary-foreground text-[9px] uppercase font-bold tracking-wide"
              >
                COOKING ({{ o.readyItemsCount }}/{{ o.totalItemsCount }})
              </Badge>
              <Badge
                v-else
                variant="secondary"
                class="text-[9px] uppercase font-bold tracking-wide"
              >
                {{ o.status }}
              </Badge>
            </div>
          </div>
          
          <!-- ── Ticket Kitchen Note Ribbon ── -->
          <div v-if="o.notes" class="px-3 py-2.5 bg-amber-500/10 border-b border-amber-500/20 text-amber-600 dark:text-amber-400 flex flex-col gap-0.5">
            <span class="text-[9px] uppercase font-black tracking-widest opacity-80 flex items-center gap-1"><Flame class="h-3 w-3" /> Kitchen Note</span>
            <span class="text-xs font-bold leading-snug">{{ o.notes }}</span>
          </div>

          <!-- ── Ticket Dishes Checklist ── -->
          <div class="p-3 space-y-1.5 flex-1 divide-y divide-border/40">
            <div
              v-for="item in o.kitchenItems"
              :key="item.id || item._id"
              class="pt-1.5 first:pt-0 flex items-center justify-between gap-2 text-xs"
            >
              <div class="flex items-start gap-1.5 min-w-0 flex-1">
                <span class="font-black text-primary tabular-nums shrink-0 text-sm leading-tight">
                  {{ item.qty }}×
                </span>
                <div class="min-w-0">
                  <div
                    :class="[
                      'font-medium text-foreground leading-tight',
                      isItemDone(item) ? 'line-through opacity-60 text-muted-foreground' : ''
                    ]"
                  >
                    {{ item.name }}
                  </div>
                  <div v-if="item.notes || item.specialInstructions" class="text-[10px] text-amber-500 font-bold mt-0.5 truncate">
                    ⚠️ {{ item.notes || item.specialInstructions }}
                  </div>
                </div>
              </div>

              <!-- Quick tick ready toggle -->
              <button
                @click="toggleItemReady(o, item)"
                :disabled="actionLoading === `${o.id || o._id}_${item.id || item._id}`"
                :class="[
                  'h-6 w-6 rounded-md flex items-center justify-center shrink-0 transition-all text-xs font-bold border',
                  isItemDone(item)
                    ? 'bg-success text-success-foreground border-success'
                    : 'bg-muted/60 text-muted-foreground hover:text-foreground hover:bg-muted border-border'
                ]"
                :title="isItemDone(item) ? 'Mark as cooking' : 'Mark this item ready'"
              >
                <Check class="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          <!-- ── Ticket Action Footer ── -->
          <div class="p-2.5 bg-muted/20 border-t border-border flex items-center gap-1.5">
            <!-- If PENDING: Start Cooking button -->
            <Button
              v-if="(o.status || '').toUpperCase() === 'PENDING' && o.readyItemsCount === 0"
              size="sm"
              class="w-full h-8 text-xs font-bold gradient-primary text-primary-foreground shadow-sm"
              :disabled="actionLoading === (o.id || o._id)"
              @click="startPreparing(o)"
            >
              <Flame class="h-3.5 w-3.5 mr-1" />
              {{ o.orderType === 'PARCEL' ? 'Cook for Parcel' : 'Start Cooking' }}
            </Button>

            <!-- If PREPARING or Partially/Fully Ready -->
            <!-- If PREPARING or Partially Ready -->
            <template v-else>
              <Button
                v-if="!o.allReady"
                size="sm"
                variant="outline"
                class="w-full h-8 text-xs font-bold text-success border-success/40 hover:bg-success/10"
                :disabled="actionLoading === (o.id || o._id)"
                @click="markAllReady(o)"
              >
                <CheckCheck class="h-3.5 w-3.5 mr-1" /> Mark All Ready (Notify Waiter)
              </Button>
              <!-- When ALL items are marked READY: Chef cannot tick serve; Waiter is notified to pick up -->
              <div
                v-else
                class="w-full py-1.5 px-2.5 rounded-lg bg-success/15 border border-success/40 text-success text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs"
              >
                <Bell class="h-3.5 w-3.5 animate-bounce text-success shrink-0" />
                <span class="truncate">Ready for Pickup · Waiter Notified 🔔</span>
              </div>
            </template>
          </div>
        </div>
      </div>
    </template>
  </RoleLayout>
  
</template>
