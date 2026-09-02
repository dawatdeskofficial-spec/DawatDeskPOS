<script setup lang="ts">
import { ref, watch } from 'vue'
import { User, Mail, Phone, MapPin, Shield, CheckCircle2, Save } from 'lucide-vue-next'
import RoleLayout from '@/components/RoleLayout.vue'
import PageHeader from '@/components/PageHeader.vue'
import Button from '@/components/ui/Button.vue'
import Input from '@/components/ui/Input.vue'
import { useRouter } from 'vue-router'
import { useAuthStore, ROLE_LABELS, ROLE_HOMES, type AppRole } from '@/stores/auth'
import { adminNav, restaurantNav, waiterNav, chefNav, cashierNav } from '@/lib/nav'

const auth = useAuthStore()
const router = useRouter()

const roleNavMap: Record<AppRole, typeof adminNav> = {
  main_admin: adminNav,
  restaurant_admin: restaurantNav,
  waiter: waiterNav,
  chef: chefNav,
  cashier: cashierNav,
}

const form = ref({ name: "", phone: "", location: "" })
const loading = ref(false)
const message = ref<string | null>(null)
const error = ref<string | null>(null)

watch(() => auth.user, (user) => {
  if (user) {
    form.value = {
      name: user.name,
      phone: user.phone ?? "",
      location: user.location ?? "",
    }
  }
}, { immediate: true })

async function handleSubmit() {
  error.value = null;
  message.value = null;
  loading.value = true;

  if (!form.value.name.trim()) {
    error.value = "Name is required.";
    loading.value = false;
    return;
  }

  try {
    await auth.updateProfile({
      name: form.value.name.trim(),
      phone: form.value.phone.trim(),
      location: form.value.location.trim(),
    });
    message.value = "Profile saved successfully.";
    setTimeout(() => message.value = null, 3000);
  } catch (err: any) {
    error.value = err.message || "Unable to update profile.";
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <RoleLayout v-if="auth.user" :role="auth.user.role" :nav="roleNavMap[auth.user.role]">
    <PageHeader title="My Profile" subtitle="Manage your personal information and account settings.">
      <template #action>
        <Button variant="outline" class="h-9 px-4 gap-2 font-semibold" @click="router.push(ROLE_HOMES[auth.user.role])">
          ← Back to Dashboard
        </Button>
      </template>
    </PageHeader>

    <div class="max-w-5xl">
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        <!-- Left Column: Profile Overview Card -->
        <div class="lg:col-span-1">
          <div class="rounded-3xl border border-border bg-card shadow-soft overflow-hidden relative">
            <div class="h-32 bg-gradient-to-br from-primary/30 to-accent/40 w-full grid-bg" />
            <div class="px-6 pb-6 relative flex flex-col items-center text-center">
              <div class="h-24 w-24 rounded-full border-4 border-card bg-background shadow-soft -mt-12 mb-4 grid place-items-center">
                <div class="h-full w-full rounded-full gradient-primary flex items-center justify-center text-3xl font-display font-bold text-primary-foreground">
                  {{ auth.user.name?.[0]?.toUpperCase() ?? "U" }}
                </div>
              </div>
              
              <h2 class="text-xl font-display font-bold tracking-tight text-foreground">{{ auth.user.name }}</h2>
              <div class="text-sm text-muted-foreground mt-1 flex items-center justify-center gap-1.5">
                <Shield class="h-3.5 w-3.5" />
                {{ ROLE_LABELS[auth.user.role] }}
              </div>
              
              <div class="mt-4 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-success/10 text-success">
                <CheckCircle2 class="h-3.5 w-3.5" />
                {{ auth.user.isActive ? "Active Account" : "Inactive Account" }}
              </div>
            </div>

            <div class="border-t border-border px-6 py-4 space-y-4">
              <div class="flex items-start gap-3">
                <Mail class="h-4 w-4 text-muted-foreground mt-0.5" />
                <div class="min-w-0">
                  <div class="text-xs font-medium text-muted-foreground uppercase tracking-wider">Email</div>
                  <div class="text-sm font-medium mt-0.5 truncate">{{ auth.user.email }}</div>
                </div>
              </div>
              <div class="flex items-start gap-3">
                <Phone class="h-4 w-4 text-muted-foreground mt-0.5" />
                <div class="min-w-0">
                  <div class="text-xs font-medium text-muted-foreground uppercase tracking-wider">Phone</div>
                  <div class="text-sm font-medium mt-0.5 truncate">{{ auth.user.phone || "Not provided" }}</div>
                </div>
              </div>
              <div class="flex items-start gap-3">
                <MapPin class="h-4 w-4 text-muted-foreground mt-0.5" />
                <div class="min-w-0">
                  <div class="text-xs font-medium text-muted-foreground uppercase tracking-wider">Location</div>
                  <div class="text-sm font-medium mt-0.5 truncate">{{ auth.user.location || "Not provided" }}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Right Column: Edit Profile Form -->
        <div class="lg:col-span-2">
          <div class="rounded-3xl border border-border bg-card p-6 sm:p-8 shadow-soft">
            <div class="flex items-center gap-2 mb-6">
              <div class="h-8 w-8 rounded-lg gradient-primary grid place-items-center">
                <User class="h-4 w-4 text-primary-foreground" />
              </div>
              <h3 class="text-lg font-display font-semibold">Personal Information</h3>
            </div>

            <form @submit.prevent="handleSubmit" class="space-y-6">
              <div class="grid gap-6 sm:grid-cols-2">
                <label class="space-y-2 text-sm font-medium">
                  <span class="text-muted-foreground">Full Name</span>
                  <Input
                    v-model="form.name"
                    required
                    class="bg-muted/40 h-11"
                  />
                </label>
                <label class="space-y-2 text-sm font-medium opacity-70">
                  <span class="text-muted-foreground">Email Address</span>
                  <Input 
                    :modelValue="auth.user.email" 
                    disabled 
                    class="bg-muted/20 h-11 cursor-not-allowed" 
                  />
                  <p class="text-[10px] text-muted-foreground px-1">Email cannot be changed.</p>
                </label>
              </div>

              <div class="grid gap-6 sm:grid-cols-2">
                <label class="space-y-2 text-sm font-medium">
                  <span class="text-muted-foreground">Phone Number</span>
                  <Input
                    type="tel"
                    v-model="form.phone"
                    placeholder="+1 (555) 000-0000"
                    class="bg-muted/40 h-11"
                  />
                </label>
                <label class="space-y-2 text-sm font-medium">
                  <span class="text-muted-foreground">Location</span>
                  <Input
                    v-model="form.location"
                    placeholder="City, State"
                    class="bg-muted/40 h-11"
                  />
                </label>
              </div>

              <div v-if="error" class="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive animate-fade-in flex items-center gap-2">
                <div class="h-2 w-2 rounded-full bg-destructive" />
                {{ error }}
              </div>
              <div v-if="message" class="rounded-xl border border-success/30 bg-success/10 px-4 py-3 text-sm text-success animate-fade-in flex items-center gap-2">
                <CheckCircle2 class="h-4 w-4" />
                {{ message }}
              </div>

              <div class="pt-4 border-t border-border flex justify-end">
                <Button type="submit" :disabled="loading" class="h-11 px-6 gradient-primary text-primary-foreground shadow-glow hover-lift">
                  {{ loading ? "Saving Changes..." : "" }}
                  <template v-if="!loading">
                    <Save class="h-4 w-4 mr-2" />
                    Save Changes
                  </template>
                </Button>
              </div>
            </form>
          </div>
        </div>

      </div>
    </div>
  </RoleLayout>
</template>
