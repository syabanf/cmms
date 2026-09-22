import type { TypeFilter } from './work'

/** Route builders shared by every screen. Assets are addressed by code, the value printed on their QR tag. */
export const paths = {
  home: '/',
  work: (type: TypeFilter = 'all') => (type === 'all' ? '/work' : `/work?type=${type}`),
  /** `step` opens a step of the work order flow, for example `safety`. */
  workOrder: (id: string, step?: string) => (step ? `/work/${id}?step=${step}` : `/work/${id}`),
  scan: '/scan',
  asset: (code: string) => `/asset/${encodeURIComponent(code)}`,
  requests: '/requests',
  request: (id: string) => `/requests/${id}`,
  newRequest: (assetCode?: string) => (assetCode ? `/requests/new?asset=${encodeURIComponent(assetCode)}` : '/requests/new'),
}
