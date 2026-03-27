import { ArrowLeft, Package, RefreshCw, ShieldCheck, Truck } from "lucide-react";
import { Link } from "react-router-dom";

export default function ReturnsPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-8">
      <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-text-primary transition-colors">
        <ArrowLeft size={14} /> Back to store
      </Link>

      <div className="rounded-2xl border border-black/8 bg-white p-6 sm:p-8">
        <h1 className="font-serif text-3xl text-text-primary">Returns & Refunds</h1>
        <p className="mt-2 text-sm text-text-muted">We want you to be completely satisfied with your purchase.</p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {[
            { icon: RefreshCw, title: "Easy Returns", desc: "Return within 7 days of delivery for a full refund." },
            { icon: ShieldCheck, title: "Quality Guarantee", desc: "Damaged or defective books replaced at no cost." },
            { icon: Truck, title: "Free Return Shipping", desc: "We cover return shipping for eligible items." },
            { icon: Package, title: "Quick Refund", desc: "Refunds processed within 5-7 business days." },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="rounded-xl border border-black/8 p-4">
              <Icon size={20} className="text-accent mb-2" />
              <p className="font-medium text-text-primary text-sm">{title}</p>
              <p className="mt-1 text-xs text-text-muted">{desc}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 space-y-5 border-t border-black/8 pt-6">
          {[
            { q: "How to return an order?", a: "Go to My Orders → Select Order → Click 'Request Return'. Our team will contact you within 24 hours." },
            { q: "What items are eligible for return?", a: "Books in original condition, unused, with original packaging. Damaged or written-in books are not eligible." },
            { q: "When will I get my refund?", a: "After we receive and inspect the returned item, refund is processed within 5-7 business days to your original payment method." },
            { q: "What about COD orders?", a: "For COD orders, refund is issued as store credit or bank transfer." },
          ].map(({ q, a }) => (
            <div key={q}>
              <p className="font-medium text-text-primary text-sm">{q}</p>
              <p className="mt-1 text-sm text-text-muted leading-6">{a}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
