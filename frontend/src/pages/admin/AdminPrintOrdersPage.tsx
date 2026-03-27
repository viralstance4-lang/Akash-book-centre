import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Settings, RefreshCw } from "lucide-react";
import { useState } from "react";
import { getAdminPrintOrders, updatePrintOrderStatus, updatePrintSettings, getPrintSettings } from "../../api/print.api";

const statusColors: Record<string, string> = {
  PENDING: "bg-amber-50 text-amber-700",
  PROCESSING: "bg-blue-50 text-blue-700",
  COMPLETED: "bg-emerald-50 text-emerald-700",
  CANCELLED: "bg-red-50 text-red-700",
};

const formatPrice = (v: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(v);

export default function AdminPrintOrdersPage() {
  const queryClient = useQueryClient();
  const [showSettings, setShowSettings] = useState(false);
  const [settingsForm, setSettingsForm] = useState({
    colorPrice: "5", bwPrice: "2", singleSideExtra: "1",
    bothSideDiscount: "0.5", spiralExtra: "30", staplerExtra: "10",
  });

  const { data: ordersData, isLoading } = useQuery({ queryKey: ["admin-print-orders"], queryFn: getAdminPrintOrders });
  const { data: settingsData } = useQuery({
    queryKey: ["print-settings-admin"],
    queryFn: getPrintSettings,
    onSuccess: (data: any) => {
      if (data?.data) {
        const s = data.data;
        setSettingsForm({ colorPrice: String(s.colorPrice), bwPrice: String(s.bwPrice), singleSideExtra: String(s.singleSideExtra), bothSideDiscount: String(s.bothSideDiscount), spiralExtra: String(s.spiralExtra), staplerExtra: String(s.staplerExtra) });
      }
    },
  } as any);

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => updatePrintOrderStatus(id, status),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["admin-print-orders"] }),
  });

  const updateSettingsMutation = useMutation({
    mutationFn: updatePrintSettings,
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ["print-settings"] }); setShowSettings(false); },
  });

  const orders = ordersData?.data ?? [];

  return (
    <div className="h-full overflow-y-auto space-y-5 pr-1">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[0.72rem] uppercase tracking-[0.28em] text-text-muted">Manage</p>
          <h2 className="font-serif text-2xl text-text-primary">Print Orders</h2>
        </div>
        <button type="button" onClick={() => setShowSettings(!showSettings)}
          className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-4 py-2.5 text-sm text-text-primary hover:-translate-y-0.5 hover:border-black/20 transition-all">
          <Settings size={15} /> Print Pricing
        </button>
      </div>

      {showSettings && (
        <div className="rounded-2xl border border-black/10 bg-white p-5">
          <h3 className="font-serif text-xl text-text-primary mb-4">Print Pricing Settings</h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { key: "colorPrice", label: "Color Price (₹/page)" },
              { key: "bwPrice", label: "B&W Price (₹/page)" },
              { key: "singleSideExtra", label: "Single Side Extra (₹/page)" },
              { key: "bothSideDiscount", label: "Both Side Discount (₹/page)" },
              { key: "spiralExtra", label: "Spiral Binding Extra (₹)" },
              { key: "staplerExtra", label: "Stapler Binding Extra (₹)" },
            ].map(({ key, label }) => (
              <div key={key}>
                <label className="mb-1.5 block text-xs uppercase tracking-widest text-text-muted">{label}</label>
                <input type="number" step="0.5" value={settingsForm[key as keyof typeof settingsForm]}
                  onChange={(e) => setSettingsForm(f => ({ ...f, [key]: e.target.value }))}
                  className="w-full rounded-xl border border-black/10 bg-[#f8f4ee] px-4 py-2.5 text-sm outline-none focus:bg-white" />
              </div>
            ))}
          </div>
          <div className="mt-5 flex justify-end gap-3">
            <button type="button" onClick={() => setShowSettings(false)} className="rounded-full border border-black/10 px-4 py-2 text-sm text-text-muted">Cancel</button>
            <button type="button" onClick={() => updateSettingsMutation.mutate({
              colorPrice: Number(settingsForm.colorPrice), bwPrice: Number(settingsForm.bwPrice),
              singleSideExtra: Number(settingsForm.singleSideExtra), bothSideDiscount: Number(settingsForm.bothSideDiscount),
              spiralExtra: Number(settingsForm.spiralExtra), staplerExtra: Number(settingsForm.staplerExtra),
            })} disabled={updateSettingsMutation.isPending}
              className="rounded-full bg-[#1d1a17] px-5 py-2 text-sm text-white hover:bg-black disabled:opacity-60">
              {updateSettingsMutation.isPending ? "Saving..." : "Save Settings"}
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-24 animate-pulse rounded-2xl bg-white" />)}</div>
      ) : orders.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-black/10 bg-white px-6 py-12 text-center">
          <p className="font-serif text-xl text-text-primary">No print orders yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => (
            <div key={order.id} className="rounded-2xl border border-black/8 bg-white p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-text-primary text-sm">#{order.id.slice(0, 8)}</p>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${statusColors[order.status] ?? "bg-gray-100 text-gray-600"}`}>{order.status}</span>
                  </div>
                  <p className="mt-1 text-xs text-text-muted">{order.user?.name} · {order.user?.email}</p>
                  <div className="mt-1.5 flex flex-wrap gap-2 text-xs text-text-muted">
                    <span>{order.pageCount} pages</span>
                    <span>·</span>
                    <span>{order.colorType === "color" ? "Color" : "B&W"}</span>
                    <span>·</span>
                    <span>{order.printSide === "single" ? "Single side" : "Both sides"}</span>
                    <span>·</span>
                    <span>{order.orientation}</span>
                    <span>·</span>
                    <span>{order.bindingType}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="font-serif text-lg text-[#8f2d22]">{formatPrice(Number(order.totalPrice))}</span>
                  <a href={order.fileUrl} target="_blank" rel="noreferrer"
                    className="rounded-full border border-black/10 px-3 py-1.5 text-xs text-text-primary hover:bg-[#f4efe7] transition-colors">
                    View PDF
                  </a>
                  <select value={order.status}
                    onChange={(e) => updateStatusMutation.mutate({ id: order.id, status: e.target.value })}
                    className="rounded-xl border border-black/10 bg-[#f8f4ee] px-3 py-1.5 text-xs outline-none focus:bg-white">
                    <option value="PENDING">Pending</option>
                    <option value="PROCESSING">Processing</option>
                    <option value="COMPLETED">Completed</option>
                    <option value="CANCELLED">Cancelled</option>
                  </select>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
