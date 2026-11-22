import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import { Megaphone } from "lucide-react";
import { api, errorMessage } from "../../lib/api";
import { useMe } from "../../lib/auth";
import { usePortal } from "../../lib/portal";
import type { Announcement, Audience } from "../../lib/types";
import { AnnouncementItem, Composer } from "../../components/Announcements";
import { Alert, EmptyState, Modal, PageHeader, Spinner } from "../../components/ui";

const filters: { id: "all" | Audience; label: string }[] = [
  { id: "all", label: "All" },
  { id: "institutional", label: "Campus" },
  { id: "regional", label: "Region" },
  { id: "national", label: "National" },
  { id: "alumni", label: "Alumni" },
];

export function AnnouncementsPage() {
  const me = useMe();
  const { lookup, perms } = usePortal();
  const [params, setParams] = useSearchParams();
  const [items, setItems] = useState<Announcement[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | Audience>("all");
  const composeOpen = params.get("compose") === "1";

  const load = useCallback(() => {
    api
      .listAnnouncements()
      .then(setItems)
      .catch((e) => setError(errorMessage(e)));
  }, []);

  useEffect(() => {
    document.title = "Announcements — MSAK";
    load();
  }, [load]);

  const shown = (items ?? []).filter((a) => filter === "all" || a.audience === filter);
  const closeComposer = () => setParams({}, { replace: true });

  return (
    <div>
      <PageHeader
        title="Announcements"
        actions={
          perms.canPost && (
            <button type="button" className="btn btn-primary" onClick={() => setParams({ compose: "1" })}>
              <Megaphone className="size-[18px]" aria-hidden="true" />
              Post announcement
            </button>
          )
        }
      >
        From your campus, your association and the national office.
      </PageHeader>

      <div role="tablist" aria-label="Filter announcements" className="mb-4 inline-flex gap-1 rounded-md bg-[#f1eee5] p-1">
        {filters.filter((f) => f.id === "all" || (items ?? []).some((a) => a.audience === f.id)).map((f) => (
          <button
            key={f.id}
            type="button"
            role="tab"
            aria-selected={filter === f.id}
            onClick={() => setFilter(f.id)}
            className={`rounded px-3.5 py-2 text-sm font-semibold ${filter === f.id ? "bg-white text-navy-900 shadow-sm" : "text-muted"}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error && <Alert tone="error">{error}</Alert>}
      {items === null ? (
        <Spinner />
      ) : shown.length === 0 ? (
        <EmptyState title="No announcements here yet" />
      ) : (
        <div className="card overflow-hidden">
          {shown.map((a) => (
            <AnnouncementItem key={a.id} a={a} lookup={lookup} canDelete={a.author_id === me.userId || me.isAdmin} onDeleted={load} />
          ))}
        </div>
      )}

      <Modal open={composeOpen && perms.canPost} title="Post an announcement" onClose={closeComposer}>
        <Composer
          me={me}
          lookup={lookup}
          audiences={perms.postAudiences}
          onPosted={() => {
            load();
            setTimeout(closeComposer, 700);
          }}
        />
      </Modal>
    </div>
  );
}
