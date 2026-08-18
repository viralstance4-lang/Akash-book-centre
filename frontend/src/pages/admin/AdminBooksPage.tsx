import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AxiosError } from "axios";
import {
  ChevronDown,
  GripVertical,
  ImagePlus,
  Pencil,
  Plus,
  Star,
  Trash2,
  X,
} from "lucide-react";
import ReactQuill from "react-quill-new";
import "react-quill-new/dist/quill.snow.css";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  addBookImages,
  createBook,
  deleteBook,
  deleteBookImage,
  getBooks,
  reorderBookImages,
  updateBook,
} from "../../api/books.api";
import { getCategories, type Category } from "../../api/categories.api";
import { getErrorMessage, useToast, ToastViewport } from "../../components/ui/Toast";
import type { ApiErrorResponse, Book } from "../../types";

// ── Types ─────────────────────────────────────────────────────────────────────

type BookFormState = {
  title: string; author: string; isbn: string; description: string;
  price: string; comparePrice: string;
  categoryIds: string[];
  subcategoryIds: string[];
  stock: string; language: string; publication: string;
  allowStapleBinding: boolean;
  allowSpiralBinding: boolean;
  height: string;
  length: string;
  breadth: string;
  weight: string;
  // create mode: multiple images + which one is the cover
  images: File[];
  coverIndex: number;
  // edit mode: optional single cover replacement
  coverImage: File | null;
};

const initialForm: BookFormState = {
  title: "", author: "", isbn: "", description: "",
  price: "", comparePrice: "",
  categoryIds: [],
  subcategoryIds: [],
  stock: "", language: "English", publication: "",
  allowStapleBinding: false,
  allowSpiralBinding: false,
  height: "",
  length: "",
  breadth: "",
  weight: "",
  images: [], coverIndex: 0,
  coverImage: null,
};

const QUILL_MODULES = {
  toolbar: [
    [{ header: [1, 2, 3, false] }],
    ["bold", "italic", "underline"],
    [{ list: "ordered" }, { list: "bullet" }],
    [{ align: [] }],
    ["link"],
    ["clean"],
  ],
};

const QUILL_FORMATS = ["header", "bold", "italic", "underline", "list", "align", "link"];

const fmt = (v: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(v);

const buildBookFormData = (form: BookFormState, isNew: boolean) => {
  const fd = new FormData();
  fd.append("title",  form.title);
  fd.append("author", form.author);
  fd.append("isbn",   form.isbn);
  fd.append("description", form.description);
  fd.append("price",  form.price);
  if (form.comparePrice) fd.append("comparePrice", form.comparePrice);
  // Send each selected ID as a repeated FormData field — Express/Multer parses as array
  form.categoryIds.forEach((id)    => fd.append("categoryIds",    id));
  form.subcategoryIds.forEach((id) => fd.append("subcategoryIds", id));
  fd.append("stock",    form.stock);
  fd.append("language", form.language);
  if (form.publication) fd.append("publication", form.publication);
  fd.append("allowStapleBinding", form.allowStapleBinding ? "true" : "false");
  fd.append("allowSpiralBinding", form.allowSpiralBinding ? "true" : "false");
  if (form.height !== "") fd.append("height", form.height);
  if (form.length !== "") fd.append("length", form.length);
  if (form.breadth !== "") fd.append("breadth", form.breadth);
  if (form.weight !== "") fd.append("weight", form.weight);
  if (isNew) {
    form.images.forEach((f) => fd.append("images", f));
    fd.append("coverIndex", String(form.coverIndex));
  } else {
    if (form.coverImage) fd.append("coverImage", form.coverImage);
  }
  return fd;
};

// ── Image Manager ─────────────────────────────────────────────────────────────

type BookImage = { id: string; imageUrl: string; publicId: string; order: number };

function ImageManager({ bookId, images, onClose }: { bookId: string; images: BookImage[]; onClose: () => void }) {
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [localImages, setLocalImages]   = useState<BookImage[]>([...images].sort((a, b) => a.order - b.order));
  const [dragIndex, setDragIndex]       = useState<number | null>(null);
  const [uploadFiles, setUploadFiles]   = useState<File[]>([]);
  const [uploadPreviews, setUploadPreviews] = useState<string[]>([]);
  const { toast, showToast } = useToast();
  // Snapshot of localImages taken right before a drag starts, so a failed reorder
  // can revert the grid instead of leaving the unsaved drag order on screen.
  const preDragImagesRef = useRef<BookImage[] | null>(null);

  const addMutation = useMutation({
    mutationFn: (files: File[]) => addBookImages(bookId, files),
    onSuccess: (data: any) => {
      const updated = (data.data?.images ?? []).sort((a: BookImage, b: BookImage) => a.order - b.order);
      setLocalImages(updated); setUploadFiles([]); setUploadPreviews([]);
      void queryClient.invalidateQueries({ queryKey: ["admin-books"] });
      void queryClient.invalidateQueries({ queryKey: ["books"] });
    },
    onError: (e) => showToast(false, getErrorMessage(e, "Failed to upload images. Please try again.")),
  });

  const deleteMutation = useMutation({
    mutationFn: (imageId: string) => deleteBookImage(bookId, imageId),
    onSuccess: (data: any) => {
      const updated = (data.data?.images ?? []).sort((a: BookImage, b: BookImage) => a.order - b.order);
      setLocalImages(updated);
      void queryClient.invalidateQueries({ queryKey: ["admin-books"] });
      void queryClient.invalidateQueries({ queryKey: ["books"] });
    },
    onError: (e) => showToast(false, getErrorMessage(e, "Failed to delete image. Please try again.")),
  });

  const reorderMutation = useMutation({
    mutationFn: (imgs: { id: string; order: number }[]) => reorderBookImages(bookId, imgs),
    onSuccess: (data: any) => {
      const updated = (data.data?.images ?? []).sort((a: BookImage, b: BookImage) => a.order - b.order);
      setLocalImages(updated);
      void queryClient.invalidateQueries({ queryKey: ["admin-books"] });
      void queryClient.invalidateQueries({ queryKey: ["books"] });
    },
    onError: (e) => {
      if (preDragImagesRef.current) setLocalImages(preDragImagesRef.current);
      showToast(false, getErrorMessage(e, "Failed to save the new image order. Reverted to the last saved order."));
    },
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setUploadFiles(files);
    setUploadPreviews(files.map((f) => URL.createObjectURL(f)));
  };

  const handleDragStart = (index: number) => {
    preDragImagesRef.current = localImages;
    setDragIndex(index);
  };
  const handleDragOver  = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (dragIndex === null || dragIndex === index) return;
    const reordered = [...localImages];
    const [moved] = reordered.splice(dragIndex, 1);
    reordered.splice(index, 0, moved);
    setLocalImages(reordered.map((img, i) => ({ ...img, order: i })));
    setDragIndex(index);
  };
  const handleDragEnd = () => {
    if (dragIndex !== null) reorderMutation.mutate(localImages.map((img, i) => ({ id: img.id, order: i })));
    setDragIndex(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <ToastViewport toast={toast} />
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between border-b border-black/8 px-5 py-4">
          <div>
            <h3 className="font-serif text-xl text-text-primary">Manage Images</h3>
            <p className="mt-0.5 text-xs text-text-muted">Drag to reorder · First image = cover photo</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-2 text-text-muted hover:bg-[#f4efe7]"><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {localImages.length > 0 && (
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-text-muted">Current Images</p>
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                {localImages.map((img, index) => (
                  <div key={img.id} draggable
                    onDragStart={() => handleDragStart(index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDragEnd={handleDragEnd}
                    className={`group relative cursor-grab rounded-xl overflow-hidden border-2 transition-all ${index === 0 ? "border-[#1d1a17]" : "border-transparent hover:border-black/20"} ${dragIndex === index ? "opacity-50 scale-95" : ""}`}>
                    <img src={img.imageUrl} alt={`Image ${index + 1}`} className="aspect-[3/4] w-full object-cover" />
                    {index === 0 && (
                      <div className="absolute top-1.5 left-1.5 flex items-center gap-1 rounded-full bg-[#1d1a17] px-2 py-0.5">
                        <Star size={9} className="fill-amber-400 text-amber-400" />
                        <span className="text-[9px] font-bold text-white">COVER</span>
                      </div>
                    )}
                    <div className="absolute top-1.5 right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-[10px] font-bold text-white">{index + 1}</div>
                    <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between bg-black/60 px-2 py-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <GripVertical size={12} className="text-white/70" />
                      <button type="button" onClick={() => deleteMutation.mutate(img.id)} disabled={deleteMutation.isPending}
                        className="rounded p-0.5 text-white hover:text-red-400 transition-colors">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-text-muted">Add More Images</p>
            {uploadPreviews.length > 0 ? (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                  {uploadPreviews.map((preview, i) => (
                    <div key={i} className="relative rounded-xl overflow-hidden border border-emerald-300">
                      <img src={preview} alt={`Upload ${i + 1}`} className="aspect-[3/4] w-full object-cover" />
                      <button type="button"
                        onClick={() => { setUploadFiles((f) => f.filter((_, j) => j !== i)); setUploadPreviews((p) => p.filter((_, j) => j !== i)); }}
                        className="absolute top-1 left-1 rounded-full bg-black/60 p-0.5 text-white hover:bg-red-500 transition-colors">
                        <X size={10} />
                      </button>
                    </div>
                  ))}
                  <button type="button" onClick={() => fileRef.current?.click()}
                    className="aspect-[3/4] flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-black/15 bg-[#f8f4ee] text-text-muted hover:border-black/30">
                    <ImagePlus size={20} /><span className="mt-1 text-[10px]">Add more</span>
                  </button>
                </div>
                <div className="flex gap-3">
                  <button type="button" onClick={() => { setUploadFiles([]); setUploadPreviews([]); }}
                    className="flex-1 rounded-full border border-black/10 py-2.5 text-sm text-text-muted hover:text-text-primary">Cancel</button>
                  <button type="button" onClick={() => addMutation.mutate(uploadFiles)} disabled={addMutation.isPending}
                    className="flex-1 rounded-full bg-[#1d1a17] py-2.5 text-sm text-white hover:bg-black disabled:opacity-60">
                    {addMutation.isPending ? "Uploading..." : `Upload ${uploadFiles.length} Image${uploadFiles.length > 1 ? "s" : ""}`}
                  </button>
                </div>
              </div>
            ) : (
              <button type="button" onClick={() => fileRef.current?.click()}
                className="flex w-full flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-black/15 bg-[#f8f4ee] py-8 text-text-muted hover:border-black/30">
                <ImagePlus size={28} />
                <p className="text-sm font-medium">Click to select images</p>
                <p className="text-xs opacity-60">JPG, PNG, WebP · Multiple files allowed</p>
              </button>
            )}
            <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFileSelect} />
          </div>
        </div>

        <div className="border-t border-black/8 px-5 py-4">
          <button type="button" onClick={onClose}
            className="w-full rounded-full bg-[#1d1a17] py-3 text-sm font-medium text-white hover:bg-black transition-all">Done</button>
        </div>
      </div>
    </div>
  );
}

// ── Searchable multi-select ───────────────────────────────────────────────────

type SelectItem = { id: string; name: string; meta?: string };

function MultiSelect({
  label,
  items,
  selectedIds,
  onChange,
  placeholder,
}: {
  label: string;
  items: SelectItem[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  placeholder?: string;
}) {
  const [open, setOpen]       = useState(false);
  const [search, setSearch]   = useState("");
  const containerRef           = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    };
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const filtered = search.trim()
    ? items.filter(
        (i) =>
          i.name.toLowerCase().includes(search.toLowerCase()) ||
          (i.meta?.toLowerCase().includes(search.toLowerCase()) ?? false),
      )
    : items;

  const toggle = (id: string) =>
    onChange(selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id]);

  const selected = items.filter((i) => selectedIds.includes(i.id));

  return (
    <div ref={containerRef} className="relative">
      <label className="mb-1 block text-xs text-text-muted">{label}</label>

      {/* Selected tags */}
      {selected.length > 0 && (
        <div className="mb-1.5 flex flex-wrap gap-1">
          {selected.map((item) => (
            <span
              key={item.id}
              className="inline-flex items-center gap-1 rounded-full bg-[#1d1a17] px-2.5 py-0.5 text-[11px] font-medium text-white"
            >
              {item.name}
              <button type="button" onClick={() => toggle(item.id)} className="text-white/60 hover:text-white transition-colors">
                <X size={10} />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex h-10 w-full items-center justify-between rounded-2xl border border-black/10 bg-white px-3 text-sm text-text-muted hover:border-black/20 transition-colors"
      >
        <span className={selected.length > 0 ? "text-text-primary" : ""}>
          {selected.length > 0 ? `${selected.length} selected` : (placeholder ?? `Select ${label.toLowerCase()}…`)}
        </span>
        <ChevronDown size={13} className={`shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute left-0 right-0 top-full z-30 mt-1 overflow-hidden rounded-2xl border border-black/10 bg-white shadow-lg">
          <div className="border-b border-black/8 px-3 py-2">
            <input
              autoFocus
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search…"
              className="w-full bg-transparent text-sm outline-none placeholder:text-text-muted/60"
            />
          </div>
          <div className="max-h-44 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="px-3 py-3 text-xs text-text-muted">No results</p>
            ) : (
              filtered.map((item) => (
                <label
                  key={item.id}
                  className="flex cursor-pointer items-center gap-2.5 px-3 py-2 hover:bg-[#f8f4ee] transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(item.id)}
                    onChange={() => toggle(item.id)}
                    className="h-3.5 w-3.5 accent-[#1d1a17] shrink-0"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="text-sm text-text-primary">{item.name}</span>
                    {item.meta && <span className="ml-1.5 text-[11px] text-text-muted">{item.meta}</span>}
                  </span>
                </label>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main AdminBooksPage ───────────────────────────────────────────────────────

export default function AdminBooksPage() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search,       setSearch]       = useState("");
  const [filterCatId,  setFilterCatId]  = useState("");
  const [editingBook,  setEditingBook]  = useState<Book | null>(null);
  const [form,         setForm]         = useState<BookFormState>(initialForm);
  const [formError,    setFormError]    = useState("");
  const [managingImagesBook, setManagingImagesBook] = useState<Book | null>(null);
  const { toast, showToast } = useToast();

  const { data: booksData, isLoading } = useQuery({
    queryKey: ["admin-books", search, filterCatId],
    queryFn: () => getBooks({
      q:        search      || undefined,
      category: filterCatId || undefined,
      limit: 50,
    }),
  });
  const { data: categoriesData } = useQuery({ queryKey: ["categories"], queryFn: getCategories });

  const books:      Book[]     = booksData?.data.books ?? [];
  const categories: Category[] = categoriesData?.data ?? [];

  // Auto-open edit form when arriving from a Restock link (?edit=<id>)
  useEffect(() => {
    const editId = searchParams.get("edit");
    if (!editId || books.length === 0) return;
    const target = books.find((b) => b.id === editId);
    if (target) {
      handleEdit(target);
      setSearchParams({}, { replace: true });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [books, searchParams]);

  const resetForm = () => { setEditingBook(null); setForm(initialForm); setFormError(""); };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!form.title || !form.author || !form.isbn || !form.price || !form.stock)
        throw new Error("Please complete all required fields.");
      if (!editingBook && form.images.length === 0) throw new Error("At least one image is required.");
      if (editingBook) return updateBook(editingBook.id, buildBookFormData(form, false));
      return createBook(buildBookFormData(form, true));
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-books"] });
      void queryClient.invalidateQueries({ queryKey: ["books"] });
      resetForm();
    },
    onError: (error) => {
      const apiError = error as AxiosError<ApiErrorResponse>;
      const message = apiError.response?.data?.message ?? (error as Error).message ?? "Unable to save.";
      setFormError(message);
      // The form panel is independently scrollable and the admin is usually
      // scrolled down near the submit button when this fires, so the inline
      // error above can end up off-screen — a toast guarantees it's seen.
      showToast(false, message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteBook(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-books"] });
      void queryClient.invalidateQueries({ queryKey: ["books"] });
      setFormError("");
    },
    onError: (error) => {
      const apiError = error as AxiosError<ApiErrorResponse>;
      setFormError(apiError.response?.data?.message ?? "Unable to delete.");
    },
  });

  const handleEdit = (book: Book) => {
    setEditingBook(book);
    setForm({
      title:        book.title,
      author:       book.author,
      isbn:         book.isbn,
      description:  book.description ?? "",
      price:        String(book.price),
      comparePrice: book.comparePrice ? String(book.comparePrice) : "",
      // Prefer M2M relations; fall back to legacy FK for old books not yet migrated
      categoryIds:    book.bookCategories?.map((bc) => bc.category.id)
                       ?? (book.categoryId ? [book.categoryId] : []),
      subcategoryIds: book.bookSubcategories?.map((bs) => bs.subcategory.id)
                       ?? (book.subcategoryId ? [book.subcategoryId] : []),
      stock:        String(book.stock),
      language:     (book as any).language    ?? "English",
      publication:  (book as any).publication ?? "",
      allowStapleBinding: Boolean((book as any).allowStapleBinding),
      allowSpiralBinding: Boolean((book as any).allowSpiralBinding),
      height: (book as any).height !== null && (book as any).height !== undefined ? String((book as any).height) : "",
      length: (book as any).length !== null && (book as any).length !== undefined ? String((book as any).length) : "",
      breadth: (book as any).breadth !== null && (book as any).breadth !== undefined ? String((book as any).breadth) : "",
      weight: (book as any).weight !== null && (book as any).weight !== undefined ? String((book as any).weight) : "",
      images: [], coverIndex: 0,
      coverImage:   null,
    });
    setFormError("");
  };

  const inp = "h-11 w-full rounded-2xl border border-black/10 bg-white px-4 text-sm outline-none transition-all focus:border-black/20 focus:shadow-sm";

  return (
    <>
      <ToastViewport toast={toast} />

      {managingImagesBook && (
        <ImageManager
          bookId={managingImagesBook.id}
          images={(managingImagesBook as any).images ?? []}
          onClose={() => { setManagingImagesBook(null); void queryClient.invalidateQueries({ queryKey: ["admin-books"] }); }}
        />
      )}

      <div className="grid h-full min-h-0 gap-6 xl:grid-cols-[minmax(0,1.35fr)_26rem]">
        {/* ── Books list ───────────────────────────────────────────────────────── */}
        <section className="flex min-h-0 flex-col gap-5">
          {/* Stats */}
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              { label: "Total Books",  value: booksData?.data.total ?? books.length, color: "text-text-primary" },
              { label: "Low Stock",    value: books.filter((b) => b.stock < 10).length, color: "text-[#8f2d22]" },
              { label: "Categories",   value: categories.length, color: "text-text-primary" },
            ].map(({ label, value, color }) => (
              <div key={label} className="rounded-2xl border border-black/8 bg-[#fbf8f2] p-4">
                <p className="text-[0.68rem] uppercase tracking-[0.22em] text-text-muted">{label}</p>
                <p className={`mt-2 font-serif text-3xl ${color}`}>{value}</p>
              </div>
            ))}
          </div>

          <div className="flex min-h-0 flex-1 flex-col rounded-2xl border border-black/8 bg-[#fbf8f2] p-5">
            {/* Filters */}
            <div className="flex flex-col gap-3 sm:flex-row mb-4">
              <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="Search books..."
                className="h-11 flex-1 rounded-2xl border border-black/10 bg-white px-4 text-sm outline-none focus:border-black/20" />
              <div className="relative">
                <select value={filterCatId} onChange={(e) => setFilterCatId(e.target.value)}
                  className="h-11 appearance-none rounded-2xl border border-black/10 bg-white pl-4 pr-10 text-sm outline-none focus:border-black/20">
                  <option value="">All categories</option>
                  {categories.map((c) => <option key={c.id} value={c.slug}>{c.name}</option>)}
                </select>
                <ChevronDown size={15} className="pointer-events-none absolute right-3 top-3.5 text-text-muted" />
              </div>
            </div>

            {/* Book rows */}
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
              {isLoading
                ? Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-28 animate-pulse rounded-2xl bg-white" />)
                : books.map((book) => {
                    const imgs = (book as any).images ?? [];
                    return (
                      <article key={book.id} className="rounded-2xl border border-black/8 bg-white p-4">
                        <div className="grid gap-3 sm:grid-cols-[auto_minmax(0,1fr)_auto]">
                          {/* Images */}
                          <div className="flex gap-1.5">
                            <div className="relative">
                              <img src={book.coverImageUrl} alt={book.title} className="h-20 w-14 rounded-xl object-cover" />
                              <div className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#1d1a17]">
                                <Star size={8} className="fill-amber-400 text-amber-400" />
                              </div>
                            </div>
                            {imgs.slice(1, 3).map((img: BookImage) => (
                              <img key={img.id} src={img.imageUrl} alt="" className="h-20 w-14 rounded-xl object-cover opacity-70" />
                            ))}
                          </div>

                          {/* Details */}
                          <div className="min-w-0">
                            <p className="font-serif text-lg text-text-primary truncate">{book.title}</p>
                            <p className="mt-0.5 text-sm text-text-muted">{book.author}</p>
                            <div className="mt-1 flex flex-wrap gap-1.5">
                              {(book.bookCategories && book.bookCategories.length > 0
                                ? book.bookCategories
                                : book.category ? [{ category: book.category }] : []
                              ).map((bc) => (
                                <span key={bc.category.id} className="rounded-full bg-[#1d1a17]/8 px-2 py-0.5 text-[10px] font-medium text-text-primary">
                                  {bc.category.name}
                                </span>
                              ))}
                              {(book.bookSubcategories && book.bookSubcategories.length > 0
                                ? book.bookSubcategories
                                : book.subcategory ? [{ subcategory: book.subcategory }] : []
                              ).map((bs) => (
                                <span key={bs.subcategory.id} className="rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-[10px] text-amber-700">
                                  {bs.subcategory.name}
                                </span>
                              ))}
                            </div>
                            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm">
                              <span className="font-medium text-[#8f2d22]">{fmt(Number(book.price))}</span>
                              {book.comparePrice && (
                                <span className="text-text-muted line-through text-xs">{fmt(Number(book.comparePrice))}</span>
                              )}
                              <span className="text-text-muted text-xs">Stock: {book.stock}</span>
                              {book.stock < 1 && (
                                <span className="rounded-full bg-red-100 border border-red-200 px-2 py-0.5 text-[10px] font-semibold text-red-600">
                                  Out of Stock
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="flex flex-col gap-2 shrink-0">
                            <button type="button" onClick={() => handleEdit(book)}
                              className="inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-[#f8f4ee] px-3 py-2 text-xs text-text-primary hover:-translate-y-0.5 transition-all">
                              <Pencil size={12} /> Edit
                            </button>
                            <button type="button"
                              onClick={() => { void queryClient.invalidateQueries({ queryKey: ["admin-books"] }); setManagingImagesBook(book); }}
                              className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700 hover:-translate-y-0.5 transition-all">
                              <ImagePlus size={12} /> Images
                            </button>
                            <button type="button" disabled={deleteMutation.isPending}
                              onClick={() => { if (window.confirm(`Delete "${book.title}"?`)) deleteMutation.mutate(book.id); }}
                              className="inline-flex items-center gap-1.5 rounded-full border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-600 hover:-translate-y-0.5 transition-all">
                              <Trash2 size={12} /> Delete
                            </button>
                          </div>
                        </div>
                      </article>
                    );
                  })}
            </div>
          </div>
        </section>

        {/* ── Book form ────────────────────────────────────────────────────────── */}
        <aside className="sticky top-0 h-fit max-h-[calc(100vh-8rem)] overflow-y-auto rounded-2xl border border-black/8 bg-[#fbf8f2] p-5">
          <div className="flex items-center justify-between mb-5">
            <div>
              <p className="text-[0.68rem] uppercase tracking-[0.22em] text-text-muted">{editingBook ? "Update book" : "Add book"}</p>
              <h2 className="mt-1 font-serif text-2xl text-text-primary">{editingBook ? "Edit Book" : "New Book"}</h2>
            </div>
            <button type="button" onClick={resetForm}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-black/10 bg-white text-text-primary hover:border-black/20">
              <Plus size={16} className={editingBook ? "rotate-45" : ""} />
            </button>
          </div>

          {formError && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{formError}</div>
          )}

          <div className="space-y-3">
            <input value={form.title}  onChange={(e) => setForm((c) => ({ ...c, title:  e.target.value }))} placeholder="Title *"  className={inp} />
            <input value={form.author} onChange={(e) => setForm((c) => ({ ...c, author: e.target.value }))} placeholder="Author *" className={inp} />
            <input value={form.isbn}   onChange={(e) => setForm((c) => ({ ...c, isbn:   e.target.value }))} placeholder="ISBN *"   className={inp} />
            <div className="quill-wrapper rounded-2xl border border-black/10 bg-white overflow-hidden focus-within:border-black/20">
              <ReactQuill
                theme="snow"
                value={form.description}
                onChange={(val) => setForm((c) => ({ ...c, description: val === "<p><br></p>" ? "" : val }))}
                modules={QUILL_MODULES}
                formats={QUILL_FORMATS}
                placeholder="Description"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs text-text-muted">Sale Price (₹) *</label>
                <input value={form.price}        onChange={(e) => setForm((c) => ({ ...c, price:        e.target.value }))} placeholder="e.g. 299" className={inp} />
              </div>
              <div>
                <label className="mb-1 block text-xs text-text-muted">Compare Price (₹)</label>
                <input value={form.comparePrice} onChange={(e) => setForm((c) => ({ ...c, comparePrice: e.target.value }))} placeholder="e.g. 399" className={inp} />
              </div>
            </div>

            <input value={form.stock} onChange={(e) => setForm((c) => ({ ...c, stock: e.target.value }))} placeholder="Stock *" className={inp} />

            {/* ── Categories multi-select ──────────────────────────────── */}
            <MultiSelect
              label="Categories"
              items={categories.map((c) => ({ id: c.id, name: c.name }))}
              selectedIds={form.categoryIds}
              onChange={(ids) => setForm((f) => ({ ...f, categoryIds: ids }))}
              placeholder="Select categories…"
            />

            {/* ── Subcategories multi-select ───────────────────────────── */}
            <MultiSelect
              label="Subcategories"
              items={categories.flatMap((c) =>
                c.subcategories.map((s) => ({ id: s.id, name: s.name, meta: c.name }))
              )}
              selectedIds={form.subcategoryIds}
              onChange={(ids) => setForm((f) => ({ ...f, subcategoryIds: ids }))}
              placeholder="Select subcategories…"
            />

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs text-text-muted">Language</label>
                <select value={form.language} onChange={(e) => setForm((c) => ({ ...c, language: e.target.value }))}
                  className="h-11 w-full rounded-2xl border border-black/10 bg-white px-4 text-sm outline-none focus:border-black/20">
                  {["English", "Hindi", "Bengali", "Tamil", "Telugu", "Marathi", "Gujarati", "Urdu", "Other"].map((l) => (
                    <option key={l} value={l}>{l}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-text-muted">Publication</label>
                <input value={form.publication} onChange={(e) => setForm((c) => ({ ...c, publication: e.target.value }))} placeholder="Publisher" className={inp} />
              </div>
            </div>

            {/* ── Dimensions & Weight (optional) ─────────────────────────── */}
            <div className="rounded-xl border border-black/10 bg-white p-3 space-y-2">
              <p className="text-xs font-medium text-text-muted">Dimensions & Weight</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs text-text-muted">Height (cm)</label>
                  <input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="0.01"
                    value={form.height}
                    onChange={(e) => setForm((c) => ({ ...c, height: e.target.value }))}
                    placeholder="e.g. 20"
                    className={inp}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-text-muted">Length (cm)</label>
                  <input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="0.01"
                    value={form.length}
                    onChange={(e) => setForm((c) => ({ ...c, length: e.target.value }))}
                    placeholder="e.g. 15"
                    className={inp}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-text-muted">Breadth (cm)</label>
                  <input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="0.01"
                    value={form.breadth}
                    onChange={(e) => setForm((c) => ({ ...c, breadth: e.target.value }))}
                    placeholder="e.g. 3"
                    className={inp}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-text-muted">Weight (kg)</label>
                  <input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="0.001"
                    value={form.weight}
                    onChange={(e) => setForm((c) => ({ ...c, weight: e.target.value }))}
                    placeholder="e.g. 0.5"
                    className={inp}
                  />
                </div>
              </div>
              <p className="text-[11px] text-text-muted">Optional — leave empty to hide on product page.</p>
            </div>

            {/* ── Binding options (per book) ─────────────────────────────── */}
            <div className="rounded-xl border border-black/10 bg-white p-3 space-y-2">
              <p className="text-xs font-medium text-text-muted">Binding Options</p>
              <label className="flex items-center justify-between gap-3 rounded-xl border border-black/8 bg-[#fbf8f2] px-3 py-2">
                <div>
                  <p className="text-sm font-medium text-text-primary">Enable Staple Binding</p>
                  <p className="text-[11px] text-text-muted">Show "Staple Binding" option on product page</p>
                </div>
                <input
                  type="checkbox"
                  checked={form.allowStapleBinding}
                  onChange={(e) => setForm((c) => ({ ...c, allowStapleBinding: e.target.checked }))}
                  className="h-4 w-4 accent-[#1d1a17]"
                />
              </label>
              <label className="flex items-center justify-between gap-3 rounded-xl border border-black/8 bg-[#fbf8f2] px-3 py-2">
                <div>
                  <p className="text-sm font-medium text-text-primary">Enable Spiral Binding</p>
                  <p className="text-[11px] text-text-muted">Show "Spiral Binding" option on product page</p>
                </div>
                <input
                  type="checkbox"
                  checked={form.allowSpiralBinding}
                  onChange={(e) => setForm((c) => ({ ...c, allowSpiralBinding: e.target.checked }))}
                  className="h-4 w-4 accent-[#1d1a17]"
                />
              </label>
            </div>

            {/* ── CREATE mode: multi-image uploader ────────────────────── */}
            {!editingBook && (() => {
              const addFiles = (files: FileList | null) => {
                if (!files) return;
                const incoming = Array.from(files);
                setForm((f) => ({
                  ...f,
                  images: [...f.images, ...incoming].slice(0, 10),
                }));
              };
              const removeImg = (idx: number) =>
                setForm((f) => ({
                  ...f,
                  images: f.images.filter((_, i) => i !== idx),
                  coverIndex: f.coverIndex === idx ? 0 : f.coverIndex > idx ? f.coverIndex - 1 : f.coverIndex,
                }));

              return (
                <div className="rounded-xl border border-black/10 bg-white p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-text-muted">
                      Images <span className="text-red-500">*</span>
                      <span className="ml-1 font-normal opacity-60">— first selected = cover by default</span>
                    </label>
                    {form.images.length > 0 && (
                      <span className="text-[10px] text-text-muted">{form.images.length}/10</span>
                    )}
                  </div>

                  {form.images.length > 0 ? (
                    <div className="grid grid-cols-4 gap-2">
                      {form.images.map((file, idx) => (
                        <div key={idx} className="group relative">
                          <img
                            src={URL.createObjectURL(file)}
                            alt={`img ${idx + 1}`}
                            className={`aspect-[3/4] w-full rounded-lg object-cover border-2 transition-all ${idx === form.coverIndex ? "border-[#1d1a17]" : "border-transparent"}`}
                          />
                          {/* Cover badge */}
                          {idx === form.coverIndex && (
                            <div className="absolute top-1 left-1 rounded-full bg-[#1d1a17] px-1.5 py-0.5 text-[8px] font-bold text-white leading-none">
                              COVER
                            </div>
                          )}
                          {/* Hover actions */}
                          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 rounded-lg bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity">
                            {idx !== form.coverIndex && (
                              <button
                                type="button"
                                onClick={() => setForm((f) => ({ ...f, coverIndex: idx }))}
                                className="rounded-full bg-white px-2 py-0.5 text-[9px] font-bold text-[#1d1a17] hover:bg-amber-100"
                              >
                                Set Cover
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => removeImg(idx)}
                              className="rounded-full bg-red-500 px-2 py-0.5 text-[9px] font-bold text-white hover:bg-red-600"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      ))}
                      {/* Add more tile */}
                      {form.images.length < 10 && (
                        <label className="aspect-[3/4] flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-black/15 bg-[#f8f4ee] text-text-muted hover:border-black/30 transition-colors">
                          <ImagePlus size={18} />
                          <span className="mt-1 text-[9px]">Add more</span>
                          <input type="file" accept="image/*" multiple className="hidden"
                            onChange={(e) => addFiles(e.target.files)} />
                        </label>
                      )}
                    </div>
                  ) : (
                    <label className="flex w-full cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-black/15 bg-[#f8f4ee] py-6 text-text-muted hover:border-black/30 transition-colors">
                      <ImagePlus size={26} />
                      <p className="text-sm font-medium">Click to upload images</p>
                      <p className="text-xs opacity-60">JPG, PNG, WebP · Up to 10 images</p>
                      <input type="file" accept="image/*" multiple className="hidden"
                        onChange={(e) => addFiles(e.target.files)} />
                    </label>
                  )}
                </div>
              );
            })()}

            {/* ── EDIT mode: cover replace + image manager ──────────────── */}
            {editingBook && (
              <>
                <div className="rounded-xl border border-black/10 bg-white p-3">
                  <label className="mb-1.5 block text-xs font-medium text-text-muted">
                    Cover Image
                    <span className="ml-1 font-normal opacity-60">— leave empty to keep current</span>
                  </label>
                  {form.coverImage ? (
                    <div className="flex items-center gap-3">
                      <img src={URL.createObjectURL(form.coverImage)} alt="Preview" className="h-16 w-12 rounded-lg object-cover" />
                      <div className="min-w-0">
                        <p className="truncate text-xs font-medium text-text-primary">{form.coverImage.name}</p>
                        <button type="button" onClick={() => setForm((c) => ({ ...c, coverImage: null }))}
                          className="mt-1 text-xs text-red-500 hover:underline">Remove</button>
                      </div>
                    </div>
                  ) : (
                    <input type="file" accept="image/*"
                      onChange={(e) => setForm((c) => ({ ...c, coverImage: e.target.files?.[0] ?? null }))}
                      className="block w-full text-sm text-text-muted file:mr-3 file:rounded-full file:border-0 file:bg-[#f4efe7] file:px-3 file:py-1.5 file:text-xs file:text-text-primary" />
                  )}
                </div>

                <div className="rounded-xl border border-black/10 bg-white p-3 space-y-2">
                  <p className="text-xs font-medium text-text-muted">Current Images</p>
                  <div className="flex flex-wrap gap-2">
                    {[...((editingBook as any).images ?? [])]
                      .sort((a: any, b: any) => a.order - b.order)
                      .map((img: any, i: number) => (
                        <div key={img.id} className="relative">
                          <img src={img.imageUrl} alt={`img ${i + 1}`}
                            className={`h-16 w-12 rounded-lg object-cover border-2 ${img.imageUrl === editingBook.coverImageUrl ? "border-[#1d1a17]" : "border-black/10"}`} />
                          {img.imageUrl === editingBook.coverImageUrl && (
                            <span className="absolute -top-1 -right-1 rounded-full bg-[#1d1a17] px-1 py-0.5 text-[8px] font-bold text-white">COVER</span>
                          )}
                        </div>
                      ))}
                  </div>
                  <button type="button" onClick={() => setManagingImagesBook(editingBook)}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-blue-200 bg-blue-50 py-2 text-xs text-blue-700 hover:bg-blue-100 transition-all">
                    <ImagePlus size={13} /> Add / Manage Images
                  </button>
                </div>
              </>
            )}

            <button type="button" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}
              className="inline-flex w-full items-center justify-center rounded-full bg-[#1d1a17] px-5 py-3 text-sm text-white hover:-translate-y-0.5 hover:bg-black disabled:opacity-60 transition-all">
              {saveMutation.isPending ? "Saving..." : editingBook ? "Update Book" : "Create Book"}
            </button>
          </div>
        </aside>
      </div>
    </>
  );
}
