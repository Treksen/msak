import { useEffect } from "react";

/**
 * Per-page title, description, canonical address and sharing preview (Google, WhatsApp, Facebook).
 * Portal and sign-in pages pass noindex so they stay out of search results.
 */
const SITE = ((import.meta.env as Record<string, string | undefined>).VITE_SITE_URL || "").replace(/\/$/, "");
const DEFAULT_DESCRIPTION =
  "MSAK connects, disciples and equips Messianic students in universities and colleges across Kenya. Find your regional association and a Sabbath-keeping church near your campus.";

function setMeta(attr: "name" | "property", key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.content = content;
}

function setCanonical(href: string) {
  let el = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!el) {
    el = document.createElement("link");
    el.rel = "canonical";
    document.head.appendChild(el);
  }
  el.href = href;
}

export function useSeo({ title, description, path, noindex }: { title: string; description?: string; path?: string; noindex?: boolean }) {
  useEffect(() => {
    const full = title.includes("MSAK") ? title : `${title} — MSAK`;
    const desc = description ?? DEFAULT_DESCRIPTION;
    const origin = SITE || location.origin;
    const url = `${origin}${path ?? location.pathname}`;
    document.title = full;
    setMeta("name", "description", desc);
    setMeta("name", "robots", noindex ? "noindex, nofollow" : "index, follow");
    setMeta("property", "og:title", full);
    setMeta("property", "og:description", desc);
    setMeta("property", "og:url", url);
    setMeta("property", "og:image", `${origin}/og-image.jpg`);
    setMeta("name", "twitter:title", full);
    setMeta("name", "twitter:description", desc);
    if (!noindex) setCanonical(url);
  }, [title, description, path, noindex]);
}

/** Keep a whole area (the members' portal) out of search results without touching page titles. */
export function useNoIndex() {
  useEffect(() => {
    setMeta("name", "robots", "noindex, nofollow");
    return () => setMeta("name", "robots", "index, follow");
  }, []);
}
