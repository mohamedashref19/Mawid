import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  CalendarDays,
  Clock,
  Info,
  MapPin,
  Ticket as TicketIcon,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useMe } from "@/hooks/use-auth";
import * as api from "@/lib/api";
import { TYPE_LABEL, formatLongDate, formatNumber, formatPrice, formatTime } from "@/lib/format";

export const Route = createFileRoute("/details/$id")({
  head: () => ({
    meta: [
      { title: "تفاصيل الحجز | CTS " },
      { name: "description", content: "كل تفاصيل الفعاليه أو الكورس قبل الحجز." },
      { property: "og:title", content: "تفاصيل الحجز | CTS " },
      { property: "og:description", content: "كل تفاصيل الفعالية أو الكورس قبل الحجز." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Details,
});

function Details() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { data: user } = useMe();

  const { data, isLoading } = useQuery({
    queryKey: ["item", id],
    queryFn: async () => {
      const item = await api.getItem(id);
      return { item, remaining: Math.max(0, item.capacity - api.bookedSeatsSync(item.id)) };
    },
  });

  if (isLoading || !data) {
    return (
      <div className="mx-auto max-w-3xl px-4">
        <Skeleton className="mt-4 aspect-[16/10] w-full rounded-3xl" />
        <div className="mt-4 space-y-3">
          <Skeleton className="h-7 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-24 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  const { item, remaining } = data;
  const soldOut = remaining <= 0;

  return (
    <div className="mx-auto max-w-3xl px-4">
      <div className="relative -mx-4">
        <div className="aspect-[16/10] w-full overflow-hidden bg-accent">
          {item.image ? (
            <img src={item.image} alt={item.title} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/30 via-secondary to-background text-6xl">
              {item.type === "event" ? "🎟️" : "🎓"}
            </div>
          )}
        </div>
        <button
          onClick={() => navigate({ to: "/" })}
          aria-label="رجوع"
          className="absolute start-4 top-4 flex size-10 items-center justify-center rounded-full bg-background/70 backdrop-blur-sm"
        >
          <ArrowRight className="size-5 text-foreground" />
        </button>
        <span className="absolute end-4 top-4 rounded-full bg-background/80 px-3 py-1.5 text-xs font-bold text-primary backdrop-blur-sm">
          {TYPE_LABEL[item.type]}
        </span>
      </div>

      <div className="mt-4">
        <h1 className="text-2xl font-extrabold text-foreground">{item.title}</h1>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <InfoRow icon={CalendarDays} label="التاريخ" value={formatLongDate(item.date)} />
          <InfoRow icon={Clock} label="الوقت" value={formatTime(item.time)} />
          <InfoRow icon={MapPin} label="الموقع" value={item.location} className="col-span-2" />
          <InfoRow
            icon={Users}
            label="المقاعد المتبقية"
            value={soldOut ? "نفدت المقاعد" : formatNumber(remaining)}
            danger={soldOut}
          />
          <InfoRow icon={TicketIcon} label="السعر" value={formatPrice(item.price)} highlight />
        </div>

        <div className="mt-4 rounded-2xl border border-border bg-card p-4 shadow-card">
          <h2 className="mb-2 font-bold text-foreground">الوصف</h2>
          <p className="text-sm leading-7 text-muted-foreground">{item.description}</p>
        </div>

        <div className="mt-4 flex items-start gap-2 rounded-2xl bg-accent/50 p-3 text-xs text-accent-foreground">
          <Info className="mt-0.5 size-4 shrink-0 text-primary" />
          <p>
            يتم تأكيد الحجز بعد مراجعة إيصال التحويل خلال 24 ساعة، وستجد تذكرتك مع رمز QR في صفحة
            «حجوزاتي».
          </p>
        </div>

        <Button
          disabled={soldOut}
          onClick={() => {
            if (user) navigate({ to: "/booking/$id", params: { id } });
            else navigate({ to: "/auth" });
          }}
          className="mt-5 mb-2 h-14 w-full rounded-2xl text-lg font-extrabold shadow-glow"
        >
          {soldOut ? "نفدت المقاعد" : "احجز الآن"}
        </Button>
      </div>
    </div>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
  className,
  highlight,
  danger,
}: {
  icon: typeof CalendarDays;
  label: string;
  value: string;
  className?: string;
  highlight?: boolean;
  danger?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-3 rounded-2xl border border-border bg-card p-3 shadow-card ${className ?? ""}`}
    >
      <div
        className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${
          highlight ? "bg-primary/15 text-primary" : "bg-accent text-primary"
        }`}
      >
        <Icon className="size-5" />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] text-muted-foreground">{label}</p>
        <p
          className={`truncate text-sm font-bold ${
            danger ? "text-destructive" : highlight ? "text-primary" : "text-foreground"
          }`}
        >
          {value}
        </p>
      </div>
    </div>
  );
}
