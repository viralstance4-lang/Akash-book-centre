import AppError from "../../lib/AppError";
import prisma from "../../lib/prisma";

const cartInclude = {
  items: {
    include: {
      book: {
        select: {
          id: true,
          title: true,
          author: true,
          price: true,
          coverImageUrl: true,
          stock: true,
        },
      },
    },
    orderBy: {
      id: "asc",
    },
  },
} as const;

const getCartOrThrow = async (userId: string) => {
  const cart = await prisma.cart.findUnique({
    where: {
      userId,
    },
    include: cartInclude,
  });

  if (!cart) {
    throw new AppError("Cart not found", 404, "CART_NOT_FOUND");
  }

  return cart;
};

const getBookOrThrow = async (bookId: string) => {
  const book = await prisma.book.findUnique({
    where: {
      id: bookId,
    },
  });

  if (!book) {
    throw new AppError("Book not found", 404, "BOOK_NOT_FOUND");
  }

  return book;
};

const ensureValidQuantity = (quantity: number) => {
  if (!Number.isInteger(quantity) || quantity < 1) {
    throw new AppError("Quantity must be at least 1", 400, "INVALID_QUANTITY");
  }
};

export const getOrCreateCart = async (userId: string) => {
  const existingCart = await prisma.cart.findUnique({
    where: {
      userId,
    },
    include: cartInclude,
  });

  if (existingCart) {
    return existingCart;
  }

  return prisma.cart.create({
    data: {
      userId,
    },
    include: cartInclude,
  });
};

export const addToCart = async (
  userId: string,
  bookId: string,
  quantity: number,
) => {
  ensureValidQuantity(quantity);

  const cart = await getOrCreateCart(userId);
  const book = await getBookOrThrow(bookId);

  const existingItem = await prisma.cartItem.findUnique({
    where: {
      cartId_bookId: {
        cartId: cart.id,
        bookId,
      },
    },
  });

  const nextQuantity = (existingItem?.quantity ?? 0) + quantity;

  if (book.stock < nextQuantity) {
    throw new AppError("Insufficient stock", 400, "INSUFFICIENT_STOCK");
  }

  await prisma.cartItem.upsert({
    where: {
      cartId_bookId: {
        cartId: cart.id,
        bookId,
      },
    },
    create: {
      cartId: cart.id,
      bookId,
      quantity,
    },
    update: {
      quantity: nextQuantity,
    },
  });

  return getOrCreateCart(userId);
};

export const updateCartItem = async (
  userId: string,
  bookId: string,
  quantity: number,
) => {
  ensureValidQuantity(quantity);

  const cart = await getCartOrThrow(userId);
  const cartItem = await prisma.cartItem.findUnique({
    where: {
      cartId_bookId: {
        cartId: cart.id,
        bookId,
      },
    },
  });

  if (!cartItem) {
    throw new AppError("Cart item not found", 404, "CART_ITEM_NOT_FOUND");
  }

  const book = await getBookOrThrow(bookId);

  if (quantity > book.stock) {
    throw new AppError("Insufficient stock", 400, "INSUFFICIENT_STOCK");
  }

  await prisma.cartItem.update({
    where: {
      cartId_bookId: {
        cartId: cart.id,
        bookId,
      },
    },
    data: {
      quantity,
    },
  });

  return getOrCreateCart(userId);
};

export const removeCartItem = async (userId: string, bookId: string) => {
  const cart = await getCartOrThrow(userId);
  const cartItem = await prisma.cartItem.findUnique({
    where: {
      cartId_bookId: {
        cartId: cart.id,
        bookId,
      },
    },
  });

  if (!cartItem) {
    throw new AppError("Cart item not found", 404, "CART_ITEM_NOT_FOUND");
  }

  await prisma.cartItem.delete({
    where: {
      cartId_bookId: {
        cartId: cart.id,
        bookId,
      },
    },
  });

  return getOrCreateCart(userId);
};

export const clearCart = async (userId: string) => {
  const cart = await getOrCreateCart(userId);

  await prisma.cartItem.deleteMany({
    where: {
      cartId: cart.id,
    },
  });

  return getOrCreateCart(userId);
};
