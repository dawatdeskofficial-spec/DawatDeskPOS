import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const formatINR = (n: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);

export const shortId = (id: string) => {
  if (!id) return "000000";
  return String(id).slice(-6).toUpperCase();
};

export const formatTimeSafe = (dateString: string | undefined | null) => {
  if (!dateString || dateString.toLowerCase() === "unknown") return "N/A";
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return "N/A";
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

export const formatDateSafe = (dateString: string | undefined | null) => {
  if (!dateString || dateString.toLowerCase() === "unknown") return "N/A";
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return "N/A";
  return d.toLocaleString();
};

export interface ConsolidatedOrderItem {
  id?: string;
  itemIds?: string[];
  name: string;
  price: number;
  qty: number;
  status?: string;
  notes?: string;
  category?: string;
  emoji?: string;
  menuItemId?: any;
  [key: string]: any;
}

/**
 * Consolidates duplicate order items by matching dish name / ID,
 * combining their quantities so each dish only appears once with its total quantity.
 */
export function consolidateOrderItems(items: any[] | null | undefined): ConsolidatedOrderItem[] {
  if (!items || !Array.isArray(items) || items.length === 0) return [];

  const map = new Map<string, ConsolidatedOrderItem>();

  for (const item of items) {
    if (!item) continue;
    const name = String(
      item.name || 
      item.dishName || 
      item.itemName || 
      (typeof item.menuItemId === 'object' && item.menuItemId?.name ? item.menuItemId.name : '') || 
      'Item'
    ).trim();
    const qty = Number(item.qty ?? item.quantity ?? 1);
    const price = Number(
      item.price ?? 
      item.unitPrice ?? 
      (typeof item.menuItemId === 'object' && item.menuItemId?.price ? item.menuItemId.price : 0)
    );
    const status = item.status ? String(item.status).toUpperCase() : '';
    const itemId = item.id || item._id;

    // Group identical items by normalized name + status
    const key = `${name.toLowerCase()}__${status}`;

    if (map.has(key)) {
      const existing = map.get(key)!;
      existing.qty += qty;
      if (itemId && !existing.itemIds?.includes(itemId)) {
        existing.itemIds?.push(itemId);
      }
      const note = (item.notes || item.specialInstructions || item.note || '').trim();
      if (note && !existing.notes?.includes(note)) {
        existing.notes = existing.notes ? `${existing.notes}, ${note}` : note;
      }
    } else {
      map.set(key, {
        ...item,
        id: itemId,
        itemIds: itemId ? [itemId] : [],
        name,
        qty: qty || 1,
        price,
        status: item.status,
        notes: (item.notes || item.specialInstructions || item.note || '').trim(),
      });
    }
  }

  return Array.from(map.values());
}
