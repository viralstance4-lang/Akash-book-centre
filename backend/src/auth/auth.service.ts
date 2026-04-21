import bcrypt from "bcryptjs";
import crypto from "crypto";
import jwt, { type Secret, type SignOptions } from "jsonwebtoken";

import env from "../config/env";
import AppError from "../lib/AppError";
import prisma from "../lib/prisma";
import { sendVerificationEmail } from "../lib/email";
import { verifyOtp } from "./otp/otp.service";

type RegisterUserInput = { name: string; email: string; password: string };
type LoginUserInput    = { email: string; password: string };

const ACCESS_TOKEN_EXPIRES_IN = env.JWT_ACCESS_EXPIRES_IN as SignOptions["expiresIn"];
const SESSION_TTL_HOURS   = 10;
const REFRESH_TOKEN_TTL_DAYS = 7;
const SALT_ROUNDS = 12;
const JWT_ACCESS_SECRET: Secret = env.JWT_ACCESS_SECRET;

const OTP_EXPIRY_MINUTES = 10;
const RESEND_COOLDOWN_SECONDS = 60;
const MAX_ATTEMPTS = 5;

// ─── Token Helpers ────────────────────────────────────────────────────────────

const generateAccessToken = (user: { id: string; email: string; role: string }) =>
  jwt.sign({ sub: user.id, email: user.email, role: user.role }, JWT_ACCESS_SECRET, {
    expiresIn: ACCESS_TOKEN_EXPIRES_IN,
  });

const generateRefreshToken = () => crypto.randomBytes(40).toString("hex");
const hashRefreshToken     = (token: string) =>
  crypto.createHash("sha256").update(token).digest("hex");

const getRefreshTokenExpiry = () => {
  const d = new Date();
  d.setDate(d.getDate() + REFRESH_TOKEN_TTL_DAYS);
  return d;
};

const getSessionExpiry = () =>
  new Date(Date.now() + SESSION_TTL_HOURS * 60 * 60 * 1000);

const getSafeUser = (user: {
  passwordHash: string; id: string; name: string;
  email: string; role: string; createdAt: Date; phone?: string | null; isVerified: boolean;
}) => {
  const { passwordHash: _pw, ...safe } = user;
  return safe;
};

const storeRefreshToken = async (userId: string, refreshToken: string) => {
  await prisma.refreshToken.deleteMany({ where: { userId } });
  await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash:        hashRefreshToken(refreshToken),
      expiresAt:        getRefreshTokenExpiry(),
      sessionExpiresAt: getSessionExpiry(),
    },
  });
};

const generateOtp = (): string => String(crypto.randomInt(100000, 999999));

// ─── Register ─────────────────────────────────────────────────────────────────

export const registerUser = async (data: RegisterUserInput) => {
  const existing = await prisma.user.findUnique({ where: { email: data.email } });
  if (existing) {
    // If already registered but not verified, resend OTP instead of erroring
    if (!existing.isVerified) {
      await sendRegistrationOtp(existing.id, existing.email, existing.name);
      return { needsVerification: true as const, email: existing.email };
    }
    throw new AppError("Email already exists", 409, "EMAIL_ALREADY_EXISTS");
  }

  const passwordHash = await bcrypt.hash(data.password, SALT_ROUNDS);
  const user = await prisma.user.create({
    data: { name: data.name, email: data.email, passwordHash, isVerified: false },
  });

  await sendRegistrationOtp(user.id, user.email, user.name);

  return { needsVerification: true as const, email: user.email };
};

/** Generate OTP, persist it, and email it to the user. */
const sendRegistrationOtp = async (userId: string, email: string, name: string) => {
  // Rate-limit: block if a VERIFY OTP was sent within the last 60 seconds
  const recentOtp = await prisma.otpCode.findFirst({
    where: {
      userId,
      target: email,
      used: false,
      type: "VERIFY",
      createdAt: { gt: new Date(Date.now() - RESEND_COOLDOWN_SECONDS * 1000) },
    },
  });
  if (recentOtp) {
    const waitSeconds = RESEND_COOLDOWN_SECONDS - Math.floor((Date.now() - recentOtp.createdAt.getTime()) / 1000);
    throw new AppError(
      `Please wait ${waitSeconds}s before requesting another code`,
      429,
      "OTP_TOO_SOON",
    );
  }

  // Invalidate old VERIFY OTPs for this user
  await prisma.otpCode.updateMany({
    where: { userId, type: "VERIFY", used: false },
    data: { used: true },
  });

  const code = generateOtp();
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

  await prisma.otpCode.create({
    data: { userId, code, target: email, type: "VERIFY", expiresAt },
  });

  await sendVerificationEmail(email, name, code, OTP_EXPIRY_MINUTES);
};

// ─── Verify Registration Email ────────────────────────────────────────────────

export const verifyRegistrationEmail = async (email: string, code: string) => {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new AppError("No account found for this address", 404, "USER_NOT_FOUND");
  if (user.isVerified) throw new AppError("Email is already verified. Please sign in.", 400, "ALREADY_VERIFIED");

  const otpRecord = await prisma.otpCode.findFirst({
    where: { userId: user.id, target: email, used: false, type: "VERIFY" },
    orderBy: { createdAt: "desc" },
  });

  if (!otpRecord) {
    throw new AppError("No active verification code found. Please request a new one.", 400, "OTP_NOT_FOUND");
  }

  await prisma.otpCode.update({
    where: { id: otpRecord.id },
    data: { attempts: { increment: 1 } },
  });

  if (otpRecord.attempts + 1 > MAX_ATTEMPTS) {
    await prisma.otpCode.update({ where: { id: otpRecord.id }, data: { used: true } });
    throw new AppError("Too many incorrect attempts. Request a new code.", 429, "OTP_MAX_ATTEMPTS");
  }

  if (otpRecord.expiresAt < new Date()) {
    await prisma.otpCode.update({ where: { id: otpRecord.id }, data: { used: true } });
    throw new AppError("Verification code has expired. Please request a new one.", 400, "OTP_EXPIRED");
  }

  if (otpRecord.code !== code.trim()) {
    throw new AppError("Invalid verification code", 400, "OTP_INVALID");
  }

  await prisma.otpCode.update({ where: { id: otpRecord.id }, data: { used: true } });

  const verifiedUser = await prisma.user.update({
    where: { id: user.id },
    data: { isVerified: true },
  });

  const accessToken  = generateAccessToken(verifiedUser);
  const refreshToken = generateRefreshToken();
  await storeRefreshToken(verifiedUser.id, refreshToken);

  return { user: getSafeUser(verifiedUser), accessToken, refreshToken };
};

// ─── Resend Verification OTP ──────────────────────────────────────────────────

export const resendVerificationOtp = async (email: string) => {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new AppError("No account found for this address", 404, "USER_NOT_FOUND");
  if (user.isVerified) throw new AppError("Email is already verified. Please sign in.", 400, "ALREADY_VERIFIED");

  await sendRegistrationOtp(user.id, user.email, user.name);
  return { message: `Verification code sent to ${email}`, expiresInMinutes: OTP_EXPIRY_MINUTES };
};

// ─── Password Login ───────────────────────────────────────────────────────────

export const loginUser = async (data: LoginUserInput) => {
  const user = await prisma.user.findUnique({ where: { email: data.email } });
  if (!user) throw new AppError("Invalid credentials", 401, "INVALID_CREDENTIALS");

  if (!user.passwordHash) {
    throw new AppError("This account uses OTP login. Please use OTP.", 400, "USE_OTP_LOGIN");
  }

  const valid = await bcrypt.compare(data.password, user.passwordHash);
  if (!valid) throw new AppError("Invalid credentials", 401, "INVALID_CREDENTIALS");

  if (!user.isVerified) {
    throw new AppError(
      "Please verify your email before signing in. Check your inbox for the verification code.",
      403,
      "EMAIL_NOT_VERIFIED",
    );
  }

  const accessToken  = generateAccessToken(user);
  const refreshToken = generateRefreshToken();
  await storeRefreshToken(user.id, refreshToken);

  return { user: getSafeUser(user), accessToken, refreshToken };
};

// ─── OTP Login ────────────────────────────────────────────────────────────────

export const otpLoginUser = async (target: string, code: string) => {
  const user = await verifyOtp(target, code);

  const accessToken  = generateAccessToken(user);
  const refreshToken = generateRefreshToken();
  await storeRefreshToken(user.id, refreshToken);

  return { user: getSafeUser(user), accessToken, refreshToken };
};

// ─── Refresh ──────────────────────────────────────────────────────────────────

export const refreshAccessToken = async (token: string) => {
  const tokenHash = hashRefreshToken(token);
  const stored = await prisma.refreshToken.findFirst({
    where: { tokenHash },
    include: { user: true },
  });

  if (!stored) throw new AppError("Invalid refresh token", 401, "INVALID_REFRESH_TOKEN");

  const now = new Date();
  if (stored.expiresAt < now || stored.sessionExpiresAt < now) {
    await prisma.refreshToken.delete({ where: { id: stored.id } });
    throw new AppError("Session expired. Please log in again.", 401, "SESSION_EXPIRED");
  }

  await prisma.refreshToken.delete({ where: { id: stored.id } });

  const newRefreshToken = generateRefreshToken();
  await prisma.refreshToken.create({
    data: {
      userId: stored.userId,
      tokenHash: hashRefreshToken(newRefreshToken),
      expiresAt: getRefreshTokenExpiry(),
      sessionExpiresAt: stored.sessionExpiresAt,
    },
  });

  return {
    accessToken: generateAccessToken(stored.user),
    refreshToken: newRefreshToken,
  };
};

// ─── Logout ───────────────────────────────────────────────────────────────────

export const logoutUser = async (token: string) => {
  const tokenHash = hashRefreshToken(token);
  const stored = await prisma.refreshToken.findFirst({ where: { tokenHash } });
  if (!stored) throw new AppError("Invalid refresh token", 401, "INVALID_REFRESH_TOKEN");
  await prisma.refreshToken.delete({ where: { id: stored.id } });
};

// ─── Me ───────────────────────────────────────────────────────────────────────

export const getMe = async (userId: string) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError("User not found", 404, "USER_NOT_FOUND");
  return getSafeUser(user);
};
