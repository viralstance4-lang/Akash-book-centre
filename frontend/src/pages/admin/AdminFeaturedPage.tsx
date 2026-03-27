import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { getFeaturedBooks, addFeaturedBook, removeFeaturedBook } from "../../api/featured.api";
import { getBooks } from "../../api/books.api";

export default function AdminFeaturedPage() {
  const queryClient = useQueryClient();
  const [selectedBookId, setSelectedBookId] = useState("");

  const { data: featuredData, isLoading } = useQuery({ queryKey: ["featured-books"], queryFn: getFeaturedBooks });
  const { data: allBooksData } = useQuery({ queryKey: ["books", { page: 1, limit: 200 }], queryFn: () => getBooks({ page: 1, limit: 200 }) });

  const addMutation = useMutation({
    mutationFn: ({ bookId, order }: { bookId: string; order: number }) => addFeaturedBook(bookId, order),
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ["featured-books"] }); setSelectedBookId(""); },
  });

  const removeMutation = useMutation({
    mutationFn: removeFeaturedBook,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["featured-books"] }),
  });

  const featured = (featuredData?.data ?? []) as any[];
  const allBooks = allBooksData?.data?.books ?? [];
  const featuredIds = new Set(featured.map((b: any) => b.id));
  const availableBooks = allBooks.filter((b) => !featuredIds.has(b.id));

  const formatPrice = (v: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(v);

  if (isLoading) return <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-20 animate-pulse rounded-2xl bg-white" />)}</div>;

  return (
    <div className="h-full overflow-y-auto space-y-5 pr-1">
      <div>
        <p className="text-[0.72rem] uppercase tracking-[0.28em] text-text-muted">Manage</p>
        <h2 className="font-serif text-2xl text-text-primary">Featured Section</h2>
        <p className="mt-1 text-sm text-text-muted">Select which books appear in the Featured Books section on the homepage.</p>
      </div>

      {/* Add Book */}
      <div className="rounded-2xl border border-black/8 bg-white p-4">
        <p className="mb-3 text-sm font-medium text-text-primary">Add book to featured</p>
        <div className="flex gap-3">
          <select value={selectedBookId} onChange={(e) => setSelectedBookId(e.target.value)}
            className="flex-1 rounded-xl border border-black/10 bg-[#f8f4ee] px-4 py-2.5 text-sm outline-none focus:bg-white">
            <option value="">Select a book...</option>
            {availableBooks.map((book) => (
              <option key={book.id} value={book.id}>{book.title} — {book.author}</option>
            ))}
          </select>
          <button type="button" onClick={() => { if (selectedBookId) addMutation.mutate({ bookId: selectedBookId, order: featured.length }); }}
            disabled={!selectedBookId || addMutation.isPending}
            className="inline-flex items-center gap-2 rounded-xl bg-[#1d1a17] px-4 py-2.5 text-sm text-white hover:bg-black disabled:opacity-50 transition-all">
            <Plus size={15} /> Add
          </button>
        </div>
      </div>

      {/* Featured Books List */}
      {featured.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-black/10 bg-white px-6 py-12 text-center">
          <p className="font-serif text-xl text-text-primary">No featured books yet</p>
          <p className="mt-2 text-sm text-text-muted">Add books above to feature them on the homepage.</p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs font-medium uppercase tracking-widest text-text-muted">{featured.length} featured books</p>
          {featured.map((book: any, index: number) => (
            <div key={book.id} className="flex items-center gap-3 rounded-2xl border border-black/8 bg-white p-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#f4efe7] text-xs font-bold text-text-muted">{index + 1}</span>
              <img src={book.coverImageUrl} alt={book.title} className="h-14 w-10 rounded-lg object-cover bg-[#f4efe7]" />
              <div className="flex-1 min-w-0">
                <p className="truncate font-medium text-sm text-text-primary">{book.title}</p>
                <p className="text-xs text-text-muted">{book.author}</p>
                <p className="text-xs font-medium text-[#8f2d22]">{formatPrice(Number(book.price))}</p>
              </div>
              <button type="button" onClick={() => removeMutation.mutate(book.id)} disabled={removeMutation.isPending}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-red-100 text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors disabled:opacity-50">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
