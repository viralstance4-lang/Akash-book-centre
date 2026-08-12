import { useCallback, useState } from "react";
import type { AxiosError } from "axios";
import type { ApiErrorResponse } from "../../types";

type ToastState = { ok: boolean; message: string } | null;

export function getErrorMessage(e: unknown, fallback: string): string {
  const ae = e as AxiosError<ApiErrorResponse>;
  return ae.response?.data?.message ?? fallback;
}

export function useToast() {
  const [toast, setToast] = useState<ToastState>(null);

  const showToast = useCallback((ok: boolean, message: string) => {
    setToast({ ok, message });
    window.setTimeout(() => setToast(null), 3500);
  }, []);

  return { toast, showToast };
}

export function ToastViewport({ toast }: { toast: ToastState }) {
  if (!toast) return null;
  return (
    <div
      className={`fixed top-4 right-4 z-50 max-w-sm rounded-xl border px-5 py-3 text-sm font-medium shadow-lg ${
        toast.ok
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-red-200 bg-red-50 text-red-700"
      }`}
    >
      {toast.message}
    </div>
  );
}
