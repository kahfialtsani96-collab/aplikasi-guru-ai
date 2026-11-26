'use client'

import { useEffect, useRef } from 'react'
import { animate, stagger } from 'animejs'
import { animated, useSpring } from '@react-spring/web'
import { CalendarDays, ChevronRight } from 'lucide-react'

// Status kartu bulanan — wording sama dengan statusPeriode di halaman Honorarium.
export type StatusKartu = 'PAID' | 'DISAHKAN YAYASAN' | 'DISAHKAN KEPSEK' | 'DRAFT' | 'BELUM DIHITUNG'

export interface BulanCardData {
  bulan: string // '01'..'12'
  label: string // 'Januari'..'Desember'
  status: StatusKartu
  totalJp: number | null // null = belum ada data
  totalTransport: number | null
  totalBersih: number | null
  totalKotor: number | null
  jumlahGuru: number
}

interface HonorBulanCardsProps {
  tahun: string
  tahunOptions: number[]
  onTahunChange: (tahun: string) => void
  cards: BulanCardData[]
  selectedBulan: string
  onSelect: (bulan: string) => void
  isDarkMode: boolean
  isPersonal: boolean
}

function formatRupiah(n: number) {
  const v = Number.isFinite(n) ? n : 0
  return 'Rp ' + Math.round(v).toLocaleString('id-ID')
}

const STATUS_TAMPILAN: Record<StatusKartu, { label: string; chip: string; bar: string }> = {
  PAID: {
    label: 'PAID',
    chip: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/40',
    bar: 'bg-emerald-500',
  },
  'DISAHKAN YAYASAN': {
    label: 'DISAHKAN YAYASAN',
    chip: 'bg-amber-500/15 text-amber-400 border border-amber-500/40',
    bar: 'bg-amber-500',
  },
  'DISAHKAN KEPSEK': {
    label: 'DISAHKAN KEPSEK',
    chip: 'bg-amber-500/15 text-amber-400 border border-amber-500/40',
    bar: 'bg-amber-500',
  },
  DRAFT: {
    label: 'DRAFT',
    chip: 'bg-amber-500/15 text-amber-400 border border-amber-500/40',
    bar: 'bg-amber-500',
  },
  'BELUM DIHITUNG': {
    label: 'Belum Dihitung',
    chip: 'bg-slate-500/15 text-slate-400 border border-slate-500/40',
    bar: 'bg-slate-400',
  },
}

function BulanCard({
  data,
  nomor,
  selected,
  isDarkMode,
  isPersonal,
  onSelect,
}: {
  data: BulanCardData
  nomor: number
  selected: boolean
  isDarkMode: boolean
  isPersonal: boolean
  onSelect: (bulan: string) => void
}) {
  // React Spring: kartu terpilih membesar halus (spring) saat bulan dipilih.
  const spring = useSpring({
    scale: selected ? 1.04 : 1,
    config: { tension: 320, friction: 18 },
  })
  const st = STATUS_TAMPILAN[data.status]
  const ada = data.status !== 'BELUM DIHITUNG'
  return (
    <div className="kartu-bulan-honor h-full">
      <animated.button
        type="button"
        onClick={() => onSelect(data.bulan)}
        style={spring}
        aria-pressed={selected}
        className={`relative w-full h-full text-left rounded-2xl border p-3 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 ${
          selected
            ? isDarkMode
              ? 'border-indigo-400 ring-2 ring-indigo-400/60 shadow-lg shadow-indigo-500/20 bg-slate-900'
              : 'border-indigo-500 ring-2 ring-indigo-500/50 shadow-lg shadow-indigo-500/20 bg-white'
            : isDarkMode
              ? 'border-slate-800 bg-slate-900 hover:border-slate-600'
              : 'border-slate-300 bg-white hover:border-slate-400'
        }`}
      >
        <span className={`absolute left-0 top-3 bottom-3 w-1 rounded-full ${st.bar}`} aria-hidden />
        <span className="pl-2 flex items-center gap-2">
          <span className={`flex items-center justify-center w-6 h-6 rounded-lg text-[11px] font-black shrink-0 ${isDarkMode ? 'bg-slate-800 text-indigo-300' : 'bg-indigo-50 text-indigo-700'}`}>
            {nomor}
          </span>
          <span className={`text-sm font-extrabold uppercase tracking-wide ${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>
            {data.label}
          </span>
        </span>
        <span className={`pl-2 mt-1.5 inline-flex text-[9px] font-black px-2 py-0.5 rounded-full ${st.chip}`}>
          {st.label}
        </span>
        <span className={`pl-2 block mt-1.5 space-y-0.5 text-[11px] font-bold ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
          <span className="block">{isPersonal ? 'JP Saya' : 'Total JP'}: {ada && data.totalJp != null ? data.totalJp : '–'}</span>
          <span className="block">Transport: {ada && data.totalTransport != null ? `${data.totalTransport} hari` : '–'}</span>
          <span className="block">{isPersonal ? 'Honor Saya' : 'Total Honor'}: {ada && data.totalBersih != null ? formatRupiah(data.totalBersih) : '–'}</span>
        </span>
        <span className={`pl-2 mt-2.5 inline-flex items-center gap-1 text-[10px] font-black ${isDarkMode ? 'text-indigo-300' : 'text-indigo-700'}`}>
          Lihat Rincian <ChevronRight className="w-3.5 h-3.5" />
        </span>
      </animated.button>
    </div>
  )
}

export default function HonorBulanCards({
  tahun,
  tahunOptions,
  onTahunChange,
  cards,
  selectedBulan,
  onSelect,
  isDarkMode,
  isPersonal,
}: HonorBulanCardsProps) {
  const gridRef = useRef<HTMLDivElement>(null)

  // Anime.js: kartu masuk berurutan (stagger) saat grid tampil / tahun berganti.
  useEffect(() => {
    const root = gridRef.current
    if (!root) return
    const anim = animate(root.querySelectorAll('.kartu-bulan-honor'), {
      opacity: [0, 1],
      y: [16, 0],
      duration: 450,
      delay: stagger(45),
      ease: 'outQuad',
    })
    return () => {
      anim.revert()
    }
  }, [tahun])

  return (
    <div className={`border rounded-2xl p-3 space-y-3 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-300'}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-xs font-extrabold flex items-center gap-1.5 text-indigo-400">
          <CalendarDays className="w-4 h-4" /> Kartu Bulanan Honorarium
        </h3>
        <label className={`flex items-center gap-1.5 text-[11px] font-bold ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
          Tahun
          <select
            value={tahun}
            onChange={(e) => onTahunChange(e.target.value)}
            className={`border rounded-lg px-2 py-1 text-xs font-bold focus:outline-none cursor-pointer ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'}`}
          >
            {tahunOptions.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </label>
      </div>
      <div ref={gridRef} className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
        {cards.map((c, i) => (
          <BulanCard
            key={c.bulan}
            data={c}
            nomor={i + 1}
            selected={c.bulan === selectedBulan}
            isDarkMode={isDarkMode}
            isPersonal={isPersonal}
            onSelect={onSelect}
          />
        ))}
      </div>
      <p className={`text-[10px] font-medium ${isDarkMode ? 'text-slate-500' : 'text-slate-500'}`}>
        Klik kartu untuk melihat rincian bulan tersebut. Bulan tanpa rekap tampil &ldquo;Belum Dihitung&rdquo; dan terisi otomatis setelah Tarik &amp; Hitung.
      </p>
    </div>
  )
}
