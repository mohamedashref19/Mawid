const cron = require("node-cron");
const axios = require("axios");

// رابط السيرفر بتاعك على Render
// لازم يكون الرابط الحقيقي اللي السيرفر شغال عليه (من .env أو ثابت)
const SERVER_URL = process.env.SERVER_URL;

const pingServer = async () => {
  try {
    const response = await axios.get(`${SERVER_URL}/`, {
      timeout: 10000, // 10 ثواني timeout عشان ميعلقش لو السيرفر بيصحى من النوم
    });

    console.log(
      `[Keep-Alive] Ping successful at ${new Date().toISOString()} - Status: ${response.status}`,
    );
  } catch (error) {
    // لو فشل الـ ping، ممكن يكون السيرفر لسه بيصحى أو فيه مشكلة شبكة
    console.error(
      `[Keep-Alive] Ping failed at ${new Date().toISOString()}:`,
      error.message,
    );
  }
};

// تشغيل خدمة الـ Keep-Alive
const startKeepAliveJob = () => {
  // تشغيل كل ١٠ دقايق (لازم يكون أقل من ١٥ دقيقة عشان Render مينامش)
  cron.schedule("*/10 * * * *", async () => {
    await pingServer();
  });

  console.log(
    "The keep-alive service (Cron Job) has been activated - pinging every 10 minutes.",
  );
};

module.exports = startKeepAliveJob;
