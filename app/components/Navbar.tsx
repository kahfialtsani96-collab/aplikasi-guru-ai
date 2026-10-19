'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useAuthRole } from '@/hooks/useAuthRole' // Import custom hook role

export default function Navbar() {
  const pathname = usePathname()
  const router = useRouter()
  const [showAiModal, setShowAiModal] = useState(false)

  // Cek role pengguna
  const { isOperator } = useAuthRole()

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
      icon: '❤️',
      iconBg: 'bg-[#1e293b]',
      href: '/ai/kbc',
      highlight: false,
    },
    {
      title: 'Generator Perangkat Ajar AI',
      badge: 'AI Pro',
      badgeColor: 'bg-amber-400 text-slate-950 font-bold',
      desc: 'Buat RPP & ATP otomatis dengan AI',
      icon: '📄',
      iconBg: 'bg-amber-500 text-slate-950 font-bold',
      href: '/ai/perangkat',
      highlight: true,
    },
    {
      title: 'Modul Ajar AI',
      badge: 'Deep Learning',
      badgeColor: 'bg-amber-500/20 text-amber-400 border border-amber-500/30',
      desc: 'Susun Modul Ajar Deep Learning Kurikulum Merdeka',
      icon: '🪄',
      iconBg: 'bg-[#1e293b]',
      href: '/ai/deep-learning',
      highlight: false,
    },
    {
      title: 'Modul Kokurikuler AI',
      badge: 'Kokurikuler',
      badgeColor: 'bg-amber-500/20 text-amber-400 border border-amber-500/30',
      desc: 'Perencanaan kokurikuler lintas mapel & dimensi profil',
      icon: '🧭',
      iconBg: 'bg-[#1e293b]',
      href: '/ai/kokurikuler',
      highlight: false,
    },
    {
      title: 'Asisten Guru AI',
      badge: 'Chatbot',
      badgeColor: 'bg-amber-500/20 text-amber-400 border border-amber-500/30',
      desc: 'Tanya jawab & konsultasi materi mengajar',
      icon: '🤖',
      iconBg: 'bg-[#1e293b]',
      href: '/ai/chatbot',
      highlight: false,
    },
    {
      title: 'Generator LKPD AI',
      badge: 'LKPD',
      badgeColor: 'bg-amber-500/20 text-amber-400 border border-amber-500/30',
      desc: 'Buat Lembar Kerja Peserta Didik interaktif',
      icon: '✨',
      iconBg: 'bg-[#1e293b]',
      href: '/ai/lkpd',
      highlight: false,
    },
    {
      title: 'Generator Soal AI',
      badge: 'Ujian',
      badgeColor: 'bg-amber-500/20 text-amber-400 border border-amber-500/30',
      desc: 'Naskah Soal Ujian, LJS, dan Kunci Jawaban Siap Cetak',
      icon: '❓',
      iconBg: 'bg-[#1e293b]',
      href: '/ai/soal',
      highlight: false,
    },
    {
      title: 'Generator AI Lainnya',
      badge: 'Multi-Tool',
      badgeColor: 'bg-amber-500/20 text-amber-400 border border-amber-500/30',
      desc: 'Generator Soal, Silabus, Rubrik Asesmen & Media',
      icon: '🌐',
      iconBg: 'bg-[#1e293b]',
      href: '/ai/multi',
      highlight: false,
    },
  ]

  const handleSelectTool = (href: string) => {
    setShowAiModal(false)
    router.push(href)
  }

  return (
    <>
      {/* BOTTOM NAV DOCK */}
      <div className="border-t border-slate-800/80 bg-[#0d1322]/95 backdrop-blur-md fixed bottom-0 left-0 right-0 z-50">
        <div className="max-w-md mx-auto px-4 py-2.5 flex items-center justify-between">
          {/* 1. DASHBOARD (Semua Pengguna) */}
          <Link
            href="/"
            className={`flex flex-col items-center gap-1 text-xs font-medium transition ${
              pathname === '/' ? 'text-sky-400 font-bold' : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            <span className="text-lg">🕒</span>
            <span>Dashboard</span>
          </Link>

          {/* 2. SISWA (HANYA OPERATOR) */}
          {isOperator && (
            <Link
              href="/siswa"
              className={`flex flex-col items-center gap-1 text-xs font-medium transition ${
                pathname === '/siswa' ? 'text-sky-400 font-bold' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <span className="text-lg">👥</span>
              <span>Siswa</span>
            </Link>
          )}

          {/* 3. GURU (HANYA OPERATOR) */}
          {isOperator && (
            <Link
              href="/guru"
              className={`flex flex-col items-center gap-1 text-xs font-medium transition ${
                pathname === '/guru' ? 'text-sky-400 font-bold' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <span className="text-lg">👨‍🏫</span>
              <span>Guru</span>
            </Link>
          )}

          {/* 4. AKADEMIK (Semua Pengguna) */}
          <Link
            href="/jadwal"
            className={`flex flex-col items-center gap-1 text-xs font-medium transition ${
              isAkademikActive ? 'text-sky-400 font-bold' : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            <span className="text-lg">🎓</span>
            <span>Akademik</span>
          </Link>

          {/* 5. AI TOOLS (Semua Pengguna) */}
          <button
            type="button"
            onClick={() => setShowAiModal(true)}
            className={`flex flex-col items-center gap-1 text-xs font-medium transition ${
              showAiModal || pathname.startsWith('/ai')
                ? 'text-sky-400 font-bold'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            <span className="text-lg">✨</span>
            <span>AI Tools</span>
          </button>

          {/* 6. LAPORAN (Semua Pengguna) */}
          <Link
            href="/laporan"
            className={`flex flex-col items-center gap-1 text-xs font-medium transition ${
              pathname === '/laporan' ? 'text-sky-400 font-bold' : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            <span className="text-lg">🖨️</span>
            <span>Laporan</span>
          </Link>
        </div>

        {/* FOOTER TEXT */}
        <div className="bg-[#070a12] py-2 text-center text-[11px] text-slate-500 border-t border-slate-900 flex items-center justify-center gap-2">
          <span>Aplikasi Guru AI</span>
          <span>•</span>
          <span>Created by <strong className="text-slate-300 font-semibold">MUZAINI AL KAHFI</strong></span>
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
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 text-xl font-bold">
                  ✨
                </div>
                <div>
                  <h3 className="font-extrabold text-white text-base">Pilih Tool AI Lengkap</h3>
                  <p className="text-xs text-slate-400">Seluruh generator & kecerdasan buatan AI Pro</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowAiModal(false)}
                className="w-9 h-9 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center text-lg transition"
              >
                ✕
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
                    <div className={`w-11 h-11 rounded-2xl flex items-center justify-center text-xl shadow-md ${item.iconBg}`}>
                      {item.icon}
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

                  <span className="text-amber-500 font-bold text-lg group-hover:translate-x-1 transition pr-2">
                    ›
                  </span>
                </div>
              ))}
            </div>

          </div>
        </div>
      )}
    </>
  )
}