'use client'

import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { usePathname, useRouter } from 'next/navigation'

interface PixelBatSwitcherProps {
  isDarkMode?: boolean
  variant?: 'floating' | 'header'
  targetHref?: string
}

interface FlightOrigin {
  x: number
  y: number
}

export default function PixelBatSwitcher({
  isDarkMode = false,
  variant = 'floating',
  targetHref,
}: PixelBatSwitcherProps) {
  const pathname = usePathname() || '/'
  const router = useRouter()
  const triggerRef = useRef<HTMLButtonElement | null>(null)

  const [isTransitioning, setIsTransitioning] = useState(false)
  const [flightOrigin, setFlightOrigin] = useState<FlightOrigin | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const isSmkMode = pathname.startsWith('/smk')

  const getTargetRoute = () => {
    if (targetHref) return targetHref
    if (isSmkMode) {
      // Langsung mengarah ke Dashboard utama SMP
      return '/'
    }
    return '/smk'
  }

  const handleToggleUnit = () => {
    if (isTransitioning) return

    const targetRoute = getTargetRoute()
    router.prefetch(targetRoute)

    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect()
      setFlightOrigin({
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      })
    } else {
      setFlightOrigin({
        x: 48,
        y: typeof window !== 'undefined' ? window.innerHeight - 100 : 600,
      })
    }

    setIsTransitioning(true)

    setTimeout(() => {
      router.push(targetRoute)
    }, 2950)

    setTimeout(() => {
      setIsTransitioning(false)
      setFlightOrigin(null)
    }, 3350)
  }

  const cinematicOverlay =
    mounted && isTransitioning && flightOrigin
      ? createPortal(
          <div
            className="fixed inset-0 z-[9999] pointer-events-none overflow-hidden"
            aria-hidden="true"
          >
            <style jsx>{`
              .bat-orbit-wrapper {
                position: fixed;
                left: 0;
                top: 0;
                width: 64px;
                height: 44px;
                margin-left: -32px;
                margin-top: -22px;
                will-change: transform, opacity;
                animation: nightPatrolOrbitDive 2.25s cubic-bezier(0.37, 0, 0.63, 1) forwards;
              }

              .bat-orbit-sprite {
                width: 1px;
                height: 1px;
                position: absolute;
                left: 50%;
                top: 50%;
                background: transparent;
                transform-origin: center;
                animation: orbitFlapWing 0.22s steps(1) infinite;
              }

              @keyframes nightPatrolOrbitDive {
                0% {
                  transform: translate3d(${flightOrigin.x}px, ${flightOrigin.y}px, 0)
                    scale(1) rotate(0deg);
                  opacity: 1;
                }
                18% {
                  transform: translate3d(26vw, 66vh, 0) scale(2.2) rotate(-18deg);
                  opacity: 1;
                }
                40% {
                  transform: translate3d(78vw, 62vh, 0) scale(3) rotate(-14deg);
                  opacity: 1;
                }
                62% {
                  transform: translate3d(52vw, 18vh, 0) scale(3.8) rotate(12deg);
                  opacity: 1;
                }
                80% {
                  transform: translate3d(22vw, 34vh, 0) scale(4.6) rotate(22deg);
                  opacity: 1;
                }
                94% {
                  transform: translate3d(50vw, 50vh, 0) scale(7.8) rotate(0deg);
                  opacity: 1;
                }
                100% {
                  transform: translate3d(50vw, 50vh, 0) scale(9.2) rotate(0deg);
                  opacity: 0;
                }
              }

              @keyframes orbitFlapWing {
                0%,
                100% {
                  box-shadow:
                    -2px -4px #fbbf24, 2px -4px #fbbf24,
                    -3px -3px #fbbf24, -1px -3px #fbbf24, 0px -3px #fbbf24, 1px -3px #fbbf24, 3px -3px #fbbf24,
                    -2px -3px #0f172a, 2px -3px #0f172a,
                    -2px -2px #0f172a, -1px -2px #1e293b, 0px -2px #1e293b, 1px -2px #1e293b, 2px -2px #0f172a,
                    -2px -1px #0f172a, -1px -1px #f43f5e, 0px -1px #0f172a, 1px -1px #f43f5e, 2px -1px #0f172a,
                    -1px 0px #1e293b, 0px 0px #334155, 1px 0px #1e293b,
                    -1px 1px #0f172a, 0px 1px #1e293b, 1px 1px #0f172a,
                    -2px 1px #fbbf24, 2px 1px #fbbf24,
                    -1px 2px #fbbf24, 0px 2px #0f172a, 1px 2px #fbbf24,
                    0px 3px #fbbf24,
                    -4px -3px #fbbf24, -5px -4px #fbbf24, -6px -4px #fbbf24, -7px -3px #fbbf24, -8px -2px #fbbf24,
                    -3px -2px #fbbf24, -4px -2px #1e293b, -5px -3px #334155, -6px -3px #334155, -7px -2px #1e293b,
                    -3px -1px #0f172a, -4px -1px #1e293b, -5px -2px #1e293b, -6px -2px #0f172a, -7px -1px #fbbf24,
                    -3px 0px #0f172a, -4px 0px #1e293b, -5px -1px #0f172a, -6px -1px #fbbf24,
                    -3px 1px #fbbf24, -4px 1px #fbbf24, -5px 0px #fbbf24,
                    4px -3px #fbbf24, 5px -4px #fbbf24, 6px -4px #fbbf24, 7px -3px #fbbf24, 8px -2px #fbbf24,
                    3px -2px #fbbf24, 4px -2px #1e293b, 5px -3px #334155, 6px -3px #334155, 7px -2px #1e293b,
                    3px -1px #0f172a, 4px -1px #1e293b, 5px -2px #1e293b, 6px -2px #0f172a, 7px -1px #fbbf24,
                    3px 0px #0f172a, 4px 0px #1e293b, 5px -1px #0f172a, 6px -1px #fbbf24,
                    3px 1px #fbbf24, 4px 1px #fbbf24, 5px 0px #fbbf24;
                }
                50% {
                  box-shadow:
                    -2px -4px #fbbf24, 2px -4px #fbbf24,
                    -3px -3px #fbbf24, -1px -3px #fbbf24, 0px -3px #fbbf24, 1px -3px #fbbf24, 3px -3px #fbbf24,
                    -2px -3px #0f172a, 2px -3px #0f172a,
                    -2px -2px #0f172a, -1px -2px #1e293b, 0px -2px #1e293b, 1px -2px #1e293b, 2px -2px #0f172a,
                    -2px -1px #0f172a, -1px -1px #fbbf24, 0px -1px #0f172a, 1px -1px #fbbf24, 2px -1px #0f172a,
                    -1px 0px #1e293b, 0px 0px #334155, 1px 0px #1e293b,
                    -1px 1px #0f172a, 0px 1px #1e293b, 1px 1px #0f172a,
                    -1px 2px #fbbf24, 0px 2px #0f172a, 1px 2px #fbbf24,
                    0px 3px #fbbf24,
                    -3px -1px #fbbf24, -4px 0px #fbbf24, -5px 1px #fbbf24, -6px 2px #fbbf24, -7px 2px #fbbf24, -8px 3px #fbbf24,
                    -3px 0px #1e293b, -4px 1px #334155, -5px 2px #334155, -6px 3px #1e293b, -7px 3px #0f172a,
                    -3px 1px #0f172a, -4px 2px #1e293b, -5px 3px #0f172a, -6px 4px #fbbf24, -7px 4px #fbbf24,
                    -2px 2px #fbbf24, -3px 2px #fbbf24, -4px 3px #fbbf24, -5px 4px #fbbf24,
                    3px -1px #fbbf24, 4px 0px #fbbf24, 5px 1px #fbbf24, 6px 2px #fbbf24, 7px 2px #fbbf24, 8px 3px #fbbf24,
                    3px 0px #1e293b, 4px 1px #334155, 5px 2px #334155, 6px 3px #1e293b, 7px 3px #0f172a,
                    3px 1px #0f172a, 4px 2px #1e293b, 5px 3px #0f172a, 6px 4px #fbbf24, 7px 4px #fbbf24,
                    2px 2px #fbbf24, 3px 2px #fbbf24, 4px 3px #fbbf24, 5px 4px #fbbf24;
                }
              }

              .dark-ripple-core {
                position: fixed;
                left: 50vw;
                top: 50vh;
                width: 20px;
                height: 20px;
                margin-left: -10px;
                margin-top: -10px;
                border-radius: 9999px;
                background: radial-gradient(
                  circle,
                  #020617 0%,
                  #020617 74%,
                  #090d16 92%,
                  rgba(2, 6, 23, 0.97) 100%
                );
                transform: scale(0);
                will-change: transform;
                animation: darkWaterSpread 0.9s cubic-bezier(0.32, 0, 0.2, 1) 2.1s forwards;
              }

              .dark-ripple-ring-1 {
                position: fixed;
                left: 50vw;
                top: 50vh;
                width: 24px;
                height: 24px;
                margin-left: -12px;
                margin-top: -12px;
                border-radius: 9999px;
                border: 1.5px solid rgba(15, 23, 42, 0.8);
                box-shadow: 0 0 20px rgba(2, 6, 23, 0.7);
                transform: scale(0);
                opacity: 0;
                will-change: transform, opacity;
                animation: waterRingExpand 0.92s cubic-bezier(0.22, 1, 0.36, 1) 2.08s forwards;
              }

              .dark-ripple-ring-2 {
                position: fixed;
                left: 50vw;
                top: 50vh;
                width: 24px;
                height: 24px;
                margin-left: -12px;
                margin-top: -12px;
                border-radius: 9999px;
                border: 1px solid rgba(30, 41, 59, 0.6);
                transform: scale(0);
                opacity: 0;
                will-change: transform, opacity;
                animation: waterRingExpand 0.94s cubic-bezier(0.22, 1, 0.36, 1) 2.16s forwards;
              }

              @keyframes darkWaterSpread {
                0% {
                  transform: scale(0);
                }
                100% {
                  transform: scale(155);
                }
              }

              @keyframes waterRingExpand {
                0% {
                  transform: scale(0.2);
                  opacity: 0.95;
                }
                72% {
                  opacity: 0.55;
                }
                100% {
                  transform: scale(145);
                  opacity: 0;
                }
              }
            `}</style>

            <div className="dark-ripple-ring-1" />
            <div className="dark-ripple-ring-2" />
            <div className="dark-ripple-core" />

            <div className="bat-orbit-wrapper">
              <div className="bat-orbit-sprite" />
            </div>
          </div>,
          document.body
        )
      : null

  if (variant === 'header') {
    return (
      <>
        {cinematicOverlay}
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
            0%,
            100% {
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
          ref={triggerRef}
          type="button"
          onClick={handleToggleUnit}
          title={
            isSmkMode
              ? 'Kembali ke Portal SMP Muna Mustofa'
              : 'Buka Portal SMK Muna Mustofa (DKV)'
          }
          className={`px-2 py-1 rounded-lg border text-[10px] font-black flex items-center gap-1 transition active:scale-95 cursor-pointer shadow-xs shrink-0 ${
            isTransitioning ? 'opacity-0 pointer-events-none' : ''
          } ${
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

  return (
    <>
      {cinematicOverlay}
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
          0%,
          100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-5px);
          }
        }

        @keyframes highContrastFlap {
          0%,
          100% {
            box-shadow:
              -2px -4px #fbbf24, 2px -4px #fbbf24,
              -3px -3px #fbbf24, -1px -3px #fbbf24, 0px -3px #fbbf24, 1px -3px #fbbf24, 3px -3px #fbbf24,
              -2px -3px #0f172a, 2px -3px #0f172a,
              -2px -2px #0f172a, -1px -2px #1e293b, 0px -2px #1e293b, 1px -2px #1e293b, 2px -2px #0f172a,
              -2px -1px #0f172a, -1px -1px #f43f5e, 0px -1px #0f172a, 1px -1px #f43f5e, 2px -1px #0f172a,
              -1px 0px #1e293b, 0px 0px #334155, 1px 0px #1e293b,
              -1px 1px #0f172a, 0px 1px #1e293b, 1px 1px #0f172a,
              -2px 1px #fbbf24, 2px 1px #fbbf24,
              -1px 2px #fbbf24, 0px 2px #0f172a, 1px 2px #fbbf24,
              0px 3px #fbbf24,
              -4px -3px #fbbf24, -5px -4px #fbbf24, -6px -4px #fbbf24, -7px -3px #fbbf24, -8px -2px #fbbf24,
              -3px -2px #fbbf24, -4px -2px #1e293b, -5px -3px #334155, -6px -3px #334155, -7px -2px #1e293b,
              -3px -1px #0f172a, -4px -1px #1e293b, -5px -2px #1e293b, -6px -2px #0f172a, -7px -1px #fbbf24,
              -3px 0px #0f172a, -4px 0px #1e293b, -5px -1px #0f172a, -6px -1px #fbbf24,
              -3px 1px #fbbf24, -4px 1px #fbbf24, -5px 0px #fbbf24,
              4px -3px #fbbf24, 5px -4px #fbbf24, 6px -4px #fbbf24, 7px -3px #fbbf24, 8px -2px #fbbf24,
              3px -2px #fbbf24, 4px -2px #1e293b, 5px -3px #334155, 6px -3px #334155, 7px -2px #1e293b,
              3px -1px #0f172a, 4px -1px #1e293b, 5px -2px #1e293b, 6px -2px #0f172a, 7px -1px #fbbf24,
              3px 0px #0f172a, 4px 0px #1e293b, 5px -1px #0f172a, 6px -1px #fbbf24,
              3px 1px #fbbf24, 4px 1px #fbbf24, 5px 0px #fbbf24;
          }

          50% {
            box-shadow:
              -2px -4px #fbbf24, 2px -4px #fbbf24,
              -3px -3px #fbbf24, -1px -3px #fbbf24, 0px -3px #fbbf24, 1px -3px #fbbf24, 3px -3px #fbbf24,
              -2px -3px #0f172a, 2px -3px #0f172a,
              -2px -2px #0f172a, -1px -2px #1e293b, 0px -2px #1e293b, 1px -2px #1e293b, 2px -2px #0f172a,
              -2px -1px #0f172a, -1px -1px #fbbf24, 0px -1px #0f172a, 1px -1px #fbbf24, 2px -1px #0f172a,
              -1px 0px #1e293b, 0px 0px #334155, 1px 0px #1e293b,
              -1px 1px #0f172a, 0px 1px #1e293b, 1px 1px #0f172a,
              -1px 2px #fbbf24, 0px 2px #0f172a, 1px 2px #fbbf24,
              0px 3px #fbbf24,
              -3px -1px #fbbf24, -4px 0px #fbbf24, -5px 1px #fbbf24, -6px 2px #fbbf24, -7px 2px #fbbf24, -8px 3px #fbbf24,
              -3px 0px #1e293b, -4px 1px #334155, -5px 2px #334155, -6px 3px #1e293b, -7px 3px #0f172a,
              -3px 1px #0f172a, -4px 2px #1e293b, -5px 3px #0f172a, -6px 4px #fbbf24, -7px 4px #fbbf24,
              -2px 2px #fbbf24, -3px 2px #fbbf24, -4px 3px #fbbf24, -5px 4px #fbbf24,
              3px -1px #fbbf24, 4px 0px #fbbf24, 5px 1px #fbbf24, 6px 2px #fbbf24, 7px 2px #fbbf24, 8px 3px #fbbf24,
              3px 0px #1e293b, 4px 1px #334155, 5px 2px #334155, 6px 3px #1e293b, 7px 3px #0f172a,
              3px 1px #0f172a, 4px 2px #1e293b, 5px 3px #0f172a, 6px 4px #fbbf24, 7px 4px #fbbf24,
              2px 2px #fbbf24, 3px 2px #fbbf24, 4px 3px #fbbf24, 5px 4px #fbbf24;
          }
        }
      `}</style>

      <button
        ref={triggerRef}
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
        className={`fixed bottom-20 left-3 sm:left-5 z-50 flex flex-col items-center group cursor-pointer select-none focus:outline-none transition-opacity duration-150 ${
          isTransitioning
            ? 'opacity-0 pointer-events-none'
            : 'hover:scale-110 active:scale-95 transition-transform duration-300'
        }`}
      >
        <div className="coin-bat-stage drop-shadow-[0_6px_10px_rgba(0,0,0,0.45)]">
          <div className="coin-pixel-bat" />
        </div>

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