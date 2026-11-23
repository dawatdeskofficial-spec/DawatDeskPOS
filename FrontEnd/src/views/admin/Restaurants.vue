<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import {
  Plus, Search, Edit3, X, Building2, Eye, Power,
  AlertTriangle, Phone, Mail, MapPin, CheckCircle2, Lock,
  LayoutDashboard, MessageCircle, RefreshCw, AlertCircle, BedDouble
} from 'lucide-vue-next'
import RoleLayout from '@/components/RoleLayout.vue'
import PageHeader from '@/components/PageHeader.vue'
import { adminNav } from '@/lib/nav'
import {
  getRestaurants, createRestaurant, updateRestaurant, getAllUsers,
  getWhatsAppConfig, updateWhatsAppConfig, testWhatsAppConnection,
  toggleHotelFacility
} from '@/lib/api'
import { useAuthStore } from '@/stores/auth'
import Button from '@/components/ui/Button.vue'
import Input from '@/components/ui/Input.vue'
import Badge from '@/components/ui/Badge.vue'
import Dialog from '@/components/ui/Dialog.vue'
import DialogContent from '@/components/ui/DialogContent.vue'
import DialogHeader from '@/components/ui/DialogHeader.vue'
import DialogTitle from '@/components/ui/DialogTitle.vue'
import DialogDescription from '@/components/ui/DialogDescription.vue'
import DialogFooter from '@/components/ui/DialogFooter.vue'
import AlertDialog from '@/components/ui/AlertDialog.vue'
import AlertDialogContent from '@/components/ui/AlertDialogContent.vue'
import AlertDialogHeader from '@/components/ui/AlertDialogHeader.vue'
import AlertDialogTitle from '@/components/ui/AlertDialogTitle.vue'
import AlertDialogDescription from '@/components/ui/AlertDialogDescription.vue'
import AlertDialogFooter from '@/components/ui/AlertDialogFooter.vue'
import AlertDialogCancel from '@/components/ui/AlertDialogCancel.vue'
import AlertDialogAction from '@/components/ui/AlertDialogAction.vue'
import { toast } from 'vue-sonner'

const auth = useAuthStore()
const router = useRouter()

const restaurantsList = ref<any[]>([])
const allUsersList = ref<any[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
const searchQuery = ref('')
const statusFilter = ref<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL')

const isDialogOpen = ref(false)
const activeRestaurant = ref<any>(null)
const saving = ref(false)



const filteredRestaurants = computed(() => {
  let list = restaurantsList.value

  if (statusFilter.value !== 'ALL') {
    list = list.filter(r => {
      const s = (r.status || (r.isActive ? 'ACTIVE' : 'INACTIVE')).toUpperCase()
      return s === statusFilter.value
    })
  }

  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase().trim()
    list = list.filter(r => {
      const name = (r.name || '').toLowerCase()
      const location = (r.location || '').toLowerCase()
      const phone = (r.phone || '').toLowerCase()
      const email = (r.email || '').toLowerCase()
      return name.includes(q) || location.includes(q) || phone.includes(q) || email.includes(q)
    })
  }
  return list
})

// Status Toggle Confirmation
const statusToggleConfirm = ref<{ isOpen: boolean; target: any | null; nextStatus: 'ACTIVE' | 'INACTIVE' }>({
  isOpen: false,
  target: null,
  nextStatus: 'INACTIVE'
})

// Hotel Facility Toggle Confirmation
const hotelToggleConfirm = ref<{ isOpen: boolean; target: any | null; enable: boolean }>({
  isOpen: false,
  target: null,
  enable: false
})

const formState = ref({
  name: '',
  location: '',
  phone: '',
  email: '',
  description: '',
  maxTables: 20,
  gstPercentage: 5,
  status: 'ACTIVE',
  facilities: {
    hotelRoomManagement: false,
  },
})

// WhatsApp Multi-Tenant Config Modal State
const isWhatsAppDialogOpen = ref(false)
const selectedWhatsAppRestaurant = ref<any>(null)
const whatsAppConfigLoading = ref(false)
const whatsAppConfigSaving = ref(false)
const whatsAppTesting = ref(false)
const whatsAppTestResult = ref<any>(null)

const whatsAppForm = ref({
  isEnabled: true,
  phoneNumberId: '',
  businessAccountId: '',
  accessToken: '',
  templateName: 'dawatdesk_invoice_v1',
  templateLanguage: 'en',
  autoSendDefault: true,
  status: 'ACTIVE' as 'ACTIVE' | 'INACTIVE' | 'TEST_MODE',
  isAccessTokenConfigured: false,
})

async function openWhatsAppConfigDialog(restaurant: any) {
  selectedWhatsAppRestaurant.value = restaurant
  whatsAppConfigLoading.value = true
  whatsAppTestResult.value = null
  isWhatsAppDialogOpen.value = true

  const restId = restaurant.id || restaurant._id
  try {
    const res = await getWhatsAppConfig(restId)
    if (res.data) {
      whatsAppForm.value = {
        isEnabled: res.data.isEnabled !== false,
        phoneNumberId: res.data.phoneNumberId || '',
        businessAccountId: res.data.businessAccountId || '',
        accessToken: res.data.accessToken || '',
        templateName: res.data.templateName || 'dawatdesk_invoice_v1',
        templateLanguage: res.data.templateLanguage || 'en',
        autoSendDefault: res.data.autoSendDefault !== false,
        status: res.data.status || 'ACTIVE',
        isAccessTokenConfigured: Boolean(res.data.isAccessTokenConfigured),
      }
    }
  } catch (err: any) {
    toast.error(err.message || 'Failed to load WhatsApp configuration')
  } finally {
    whatsAppConfigLoading.value = false
  }
}

async function saveWhatsAppConfig() {
  if (!selectedWhatsAppRestaurant.value) return
  const restId = selectedWhatsAppRestaurant.value.id || selectedWhatsAppRestaurant.value._id

  whatsAppConfigSaving.value = true
  try {
    const res = await updateWhatsAppConfig(restId, whatsAppForm.value)
    if (res.success) {
      toast.success(`WhatsApp configuration saved for ${selectedWhatsAppRestaurant.value.name}!`)
      isWhatsAppDialogOpen.value = false
    } else {
      toast.error(res.message || 'Failed to save configuration')
    }
  } catch (err: any) {
    toast.error(err.message || 'Error saving WhatsApp configuration')
  } finally {
    whatsAppConfigSaving.value = false
  }
}

async function testWhatsAppConfig() {
  if (!selectedWhatsAppRestaurant.value) return
  const restId = selectedWhatsAppRestaurant.value.id || selectedWhatsAppRestaurant.value._id

  whatsAppTesting.value = true
  whatsAppTestResult.value = null
  try {
    const res = await testWhatsAppConnection(restId)
    whatsAppTestResult.value = res.data
    if (res.data?.isConfigured) {
      toast.success('WhatsApp API connection verified!')
    } else {
      toast.info('Test mode active (simulated delivery)')
    }
  } catch (err: any) {
    toast.error(err.message || 'Test connection failed')
    whatsAppTestResult.value = { message: err.message, isConfigured: false }
  } finally {
    whatsAppTesting.value = false
  }
}

async function fetchRestaurants() {
  loading.value = true
  try {
    const [restRes, usersRes] = await Promise.all([
      getRestaurants(),
      getAllUsers(1, 1000).catch(() => ({ data: [] }))
    ])
    restaurantsList.value = restRes.data || []
    allUsersList.value = usersRes.data || []
    error.value = null
  } catch (err: any) {
    error.value = err.message || 'Failed to load restaurants.'
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  fetchRestaurants()
})

function getStaffCount(rId: string) {
  return allUsersList.value.filter((u: any) => {
    const userRId = typeof u.restaurantId === 'string' ? u.restaurantId : u.restaurantId?._id || u.restaurantId?.id
    return userRId === rId
  }).length
}

function resetForm() {
  formState.value = {
    name: '',
    location: '',
    phone: '',
    email: '',
    description: '',
    maxTables: 20,
    gstPercentage: 5,
    status: 'ACTIVE',
    facilities: {
      hotelRoomManagement: false,
    },
  }
  activeRestaurant.value = null
}

function openCreateDialog() {
  resetForm()
  isDialogOpen.value = true
}

function openEditDialog(r: any) {
  activeRestaurant.value = r
  formState.value = {
    name: r.name || '',
    location: r.location || '',
    phone: r.phone || '',
    email: r.email || '',
    description: r.description || '',
    maxTables: r.maxTables || 20,
    gstPercentage: r.gstPercentage || 5,
    status: r.status || (r.isActive !== false ? 'ACTIVE' : 'INACTIVE'),
    facilities: {
      hotelRoomManagement: Boolean(r.facilities?.hotelRoomManagement),
    },
  }
  isDialogOpen.value = true
}

function promptHotelToggle(r: any) {
  const current = Boolean(r.facilities?.hotelRoomManagement)
  hotelToggleConfirm.value = {
    isOpen: true,
    target: r,
    enable: !current,
  }
}

async function confirmHotelToggle() {
  const target = hotelToggleConfirm.value.target
  if (!target) return
  const rId = target.id || target._id
  const nextVal = hotelToggleConfirm.value.enable

  try {
    await toggleHotelFacility(rId, nextVal)
    if (!target.facilities) target.facilities = {}
    target.facilities.hotelRoomManagement = nextVal
    toast.success(
      nextVal
        ? `Hotel Room Management is now ENABLED for ${target.name}. Default room categories seeded.`
        : `Hotel Room Management has been DISABLED for ${target.name}. Historical records preserved.`
    )
    await fetchRestaurants()
  } catch (err: any) {
    toast.error(err.message || 'Failed to update hotel facility')
  } finally {
    hotelToggleConfirm.value = { isOpen: false, target: null, enable: false }
  }
}

// ── Inspect Restaurant: Opens full Restaurant Admin portal for that venue ────
function inspectRestaurant(r: any) {
  const rId = r.id || r._id
  if (!rId) return
  auth.setInspectedRestaurant(rId)
  toast.success(`Switched to ${r.name}. Viewing as Restaurant Admin.`)
  router.push('/restaurant/dashboard')
}

// ── Toggle Active / Inactive Status (No Delete) ──────────────────────────────
function promptStatusToggle(r: any) {
  const current = (r.status || (r.isActive !== false ? 'ACTIVE' : 'INACTIVE')).toUpperCase()
  const nextStatus = current === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'
  statusToggleConfirm.value = {
    isOpen: true,
    target: r,
    nextStatus
  }
}

async function confirmStatusToggle() {
  const target = statusToggleConfirm.value.target
  if (!target) return
  const rId = target.id || target._id
  const nextStatus = statusToggleConfirm.value.nextStatus

  try {
    await updateRestaurant(rId, {
      status: nextStatus,
      isActive: nextStatus === 'ACTIVE'
    })
    toast.success(
      nextStatus === 'ACTIVE'
        ? `${target.name} is now Active.`
        : `${target.name} has been Deactivated.`
    )
    await fetchRestaurants()
  } catch (err: any) {
    toast.error(err.message || 'Failed to update restaurant status.')
  } finally {
    statusToggleConfirm.value = { isOpen: false, target: null, nextStatus: 'INACTIVE' }
  }
}

async function handleSave() {
  saving.value = true
  error.value = null
  try {
    if (activeRestaurant.value) {
      await updateRestaurant(activeRestaurant.value.id || activeRestaurant.value._id, formState.value)
      toast.success(`Updated ${formState.value.name}`)
    } else {
      await createRestaurant(formState.value)
      toast.success(`Created new venue: ${formState.value.name}`)
    }
    isDialogOpen.value = false
    await fetchRestaurants()
  } catch (err: any) {
    error.value = err.message || 'Failed to save restaurant.'
    toast.error(error.value || 'Failed to save restaurant.')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <RoleLayout role="main_admin" :nav="adminNav">
    <PageHeader
      title="Restaurants"
      subtitle="Manage branches, table capacities, and operational status."
    >
      <template #action>
        <Button class="gradient-primary text-primary-foreground font-bold shadow-xs gap-1.5 rounded-xl h-9 text-xs" @click="openCreateDialog">
          <Plus class="h-4 w-4" /> Add Restaurant
        </Button>
      </template>
    </PageHeader>

    <div v-if="error" class="mb-4 rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-xs text-destructive">
      {{ error }}
    </div>

    <!-- Main Restaurant Venues Container Card -->
    <div class="rounded-2xl bg-card border border-border shadow-xs overflow-hidden">
      <!-- Search & Status Filter Bar -->
      <div class="p-3.5 sm:p-4 border-b border-border flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 bg-muted/20">
        <div class="relative flex-1 max-w-sm w-full">
          <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            v-model="searchQuery"
            placeholder="Search by name, city, email..."
            class="pl-8.5 pr-8 bg-background border-border text-xs h-9 rounded-xl"
          />
          <button
            v-if="searchQuery"
            @click="searchQuery = ''"
            class="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
          >
            <X class="h-3.5 w-3.5" />
          </button>
        </div>

        <!-- Filter Status Tabs -->
        <div class="flex items-center gap-1 bg-muted/50 p-1 rounded-xl border border-border text-xs font-semibold shrink-0">
          <button
            @click="statusFilter = 'ALL'"
            :class="['px-3 py-1 rounded-lg transition cursor-pointer text-xs', statusFilter === 'ALL' ? 'bg-card text-foreground shadow-2xs font-bold' : 'text-muted-foreground hover:text-foreground']"
          >
            All ({{ restaurantsList.length }})
          </button>
          <button
            @click="statusFilter = 'ACTIVE'"
            :class="['px-3 py-1 rounded-lg transition cursor-pointer text-xs', statusFilter === 'ACTIVE' ? 'bg-card text-emerald-600 dark:text-emerald-400 shadow-2xs font-bold' : 'text-muted-foreground hover:text-foreground']"
          >
            Active ({{ restaurantsList.filter(r => (r.status || (r.isActive !== false ? 'ACTIVE' : 'INACTIVE')).toUpperCase() === 'ACTIVE').length }})
          </button>
          <button
            @click="statusFilter = 'INACTIVE'"
            :class="['px-3 py-1 rounded-lg transition cursor-pointer text-xs', statusFilter === 'INACTIVE' ? 'bg-card text-rose-600 dark:text-rose-400 shadow-2xs font-bold' : 'text-muted-foreground hover:text-foreground']"
          >
            Inactive ({{ restaurantsList.filter(r => (r.status || (r.isActive !== false ? 'ACTIVE' : 'INACTIVE')).toUpperCase() === 'INACTIVE').length }})
          </button>
        </div>
      </div>

      <div class="p-4 sm:p-5">
        <div v-if="loading" class="py-16 text-center text-muted-foreground text-xs">
          <div class="animate-pulse space-y-2">
            <Building2 class="h-8 w-8 mx-auto opacity-40 text-primary animate-bounce" />
            <p class="font-medium">Loading restaurant branches...</p>
          </div>
        </div>

        <div v-else-if="restaurantsList.length === 0" class="py-16 text-center text-muted-foreground">
          <Building2 class="h-10 w-10 mx-auto mb-2 opacity-30 text-primary" />
          <p class="font-bold text-base text-foreground">No restaurants added yet</p>
          <p class="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">Click "Add Restaurant" above to register your first restaurant venue branch.</p>
          <Button class="mt-4 gradient-primary text-primary-foreground font-bold shadow-xs rounded-xl h-9 text-xs" @click="openCreateDialog">
            <Plus class="h-4 w-4 mr-1" /> Add First Restaurant
          </Button>
        </div>

        <div v-else-if="filteredRestaurants.length === 0" class="py-16 text-center text-muted-foreground text-xs">
          <p class="font-semibold text-sm text-foreground">No restaurants found</p>
          <p class="text-xs mt-1">No venue matches your search criteria "{{ searchQuery }}".</p>
          <button @click="searchQuery = ''; statusFilter = 'ALL'" class="mt-3 text-primary underline cursor-pointer font-bold inline-block">
            Clear all filters
          </button>
        </div>

        <!-- Cards Grid -->
        <div v-else class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <div
            v-for="r in filteredRestaurants"
            :key="r.id || r._id"
            class="rounded-2xl border border-border bg-card/60 hover:bg-card hover:border-primary/40 hover:shadow-md transition-all duration-200 flex flex-col justify-between overflow-hidden group"
          >
            <!-- Card Body -->
            <div class="p-4.5 space-y-3.5">
              <!-- Top Header: Avatar + Name + Status & Facilities Badges -->
              <div class="flex items-start justify-between gap-3">
                <div class="flex items-center gap-3 min-w-0 flex-1">
                  <div class="h-11 w-11 rounded-2xl gradient-primary text-primary-foreground flex items-center justify-center font-black text-base shadow-xs shrink-0 group-hover:scale-105 transition">
                    {{ (r.name || 'R').charAt(0).toUpperCase() }}
                  </div>
                  <div class="min-w-0 flex-1">
                    <h3
                      class="font-display font-bold text-sm sm:text-base text-foreground truncate leading-tight group-hover:text-primary transition"
                      :title="r.name"
                    >
                      {{ r.name }}
                    </h3>
                    <div class="flex items-center gap-1 text-xs text-muted-foreground mt-1 truncate">
                      <MapPin class="h-3.5 w-3.5 text-primary shrink-0" />
                      <span class="truncate font-medium">{{ r.location || 'Main Branch' }}</span>
                    </div>
                  </div>
                </div>

                <!-- Status & Facilities Badges: Stacked vertically on the right to preserve horizontal room for name -->
                <div class="flex flex-col items-end gap-1 shrink-0">
                  <Badge
                    v-if="(r.status || (r.isActive !== false ? 'ACTIVE' : 'INACTIVE')).toUpperCase() === 'ACTIVE'"
                    class="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-[10px] font-bold px-2 py-0.5 gap-1 shrink-0 rounded-lg"
                  >
                    <span class="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" /> Active
                  </Badge>
                  <Badge
                    v-else
                    class="bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20 text-[10px] font-bold px-2 py-0.5 gap-1 shrink-0 rounded-lg"
                  >
                    <Lock class="h-2.5 w-2.5" /> Inactive
                  </Badge>

                  <Badge
                    v-if="r.facilities && r.facilities.hotelRoomManagement"
                    class="bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/25 text-[10px] font-bold px-2 py-0.5 gap-1 shrink-0 rounded-lg cursor-pointer hover:bg-indigo-500/20 transition"
                    @click="promptHotelToggle(r)"
                    title="Hotel Room Management is enabled. Click to manage."
                  >
                    <BedDouble class="h-2.5 w-2.5" /> Hotel
                  </Badge>
                </div>
              </div>

              <!-- Metrics Stats Strip -->
              <div class="grid grid-cols-3 gap-2 py-2 px-2.5 rounded-xl bg-muted/40 border border-border/50 text-center">
                <div>
                  <span class="text-[10px] uppercase font-bold text-muted-foreground block">Tables</span>
                  <span class="text-xs font-black text-foreground">{{ r.maxTables || 20 }}</span>
                </div>
                <div class="border-x border-border/60">
                  <span class="text-[10px] uppercase font-bold text-muted-foreground block">Staff</span>
                  <span class="text-xs font-black text-primary">{{ getStaffCount(r.id || r._id) }}</span>
                </div>
                <div>
                  <span class="text-[10px] uppercase font-bold text-muted-foreground block">GST</span>
                  <span class="text-xs font-black text-foreground">{{ r.gstPercentage || 5 }}%</span>
                </div>
              </div>

              <!-- Contact & Details (if present) -->
              <div class="space-y-1.5 text-xs text-muted-foreground pt-0.5">
                <div v-if="r.phone" class="flex items-center gap-2 truncate">
                  <Phone class="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <a :href="'tel:' + r.phone" class="hover:text-primary transition font-medium text-foreground/80 truncate">
                    {{ r.phone }}
                  </a>
                </div>
                <div v-if="r.email" class="flex items-center gap-2 truncate">
                  <Mail class="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <a :href="'mailto:' + r.email" class="hover:text-primary transition font-medium truncate text-foreground/80">
                    {{ r.email }}
                  </a>
                </div>
                <div v-if="r.description" class="text-[11px] text-muted-foreground line-clamp-1 italic pt-0.5">
                  "{{ r.description }}"
                </div>
              </div>
            </div>

            <!-- Card Actions Footer -->
            <div class="p-3 bg-muted/20 border-t border-border flex items-center justify-between gap-2">
              <!-- Primary: Open Restaurant Admin Portal Viewport -->
              <Button
                size="sm"
                class="flex-1 min-w-0 gradient-primary text-primary-foreground font-bold h-8.5 rounded-xl text-xs gap-1.5 shadow-xs hover:brightness-110 cursor-pointer truncate"
                @click="inspectRestaurant(r)"
                title="Inspect and open Restaurant Admin Portal"
              >
                <LayoutDashboard class="h-3.5 w-3.5 shrink-0" />
                <span class="truncate">Restaurant Admin</span>
              </Button>

              <!-- Secondary Actions Toolbar (Uniform Square Icon Buttons to prevent overflow and text truncation) -->
              <div class="flex items-center gap-1.5 shrink-0">
                <!-- Secondary: Hotel Module Toggle Button with confirmation prompt -->
                <Button
                  size="sm"
                  variant="outline"
                  :class="[
                    'h-8.5 w-8.5 p-0 rounded-xl cursor-pointer shrink-0 border transition relative',
                    r.facilities && r.facilities.hotelRoomManagement
                      ? 'border-indigo-500/40 text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 hover:bg-indigo-500/20 ring-1 ring-indigo-500/20'
                      : 'border-border text-muted-foreground hover:text-foreground hover:bg-muted'
                  ]"
                  @click="promptHotelToggle(r)"
                  :title="r.facilities && r.facilities.hotelRoomManagement ? 'Hotel Module: Enabled (Click to toggle)' : 'Hotel Module: Disabled (Click to toggle)'"
                >
                  <BedDouble class="h-3.5 w-3.5" />
                  <span v-if="r.facilities && r.facilities.hotelRoomManagement" class="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-indigo-500 border border-card" />
                </Button>

                <!-- Secondary: WhatsApp Business API Config -->
                <Button
                  size="sm"
                  variant="outline"
                  class="h-8.5 w-8.5 p-0 rounded-xl hover:bg-emerald-500/10 cursor-pointer shrink-0 border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
                  @click="openWhatsAppConfigDialog(r)"
                  title="Configure Meta WhatsApp Cloud API for this branch"
                >
                  <MessageCircle class="h-3.5 w-3.5" />
                </Button>

                <!-- Secondary: Edit Settings -->
                <Button
                  size="sm"
                  variant="outline"
                  class="h-8.5 w-8.5 p-0 rounded-xl hover:bg-muted cursor-pointer shrink-0 border-border text-muted-foreground hover:text-foreground"
                  @click="openEditDialog(r)"
                  title="Edit Restaurant Details"
                >
                  <Edit3 class="h-3.5 w-3.5" />
                </Button>

                <!-- Secondary: Activate / Deactivate Toggle (Uniform icon button) -->
                <Button
                  size="sm"
                  variant="outline"
                  :class="[
                    'h-8.5 w-8.5 p-0 rounded-xl border transition cursor-pointer shrink-0',
                    (r.status || (r.isActive !== false ? 'ACTIVE' : 'INACTIVE')).toUpperCase() === 'ACTIVE'
                      ? 'border-rose-500/25 text-rose-600 dark:text-rose-400 bg-rose-500/5 hover:bg-rose-500/15'
                      : 'border-emerald-500/25 text-emerald-600 dark:text-emerald-400 bg-emerald-500/5 hover:bg-emerald-500/15'
                  ]"
                  @click="promptStatusToggle(r)"
                  :title="(r.status || (r.isActive !== false ? 'ACTIVE' : 'INACTIVE')).toUpperCase() === 'ACTIVE' ? 'Deactivate Venue' : 'Activate Venue'"
                >
                  <Power class="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal: Add / Edit Restaurant -->
    <Dialog :open="isDialogOpen" @update:open="isDialogOpen = $event">
      <DialogContent class="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle class="text-base font-bold flex items-center gap-2">
            <Building2 class="h-4.5 w-4.5 text-primary" />
            {{ activeRestaurant ? 'Edit Restaurant' : 'Add New Restaurant' }}
          </DialogTitle>
          <DialogDescription class="text-xs text-muted-foreground">
            {{ activeRestaurant ? 'Update restaurant branch details and tax settings.' : 'Register a new restaurant branch in the system.' }}
          </DialogDescription>
        </DialogHeader>

        <form @submit.prevent="handleSave" class="space-y-4 pt-2">
          <div class="grid gap-3.5 sm:grid-cols-2">
            <div class="space-y-1 text-xs font-medium">
              <label>Restaurant Name *</label>
              <Input v-model="formState.name" required placeholder="e.g. Savoria Downtown" class="h-9 text-xs rounded-xl" />
            </div>
            <div class="space-y-1 text-xs font-medium">
              <label>Location / City *</label>
              <Input v-model="formState.location" required placeholder="e.g. Mumbai, Bandra West" class="h-9 text-xs rounded-xl" />
            </div>
          </div>

          <div class="grid gap-3.5 sm:grid-cols-2">
            <div class="space-y-1 text-xs font-medium">
              <label>Phone Number *</label>
              <Input v-model="formState.phone" required placeholder="+91 98765 43210" class="h-9 text-xs rounded-xl" />
            </div>
            <div class="space-y-1 text-xs font-medium">
              <label>Email Address</label>
              <Input v-model="formState.email" type="email" placeholder="contact@restaurant.com" class="h-9 text-xs rounded-xl" />
            </div>
          </div>

          <div class="grid gap-3.5 sm:grid-cols-2">
            <div class="space-y-1 text-xs font-medium">
              <label>Max Tables</label>
              <Input v-model.number="formState.maxTables" type="number" min="1" max="100" class="h-9 text-xs rounded-xl" />
            </div>
            <div class="space-y-1 text-xs font-medium">
              <label>GST Tax Rate (%)</label>
              <Input v-model.number="formState.gstPercentage" type="number" min="0" max="28" step="0.5" class="h-9 text-xs rounded-xl" />
            </div>
          </div>

          <div class="space-y-1 text-xs font-medium">
            <label>Description / Notes</label>
            <Input v-model="formState.description" placeholder="Optional notes regarding this branch..." class="h-9 text-xs rounded-xl" />
          </div>

          <!-- Facility Modules Configuration -->
          <div class="rounded-xl border border-border p-3.5 bg-muted/20 space-y-2">
            <span class="text-xs font-bold text-foreground block">Optional Facilities & Modules</span>
            <label class="flex items-center justify-between p-2 rounded-lg bg-card border border-border/60 cursor-pointer hover:border-indigo-500/40 transition">
              <div class="flex items-center gap-2.5">
                <div class="h-7 w-7 rounded-lg bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                  <BedDouble class="h-4 w-4" />
                </div>
                <div>
                  <p class="text-xs font-bold text-foreground leading-tight">Hotel Room Management</p>
                  <p class="text-[11px] text-muted-foreground">Enables rooms, reservations, check-ins, housekeeping, and hotel invoicing.</p>
                </div>
              </div>
              <input
                type="checkbox"
                v-model="formState.facilities.hotelRoomManagement"
                class="h-4 w-4 accent-indigo-600 rounded cursor-pointer shrink-0"
              />
            </label>
          </div>

          <DialogFooter class="gap-2 sm:gap-0 pt-2">
            <Button type="button" variant="outline" class="h-9 text-xs rounded-xl" @click="isDialogOpen = false">
              Cancel
            </Button>
            <Button type="submit" class="gradient-primary text-primary-foreground font-bold h-9 text-xs rounded-xl shadow-xs" :disabled="saving">
              {{ saving ? 'Saving...' : (activeRestaurant ? 'Save Changes' : 'Create Restaurant') }}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    <!-- Alert Dialog: Status Toggle Confirmation -->
    <AlertDialog :open="statusToggleConfirm.isOpen" @update:open="statusToggleConfirm.isOpen = $event">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle class="flex items-center gap-2 text-base font-bold">
            <AlertTriangle v-if="statusToggleConfirm.nextStatus === 'INACTIVE'" class="h-5 w-5 text-destructive" />
            <CheckCircle2 v-else class="h-5 w-5 text-emerald-500" />
            {{ statusToggleConfirm.nextStatus === 'INACTIVE' ? 'Deactivate Restaurant' : 'Reactivate Restaurant' }}
          </AlertDialogTitle>
          <AlertDialogDescription class="text-xs text-muted-foreground leading-relaxed pt-1">
            <template v-if="statusToggleConfirm.nextStatus === 'INACTIVE'">
              Are you sure you want to deactivate <strong>{{ statusToggleConfirm.target?.name }}</strong>?
              Staff members of this branch won't be able to log in until it is reactivated.
            </template>
            <template v-else>
              Are you sure you want to reactivate <strong>{{ statusToggleConfirm.target?.name }}</strong>?
              This venue will immediately become available for operations and staff logins.
            </template>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel class="h-8.5 text-xs">Cancel</AlertDialogCancel>
          <AlertDialogAction
            @click="confirmStatusToggle"
            :class="statusToggleConfirm.nextStatus === 'INACTIVE' ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90 text-xs h-8.5' : 'gradient-primary text-primary-foreground text-xs h-8.5 font-bold'"
          >
            {{ statusToggleConfirm.nextStatus === 'INACTIVE' ? 'Deactivate Branch' : 'Activate Branch' }}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    <!-- Alert Dialog: Hotel Facility Toggle Confirmation -->
    <AlertDialog :open="hotelToggleConfirm.isOpen" @update:open="hotelToggleConfirm.isOpen = $event">
      <AlertDialogContent class="rounded-3xl border border-border">
        <AlertDialogHeader>
          <AlertDialogTitle class="flex items-center gap-2 text-base font-bold">
            <BedDouble :class="hotelToggleConfirm.enable ? 'h-5 w-5 text-indigo-600 dark:text-indigo-400' : 'h-5 w-5 text-amber-500'" />
            {{ hotelToggleConfirm.enable ? 'Enable Hotel Room Management?' : 'Disable Hotel Room Management?' }}
          </AlertDialogTitle>
          <AlertDialogDescription class="text-xs text-muted-foreground leading-relaxed pt-1.5 space-y-2">
            <template v-if="hotelToggleConfirm.enable">
              <p>
                You are enabling the optional <strong>Hotel Room Management</strong> module for <strong>{{ hotelToggleConfirm.target?.name }}</strong>.
              </p>
              <ul class="list-disc pl-4 text-[11px] text-foreground/80 space-y-1">
                <li>Restaurant Admin gains the full Hotel Management portal (Rooms, Categories, Housekeeping, Reports).</li>
                <li>Cashier gains the visual POS Room Grid (Availability, Check-In, Check-Out, and Invoices).</li>
                <li>Default room categories (Standard, Deluxe, Premium, Suite) will be seeded automatically.</li>
              </ul>
            </template>
            <template v-else>
              <p>
                Are you sure you want to disable <strong>Hotel Room Management</strong> for <strong>{{ hotelToggleConfirm.target?.name }}</strong>?
              </p>
              <p class="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                ✓ All existing rooms, past bookings, guest details, and invoices will remain <strong>permanently preserved</strong> in the database.
              </p>
              <p class="text-[11px]">
                The Hotel navigation tabs and POS grid will simply be hidden from the restaurant's staff until re-enabled.
              </p>
            </template>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter class="pt-2">
          <AlertDialogCancel class="h-8.5 text-xs rounded-xl">Cancel</AlertDialogCancel>
          <AlertDialogAction
            @click="confirmHotelToggle"
            :class="hotelToggleConfirm.enable ? 'bg-indigo-600 hover:bg-indigo-700 text-white text-xs h-8.5 rounded-xl font-bold' : 'bg-destructive text-destructive-foreground hover:bg-destructive/90 text-xs h-8.5 rounded-xl font-bold'"
          >
            {{ hotelToggleConfirm.enable ? 'Yes, Enable Hotel Module' : 'Yes, Disable Module' }}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    <!-- Modal: WhatsApp Multi-Tenant Branch Configuration -->
    <Dialog :open="isWhatsAppDialogOpen" @update:open="isWhatsAppDialogOpen = $event">
      <DialogContent class="sm:max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl border border-border p-0">
        <DialogHeader class="p-5 border-b border-border bg-card">
          <div class="flex items-center justify-between">
            <DialogTitle class="font-display text-base sm:text-lg font-bold flex items-center gap-2">
              <div class="h-8 w-8 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <MessageCircle class="h-4.5 w-4.5" />
              </div>
              <span>WhatsApp Cloud API — {{ selectedWhatsAppRestaurant?.name }}</span>
            </DialogTitle>
          </div>
          <DialogDescription class="text-xs text-muted-foreground mt-1">
            Configure official Meta WhatsApp Business credentials for automatic customer bill delivery.
          </DialogDescription>
        </DialogHeader>

        <div v-if="whatsAppConfigLoading" class="p-12 text-center text-muted-foreground">
          <RefreshCw class="h-6 w-6 animate-spin mx-auto mb-2 text-primary" />
          <p class="text-xs font-semibold">Loading WhatsApp settings...</p>
        </div>

        <form v-else @submit.prevent="saveWhatsAppConfig" class="p-5 space-y-4">
          <!-- Toggle active / enabled -->
          <div class="p-3 rounded-2xl bg-muted/30 border border-border flex items-center justify-between">
            <div>
              <label class="text-xs font-bold text-foreground">Enable Automatic WhatsApp Delivery</label>
              <p class="text-[11px] text-muted-foreground">Automatically trigger PDF invoice to customer on payment completion</p>
            </div>
            <input
              type="checkbox"
              v-model="whatsAppForm.isEnabled"
              class="h-4 w-4 rounded text-emerald-600 focus:ring-emerald-500 accent-emerald-600 cursor-pointer"
            />
          </div>

          <!-- Operational Status Mode -->
          <div class="space-y-1.5">
            <label class="text-xs font-bold text-foreground">Operational Mode</label>
            <div class="grid grid-cols-3 gap-2">
              <button
                type="button"
                @click="whatsAppForm.status = 'ACTIVE'"
                :class="['py-2 px-3 rounded-xl border text-xs font-bold transition cursor-pointer', whatsAppForm.status === 'ACTIVE' ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-600 dark:text-emerald-400' : 'bg-background border-border text-muted-foreground']"
              >
                ✓ Active
              </button>
              <button
                type="button"
                @click="whatsAppForm.status = 'TEST_MODE'"
                :class="['py-2 px-3 rounded-xl border text-xs font-bold transition cursor-pointer', whatsAppForm.status === 'TEST_MODE' ? 'bg-amber-500/15 border-amber-500/40 text-amber-600 dark:text-amber-400' : 'bg-background border-border text-muted-foreground']"
              >
                ⚡ Test Mode
              </button>
              <button
                type="button"
                @click="whatsAppForm.status = 'INACTIVE'"
                :class="['py-2 px-3 rounded-xl border text-xs font-bold transition cursor-pointer', whatsAppForm.status === 'INACTIVE' ? 'bg-destructive/15 border-destructive/40 text-destructive' : 'bg-background border-border text-muted-foreground']"
              >
                ✕ Inactive
              </button>
            </div>
            <p v-if="whatsAppForm.status === 'TEST_MODE'" class="text-[11px] text-amber-500 font-medium pt-0.5">
              * Test Mode simulates delivery responses without calling Meta servers or consuming account credits.
            </p>
          </div>

          <!-- Phone Number ID -->
          <div class="space-y-1.5">
            <label class="text-xs font-bold text-foreground">Phone Number ID (Meta Graph)</label>
            <Input
              v-model="whatsAppForm.phoneNumberId"
              placeholder="e.g. 104829104810294"
              class="h-9 text-xs"
            />
            <p class="text-[10px] text-muted-foreground">Found under WhatsApp &gt; API Setup in Meta App Dashboard</p>
          </div>

          <!-- Business Account ID -->
          <div class="space-y-1.5">
            <label class="text-xs font-bold text-foreground">WhatsApp Business Account ID (WABA ID)</label>
            <Input
              v-model="whatsAppForm.businessAccountId"
              placeholder="e.g. 109283748291024"
              class="h-9 text-xs"
            />
          </div>

          <!-- Access Token -->
          <div class="space-y-1.5">
            <div class="flex items-center justify-between">
              <label class="text-xs font-bold text-foreground">Permanent System User Access Token</label>
              <span v-if="whatsAppForm.isAccessTokenConfigured" class="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">
                ✓ Encrypted &amp; Configured
              </span>
            </div>
            <Input
              v-model="whatsAppForm.accessToken"
              type="password"
              placeholder="Enter new token to replace existing encrypted token"
              class="h-9 text-xs"
            />
            <p class="text-[10px] text-muted-foreground">Encrypted using AES-256-GCM. Never exposed in API responses or logs.</p>
          </div>

          <!-- Template Name & Language -->
          <div class="grid grid-cols-2 gap-3">
            <div class="space-y-1.5">
              <label class="text-xs font-bold text-foreground">Template Name</label>
              <Input
                v-model="whatsAppForm.templateName"
                placeholder="dawatdesk_invoice_v1"
                class="h-9 text-xs"
              />
            </div>
            <div class="space-y-1.5">
              <label class="text-xs font-bold text-foreground">Language Code</label>
              <Input
                v-model="whatsAppForm.templateLanguage"
                placeholder="en"
                class="h-9 text-xs"
              />
            </div>
          </div>

          <!-- Test Result Banner -->
          <div v-if="whatsAppTestResult" :class="['p-3 rounded-2xl border text-xs flex items-start gap-2.5', whatsAppTestResult.isConfigured ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300' : 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300']">
            <CheckCircle2 v-if="whatsAppTestResult.isConfigured" class="h-4 w-4 shrink-0 mt-0.5" />
            <AlertCircle v-else class="h-4 w-4 shrink-0 mt-0.5" />
            <div>
              <div class="font-bold">{{ whatsAppTestResult.message }}</div>
              <div class="text-[11px] opacity-80 mt-0.5">Source: {{ whatsAppTestResult.source }} · Template: {{ whatsAppTestResult.templateName }}</div>
            </div>
          </div>

          <!-- Dialog Actions -->
          <div class="pt-3 border-t border-border flex items-center justify-between gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              class="h-9 text-xs font-bold cursor-pointer"
              :disabled="whatsAppTesting"
              @click="testWhatsAppConfig"
            >
              <RefreshCw :class="['h-3.5 w-3.5 mr-1.5', whatsAppTesting ? 'animate-spin' : '']" />
              {{ whatsAppTesting ? 'Testing...' : 'Test Connection' }}
            </Button>

            <div class="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                class="h-9 text-xs cursor-pointer"
                @click="isWhatsAppDialogOpen = false"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                :disabled="whatsAppConfigSaving"
                class="gradient-primary text-primary-foreground font-bold h-9 px-4 text-xs cursor-pointer shadow-xs"
              >
                {{ whatsAppConfigSaving ? 'Saving...' : 'Save Settings' }}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  </RoleLayout>
</template>
