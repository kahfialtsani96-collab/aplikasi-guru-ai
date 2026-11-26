'use client'

import { useEffect, useRef, useState } from 'react'
import { animate, stagger } from 'animejs'
import { animated, useSpring } from '@react-spring/web'
import {
  BadgeCheck,
  CalendarDays,
  CalendarX,
  ChevronRight,
  Clock,
  type LucideIcon,
} from 'lucide-react'

// Status kartu bulanan — label tampilan kartu (DRAFT tampil 'Menunggu Validasi',
// PAID tampil 'Sudah Terbit'); nilai status internal tetap sama seperti statusPeriode
// di halaman Honorarium.
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

// Tampilan per status: chip + garis kiri + latar pastel translusen (terlihat di
// mode terang maupun gelap, seperti kartu Info GTK) + ikon status.
// Chip 'Menunggu Validasi' berdenyut lembut (animate-pulse) supaya menarik perhatian;
// 'Sudah Terbit' statis karena sudah selesai.
const STATUS_TAMPILAN: Record<
  StatusKartu,
  { label: string; chip: string; bar: string; tint: string; icon: LucideIcon; iconCls: string }
> = {
  PAID: {
    label: 'Sudah Terbit',
    chip: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/40',
    bar: 'bg-emerald-500',
    tint: 'bg-emerald-500/15 border-emerald-500/40',
    icon: BadgeCheck,
    iconCls: 'bg-emerald-500/20 text-emerald-500',
  },
  'DISAHKAN YAYASAN': {
    label: 'DISAHKAN YAYASAN',
    chip: 'bg-amber-500/15 text-amber-400 border border-amber-500/40',
    bar: 'bg-amber-500',
    tint: 'bg-amber-500/15 border-amber-500/40',
    icon: Clock,
    iconCls: 'bg-amber-500/20 text-amber-500',
  },
  'DISAHKAN KEPSEK': {
    label: 'DISAHKAN KEPSEK',
    chip: 'bg-amber-500/15 text-amber-400 border border-amber-500/40',
    bar: 'bg-amber-500',
    tint: 'bg-amber-500/15 border-amber-500/40',
    icon: Clock,
    iconCls: 'bg-amber-500/20 text-amber-500',
  },
  DRAFT: {
    label: 'Menunggu Validasi',
    chip: 'bg-amber-500/15 text-amber-400 border border-amber-500/40 animate-pulse',
    bar: 'bg-amber-500',
    tint: 'bg-amber-500/15 border-amber-500/40',
    icon: Clock,
    iconCls: 'bg-amber-500/20 text-amber-500',
  },
  'BELUM DIHITUNG': {
    label: 'Belum Dihitung',
    chip: 'bg-slate-500/15 text-slate-400 border border-slate-500/40',
    bar: 'bg-slate-400',
    tint: 'bg-slate-500/10 border-slate-500/30',
    icon: CalendarX,
    iconCls: 'bg-slate-500/20 text-slate-400',
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
  const [hover, setHover] = useState(false)
  // React Spring: kartu terpilih membesar halus; saat disentuh kartu terangkat.
  const spring = useSpring({
    scale: hover ? 1.05 : selected ? 1.03 : 1,
    y: hover ? -4 : 0,
    config: { tension: 350, friction: 20 },
  })
  const st = STATUS_TAMPILAN[data.status]
  const Icon = st.icon
  const ada = data.status !== 'BELUM DIHITUNG'
  return (
    <div className="kartu-bulan-honor h-full">
      <animated.button
        type="button"
        onClick={() => onSelect(data.bulan)}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        onFocus={() => setHover(true)}
        onBlur={() => setHover(false)}
        style={spring}
        aria-pressed={selected}
        className={`relative w-full h-full text-left rounded-2xl border p-3 cursor-pointer shadow-sm transition-shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 ${st.tint} ${
          selected
            ? 'ring-2 ring-indigo-400/80 shadow-xl shadow-indigo-500/30'
            : 'hover:shadow-xl'
        }`}
      >
        <span className={`absolute left-0 top-3 bottom-3 w-1 rounded-full ${st.bar}`} aria-hidden />
        <span className="pl-2 flex items-center gap-1.5">
          <span className={`flex items-center justify-center w-6 h-6 rounded-lg text-[11px] font-black shrink-0 ${isDarkMode ? 'bg-slate-800 text-indigo-300' : 'bg-indigo-50 text-indigo-700'}`}>
            {nomor}
          </span>
          <span className={`text-[13px] font-extrabold uppercase tracking-wide ${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>
            {data.label}
          </span>
          <span className={`ml-auto flex items-center justify-center w-6 h-6 rounded-full shrink-0 ${st.iconCls}`} aria-hidden>
            <Icon className="w-3.5 h-3.5" />
          </span>
        </span>
        <span className={`pl-2 mt-1.5 inline-flex text-[9px] font-black px-2 py-0.5 rounded-full ${st.chip}`}>
          {st.label}
        </span>
        <span className="pl-2 block mt-2">
          <span className={`block text-[10px] font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
            {isPersonal ? 'Honor Saya' : 'Total Honor'}
          </span>
          <span className={`block text-lg xl:text-xl font-black leading-tight ${ada && data.totalBersih != null ? (isDarkMode ? 'text-slate-100' : 'text-slate-900') : (isDarkMode ? 'text-slate-500' : 'text-slate-400')}`}>
            {ada && data.totalBersih != null ? formatRupiah(data.totalBersih) : '–'}
          </span>
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
    <div className={`border rounded-2xl p-3 space-y-3 ${isDarkMode ? 'bg-indigo-950 border-slate-800' : 'bg-indigo-50 border-slate-300'}`}>
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
      <div ref={gridRef} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
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
