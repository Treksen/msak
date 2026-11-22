import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Download, FileText, Trash2, Upload } from "lucide-react";
import { api, errorMessage } from "../../lib/api";
import { usePortal } from "../../lib/portal";
import { formatBytes, formatDate } from "../../lib/format";
import type { DocumentItem } from "../../lib/types";
import { Alert, EmptyState, Modal, PageHeader, Spinner, TextArea, TextInput } from "../../components/ui";

export function DocumentsPage() {
  const { perms } = usePortal();
  const [docs, setDocs] = useState<DocumentItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);

  const load = useCallback(() => {
    api
      .listDocuments()
      .then(setDocs)
      .catch((e) => setError(errorMessage(e)));
  }, []);
  useEffect(() => {
    document.title = "Documents — MSAK";
    load();
  }, [load]);

  async function open(doc: DocumentItem) {
    try {
      const url = await api.getDocumentUrl(doc);
      window.open(url, "_blank", "noopener");
    } catch (e) {
      alert(errorMessage(e));
    }
  }

  return (
    <div>
      <PageHeader
        title="Documents"
        actions={
          perms.isAdmin && (
            <button type="button" className="btn btn-primary" onClick={() => setUploadOpen(true)}>
              <Upload className="size-[18px]" aria-hidden="true" />
              Upload
            </button>
          )
        }
      >
        Constitutions, guidelines and forms shared with members.
      </PageHeader>
      {error && <Alert tone="error">{error}</Alert>}
      {docs === null ? (
        <Spinner />
      ) : docs.length === 0 ? (
        <EmptyState title="No documents yet">{perms.isAdmin ? "Upload the constitution or leadership guidelines to get started." : "Your leaders haven't shared any documents yet."}</EmptyState>
      ) : (
        <ul className="card divide-y divide-[#efebe0]">
          {docs.map((d) => (
            <li key={d.id} className="flex flex-wrap items-center gap-4 px-5 py-4">
              <FileText className="size-6 flex-none text-gold-700" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-navy-900">{d.title}</p>
                {d.description && <p className="text-sm text-body">{d.description}</p>}
                <p className="text-xs text-muted">
                  {d.file_name} · {formatBytes(d.size_bytes)} · {formatDate(d.created_at)}
                </p>
              </div>
              <div className="flex gap-2">
                <button type="button" className="btn btn-outline btn-sm" onClick={() => open(d)}>
                  <Download className="size-4" aria-hidden="true" />
                  Open
                </button>
                {perms.isAdmin && (
                  <button
                    type="button"
                    className="btn btn-danger btn-sm"
                    aria-label={`Delete ${d.title}`}
                    onClick={async () => {
                      if (!confirm(`Delete “${d.title}”?`)) return;
                      try {
                        await api.deleteDocument(d);
                        load();
                      } catch (e) {
                        alert(errorMessage(e));
                      }
                    }}
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <Modal open={uploadOpen} title="Upload a document" onClose={() => setUploadOpen(false)}>
        <UploadForm
          onDone={() => {
            setUploadOpen(false);
            load();
          }}
        />
      </Modal>
    </div>
  );
}

function UploadForm({ onDone }: { onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const file = f.get("file");
    if (!(file instanceof File) || file.size === 0) return setError("Choose a file.");
    if (file.size > 20 * 1024 * 1024) return setError("Files must be 20 MB or smaller.");
    const title = String(f.get("title") ?? "").trim() || file.name.replace(/\.[^.]+$/, "");
    setBusy(true);
    setError(null);
    try {
      await api.uploadDocument(file, title, String(f.get("description") ?? ""));
      onDone();
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <TextInput label="File" name="file" type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg" required hint="PDF, Word, Excel, PowerPoint or image. Up to 20 MB." />
      <TextInput label="Title" name="title" maxLength={160} placeholder="e.g. MSAK Constitution (2025)" />
      <TextArea label="Description (optional)" name="description" rows={3} maxLength={500} />
      {error && <Alert tone="error">{error}</Alert>}
      <div className="flex justify-end">
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? "Uploading…" : "Upload"}
        </button>
      </div>
    </form>
  );
}
