<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { Plus, Search, Edit3, Trash2 } from 'lucide-vue-next'
import RoleLayout from '@/components/RoleLayout.vue'
import PageHeader from '@/components/PageHeader.vue'
import { restaurantNav } from '@/lib/nav'
import { getMenuItems, createMenuItem, updateMenuItem, deleteMenuItem } from '@/lib/api'
import { useAuthStore } from '@/stores/auth'
import Button from '@/components/ui/Button.vue'
import Input from '@/components/ui/Input.vue'
import Switch from '@/components/ui/Switch.vue'
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

const CATEGORY_MAP: Record<string, string> = {
  APPETIZER: "Starters",
  MAIN_COURSE: "Mains",
  DESSERT: "Desserts",
  BEVERAGE: "Beverages",
  SIDES: "Sides",
}

const DEFAULT_CATEGORIES = Object.keys(CATEGORY_MAP)

const auth = useAuthStore()
const items = ref<any[]>([])
const loading = ref(true)
const cat = ref("All")
const error = ref<string | null>(null)

const isDialogOpen = ref(false)
const activeItem = ref<any>(null)
const saving = ref(false)
const deleteConfirm = ref({ isOpen: false, target: null as any | null })
const availabilityConfirm = ref({ isOpen: false, target: null as any | null })

const formState = ref({
  name: "",
  price: "",
  category: "MAIN_COURSE",
  description: "",
  isAvailable: true,
  fulfillmentOwner: "KITCHEN",
})

const restaurantId = computed(() => {
  if (!auth.user || !auth.user.restaurantId) return "";
  return typeof auth.user.restaurantId === "string" ? auth.user.restaurantId : (auth.user.restaurantId as any)._id || (auth.user.restaurantId as any).id;
})

async function fetchItems() {
  if (!restaurantId.value) return;
  loading.value = true;
  try {
    const response = await getMenuItems(restaurantId.value, 1, 100);
    items.value = response.data || [];
    error.value = null;
  } catch (err: any) {
    error.value = err.message || "Failed to fetch menu items.";
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  fetchItems();
})

const categories = computed(() => Array.from(new Set(items.value.map((i) => i.category || "Uncategorized"))))
const allCategories = computed(() => Array.from(new Set([...DEFAULT_CATEGORIES, ...categories.value])))

const filtered = computed(() => cat.value === "All" ? items.value : items.value.filter((i) => (i.category || "Uncategorized") === cat.value))

function confirmToggleStatus(item: any) {
  availabilityConfirm.value = {
    isOpen: true,
    target: item,
  };
}

async function handleToggleStatus() {
  if (!availabilityConfirm.value.target) return;
  const item = availabilityConfirm.value.target;
  try {
    await updateMenuItem(item.id || item._id, { isAvailable: !item.isAvailable });
    await fetchItems();
  } catch (err) {
    alert("Failed to update availability.");
  } finally {
    availabilityConfirm.value = { isOpen: false, target: null };
  }
}

async function handleDelete() {
  if (!deleteConfirm.value.target) return;
  try {
    await deleteMenuItem(deleteConfirm.value.target.id || deleteConfirm.value.target._id);
    await fetchItems();
  } catch (err) {
    alert("Failed to delete item.");
  } finally {
    deleteConfirm.value = { isOpen: false, target: null };
  }
}

function resetForm() {
  formState.value = {
    name: "",
    price: "",
    category: "MAIN_COURSE",
    description: "",
    isAvailable: true,
    fulfillmentOwner: "KITCHEN",
  };
  activeItem.value = null;
}

function openCreateDialog() {
  resetForm();
  isDialogOpen.value = true;
}

function openEditDialog(item: any) {
  activeItem.value = item;
  formState.value = {
    name: item.name || "",
    price: item.price ? String(item.price) : "",
    category: item.category || "MAIN_COURSE",
    description: item.description || "",
    isAvailable: item.isAvailable ?? true,
    fulfillmentOwner: item.fulfillmentOwner || "KITCHEN",
  };
  isDialogOpen.value = true;
}

async function handleSave() {
  if (!restaurantId.value) return alert("No restaurant ID found for user.");
  saving.value = true;
  try {
    const payload = {
      ...formState.value,
      fulfillmentOwner: formState.value.fulfillmentOwner as 'KITCHEN' | 'WAITER',
      price: Number(formState.value.price),
      restaurantId: restaurantId.value,
    };
    if (activeItem.value) {
      await updateMenuItem(activeItem.value.id || activeItem.value._id, payload);
    } else {
      await createMenuItem(payload);
    }
    isDialogOpen.value = false;
    await fetchItems();
  } catch (err: any) {
    alert(err.message || "Failed to save menu item.");
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <RoleLayout role="restaurant_admin" :nav="restaurantNav">
    <PageHeader
      title="Menu"
      subtitle="Manage your dishes, prices and availability."
    >
      <template #action>
        <Button class="gradient-primary text-primary-foreground" @click="openCreateDialog">
          <Plus class="h-4 w-4 mr-2" />Add item
        </Button>
      </template>
    </PageHeader>

    <div v-if="error" class="mb-4 rounded-2xl border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-destructive">
      {{ error }}
    </div>

    <div class="flex flex-col md:flex-row gap-4 mb-6">
      <div class="relative flex-1 max-w-sm">
        <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search items…" class="pl-9 bg-muted/40 border-0" />
      </div>
      <div class="flex gap-2 overflow-x-auto pb-1 hide-scrollbar">
        <button
          v-for="c in ['All', ...allCategories]"
          :key="c"
          @click="cat = c"
          :class="['px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition', cat === c ? 'gradient-primary text-primary-foreground shadow-soft' : 'bg-muted/40 hover:bg-muted']"
        >
          {{ c === 'All' ? 'All' : (CATEGORY_MAP[c] || c) }}
        </button>
      </div>
    </div>

    <div v-if="loading" class="text-center py-12 text-muted-foreground">Loading menu items...</div>
    <div v-else-if="filtered.length === 0" class="text-center py-12 text-muted-foreground">No menu items found.</div>
    <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      <div v-for="item in filtered" :key="item.id" class="group rounded-2xl bg-card border border-border overflow-hidden shadow-soft hover:shadow-glow transition-all flex flex-col">
        <div class="aspect-[4/3] bg-gradient-to-br from-primary/15 to-accent/30 grid place-items-center relative">
          <span class="text-7xl">🍽️</span>
          <div class="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button size="icon" variant="secondary" class="h-7 w-7 rounded-full bg-white/80 hover:bg-white text-foreground" @click="openEditDialog(item)">
              <Edit3 class="h-3 w-3" />
            </Button>
            <Button size="icon" variant="destructive" class="h-7 w-7 rounded-full" @click="deleteConfirm = { isOpen: true, target: item }">
              <Trash2 class="h-3 w-3" />
            </Button>
          </div>
        </div>
        <div class="p-4 space-y-3 flex-1 flex flex-col">
          <div class="flex-1">
            <div class="text-xs text-muted-foreground uppercase tracking-wider">{{ CATEGORY_MAP[item.category] || item.category }}</div>
            <div class="font-semibold mt-0.5">{{ item.name }}</div>
            <div v-if="item.description" class="text-xs text-muted-foreground mt-1 line-clamp-2">{{ item.description }}</div>
          </div>
          <div class="flex items-center justify-between mt-auto">
            <div class="font-display text-xl font-bold">${{ item.price }}</div>
            <div class="flex items-center gap-2">
              <span class="text-xs text-muted-foreground">{{ item.isAvailable ? "Available" : "Off" }}</span>
              <Switch :checked="item.isAvailable" @update:checked="confirmToggleStatus(item)" />
            </div>
          </div>
        </div>
      </div>
    </div>

    <Dialog :open="isDialogOpen" @update:open="isDialogOpen = $event">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{{ activeItem ? "Edit Menu Item" : "Add Menu Item" }}</DialogTitle>
          <DialogDescription>
            {{ activeItem ? "Update this dish's details." : "Add a new dish to your restaurant's menu." }}
          </DialogDescription>
        </DialogHeader>
        <form @submit.prevent="handleSave" class="space-y-4">
          <div class="grid gap-4 md:grid-cols-2">
            <label class="space-y-1.5 text-sm font-medium">
              <span>Name</span>
              <Input v-model="formState.name" required />
            </label>
            <label class="space-y-1.5 text-sm font-medium">
              <span>Price</span>
              <Input type="number" step="0.01" min="0" v-model="formState.price" required />
            </label>
          </div>
          <div class="grid gap-4 md:grid-cols-2">
            <label class="space-y-1.5 text-sm font-medium flex flex-col">
              <span>Category</span>
              <select
                v-model="formState.category"
                class="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option v-for="c in allCategories" :key="c" :value="c">{{ CATEGORY_MAP[c] || c }}</option>
              </select>
            </label>
            <label class="space-y-1.5 text-sm font-medium flex flex-col">
              <span>Prepared By</span>
              <select
                v-model="formState.fulfillmentOwner"
                class="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="KITCHEN">Kitchen (Chef)</option>
                <option value="WAITER">Front of House (Waiter)</option>
              </select>
            </label>
          </div>
          <label class="space-y-1.5 text-sm font-medium flex flex-col">
            <span>Description</span>
            <Input v-model="formState.description" />
          </label>
          <div class="flex items-center gap-2 pt-2">
            <Switch :checked="formState.isAvailable" @update:checked="formState.isAvailable = $event" />
            <span class="text-sm font-medium">Available for orders</span>
          </div>
          <DialogFooter class="mt-6">
            <Button type="button" variant="ghost" @click="isDialogOpen = false">Cancel</Button>
            <Button type="submit" :disabled="saving">
              {{ saving ? "Saving..." : "Save Item" }}
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

    <AlertDialog :open="availabilityConfirm.isOpen" @update:open="availabilityConfirm.isOpen = $event">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Confirm Availability Change</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to mark {{ availabilityConfirm.target?.name }} as {{ availabilityConfirm.target?.isAvailable ? 'Unavailable' : 'Available' }}?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel @click="availabilityConfirm.isOpen = false">Cancel</AlertDialogCancel>
          <AlertDialogAction class="gradient-primary text-primary-foreground font-semibold shadow-soft" @click="handleToggleStatus">
            Confirm
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </RoleLayout>
</template>
