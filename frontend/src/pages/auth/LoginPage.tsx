import { useState } from "react";
import SiteLogo from "../../components/ui/SiteLogo";
import { useMutation } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";

import { login } from "../../api/auth.api";
import authBackground from "../../assets/bg-loginpage.jpg";
import { useAuthStore } from "../../store/auth.store";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);

  const mutation = useMutation({
    mutationFn: () => login(email, password),
    onSuccess: (data) => {
      setAuth(data.data.user, data.data.accessToken);
      navigate("/");
    },
    onError: (error: any) => {
      setErrorMsg(
        error.response?.data?.message || "Failed to sign in. Please try again.",
      );
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (!email || !password) {
      setErrorMsg("Please enter both email and password.");
      return;
    }

    mutation.mutate();
  };

  return (
    <div className="min-h-screen bg-[#f4efe7] p-4 md:p-6">
      <div className="mx-auto grid min-h-[calc(100vh-2rem)] max-w-7xl overflow-hidden rounded-4xl border border-black/10 bg-[#fbf8f2] shadow-[0_24px_80px_rgba(70,52,36,0.12)] lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] md:min-h-[calc(100vh-3rem)]">
        <section className="flex items-center justify-center px-6 py-12 sm:px-10 lg:px-14 lg:py-16">
          <div className="w-full max-w-md">
            <div className="mb-6"><SiteLogo size="lg" /></div>
            <p className="mb-4 font-sans text-xs uppercase tracking-widest text-text-muted">
              Bookstore Journal
            </p>
            <h1 className="font-serif text-4xl leading-tight tracking-tight text-text-primary sm:text-5xl">
              Welcome back
            </h1>
            <p className="mt-4 max-w-sm text-sm leading-6 text-text-muted sm:text-base">
              Return to your reading list, your orders, and the next book you
              have been meaning to pick up.
            </p>

            <form onSubmit={handleSubmit} className="mt-10 space-y-6 font-sans">
              {errorMsg && (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                  {errorMsg}
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label
                    htmlFor="email"
                    className="mb-2 block text-xs uppercase tracking-[0.24em] text-text-muted"
                  >
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3.5 text-text-primary outline-none transition-all duration-200 placeholder:text-text-muted/70 focus:-translate-y-0.5 focus:border-black/25 focus:shadow-[0_12px_30px_rgba(70,52,36,0.08)]"
                    disabled={mutation.isPending}
                  />
                </div>

                <div>
                  <label
                    htmlFor="password"
                    className="mb-2 block text-xs uppercase tracking-[0.24em] text-text-muted"
                  >
                    Password
                  </label>
                  <input
                    id="password"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3.5 text-text-primary outline-none transition-all duration-200 placeholder:text-text-muted/70 focus:-translate-y-0.5 focus:border-black/25 focus:shadow-[0_12px_30px_rgba(70,52,36,0.08)]"
                    disabled={mutation.isPending}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={mutation.isPending}
                className="inline-flex w-full items-center justify-center rounded-full bg-text-primary px-5 py-3.5 text-sm font-medium tracking-wide text-white transition-all duration-200 hover:-translate-y-0.5 hover:bg-black hover:shadow-lg disabled:translate-y-0 disabled:opacity-70 disabled:shadow-none"
              >
                {mutation.isPending ? "Signing in..." : "Sign in"}
              </button>

              <p className="text-sm text-text-muted">
                Don&apos;t have an account?{" "}
                <Link
                  to="/register"
                  className="font-medium text-text-primary underline decoration-black/20 underline-offset-4 transition-colors hover:text-black"
                >
                  Create one
                </Link>
              </p>
            </form>
          </div>
        </section>

        <section className="relative hidden min-h-112 overflow-hidden lg:flex">
          <img
            src={authBackground}
            alt="Stacked books on a shelf"
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(18,17,15,0.15),rgba(18,17,15,0.75))]" />
          <div className="relative flex w-full flex-col justify-between p-10 text-white xl:p-14">
            <div className="max-w-sm self-end rounded-2xl bg-black/40 p-6">
              <p className="font-sans text-xs uppercase tracking-widest text-white/70">
                Editorial Pick
              </p>
              <p className="mt-3 font-serif text-3xl leading-tight tracking-tight">
                Quiet pages,
                <br />
                lasting rituals.
              </p>
            </div>

            <div className="max-w-md">
              <p className="font-sans text-xs uppercase tracking-widest text-white/70">
                Minimal Reading Life
              </p>
              <p className="mt-4 font-serif text-4xl leading-tight tracking-tight xl:text-5xl">
                A calmer shelf starts with a better bookstore.
              </p>
              <p className="mt-5 max-w-md text-sm leading-6 text-white/80 xl:text-base">
                Discover books with a storefront that feels more like a journal
                than a dashboard.
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
