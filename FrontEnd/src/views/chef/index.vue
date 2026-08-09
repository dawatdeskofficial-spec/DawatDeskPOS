<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { Clock, Flame, CheckCircle2 } from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import RoleLayout from '@/components/RoleLayout.vue'
import PageHeader from '@/components/PageHeader.vue'
import { chefNav } from '@/lib/nav'
import { getOrders, updateOrderStatus } from '@/lib/api'
import { useAuthStore } from '@/stores/auth'
import Button from '@/components/ui/Button.vue'

const auth = useAuthStore()
const orders = ref<any[]>([])
const loading = ref(true)
const actionLoading = ref<string | null>(null)
const view = ref<"active" | "completed">("active")
const tick = ref(0)
let interval: any

function elapsed(ts: string) {
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff / 60000);
  return `${m}m`;
}

async function fetchOrders() {
  if (!auth.user?.restaurantId) return;
  const restaurantId = typeof auth.user.restaurantId === 'string' 
    ? auth.user.restaurantId 
    : (auth.user.restaurantId as any).id || (auth.user.restaurantId as any)._id;

  try {
    const res = await getOrders(restaurantId, 1, 100);
    orders.value = res.data || [];
  } catch (err) {
    console.error("Failed to load orders", err);
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  fetchOrders();
  interval = setInterval(() => {
    tick.value++;
    fetchOrders();
  }, 5000);
})

onUnmounted(() => {
  clearInterval(interval);
})

async function handleStatusUpdate(order: any, newStatus: string) {
  const id = order.id || order._id;
  actionLoading.value = id;
  try {
    const kitchenItems = order.items.filter((it: any) => it.fulfillmentOwner !== 'WAITER');
    const itemIds = kitchenItems.map((it: any) => it.id || it._id);
    
    await updateOrderStatus(id, newStatus, undefined, itemIds);
    toast.success(`Order ${order.tableNumber} updated to ${newStatus}`);
    await fetchOrders();
  } catch (err: any) {
    toast.error(err.message || "Failed to update status");
  } finally {
    actionLoading.value = null;
  }
}

const visibleOrders = computed(() => {
  return orders.value
    .map((o) => ({
      ...o,
      kitchenItems: (o.items || []).filter((it: any) => it.fulfillmentOwner !== 'WAITER'),
    }))
    .filter((o) => {
      const s = (o.status || "").toLowerCase();
      return o.kitchenItems.length > 0 && ["pending", "preparing", "ready"].includes(s);
    });
})

const pendingCount = computed(() => visibleOrders.value.filter((o) => o.status.toLowerCase() === "pending").length)
const prepCount = computed(() => visibleOrders.value.filter((o) => o.status.toLowerCase() === "preparing").length)

const completedOrders = computed(() => {
  return orders.value
    .map((o) => ({
      ...o,
      kitchenItems: (o.items || []).filter((it: any) => it.fulfillmentOwner !== 'WAITER'),
    }))
    .filter((o) => {
      const s = (o.status || "").toLowerCase();
      return o.kitchenItems.length > 0 && ["served", "completed"].includes(s);
    });
})

function formatTime(ts: string) {
  return new Date(ts).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
}
</script>

<template>
  <RoleLayout role="chef" :nav="chefNav">
    <PageHeader
      title="Kitchen Display"
      :subtitle="view === 'active' ? `${pendingCount} pending · ${prepCount} preparing` : `${completedOrders.length} recently completed orders`"
    >
      <template #action>
        <div class="flex gap-2 p-1 rounded-xl bg-muted/40 overflow-x-auto max-w-full">
          <button
            @click="view = 'active'"
            :class="['px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition', view === 'active' ? 'bg-background shadow-soft text-foreground' : 'text-muted-foreground hover:text-foreground']"
          >
            Active Orders
          </button>
          <button
            @click="view = 'completed'"
            :class="['px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition', view === 'completed' ? 'bg-background shadow-soft text-foreground' : 'text-muted-foreground hover:text-foreground']"
          >
            Completed ({{ completedOrders.length }})
          </button>
        </div>
      </template>
    </PageHeader>

    <template v-if="view === 'completed'">
      <div class="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 items-start mt-6">
        <div v-if="completedOrders.length === 0" class="col-span-full rounded-2xl border-2 border-dashed border-border p-16 text-center text-muted-foreground">
          No completed orders to show.
        </div>
        <div v-for="o in completedOrders" :key="o.id || o._id" class="rounded-2xl bg-card border border-border shadow-soft overflow-hidden opacity-80">
          <div class="p-4 border-b border-border flex items-center justify-between bg-muted/20">
            <div>
              <div class="font-display text-2xl font-bold">Table {{ o.tableNumber }}</div>
              <div class="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">{{ (o.id || o._id).slice(-6) }}</div>
            </div>
            <div class="px-2.5 py-1 rounded-lg border text-xs font-bold uppercase bg-success/10 text-success border-success/20">
              COMPLETED
            </div>
          </div>
          <div class="p-4 space-y-3">
            <div v-for="(it, i) in o.kitchenItems" :key="i" class="flex items-start gap-3 text-base opacity-70">
              <span class="font-display text-xl font-bold tabular-nums shrink-0">{{ it.qty }}×</span>
              <span class="font-medium text-foreground line-through decoration-muted-foreground/50">{{ it.name }}</span>
            </div>
          </div>
          <div class="px-4 py-3 bg-muted/30 flex items-center justify-between text-sm border-t border-border">
            <span class="flex items-center gap-1.5 font-mono text-muted-foreground">
              <Clock class="h-3.5 w-3.5" />
              {{ formatTime(o.createdAt) }}
            </span>
          </div>
        </div>
      </div>
    </template>
    
    <template v-else-if="loading && orders.length === 0">
      <div class="flex items-center justify-center p-12 text-muted-foreground">Syncing kitchen...</div>
    </template>
    
    <template v-else-if="visibleOrders.length === 0">
      <div class="rounded-2xl border-2 border-dashed border-border p-16 text-center text-muted-foreground animate-in fade-in zoom-in duration-500">
        <Flame class="h-10 w-10 mx-auto mb-3 opacity-40 text-primary" />
        <p class="text-lg font-display">All caught up.</p>
      </div>
    </template>
    
    <template v-else>
      <div class="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 items-start">
        <div
          v-for="o in visibleOrders"
          :key="o.id || o._id"
          :class="['rounded-2xl bg-card border-2 shadow-soft overflow-hidden transition-all', (o.status || '').toUpperCase() === 'READY' ? 'border-success/40 bg-success/5' : (o.status || '').toUpperCase() === 'PREPARING' ? 'border-primary/40' : 'border-border']"
        >
          <div class="p-4 border-b border-border flex items-center justify-between bg-muted/20">
            <div>
              <div class="font-display text-2xl font-bold">Table {{ o.tableNumber }}</div>
              <div class="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">{{ (o.id || o._id).slice(-6) }}</div>
            </div>
            <div :class="['px-2.5 py-1 rounded-lg border text-xs font-bold uppercase', (o.status || '').toUpperCase() === 'READY' ? 'bg-success/15 text-success border-success/30' : (o.status || '').toUpperCase() === 'PREPARING' ? 'bg-primary/15 text-primary border-primary/30' : 'bg-warning/15 text-warning border-warning/30']">
              {{ (o.status || '').toUpperCase() }}
            </div>
          </div>

          <div class="p-4 space-y-3">
            <div v-for="(it, i) in o.kitchenItems" :key="i" class="flex items-start gap-3 text-base">
              <span class="font-display text-xl font-bold text-primary tabular-nums shrink-0">{{ it.qty }}×</span>
              <div>
                <span class="font-medium text-foreground">{{ it.name }}</span>
                <p v-if="it.note" class="text-xs text-destructive font-medium mt-0.5">Note: {{ it.note }}</p>
              </div>
            </div>
          </div>

          <div class="px-4 py-3 bg-muted/30 flex items-center justify-between text-sm border-t border-border">
            <span class="flex items-center gap-1.5 font-mono text-muted-foreground">
              <Clock class="h-3.5 w-3.5" />
              <span :key="tick">{{ elapsed(o.createdAt) }}</span>
            </span>
          </div>

          <div v-if="(o.status || '').toUpperCase() !== 'READY'" class="p-3 grid grid-cols-2 gap-2 bg-muted/10 border-t border-border">
            <Button
              :variant="(o.status || '').toUpperCase() === 'PREPARING' ? 'outline' : 'default'"
              @click="handleStatusUpdate(o, 'PREPARING')"
              :disabled="(o.status || '').toUpperCase() === 'PREPARING' || actionLoading === (o.id || o._id)"
              :class="(o.status || '').toUpperCase() === 'PREPARING' ? 'opacity-50' : ''"
            >
              {{ actionLoading === (o.id || o._id) && (o.status || '').toUpperCase() !== 'PREPARING' ? '...' : 'Preparing' }}
            </Button>
            <Button
              :variant="(o.status || '').toUpperCase() === 'PREPARING' ? 'default' : 'outline'"
              @click="handleStatusUpdate(o, 'READY')"
              :disabled="(o.status || '').toUpperCase() !== 'PREPARING' || actionLoading === (o.id || o._id)"
              :class="(o.status || '').toUpperCase() === 'PREPARING' ? 'gradient-success text-success-foreground shadow-glow' : ''"
            >
              <CheckCircle2 class="h-4 w-4 mr-1.5" />
              Ready
            </Button>
          </div>
          
          <div v-if="(o.status || '').toUpperCase() === 'READY'" class="p-3 bg-success/10 text-success text-center text-sm font-semibold flex items-center justify-center gap-2">
            <CheckCircle2 class="h-4 w-4" />
            Waiting for Waiter
          </div>
        </div>
      </div>
    </template>
  </RoleLayout>
</template>
