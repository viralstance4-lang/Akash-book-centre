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
  isVerified: boolean;
  createdAt: string;
};

export type CategoryRef = {
  id: string;
  name: string;
  slug: string;
  imageUrl?: string | null;
};

export type SubcategoryRef = {
  id: string;
  categoryId: string;
  name: string;
  slug: string;
};

export type BookCategoryRef = { category: CategoryRef };
export type BookSubcategoryRef = { subcategory: SubcategoryRef };

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
  categoryId?: string | null;
  subcategoryId?: string | null;
  stock: number;
  language?: string;
  publication?: string | null;
  isPrintBook?: boolean;
  allowStapleBinding?: boolean;
  allowSpiralBinding?: boolean;
  isOutOfStock?: boolean;
  height?: number | null;
  length?: number | null;
  breadth?: number | null;
  weight?: number | null;
  isFeatured?: boolean;
  createdAt: string;
  updatedAt: string;
  // Legacy single-FK relations (kept for backward compat)
  category?: CategoryRef | null;
  subcategory?: SubcategoryRef | null;
  // Many-to-many relations
  bookCategories?: BookCategoryRef[];
  bookSubcategories?: BookSubcategoryRef[];
  images?: Array<{ id: string; imageUrl: string; publicId: string; order: number }>;
};

export type CartItem = {
  id: string;
  cartId: string;
  bookId: string;
  quantity: number;
  bindingType: "NONE" | "SPIRAL" | "STAPLE";
  book: Pick<Book, "id" | "title" | "author" | "price" | "coverImageUrl" | "stock" | "isPrintBook">;
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
  deliveryCharge: number;
  discountAmount: number;
  finalAmount: number;
  couponCode?: string | null;
  shippingAddress: ShippingAddress;
  paymentMethod: PaymentMethod;
  customerEmail?: string | null;
  deliveryType?: "FREE" | "PAID" | null;
  deliveryDistance?: number | null;
  // ── Shipmozo fields ────────────────────────────────────────────────────────
  shipmozoOrderId?:     string | null;
  shipmozoReferenceId?: string | null;
  awbCode?:             string | null;
  courierName?:         string | null;
  trackingUrl?:         string | null;
  labelUrl?:            string | null;
  invoiceUrl?:          string | null;
  manifestUrl?:         string | null;
  shipmozoStatus?:      string | null;
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

export type PaginatedBooks = PaginatedResponse<never> & { books: Book[] };
export type PaginatedOrders = PaginatedResponse<never> & { orders: Order[] };
export type PaginatedUsers  = PaginatedResponse<never> & { users: User[] };

export type ApiSuccessResponse<T> = {
  success: true;
  message: string;
  data: T;
};

export type ApiErrorResponse = {
  success: false;
  message: string;
  code: string;
  errors?: Array<{ field: string; message: string }>;
};

export type AdminUserDetail = User & {
  orderCount: number;
  totalSpend: number;
};
