const cron = require("node-cron");
const axios = require("axios");

// يقرأ SERVER_URL أو متغير Render التلقائي أو الرابط المباشر بتاعك كاحتياطي
const SERVER_URL =
  process.env.SERVER_URL ||
  process.env.RENDER_EXTERNAL_URL ||
  "https://mawid-omug.onrender.com";

const pingServer = async () => {
  try {
    const response = await axios.get(`${SERVER_URL}/`, {
      timeout: 10000,
    });

    console.log(
      `[Keep-Alive] Ping successful at ${new Date().toISOString()} - Status: ${response.status}`,
    );
  } catch (error) {
    console.error(
      `[Keep-Alive] Ping failed at ${new Date().toISOString()}:`,
      error.message,
    );
  }
};

const startKeepAliveJob = () => {
  // يشتغل فقط على السيرفر الحقيقي أو لو حابب تجربه محلياً
  cron.schedule("*/10 * * * *", async () => {
    await pingServer();
  });

  console.log(
    `Keep-alive cron activated — pinging ${SERVER_URL} every 10 minutes.`,
  );
};

module.exports = startKeepAliveJob;
