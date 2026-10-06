# Reclimate dMRV · Admin

Next.js 16 admin for Reclimate's biochar dMRV. **Neon Postgres** holds all records; **Firebase** handles sign-in and
stores files. Payload 3 runs headless as the data and REST layer; its own admin UI is disabled.
The one interface is `/admin`.

## First run

```bash
cp .env.example .env     # DATABASE_URL, PAYLOAD_SECRET, the Firebase values, ADMIN_EMAILS
npm install
npm run migrate          # creates/updates the tables in Neon
npm run dev              # http://localhost:3001/admin
```

`DATABASE_URL` is the **pooled** connection string from Neon (Connect → Pooled connection).

## Sign-in (Firebase)

Admins sign in with **email + password**, or with **Google** if they switch on "Allow Google sign-in" in their profile
(Account → Edit profile). The browser signs in with Firebase and sends the ID token to `/admin/session`, which sets an
HttpOnly session cookie (5 days). Every request is checked against the Firebase account linked to the `users` row;
an invited row is linked on first sign-in only when Firebase has verified the email.

- Firebase console → Authentication → Sign-in method: enable **Email/Password** and **Google**.
- First admin: `npm run admin:create -- you@company.com "Your Name"` prints a set-password link.
  Or list your Google address in `ADMIN_EMAILS` and sign in with Google once.
- Everyone else: Settings → Admin access → Invite admin.

## Migrating from Circonomy

1. Export: signed in to admin.circonomy.co, the export script reads every record through their API and saves
   `circonomy-export.json`; put it in `data/import/` (git-ignored — it contains staff names, phones and emails).
2. `npm run import:circonomy` — loads it into Neon, keeping Circonomy's ids. Re-runnable: run it again with a newer
   export to update what changed and add what is new, until the switch-over.
3. `npm run media:copy` — copies the photos, videos and PDFs into Firebase Storage. The download links in an export
   expire about 6 days after it was made; export again if copying reports expired links.
   While testing on the free tier: `MEDIA_SKIP=batches npm run media:copy` (documents, certificates, kiln/container
   photos) and `MEDIA_ONLY=batches MEDIA_MAX_GB=1.5 npm run media:copy` (newest batches first, capped).

## Schema changes

Tables change only through migrations, in development too (`push` is off):

```bash
# edit a collection in src/collections, then
npm run migrate:create <name>    # writes src/migrations/<date>_<name>.ts — commit it
npm run migrate
npm run generate:types
```

In production the migrations run on start-up (`prodMigrations`).

## Data model

| Collection | Holds |
|---|---|
| `organizations` → `networks` → `sites` → `kilns` | Partner orgs (ID01, MY01, STAF), production networks, sites, kilns |
| `people` | Network staff: managers, supervisors, operators, farmers (they do not sign in here) |
| `batches` | One kiln firing: quantities, C-sink, assessment, sink and registry status |
| `biomass-collections`, `mixings`, `packagings` | Field records; mixings/packagings link to their batches |
| `stocks`, `sinks`, `documents` | Credit ledgers and compliance documents |
| `feedstocks`, `templates`, `vehicles` | Settings: methane strategy and lab values, kiln/container templates |
| `files` | Every file's record; the bytes are in Firebase Storage. Served at `/admin/files/<id>` to admins |
| `alerts`, `activity-logs` | Action Center items and the audit trail |
| `company` (global) | The C-sink manager's profile, app rules, projects, certificates |
| `users` | Who may sign in (Firebase), with role |
| `containers`, `biomass-sources`, `inventories`, `applications` | Measuring/sampling containers, biomass sources, packed inventory, sink applications |

Imported records keep their source UUIDs as primary keys, so IDs match the old system.

## Code map

- `src/collections`, `src/globals` — schema; `src/migrations` — migrations
- `src/dashboard/server` — server-only reads (`load.ts`) and server actions (every write checks for an admin session)
- `src/dashboard/data/store.tsx` — client store: updates the screen, then saves through a server action
- `src/dashboard/{home,portfolio,production,networks,account,settings}` — the screens
