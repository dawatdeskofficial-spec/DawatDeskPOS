<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { Plus, Edit3, Trash2 } from 'lucide-vue-next'
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

const isDialogOpen = ref(false)
const activeStaff = ref<any>(null)
const saving = ref(false)
const deleteConfirm = ref({ isOpen: false, target: null as any | null })

const formState = ref({
  name: "",
  email: "",
  password: "",
  role: "waiter",
  phone: "",
  shift: "Morning",
})

const restaurantId = computed(() => {
  if (!auth.user || !auth.user.restaurantId) return "";
  return typeof auth.user.restaurantId === "string" ? auth.user.restaurantId : (auth.user.restaurantId as any)._id || (auth.user.restaurantId as any).id;
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
    shift: "Morning",
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
    shift: staffUser.shift || "Morning",
  };
  isDialogOpen.value = true;
}

async function handleDelete() {
  if (!deleteConfirm.value.target) return;
  try {
    await deleteUser(deleteConfirm.value.target.id);
    await fetchStaff();
  } catch (err) {
    alert("Failed to delete user.");
  } finally {
    deleteConfirm.value = { isOpen: false, target: null };
  }
}

async function handleToggleStatus(staffUser: any) {
  try {
    if (staffUser.isActive) {
      await deactivateUser(staffUser.id);
    } else {
      await activateUser(staffUser.id);
    }
    await fetchStaff();
  } catch (err) {
    alert("Failed to change user status.");
  }
}

async function handleSave() {
  if (!restaurantId.value) return alert("No restaurant ID found for user.");
  saving.value = true;
  try {
    if (activeStaff.value) {
      const payload: any = {
        name: formState.value.name,
        email: formState.value.email.trim(),
        role: formState.value.role,
        phone: formState.value.phone,
        shift: formState.value.shift,
      };
      if (formState.value.password) {
        payload.password = formState.value.password;
      }
      await updateUser(activeStaff.value.id || activeStaff.value._id, payload);
    } else {
      await adminCreateUser({
        ...formState.value,
        role: formState.value.role as any,
        restaurantId: restaurantId.value,
      });
    }
    isDialogOpen.value = false;
    await fetchStaff();
  } catch (err: any) {
    alert(err.message || "Failed to save user.");
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

    <div v-if="loading" class="text-center py-12 text-muted-foreground">Loading staff...</div>
    <div v-else-if="staff.length === 0" class="text-center py-12 text-muted-foreground">No staff found.</div>
    <div v-else class="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <div v-for="u in staff" :key="u.id" class="group rounded-2xl bg-card border border-border p-5 shadow-soft hover:shadow-glow transition relative overflow-hidden">
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
                <option value="restaurant_admin">Manager / Admin</option>
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
          <div class="grid gap-4 md:grid-cols-2">
            <label class="space-y-1.5 text-sm font-medium">
              <span>Shift Preference</span>
              <Input v-model="formState.shift" placeholder="e.g. Morning, Evening" />
            </label>
            <label class="space-y-1.5 text-sm font-medium">
              <span>Password</span>
              <Input type="password" v-model="formState.password" :placeholder="activeStaff ? 'Leave blank to keep current' : 'Required for new users'" :required="!activeStaff" />
            </label>
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
