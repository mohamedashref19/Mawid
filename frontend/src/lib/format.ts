import type { BookingStatus, ItemType } from "@/lib/api";

export const STATUS_LABEL: Record<BookingStatus, string> = {
  pending: "قيد المراجعة",
  confirmed: "مؤكد",
  rejected: "مرفوض",
  attended: "تم الحضور",
};

export const TYPE_LABEL: Record<ItemType, string> = {
  event: "فعالية",
  course: "كورس",
};

const ar = "ar-EG";

export function formatPrice(n: number): string {
  return `${new Intl.NumberFormat(ar).format(n)} ج.م`;
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat(ar).format(n);
}

export function formatLongDate(iso: string): string {
  return new Intl.DateTimeFormat(ar, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(iso));
}

export function formatShortDate(iso: string): string {
  return new Intl.DateTimeFormat(ar, { day: "numeric", month: "short" }).format(new Date(iso));
}

export function formatTime(hhmm: string): string {
  const [h = 0, m = 0] = hhmm.split(":").map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return new Intl.DateTimeFormat(ar, { hour: "numeric", minute: "2-digit" }).format(d);
}

export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat(ar, {
    day: "numeric",
    month: "long",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}
