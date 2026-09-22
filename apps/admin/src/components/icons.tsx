import type { AssetIconKey, WoType } from '@cmms/types'
import type { LucideIcon, LucideProps } from 'lucide-react'
import {
  BatteryCharging,
  CalendarClock,
  CircuitBoard,
  ClipboardCheck,
  Cog,
  Cpu,
  Cylinder,
  Disc,
  Drill,
  Droplet,
  Droplets,
  Fan,
  Forklift,
  Gauge,
  Hammer,
  Heater,
  Layers,
  Orbit,
  Package,
  Radio,
  RobotArm,
  Rows3,
  Scale,
  Siren,
  Snowflake,
  Sparkles,
  SprayCan,
  Thermometer,
  ThermometerSnowflake,
  Wind,
  Wrench,
  Zap,
} from 'lucide-react'

const ASSET_ICON: Record<AssetIconKey, LucideIcon> = {
  polisher: Disc,
  lathe: Cylinder,
  mill: Drill,
  press: Hammer,
  molding: Layers,
  oven: Heater,
  booth: SprayCan,
  conveyor: Rows3,
  robot: RobotArm,
  tester: Droplets,
  packer: Package,
  forklift: Forklift,
  compressor: Wind,
  dryer: ThermometerSnowflake,
  panel: Zap,
  genset: BatteryCharging,
  chiller: Snowflake,
  tower: Fan,
  pump: Droplet,
  motor: Cog,
  spindle: Orbit,
  inverter: CircuitBoard,
  plc: Cpu,
  gauge: Gauge,
  thermometer: Thermometer,
  scale: Scale,
  sensor: Radio,
}

export function AssetIcon({ icon, ...props }: { icon: AssetIconKey | undefined } & LucideProps) {
  const Icon = icon ? ASSET_ICON[icon] : Cog
  return <Icon {...props} />
}

export const WO_TYPE_ICON: Record<WoType, LucideIcon> = {
  corrective: Wrench,
  preventive: CalendarClock,
  inspection: ClipboardCheck,
  emergency: Siren,
  improvement: Sparkles,
  calibration: Gauge,
}

export function WoTypeIcon({ type, ...props }: { type: WoType } & LucideProps) {
  const Icon = WO_TYPE_ICON[type]
  return <Icon {...props} />
}
