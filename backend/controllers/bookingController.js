const Booking = require("../models/bookingModel");
const Event = require("../models/eventModel");
const AppError = require("../utils/appError");
const catchAsync = require("../utils/catchAsync");

// 1. إنشاء حجز جديد
exports.createBooking = catchAsync(async (req, res, next) => {
  if (!req.file) {
    return next(new AppError("يرجى رفع صورة التحويل لإثبات الدفع", 400));
  }

  const eventId = req.body.event;
  const quantity = Number(req.body.quantity) || 1;
  const event = await Event.findById(eventId);

  if (!event) return next(new AppError("الايفنت غير موجود", 404));
  if (event.capacity - event.bookedSeats < quantity) {
    return next(
      new AppError(
        `عذراً، المقاعد المتبقية (${event.capacity - event.bookedSeats}) لا تكفي`,
        400,
      ),
    );
  }

  const newBooking = await Booking.create({
    user: req.user.id,
    event: eventId,
    quantity,
    amount: event.price * quantity,
    paymentReceipt: req.file.filename,
  });

  await newBooking.populate([
    { path: "user", select: "name phone email" },
    { path: "event", select: "title type date time price" },
  ]);

  res.status(201).json({
    status: "success",
    data: { booking: newBooking },
  });
});

// 2. عرض كل الحجوزات (للأدمن والموظفين)
exports.getAllBookings = catchAsync(async (req, res, next) => {
  const bookings = await Booking.find().sort("-createdAt");
  res.status(200).json({
    status: "success",
    results: bookings.length,
    data: { bookings },
  });
});

// 3. عرض حجوزات العميل الحالي
exports.getMyBookings = catchAsync(async (req, res, next) => {
  const bookings = await Booking.find({ user: req.user.id }).sort("-createdAt");
  res.status(200).json({
    status: "success",
    results: bookings.length,
    data: { bookings },
  });
});

// 4. عرض تفاصيل حجز واحد
exports.getBooking = catchAsync(async (req, res, next) => {
  const booking = await Booking.findById(req.params.id);
  if (!booking) return next(new AppError("الحجز غير موجود", 404));

  if (
    req.user.role === "user" &&
    booking.user._id.toString() !== req.user.id.toString()
  ) {
    return next(new AppError("ليس لديك صلاحية لعرض هذا الحجز", 403));
  }

  res.status(200).json({
    status: "success",
    data: { booking },
  });
});

// 5. تأكيد أو رفض الحجز
exports.updateBookingStatus = catchAsync(async (req, res, next) => {
  const { status, rejectReason } = req.body;
  if (!["confirmed", "rejected"].includes(status)) {
    return next(new AppError("حالة الحجز غير صالحة", 400));
  }

  const booking = await Booking.findById(req.params.id);
  if (!booking) return next(new AppError("الحجز غير موجود", 404));

  const prevStatus = booking.status;
  booking.status = status;
  if (status === "rejected") {
    booking.rejectReason = rejectReason || "تم رفض الحجز";
  } else {
    booking.rejectReason = undefined;
  }
  await booking.save();

  if (status === "confirmed" && prevStatus !== "confirmed") {
    await Event.findByIdAndUpdate(booking.event._id, {
      $inc: { bookedSeats: booking.quantity || 1 },
    });
  }

  res.status(200).json({
    status: "success",
    data: { booking },
  });
});

// 6. فحص التذكرة (QR Scanner & Manual Code)
exports.verifyTicket = catchAsync(async (req, res, next) => {
  if (!req.user || !["admin", "employee"].includes(req.user.role)) {
    return next(
      new AppError(
        "غير مصرح لك بفحص التذاكر أو تسجيل الحضور، هذه الصلاحية للموظفين والإدارة فقط",
        403,
      ),
    );
  }
  const { ticketCode } = req.body;
  if (!ticketCode) {
    return next(new AppError("يرجى إرسال كود التذكرة (QR Code)", 400));
  }

  // تنظيف الكود لو جاي من QR Code بصيغة "qrToken|MW-XXXXXX"
  const rawInput = ticketCode.trim().split("|")[0].trim();

  // 1) محاولة البحث بالكود الكامل مباشرة
  let booking = await Booking.findOne({ ticketCode: rawInput });

  // 2) لو لم يجدها، نفحص هل المستخدم أدخل الكود المختصر مثل MW-31A364 أو 31A364
  if (!booking) {
    const cleanShort = rawInput
      .replace(/^MW-/i, "")
      .replace(/-/g, "")
      .toLowerCase();
    if (cleanShort.length >= 4) {
      const allBookings = await Booking.find();
      booking = allBookings.find((b) => {
        const normalizedTicket = (b.ticketCode || "")
          .replace(/-/g, "")
          .toLowerCase();
        const fallbackId = b._id.toString().slice(-6).toLowerCase();
        return (
          normalizedTicket.startsWith(cleanShort) || fallbackId === cleanShort
        );
      });
    }
  }

  if (!booking) {
    return next(new AppError("تذكرة غير صالحة أو غير موجودة في النظام", 404));
  }

  if (booking.status !== "confirmed") {
    return next(
      new AppError(
        `التذكرة غير صالحة للدخول لأن حالة الحجز: ${
          booking.status === "pending" ? "قيد المراجعة" : "مرفوض"
        }`,
        400,
      ),
    );
  }

  if (booking.isScanned) {
    return next(new AppError("تم استخدام التذكرة مسبقاً!", 400));
  }

  booking.isScanned = true;
  booking.checkedInAt = new Date();
  await booking.save();

  res.status(200).json({
    status: "success",
    message: "تذكرة صالحة للدخول، وتم تسجيل حضور العميل بنجاح",
    data: { booking },
  });
});
