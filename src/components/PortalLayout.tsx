import { useEffect, useState, type ComponentType } from "react";
import { Link, NavLink, Navigate, Outlet, useLocation, useNavigate } from "react-router";
import {
  BadgeCheck,
  FileText,
  Home,
  LogOut,
  MapPin,
  Megaphone,
  MessageSquare,
  Settings,
  User,
  Users,
  Menu,
  X,
} from "lucide-react";
import { useAuth, permissions } from "../lib/auth";
import { api } from "../lib/api";
import { makeLookup } from "../lib/directory";
import { initials } from "../lib/format";
import { DemoBanner } from "./DemoBanner";
import { Spinner } from "./ui";

type Item = { to: string; label: string; icon: ComponentType<{ className?: string }>; end?: boolean; badge?: number };

/** Portal shell: navy sidebar on desktop, bottom tab bar + "More" sheet on phones. */
export function PortalLayout() {
  const { me, directory } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [moreOpen, setMoreOpen] = useState(false);
  const [pending, setPending] = useState(0);

  const lookup = makeLookup(directory);
  const myAssoc = lookup.associationOfInstitution(me?.profile?.institution_id);
  const perms = permissions(me, myAssoc?.id ?? null);

  useEffect(() => setMoreOpen(false), [location.pathname]);
  useEffect(() => {
    if (!me || !perms.canReviewLeaders) return;
    api
      .listLeaderRoles()
      .then((rows) => setPending(rows.filter((r) => r.status === "pending").length))
      .catch(() => setPending(0));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me, location.pathname]);

  if (me === undefined) return <Spinner label="Opening your portal…" />;
  if (me === null) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname)}`} replace />;

  const member: Item[] = [
    { to: "/app", label: "Overview", icon: Home, end: true },
    { to: "/app/announcements", label: "Announcements", icon: Megaphone },
    { to: "/app/churches", label: "Churches", icon: MapPin },
    { to: "/app/documents", label: "Documents", icon: FileText },
    { to: "/app/profile", label: me.profile ? "My profile" : "My account", icon: User },
    { to: "/app/feedback", label: "Help & feedback", icon: MessageSquare },
  ];
  const leader: Item[] = [
    ...(perms.canReviewLeaders ? [{ to: "/app/leaders", label: "Leader approvals", icon: BadgeCheck, badge: pending }] : []),
    ...(perms.canSeeMembers ? [{ to: "/app/members", label: perms.isAdmin ? "Members" : "Members in my scope", icon: Users }] : []),
    ...(perms.isAdmin ? [{ to: "/app/admin", label: "Administration", icon: Settings }] : []),
  ];
  const tabs: Item[] = [member[0], member[1], member[2], member[4]];
  const roleLine = me.isAdmin
    ? me.profile
      ? "Administrator"
      : me.email ?? "Administrator"
    : me.roles.find((r) => r.status === "approved")
      ? `${me.roles.find((r) => r.status === "approved")!.position} · ${myAssoc?.code ?? ""}`
      : `Member · ${myAssoc?.code ?? ""}`;

  async function logout() {
    await api.signOut();
    navigate("/");
  }

  const linkCls = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 rounded-md px-3 py-2.5 text-[15px] no-underline ${
      isActive ? "border-l-[3px] border-gold-500 bg-navy-800 font-semibold text-white" : "text-navy-100 hover:bg-navy-800/60"
    }`;

  const NavList = ({ items }: { items: Item[] }) => (
    <ul className="flex flex-col gap-0.5">
      {items.map((i) => (
        <li key={i.to}>
          <NavLink to={i.to} end={i.end} className={linkCls}>
            <i.icon className="size-[18px] flex-none" />
            <span className="flex-1">{i.label}</span>
            {!!i.badge && (
              <span className="inline-flex min-w-[22px] items-center justify-center rounded-full bg-gold-500 px-1.5 text-xs font-bold text-navy-900">
                {i.badge}
              </span>
            )}
          </NavLink>
        </li>
      ))}
    </ul>
  );

  const Sidebar = (
    <div className="flex h-full flex-col gap-6 px-4 py-5">
      <Link to="/" className="flex items-center gap-3 px-2 text-white no-underline">
        <img src="/brand/msak-crest-128.png" alt="" className="size-11" />
        <span className="font-serif text-xl font-bold tracking-wide">MSAK</span>
      </Link>
      <nav aria-label="Member">
        <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-navy-300">Member</p>
        <NavList items={member} />
      </nav>
      {leader.length > 0 && (
        <nav aria-label="Leader tools">
          <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-gold-300">
            {perms.isAdmin ? "Administration" : "Leader tools"}
          </p>
          <NavList items={leader} />
        </nav>
      )}
      <div className="mt-auto flex items-center gap-3 border-t border-navy-700 px-2 pt-4">
        <span aria-hidden="true" className="flex size-10 flex-none items-center justify-center rounded-full bg-gold-500 font-bold text-navy-900">
          {initials(me.profile?.full_name ?? "M")}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-white">{me.profile?.full_name ?? (me.isAdmin ? "Administrator" : me.email)}</span>
          <span className="block truncate text-xs text-navy-300">{roleLine}</span>
        </span>
        <button type="button" onClick={logout} className="btn btn-sm text-navy-300 hover:text-white" aria-label="Log out">
          <LogOut className="size-[18px]" aria-hidden="true" />
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-dvh flex-col">
      <DemoBanner />
      <div className="flex flex-1">
        <aside className="sticky top-0 hidden h-dvh w-[272px] flex-none overflow-y-auto bg-navy-900 lg:block">{Sidebar}</aside>

        <div className="flex min-w-0 flex-1 flex-col">
          {/* Phone top bar */}
          <header className="sticky top-0 z-[900] flex items-center justify-between border-b border-line bg-white px-4 py-2.5 lg:hidden">
            <Link to="/app" className="flex items-center gap-2.5 text-navy-900 no-underline">
              <img src="/brand/msak-crest-128.png" alt="" className="size-9" />
              <span className="font-serif text-lg font-bold tracking-wide">MSAK</span>
            </Link>
            <span className="truncate pl-3 text-xs text-muted">{roleLine}</span>
          </header>

          <main id="main" className="flex-1 px-4 pb-28 pt-6 sm:px-6 lg:px-10 lg:pb-12 lg:pt-8">
            <div className="mx-auto max-w-6xl">
              <Outlet context={{ lookup, perms }} />
            </div>
          </main>
        </div>
      </div>

      {/* Phone bottom tab bar */}
      <nav aria-label="App" className="pb-safe fixed inset-x-0 bottom-0 z-[900] grid grid-cols-5 border-t border-line bg-white px-1 pt-1.5 lg:hidden">
        {tabs.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.end}
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 py-1.5 text-[11px] no-underline ${isActive ? "font-bold text-navy-900" : "font-semibold text-muted"}`
            }
          >
            {({ isActive }) => (
              <>
                <t.icon className="size-[22px]" />
                {t.label === "My profile" ? "Profile" : t.label === "My account" ? "Account" : t.label === "Announcements" ? "Notices" : t.label}
                <span className={`h-0.5 w-[18px] ${isActive ? "bg-gold-500" : "bg-transparent"}`} />
              </>
            )}
          </NavLink>
        ))}
        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          className="relative flex flex-col items-center gap-1 py-1.5 text-[11px] font-semibold text-muted"
          aria-haspopup="dialog"
        >
          <Menu className="size-[22px]" aria-hidden="true" />
          More
          {pending > 0 && <span className="absolute right-[22%] top-1 size-2.5 rounded-full bg-gold-500" aria-label={`${pending} pending`} />}
          <span className="h-0.5 w-[18px]" />
        </button>
      </nav>

      {moreOpen && (
        <div className="fixed inset-0 z-[1100] lg:hidden" role="dialog" aria-modal="true" aria-label="More">
          <button type="button" className="absolute inset-0 bg-navy-950/60" aria-label="Close menu" onClick={() => setMoreOpen(false)} />
          <div className="pb-safe absolute inset-x-0 bottom-0 max-h-[85dvh] overflow-y-auto rounded-t-2xl bg-navy-900">
            <div className="flex justify-end px-4 pt-3">
              <button type="button" onClick={() => setMoreOpen(false)} className="btn btn-sm text-navy-100" aria-label="Close">
                <X className="size-5" aria-hidden="true" />
              </button>
            </div>
            {Sidebar}
          </div>
        </div>
      )}
    </div>
  );
}
