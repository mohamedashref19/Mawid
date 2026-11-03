import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import { ArrowRight, Plus, Edit, Trash2, ImagePlus, Save, X } from "lucide-react";
import { toast } from "sonner";
import * as api from "@/lib/api";

export const Route = createFileRoute("/admin/events")({
  component: AdminEvents,
});

const INITIAL_FORM: api.NewItemInput = {
  title: "",
  type: "course",
  attendanceMode: "online",
  description: "",
  date: "",
  time: "18:00",
  location: "",
  price: 0,
  capacity: 50,
  image: "",
  paymentMethod: "wallet" as api.PaymentMethod,
  paymentTarget: "",
  accessLink: "",
};

function AdminEvents() {
  const todayDate = new Date().toISOString().slice(0, 10);
  const [events, setEvents] = useState<api.Item[]>([]);
  const [loading, setLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<api.NewItemInput>(INITIAL_FORM);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchEvents = async () => {
    try {
      setLoading(true);
      setEvents(await api.listItems("all", "", false));
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "فشل جلب الفعاليات");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchEvents();
  }, []);

  const openCreateForm = () => {
    setEditId(null);
    setForm({ ...INITIAL_FORM, date: todayDate });
    setShowForm(true);
  };

  const openEditForm = (item: api.Item) => {
    setEditId(item.id);
    setForm({
      title: item.title,
      type: item.type,
      attendanceMode: item.attendanceMode || (item.type === "course" ? "online" : "offline"),
      description: item.description,
      date: item.date,
      time: item.time,
      location: item.location,
      price: item.price,
      capacity: item.capacity,
      image: item.image,
      paymentMethod: item.paymentMethod || "wallet",
      paymentTarget: item.paymentTarget || "",
      accessLink: item.accessLink || "",
    });
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditId(null);
    setForm(INITIAL_FORM);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("يرجى اختيار ملف صورة صحيح");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setForm({ ...form, image: event.target.result as string });
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.image && !editId) {
      toast.error("يرجى اختيار صورة الغلاف");
      return;
    }

    if (form.date < todayDate) {
      toast.error("لا يمكن تحديد تاريخ قديم فات ميعاده!");
      return;
    }

    if (form.price < 0) {
      toast.error("لا يمكن أن يكون السعر بالسالب!");
      return;
    }

    const effectiveMode: api.AttendanceMode =
      form.type === "event" ? "offline" : form.attendanceMode;

    const submitData: api.NewItemInput = {
      ...form,
      attendanceMode: effectiveMode,
      accessLink:
        form.type === "course" && effectiveMode === "online" ? (form.accessLink ?? "").trim() : "",
    };

    setBusy(true);
    try {
      if (editId) {
        await api.adminUpdateItem(editId, submitData);
        toast.success("تم تحديث الفعالية بنجاح");
      } else {
        await api.adminCreateItem(submitData);
        toast.success("تم إضافة الفعالية بنجاح");
      }
      closeForm();
      await fetchEvents();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "حدث خطأ أثناء الحفظ");
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("هل أنت متأكد من حذف هذه الفعالية نهائياً؟")) return;
    try {
      await api.adminDeleteItem(id);
      toast.success("تم الحذف بنجاح");
      await fetchEvents();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "حدث خطأ أثناء الحذف");
    }
  };

  if (showForm) {
    return (
      <div className="p-8 text-right pb-24 max-w-3xl mx-auto" dir="rtl">
        <button
          type="button"
          onClick={closeForm}
          className="inline-flex items-center gap-2 text-primary hover:text-primary/80 mb-6 bg-card px-4 py-2 rounded-xl border border-border transition-colors"
        >
          <ArrowRight size={20} />
          <span>رجوع لقائمة الفعاليات</span>
        </button>

        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-white">
            {editId ? "تعديل الفعالية" : "إضافة فعالية جديدة"}
          </h1>
          <button
            type="button"
            onClick={closeForm}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-card rounded-3xl p-6 border border-border space-y-6"
        >
          {/* رفع الصورة */}
          <div className="space-y-2">
            <label className="text-primary block font-bold">صورة الغلاف</label>
            <div
              onClick={() => fileInputRef.current?.click()}
              className="w-full h-48 border-2 border-dashed border-primary/50 rounded-2xl flex flex-col items-center justify-center cursor-pointer overflow-hidden hover:bg-muted transition-colors relative group"
            >
              {form.image ? (
                <>
                  <img src={form.image} alt="Preview" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                    <p className="text-white font-bold">تغيير الصورة</p>
                  </div>
                </>
              ) : (
                <>
                  <ImagePlus size={40} className="text-teal-500/50 mb-2" />
                  <p className="text-primary/50 text-sm">اضغط لاختيار صورة (JPG, PNG)</p>
                </>
              )}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                ref={fileInputRef}
                onChange={handleImageChange}
              />
            </div>
          </div>

          {/* العنوان والنوع */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-primary block font-bold">العنوان</label>
              <input
                type="text"
                required
                placeholder="مثال: كورس برمجة متقدم"
                className="w-full p-3 rounded-xl bg-muted text-white border border-border focus:border-primary outline-none"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <label className="text-primary block font-bold">النوع</label>
              <select
                className="w-full p-3 rounded-xl bg-muted text-white border border-border focus:border-primary outline-none"
                value={form.type}
                onChange={(e) => {
                  const newType = e.target.value as api.ItemType;
                  setForm({
                    ...form,
                    type: newType,
                    attendanceMode: newType === "event" ? "offline" : form.attendanceMode,
                  });
                }}
              >
                <option value="course" className="bg-card">
                  كورس
                </option>
                <option value="event" className="bg-card">
                  ايفنت
                </option>
              </select>
            </div>
          </div>

          {/* خيارات الكورس: أونلاين أم أوفلاين */}
          {form.type === "course" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-4">
              <div className="space-y-2">
                <label className="text-primary block font-bold">نظام حضور الكورس</label>
                <select
                  className="w-full p-3 rounded-xl bg-muted text-white border border-border focus:border-primary outline-none"
                  value={form.attendanceMode}
                  onChange={(e) =>
                    setForm({ ...form, attendanceMode: e.target.value as api.AttendanceMode })
                  }
                >
                  <option value="online" className="bg-card">
                    أونلاين (رابط انضمام / رسالة)
                  </option>
                  <option value="offline" className="bg-card">
                    أوفلاين في المقر (تذكرة QR Code)
                  </option>
                </select>
              </div>

              {form.attendanceMode === "online" && (
                <div className="space-y-2">
                  <label className="text-primary block font-bold">
                    رابط الانضمام (واتساب / زوم) أو رسالة التوجيه
                  </label>
                  <input
                    type="text"
                    required
                    dir="auto"
                    placeholder="https://chat.whatsapp.com/... أو تواصل معنا على رقم..."
                    className="w-full p-3 rounded-xl bg-muted text-white border border-border focus:border-primary outline-none"
                    value={form.accessLink ?? ""}
                    onChange={(e) => setForm({ ...form, accessLink: e.target.value })}
                  />
                </div>
              )}
            </div>
          )}

          {/* التاريخ والوقت */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-primary block font-bold">التاريخ</label>
              <input
                type="date"
                required
                min={todayDate}
                className="w-full p-3 rounded-xl bg-muted text-white border border-border focus:border-primary outline-none"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <label className="text-primary block font-bold">الوقت</label>
              <input
                type="time"
                required
                className="w-full p-3 rounded-xl bg-muted text-white border border-border focus:border-primary outline-none"
                value={form.time}
                onChange={(e) => setForm({ ...form, time: e.target.value })}
              />
            </div>
          </div>

          {/* السعر والسعة والمكان */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-primary block font-bold">السعر (ج.م)</label>
              <input
                type="number"
                required
                min="0"
                placeholder="0"
                className="w-full p-3 rounded-xl bg-muted text-white border border-border focus:border-primary outline-none"
                value={form.price === 0 ? "" : form.price}
                onChange={(e) => {
                  const raw = e.target.value;
                  if (raw === "") {
                    setForm({ ...form, price: 0 });
                    return;
                  }
                  const num = Number(raw);
                  if (!isNaN(num) && num >= 0) {
                    setForm({ ...form, price: num });
                  }
                }}
              />
            </div>
            <div className="space-y-2">
              <label className="text-primary block font-bold">السعة (عدد الأشخاص)</label>
              <input
                type="number"
                required
                min="1"
                placeholder="50"
                className="w-full p-3 rounded-xl bg-muted text-white border border-border focus:border-primary outline-none"
                value={form.capacity === 0 ? "" : form.capacity}
                onChange={(e) => {
                  const raw = e.target.value;
                  if (raw === "") {
                    setForm({ ...form, capacity: 0 });
                    return;
                  }
                  const num = Number(raw);
                  if (!isNaN(num) && num >= 0) {
                    setForm({ ...form, capacity: num });
                  }
                }}
              />
            </div>
            <div className="space-y-2">
              <label className="text-primary block font-bold">المكان / المنصة</label>
              <input
                type="text"
                required
                placeholder={
                  form.type === "course" && form.attendanceMode === "online"
                    ? "مثال: أونلاين (Zoom / جروب واتساب)"
                    : "مثال: قاعة سموحة - الإسكندرية"
                }
                className="w-full p-3 rounded-xl bg-muted text-white border border-border focus:border-primary outline-none"
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
              />
            </div>
          </div>

          {/* إعدادات الدفع */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-border pt-6">
            <div className="space-y-2">
              <label className="text-primary block font-bold">طريقة الدفع المطلوبة</label>
              <select
                className="w-full p-3 rounded-xl bg-muted text-white border border-border focus:border-primary outline-none"
                value={form.paymentMethod}
                onChange={(e) =>
                  setForm({ ...form, paymentMethod: e.target.value as api.PaymentMethod })
                }
              >
                <option value="wallet" className="bg-card">
                  محفظة إلكترونية
                </option>
                <option value="instapay" className="bg-card">
                  انستا باي (InstaPay)
                </option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-primary block font-bold">
                {form.paymentMethod === "wallet"
                  ? "رقم المحفظة (مثل 010...)"
                  : "رقم أو عنوان InstaPay"}
              </label>
              <input
                type="text"
                required
                dir="ltr"
                placeholder={form.paymentMethod === "wallet" ? "010xxxxxxxx" : "name@instapay"}
                className="w-full p-3 rounded-xl bg-muted text-white border border-border focus:border-primary outline-none text-right"
                value={form.paymentTarget}
                onChange={(e) => setForm({ ...form, paymentTarget: e.target.value })}
              />
            </div>
          </div>

          {/* الوصف */}
          <div className="space-y-2">
            <label className="text-primary block font-bold">التفاصيل والوصف</label>
            <textarea
              required
              rows={4}
              placeholder="اكتب وصفاً جذاباً للفعالية وما سيتعلمه الحضور..."
              className="w-full p-3 rounded-xl bg-muted text-white border border-border focus:border-primary outline-none resize-none"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>

          {/* زر الحفظ */}
          <button
            type="submit"
            disabled={busy}
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
          >
            {busy ? (
              "جاري الحفظ..."
            ) : (
              <>
                <Save size={20} />
                <span>{editId ? "حفظ التعديلات" : "إضافة الفعالية"}</span>
              </>
            )}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="p-8 text-right pb-24" dir="rtl">
      <Link
        to="/admin"
        className="inline-flex items-center gap-2 text-primary hover:text-primary/80 mb-6 bg-card px-4 py-2 rounded-xl border border-border transition-colors"
      >
        <ArrowRight size={20} />
        <span>رجوع للوحة التحكم</span>
      </Link>

      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-white">إدارة الفعاليات والكورسات</h1>
        <button
          type="button"
          onClick={openCreateForm}
          className="bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-xl flex items-center gap-2 transition-colors"
        >
          <Plus size={20} />
          <span>إضافة جديد</span>
        </button>
      </div>

      <div className="bg-card rounded-2xl p-4 border border-border overflow-x-auto">
        <table className="w-full text-white min-w-[800px]">
          <thead>
            <tr className="border-b border-border text-primary">
              <th className="p-3 text-right">العنوان</th>
              <th className="p-3 text-right">النوع</th>
              <th className="p-3 text-right">التاريخ</th>
              <th className="p-3 text-right">السعر</th>
              <th className="p-3 text-right">السعة</th>
              <th className="p-3 text-center">الإجراءات</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="text-center p-4">
                  جاري التحميل...
                </td>
              </tr>
            ) : events.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center p-4">
                  لا توجد فعاليات مضافة
                </td>
              </tr>
            ) : (
              events.map((item) => (
                <tr key={item.id} className="border-b border-border hover:bg-muted/50">
                  <td className="p-3 flex items-center gap-3">
                    {item.image && (
                      <img
                        src={item.image}
                        alt={item.title}
                        className="w-10 h-10 rounded object-cover border border-border"
                      />
                    )}
                    <span>{item.title}</span>
                  </td>
                  <td className="p-3">
                    <span
                      className={`px-2 py-1 rounded text-sm ${
                        item.type === "event"
                          ? "bg-purple-500/20 text-purple-300"
                          : "bg-blue-500/20 text-blue-300"
                      }`}
                    >
                      {item.type === "course"
                        ? `كورس (${item.attendanceMode === "online" ? "أونلاين" : "أوفلاين"})`
                        : "ايفنت"}
                    </span>
                  </td>
                  <td className="p-3" dir="ltr">
                    {item.date}
                  </td>
                  <td className="p-3">{item.price} ج.م</td>
                  <td className="p-3">{item.capacity} شخص</td>
                  <td className="p-3 flex justify-center gap-3">
                    <button
                      type="button"
                      onClick={() => openEditForm(item)}
                      className="text-primary hover:text-primary/80 transition-colors mt-2"
                    >
                      <Edit size={18} />
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDelete(item.id)}
                      className="text-red-500 hover:text-red-400 transition-colors mt-2"
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
    </div>
  );
}
