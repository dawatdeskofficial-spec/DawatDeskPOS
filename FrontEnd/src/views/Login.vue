<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { Mail, Lock, ArrowRight, ArrowLeft, RefreshCw, CheckCircle2, ShieldCheck, Eye, EyeOff, AlertCircle } from 'lucide-vue-next'
import { useAuthStore, ROLE_HOMES, type AppRole } from '@/stores/auth'
import { loginUser, sendOtp } from '@/lib/api'
import Button from '@/components/ui/Button.vue'
import Input from '@/components/ui/Input.vue'
import DawatDeskLogo from '@/components/DawatDeskLogo.vue'

const router = useRouter()
const auth = useAuthStore()

// Step state: 'credentials' -> 'otp'
const currentStep = ref<'credentials' | 'otp'>('credentials')
const slideDirection = ref<'forward' | 'backward'>('forward')

// Form inputs
const email = ref('')
const password = ref('')
const showPassword = ref(false)
const otpCode = ref('')

// Statuses
const forgot = ref(false)
const error = ref('')
const isLoading = ref(false)
const otpSending = ref(false)
const otpMessage = ref('')

// 30-Second Resend Countdown Timer
const resendCountdown = ref(0)
let timerInterval: any = null

function startCountdown(seconds: number = 30) {
  if (timerInterval) clearInterval(timerInterval)
  resendCountdown.value = seconds
  timerInterval = setInterval(() => {
    if (resendCountdown.value > 0) {
      resendCountdown.value--
    } else {
      clearInterval(timerInterval)
      timerInterval = null
    }
  }, 1000)
}

onUnmounted(() => {
  if (timerInterval) clearInterval(timerInterval)
})

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
  // Preload shared layout immediately
  import('@/components/RoleLayout.vue').catch(() => {})
})

function getCleanEmail(): string {
  let clean = email.value.trim()
  if (clean && !clean.includes('@')) {
    clean = `${clean}@gmail.com`
  }
  return clean
}

function isTestingEmail(emailStr: string): boolean {
  const clean = emailStr.toLowerCase().trim()
  const testList = [
    'dawatdesk.official@gmail.com',
    'admin@gmail.com',
    'manager@gmail.com',
    'waiter@gmail.com',
    'chef@gmail.com',
    'cashier@gmail.com',
    'test@gmail.com',
  ]
  return (
    testList.includes(clean) ||
    clean.startsWith('test') ||
    clean.includes('test@') ||
    clean.startsWith('admin@') ||
    clean.startsWith('manager@') ||
    clean.startsWith('waiter@') ||
    clean.startsWith('chef@') ||
    clean.startsWith('cashier@')
  )
}

// Step 1: Submit email & password, validate credentials, send OTP, and animate to OTP section
async function handleSubmitCredentials() {
  if (isLoading.value) return
  error.value = ''
  otpMessage.value = ''

  const cleanEmail = getCleanEmail()
  if (!cleanEmail) {
    error.value = 'Please enter your email address.'
    return
  }
  if (!password.value) {
    error.value = 'Please enter your password.'
    return
  }

  const isTest = isTestingEmail(cleanEmail)
  isLoading.value = true

  try {
    // 1. Validate credentials with backend
    await loginUser(cleanEmail, password.value)

    // 2. Dispatch OTP / request access
    const res = (await sendOtp(cleanEmail, 'login')) as any

    if (isTest) {
      // Direct access for testing emails with 123456
      otpCode.value = '123456'
      otpMessage.value = 'Testing account: direct OTP 123456 prefilled.'
    } else {
      // Real emails require manual entry from inbox
      otpCode.value = ''
      otpMessage.value = res?.message || `A 6-digit verification code has been sent to ${cleanEmail}.`
    }

    // 3. Start 30-second countdown for resend
    startCountdown(30)

    // 4. Smooth slide transition into OTP section
    slideDirection.value = 'forward'
    currentStep.value = 'otp'
  } catch (err: any) {
    error.value = err.message || 'Invalid email or password.'
  } finally {
    isLoading.value = false
  }
}

// Resend OTP button handler (active after 30 seconds)
async function handleResendOtp() {
  if (resendCountdown.value > 0 || otpSending.value) return
  error.value = ''
  otpSending.value = true

  const cleanEmail = getCleanEmail()
  const isTest = isTestingEmail(cleanEmail)

  try {
    const res = (await sendOtp(cleanEmail, 'login')) as any
    if (isTest) {
      otpCode.value = '123456'
      otpMessage.value = 'Testing account: direct OTP 123456 ready.'
    } else {
      otpCode.value = ''
      otpMessage.value = res?.message || `A fresh verification code has been sent to ${cleanEmail}.`
    }
    startCountdown(30)
  } catch (err: any) {
    error.value = err.message || 'Failed to resend code. Please try again.'
  } finally {
    otpSending.value = false
  }
}

// Step 2: OTP verification
async function handleVerifyOtp() {
  if (isLoading.value) return
  error.value = ''

  const cleanOtp = otpCode.value.replace(/\s+/g, '')
  if (!cleanOtp || cleanOtp.length < 6) {
    error.value = 'Please enter the complete 6-digit code.'
    return
  }

  isLoading.value = true
  const cleanEmail = getCleanEmail()

  try {
    await auth.signInWithOtp(cleanEmail, cleanOtp)
    if (auth.user) {
      router.push(ROLE_HOMES[auth.user.role] || '/')
    }
  } catch (err: any) {
    error.value = err.message || 'Invalid or expired OTP code. Please check your email and try again.'
  } finally {
    isLoading.value = false
  }
}

// Back to credentials step
function goBackToCredentials() {
  error.value = ''
  otpCode.value = ''
  slideDirection.value = 'backward'
  currentStep.value = 'credentials'
}
</script>

<template>
  <div class="w-full min-h-screen lg:h-screen lg:overflow-hidden grid lg:grid-cols-2 relative bg-background selection:bg-primary/20 selection:text-primary">
    <!-- Visual Branding Side (Full Height, 50% Width on Large Screens) -->
    <div
      class="hidden lg:flex relative overflow-hidden bg-gradient-to-br from-[#090d16] via-[#0f172a] to-[#151b2d] p-8 xl:p-12 flex-col justify-between border-r border-white/10 h-full select-none"
    >
      <div class="absolute inset-0 paper-tex opacity-60 pointer-events-none" />
      <div
        class="absolute inset-0 pointer-events-none"
        style="background: radial-gradient(680px circle at 15% 10%, oklch(0.7 0.18 45 / 0.30), transparent 60%), radial-gradient(520px circle at 90% 95%, oklch(0.58 0.2 28 / 0.28), transparent 60%);"
      />
      <div class="relative flex items-center">
        <DawatDeskLogo variant="dark" size="lg" />
      </div>
      <div class="relative space-y-6 text-white max-w-lg">
        <div class="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/15 bg-white/5 text-xs text-white/80 backdrop-blur">
          <span class="h-1.5 w-1.5 rounded-full bg-primary-glow animate-pulse" />
          Loved by 1,200+ kitchens around the world
        </div>
        <h1 class="font-display text-4xl xl:text-5xl 2xl:text-6xl font-bold leading-[1.08] tracking-tight">
          Run a warmer,<br />
          <span class="italic gradient-text">tastier</span> restaurant.
        </h1>
        <p class="text-white/70 text-sm xl:text-base leading-relaxed">
          From the first hello at the door to the last bite on the plate — DawatDesk keeps your front of house,
          kitchen, and bar moving together, beautifully.
        </p>
        <div class="grid grid-cols-3 gap-3 pt-2">
          <div
            v-for="s in [
              { v: '1.2K+', l: 'Restaurants' },
              { v: '45M', l: 'Plates served' },
              { v: '4.9★', l: 'Staff rating' },
            ]"
            :key="s.l"
            class="rounded-2xl border border-white/10 bg-white/5 p-3.5 xl:p-4 backdrop-blur-sm"
          >
            <div class="font-display text-xl xl:text-2xl font-bold">{{ s.v }}</div>
            <div class="text-[10px] xl:text-[10.5px] text-white/60 uppercase tracking-wider mt-0.5">{{ s.l }}</div>
          </div>
        </div>
      </div>
      <div class="relative text-xs text-white/50 italic">
        “The whole team finally speaks the same language.” — Chef Marco, Trattoria Lumière
      </div>
    </div>

    <!-- Form Side (Full Height, Centered Content with Atmospheric Background & Glass Card) -->
    <div class="relative flex items-center justify-center p-4 sm:p-8 lg:p-12 xl:p-16 h-full overflow-y-auto bg-gradient-to-b from-background via-muted/25 to-background">
      <!-- Ambient Lighting Orbs for subtle depth on Desktop and Phone screens -->
      <div class="absolute inset-0 pointer-events-none overflow-hidden select-none">
        <div class="absolute -top-28 -right-28 w-80 sm:w-96 h-80 sm:h-96 rounded-full bg-primary/10 blur-3xl opacity-70" />
        <div class="absolute -bottom-28 -left-28 w-80 sm:w-96 h-80 sm:h-96 rounded-full bg-amber-500/10 blur-3xl opacity-60" />
        <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-[radial-gradient(ellipse_at_center,transparent_30%,rgba(0,0,0,0.03)_100%)] dark:bg-[radial-gradient(ellipse_at_center,transparent_30%,rgba(255,255,255,0.015)_100%)]" />
      </div>

      <div class="w-full max-w-[420px] sm:max-w-[460px] my-auto relative z-10 py-6 sm:py-0">
        <!-- Elevated Glass Card -->
        <div class="relative bg-card/95 backdrop-blur-xl border border-border/80 rounded-3xl p-6 sm:p-9 shadow-card sm:shadow-2xl shadow-slate-900/5 dark:shadow-black/50 space-y-6 overflow-hidden transition-all">
          <!-- Top subtle accent gradient stripe -->
          <div class="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-primary via-primary-glow to-amber-500" />

          <!-- Logo & Mobile Header Tagline -->
          <div class="flex items-center justify-between">
            <DawatDeskLogo variant="auto" size="md" />
            <div class="lg:hidden inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 border border-primary/20 text-[10.5px] font-semibold text-primary">
              <span class="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
              1.2K+ Kitchens
            </div>
          </div>

          <!-- Forgot Password View -->
          <div v-if="forgot" class="space-y-4 animate-fade-in">
            <div>
              <h2 class="font-display text-2xl lg:text-3xl font-bold leading-tight text-foreground">Reset password</h2>
              <p class="text-muted-foreground text-xs sm:text-sm mt-1">We'll send a recovery link to your registered email address.</p>
            </div>
            <div class="space-y-1.5">
              <label class="text-xs sm:text-sm font-medium flex items-center gap-1.5 text-foreground">
                <Mail class="h-3.5 w-3.5 text-muted-foreground" />
                Email address
              </label>
              <Input
                type="email"
                placeholder="name@company.com"
                class="h-11 text-sm bg-background/60 focus:bg-background border-border/80 focus:border-primary transition"
              />
            </div>
            <Button
              class="w-full h-11 text-sm gradient-primary text-primary-foreground font-semibold shadow-glow hover:opacity-95 active:scale-[0.99] rounded-xl cursor-pointer"
              @click="forgot = false"
            >
              Send recovery link
            </Button>
            <button
              @click="forgot = false"
              class="text-xs sm:text-sm text-muted-foreground hover:text-foreground cursor-pointer flex items-center justify-center gap-1.5 font-medium transition mx-auto pt-1"
            >
              <ArrowLeft class="h-3.5 w-3.5" /> Back to sign in
            </button>
          </div>

          <!-- Main Auth Workflow with Smooth Transition Animation -->
          <div v-else class="relative overflow-hidden">
            <Transition :name="slideDirection === 'forward' ? 'step-forward' : 'step-backward'" mode="out-in">
              <!-- STEP 1: Email & Password Form -->
              <div v-if="currentStep === 'credentials'" key="credentials-step" class="space-y-5">
                <div>
                  <h2 class="font-display text-2xl sm:text-3xl font-bold leading-tight text-foreground">Welcome back</h2>
                  <p class="text-muted-foreground text-xs sm:text-sm mt-1 leading-relaxed">
                    Please enter your email and password to access your restaurant operations.
                  </p>
                </div>

                <form @submit.prevent="handleSubmitCredentials" class="space-y-4">
                  <div class="space-y-1.5">
                    <label class="text-xs sm:text-sm font-medium flex items-center gap-1.5 text-foreground">
                      <Mail class="h-3.5 w-3.5 text-muted-foreground" />
                      Email address
                    </label>
                    <Input
                      type="email"
                      v-model="email"
                      placeholder="name@company.com"
                      required
                      class="h-11 text-sm bg-background/60 focus:bg-background border-border/80 focus:border-primary transition"
                      autocomplete="username"
                    />
                  </div>

                  <div class="space-y-1.5">
                    <div class="flex items-center justify-between">
                      <label class="text-xs sm:text-sm font-medium flex items-center gap-1.5 text-foreground">
                        <Lock class="h-3.5 w-3.5 text-muted-foreground" />
                        Password
                      </label>
                      <button
                        type="button"
                        @click="forgot = true"
                        class="text-xs text-primary hover:underline cursor-pointer font-medium transition"
                      >
                        Forgot password?
                      </button>
                    </div>
                    <div class="relative">
                      <Input
                        :type="showPassword ? 'text' : 'password'"
                        v-model="password"
                        placeholder="••••••••"
                        required
                        class="h-11 text-sm pr-10 bg-background/60 focus:bg-background border-border/80 focus:border-primary transition"
                        autocomplete="current-password"
                      />
                      <button
                        type="button"
                        @click="showPassword = !showPassword"
                        class="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer transition p-1"
                        tabindex="-1"
                        :aria-label="showPassword ? 'Hide password' : 'Show password'"
                      >
                        <EyeOff v-if="showPassword" class="h-4 w-4" />
                        <Eye v-else class="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <div
                    v-if="error"
                    class="p-3 rounded-xl bg-destructive/10 border border-destructive/25 text-xs sm:text-sm text-destructive font-medium flex items-start gap-2 animate-fade-in"
                  >
                    <AlertCircle class="h-4 w-4 shrink-0 mt-0.5 text-destructive" />
                    <span>{{ error }}</span>
                  </div>

                  <Button
                    type="submit"
                    :disabled="isLoading"
                    class="w-full h-11 gradient-primary text-primary-foreground font-semibold shadow-glow hover:opacity-95 active:scale-[0.99] text-sm cursor-pointer flex items-center justify-center gap-2 rounded-xl transition duration-150"
                  >
                    <span v-if="isLoading" class="flex items-center gap-2">
                      <RefreshCw class="h-4 w-4 animate-spin" />
                      Checking credentials...
                    </span>
                    <span v-else class="flex items-center gap-2">
                      Sign In
                      <ArrowRight class="h-4 w-4" />
                    </span>
                  </Button>

                  <div class="pt-2 border-t border-border/50 flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground/80 font-medium">
                    <ShieldCheck class="h-3.5 w-3.5 text-primary" />
                    <span>Protected with two-factor OTP verification</span>
                  </div>
                </form>
              </div>

              <!-- STEP 2: Manual OTP Verification Form with 30s Resend Timer -->
              <div v-else key="otp-step" class="space-y-5">
                <div>
                  <div class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 border border-primary/20 text-xs text-primary font-medium mb-2">
                    <ShieldCheck class="h-3.5 w-3.5" />
                    Email OTP Verification
                  </div>
                  <h2 class="font-display text-2xl sm:text-3xl font-bold leading-tight text-foreground">Enter OTP Code</h2>
                  <p class="text-muted-foreground text-xs sm:text-sm mt-1 leading-relaxed">
                    We've sent a 6-digit code to <strong class="text-foreground font-semibold">{{ getCleanEmail() }}</strong>
                  </p>
                </div>

                <!-- Real Notification Banner -->
                <div v-if="otpMessage" class="p-3.5 rounded-xl bg-primary/10 border border-primary/20 text-xs text-primary flex items-start gap-2.5">
                  <CheckCircle2 class="h-4 w-4 shrink-0 mt-0.5 text-primary" />
                  <div class="space-y-0.5">
                    <div class="font-semibold">{{ otpMessage }}</div>
                    <div v-if="isTestingEmail(getCleanEmail())" class="text-[11px] text-primary/80 font-medium">
                      Testing account: Direct access with code 123456 (no email verification needed).
                    </div>
                    <div v-else class="text-[11px] text-muted-foreground">
                      Please check your inbox or spam folder for your 6-digit code.
                    </div>
                  </div>
                </div>

                <form @submit.prevent="handleVerifyOtp" class="space-y-4">
                  <div class="space-y-2">
                    <div class="flex items-center justify-between">
                      <label class="text-xs sm:text-sm font-medium text-foreground">6-Digit Verification Code</label>
                      <span class="text-[11px] text-muted-foreground font-medium">Valid for 10 mins</span>
                    </div>
                    <Input
                      type="text"
                      v-model="otpCode"
                      placeholder="• • • • • •"
                      maxlength="6"
                      pattern="[0-9]*"
                      class="text-center font-mono text-2xl tracking-[0.4em] font-bold h-12 rounded-xl bg-background/70 focus:bg-background border-border/80 focus:border-primary transition"
                      required
                      autofocus
                      autocomplete="one-time-code"
                    />
                  </div>

                  <!-- 30-Second Resend Countdown Section -->
                  <div class="flex items-center justify-between text-xs py-1 px-0.5">
                    <span class="text-muted-foreground">Didn't receive the email?</span>
                    <div>
                      <span v-if="resendCountdown > 0" class="text-muted-foreground font-medium">
                        Resend in <span class="text-primary font-bold">{{ resendCountdown }}s</span>
                      </span>
                      <button
                        v-else
                        type="button"
                        @click="handleResendOtp"
                        :disabled="otpSending"
                        class="text-primary font-semibold hover:underline cursor-pointer flex items-center gap-1 transition"
                      >
                        <RefreshCw v-if="otpSending" class="h-3 w-3 animate-spin" />
                        Resend OTP
                      </button>
                    </div>
                  </div>

                  <div
                    v-if="error"
                    class="p-3 rounded-xl bg-destructive/10 border border-destructive/25 text-xs sm:text-sm text-destructive font-medium flex items-start gap-2 animate-fade-in"
                  >
                    <AlertCircle class="h-4 w-4 shrink-0 mt-0.5 text-destructive" />
                    <span>{{ error }}</span>
                  </div>

                  <Button
                    type="submit"
                    :disabled="isLoading || otpCode.trim().length !== 6"
                    class="w-full h-11 gradient-primary text-primary-foreground font-semibold shadow-glow hover:opacity-95 active:scale-[0.99] text-sm cursor-pointer flex items-center justify-center gap-2 rounded-xl transition duration-150"
                  >
                    <RefreshCw v-if="isLoading" class="h-4 w-4 animate-spin" />
                    <span>{{ isLoading ? 'Verifying Code...' : 'Verify & Sign In' }}</span>
                  </Button>

                  <div class="pt-1">
                    <button
                      type="button"
                      @click="goBackToCredentials"
                      class="w-full text-center text-xs text-muted-foreground hover:text-foreground cursor-pointer flex items-center justify-center gap-1.5 transition py-1 font-medium"
                    >
                      <ArrowLeft class="h-3.5 w-3.5" />
                      Change email or password
                    </button>
                  </div>
                </form>
              </div>
            </Transition>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Step Forward Animation (Slide to Left) */
.step-forward-enter-active,
.step-forward-leave-active {
  transition: all 0.28s cubic-bezier(0.16, 1, 0.3, 1);
}
.step-forward-enter-from {
  opacity: 0;
  transform: translateX(35px);
}
.step-forward-leave-to {
  opacity: 0;
  transform: translateX(-35px);
}

/* Step Backward Animation (Slide to Right) */
.step-backward-enter-active,
.step-backward-leave-active {
  transition: all 0.28s cubic-bezier(0.16, 1, 0.3, 1);
}
.step-backward-enter-from {
  opacity: 0;
  transform: translateX(-35px);
}
.step-backward-leave-to {
  opacity: 0;
  transform: translateX(35px);
}
</style>

<style scoped>
/* Step Forward Animation (Slide to Left) */
.step-forward-enter-active,
.step-forward-leave-active {
  transition: all 0.28s cubic-bezier(0.16, 1, 0.3, 1);
}
.step-forward-enter-from {
  opacity: 0;
  transform: translateX(35px);
}
.step-forward-leave-to {
  opacity: 0;
  transform: translateX(-35px);
}

/* Step Backward Animation (Slide to Right) */
.step-backward-enter-active,
.step-backward-leave-active {
  transition: all 0.28s cubic-bezier(0.16, 1, 0.3, 1);
}
.step-backward-enter-from {
  opacity: 0;
  transform: translateX(-35px);
}
.step-backward-leave-to {
  opacity: 0;
  transform: translateX(35px);
}
</style>
