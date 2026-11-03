import { createFileRoute } from "@tanstack/react-router";
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
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/StatusBadge";
import { useRequireRole } from "@/hooks/use-auth";
import * as api from "@/lib/api";
import { formatLongDate, formatNumber, formatPrice, formatTime } from "@/lib/format";

export const Route = createFileRoute("/ticket/$id")({
  head: () => ({
    meta: [{ title: "التذكرة | موعد" }],
  }),
  component: TicketPage,
});

function TicketPage() {
  const { id } = Route.useParams();
  const { ready } = useRequireRole(["user", "employee", "admin"]);

  const { data: booking } = useQuery({
    queryKey: ["booking", id],
    queryFn: () => api.getBooking(id),
    enabled: ready,
  });

  const { data: item } = useQuery({
    queryKey: ["item", booking?.itemId ?? ""],
    queryFn: () => api.getItem(booking!.itemId),
    enabled: !!booking,
  });

  if (!booking || !item) {
    return (
      <div className="mx-auto max-w-md space-y-4 px-4 pt-8">
        <Skeleton className="h-40 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-3xl" />
      </div>
    );
  }

  // إذا كان الحجز لسه قيد المراجعة أو مرفوض
  if (booking.status !== "confirmed" && booking.status !== "attended") {
    return (
      <div className="mx-auto max-w-md px-4 pt-10 text-center">
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
            <p className="rounded-xl bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {booking.rejectReason}
            </p>
          )}
        </div>
      </div>
    );
  }

  const isCourse = item.type === "course";

  async function downloadTicket() {
    const el = document.getElementById("ticket-card");
    if (!el) return;
    try {
      const { toPng } = await import("html-to-image");
      const dataUrl = await toPng(el, { pixelRatio: 2 });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `mawid-${isCourse ? "course" : "ticket"}-${booking!.code}.png`;
      a.click();
      toast.success(isCourse ? "تم تنزيل إيصال الكورس" : "تم تنزيل التذكرة");
    } catch {
      toast.error("تعذر التنزيل");
    }
  }

  return (
    <div className="mx-auto max-w-md px-4">
      <header className="pt-6 text-center">
        <h1 className="text-xl font-extrabold text-foreground">
          {isCourse ? "اكتمل حجز الكورس 🎉" : "تذكرتك جاهزة 🎉"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {isCourse ? "يمكنك الآن الانضمام للكورس عبر الرابط" : "اعرض هذا الرمز عند البوابة للدخول"}
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
            <h2 className="text-lg font-extrabold text-foreground">{item.title}</h2>
          </div>
        </div>

        <div className="space-y-4 p-5">
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex items-center gap-2 rounded-xl bg-muted p-2.5">
              <CalendarDays className="size-4 shrink-0 text-primary" />
              <span className="text-muted-foreground">{formatLongDate(item.date)}</span>
            </div>
            <div className="flex items-center gap-2 rounded-xl bg-muted p-2.5">
              <Clock className="size-4 shrink-0 text-primary" />
              <span className="text-muted-foreground">{formatTime(item.time)}</span>
            </div>
            <div className="col-span-2 flex items-center gap-2 rounded-xl bg-muted p-2.5">
              <MapPin className="size-4 shrink-0 text-primary" />
              <span className="text-muted-foreground">{item.location}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <Field icon={User} label="الاسم" value={booking.userName} />
            <Field icon={Phone} label="الهاتف" value={booking.userPhone} ltr />
          </div>

          <div className="flex items-center justify-between rounded-xl bg-muted p-3 text-sm">
            <span className="font-bold text-foreground">
              {formatNumber(booking.quantity)} × {formatPrice(item.price)}
            </span>
            <StatusBadge status={booking.status} />
          </div>

          <div className="flex flex-col items-center gap-3 border-t border-dashed border-border pt-4">
            {isCourse ? (
              // تصميم الكورس: إظهار الرابط وإخفاء الـ QR
              <div className="w-full text-center">
                <p className="text-sm font-bold text-foreground mb-3">رابط الانضمام متاح الآن</p>
                {item.accessLink ? (
                  <a
                    href={item.accessLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary text-primary-foreground p-4 font-bold transition-colors hover:bg-primary/90"
                  >
                    الانتقال للكورس / الجروب <ExternalLink className="size-5" />
                  </a>
                ) : (
                  <p className="text-xs text-muted-foreground bg-muted p-4 rounded-xl">
                    سيتم إرسال رابط الدخول قريباً.
                  </p>
                )}
                <div className="mt-4">
                  <p className="text-[11px] text-muted-foreground">رقم الحجز المرجعي</p>
                  <p dir="ltr" className="text-lg font-extrabold tracking-[0.1em] text-foreground">
                    {booking.code}
                  </p>
                </div>
              </div>
            ) : (
              // تصميم الإيفنت: إظهار الـ QR Code
              <>
                <div className="rounded-2xl bg-white p-3">
                  <QRCodeSVG value={`${booking.qrToken}|${booking.code}`} size={168} level="M" />
                </div>
                <div className="text-center">
                  <p className="text-[11px] text-muted-foreground">رقم الحجز</p>
                  <p dir="ltr" className="text-2xl font-extrabold tracking-[0.2em] text-primary">
                    {booking.code}
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {!isCourse && (
        <Button
          onClick={downloadTicket}
          variant="secondary"
          className="mt-4 mb-2 h-12 w-full gap-2 rounded-2xl font-bold"
        >
          <Download className="size-5" /> تنزيل التذكرة كصورة
        </Button>
      )}
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
    <div className="flex items-center gap-2 rounded-xl bg-muted p-2.5">
      <Icon className="size-4 shrink-0 text-primary" />
      <div className="min-w-0">
        <p className="text-[10px] text-muted-foreground">{label}</p>
        <p dir={ltr ? "ltr" : undefined} className="truncate text-xs font-bold text-foreground">
          {value}
        </p>
      </div>
    </div>
  );
}
