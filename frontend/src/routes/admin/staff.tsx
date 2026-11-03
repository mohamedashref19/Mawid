import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { ArrowRight, UserPlus, Trash2, ShieldAlert, User } from "lucide-react";
import { toast } from "sonner";
import * as api from "@/lib/api";

export const Route = createFileRoute("/admin/staff")({
  component: AdminStaffs,
});

// التحقق من الرقم المصري: 11 رقم يبدأ بـ 010 أو 011 أو 012 أو 015
const EGYPT_PHONE_REGEX = /^01[0125]\d{8}$/;

function AdminStaffs() {
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
    fetchStaff();
  }, []);

  const handleDelete = async (id: string) => {
    if (!window.confirm("هل أنت متأكد من حذف هذا الموظف؟")) return;
    try {
      await api.adminDeleteStaff(id);
      toast.success("تم الحذف بنجاح");
      fetchStaff();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "حدث خطأ");
    }
  };

  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();

    const cleanPhone = formData.phone.trim();
    const cleanEmail = formData.email.trim();

    if (!EGYPT_PHONE_REGEX.test(cleanPhone)) {
      toast.error("يرجى إدخال رقم موبايل مصري صحيح مكون من 11 رقم (يبدأ بـ 010، 011، 012، أو 015)");
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
      setFormData({
        name: "",
        phone: "",
        email: "",
        password: "",
        role: "employee",
      });
      fetchStaff();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "حدث خطأ");
    }
  };

  return (
    <div className="p-8 text-right pb-24 relative" dir="rtl">
      <Link
        to="/admin"
        className="inline-flex items-center gap-2 text-teal-400 hover:text-teal-300 mb-6 bg-[#0c2221] px-4 py-2 rounded-xl border border-teal-900/50 transition-colors"
      >
        <ArrowRight size={20} />
        <span>رجوع للوحة التحكم</span>
      </Link>

      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-white">إدارة الموظفين</h1>
        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-teal-600 hover:bg-teal-500 text-white px-4 py-2 rounded-xl flex items-center gap-2 transition-colors"
        >
          <UserPlus size={20} />
          <span>إضافة موظف</span>
        </button>
      </div>

      <div className="bg-[#0c2221] rounded-2xl p-4 border border-teal-900/30 overflow-x-auto">
        <table className="w-full text-white min-w-[700px]">
          <thead>
            <tr className="border-b border-teal-900/50 text-teal-400">
              <th className="p-3 text-right">الاسم</th>
              <th className="p-3 text-right">البريد الإلكتروني</th>
              <th className="p-3 text-right">رقم الموبايل</th>
              <th className="p-3 text-right">الصلاحية</th>
              <th className="p-3 text-center">الإجراءات</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="text-center p-4">
                  جاري التحميل...
                </td>
              </tr>
            ) : staff.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center p-4">
                  لا يوجد موظفون حالياً
                </td>
              </tr>
            ) : (
              staff.map((member) => (
                <tr key={member.id} className="border-b border-teal-900/20 hover:bg-teal-900/10">
                  <td className="p-3">{member.name}</td>
                  <td className="p-3 text-gray-300" dir="ltr">
                    {member.email || "-"}
                  </td>
                  <td className="p-3" dir="ltr">
                    {member.phone}
                  </td>
                  <td className="p-3 flex items-center gap-2">
                    {member.role === "admin" ? (
                      <span className="flex items-center gap-1 bg-red-500/20 text-red-300 px-2 py-1 rounded text-sm">
                        <ShieldAlert size={14} /> مدير نظام
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 bg-green-500/20 text-green-300 px-2 py-1 rounded text-sm">
                        <User size={14} /> موظف
                      </span>
                    )}
                  </td>
                  <td className="p-3 text-center">
                    <button
                      onClick={() => handleDelete(member.id)}
                      className="text-red-500 hover:text-red-400 transition-colors"
                    >
                      <Trash2 size={18} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* مودال الإضافة */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <form
            onSubmit={handleAddStaff}
            className="bg-[#0c2221] p-6 rounded-2xl border border-teal-900/50 w-[90%] max-w-md"
          >
            <h2 className="text-2xl font-bold text-white mb-4">إضافة موظف جديد</h2>

            <input
              required
              placeholder="الاسم"
              className="w-full mb-3 p-3 rounded-xl bg-teal-900/20 text-white border border-teal-900/50 focus:border-teal-500 outline-none"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />

            <input
              required
              type="email"
              placeholder="البريد الإلكتروني "
              dir="ltr"
              className="w-full mb-3 p-3 rounded-xl bg-teal-900/20 text-white border border-teal-900/50 text-right focus:border-teal-500 outline-none"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />

            <input
              required
              type="tel"
              inputMode="numeric"
              maxLength={11}
              placeholder="رقم الموبايل "
              dir="ltr"
              className="w-full mb-3 p-3 rounded-xl bg-teal-900/20 text-white border border-teal-900/50 text-right focus:border-teal-500 outline-none"
              value={formData.phone}
              onChange={(e) => {
                // السماح بالأرقام فقط وبحد أقصى 11 رقم
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
              className="w-full mb-3 p-3 rounded-xl bg-teal-900/20 text-white border border-teal-900/50 text-right focus:border-teal-500 outline-none"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            />

            <select
              className="w-full mb-6 p-3 rounded-xl bg-teal-900/20 text-white border border-teal-900/50 focus:border-teal-500 outline-none"
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value as api.Role })}
            >
              <option value="employee" className="bg-[#0c2221] text-white">
                موظف
              </option>
              <option value="admin" className="bg-[#0c2221] text-white">
                مدير نظام
              </option>
            </select>

            <div className="flex gap-3">
              <button
                type="submit"
                className="flex-1 bg-teal-600 hover:bg-teal-500 text-white py-2 rounded-xl font-bold transition-colors"
              >
                حفظ
              </button>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="flex-1 bg-red-600/20 hover:bg-red-600/30 text-red-400 py-2 rounded-xl font-bold transition-colors"
              >
                إلغاء
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
