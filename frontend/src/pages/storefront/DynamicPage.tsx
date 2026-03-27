import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { getPage } from "../../api/pages.api";

export default function DynamicPage() {
  const { slug } = useParams<{ slug: string }>();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["page", slug],
    queryFn: () => getPage(slug!),
    enabled: Boolean(slug),
  });

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 animate-pulse">
        <div className="h-8 w-1/2 rounded-xl bg-white" />
        <div className="h-4 w-full rounded-xl bg-white" />
        <div className="h-4 w-3/4 rounded-xl bg-white" />
        <div className="h-4 w-5/6 rounded-xl bg-white" />
      </div>
    );
  }

  if (isError || !data?.data) {
    return (
      <div className="rounded-2xl border border-dashed border-black/10 bg-white px-8 py-16 text-center">
        <p className="font-serif text-2xl text-text-primary">Page not found</p>
        <Link to="/" className="mt-5 inline-flex items-center gap-2 rounded-full bg-[#1d1a17] px-5 py-2.5 text-sm text-white hover:bg-black transition-all">
          <ArrowLeft size={14} /> Back to home
        </Link>
      </div>
    );
  }

  const page = data.data;

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-8">
      <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-text-primary transition-colors">
        <ArrowLeft size={14} /> Back
      </Link>
      <div className="rounded-2xl border border-black/8 bg-white p-6 sm:p-8">
        <h1 className="font-serif text-3xl text-text-primary">{page.title}</h1>
        <p className="mt-1 text-xs text-text-muted">Last updated {new Date(page.updatedAt).toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" })}</p>
        <div className="mt-6 border-t border-black/8 pt-6">
          <div
            className="prose prose-sm max-w-none text-text-muted leading-7"
            dangerouslySetInnerHTML={{ __html: page.content }}
          />
        </div>
      </div>
    </div>
  );
}
