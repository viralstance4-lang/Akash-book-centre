import { useState } from "react";
import SiteLogo from "../../components/ui/SiteLogo";
import { useMutation } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, CheckCircle, Loader2, Mail } from "lucide-react";

import { login, requestOtp, verifyOtp } from "../../api/auth.api";
import authBackground from "../../assets/bg-loginpage.jpg";
import { useAuthStore } from "../../store/auth.store";

type LoginMode = "password" | "otp-request" | "otp-verify";

export default function LoginPage() {
  const navigate = useNavigate();
  const setAuth  = useAuthStore((s) => s.setAuth);

  // ── Shared state ──────────────────────────────────────────────────────────
  const [mode,     setMode]     = useState<LoginMode>("password");
  const [errorMsg, setErrorMsg] = useState("");

  // ── Password login state ──────────────────────────────────────────────────
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");

  // ── OTP state ─────────────────────────────────────────────────────────────
  const [otpTarget,    setOtpTarget]    = useState("");
  const [otpCode,      setOtpCode]      = useState("");
  const [otpExpiry,    setOtpExpiry]    = useState<number | null>(null);
  /** Countdown seconds remaining */
  const [cooldown,     setCooldown]     = useState(0);

  // ── Password login mutation ───────────────────────────────────────────────
  const passwordMut = useMutation({
    mutationFn: () => login(email, password),
    onSuccess:  (data) => { setAuth(data.data.user, data.data.accessToken); navigate("/"); },
    onError: (e: any) => {
      if (e.response?.data?.code === "EMAIL_NOT_VERIFIED") {
        navigate(`/verify-email?email=${encodeURIComponent(email)}`);
        return;
      }
      setErrorMsg(e.response?.data?.message ?? "Failed to sign in.");
    },
  });

  // ── OTP request mutation ──────────────────────────────────────────────────
  const otpRequestMut = useMutation({
    mutationFn: () => requestOtp(otpTarget),
    onSuccess:  (data) => {
      setOtpExpiry(data.data.expiresInMinutes);
      setMode("otp-verify");
      setErrorMsg("");
      // 60-second resend cooldown
      let s = 60;
      setCooldown(s);
      const t = setInterval(() => { s -= 1; setCooldown(s); if (s <= 0) clearInterval(t); }, 1000);
    },
    onError: (e: any) => setErrorMsg(e.response?.data?.message ?? "Failed to send OTP."),
  });

  // ── OTP verify mutation ───────────────────────────────────────────────────
  const otpVerifyMut = useMutation({
    mutationFn: () => verifyOtp(otpTarget, otpCode),
    onSuccess:  (data) => { setAuth(data.data.user, data.data.accessToken); navigate("/"); },
    onError:    (e: any) => setErrorMsg(e.response?.data?.message ?? "Invalid OTP. Please try again."),
  });

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    if (!email || !password) { setErrorMsg("Please enter both email and password."); return; }
    passwordMut.mutate();
  };

  const handleOtpRequest = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    if (!otpTarget) { setErrorMsg("Please enter your email."); return; }
    otpRequestMut.mutate();
  };

  const handleOtpVerify = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    if (otpCode.length !== 6) { setErrorMsg("Please enter the 6-digit OTP."); return; }
    otpVerifyMut.mutate();
  };

  const resetToPassword = () => {
    setMode("password"); setErrorMsg(""); setOtpCode(""); setOtpTarget("");
  };

  const isPending = passwordMut.isPending || otpRequestMut.isPending || otpVerifyMut.isPending;

  return (
    <div className="min-h-screen bg-[#f4efe7] p-4 md:p-6">
      <div className="mx-auto grid min-h-[calc(100vh-2rem)] max-w-7xl overflow-hidden rounded-4xl border border-black/10 bg-[#fbf8f2] shadow-[0_24px_80px_rgba(70,52,36,0.12)] lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] md:min-h-[calc(100vh-3rem)]">

        {/* ── Left: Form ───────────────────────────────────────────────────── */}
        <section className="flex items-center justify-center px-6 py-12 sm:px-10 lg:px-14 lg:py-16">
          <div className="w-full max-w-md">
            <div className="mb-6"><SiteLogo size="lg" /></div>
            <p className="mb-4 font-sans text-xs uppercase tracking-widest text-text-muted">Bookstore Journal</p>
            <h1 className="font-serif text-4xl leading-tight tracking-tight text-text-primary sm:text-5xl">
              Welcome back
            </h1>
            <p className="mt-4 max-w-sm text-sm leading-6 text-text-muted sm:text-base">
              Return to your reading list, your orders, and the next book you've been meaning to pick up.
            </p>

            {/* ── Mode toggle ──────────────────────────────────────────────── */}
            <div className="mt-8 flex gap-2 rounded-2xl border border-black/8 bg-[#f8f4ee] p-1">
              <button
                type="button"
                onClick={() => { setMode("password"); setErrorMsg(""); }}
                className={`flex-1 rounded-xl py-2 text-xs font-medium transition-colors ${mode === "password" ? "bg-white text-text-primary shadow-sm" : "text-text-muted hover:text-text-primary"}`}
              >
                Password Login
              </button>
              <button
                type="button"
                onClick={() => { setMode("otp-request"); setErrorMsg(""); }}
                className={`flex-1 rounded-xl py-2 text-xs font-medium transition-colors ${mode !== "password" ? "bg-white text-text-primary shadow-sm" : "text-text-muted hover:text-text-primary"}`}
              >
                OTP Login
              </button>
            </div>

            {/* ── Error message ─────────────────────────────────────────────── */}
            {errorMsg && (
              <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                {errorMsg}
              </div>
            )}

            {/* ── PASSWORD LOGIN ────────────────────────────────────────────── */}
            {mode === "password" && (
              <form onSubmit={handlePasswordSubmit} className="mt-6 space-y-5 font-sans">
                <div>
                  <label htmlFor="email" className="mb-2 block text-xs uppercase tracking-[0.24em] text-text-muted">Email</label>
                  <input id="email" type="email" required value={email}
                    onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com"
                    disabled={isPending}
                    className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3.5 text-text-primary outline-none transition-all placeholder:text-text-muted/70 focus:-translate-y-0.5 focus:border-black/25 focus:shadow-[0_12px_30px_rgba(70,52,36,0.08)]"
                  />
                </div>
                <div>
                  <label htmlFor="password" className="mb-2 block text-xs uppercase tracking-[0.24em] text-text-muted">Password</label>
                  <input id="password" type="password" required value={password}
                    onChange={(e) => setPassword(e.target.value)} placeholder="Enter your password"
                    disabled={isPending}
                    className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3.5 text-text-primary outline-none transition-all placeholder:text-text-muted/70 focus:-translate-y-0.5 focus:border-black/25 focus:shadow-[0_12px_30px_rgba(70,52,36,0.08)]"
                  />
                </div>
                <button type="submit" disabled={isPending}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-text-primary px-5 py-3.5 text-sm font-medium tracking-wide text-white transition-all hover:-translate-y-0.5 hover:bg-black hover:shadow-lg disabled:translate-y-0 disabled:opacity-70">
                  {isPending ? <><Loader2 size={15} className="animate-spin" />Signing in…</> : "Sign in"}
                </button>
                <p className="text-sm text-text-muted">
                  Don't have an account?{" "}
                  <Link to="/register" className="font-medium text-text-primary underline decoration-black/20 underline-offset-4 hover:text-black">
                    Create one
                  </Link>
                </p>
              </form>
            )}

            {/* ── OTP REQUEST ───────────────────────────────────────────────── */}
            {mode === "otp-request" && (
              <form onSubmit={handleOtpRequest} className="mt-6 space-y-5 font-sans">
                <div>
                  <label htmlFor="otp-email" className="mb-2 block text-xs uppercase tracking-[0.24em] text-text-muted">Your Email</label>
                  <div className="relative">
                    <Mail size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-text-muted" />
                    <input id="otp-email" type="email" required value={otpTarget}
                      onChange={(e) => setOtpTarget(e.target.value)} placeholder="you@example.com"
                      disabled={isPending}
                      className="w-full rounded-2xl border border-black/10 bg-white pl-11 pr-4 py-3.5 text-text-primary outline-none transition-all placeholder:text-text-muted/70 focus:-translate-y-0.5 focus:border-black/25"
                    />
                  </div>
                  <p className="mt-2 text-xs text-text-muted">We'll send a 6-digit code to this address. Valid for 10 minutes.</p>
                </div>
                <button type="submit" disabled={isPending}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-text-primary px-5 py-3.5 text-sm font-medium text-white transition-all hover:-translate-y-0.5 hover:bg-black disabled:opacity-70">
                  {isPending ? <><Loader2 size={15} className="animate-spin" />Sending OTP…</> : "Send OTP"}
                </button>
              </form>
            )}

            {/* ── OTP VERIFY ────────────────────────────────────────────────── */}
            {mode === "otp-verify" && (
              <form onSubmit={handleOtpVerify} className="mt-6 space-y-5 font-sans">
                {/* Sent-to banner */}
                <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                  <CheckCircle size={16} className="shrink-0 text-emerald-500" />
                  <div>
                    <p className="text-sm font-medium text-emerald-700">OTP sent!</p>
                    <p className="text-xs text-emerald-600">Check {otpTarget} · valid {otpExpiry} min</p>
                  </div>
                </div>

                <div>
                  <label htmlFor="otp-code" className="mb-2 block text-xs uppercase tracking-[0.24em] text-text-muted">Enter 6-digit OTP</label>
                  <input
                    id="otp-code"
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="• • • • • •"
                    disabled={isPending}
                    className="w-full rounded-2xl border border-black/10 bg-white px-4 py-4 text-center text-2xl font-bold tracking-[0.5em] text-text-primary outline-none transition-all placeholder:tracking-widest placeholder:text-text-muted/40 focus:-translate-y-0.5 focus:border-black/25"
                  />
                </div>

                <button type="submit" disabled={isPending || otpCode.length < 6}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-text-primary px-5 py-3.5 text-sm font-medium text-white transition-all hover:-translate-y-0.5 hover:bg-black disabled:opacity-70">
                  {isPending ? <><Loader2 size={15} className="animate-spin" />Verifying…</> : "Verify & Sign In"}
                </button>

                <div className="flex items-center justify-between text-sm">
                  <button type="button" onClick={resetToPassword}
                    className="inline-flex items-center gap-1 text-text-muted hover:text-text-primary transition-colors">
                    <ArrowLeft size={13} /> Back to login
                  </button>
                  <button
                    type="button"
                    disabled={cooldown > 0 || isPending}
                    onClick={() => { setErrorMsg(""); otpRequestMut.mutate(); }}
                    className="text-text-muted hover:text-text-primary transition-colors disabled:opacity-40"
                  >
                    {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend OTP"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </section>

        {/* ── Right: Image ─────────────────────────────────────────────────── */}
        <section className="relative hidden min-h-112 overflow-hidden lg:flex">
          <img src={authBackground} alt="Books" className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(18,17,15,0.15),rgba(18,17,15,0.75))]" />
          <div className="relative flex w-full flex-col justify-between p-10 text-white xl:p-14">
            <div className="max-w-sm self-end rounded-2xl bg-black/40 p-6">
              <p className="font-sans text-xs uppercase tracking-widest text-white/70">Editorial Pick</p>
              <p className="mt-3 font-serif text-3xl leading-tight tracking-tight">Quiet pages,<br />lasting rituals.</p>
            </div>
            <div className="max-w-md">
              <p className="font-sans text-xs uppercase tracking-widest text-white/70">Minimal Reading Life</p>
              <p className="mt-4 font-serif text-4xl leading-tight tracking-tight xl:text-5xl">
                A calmer shelf starts with a better bookstore.
              </p>
              <p className="mt-5 max-w-md text-sm leading-6 text-white/80 xl:text-base">
                Discover books with a storefront that feels more like a journal than a dashboard.
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
