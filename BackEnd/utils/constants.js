const ROLES = {
  MAIN_ADMIN: 'MAIN_ADMIN',
  RESTAURANT_ADMIN: 'RESTAURANT_ADMIN',
  WAITER: 'WAITER',
  CHEF: 'CHEF',
  CASHIER: 'CASHIER',
};

const CLIENT_ROLES = {
  MAIN_ADMIN: 'main_admin',
  RESTAURANT_ADMIN: 'restaurant_admin',
  WAITER: 'waiter',
  CHEF: 'chef',
  CASHIER: 'cashier',
};

const normalizeRole = (role) => {
  if (typeof role !== 'string') return null;
  const trimmed = role.trim();
  const upper = trimmed.toUpperCase();

  if (ROLES[upper]) {
    return upper;
  }

  const lower = trimmed.toLowerCase();
  const mappedEntry = Object.entries(CLIENT_ROLES).find(([, value]) => value === lower);
  return mappedEntry ? mappedEntry[0] : null;
};

const formatRoleForClient = (role) => {
  const normalized = normalizeRole(role);
  return normalized ? CLIENT_ROLES[normalized] : null;
};

const PERMISSIONS = {
  MAIN_ADMIN: [
    'manage_all_restaurants',
    'manage_users',
    'configure_system',
    'view_analytics',
    'override_operations',
    'manage_menu',
    'view_orders',
    'manage_payments',
    'manage_hotel_facilities',
    'view_all_hotels',
  ],
  RESTAURANT_ADMIN: [
    'manage_own_menu',
    'manage_own_staff',
    'view_own_orders',
    'view_own_reports',
    'manage_hotel_rooms',
    'manage_hotel_bookings',
    'view_hotel_reports',
    'manage_hotel_housekeeping',
  ],
  WAITER: [
    'create_orders',
    'add_order_items',
    'view_menu',
    'view_order_status',
  ],
  CHEF: [
    'view_orders',
    'update_order_status',
  ],
  CASHIER: [
    'view_completed_orders',
    'generate_bill',
    'process_payment',
    'view_transactions',
    'view_hotel_rooms',
    'create_hotel_bookings',
    'checkin_hotel_guest',
    'checkout_hotel_guest',
    'process_hotel_payments',
  ],
};

const ORDER_STATUS = {
  PENDING: 'PENDING',
  PREPARING: 'PREPARING',
  READY: 'READY',
  SERVED: 'SERVED',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
};

const PAYMENT_STATUS = {
  PENDING: 'PENDING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  REFUNDED: 'REFUNDED',
};

const PAYMENT_METHODS = {
  CASH: 'CASH',
  CARD: 'CARD',
  DIGITAL_WALLET: 'DIGITAL_WALLET',
  CHEQUE: 'CHEQUE',
};

const MENU_CATEGORIES = {
  APPETIZER: 'APPETIZER',
  MAIN_COURSE: 'MAIN_COURSE',
  DESSERT: 'DESSERT',
  BEVERAGE: 'BEVERAGE',
  SIDES: 'SIDES',
};

const RESTAURANT_STATUS = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
  CLOSED: 'CLOSED',
};

const HOTEL_ROOM_STATUS = {
  AVAILABLE: 'AVAILABLE',
  RESERVED: 'RESERVED',
  OCCUPIED: 'OCCUPIED',
  CLEANING: 'CLEANING',
  MAINTENANCE: 'MAINTENANCE',
};

const HOTEL_BOOKING_STATUS = {
  RESERVED: 'RESERVED',
  CHECKED_IN: 'CHECKED_IN',
  CHECKED_OUT: 'CHECKED_OUT',
  CANCELLED: 'CANCELLED',
  NO_SHOW: 'NO_SHOW',
};

const HOTEL_PAYMENT_TYPES = {
  ADVANCE: 'ADVANCE',
  INTERIM: 'INTERIM',
  SETTLEMENT: 'SETTLEMENT',
  REFUND: 'REFUND',
};

module.exports = {
  ROLES,
  PERMISSIONS,
  ORDER_STATUS,
  PAYMENT_STATUS,
  PAYMENT_METHODS,
  MENU_CATEGORIES,
  RESTAURANT_STATUS,
  HOTEL_ROOM_STATUS,
  HOTEL_BOOKING_STATUS,
  HOTEL_PAYMENT_TYPES,
  normalizeRole,
  formatRoleForClient,
};
