/** Shown for a moment while a page's code downloads on first visit. */
export function PageLoading() {
  return (
    <div className="flex min-h-[60dvh] items-center justify-center" role="status" aria-live="polite">
      <img src="/brand/msak-crest-128.webp" alt="" width={56} height={56} className="animate-pulse" />
      <span className="sr-only">Loading…</span>
    </div>
  );
}

/** Thin gold bar at the top of the screen while the next page loads. */
export function NavProgress({ active }: { active: boolean }) {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none fixed inset-x-0 top-0 z-[2000] h-[3px] origin-left bg-gold-500 transition-[transform,opacity] duration-500 ${
        active ? "scale-x-75 opacity-100" : "scale-x-0 opacity-0"
      }`}
    />
  );
}
