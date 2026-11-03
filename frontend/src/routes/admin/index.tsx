import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/")({
  component: AdminDashboard,
});

function AdminDashboard() {
  return (
    <div className="p-8 text-right pb-24" dir="rtl">
      <h1 className="text-3xl font-bold text-white mb-8">لوحة تحكم الإدارة</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link
          to="/admin/bookings"
          className="bg-[#0c2221] border border-teal-900/50 p-6 rounded-2xl flex flex-col items-center justify-center hover:bg-teal-900/40 transition-colors"
        >
          <span className="text-2xl font-bold text-teal-400 mb-2">إدارة الحجوزات</span>
          <span className="text-gray-400 text-sm">مراجعة صور التحويل وتأكيد الحجوزات</span>
        </Link>

        <Link
          to="/admin/events"
          className="bg-[#0c2221] border border-teal-900/50 p-6 rounded-2xl flex flex-col items-center justify-center hover:bg-teal-900/40 transition-colors"
        >
          <span className="text-2xl font-bold text-teal-400 mb-2">إدارة الفعاليات</span>
          <span className="text-gray-400 text-sm">إضافة، تعديل، وحذف الكورسات</span>
        </Link>

        <Link
          to="/admin/scanner"
          className="bg-[#0c2221] border border-teal-900/50 p-6 rounded-2xl flex flex-col items-center justify-center hover:bg-teal-900/40 transition-colors"
        >
          <span className="text-2xl font-bold text-teal-400 mb-2">الماسح الضوئي</span>
          <span className="text-gray-400 text-sm">فحص تذاكر الحضور (QR Code)</span>
        </Link>

        <Link
          to="/admin/staff"
          className="bg-[#0c2221] border border-teal-900/50 p-6 rounded-2xl flex flex-col items-center justify-center hover:bg-teal-900/40 transition-colors"
        >
          <span className="text-2xl font-bold text-teal-400 mb-2">إدارة الموظفين</span>
          <span className="text-gray-400 text-sm">إضافة وتعديل حسابات العمل</span>
        </Link>
      </div>
    </div>
  );
}
