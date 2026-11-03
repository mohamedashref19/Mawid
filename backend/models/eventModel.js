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
    accessLink: {
      type: String,
    },
    description: {
      type: String,
      required: [true, "يرجى إدخال وصف التفاصيل"],
    },
    image: {
      type: String,
      default: "default-event.jpg", // صورة افتراضية لحد ما نربط رفع الصور
    },
    date: {
      type: Date,
      required: [true, "يرجى تحديد التاريخ"],
      validate: {
        validator: function (val) {
          // تصفير الوقت لمقارنة التاريخ فقط
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
      min: [0, "السعر لا يمكن أن يكون بالسالب"], // منع القيم السالبة
    },
    paymentMethod: {
      type: String,
      enum: ["wallet", "instapay", "link"],
      default: "wallet",
    },
    paymentTarget: {
      type: String,
      // هذا الحقل سيحتوي على رقم المحفظة (010xxxx)، أو عنوان انستا باي (name@instapay)، أو رابط الدفع (https://...)
      required: [true, "يرجى تحديد رقم أو رابط الدفع الخاص بهذه الفعالية"],
    },
    capacity: {
      type: Number,
      required: [true, "يرجى تحديد السعة القصوى للحضور"],
      min: [1, "السعة يجب أن تكون شخص واحد على الأقل"],
    },
    bookedSeats: {
      type: Number,
      default: 0, // عدد المقاعد اللي اتحجزت فعلياً (هتزيد مع كل حجز مؤكد)
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

// عشان دايماً نعرض الفعاليات النشطة بس للمستخدم العادي (لو حابب)
eventSchema.pre(/^find/, function () {
  this.find({ isActive: { $ne: false } });
});

const Event = mongoose.model("Event", eventSchema);
module.exports = Event;
