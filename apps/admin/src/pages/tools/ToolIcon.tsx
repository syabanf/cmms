import type { LucideIcon, LucideProps } from 'lucide-react'
import {
  Activity,
  ArrowUpFromLine,
  Camera,
  CircleGauge,
  Cog,
  Crosshair,
  Droplet,
  Gauge,
  PlugZap,
  Thermometer,
  Wrench,
  Zap,
} from 'lucide-react'

const CATEGORY_ICON: Record<string, LucideIcon> = {
  'torque wrench': Wrench,
  'bearing puller': Cog,
  multimeter: CircleGauge,
  'thermal gun': Thermometer,
  'vibration meter': Activity,
  'thermal camera': Camera,
  'insulation tester': Zap,
  'clamp meter': PlugZap,
  'laser alignment': Crosshair,
  'dial gauge': Gauge,
  'grease gun': Droplet,
  'hydraulic jack': ArrowUpFromLine,
}

/** Icon for a tool category. Categories are free text, so unknown ones get a wrench. */
export function ToolIcon({ category, ...props }: { category: string } & LucideProps) {
  const Icon = CATEGORY_ICON[category.trim().toLowerCase()] ?? Wrench
  return <Icon {...props} />
}
