import { postgresAdapter } from '@payloadcms/db-postgres'
import path from 'path'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'

import { Documents, Sinks, Stocks } from './collections/credits'
import { BiomassSources, Containers, Kilns, Networks, Organizations, People, Sites, Vehicles } from './collections/network'
import { Applications, Batches, BiomassCollections, Feedstocks, Inventories, Mixings, Packagings } from './collections/production'
import { ActivityLogs, Alerts, Files, Templates } from './collections/system'
import { Users } from './collections/Users'
import { Company } from './globals/Company'
import { migrations } from './migrations'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

// Where this server is reached. Cookie-authenticated writes must come from here (CSRF allow-list).
// Netlify provides the site's address as URL, so it works there even if SERVER_URL is not set.
const serverOrigin = (process.env.SERVER_URL || process.env.URL || 'http://localhost:3001').replace(/\/$/, '')
const origins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean)

/**
 * Payload is the headless data + auth layer over Neon. Its built-in admin UI is disabled:
 * /admin is the Reclimate dashboard in src/app/(dashboard), the only interface.
 */
export default buildConfig({
  admin: { user: Users.slug, disable: true },
  collections: [
    Users,
    Organizations,
    Networks,
    Sites,
    Kilns,
    People,
    Vehicles,
    Containers,
    BiomassSources,
    Feedstocks,
    Batches,
    BiomassCollections,
    Mixings,
    Packagings,
    Inventories,
    Applications,
    Stocks,
    Sinks,
    Documents,
    Templates,
    Files,
    Alerts,
    ActivityLogs,
  ],
  globals: [Company],
  cors: origins,
  csrf: [...origins, serverOrigin],
  secret: process.env.PAYLOAD_SECRET || '',
  typescript: { outputFile: path.resolve(dirname, 'payload-types.ts') },
  db: postgresAdapter({
    pool: { connectionString: process.env.DATABASE_URL || '' },
    // Schema changes go through committed migrations (src/migrations), in development too.
    push: false,
    migrationDir: path.resolve(dirname, 'migrations'),
    prodMigrations: migrations,
  }),
})
