const multer = require("multer");
const AppError = require("../utils/appError");

const multerStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    // اسم الصورة هيكون: booking-رقم_المستخدم-التاريخ.المتداد
    const ext = file.mimetype.split("/")[1];
    cb(null, `booking-${req.user.id}-${Date.now()}.${ext}`);
  },
});

const multerFilter = (req, file, cb) => {
  if (file.mimetype.startsWith("image")) {
    cb(null, true);
  } else {
    cb(new AppError("يرجى رفع صور فقط!", 400), false);
  }
};

const upload = multer({
  storage: multerStorage,
  fileFilter: multerFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // الحد الأقصى 5 ميجا
});

exports.uploadPaymentReceipt = upload.single("paymentReceipt");
// إعدادات تخزين خاصة بصور الايفنتات
const eventStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    // اسم الصورة هيكون: event-التاريخ.الامتداد
    const ext = file.mimetype.split("/")[1];
    cb(null, `event-${Date.now()}.${ext}`);
  },
});

const uploadEvent = multer({
  storage: eventStorage,
  fileFilter: multerFilter, // هنستخدم نفس الفلتر اللي بيسمح بالصور بس
  limits: { fileSize: 5 * 1024 * 1024 },
});

// تصدير الميدل وير الجديد (اسم الحقل في الفرونت إند هيكون image)
exports.uploadEventImage = uploadEvent.single("image");
