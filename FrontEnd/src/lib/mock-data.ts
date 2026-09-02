export const revenueData = [
  { day: "Mon", revenue: 4200, orders: 78 },
  { day: "Tue", revenue: 5100, orders: 92 },
  { day: "Wed", revenue: 4800, orders: 85 },
  { day: "Thu", revenue: 6300, orders: 110 },
  { day: "Fri", revenue: 8900, orders: 156 },
  { day: "Sat", revenue: 11200, orders: 198 },
  { day: "Sun", revenue: 9700, orders: 172 },
];

export const restaurants = [
  { id: 1, name: "Savoria Downtown", city: "New York", orders: 1240, revenue: 48200, status: "active" },
  { id: 2, name: "Bella Notte", city: "Chicago", orders: 980, revenue: 36100, status: "active" },
  { id: 3, name: "Tokyo Ember", city: "Los Angeles", orders: 1520, revenue: 62400, status: "active" },
  { id: 4, name: "Le Petit Jardin", city: "San Francisco", orders: 760, revenue: 31800, status: "pending" },
  { id: 5, name: "Spice Route", city: "Austin", orders: 1100, revenue: 41500, status: "active" },
];

export const users = [
  { id: 1, name: "Priya Sharma", email: "priya@savoria.app", role: "Restaurant Admin", restaurant: "Savoria Downtown" },
  { id: 2, name: "Diego Ramos", email: "diego@savoria.app", role: "Waiter", restaurant: "Savoria Downtown" },
  { id: 3, name: "Chef Hiroshi", email: "hiroshi@savoria.app", role: "Chef", restaurant: "Tokyo Ember" },
  { id: 4, name: "Maya Chen", email: "maya@savoria.app", role: "Cashier", restaurant: "Bella Notte" },
  { id: 5, name: "Sam Patel", email: "sam@savoria.app", role: "Waiter", restaurant: "Spice Route" },
];

export const menuCategories = ["Starters", "Mains", "Pizza", "Sushi", "Desserts", "Drinks"];

export const menuItems = [
  { id: 1, name: "Truffle Arancini", category: "Starters", price: 14, available: true, emoji: "🍙" },
  { id: 2, name: "Burrata Caprese", category: "Starters", price: 16, available: true, emoji: "🥗" },
  { id: 3, name: "Wagyu Burger", category: "Mains", price: 28, available: true, emoji: "🍔" },
  { id: 4, name: "Lobster Linguine", category: "Mains", price: 36, available: true, emoji: "🦞" },
  { id: 5, name: "Margherita", category: "Pizza", price: 18, available: true, emoji: "🍕" },
  { id: 6, name: "Tartufo Pizza", category: "Pizza", price: 24, available: false, emoji: "🍕" },
  { id: 7, name: "Salmon Nigiri", category: "Sushi", price: 12, available: true, emoji: "🍣" },
  { id: 8, name: "Dragon Roll", category: "Sushi", price: 22, available: true, emoji: "🍣" },
  { id: 9, name: "Tiramisu", category: "Desserts", price: 11, available: true, emoji: "🍰" },
  { id: 10, name: "Crème Brûlée", category: "Desserts", price: 12, available: true, emoji: "🍮" },
  { id: 11, name: "Espresso Martini", category: "Drinks", price: 14, available: true, emoji: "🍸" },
  { id: 12, name: "Yuzu Spritz", category: "Drinks", price: 13, available: true, emoji: "🍹" },
];

export const tables = Array.from({ length: 16 }, (_, i) => ({
  id: i + 1,
  number: i + 1,
  seats: [2, 4, 4, 6][i % 4],
  status: ["available", "occupied", "reserved", "available", "occupied"][i % 5] as
    | "available"
    | "occupied"
    | "reserved",
}));

export const kitchenOrders = [
  {
    id: "ORD-1042",
    table: 5,
    items: [
      { name: "Wagyu Burger", qty: 2 },
      { name: "Truffle Arancini", qty: 1 },
    ],
    placedAt: Date.now() - 4 * 60 * 1000,
    status: "preparing" as "pending" | "preparing" | "ready",
    priority: "high" as "low" | "medium" | "high",
  },
  {
    id: "ORD-1043",
    table: 12,
    items: [
      { name: "Lobster Linguine", qty: 1 },
      { name: "Burrata Caprese", qty: 2 },
      { name: "Yuzu Spritz", qty: 2 },
    ],
    placedAt: Date.now() - 9 * 60 * 1000,
    status: "preparing" as "pending" | "preparing" | "ready",
    priority: "medium" as "low" | "medium" | "high",
  },
  {
    id: "ORD-1044",
    table: 3,
    items: [
      { name: "Dragon Roll", qty: 1 },
      { name: "Salmon Nigiri", qty: 3 },
    ],
    placedAt: Date.now() - 1 * 60 * 1000,
    status: "pending" as "pending" | "preparing" | "ready",
    priority: "low" as "low" | "medium" | "high",
  },
  {
    id: "ORD-1045",
    table: 8,
    items: [
      { name: "Margherita", qty: 1 },
      { name: "Tiramisu", qty: 2 },
    ],
    placedAt: Date.now() - 14 * 60 * 1000,
    status: "ready" as "pending" | "preparing" | "ready",
    priority: "high" as "low" | "medium" | "high",
  },
];

export const completedOrders = [
  { id: "ORD-1038", table: 4, items: 5, subtotal: 84.5, server: "Diego R.", time: "12 min ago" },
  { id: "ORD-1039", table: 9, items: 3, subtotal: 56.0, server: "Sam P.", time: "18 min ago" },
  { id: "ORD-1040", table: 2, items: 7, subtotal: 142.0, server: "Diego R.", time: "22 min ago" },
  { id: "ORD-1041", table: 11, items: 4, subtotal: 98.25, server: "Lina K.", time: "27 min ago" },
];

export const transactions = [
  { id: "TXN-9821", order: "ORD-1037", amount: 124.5, method: "Card", time: "10:42 AM" },
  { id: "TXN-9820", order: "ORD-1036", amount: 68.0, method: "UPI", time: "10:31 AM" },
  { id: "TXN-9819", order: "ORD-1035", amount: 215.75, method: "Card", time: "10:18 AM" },
  { id: "TXN-9818", order: "ORD-1034", amount: 42.0, method: "Cash", time: "10:04 AM" },
  { id: "TXN-9817", order: "ORD-1033", amount: 187.5, method: "Card", time: "9:51 AM" },
];

export const hourlySales = [
  { h: "9am", sales: 240, orders: 6 },
  { h: "10am", sales: 410, orders: 11 },
  { h: "11am", sales: 680, orders: 19 },
  { h: "12pm", sales: 1240, orders: 34 },
  { h: "1pm", sales: 1580, orders: 41 },
  { h: "2pm", sales: 980, orders: 26 },
  { h: "3pm", sales: 520, orders: 14 },
  { h: "4pm", sales: 460, orders: 12 },
  { h: "5pm", sales: 720, orders: 18 },
  { h: "6pm", sales: 1320, orders: 32 },
  { h: "7pm", sales: 1780, orders: 44 },
  { h: "8pm", sales: 1640, orders: 39 },
  { h: "9pm", sales: 1120, orders: 27 },
  { h: "10pm", sales: 640, orders: 15 },
];

export const paymentMix = [
  { name: "Card", value: 58 },
  { name: "UPI", value: 24 },
  { name: "Cash", value: 12 },
  { name: "Wallet", value: 6 },
];

export const orderSourceMix = [
  { name: "Dine-in", value: 62 },
  { name: "Takeaway", value: 18 },
  { name: "Online", value: 14 },
  { name: "Delivery", value: 6 },
];

export const liveOrders = [
  { id: "ORD-1051", table: "T-04", customer: "Walk-in", amount: 84.5, status: "Preparing", kitchen: "Cooking", waiter: "Diego R.", time: "2m" },
  { id: "ORD-1050", table: "T-12", customer: "R. Alvarez", amount: 142.0, status: "New", kitchen: "Queued", waiter: "Sam P.", time: "3m" },
  { id: "ORD-1049", table: "T-07", customer: "M. Chen", amount: 56.0, status: "Served", kitchen: "Ready", waiter: "Lina K.", time: "6m" },
  { id: "ORD-1048", table: "T-02", customer: "Walk-in", amount: 38.0, status: "Preparing", kitchen: "Cooking", waiter: "Diego R.", time: "9m" },
  { id: "ORD-1047", table: "T-09", customer: "J. Patel", amount: 212.75, status: "Billing", kitchen: "Served", waiter: "Sam P.", time: "12m" },
  { id: "ORD-1046", table: "TA-21", customer: "Online", amount: 64.0, status: "Preparing", kitchen: "Cooking", waiter: "—", time: "14m" },
];

export const kitchenQueue = [
  { id: "ORD-1051", table: "T-04", items: 3, eta: 4, status: "Cooking", priority: "high" },
  { id: "ORD-1050", table: "T-12", items: 5, eta: 9, status: "Preparing", priority: "medium" },
  { id: "ORD-1048", table: "T-02", items: 2, eta: 2, status: "Cooking", priority: "low" },
  { id: "ORD-1046", table: "TA-21", items: 4, eta: 6, status: "Cooking", priority: "medium" },
  { id: "ORD-1045", table: "T-08", items: 3, eta: 0, status: "Ready", priority: "high" },
  { id: "ORD-1044", table: "T-03", items: 4, eta: -2, status: "Delayed", priority: "high" },
];

export const activityFeed = [
  { id: 1, who: "Chef Hiroshi", what: "marked Order #1045 as Ready", time: "just now", tone: "success" as const },
  { id: 2, who: "Diego R.", what: "assigned Table T-04", time: "1m ago", tone: "info" as const },
  { id: 3, who: "Cashier Maya", what: "generated bill #B-2208 · $124.50", time: "3m ago", tone: "primary" as const },
  { id: 4, who: "System", what: "received online order ORD-1046", time: "5m ago", tone: "info" as const },
  { id: 5, who: "Inventory", what: "low stock alert · Burrata (2 left)", time: "8m ago", tone: "warning" as const },
  { id: 6, who: "Sam P.", what: "served Table T-09", time: "11m ago", tone: "success" as const },
];

export const branches = [
  { id: "downtown", name: "Savoria Downtown", city: "New York" },
  { id: "tokyo-ember", name: "Tokyo Ember", city: "Los Angeles" },
  { id: "bella-notte", name: "Bella Notte", city: "Chicago" },
  { id: "spice-route", name: "Spice Route", city: "Austin" },
];

