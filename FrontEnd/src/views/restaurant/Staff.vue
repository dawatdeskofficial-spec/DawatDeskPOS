<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { Plus, Edit3, Trash2, Search, X } from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import RoleLayout from '@/components/RoleLayout.vue'
import PageHeader from '@/components/PageHeader.vue'
import { restaurantNav } from '@/lib/nav'
import { getUsersByRestaurant, adminCreateUser, updateUser, deleteUser, activateUser, deactivateUser } from '@/lib/api'
import { useAuthStore, ROLE_LABELS } from '@/stores/auth'
import Button from '@/components/ui/Button.vue'
import Badge from '@/components/ui/Badge.vue'
import Input from '@/components/ui/Input.vue'
import Dialog from '@/components/ui/Dialog.vue'
import DialogContent from '@/components/ui/DialogContent.vue'
import DialogHeader from '@/components/ui/DialogHeader.vue'
import DialogTitle from '@/components/ui/DialogTitle.vue'
import DialogDescription from '@/components/ui/DialogDescription.vue'
import DialogFooter from '@/components/ui/DialogFooter.vue'
import { DialogClose } from 'radix-vue'
import AlertDialog from '@/components/ui/AlertDialog.vue'
import AlertDialogContent from '@/components/ui/AlertDialogContent.vue'
import AlertDialogHeader from '@/components/ui/AlertDialogHeader.vue'
import AlertDialogTitle from '@/components/ui/AlertDialogTitle.vue'
import AlertDialogDescription from '@/components/ui/AlertDialogDescription.vue'
import AlertDialogFooter from '@/components/ui/AlertDialogFooter.vue'
import AlertDialogCancel from '@/components/ui/AlertDialogCancel.vue'
import AlertDialogAction from '@/components/ui/AlertDialogAction.vue'

const auth = useAuthStore()
const staff = ref<any[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
const searchQuery = ref('')
const selectedRole = ref('ALL')

const isDialogOpen = ref(false)
const activeStaff = ref<any>(null)
const saving = ref(false)
const deleteConfirm = ref({ isOpen: false, target: null as any | null })

const filteredStaff = computed(() => {
  let list = staff.value
  if (selectedRole.value !== 'ALL') {
    list = list.filter(u => (u.role || '').toLowerCase() === selectedRole.value.toLowerCase())
  }
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase().trim()
    list = list.filter(u => {
      const name = (u.name || '').toLowerCase()
      const email = (u.email || '').toLowerCase()
      const phone = (u.phone || '').toLowerCase()
      const id = String(u.id || u._id || '').toLowerCase()
      const role = (ROLE_LABELS[u.role as keyof typeof ROLE_LABELS] || u.role || '').toLowerCase()
      return name.includes(q) || email.includes(q) || phone.includes(q) || id.includes(q) || role.includes(q)
    })
  }
  return list
})

const formState = ref({
  name: "",
  email: "",
  password: "",
  role: "waiter",
  phone: "",
})

const restaurantId = computed(() => {
  return auth.effectiveRestaurantId || ""
})

async function fetchStaff() {
  if (!restaurantId.value) return;
  loading.value = true;
  try {
    const response = await getUsersByRestaurant(restaurantId.value, 1, 100);
    staff.value = response.data || [];
    error.value = null;
  } catch (err: any) {
    error.value = err.message || "Failed to load staff.";
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  fetchStaff();
})

function resetForm() {
  formState.value = {
    name: "",
    email: "",
    password: "",
    role: "waiter",
    phone: "",
  };
  activeStaff.value = null;
}

function openCreateDialog() {
  resetForm();
  isDialogOpen.value = true;
}

function openEditDialog(staffUser: any) {
  activeStaff.value = staffUser;
  formState.value = {
    name: staffUser.name || "",
    email: staffUser.email || "",
    password: "",
    role: staffUser.role || "waiter",
    phone: staffUser.phone || "",
  };
  isDialogOpen.value = true;
}

async function handleDelete() {
  if (!deleteConfirm.value.target) return;
  try {
    await deleteUser(deleteConfirm.value.target.id);
    toast.success('Staff member deleted.')
    await fetchStaff();
  } catch (err: any) {
    toast.error(err.message || 'Failed to delete user.');
  } finally {
    deleteConfirm.value = { isOpen: false, target: null };
  }
}

async function handleToggleStatus(staffUser: any) {
  const staffId = staffUser.id || staffUser._id;
  try {
    if (staffUser.isActive) {
      await deactivateUser(staffId);
      toast.success('Staff member deactivated.')
    } else {
      await activateUser(staffId);
      toast.success('Staff member activated.')
    }
    await fetchStaff();
  } catch (err: any) {
    toast.error(err.message || 'Failed to change user status.');
  }
}

async function handleSave() {
  if (!restaurantId.value) return toast.error('No restaurant ID found for user.');
  saving.value = true;
  try {
    if (activeStaff.value) {
      const payload: any = {
        name: formState.value.name,
        email: formState.value.email.trim(),
        role: formState.value.role,
        phone: formState.value.phone,
      };
      if (formState.value.password) {
        payload.password = formState.value.password;
      }
      await updateUser(activeStaff.value.id || activeStaff.value._id, payload);
      toast.success('Staff member updated.')
    } else {
      await adminCreateUser({
        ...formState.value,
        role: formState.value.role as any,
        restaurantId: restaurantId.value,
      });
      toast.success('Staff member added.')
    }
    isDialogOpen.value = false;
    await fetchStaff();
  } catch (err: any) {
    toast.error(err.message || 'Failed to save user.');
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <RoleLayout role="restaurant_admin" :nav="restaurantNav">
    <PageHeader
      title="Staff"
      subtitle="Manage your team members for this restaurant."
    >
      <template #action>
        <Button class="gradient-primary text-primary-foreground" @click="openCreateDialog">
          <Plus class="h-4 w-4 mr-2" />Add staff
        </Button>
      </template>
    </PageHeader>

    <div v-if="error" class="mb-4 rounded-2xl border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-destructive">
      {{ error }}
    </div>

    <!-- Search & Role Filter Ribbon -->
    <div class="mb-6 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-card p-4 rounded-2xl border border-border shadow-soft">
      <div class="relative flex-1 max-w-md">
        <Search class="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          v-model="searchQuery"
          placeholder="Search staff by name, email, phone, or ID…"
          class="pl-10 pr-9 h-10 text-xs bg-muted/30 border-border"
        />
        <button
          v-if="searchQuery"
          @click="searchQuery = ''"
          class="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        >
          <X class="h-3.5 w-3.5" />
        </button>
      </div>

      <!-- Role Filter Pills -->
      <div class="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
        <button
          v-for="roleOption in [
            { label: 'All', value: 'ALL' },
            { label: 'Waiters', value: 'waiter' },
            { label: 'Chefs', value: 'chef' },
            { label: 'Cashiers', value: 'cashier' },
            { label: 'Admins', value: 'restaurant_admin' }
          ]"
          :key="roleOption.value"
          @click="selectedRole = roleOption.value"
          :class="[
            'px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition border',
            selectedRole === roleOption.value
              ? 'gradient-primary text-primary-foreground border-transparent shadow-xs'
              : 'bg-muted/40 border-border text-muted-foreground hover:text-foreground'
          ]"
        >
          {{ roleOption.label }}
        </button>
        <span class="text-xs text-muted-foreground font-medium ml-1 hidden md:inline">
          ({{ filteredStaff.length }})
        </span>
      </div>
    </div>

    <div v-if="loading" class="text-center py-12 text-muted-foreground">Loading staff...</div>
    <div v-else-if="staff.length === 0" class="text-center py-12 text-muted-foreground">No staff found.</div>
    <div v-else-if="filteredStaff.length === 0" class="rounded-2xl border-2 border-dashed border-border p-12 text-center text-muted-foreground">
      <Search class="h-8 w-8 mx-auto mb-2 opacity-30 text-muted-foreground" />
      <p class="font-semibold text-sm">No team members match your search.</p>
      <Button size="sm" variant="ghost" class="mt-2 text-xs" @click="searchQuery = ''; selectedRole = 'ALL'">
        Reset Filters
      </Button>
    </div>
    <div v-else class="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <div v-for="u in filteredStaff" :key="u.id" class="group rounded-2xl bg-card border border-border p-5 shadow-soft hover:shadow-glow transition relative overflow-hidden">
        <div class="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button size="icon" variant="ghost" class="h-8 w-8 hover:bg-muted" @click="openEditDialog(u)">
            <Edit3 class="h-4 w-4" />
          </Button>
          <Button size="icon" variant="ghost" class="h-8 w-8 hover:bg-destructive/10 hover:text-destructive" @click="deleteConfirm = { isOpen: true, target: u }">
            <Trash2 class="h-4 w-4" />
          </Button>
        </div>
        <div class="flex items-center gap-4">
          <div class="h-14 w-14 rounded-2xl gradient-primary grid place-items-center font-display text-xl text-primary-foreground font-bold">
            {{ u.name[0] }}
          </div>
          <div class="min-w-0 flex-1">
            <div class="font-semibold truncate">{{ u.name }}</div>
            <div class="text-xs text-muted-foreground truncate">{{ u.email }}</div>
            <div class="text-[11px] font-mono text-muted-foreground truncate mt-0.5">ID: {{ u.id || u._id }}</div>
            <div v-if="u.phone" class="text-xs text-muted-foreground truncate mt-0.5">{{ u.phone }}</div>
          </div>
        </div>
        <div class="flex items-center justify-between mt-5 pt-4 border-t border-border">
          <Badge variant="secondary">{{ ROLE_LABELS[u.role as keyof typeof ROLE_LABELS] || u.role }}</Badge>
          <button 
            @click="handleToggleStatus(u)"
            :class="`text-xs font-medium hover:underline cursor-pointer ${u.isActive ? 'text-success' : 'text-destructive'}`"
          >
            ● {{ u.isActive ? "Active" : "Inactive" }}
          </button>
        </div>
      </div>
    </div>

    <Dialog :open="isDialogOpen" @update:open="isDialogOpen = $event">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{{ activeStaff ? "Edit Staff Member" : "Add Staff Member" }}</DialogTitle>
          <DialogDescription>
            {{ activeStaff ? "Update details for this staff member." : "Create a new account for a staff member." }}
          </DialogDescription>
        </DialogHeader>
        <form @submit.prevent="handleSave" class="space-y-4">
          <div v-if="activeStaff" class="space-y-1.5 text-sm font-medium opacity-85">
            <span>User ID (Read-only)</span>
            <Input disabled :value="activeStaff.id || activeStaff._id" class="font-mono bg-muted" />
          </div>

          <div class="grid gap-4 md:grid-cols-2">
            <label class="space-y-1.5 text-sm font-medium">
              <span>Name</span>
              <Input v-model="formState.name" required />
            </label>
            <label class="space-y-1.5 text-sm font-medium">
              <span>Email</span>
              <Input type="email" v-model="formState.email" required />
            </label>
          </div>
          <div class="grid gap-4 md:grid-cols-2">
            <label class="space-y-1.5 text-sm font-medium flex flex-col">
              <span>Role</span>
              <select
                v-model="formState.role"
                class="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="waiter">Waiter</option>
                <option value="chef">Chef</option>
                <option value="cashier">Cashier</option>
              </select>
            </label>
            <label class="space-y-1.5 text-sm font-medium">
              <span>Phone</span>
              <Input type="tel" v-model="formState.phone" />
            </label>
          </div>
          <div class="space-y-1.5 text-sm font-medium">
            <span>Password</span>
            <Input type="password" v-model="formState.password" :placeholder="activeStaff ? 'Leave blank to keep current' : 'Required for new users'" :required="!activeStaff" />
          </div>
          <DialogFooter class="mt-6">
            <Button type="button" variant="ghost" @click="isDialogOpen = false">Cancel</Button>
            <Button type="submit" :disabled="saving">
              {{ saving ? "Saving..." : "Save Staff" }}
            </Button>
          </DialogFooter>
        </form>
        <DialogClose />
      </DialogContent>
    </Dialog>

    <AlertDialog :open="deleteConfirm.isOpen" @update:open="deleteConfirm.isOpen = $event">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. This will permanently delete {{ deleteConfirm.target?.name }}.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel @click="deleteConfirm.isOpen = false">Cancel</AlertDialogCancel>
          <AlertDialogAction variant="destructive" @click="handleDelete">
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </RoleLayout>
</template>
