const nodemailer = require("nodemailer");
const { convert } = require("html-to-text");

// حماية من حقن HTML داخل الأسماء
const escapeHtml = (str = "") =>
  String(str).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );

const EMAIL_API_TIMEOUT_MS = 10000;

const FRONTEND_URL = process.env.FRONTEND_URL || "https://cts-alex.vercel.app";
//const LOGO_URL = `${FRONTEND_URL}/logo.png`;
const LOGO_URL = "https://cts-alex.vercel.app/logo.png";
module.exports = class Email {
  constructor(user, url) {
    this.to = user.email;
    this.firstName = (user.name || "عميلنا العزيز").split(" ")[0];
    this.url = url || FRONTEND_URL;
    this.fromEmail = process.env.EMAIL_FROM;
    this.fromName = "CTS - Create The Scene";
  }

  wrapTemplate(bodyContent) {
    return `
    <div style="background-color:#0F0E0C; padding:40px 16px; font-family:'Cairo', 'Segoe UI', Tahoma, Arial, sans-serif;">
      <div style="max-width:520px; margin:auto; background:#171512; border:1px solid #2B251B; border-radius:20px; overflow:hidden; box-shadow:0 10px 32px rgba(0,0,0,0.6);">
        <div style="background:linear-gradient(135deg, #1C1915 0%, #0F0E0C 100%); padding:28px 20px; text-align:center; border-bottom:2px solid #C8A45D;">
          <img src="${LOGO_URL}" alt="CTS" style="width:68px; height:68px; border-radius:16px; object-fit:cover; border:2px solid #C8A45D;" />
          <h1 style="color:#C8A45D; font-size:22px; margin:12px 0 4px; font-weight:800; letter-spacing:1px;">CTS</h1>
          <p style="color:#A69F91; font-size:12px; margin:0;">Create The Scene — فعالياتك وكورساتك في مكان واحد</p>
        </div>
        <div style="padding:32px 28px; text-align:right; direction:rtl; color:#F5EFE6;">
          ${bodyContent}
        </div>
        <div style="background:#0F0E0C; padding:18px 20px; text-align:center; border-top:1px solid #2B251B;">
          <p style="color:#A69F91; font-size:12px; margin:0;">CTS — Create The Scene ✨</p>
        </div>
      </div>
    </div>`;
  }

  // استخدام Brevo في الإنتاج
  async sendViaBrevoAPI(subject, htmlContent, textContent) {
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        accept: "application/json",
        "api-key": process.env.BREVO_API_KEY,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        sender: { name: this.fromName, email: this.fromEmail },
        to: [{ email: this.to, name: this.firstName }],
        subject,
        htmlContent,
        textContent,
      }),
      signal: AbortSignal.timeout(EMAIL_API_TIMEOUT_MS),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(
        `Brevo API error (status ${response.status}): ${errorBody}`,
      );
    }
  }

  // استخدام Mailtrap في التطوير
  async sendViaMailtrap(subject, htmlContent, textContent) {
    const transport = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: process.env.EMAIL_PORT,
      secure: false,
      auth: {
        user: process.env.EMAIL_USERNAME,
        pass: process.env.EMAIL_PASSWORD,
      },
      tls: {
        rejectUnauthorized: false,
      },
    });

    await transport.sendMail({
      from: `${this.fromName} <${this.fromEmail}>`,
      to: this.to,
      subject,
      html: htmlContent,
      text: textContent,
    });
  }

  // دالة الإرسال الرئيسية
  async send(subject, bodyContent) {
    const htmlContent = this.wrapTemplate(bodyContent);
    const textContent = convert(htmlContent);

    if (process.env.NODE_ENV === "production") {
      await this.sendViaBrevoAPI(subject, htmlContent, textContent);
    } else {
      await this.sendViaMailtrap(subject, htmlContent, textContent);
    }
  }

  async sendWelcome() {
    const body = `
      <h2 style="color:#C8A45D; font-size:22px; margin:0 0 12px;">أهلاً بيك يا ${escapeHtml(this.firstName)} 👋</h2>
      <p style="color:#F5EFE6; font-size:15px; line-height:1.8; margin:0 0 16px;">
        نورتنا في <strong>CTS</strong>! تم تفعيل حسابك بنجاح، ودي أول خطوة ليك عشان تحجز مقعدك في أقوى الفعاليات والكورسات بسهولة.
      </p>
      <div style="text-align:center; margin:28px 0;">
        <a href="${escapeHtml(this.url)}" style="background:#C8A45D; color:#0F0E0C; padding:13px 32px; text-decoration:none; border-radius:50px; font-weight:800; font-size:15px; display:inline-block;">
          تصفح الفعاليات والكورسات ✨
        </a>
      </div>
    `;
    await this.send("نورتنا في CTS ✨", body);
  }

  async sendPasswordResetOTP(otpCode) {
    const body = `
      <h2 style="color:#C8A45D; font-size:20px; margin:0 0 12px;">طلب استعادة كلمة المرور 🔐</h2>
      <p style="color:#F5EFE6; font-size:15px; line-height:1.8; margin:0 0 20px;">
        استخدم الكود التالي لإتمام عملية تغيير كلمة المرور:
      </p>
      <div style="background:#0F0E0C; border:2px dashed #C8A45D; border-radius:14px; padding:18px; text-align:center; margin:0 0 20px;">
        <span style="font-size:32px; font-weight:800; letter-spacing:8px; color:#C8A45D;">${otpCode}</span>
      </div>
      <p style="color:#F5EFE6; font-size:14px; margin:0 0 8px;">⏱ هذا الكود صالح لمدة <strong>10 دقائق</strong> فقط.</p>
    `;
    await this.send("كود إعادة تعيين كلمة المرور | CTS 🔐", body);
  }

  async sendOTP(otpCode) {
    const body = `
      <h2 style="color:#C8A45D; font-size:20px; margin:0 0 12px;">خطوة واحدة لتفعيل حسابك 🚀</h2>
      <p style="color:#F5EFE6; font-size:15px; line-height:1.8; margin:0 0 20px;">
        أهلاً بك يا ${escapeHtml(this.firstName)}، استخدم هذا الكود لتفعيل حسابك:
      </p>
      <div style="background:#0F0E0C; border:2px solid #C8A45D; border-radius:14px; padding:22px; text-align:center; margin:0 0 20px;">
        <span style="font-size:36px; font-weight:800; letter-spacing:10px; color:#C8A45D;">${otpCode}</span>
      </div>
      <p style="color:#A69F91; font-size:14px; margin:0;">⏱ الكود صالح لمدة <strong>10 دقائق</strong> فقط.</p>
    `;
    await this.send("كود تفعيل حسابك في CTS ✨", body);
  }

  async sendBookingTicket(bookingData, eventData) {
    const isOnlineCourse =
      eventData.type === "course" && eventData.attendanceMode === "online";
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(bookingData.ticketCode || bookingData._id)}`;

    const accessSection = isOnlineCourse
      ? `<div style="margin:16px 0; padding:16px; background:#0F0E0C; border:1px solid #C8A45D; border-radius:12px; text-align:center;">
           <p style="color:#C8A45D; font-weight:bold; margin:0 0 10px;">تفاصيل الانضمام للكورس الأونلاين:</p>
           <p style="color:#F5EFE6; font-size:14px; margin:0; word-break:break-all;">${escapeHtml(eventData.accessLink || "سيتم إرسال الرابط قريباً")}</p>
         </div>`
      : `<div style="text-align:center; margin-bottom:15px;">
           <img src="${qrCodeUrl}" alt="QR Code" style="width:150px; height:150px; border:4px solid #C8A45D; border-radius:12px; background:#fff; padding:6px;" />
           <p style="color:#A69F91; font-size:12px; margin:8px 0 0;">كود التذكرة: <strong style="color:#C8A45D;">${escapeHtml(bookingData.ticketCode || String(bookingData._id))}</strong></p>
         </div>`;

    const body = `
      <h2 style="color:#C8A45D; font-size:20px; margin:0 0 12px; text-align:center;">تم تأكيد حجزك بنجاح! 🎉</h2>
      <div style="background:#1C1915; border:1px solid #2B251B; border-radius:16px; padding:20px; margin:0 auto 20px; max-width:380px;">
        ${accessSection}
        <div style="background:#0F0E0C; border-radius:12px; padding:15px; text-align:right;">
          <p style="margin:0 0 8px; font-size:14px; border-bottom:1px solid #2B251B; padding-bottom:8px; color:#F5EFE6;">
            <strong style="color:#C8A45D;">العنوان:</strong> ${escapeHtml(eventData.title)}
          </p>
          <p style="margin:0; font-size:14px; color:#F5EFE6;">
            <strong style="color:#C8A45D;">الإجمالي المدفوع:</strong> ${bookingData.amount} ج.م
          </p>
        </div>
      </div>
    `;
    await this.send(`تأكيد حجزك: ${eventData.title} | CTS 🎟️`, body);
  }
};
