import api from "./axios";
import type {
  AdminUserDetail,
  ApiSuccessResponse,
  Genre,
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

export const getGenres = async () => {
  const response = await api.get<ApiSuccessResponse<Genre[]>>("/genres");

  return response.data;
};

export const createGenre = async (name: string) => {
  const response = await api.post<ApiSuccessResponse<Genre>>("/admin/genres", {
    name,
  });

  return response.data;
};

export const deleteGenre = async (id: string) => {
  const response = await api.delete(`/admin/genres/${id}`);

  return response.data;
};
