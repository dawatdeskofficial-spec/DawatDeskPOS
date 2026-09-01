<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { getRestaurantById, updateRestaurant } from '@/lib/api'
import {
  AlertTriangle, RefreshCw, LogOut, ShieldAlert,
  Building2, Phone, Mail, ArrowLeft, CheckCircle2, Lock
} from 'lucide-vue-next'
import Button from '@/components/ui/Button.vue'
import Badge from '@/components/ui/Badge.vue'
import { toast } from 'vue-sonner'

const auth = useAuthStore()
const router = useRouter()

const loading = ref(true)
const checking = ref(false)
const restaurant = ref<any>(null)
const reactivating = ref(false)

async function checkStatus() {
  checking.value = true
  const rId = auth.effectiveRestaurantId || (typeof auth.user?.restaurantId === 'string' ? auth.user.restaurantId : (auth.user?.restaurantId as any)?.id || (auth.user?.restaurantId as any)?._id)

  if (!rId) {
    loading.value = false
    checking.value = false
    return
  }

  try {
    const res = await getRestaurantById(rId)
    restaurant.value = res.data
    if (res.data?.status === 'ACTIVE' || res.data?.isActive === true) {
      toast.success('Restaurant is now active! Redirecting to workspace...')
      if (auth.role === 'main_admin') {
        router.push('/admin/restaurants')
      } else if (auth.role === 'restaurant_admin') {
        router.push('/restaurant/dashboard')
      } else if (auth.role) {
        router.push(`/${auth.role.split('_')[0]}`)
      } else {
        router.push('/login')
      }
    }
  } catch (err) {
    console.error('Failed to check restaurant status:', err)
  } finally {
    loading.value = false
    checking.value = false
  }
}

async function handleReactivate() {
  if (!restaurant.value) return
  reactivating.value = true
  try {
    const rId = restaurant.value.id || restaurant.value._id
    await updateRestaurant(rId, { status: 'ACTIVE' })
    toast.success(`🎉 ${restaurant.value.name} has been reactivated!`)
    await checkStatus()
  } catch (err: any) {
    toast.error(err.message || 'Failed to reactivate restaurant')
  } finally {
    reactivating.value = false
  }
}

async function handleSignOut() {
  await auth.signOut()
  router.push('/login')
}

onMounted(() => {
  checkStatus()
})
</script>

<template>
  <div class="min-h-screen w-full bg-background flex items-center justify-center p-4 sm:p-6 relative overflow-hidden">
    <!-- Subtle Background Glows -->
    <div class="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />
    <div class="absolute bottom-1/4 left-1/3 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

    <div class="max-w-lg w-full rounded-3xl bg-card border border-border shadow-2xl p-6 sm:p-8 text-center relative z-10">
      <!-- Animated Status Icon -->
      <div class="relative mx-auto mb-5 w-20 h-20 flex items-center justify-center">
        <div class="absolute inset-0 rounded-full bg-rose-500/15 animate-ping opacity-75" />
        <div class="h-20 w-20 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-500 shadow-inner">
          <Lock class="h-9 w-9 stroke-[2.2]" />
        </div>
      </div>

      <!-- Badge Status -->
      <Badge variant="outline" class="mb-3 px-3 py-1 bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30 text-xs font-bold gap-1.5 inline-flex items-center">
        <span class="h-2 w-2 rounded-full bg-rose-500" />
        Venue Inactive / Service Suspended
      </Badge>

      <!-- Main Heading -->
      <h1 class="font-display text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
        Service Currently Unavailable
      </h1>

      <!-- Restaurant Details -->
      <div v-if="restaurant" class="mt-3 p-3.5 rounded-2xl bg-muted/40 border border-border text-left">
        <div class="flex items-center gap-2.5">
          <div class="h-8 w-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">
            {{ restaurant.name.charAt(0) }}
          </div>
          <div>
            <h4 class="font-bold text-sm text-foreground leading-tight">{{ restaurant.name }}</h4>
            <p class="text-xs text-muted-foreground">{{ restaurant.location || 'Branch Venue' }}</p>
          </div>
        </div>
      </div>

      <!-- Description -->
      <p class="text-xs sm:text-sm text-muted-foreground mt-4 leading-relaxed">
        This restaurant venue has been temporarily deactivated by system administration. Order punching, kitchen preparation, and billing operations are paused.
      </p>

      <!-- Help Contact Information -->
      <div class="mt-5 p-3 rounded-xl bg-background border border-border/80 text-xs text-muted-foreground space-y-1 text-left">
        <div class="font-bold text-foreground flex items-center gap-1.5">
          <ShieldAlert class="h-3.5 w-3.5 text-primary" /> What should you do?
        </div>
        <p class="text-[11px]">
          If you are staff or management of this venue, please contact the Master Administrator to reactivate the branch operations.
        </p>
        <div v-if="restaurant?.phone || restaurant?.email" class="pt-1 flex flex-wrap gap-3 text-[11px] text-foreground font-medium">
          <span v-if="restaurant?.phone" class="flex items-center gap-1"><Phone class="h-3 w-3 text-primary" /> {{ restaurant.phone }}</span>
          <span v-if="restaurant?.email" class="flex items-center gap-1"><Mail class="h-3 w-3 text-primary" /> {{ restaurant.email }}</span>
        </div>
      </div>

      <!-- Admin Reactivation Action (if Main Admin is viewing) -->
      <div v-if="auth.role === 'main_admin'" class="mt-6 pt-4 border-t border-border">
        <div class="text-xs text-muted-foreground mb-2">You are signed in as Master Administrator:</div>
        <Button
          @click="handleReactivate"
          :disabled="reactivating"
          class="w-full h-10 font-bold gradient-primary text-primary-foreground shadow-glow gap-2"
        >
          <CheckCircle2 class="h-4 w-4" />
          {{ reactivating ? 'Reactivating...' : 'Reactivate Restaurant Venue Now' }}
        </Button>
      </div>

      <!-- Action Buttons -->
      <div class="mt-6 flex flex-col sm:flex-row items-center gap-2.5">
        <Button
          @click="checkStatus"
          :disabled="checking"
          variant="outline"
          class="w-full sm:flex-1 h-10 text-xs font-bold gap-2"
        >
          <RefreshCw :class="['h-3.5 w-3.5', checking && 'animate-spin text-primary']" />
          <span>{{ checking ? 'Checking Status...' : 'Check Status Again' }}</span>
        </Button>

        <Button
          @click="handleSignOut"
          variant="ghost"
          class="w-full sm:w-auto h-10 text-xs font-semibold text-muted-foreground hover:text-foreground gap-1.5"
        >
          <LogOut class="h-3.5 w-3.5" /> Sign Out
        </Button>
      </div>
    </div>
  </div>
</template>
