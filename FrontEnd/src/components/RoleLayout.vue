<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore, ROLE_LABELS, ROLE_HOMES, type AppRole } from '@/stores/auth'
import {
  Bell, ChevronDown, LogOut, Menu, Moon, Sun, User as UserIcon, UtensilsCrossed, X
} from 'lucide-vue-next'
import DropdownMenu from '@/components/ui/DropdownMenu.vue'
import DropdownMenuContent from '@/components/ui/DropdownMenuContent.vue'
import DropdownMenuItem from '@/components/ui/DropdownMenuItem.vue'
import DropdownMenuLabel from '@/components/ui/DropdownMenuLabel.vue'
import DropdownMenuSeparator from '@/components/ui/DropdownMenuSeparator.vue'
import { DropdownMenuTrigger } from 'radix-vue'
import Button from '@/components/ui/Button.vue'
import Badge from '@/components/ui/Badge.vue'

interface NavItem {
  to: string;
  label: string;
  icon: any;
}

const props = withDefaults(defineProps<{
  role: AppRole;
  nav: NavItem[];
  brand?: string;
}>(), {
  brand: 'Savoria'
})

const auth = useAuthStore()
const router = useRouter()
const route = useRoute()

const open = ref(false)
const dark = ref(false)

onMounted(() => {
  const stored = localStorage.getItem("theme");
  if (stored) {
    dark.value = stored === "dark";
  } else {
    dark.value = window.matchMedia("(prefers-color-scheme: dark)").matches;
  }
  document.documentElement.classList.toggle("dark", dark.value);
})

watch(dark, (newDark) => {
  document.documentElement.classList.toggle("dark", newDark);
  localStorage.setItem("theme", newDark ? "dark" : "light");
})

watch(() => auth.user, (u) => {
  if (!u) router.push('/login')
  else if (u.role !== props.role) router.push(ROLE_HOMES[u.role] || '/')
}, { immediate: true })

async function handleLogout() {
  await auth.signOut()
  router.push('/login')
}

const breadcrumbs = computed(() => {
  const path = route.path
  if (path === '/' || path === '/login') return []
  const segments = path.split('/').filter(Boolean)
  return segments.map((seg, index) => {
    const label = seg
      .replace(/[-_]/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase())
    const to = '/' + segments.slice(0, index + 1).join('/')
    return { label, to }
  })
})
</script>

<template>
  <div v-if="auth.user" class="min-h-screen bg-background text-foreground flex">
    <!-- Sidebar -->
    <aside
      :class="['fixed lg:static inset-y-0 left-0 z-40 w-64 bg-sidebar text-sidebar-foreground border-r border-sidebar-border flex flex-col transition-transform', open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0']"
    >
      <div class="h-16 flex items-center justify-between px-5 border-b border-sidebar-border">
        <router-link to="/" class="flex items-center gap-2.5">
          <div class="h-9 w-9 rounded-xl gradient-primary grid place-items-center">
            <UtensilsCrossed class="h-4.5 w-4.5 text-primary-foreground" />
          </div>
          <div class="leading-tight">
            <div class="font-display text-[18px] font-bold tracking-tight">{{ brand }}</div>
            <div class="text-[10px] uppercase tracking-[0.18em] text-sidebar-foreground/60">
              Kitchen &amp; Table
            </div>
          </div>
        </router-link>
        <button class="lg:hidden text-sidebar-foreground/70" @click="open = false">
          <X class="h-5 w-5" />
        </button>
      </div>

      <div class="px-3 pt-4 pb-2">
        <div class="px-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-sidebar-foreground/45">
          {{ ROLE_LABELS[role] }}
        </div>
      </div>

      <nav class="flex-1 px-3 pb-4 space-y-0.5 overflow-y-auto">
        <router-link
          v-for="item in nav"
          :key="item.to"
          :to="item.to"
          @click="open = false"
          v-slot="{ isActive, isExactActive }"
          custom
        >
          <a
            :href="item.to"
            @click.prevent="() => { router.push(item.to); open = false }"
            :class="[
              'group relative flex items-center gap-3 px-3 py-2 rounded-full text-[13.5px] font-medium transition-all',
              (route.path === item.to || (item.to !== '/' && route.path.startsWith(item.to))) ? 'bg-primary/10 text-primary' : 'text-sidebar-foreground/75 hover:text-primary hover:bg-primary/5'
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
          <div class="h-8 w-8 rounded-full gradient-primary grid place-items-center font-semibold text-primary-foreground text-sm flex-shrink-0">
            {{ auth.user.name[0] }}
          </div>
          <div class="flex-1 min-w-0">
            <div class="text-[13px] font-medium truncate text-white">{{ auth.user.name }}</div>
            <div class="text-[11px] text-sidebar-foreground/60 truncate">{{ auth.user.email }}</div>
          </div>
        </div>
        <button @click="handleLogout" title="Log out" class="p-2 text-sidebar-foreground/60 hover:text-destructive hover:bg-sidebar-accent/50 rounded-lg transition">
          <LogOut class="h-4 w-4" />
        </button>
      </div>
    </aside>

    <div v-if="open" class="lg:hidden fixed inset-0 bg-black/40 backdrop-blur-sm z-30" @click="open = false" />

    <!-- Main -->
    <div class="flex-1 flex flex-col min-w-0">
      <header class="h-16 border-b border-border flex items-center justify-between gap-2 px-4 lg:px-6 bg-card/80 backdrop-blur-md sticky top-0 z-20">
        <div class="flex items-center gap-2 min-w-0">
          <button class="lg:hidden text-foreground flex-shrink-0" @click="open = true">
            <Menu class="h-5 w-5" />
          </button>

          <!-- Breadcrumbs / Dynamic Header -->
          <div class="hidden md:flex items-center gap-2 text-sm font-medium text-muted-foreground ml-2 select-none">
            <span class="text-foreground/40 font-semibold uppercase tracking-wider text-[11px]">Savoria</span>
            <span class="text-foreground/20">/</span>
            <span class="text-foreground font-semibold">
              {{ breadcrumbs.map(c => c.label).join(' / ') }}
            </span>
          </div>
        </div>

        <div class="flex items-center gap-2">
          <Button variant="ghost" size="icon" class="h-9 w-9" @click="dark = !dark">
            <Sun v-if="dark" class="h-4 w-4" />
            <Moon v-else class="h-4 w-4" />
          </Button>

          <Button variant="ghost" size="icon" class="h-9 w-9 relative">
            <Bell class="h-4 w-4" />
            <span class="absolute top-2 right-2 h-2 w-2 rounded-full bg-destructive ring-2 ring-card" />
          </Button>

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
      <main class="flex-1 p-4 lg:p-6 animate-fade-in"><slot /></main>
    </div>
  </div>
</template>
