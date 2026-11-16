<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { Plus, Edit3, Trash2, Search, X, Mail, CheckCircle2, RefreshCw, ShieldCheck } from 'lucide-vue-next'
import RoleLayout from '@/components/RoleLayout.vue'
import PageHeader from '@/components/PageHeader.vue'
import { adminNav } from '@/lib/nav'
import type { BackendUser } from '@/lib/api'
import { getAllUsers, adminCreateUser, updateUser, deleteUser, deactivateUser, activateUser, getRestaurants, sendOtp, verifyOtp, resendUserOtp } from '@/lib/api'
import { useAuthStore } from '@/stores/auth'
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

const ROLE_OPTIONS = [
  { value: "main_admin", label: "Main Admin" },
  { value: "restaurant_admin", label: "Restaurant Admin" },
  { value: "waiter", label: "Waiter" },
  { value: "chef", label: "Chef" },
  { value: "cashier", label: "Cashier" },
]

const users = ref<BackendUser[]>([])
const restaurants = ref<any[]>([])
const loading = ref(true)
const auth = useAuthStore()
const searchQuery = ref('')
const selectedRole = ref('ALL')

const activeUser = ref<BackendUser | null>(null)
const isDialogOpen = ref(false)
const saving = ref(false)
const deleteConfirm = ref({ isOpen: false, target: null as BackendUser | null })

const error = ref<string | null>(null)
const success = ref<string | null>(null)

const formState = ref({
  name: "",
  email: "",
  role: "waiter",
  phone: "",
  location: "",
  password: "",
  restaurantId: "",
})

async function fetchData() {
  loading.value = true;
  error.value = null;
  try {
    const [usersRes, restRes] = await Promise.all([
      getAllUsers(1, 50),
      getRestaurants(),
    ]);
    users.value = usersRes.data ?? [];
    restaurants.value = restRes.data ?? [];
  } catch (err: any) {
    error.value = err.message || "Unable to load data.";
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  fetchData();
})

const resendingOtpId = ref<string | null>(null);

function resetForm() {
  formState.value = {
    name: "",
    email: "",
    role: "waiter",
    phone: "",
    location: "",
    password: "",
    restaurantId: "",
  };
  activeUser.value = null;
  error.value = null;
  success.value = null;
}

async function handleResendOtp(u: BackendUser) {
  const userId = u.id || (u as any)._id;
  resendingOtpId.value = userId;
  error.value = null;
  try {
    const res = await resendUserOtp(userId) as any;
    success.value = res.message || `Verification OTP sent to ${u.email} from dawatdesk.official@gmail.com`;
    setTimeout(() => { success.value = null; }, 5000);
  } catch (err: any) {
    error.value = err.message || "Failed to resend OTP";
  } finally {
    resendingOtpId.value = null;
  }
}

function openCreateDialog() {
  resetForm();
  isDialogOpen.value = true;
}

function openEditDialog(user: BackendUser) {
  activeUser.value = user;
  const resId = typeof user.restaurantId === 'string' 
    ? user.restaurantId 
    : (user.restaurantId as any)?.id || (user.restaurantId as any)?._id || "";
    
  formState.value = {
    name: user.name ?? "",
    email: user.email ?? "",
    role: user.role?.toLowerCase() ?? "waiter",
    phone: user.phone ?? "",
    location: user.location ?? "",
    password: "",
    restaurantId: resId,
  };
  error.value = null;
  success.value = null;
  isDialogOpen.value = true;
}

async function handleSave() {
  error.value = null;
  success.value = null;
  if (!formState.value.name.trim() || !formState.value.email.trim()) {
    error.value = "Name and email are required.";
    return;
  }
  if (formState.value.role !== "main_admin" && !formState.value.restaurantId) {
    error.value = "Restaurant assignment is required for this role.";
    return;
  }
  
  saving.value = true;
  try {
    const payload: any = {
      name: formState.value.name.trim(),
      email: formState.value.email.trim(),
      role: formState.value.role,
      phone: formState.value.phone.trim(),
      location: formState.value.location.trim(),
    };
    if (formState.value.role !== "main_admin") {
      payload.restaurantId = formState.value.restaurantId;
    }
    if (formState.value.password) {
      payload.password = formState.value.password;
    }

    if (activeUser.value) {
      await updateUser(activeUser.value.id || (activeUser.value as any)._id, payload);
      success.value = "User updated successfully.";
    } else {
      const res = await adminCreateUser({
        ...payload,
        email: formState.value.email.trim(),
      }) as any;
      success.value = res.message || "User created! A verification OTP has been sent from dawatdesk.official@gmail.com to the user.";
    }
    await fetchData();
    isDialogOpen.value = false;
  } catch (err: any) {
    error.value = err.message || "Unable to save user.";
  } finally {
    saving.value = false;
  }
}

async function handleToggleActive(user: BackendUser) {
  error.value = null;
  try {
    if (user.isActive) {
      await deactivateUser(user.id || (user as any)._id);
    } else {
      await activateUser(user.id || (user as any)._id);
    }
    await fetchData();
  } catch (err: any) {
    error.value = err.message || "Unable to update status.";
  }
}

async function handleDelete() {
  if (!deleteConfirm.value.target) return;
  error.value = null;
  try {
    await deleteUser(deleteConfirm.value.target.id || (deleteConfirm.value.target as any)._id);
    await fetchData();
  } catch (err: any) {
    error.value = err.message || "Unable to delete user.";
  } finally {
    deleteConfirm.value = { isOpen: false, target: null };
  }
}

const userColumns = computed(() => {
  return users.value.map(user => ({
    ...user,
    restaurantName: typeof user.restaurantId === "string" ? user.restaurantId : (user.restaurantId as any)?.name ?? "—"
  }))
})

const filteredUsers = computed(() => {
  let list = userColumns.value
  if (selectedRole.value !== 'ALL') {
    list = list.filter(u => (u.role || '').toLowerCase() === selectedRole.value.toLowerCase())
  }
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase().trim()
    list = list.filter(u => {
      const name = (u.name || '').toLowerCase()
      const email = (u.email || '').toLowerCase()
      const phone = (u.phone || '').toLowerCase()
      const location = (u.location || '').toLowerCase()
      const restName = (u.restaurantName || '').toLowerCase()
      const role = (u.role || '').toLowerCase()
      return name.includes(q) || email.includes(q) || phone.includes(q) || location.includes(q) || restName.includes(q) || role.includes(q)
    })
  }
  return list
})

function formatDate(ds: string) {
  if (!ds) return ""
  return new Date(ds).toLocaleDateString()
}
</script>

<template>
  <RoleLayout role="main_admin" :nav="adminNav">
    <PageHeader
      title="User Management"
      subtitle="Add, edit and remove staff accounts connected to the database."
    >
      <template #action>
        <Button class="gradient-primary text-primary-foreground" @click="openCreateDialog">
          <Plus class="h-4 w-4 mr-2" /> Add user
        </Button>
      </template>
    </PageHeader>

    <div v-if="error" class="mb-4 rounded-2xl border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-destructive">
      {{ error }}
    </div>

    <!-- Search & Role Ribbon -->
    <div class="mb-4 rounded-2xl bg-card/95 backdrop-blur-md border border-border shadow-soft p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sticky top-16 z-20">
      <div class="relative flex-1 max-w-md">
        <Search class="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          v-model="searchQuery"
          placeholder="Search user by name, email, role, phone, or restaurant…"
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

      <!-- Role Filter -->
      <div class="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
        <button
          v-for="roleOption in [
            { label: 'All Users', value: 'ALL' },
            { label: 'Admins', value: 'main_admin' },
            { label: 'Managers', value: 'restaurant_admin' },
            { label: 'Waiters', value: 'waiter' },
            { label: 'Chefs', value: 'chef' },
            { label: 'Cashiers', value: 'cashier' }
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
          ({{ filteredUsers.length }})
        </span>
      </div>
    </div>

    <!-- User Directory Container -->
    <div class="rounded-2xl bg-card border border-border shadow-soft overflow-hidden">
      <!-- ═════════════════════════════════════════════════════════════════════ -->
      <!-- MOBILE USER CARD LIST (< md screens / phone devices)                -->
      <!-- ═════════════════════════════════════════════════════════════════════ -->
      <div class="block md:hidden divide-y divide-border/60 max-h-[calc(100vh-270px)] overflow-y-auto sidebar-scrollbar">
        <div v-if="loading" class="p-8 text-center text-muted-foreground text-xs">
          Loading users…
        </div>
        <div v-else-if="userColumns.length === 0" class="p-8 text-center text-muted-foreground text-xs">
          No users found.
        </div>
        <div v-else-if="filteredUsers.length === 0" class="p-8 text-center text-muted-foreground text-xs">
          No users matching "{{ searchQuery }}".
          <button @click="searchQuery = ''; selectedRole = 'ALL'" class="text-primary underline ml-1 text-xs font-bold">Reset</button>
        </div>
        <div
          v-else
          v-for="user in filteredUsers"
          :key="user.id || (user as any)._id"
          class="p-3.5 space-y-2.5 hover:bg-muted/10 transition"
        >
          <!-- User Header -->
          <div class="flex items-start justify-between gap-2">
            <div class="flex items-center gap-2.5 min-w-0 flex-1">
              <div class="h-9 w-9 rounded-xl gradient-primary text-primary-foreground flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
                {{ user.name?.[0]?.toUpperCase() ?? "U" }}
              </div>
              <div class="min-w-0 flex-1">
                <div class="font-bold text-sm text-foreground truncate leading-snug">
                  {{ user.name }}
                </div>
                <div class="text-xs text-muted-foreground truncate">
                  {{ user.email }}
                </div>
              </div>
            </div>

            <!-- Role Badge -->
            <Badge variant="secondary" class="text-[10px] font-bold uppercase shrink-0">
              {{ user.role }}
            </Badge>
          </div>

          <!-- Meta Information -->
          <div class="flex items-center justify-between text-xs text-muted-foreground pt-1">
            <div class="flex items-center gap-1 truncate max-w-[200px]">
              <span class="font-semibold text-foreground">Venue:</span>
              <span class="truncate">{{ user.role === 'main_admin' ? 'All (Main Admin)' : user.restaurantName }}</span>
            </div>
            <Badge :class="user.isActive ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-[10px] font-bold' : 'bg-destructive/10 text-destructive border-destructive/20 text-[10px] font-bold'">
              {{ user.isActive ? "Active" : "Inactive" }}
            </Badge>
          </div>

          <!-- Actions -->
          <div class="pt-1.5 flex items-center justify-end gap-2 border-t border-border/40">
            <Button
              size="sm"
              variant="outline"
              class="h-8 px-3 rounded-xl text-xs font-semibold gap-1 hover:bg-muted active:scale-95 transition"
              @click="openEditDialog(user)"
            >
              <Edit3 class="h-3.5 w-3.5" />
              <span>Edit User</span>
            </Button>
            <Button
              v-if="auth.user?.id !== (user.id || (user as any)._id)"
              size="sm"
              variant="destructive"
              class="h-8 px-3 rounded-xl text-xs font-semibold gap-1 active:scale-95 transition"
              @click="deleteConfirm = { isOpen: true, target: user }"
            >
              <Trash2 class="h-3.5 w-3.5" />
              <span>Delete</span>
            </Button>
          </div>
        </div>
      </div>

      <!-- ═════════════════════════════════════════════════════════════════════ -->
      <!-- DESKTOP DATA TABLE (>= md screens)                                  -->
      <!-- ═════════════════════════════════════════════════════════════════════ -->
      <div class="hidden md:block overflow-x-auto overflow-y-auto max-h-[calc(100vh-270px)] min-h-[350px] sidebar-scrollbar">
        <table class="min-w-full text-sm">
          <thead class="bg-muted/90 backdrop-blur-md sticky top-0 z-10 text-muted-foreground text-xs uppercase tracking-wider shadow-2xs">
            <tr>
              <th class="text-left px-5 py-3 font-medium">Name</th>
              <th class="text-left px-5 py-3 font-medium">Email</th>
              <th class="text-left px-5 py-3 font-medium">Role</th>
              <th class="text-left px-5 py-3 font-medium">Restaurant</th>
              <th class="text-left px-5 py-3 font-medium">Status</th>
              <th class="text-right px-5 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loading">
              <td colspan="6" class="px-5 py-10 text-center text-muted-foreground">Loading users…</td>
            </tr>
            <tr v-else-if="userColumns.length === 0">
              <td colspan="6" class="px-5 py-10 text-center text-muted-foreground">No users found.</td>
            </tr>
            <tr v-else-if="filteredUsers.length === 0">
              <td colspan="6" class="px-5 py-10 text-center text-muted-foreground">
                No users matching "{{ searchQuery }}".
                <button @click="searchQuery = ''; selectedRole = 'ALL'" class="text-primary underline ml-1 text-xs font-bold">Reset</button>
              </td>
            </tr>
            <tr v-else v-for="user in filteredUsers" :key="user.id || (user as any)._id" class="border-t border-border hover:bg-muted/30 transition-colors">
              <td class="px-5 py-4 font-medium flex items-center gap-3">
                <div class="h-9 w-9 rounded-full gradient-primary grid place-items-center text-primary-foreground text-xs font-semibold shrink-0">
                  {{ user.name?.[0] ?? "U" }}
                </div>
                <div>
                  <div class="font-bold text-foreground">{{ user.name }}</div>
                  <div class="text-[11px] text-muted-foreground">{{ formatDate(user.createdAt as string) }}</div>
                </div>
              </td>
              <td class="px-5 py-4 text-muted-foreground">{{ user.email }}</td>
              <td class="px-5 py-4">
                <Badge variant="secondary" class="font-semibold">{{ user.role }}</Badge>
              </td>
              <td class="px-5 py-4 text-muted-foreground">{{ user.role === 'main_admin' ? 'All (Admin)' : user.restaurantName }}</td>
              <td class="px-5 py-4">
                <Badge :class="user.isActive ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 font-semibold' : 'bg-destructive/15 text-destructive font-semibold'">
                  {{ user.isActive ? "Active" : "Inactive" }}
                </Badge>
              </td>
              <td class="px-5 py-4 text-right">
                <div class="flex items-center justify-end gap-1.5">
                  <Button size="sm" variant="ghost" class="h-8.5 px-2.5 rounded-lg" @click="openEditDialog(user)">
                    <Edit3 class="h-4 w-4 text-muted-foreground hover:text-foreground" />
                  </Button>
                  <Button v-if="auth.user?.id !== (user.id || (user as any)._id)" size="sm" variant="ghost" class="h-8.5 px-2.5 rounded-lg text-destructive hover:bg-destructive/10" @click="deleteConfirm = { isOpen: true, target: user }">
                    <Trash2 class="h-4 w-4" />
                  </Button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <Dialog :open="isDialogOpen" @update:open="isDialogOpen = $event">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{{ activeUser ? "Edit user" : "Add user" }}</DialogTitle>
          <DialogDescription>
            {{ activeUser ? "Update user details connected to your live database." : "Create a new staff account with required fields." }}
          </DialogDescription>
        </DialogHeader>
        <form @submit.prevent="handleSave" class="space-y-5">
          <div v-if="activeUser" class="space-y-1.5 text-sm font-medium opacity-85">
            <span>User ID (Read-only)</span>
            <Input disabled :value="activeUser.id || (activeUser as any)._id" class="font-mono bg-muted" />
          </div>

          <div class="grid gap-4 md:grid-cols-2">
            <label class="space-y-2 text-sm font-medium">
              <span>Name</span>
              <Input v-model="formState.name" required />
            </label>
            <label class="space-y-2 text-sm font-medium">
              <span>Email Address</span>
              <Input type="email" v-model="formState.email" required />
            </label>
          </div>

          <!-- Notice: Credentials Welcome Email -->
          <div v-if="!activeUser" class="p-3.5 rounded-xl border border-primary/20 bg-primary/5 flex items-start gap-2.5">
            <Mail class="h-4.5 w-4.5 text-primary shrink-0 mt-0.5" />
            <div class="text-xs text-muted-foreground leading-relaxed">
              <strong class="text-foreground">Credentials Welcome Email:</strong>
              Upon registration, a welcome email containing their <strong>Role</strong>, <strong>Assigned Restaurant</strong>, <strong>Email</strong>, and <strong>Password</strong> will be automatically dispatched to their Gmail from <span class="font-mono text-primary font-semibold">dawatdesk.official@gmail.com</span>.
            </div>
          </div>

          <div class="grid gap-4 md:grid-cols-2">
            <label class="space-y-2 text-sm font-medium">
              <span>Role</span>
              <select
                v-model="formState.role"
                class="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm text-foreground shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option v-for="opt in ROLE_OPTIONS" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
              </select>
            </label>
            
            <label v-if="formState.role !== 'main_admin'" class="space-y-2 text-sm font-medium">
              <span>Restaurant Assignment</span>
              <select
                v-model="formState.restaurantId"
                required
                class="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm text-foreground shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="" disabled>Select a restaurant</option>
                <option v-for="rest in restaurants" :key="rest.id || rest._id" :value="rest.id || rest._id">
                  {{ rest.name }}
                </option>
              </select>
            </label>
            <label v-else class="space-y-2 text-sm font-medium opacity-50">
              <span>Restaurant Assignment</span>
              <Input disabled value="All (Main Admin)" />
            </label>
          </div>

          <div class="grid gap-4 md:grid-cols-2">
            <label class="space-y-2 text-sm font-medium">
              <span>Phone</span>
              <Input type="tel" v-model="formState.phone" />
            </label>
            <label class="space-y-2 text-sm font-medium">
              <span>Password</span>
              <Input type="password" v-model="formState.password" :placeholder="activeUser ? 'Leave blank to keep current password' : 'Enter password'" />
            </label>
          </div>

          <div v-if="error || success" class="rounded-xl border px-4 py-3 text-sm">
            <span v-if="error" class="text-destructive">{{ error }}</span>
            <span v-if="success" class="text-success">{{ success }}</span>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" @click="isDialogOpen = false">Cancel</Button>
            <Button type="submit" :disabled="saving" class="h-11 px-5">
              {{ saving ? "Saving…" : (activeUser ? "Update user" : "Create user") }}
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
