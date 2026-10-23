'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { motion } from 'framer-motion'
import { useAuthRole } from '@/hooks/useAuthRole'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const supabase = createClient(supabaseUrl, supabaseAnonKey)

export default function DashboardPage() {
  const router = useRouter()
  const [userDisplayName, setUserDisplayName] = useState('GURU')
  
  const { isOperator, canAccessBimbingan } = useAuthRole()
  
  const [totalSiswa, setTotalSiswa] = useState<number>(0)
  const [totalKelas, setTotalKelas] = useState<number>(0)
  const [totalGuru, setTotalGuru] = useState<number>(0)
  
  const [persentaseHadir, setPersentaseHadir] = useState<string>('Belum Diisi')
  const [isLoading, setIsLoading] = useState<boolean>(true)

  // STATE DARK MODE
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false)

  // 1. BACA TEMA TERAKHIR SAAT DASHBOARD DIMUAT
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme')
    if (savedTheme === 'dark') {
      setIsDarkMode(true)
    }
  }, [])

  // 2. LOGIKA ANIMASI CIRCULAR REVEAL DARK MODE + PERSISTENSI STORAGE
  const toggleDarkMode = (event: React.MouseEvent<HTMLButtonElement>) => {
    const nextState = !isDarkMode

    // Simpan pilihan tema ke localStorage agar dibaca oleh halaman lain (seperti /absensi, /nilai, dll)
    localStorage.setItem('theme', nextState ? 'dark' : 'light')

    // Fallback jika browser tidak mendukung View Transitions API
    if (!document.startViewTransition) {
      setIsDarkMode(nextState)
      return
    }

    const x = event.clientX
    const y = event.clientY

    // Hitung jarak terjauh ke sudut layar
    const endRadius = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y)
    )

    const transition = document.startViewTransition(() => {
      setIsDarkMode(nextState)
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
  }

  useEffect(() => {
    async function fetchDataFromSupabase() {
      setIsLoading(true)

      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        router.replace('/login')
        return
      }

      const user = session.user
      if (user) {
        const nameFromMeta = user.user_metadata?.full_name || user.email?.split('@')[0] || 'GURU'
        setUserDisplayName(nameFromMeta.toUpperCase())
      }

      const todayStr = new Date().toISOString().split('T')[0]

      const [resSiswa, resKelas, resGuru, resAbsensi] = await Promise.all([
        supabase.from('siswa').select('*', { count: 'exact', head: true }),
        supabase.from('kelas').select('*', { count: 'exact', head: true }),
        supabase.from('guru').select('*', { count: 'exact', head: true }),
        supabase.from('absensi').select('status').eq('tanggal', todayStr)
      ])

      if (resSiswa.count !== null) setTotalSiswa(resSiswa.count)
      if (resKelas.count !== null) setTotalKelas(resKelas.count)
      if (resGuru.count !== null) setTotalGuru(resGuru.count)

      if (resAbsensi.data && resAbsensi.data.length > 0) {
        const jumlahHadir = resAbsensi.data.filter(
          a => a.status?.toUpperCase() === 'HADIR'
        ).length
        const totalAbsen = resAbsensi.data.length
        const persen = Math.round((jumlahHadir / totalAbsen) * 100)
        setPersentaseHadir(`${persen}%`)
      } else {
        setPersentaseHadir('Belum Diisi')
      }

      setIsLoading(false)
    }

    fetchDataFromSupabase()
  }, [router])

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className={`min-h-screen font-sans flex flex-col justify-between selection:bg-indigo-500 selection:text-white pb-32 relative overflow-x-hidden transition-colors duration-300 ${
        isDarkMode ? 'bg-slate-950 text-slate-100' : 'bg-[#E2E8F0] text-slate-800'
      }`}
    >
      <div className={`fixed inset-0 pointer-events-none z-0 flex items-center justify-center select-none transition-opacity duration-300 ${
        isDarkMode ? 'opacity-[0.05]' : 'opacity-[0.15]'
      }`}>
        <img
          src="/logo-smp.jpg"
          alt="Watermark SMP Muna Mustofa"
          className="w-[850px] h-[850px] object-contain max-w-none"
        />
      </div>

      <div className="relative z-10">
        <header className={`border-b px-3 sm:px-6 py-2.5 flex items-center justify-between sticky top-0 z-50 shadow-xs gap-2 transition-colors duration-300 ${
          isDarkMode ? 'bg-slate-900/90 border-slate-800 backdrop-blur-md' : 'bg-slate-100/90 border-slate-300 backdrop-blur-md'
        }`}>
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-xl overflow-hidden flex items-center justify-center border p-0.5 shadow-xs shrink-0 ${
              isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-300'
            }`}>
              <img
                src="/logo-smp.jpg"
                alt="Logo SMP Muna Mustofa"
                className="w-full h-full object-contain"
              />
            </div>
            <div>
              <h1 className={`font-bold text-xs sm:text-base leading-none ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Aplikasi Guru AI</h1>
              <p className={`text-[10px] sm:text-[11px] font-bold mt-0.5 sm:mt-1 ${isDarkMode ? 'text-emerald-400' : 'text-emerald-800'}`}>SMP Muna Mustofa</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-3">
            {/* TOMBOL TOGGLE DARK MODE / LIGHT MODE */}
            <button
              onClick={toggleDarkMode}
              className={`p-1.5 sm:p-2 rounded-xl border transition cursor-pointer flex items-center justify-center ${
                isDarkMode 
                  ? 'bg-amber-400/10 border-amber-400/30 text-amber-400 hover:bg-amber-400/20' 
                  : 'bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100'
              }`}
              title={isDarkMode ? 'Beralih ke Mode Terang' : 'Beralih ke Mode Gelap'}
            >
              <span className="text-sm sm:text-base">{isDarkMode ? '☀️' : '🌙'}</span>
            </button>

            <div className={`hidden md:flex border text-xs font-semibold px-3 py-1.5 rounded-full items-center gap-2 ${
              isDarkMode 
                ? 'bg-emerald-950/60 border-emerald-800 text-emerald-300' 
                : 'bg-emerald-100/80 border-emerald-300 text-emerald-800'
            }`}>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>Supabase Live</span>
            </div>

            <div className={`border text-xs font-bold px-2 sm:px-3.5 py-1 sm:py-1.5 rounded-xl flex items-center gap-1.5 shadow-xs ${
              isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-100' : 'bg-white border-slate-300 text-slate-800'
            }`}>
              <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px] font-bold shrink-0">
                {userDisplayName.charAt(0)}
              </span>
              <span className="max-w-[70px] sm:max-w-none truncate">{userDisplayName}</span>
              <span className={`hidden sm:inline-block text-[10px] px-2 py-0.5 rounded-md font-extrabold uppercase ml-1 border ${
                isDarkMode ? 'bg-indigo-950 text-indigo-300 border-indigo-800' : 'bg-indigo-100 text-indigo-800 border-indigo-200'
              }`}>
                {isOperator ? 'Operator' : 'Guru'}
              </span>
            </div>

            <button
              onClick={async () => {
                await supabase.auth.signOut()
                router.replace('/login')
              }}
              className={`border p-1.5 sm:p-2 rounded-xl transition cursor-pointer shrink-0 ${
                isDarkMode 
                  ? 'bg-rose-950/50 border-rose-800 text-rose-400 hover:bg-rose-900/60' 
                  : 'bg-rose-100 border-rose-300 text-rose-700 hover:bg-rose-200'
              }`}
              title="Keluar"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </header>

        <main className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6 sm:space-y-8">

          {/* STATISTIK TOP */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className={`backdrop-blur-md border rounded-2xl p-4 sm:p-5 flex items-center gap-3 sm:gap-4 shadow-sm hover:shadow-md transition ${
              isDarkMode 
                ? 'bg-gradient-to-br from-indigo-950/40 via-slate-900/60 to-indigo-900/20 border-indigo-800/60' 
                : 'bg-gradient-to-br from-[#dbe2fe]/90 via-[#e0e7ff]/90 to-[#eef2ff]/90 border-indigo-200/80'
            }`}>
              <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-2xl border flex items-center justify-center text-lg sm:text-xl shrink-0 shadow-xs ${
                isDarkMode ? 'bg-slate-800 border-indigo-800 text-indigo-400' : 'bg-white/80 border-indigo-200 text-indigo-600'
              }`}>
                👥
              </div>
              <div>
                <p className={`text-[10px] sm:text-[11px] font-bold uppercase tracking-wider ${isDarkMode ? 'text-indigo-300' : 'text-indigo-900/70'}`}>Total Siswa</p>
                <p className={`text-xl sm:text-2xl font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{isLoading ? '...' : totalSiswa}</p>
              </div>
            </div>

            <div className={`backdrop-blur-md border rounded-2xl p-4 sm:p-5 flex items-center gap-3 sm:gap-4 shadow-sm hover:shadow-md transition ${
              isDarkMode 
                ? 'bg-gradient-to-br from-indigo-950/40 via-slate-900/60 to-indigo-900/20 border-indigo-800/60' 
                : 'bg-gradient-to-br from-[#dbe2fe]/90 via-[#e0e7ff]/90 to-[#eef2ff]/90 border-indigo-200/80'
            }`}>
              <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-2xl border flex items-center justify-center text-lg sm:text-xl shrink-0 shadow-xs ${
                isDarkMode ? 'bg-slate-800 border-indigo-800 text-indigo-400' : 'bg-white/80 border-indigo-200 text-indigo-600'
              }`}>
                🏫
              </div>
              <div>
                <p className={`text-[10px] sm:text-[11px] font-bold uppercase tracking-wider ${isDarkMode ? 'text-indigo-300' : 'text-indigo-900/70'}`}>Total Kelas</p>
                <p className={`text-xl sm:text-2xl font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{isLoading ? '...' : totalKelas}</p>
              </div>
            </div>

            <div className={`backdrop-blur-md border rounded-2xl p-4 sm:p-5 flex items-center gap-3 sm:gap-4 shadow-sm hover:shadow-md transition ${
              isDarkMode 
                ? 'bg-gradient-to-br from-indigo-950/40 via-slate-900/60 to-indigo-900/20 border-indigo-800/60' 
                : 'bg-gradient-to-br from-[#dbe2fe]/90 via-[#e0e7ff]/90 to-[#eef2ff]/90 border-indigo-200/80'
            }`}>
              <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-2xl border flex items-center justify-center text-lg sm:text-xl shrink-0 shadow-xs ${
                isDarkMode ? 'bg-slate-800 border-indigo-800 text-indigo-400' : 'bg-white/80 border-indigo-200 text-indigo-600'
              }`}>
                👨‍🏫
              </div>
              <div>
                <p className={`text-[10px] sm:text-[11px] font-bold uppercase tracking-wider ${isDarkMode ? 'text-indigo-300' : 'text-indigo-900/70'}`}>Total Guru</p>
                <p className={`text-xl sm:text-2xl font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{isLoading ? '...' : totalGuru}</p>
              </div>
            </div>

            <div className={`backdrop-blur-md border rounded-2xl p-4 sm:p-5 flex items-center gap-3 sm:gap-4 shadow-sm hover:shadow-md transition ${
              isDarkMode 
                ? 'bg-gradient-to-br from-indigo-950/40 via-slate-900/60 to-indigo-900/20 border-indigo-800/60' 
                : 'bg-gradient-to-br from-[#dbe2fe]/90 via-[#e0e7ff]/90 to-[#eef2ff]/90 border-indigo-200/80'
            }`}>
              <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-2xl border flex items-center justify-center text-lg sm:text-xl shrink-0 shadow-xs ${
                isDarkMode ? 'bg-slate-800 border-indigo-800 text-indigo-400' : 'bg-white/80 border-indigo-200 text-indigo-600'
              }`}>
                📋
              </div>
              <div>
                <p className={`text-[10px] sm:text-[11px] font-bold uppercase tracking-wider ${isDarkMode ? 'text-indigo-300' : 'text-indigo-900/70'}`}>Hadir Hari Ini</p>
                <p className={`text-base sm:text-lg font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{isLoading ? '...' : persentaseHadir}</p>
              </div>
            </div>
          </div>

          {/* BANNER DEEP LEARNING AI PRO */}
          <div className="bg-gradient-to-r from-emerald-800 via-teal-800 to-emerald-950 rounded-3xl p-6 sm:p-8 text-white shadow-xl space-y-4 sm:space-y-6 relative overflow-hidden border border-emerald-700/50">
            <div className="inline-flex items-center gap-2 bg-amber-400 text-slate-950 text-[10px] sm:text-[11px] font-black px-3.5 py-1 rounded-full uppercase tracking-wider shadow-md">
              <span>DEEP LEARNING AI PRO</span>
              <span>✨</span>
            </div>

            <div className="space-y-2 max-w-2xl">
              <h2 className="text-2xl sm:text-3xl font-black tracking-tight leading-tight text-white">
                Buat Modul Ajar Deep Learning Otomatis
              </h2>
              <p className="text-xs text-emerald-100 leading-relaxed font-medium">
                Susun modul pembelajaran Kurikulum Merdeka lengkap dengan skenario kegiatan per pertemuan (hingga 5 pertemuan), tabel diagnostik, rubrik asesmen, dan LKPD interaktif siap cetak.
              </p>
            </div>

            <div>
              <Link
                href="/ai"
                className="inline-flex items-center gap-2 bg-white hover:bg-emerald-50 text-emerald-950 font-extrabold px-5 sm:px-6 py-2.5 sm:py-3 rounded-2xl text-xs transition shadow-lg cursor-pointer"
              >
                <span>✏️</span>
                <span>Buka Modul Ajar AI</span>
              </Link>
            </div>
          </div>

          {/* GRID MENU AKSES CEPAT */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className={`font-bold text-sm sm:text-base flex items-center gap-2 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                <span className="text-indigo-500">🔲</span> Akses Cepat Modul &amp; Menu Administrasi Guru
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
              
              {isOperator && (
                <div className={`backdrop-blur-md border rounded-2xl p-5 sm:p-6 space-y-4 hover:shadow-md transition ${
                  isDarkMode 
                    ? 'bg-slate-900/80 border-slate-800 hover:border-indigo-600' 
                    : 'bg-gradient-to-br from-[#c7d2fe]/90 via-[#dbe2fe]/90 to-[#edf2ff]/90 border-indigo-200/80 hover:border-indigo-400'
                }`}>
                  <div className="flex items-start justify-between">
                    <div className={`w-10 h-10 rounded-xl border flex items-center justify-center text-xl shadow-xs ${
                      isDarkMode ? 'bg-slate-800 border-slate-700 text-indigo-400' : 'bg-white/80 border-indigo-200 text-indigo-700'
                    }`}>
                      🏫
                    </div>
                    <span className={`border px-2.5 py-1 rounded-md text-[10px] font-extrabold tracking-wider uppercase ${
                      isDarkMode ? 'bg-slate-800 text-indigo-300 border-slate-700' : 'bg-white/80 text-indigo-900 border-indigo-200'
                    }`}>
                      MANAJEMEN ROMBEL
                    </span>
                  </div>
                  <div>
                    <h4 className={`font-extrabold text-base ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Kelola Kelas &amp; Wali Kelas</h4>
                    <p className={`text-xs font-medium mt-1.5 leading-relaxed ${isDarkMode ? 'text-slate-400' : 'text-slate-700'}`}>
                      Atur rombongan belajar (Rombel), pemetaan kelas, dan penugasan guru wali kelas.
                    </p>
                  </div>
                  <Link href="/kelas" className={`inline-flex items-center gap-1.5 text-xs font-bold transition ${
                    isDarkMode ? 'text-indigo-400 hover:text-indigo-300' : 'text-indigo-800 hover:text-indigo-950'
                  }`}>
                    <span>Buka Fitur</span>
                    <span>➔</span>
                  </Link>
                </div>
              )}

              {isOperator && (
                <div className={`backdrop-blur-md border rounded-2xl p-5 sm:p-6 space-y-4 hover:shadow-md transition ${
                  isDarkMode 
                    ? 'bg-slate-900/80 border-slate-800 hover:border-indigo-600' 
                    : 'bg-gradient-to-br from-[#c7d2fe]/90 via-[#dbe2fe]/90 to-[#edf2ff]/90 border-indigo-200/80 hover:border-indigo-400'
                }`}>
                  <div className="flex items-start justify-between">
                    <div className={`w-10 h-10 rounded-xl border flex items-center justify-center text-xl shadow-xs ${
                      isDarkMode ? 'bg-slate-800 border-slate-700 text-indigo-400' : 'bg-white/80 border-indigo-200 text-indigo-700'
                    }`}>
                      👥
                    </div>
                    <span className={`border px-2.5 py-1 rounded-md text-[10px] font-extrabold tracking-wider uppercase ${
                      isDarkMode ? 'bg-slate-800 text-indigo-300 border-slate-700' : 'bg-white/80 text-indigo-900 border-indigo-200'
                    }`}>
                      MASTER DATA
                    </span>
                  </div>
                  <div>
                    <h4 className={`font-extrabold text-base ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Kelola Master Siswa</h4>
                    <p className={`text-xs font-medium mt-1.5 leading-relaxed ${isDarkMode ? 'text-slate-400' : 'text-slate-700'}`}>
                      Olah data seluruh siswa, NISN, import Excel, edit &amp; hapus data.
                    </p>
                  </div>
                  <Link href="/siswa" className={`inline-flex items-center gap-1.5 text-xs font-bold transition ${
                    isDarkMode ? 'text-indigo-400 hover:text-indigo-300' : 'text-indigo-800 hover:text-indigo-950'
                  }`}>
                    <span>Buka Fitur</span>
                    <span>➔</span>
                  </Link>
                </div>
              )}

              {isOperator && (
                <div className={`backdrop-blur-md border rounded-2xl p-5 sm:p-6 space-y-4 hover:shadow-md transition ${
                  isDarkMode 
                    ? 'bg-slate-900/80 border-slate-800 hover:border-indigo-600' 
                    : 'bg-gradient-to-br from-[#c7d2fe]/90 via-[#dbe2fe]/90 to-[#edf2ff]/90 border-indigo-200/80 hover:border-indigo-400'
                }`}>
                  <div className="flex items-start justify-between">
                    <div className={`w-10 h-10 rounded-xl border flex items-center justify-center text-xl shadow-xs ${
                      isDarkMode ? 'bg-slate-800 border-slate-700 text-indigo-400' : 'bg-white/80 border-indigo-200 text-indigo-700'
                    }`}>
                      📖
                    </div>
                    <span className={`border px-2.5 py-1 rounded-md text-[10px] font-extrabold tracking-wider uppercase ${
                      isDarkMode ? 'bg-slate-800 text-indigo-300 border-slate-700' : 'bg-white/80 text-indigo-900 border-indigo-200'
                    }`}>
                      KURIKULUM
                    </span>
                  </div>
                  <div>
                    <h4 className={`font-extrabold text-base ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Kelola Mata Pelajaran</h4>
                    <p className={`text-xs font-medium mt-1.5 leading-relaxed ${isDarkMode ? 'text-slate-400' : 'text-slate-700'}`}>
                      Atur daftar mapel, semester, dan alokasi jam mengajar harian.
                    </p>
                  </div>
                  <Link href="/mapel" className={`inline-flex items-center gap-1.5 text-xs font-bold transition ${
                    isDarkMode ? 'text-indigo-400 hover:text-indigo-300' : 'text-indigo-800 hover:text-indigo-950'
                  }`}>
                    <span>Buka Fitur</span>
                    <span>➔</span>
                  </Link>
                </div>
              )}

              {isOperator && (
                <div className={`backdrop-blur-md border rounded-2xl p-5 sm:p-6 space-y-4 hover:shadow-md transition ${
                  isDarkMode 
                    ? 'bg-slate-900/80 border-slate-800 hover:border-indigo-600' 
                    : 'bg-gradient-to-br from-[#c7d2fe]/90 via-[#dbe2fe]/90 to-[#edf2ff]/90 border-indigo-200/80 hover:border-indigo-400'
                }`}>
                  <div className="flex items-start justify-between">
                    <div className={`w-10 h-10 rounded-xl border flex items-center justify-center text-xl shadow-xs ${
                      isDarkMode ? 'bg-slate-800 border-slate-700 text-indigo-400' : 'bg-white/80 border-indigo-200 text-indigo-700'
                    }`}>
                      📑
                    </div>
                    <span className={`border px-2.5 py-1 rounded-md text-[10px] font-extrabold tracking-wider uppercase ${
                      isDarkMode ? 'bg-slate-800 text-indigo-300 border-slate-700' : 'bg-white/80 text-indigo-900 border-indigo-200'
                    }`}>
                      TATA USAHA
                    </span>
                  </div>
                  <div>
                    <h4 className={`font-extrabold text-base ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Administrasi &amp; Persuratan TU</h4>
                    <p className={`text-xs font-medium mt-1.5 leading-relaxed ${isDarkMode ? 'text-slate-400' : 'text-slate-700'}`}>
                      Penerbitan surat keterangan aktif, surat mutasi, undangan wali, dan arsip resmi TU.
                    </p>
                  </div>
                  <Link href="/administrasi" className={`inline-flex items-center gap-1.5 text-xs font-bold transition ${
                    isDarkMode ? 'text-indigo-400 hover:text-indigo-300' : 'text-indigo-800 hover:text-indigo-950'
                  }`}>
                    <span>Buka Fitur</span>
                    <span>➔</span>
                  </Link>
                </div>
              )}

              {isOperator && (
                <div className={`backdrop-blur-md border rounded-2xl p-5 sm:p-6 space-y-4 hover:shadow-md transition ${
                  isDarkMode 
                    ? 'bg-slate-900/80 border-slate-800 hover:border-indigo-600' 
                    : 'bg-gradient-to-br from-[#c7d2fe]/90 via-[#dbe2fe]/90 to-[#edf2ff]/90 border-indigo-200/80 hover:border-indigo-400'
                }`}>
                  <div className="flex items-start justify-between">
                    <div className={`w-10 h-10 rounded-xl border flex items-center justify-center text-xl shadow-xs ${
                      isDarkMode ? 'bg-slate-800 border-slate-700 text-indigo-400' : 'bg-white/80 border-indigo-200 text-indigo-700'
                    }`}>
                      🎴
                    </div>
                    <span className={`border px-2.5 py-1 rounded-md text-[10px] font-extrabold tracking-wider uppercase ${
                      isDarkMode ? 'bg-slate-800 text-indigo-300 border-slate-700' : 'bg-white/80 text-indigo-900 border-indigo-200'
                    }`}>
                      KARTU PELAJAR
                    </span>
                  </div>
                  <div>
                    <h4 className={`font-extrabold text-base ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Cetak Kartu &amp; QR Code</h4>
                    <p className={`text-xs font-medium mt-1.5 leading-relaxed ${isDarkMode ? 'text-slate-400' : 'text-slate-700'}`}>
                      Cetak kartu pelajar resmi dengan QR Code presensi terintegrasi.
                    </p>
                  </div>
                  <Link href="/kartu" className={`inline-flex items-center gap-1.5 text-xs font-bold transition ${
                    isDarkMode ? 'text-indigo-400 hover:text-indigo-300' : 'text-indigo-800 hover:text-indigo-950'
                  }`}>
                    <span>Buka Fitur</span>
                    <span>➔</span>
                  </Link>
                </div>
              )}

              <div className={`backdrop-blur-md border rounded-2xl p-5 sm:p-6 space-y-4 hover:shadow-md transition ${
                isDarkMode 
                  ? 'bg-slate-900/80 border-slate-800 hover:border-indigo-600' 
                  : 'bg-gradient-to-br from-[#c7d2fe]/90 via-[#dbe2fe]/90 to-[#edf2ff]/90 border-indigo-200/80 hover:border-indigo-400'
              }`}>
                <div className="flex items-start justify-between">
                  <div className={`w-10 h-10 rounded-xl border flex items-center justify-center text-xl shadow-xs ${
                    isDarkMode ? 'bg-slate-800 border-slate-700 text-indigo-400' : 'bg-white/80 border-indigo-200 text-indigo-700'
                  }`}>
                    📅
                  </div>
                  <span className={`border px-2.5 py-1 rounded-md text-[10px] font-extrabold tracking-wider uppercase ${
                    isDarkMode ? 'bg-slate-800 text-indigo-300 border-slate-700' : 'bg-white/80 text-indigo-900 border-indigo-200'
                  }`}>
                    JADWAL
                  </span>
                </div>
                <div>
                  <h4 className={`font-extrabold text-base ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Jadwal Mengajar</h4>
                  <p className={`text-xs font-medium mt-1.5 leading-relaxed ${isDarkMode ? 'text-slate-400' : 'text-slate-700'}`}>
                    Kelola jadwal tatap muka kelas, jam pelajaran, dan ruang kelas.
                  </p>
                </div>
                <Link href="/jadwal" className={`inline-flex items-center gap-1.5 text-xs font-bold transition ${
                  isDarkMode ? 'text-indigo-400 hover:text-indigo-300' : 'text-indigo-800 hover:text-indigo-950'
                }`}>
                  <span>Buka Fitur</span>
                  <span>➔</span>
                </Link>
              </div>

              <div className={`backdrop-blur-md border rounded-2xl p-5 sm:p-6 space-y-4 hover:shadow-md transition ${
                isDarkMode 
                  ? 'bg-slate-900/80 border-slate-800 hover:border-indigo-600' 
                  : 'bg-gradient-to-br from-[#c7d2fe]/90 via-[#dbe2fe]/90 to-[#edf2ff]/90 border-indigo-200/80 hover:border-indigo-400'
              }`}>
                <div className="flex items-start justify-between">
                  <div className={`w-10 h-10 rounded-xl border flex items-center justify-center text-xl shadow-xs ${
                    isDarkMode ? 'bg-slate-800 border-slate-700 text-indigo-400' : 'bg-white/80 border-indigo-200 text-indigo-700'
                  }`}>
                    📋
                  </div>
                  <span className={`border px-2.5 py-1 rounded-md text-[10px] font-extrabold tracking-wider uppercase ${
                    isDarkMode ? 'bg-slate-800 text-indigo-300 border-slate-700' : 'bg-white/80 text-indigo-900 border-indigo-200'
                  }`}>
                    PRESENSI
                  </span>
                </div>
                <div>
                  <h4 className={`font-extrabold text-base ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Scan &amp; Input Absensi</h4>
                  <p className={`text-xs font-medium mt-1.5 leading-relaxed ${isDarkMode ? 'text-slate-400' : 'text-slate-700'}`}>
                    Pencatatan presensi harian manual &amp; scan QR Code kamera otomatis.
                  </p>
                </div>
                <Link href="/absensi" className={`inline-flex items-center gap-1.5 text-xs font-bold transition ${
                  isDarkMode ? 'text-indigo-400 hover:text-indigo-300' : 'text-indigo-800 hover:text-indigo-950'
                }`}>
                  <span>Buka Fitur</span>
                  <span>➔</span>
                </Link>
              </div>

              <div className={`backdrop-blur-md border rounded-2xl p-5 sm:p-6 space-y-4 hover:shadow-md transition ${
                isDarkMode 
                  ? 'bg-slate-900/80 border-slate-800 hover:border-indigo-600' 
                  : 'bg-gradient-to-br from-[#c7d2fe]/90 via-[#dbe2fe]/90 to-[#edf2ff]/90 border-indigo-200/80 hover:border-indigo-400'
              }`}>
                <div className="flex items-start justify-between">
                  <div className={`w-10 h-10 rounded-xl border flex items-center justify-center text-xl shadow-xs ${
                    isDarkMode ? 'bg-slate-800 border-slate-700 text-indigo-400' : 'bg-white/80 border-indigo-200 text-indigo-700'
                  }`}>
                    🎓
                  </div>
                  <span className={`border px-2.5 py-1 rounded-md text-[10px] font-extrabold tracking-wider uppercase ${
                    isDarkMode ? 'bg-slate-800 text-indigo-300 border-slate-700' : 'bg-white/80 text-indigo-900 border-indigo-200'
                  }`}>
                    NILAI &amp; RAPOR
                  </span>
                </div>
                <div>
                  <h4 className={`font-extrabold text-base ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Input Penilaian &amp; Leger</h4>
                  <p className={`text-xs font-medium mt-1.5 leading-relaxed ${isDarkMode ? 'text-slate-400' : 'text-slate-700'}`}>
                    Rekap nilai harian, UTS, UAS, kalkulasi otomatis &amp; leger siswa.
                  </p>
                </div>
                <Link href="/nilai" className={`inline-flex items-center gap-1.5 text-xs font-bold transition ${
                  isDarkMode ? 'text-indigo-400 hover:text-indigo-300' : 'text-indigo-800 hover:text-indigo-950'
                }`}>
                  <span>Buka Fitur</span>
                  <span>➔</span>
                </Link>
              </div>

              <div className={`backdrop-blur-md border rounded-2xl p-5 sm:p-6 space-y-4 hover:shadow-md transition ${
                isDarkMode 
                  ? 'bg-slate-900/80 border-slate-800 hover:border-indigo-600' 
                  : 'bg-gradient-to-br from-[#c7d2fe]/90 via-[#dbe2fe]/90 to-[#edf2ff]/90 border-indigo-200/80 hover:border-indigo-400'
              }`}>
                <div className="flex items-start justify-between">
                  <div className={`w-10 h-10 rounded-xl border flex items-center justify-center text-xl shadow-xs ${
                    isDarkMode ? 'bg-slate-800 border-slate-700 text-indigo-400' : 'bg-white/80 border-indigo-200 text-indigo-700'
                  }`}>
                    📓
                  </div>
                  <span className={`border px-2.5 py-1 rounded-md text-[10px] font-extrabold tracking-wider uppercase ${
                    isDarkMode ? 'bg-slate-800 text-indigo-300 border-slate-700' : 'bg-white/80 text-indigo-900 border-indigo-200'
                  }`}>
                    JURNAL KBM
                  </span>
                </div>
                <div>
                  <h4 className={`font-extrabold text-base ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Agenda Mengajar Guru</h4>
                  <p className={`text-xs font-medium mt-1.5 leading-relaxed ${isDarkMode ? 'text-slate-400' : 'text-slate-700'}`}>
                    Jurnal harian KBM, keterlaksanaan materi &amp; catatan kehadiran.
                  </p>
                </div>
                <Link href="/jurnal" className={`inline-flex items-center gap-1.5 text-xs font-bold transition ${
                  isDarkMode ? 'text-indigo-400 hover:text-indigo-300' : 'text-indigo-800 hover:text-indigo-950'
                }`}>
                  <span>Buka Fitur</span>
                  <span>➔</span>
                </Link>
              </div>

              {canAccessBimbingan && (
                <div className={`backdrop-blur-md border rounded-2xl p-5 sm:p-6 space-y-4 hover:shadow-md transition ${
                  isDarkMode 
                    ? 'bg-slate-900/80 border-slate-800 hover:border-indigo-600' 
                    : 'bg-gradient-to-br from-[#c7d2fe]/90 via-[#dbe2fe]/90 to-[#edf2ff]/90 border-indigo-200/80 hover:border-indigo-400'
                }`}>
                  <div className="flex items-start justify-between">
                    <div className={`w-10 h-10 rounded-xl border flex items-center justify-center text-xl shadow-xs ${
                      isDarkMode ? 'bg-slate-800 border-slate-700 text-indigo-400' : 'bg-white/80 border-indigo-200 text-indigo-700'
                    }`}>
                      💖
                    </div>
                    <span className={`border px-2.5 py-1 rounded-md text-[10px] font-extrabold tracking-wider uppercase ${
                      isDarkMode ? 'bg-slate-800 text-indigo-300 border-slate-700' : 'bg-white/80 text-indigo-900 border-indigo-200'
                    }`}>
                      GURU WALI
                    </span>
                  </div>
                  <div>
                    <h4 className={`font-extrabold text-base ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Bimbingan Guru Wali</h4>
                    <p className={`text-xs font-medium mt-1.5 leading-relaxed ${isDarkMode ? 'text-slate-400' : 'text-slate-700'}`}>
                      Pencatatan konseling, apresiasi siswa &amp; tindak lanjut orang tua.
                    </p>
                  </div>
                  <Link href="/bimbingan" className={`inline-flex items-center gap-1.5 text-xs font-bold transition ${
                    isDarkMode ? 'text-indigo-400 hover:text-indigo-300' : 'text-indigo-800 hover:text-indigo-950'
                  }`}>
                    <span>Buka Fitur</span>
                    <span>➔</span>
                  </Link>
                </div>
              )}

              <div className={`backdrop-blur-md border rounded-2xl p-5 sm:p-6 space-y-4 hover:shadow-md transition ${
                isDarkMode 
                  ? 'bg-slate-900/80 border-slate-800 hover:border-indigo-600' 
                  : 'bg-gradient-to-br from-[#c7d2fe]/90 via-[#dbe2fe]/90 to-[#edf2ff]/90 border-indigo-200/80 hover:border-indigo-400'
              }`}>
                <div className="flex items-start justify-between">
                  <div className={`w-10 h-10 rounded-xl border flex items-center justify-center text-xl shadow-xs ${
                    isDarkMode ? 'bg-slate-800 border-slate-700 text-indigo-400' : 'bg-white/80 border-indigo-200 text-indigo-700'
                  }`}>
                    📄
                  </div>
                  <span className={`border px-2.5 py-1 rounded-md text-[10px] font-extrabold tracking-wider uppercase ${
                    isDarkMode ? 'bg-slate-800 text-indigo-300 border-slate-700' : 'bg-white/80 text-indigo-900 border-indigo-200'
                  }`}>
                    CETAK DOKUMEN
                  </span>
                </div>
                <div>
                  <h4 className={`font-extrabold text-base ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Pusat Laporan PDF</h4>
                  <p className={`text-xs font-medium mt-1.5 leading-relaxed ${isDarkMode ? 'text-slate-400' : 'text-slate-700'}`}>
                    Cetak rekapitulasi presensi, leger nilai &amp; jurnal resmi ke PDF.
                  </p>
                </div>
                <Link href="/laporan" className={`inline-flex items-center gap-1.5 text-xs font-bold transition ${
                  isDarkMode ? 'text-indigo-400 hover:text-indigo-300' : 'text-indigo-800 hover:text-indigo-950'
                }`}>
                  <span>Buka Fitur</span>
                  <span>➔</span>
                </Link>
              </div>

            </div>
          </div>

          {/* BADGE COPYRIGHT FOOTER */}
          <div className="pt-8 pb-4 flex justify-center">
            <div className={`border px-6 py-2.5 rounded-full text-center text-xs font-medium shadow-xs transition-colors duration-300 ${
              isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-400' : 'bg-slate-100 border-slate-300 text-slate-700'
            }`}>
              <span>Aplikasi Guru AI</span>
              <span className="mx-2">•</span>
              <span>Created by <strong className="text-emerald-500 font-bold">MUZAINI AL KAHFI</strong></span>
            </div>
          </div>

        </main>
      </div>

      {/* BOTTOM NAVIGATION DOCK */}
      <div className={`border-t fixed bottom-0 left-0 right-0 z-50 shadow-lg transition-colors duration-300 ${
        isDarkMode ? 'bg-slate-900/95 border-slate-800 backdrop-blur-md' : 'bg-slate-100/95 border-slate-300 backdrop-blur-md'
      }`}>
        <div className="max-w-xl mx-auto px-4 py-2.5 flex items-center justify-between">
          <Link
            href="/"
            className="flex flex-col items-center gap-1 text-xs font-bold text-indigo-500 transition"
          >
            <span className="text-lg">🕒</span>
            <span>Dashboard</span>
          </Link>

          {isOperator && (
            <Link
              href="/siswa"
              className={`flex flex-col items-center gap-1 text-xs font-semibold transition ${
                isDarkMode ? 'text-slate-400 hover:text-slate-100' : 'text-slate-600 hover:text-slate-950'
              }`}
            >
              <span className="text-lg">👥</span>
              <span>Siswa</span>
            </Link>
          )}

          {isOperator && (
            <Link
              href="/guru"
              className={`flex flex-col items-center gap-1 text-xs font-semibold transition ${
                isDarkMode ? 'text-slate-400 hover:text-slate-100' : 'text-slate-600 hover:text-slate-950'
              }`}
            >
              <span className="text-lg">👨‍🏫</span>
              <span>Guru</span>
            </Link>
          )}

          <Link
            href="/jadwal"
            className={`flex flex-col items-center gap-1 text-xs font-semibold transition ${
              isDarkMode ? 'text-slate-400 hover:text-slate-100' : 'text-slate-600 hover:text-slate-950'
            }`}
          >
            <span className="text-lg">🎓</span>
            <span>Akademik</span>
          </Link>

          <Link
            href="/ai"
            className={`flex flex-col items-center gap-1 text-xs font-semibold transition ${
              isDarkMode ? 'text-slate-400 hover:text-slate-100' : 'text-slate-600 hover:text-slate-950'
            }`}
          >
            <span className="text-lg">✨</span>
            <span>AI Tools</span>
          </Link>

          <Link
            href="/laporan"
            className={`flex flex-col items-center gap-1 text-xs font-semibold transition ${
              isDarkMode ? 'text-slate-400 hover:text-slate-100' : 'text-slate-600 hover:text-slate-950'
            }`}
          >
            <span className="text-lg">🖨️</span>
            <span>Laporan</span>
          </Link>
        </div>
      </div>
    </motion.div>
  )
}