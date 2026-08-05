import { useParams } from 'react-router-dom'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

/**
 * Catches any /:moduleKey route the sidebar links to that doesn't have a
 * real page yet (see routes/AppRoutes.tsx) — every module the backend
 * registers is navigable immediately, even before its dedicated page
 * exists.
 */
export default function PlaceholderPage() {
  const { moduleKey } = useParams<{ moduleKey: string }>()
  const label = moduleKey ? moduleKey.charAt(0).toUpperCase() + moduleKey.slice(1) : 'Page'

  return (
    <Card>
      <CardHeader>
        <CardTitle>{label}</CardTitle>
        <CardDescription>This page hasn&apos;t been built yet.</CardDescription>
      </CardHeader>
    </Card>
  )
}
