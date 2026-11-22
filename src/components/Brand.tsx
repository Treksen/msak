import { Link } from "react-router";

/** The original MSAK crest (white background removed), with the wordmark. */
export function Logo({
  size = 48,
  to = "/",
  light = false,
  wordmark = true,
  sub = false,
}: {
  size?: number;
  to?: string;
  light?: boolean;
  wordmark?: boolean;
  sub?: boolean;
}) {
  return (
    <Link to={to} className={`flex min-w-0 items-center gap-2.5 no-underline sm:gap-3 ${light ? "text-white" : "text-navy-900"}`}>
      <img src="/brand/msak-crest-128.webp" alt="" width={size} height={size} className="flex-none" style={{ width: size, height: size }} />
      {wordmark && (
        <span className="flex min-w-0 flex-col leading-tight">
          <span className="font-serif text-lg font-bold tracking-[0.05em] sm:text-[22px]">MSAK</span>
          {sub && (
            <span className={`hidden text-[11px] uppercase tracking-[0.1em] sm:block ${light ? "text-navy-300" : "text-muted"}`}>
              Messianic Students Association of Kenya
            </span>
          )}
        </span>
      )}
      <span className="sr-only">MSAK home</span>
    </Link>
  );
}
