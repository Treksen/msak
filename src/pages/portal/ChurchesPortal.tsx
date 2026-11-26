import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router";
import { api, errorMessage } from "../../lib/api";
import { useMe } from "../../lib/auth";
import { usePortal } from "../../lib/portal";
import type { Church, ChurchReport } from "../../lib/types";
import { timeAgo } from "../../lib/format";
import { ChurchFinder } from "../../components/ChurchFinder";
import { ChurchForm } from "../../components/ChurchForm";
import { Alert, Modal, PageHeader, Spinner } from "../../components/ui";

/** Churches inside the portal: leaders add, pin and confirm; members suggest. */
export function ChurchesPortalPage() {
  const me = useMe();
  // a leader found this person isn't a student: they can browse the map but not suggest or report churches
  const declined = me.profile?.verification === "declined";
  const { lookup, perms } = usePortal();
  const [params, setParams] = useSearchParams();
  const [churches, setChurches] = useState<Church[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Church | null>(null);
  const [reporting, setReporting] = useState<Church | null>(null);
  const [reports, setReports] = useState<ChurchReport[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const adding = params.get("add") === "1";

  const manageable = perms.churchAssociations(lookup.associations.map((a) => a.id));
  const myAssoc = lookup.associationOfInstitution(me.profile?.institution_id)?.id ?? null;
  const suggestions = (churches ?? []).filter((c) => c.status === "suggested" && perms.canManageChurchesIn(c.association_id));

  const load = useCallback(() => {
    api
      .listChurches()
      .then(setChurches)
      .catch((e) => setError(errorMessage(e)));
    api
      .listChurchReports()
      .then(setReports)
      .catch(() => setReports([]));
  }, []);

  useEffect(() => {
    document.title = "Churches — MSAK";
    load();
  }, [load]);

  const byId = new Map((churches ?? []).map((c) => [c.id, c]));
  const toResolve = reports.filter((r) => {
    const c = byId.get(r.church_id);
    return r.status === "open" && c && perms.canManageChurchesIn(c.association_id);
  });

  async function resolve(id: string) {
    try {
      await api.resolveChurchReport(id);
      load();
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  const close = () => {
    setEditing(null);
    if (adding) setParams({}, { replace: true });
  };

  return (
    <div>
      <PageHeader eyebrow="Local churches" title="Church map">
        {manageable.length > 0
          ? "Visiting a church? Tap “Add a church”, then “Use my location” while you're there to pin it exactly. Review members' suggestions below."
          : "Find a Sabbath fellowship near you. Know one that's missing? Suggest it and a leader will confirm it."}
      </PageHeader>

      {suggestions.length > 0 && (
        <div className="mb-6">
          <Alert tone="warn">
            <strong>
              {suggestions.length} suggestion{suggestions.length > 1 ? "s" : ""} to confirm:
            </strong>{" "}
            {suggestions.map((s, i) => (
              <span key={s.id}>
                {i > 0 && ", "}
                <button type="button" className="font-semibold underline" onClick={() => setEditing(s)}>
                  {s.name}
                </button>
              </span>
            ))}
            . Visit, pin it on site, then publish.
          </Alert>
        </div>
      )}

      {toResolve.length > 0 && (
        <section aria-labelledby="reports-h" className="mb-6 rounded-lg border border-line bg-white p-4">
          <h2 id="reports-h" className="font-semibold text-navy-900">
            Reported problems ({toResolve.length})
          </h2>
          <ul className="mt-3 divide-y divide-line">
            {toResolve.map((r) => {
              const c = byId.get(r.church_id)!;
              return (
                <li key={r.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="font-semibold text-navy-900">{c.name}</p>
                    <p className="whitespace-pre-line text-sm text-body">{r.message}</p>
                    <p className="text-[12px] text-muted">{timeAgo(r.created_at)}</p>
                  </div>
                  <div className="flex flex-none gap-2">
                    <button type="button" className="btn btn-outline btn-sm" onClick={() => setEditing(c)}>
                      Fix details
                    </button>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => void resolve(r.id)}>
                      Mark resolved
                    </button>
                    {perms.isAdmin && (
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm text-danger"
                        aria-label="Delete this report"
                        onClick={async () => {
                          if (!confirm("Delete this report?")) return;
                          try {
                            await api.deleteChurchReport(r.id);
                            load();
                          } catch (e) {
                            setError(errorMessage(e));
                          }
                        }}
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {notice && <Alert tone="success">{notice}</Alert>}
      {error && <Alert tone="error">{error}</Alert>}
      {churches === null ? (
        <Spinner />
      ) : (
        <ChurchFinder
          churches={churches}
          lookup={lookup}
          onAdd={declined ? undefined : () => setParams({ add: "1" })}
          addLabel={manageable.length > 0 ? "Add a church" : "Suggest a church"}
          canEdit={(c) => perms.canManageChurchesIn(c.association_id)}
          onEdit={setEditing}
          onReport={declined ? undefined : setReporting}
        />
      )}

      <Modal open={adding || !!editing} wide title={editing ? (editing.status === "suggested" ? `Review: ${editing.name}` : `Edit ${editing.name}`) : manageable.length > 0 ? "Add a church" : "Suggest a church"} onClose={close}>
        <ChurchForm
          key={editing?.id ?? "new"}
          lookup={lookup}
          manageable={manageable}
          defaultAssociationId={myAssoc}
          church={editing}
          onDone={() => {
            close();
            load();
          }}
        />
      </Modal>
      <Modal open={!!reporting} title={reporting ? `Report: ${reporting.name}` : "Report"} onClose={() => setReporting(null)}>
        {reporting && (
          <ReportForm
            church={reporting}
            onDone={() => {
              setReporting(null);
              setNotice("Thanks — the leaders who look after this church will check it.");
              load();
            }}
          />
        )}
      </Modal>
    </div>
  );
}

function ReportForm({ church, onDone }: { church: Church; onDone: () => void }) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.reportChurch(church.id, message);
      onDone();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <label htmlFor="report-msg" className="text-sm text-body">
        What's wrong? For example: the pin is on the wrong street, the church has moved, the phone number is out of date, or
        service times changed.
      </label>
      <textarea id="report-msg" className="input min-h-32" value={message} onChange={(e) => setMessage(e.target.value)} maxLength={1000} required />
      {error && <Alert tone="error">{error}</Alert>}
      <div className="flex justify-end">
        <button type="submit" className="btn btn-primary" disabled={busy || message.trim().length < 5}>
          {busy ? "Sending…" : "Send report"}
        </button>
      </div>
    </form>
  );
}
