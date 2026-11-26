import { useEffect, useState } from "react";
import { Link } from "react-router";
import { ArrowRight, BadgeCheck, Crosshair, MapPin, Megaphone } from "lucide-react";
import { api } from "../../lib/api";
import { useMe } from "../../lib/auth";
import { usePortal } from "../../lib/portal";
import { distanceKm, formatKm, getCurrentPosition } from "../../lib/geo";
import { formatDate, levelLabel } from "../../lib/format";
import type { Announcement, Church, LeaderRoleWithPerson } from "../../lib/types";
import { AnnouncementItem } from "../../components/Announcements";
import { InstallPrompt } from "../../components/InstallPrompt";
import { Alert, EmptyState, StatusBadge } from "../../components/ui";
import { isAlumni, isRoleActive, roleState } from "../../lib/academic";

export function OverviewPage() {
  const me = useMe();
  const { lookup, perms } = usePortal();
  const [feed, setFeed] = useState<Announcement[] | null>(null);
  const [requests, setRequests] = useState<LeaderRoleWithPerson[]>([]);
  const [churches, setChurches] = useState<Church[]>([]);
  const [nearest, setNearest] = useState<{ c: Church; d: number } | null>(null);
  const [locError, setLocError] = useState<string | null>(null);

  const profile = me.profile;
  const assoc = lookup.associationOfInstitution(profile?.institution_id);
  const approved = me.roles.filter((r) => roleState(r) === "active" || roleState(r) === "renewal");
  const pendingMine = me.roles.filter((r) => r.status === "pending");
  const expiredMine = me.roles.filter((r) => roleState(r) === "expired");
  const alumni = isAlumni(profile);
  // "You're now alumni" notice: hidden once they confirm (tied to the completion year, so it returns if that changes)
  const alumniKey = `msak-alumni-ok-${me.userId}-${profile?.expected_completion_year ?? ""}`;
  const [alumniOk, setAlumniOk] = useState(() => {
    try {
      return !!localStorage.getItem(alumniKey);
    } catch {
      return false;
    }
  });
  const confirmAlumni = () => {
    try {
      localStorage.setItem(alumniKey, "yes");
    } catch {
      /* ignore */
    }
    setAlumniOk(true);
  };
  // Alumni: ask once whether they served as leaders (hidden after they add one or say no)
  const promptKey = `msak-past-prompt-${me.userId}`;
  const [askPast, setAskPast] = useState(false);
  useEffect(() => {
    if (!alumni || profile?.verification === "declined") return;
    try {
      if (localStorage.getItem(promptKey)) return;
    } catch {
      /* ignore */
    }
    api
      .listPastRoles()
      .then((rows) => setAskPast(!rows.some((r) => r.user_id === me.userId)))
      .catch(() => setAskPast(false));
  }, [alumni, profile?.verification, promptKey, me.userId]);
  const dismissPast = () => {
    try {
      localStorage.setItem(promptKey, "no");
    } catch {
      /* ignore */
    }
    setAskPast(false);
  };
  const [newMembers, setNewMembers] = useState(0);
  const canConfirmMembers = me.isAdmin || me.roles.some((r) => isRoleActive(r) && r.level !== "national");

  useEffect(() => {
    document.title = "Overview — MSAK";
    api.listAnnouncements().then(setFeed).catch(() => setFeed([]));
    api.listChurches().then(setChurches).catch(() => setChurches([]));
    if (perms.canReviewLeaders) api.listLeaderRoles().then(setRequests).catch(() => setRequests([]));
    if (canConfirmMembers) api.countPendingMembers().then(setNewMembers).catch(() => setNewMembers(0));
  }, [perms.canReviewLeaders, canConfirmMembers]);

  async function findNearest() {
    setLocError(null);
    try {
      const p = await getCurrentPosition();
      const published = churches.filter((c) => c.status === "published");
      const best = published.map((c) => ({ c, d: distanceKm(p, c) })).sort((a, b) => a.d - b.d)[0];
      setNearest(best ?? null);
    } catch (e) {
      setLocError(e instanceof Error ? e.message : "Couldn't get your location.");
    }
  }

  const pendingRequests = requests.filter((r) => ["pending", "renewal"].includes(roleState(r)));
  const myScopeChurches = churches.filter((c) => c.association_id === assoc?.id);
  const suggestions = churches.filter((c) => c.status === "suggested" && perms.canManageChurchesIn(c.association_id));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted">Shalom,</p>
          <h1 className="font-serif text-3xl font-semibold text-navy-900 sm:text-4xl">{profile?.full_name ?? (me.isAdmin ? "Administrator" : me.email)}</h1>
        </div>
        {perms.canPost && (
          <Link to="/app/announcements?compose=1" className="btn btn-primary">
            <Megaphone className="size-[18px]" aria-hidden="true" />
            Post announcement
          </Link>
        )}
      </div>

      {expiredMine.length > 0 && (
        <Alert tone="warn">
          Your {expiredMine.map((r) => `${levelLabel[r.level].toLowerCase()} ${r.position}`).join(" and ")} role ended on 31 August.{" "}
          <Link to="/app/leadership" className="font-semibold">
            Renew it for this year
          </Link>{" "}
          to post again — your approver will confirm it.
        </Alert>
      )}
      {alumni && !alumniOk && (
        <Alert tone="info">
          <span className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span>
              You're now alumni (completion year {profile?.expected_completion_year}). You'll get national, regional and alumni announcements.
            </span>
            <span className="flex flex-none flex-wrap gap-2">
              <button type="button" className="btn btn-primary btn-sm" onClick={confirmAlumni}>
                Yes, I've completed
              </button>
              <Link to="/app/profile" className="btn btn-outline btn-sm no-underline">
                No, I'm still studying
              </Link>
            </span>
          </span>
        </Alert>
      )}
      {askPast && (
        <section aria-labelledby="ask-past-h" className="card flex flex-col gap-3 border-gold-500 bg-gold-50 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 id="ask-past-h" className="font-serif text-xl font-semibold text-navy-900">
              Did you serve as an MSAK leader?
            </h2>
            <p className="mt-1 text-sm text-body">
              Add positions you held on your campus, in your region or nationally, with the years. A leader confirms them, and you can choose to
              appear on the public Past leaders page.
            </p>
          </div>
          <div className="flex flex-none flex-wrap gap-2">
            <Link to="/app/past-leadership#past-leadership" className="btn btn-primary btn-sm no-underline">
              Add past leadership
            </Link>
            <button type="button" className="btn btn-ghost btn-sm" onClick={dismissPast}>
              No, I didn't
            </button>
          </div>
        </section>
      )}
      {!profile && !me.isAdmin && <Alert tone="warn">Your profile wasn't found. Please contact an administrator.</Alert>}
      {profile?.verification === "pending" && (
        <Alert tone="info">
          <strong>Welcome!</strong> A leader at {lookup.institution(profile.institution_id)?.name ?? "your campus"} or in {assoc?.code ?? "your association"} will
          confirm that you study there. Until then you'll see national announcements; campus and regional ones and the documents open once you're
          confirmed.
        </Alert>
      )}
      {profile?.verification === "declined" && (
        <Alert tone="warn">
          A leader couldn't confirm you as a student at {lookup.institution(profile.institution_id)?.name ?? "your campus"}
          {profile.verification_note ? <> (“{profile.verification_note}”)</> : null}. If your institution is wrong,{" "}
          <Link to="/app/profile" className="font-semibold">
            correct it in My profile
          </Link>{" "}
          and you'll be checked again; otherwise tell us in{" "}
          <Link to="/app/feedback" className="font-semibold">
            Help & feedback
          </Link>
          . Until then you can't request a leader role or suggest churches
          {profile.verified_at
            ? `, and unless a leader reverses this, your account will be removed on ${formatDate(new Date(Date.parse(profile.verified_at) + 30 * 86_400_000).toISOString())}`
            : ""}
          .
        </Alert>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-6">
          {newMembers > 0 && (
            <Link to="/app/members" className="card flex items-center justify-between gap-3 border-gold-500 bg-gold-50 px-5 py-4 no-underline">
              <span>
                <span className="block font-serif text-xl font-semibold text-navy-900">New members to confirm: {newMembers}</span>
                <span className="block text-[13px] text-body">Check they really study at their campus, then confirm them.</span>
              </span>
              <span className="btn btn-primary btn-sm flex-none">Review</span>
            </Link>
          )}
          {perms.canReviewLeaders && pendingRequests.length > 0 && (
            <section aria-labelledby="req-h" className="card overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
                <div>
                  <h2 id="req-h" className="font-serif text-xl font-semibold text-navy-900">
                    Leader requests waiting for you
                  </h2>
                  <p className="text-[13px] text-muted">
                    {perms.isAdmin ? "You review national and regional leaders (and campus leaders anywhere)." : `You verify campus leaders in ${assoc?.code}.`}
                  </p>
                </div>
                <Link to="/app/leaders" className="btn btn-outline btn-sm">
                  Review {pendingRequests.length}
                </Link>
              </div>
              <ul>
                {pendingRequests.slice(0, 3).map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-[#efebe0] px-5 py-3 last:border-b-0">
                    <span>
                      <span className="block font-semibold text-navy-900">{r.person?.full_name ?? "Member"}</span>
                      <span className="block text-[13px] text-muted">
                        {levelLabel[r.level]} · {r.position} · {lookup.placeLabel(r.person?.institution_id)}
                      </span>
                    </span>
                    <StatusBadge status={r.status} />
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section aria-labelledby="feed-h" className="card overflow-hidden">
            <div className="flex items-center justify-between border-b border-line px-5 py-4">
              <h2 id="feed-h" className="font-serif text-xl font-semibold text-navy-900">
                Latest announcements
              </h2>
              <Link to="/app/announcements" className="text-sm font-semibold">
                See all
              </Link>
            </div>
            {feed === null ? (
              <p className="px-5 py-6 text-sm text-muted">Loading…</p>
            ) : feed.length === 0 ? (
              <div className="p-5">
                <EmptyState title="Nothing yet">Announcements from your campus, region and the national office will appear here.</EmptyState>
              </div>
            ) : (
              feed.slice(0, 4).map((a) => <AnnouncementItem key={a.id} a={a} lookup={lookup} canDelete={false} compact />)
            )}
          </section>
        </div>

        <div className="flex flex-col gap-6">
          {!profile && me.isAdmin ? (
            <section aria-label="Administrator account" className="flex flex-col gap-3 rounded-lg border-t-[3px] border-gold-500 bg-navy-900 p-5 text-white">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-gold-300">Administrator · full access</span>
              <span className="text-[17px] font-semibold leading-snug">{me.email}</span>
              <span className="text-[13px] leading-relaxed text-navy-300">
                You're invisible to members: you don't appear in any member list, and your announcements show as “MSAK National Office”.
              </span>
              <Link to="/app/admin" className="btn btn-gold btn-sm self-start rounded-full">
                Open administration
              </Link>
            </section>
          ) : (
          <section aria-label="Membership" className="flex flex-col gap-3 rounded-lg border-t-[3px] border-gold-500 bg-navy-900 p-5 text-white">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-gold-300">
                {alumni ? `Alumni · class of ${profile?.expected_completion_year}` : `Member · ${assoc?.code ?? ""}`}
              </span>
              {(me.isAdmin || approved.length > 0) && (
                <span className="rounded-full bg-navy-700 px-2.5 py-1 text-xs font-semibold">
                  {me.isAdmin ? "Administrator" : approved.map((r) => `${levelLabel[r.level]} leader`).join(" · ")}
                </span>
              )}
            </div>
            <span className="text-[17px] font-semibold leading-snug">{lookup.institution(profile?.institution_id)?.name}</span>
            <span className="text-[13px] text-navy-300">
              {lookup.countyOfInstitution(profile?.institution_id)?.name} County · Year {profile?.year_of_study} · Completing{" "}
              {profile?.expected_completion_year}
            </span>
            {pendingMine.length > 0 && (
              <span className="flex items-center gap-2 rounded-md bg-navy-800 px-3 py-2 text-[13px] text-navy-100">
                <BadgeCheck className="size-4 text-gold-300" aria-hidden="true" />
                {pendingMine.map((r) => `${levelLabel[r.level]} ${r.position}`).join(", ")} — awaiting verification
              </span>
            )}
          </section>
          )}

          <section aria-labelledby="near-h" className="card flex flex-col gap-3 p-5">
            <h2 id="near-h" className="font-serif text-xl font-semibold text-navy-900">
              Nearest church
            </h2>
            {nearest ? (
              <Link to="/app/churches" className="flex items-center gap-3 rounded-md border-2 border-gold-500 p-3 no-underline">
                <MapPin className="size-5 text-gold-700" aria-hidden="true" />
                <span className="flex-1">
                  <span className="block font-bold text-navy-900">{nearest.c.name}</span>
                  <span className="block text-[13px] text-muted">{nearest.c.fellowship}</span>
                </span>
                <span className="text-sm font-bold text-gold-700">{formatKm(nearest.d)}</span>
              </Link>
            ) : (
              <button type="button" className="btn btn-outline" onClick={findNearest}>
                <Crosshair className="size-[18px]" aria-hidden="true" />
                Use my location
              </button>
            )}
            {locError && <p className="text-[13px] text-danger">{locError}</p>}
            <p className="text-[13px] text-muted">
              {myScopeChurches.filter((c) => c.status === "published").length} churches mapped in {assoc?.code ?? "your association"}.{" "}
              <Link to="/app/churches">Open the map</Link>
            </p>
            {suggestions.length > 0 && (
              <Link to="/app/churches" className="flex items-center justify-between rounded-md border border-dashed border-line-strong p-3 text-sm no-underline">
                <span>
                  <strong>{suggestions.length}</strong> church suggestion{suggestions.length > 1 ? "s" : ""} to confirm
                </span>
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            )}
          </section>

          <InstallPrompt />
        </div>
      </div>
    </div>
  );
}
