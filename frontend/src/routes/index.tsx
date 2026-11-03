import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { CalendarCheck, Search, SearchX } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ItemCard, ItemCardSkeleton } from "@/components/ItemCard";
import * as api from "@/lib/api";
import type { ItemType } from "@/lib/api";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "موعد | حجز الفعاليات والكورسات" },
      { name: "description", content: "تصفح أحدث الفعاليات والكورسات واحجز تذكرتك في دقائق." },
      { property: "og:title", content: "موعد | حجز الفعاليات والكورسات" },
      {
        property: "og:description",
        content: "تصفح أحدث الفعاليات والكورسات واحجز تذكرتك في دقائق.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

type Tab = "all" | ItemType;

function Index() {
  const [tab, setTab] = useState<Tab>("all");
  const [search, setSearch] = useState("");

  const { data: items, isLoading } = useQuery({
    queryKey: ["items", tab, search],
    queryFn: async () => {
      const list = await api.listItems(tab, search);
      return list.map((item) => ({
        ...item,
        remaining: Math.max(0, item.capacity - api.bookedSeatsSync(item.id)),
      }));
    },
  });

  return (
    <div className="mx-auto max-w-5xl px-4">
      <header className="flex items-center gap-3 pt-6">
        <div className="flex size-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-glow">
          <CalendarCheck className="size-6" />
        </div>
        <div>
          <h1 className="text-xl font-extrabold text-foreground">Mawid</h1>
          <p className="text-xs text-muted-foreground">فعاليتك وكورساتك في مكان واحد</p>
        </div>
      </header>

      <div className="relative mt-5">
        <Search className="absolute end-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="ابحث عن فعالية أو كورس..."
          className="h-12 rounded-2xl bg-card pe-10 text-sm"
        />
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)} className="mt-4">
        <TabsList className="grid w-full grid-cols-3 rounded-2xl bg-card p-1">
          <TabsTrigger
            value="all"
            className="rounded-xl text-sm font-bold data-[state=active]:bg-accent"
          >
            الكل
          </TabsTrigger>
          <TabsTrigger
            value="event"
            className="rounded-xl text-sm font-bold data-[state=active]:bg-accent"
          >
            الفعاليات
          </TabsTrigger>
          <TabsTrigger
            value="course"
            className="rounded-xl text-sm font-bold data-[state=active]:bg-accent"
          >
            كورسات
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <main className="mt-5">
        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <ItemCardSkeleton key={i} />
            ))}
          </div>
        ) : items && items.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item) => (
              <ItemCard key={item.id} item={item} remaining={item.remaining} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-card py-16 text-center">
            <SearchX className="size-10 text-muted-foreground" />
            <p className="font-bold text-foreground">لا توجد نتائج مطابقة</p>
            <p className="text-sm text-muted-foreground">جرّب كلمة بحث مختلفة أو تصفح كل الفئات</p>
          </div>
        )}
      </main>
    </div>
  );
}
