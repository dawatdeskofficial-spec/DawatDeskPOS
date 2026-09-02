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
