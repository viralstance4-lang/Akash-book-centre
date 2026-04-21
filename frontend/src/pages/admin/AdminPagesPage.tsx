import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Save, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { getAdminPages, createPage, updatePage, deletePage, type Page } from "../../api/pages.api";

// Simple rich text toolbar
const TOOLBAR = [
  { cmd: "bold", label: "B", style: "font-bold" },
  { cmd: "italic", label: "I", style: "italic" },
  { cmd: "underline", label: "U", style: "underline" },
  { cmd: "h2", label: "H2", style: "" },
  { cmd: "h3", label: "H3", style: "" },
  { cmd: "insertUnorderedList", label: "• List", style: "" },
  { cmd: "insertOrderedList", label: "1. List", style: "" },
  { cmd: "createLink", label: "Link", style: "" },
];

function RichEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value;
    }
  }, []);

  const execCmd = (cmd: string) => {
    if (cmd === "h2") {
      document.execCommand("formatBlock", false, "h2");
    } else if (cmd === "h3") {
      document.execCommand("formatBlock", false, "h3");
    } else if (cmd === "createLink") {
      const url = prompt("Enter URL:");
      if (url) document.execCommand("createLink", false, url);
    } else {
      document.execCommand(cmd, false);
    }
    editorRef.current?.focus();
  };

  return (
    <div className="overflow-hidden rounded-xl border border-black/10">
      <div className="flex flex-wrap gap-1 border-b border-black/10 bg-[#f8f4ee] p-2">
        {TOOLBAR.map((btn) => (
          <button key={btn.cmd} type="button" onMouseDown={(e) => { e.preventDefault(); execCmd(btn.cmd); }}
            className={`rounded-lg border border-black/10 bg-white px-2.5 py-1 text-xs text-text-primary hover:bg-[#f4efe7] transition-colors ${btn.style}`}>
            {btn.label}
          </button>
        ))}
      </div>
      <div ref={editorRef} contentEditable suppressContentEditableWarning
        onInput={() => onChange(editorRef.current?.innerHTML ?? "")}
        className="min-h-[240px] p-4 text-sm text-text-primary outline-none prose prose-sm max-w-none"
        style={{ lineHeight: "1.8" }}
      />
    </div>
  );
}

const slugify = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export default function AdminPagesPage() {
  const queryClient = useQueryClient();
  const [isAdding, setIsAdding] = useState(false);
  const [editingPage, setEditingPage] = useState<Page | null>(null);
  const [form, setForm] = useState({ title: "", slug: "", content: "", isActive: true, showInFooter: true });
  const [error, setError] = useState("");

  const { data, isLoading } = useQuery({ queryKey: ["admin-pages"], queryFn: getAdminPages });

  const createMutation = useMutation({
    mutationFn: createPage,
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ["admin-pages"] }); setIsAdding(false); setForm({ title: "", slug: "", content: "", isActive: true, showInFooter: true }); setError(""); },
    onError: (e: any) => setError(e?.response?.data?.message ?? "Failed"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => updatePage(id, data),
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ["admin-pages"] }); setEditingPage(null); },
  });

  const deleteMutation = useMutation({
    mutationFn: deletePage,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["admin-pages"] }),
  });

  const pages = data?.data ?? [];

  const handleTitleChange = (title: string) => {
    setForm((f) => ({ ...f, title, slug: slugify(title) }));
  };

  if (isLoading) return <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-20 animate-pulse rounded-2xl bg-white" />)}</div>;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[0.72rem] uppercase tracking-[0.28em] text-text-muted">Manage</p>
          <h2 className="font-serif text-2xl text-text-primary">Pages</h2>
        </div>
        <button type="button" onClick={() => { setIsAdding(true); setError(""); }}
          className="inline-flex items-center gap-2 rounded-full bg-[#1d1a17] px-4 py-2.5 text-sm text-white hover:-translate-y-0.5 hover:bg-black transition-all">
          <Plus size={15} /> Add Page
        </button>
      </div>

      {/* Add / Edit Form */}
      {(isAdding || editingPage) && (
        <div className="rounded-2xl border border-black/10 bg-white p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-serif text-xl text-text-primary">{isAdding ? "New Page" : "Edit Page"}</h3>
            <button type="button" onClick={() => { setIsAdding(false); setEditingPage(null); setError(""); }}
              className="rounded-full p-1.5 text-text-muted hover:bg-[#f4efe7]"><X size={16} /></button>
          </div>
          {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-600">{error}</div>}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs uppercase tracking-widest text-text-muted">Page Title *</label>
              <input type="text" value={isAdding ? form.title : editingPage?.title ?? ""} placeholder="e.g. Shipping Policy"
                onChange={(e) => isAdding ? handleTitleChange(e.target.value) : setEditingPage((p) => p ? { ...p, title: e.target.value } : p)}
                className="w-full rounded-xl border border-black/10 bg-[#f8f4ee] px-4 py-2.5 text-sm outline-none focus:border-black/25 focus:bg-white" />
            </div>
            <div>
              <label className="mb-1.5 block text-xs uppercase tracking-widest text-text-muted">URL Slug *</label>
              <input type="text" value={isAdding ? form.slug : editingPage?.slug ?? ""} placeholder="e.g. shipping-policy"
                onChange={(e) => isAdding ? setForm((f) => ({ ...f, slug: e.target.value })) : setEditingPage((p) => p ? { ...p, slug: e.target.value } : p)}
                className="w-full rounded-xl border border-black/10 bg-[#f8f4ee] px-4 py-2.5 text-sm outline-none focus:border-black/25 focus:bg-white font-mono" />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-xs uppercase tracking-widest text-text-muted">Content *</label>
            <RichEditor
              value={isAdding ? form.content : editingPage?.content ?? ""}
              onChange={(v) => isAdding ? setForm((f) => ({ ...f, content: v })) : setEditingPage((p) => p ? { ...p, content: v } : p)}
            />
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              <label className="text-xs uppercase tracking-widest text-text-muted">Active</label>
              <button type="button" onClick={() => isAdding ? setForm((f) => ({ ...f, isActive: !f.isActive })) : setEditingPage((p) => p ? { ...p, isActive: !p.isActive } : p)}
                className={`relative h-6 w-11 rounded-full transition-colors ${(isAdding ? form.isActive : editingPage?.isActive) ? "bg-emerald-500" : "bg-gray-200"}`}>
                <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${(isAdding ? form.isActive : editingPage?.isActive) ? "left-[calc(100%-1.375rem)]" : "left-0.5"}`} />
              </button>
            </div>
            <div className="flex items-center gap-3">
              <label className="text-xs uppercase tracking-widest text-text-muted">Show in Footer</label>
              <button type="button" onClick={() => isAdding ? setForm((f) => ({ ...f, showInFooter: !f.showInFooter })) : setEditingPage((p) => p ? { ...p, showInFooter: !p.showInFooter } : p)}
                className={`relative h-6 w-11 rounded-full transition-colors ${(isAdding ? form.showInFooter : editingPage?.showInFooter) ? "bg-emerald-500" : "bg-gray-200"}`}>
                <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${(isAdding ? form.showInFooter : editingPage?.showInFooter) ? "left-[calc(100%-1.375rem)]" : "left-0.5"}`} />
              </button>
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => { setIsAdding(false); setEditingPage(null); setError(""); }}
              className="rounded-full border border-black/10 px-4 py-2 text-sm text-text-muted hover:text-text-primary">Cancel</button>
            <button type="button" disabled={createMutation.isPending || updateMutation.isPending}
              onClick={() => {
                if (isAdding) createMutation.mutate(form as any);
                else if (editingPage) updateMutation.mutate({ id: editingPage.id, data: editingPage });
              }}
              className="inline-flex items-center gap-2 rounded-full bg-[#1d1a17] px-5 py-2 text-sm text-white hover:bg-black disabled:opacity-60">
              <Save size={14} />
              {createMutation.isPending || updateMutation.isPending ? "Saving..." : "Save Page"}
            </button>
          </div>
        </div>
      )}

      {/* Pages List */}
      {pages.length === 0 && !isAdding ? (
        <div className="rounded-2xl border border-dashed border-black/10 bg-white px-6 py-12 text-center">
          <p className="font-serif text-xl text-text-primary">No pages yet</p>
          <p className="mt-2 text-sm text-text-muted">Create pages like Shipping Policy, Returns, Terms & Conditions.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {pages.map((page) => (
            <div key={page.id} className="flex items-center gap-4 rounded-2xl border border-black/8 bg-white p-4">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-text-primary text-sm">{page.title}</p>
                <p className="mt-0.5 text-xs text-text-muted font-mono">/{page.slug}</p>
                <div className="mt-1.5 flex items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${page.isActive ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>
                    {page.isActive ? "Active" : "Inactive"}
                  </span>
                  {page.showInFooter && <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] text-blue-700">In Footer</span>}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button type="button" onClick={() => { setEditingPage(page); setIsAdding(false); }}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-black/10 text-text-muted hover:text-text-primary transition-colors">
                  <Pencil size={14} />
                </button>
                <button type="button" onClick={() => deleteMutation.mutate(page.id)} disabled={deleteMutation.isPending}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-red-100 text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors disabled:opacity-50">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
