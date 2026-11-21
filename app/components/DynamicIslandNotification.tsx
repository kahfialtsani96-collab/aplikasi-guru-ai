'use client'
import { useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { Bell, X, ArrowRight, Wallet } from 'lucide-react'

export type Accent = 'indigo' | 'amber' | 'emerald'

interface DynamicIslandNotificationProps {
  title: string
  subtitle: string
  badge: number
  accent?: Accent
  link?: string
  periode?: string
}

const ACCENTS: Record<Accent, { icon: string; glow: string; ring: string }> = {
  indigo: { icon: 'text-indigo-300', glow: 'shadow-indigo-500/40', ring: 'ring-indigo-400/60' },
  amber: { icon: 'text-amber-300', glow: 'shadow-amber-500/40', ring: 'ring-amber-400/60' },
  emerald: { icon: 'text-emerald-300', glow: 'shadow-emerald-500/40', ring: 'ring-emerald-400/60' },
}

export default function DynamicIslandNotification({
  title,
  subtitle,
  badge,
  accent = 'indigo',
  link = '/honorarium',
  periode,
}: DynamicIslandNotificationProps) {
  const [expanded, setExpanded] = useState(false)
  if (!badge || badge <= 0) return null
  const a = ACCENTS[accent]
  const href = periode ? `/honorarium?periode=${encodeURIComponent(periode)}` : link

  return (
    <div className="fixed top-3 left-1/2 -translate-x-1/2 z-[80] w-full max-w-sm px-4 pointer-events-none">
      <AnimatePresence>
        <motion.div
          layout
          initial={{ y: -80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -80, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 260, damping: 24 }}
          onClick={() => setExpanded((v) => !v)}
          className={`relative mx-auto cursor-pointer rounded-full overflow-hidden shadow-2xl ${a.glow} ring-1 ${a.ring} pointer-events-auto transition-all duration-300 ${
            expanded ? 'rounded-3xl' : ''
          }`}
        >
          {/* Lapisan border gradien warna-warni yang berputar (hanya sebelum dikonfirmasi/expand) */}
          {!expanded && (
            <div className="absolute inset-0 rounded-[inherit] p-[2px] pointer-events-none">
              <div
                className="absolute left-1/2 top-1/2 w-[200%] aspect-square -translate-x-1/2 -translate-y-1/2 animate-spin"
                style={{
                  background:
                    'conic-gradient(from 0deg, #818cf8, #f472b6, #fbbf24, #34d399, #22d3ee, #818cf8)',
                }}
              />
            </div>
          )}

          {/* Pill konten */}
          <div
            className={`relative rounded-[inherit] bg-black/85 backdrop-blur-xl text-white transition-all duration-300 ${
              expanded ? 'p-5' : 'p-2.5'
            }`}
          >
            {!expanded ? (
              <div className="flex items-center justify-center gap-2.5">
                <span className="relative">
                  <Bell className={`w-4 h-4 ${a.icon}`} />
                  <span className="absolute -top-1.5 -right-1.5 text-[9px] font-black bg-red-500 text-white rounded-full min-w-[16px] h-4 flex items-center justify-center px-1">
                    {badge}
                  </span>
                </span>
                <span className="text-xs font-bold whitespace-nowrap">{title}</span>
              </div>
            ) : (
              <div className="relative space-y-3">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setExpanded(false)
                  }}
                  className="absolute top-0 right-0 text-white/60 hover:text-white transition-colors shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
                <div className="flex flex-col items-center text-center gap-2">
                  <Wallet className={`w-5 h-5 shrink-0 ${a.icon}`} />
                  <span>
                    <span className="block text-sm font-black leading-tight">{title}</span>
                    <span className="block text-[11px] text-white/70 mt-1 leading-snug">{subtitle}</span>
                  </span>
                </div>
                <Link
                  href={href}
                  onClick={(e) => e.stopPropagation()}
                  className="flex items-center justify-center gap-1.5 w-full text-[11px] font-black px-4 py-2 rounded-full bg-white text-black hover:bg-white/90 active:scale-95 transition-all"
                >
                  Buka Honorarium <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            )}
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
