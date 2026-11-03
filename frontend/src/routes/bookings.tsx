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
      { title: "حجوزاتي | موعد" },
      { name: "description", content: "تابع حالة حجوزاتك وقم بتحميل تذاكرك." },
      { property: "og:title", content: "حجوزاتي | موعد" },
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
    // نمرر false حتى تظل بيانات الفعاليات السابقة ظاهرة في سجل حجوزات العميل
    queryFn: () => api.listItems("all", "", false),
    enabled: ready,
  });

  return (
    <div className="mx-auto max-w-3xl px-4">
      <header className="pt-6">
        <h1 className="text-xl font-extrabold text-foreground">حجوزاتي</h1>
        <p className="mt-1 text-sm text-muted-foreground">تابع حالة حجوزاتك وحمّل تذاكرك</p>
      </header>

      <main className="mt-5 space-y-4">
        {isLoading || !bookings ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-border bg-card p-4">
              <div className="flex gap-3">
                <Skeleton className="size-16 rounded-xl" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-3 w-1/2" />
                  <Skeleton className="h-6 w-24 rounded-full" />
                </div>
              </div>
            </div>
          ))
        ) : bookings.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-card py-16 text-center">
            <ReceiptText className="size-10 text-muted-foreground" />
            <p className="font-bold text-foreground">لا توجد حجوزات بعد</p>
            <p className="text-sm text-muted-foreground">
              ابدأ بتصفح الفعالياتوالكورسات واحجز مقعدك
            </p>
            <Button asChild className="mt-2 rounded-2xl font-bold shadow-glow">
              <Link to="/">تصفح الآن</Link>
            </Button>
          </div>
        ) : (
          bookings.map((b) => {
            const item = items?.find((i) => i.id === b.itemId);
            return <BookingRow key={b.id} booking={b} item={item} />;
          })
        )}
      </main>
    </div>
  );
}

function BookingRow({ booking, item }: { booking: api.Booking; item: api.Item | undefined }) {
  const navigate = useNavigate();
  const isCourse = item?.type === "course";

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
      <div className="flex gap-3 p-4">
        <div className="size-16 shrink-0 overflow-hidden rounded-xl bg-accent">
          {item?.image ? (
            <img src={item.image} alt="" className="h-full w-full object-cover" loading="lazy" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-2xl">
              {item ? (item.type === "event" ? "🎟️" : "🎓") : "🗑️"}
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex items-start justify-between gap-2">
            <h3 className="line-clamp-1 font-bold text-foreground">
              {item?.title ?? "عنصر محذوف"}
            </h3>
            <StatusBadge status={booking.status} className="shrink-0" />
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <CalendarDays className="size-3.5" />
              {formatDateTime(booking.createdAt)}
            </span>
            <span className="flex items-center gap-1">
              <Users className="size-3.5" />
              {formatNumber(booking.quantity)} {isCourse ? "مقعد" : "تذكرة"}
            </span>
            <span className="font-bold text-primary">{formatPrice(booking.totalAmount)}</span>
          </div>
        </div>
      </div>

      {booking.status === "rejected" && booking.rejectReason && (
        <p className="mx-4 mb-3 rounded-xl bg-destructive/10 px-3 py-2 text-xs text-destructive">
          سبب الرفض: {booking.rejectReason}
        </p>
      )}

      {(booking.status === "confirmed" || booking.status === "attended") && (
        <div className="border-t border-border/60 p-3">
          <Button
            onClick={() => navigate({ to: "/ticket/$id", params: { id: booking.id } })}
            className="h-11 w-full gap-2 rounded-xl font-bold shadow-glow"
          >
            {isCourse ? (
              <>
                <ExternalLink className="size-5" /> عرض رابط وتفاصيل الكورس
              </>
            ) : (
              <>
                <QrCode className="size-5" /> عرض التذكرة
              </>
            )}
            <ArrowLeft className="ms-auto size-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
