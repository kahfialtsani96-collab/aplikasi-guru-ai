import { useCallback, useEffect, useState } from 'react'

export type SmkColorKey = 'white' | 'green' | 'red' | 'cyan' | 'amber'

export interface SmkColor {
  label: string
  dotClass: string
  hex: string
  rgb: string
  textClass: string
  badgeBg: string
}

/**
 * Palet warna lampu SMK (sumber kebenaran tunggal).
 * Dipakai bersama oleh dashboard & seluruh subhalaman SMK.
 */
export const SMK_COLORS: Record<SmkColorKey, SmkColor> = {
  white: {
    label: 'Putih Studio',
    dotClass: 'bg-white',
    hex: '#ffffff',
    rgb: '255, 255, 255',
    textClass: 'text-white',
    badgeBg: 'bg-white/10',
  },
  green: {
    label: 'Hijau Neon',
    dotClass: 'bg-emerald-400',
    hex: '#34d399',
    rgb: '52, 211, 153',
    textClass: 'text-emerald-300',
    badgeBg: 'bg-emerald-500/15',
  },
  red: {
    label: 'Merah Crimson',
    dotClass: 'bg-rose-500',
    hex: '#f43f5e',
    rgb: '244, 63, 94',
    textClass: 'text-rose-300',
    badgeBg: 'bg-rose-500/15',
  },
  cyan: {
    label: 'Biru Cyan',
    dotClass: 'bg-cyan-400',
    hex: '#22d3ee',
    rgb: '34, 211, 238',
    textClass: 'text-cyan-300',
    badgeBg: 'bg-cyan-500/15',
  },
  amber: {
    label: 'Oranye Emas',
    dotClass: 'bg-amber-400',
    hex: '#fbbf24',
    rgb: '251, 191, 36',
    textClass: 'text-amber-300',
    badgeBg: 'bg-amber-500/15',
  },
}

export const SMK_COLOR_KEYS = Object.keys(SMK_COLORS) as SmkColorKey[]

const STORAGE_KEY = 'smk_lamp_color'
const DEFAULT_COLOR: SmkColorKey = 'green'

export function readSmkColor(): SmkColorKey {
  if (typeof window === 'undefined') return DEFAULT_COLOR
  try {
    const saved = window.sessionStorage.getItem(STORAGE_KEY) as SmkColorKey | null
    return saved && SMK_COLORS[saved] ? saved : DEFAULT_COLOR
  } catch {
    return DEFAULT_COLOR
  }
}

export function writeSmkColor(color: SmkColorKey): void {
  try {
    window.sessionStorage.setItem(STORAGE_KEY, color)
  } catch {
    /* abaikan (mis. storage tidak tersedia) */
  }
}

/**
 * Hook bersama: membaca warna pilihan dari sessionStorage dan menulis saat diubah.
 * Dipakai di dashboard & semua subhalaman SMK agar warna saling terhubung.
 */
export function useSmkColor() {
  const [color, setColorState] = useState<SmkColorKey>('green')

  useEffect(() => {
    // Baca warna tersimpan hanya di client setelah mount agar output server/client identik.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setColorState(readSmkColor())
  }, [])

  const setColor = useCallback((next: SmkColorKey) => {
    if (!SMK_COLORS[next]) return
    setColorState(next)
    writeSmkColor(next)
  }, [])

  return { color, setColor }
}
