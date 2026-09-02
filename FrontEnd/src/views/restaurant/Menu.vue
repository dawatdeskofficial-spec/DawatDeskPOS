<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { Edit3, Plus, Search, Tags, Trash2, X } from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import RoleLayout from '@/components/RoleLayout.vue'
import PageHeader from '@/components/PageHeader.vue'
import { restaurantNav } from '@/lib/nav'
import {
  getMenuItems,
  createMenuItem,
  updateMenuItem,
  deleteMenuItem,
  getCategoriesByRestaurant,
  createCategory,
  updateCategory,
  deleteCategory,
  reorderCategories,
  type MenuCategory,
} from '@/lib/api'
import { useAuthStore } from '@/stores/auth'
import Button from '@/components/ui/Button.vue'
import Input from '@/components/ui/Input.vue'
import Switch from '@/components/ui/Switch.vue'
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

type CategoryFormMode = 'create' | 'edit'
type CategoryDialogSource = 'manager' | 'menuForm'

const auth = useAuthStore()
const items = ref<any[]>([])
const categories = ref<MenuCategory[]>([])
const loading = ref(true)
const categoriesLoading = ref(true)
const cat = ref("All")
const query = ref("")
const error = ref<string | null>(null)

const isDialogOpen = ref(false)
const activeItem = ref<any>(null)
const saving = ref(false)
const deleteConfirm = ref({ isOpen: false, target: null as any | null })

const isCategoryDialogOpen = ref(false)
const categorySaving = ref(false)
const categoryMode = ref<CategoryFormMode>('create')
const categorySource = ref<CategoryDialogSource>('manager')
const activeCategory = ref<MenuCategory | null>(null)
const categoryDeleteConfirm = ref({ isOpen: false, target: null as MenuCategory | null })
const categoryForm = ref({
  name: "",
  description: "",
  icon: "",
  isActive: true,
})

const formState = ref({
  name: "",
  price: "",
  categoryId: "",
  description: "",
  isAvailable: true,
  fulfillmentOwner: "KITCHEN",
})

const restaurantId = computed(() => {
  return auth.effectiveRestaurantId || ""
})

const sortedCategories = computed(() => {
  return [...categories.value].sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0) || a.name.localeCompare(b.name))
})

function getCategoryId(category: MenuCategory) {
  return category._id || category.id || ""
}

function getItemCategoryId(item: any) {
  if (!item.categoryId) return ""
  return typeof item.categoryId === "string" ? item.categoryId : item.categoryId._id || item.categoryId.id || ""
}

function getItemCategoryName(item: any) {
  if (item.categoryId && typeof item.categoryId === "object" && item.categoryId.name) {
    return item.categoryId.name
  }
  return item.category || "Uncategorized"
}

async function fetchCategories() {
  if (!restaurantId.value) return
  categoriesLoading.value = true
  try {
    const response = await getCategoriesByRestaurant(restaurantId.value)
    categories.value = response.data || []
  } catch (err: any) {
    error.value = err.message || "Failed to fetch categories."
  } finally {
    categoriesLoading.value = false
  }
}

async function fetchItems() {
  if (!restaurantId.value) return
  loading.value = true
  try {
    const response = await getMenuItems(restaurantId.value, 1, 100)
    items.value = response.data || []
    error.value = null
  } catch (err: any) {
    error.value = err.message || "Failed to fetch menu items."
  } finally {
    loading.value = false
  }
}

async function refreshData() {
  await Promise.all([fetchCategories(), fetchItems()])
}

onMounted(() => {
  refreshData()
})

const filtered = computed(() => {
  const search = query.value.trim().toLowerCase()
  return items.value.filter((item) => {
    const selectedCategoryMatches = cat.value === "All" || getItemCategoryId(item) === cat.value
    const searchMatches = !search
      || item.name?.toLowerCase().includes(search)
      || item.description?.toLowerCase().includes(search)
      || getItemCategoryName(item).toLowerCase().includes(search)

    return selectedCategoryMatches && searchMatches
  })
})

function resetForm() {
  formState.value = {
    name: "",
    price: "",
    categoryId: sortedCategories.value[0] ? getCategoryId(sortedCategories.value[0]) : "",
    description: "",
    isAvailable: true,
    fulfillmentOwner: "KITCHEN",
  }
  activeItem.value = null
}

function openCreateDialog() {
  resetForm()
  isDialogOpen.value = true
}

function openEditDialog(item: any) {
  activeItem.value = item
  formState.value = {
    name: item.name || "",
    price: item.price ? String(item.price) : "",
    categoryId: getItemCategoryId(item),
    description: item.description || "",
    isAvailable: item.isAvailable ?? true,
    fulfillmentOwner: item.fulfillmentOwner || "KITCHEN",
  }
  isDialogOpen.value = true
}

function handleCategorySelect(event: Event) {
  const value = (event.target as HTMLSelectElement).value
  if (value === "__create__") {
    openCreateCategoryDialog('menuForm')
    return
  }
  formState.value.categoryId = value
}

async function handleSave() {
  if (!restaurantId.value) return toast.error("No restaurant ID found for user.")
  if (!formState.value.categoryId) return toast.error("Select or create a category before saving this item.")

  saving.value = true
  try {
    const payload = {
      name: formState.value.name,
      description: formState.value.description,
      isAvailable: formState.value.isAvailable,
      fulfillmentOwner: formState.value.fulfillmentOwner as 'KITCHEN' | 'WAITER',
      price: Number(formState.value.price),
      restaurantId: restaurantId.value,
      categoryId: formState.value.categoryId,
    }

    if (activeItem.value) {
      await updateMenuItem(activeItem.value.id || activeItem.value._id, payload)
      toast.success("Menu item updated.")
    } else {
      await createMenuItem(payload)
      toast.success("Menu item created.")
    }

    isDialogOpen.value = false
    await refreshData()
  } catch (err: any) {
    toast.error(err.message || "Failed to save menu item.")
  } finally {
    saving.value = false
  }
}

async function handleToggleAvailability(item: any, newState?: boolean) {
  const targetId = item.id || item._id
  const targetState = newState !== undefined ? Boolean(newState) : !item.isAvailable
  const previousState = item.isAvailable

  // Optimistic UI update
  item.isAvailable = targetState

  try {
    await updateMenuItem(targetId, { isAvailable: targetState })
    toast.success(`✓ ${item.name} is now ${targetState ? 'Available' : 'Unavailable'}`)
  } catch (err: any) {
    // Rollback state on error
    item.isAvailable = previousState
    toast.error(err.message || "Failed to update availability.")
  }
}

async function handleDelete() {
  if (!deleteConfirm.value.target) return
  try {
    await deleteMenuItem(deleteConfirm.value.target.id || deleteConfirm.value.target._id)
    toast.success("Menu item deleted.")
    await refreshData()
  } catch (err: any) {
    toast.error(err.message || "Failed to delete item.")
  } finally {
    deleteConfirm.value = { isOpen: false, target: null }
  }
}

function resetCategoryForm() {
  categoryForm.value = {
    name: "",
    description: "",
    icon: "",
    isActive: true,
  }
  activeCategory.value = null
}

function openCreateCategoryDialog(source: CategoryDialogSource = 'manager') {
  resetCategoryForm()
  categoryMode.value = 'create'
  categorySource.value = source
  isCategoryDialogOpen.value = true
}

function openEditCategoryDialog(category: MenuCategory) {
  activeCategory.value = category
  categoryMode.value = 'edit'
  categorySource.value = 'manager'
  categoryForm.value = {
    name: category.name || "",
    description: category.description || "",
    icon: category.icon || "",
    isActive: category.isActive !== false,
  }
  isCategoryDialogOpen.value = true
}

async function handleCategorySave() {
  if (!restaurantId.value) return toast.error("No restaurant ID found for user.")
  if (!categoryForm.value.name.trim()) return toast.error("Category name is required.")

  categorySaving.value = true
  try {
    let savedCategory: MenuCategory
    if (categoryMode.value === 'edit' && activeCategory.value) {
      const response = await updateCategory(getCategoryId(activeCategory.value), categoryForm.value)
      savedCategory = response.data
      toast.success("Category updated.")
    } else {
      const response = await createCategory({
        restaurantId: restaurantId.value,
        ...categoryForm.value,
      })
      savedCategory = response.data
      toast.success("Category created.")
    }

    isCategoryDialogOpen.value = false
    await fetchCategories()

    if (categorySource.value === 'menuForm' && savedCategory) {
      formState.value.categoryId = getCategoryId(savedCategory)
    }
  } catch (err: any) {
    toast.error(err.message || "Failed to save category.")
  } finally {
    categorySaving.value = false
  }
}

async function toggleCategory(category: MenuCategory) {
  try {
    await updateCategory(getCategoryId(category), { isActive: !category.isActive })
    toast.success(category.isActive ? "Category deactivated." : "Category activated.")
    await fetchCategories()
  } catch (err: any) {
    toast.error(err.message || "Failed to update category.")
  }
}

async function handleCategoryDelete() {
  const target = categoryDeleteConfirm.value.target
  if (!target) return

  try {
    await deleteCategory(getCategoryId(target))
    toast.success("Category deleted.")
    if (cat.value === getCategoryId(target)) cat.value = "All"
    await fetchCategories()
  } catch (err: any) {
    toast.error(err.message || "Failed to delete category.")
  } finally {
    categoryDeleteConfirm.value = { isOpen: false, target: null }
  }
}

async function moveCategory(index: number, direction: -1 | 1) {
  const ordered = sortedCategories.value
  const nextIndex = index + direction
  if (nextIndex < 0 || nextIndex >= ordered.length || !restaurantId.value) return

  const categoryIds = ordered.map(getCategoryId)
  const [moved] = categoryIds.splice(index, 1)
  categoryIds.splice(nextIndex, 0, moved)

  categories.value = ordered.map((category, currentIndex) => {
    const nextOrder = categoryIds.indexOf(getCategoryId(category))
    return { ...category, displayOrder: nextOrder === -1 ? currentIndex : nextOrder }
  })

  try {
    const response = await reorderCategories(restaurantId.value, categoryIds)
    categories.value = response.data || categories.value
  } catch (err: any) {
    toast.error(err.message || "Failed to reorder categories.")
    await fetchCategories()
  }
}
</script>

<template>
  <RoleLayout role="restaurant_admin" :nav="restaurantNav">
    <PageHeader
      title="Menu"
      subtitle="Manage your dishes, categories, prices and availability."
    >
      <template #action>
        <Button class="gradient-primary text-primary-foreground" @click="openCreateDialog">
          <Plus class="h-4 w-4 mr-2" />Add item
        </Button>
      </template>
    </PageHeader>

    <div v-if="error" class="mb-4 rounded-lg border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-destructive">
      {{ error }}
    </div>

    <section class="mb-6 rounded-2xl border border-border bg-card shadow-soft overflow-hidden">
      <div class="flex items-center justify-between p-4 border-b border-border">
        <div>
          <div class="flex items-center gap-2 font-display text-base sm:text-lg font-bold">
            <Tags class="h-5 w-5 text-primary" />
            Category Management
          </div>
          <p class="text-xs text-muted-foreground mt-0.5 hidden sm:block">Categories are scoped to this restaurant and ordered from the database.</p>
        </div>
        <Button variant="outline" size="sm" class="h-8 text-xs font-semibold px-3" @click="openCreateCategoryDialog('manager')">
          <Plus class="h-3.5 w-3.5 mr-1" />Add Category
        </Button>
      </div>

      <div v-if="categoriesLoading" class="p-5 text-sm text-muted-foreground">Loading categories...</div>
      <div v-else-if="sortedCategories.length === 0" class="p-5 text-sm text-muted-foreground">
        No categories yet. Create one before adding menu items.
      </div>
      <template v-else>
        <!-- Desktop Table (Hidden on Mobile) -->
        <div class="hidden md:block overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="bg-muted/30 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th class="px-4 py-3 font-semibold">Category</th>
                <th class="px-4 py-3 font-semibold">Items</th>
                <th class="px-4 py-3 font-semibold">Status</th>
                <th class="px-4 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(category, index) in sortedCategories" :key="getCategoryId(category)" class="border-t border-border">
                <td class="px-4 py-3">
                  <div class="font-semibold">{{ category.name }}</div>
                  <div v-if="category.description" class="text-xs text-muted-foreground mt-0.5">{{ category.description }}</div>
                </td>
                <td class="px-4 py-3 tabular-nums">{{ category.itemCount ?? 0 }}</td>
                <td class="px-4 py-3">
                  <button
                    @click="toggleCategory(category)"
                    :class="[
                      'text-xs font-semibold px-2.5 py-1 rounded-full inline-flex items-center gap-1.5 border transition cursor-pointer',
                      category.isActive
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25 hover:bg-emerald-500/20'
                        : 'bg-muted text-muted-foreground border-border hover:bg-muted/80'
                    ]"
                    title="Click to toggle active status"
                  >
                    <span :class="['h-1.5 w-1.5 rounded-full', category.isActive ? 'bg-emerald-500' : 'bg-muted-foreground']" />
                    {{ category.isActive ? "Active" : "Inactive" }}
                  </button>
                </td>
                <td class="px-4 py-3">
                  <div class="flex justify-end gap-1.5">
                    <Button size="icon" variant="ghost" class="h-8 w-8" @click="openEditCategoryDialog(category)" title="Edit category">
                      <Edit3 class="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" class="h-8 w-8 text-destructive hover:text-destructive" @click="categoryDeleteConfirm = { isOpen: true, target: category }" title="Delete category">
                      <Trash2 class="h-4 w-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Mobile Category Cards (Visible on Mobile) -->
        <div class="block md:hidden divide-y divide-border">
          <div
            v-for="category in sortedCategories"
            :key="getCategoryId(category)"
            class="p-3.5 flex items-center justify-between gap-3"
          >
            <!-- Left: Category Name and Items Count -->
            <div class="min-w-0 flex-1">
              <div class="font-bold text-sm text-foreground truncate">
                {{ category.name }}
              </div>
              <div class="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1.5">
                <span class="font-semibold text-foreground/80">{{ category.itemCount ?? 0 }} items</span>
                <span v-if="category.description" class="truncate opacity-75">· {{ category.description }}</span>
              </div>
            </div>

            <!-- Right: Active Switch + Edit & Delete Actions -->
            <div class="flex items-center gap-2 shrink-0">
              <!-- Active Switch Toggle -->
              <div class="flex items-center gap-1.5 pr-1.5 border-r border-border">
                <span :class="['text-[10px] font-bold', category.isActive ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground']">
                  {{ category.isActive ? 'Active' : 'Off' }}
                </span>
                <Switch :checked="category.isActive" @update:checked="toggleCategory(category)" title="Toggle Category Active Status" />
              </div>

              <!-- Action buttons -->
              <div class="flex items-center gap-1">
                <button
                  @click="openEditCategoryDialog(category)"
                  class="h-8 w-8 rounded-xl border border-border bg-muted/40 hover:bg-muted flex items-center justify-center text-foreground cursor-pointer transition"
                  title="Edit Category"
                >
                  <Edit3 class="h-3.5 w-3.5" />
                </button>
                <button
                  @click="categoryDeleteConfirm = { isOpen: true, target: category }"
                  class="h-8 w-8 rounded-xl border border-destructive/20 bg-destructive/10 hover:bg-destructive/20 flex items-center justify-center text-destructive cursor-pointer transition"
                  title="Delete Category"
                >
                  <Trash2 class="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </template>
    </section>

    <div class="flex flex-col md:flex-row gap-4 mb-6">
      <div class="relative flex-1 max-w-sm">
        <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input v-model="query" placeholder="Search dishes, descriptions, categories…" class="pl-9 pr-9 bg-muted/40 border-0 text-xs" />
        <button
          v-if="query"
          @click="query = ''"
          class="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        >
          <X class="h-3.5 w-3.5" />
        </button>
      </div>
      <div class="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        <button
          @click="cat = 'All'"
          :class="['px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition cursor-pointer', cat === 'All' ? 'gradient-primary text-primary-foreground shadow-soft' : 'bg-muted/60 text-muted-foreground hover:bg-muted']"
        >
          All
        </button>
        <button
          v-for="category in sortedCategories"
          :key="getCategoryId(category)"
          @click="cat = getCategoryId(category)"
          :class="['px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition cursor-pointer', cat === getCategoryId(category) ? 'gradient-primary text-primary-foreground shadow-soft' : 'bg-muted/60 text-muted-foreground hover:bg-muted', !category.isActive ? 'opacity-60' : '']"
        >
          {{ category.name }}
        </button>
      </div>
    </div>

    <div v-if="loading" class="text-center py-12 text-muted-foreground text-sm">Loading menu items...</div>
    <div v-else-if="filtered.length === 0" class="text-center py-12 text-muted-foreground rounded-2xl border-2 border-dashed border-border p-8">
      <Search class="h-8 w-8 mx-auto mb-2 opacity-30 text-muted-foreground" />
      <p class="font-semibold text-sm">No menu items found{{ query ? ` matching "${query}"` : '' }}.</p>
      <Button v-if="query || cat !== 'All'" size="sm" variant="ghost" class="mt-2 text-xs" @click="query = ''; cat = 'All'">
        Reset Filters
      </Button>
    </div>
    <!-- Mobile Compact Dish Cards (Space-saving list on Mobile) -->
    <div v-else class="block sm:hidden space-y-2.5">
      <div
        v-for="item in filtered"
        :key="item.id || item._id"
        class="p-3.5 rounded-2xl bg-card border border-border shadow-2xs flex items-center justify-between gap-3"
      >
        <div class="min-w-0 flex-1 space-y-1">
          <div class="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
            {{ getItemCategoryName(item) }}
          </div>
          <div class="font-bold text-sm text-foreground truncate">
            {{ item.name }}
          </div>
          <div v-if="item.description" class="text-[11px] text-muted-foreground line-clamp-1">
            {{ item.description }}
          </div>
          <div class="flex items-center gap-3 pt-1">
            <span class="font-display font-extrabold text-base text-foreground">₹{{ item.price }}</span>
            <div class="flex items-center gap-1.5 pl-2.5 border-l border-border">
              <span :class="['text-[10px] font-bold', item.isAvailable ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground']">
                {{ item.isAvailable ? 'Available' : 'Off' }}
              </span>
              <Switch :checked="item.isAvailable" @update:checked="handleToggleAvailability(item, $event)" />
            </div>
          </div>
        </div>

        <!-- Edit / Delete Quick Actions -->
        <div class="flex items-center gap-1 shrink-0">
          <button
            @click="openEditDialog(item)"
            class="h-8 w-8 rounded-xl border border-border bg-muted/40 hover:bg-muted flex items-center justify-center text-foreground cursor-pointer"
            title="Edit Dish"
          >
            <Edit3 class="h-3.5 w-3.5" />
          </button>
          <button
            @click="deleteConfirm = { isOpen: true, target: item }"
            class="h-8 w-8 rounded-xl border border-destructive/20 bg-destructive/10 hover:bg-destructive/20 flex items-center justify-center text-destructive cursor-pointer"
            title="Delete Dish"
          >
            <Trash2 class="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>

    <!-- Desktop Grid (Unchanged on Laptops & Desktops) -->
    <div class="hidden sm:grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      <div v-for="item in filtered" :key="item.id || item._id" class="group rounded-2xl bg-card border border-border overflow-hidden shadow-soft hover:shadow-glow transition-all flex flex-col">
        <div class="aspect-[4/3] bg-gradient-to-br from-primary/15 to-accent/30 grid place-items-center relative">
          <span class="text-7xl">{{ item.image || "Dish" }}</span>
          <div class="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button size="icon" variant="secondary" class="h-7 w-7 rounded-full bg-background/90 hover:bg-background text-foreground shadow-xs cursor-pointer" @click="openEditDialog(item)">
              <Edit3 class="h-3 w-3" />
            </Button>
            <Button size="icon" variant="destructive" class="h-7 w-7 rounded-full shadow-xs cursor-pointer" @click="deleteConfirm = { isOpen: true, target: item }">
              <Trash2 class="h-3 w-3" />
            </Button>
          </div>
        </div>
        <div class="p-4 space-y-3 flex-1 flex flex-col">
          <div class="flex-1">
            <div class="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{{ getItemCategoryName(item) }}</div>
            <div class="font-bold text-sm mt-0.5 text-foreground">{{ item.name }}</div>
            <div v-if="item.description" class="text-xs text-muted-foreground mt-1 line-clamp-2">{{ item.description }}</div>
          </div>
          <div class="flex items-center justify-between mt-auto pt-2 border-t border-border/40">
            <div class="font-display text-lg font-bold">₹{{ item.price }}</div>
            <div class="flex items-center gap-2">
              <span :class="['text-xs font-semibold transition-colors', item.isAvailable ? 'text-success' : 'text-muted-foreground']">
                {{ item.isAvailable ? "Available" : "Off" }}
              </span>
              <Switch :checked="item.isAvailable" @update:checked="handleToggleAvailability(item, $event)" />
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
                :value="formState.categoryId"
                required
                class="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                @change="handleCategorySelect"
              >
                <option value="" disabled>Select category...</option>
                <option v-for="category in sortedCategories" :key="getCategoryId(category)" :value="getCategoryId(category)">
                  {{ category.name }}
                </option>
                <option value="__create__">+ Create New Category</option>
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
      </DialogContent>
    </Dialog>

    <Dialog :open="isCategoryDialogOpen" @update:open="isCategoryDialogOpen = $event">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{{ categoryMode === 'edit' ? "Edit Category" : "Create Category" }}</DialogTitle>
          <DialogDescription>
            Categories belong only to this restaurant.
          </DialogDescription>
        </DialogHeader>
        <form @submit.prevent="handleCategorySave" class="space-y-4">
          <label class="space-y-1.5 text-sm font-medium flex flex-col">
            <span>Category Name</span>
            <Input v-model="categoryForm.name" required />
          </label>
          <label class="space-y-1.5 text-sm font-medium flex flex-col">
            <span>Description</span>
            <Input v-model="categoryForm.description" />
          </label>
          <label class="space-y-1.5 text-sm font-medium flex flex-col">
            <span>Icon/Image</span>
            <Input v-model="categoryForm.icon" placeholder="Optional image URL or short label" />
          </label>
          <div class="flex items-center gap-2 pt-2">
            <Switch :checked="categoryForm.isActive" @update:checked="categoryForm.isActive = $event" />
            <span class="text-sm font-medium">Active for customers</span>
          </div>
          <DialogFooter class="mt-6">
            <Button type="button" variant="ghost" @click="isCategoryDialogOpen = false">Cancel</Button>
            <Button type="submit" :disabled="categorySaving">
              {{ categorySaving ? "Saving..." : (categoryMode === 'edit' ? "Save Category" : "Create") }}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    <AlertDialog :open="deleteConfirm.isOpen" @update:open="deleteConfirm.isOpen = $event">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete menu item?</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently delete {{ deleteConfirm.target?.name }}.
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

    <AlertDialog :open="categoryDeleteConfirm.isOpen" @update:open="categoryDeleteConfirm.isOpen = $event">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete category?</AlertDialogTitle>
          <AlertDialogDescription>
            Categories with menu items cannot be deleted. Move the items first, then delete the category.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel @click="categoryDeleteConfirm.isOpen = false">Cancel</AlertDialogCancel>
          <AlertDialogAction variant="destructive" @click="handleCategoryDelete">
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </RoleLayout>
</template>
