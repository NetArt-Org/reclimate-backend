/**
 * The caller's address. The left of X-Forwarded-For is whatever the client sent, so it is never trusted
 * (a bot could rotate it to dodge every per-address limit). Firebase App Hosting sets `x-fah-client-ip` after its
 * own proxies; otherwise the address is taken TRUST_PROXY_HOPS entries from the right of X-Forwarded-For
 * (default 2: the client, then Google's load balancer).
 */
export function clientIp(req: Request) {
  const fah = req.headers.get('x-fah-client-ip')?.trim()
  if (fah) return fah.slice(0, 64)
  const chain = (req.headers.get('x-forwarded-for') ?? '').split(',').map((s) => s.trim()).filter(Boolean)
  const hops = Math.max(1, Number(process.env.TRUST_PROXY_HOPS) || 2)
  const ip = chain.length ? chain[Math.max(0, chain.length - hops)] : req.headers.get('x-real-ip')
  return (ip || 'unknown').trim().slice(0, 64)
}
