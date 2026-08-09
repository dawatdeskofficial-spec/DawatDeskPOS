<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { Banknote, CreditCard, Download, Receipt, Smartphone, CheckCircle2 } from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import RoleLayout from '@/components/RoleLayout.vue'
import PageHeader from '@/components/PageHeader.vue'
import { cashierNav } from '@/lib/nav'
import { getOrders, getPayments, createPayment, completeOrder, getRestaurantById } from '@/lib/api'
import { useAuthStore } from '@/stores/auth'
import Button from '@/components/ui/Button.vue'
import Badge from '@/components/ui/Badge.vue'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

const auth = useAuthStore()
const selectedId = ref<string | null>(null)
const method = ref<"CASH" | "DIGITAL_WALLET" | "CARD">("CARD")

const orders = ref<any[]>([])
const transactions = ref<any[]>([])
const restaurant = ref<any>(null)
const loading = ref(true)
const actionLoading = ref(false)
let interval: any

async function fetchDashboard() {
  if (!auth.user?.restaurantId) return;
  const restaurantId = typeof auth.user.restaurantId === 'string' 
    ? auth.user.restaurantId 
    : (auth.user.restaurantId as any).id || (auth.user.restaurantId as any)._id;

  try {
    const [ordRes, payRes, restRes] = await Promise.all([
      getOrders(restaurantId, 1, 100),
      getPayments(restaurantId, 1, 50),
      getRestaurantById(restaurantId)
    ]);
    orders.value = ordRes.data || [];
    transactions.value = payRes.data || [];
    restaurant.value = restRes.data;
  } catch (err) {
    console.error(err);
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  fetchDashboard();
  interval = setInterval(fetchDashboard, 5000);
})

onUnmounted(() => {
  clearInterval(interval);
})

const readyToBill = computed(() => orders.value.filter(o => o.status === "SERVED"))
const selectedOrder = computed(() => readyToBill.value.find(o => (o.id || o._id) === selectedId.value))

watch(readyToBill, (newReadyToBill) => {
  if (!selectedId.value && newReadyToBill.length > 0) {
    selectedId.value = newReadyToBill[0].id || newReadyToBill[0]._id;
  }
}, { immediate: true })

const subtotal = computed(() => {
  if (!selectedOrder.value) return 0;
  return selectedOrder.value.items.reduce((s: number, i: any) => s + i.price * i.qty, 0);
})

const tax = computed(() => {
  if (!selectedOrder.value) return 0;
  const gstPercent = restaurant.value?.gstPercentage ?? 5;
  return (subtotal.value * gstPercent) / 100;
})

const total = computed(() => subtotal.value + tax.value)

async function handleGenerateInvoice() {
  if (!selectedOrder.value) return;
  actionLoading.value = true;
  const orderId = selectedOrder.value.id || selectedOrder.value._id;
  try {
    await createPayment({
      orderId,
      subtotal: subtotal.value,
      paymentMethod: method.value,
    });
    await completeOrder(orderId);
    toast.success(`Payment of $${total.value.toFixed(2)} successful via ${method.value}`);
    selectedId.value = null;
    await fetchDashboard();
  } catch (err: any) {
    toast.error(err.message || "Payment failed");
  } finally {
    actionLoading.value = false;
  }
}

function downloadPDF(orderOrPayment: any, isPast: boolean = false) {
  if (!orderOrPayment) {
    toast.error("No receipt details found");
    return;
  }

  const doc = new jsPDF();
  const restName = restaurant.value?.name || "Savoria Restaurant";
  
  let orderObj = orderOrPayment;
  let paidDate = orderOrPayment.paidAt || orderOrPayment.createdAt || Date.now();
  let paymentTotal = orderOrPayment.totalAmount;
  
  if (isPast && orderOrPayment.orderId && typeof orderOrPayment.orderId === 'object') {
    orderObj = orderOrPayment.orderId;
  }
  
  const orderId = orderObj.id || orderObj._id || orderOrPayment.orderId || orderOrPayment.id || orderOrPayment._id || "N/A";
  const tableNumber = orderObj.tableNumber;
  const createdAt = orderObj.createdAt || paidDate;
  const items = orderObj.items || [];
  
  doc.setFontSize(22);
  doc.text(restName, 14, 20);
  
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Invoice / Receipt`, 14, 28);
  doc.text(`Order ID: ${orderId}`, 14, 34);
  if (tableNumber) doc.text(`Table: ${tableNumber}`, 14, 40);
  
  let dateStr = "N/A";
  try {
    dateStr = new Date(createdAt).toLocaleString();
  } catch (e) {
    console.error("Invalid date:", createdAt);
  }
  doc.text(`Date: ${dateStr}`, 14, 46);

  let orderSubtotal = 0;
  let orderTax = 0;
  let orderTotal = Number(paymentTotal || orderObj.totalAmount || 0);

  const tableBody = items.map((i: any) => {
    const qty = Number(i.qty || i.quantity || 1);
    const price = Number(i.price ?? 0);
    const lineTotal = price * qty;
    orderSubtotal += lineTotal;
    return [
      i.name || "Unknown Item",
      qty,
      `$${price.toFixed(2)}`,
      `$${lineTotal.toFixed(2)}`
    ];
  });

  if (items.length > 0) {
    const gstPercent = Number(restaurant.value?.gstPercentage ?? 5);
    orderTax = (orderSubtotal * gstPercent) / 100;
    orderTotal = orderSubtotal + orderTax;
  }

  autoTable(doc, {
    startY: 55,
    head: [["Item", "Qty", "Unit Price", "Total"]],
    body: tableBody,
    theme: 'grid',
    headStyles: { fillColor: [15, 23, 42] },
    styles: { fontSize: 10 },
  });

  const finalY = ((doc as any).lastAutoTable?.finalY ?? 55) + 10;
  
  doc.setFontSize(10);
  doc.setTextColor(0);
  if (items.length > 0) {
    doc.text(`Subtotal: $${orderSubtotal.toFixed(2)}`, 140, finalY);
    doc.text(`Tax (${restaurant.value?.gstPercentage ?? 5}%): $${orderTax.toFixed(2)}`, 140, finalY + 6);
  }
  
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(`Total: $${orderTotal.toFixed(2)}`, 140, finalY + 16);
  
  if (isPast) {
    doc.setTextColor(34, 197, 94);
    doc.text(`PAID`, 14, finalY + 16);
  }

  try {
    doc.save(`Receipt_${String(orderId).slice(-6)}.pdf`);
    toast.success("PDF downloaded successfully");
  } catch (e: any) {
    console.error("Failed to save PDF:", e);
    toast.error("Failed to save PDF: " + (e.message || e));
  }
}

function elapsed(ts: string) {
  const m = Math.floor((Date.now() - new Date(ts).getTime()) / 60000);
  if (m > 60) return `${Math.floor(m / 60)}h ${m % 60}m`;
  return `${m}m`;
}

function formatTime(ts: string) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

const paymentMethods = [
  { k: "CASH" as const, label: "Cash", icon: Banknote },
  { k: "DIGITAL_WALLET" as const, label: "UPI/Wallet", icon: Smartphone },
  { k: "CARD" as const, label: "Card", icon: CreditCard },
]
</script>

<template>
  <RoleLayout role="cashier" :nav="cashierNav">
    <PageHeader title="Billing & Payments" subtitle="Process completed orders and payments." />

    <div class="grid lg:grid-cols-[1fr_440px] gap-6">
      <!-- Left — orders + transactions -->
      <div class="space-y-6">
        <section class="rounded-2xl bg-card border border-border shadow-soft overflow-hidden">
          <div class="p-5 border-b border-border">
            <h3 class="font-display text-xl font-bold">Ready to bill</h3>
            <p class="text-sm text-muted-foreground">Tap to load into the bill panel</p>
          </div>
          <div class="divide-y divide-border">
            <div v-if="readyToBill.length === 0" class="p-8 text-center text-muted-foreground flex flex-col items-center">
              <CheckCircle2 class="h-8 w-8 mb-2 opacity-40 text-success" />
              No tables waiting for bill.
            </div>
            <button
              v-else
              v-for="o in readyToBill"
              :key="o.id || o._id"
              @click="selectedId = o.id || o._id"
              :class="['w-full flex items-center justify-between p-5 text-left transition', selectedId === (o.id || o._id) ? 'bg-primary/10' : 'hover:bg-muted/30']"
            >
              <div>
                <div class="font-mono text-xs text-muted-foreground">{{ o.id || o._id }}</div>
                <div class="font-semibold">Table {{ o.tableNumber }} · {{ o.items?.length }} items</div>
                <div class="text-xs text-muted-foreground">Ordered {{ elapsed(o.createdAt) }} ago</div>
              </div>
              <div class="text-right">
                <div class="font-display text-xl font-bold tabular-nums">
                  ${{ (o.totalAmount || 0).toFixed(2) }}
                </div>
                <Badge v-if="selectedId === (o.id || o._id)" class="bg-primary/20 text-primary mt-1">Selected</Badge>
              </div>
            </button>
          </div>
        </section>

        <section class="rounded-2xl bg-card border border-border shadow-soft overflow-hidden">
          <div class="p-5 border-b border-border">
            <h3 class="font-display text-xl font-bold">Transaction history</h3>
          </div>
          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead class="bg-muted/40 text-muted-foreground text-xs uppercase tracking-wider">
                <tr>
                  <th class="text-left px-5 py-3 font-medium">Txn</th>
                  <th class="text-left px-5 py-3 font-medium">Table</th>
                  <th class="text-right px-5 py-3 font-medium">Amount</th>
                  <th class="text-left px-5 py-3 font-medium">Method</th>
                  <th class="text-left px-5 py-3 font-medium">Time</th>
                  <th class="text-right px-5 py-3 font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="transactions.length === 0">
                  <td colspan="6" class="px-5 py-8 text-center text-muted-foreground">
                    No transactions yet.
                  </td>
                </tr>
                <tr v-for="t in transactions" :key="t.id || t._id" class="border-t border-border hover:bg-muted/30">
                  <td class="px-5 py-3 font-mono text-xs">{{ String(t.id || t._id).slice(-6) }}</td>
                  <td class="px-5 py-3">
                    <div class="font-semibold">Table {{ t.orderId?.tableNumber ?? '—' }}</div>
                    <div class="text-xs text-muted-foreground">{{ t.orderId?.items?.length || 0 }} items</div>
                  </td>
                  <td class="px-5 py-3 text-right tabular-nums font-semibold">${{ (t.totalAmount || 0).toFixed(2) }}</td>
                  <td class="px-5 py-3">
                    <Badge variant="secondary">{{ t.paymentMethod }}</Badge>
                  </td>
                  <td class="px-5 py-3 text-muted-foreground">
                    {{ formatTime(t.paidAt || t.createdAt) }}
                  </td>
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

      <!-- Right — bill panel -->
      <aside class="rounded-2xl bg-card border border-border shadow-soft flex flex-col h-fit lg:sticky lg:top-24 max-h-[calc(100vh-6rem)]">
        <div class="p-5 border-b border-border flex items-center justify-between">
          <div>
            <div class="font-display text-xl font-bold">Invoice</div>
            <div class="text-xs font-mono text-muted-foreground">{{ selectedId || "No order selected" }}</div>
          </div>
          <Receipt class="h-6 w-6 text-primary" />
        </div>

        <div v-if="!selectedOrder" class="p-12 text-center text-muted-foreground flex-1">
          Select an order to view bill
        </div>
        <template v-else>
          <div class="flex-1 overflow-y-auto p-5 space-y-3">
            <div v-for="(i, idx) in selectedOrder.items" :key="idx" class="flex justify-between text-sm">
              <span>
                <span class="text-muted-foreground tabular-nums font-semibold">{{ i.qty }}× </span>
                {{ i.name }}
              </span>
              <span class="tabular-nums font-medium">${{ (i.price * i.qty).toFixed(2) }}</span>
            </div>
          </div>

          <div class="px-5 py-4 border-t border-border space-y-1.5 text-sm">
            <div class="flex justify-between text-muted-foreground">
              <span>Subtotal</span>
              <span class="tabular-nums">${{ subtotal.toFixed(2) }}</span>
            </div>
            <div class="flex justify-between text-muted-foreground">
              <span>Tax ({{ restaurant?.gstPercentage ?? 5 }}%)</span>
              <span class="tabular-nums">${{ tax.toFixed(2) }}</span>
            </div>
            <div class="flex justify-between font-display text-2xl font-bold pt-2 border-t border-border mt-2">
              <span>Total</span>
              <span class="tabular-nums">${{ total.toFixed(2) }}</span>
            </div>
          </div>

          <div class="p-5 border-t border-border">
            <div class="text-xs uppercase tracking-wider text-muted-foreground mb-2.5">Payment method</div>
            <div class="grid grid-cols-3 gap-2 mb-4">
              <button
                v-for="m in paymentMethods"
                :key="m.k"
                @click="method = m.k"
                :class="['flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition', method === m.k ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/40']"
              >
                <component :is="m.icon" class="h-5 w-5" />
                <span class="text-[11px] font-semibold">{{ m.label }}</span>
              </button>
            </div>
            <div class="space-y-2">
              <Button 
                @click="handleGenerateInvoice" 
                :disabled="actionLoading"
                class="w-full h-11 gradient-primary text-primary-foreground font-semibold shadow-glow"
              >
                {{ actionLoading ? "Processing..." : "Complete Payment" }}
              </Button>
              <Button 
                @click="downloadPDF(selectedOrder, false)" 
                variant="outline" 
                class="w-full h-11"
              >
                <Download class="h-4 w-4 mr-2" />
                Download PDF Receipt
              </Button>
            </div>
          </div>
        </template>
      </aside>
    </div>
  </RoleLayout>
</template>
