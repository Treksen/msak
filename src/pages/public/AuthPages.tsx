import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { api, errorMessage } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import type { DemoPersona } from "../../lib/types";
import { Alert, TextInput } from "../../components/ui";

function AuthShell({ title, intro, children }: { title: string; intro?: ReactNode; children: ReactNode }) {
  return (
    <div className="grid min-h-[calc(100dvh-140px)] lg:grid-cols-2">
      <div className="relative hidden lg:block">
        <img src="/photos/photo-0046.jpg" alt="" className="absolute inset-0 size-full object-cover" />
        <div className="absolute inset-x-0 bottom-0 bg-navy-900/90 p-10 text-white">
          <p className="font-serif text-3xl font-semibold leading-tight">Grounded in Truth. United in Faith.</p>
          <p className="mt-2 font-serif italic text-gold-300">Faith for campus. Purpose for life.</p>
        </div>
      </div>
      <div className="flex items-start justify-center px-5 py-10 sm:items-center sm:py-16">
        <div className="w-full max-w-md">
          <h1 className="font-serif text-3xl font-semibold text-navy-900 sm:text-4xl">{title}</h1>
          {intro && <div className="mt-2 text-[15px] leading-relaxed text-body">{intro}</div>}
          <div className="mt-8">{children}</div>
        </div>
      </div>
    </div>
  );
}

const personas: { id: DemoPersona; label: string; note: string }[] = [
  { id: "member", label: "Member", note: "JKUAT student" },
  { id: "institutional", label: "Institutional leader", note: "Posts to JKUAT" },
  { id: "regional", label: "Regional leader", note: "NAMSA · approves campus leaders" },
  { id: "national", label: "National leader", note: "Posts to all members" },
  { id: "admin", label: "Administrator", note: "Everything · invisible to members" },
];

export function LoginPage() {
  const { me } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get("next") || "/app";
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    document.title = "Log in — MSAK";
  }, []);
  useEffect(() => {
    if (me) navigate(next.startsWith("/") ? next : "/app", { replace: true });
  }, [me, navigate, next]);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    try {
      await api.signIn(String(f.get("email")), String(f.get("password")));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell
      title="Welcome back"
      intro={
        <>
          New to MSAK? <Link to="/register">Create your account</Link>.
        </>
      }
    >
      {params.get("confirmed") && (
        <div className="mb-5">
          <Alert tone="success">Your email is confirmed. Log in to open your portal.</Alert>
        </div>
      )}
      <form onSubmit={submit} className="flex flex-col gap-4">
        <TextInput label="Email" name="email" type="email" autoComplete="email" required />
        <TextInput label="Password" name="password" type="password" autoComplete="current-password" required />
        {error && <Alert tone="error">{error}</Alert>}
        <button type="submit" className="btn btn-primary w-full" disabled={busy}>
          {busy ? "Logging in…" : "Log in"}
        </button>
        <Link to="/forgot-password" className="text-center text-sm font-semibold">
          Forgot your password?
        </Link>
      </form>

      {api.mode === "demo" && (
        <div className="mt-10 rounded-lg border border-gold-500 bg-gold-50 p-5">
          <p className="font-semibold text-gold-800">Demo mode: preview as…</p>
          <p className="mb-4 mt-1 text-[13px] text-gold-800">No backend yet, so pick a role to look around. Changes stay in this browser.</p>
          <div className="grid gap-2">
            {personas.map((p) => (
              <button
                key={p.id}
                type="button"
                className="btn btn-outline justify-between"
                onClick={async () => {
                  await api.demoSignInAs?.(p.id);
                }}
              >
                <span>{p.label}</span>
                <span className="text-xs font-normal text-muted">{p.note}</span>
              </button>
            ))}
            <button type="button" className="btn btn-ghost btn-sm mt-1" onClick={() => api.demoReset?.()}>
              Reset demo data
            </button>
          </div>
        </div>
      )}
    </AuthShell>
  );
}

export function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    try {
      await api.sendPasswordReset(String(f.get("email")));
      setSent(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell title="Reset your password" intro="We'll email you a link to choose a new password.">
      {sent ? (
        <Alert tone="success">If an account exists for that email, a reset link is on its way. Check your inbox and spam folder.</Alert>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-4">
          <TextInput label="Email" name="email" type="email" autoComplete="email" required />
          {error && <Alert tone="error">{error}</Alert>}
          <button type="submit" className="btn btn-primary w-full" disabled={busy}>
            {busy ? "Sending…" : "Send reset link"}
          </button>
        </form>
      )}
      <p className="mt-6 text-center text-sm">
        <Link to="/login">Back to login</Link>
      </p>
    </AuthShell>
  );
}

export function ResetPasswordPage() {
  const { me } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const pw = String(f.get("password"));
    if (pw.length < 8) return setError("Use at least 8 characters.");
    if (pw !== String(f.get("confirm"))) return setError("The two passwords don't match.");
    setBusy(true);
    setError(null);
    try {
      await api.updatePassword(pw);
      navigate("/app", { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell title="Choose a new password">
      {me === null ? (
        <Alert tone="warn">
          This reset link has expired or was already used. <Link to="/forgot-password">Request a new one</Link>.
        </Alert>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-4">
          <TextInput label="New password" name="password" type="password" autoComplete="new-password" minLength={8} required hint="At least 8 characters." />
          <TextInput label="Confirm new password" name="confirm" type="password" autoComplete="new-password" required />
          {error && <Alert tone="error">{error}</Alert>}
          <button type="submit" className="btn btn-primary w-full" disabled={busy || me === undefined}>
            {busy ? "Saving…" : "Save password"}
          </button>
        </form>
      )}
    </AuthShell>
  );
}
