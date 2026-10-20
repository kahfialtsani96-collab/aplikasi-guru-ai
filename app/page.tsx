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

  useEffect(() => {
    async function fetchDataFromSupabase() {
      setIsLoading(true)

      // 1. AUTH GUARD: Cek apakah user sudah login
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

      const { count: countSiswa } = await supabase
        .from('siswa')
        .select('*', { count: 'exact', head: true })
      if (countSiswa !== null) setTotalSiswa(countSiswa)

      const { count: countKelas } = await supabase
        .from('kelas')
        .select('*', { count: 'exact', head: true })
      if (countKelas !== null) setTotalKelas(countKelas)

      const { count: countGuru } = await supabase
        .from('guru')
        .select('*', { count: 'exact', head: true })
      if (countGuru !== null) setTotalGuru(countGuru)

      const todayStr = new Date().toISOString().split('T')[0]
      const { data: absensiToday } = await supabase
        .from('absensi')
        .select('status')
        .eq('tanggal', todayStr)

      if (absensiToday && absensiToday.length > 0) {
        const jumlahHadir = absensiToday.filter(
          a => a.status?.toUpperCase() === 'HADIR'
        ).length
        const totalAbsen = absensiToday.length
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
      className="min-h-screen bg-[#E2E8F0] text-slate-800 font-sans flex flex-col justify-between selection:bg-indigo-500 selection:text-white pb-32 relative overflow-x-hidden"
    >
      {/* WATERMARK LOGO */}
      <div className="fixed inset-0 pointer-events-none z-0 flex items-center justify-center opacity-[0.15] select-none">
        <img
          src="/logo-smp.jpg"
          alt="Watermark SMP Muna Mustofa"
          className="w-[850px] h-[850px] object-contain max-w-none"
        />
      </div>

      <div className="relative z-10">
        {/* HEADER TOPBAR */}
        <header className="bg-slate-100/90 backdrop-blur-md border-b border-slate-300 px-3 sm:px-6 py-2.5 flex items-center justify-between sticky top-0 z-50 shadow-xs gap-2">
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl overflow-hidden flex items-center justify-center bg-white border border-slate-300 p-0.5 shadow-xs shrink-0">
              <img
                src="/logo-smp.jpg"
                alt="Logo SMP Muna Mustofa"
                className="w-full h-full object-contain"
              />
            </div>
            <div>
              <h1 className="font-bold text-xs sm:text-base text-slate-900 leading-none">Aplikasi Guru AI</h1>
              <p className="text-[10px] sm:text-[11px] text-emerald-800 font-bold mt-0.5 sm:mt-1">SMP Muna Mustofa</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-3">
            <div className="hidden md:flex bg-emerald-100/80 border border-emerald-300 text-emerald-800 text-xs font-semibold px-3 py-1.5 rounded-full items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse"></span>
              <span>Supabase Live</span>
            </div>

            <div className="bg-white border border-slate-300 text-slate-800 text-xs font-bold px-2 sm:px-3.5 py-1 sm:py-1.5 rounded-xl flex items-center gap-1.5 shadow-xs">
              <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px] font-bold shrink-0">
                {userDisplayName.charAt(0)}
              </span>
              <span className="max-w-[70px] sm:max-w-none truncate">{userDisplayName}</span>
              <span className="hidden sm:inline-block bg-indigo-100 text-indigo-800 text-[10px] px-2 py-0.5 rounded-md font-extrabold uppercase ml-1 border border-indigo-200">
                {isOperator ? 'Operator' : 'Guru'}
              </span>
            </div>

            <button
              onClick={async () => {
                await supabase.auth.signOut()
                router.replace('/login')
              }}
              className="bg-rose-100 border border-rose-300 hover:bg-rose-200 text-rose-700 p-1.5 sm:p-2 rounded-xl transition cursor-pointer shrink-0"
              title="Keluar"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </header>

        {/* MAIN CONTENT AREA */}
        <main className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6 sm:space-y-8">

          {/* STATISTIK TOP */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className="bg-gradient-to-br from-[#dbe2fe]/90 via-[#e0e7ff]/90 to-[#eef2ff]/90 backdrop-blur-md border border-indigo-200/80 rounded-2xl p-4 sm:p-5 flex items-center gap-3 sm:gap-4 shadow-sm hover:shadow-md transition">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-white/80 border border-indigo-200 text-indigo-600 flex items-center justify-center text-lg sm:text-xl shrink-0 shadow-xs">
                👥
              </div>
              <div>
                <p className="text-[10px] sm:text-[11px] font-bold text-indigo-900/70 uppercase tracking-wider">Total Siswa</p>
                <p className="text-xl sm:text-2xl font-black text-slate-900">{isLoading ? '...' : totalSiswa}</p>
              </div>
            </div>

            <div className="bg-gradient-to-br from-[#dbe2fe]/90 via-[#e0e7ff]/90 to-[#eef2ff]/90 backdrop-blur-md border border-indigo-200/80 rounded-2xl p-4 sm:p-5 flex items-center gap-3 sm:gap-4 shadow-sm hover:shadow-md transition">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-white/80 border border-indigo-200 text-indigo-600 flex items-center justify-center text-lg sm:text-xl shrink-0 shadow-xs">
                🏫
              </div>
              <div>
                <p className="text-[10px] sm:text-[11px] font-bold text-indigo-900/70 uppercase tracking-wider">Total Kelas</p>
                <p className="text-xl sm:text-2xl font-black text-slate-900">{isLoading ? '...' : totalKelas}</p>
              </div>
            </div>

            <div className="bg-gradient-to-br from-[#dbe2fe]/90 via-[#e0e7ff]/90 to-[#eef2ff]/90 backdrop-blur-md border border-indigo-200/80 rounded-2xl p-4 sm:p-5 flex items-center gap-3 sm:gap-4 shadow-sm hover:shadow-md transition">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-white/80 border border-indigo-200 text-indigo-600 flex items-center justify-center text-lg sm:text-xl shrink-0 shadow-xs">
                👨‍🏫
              </div>
              <div>
                <p className="text-[10px] sm:text-[11px] font-bold text-indigo-900/70 uppercase tracking-wider">Total Guru</p>
                <p className="text-xl sm:text-2xl font-black text-slate-900">{isLoading ? '...' : totalGuru}</p>
              </div>
            </div>

            <div className="bg-gradient-to-br from-[#dbe2fe]/90 via-[#e0e7ff]/90 to-[#eef2ff]/90 backdrop-blur-md border border-indigo-200/80 rounded-2xl p-4 sm:p-5 flex items-center gap-3 sm:gap-4 shadow-sm hover:shadow-md transition">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-white/80 border border-indigo-200 text-indigo-600 flex items-center justify-center text-lg sm:text-xl shrink-0 shadow-xs">
                📋
              </div>
              <div>
                <p className="text-[10px] sm:text-[11px] font-bold text-indigo-900/70 uppercase tracking-wider">Hadir Hari Ini</p>
                <p className="text-base sm:text-lg font-black text-slate-900">{isLoading ? '...' : persentaseHadir}</p>
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
              <h3 className="font-bold text-slate-900 text-sm sm:text-base flex items-center gap-2">
                <span className="text-indigo-700">🔲</span> Akses Cepat Modul &amp; Menu Administrasi Guru
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
              
              {/* KELOLA KELAS & WALI KELAS */}
              {isOperator && (
                <div className="bg-gradient-to-br from-[#c7d2fe]/90 via-[#dbe2fe]/90 to-[#edf2ff]/90 backdrop-blur-md border border-indigo-200/80 rounded-2xl p-5 sm:p-6 space-y-4 hover:border-indigo-400 hover:shadow-md transition">
                  <div className="flex items-start justify-between">
                    <div className="w-10 h-10 rounded-xl bg-white/80 border border-indigo-200 text-indigo-700 flex items-center justify-center text-xl shadow-xs">
                      🏫
                    </div>
                    <span className="bg-white/80 text-indigo-900 border border-indigo-200 px-2.5 py-1 rounded-md text-[10px] font-extrabold tracking-wider uppercase">
                      MANAJEMEN ROMBEL
                    </span>
                  </div>
                  <div>
                    <h4 className="font-extrabold text-slate-900 text-base">Kelola Kelas &amp; Wali Kelas</h4>
                    <p className="text-xs text-slate-700 font-medium mt-1.5 leading-relaxed">
                      Atur rombongan belajar (Rombel), pemetaan kelas, dan penugasan guru wali kelas.
                    </p>
                  </div>
                  <Link href="/kelas" className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-800 hover:text-indigo-950 transition">
                    <span>Buka Fitur</span>
                    <span>➔</span>
                  </Link>
                </div>
              )}

              {/* KELOLA MASTER SISWA */}
              {isOperator && (
                <div className="bg-gradient-to-br from-[#c7d2fe]/90 via-[#dbe2fe]/90 to-[#edf2ff]/90 backdrop-blur-md border border-indigo-200/80 rounded-2xl p-5 sm:p-6 space-y-4 hover:border-indigo-400 hover:shadow-md transition">
                  <div className="flex items-start justify-between">
                    <div className="w-10 h-10 rounded-xl bg-white/80 border border-indigo-200 text-indigo-700 flex items-center justify-center text-xl shadow-xs">
                      👥
                    </div>
                    <span className="bg-white/80 text-indigo-900 border border-indigo-200 px-2.5 py-1 rounded-md text-[10px] font-extrabold tracking-wider uppercase">
                      MASTER DATA
                    </span>
                  </div>
                  <div>
                    <h4 className="font-extrabold text-slate-900 text-base">Kelola Master Siswa</h4>
                    <p className="text-xs text-slate-700 font-medium mt-1.5 leading-relaxed">
                      Olah data seluruh siswa, NISN, import Excel, edit &amp; hapus data.
                    </p>
                  </div>
                  <Link href="/siswa" className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-800 hover:text-indigo-950 transition">
                    <span>Buka Fitur</span>
                    <span>➔</span>
                  </Link>
                </div>
              )}

              {/* KELOLA MATA PELAJARAN (SEKARANG MENGARAH KE /mapel) */}
              {isOperator && (
                <div className="bg-gradient-to-br from-[#c7d2fe]/90 via-[#dbe2fe]/90 to-[#edf2ff]/90 backdrop-blur-md border border-indigo-200/80 rounded-2xl p-5 sm:p-6 space-y-4 hover:border-indigo-400 hover:shadow-md transition">
                  <div className="flex items-start justify-between">
                    <div className="w-10 h-10 rounded-xl bg-white/80 border border-indigo-200 text-indigo-700 flex items-center justify-center text-xl shadow-xs">
                      📖
                    </div>
                    <span className="bg-white/80 text-indigo-900 border border-indigo-200 px-2.5 py-1 rounded-md text-[10px] font-extrabold tracking-wider uppercase">
                      KURIKULUM
                    </span>
                  </div>
                  <div>
                    <h4 className="font-extrabold text-slate-900 text-base">Kelola Mata Pelajaran</h4>
                    <p className="text-xs text-slate-700 font-medium mt-1.5 leading-relaxed">
                      Atur daftar mapel, semester, dan alokasi jam mengajar harian.
                    </p>
                  </div>
                  <Link href="/mapel" className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-800 hover:text-indigo-950 transition">
                    <span>Buka Fitur</span>
                    <span>➔</span>
                  </Link>
                </div>
              )}

              {/* ADMINISTRASI & PERSURATAN TU */}
              {isOperator && (
                <div className="bg-gradient-to-br from-[#c7d2fe]/90 via-[#dbe2fe]/90 to-[#edf2ff]/90 backdrop-blur-md border border-indigo-200/80 rounded-2xl p-5 sm:p-6 space-y-4 hover:border-indigo-400 hover:shadow-md transition">
                  <div className="flex items-start justify-between">
                    <div className="w-10 h-10 rounded-xl bg-white/80 border border-indigo-200 text-indigo-700 flex items-center justify-center text-xl shadow-xs">
                      📑
                    </div>
                    <span className="bg-white/80 text-indigo-900 border border-indigo-200 px-2.5 py-1 rounded-md text-[10px] font-extrabold tracking-wider uppercase">
                      TATA USAHA
                    </span>
                  </div>
                  <div>
                    <h4 className="font-extrabold text-slate-900 text-base">Administrasi &amp; Persuratan TU</h4>
                    <p className="text-xs text-slate-700 font-medium mt-1.5 leading-relaxed">
                      Penerbitan surat keterangan aktif, surat mutasi, undangan wali, dan arsip resmi TU.
                    </p>
                  </div>
                  <Link href="/administrasi" className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-800 hover:text-indigo-950 transition">
                    <span>Buka Fitur</span>
                    <span>➔</span>
                  </Link>
                </div>
              )}

              {/* CETAK KARTU & QR CODE */}
              {isOperator && (
                <div className="bg-gradient-to-br from-[#c7d2fe]/90 via-[#dbe2fe]/90 to-[#edf2ff]/90 backdrop-blur-md border border-indigo-200/80 rounded-2xl p-5 sm:p-6 space-y-4 hover:border-indigo-400 hover:shadow-md transition">
                  <div className="flex items-start justify-between">
                    <div className="w-10 h-10 rounded-xl bg-white/80 border border-indigo-200 text-indigo-700 flex items-center justify-center text-xl shadow-xs">
                      🎴
                    </div>
                    <span className="bg-white/80 text-indigo-900 border border-indigo-200 px-2.5 py-1 rounded-md text-[10px] font-extrabold tracking-wider uppercase">
                      KARTU PELAJAR
                    </span>
                  </div>
                  <div>
                    <h4 className="font-extrabold text-slate-900 text-base">Cetak Kartu &amp; QR Code</h4>
                    <p className="text-xs text-slate-700 font-medium mt-1.5 leading-relaxed">
                      Cetak kartu pelajar resmi dengan QR Code presensi terintegrasi.
                    </p>
                  </div>
                  <Link href="/kartu" className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-800 hover:text-indigo-950 transition">
                    <span>Buka Fitur</span>
                    <span>➔</span>
                  </Link>
                </div>
              )}

              {/* JADWAL MENGAJAR */}
              <div className="bg-gradient-to-br from-[#c7d2fe]/90 via-[#dbe2fe]/90 to-[#edf2ff]/90 backdrop-blur-md border border-indigo-200/80 rounded-2xl p-5 sm:p-6 space-y-4 hover:border-indigo-400 hover:shadow-md transition">
                <div className="flex items-start justify-between">
                  <div className="w-10 h-10 rounded-xl bg-white/80 border border-indigo-200 text-indigo-700 flex items-center justify-center text-xl shadow-xs">
                    📅
                  </div>
                  <span className="bg-white/80 text-indigo-900 border border-indigo-200 px-2.5 py-1 rounded-md text-[10px] font-extrabold tracking-wider uppercase">
                    JADWAL
                  </span>
                </div>
                <div>
                  <h4 className="font-extrabold text-slate-900 text-base">Jadwal Mengajar</h4>
                  <p className="text-xs text-slate-700 font-medium mt-1.5 leading-relaxed">
                    Kelola jadwal tatap muka kelas, jam pelajaran, dan ruang kelas.
                  </p>
                </div>
                <Link href="/jadwal" className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-800 hover:text-indigo-950 transition">
                  <span>Buka Fitur</span>
                  <span>➔</span>
                </Link>
              </div>

              {/* SCAN & INPUT ABSENSI */}
              <div className="bg-gradient-to-br from-[#c7d2fe]/90 via-[#dbe2fe]/90 to-[#edf2ff]/90 backdrop-blur-md border border-indigo-200/80 rounded-2xl p-5 sm:p-6 space-y-4 hover:border-indigo-400 hover:shadow-md transition">
                <div className="flex items-start justify-between">
                  <div className="w-10 h-10 rounded-xl bg-white/80 border border-indigo-200 text-indigo-700 flex items-center justify-center text-xl shadow-xs">
                    📋
                  </div>
                  <span className="bg-white/80 text-indigo-900 border border-indigo-200 px-2.5 py-1 rounded-md text-[10px] font-extrabold tracking-wider uppercase">
                    PRESENSI
                  </span>
                </div>
                <div>
                  <h4 className="font-extrabold text-slate-900 text-base">Scan &amp; Input Absensi</h4>
                  <p className="text-xs text-slate-700 font-medium mt-1.5 leading-relaxed">
                    Pencatatan presensi harian manual &amp; scan QR Code kamera otomatis.
                  </p>
                </div>
                <Link href="/jadwal" className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-800 hover:text-indigo-950 transition">
                  <span>Buka Fitur</span>
                  <span>➔</span>
                </Link>
              </div>

              {/* INPUT PENILAIAN & LEGER */}
              <div className="bg-gradient-to-br from-[#c7d2fe]/90 via-[#dbe2fe]/90 to-[#edf2ff]/90 backdrop-blur-md border border-indigo-200/80 rounded-2xl p-5 sm:p-6 space-y-4 hover:border-indigo-400 hover:shadow-md transition">
                <div className="flex items-start justify-between">
                  <div className="w-10 h-10 rounded-xl bg-white/80 border border-indigo-200 text-indigo-700 flex items-center justify-center text-xl shadow-xs">
                    🎓
                  </div>
                  <span className="bg-white/80 text-indigo-900 border border-indigo-200 px-2.5 py-1 rounded-md text-[10px] font-extrabold tracking-wider uppercase">
                    NILAI &amp; RAPOR
                  </span>
                </div>
                <div>
                  <h4 className="font-extrabold text-slate-900 text-base">Input Penilaian &amp; Leger</h4>
                  <p className="text-xs text-slate-700 font-medium mt-1.5 leading-relaxed">
                    Rekap nilai harian, UTS, UAS, kalkulasi otomatis &amp; leger siswa.
                  </p>
                </div>
                <Link href="/jadwal" className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-800 hover:text-indigo-950 transition">
                  <span>Buka Fitur</span>
                  <span>➔</span>
                </Link>
              </div>

              {/* AGENDA MENGAJAR GURU */}
              <div className="bg-gradient-to-br from-[#c7d2fe]/90 via-[#dbe2fe]/90 to-[#edf2ff]/90 backdrop-blur-md border border-indigo-200/80 rounded-2xl p-5 sm:p-6 space-y-4 hover:border-indigo-400 hover:shadow-md transition">
                <div className="flex items-start justify-between">
                  <div className="w-10 h-10 rounded-xl bg-white/80 border border-indigo-200 text-indigo-700 flex items-center justify-center text-xl shadow-xs">
                    📓
                  </div>
                  <span className="bg-white/80 text-indigo-900 border border-indigo-200 px-2.5 py-1 rounded-md text-[10px] font-extrabold tracking-wider uppercase">
                    JURNAL KBM
                  </span>
                </div>
                <div>
                  <h4 className="font-extrabold text-slate-900 text-base">Agenda Mengajar Guru</h4>
                  <p className="text-xs text-slate-700 font-medium mt-1.5 leading-relaxed">
                    Jurnal harian KBM, keterlaksanaan materi &amp; catatan kehadiran.
                  </p>
                </div>
                <Link href="/jadwal" className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-800 hover:text-indigo-950 transition">
                  <span>Buka Fitur</span>
                  <span>➔</span>
                </Link>
              </div>

              {/* BIMBINGAN GURU WALI */}
              {canAccessBimbingan && (
                <div className="bg-gradient-to-br from-[#c7d2fe]/90 via-[#dbe2fe]/90 to-[#edf2ff]/90 backdrop-blur-md border border-indigo-200/80 rounded-2xl p-5 sm:p-6 space-y-4 hover:border-indigo-400 hover:shadow-md transition">
                  <div className="flex items-start justify-between">
                    <div className="w-10 h-10 rounded-xl bg-white/80 border border-indigo-200 text-indigo-700 flex items-center justify-center text-xl shadow-xs">
                      💖
                    </div>
                    <span className="bg-white/80 text-indigo-900 border border-indigo-200 px-2.5 py-1 rounded-md text-[10px] font-extrabold tracking-wider uppercase">
                      GURU WALI
                    </span>
                  </div>
                  <div>
                    <h4 className="font-extrabold text-slate-900 text-base">Bimbingan Guru Wali</h4>
                    <p className="text-xs text-slate-700 font-medium mt-1.5 leading-relaxed">
                      Pencatatan konseling, apresiasi siswa &amp; tindak lanjut orang tua.
                    </p>
                  </div>
                  <Link href="/bimbingan" className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-800 hover:text-indigo-950 transition">
                    <span>Buka Fitur</span>
                    <span>➔</span>
                  </Link>
                </div>
              )}

              {/* MODUL AJAR DEEP LEARNING AI */}
              <div className="bg-gradient-to-br from-[#c7d2fe]/90 via-[#dbe2fe]/90 to-[#edf2ff]/90 backdrop-blur-md border border-indigo-200/80 rounded-2xl p-5 sm:p-6 space-y-4 hover:border-indigo-400 hover:shadow-md transition">
                <div className="flex items-start justify-between">
                  <div className="w-10 h-10 rounded-xl bg-white/80 border border-indigo-200 text-indigo-700 flex items-center justify-center text-xl shadow-xs">
                    ✨
                  </div>
                  <span className="bg-white/80 text-indigo-900 border border-indigo-200 px-2.5 py-1 rounded-md text-[10px] font-extrabold tracking-wider uppercase">
                    FITUR UNGGULAN AI
                  </span>
                </div>
                <div>
                  <h4 className="font-extrabold text-slate-900 text-base">Modul Ajar Deep Learning AI</h4>
                  <p className="text-xs text-slate-700 font-medium mt-1.5 leading-relaxed">
                    Generator RPP Deep Learning Kurikulum Merdeka (hingga 5 pertemuan).
                  </p>
                </div>
                <Link href="/ai" className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-800 hover:text-indigo-950 transition">
                  <span>Buka Fitur</span>
                  <span>➔</span>
                </Link>
              </div>

              {/* ASISTEN CHATBOT GURU AI */}
              <div className="bg-gradient-to-br from-[#c7d2fe]/90 via-[#dbe2fe]/90 to-[#edf2ff]/90 backdrop-blur-md border border-indigo-200/80 rounded-2xl p-5 sm:p-6 space-y-4 hover:border-indigo-400 hover:shadow-md transition">
                <div className="flex items-start justify-between">
                  <div className="w-10 h-10 rounded-xl bg-white/80 border border-indigo-200 text-indigo-700 flex items-center justify-center text-xl shadow-xs">
                    🤖
                  </div>
                  <span className="bg-white/80 text-indigo-900 border border-indigo-200 px-2.5 py-1 rounded-md text-[10px] font-extrabold tracking-wider uppercase">
                    ASISTEN AI
                  </span>
                </div>
                <div>
                  <h4 className="font-extrabold text-slate-900 text-base">Asisten Chatbot Guru AI</h4>
                  <p className="text-xs text-slate-700 font-medium mt-1.5 leading-relaxed">
                    Konsultan pedagogi AI, pembuat soal HOTS, &amp; draf narasi rapor.
                  </p>
                </div>
                <Link href="/ai" className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-800 hover:text-indigo-950 transition">
                  <span>Buka Fitur</span>
                  <span>➔</span>
                </Link>
              </div>

              {/* PUSAT LAPORAN PDF */}
              <div className="bg-gradient-to-br from-[#c7d2fe]/90 via-[#dbe2fe]/90 to-[#edf2ff]/90 backdrop-blur-md border border-indigo-200/80 rounded-2xl p-5 sm:p-6 space-y-4 hover:border-indigo-400 hover:shadow-md transition">
                <div className="flex items-start justify-between">
                  <div className="w-10 h-10 rounded-xl bg-white/80 border border-indigo-200 text-indigo-700 flex items-center justify-center text-xl shadow-xs">
                    📄
                  </div>
                  <span className="bg-white/80 text-indigo-900 border border-indigo-200 px-2.5 py-1 rounded-md text-[10px] font-extrabold tracking-wider uppercase">
                    CETAK DOKUMEN
                  </span>
                </div>
                <div>
                  <h4 className="font-extrabold text-slate-900 text-base">Pusat Laporan PDF</h4>
                  <p className="text-xs text-slate-700 font-medium mt-1.5 leading-relaxed">
                    Cetak rekapitulasi presensi, leger nilai &amp; jurnal resmi ke PDF.
                  </p>
                </div>
                <Link href="/laporan" className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-800 hover:text-indigo-950 transition">
                  <span>Buka Fitur</span>
                  <span>➔</span>
                </Link>
              </div>

            </div>
          </div>

          {/* BADGE COPYRIGHT FOOTER */}
          <div className="pt-8 pb-4 flex justify-center">
            <div className="bg-slate-100 border border-slate-300 px-6 py-2.5 rounded-full text-center text-xs text-slate-700 font-medium shadow-xs">
              <span>Aplikasi Guru AI</span>
              <span className="mx-2">•</span>
              <span>Created by <strong className="text-emerald-900 font-bold">MUZAINI AL KAHFI</strong></span>
            </div>
          </div>

        </main>
      </div>

      {/* BOTTOM NAVIGATION DOCK */}
      <div className="border-t border-slate-300 bg-slate-100/95 backdrop-blur-md fixed bottom-0 left-0 right-0 z-50 shadow-lg">
        <div className="max-w-xl mx-auto px-4 py-2.5 flex items-center justify-between">
          <Link
            href="/"
            className="flex flex-col items-center gap-1 text-xs font-bold text-indigo-700 transition"
          >
            <span className="text-lg">🕒</span>
            <span>Dashboard</span>
          </Link>

          {isOperator && (
            <Link
              href="/siswa"
              className="flex flex-col items-center gap-1 text-xs font-semibold text-slate-600 hover:text-slate-950 transition"
            >
              <span className="text-lg">👥</span>
              <span>Siswa</span>
            </Link>
          )}

          {isOperator && (
            <Link
              href="/guru"
              className="flex flex-col items-center gap-1 text-xs font-semibold text-slate-600 hover:text-slate-950 transition"
            >
              <span className="text-lg">👨‍🏫</span>
              <span>Guru</span>
            </Link>
          )}

          <Link
            href="/jadwal"
            className="flex flex-col items-center gap-1 text-xs font-semibold text-slate-600 hover:text-slate-950 transition"
          >
            <span className="text-lg">🎓</span>
            <span>Akademik</span>
          </Link>

          <Link
            href="/ai"
            className="flex flex-col items-center gap-1 text-xs font-semibold text-slate-600 hover:text-slate-950 transition"
          >
            <span className="text-lg">✨</span>
            <span>AI Tools</span>
          </Link>

          <Link
            href="/laporan"
            className="flex flex-col items-center gap-1 text-xs font-semibold text-slate-600 hover:text-slate-950 transition"
          >
            <span className="text-lg">🖨️</span>
            <span>Laporan</span>
          </Link>
        </div>
      </div>
    </motion.div>
  )
}