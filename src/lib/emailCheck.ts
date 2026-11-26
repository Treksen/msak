/**
 * Catches mistyped and throwaway email addresses at registration (there's no confirmation email to catch them).
 *  - format: one @, no spaces, a domain with a dot and a real-looking ending
 *  - typos of common providers: "jonh@gmial.com" → suggests "jonh@gmail.com"; ".con" / ".cm" endings
 *  - throwaway inboxes (mailinator, 10minutemail…) are refused because they disappear
 * University addresses (e.g. @students.ku.ac.ke) are accepted as they are.
 */
export type EmailCheck = { ok: true; suggestion?: string } | { ok: false; error: string };

const PROVIDERS = [
  "gmail.com", "yahoo.com", "yahoo.co.uk", "ymail.com", "outlook.com", "hotmail.com", "hotmail.co.uk", "live.com",
  "msn.com", "icloud.com", "me.com", "aol.com", "proton.me", "protonmail.com", "zoho.com", "gmx.com", "mail.com",
];

/** Common slips that a distance check would miss or get wrong. */
const KNOWN_TYPOS: Record<string, string> = {
  "gmail.co": "gmail.com", "gmail.cm": "gmail.com", "gmail.con": "gmail.com", "gmail.om": "gmail.com", "gmail.comm": "gmail.com",
  "gmail.ke": "gmail.com", "gmail.co.ke": "gmail.com", "gmai.com": "gmail.com", "gamil.com": "gmail.com", "gmial.com": "gmail.com",
  "gnail.com": "gmail.com", "gmaill.com": "gmail.com", "googlemail.co": "googlemail.com",
  "yahoo.co": "yahoo.com", "yahoo.cm": "yahoo.com", "yahoo.con": "yahoo.com", "yaho.com": "yahoo.com", "yahooo.com": "yahoo.com",
  "hotmail.co": "hotmail.com", "hotmail.con": "hotmail.com", "hotmial.com": "hotmail.com", "hotmal.com": "hotmail.com",
  "outlook.co": "outlook.com", "outlook.con": "outlook.com", "outlok.com": "outlook.com", "outloo.com": "outlook.com",
  "icloud.co": "icloud.com", "icloud.con": "icloud.com", "iclod.com": "icloud.com",
};

const DISPOSABLE = new Set([
  "mailinator.com", "10minutemail.com", "10minutemail.net", "guerrillamail.com", "guerrillamail.net", "sharklasers.com",
  "tempmail.com", "temp-mail.org", "tempmail.net", "tempmailo.com", "yopmail.com", "yopmail.net", "trashmail.com",
  "getnada.com", "nada.email", "dispostable.com", "maildrop.cc", "fakeinbox.com", "throwawaymail.com", "mohmal.com",
  "emailondeck.com", "mintemail.com", "mailnesia.com", "spamgourmet.com", "burnermail.io", "tempr.email", "discard.email",
  "1secmail.com", "1secmail.net", "mail.tm", "moakt.com", "inboxkitten.com",
]);

function distance(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      // letters swapped: "gmial" / "gmail"
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  return d[a.length][b.length];
}

export function checkEmail(raw: string): EmailCheck {
  const email = raw.trim();
  if (!email) return { ok: false, error: "Enter your email address." };
  if (/\s/.test(email)) return { ok: false, error: "An email address can't contain spaces." };
  const parts = email.split("@");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return { ok: false, error: "An email address has one @, like name@gmail.com." };
  const [local, rawDomain] = parts;
  const domain = rawDomain.toLowerCase();
  if (local.length > 64 || /^\.|\.$|\.\./.test(local) || !/^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+$/.test(local)) {
    return { ok: false, error: "The part before the @ doesn't look right." };
  }
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(domain) || domain.split(".").some((l) => !l || l.startsWith("-") || l.endsWith("-"))) {
    return { ok: false, error: "The part after the @ doesn't look right, e.g. gmail.com." };
  }
  const tld = domain.slice(domain.lastIndexOf(".") + 1);
  if (!/^[a-z]{2,}$/.test(tld)) return { ok: false, error: "The ending after the last dot doesn't look right (e.g. .com, .ke)." };
  if (DISPOSABLE.has(domain)) return { ok: false, error: "Please use an email address you'll keep — temporary inboxes disappear and you'd lose your account." };

  const fix = (d: string) => `${local}@${d}`;
  if (KNOWN_TYPOS[domain]) return { ok: true, suggestion: fix(KNOWN_TYPOS[domain]) };
  if (PROVIDERS.includes(domain) || domain.endsWith(".ac.ke") || domain.endsWith(".edu")) return { ok: true };
  // ".con", ".cmo", ".comm" endings on any domain
  const tldFix: Record<string, string> = { con: "com", cmo: "com", cm: "com", comm: "com", om: "com", ocm: "com", vom: "com", xom: "com", nt: "net", nte: "net", ogr: "org" };
  if (tldFix[tld] && !(tld === "cm" && !PROVIDERS.some((p) => p.startsWith(domain.slice(0, -3))))) {
    const fixed = `${domain.slice(0, -tld.length)}${tldFix[tld]}`;
    if (PROVIDERS.includes(fixed) || tld !== "cm") return { ok: true, suggestion: fix(fixed) };
  }
  // close to a common provider (1–2 letters off)
  let best: { d: string; n: number } | null = null;
  for (const p of PROVIDERS) {
    const n = distance(domain, p);
    if (n > 0 && n <= (p.length > 9 ? 2 : 1) && (!best || n < best.n)) best = { d: p, n };
  }
  if (best) return { ok: true, suggestion: fix(best.d) };
  return { ok: true };
}
