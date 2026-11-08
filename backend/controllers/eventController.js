const Event = require("../models/eventModel");
const Booking = require("../models/bookingModel");
const AppError = require("../utils/appError");
const catchAsync = require("../utils/catchAsync");

// الحقول المسموح للأدمن يبعتها. bookedSeats مقصودة إنها مش هنا:
// ده عداد بيتحسب من الحجوزات المؤكدة بس، وتعديله يدوي بيبوّظ الحسابات.
const ALLOWED_FIELDS = [
  "title",
  "type",
  "attendanceMode",
  "accessLink",
  "accessDetails",
  "description",
  "image",
  "date",
  "time",
  "location",
  "price",
  "paymentMethod",
  "paymentTarget",
  "capacity",
  "isActive",
];

const pickAllowed = (body) =>
  Object.fromEntries(
    Object.entries(body).filter(([key]) => ALLOWED_FIELDS.includes(key)),
  );

// تعطيل المعاني الخاصة لرموز الـ regex (يمنع ReDoS و regex injection)
const escapeRegex = (str) => String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// accessLink/accessDetails (روابط وتفاصيل الكورس الأونلاين) محميين بـ select:false في الموديل.
// بنرجّعه للأدمن بس، عشان فورم التعديل يعرضه ومايتمسحش عند الحفظ.
// (req.user بيتحدد من ميدلوير optionalAuth على المسارات العامة)
const isAdmin = (req) => req.user?.role === "admin";

// 1. جلب كل الفعاليات (متاح للجميع)
exports.getAllEvents = catchAsync(async (req, res, next) => {
  // للبحث والفلترة (مثلاً: ?type=course أو ?q=node)
  const filter = {};
  if (["event", "course"].includes(req.query.type)) {
    filter.type = req.query.type;
  }
  if (typeof req.query.q === "string" && req.query.q.trim()) {
    filter.title = {
      $regex: escapeRegex(req.query.q.trim().slice(0, 100)),
      $options: "i",
    };
  }

  let query = Event.find(filter).sort("date");
  if (isAdmin(req)) query = query.select("+accessLink +accessDetails");
  const events = await query;

  res.status(200).json({
    status: "success",
    results: events.length,
    data: {
      events,
    },
  });
});

// 2. جلب تفاصيل ايفنت واحد (متاح للجميع)
exports.getEvent = catchAsync(async (req, res, next) => {
  let query = Event.findById(req.params.id);
  if (isAdmin(req)) query = query.select("+accessLink +accessDetails");
  const event = await query;

  if (!event) {
    return next(new AppError("لم يتم العثور على هذا الايفنت", 404));
  }

  res.status(200).json({
    status: "success",
    data: {
      event,
    },
  });
});

// 3. إضافة ايفنت جديد (خاص بالأدمن)
exports.createEvent = catchAsync(async (req, res, next) => {
  const data = pickAllowed(req.body);

  // لو تم رفع صورة، ضيف رابطها للبيانات اللي هتتحفظ
  if (req.file) {
    data.image = req.file.path;
  }

  const newEvent = await Event.create(data);

  res.status(201).json({
    status: "success",
    data: {
      event: newEvent,
    },
  });
});

// 4. تعديل ايفنت (خاص بالأدمن)
exports.updateEvent = catchAsync(async (req, res, next) => {
  const data = pickAllowed(req.body);

  if (req.file) {
    data.image = req.file.path;
  }

  const existing = await Event.findById(req.params.id);
  if (!existing) {
    return next(new AppError("لم يتم العثور على هذا الايفنت", 404));
  }

  // منع تقليل السعة لأقل من المقاعد المحجوزة فعلياً
  if (
    data.capacity !== undefined &&
    Number(data.capacity) < existing.bookedSeats
  ) {
    return next(
      new AppError(
        `لا يمكن تقليل السعة لأقل من المقاعد المحجوزة (${existing.bookedSeats})`,
        400,
      ),
    );
  }

  // التحقق من التاريخ عند التعديل. (الـ validator في الموديل بيشتغل عند
  // الإنشاء بس، لأن findByIdAndUpdate مبيدّيلوش الـ document.)
  // مسموح تعدّل بيانات ايفنت عدّى ميعاده طالما التاريخ نفسه ما اتغيرش،
  // لكن مينفعش تنقله لتاريخ قديم.
  if (data.date !== undefined) {
    const newDate = new Date(data.date);
    if (Number.isNaN(newDate.getTime())) {
      return next(new AppError("تاريخ غير صالح", 400));
    }
    const sameDay =
      newDate.toISOString().slice(0, 10) ===
      existing.date.toISOString().slice(0, 10);
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    if (!sameDay && newDate < startOfToday) {
      return next(new AppError("لا يمكن نقل الفعالية إلى تاريخ قديم", 400));
    }
  }

  const event = await Event.findByIdAndUpdate(req.params.id, data, {
    returnDocument: "after",
    runValidators: true,
  });

  if (!event) {
    return next(new AppError("لم يتم العثور على هذا الايفنت", 404));
  }

  res.status(200).json({
    status: "success",
    data: {
      event,
    },
  });
});

// 5. حذف ايفنت (خاص بالأدمن)
exports.deleteEvent = catchAsync(async (req, res, next) => {
  // لو عليه حجوزات، الحذف هيسيب حجوزات يتيمة (ومعاها إيصالات ومدفوعات)
  const bookingsCount = await Booking.countDocuments({ event: req.params.id });
  if (bookingsCount > 0) {
    return next(
      new AppError(
        `لا يمكن حذف ايفنت عليه ${bookingsCount} حجز. ارفض الحجوزات أو عطّل الايفنت بدلاً من حذفه.`,
        400,
      ),
    );
  }

  const event = await Event.findByIdAndDelete(req.params.id);

  if (!event) {
    return next(new AppError("لم يتم العثور على هذا الايفنت", 404));
  }

  res.status(204).send();
});
