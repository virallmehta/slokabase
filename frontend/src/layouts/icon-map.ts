import { Box, History, LayoutGrid, Receipt, Settings, Shield, type LucideIcon } from 'lucide-react'

// Backend modules (backend/modules/<name>/config.js) declare their menu
// icon as an opaque string key, not a component — resolve it here.
// Unknown/future keys fall back to a generic icon rather than crashing.
const ICONS: Record<string, LucideIcon> = {
  box: Box,
  receipt: Receipt,
  shield: Shield,
  history: History,
  settings: Settings,
}

export function resolveIcon(name: string): LucideIcon {
  return ICONS[name] ?? LayoutGrid
}
