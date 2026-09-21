<script setup lang="ts">
import { computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import {
  Table2, ClipboardList, BellRing, Clock, ChefHat, PackageX, CheckCircle,
  Receipt, Users, ShoppingBag, LayoutDashboard, UtensilsCrossed, Building2,
  FileText, MoreHorizontal
} from 'lucide-vue-next'
import type { AppRole } from '@/stores/auth'

const props = defineProps<{
  role: AppRole
  isInspecting?: boolean
  activeTab?: string
  readyCount?: number
}>()

const emit = defineEmits<{
  (e: 'selectTab', tab: string): void
  (e: 'openDrawer'): void
}>()

const router = useRouter()
const route = useRoute()

interface BottomItem {
  id: string
  label: string
  icon: any
  to?: string
  tab?: string
  badge?: number
}

const items = computed<BottomItem[]>(() => {
  if (props.isInspecting) {
    return [
      { id: 'dashboard', label: 'Dashboard', to: '/restaurant/dashboard', icon: LayoutDashboard },
      { id: 'orders', label: 'Orders', to: '/restaurant/orders', icon: ShoppingBag },
      { id: 'tables', label: 'Tables', to: '/restaurant/tables', icon: Table2 },
      { id: 'menu', label: 'Menu', to: '/restaurant/menu', icon: UtensilsCrossed },
      { id: 'more', label: 'More', icon: MoreHorizontal }
    ]
  }

  switch (props.role) {
    case 'waiter':
      return [
        { id: 'floor', label: 'Tables', tab: 'floor', to: '/waiter', icon: Table2 },
        { id: 'take_order', label: 'Take Order', tab: 'take_order', to: '/waiter', icon: ClipboardList },
        { id: 'ready_orders', label: 'Ready', tab: 'ready_orders', to: '/waiter', icon: BellRing, badge: props.readyCount },
        { id: 'history', label: 'History', tab: 'history', to: '/waiter', icon: Clock },
        { id: 'more', label: 'More', icon: MoreHorizontal }
      ]
    case 'chef':
      return [
        { id: 'active', label: 'KOTs', tab: 'active', to: '/chef', icon: ChefHat },
        { id: 'availability', label: 'Item 86', tab: 'availability', to: '/chef', icon: PackageX },
        { id: 'completed', label: 'Done', tab: 'completed', to: '/chef', icon: CheckCircle },
        { id: 'more', label: 'More', icon: MoreHorizontal }
      ]
    case 'cashier':
      return [
        { id: 'billing', label: 'Bills', tab: 'billing', to: '/cashier', icon: Receipt },
        { id: 'queue', label: 'Queue', tab: 'queue', to: '/cashier', icon: Users },
        { id: 'history', label: 'History', tab: 'history', to: '/cashier', icon: Clock },
        { id: 'parcel', label: 'Takeaway', tab: 'parcel', to: '/cashier', icon: ShoppingBag },
        { id: 'more', label: 'More', icon: MoreHorizontal }
      ]
    case 'restaurant_admin':
      return [
        { id: 'dashboard', label: 'Home', to: '/restaurant/dashboard', icon: LayoutDashboard },
        { id: 'orders', label: 'Orders', to: '/restaurant/orders', icon: ShoppingBag },
        { id: 'tables', label: 'Tables', to: '/restaurant/tables', icon: Table2 },
        { id: 'menu', label: 'Menu', to: '/restaurant/menu', icon: UtensilsCrossed },
        { id: 'more', label: 'More', icon: MoreHorizontal }
      ]
    case 'main_admin':
      return [
        { id: 'dashboard', label: 'Home', to: '/admin/dashboard', icon: LayoutDashboard },
        { id: 'restaurants', label: 'Venues', to: '/admin/restaurants', icon: Building2 },
        { id: 'users', label: 'Users', to: '/admin/users', icon: Users },
        { id: 'reports', label: 'Reports', to: '/admin/reports', icon: FileText },
        { id: 'more', label: 'More', icon: MoreHorizontal }
      ]
    default:
      return [
        { id: 'more', label: 'More', icon: MoreHorizontal }
      ]
  }
})

function isItemActive(item: BottomItem): boolean {
  if (item.id === 'more') return false
  if (item.tab && props.activeTab) {
    return props.activeTab === item.tab && route.path === item.to
  }
  if (item.to) {
    return route.path === item.to || (item.to !== '/' && route.path.startsWith(item.to))
  }
  return false
}

function handleClick(item: BottomItem) {
  if (item.id === 'more') {
    emit('openDrawer')
    return
  }

  if (item.tab) {
    emit('selectTab', item.tab)
  }

  if (item.to && route.path !== item.to) {
    router.push(item.to)
  }
}
</script>

<template>
  <nav class="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-card/95 backdrop-blur-lg border-t border-border shadow-[0_-4px_16px_rgba(0,0,0,0.04)] pb-safe">
    <div class="flex items-center justify-around h-14 px-1">
      <button
        v-for="item in items"
        :key="item.id"
        type="button"
        @click="handleClick(item)"
        :class="[
          'relative flex flex-col items-center justify-center flex-1 py-1 px-0.5 rounded-xl transition-all cursor-pointer select-none active:scale-90',
          isItemActive(item)
            ? 'text-primary font-bold'
            : 'text-muted-foreground hover:text-foreground font-medium'
        ]"
      >
        <div class="relative flex items-center justify-center">
          <component
            :is="item.icon"
            :class="[
              'h-5 w-5 transition-transform duration-200',
              isItemActive(item) ? 'scale-110 text-primary' : 'text-muted-foreground'
            ]"
          />
          <span
            v-if="item.badge !== undefined && item.badge > 0"
            class="absolute -top-1 -right-2.5 min-w-[15px] h-[15px] px-0.5 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold flex items-center justify-center ring-2 ring-card shadow-xs"
          >
            {{ item.badge }}
          </span>
        </div>
        <span class="text-[10px] mt-1 tracking-tight leading-none truncate max-w-[64px]">
          {{ item.label }}
        </span>
        <!-- Active indicator pill -->
        <span
          v-if="isItemActive(item)"
          class="absolute -bottom-0.5 w-5 h-1 rounded-full bg-primary"
        />
      </button>
    </div>
  </nav>
</template>

<style scoped>
.pb-safe {
  padding-bottom: max(0.25rem, env(safe-area-inset-bottom));
}
</style>
