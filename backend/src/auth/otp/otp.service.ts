import crypto from "crypto";
import prisma from "../../lib/prisma";
import AppError from "../../lib/AppError";
import { sendOtpEmail } from "../../lib/email";

const OTP_EXPIRY_MINUTES = 10;
const MAX_ATTEMPTS = 5;
/** Minimum seconds between two OTP requests for the same target */
const RESEND_COOLDOWN_SECONDS = 60;

/** Generate a cryptographically random 6-digit OTP */
const generateOtp = (): string =>
  String(crypto.randomInt(100000, 999999));

/**
 * Request an OTP for login.
 * Works with email — creates the user record if first-time login.
 */
export const requestOtp = async (target: string) => {
  const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(target);
  if (!isEmail) {
    throw new AppError("Please provide a valid email address", 400, "INVALID_TARGET");
  }

  // Find or create user by email
  let user = await prisma.user.findUnique({ where: { email: target } });
  if (!user) {
    // Auto-create a placeholder user for OTP-based signup
    user = await prisma.user.create({
      data: {
        name: target.split("@")[0] ?? "User",
        email: target,
        passwordHash: "",           // No password for OTP users
      },
    });
  }

  // Rate-limit: check if a recent OTP was already sent
  const recentOtp = await prisma.otpCode.findFirst({
    where: {
      userId: user.id,
      target,
      used: false,
      createdAt: { gt: new Date(Date.now() - RESEND_COOLDOWN_SECONDS * 1000) },
    },
  });
  if (recentOtp) {
    const waitSeconds = RESEND_COOLDOWN_SECONDS - Math.floor((Date.now() - recentOtp.createdAt.getTime()) / 1000);
    throw new AppError(
      `Please wait ${waitSeconds}s before requesting another OTP`,
      429,
      "OTP_TOO_SOON",
    );
  }

  // Invalidate all previous unused OTPs for this user
  await prisma.otpCode.updateMany({
    where: { userId: user.id, target, used: false },
    data: { used: true },
  });

  const code = generateOtp();
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

  await prisma.otpCode.create({
    data: { userId: user.id, code, target, type: "LOGIN", expiresAt },
  });

  // Send OTP via email
  await sendOtpEmail(target, code, OTP_EXPIRY_MINUTES);

  return { message: `OTP sent to ${target}`, expiresInMinutes: OTP_EXPIRY_MINUTES };
};

/**
 * Verify OTP and return auth tokens if valid.
 * Imported by auth.service.ts to produce JWT tokens.
 */
export const verifyOtp = async (target: string, code: string) => {
  const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(target);
  if (!isEmail) {
    throw new AppError("Invalid target", 400, "INVALID_TARGET");
  }

  const user = await prisma.user.findUnique({ where: { email: target } });
  if (!user) throw new AppError("No account found for this address", 404, "USER_NOT_FOUND");

  const otpRecord = await prisma.otpCode.findFirst({
    where: {
      userId: user.id,
      target,
      used: false,
      type: "LOGIN",
    },
    orderBy: { createdAt: "desc" },
  });

  if (!otpRecord) {
    throw new AppError("No active OTP found. Please request a new one.", 400, "OTP_NOT_FOUND");
  }

  // Increment attempt count before checking, to prevent brute-force even on expiry
  await prisma.otpCode.update({
    where: { id: otpRecord.id },
    data: { attempts: { increment: 1 } },
  });

  if (otpRecord.attempts + 1 > MAX_ATTEMPTS) {
    await prisma.otpCode.update({ where: { id: otpRecord.id }, data: { used: true } });
    throw new AppError("Too many incorrect attempts. Request a new OTP.", 429, "OTP_MAX_ATTEMPTS");
  }

  if (otpRecord.expiresAt < new Date()) {
    await prisma.otpCode.update({ where: { id: otpRecord.id }, data: { used: true } });
    throw new AppError("OTP has expired. Please request a new one.", 400, "OTP_EXPIRED");
  }

  if (otpRecord.code !== code.trim()) {
    throw new AppError("Invalid OTP", 400, "OTP_INVALID");
  }

  // Mark OTP as used
  await prisma.otpCode.update({ where: { id: otpRecord.id }, data: { used: true } });

  // OTP login proves email ownership — mark verified if not already
  if (!user.isVerified) {
    return await prisma.user.update({ where: { id: user.id }, data: { isVerified: true } });
  }

  return user;
};
