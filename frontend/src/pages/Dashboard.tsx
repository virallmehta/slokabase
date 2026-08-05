import { useAuthStore } from '@/store/authStore'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

// Placeholder metric cards — no metrics endpoint exists yet, so these show
// a dash rather than fabricated numbers. Swap `value` for a real query
// once a metrics API is wired up.
const METRICS = [
  { label: 'Total products', hint: 'Products module' },
  { label: 'Total sales', hint: 'Sales module' },
  { label: 'Active users', hint: 'Users module' },
  { label: 'This month', hint: 'Reporting' },
]

export default function Dashboard() {
  const user = useAuthStore((s) => s.user)

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Welcome back, {user?.name}</h1>
        <p className="text-muted-foreground text-sm">Here's what's happening across your workspace.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {METRICS.map((metric) => (
          <Card key={metric.label}>
            <CardHeader>
              <CardDescription>{metric.label}</CardDescription>
              <CardTitle className="text-3xl">—</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-xs">{metric.hint}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
