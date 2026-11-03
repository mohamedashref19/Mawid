const mongoose = require("mongoose");
const { v4: uuidv4 } = require("uuid");

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
      required: [true, "يرجى رفع صورة التحويل لإثبات الدفع"],
    },
    quantity: {
      type: Number,
      default: 1,
      min: [1, "عدد التذاكر يجب أن يكون 1 على الأقل"],
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
  },
  { timestamps: true },
);

bookingSchema.pre(/^find/, function () {
  this.populate({ path: "user", select: "name phone email" }).populate({
    path: "event",
    select: "title type date time price",
  });
});

const Booking = mongoose.model("Booking", bookingSchema);
module.exports = Booking;
