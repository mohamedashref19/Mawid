import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowRight,
  CircleUser,
  LayoutDashboard,
  LogOut,
  Phone,
  ShieldCheck,
  Ticket,
  UserRound,
  Eye,
  EyeOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useMe, useInvalidateMe } from "@/hooks/use-auth";
import * as api from "@/lib/api";
import type { Role } from "@/lib/api";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "تسجيل الدخول | CTS " },
      { name: "description", content: "سجل الدخول أو أنشئ حساباً جديداً لحجز تذاكرك." },
      { property: "og:title", content: "تسجيل الدخول | CTS " },
      { property: "og:description", content: "سجل الدخول أو أنشئ حساباً جديداً لحجز تذاكرك." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

const ROLE_LABEL: Record<Role, string> = {
  admin: "مدير النظام",
  employee: "موظف",
  user: "مستخدم",
};

// التحقق من الرقم المصري
const EGYPT_PHONE_REGEX = /^01[0125]\d{8}$/;

function AuthPage() {
  const { data: user, isLoading } = useMe();
  if (isLoading) {
    return (
      <div className="mx-auto max-w-md space-y-4 px-4 pt-10">
        <Skeleton className="mx-auto h-20 w-20 rounded-3xl" />
        <Skeleton className="mx-auto h-5 w-32" />
        <Skeleton className="h-12 w-full rounded-2xl" />
        <Skeleton className="h-12 w-full rounded-2xl" />
      </div>
    );
  }
  return user ? <AccountScreen user={user} /> : <AuthForms />;
}

// ------------------------------ Account ------------------------------

function AccountScreen({ user }: { user: api.User }) {
  const navigate = useNavigate();
  const invalidateMe = useInvalidateMe();
  const isStaff = user.role === "admin" || user.role === "employee";

  return (
    <div className="mx-auto max-w-md px-4 pt-8">
      <div className="flex flex-col items-center gap-3 rounded-3xl border border-border bg-card p-6 text-center shadow-card">
        <div className="flex size-20 items-center justify-center rounded-3xl bg-primary/15 text-primary">
          <CircleUser className="size-12" />
        </div>
        <div>
          <h1 className="text-lg font-extrabold text-foreground">{user.name}</h1>
          <p dir="ltr" className="text-sm text-muted-foreground">
            {user.phone}
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/15 px-3 py-1 text-xs font-bold text-primary">
          <ShieldCheck className="size-3.5" />
          {ROLE_LABEL[user.role]}
        </span>
      </div>

      <div className="mt-4 space-y-3">
        {isStaff && (
          <Button
            asChild
            className="h-12 w-full justify-between rounded-2xl text-base font-bold"
            variant="default"
          >
            <Link to="/admin">
              <span className="flex items-center gap-2">
                <LayoutDashboard className="size-5" /> لوحة الإدارة
              </span>
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        )}
        <Button
          asChild
          variant="secondary"
          className="h-12 w-full justify-between rounded-2xl text-base font-bold"
        >
          <Link to="/bookings">
            <span className="flex items-center gap-2">
              <Ticket className="size-5" /> حجوزاتي
            </span>
            <ArrowRight className="size-4" />
          </Link>
        </Button>
        <Button
          variant="outline"
          className="h-12 w-full justify-center gap-2 rounded-2xl text-base font-bold text-destructive hover:text-destructive"
          onClick={() => {
            api.logout();
            invalidateMe();
            toast.success("تم تسجيل الخروج");
            navigate({ to: "/" });
          }}
        >
          <LogOut className="size-5" /> تسجيل الخروج
        </Button>
      </div>
    </div>
  );
}

// ------------------------------- Forms -------------------------------

function AuthForms() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [showPassword, setShowPassword] = useState(false); // حالة إظهار كلمة المرور
  const navigate = useNavigate();
  const invalidateMe = useInvalidateMe();
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", email: "", password: "" });

  async function submit(e: React.FormEvent) {
    e.preventDefault();

    const cleanPhone = form.phone.trim();
    if (!EGYPT_PHONE_REGEX.test(cleanPhone)) {
      toast.error("يرجى إدخال رقم موبايل مصري صحيح مكون من 11 رقم");
      return;
    }

    if (mode === "register") {
      const cleanEmail = form.email.trim();
      if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
        toast.error("يرجى إدخال بريد إلكتروني صحيح");
        return;
      }
      if (form.password.length < 6) {
        toast.error("كلمة المرور يجب أن تكون 6 أحرف أو أرقام على الأقل");
        return;
      }
    }

    setBusy(true);
    try {
      let res;
      if (mode === "login") {
        res = await api.login({ phone: cleanPhone, password: form.password });
        toast.success(`أهلاً بعودتك، ${res.user.name}`);
      } else {
        res = await api.register({
          name: form.name.trim(),
          phone: cleanPhone,
          email: form.email.trim(),
          password: form.password,
        });
        toast.success("تم إنشاء الحساب بنجاح");
      }

      api.setToken(res.token);
      localStorage.setItem("token", res.token);

      await invalidateMe();
      navigate({ to: res.user.role === "user" ? "/" : "/admin" });
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } }; message?: string };
      const errorMessage =
        err.response?.data?.message || err.message || "حدث خطأ في الاتصال بالسيرفر";
      toast.error(errorMessage);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 pt-8">
      <div className="text-center">
        <div className="mx-auto flex size-16 items-center justify-center rounded-3xl bg-primary text-primary-foreground shadow-glow">
          {/* <UserRound className="size-8" /> */}
          <img src="/logo.png" alt="CTS Logo" className="h-full w-full object-cover" />
        </div>
        <h1 className="mt-3 text-xl font-extrabold text-foreground">
          {mode === "login" ? "تسجيل الدخول" : "إنشاء حساب جديد"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">احجز فعاليتك وكورساتك بسهولة</p>
      </div>

      <form
        onSubmit={submit}
        className="mt-6 space-y-4 rounded-3xl border border-border bg-card p-5 shadow-card"
      >
        {mode === "register" && (
          <>
            <div className="space-y-2">
              <Label htmlFor="name">الاسم</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="مثال: محمد اشرف"
                className="h-12 rounded-2xl bg-muted"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">البريد الإلكتروني</Label>
              <Input
                id="email"
                type="email"
                dir="ltr"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="name@gmail.com"
                className="h-12 rounded-2xl bg-muted text-right"
                required
              />
            </div>
          </>
        )}
        <div className="space-y-2">
          <Label htmlFor="phone">رقم الهاتف</Label>
          <div className="relative flex items-center">
            {/* أيقونة التليفون موضوعة على اليسار وتطبيق padding مناسب للإدخال */}
            <Phone className="absolute left-4 size-5 text-muted-foreground pointer-events-none" />
            <Input
              id="phone"
              type="tel"
              inputMode="numeric"
              maxLength={11}
              dir="ltr"
              value={form.phone}
              onChange={(e) => {
                const digitsOnly = e.target.value.replace(/\D/g, "").slice(0, 11);
                setForm({ ...form, phone: digitsOnly });
              }}
              placeholder="01xxxxxxxxx"
              className="h-12 rounded-2xl bg-muted pl-12 pr-4 text-right w-full"
              required
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">كلمة المرور</Label>
          <div className="relative flex items-center">
            {/* زر إظهار/إخفاء كلمة المرور على اليسار */}
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute left-4 p-1 text-muted-foreground hover:text-primary transition-colors focus:outline-none"
              aria-label={showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
            >
              {showPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
            </button>
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              dir="ltr"
              minLength={6}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="••••••••"
              className="h-12 rounded-2xl bg-muted pl-12 pr-4 text-right w-full"
              required
            />
          </div>
        </div>
        <Button
          type="submit"
          disabled={busy}
          className="h-12 w-full rounded-2xl text-base font-bold shadow-glow mt-6"
        >
          {busy ? "جاري المعالجة..." : mode === "login" ? "دخول" : "إنشاء الحساب"}
        </Button>
        <p className="text-center text-sm text-muted-foreground mt-4">
          {mode === "login" ? "ليس لديك حساب؟" : "لديك حساب بالفعل؟"}{" "}
          <button
            type="button"
            onClick={() => {
              setMode(mode === "login" ? "register" : "login");
              setForm({ name: "", phone: "", email: "", password: "" });
            }}
            className="font-bold text-primary"
          >
            {mode === "login" ? "سجل الآن" : "سجل الدخول"}
          </button>
        </p>
      </form>
    </div>
  );
}
