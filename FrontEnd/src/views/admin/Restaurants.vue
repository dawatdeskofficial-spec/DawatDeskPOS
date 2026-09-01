<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import {
  Plus, Search, Edit3, X, Building2, Eye, Power,
  AlertTriangle, Phone, Mail, MapPin, CheckCircle2, Lock
} from 'lucide-vue-next'
import RoleLayout from '@/components/RoleLayout.vue'
import PageHeader from '@/components/PageHeader.vue'
import { adminNav } from '@/lib/nav'
import { getRestaurants, createRestaurant, updateRestaurant, getAllUsers } from '@/lib/api'
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

const isDialogOpen = ref(false)
const activeRestaurant = ref<any>(null)
const saving = ref(false)

// Status Toggle Confirmation
const statusToggleConfirm = ref<{ isOpen: boolean; target: any | null; nextStatus: 'ACTIVE' | 'INACTIVE' }>({
  isOpen: false,
  target: null,
  nextStatus: 'INACTIVE'
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
})

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
  }
  isDialogOpen.value = true
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
        <Button class="font-semibold shadow-2xs gap-1.5" @click="openCreateDialog">
          <Plus class="h-4 w-4" /> Add Restaurant
        </Button>
      </template>
    </PageHeader>

    <div v-if="error" class="mb-4 rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-xs text-destructive">
      {{ error }}
    </div>

    <!-- Main Restaurant Venues Table Card -->
    <div class="rounded-xl bg-card border border-border shadow-2xs overflow-hidden">
      <!-- Search & Status Filter Bar -->
      <div class="p-4 border-b border-border flex flex-col sm:flex-row items-center justify-between gap-3 bg-muted/20">
        <div class="relative flex-1 max-w-sm w-full">
          <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            v-model="searchQuery"
            placeholder="Search by name, city, email..."
            class="pl-8.5 pr-8 bg-background border-border text-xs h-8.5 rounded-lg"
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
        <div class="flex items-center gap-1 bg-muted/40 p-1 rounded-lg border border-border text-xs font-semibold">
          <button
            @click="statusFilter = 'ALL'"
            :class="['px-3 py-1 rounded-md transition cursor-pointer', statusFilter === 'ALL' ? 'bg-card text-foreground shadow-2xs font-bold' : 'text-muted-foreground hover:text-foreground']"
          >
            All ({{ restaurantsList.length }})
          </button>
          <button
            @click="statusFilter = 'ACTIVE'"
            :class="['px-3 py-1 rounded-md transition cursor-pointer', statusFilter === 'ACTIVE' ? 'bg-card text-emerald-600 dark:text-emerald-400 shadow-2xs font-bold' : 'text-muted-foreground hover:text-foreground']"
          >
            Active ({{ restaurantsList.filter(r => (r.status || 'ACTIVE').toUpperCase() === 'ACTIVE').length }})
          </button>
          <button
            @click="statusFilter = 'INACTIVE'"
            :class="['px-3 py-1 rounded-md transition cursor-pointer', statusFilter === 'INACTIVE' ? 'bg-card text-rose-600 dark:text-rose-400 shadow-2xs font-bold' : 'text-muted-foreground hover:text-foreground']"
          >
            Inactive ({{ restaurantsList.filter(r => (r.status || '').toUpperCase() === 'INACTIVE').length }})
          </button>
        </div>
      </div>

      <!-- Table of Venues -->
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="bg-muted/30 text-muted-foreground text-[11px] uppercase tracking-wider font-semibold border-b border-border">
            <tr>
              <th class="text-left px-5 py-3 font-semibold">Restaurant</th>
              <th class="text-left px-5 py-3 font-semibold">Location</th>
              <th class="text-left px-5 py-3 font-semibold">Contact</th>
              <th class="text-center px-4 py-3 font-semibold">Tables</th>
              <th class="text-left px-4 py-3 font-semibold">Status</th>
              <th class="text-right px-5 py-3 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-border">
            <tr v-if="loading">
              <td colspan="6" class="px-5 py-12 text-center text-muted-foreground text-xs">Loading restaurants...</td>
            </tr>
            <tr v-else-if="restaurantsList.length === 0">
              <td colspan="6" class="px-5 py-12 text-center text-muted-foreground">
                <Building2 class="h-8 w-8 mx-auto mb-2 opacity-30 text-primary" />
                <p class="font-semibold text-sm text-foreground">No restaurants added yet</p>
                <p class="text-xs mt-1">Click "Add Restaurant" to register a new venue.</p>
              </td>
            </tr>
            <tr v-else-if="filteredRestaurants.length === 0">
              <td colspan="6" class="px-5 py-10 text-center text-muted-foreground text-xs">
                No restaurants match "{{ searchQuery }}".
                <button @click="searchQuery = ''; statusFilter = 'ALL'" class="text-primary underline ml-1 cursor-pointer">Clear filters</button>
              </td>
            </tr>

            <tr
              v-else
              v-for="r in filteredRestaurants"
              :key="r.id || r._id"
              class="hover:bg-muted/20 transition"
            >
              <!-- Restaurant Name & Initial -->
              <td class="px-5 py-3.5">
                <div class="flex items-center gap-3">
                  <div class="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0">
                    {{ (r.name || 'R').charAt(0).toUpperCase() }}
                  </div>
                  <div>
                    <div class="font-semibold text-xs text-foreground capitalize">
                      {{ r.name }}
                    </div>
                    <div class="text-[11px] text-muted-foreground mt-0.5">
                      GST: {{ r.gstPercentage || 5 }}% · {{ getStaffCount(r.id || r._id) }} staff
                    </div>
                  </div>
                </div>
              </td>

              <!-- Location -->
              <td class="px-5 py-3.5 text-xs text-muted-foreground">
                <div class="flex items-center gap-1.5 truncate max-w-[180px]" :title="r.location">
                  <MapPin class="h-3.5 w-3.5 text-primary shrink-0" />
                  <span class="truncate">{{ r.location || 'Main Branch' }}</span>
                </div>
              </td>

              <!-- Contact -->
              <td class="px-5 py-3.5 text-xs text-muted-foreground">
                <div v-if="r.phone" class="flex items-center gap-1.5 text-foreground font-medium">
                  <Phone class="h-3 w-3 text-muted-foreground" />
                  <span>{{ r.phone }}</span>
                </div>
                <div v-if="r.email" class="flex items-center gap-1.5 text-[11px] text-muted-foreground mt-0.5 truncate max-w-[160px]" :title="r.email">
                  <Mail class="h-3 w-3 text-muted-foreground shrink-0" />
                  <span class="truncate">{{ r.email }}</span>
                </div>
              </td>

              <!-- Capacity -->
              <td class="px-4 py-3.5 text-center text-xs font-medium text-foreground">
                <Badge variant="outline" class="text-[11px] font-medium px-2 py-0.5">
                  {{ r.maxTables || 20 }}
                </Badge>
              </td>

              <!-- Status Badge -->
              <td class="px-4 py-3.5">
                <Badge
                  v-if="(r.status || 'ACTIVE').toUpperCase() === 'ACTIVE'"
                  class="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-[11px] font-medium gap-1"
                >
                  <span class="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Active
                </Badge>
                <Badge
                  v-else
                  class="bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20 text-[11px] font-medium gap-1"
                >
                  <Lock class="h-3 w-3" /> Inactive
                </Badge>
              </td>

              <!-- Actions: Inspect, Edit, and Status Toggle -->
              <td class="px-5 py-3.5 text-right">
                <div class="flex items-center justify-end gap-1.5">
                  <!-- Inspect Button -->
                  <Button
                    size="sm"
                    variant="outline"
                    class="h-7.5 px-2.5 text-xs font-semibold gap-1 shadow-2xs cursor-pointer"
                    @click="inspectRestaurant(r)"
                    title="Open restaurant admin portal"
                  >
                    <Eye class="h-3.5 w-3.5 text-primary" /> Inspect
                  </Button>

                  <!-- Edit Details -->
                  <Button
                    size="sm"
                    variant="ghost"
                    class="h-7.5 w-7.5 p-0 text-muted-foreground hover:text-foreground cursor-pointer rounded-lg"
                    @click="openEditDialog(r)"
                    title="Edit restaurant"
                  >
                    <Edit3 class="h-3.5 w-3.5" />
                  </Button>

                  <!-- Status Toggle -->
                  <button
                    @click="promptStatusToggle(r)"
                    :class="[
                      'h-7.5 px-2 rounded-lg border text-xs font-medium transition flex items-center gap-1 cursor-pointer',
                      (r.status || 'ACTIVE').toUpperCase() === 'ACTIVE'
                        ? 'border-rose-500/20 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10'
                        : 'border-emerald-500/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10'
                    ]"
                    :title="(r.status || 'ACTIVE').toUpperCase() === 'ACTIVE' ? 'Deactivate restaurant' : 'Activate restaurant'"
                  >
                    <Power class="h-3 w-3" />
                    <span>{{ (r.status || 'ACTIVE').toUpperCase() === 'ACTIVE' ? 'Deactivate' : 'Activate' }}</span>
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Modal: Add / Edit Restaurant -->
    <Dialog :open="isDialogOpen" @update:open="isDialogOpen = $event">
      <DialogContent class="sm:max-w-lg">
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
              <Input v-model="formState.name" required placeholder="e.g. Savoria Downtown" class="h-8.5 text-xs" />
            </div>
            <div class="space-y-1 text-xs font-medium">
              <label>Location / City *</label>
              <Input v-model="formState.location" required placeholder="e.g. Mumbai, Bandra West" class="h-8.5 text-xs" />
            </div>
          </div>

          <div class="grid gap-3.5 sm:grid-cols-2">
            <div class="space-y-1 text-xs font-medium">
              <label>Phone Number *</label>
              <Input v-model="formState.phone" required placeholder="+91 98765 43210" class="h-8.5 text-xs" />
            </div>
            <div class="space-y-1 text-xs font-medium">
              <label>Email Address</label>
              <Input v-model="formState.email" type="email" placeholder="contact@restaurant.com" class="h-8.5 text-xs" />
            </div>
          </div>

          <div class="grid gap-3.5 sm:grid-cols-2">
            <div class="space-y-1 text-xs font-medium">
              <label>Max Tables</label>
              <Input v-model.number="formState.maxTables" type="number" min="1" max="100" class="h-8.5 text-xs" />
            </div>
            <div class="space-y-1 text-xs font-medium">
              <label>GST Rate (%)</label>
              <Input v-model.number="formState.gstPercentage" type="number" min="0" max="28" class="h-8.5 text-xs" />
            </div>
          </div>

          <div class="space-y-1 text-xs font-medium">
            <label>Description / Notes</label>
            <Input v-model="formState.description" placeholder="Fine dining continental cuisine..." class="h-8.5 text-xs" />
          </div>

          <DialogFooter class="pt-3 flex items-center justify-end gap-2">
            <Button type="button" variant="outline" size="sm" class="h-8.5 text-xs font-medium" @click="isDialogOpen = false">
              Cancel
            </Button>
            <Button type="submit" size="sm" :disabled="saving" class="h-8.5 text-xs font-semibold shadow-2xs">
              {{ saving ? 'Saving...' : (activeRestaurant ? 'Save Changes' : 'Create Restaurant') }}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    <!-- Alert Dialog: Deactivate / Activate Venue Confirmation -->
    <AlertDialog :open="statusToggleConfirm.isOpen" @update:open="statusToggleConfirm.isOpen = $event">
      <AlertDialogContent class="sm:max-w-md">
        <AlertDialogHeader>
          <div class="h-10 w-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center mb-2 mx-auto">
            <AlertTriangle class="h-5 w-5" />
          </div>
          <AlertDialogTitle class="text-center text-base font-bold">
            {{ statusToggleConfirm.nextStatus === 'INACTIVE' ? 'Deactivate Restaurant?' : 'Activate Restaurant?' }}
          </AlertDialogTitle>
          <AlertDialogDescription class="text-center text-xs text-muted-foreground mt-2 leading-relaxed">
            <template v-if="statusToggleConfirm.nextStatus === 'INACTIVE'">
              Are you sure you want to deactivate <strong>{{ statusToggleConfirm.target?.name }}</strong>?
              <br><br>
              Staff and customers accessing this branch will see a <em>Service Unavailable</em> notice.
            </template>
            <template v-else>
              Are you sure you want to reactivate <strong>{{ statusToggleConfirm.target?.name }}</strong>?
              <br><br>
              Operations, ordering, and staff access will be restored immediately.
            </template>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter class="sm:justify-center gap-2 mt-3">
          <AlertDialogCancel size="sm" class="h-8.5 text-xs" @click="statusToggleConfirm = { isOpen: false, target: null, nextStatus: 'INACTIVE' }">
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            size="sm"
            @click="confirmStatusToggle"
            :class="[
              'h-8.5 text-xs font-semibold',
              statusToggleConfirm.nextStatus === 'INACTIVE' ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : 'bg-primary text-primary-foreground'
            ]"
          >
            {{ statusToggleConfirm.nextStatus === 'INACTIVE' ? 'Deactivate' : 'Activate' }}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </RoleLayout>
</template>

