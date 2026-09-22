import type { CalibrationPlan, Tool } from '../../packages/types/src/index.ts'

type ToolRow = {
  code: string
  name: string
  category: string
  site: 'site-bdg' | 'site-ckr'
  location: string
  serial: string
  status?: Tool['status']
  condition?: Tool['condition']
  cal?: [lastAt: string, due: string, intervalMonths: number]
  holder?: string
}

const R: ToolRow[] = [
  { code: 'TW-01', name: 'Torque Wrench 20-100 N·m', category: 'Torque wrench', site: 'site-bdg', location: 'Tool crib A, drawer 2', serial: 'TOH-QL100-7731', cal: ['2025-12-12', '2026-12-12', 12] },
  { code: 'TW-02', name: 'Torque Wrench 40-280 N·m', category: 'Torque wrench', site: 'site-bdg', location: 'Tool crib A, drawer 2', serial: 'TOH-QL280-2204', cal: ['2025-09-04', '2026-09-04', 12] },
  { code: 'BP-01', name: 'Bearing Puller 3-Jaw', category: 'Bearing puller', site: 'site-bdg', location: 'Tool crib A, rack 1', serial: 'SKF-TMMA60-118' },
  { code: 'BP-02', name: 'Hydraulic Bearing Puller', category: 'Bearing puller', site: 'site-bdg', location: 'Tool crib A, rack 1', serial: 'SKF-TMHP10E-044' },
  { code: 'MM-01', name: 'Multimeter Fluke 87V #1', category: 'Multimeter', site: 'site-bdg', location: 'Electrical workshop', serial: 'FL87V-44120931', cal: ['2026-02-20', '2027-02-20', 12] },
  { code: 'MM-02', name: 'Multimeter Fluke 87V #2', category: 'Multimeter', site: 'site-bdg', location: 'Electrical workshop', serial: 'FL87V-44121207', cal: ['2025-10-05', '2026-10-05', 12] },
  { code: 'TG-01', name: 'Thermal Gun Fluke 62 Max+', category: 'Thermal gun', site: 'site-bdg', location: 'Tool crib A, drawer 4', serial: 'FL62-3309815', cal: ['2026-01-15', '2027-01-15', 12] },
  { code: 'VB-01', name: 'Vibration Meter SKF CMAS 100', category: 'Vibration meter', site: 'site-bdg', location: 'Reliability cabinet', serial: 'SKF-CMAS-66071', cal: ['2026-03-01', '2027-03-01', 12] },
  { code: 'IR-01', name: 'Thermal Camera Fluke TiS20+', category: 'Thermal camera', site: 'site-bdg', location: 'Reliability cabinet', serial: 'FL-TIS20-19044', cal: ['2025-10-04', '2026-10-04', 12] },
  { code: 'IT-01', name: 'Insulation Tester Megger MIT420', category: 'Insulation tester', site: 'site-bdg', location: 'Electrical workshop', serial: 'MG-MIT420-5512', cal: ['2026-05-10', '2027-05-10', 12] },
  { code: 'CM-01', name: 'Clamp Meter Fluke 376 FC', category: 'Clamp meter', site: 'site-bdg', location: 'Electrical workshop', serial: 'FL376-8820113', cal: ['2026-04-18', '2027-04-18', 12] },
  { code: 'LA-01', name: 'Laser Alignment SKF TKSA 41', category: 'Laser alignment', site: 'site-bdg', location: 'Reliability cabinet', serial: 'SKF-TKSA41-0932', cal: ['2026-01-30', '2027-01-30', 12] },
  { code: 'DG-01', name: 'Dial Indicator Set Mitutoyo', category: 'Dial gauge', site: 'site-bdg', location: 'Tool crib A, drawer 3', serial: 'MIT-2046S-7784', cal: ['2026-06-01', '2027-06-01', 12] },
  { code: 'GG-01', name: 'Grease Gun 500 cc', category: 'Grease gun', site: 'site-bdg', location: 'Lubrication room', serial: 'GG-500-01' },
  { code: 'GG-02', name: 'Grease Gun 500 cc #2', category: 'Grease gun', site: 'site-bdg', location: 'Lubrication room', serial: 'GG-500-02', status: 'maintenance', condition: 'poor' },
  { code: 'HJ-01', name: 'Hydraulic Jack 20 t', category: 'Hydraulic jack', site: 'site-bdg', location: 'Mechanical workshop', serial: 'HJ-20T-3321', condition: 'fair' },
  { code: 'CKR-TW-01', name: 'Torque Wrench 20-100 N·m', category: 'Torque wrench', site: 'site-ckr', location: 'Tool crib C', serial: 'TOH-QL100-9102', cal: ['2026-03-05', '2027-03-05', 12] },
  { code: 'CKR-MM-01', name: 'Multimeter Fluke 87V', category: 'Multimeter', site: 'site-ckr', location: 'Tool crib C', serial: 'FL87V-45510277', cal: ['2026-01-28', '2027-01-28', 12] },
  { code: 'CKR-BP-01', name: 'Bearing Puller 3-Jaw', category: 'Bearing puller', site: 'site-ckr', location: 'Tool crib C', serial: 'SKF-TMMA60-305' },
]

export const toolId = (code: string) => `tool-${code.toLowerCase()}`
const d = (s: string) => `${s}T00:00:00+07:00`

export const tools: Tool[] = R.map((r) => {
  const calibration: CalibrationPlan | null = r.cal
    ? { lastAt: d(r.cal[0]), due: d(r.cal[1]), intervalMonths: r.cal[2], vendorId: 'ven-kalibra' }
    : null
  return {
    id: toolId(r.code),
    code: r.code,
    name: r.name,
    category: r.category,
    siteId: r.site,
    location: r.location,
    serialNumber: r.serial,
    status: r.status ?? 'available',
    condition: r.condition ?? 'good',
    calibration,
    holderId: null,
    woId: null,
  }
})

export const T = (code: string): Tool => {
  const t = tools.find((x) => x.code === code)
  if (!t) throw new Error(`Unknown tool ${code}`)
  return t
}
