import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import path from 'path'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'
import sharp from 'sharp'

import { Batches } from './collections/Batches'
import { CreditTransactions } from './collections/CreditTransactions'
import { Media } from './collections/Media'
import { SellRequests } from './collections/SellRequests'
import { SetupItems } from './collections/SetupItems'
import { Sites } from './collections/Sites'
import { Users } from './collections/Users'
import { Settings } from './globals/Settings'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

// The app is a static export running on another origin (browser dev server,
// capacitor://localhost on iOS, https://localhost on Android).
const origins = (
  process.env.CORS_ORIGINS || 'http://localhost:3000,capacitor://localhost,https://localhost'
)
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean)

// Where this server itself is reached. The admin panel's own saves come from
// here, so it must pass the CSRF check alongside the app's origins.
// Netlify provides the site's address as URL, so it works there even if SERVER_URL is not set.
const serverOrigin = (process.env.SERVER_URL || process.env.URL || 'http://localhost:3001').replace(/\/$/, '')

export default buildConfig({
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname),
      importMapFile: path.resolve(dirname, 'app/(payload)/cms/importMap.js'),
    },
    meta: { titleSuffix: '· Reclimate dMRV' },
    components: { beforeDashboard: ['/components/BeforeDashboard'] },
  },
  // /admin is the Reclimate dashboard (src/app/(dashboard)). Payload's built-in editor stays
  // reachable at /cms for raw data fixes until every section exists in the dashboard.
  routes: { admin: '/cms' },
  collections: [Batches, Media, CreditTransactions, SellRequests, Users, Sites, SetupItems],
  globals: [Settings],
  // The app is English + Bahasa Indonesia; request `?locale=all` to get { en, id } pairs.
  localization: {
    locales: [
      { label: 'English', code: 'en' },
      { label: 'Bahasa Indonesia', code: 'id' },
    ],
    defaultLocale: 'en',
    fallback: true,
  },
  cors: origins,
  csrf: [...origins, serverOrigin],
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET || '',
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: postgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URL || '',
    },
  }),
  sharp,
  plugins: [],
})
