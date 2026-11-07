process.env.TZ = "Africa/Cairo";
const dotenv = require("dotenv");
dotenv.config({ path: "./.env" });

// Sentry لازم يبدأ بعد dotenv وقبل باقي الموديولات (لو مش هتستخدمه دلوقتي تقدر تعمله Comment)
// const Sentry = require("@sentry/node");
// Sentry.init({
//   dsn: process.env.SENTRY_DSN,
//   environment: process.env.NODE_ENV || "development",
// });

const mongoose = require("mongoose");
const http = require("http");
const app = require("./app");
//const startKeepAliveJob = require("./utils/keepAliveService");

const server = http.createServer(app);

// الاتصال بقاعدة البيانات
const DB = process.env.DATABASE;
mongoose
  .connect(DB, { serverSelectionTimeoutMS: 10000 })
  .then(() => {
    console.log("Mawid DB connection successful! 🚀");
  })
  .catch((err) => {
    console.error("DB connection error:", err);
    // Sentry.captureException(err);
    // Sentry.flush(2000).finally(() => process.exit(1));
    process.exit(1);
  });

const port = process.env.PORT || 5000;

server.listen(port, "0.0.0.0", () => {
  console.log(`Mawid App running on port ${port}...`);
  //startKeepAliveJob();
});

// ---------- معالجة الأخطاء على مستوى العملية ----------
process.on("unhandledRejection", (reason) => {
  console.error("Unhandled Rejection:", reason);
  // Sentry.captureException(reason);
});

process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
  // Sentry.captureException(err);
  // Sentry.flush(2000).finally(() => process.exit(1));
  process.exit(1);
});

// ---------- إيقاف هادي (Graceful Shutdown) ----------
let shuttingDown = false;
const shutdown = (signal) => {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`${signal} received: shutting down gracefully...`);

  setTimeout(() => process.exit(1), 10000).unref();

  server.close(() => {
    mongoose.connection
      .close()
      .catch((err) => console.error("Error closing DB:", err))
      .finally(() => process.exit(0));
  });
  server.closeIdleConnections?.();
};
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
