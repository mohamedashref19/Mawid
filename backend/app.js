const hpp = require("hpp");
const path = require("path");
const express = require("express");
const cors = require("cors");
const mongoSanitize = require("express-mongo-sanitize");
const rateLimit = require("express-rate-limit");
const helmet = require("helmet");
const morgan = require("morgan");
const cookieParser = require("cookie-parser");

const AppError = require("./utils/appError");
const globalErrorHandler = require("./controllers/errorController");

const userRouter = require("./routes/userRoutes");
const eventRoutes = require("./routes/eventRoutes");
const bookingRoutes = require("./routes/bookingRoutes");
// const adminRoutes = require("./routes/adminRoutes");

const app = express();

app.set("trust proxy", 1);

// Security Middlewares
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  }),
);

// CORS
const allowedOrigins = [
  process.env.FRONTEND_URL,
  "http://localhost:5173", // پورت الفرونت إند بتاع Lovable (Vite)
  "http://localhost:8081",
  "http://localhost:8080",
  "https://cts-alex.vercel.app",
].filter(Boolean);
app.set("allowedOrigins", allowedOrigins);

const corsOptions = {
  origin: allowedOrigins,
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
};

app.use(cors(corsOptions));
app.options(/.*/, cors(corsOptions));

// ---------- Rate limiting ----------
const limitMessage = (message) => ({ status: "fail", message });

const limiter = rateLimit({
  max: 500,
  windowMs: 15 * 60 * 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: limitMessage("طلبات كثيرة جداً، يرجى المحاولة بعد قليل"),
});
app.use("/api", limiter);

// Dev Logging
if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
}

// Body Parser
app.use(express.json({ limit: "10kb" }));

// NoSQL injection sanitization
app.use((req, res, next) => {
  if (req.body) mongoSanitize.sanitize(req.body, { replaceWith: "_" });
  if (req.params) mongoSanitize.sanitize(req.params, { replaceWith: "_" });
  if (req.query) mongoSanitize.sanitize(req.query, { replaceWith: "_" });
  next();
});

app.use(hpp());
app.use(cookieParser());

// رفع وعرض صور التحويلات
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Test Route
app.get("/", (req, res) => {
  res.status(200).send("Mawid API is running successfully! 🚀");
});
app.get("/ping", (req, res) => {
  console.log(
    `[Keep-Alive] Ping received from external Cron at ${new Date().toISOString()}`,
  );
  res.status(200).send("Server is alive! 🚀");
});

app.use("/api/v1/users", userRouter);
app.use("/api/v1/events", eventRoutes);
app.use("/api/v1/bookings", bookingRoutes);
// app.use("/api/v1/admin", adminRoutes);

app.all(/(.*)/, (req, res, next) => {
  next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
});

app.use(globalErrorHandler);

module.exports = app;
