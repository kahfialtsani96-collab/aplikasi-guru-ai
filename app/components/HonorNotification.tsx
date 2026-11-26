'use client'

import { useCallback, useEffect, useRef, useState, type TouchEvent } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { Bell, X, ChevronLeft, ChevronRight, Wallet } from 'lucide-react'
import { supabase } from '@/lib/supabase'

// Nama bulan Indonesia (sama seperti BLN_NAMES di app/honorarium/page.tsx)
const BLN_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
]

function formatRupiah(n: number) {
  const v = Number.isFinite(n) ? n : 0
  return 'Rp ' + Math.round(v).toLocaleString('id-ID')
}

const toNum = (v: unknown) => Number(v) || 0

// Potongan yang sudah dihitung saat rekap disimpan (app/honorarium/page.tsx:
// PotonganTerapan — `hasil` adalah rupiah yang dipotong, bukan persen mentah).
interface PotonganTerapan {
  nama: string
  tipe: 'nominal' | 'persen'
  nilai: number
  hasil: number
}

// Baris rekap honorarium milik guru yang login — kolom yang dipakai panel
// notifikasi saja (definisi lengkap: RekapRow di app/honorarium/page.tsx).
interface RekapRow {
  periode: string
  guru_id: number
  jumlah_jp: number
  transport_hari: number
  tunjangan_jabatan: number
  tunjangan_masa_kerja: number
  pembina: number
  wali_kelas: number
  tugas_tambahan: number
  piket: number
  potongan: PotonganTerapan[]
  total_potongan: number
  total_bersih: number
  status: 'DRAFT' | 'PAID'
}

interface PengaturanRow {
  tarif_jp: number
  tarif_transport_harian: number
}

const labelPeriode = (periode: string) => {
  const [y, m] = periode.split('-')
  const idx = Number(m) - 1
  return `${BLN_NAMES[idx] ?? m} ${y}`
}

// Total kotor = total_bersih + total_potongan (nilai tersimpan — sama seperti
// kotorOf() di app/honorarium/page.tsx, F9).
const kotorOf = (r: RekapRow) => toNum(r.total_bersih) + toNum(r.total_potongan)

function DetailRow({ label, value, strong = false, accent = false }: {
  label: string
  value: string
  strong?: boolean
  accent?: boolean
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <span className={strong ? 'font-bold' : 'opacity-80'}>{label}</span>
      <span className={`whitespace-nowrap tabular-nums ${strong ? 'font-black' : 'font-semibold'} ${accent ? 'text-emerald-400' : ''}`}>
        {value}
      </span>
    </div>
  )
}

/**
 * Notifikasi honorarium — kotak lonceng kecil di atas PixelBatSwitcher.
 *
 * Aturan tampil (disepakati Ketua, 26 Nov 2026):
 * - Muncul tanggal 27 ke atas, dan hanya bila ada honor guru yang login yang
 *   belum dibayarkan (bulan berjalan dan/atau rapel bulan sebelumnya).
 * - Hilang begitu semua honor sudah dibayarkan (status rekap PAID).
 * - Rapel: satu tab untuk tiap bulan — bulan berjalan (bila sudah ada baris
 *   rekapnya) + bulan-bulan sebelumnya yang masih belum dibayar, urut kronologis.
 * - Bila bulan berjalan belum ada baris rekapnya (belum dihitung admin),
 *   kotak hanya menampilkan tab rapel; bila tidak ada rapel sama sekali,
 *   kotak tidak muncul.
 */
export default function HonorNotification({ isDarkMode }: { isDarkMode: boolean }) {
  const [today, setToday] = useState<Date | null>(null)
  const [rows, setRows] = useState<RekapRow[]>([])
  const [pengaturan, setPengaturan] = useState<PengaturanRow | null>(null)
  const [open, setOpen] = useState(false)
  const [activeIdx, setActiveIdx] = useState(0)
  const touchRef = useRef<{ x: number; y: number } | null>(null)
  const activeInitRef = useRef(false)

  // Tanggal "hari ini" dihitung setelah mount — menghindari warning Next.js 16
  // "unstable value new Date()" pada Client Component (pola yang sama dipakai
  // app/honorarium/page.tsx untuk periode awal).
  useEffect(() => {
    setToday(new Date())
  }, [])

  // Muat baris rekap milik guru yang login + tarif dari honorarium_pengaturan
  // (pola yang sama seperti app/honorarium/page.tsx: auth.getUser() lalu
  // cocokkkan email ke tabel guru).
  useEffect(() => {
    let mounted = true
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user?.email) return
      const cleanEmail = user.email.trim().toLowerCase()
      const { data: guruRow } = await supabase
        .from('guru')
        .select('id')
        .ilike('email', cleanEmail)
        .maybeSingle()
      const guruId: number | null = guruRow?.id ?? null
      if (guruId == null) return
      const [rekapRes, pengRes] = await Promise.all([
        supabase
          .from('honorarium_rekap')
          .select('*')
          .eq('guru_id', guruId)
          .order('periode', { ascending: true }),
        supabase.from('honorarium_pengaturan').select('*').limit(1).maybeSingle(),
      ])
      if (!mounted) return
      setRows(((rekapRes.data || []) as RekapRow[]).map((r) => ({
        ...r,
        potongan: Array.isArray(r.potongan) ? (r.potongan as PotonganTerapan[]) : [],
      })))
      if (pengRes.data) setPengaturan(pengRes.data as PengaturanRow)
    }
    init()
    return () => { mounted = false }
  }, [])

  const currentPeriode = today
    ? `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
    : ''

  // Tab: bulan berjalan (bila sudah ada baris rekapnya, lunas ataupun belum)
  // + bulan-bulan sebelumnya yang masih belum dibayar (rapel).
  const tabs = rows
    .filter((r) => r.periode === currentPeriode || r.status !== 'PAID')
    .sort((a, b) => (a.periode < b.periode ? -1 : a.periode > b.periode ? 1 : 0))
  const unpaidCount = tabs.filter((r) => r.status !== 'PAID').length

  // Muncul tanggal 27 ke atas, hanya bila ada honor yang belum dibayar.
  const visible = today !== null && today.getDate() >= 27 && tabs.length > 0 && unpaidCount > 0

  // Tab aktif awal: bulan belum dibayar yang paling lama (rapel terlama) —
  // supaya tunggakan langsung terlihat saat panel dibuka.
  useEffect(() => {
    if (activeInitRef.current || tabs.length === 0) return
    activeInitRef.current = true
    const firstUnpaid = tabs.findIndex((r) => r.status !== 'PAID')
    setActiveIdx(firstUnpaid >= 0 ? firstUnpaid : 0)
  }, [tabs])

  const safeIdx = tabs.length === 0 ? 0 : Math.min(activeIdx, tabs.length - 1)
  const active = tabs[safeIdx]

  const goTo = useCallback((idx: number) => {
    if (tabs.length === 0) return
    setActiveIdx(((idx % tabs.length) + tabs.length) % tabs.length)
  }, [tabs.length])
  const prevMonth = useCallback(() => goTo(safeIdx - 1), [goTo, safeIdx])
  const nextMonth = useCallback(() => goTo(safeIdx + 1), [goTo, safeIdx])

  // Kunci scroll halaman selama panel terbuka + tutup dengan Escape.
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [open ])

  // Usap kiri/kanan di panel untuk ganti bulan (ambang 50px, dominan horizontal).
  const onTouchStart = (e: TouchEvent) => {
    const t = e.touches[0]
    touchRef.current = { x: t.clientX, y: t.clientY }
  }
  const onTouchEnd = (e: TouchEvent) => {
    const s = touchRef.current
    touchRef.current = null
    if (!s) return
    const t = e.changedTouches[0]
    const dx = t.clientX - s.x
    const dy = t.clientY - s.y
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
      if (dx < 0) nextMonth()
      else prevMonth()
    }
  }

  if (!visible || !active) return null

  const tarifJp = toNum(pengaturan?.tarif_jp)
  const tarifTransport = toNum(pengaturan?.tarif_transport_harian)
  const isPaid = active.status === 'PAID'
  const isRapel = !isPaid && active.periode < currentPeriode
  const hasOtherUnpaid = tabs.some((r, i) => i !== safeIdx && r.status !== 'PAID')
  const potonganAktif = active.potongan.filter((p) => toNum(p.hasil) > 0)

  return (
    <>
      {/* Kotak lonceng 56x56 tepat di atas kelelawar: kelelawar fixed
          bottom-20 (80px) + tinggi ±70px, jadi kotak duduk di bottom 162px
          (jarak 12px di atas kelelawar). */}
      <motion.button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? 'Tutup notifikasi honor' : 'Buka notifikasi honor'}
        aria-expanded={open}
        initial={{ scale: 0, y: 16, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 18 }}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.94 }}
        className="group fixed left-3 sm:left-5 bottom-[162px] z-50 flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-400/60 bg-slate-900/95 text-amber-300 shadow-lg shadow-black/40 backdrop-blur focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
      >
        <Bell className="ikon-denyut h-6 w-6" />
        <span className="absolute -right-1.5 -top-1.5 flex h-6 min-w-6 items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-black text-white ring-2 ring-slate-900">
          <span className="absolute inset-0 rounded-full bg-red-500 animate-ping opacity-60" aria-hidden />
          <span className="relative">{unpaidCount}</span>
        </span>
      </motion.button>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              key="honor-backdrop"
              className="fixed inset-0 z-[55] bg-black/50"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
              aria-hidden
            />
            <motion.div
              key="honor-panel"
              role="dialog"
              aria-label={`Notifikasi honor ${labelPeriode(active.periode)}`}
              className={`fixed inset-x-2 bottom-2 z-[60] max-h-[calc(100dvh-16px)] overflow-y-auto overscroll-contain rounded-2xl border p-4 shadow-2xl sm:inset-x-auto sm:left-3 sm:bottom-[230px] sm:w-[340px] sm:max-h-[calc(100dvh-260px)] ${
                isDarkMode
                  ? 'border-slate-700 bg-slate-900 text-slate-100'
                  : 'border-slate-300 bg-white text-slate-800'
              }`}
              initial={{ opacity: 0, y: 24, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 24, scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 300, damping: 28 }}
              onTouchStart={onTouchStart}
              onTouchEnd={onTouchEnd}
            >
              {/* Kepala panel: bulan + status + tutup */}
              <div className="flex items-center justify-between gap-2">
                <span className="text-base font-black">{labelPeriode(active.periode)}</span>
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wide ${
                    isPaid
                      ? 'bg-emerald-500/15 text-emerald-400'
                      : 'bg-amber-500/15 text-amber-400'
                  }`}>
                    {isPaid ? 'Sudah dibayar' : isRapel ? 'Belum dibayar · Rapel' : 'Belum dibayar'}
                  </span>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    aria-label="Tutup"
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition active:scale-95 ${
                      isDarkMode ? 'hover:bg-slate-800 text-slate-300' : 'hover:bg-slate-100 text-slate-600'
                    }`}
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>

              <p className="mt-1 text-xs opacity-70">
                {isPaid
                  ? `Honor ${labelPeriode(active.periode)} sudah dibayarkan.`
                  : isRapel
                    ? `Honor ${labelPeriode(active.periode)} belum dibayarkan.`
                    : `Honor ${labelPeriode(active.periode)} sudah bisa dicek.`}
              </p>

              {/* Rincian honor bulan aktif */}
              <div className="mt-3 space-y-1.5">
                <DetailRow
                  label="Jam Pelajaran"
                  value={formatRupiah(toNum(active.jumlah_jp) * tarifJp)}
                />
                <p className="-mt-1 text-[11px] opacity-60">
                  {toNum(active.jumlah_jp)} JP × {formatRupiah(tarifJp)}
                </p>
                <DetailRow
                  label="Transport"
                  value={formatRupiah(toNum(active.transport_hari) * tarifTransport)}
                />
                <p className="-mt-1 text-[11px] opacity-60">
                  {toNum(active.transport_hari)} hari × {formatRupiah(tarifTransport)}
                </p>
                {toNum(active.tunjangan_jabatan) > 0 && (
                  <DetailRow label="Tunjangan Jabatan" value={formatRupiah(active.tunjangan_jabatan)} />
                )}
                {toNum(active.tunjangan_masa_kerja) > 0 && (
                  <DetailRow label="Masa Kerja" value={formatRupiah(active.tunjangan_masa_kerja)} />
                )}
                {toNum(active.pembina) > 0 && (
                  <DetailRow label="Pembina" value={formatRupiah(active.pembina)} />
                )}
                {toNum(active.wali_kelas) > 0 && (
                  <DetailRow label="Wali Kelas" value={formatRupiah(active.wali_kelas)} />
                )}
                {toNum(active.tugas_tambahan) > 0 && (
                  <DetailRow label="Tugas Tambahan" value={formatRupiah(active.tugas_tambahan)} />
                )}
                {toNum(active.piket) > 0 && (
                  <DetailRow label="Piket" value={formatRupiah(active.piket)} />
                )}
                <div className={`my-2 border-t ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}`} />
                <DetailRow label="Total Kotor" value={formatRupiah(kotorOf(active))} strong />
                {potonganAktif.map((p, i) => (
                  <DetailRow
                    key={`${p.nama}-${i}`}
                    label={p.tipe === 'persen' ? `${p.nama} (${toNum(p.nilai)}%)` : p.nama}
                    value={`− ${formatRupiah(p.hasil)}`}
                  />
                ))}
                <DetailRow label="Total Potongan" value={`− ${formatRupiah(active.total_potongan)}`} />
                <div className={`my-2 border-t ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}`} />
                <DetailRow label="Diterima" value={formatRupiah(active.total_bersih)} strong accent />
              </div>

              {/* Navigasi bulan: panah + titik */}
              <div className="mt-4 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={prevMonth}
                  aria-label="Bulan sebelumnya"
                  disabled={tabs.length <= 1}
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border transition active:scale-95 disabled:opacity-30 ${
                    isDarkMode
                      ? 'border-slate-700 hover:bg-slate-800 text-slate-200'
                      : 'border-slate-300 hover:bg-slate-100 text-slate-700'
                  }`}
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <div className="flex items-center justify-center gap-1" role="tablist" aria-label="Pilih bulan">
                  {tabs.map((t, i) => (
                    <button
                      key={t.periode}
                      type="button"
                      role="tab"
                      aria-selected={i === safeIdx}
                      aria-label={labelPeriode(t.periode)}
                      onClick={() => setActiveIdx(i)}
                      className="flex h-9 w-9 items-center justify-center"
                    >
                      <span
                        className={`block h-2.5 w-2.5 rounded-full transition ${
                          t.status === 'PAID' ? 'bg-emerald-500' : 'bg-red-500'
                        } ${i === safeIdx ? 'ring-2 ring-offset-2 ring-slate-400 scale-125' : 'opacity-70'}`}
                      />
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={nextMonth}
                  aria-label="Bulan berikutnya"
                  disabled={tabs.length <= 1}
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border transition active:scale-95 disabled:opacity-30 ${
                    isDarkMode
                      ? 'border-slate-700 hover:bg-slate-800 text-slate-200'
                      : 'border-slate-300 hover:bg-slate-100 text-slate-700'
                  }`}
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>

              {hasOtherUnpaid && (
                <p className="mt-2 text-center text-[11px] font-semibold text-amber-400">
                  Masih ada {unpaidCount} bulan belum dibayar.
                </p>
              )}

              <Link
                href="/honorarium"
                onClick={() => setOpen(false)}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-amber-400 px-4 py-3 text-sm font-black text-slate-950 shadow-md transition hover:bg-amber-300 active:scale-[0.98]"
              >
                <Wallet className="h-4 w-4" />
                Buka Halaman Honor
              </Link>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
