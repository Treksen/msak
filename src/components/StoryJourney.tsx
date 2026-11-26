import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Photo } from "./Photo";
import { usePastLeadersPublic } from "../lib/pastLeadersSetting";

type Stop = { numeral: string; year: string; label: string; title: string; text: string; photo?: string; alt?: string };

/** MSAK history (from the original site), told as stops along a road. */
const STOPS: Stop[] = [
  {
    numeral: "I",
    year: "2014–15",
    label: "2014 – 2015",
    title: "The first seeds",
    text: "It began on campus. Messianic students registered fellowship groups at the University of Eldoret, Kisii University, Kabianga University and Kenyatta University.",
  },
  {
    numeral: "II",
    year: "4 Feb 2017",
    label: "4 February 2017",
    title: "The first rally",
    text: "The University of Eldoret hosted students from Kabianga, Moi and Kisii universities and colleges in Eldoret. Before they went home, an interim national leadership had been formed.",
    photo: "/photos/photo-0058",
    alt: "Students singing together at an MSAK rally",
  },
  {
    numeral: "III",
    year: "2017",
    label: "2017",
    title: "A national voice",
    text: "Kabianga University hosted the second rally. At a meeting soon after, members elected MSAK’s national office bearers.",
  },
  {
    numeral: "IV",
    year: "2017",
    label: "2017",
    title: "Planning ahead",
    text: "Officials met at Kenyatta University and set their sights on the next year’s rally at Egerton University.",
  },
  {
    numeral: "V",
    year: "2018 – today",
    label: "2018 – today",
    title: "Passing the lamp",
    text: "The third national rally at Egerton was a success. As the founders graduated, leadership passed to new students — and MSAK kept growing.",
    photo: "/photos/photo-0029",
    alt: "MSAK student leaders holding certificates",
  },
  {
    numeral: "VI",
    year: "Now",
    label: "Now",
    title: "Your chapter",
    text: "The road keeps going. The next stop is written by every student who joins a fellowship, leads a campus group or welcomes a new member.",
  },
];

// Road geometry (viewBox 1200 × 180): stops sit on the curve's turning points.
const ROAD =
  "M0 95 C 50 95, 60 60, 100 60 S 250 120, 300 120 S 450 60, 500 60 S 650 120, 700 120 S 850 60, 900 60 S 1050 120, 1100 120 S 1180 100, 1200 100";
const XS = [100, 300, 500, 700, 900, 1100];
const YS = [60, 120, 60, 120, 60, 120];

/**
 * "Our story" as a horizontal journey: a winding road with six stops above a row of
 * chapter cards. Swipe or scroll the cards (native scroll-snap), or tap a stop / the arrows.
 */
export function StoryJourney() {
  const pastLeadersOn = usePastLeadersPublic();
  const [i, setI] = useState(0);
  const track = useRef<HTMLDivElement>(null);
  const cards = useRef<(HTMLElement | null)[]>([]);

  const goTo = useCallback((n: number) => {
    const t = track.current;
    const card = cards.current[n];
    if (!t || !card) return;
    t.scrollTo({ left: card.offsetLeft - t.offsetLeft - parseFloat(getComputedStyle(t).paddingLeft || "0"), behavior: "smooth" });
    setI(n);
  }, []);

  // Keep the highlighted stop in sync with swiping
  useEffect(() => {
    const t = track.current;
    if (!t) return;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const pad = parseFloat(getComputedStyle(t).paddingLeft || "0");
        const x = t.scrollLeft;
        let best = 0;
        let bestD = Infinity;
        cards.current.forEach((c, n) => {
          if (!c) return;
          const d = Math.abs(c.offsetLeft - t.offsetLeft - pad - x);
          if (d < bestD) {
            bestD = d;
            best = n;
          }
        });
        setI(best);
      });
    };
    t.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      t.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <section id="story" aria-labelledby="story-h" className="scroll-mt-24 overflow-hidden bg-navy-900 text-white">
      <div className="container-page flex flex-col gap-8 pb-16 pt-16 lg:gap-10 lg:pb-24 lg:pt-24">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="flex max-w-2xl flex-col gap-3">
            <p className="eyebrow !text-gold-300">Our story</p>
            <h2 id="story-h" className="font-serif text-[clamp(30px,4.2vw,48px)] font-semibold leading-[1.06]">
              The road from four campuses to a nation
            </h2>
            <p className="text-[17px] text-navy-200">Travel the journey stop by stop.</p>
          </div>
          <div className="hidden items-center gap-3 sm:flex">
            <span className="text-sm text-navy-300" aria-live="polite">
              Stop {i + 1} of {STOPS.length}
            </span>
            <ArrowButtons i={i} goTo={goTo} />
          </div>
        </div>

        {/* The road */}
        <div className="relative -mx-1 h-[92px] sm:mx-0 sm:h-[170px]">
          <svg aria-hidden="true" viewBox="0 0 1200 180" preserveAspectRatio="none" className="absolute inset-0 size-full">
            <defs>
              <clipPath id="road-travelled">
                <rect x="0" y="0" width={XS[i]} height="180" style={{ transition: "width 450ms ease" }} />
              </clipPath>
            </defs>
            <path d={ROAD} fill="none" stroke="#24407F" strokeWidth="10" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
            <path d={ROAD} fill="none" stroke="#5B6E9E" strokeWidth="2" strokeDasharray="10 10" vectorEffect="non-scaling-stroke" />
            <path d={ROAD} clipPath="url(#road-travelled)" fill="none" stroke="#C9A04A" strokeWidth="10" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          </svg>
          {STOPS.map((s, n) => {
            const state = n === i ? "current" : n < i ? "past" : "future";
            return (
              <button
                key={s.numeral}
                type="button"
                onClick={() => goTo(n)}
                aria-label={`Stop ${s.numeral}: ${s.title}, ${s.label}`}
                aria-current={n === i ? "step" : undefined}
                className="absolute flex size-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center"
                style={{ left: `${(XS[n] / 1200) * 100}%`, top: `${(YS[n] / 180) * 100}%` }}
              >
                <span
                  className={`absolute bottom-[calc(100%+2px)] hidden whitespace-nowrap text-[13px] font-bold tracking-wide sm:block ${
                    state === "current" ? "text-gold-300" : state === "past" ? "text-navy-200" : "text-navy-500"
                  }`}
                >
                  {s.year}
                </span>
                <span
                  className={`flex flex-none items-center justify-center rounded-full font-serif font-bold transition-all ${
                    state === "current"
                      ? "size-9 border-[3px] border-white bg-gold-500 text-sm text-navy-900 shadow-[0_0_0_6px_rgba(201,160,74,0.25)] sm:size-14 sm:text-xl"
                      : state === "past"
                        ? "size-7 border-2 border-navy-900 bg-gold-500 text-[11px] text-navy-900 sm:size-10 sm:text-sm"
                        : "size-7 border-2 border-navy-500 bg-navy-900 text-[11px] text-navy-300 sm:size-10 sm:text-sm"
                  }`}
                >
                  {s.numeral}
                </span>
              </button>
            );
          })}
        </div>

        {/* The chapters */}
        <div
          ref={track}
          className="-mx-5 flex snap-x snap-mandatory scroll-px-5 gap-4 overflow-x-auto scroll-smooth px-5 sm:scroll-px-6 pb-3 pt-2 [scrollbar-width:none] motion-reduce:scroll-auto sm:-mx-6 sm:gap-6 sm:px-6 [&::-webkit-scrollbar]:hidden"
          aria-label="Chapters"
        >
          {STOPS.map((s, n) => {
            const active = n === i;
            return (
              <article
                key={s.numeral}
                ref={(el) => {
                  cards.current[n] = el;
                }}
                aria-current={active ? "step" : undefined}
                className={`flex w-[min(380px,calc(100vw-56px))] flex-none snap-start flex-col overflow-hidden rounded-xl transition-all duration-300 ${
                  active ? "-translate-y-1 bg-ivory shadow-[0_18px_40px_rgba(0,0,0,0.35)]" : "bg-navy-800 opacity-60"
                }`}
              >
                {s.photo && <Photo src={s.photo} alt={s.alt ?? ""} sizes="(min-width: 640px) 360px, 85vw" className="h-40 w-full object-cover sm:h-48" />}
                <div className="flex flex-col gap-2.5 p-6">
                  <span className={`text-xs font-bold uppercase tracking-[0.16em] ${active ? "text-gold-700" : "text-gold-300"}`}>
                    Stop {s.numeral} · {s.label}
                  </span>
                  <h3 className={`font-serif text-[26px] font-semibold leading-tight sm:text-[28px] ${active ? "text-navy-900" : "text-white"}`}>{s.title}</h3>
                  <p className={`text-[15px] leading-relaxed sm:text-base ${active ? "text-body" : "text-navy-200"}`}>{s.text}</p>
                  {n === STOPS.length - 1 && (
                    <Link to="/register" className="btn btn-primary mt-2 self-start rounded-full">
                      Join MSAK
                    </Link>
                  )}
                </div>
              </article>
            );
          })}
          {/* lets the last card scroll to the start on wide screens */}
          <div aria-hidden="true" className="w-0 flex-none sm:w-[calc(100%-404px)]" />
        </div>

        <div className="flex items-center justify-between gap-3 sm:hidden">
          <ArrowButtons i={i} goTo={goTo} />
          <span className="text-sm text-navy-300" aria-live="polite">
            Stop {i + 1} of {STOPS.length} · swipe
          </span>
        </div>

        {pastLeadersOn && (
        <p className="mt-8">
          <Link to="/past-leaders" className="inline-flex items-center gap-1.5 font-semibold text-gold-300 no-underline hover:text-gold-200">
            Meet the leaders who carried the lamp
            <ChevronRight className="size-4" aria-hidden="true" />
          </Link>
        </p>
        )}
      </div>
    </section>
  );
}

function ArrowButtons({ i, goTo }: { i: number; goTo: (n: number) => void }) {
  return (
    <div className="flex gap-2">
      <button
        type="button"
        onClick={() => goTo(Math.max(0, i - 1))}
        disabled={i === 0}
        aria-label="Previous stop"
        className="flex size-12 items-center justify-center rounded-full border border-navy-500 text-white disabled:opacity-35"
      >
        <ChevronLeft className="size-6" aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={() => goTo(Math.min(STOPS.length - 1, i + 1))}
        disabled={i === STOPS.length - 1}
        aria-label="Next stop"
        className="flex size-12 items-center justify-center rounded-full bg-gold-500 text-navy-900 disabled:opacity-35"
      >
        <ChevronRight className="size-6" aria-hidden="true" />
      </button>
    </div>
  );
}
