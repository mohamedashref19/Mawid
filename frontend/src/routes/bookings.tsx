import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, CalendarDays, QrCode, ReceiptText, Users, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/StatusBadge";
import { useRequireRole } from "@/hooks/use-auth";
import * as api from "@/lib/api";
import { formatDateTime, formatNumber, formatPrice } from "@/lib/format";

export const Route = createFileRoute("/bookings")({
  head: () => ({
    meta: [
      { title: "حجوزاتي | CTS " },
      { name: "description", content: "تابع حالة حجوزاتك وقم بتحميل تذاكرك." },
      { property: "og:title", content: "حجوزاتي | CTS " },
      { property: "og:description", content: "تابع حالة حجوزاتك وقم بتحميل تذاكرك." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MyBookings,
});

function MyBookings() {
  const { ready } = useRequireRole(["user", "employee", "admin"]);
  const { data: bookings, isLoading } = useQuery({
    queryKey: ["myBookings"],
    queryFn: () => api.myBookings(),
    enabled: ready,
  });
  const { data: items } = useQuery({
    queryKey: ["items", "all", "includePast"],
    queryFn: () => api.listItems("all", "", false),
    enabled: ready,
  });

  return (
    <div className="mx-auto max-w-3xl px-4">
      {/* التعديل هنا: إضافة اللوجو بجانب العنوان */}
      <header className="pt-6 flex items-center gap-3">
        <div className="size-12 shrink-0 rounded-full overflow-hidden border-2 border-primary/20 bg-card shadow-glow">
          <img
            src="https://cts-alex.vercel.app/logo.png"
            alt="CTS Logo"
            className="h-full w-full object-cover"
          />
        </div>
        <div>
          <h1 className="text-xl font-extrabold text-foreground">حجوزاتي</h1>
          <p className="mt-1 text-sm text-muted-foreground">تابع حالة حجوزاتك وحمّل تذاكرك</p>
        </div>
      </header>

      <main className="mt-5 space-y-4 pb-24">
        {isLoading || !bookings ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-border bg-card p-4">
              <div className="flex gap-3">
                <Skeleton className="size-16 rounded-xl bg-muted/50" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-2/3 bg-muted/50" />
                  <Skeleton className="h-3 w-1/2 bg-muted/50" />
                  <Skeleton className="h-6 w-24 rounded-full bg-muted/50" />
                </div>
              </div>
            </div>
          ))
        ) : bookings.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-card py-16 text-center shadow-card animate-in fade-in">
            <ReceiptText className="size-10 text-muted-foreground opacity-50" />
            <p className="font-bold text-foreground">لا توجد حجوزات بعد</p>
            <p className="text-sm text-muted-foreground">
              ابدأ بتصفح الفعاليات والكورسات واحجز مقعدك
            </p>
            <Button
              asChild
              className="mt-2 rounded-2xl font-bold shadow-glow text-primary-foreground"
            >
              <Link to="/">تصفح الآن</Link>
            </Button>
          </div>
        ) : (
          <div className="animate-in fade-in space-y-4">
            {bookings.map((b) => {
              const item = items?.find((i) => i.id === b.itemId);
              return <BookingRow key={b.id} booking={b} item={item} />;
            })}
          </div>
        )}
      </main>
    </div>
  );
}

function BookingRow({ booking, item }: { booking: api.Booking; item: api.Item | undefined }) {
  const navigate = useNavigate();
  const isCourse = item?.type === "course";
  const isOnlineCourse = isCourse && item?.attendanceMode === "online";

  return (
    <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-card transition-all hover:border-primary/30">
      <div className="flex gap-4 p-4">
        <div className="size-20 shrink-0 overflow-hidden rounded-2xl bg-muted border border-border/50 shadow-sm">
          {item?.image ? (
            <img src={item.image} alt="" className="h-full w-full object-cover" loading="lazy" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-2xl bg-gradient-to-br from-primary/10 to-transparent">
              {item ? (item.type === "event" ? "🎟️" : "🎓") : "🗑️"}
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1 flex flex-col justify-center space-y-2">
          <div className="flex items-start justify-between gap-2">
            <h3 className="line-clamp-1 font-extrabold text-foreground text-base">
              {item?.title ?? "عنصر محذوف"}
            </h3>
            <StatusBadge status={booking.status} className="shrink-0" />
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-bold text-muted-foreground">
            <span className="flex items-center gap-1.5 bg-muted px-2 py-1 rounded-md border border-border/50">
              <CalendarDays className="size-3.5 text-primary" />
              {formatDateTime(booking.createdAt)}
            </span>
            <span className="flex items-center gap-1.5 bg-muted px-2 py-1 rounded-md border border-border/50">
              <Users className="size-3.5 text-primary" />
              {formatNumber(booking.quantity)} {isCourse ? "مقعد" : "تذكرة"}
            </span>
            <span className="font-extrabold text-primary bg-primary/10 px-2 py-1 rounded-md border border-primary/20">
              {formatPrice(booking.totalAmount)}
            </span>
          </div>
        </div>
      </div>

      {booking.status === "rejected" && booking.rejectReason && (
        <p className="mx-4 mb-4 rounded-xl bg-destructive/10 px-4 py-3 text-xs font-bold text-destructive border border-destructive/20 text-center">
          سبب الرفض: {booking.rejectReason}
        </p>
      )}

      {(booking.status === "confirmed" || booking.status === "attended") && (
        <div className="border-t border-dashed border-border/60 p-4 bg-muted/20">
          <Button
            onClick={() => navigate({ to: "/ticket/$id", params: { id: booking.id } })}
            className="h-12 w-full gap-2 rounded-2xl font-bold shadow-glow hover:scale-[1.02] transition-transform text-primary-foreground"
          >
            {isOnlineCourse ? (
              <>
                <ExternalLink className="size-5" /> عرض رابط وتفاصيل الكورس
              </>
            ) : (
              <>
                <QrCode className="size-5" /> عرض التذكرة
              </>
            )}
            <ArrowLeft className="ms-auto size-5 opacity-70" />
          </Button>
        </div>
      )}
    </div>
  );
}
