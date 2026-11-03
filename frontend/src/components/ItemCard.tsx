import { Link } from "@tanstack/react-router";
import { CalendarDays, MapPin, Users } from "lucide-react";
import type { Item } from "@/lib/api";
import { TYPE_LABEL, formatPrice, formatShortDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export function ItemCard({ item, remaining }: { item: Item; remaining: number }) {
  return (
    <Link
      to="/details/$id"
      params={{ id: item.id }}
      className="block overflow-hidden rounded-2xl border border-border bg-card shadow-card transition-transform active:scale-[0.98]"
    >
      <div className="relative aspect-[16/9] w-full overflow-hidden bg-accent">
        {item.image ? (
          <img
            src={item.image}
            alt={item.title}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/30 via-secondary to-background text-4xl">
            {item.type === "event" ? "🎟️" : "🎓"}
          </div>
        )}
        <span className="absolute start-3 top-3 rounded-full bg-background/80 px-3 py-1 text-[11px] font-bold text-primary backdrop-blur-sm">
          {TYPE_LABEL[item.type]}
        </span>
      </div>
      <div className="space-y-2.5 p-4">
        <h3 className="line-clamp-1 font-bold text-foreground">{item.title}</h3>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex shrink-0 items-center gap-1">
            <CalendarDays className="size-3.5 text-primary" />
            {formatShortDate(item.date)}
          </span>
          <span className="flex min-w-0 items-center gap-1">
            <MapPin className="size-3.5 shrink-0 text-primary" />
            <span className="truncate">{item.location}</span>
          </span>
        </div>
        <div className="flex items-center justify-between border-t border-border/60 pt-2.5">
          <span className="text-sm font-extrabold text-primary">{formatPrice(item.price)}</span>
          <span
            className={cn(
              "flex items-center gap-1 text-xs",
              remaining > 0 ? "text-muted-foreground" : "font-bold text-destructive",
            )}
          >
            <Users className="size-3.5" />
            {remaining > 0
              ? `${new Intl.NumberFormat("ar-EG").format(remaining)} مقعد متبقي`
              : "نفدت المقاعد"}
          </span>
        </div>
      </div>
    </Link>
  );
}

export function ItemCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="aspect-[16/9] w-full animate-pulse bg-muted" />
      <div className="space-y-2.5 p-4">
        <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
        <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
        <div className="h-3 w-1/3 animate-pulse rounded bg-muted" />
      </div>
    </div>
  );
}
