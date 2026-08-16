import { Toaster as Sonner, type ToasterProps } from 'sonner'
import { useThemeStore } from '@/store/themeStore'

// Wired to this app's own themeStore rather than next-themes (this isn't
// a Next.js app) — see TopBar.tsx for the same store powering the
// light/dark toggle, so toasts always match whatever the rest of the UI
// is showing.
function Toaster({ ...props }: ToasterProps) {
  const theme = useThemeStore((s) => s.theme)

  return (
    <Sonner
      theme={theme}
      className="toaster group"
      style={
        {
          '--normal-bg': 'var(--popover)',
          '--normal-text': 'var(--popover-foreground)',
          '--normal-border': 'var(--border)',
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
