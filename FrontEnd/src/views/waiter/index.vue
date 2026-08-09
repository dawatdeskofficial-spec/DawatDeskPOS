<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { Minus, Plus, Send, Trash2, CheckCircle2, Clock, BellRing, ShoppingBag, ArrowLeft } from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import RoleLayout from '@/components/RoleLayout.vue'
import PageHeader from '@/components/PageHeader.vue'
import { waiterNav } from '@/lib/nav'
import { getMenuItems, createOrder, getOrders, getRestaurantById, updateOrderStatus } from '@/lib/api'
import { useAuthStore } from '@/stores/auth'
import Button from '@/components/ui/Button.vue'
import Badge from '@/components/ui/Badge.vue'

const CATEGORY_MAP: Record<string, string> = {
  APPETIZER: "Starters",
  MAIN_COURSE: "Mains",
  DESSERT: "Desserts",
  BEVERAGE: "Beverages",
  SIDES: "Sides",
}

interface CartLine {
  id: string;
  name: string;
  price: number;
  qty: number;
  emoji: string;
}

const auth = useAuthStore()
const view = ref<"take_order" | "ready_orders" | "history">("take_order")
const table = ref<number | null>(null)
const cat = ref("All")
const cart = ref<CartLine[]>([])

const menuCategories = ref<string[]>(["All"])
const menuItems = ref<any[]>([])
const tables = ref<any[]>([])
const maxTables = ref(20)
const loading = ref(true)
const allOrders = ref<any[]>([])
let interval: any

async function loadData() {
  if (!auth.user?.restaurantId) return;
  const restaurantId = typeof auth.user.restaurantId === 'string' 
    ? auth.user.restaurantId 
    : (auth.user.restaurantId as any).id || (auth.user.restaurantId as any)._id;
    
  try {
    const [menuRes, ordersRes, restaurantRes] = await Promise.all([
      getMenuItems(restaurantId),
      getOrders(restaurantId, 1, 100),
      getRestaurantById(restaurantId)
    ]);
    
    const restaurant = restaurantRes.data as any;
    const max = restaurant?.maxTables || 20;
    maxTables.value = max;
    
    const rawOrders = ordersRes.data || [];
    allOrders.value = rawOrders;
    
    const activeTables = new Set(
      rawOrders
        .filter((o: any) => {
           const s = (o.status || "").toLowerCase();
           const p = (o.paymentStatus || "").toLowerCase();
           return !["completed", "billed", "cancelled"].includes(s) && p !== "completed";
        })
        .map((o: any) => o.tableNumber || o.table)
    );

    tables.value = Array.from({ length: max }, (_, i) => ({
      id: `t${i + 1}`,
      number: i + 1,
      status: activeTables.has(i + 1) ? "occupied" : "available",
    }));
    
    const rawMenu = (menuRes.data || []).map((m: any) => ({
      ...m,
      id: m._id || m.id,
      emoji: m.image || "🍴",
      available: m.isAvailable ?? true
    }));
    menuItems.value = rawMenu;
    
    const cats = new Set<string>();
    rawMenu.forEach((m: any) => { if (m.category) cats.add(m.category) });
    menuCategories.value = ["All", ...Array.from(cats)];
    
  } catch (err) {
    console.error(err);
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  loadData();
  interval = setInterval(loadData, 5000);
})

onUnmounted(() => {
  clearInterval(interval);
})

function add(m: any) {
  const found = cart.value.find((l) => l.id === m.id);
  if (found) {
    found.qty++;
  } else {
    cart.value.push({ id: m.id, name: m.name, price: m.price, qty: 1, emoji: m.emoji });
  }
}

function dec(id: string) {
  const idx = cart.value.findIndex(l => l.id === id);
  if (idx !== -1) {
    if (cart.value[idx].qty > 1) {
      cart.value[idx].qty--;
    } else {
      cart.value.splice(idx, 1);
    }
  }
}

function remove(id: string) {
  cart.value = cart.value.filter(l => l.id !== id);
}

const subtotal = computed(() => cart.value.reduce((s, l) => s + l.price * l.qty, 0))
const tax = computed(() => subtotal.value * 0.08)
const total = computed(() => subtotal.value + tax.value)

const place = async () => {
  if (!table.value) return toast.error("Pick a table first");
  if (cart.value.length === 0) return toast.error("Add some items");
  
  const restaurantId = typeof auth.user?.restaurantId === 'string' 
      ? auth.user.restaurantId 
      : (auth.user?.restaurantId as any)?.id || (auth.user?.restaurantId as any)?._id;
      
  try {
    await createOrder({
      restaurantId,
      tableNumber: String(table.value),
      items: cart.value.map(item => ({
        menuItemId: item.id,
        quantity: item.qty
      }))
    });
    toast.success(`Order placed for Table ${table.value} · $${total.value.toFixed(2)}`);
    cart.value = [];
    table.value = null;
    loadData();
  } catch (err: any) {
    toast.error(err.message || "Failed to place order");
  }
}

const handleServe = async (orderId: string, tableNumber: number) => {
  try {
    await updateOrderStatus(orderId, "SERVED");
    toast.success(`Table ${tableNumber} has been served!`);
    loadData();
  } catch (err: any) {
    toast.error(err.message || "Failed to mark as served");
  }
}

const readyOrders = computed(() => allOrders.value.filter(o => o.status === "READY"))
const filteredMenuItems = computed(() => menuItems.value.filter(m => (cat.value === "All" || m.category === cat.value) && m.available))

function formatTime(ts: string) {
  return new Date(ts).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
}
</script>

<template>
  <RoleLayout role="waiter" :nav="waiterNav">
    <div v-if="view === 'take_order' && table" class="flex items-center gap-4 mb-6">
      <Button variant="outline" size="icon" class="h-10 w-10 rounded-xl bg-card border-border hover:bg-muted" @click="table = null" title="Back to tables">
        <ArrowLeft class="h-5 w-5" />
      </Button>
      <div>
        <h1 class="font-display text-3xl font-bold tracking-tight">Table {{ table }} · Order</h1>
        <p class="text-sm text-muted-foreground mt-0.5">Select menu items and submit the ticket to the kitchen.</p>
      </div>
    </div>
    <PageHeader
      v-else
      :title="view === 'take_order' ? 'Take Order' : view === 'ready_orders' ? 'Ready for Pickup' : 'Table History'"
      :subtitle="view === 'take_order' ? 'Select a table to begin.' : view === 'ready_orders' ? 'Food is ready in the kitchen. Pick it up and serve to the table.' : 'Review active and past orders for your tables.'"
    >
      <template #action>
        <div class="flex gap-2 p-1 rounded-xl bg-muted/40 overflow-x-auto max-w-full">
          <button
            @click="view = 'take_order'"
            :class="['px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition', view === 'take_order' ? 'bg-background shadow-soft text-foreground' : 'text-muted-foreground hover:text-foreground']"
          >
            Take Order
          </button>
          <button
            @click="view = 'ready_orders'"
            :class="['px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition flex items-center gap-2', view === 'ready_orders' ? 'bg-background shadow-soft text-foreground' : 'text-muted-foreground hover:text-foreground']"
          >
            Ready
            <span v-if="readyOrders.length > 0" class="flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[10px] text-destructive-foreground">
              {{ readyOrders.length }}
            </span>
          </button>
          <button
            @click="view = 'history'"
            :class="['px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition', view === 'history' ? 'bg-background shadow-soft text-foreground' : 'text-muted-foreground hover:text-foreground']"
          >
            Table History
          </button>
        </div>
      </template>
    </PageHeader>

    <template v-if="view === 'history'">
      <div class="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mt-6">
        <div v-for="o in allOrders" :key="o.id || o._id" class="rounded-2xl bg-card border border-border shadow-soft overflow-hidden">
          <div class="p-4 border-b border-border flex items-center justify-between bg-muted/20">
            <div>
              <div class="font-display text-xl font-bold">Table {{ o.tableNumber }}</div>
              <div class="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">{{ (o.id || o._id).slice(-6) }}</div>
            </div>
            <div :class="['px-2 py-1 rounded-md border text-[10px] font-bold uppercase', o.status === 'COMPLETED' ? 'bg-success/10 text-success border-success/20' : o.status === 'CANCELLED' ? 'bg-destructive/10 text-destructive border-destructive/20' : 'bg-primary/10 text-primary border-primary/20']">
              {{ o.status }}
            </div>
          </div>
          <div class="p-4 space-y-2 max-h-48 overflow-y-auto">
            <div v-for="(it, i) in o.items" :key="i" class="flex justify-between text-sm">
              <span><span class="text-muted-foreground tabular-nums font-semibold">{{ it.qty }}×</span> {{ it.name }}</span>
              <span class="tabular-nums font-medium">${{ (it.price * it.qty).toFixed(2) }}</span>
            </div>
          </div>
          <div class="p-4 bg-muted/10 border-t border-border flex justify-between items-center">
            <span class="text-xs text-muted-foreground flex items-center gap-1"><Clock class="h-3 w-3"/> {{ formatTime(o.createdAt) }}</span>
            <span class="font-bold tabular-nums">${{ (o.totalAmount || 0).toFixed(2) }}</span>
          </div>
        </div>
      </div>
    </template>

    <template v-else-if="view === 'ready_orders'">
      <div v-if="readyOrders.length === 0" class="rounded-2xl border-2 border-dashed border-border p-16 text-center text-muted-foreground animate-in fade-in zoom-in duration-500 mt-6">
        <CheckCircle2 class="h-10 w-10 mx-auto mb-3 opacity-40 text-success" />
        <p class="text-lg font-display">No food waiting in the kitchen.</p>
      </div>
      <div v-else class="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mt-6">
        <div v-for="o in readyOrders" :key="o.id || o._id" class="rounded-2xl bg-card border-2 border-success/40 shadow-soft overflow-hidden">
          <div class="p-4 border-b border-border flex items-center justify-between bg-success/5">
            <div>
              <div class="font-display text-2xl font-bold">Table {{ o.tableNumber }}</div>
              <div class="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">{{ (o.id || o._id).slice(-6) }}</div>
            </div>
            <div class="h-8 w-8 rounded-full bg-success/15 text-success grid place-items-center animate-pulse">
              <BellRing class="h-4 w-4" />
            </div>
          </div>
          <div class="p-4 space-y-3">
            <div v-for="(it, i) in o.items" :key="i" class="flex items-start gap-3 text-base">
              <span class="font-display text-xl font-bold text-primary tabular-nums shrink-0">{{ it.qty }}×</span>
              <span class="font-medium text-foreground">{{ it.name }}</span>
            </div>
          </div>
          <div class="p-4 bg-muted/10 border-t border-border">
            <Button @click="handleServe(o.id || o._id, o.tableNumber)" class="w-full h-11 gradient-success text-success-foreground font-bold shadow-glow text-base">
              <CheckCircle2 class="h-5 w-5 mr-2" />
              Mark as Served
            </Button>
          </div>
        </div>
      </div>
    </template>

    <template v-else-if="!table">
      <div class="mt-6">
        <div class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
          <button
            v-for="t in tables"
            :key="t.id"
            :disabled="t.status === 'reserved'"
            @click="table = t.number"
            :class="['aspect-square rounded-2xl border-2 grid place-items-center transition shadow-soft hover:scale-105 disabled:opacity-40 disabled:cursor-not-allowed', t.status === 'available' ? 'border-success/40 bg-success/10 text-success' : t.status === 'occupied' ? 'border-primary/40 bg-primary/10' : 'border-warning/40 bg-warning/10 text-warning']"
          >
            <div class="font-display text-3xl font-bold">{{ t.number }}</div>
            <div class="text-[10px] uppercase tracking-wider">{{ t.status }}</div>
          </button>
        </div>
      </div>
    </template>

    <template v-else>
      <div class="mb-4">
        <Button variant="ghost" size="sm" class="h-9 px-3" @click="table = null">
          <ArrowLeft class="h-4 w-4 mr-2" /> Back to Tables
        </Button>
      </div>
      <div class="grid lg:grid-cols-[1fr_400px] gap-6 mt-2">
        <div>
          <div class="flex gap-2 overflow-x-auto pb-2 mb-4">
            <button
              v-for="c in menuCategories"
              :key="c"
              @click="cat = c"
              :class="['px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition', cat === c ? 'gradient-primary text-primary-foreground shadow-soft' : 'bg-muted/40 hover:bg-muted']"
            >
              {{ c === 'All' ? 'All' : (CATEGORY_MAP[c] || c) }}
            </button>
          </div>
          <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <button
              v-for="m in filteredMenuItems"
              :key="m.id"
              @click="add(m)"
              class="rounded-2xl bg-card border border-border p-4 text-left shadow-soft hover:shadow-glow hover:border-primary/40 transition-all active:scale-[0.98]"
            >
              <div class="text-4xl mb-3">{{ m.emoji }}</div>
              <div class="text-[10px] text-muted-foreground uppercase tracking-wider">{{ CATEGORY_MAP[m.category] || m.category }}</div>
              <div class="font-semibold text-sm mt-0.5 leading-tight">{{ m.name }}</div>
              <div v-if="m.description" class="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">{{ m.description }}</div>
              <div class="font-display text-lg font-bold mt-1 text-primary">${{ m.price.toFixed(2) }}</div>
            </button>
          </div>
        </div>

        <aside class="rounded-2xl bg-card border border-border shadow-soft flex flex-col h-fit lg:sticky lg:top-24 max-h-[calc(100vh-7rem)]">
          <div class="p-5 border-b border-border flex items-center justify-between">
            <div>
              <div class="font-display text-xl font-bold">Table {{ table }}</div>
              <div class="text-xs text-muted-foreground">{{ cart.length }} item{{ cart.length !== 1 ? "s" : "" }} in cart</div>
            </div>
            <button @click="table = null" class="text-xs text-muted-foreground hover:text-foreground">
              Change
            </button>
          </div>
          <div class="flex-1 overflow-y-auto p-3 space-y-2">
            <template v-if="(() => {
              const activeOrderForTable = allOrders.find((o: any) => o.tableNumber === table && !['COMPLETED', 'CANCELLED'].includes((o.status || '').toUpperCase()));
              return activeOrderForTable && activeOrderForTable.items && activeOrderForTable.items.length > 0;
            })()">
              <div class="mb-6">
                <div class="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-3 px-2">
                  Already Ordered
                </div>
                <div class="space-y-2">
                  <div v-for="(it, idx) in allOrders.find((o: any) => o.tableNumber === table && !['COMPLETED', 'CANCELLED'].includes((o.status || '').toUpperCase())).items" :key="`existing-${idx}`" class="flex items-center justify-between p-2.5 rounded-xl bg-muted/30 opacity-80">
                    <div class="flex items-center gap-3">
                      <span class="font-semibold text-sm tabular-nums bg-background/50 rounded flex items-center justify-center h-6 w-6">
                        {{ it.qty || it.quantity || 1 }}
                      </span>
                      <span class="text-sm font-medium">{{ it.name }}</span>
                    </div>
                    <Badge variant="outline" class="text-[9px] uppercase">
                      {{ it.status }}
                    </Badge>
                  </div>
                </div>
                <div class="border-b border-border my-5 mx-2"></div>
                
                <div class="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-3 px-2">
                  New Items
                </div>
              </div>
            </template>
            
            <template v-if="cart.length === 0">
              <div class="text-center py-8 text-muted-foreground text-sm flex flex-col items-center justify-center gap-3">
                <ShoppingBag class="h-8 w-8 opacity-20" />
                <span>Cart is empty.<br />Tap menu items to add.</span>
              </div>
            </template>
            <template v-else>
              <div v-for="l in cart" :key="l.id" class="flex items-center gap-3 p-3 rounded-xl bg-muted/30">
                <div class="text-2xl">{{ l.emoji }}</div>
                <div class="flex-1 min-w-0">
                  <div class="font-medium text-sm truncate">{{ l.name }}</div>
                  <div class="text-xs text-muted-foreground">${{ l.price.toFixed(2) }} · ${{ (l.price * l.qty).toFixed(2) }}</div>
                </div>
                <div class="flex items-center gap-1">
                  <button @click="dec(l.id)" class="h-7 w-7 grid place-items-center rounded-lg bg-background hover:bg-muted">
                    <Minus class="h-3.5 w-3.5" />
                  </button>
                  <span class="w-6 text-center text-sm font-semibold tabular-nums">{{ l.qty }}</span>
                  <button @click="add(menuItems.find((m) => m.id === l.id)!)" class="h-7 w-7 grid place-items-center rounded-lg bg-background hover:bg-muted">
                    <Plus class="h-3.5 w-3.5" />
                  </button>
                  <button @click="remove(l.id)" class="h-7 w-7 grid place-items-center rounded-lg text-destructive hover:bg-destructive/10 ml-1">
                    <Trash2 class="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </template>
          </div>
          <div class="p-5 border-t border-border space-y-2">
            <div class="flex justify-between text-sm text-muted-foreground"><span>Subtotal</span><span class="tabular-nums">${{ subtotal.toFixed(2) }}</span></div>
            <div class="flex justify-between text-sm text-muted-foreground"><span>Tax (8%)</span><span class="tabular-nums">${{ tax.toFixed(2) }}</span></div>
            <div class="flex justify-between font-display text-2xl font-bold"><span>Total</span><span class="tabular-nums">${{ total.toFixed(2) }}</span></div>
            <Button @click="place" class="w-full h-12 mt-3 gradient-primary text-primary-foreground font-semibold shadow-glow">
              <Send class="h-4 w-4 mr-2" />Place Order
            </Button>
          </div>
        </aside>
      </div>
    </template>
  </RoleLayout>
</template>
