const Event = require("../models/eventModel");
const AppError = require("../utils/appError");
const catchAsync = require("../utils/catchAsync");

// 1. جلب كل الفعاليات (متاح للجميع)
exports.getAllEvents = catchAsync(async (req, res, next) => {
  // للبحث والفلترة (مثلاً: ?type=course أو ?q=node)
  let filter = {};
  if (req.query.type) filter.type = req.query.type;
  if (req.query.q) filter.title = { $regex: req.query.q, $options: "i" };

  const events = await Event.find(filter).sort("date");

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
  const event = await Event.findById(req.params.id);

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
// 3. إضافة ايفنت جديد (خاص بالأدمن)
exports.createEvent = catchAsync(async (req, res, next) => {
  // لو تم رفع صورة، ضيف اسمها للبيانات اللي هتتحفظ
  if (req.file) {
    req.body.image = req.file.filename;
  }

  const newEvent = await Event.create(req.body);

  res.status(201).json({
    status: "success",
    data: {
      event: newEvent,
    },
  });
});

// 4. تعديل ايفنت (خاص بالأدمن)
exports.updateEvent = catchAsync(async (req, res, next) => {
  // لو تم رفع صورة جديدة أثناء التعديل، حدث اسمها
  if (req.file) {
    req.body.image = req.file.filename;
  }

  const event = await Event.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
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
  const event = await Event.findByIdAndDelete(req.params.id);

  if (!event) {
    return next(new AppError("لم يتم العثور على هذا الايفنت", 404));
  }

  res.status(204).json({
    status: "success",
    data: null,
  });
});
