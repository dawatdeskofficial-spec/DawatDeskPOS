<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore, ROLE_LABELS, ROLE_HOMES, type AppRole } from '@/stores/auth'
import { getRestaurantById, getOrders, updateOrderStatus } from '@/lib/api'
import { consolidateOrderItems } from '@/lib/utils'
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

import OfflineBanner from '@/components/mobile/OfflineBanner.vue'
import AppHeader from '@/components/mobile/AppHeader.vue'
import BottomNavigation from '@/components/mobile/BottomNavigation.vue'
import SideDrawer from '@/components/mobile/SideDrawer.vue'
import DawatDeskLogo from '@/components/DawatDeskLogo.vue'

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
  activeTab?: string
}>(), {
  brand: 'DawatDesk'
})

const emit = defineEmits<{
  (e: 'tabChange', tab: string): void
}>()

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
        // Trigger toast only if not on /waiter (waiter/index.vue handles its own rich audio & toast on /waiter)
        if (route.path !== '/waiter') {
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
      }
    })

    // Update seen set to current ready order IDs
    seenReadyIds.value = new Set(fresh.map((o: any) => String(o.id || o._id)))
    readyOrders.value = fresh
  } catch {
    // silent fail
  }
}

const servingNotifIds = ref<Record<string, 'serving' | 'served'>>({})

async function serveOrder(orderId: string, tableNumber: number) {
  const idStr = String(orderId)
  if (servingNotifIds.value[idStr]) return
  servingNotifIds.value[idStr] = 'serving'

  try {
    await updateOrderStatus(orderId, 'SERVED')
    servingNotifIds.value[idStr] = 'served'

    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try { navigator.vibrate([25, 40, 25]) } catch {}
    }
    toast.success(`✓ Table ${tableNumber} marked as served!`)

    setTimeout(() => {
      readyOrders.value = readyOrders.value.filter(
        (o: any) => String(o.id || o._id) !== orderId
      )
      seenReadyIds.value.delete(orderId)
      delete servingNotifIds.value[idStr]
      if (readyOrders.value.length === 0) hasNewNotif.value = false
    }, 450)
  } catch (err: any) {
    delete servingNotifIds.value[idStr]
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

  // Fast path: use already populated restaurant name from login/auth payload
  if (typeof user.restaurantId === 'object' && (user.restaurantId as any)?.name) {
    restaurantName.value = String((user.restaurantId as any).name)
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

  // Start notification polling for waiters so the top bar bell icon & drawer stay updated
  if (isWaiter.value) {
    pollReadyOrders()
    notifInterval = setInterval(pollReadyOrders, 4000)
  }

  // Close drawer on navigation
  watch(() => route.path, () => {
    open.value = false
  })
})

onUnmounted(() => {
  clearInterval(notifInterval)
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
  if (val && route.path !== '/waiter') {
    pollReadyOrders()
    notifInterval = setInterval(pollReadyOrders, 5000)
  }
})



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
        <router-link to="/" class="flex items-center">
          <DawatDeskLogo variant="auto" size="md" />
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

    <!-- Mobile Side Drawer (Production Mobile Experience) -->
    <SideDrawer
      :open="open"
      :brand="displayBrand"
      :role="role"
      :role-label="effectiveRoleLabel"
      :user="auth.user"
      :dark="dark"
      :is-inspecting="isInspecting"
      @close="open = false"
      @toggle-dark="dark = !dark"
      @logout="handleLogout"
    />

    <!-- Main -->
    <div class="flex-1 flex flex-col min-w-0">
      <!-- Mobile App Header (Visible on screens < lg) -->
      <div class="lg:hidden relative">
        <AppHeader
          :brand="displayBrand"
          :role="role"
          :role-label="effectiveRoleLabel"
          :user="auth.user"
          :ready-count="readyOrders.length"
          :has-new-notif="hasNewNotif"
          :is-inspecting="isInspecting"
          @open-drawer="open = true"
          @open-notif="openNotifPanel"
          @open-profile="router.push('/profile')"
          @logout="handleLogout"
        />
        <OfflineBanner />

        <!-- Mobile Click-outside backdrop -->
        <div
          v-if="notifOpen"
          class="fixed inset-0 z-40"
          @click="notifOpen = false"
        />

        <!-- Mobile Notification Dropdown Box -->
        <Transition name="notif">
          <div
            v-if="notifOpen"
            class="fixed right-3 top-16 w-80 max-w-[calc(100vw-1.5rem)] max-h-[80vh] rounded-2xl bg-card border border-border shadow-2xl flex flex-col z-50 overflow-hidden"
          >
            <!-- Header -->
            <div class="px-3.5 py-2.5 border-b border-border flex items-center justify-between bg-muted/40">
              <div class="flex items-center gap-1.5">
                <BellRing class="h-3.5 w-3.5 text-primary" />
                <span class="font-bold text-xs uppercase tracking-wider text-foreground">Notifications</span>
              </div>
              <div class="flex items-center gap-1.5">
                <span v-if="readyOrders.length > 0" class="text-[9.5px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-md border border-emerald-500/20">
                  {{ readyOrders.length }} Ready
                </span>
                <span v-else class="text-[10px] font-semibold text-muted-foreground flex items-center gap-1">
                  <span class="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Synced
                </span>
                <button
                  @click="notifOpen = false"
                  class="text-muted-foreground hover:text-foreground text-xs p-1 rounded-md hover:bg-muted cursor-pointer"
                >
                  <X class="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            <!-- Content -->
            <div class="max-h-[360px] overflow-y-auto divide-y divide-border">
              <!-- Ready orders for Waiters -->
              <template v-if="isWaiter && readyOrders.length > 0">
                <div
                  v-for="o in readyOrders"
                  :key="o.id || o._id"
                  class="p-3 hover:bg-muted/20 transition group space-y-1.5"
                >
                  <div class="flex items-center justify-between gap-1.5">
                    <div class="flex items-center gap-1.5 min-w-0">
                      <span class="font-display text-xs font-bold text-foreground">Table {{ o.tableNumber }}</span>
                      <span class="text-[10px] text-muted-foreground flex items-center gap-0.5">
                        <Clock class="h-2.5 w-2.5" />{{ formatTime(o.createdAt) }}
                      </span>
                    </div>
                    <span class="shrink-0 px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[9px] font-black uppercase">
                      Ready
                    </span>
                  </div>
                  <div class="text-[11px] text-muted-foreground line-clamp-1 leading-snug">
                    {{ consolidateOrderItems(o.items).map((it: any) => `${it.qty}× ${it.name}`).join(', ') }}
                  </div>
                  <div class="flex items-center justify-end pt-0.5">
                    <button
                      @click="serveOrder(o.id || o._id, o.tableNumber)"
                      :disabled="servingNotifIds[String(o.id || o._id)] !== undefined"
                      :class="[
                        'h-7 px-3 rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-all duration-300 select-none active:scale-95',
                        servingNotifIds[String(o.id || o._id)] === 'served'
                          ? 'bg-emerald-500 text-white scale-105 ring-2 ring-emerald-400/40 shadow-xs'
                          : servingNotifIds[String(o.id || o._id)] === 'serving'
                          ? 'bg-emerald-700 text-white cursor-wait'
                          : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs'
                      ]"
                    >
                      <CheckCircle2 class="h-3 w-3" />
                      <span>{{ servingNotifIds[String(o.id || o._id)] === 'served' ? '✓ Served!' : 'Mark as Served' }}</span>
                    </button>
                  </div>
                </div>
              </template>

              <!-- General Status / Empty State -->
              <div v-else class="p-6 text-center text-muted-foreground space-y-1.5">
                <div class="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center mx-auto mb-1.5">
                  <CheckCircle2 class="h-4.5 w-4.5 text-primary" />
                </div>
                <p class="text-xs font-bold text-foreground">All Caught Up</p>
                <p class="text-[11px] text-muted-foreground max-w-[220px] mx-auto">No pending kitchen orders or alerts.</p>
              </div>
            </div>
          </div>
        </Transition>
      </div>

      <!-- Desktop Header (Visible on large screens / desktops) -->
      <header class="hidden lg:flex h-16 border-b border-border items-center justify-between gap-2 px-6 bg-card/80 backdrop-blur-md sticky top-0 z-50">
        <!-- Left: Brand / Title -->
        <div class="flex items-center gap-2.5 min-w-0 flex-1">
          <router-link v-if="role === 'waiter'" to="/" class="flex items-center mr-1 shrink-0">
            <DawatDeskLogo variant="auto" size="sm" :icon-only="true" />
          </router-link>
          <!-- Breadcrumbs (Visible when Sidebar is present) -->
          <div class="flex items-center gap-2 text-sm font-medium text-muted-foreground ml-2 select-none">
            <span class="text-foreground/40 font-semibold uppercase tracking-wider text-[11px]">{{ displayBrand }}</span>
            <span class="text-foreground/20">/</span>
            <span class="text-foreground font-semibold">{{ breadcrumbs.map(c => c.label).join(' / ') }}</span>
          </div>
        </div>

        <div class="flex items-center gap-1 sm:gap-2 shrink-0">
          <div class="hidden sm:block">
            <LanguageSwitcher />
          </div>

          <Button variant="ghost" size="icon" class="hidden sm:flex h-8 w-8 sm:h-9 sm:w-9" @click="dark = !dark">
            <Sun v-if="dark" class="h-4 w-4" />
            <Moon v-else class="h-4 w-4" />
          </Button>

          <!-- ── Bell Notification Dropdown (All roles) ───────────────────────────── -->
          <div class="relative">
            <button
              @click="openNotifPanel"
              :class="['relative h-9 w-9 rounded-xl flex items-center justify-center transition cursor-pointer', notifOpen ? 'bg-primary/10 text-primary' : 'hover:bg-muted text-foreground']"
              title="Notifications"
              aria-label="Kitchen and system notifications"
            >
              <BellRing v-if="hasNewNotif || readyOrders.length > 0" class="h-4 w-4 text-emerald-500 animate-[bell_0.5s_ease-in-out_infinite_alternate]" />
              <Bell v-else class="h-4 w-4 text-muted-foreground" />
              <!-- Red badge count -->
              <span
                v-if="readyOrders.length > 0"
                class="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center ring-2 ring-card shadow-xs"
              >
                {{ readyOrders.length }}
              </span>
            </button>

            <!-- Click-outside backdrop -->
            <div
              v-if="notifOpen"
              class="fixed inset-0 z-40"
              @click="notifOpen = false"
            />

            <!-- Desktop Notification Dropdown Box -->
            <Transition name="notif">
              <div
                v-if="notifOpen"
                class="absolute right-0 top-full mt-2 w-80 max-h-[80vh] rounded-2xl bg-card border border-border shadow-2xl flex flex-col z-50 overflow-hidden"
              >
                <!-- Header -->
                <div class="px-3.5 py-2.5 border-b border-border flex items-center justify-between bg-muted/40">
                  <div class="flex items-center gap-1.5">
                    <BellRing class="h-3.5 w-3.5 text-primary" />
                    <span class="font-bold text-xs uppercase tracking-wider text-foreground">Notifications</span>
                  </div>
                  <div class="flex items-center gap-1.5">
                    <span v-if="readyOrders.length > 0" class="text-[9.5px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-md border border-emerald-500/20">
                      {{ readyOrders.length }} Ready
                    </span>
                    <span v-else class="text-[10px] font-semibold text-muted-foreground flex items-center gap-1">
                      <span class="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Synced
                    </span>
                    <button
                      @click="notifOpen = false"
                      class="text-muted-foreground hover:text-foreground text-xs p-1 rounded-md hover:bg-muted cursor-pointer"
                    >
                      <X class="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                <!-- Content -->
                <div class="max-h-[360px] overflow-y-auto divide-y divide-border">
                  <!-- Ready orders for Waiters -->
                  <template v-if="isWaiter && readyOrders.length > 0">
                    <div
                      v-for="o in readyOrders"
                      :key="o.id || o._id"
                      class="p-3 hover:bg-muted/20 transition group space-y-1.5"
                    >
                      <div class="flex items-center justify-between gap-1.5">
                        <div class="flex items-center gap-1.5 min-w-0">
                          <span class="font-display text-xs font-bold text-foreground">Table {{ o.tableNumber }}</span>
                          <span class="text-[10px] text-muted-foreground flex items-center gap-0.5">
                            <Clock class="h-2.5 w-2.5" />{{ formatTime(o.createdAt) }}
                          </span>
                        </div>
                        <span class="shrink-0 px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[9px] font-black uppercase">
                          Ready
                        </span>
                      </div>
                      <div class="text-[11px] text-muted-foreground line-clamp-1 leading-snug">
                        {{ consolidateOrderItems(o.items).map((it: any) => `${it.qty}× ${it.name}`).join(', ') }}
                      </div>
                      <div class="flex items-center justify-end pt-0.5">
                        <button
                          @click="serveOrder(o.id || o._id, o.tableNumber)"
                          class="h-7 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-[11px] font-bold flex items-center gap-1 shadow-2xs cursor-pointer transition"
                        >
                          <CheckCircle2 class="h-3 w-3" />
                          <span>Mark as Served</span>
                        </button>
                      </div>
                    </div>
                  </template>

                  <!-- General Status / Empty State -->
                  <div v-else class="p-6 text-center text-muted-foreground space-y-1.5">
                    <div class="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center mx-auto mb-1.5">
                      <CheckCircle2 class="h-4.5 w-4.5 text-primary" />
                    </div>
                    <p class="text-xs font-bold text-foreground">All Caught Up</p>
                    <p class="text-[11px] text-muted-foreground max-w-[220px] mx-auto">No pending kitchen orders or alerts.</p>
                  </div>
                </div>
              </div>
            </Transition>
          </div>

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

      <main class="flex-1 p-3.5 sm:p-4 lg:p-6 pb-24 lg:pb-6 animate-fade-in"><slot /></main>
    </div>

    <!-- Mobile Role-Personalized Bottom Navigation Bar -->
    <BottomNavigation
      :role="role"
      :is-inspecting="isInspecting"
      :active-tab="activeTab"
      :ready-count="readyOrders.length"
      @select-tab="$emit('tabChange', $event)"
      @open-drawer="open = true"
    />

    <!-- Sign-out Confirmation Dialog -->
    <AlertDialog :open="showLogoutConfirm" @update:open="showLogoutConfirm = $event">
      <AlertDialogContent class="sm:max-w-md p-6 rounded-3xl border border-border shadow-2xl bg-card overflow-hidden relative">
        <!-- Top decorative ambient accent bar -->
        <div class="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-rose-500 via-amber-500 to-rose-500" />

        <div class="flex flex-col items-center text-center pt-2">
          <!-- Icon Badge -->
          <div class="h-14 w-14 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center mb-3.5 shadow-xs">
            <LogOut class="h-7 w-7" />
          </div>

          <AlertDialogHeader class="space-y-1 text-center sm:text-center">
            <AlertDialogTitle class="text-lg font-display font-bold text-foreground">
              Sign Out of DawatDesk?
            </AlertDialogTitle>
            <AlertDialogDescription class="text-xs text-muted-foreground leading-relaxed max-w-xs mx-auto">
              Are you sure you want to end your current session? You will need to log in again to access the platform.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <!-- Current User Session Card Preview -->
          <div class="w-full p-3 mt-4 rounded-2xl bg-muted/40 border border-border/70 flex items-center gap-3 text-left">
            <div class="h-10 w-10 rounded-xl gradient-primary text-primary-foreground flex items-center justify-center font-bold text-sm shrink-0 shadow-xs">
              {{ (auth.user?.name || (auth.user as any)?.username || 'U').charAt(0).toUpperCase() }}
            </div>
            <div class="min-w-0 flex-1">
              <div class="flex items-center justify-between gap-1">
                <span class="font-bold text-xs text-foreground truncate">
                  {{ auth.user?.name || (auth.user as any)?.username || 'Current User' }}
                </span>
                <span class="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 shrink-0">
                  <span class="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Active
                </span>
              </div>
              <div class="text-[11px] text-muted-foreground truncate mt-0.5">
                {{ effectiveRoleLabel }} · {{ displayBrand }}
              </div>
            </div>
          </div>
        </div>

        <AlertDialogFooter class="gap-2 sm:gap-2 pt-3 flex flex-col-reverse sm:flex-row w-full sm:justify-end">
          <AlertDialogCancel
            @click="showLogoutConfirm = false"
            class="h-9 rounded-xl text-xs font-semibold px-4 cursor-pointer hover:bg-muted"
          >
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            @click="executeLogout"
            class="h-9 rounded-xl text-xs font-bold px-4 bg-destructive text-destructive-foreground hover:bg-destructive/90 gap-1.5 cursor-pointer shadow-xs"
          >
            <LogOut class="h-3.5 w-3.5" />
            <span>Yes, Sign Out</span>
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
