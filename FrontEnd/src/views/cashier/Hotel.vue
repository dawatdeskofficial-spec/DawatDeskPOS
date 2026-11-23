<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import {
  BedDouble, Plus, Search, Filter, RefreshCw, Calendar, Clock,
  User, Phone, Mail, DollarSign, CheckCircle2, AlertCircle, X,
  FileText, ArrowRight, Eye, ShieldAlert, Sparkles, Building2,
  Trash2, Edit3, Power, Download, Layers, CheckCheck, TrendingUp,
  Percent, ChevronRight, Ban, CreditCard, Banknote, Smartphone,
  Utensils, UserPlus, Tag, Save, Check
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
import { cashierNav } from '@/lib/nav'
import { useAuthStore } from '@/stores/auth'
import {
  getHotelRooms, getHotelRoomTypes, createHotelBooking,
  checkInHotelGuest, extendHotelStay, addHotelCharge,
  checkoutHotelGuest, updateRoomHousekeeping, getHotelInvoices,
  getHotelInvoicePdfUrl, checkHotelAvailability, cancelHotelBooking
} from '@/lib/api'

const auth = useAuthStore()
const router = useRouter()

const restaurantId = computed(() => auth.effectiveRestaurantId || '')

// Active tab
const activeTab = ref<'grid' | 'history'>('grid')

// Loading states
const loading = ref(true)
const actionLoading = ref(false)

// Rooms data
const rooms = ref<any[]>([])
const roomTypes = ref<any[]>([])
const searchFilter = ref('')
const statusFilter = ref<string>('ALL')
const categoryFilter = ref<string>('ALL')

// Availability date-picker filter
const filterCheckIn = ref('')
const filterCheckOut = ref('')
const dateFilteredRoomIds = ref<Set<string> | null>(null)

// History data
const invoicesList = ref<any[]>([])
const invoiceSearch = ref('')

// ── MODALS STATE ─────────────────────────────────────────────────────────────
// 1. New Booking / Walk-in Modal
const showBookingModal = ref(false)
const selectedRoomForBooking = ref<any>(null)
const bookingForm = ref({
  guestName: '',
  guestPhone: '',
  guestEmail: '',
  guestAddress: '',
  idType: 'Aadhaar',
  idNumber: '',
  checkInDate: new Date().toISOString().slice(0, 10),
  checkOutDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
  adults: 1,
  children: 0,
  extraGuests: 0,
  agreedTariff: 1500,
  discount: 0,
  advancePayment: 0,
  paymentMethod: 'CASH' as 'CASH' | 'CARD' | 'DIGITAL_WALLET' | 'UPI',
  bookingNotes: '',
  specialRequests: '',
  isWalkIn: true,
})

// 2. Active Stay & Checkout Modal
const showActiveStayModal = ref(false)
const activeStayRoom = ref<any>(null)
const activeBooking = ref<any>(null)

// Extension form state
const showExtendInput = ref(false)
const extendCheckOutDate = ref('')

// Add charge form state
const showAddChargeInput = ref(false)
const newChargeTitle = ref('')
const newChargeAmount = ref<number | ''>('')

// Checkout settlement state
const showCheckoutDialog = ref(false)
const checkoutDiscount = ref<number>(0)
const checkoutPaymentMethod = ref<'CASH' | 'CARD' | 'DIGITAL_WALLET' | 'UPI'>('CASH')
const checkoutNotes = ref('')
const cashGiven = ref<string>('')

// Completed invoice success preview
const lastCompletedInvoice = ref<any>(null)
const showInvoiceSuccessModal = ref(false)

// 3. Pre-Booking / Reservation Details Modal
const showReservationDetailsModal = ref(false)
const selectedReservation = ref<any>(null)
const selectedReservationRoom = ref<any>(null)

function openReservationDetailsModal(reservation: any, room: any) {
  selectedReservation.value = reservation
  selectedReservationRoom.value = room
  showReservationDetailsModal.value = true
}

const isSelectedReservationToday = computed(() => {
  if (!selectedReservation.value?.checkInDate) return false
  const inDate = new Date(selectedReservation.value.checkInDate).toDateString()
  const today = new Date().toDateString()
  return inDate === today || new Date(selectedReservation.value.checkInDate) <= new Date()
})

async function handleCheckInFromReservation() {
  if (!selectedReservation.value) return
  const id = selectedReservation.value._id || selectedReservation.value.id || selectedReservation.value.bookingId
  actionLoading.value = true
  try {
    await checkInHotelGuest(id, {}, restaurantId.value)
    toast.success(`Guest checked in to Room ${selectedReservationRoom.value?.roomNumber}!`)
    showReservationDetailsModal.value = false
    await loadRooms()
  } catch (err: any) {
    toast.error(err.message || 'Check-in failed')
  } finally {
    actionLoading.value = false
  }
}

async function handleCancelReservation() {
  if (!selectedReservation.value) return
  const guestName = selectedReservation.value.guest?.name || 'this guest'
  const confirmed = window.confirm(`Are you sure you want to cancel the reservation for ${guestName}?`)
  if (!confirmed) return

  const reason = window.prompt('Cancellation reason (optional):', 'Cancelled by guest request') || 'Cancelled by guest request'
  const id = selectedReservation.value._id || selectedReservation.value.id || selectedReservation.value.bookingId
  actionLoading.value = true
  try {
    await cancelHotelBooking(id, reason, restaurantId.value)
    toast.success('Reservation cancelled successfully')
    showReservationDetailsModal.value = false
    await loadRooms()
  } catch (err: any) {
    toast.error(err.message || 'Failed to cancel reservation')
  } finally {
    actionLoading.value = false
  }
}

// ── DATA FETCHING ─────────────────────────────────────────────────────────────

async function loadRooms() {
  if (!restaurantId.value) return
  loading.value = true
  try {
    const [roomsRes, typesRes] = await Promise.all([
      getHotelRooms({}, restaurantId.value),
      getHotelRoomTypes(restaurantId.value),
    ])
    rooms.value = roomsRes.data || []
    roomTypes.value = typesRes.data || []
  } catch (err: any) {
    toast.error(err.message || 'Failed to load hotel rooms')
  } finally {
    loading.value = false
  }
}

async function loadInvoices() {
  if (!restaurantId.value) return
  try {
    const res = await getHotelInvoices({ search: invoiceSearch.value }, restaurantId.value)
    invoicesList.value = res.data || []
  } catch (err: any) {
    console.error(err)
  }
}

async function runAvailabilityCheck() {
  if (!filterCheckIn.value || !filterCheckOut.value) {
    dateFilteredRoomIds.value = null
    return
  }
  try {
    const res = await checkHotelAvailability({
      checkInDate: filterCheckIn.value,
      checkOutDate: filterCheckOut.value,
      restaurantId: restaurantId.value,
    })
    const availList: any[] = res.data || []
    dateFilteredRoomIds.value = new Set(availList.map((r: any) => r._id || r.id))
    toast.info(`${availList.length} room(s) available for selected dates`)
  } catch (err: any) {
    toast.error(err.message || 'Availability check failed')
  }
}

function clearDateFilter() {
  filterCheckIn.value = ''
  filterCheckOut.value = ''
  dateFilteredRoomIds.value = null
}

onMounted(() => {
  loadRooms()
})

// ── FILTERED ROOMS & COUNTS ───────────────────────────────────────────────────

const reservedRoomsCount = computed(() => {
  return rooms.value.filter((r) => r.status === 'RESERVED' || Boolean(r.upcomingReservation)).length
})

const filteredRooms = computed(() => {
  return rooms.value.filter((r) => {
    if (statusFilter.value === 'RESERVED') {
      if (r.status !== 'RESERVED' && !r.upcomingReservation) return false
    } else if (statusFilter.value !== 'ALL' && r.status !== statusFilter.value) {
      return false
    }
    if (dateFilteredRoomIds.value && !dateFilteredRoomIds.value.has(r._id || r.id)) return false

    if (searchFilter.value.trim()) {
      const q = searchFilter.value.toLowerCase().trim()
      const matchNum = (r.roomNumber || '').toLowerCase().includes(q)
      const matchGuest = (r.activeBooking?.guest?.name || '').toLowerCase().includes(q)
      const matchPhone = (r.activeBooking?.guest?.phone || '').toLowerCase().includes(q)
      const matchUpcomingGuest = (r.upcomingReservation?.guest?.name || '').toLowerCase().includes(q)
      const matchUpcomingPhone = (r.upcomingReservation?.guest?.phone || '').toLowerCase().includes(q)
      const matchUpcomingRef = (r.upcomingReservation?.bookingReference || '').toLowerCase().includes(q)
      return matchNum || matchGuest || matchPhone || matchUpcomingGuest || matchUpcomingPhone || matchUpcomingRef
    }
    return true
  })
})

// ── ROOM CARD CLICK DISPATCHER ────────────────────────────────────────────────

function handleRoomClick(room: any) {
  if (statusFilter.value === 'RESERVED') {
    const res = room.status === 'RESERVED' ? room.activeBooking : room.upcomingReservation
    if (res) {
      openReservationDetailsModal(res, room)
      return
    }
  }

  if (room.status === 'AVAILABLE') {
    openBookingModal(room)
  } else if (room.status === 'OCCUPIED') {
    openActiveStayModal(room)
  } else if (room.status === 'RESERVED') {
    if (room.activeBooking) {
      openReservationDetailsModal(room.activeBooking, room)
    } else if (room.upcomingReservation) {
      openReservationDetailsModal(room.upcomingReservation, room)
    } else {
      openBookingModal(room)
    }
  } else if (room.status === 'CLEANING') {
    markRoomCleaned(room)
  } else if (room.status === 'MAINTENANCE') {
    toast.info(`Room ${room.roomNumber} is under maintenance: ${room.maintenanceReason || 'Repairs in progress'}`)
  }
}

// ── WORKFLOW: NEW BOOKING / WALK-IN ──────────────────────────────────────────

const isCustomRoomSelection = ref(false)

const todayStr = computed(() => {
  return new Date().toISOString().slice(0, 10)
})

const isCheckInToday = computed(() => {
  if (!bookingForm.value.checkInDate) return false
  return bookingForm.value.checkInDate === todayStr.value
})

function onCheckInDateChange() {
  if (!isCheckInToday.value) {
    bookingForm.value.isWalkIn = false
  } else {
    bookingForm.value.isWalkIn = true
  }
}

function onRoomSelectChange(event: any) {
  const roomId = event.target.value
  const found = rooms.value.find((r: any) => (r._id || r.id) === roomId)
  if (found) {
    selectedRoomForBooking.value = found
    bookingForm.value.agreedTariff = found.baseTariff || 1500
  }
}

// Live date collision validation for the selected room
const dateConflict = computed(() => {
  if (!selectedRoomForBooking.value || !bookingForm.value.checkInDate || !bookingForm.value.checkOutDate) {
    return null
  }
  const start = new Date(bookingForm.value.checkInDate).getTime()
  const end = new Date(bookingForm.value.checkOutDate).getTime()

  if (end <= start) {
    return {
      type: 'INVALID_RANGE',
      message: 'Checkout date must be strictly after check-in date.',
      advice: 'Please select a checkout date that is at least 1 day after check-in.',
    }
  }

  const bookedRanges = selectedRoomForBooking.value.bookedRanges || []
  for (const range of bookedRanges) {
    const rStart = new Date(range.checkInDate).getTime()
    const rEnd = new Date(range.checkOutDate).getTime()

    // Overlap condition: start < rEnd && end > rStart
    if (start < rEnd && end > rStart) {
      const inStr = new Date(range.checkInDate).toLocaleDateString()
      const outStr = new Date(range.checkOutDate).toLocaleDateString()
      const guestName = range.guestName || 'another guest'

      let advice = ''
      if (start < rStart) {
        advice = `For check-in on ${new Date(bookingForm.value.checkInDate).toLocaleDateString()}, checkout must be on or before ${inStr}.`
      } else {
        advice = `Room is occupied/reserved until ${outStr}. Check-in must be on or after ${outStr}.`
      }

      return {
        type: 'COLLISION',
        message: `Date Conflict: Room ${selectedRoomForBooking.value.roomNumber} is already booked from ${inStr} to ${outStr} (${guestName}).`,
        advice,
        conflictingRange: range,
      }
    }
  }

  return null
})

function openNewReservationModal() {
  isCustomRoomSelection.value = true
  const availableRoom = rooms.value.find((r: any) => r.status === 'AVAILABLE') || rooms.value[0] || null
  openBookingModal(availableRoom)
}

function bookFutureFromActiveStay() {
  const room = activeStayRoom.value
  const curBooking = activeBooking.value
  showActiveStayModal.value = false
  isCustomRoomSelection.value = false

  // Set check-in to current guest's checkout date
  const nextIn = curBooking?.checkOutDate
    ? new Date(curBooking.checkOutDate).toISOString().slice(0, 10)
    : new Date(Date.now() + 86400000).toISOString().slice(0, 10)
  const nextOut = new Date(new Date(nextIn).getTime() + 86400000).toISOString().slice(0, 10)

  selectedRoomForBooking.value = room
  bookingForm.value = {
    guestName: '',
    guestPhone: '',
    guestEmail: '',
    guestAddress: '',
    idType: 'Aadhaar',
    idNumber: '',
    checkInDate: nextIn,
    checkOutDate: nextOut,
    adults: 1,
    children: 0,
    extraGuests: 0,
    agreedTariff: room?.baseTariff || 1500,
    discount: 0,
    advancePayment: 0,
    paymentMethod: 'CASH',
    bookingNotes: '',
    specialRequests: '',
    isWalkIn: false,
  }
  showBookingModal.value = true
}

function openBookingModal(room: any) {
  selectedRoomForBooking.value = room || rooms.value[0] || null
  const today = new Date().toISOString().slice(0, 10)
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10)

  bookingForm.value = {
    guestName: '',
    guestPhone: '',
    guestEmail: '',
    guestAddress: '',
    idType: 'Aadhaar',
    idNumber: '',
    checkInDate: today,
    checkOutDate: tomorrow,
    adults: 1,
    children: 0,
    extraGuests: 0,
    agreedTariff: selectedRoomForBooking.value?.baseTariff || 1500,
    discount: 0,
    advancePayment: 0,
    paymentMethod: 'CASH',
    bookingNotes: '',
    specialRequests: '',
    isWalkIn: true,
  }
  showBookingModal.value = true
}

const computedNights = computed(() => {
  const inD = new Date(bookingForm.value.checkInDate)
  const outD = new Date(bookingForm.value.checkOutDate)
  const diff = outD.getTime() - inD.getTime()
  return Math.max(1, Math.ceil(diff / (1000 * 60 * 60 * 24)))
})

const computedEstimatedTotal = computed(() => {
  const nights = computedNights.value
  const roomCost = (Number(bookingForm.value.agreedTariff) || 0) * nights
  const extraPersonCost = (Number(bookingForm.value.extraGuests) || 0) * (selectedRoomForBooking.value?.extraPersonCharge || 0) * nights
  const subtotal = roomCost + extraPersonCost
  const tax = (subtotal * 5) / 100 // default 5% GST
  const disc = Number(bookingForm.value.discount) || 0
  return Math.max(0, Math.round((subtotal + tax - disc) * 100) / 100)
})

async function submitBooking() {
  if (!bookingForm.value.guestName.trim() || !bookingForm.value.guestPhone.trim()) {
    toast.error('Guest name and phone number are required')
    return
  }

  if (dateConflict.value) {
    toast.error(dateConflict.value.message)
    return
  }

  actionLoading.value = true
  try {
    const payload = {
      roomId: selectedRoomForBooking.value._id || selectedRoomForBooking.value.id,
      guest: {
        name: bookingForm.value.guestName.trim(),
        phone: bookingForm.value.guestPhone.trim(),
        email: bookingForm.value.guestEmail.trim(),
        address: bookingForm.value.guestAddress.trim(),
        idType: bookingForm.value.idType,
        idNumber: bookingForm.value.idNumber.trim(),
      },
      checkInDate: bookingForm.value.checkInDate,
      checkOutDate: bookingForm.value.checkOutDate,
      adults: Number(bookingForm.value.adults),
      children: Number(bookingForm.value.children),
      extraGuests: Number(bookingForm.value.extraGuests),
      agreedTariff: Number(bookingForm.value.agreedTariff),
      discount: Number(bookingForm.value.discount) || 0,
      advancePayment: Number(bookingForm.value.advancePayment) || 0,
      paymentMethod: bookingForm.value.paymentMethod,
      bookingNotes: bookingForm.value.bookingNotes,
      specialRequests: bookingForm.value.specialRequests,
      isWalkIn: isCheckInToday.value && bookingForm.value.isWalkIn,
    }

    const res = await createHotelBooking(payload, restaurantId.value)
    toast.success(
      payload.isWalkIn
        ? `Guest checked in to Room ${selectedRoomForBooking.value.roomNumber}! Ref: ${res.data.bookingReference}`
        : `Reservation confirmed for Room ${selectedRoomForBooking.value.roomNumber}! Ref: ${res.data.bookingReference}`
    )
    showBookingModal.value = false
    await loadRooms()
  } catch (err: any) {
    toast.error(err.message || 'Failed to create booking')
  } finally {
    actionLoading.value = false
  }
}

// ── WORKFLOW: ACTIVE STAY MANAGEMENT ──────────────────────────────────────────

function openActiveStayModal(room: any) {
  activeStayRoom.value = room
  activeBooking.value = room.activeBooking
  showExtendInput.value = false
  showAddChargeInput.value = false
  extendCheckOutDate.value = ''
  newChargeTitle.value = ''
  newChargeAmount.value = ''
  showActiveStayModal.value = true
}

async function handleCheckInReserved() {
  if (!activeBooking.value) return
  actionLoading.value = true
  try {
    await checkInHotelGuest(activeBooking.value._id || activeBooking.value.id, {}, restaurantId.value)
    toast.success(`Guest checked in to Room ${activeStayRoom.value.roomNumber}`)
    showActiveStayModal.value = false
    await loadRooms()
  } catch (err: any) {
    toast.error(err.message || 'Check-in failed')
  } finally {
    actionLoading.value = false
  }
}

async function submitExtension() {
  if (!extendCheckOutDate.value) {
    toast.error('Please select a valid new checkout date')
    return
  }
  actionLoading.value = true
  try {
    await extendHotelStay(
      activeBooking.value._id || activeBooking.value.id,
      { newCheckOutDate: extendCheckOutDate.value },
      restaurantId.value
    )
    toast.success('Stay extended successfully!')
    showExtendInput.value = false
    showActiveStayModal.value = false
    await loadRooms()
  } catch (err: any) {
    toast.error(err.message || 'Failed to extend stay')
  } finally {
    actionLoading.value = false
  }
}

async function submitAddCharge() {
  if (!newChargeTitle.value.trim() || !newChargeAmount.value || Number(newChargeAmount.value) <= 0) {
    toast.error('Enter a valid charge title and positive amount')
    return
  }
  actionLoading.value = true
  try {
    await addHotelCharge(
      activeBooking.value._id || activeBooking.value.id,
      { title: newChargeTitle.value.trim(), amount: Number(newChargeAmount.value) },
      restaurantId.value
    )
    toast.success(`Charge added: ${newChargeTitle.value} (₹${newChargeAmount.value})`)
    showAddChargeInput.value = false
    showActiveStayModal.value = false
    await loadRooms()
  } catch (err: any) {
    toast.error(err.message || 'Failed to add charge')
  } finally {
    actionLoading.value = false
  }
}

// ── WORKFLOW: CHECKOUT & SETTLEMENT ──────────────────────────────────────────

function initiateCheckout() {
  showActiveStayModal.value = false
  checkoutDiscount.value = Number(activeBooking.value?.discount || 0)
  checkoutPaymentMethod.value = 'CASH'
  checkoutNotes.value = ''
  cashGiven.value = ''
  showCheckoutDialog.value = true
}

const computedSettlementBalance = computed(() => {
  if (!activeBooking.value) return 0
  const roomCost = Number(activeBooking.value.roomTariffPerNight || 0) * Number(activeBooking.value.totalNights || 1)
  const addCharges = (activeBooking.value.additionalCharges || []).reduce((s: number, c: any) => s + Number(c.amount || 0), 0)
  const subtotal = roomCost + addCharges
  const taxPct = Number(activeBooking.value.taxPercentage || 5)
  const tax = (subtotal * taxPct) / 100
  const gross = subtotal + tax
  const disc = Number(checkoutDiscount.value || 0)
  const totalAfterDiscount = Math.max(0, gross - disc)
  const paid = Number(activeBooking.value.paidAmount || 0)
  return Math.max(0, Math.round((totalAfterDiscount - paid) * 100) / 100)
})

const changeDue = computed(() => {
  if (checkoutPaymentMethod.value !== 'CASH') return 0
  const given = parseFloat(cashGiven.value) || 0
  const bal = computedSettlementBalance.value
  return Math.max(0, Math.round((given - bal) * 100) / 100)
})

async function processFinalCheckout() {
  actionLoading.value = true
  try {
    const res = await checkoutHotelGuest(
      activeBooking.value._id || activeBooking.value.id,
      {
        paymentMethod: checkoutPaymentMethod.value,
        discount: Number(checkoutDiscount.value) || 0,
        notes: checkoutNotes.value,
      },
      restaurantId.value
    )
    lastCompletedInvoice.value = res.data.invoice
    toast.success(`Checkout complete for Room ${activeStayRoom.value.roomNumber}!`)
    showCheckoutDialog.value = false
    showInvoiceSuccessModal.value = true
    await loadRooms()
  } catch (err: any) {
    toast.error(err.message || 'Checkout failed')
  } finally {
    actionLoading.value = false
  }
}

async function markRoomCleaned(room: any) {
  try {
    await updateRoomHousekeeping(room._id || room.id, 'AVAILABLE', '', restaurantId.value)
    toast.success(`Room ${room.roomNumber} is now marked Cleaned & Available!`)
    await loadRooms()
  } catch (err: any) {
    toast.error(err.message || 'Failed to update housekeeping')
  }
}

// Visual status styling
const roomCardStyles: Record<string, { bg: string; border: string; badge: string; label: string }> = {
  AVAILABLE: {
    bg: 'bg-emerald-500/5 hover:bg-emerald-500/10',
    border: 'border-emerald-500/30 hover:border-emerald-500',
    badge: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
    label: 'Available',
  },
  RESERVED: {
    bg: 'bg-blue-500/5 hover:bg-blue-500/10',
    border: 'border-blue-500/30 hover:border-blue-500',
    badge: 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30',
    label: 'Reserved',
  },
  OCCUPIED: {
    bg: 'bg-rose-500/5 hover:bg-rose-500/10',
    border: 'border-rose-500/30 hover:border-rose-500',
    badge: 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30',
    label: 'Occupied',
  },
  CLEANING: {
    bg: 'bg-amber-500/5 hover:bg-amber-500/10',
    border: 'border-amber-500/30 hover:border-amber-500',
    badge: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30',
    label: 'Cleaning',
  },
  MAINTENANCE: {
    bg: 'bg-slate-500/5 hover:bg-slate-500/10',
    border: 'border-slate-500/30 hover:border-slate-500',
    badge: 'bg-slate-500/15 text-slate-600 dark:text-slate-400 border-slate-500/30',
    label: 'Maintenance',
  },
}

function getCardStyle(status: string) {
  return roomCardStyles[status] || roomCardStyles.AVAILABLE
}
</script>

<template>
  <RoleLayout role="cashier" :nav="cashierNav" brand="DawatDesk Cashier">
    <div class="space-y-4 max-w-7xl mx-auto">
      <!-- Top Header -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 sm:mb-6">
        <div>
          <h1 class="font-display text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight text-foreground">Hotel Room POS & Stays</h1>
          <p class="text-xs text-muted-foreground mt-0.5 hidden sm:block">Interactive visual room grid, guest check-in, active stays, and hotel billing counter.</p>
        </div>

        <div class="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          <Button variant="outline" size="sm" class="h-9 px-2.5 sm:px-3 gap-1.5 text-xs rounded-xl cursor-pointer" @click="loadRooms">
            <RefreshCw :class="['h-3.5 w-3.5', loading ? 'animate-spin' : '']" />
            <span class="hidden sm:inline">Refresh</span>
          </Button>

          <Button
            size="sm"
            class="gradient-primary text-primary-foreground font-bold h-9 px-3 sm:px-3.5 rounded-xl text-xs gap-1.5 shadow-xs cursor-pointer"
            @click="openNewReservationModal"
          >
            <Plus class="h-4 w-4" /> <span class="hidden sm:inline">New</span> Reservation
          </Button>

          <div class="flex items-center bg-muted/60 p-0.5 sm:p-1 rounded-xl border border-border text-xs font-semibold">
            <button
              @click="activeTab = 'grid'"
              :class="['px-2.5 sm:px-3 py-1 rounded-lg transition cursor-pointer', activeTab === 'grid' ? 'bg-card text-foreground font-bold shadow-2xs' : 'text-muted-foreground hover:text-foreground']"
            >
              Rooms
            </button>
            <button
              @click="() => { activeTab = 'history'; loadInvoices(); }"
              :class="['px-2.5 sm:px-3 py-1 rounded-lg transition cursor-pointer', activeTab === 'history' ? 'bg-card text-foreground font-bold shadow-2xs' : 'text-muted-foreground hover:text-foreground']"
            >
              Invoices
            </button>
          </div>
        </div>
      </div>

      <!-- TAB 1: VISUAL ROOM GRID -->
      <div v-if="activeTab === 'grid'" class="space-y-3 sm:space-y-4">
        <!-- Control Bar: Search & Status Filters -->
        <div class="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 p-2.5 sm:p-3.5 rounded-2xl bg-card border border-border shadow-xs">
          <div class="relative flex-1 sm:max-w-xs">
            <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input v-model="searchFilter" placeholder="Search room #, guest..." class="pl-8.5 pr-8 h-9 text-xs rounded-xl" />
          </div>

          <!-- Color Status Filter Pills (Scrollable on mobile, wrap on desktop) -->
          <div class="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5 -mx-1 px-1 sm:flex-wrap text-xs font-semibold">
            <button
              @click="statusFilter = 'ALL'"
              :class="['px-2.5 py-1 rounded-lg transition cursor-pointer whitespace-nowrap shrink-0', statusFilter === 'ALL' ? 'bg-primary text-primary-foreground font-bold' : 'bg-muted/50 text-muted-foreground']"
            >
              All ({{ rooms.length }})
            </button>
            <button
              @click="statusFilter = 'AVAILABLE'"
              :class="['px-2.5 py-1 rounded-lg transition cursor-pointer flex items-center gap-1 whitespace-nowrap shrink-0', statusFilter === 'AVAILABLE' ? 'bg-emerald-600 text-white font-bold' : 'bg-emerald-500/10 text-emerald-600']"
            >
              <span class="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Avail ({{ rooms.filter(r => r.status === 'AVAILABLE').length }})
            </button>
            <button
              @click="statusFilter = 'OCCUPIED'"
              :class="['px-2.5 py-1 rounded-lg transition cursor-pointer flex items-center gap-1 whitespace-nowrap shrink-0', statusFilter === 'OCCUPIED' ? 'bg-rose-600 text-white font-bold' : 'bg-rose-500/10 text-rose-600']"
            >
              <span class="h-1.5 w-1.5 rounded-full bg-rose-500" /> Occupied ({{ rooms.filter(r => r.status === 'OCCUPIED').length }})
            </button>
            <button
              @click="statusFilter = 'RESERVED'"
              :class="['px-2.5 py-1 rounded-lg transition cursor-pointer flex items-center gap-1 whitespace-nowrap shrink-0', statusFilter === 'RESERVED' ? 'bg-blue-600 text-white font-bold' : 'bg-blue-500/10 text-blue-600']"
            >
              <span class="h-1.5 w-1.5 rounded-full bg-blue-500" /> Reserved ({{ reservedRoomsCount }})
            </button>
            <button
              @click="statusFilter = 'CLEANING'"
              :class="['px-2.5 py-1 rounded-lg transition cursor-pointer flex items-center gap-1 whitespace-nowrap shrink-0', statusFilter === 'CLEANING' ? 'bg-amber-600 text-white font-bold' : 'bg-amber-500/10 text-amber-600']"
            >
              <span class="h-1.5 w-1.5 rounded-full bg-amber-500" /> Cleaning ({{ rooms.filter(r => r.status === 'CLEANING').length }})
            </button>
          </div>
        </div>

        <!-- Room Cards Interactive Visual Grid -->
        <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-2.5 sm:gap-3.5">
          <div
            v-for="room in filteredRooms"
            :key="room._id || room.id"
            @click="handleRoomClick(room)"
            :class="[
              'rounded-2xl border p-3 sm:p-4 transition-all duration-200 cursor-pointer flex flex-col justify-between shadow-2xs relative group select-none min-h-[135px] sm:min-h-[160px]',
              getCardStyle(room.status).bg,
              getCardStyle(room.status).border
            ]"
          >
            <!-- Card Header -->
            <div>
              <div class="flex items-start justify-between gap-1">
                <span class="font-display font-black text-base sm:text-xl text-foreground group-hover:scale-105 transition-transform truncate">
                  Room {{ room.roomNumber }}
                </span>
                <Badge
                  v-if="statusFilter === 'RESERVED' && (room.upcomingReservation || (room.status === 'RESERVED' && room.activeBooking))"
                  class="bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/25 text-[9px] sm:text-[10px] font-bold px-1.5 py-0.5 rounded-md shrink-0"
                >
                  {{ room.status === 'RESERVED' ? 'Today' : 'Pre-Booked' }}
                </Badge>
                <Badge v-else :class="[getCardStyle(room.status).badge, 'text-[9px] sm:text-[10px] font-bold px-1.5 py-0.5 rounded-md shrink-0']">
                  {{ getCardStyle(room.status).label }}
                </Badge>
              </div>
              <p v-if="room.description" class="text-[10px] sm:text-[11px] font-medium text-muted-foreground truncate mt-0.5">
                {{ room.description }}
              </p>
            </div>

            <!-- Card Center: Context info -->
            <div class="my-1 sm:my-1.5 text-xs">
              <!-- When filtering by RESERVED: Show rich pre-booking details -->
              <div v-if="statusFilter === 'RESERVED' && (room.upcomingReservation || (room.status === 'RESERVED' && room.activeBooking))" class="space-y-1 sm:space-y-1.5">
                <div class="p-2 sm:p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs space-y-1">
                  <div class="flex items-center justify-between gap-1">
                    <span class="font-bold text-blue-700 dark:text-blue-300 truncate text-[11px] flex items-center gap-1">
                      <User class="h-3 w-3 shrink-0 text-blue-600" />
                      {{ (room.status === 'RESERVED' ? room.activeBooking : room.upcomingReservation)?.guest?.name || 'Pre-Booked' }}
                    </span>
                    <span class="text-[9px] font-mono text-blue-600 font-bold shrink-0">
                      {{ (room.status === 'RESERVED' ? room.activeBooking : room.upcomingReservation)?.bookingReference?.slice(-6) }}
                    </span>
                  </div>
                  <div class="text-[10px] sm:text-[11px] text-foreground font-bold flex items-center gap-1 pt-0.5">
                    <Calendar class="h-3 w-3 shrink-0 text-blue-600" />
                    <span class="truncate">{{ new Date((room.status === 'RESERVED' ? room.activeBooking : room.upcomingReservation).checkInDate).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) }} ➔ {{ new Date((room.status === 'RESERVED' ? room.activeBooking : room.upcomingReservation).checkOutDate).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) }}</span>
                  </div>
                  <div class="flex items-center justify-between text-[9px] sm:text-[10px] text-muted-foreground pt-1 border-t border-blue-500/20">
                    <span>{{ (room.status === 'RESERVED' ? room.activeBooking : room.upcomingReservation).totalNights || 1 }}N @ ₹{{ (room.status === 'RESERVED' ? room.activeBooking : room.upcomingReservation).roomTariffPerNight || room.baseTariff }}</span>
                    <span v-if="(room.status === 'RESERVED' ? room.activeBooking : room.upcomingReservation).advancePayment > 0" class="text-emerald-600 font-bold">
                      Adv: ₹{{ (room.status === 'RESERVED' ? room.activeBooking : room.upcomingReservation).advancePayment }}
                    </span>
                    <span v-else class="text-amber-600 font-bold">Unpaid</span>
                  </div>
                </div>
              </div>

              <!-- Available state (when NOT filtering by RESERVED) -->
              <div v-else-if="room.status === 'AVAILABLE'" class="space-y-1">
                <div class="font-bold text-foreground text-xs sm:text-sm">₹{{ room.baseTariff }} <span class="text-[9px] sm:text-[10px] text-muted-foreground font-normal">/ night</span></div>
                <div v-if="room.upcomingReservation" class="p-1.5 sm:p-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs space-y-1">
                  <div class="flex items-center justify-between gap-1 text-[10px] sm:text-[11px]">
                    <span class="font-bold text-blue-700 dark:text-blue-300 flex items-center gap-1 truncate">
                      <Calendar class="h-3 w-3 shrink-0 text-blue-600" />
                      From {{ new Date(room.upcomingReservation.checkInDate).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) }}
                    </span>
                    <button
                      @click.stop="openReservationDetailsModal(room.upcomingReservation, room)"
                      class="text-[9px] sm:text-[10px] font-bold text-primary hover:underline cursor-pointer shrink-0 px-1.5 py-0.5 rounded bg-primary/10 hover:bg-primary/20 transition"
                    >
                      Details
                    </button>
                  </div>
                  <div class="text-[9px] sm:text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                    <CheckCircle2 class="h-2.5 w-2.5 shrink-0" /> Free today
                  </div>
                </div>
                <div v-else class="text-[9px] sm:text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                  <CheckCircle2 class="h-3 w-3 shrink-0" /> Available • Tap to Book
                </div>
              </div>

              <!-- Occupied state -->
              <div v-else-if="room.status === 'OCCUPIED' && room.activeBooking" class="space-y-0.5">
                <div class="font-bold text-rose-600 dark:text-rose-400 truncate flex items-center gap-1 text-xs">
                  <User class="h-3 w-3 shrink-0" /> {{ room.activeBooking.guest?.name }}
                </div>
                <div class="text-[10px] text-muted-foreground">
                  Out: {{ new Date(room.activeBooking.checkOutDate).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) }}
                </div>
              </div>

              <!-- Reserved state -->
              <div v-else-if="room.status === 'RESERVED' && room.activeBooking" class="space-y-0.5">
                <div class="font-bold text-blue-600 dark:text-blue-400 truncate text-xs">
                  {{ room.activeBooking.guest?.name }}
                </div>
                <div class="text-[10px] text-blue-600 font-semibold">
                  In: {{ new Date(room.activeBooking.checkInDate).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) }}
                </div>
              </div>

              <!-- Cleaning state -->
              <div v-else-if="room.status === 'CLEANING'" class="space-y-0.5 text-amber-600 dark:text-amber-400">
                <div class="font-bold text-[11px] flex items-center gap-1">
                  <RefreshCw class="h-3 w-3 animate-spin" /> Housekeeping
                </div>
                <div class="text-[10px] underline font-semibold">Click to Mark Ready</div>
              </div>

              <!-- Maintenance state -->
              <div v-else-if="room.status === 'MAINTENANCE'" class="text-[11px] text-slate-600 dark:text-slate-400">
                <div class="font-bold flex items-center gap-1"><ShieldAlert class="h-3 w-3" /> Under Repair</div>
                <div class="text-[10px] truncate">{{ room.maintenanceReason || 'Blocked' }}</div>
              </div>
            </div>

            <!-- Card Bottom Footer / Quick Cue -->
            <div class="pt-1.5 border-t border-border/40 flex items-center justify-between text-[10px] text-muted-foreground">
              <span v-if="room.floor" class="truncate max-w-[60px]">Floor {{ room.floor }}</span>
              <span v-else></span>
              <button
                v-if="statusFilter === 'RESERVED' && (room.status === 'RESERVED' ? room.activeBooking : room.upcomingReservation)"
                @click.stop="openReservationDetailsModal((room.status === 'RESERVED' ? room.activeBooking : room.upcomingReservation), room)"
                class="font-bold text-primary hover:underline flex items-center gap-0.5 cursor-pointer ml-auto"
              >
                Details <ChevronRight class="h-2.5 w-2.5" />
              </button>
              <span v-else class="font-bold text-primary group-hover:underline transition flex items-center gap-0.5 ml-auto">
                {{ room.status === 'AVAILABLE' ? 'Book' : 'Manage' }} <ChevronRight class="h-2.5 w-2.5" />
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- TAB 2: INVOICES HISTORY -->
      <div v-else-if="activeTab === 'history'" class="space-y-3 sm:space-y-4">
        <!-- Desktop Table View -->
        <div class="hidden sm:block rounded-2xl border border-border bg-card overflow-hidden shadow-xs">
          <div class="overflow-x-auto">
            <table class="w-full text-xs text-left">
              <thead class="bg-muted/40 border-b border-border text-muted-foreground font-semibold">
                <tr>
                  <th class="p-3.5">Invoice #</th>
                  <th class="p-3.5">Guest Name</th>
                  <th class="p-3.5">Room</th>
                  <th class="p-3.5">Stay Dates</th>
                  <th class="p-3.5">Total Amount</th>
                  <th class="p-3.5">Payment Status</th>
                  <th class="p-3.5 text-right">PDF</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-border">
                <tr v-if="invoicesList.length === 0">
                  <td colspan="7" class="p-8 text-center text-muted-foreground">No hotel invoices found.</td>
                </tr>
                <tr v-for="inv in invoicesList" :key="inv._id" class="hover:bg-muted/20 transition">
                  <td class="p-3.5 font-bold font-mono text-primary">{{ inv.invoiceNumber }}</td>
                  <td class="p-3.5 font-bold text-foreground">{{ inv.guestName }} ({{ inv.guestPhone }})</td>
                  <td class="p-3.5 font-medium">Room {{ inv.roomNumber }}</td>
                  <td class="p-3.5 text-muted-foreground">
                    {{ new Date(inv.checkInDate).toLocaleDateString() }} - {{ new Date(inv.checkOutDate).toLocaleDateString() }} ({{ inv.billableNights }} N)
                  </td>
                  <td class="p-3.5 font-black text-foreground">₹{{ inv.totalAmount }}</td>
                  <td class="p-3.5">
                    <Badge class="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[10px] font-bold">
                      {{ inv.paymentMethod }} • {{ inv.paymentStatus }}
                    </Badge>
                  </td>
                  <td class="p-3.5 text-right">
                    <a
                      :href="getHotelInvoicePdfUrl(inv._id || inv.id, restaurantId)"
                      target="_blank"
                      class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-border text-primary hover:bg-primary/10 transition font-bold text-xs"
                    >
                      <Download class="h-3 w-3" /> PDF
                    </a>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Mobile Card List View -->
        <div class="sm:hidden space-y-2.5">
          <div v-if="invoicesList.length === 0" class="p-8 text-center text-muted-foreground bg-card rounded-2xl border border-border text-xs">
            No hotel invoices found.
          </div>
          <div
            v-for="inv in invoicesList"
            :key="inv._id"
            class="p-3.5 rounded-2xl bg-card border border-border shadow-2xs space-y-2 text-xs"
          >
            <div class="flex items-center justify-between">
              <span class="font-mono font-bold text-primary text-xs">{{ inv.invoiceNumber }}</span>
              <Badge class="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[10px] font-bold">
                {{ inv.paymentMethod }} • {{ inv.paymentStatus }}
              </Badge>
            </div>
            <div class="flex items-start justify-between text-muted-foreground text-[11px]">
              <div>
                <strong class="text-foreground block text-xs">{{ inv.guestName }}</strong>
                <span>{{ inv.guestPhone }}</span>
              </div>
              <div class="text-right">
                <span class="font-bold text-foreground block">Room {{ inv.roomNumber }}</span>
                <span>{{ inv.billableNights }} Night{{ inv.billableNights !== 1 ? 's' : '' }}</span>
              </div>
            </div>
            <div class="flex items-center justify-between pt-2 border-t border-border/50">
              <div>
                <span class="text-muted-foreground text-[10px]">Total: </span>
                <span class="font-black text-foreground text-sm">₹{{ inv.totalAmount }}</span>
              </div>
              <a
                :href="getHotelInvoicePdfUrl(inv._id || inv.id, restaurantId)"
                target="_blank"
                class="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-primary/10 text-primary hover:bg-primary/20 transition font-bold text-xs"
              >
                <Download class="h-3 w-3" /> PDF
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 1. MODAL: CREATE GUEST BOOKING / WALK-IN CHECKIN -->
    <Dialog :open="showBookingModal" @update:open="showBookingModal = $event">
      <DialogContent class="sm:max-w-xl max-h-[88vh] overflow-y-auto p-4 sm:p-6 rounded-2xl sm:rounded-3xl">
        <DialogHeader class="pr-10 sm:pr-12">
          <div class="flex items-center gap-2 flex-wrap">
            <div class="flex items-center gap-2">
              <BedDouble class="h-4.5 w-4.5 text-primary shrink-0" />
              <DialogTitle class="text-base font-bold">
                {{ selectedRoomForBooking ? `Book Room ${selectedRoomForBooking.roomNumber}` : 'Hotel Reservation' }}
              </DialogTitle>
            </div>
            <Badge v-if="selectedRoomForBooking" :class="[getCardStyle(selectedRoomForBooking.status).badge, 'text-[10px] font-bold px-2 py-0.5 rounded-md shrink-0']">
              {{ selectedRoomForBooking.status === 'AVAILABLE' && selectedRoomForBooking.upcomingReservation ? 'Available Today' : selectedRoomForBooking.status }}
            </Badge>
          </div>
          <DialogDescription class="text-xs text-muted-foreground">
            {{ isCheckInToday ? 'Complete guest details for immediate check-in today.' : 'Set future stay dates. The room remains available for other bookings today.' }}
          </DialogDescription>
        </DialogHeader>

        <form @submit.prevent="submitBooking" class="space-y-3.5 pt-2">
          <!-- Room Selection Dropdown -->
          <div class="space-y-1 text-xs font-medium">
            <label class="font-bold text-foreground">Room Selection *</label>
            <select
              :value="selectedRoomForBooking?._id || selectedRoomForBooking?.id"
              @change="onRoomSelectChange"
              class="w-full h-9.5 sm:h-9 pl-3 pr-8.5 text-xs rounded-lg bg-background border border-border font-medium shadow-2xs hover:border-primary/50 transition"
            >
              <option v-for="r in rooms" :key="r._id || r.id" :value="r._id || r.id">
                Room {{ r.roomNumber }} (₹{{ r.baseTariff }}/night) — {{ r.status === 'AVAILABLE' ? (r.upcomingReservation ? 'Available Today (Reserved from ' + new Date(r.upcomingReservation.checkInDate).toLocaleDateString() + ')' : 'Available Now') : r.status }}
              </option>
            </select>
          </div>

          <!-- Upcoming reservation alert if room is already booked in future -->
          <div v-if="selectedRoomForBooking?.upcomingReservation" class="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/25 text-xs text-blue-700 dark:text-blue-300 flex items-start gap-2">
            <Calendar class="h-4 w-4 shrink-0 text-blue-600 mt-0.5" />
            <div>
              <p class="font-bold">Room {{ selectedRoomForBooking.roomNumber }} has an upcoming reservation</p>
              <p class="text-[11px] text-muted-foreground mt-0.5">
                Reserved from <strong>{{ new Date(selectedRoomForBooking.upcomingReservation.checkInDate).toLocaleDateString() }}</strong> to <strong>{{ new Date(selectedRoomForBooking.upcomingReservation.checkOutDate).toLocaleDateString() }}</strong>. For a stay starting today, checkout must be on or before <strong>{{ new Date(selectedRoomForBooking.upcomingReservation.checkInDate).toLocaleDateString() }}</strong>.
              </p>
            </div>
          </div>

          <!-- Guest Information Box -->
          <div class="rounded-xl border border-border p-3 space-y-2.5 bg-muted/20">
            <span class="text-xs font-bold text-foreground block">Guest Identification</span>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div class="space-y-1 text-xs font-medium">
                <label>Full Name *</label>
                <Input v-model="bookingForm.guestName" required placeholder="Guest full name" class="h-9.5 sm:h-9 text-xs rounded-lg" />
              </div>
              <div class="space-y-1 text-xs font-medium">
                <label>Mobile Number *</label>
                <Input v-model="bookingForm.guestPhone" required placeholder="e.g. 9876543210" class="h-9.5 sm:h-9 text-xs rounded-lg" />
              </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div class="space-y-1 text-xs font-medium">
                <label>Identity Document</label>
                <select v-model="bookingForm.idType" class="w-full h-9.5 sm:h-9 pl-3 pr-8.5 text-xs rounded-lg bg-background border border-border font-medium shadow-2xs hover:border-primary/50 transition">
                  <option value="Aadhaar">Aadhaar Card</option>
                  <option value="Passport">Passport</option>
                  <option value="Driving License">Driving License</option>
                  <option value="Voter ID">Voter ID</option>
                  <option value="Other">Other National ID</option>
                </select>
              </div>
              <div class="space-y-1 text-xs font-medium">
                <label>ID Document Number</label>
                <Input v-model="bookingForm.idNumber" placeholder="XXXX-XXXX-XXXX" class="h-9.5 sm:h-9 text-xs rounded-lg" />
              </div>
            </div>
          </div>

          <!-- Stay Dates -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div class="space-y-1 text-xs font-medium">
              <label>Check-in Date *</label>
              <input
                v-model="bookingForm.checkInDate"
                @change="onCheckInDateChange"
                type="date"
                required
                class="w-full h-9.5 sm:h-9 px-3 text-xs rounded-lg bg-background border border-border font-medium"
              />
            </div>
            <div class="space-y-1 text-xs font-medium">
              <label>Expected Checkout Date *</label>
              <input
                v-model="bookingForm.checkOutDate"
                type="date"
                required
                class="w-full h-9.5 sm:h-9 px-3 text-xs rounded-lg bg-background border border-border font-medium"
              />
            </div>
          </div>

          <!-- Date Conflict Warning or Success Indicator -->
          <div v-if="dateConflict" class="p-3 rounded-xl bg-destructive/10 border border-destructive/25 text-xs text-destructive space-y-1">
            <div class="flex items-center gap-1.5 font-bold">
              <AlertCircle class="h-4 w-4 shrink-0" />
              <span>{{ dateConflict.message }}</span>
            </div>
            <p v-if="dateConflict.advice" class="text-[11px] text-muted-foreground pl-5.5">
              {{ dateConflict.advice }}
            </p>
          </div>
          <div v-else-if="bookingForm.checkInDate && bookingForm.checkOutDate" class="flex items-center justify-between px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-700 dark:text-emerald-400 font-medium">
            <span class="flex items-center gap-1.5 font-bold">
              <CheckCircle2 class="h-3.5 w-3.5" /> Stay Dates Available
            </span>
            <span>{{ computedNights }} Nights</span>
          </div>

          <!-- Payment & Discount Details -->
          <div class="p-3 rounded-xl bg-muted/30 border border-border space-y-2">
            <div class="flex items-center justify-between text-xs font-bold text-foreground">
              <span>Estimated Stay Total:</span>
              <span class="text-primary font-black text-sm">₹{{ computedEstimatedTotal }} ({{ computedNights }} Nights)</span>
            </div>
            <div v-if="Number(bookingForm.discount) > 0" class="flex items-center justify-between text-xs font-bold text-emerald-600 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20">
              <span>Discount Cut Directly:</span>
              <span>− ₹{{ Number(bookingForm.discount).toFixed(0) }}</span>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
              <div class="space-y-1 text-xs font-medium">
                <label>Discount (₹) <span class="text-muted-foreground text-[10px] font-normal">(Optional)</span></label>
                <Input v-model.number="bookingForm.discount" type="number" min="0" placeholder="0" class="h-9.5 sm:h-9 text-xs rounded-lg" />
              </div>
              <div class="space-y-1 text-xs font-medium">
                <label>Advance Payment (₹) <span class="text-muted-foreground text-[10px] font-normal">(Optional)</span></label>
                <Input v-model.number="bookingForm.advancePayment" type="number" min="0" :max="computedEstimatedTotal" placeholder="0" class="h-9.5 sm:h-9 text-xs rounded-lg" />
              </div>
              <div class="space-y-1 text-xs font-medium col-span-1 sm:col-span-2">
                <label>Payment Method</label>
                <select v-model="bookingForm.paymentMethod" class="w-full h-9.5 sm:h-9 pl-3 pr-8.5 text-xs rounded-lg bg-background border border-border font-medium shadow-2xs hover:border-primary/50 transition">
                  <option value="CASH">Cash</option>
                  <option value="CARD">Debit / Credit Card</option>
                  <option value="UPI">UPI / QR Code</option>
                  <option value="DIGITAL_WALLET">Digital Wallet</option>
                </select>
              </div>
            </div>
          </div>

          <!-- Walk-in Checkbox or Future Reservation Banner -->
          <div v-if="isCheckInToday" class="pt-1">
            <label class="flex items-center gap-2 text-xs font-semibold text-foreground cursor-pointer">
              <input type="checkbox" v-model="bookingForm.isWalkIn" class="h-4 w-4 accent-primary rounded cursor-pointer" />
              <span>Immediate Check-In (Guest is arriving right now)</span>
            </label>
          </div>
          <div v-else class="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs text-blue-700 dark:text-blue-300 flex items-center gap-2">
            <Calendar class="h-4 w-4 shrink-0 text-blue-600" />
            <span>
              <strong>Future Reservation:</strong> Guest check-in scheduled for <strong>{{ new Date(bookingForm.checkInDate).toLocaleDateString() }}</strong>. Room remains available for other guests today.
            </span>
          </div>

          <DialogFooter class="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2">
            <Button type="button" variant="outline" class="w-full sm:w-auto h-10 sm:h-9 text-xs rounded-xl" @click="showBookingModal = false">Cancel</Button>
            <Button
              type="submit"
              class="gradient-primary text-primary-foreground font-bold w-full sm:w-auto h-10 sm:h-9 text-xs rounded-xl shadow-xs"
              :disabled="actionLoading || Boolean(dateConflict)"
            >
              {{ actionLoading ? 'Processing...' : (dateConflict ? 'Date Conflict - Cannot Book' : (isCheckInToday && bookingForm.isWalkIn ? 'Confirm & Check In' : 'Create Reservation')) }}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    <!-- 2. MODAL: ACTIVE STAY MANAGEMENT (OCCUPIED / RESERVED) -->
    <Dialog :open="showActiveStayModal" @update:open="showActiveStayModal = $event">
      <DialogContent class="max-w-[94vw] sm:max-w-lg p-4 sm:p-6 rounded-2xl sm:rounded-3xl">
        <DialogHeader class="pr-10 sm:pr-12">
          <div class="flex items-center gap-2 flex-wrap">
            <div class="flex items-center gap-2">
              <BedDouble class="h-4.5 w-4.5 text-primary shrink-0" />
              <DialogTitle class="text-base font-bold">
                Room {{ activeStayRoom?.roomNumber }} Stay Details
              </DialogTitle>
            </div>
            <Badge :class="[getCardStyle(activeStayRoom?.status).badge, 'text-[10px] font-bold px-2 py-0.5 rounded-md shrink-0']">
              {{ activeStayRoom?.status }}
            </Badge>
          </div>
          <DialogDescription class="text-xs text-muted-foreground">
            Booking Reference: <strong class="text-foreground font-mono">{{ activeBooking?.bookingReference }}</strong>
          </DialogDescription>
        </DialogHeader>

        <div class="space-y-3.5 pt-2 text-xs">
          <!-- Guest & Stay Overview Card -->
          <div class="p-3.5 rounded-2xl bg-muted/30 border border-border space-y-2">
            <div class="flex items-start justify-between">
              <div>
                <span class="font-bold text-sm text-foreground block">{{ activeBooking?.guest?.name }}</span>
                <span class="text-muted-foreground">{{ activeBooking?.guest?.phone }} • {{ activeBooking?.guest?.idType || 'ID' }}</span>
              </div>
              <div class="text-right">
                <span class="text-[10px] text-muted-foreground uppercase font-bold block">Tariff</span>
                <span class="font-black text-foreground">₹{{ activeBooking?.roomTariffPerNight }} / night</span>
              </div>
            </div>

            <div class="grid grid-cols-3 gap-2 pt-1 text-[11px] border-t border-border/60 text-muted-foreground">
              <div>Check-In: <strong class="text-foreground block">{{ new Date(activeBooking?.checkInDate).toLocaleDateString() }}</strong></div>
              <div>Expected Out: <strong class="text-foreground block">{{ new Date(activeBooking?.checkOutDate).toLocaleDateString() }}</strong></div>
              <div>Stay Duration: <strong class="text-foreground block">{{ activeBooking?.totalNights }} Night{{ activeBooking?.totalNights !== 1 ? 's' : '' }}</strong></div>
            </div>
          </div>

          <!-- Financial Snapshot -->
          <div class="grid grid-cols-3 gap-2 text-center p-2.5 rounded-xl bg-muted/20 border border-border">
            <div>
              <span class="text-[10px] uppercase font-bold text-muted-foreground block">Total Bill</span>
              <span class="font-black text-foreground">₹{{ activeBooking?.totalAmount }}</span>
            </div>
            <div>
              <span class="text-[10px] uppercase font-bold text-emerald-600 block">Total Paid</span>
              <span class="font-black text-emerald-600">₹{{ activeBooking?.paidAmount }}</span>
            </div>
            <div>
              <span class="text-[10px] uppercase font-bold text-rose-600 block">Balance Due</span>
              <span class="font-black text-rose-600">₹{{ activeBooking?.outstandingBalance }}</span>
            </div>
          </div>

          <!-- Additional charges list if any -->
          <div v-if="activeBooking?.additionalCharges?.length" class="space-y-1">
            <span class="font-bold text-[11px] text-muted-foreground block">Additional Room Charges:</span>
            <div class="max-h-24 overflow-y-auto space-y-1">
              <div v-for="c in activeBooking.additionalCharges" :key="c._id" class="flex justify-between p-1.5 rounded-lg bg-card border border-border text-[11px]">
                <span>{{ c.title }}</span>
                <span class="font-bold text-foreground">₹{{ c.amount }}</span>
              </div>
            </div>
          </div>

          <!-- Inline Stay Extension Drawer -->
          <div v-if="showExtendInput" class="p-3 rounded-xl bg-blue-500/10 border border-blue-500/30 space-y-2">
            <span class="font-bold text-blue-700 dark:text-blue-300 block">Extend Guest Stay</span>
            <div class="flex items-center gap-2">
              <input v-model="extendCheckOutDate" type="date" class="bg-background border border-border rounded-lg px-2.5 py-1.5 text-xs flex-1" />
              <Button size="sm" class="gradient-primary text-primary-foreground font-bold text-xs h-8" @click="submitExtension" :disabled="actionLoading">
                Confirm Extension
              </Button>
            </div>
          </div>

          <!-- Inline Add Charge Drawer -->
          <div v-if="showAddChargeInput" class="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-2">
            <span class="font-bold text-amber-700 dark:text-amber-300 block">Add Permitted Room Charge</span>
            <div class="grid grid-cols-2 gap-2">
              <Input v-model="newChargeTitle" placeholder="e.g. Laundry, Airport Cab" class="h-8 text-xs rounded-lg" />
              <Input v-model.number="newChargeAmount" type="number" min="1" placeholder="Amount (₹)" class="h-8 text-xs rounded-lg" />
            </div>
            <div class="flex justify-end gap-2 pt-1">
              <Button size="sm" variant="outline" class="h-7 text-xs" @click="showAddChargeInput = false">Cancel</Button>
              <Button size="sm" class="bg-amber-600 hover:bg-amber-700 text-white font-bold h-7 text-xs" @click="submitAddCharge" :disabled="actionLoading">
                Add Charge
              </Button>
            </div>
          </div>

          <!-- Action Buttons Bar -->
          <div class="pt-2 space-y-2">
            <template v-if="activeStayRoom?.status === 'RESERVED'">
              <Button class="gradient-primary text-primary-foreground font-bold w-full h-10 rounded-xl text-xs gap-1.5 shadow-xs cursor-pointer" @click="handleCheckInReserved" :disabled="actionLoading">
                <CheckCircle2 class="h-4 w-4" /> Check In Guest
              </Button>
            </template>

            <template v-else-if="activeStayRoom?.status === 'OCCUPIED'">
              <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <Button variant="outline" size="sm" class="h-9 rounded-xl text-xs gap-1 cursor-pointer" @click="showExtendInput = !showExtendInput">
                  <Calendar class="h-3.5 w-3.5" /> Extend Stay
                </Button>
                <Button variant="outline" size="sm" class="h-9 rounded-xl text-xs gap-1 cursor-pointer" @click="bookFutureFromActiveStay">
                  <Plus class="h-3.5 w-3.5" /> Book Future
                </Button>
                <Button variant="outline" size="sm" class="h-9 rounded-xl text-xs gap-1 cursor-pointer col-span-2 sm:col-span-1" @click="showAddChargeInput = !showAddChargeInput">
                  <Plus class="h-3.5 w-3.5" /> Add Charge
                </Button>
              </div>
              <Button class="bg-rose-600 hover:bg-rose-700 text-white font-bold w-full h-10 rounded-xl text-xs gap-1.5 cursor-pointer shadow-xs" @click="initiateCheckout">
                <DollarSign class="h-4 w-4" /> Checkout & Settle Bill
              </Button>
            </template>
          </div>
        </div>
      </DialogContent>
    </Dialog>

    <!-- 3. MODAL: GUEST CHECKOUT & BILL SETTLEMENT -->
    <Dialog :open="showCheckoutDialog" @update:open="showCheckoutDialog = $event">
      <DialogContent class="max-w-[94vw] sm:max-w-md p-4 sm:p-6 rounded-2xl sm:rounded-3xl">
        <DialogHeader class="pr-10 sm:pr-12">
          <DialogTitle class="text-base font-bold flex items-center gap-2">
            <DollarSign class="h-4.5 w-4.5 text-emerald-600 shrink-0" />
            Checkout Billing: Room {{ activeStayRoom?.roomNumber }}
          </DialogTitle>
          <DialogDescription class="text-xs text-muted-foreground">
            Settle outstanding balance, finalize hotel invoice, and release room to cleaning.
          </DialogDescription>
        </DialogHeader>

        <form @submit.prevent="processFinalCheckout" class="space-y-3.5 pt-2 text-xs">
          <!-- Itemized Summary Strip -->
          <div class="p-3.5 rounded-2xl bg-muted/40 border border-border space-y-1.5">
            <div class="flex justify-between">
              <span class="text-muted-foreground">Room Charges ({{ activeBooking?.totalNights }} nights @ ₹{{ activeBooking?.roomTariffPerNight }}):</span>
              <span class="font-bold text-foreground">₹{{ (activeBooking?.roomTariffPerNight || 0) * (activeBooking?.totalNights || 1) }}</span>
            </div>
            <div v-if="activeBooking?.additionalCharges?.length" class="flex justify-between">
              <span class="text-muted-foreground">Additional Charges Total:</span>
              <span class="font-bold text-foreground">₹{{ activeBooking.additionalCharges.reduce((s: number, c: any) => s + c.amount, 0) }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-muted-foreground">GST Taxes ({{ activeBooking?.taxPercentage || 5 }}%):</span>
              <span class="font-bold text-foreground">₹{{ activeBooking?.taxAmount }}</span>
            </div>
            <div v-if="activeBooking?.advancePayment > 0" class="flex justify-between text-emerald-600">
              <span>Advance Paid Deducted:</span>
              <span class="font-bold">- ₹{{ activeBooking?.advancePayment }}</span>
            </div>
            <div v-if="Number(checkoutDiscount) > 0" class="flex justify-between text-emerald-600 font-medium">
              <span>Discount Cut Directly:</span>
              <span class="font-bold">- ₹{{ Number(checkoutDiscount).toFixed(0) }}</span>
            </div>
            <div class="border-t border-border/80 pt-2 flex justify-between font-bold text-foreground">
              <span>Remaining Balance to Settle:</span>
              <span class="text-rose-600 font-black text-sm">₹{{ computedSettlementBalance }}</span>
            </div>
          </div>

          <!-- Discount & Settlement Mode -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div class="space-y-1 font-medium">
              <label>Discount (₹)</label>
              <Input v-model.number="checkoutDiscount" type="number" min="0" class="h-9.5 sm:h-9 text-xs rounded-xl" />
            </div>
            <div class="space-y-1 font-medium">
              <label>Payment Method *</label>
              <select v-model="checkoutPaymentMethod" class="w-full h-9.5 sm:h-9 pl-3 pr-8.5 text-xs rounded-lg bg-background border border-border font-medium shadow-2xs hover:border-primary/50 transition">
                <option value="CASH">Cash</option>
                <option value="CARD">Debit / Credit Card</option>
                <option value="UPI">UPI / QR Code</option>
                <option value="DIGITAL_WALLET">Digital Wallet</option>
              </select>
            </div>
          </div>

          <!-- Cash Tendered & Return Change Calculator -->
          <div v-if="checkoutPaymentMethod === 'CASH' && computedSettlementBalance > 0" class="p-2.5 rounded-xl bg-muted/30 border border-border grid grid-cols-1 sm:grid-cols-2 gap-2 items-center">
            <div class="space-y-1 font-medium">
              <label>Cash Tendered (₹)</label>
              <Input v-model="cashGiven" placeholder="Enter cash given" class="h-9 sm:h-8.5 text-xs rounded-lg" />
            </div>
            <div class="text-left sm:text-right">
              <span class="text-[10px] uppercase font-bold text-muted-foreground block">Change to Return</span>
              <span class="text-sm font-black text-emerald-600">₹{{ changeDue }}</span>
            </div>
          </div>

          <DialogFooter class="pt-3 flex flex-col-reverse sm:flex-row gap-2">
            <Button type="button" variant="outline" class="w-full sm:w-auto h-9 text-xs rounded-xl cursor-pointer" @click="showCheckoutDialog = false">Cancel</Button>
            <Button type="submit" class="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-9 text-xs rounded-xl shadow-xs cursor-pointer" :disabled="actionLoading">
              {{ actionLoading ? 'Processing Settlement...' : `Confirm & Settle ₹${computedSettlementBalance}` }}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    <!-- 4. MODAL: INVOICE GENERATED SUCCESS & PRINT -->
    <Dialog :open="showInvoiceSuccessModal" @update:open="showInvoiceSuccessModal = $event">
      <DialogContent class="max-w-[94vw] sm:max-w-md text-center p-4 sm:p-6 rounded-2xl sm:rounded-3xl space-y-3 sm:space-y-4">
        <div class="h-12 w-12 sm:h-14 sm:w-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 mx-auto flex items-center justify-center">
          <CheckCheck class="h-7 w-7 sm:h-8 sm:w-8" />
        </div>
        <div>
          <h3 class="font-display font-bold text-base sm:text-lg text-foreground">Checkout Completed!</h3>
          <p class="text-xs text-muted-foreground mt-1">
            Invoice <strong class="text-primary font-mono">{{ lastCompletedInvoice?.invoiceNumber }}</strong> has been created. Room is now queued for cleaning.
          </p>
        </div>

        <div class="p-3.5 rounded-2xl bg-muted/30 border border-border text-xs text-left space-y-1">
          <div class="flex justify-between font-medium">
            <span class="text-muted-foreground">Guest:</span>
            <span class="font-bold text-foreground">{{ lastCompletedInvoice?.guestName }}</span>
          </div>
          <div class="flex justify-between font-medium">
            <span class="text-muted-foreground">Room:</span>
            <span>Room {{ lastCompletedInvoice?.roomNumber }}</span>
          </div>
          <div class="flex justify-between font-medium">
            <span class="text-muted-foreground">Total Bill Settled:</span>
            <span class="font-black text-emerald-600">₹{{ lastCompletedInvoice?.totalAmount }}</span>
          </div>
        </div>

        <div class="flex flex-col-reverse sm:flex-row items-center gap-2 pt-2">
          <Button variant="outline" class="w-full sm:flex-1 h-9 text-xs rounded-xl cursor-pointer" @click="showInvoiceSuccessModal = false">
            Close
          </Button>
          <a
            v-if="lastCompletedInvoice"
            :href="getHotelInvoicePdfUrl(lastCompletedInvoice._id || lastCompletedInvoice.id, restaurantId)"
            target="_blank"
            class="w-full sm:flex-1 inline-flex items-center justify-center gap-1.5 h-9 rounded-xl gradient-primary text-primary-foreground font-bold text-xs shadow-xs"
          >
            <Download class="h-3.5 w-3.5" /> Download / Print PDF
          </a>
        </div>
      </DialogContent>
    </Dialog>

    <!-- 5. MODAL: PRE-BOOKING & RESERVATION DETAILS -->
    <Dialog :open="showReservationDetailsModal" @update:open="showReservationDetailsModal = $event">
      <DialogContent class="max-w-[94vw] sm:max-w-lg p-4 sm:p-6 rounded-2xl sm:rounded-3xl">
        <DialogHeader class="pr-10 sm:pr-12">
          <div class="flex items-center gap-2 flex-wrap">
            <div class="flex items-center gap-2">
              <Calendar class="h-5 w-5 text-blue-600 shrink-0" />
              <DialogTitle class="text-base font-bold">
                Pre-Booking: Room {{ selectedReservationRoom?.roomNumber }}
              </DialogTitle>
            </div>
            <Badge class="bg-blue-500/15 text-blue-600 border-blue-500/30 text-[10px] font-bold px-2 py-0.5 rounded-md shrink-0">
              {{ isSelectedReservationToday ? 'Arriving Today' : 'Pre-Booked' }}
            </Badge>
          </div>
          <DialogDescription class="text-xs text-muted-foreground">
            Booking Ref: <strong class="text-foreground font-mono">{{ selectedReservation?.bookingReference }}</strong>
          </DialogDescription>
        </DialogHeader>

        <div class="space-y-3.5 pt-2 text-xs">
          <!-- Guest Overview Card -->
          <div class="p-3.5 rounded-2xl bg-muted/30 border border-border space-y-2">
            <div class="flex items-start justify-between">
              <div>
                <span class="font-bold text-sm text-foreground block">{{ selectedReservation?.guest?.name }}</span>
                <span class="text-muted-foreground flex items-center gap-1 mt-0.5"><Phone class="h-3 w-3" /> {{ selectedReservation?.guest?.phone }}</span>
                <span v-if="selectedReservation?.guest?.idNumber" class="text-muted-foreground block text-[11px] mt-0.5">
                  {{ selectedReservation?.guest?.idType || 'ID' }}: {{ selectedReservation?.guest?.idNumber }}
                </span>
              </div>
              <div class="text-right">
                <span class="text-[10px] text-muted-foreground uppercase font-bold block">Tariff</span>
                <span class="font-black text-foreground">₹{{ selectedReservation?.roomTariffPerNight || selectedReservationRoom?.baseTariff }} / night</span>
              </div>
            </div>

            <div class="grid grid-cols-3 gap-2 pt-1 text-[11px] border-t border-border/60 text-muted-foreground">
              <div>Check-In: <strong class="text-foreground block">{{ new Date(selectedReservation?.checkInDate).toLocaleDateString() }}</strong></div>
              <div>Checkout: <strong class="text-foreground block">{{ new Date(selectedReservation?.checkOutDate).toLocaleDateString() }}</strong></div>
              <div>Stay Duration: <strong class="text-foreground block">{{ selectedReservation?.totalNights || 1 }} Night(s)</strong></div>
            </div>
          </div>

          <!-- Financial Snapshot -->
          <div class="grid grid-cols-3 gap-2 text-center p-2.5 rounded-xl bg-muted/20 border border-border">
            <div>
              <span class="text-[10px] uppercase font-bold text-muted-foreground block">Estimated Total</span>
              <span class="font-black text-foreground">₹{{ selectedReservation?.totalAmount || 0 }}</span>
            </div>
            <div>
              <span class="text-[10px] uppercase font-bold text-emerald-600 block">Advance Paid</span>
              <span class="font-black text-emerald-600">₹{{ selectedReservation?.advancePayment || selectedReservation?.paidAmount || 0 }}</span>
            </div>
            <div>
              <span class="text-[10px] uppercase font-bold text-rose-600 block">Balance at Check-in</span>
              <span class="font-black text-rose-600">₹{{ Math.max(0, (selectedReservation?.totalAmount || 0) - (selectedReservation?.advancePayment || selectedReservation?.paidAmount || 0)) }}</span>
            </div>
          </div>

          <div v-if="selectedReservation?.bookingNotes || selectedReservation?.specialRequests" class="p-2.5 rounded-xl bg-muted/20 border border-border text-[11px] space-y-1">
            <span class="font-bold text-foreground">Notes / Special Requests:</span>
            <p class="text-muted-foreground">{{ selectedReservation?.bookingNotes || selectedReservation?.specialRequests }}</p>
          </div>

          <!-- Status Indicator -->
          <div v-if="isSelectedReservationToday" class="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-700 dark:text-emerald-400 font-semibold flex items-center gap-1.5">
            <CheckCircle2 class="h-4 w-4 shrink-0" />
            <span>Guest is scheduled to check in today! Room {{ selectedReservationRoom?.roomNumber }} is ready.</span>
          </div>
          <div v-else class="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs text-blue-700 dark:text-blue-300 flex items-center gap-1.5">
            <Calendar class="h-4 w-4 shrink-0 text-blue-600" />
            <span>Pre-booking confirmed for <strong>{{ new Date(selectedReservation?.checkInDate).toLocaleDateString() }}</strong>. Room remains available for walk-ins today.</span>
          </div>

          <!-- Action Buttons Bar -->
          <div class="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 border-t border-border">
            <Button
              variant="outline"
              size="sm"
              class="text-destructive border-destructive/30 hover:bg-destructive/10 h-9 sm:h-8.5 rounded-xl text-xs gap-1 font-bold cursor-pointer w-full sm:w-auto order-2 sm:order-1"
              @click="handleCancelReservation"
              :disabled="actionLoading"
            >
              <Ban class="h-3.5 w-3.5" /> Cancel Reservation
            </Button>
            <div class="flex items-center gap-2 w-full sm:w-auto order-1 sm:order-2">
              <Button variant="outline" size="sm" class="h-9 sm:h-8.5 rounded-xl text-xs cursor-pointer flex-1 sm:flex-initial" @click="showReservationDetailsModal = false">
                Close
              </Button>
              <Button
                v-if="isSelectedReservationToday"
                class="gradient-primary text-primary-foreground font-bold h-9 sm:h-8.5 rounded-xl text-xs gap-1.5 shadow-xs cursor-pointer flex-1 sm:flex-initial"
                @click="handleCheckInFromReservation"
                :disabled="actionLoading"
              >
                <CheckCircle2 class="h-4 w-4" /> Check In Guest
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  </RoleLayout>
</template>
