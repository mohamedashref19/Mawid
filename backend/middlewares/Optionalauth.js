const jwt = require("jsonwebtoken");
const { promisify } = require("util");
const User = require("../models/userModel");

/**
 * بيحاول يعرّف المستخدم لو معاه توكن صالح ويحطه في req.user.
 * على عكس protect: مبيرجّعش خطأ أبداً. لو مفيش توكن أو التوكن غلط
 * بيكمّل الطلب كزائر عادي.
 *
 * بنستخدمه على مسارات الايفنتات العامة عشان نقدر نرجّع حقول حساسة
 * (زي accessLink بتاع الكورسات الأونلاين) للأدمن بس.
 */
module.exports = async (req, res, next) => {
  try {
    let token;
    if (req.headers.authorization?.startsWith("Bearer")) {
      token = req.headers.authorization.split(" ")[1];
    } else if (req.cookies?.jwt) {
      token = req.cookies.jwt;
    }

    if (token && token !== "loggedout") {
      const decoded = await promisify(jwt.verify)(
        token,
        process.env.JWT_SECRET,
      );
      const user = await User.findById(decoded.id);
      if (user && !user.changedPasswordAfter(decoded.iat)) {
        req.user = user;
      }
    }
  } catch {
    // توكن غير صالح/منتهي: نتعامل معاه كزائر
  }
  next();
};
