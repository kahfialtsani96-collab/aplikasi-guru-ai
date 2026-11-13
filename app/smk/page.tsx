'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import PixelBatSwitcher from '@/app/components/PixelBatSwitcher'
import {
  Users,
  BookOpen,
  CalendarCheck,
  FileSpreadsheet,
  NotebookPen,
  HeartHandshake,
  Sparkles,
  Printer,
  LogOut,
  Layers,
  GraduationCap,
  School,
  Hand,
  ChevronRight,
  Database,
} from 'lucide-react'

type LampColorKey = 'white' | 'green' | 'red' | 'cyan' | 'amber'

const LAMP_CONFIG: Record<
  LampColorKey,
  {
    label: string
    dotClass: string
    hex: string
    rgb: string
    textClass: string
    badgeBg: string
  }
> = {
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

export default function SmkDashboardPage() {
  const router = useRouter()

  // State Lampu Gantung Interaktif (Selalu mulai MATI setiap kali masuk dashboard SMK)
  const [isLampOn, setIsLampOn] = useState(false)
  const [isPulling, setIsPulling] = useState(false)
  const [activeColor, setActiveColor] = useState<LampColorKey>('green')

  // State Profil Guru, Peran Operator & Statistik SMK
  const [loading, setLoading] = useState(true)
  const [isOperator, setIsOperator] = useState(false)
  const [userProfile, setUserProfile] = useState<{
    nama: string
    nuptk: string
    role: string
  }>({
    nama: 'Guru SMK Muna Mustofa',
    nuptk: '-',
    role: 'GURU',
  })

  const [stats, setStats] = useState({
    totalSiswaSmk: 0,
    totalKelasSmk: 0,
    totalMapelSmk: 0,
    absensiHariIni: 0,
  })

  const theme = LAMP_CONFIG[activeColor]

  // Pastikan lampu selalu mati saat pertama masuk & otomatis dimatikan saat keluar halaman
  useEffect(() => {
    setIsLampOn(false)
    sessionStorage.removeItem('smk_lamp_on')

    const savedCol = sessionStorage.getItem('smk_lamp_color') as LampColorKey | null
    if (savedCol && LAMP_CONFIG[savedCol]) setActiveColor(savedCol)

    return () => {
      // Cleanup saat berpindah ke SMP atau halaman lain: matikan lampu
      setIsLampOn(false)
      sessionStorage.removeItem('smk_lamp_on')
    }
  }, [])

  // Autentikasi & Ambil Data Khusus SMK Muna Mustofa (DKV)
  useEffect(() => {
    let isMounted = true

    const loadSmkData = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession()

        if (!session) {
          router.replace('/login')
          return
        }

        const cleanEmail = (session.user.email || '').trim().toLowerCase()

        const { data: guruData } = await supabase
          .from('guru')
          .select('nama_lengkap, NUPTK, role')
          .ilike('email', cleanEmail)
          .maybeSingle()

        if (isMounted && guruData) {
          const roleUpper = (guruData.role || 'GURU').toUpperCase()
          setIsOperator(roleUpper === 'OPERATOR')
          setUserProfile({
            nama: guruData.nama_lengkap || session.user.email?.split('@')[0] || 'Guru SMK',
            nuptk: guruData.NUPTK || '-',
            role: roleUpper,
          })
        }

        const today = new Date().toISOString().split('T')[0]

        const [siswaRes, kelasRes, mapelRes, absensiRes] = await Promise.all([
          supabase.from('siswa').select('id', { count: 'exact', head: true }).eq('jenjang', 'SMK'),
          supabase.from('kelas').select('id', { count: 'exact', head: true }).eq('jenjang', 'SMK'),
          supabase.from('mapel').select('id', { count: 'exact', head: true }).eq('jenjang', 'SMK'),
          supabase
            .from('absensi')
            .select('id', { count: 'exact', head: true })
            .eq('jenjang', 'SMK')
            .eq('tanggal', today),
        ])

        if (isMounted) {
          setStats({
            totalSiswaSmk: siswaRes.count || 0,
            totalKelasSmk: kelasRes.count || 0,
            totalMapelSmk: mapelRes.count || 0,
            absensiHariIni: absensiRes.count || 0,
          })
        }
      } catch (err) {
        console.error('Error memuat data SMK:', err)
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    loadSmkData()

    return () => {
      isMounted = false
    }
  }, [router])

  // Tarik Tali Sakelar dengan Pantulan Elastis
  const handlePullCord = () => {
    if (isPulling) return
    setIsPulling(true)
    setTimeout(() => {
      setIsLampOn((prev) => !prev)
    }, 140)
    setTimeout(() => {
      setIsPulling(false)
    }, 360)
  }

  // Pilih Titik Warna Cahaya (Hanya aktif saat lampu hidup)
  const handlePickColor = (color: LampColorKey) => {
    if (!isLampOn) return
    setActiveColor(color)
    sessionStorage.setItem('smk_lamp_color', color)
  }

  // Logout: matikan lampu terlebih dahulu sebelum keluar sesi
  const handleLogout = async () => {
    setIsLampOn(false)
    sessionStorage.removeItem('smk_lamp_on')
    await supabase.auth.signOut()
    router.replace('/login')
  }

  const menuSmk = [
    ...(isOperator
      ? [
          {
            title: 'Master Data SMK',
            sub: 'Kelas, Siswa, Mapel & Guru',
            href: '/smk/master',
            icon: Database,
          },
        ]
      : []),
    {
      title: 'Absensi DKV',
      sub: 'Presensi harian siswa SMK',
      href: '/smk/absensi',
      icon: CalendarCheck,
    },
    {
      title: 'Penilaian Kejuruan',
      sub: 'Nilai teori & praktik DKV',
      href: '/smk/nilai',
      icon: FileSpreadsheet,
    },
    {
      title: 'Jurnal Mengajar',
      sub: 'Catatan KBM & studio DKV',
      href: '/smk/jurnal',
      icon: NotebookPen,
    },
    {
      title: 'Jadwal Pelajaran',
      sub: 'Jadwal Fase E & Fase F',
      href: '/smk/jadwal',
      icon: Layers,
    },
    {
      title: 'Bimbingan Wali',
      sub: 'Catatan pembinaan siswa',
      href: '/smk/bimbingan',
      icon: HeartHandshake,
    },
    {
      title: 'AI Tools SMK (DKV)',
      sub: 'Modul ajar & soal Fase E/F',
      href: '/smk/ai',
      icon: Sparkles,
    },
    {
      title: 'Laporan & Cetak',
      sub: 'Rekap nilai & kop SMK',
      href: '/smk/laporan',
      icon: Printer,
    },
  ]

  return (
    <div className="h-dvh max-h-dvh overflow-hidden bg-[#090b10] text-slate-100 relative flex flex-col selection:bg-emerald-500/30">
      {/* Custom Scrollbar tipis untuk area scroll di dalam kolom */}
      <style jsx global>{`
        .inner-column-scroll::-webkit-scrollbar {
          width: 4px;
        }
        .inner-column-scroll::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.02);
          border-radius: 9999px;
        }
        .inner-column-scroll::-webkit-scrollbar-thumb {
          background: rgba(148, 163, 184, 0.25);
          border-radius: 9999px;
        }
        .inner-column-scroll::-webkit-scrollbar-thumb:hover {
          background: rgba(148, 163, 184, 0.45);
        }
      `}</style>

      {/* =====================================================================
          1. BARIS ATAS TERKUNCI: IDENTITAS UNIT & 5 TITIK WARNA (MUNCUL SAAT LAMPU HIDUP)
         ===================================================================== */}
      <header className="relative z-30 shrink-0 w-full max-w-3xl mx-auto px-3.5 pt-2.5 pb-1 min-h-[42px] flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span
            className="w-2 h-2 rounded-full transition-colors duration-300"
            style={{ backgroundColor: isLampOn ? theme.hex : '#334155' }}
          />
          <span
            className={`text-[11px] font-bold tracking-wide transition-opacity duration-500 ${
              isLampOn ? 'opacity-95 text-slate-200' : 'opacity-40 text-slate-500'
            }`}
          >
            SMK Muna Mustofa • DKV
          </span>
        </div>

        {/* 5 Titik Warna Cahaya Studio — Hanya muncul jika lampu hidup */}
        <div
          className={`flex items-center gap-2 bg-[#121622]/90 border border-white/10 px-2.5 py-1.5 rounded-full shadow-lg backdrop-blur-md transition-all duration-500 ${
            isLampOn
              ? 'opacity-100 scale-100 translate-y-0 pointer-events-auto'
              : 'opacity-0 scale-90 -translate-y-2 pointer-events-none'
          }`}
        >
          {(Object.keys(LAMP_CONFIG) as LampColorKey[]).map((key) => {
            const isSelected = activeColor === key
            return (
              <button
                key={key}
                type="button"
                onClick={() => handlePickColor(key)}
                title={LAMP_CONFIG[key].label}
                aria-label={LAMP_CONFIG[key].label}
                className={`w-3 h-3 sm:w-3.5 sm:h-3.5 rounded-full transition-all duration-200 cursor-pointer ${
                  LAMP_CONFIG[key].dotClass
                } ${
                  isSelected
                    ? 'scale-125 ring-2 ring-offset-2 ring-offset-[#121622] ring-white'
                    : 'opacity-70 hover:opacity-100 hover:scale-110'
                }`}
              />
            )
          })}
        </div>
      </header>

      {/* =====================================================================
          2. LAMPU GANTUNG ATAS TERKUNCI (TALI SAKELAR TEPAT DI TENGAH LAMPU)
         ===================================================================== */}
      <section className="relative z-20 shrink-0 w-full max-w-3xl mx-auto px-3 flex flex-col items-center select-none">
        <div className="relative w-full max-w-[340px] h-[142px] sm:h-[155px] flex items-start justify-center">
          <svg
            viewBox="0 0 360 165"
            className="w-full h-full overflow-visible"
            aria-label="Lampu Gantung Interaktif SMK"
          >
            <defs>
              <linearGradient id="pendantMetal" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#141821" />
                <stop offset="35%" stopColor="#3c4457" />
                <stop offset="70%" stopColor="#1e2330" />
                <stop offset="100%" stopColor="#0f1219" />
              </linearGradient>

              <linearGradient id="overheadBeam" x1="50%" y1="0%" x2="50%" y2="100%">
                <stop offset="0%" stopColor={theme.hex} stopOpacity="0.46" />
                <stop offset="55%" stopColor={theme.hex} stopOpacity="0.14" />
                <stop offset="100%" stopColor={theme.hex} stopOpacity="0" />
              </linearGradient>
            </defs>

            {/* SOROTAN CAHAYA MELEBAR KE BAWAH */}
            <polygon
              points="132,74 228,74 385,380 -25,380"
              fill="url(#overheadBeam)"
              className="transition-opacity duration-500 pointer-events-none"
              style={{ opacity: isLampOn ? 1 : 0 }}
            />

            {/* KABEL GANTUNG DARI PLAFON ATAS (TENGAH x=180) */}
            <line x1="180" y1="-20" x2="180" y2="26" stroke="#2c3344" strokeWidth="3" />
            <rect
              x="171"
              y="22"
              width="18"
              height="12"
              rx="3"
              fill="#2d3446"
              stroke="#475569"
              strokeWidth="1"
            />

            {/* BOHLAM MENYALA DI TENGAH MULUT KAP */}
            <ellipse
              cx="180"
              cy="74"
              rx="46"
              ry="10"
              fill={isLampOn ? theme.hex : '#131620'}
              className="transition-colors duration-300"
            />
            {isLampOn && (
              <ellipse cx="180" cy="73" rx="22" ry="5.5" fill="#ffffff" opacity="0.92" />
            )}

            {/* KAP LAMPU GANTUNG KUBAH STUDIO */}
            <path
              d="M130 74 C130 32, 230 32, 230 74 Z"
              fill="url(#pendantMetal)"
              stroke="#3f475c"
              strokeWidth="1.5"
            />
            {/* Kilau Logam Kap */}
            <path
              d="M150 62 C153 43, 168 38, 180 40"
              stroke="#717f9e"
              strokeWidth="2.2"
              strokeLinecap="round"
              fill="none"
              opacity="0.55"
            />
            {/* Bibir Kap */}
            <rect x="128" y="71" width="104" height="5" rx="2.5" fill="#32394b" />

            {/* TALI SAKELAR TARIK TEPAT DI TENGAH LAMPU (x = 180) */}
            <g
              onClick={handlePullCord}
              className="cursor-pointer"
              role="button"
              tabIndex={0}
              aria-label="Tarik tali sakelar lampu"
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') handlePullCord()
              }}
            >
              {/* Hitbox Sentuh Lebar di Tengah untuk Jempol di HP */}
              <rect x="150" y="65" width="60" height="95" fill="transparent" />

              {/* Tali Vertikal Lurus di Tengah (x=180) */}
              <line
                x1="180"
                y1="74"
                x2="180"
                y2={isPulling ? '144' : '118'}
                stroke="#cbd5e1"
                strokeWidth="2.2"
                style={{
                  transition: 'all 260ms cubic-bezier(0.34, 1.56, 0.64, 1)',
                }}
              />

              {/* Bandul Ujung Tali di Tengah (x=180) */}
              <g
                transform={`translate(180, ${isPulling ? 150 : 124})`}
                style={{
                  transition: 'transform 260ms cubic-bezier(0.34, 1.56, 0.64, 1)',
                }}
              >
                {!isLampOn && (
                  <circle
                    cx="0"
                    cy="0"
                    r="13"
                    fill={theme.hex}
                    opacity="0.28"
                    className="animate-ping"
                  />
                )}
                <circle
                  cx="0"
                  cy="0"
                  r="6"
                  fill={isLampOn ? theme.hex : '#f8fafc'}
                  stroke="#0f172a"
                  strokeWidth="1.5"
                />
              </g>
            </g>
          </svg>

          {/* Tombol Petunjuk di Sebelah Kanan Tali Tengah */}
          <button
            type="button"
            onClick={handlePullCord}
            className={`absolute left-[54%] top-[96px] sm:top-[104px] flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold transition-all duration-300 cursor-pointer ${
              isLampOn
                ? 'bg-white/5 text-slate-400 hover:text-white border border-white/10'
                : 'bg-white/15 text-white border border-white/25 shadow-lg animate-pulse'
            }`}
          >
            <Hand className="w-3 h-3 text-amber-300 -rotate-12" />
            <span>{isLampOn ? 'Matikan' : 'Tarik tali'}</span>
          </button>
        </div>
      </section>

      {/* =====================================================================
          3. KOLOM LUAR TERKUNCI + KOLOM DALAM BISA DI-SCROLL (INNER SCROLL)
         ===================================================================== */}
      <main className="relative z-20 flex-1 min-h-0 w-full max-w-3xl mx-auto px-3 pb-3 flex flex-col">
        {/* KARTU / KOLOM UTAMA YANG TERKUNCI DI LAYAR */}
        <div
          className={`flex-1 min-h-0 rounded-2xl bg-[#10141f]/90 backdrop-blur-md p-3.5 sm:p-4 flex flex-col transition-all duration-700 ${
            isLampOn
              ? 'opacity-100 brightness-100 scale-100 pointer-events-auto'
              : 'opacity-[0.04] brightness-50 scale-[0.98] pointer-events-none select-none'
          }`}
          style={{
            border: isLampOn
              ? `1px solid rgba(${theme.rgb}, 0.45)`
              : '1px solid rgba(255, 255, 255, 0.04)',
            boxShadow: isLampOn
              ? `0 -8px 40px -12px rgba(${theme.rgb}, 0.3), inset 0 1px 0 rgba(255,255,255,0.1)`
              : 'none',
          }}
        >
          {/* BAGIAN ATAS KARTU (DIAM / TIDAK IKUT SCROLL): Identitas & Statistik */}
          <div className="shrink-0">
            <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-white/10">
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${theme.badgeBg}`}
                  style={{ borderColor: `rgba(${theme.rgb}, 0.4)` }}
                >
                  <School className={`w-4 h-4 ${theme.textClass}`} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h1 className="text-xs sm:text-sm font-black tracking-tight text-white truncate">
                      SMK MUNA MUSTOFA
                    </h1>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[9px] font-extrabold shrink-0 ${theme.badgeBg} ${theme.textClass}`}
                      style={{ border: `1px solid rgba(${theme.rgb}, 0.4)` }}
                    >
                      DKV
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-300 truncate mt-0.5">
                    {userProfile.nama} •{' '}
                    <span className="text-slate-400">NUPTK: {userProfile.nuptk}</span>
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleLogout}
                title="Keluar Aplikasi"
                className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 transition cursor-pointer shrink-0"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Statistik 4 Kolom Mendatar */}
            <div className="grid grid-cols-4 gap-1.5 sm:gap-2.5 my-2.5">
              <div className="rounded-xl bg-white/[0.03] border border-white/10 p-2 text-center">
                <Users className={`w-3.5 h-3.5 mx-auto mb-0.5 ${theme.textClass}`} />
                <p className="text-sm sm:text-base font-black text-white leading-tight">
                  {loading ? '-' : stats.totalSiswaSmk}
                </p>
                <p className="text-[9px] text-slate-400 truncate">Siswa</p>
              </div>

              <div className="rounded-xl bg-white/[0.03] border border-white/10 p-2 text-center">
                <GraduationCap className={`w-3.5 h-3.5 mx-auto mb-0.5 ${theme.textClass}`} />
                <p className="text-sm sm:text-base font-black text-white leading-tight">
                  {loading ? '-' : stats.totalKelasSmk}
                </p>
                <p className="text-[9px] text-slate-400 truncate">Kelas</p>
              </div>

              <div className="rounded-xl bg-white/[0.03] border border-white/10 p-2 text-center">
                <BookOpen className={`w-3.5 h-3.5 mx-auto mb-0.5 ${theme.textClass}`} />
                <p className="text-sm sm:text-base font-black text-white leading-tight">
                  {loading ? '-' : stats.totalMapelSmk}
                </p>
                <p className="text-[9px] text-slate-400 truncate">Mapel</p>
              </div>

              <div className="rounded-xl bg-white/[0.03] border border-white/10 p-2 text-center">
                <CalendarCheck className={`w-3.5 h-3.5 mx-auto mb-0.5 ${theme.textClass}`} />
                <p className="text-sm sm:text-base font-black text-white leading-tight">
                  {loading ? '-' : stats.absensiHariIni}
                </p>
                <p className="text-[9px] text-slate-400 truncate">Absen</p>
              </div>
            </div>

            <div className="flex items-center justify-between px-0.5 mb-2">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                Modul Administrasi &amp; Studio DKV
              </span>
              <span className="text-[9px] text-slate-500">Geser ke bawah ↓</span>
            </div>
          </div>

          {/* KOLOM DALAM YANG BISA DI-SCROLL (INNER SCROLLABLE CONTAINER) */}
          <div className="flex-1 min-h-0 overflow-y-auto inner-column-scroll rounded-xl bg-black/25 border border-white/5 p-2 pb-24">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {menuSmk.map((item) => {
                const Icon = item.icon
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="group rounded-xl bg-white/[0.04] hover:bg-white/[0.09] active:scale-[0.98] border border-white/10 p-2.5 flex items-center justify-between gap-2 transition"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-transform group-hover:scale-105 ${theme.badgeBg}`}
                      >
                        <Icon className={`w-4 h-4 ${theme.textClass}`} />
                      </div>
                      <div className="min-w-0">
                        <h2 className="text-[11px] font-bold text-slate-100 leading-tight truncate">
                          {item.title}
                        </h2>
                        <p className="text-[9px] text-slate-400 leading-tight truncate mt-0.5">
                          {item.sub}
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-white shrink-0" />
                  </Link>
                )
              })}
            </div>
          </div>
        </div>
      </main>

      {/* Kelelawar Piksel Ukuran Koin di Pojok Kiri Bawah untuk Kembali ke SMP */}
      <PixelBatSwitcher isDarkMode={true} variant="floating" />
    </div>
  )
}