import { type RequestHandler } from "express";

import AppError from "../../lib/AppError";
import {
  deleteUser as deleteUserService,
  getUserById as getUserByIdService,
  getUsers as getUsersService,
  updateUserRole as updateUserRoleService,
} from "./users.service";

const getUserIdOrThrow = (userId?: string) => {
  if (!userId) {
    throw new AppError("Unauthorized", 401, "UNAUTHORIZED");
  }
  return userId;
};

export const getUsers: RequestHandler = async (req, res, next) => {
  try {
    const page = Number(req.query.page ?? 1);
    const limit = Number(req.query.limit ?? 10);
    const search =
      typeof req.query.search === "string" ? req.query.search : undefined;
    const users = await getUsersService(page, limit, search);
    res.status(200).json({ success: true, message: "Users fetched successfully", data: users });
  } catch (error) { next(error); }
};

export const getUser: RequestHandler<{ id: string }> = async (req, res, next) => {
  try {
    const user = await getUserByIdService(req.params.id);
    res.status(200).json({ success: true, message: "User fetched successfully", data: user });
  } catch (error) { next(error); }
};

export const updateUserRole: RequestHandler<{ id: string }> = async (req, res, next) => {
  try {
    const { role } = req.body;
    if (!["USER", "ADMIN"].includes(role)) {
      throw new AppError("Role must be USER or ADMIN", 400, "INVALID_ROLE");
    }
    const user = await updateUserRoleService(
      req.params.id,
      role as "USER" | "ADMIN",
      getUserIdOrThrow(req.user?.id),
    );
    res.status(200).json({ success: true, message: "User role updated successfully", data: user });
  } catch (error) { next(error); }
};

export const deleteUser: RequestHandler<{ id: string }> = async (req, res, next) => {
  try {
    await deleteUserService(req.params.id, getUserIdOrThrow(req.user?.id));
    res.status(204).send();
  } catch (error) { next(error); }
};
