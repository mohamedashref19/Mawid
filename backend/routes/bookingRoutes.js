const express = require("express");
const bookingController = require("../controllers/bookingController");
const authController = require("../controllers/authControllers");
const { uploadPaymentReceipt } = require("../middlewares/uploadMiddleware");

const router = express.Router();

// كل مسارات الحجوزات بتحتاج تسجيل دخول
router.use(authController.protect);

router.post("/", uploadPaymentReceipt, bookingController.createBooking);
router.get("/my-bookings", bookingController.getMyBookings);
router.get("/:id", bookingController.getBooking);

// مسارات للإدارة فقط
router.use(authController.restrictTo("admin", "employee"));
router.get("/", bookingController.getAllBookings);
router.post("/verify-ticket", bookingController.verifyTicket);
router.patch("/:id/status", bookingController.updateBookingStatus);

module.exports = router;
