import { Prisma } from "@prisma/client";
import AppError from "../../lib/AppError";
import prisma from "../../lib/prisma";

const getOrderWithDetails = async (orderId: string) =>
  prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: { include: { book: { select: { id: true, title: true, author: true, coverImageUrl: true } } } },
      payment: true,
      user: true,
    },
  });

export const createReturnRequest = async (orderId: string, userId: string, email: string, reason?: string) => {
  // Find the order
  const order = await getOrderWithDetails(orderId);

  if (!order) throw new AppError("Order not found", 404, "ORDER_NOT_FOUND");

  // Verify order belongs to user
  if (order.userId !== userId) {
    throw new AppError("You don't have permission to return this order", 403, "PERMISSION_DENIED");
  }

  // Verify that the supplied email matches the account's registered email
  if (order.user.email.toLowerCase() !== email.trim().toLowerCase()) {
    throw new AppError("Email does not match the registered email for this account", 400, "EMAIL_MISMATCH");
  }

  // Only delivered orders can be returned
  if (order.status !== "DELIVERED") {
    throw new AppError("Only delivered orders can be returned", 400, "INVALID_ORDER_STATUS");
  }

  // Check if return request already exists for this order
  const existingReturn = await prisma.return.findFirst({
    where: { orderId },
  });

  if (existingReturn) {
    throw new AppError("Return request already exists for this order", 400, "RETURN_ALREADY_EXISTS");
  }

  // Create return request
  const returnRequest = await prisma.$transaction(async (tx) => {
    const newReturn = await tx.return.create({
      data: {
        orderId,
        userId,
        email,
        reason,
        status: "VERIFYING",
      },
      include: {
        order: { include: { items: { include: { book: { select: { title: true, author: true } } } } } },
        user: true,
      },
    });

    // Update order status to RETURN_REQUESTED
    await tx.order.update({
      where: { id: orderId },
      data: { status: "RETURN_REQUESTED" },
    });

    return newReturn;
  });

  return returnRequest;
};

export const getUserReturns = async (userId: string, page: number = 1, limit: number = 10) => {
  const skip = (page - 1) * limit;

  const [returns, total] = await Promise.all([
    prisma.return.findMany({
      where: { userId },
      include: {
        order: { include: { items: { include: { book: { select: { title: true, author: true, coverImageUrl: true } } } } } },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.return.count({ where: { userId } }),
  ]);

  return {
    returns,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
};

export const getAdminReturns = async (page: number = 1, limit: number = 10, status?: string) => {
  const skip = (page - 1) * limit;

  const where: Prisma.ReturnWhereInput = status ? { status: status as any } : {};

  const [returns, total] = await Promise.all([
    prisma.return.findMany({
      where,
      include: {
        order: { include: { items: { include: { book: { select: { title: true, author: true } } } } } },
        user: { select: { id: true, name: true, email: true, phone: true } },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.return.count({ where }),
  ]);

  return {
    returns,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
};

export const updateReturnStatus = async (returnId: string, status: "VERIFYING" | "APPROVED" | "REJECTED" | "COMPLETED") => {
  const returnRequest = await prisma.return.findUnique({ where: { id: returnId } });

  if (!returnRequest) throw new AppError("Return request not found", 404, "RETURN_NOT_FOUND");

  const updatedReturn = await prisma.$transaction(async (tx) => {
    const updated = await tx.return.update({
      where: { id: returnId },
      data: { status },
      include: {
        order: { include: { items: { include: { book: { select: { title: true, author: true } } } } } },
        user: true,
      },
    });

    // If return is completed, update order status
    if (status === "COMPLETED") {
      await tx.order.update({
        where: { id: returnRequest.orderId },
        data: { status: "RETURNED" },
      });
    }

    return updated;
  });

  return updatedReturn;
};

export const getReturnById = async (returnId: string) => {
  const returnRequest = await prisma.return.findUnique({
    where: { id: returnId },
    include: {
      order: {
        include: {
          items: { include: { book: { select: { id: true, title: true, author: true, coverImageUrl: true, price: true } } } },
          payment: true,
          user: true,
        },
      },
      user: true,
    },
  });

  if (!returnRequest) throw new AppError("Return request not found", 404, "RETURN_NOT_FOUND");

  return returnRequest;
};
