import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AxiosError } from "axios";
import { ChevronDown, GripVertical, ImagePlus, Pencil, Plus, Star, Trash2, X } from "lucide-react";
import { useRef, useState } from "react";
import { getGenres } from "../../api/admin.api";
import { createBook, deleteBook, getBooks, updateBook, addBookImages, deleteBookImage, reorderBookImages } from "../../api/books.api";
import type { ApiErrorResponse, Book, Genre } from "../../types";

type BookFormState = {
  title: string; author: string; isbn: string; description: string;
  price: string; comparePrice: string; genreId: string; stock: string;
  language: string; publication: string; coverImage: File | null;
};

const initialForm: BookFormState = {
  title: "", author: "", isbn: "", description: "",
  price: "", comparePrice: "", genreId: "", stock: "",
  language: "English", publication: "", coverImage: null,
};

const fmt = (v: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(v);

const buildBookFormData = (form: BookFormState, includeImage: boolean) => {
  const fd = new FormData();
  fd.append("title", form.title);
  fd.append("author", form.author);
  fd.append("isbn", form.isbn);
  fd.append("description", form.description);
  fd.append("price", form.price);
  if (form.comparePrice) fd.append("comparePrice", form.comparePrice);
  fd.append("genreId", form.genreId);
  fd.append("stock", form.stock);
  fd.append("language", form.language);
  if (form.publication) fd.append("publication", form.publication);
  if (includeImage && form.coverImage) fd.append("coverImage", form.coverImage);
  return fd;
};

// ─── Image Manager Component ─────────────────────────────────────────────────
type BookImage = { id: string; imageUrl: string; publicId: string; order: number };

function ImageManager({ bookId, images, onClose }: { bookId: string; images: BookImage[]; onClose: () => void }) {
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [localImages, setLocalImages] = useState<BookImage[]>([...images].sort((a, b) => a.order - b.order));
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [uploadPreviews, setUploadPreviews] = useState<string[]>([]);

  const addMutation = useMutation({
    mutationFn: (files: File[]) => addBookImages(bookId, files),
    onSuccess: (data: any) => {
      const updated = (data.data?.images ?? []).sort((a: BookImage, b: BookImage) => a.order - b.order);
      setLocalImages(updated);
      setUploadFiles([]);
      setUploadPreviews([]);
      void queryClient.invalidateQueries({ queryKey: ["admin-books"] });
      void queryClient.invalidateQueries({ queryKey: ["books"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (imageId: string) => deleteBookImage(bookId, imageId),
    onSuccess: (data: any) => {
      const updated = (data.data?.images ?? []).sort((a: BookImage, b: BookImage) => a.order - b.order);
      setLocalImages(updated);
      void queryClient.invalidateQueries({ queryKey: ["admin-books"] });
      void queryClient.invalidateQueries({ queryKey: ["books"] });
    },
  });

  const reorderMutation = useMutation({
    mutationFn: (imgs: { id: string; order: number }[]) => reorderBookImages(bookId, imgs),
    onSuccess: (data: any) => {
      const updated = (data.data?.images ?? []).sort((a: BookImage, b: BookImage) => a.order - b.order);
      setLocalImages(updated);
      void queryClient.invalidateQueries({ queryKey: ["admin-books"] });
      void queryClient.invalidateQueries({ queryKey: ["books"] });
    },
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setUploadFiles(files);
    setUploadPreviews(files.map((f) => URL.createObjectURL(f)));
  };

  const handleSetCover = (index: number) => {
    if (index === 0) return;
    const reordered = [...localImages];
    const [moved] = reordered.splice(index, 1);
    reordered.unshift(moved);
    const withOrder = reordered.map((img, i) => ({ ...img, order: i }));
    setLocalImages(withOrder);
    reorderMutation.mutate(withOrder.map((img) => ({ id: img.id, order: img.order })));
  };

  // Drag to reorder
  const handleDragStart = (index: number) => setDragIndex(index);
  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (dragIndex === null || dragIndex === index) return;
    const reordered = [...localImages];
    const [moved] = reordered.splice(dragIndex, 1);
    reordered.splice(index, 0, moved);
    const withOrder = reordered.map((img, i) => ({ ...img, order: i }));
    setLocalImages(withOrder);
    setDragIndex(index);
  };
  const handleDragEnd = () => {
    if (dragIndex !== null) {
      reorderMutation.mutate(localImages.map((img, i) => ({ id: img.id, order: i })));
    }
    setDragIndex(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-black/8 px-5 py-4">
          <div>
            <h3 className="font-serif text-xl text-text-primary">Manage Images</h3>
            <p className="mt-0.5 text-xs text-text-muted">Drag to reorder · First image = cover photo</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-2 text-text-muted hover:bg-[#f4efe7]"><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Current Images */}
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

                    {/* Cover badge */}
                    {index === 0 && (
                      <div className="absolute top-1.5 left-1.5 flex items-center gap-1 rounded-full bg-[#1d1a17] px-2 py-0.5">
                        <Star size={9} className="fill-amber-400 text-amber-400" />
                        <span className="text-[9px] font-bold text-white">COVER</span>
                      </div>
                    )}

                    {/* Order number */}
                    <div className="absolute top-1.5 right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-[10px] font-bold text-white">
                      {index + 1}
                    </div>

                    {/* Drag handle */}
                    <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between bg-black/60 px-2 py-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <GripVertical size={12} className="text-white/70" />
                      <div className="flex items-center gap-1.5">
                        {index !== 0 && (
                          <button type="button" onClick={() => handleSetCover(index)}
                            className="rounded px-1.5 py-0.5 text-[9px] font-medium text-white bg-white/20 hover:bg-amber-500 transition-colors">
                            Set Cover
                          </button>
                        )}
                        <button type="button" onClick={() => deleteMutation.mutate(img.id)} disabled={deleteMutation.isPending}
                          className="rounded p-0.5 text-white hover:text-red-400 transition-colors">
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-xs text-text-muted">💡 Drag images to reorder · Hover image to see options · First image is the cover</p>
            </div>
          )}

          {/* Upload New Images */}
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-text-muted">Add More Images</p>

            {uploadPreviews.length > 0 ? (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                  {uploadPreviews.map((preview, i) => (
                    <div key={i} className="relative rounded-xl overflow-hidden border border-emerald-300">
                      <img src={preview} alt={`Upload ${i + 1}`} className="aspect-[3/4] w-full object-cover" />
                      <div className="absolute top-1 right-1 rounded-full bg-emerald-500 text-white p-0.5">
                        <span className="text-[9px] font-bold px-1">NEW</span>
                      </div>
                      <button type="button"
                        onClick={() => { setUploadFiles((f) => f.filter((_, j) => j !== i)); setUploadPreviews((p) => p.filter((_, j) => j !== i)); }}
                        className="absolute top-1 left-1 rounded-full bg-black/60 p-0.5 text-white hover:bg-red-500 transition-colors">
                        <X size={10} />
                      </button>
                    </div>
                  ))}
                  <button type="button" onClick={() => fileRef.current?.click()}
                    className="aspect-[3/4] flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-black/15 bg-[#f8f4ee] text-text-muted hover:border-black/30 transition-colors">
                    <ImagePlus size={20} />
                    <span className="mt-1 text-[10px]">Add more</span>
                  </button>
                </div>
                <div className="flex gap-3">
                  <button type="button" onClick={() => { setUploadFiles([]); setUploadPreviews([]); }}
                    className="flex-1 rounded-full border border-black/10 py-2.5 text-sm text-text-muted hover:text-text-primary">
                    Cancel
                  </button>
                  <button type="button" onClick={() => addMutation.mutate(uploadFiles)} disabled={addMutation.isPending}
                    className="flex-1 rounded-full bg-[#1d1a17] py-2.5 text-sm text-white hover:bg-black disabled:opacity-60">
                    {addMutation.isPending ? "Uploading..." : `Upload ${uploadFiles.length} Image${uploadFiles.length > 1 ? "s" : ""}`}
                  </button>
                </div>
              </div>
            ) : (
              <button type="button" onClick={() => fileRef.current?.click()}
                className="flex w-full flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-black/15 bg-[#f8f4ee] py-8 text-text-muted hover:border-black/30 transition-colors">
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
            className="w-full rounded-full bg-[#1d1a17] py-3 text-sm font-medium text-white hover:bg-black transition-all">
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main AdminBooksPage ─────────────────────────────────────────────────────
export default function AdminBooksPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedGenre, setSelectedGenre] = useState("");
  const [editingBook, setEditingBook] = useState<Book | null>(null);
  const [form, setForm] = useState<BookFormState>(initialForm);
  const [formError, setFormError] = useState("");
  const [managingImagesBook, setManagingImagesBook] = useState<Book | null>(null);

  const { data: booksData, isLoading } = useQuery({
    queryKey: ["admin-books", search, selectedGenre],
    queryFn: () => getBooks({ q: search || undefined, genre: selectedGenre || undefined, limit: 50 }),
  });
  const { data: genresData } = useQuery({ queryKey: ["genres"], queryFn: getGenres });

  const books = booksData?.data.books ?? [];
  const genres = genresData?.data ?? [];

  const resetForm = () => { setEditingBook(null); setForm(initialForm); setFormError(""); };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!form.title || !form.author || !form.isbn || !form.price || !form.genreId || !form.stock)
        throw new Error("Please complete all required fields.");
      if (!editingBook && !form.coverImage) throw new Error("Cover image is required for a new book.");
      if (editingBook) return updateBook(editingBook.id, buildBookFormData(form, Boolean(form.coverImage)));
      return createBook(buildBookFormData(form, true));
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-books"] });
      void queryClient.invalidateQueries({ queryKey: ["books"] });
      resetForm();
    },
    onError: (error) => {
      const apiError = error as AxiosError<ApiErrorResponse>;
      setFormError(apiError.response?.data?.message ?? (error as Error).message ?? "Unable to save.");
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
      title: book.title, author: book.author, isbn: book.isbn,
      description: book.description ?? "", price: String(book.price),
      comparePrice: (book as any).comparePrice ? String((book as any).comparePrice) : "",
      genreId: book.genreId, stock: String(book.stock),
      language: (book as any).language ?? "English",
      publication: (book as any).publication ?? "",
      coverImage: null,
    });
    setFormError("");
  };

  const inp = "h-11 w-full rounded-2xl border border-black/10 bg-white px-4 text-sm outline-none transition-all focus:border-black/20 focus:shadow-sm";

  return (
    <>
      {/* Image Manager Modal */}
      {managingImagesBook && (
        <ImageManager
          bookId={managingImagesBook.id}
          images={(managingImagesBook as any).images ?? []}
          onClose={() => {
            setManagingImagesBook(null);
            void queryClient.invalidateQueries({ queryKey: ["admin-books"] });
          }}
        />
      )}

      <div className="grid h-full min-h-0 gap-6 xl:grid-cols-[minmax(0,1.35fr)_26rem]">
        {/* Books List */}
        <section className="flex min-h-0 flex-col gap-5">
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              { label: "Total Books", value: booksData?.data.total ?? books.length, color: "text-text-primary" },
              { label: "Low Stock", value: books.filter((b) => b.stock < 10).length, color: "text-[#8f2d22]" },
              { label: "Genres", value: genres.length, color: "text-text-primary" },
            ].map(({ label, value, color }) => (
              <div key={label} className="rounded-2xl border border-black/8 bg-[#fbf8f2] p-4">
                <p className="text-[0.68rem] uppercase tracking-[0.22em] text-text-muted">{label}</p>
                <p className={`mt-2 font-serif text-3xl ${color}`}>{value}</p>
              </div>
            ))}
          </div>

          <div className="flex min-h-0 flex-1 flex-col rounded-2xl border border-black/8 bg-[#fbf8f2] p-5">
            <div className="flex flex-col gap-3 sm:flex-row mb-4">
              <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search books..."
                className="h-11 flex-1 rounded-2xl border border-black/10 bg-white px-4 text-sm outline-none focus:border-black/20" />
              <div className="relative">
                <select value={selectedGenre} onChange={(e) => setSelectedGenre(e.target.value)}
                  className="h-11 appearance-none rounded-2xl border border-black/10 bg-white pl-4 pr-10 text-sm outline-none focus:border-black/20">
                  <option value="">All genres</option>
                  {genres.map((g: Genre) => <option key={g.id} value={g.slug}>{g.name}</option>)}
                </select>
                <ChevronDown size={15} className="pointer-events-none absolute right-3 top-3.5 text-text-muted" />
              </div>
            </div>

            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
              {isLoading ? Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-28 animate-pulse rounded-2xl bg-white" />) : (
                books.map((book) => {
                  const images = (book as any).images ?? [];
                  return (
                    <article key={book.id} className="rounded-2xl border border-black/8 bg-white p-4">
                      <div className="grid gap-3 sm:grid-cols-[auto_minmax(0,1fr)_auto]">
                        {/* Image strip */}
                        <div className="flex gap-1.5">
                          {/* Cover image */}
                          <div className="relative">
                            <img src={book.coverImageUrl} alt={book.title} className="h-20 w-14 rounded-xl object-cover" />
                            <div className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#1d1a17]">
                              <Star size={8} className="fill-amber-400 text-amber-400" />
                            </div>
                          </div>
                          {/* Extra images preview */}
                          {images.slice(1, 3).map((img: BookImage) => (
                            <img key={img.id} src={img.imageUrl} alt="" className="h-20 w-14 rounded-xl object-cover opacity-70" />
                          ))}
                          {images.length > 3 && (
                            <div className="flex h-20 w-14 items-center justify-center rounded-xl bg-[#f4efe7] text-xs font-bold text-text-muted">
                              +{images.length - 3}
                            </div>
                          )}
                        </div>

                        <div className="min-w-0">
                          <p className="font-serif text-lg text-text-primary truncate">{book.title}</p>
                          <p className="mt-0.5 text-sm text-text-muted">{book.author} · {book.genre?.name ?? "—"}</p>
                          <div className="mt-1.5 flex flex-wrap gap-2 text-sm">
                            <span className="font-medium text-[#8f2d22]">{fmt(Number(book.price))}</span>
                            {(book as any).comparePrice && <span className="text-text-muted line-through text-xs">{fmt(Number((book as any).comparePrice))}</span>}
                            <span className="text-text-muted text-xs">Stock: {book.stock}</span>
                          </div>
                          <p className="mt-1 text-xs text-text-muted">
                            {images.length > 0 ? `${images.length} image${images.length > 1 ? "s" : ""}` : "1 image (cover only)"}
                          </p>
                        </div>

                        <div className="flex flex-col gap-2 shrink-0">
                          <button type="button" onClick={() => handleEdit(book)}
                            className="inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-[#f8f4ee] px-3 py-2 text-xs text-text-primary hover:-translate-y-0.5 transition-all">
                            <Pencil size={12} /> Edit
                          </button>
                          <button type="button" onClick={() => {
                              // Refetch books to get latest images
                              void queryClient.invalidateQueries({ queryKey: ["admin-books"] });
                              setManagingImagesBook(book);
                            }}
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
                })
              )}
            </div>
          </div>
        </section>

        {/* Book Form */}
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

          {formError && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{formError}</div>}

          <div className="space-y-3">
            <input value={form.title} onChange={(e) => setForm((c) => ({ ...c, title: e.target.value }))} placeholder="Title *" className={inp} />
            <input value={form.author} onChange={(e) => setForm((c) => ({ ...c, author: e.target.value }))} placeholder="Author *" className={inp} />
            <input value={form.isbn} onChange={(e) => setForm((c) => ({ ...c, isbn: e.target.value }))} placeholder="ISBN *" className={inp} />
            <textarea value={form.description} onChange={(e) => setForm((c) => ({ ...c, description: e.target.value }))} placeholder="Description" rows={3}
              className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none focus:border-black/20" />

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs text-text-muted">Sale Price (₹) *</label>
                <input value={form.price} onChange={(e) => setForm((c) => ({ ...c, price: e.target.value }))} placeholder="e.g. 299" className={inp} />
              </div>
              <div>
                <label className="mb-1 block text-xs text-text-muted">Compare Price (₹)</label>
                <input value={form.comparePrice} onChange={(e) => setForm((c) => ({ ...c, comparePrice: e.target.value }))} placeholder="e.g. 399" className={inp} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <input value={form.stock} onChange={(e) => setForm((c) => ({ ...c, stock: e.target.value }))} placeholder="Stock *" className={inp} />
              <select value={form.genreId} onChange={(e) => setForm((c) => ({ ...c, genreId: e.target.value }))}
                className="h-11 w-full rounded-2xl border border-black/10 bg-white px-4 text-sm outline-none focus:border-black/20">
                <option value="">Genre *</option>
                {genres.map((g: Genre) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </div>

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

            {/* Cover Image */}
            <div className="rounded-xl border border-black/10 bg-white p-3">
              <label className="mb-1.5 block text-xs font-medium text-text-muted">
                Cover Image {!editingBook && "*"}
                {editingBook && <span className="ml-1 font-normal opacity-60">— leave empty to keep current</span>}
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
                <input type="file" accept="image/*" onChange={(e) => setForm((c) => ({ ...c, coverImage: e.target.files?.[0] ?? null }))}
                  className="block w-full text-sm text-text-muted file:mr-3 file:rounded-full file:border-0 file:bg-[#f4efe7] file:px-3 file:py-1.5 file:text-xs file:text-text-primary" />
              )}
            </div>

            {editingBook && (
              <div className="rounded-xl border border-black/10 bg-white p-3 space-y-2">
                <p className="text-xs font-medium text-text-muted">Current Images</p>
                <div className="flex flex-wrap gap-2">
                  {/* Cover image */}
                  <div className="relative">
                    <img src={editingBook.coverImageUrl} alt="cover" className="h-16 w-12 rounded-lg object-cover border-2 border-[#1d1a17]" />
                    <span className="absolute -top-1 -right-1 rounded-full bg-[#1d1a17] px-1 py-0.5 text-[8px] font-bold text-white">COVER</span>
                  </div>
                  {/* Extra images */}
                  {((editingBook as any).images ?? [])
                    .sort((a: any, b: any) => a.order - b.order)
                    .filter((img: any) => img.imageUrl !== editingBook.coverImageUrl)
                    .map((img: any, i: number) => (
                      <img key={img.id} src={img.imageUrl} alt={`img ${i+2}`} className="h-16 w-12 rounded-lg object-cover border border-black/10" />
                    ))
                  }
                </div>
                <button type="button" onClick={() => setManagingImagesBook(editingBook)}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-blue-200 bg-blue-50 py-2 text-xs text-blue-700 hover:bg-blue-100 transition-all">
                  <ImagePlus size={13} /> Add / Manage Images
                </button>
              </div>
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
