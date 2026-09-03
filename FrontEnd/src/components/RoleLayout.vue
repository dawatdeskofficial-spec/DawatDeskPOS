<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore, ROLE_LABELS, ROLE_HOMES, type AppRole } from '@/stores/auth'
import { getRestaurantById, getOrders, updateOrderStatus } from '@/lib/api'
import {
  Bell, BellRing, ChevronDown, LogOut, Menu, Moon, Sun, Globe,
  User as UserIcon, UtensilsCrossed, X, CheckCircle2, Clock, ConciergeBell
} from 'lucide-vue-next'
import DropdownMenu from '@/components/ui/DropdownMenu.vue'
import DropdownMenuContent from '@/components/ui/DropdownMenuContent.vue'
import DropdownMenuItem from '@/components/ui/DropdownMenuItem.vue'
import DropdownMenuLabel from '@/components/ui/DropdownMenuLabel.vue'
import DropdownMenuSeparator from '@/components/ui/DropdownMenuSeparator.vue'
import { DropdownMenuTrigger } from 'radix-vue'
import Button from '@/components/ui/Button.vue'
import Badge from '@/components/ui/Badge.vue'
import { toast } from 'vue-sonner'
import LanguageSwitcher from '@/components/LanguageSwitcher.vue'
import AlertDialog from '@/components/ui/AlertDialog.vue'
import AlertDialogContent from '@/components/ui/AlertDialogContent.vue'
import AlertDialogHeader from '@/components/ui/AlertDialogHeader.vue'
import AlertDialogTitle from '@/components/ui/AlertDialogTitle.vue'
import AlertDialogDescription from '@/components/ui/AlertDialogDescription.vue'
import AlertDialogFooter from '@/components/ui/AlertDialogFooter.vue'
import AlertDialogCancel from '@/components/ui/AlertDialogCancel.vue'
import AlertDialogAction from '@/components/ui/AlertDialogAction.vue'

import { restaurantNav, adminNav } from '@/lib/nav'

interface NavItem {
  to: string
  label: string
  icon: any
}

const props = withDefaults(defineProps<{
  role: AppRole
  nav: NavItem[]
  brand?: string
}>(), {
  brand: 'DawatDesk'
})

const auth = useAuthStore()
const router = useRouter()
const route = useRoute()

const open = ref(false)
const dark = ref(false)
const restaurantName = ref(props.brand)
const notifOpen = ref(false)
const showMobileLanguageMenu = ref(false)
const showLogoutConfirm = ref(false)

// ── Notification system (waiter only) ───────────────────────────────────────
const readyOrders = ref<any[]>([])
const seenReadyIds = ref<Set<string>>(new Set())
const hasNewNotif = ref(false)
let notifInterval: any

const isInspecting = computed(() => auth.user?.role === 'main_admin' && Boolean(auth.inspectedRestaurantId))

const effectiveNav = computed(() => {
  if (isInspecting.value) {
    return restaurantNav
  }
  return props.nav
})

const effectiveRoleLabel = computed(() => {
  if (isInspecting.value) {
    return 'Inspecting Restaurant'
  }
  return ROLE_LABELS[props.role] || 'Dashboard'
})

const isWaiter = computed(() => auth.user?.role === 'waiter')

async function pollReadyOrders() {
  if (!auth.user?.restaurantId || !isWaiter.value) return
  const restaurantId =
    typeof auth.user.restaurantId === 'string'
      ? auth.user.restaurantId
      : (auth.user.restaurantId as any)?.id || (auth.user.restaurantId as any)?._id
  if (!restaurantId) return

  try {
    const res = await getOrders(restaurantId, 1, 100)
    const orders: any[] = res.data || []
    const fresh = orders.filter((o: any) => (o.status || '').toUpperCase() === 'READY')

    // Detect newly-ready orders
    fresh.forEach((o: any) => {
      const oid = String(o.id || o._id)
      if (!seenReadyIds.value.has(oid)) {
        hasNewNotif.value = true
        const itemCount = (o.items || []).length
        toast(`🔔 Table ${o.tableNumber} is ready!`, {
          description: `${itemCount} item${itemCount !== 1 ? 's' : ''} ready to pick up from kitchen`,
          duration: 8000,
          style: {
            background: 'hsl(var(--success) / 0.15)',
            border: '1px solid hsl(var(--success) / 0.4)',
            color: 'hsl(var(--success))',
          },
        })
      }
    })

    // Update seen set to current ready order IDs
    seenReadyIds.value = new Set(fresh.map((o: any) => String(o.id || o._id)))
    readyOrders.value = fresh
  } catch {
    // silent fail
  }
}

async function serveOrder(orderId: string, tableNumber: number) {
  try {
    await updateOrderStatus(orderId, 'SERVED')
    toast.success(`Table ${tableNumber} marked as served!`)
    // Remove from list immediately
    readyOrders.value = readyOrders.value.filter(
      (o: any) => String(o.id || o._id) !== orderId
    )
    seenReadyIds.value.delete(orderId)
    if (readyOrders.value.length === 0) hasNewNotif.value = false
  } catch (err: any) {
    toast.error(err.message || 'Failed to mark as served')
  }
}

function openNotifPanel() {
  notifOpen.value = !notifOpen.value
  if (notifOpen.value) hasNewNotif.value = false
}

// ── Brand resolution ────────────────────────────────────────────────────────
const displayBrand = computed(() => restaurantName.value || props.brand)

async function resolveRestaurantBrand() {
  const user = auth.user
  if (!user) { restaurantName.value = props.brand; return }

  if (user.role === 'main_admin') {
    restaurantName.value = 'Restaurant Management'
    return
  }

  const restaurantId = auth.effectiveRestaurantId || (
    typeof user?.restaurantId === 'string'
      ? user.restaurantId
      : (user?.restaurantId as any)?.id || (user?.restaurantId as any)?._id
  )

  if (!restaurantId) { restaurantName.value = props.brand; return }

  try {
    const response = await getRestaurantById(restaurantId)
    restaurantName.value = String(response?.data?.name || response?.name || props.brand)
  } catch {
    restaurantName.value = props.brand
  }
}

onMounted(() => {
  const stored = localStorage.getItem('theme')
  if (stored) {
    dark.value = stored === 'dark'
  } else {
    dark.value = window.matchMedia('(prefers-color-scheme: dark)').matches
  }
  document.documentElement.classList.toggle('dark', dark.value)

  // Start notification polling for waiters
  if (isWaiter.value) {
    pollReadyOrders()
    notifInterval = setInterval(pollReadyOrders, 5000)
  }

  // Push a dummy history entry so the back button can be intercepted
  if (props.role !== 'waiter') {
    history.pushState({ navMenu: true }, '')
    window.addEventListener('popstate', handlePopState)
  }
})

onUnmounted(() => {
  clearInterval(notifInterval)
  window.removeEventListener('popstate', handlePopState)
})

watch(dark, (newDark) => {
  document.documentElement.classList.toggle('dark', newDark)
  localStorage.setItem('theme', newDark ? 'dark' : 'light')
})

watch(() => [auth.user, auth.inspectedRestaurantId], async () => {
  const u = auth.user
  if (!u) {
    router.push('/login')
  } else if (u.role !== props.role) {
    // Allow Main Admin to view restaurant_admin portal when inspecting a restaurant
    if (u.role === 'main_admin' && (props.role === 'restaurant_admin' || auth.inspectedRestaurantId)) {
      await resolveRestaurantBrand()
      return
    }
    router.push((u && (ROLE_HOMES as any)[u.role]) || '/')
  } else {
    await resolveRestaurantBrand()
  }
}, { immediate: true })

// Start polling when role becomes waiter
watch(isWaiter, (val) => {
  clearInterval(notifInterval)
  if (val) {
    pollReadyOrders()
    notifInterval = setInterval(pollReadyOrders, 5000)
  }
})

// ── Back button: open mobile nav menu instead of leaving ────────────────────
function handlePopState() {
  if (props.role !== 'waiter') {
    open.value = true
    // Re-push the dummy state so the back button can be caught again next time
    history.pushState({ navMenu: true }, '')
  }
}

function handleLogout() {
  open.value = false // close mobile navigation if open
  showLogoutConfirm.value = true
}

async function executeLogout() {
  showLogoutConfirm.value = false
  clearInterval(notifInterval)
  await auth.signOut()
  router.push('/login')
}

const breadcrumbs = computed(() => {
  const path = route.path
  if (path === '/' || path === '/login') return []
  const segments = path.split('/').filter(Boolean)
  return segments.map((seg, index) => {
    const label = seg.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
    const to = '/' + segments.slice(0, index + 1).join('/')
    return { label, to }
  })
})

function changeLanguage(code: string) {
  if (code === 'en') {
    document.cookie = 'googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;'
    document.cookie = 'googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=' + window.location.hostname + ';'
  } else {
    document.cookie = `googtrans=/en/${code}; path=/;`
  }
  window.location.href = '/'
}

function formatTime(ts: string) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}
</script>

<template>
  <div v-if="auth.user" class="min-h-screen bg-background text-foreground flex">
    <!-- Desktop Sidebar (Unchanged on Laptops & Desktops) -->
    <aside
      v-if="role !== 'waiter'"
      class="hidden lg:flex w-64 bg-sidebar text-sidebar-foreground border-r border-sidebar-border flex-col shrink-0"
    >
      <div class="h-16 flex items-center justify-between px-5 border-b border-sidebar-border">
        <router-link to="/" class="flex items-center gap-2.5">
          <div class="h-9 w-9 rounded-[10px] overflow-hidden border border-sidebar-border shadow-sm shrink-0 bg-white">
            <img src="/dawatdesk_logo.png" alt="DawatDesk Logo" class="h-full w-full object-cover hover:scale-105 transition-transform duration-300" />
          </div>
          <div class="leading-tight">
            <div class="font-brand text-[22px] font-bold tracking-tight">{{ displayBrand }}</div>
            <div class="text-[10px] uppercase tracking-[0.18em] text-sidebar-foreground/60">Kitchen &amp; Table</div>
          </div>
        </router-link>
      </div>

      <div class="px-3 pt-4 pb-2">
        <div class="px-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-sidebar-foreground/45">
          {{ effectiveRoleLabel }}
        </div>
      </div>

      <nav class="flex-1 px-3 pb-4 space-y-0.5 overflow-y-auto">
        <router-link
          v-for="item in effectiveNav"
          :key="item.to"
          :to="item.to"
          v-slot="{ isActive }"
          custom
        >
          <a
            :href="item.to"
            @click.prevent="router.push(item.to)"
            :class="[
              'group relative flex items-center gap-3 px-3 py-2 rounded-full text-[13.5px] font-medium transition-all',
              (route.path === item.to || (item.to !== '/' && route.path.startsWith(item.to)))
                ? 'bg-primary/10 text-primary'
                : 'text-sidebar-foreground/75 hover:text-primary hover:bg-primary/5'
            ]"
          >
            <span v-if="route.path === item.to || (item.to !== '/' && route.path.startsWith(item.to))" class="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-r bg-primary" />
            <component :is="item.icon" :class="['h-4 w-4', (route.path === item.to || (item.to !== '/' && route.path.startsWith(item.to))) ? 'text-primary' : 'text-sidebar-foreground/60 group-hover:text-primary']" />
            <span>{{ item.label }}</span>
          </a>
        </router-link>
      </nav>

      <div class="p-3 border-t border-sidebar-border flex items-center justify-between">
        <div class="flex items-center gap-2.5 p-2 rounded-lg transition min-w-0 flex-1">
          <div class="h-8 w-8 rounded-full gradient-primary grid place-items-center font-semibold text-primary-foreground text-sm shrink-0">
            {{ auth.user.name[0] }}
          </div>
          <div class="flex-1 min-w-0">
            <div class="text-[13px] font-medium truncate text-white">{{ auth.user.name }}</div>
            <div class="text-[11px] text-sidebar-foreground/60 truncate">{{ auth.user.email }}</div>
          </div>
        </div>
        <button @click="handleLogout" title="Log out" class="p-2 text-sidebar-foreground/60 hover:text-destructive hover:bg-sidebar-accent/50 rounded-lg transition cursor-pointer">
          <LogOut class="h-4 w-4" />
        </button>
      </div>
    </aside>

    <!-- ── Mobile Full-Screen Navigation Menu Modal (App Experience) ──────── -->
    <Teleport to="body">
      <Transition name="fade">
        <div
          v-if="open && role !== 'waiter'"
          class="lg:hidden fixed inset-0 z-50 bg-background flex flex-col"
        >
          <!-- Mobile Header -->
          <div class="h-16 flex items-center justify-between px-5 border-b border-border bg-card/90 shrink-0">
            <div class="flex items-center gap-2.5">
              <div class="h-9 w-9 rounded-[10px] overflow-hidden border border-border/70 shadow-sm shrink-0 bg-white">
                <img src="/dawatdesk_logo.png" alt="DawatDesk Logo" class="h-full w-full object-cover hover:scale-105 transition-transform duration-300" />
              </div>
              <div class="leading-tight">
                <div class="font-brand text-[20px] font-bold">{{ displayBrand }}</div>
                <div class="text-[10px] uppercase font-bold text-muted-foreground">{{ effectiveRoleLabel }}</div>
              </div>
            </div>
            <button
              @click="open = false"
              class="h-9 w-9 rounded-xl border border-border bg-muted/40 hover:bg-muted flex items-center justify-center text-foreground cursor-pointer"
            >
              <X class="h-5 w-5" />
            </button>
          </div>

          <!-- Navigation Links Grid -->
          <div class="flex-1 overflow-y-auto p-4 space-y-2">
            <button
              v-for="item in effectiveNav"
              :key="item.to"
              @click="router.push(item.to); open = false"
              :class="[
                'w-full flex items-center justify-between p-3.5 rounded-2xl border text-left transition cursor-pointer',
                (route.path === item.to || (item.to !== '/' && route.path.startsWith(item.to)))
                  ? 'border-primary bg-primary/10 text-primary font-bold shadow-xs'
                  : 'border-border bg-card text-foreground font-semibold hover:bg-muted/30'
              ]"
            >
              <div class="flex items-center gap-3.5">
                <div :class="['h-10 w-10 rounded-xl flex items-center justify-center shrink-0', (route.path === item.to || (item.to !== '/' && route.path.startsWith(item.to))) ? 'bg-primary text-primary-foreground' : 'bg-muted/70 text-muted-foreground']">
                  <component :is="item.icon" class="h-5 w-5" />
                </div>
                <span class="text-sm font-display">{{ item.label }}</span>
              </div>
              <ChevronDown class="h-4 w-4 text-muted-foreground -rotate-90" />
            </button>
          </div>

          <!-- User Profile & Logout at Bottom -->
          <div class="p-4 border-t border-border bg-card shrink-0 flex items-center justify-between">
            <div class="flex items-center gap-3 min-w-0 flex-1">
              <div class="h-10 w-10 rounded-full gradient-primary grid place-items-center font-bold text-primary-foreground text-sm shrink-0">
                {{ auth.user.name[0] }}
              </div>
              <div class="min-w-0 flex-1">
                <div class="text-sm font-bold truncate text-foreground">{{ auth.user.name }}</div>
                <div class="text-xs text-muted-foreground truncate">{{ auth.user.email }}</div>
              </div>
            </div>
            <button
              @click="handleLogout"
              class="px-3.5 py-2 rounded-xl bg-destructive/10 text-destructive hover:bg-destructive/20 font-bold text-xs flex items-center gap-1.5 cursor-pointer ml-2"
            >
              <LogOut class="h-4 w-4" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Main -->
    <div class="flex-1 flex flex-col min-w-0">
      <header class="h-16 border-b border-border flex items-center justify-between gap-2 px-4 lg:px-6 bg-card/80 backdrop-blur-md sticky top-0 z-50">
        <!-- Left: Brand / Title -->
        <div class="flex items-center gap-1.5 sm:gap-2.5 min-w-0 flex-1">
          <!-- Waiter Direct Header Logo -->
          <div v-if="role === 'waiter'" class="flex items-center gap-2 sm:gap-2.5 min-w-0">
            <div class="h-8 w-8 sm:h-9 sm:w-9 rounded-[10px] overflow-hidden border border-border/70 shadow-sm shrink-0 bg-white">
              <img src="/dawatdesk_logo.png" alt="DawatDesk Logo" class="h-full w-full object-cover hover:scale-105 transition-transform duration-300" />
            </div>
            <div class="leading-tight min-w-0">
              <div class="font-brand text-lg sm:text-[20px] font-bold tracking-tight truncate">{{ displayBrand }}</div>
              <div class="text-[10px] uppercase font-black tracking-widest text-primary flex items-center gap-1">
                <span>Waiter POS</span>
                <span class="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              </div>
            </div>
          </div>

          <!-- Non-waiter roles -->
          <template v-else>
            <button class="lg:hidden text-foreground flex-shrink-0" @click="open = true">
              <Menu class="h-5 w-5" />
            </button>
            
            <!-- Mobile/Tablet Brand (Visible when Sidebar is hidden) -->
            <div class="lg:hidden flex items-center gap-2 min-w-0 ml-0.5">
              <div class="font-brand text-base sm:text-lg font-bold tracking-tight truncate flex-1">{{ displayBrand }}</div>
            </div>

            <!-- Breadcrumbs (Visible when Sidebar is present) -->
            <div class="hidden lg:flex items-center gap-2 text-sm font-medium text-muted-foreground ml-2 select-none">
              <span class="text-foreground/40 font-semibold uppercase tracking-wider text-[11px]">{{ displayBrand }}</span>
              <span class="text-foreground/20">/</span>
              <span class="text-foreground font-semibold">{{ breadcrumbs.map(c => c.label).join(' / ') }}</span>
            </div>
          </template>
        </div>

        <div class="flex items-center gap-1 sm:gap-2 shrink-0">
          <div class="hidden sm:block">
            <LanguageSwitcher />
          </div>

          <Button variant="ghost" size="icon" class="hidden sm:flex h-8 w-8 sm:h-9 sm:w-9" @click="dark = !dark">
            <Sun v-if="dark" class="h-4 w-4" />
            <Moon v-else class="h-4 w-4" />
          </Button>

          <!-- ── Bell Notification (Waiter only) ───────────────────────────── -->
          <div v-if="isWaiter" class="relative">
            <button
              @click="openNotifPanel"
              :class="['relative h-9 w-9 rounded-lg flex items-center justify-center transition', notifOpen ? 'bg-primary/10 text-primary' : 'hover:bg-muted text-foreground']"
              aria-label="Kitchen notifications"
            >
              <BellRing v-if="hasNewNotif" class="h-4 w-4 text-success animate-[bell_0.5s_ease-in-out_infinite_alternate]" />
              <Bell v-else class="h-4 w-4" />
              <!-- Red badge count -->
              <span
                v-if="readyOrders.length > 0"
                class="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center ring-2 ring-background"
              >
                {{ readyOrders.length }}
              </span>
            </button>

            <!-- Click-outside backdrop (completely transparent, no dimming or blurring) -->
            <div
              v-if="notifOpen"
              class="fixed inset-0 z-40"
              @click="notifOpen = false"
            />

            <!-- Notification dropdown panel -->
            <Transition name="notif">
              <div
                v-if="notifOpen"
                class="fixed left-3 right-3 top-16 sm:absolute sm:left-auto sm:right-0 sm:top-full sm:mt-2.5 sm:w-96 max-h-[85vh] rounded-2xl bg-card border border-border shadow-2xl flex flex-col z-50 overflow-hidden"
              >
                <!-- Header -->
                <div class="px-4 py-3 border-b border-border flex items-center justify-between bg-muted/30">
                  <div class="flex items-center gap-2">
                    <BellRing class="h-4 w-4 text-success" />
                    <span class="font-semibold text-sm">Kitchen Ready</span>
                  </div>
                  <div class="flex items-center gap-2">
                    <span v-if="readyOrders.length > 0" class="text-xs font-bold text-success bg-success/10 px-2 py-0.5 rounded-full">
                      {{ readyOrders.length }} waiting
                    </span>
                    <button
                      @click="notifOpen = false"
                      class="text-muted-foreground hover:text-foreground text-xs p-1"
                    >
                      <X class="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <!-- Empty state -->
                <div v-if="readyOrders.length === 0" class="p-8 text-center text-muted-foreground">
                  <CheckCircle2 class="h-8 w-8 mx-auto mb-2 opacity-30 text-success" />
                  <p class="text-sm font-medium">All clear!</p>
                  <p class="text-xs mt-0.5">No orders waiting in kitchen.</p>
                </div>

                <!-- Order cards -->
                <div v-else class="max-h-[380px] overflow-y-auto divide-y divide-border">
                  <div
                    v-for="o in readyOrders"
                    :key="o.id || o._id"
                    class="p-3 hover:bg-muted/30 transition group"
                  >
                    <div class="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <div class="font-display text-base font-bold leading-none">Table {{ o.tableNumber }}</div>
                        <div class="text-[10px] font-mono text-muted-foreground mt-0.5 flex items-center gap-1">
                          <Clock class="h-2.5 w-2.5" />{{ formatTime(o.createdAt) }}
                        </div>
                      </div>
                      <span class="shrink-0 px-2 py-0.5 rounded-full bg-success/10 text-success border border-success/20 text-[10px] font-bold uppercase animate-pulse">
                        READY
                      </span>
                    </div>
                    <div class="text-xs text-muted-foreground mb-2.5 line-clamp-2">
                      {{ (o.items || []).map((it: any) => `${it.qty}× ${it.name}`).join(', ') }}
                    </div>
                    <button
                      @click="serveOrder(o.id || o._id, o.tableNumber)"
                      class="w-full h-8 rounded-lg gradient-success text-success-foreground text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm hover:opacity-90 transition"
                    >
                      <CheckCircle2 class="h-3.5 w-3.5" />
                      Mark as Served
                    </button>
                  </div>
                </div>
              </div>
            </Transition>
          </div>

          <!-- Bell for non-waiter roles (static) -->
          <Button v-else variant="ghost" size="icon" class="h-9 w-9 relative">
            <Bell class="h-4 w-4" />
          </Button>

          <!-- User dropdown -->
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button class="flex items-center gap-2 pl-1.5 pr-2.5 py-1 rounded-full hover:bg-muted transition">
                <div class="h-7 w-7 rounded-full gradient-primary grid place-items-center font-semibold text-primary-foreground text-xs">
                  {{ auth.user.name[0] }}
                </div>
                <ChevronDown class="h-3 w-3 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" class="w-60">
              <DropdownMenuLabel>
                <div class="font-medium">{{ auth.user.name }}</div>
                <div class="text-xs text-muted-foreground font-normal">{{ auth.user.email }}</div>
                <Badge variant="secondary" class="mt-2 font-normal">{{ ROLE_LABELS[role] }}</Badge>
              </DropdownMenuLabel>

              <!-- Mobile Appearance & Language Settings -->
              <div class="sm:hidden">
                <DropdownMenuSeparator />
                
                <template v-if="!showMobileLanguageMenu">
                  <DropdownMenuItem @select.prevent="dark = !dark">
                    <Moon v-if="!dark" class="h-4 w-4 mr-2" />
                    <Sun v-else class="h-4 w-4 mr-2" />
                    {{ dark ? 'Light Mode' : 'Dark Mode' }}
                  </DropdownMenuItem>
                  
                  <DropdownMenuItem @select.prevent="showMobileLanguageMenu = true" class="justify-between">
                    <span class="flex items-center"><Globe class="h-4 w-4 mr-2" /> Language</span>
                    <ChevronDown class="h-4 w-4 -rotate-90 text-muted-foreground" />
                  </DropdownMenuItem>
                </template>

                <template v-else>
                  <DropdownMenuItem @select.prevent="showMobileLanguageMenu = false" class="text-muted-foreground font-semibold">
                    <ChevronDown class="h-4 w-4 rotate-90 mr-2" /> Back
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem @select="changeLanguage('en')" class="justify-between pl-8">
                    <span class="flex items-center gap-2">English</span> <span class="text-lg leading-none">🇬🇧</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem @select="changeLanguage('hi')" class="justify-between pl-8">
                    <span class="flex items-center gap-2">हिन्दी</span> <span class="text-lg leading-none">🇮🇳</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem @select="changeLanguage('gu')" class="justify-between pl-8">
                    <span class="flex items-center gap-2">ગુજરાતી</span> <span class="text-lg leading-none">🇮🇳</span>
                  </DropdownMenuItem>
                </template>
              </div>

              <DropdownMenuSeparator />
              <DropdownMenuItem @select="router.push('/profile')">
                <UserIcon class="h-4 w-4 mr-2" /> Profile
              </DropdownMenuItem>
              <DropdownMenuItem @select="handleLogout" class="text-destructive">
                <LogOut class="h-4 w-4 mr-2" /> Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <!-- Main Admin Venue Inspection Banner -->
      <div
        v-if="isInspecting"
        class="bg-gradient-to-r from-amber-500/15 via-primary/10 to-amber-500/15 border-b border-amber-500/30 px-4 py-2.5 flex items-center justify-between gap-3 text-xs font-semibold"
      >
        <div class="flex items-center gap-2 text-amber-800 dark:text-amber-300">
          <span class="flex h-2.5 w-2.5 rounded-full bg-amber-500 animate-ping" />
          <span>👁️ Inspecting Venue as Master Admin: <strong class="text-foreground">{{ displayBrand }}</strong> (Full Restaurant Admin Access)</span>
        </div>
        <button
          @click="() => { auth.setInspectedRestaurant(null); router.push('/admin/restaurants') }"
          class="px-3 py-1 rounded-xl bg-card hover:bg-background border border-border text-foreground hover:border-primary/50 text-xs font-bold transition cursor-pointer shadow-xs"
        >
          ← Exit to Main Admin
        </button>
      </div>

      <main class="flex-1 p-4 lg:p-6 animate-fade-in"><slot /></main>
    </div>

    <!-- Sign-out Confirmation Dialog -->
    <AlertDialog :open="showLogoutConfirm" @update:open="showLogoutConfirm = $event">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you sure you want to sign out?</AlertDialogTitle>
          <AlertDialogDescription>
            You will be returned to the login screen and will need to authenticate again to access the dashboard.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel @click="showLogoutConfirm = false">No, Cancel</AlertDialogCancel>
          <AlertDialogAction variant="destructive" @click="executeLogout">
            Yes, Sign Out
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

  </div>
</template>

<style scoped>
.notif-enter-active,
.notif-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}
.notif-enter-from,
.notif-leave-to {
  opacity: 0;
  transform: translateY(-6px) scale(0.97);
}

@keyframes bell {
  from { transform: rotate(-12deg); }
  to   { transform: rotate(12deg); }
}
</style>
