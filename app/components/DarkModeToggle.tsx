'use client'

import { Sun, Moon } from 'lucide-react'
import { useDarkMode } from '@/hooks/useDarkMode'

export default function DarkModeToggle() {
  const { isDarkMode, toggleDarkMode } = useDarkMode()

  return (
    <button
      type="button"
      onClick={(e) => toggleDarkMode(e)}
      className={`p-1.5 sm:p-2 rounded-xl border transition cursor-pointer flex items-center justify-center ${
        isDarkMode
          ? 'bg-amber-400/10 border-amber-400/30 text-amber-400 hover:bg-amber-400/20'
          : 'bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100'
      }`}
      title={isDarkMode ? 'Beralih ke Mode Terang' : 'Beralih ke Mode Gelap'}
    >
      {isDarkMode ? (
        <Sun className="w-4 h-4 sm:w-5 sm:h-5" />
      ) : (
        <Moon className="w-4 h-4 sm:w-5 sm:h-5" />
      )}
    </button>
  )
}
