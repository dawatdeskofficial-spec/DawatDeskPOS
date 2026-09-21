<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import {
  X, LogOut, Sun, Moon, Globe, Shield, Building2, User as UserIcon,
  ChevronRight, Sparkles, UtensilsCrossed, Table2, ShoppingBag, ChefHat,
  Receipt, Users, BarChart3, Settings, ShieldAlert, FileText, Check
} from 'lucide-vue-next'
import { useAuthStore, ROLE_LABELS, type AppRole } from '@/stores/auth'
import DawatDeskLogo from '@/components/DawatDeskLogo.vue'

const props = defineProps<{
  open: boolean
  brand: string
  role: AppRole
  roleLabel: string
  user: any
  dark: boolean
  isInspecting?: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'update:open', val: boolean): void
  (e: 'toggleDark'): void
  (e: 'logout'): void
}>()

const auth = useAuthStore()
const router = useRouter()
const route = useRoute()

const showLanguageSelector = ref(false)

interface DrawerLink {
  to: string
  label: string
  icon: any
}

const operationsLinks = computed<DrawerLink[]>(() => {
  const links: DrawerLink[] = []
  const r = props.role

  if (r === 'waiter') {
    links.push({ to: '/waiter', label: 'Take Order & Floor', icon: Table2 })
  } else if (r === 'chef') {
    links.push({ to: '/chef', label: 'Kitchen Display (KOT)', icon: ChefHat })
  } else if (r === 'cashier') {
    links.push({ to: '/cashier', label: 'Billing & POS Cashier', icon: Receipt })
  } else if (r === 'restaurant_admin' || props.isInspecting) {
    links.push({ to: '/restaurant/dashboard', label: 'Operations Dashboard', icon: Sparkles })
    links.push({ to: '/restaurant/tables', label: 'Floor & Tables', icon: Table2 })
    links.push({ to: '/restaurant/orders', label: 'Live Orders', icon: ShoppingBag })
    links.push({ to: '/waiter', label: 'Waiter Order POS', icon: UtensilsCrossed })
    links.push({ to: '/chef', label: 'Kitchen Display', icon: ChefHat })
    links.push({ to: '/cashier', label: 'Cashier & Billing', icon: Receipt })
  } else if (r === 'main_admin') {
    links.push({ to: '/admin/dashboard', label: 'System Dashboard', icon: Sparkles })
    links.push({ to: '/admin/restaurants', label: 'Restaurant Branches', icon: Building2 })
  }
  return links
})

const managementLinks = computed<DrawerLink[]>(() => {
  const links: DrawerLink[] = []
  const r = props.role

  if (r === 'restaurant_admin' || props.isInspecting) {
    links.push({ to: '/restaurant/menu', label: 'Menu & Dishes', icon: UtensilsCrossed })
    links.push({ to: '/restaurant/staff', label: 'Staff Management', icon: Users })
    links.push({ to: '/restaurant/reports', label: 'Sales Analytics & Reports', icon: BarChart3 })
  } else if (r === 'main_admin') {
    links.push({ to: '/admin/users', label: 'User & Staff Directory', icon: Users })
    links.push({ to: '/admin/reports', label: 'System Reports', icon: FileText })
    links.push({ to: '/admin/logs', label: 'Security & Audit Logs', icon: ShieldAlert })
  }
  return links
})

function navigateTo(path: string) {
  emit('close')
  router.push(path)
}

function changeLanguage(code: string) {
  if (code === 'en') {
    document.cookie = 'googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;'
    document.cookie = 'googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=' + window.location.hostname + ';'
  } else {
    document.cookie = `googtrans=/en/${code}; path=/;`
  }
  window.location.href = '/'
}
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div
        v-if="open"
        class="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex lg:hidden"
        @click.self="$emit('close')"
      >
        <Transition name="slide-right">
          <div
            v-if="open"
            class="w-80 max-w-[85vw] h-full bg-card border-r border-border shadow-2xl flex flex-col overflow-hidden"
            @click.stop
          >
            <!-- Header with Profile Snapshot -->
            <div class="p-5 border-b border-border bg-muted/20 shrink-0">
              <div class="flex items-center justify-between mb-4">
                <div class="flex items-center">
                  <DawatDeskLogo variant="auto" size="sm" />
                </div>
                <button
                  type="button"
                  @click="$emit('close')"
                  class="h-8 w-8 rounded-xl bg-muted/60 hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer transition"
                >
                  <X class="h-4 w-4" />
                </button>
              </div>

              <!-- User details card -->
              <div class="flex items-center gap-3 p-3 rounded-2xl bg-card border border-border shadow-xs">
                <div class="h-11 w-11 rounded-2xl gradient-primary grid place-items-center font-bold text-primary-foreground text-sm shadow-xs shrink-0">
                  {{ user?.name?.[0]?.toUpperCase() || 'U' }}
                </div>
                <div class="min-w-0 flex-1">
                  <div class="text-sm font-bold truncate text-foreground">{{ user?.name }}</div>
                  <div class="text-xs text-muted-foreground truncate">{{ user?.email }}</div>
                  <div class="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary/10 text-primary uppercase">
                    <Shield class="h-3 w-3" />
                    <span>{{ roleLabel }}</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Scrollable Navigation Items -->
            <div class="flex-1 overflow-y-auto p-4 space-y-5">
              <!-- OPERATIONS SECTION -->
              <div v-if="operationsLinks.length > 0" class="space-y-1">
                <div class="px-3 text-[10px] font-black uppercase tracking-wider text-muted-foreground/70 mb-1.5">
                  Operations
                </div>
                <button
                  v-for="item in operationsLinks"
                  :key="item.to"
                  type="button"
                  @click="navigateTo(item.to)"
                  :class="[
                    'w-full flex items-center justify-between p-2.5 rounded-xl text-left transition cursor-pointer text-xs font-semibold',
                    route.path === item.to || (item.to !== '/' && route.path.startsWith(item.to))
                      ? 'bg-primary/10 text-primary font-bold'
                      : 'text-foreground hover:bg-muted/50'
                  ]"
                >
                  <div class="flex items-center gap-3">
                    <component :is="item.icon" class="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span>{{ item.label }}</span>
                  </div>
                  <ChevronRight class="h-3.5 w-3.5 text-muted-foreground/50" />
                </button>
              </div>

              <!-- MANAGEMENT SECTION -->
              <div v-if="managementLinks.length > 0" class="space-y-1">
                <div class="px-3 text-[10px] font-black uppercase tracking-wider text-muted-foreground/70 mb-1.5">
                  Management
                </div>
                <button
                  v-for="item in managementLinks"
                  :key="item.to"
                  type="button"
                  @click="navigateTo(item.to)"
                  :class="[
                    'w-full flex items-center justify-between p-2.5 rounded-xl text-left transition cursor-pointer text-xs font-semibold',
                    route.path === item.to || (item.to !== '/' && route.path.startsWith(item.to))
                      ? 'bg-primary/10 text-primary font-bold'
                      : 'text-foreground hover:bg-muted/50'
                  ]"
                >
                  <div class="flex items-center gap-3">
                    <component :is="item.icon" class="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span>{{ item.label }}</span>
                  </div>
                  <ChevronRight class="h-3.5 w-3.5 text-muted-foreground/50" />
                </button>
              </div>

              <!-- SYSTEM & SETTINGS SECTION -->
              <div class="space-y-1">
                <div class="px-3 text-[10px] font-black uppercase tracking-wider text-muted-foreground/70 mb-1.5">
                  System &amp; Preferences
                </div>

                <button
                  type="button"
                  @click="navigateTo('/profile')"
                  class="w-full flex items-center justify-between p-2.5 rounded-xl text-left hover:bg-muted/50 transition cursor-pointer text-xs font-semibold text-foreground"
                >
                  <div class="flex items-center gap-3">
                    <UserIcon class="h-4 w-4 text-muted-foreground" />
                    <span>My Profile</span>
                  </div>
                  <ChevronRight class="h-3.5 w-3.5 text-muted-foreground/50" />
                </button>

                <!-- Dark mode toggle -->
                <button
                  type="button"
                  @click="$emit('toggleDark')"
                  class="w-full flex items-center justify-between p-2.5 rounded-xl text-left hover:bg-muted/50 transition cursor-pointer text-xs font-semibold text-foreground"
                >
                  <div class="flex items-center gap-3">
                    <Sun v-if="dark" class="h-4 w-4 text-amber-500" />
                    <Moon v-else class="h-4 w-4 text-indigo-500" />
                    <span>{{ dark ? 'Switch to Light Mode' : 'Switch to Dark Mode' }}</span>
                  </div>
                  <span class="text-[10px] font-bold text-muted-foreground">{{ dark ? 'Dark' : 'Light' }}</span>
                </button>

                <!-- Language Selector Toggle -->
                <div>
                  <button
                    type="button"
                    @click="showLanguageSelector = !showLanguageSelector"
                    class="w-full flex items-center justify-between p-2.5 rounded-xl text-left hover:bg-muted/50 transition cursor-pointer text-xs font-semibold text-foreground"
                  >
                    <div class="flex items-center gap-3">
                      <Globe class="h-4 w-4 text-muted-foreground" />
                      <span>Language / ભાષા / भाषा</span>
                    </div>
                    <ChevronRight :class="['h-3.5 w-3.5 text-muted-foreground/50 transition-transform', showLanguageSelector ? 'rotate-90' : '']" />
                  </button>

                  <div v-if="showLanguageSelector" class="pl-9 pr-2 py-1 space-y-1 bg-muted/20 rounded-xl mt-1">
                    <button
                      type="button"
                      @click="changeLanguage('en')"
                      class="w-full flex items-center justify-between py-2 text-xs font-semibold text-foreground hover:text-primary cursor-pointer"
                    >
                      <span>English 🇬🇧</span>
                    </button>
                    <button
                      type="button"
                      @click="changeLanguage('hi')"
                      class="w-full flex items-center justify-between py-2 text-xs font-semibold text-foreground hover:text-primary cursor-pointer border-t border-border/50"
                    >
                      <span>हिन्दी (Hindi) 🇮🇳</span>
                    </button>
                    <button
                      type="button"
                      @click="changeLanguage('gu')"
                      class="w-full flex items-center justify-between py-2 text-xs font-semibold text-foreground hover:text-primary cursor-pointer border-t border-border/50"
                    >
                      <span>ગુજરાતી (Gujarati) 🇮🇳</span>
                    </button>
                  </div>
                </div>

                <!-- Admin settings link if main admin -->
                <button
                  v-if="role === 'main_admin'"
                  type="button"
                  @click="navigateTo('/admin/settings')"
                  class="w-full flex items-center justify-between p-2.5 rounded-xl text-left hover:bg-muted/50 transition cursor-pointer text-xs font-semibold text-foreground"
                >
                  <div class="flex items-center gap-3">
                    <Settings class="h-4 w-4 text-muted-foreground" />
                    <span>Platform Settings</span>
                  </div>
                  <ChevronRight class="h-3.5 w-3.5 text-muted-foreground/50" />
                </button>
              </div>
            </div>

            <!-- Footer: Logout -->
            <div class="p-4 border-t border-border bg-card/90 shrink-0">
              <button
                type="button"
                @click="$emit('logout')"
                class="w-full h-11 rounded-2xl bg-destructive/10 hover:bg-destructive/15 text-destructive font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition active:scale-95"
              >
                <LogOut class="h-4 w-4" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.slide-right-enter-active,
.slide-right-leave-active {
  transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}
.slide-right-enter-from,
.slide-right-leave-to {
  transform: translateX(-100%);
}
</style>
