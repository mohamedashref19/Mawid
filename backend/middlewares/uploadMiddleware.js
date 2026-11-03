const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const AppError = require("../utils/appError");

// إعدادات Cloudinary (تأكد من إضافة هذه المتغيرات في ملف .env)
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// إعداد التخزين لصور الفعاليات
const eventStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "events", // اسم المجلد الذي سيتم إنشاؤه في Cloudinary
    allowed_formats: ["jpg", "png", "jpeg", "webp"],
    public_id: (req, file) => `event-${Date.now()}`,
  },
});

// إعداد التخزين لإيصالات الدفع
const receiptStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "receipts",
    allowed_formats: ["jpg", "png", "jpeg", "webp"],
    public_id: (req, file) => `booking-${req.user.id}-${Date.now()}`,
  },
});

const multerFilter = (req, file, cb) => {
  if (file.mimetype.startsWith("image")) {
    cb(null, true);
  } else {
    cb(new AppError("يرجى رفع صور فقط!", 400), false);
  }
};

// رفع إيصالات الدفع
const uploadReceipt = multer({
  storage: receiptStorage,
  fileFilter: multerFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // الحد الأقصى 5 ميجا
});

// رفع صور الفعاليات
const uploadEvent = multer({
  storage: eventStorage,
  fileFilter: multerFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
});

exports.uploadPaymentReceipt = uploadReceipt.single("paymentReceipt");
exports.uploadEventImage = uploadEvent.single("image");
