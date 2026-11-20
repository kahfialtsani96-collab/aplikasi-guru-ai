'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useAuthRole } from '@/hooks/useAuthRole'
import { useDarkMode } from '@/hooks/useDarkMode'
import {
  ChevronLeft,
  ChevronRight,
  Save,
  Sparkles,
  Info,
  UserCheck,
  BookOpen,
  X,
  Check,
  Eraser,
  MousePointerClick,
} from 'lucide-react'

// Helper Instansiasi Aman Supabase Client (mencegah error prerender/SSG Vercel)
const getSupabaseUrl = () =>
  (process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://kvrulbdvgxfrtmznpjnm.supabase.co')
    .replace(/['"]/g, '').trim()

const getSupabaseAnonKey = () =>
  (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder')
    .replace(/['"]/g, '').trim()

const supabase = createClient(getSupabaseUrl(), getSupabaseAnonKey())

const STATUS_ABSENSI_GURU = ['Hadir', 'Izin', 'Sakit', 'Tanpa Keterangan'] as const
type StatusGuru = (typeof STATUS_ABSENSI_GURU)[number]

const STATUS_CODE: Record<StatusGuru, string> = {
  'Hadir': 'H',
  'Izin': 'I',
  'Sakit': 'S',
  'Tanpa Keterangan': 'A',
}

const BULAN_NAMA = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
]

interface GuruRow {
  id: number
  email: string
  nama_lengkap: string
  nuptk: string
}

interface RekamGuru {
  id?: string | number
  tanggal: string
  guru_email: string
  nama_lengkap?: string | null
  status?: string
  keterangan?: string | null
  input_by?: string | null
}

interface CellEntry {
  status: StatusGuru
  keterangan: string
}

const cellKey = (guruId: number, iso: string) => `${guruId}_${iso}`

function formatNuptk(val: unknown): string {
  if (!val) return '-'
  const str = String(val).trim()
  return str || '-'
}

interface HariBulan {
  day: number
  iso: string
  short: string
  weekend: boolean
}

function buildHariBulan(tahun: number, bulan: number): HariBulan[] {
  const total = new Date(tahun, bulan, 0).getDate()
  const arr: HariBulan[] = []
  for (let d = 1; d <= total; d++) {
    const dt = new Date(tahun, bulan - 1, d)
    const dow = dt.getDay()
    arr.push({
      day: d,
      iso: `${tahun}-${String(bulan).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
      short: ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'][dow],
      weekend: dow === 0 || dow === 6,
    })
  }
  return arr
}

function statusBadgeCls(st: StatusGuru): string {
  switch (st) {
    case 'Hadir':
      return 'bg-emerald-500 text-white shadow-[0_0_8px_rgba(16,185,129,0.45)]'
    case 'Izin':
      return 'bg-amber-400 text-slate-950'
    case 'Sakit':
      return 'bg-indigo-500 text-white'
    default:
      return 'bg-rose-500 text-white'
  }
}

export default function AbsensiGuruTab() {
  const { isOperator } = useAuthRole()
  const { isDarkMode } = useDarkMode()

  const now = new Date()
  const [tahun, setTahun] = useState(now.getFullYear())
  const [bulan, setBulan] = useState(now.getMonth() + 1)

  const [guruList, setGuruList] = useState<GuruRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ tipe: 'ok' | 'err'; pesan: string } | null>(null)
  const [currentEmail, setCurrentEmail] = useState('')

  // Entri matriks: key `${guruId}_${iso}` → status + keterangan
  const [entries, setEntries] = useState<Record<string, CellEntry>>({})
  // Key yang sudah tersimpan di database (untuk deteksi hapus saat dikosongkan)
  const [existingKeys, setExistingKeys] = useState<Set<string>>(new Set())
  // Indikator KBM: key `${guruEmail}_${iso}`
  const [kbmKeys, setKbmKeys] = useState<Set<string>>(new Set())

  // Popover sel aktif (khusus operator)
  const [activeCell, setActiveCell] = useState<{ guruId: number; iso: string } | null>(null)
  const [draftStatus, setDraftStatus] = useState<StatusGuru | ''>('')
  const [draftKeterangan, setDraftKeterangan] = useState('')

  const hariList = useMemo(() => buildHariBulan(tahun, bulan), [tahun, bulan])
  const startIso = `${tahun}-${String(bulan).padStart(2, '0')}-01`
  const endIso = `${tahun}-${String(bulan).padStart(2, '0')}-${String(hariList.length).padStart(2, '0')}`

  const showToast = (tipe: 'ok' | 'err', pesan: string) => {
    setToast({ tipe, pesan })
    window.setTimeout(() => setToast(null), 2800)
  }

  // Muat master guru (termasuk NUPTK)
  const loadGuru = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('guru')
        .select('id, email, nama_lengkap, NUPTK')
        .order('id', { ascending: true })
      const list = (data || [])
        .filter((g: any) => String(g.email || '').trim().length > 0)
        .map((g: any) => ({
          id: Number(g.id),
          email: String(g.email || '').trim(),
          nama_lengkap: String(g.nama_lengkap || ''),
          nuptk: formatNuptk((g as any).NUPTK),
        }))
      setGuruList(list)
    } catch {
      setGuruList([])
    } finally {
      setLoading(false)
    }
  }, [])

  // Muat data absensi_guru pada bulan terpilih ke matriks
  const loadExisting = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('absensi_guru')
        .select('*')
        .gte('tanggal', startIso)
        .lte('tanggal', endIso)
      const map: Record<string, CellEntry> = {}
      const keys = new Set<string>()
      ;(data || []).forEach((r: RekamGuru) => {
        const g = guruList.find(
          (x) =>
            x.email.trim().toLowerCase() ===
            String(r.guru_email || '').trim().toLowerCase(),
        )
        const st = String(r.status || '').trim() as StatusGuru
        const iso = r.tanggal ? String(r.tanggal).slice(0, 10) : ''
        if (g && iso && STATUS_ABSENSI_GURU.includes(st)) {
          const k = cellKey(g.id, iso)
          map[k] = { status: st, keterangan: r.keterangan || '' }
          keys.add(k)
        }
      })
      setEntries(map)
      setExistingKeys(keys)
    } catch {
      setEntries({})
      setExistingKeys(new Set())
    }
  }, [startIso, endIso, guruList])

  // Indikator KBM: guru yang punya jurnal 'Terlaksana' per tanggal pada bulan terpilih
  const loadKbm = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('jurnal_agenda')
        .select('guru_email, tanggal')
        .eq('status', 'Terlaksana')
        .gte('tanggal', startIso)
        .lte('tanggal', endIso)
      const s = new Set<string>()
      ;(data || []).forEach((r: any) => {
        const em = String(r.guru_email || '').trim().toLowerCase()
        const iso = String(r.tanggal || '').slice(0, 10)
        if (em && iso) s.add(`${em}_${iso}`)
      })
      setKbmKeys(s)
    } catch {
      setKbmKeys(new Set())
    }
  }, [startIso, endIso])

  // Inisialisasi: user login + daftar guru
  useEffect(() => {
    ;(async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (user?.email) setCurrentEmail(user.email.trim().toLowerCase())
      } catch {
        /* ignore */
      }
    })()
    loadGuru()
  }, [loadGuru])

  // Operator: muat prefill & KBM saat bulan/guru berubah
  useEffect(() => {
    if (!isOperator) return
    loadExisting()
  }, [isOperator, loadExisting])

  useEffect(() => {
    if (!isOperator) return
    loadKbm()
  }, [isOperator, loadKbm])

  // Guru (non-operator): muat riwayat kehadiran sendiri pada bulan terpilih (read-only)
  useEffect(() => {
    if (isOperator || !currentEmail) return
    ;(async () => {
      try {
        const { data } = await supabase
          .from('absensi_guru')
          .select('*')
          .eq('guru_email', currentEmail)
          .gte('tanggal', startIso)
          .lte('tanggal', endIso)
        const map: Record<string, CellEntry> = {}
        const keys = new Set<string>()
        const g = guruList.find((x) => x.email.trim().toLowerCase() === currentEmail)
        ;(data || []).forEach((r: RekamGuru) => {
          const st = String(r.status || '').trim() as StatusGuru
          const iso = r.tanggal ? String(r.tanggal).slice(0, 10) : ''
          if (g && iso && STATUS_ABSENSI_GURU.includes(st)) {
            const k = cellKey(g.id, iso)
            map[k] = { status: st, keterangan: r.keterangan || '' }
            keys.add(k)
          }
        })
        setEntries(map)
        setExistingKeys(keys)
      } catch {
        setEntries({})
        setExistingKeys(new Set())
      }
    })()
  }, [isOperator, currentEmail, startIso, endIso, guruList])

  const setCellValue = (guruId: number, iso: string, value: CellEntry | null) => {
    setEntries((prev) => {
      const next = { ...prev }
      const k = cellKey(guruId, iso)
      if (value) next[k] = value
      else delete next[k]
      return next
    })
  }

  // Siklus cepat: klik kanan sel → lanjut ke status berikutnya (H→I→S→A→kosong→H)
  const cycleStatus = (guruId: number, iso: string) => {
    const k = cellKey(guruId, iso)
    const cur = entries[k]
    if (!cur) {
      setCellValue(guruId, iso, { status: 'Hadir', keterangan: '' })
      return
    }
    const idx = STATUS_ABSENSI_GURU.indexOf(cur.status)
    const next = STATUS_ABSENSI_GURU[(idx + 1) % STATUS_ABSENSI_GURU.length]
    setCellValue(guruId, iso, { status: next, keterangan: cur.keterangan })
  }

  const openCellModal = (guruId: number, iso: string) => {
    const cur = entries[cellKey(guruId, iso)]
    setDraftStatus(cur ? cur.status : '')
    setDraftKeterangan(cur ? cur.keterangan : '')
    setActiveCell({ guruId, iso })
  }

  const applyDraft = () => {
    if (!activeCell) return
    if (draftStatus) {
      setCellValue(activeCell.guruId, activeCell.iso, {
        status: draftStatus,
        keterangan: draftKeterangan,
      })
    } else {
      // Dikosongkan
      setCellValue(activeCell.guruId, activeCell.iso, null)
    }
    setActiveCell(null)
  }

  // Isi cepat: semua guru yang punya jurnal KBM 'Terlaksana' pada tanggal → 'Hadir'
  const quickFillKbm = () => {
    guruList.forEach((g) => {
      const em = g.email.trim().toLowerCase()
      hariList.forEach((h) => {
        const is = cellKey(g.id, h.iso)
        if (!entries[is] && kbmKeys.has(`${em}_${h.iso}`)) {
          setCellValue(g.id, h.iso, { status: 'Hadir', keterangan: 'KBM' })
        }
      })
    })
    showToast('ok', 'Mengisi status Hadir untuk semua guru yang ada KBM.')
  }

  const handleSimpan = async () => {
    const upsertRows: any[] = []
    const deleteTargets: { tanggal: string; guru_email: string }[] = []

    guruList.forEach((g) => {
      const guruEmail = g.email.trim().toLowerCase()
      hariList.forEach((h) => {
        const k = cellKey(g.id, h.iso)
        const e = entries[k]
        if (e?.status) {
          upsertRows.push({
            tanggal: h.iso,
            guru_email: guruEmail,
            nama_lengkap: g.nama_lengkap,
            status: e.status,
            keterangan: e.keterangan.trim() || null,
            input_by: currentEmail || null,
          })
        } else if (existingKeys.has(k)) {
          // sebelumnya terisi tapi sekarang dikosongkan → hapus baris
          deleteTargets.push({ tanggal: h.iso, guru_email: guruEmail })
        }
      })
    })

    if (upsertRows.length === 0 && deleteTargets.length === 0) {
      showToast('err', 'Belum ada perubahan yang perlu disimpan.')
      return
    }

    setSaving(true)
    try {
      if (upsertRows.length > 0) {
        const { error } = await supabase
          .from('absensi_guru')
          .upsert(upsertRows, { onConflict: 'tanggal,guru_email' })
        if (error) throw error
      }
      for (const t of deleteTargets) {
        const { error } = await supabase
          .from('absensi_guru')
          .delete()
          .eq('tanggal', t.tanggal)
          .eq('guru_email', t.guru_email)
        if (error) throw error
      }
      showToast('ok', `Matriks tersimpan: ${upsertRows.length} sel diisi, ${deleteTargets.length} sel dikosongkan.`)
      await loadExisting()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      showToast('err', 'Gagal menyimpan matriks absensi guru: ' + msg)
    } finally {
      setSaving(false)
    }
  }

  // ======================================================================
  // RENDER — MODE GURU (READ-ONLY) & OPERATOR (MATRIKS INTERAKTIF)
  // ======================================================================
  const guruSaya = !isOperator ? guruList.find((g) => g.email.trim().toLowerCase() === currentEmail) : undefined
  const rows = isOperator ? guruList : guruSaya ? [guruSaya] : []

  const totalHadir = (guruId: number) =>
    hariList.reduce(
      (acc, h) => (entries[cellKey(guruId, h.iso)]?.status === 'Hadir' ? acc + 1 : acc),
      0,
    )

  const monthLabel = `${BULAN_NAMA[bulan - 1]} ${tahun}`

  const changeBulanOffset = (offset: number) => {
    const m = bulan + offset
    if (m < 1) {
      setBulan(12)
      setTahun((t) => t - 1)
    } else if (m > 12) {
      setBulan(1)
      setTahun((t) => t + 1)
    } else {
      setBulan(m)
    }
  }

  const tahunOptions = useMemo(() => {
    const y = new Date().getFullYear()
    const arr: number[] = []
    for (let i = y - 5; i <= y + 5; i++) arr.push(i)
    return arr
  }, [])

  const activeGuru = activeCell ? guruList.find((g) => g.id === activeCell.guruId) : undefined
  const activeTanggalLabel = (() => {
    if (!activeCell) return ''
    const [y, m, d] = activeCell.iso.split('-')
    return `${Number(d)} ${BULAN_NAMA[Number(m) - 1]} ${y}`
  })()

  return (
    <div className="flex flex-col h-full overflow-hidden space-y-2">
      {/* FILTER BULAN + AKSI + LEGENDA */}
      <div className={`border rounded-xl p-2 shrink-0 shadow-xs space-y-2 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-indigo-200'}`}>
        <div className="flex flex-wrap items-center gap-2">
          <div className={`flex items-center rounded-lg border p-0.5 shadow-xs ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-300'}`}>
            <button
              type="button"
              onClick={() => changeBulanOffset(-1)}
              className="p-1 rounded-md cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-300"
              title="Bulan sebelumnya"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <select
              value={bulan}
              onChange={(e) => setBulan(Number(e.target.value))}
              className={`border-0 bg-transparent focus:outline-none text-xs font-black cursor-pointer ${isDarkMode ? 'text-white' : 'text-slate-900'}`}
              title="Bulan"
            >
              {BULAN_NAMA.map((n, i) => (
                <option key={n} value={i + 1} className="text-slate-900">
                  {n}
                </option>
              ))}
            </select>
            <select
              value={tahun}
              onChange={(e) => setTahun(Number(e.target.value))}
              className={`border-0 bg-transparent focus:outline-none text-xs font-black cursor-pointer ${isDarkMode ? 'text-white' : 'text-slate-900'}`}
              title="Tahun"
            >
              {tahunOptions.map((y) => (
                <option key={y} value={y} className="text-slate-900">
                  {y}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => changeBulanOffset(1)}
              className="p-1 rounded-md cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-300"
              title="Bulan berikutnya"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <span className={`text-[10px] font-black px-2 py-1 rounded-full border ${isDarkMode ? 'bg-emerald-950/60 border-emerald-700 text-emerald-300' : 'bg-emerald-50 border-emerald-200 text-emerald-700'}`}>
            {monthLabel}
          </span>

          {isOperator && (
            <div className="flex flex-wrap items-center gap-1.5 ml-auto">
              <button
                type="button"
                onClick={quickFillKbm}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-black border shadow-xs cursor-pointer transition bg-indigo-600 text-white border-indigo-500 hover:bg-indigo-500"
                title="Isi status Hadir untuk guru yang tercatat KBM (Terlaksana) pada bulan ini"
              >
                <Sparkles className="w-3.5 h-3.5" /> Isi &apos;Hadir&apos; untuk yang Ada KBM
              </button>
              <button
                type="button"
                onClick={handleSimpan}
                disabled={saving || loading}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-black shadow-xs cursor-pointer transition bg-emerald-600 text-white hover:bg-emerald-500 disabled:bg-slate-600 disabled:cursor-not-allowed"
              >
                <Save className="w-3.5 h-3.5" /> {saving ? 'Menyimpan...' : 'Simpan Perubahan Matrix'}
              </button>
            </div>
          )}
        </div>

        {/* LEGENDA STATUS */}
        <div className="flex flex-wrap items-center gap-1.5 text-[9px] font-black">
          <span className="inline-flex items-center gap-1 text-emerald-500">
            <span className="w-4 h-4 rounded-md bg-emerald-500 text-white inline-flex items-center justify-center text-[9px]">H</span> Hadir (transport)
          </span>
          <span className="inline-flex items-center gap-1 text-amber-500">
            <span className="w-4 h-4 rounded-md bg-amber-400 text-slate-950 inline-flex items-center justify-center text-[9px]">I</span> Izin
          </span>
          <span className="inline-flex items-center gap-1 text-indigo-500">
            <span className="w-4 h-4 rounded-md bg-indigo-500 text-white inline-flex items-center justify-center text-[9px]">S</span> Sakit
          </span>
          <span className="inline-flex items-center gap-1 text-rose-500">
            <span className="w-4 h-4 rounded-md bg-rose-500 text-white inline-flex items-center justify-center text-[9px]">A</span> Tanpa Keterangan
          </span>
          <span className="inline-flex items-center gap-1 text-slate-400">
            <span className="w-4 h-4 rounded-md bg-slate-300 dark:bg-slate-700 text-slate-500 dark:text-slate-300 inline-flex items-center justify-center text-[9px]">-</span> Kosong / belum diisi
          </span>
          <span className="inline-flex items-center gap-1 text-indigo-400">
            <BookOpen className="w-3 h-3" /> Ada jurnal KBM
          </span>
          {isOperator ? (
            <span className="inline-flex items-center gap-1 text-slate-400 ml-auto">
              <MousePointerClick className="w-3 h-3" /> Klik sel untuk atur • Klik kanan = siklus cepat
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-slate-400 ml-auto">
              <Info className="w-3 h-3" /> Mode lihat-saja (read-only). Hubungi operator untuk mengubah status.
            </span>
          )}
        </div>
      </div>

      {/* MATRIKS BULANAN */}
      <div className="flex-1 overflow-auto border rounded-xl border-slate-700/40">
        <table className="w-full border-collapse text-[10px] min-w-[720px]">
          <thead>
            <tr className={`sticky top-0 z-30 ${isDarkMode ? 'bg-slate-800 text-slate-200' : 'bg-indigo-50 text-indigo-950'}`}>
              <th className={`sticky left-0 z-40 border border-slate-700/30 px-2 py-1.5 text-left text-[9px] uppercase tracking-wider ${isDarkMode ? 'bg-slate-800' : 'bg-indigo-50'}`}>
                Identitas Guru
              </th>
              {hariList.map((h) => (
                <th
                  key={h.iso}
                  className={`border border-slate-700/30 px-1 py-1.5 text-center min-w-[34px] ${
                    h.weekend
                      ? isDarkMode
                        ? 'bg-rose-950/40 text-rose-300'
                        : 'bg-rose-100 text-rose-700'
                      : ''
                  }`}
                >
                  <div className="text-[9px] font-normal opacity-80 uppercase">{h.short}</div>
                  <div className="text-[13px] font-black leading-tight">{h.day}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((g, gi) => (
              <tr key={g.id}>
                <td className={`sticky left-0 z-20 border border-slate-700/30 p-2 ${isDarkMode ? 'bg-slate-800' : 'bg-indigo-50'}`}>
                  <div className="flex items-center gap-2 min-w-[210px]">
                    <span className={`shrink-0 w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-black ${isDarkMode ? 'bg-slate-700 text-slate-200' : 'bg-indigo-200 text-indigo-900'}`}>
                      {gi + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className={`text-[11px] font-extrabold leading-tight truncate ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                        {g.nama_lengkap}
                      </div>
                      <div className={`text-[9px] font-bold mt-0.5 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                        NUPTK: {g.nuptk}
                      </div>
                    </div>
                    <div className={`shrink-0 text-center rounded-lg border px-1.5 py-0.5 ${isDarkMode ? 'bg-emerald-950/60 border-emerald-700 text-emerald-300' : 'bg-emerald-50 border-emerald-200 text-emerald-700'}`}>
                      <div className="text-[8px] uppercase font-black tracking-wide">Transport</div>
                      <div className="text-[13px] font-black leading-none">{totalHadir(g.id)}</div>
                    </div>
                  </div>
                </td>
                {hariList.map((h) => {
                  const k = cellKey(g.id, h.iso)
                  const e = entries[k]
                  const hasKbm = kbmKeys.has(`${g.email.trim().toLowerCase()}_${h.iso}`)
                  return (
                    <td
                      key={h.iso}
                      onClick={isOperator ? () => openCellModal(g.id, h.iso) : undefined}
                      onContextMenu={
                        isOperator
                          ? (ev) => {
                              ev.preventDefault()
                              cycleStatus(g.id, h.iso)
                            }
                          : undefined
                      }
                      title={isOperator ? 'Klik untuk atur status • Klik kanan = siklus cepat' : undefined}
                      className={`relative border border-slate-700/30 px-1 py-1 text-center align-middle transition-colors ${
                        isOperator ? 'cursor-pointer hover:ring-1 hover:ring-indigo-400' : ''
                      } ${h.weekend ? (isDarkMode ? 'bg-slate-800/40' : 'bg-slate-100/70') : isDarkMode ? 'bg-slate-900/40' : 'bg-white'}`}
                    >
                      {hasKbm && (
                        <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-indigo-400 shadow-[0_0_4px_rgba(129,140,248,0.8)]" title="Ada jurnal KBM Terlaksana" />
                      )}
                      <span
                        className={`inline-flex items-center justify-center w-6 h-6 rounded-md text-[11px] font-black leading-none ${
                          e
                            ? statusBadgeCls(e.status)
                            : isDarkMode
                            ? 'bg-slate-800 text-slate-500'
                            : 'bg-slate-200 text-slate-400'
                        }`}
                      >
                        {e ? STATUS_CODE[e.status] : '-'}
                      </span>
                    </td>
                  )
                })}
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={hariList.length + 1} className={`text-center py-10 text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  {loading ? 'Memuat daftar guru...' : 'Tidak ada data guru tersedia untuk ditampilkan.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* MODAL POPOVER ATUR STATUS (Khusus Operator) */}
      {activeCell && isOperator && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setActiveCell(null)} />
          <div className={`relative w-full max-w-xs rounded-2xl border p-4 shadow-2xl ${isDarkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-indigo-200 text-slate-900'}`}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-black flex items-center gap-1.5">
                <UserCheck className="w-4 h-4 text-indigo-400" /> Atur Kehadiran
              </h3>
              <button
                type="button"
                onClick={() => setActiveCell(null)}
                className="p-1 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="mb-3 text-[10px] font-bold text-slate-500 dark:text-slate-400">
              {activeGuru?.nama_lengkap || '-'} • {activeTanggalLabel}
            </div>
            <div className="grid grid-cols-2 gap-1.5 mb-2">
              {STATUS_ABSENSI_GURU.map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setDraftStatus(st)}
                  className={`flex items-center gap-1.5 rounded-lg border px-2 py-1.5 text-[10px] font-black transition cursor-pointer ${
                    draftStatus === st
                      ? `${statusBadgeCls(st)} border-transparent`
                      : isDarkMode
                      ? 'bg-slate-800 border-slate-700 hover:bg-slate-700'
                      : 'bg-slate-50 border-slate-300 hover:bg-slate-100'
                  }`}
                >
                  <span
                    className={`w-5 h-5 rounded-md inline-flex items-center justify-center text-[9px] font-black ${
                      draftStatus === st ? 'bg-black/15 text-inherit' : statusBadgeCls(st)
                    }`}
                  >
                    {STATUS_CODE[st]}
                  </span>
                  {st}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setDraftStatus('')}
                className={`col-span-2 flex items-center justify-center gap-1.5 rounded-lg border px-2 py-1.5 text-[10px] font-black transition cursor-pointer ${
                  draftStatus === ''
                    ? 'bg-slate-500 text-white border-transparent'
                    : isDarkMode
                    ? 'bg-slate-800 border-slate-700 hover:bg-slate-700 text-slate-300'
                    : 'bg-slate-100 border-slate-300 hover:bg-slate-200 text-slate-600'
                }`}
              >
                <Eraser className="w-3.5 h-3.5" /> Kosongkan (-)
              </button>
            </div>
            <input
              value={draftKeterangan}
              onChange={(e) => setDraftKeterangan(e.target.value)}
              placeholder="Keterangan opsional (mis. Piket Harian)"
              className={`w-full border rounded-lg px-2 py-1.5 text-xs font-bold focus:outline-none ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'}`}
            />
            <div className="flex gap-2 mt-3">
              <button
                type="button"
                onClick={() => setActiveCell(null)}
                className="flex-1 rounded-lg border px-3 py-1.5 text-[10px] font-black cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={applyDraft}
                className="flex-1 flex items-center justify-center gap-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 text-[10px] font-black cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" /> Terapkan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TOAST */}
      {toast && (
        <div className={`fixed bottom-20 left-1/2 -translate-x-1/2 z-[95] px-4 py-2.5 rounded-xl text-xs font-bold shadow-lg ${toast.tipe === 'ok' ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'}`}>
          {toast.pesan}
        </div>
      )}
    </div>
  )
}
