import { createFileRoute, useNavigate } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  CalendarDays,
  Clock,
  Download,
  MapPin,
  Phone,
  ShieldX,
  User,
  ExternalLink,
  ArrowRight,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/StatusBadge";
import { useMe } from "@/hooks/use-auth";
import * as api from "@/lib/api";
import { formatLongDate, formatNumber, formatPrice, formatTime } from "@/lib/format";

export const Route = createFileRoute("/ticket/$id")({
  head: () => ({
    meta: [{ title: "التذكرة | CTS " }],
  }),
  component: TicketPage,
});

function TicketPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { data: user, isLoading: isAuthLoading } = useMe();

  // 1. نجلب الحجز الأول (فقط لو اليوزر موجود)
  const {
    data: booking,
    isLoading: isBookingLoading,
    isError: isBookingError,
  } = useQuery({
    queryKey: ["booking", id],
    queryFn: () => api.getBooking(id),
    enabled: !!user, // لا تطلب الداتا إلا لو اليوزر عامل لوج إن
    retry: 1,
  });

  // 2. نجلب الفعالية (فقط لو الحجز موجود ومحتوي على itemId)
  const { data: item, isLoading: isItemLoading } = useQuery({
    queryKey: ["item", booking?.itemId ?? ""],
    queryFn: () => api.getItem(booking?.itemId as string),
    enabled: !!booking?.itemId, // لا تطلب الفعالية إلا لو فيه itemId
  });

  // ----------------------------------------------------
  // حالات التحميل والأخطاء (عشان نمنع الـ Crash)
  // ----------------------------------------------------

  // حالة 1: جاري التأكد من حالة تسجيل الدخول
  if (isAuthLoading) {
    return <LoadingSkeleton />;
  }

  // حالة 2: المستخدم غير مسجل دخول
  if (!user) {
    return (
      <div className="mx-auto max-w-md px-4 pt-10 text-center animate-in fade-in zoom-in-95">
        <div className="flex flex-col items-center gap-3 rounded-3xl border border-border bg-card p-8 shadow-card">
          <ShieldX className="size-14 text-destructive" />
          <h1 className="text-lg font-extrabold text-foreground">غير مصرح بالدخول</h1>
          <p className="text-sm text-muted-foreground">يجب تسجيل الدخول لعرض التذكرة.</p>
          <Button onClick={() => navigate({ to: "/auth" })} className="mt-4 font-bold shadow-glow">
            تسجيل الدخول
          </Button>
        </div>
      </div>
    );
  }

  // حالة 3: جاري جلب التذكرة والفعالية
  if (isBookingLoading || isItemLoading || (!booking && !isBookingError)) {
    return <LoadingSkeleton />;
  }

  // حالة 4: التذكرة مش موجودة أو حصل خطأ في السيرفر
  if (isBookingError || !booking || !item) {
    return (
      <div className="mx-auto max-w-md px-4 pt-10 text-center animate-in fade-in zoom-in-95">
        <div className="flex flex-col items-center gap-3 rounded-3xl border border-border bg-card p-8 shadow-card">
          <ShieldX className="size-14 text-destructive" />
          <h1 className="text-lg font-extrabold text-foreground">تعذر العثور على التذكرة</h1>
          <p className="text-sm text-muted-foreground">
            تأكد من صحة الرابط، أو انتقل لصفحة حجوزاتي لعرض تذاكرك.
          </p>
          <Button
            onClick={() => navigate({ to: "/bookings" })}
            variant="secondary"
            className="mt-4 font-bold gap-2"
          >
            <ArrowRight className="size-4" /> العودة لحجوزاتي
          </Button>
        </div>
      </div>
    );
  }

  // حالة 5: الحجز لسه قيد المراجعة أو مرفوض
  if (booking.status !== "confirmed" && booking.status !== "attended") {
    return (
      <div className="mx-auto max-w-md px-4 pt-10 text-center animate-in fade-in zoom-in-95">
        <div className="flex flex-col items-center gap-3 rounded-3xl border border-border bg-card p-8 shadow-card">
          <ShieldX className="size-14 text-destructive" />
          <h1 className="text-lg font-extrabold text-foreground">
            {item.type === "course" ? "الكورس غير متاح بعد" : "التذكرة غير متاحة"}
          </h1>
          <p className="text-sm text-muted-foreground">
            لا يمكن عرض التفاصيل إلا بعد تأكيد الحجز. حالة حجزك الحالية:
          </p>
          <StatusBadge status={booking.status} />
          {booking.status === "rejected" && booking.rejectReason && (
            <p className="rounded-xl bg-destructive/10 px-3 py-2 text-xs text-destructive mt-2 border border-destructive/20 font-bold w-full text-center">
              سبب الرفض: {booking.rejectReason}
            </p>
          )}
          <Button
            onClick={() => navigate({ to: "/bookings" })}
            variant="outline"
            className="mt-4 font-bold w-full"
          >
            العودة لحجوزاتي
          </Button>
        </div>
      </div>
    );
  }

  // ----------------------------------------------------
  // التذكرة السليمة (بعد التأكد من كل حاجة)
  // ----------------------------------------------------

  const isOnlineCourse = item.type === "course" && item.attendanceMode === "online";
  const rawAccess = (item.accessLink ?? "").trim();
  const isUrl = /^https?:\/\//i.test(rawAccess);
  const bookingCode = booking.code;

  async function downloadTicket() {
    const el = document.getElementById("ticket-card");
    if (!el) return;
    try {
      const { toPng } = await import("html-to-image");
      const dataUrl = await toPng(el, { pixelRatio: 2 });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `CTS-ticket-${bookingCode}.png`;
      a.click();
      toast.success("تم تنزيل التذكرة بنجاح");
    } catch {
      toast.error("حدث خطأ أثناء تنزيل التذكرة");
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 pb-12 animate-in fade-in">
      <header className="pt-6 text-center">
        <h1 className="text-xl font-extrabold text-foreground">
          {isOnlineCourse ? "اكتمل حجز الكورس 🎉" : "تذكرتك جاهزة 🎉"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {isOnlineCourse
            ? "يمكنك الآن الانضمام للكورس عبر التفاصيل بالأسفل"
            : "اعرض رمز الـ QR عند البوابة للدخول"}
        </p>
      </header>

      <div
        id="ticket-card"
        className="mt-5 overflow-hidden rounded-3xl border border-border bg-card shadow-card"
      >
        <div className="relative aspect-[16/7]">
          {item.image ? (
            <img src={item.image} alt={item.title} className="h-full w-full object-cover" />
          ) : (
            <div className="h-full w-full bg-gradient-to-br from-primary/40 to-secondary" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-card via-card/40 to-transparent" />
          <div className="absolute bottom-2 start-4 end-4">
            <h2 className="text-lg font-extrabold text-foreground shadow-sm">{item.title}</h2>
          </div>
        </div>

        <div className="space-y-4 p-5">
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex items-center gap-2 rounded-xl bg-muted p-2.5">
              <CalendarDays className="size-4 shrink-0 text-primary" />
              <span className="text-muted-foreground font-bold">{formatLongDate(item.date)}</span>
            </div>
            <div className="flex items-center gap-2 rounded-xl bg-muted p-2.5">
              <Clock className="size-4 shrink-0 text-primary" />
              <span className="text-muted-foreground font-bold">{formatTime(item.time)}</span>
            </div>
            <div className="col-span-2 flex items-center gap-2 rounded-xl bg-muted p-2.5">
              <MapPin className="size-4 shrink-0 text-primary" />
              <span className="text-muted-foreground font-bold">{item.location}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <Field icon={User} label="الاسم" value={booking.userName} />
            <Field icon={Phone} label="الهاتف" value={booking.userPhone} ltr />
          </div>

          <div className="flex items-center justify-between rounded-xl bg-muted p-3 text-sm border border-border/50">
            <span className="font-bold text-foreground">
              {formatNumber(booking.quantity)} × {formatPrice(item.price)}
            </span>
            <StatusBadge status={booking.status} />
          </div>

          <div className="flex flex-col items-center gap-3 border-t border-dashed border-border pt-4">
            {isOnlineCourse ? (
              <div className="w-full text-center">
                <p className="text-sm font-bold text-foreground mb-3">تفاصيل الانضمام للكورس</p>
                {rawAccess ? (
                  isUrl ? (
                    <a
                      href={rawAccess}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary text-primary-foreground p-4 font-bold transition-colors hover:bg-primary/90 shadow-glow"
                    >
                      الانتقال للكورس / الجروب <ExternalLink className="size-5" />
                    </a>
                  ) : (
                    <div className="rounded-xl bg-primary/10 border border-primary/30 p-4 text-sm font-bold text-foreground whitespace-pre-wrap">
                      {rawAccess}
                    </div>
                  )
                ) : (
                  <p className="text-xs text-muted-foreground bg-muted p-4 rounded-xl font-bold border border-border">
                    سيتم إرسال تفاصيل الدخول قريباً.
                  </p>
                )}
                <div className="mt-4">
                  <p className="text-[11px] text-muted-foreground font-bold">رقم الحجز المرجعي</p>
                  <p dir="ltr" className="text-lg font-extrabold tracking-[0.1em] text-foreground">
                    {booking.code}
                  </p>
                </div>
              </div>
            ) : (
              <>
                <div className="rounded-2xl bg-white p-3 border-2 border-primary/20">
                  <QRCodeSVG value={`${booking.qrToken}|${booking.code}`} size={168} level="M" />
                </div>
                <div className="text-center">
                  <p className="text-[11px] text-muted-foreground font-bold">رقم التذكرة</p>
                  <p dir="ltr" className="text-2xl font-extrabold tracking-[0.2em] text-primary">
                    {booking.code}
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {!isOnlineCourse && (
        <Button
          onClick={downloadTicket}
          variant="secondary"
          className="mt-6 h-12 w-full gap-2 rounded-2xl font-bold bg-muted hover:bg-muted/80 text-foreground border border-border"
        >
          <Download className="size-5" /> تنزيل التذكرة كصورة
        </Button>
      )}
    </div>
  );
}

// ----------------------------------------------------
// المكونات المساعدة
// ----------------------------------------------------

function LoadingSkeleton() {
  return (
    <div className="mx-auto max-w-md space-y-4 px-4 pt-8 animate-in fade-in">
      <Skeleton className="h-20 w-3/4 mx-auto rounded-xl bg-muted/50" />
      <Skeleton className="h-64 w-full rounded-3xl bg-muted/50" />
      <Skeleton className="h-12 w-full rounded-2xl bg-muted/50" />
    </div>
  );
}

function Field({
  icon: Icon,
  label,
  value,
  ltr,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  ltr?: boolean;
}) {
  return (
    <div className="flex items-center gap-2 rounded-xl bg-muted p-2.5 border border-border/50">
      <Icon className="size-4 shrink-0 text-primary" />
      <div className="min-w-0">
        <p className="text-[10px] text-muted-foreground font-bold">{label}</p>
        <p dir={ltr ? "ltr" : undefined} className="truncate text-xs font-bold text-foreground">
          {value}
        </p>
      </div>
    </div>
  );
}
