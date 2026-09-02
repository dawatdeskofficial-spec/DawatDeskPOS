import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import {
  loginUser,
  signupUser,
  getCurrentUser,
  updateUser as updateUserApi,
  saveToken,
} from '@/lib/api'

export type AppRole = "main_admin" | "restaurant_admin" | "waiter" | "chef" | "cashier";

const APP_ROLES = ["main_admin", "restaurant_admin", "waiter", "chef", "cashier"] as const;
export function isAppRole(value: unknown): value is AppRole {
  return typeof value === "string" && APP_ROLES.includes(value as AppRole);
}

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

const TOKEN_STORAGE_KEY = "SERVIA_AUTH_TOKEN";

function parseRole(value: unknown): AppRole | null {
  if (isAppRole(value)) return value;
  return null;
}

export const ROLE_LABELS: Record<AppRole, string> = {
  main_admin: "Main Admin",
  restaurant_admin: "Restaurant Admin",
  waiter: "Waiter",
  chef: "Chef",
  cashier: "Cashier",
};

export const ROLE_HOMES: Record<AppRole, string> = {
  main_admin: "/admin/dashboard",
  restaurant_admin: "/restaurant/dashboard",
  waiter: "/waiter",
  chef: "/chef",
  cashier: "/cashier",
};

export const useAuthStore = defineStore('auth', () => {
  const user = ref<BackendUser | null>(null);
  const role = ref<AppRole | null>(null);
  const loading = ref(true);

  async function initAuth() {
    const token = typeof window !== "undefined" ? window.localStorage.getItem(TOKEN_STORAGE_KEY) : null;
    if (!token) {
      loading.value = false;
      return;
    }

    try {
      const response = await getCurrentUser();
      const userData = response.data as BackendUser;
      user.value = userData;
      role.value = parseRole(userData.role);
    } catch (error) {
      console.error("Failed to refresh user:", error);
      saveToken(null);
      user.value = null;
      role.value = null;
    } finally {
      loading.value = false;
    }
  }

  async function signIn(email: string, password: string) {
    const response = await loginUser(email, password);
    const payload = response.data as { user: BackendUser; token: string };
    saveToken(payload.token);
    user.value = payload.user;
    role.value = parseRole(payload.user.role);
  }

  async function signUp(name: string, email: string, password: string, r: AppRole) {
    const response = await signupUser(name, email, password, r);
    const payload = response.data as { user: BackendUser; token: string };
    saveToken(payload.token);
    user.value = payload.user;
    role.value = parseRole(payload.user.role);
  }

  async function signOut() {
    saveToken(null);
    user.value = null;
    role.value = null;
  }

  async function refreshUser() {
    try {
      const response = await getCurrentUser();
      const userData = response.data as BackendUser;
      user.value = userData;
      role.value = parseRole(userData.role);
    } catch (error) {
      console.error("Refresh user failed:", error);
      saveToken(null);
      user.value = null;
      role.value = null;
    }
  }

  const inspectedRestaurantId = ref<string | null>(
    typeof window !== 'undefined' ? localStorage.getItem('INSPECTED_RESTAURANT_ID') : null
  );

  function setInspectedRestaurant(id: string | null) {
    inspectedRestaurantId.value = id;
    if (id) {
      localStorage.setItem('INSPECTED_RESTAURANT_ID', id);
    } else {
      localStorage.removeItem('INSPECTED_RESTAURANT_ID');
    }
  }

  const effectiveRestaurantId = computed(() => {
    if (role.value === 'main_admin' && inspectedRestaurantId.value) {
      return inspectedRestaurantId.value;
    }
    const r = user.value?.restaurantId;
    if (!r) return '';
    return typeof r === 'string' ? r : (r as any).id || (r as any)._id || '';
  });

  async function updateProfile(data: Partial<Pick<BackendUser, "name" | "phone" | "location">>) {
    if (!user.value) throw new Error("No authenticated user");
    const response = await updateUserApi(user.value.id, data);
    const updatedUser = response.data as BackendUser;
    user.value = updatedUser;
    role.value = parseRole(updatedUser.role);
  }

  return {
    user,
    role,
    loading,
    inspectedRestaurantId,
    effectiveRestaurantId,
    setInspectedRestaurant,
    initAuth,
    signIn,
    signUp,
    signOut,
    refreshUser,
    updateProfile
  };
})
