import { useEffect, useState, type FocusEvent, type MouseEvent, type ReactNode } from "react";
import { Link } from "react-router";
import { Activity, AlertTriangle, BadgeCheck, GraduationCap, MapPin, Users } from "lucide-react";
import { api, errorMessage } from "../lib/api";
import type { AdminDashboard as Data } from "../lib/types";
import { Alert, Spinner } from "./ui";

/* Chart colours: validated for colour-blind separation and 3:1 contrast on the light surface. */
const STUDENT = "#3B5FB0";
const ALUMNI = "#A97C2E";

const monthLabel = (m: string, long = false) =>
  new Date(`${m}-15T12:00:00Z`).toLocaleDateString("en-KE", long ? { month: "long", year: "numeric" } : { month: "short" });

/** The figures at the top of the admin page: tiles, two charts and a churches table. */
export function AdminDashboardPanel() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .adminDashboard()
      .then(setData)
      .catch((e) => setError(errorMessage(e)));
  }, []);

  if (error) return <Alert tone="error">The dashboard couldn't load: {error}</Alert>;
  if (!data) return <Spinner label="Loading the dashboard…" />;

  const leadersActive = data.leaders.national + data.leaders.regional + data.leaders.institutional;
  const churchTotal = data.by_association.reduce((a, r) => a + r.churches, 0);
  const churchConfirmed = data.by_association.reduce((a, r) => a + r.churches_confirmed, 0);

  return (
    <section aria-labelledby="dash-h" className="flex flex-col gap-5">
      <h2 id="dash-h" className="sr-only">
        Dashboard
      </h2>

      <ul className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <Tile icon={<Users />} label="Members" value={data.members} note={`${data.students} students · ${data.alumni} alumni`} />
        <Tile
          icon={<BadgeCheck />}
          label="Active leaders"
          value={leadersActive}
          note={`${data.leaders.national} national · ${data.leaders.regional} regional · ${data.leaders.institutional} campus`}
        />
        <Tile
          icon={<GraduationCap />}
          label="Waiting for approval"
          value={data.leaders.waiting}
          note={data.leaders.expired ? `${data.leaders.expired} expired term${data.leaders.expired > 1 ? "s" : ""}` : "New requests and renewals"}
          to="/app/leaders"
          attention={data.leaders.waiting > 0}
        />
        <Tile
          icon={<MapPin />}
          label="Churches to check"
          value={data.churches_suggested + data.open_reports}
          note={`${data.churches_suggested} suggested · ${data.open_reports} reported`}
          to="/app/churches"
          attention={data.churches_suggested + data.open_reports > 0}
        />
        <Tile icon={<Activity />} label="Activity this week" value={data.activity_7d} note="Changes made in the portal" to="/app/admin/logs" />
        <Tile
          icon={<AlertTriangle />}
          label="App errors this week"
          value={data.errors_7d}
          note={data.errors_7d ? "Open the error log" : "None reported"}
          to="/app/admin/logs?tab=errors"
          attention={data.errors_7d > 0}
        />
      </ul>

      <div className="grid gap-5 lg:grid-cols-2">
        <MembersByAssociation data={data} />
        <Signups data={data} />
      </div>

      <section aria-labelledby="ch-h" className="card overflow-hidden">
        <div className="flex flex-wrap items-baseline justify-between gap-2 px-5 pt-5">
          <h3 id="ch-h" className="font-serif text-lg font-semibold text-navy-900">
            Churches on the map
          </h3>
          <p className="text-sm text-muted">
            {churchConfirmed} of {churchTotal} pins confirmed on site
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="mt-3 w-full text-sm">
            <thead>
              <tr className="border-y border-line bg-paper text-left text-[12px] uppercase tracking-wide text-muted">
                <th scope="col" className="px-5 py-2 font-semibold">
                  Association
                </th>
                <th scope="col" className="px-3 py-2 text-right font-semibold">
                  Churches
                </th>
                <th scope="col" className="px-5 py-2 text-right font-semibold">
                  Confirmed on site
                </th>
              </tr>
            </thead>
            <tbody>
              {data.by_association.map((r) => (
                <tr key={r.association_id} className="border-b border-line last:border-0">
                  <th scope="row" className="px-5 py-2 text-left font-semibold text-navy-900">
                    {r.code} <span className="font-normal text-muted">· {r.name}</span>
                  </th>
                  <td className="px-3 py-2 text-right tabular-nums">{r.churches}</td>
                  <td className="px-5 py-2 text-right tabular-nums">{r.churches ? `${r.churches_confirmed} (${Math.round((100 * r.churches_confirmed) / r.churches)}%)` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}

function Tile({ icon, label, value, note, to, attention }: { icon: ReactNode; label: string; value: number; note: string; to?: string; attention?: boolean }) {
  const body = (
    <>
      <span className={`flex items-center gap-2 text-[13px] font-semibold ${attention ? "text-gold-800" : "text-muted"} [&>svg]:size-4`} aria-hidden="false">
        {icon}
        {label}
      </span>
      <span className="font-serif text-3xl font-semibold tabular-nums text-navy-900">{value.toLocaleString("en-KE")}</span>
      <span className="text-[12px] leading-snug text-muted">{note}</span>
    </>
  );
  const cls = `card flex h-full flex-col gap-1 p-4 ${attention ? "border-gold-500 bg-gold-50" : ""}`;
  return <li>{to ? <Link to={to} className={`${cls} no-underline hover:border-line-strong`}>{body}</Link> : <div className={cls}>{body}</div>}</li>;
}

/** Card with a title, an optional legend, the chart, and a "Show table" switch. */
function ChartCard({ id, title, legend, chart, table }: { id: string; title: string; legend?: ReactNode; chart: ReactNode; table: ReactNode }) {
  const [asTable, setAsTable] = useState(false);
  return (
    <section aria-labelledby={id} className="card p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id={id} className="font-serif text-lg font-semibold text-navy-900">
          {title}
        </h3>
        <button type="button" className="text-[13px] font-semibold text-navy-700 underline" onClick={() => setAsTable((v) => !v)}>
          {asTable ? "Show chart" : "Show table"}
        </button>
      </div>
      {legend && !asTable && <div className="mt-2 flex flex-wrap gap-4 text-[13px] text-body">{legend}</div>}
      <div className="mt-4">{asTable ? table : chart}</div>
    </section>
  );
}

const Key = ({ color, label }: { color: string; label: string }) => (
  <span className="flex items-center gap-1.5">
    <span className="inline-block size-3 rounded-[3px]" style={{ background: color }} aria-hidden="true" />
    {label}
  </span>
);

/** Small hover/focus tooltip shared by both charts. */
function useTip() {
  const [tip, setTip] = useState<{ x: number; y: number; text: ReactNode } | null>(null);
  const bind = (text: ReactNode) => ({
    tabIndex: 0,
    onMouseMove: (e: MouseEvent<HTMLElement>) => {
      const box = (e.currentTarget.closest("[data-chart]") as HTMLElement).getBoundingClientRect();
      setTip({ x: e.clientX - box.left, y: e.clientY - box.top, text });
    },
    onFocus: (e: FocusEvent<HTMLElement>) => {
      const box = (e.currentTarget.closest("[data-chart]") as HTMLElement).getBoundingClientRect();
      const me = e.currentTarget.getBoundingClientRect();
      setTip({ x: me.left - box.left + me.width / 2, y: me.top - box.top, text });
    },
    onMouseLeave: () => setTip(null),
    onBlur: () => setTip(null),
  });
  const node = tip && (
    <div
      role="status"
      className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-[calc(100%+10px)] whitespace-nowrap rounded-md bg-navy-950 px-2.5 py-1.5 text-[12px] text-white shadow-lg"
      style={{ left: tip.x, top: tip.y }}
    >
      {tip.text}
    </div>
  );
  return { bind, node };
}

function MembersByAssociation({ data }: { data: Data }) {
  const { bind, node } = useTip();
  const rows = data.by_association;
  const max = Math.max(1, ...rows.map((r) => r.students + r.alumni));
  return (
    <ChartCard
      id="assoc-h"
      title="Members by association"
      legend={
        <>
          <Key color={STUDENT} label="Students" />
          <Key color={ALUMNI} label="Alumni" />
        </>
      }
      chart={
        <div data-chart className="relative flex flex-col gap-2.5">
          {rows.map((r) => {
            const total = r.students + r.alumni;
            return (
              <div key={r.association_id} className="grid grid-cols-[4.5rem_1fr] items-center gap-3">
                <span className="truncate text-[13px] font-semibold text-navy-900" title={r.name}>
                  {r.code}
                </span>
                <div className="flex items-center gap-2">
                  <div className="flex h-4 min-w-0 gap-[2px]" style={{ width: `${(total / max) * 85}%` }}>
                    {r.students > 0 && (
                      <span
                        {...bind(`${r.code}: ${r.students} student${r.students === 1 ? "" : "s"}`)}
                        aria-label={`${r.code} students: ${r.students}`}
                        className="h-full rounded-l-[4px] outline-offset-2 last:rounded-r-[4px]"
                        style={{ background: STUDENT, flexGrow: r.students }}
                      />
                    )}
                    {r.alumni > 0 && (
                      <span
                        {...bind(`${r.code}: ${r.alumni} alumni`)}
                        aria-label={`${r.code} alumni: ${r.alumni}`}
                        className="h-full rounded-r-[4px] outline-offset-2 first:rounded-l-[4px]"
                        style={{ background: ALUMNI, flexGrow: r.alumni }}
                      />
                    )}
                  </div>
                  <span className="text-[12px] tabular-nums text-muted">{total}</span>
                </div>
              </div>
            );
          })}
          {node}
        </div>
      }
      table={
        <SimpleTable
          head={["Association", "Students", "Alumni", "Total"]}
          rows={rows.map((r) => [r.code, r.students, r.alumni, r.students + r.alumni])}
        />
      }
    />
  );
}

function Signups({ data }: { data: Data }) {
  const { bind, node } = useTip();
  const max = Math.max(1, ...data.signups.map((s) => s.count));
  const last = data.signups[data.signups.length - 1];
  const total = data.signups.reduce((a, s) => a + s.count, 0);
  return (
    <ChartCard
      id="signup-h"
      title={`New members — last 12 months (${total})`}
      chart={
        <div data-chart className="relative">
          <div className="flex h-44 items-end gap-[2px] border-b border-line-strong">
            {data.signups.map((s) => (
              <div key={s.month} className="relative flex h-full flex-1 items-end justify-center">
                {s === last && s.count > 0 && (
                  <span className="absolute text-[12px] font-semibold tabular-nums text-ink" style={{ bottom: `calc(${(s.count / max) * 100}% + 4px)` }}>
                    {s.count}
                  </span>
                )}
                <span
                  {...bind(`${monthLabel(s.month, true)}: ${s.count} new member${s.count === 1 ? "" : "s"}`)}
                  aria-label={`${monthLabel(s.month, true)}: ${s.count}`}
                  className="block w-full max-w-7 rounded-t-[4px] outline-offset-2"
                  style={{ height: `${(s.count / max) * 100}%`, minHeight: s.count ? 3 : 0, background: STUDENT }}
                />
                {/* bigger hit area than the bar */}
                <span {...bind(`${monthLabel(s.month, true)}: ${s.count} new member${s.count === 1 ? "" : "s"}`)} tabIndex={-1} className="absolute inset-0" aria-hidden="true" />
              </div>
            ))}
          </div>
          <div className="mt-1.5 flex gap-[2px]">
            {data.signups.map((s, i) => (
              <span key={s.month} className="flex-1 text-center text-[11px] text-muted">
                {i % 2 === data.signups.length % 2 ? monthLabel(s.month) : ""}
              </span>
            ))}
          </div>
          {node}
        </div>
      }
      table={<SimpleTable head={["Month", "New members"]} rows={data.signups.map((s) => [monthLabel(s.month, true), s.count])} />}
    />
  );
}

function SimpleTable({ head, rows }: { head: string[]; rows: (string | number)[][] }) {
  return (
    <div className="max-h-72 overflow-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line text-left text-[12px] uppercase tracking-wide text-muted">
            {head.map((h, i) => (
              <th key={h} scope="col" className={`py-1.5 font-semibold ${i ? "text-right" : ""}`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={String(r[0])} className="border-b border-line last:border-0">
              {r.map((c, i) =>
                i ? (
                  <td key={i} className="py-1.5 text-right tabular-nums">
                    {c}
                  </td>
                ) : (
                  <th key={i} scope="row" className="py-1.5 text-left font-semibold text-navy-900">
                    {c}
                  </th>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
