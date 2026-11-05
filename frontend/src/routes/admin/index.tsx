import { createFileRoute, Link } from "@tanstack/react-router";
import { useRequireRole } from "@/hooks/use-auth"; // استدعاء الهوك

export const Route = createFileRoute("/admin/")({
  component: AdminDashboard,
});

function AdminDashboard() {
  // حماية الصفحة: لا يُسمح إلا للـ admin والـ employee
  const { ready } = useRequireRole(["admin", "employee"]);

  // إذا لم يتم التحقق بعد، لا نعرض المحتوى
  if (!ready) return null;

  return (
    <div className="p-8 text-right pb-24 animate-in fade-in" dir="rtl">
      <header className="flex items-center gap-3 mb-8">
        <div className="size-14 shrink-0 rounded-full overflow-hidden border-2 border-primary/20 bg-card shadow-glow">
          <img
            src="https://cts-alex.vercel.app/logo.png"
            alt="CTS Logo"
            className="h-full w-full object-cover"
          />
        </div>
        <div>
          <h1 className="text-3xl font-extrabold text-foreground">لوحة تحكم الإدارة</h1>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link
          to="/admin/bookings"
          className="bg-card border border-border p-6 rounded-3xl flex flex-col items-center justify-center hover:border-primary/50 hover:bg-muted/30 transition-all shadow-sm hover:shadow-card"
        >
          <span className="text-2xl font-extrabold text-primary mb-2">إدارة الحجوزات</span>
          <span className="text-muted-foreground text-sm font-bold">
            مراجعة صور التحويل وتأكيد الحجوزات
          </span>
        </Link>

        <Link
          to="/admin/events"
          className="bg-card border border-border p-6 rounded-3xl flex flex-col items-center justify-center hover:border-primary/50 hover:bg-muted/30 transition-all shadow-sm hover:shadow-card"
        >
          <span className="text-2xl font-extrabold text-primary mb-2">إدارة الفعاليات</span>
          <span className="text-muted-foreground text-sm font-bold">
            إضافة، تعديل، وحذف الكورسات
          </span>
        </Link>

        <Link
          to="/admin/scanner"
          className="bg-card border border-border p-6 rounded-3xl flex flex-col items-center justify-center hover:border-primary/50 hover:bg-muted/30 transition-all shadow-sm hover:shadow-card"
        >
          <span className="text-2xl font-extrabold text-primary mb-2">الماسح الضوئي</span>
          <span className="text-muted-foreground text-sm font-bold">
            فحص تذاكر الحضور (QR Code)
          </span>
        </Link>

        <Link
          to="/admin/staff"
          className="bg-card border border-border p-6 rounded-3xl flex flex-col items-center justify-center hover:border-primary/50 hover:bg-muted/30 transition-all shadow-sm hover:shadow-card"
        >
          <span className="text-2xl font-extrabold text-primary mb-2">إدارة الموظفين</span>
          <span className="text-muted-foreground text-sm font-bold">إضافة وتعديل حسابات العمل</span>
        </Link>
      </div>
    </div>
  );
}
