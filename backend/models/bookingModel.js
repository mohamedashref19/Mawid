const mongoose = require("mongoose");
const { v4: uuidv4 } = require("uuid");

const MAX_QUANTITY_PER_BOOKING = 10;

const bookingSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.ObjectId,
      ref: "User",
      required: [true, "يجب أن يكون الحجز مرتبطاً بمستخدم"],
    },
    event: {
      type: mongoose.Schema.ObjectId,
      ref: "Event",
      required: [true, "يجب أن يكون الحجز مرتبطاً بايفنت أو كورس"],
    },
    paymentReceipt: {
      type: String,
      // الايفنتات المجانية (price = 0) مش محتاجة إيصال تحويل
      required: [
        function () {
          return this.amount > 0;
        },
        "يرجى رفع صورة التحويل لإثبات الدفع",
      ],
    },
    quantity: {
      type: Number,
      default: 1,
      min: [1, "عدد التذاكر يجب أن يكون 1 على الأقل"],
      max: [
        MAX_QUANTITY_PER_BOOKING,
        `الحد الأقصى ${MAX_QUANTITY_PER_BOOKING} تذاكر في الحجز الواحد`,
      ],
      validate: {
        validator: Number.isInteger,
        message: "عدد التذاكر يجب أن يكون رقماً صحيحاً",
      },
    },
    status: {
      type: String,
      enum: ["pending", "confirmed", "rejected"],
      default: "pending",
    },
    rejectReason: {
      type: String,
    },
    amount: {
      type: Number,
      required: [true, "يرجى تحديد المبلغ المدفوع"],
      min: [0, "المبلغ لا يمكن أن يكون بالسالب"],
    },
    ticketCode: {
      type: String,
      unique: true,
      default: () => uuidv4(),
    },
    isScanned: {
      type: Boolean,
      default: false,
    },
    checkedInAt: {
      type: Date,
    },
    // مين من الموظفين سجّل الحضور (مفيد لو حصل خلاف عند الباب)
    checkedInBy: {
      type: mongoose.Schema.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true },
);

// فهارس لتسريع الاستعلامات الشائعة
bookingSchema.index({ user: 1, createdAt: -1 });
bookingSchema.index({ event: 1, status: 1 });
bookingSchema.index({ status: 1, createdAt: -1 });

// Query helper: بيلغي الـ populate التلقائي لما نحتاج الـ ObjectId الخام
// (مثلاً لو الايفنت اتشال، الـ populate بيرجع null وكان بيكسر الكود)
// الاستخدام: Booking.findById(id).noPopulate()
bookingSchema.query.noPopulate = function () {
  this._noPopulate = true;
  return this;
};

bookingSchema.pre(/^find/, function () {
  if (this._noPopulate) return;
  this.populate({ path: "user", select: "name phone email" }).populate({
    path: "event",
    select: "title type date time price",
  });
});

const Booking = mongoose.model("Booking", bookingSchema);
module.exports = Booking;
