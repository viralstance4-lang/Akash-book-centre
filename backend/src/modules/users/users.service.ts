import prisma from "../../lib/prisma";
import AppError from "../../lib/AppError";

export const getUsers = async (page: number, limit: number, search?: string) => {
  const where = search
    ? {
        OR: [
          {
            name: {
              contains: search,
              mode: "insensitive" as const,
            },
          },
          {
            email: {
              contains: search,
              mode: "insensitive" as const,
            },
          },
        ],
      }
    : {};

  const [users, total] = await prisma.$transaction([
    prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: "desc",
      },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.user.count({ where }),
  ]);

  return {
    users,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
};

export const getUserById = async (id: string) => {
  const user = await prisma.user.findUnique({
    where: {
      id,
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
      _count: {
        select: {
          orders: true,
        },
      },
      orders: {
        select: {
          totalAmount: true,
        },
      },
    },
  });

  if (!user) {
    throw new AppError("User not found", 404, "USER_NOT_FOUND");
  }

  const totalSpend = user.orders.reduce(
    (sum, order) => sum + Number(order.totalAmount),
    0,
  );

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt,
    orderCount: user._count.orders,
    totalSpend,
  };
};

export const deleteUser = async (id: string, requestingAdminId: string) => {
  if (id === requestingAdminId) {
    throw new AppError("You cannot delete yourself", 400, "CANNOT_DELETE_SELF");
  }

  const user = await prisma.user.findUnique({
    where: {
      id,
    },
    include: {
      _count: {
        select: {
          orders: true,
        },
      },
    },
  });

  if (!user) {
    throw new AppError("User not found", 404, "USER_NOT_FOUND");
  }

  if (user._count.orders > 0) {
    throw new AppError(
      "Cannot delete user with orders",
      400,
      "USER_HAS_ORDERS",
    );
  }

  await prisma.$transaction([
    prisma.refreshToken.deleteMany({
      where: {
        userId: id,
      },
    }),
    prisma.user.delete({
      where: {
        id,
      },
    }),
  ]);
};
