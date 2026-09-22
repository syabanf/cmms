/**
 * Asset code from a scanned or typed value. Accepts the tag payload `cmms://asset/POL-03`,
 * a link that ends in `/asset/POL-03`, or the bare code in any case.
 */
export function parseAssetCode(raw: string): string | null {
  const value = raw.trim()
  const match = /(?:^cmms:\/\/asset\/|\/asset\/)([^/?#\s]+)/i.exec(value)
  const code = (match?.[1] ?? value).trim().toUpperCase()
  return code || null
}
