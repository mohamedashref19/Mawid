const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { promisify } = require("util");
const User = require("../models/userModel");
const AppError = require("../utils/appError");
const catchAsync = require("../utils/catchAsync");
// const Email = require("../utils/email"); // فعلها لو ضفت ملف الإيميلات لاحقاً

const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_RESEND_COOLDOWN_MS = 60 * 1000;

const generateOTP = () => crypto.randomInt(100000, 1000000).toString();

const issuedRecently = (expires) =>
  !!expires &&
  new Date(expires).getTime() - OTP_TTL_MS >
    Date.now() - OTP_RESEND_COOLDOWN_MS;

const MAX_OTP_ATTEMPTS = 5;
const OTP_LOCK_MS = 15 * 60 * 1000;
const otpFailures = new Map();

const isOtpLocked = (key) => {
  const entry = otpFailures.get(key);
  if (!entry) return false;
  if (entry.resetAt <= Date.now()) {
    otpFailures.delete(key);
    return false;
  }
  return entry.count >= MAX_OTP_ATTEMPTS;
};

const registerOtpFailure = (key) => {
  const now = Date.now();
  const entry = otpFailures.get(key);
  if (!entry || entry.resetAt <= now) {
    otpFailures.set(key, { count: 1, resetAt: now + OTP_LOCK_MS });
  } else {
    entry.count += 1;
  }
};

const clearOtpFailures = (key) => otpFailures.delete(key);

setInterval(
  () => {
    const now = Date.now();
    for (const [key, entry] of otpFailures) {
      if (entry.resetAt <= now) otpFailures.delete(key);
    }
  },
  10 * 60 * 1000,
).unref();

const normalizeOtp = (value) =>
  typeof value === "number" ? String(value) : value;

const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "90d",
  });

const sanitizeEmail = (email) =>
  typeof email === "string"
    ? email.replace(/[\s\u200B-\u200D\uFEFF\u200E\u200F]/g, "").toLowerCase()
    : "";

const sanitizePhone = (phone) =>
  typeof phone === "string" ? phone.replace(/\s+/g, "").trim() : "";

const createAndSendToken = (user, statusCode, res) => {
  const token = signToken(user._id);
  const cookieExpiresDays = Number(process.env.JWT_COOKIE_EXPIRES_IN) || 90;

  const cookieOptions = {
    expires: new Date(Date.now() + cookieExpiresDays * 24 * 60 * 60 * 1000),
    httpOnly: true,
  };

  if (process.env.NODE_ENV === "production") cookieOptions.secure = true;

  res.cookie("jwt", token, cookieOptions);

  user.password = undefined;

  res.status(statusCode).json({
    status: "success",
    token,
    data: {
      user,
    },
  });
};

// ---------------- التسجيل والدخول ----------------

exports.signup = catchAsync(async (req, res, next) => {
  // التأكد من وجود الإيميل ورقم الهاتف
  if (!req.body.phone || !req.body.email) {
    return next(new AppError("يرجى إدخال البريد الإلكتروني ورقم الهاتف", 400));
  }

  const cleanPhone = sanitizePhone(req.body.phone);
  const cleanEmail = sanitizeEmail(req.body.email);

  // التحقق إن الرقم أو الإيميل مش متسجلين قبل كده
  const existingUser = await User.findOne({
    $or: [{ phone: cleanPhone }, { email: cleanEmail }],
  });

  if (existingUser) {
    return next(
      new AppError(
        "رقم الهاتف أو البريد الإلكتروني مستخدم بالفعل، يرجى تسجيل الدخول.",
        400,
      ),
    );
  }

  const newUser = await User.create({
    name: req.body.name?.trim(),
    email: cleanEmail,
    phone: cleanPhone,
    password: req.body.password,
    passwordConfirm: req.body.passwordConfirm || req.body.password,
    role: "user",
    verified: true,
  });

  createAndSendToken(newUser, 201, res);
});

exports.login = catchAsync(async (req, res, next) => {
  const phone = sanitizePhone(req.body.phone);
  const { password } = req.body;

  if (!phone || !password) {
    return next(new AppError("يرجى تقديم رقم الهاتف وكلمة المرور", 400));
  }

  const user = await User.findOne({ phone }).select("+password");

  if (!user || !(await user.correctPassword(password, user.password))) {
    return next(new AppError("رقم الهاتف أو كلمة المرور غير صحيحة", 401));
  }

  createAndSendToken(user, 200, res);
});

exports.getMe = catchAsync(async (req, res, next) => {
  res.status(200).json({
    status: "success",
    data: {
      user: req.user,
    },
  });
});

exports.logout = (req, res) => {
  res.cookie("jwt", "loggedout", {
    expires: new Date(Date.now() + 10 * 1000),
    httpOnly: true,
  });
  res.status(200).json({ status: "success" });
};

// ---------------- الحماية والصلاحيات (Middlewares) ----------------

exports.protect = catchAsync(async (req, res, next) => {
  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    token = req.headers.authorization.split(" ")[1];
  } else if (req.cookies?.jwt) {
    token = req.cookies.jwt;
  }

  if (!token || token === "loggedout") {
    return next(
      new AppError("أنت غير مسجل الدخول! يرجى تسجيل الدخول للوصول.", 401),
    );
  }

  const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);
  const currentUser = await User.findById(decoded.id);

  if (!currentUser) {
    return next(new AppError("المستخدم صاحب هذا التوكن لم يعد موجوداً", 401));
  }

  if (currentUser.changedPasswordAfter(decoded.iat)) {
    return next(
      new AppError(
        "تم تغيير كلمة المرور مؤخراً. الرجاء تسجيل الدخول مجدداً.",
        401,
      ),
    );
  }

  req.user = currentUser;
  res.locals.user = currentUser;
  next();
});

exports.restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(
        new AppError("يرجى تسجيل الدخول للوصول إلى هذه الميزة.", 401),
      );
    }
    if (!roles.includes(req.user.role)) {
      return next(new AppError("ليس لديك الصلاحية للقيام بهذا الإجراء", 403));
    }
    next();
  };
};

// ---------------- تحديث بيانات المستخدم ----------------

exports.updatePassword = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.user.id).select("+password");
  if (!(await user.correctPassword(req.body.passwordCurrent, user.password))) {
    return next(new AppError("كلمة مرورك الحالية غير صحيحة", 401));
  }

  user.password = req.body.password;
  user.passwordConfirm = req.body.passwordConfirm || req.body.password;
  await user.save();

  createAndSendToken(user, 200, res);
});

exports.updateMe = catchAsync(async (req, res, next) => {
  if (req.body.password || req.body.passwordConfirm) {
    return next(
      new AppError(
        "هذا المسار مخصص لتحديث البيانات الشخصية فقط، وليس كلمة المرور.",
        400,
      ),
    );
  }

  const filteredBody = {};
  if (req.body.name) filteredBody.name = req.body.name.trim();
  if (req.body.email) filteredBody.email = sanitizeEmail(req.body.email);

  const updatedUser = await User.findByIdAndUpdate(req.user.id, filteredBody, {
    returnDocument: "after",
    runValidators: true,
  });

  res.status(200).json({
    status: "success",
    data: {
      user: updatedUser,
    },
  });
});

exports.deleteMe = catchAsync(async (req, res, next) => {
  await User.findByIdAndUpdate(req.user.id, { isActive: false });

  res.cookie("jwt", "loggedout", {
    expires: new Date(Date.now() + 10 * 1000),
    httpOnly: true,
  });

  res.status(204).json({
    status: "success",
    data: null,
  });
});

// ---------------- إدارة الموظفين والأدمن (Staff Management) ----------------

exports.getAllStaff = catchAsync(async (req, res, next) => {
  const staff = await User.find({ role: { $in: ["admin", "employee"] } }).sort(
    "-createdAt",
  );

  res.status(200).json({
    status: "success",
    results: staff.length,
    data: {
      staff,
    },
  });
});

exports.createStaff = catchAsync(async (req, res, next) => {
  const { name, phone, email, password, role } = req.body;

  // التأكد من كل البيانات
  if (!name || !phone || !email || !password) {
    return next(
      new AppError(
        "يرجى إدخال الاسم، البريد الإلكتروني، رقم الهاتف، وكلمة المرور",
        400,
      ),
    );
  }

  const staffRole = role === "admin" ? "admin" : "employee";
  const cleanPhone = sanitizePhone(phone);
  const cleanEmail = sanitizeEmail(email);

  // التحقق إن الموظف مش متسجل قبل كده
  const existing = await User.findOne({
    $or: [{ phone: cleanPhone }, { email: cleanEmail }],
  });

  if (existing) {
    return next(
      new AppError(
        "رقم الهاتف أو البريد الإلكتروني مسجل مسبقاً لمستخدم آخر",
        400,
      ),
    );
  }

  const newStaff = await User.create({
    name: name.trim(),
    email: cleanEmail,
    phone: cleanPhone,
    password,
    role: staffRole,
    verified: true,
  });

  newStaff.password = undefined;

  res.status(201).json({
    status: "success",
    data: {
      staff: newStaff,
    },
  });
});

exports.deleteStaff = catchAsync(async (req, res, next) => {
  if (req.params.id === req.user.id) {
    return next(new AppError("لا يمكنك حذف حسابك الشخصي كمدير نظام!", 400));
  }

  const staff = await User.findByIdAndUpdate(req.params.id, {
    isActive: false,
  });
  if (!staff) {
    return next(new AppError("لم يتم العثور على هذا الحساب", 404));
  }

  res.status(204).json({
    status: "success",
    data: null,
  });
});
