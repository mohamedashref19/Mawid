import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { toast } from "sonner";
import {
  ArrowRight,
  BadgeCheck,
  CalendarDays,
  CheckCircle2,
  Copy,
  Clock,
  ImagePlus,
  Loader2,
  MapPin,
  Phone,
  User,
  Wallet,
  AtSign,
  CreditCard,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useRequireRole } from "@/hooks/use-auth";
import * as api from "@/lib/api";
import { formatLongDate, formatNumber, formatPrice, formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/booking/$id")({
  head: () => ({
    meta: [
      { title: "إتمام الحجز | موعد" },
      { name: "description", content: "أكمل بيانات الحجز وارفع إيصال التحويل." },
      { property: "og:title", content: "إتمام الحجز | موعد" },
      { property: "og:description", content: "أكمل بيانات الحجز وارفع إيصال التحويل." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: BookingFlow,
});

function BookingFlow() {
  const { id } = Route.useParams();
  const { user, ready } = useRequireRole(["user", "employee", "admin"]);
  const { data, isLoading } = useQuery({
    queryKey: ["item", id],
    queryFn: async () => {
      const item = await api.getItem(id);
      return { item, remaining: Math.max(0, item.capacity - api.bookedSeatsSync(item.id)) };
    },
    enabled: ready,
  });

  if (isLoading || !ready || !data) {
    return (
      <div className="mx-auto max-w-md space-y-4 px-4 pt-6">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-32 w-full rounded-2xl" />
        <Skeleton className="h-12 w-full rounded-2xl" />
      </div>
    );
  }

  const { item, remaining } = data;
  return <Flow item={item} remaining={remaining} user={user!} />;
}

function Flow({ item, remaining, user }: { item: api.Item; remaining: number; user: api.User }) {
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [quantity, setQuantity] = useState(1);
  const [screenshot, setScreenshot] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [booking, setBooking] = useState<api.Booking | null>(null);

  // جلب الإعدادات العامة كبديل احتياطي لو مفيش طريقة دفع مخصصة للايفنت
  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: () => api.getSettings(),
  });

  const total = item.price * quantity;
  const max = Math.max(1, remaining);

  function pickFile(file: File) {
    if (file.size > 2 * 1024 * 1024) {
      toast.error("حجم الصورة كبير — الحد الأقصى 2 ميجابايت");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setScreenshot(String(reader.result));
    reader.readAsDataURL(file);
  }

  async function submit() {
    if (!screenshot) {
      toast.error("يرجى رفع صورة إيصال الدفع / التحويل");
      return;
    }
    setSubmitting(true);
    try {
      const b = await api.createBooking({
        itemId: item.id,
        quantity,
        paymentScreenshot: screenshot,
      });
      setBooking(b);
      setStep(3);
      toast.success("تم إرسال الحجز بنجاح — قيد المراجعة");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "فشل إرسال الحجز");
    } finally {
      setSubmitting(false);
    }
  }

  // تحديد طريقة الدفع، بياناتها، والأيقونات بناءً على إعدادات الفعالية
  // استخدام ts-ignore في حال لم يتم تحديث الـ type في api.ts بالكامل عند التشغيل
  const method = item.paymentMethod || "wallet";
  const target = item.paymentTarget || settings?.transferPhone || "";

  let methodTitle = "محفظة إلكترونية (كاش)";
  let methodIcon = <Wallet className="size-6 text-primary" />;
  let instructions =
    "قم بتحويل المبلغ المطلوب إلى رقم المحفظة التالي، ثم ارفع صورة إيصال التحويل بالأسفل.";

  if (method === "instapay") {
    methodTitle = "تحويل عبر إنستا باي (InstaPay)";
    methodIcon = <AtSign className="size-6 text-primary" />;
    instructions =
      "قم بتحويل المبلغ المطلوب إلى رقم انستا باي التالي، ثم ارفع صورة تأكيد التحويل بالأسفل.";
  } else if (method === "link") {
    methodTitle = "دفع إلكتروني (فيزا / بطاقة بنكية)";
    methodIcon = <CreditCard className="size-6 text-primary" />;
    instructions =
      "قم بالضغط على الرابط بالأسفل لإتمام الدفع، ثم التقط صورة لشاشة تأكيد الدفع بنجاح وارفعها هنا.";
  }

  // ---------------------------- Step 3: success ----------------------------
  if (step === 3 && booking) {
    return (
      <div className="mx-auto max-w-md px-4 pt-10 text-center">
        <div className="flex flex-col items-center gap-3 rounded-3xl border border-border bg-card p-8 shadow-card">
          <CheckCircle2 className="size-16 text-primary" />
          <h1 className="text-xl font-extrabold text-foreground">تم استلام حجزك!</h1>
          <p className="text-sm text-muted-foreground">
            حالة الحجز الآن «قيد المراجعة» — سيتم التأكيد خلال 24 ساعة بعد مراجعة الإيصال.
          </p>
          <div className="w-full rounded-2xl bg-muted p-4">
            <p className="text-xs text-muted-foreground">رقم الحجز</p>
            <p dir="ltr" className="text-2xl font-extrabold tracking-wider text-primary">
              {booking.code}
            </p>
          </div>
          <Button
            onClick={() => navigate({ to: "/bookings" })}
            className="h-12 w-full rounded-2xl font-bold shadow-glow"
          >
            عرض حجوزاتي
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-4">
      <header className="flex items-center gap-3 pt-6">
        {step === 2 && (
          <button
            onClick={() => setStep(1)}
            aria-label="رجوع"
            className="flex size-9 items-center justify-center rounded-full bg-card"
          >
            <ArrowRight className="size-5" />
          </button>
        )}
        <h1 className="text-xl font-extrabold text-foreground">
          {step === 1 ? "تأكيد التفاصيل" : "تعليمات الدفع"}
        </h1>
        <span className="ms-auto rounded-full bg-accent px-3 py-1 text-xs font-bold text-primary">
          خطوة {formatNumber(step)} من ٢
        </span>
      </header>

      {step === 1 ? (
        <div className="mt-5 space-y-4">
          <SummaryCard item={item} />

          <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
            <p className="mb-3 font-bold text-foreground">عدد التذاكر</p>
            <div className="flex items-center justify-between">
              <StepperBtn
                onClick={() => setQuantity((q) => Math.min(max, q + 1))}
                disabled={quantity >= max}
              >
                +
              </StepperBtn>
              <span className="text-2xl font-extrabold text-foreground">
                {formatNumber(quantity)}
              </span>
              <StepperBtn
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                disabled={quantity <= 1}
              >
                −
              </StepperBtn>
            </div>
            {remaining < 5 && remaining > 0 && (
              <p className="mt-3 rounded-xl bg-pending/10 px-3 py-2 text-center text-xs font-bold text-pending">
                مقاعد محدودة! تبقى {formatNumber(remaining)} فقط
              </p>
            )}
          </div>

          <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
            <p className="mb-3 font-bold text-foreground">بيانات الحاجز</p>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p className="flex items-center gap-2">
                <User className="size-4 text-primary" /> {user.name}
              </p>
              <p className="flex items-center gap-2">
                <Phone className="size-4 text-primary" />
                <span dir="ltr">{user.phone}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-2xl bg-primary/10 p-4">
            <span className="font-bold text-foreground">الإجمالي</span>
            <span className="text-xl font-extrabold text-primary">{formatPrice(total)}</span>
          </div>

          <Button
            disabled={remaining <= 0}
            onClick={() => setStep(2)}
            className="h-14 w-full rounded-2xl text-lg font-extrabold shadow-glow"
          >
            {remaining <= 0 ? "نفدت المقاعد" : "متابعة للدفع"}
          </Button>
        </div>
      ) : (
        <div className="mt-5 space-y-4">
          {/* كارت الدفع المحدث */}
          <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
            <div className="flex items-center gap-2 mb-2">
              {methodIcon}
              <p className="font-bold text-foreground text-lg">{methodTitle}</p>
            </div>

            <p className="text-sm leading-7 text-muted-foreground">{instructions}</p>

            {method === "link" ? (
              <a
                href={target}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 flex w-full items-center justify-center rounded-2xl bg-primary/10 text-primary font-bold p-3 transition-colors hover:bg-primary/20"
              >
                الانتقال لصفحة الدفع
              </a>
            ) : (
              <button
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(target);
                    toast.success("تم النسخ بنجاح");
                  } catch {
                    toast.error("تعذر النسخ");
                  }
                }}
                className="mt-4 flex w-full items-center justify-between rounded-2xl bg-muted p-3 hover:bg-muted/80 transition-colors"
              >
                <span className="flex items-center gap-2 text-sm text-muted-foreground">
                  اضغط للنسخ
                </span>
                <span dir="ltr" className="flex items-center gap-2 font-extrabold text-foreground">
                  {target}
                  <Copy className="size-4 text-primary" />
                </span>
              </button>
            )}

            <div className="mt-4 flex items-center justify-between rounded-2xl bg-primary/10 p-3">
              <span className="text-sm font-bold text-foreground">المبلغ المطلوب</span>
              <span className="text-lg font-extrabold text-primary">{formatPrice(total)}</span>
            </div>
          </div>

          {/* كارت رفع الإيصال */}
          <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
            <p className="mb-3 font-bold text-foreground">صورة إيصال التحويل / الدفع</p>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) pickFile(f);
              }}
            />
            {screenshot ? (
              <button onClick={() => fileRef.current?.click()} className="block w-full">
                <img
                  src={screenshot}
                  alt="إيصال التحويل"
                  className="max-h-56 w-full rounded-xl object-contain"
                />
                <span className="mt-2 block text-xs text-primary">اضغط لاستبدال الصورة</span>
              </button>
            ) : (
              <button
                onClick={() => fileRef.current?.click()}
                className="flex h-32 w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border text-muted-foreground hover:bg-muted/50 transition-colors"
              >
                <ImagePlus className="size-8 text-primary" />
                <span className="text-sm font-bold">ارفع صورة الإيصال</span>
                <span className="text-xs">PNG أو JPG — حتى 2MB</span>
              </button>
            )}
          </div>

          <Button
            onClick={submit}
            disabled={submitting}
            className="h-14 w-full rounded-2xl text-lg font-extrabold shadow-glow"
          >
            {submitting ? (
              <>
                <Loader2 className="size-5 animate-spin" /> جاري الإرسال...
              </>
            ) : (
              <>
                <BadgeCheck className="size-5" /> إرسال الحجز
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}

function SummaryCard({ item }: { item: api.Item }) {
  return (
    <div className="flex gap-3 rounded-2xl border border-border bg-card p-3 shadow-card">
      <div className="size-20 shrink-0 overflow-hidden rounded-xl bg-accent">
        {item.image ? (
          <img src={item.image} alt="" className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-3xl">
            {item.type === "event" ? "🎟️" : "🎓"}
          </div>
        )}
      </div>
      <div className="min-w-0 space-y-1">
        <h2 className="line-clamp-1 font-bold text-foreground">{item.title}</h2>
        <div className="space-y-0.5 text-xs text-muted-foreground">
          <p className="flex items-center gap-1.5">
            <CalendarDays className="size-3.5" /> {formatLongDate(item.date)}
          </p>
          <p className="flex items-center gap-1.5">
            <Clock className="size-3.5" /> {formatTime(item.time)}
          </p>
          <p className="flex items-center gap-1.5">
            <MapPin className="size-3.5" /> {item.location}
          </p>
        </div>
      </div>
    </div>
  );
}

function StepperBtn({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex size-12 items-center justify-center rounded-2xl text-2xl font-bold transition-colors",
        disabled ? "bg-muted text-muted-foreground/50" : "bg-accent text-primary active:scale-95",
      )}
    >
      {children}
    </button>
  );
}
