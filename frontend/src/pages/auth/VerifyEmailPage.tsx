import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, CheckCircle, Loader2, Mail } from "lucide-react";

import SiteLogo from "../../components/ui/SiteLogo";
import { verifyEmailOtp, resendVerificationOtp } from "../../api/auth.api";
import { useAuthStore } from "../../store/auth.store";
import authBackground from "../../assets/bg-loginpage.jpg";

export default function VerifyEmailPage() {
  const navigate      = useNavigate();
  const [params]      = useSearchParams();
  const setAuth       = useAuthStore((s) => s.setAuth);

  const emailFromUrl  = params.get("email") ?? "";
  const [code,        setCode]        = useState("");
  const [errorMsg,    setErrorMsg]    = useState("");
  const [successMsg,  setSuccessMsg]  = useState("");
  const [cooldown,    setCooldown]    = useState(0);

  // Start resend cooldown on mount so user can't spam immediately
  useEffect(() => {
    let s = 30;
    setCooldown(s);
    const t = setInterval(() => { s -= 1; setCooldown(s); if (s <= 0) clearInterval(t); }, 1000);
    return () => clearInterval(t);
  }, []);

  const verifyMut = useMutation({
    mutationFn: () => verifyEmailOtp(emailFromUrl, code),
    onSuccess: (data) => {
      setAuth(data.data.user, data.data.accessToken);
      navigate("/");
    },
    onError: (e: any) => setErrorMsg(e.response?.data?.message ?? "Invalid or expired code. Please try again."),
  });

  const resendMut = useMutation({
    mutationFn: () => resendVerificationOtp(emailFromUrl),
    onSuccess: (data) => {
      setErrorMsg("");
      setSuccessMsg(`New code sent! Valid for ${data.data.expiresInMinutes} minutes.`);
      let s = 60;
      setCooldown(s);
      const t = setInterval(() => { s -= 1; setCooldown(s); if (s <= 0) clearInterval(t); }, 1000);
    },
    onError: (e: any) => setErrorMsg(e.response?.data?.message ?? "Failed to resend code."),
  });

  const handleVerify = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");
    if (code.length !== 6) { setErrorMsg("Please enter the 6-digit verification code."); return; }
    verifyMut.mutate();
  };

  const isPending = verifyMut.isPending || resendMut.isPending;

  if (!emailFromUrl) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f4efe7] p-6">
        <div className="text-center">
          <p className="text-text-muted">No email address provided.</p>
          <Link to="/register" className="mt-4 inline-block text-sm font-medium text-text-primary underline">
            Go to registration
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f4efe7] p-4 md:p-6">
      <div className="mx-auto grid min-h-[calc(100vh-2rem)] max-w-7xl overflow-hidden rounded-4xl border border-black/10 bg-[#fbf8f2] shadow-[0_24px_80px_rgba(70,52,36,0.12)] lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] md:min-h-[calc(100vh-3rem)]">

        {/* ── Left: Form ───────────────────────────────────────────────────── */}
        <section className="flex items-center justify-center px-6 py-12 sm:px-10 lg:px-14 lg:py-16">
          <div className="w-full max-w-md">
            <div className="mb-6"><SiteLogo size="lg" /></div>
            <p className="mb-4 font-sans text-xs uppercase tracking-widest text-text-muted">Account Verification</p>
            <h1 className="font-serif text-4xl leading-tight tracking-tight text-text-primary sm:text-5xl">
              Check your inbox
            </h1>
            <p className="mt-4 max-w-sm text-sm leading-6 text-text-muted sm:text-base">
              We sent a 6-digit verification code to activate your account.
            </p>

            {/* Email banner */}
            <div className="mt-8 flex items-center gap-3 rounded-2xl border border-black/8 bg-[#f8f4ee] px-4 py-3">
              <Mail size={16} className="shrink-0 text-text-muted" />
              <span className="truncate text-sm font-medium text-text-primary">{emailFromUrl}</span>
            </div>

            {/* Error / success messages */}
            {errorMsg && (
              <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                {errorMsg}
              </div>
            )}
            {successMsg && (
              <div className="mt-5 flex items-start gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                <CheckCircle size={15} className="mt-0.5 shrink-0" />
                {successMsg}
              </div>
            )}

            <form onSubmit={handleVerify} className="mt-6 space-y-5 font-sans">
              <div>
                <label htmlFor="otp-code" className="mb-2 block text-xs uppercase tracking-[0.24em] text-text-muted">
                  Verification Code
                </label>
                <input
                  id="otp-code"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="• • • • • •"
                  disabled={isPending}
                  className="w-full rounded-2xl border border-black/10 bg-white px-4 py-4 text-center text-2xl font-bold tracking-[0.5em] text-text-primary outline-none transition-all placeholder:tracking-widest placeholder:text-text-muted/40 focus:-translate-y-0.5 focus:border-black/25 focus:shadow-[0_12px_30px_rgba(70,52,36,0.08)]"
                />
                <p className="mt-2 text-xs text-text-muted">Valid for 10 minutes. Check spam if not received.</p>
              </div>

              <button
                type="submit"
                disabled={isPending || code.length < 6}
                className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-text-primary px-5 py-3.5 text-sm font-medium tracking-wide text-white transition-all hover:-translate-y-0.5 hover:bg-black hover:shadow-lg disabled:translate-y-0 disabled:opacity-70"
              >
                {verifyMut.isPending ? <><Loader2 size={15} className="animate-spin" />Verifying…</> : "Verify & Sign In"}
              </button>

              <div className="flex items-center justify-between text-sm">
                <Link
                  to="/register"
                  className="inline-flex items-center gap-1 text-text-muted transition-colors hover:text-text-primary"
                >
                  <ArrowLeft size={13} /> Back to registration
                </Link>
                <button
                  type="button"
                  disabled={cooldown > 0 || isPending}
                  onClick={() => { setErrorMsg(""); setSuccessMsg(""); resendMut.mutate(); }}
                  className="text-text-muted transition-colors hover:text-text-primary disabled:opacity-40"
                >
                  {resendMut.isPending
                    ? <><Loader2 size={13} className="inline animate-spin mr-1" />Sending…</>
                    : cooldown > 0
                    ? `Resend in ${cooldown}s`
                    : "Resend code"
                  }
                </button>
              </div>
            </form>
          </div>
        </section>

        {/* ── Right: Image ─────────────────────────────────────────────────── */}
        <section className="relative hidden min-h-112 overflow-hidden lg:flex">
          <img src={authBackground} alt="Books" className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(18,17,15,0.15),rgba(18,17,15,0.75))]" />
          <div className="relative flex w-full flex-col justify-between p-10 text-white xl:p-14">
            <div className="max-w-sm self-end rounded-2xl bg-black/40 p-6">
              <p className="font-sans text-xs uppercase tracking-widest text-white/70">One Last Step</p>
              <p className="mt-3 font-serif text-3xl leading-tight tracking-tight">
                Confirm your email,<br />start your shelf.
              </p>
            </div>
            <div className="max-w-md">
              <p className="font-sans text-xs uppercase tracking-widest text-white/70">Secure Account</p>
              <p className="mt-4 font-serif text-4xl leading-tight tracking-tight xl:text-5xl">
                Your reading journey begins here.
              </p>
              <p className="mt-5 max-w-md text-sm leading-6 text-white/80 xl:text-base">
                One verification code keeps your account safe and your orders protected.
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
