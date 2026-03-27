export type Role = "USER" | "ADMIN";

export type OrderStatus =
  | "PENDING"
  | "CONFIRMED"
  | "SHIPPED"
  | "DELIVERED"
  | "CANCELLED";

export type PaymentStatus = "PENDING" | "SUCCESS" | "FAILED";

export type User = {
  id: string;
  name: string;
  email: string;
  role: Role;
  createdAt: string;
};

export type Genre = {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
};

export type Book = {
  id: string;
  title: string;
  author: string;
  isbn: string;
  description?: string | null;
  price: number;
  coverImageUrl: string;
  coverPublicId: string;
  genreId: string;
  stock: number;
  createdAt: string;
  updatedAt: string;
  genre?: Genre;
};

export type CartItem = {
  id: string;
  cartId: string;
  bookId: string;
  quantity: number;
  book: Pick<
    Book,
    "id" | "title" | "author" | "price" | "coverImageUrl" | "stock"
  >;
};

export type Cart = {
  id: string;
  userId: string;
  createdAt: string;
  items: CartItem[];
};

export type ShippingAddress = {
  name: string;
  phone: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  pincode: string;
};

export type OrderItem = {
  id: string;
  orderId: string;
  bookId: string;
  quantity: number;
  priceAtPurchase: number;
  book: Pick<Book, "id" | "title" | "author" | "coverImageUrl" | "stock">;
};

export type Payment = {
  id: string;
  orderId: string;
  razorpayOrderId: string;
  razorpayPaymentId?: string | null;
  razorpaySignature?: string | null;
  status: PaymentStatus;
  amount: number;
  createdAt: string;
};

export type Order = {
  id: string;
  userId: string;
  status: OrderStatus;
  totalAmount: number;
  shippingAddress: ShippingAddress;
  createdAt: string;
  updatedAt: string;
  items: OrderItem[];
  payment?: Payment | null;
  user?: User;
  razorpayOrderId?: string;
  itemCount?: number;
  paymentStatus?: PaymentStatus;
};

export type PaginatedResponse<T> = {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  data?: T;
};

export type PaginatedBooks = PaginatedResponse<never> & {
  books: Book[];
};

export type PaginatedOrders = PaginatedResponse<never> & {
  orders: Order[];
};

export type PaginatedUsers = PaginatedResponse<never> & {
  users: User[];
};

export type ApiSuccessResponse<T> = {
  success: true;
  message: string;
  data: T;
};

export type ApiErrorResponse = {
  success: false;
  message: string;
  code: string;
  errors?: Array<{
    field: string;
    message: string;
  }>;
};

export type AdminUserDetail = User & {
  orderCount: number;
  totalSpend: number;
};
