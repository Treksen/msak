import { useEffect, useId, useRef, type ReactNode, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { AlertTriangle, CheckCircle2, Info, Loader2, X } from "lucide-react";

export function Spinner({ label = "Loading…" }: { label?: string }) {
  return (
    <div role="status" className="flex items-center justify-center gap-2 py-10 text-muted">
      <Loader2 className="size-5 animate-spin" aria-hidden="true" />
      <span className="text-sm">{label}</span>
    </div>
  );
}

export function Alert({ tone = "info", children }: { tone?: "info" | "error" | "success" | "warn"; children: ReactNode }) {
  const styles = {
    info: "bg-navy-50 text-navy-800 border-navy-100",
    error: "bg-[#fdecea] text-danger border-[#f0c7c2]",
    success: "bg-[#e3f3ea] text-success border-[#bfe3cf]",
    warn: "bg-gold-50 text-gold-800 border-[#ebd9ae]",
  }[tone];
  const Icon = tone === "error" || tone === "warn" ? AlertTriangle : tone === "success" ? CheckCircle2 : Info;
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`flex gap-3 rounded-md border px-4 py-3 text-sm leading-relaxed ${styles}`}>
      <Icon className="mt-0.5 size-4 flex-none" aria-hidden="true" />
      <div className="min-w-0">{children}</div>
    </div>
  );
}

type FieldProps = { label: string; hint?: string; error?: string | null; children: (id: string, describedBy?: string) => ReactNode };

export function Field({ label, hint, error, children }: FieldProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errId = error ? `${id}-err` : undefined;
  return (
    <div>
      <label htmlFor={id} className="field-label">
        {label}
      </label>
      {children(id, [hintId, errId].filter(Boolean).join(" ") || undefined)}
      {hint && !error && (
        <p id={hintId} className="field-hint">
          {hint}
        </p>
      )}
      {error && (
        <p id={errId} className="field-error">
          {error}
        </p>
      )}
    </div>
  );
}

export function TextInput({ label, hint, error, ...props }: { label: string; hint?: string; error?: string | null } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <Field label={label} hint={hint} error={error}>
      {(id, describedBy) => <input id={id} aria-describedby={describedBy} aria-invalid={error ? true : undefined} className="input" {...props} />}
    </Field>
  );
}

export function SelectInput({
  label,
  hint,
  error,
  children,
  ...props
}: { label: string; hint?: string; error?: string | null; children: ReactNode } & SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <Field label={label} hint={hint} error={error}>
      {(id, describedBy) => (
        <select id={id} aria-describedby={describedBy} aria-invalid={error ? true : undefined} className="input" {...props}>
          {children}
        </select>
      )}
    </Field>
  );
}

export function TextArea({ label, hint, error, ...props }: { label: string; hint?: string; error?: string | null } & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <Field label={label} hint={hint} error={error}>
      {(id, describedBy) => <textarea id={id} aria-describedby={describedBy} aria-invalid={error ? true : undefined} className="input" {...props} />}
    </Field>
  );
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-line-strong bg-white px-6 py-10 text-center">
      <p className="font-serif text-xl font-semibold text-navy-900">{title}</p>
      {children && <div className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-body">{children}</div>}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}

export function PageHeader({ eyebrow, title, children, actions }: { eyebrow?: string; title: string; children?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && <p className="eyebrow mb-1">{eyebrow}</p>}
        <h1 className="font-serif text-3xl font-semibold text-navy-900 sm:text-4xl">{title}</h1>
        {children && <div className="mt-2 max-w-2xl text-[15px] leading-relaxed text-body">{children}</div>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

/** Accessible dialog: full-screen sheet on phones, centred card on larger screens. */
export function Modal({ open, title, onClose, children, wide }: { open: boolean; title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      className={`m-0 h-full max-h-none w-full max-w-none bg-white p-0 backdrop:bg-navy-950/60 sm:m-auto sm:h-auto sm:max-h-[90vh] sm:rounded-lg ${wide ? "sm:max-w-3xl" : "sm:max-w-lg"}`}
    >
      {open && (
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between gap-4 border-b border-line px-5 py-4">
            <h2 className="font-serif text-xl font-semibold text-navy-900">{title}</h2>
            <button type="button" onClick={onClose} className="btn btn-ghost btn-sm" aria-label="Close">
              <X className="size-5" aria-hidden="true" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>
        </div>
      )}
    </dialog>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const cls =
    status === "approved" || status === "published"
      ? "badge-ok"
      : status === "pending" || status === "suggested"
        ? "badge-pending"
        : "badge-muted";
  return <span className={`badge ${cls}`}>{status}</span>;
}

export function AudienceBadge({ audience }: { audience: string }) {
  const map: Record<string, [string, string]> = {
    institutional: ["badge-campus", "Campus"],
    regional: ["badge-region", "Region"],
    national: ["badge-national", "National"],
  };
  const [cls, label] = map[audience] ?? ["badge-muted", audience];
  return <span className={`badge ${cls}`}>{label}</span>;
}
