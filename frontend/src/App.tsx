import { useEffect } from 'react'
import { AppRoutes } from '@/routes/AppRoutes'
import { authService } from '@/services/authService'
import { useAuthStore } from '@/store/authStore'
import { usePublicSettings } from '@/hooks/usePublicSettings'
import { Toaster } from '@/components/ui/sonner'

function App() {
  const setLoading = useAuthStore((s) => s.setLoading)
  const setUser = useAuthStore((s) => s.setUser)
  const clear = useAuthStore((s) => s.clear)
  // Only resolves once authenticated (the endpoint requires a session) —
  // document.title keeps whatever static value index.html set until then,
  // e.g. on the login page. Acceptable: branding the guest-facing login
  // page would need a public-without-auth endpoint, which is out of
  // scope here (see backend Task 4's decision to gate this on authenticate).
  const { appName } = usePublicSettings()

  // The auth store isn't persisted (session lives in httpOnly cookies), so
  // every hard reload starts from "idle" and needs re-hydrating from
  // whatever cookie the browser is still holding.
  useEffect(() => {
    setLoading()
    authService.me().then(setUser).catch(clear)
  }, [setLoading, setUser, clear])

  useEffect(() => {
    if (appName) document.title = appName
  }, [appName])

  return (
    <>
      <AppRoutes />
      <Toaster richColors closeButton position="top-right" />
    </>
  )
}

export default App
