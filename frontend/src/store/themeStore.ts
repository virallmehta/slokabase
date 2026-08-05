import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// Unlike authStore (deliberately unpersisted — see its own comment), this
// is a harmless UI preference with no security implication, so persisting
// it to localStorage is fine and is what makes the choice stick across
// reloads.
type Theme = 'light' | 'dark'

interface ThemeState {
  theme: Theme
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
}

function systemPrefersDark() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

// Toggles the `.dark` class the design system's dark-mode tokens key off
// (see index.css: `@custom-variant dark (&:is(.dark *))` + the `.dark {}`
// token block from Step 1). The matching sync script in index.html applies
// this before React mounts, so there's no flash of the wrong theme.
function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark')
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: systemPrefersDark() ? 'dark' : 'light',
      setTheme: (theme) => {
        applyTheme(theme)
        set({ theme })
      },
      toggleTheme: () => {
        const next = get().theme === 'dark' ? 'light' : 'dark'
        applyTheme(next)
        set({ theme: next })
      },
    }),
    {
      name: 'slokabase-theme',
      onRehydrateStorage: () => (state) => {
        if (state) applyTheme(state.theme)
      },
    }
  )
)
