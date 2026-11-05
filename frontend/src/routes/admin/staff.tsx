import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { ArrowRight, UserPlus, Trash2, ShieldAlert, User } from "lucide-react";
import { toast } from "sonner";
import { useRequireRole } from "@/hooks/use-auth";
import * as api from "@/lib/api";
import { ConfirmModal } from "@/components/ConfirmModal"; // إضافة الـ Modal المخصص

export const Route = createFileRoute("/admin/staff")({
  component: AdminStaffs,
});

const EGYPT_PHONE_REGEX = /^01[0125]\d{8}$/;

function AdminStaffs() {
  const { ready } = useRequireRole(["admin"]);
  const [staff, setStaff] = useState<(api.User & { role: api.Role })[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    password: "",
    role: "employee" as api.Role,
  });

  // حالة المودال لحذف الموظف
  const [deleteStaffId, setDeleteStaffId] = useState<string | null>(null);

  const fetchStaff = async () => {
    try {
      setLoading(true);
      setStaff(await api.adminListStaff());
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "حدث خطأ");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (ready) {
      void fetchStaff();
    }
  }, [ready]);

  // إخفاء المحتوى تماماً
  if (!ready) return null;

  const executeDelete = async () => {
    if (!deleteStaffId) return;
    try {
      await api.adminDeleteStaff(deleteStaffId);
      toast.success("تم حذف الموظف بنجاح");
      await fetchStaff();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "حدث خطأ أثناء الحذف");
    } finally {
      setDeleteStaffId(null);
    }
  };

  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();

    const cleanPhone = formData.phone.trim();
    const cleanEmail = formData.email.trim();

    if (!EGYPT_PHONE_REGEX.test(cleanPhone)) {
      toast.error("يرجى إدخال رقم موبايل مصري صحيح مكون من 11 رقم");
      return;
    }

    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      toast.error("يرجى إدخال بريد إلكتروني صحيح");
      return;
    }

    if (formData.password.length < 6) {
      toast.error("كلمة المرور يجب أن تكون 6 أحرف أو أرقام على الأقل");
      return;
    }

    try {
      await api.adminCreateStaff({
        name: formData.name.trim(),
        phone: cleanPhone,
        email: cleanEmail,
        password: formData.password,
        role: formData.role,
      });
      toast.success("تم إضافة الموظف بنجاح");
      setIsModalOpen(false);
      setFormData({ name: "", phone: "", email: "", password: "", role: "employee" });
      await fetchStaff();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "حدث خطأ");
    }
  };

  return (
    <div className="p-8 text-right pb-24 relative" dir="rtl">
      <Link
        to="/admin"
        className="inline-flex items-center gap-2 text-primary hover:text-primary/80 mb-6 bg-card px-4 py-2 rounded-xl border border-border transition-colors font-bold"
      >
        <ArrowRight size={20} />
        <span>رجوع للوحة التحكم</span>
      </Link>

      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-extrabold text-foreground">إدارة الموظفين</h1>
        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-xl flex items-center gap-2 transition-colors font-bold shadow-glow"
        >
          <UserPlus size={20} />
          <span>إضافة موظف</span>
        </button>
      </div>

      <div className="bg-card rounded-3xl p-4 border border-border shadow-card overflow-x-auto">
        <table className="w-full text-foreground min-w-[700px]">
          <thead>
            <tr className="border-b border-border/50 text-primary">
              <th className="p-4 text-right font-extrabold">الاسم</th>
              <th className="p-4 text-right font-extrabold">البريد الإلكتروني</th>
              <th className="p-4 text-right font-extrabold">رقم الموبايل</th>
              <th className="p-4 text-right font-extrabold">الصلاحية</th>
              <th className="p-4 text-center font-extrabold">الإجراءات</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="text-center p-8 font-bold text-muted-foreground">
                  جاري التحميل...
                </td>
              </tr>
            ) : staff.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center p-8 font-bold text-muted-foreground">
                  لا يوجد موظفون حالياً
                </td>
              </tr>
            ) : (
              staff.map((member) => (
                <tr
                  key={member.id}
                  className="border-b border-border/30 hover:bg-muted/30 transition-colors"
                >
                  <td className="p-4 font-bold">{member.name}</td>
                  <td className="p-4 text-muted-foreground" dir="ltr">
                    {member.email || "-"}
                  </td>
                  <td className="p-4 font-bold text-foreground" dir="ltr">
                    {member.phone}
                  </td>
                  <td className="p-4">
                    <div className="inline-flex items-center gap-1">
                      {member.role === "admin" ? (
                        <span className="flex items-center gap-1 bg-destructive/10 text-destructive border border-destructive/20 px-3 py-1 rounded-full text-xs font-bold">
                          <ShieldAlert size={14} /> مدير نظام
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 bg-primary/10 text-primary border border-primary/20 px-3 py-1 rounded-full text-xs font-bold">
                          <User size={14} /> موظف
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="p-4 text-center">
                    <button
                      onClick={() => setDeleteStaffId(member.id)}
                      className="text-destructive hover:text-destructive/80 transition-colors mt-2"
                      title="حذف الموظف"
                    >
                      <Trash2 size={20} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in">
          <form
            onSubmit={handleAddStaff}
            className="bg-card p-6 rounded-3xl border border-border w-[90%] max-w-md shadow-card animate-in zoom-in-95"
          >
            <h2 className="text-2xl font-extrabold text-foreground mb-6">إضافة موظف جديد</h2>

            <div className="space-y-4">
              <input
                required
                placeholder="الاسم"
                className="w-full p-3 rounded-xl bg-muted text-foreground border border-border focus:border-primary outline-none focus:ring-1 focus:ring-primary transition-all"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />

              <input
                required
                type="email"
                placeholder="البريد الإلكتروني"
                dir="ltr"
                className="w-full p-3 rounded-xl bg-muted text-foreground border border-border text-right focus:border-primary outline-none focus:ring-1 focus:ring-primary transition-all"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />

              <input
                required
                type="tel"
                inputMode="numeric"
                maxLength={11}
                placeholder="رقم الموبايل"
                dir="ltr"
                className="w-full p-3 rounded-xl bg-muted text-foreground border border-border text-right focus:border-primary outline-none focus:ring-1 focus:ring-primary transition-all"
                value={formData.phone}
                onChange={(e) => {
                  const digitsOnly = e.target.value.replace(/\D/g, "").slice(0, 11);
                  setFormData({ ...formData, phone: digitsOnly });
                }}
              />

              <input
                required
                placeholder="كلمة المرور (6 أحرف على الأقل)"
                type="password"
                dir="ltr"
                minLength={6}
                className="w-full p-3 rounded-xl bg-muted text-foreground border border-border text-right focus:border-primary outline-none focus:ring-1 focus:ring-primary transition-all"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              />

              <select
                className="w-full p-3 rounded-xl bg-muted text-foreground border border-border focus:border-primary outline-none focus:ring-1 focus:ring-primary transition-all"
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value as api.Role })}
              >
                <option value="employee" className="bg-card text-foreground">
                  موظف
                </option>
                <option value="admin" className="bg-card text-foreground">
                  مدير نظام
                </option>
              </select>
            </div>

            <div className="flex gap-3 mt-8">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="flex-1 rounded-2xl font-bold bg-muted hover:bg-muted/80 text-foreground border border-border h-12 transition-colors"
              >
                إلغاء
              </button>
              <button
                type="submit"
                className="flex-1 rounded-2xl font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-glow h-12 transition-colors"
              >
                حفظ
              </button>
            </div>
          </form>
        </div>
      )}

      {/* المودال المخصص للحذف */}
      <ConfirmModal
        isOpen={!!deleteStaffId}
        title="حذف حساب الموظف"
        message="هل أنت متأكد من حذف حساب هذا الموظف؟ لن يتمكن من الدخول للوحة الإدارة مجدداً."
        confirmText="نعم، احذف"
        isDestructive={true}
        onConfirm={executeDelete}
        onCancel={() => setDeleteStaffId(null)}
      />
    </div>
  );
}
