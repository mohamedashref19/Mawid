const express = require("express");
const eventController = require("../controllers/eventController");
const authController = require("../controllers/authControllers");
const uploadMiddleware = require("../middlewares/uploadMiddleware");

const router = express.Router();

// مسارات عامة (أي حد يقدر يشوف الايفنتات)
router.route("/").get(eventController.getAllEvents);

router.route("/:id").get(eventController.getEvent);

// حماية المسارات القادمة (لازم تسجيل دخول وصلاحية أدمن)
router.use(authController.protect);
router.use(authController.restrictTo("admin"));

router
  .route("/")
  .post(uploadMiddleware.uploadEventImage, eventController.createEvent);

router
  .route("/:id")
  .patch(uploadMiddleware.uploadEventImage, eventController.updateEvent)
  .delete(eventController.deleteEvent);

module.exports = router;
