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

> Already ran an older `01_schema.sql`? Run the migrations you haven't run yet, once each, in order:
> `04_admin_accounts_migration.sql` (admin accounts without a profile), `05_home_banners_migration.sql`
> (homepage event banner) and `06_terms_alumni_logs_migration.sql` (leadership terms, alumni, church reports &
> photos, audit and error logs), `07_church_pins_fix.sql` (church pins from the old site's map) and
> `08_admin_dashboard_migration.sql` (admin dashboard figures, log clean-up), `09_mwihoko_pin.sql` and
> `10_member_verification.sql` (leaders confirm new members) and `11_admin_member_emails.sql` (admins see and
> correct login emails) and `12_past_leadership.sql` (past leadership and the public Past leaders page) and
> `13_edit_leadership_requests.sql` (edit/withdraw leadership requests) and `14_admin_full_control.sql`
> (administrators can edit and delete everything) and `15_past_leaders_visibility.sql` (hide past leaders). A fresh setup with the current
> `01_schema.sql` and `02_seed.sql` doesn't need them.

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

## 4b. Academic year: leadership terms and alumni

- The academic year ends on **31 August** (Kenya time).
- **Leader roles** are approved until the next 31 August. After that they carry no posting or approval rights until
  the leader taps **Renew for next year** (My profile, from 1 July or any time after expiry) **and** the usual approver
  approves again (admin for national/regional, regional leaders for campus leaders). Renewals appear in
  **Leader approvals → Waiting**, marked "Renewal".
- **Alumni:** a member becomes alumni after 31 August of their expected completion year. Alumni get national,
  regional and **alumni** announcements (not their old campus's). National leaders and admins can post to alumni.
  Repeating a year or deferred? The member updates their completion year in My profile and is a student again.

## 4c. Admin dashboard and logs (administrators only)

- **Administration** opens with the dashboard: members (students / alumni), active leaders, approvals waiting,
  churches to check, and this week's activity and app errors, plus members-by-association and new-members charts
  (each has a "Show table" switch) and how many church pins are confirmed on site.
- **Activity & error logs** (`/app/admin/logs`): every change made in the portal (who, what, when, which fields),
  and errors the app hit on people's devices. Errors are sent automatically (once per visit, never while offline;
  only the page path is sent, never links with tokens). Members and leaders can't read either log.
- **Clear old entries** removes log entries older than 30/90/180/365 days.

## 4d. Speed and Google

- **Faster on phones:** only the home page is in the first download; every other page, and the map library, loads
  when it's needed. Photos are WebP in two sizes (phones get the small one). After a new release, an open tab
  reloads itself once instead of breaking.
- **Google:** each public page has its own title, description and canonical address; sharing a link shows the
  MSAK preview image (`public/og-image.jpg`). Each build writes `sitemap.xml` and `robots.txt` (portal and sign-in
  pages are kept out of search). Google also gets structured data about MSAK and every church on the public map.
- **Set `VITE_SITE_URL`** in Vercel → Settings → Environment Variables to your real address once you have your own
  domain (without it, Vercel's production domain is used).
- **Tell Google about the site:** open Google Search Console, add your site address, verify it (the DNS or HTML-tag
  option), then under **Sitemaps** submit `sitemap.xml`. Pages usually appear in results within days to a few weeks.

## 4f. Confirming new members

- New sign-ups start as **waiting**. Their campus leaders, the regional leaders of their association, or an admin
  confirm them under **Members** (a gold "Waiting for confirmation" panel, with a count on the menu). "Not a student"
  needs a short reason, which the member sees.
- While waiting (or declined) a member sees **national announcements only**; campus, regional and alumni
  announcements and the document library open once they are confirmed.
- Approving someone's leader request also confirms them. Moving to another institution sends a member back to
  waiting for the new campus. Everyone registered before migration 10 counts as confirmed.
- Confirmations and declines appear in the Activity log.
- **Declined members** keep a limited account (national announcements, the church map, their profile and Help &
  feedback) but can't request leader roles or suggest/report churches. They don't count as members on the dashboard
  and aren't in the CSV export; leaders find them under the **Declined** filter, where they can still confirm them.
  A leader can't decline someone who holds an active leader role (revoke the role first) or an administrator.
- Admins can **Remove account** for a declined member (deletes the login and profile). Declined accounts are also
  removed automatically **30 days** after the decision: daily by Supabase's scheduler (`pg_cron`; turn it on in
  Database → Extensions *before* running migration 10, or run the migration again afterwards), and whenever an admin
  opens the dashboard.

## 4g. Correcting a member's email (administrators)

Members → each member's login email shows under their name (admins only; also searchable and in the admin's CSV).
**Change email** fixes a mistyped address: the member logs in with the new one and their usual password, and
password resets go there. Check the new address with the member first. Each change is in the Activity log.

## 4h. Alumni and past leadership

- Registration asks **"Are you still studying?"** — graduates choose "I've completed my studies" and join as alumni.
- Alumni see **"Did you serve as an MSAK leader?"** on their dashboard; anyone can add past positions under
  **My profile → Past leadership** (level, campus/association, position, years). Each is sent for confirmation:
  regional leaders confirm campus and regional positions in their association (in **Leader approvals**); the
  admin confirms national ones. Past positions are history only — no posting rights.
- Confirmed national and regional positions appear on the public **Past leaders** page (`/past-leaders`, linked
  from "Our story" and the footer) only if the member ticked "show my name". Leaders and admins see confirmed
  history next to members in **Members**.
- Admins control the public page: **Hide from public** on any confirmed entry (overrides the member's choice), and a
  **Public Past leaders page On/Off** switch at the top of Leader approvals → Past leaders. When off, the page shows
  a notice and its links are removed.
- In **My profile**, a leader request that is still waiting can be **edited** (position title) or **withdrawn**;
  past leadership entries can be **edited** at any time and go back for confirmation.

## 4i. Administrators: edit and delete anything

- **Members → Manage** (per member): edit every profile field and the membership status; assign, edit (level,
  campus/association, position, status, term end) or delete leader roles; edit or delete past leadership; delete
  the account. **Change email** fixes the login address.
- **Announcements**: Edit (title, message) and Delete. **Documents**: edit title/description, delete.
- **Administration → Member feedback**: delete messages. **Churches → Reported problems**: delete reports.
- **Administration → Directory** (`/app/admin/directory`): add, rename, move or delete institutions, counties and
  associations. Anything still linked to members, churches or roles can't be deleted until it's moved.
- Churches, homepage banners and admins were already fully editable. Every change is in the Activity log.

## 5. The church map

**Maps.** The church maps open on the OpenStreetMap street map; the Satellite button shows Esri World Imagery (free, no key) with full detail to zoom 19.

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

## 6. Homepage event banner

**Administration → Homepage banner → New banner**: event name, start (the countdown runs to it), optional end,
venue and a link (e.g. a registration form). A live preview shows exactly what visitors will see.
The strip appears under the homepage photo with a days/hours/minutes/seconds countdown, switches to
"Happening now" during the event, and hides itself after the end (or one day after the start if no end is set).
Untick "Show on the homepage" to keep a banner as a draft. If several are live, the soonest one is shown.

## 6b. Install as an app (PWA)

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
