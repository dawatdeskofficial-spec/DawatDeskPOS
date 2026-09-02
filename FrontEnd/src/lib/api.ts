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

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:5001";
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

const buildUrl = (path: string) => {
  return path.startsWith("http") ? path : `${API_BASE_URL}${path}`;
};

import { toast } from "vue-sonner";

const parseResponse = async (response: Response) => {
  const text = await response.text();
  let data: unknown = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error("Invalid JSON response from API");
  }

  if (!response.ok) {
    const errorData = data as { message?: unknown; errors?: Array<{msg?: string}> };
    let message = errorData.message || response.statusText || "Request failed";
    
    if (errorData.errors && Array.isArray(errorData.errors) && errorData.errors.length > 0) {
      const details = errorData.errors.map(e => e.msg).filter(Boolean).join(", ");
      if (details) {
        message = `${message}: ${details}`;
      }
    }
    
    const errorMessage = typeof message === "string" ? message : JSON.stringify(message);
    
    // Show toast notification for API errors
    toast.error(errorMessage);
    
    throw new Error(errorMessage);
  }

  return data as any;
};

export const fetchJson = async (path: string, init: RequestInit = {}) => {
  const url = buildUrl(path);
  const headers = {
    "Content-Type": "application/json",
    ...(init.headers ?? {}),
  } as Record<string, string>;

  const response = await fetch(url, {
    ...init,
    headers,
  });

  return parseResponse(response);
};

export const authFetch = async (path: string, init: RequestInit = {}) => {
  const token = getStoredToken();
  const headers = {
    "Content-Type": "application/json",
    ...(init.headers ?? {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  } as Record<string, string>;

  const response = await fetch(buildUrl(path), {
    ...init,
    headers,
  });

  return parseResponse(response);
};

export const loginUser = async (email: string, password: string) => {
  return fetchJson("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
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
  return authFetch(`/api/users/${userId}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
};

export const adminCreateUser = async (data: {
  name: string;
  email: string;
  password?: string;
  role: AppRole;
  restaurantId?: string;
}) => {
  return authFetch("/api/users", {
    method: "POST",
    body: JSON.stringify(data),
  });
};

// Restaurant APIs
export const getRestaurants = async () => {
  return authFetch("/api/restaurants", { method: "GET" });
};

export const createRestaurant = async (data: {
  name: string;
  location: string;
  phone: string;
  email?: string;
  description?: string;
}) => {
  return authFetch("/api/restaurants", {
    method: "POST",
    body: JSON.stringify(data),
  });
};

export const getRestaurantById = async (restaurantId: string) => {
  return authFetch(`/api/restaurants/${restaurantId}`, { method: "GET" });
};

export const updateRestaurant = async (restaurantId: string, data: Record<string, unknown>) => {
  return authFetch(`/api/restaurants/${restaurantId}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
};

export const deleteRestaurant = async (restaurantId: string) => {
  return authFetch(`/api/restaurants/${restaurantId}`, { method: "DELETE" });
};

// Menu APIs
export const getMenuItems = async (restaurantId: string, page = 1, limit = 500) => {
  return authFetch(`/api/menu/restaurant/${restaurantId}?page=${page}&limit=${limit}`, {
    method: "GET",
  });
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
  return authFetch("/api/menu", {
    method: "POST",
    body: JSON.stringify(data),
  });
};

export const updateMenuItem = async (menuItemId: string, data: Record<string, unknown>) => {
  return authFetch(`/api/menu/${menuItemId}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
};

export const deleteMenuItem = async (menuItemId: string) => {
  return authFetch(`/api/menu/${menuItemId}`, { method: "DELETE" });
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
  return authFetch(`/api/categories/restaurant/${restaurantId}`, { method: "GET" });
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
  return authFetch("/api/categories", {
    method: "POST",
    body: JSON.stringify(data),
  });
};

export const updateCategory = async (categoryId: string, data: Partial<MenuCategory>) => {
  return authFetch(`/api/categories/${categoryId}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
};

export const deleteCategory = async (categoryId: string) => {
  return authFetch(`/api/categories/${categoryId}`, { method: "DELETE" });
};

export const reorderCategories = async (restaurantId: string, categoryIds: string[]) => {
  return authFetch(`/api/categories/restaurant/${restaurantId}/reorder`, {
    method: "PUT",
    body: JSON.stringify({ categoryIds }),
  });
};

// Order APIs
export const getOrders = async (restaurantId: string, page = 1, limit = 20, status?: string) => {
  let url = `/api/orders/restaurant/${restaurantId}?page=${page}&limit=${limit}`;
  if (status) {
    url += `&status=${status}`;
  }
  return authFetch(url, {
    method: "GET",
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
    },
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
}) => {
  return authFetch("/api/payments", {
    method: "POST",
    body: JSON.stringify(data),
  });
};

export const getPayments = async (restaurantId: string, page = 1, limit = 1000) => {
  return authFetch(`/api/payments/restaurant/${restaurantId}?page=${page}&limit=${limit}`, {
    method: "GET",
  });
};

export const refundPayment = async (paymentId: string, reason: string) => {
  return authFetch(`/api/payments/${paymentId}/refund`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
};

// User/Staff APIs
export const getUsersByRestaurant = async (restaurantId: string, page = 1, limit = 20) => {
  return authFetch(`/api/users/restaurant/${restaurantId}?page=${page}&limit=${limit}`, {
    method: "GET",
  });
};

export const getAllUsers = async (page = 1, limit = 20) => {
  return authFetch(`/api/users?page=${page}&limit=${limit}`, { method: "GET" });
};

export const deactivateUser = async (userId: string) => {
  return authFetch(`/api/users/${userId}/deactivate`, {
    method: "PUT",
  });
};

export const activateUser = async (userId: string) => {
  return authFetch(`/api/users/${userId}/activate`, {
    method: "PUT",
  });
};

export const deleteUser = async (userId: string) => {
  return authFetch(`/api/users/${userId}`, { method: "DELETE" });
};

// System Settings & Logs APIs
export const getSystemSettings = async () => {
  return authFetch("/api/settings", { method: "GET" });
};

export const updateSystemSettings = async (data: Record<string, unknown>) => {
  return authFetch("/api/settings", {
    method: "PUT",
    body: JSON.stringify(data),
  });
};

export const getSystemLogs = async (type = "info", limit = 100) => {
  return authFetch(`/api/settings/logs?type=${type}&limit=${limit}`, { method: "GET" });
};

// Waiting Queue APIs
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

export const getWaitingQueue = async (restaurantId: string, status?: string, all = false) => {
  let url = `/api/waiting-queue/restaurant/${restaurantId}?all=${all}`;
  if (status) {
    url += `&status=${status}`;
  }
  return authFetch(url, { method: "GET" });
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

