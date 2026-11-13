'use client'

import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'

interface KineticMorphLoaderProps {
  isDarkMode: boolean
  onComplete: () => void
}

export default function KineticMorphLoader({
  isDarkMode,
  onComplete,
}: KineticMorphLoaderProps) {
  const [progress, setProgress] = useState(1)
  const [phase, setPhase] = useState<'grid' | 'circle' | 'star' | 'split' | 'reveal'>('grid')
  const hasCompletedRef = useRef(false)

  useEffect(() => {
    hasCompletedRef.current = false
    const duration = 3400 // Durasi penghitung 1% -> 100% (3.4 detik)
    const startTime = performance.now()
    let animationFrameId: number
    let redirectTimer: ReturnType<typeof setTimeout>

    const tick = (now: number) => {
      const elapsed = now - startTime
      const rawRatio = Math.min(elapsed / duration, 1)
      const easedRatio =
        rawRatio < 0.5
          ? 2 * rawRatio * rawRatio
          : 1 - Math.pow(-2 * rawRatio + 2, 2) / 2

      const currentPct = Math.max(1, Math.min(100, Math.round(easedRatio * 100)))
      setProgress(currentPct)

      if (currentPct < 30) {
        setPhase('grid')
      } else if (currentPct < 55) {
        setPhase('circle')
      } else if (currentPct < 78) {
        setPhase('star')
      } else if (currentPct < 100) {
        setPhase('split')
      } else {
        setPhase('reveal')
      }

      if (rawRatio < 1) {
        animationFrameId = requestAnimationFrame(tick)
      } else if (!hasCompletedRef.current) {
        hasCompletedRef.current = true
        redirectTimer = setTimeout(() => {
          onComplete()
        }, 650)
      }
    }

    animationFrameId = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(animationFrameId)
      clearTimeout(redirectTimer)
    }
  }, [onComplete])

  const getStatusText = () => {
    if (progress < 30) return 'MEMVERIFIKASI SESI'
    if (progress < 60) return 'MEMUAT PROFIL GURU'
    if (progress < 90) return 'SINKRONISASI DATA'
    return 'MENYIAPKAN DASHBOARD'
  }

  const primaryShapeColor = isDarkMode ? '#F8FAFC' : '#1E1B4B'
  const accentShapeColor = isDarkMode ? '#10B981' : '#059669'
  const revealBgColor = isDarkMode ? '#020617' : '#E2E8F0'

  const getOffsets = () => {
    if (phase === 'grid' || phase === 'split') return 14
    if (phase === 'circle') return 11
    return 0
  }

  const offset = getOffsets()
  const borderRadius =
    phase === 'grid' ? '6px' : phase === 'split' ? '8px' : '9999px'

  const shapes = [
    { id: 0, x: -offset, y: -offset, isAccent: false },
    { id: 1, x: offset, y: -offset, isAccent: true },
    { id: 2, x: -offset, y: offset, isAccent: false },
    { id: 3, x: offset, y: offset, isAccent: false },
  ]

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35 }}
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden select-none ${
        isDarkMode ? 'bg-[#09090B] text-slate-100' : 'bg-slate-100 text-slate-900'
      }`}
    >
      {/* WATERMARK LOGO SEKOLAH HALUS */}
      <div
        className={`fixed inset-0 pointer-events-none flex items-center justify-center ${
          isDarkMode ? 'opacity-[0.04]' : 'opacity-[0.08]'
        }`}
      >
        <img
          src="/logo-smp.jpg"
          alt="Watermark SMP Muna Mustofa"
          className="w-[520px] h-[520px] object-contain"
        />
      </div>

      {/* KONTEN UTAMA LOADER */}
      <div className="relative z-10 flex flex-col items-center">
        {/* IKON GEOMETRI 2x2 KINETIC MORPH */}
        <div className="relative w-24 h-24 flex items-center justify-center mb-6">
          <motion.div
            animate={{
              scale: phase === 'star' ? [1, 1.35, 1.15] : 0.6,
              opacity: phase === 'star' ? 0.45 : 0,
            }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className="absolute w-16 h-16 rounded-full blur-xl pointer-events-none"
            style={{ backgroundColor: accentShapeColor }}
          />

          <motion.div
            animate={{
              rotate:
                phase === 'grid'
                  ? 0
                  : phase === 'circle'
                  ? 90
                  : phase === 'star'
                  ? 225
                  : 360,
              scale: phase === 'reveal' ? 0.2 : 1,
            }}
            transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
            className="relative w-full h-full flex items-center justify-center"
          >
            {shapes.map((item) => (
              <motion.div
                key={item.id}
                animate={{
                  x: item.x,
                  y: item.y,
                  borderRadius,
                  scale: phase === 'star' ? 1.25 : 1,
                  rotate: phase === 'star' ? 45 : 0,
                }}
                transition={{
                  type: 'spring',
                  stiffness: 180,
                  damping: 18,
                }}
                style={{
                  backgroundColor: item.isAccent
                    ? accentShapeColor
                    : primaryShapeColor,
                }}
                className="absolute w-5 h-5 shadow-sm"
              />
            ))}
          </motion.div>
        </div>

        {/* ANGKA PERSENTASE BESAR (1% - 100%) */}
        <motion.div
          animate={{
            opacity: phase === 'reveal' ? 0 : 1,
            y: phase === 'reveal' ? -10 : 0,
          }}
          transition={{ duration: 0.25 }}
          className="flex items-start justify-center font-black tracking-tighter leading-none mb-8"
        >
          <span className="text-6xl sm:text-7xl tabular-nums">{progress}</span>
          <span
            className="text-xl sm:text-2xl font-extrabold ml-1 mt-1"
            style={{ color: accentShapeColor }}
          >
            %
          </span>
        </motion.div>

        {/* BARIS LABEL, PROGRESS BAR & STATUS DINAMIS */}
        <motion.div
          animate={{
            opacity: phase === 'reveal' ? 0 : 1,
          }}
          transition={{ duration: 0.2 }}
          className="w-72 sm:w-80 space-y-2"
        >
          <div className="flex items-center justify-between text-[10px] font-extrabold tracking-widest uppercase">
            <span className={isDarkMode ? 'text-slate-400' : 'text-slate-600'}>
              APLIKASI GURU AI
            </span>
            <span style={{ color: accentShapeColor }}>{getStatusText()}</span>
          </div>

          <div
            className={`w-full h-1 rounded-full overflow-hidden ${
              isDarkMode ? 'bg-slate-800' : 'bg-slate-300'
            }`}
          >
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-indigo-600 to-emerald-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </motion.div>
      </div>

      {/* EXPANDING CIRCLE REVEAL TRANSITION */}
      {phase === 'reveal' && (
        <motion.div
          initial={{ scale: 0, opacity: 1 }}
          animate={{ scale: 45 }}
          transition={{ duration: 0.65, ease: [0.76, 0, 0.24, 1] }}
          style={{ backgroundColor: revealBgColor }}
          className="fixed w-16 h-16 rounded-full z-50 pointer-events-none shadow-2xl"
        />
      )}
    </motion.div>
  )
}