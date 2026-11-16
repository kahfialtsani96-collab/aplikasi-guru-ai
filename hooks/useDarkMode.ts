'use client'
import { useEffect, useState } from 'react'

/**
 * Hook terpusat untuk deteksi tema dark mode.
 *
 * Membaca preferensi tema dari localStorage('theme') saat mount dan
 * mengembalikan { isDarkMode, setIsDarkMode } agar kompatibel dengan
 * pemakaian lama di halaman-halaman aplikasi (toggle aktif di dashboard).
 */
export function useDarkMode() {
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false)

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme')
    if (savedTheme === 'dark') {
      setIsDarkMode(true)
    }
  }, [])

  return { isDarkMode, setIsDarkMode }
}
