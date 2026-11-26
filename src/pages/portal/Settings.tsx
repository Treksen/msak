import { useEffect, useState, type FormEvent } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { api, errorMessage } from "../../lib/api";
import { useMe } from "../../lib/auth";
import { useThemeChoice, type ThemeChoice } from "../../lib/theme";
import { Alert, PageHeader, TextInput } from "../../components/ui";

const looks: { id: ThemeChoice; label: string; hint: string; icon: typeof Sun }[] = [
  { id: "light", label: "Light", hint: "Ivory pages, navy text", icon: Sun },
  { id: "dark", label: "Dark", hint: "Easier on the eyes at night", icon: Moon },
  { id: "system", label: "Match my device", hint: "Follows your phone or computer", icon: Monitor },
];

export function SettingsPage() {
  const me = useMe();
  const [choice, setChoice] = useThemeChoice();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    document.title = "Settings — MSAK";
  }, []);

  async function changePassword(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    const pw = String(f.get("password") ?? "");
    if (pw.length < 8) return setMsg({ tone: "error", text: "Use at least 8 characters." });
    if (pw !== String(f.get("confirm") ?? "")) return setMsg({ tone: "error", text: "The two passwords don't match." });
    setBusy(true);
    setMsg(null);
    try {
      await api.updatePassword(pw);
      form.reset();
      setMsg({ tone: "success", text: "Password changed. Use the new one next time you sign in." });
    } catch (err) {
      setMsg({ tone: "error", text: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Settings">Your password and how the portal looks.</PageHeader>

      <section aria-labelledby="look-h" className="card flex flex-col gap-4 p-5 sm:p-6">
        <div>
          <h2 id="look-h" className="font-serif text-xl font-semibold text-navy-900">
            Appearance
          </h2>
          <p className="mt-1 text-sm text-muted">Saved on this device. The public website keeps its usual look.</p>
        </div>
        <div role="radiogroup" aria-labelledby="look-h" className="grid gap-3 sm:grid-cols-3">
          {looks.map((l) => {
            const on = choice === l.id;
            return (
              <button
                key={l.id}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setChoice(l.id)}
                className={`flex items-center gap-3 rounded-md border p-4 text-left ${
                  on ? "border-gold-500 bg-gold-50 ring-2 ring-gold-500/40" : "border-line-strong bg-white hover:border-gold-500"
                }`}
              >
                <l.icon className={`size-6 flex-none ${on ? "text-gold-700" : "text-muted"}`} aria-hidden="true" />
                <span>
                  <span className="block font-semibold text-navy-900">{l.label}</span>
                  <span className="block text-[13px] text-muted">{l.hint}</span>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <form onSubmit={changePassword} aria-labelledby="pw-h" className="card grid gap-4 p-5 sm:grid-cols-2 sm:p-6">
        <div className="sm:col-span-2">
          <h2 id="pw-h" className="font-serif text-xl font-semibold text-navy-900">
            Change password
          </h2>
          <p className="mt-1 text-sm text-muted">
            For {me.email ?? "your account"}. You stay signed in on this device.
          </p>
        </div>
        <input type="email" name="username" autoComplete="username" value={me.email ?? ""} readOnly hidden />
        <TextInput label="New password" name="password" type="password" autoComplete="new-password" minLength={8} required hint="At least 8 characters." />
        <TextInput label="Confirm new password" name="confirm" type="password" autoComplete="new-password" required />
        {msg && (
          <div className="sm:col-span-2">
            <Alert tone={msg.tone}>{msg.text}</Alert>
          </div>
        )}
        <div className="flex justify-end sm:col-span-2">
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? "Saving…" : "Change password"}
          </button>
        </div>
      </form>
    </div>
  );
}
