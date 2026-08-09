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
  ],
  RESTAURANT_ADMIN: [
    'manage_own_menu',
    'manage_own_staff',
    'view_own_orders',
    'view_own_reports',
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

module.exports = {
  ROLES,
  PERMISSIONS,
  ORDER_STATUS,
  PAYMENT_STATUS,
  PAYMENT_METHODS,
  MENU_CATEGORIES,
  RESTAURANT_STATUS,
  normalizeRole,
  formatRoleForClient,
};
