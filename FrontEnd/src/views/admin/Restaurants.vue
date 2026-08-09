<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Plus, Search, Edit3, Trash2 } from 'lucide-vue-next'
import RoleLayout from '@/components/RoleLayout.vue'
import PageHeader from '@/components/PageHeader.vue'
import { adminNav } from '@/lib/nav'
import { getRestaurants, createRestaurant, updateRestaurant, deleteRestaurant } from '@/lib/api'
import Button from '@/components/ui/Button.vue'
import Input from '@/components/ui/Input.vue'
import Badge from '@/components/ui/Badge.vue'
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

const restaurantsList = ref<any[]>([])
const loading = ref(true)
const error = ref<string | null>(null)

const isDialogOpen = ref(false)
const activeRestaurant = ref<any>(null)
const saving = ref(false)

const deleteConfirm = ref({ isOpen: false, target: null as any | null })

const formState = ref({
  name: "",
  location: "",
  phone: "",
  email: "",
  description: "",
})

async function fetchRestaurants() {
  loading.value = true;
  try {
    const response = await getRestaurants();
    restaurantsList.value = response.data || [];
    error.value = null;
  } catch (err: any) {
    error.value = err.message || "Failed to load restaurants.";
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  fetchRestaurants();
})

function resetForm() {
  formState.value = {
    name: "",
    location: "",
    phone: "",
    email: "",
    description: "",
  };
  activeRestaurant.value = null;
}

function openCreateDialog() {
  resetForm();
  isDialogOpen.value = true;
}

function openEditDialog(restaurant: any) {
  activeRestaurant.value = restaurant;
  formState.value = {
    name: restaurant.name || "",
    location: restaurant.location || "",
    phone: restaurant.phone || "",
    email: restaurant.email || "",
    description: restaurant.description || "",
  };
  isDialogOpen.value = true;
}

async function handleDelete() {
  if (!deleteConfirm.value.target) return;
  try {
    await deleteRestaurant(deleteConfirm.value.target.id || deleteConfirm.value.target._id);
    await fetchRestaurants();
  } catch (err: any) {
    alert(err.message || "Failed to delete restaurant.");
  } finally {
    deleteConfirm.value = { isOpen: false, target: null };
  }
}

async function handleSave() {
  saving.value = true;
  error.value = null;
  try {
    if (activeRestaurant.value) {
      await updateRestaurant(activeRestaurant.value.id || activeRestaurant.value._id, formState.value);
    } else {
      await createRestaurant(formState.value);
    }
    isDialogOpen.value = false;
    await fetchRestaurants();
  } catch (err: any) {
    error.value = err.message || "Failed to save restaurant.";
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <RoleLayout role="main_admin" :nav="adminNav">
    <PageHeader
      title="Restaurants"
      subtitle="All venues currently using Savoria."
    >
      <template #action>
        <Button class="gradient-primary text-primary-foreground" @click="openCreateDialog">
          <Plus class="h-4 w-4 mr-2" />Add restaurant
        </Button>
      </template>
    </PageHeader>

    <div v-if="error" class="mb-4 rounded-2xl border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-destructive">
      {{ error }}
    </div>

    <div class="rounded-2xl bg-card border border-border shadow-soft overflow-hidden">
      <div class="p-4 border-b border-border flex items-center gap-3">
        <div class="relative flex-1 max-w-sm">
          <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search venues…" class="pl-9 bg-muted/40 border-0" />
        </div>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="bg-muted/40 text-muted-foreground text-xs uppercase tracking-wider">
            <tr>
              <th class="text-left px-6 py-3 font-medium">Restaurant</th>
              <th class="text-left px-6 py-3 font-medium">Location</th>
              <th class="text-left px-6 py-3 font-medium">Phone</th>
              <th class="text-left px-6 py-3 font-medium">Email</th>
              <th class="text-left px-6 py-3 font-medium">Status</th>
              <th class="text-right px-6 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loading">
              <td colspan="6" class="px-6 py-10 text-center text-muted-foreground">Loading restaurants...</td>
            </tr>
            <tr v-else-if="restaurantsList.length === 0">
              <td colspan="6" class="px-6 py-10 text-center text-muted-foreground">No restaurants found.</td>
            </tr>
            <tr v-else v-for="r in restaurantsList" :key="r.id || r._id" class="border-t border-border hover:bg-muted/30">
              <td class="px-6 py-4 font-medium">{{ r.name }}</td>
              <td class="px-6 py-4 text-muted-foreground">{{ r.location || "—" }}</td>
              <td class="px-6 py-4 text-muted-foreground">{{ r.phone || "—" }}</td>
              <td class="px-6 py-4 text-muted-foreground">{{ r.email || "—" }}</td>
              <td class="px-6 py-4">
                <Badge :class="r.isActive ? 'bg-success/15 text-success' : 'bg-muted text-muted-foreground'">
                  {{ r.isActive ? "Active" : "Inactive" }}
                </Badge>
              </td>
              <td class="px-6 py-4 text-right">
                <div class="flex items-center justify-end gap-2">
                  <Button size="sm" variant="ghost" @click="openEditDialog(r)">
                    <Edit3 class="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="destructive" @click="deleteConfirm = { isOpen: true, target: r }">
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
          <DialogTitle>{{ activeRestaurant ? "Edit Restaurant" : "Add Restaurant" }}</DialogTitle>
          <DialogDescription>
            {{ activeRestaurant ? "Update restaurant details." : "Add a new restaurant venue to the system." }}
          </DialogDescription>
        </DialogHeader>
        <form @submit.prevent="handleSave" class="space-y-4">
          <div class="grid gap-4 md:grid-cols-2">
            <label class="space-y-1.5 text-sm font-medium">
              <span>Name</span>
              <Input v-model="formState.name" required />
            </label>
            <label class="space-y-1.5 text-sm font-medium">
              <span>Location</span>
              <Input v-model="formState.location" required />
            </label>
          </div>
          <div class="grid gap-4 md:grid-cols-2">
            <label class="space-y-1.5 text-sm font-medium">
              <span>Phone</span>
              <Input v-model="formState.phone" required />
            </label>
            <label class="space-y-1.5 text-sm font-medium">
              <span>Email</span>
              <Input type="email" v-model="formState.email" />
            </label>
          </div>
          <label class="space-y-1.5 text-sm font-medium flex flex-col">
            <span>Description</span>
            <Input v-model="formState.description" />
          </label>
          <DialogFooter class="mt-6">
            <Button type="button" variant="ghost" @click="isDialogOpen = false">Cancel</Button>
            <Button type="submit" :disabled="saving">
              {{ saving ? "Saving..." : "Save Restaurant" }}
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
