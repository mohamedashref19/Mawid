import apiClient from "./axiosConfig";

// بنستخدم FormData عشان نرفع صورة التحويل مع بيانات الحجز
export const createBooking = (formData: FormData) =>
  apiClient.post("/bookings", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });

export const getMyBookings = () => apiClient.get("/bookings/my-bookings");
export const getAllBookings = () => apiClient.get("/bookings");

export const updateBookingStatus = (id: string, status: "confirmed" | "rejected") =>
  apiClient.patch(`/bookings/${id}/status`, { status });

export const verifyTicket = (ticketCode: string) =>
  apiClient.post("/bookings/verify-ticket", { ticketCode });
