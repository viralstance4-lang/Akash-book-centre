import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AxiosError } from "axios";
import { Search, Trash2 } from "lucide-react";
import { useState } from "react";

import { deleteUser, getUser, getUsers } from "../../api/admin.api";
import type { ApiErrorResponse } from "../../types";

const formatPrice = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);

export default function AdminUsersPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-users", page, search],
    queryFn: () => getUsers(page, 10, search || undefined),
  });

  const { data: detailData } = useQuery({
    queryKey: ["admin-user", selectedUserId],
    queryFn: () => getUser(selectedUserId!),
    enabled: Boolean(selectedUserId),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteUser(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-user"] });
      setSelectedUserId(null);
      setError("");
    },
    onError: (mutationError) => {
      const apiError = mutationError as AxiosError<ApiErrorResponse>;
      setError(apiError.response?.data?.message ?? "Unable to delete this user.");
    },
  });

  const users = data?.data.users ?? [];
  const totalPages = data?.data.totalPages ?? 1;
  const selectedUser = detailData?.data;

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_22rem]">
      <section className="rounded-[1.75rem] border border-black/8 bg-[#fbf8f2] p-5">
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
          <input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Search users by name or email"
            className="h-12 w-full rounded-2xl border border-black/10 bg-white pl-11 pr-4 text-sm outline-none transition-all focus:border-black/20 focus:shadow-sm"
          />
        </div>

        <div className="mt-5 space-y-4">
          {isLoading ? (
            Array.from({ length: 5 }).map((_, index) => (
              <div
                key={index}
                className="h-20 animate-pulse rounded-[1.25rem] bg-white"
              />
            ))
          ) : (
            users.map((user) => (
              <button
                key={user.id}
                type="button"
                onClick={() => {
                  setSelectedUserId(user.id);
                  setError("");
                }}
                className="grid w-full gap-3 rounded-[1.25rem] border border-black/8 bg-white p-4 text-left transition-all hover:-translate-y-0.5 hover:border-black/15 md:grid-cols-[minmax(0,1fr)_auto]"
              >
                <div>
                  <p className="font-serif text-2xl text-text-primary">
                    {user.name}
                  </p>
                  <p className="mt-1 text-sm text-text-muted">{user.email}</p>
                </div>
                <div className="md:text-right">
                  <p className="text-sm text-text-primary">{user.role}</p>
                </div>
              </button>
            ))
          )}
        </div>

        <div className="mt-5 flex items-center justify-between border-t border-black/8 pt-5">
          <p className="text-sm text-text-muted">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={page <= 1}
              className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm disabled:opacity-45"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() =>
                setPage((current) => Math.min(totalPages, current + 1))
              }
              disabled={page >= totalPages}
              className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm disabled:opacity-45"
            >
              Next
            </button>
          </div>
        </div>
      </section>

      <aside className="h-fit rounded-[1.75rem] border border-black/8 bg-[#fbf8f2] p-6">
        {selectedUser ? (
          <>
            <p className="text-[0.68rem] uppercase tracking-[0.22em] text-text-muted">
              User details
            </p>
            <h2 className="mt-2 font-serif text-3xl text-text-primary">
              {selectedUser.name}
            </h2>
            <p className="mt-2 text-sm text-text-muted">{selectedUser.email}</p>
            <div className="mt-5 space-y-3 rounded-[1.1rem] bg-white p-4 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-text-muted">Role</span>
                <span>{selectedUser.role}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-text-muted">Orders</span>
                <span>{selectedUser.orderCount}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-text-muted">Total spend</span>
                <span>{formatPrice(selectedUser.totalSpend)}</span>
              </div>
            </div>

            {error ? (
              <div className="mt-4 rounded-2xl border border-[#8f2d22]/15 bg-[#f8ece8] px-4 py-3 text-sm text-[#8f2d22]">
                {error}
              </div>
            ) : null}

            <button
              type="button"
              onClick={() => {
                const shouldDelete = window.confirm(
                  `Delete ${selectedUser.name}'s account?`,
                );

                if (!shouldDelete) {
                  return;
                }

                setError("");
                deleteMutation.mutate(selectedUser.id);
              }}
              disabled={deleteMutation.isPending}
              className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#8f2d22] px-4 py-3 text-sm text-white disabled:opacity-60"
            >
              <Trash2 size={15} />
              {deleteMutation.isPending ? "Deleting..." : "Delete user"}
            </button>
          </>
        ) : (
          <div className="text-sm text-text-muted">
            Select a user to inspect order activity or remove the account.
          </div>
        )}
      </aside>
    </div>
  );
}
