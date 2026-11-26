import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { api, errorMessage } from "../../lib/api";
import { useSeo } from "../../lib/seo";
import { usePastLeadersPublic } from "../../lib/pastLeadersSetting";
import type { PublicPastLeader } from "../../lib/types";
import { Alert, Spinner } from "../../components/ui";

const years = (r: PublicPastLeader) => (r.from_year === r.to_year ? `${r.from_year}` : `${r.from_year}–${r.to_year}`);

/** Public honour roll: confirmed national and regional leaders who agreed to be listed. */
export function PastLeadersPage() {
  const [rows, setRows] = useState<PublicPastLeader[] | null>(null);
  const on = usePastLeadersPublic();
  const [error, setError] = useState<string | null>(null);
  useSeo({
    title: "Past leaders",
    description: "The students who have led MSAK nationally and in its regional associations over the years.",
    path: "/past-leaders",
  });
  useEffect(() => {
    api
      .publicPastLeaders()
      .then(setRows)
      .catch((e) => setError(errorMessage(e)));
  }, []);

  const groups = useMemo(() => {
    const out: { key: string; title: string; subtitle?: string; rows: PublicPastLeader[] }[] = [];
    const national = (rows ?? []).filter((r) => r.level === "national");
    if (national.length) out.push({ key: "national", title: "National office", rows: national });
    const byAssoc = new Map<string, PublicPastLeader[]>();
    for (const r of rows ?? []) {
      if (r.level !== "regional" || !r.association_code) continue;
      byAssoc.set(r.association_code, [...(byAssoc.get(r.association_code) ?? []), r]);
    }
    [...byAssoc.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([code, list]) => out.push({ key: code, title: code, subtitle: list[0].association_name ?? undefined, rows: list }));
    return out;
  }, [rows]);

  return (
    <div className="container-page max-w-4xl py-10 lg:py-14">
      <p className="text-[13px] font-bold uppercase tracking-[0.14em] text-gold-700">Our story</p>
      <h1 className="mt-2 font-serif text-4xl font-semibold text-navy-900 sm:text-5xl">Past leaders</h1>
      <p className="mt-4 max-w-2xl text-[17px] leading-relaxed text-body">
        Students who carried the lamp before us — nationally and in our regional associations. Each position here has been confirmed by MSAK
        leadership, and is listed with the person's permission.
      </p>

      {on === false && (
        <p className="mt-10 rounded-lg border border-line bg-white p-6 text-body">The Past leaders page isn't available right now.</p>
      )}
      {error && (
        <div className="mt-6">
          <Alert tone="error">{error}</Alert>
        </div>
      )}
      {rows === null && !error && <Spinner label="Loading…" />}
      {on !== false && rows && rows.length === 0 && (
        <p className="mt-10 rounded-lg border border-line bg-white p-6 text-body">
          The roll of past leaders is being gathered. Served as an MSAK leader?{" "}
          <Link to="/login" className="font-semibold">
            Log in
          </Link>{" "}
          or{" "}
          <Link to="/register" className="font-semibold">
            join
          </Link>{" "}
          and add your past positions from your profile.
        </p>
      )}

      <div className="mt-10 flex flex-col gap-10">
        {groups.map((g) => (
          <section key={g.key} aria-labelledby={`g-${g.key}`}>
            <h2 id={`g-${g.key}`} className="font-serif text-2xl font-semibold text-navy-900">
              {g.title}
              {g.subtitle && <span className="ml-2 font-sans text-base font-normal text-muted">{g.subtitle}</span>}
            </h2>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {g.rows.map((r, i) => (
                <li key={`${r.full_name}-${r.title}-${r.from_year}-${i}`} className="card flex items-start gap-3 p-4">
                  <span className="mt-0.5 flex size-10 flex-none items-center justify-center rounded-full bg-navy-900 font-serif text-sm font-semibold text-gold-300" aria-hidden="true">
                    {r.full_name
                      .split(/\s+/)
                      .slice(0, 2)
                      .map((w) => w[0])
                      .join("")
                      .toUpperCase()}
                  </span>
                  <span className="min-w-0">
                    <span className="block font-semibold text-navy-900">{r.full_name}</span>
                    <span className="block text-sm text-body">{r.title}</span>
                    <span className="block text-[13px] text-muted">{years(r)}</span>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      {rows && rows.length > 0 && (
        <p className="mt-12 text-sm text-muted">
          Served as an MSAK leader and not listed? Add your past positions under <Link to="/app/past-leadership#past-leadership">Past leadership</Link> in the member portal.
        </p>
      )}
    </div>
  );
}
