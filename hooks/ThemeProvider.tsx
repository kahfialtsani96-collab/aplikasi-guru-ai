'use client'
import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import type { MouseEvent, ReactNode } from 'react'

interface DarkModeContextValue {
  isDarkMode: boolean
  setIsDarkMode: (value: boolean) => void
  toggleDarkMode: (event?: MouseEvent<HTMLElement>) => void
  mounted: boolean
}

const DarkModeContext = createContext<DarkModeContextValue | null>(null)

/**
 * Satu-satunya kunci localStorage untuk tema gelap/terang di seluruh aplikasi.
 * Semua halaman & komponen wajib membaca/menulis kunci ini (via ThemeProvider).
 */
export const DARK_MODE_STORAGE_KEY = 'aplikasi-guru-dark-mode'

/** Terapkan / hapus class `dark` pada <html> agar sinkron dengan state global & variant dark: Tailwind */
function applyThemeToDom(isDark: boolean) {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  if (isDark) root.classList.add('dark')
  else root.classList.remove('dark')
}

/**
 * ThemeProvider — sumber tunggal state Dark Mode untuk seluruh aplikasi.
 * State global dibagikan via Context sehingga setiap halaman/komponen yang
 * memanggil useDarkMode() membaca & merespons nilai yang sama secara real-time.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  // Default TETAP sama antara server & client (true / gelap, cocok dengan <html className="dark">)
  // untuk menghindari hydration mismatch. Nilai nyata dari localStorage baru dibaca SETELAH mounted.
  const [mounted, setMounted] = useState(false)
  const [isDarkMode, setIsDarkModeState] = useState<boolean>(true)

  // Setelah hidrasi: baca preferensi tersimpan & tandai mounted.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const savedTheme =
      window.localStorage.getItem(DARK_MODE_STORAGE_KEY) ??
      window.localStorage.getItem('theme') // migrasi satu kali dari kunci lama
    setIsDarkModeState(savedTheme !== 'light')
    setMounted(true)
  }, [])

  // Terapkan class `dark` ke <html> & simpan ke kunci tunggal (hanya setelah mounted).
  useEffect(() => {
    applyThemeToDom(isDarkMode)
    if (mounted) {
      window.localStorage.setItem(DARK_MODE_STORAGE_KEY, isDarkMode ? 'dark' : 'light')
    }
  }, [isDarkMode, mounted])

  const setIsDarkMode = useCallback((value: boolean) => {
    setIsDarkModeState(value)
  }, [])

  const toggleDarkMode = useCallback(
    (event?: MouseEvent<HTMLElement>) => {
      const nextState = !isDarkMode
      setIsDarkModeState(nextState)

      if (!document.startViewTransition) return

      const x = event?.clientX ?? window.innerWidth - 48
      const y = event?.clientY ?? 28
      const endRadius = Math.hypot(
        Math.max(x, window.innerWidth - x),
        Math.max(y, window.innerHeight - y)
      )

      const transition = document.startViewTransition(() => {
        applyThemeToDom(nextState)
      })

      transition.ready.then(() => {
        const clipPath = [
          `circle(0px at ${x}px ${y}px)`,
          `circle(${endRadius}px at ${x}px ${y}px)`,
        ]
        document.documentElement.animate(
          {
            clipPath: nextState ? clipPath : [...clipPath].reverse(),
          },
          {
            duration: 500,
            easing: 'ease-in-out',
            pseudoElement: nextState
              ? '::view-transition-new(root)'
              : '::view-transition-old(root)',
          }
        )
      })
    },
    [isDarkMode]
  )

  return (
    <DarkModeContext.Provider value={{ isDarkMode, setIsDarkMode, toggleDarkMode, mounted }}>
      {children}
    </DarkModeContext.Provider>
  )
}

/**
 * Hook global untuk membaca & mengubah Dark Mode.
 * Dipakai di seluruh halaman/komponen (pengganti state lokal lama).
 */
export function useDarkMode(): DarkModeContextValue {
  const ctx = useContext(DarkModeContext)
  return (
    ctx ?? {
      isDarkMode: true,
      setIsDarkMode: () => {},
      toggleDarkMode: () => {},
      mounted: false,
    }
  )
}
