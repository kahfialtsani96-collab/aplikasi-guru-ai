'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useAuthRole } from '@/hooks/useAuthRole'
import { useDarkMode } from '@/hooks/useDarkMode'
import {
  Clock,
  Users,
  GraduationCap,
  BookOpen,
  Sparkles,
  Printer,
  Heart,
  FileText,
  Wand2,
  Compass,
  Bot,
  HelpCircle,
  Globe,
  X,
  ChevronRight,
} from 'lucide-react'

export default function Navbar() {
  const pathname = usePathname() || '/'
  const router = useRouter()
  const [showAiModal, setShowAiModal] = useState(false)

  const { isOperator } = useAuthRole()
  const { isDarkMode } = useDarkMode()

  // Hindari hydration mismatch: sebelum `mounted`, pakai default gelap (identik server & client),
  // lalu terapkan nilai nyata dari localStorage setelah mounted.
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
  }, [])
  const safeDarkMode = mounted ? isDarkMode : true

  // Sembunyikan Navbar global di halaman login & portal SMK (yang punya navigasinya sendiri)
  if (pathname === '/login' || pathname.startsWith('/smk')) {
    return null
  }

  const isAkademikActive = [
    '/jadwal',
    '/absensi',
    '/nilai',
    '/jurnal',
    '/bimbingan',
    '/mapel',
  ].includes(pathname)

  const aiToolsList = [
    {
      title: 'Perangkat Ajar KBC',
      badge: 'KBC',
      badgeColor: 'bg-amber-500/20 text-amber-400 border border-amber-500/30',
      desc: 'ACP, TP, ATP, Prota, Prosem, KKTP, Modul, LKPD & Rubrik KBC',
      icon: Heart,
      iconBg: 'bg-[#1e293b]',
      href: '/ai?tool=kbc',
      highlight: false,
    },
    {
      title: 'Generator Perangkat Ajar AI',
      badge: 'AI Pro',
      badgeColor: 'bg-amber-400 text-slate-950 font-bold',
      desc: 'Buat RPP & ATP otomatis dengan AI',
      icon: FileText,
      iconBg: 'bg-amber-500 text-slate-950 font-bold',
      href: '/ai?tool=perangkat',
      highlight: true,
    },
    {
      title: 'Modul Ajar AI',
      badge: 'Deep Learning',
      badgeColor: 'bg-amber-500/20 text-amber-400 border border-amber-500/30',
      desc: 'Susun Modul Ajar Deep Learning Kurikulum Merdeka',
      icon: Wand2,
      iconBg: 'bg-[#1e293b]',
      href: '/ai?tool=deep-learning',
      highlight: false,
    },
    {
      title: 'Modul Kokurikuler AI',
      badge: 'Kokurikuler',
      badgeColor: 'bg-amber-500/20 text-amber-400 border border-amber-500/30',
      desc: 'Perencanaan kokurikuler lintas mapel & dimensi profil',
      icon: Compass,
      iconBg: 'bg-[#1e293b]',
      href: '/ai?tool=kokurikuler',
      highlight: false,
    },
    {
      title: 'Asisten Guru AI',
      badge: 'Chatbot',
      badgeColor: 'bg-amber-500/20 text-amber-400 border border-amber-500/30',
      desc: 'Tanya jawab & konsultasi materi mengajar',
      icon: Bot,
      iconBg: 'bg-[#1e293b]',
      href: '/ai?tool=chatbot',
      highlight: false,
    },
    {
      title: 'Generator LKPD AI',
      badge: 'LKPD',
      badgeColor: 'bg-amber-500/20 text-amber-400 border border-amber-500/30',
      desc: 'Buat Lembar Kerja Peserta Didik interaktif',
      icon: Sparkles,
      iconBg: 'bg-[#1e293b]',
      href: '/ai?tool=lkpd',
      highlight: false,
    },
    {
      title: 'Generator Soal AI',
      badge: 'Ujian',
      badgeColor: 'bg-amber-500/20 text-amber-400 border border-amber-500/30',
      desc: 'Naskah Soal Ujian, LJS, dan Kunci Jawaban Siap Cetak',
      icon: HelpCircle,
      iconBg: 'bg-[#1e293b]',
      href: '/ai?tool=soal',
      highlight: false,
    },
    {
      title: 'Generator AI Lainnya',
      badge: 'Multi-Tool',
      badgeColor: 'bg-amber-500/20 text-amber-400 border border-amber-500/30',
      desc: 'Generator Soal, Silabus, Rubrik Asesmen & Media',
      icon: Globe,
      iconBg: 'bg-[#1e293b]',
      href: '/ai?tool=multi',
      highlight: false,
    },
  ]

  const handleSelectTool = (href: string) => {
    setShowAiModal(false)
    router.push(href)
  }

  const inactiveNav = safeDarkMode
    ? 'text-slate-300 hover:text-white'
    : 'text-slate-600 hover:text-slate-950'

  return (
    <>
      {/* BOTTOM NAV DOCK GLOBAL */}
      <div
        className={`border-t fixed bottom-0 left-0 right-0 z-50 shadow-lg print:hidden transition-colors duration-300 ${
          safeDarkMode
            ? 'bg-slate-900/95 border-slate-800 backdrop-blur-md'
            : 'bg-slate-100/95 border-slate-300 backdrop-blur-md'
        }`}
      >
        <div className="max-w-xl mx-auto px-4 py-2.5 flex items-center justify-between">
          {/* 1. DASHBOARD (Semua Pengguna) */}
          <Link
            href="/"
            className={`flex flex-col items-center gap-1 text-xs font-medium transition ${
              pathname === '/' ? 'text-sky-400 font-bold' : inactiveNav
            }`}
          >
            <Clock className="w-5 h-5" />
            <span>Dashboard</span>
          </Link>

          {/* 2. SISWA (HANYA OPERATOR) */}
          {isOperator && (
            <Link
              href="/siswa"
              className={`flex flex-col items-center gap-1 text-xs font-medium transition ${
                pathname === '/siswa' ? 'text-sky-400 font-bold' : inactiveNav
              }`}
            >
              <Users className="w-5 h-5" />
              <span>Siswa</span>
            </Link>
          )}

          {/* 3. GURU (HANYA OPERATOR) */}
          {isOperator && (
            <Link
              href="/guru"
              className={`flex flex-col items-center gap-1 text-xs font-medium transition ${
                pathname === '/guru' ? 'text-sky-400 font-bold' : inactiveNav
              }`}
            >
              <GraduationCap className="w-5 h-5" />
              <span>Guru</span>
            </Link>
          )}

          {/* 4. AKADEMIK (Semua Pengguna) */}
          <Link
            href="/jadwal"
            className={`flex flex-col items-center gap-1 text-xs font-medium transition ${
              isAkademikActive ? 'text-sky-400 font-bold' : inactiveNav
            }`}
          >
            <BookOpen className="w-5 h-5" />
            <span>Akademik</span>
          </Link>

          {/* 5. AI TOOLS (Semua Pengguna) */}
          <button
            type="button"
            onClick={() => setShowAiModal(true)}
            className={`flex flex-col items-center gap-1 text-xs font-medium transition ${
              showAiModal || pathname.startsWith('/ai')
                ? 'text-sky-400 font-bold'
                : inactiveNav
            }`}
          >
            <Sparkles className="w-5 h-5" />
            <span>AI Tools</span>
          </button>

          {/* 6. LAPORAN (Semua Pengguna) */}
          <Link
            href="/laporan"
            className={`flex flex-col items-center gap-1 text-xs font-medium transition ${
              pathname === '/laporan' ? 'text-sky-400 font-bold' : inactiveNav
            }`}
          >
            <Printer className="w-5 h-5" />
            <span>Laporan</span>
          </Link>

        </div>
      </div>

      {/* OVERLAY BOTTOM SHEET MODAL AI TOOLS */}
      {showAiModal && (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 backdrop-blur-md p-0 sm:pb-14 transition-all duration-300"
          onClick={() => setShowAiModal(false)}
        >
          <div
            className="w-full max-w-4xl bg-[#0e1626] border-t sm:border border-slate-800 rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] mb-14 sm:mb-0"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="pt-3 pb-1 flex justify-center bg-[#111c30]">
              <div className="w-12 h-1.5 bg-slate-700/80 rounded-full"></div>
            </div>

            <div className="px-6 pb-4 pt-1 bg-[#111c30] border-b border-slate-800/80 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 font-bold">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-white text-base">Pilih Tool AI Lengkap</h3>
                  <p className="text-xs text-slate-400">Seluruh generator & kecerdasan buatan AI Pro</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowAiModal(false)}
                className="w-9 h-9 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 sm:p-6 overflow-y-auto space-y-3 custom-scrollbar bg-[#0b1220]/90">
              {aiToolsList.map((item, idx) => (
                <div
                  key={idx}
                  onClick={() => handleSelectTool(item.href)}
                  className={`group p-4 rounded-2xl border transition cursor-pointer flex items-center justify-between gap-4 ${
                    item.highlight
                      ? 'bg-[#231713] border-amber-600/70 shadow-lg shadow-amber-950/40'
                      : 'bg-[#131d31] border-slate-800/80 hover:border-slate-700 hover:bg-[#18253d]'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shadow-md ${item.iconBg}`}>
                      <item.icon className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-white text-sm group-hover:text-amber-400 transition">
                          {item.title}
                        </h4>
                        <span className={`text-[10px] px-2 py-0.5 rounded-md font-semibold ${item.badgeColor}`}>
                          {item.badge}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-1 line-clamp-1">{item.desc}</p>
                    </div>
                  </div>

                  <ChevronRight className="w-5 h-5 text-amber-500 group-hover:translate-x-1 transition pr-2 shrink-0" />
                </div>
              ))}
            </div>

          </div>
        </div>
      )}
    </>
  )
}