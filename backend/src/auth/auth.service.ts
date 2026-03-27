import bcrypt from "bcryptjs";
import crypto from "crypto";
import jwt, { type Secret, type SignOptions } from "jsonwebtoken";

import env from "../config/env";
import AppError from "../lib/AppError";
import prisma from "../lib/prisma";

type RegisterUserInput = {
  name: string;
  email: string;
  password: string;
};

type LoginUserInput = {
  email: string;
  password: string;
};

const ACCESS_TOKEN_EXPIRES_IN = env.JWT_ACCESS_EXPIRES_IN as SignOptions["expiresIn"];
const REFRESH_TOKEN_TTL_IN_DAYS = 7;
const SALT_ROUNDS = 12;
const JWT_ACCESS_SECRET: Secret = env.JWT_ACCESS_SECRET;

const generateAccessToken = (user: {
  id: string;
  email: string;
  role: string;
}) =>
  jwt.sign(
    {
      sub: user.id,
      email: user.email,
      role: user.role,
    },
    JWT_ACCESS_SECRET,
    {
      expiresIn: ACCESS_TOKEN_EXPIRES_IN,
    },
  );

const generateRefreshToken = () => crypto.randomBytes(40).toString("hex");

const hashRefreshToken = (token: string) =>
  crypto.createHash("sha256").update(token).digest("hex");

const getRefreshTokenExpiry = () => {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_TTL_IN_DAYS);
  return expiresAt;
};

const getSafeUser = (user: {
  passwordHash: string;
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: Date;
}) => {
  const { passwordHash: _passwordHash, ...safeUser } = user;
  return safeUser;
};

const storeRefreshToken = async (userId: string, refreshToken: string) => {
  await prisma.refreshToken.deleteMany({
    where: {
      userId,
    },
  });

  await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash: hashRefreshToken(refreshToken),
      expiresAt: getRefreshTokenExpiry(),
    },
  });
};

export const registerUser = async (data: RegisterUserInput) => {
  const existingUser = await prisma.user.findUnique({
    where: {
      email: data.email,
    },
  });

  if (existingUser) {
    throw new AppError(
      "Email already exists",
      409,
      "EMAIL_ALREADY_EXISTS",
    );
  }

  const passwordHash = await bcrypt.hash(data.password, SALT_ROUNDS);

  const user = await prisma.user.create({
    data: {
      name: data.name,
      email: data.email,
      passwordHash,
    },
  });

  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken();

  await storeRefreshToken(user.id, refreshToken);

  return {
    user: getSafeUser(user),
    accessToken,
    refreshToken,
  };
};

export const loginUser = async (data: LoginUserInput) => {
  const user = await prisma.user.findUnique({
    where: {
      email: data.email,
    },
  });

  if (!user) {
    throw new AppError("Invalid credentials", 401, "INVALID_CREDENTIALS");
  }

  const isPasswordValid = await bcrypt.compare(data.password, user.passwordHash);

  if (!isPasswordValid) {
    throw new AppError("Invalid credentials", 401, "INVALID_CREDENTIALS");
  }

  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken();

  await storeRefreshToken(user.id, refreshToken);

  return {
    user: getSafeUser(user),
    accessToken,
    refreshToken,
  };
};

export const refreshAccessToken = async (token: string) => {
  const tokenHash = hashRefreshToken(token);

  const storedToken = await prisma.refreshToken.findFirst({
    where: {
      tokenHash,
    },
    include: {
      user: true,
    },
  });

  if (!storedToken) {
    throw new AppError("Invalid refresh token", 401, "INVALID_REFRESH_TOKEN");
  }

  if (storedToken.expiresAt < new Date()) {
    await prisma.refreshToken.delete({
      where: {
        id: storedToken.id,
      },
    });
    throw new AppError("Invalid refresh token", 401, "INVALID_REFRESH_TOKEN");
  }

  await prisma.refreshToken.delete({
    where: {
      id: storedToken.id,
    },
  });

  const newRefreshToken = generateRefreshToken();
  await storeRefreshToken(storedToken.userId, newRefreshToken);

  return {
    accessToken: generateAccessToken(storedToken.user),
    refreshToken: newRefreshToken,
  };
};

export const logoutUser = async (token: string) => {
  const tokenHash = hashRefreshToken(token);

  const storedToken = await prisma.refreshToken.findFirst({
    where: {
      tokenHash,
    },
  });

  if (!storedToken) {
    throw new AppError("Invalid refresh token", 401, "INVALID_REFRESH_TOKEN");
  }

  await prisma.refreshToken.delete({
    where: {
      id: storedToken.id,
    },
  });
};

export const getMe = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: {
      id: userId,
    },
  });

  if (!user) {
    throw new AppError("User not found", 404, "USER_NOT_FOUND");
  }

  return getSafeUser(user);
};
