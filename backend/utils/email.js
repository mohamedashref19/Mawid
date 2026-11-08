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

// ---- فصل الروابط عن التفاصيل (نفس منطق frontend/src/lib/access.ts) ----
const URL_RE = /https?:\/\/[^\s]+/gi;
const TRAILING_PUNCT_RE = /[)\]}>.,;:!?،؛؟'"”’»…]+$/u;

const isHttpUrl = (value) => {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
};

const extractLinks = (text = "") =>
  Array.from(
    new Set(
      (String(text).match(URL_RE) || [])
        .map((u) => u.replace(TRAILING_PUNCT_RE, ""))
        .filter(isHttpUrl),
    ),
  );

const stripLinks = (text = "") =>
  String(text)
    .replace(URL_RE, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

const linkLabel = (url) => {
  let host = "";
  try {
    host = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "الرابط";
  }
  const is = (...domains) =>
    domains.some((d) => host === d || host.endsWith("." + d));
  if (is("wa.me", "whatsapp.com")) return "واتساب";
  if (is("zoom.us", "zoom.com")) return "Zoom";
  if (is("meet.google.com")) return "Google Meet";
  if (is("t.me", "telegram.me", "telegram.org")) return "تيليجرام";
  if (is("youtube.com", "youtu.be")) return "يوتيوب";
  if (is("teams.microsoft.com", "teams.live.com")) return "Microsoft Teams";
  if (is("facebook.com", "fb.me", "fb.com")) return "فيسبوك";
  if (is("drive.google.com", "docs.google.com")) return "Google Drive";
  if (is("discord.gg", "discord.com")) return "ديسكورد";
  return host;
};

// لو في أكتر من رابط لنفس الموقع بنرقّمهم (واتساب 1، واتساب 2)
const labelLinks = (urls) => {
  const base = urls.map(linkLabel);
  return urls.map((url, i) => {
    const same = base.filter((l) => l === base[i]).length;
    const nth = base.slice(0, i + 1).filter((l) => l === base[i]).length;
    return { url, label: same > 1 ? `${base[i]} ${nth}` : base[i] };
  });
};

const EMAIL_API_TIMEOUT_MS = 10000;

const FRONTEND_URL = process.env.FRONTEND_URL || "https://cts-alex.vercel.app";
const LOGO_URL = "https://cts-alex.vercel.app/logo.png";

module.exports = class Email {
  constructor(user, url) {
    this.to = user.email;
    this.firstName = (user.name || "عميلنا العزيز").split(" ")[0];
    this.url = url || FRONTEND_URL;
    this.fromEmail = process.env.EMAIL_FROM;
    this.fromName = "CTS - Create Top Scene";
  }

  wrapTemplate(bodyContent) {
    return `
    <div style="background-color:#0F0E0C; padding:40px 16px; font-family:'Cairo', 'Segoe UI', Tahoma, Arial, sans-serif;">
      <div style="max-width:520px; margin:auto; background:#171512; border:1px solid #2B251B; border-radius:20px; overflow:hidden; box-shadow:0 10px 32px rgba(0,0,0,0.6);">
        <div style="background:linear-gradient(135deg, #1C1915 0%, #0F0E0C 100%); padding:28px 20px; text-align:center; border-bottom:2px solid #C8A45D;">
          <img src="${LOGO_URL}" alt="CTS" style="width:68px; height:68px; border-radius:16px; object-fit:cover; border:2px solid #C8A45D;" />
          <h1 style="color:#C8A45D; font-size:22px; margin:12px 0 4px; font-weight:800; letter-spacing:1px;">CTS</h1>
          <p style="color:#A69F91; font-size:12px; margin:0;">Create Top Scene — فعالياتك وكورساتك في مكان واحد</p>
        </div>
        <div style="padding:32px 28px; text-align:right; direction:rtl; color:#F5EFE6;">
          ${bodyContent}
        </div>
        <div style="background:#0F0E0C; padding:18px 20px; text-align:center; border-top:1px solid #2B251B;">
          <p style="color:#A69F91; font-size:12px; margin:0;">CTS — Create Top Scene ✨</p>
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

    const rawTicket = String(bookingData.ticketCode || bookingData._id || "");
    const shortCode =
      "MW-" + rawTicket.replace(/-/g, "").slice(0, 6).toUpperCase();

    const qrData = `${rawTicket}|${shortCode}`;
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(qrData)}`;

    // روابط الانضمام (واحد أو أكتر) + التفاصيل النصية، مع دعم الكورسات القديمة
    // اللي كان فيها الرسالة والرابط في نفس الحقل
    const rawAccess = (eventData.accessLink || "").trim();
    const accessLinks = labelLinks(extractLinks(rawAccess));
    const accessDetails =
      (eventData.accessDetails || "").trim() || stripLinks(rawAccess);

    const quantity = Number(bookingData.quantity) || 1;
    const amount = Number(bookingData.amount) || 0;

    // الايفنت بيتخزن كـ UTC midnight للتاريخ اللي الأدمن اختاره، فبنعرضه بـ UTC
    // عشان نفس اليوم يظهر بغض النظر عن توقيت السيرفر
    let dateText = "";
    try {
      dateText = new Date(eventData.date).toLocaleDateString("ar-EG", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
        timeZone: "UTC",
      });
    } catch {
      dateText = "";
    }

    const detailRows = [
      ["العنوان", eventData.title],
      ["التاريخ", dateText],
      ["الوقت", eventData.time],
      // المكان بيتعرض للحضور الفعلي بس (للأونلاين الحقل ده رابط/منصة)
      ["المكان", isOnlineCourse ? "" : eventData.location],
      ["عدد التذاكر", String(quantity)],
      ["الإجمالي", amount > 0 ? `${amount} ج.م` : "مجاني"],
    ]
      .filter(([, value]) => value)
      .map(
        ([label, value], i, arr) =>
          `<p style="margin:0${i < arr.length - 1 ? " 0 8px" : ""}; font-size:14px; color:#F5EFE6;${
            i < arr.length - 1
              ? " border-bottom:1px solid #2B251B; padding-bottom:8px;"
              : ""
          }"><strong style="color:#C8A45D;">${label}:</strong> ${escapeHtml(value)}</p>`,
      )
      .join("\n          ");

    const ticketPageUrl = `${FRONTEND_URL}/ticket/${bookingData._id}`;

    const linkButtonsHtml = accessLinks
      .map(
        ({ url, label }) =>
          `<div style="text-align:center; margin-top:8px;">
             <a href="${escapeHtml(url)}" target="_blank" style="background:#C8A45D; color:#0F0E0C; padding:10px 24px; text-decoration:none; border-radius:50px; font-weight:800; font-size:14px; display:inline-block;">
               انضم عبر ${escapeHtml(label)} 🔗
             </a>
           </div>`,
      )
      .join("");

    const onlineDetailsSection = isOnlineCourse
      ? `<div style="margin:0 0 18px; padding:16px; background:#0F0E0C; border:1px solid #C8A45D; border-radius:12px; text-align:right; direction:rtl;">
           <p style="color:#C8A45D; font-weight:bold; margin:0 0 8px; text-align:center;">تفاصيل الانضمام للكورس الأونلاين:</p>
           ${
             accessDetails
               ? `<p style="color:#F5EFE6; font-size:14px; line-height:1.7; margin:0 0 12px; white-space:pre-line; word-break:break-word;">${escapeHtml(accessDetails)}</p>`
               : accessLinks.length === 0
                 ? `<p style="color:#A69F91; font-size:13px; margin:0; text-align:center;">سيتم إرسال التفاصيل والرابط قريباً</p>`
                 : ""
           }
           ${linkButtonsHtml}
         </div>`
      : "";

    const qrSection = `
      <div style="text-align:center; margin-bottom:18px;">
        <img src="${qrCodeUrl}" alt="QR Code" style="width:160px; height:160px; border:4px solid #C8A45D; border-radius:14px; background:#fff; padding:8px;" />
        <p style="color:#A69F91; font-size:11px; margin:10px 0 2px;">رقم التذكرة</p>
        <p dir="ltr" style="color:#C8A45D; font-size:18px; font-weight:800; letter-spacing:3px; margin:0;">${escapeHtml(shortCode)}</p>
        ${
          quantity > 1
            ? `<p style="color:#A69F91; font-size:12px; margin:8px 0 0;">هذا الكود يسمح بدخول ${quantity} أشخاص</p>`
            : ""
        }
      </div>`;

    const body = `
      <h2 style="color:#C8A45D; font-size:20px; margin:0 0 12px; text-align:center;">تم تأكيد حجزك بنجاح! 🎉</h2>
      <div style="background:#1C1915; border:1px solid #2B251B; border-radius:16px; padding:20px; margin:0 auto 20px; max-width:380px;">
        ${onlineDetailsSection}
        ${qrSection}
        <div style="background:#0F0E0C; border-radius:12px; padding:15px; text-align:right;">
          ${detailRows}
        </div>
      </div>
      <p style="text-align:center; margin:0;">
        <a href="${escapeHtml(ticketPageUrl)}" style="color:#C8A45D; font-size:13px; text-decoration:underline;">
          عرض التذكرة في الموقع
        </a>
      </p>
    `;
    await this.send(`تأكيد حجزك: ${eventData.title} | CTS 🎟️`, body);
  }
};
