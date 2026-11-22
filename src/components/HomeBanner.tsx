import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import type { HomeBanner } from "../lib/types";
import { bannerEnd, formatEventDates } from "../lib/banners";

function useNow(active: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [active]);
  return now;
}

function split(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return { days: Math.floor(s / 86400), hours: Math.floor((s % 86400) / 3600), mins: Math.floor((s % 3600) / 60), secs: s % 60 };
}

type Props = {
  banner: Pick<HomeBanner, "title" | "venue" | "starts_at" | "ends_at" | "link_url" | "link_label">;
  /** "glass": translucent panel floating on the hero photo (homepage). "strip": solid full-width bar. */
  variant?: "glass" | "strip";
  preview?: boolean;
};

/**
 * Event banner with a live countdown. On the homepage it floats on the hero photo, just under the navbar.
 * Desktop: title · countdown · dates & venue in one row. Phones: the same three, centred, one under the other.
 */
export function HomeBannerStrip({ banner, variant = "glass", preview = false }: Props) {
  const now = useNow(true);
  const start = new Date(banner.starts_at).getTime();
  const end = bannerEnd(banner);
  const valid = !Number.isNaN(start);
  const happening = valid && now >= start && now < end;
  const ended = valid && now >= end;
  const t = split(start - now);
  const dates = valid ? formatEventDates(banner.starts_at, banner.ends_at) : "Choose a start date";
  const units: [number, string][] = [
    [t.days, "Days"],
    [t.hours, "Hours"],
    [t.mins, "Mins"],
    [t.secs, "Secs"],
  ];

  return (
    <section
      aria-label={`Upcoming event: ${banner.title}`}
      className={
        variant === "glass"
          ? "rounded-[22px] border border-gold-300/40 bg-navy-900/55 text-white shadow-[0_12px_32px_rgba(0,0,0,0.25)] backdrop-blur-md"
          : `border-b-2 border-gold-500 bg-gradient-to-r from-navy-950 via-navy-900 to-[#1238a8] text-white ${preview ? "rounded-lg" : ""}`
      }
    >
      <div
        className={`grid items-center gap-3.5 text-center md:grid-cols-[1fr_auto_1fr] md:gap-8 md:text-left ${
          variant === "glass" ? "px-4 py-4 sm:px-8 sm:py-5" : "container-page py-5 md:py-6"
        }`}
      >
        <p className="text-[15px] font-bold uppercase leading-snug tracking-[0.06em] sm:text-lg">{banner.title || "Event title"}</p>

        <div className="flex justify-center">
          {happening ? (
            <span className="inline-flex items-center gap-2.5 rounded-full bg-gold-500 px-5 py-2.5 text-sm font-bold uppercase tracking-wider text-navy-900">
              <span className="relative flex size-2.5">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-navy-900 opacity-60 motion-reduce:hidden" />
                <span className="relative inline-flex size-2.5 rounded-full bg-navy-900" />
              </span>
              Happening now
            </span>
          ) : ended ? (
            <span className="rounded-full border border-navy-500 px-5 py-2 text-sm font-semibold text-navy-200">This event has ended</span>
          ) : (
            <div role="timer" aria-hidden="true" className="flex items-start">
              {units.map(([n, label], i) => (
                <div key={label} className="flex items-start">
                  {i > 0 && <span className="px-1.5 pt-1 text-lg font-semibold text-gold-500 sm:px-3 sm:text-xl">:</span>}
                  <span className="flex w-12 flex-col items-center sm:w-16">
                    <span className="font-sans text-[26px] font-bold leading-none tabular-nums text-gold-300 sm:text-[32px]">
                      {String(n).padStart(2, "0")}
                    </span>
                    <span className="mt-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-navy-200 sm:text-[11px]">{label}</span>
                  </span>
                </div>
              ))}
            </div>
          )}
          {!happening && !ended && valid && (
            <span className="sr-only">
              Starts {dates}
              {banner.venue ? ` at ${banner.venue}` : ""}.
            </span>
          )}
        </div>

        <div className="flex flex-col items-center gap-1 md:items-end md:text-right">
          <p className="text-sm font-bold uppercase tracking-wide text-gold-300">{dates}</p>
          {banner.venue && <p className="text-sm uppercase tracking-wide text-navy-100">{banner.venue}</p>}
          {banner.link_url && (
            <a
              href={banner.link_url}
              target="_blank"
              rel="noreferrer"
              className="mt-1.5 inline-flex items-center gap-1.5 text-sm font-semibold text-white underline decoration-gold-500 underline-offset-4"
            >
              {banner.link_label || "Details"}
              <ArrowRight className="size-4" aria-hidden="true" />
            </a>
          )}
        </div>
      </div>
    </section>
  );
}
