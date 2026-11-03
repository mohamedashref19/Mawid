const AppError = require("../utils/appError");
// const Sentry = require("@sentry/node"); // قم بتفعيله لاحقاً عند ضبط Sentry

const handleErrorCastDB = (err) => {
  const raw =
    err.stringValue || (typeof err.value === "object" ? "" : err.value);
  const value = raw ? String(raw).slice(0, 60) : "";
  const message = value
    ? `القيمة غير صالحة ${err.path}: ${value}`
    : `القيمة غير صالحة ${err.path}`;
  return new AppError(message, 400);
};

const handleDuplicateDB = (err) => {
  const field = Object.keys(err.keyValue || {})[0];
  let message = "البيانات المدخلة مسجلة مسبقاً، يرجى استخدام قيمة أخرى.";

  if (field === "email") {
    message = "البريد الإلكتروني مستخدم بالفعل، يرجى استخدام بريد آخر.";
  } else if (field === "phone") {
    message = "رقم الهاتف مستخدم بالفعل، يرجى تسجيل الدخول أو استخدام رقم آخر.";
  } else if (field === "name" || field === "title") {
    // تمت إضافة title لرسائل الكورسات والفعاليات المكررة
    message = "هذا الاسم أو العنوان مستخدم مسبقاً، يرجى اختيار اسم آخر.";
  }

  return new AppError(message, 400);
};

const handleValidatorErrorDB = (err) => {
  const errors = Object.values(err.errors).map((el) => el.message);
  const message = `بيانات غير صالحة: ${errors.join(". ")}`;
  return new AppError(message, 400);
};

const handleJWTError = () =>
  new AppError("توكن غير صالح! يرجى تسجيل الدخول مرة أخرى.", 401);

const handleExpiredError = () =>
  new AppError("انتهت صلاحية الجلسة! يرجى تسجيل الدخول مرة أخرى.", 401);

const handleMulterError = (err) => {
  const message =
    err.code === "LIMIT_FILE_SIZE"
      ? "حجم الصورة كبير جداً (الحد الأقصى 5 ميجا)"
      : "تعذر رفع صورة التحويل، تأكد من الملف وحاول مرة أخرى";
  return new AppError(message, 400);
};

const handleBodyParserError = (err) =>
  err.type === "entity.too.large"
    ? new AppError("حجم البيانات المرسلة كبير جداً", 413)
    : new AppError("البيانات المرسلة غير صالحة", 400);

const sendErrDev = (err, req, res) => {
  return res.status(err.statusCode).json({
    status: err.status,
    error: err,
    message: err.message,
    stack: err.stack,
  });
};

const sendErrProd = (err, req, res) => {
  if (err.isOperational) {
    return res.status(err.statusCode).json({
      status: err.status,
      message: err.message,
    });
  }

  console.error("ERROR 💥", err);

  return res.status(500).json({
    status: "error",
    message: "حدث خطأ غير متوقع في الخادم!",
  });
};

module.exports = (err, req, res, next) => {
  if (res.headersSent) return next(err);

  err.statusCode = err.statusCode || 500;
  err.status = err.status || "error";

  let error = Object.create(err);
  Object.assign(error, err);
  error.message = err.message;

  if (error.name === "CastError") error = handleErrorCastDB(error);
  if (error.code === 11000) error = handleDuplicateDB(error);
  if (error.name === "ValidationError") error = handleValidatorErrorDB(error);
  if (error.name === "JsonWebTokenError") error = handleJWTError();
  if (error.name === "TokenExpiredError") error = handleExpiredError();
  if (error.name === "MulterError") error = handleMulterError(error);
  if (
    error.type === "entity.parse.failed" ||
    error.type === "entity.too.large"
  ) {
    error = handleBodyParserError(error);
  }

  // if (!error.isOperational || error.statusCode >= 500) {
  //   if (typeof Sentry !== "undefined") Sentry.captureException(err);
  // }

  const env = process.env.NODE_ENV ? process.env.NODE_ENV.trim() : "production";

  if (env === "development") {
    sendErrDev(error, req, res);
  } else {
    sendErrProd(error, req, res);
  }
};
