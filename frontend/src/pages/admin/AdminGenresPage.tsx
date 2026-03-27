import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AxiosError } from "axios";
import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";

import { createGenre, deleteGenre, getGenres } from "../../api/admin.api";
import type { ApiErrorResponse } from "../../types";

export default function AdminGenresPage() {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["genres"],
    queryFn: getGenres,
  });

  const createMutation = useMutation({
    mutationFn: () => createGenre(name),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["genres"] });
      setName("");
      setError("");
    },
    onError: (mutationError) => {
      const apiError = mutationError as AxiosError<ApiErrorResponse>;
      setError(apiError.response?.data?.message ?? "Unable to create genre.");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteGenre(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["genres"] });
      setError("");
    },
    onError: (mutationError) => {
      const apiError = mutationError as AxiosError<ApiErrorResponse>;
      setError(apiError.response?.data?.message ?? "Unable to delete genre.");
    },
  });

  const genres = data?.data ?? [];

  return (
    <div className="grid gap-6 xl:grid-cols-[24rem_minmax(0,1fr)]">
      <aside className="h-fit rounded-[1.75rem] border border-black/8 bg-[#fbf8f2] p-6">
        <p className="text-[0.68rem] uppercase tracking-[0.22em] text-text-muted">
          Create genre
        </p>
        <h2 className="mt-2 font-serif text-3xl text-text-primary">
          New category
        </h2>
        <input
          value={name}
          onChange={(event) => {
            setName(event.target.value);
            setError("");
          }}
          placeholder="Genre name"
          className="mt-5 h-12 w-full rounded-2xl border border-black/10 bg-white px-4 text-sm outline-none transition-all focus:border-black/20 focus:shadow-sm"
        />

        {error ? (
          <div className="mt-4 rounded-2xl border border-[#8f2d22]/15 bg-[#f8ece8] px-4 py-3 text-sm text-[#8f2d22]">
            {error}
          </div>
        ) : null}

        <button
          type="button"
          onClick={() => createMutation.mutate()}
          disabled={createMutation.isPending || !name.trim()}
          className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#1d1a17] px-4 py-3 text-sm text-white disabled:opacity-60"
        >
          <Plus size={16} />
          {createMutation.isPending ? "Creating..." : "Add genre"}
        </button>
      </aside>

      <section className="rounded-[1.75rem] border border-black/8 bg-[#fbf8f2] p-5">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {isLoading
            ? Array.from({ length: 6 }).map((_, index) => (
                <div
                  key={index}
                  className="h-28 animate-pulse rounded-[1.25rem] bg-white"
                />
              ))
            : genres.map((genre) => (
                <article
                  key={genre.id}
                  className="rounded-[1.25rem] border border-black/8 bg-white p-4"
                >
                  <p className="font-serif text-2xl text-text-primary">
                    {genre.name}
                  </p>
                  <p className="mt-2 text-sm text-text-muted">{genre.slug}</p>
                  <button
                    type="button"
                    onClick={() => {
                      const shouldDelete = window.confirm(
                        `Delete "${genre.name}"?`,
                      );

                      if (!shouldDelete) {
                        return;
                      }

                      setError("");
                      deleteMutation.mutate(genre.id);
                    }}
                    disabled={deleteMutation.isPending}
                    className="mt-4 inline-flex items-center gap-2 rounded-full border border-[#8f2d22]/15 bg-[#f8ece8] px-3 py-2 text-sm text-[#8f2d22]"
                  >
                    <Trash2 size={14} />
                    Delete
                  </button>
                </article>
              ))}
        </div>
      </section>
    </div>
  );
}
