const express = require("express");
const authController = require("../controllers/authControllers");

const router = express.Router();

// مسارات عامة (Public)
router.post("/signup", authController.signup);
router.post("/register", authController.signup);
router.post("/login", authController.login);

// مسارات التفعيل واستعادة كلمة المرور
router.post("/verify-otp", authController.verifyOTP);
router.post("/resend-otp", authController.resendOTP);
router.post("/forgot-password", authController.forgotPassword);
router.post("/reset-password", authController.resetPassword);

// حماية كل المسارات القادمة (تتطلب تسجيل الدخول)
router.use(authController.protect);

router.get("/me", authController.getMe);
router.get("/logout", authController.logout);
router.patch("/update-password", authController.updatePassword);
router.patch("/update-me", authController.updateMe);
router.delete("/deleteMe", authController.deleteMe);

// مسارات إدارة الموظفين (خاصة بـ Admin فقط)
router.use(authController.restrictTo("admin"));

router
  .route("/staff")
  .get(authController.getAllStaff)
  .post(authController.createStaff);

router.delete("/staff/:id", authController.deleteStaff);

module.exports = router;
