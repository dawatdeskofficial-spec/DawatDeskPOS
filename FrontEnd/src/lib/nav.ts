import {
  BarChart3,
  BellRing,
  Building2,
  ChefHat,
  ClipboardList,
  CookingPot,
  CreditCard,
  FileText,
  LayoutDashboard,
  LineChart,
  Package,
  Receipt,
  Settings,
  ShieldAlert,
  ShoppingBag,
  Table2,
  Users,
  UtensilsCrossed,
  Wallet,
  Monitor,
} from "lucide-vue-next";

export interface NavItem {
  to: string;
  label: string;
  icon: any;
}

export const adminNav: NavItem[] = [
  { to: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/admin/restaurants", label: "Restaurants", icon: Building2 },
  { to: "/admin/users", label: "User Management", icon: Users },
  { to: "/admin/reports", label: "Reports", icon: FileText },
  { to: "/admin/logs", label: "System Logs", icon: ShieldAlert },
  { to: "/admin/settings", label: "Settings", icon: Settings },
];

export const restaurantNav: NavItem[] = [
  { to: "/restaurant/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/restaurant/orders", label: "Orders", icon: ShoppingBag },
  { to: "/restaurant/tables", label: "Tables", icon: Table2 },
  { to: "/restaurant/menu", label: "Menu", icon: UtensilsCrossed },
  { to: "/restaurant/staff", label: "Staff", icon: Users },
  { to: "/restaurant/reports", label: "Analytics", icon: BarChart3 },
];

export const waiterNav: NavItem[] = [
  { to: "/waiter", label: "Take Order", icon: ClipboardList },
];

export const chefNav: NavItem[] = [
  { to: "/chef", label: "Kitchen Display", icon: ChefHat },
];

export const cashierNav: NavItem[] = [
  { to: "/cashier", label: "Billing & POS", icon: Receipt },
];
