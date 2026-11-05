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
  User as UserIcon,
  Eye,
  EyeOff,
  Edit2,
  X,
  ReceiptText,
  KeyRound,
  Mail,
  RefreshCw,
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
      { title: "حسابي | CTS " },
      { name: "description", content: "سجل الدخول أو أنشئ حساباً جديداً لحجز تذاكرك." },
      { property: "og:title", content: "حسابي | CTS " },
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
  user: "عميل",
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

  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(user.name);
  const [passwords, setPasswords] = useState({ current: "", new: "", confirm: "" });
  const [isSaving, setIsSaving] = useState(false);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      if (editName !== user.name) {
        await api.updateProfile({ name: editName });
        toast.success("تم تحديث الاسم بنجاح");
        await invalidateMe();
      }

      if (passwords.new) {
        if (passwords.new !== passwords.confirm) {
          toast.error("كلمات المرور الجديدة غير متطابقة");
          setIsSaving(false);
          return;
        }
        if (!passwords.current) {
          toast.error("يجب إدخال كلمة المرور الحالية");
          setIsSaving(false);
          return;
        }
        await api.updatePassword({
          passwordCurrent: passwords.current,
          password: passwords.new,
          passwordConfirm: passwords.confirm,
        });
        toast.success("تم تحديث كلمة المرور بنجاح");
        setPasswords({ current: "", new: "", confirm: "" });
      }

      setIsEditing(false);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "حدث خطأ أثناء التحديث");
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogout = () => {
    api.logout();
    invalidateMe();
    toast.success("تم تسجيل الخروج");
    navigate({ to: "/" });
  };

  return (
    <div className="mx-auto flex min-h-[calc(100vh-80px)] max-w-md flex-col items-center justify-center p-4">
      <div className="w-full space-y-4 rounded-3xl bg-card p-6 shadow-card border border-border relative">
        {/* زر تعديل أو رجوع */}
        <button
          onClick={() => {
            setIsEditing(!isEditing);
            setPasswords({ current: "", new: "", confirm: "" });
          }}
          className="absolute left-6 top-6 text-muted-foreground hover:text-primary transition-colors"
          title={isEditing ? "إلغاء التعديل" : "تعديل البيانات"}
        >
          {isEditing ? <X className="size-5" /> : <Edit2 className="size-5" />}
        </button>

        <div className="flex flex-col items-center gap-2 mb-6">
          <div className="flex size-16 items-center justify-center overflow-hidden rounded-full bg-primary/10 text-primary border border-primary/20">
            <UserIcon className="size-8" />
          </div>
          {!isEditing && (
            <>
              <h2 className="text-xl font-extrabold text-primary">{user.name}</h2>
              <p className="text-sm text-muted-foreground" dir="ltr">
                {user.phone}
              </p>
              <div className="mt-2 rounded-lg bg-primary/10 border border-primary/20 px-3 py-1 text-xs font-bold text-primary">
                {ROLE_LABEL[user.role]}
              </div>
            </>
          )}
        </div>

        {isEditing ? (
          <form onSubmit={handleUpdateProfile} className="space-y-4 animate-in fade-in">
            <div className="space-y-1">
              <label className="text-xs font-bold text-muted-foreground">الاسم</label>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full rounded-xl bg-background px-4 py-3 text-sm text-foreground border border-border focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors"
                required
              />
            </div>

            <div className="space-y-1 opacity-60">
              <label className="text-xs font-bold text-muted-foreground">
                رقم الهاتف (غير قابل للتعديل)
              </label>
              <input
                type="text"
                value={user.phone}
                disabled
                dir="ltr"
                className="w-full rounded-xl bg-muted px-4 py-3 text-sm text-muted-foreground border border-border cursor-not-allowed"
              />
            </div>

            {user.email && (
              <div className="space-y-1 opacity-60">
                <label className="text-xs font-bold text-muted-foreground">
                  البريد الإلكتروني (غير قابل للتعديل)
                </label>
                <input
                  type="email"
                  value={user.email}
                  disabled
                  dir="ltr"
                  className="w-full rounded-xl bg-muted px-4 py-3 text-sm text-muted-foreground border border-border cursor-not-allowed"
                />
              </div>
            )}

            <div className="pt-4 border-t border-border/50 space-y-3">
              <h3 className="text-sm font-bold text-primary">تغيير كلمة المرور </h3>
              <input
                type="password"
                placeholder="كلمة المرور الحالية"
                value={passwords.current}
                onChange={(e) => setPasswords({ ...passwords, current: e.target.value })}
                className="w-full rounded-xl bg-background px-4 py-3 text-sm text-foreground border border-border focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors"
              />
              <input
                type="password"
                placeholder="كلمة المرور الجديدة"
                value={passwords.new}
                onChange={(e) => setPasswords({ ...passwords, new: e.target.value })}
                className="w-full rounded-xl bg-background px-4 py-3 text-sm text-foreground border border-border focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors"
              />
              <input
                type="password"
                placeholder="تأكيد كلمة المرور الجديدة"
                value={passwords.confirm}
                onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })}
                className="w-full rounded-xl bg-background px-4 py-3 text-sm text-foreground border border-border focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors"
              />
            </div>

            <Button
              type="submit"
              disabled={isSaving}
              className="w-full mt-4 font-bold shadow-glow text-primary-foreground bg-primary hover:bg-primary/90 h-12 rounded-2xl"
            >
              {isSaving ? "جاري الحفظ..." : "حفظ التعديلات"}
            </Button>
          </form>
        ) : (
          <div className="space-y-3 w-full animate-in fade-in">
            {isStaff && (
              <Button
                asChild
                className="w-full justify-between rounded-xl font-bold shadow-glow text-primary-foreground bg-primary hover:bg-primary/90 h-12"
              >
                <Link to="/admin">
                  <span>لوحة الإدارة</span>
                  <LayoutDashboard className="size-5" />
                </Link>
              </Button>
            )}

            <Button
              asChild
              variant="secondary"
              className="w-full justify-between rounded-xl font-bold bg-muted hover:bg-muted/80 text-foreground border border-border/50 h-12"
            >
              <Link to="/bookings">
                <span>حجوزاتي</span>
                <ReceiptText className="size-5" />
              </Link>
            </Button>

            <Button
              variant="outline"
              className="w-full justify-between rounded-xl border-destructive/20 text-destructive hover:bg-destructive hover:text-destructive-foreground font-bold h-12 transition-colors"
              onClick={handleLogout}
            >
              <span>تسجيل الخروج</span>
              <LogOut className="size-5" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

// ------------------------------- Forms -------------------------------

type AuthMode = "login" | "register" | "verify" | "forgot" | "reset";

function AuthForms() {
  const [mode, setMode] = useState<AuthMode>("login");
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
  const invalidateMe = useInvalidateMe();
  const [busy, setBusy] = useState(false);

  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    password: "",
    passwordConfirm: "",
    otp: "",
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);

    try {
      if (mode === "login") {
        const cleanPhone = form.phone.trim();
        const res = await api.login({ phone: cleanPhone, password: form.password });
        if (res.requiresVerification) {
          setForm({ ...form, email: res.email || "" });
          setMode("verify");
          toast.info("يرجى تفعيل حسابك أولاً. تم إرسال كود لبريدك الإلكتروني.");
        } else if (res.user) {
          toast.success(`أهلاً بعودتك، ${res.user.name}`);
          await invalidateMe();
          navigate({ to: res.user.role === "user" ? "/" : "/admin" });
        }
      } else if (mode === "register") {
        const cleanPhone = form.phone.trim();
        if (!EGYPT_PHONE_REGEX.test(cleanPhone)) {
          toast.error("يرجى إدخال رقم موبايل مصري صحيح مكون من 11 رقم");
          setBusy(false);
          return;
        }
        const cleanEmail = form.email.trim();
        if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
          toast.error("يرجى إدخال بريد إلكتروني صحيح");
          setBusy(false);
          return;
        }
        if (form.password.length < 6) {
          toast.error("كلمة المرور يجب أن تكون 6 أحرف على الأقل");
          setBusy(false);
          return;
        }

        const res = await api.register({
          name: form.name.trim(),
          phone: cleanPhone,
          email: cleanEmail,
          password: form.password,
        });
        if (res.requiresVerification) {
          setForm({ ...form, email: res.email || "" });
          setMode("verify");
          toast.success("تم إنشاء الحساب، يرجى إدخال كود التفعيل المُرسل لبريدك.");
        }
      } else if (mode === "verify") {
        const res = await api.verifyOTP({ email: form.email.trim(), otp: form.otp.trim() });
        toast.success("تم تفعيل الحساب بنجاح!");
        await invalidateMe();
        navigate({ to: res.user.role === "user" ? "/" : "/admin" });
      } else if (mode === "forgot") {
        await api.forgotPassword(form.email.trim());
        toast.success("تم إرسال كود استعادة كلمة المرور لبريدك الإلكتروني");
        setMode("reset");
      } else if (mode === "reset") {
        if (form.password !== form.passwordConfirm) {
          toast.error("كلمتا المرور غير متطابقتين");
          setBusy(false);
          return;
        }
        const res = await api.resetPassword({
          email: form.email.trim(),
          otp: form.otp.trim(),
          password: form.password,
          passwordConfirm: form.passwordConfirm,
        });
        toast.success("تم تغيير كلمة المرور بنجاح!");
        await invalidateMe();
        navigate({ to: res.user.role === "user" ? "/" : "/admin" });
      }
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "حدث خطأ في الاتصال");
    } finally {
      setBusy(false);
    }
  }

  const handleResendOTP = async () => {
    try {
      setBusy(true);
      await api.resendOTP(form.email.trim());
      toast.success("تم إعادة إرسال الكود لبريدك الإلكتروني");
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "فشل إعادة الإرسال");
    } finally {
      setBusy(false);
    }
  };

  const titles = {
    login: "تسجيل الدخول",
    register: "إنشاء حساب جديد",
    verify: "تفعيل الحساب",
    forgot: "نسيت كلمة المرور",
    reset: "تغيير كلمة المرور",
  };

  return (
    <div className="mx-auto max-w-md px-4 pt-8 pb-16">
      <div className="text-center">
        <div className="mx-auto flex size-20 items-center justify-center overflow-hidden rounded-3xl bg-primary text-primary-foreground shadow-glow border border-primary/20">
          <img src="/logo.png" alt="CTS Logo" className="h-full w-full object-cover" />
        </div>
        <h1 className="mt-4 text-2xl font-extrabold text-foreground">{titles[mode]}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {mode === "verify"
            ? `أدخل الكود المُرسل إلى ${form.email}`
            : "احجز فعاليتك وكورساتك بسهولة مع CTS"}
        </p>
      </div>

      <form
        onSubmit={submit}
        className="mt-8 space-y-5 rounded-3xl border border-border bg-card p-6 shadow-card"
      >
        {mode === "register" && (
          <div className="animate-in fade-in slide-in-from-top-4 space-y-5">
            <div className="space-y-2">
              <Label htmlFor="name">الاسم</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="مثال: محمد أشرف"
                className="h-12 rounded-2xl bg-muted border-border focus-visible:ring-primary focus-visible:border-primary"
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
                placeholder="name@example.com"
                className="h-12 rounded-2xl bg-muted border-border text-right focus-visible:ring-primary focus-visible:border-primary"
                required
              />
            </div>
          </div>
        )}

        {(mode === "login" || mode === "register") && (
          <div className="animate-in fade-in space-y-5">
            <div className="space-y-2">
              <Label htmlFor="phone">رقم الهاتف</Label>
              <div className="relative flex items-center">
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
                  className="h-12 rounded-2xl bg-muted border-border pl-12 pr-4 text-right w-full focus-visible:ring-primary"
                  required
                />
              </div>
            </div>
          </div>
        )}

        {(mode === "forgot" || mode === "reset") && (
          <div className="animate-in fade-in space-y-2">
            <Label htmlFor="emailReset">البريد الإلكتروني</Label>
            <div className="relative flex items-center">
              <Mail className="absolute left-4 size-5 text-muted-foreground pointer-events-none" />
              <Input
                id="emailReset"
                type="email"
                dir="ltr"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="name@example.com"
                className="h-12 rounded-2xl bg-muted border-border pl-12 pr-4 text-right w-full focus-visible:ring-primary"
                required
                disabled={mode === "reset"}
              />
            </div>
          </div>
        )}

        {(mode === "verify" || mode === "reset") && (
          <div className="animate-in fade-in slide-in-from-top-4 space-y-2">
            <Label htmlFor="otp">كود التفعيل (6 أرقام)</Label>
            <div className="relative flex items-center">
              <KeyRound className="absolute left-4 size-5 text-muted-foreground pointer-events-none" />
              <Input
                id="otp"
                type="text"
                inputMode="numeric"
                maxLength={6}
                dir="ltr"
                value={form.otp}
                onChange={(e) => {
                  const digitsOnly = e.target.value.replace(/\D/g, "").slice(0, 6);
                  setForm({ ...form, otp: digitsOnly });
                }}
                placeholder="000000"
                className="h-12 rounded-2xl bg-muted border-border pl-12 pr-4 text-center text-xl tracking-[0.5em] w-full focus-visible:ring-primary font-bold text-primary"
                required
              />
            </div>
          </div>
        )}

        {(mode === "login" || mode === "register" || mode === "reset") && (
          <div className="animate-in fade-in space-y-2">
            <Label htmlFor="password">
              {mode === "reset" ? "كلمة المرور الجديدة" : "كلمة المرور"}
            </Label>
            <div className="relative flex items-center">
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute left-4 p-1 text-muted-foreground hover:text-primary transition-colors focus:outline-none"
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
                className="h-12 rounded-2xl bg-muted border-border pl-12 pr-4 text-right w-full focus-visible:ring-primary"
                required
              />
            </div>
          </div>
        )}

        {mode === "reset" && (
          <div className="animate-in fade-in space-y-2">
            <Label htmlFor="passwordConfirm">تأكيد كلمة المرور</Label>
            <Input
              id="passwordConfirm"
              type={showPassword ? "text" : "password"}
              dir="ltr"
              minLength={6}
              value={form.passwordConfirm}
              onChange={(e) => setForm({ ...form, passwordConfirm: e.target.value })}
              placeholder="••••••••"
              className="h-12 rounded-2xl bg-muted border-border px-4 text-right w-full focus-visible:ring-primary"
              required
            />
          </div>
        )}

        {mode === "login" && (
          <div className="flex justify-start">
            <button
              type="button"
              onClick={() => setMode("forgot")}
              className="text-sm font-bold text-muted-foreground hover:text-primary transition-colors"
            >
              نسيت كلمة المرور؟
            </button>
          </div>
        )}

        <Button
          type="submit"
          disabled={busy}
          className="h-12 w-full rounded-2xl text-base font-bold shadow-glow mt-8 bg-primary hover:bg-primary/90 text-primary-foreground"
        >
          {busy ? "جاري المعالجة..." : titles[mode]}
        </Button>

        {mode === "verify" && (
          <Button
            type="button"
            variant="ghost"
            disabled={busy}
            onClick={handleResendOTP}
            className="w-full mt-2 text-primary hover:text-primary hover:bg-primary/10 gap-2"
          >
            <RefreshCw className="size-4" /> إعادة إرسال الكود
          </Button>
        )}

        <p className="text-center text-sm text-muted-foreground mt-6">
          {mode === "login"
            ? "ليس لديك حساب؟"
            : mode === "register"
              ? "لديك حساب بالفعل؟"
              : "العودة إلى "}{" "}
          <button
            type="button"
            onClick={() => {
              setMode(
                mode === "login" || mode === "forgot" || mode === "reset" || mode === "verify"
                  ? "register"
                  : "login",
              );
              if (mode === "verify" || mode === "forgot" || mode === "reset") setMode("login");
              setForm({
                name: "",
                phone: "",
                email: "",
                password: "",
                passwordConfirm: "",
                otp: "",
              });
            }}
            className="font-bold text-primary hover:underline underline-offset-4"
          >
            {mode === "login" ? "سجل الآن" : "تسجيل الدخول"}
          </button>
        </p>
      </form>
    </div>
  );
}
