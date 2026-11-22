# MSAK Portal

Public website, national church map and member portal for the **Messianic Students Association of Kenya** —
one installable web app (PWA) that works on desktop and phones.

**Stack:** Vite · React 19 · TypeScript · Tailwind CSS 4 · React Router 7 · Supabase (auth, Postgres, storage) · Leaflet + OpenStreetMap · vite-plugin-pwa · Vercel.

---

## 1. Run it on your computer (no backend needed)

Requires **Node.js 20+**.

```bash
npm install
npm run dev
```

Open http://localhost:5173.

With no Supabase keys the app runs in **demo mode**: sample data lives in your browser, and the login page has
**“Preview as…”** buttons so you can click through every role:

| Persona | What to try |
|---|---|
| Member | Feed of campus + region + national notices, church map, suggest a church, request a leader role |
| Institutional leader | Post to JKUAT, add/pin churches in NAMSA, see JKUAT members |
| Regional leader | Approve the pending JKUAT/KU campus leader request, post to NAMSA, confirm the “Githurai 45” church suggestion |
| National leader | Post to everyone, see all members |
| Administrator | Approve regional/national leaders, upload documents, add institutions, make admins, read feedback |

“Reset demo data” on the login page starts over.

## 2. Connect Supabase

1. Create a project at https://supabase.com (region: closest to Kenya, e.g. *eu-central* or *af-south* if offered).
2. **SQL Editor → New query**, run these files from `supabase/` **in order**:
   1. `01_schema.sql` — tables, security rules, functions, storage bucket
   2. `02_seed.sql` — 8 associations, 30 counties, 272 institutions and the 15 imported NAMSA churches
   (then `03_admin_bootstrap.sql` in step 7 below)
3. **Project Settings → API**: copy the Project URL and the `anon` / publishable key.
4. `cp .env.example .env.local` and fill in:
   ```
   VITE_SUPABASE_URL=https://xxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJ... (or sb_publishable_...)
   ```
   Never put the `service_role` / secret key in this app.
5. **Authentication → URL Configuration**
   - Site URL: your production URL (e.g. `https://msak.vercel.app`)
   - Redirect URLs: add `http://localhost:5173/**` and `https://YOUR-DOMAIN/**`
6. Restart `npm run dev`.
7. **Create your administrator account** (admins are not students and never register through the app):
   - **Authentication → Users → Add user → Create new user**: your email + a strong password, tick **Auto Confirm User**.
   - Edit the email in `supabase/03_admin_bootstrap.sql` and run it in SQL Editor.
   - Log in to the portal with that email and password.
   You're **invisible to members**: you appear in no member or leader list, your announcements are signed
   "MSAK National Office" and churches you add are credited to "MSAK". Add more admins the same way, or promote a
   registered member from **Members**.

> Already ran an older `01_schema.sql` (before 22 Nov 2026)? Run `supabase/04_admin_accounts_migration.sql` once
> to get admin accounts without a profile. A fresh setup doesn't need it.

> Email: Supabase's built-in mailer is rate-limited (a few emails per hour). Before launch, add an SMTP provider
> (e.g. Resend, Brevo) under **Authentication → Emails → SMTP Settings**, and customise the confirmation and
> reset-password templates with the MSAK name.

## 3. Deploy to Vercel

1. Push this folder to a GitHub repo and **Import** it in Vercel (framework: Vite — detected automatically).
2. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` under **Settings → Environment Variables** (Production and Preview).
3. Deploy. `vercel.json` already routes every page to the app and sets the service-worker cache headers.
4. Put the Vercel URL into Supabase's Site URL / Redirect URLs (step 2.5).

## 4. Who can do what

Permissions are enforced **in the database** (row-level security + checked functions in `01_schema.sql`); the
screens only hide buttons you can't use.

| | Member | Institutional leader | Regional leader | National leader | Admin |
|---|---|---|---|---|---|
| See announcements | own campus, own association, national | same + own posts | + all posts in association | everything | everything |
| Post (goes live immediately) | — | own institution | own association | all members | any audience |
| Verify leaders | — | — | campus leaders in own association | — | national + regional (and any campus) |
| Churches | view, suggest | add / edit / confirm in own association | same | anywhere | anywhere |
| Members list | — | own institution | own association | everyone | everyone + make admins |
| Documents | read | read | read | read | upload / delete |

Leader requests start as **pending** — from registration or later from *My profile*. A member who changes institution
automatically loses their campus role (and regional role if the association changes).

## 5. The church map

- Public at `/churches` — no login needed. “Near me” sorts by distance using the phone's GPS.
- Leaders: **Churches → Add a church → Use my location** while standing at the church drops the pin exactly; tick
  “I've confirmed this pin on site”. Members' entries become suggestions until a leader in that association publishes them.
- The 15 churches imported from the old NAMSA page have **approximate pins** and only their own contacts (copies of
  another church's placeholder phone/email were removed). Each shows “Pin position not yet confirmed on site” until a
  leader edits it.
- **Satellite is the default view** on the homepage map, the church page and the pin picker, with a **Satellite / Map**
  switch in the corner (the choice is remembered on each device):
  - Satellite: Esri World Imagery with Esri road and place-name labels on top.
  - Map: the OpenStreetMap street map.
- Both are free to use with the credit line shown in the map corner (already included). OpenStreetMap has no satellite
  imagery of its own, which is why satellite comes from Esri. If traffic grows a lot, or you want a provider with a
  formal free plan, sign up with MapTiler (free key) and set `VITE_SATELLITE_TILE_URL`, `VITE_SATELLITE_ATTRIBUTION`
  and, if needed, `VITE_MAP_TILE_URL` in `.env.local` — no code changes.
- On phones the homepage map doesn't capture swipes, so the page still scrolls; the full church page map pans normally.

## 6. Install as an app (PWA)

The production build (`npm run build && npm run preview`, or the Vercel deploy) registers a service worker:
Android/desktop Chrome show an **Install** button (also offered inside the portal); on iPhone use *Share → Add to Home Screen*.
Offline, the app shell, previously loaded announcements/churches and viewed map tiles keep working.
The service worker is not active in `npm run dev`.

## 7. Brand

- `public/brand/msak-crest-*.png` — the original MSAK crest with its white background removed (transparent PNG).
- `public/favicon-32.png`, `favicon-64.png` — browser tab icon (the same crest).
- `public/icons/` — installed-app icons: the crest on a navy tile (phones need a solid square).
- The public navbar is the **Floating Glass** design: a rounded translucent navy bar over the hero. On phones and
  tablets it shows only the crest, **Join** and a menu button; the links open in a full-screen glass menu, so nothing
  ever wraps onto two lines.

## 8. Project layout

```
supabase/            SQL to run in Supabase (schema, seed, first admin)
public/              icons, photos, favicon
src/
  main.tsx, App.tsx  entry + routes
  index.css          Covenant design tokens (navy & gold) + base components
  lib/
    api.ts           the app's backend interface + friendly error messages
    api-supabase.ts  real implementation
    api-demo.ts      demo-mode implementation (same rules, localStorage)
    auth.tsx         session, current member, permissions
    directory.ts     association → county → institution lookups
    geo.ts, format.ts, policies.ts, types.ts
  components/        layouts (Floating Glass navbar), church map/finder/form, StoryJourney, announcements, UI kit
  pages/public/      home, church map, policies, login, register, password reset
  pages/portal/      overview, announcements, churches, documents, profile, feedback,
                     leader approvals, members, administration
  data/              directory.json, churches.seed.json, policies/*.json
```

**Editing policies:** change the JSON in `src/data/policies/` and redeploy.
**Adding institutions:** admins can add them in *Administration*; to add many at once, insert rows in Supabase.

## 9. Commands

| | |
|---|---|
| `npm run dev` | development server |
| `npm run build` | type-check + production build into `dist/` |
| `npm run preview` | serve the production build locally (PWA active) |
| `npm run typecheck` | TypeScript only |
