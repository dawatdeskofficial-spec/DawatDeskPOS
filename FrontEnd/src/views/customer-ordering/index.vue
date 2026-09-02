<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore, ROLE_HOMES } from '@/stores/auth'
import { createOrder, authFetch, fetchJson, getPublicCategoriesByRestaurant, type MenuCategory } from '@/lib/api'
import { toast } from 'vue-sonner'
import {
  Utensils,
  Search,
  ShoppingBag,
  Minus,
  Plus,
  Trash2,
  X,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Sparkles,
  ChevronRight,
  LogOut,
  Info,
  Compass,
  AlertCircle,
  MapPin,
  Building2
} from 'lucide-vue-next'
import Button from '@/components/ui/Button.vue'
import Badge from '@/components/ui/Badge.vue'
import Input from '@/components/ui/Input.vue'
import LanguageSwitcher from '@/components/LanguageSwitcher.vue'

interface CartLine {
  id: string;
  name: string;
  price: number;
  qty: number;
  emoji: string;
  category: string;
  notes: string;
}

const auth = useAuthStore()
const router = useRouter()

// UI state
const step = ref<"restaurant" | "splash" | "menu" | "success">("restaurant")
const selectedRestaurant = ref<any>(null)
const orderType = ref<"dine_in" | "takeaway">("dine_in")
const tableNumber = ref<number | null>(null)
const customerName = ref("")
const customerPhone = ref("")

// Restaurants list
const restaurants = ref<any[]>([])
const loadingRestaurants = ref(true)

// Menu state
const menuItems = ref<any[]>([])
const menuCategories = ref<MenuCategory[]>([])
const selectedCategory = ref("All")
const searchQuery = ref("")
const maxTables = ref(20)
const loadingMenu = ref(true)

// Cart state
const cart = ref<CartLine[]>([])
const showCartDrawer = ref(false)
const placingOrder = ref(false)

// Order tracking state
const placedOrder = ref<any>(null)
let pollInterval: any = null

async function loadRestaurants() {
  try {
    loadingRestaurants.value = true
    const response = await fetchJson('/api/restaurants/public?limit=100')
    const data = response.data || response
    const restaurantList = Array.isArray(data) ? data : (data.restaurants || [])
    restaurants.value = restaurantList.filter((r: any) => r.status === 'ACTIVE')
  } catch (err) {
    console.error("Failed to load restaurants:", err)
    toast.error("Failed to load restaurants. Please try again.")
  } finally {
    loadingRestaurants.value = false
  }
}

async function selectRestaurant(restaurant: any) {
  selectedRestaurant.value = restaurant
  step.value = "splash"
  // Load menu data for selected restaurant
  loadMenuData()
}

async function loadMenuData() {
  if (!selectedRestaurant.value?.id && !selectedRestaurant.value?._id) return;
  const restaurantId = selectedRestaurant.value.id || selectedRestaurant.value._id;

  try {
    loadingMenu.value = true
    const [menuRes, restaurantRes, categoryRes] = await Promise.all([
      fetchJson(`/api/menu/public/restaurant/${restaurantId}?page=1&limit=100`),
      fetchJson(`/api/restaurants/public/${restaurantId}`),
      getPublicCategoriesByRestaurant(restaurantId)
    ])

    const restaurant = restaurantRes.data || restaurantRes
    maxTables.value = restaurant?.maxTables || 20
    const categoryList: MenuCategory[] = categoryRes.data || []
    const categoryById = new Map(categoryList.map((category) => [category._id || category.id, category]))

    const rawMenu = (menuRes.data || menuRes).map((m: any) => ({
      ...m,
      id: m._id || m.id,
      categoryId: typeof m.categoryId === 'string' ? m.categoryId : (m.categoryId?._id || m.categoryId?.id || ''),
      categoryName: typeof m.categoryId === 'object' && m.categoryId?.name
        ? m.categoryId.name
        : (categoryById.get(typeof m.categoryId === 'string' ? m.categoryId : (m.categoryId?._id || m.categoryId?.id || ''))?.name || m.category || 'Uncategorized'),
      emoji: m.image || categoryById.get(typeof m.categoryId === 'string' ? m.categoryId : (m.categoryId?._id || m.categoryId?.id || ''))?.icon || "🍴",
      available: m.isAvailable ?? true
    }))
    menuItems.value = rawMenu
    menuCategories.value = categoryList
    selectedCategory.value = "All"
  } catch (err) {
    console.error("Failed to load kiosk menu:", err)
    toast.error("Failed to load menu items. Please try again.")
  } finally {
    loadingMenu.value = false
  }
}

onMounted(() => {
  loadRestaurants()
})

onUnmounted(() => {
  stopPolling()
})

// Splash screen validation and transition
function startOrdering(type: "dine_in" | "takeaway") {
  orderType.value = type
  if (type === 'dine_in' && !tableNumber.value) {
    toast.error("Please select a table number to dine in.")
    return
  }
  step.value = "menu"
}

// Exit kiosk back to standard dashboard
function exitKiosk() {
  const homePath = auth.user ? ROLE_HOMES[auth.user.role] : '/'
  router.push(homePath)
}

// Cart modifications
function addToCart(m: any) {
  if (!m.available) return;
  const found = cart.value.find((l) => l.id === m.id)
  if (found) {
    found.qty++
  } else {
    cart.value.push({
      id: m.id,
      name: m.name,
      price: m.price,
      qty: 1,
      emoji: m.emoji,
      category: m.categoryName,
      notes: ""
    })
  }
  toast.success(`Added ${m.name} to cart.`)
}

function increaseQty(item: CartLine) {
  item.qty++
}

function decreaseQty(item: CartLine) {
  if (item.qty > 1) {
    item.qty--
  } else {
    removeFromCart(item.id)
  }
}

function removeFromCart(id: string) {
  cart.value = cart.value.filter(l => l.id !== id)
  toast.error("Item removed from cart.")
}

// Compute pricing
const subtotal = computed(() => cart.value.reduce((s, l) => s + l.price * l.qty, 0))
const tax = computed(() => subtotal.value * 0.08) // 8% Tax matching standard layouts
const total = computed(() => subtotal.value + tax.value)

// Filter menu items
const filteredMenuItems = computed(() => {
  return menuItems.value.filter(m => {
    const matchesCategory = selectedCategory.value === "All" || m.categoryId === selectedCategory.value
    const matchesSearch = m.name.toLowerCase().includes(searchQuery.value.toLowerCase()) || 
                          (m.description && m.description.toLowerCase().includes(searchQuery.value.toLowerCase()))
    return matchesCategory && matchesSearch
  })
})

// Place order
async function checkout() {
  if (cart.value.length === 0) {
    toast.error("Your cart is empty. Tap items to add them.")
    return
  }

  const restaurantId = selectedRestaurant.value?.id || selectedRestaurant.value?._id

  if (!restaurantId) {
    toast.error("Restaurant context is missing.")
    return
  }

  placingOrder.value = true

  // Build the unified order notes field to preserve Dine-In/Takeaway, Name, Mobile, and special instructions
  let kioskNotes = `[KIOSK ORDER] Mode: ${orderType.value === 'dine_in' ? 'Dine-In' : 'Takeaway'}`
  if (customerName.value.trim()) kioskNotes += ` | Name: ${customerName.value.trim()}`
  if (customerPhone.value.trim()) kioskNotes += ` | Phone: ${customerPhone.value.trim()}`
  
  // Format items array for the API
  const itemsPayload = cart.value.map(item => ({
    menuItemId: item.id,
    quantity: item.qty,
    specialInstructions: item.notes.trim()
  }))

  try {
    // Under takeaway, tableNumber validation requires a valid positive integer.
    // We default takeaway table numbers to 1.
    const resolvedTable = orderType.value === 'dine_in' ? Number(tableNumber.value) : 1

    const response = await createOrder({
      restaurantId,
      tableNumber: String(resolvedTable),
      items: itemsPayload
    })

    // If there is any general notes field or if we update order note details:
    const newOrder = response.data || response

    // Update order with custom kiosk metadata in notes if supported (e.g. calling backend or saving locally)
    // Here we can directly display the created order info.
    placedOrder.value = newOrder
    step.value = "success"
    cart.value = []
    showCartDrawer.value = false
    
    // Start live tracking of order
    startPolling(newOrder._id || newOrder.id)
  } catch (err: any) {
    console.error("Kiosk order placement failed:", err)
    toast.error(err.message || "Failed to place order. Please try again.")
  } finally {
    placingOrder.value = false
  }
}

// Order Status Polling for Kiosk Tracking screen
function startPolling(orderId: string) {
  stopPolling()
  // Initial check
  pollOrder(orderId)
  pollInterval = setInterval(() => {
    pollOrder(orderId)
  }, 5000)
}

function stopPolling() {
  if (pollInterval) {
    clearInterval(pollInterval)
    pollInterval = null
  }
}

async function pollOrder(orderId: string) {
  try {
    // Fetch order directly
    const res = await authFetch(`/api/orders/${orderId}`)
    const updated = res.data || res
    placedOrder.value = updated

    // If completed or cancelled, we can let user know, but keep success screen visible
    if (updated.status === 'COMPLETED' || updated.status === 'CANCELLED') {
      stopPolling()
    }
  } catch (error) {
    console.error("Error polling order status:", error)
  }
}

function resetKiosk() {
  stopPolling()
  placedOrder.value = null
  customerName.value = ""
  customerPhone.value = ""
  tableNumber.value = null
  step.value = "splash"
}

// Estimate prep time based on item count
const estimatedPrepTime = computed(() => {
  if (!placedOrder.value) return "15-20 min"
  const count = placedOrder.value.items?.reduce((s: number, i: any) => s + (i.qty || i.quantity || 1), 0) || 3
  if (count <= 2) return "10-15 min"
  if (count <= 5) return "15-20 min"
  return "20-30 min"
})

// Progress bar mapped status
const statusProgress = computed(() => {
  const current = placedOrder.value?.status || 'PENDING'
  switch (current) {
    case 'PENDING': return 25
    case 'PREPARING': return 50
    case 'READY': return 75
    case 'SERVED':
    case 'COMPLETED': return 100
    default: return 0
  }
})

// Custom formatting for progress active steps
function isStepActive(target: string) {
  const current = placedOrder.value?.status || 'PENDING'
  const states = ['PENDING', 'PREPARING', 'READY', 'SERVED', 'COMPLETED']
  
  if (current === 'CANCELLED') return false
  
  const curIndex = states.indexOf(current === 'COMPLETED' ? 'SERVED' : current)
  const targetIndex = states.indexOf(target)
  return targetIndex <= curIndex
}
</script>

<template>
  <div class="min-h-screen bg-background text-foreground flex flex-col font-sans select-none">
    
    <!-- Top Branding / Header -->
    <header class="h-20 border-b border-border bg-card/85 backdrop-blur-md sticky top-0 z-30 flex items-center justify-between px-6 lg:px-12 shadow-sm">
      <div class="flex items-center gap-3">
        <div class="h-11 w-11 rounded-2xl gradient-primary grid place-items-center shadow-glow">
          <Utensils class="h-5.5 w-5.5 text-primary-foreground animate-bounce" />
        </div>
        <div>
          <div class="font-display text-2xl font-bold tracking-tight text-foreground">Savoria</div>
          <div v-if="selectedRestaurant" class="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-semibold">{{ selectedRestaurant.name }}</div>
          <div v-else class="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-semibold">Select Your Restaurant</div>
        </div>
      </div>

      <div class="flex items-center gap-3">
        <LanguageSwitcher />
        
        <!-- Quick Kiosk Reset (Only visible on Success screen) -->
        <Button 
          v-if="step === 'success'" 
          variant="outline" 
          size="sm" 
          class="rounded-full px-4 h-9 bg-primary/10 text-primary hover:bg-primary/20 border-primary/20"
          @click="resetKiosk"
        >
          New Order
        </Button>
        
        <!-- Discreet exit button for employees -->
        <Button 
          variant="ghost" 
          size="icon" 
          class="h-10 w-10 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground" 
          @click="exitKiosk" 
          title="Exit Kiosk"
        >
          <LogOut class="h-5 w-5 text-destructive" />
        </Button>
      </div>
    </header>

    <!-- STEP 0: RESTAURANT SELECTION SCREEN -->
    <main v-if="step === 'restaurant'" class="flex-1 flex flex-col items-center justify-start md:justify-center p-4 md:p-8 lg:p-12 overflow-y-auto min-h-0 relative bg-linear-to-b from-primary/5 via-transparent to-background">
      <div class="absolute inset-0 pointer-events-none" style="background: radial-gradient(600px circle at 50% 30%, oklch(0.65 0.16 215 / 0.08), transparent 70%)" />

      <div class="max-w-4xl w-full text-center space-y-6 md:space-y-8 relative z-10 my-auto py-4">
        <!-- Logo and Heading -->
        <div class="space-y-3">
          <div class="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-primary/15 bg-primary/5 text-xs text-primary font-semibold backdrop-blur animate-pulse">
            <Sparkles class="h-3.5 w-3.5" /> Welcome to Savoria
          </div>
          <h1 class="font-display text-4xl md:text-5xl font-extrabold tracking-tight leading-tight">
            Choose Your<br />
            <span class="gradient-text italic">Restaurant</span>
          </h1>
          <p class="text-muted-foreground text-sm max-w-sm mx-auto">
            Select which restaurant you'd like to order from today.
          </p>
        </div>

        <!-- Loading state -->
        <div v-if="loadingRestaurants" class="flex flex-col items-center justify-center p-12">
          <Compass class="h-8 w-8 animate-spin text-primary mb-4" />
          <p class="text-muted-foreground">Loading restaurants...</p>
        </div>

        <!-- Restaurants Grid -->
        <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <button
            v-for="restaurant in restaurants"
            :key="restaurant._id || restaurant.id"
            @click="selectRestaurant(restaurant)"
            class="bg-card border-2 border-border rounded-3xl p-6 text-left hover:border-primary hover:shadow-glow transition-all duration-300 group"
          >
            <!-- Restaurant icon/emoji -->
            <div class="h-16 w-16 rounded-2xl bg-primary/10 text-primary grid place-items-center text-3xl mb-4 group-hover:bg-primary/20 transition">
              <Building2 class="h-8 w-8" />
            </div>

            <!-- Restaurant name -->
            <h3 class="font-display text-xl font-bold text-foreground mb-1">{{ restaurant.name }}</h3>

            <!-- Location -->
            <div class="flex items-center gap-2 text-muted-foreground text-sm mb-3">
              <MapPin class="h-4 w-4" />
              <span>{{ restaurant.location }}</span>
            </div>

            <!-- Description -->
            <p v-if="restaurant.description" class="text-xs text-muted-foreground mb-4 line-clamp-2">{{ restaurant.description }}</p>

            <!-- Phone -->
            <div class="text-xs text-muted-foreground">📞 {{ restaurant.phone }}</div>

            <!-- Click hint -->
            <div class="mt-4 inline-flex items-center gap-1 text-primary text-xs font-semibold group-hover:gap-2 transition-all">
              Start Ordering <ChevronRight class="h-3.5 w-3.5" />
            </div>
          </button>
        </div>

        <!-- No restaurants message -->
        <div v-if="!loadingRestaurants && restaurants.length === 0" class="text-center p-8">
          <div class="text-4xl mb-3">🏪</div>
          <h3 class="font-bold text-lg mb-1">No Restaurants Available</h3>
          <p class="text-muted-foreground text-sm">Please check back later.</p>
        </div>
      </div>
    </main>

    <!-- STEP 1: SPLASH SCREEN -->
    <main v-if="step === 'splash'" class="flex-1 flex flex-col items-center justify-start md:justify-center p-4 md:p-8 lg:p-12 overflow-y-auto min-h-0 relative bg-linear-to-b from-primary/5 via-transparent to-background">
      <div class="absolute inset-0 pointer-events-none" style="background: radial-gradient(600px circle at 50% 30%, oklch(0.65 0.16 215 / 0.08), transparent 70%)" />

      <div class="max-w-xl w-full text-center space-y-6 md:space-y-8 relative z-10 my-auto py-4">
        <!-- Back Button -->
        <button 
          @click="selectedRestaurant = null; step = 'restaurant'"
          class="flex items-center gap-1 text-muted-foreground hover:text-foreground text-xs font-semibold mx-auto mb-4 hover:gap-2 transition-all"
        >
          <ArrowLeft class="h-4 w-4" /> Change Restaurant
        </button>

        <!-- Logo and Heading -->
        <div class="space-y-3">
          <div class="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-primary/15 bg-primary/5 text-xs text-primary font-semibold backdrop-blur animate-pulse">
            <Sparkles class="h-3.5 w-3.5" /> {{ selectedRestaurant?.name }}
          </div>
          <h1 class="font-display text-4xl md:text-5xl font-extrabold tracking-tight leading-tight">
            Order &amp; Enjoy<br />
            <span class="gradient-text italic">Freshly Prepared</span>
          </h1>
          <p class="text-muted-foreground text-sm max-w-sm mx-auto">
            Choose your dining type, customize your order, and watch its live preparation.
          </p>
        </div>

        <!-- Compact Form Card -->
        <div class="bg-card border border-border rounded-3xl p-6 md:p-8 shadow-card space-y-5 text-left">
          
          <!-- Dine-In vs Takeaway Pills -->
          <div class="space-y-2">
            <label class="text-[10.5px] font-bold text-muted-foreground uppercase tracking-wider block">1. Dining Preference</label>
            <div class="grid grid-cols-2 gap-3">
              <button 
                type="button"
                @click="orderType = 'dine_in'"
                :class="[
                  'h-13 rounded-xl border-2 flex items-center justify-center gap-2.5 font-bold transition-all text-sm',
                  orderType === 'dine_in' 
                    ? 'border-primary bg-primary/5 text-primary shadow-soft' 
                    : 'border-border hover:border-primary/30 text-muted-foreground bg-muted/5'
                ]"
              >
                <span class="text-lg">🍽️</span>
                Dine-In
              </button>
              <button 
                type="button"
                @click="orderType = 'takeaway'; tableNumber = null"
                :class="[
                  'h-13 rounded-xl border-2 flex items-center justify-center gap-2.5 font-bold transition-all text-sm',
                  orderType === 'takeaway' 
                    ? 'border-primary bg-primary/5 text-primary shadow-soft' 
                    : 'border-border hover:border-primary/30 text-muted-foreground bg-muted/5'
                ]"
              >
                <span class="text-lg">🛍️</span>
                Takeaway
              </button>
            </div>
          </div>

          <!-- Table Number Selector (Only visible for Dine-In) -->
          <div v-if="orderType === 'dine_in'" class="space-y-2 animate-fade-in">
            <label class="text-[10.5px] font-bold text-muted-foreground uppercase tracking-wider block">2. Select Your Table Number <span class="text-destructive font-black">*</span></label>
            <select 
              v-model="tableNumber"
              class="w-full h-12 px-4 rounded-xl border border-input bg-background text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary transition"
            >
              <option :value="null" disabled>Choose table number...</option>
              <option v-for="n in maxTables" :key="n" :value="n">
                Table {{ n }}
              </option>
            </select>
          </div>

          <!-- Customer details inputs -->
          <div class="space-y-2">
            <label class="text-[10.5px] font-bold text-muted-foreground uppercase tracking-wider block">3. Customer Details <span class="text-[10px] font-normal text-muted-foreground/60">(Optional)</span></label>
            <div class="grid sm:grid-cols-2 gap-3">
              <div class="space-y-1">
                <label class="text-[10px] text-muted-foreground block">Your Name</label>
                <Input v-model="customerName" placeholder="e.g. John" class="h-11 rounded-xl bg-background border-input focus:border-primary" />
              </div>
              <div class="space-y-1">
                <label class="text-[10px] text-muted-foreground block">Phone Number</label>
                <Input v-model="customerPhone" placeholder="e.g. 9876543210" class="h-11 rounded-xl bg-background border-input focus:border-primary" />
              </div>
            </div>
            <span class="text-[9.5px] text-muted-foreground/60 block leading-tight mt-1">
              * The cashier and kitchen use this info to identify your order ticket.
            </span>
          </div>

          <!-- Let's Begin Button -->
          <Button 
            @click="startOrdering(orderType)" 
            class="w-full h-12 mt-2 rounded-xl gradient-primary text-primary-foreground font-extrabold shadow-glow text-sm flex items-center justify-center gap-2 hover:opacity-95"
          >
            Start Placing Order <ChevronRight class="h-4.5 w-4.5" />
          </Button>

        </div>
      </div>
    </main>

    <!-- STEP 2: MAIN MENU BROWSER -->
    <main v-else-if="step === 'menu'" class="flex-1 grid lg:grid-cols-[240px_1fr] overflow-hidden relative">
      
      <!-- Kiosk Category Navigation (Left Sidebar) -->
      <aside class="bg-card border-r border-border flex flex-col p-4 space-y-2 overflow-y-auto">
        <div class="px-2 mb-4">
          <div class="text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground">Food Categories</div>
          <div class="text-[11px] text-muted-foreground/60 mt-0.5">{{ orderType === 'dine_in' ? `Table ${tableNumber} · Dine-In` : 'Takeaway Order' }}</div>
        </div>

        <button 
          key="all"
          @click="selectedCategory = 'All'"
          :class="[
            'w-full flex items-center gap-3.5 p-3 rounded-2xl text-left transition-all border font-semibold text-sm',
            selectedCategory === 'All' 
              ? 'gradient-primary text-primary-foreground border-primary shadow-soft' 
              : 'border-transparent hover:bg-muted text-foreground/80'
          ]"
        >
          <span class="text-2xl">🍽️</span>
          <span>Browse All</span>
        </button>

        <button 
          v-for="category in menuCategories" 
          :key="category._id || category.id"
          @click="selectedCategory = category._id || category.id || ''"
          :class="[
            'w-full flex items-center gap-3.5 p-3 rounded-2xl text-left transition-all border font-semibold text-sm',
            selectedCategory === (category._id || category.id) 
              ? 'gradient-primary text-primary-foreground border-primary shadow-soft' 
              : 'border-transparent hover:bg-muted text-foreground/80'
          ]"
        >
          <span class="text-2xl">{{ category.icon || "🍴" }}</span>
          <span>{{ category.name }}</span>
        </button>

        <div class="pt-8 border-t border-border mt-auto">
          <button @click="resetKiosk" class="w-full flex items-center gap-2 p-2.5 rounded-xl text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/5 font-medium">
            <ArrowLeft class="h-4 w-4" /> Change dining type
          </button>
        </div>
      </aside>

      <!-- Food Menu Grid / Main Content -->
      <section class="flex flex-col overflow-hidden bg-muted/10">
        <!-- Search & Filter Ribbon -->
        <div class="p-4 border-b border-border bg-card flex flex-col sm:flex-row items-center gap-3">
          <div class="relative w-full sm:max-w-md">
            <Search class="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              v-model="searchQuery" 
              placeholder="Search dishes, burgers, beverages..." 
              class="pl-10 h-11 rounded-full border-input bg-muted/30 focus:bg-background"
            />
            <button v-if="searchQuery" @click="searchQuery = ''" class="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/60 hover:text-foreground">
              <X class="h-4 w-4" />
            </button>
          </div>
          
          <div class="sm:ml-auto flex items-center gap-2">
            <Badge variant="outline" class="px-3.5 py-1.5 rounded-full border-primary/20 bg-primary/5 text-primary text-xs font-semibold">
              {{ filteredMenuItems.length }} Item{{ filteredMenuItems.length !== 1 ? 's' : '' }}
            </Badge>
          </div>
        </div>

        <!-- Menu Cards Grid -->
        <div class="flex-1 overflow-y-auto p-6">
          <div v-if="loadingMenu" class="h-full flex items-center justify-center text-muted-foreground text-sm font-semibold">
            <Compass class="h-8 w-8 animate-spin mr-3 text-primary" /> Loading delicious menu items...
          </div>
          
          <div v-else-if="filteredMenuItems.length === 0" class="h-full flex flex-col items-center justify-center text-center p-8 text-muted-foreground animate-fade-in">
            <div class="text-5xl mb-4">🔍</div>
            <h3 class="font-display text-lg font-bold text-foreground">No dishes found</h3>
            <p class="text-xs max-w-xs mt-1">Try modifying your search query or choosing another category.</p>
          </div>

          <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            <div 
              v-for="m in filteredMenuItems" 
              :key="m.id"
              class="bg-card border border-border rounded-3xl p-5 flex flex-col shadow-soft hover:shadow-glow hover:border-primary/35 transition-all duration-300 relative group overflow-hidden"
              :class="[!m.available ? 'opacity-65' : '']"
            >
              <!-- Unavailable Banner Overlay -->
              <div v-if="!m.available" class="absolute top-3 right-3 z-10 bg-destructive/10 border border-destructive/25 text-destructive font-bold text-[9px] uppercase px-2 py-0.5 rounded-md">
                Sold Out
              </div>

              <!-- Dish Category Badge -->
              <div class="text-[9.5px] font-bold text-primary uppercase tracking-widest">{{ m.categoryName }}</div>

              <!-- Dish visual display (large emoji matching custom design) -->
              <div class="text-6xl my-4 text-center transform group-hover:scale-110 transition duration-300 select-none">
                {{ m.emoji }}
              </div>

              <!-- Details -->
              <div class="space-y-1.5 flex-1 flex flex-col">
                <h4 class="font-display text-base font-bold leading-tight truncate text-foreground">{{ m.name }}</h4>
                <p class="text-xs text-muted-foreground line-clamp-2 leading-relaxed flex-1">{{ m.description || "Freshly cooked to perfection with select ingredients." }}</p>
                
                <div class="flex items-end justify-between pt-3 mt-auto">
                  <div class="font-display text-2xl font-black text-primary">₹{{ m.price.toFixed(0) }}</div>
                  
                  <!-- Add/Disable Action Button -->
                  <Button 
                    v-if="m.available"
                    @click="addToCart(m)" 
                    class="h-9 px-4 rounded-xl gradient-primary text-primary-foreground font-semibold shadow-soft hover:opacity-90 active:scale-95 text-xs"
                  >
                    Add +
                  </Button>
                  <Button 
                    v-else
                    disabled
                    class="h-9 px-4 rounded-xl bg-muted text-muted-foreground text-xs"
                  >
                    Unavailable
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Floating Cart Footer (Only active if items in cart) -->
        <footer 
          v-if="cart.length > 0" 
          class="bg-card border-t border-border p-4 px-6 lg:px-12 flex items-center justify-between shadow-2xl relative z-20 animate-fade-in"
        >
          <div class="flex items-center gap-4">
            <div class="relative h-12 w-12 rounded-2xl gradient-primary grid place-items-center text-primary-foreground shadow-glow">
              <ShoppingBag class="h-5.5 w-5.5" />
              <span class="absolute -top-1.5 -right-1.5 bg-destructive text-[10px] text-destructive-foreground font-black h-5 w-5 rounded-full flex items-center justify-center border-2 border-card">
                {{ cart.reduce((s, l) => s + l.qty, 0) }}
              </span>
            </div>
            <div>
              <div class="text-xs text-muted-foreground font-medium">Order Total</div>
              <div class="font-display text-xl font-bold">₹{{ total.toFixed(0) }} <span class="text-xs font-normal text-muted-foreground/60">incl. tax</span></div>
            </div>
          </div>

          <Button @click="showCartDrawer = true" class="h-12 px-8 rounded-2xl gradient-primary text-primary-foreground font-bold shadow-glow text-sm">
            View My Order <ChevronRight class="h-4.5 w-4.5 ml-1" />
          </Button>
        </footer>
      </section>

      <!-- CART DRAWIER MODAL BACKDROP & OVERLAY -->
      <div 
        v-if="showCartDrawer" 
        class="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 transition-opacity" 
        @click="showCartDrawer = false" 
      />

      <aside 
        :class="[
          'fixed inset-y-0 right-0 z-50 w-full max-w-lg bg-card border-l border-border flex flex-col shadow-2xl transition-transform duration-300',
          showCartDrawer ? 'translate-x-0' : 'translate-x-full'
        ]"
      >
        <!-- Drawer Header -->
        <div class="p-5 border-b border-border flex items-center justify-between">
          <div>
            <h3 class="font-display text-xl font-bold">Review My Order</h3>
            <p class="text-xs text-muted-foreground">{{ cart.length }} unique dish{{ cart.length !== 1 ? 'es' : '' }} selected</p>
          </div>
          <button @click="showCartDrawer = false" class="p-1.5 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground">
            <X class="h-5 w-5" />
          </button>
        </div>

        <!-- Cart List (Scrollable) -->
        <div class="flex-1 overflow-y-auto p-4 space-y-3">
          <div v-for="l in cart" :key="l.id" class="p-4 rounded-3xl bg-muted/20 border border-border/60 flex flex-col space-y-3">
            <div class="flex items-center gap-3.5">
              <span class="text-3xl select-none">{{ l.emoji }}</span>
              <div class="flex-1 min-w-0">
                <div class="font-semibold text-sm truncate text-foreground">{{ l.name }}</div>
                <div class="text-xs text-primary font-bold">₹{{ l.price.toFixed(0) }} <span class="text-[10px] text-muted-foreground/60 font-normal">per item</span></div>
              </div>
              
              <!-- Quantity controllers -->
              <div class="flex items-center gap-1.5">
                <button @click="decreaseQty(l)" class="h-8 w-8 grid place-items-center rounded-xl bg-card border border-border hover:bg-muted text-foreground">
                  <Minus class="h-3.5 w-3.5" />
                </button>
                <span class="w-6 text-center text-sm font-bold tabular-nums">{{ l.qty }}</span>
                <button @click="increaseQty(l)" class="h-8 w-8 grid place-items-center rounded-xl bg-card border border-border hover:bg-muted text-foreground">
                  <Plus class="h-3.5 w-3.5" />
                </button>
                <button @click="removeFromCart(l.id)" class="h-8 w-8 grid place-items-center rounded-xl text-destructive hover:bg-destructive/10 border border-transparent ml-1">
                  <Trash2 class="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            <!-- Item Special Instructions -->
            <div class="pt-2 border-t border-border/40 flex items-center gap-2">
              <label class="text-[10px] font-bold text-muted-foreground shrink-0 uppercase tracking-wider">Instructions:</label>
              <input 
                v-model="l.notes"
                placeholder="e.g. No onions / extra spicy..."
                class="flex-1 bg-transparent border-b border-border/60 focus:border-primary text-xs px-1 py-0.5 outline-none font-medium text-foreground"
              />
            </div>
          </div>
        </div>

        <!-- Checkout Summary & Checkout Actions -->
        <div class="p-6 border-t border-border bg-card/50 space-y-4">
          <div class="space-y-2 text-sm text-muted-foreground">
            <div class="flex justify-between"><span>Subtotal</span><span class="tabular-nums font-medium text-foreground">₹{{ subtotal.toFixed(0) }}</span></div>
            <div class="flex justify-between"><span>Tax (5%)</span><span class="tabular-nums font-medium text-foreground">₹{{ tax.toFixed(0) }}</span></div>
            <div class="flex justify-between font-display text-2xl font-black text-foreground pt-2 border-t border-border">
              <span>Total Amount</span>
              <span class="tabular-nums text-primary">₹{{ total.toFixed(0) }}</span>
            </div>
          </div>

          <!-- Dining Details Confirmation (ReadOnly summary) -->
          <div class="p-3.5 rounded-2xl bg-primary/5 border border-primary/10 flex items-center justify-between text-xs text-primary font-semibold">
            <div class="flex items-center gap-2">
              <span>📍</span>
              <span>Serving type: <strong>{{ orderType === 'dine_in' ? 'Dine-In' : 'Takeaway' }}</strong></span>
            </div>
            <div v-if="orderType === 'dine_in'">
              <span>Table number: <strong>{{ tableNumber }}</strong></span>
            </div>
          </div>

          <!-- Checkout actions -->
          <Button 
            @click="checkout" 
            :disabled="placingOrder"
            class="w-full h-13 rounded-2xl gradient-primary text-primary-foreground font-bold shadow-glow text-base flex items-center justify-center gap-2 hover:opacity-95"
          >
            <CheckCircle2 v-if="!placingOrder" class="h-5.5 w-5.5" />
            <Compass v-else class="h-5.5 w-5.5 animate-spin" />
            {{ placingOrder ? "Sending ticket to kitchen..." : "Confirm & Send to Kitchen" }}
          </Button>
        </div>
      </aside>
    </main>

    <!-- STEP 3: ORDER SUCCESS SCREEN & LIVE STATUS TRACKING -->
    <main v-else-if="step === 'success' && placedOrder" class="flex-1 flex flex-col items-center justify-center p-6 lg:p-12 bg-gradient-to-b from-success/5 via-transparent to-background">
      <div class="max-w-2xl w-full bg-card border border-border shadow-card rounded-3xl p-6 lg:p-10 space-y-8 animate-in zoom-in-95 duration-300">
        
        <!-- Large success check -->
        <div class="text-center space-y-3">
          <div class="h-16 w-16 rounded-2xl bg-success/15 text-success grid place-items-center mx-auto shadow-soft">
            <CheckCircle2 class="h-8 w-8 text-success" />
          </div>
          <h2 class="font-display text-3xl font-black text-foreground">Order Successfully Placed!</h2>
          <p class="text-sm text-muted-foreground">Your order is being sent directly to the kitchen display.</p>
        </div>

        <!-- Token Number Display Box -->
        <div class="grid grid-cols-2 gap-4 p-5 rounded-2xl bg-muted/40 border border-border/80 text-center">
          <div class="space-y-1">
            <div class="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
              {{ orderType === 'takeaway' ? 'Order Type' : 'Table Number' }}
            </div>
            <div class="font-display text-3xl font-black text-primary uppercase">
              {{ orderType === 'takeaway' ? 'Takeaway' : `Table ${placedOrder.tableNumber}` }}
            </div>
          </div>
          <div class="space-y-1 border-l border-border/80">
            <div class="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Est. Ready Time</div>
            <div class="font-display text-2xl font-bold text-foreground flex items-center justify-center gap-1.5">
              <Clock class="h-5 w-5 text-primary" /> {{ estimatedPrepTime }}
            </div>
          </div>
        </div>

        <!-- LIVE ORDER STATUS TRACKING (STEPS) -->
        <div class="space-y-4 pt-2">
          <div class="flex items-center justify-between text-xs font-semibold px-1">
            <span class="text-muted-foreground">Live Order Progress:</span>
            <span :class="['uppercase font-bold', placedOrder.status === 'CANCELLED' ? 'text-destructive' : 'text-success']">
              ● {{ placedOrder.status }}
            </span>
          </div>

          <!-- Progress Bar Graphic -->
          <div class="relative w-full h-2 rounded-full bg-muted overflow-hidden">
            <div 
              class="h-full gradient-primary transition-all duration-500" 
              :class="[placedOrder.status === 'CANCELLED' ? 'bg-destructive' : '']"
              :style="{ width: `${statusProgress}%` }" 
            />
          </div>

          <!-- Step Indicators -->
          <div class="grid grid-cols-4 gap-1 text-[11px] font-bold text-center">
            <div :class="[isStepActive('PENDING') ? 'text-primary font-bold' : 'text-muted-foreground/60']">
              1. Received
            </div>
            <div :class="[isStepActive('PREPARING') ? 'text-primary font-bold' : 'text-muted-foreground/60']">
              2. Preparing
            </div>
            <div :class="[isStepActive('READY') ? 'text-primary font-bold' : 'text-muted-foreground/60']">
              3. Ready
            </div>
            <div :class="[isStepActive('SERVED') ? 'text-primary font-bold' : 'text-muted-foreground/60']">
              4. Completed
            </div>
          </div>
        </div>

        <!-- Cancellation Notice (only visible if order gets voided) -->
        <div v-if="placedOrder.status === 'CANCELLED'" class="p-4 rounded-2xl bg-destructive/10 border border-destructive/20 text-destructive flex items-start gap-3">
          <AlertCircle class="h-5 w-5 shrink-0 mt-0.5" />
          <div class="text-xs">
            <strong class="block font-bold">This order has been cancelled by staff</strong>
            <span class="block mt-0.5 text-muted-foreground">Reason: {{ placedOrder.cancelReason || "No details provided." }}</span>
          </div>
        </div>

        <!-- Order Items Detail List -->
        <div class="space-y-3 pt-2">
          <div class="text-xs font-bold uppercase tracking-wider text-muted-foreground border-b border-border pb-1">Order Details Summary</div>
          <div class="max-h-40 overflow-y-auto space-y-2 pr-1">
            <div v-for="(it, i) in placedOrder.items" :key="i" class="flex justify-between text-sm">
              <span>
                <span class="font-bold text-primary">{{ it.qty || it.quantity || 1 }}×</span> 
                <span class="font-medium ml-1.5">{{ it.name }}</span>
                <span v-if="it.note" class="block text-[10px] text-muted-foreground italic ml-6">"{{ it.note }}"</span>
              </span>
              <span class="tabular-nums font-semibold">₹{{ ((it.price || 0) * (it.qty || it.quantity || 1)).toFixed(0) }}</span>
            </div>
          </div>
          <div class="border-t border-border pt-3 flex justify-between items-center text-sm">
            <span class="text-muted-foreground text-xs">Dining: <strong>{{ placedOrder.tableNumber === 1 && orderType === 'takeaway' ? 'Takeaway' : `Table ${placedOrder.tableNumber} (Dine-In)` }}</strong></span>
            <span class="font-bold text-lg text-foreground">Total: ₹{{ (placedOrder.totalAmount || 0).toFixed(0) }}</span>
          </div>
        </div>

        <!-- Actions -->
        <div class="flex flex-col sm:flex-row gap-3 pt-2">
          <Button @click="resetKiosk" class="flex-1 h-12 rounded-2xl gradient-primary text-primary-foreground font-bold shadow-glow text-sm">
            Start A New Order
          </Button>
        </div>

      </div>
    </main>
    
  </div>
</template>

<style scoped>
.gradient-text {
  background: linear-gradient(135deg, var(--primary), var(--primary-glow));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}
</style>
