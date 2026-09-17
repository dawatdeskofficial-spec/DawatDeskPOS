<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import {
  Bell, BellRing, Menu, User as UserIcon, LogOut, ChevronRight, ShieldCheck
} from 'lucide-vue-next'
import { connectionState } from '@/lib/network'
import type { AppRole } from '@/stores/auth'
import DawatDeskLogo from '@/components/DawatDeskLogo.vue'
import DropdownMenu from '@/components/ui/DropdownMenu.vue'
import DropdownMenuContent from '@/components/ui/DropdownMenuContent.vue'
import DropdownMenuItem from '@/components/ui/DropdownMenuItem.vue'
import DropdownMenuLabel from '@/components/ui/DropdownMenuLabel.vue'
import DropdownMenuSeparator from '@/components/ui/DropdownMenuSeparator.vue'
import { DropdownMenuTrigger } from 'radix-vue'

const props = withDefaults(defineProps<{
  brand: string
  role: AppRole
  roleLabel: string
  user: any
  readyCount?: number
  hasNewNotif?: boolean
  isInspecting?: boolean
}>(), {
  readyCount: 0,
  hasNewNotif: false,
  isInspecting: false
})

const emit = defineEmits<{
  (e: 'openDrawer'): void
  (e: 'openNotif'): void
  (e: 'openProfile'): void
  (e: 'logout'): void
}>()

const router = useRouter()
const isWaiter = computed(() => props.role === 'waiter')

function handleProfileClick() {
  emit('openProfile')
  router.push('/profile')
}

function handleLogoutClick() {
  emit('logout')
}
</script>

<template>
  <header class="h-15 border-b border-border bg-card/95 backdrop-blur-md sticky top-0 z-40 px-3.5 sm:px-4 flex items-center justify-between gap-2 shrink-0">
    <!-- Left: Brand / Restaurant context -->
    <div class="flex items-center gap-2 min-w-0 flex-1">
      <button
        type="button"
        @click="$emit('openDrawer')"
        class="h-9 w-9 rounded-xl border border-border bg-muted/40 hover:bg-muted active:scale-95 flex items-center justify-center text-foreground cursor-pointer shrink-0 lg:hidden"
        aria-label="Open Navigation Menu"
      >
        <Menu class="h-4.5 w-4.5" />
      </button>

      <DawatDeskLogo variant="auto" size="sm" :icon-only="true" />

      <div class="leading-tight min-w-0">
        <div class="flex items-center gap-1.5 text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
          <span class="text-primary truncate font-bold">{{ roleLabel }}</span>
          <span class="inline-block w-1 h-1 rounded-full bg-muted-foreground/40" />
          <!-- Connection status pill -->
          <span
            :class="[
              'inline-flex items-center gap-1 font-semibold normal-case text-[9px] px-1.5 py-0.2 rounded-full border',
              connectionState === 'ONLINE' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' :
              connectionState === 'SYNCING' ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20 animate-pulse' :
              'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30 font-bold'
            ]"
          >
            <span
              :class="[
                'w-1.5 h-1.5 rounded-full',
                connectionState === 'ONLINE' ? 'bg-emerald-500' :
                connectionState === 'SYNCING' ? 'bg-blue-500' : 'bg-amber-500'
              ]"
            />
            {{ connectionState === 'ONLINE' ? 'Online' : connectionState === 'SYNCING' ? 'Syncing' : 'Offline' }}
          </span>
        </div>
      </div>
    </div>

    <!-- Right: Notification / Profile Actions -->
    <div class="flex items-center gap-1.5 shrink-0">
      <!-- Waiter Notification Bell -->
      <button
        v-if="isWaiter"
        type="button"
        @click="$emit('openNotif')"
        class="relative h-9 w-9 rounded-xl border border-border bg-card hover:bg-muted active:scale-95 flex items-center justify-center transition cursor-pointer text-foreground shadow-xs"
        aria-label="Kitchen notifications"
      >
        <BellRing v-if="hasNewNotif" class="h-4 w-4 text-emerald-500 animate-[bell_0.5s_ease-in-out_infinite_alternate]" />
        <Bell v-else class="h-4 w-4" />
        <span
          v-if="readyCount > 0"
          class="absolute -top-1 -right-1 min-w-[17px] h-[17px] px-1 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold flex items-center justify-center ring-2 ring-card shadow-xs"
        >
          {{ readyCount }}
        </span>
      </button>

      <!-- Profile Avatar with Dropdown Menu -->
      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <button
            type="button"
            class="h-9 w-9 rounded-xl gradient-primary grid place-items-center font-bold text-primary-foreground text-xs shadow-xs hover:opacity-90 active:scale-95 transition cursor-pointer shrink-0 outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
            title="Account Menu"
            aria-label="Open User Menu"
          >
            {{ user?.name?.[0]?.toUpperCase() || 'U' }}
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent
          align="end"
          :side-offset="8"
          class="w-56 p-1.5 rounded-2xl bg-card/95 backdrop-blur-md border border-border shadow-xl z-50 animate-in fade-in-50 zoom-in-95"
        >
          <!-- User Info Header -->
          <div class="px-2.5 py-2">
            <div class="flex items-center gap-2">
              <div class="h-8 w-8 rounded-xl gradient-primary grid place-items-center font-bold text-primary-foreground text-xs shrink-0">
                {{ user?.name?.[0]?.toUpperCase() || 'U' }}
              </div>
              <div class="min-w-0 flex-1">
                <div class="text-xs font-bold text-foreground truncate">
                  {{ user?.name || 'User Account' }}
                </div>
                <div class="text-[10px] text-muted-foreground truncate">
                  {{ user?.email || roleLabel }}
                </div>
              </div>
            </div>
            <div class="mt-1.5 inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
              <ShieldCheck class="h-2.5 w-2.5" /> {{ roleLabel }}
            </div>
          </div>

          <DropdownMenuSeparator class="my-1 bg-border/60" />

          <!-- Option 1: Profile -->
          <DropdownMenuItem
            @click="handleProfileClick"
            class="flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-medium cursor-pointer hover:bg-muted active:scale-98 transition text-foreground"
          >
            <div class="h-7 w-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <UserIcon class="h-3.5 w-3.5" />
            </div>
            <div class="flex-1">
              <div class="font-bold text-foreground">Profile</div>
              <div class="text-[10px] text-muted-foreground">Account settings & info</div>
            </div>
            <ChevronRight class="h-3.5 w-3.5 text-muted-foreground/60" />
          </DropdownMenuItem>

          <DropdownMenuSeparator class="my-1 bg-border/60" />

          <!-- Option 2: Logout -->
          <DropdownMenuItem
            @click="handleLogoutClick"
            class="flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-medium cursor-pointer hover:bg-destructive/10 text-destructive active:scale-98 transition"
          >
            <div class="h-7 w-7 rounded-lg bg-destructive/10 text-destructive flex items-center justify-center shrink-0">
              <LogOut class="h-3.5 w-3.5" />
            </div>
            <div class="flex-1">
              <div class="font-bold">Log Out</div>
              <div class="text-[10px] text-destructive/75">End your session</div>
            </div>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  </header>
</template>

<style scoped>
@keyframes bell {
  from { transform: rotate(-12deg); }
  to   { transform: rotate(12deg); }
}
</style>
