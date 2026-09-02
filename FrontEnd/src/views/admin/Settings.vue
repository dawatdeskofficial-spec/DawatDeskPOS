<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Save, RefreshCw, Settings as SettingsIcon, AlertTriangle, ShieldCheck, Mail, MessageSquare, BadgePercent, Coins, Clock, Layers } from 'lucide-vue-next'
import RoleLayout from '@/components/RoleLayout.vue'
import PageHeader from '@/components/PageHeader.vue'
import { adminNav } from '@/lib/nav'
import { getSystemSettings, updateSystemSettings } from '@/lib/api'
import Button from '@/components/ui/Button.vue'
import Input from '@/components/ui/Input.vue'
import Switch from '@/components/ui/Switch.vue'
import { toast } from 'vue-sonner'

const loading = ref(true)
const saving = ref(false)

const settings = ref({
  gstPercentage: 5,
  serviceChargePercentage: 0,
  currency: 'INR',
  notificationsEnabled: true,
  emailNotifications: true,
  smsNotifications: false,
  maintenanceMode: false,
  maxOrdersPerTable: 5,
  defaultPreparationTime: 15
})

const initialSettings = ref<any>(null)

async function fetchSettings() {
  loading.value = true
  try {
    const res = await getSystemSettings()
    if (res.success && res.data) {
      settings.value = {
        gstPercentage: res.data.gstPercentage ?? 5,
        serviceChargePercentage: res.data.serviceChargePercentage ?? 0,
        currency: res.data.currency ?? 'INR',
        notificationsEnabled: res.data.notificationsEnabled ?? true,
        emailNotifications: res.data.emailNotifications ?? true,
        smsNotifications: res.data.smsNotifications ?? false,
        maintenanceMode: res.data.maintenanceMode ?? false,
        maxOrdersPerTable: res.data.maxOrdersPerTable ?? 5,
        defaultPreparationTime: res.data.defaultPreparationTime ?? 15
      }
      initialSettings.value = JSON.parse(JSON.stringify(settings.value))
    }
  } catch (err: any) {
    toast.error(err.message || 'Failed to load system settings')
  } finally {
    loading.value = false
  }
}

async function handleSave() {
  saving.value = true
  try {
    const res = await updateSystemSettings(settings.value)
    if (res.success) {
      toast.success('System settings updated successfully')
      initialSettings.value = JSON.parse(JSON.stringify(settings.value))
    } else {
      toast.error(res.message || 'Failed to update system settings')
    }
  } catch (err: any) {
    toast.error(err.message || 'An error occurred while saving')
  } finally {
    saving.value = false
  }
}

function handleReset() {
  if (initialSettings.value) {
    settings.value = JSON.parse(JSON.stringify(initialSettings.value))
    toast.info('Settings reset to last saved state')
  }
}

onMounted(() => {
  fetchSettings()
})
</script>

<template>
  <RoleLayout role="main_admin" :nav="adminNav">
    <PageHeader
      title="System Settings"
      subtitle="Configure global parameters, tax rates, kitchen buffers, and notification systems."
    >
      <template #action>
        <div class="flex items-center gap-2">
          <Button variant="ghost" size="sm" class="h-9 px-3" @click="fetchSettings" :disabled="loading || saving">
            <RefreshCw :class="['h-4 w-4 mr-2', loading && 'animate-spin']" /> Refresh
          </Button>
          <Button variant="outline" size="sm" class="h-9 px-3" @click="handleReset" :disabled="loading || saving">
            Reset
          </Button>
        </div>
      </template>
    </PageHeader>

    <div v-if="loading" class="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
      <RefreshCw class="h-8 w-8 animate-spin text-primary" />
      <span class="text-sm font-medium">Fetching current settings...</span>
    </div>

    <form v-else @submit.prevent="handleSave" class="space-y-6 max-w-4xl">
      <!-- Maintenance Mode Warning Alert -->
      <div v-if="settings.maintenanceMode" class="rounded-2xl border border-warning/30 bg-warning/10 p-4 flex gap-3 text-warning">
        <AlertTriangle class="h-5 w-5 shrink-0 mt-0.5" />
        <div>
          <h4 class="font-bold text-sm">System in Maintenance Mode</h4>
          <p class="text-xs opacity-90 mt-1">
            While enabled, customers and restaurant staff might experience restricted access. Make sure to toggle this off once operations return to normal.
          </p>
        </div>
      </div>

      <div class="grid gap-6 md:grid-cols-2">
        <!-- Billing & Finances Card -->
        <div class="rounded-2xl border border-border bg-card p-6 shadow-soft space-y-5">
          <div class="flex items-center gap-2.5 border-b border-border pb-3.5">
            <div class="h-8 w-8 rounded-lg bg-primary/10 grid place-items-center text-primary">
              <Coins class="h-4.5 w-4.5" />
            </div>
            <div>
              <h3 class="font-display font-bold text-[16px]">Billing &amp; Finances</h3>
              <p class="text-xs text-muted-foreground">Configure tax rates and default store currency.</p>
            </div>
          </div>

          <div class="space-y-4">
            <div class="space-y-2">
              <label class="text-sm font-medium flex items-center gap-1.5">
                <BadgePercent class="h-4 w-4 text-muted-foreground" />
                <span>GST / VAT Percentage (%)</span>
              </label>
              <Input type="number" step="0.01" min="0" max="100" v-model.number="settings.gstPercentage" required />
            </div>

            <div class="space-y-2">
              <label class="text-sm font-medium flex items-center gap-1.5">
                <BadgePercent class="h-4 w-4 text-muted-foreground" />
                <span>Service Charge (%)</span>
              </label>
              <Input type="number" step="0.01" min="0" max="100" v-model.number="settings.serviceChargePercentage" required />
            </div>

            <div class="space-y-2">
              <label class="text-sm font-medium">Currency Code</label>
              <select
                v-model="settings.currency"
                class="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm text-foreground shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="INR">INR (₹)</option>
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
                <option value="GBP">GBP (£)</option>
                <option value="AED">AED (Dh)</option>
              </select>
            </div>
          </div>
        </div>

        <!-- Kitchen & Table Operations Card -->
        <div class="rounded-2xl border border-border bg-card p-6 shadow-soft space-y-5">
          <div class="flex items-center gap-2.5 border-b border-border pb-3.5">
            <div class="h-8 w-8 rounded-lg bg-info/10 grid place-items-center text-info">
              <Clock class="h-4.5 w-4.5" />
            </div>
            <div>
              <h3 class="font-display font-bold text-[16px]">Kitchen &amp; Floor</h3>
              <p class="text-xs text-muted-foreground">Adjust wait times and capacity boundaries.</p>
            </div>
          </div>

          <div class="space-y-4">
            <div class="space-y-2">
              <label class="text-sm font-medium flex items-center gap-1.5">
                <Layers class="h-4 w-4 text-muted-foreground" />
                <span>Max Active Orders Per Table</span>
              </label>
              <Input type="number" min="1" max="50" v-model.number="settings.maxOrdersPerTable" required />
            </div>

            <div class="space-y-2">
              <label class="text-sm font-medium flex items-center gap-1.5">
                <Clock class="h-4 w-4 text-muted-foreground" />
                <span>Default Preparation Time (min)</span>
              </label>
              <Input type="number" min="1" max="120" v-model.number="settings.defaultPreparationTime" required />
            </div>
          </div>
        </div>
      </div>

      <!-- Notifications & System Safety Card -->
      <div class="rounded-2xl border border-border bg-card p-6 shadow-soft space-y-5">
        <div class="flex items-center gap-2.5 border-b border-border pb-3.5">
          <div class="h-8 w-8 rounded-lg bg-warning/10 grid place-items-center text-warning">
            <ShieldCheck class="h-4.5 w-4.5" />
          </div>
          <div>
            <h3 class="font-display font-bold text-[16px]">Notifications &amp; System Settings</h3>
            <p class="text-xs text-muted-foreground">Tweak live alerting endpoints and system-wide visibility.</p>
          </div>
        </div>

        <div class="grid gap-6 sm:grid-cols-2">
          <div class="space-y-4">
            <div class="flex items-center justify-between p-3 rounded-xl hover:bg-muted/40 transition">
              <div class="space-y-0.5">
                <label class="text-sm font-semibold">Enable Live Notifications</label>
                <p class="text-xs text-muted-foreground">Receive push banners for new kitchen orders.</p>
              </div>
              <Switch v-model:checked="settings.notificationsEnabled" />
            </div>

            <div class="flex items-center justify-between p-3 rounded-xl hover:bg-muted/40 transition" :class="[!settings.notificationsEnabled && 'opacity-50 pointer-events-none']">
              <div class="space-y-0.5">
                <label class="text-sm font-semibold flex items-center gap-1.5">
                  <Mail class="h-4 w-4 text-muted-foreground" />
                  <span>Email Notifications</span>
                </label>
                <p class="text-xs text-muted-foreground">Send receipt summaries to administrators.</p>
              </div>
              <Switch v-model:checked="settings.emailNotifications" />
            </div>
          </div>

          <div class="space-y-4">
            <div class="flex items-center justify-between p-3 rounded-xl hover:bg-muted/40 transition" :class="[!settings.notificationsEnabled && 'opacity-50 pointer-events-none']">
              <div class="space-y-0.5">
                <label class="text-sm font-semibold flex items-center gap-1.5">
                  <MessageSquare class="h-4 w-4 text-muted-foreground" />
                  <span>SMS/Whatsapp Notifications</span>
                </label>
                <p class="text-xs text-muted-foreground">Ping waiters when orders change status.</p>
              </div>
              <Switch v-model:checked="settings.smsNotifications" />
            </div>

            <div class="flex items-center justify-between p-3 rounded-xl border border-destructive/20 bg-destructive/5 hover:bg-destructive/10 transition">
              <div class="space-y-0.5">
                <label class="text-sm font-semibold text-destructive flex items-center gap-1.5">
                  <AlertTriangle class="h-4 w-4" />
                  <span>Maintenance Mode</span>
                </label>
                <p class="text-xs text-muted-foreground">Restrict app usage to run database migrations.</p>
              </div>
              <Switch v-model:checked="settings.maintenanceMode" />
            </div>
          </div>
        </div>
      </div>

      <!-- Action Footer -->
      <div class="flex items-center justify-end gap-3 pt-2">
        <Button type="submit" :disabled="saving" class="gradient-primary text-primary-foreground font-semibold px-6 shadow-md">
          <Save v-if="!saving" class="h-4.5 w-4.5 mr-2" />
          <RefreshCw v-else class="h-4.5 w-4.5 mr-2 animate-spin" />
          {{ saving ? 'Saving Changes...' : 'Save Settings' }}
        </Button>
      </div>
    </form>
  </RoleLayout>
</template>
