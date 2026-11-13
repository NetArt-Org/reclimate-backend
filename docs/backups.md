# Backups

Three things hold Reclimate's data. This page covers how each is protected and how to get data back.

| Data | Where | Protection |
|---|---|---|
| All records: batches, people, sites, credits, change history | Neon Postgres | **Daily backup** to a separate Google Cloud bucket (below) **and** Neon's instant restore (point in time) |
| Photos and videos | Firebase Storage bucket `reclimate-d0868.firebasestorage.app` | Soft delete: deleted or overwritten files can be restored for 30 days (setup step 4) |
| Logins | Firebase Auth | Not backed up. If they were lost, people set a password again with "Forgot password?" and their records are still in Postgres |

## Daily database backup

`.github/workflows/backup.yml` runs **every night at 03:30 Malaysia time** (19:30 UTC). It can also be run by hand at any time, for example before a big import: Actions → Database backup → Run workflow.

Each run:
1. Dumps the whole database (`pg_dump`, compressed) with the same Postgres version Neon uses.
2. **Restores the dump into a throwaway Postgres** and checks that the tables and migrations match the live database. A dump that doesn't restore fails the run.
3. Uploads it to `gs://<bucket>/daily/YYYY/MM/DD/`. On the 1st of each month it also goes to `monthly/YYYY/MM/`.

**How long copies are kept:**
- daily copies: 35 days;
- monthly copies: 1 year.

Both are set on the bucket (step 2 below), so nobody can delete a copy early, not even by accident.

A failed run sends an email to the repository admins. Check **Actions → Database backup** from time to time anyway: every successful run lists the saved file and the largest tables.

### Setup (once)

**Status (13 Nov 2026):** steps 1–4 are done. The bucket, the retention rules, the add-only `db-backup` service account and its key, and 30-day undelete on the photos bucket are all in place. The key was tested: it can upload, but it can't read, list, overwrite or delete. Steps 5–8 are still to do.

Run these commands in a terminal signed in with `gcloud auth login` as an owner of project `reclimate-d0868`.

**1. Create the backup bucket.** Keep it private with no public access. It's in `us-east1`, like the photos bucket, which is covered by Google Cloud's free storage tier:

```bash
gcloud storage buckets create gs://reclimate-db-backups --project=reclimate-d0868 \
  --location=us-east1 --uniform-bucket-level-access --public-access-prevention
```

**2. Set how long copies are kept, and lock it.**
- The retention policy stops anyone deleting a backup during its first 35 days.
- The lifecycle rules delete old copies automatically after that.

```bash
cat > /tmp/lifecycle.json <<'EOF'
{ "rule": [
  { "action": { "type": "Delete" }, "condition": { "age": 35,  "matchesPrefix": ["daily/"] } },
  { "action": { "type": "Delete" }, "condition": { "age": 366, "matchesPrefix": ["monthly/"] } }
] }
EOF
gcloud storage buckets update gs://reclimate-db-backups --lifecycle-file=/tmp/lifecycle.json --retention-period=35d
```

Leave the retention policy **unlocked** for the first month. Once the backups are known to work, you can lock it, which makes it permanent and stops even a project owner from shortening it:
`gcloud storage buckets update gs://reclimate-db-backups --lock-retention-period`

**3. Create a service account that can only add files.** It can't read, overwrite or delete them, so a leaked key can't destroy backups:

```bash
gcloud iam service-accounts create db-backup --project=reclimate-d0868 --display-name="Daily DB backup (GitHub)"
gcloud storage buckets add-iam-policy-binding gs://reclimate-db-backups \
  --member=serviceAccount:db-backup@reclimate-d0868.iam.gserviceaccount.com --role=roles/storage.objectCreator
gcloud iam service-accounts keys create db-backup-key.json \
  --iam-account=db-backup@reclimate-d0868.iam.gserviceaccount.com
```

If the last command fails with *"Key creation is not allowed"*, your organisation's policy blocks service-account keys. Either:
- allow keys for this project (IAM → Organization policies → *Disable service account key creation* → override for `reclimate-d0868`), or
- ask me to switch the workflow to Workload Identity Federation, which needs no key.

**4. Protect the photos bucket** (while you're signed in): keep deleted and overwritten files for 30 days instead of the default 7:

```bash
gcloud storage buckets update gs://reclimate-d0868.firebasestorage.app --soft-delete-duration=30d
```

**5. Create a read-only database role in Neon.** In the Neon console → SQL Editor, choose a strong password and run:

```sql
create role backup_reader with login password '<choose a strong password>';
grant pg_read_all_data to backup_reader;
```

If Neon refuses the `grant`, run these instead. Replace `<app_role>` with the role the app connects as (it owns the tables):

```sql
grant usage on schema public to backup_reader;
grant select on all tables in schema public to backup_reader;
grant select on all sequences in schema public to backup_reader;
alter default privileges for role <app_role> in schema public grant select on tables to backup_reader;
alter default privileges for role <app_role> in schema public grant select on sequences to backup_reader;
```

Then copy the connection string: Neon console → Connect → role `backup_reader` → **turn off "Connection pooling"**. The host must *not* contain `-pooler`, because `pg_dump` needs a direct connection.

**6. Add the settings to GitHub.** In the backend repository, go to Settings → Environments → **Production** (create it if it doesn't exist), then add:
- **Secret** `BACKUP_DATABASE_URL`: the connection string from step 5.
- **Secret** `GCP_BACKUP_SA_KEY`: the whole contents of `db-backup-key.json`.
- **Variable** `BACKUP_BUCKET`: `reclimate-db-backups`

Then **delete `db-backup-key.json`** from your computer.

**7.** Actions → **Database backup** → **Run workflow**, and check it goes green.

**8. In Neon,** go to Settings → **Instant restore** and set the longest restore window your plan allows. That covers mistakes made between two nightly backups.

## As the data grows

Each nightly run reads the whole database out of Neon. The run prints the database size, and shows a warning once it passes **120 MB**.

On Neon's **Free plan** (5 GB transfer a month, 0.5 GB storage, 6 hours of instant restore), when that warning appears:
- **Upgrade Neon** (recommended once more sites join). Paid plans include far more transfer and storage, and a restore window of days instead of hours. Keep the backup daily.
- Or, to stay free for a while longer, change the cron in `backup.yml` to weekly: `'30 19 * * 6'`.

Google Cloud storage for the copies stays cheap. Even a 1 GB database (about 200–300 MB compressed) costs well under $1 a month for 35 daily and 12 monthly copies.

## Restoring

**A mistake from the last few hours or days** (wrong edit, bad import): use Neon's **instant restore**.
1. In Neon, restore to a **new branch** at a time just before the mistake.
2. Check the data there.
3. Then either copy the rows you need back, or make that branch the main one.

**The database is lost or damaged,** or the mistake is older than Neon's restore window: use a daily backup.

```bash
# 1. Download a backup (needs a gcloud account that can read the bucket, e.g. a project owner)
gcloud storage ls gs://reclimate-db-backups/daily/2026/11/        # pick a day
gcloud storage cp gs://reclimate-db-backups/daily/2026/11/15/reclimate-….dump .

# 2. Restore into a NEW, empty Neon database or branch first, never straight over the live one
pg_restore --dbname="<new database connection string>" --no-owner --no-privileges --schema=public reclimate-….dump
```

3. Check the data in the new database. Then point the app's `DATABASE_URL` (App Hosting → secrets) at it, or copy across what's needed.

Your local `pg_restore` must be at least the same major version as the backup. With Docker: `docker run --rm -v "$PWD:/b" postgres:17 pg_restore …`

## Practise a restore

Do this every 3 months, on a new Neon branch: download the latest backup, restore it, and open a few records. Every nightly run already proves its dump restores. The practice proves that *you* can do it under pressure.

## The backups hold personal data

The dumps contain names, phone numbers and emails, so:
- keep the bucket private;
- never download a backup to a shared machine;
- delete local copies after use.

Account deletions in the app erase personal details from the live database immediately. Old backups still hold them until they expire, after at most 1 year. Mention this in the privacy policy if it isn't there already.
