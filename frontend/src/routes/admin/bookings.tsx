import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { ArrowRight, CheckCircle, XCircle, Eye, FileText, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";
import * as api from "@/lib/api";
import { StatusBadge } from "@/components/StatusBadge";
import { useRequireRole } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { ConfirmModal } from "@/components/ConfirmModal";
import { PromptModal } from "@/components/PromptModal"; // استدعاء المودال الجديد

export const Route = createFileRoute("/admin/bookings")({
  component: AdminBookings,
});

function AdminBookings() {
  const { ready } = useRequireRole(["admin", "employee"]);
  const [bookings, setBookings] = useState<api.Booking[]>([]);
  const [items, setItems] = useState<api.Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReceipt, setSelectedReceipt] = useState<string | null>(null);

  // حالات نوافذ التأكيد والرفض
  const [confirmBookingId, setConfirmBookingId] = useState<string | null>(null);
  const [rejectBookingId, setRejectBookingId] = useState<string | null>(null); // حالة الرفض

  const fetchData = async () => {
    try {
      setLoading(true);
      const [fetchedBookings, fetchedItems] = await Promise.all([
        api.adminListBookings(),
        api.listItems("all", "", false),
      ]);
      setBookings(
        fetchedBookings.sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        ),
      );
      setItems(fetchedItems);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "فشل جلب البيانات");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (ready) {
      void fetchData();
    }
  }, [ready]);

  // إخفاء المحتوى تماماً
  if (!ready) return null;

  // دالة تأكيد الحجز
  const executeConfirm = async () => {
    if (!confirmBookingId) return;
    try {
      await api.confirmBooking(confirmBookingId);
      toast.success("تم تأكيد الحجز بنجاح");
      await fetchData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "فشل تأكيد الحجز");
    } finally {
      setConfirmBookingId(null);
    }
  };

  // دالة رفض الحجز المحدثة
  const executeReject = async (reason: string) => {
    if (!rejectBookingId) return;
    if (!reason.trim()) {
      toast.error("يجب إدخال سبب الرفض");
      return;
    }

    try {
      await api.rejectBooking(rejectBookingId, reason);
      toast.success("تم رفض الحجز");
      await fetchData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "فشل رفض الحجز");
    } finally {
      setRejectBookingId(null);
    }
  };

  return (
    <div className="p-8 text-right pb-24 relative" dir="rtl">
      <Link
        to="/admin"
        className="inline-flex items-center gap-2 text-muted-foreground hover:text-primary mb-6 transition-colors font-bold"
      >
        <ArrowRight size={20} />
        <span>رجوع للوحة التحكم</span>
      </Link>

      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-extrabold text-foreground">إدارة الحجوزات</h1>
      </div>

      <div className="bg-card rounded-3xl p-4 border border-border shadow-card overflow-x-auto">
        <table className="w-full text-foreground min-w-[950px]">
          <thead>
            <tr className="border-b border-border/50 text-primary">
              <th className="p-4 text-right font-extrabold">الاسم</th>
              <th className="p-4 text-right font-extrabold">رقم الموبايل</th>
              <th className="p-4 text-right font-extrabold">الفعالية / الكورس</th>
              <th className="p-4 text-center font-extrabold">عدد التذاكر</th>
              <th className="p-4 text-center font-extrabold">المبلغ</th>
              <th className="p-4 text-center font-extrabold">الحالة</th>
              <th className="p-4 text-center font-extrabold">الإجراءات</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="text-center p-8 text-muted-foreground font-bold">
                  جاري التحميل...
                </td>
              </tr>
            ) : bookings.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="text-center p-8 text-muted-foreground font-bold flex flex-col items-center gap-2"
                >
                  <FileText className="size-8 opacity-50" />
                  لا توجد حجوزات حتى الآن
                </td>
              </tr>
            ) : (
              bookings.map((booking) => {
                const item = items.find((i) => i.id === booking.itemId);
                return (
                  <tr
                    key={booking.id}
                    className="border-b border-border/30 hover:bg-muted/30 transition-colors"
                  >
                    <td className="p-4 font-bold">{booking.userName}</td>
                    <td className="p-4 text-muted-foreground" dir="ltr">
                      {booking.userPhone}
                    </td>
                    <td className="p-4 font-bold text-foreground">
                      {item ? (
                        item.title
                      ) : (
                        <span className="text-destructive text-sm">عنصر محذوف</span>
                      )}
                    </td>
                    <td className="p-4 text-center font-bold">{booking.quantity}</td>
                    <td className="p-4 text-center font-bold">{booking.totalAmount} ج.م</td>
                    <td className="p-4 text-center">
                      <div className="flex justify-center">
                        <StatusBadge status={booking.status} />
                      </div>
                    </td>
                    <td className="p-4 flex items-center justify-center gap-2">
                      {booking.paymentScreenshot ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => setSelectedReceipt(booking.paymentScreenshot)}
                          className="gap-2 bg-muted hover:bg-muted/80 text-foreground border border-border"
                        >
                          <Eye size={16} className="text-primary" />
                          عرض التحويل
                        </Button>
                      ) : (
                        <span className="rounded-lg bg-muted px-3 py-1.5 text-xs font-bold text-muted-foreground">
                          حجز مجاني
                        </span>
                      )}

                      {booking.status === "pending" && (
                        <>
                          <Button
                            size="sm"
                            onClick={() => setConfirmBookingId(booking.id)}
                            className="bg-[#28a745] hover:bg-[#28a745]/90 text-white gap-1"
                            title="تأكيد الحجز"
                          >
                            <CheckCircle size={16} />
                            تأكيد
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => setRejectBookingId(booking.id)}
                            className="gap-1"
                            title="رفض الحجز"
                          >
                            <XCircle size={16} />
                            رفض
                          </Button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* مودال عرض صورة الإيصال */}
      {selectedReceipt && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in"
          onClick={() => setSelectedReceipt(null)}
        >
          <div
            className="bg-card p-4 rounded-3xl max-w-2xl w-full border border-border shadow-card relative flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center w-full mb-4 px-2">
              <h3 className="text-lg font-extrabold text-primary flex items-center gap-2">
                <ImageIcon className="size-5" />
                إيصال الدفع
              </h3>
              <button
                onClick={() => setSelectedReceipt(null)}
                className="text-muted-foreground hover:text-destructive transition-colors bg-muted p-2 rounded-full"
              >
                <XCircle size={24} />
              </button>
            </div>
            <div className="w-full bg-background rounded-2xl border border-border/50 overflow-hidden flex items-center justify-center min-h-[300px] max-h-[70vh]">
              <img
                src={selectedReceipt}
                alt="إيصال التحويل"
                className="w-full h-full object-contain"
              />
            </div>
          </div>
        </div>
      )}

      {/* المودال المخصص لتأكيد الحجز */}
      <ConfirmModal
        isOpen={!!confirmBookingId}
        title="تأكيد الحجز"
        message="هل أنت متأكد من تأكيد هذا الحجز وإصدار التذكرة للعميل؟"
        confirmText="تأكيد الحجز"
        isDestructive={false}
        onConfirm={executeConfirm}
        onCancel={() => setConfirmBookingId(null)}
      />

      {/* المودال المخصص لرفض الحجز مع سبب */}
      <PromptModal
        isOpen={!!rejectBookingId}
        title="رفض الحجز"
        message="يرجى كتابة سبب الرفض (سيتم عرضه للعميل في حسابه):"
        defaultValue="إيصال التحويل غير صالح أو غير واضح"
        confirmText="تأكيد الرفض"
        onConfirm={executeReject}
        onCancel={() => setRejectBookingId(null)}
      />
    </div>
  );
}
