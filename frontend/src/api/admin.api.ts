import api from "./axios";
import type {
  AdminUserDetail,
  ApiSuccessResponse,
  Order,
  OrderStatus,
  PaginatedOrders,
  PaginatedUsers,
} from "../types";

export const getAdminOrders = async (
  page?: number,
  limit?: number,
  status?: OrderStatus,
) => {
  const response = await api.get<ApiSuccessResponse<PaginatedOrders>>(
    "/admin/orders",
    {
      params: {
        page,
        limit,
        status,
      },
    },
  );

  return response.data;
};

export const getAdminOrder = async (id: string) => {
  const response = await api.get<ApiSuccessResponse<Order>>(
    `/admin/orders/${id}`,
  );

  return response.data;
};

export const updateOrderStatus = async (id: string, status: OrderStatus) => {
  const response = await api.patch<ApiSuccessResponse<Order>>(
    `/admin/orders/${id}/status`,
    { status },
  );

  return response.data;
};

export const deleteAdminOrder = async (id: string) => {
  const response = await api.delete(`/admin/orders/${id}`);
  return response.data;
};

export const resendOrderInvoice = async (id: string) => {
  const response = await api.post(`/admin/orders/${id}/resend-invoice`);
  return response.data;
};

export const resendPrintInvoice = async (id: string) => {
  const response = await api.post(`/admin/print/${id}/resend-invoice`);
  return response.data;
};

export const testShiprocketAuth = async (): Promise<{ success: boolean; message: string }> => {
  const response = await api.post<{ success: boolean; message: string }>("/admin/shiprocket/test-auth");
  return response.data;
};

export type PickupLocation = { id: number; name: string; city: string; state: string; pincode: string };

export const getShiprocketPickupLocations = async (): Promise<{ success: boolean; data: PickupLocation[] }> => {
  const response = await api.get<{ success: boolean; data: PickupLocation[] }>("/admin/shiprocket/pickup-locations");
  return response.data;
};

export const getUsers = async (
  page?: number,
  limit?: number,
  search?: string,
) => {
  const response = await api.get<ApiSuccessResponse<PaginatedUsers>>(
    "/admin/users",
    {
      params: {
        page,
        limit,
        search,
      },
    },
  );

  return response.data;
};

export const getUser = async (id: string) => {
  const response = await api.get<ApiSuccessResponse<AdminUserDetail>>(
    `/admin/users/${id}`,
  );
  return response.data;
};

export const deleteUser = async (id: string) => {
  const response = await api.delete(`/admin/users/${id}`);

  return response.data;
};

export const updateUserRole = async (id: string, role: "USER" | "ADMIN") => {
  const response = await api.patch<ApiSuccessResponse<AdminUserDetail>>(
    `/admin/users/${id}/role`,
    { role },
  );

  return response.data;
};

