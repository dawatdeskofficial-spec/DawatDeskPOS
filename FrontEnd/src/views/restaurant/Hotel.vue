<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import {
  BedDouble, Plus, Search, Filter, RefreshCw, Calendar, Clock,
  User, Phone, Mail, DollarSign, CheckCircle2, AlertCircle, X,
  FileText, ArrowRight, Eye, ShieldAlert, Sparkles, Building2,
  Trash2, Edit3, Download, Layers, CheckCheck, TrendingUp,
  Percent, ChevronRight, Ban
} from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import RoleLayout from '@/components/RoleLayout.vue'
import PageHeader from '@/components/PageHeader.vue'
import StatCard from '@/components/StatCard.vue'
import Button from '@/components/ui/Button.vue'
import Badge from '@/components/ui/Badge.vue'
import Input from '@/components/ui/Input.vue'
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
import { restaurantNav } from '@/lib/nav'
import { useAuthStore } from '@/stores/auth'
import {
  getHotelDashboardStats, getHotelRooms, getHotelRoomTypes,
  createHotelRoom, updateHotelRoom, toggleHotelRoom, deleteHotelRoom,
  updateRoomHousekeeping, getHotelBookings,
  getHotelReports, cancelHotelBooking, getHotelInvoicePdfUrl
} from '@/lib/api'

const auth = useAuthStore()
const router = useRouter()

const restaurantId = computed(() => {
  return auth.effectiveRestaurantId || ''
})

// Navigation tabs - Strictly the 3 requested pages:
// 1. Room Inventory ('rooms')
// 2. Reservations & Stays ('bookings')
// 3. Hotel Reports ('reports')
const activeTab = ref<'rooms' | 'bookings' | 'reports'>('rooms')

// Loading states
const loading = ref(true)
const actionLoading = ref(false)

// Dashboard data
const stats = ref<any>({
  totalRooms: 0,
  availableRooms: 0,
  occupiedRooms: 0,
  reservedRooms: 0,
  cleaningRooms: 0,
  maintenanceRooms: 0,
  todayCheckIns: 0,
  todayCheckOuts: 0,
  activeStays: 0,
  occupancyRate: 0,
  totalRevenue: 0,
  todayRevenue: 0,
})

// Rooms state
const roomsList = ref<any[]>([])
const roomSearch = ref('')
const roomStatusFilter = ref<string>('ALL')

// Room Types state
const roomTypesList = ref<any[]>([])

// Bookings state
const bookingsList = ref<any[]>([])
const bookingTotal = ref(0)
const bookingPage = ref(1)
const bookingStatusFilter = ref<string>('ALL')
const bookingSearch = ref('')

// Reports state
const reportsData = ref<any>(null)

// ── MODALS STATE ─────────────────────────────────────────────────────────────
const showRoomModal = ref(false)
const editingRoom = ref<any>(null)
const deleteRoomConfirm = ref<{ isOpen: boolean; target: any | null }>({
  isOpen: false,
  target: null,
})
const roomForm = ref({
  roomNumber: '',
  roomTypeId: '',
  floor: '1',
  capacity: 2,
  baseTariff: 1500,
  extraPersonCharge: 0,
  description: '',
})

const showMaintenanceModal = ref(false)
const maintenanceTargetRoom = ref<any>(null)
const maintenanceReasonInput = ref('')

const showCancelModal = ref(false)
const cancelReasonInput = ref('')
const bookingToCancel = ref<any>(null)

// ── DATA FETCHING ─────────────────────────────────────────────────────────────

async function loadData() {
  if (!restaurantId.value) return
  loading.value = true
  try {
    const [statsRes, roomsRes, typesRes] = await Promise.all([
      getHotelDashboardStats(restaurantId.value).catch(() => ({ data: {} })),
      getHotelRooms({}, restaurantId.value).catch(() => ({ data: [] })),
      getHotelRoomTypes(restaurantId.value).catch(() => ({ data: [] })),
    ])
    if (statsRes.data) stats.value = statsRes.data
    roomsList.value = roomsRes.data || []
    roomTypesList.value = typesRes.data || []
  } catch (err: any) {
    toast.error(err.message || 'Failed to load hotel data')
  } finally {
    loading.value = false
  }
}

async function loadBookings() {
  if (!restaurantId.value) return
  loading.value = true
  try {
    const res = await getHotelBookings(
      {
        page: bookingPage.value,
        limit: 25,
        status: bookingStatusFilter.value,
        search: bookingSearch.value,
      },
      restaurantId.value
    )
    bookingsList.value = res.data || []
    bookingTotal.value = res.pagination?.total || 0
  } catch (err: any) {
    toast.error(err.message || 'Failed to load reservations')
  } finally {
    loading.value = false
  }
}

async function loadReports() {
  if (!restaurantId.value) return
  loading.value = true
  try {
    const res = await getHotelReports({}, restaurantId.value)
    reportsData.value = res.data || null
  } catch (err: any) {
    toast.error(err.message || 'Failed to load reports')
  } finally {
    loading.value = false
  }
}

function selectTab(tab: 'rooms' | 'bookings' | 'reports') {
  activeTab.value = tab
  if (tab === 'rooms') loadData()
  else if (tab === 'bookings') loadBookings()
  else if (tab === 'reports') loadReports()
}

function refreshCurrentTab() {
  if (activeTab.value === 'rooms') loadData()
  else if (activeTab.value === 'bookings') loadBookings()
  else if (activeTab.value === 'reports') loadReports()
}

onMounted(() => {
  loadData()
})

// ── ROOM ACTIONS ─────────────────────────────────────────────────────────────

const filteredRooms = computed(() => {
  return roomsList.value.filter((r) => {
    if (roomStatusFilter.value === 'RESERVED') {
      if (r.status !== 'RESERVED' && !r.upcomingReservation) return false
    } else if (roomStatusFilter.value !== 'ALL' && r.status !== roomStatusFilter.value) {
      return false
    }
    if (roomSearch.value.trim()) {
      const q = roomSearch.value.toLowerCase().trim()
      const matchNum = (r.roomNumber || '').toLowerCase().includes(q)
      const matchGuest = (r.activeBooking?.guest?.name || '').toLowerCase().includes(q)
      const matchUpcoming = (r.upcomingReservation?.guest?.name || '').toLowerCase().includes(q)
      return matchNum || matchGuest || matchUpcoming
    }
    return true
  })
})

function openAddRoomModal() {
  editingRoom.value = null
  roomForm.value = {
    roomNumber: '',
    roomTypeId: roomTypesList.value[0]?._id || '',
    floor: '1',
    capacity: 2,
    baseTariff: 1500,
    extraPersonCharge: 0,
    description: '',
  }
  showRoomModal.value = true
}

function openEditRoomModal(room: any) {
  editingRoom.value = room
  roomForm.value = {
    roomNumber: room.roomNumber,
    roomTypeId: room.roomTypeId?._id || room.roomTypeId || '',
    floor: room.floor || '1',
    capacity: room.capacity || 2,
    baseTariff: room.baseTariff || 1500,
    extraPersonCharge: room.extraPersonCharge || 0,
    description: room.description || '',
  }
  showRoomModal.value = true
}

async function saveRoom() {
  if (!roomForm.value.roomNumber.trim()) {
    toast.error('Room number is required')
    return
  }
  actionLoading.value = true
  try {
    if (editingRoom.value) {
      await updateHotelRoom(editingRoom.value._id || editingRoom.value.id, roomForm.value, restaurantId.value)
      toast.success(`Room ${roomForm.value.roomNumber} updated successfully`)
    } else {
      await createHotelRoom(roomForm.value, restaurantId.value)
      toast.success(`Room ${roomForm.value.roomNumber} created successfully`)
    }
    showRoomModal.value = false
    await loadData()
  } catch (err: any) {
    toast.error(err.message || 'Failed to save room')
  } finally {
    actionLoading.value = false
  }
}

function promptDeleteRoom(room: any) {
  deleteRoomConfirm.value = {
    isOpen: true,
    target: room,
  }
}

async function confirmDeleteRoom() {
  const target = deleteRoomConfirm.value.target
  if (!target) return
  actionLoading.value = true
  try {
    const res = (await deleteHotelRoom(target._id || target.id, restaurantId.value)) as any
    toast.success(res?.message || `Room ${target.roomNumber} removed successfully`)
    deleteRoomConfirm.value = { isOpen: false, target: null }
    await loadData()
  } catch (err: any) {
    toast.error(err.message || 'Failed to remove room')
  } finally {
    actionLoading.value = false
  }
}

async function toggleRoomActive(room: any) {
  try {
    await toggleHotelRoom(room._id || room.id, restaurantId.value)
    toast.success(`Room ${room.roomNumber} status toggled`)
    await loadData()
  } catch (err: any) {
    toast.error(err.message || 'Failed to toggle room')
  }
}

function openMaintenanceModal(room: any) {
  maintenanceTargetRoom.value = room
  maintenanceReasonInput.value = room.maintenanceReason || 'Scheduled Maintenance'
  showMaintenanceModal.value = true
}

async function submitMaintenance() {
  if (!maintenanceTargetRoom.value) return
  actionLoading.value = true
  try {
    await updateRoomHousekeeping(
      maintenanceTargetRoom.value._id || maintenanceTargetRoom.value.id,
      'MAINTENANCE',
      maintenanceReasonInput.value,
      restaurantId.value
    )
    toast.success(`Room ${maintenanceTargetRoom.value.roomNumber} marked under maintenance`)
    showMaintenanceModal.value = false
    await loadData()
  } catch (err: any) {
    toast.error(err.message || 'Failed to set maintenance')
  } finally {
    actionLoading.value = false
  }
}

async function markRoomCleaned(room: any) {
  try {
    await updateRoomHousekeeping(room._id || room.id, 'AVAILABLE', '', restaurantId.value)
    toast.success(`Room ${room.roomNumber} is now Cleaned and Available!`)
    await loadData()
  } catch (err: any) {
    toast.error(err.message || 'Failed to update housekeeping')
  }
}

// ── BOOKING ACTIONS ───────────────────────────────────────────────────────────

function openCancelModal(b: any) {
  bookingToCancel.value = b
  cancelReasonInput.value = 'Cancelled upon guest request'
  showCancelModal.value = true
}

async function confirmCancelBooking() {
  if (!bookingToCancel.value) return
  actionLoading.value = true
  try {
    await cancelHotelBooking(
      bookingToCancel.value._id || bookingToCancel.value.id,
      cancelReasonInput.value,
      restaurantId.value
    )
    toast.success(`Booking ${bookingToCancel.value.bookingReference} cancelled`)
    showCancelModal.value = false
    await loadBookings()
    await loadData()
  } catch (err: any) {
    toast.error(err.message || 'Failed to cancel booking')
  } finally {
    actionLoading.value = false
  }
}

const statusBadgeConfig: Record<string, { label: string; class: string }> = {
  AVAILABLE: { label: 'Available', class: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/25' },
  RESERVED: { label: 'Reserved', class: 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/25' },
  OCCUPIED: { label: 'Occupied', class: 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/25' },
  CLEANING: { label: 'Cleaning', class: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/25' },
  MAINTENANCE: { label: 'Maintenance', class: 'bg-slate-500/15 text-slate-600 dark:text-slate-400 border-slate-500/25' },
  CHECKED_IN: { label: 'Active Stay', class: 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/25' },
  CHECKED_OUT: { label: 'Checked Out', class: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/25' },
  CANCELLED: { label: 'Cancelled', class: 'bg-slate-500/15 text-slate-600 dark:text-slate-400 border-slate-500/25' },
  NO_SHOW: { label: 'No Show', class: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/25' },
}

function getStatusBadge(status: string) {
  return statusBadgeConfig[status] || { label: status, class: 'bg-muted text-muted-foreground' }
}
</script>

<template>
  <RoleLayout role="restaurant_admin" :nav="restaurantNav" brand="DawatDesk Hotel">
    <div class="space-y-5 max-w-7xl mx-auto">
      <!-- Page Header -->
      <PageHeader
        title="Hotel Room Management"
        description="Oversee room inventory, reservations, active stays, and hotel revenue reports."
      >
        <template #action>
          <div class="flex items-center gap-1.5 sm:gap-2">
            <Button variant="outline" size="sm" class="h-8.5 sm:h-9 px-2.5 sm:px-3 gap-1.5 text-xs rounded-xl cursor-pointer" @click="refreshCurrentTab">
              <RefreshCw :class="['h-3.5 w-3.5', loading ? 'animate-spin' : '']" />
              <span class="hidden sm:inline">Refresh</span>
            </Button>
            <Button
              v-if="activeTab === 'rooms'"
              size="sm"
              class="gradient-primary text-primary-foreground font-bold h-8.5 sm:h-9 px-3 sm:px-4 text-xs rounded-xl shadow-xs cursor-pointer"
              @click="openAddRoomModal"
            >
              <Plus class="h-3.5 w-3.5 sm:mr-1" />
              <span class="hidden sm:inline">Add Room</span>
              <span class="sm:hidden">Add</span>
            </Button>
          </div>
        </template>
      </PageHeader>

      <!-- Navigation Tabs - Horizontally scrollable strip on mobile -->
      <div class="flex items-center gap-1.5 sm:gap-2 border-b border-border overflow-x-auto no-scrollbar pb-1.5 -mx-1 px-1 text-xs font-semibold">
        <button
          @click="selectTab('rooms')"
          :class="['px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl transition cursor-pointer flex items-center gap-1.5 sm:gap-2 shrink-0 whitespace-nowrap font-bold', activeTab === 'rooms' ? 'bg-primary text-primary-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50']"
        >
          <BedDouble class="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
          <span>Room Inventory ({{ roomsList.length }})</span>
        </button>
        <button
          @click="selectTab('bookings')"
          :class="['px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl transition cursor-pointer flex items-center gap-1.5 sm:gap-2 shrink-0 whitespace-nowrap font-bold', activeTab === 'bookings' ? 'bg-primary text-primary-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50']"
        >
          <Calendar class="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
          <span>Reservations &amp; Stays</span>
        </button>
        <button
          @click="selectTab('reports')"
          :class="['px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl transition cursor-pointer flex items-center gap-1.5 sm:gap-2 shrink-0 whitespace-nowrap font-bold', activeTab === 'reports' ? 'bg-primary text-primary-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50']"
        >
          <TrendingUp class="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
          <span>Hotel Reports</span>
        </button>
      </div>

      <!-- PAGE 1: ROOM INVENTORY -->
      <div v-if="activeTab === 'rooms'" class="space-y-5">
        <!-- Overview Stats Cards embedded directly in Room Inventory -->
        <div class="space-y-3.5">
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
            <StatCard label="Total Rooms" :value="stats.totalRooms" delta="Inventory count" delta-tone="muted" :icon="BedDouble" tone="primary" />
            <StatCard label="Available Rooms" :value="stats.availableRooms" delta="Ready for check-in" delta-tone="muted" :icon="CheckCircle2" tone="success" />
            <StatCard label="Occupied Rooms" :value="stats.occupiedRooms" delta="Currently checked-in" delta-tone="muted" :icon="User" tone="destructive" />
            <StatCard label="Reserved Rooms" :value="stats.reservedRooms" delta="Upcoming bookings" delta-tone="muted" :icon="Clock" tone="info" />
          </div>

          <!-- Occupancy Quick Health Bar -->
          <div class="rounded-2xl border border-border bg-card p-4 space-y-2.5 shadow-xs">
            <div class="flex items-center justify-between">
              <div>
                <h3 class="font-bold text-xs text-foreground uppercase tracking-wider">Property Occupancy Rate</h3>
                <p class="text-[11px] text-muted-foreground">Live room allocation and housekeeping status.</p>
              </div>
              <span class="text-xl font-black text-primary">{{ stats.occupancyRate }}%</span>
            </div>
            <div class="w-full bg-muted/60 rounded-full h-2.5 overflow-hidden flex">
              <div class="bg-rose-500 h-full transition-all duration-500" :style="{ width: stats.totalRooms ? ((stats.occupiedRooms / stats.totalRooms) * 100) + '%' : '0%' }" title="Occupied" />
              <div class="bg-blue-500 h-full transition-all duration-500" :style="{ width: stats.totalRooms ? ((stats.reservedRooms / stats.totalRooms) * 100) + '%' : '0%' }" title="Reserved" />
              <div class="bg-amber-500 h-full transition-all duration-500" :style="{ width: stats.totalRooms ? ((stats.cleaningRooms / stats.totalRooms) * 100) + '%' : '0%' }" title="Cleaning" />
              <div class="bg-slate-400 h-full transition-all duration-500" :style="{ width: stats.totalRooms ? ((stats.maintenanceRooms / stats.totalRooms) * 100) + '%' : '0%' }" title="Maintenance" />
              <div class="bg-emerald-500 h-full transition-all duration-500" :style="{ width: stats.totalRooms ? ((stats.availableRooms / stats.totalRooms) * 100) + '%' : '0%' }" title="Available" />
            </div>
            <div class="flex flex-wrap items-center gap-4 text-[11px] font-medium text-muted-foreground pt-0.5">
              <span class="flex items-center gap-1.5"><span class="h-2 w-2 rounded-full bg-emerald-500" /> Available ({{ stats.availableRooms }})</span>
              <span class="flex items-center gap-1.5"><span class="h-2 w-2 rounded-full bg-rose-500" /> Occupied ({{ stats.occupiedRooms }})</span>
              <span class="flex items-center gap-1.5"><span class="h-2 w-2 rounded-full bg-blue-500" /> Reserved ({{ stats.reservedRooms }})</span>
              <span class="flex items-center gap-1.5"><span class="h-2 w-2 rounded-full bg-amber-500" /> Cleaning ({{ stats.cleaningRooms }})</span>
              <span class="flex items-center gap-1.5"><span class="h-2 w-2 rounded-full bg-slate-400" /> Maintenance ({{ stats.maintenanceRooms }})</span>
            </div>
          </div>
        </div>

        <!-- Filters & Action Bar -->
        <div class="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 p-3 rounded-2xl bg-muted/20 border border-border">
          <div class="relative flex-1 max-w-sm">
            <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input v-model="roomSearch" placeholder="Search room number, guest..." class="pl-8.5 pr-8 h-9 text-xs rounded-xl" />
          </div>
          <div class="flex items-center flex-wrap gap-2">
            <select v-model="roomStatusFilter" class="h-9 pl-3 pr-8.5 text-xs rounded-lg bg-background border border-border font-medium shadow-2xs hover:border-primary/50 transition">
              <option value="ALL">All Statuses</option>
              <option value="AVAILABLE">Available</option>
              <option value="OCCUPIED">Occupied</option>
              <option value="RESERVED">Reserved</option>
              <option value="CLEANING">Cleaning</option>
              <option value="MAINTENANCE">Maintenance</option>
            </select>
            <Button
              size="sm"
              class="gradient-primary text-primary-foreground font-bold h-9 px-3.5 rounded-xl text-xs gap-1.5 shadow-xs cursor-pointer shrink-0"
              @click="openAddRoomModal"
            >
              <Plus class="h-3.5 w-3.5" /> Add Room
            </Button>
          </div>
        </div>

        <!-- Rooms Inventory Grid -->
        <div v-if="filteredRooms.length" class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3.5">
          <div
            v-for="room in filteredRooms"
            :key="room._id || room.id"
            class="rounded-2xl border border-border bg-card p-4 space-y-3 relative hover:border-primary/40 hover:shadow-xs transition flex flex-col justify-between"
          >
            <div class="space-y-2.5">
              <!-- Header: Room Number & Status Badge -->
              <div class="flex items-start justify-between gap-2">
                <div>
                  <h4 class="font-display font-black text-lg text-foreground tracking-tight">Room {{ room.roomNumber }}</h4>
                  <p v-if="room.description" class="text-xs text-muted-foreground font-medium truncate max-w-[170px]">{{ room.description }}</p>
                </div>
                <Badge :class="[getStatusBadge(room.status).class, 'text-[10px] font-bold px-2 py-0.5 rounded-lg shrink-0']">
                  {{ getStatusBadge(room.status).label }}
                </Badge>
              </div>

              <!-- Price -->
              <div class="flex items-baseline gap-1 text-xs">
                <span class="font-black text-base text-foreground">₹{{ room.baseTariff }}</span>
                <span class="text-[11px] text-muted-foreground font-medium">/ night</span>
              </div>

              <!-- Status Info Strip -->
              <div v-if="room.status === 'AVAILABLE' && room.upcomingReservation" class="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs space-y-1.5">
                <div class="flex items-center justify-between gap-1 text-[11px] font-bold text-blue-700 dark:text-blue-300">
                  <span class="flex items-center gap-1 truncate">
                    <Calendar class="h-3 w-3 shrink-0 text-blue-600" />
                    From {{ new Date(room.upcomingReservation.checkInDate).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) }}
                  </span>
                  <span class="text-[9px] font-mono text-blue-600 shrink-0 px-1.5 py-0.5 rounded bg-blue-500/15">
                    {{ room.upcomingReservation.bookingReference?.slice(-8) }}
                  </span>
                </div>
                <div class="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                  <CheckCircle2 class="h-2.5 w-2.5" /> Free for walk-in today
                </div>
              </div>

              <div v-else-if="room.status === 'AVAILABLE'" class="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-semibold">
                <CheckCircle2 class="h-3.5 w-3.5 shrink-0" />
                <span>Ready for Guests</span>
              </div>

              <div v-else-if="room.status === 'OCCUPIED' && room.activeBooking" class="p-2 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs space-y-0.5">
                <p class="font-bold text-rose-600 dark:text-rose-400 truncate flex items-center gap-1">
                  <User class="h-3.5 w-3.5 shrink-0" /> {{ room.activeBooking.guest?.name || 'Guest Occupied' }}
                </p>
                <p class="text-[11px] text-muted-foreground font-medium">
                  Checkout: {{ new Date(room.activeBooking.checkOutDate).toLocaleDateString() }}
                </p>
              </div>

              <div v-else-if="room.status === 'RESERVED' && room.activeBooking" class="p-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs space-y-0.5">
                <p class="font-bold text-blue-600 dark:text-blue-400 truncate flex items-center gap-1">
                  <Clock class="h-3.5 w-3.5 shrink-0" /> {{ room.activeBooking.guest?.name || 'Reserved' }}
                </p>
                <p class="text-[11px] text-muted-foreground font-medium">
                  Check-in: {{ new Date(room.activeBooking.checkInDate).toLocaleDateString() }}
                </p>
              </div>

              <div v-else-if="room.status === 'CLEANING'" class="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs flex items-center gap-1.5 text-amber-700 dark:text-amber-400 font-semibold">
                <RefreshCw class="h-3.5 w-3.5 shrink-0 animate-spin" />
                <span>Housekeeping in progress</span>
              </div>

              <div v-else-if="room.status === 'MAINTENANCE'" class="p-2 rounded-xl bg-slate-500/10 border border-slate-500/20 text-xs flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                <ShieldAlert class="h-3.5 w-3.5 shrink-0 text-slate-500" />
                <span class="truncate font-medium">Issue: {{ room.maintenanceReason || 'Under maintenance' }}</span>
              </div>
            </div>

            <!-- Room Action Buttons -->
            <div class="pt-2.5 border-t border-border flex items-center justify-between gap-1.5">
              <div class="flex items-center gap-1">
                <Button size="sm" variant="outline" class="h-7 w-7 p-0 rounded-lg cursor-pointer hover:bg-muted" @click="openEditRoomModal(room)" title="Edit Room Details">
                  <Edit3 class="h-3 w-3" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  class="h-7 w-7 p-0 rounded-lg text-destructive hover:bg-destructive/10 cursor-pointer"
                  @click="promptDeleteRoom(room)"
                  title="Remove Room"
                >
                  <Trash2 class="h-3 w-3" />
                </Button>
              </div>

              <div class="flex items-center gap-1">
                <Button
                  v-if="room.status === 'CLEANING'"
                  size="sm"
                  class="h-7 text-[11px] font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white gap-1 px-2 cursor-pointer"
                  @click="markRoomCleaned(room)"
                >
                  <CheckCheck class="h-3 w-3" /> Mark Clean
                </Button>
                <Button
                  v-else-if="room.status === 'AVAILABLE'"
                  size="sm"
                  variant="outline"
                  class="h-7 text-[11px] font-medium rounded-lg text-slate-600 gap-1 px-2 cursor-pointer hover:bg-muted"
                  @click="openMaintenanceModal(room)"
                >
                  <ShieldAlert class="h-3 w-3" /> Repair
                </Button>
                <Button
                  v-else-if="room.status === 'MAINTENANCE'"
                  size="sm"
                  variant="outline"
                  class="h-7 text-[11px] font-bold rounded-lg text-emerald-600 gap-1 px-2 cursor-pointer hover:bg-emerald-500/10"
                  @click="markRoomCleaned(room)"
                >
                  <CheckCircle2 class="h-3 w-3" /> Ready
                </Button>
              </div>
            </div>
          </div>
        </div>

        <!-- Empty State when no rooms match -->
        <div v-if="!filteredRooms.length" class="p-12 text-center rounded-2xl border border-dashed border-border bg-card/40">
          <BedDouble class="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
          <h4 class="font-display font-bold text-base text-foreground">No rooms found</h4>
          <p class="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
            {{ roomsList.length === 0 ? "You haven't added any hotel rooms yet. Create your first room to begin taking reservations." : "No rooms match your search and filter criteria." }}
          </p>
          <Button
            size="sm"
            class="gradient-primary text-primary-foreground font-bold h-9 px-4 rounded-xl text-xs gap-1.5 shadow-xs cursor-pointer mt-4"
            @click="openAddRoomModal"
          >
            <Plus class="h-3.5 w-3.5" /> Add Room
          </Button>
        </div>
      </div>

      <!-- PAGE 2: RESERVATIONS & STAYS -->
      <div v-else-if="activeTab === 'bookings'" class="space-y-4">
        <!-- Search & Status filter -->
        <div class="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 p-3 rounded-2xl bg-muted/20 border border-border">
          <div class="relative flex-1 max-w-sm">
            <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input v-model="bookingSearch" @keyup.enter="loadBookings" placeholder="Search guest name, phone, booking ref..." class="pl-8.5 pr-8 h-9 text-xs rounded-xl" />
          </div>
          <div class="flex items-center gap-2">
            <select v-model="bookingStatusFilter" @change="loadBookings" class="h-9 pl-3 pr-8.5 text-xs rounded-lg bg-background border border-border font-medium shadow-2xs hover:border-primary/50 transition">
              <option value="ALL">All Statuses</option>
              <option value="RESERVED">Reserved</option>
              <option value="CHECKED_IN">Checked In (Active Stay)</option>
              <option value="CHECKED_OUT">Checked Out</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
            <Button size="sm" variant="outline" class="h-9 text-xs rounded-xl cursor-pointer" @click="loadBookings">
              Filter
            </Button>
          </div>
        </div>

        <!-- Bookings Container: Mobile Cards List + Desktop Wide Table -->
        <div class="space-y-3 sm:space-y-4">
          <!-- Desktop Table View -->
          <div class="hidden sm:block rounded-2xl border border-border bg-card overflow-hidden shadow-xs">
            <div class="overflow-x-auto">
              <table class="w-full text-xs text-left">
                <thead class="bg-muted/40 border-b border-border text-muted-foreground font-semibold">
                  <tr>
                    <th class="p-3.5">Ref / Room</th>
                    <th class="p-3.5">Guest Info</th>
                    <th class="p-3.5">Stay Dates</th>
                    <th class="p-3.5">Stay Duration</th>
                    <th class="p-3.5">Financials</th>
                    <th class="p-3.5">Status</th>
                    <th class="p-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-border">
                  <tr v-if="bookingsList.length === 0">
                    <td colspan="7" class="p-8 text-center text-muted-foreground">
                      No reservations or guest stays found matching criteria.
                    </td>
                  </tr>
                  <tr v-for="b in bookingsList" :key="b._id || b.id" class="hover:bg-muted/20 transition">
                    <td class="p-3.5 font-medium">
                      <span class="font-bold font-mono text-primary block">{{ b.bookingReference }}</span>
                      <span class="text-muted-foreground">Room {{ b.roomNumber }}</span>
                    </td>
                    <td class="p-3.5">
                      <span class="font-bold text-foreground block">{{ b.guest?.name }}</span>
                      <span class="text-muted-foreground">{{ b.guest?.phone }}</span>
                    </td>
                    <td class="p-3.5 text-muted-foreground">
                      <div>In: <strong class="text-foreground">{{ new Date(b.checkInDate).toLocaleDateString() }}</strong></div>
                      <div>Out: <strong class="text-foreground">{{ new Date(b.checkOutDate).toLocaleDateString() }}</strong></div>
                    </td>
                    <td class="p-3.5 text-muted-foreground">
                      <span class="font-bold text-foreground block">{{ b.totalNights }} Night{{ b.totalNights !== 1 ? 's' : '' }}</span>
                    </td>
                    <td class="p-3.5">
                      <div class="font-bold text-foreground">₹{{ b.totalAmount }}</div>
                      <div v-if="b.discount > 0" class="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">Disc: −₹{{ b.discount }}</div>
                      <div class="text-[11px] text-emerald-600 dark:text-emerald-400">Paid: ₹{{ b.paidAmount }}</div>
                      <div v-if="b.outstandingBalance > 0" class="text-[11px] text-rose-600 font-bold">Due: ₹{{ b.outstandingBalance }}</div>
                    </td>
                    <td class="p-3.5">
                      <Badge :class="[getStatusBadge(b.status).class, 'text-[10px] font-bold px-2 py-0.5 rounded-lg']">
                        {{ getStatusBadge(b.status).label }}
                      </Badge>
                    </td>
                    <td class="p-3.5 text-right">
                      <div class="flex items-center justify-end gap-1.5">
                        <!-- Checked-out stays get direct PDF Invoice download -->
                        <a
                          v-if="b.status === 'CHECKED_OUT'"
                          :href="getHotelInvoicePdfUrl(b.invoiceId?._id || b.invoiceId || b._id, restaurantId)"
                          target="_blank"
                          class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-border text-primary hover:bg-primary/10 transition font-bold text-xs"
                          title="Download Hotel Tax Invoice PDF"
                        >
                          <Download class="h-3 w-3" /> Invoice PDF
                        </a>

                        <!-- Reserved status allows cancellation -->
                        <Button
                          v-if="b.status === 'RESERVED'"
                          size="sm"
                          variant="outline"
                          class="h-7 text-xs rounded-lg text-rose-600 hover:bg-rose-500/10 cursor-pointer"
                          @click="openCancelModal(b)"
                        >
                          <Ban class="h-3 w-3 mr-1" /> Cancel
                        </Button>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- Mobile Cards View (sm:hidden) -->
          <div class="sm:hidden space-y-2.5">
            <div v-if="bookingsList.length === 0" class="p-8 text-center text-muted-foreground rounded-2xl border border-border bg-card">
              No reservations or guest stays found matching criteria.
            </div>
            <div
              v-for="b in bookingsList"
              :key="b._id || b.id"
              class="rounded-2xl border border-border bg-card p-3.5 space-y-2.5 shadow-2xs"
            >
              <!-- Card Top: Ref & Status -->
              <div class="flex items-start justify-between gap-2">
                <div>
                  <span class="font-mono font-bold text-xs text-primary block">{{ b.bookingReference }}</span>
                  <span class="text-xs font-bold text-foreground">Room {{ b.roomNumber }}</span>
                </div>
                <Badge :class="[getStatusBadge(b.status).class, 'text-[10px] font-bold px-2 py-0.5 rounded-md shrink-0']">
                  {{ getStatusBadge(b.status).label }}
                </Badge>
              </div>

              <!-- Guest & Duration Details -->
              <div class="p-2.5 rounded-xl bg-muted/40 border border-border/50 text-xs space-y-1">
                <div class="flex items-center justify-between gap-1">
                  <span class="font-bold text-foreground truncate flex items-center gap-1.5">
                    <User class="h-3 w-3 text-muted-foreground shrink-0" />
                    {{ b.guest?.name || 'Guest' }}
                  </span>
                  <span v-if="b.guest?.phone" class="text-muted-foreground text-[11px] shrink-0">{{ b.guest.phone }}</span>
                </div>
                <div class="flex items-center justify-between text-[11px] text-muted-foreground pt-0.5">
                  <span class="flex items-center gap-1">
                    <Calendar class="h-3 w-3 shrink-0" />
                    {{ new Date(b.checkInDate).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) }} - {{ new Date(b.checkOutDate).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) }}
                  </span>
                  <span class="font-semibold text-foreground">{{ b.totalNights }}N</span>
                </div>
              </div>

              <!-- Financials & Actions Row -->
              <div class="flex items-center justify-between pt-1 border-t border-border/60 text-xs">
                <div>
                  <span class="text-[10px] text-muted-foreground block">Total</span>
                  <span class="font-black text-foreground">₹{{ b.totalAmount }}</span>
                  <span v-if="b.discount > 0" class="text-[10px] text-emerald-600 font-semibold ml-1">(−₹{{ b.discount }})</span>
                  <span v-if="b.outstandingBalance > 0" class="text-[10px] text-rose-600 font-bold ml-1.5">(Due: ₹{{ b.outstandingBalance }})</span>
                </div>
                <div class="flex items-center gap-1.5">
                  <a
                    v-if="b.status === 'CHECKED_OUT'"
                    :href="getHotelInvoicePdfUrl(b.invoiceId?._id || b.invoiceId || b._id, restaurantId)"
                    target="_blank"
                    class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-border text-primary hover:bg-primary/10 transition font-bold text-xs"
                  >
                    <Download class="h-3 w-3" /> PDF
                  </a>
                  <Button
                    v-if="b.status === 'RESERVED'"
                    size="sm"
                    variant="outline"
                    class="h-7 text-xs rounded-lg text-rose-600 hover:bg-rose-500/10 cursor-pointer"
                    @click="openCancelModal(b)"
                  >
                    <Ban class="h-3 w-3 mr-1" /> Cancel
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- PAGE 3: HOTEL REPORTS -->
      <div v-else-if="activeTab === 'reports'" class="space-y-4">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatCard label="Total Hotel Revenue" :value="'₹' + (reportsData?.totalRevenue || 0).toLocaleString()" delta="Completed stay invoices" delta-tone="muted" :icon="DollarSign" tone="success" />
          <StatCard label="Total Stays & Bookings" :value="reportsData?.totalBookings || 0" delta="Past 30 days" delta-tone="muted" :icon="Calendar" tone="info" />
          <StatCard label="Cancelled Bookings" :value="reportsData?.cancelledBookings || 0" delta="Recorded cancellations" delta-tone="muted" :icon="Ban" tone="destructive" />
        </div>

        <!-- Daily Revenue Breakdown Table -->
        <div class="rounded-2xl border border-border bg-card p-4 space-y-3 shadow-xs">
          <div class="flex items-center justify-between">
            <h4 class="font-bold text-sm text-foreground">Daily Revenue Breakdown</h4>
            <span class="text-xs text-muted-foreground font-medium">Aggregated stay revenue per checkout day</span>
          </div>
          <div class="overflow-x-auto">
            <table class="w-full text-xs text-left">
              <thead class="bg-muted/30 border-b border-border text-muted-foreground font-semibold">
                <tr>
                  <th class="p-2.5">Date</th>
                  <th class="p-2.5">Transactions Count</th>
                  <th class="p-2.5 text-right">Revenue (₹)</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-border">
                <tr v-if="!reportsData?.revenueDaily?.length">
                  <td colspan="3" class="p-6 text-center text-muted-foreground">No recent transaction data recorded.</td>
                </tr>
                <tr v-for="d in reportsData?.revenueDaily" :key="d._id">
                  <td class="p-2.5 font-medium text-foreground">{{ d._id }}</td>
                  <td class="p-2.5 text-muted-foreground">{{ d.count }} transaction(s)</td>
                  <td class="p-2.5 text-right font-black text-emerald-600 dark:text-emerald-400">₹{{ d.revenue.toLocaleString() }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>

    <!-- MODAL: ADD / EDIT ROOM -->
    <Dialog :open="showRoomModal" @update:open="showRoomModal = $event">
      <DialogContent class="max-w-[94vw] sm:max-w-md p-4 sm:p-6 rounded-2xl sm:rounded-3xl">
        <DialogHeader class="pr-10 sm:pr-12">
          <DialogTitle class="text-base sm:text-lg font-bold flex items-center gap-2">
            <BedDouble class="h-4.5 w-4.5 text-primary shrink-0" />
            {{ editingRoom ? 'Edit Room' : 'Add New Room' }}
          </DialogTitle>
          <DialogDescription class="text-xs text-muted-foreground">
            Configure room number and base nightly tariff.
          </DialogDescription>
        </DialogHeader>

        <form @submit.prevent="saveRoom" class="space-y-3.5 pt-2">
          <div class="space-y-1.5 text-xs font-medium">
            <label class="text-foreground font-semibold">Room Number *</label>
            <Input v-model="roomForm.roomNumber" required placeholder="e.g. 101" class="h-10 text-xs rounded-xl" />
          </div>

          <div class="space-y-1.5 text-xs font-medium">
            <label class="text-foreground font-semibold">Base Tariff (₹) *</label>
            <Input v-model.number="roomForm.baseTariff" type="number" min="0" required class="h-10 text-xs rounded-xl" />
          </div>

          <div class="space-y-1.5 text-xs font-medium">
            <label class="text-foreground font-semibold">Description (Optional)</label>
            <Input v-model="roomForm.description" placeholder="Notes, special view, king bed, etc." class="h-10 text-xs rounded-xl" />
          </div>

          <DialogFooter class="pt-3 flex flex-col-reverse sm:flex-row gap-2">
            <Button type="button" variant="outline" class="w-full sm:w-auto h-9 text-xs rounded-xl cursor-pointer" @click="showRoomModal = false">Cancel</Button>
            <Button type="submit" class="w-full sm:w-auto gradient-primary text-primary-foreground font-bold h-9 text-xs rounded-xl cursor-pointer" :disabled="actionLoading">
              {{ actionLoading ? 'Saving...' : 'Save Room' }}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    <!-- MODAL: SET MAINTENANCE REASON -->
    <Dialog :open="showMaintenanceModal" @update:open="showMaintenanceModal = $event">
      <DialogContent class="max-w-[94vw] sm:max-w-sm p-4 sm:p-6 rounded-2xl sm:rounded-3xl">
        <DialogHeader class="pr-10 sm:pr-12">
          <DialogTitle class="text-base font-bold flex items-center gap-2">
            <ShieldAlert class="h-4.5 w-4.5 text-amber-500 shrink-0" />
            Room {{ maintenanceTargetRoom?.roomNumber }} Maintenance
          </DialogTitle>
          <DialogDescription class="text-xs text-muted-foreground">
            Rooms under maintenance cannot be booked or checked into until restored.
          </DialogDescription>
        </DialogHeader>

        <div class="space-y-3 pt-2">
          <div class="space-y-1 text-xs font-medium">
            <label>Reason / Repairs Description</label>
            <Input v-model="maintenanceReasonInput" placeholder="e.g. AC servicing, plumbing fix..." class="h-9 text-xs rounded-xl" />
          </div>

          <DialogFooter class="pt-2 flex flex-col-reverse sm:flex-row gap-2">
            <Button type="button" variant="outline" class="w-full sm:w-auto h-9 text-xs rounded-xl cursor-pointer" @click="showMaintenanceModal = false">Cancel</Button>
            <Button class="w-full sm:w-auto bg-amber-600 hover:bg-amber-700 text-white font-bold h-9 text-xs rounded-xl cursor-pointer" @click="submitMaintenance" :disabled="actionLoading">
              Set Maintenance
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>

    <!-- MODAL: CANCEL BOOKING -->
    <Dialog :open="showCancelModal" @update:open="showCancelModal = $event">
      <DialogContent class="max-w-[94vw] sm:max-w-sm p-4 sm:p-6 rounded-2xl sm:rounded-3xl">
        <DialogHeader class="pr-10 sm:pr-12">
          <DialogTitle class="text-base font-bold flex items-center gap-2">
            <Ban class="h-4.5 w-4.5 text-rose-500 shrink-0" />
            Cancel Reservation
          </DialogTitle>
          <DialogDescription class="text-xs text-muted-foreground">
            Are you sure you want to cancel booking {{ bookingToCancel?.bookingReference }}?
          </DialogDescription>
        </DialogHeader>

        <div class="space-y-3 pt-2">
          <div class="space-y-1 text-xs font-medium">
            <label>Cancellation Reason</label>
            <Input v-model="cancelReasonInput" placeholder="Guest requested cancellation..." class="h-9 text-xs rounded-xl" />
          </div>

          <DialogFooter class="pt-2 flex flex-col-reverse sm:flex-row gap-2">
            <Button type="button" variant="outline" class="w-full sm:w-auto h-9 text-xs rounded-xl cursor-pointer" @click="showCancelModal = false">Keep Booking</Button>
            <Button class="w-full sm:w-auto bg-rose-600 hover:bg-rose-700 text-white font-bold h-9 text-xs rounded-xl cursor-pointer" @click="confirmCancelBooking" :disabled="actionLoading">
              Cancel Booking
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>

    <!-- ALERT DIALOG: REMOVE ROOM CONFIRMATION -->
    <AlertDialog :open="deleteRoomConfirm.isOpen" @update:open="deleteRoomConfirm.isOpen = $event">
      <AlertDialogContent class="max-w-[94vw] sm:max-w-lg p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-border">
        <AlertDialogHeader>
          <AlertDialogTitle class="flex items-center gap-2 text-base font-bold text-destructive">
            <Trash2 class="h-5 w-5 shrink-0" />
            Remove Room {{ deleteRoomConfirm.target?.roomNumber }}?
          </AlertDialogTitle>
          <AlertDialogDescription class="text-xs text-muted-foreground leading-relaxed pt-1.5 space-y-2">
            <p>
              Are you sure you want to remove <strong>Room {{ deleteRoomConfirm.target?.roomNumber }}</strong>?
            </p>
            <div class="p-3 rounded-2xl bg-muted/40 border border-border/60 text-[11px] space-y-1.5">
              <p class="font-medium text-foreground">Removal Policy &amp; Safety Safeguards:</p>
              <p>• If this room has zero bookings, it will be deleted permanently from your property.</p>
              <p>• If this room has past bookings or invoices, it will be safely deactivated and removed from active booking inventory so historical financial records and invoices remain 100% preserved.</p>
              <p class="text-rose-600 dark:text-rose-400 font-semibold">• If currently occupied or reserved by an active guest, removal is automatically blocked until checkout.</p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter class="pt-3 flex flex-col-reverse sm:flex-row gap-2">
          <AlertDialogCancel class="w-full sm:w-auto h-9 text-xs rounded-xl cursor-pointer">Cancel</AlertDialogCancel>
          <AlertDialogAction
            @click="confirmDeleteRoom"
            class="w-full sm:w-auto bg-destructive text-destructive-foreground hover:bg-destructive/90 text-xs h-9 rounded-xl font-bold cursor-pointer"
            :disabled="actionLoading"
          >
            {{ actionLoading ? 'Removing...' : 'Yes, Remove Room' }}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </RoleLayout>
</template>
