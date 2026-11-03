import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { ArrowRight } from "lucide-react";
import { toast } from "sonner";
import * as api from "@/lib/api";

export const Route = createFileRoute("/admin/bookings")({
  component: AdminBookings,
});

function AdminBookings() {
  const [bookings, setBookings] = useState<api.Booking[]>([]);
  const [loading, setLoading] = useState(true);

  // دالة جلب الحجوزات من الباك إند
  const fetchBookings = async () => {
    try {
      setLoading(true);
      const data = await api.adminListBookings();
      setBookings(data);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "فشل جلب الحجوزات");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBookings();
  }, []);

  const handleConfirm = async (id: string) => {
    try {
      await api.confirmBooking(id);
      toast.success("تم تأكيد الحجز بنجاح");
      fetchBookings(); // تحديث الجدول
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "فشل تأكيد الحجز");
    }
  };

  const handleReject = async (id: string) => {
    const reason = window.prompt("اكتب سبب الرفض (اختياري):", "غير مطابق");
    if (reason === null) return; // لو ضغط Cancel
    try {
      await api.rejectBooking(id, reason);
      toast.success("تم رفض الحجز");
      fetchBookings();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "فشل رفض الحجز");
    }
  };

  return (
    <div className="p-8 text-right pb-24" dir="rtl">
      <Link
        to="/admin"
        className="inline-flex items-center gap-2 text-primary hover:text-primary/80 mb-6 bg-card px-4 py-2 rounded-xl border border-border transition-colors"
      >
        <ArrowRight size={20} />
        <span>رجوع للوحة التحكم</span>
      </Link>

      <h1 className="text-3xl font-bold text-white mb-6">إدارة الحجوزات</h1>

      <div className="bg-card rounded-2xl p-4 border border-border overflow-x-auto">
        <table className="w-full text-white min-w-[800px]">
          <thead>
            <tr className="border-b border-border text-primary">
              <th className="p-3 text-right">الاسم</th>
              <th className="p-3 text-right">رقم الموبايل</th>
              <th className="p-3 text-right">عدد التذاكر</th>
              <th className="p-3 text-right">المبلغ</th>
              <th className="p-3 text-right">الحالة</th>
              <th className="p-3 text-center">الإجراءات</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="text-center p-4">
                  جاري التحميل...
                </td>
              </tr>
            ) : bookings.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center p-4">
                  لا توجد حجوزات حتى الآن
                </td>
              </tr>
            ) : (
              bookings.map((booking) => (
                <tr key={booking.id} className="border-b border-border hover:bg-muted/50">
                  <td className="p-3">{booking.userName}</td>
                  <td className="p-3" dir="ltr">
                    {booking.userPhone}
                  </td>
                  <td className="p-3">{booking.quantity}</td>
                  <td className="p-3">{booking.totalAmount} ج.م</td>
                  <td className="p-3">
                    <span
                      className={`px-2 py-1 rounded text-sm ${
                        booking.status === "confirmed"
                          ? "bg-green-500/20 text-green-300"
                          : booking.status === "rejected"
                            ? "bg-red-500/20 text-red-300"
                            : booking.status === "attended"
                              ? "bg-blue-500/20 text-blue-300"
                              : "bg-yellow-500/20 text-yellow-300"
                      }`}
                    >
                      {booking.status === "confirmed"
                        ? "مؤكد"
                        : booking.status === "rejected"
                          ? "مرفوض"
                          : booking.status === "attended"
                            ? "حضر الفعالية"
                            : "قيد المراجعة"}
                    </span>
                  </td>
                  <td className="p-3 flex justify-center gap-2">
                    <button
                      onClick={() => window.open(booking.paymentScreenshot, "_blank")}
                      className="bg-teal-700 hover:bg-teal-600 text-white px-3 py-1 rounded text-sm transition-colors"
                    >
                      عرض التحويل
                    </button>
                    {booking.status === "pending" && (
                      <>
                        <button
                          onClick={() => handleConfirm(booking.id)}
                          className="bg-green-600 hover:bg-green-500 text-white px-3 py-1 rounded text-sm transition-colors"
                        >
                          تأكيد
                        </button>
                        <button
                          onClick={() => handleReject(booking.id)}
                          className="bg-red-600 hover:bg-red-500 text-white px-3 py-1 rounded text-sm transition-colors"
                        >
                          رفض
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
