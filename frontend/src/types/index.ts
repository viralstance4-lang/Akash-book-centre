export type Role = "USER" | "ADMIN";

export type OrderStatus =
  | "PENDING"
  | "CONFIRMED"
  | "SHIPPED"
  | "DELIVERED"
  | "CANCELLED"
  | "RETURN_REQUESTED"
  | "RETURNED";

export type PaymentStatus = "PENDING" | "SUCCESS" | "FAILED";

export type PaymentMethod = "ONLINE" | "COD";

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
  comparePrice?: number | null;
  coverImageUrl: string;
  coverPublicId: string;
  genreId: string;
  stock: number;
  language?: string;
  publication?: string | null;
  isFeatured?: boolean;
  createdAt: string;
  updatedAt: string;
  genre?: Genre;
};

export type CartItem = {
  id: string;
  cartId: string;
  bookId: string;
  quantity: number;
  bindingType: "NONE" | "SPIRAL" | "STAPLE";
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
  bindingType: "NONE" | "SPIRAL" | "STAPLE";
  bindingExtra: number;
  book: Pick<Book, "id" | "title" | "author" | "coverImageUrl" | "stock">;
};

export type Payment = {
  id: string;
  orderId: string;
  razorpayOrderId: string | null;
  razorpayPaymentId?: string | null;
  razorpaySignature?: string | null;
  status: PaymentStatus;
  amount: number;
  method: PaymentMethod;
  createdAt: string;
};

export type Order = {
  id: string;
  userId: string;
  status: OrderStatus;
  totalAmount: number;
  discountAmount?: number | null;
  couponCode?: string | null;
  shippingAddress: ShippingAddress;
  paymentMethod: PaymentMethod;
  customerEmail?: string | null;
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
