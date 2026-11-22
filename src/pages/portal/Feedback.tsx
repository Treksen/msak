import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router";
import { Star } from "lucide-react";
import { api, errorMessage } from "../../lib/api";
import { Alert, PageHeader, TextArea } from "../../components/ui";
import { policyList } from "../../lib/policies";

export function FeedbackPage() {
  const [rating, setRating] = useState(0);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    document.title = "Help & feedback — MSAK";
  }, []);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const message = String(new FormData(form).get("message") ?? "");
    if (!rating) return setMsg({ tone: "error", text: "Choose a rating from 1 to 5." });
    if (message.trim().length < 5) return setMsg({ tone: "error", text: "Tell us a little more (at least 5 characters)." });
    setBusy(true);
    setMsg(null);
    try {
      await api.sendFeedback(rating, message);
      form.reset();
      setRating(0);
      setMsg({ tone: "success", text: "Thank you — the MSAK team will read this." });
    } catch (err) {
      setMsg({ tone: "error", text: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
      <div>
        <PageHeader title="Help & feedback">Something not working, a missing institution, or an idea? Tell us.</PageHeader>
        <form onSubmit={submit} className="card flex flex-col gap-5 p-5 sm:p-6">
          <fieldset>
            <legend className="field-label">How is the portal working for you?</legend>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} type="button" onClick={() => setRating(n)} aria-label={`${n} out of 5`} aria-pressed={rating === n} className="btn btn-ghost px-2">
                  <Star className={`size-7 ${n <= rating ? "fill-gold-500 text-gold-500" : "text-line-strong"}`} aria-hidden="true" />
                </button>
              ))}
            </div>
          </fieldset>
          <TextArea label="Your message" name="message" rows={5} maxLength={2000} required />
          {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
          <div className="flex justify-end">
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? "Sending…" : "Send feedback"}
            </button>
          </div>
        </form>
      </div>
      <aside className="card h-fit p-5">
        <h2 className="mb-3 font-serif text-lg font-semibold text-navy-900">Policies</h2>
        <ul className="space-y-2 text-sm">
          {policyList.map((p) => (
            <li key={p.slug}>
              <Link to={`/policies/${p.slug}`}>{p.title}</Link>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}
