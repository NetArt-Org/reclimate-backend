# Reclimate dMRV · Backend

Payload CMS 3 + Neon Postgres backend for the **Artisan Pro** app (`../reclimate-dmrv`).
Runs as its own Next.js server: admin panel at `/admin`, REST API at `/api`.

## First run

```bash
cp .env.example .env     # then fill in DATABASE_URL, PAYLOAD_SECRET, SEED_* values
npm install
npm run seed             # creates the tables and the demo data (once)
npm run dev              # http://localhost:3001/admin
```

`DATABASE_URL` is the **pooled** connection string from the Neon dashboard (Connect → Pooled connection).
In development Payload creates and updates the tables itself on start-up, so there is no migration step.
Before a production deploy, run `npm run payload migrate:create` and commit the migration.

Sign in to `/admin` with username `admin` and your `SEED_ADMIN_PASSWORD`. The demo worker and
supervisors sign in from the app with their phone number and `SEED_DEMO_PIN`.

To wipe the demo data and start again: `SEED_RESET=true npm run seed`.

## Data model

| Collection | What it holds | App screen |
|---|---|---|
| `users` | Admins, supervisors, workers. Login = phone digits + PIN | Login, Profile, Supervisors |
| `sites` | Production sites | Site picker |
| `setup-items` | Per-site lists: kilns, sources, farmers, vehicles, bags, buyers… | Profile → Site setup |
| `batches` | One biochar batch; a tab per wizard day + the supervisor's review | Home, Process, Wizard, Review |
| `media` | Photos and videos (local `./media` folder for now, S3 later) | Camera |
| `credit-transactions` | Credits ledger (earned / sold) | Credits history |
| `sell-requests` | A worker's request to sell credits | Credits → Sell |
| `settings` (global) | Credit factor, price, goal, max moisture | — |

Rules enforced on the server (`src/hooks`, `src/access`):

- Workers see only their own batches; supervisors see their site's; admins see everything.
- Workers cannot approve or reject a batch, and can only finish one that was approved.
- `collect.weightKg` and `credits` are computed on save.
- Approving a batch writes one "earned" row to the ledger; marking a sell request **paid** writes one "sold" row.

## API quick reference

```
POST /api/users/login            { "username": "<phone digits>", "password": "<PIN>" } → { token, user }
GET  /api/users/me               Authorization: JWT <token>
GET  /api/batches?depth=1        the signed-in user's batches
POST /api/batches                create      PATCH /api/batches/:id   save a wizard step / review
POST /api/media                  multipart upload (field "file")
GET  /api/setup-items?where[category][equals]=kilns
GET  /api/credit-transactions?locale=all&sort=-date
GET  /api/globals/settings
```

After changing a collection, run `npm run generate:types` to refresh `src/payload-types.ts`.
