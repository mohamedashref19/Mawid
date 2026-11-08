// =====================================================================
// Maw'id / CTS — Real Backend API Layer (100% Connected to Express & MongoDB)
// =====================================================================

import axios from "axios";

export const BACKEND_URL = import.meta.env["VITE_BACKEND_URL"] || "http://127.0.0.1:5000";
export const API_URL = `${BACKEND_URL}/api/v1`;

const TOKEN_KEY = "mawid:token";
const USER_KEY = "mawid:user";
const SETTINGS_KEY = "mawid:settings";
const isServer = typeof window === "undefined";

const apiClient = axios.create({
  baseURL: API_URL,
  withCredentials: true,
});

apiClient.interceptors.request.use((config) => {
  if (!isServer) {
    const token = window.localStorage.getItem(TOKEN_KEY) || window.localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// ------------------------------- Types -------------------------------

export type Role = "user" | "employee" | "admin";
export type ItemType = "event" | "course";
export type AttendanceMode = "online" | "offline";
export type BookingStatus = "pending" | "confirmed" | "rejected" | "attended";
export type PaymentMethod = "wallet" | "instapay" | "link";

export interface User {
  id: string;
  name: string;
  phone: string;
  email?: string;
  role: Role;
}

export interface StaffAccount extends User {
  password: string;
}

export interface Item {
  id: string;
  type: ItemType;
  attendanceMode: AttendanceMode;
  title: string;
  description: string;
  image: string;
  date: string; // ISO yyyy-mm-dd
  time: string; // HH:mm
  location: string;
  price: number;
  capacity: number;
  paymentMethod: PaymentMethod;
  paymentTarget: string;
  accessLink?: string; // روابط الانضمام، كل رابط في سطر
  accessDetails?: string; // تفاصيل الكورس الأونلاين (نص)
}

export interface Booking {
  id: string;
  code: string;
  qrToken: string;
  itemId: string;
  userId: string;
  userName: string;
  userPhone: string;
  quantity: number;
  totalAmount: number;
  status: BookingStatus;
  paymentScreenshot: string;
  createdAt: string;
  rejectReason?: string;
  checkedInAt?: string;
  accessLink?: string;
  accessDetails?: string;
  attendanceMode?: AttendanceMode;
}

export interface AppSettings {
  instructions: string;
  transferPhone: string;
}

export interface Stats {
  pending: number;
  confirmed: number;
  revenue: number;
  upcoming: number;
}

export interface NewItemInput {
  type: ItemType;
  attendanceMode: AttendanceMode;
  title: string;
  description: string;
  image: string;
  date: string;
  time: string;
  location: string;
  price: number;
  capacity: number;
  paymentMethod: PaymentMethod;
  paymentTarget: string;
  accessLink?: string;
  accessDetails?: string;
}

export interface NewStaffInput {
  name: string;
  phone: string;
  email: string;
  password: string;
  role: Role;
}

// ------------------------- Raw Backend Types -------------------------

interface BackendUserRaw {
  _id?: string;
  id?: string;
  name: string;
  phone: string;
  email?: string;
  role: Role;
}

interface BackendEventRaw {
  _id?: string;
  id?: string;
  type: ItemType;
  attendanceMode?: AttendanceMode;
  title: string;
  description: string;
  image?: string;
  date: string;
  time: string;
  location: string;
  price: number;
  capacity: number;
  bookedSeats?: number;
  paymentMethod?: PaymentMethod;
  paymentTarget?: string;
  accessLink?: string;
  accessDetails?: string;
}

interface BackendBookingRaw {
  _id?: string;
  id?: string;
  user?: BackendUserRaw | string;
  event?: BackendEventRaw | string;
  paymentReceipt?: string;
  quantity?: number;
  amount: number;
  status: "pending" | "confirmed" | "rejected";
  rejectReason?: string;
  ticketCode: string;
  isScanned?: boolean;
  checkedInAt?: string;
  createdAt: string;
}

// ----------------------------- Helpers -------------------------------

const bookedSeatsCache = new Map<string, number>();

function mapBackendUser(u: BackendUserRaw): User {
  return {
    id: u._id || u.id || "",
    name: u.name,
    phone: u.phone,
    role: u.role,
    ...(u.email !== undefined ? { email: u.email } : {}),
  };
}

function normalizeTime(rawTime?: string): string {
  if (!rawTime) return "18:00";
  const t = rawTime.trim();

  const match24 = t.match(/^(\d{1,2}):(\d{2})$/);
  if (match24) {
    return `${match24[1]!.padStart(2, "0")}:${match24[2]}`;
  }

  const match12 = t.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (match12) {
    let hours = parseInt(match12[1]!, 10);
    const minutes = match12[2];
    const period = match12[3]!.toUpperCase();
    if (period === "PM" && hours < 12) hours += 12;
    if (period === "AM" && hours === 12) hours = 0;
    return `${String(hours).padStart(2, "0")}:${minutes}`;
  }

  return "18:00";
}

function mapBackendEvent(e: BackendEventRaw): Item {
  const id = e._id || e.id || "";
  bookedSeatsCache.set(id, e.bookedSeats ?? 0);

  let dateStr = "2026-12-01";
  if (e.date) {
    const parsedDate = new Date(e.date);
    if (!isNaN(parsedDate.getTime())) {
      dateStr = parsedDate.toISOString().slice(0, 10);
    }
  }

  const image =
    !e.image || e.image === "default-event.jpg"
      ? ""
      : e.image.startsWith("http") || e.image.startsWith("data:")
        ? e.image
        : `${BACKEND_URL}/uploads/${e.image}`;

  return {
    id,
    type: e.type,
    attendanceMode: e.type === "event" ? "offline" : e.attendanceMode || "offline",
    title: e.title,
    description: e.description,
    image,
    date: dateStr,
    time: normalizeTime(e.time),
    location: e.location,
    price: e.price,
    capacity: e.capacity,
    paymentMethod: e.paymentMethod || "wallet",
    paymentTarget: e.paymentTarget || "",
    ...(e.accessLink !== undefined ? { accessLink: e.accessLink } : {}),
    ...(e.accessDetails !== undefined ? { accessDetails: e.accessDetails } : {}),
  };
}

function mapBackendBooking(b: BackendBookingRaw): Booking {
  const id = b._id || b.id || "";
  const userObj = typeof b.user === "object" && b.user !== null ? b.user : null;
  const eventObj = typeof b.event === "object" && b.event !== null ? b.event : null;

  const userId = userObj
    ? userObj._id || userObj.id || ""
    : typeof b.user === "string"
      ? b.user
      : "";
  const itemId = eventObj
    ? eventObj._id || eventObj.id || ""
    : typeof b.event === "string"
      ? b.event
      : "";

  const status: BookingStatus = b.isScanned ? "attended" : b.status;
  const receiptUrl = b.paymentReceipt
    ? b.paymentReceipt.startsWith("http") || b.paymentReceipt.startsWith("data:")
      ? b.paymentReceipt
      : `${BACKEND_URL}/uploads/${b.paymentReceipt}`
    : "";

  const shortCode =
    "MW-" +
    (b.ticketCode
      ? b.ticketCode.replace(/-/g, "").slice(0, 6).toUpperCase()
      : id.slice(-6).toUpperCase());

  return {
    id,
    code: shortCode,
    qrToken: b.ticketCode || id,
    itemId,
    userId,
    userName: userObj?.name || "عميل",
    userPhone: userObj?.phone || "",
    quantity: b.quantity ?? 1,
    totalAmount: b.amount,
    status,
    paymentScreenshot: receiptUrl,
    createdAt: b.createdAt || new Date().toISOString(),
    ...(b.rejectReason !== undefined ? { rejectReason: b.rejectReason } : {}),
    ...(b.checkedInAt !== undefined ? { checkedInAt: b.checkedInAt } : {}),
    ...(eventObj?.accessLink !== undefined ? { accessLink: eventObj.accessLink } : {}),
    ...(eventObj?.accessDetails !== undefined ? { accessDetails: eventObj.accessDetails } : {}),
    ...(eventObj?.attendanceMode !== undefined ? { attendanceMode: eventObj.attendanceMode } : {}),
  };
}

function extractErrorMessage(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    return (err.response?.data as { message?: string } | undefined)?.message || fallback;
  }
  if (err instanceof Error) return err.message;
  return fallback;
}

function dataUrlToBlob(dataUrl: string): Blob {
  const parts = dataUrl.split(",");
  const meta = parts[0] || "";
  const base64Data = parts[1] || "";
  const mimeMatch = meta.match(/:(.*?);/);
  const mime = mimeMatch?.[1] ?? "image/jpeg";
  const byteString = atob(base64Data);
  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);
  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }
  return new Blob([ab], { type: mime });
}

// ------------------------------- Auth --------------------------------

function saveLocalUser(user: User): void {
  if (!isServer) {
    window.localStorage.setItem(USER_KEY, JSON.stringify(user));
  }
}

function meSync(): User | null {
  if (isServer) return null;
  const rawUser = window.localStorage.getItem(USER_KEY);
  if (rawUser) {
    try {
      return JSON.parse(rawUser) as User;
    } catch {
      return null;
    }
  }
  return null;
}

export async function me(): Promise<User | null> {
  if (isServer) return null;
  const token = window.localStorage.getItem(TOKEN_KEY) || window.localStorage.getItem("token");
  if (!token) return null;

  try {
    const res = await apiClient.get("/users/me");
    const user = mapBackendUser(res.data.data.user as BackendUserRaw);
    saveLocalUser(user);
    return user;
  } catch {
    return null;
  }
}

export function meSyncExported(): User | null {
  return meSync();
}

export async function register(input: {
  name: string;
  phone: string;
  email: string;
  password: string;
}): Promise<{ token?: string; user?: User; requiresVerification?: boolean; email?: string }> {
  try {
    const res = await apiClient.post("/users/signup", input);
    if (res.data.requiresVerification) {
      return { requiresVerification: true, email: res.data.email };
    }
    const user = mapBackendUser(res.data.data.user as BackendUserRaw);
    const token = res.data.token as string;
    setToken(token);
    saveLocalUser(user);
    return { token, user };
  } catch (err: unknown) {
    throw new Error(extractErrorMessage(err, "حدث خطأ أثناء التسجيل"));
  }
}

export async function login(input: {
  phone: string;
  password: string;
}): Promise<{ token?: string; user?: User; requiresVerification?: boolean; email?: string }> {
  try {
    const res = await apiClient.post("/users/login", input);
    if (res.data.requiresVerification) {
      return { requiresVerification: true, email: res.data.email };
    }
    const user = mapBackendUser(res.data.data.user as BackendUserRaw);
    const token = res.data.token as string;
    setToken(token);
    saveLocalUser(user);
    return { token, user };
  } catch (err: unknown) {
    throw new Error(extractErrorMessage(err, "رقم الهاتف أو كلمة المرور غير صحيحة"));
  }
}

export async function verifyOTP(input: {
  email: string;
  otp: string;
}): Promise<{ token: string; user: User }> {
  try {
    const res = await apiClient.post("/users/verify-otp", input);
    const user = mapBackendUser(res.data.data.user as BackendUserRaw);
    const token = res.data.token as string;
    setToken(token);
    saveLocalUser(user);
    return { token, user };
  } catch (err: unknown) {
    throw new Error(extractErrorMessage(err, "كود التفعيل غير صحيح"));
  }
}

export async function resendOTP(email: string): Promise<void> {
  try {
    await apiClient.post("/users/resend-otp", { email });
  } catch (err: unknown) {
    throw new Error(extractErrorMessage(err, "فشل إعادة إرسال الكود"));
  }
}

export async function forgotPassword(email: string): Promise<void> {
  try {
    await apiClient.post("/users/forgot-password", { email });
  } catch (err: unknown) {
    throw new Error(extractErrorMessage(err, "فشل إرسال كود الاستعادة"));
  }
}

export async function resetPassword(input: {
  email: string;
  otp: string;
  password: string;
  passwordConfirm: string;
}): Promise<{ token: string; user: User }> {
  try {
    const res = await apiClient.post("/users/reset-password", input);
    const user = mapBackendUser(res.data.data.user as BackendUserRaw);
    const token = res.data.token as string;
    setToken(token);
    saveLocalUser(user);
    return { token, user };
  } catch (err: unknown) {
    throw new Error(extractErrorMessage(err, "فشل إعادة تعيين كلمة المرور"));
  }
}

export function setToken(token: string): void {
  if (!isServer) {
    window.localStorage.setItem(TOKEN_KEY, token);
    window.localStorage.setItem("token", token);
  }
}

export function logout(): void {
  if (!isServer) {
    window.localStorage.removeItem(TOKEN_KEY);
    window.localStorage.removeItem("token");
    window.localStorage.removeItem(USER_KEY);
  }
}

// ------------------------------- Items -------------------------------

export async function listItems(
  type: "all" | ItemType = "all",
  search = "",
  upcomingOnly = true,
): Promise<Item[]> {
  try {
    const params: Record<string, string> = {};
    if (type !== "all") params["type"] = type;
    if (search.trim()) params["q"] = search.trim();

    if (!upcomingOnly) {
      params["showAll"] = "true";
    }

    const res = await apiClient.get("/events", { params });
    const events = (res.data.data.events || []) as BackendEventRaw[];
    let mapped = events.map(mapBackendEvent);

    if (upcomingOnly) {
      const formatter = new Intl.DateTimeFormat("en-US", {
        timeZone: "Africa/Cairo",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hourCycle: "h23",
      });

      const parts = formatter.formatToParts(new Date());
      const dt: Record<string, string> = {};
      parts.forEach((part) => {
        dt[part.type] = part.value;
      });

      const currentCairoTimeStr = `${dt["year"]}-${dt["month"]}-${dt["day"]}T${dt["hour"]}:${dt["minute"]}:00`;

      mapped = mapped.filter((item) => {
        const itemTimeStr = `${item.date}T${item.time}:00`;
        return itemTimeStr > currentCairoTimeStr;
      });
    }

    return mapped;
  } catch (err: unknown) {
    throw new Error(extractErrorMessage(err, "تعذر جلب قائمة الفعاليات"));
  }
}

export async function getItem(id: string): Promise<Item> {
  try {
    const res = await apiClient.get(`/events/${id}`);
    return mapBackendEvent(res.data.data.event as BackendEventRaw);
  } catch (err: unknown) {
    throw new Error(extractErrorMessage(err, "العنصر غير موجود"));
  }
}

export function bookedSeatsSync(itemId: string): number {
  return bookedSeatsCache.get(itemId) ?? 0;
}

export async function remainingSeats(itemId: string): Promise<number> {
  const item = await getItem(itemId);
  return Math.max(0, item.capacity - bookedSeatsSync(itemId));
}

// ----------------------------- Bookings ------------------------------

export async function createBooking(input: {
  itemId: string;
  quantity: number;
  paymentScreenshot?: string;
}): Promise<Booking> {
  try {
    const formData = new FormData();
    formData.append("event", input.itemId);
    formData.append("quantity", String(input.quantity));

    if (input.paymentScreenshot && input.paymentScreenshot.startsWith("data:")) {
      const blob = dataUrlToBlob(input.paymentScreenshot);
      formData.append("paymentReceipt", blob, "receipt.jpg");
    }

    const res = await apiClient.post("/bookings", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return mapBackendBooking(res.data.data.booking as BackendBookingRaw);
  } catch (err: unknown) {
    throw new Error(extractErrorMessage(err, "تعذر إرسال طلب الحجز"));
  }
}

export async function myBookings(): Promise<Booking[]> {
  try {
    const res = await apiClient.get("/bookings/my-bookings");
    const bookings = (res.data.data.bookings || []) as BackendBookingRaw[];
    return bookings.map(mapBackendBooking);
  } catch (err: unknown) {
    throw new Error(extractErrorMessage(err, "تعذر جلب حجوزاتك"));
  }
}

export async function getBooking(id: string): Promise<Booking> {
  try {
    const res = await apiClient.get(`/bookings/${id}`);
    return mapBackendBooking(res.data.data.booking as BackendBookingRaw);
  } catch {
    const mine = await myBookings();
    const found = mine.find((b) => b.id === id);
    if (found) return found;
    throw new Error("الحجز غير موجود");
  }
}

// ---------------------------- Admin Items ----------------------------

export async function adminCreateItem(input: NewItemInput): Promise<Item> {
  try {
    const formData = new FormData();
    formData.append("title", input.title);
    formData.append("type", input.type);
    formData.append("attendanceMode", input.type === "event" ? "offline" : input.attendanceMode);
    formData.append("description", input.description);
    formData.append("date", input.date);
    formData.append("time", input.time);
    formData.append("location", input.location);
    formData.append("price", String(input.price));
    formData.append("capacity", String(input.capacity));
    formData.append("paymentMethod", input.paymentMethod);
    formData.append("paymentTarget", input.paymentTarget);

    if (input.accessLink) {
      formData.append("accessLink", input.accessLink);
    }
    if (input.accessDetails) {
      formData.append("accessDetails", input.accessDetails);
    }

    if (input.image && input.image.startsWith("data:")) {
      const blob = dataUrlToBlob(input.image);
      formData.append("image", blob, "cover.jpg");
    }

    const res = await apiClient.post("/events", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return mapBackendEvent(res.data.data.event as BackendEventRaw);
  } catch (err: unknown) {
    throw new Error(extractErrorMessage(err, "تعذر إضافة الفعالية"));
  }
}

export async function adminUpdateItem(id: string, patch: Partial<NewItemInput>): Promise<Item> {
  try {
    const formData = new FormData();
    if (patch.title !== undefined) formData.append("title", patch.title);
    if (patch.type !== undefined) formData.append("type", patch.type);
    if (patch.attendanceMode !== undefined) {
      formData.append("attendanceMode", patch.type === "event" ? "offline" : patch.attendanceMode);
    }
    if (patch.description !== undefined) formData.append("description", patch.description);
    if (patch.date !== undefined) formData.append("date", patch.date);
    if (patch.time !== undefined) formData.append("time", patch.time);
    if (patch.location !== undefined) formData.append("location", patch.location);
    if (patch.price !== undefined) formData.append("price", String(patch.price));
    if (patch.capacity !== undefined) formData.append("capacity", String(patch.capacity));
    if (patch.paymentMethod !== undefined) formData.append("paymentMethod", patch.paymentMethod);
    if (patch.paymentTarget !== undefined) formData.append("paymentTarget", patch.paymentTarget);
    if (patch.accessLink !== undefined) formData.append("accessLink", patch.accessLink);
    if (patch.accessDetails !== undefined) formData.append("accessDetails", patch.accessDetails);

    if (patch.image && patch.image.startsWith("data:")) {
      const blob = dataUrlToBlob(patch.image);
      formData.append("image", blob, "cover.jpg");
    }

    const res = await apiClient.patch(`/events/${id}`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return mapBackendEvent(res.data.data.event as BackendEventRaw);
  } catch (err: unknown) {
    throw new Error(extractErrorMessage(err, "تعذر تحديث الفعالية"));
  }
}

export async function adminDeleteItem(id: string): Promise<void> {
  try {
    await apiClient.delete(`/events/${id}`);
  } catch (err: unknown) {
    throw new Error(extractErrorMessage(err, "تعذر حذف الفعالية"));
  }
}

// --------------------------- Admin Bookings --------------------------

export async function adminListBookings(status?: BookingStatus): Promise<Booking[]> {
  try {
    const res = await apiClient.get("/bookings");
    const rawList = (res.data.data.bookings || []) as BackendBookingRaw[];
    const mapped = rawList.map(mapBackendBooking);
    return status ? mapped.filter((b) => b.status === status) : mapped;
  } catch (err: unknown) {
    throw new Error(extractErrorMessage(err, "تعذر جلب قائمة الحجوزات"));
  }
}

export async function confirmBooking(id: string): Promise<Booking> {
  try {
    const res = await apiClient.patch(`/bookings/${id}/status`, {
      status: "confirmed",
    });
    return mapBackendBooking(res.data.data.booking as BackendBookingRaw);
  } catch (err: unknown) {
    throw new Error(extractErrorMessage(err, "تعذر تأكيد الحجز"));
  }
}

export async function rejectBooking(id: string, reason: string): Promise<Booking> {
  try {
    const res = await apiClient.patch(`/bookings/${id}/status`, {
      status: "rejected",
      rejectReason: reason.trim() || "تم رفض الحجز",
    });
    return mapBackendBooking(res.data.data.booking as BackendBookingRaw);
  } catch (err: unknown) {
    throw new Error(extractErrorMessage(err, "تعذر رفض الحجز"));
  }
}

// ------------------------------- Check-in ----------------------------

export async function checkIn(token: string): Promise<Booking> {
  const currentUser = await me();
  if (!currentUser || (currentUser.role !== "admin" && currentUser.role !== "employee")) {
    throw new Error("غير مصرح لك بفحص التذاكر! هذه الميزة متاحة للموظفين والإدارة فقط.");
  }

  try {
    const raw = (token.trim().split("|")[0] ?? "").trim();
    const res = await apiClient.post("/bookings/verify-ticket", {
      ticketCode: raw,
    });
    const b = res.data.data.booking as BackendBookingRaw & {
      customerName?: string;
      customerPhone?: string;
      eventTitle?: string;
    };

    if (b._id || b.id) {
      return mapBackendBooking(b);
    }

    return {
      id: raw,
      code: "MW-" + raw.slice(0, 6).toUpperCase(),
      qrToken: raw,
      itemId: "",
      userId: "",
      userName: b.customerName || "عميل",
      userPhone: b.customerPhone || "",
      quantity: 1,
      totalAmount: 0,
      status: "attended",
      paymentScreenshot: "",
      createdAt: new Date().toISOString(),
      checkedInAt: new Date().toISOString(),
    };
  } catch (err: unknown) {
    throw new Error(extractErrorMessage(err, "رمز التذكرة غير صالح"));
  }
}

// ------------------------------- Stats -------------------------------

export async function getStats(): Promise<Stats> {
  try {
    const [bookings, items] = await Promise.all([adminListBookings(), listItems("all", "", false)]);
    const today = new Date().toISOString().slice(0, 10);

    return {
      pending: bookings.filter((b) => b.status === "pending").length,
      confirmed: bookings.filter((b) => b.status === "confirmed" || b.status === "attended").length,
      revenue: bookings
        .filter((b) => b.status === "confirmed" || b.status === "attended")
        .reduce((sum, b) => sum + b.totalAmount, 0),
      upcoming: items.filter((i) => i.date >= today).length,
    };
  } catch {
    return { pending: 0, confirmed: 0, revenue: 0, upcoming: 0 };
  }
}

// ------------------------------ Settings -----------------------------

export async function getSettings(): Promise<AppSettings> {
  const defaultSettings: AppSettings = {
    instructions:
      "قم بتحويل المبلغ الإجمالي إلى رقم فودافون كاش التالي، ثم ارفع صورة إيصال التحويل لمراجعة الحجز. سيتم التأكيد خلال 24 ساعة.",
    transferPhone: "01012345678",
  };
  if (isServer) return defaultSettings;
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    if (raw) return JSON.parse(raw) as AppSettings;
  } catch {
    // ignore
  }
  return defaultSettings;
}

export async function updateSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
  const current = await getSettings();
  const updated = { ...current, ...patch };
  if (!isServer) {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(updated));
  }
  return updated;
}

// ------------------------------- Staff -------------------------------

export async function adminListStaff(): Promise<(User & { role: Role })[]> {
  try {
    const res = await apiClient.get("/users/staff");
    const staff = (res.data.data.staff || []) as BackendUserRaw[];
    return staff.map(mapBackendUser);
  } catch (err: unknown) {
    throw new Error(extractErrorMessage(err, "تعذر جلب قائمة الموظفين"));
  }
}

export async function adminCreateStaff(input: NewStaffInput): Promise<User> {
  const cleanPhone = input.phone.trim();
  const cleanEmail = input.email.trim();

  if (!/^01[0125]\d{8}$/.test(cleanPhone)) {
    throw new Error("رقم الهاتف غير صحيح، يجب أن يكون رقماً مصرياً مكوناً من 11 رقماً");
  }
  if (!cleanEmail) {
    throw new Error("البريد الإلكتروني مطلوب");
  }

  try {
    const res = await apiClient.post("/users/staff", {
      name: input.name.trim(),
      phone: cleanPhone,
      email: cleanEmail,
      password: input.password,
      role: input.role,
    });
    return mapBackendUser(res.data.data.staff as BackendUserRaw);
  } catch (err: unknown) {
    throw new Error(extractErrorMessage(err, "تعذر إضافة الموظف"));
  }
}

export async function adminUpdateStaff(
  id: string,
  patch: { name?: string; phone?: string; password?: string; role?: Role },
): Promise<User> {
  try {
    const res = await apiClient.patch(`/users/staff/${id}`, patch);
    return mapBackendUser(res.data.data.staff as BackendUserRaw);
  } catch (err: unknown) {
    throw new Error(extractErrorMessage(err, "تعذر تحديث بيانات الموظف"));
  }
}

export async function adminDeleteStaff(id: string): Promise<void> {
  try {
    await apiClient.delete(`/users/staff/${id}`);
  } catch (err: unknown) {
    throw new Error(extractErrorMessage(err, "تعذر حذف حساب الموظف"));
  }
}

export async function updateProfile(data: { name: string }): Promise<User> {
  try {
    const res = await apiClient.patch("/users/update-me", data);
    const user = mapBackendUser(res.data.data.user);
    saveLocalUser(user);
    return user;
  } catch (err: unknown) {
    throw new Error(extractErrorMessage(err, "فشل تحديث البيانات"));
  }
}

export async function updatePassword(data: {
  passwordCurrent: string;
  password: string;
  passwordConfirm: string;
}): Promise<void> {
  try {
    await apiClient.patch("/users/update-password", data);
  } catch (err: unknown) {
    throw new Error(extractErrorMessage(err, "فشل تحديث كلمة المرور"));
  }
}
