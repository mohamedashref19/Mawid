const mongoose = require("mongoose");
const validator = require("validator");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "يرجى إدخال الاسم!"],
      trim: true,
      maxlength: [100, "الاسم طويل جداً"],
    },
    email: {
      type: String,
      unique: true,
      required: [true, "يرجى إدخال بريد إلكتروني"],
      trim: true,
      lowercase: true,
      validate: [validator.isEmail, "يرجى إدخال بريد إلكتروني صالح"],
    },
    phone: {
      type: String,
      required: [true, "يرجى إدخال رقم الهاتف"],
      unique: true,
      trim: true,
      maxlength: [20, "رقم الهاتف طويل جداً"],
    },
    role: {
      type: String,
      enum: ["admin", "employee", "user"],
      default: "user",
    },
    password: {
      type: String,
      required: [true, "يرجى إدخال كلمة المرور"],
      minlength: [6, "كلمة المرور يجب أن تكون 6 أحرف على الأقل"],
      select: false,
    },
    passwordConfirm: {
      type: String,
      validate: {
        validator: function (el) {
          // لو مبعوتة، نتأكد إنها مطابقة للباسورد
          return !el || el === this.password;
        },
        message: "كلمتا المرور غير متطابقتين!",
      },
    },
    avatar: {
      type: String,
      default: "default.jpg",
    },
    isActive: {
      type: Boolean,
      default: true,
      select: false,
    },
    verified: {
      type: Boolean,
      default: false,
    },
    otp: { type: String, select: false },
    otpExpires: Date,
    passwordResetOTP: { type: String, select: false },
    passwordResetOTPExpires: Date,
    passwordChangedAt: Date,
    passwordResetToken: { type: String, select: false },
    passwordResetExpires: { type: Date, select: false },
  },
  {
    timestamps: true,
  },
);

// 1) Middlewares
userSchema.pre("save", async function () {
  if (!this.isModified("password")) return;

  this.password = await bcrypt.hash(this.password, 12);
  this.passwordConfirm = undefined;
});

userSchema.pre("save", function () {
  if (!this.isModified("password") || this.isNew) return;

  this.passwordChangedAt = Date.now() - 1000;
});

userSchema.pre(/^find/, function () {
  this.find({ isActive: { $ne: false } });
});

// 2) Methods
userSchema.methods.correctPassword = async function (
  candidatePassword,
  userPassword,
) {
  return await bcrypt.compare(candidatePassword, userPassword);
};

userSchema.methods.changedPasswordAfter = function (JWTTimestamp) {
  if (this.passwordChangedAt) {
    const changedTimestamp = parseInt(
      this.passwordChangedAt.getTime() / 1000,
      10,
    );
    return JWTTimestamp < changedTimestamp;
  }
  return false;
};

userSchema.methods.createPasswordResetToken = function () {
  const resetToken = crypto.randomBytes(32).toString("hex");

  this.passwordResetToken = crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");

  this.passwordResetExpires = Date.now() + 10 * 60 * 1000;

  return resetToken;
};

const User = mongoose.model("User", userSchema);

module.exports = User;
