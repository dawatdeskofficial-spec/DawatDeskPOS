<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import {
  LayoutDashboard, ShoppingBag, Table2, UtensilsCrossed,
  Users, BarChart3, ArrowUpRight, Clock, Zap, Sparkles, TrendingUp
} from 'lucide-vue-next'
import RoleLayout from '@/components/RoleLayout.vue'
import { restaurantNav } from '@/lib/nav'
import { useAuthStore } from '@/stores/auth'
import { getOrders, getRestaurantById } from '@/lib/api'

const auth = useAuthStore()
const router = useRouter()

const restaurantName = ref('Your Restaurant')
const todayOrders = ref(0)
const pendingOrders = ref(0)
const loadingStats = ref(true)
const greeting = computed(() => {
  const h = new Date().getHours()
  if (h < 12) return 'Good Morning'
  if (h < 17) return 'Good Afternoon'
  return 'Good Evening'
})

const navCards = [
  {
    to: '/restaurant/dashboard',
    label: 'Dashboard',
    description: 'Overview of your restaurant performance & live stats',
    icon: LayoutDashboard,
    gradient: 'from-violet-500/20 via-primary/15 to-indigo-500/10',
    accentColor: 'text-violet-400',
    iconBg: 'bg-violet-500/15 border-violet-500/25',
    badge: null,
    featured: true,
  },
  {
    to: '/restaurant/orders',
    label: 'Orders',
    description: 'Manage incoming & active orders in real-time',
    icon: ShoppingBag,
    gradient: 'from-amber-500/20 via-orange-500/10 to-yellow-500/5',
    accentColor: 'text-amber-400',
    iconBg: 'bg-amber-500/15 border-amber-500/25',
    badge: 'live',
    featured: false,
  },
  {
    to: '/restaurant/tables',
    label: 'Tables',
    description: 'View table occupancy & reservation status',
    icon: Table2,
    gradient: 'from-emerald-500/20 via-teal-500/10 to-green-500/5',
    accentColor: 'text-emerald-400',
    iconBg: 'bg-emerald-500/15 border-emerald-500/25',
    badge: null,
    featured: false,
  },
  {
    to: '/restaurant/menu',
    label: 'Menu',
    description: 'Add, edit & organise your menu items & categories',
    icon: UtensilsCrossed,
    gradient: 'from-rose-500/20 via-pink-500/10 to-red-500/5',
    accentColor: 'text-rose-400',
    iconBg: 'bg-rose-500/15 border-rose-500/25',
    badge: null,
    featured: false,
  },
  {
    to: '/restaurant/staff',
    label: 'Staff',
    description: 'Manage your team — waiters, chefs & cashiers',
    icon: Users,
    gradient: 'from-sky-500/20 via-blue-500/10 to-cyan-500/5',
    accentColor: 'text-sky-400',
    iconBg: 'bg-sky-500/15 border-sky-500/25',
    badge: null,
    featured: false,
  },
  {
    to: '/restaurant/reports',
    label: 'Analytics',
    description: 'Revenue insights, order trends & performance reports',
    icon: BarChart3,
    gradient: 'from-fuchsia-500/20 via-purple-500/10 to-violet-500/5',
    accentColor: 'text-fuchsia-400',
    iconBg: 'bg-fuchsia-500/15 border-fuchsia-500/25',
    badge: null,
    featured: false,
  },
]

const hoveredCard = ref<string | null>(null)

async function loadStats() {
  const restaurantId = auth.effectiveRestaurantId
  if (!restaurantId) { loadingStats.value = false; return }
  try {
    const [ordRes, restRes] = await Promise.all([
      getOrders(restaurantId, 1, 100),
      getRestaurantById(restaurantId),
    ])
    const allOrders: any[] = ordRes.data || []
    const today = new Date().toDateString()
    todayOrders.value = allOrders.filter((o: any) => new Date(o.createdAt).toDateString() === today).length
    pendingOrders.value = allOrders.filter((o: any) => ['PENDING', 'PREPARING'].includes((o.status || '').toUpperCase())).length
    restaurantName.value = restRes?.data?.name || 'Your Restaurant'
  } catch {
    // silent
  } finally {
    loadingStats.value = false
  }
}

onMounted(loadStats)
</script>

<template>
  <RoleLayout role="restaurant_admin" :nav="restaurantNav">
    <div class="hub-root">

      <!-- Hero greeting -->
      <div class="hub-hero">
        <div class="hub-hero-glow" />
        <div class="hub-hero-content">
          <div class="hub-hero-meta">
            <span class="hub-tag">
              <Zap class="h-3 w-3" />
              Restaurant Portal
            </span>
          </div>
          <h1 class="hub-heading">
            {{ greeting }},
            <span class="hub-heading-accent">{{ auth.user?.name?.split(' ')[0] ?? 'Admin' }}</span> 👋
          </h1>
          <p class="hub-sub">
            Managing <strong>{{ restaurantName }}</strong> — select a section below to get started.
          </p>

          <!-- Quick stats strip -->
          <div class="hub-stats" v-if="!loadingStats">
            <div class="hub-stat">
              <Clock class="h-3.5 w-3.5 opacity-60" />
              <span>{{ todayOrders }} orders today</span>
            </div>
            <div class="hub-stat-sep" />
            <div class="hub-stat hub-stat-live" v-if="pendingOrders > 0">
              <span class="hub-live-dot" />
              <span>{{ pendingOrders }} active now</span>
            </div>
            <div class="hub-stat" v-else>
              <TrendingUp class="h-3.5 w-3.5 opacity-60" />
              <span>All clear</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Navigation Cards Grid -->
      <div class="hub-grid">
        <button
          v-for="card in navCards"
          :key="card.to"
          @click="router.push(card.to)"
          @mouseenter="hoveredCard = card.to"
          @mouseleave="hoveredCard = null"
          :class="[
            'hub-card',
            card.featured ? 'hub-card-featured' : '',
            hoveredCard === card.to ? 'hub-card-hovered' : ''
          ]"
        >
          <div :class="['hub-card-bg', 'bg-gradient-to-br', card.gradient]" />
          <div class="hub-card-ring" />

          <div class="hub-card-inner">
            <div :class="['hub-card-icon', card.iconBg]">
              <component :is="card.icon" :class="['h-5 w-5', card.accentColor]" />
            </div>

            <span v-if="card.badge === 'live'" class="hub-live-badge">
              <span class="hub-live-dot hub-live-dot-sm" />
              Live
            </span>

            <span
              v-if="card.to === '/restaurant/orders' && pendingOrders > 0"
              class="hub-badge-count"
            >
              {{ pendingOrders }}
            </span>

            <div class="hub-card-body">
              <div class="hub-card-label">{{ card.label }}</div>
              <div class="hub-card-desc">{{ card.description }}</div>
            </div>

            <div :class="['hub-card-arrow', card.accentColor]">
              <ArrowUpRight class="h-4 w-4" />
            </div>
          </div>
        </button>
      </div>

      <!-- Footer -->
      <div class="hub-footer">
        <Sparkles class="h-3.5 w-3.5 opacity-40" />
        <span>Powered by Savoria Restaurant Management</span>
      </div>
    </div>
  </RoleLayout>
</template>

<style scoped>
.hub-root {
  min-height: 100%;
  display: flex;
  flex-direction: column;
  gap: 2rem;
  padding-bottom: 2rem;
}

/* Hero */
.hub-hero {
  position: relative;
  overflow: hidden;
  border-radius: 1.5rem;
  border: 1px solid hsl(var(--border));
  background: hsl(var(--card));
  padding: 2rem;
}
.hub-hero-glow {
  position: absolute;
  inset: 0;
  background: radial-gradient(ellipse 80% 60% at 50% -20%, hsl(var(--primary) / 0.12), transparent 70%);
  pointer-events: none;
}
.hub-hero-content { position: relative; z-index: 1; }
.hub-hero-meta { margin-bottom: 0.75rem; }

.hub-tag {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: hsl(var(--primary));
  background: hsl(var(--primary) / 0.1);
  border: 1px solid hsl(var(--primary) / 0.2);
  padding: 0.25rem 0.7rem;
  border-radius: 999px;
}

.hub-heading {
  font-size: clamp(1.5rem, 4vw, 2.25rem);
  font-weight: 800;
  line-height: 1.15;
  letter-spacing: -0.03em;
  color: hsl(var(--foreground));
  margin-bottom: 0.5rem;
}
.hub-heading-accent {
  background: linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary) / 0.6));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
.hub-sub {
  font-size: 0.9rem;
  color: hsl(var(--muted-foreground));
  max-width: 480px;
  line-height: 1.6;
}

.hub-stats {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-top: 1.25rem;
}
.hub-stat {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.78rem;
  font-weight: 600;
  color: hsl(var(--muted-foreground));
}
.hub-stat-live { color: hsl(142 76% 36%); }
.hub-stat-sep { width: 1px; height: 14px; background: hsl(var(--border)); }

/* Grid */
.hub-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 1rem;
}
@media (min-width: 768px) {
  .hub-grid { grid-template-columns: repeat(3, 1fr); }
  .hub-card-featured { grid-column: span 3; }
}

/* Card */
.hub-card {
  position: relative;
  overflow: hidden;
  border-radius: 1.25rem;
  border: 1px solid hsl(var(--border));
  background: hsl(var(--card));
  padding: 1.5rem;
  text-align: left;
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
}
.hub-card:hover, .hub-card-hovered {
  transform: translateY(-3px);
  box-shadow: 0 12px 40px -8px hsl(var(--primary) / 0.18);
  border-color: hsl(var(--primary) / 0.3);
}
.hub-card:active { transform: translateY(-1px); }
.hub-card-featured { padding: 2rem; }

.hub-card-bg {
  position: absolute;
  inset: 0;
  opacity: 0.6;
  transition: opacity 0.2s ease;
}
.hub-card:hover .hub-card-bg { opacity: 1; }

.hub-card-ring {
  position: absolute;
  right: -30px;
  top: -30px;
  width: 120px;
  height: 120px;
  border-radius: 50%;
  border: 1px solid hsl(var(--border) / 0.5);
  pointer-events: none;
}

.hub-card-inner {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  height: 100%;
}
.hub-card-featured .hub-card-inner {
  flex-direction: row;
  align-items: center;
}

.hub-card-icon {
  width: 2.75rem;
  height: 2.75rem;
  border-radius: 0.875rem;
  border: 1px solid;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: transform 0.2s ease;
}
.hub-card:hover .hub-card-icon { transform: scale(1.08); }
.hub-card-featured .hub-card-icon {
  width: 3.25rem;
  height: 3.25rem;
  border-radius: 1rem;
}
.hub-card-featured .hub-card-icon svg { width: 1.5rem; height: 1.5rem; }

.hub-card-body { flex: 1; }
.hub-card-label {
  font-size: 1.05rem;
  font-weight: 800;
  letter-spacing: -0.02em;
  color: hsl(var(--foreground));
  margin-bottom: 0.3rem;
}
.hub-card-desc {
  font-size: 0.8rem;
  color: hsl(var(--muted-foreground));
  line-height: 1.55;
}

.hub-card-arrow {
  margin-left: auto;
  opacity: 0;
  transform: translate(-4px, 4px);
  transition: opacity 0.2s ease, transform 0.2s ease;
  flex-shrink: 0;
}
.hub-card:hover .hub-card-arrow { opacity: 1; transform: translate(0, 0); }

.hub-live-badge {
  position: absolute;
  top: 0;
  right: 0;
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: hsl(142 76% 36%);
  background: hsl(142 76% 36% / 0.1);
  border: 1px solid hsl(142 76% 36% / 0.25);
  padding: 0.2rem 0.55rem;
  border-radius: 999px;
}

.hub-badge-count {
  position: absolute;
  top: 0;
  right: 0;
  min-width: 1.4rem;
  height: 1.4rem;
  padding: 0 0.35rem;
  border-radius: 999px;
  background: hsl(var(--destructive));
  color: hsl(var(--destructive-foreground));
  font-size: 0.7rem;
  font-weight: 800;
  display: flex;
  align-items: center;
  justify-content: center;
}

.hub-live-dot {
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: hsl(142 76% 36%);
  animation: hub-pulse 1.4s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}
.hub-live-dot-sm { width: 5px; height: 5px; }
@keyframes hub-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

.hub-footer {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  font-size: 0.72rem;
  color: hsl(var(--muted-foreground) / 0.5);
  letter-spacing: 0.04em;
  padding-top: 0.5rem;
}
</style>
