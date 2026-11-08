const Booking = require("../models/bookingModel");
const Event = require("../models/eventModel");
const AppError = require("../utils/appError");
const catchAsync = require("../utils/catchAsync");
const Email = require("../utils/email");

const MAX_QUANTITY_PER_BOOKING = 10;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHORT_CODE_RE = /^[0-9a-f]{6}$/;

// ---------------------------------------------------------------------
// 1. إنشاء حجز جديد
// ---------------------------------------------------------------------
exports.createBooking = catchAsync(async (req, res, next) => {
  const eventId = req.body.event;
  const quantity = Number(req.body.quantity ?? 1);

  if (
    !Number.isInteger(quantity) ||
    quantity < 1 ||
    quantity > MAX_QUANTITY_PER_BOOKING
  ) {
    return next(
      new AppError(
        `عدد التذاكر لازم يكون رقم صحيح من 1 إلى ${MAX_QUANTITY_PER_BOOKING}`,
        400,
      ),
    );
  }

  const event = await Event.findById(eventId);
  if (!event) return next(new AppError("الايفنت غير موجود", 404));

  // منع الحجز في ايفنت عدّى ميعاده
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  if (event.date < startOfToday) {
    return next(new AppError("عذراً، انتهى موعد هذا الايفنت", 400));
  }

  const seatsLeft = event.capacity - event.bookedSeats;
  if (seatsLeft < quantity) {
    return next(
      new AppError(`عذراً، المقاعد المتبقية (${seatsLeft}) لا تكفي`, 400),
    );
  }

  const amount = event.price * quantity;

  // الإيصال إجباري بس لو فيه مبلغ مدفوع
  if (amount > 0 && !req.file) {
    return next(new AppError("يرجى رفع صورة التحويل لإثبات الدفع", 400));
  }

  // منع تكديس حجوزات "قيد المراجعة" لنفس الايفنت من نفس العميل
  const hasPending = await Booking.countDocuments({
    user: req.user.id,
    event: eventId,
    status: "pending",
  });
  if (hasPending > 0) {
    return next(
      new AppError(
        "لديك حجز قيد المراجعة بالفعل لهذا الايفنت، انتظر تأكيد الإدارة",
        409,
      ),
    );
  }

  const newBooking = await Booking.create({
    user: req.user.id,
    event: eventId,
    quantity,
    amount,
    paymentReceipt: req.file ? req.file.path : undefined,
  });

  await newBooking.populate([
    { path: "user", select: "name phone email" },
    { path: "event", select: "title type date time price attendanceMode" },
  ]);

  res.status(201).json({
    status: "success",
    data: { booking: newBooking },
  });
});

// ---------------------------------------------------------------------
// 2. عرض كل الحجوزات (للأدمن والموظفين)
// ---------------------------------------------------------------------
exports.getAllBookings = catchAsync(async (req, res, next) => {
  const bookings = await Booking.find().sort("-createdAt");
  res.status(200).json({
    status: "success",
    results: bookings.length,
    data: { bookings },
  });
});

// ---------------------------------------------------------------------
// 3. عرض حجوزات العميل الحالي
// ---------------------------------------------------------------------
exports.getMyBookings = catchAsync(async (req, res, next) => {
  const bookings = await Booking.find({ user: req.user.id }).sort("-createdAt");
  res.status(200).json({
    status: "success",
    results: bookings.length,
    data: { bookings },
  });
});

// ---------------------------------------------------------------------
// 4. عرض تفاصيل حجز واحد (مع إرفاق رابط الكورس للمؤكد فقط)
// ---------------------------------------------------------------------
exports.getBooking = catchAsync(async (req, res, next) => {
  const booking = await Booking.findById(req.params.id);
  if (!booking) return next(new AppError("الحجز غير موجود", 404));

  if (
    req.user.role === "user" &&
    String(booking.user?._id) !== String(req.user.id)
  ) {
    return next(new AppError("ليس لديك صلاحية لعرض هذا الحجز", 403));
  }

  const bookingObj = booking.toObject();

  // إظهار رابط الكورس فقط لو الحجز مؤكد أو المستخدم أدمن/موظف
  if (bookingObj.status === "confirmed" || req.user.role !== "user") {
    const eventId = bookingObj.event?._id || bookingObj.event;
    if (eventId) {
      const eventWithLink = await Event.findById(eventId).select(
        "+accessLink +accessDetails attendanceMode",
      );
      if (
        eventWithLink &&
        typeof bookingObj.event === "object" &&
        bookingObj.event !== null
      ) {
        bookingObj.event.accessLink = eventWithLink.accessLink;
        bookingObj.event.accessDetails = eventWithLink.accessDetails;
        bookingObj.event.attendanceMode = eventWithLink.attendanceMode;
      }
    }
  }

  res.status(200).json({
    status: "success",
    data: { booking: bookingObj },
  });
});

// ---------------------------------------------------------------------
// 5. تأكيد أو رفض الحجز
// ---------------------------------------------------------------------
exports.updateBookingStatus = catchAsync(async (req, res, next) => {
  const { status, rejectReason } = req.body;
  if (!["confirmed", "rejected"].includes(status)) {
    return next(new AppError("حالة الحجز غير صالحة", 400));
  }

  const current = await Booking.findById(req.params.id).noPopulate();
  if (!current) return next(new AppError("الحجز غير موجود", 404));

  if (current.isScanned) {
    return next(new AppError("لا يمكن تعديل حجز تم تسجيل حضوره بالفعل", 400));
  }

  if (current.status === status) {
    const same = await Booking.findById(current._id);
    return res.status(200).json({ status: "success", data: { booking: same } });
  }

  const prevStatus = current.status;
  const qty = current.quantity || 1;
  let seatsClaimed = false;

  if (status === "confirmed") {
    const claim = await Event.updateOne(
      {
        _id: current.event,
        $expr: { $gte: [{ $subtract: ["$capacity", "$bookedSeats"] }, qty] },
      },
      { $inc: { bookedSeats: qty } },
    );
    if (claim.modifiedCount !== 1) {
      return next(
        new AppError(
          "لا توجد مقاعد كافية لتأكيد هذا الحجز (أو الايفنت غير موجود). يمكنك رفضه واسترداد المبلغ.",
          400,
        ),
      );
    }
    seatsClaimed = true;
  }

  const update =
    status === "confirmed"
      ? { status, $unset: { rejectReason: 1 } }
      : { status, rejectReason: (rejectReason || "").trim() || "تم رفض الحجز" };

  const updated = await Booking.findOneAndUpdate(
    { _id: current._id, status: prevStatus, isScanned: false },
    update,
    { returnDocument: "after" },
  );

  if (!updated) {
    if (seatsClaimed) {
      await Event.updateOne(
        { _id: current.event },
        { $inc: { bookedSeats: -qty } },
      );
    }
    return next(
      new AppError(
        "تم تعديل هذا الحجز بواسطة شخص آخر، حدّث الصفحة وحاول مجدداً",
        409,
      ),
    );
  }

  if (status === "rejected" && prevStatus === "confirmed") {
    await Event.updateOne(
      { _id: current.event, bookedSeats: { $gte: qty } },
      { $inc: { bookedSeats: -qty } },
    );
  }

  const booking = await Booking.findById(updated._id);

  // إرسال التذكرة بالإيميل بعد التأكيد (مع جلب +accessLink +accessDetails للكورسات الأونلاين)
  if (status === "confirmed" && booking?.user?.email) {
    Event.findById(current.event)
      .select("+accessLink +accessDetails")
      .then((eventDoc) => {
        if (!eventDoc) return;
        return new Email(booking.user).sendBookingTicket(booking, eventDoc);
      })
      .catch((err) => console.error("Failed to send ticket email:", err));
  }

  res.status(200).json({
    status: "success",
    data: { booking },
  });
});

// ---------------------------------------------------------------------
// 6. فحص التذكرة (QR Scanner & Manual Code)
// ---------------------------------------------------------------------
exports.verifyTicket = catchAsync(async (req, res, next) => {
  const { ticketCode, eventId } = req.body;
  if (typeof ticketCode !== "string" || !ticketCode.trim()) {
    return next(new AppError("يرجى إرسال كود التذكرة (QR Code)", 400));
  }

  const raw = ticketCode.trim().split("|")[0].trim();

  let fullCode;
  if (UUID_RE.test(raw)) {
    fullCode = raw.toLowerCase();
  } else {
    const short = raw.replace(/^MW-/i, "").replace(/-/g, "").toLowerCase();
    if (!SHORT_CODE_RE.test(short)) {
      return next(new AppError("تذكرة غير صالحة أو غير موجودة في النظام", 404));
    }
    const matches = await Booking.find({
      ticketCode: new RegExp(`^${short}`),
    })
      .noPopulate()
      .select("ticketCode")
      .limit(2);

    if (matches.length === 0) {
      return next(new AppError("تذكرة غير صالحة أو غير موجودة في النظام", 404));
    }
    if (matches.length > 1) {
      return next(
        new AppError(
          "الكود المختصر مشترك بين أكثر من تذكرة، امسح الـ QR بدلاً منه",
          409,
        ),
      );
    }
    fullCode = matches[0].ticketCode;
  }

  const filter = {
    ticketCode: fullCode,
    status: "confirmed",
    isScanned: false,
  };
  if (eventId) filter.event = eventId;

  const booking = await Booking.findOneAndUpdate(
    filter,
    {
      isScanned: true,
      checkedInAt: new Date(),
      checkedInBy: req.user._id,
    },
    { returnDocument: "after" },
  );

  if (booking) {
    return res.status(200).json({
      status: "success",
      message: "تذكرة صالحة للدخول، وتم تسجيل حضور العميل بنجاح",
      data: { booking },
    });
  }

  const existing = await Booking.findOne({ ticketCode: fullCode });
  if (!existing) {
    return next(new AppError("تذكرة غير صالحة أو غير موجودة في النظام", 404));
  }

  if (
    eventId &&
    String(existing.event?._id ?? existing.event) !== String(eventId)
  ) {
    return next(new AppError("هذه التذكرة تخص ايفنت آخر", 400));
  }

  if (existing.status !== "confirmed") {
    return next(
      new AppError(
        `التذكرة غير صالحة للدخول لأن حالة الحجز: ${
          existing.status === "pending" ? "قيد المراجعة" : "مرفوض"
        }`,
        400,
      ),
    );
  }

  if (existing.isScanned) {
    const when = existing.checkedInAt
      ? ` (الساعة ${existing.checkedInAt.toLocaleTimeString("ar-EG", {
          hour: "2-digit",
          minute: "2-digit",
        })})`
      : "";
    return next(new AppError(`تم استخدام التذكرة مسبقاً!${when}`, 400));
  }

  return next(new AppError("تعذر تسجيل الحضور، حاول مرة أخرى", 409));
});
