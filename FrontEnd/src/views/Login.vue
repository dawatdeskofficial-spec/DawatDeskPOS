<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ChefHat, ClipboardList, Crown, Receipt, Store, Utensils, Monitor, ConciergeBell, Mail, KeyRound, RefreshCw, CheckCircle2 } from 'lucide-vue-next'
import { useAuthStore, ROLE_HOMES, ROLE_LABELS, type AppRole } from '@/stores/auth'
import { sendOtp } from '@/lib/api'
import Button from '@/components/ui/Button.vue'
import Input from '@/components/ui/Input.vue'
import DawatDeskLogo from '@/components/DawatDeskLogo.vue'

const router = useRouter()
const auth = useAuthStore()

const authMode = ref<'password' | 'otp'>('password')
const otpCode = ref('')
const otpSent = ref(false)
const otpSending = ref(false)
const otpCountdown = ref(0)
const otpSuccessMessage = ref('')
const testOtpHint = ref('')

const roleOptions = [
  { role: "main_admin" as AppRole, icon: Crown, desc: "System-wide control and analytics" },
  { role: "restaurant_admin" as AppRole, icon: Store, desc: "Restaurant management and settings" },
  { role: "waiter" as AppRole, icon: ClipboardList, desc: "Table orders and serving status" },
  { role: "chef" as AppRole, icon: ChefHat, desc: "Kitchen display ticket queue" },
  { role: "cashier" as AppRole, icon: Receipt, desc: "Billing and POS settlements" },
]

const demoCredentials = {
  main_admin: { email: 'admin@gmail.com', password: 'admin123' },
  restaurant_admin: { email: 'manager.hariom@gmail.com', password: 'admin123' },
  waiter: { email: 'john.waiter@gmail.com', password: 'waiter123' },
  chef: { email: 'chef.michael@gmail.com', password: 'chef123' },
  cashier: { email: 'hari.cashier@gmail.com', password: 'cashier123' },
}

const selected = ref<AppRole>('main_admin')
const email = ref(demoCredentials.main_admin.email)
const password = ref(demoCredentials.main_admin.password)
const forgot = ref(false)
const error = ref('')
const isLoading = ref(false)

const roleChunkLoaders: Record<AppRole, () => Promise<any>> = {
  main_admin: () => import('@/views/admin/Dashboard.vue'),
  restaurant_admin: () => import('@/views/restaurant/Dashboard.vue'),
  waiter: () => import('@/views/waiter/index.vue'),
  chef: () => import('@/views/chef/index.vue'),
  cashier: () => import('@/views/cashier/index.vue'),
}

function preloadRoleChunk(r: AppRole) {
  try {
    roleChunkLoaders[r]?.().catch(() => {})
  } catch {
    // Non-blocking preloading
  }
}

onMounted(() => {
  if (auth.user) {
    router.push(ROLE_HOMES[auth.user.role] || '/')
    return
  }
  // Preload default selected role chunk and shared layout immediately
  preloadRoleChunk(selected.value)
  import('@/components/RoleLayout.vue').catch(() => {})

  // Idle preloading for other role chunks
  const idleCallback = (window as any).requestIdleCallback || ((cb: () => void) => setTimeout(cb, 600))
  idleCallback(() => {
    roleOptions.forEach(opt => {
      if (opt.role !== selected.value) {
        preloadRoleChunk(opt.role)
      }
    })
  })
})

watch(selected, (newRole) => {
  const creds = demoCredentials[newRole]
  email.value = creds.email
  password.value = creds.password
  preloadRoleChunk(newRole)
})

async function submit() {
  if (isLoading.value) return
  error.value = ''
  isLoading.value = true
  preloadRoleChunk(selected.value)
  
  try {
    let loginEmail = email.value.trim()
    if (!loginEmail.includes('@')) {
      loginEmail = `${loginEmail}@gmail.com`
    }
    await auth.signIn(loginEmail, password.value)
    if (auth.user) {
      router.push(ROLE_HOMES[auth.user.role] || '/')
    }
  } catch (err: any) {
    error.value = err.message || "Failed to sign in"
  } finally {
    isLoading.value = false
  }
}

async function handleSendOtp() {
  if (otpSending.value || otpCountdown.value > 0) return
  error.value = ''
  otpSuccessMessage.value = ''
  testOtpHint.value = ''
  
  let loginEmail = email.value.trim()
  if (!loginEmail) {
    error.value = 'Please enter your email address to receive an OTP.'
    return
  }
  if (!loginEmail.includes('@')) {
    loginEmail = `${loginEmail}@gmail.com`
  }

  otpSending.value = true
  try {
    const res = await sendOtp(loginEmail, 'login') as any
    otpSent.value = true
    otpSuccessMessage.value = res.message || `OTP sent to ${loginEmail}`
    if (res.data?.testOtp) {
      testOtpHint.value = `Dev test code: ${res.data.testOtp}`
    } else if (res.data?.warning) {
      testOtpHint.value = res.data.warning
    }
    otpCountdown.value = 60
    const timer = setInterval(() => {
      otpCountdown.value--
      if (otpCountdown.value <= 0) {
        clearInterval(timer)
      }
    }, 1000)
  } catch (err: any) {
    error.value = err.message || 'Failed to send OTP. Please check your email.'
  } finally {
    otpSending.value = false
  }
}

async function handleOtpLogin() {
  if (isLoading.value) return
  error.value = ''
  if (!otpCode.value.trim()) {
    error.value = 'Please enter the 6-digit OTP code sent to your email.'
    return
  }

  isLoading.value = true
  preloadRoleChunk(selected.value)
  try {
    let loginEmail = email.value.trim()
    if (!loginEmail.includes('@')) {
      loginEmail = `${loginEmail}@gmail.com`
    }
    await auth.signInWithOtp(loginEmail, otpCode.value.trim())
    if (auth.user) {
      router.push(ROLE_HOMES[auth.user.role] || '/')
    }
  } catch (err: any) {
    error.value = err.message || 'Invalid or expired OTP. Please try again.'
  } finally {
    isLoading.value = false
  }
}

async function launchKioskDemo() {
  if (isLoading.value) return
  error.value = ''
  isLoading.value = true
  import('@/views/customer-ordering/index.vue').catch(() => {})
  
  try {
    const creds = demoCredentials.waiter
    await auth.signIn(creds.email, creds.password)
    if (auth.user) {
      router.push('/customer-ordering')
    }
  } catch (err: any) {
    error.value = err.message || "Failed to launch kiosk mode"
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen grid lg:grid-cols-2 bg-background">
    <!-- Visual side -->
    <div class="hidden lg:flex relative overflow-hidden bg-gradient-to-br from-[#090d16] via-[#0f172a] to-[#151b2d] p-12 flex-col justify-between border-r border-white/10">
      <div class="absolute inset-0 paper-tex opacity-60 pointer-events-none" />
      <div
        class="absolute inset-0 pointer-events-none"
        style="background: radial-gradient(680px circle at 15% 10%, oklch(0.7 0.18 45 / 0.30), transparent 60%), radial-gradient(520px circle at 90% 95%, oklch(0.58 0.2 28 / 0.28), transparent 60%);"
      />
      <div class="relative flex items-center">
        <DawatDeskLogo variant="dark" size="lg" />
      </div>
      <div class="relative space-y-7 text-white">
        <div class="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/15 bg-white/5 text-xs text-white/80 backdrop-blur">
          <span class="h-1.5 w-1.5 rounded-full bg-primary-glow animate-pulse" />
          Loved by 1,200+ kitchens around the world
        </div>
        <h1 class="font-display text-5xl xl:text-6xl font-bold leading-[1.05] tracking-tight">
          Run a warmer,<br />
          <span class="italic gradient-text">tastier</span> restaurant.
        </h1>
        <p class="text-white/70 text-base max-w-md leading-relaxed">
          From the first hello at the door to the last bite on the plate — DawatDesk keeps your front of house,
          kitchen, and bar moving together, beautifully.
        </p>
        <div class="grid grid-cols-3 gap-3 pt-2 max-w-md">
          <div
            v-for="s in [
              { v: '1.2K+', l: 'Restaurants' },
              { v: '45M', l: 'Plates served' },
              { v: '4.9★', l: 'Staff rating' },
            ]"
            :key="s.l"
            class="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm"
          >
            <div class="font-display text-2xl font-bold">{{ s.v }}</div>
            <div class="text-[10.5px] text-white/60 uppercase tracking-wider mt-0.5">{{ s.l }}</div>
          </div>
        </div>
      </div>
      <div class="relative text-xs text-white/50 italic">
        “The whole team finally speaks the same language.” — Chef Marco, Trattoria Lumière
      </div>
    </div>

    <!-- Form side -->
    <div class="flex items-center justify-center p-6 lg:p-12">
      <div class="w-full max-w-md space-y-8 animate-fade-in">
        <div class="flex items-center justify-center lg:justify-start mb-2">
          <DawatDeskLogo variant="auto" size="lg" />
        </div>

        <div v-if="forgot" class="space-y-6">
          <div>
            <h2 class="font-display text-3xl font-bold">Reset password</h2>
            <p class="text-muted-foreground mt-1">We'll send a recovery link to your email.</p>
          </div>
          <div class="space-y-2">
            <label class="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Email</label>
            <Input type="email" placeholder="you@gmail.com" />
          </div>
          <Button class="w-full h-11" @click="forgot = false">Send recovery link</Button>
          <button @click="forgot = false" class="text-sm text-muted-foreground hover:text-foreground">
            ← Back to sign in
          </button>
        </div>
        
        <div v-else>
          <div>
            <h2 class="font-display text-3xl font-bold">Welcome back</h2>
            <p class="text-muted-foreground mt-1">Sign in to your role-based dashboard.</p>
          </div>

          <div class="mt-8 mb-6">
            <label class="mb-3 block text-sm font-medium leading-none">Sign in as</label>
            <div class="grid grid-cols-1 gap-2">
              <button
                v-for="opt in roleOptions"
                :key="opt.role"
                type="button"
                @click="selected = opt.role"
                @mouseenter="preloadRoleChunk(opt.role)"
                :class="['flex items-center gap-3 p-3 rounded-xl border text-left transition-all', selected === opt.role ? 'border-primary bg-primary/10 shadow-soft' : 'border-border hover:border-primary/40 hover:bg-muted/40']"
              >
                <div
                  :class="['h-9 w-9 rounded-lg grid place-items-center transition', selected === opt.role ? 'gradient-primary text-primary-foreground' : 'bg-muted text-foreground']"
                >
                  <component :is="opt.icon" class="h-4.5 w-4.5" />
                </div>
                <div class="flex-1 min-w-0">
                  <div class="text-sm font-semibold">{{ ROLE_LABELS[opt.role] }}</div>
                  <div class="text-xs text-muted-foreground truncate">{{ opt.desc }}</div>
                </div>
              </button>
            </div>
          </div>

          <!-- Auth Method Tabs: Password vs Real-Time Email OTP -->
          <div class="grid grid-cols-2 p-1 rounded-xl bg-muted/70 border border-border/50 mb-5">
            <button
              type="button"
              @click="authMode = 'password'; error = ''"
              :class="[
                'flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded-lg transition-all',
                authMode === 'password'
                  ? 'bg-background shadow-xs text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              ]"
            >
              <KeyRound class="h-3.5 w-3.5" />
              Password Login
            </button>
            <button
              type="button"
              @click="authMode = 'otp'; error = ''"
              :class="[
                'flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded-lg transition-all',
                authMode === 'otp'
                  ? 'bg-background shadow-xs text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              ]"
            >
              <Mail class="h-3.5 w-3.5" />
              Email OTP Login
            </button>
          </div>

          <!-- Password Sign-in Form -->
          <form v-if="authMode === 'password'" @submit.prevent="submit" class="space-y-4">
            <div class="space-y-2">
              <label class="text-sm font-medium">Email</label>
              <Input type="email" v-model="email" required />
            </div>
            <div class="space-y-2">
              <div class="flex items-center justify-between">
                <label class="text-sm font-medium">Password</label>
                <button type="button" @click="forgot = true" class="text-xs text-primary hover:underline">
                  Forgot?
                </button>
              </div>
              <Input type="password" v-model="password" required />
            </div>
            <div v-if="error" class="text-sm text-destructive font-medium">{{ error }}</div>
            <Button type="submit" :disabled="isLoading" class="w-full h-11 gradient-primary text-primary-foreground font-semibold shadow-glow hover:opacity-90">
              {{ isLoading ? 'Signing in...' : `Sign in to ${ROLE_LABELS[selected]}` }}
            </Button>
            <p class="mt-4 text-xs text-center text-muted-foreground">
              Demo credentials for {{ ROLE_LABELS[selected] }} are preloaded for quick testing.
            </p>
          </form>

          <!-- Email OTP Sign-in Form -->
          <form v-else @submit.prevent="handleOtpLogin" class="space-y-4">
            <div class="space-y-2">
              <div class="flex items-center justify-between">
                <label class="text-sm font-medium">Registered Email</label>
                <span class="text-[11px] text-muted-foreground flex items-center gap-1">
                  From: <strong class="text-foreground">dawatdesk.official@gmail.com</strong>
                </span>
              </div>
              <div class="flex gap-2">
                <Input type="email" v-model="email" placeholder="user@gmail.com" required class="flex-1" />
                <Button
                  type="button"
                  variant="outline"
                  @click="handleSendOtp"
                  :disabled="otpSending || otpCountdown > 0"
                  class="shrink-0 text-xs font-semibold h-10 px-3"
                >
                  <RefreshCw v-if="otpSending" class="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  <Mail v-else class="h-3.5 w-3.5 mr-1.5 text-primary" />
                  {{ otpSending ? 'Sending…' : otpCountdown > 0 ? `Resend (${otpCountdown}s)` : (otpSent ? 'Resend OTP' : 'Send OTP') }}
                </Button>
              </div>
            </div>

            <!-- OTP Sent Confirmation Banner -->
            <div v-if="otpSuccessMessage" class="p-3 rounded-xl bg-primary/10 border border-primary/20 text-xs text-primary flex items-start gap-2">
              <CheckCircle2 class="h-4 w-4 shrink-0 mt-0.5" />
              <div>
                <div class="font-semibold">{{ otpSuccessMessage }}</div>
                <div class="text-muted-foreground text-[11px] mt-0.5">Please check your inbox or spam folder for your 6-digit verification code.</div>
              </div>
            </div>

            <div v-if="testOtpHint" class="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-600 dark:text-amber-400">
              💡 {{ testOtpHint }}
            </div>

            <!-- OTP Input Field -->
            <div class="space-y-2">
              <div class="flex items-center justify-between">
                <label class="text-sm font-medium">6-Digit OTP Code</label>
                <span class="text-[11px] text-muted-foreground">Expires in 10 minutes</span>
              </div>
              <Input
                type="text"
                v-model="otpCode"
                placeholder="• • • • • •"
                maxlength="6"
                pattern="[0-9]*"
                class="text-center font-mono text-xl tracking-[0.5em] font-bold h-12"
                :disabled="!otpSent"
                required
              />
            </div>

            <div v-if="error" class="text-sm text-destructive font-medium">{{ error }}</div>

            <Button
              type="submit"
              :disabled="isLoading || !otpSent || !otpCode.trim()"
              class="w-full h-11 gradient-primary text-primary-foreground font-semibold shadow-glow hover:opacity-90"
            >
              {{ isLoading ? 'Verifying & Signing in…' : `Verify OTP & Sign in` }}
            </Button>

            <p class="mt-4 text-xs text-center text-muted-foreground">
              Real-time OTP verification sent directly from dawatdesk.official@gmail.com to any registered user.
            </p>
          </form>
        </div>
      </div>
    </div>
  </div>
</template>
