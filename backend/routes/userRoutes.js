const express = require("express");
const rateLimit = require("express-rate-limit");
const authController = require("../controllers/authControllers");

const router = express.Router();

// 🛡️ إعدادات Rate Limiters المخصصة للمسارات الحساسة

// 1. Limiter خاص بتسجيل الدخول (Login) لمنع هجمات التخمين
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 دقيقة
  max: 5, // 5 محاولات فقط
  message: {
    status: "fail",
    message:
      "تم تجاوز الحد الأقصى لمحاولات تسجيل الدخول. يرجى المحاولة بعد 15 دقيقة.",
  },
});

// 2. Limiter خاص بتأكيد الـ OTP وإعادة تعيين كلمة المرور لمنع تخمين الكود
const otpLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 دقائق (مدة صلاحية الـ OTP غالباً)
  max: 5, // 5 محاولات فقط لإدخال الكود الصحيح
  message: {
    status: "fail",
    message:
      "محاولات كثيرة خاطئة لإدخال الكود. يرجى المحاولة لاحقاً أو طلب كود جديد.",
  },
});

// 3. Limiter خاص بطلب إرسال الإيميلات (Forgot Password / Resend OTP) لمنع الإزعاج (Email Bombing)
const emailLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // ساعة واحدة
  max: 5, // 5 محاولات إرسال إيميل في الساعة لنفس الـ IP
  message: {
    status: "fail",
    message:
      "لقد طلبت إرسال العديد من الرموز. يرجى الانتظار لمدة ساعة قبل المحاولة مرة أخرى.",
  },
});

// 4. Limiter خاص بإنشاء الحسابات لمنع الحسابات الوهمية (Spam)
const signupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // ساعة واحدة
  max: 3, // 3 حسابات فقط من نفس الـ IP في الساعة
  message: {
    status: "fail",
    message:
      "تم تجاوز الحد الأقصى لإنشاء الحسابات من هذا الجهاز. يرجى المحاولة لاحقاً.",
  },
});

// 🔗 المسارات (Routes)

// مسارات عامة (Public)
router.post("/signup", signupLimiter, authController.signup);
router.post("/register", signupLimiter, authController.signup);
router.post("/login", loginLimiter, authController.login);

// مسارات التفعيل واستعادة كلمة المرور
router.post("/verify-otp", otpLimiter, authController.verifyOTP);
router.post("/resend-otp", emailLimiter, authController.resendOTP);
router.post("/forgot-password", emailLimiter, authController.forgotPassword);
router.post("/reset-password", otpLimiter, authController.resetPassword);

// 🔒 حماية كل المسارات القادمة (تتطلب تسجيل الدخول)

router.use(authController.protect);

router.get("/me", authController.getMe);
router.get("/logout", authController.logout);
router.patch("/update-password", authController.updatePassword);
router.patch("/update-me", authController.updateMe);
router.delete("/deleteMe", authController.deleteMe);

// 👑 مسارات إدارة الموظفين (خاصة بـ Admin فقط)

router.use(authController.restrictTo("admin"));

router
  .route("/staff")
  .get(authController.getAllStaff)
  .post(authController.createStaff);

router.delete("/staff/:id", authController.deleteStaff);

module.exports = router;
