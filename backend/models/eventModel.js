const mongoose = require("mongoose");

const eventSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "يرجى إدخال عنوان الايفنت أو الكورس"],
      trim: true,
    },
    type: {
      type: String,
      enum: ["event", "course"],
      required: [true, "يرجى تحديد النوع (حدث أو كورس)"],
    },
    attendanceMode: {
      type: String,
      enum: {
        values: ["online", "offline"],
        message: "نظام الحضور يجب أن يكون online أو offline",
      },
      default: "offline",
    },
    // روابط الانضمام للكورس الأونلاين: رابط أو أكتر، كل رابط في سطر مستقل
    accessLink: {
      type: String,
      default: "",
      select: false, // مخفي افتراضياً لحماية روابط الكورسات المدفوعة
    },
    // تفاصيل الكورس الأونلاين (مواعيد، كلمة سر، تعليمات...) كلام عادي
    accessDetails: {
      type: String,
      default: "",
      select: false, // نفس حماية الرابط: تظهر للمشتركين المؤكدين والأدمن بس
      maxlength: [2000, "تفاصيل الكورس طويلة جداً (الحد الأقصى 2000 حرف)"],
    },
    description: {
      type: String,
      required: [true, "يرجى إدخال وصف التفاصيل"],
    },
    image: {
      type: String,
      default: "default-event.jpg",
    },
    date: {
      type: Date,
      required: [true, "يرجى تحديد التاريخ"],
      validate: {
        validator: function (val) {
          // لما التعديل بيجي من findByIdAndUpdate بيبقى الـ this عبارة عن Query
          // (مفيهوش isModified) فكان بيرمي خطأ ويفشّل أي تعديل. التحقق من التاريخ
          // في حالة التعديل بيتم في updateEvent داخل الـ controller.
          if (typeof this.isModified !== "function") return true;
          if (!this.isNew && !this.isModified("date")) return true;
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          return val >= today;
        },
        message: "لا يمكن إنشاء فعالية في تاريخ ماضي",
      },
    },
    time: {
      type: String,
      required: [true, "يرجى تحديد وقت البدء (مثال: 06:00 PM)"],
    },
    location: {
      type: String,
      required: [true, "يرجى تحديد الموقع أو الرابط (للأونلاين)"],
    },
    price: {
      type: Number,
      required: [true, "يرجى تحديد السعر"],
      min: [0, "السعر لا يمكن أن يكون بالسالب"],
    },
    paymentMethod: {
      type: String,
      enum: ["wallet", "instapay", "link"],
      default: "wallet",
    },
    paymentTarget: {
      type: String,
      required: [true, "يرجى تحديد رقم أو رابط الدفع الخاص بهذه الفعالية"],
    },
    capacity: {
      type: Number,
      required: [true, "يرجى تحديد السعة القصوى للحضور"],
      min: [1, "السعة يجب أن تكون شخص واحد على الأقل"],
    },
    bookedSeats: {
      type: Number,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// Virtual Field: لحساب المقاعد المتبقية ديناميكياً
eventSchema.virtual("seatsLeft").get(function () {
  return this.capacity - this.bookedSeats;
});

// عرض الفعاليات النشطة فقط
eventSchema.pre(/^find/, function () {
  this.find({ isActive: { $ne: false } });
});

const Event = mongoose.model("Event", eventSchema);
module.exports = Event;
