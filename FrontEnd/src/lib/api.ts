export type AppRole = "main_admin" | "restaurant_admin" | "waiter" | "chef" | "cashier";

export type BackendUser = {
  id: string;
  name: string;
  email: string;
  role: AppRole;
  restaurantId?: string | Record<string, unknown>;
  phone?: string;
  location?: string;
  createdAt?: string;
  updatedAt?: string;
  isActive?: boolean;
};

export const getApiBaseUrl = (): string => {
  if (typeof window !== "undefined") {
    const custom = window.localStorage.getItem("API_BASE_URL");
    if (custom) return custom.replace(/\/$/, "");

    // If loaded over HTTPS on a remote domain and VITE_API_BASE_URL is localhost (mixed content)
    if (window.location.protocol === "https:" && !window.location.hostname.includes("localhost") && !window.location.hostname.includes("127.0.0.1")) {
      const envUrl = import.meta.env.VITE_API_BASE_URL;
      if (envUrl && envUrl.startsWith("https://")) {
        return envUrl.replace(/\/$/, "");
      }
      return ""; // Fallback to relative URL on HTTPS
    }
  }

  return (import.meta.env.VITE_API_BASE_URL || "http://localhost:5001").replace(/\/$/, "");
};

const TOKEN_KEY = "SERVIA_AUTH_TOKEN";

const getStoredToken = () => {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
};

export const saveToken = (token: string | null) => {
  if (typeof window === "undefined") return;
  if (token) {
    window.localStorage.setItem(TOKEN_KEY, token);
  } else {
    window.localStorage.removeItem(TOKEN_KEY);
  }
};

export const buildUrl = (path: string) => {
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  const base = getApiBaseUrl();
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  if (!base) return normalizedPath;
  return `${base}${normalizedPath}`;
};

import { toast } from "vue-sonner";

export interface ApiRequestInit extends RequestInit {
  silent?: boolean;
}

let isHandling401 = false;
const recentToastMap = new Map<string, number>();

function showDebouncedErrorToast(msg: string) {
  if (!msg) return;
  const now = Date.now();
  const lastTime = recentToastMap.get(msg) || 0;
  if (now - lastTime < 3500) return; // Debounce identical error toasts for 3.5s
  recentToastMap.set(msg, now);
  toast.error(msg);
}

const parseResponse = async (response: Response, silent = false) => {
  const text = await response.text();
  let data: unknown = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error("Invalid JSON response from API");
  }

  if (!response.ok) {
    const errorData = data as { message?: unknown; errors?: Array<{ msg?: string }> };
    let message = errorData.message || response.statusText || "Request failed";

    if (errorData.errors && Array.isArray(errorData.errors) && errorData.errors.length > 0) {
      const details = errorData.errors.map(e => e.msg).filter(Boolean).join(", ");
      if (details) {
        message = `${message}: ${details}`;
      }
    }

    const errorMessage = typeof message === "string" ? message : JSON.stringify(message);

    // Handle 401 Session Expiration cleanly without flooding error toasts
    if (response.status === 401) {
      if (!isHandling401) {
        isHandling401 = true;
        saveToken(null);
        if (typeof window !== "undefined" && window.location.pathname !== "/login") {
          showDebouncedErrorToast("Your session has expired. Please log in again.");
          setTimeout(() => {
            window.location.href = "/login";
          }, 300);
        }
        setTimeout(() => { isHandling401 = false; }, 5000);
      }
    } else if (!silent) {
      showDebouncedErrorToast(errorMessage);
    }

    const error = new Error(errorMessage) as any;
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data as any;
};

// Smart Namespace-based Frontend API Cache & In-flight Request Deduplication
export type CacheNamespace = 'restaurant' | 'menu' | 'category' | 'user' | 'settings' | 'general';

interface CacheEntry {
  data: any;
  expiry: number;
  namespace: CacheNamespace;
}

const clientCache = new Map<string, CacheEntry>();
const inFlightRequests = new Map<string, Promise<any>>();

export const clearClientCache = () => {
  clientCache.clear();
  inFlightRequests.clear();
};

export const invalidateCacheNamespaces = (namespaces: (CacheNamespace | string)[]) => {
  const targets = new Set(namespaces.map(n => n.toLowerCase()));
  for (const [key, entry] of clientCache.entries()) {
    if (targets.has(entry.namespace) || Array.from(targets).some(t => key.toLowerCase().includes(`/api/${t}`))) {
      clientCache.delete(key);
    }
  }
};

export const fetchJson = async (path: string, init: ApiRequestInit = {}) => {
  const url = buildUrl(path);
  const headers = {
    "Content-Type": "application/json",
    ...(init.headers ?? {}),
  } as Record<string, string>;

  const response = await fetch(url, {
    ...init,
    headers,
  });

  return parseResponse(response, init.silent);
};

export const authFetch = async (path: string, init: ApiRequestInit = {}) => {
  const token = getStoredToken();
  const headers = {
    "Content-Type": "application/json",
    ...(init.headers ?? {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  } as Record<string, string>;

  // Deduplicate inflight GET requests
  const method = (init.method || "GET").toUpperCase();
  const isGet = method === "GET";
  const dedupeKey = `${path}::${token || ''}`;

  if (isGet && inFlightRequests.has(dedupeKey)) {
    return inFlightRequests.get(dedupeKey);
  }

  const fetchPromise = fetch(buildUrl(path), {
    ...init,
    headers,
  })
    .then((response) => parseResponse(response, init.silent))
    .finally(() => {
      if (isGet) {
        inFlightRequests.delete(dedupeKey);
      }
    });

  if (isGet) {
    inFlightRequests.set(dedupeKey, fetchPromise);
  }

  return fetchPromise;
};

// Caching wrapper with TTL, SWR (Stale-While-Revalidate) & Inflight Deduplication
export const cachedAuthFetch = async (
  path: string,
  init: ApiRequestInit = {},
  ttlSeconds = 60,
  namespace: CacheNamespace = 'general',
  swr = true
) => {
  const cacheKey = path;
  const now = Date.now();

  if (clientCache.has(cacheKey)) {
    const cached = clientCache.get(cacheKey)!;
    
    // Fresh cache hit: instant return
    if (now < cached.expiry) {
      return cached.data;
    }

    // Stale-While-Revalidate: return stale data immediately and refresh background
    if (swr && cached.data !== undefined) {
      // Background revalidation
      authFetch(path, { ...init, silent: true })
        .then((freshData) => {
          clientCache.set(cacheKey, {
            data: freshData,
            expiry: Date.now() + ttlSeconds * 1000,
            namespace,
          });
        })
        .catch(() => {
          // Stale cache remains on network glitch
        });
      return cached.data;
    }

    clientCache.delete(cacheKey);
  }

  // Fetch & prime cache
  const data = await authFetch(path, init);
  clientCache.set(cacheKey, {
    data,
    expiry: Date.now() + ttlSeconds * 1000,
    namespace,
  });
  return data;
};

export const loginUser = async (email: string, password: string) => {
  return fetchJson("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
};

export const sendOtp = async (email: string, purpose: 'login' | 'registration' = 'login') => {
  return fetchJson("/api/auth/send-otp", {
    method: "POST",
    body: JSON.stringify({ email, purpose }),
  });
};

export const verifyOtp = async (email: string, otp: string, purpose: 'login' | 'registration' = 'login') => {
  return fetchJson("/api/auth/verify-otp", {
    method: "POST",
    body: JSON.stringify({ email, otp, purpose }),
  });
};

export const loginWithOtp = async (email: string, otp: string) => {
  return fetchJson("/api/auth/login-otp", {
    method: "POST",
    body: JSON.stringify({ email, otp }),
  });
};

export const signupUser = async (name: string, email: string, password: string, role: AppRole) => {
  return fetchJson("/api/auth/signup", {
    method: "POST",
    body: JSON.stringify({ name, email, password, role }),
  });
};

export const getCurrentUser = async () => {
  return authFetch("/api/auth/me", {
    method: "GET",
  });
};

export const updateUser = async (userId: string, data: Partial<BackendUser>) => {
  const res = await authFetch(`/api/users/${userId}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
  invalidateCacheNamespaces(['user']);
  return res;
};

export const adminCreateUser = async (data: {
  name: string;
  email: string;
  password?: string;
  role: AppRole;
  restaurantId?: string;
  phone?: string;
  location?: string;
  otp?: string;
}) => {
  const res = await authFetch("/api/users", {
    method: "POST",
    body: JSON.stringify(data),
  });
  invalidateCacheNamespaces(['user']);
  return res;
};

export const resendUserOtp = async (userId: string) => {
  return authFetch(`/api/users/${userId}/resend-otp`, {
    method: "POST",
  });
};

// Restaurant APIs
export const getRestaurants = async (silent = false) => {
  return cachedAuthFetch("/api/restaurants", { method: "GET", silent }, 300, 'restaurant', true);
};

export const createRestaurant = async (data: {
  name: string;
  location: string;
  phone: string;
  email?: string;
  description?: string;
}) => {
  const res = await authFetch("/api/restaurants", {
    method: "POST",
    body: JSON.stringify(data),
  });
  invalidateCacheNamespaces(['restaurant']);
  return res;
};

export const getRestaurantById = async (restaurantId: string, silent = false) => {
  return cachedAuthFetch(`/api/restaurants/${restaurantId}`, { method: "GET", silent }, 300, 'restaurant', true);
};

export const updateRestaurant = async (restaurantId: string, data: Record<string, unknown>) => {
  const res = await authFetch(`/api/restaurants/${restaurantId}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
  invalidateCacheNamespaces(['restaurant']);
  return res;
};

export const deleteRestaurant = async (restaurantId: string) => {
  const res = await authFetch(`/api/restaurants/${restaurantId}`, { method: "DELETE" });
  invalidateCacheNamespaces(['restaurant', 'menu', 'category', 'user']);
  return res;
};

// Menu APIs
export const getMenuItems = async (restaurantId: string, page = 1, limit = 500) => {
  return cachedAuthFetch(`/api/menu/restaurant/${restaurantId}?page=${page}&limit=${limit}`, {
    method: "GET",
  }, 180, 'menu', true); // 3 minutes TTL with Stale-While-Revalidate
};

export const createMenuItem = async (data: {
  restaurantId: string;
  name: string;
  price: number;
  category?: string;
  categoryId?: string;
  description?: string;
  isAvailable?: boolean;
  fulfillmentOwner?: "KITCHEN" | "WAITER";
}) => {
  const res = await authFetch("/api/menu", {
    method: "POST",
    body: JSON.stringify(data),
  });
  invalidateCacheNamespaces(['menu', 'category']);
  return res;
};

export const updateMenuItem = async (menuItemId: string, data: Record<string, unknown>) => {
  const res = await authFetch(`/api/menu/${menuItemId}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
  invalidateCacheNamespaces(['menu', 'category']);
  return res;
};

export const deleteMenuItem = async (menuItemId: string) => {
  const res = await authFetch(`/api/menu/${menuItemId}`, { method: "DELETE" });
  invalidateCacheNamespaces(['menu', 'category']);
  return res;
};

// Category APIs
export type MenuCategory = {
  _id: string;
  id?: string;
  restaurantId: string;
  name: string;
  description?: string;
  icon?: string;
  displayOrder: number;
  isActive: boolean;
  itemCount?: number;
  availableItemCount?: number;
};

export const getCategoriesByRestaurant = async (restaurantId: string) => {
  return cachedAuthFetch(`/api/categories/restaurant/${restaurantId}`, { method: "GET" }, 300, 'category', true);
};

export const getPublicCategoriesByRestaurant = async (restaurantId: string) => {
  return fetchJson(`/api/categories/public/restaurant/${restaurantId}`, { method: "GET" });
};

export const createCategory = async (data: {
  restaurantId: string;
  name: string;
  description?: string;
  icon?: string;
  isActive?: boolean;
}) => {
  const res = await authFetch("/api/categories", {
    method: "POST",
    body: JSON.stringify(data),
  });
  invalidateCacheNamespaces(['category', 'menu']);
  return res;
};

export const updateCategory = async (categoryId: string, data: Partial<MenuCategory>) => {
  const res = await authFetch(`/api/categories/${categoryId}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
  invalidateCacheNamespaces(['category', 'menu']);
  return res;
};

export const deleteCategory = async (categoryId: string) => {
  const res = await authFetch(`/api/categories/${categoryId}`, { method: "DELETE" });
  invalidateCacheNamespaces(['category', 'menu']);
  return res;
};

export const reorderCategories = async (restaurantId: string, categoryIds: string[]) => {
  const res = await authFetch(`/api/categories/restaurant/${restaurantId}/reorder`, {
    method: "PUT",
    body: JSON.stringify({ categoryIds }),
  });
  invalidateCacheNamespaces(['category', 'menu']);
  return res;
};

// Order APIs (Strict Live / No Stale Cache for 100% Real-Time Accuracy)
export const getOrders = async (restaurantId: string, page = 1, limit = 20, status?: string, silent = false) => {
  let url = `/api/orders/restaurant/${restaurantId}?page=${page}&limit=${limit}`;
  if (status) {
    url += `&status=${status}`;
  }
  return authFetch(url, {
    method: "GET",
    silent,
  });
};

export const getOrdersByTable = async (
  restaurantId: string,
  tableNumber: number,
  page = 1,
  limit = 20,
) => {
  return authFetch(
    `/api/orders/restaurant/${restaurantId}/table/${tableNumber}?page=${page}&limit=${limit}`,
    {
      method: "GET",
    }
  );
};

export const createOrder = async (data: {
  restaurantId: string;
  tableNumber?: string | number;
  orderType?: 'DINE_IN' | 'PARCEL';
  customerName?: string;
  customerPhone?: string;
  notes?: string;
  items: Array<{ menuItemId: string; quantity: number; specialInstructions?: string }>;
}) => {
  return authFetch("/api/orders", {
    method: "POST",
    body: JSON.stringify(data),
  });
};

export const addItemToOrder = async (
  orderId: string,
  menuItemId: string,
  quantity: number,
  specialInstructions?: string,
) => {
  return authFetch(`/api/orders/${orderId}/items`, {
    method: "POST",
    body: JSON.stringify({ menuItemId, quantity, specialInstructions }),
  });
};

export const updateOrderStatus = async (
  orderId: string,
  status: string,
  kitchenBatch?: string,
  itemIds?: string[],
) => {
  return authFetch(`/api/orders/${orderId}/status`, {
    method: "PUT",
    body: JSON.stringify({ status, kitchenBatch, itemIds }),
  });
};

export const updateOrderItemQuantity = async (
  orderId: string,
  itemId: string,
  quantity: number
) => {
  return authFetch(`/api/orders/${orderId}/items/${itemId}`, {
    method: "PUT",
    body: JSON.stringify({ quantity }),
  });
};

export const removeItemFromOrder = async (orderId: string, itemId: string) => {
  return authFetch(`/api/orders/${orderId}/items/${itemId}`, {
    method: "DELETE",
  });
};

export const batchUpdateOrderItems = async (
  orderId: string,
  payload: {
    itemsToUpdate?: { id: string; qty: number; specialInstructions?: string }[];
    itemsToAdd?: { menuItemId: string; qty: number; specialInstructions?: string }[];
    itemIdsToDelete?: string[];
    notes?: string;
  }
) => {
  return authFetch(`/api/orders/${orderId}/batch-items`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
};

export const completeOrder = async (orderId: string) => {
  return authFetch(`/api/orders/${orderId}/complete`, {
    method: "PUT",
  });
};

export const cancelOrder = async (orderId: string, reason: string) => {
  return authFetch(`/api/orders/${orderId}/cancel`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
};

export const createPayment = async (data: {
  orderId: string;
  subtotal: number;
  discount?: number;
  paymentMethod: "CASH" | "CARD" | "DIGITAL_WALLET" | "CHEQUE";
  sendWhatsAppBill?: boolean;
  customerPhone?: string;
  customerName?: string;
  clientBaseUrl?: string;
}) => {
  const payload = {
    ...data,
    clientBaseUrl: data.clientBaseUrl || (typeof window !== "undefined" ? window.location.origin : undefined),
  };
  return authFetch("/api/payments", {
    method: "POST",
    body: JSON.stringify(payload),
  });
};

export const getPayments = async (restaurantId: string, page = 1, limit = 1000, silent = false) => {
  return authFetch(`/api/payments/restaurant/${restaurantId}?page=${page}&limit=${limit}`, {
    method: "GET",
    silent,
  });
};

export const refundPayment = async (paymentId: string, reason: string) => {
  return authFetch(`/api/payments/${paymentId}/refund`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
};

// User/Staff APIs
export const getUsersByRestaurant = async (restaurantId: string, page = 1, limit = 20, silent = false) => {
  return cachedAuthFetch(`/api/users/restaurant/${restaurantId}?page=${page}&limit=${limit}`, {
    method: "GET",
    silent,
  }, 30, 'user', true);
};

export const getAllUsers = async (page = 1, limit = 20, silent = false) => {
  return cachedAuthFetch(`/api/users?page=${page}&limit=${limit}`, { method: "GET", silent }, 30, 'user', true);
};

export const deactivateUser = async (userId: string) => {
  const res = await authFetch(`/api/users/${userId}/deactivate`, {
    method: "PUT",
  });
  invalidateCacheNamespaces(['user']);
  return res;
};

export const activateUser = async (userId: string) => {
  const res = await authFetch(`/api/users/${userId}/activate`, {
    method: "PUT",
  });
  invalidateCacheNamespaces(['user']);
  return res;
};

export const deleteUser = async (userId: string) => {
  const res = await authFetch(`/api/users/${userId}`, { method: "DELETE" });
  invalidateCacheNamespaces(['user']);
  return res;
};

// System Settings & Logs APIs
export const getSystemSettings = async () => {
  return cachedAuthFetch("/api/settings", { method: "GET" }, 600, 'settings', true);
};

export const updateSystemSettings = async (data: Record<string, unknown>) => {
  const res = await authFetch("/api/settings", {
    method: "PUT",
    body: JSON.stringify(data),
  });
  invalidateCacheNamespaces(['settings']);
  return res;
};

export const getSystemLogs = async (type = "info", limit = 100) => {
  return authFetch(`/api/settings/logs?type=${type}&limit=${limit}`, { method: "GET" });
};

// Waiting Queue APIs (Real-time live state)
export type WaitingQueueEntry = {
  _id: string;
  id?: string;
  restaurantId: string;
  queueNumber?: number;
  customerName: string;
  customerPhone?: string;
  partySize: number;
  notes?: string;
  status: 'WAITING' | 'CALLED' | 'SEATED' | 'CANCELLED';
  assignedTable?: number | null;
  priority?: 'NORMAL' | 'VIP' | 'HIGH';
  estimatedWaitMinutes?: number;
  calledAt?: string | null;
  seatedAt?: string | null;
  cancelledAt?: string | null;
  createdBy?: any;
  createdAt: string;
  updatedAt: string;
};

export const getWaitingQueue = async (restaurantId: string, status?: string, all = false, silent = false) => {
  let url = `/api/waiting-queue/restaurant/${restaurantId}?all=${all}`;
  if (status) {
    url += `&status=${status}`;
  }
  return authFetch(url, { method: "GET", silent });
};

export const addToWaitingQueue = async (data: {
  restaurantId?: string;
  customerName: string;
  customerPhone?: string;
  partySize: number;
  notes?: string;
  priority?: 'NORMAL' | 'VIP' | 'HIGH';
  estimatedWaitMinutes?: number;
}) => {
  return authFetch("/api/waiting-queue", {
    method: "POST",
    body: JSON.stringify(data),
  });
};

export const updateWaitingQueueEntry = async (id: string, data: Partial<WaitingQueueEntry>) => {
  return authFetch(`/api/waiting-queue/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
};

export const seatWaitingCustomer = async (id: string, tableNumber: number) => {
  return authFetch(`/api/waiting-queue/${id}/seat`, {
    method: "PUT",
    body: JSON.stringify({ tableNumber }),
  });
};

export const deleteWaitingQueueEntry = async (id: string) => {
  return authFetch(`/api/waiting-queue/${id}`, {
    method: "DELETE",
  });
};

// Non-blocking dashboard prefetch to instantly warm client cache upon login
export const prefetchDashboardData = (user: BackendUser) => {
  if (!user) return;
  const restaurantId = typeof user.restaurantId === 'string'
    ? user.restaurantId
    : (user.restaurantId as any)?.id || (user.restaurantId as any)?._id;

  try {
    const role = user.role?.toLowerCase();
    if (role === 'waiter' && restaurantId) {
      getRestaurantById(restaurantId, true);
      getMenuItems(restaurantId);
      getCategoriesByRestaurant(restaurantId);
      getOrders(restaurantId, 1, 100, undefined, true);
      getWaitingQueue(restaurantId, undefined, false, true);
    } else if (role === 'cashier' && restaurantId) {
      getRestaurantById(restaurantId, true);
      getMenuItems(restaurantId, 1, 500);
      getCategoriesByRestaurant(restaurantId);
      getOrders(restaurantId, 1, 100, undefined, true);
      getPayments(restaurantId, 1, 50, true);
      getWaitingQueue(restaurantId, undefined, false, true);
    } else if (role === 'chef' && restaurantId) {
      getMenuItems(restaurantId, 1, 500);
      getCategoriesByRestaurant(restaurantId);
      getOrders(restaurantId, 1, 100, undefined, true);
    } else if (role === 'restaurant_admin' && restaurantId) {
      getRestaurantById(restaurantId, true);
      getUsersByRestaurant(restaurantId, 1, 100, true);
      getOrders(restaurantId, 1, 100, undefined, true);
      getPayments(restaurantId, 1, 100, true);
    } else if (role === 'main_admin') {
      getRestaurants(true);
      getAllUsers(1, 1000, true);
      getOrders('all', 1, 500, undefined, true);
      getPayments('all', 1, 500, true);
    }
  } catch {
    // Non-blocking prefetch; errors handled on component mount
  }
};

// ── WhatsApp APIs ─────────────────────────────────────────────────────────────
export interface WhatsAppDeliveryInfo {
  _id?: string;
  id?: string;
  restaurantId: string;
  orderId: string;
  paymentId: string;
  receiptNumber: string;
  customerName?: string;
  recipientPhone: string;
  formattedPhone?: string;
  deliveryMethod: 'AUTOMATIC' | 'MANUAL_WAME';
  deliveryStatus: 'PENDING' | 'PROCESSING' | 'ACCEPTED' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED';
  providerMessageId?: string;
  errorCode?: string;
  errorMessage?: string;
  retryCount: number;
  pdfUrl?: string;
  sentAt?: string;
  deliveredAt?: string;
  readAt?: string;
  failedAt?: string;
  manualConfirmedAt?: string;
}

export const sendWhatsAppBill = async (data: {
  paymentId: string;
  customerPhone?: string;
  customerName?: string;
  forceRetry?: boolean;
  clientBaseUrl?: string;
}) => {
  const payload = {
    ...data,
    clientBaseUrl: data.clientBaseUrl || (typeof window !== "undefined" ? window.location.origin : undefined),
  };
  return authFetch("/api/whatsapp/send-bill", {
    method: "POST",
    body: JSON.stringify(payload),
  });
};

export const getWhatsAppDeliveryStatus = async (paymentId: string) => {
  return authFetch(`/api/whatsapp/delivery-status/${paymentId}`, {
    method: "GET",
  });
};

export const confirmManualWhatsAppSend = async (data: {
  paymentId: string;
  notes?: string;
}) => {
  return authFetch("/api/whatsapp/confirm-manual", {
    method: "POST",
    body: JSON.stringify(data),
  });
};

export const getWhatsAppConfig = async (restaurantId: string) => {
  return authFetch(`/api/whatsapp/config/${restaurantId}`, {
    method: "GET",
  });
};

export const updateWhatsAppConfig = async (restaurantId: string, data: any) => {
  return authFetch(`/api/whatsapp/config/${restaurantId}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
};

export const testWhatsAppConnection = async (restaurantId: string) => {
  return authFetch(`/api/whatsapp/config/${restaurantId}/test`, {
    method: "POST",
  });
};

// ── HOTEL ROOM MANAGEMENT API ───────────────────────────────────────────────

export const toggleHotelFacility = async (restaurantId: string, isEnabled: boolean) => {
  return authFetch(`/api/hotel/facility/${restaurantId}`, {
    method: "PATCH",
    body: JSON.stringify({ isEnabled }),
  });
};

export const getHotelFacilityStatus = async (restaurantId?: string) => {
  const url = restaurantId ? `/api/hotel/facility-status/${restaurantId}` : `/api/hotel/facility-status`;
  return authFetch(url, {
    method: "GET",
  });
};

export const getHotelRoomTypes = async (restaurantId?: string, activeOnly = false) => {
  const query = new URLSearchParams();
  if (restaurantId) query.append("restaurantId", restaurantId);
  if (activeOnly) query.append("activeOnly", "true");
  const qs = query.toString();
  return authFetch(`/api/hotel/room-types${qs ? `?${qs}` : ""}`, {
    method: "GET",
  });
};

export const createHotelRoomType = async (data: any, restaurantId?: string) => {
  const payload = restaurantId ? { ...data, restaurantId } : data;
  return authFetch("/api/hotel/room-types", {
    method: "POST",
    body: JSON.stringify(payload),
  });
};

export const updateHotelRoomType = async (id: string, data: any, restaurantId?: string) => {
  const payload = restaurantId ? { ...data, restaurantId } : data;
  return authFetch(`/api/hotel/room-types/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
};

export const toggleHotelRoomType = async (id: string, restaurantId?: string) => {
  const query = restaurantId ? `?restaurantId=${restaurantId}` : "";
  return authFetch(`/api/hotel/room-types/${id}/toggle${query}`, {
    method: "PATCH",
  });
};

export const getHotelRooms = async (params: any = {}, restaurantId?: string) => {
  const query = new URLSearchParams();
  if (restaurantId) query.append("restaurantId", restaurantId);
  Object.keys(params).forEach((k) => {
    if (params[k] !== undefined && params[k] !== null && params[k] !== "") {
      query.append(k, String(params[k]));
    }
  });
  const qs = query.toString();
  return authFetch(`/api/hotel/rooms${qs ? `?${qs}` : ""}`, {
    method: "GET",
  });
};

export const getHotelRoomById = async (id: string, restaurantId?: string) => {
  const query = restaurantId ? `?restaurantId=${restaurantId}` : "";
  return authFetch(`/api/hotel/rooms/${id}${query}`, {
    method: "GET",
  });
};

export const createHotelRoom = async (data: any, restaurantId?: string) => {
  const payload = restaurantId ? { ...data, restaurantId } : data;
  return authFetch("/api/hotel/rooms", {
    method: "POST",
    body: JSON.stringify(payload),
  });
};

export const updateHotelRoom = async (id: string, data: any, restaurantId?: string) => {
  const payload = restaurantId ? { ...data, restaurantId } : data;
  return authFetch(`/api/hotel/rooms/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
};

export const toggleHotelRoom = async (id: string, restaurantId?: string) => {
  const query = restaurantId ? `?restaurantId=${restaurantId}` : "";
  return authFetch(`/api/hotel/rooms/${id}/toggle${query}`, {
    method: "PATCH",
  });
};

export const deleteHotelRoom = async (id: string, restaurantId?: string) => {
  const query = restaurantId ? `?restaurantId=${restaurantId}` : "";
  return authFetch(`/api/hotel/rooms/${id}${query}`, {
    method: "DELETE",
  });
};

export const updateRoomHousekeeping = async (
  id: string,
  status: 'AVAILABLE' | 'CLEANING' | 'MAINTENANCE',
  maintenanceReason = '',
  restaurantId?: string
) => {
  const payload = { status, maintenanceReason, ...(restaurantId ? { restaurantId } : {}) };
  return authFetch(`/api/hotel/rooms/${id}/housekeeping`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
};

export const checkHotelAvailability = async (params: {
  checkInDate: string;
  checkOutDate: string;
  roomTypeId?: string;
  restaurantId?: string;
}) => {
  const query = new URLSearchParams();
  query.append("checkInDate", params.checkInDate);
  query.append("checkOutDate", params.checkOutDate);
  if (params.roomTypeId) query.append("roomTypeId", params.roomTypeId);
  if (params.restaurantId) query.append("restaurantId", params.restaurantId);
  return authFetch(`/api/hotel/availability?${query.toString()}`, {
    method: "GET",
  });
};

export const getHotelBookings = async (params: any = {}, restaurantId?: string) => {
  const query = new URLSearchParams();
  if (restaurantId) query.append("restaurantId", restaurantId);
  Object.keys(params).forEach((k) => {
    if (params[k] !== undefined && params[k] !== null && params[k] !== "") {
      query.append(k, String(params[k]));
    }
  });
  return authFetch(`/api/hotel/bookings?${query.toString()}`, {
    method: "GET",
  });
};

export const getHotelBookingById = async (id: string, restaurantId?: string) => {
  const query = restaurantId ? `?restaurantId=${restaurantId}` : "";
  return authFetch(`/api/hotel/bookings/${id}${query}`, {
    method: "GET",
  });
};

export const createHotelBooking = async (data: any, restaurantId?: string) => {
  const payload = restaurantId ? { ...data, restaurantId } : data;
  return authFetch("/api/hotel/bookings", {
    method: "POST",
    body: JSON.stringify(payload),
  });
};

export const checkInHotelGuest = async (id: string, data: any = {}, restaurantId?: string) => {
  const payload = restaurantId ? { ...data, restaurantId } : data;
  return authFetch(`/api/hotel/bookings/${id}/checkin`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
};

export const extendHotelStay = async (id: string, data: { newCheckOutDate: string }, restaurantId?: string) => {
  const payload = restaurantId ? { ...data, restaurantId } : data;
  return authFetch(`/api/hotel/bookings/${id}/extend`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
};

export const addHotelCharge = async (id: string, data: { title: string; amount: number }, restaurantId?: string) => {
  const payload = restaurantId ? { ...data, restaurantId } : data;
  return authFetch(`/api/hotel/bookings/${id}/charges`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
};

export const checkoutHotelGuest = async (id: string, data: any = {}, restaurantId?: string) => {
  const payload = restaurantId ? { ...data, restaurantId } : data;
  return authFetch(`/api/hotel/bookings/${id}/checkout`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
};

export const cancelHotelBooking = async (id: string, reason: string, restaurantId?: string) => {
  const payload = { reason, ...(restaurantId ? { restaurantId } : {}) };
  return authFetch(`/api/hotel/bookings/${id}/cancel`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
};

export const getHotelInvoices = async (params: any = {}, restaurantId?: string) => {
  const query = new URLSearchParams();
  if (restaurantId) query.append("restaurantId", restaurantId);
  Object.keys(params).forEach((k) => {
    if (params[k] !== undefined && params[k] !== null && params[k] !== "") {
      query.append(k, String(params[k]));
    }
  });
  return authFetch(`/api/hotel/invoices?${query.toString()}`, {
    method: "GET",
  });
};

export const getHotelInvoiceById = async (id: string, restaurantId?: string) => {
  const query = restaurantId ? `?restaurantId=${restaurantId}` : "";
  return authFetch(`/api/hotel/invoices/${id}${query}`, {
    method: "GET",
  });
};

export const getHotelDashboardStats = async (restaurantId?: string) => {
  const query = restaurantId ? `?restaurantId=${restaurantId}` : "";
  return authFetch(`/api/hotel/dashboard${query}`, {
    method: "GET",
  });
};

export const getHotelReports = async (params: any = {}, restaurantId?: string) => {
  const query = new URLSearchParams();
  if (restaurantId) query.append("restaurantId", restaurantId);
  Object.keys(params).forEach((k) => {
    if (params[k] !== undefined && params[k] !== null && params[k] !== "") {
      query.append(k, String(params[k]));
    }
  });
  return authFetch(`/api/hotel/reports?${query.toString()}`, {
    method: "GET",
  });
};

export const getHotelInvoicePdfUrl = (id: string, restaurantId?: string) => {
  const base = getApiBaseUrl();
  const query = restaurantId ? `?restaurantId=${restaurantId}` : "";
  return `${base}/api/hotel/invoices/${id}/pdf${query}`;
};



