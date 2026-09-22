import type {
  Asset,
  AssetDocument,
  AssetSpec,
  BomLine,
  CalibrationPlan,
  CriticalityScores,
  DocumentType,
  Meter,
  Warranty,
} from '../../packages/types/src/index.ts'
import { partId } from './master.ts'

export function criticalityOf(s: CriticalityScores): Asset['criticality'] {
  const total = s.production + s.safety + s.quality + s.replacementCost + s.redundancy
  if (total >= 18) return 'A'
  if (total >= 14) return 'B'
  if (total >= 10) return 'C'
  return 'D'
}

const SPECS: Record<string, AssetSpec[]> = {
  'at-polisher': [
    { label: 'Motor power', value: '7.5 kW' },
    { label: 'Spindle speed', value: '1,450 rpm' },
    { label: 'Supply', value: '380 V, 3 phase' },
    { label: 'Weight', value: '850 kg' },
  ],
  'at-lathe': [
    { label: 'Max turning diameter', value: '300 mm' },
    { label: 'Spindle speed', value: '4,500 rpm' },
    { label: 'Control', value: 'Fanuc 0i-TF' },
    { label: 'Main motor', value: '15 kW' },
  ],
  'at-vmc': [
    { label: 'Travel X / Y / Z', value: '762 × 406 × 508 mm' },
    { label: 'Spindle speed', value: '8,100 rpm' },
    { label: 'Tool changer', value: '20 pockets' },
    { label: 'Control', value: 'Haas NGC' },
  ],
  'at-press': [
    { label: 'Capacity', value: '200 t' },
    { label: 'Stroke', value: '400 mm' },
    { label: 'Pump motor', value: '22 kW' },
    { label: 'Oil volume', value: '400 L' },
  ],
  'at-molding': [
    { label: 'Clamp force', value: '160 t' },
    { label: 'Shot size', value: '280 g' },
    { label: 'Pump', value: '18.5 kW servo' },
    { label: 'Heater zones', value: '5' },
  ],
  'at-oven': [
    { label: 'Max temperature', value: '250 °C' },
    { label: 'Burner', value: '350 kW LPG' },
    { label: 'Zones', value: '3' },
    { label: 'Conveyor speed', value: '1 to 4 m/min' },
  ],
  'at-booth': [
    { label: 'Airflow', value: '24,000 m³/h' },
    { label: 'Exhaust fan', value: '11 kW' },
    { label: 'Filters', value: 'G4 + F7' },
  ],
  'at-conveyor': [
    { label: 'Length', value: '42 m' },
    { label: 'Drive', value: '3 kW gear motor' },
    { label: 'Chain', value: 'RS60' },
    { label: 'Speed', value: '0.5 to 6 m/min' },
  ],
  'at-robot': [
    { label: 'Axes', value: '4 (SCARA)' },
    { label: 'Payload', value: '3 kg' },
    { label: 'Screw torque', value: '0.2 to 2.5 N·m' },
  ],
  'at-tester': [
    { label: 'Test pressure', value: '0 to 500 kPa' },
    { label: 'Resolution', value: '0.1 Pa' },
    { label: 'Stations', value: '2' },
  ],
  'at-packer': [
    { label: 'Strap width', value: '12 mm' },
    { label: 'Speed', value: '25 straps/min' },
  ],
  'at-forklift': [
    { label: 'Capacity', value: '2.5 t' },
    { label: 'Engine', value: 'Diesel 2.5 L' },
    { label: 'Lift height', value: '3.0 m' },
  ],
  'at-compressor': [
    { label: 'Motor power', value: '37 kW' },
    { label: 'Free air delivery', value: '6.4 m³/min at 7 bar' },
    { label: 'Max pressure', value: '7.5 bar' },
    { label: 'Oil capacity', value: '18 L' },
  ],
  'at-dryer': [
    { label: 'Capacity', value: '95 L/s' },
    { label: 'Dew point', value: '+3 °C' },
    { label: 'Refrigerant', value: 'R410A' },
  ],
  'at-panel': [
    { label: 'Rating', value: '2,500 A' },
    { label: 'Voltage', value: '380 V' },
    { label: 'Breakers', value: 'ACB + 24 MCCB' },
  ],
  'at-genset': [
    { label: 'Rating', value: '500 kVA' },
    { label: 'Engine', value: 'Cummins QSX15' },
    { label: 'Fuel tank', value: '1,000 L' },
  ],
  'at-chiller': [
    { label: 'Capacity', value: '120 TR' },
    { label: 'Refrigerant', value: 'R134a' },
    { label: 'Compressors', value: '2 × screw' },
  ],
  'at-tower': [
    { label: 'Capacity', value: '250 RT' },
    { label: 'Fan motor', value: '7.5 kW' },
  ],
  'at-pump': [
    { label: 'Flow', value: '45 m³/h' },
    { label: 'Head', value: '32 m' },
    { label: 'Motor', value: '7.5 kW' },
  ],
  'at-motor': [
    { label: 'Power', value: '7.5 kW' },
    { label: 'Speed', value: '1,450 rpm' },
    { label: 'Frame', value: 'IEC 132M' },
  ],
  'at-spindle': [
    { label: 'Max speed', value: '3,000 rpm' },
    { label: 'Bearings', value: '6204-2RS pair' },
  ],
  'at-inverter': [
    { label: 'Rating', value: '11 kW' },
    { label: 'Input', value: '380 V, 3 phase' },
  ],
  'at-plc': [
    { label: 'Module', value: 'SM1221 DI16' },
    { label: 'Supply', value: '24 V DC' },
  ],
  'at-gauge': [
    { label: 'Range', value: '0 to 16 bar' },
    { label: 'Accuracy', value: 'Class 1.6' },
  ],
  'at-thermo': [
    { label: 'Range', value: '0 to 300 °C' },
    { label: 'Accuracy', value: '±1 °C' },
  ],
  'at-scale': [
    { label: 'Capacity', value: '60 kg' },
    { label: 'Resolution', value: '5 g' },
  ],
  'at-sensor': [
    { label: 'Type', value: 'Thermocouple K' },
    { label: 'Range', value: '0 to 400 °C' },
  ],
}

type AssetRow = {
  code: string
  name: string
  type: string
  loc: string
  parent?: string
  make: string
  model: string
  serial: string
  installed: string
  scores: [number, number, number, number, number]
  team: string
  cc: string
  status?: Asset['status']
  warranty?: { vendorId: string | null; start: string; end: string; terms: string }
  calibration?: { intervalMonths: number; lastAt: string | null; due: string; vendorId: string | null }
  notes?: string
}

const R: AssetRow[] = [
  // Finishing: polishing
  { code: 'POL-01', name: 'Mesin Poles 01', type: 'at-polisher', loc: 'loc-bdg-pol', make: 'XYZ Machinery', model: 'P-750', serial: 'SN88104', installed: '2022-03-14', scores: [4, 3, 4, 3, 2], team: 'team-bdg-mech', cc: 'cc-bdg-fin' },
  { code: 'POL-02', name: 'Mesin Poles 02', type: 'at-polisher', loc: 'loc-bdg-pol', make: 'XYZ Machinery', model: 'P-750', serial: 'SN88117', installed: '2022-03-14', scores: [4, 3, 4, 3, 2], team: 'team-bdg-mech', cc: 'cc-bdg-fin' },
  {
    code: 'POL-03', name: 'Mesin Poles 03', type: 'at-polisher', loc: 'loc-bdg-pol', make: 'XYZ Machinery', model: 'P-750', serial: 'SN92822', installed: '2024-06-12', scores: [5, 5, 4, 3, 1], team: 'team-bdg-mech', cc: 'cc-bdg-fin',
    warranty: { vendorId: 'ven-xyz', start: '2024-06-12', end: '2027-06-12', terms: '36 months parts and labour. Excludes wear parts damaged by misuse or missed lubrication.' },
    notes: 'Utilization went from 12 to 18 hours per day in July 2026 after the second polishing shift started.',
  },
  { code: 'POL-01-MTR', name: 'Poles 01 Drive Motor', type: 'at-motor', loc: 'loc-bdg-pol', parent: 'POL-01', make: 'WEG', model: 'W22 7.5 kW', serial: 'WEG1022871', installed: '2022-03-14', scores: [4, 2, 3, 3, 2], team: 'team-bdg-mech', cc: 'cc-bdg-fin' },
  { code: 'POL-01-SPD', name: 'Poles 01 Spindle', type: 'at-spindle', loc: 'loc-bdg-pol', parent: 'POL-01', make: 'XYZ Machinery', model: 'SP-750', serial: 'SP88104', installed: '2022-03-14', scores: [4, 3, 4, 3, 2], team: 'team-bdg-mech', cc: 'cc-bdg-fin' },
  { code: 'POL-03-MTR', name: 'Poles 03 Drive Motor', type: 'at-motor', loc: 'loc-bdg-pol', parent: 'POL-03', make: 'WEG', model: 'W22 7.5 kW', serial: 'WEG2404519', installed: '2024-06-12', scores: [5, 3, 3, 3, 2], team: 'team-bdg-mech', cc: 'cc-bdg-fin' },
  { code: 'POL-03-SPD', name: 'Poles 03 Spindle', type: 'at-spindle', loc: 'loc-bdg-pol', parent: 'POL-03', make: 'XYZ Machinery', model: 'SP-750', serial: 'SP92822', installed: '2024-06-12', scores: [5, 4, 4, 3, 2], team: 'team-bdg-mech', cc: 'cc-bdg-fin' },
  { code: 'POL-03-INV', name: 'Poles 03 Inverter', type: 'at-inverter', loc: 'loc-bdg-pol', parent: 'POL-03', make: 'Yaskawa', model: 'GA500 11 kW', serial: 'YS24A06631', installed: '2024-06-12', scores: [5, 2, 2, 3, 2], team: 'team-bdg-elec', cc: 'cc-bdg-fin' },
  // Finishing: coating
  { code: 'OVN-01', name: 'Curing Oven 1', type: 'at-oven', loc: 'loc-bdg-ctg', make: 'Wahana Thermal', model: 'CO-3Z-350', serial: 'WT19-0311', installed: '2019-08-02', scores: [5, 4, 5, 4, 2], team: 'team-bdg-mech', cc: 'cc-bdg-fin' },
  { code: 'OVN-02', name: 'Curing Oven 2', type: 'at-oven', loc: 'loc-bdg-ctg', make: 'Wahana Thermal', model: 'CO-3Z-350', serial: 'WT20-0142', installed: '2020-02-17', scores: [5, 4, 5, 4, 2], team: 'team-bdg-mech', cc: 'cc-bdg-fin' },
  { code: 'SPB-01', name: 'Spray Booth 1', type: 'at-booth', loc: 'loc-bdg-ctg', make: 'Wahana Thermal', model: 'SB-24K', serial: 'WT19-0312', installed: '2019-08-02', scores: [4, 4, 4, 3, 1], team: 'team-bdg-mech', cc: 'cc-bdg-fin' },
  { code: 'CNV-02', name: 'Coating Conveyor', type: 'at-conveyor', loc: 'loc-bdg-ctg', make: 'Daifuku', model: 'OHC-60', serial: 'DF19-7720', installed: '2019-08-02', scores: [5, 2, 2, 2, 5], team: 'team-bdg-mech', cc: 'cc-bdg-fin' },
  // Machining
  { code: 'CNC-01', name: 'CNC Lathe 01', type: 'at-lathe', loc: 'loc-bdg-cnc', make: 'Mazak', model: 'QT-200', serial: 'MZ301877', installed: '2018-04-20', scores: [4, 2, 5, 5, 2], team: 'team-bdg-mech', cc: 'cc-bdg-mch' },
  { code: 'CNC-02', name: 'CNC Lathe 02', type: 'at-lathe', loc: 'loc-bdg-cnc', make: 'Mazak', model: 'QT-200', serial: 'MZ308112', installed: '2019-01-15', scores: [3, 2, 5, 5, 2], team: 'team-bdg-mech', cc: 'cc-bdg-mch' },
  { code: 'VMC-01', name: 'Machining Center 01', type: 'at-vmc', loc: 'loc-bdg-cnc', make: 'Haas', model: 'VF-2', serial: 'HA1144903', installed: '2021-09-06', scores: [5, 2, 5, 5, 4], team: 'team-bdg-mech', cc: 'cc-bdg-mch' },
  { code: 'VMC-01-SPD', name: 'VMC 01 Spindle', type: 'at-spindle', loc: 'loc-bdg-cnc', parent: 'VMC-01', make: 'Haas', model: 'CT40 8K', serial: 'HS1144903', installed: '2021-09-06', scores: [5, 2, 5, 5, 4], team: 'team-bdg-mech', cc: 'cc-bdg-mch' },
  { code: 'VMC-01-PLC', name: 'VMC 01 PLC I/O', type: 'at-plc', loc: 'loc-bdg-cnc', parent: 'VMC-01', make: 'Siemens', model: 'S7-1200 SM1221', serial: 'S7C8811203', installed: '2021-09-06', scores: [5, 2, 3, 2, 4], team: 'team-bdg-elec', cc: 'cc-bdg-mch' },
  { code: 'HPR-01', name: 'Hydraulic Press 200T', type: 'at-press', loc: 'loc-bdg-prs', make: 'Amada', model: 'HP-200', serial: 'AM16-5520', installed: '2016-11-08', scores: [5, 5, 3, 4, 4], team: 'team-bdg-mech', cc: 'cc-bdg-mch' },
  { code: 'HPR-02', name: 'Hydraulic Press 100T', type: 'at-press', loc: 'loc-bdg-prs', make: 'Amada', model: 'HP-100', serial: 'AM18-6034', installed: '2018-02-26', scores: [3, 5, 3, 3, 2], team: 'team-bdg-mech', cc: 'cc-bdg-mch' },
  { code: 'INJ-01', name: 'Injection Molding 01', type: 'at-molding', loc: 'loc-bdg-mld', make: 'Haitian', model: 'MA1600 III', serial: 'HT21-11862', installed: '2021-03-01', scores: [4, 3, 4, 4, 2], team: 'team-bdg-mech', cc: 'cc-bdg-mch' },
  {
    code: 'INJ-02', name: 'Injection Molding 02', type: 'at-molding', loc: 'loc-bdg-mld', make: 'Haitian', model: 'MA1600 III', serial: 'HT25-30217', installed: '2025-11-20', scores: [4, 3, 4, 4, 2], team: 'team-bdg-mech', cc: 'cc-bdg-mch',
    warranty: { vendorId: null, start: '2025-11-20', end: '2027-11-20', terms: '24 months, Haitian Indonesia service network.' },
  },
  // Assembly
  { code: 'CNV-01', name: 'Assembly Conveyor', type: 'at-conveyor', loc: 'loc-bdg-as1', make: 'Daifuku', model: 'BC-40', serial: 'DF20-8113', installed: '2020-05-11', scores: [4, 2, 2, 2, 5], team: 'team-bdg-mech', cc: 'cc-bdg-asm' },
  {
    code: 'ROB-01', name: 'Screwing Robot', type: 'at-robot', loc: 'loc-bdg-as1', make: 'Epson', model: 'T6-602S', serial: 'EP24-00931', installed: '2024-10-15', scores: [3, 2, 4, 4, 3], team: 'team-bdg-elec', cc: 'cc-bdg-asm',
    warranty: { vendorId: null, start: '2024-10-15', end: '2026-10-15', terms: '24 months, Epson Indonesia.' },
  },
  {
    code: 'LKT-01', name: 'Leak Tester', type: 'at-tester', loc: 'loc-bdg-as1', make: 'Cosmo', model: 'LS-R902', serial: 'CS25-4410', installed: '2025-03-01', scores: [3, 1, 5, 3, 4], team: 'team-bdg-inst', cc: 'cc-bdg-asm',
    warranty: { vendorId: null, start: '2025-03-01', end: '2027-03-01', terms: '24 months, excludes seals and fixtures.' },
  },
  { code: 'STR-01', name: 'Strapping Machine', type: 'at-packer', loc: 'loc-bdg-pck', make: 'Strapack', model: 'D-55', serial: 'ST17-2208', installed: '2017-06-19', scores: [2, 2, 1, 2, 2], team: 'team-bdg-mech', cc: 'cc-bdg-asm' },
  { code: 'FLT-01', name: 'Forklift 2.5T', type: 'at-forklift', loc: 'loc-bdg-pck', make: 'Toyota', model: '8FD25', serial: 'TY8FD-60881', installed: '2020-01-06', scores: [2, 4, 1, 3, 2], team: 'team-bdg-mech', cc: 'cc-bdg-asm' },
  // Utility
  { code: 'CMP-01', name: 'Air Compressor 01', type: 'at-compressor', loc: 'loc-bdg-cmp', make: 'Atlas Copco', model: 'GA37 VSD', serial: 'API719338', installed: '2017-02-13', scores: [5, 3, 3, 5, 2], team: 'team-bdg-utl', cc: 'cc-bdg-utl' },
  {
    code: 'CMP-02', name: 'Air Compressor 02', type: 'at-compressor', loc: 'loc-bdg-cmp', make: 'Atlas Copco', model: 'GA37', serial: 'API812047', installed: '2023-01-10', scores: [3, 3, 3, 5, 1], team: 'team-bdg-utl', cc: 'cc-bdg-utl', status: 'standby',
    warranty: { vendorId: 'ven-abc', start: '2023-01-10', end: '2025-01-10', terms: '24 months through ABC Compressor Service.' },
  },
  { code: 'DRY-01', name: 'Air Dryer', type: 'at-dryer', loc: 'loc-bdg-cmp', make: 'Atlas Copco', model: 'FD95', serial: 'ITJ452188', installed: '2017-02-13', scores: [4, 1, 4, 3, 4], team: 'team-bdg-utl', cc: 'cc-bdg-utl' },
  { code: 'PNL-01', name: 'Main Panel LVMDP', type: 'at-panel', loc: 'loc-bdg-elr', make: 'Schneider', model: 'Okken 2500A', serial: 'SE-LV-15-0021', installed: '2015-10-01', scores: [5, 5, 2, 5, 5], team: 'team-bdg-elec', cc: 'cc-bdg-utl' },
  { code: 'PNL-02', name: 'Production Distribution Panel', type: 'at-panel', loc: 'loc-bdg-elr', make: 'Schneider', model: 'Prisma P 800A', serial: 'SE-PP-15-0107', installed: '2015-10-01', scores: [5, 4, 2, 3, 4], team: 'team-bdg-elec', cc: 'cc-bdg-utl' },
  { code: 'GEN-01', name: 'Genset 500 kVA', type: 'at-genset', loc: 'loc-bdg-elr', make: 'Cummins', model: 'C500 D5', serial: 'CU-79331502', installed: '2015-10-01', scores: [3, 3, 1, 5, 5], team: 'team-bdg-elec', cc: 'cc-bdg-utl' },
  {
    code: 'CHL-01', name: 'Chiller 01', type: 'at-chiller', loc: 'loc-bdg-cwt', make: 'Daikin', model: 'UWY120', serial: 'DK18-99021', installed: '2018-07-23', scores: [4, 2, 4, 5, 4], team: 'team-bdg-utl', cc: 'cc-bdg-utl',
    warranty: { vendorId: 'ven-chillerpro', start: '2018-07-23', end: '2021-07-23', terms: '36 months compressor warranty.' },
  },
  { code: 'CT-01', name: 'Cooling Tower', type: 'at-tower', loc: 'loc-bdg-cwt', make: 'Liang Chi', model: 'LBC-250', serial: 'LC18-3302', installed: '2018-07-23', scores: [3, 1, 2, 3, 4], team: 'team-bdg-utl', cc: 'cc-bdg-utl' },
  { code: 'PMP-01', name: 'Transfer Water Pump', type: 'at-pump', loc: 'loc-bdg-cwt', make: 'Grundfos', model: 'NB 65-200', serial: 'GF18-7719', installed: '2018-07-23', scores: [2, 1, 1, 2, 2], team: 'team-bdg-utl', cc: 'cc-bdg-utl' },
  // Instruments (calibrated)
  {
    code: 'PG-CMP-01', name: 'Pressure Gauge Compressor 01', type: 'at-gauge', loc: 'loc-bdg-cmp', parent: 'CMP-01', make: 'WIKA', model: '232.50 0-16 bar', serial: 'WK-1144021', installed: '2021-05-04', scores: [2, 4, 2, 1, 3], team: 'team-bdg-inst', cc: 'cc-bdg-utl',
    calibration: { intervalMonths: 12, lastAt: '2025-11-10', due: '2026-11-10', vendorId: 'ven-kalibra' },
  },
  {
    code: 'TH-OVN-01', name: 'Oven 1 Reference Thermometer', type: 'at-thermo', loc: 'loc-bdg-ctg', parent: 'OVN-01', make: 'Testo', model: '925 PT100', serial: 'TS-6620931', installed: '2020-09-14', scores: [3, 3, 5, 1, 3], team: 'team-bdg-inst', cc: 'cc-bdg-fin',
    calibration: { intervalMonths: 6, lastAt: '2026-03-17', due: '2026-09-17', vendorId: 'ven-kalibra' },
  },
  {
    code: 'TS-OVN-02', name: 'Oven 2 Zone Sensor', type: 'at-sensor', loc: 'loc-bdg-ctg', parent: 'OVN-02', make: 'Omega', model: 'TC-K 300', serial: 'OM-2207781', installed: '2022-07-20', scores: [4, 3, 5, 1, 4], team: 'team-bdg-inst', cc: 'cc-bdg-fin',
    calibration: { intervalMonths: 6, lastAt: '2026-07-20', due: '2027-01-20', vendorId: 'ven-kalibra' },
  },
  {
    code: 'SC-PCK-01', name: 'Packing Scale', type: 'at-scale', loc: 'loc-bdg-pck', make: 'Mettler Toledo', model: 'ICS425', serial: 'MT-B829011', installed: '2021-02-01', scores: [2, 1, 4, 1, 3], team: 'team-bdg-inst', cc: 'cc-bdg-asm',
    calibration: { intervalMonths: 12, lastAt: '2025-10-02', due: '2026-10-02', vendorId: 'ven-kalibra' },
  },
  {
    code: 'PG-HPR-01', name: 'Pressure Gauge Press 200T', type: 'at-gauge', loc: 'loc-bdg-prs', parent: 'HPR-01', make: 'WIKA', model: '232.50 0-250 bar', serial: 'WK-1144790', installed: '2021-05-04', scores: [2, 5, 2, 1, 3], team: 'team-bdg-inst', cc: 'cc-bdg-mch',
    calibration: { intervalMonths: 12, lastAt: '2026-02-12', due: '2027-02-12', vendorId: 'ven-kalibra' },
  },
  // Factory Cikarang
  { code: 'CKR-CNC-01', name: 'CNC Lathe CK-01', type: 'at-lathe', loc: 'loc-ckr-cnc', make: 'Doosan', model: 'Lynx 220', serial: 'DS22-00417', installed: '2022-04-11', scores: [4, 2, 5, 5, 2], team: 'team-ckr-mnt', cc: 'cc-ckr-prd' },
  { code: 'CKR-CNC-02', name: 'CNC Lathe CK-02', type: 'at-lathe', loc: 'loc-ckr-cnc', make: 'Doosan', model: 'Lynx 220', serial: 'DS22-00423', installed: '2022-04-11', scores: [3, 2, 5, 4, 2], team: 'team-ckr-mnt', cc: 'cc-ckr-prd' },
  {
    code: 'CKR-VMC-01', name: 'Machining Center CK-01', type: 'at-vmc', loc: 'loc-ckr-cnc', make: 'Haas', model: 'VF-3', serial: 'HA1207711', installed: '2025-05-10', scores: [5, 2, 5, 5, 4], team: 'team-ckr-mnt', cc: 'cc-ckr-prd',
    warranty: { vendorId: null, start: '2025-05-10', end: '2027-05-10', terms: '24 months, Haas Factory Outlet Jakarta.' },
  },
  { code: 'CKR-HPR-01', name: 'Hydraulic Press 150T', type: 'at-press', loc: 'loc-ckr-cnc', make: 'Aida', model: 'HP-150', serial: 'AI20-1180', installed: '2020-09-30', scores: [4, 5, 3, 4, 4], team: 'team-ckr-mnt', cc: 'cc-ckr-prd' },
  { code: 'CKR-CNV-01', name: 'Assembly Conveyor CK', type: 'at-conveyor', loc: 'loc-ckr-as1', make: 'Daifuku', model: 'BC-30', serial: 'DF22-9041', installed: '2022-04-11', scores: [4, 2, 2, 2, 5], team: 'team-ckr-mnt', cc: 'cc-ckr-prd' },
  { code: 'CKR-CMP-01', name: 'Air Compressor CK-01', type: 'at-compressor', loc: 'loc-ckr-cmp', make: 'Kaeser', model: 'SK 25', serial: 'KS-1102266', installed: '2022-04-11', scores: [5, 3, 3, 4, 4], team: 'team-ckr-mnt', cc: 'cc-ckr-utl' },
  { code: 'CKR-PNL-01', name: 'Main Panel CK', type: 'at-panel', loc: 'loc-ckr-cmp', make: 'Schneider', model: 'Prisma 1600A', serial: 'SE-PP-22-0355', installed: '2022-04-11', scores: [5, 5, 2, 5, 5], team: 'team-ckr-mnt', cc: 'cc-ckr-utl' },
  { code: 'CKR-CHL-01', name: 'Chiller CK-01', type: 'at-chiller', loc: 'loc-ckr-cmp', make: 'Daikin', model: 'UWY60', serial: 'DK22-40117', installed: '2022-04-11', scores: [3, 2, 3, 4, 4], team: 'team-ckr-mnt', cc: 'cc-ckr-utl' },
  {
    code: 'CKR-PG-01', name: 'Pressure Gauge CK Compressor', type: 'at-gauge', loc: 'loc-ckr-cmp', parent: 'CKR-CMP-01', make: 'WIKA', model: '232.50 0-16 bar', serial: 'WK-1201553', installed: '2022-04-11', scores: [2, 4, 2, 1, 3], team: 'team-ckr-mnt', cc: 'cc-ckr-utl',
    calibration: { intervalMonths: 12, lastAt: '2026-04-22', due: '2027-04-22', vendorId: 'ven-kalibra' },
  },
]

export const assetId = (code: string) => `ast-${code.toLowerCase()}`
const d = (s: string) => `${s}T00:00:00+07:00`

export const ASSET_ROWS = R

export const assets: Asset[] = R.map((r) => {
  const scores: CriticalityScores = {
    production: r.scores[0],
    safety: r.scores[1],
    quality: r.scores[2],
    replacementCost: r.scores[3],
    redundancy: r.scores[4],
  }
  const siteId = r.loc.startsWith('loc-ckr') ? 'site-ckr' : 'site-bdg'
  const warranty: Warranty | null = r.warranty
    ? { vendorId: r.warranty.vendorId, start: d(r.warranty.start), end: d(r.warranty.end), terms: r.warranty.terms }
    : null
  const calibration: CalibrationPlan | null = r.calibration
    ? {
        intervalMonths: r.calibration.intervalMonths,
        lastAt: r.calibration.lastAt ? d(r.calibration.lastAt) : null,
        due: d(r.calibration.due),
        vendorId: r.calibration.vendorId,
      }
    : null
  return {
    id: assetId(r.code),
    code: r.code,
    name: r.name,
    siteId,
    locationId: r.loc,
    parentId: r.parent ? assetId(r.parent) : null,
    typeId: r.type,
    manufacturer: r.make,
    model: r.model,
    serialNumber: r.serial,
    installedAt: d(r.installed),
    criticality: criticalityOf(scores),
    scores,
    costCenterId: r.cc,
    teamId: r.team,
    status: r.status ?? 'operational',
    warranty,
    calibration,
    specs: SPECS[r.type] ?? [],
    notes: r.notes ?? '',
  }
})

export const assetByCode = new Map(assets.map((a) => [a.code, a]))
export const A = (code: string): typeof assets[number] => {
  const a = assetByCode.get(code)
  if (!a) throw new Error(`Unknown asset ${code}`)
  return a
}

// ─── Meters ─────────────────────────────────────────────────────

type MeterRow = [assetCode: string, kind: Meter['kind'], unit: string, value: number, dailyRate: number]
const METER_ROWS: MeterRow[] = [
  ['POL-01', 'runtime', 'h', 9_120, 16],
  ['POL-02', 'runtime', 'h', 8_875, 15.5],
  ['POL-03', 'runtime', 'h', 8_442, 18],
  ['POL-03', 'cycle', 'cycles', 423_821, 820],
  ['OVN-01', 'runtime', 'h', 15_600, 20],
  ['OVN-02', 'runtime', 'h', 15_210, 20],
  ['CNC-01', 'runtime', 'h', 14_300, 19],
  ['CNC-02', 'runtime', 'h', 12_900, 17],
  ['VMC-01', 'runtime', 'h', 10_450, 20],
  ['HPR-01', 'cycle', 'strokes', 2_184_500, 3_100],
  ['HPR-02', 'cycle', 'strokes', 1_410_220, 1_900],
  ['INJ-01', 'cycle', 'shots', 1_248_300, 2_600],
  ['INJ-02', 'cycle', 'shots', 1_096_750, 2_400],
  ['CMP-01', 'runtime', 'h', 21_380, 22],
  ['CMP-02', 'runtime', 'h', 9_845, 3],
  ['GEN-01', 'runtime', 'h', 1_240, 0.3],
  ['FLT-01', 'runtime', 'h', 6_420, 7],
  ['CHL-01', 'runtime', 'h', 32_900, 20],
  ['PNL-01', 'energy', 'kWh', 1_845_200, 9_800],
  ['CKR-CNC-01', 'runtime', 'h', 8_900, 15],
  ['CKR-HPR-01', 'cycle', 'strokes', 910_000, 2_200],
  ['CKR-CMP-01', 'runtime', 'h', 11_200, 16],
]

export const meterId = (assetCode: string, kind: Meter['kind']) => `mtr-${assetCode.toLowerCase()}-${kind}`

export const meters: Meter[] = METER_ROWS.map(([code, kind, unit, value, dailyRate]) => ({
  id: meterId(code, kind),
  assetId: assetId(code),
  kind,
  unit,
  value,
  dailyRate,
  updatedAt: '2026-09-22T07:05:00+07:00',
}))

// ─── BOM ────────────────────────────────────────────────────────

const BOM_BY_TYPE: Record<string, [component: string, part: string, qty: number][]> = {
  'at-polisher': [
    ['Motor', 'BRG-6204', 2],
    ['Motor', 'SEL-ABC', 1],
    ['Motor', 'CPL-XYZ', 1],
    ['Drive', 'BLT-B52', 2],
    ['Control box', 'CTR-32A', 1],
    ['Control box', 'FAN-INV', 1],
  ],
  'at-lathe': [
    ['Spindle', 'BRG-7014', 1],
    ['Chuck', 'PNS-KIT', 1],
    ['Hydraulic unit', 'FLT-HYD', 1],
    ['Hydraulic unit', 'OIL-HYD-46', 40],
    ['Sensors', 'PRX-M18', 2],
    ['Control', 'FUS-10A', 3],
  ],
  'at-vmc': [
    ['Spindle', 'BRG-7014', 1],
    ['Spindle drive', 'BLT-A40', 1],
    ['Control', 'PLC-DI16', 1],
    ['Sensors', 'PRX-M18', 3],
  ],
  'at-press': [
    ['Main cylinder', 'SEL-HYD-200', 1],
    ['Hydraulic unit', 'HOS-HYD', 4],
    ['Hydraulic unit', 'FLT-HYD', 1],
    ['Hydraulic unit', 'OIL-HYD-46', 400],
    ['Control', 'CTR-32A', 2],
    ['Sensors', 'PRX-M18', 2],
  ],
  'at-molding': [
    ['Hydraulic unit', 'FLT-HYD', 1],
    ['Hydraulic unit', 'OIL-HYD-46', 250],
    ['Hydraulic unit', 'HOS-HYD', 2],
    ['Barrel heaters', 'TCK-K', 5],
    ['Control', 'CTR-32A', 3],
  ],
  'at-oven': [
    ['Burner', 'NZL-BRN', 1],
    ['Controls', 'TCK-K', 3],
    ['Controls', 'CTR-32A', 2],
    ['Exhaust fan', 'BLT-B52', 2],
    ['Exhaust fan', 'BRG-6308', 2],
  ],
  'at-booth': [
    ['Exhaust fan', 'BLT-B52', 2],
    ['Exhaust fan', 'BRG-6308', 2],
  ],
  'at-conveyor': [
    ['Drive', 'CHN-RS60', 1],
    ['Drive', 'BRG-6205', 4],
    ['Motor', 'BRG-6204', 2],
    ['Sensors', 'PRX-M18', 4],
  ],
  'at-robot': [
    ['End effector', 'SOL-52', 1],
    ['Sensors', 'PRX-M18', 2],
  ],
  'at-tester': [
    ['Pneumatics', 'SOL-52', 2],
    ['Fixture', 'PNS-KIT', 1],
  ],
  'at-packer': [
    ['Drive', 'BLT-A40', 1],
    ['Pneumatics', 'SOL-52', 1],
  ],
  'at-forklift': [
    ['Mast hydraulics', 'HOS-HYD', 2],
    ['Mast hydraulics', 'OIL-HYD-46', 40],
  ],
  'at-compressor': [
    ['Service kit', 'FLT-AIR-37', 1],
    ['Service kit', 'FLT-OIL-37', 1],
    ['Service kit', 'SEP-37', 1],
    ['Service kit', 'OIL-RS-20', 1],
    ['Motor', 'BRG-6308', 2],
  ],
  'at-panel': [
    ['Switchgear', 'CTR-32A', 4],
    ['Switchgear', 'OLR-32A', 2],
    ['Switchgear', 'FUS-10A', 12],
  ],
  'at-chiller': [
    ['Refrigerant circuit', 'FLT-DRY', 1],
    ['Condenser fan', 'BRG-6308', 2],
    ['Control', 'CTR-32A', 2],
  ],
  'at-pump': [
    ['Pump end', 'BRG-6205', 2],
    ['Pump end', 'SEL-ABC', 2],
    ['Drive', 'CPL-XYZ', 1],
  ],
  'at-motor': [['Bearings', 'BRG-6204', 2]],
  'at-spindle': [['Bearings', 'BRG-6204', 2]],
  'at-inverter': [['Cooling', 'FAN-INV', 1]],
}

export const bom: BomLine[] = assets.flatMap((a) =>
  (BOM_BY_TYPE[a.typeId] ?? []).map(([component, partCode, qty], i) => ({
    id: `bom-${a.code.toLowerCase()}-${i + 1}`,
    assetId: a.id,
    partId: partId(partCode),
    qty,
    component,
  })),
)

// ─── Documents ──────────────────────────────────────────────────

type DocRow = [type: DocumentType, name: string, ext: string, sizeKb: number, uploaded: string, by: string]

const POL03_DOCS: DocRow[] = [
  ['manual', 'Operation and maintenance manual P-750', 'pdf', 8_420, '2024-06-14', 'per-fajar'],
  ['drawing', 'General arrangement drawing', 'pdf', 2_310, '2024-06-14', 'per-fajar'],
  ['electrical', 'Electrical diagram rev. C', 'pdf', 1_860, '2024-06-14', 'per-fajar'],
  ['pneumatic', 'Pneumatic diagram', 'pdf', 740, '2024-06-14', 'per-fajar'],
  ['datasheet', 'Spindle motor datasheet WEG W22', 'pdf', 520, '2024-06-14', 'per-fajar'],
  ['sop', 'SOP-MNT-014 Motor condition check', 'pdf', 310, '2026-07-10', 'per-dimas'],
  ['plc_backup', 'PLC program backup 2026-07', 'zip', 1_204, '2026-07-02', 'per-wahyu'],
  ['photo', 'Machine photo front', 'jpg', 2_860, '2024-06-20', 'per-hendra'],
  ['warranty', 'Warranty certificate XYZ-W-24-0612', 'pdf', 380, '2024-06-14', 'per-fajar'],
  ['inspection_sheet', 'Weekly motor inspection sheet', 'xlsx', 96, '2026-07-10', 'per-dimas'],
  ['vendor_report', 'XYZ service visit report Mar 2026', 'pdf', 1_120, '2026-03-19', 'per-hendra'],
]

const TYPE_DOCS: Record<string, DocRow[]> = {
  'at-polisher': [
    ['manual', 'Operation and maintenance manual P-750', 'pdf', 8_420, '2022-03-20', 'per-fajar'],
    ['electrical', 'Electrical diagram rev. B', 'pdf', 1_790, '2022-03-20', 'per-fajar'],
    ['photo', 'Machine photo front', 'jpg', 2_640, '2022-04-02', 'per-hendra'],
  ],
  'at-oven': [
    ['manual', 'Curing oven manual CO-3Z', 'pdf', 6_120, '2020-03-01', 'per-fajar'],
    ['sop', 'SOP-MNT-021 Burner service', 'pdf', 280, '2025-11-12', 'per-dimas'],
    ['electrical', 'Burner control wiring', 'pdf', 940, '2020-03-01', 'per-fajar'],
  ],
  'at-compressor': [
    ['manual', 'Atlas Copco GA37 instruction book', 'pdf', 9_830, '2023-01-15', 'per-fajar'],
    ['service_report', 'ABC overhaul report Aug 2026', 'pdf', 2_450, '2026-08-21', 'per-hendra'],
    ['datasheet', 'Compressor datasheet', 'pdf', 610, '2023-01-15', 'per-fajar'],
  ],
  'at-press': [
    ['manual', 'Press operation manual', 'pdf', 7_210, '2019-01-10', 'per-fajar'],
    ['sop', 'SOP-SAF-003 Light curtain test', 'pdf', 190, '2026-03-20', 'per-dimas'],
    ['pneumatic', 'Hydraulic circuit diagram', 'pdf', 1_330, '2019-01-10', 'per-fajar'],
  ],
  'at-lathe': [
    ['manual', 'Mazak QT-200 maintenance manual', 'pdf', 12_400, '2019-02-01', 'per-fajar'],
    ['plc_backup', 'Parameter backup 2026-06', 'zip', 820, '2026-06-22', 'per-wahyu'],
  ],
  'at-vmc': [
    ['manual', 'Haas VF-2 operator manual', 'pdf', 15_900, '2021-09-10', 'per-fajar'],
    ['plc_backup', 'Parameter and macro backup', 'zip', 640, '2026-09-01', 'per-wahyu'],
  ],
  'at-panel': [
    ['electrical', 'Single line diagram', 'pdf', 2_050, '2016-01-12', 'per-fajar'],
    ['service_report', 'Thermography report Q2 2026', 'pdf', 3_400, '2026-06-21', 'per-wahyu'],
  ],
  'at-chiller': [
    ['manual', 'Daikin UWY installation manual', 'pdf', 6_700, '2018-08-01', 'per-fajar'],
    ['vendor_report', 'ChillerPro service report Jul 2026', 'pdf', 980, '2026-07-28', 'per-hendra'],
  ],
  'at-molding': [['manual', 'Haitian MA series manual', 'pdf', 11_200, '2021-03-10', 'per-fajar']],
  'at-conveyor': [['drawing', 'Conveyor layout drawing', 'pdf', 1_480, '2020-06-01', 'per-fajar']],
  'at-gauge': [['certificate', 'Calibration certificate', 'pdf', 240, '2025-11-12', 'per-lina']],
  'at-thermo': [['certificate', 'Calibration certificate', 'pdf', 250, '2026-03-18', 'per-lina']],
  'at-sensor': [['certificate', 'Calibration certificate', 'pdf', 230, '2026-07-21', 'per-lina']],
  'at-scale': [['certificate', 'Calibration certificate', 'pdf', 260, '2025-10-03', 'per-lina']],
  'at-robot': [['manual', 'Epson T6 manual', 'pdf', 4_900, '2024-10-20', 'per-fajar']],
  'at-tester': [['manual', 'Cosmo LS-R902 manual', 'pdf', 3_600, '2025-03-05', 'per-fajar']],
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

export const documents: AssetDocument[] = assets
  .filter((a) => !a.parentId || a.calibration)
  .flatMap((a) => {
    const rows = a.code === 'POL-03' ? POL03_DOCS : (TYPE_DOCS[a.typeId] ?? [])
    return rows
      .filter(([, , , , uploaded]) => uploaded >= a.installedAt.slice(0, 10))
      .map(([type, name, ext, sizeKb, uploaded, by], i) => ({
        id: `doc-${a.code.toLowerCase()}-${i + 1}`,
        assetId: a.id,
        type,
        name,
        fileName: `${a.code}_${slug(name)}.${ext}`,
        sizeKb,
        uploadedAt: d(uploaded),
        uploadedBy: by,
      }))
  })
