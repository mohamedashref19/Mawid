const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { promisify } = require("util");
const User = require("../models/userModel");
const AppError = require("../utils/appError");
const catchAsync = require("../utils/catchAsync");
const Email = require("../utils/email"); // تم تفعيل ملف الإيميلات

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
  if (!req.body.phone || !req.body.email) {
    return next(new AppError("يرجى إدخال البريد الإلكتروني ورقم الهاتف", 400));
  }

  const cleanPhone = sanitizePhone(req.body.phone);
  const cleanEmail = sanitizeEmail(req.body.email);

  const existingUser = await User.findOne({
    $or: [{ phone: cleanPhone }, { email: cleanEmail }],
  }).select("+otp +otpExpires");

  const otpCode = generateOTP();
  const otpExpiresTime = new Date(Date.now() + OTP_TTL_MS);

  if (existingUser) {
    if (existingUser.verified) {
      return next(
        new AppError(
          "رقم الهاتف أو البريد الإلكتروني مستخدم بالفعل، يرجى تسجيل الدخول.",
          400,
        ),
      );
    }

    existingUser.name = req.body.name?.trim() || existingUser.name;
    existingUser.phone = cleanPhone;
    existingUser.email = cleanEmail;
    existingUser.password = req.body.password;
    existingUser.passwordConfirm =
      req.body.passwordConfirm || req.body.password;
    existingUser.otp = otpCode;
    existingUser.otpExpires = otpExpiresTime;
    await existingUser.save();

    try {
      await new Email(existingUser).sendOTP(otpCode);
    } catch (err) {
      console.error("Failed to send OTP email:", err);
      return next(
        new AppError("حدث خطأ أثناء إرسال كود التفعيل للبريد الإلكتروني", 500),
      );
    }

    return res.status(200).json({
      status: "success",
      requiresVerification: true,
      email: cleanEmail,
      message: "تم إرسال كود التفعيل إلى بريدك الإلكتروني",
    });
  }

  const newUser = await User.create({
    name: req.body.name?.trim(),
    email: cleanEmail,
    phone: cleanPhone,
    password: req.body.password,
    passwordConfirm: req.body.passwordConfirm || req.body.password,
    role: "user",
    verified: false,
    otp: otpCode,
    otpExpires: otpExpiresTime,
  });

  try {
    await new Email(newUser).sendOTP(otpCode);
  } catch (err) {
    console.error("Failed to send OTP email:", err);
    return next(
      new AppError(
        "تم إنشاء الحساب ولكن تعذر إرسال كود التفعيل، جرب إعادة الإرسال.",
        500,
      ),
    );
  }

  res.status(201).json({
    status: "success",
    requiresVerification: true,
    email: cleanEmail,
    message: "تم إنشاء الحساب وإرسال كود التفعيل إلى بريدك الإلكتروني",
  });
});

exports.login = catchAsync(async (req, res, next) => {
  const phone = sanitizePhone(req.body.phone);
  const { password } = req.body;

  if (!phone || !password) {
    return next(new AppError("يرجى تقديم رقم الهاتف وكلمة المرور", 400));
  }

  const user = await User.findOne({ phone }).select(
    "+password +otp +otpExpires",
  );

  if (!user || !(await user.correctPassword(password, user.password))) {
    return next(new AppError("رقم الهاتف أو كلمة المرور غير صحيحة", 401));
  }

  if (user.verified === false && user.role === "user") {
    if (!issuedRecently(user.otpExpires)) {
      const otpCode = generateOTP();
      user.otp = otpCode;
      user.otpExpires = new Date(Date.now() + OTP_TTL_MS);
      await user.save({ validateBeforeSave: false });

      try {
        await new Email(user).sendOTP(otpCode);
      } catch (err) {
        console.error("Failed to send login OTP:", err);
      }
    }

    return res.status(200).json({
      status: "success",
      requiresVerification: true,
      email: user.email,
      message:
        "يرجى تفعيل حسابك أولاً. تم إرسال كود التفعيل لبريدك الإلكتروني.",
    });
  }

  createAndSendToken(user, 200, res);
});

// ---------------- التحقق من الـ OTP وإعادة الإرسال ----------------

exports.verifyOTP = catchAsync(async (req, res, next) => {
  const cleanEmail = sanitizeEmail(req.body.email);
  const otpCode = normalizeOtp(req.body.otp)?.trim();

  if (!cleanEmail || !otpCode) {
    return next(new AppError("يرجى إدخال البريد الإلكتروني وكود التفعيل", 400));
  }

  if (isOtpLocked(`verify:${cleanEmail}`)) {
    return next(
      new AppError("محاولات خاطئة كثيرة! يرجى الانتظار والمحاولة مجدداً.", 429),
    );
  }

  const user = await User.findOne({ email: cleanEmail }).select(
    "+otp +otpExpires",
  );

  if (
    !user ||
    !user.otp ||
    user.otp !== otpCode ||
    !user.otpExpires ||
    user.otpExpires < Date.now()
  ) {
    registerOtpFailure(`verify:${cleanEmail}`);
    return next(new AppError("كود التفعيل غير صحيح أو منتهي الصلاحية", 400));
  }

  clearOtpFailures(`verify:${cleanEmail}`);

  user.verified = true;
  user.otp = undefined;
  user.otpExpires = undefined;
  await user.save({ validateBeforeSave: false });

  new Email(user)
    .sendWelcome()
    .catch((err) => console.error("Welcome email error:", err));

  createAndSendToken(user, 200, res);
});

exports.resendOTP = catchAsync(async (req, res, next) => {
  const cleanEmail = sanitizeEmail(req.body.email);
  if (!cleanEmail) {
    return next(new AppError("يرجى إدخال البريد الإلكتروني", 400));
  }

  const user = await User.findOne({ email: cleanEmail }).select(
    "+otp +otpExpires",
  );
  if (!user) {
    return next(new AppError("لا يوجد حساب مسجل بهذا البريد الإلكتروني", 404));
  }

  if (user.verified) {
    return next(
      new AppError("هذا الحساب مفعل بالفعل، يمكنك تسجيل الدخول", 400),
    );
  }

  if (issuedRecently(user.otpExpires)) {
    return next(
      new AppError("يرجى الانتظار دقيقة واحدة قبل طلب كود جديد", 429),
    );
  }

  const otpCode = generateOTP();
  user.otp = otpCode;
  user.otpExpires = new Date(Date.now() + OTP_TTL_MS);
  await user.save({ validateBeforeSave: false });

  await new Email(user).sendOTP(otpCode);

  res.status(200).json({
    status: "success",
    message: "تم إعادة إرسال كود التفعيل إلى بريدك الإلكتروني",
  });
});

// ---------------- استعادة كلمة المرور ----------------

exports.forgotPassword = catchAsync(async (req, res, next) => {
  const cleanEmail = sanitizeEmail(req.body.email);
  if (!cleanEmail)
    return next(new AppError("يرجى إدخال البريد الإلكتروني", 400));

  const user = await User.findOne({ email: cleanEmail }).select(
    "+passwordResetOTP +passwordResetOTPExpires",
  );
  if (!user)
    return next(
      new AppError("لا يوجد مستخدم مسجل بهذا البريد الإلكتروني", 404),
    );

  if (issuedRecently(user.passwordResetOTPExpires)) {
    return next(new AppError("يرجى الانتظار دقيقة قبل طلب كود جديد", 429));
  }

  const otpCode = generateOTP();
  user.passwordResetOTP = otpCode;
  user.passwordResetOTPExpires = new Date(Date.now() + OTP_TTL_MS);
  await user.save({ validateBeforeSave: false });

  try {
    await new Email(user).sendPasswordResetOTP(otpCode);
    res.status(200).json({
      status: "success",
      message: "تم إرسال كود استعادة كلمة المرور إلى بريدك الإلكتروني",
    });
  } catch (err) {
    user.passwordResetOTP = undefined;
    user.passwordResetOTPExpires = undefined;
    await user.save({ validateBeforeSave: false });
    return next(
      new AppError("حدث خطأ أثناء إرسال الإيميل، يرجى المحاولة لاحقاً", 500),
    );
  }
});

exports.resetPassword = catchAsync(async (req, res, next) => {
  const cleanEmail = sanitizeEmail(req.body.email);
  const otpCode = normalizeOtp(req.body.otp)?.trim();
  const { password, passwordConfirm } = req.body;

  if (!cleanEmail || !otpCode || !password) {
    return next(
      new AppError(
        "يرجى إدخال البريد الإلكتروني، الكود، وكلمة المرور الجديدة",
        400,
      ),
    );
  }

  if (isOtpLocked(`reset:${cleanEmail}`)) {
    return next(
      new AppError("محاولات خاطئة كثيرة! يرجى الانتظار والمحاولة مجدداً.", 429),
    );
  }

  const user = await User.findOne({ email: cleanEmail }).select(
    "+passwordResetOTP +passwordResetOTPExpires",
  );

  if (
    !user ||
    !user.passwordResetOTP ||
    user.passwordResetOTP !== otpCode ||
    !user.passwordResetOTPExpires ||
    user.passwordResetOTPExpires < Date.now()
  ) {
    registerOtpFailure(`reset:${cleanEmail}`);
    return next(new AppError("الكود غير صحيح أو منتهي الصلاحية", 400));
  }

  clearOtpFailures(`reset:${cleanEmail}`);

  user.password = password;
  user.passwordConfirm = passwordConfirm || password;
  user.passwordResetOTP = undefined;
  user.passwordResetOTPExpires = undefined;
  user.verified = true;
  await user.save();

  createAndSendToken(user, 200, res);
});

// ---------------- باقي الدوال (بدون تغيير) ----------------

exports.getMe = catchAsync(async (req, res, next) => {
  res.status(200).json({
    status: "success",
    data: { user: req.user },
  });
});

exports.logout = (req, res) => {
  res.cookie("jwt", "loggedout", {
    expires: new Date(Date.now() + 10 * 1000),
    httpOnly: true,
  });
  res.status(200).json({ status: "success" });
};

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
    if (!req.user) return next(new AppError("يرجى تسجيل الدخول.", 401));
    if (!roles.includes(req.user.role)) {
      return next(new AppError("ليس لديك الصلاحية", 403));
    }
    next();
  };
};

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
    return next(new AppError("هذا المسار مخصص لتحديث البيانات فقط.", 400));
  }

  const filteredBody = {};
  if (req.body.name) filteredBody.name = req.body.name.trim();

  const updatedUser = await User.findByIdAndUpdate(req.user.id, filteredBody, {
    returnDocument: "after",
    runValidators: true,
  });

  res.status(200).json({ status: "success", data: { user: updatedUser } });
});

exports.deleteMe = catchAsync(async (req, res, next) => {
  await User.findByIdAndUpdate(req.user.id, { isActive: false });
  res.cookie("jwt", "loggedout", {
    expires: new Date(Date.now() + 10 * 1000),
    httpOnly: true,
  });
  res.status(204).json({ status: "success", data: null });
});

exports.getAllStaff = catchAsync(async (req, res, next) => {
  const staff = await User.find({ role: { $in: ["admin", "employee"] } }).sort(
    "-createdAt",
  );
  res
    .status(200)
    .json({ status: "success", results: staff.length, data: { staff } });
});

exports.createStaff = catchAsync(async (req, res, next) => {
  const { name, phone, email, password, role } = req.body;
  if (!name || !phone || !email || !password) {
    return next(new AppError("يرجى إدخال جميع البيانات", 400));
  }

  const staffRole = role === "admin" ? "admin" : "employee";
  const cleanPhone = sanitizePhone(phone);
  const cleanEmail = sanitizeEmail(email);

  const existing = await User.findOne({
    $or: [{ phone: cleanPhone }, { email: cleanEmail }],
  });
  if (existing)
    return next(
      new AppError("رقم الهاتف أو البريد الإلكتروني مسجل مسبقاً", 400),
    );

  const newStaff = await User.create({
    name: name.trim(),
    email: cleanEmail,
    phone: cleanPhone,
    password,
    role: staffRole,
    verified: true,
  });

  newStaff.password = undefined;
  res.status(201).json({ status: "success", data: { staff: newStaff } });
});

exports.deleteStaff = catchAsync(async (req, res, next) => {
  if (req.params.id === req.user.id)
    return next(new AppError("لا يمكنك حذف حسابك الشخصي!", 400));

  // حسابات الإدارة (admin/employee) فقط، مش حسابات العملاء
  const staff = await User.findOneAndUpdate(
    { _id: req.params.id, role: { $in: ["admin", "employee"] } },
    { isActive: false },
  );
  if (!staff) return next(new AppError("لم يتم العثور على الحساب", 404));

  res.status(204).json({ status: "success", data: null });
});

exports.updateStaff = catchAsync(async (req, res, next) => {
  const { name, phone, email, password, role } = req.body;

  // نعدّل حسابات الإدارة فقط. من غير الفلتر ده الأدمن كان يقدر يغيّر
  // إيميل أو باسورد أي عميل عن طريق /users/staff/:id
  const staff = await User.findOne({
    _id: req.params.id,
    role: { $in: ["admin", "employee"] },
  });
  if (!staff) {
    return next(new AppError("لم يتم العثور على حساب الموظف", 404));
  }

  if (name) staff.name = name.trim();
  if (phone) staff.phone = sanitizePhone(phone);
  if (email) staff.email = sanitizeEmail(email);

  if (role) {
    const newRole = role === "admin" ? "admin" : "employee";
    // منع الأدمن من تنزيل صلاحية حسابه هو (ممكن النظام يفضل من غير أدمن)
    if (String(staff._id) === String(req.user._id) && newRole !== staff.role) {
      return next(new AppError("لا يمكنك تغيير صلاحية حسابك الشخصي", 400));
    }
    staff.role = newRole;
  }

  // الباسورد بيتشفّر تلقائياً في الـ pre-save hook بتاع الـ User
  if (typeof password === "string" && password.trim().length > 0) {
    staff.password = password;
    staff.passwordConfirm = password;
  }

  await staff.save();
  staff.password = undefined;

  res.status(200).json({
    status: "success",
    data: { staff },
  });
});
