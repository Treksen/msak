import { api } from "./api";

/**
 * Sends unexpected app errors to the admin-only error log.
 * - Same error is sent once per visit; at most 10 reports per visit.
 * - Skips browser noise (extensions, ResizeObserver, cancelled requests) and errors while offline.
 * - Only the page path is sent — never the query string or #hash (password-reset links carry tokens there).
 */
const sent = new Set<string>();
let count = 0;

const NOISE = [
  /ResizeObserver loop/i,
  /^Script error\.?$/i,
  /AbortError|The operation was aborted|signal is aborted/i,
  /chrome-extension:|moz-extension:|safari-extension:|safari-web-extension:/i,
  /Non-Error promise rejection captured/i,
];

function describe(err: unknown): { message: string; stack: string | null } {
  if (err instanceof Error) return { message: `${err.name}: ${err.message}`, stack: err.stack ?? null };
  if (typeof err === "string") return { message: err, stack: null };
  if (err && typeof err === "object" && "message" in err) return { message: String((err as { message: unknown }).message), stack: null };
  try {
    return { message: JSON.stringify(err).slice(0, 500), stack: null };
  } catch {
    return { message: String(err), stack: null };
  }
}

export function reportError(err: unknown, where?: string) {
  try {
    if (typeof navigator !== "undefined" && navigator.onLine === false) return;
    const { message, stack } = describe(err);
    const text = where ? `${message} (${where})` : message;
    if (!message || NOISE.some((re) => re.test(message) || (stack ? re.test(stack) : false))) return;
    const key = text.slice(0, 200);
    if (sent.has(key) || count >= 10) return;
    sent.add(key);
    count++;
    void api.logClientError({
      message: text.slice(0, 1000),
      stack: stack?.slice(0, 4000) ?? null,
      url: `${location.origin}${location.pathname}`,
      userAgent: navigator.userAgent.slice(0, 300),
    });
  } catch {
    /* never let reporting break the app */
  }
}

export function installErrorReporting() {
  window.addEventListener("error", (e) => reportError(e.error ?? e.message));
  window.addEventListener("unhandledrejection", (e) => reportError(e.reason, "unhandled promise"));
}
