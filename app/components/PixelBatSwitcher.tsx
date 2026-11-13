'use client'

import { useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'

interface PixelBatSwitcherProps {
  isDarkMode?: boolean
  variant?: 'floating' | 'header'
}

export default function PixelBatSwitcher({
  isDarkMode = false,
  variant = 'floating',
}: PixelBatSwitcherProps) {
  const pathname = usePathname() || '/'
  const router = useRouter()
  const [isFlyingAway, setIsFlyingAway] = useState(false)

  const isSmkMode = pathname.startsWith('/smk')

  const handleToggleUnit = () => {
    if (isFlyingAway) return
    setIsFlyingAway(true)

    setTimeout(() => {
      if (isSmkMode) {
        const targetSmp = pathname.replace(/^\/smk/, '') || '/'
        router.push(targetSmp)
      } else {
        const targetSmk = pathname === '/' ? '/smk' : `/smk${pathname}`
        router.push(targetSmk)
      }
      setIsFlyingAway(false)
    }, 260)
  }

  // =========================================================================
  // VARIAN 1: HEADER KOMPAK (Opsional jika ingin diletakkan di dalam Header)
  // =========================================================================
  if (variant === 'header') {
    return (
      <>
        <style jsx>{`
          .mini-bat-box {
            width: 28px;
            height: 18px;
            display: flex;
            align-items: center;
            justify-content: center;
            position: relative;
          }
          .mini-pixel-bat {
            width: 1px;
            height: 1px;
            background: transparent;
            transform: scale(1.7);
            transform-origin: center;
            animation: miniBatFlap 0.42s steps(1) infinite;
          }
          @keyframes miniBatFlap {
            0%, 100% {
              box-shadow:
                -2px -3px #fbbf24, 2px -3px #fbbf24,
                -2px -2px #0f172a, -1px -2px #1e293b, 0px -2px #1e293b, 1px -2px #1e293b, 2px -2px #0f172a,
                -2px -1px #0f172a, -1px -1px #f43f5e, 0px -1px #0f172a, 1px -1px #f43f5e, 2px -1px #0f172a,
                -1px 0px #1e293b, 0px 0px #334155, 1px 0px #1e293b,
                -1px 1px #0f172a, 0px 1px #1e293b, 1px 1px #0f172a,
                0px 2px #fbbf24,
                -3px -1px #1e293b, -4px -2px #334155, -5px -3px #fbbf24, -6px -3px #fbbf24, -7px -2px #334155,
                -3px 0px #0f172a, -4px -1px #1e293b, -5px -2px #334155, -6px -1px #0f172a,
                3px -1px #1e293b, 4px -2px #334155, 5px -3px #fbbf24, 6px -3px #fbbf24, 7px -2px #334155,
                3px 0px #0f172a, 4px -1px #1e293b, 5px -2px #334155, 6px -1px #0f172a;
            }
            50% {
              box-shadow:
                -2px -3px #fbbf24, 2px -3px #fbbf24,
                -2px -2px #0f172a, -1px -2px #1e293b, 0px -2px #1e293b, 1px -2px #1e293b, 2px -2px #0f172a,
                -2px -1px #0f172a, -1px -1px #fbbf24, 0px -1px #0f172a, 1px -1px #fbbf24, 2px -1px #0f172a,
                -1px 0px #1e293b, 0px 0px #334155, 1px 0px #1e293b,
                -1px 1px #0f172a, 0px 1px #1e293b, 1px 1px #0f172a,
                0px 2px #fbbf24,
                -3px 0px #1e293b, -4px 1px #334155, -5px 2px #fbbf24, -6px 3px #fbbf24, -7px 3px #334155,
                -3px 1px #0f172a, -4px 2px #1e293b, -5px 3px #0f172a,
                3px 0px #1e293b, 4px 1px #334155, 5px 2px #fbbf24, 6px 3px #fbbf24, 7px 3px #334155,
                3px 1px #0f172a, 4px 2px #1e293b, 5px 3px #0f172a;
            }
          }
        `}</style>

        <button
          type="button"
          onClick={handleToggleUnit}
          title={
            isSmkMode
              ? 'Kembali ke Portal SMP Muna Mustofa'
              : 'Buka Portal SMK Muna Mustofa (DKV)'
          }
          className={`px-2 py-1 rounded-lg border text-[10px] font-black flex items-center gap-1 transition active:scale-95 cursor-pointer shadow-xs shrink-0 ${
            isDarkMode
              ? 'bg-emerald-950/80 border-emerald-700 text-emerald-300 hover:bg-emerald-900'
              : 'bg-emerald-50 border-emerald-300 text-emerald-800 hover:bg-emerald-100'
          }`}
        >
          <div className="mini-bat-box">
            <div className="mini-pixel-bat" />
          </div>
          <span>{isSmkMode ? 'KE SMP' : 'SMK DKV'}</span>
        </button>
      </>
    )
  }

  // =========================================================================
  // VARIAN 2: FLOATING COIN-SIZE HIGH-CONTRAST PIXEL BAT (POJOK KIRI BAWAH)
  // =========================================================================
  return (
    <>
      <style jsx>{`
        .coin-bat-stage {
          width: 64px;
          height: 44px;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          animation: batHoverFloat 2.2s ease-in-out infinite;
        }

        .coin-pixel-bat {
          width: 1px;
          height: 1px;
          background: transparent;
          transform: scale(3.5);
          transform-origin: center;
          animation: highContrastFlap 0.42s steps(1) infinite;
        }

        @keyframes batHoverFloat {
          0%, 100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-5px);
          }
        }

        /* High-Contrast Pixel Bat (Siluet Gelap + Outline Emas + Mata Menyala) */
        @keyframes highContrastFlap {
          /* Frame 1: Sayap Terbentang ke Atas */
          0%, 100% {
            box-shadow:
              /* Outline Atas Telinga & Kepala */
              -2px -4px #fbbf24, 2px -4px #fbbf24,
              -3px -3px #fbbf24, -1px -3px #fbbf24, 0px -3px #fbbf24, 1px -3px #fbbf24, 3px -3px #fbbf24,
              /* Telinga & Dahi Gelap */
              -2px -3px #0f172a, 2px -3px #0f172a,
              -2px -2px #0f172a, -1px -2px #1e293b, 0px -2px #1e293b, 1px -2px #1e293b, 2px -2px #0f172a,
              /* Mata Merah Menyala */
              -2px -1px #0f172a, -1px -1px #f43f5e, 0px -1px #0f172a, 1px -1px #f43f5e, 2px -1px #0f172a,
              /* Badan & Outline Bawah */
              -1px 0px #1e293b, 0px 0px #334155, 1px 0px #1e293b,
              -1px 1px #0f172a, 0px 1px #1e293b, 1px 1px #0f172a,
              -2px 1px #fbbf24, 2px 1px #fbbf24,
              -1px 2px #fbbf24, 0px 2px #0f172a, 1px 2px #fbbf24,
              0px 3px #fbbf24,

              /* Sayap Kiri Atas + Outline Emas */
              -4px -3px #fbbf24, -5px -4px #fbbf24, -6px -4px #fbbf24, -7px -3px #fbbf24, -8px -2px #fbbf24,
              -3px -2px #fbbf24, -4px -2px #1e293b, -5px -3px #334155, -6px -3px #334155, -7px -2px #1e293b,
              -3px -1px #0f172a, -4px -1px #1e293b, -5px -2px #1e293b, -6px -2px #0f172a, -7px -1px #fbbf24,
              -3px 0px #0f172a, -4px 0px #1e293b, -5px -1px #0f172a, -6px -1px #fbbf24,
              -3px 1px #fbbf24, -4px 1px #fbbf24, -5px 0px #fbbf24,

              /* Sayap Kanan Atas + Outline Emas */
              4px -3px #fbbf24, 5px -4px #fbbf24, 6px -4px #fbbf24, 7px -3px #fbbf24, 8px -2px #fbbf24,
              3px -2px #fbbf24, 4px -2px #1e293b, 5px -3px #334155, 6px -3px #334155, 7px -2px #1e293b,
              3px -1px #0f172a, 4px -1px #1e293b, 5px -2px #1e293b, 6px -2px #0f172a, 7px -1px #fbbf24,
              3px 0px #0f172a, 4px 0px #1e293b, 5px -1px #0f172a, 6px -1px #fbbf24,
              3px 1px #fbbf24, 4px 1px #fbbf24, 5px 0px #fbbf24;
          }

          /* Frame 2: Sayap Mengepak ke Bawah */
          50% {
            box-shadow:
              /* Outline Atas Telinga & Kepala */
              -2px -4px #fbbf24, 2px -4px #fbbf24,
              -3px -3px #fbbf24, -1px -3px #fbbf24, 0px -3px #fbbf24, 1px -3px #fbbf24, 3px -3px #fbbf24,
              /* Telinga & Dahi Gelap */
              -2px -3px #0f172a, 2px -3px #0f172a,
              -2px -2px #0f172a, -1px -2px #1e293b, 0px -2px #1e293b, 1px -2px #1e293b, 2px -2px #0f172a,
              /* Mata Amber Menyala */
              -2px -1px #0f172a, -1px -1px #fbbf24, 0px -1px #0f172a, 1px -1px #fbbf24, 2px -1px #0f172a,
              /* Badan & Outline Bawah */
              -1px 0px #1e293b, 0px 0px #334155, 1px 0px #1e293b,
              -1px 1px #0f172a, 0px 1px #1e293b, 1px 1px #0f172a,
              -1px 2px #fbbf24, 0px 2px #0f172a, 1px 2px #fbbf24,
              0px 3px #fbbf24,

              /* Sayap Kiri Bawah + Outline Emas */
              -3px -1px #fbbf24, -4px 0px #fbbf24, -5px 1px #fbbf24, -6px 2px #fbbf24, -7px 2px #fbbf24, -8px 3px #fbbf24,
              -3px 0px #1e293b, -4px 1px #334155, -5px 2px #334155, -6px 3px #1e293b, -7px 3px #0f172a,
              -3px 1px #0f172a, -4px 2px #1e293b, -5px 3px #0f172a, -6px 4px #fbbf24, -7px 4px #fbbf24,
              -2px 2px #fbbf24, -3px 2px #fbbf24, -4px 3px #fbbf24, -5px 4px #fbbf24,

              /* Sayap Kanan Bawah + Outline Emas */
              3px -1px #fbbf24, 4px 0px #fbbf24, 5px 1px #fbbf24, 6px 2px #fbbf24, 7px 2px #fbbf24, 8px 3px #fbbf24,
              3px 0px #1e293b, 4px 1px #334155, 5px 2px #334155, 6px 3px #1e293b, 7px 3px #0f172a,
              3px 1px #0f172a, 4px 2px #1e293b, 5px 3px #0f172a, 6px 4px #fbbf24, 7px 4px #fbbf24,
              2px 2px #fbbf24, 3px 2px #fbbf24, 4px 3px #fbbf24, 5px 4px #fbbf24;
          }
        }
      `}</style>

      {/* Posisi Permanen di Pojok Kiri Bawah */}
      <button
        type="button"
        onClick={handleToggleUnit}
        title={
          isSmkMode
            ? 'Kembali ke Portal SMP Muna Mustofa'
            : 'Buka Portal SMK Muna Mustofa (DKV)'
        }
        aria-label={
          isSmkMode
            ? 'Kembali ke Portal SMP Muna Mustofa'
            : 'Buka Portal SMK Muna Mustofa (DKV)'
        }
        className={`fixed bottom-20 left-3 sm:left-5 z-50 flex flex-col items-center group cursor-pointer select-none focus:outline-none transition-all duration-300 ${
          isFlyingAway
            ? '-translate-y-16 scale-125 opacity-0'
            : 'hover:scale-110 active:scale-95'
        }`}
      >
        {/* Kelelawar Piksel Ukuran Koin (~56px) */}
        <div className="coin-bat-stage drop-shadow-[0_6px_10px_rgba(0,0,0,0.45)]">
          <div className="coin-pixel-bat" />
        </div>

        {/* Bayangan Lantai & Label Dinamis (SMK DKV / KE SMP) */}
        <div className="w-8 h-1.5 rounded-full bg-black/25 blur-[1px] -mt-1 mb-1 group-hover:w-6 transition-all" />
        <span
          className={`px-2 py-0.5 rounded-full text-[9px] font-black tracking-wider uppercase border shadow-md transition-colors ${
            isDarkMode
              ? 'bg-slate-900/95 border-amber-400/50 text-amber-300 group-hover:bg-amber-400 group-hover:text-slate-950'
              : 'bg-slate-900/90 border-amber-400 text-amber-300 group-hover:bg-amber-400 group-hover:text-slate-950'
          }`}
        >
          {isSmkMode ? 'KE SMP' : 'SMK DKV'}
        </span>
      </button>
    </>
  )
}