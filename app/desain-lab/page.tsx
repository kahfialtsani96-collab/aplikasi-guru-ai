'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  FlaskConical,
  Users,
  GraduationCap,
  ClipboardCheck,
  CalendarDays,
  Save,
  Printer,
  FileDown,
  Search,
  RotateCcw,
  CheckCircle2,
  Eye,
} from 'lucide-react'
import { useDarkMode } from '@/hooks/useDarkMode'
import { sortKelas } from '@/lib/utils'
import DarkModeToggle from '@/app/components/DarkModeToggle'

/* ============================================================================
   HALAMAN EXPERIMENT: DESAIN LAB (/desain-lab)
   ----------------------------------------------------------------------------
   Versi ini menerapkan sistem desain dari DESIGN.md (tema "Apple"):
     - Palet: Action Blue #0066cc sebagai SATU-SATUNYA aksen interaktif.
       Kanvas putih + pergamen (#f5f5f7) untuk ritme permukaan; tile hitam
       senja (#272729/#2a2a2c/#252527) untuk mode gelap.
     - Tipografi: headline gaya display (semibold 600 + negative tracking),
       body ~17px/400 dengan leading longgar, caption 600 untuk judul tabel.
     - Komponen: pill (rounded-full) untuk aksi primer/sekunder, rounded-lg
       untuk kartu utility, tombol tekan active:scale(0.98).
     - Aturan DESIGN.md: TANPA gradient dekoratif, TANPA shadow pada chrome/
       kartu/tombol (shadow khusus untuk photography). Setiap elemen
       interaktif memakai Action Blue.
     - Tombol dark/light tetap berfungsi via useDarkMode() + localStorage.
   ========================================================================== */

// ---------- DATA DUMMY ----------
// Daftar kelas dummy (SMP + SMK). Ditampilkan via sortKelas agar urut benar.
const DUMMY_KELAS = [
  { id: 1, nama: 'IX B' },
  { id: 2, nama: 'VII A' },
  { id: 3, nama: 'X DKV' },
  { id: 4, nama: 'VIII C' },
  { id: 5, nama: 'XI DKV' },
  { id: 6, nama: 'VIII A' },
  { id: 7, nama: 'XII DKV' },
  { id: 8, nama: 'IX A' },
  { id: 9, nama: 'VII B' },
]

// Kartu ringkasan statistik (dummy).
const DUMMY_STATS = [
  {
    label: 'Total Siswa',
    value: '512',
    sub: 'SMP 287 · SMK 225',
    icon: Users,
  },
  {
    label: 'Total Guru',
    value: '38',
    sub: 'Honorer 24 · PNS 14',
    icon: GraduationCap,
  },
  {
    label: 'Persentase Hadir',
    value: '94,2%',
    sub: 'Hari ini · 20 Nov 2026',
    icon: ClipboardCheck,
  },
]

// Baris contoh tabel jadwal/absensi (dummy).
const DUMMY_ROWS = [
  { no: 1, nama: 'Ahmad Fauzi', kelas: 'VIII C', jam: 'Jam Ke-1', mapel: 'Matematika', status: 'Hadir', ket: 'Tepat waktu' },
  { no: 2, nama: 'Bella Safitri', kelas: 'VIII C', jam: 'Jam Ke-1', mapel: 'Matematika', status: 'Hadir', ket: '-' },
  { no: 3, nama: 'Chandra Wijaya', kelas: 'VIII C', jam: 'Jam Ke-1', mapel: 'Matematika', status: 'Sakit', ket: 'Surat dokter' },
  { no: 4, nama: 'Dewi Lestari', kelas: 'VIII C', jam: 'Jam Ke-2', mapel: 'Bahasa Indonesia', status: 'Hadir', ket: '-' },
  { no: 5, nama: 'Eko Prasetyo', kelas: 'VIII C', jam: 'Jam Ke-2', mapel: 'Bahasa Indonesia', status: 'Alpa', ket: 'Tanpa keterangan' },
  { no: 6, nama: 'Fajar Ramadhan', kelas: 'VIII C', jam: 'Jam Ke-2', mapel: 'Bahasa Indonesia', status: 'Hadir', ket: '-' },
]

// Kode warna status kehadiran (dark / light). Warna ini SEMANTIK data
// (bukan aksen brand) — tetap memakai chip transparan ala Apple.
const STATUS_STYLE: Record<string, [string, string]> = {
  Hadir: ['bg-emerald-400/10 border-emerald-400/30 text-emerald-300', 'bg-emerald-50 border-emerald-200 text-emerald-700'],
  Izin: ['bg-amber-400/10 border-amber-400/30 text-amber-300', 'bg-amber-50 border-amber-200 text-amber-700'],
  Sakit: ['bg-sky-400/10 border-sky-400/30 text-sky-300', 'bg-sky-50 border-sky-200 text-sky-700'],
  Alpa: ['bg-rose-400/10 border-rose-400/30 text-rose-300', 'bg-rose-50 border-rose-200 text-rose-700'],
}

export default function DesainLabPage() {
  const { isDarkMode } = useDarkMode()

  // Filter state
  const [selectedKelas, setSelectedKelas] = useState<string>('')
  const [selectedTanggal, setSelectedTanggal] = useState<string>('2026-11-20')

  // Feedback state (simulasi aksi tombol)
  const [toast, setToast] = useState<string | null>(null)

  // Kelas terurut benar (VII → XII) via helper terpusat.
  const sortedKelas = useMemo(() => sortKelas(DUMMY_KELAS), [])

  // Contoh tabel: filter berdasarkan kelas terpilih.
  const tableRows = useMemo(() => {
    if (!selectedKelas) return DUMMY_ROWS
    return DUMMY_ROWS.filter((r) => r.kelas === selectedKelas)
  }, [selectedKelas])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 2400)
    return () => clearTimeout(t)
  }, [toast])

  const handleSimpan = () => setToast('Data tersimpan (contoh).')
  const handleCetak = () => setToast('Dokumen dikirim ke printer (contoh).')
  const handleExport = () => setToast('File diekspor (contoh).')
  const handleReset = () => {
    setSelectedKelas('')
    setSelectedTanggal('2026-11-20')
    setToast('Filter direset.')
  }

  // ---------- Token desain (diturunkan dari DESIGN.md) ----------
  // Aksen tunggal Action Blue — satu-satunya warna "klik di sini".
  const primaryText = isDarkMode ? 'text-[#2997ff]' : 'text-[#0066cc]'
  // Tombol primer: pill, aksen biru, tekan scale(0.98).
  const primaryBtn = isDarkMode
    ? 'bg-[#2997ff] text-[#1d1d1f] hover:bg-[#0a84ff]'
    : 'bg-[#0066cc] text-white hover:bg-[#0071e3]'
  // Permukaan kartu: alternatif kanvas putih / pergamen (gelap: tile).
  const surface = (alt: boolean) =>
    isDarkMode
      ? alt ? 'bg-[#2a2a2c]' : 'bg-[#272729]'
      : alt ? 'bg-[#f5f5f7]' : 'bg-white'
  // Hairline border (tidak memakai shadow pada chrome).
  const hairline = isDarkMode ? 'border-white/10' : 'border-black/[0.06]'
  // Teks sekunder pasif.
  const mutedText = isDarkMode ? 'text-[#cccccc]' : 'text-[#7a7a7a]'
  // Teks utama (ink).
  const inkText = isDarkMode ? 'text-white' : 'text-[#1d1d1f]'

  return (
    <div
      className={`min-h-screen font-sans transition-colors duration-300 flex flex-col ${isDarkMode ? 'bg-[#252527]' : 'bg-[#f5f5f7]'}`}
    >
      <header
        className={`sticky top-0 z-30 border-b px-4 sm:px-6 py-3 flex items-center justify-between gap-3 ${hairline} transition-colors duration-300 ${isDarkMode ? 'bg-[#272729]' : 'bg-white'}`}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-lg bg-[#0066cc] text-white flex items-center justify-center shrink-0">
            <FlaskConical className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div className="min-w-0">
            <h1 className={`text-base sm:text-lg font-semibold tracking-tight truncate ${inkText}`}>Desain Lab</h1>
            <p className={`text-[11px] truncate ${mutedText}`}>
              Eksperimen tampilan · Data dummy · Jangan dipakai produksi
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span
            className={`hidden md:inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full border ${
              isDarkMode
                ? 'bg-amber-400/10 border-amber-400/30 text-amber-300'
                : 'bg-amber-50 border-amber-200 text-amber-700'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            Rute rahasia
          </span>

          <Link
            href="/"
            className={`hidden sm:inline-flex items-center gap-1 text-[11px] font-medium px-3 py-1.5 rounded-full border transition active:scale-[0.98] ${
              isDarkMode
                ? 'bg-[#1f1f21] border-white/10 hover:bg-white/5'
                : 'bg-[#f5f5f7] border-black/[0.08] hover:bg-black/[0.03]'
            } ${primaryText}`}
          >
            <Eye className="w-3.5 h-3.5" /> Dashboard
          </Link>

          <DarkModeToggle />
        </div>
      </header>

      <main className="w-full max-w-6xl mx-auto p-3 sm:p-5 flex-1 flex flex-col gap-4">
        {/* ---- 3 KARTU RINGKASAN STATISTIK ---- */}
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          {DUMMY_STATS.map((s, i) => {
            const Icon = s.icon
            return (
              <div
                key={s.label}
                className={`rounded-lg border ${hairline} p-4 sm:p-5 flex items-center gap-3 sm:gap-4 transition ${surface(i % 2 === 1)}`}
              >
                <div
                  className={`w-10 h-10 sm:w-12 sm:h-12 rounded-lg border flex items-center justify-center shrink-0 ${hairline} ${
                    isDarkMode ? 'bg-[#1f1f21]' : 'bg-[#f5f5f7]'
                  } ${primaryText}`}
                >
                  <Icon className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
                <div className="min-w-0">
                  <p className={`text-[11px] font-medium uppercase tracking-wider truncate ${mutedText}`}>
                    {s.label}
                  </p>
                  <p className={`text-2xl sm:text-3xl font-semibold leading-tight tracking-tight truncate ${inkText}`}>
                    {s.value}
                  </p>
                  <p className={`text-[11px] truncate ${mutedText}`}>{s.sub}</p>
                </div>
              </div>
            )
          })}
        </section>
        {/* ---- BAR FILTER + TOMBOL AKSI ---- */}
        <section
          className={`rounded-lg border ${hairline} p-3 sm:p-4 flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between ${surface(false)}`}
        >
          {/* Filter: pilih kelas & tanggal */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 flex-1 min-w-0">
            <label className="flex flex-col gap-1 min-w-0">
              <span className={`text-[10px] font-semibold uppercase tracking-wider ${mutedText}`}>
                Kelas
              </span>
              <div className="relative">
                <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none ${mutedText}`} />
                <select
                  value={selectedKelas}
                  onChange={(e) => setSelectedKelas(e.target.value)}
                  className={`w-full h-10 rounded-full border pl-8 pr-3 text-sm font-medium focus:outline-none focus:ring-2 transition ${
                    isDarkMode
                      ? 'bg-[#1f1f21] border-white/10 text-white focus:ring-[#2997ff]/40'
                      : 'bg-[#f5f5f7] border-black/[0.08] text-[#1d1d1f] focus:ring-[#0066cc]/40'
                  }`}
                >
                  <option value="">Semua Kelas</option>
                  {sortedKelas.map((k) => (
                    <option key={k.id} value={k.nama}>
                      {k.nama}
                    </option>
                  ))}
                </select>
              </div>
            </label>

            <label className="flex flex-col gap-1 min-w-0">
              <span className={`text-[10px] font-semibold uppercase tracking-wider ${mutedText}`}>
                Tanggal
              </span>
              <div className="relative">
                <CalendarDays className={`absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none ${mutedText}`} />
                <input
                  type="date"
                  value={selectedTanggal}
                  onChange={(e) => setSelectedTanggal(e.target.value)}
                  className={`w-full h-10 rounded-full border pl-8 pr-3 text-sm font-medium focus:outline-none focus:ring-2 transition ${
                    isDarkMode
                      ? 'bg-[#1f1f21] border-white/10 text-white [color-scheme:dark] focus:ring-[#2997ff]/40'
                      : 'bg-[#f5f5f7] border-black/[0.08] text-[#1d1d1f] focus:ring-[#0066cc]/40'
                  }`}
                />
              </div>
            </label>
          </div>

          {/* Tombol aksi: Simpan, Cetak, Export */}
          <div className="flex flex-wrap gap-2 items-center justify-start lg:justify-end">
            <button
              onClick={handleSimpan}
              className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition cursor-pointer active:scale-[0.98] ${primaryBtn}`}
            >
              <Save className="w-3.5 h-3.5" /> Simpan
            </button>
            <button
              onClick={handleCetak}
              className={`inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-medium transition cursor-pointer active:scale-[0.98] ${hairline} ${surface(true)} ${primaryText}`}
            >
              <Printer className="w-3.5 h-3.5" /> Cetak
            </button>
            <button
              onClick={handleExport}
              className={`inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-medium transition cursor-pointer active:scale-[0.98] ${hairline} ${surface(true)} ${primaryText}`}
            >
              <FileDown className="w-3.5 h-3.5" /> Export
            </button>
            <button
              onClick={handleReset}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium transition cursor-pointer active:scale-[0.98] ${primaryText} hover:opacity-80`}
              title="Reset filter"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Reset
            </button>
          </div>
        </section>

        {/* ---- TABEL JADWAL / ABSENSI (CONTOH) ---- */}
        <section
          className={`rounded-lg border ${hairline} overflow-hidden ${surface(false)}`}
        >
          <div
            className={`px-4 py-3 border-b flex items-center justify-between gap-2 ${hairline} ${
              isDarkMode ? 'bg-[#1f1f21]' : 'bg-[#f5f5f7]'
            }`}
          >
            <div className="flex items-center gap-2 min-w-0">
              <ClipboardCheck className={`w-4 h-4 shrink-0 ${primaryText}`} />
              <div className="min-w-0">
                <h2 className={`text-sm font-semibold tracking-tight truncate ${inkText}`}>Tabel Contoh — Rekap Absensi</h2>
                <p className={`text-[11px] truncate ${mutedText}`}>
                  Kelas {selectedKelas || 'VIII C'} · {selectedTanggal}
                </p>
              </div>
            </div>
            <span
              className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border shrink-0 ${
                isDarkMode
                  ? 'bg-[#2997ff]/10 border-[#2997ff]/30 text-[#2997ff]'
                  : 'bg-[#0066cc]/10 border-[#0066cc]/30 text-[#0066cc]'
              }`}
            >
              {tableRows.length} baris
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr
                  className={`uppercase text-[10px] tracking-wider font-semibold ${
                    isDarkMode ? 'bg-[#2a2a2c] text-[#cccccc]' : 'bg-[#f5f5f7] text-[#333333]'
                  }`}
                >
                  <th className="px-4 py-2.5 font-semibold">No</th>
                  <th className="px-4 py-2.5 font-semibold">Nama Siswa</th>
                  <th className="px-4 py-2.5 font-semibold hidden sm:table-cell">Kelas</th>
                  <th className="px-4 py-2.5 font-semibold hidden md:table-cell">Jam</th>
                  <th className="px-4 py-2.5 font-semibold hidden md:table-cell">Mapel</th>
                  <th className="px-4 py-2.5 font-semibold">Status</th>
                  <th className="px-4 py-2.5 font-semibold hidden lg:table-cell">Keterangan</th>
                </tr>
              </thead>
              <tbody>
                {tableRows.map((r) => {
                  const [darkStyle, lightStyle] = STATUS_STYLE[r.status] || STATUS_STYLE.Hadir
                  return (
                    <tr
                      key={r.no}
                      className={`border-t ${hairline} transition ${isDarkMode ? 'hover:bg-white/5' : 'hover:bg-black/[0.02]'}`}
                    >
                      <td className={`px-4 py-2.5 ${mutedText}`}>{r.no}</td>
                      <td className={`px-4 py-2.5 font-medium ${inkText}`}>{r.nama}</td>
                      <td className={`px-4 py-2.5 hidden sm:table-cell ${inkText}`}>{r.kelas}</td>
                      <td className={`px-4 py-2.5 hidden md:table-cell ${inkText}`}>{r.jam}</td>
                      <td className={`px-4 py-2.5 hidden md:table-cell ${inkText}`}>{r.mapel}</td>
                      <td className="px-4 py-2.5">
                        <span
                          className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${isDarkMode ? darkStyle : lightStyle}`}
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-current" />
                          {r.status}
                        </span>
                      </td>
                      <td className={`px-4 py-2.5 hidden lg:table-cell ${mutedText}`}>{r.ket}</td>
                    </tr>
                  )
                })}
                {tableRows.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center font-medium">
                      Tidak ada data untuk kelas «{selectedKelas}» pada {selectedTanggal}.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Catatan eksperimen */}
        <p className={`text-center text-[10px] leading-relaxed ${mutedText}`}>
          Halaman ini adalah eksperimen tampilan dengan data dummy. Tidak terhubung ke Navbar — hanya bisa diakses via URL{' '}
          <code
            className={`px-1.5 py-0.5 rounded border text-[10px] font-mono ${hairline} ${
              isDarkMode ? 'bg-[#1f1f21]' : 'bg-[#f5f5f7]'
            }`}
          >
            /desain-lab
          </code>{' '}
          . Elemen di sini bukan data nyata dari Supabase.
        </p>
      </main>

      {/* ================= TOAST FEEDBACK ================= */}
      {toast && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50">
          <div
            className={`flex items-center gap-2 px-4 py-2.5 rounded-full border text-sm font-medium ${hairline} ${surface(false)}`}
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            {toast}
          </div>
        </div>
      )}
    </div>
  )
}
