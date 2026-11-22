import { useEffect, useRef, useState } from "react";
import { Link, Outlet, useLocation, useNavigation } from "react-router";
import { NavProgress } from "./PageLoading";
import { Menu, X } from "lucide-react";
import { Logo } from "./Brand";
import { useAuth } from "../lib/auth";
import { policyList } from "../lib/policies";
import { DemoBanner } from "./DemoBanner";

const nav = [
  { to: "/", label: "Home" },
  { to: "/#about", label: "About" },
  { to: "/#associations", label: "Associations" },
  { to: "/churches", label: "Find a church" },
  { to: "/#story", label: "Our story" },
  { to: "/policies", label: "Policies" },
];

/** Home-page sections the navbar follows while scrolling ("join" has no link, so nothing is highlighted there). */
const SECTIONS = ["about", "associations", "story", "join"];

/** On the home page the highlight follows the section in view; elsewhere it follows the page. */
function isActive(to: string, pathname: string, section: string) {
  if (to === "/") return pathname === "/" && section === "";
  if (to.startsWith("/#")) return pathname === "/" && section === to.slice(2);
  return pathname === to || pathname.startsWith(`${to}/`);
}

/** Which home section is under the navbar right now ("" = the top of the page). */
function useSectionInView(enabled: boolean, initial: string) {
  const [section, setSection] = useState(initial);
  useEffect(() => {
    if (!enabled) return;
    let raf = 0;
    const update = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        // a section counts once its top passes a line about a third of the way down the screen
        const line = 110 + window.innerHeight * 0.25;
        let current = "";
        for (const id of SECTIONS) {
          const el = document.getElementById(id);
          if (el && el.getBoundingClientRect().top <= line) current = id;
        }
        // at the very bottom, the last section is the one being read
        if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) current = SECTIONS[SECTIONS.length - 1];
        setSection(current);
      });
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [enabled]);
  return section;
}

/**
 * Public site shell with the "Floating Glass" navbar:
 * a rounded, translucent navy bar that floats over the hero and turns more solid on scroll.
 * Phones get a compact bar (crest · Join · menu) — links live in a full-screen glass menu, never stacked.
 */
export function PublicLayout() {
  const navigation = useNavigation();
  const { me } = useAuth();
  const { pathname, hash } = useLocation();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const menuBtn = useRef<HTMLButtonElement>(null);
  const isHome = pathname === "/";
  const section = useSectionInView(isHome, hash.slice(1));

  /** Clicking a home link you're already "on" (e.g. Home after scrolling down) still scrolls there. */
  const jump = (to: string) => {
    if (!isHome || !(to === "/" || to.startsWith("/#"))) return;
    const id = to.split("#")[1];
    if (!id) window.scrollTo({ top: 0, behavior: "smooth" });
    else document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => setOpen(false), [pathname, hash]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Scroll to #section links after navigation; otherwise start at the top
  useEffect(() => {
    if (hash) {
      const el = document.getElementById(hash.slice(1));
      if (el) setTimeout(() => el.scrollIntoView({ behavior: "smooth" }), 60);
    } else {
      window.scrollTo(0, 0);
    }
  }, [pathname, hash]);

  // Menu open: lock page scroll, close on Escape
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
      menuBtn.current?.focus();
    };
  }, [open]);

  const glass = isHome && !scrolled ? "bg-navy-900/70" : "bg-navy-900/[0.94]";

  return (
    <div className="flex min-h-dvh flex-col">
      <NavProgress active={navigation.state === "loading"} />
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[1200] focus:rounded focus:bg-white focus:px-3 focus:py-2"
      >
        Skip to content
      </a>

      <header className="pointer-events-none fixed inset-x-0 top-0 z-[1000] px-2.5 pt-2.5 sm:px-5 sm:pt-4">
        <div
          className={`pointer-events-auto mx-auto flex h-[60px] max-w-[1180px] items-center justify-between gap-2 rounded-full border border-gold-300/35 pl-2 pr-1.5 shadow-[0_12px_32px_rgba(0,0,0,0.22)] backdrop-blur-xl transition-colors sm:h-[70px] sm:gap-4 sm:pl-4 sm:pr-2 ${glass}`}
        >
          <Logo light size={44} />

          <nav aria-label="Main" className="hidden items-center gap-0.5 xl:flex">
            {nav.map((n) => {
              const active = isActive(n.to, pathname, section);
              return (
                <Link
                  key={n.to}
                  to={n.to}
                  onClick={() => jump(n.to)}
                  aria-current={active ? "page" : undefined}
                  className={`whitespace-nowrap rounded-full px-4 py-2.5 text-[15px] no-underline transition-colors ${
                    active ? "bg-ivory font-bold text-navy-900" : "font-medium text-white hover:bg-white/10"
                  }`}
                >
                  {n.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex flex-none items-center gap-1">
            {me ? (
              <Link to="/app" className="btn btn-gold rounded-full px-4 sm:px-5">
                My portal
              </Link>
            ) : (
              <>
                <Link to="/login" className="btn hidden rounded-full px-3.5 text-white hover:bg-white/10 md:inline-flex">
                  Log in
                </Link>
                <Link to="/register" className="btn btn-gold rounded-full px-4 sm:px-5">
                  <span className="sm:hidden">Join</span>
                  <span className="hidden sm:inline">Join MSAK</span>
                </Link>
              </>
            )}
            <button
              ref={menuBtn}
              type="button"
              className="flex size-11 flex-none items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 xl:hidden"
              aria-expanded={open}
              aria-controls="site-menu"
              aria-label="Open menu"
              onClick={() => setOpen(true)}
            >
              <Menu className="size-[22px]" aria-hidden="true" />
            </button>
          </div>
        </div>
      </header>

      {open && (
        <div id="site-menu" role="dialog" aria-modal="true" aria-label="Menu" className="fixed inset-0 z-[1100] xl:hidden">
          <button type="button" aria-label="Close menu" className="absolute inset-0 bg-navy-950/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="absolute inset-2.5 flex flex-col overflow-hidden rounded-[28px] border border-gold-300/35 bg-navy-900/[0.9] text-white shadow-2xl backdrop-blur-xl sm:inset-4 sm:left-auto sm:w-[420px]">
            <div className="flex h-[60px] flex-none items-center justify-between pl-2 pr-1.5">
              <Logo light size={44} />
              <button
                type="button"
                className="flex size-11 items-center justify-center rounded-full bg-white/10 hover:bg-white/20"
                aria-label="Close menu"
                onClick={() => setOpen(false)}
                autoFocus
              >
                <X className="size-[22px]" aria-hidden="true" />
              </button>
            </div>
            <nav aria-label="Main" className="flex-1 overflow-y-auto px-3.5 pt-3">
              <ul className="flex flex-col gap-1">
                {nav.map((n) => {
                  const active = isActive(n.to, pathname, section);
                  return (
                    <li key={n.to}>
                      <Link
                        to={n.to}
                        onClick={() => jump(n.to)}
                        aria-current={active ? "page" : undefined}
                        className={`block rounded-full px-5 py-3 font-serif text-2xl no-underline ${
                          active ? "bg-ivory font-semibold text-navy-900" : "font-medium text-white hover:bg-white/10"
                        }`}
                      >
                        {n.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>
            <div className="pb-safe flex flex-none flex-col gap-2.5 p-4">
              {me ? (
                <Link to="/app" className="btn btn-gold w-full rounded-full py-3.5">
                  Open my portal
                </Link>
              ) : (
                <>
                  <Link to="/register" className="btn btn-gold w-full rounded-full py-3.5">
                    Join MSAK
                  </Link>
                  <Link to="/login" className="btn w-full rounded-full border border-white/50 py-3.5 text-white">
                    Member log in
                  </Link>
                </>
              )}
              <p className="pt-1 text-center font-serif text-[15px] italic text-gold-300">Faith for campus. Purpose for life.</p>
            </div>
          </div>
        </div>
      )}

      <main id="main" className={`flex-1 ${isHome ? "" : "pt-[80px] sm:pt-[102px]"}`}>
        <Outlet />
      </main>

      <footer className="bg-navy-950 text-sm text-navy-300">
        <div className="container-page grid gap-8 py-12 sm:grid-cols-2 lg:grid-cols-4">
          <div className="sm:col-span-2">
            <Logo light size={52} />
            <p className="mt-4 max-w-sm leading-relaxed">
              Connecting, discipling and equipping Messianic students to live with purpose across Kenya.
            </p>
          </div>
          <div>
            <p className="mb-3 font-semibold text-white">Explore</p>
            <ul className="space-y-2">
              <li><Link to="/churches" className="text-navy-100">Find a church</Link></li>
              <li><Link to="/#story" className="text-navy-100">Our story</Link></li>
              <li><Link to="/register" className="text-navy-100">Become a member</Link></li>
              <li><Link to="/login" className="text-navy-100">Member login</Link></li>
            </ul>
          </div>
          <div>
            <p className="mb-3 font-semibold text-white">Policies</p>
            <ul className="space-y-2">
              {policyList.map((p) => (
                <li key={p.slug}>
                  <Link to={`/policies/${p.slug}`} className="text-navy-100">
                    {p.title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="border-t border-navy-800">
          <p className="container-page py-5">© {new Date().getFullYear()} MSAK — Messianic Students Association of Kenya</p>
        </div>
      </footer>

      <DemoBanner floating />
    </div>
  );
}
