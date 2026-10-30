/**
 * Circonomy export — run in the browser, signed in to https://admin.circonomy.co (paste into the console of that tab).
 *
 * Reads every record of the C-sink manager through Circonomy's own API, using the page's signed-in session (the
 * token never leaves the page), and downloads `circonomy-export-<date>.json`. Put that file in
 * `data/import/circonomy-export.json` and run `npm run import:circonomy` (re-runnable), then `npm run media:copy`
 * within about 6 days (the photo/video links in the export expire).
 *
 * Read-only: it only sends GET requests. Progress: `__exp.progress`; problems: `__exp.errors`.
 * Usage:  await __circonomyExport()        // fetches everything, then downloads the file
 */
;(() => {
  const API = 'https://api-prod.circonomy.co'
  // The C-sink manager, its company project and registry (from the Circonomy account).
  const CM = '754df266-c328-4ea0-ab81-a7a6f8818884'
  const PROJ = 'e2637aed-09e9-4664-a5b3-ad742504d8b4'
  const REG = 'ce197901-e60d-43d4-a1fa-96660a817141'

  const token = () => JSON.parse(localStorage.getItem('auth-storage') || '{}').state?.token
  const exp = (window.__exp = { startedAt: new Date().toISOString(), data: {}, progress: {}, errors: [], stopped: false })

  const get = async (path, attempt = 0) => {
    const r = await fetch(API + path, { headers: { Authorization: token() } })
    if (r.status === 401) {
      exp.stopped = true
      throw new Error('401 signed out — sign in again and re-run')
    }
    // Be gentle with their API: back off on rate limits and server errors.
    if ((r.status === 429 || r.status >= 500) && attempt < 4) {
      await new Promise((ok) => setTimeout(ok, 1000 * 2 ** attempt))
      return get(path, attempt + 1)
    }
    return { status: r.status, body: await r.json().catch(() => null) }
  }
  const one = async (path) => {
    const r = await get(path)
    return r.status >= 400 ? { error: r.status, body: r.body } : r.body
  }
  const arrOf = (b) => {
    if (Array.isArray(b)) return b
    if (b && typeof b === 'object') {
      for (const k in b) if (Array.isArray(b[k]) && b[k].length && typeof b[k][0] === 'object') return b[k]
      for (const k in b) if (Array.isArray(b[k])) return b[k]
    }
    return []
  }
  const paged = async (base) => {
    const sep = base.includes('?') ? '&' : '?'
    let all = [], first = null
    for (let p = 0; p < 50; p++) {
      const r = await get(`${base}${sep}limit=200&page=${p}`)
      if (r.status >= 400) return { error: r.status, body: r.body }
      if (!first) first = r.body
      const a = arrOf(r.body)
      all.push(...a)
      const total = r.body?.count ?? r.body?.total ?? r.body?.totalCount
      if (!a.length || a.length < 200 || (total && all.length >= total)) break
    }
    return { first, items: all }
  }
  const pool = async (items, fn, n, key) => {
    let i = 0, done = 0
    const worker = async () => {
      while (i < items.length && !exp.stopped) {
        const it = items[i++]
        try {
          await fn(it)
        } catch (e) {
          exp.errors.push(String(e).slice(0, 200))
        }
        exp.progress[key] = ++done + '/' + items.length
      }
    }
    await Promise.all(Array.from({ length: n }, worker))
  }

  async function batches() {
    // Since Oct 2026 the batch list needs the registry.
    const first = await get(`/admin/new/process?limit=500&page=0&timezone=UTC&registryId=${REG}`)
    const total = first.body.count
    const list = [...first.body.kilnProcesses]
    for (let p = 1; list.length < total && p < 40; p++) {
      const r = await get(`/admin/new/process?limit=500&page=${p}&timezone=UTC&registryId=${REG}`)
      if (!r.body?.kilnProcesses?.length) break
      list.push(...r.body.kilnProcesses)
    }
    exp.data.processList = list
    exp.progress.processList = list.length + '/' + total
    exp.data.processDetails = {}
    await pool(list.map((x) => x.id), async (id) => (exp.data.processDetails[id] = (await get('/admin/new/process-details?processId=' + id)).body), 6, 'processDetails')
  }

  async function other() {
    const jobs = {
      biomassCollection: () => paged(`/admin/new/biomass-collection?search=&csinkManagerIds=${CM}&registryId=${REG}`),
      mixing: () => paged(`/admin/new/mixing-packaging?isMixing=true&csinkManagerIds=${CM}&registryId=${REG}`),
      packaging: () => paged(`/admin/new/mixing-packaging?isMixing=false&csinkManagerIds=${CM}&registryId=${REG}`),
      inventories: () => paged(`/admin/new/inventories?csinkManagerIds=${CM}&registryId=${REG}`),
      distributions: () => paged(`/admin/new/distribution-applications?csinkManagerIds=${CM}&registryId=${REG}`),
      mixingTracking: () => paged(`/admin/new/mixing-tracking?csinkManagerIds=${CM}&registryId=${REG}`),
      users: () => paged(`/admin/new/users/v2?search=&csinkManagerIds=${CM}`),
      entities: () => paged(`/admin/new/entities?csinkManagerIds=${CM}`),
      networks: () => one(`/admin/new/networks?csinkManagerIds=${CM}&includeSuspended=true`),
      sitesKilns: () => one(`/admin/new/sites-kilns?includeSuspended=true`),
      ceresNetworks: () => one(`/admin/csink-manager/${CM}/csi-approval/networks`),
      csinkManager: () => one(`/admin/csink-manager/${CM}`),
      biomassAggregators: () => one(`/admin/biomass-aggregator?limit=1000&page=0&includeSuspended=true`),
      packagingTypes: () => one(`/admin/packaging-types?limit=1000&page=0`),
      stocks: () => one(`/admin/company-project/${PROJ}/stocks?page=0&limit=500&includeDeleted=true`),
      sinks: () => one(`/admin/company-project/${PROJ}/sinks?page=0&limit=500&includeDeleted=true`),
      project: () => one(`/admin/company-project/${PROJ}/v2`),
      subProjects: () => one(`/admin/company-project/${PROJ}/sub-projects/v2`),
      portfolioProjects: () => one(`/admin/new/project-portfolio/projects?page=0&limit=100&csinkManagerIds=${CM}&registryId=${REG}`),
      kilnTemplates: () => one(`/admin/csink-manager/${CM}/settings/kiln-template`),
      containerTemplates: () => one(`/admin/csink-manager/${CM}/settings/measuring-container-template`),
      certificateRequest: () => one(`/admin/certificate/request/v2/${CM}`),
      activityLogs: () => paged(`/admin/new/activity-logs?csinkManagerIds=${CM}`),
    }
    exp.data.other = {}
    for (const [k, f] of Object.entries(jobs)) {
      if (exp.stopped) break
      try {
        const r = (exp.data.other[k] = await f())
        exp.progress[k] = r?.error ? `err ${r.error}` : 'ok'
        if (r?.error) exp.errors.push(k + ': ' + JSON.stringify(r).slice(0, 150))
      } catch (e) {
        exp.progress[k] = 'err'
        exp.errors.push(k + ': ' + String(e).slice(0, 150))
      }
    }
  }

  async function networks() {
    const ents = exp.data.other.entities?.items ?? []
    const out = (exp.data.networkDetails = {})
    let n = 0
    for (const e of ents) {
      if (exp.stopped) break
      try {
        if (e.entityType === 'artisan_pro') {
          const id = e.id, x = {}
          x.detail = await one(`/admin/artisian-pro/${id}`)
          x.sites = await one(`/admin/artisian-pro/${id}/site`)
          x.farmers = await one(`/admin/artisian-pro/${id}/farmers`)
          x.farms = await one(`/admin/new/artisan-pro/${id}/farms`)
          x.qr = await one(`/admin/artisian-pro/${id}/qr-entities`)
          const arr = Array.isArray(x.sites) ? x.sites : x.sites?.sites || x.sites?.siteList || Object.values(x.sites || {}).find(Array.isArray) || []
          x.siteDetails = {}
          x.siteQr = {}
          for (const s of arr) {
            const sid = s.id || s.siteId
            if (!sid) continue
            x.siteDetails[sid] = await one(`/admin/artisian-pro/${id}/site/${sid}`)
            x.siteQr[sid] = await one(`/admin/site/${sid}/qr-entities`)
          }
          out[id] = x
        } else {
          out[e.id] = { detail: await one(`/admin/cs-network/${e.id}`), farmers: await one(`/admin/cs-network/${e.id}/farmers`) }
        }
      } catch (err) {
        exp.errors.push('net ' + e.name + ': ' + String(err).slice(0, 120))
      }
      exp.progress.networkDetails = ++n + '/' + ents.length
    }
  }

  function download() {
    const stamp = new Date().toISOString().slice(0, 10)
    const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), source: 'admin.circonomy.co', csinkManagerId: CM, ...exp.data })], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `circonomy-export-${stamp}.json`
    document.body.appendChild(a)
    a.click()
    a.remove()
    return (blob.size / 1e6).toFixed(1) + ' MB'
  }

  window.__circonomyExport = async ({ save = true } = {}) => {
    if (!token()) throw new Error('Not signed in to admin.circonomy.co')
    await batches()
    await other()
    await networks()
    exp.progress.done = true
    return save && !exp.stopped ? download() : exp.progress
  }
  window.__circonomyDownload = download
})()
