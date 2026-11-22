import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { MapPin } from "lucide-react";
import { api } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { makeLookup } from "../../lib/directory";
import type { Church, HomeBanner, Stats } from "../../lib/types";
import { InstallPrompt } from "../../components/InstallPrompt";
import { StoryJourney } from "../../components/StoryJourney";
import { HomeBannerStrip } from "../../components/HomeBanner";
import { Photo } from "../../components/Photo";
import { LazyChurchMap } from "../../components/LazyChurchMap";
import { useSeo } from "../../lib/seo";

export function HomePage() {
  const { directory } = useAuth();
  const lookup = makeLookup(directory);
  const [stats, setStats] = useState<Stats | null>(null);
  const [churches, setChurches] = useState<Church[]>([]);
  const [assoc, setAssoc] = useState<number | "all">("all");
  const [banner, setBanner] = useState<HomeBanner | null>(null);

  useSeo({
    title: "MSAK — Messianic Students Association of Kenya",
    description:
      "MSAK connects, disciples and equips Messianic students in universities and colleges across Kenya. Find your regional association, join as a member, and find a Sabbath-keeping church near your campus.",
    path: "/",
  });

  useEffect(() => {
    api.getStats().then(setStats).catch(() => setStats(null));
    api
      .listLiveBanners()
      .then((rows) => setBanner(rows[0] ?? null))
      .catch(() => setBanner(null));
    api
      .listChurches()
      .then((rows) => setChurches(rows.filter((c) => c.status === "published")))
      .catch(() => setChurches([]));
  }, []);

  const s: Stats = stats ?? {
    associations: directory?.associations.length ?? 8,
    counties: directory?.counties.length ?? 30,
    institutions: directory?.institutions.length ?? 272,
    churches: churches.length,
  };
  const shown = useMemo(() => churches.filter((c) => assoc === "all" || c.association_id === assoc), [churches, assoc]);
  const counts = useMemo(() => {
    const m = new Map<number, number>();
    churches.forEach((c) => m.set(c.association_id, (m.get(c.association_id) ?? 0) + 1));
    return m;
  }, [churches]);

  return (
    <>
      {/* Hero — the floating navbar sits on top of this photo */}
      <section className="relative flex min-h-[600px] flex-col overflow-hidden sm:min-h-[680px] lg:min-h-[720px]">
        <Photo
          src="/photos/photo-0058"
          alt="MSAK students gathered in song at a national rally"
          className="absolute inset-0 size-full object-cover object-[55%_40%]"
          priority
        />
        <div aria-hidden="true" className="absolute inset-0 bg-navy-950/60" />

        <div
          className={`container-page relative flex flex-1 flex-col justify-end gap-5 pt-28 text-white sm:gap-6 sm:pt-36 ${
            banner ? "pb-6 sm:pb-8" : "pb-12 sm:pb-16 lg:pb-20"
          }`}
        >
          <p className="eyebrow !text-gold-300">A national Messianic student fellowship</p>
          <h1 className="max-w-[820px] font-serif text-[clamp(40px,6.2vw,80px)] font-semibold leading-[1.03]">
            Grounded in Truth.
            <br />
            United in Faith.
          </h1>
          <p className="max-w-[520px] text-base leading-relaxed text-navy-100 sm:text-lg">
            Connecting, discipling and equipping Messianic students to live with purpose across Kenya.
          </p>
          <div className="flex flex-col gap-3 pt-1 sm:flex-row">
            <Link to="/register" className="btn btn-gold rounded-full px-7 py-3.5">
              Become a member
            </Link>
            <Link to="/churches" className="btn rounded-full border border-white/60 bg-white/10 px-7 py-3.5 text-white hover:bg-white/20">
              Find a church near you
            </Link>
          </div>

          {/* Event banner sits in the open space below the buttons (managed in Administration → Homepage banner) */}
          {banner && (
            <div className="mt-4 sm:mt-8">
              <HomeBannerStrip banner={banner} />
            </div>
          )}
        </div>
      </section>

      {/* Numbers */}
      <section aria-label="MSAK at a glance" className="border-b border-line bg-white">
        <dl className="container-page grid grid-cols-2 gap-6 py-8 md:grid-cols-4">
          {[
            [s.associations, "regional associations"],
            [s.counties, "counties reached"],
            [s.institutions, "universities & colleges"],
            [s.churches, "churches mapped so far"],
          ].map(([n, label]) => (
            <div key={String(label)} className="flex flex-col-reverse gap-1 border-l-2 border-gold-500 pl-4">
              <dt className="text-sm text-muted">{label}</dt>
              <dd className="font-serif text-3xl font-semibold text-navy-900 sm:text-4xl">{n}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* About */}
      <section id="about" className="container-page grid scroll-mt-24 items-center gap-10 py-16 lg:grid-cols-2 lg:gap-16 lg:py-24">
        <div className="flex flex-col gap-5">
          <p className="eyebrow">Who we are</p>
          <h2 className="font-serif text-[clamp(30px,3.5vw,44px)] font-semibold leading-tight text-navy-900">
            A community with a shared identity and conviction
          </h2>
          <p className="text-[17px] leading-relaxed text-body">
            MSAK brings together Messianic students in universities and colleges across Kenya — to grow in faith, build fellowship and serve
            with purpose while they study.
          </p>
          <p className="text-[17px] leading-relaxed text-body">One association. Many institutions. A shared conviction.</p>
        </div>
        <div className="flex items-center justify-center rounded-lg border border-line bg-white p-8 sm:p-10">
          <img
            src="/brand/msak-crest-400.webp"
            width={400}
            height={400}
            alt="The MSAK crest: a menorah on a shield inside a gold ring, with the words Messianic Students Association of Kenya"
            className="h-auto w-full max-w-[320px]"
            loading="lazy"
          />
        </div>
      </section>

      {/* Associations + live church map */}
      <section id="associations" className="scroll-mt-24 border-y border-line bg-white">
        <div className="container-page grid gap-10 py-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] lg:items-center lg:py-20">
          <div className="flex flex-col gap-5">
            <p className="eyebrow">Connected across Kenya</p>
            <h2 className="font-serif text-[clamp(28px,3.2vw,40px)] font-semibold leading-tight text-navy-900">Eight associations, one fellowship</h2>
            <p className="text-[17px] leading-relaxed text-body">
              Every pin is a Sabbath fellowship a leader has mapped. Pick an association to see its churches.
            </p>
            <div role="group" aria-label="Filter the map by association" className="-mx-1 flex flex-wrap gap-1.5 px-1">
              <button
                type="button"
                onClick={() => setAssoc("all")}
                aria-pressed={assoc === "all"}
                className={`rounded-full border px-3.5 py-2 text-[13px] font-semibold ${assoc === "all" ? "border-navy-900 bg-navy-900 text-white" : "border-line-strong bg-white"}`}
              >
                All
              </button>
              {lookup.associations.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setAssoc(a.id)}
                  aria-pressed={assoc === a.id}
                  className={`rounded-full border px-3.5 py-2 text-[13px] font-semibold ${assoc === a.id ? "border-navy-900 bg-navy-900 text-white" : "border-line-strong bg-white"}`}
                >
                  {a.code} <span className="opacity-70">{counts.get(a.id) ?? 0}</span>
                </button>
              ))}
            </div>
            <p className="min-h-[3em] text-sm leading-relaxed text-muted" aria-live="polite">
              {assoc === "all"
                ? `${churches.length} churches mapped across Kenya so far.`
                : `${lookup.association(assoc)?.name} · ${lookup
                    .countiesOf(assoc)
                    .map((c) => c.name)
                    .join(", ")}`}
            </p>
            <Link to="/churches" className="btn btn-primary self-start rounded-full px-6">
              <MapPin className="size-[18px]" aria-hidden="true" />
              Open the church map
            </Link>
          </div>
          <div className="h-[340px] overflow-hidden rounded-xl border border-line-strong sm:h-[440px] lg:h-[500px]">
            <LazyChurchMap churches={shown} fitKey={`home-${assoc}-${shown.length}`} wheelZoom={false} />
          </div>
        </div>
      </section>

      <StoryJourney />

      {/* Join */}
      <section id="join" className="bg-ivory">
        <div className="container-page flex flex-col gap-8 py-16 lg:flex-row lg:items-center lg:justify-between lg:py-20">
          <div className="flex max-w-2xl flex-col gap-3">
            <h2 className="font-serif text-[clamp(28px,3.2vw,40px)] font-semibold leading-tight text-navy-900">
              Your place in the fellowship begins here.
            </h2>
            <p className="text-[17px] leading-relaxed text-body">
              Register in a few minutes, pick your association and institution, and get announcements from your campus, region and the national
              office.
            </p>
          </div>
          <div className="flex flex-col gap-4 lg:w-[380px]">
            <Link to="/register" className="btn btn-gold rounded-full py-3.5">
              Become a member
            </Link>
            <InstallPrompt />
          </div>
        </div>
      </section>
    </>
  );
}
