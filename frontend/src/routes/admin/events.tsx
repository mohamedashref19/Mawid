import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import { ArrowRight, Plus, Edit, Trash2, ImagePlus, Save, X } from "lucide-react";
import { toast } from "sonner";
import * as api from "@/lib/api";
import { useRequireRole } from "@/hooks/use-auth";
import { ConfirmModal } from "@/components/ConfirmModal";
import { normalizeLinksText, parseAccess, validateLinksText } from "@/lib/access";

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
  accessDetails: "",
};

function AdminEvents() {
  const { ready } = useRequireRole(["admin", "employee"]);
  const todayDate = new Date().toISOString().slice(0, 10);
  const [events, setEvents] = useState<api.Item[]>([]);
  const [loading, setLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<api.NewItemInput>(INITIAL_FORM);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [deleteEventId, setDeleteEventId] = useState<string | null>(null);

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
    if (ready) {
      void fetchEvents();
    }
  }, [ready]);

  if (!ready) return null;

  const openCreateForm = () => {
    setEditId(null);
    setForm({ ...INITIAL_FORM, date: todayDate });
    setShowForm(true);
  };

  const openEditForm = (item: api.Item) => {
    setEditId(item.id);
    // بيفصل الروابط عن التفاصيل (وبيتعامل مع الكورسات القديمة اللي كان فيها الاتنين مع بعض)
    const access = parseAccess(item.accessLink, item.accessDetails);
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
      accessLink: access.links.join("\n"),
      accessDetails: access.details,
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

    const isOnlineCourse = form.type === "course" && effectiveMode === "online";

    if (isOnlineCourse) {
      const linksError = validateLinksText(form.accessLink);
      if (linksError) {
        toast.error(linksError);
        return;
      }
      const hasLinks = normalizeLinksText(form.accessLink) !== "";
      const hasDetails = (form.accessDetails ?? "").trim() !== "";
      if (!hasLinks && !hasDetails) {
        toast.error("اكتب رابط انضمام واحد على الأقل أو تفاصيل للكورس الأونلاين");
        return;
      }
    }

    const submitData: api.NewItemInput = {
      ...form,
      attendanceMode: effectiveMode,
      accessLink: isOnlineCourse ? normalizeLinksText(form.accessLink) : "",
      accessDetails: isOnlineCourse ? (form.accessDetails ?? "").trim() : "",
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

  const executeDelete = async () => {
    if (!deleteEventId) return;
    try {
      await api.adminDeleteItem(deleteEventId);
      toast.success("تم الحذف بنجاح");
      await fetchEvents();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "حدث خطأ أثناء الحذف");
    } finally {
      setDeleteEventId(null);
    }
  };

  if (showForm) {
    return (
      <div className="p-8 text-right pb-24 max-w-3xl mx-auto" dir="rtl">
        <button
          type="button"
          onClick={closeForm}
          className="inline-flex items-center gap-2 text-primary hover:text-primary/80 mb-6 bg-card px-4 py-2 rounded-xl border border-border transition-colors font-bold"
        >
          <ArrowRight size={20} />
          <span>رجوع لقائمة الفعاليات</span>
        </button>

        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-foreground">
            {editId ? "تعديل الفعالية" : "إضافة فعالية جديدة"}
          </h1>
          <button
            type="button"
            onClick={closeForm}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-card rounded-3xl p-6 border border-border space-y-6 shadow-card"
        >
          <div className="space-y-2">
            <label className="text-primary block font-bold">صورة الغلاف</label>
            <div
              onClick={() => fileInputRef.current?.click()}
              className="w-full h-48 border-2 border-dashed border-primary/50 rounded-2xl flex flex-col items-center justify-center cursor-pointer overflow-hidden hover:bg-muted/50 transition-colors relative group"
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
                  <ImagePlus size={40} className="text-primary/50 mb-2" />
                  <p className="text-primary/50 text-sm font-bold">اضغط لاختيار صورة (JPG, PNG)</p>
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-primary block font-bold">العنوان</label>
              <input
                type="text"
                required
                placeholder="مثال: كورس برمجة متقدم"
                className="w-full p-3 rounded-xl bg-muted text-foreground border border-border focus:border-primary outline-none focus:ring-1 focus:ring-primary transition-all"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <label className="text-primary block font-bold">النوع</label>
              <select
                className="w-full p-3 rounded-xl bg-muted text-foreground border border-border focus:border-primary outline-none focus:ring-1 focus:ring-primary transition-all"
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
                <option value="course" className="bg-card text-foreground">
                  كورس
                </option>
                <option value="event" className="bg-card text-foreground">
                  ايفنت
                </option>
              </select>
            </div>
          </div>

          {form.type === "course" && (
            <div className="grid grid-cols-1 gap-4 animate-in fade-in slide-in-from-top-4">
              <div className="space-y-2">
                <label className="text-primary block font-bold">نظام حضور الكورس</label>
                <select
                  className="w-full p-3 rounded-xl bg-muted text-foreground border border-border focus:border-primary outline-none focus:ring-1 focus:ring-primary transition-all"
                  value={form.attendanceMode}
                  onChange={(e) =>
                    setForm({ ...form, attendanceMode: e.target.value as api.AttendanceMode })
                  }
                >
                  <option value="online" className="bg-card text-foreground">
                    أونلاين (رابط انضمام + تفاصيل + QR Code)
                  </option>
                  <option value="offline" className="bg-card text-foreground">
                    أوفلاين في المقر (تذكرة QR Code)
                  </option>
                </select>
              </div>

              {form.attendanceMode === "online" && (
                <>
                  <div className="space-y-2">
                    <label className="text-primary block font-bold">روابط الانضمام</label>
                    <p className="text-xs text-muted-foreground">
                      ضع كل رابط في سطر مستقل (واتساب، Zoom، Meet...). بتظهر للمشتركين كأزرار بعد
                      تأكيد الحجز.
                    </p>
                    <textarea
                      rows={3}
                      dir="ltr"
                      placeholder={"https://chat.whatsapp.com/...\nhttps://zoom.us/j/..."}
                      className="w-full p-3 rounded-xl bg-muted text-foreground border border-border focus:border-primary outline-none resize-none focus:ring-1 focus:ring-primary transition-all text-left text-sm"
                      value={form.accessLink ?? ""}
                      onChange={(e) => setForm({ ...form, accessLink: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-primary block font-bold">تفاصيل الكورس</label>
                    <p className="text-xs text-muted-foreground">
                      المواعيد، كلمة السر، تعليمات الحضور... (بتظهر للمشتركين فقط بعد تأكيد الحجز)
                    </p>
                    <textarea
                      rows={4}
                      dir="auto"
                      maxLength={2000}
                      placeholder={
                        "مثال:\nأهلاً بك في الكورس! المحاضرات كل سبت وثلاثاء الساعة 8 مساءً.\nكلمة سر الاجتماع: 1234"
                      }
                      className="w-full p-3 rounded-xl bg-muted text-foreground border border-border focus:border-primary outline-none resize-none focus:ring-1 focus:ring-primary transition-all leading-relaxed"
                      value={form.accessDetails ?? ""}
                      onChange={(e) => setForm({ ...form, accessDetails: e.target.value })}
                    />
                  </div>
                </>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-primary block font-bold">التاريخ</label>
              <input
                type="date"
                required
                min={todayDate}
                className="w-full p-3 rounded-xl bg-muted text-foreground border border-border focus:border-primary outline-none focus:ring-1 focus:ring-primary transition-all"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <label className="text-primary block font-bold">الوقت</label>
              <input
                type="time"
                required
                className="w-full p-3 rounded-xl bg-muted text-foreground border border-border focus:border-primary outline-none focus:ring-1 focus:ring-primary transition-all"
                value={form.time}
                onChange={(e) => setForm({ ...form, time: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-primary block font-bold">السعر (ج.م)</label>
              <input
                type="number"
                required
                min="0"
                placeholder="0"
                className="w-full p-3 rounded-xl bg-muted text-foreground border border-border focus:border-primary outline-none focus:ring-1 focus:ring-primary transition-all"
                value={form.price === 0 ? "" : form.price}
                onChange={(e) => {
                  const raw = e.target.value;
                  if (raw === "") {
                    setForm({ ...form, price: 0 });
                    return;
                  }
                  const num = Number(raw);
                  if (!isNaN(num) && num >= 0) setForm({ ...form, price: num });
                }}
              />
            </div>
            <div className="space-y-2">
              <label className="text-primary block font-bold">السعة</label>
              <input
                type="number"
                required
                min="1"
                placeholder="50"
                className="w-full p-3 rounded-xl bg-muted text-foreground border border-border focus:border-primary outline-none focus:ring-1 focus:ring-primary transition-all"
                value={form.capacity === 0 ? "" : form.capacity}
                onChange={(e) => {
                  const raw = e.target.value;
                  if (raw === "") {
                    setForm({ ...form, capacity: 0 });
                    return;
                  }
                  const num = Number(raw);
                  if (!isNaN(num) && num >= 0) setForm({ ...form, capacity: num });
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
                    ? "أونلاين (Zoom / جروب واتساب)"
                    : "قاعة سموحة - الإسكندرية"
                }
                className="w-full p-3 rounded-xl bg-muted text-foreground border border-border focus:border-primary outline-none focus:ring-1 focus:ring-primary transition-all"
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-border pt-6">
            <div className="space-y-2">
              <label className="text-primary block font-bold">طريقة الدفع المطلوبة</label>
              <select
                className="w-full p-3 rounded-xl bg-muted text-foreground border border-border focus:border-primary outline-none focus:ring-1 focus:ring-primary transition-all"
                value={form.paymentMethod}
                onChange={(e) =>
                  setForm({ ...form, paymentMethod: e.target.value as api.PaymentMethod })
                }
              >
                <option value="wallet" className="bg-card text-foreground">
                  محفظة إلكترونية
                </option>
                <option value="instapay" className="bg-card text-foreground">
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
                className="w-full p-3 rounded-xl bg-muted text-foreground border border-border focus:border-primary outline-none text-right focus:ring-1 focus:ring-primary transition-all"
                value={form.paymentTarget}
                onChange={(e) => setForm({ ...form, paymentTarget: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-primary block font-bold">التفاصيل والوصف</label>
            <textarea
              required
              rows={4}
              placeholder="اكتب وصفاً جذاباً للفعالية وما سيتعلمه الحضور..."
              className="w-full p-3 rounded-xl bg-muted text-foreground border border-border focus:border-primary outline-none resize-none focus:ring-1 focus:ring-primary transition-all"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>

          <button
            type="submit"
            disabled={busy}
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-colors disabled:opacity-50 shadow-glow"
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
    <div className="p-8 text-right pb-24 relative" dir="rtl">
      <Link
        to="/admin"
        className="inline-flex items-center gap-2 text-primary hover:text-primary/80 mb-6 bg-card px-4 py-2 rounded-xl border border-border transition-colors font-bold"
      >
        <ArrowRight size={20} />
        <span>رجوع للوحة التحكم</span>
      </Link>

      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-extrabold text-foreground">إدارة الفعاليات والكورسات</h1>
        <button
          type="button"
          onClick={openCreateForm}
          className="bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-xl flex items-center gap-2 transition-colors font-bold shadow-glow"
        >
          <Plus size={20} />
          <span>إضافة جديد</span>
        </button>
      </div>

      <div className="bg-card rounded-3xl p-4 border border-border shadow-card overflow-x-auto">
        <table className="w-full text-foreground min-w-[850px]">
          <thead>
            <tr className="border-b border-border/50 text-primary">
              <th className="p-4 text-right font-extrabold">العنوان</th>
              <th className="p-4 text-right font-extrabold">النوع</th>
              <th className="p-4 text-right font-extrabold">التاريخ</th>
              <th className="p-4 text-right font-extrabold">السعر</th>
              <th className="p-4 text-center font-extrabold">السعة (محجوز / كلي)</th>
              <th className="p-4 text-center font-extrabold">الإجراءات</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="text-center p-8 font-bold text-muted-foreground">
                  جاري التحميل...
                </td>
              </tr>
            ) : events.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center p-8 font-bold text-muted-foreground">
                  لا توجد فعاليات مضافة
                </td>
              </tr>
            ) : (
              events.map((item) => {
                const booked = api.bookedSeatsSync(item.id);
                const isFull = booked >= item.capacity;

                return (
                  <tr
                    key={item.id}
                    className="border-b border-border/30 hover:bg-muted/30 transition-colors"
                  >
                    <td className="p-4 flex items-center gap-3">
                      {item.image && (
                        <img
                          src={item.image}
                          alt={item.title}
                          className="w-12 h-12 rounded-lg object-cover border border-border/50"
                        />
                      )}
                      <span className="font-bold">{item.title}</span>
                    </td>
                    <td className="p-4">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-bold ${item.type === "event" ? "bg-primary/20 text-primary" : "bg-accent/40 text-foreground"}`}
                      >
                        {item.type === "course"
                          ? `كورس (${item.attendanceMode === "online" ? "أونلاين" : "أوفلاين"})`
                          : "ايفنت"}
                      </span>
                    </td>
                    <td className="p-4 font-bold text-muted-foreground" dir="ltr">
                      {item.date}
                    </td>
                    <td className="p-4 font-bold">{item.price} ج.م</td>
                    <td className="p-4 text-center">
                      <div
                        className={`inline-flex items-center gap-1 font-bold ${isFull ? "text-destructive" : "text-foreground"}`}
                      >
                        <span dir="ltr">
                          {booked} / {item.capacity}
                        </span>
                      </div>
                    </td>
                    <td className="p-4 flex justify-center gap-4">
                      <button
                        type="button"
                        onClick={() => openEditForm(item)}
                        className="text-primary hover:text-primary/80 transition-colors mt-2"
                        title="تعديل الفعالية"
                      >
                        <Edit size={20} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteEventId(item.id)}
                        className="text-destructive hover:text-destructive/80 transition-colors mt-2"
                        title="حذف نهائي"
                      >
                        <Trash2 size={20} />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <ConfirmModal
        isOpen={!!deleteEventId}
        title="حذف الفعالية"
        message="هل أنت متأكد من حذف هذه الفعالية نهائياً؟ لا يمكن التراجع عن هذا الإجراء."
        confirmText="نعم، احذف"
        isDestructive={true}
        onConfirm={executeDelete}
        onCancel={() => setDeleteEventId(null)}
      />
    </div>
  );
}
