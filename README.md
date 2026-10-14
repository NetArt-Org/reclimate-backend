# Reclimate dMRV · Admin

Next.js 16 backend for Reclimate's biochar dMRV: the admin panel (`/admin`), the field app's API (`/api/field`) and
the public pages the app links to (`/privacy`, `/terms`, `/account-deletion`). **Neon Postgres** holds all records;
**Firebase** handles sign-in and stores files. Payload 3 runs headless as the data layer; its own admin UI is disabled.
Hosted on **Firebase App Hosting**. It is the single source of truth for both field-app layouts.

## First run

```bash
cp .env.example .env.development   # LOCAL: local test database, http://localhost:3001 (used by dev and scripts)
cp .env.example .env.production    # PRODUCTION: Neon, the live URL (used by build/start and NODE_ENV=production scripts)
                                   # both git-ignored; .env.example explains every value
npm install
npm run migrate          # creates/updates the tables in the LOCAL database
                         # production: NODE_ENV=production npm run migrate
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

## Hosting (Firebase App Hosting)

Configuration is in `apphosting.yaml` (instances, memory, environment) and `firebase.json`.

```bash
npm i -g firebase-tools && firebase login
firebase apphosting:secrets:set database-url     # the Neon pooled connection string (?sslmode=require)
firebase apphosting:secrets:set payload-secret   # openssl rand -hex 32
firebase apphosting:backends:create              # once: name it reclimate-backend, root directory "."
# set SERVER_URL in apphosting.yaml to the backend's URL (or custom domain), then:
firebase deploy --only apphosting
```

- On App Hosting the backend uses its own service account for Firebase Auth and Storage — no private key is
  deployed. Grant that service account the **Firebase Authentication Admin** and **Storage Object Admin** roles
  (Google Cloud console → IAM) if sign-in or uploads report permission errors.
- Migrations run on start-up (`prodMigrations`); run `npm run migrate` against Neon yourself before a deploy that
  changes the schema if you prefer to see them run.
- Requests up to 32 MB are accepted (field videos up to 30 MB); see `UPLOAD_LIMITS` in `src/field/common.ts`.
- `data/` (the Circonomy export, which holds personal data) is never deployed (`firebase.json` → `ignore`).

## Field API security

- **Sign-in on every request**: the Firebase ID token is verified and the person's app access re-checked (cached
  for 20 s per account). Sign-ups need a verified email and an admin's approval.
- **Rate limits** (`src/field/ratelimit.ts`): per account for reads, writes, uploads, sell requests and account
  deletion, per address for sign-ups and unsigned requests. Writes and uploads are counted in Postgres
  (`field_rate_limits`) so limits hold across instances. Over the limit → `429` with `Retry-After`.
- **Safe retries**: batches are saved by code, records and uploads carry the phone's own id (`clientId`), sell
  requests allow one open request — a request repeated after a lost reply is not stored twice.
- **Input checks**: body size limits, file types and sizes, quantity and coordinate ranges, string lengths.
- **Caching** (`src/field/cache.ts`): network rules, site totals and setup lists are cached in memory for 30–60 s
  and cleared by writes; start-up data carries an ETag, so a phone's poll is a `304` when nothing changed.
- **Access**: files are served only to people at the same site; CORS allows only the app's origins
  (`CORS_ORIGINS`); errors never reveal internals.
- **Account deletion** (`POST /api/field/account/delete`): removes the Firebase sign-in and erases personal details;
  the person's records stay without them (carbon-credit evidence).

## Migrating from Circonomy

1. Export: open https://admin.circonomy.co signed in, paste `src/scripts/circonomy-export.browser.js` into the
   browser console, then run `await __circonomyExport()` and `__circonomyDownload()`. It reads every record through
   Circonomy's API with the page's own session (read-only) and downloads `circonomy-export-<date>.json`; save it as
   `data/import/circonomy-export.json` (git-ignored — it contains staff names, phones and emails).
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
