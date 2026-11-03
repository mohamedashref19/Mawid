import { Link, useRouterState } from "@tanstack/react-router";
import { CircleUser, Home, LayoutDashboard, Ticket } from "lucide-react";
import { useMe, useIsStaff } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

export function BottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { data: user } = useMe();
  const isStaff = useIsStaff();

  const items = [
    { to: "/", icon: Home, label: "الرئيسية", active: pathname === "/" },
    { to: "/bookings", icon: Ticket, label: "حجوزاتي", active: pathname.startsWith("/bookings") },
    ...(isStaff
      ? [
          {
            to: "/admin",
            icon: LayoutDashboard,
            label: "الإدارة",
            active: pathname.startsWith("/admin"),
          },
        ]
      : []),
    {
      to: "/auth",
      icon: CircleUser,
      label: user ? user.name.split(" ")[0] : "حسابي",
      active: pathname.startsWith("/auth"),
    },
  ];

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-popover/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl">
      <div className="mx-auto flex max-w-lg items-stretch justify-around px-2">
        {items.map((it) => (
          <Link
            key={it.to}
            to={it.to}
            className={cn(
              "flex min-h-16 flex-1 flex-col items-center justify-center gap-1 text-[11px] font-semibold transition-colors",
              it.active ? "text-primary" : "text-muted-foreground",
            )}
          >
            <it.icon className="size-5" strokeWidth={it.active ? 2.5 : 2} />
            <span className="max-w-16 truncate">{it.label}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}
