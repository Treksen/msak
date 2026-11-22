import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import { api, errorMessage } from "../../lib/api";
import { useMe } from "../../lib/auth";
import { usePortal } from "../../lib/portal";
import type { Church } from "../../lib/types";
import { ChurchFinder } from "../../components/ChurchFinder";
import { ChurchForm } from "../../components/ChurchForm";
import { Alert, Modal, PageHeader, Spinner } from "../../components/ui";

/** Churches inside the portal: leaders add, pin and confirm; members suggest. */
export function ChurchesPortalPage() {
  const me = useMe();
  const { lookup, perms } = usePortal();
  const [params, setParams] = useSearchParams();
  const [churches, setChurches] = useState<Church[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Church | null>(null);
  const adding = params.get("add") === "1";

  const manageable = perms.churchAssociations(lookup.associations.map((a) => a.id));
  const myAssoc = lookup.associationOfInstitution(me.profile?.institution_id)?.id ?? null;
  const suggestions = (churches ?? []).filter((c) => c.status === "suggested" && perms.canManageChurchesIn(c.association_id));

  const load = useCallback(() => {
    api
      .listChurches()
      .then(setChurches)
      .catch((e) => setError(errorMessage(e)));
  }, []);

  useEffect(() => {
    document.title = "Churches — MSAK";
    load();
  }, [load]);

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

      {error && <Alert tone="error">{error}</Alert>}
      {churches === null ? (
        <Spinner />
      ) : (
        <ChurchFinder
          churches={churches}
          lookup={lookup}
          onAdd={() => setParams({ add: "1" })}
          addLabel={manageable.length > 0 ? "Add a church" : "Suggest a church"}
          canEdit={(c) => perms.canManageChurchesIn(c.association_id)}
          onEdit={setEditing}
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
    </div>
  );
}
