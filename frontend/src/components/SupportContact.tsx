import { Mail } from 'lucide-react'
import { usePublicSettings } from '@/hooks/usePublicSettings'

// Renders nothing while loading, on error, or if support_email is empty
// — a missing/broken help link is worse than no footer at all, and
// SidebarFooter (its only current mount point, see AppSidebar.tsx) is
// meant to be unobtrusive, not a loading-state showcase.
export function SupportContact() {
  const { supportEmail, status } = usePublicSettings()

  if (status !== 'success' || !supportEmail) return null

  return (
    <a
      href={`mailto:${supportEmail}`}
      className="text-muted-foreground hover:text-foreground flex items-center gap-2 px-2 py-1.5 text-xs group-data-[collapsible=icon]:justify-center"
    >
      <Mail className="size-3.5 shrink-0" />
      <span className="truncate group-data-[collapsible=icon]:hidden">{supportEmail}</span>
    </a>
  )
}
