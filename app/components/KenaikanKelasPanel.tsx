'use client'

import { useEffect, useMemo, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getKelasGradeWeight, sortKelas } from '@/lib/utils'
import {
  GraduationCap,
  ArrowRight,
  CheckSquare,
  Square,
  Info,
  Loader2,
} from 'lucide-react'

interface KelasItem {
  id: number
  nama_kelas: string
  tingkat: string | null
}

interface SiswaItem {
  id: number
  nisn: string | null
  nama_lengkap: string
  jenis_kelamin: string | null
  kelas_id: number | null
}

interface Props {
  supabase: SupabaseClient
  jenjang: 'SMP' | 'SMK'
  mode: 'smp' | 'smk'
  isDarkMode?: boolean
  onChanged?: () => void
}

type Aksi = 'naik' | 'lulus' | 'lulus_smk'

export default function KenaikanKelasPanel({
  supabase,
  jenjang,
  mode,
  isDarkMode = false,
  onChanged,
}: Props) {
  const [kelasList, setKelasList] = useState<KelasItem[]>([])
  const [asalKelasId, setAsalKelasId] = useState('')
  const [aksi, setAksi] = useState<Aksi>('naik')
  const [smkXKelas, setSmkXKelas] = useState<KelasItem[]>([])
  const [tujuanKelasId, setTujuanKelasId] = useState('')
  const [siswaList, setSiswaList] = useState<SiswaItem[]>([])
  const [checkedMap, setCheckedMap] = useState<Record<string, boolean>>({})
  const [loadingKelas, setLoadingKelas] = useState(true)
  const [loadingSiswa, setLoadingSiswa] = useState(false)
  const [executing, setExecuting] = useState(false)
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  const sortedKelas = useMemo(() => sortKelas(kelasList), [kelasList])
  const asalObj = sortedKelas.find((k) => String(k.id) === asalKelasId) || null
  const tingkatAsal = asalObj
    ? getKelasGradeWeight(asalObj.nama_kelas, asalObj.tingkat)
    : 99

  const isSmp = jenjang === 'SMP'

  // Tema: sesuaikan dengan konteks halaman (SMP indigo vs SMK amber)
  const t = mode === 'smk'
    ? {
        panel: 'bg-black/40 border-white/10',
        input: 'bg-black/40 border border-white/10 text-white placeholder:text-slate-500 focus:border-amber-400',
        accentBtn: 'bg-amber-400 hover:bg-amber-300 text-slate-950',
        heading: 'text-amber-300',
        muted: 'text-slate-400',
        check: 'accent-amber-400',
        row: 'bg-white/[0.03] border-white/10 hover:bg-white/[0.06]',
        tip: 'border-amber-400/30 bg-amber-400/10 text-amber-200',
        listBg: 'bg-white/[0.02] border-white/5',
      }
    : {
        panel: isDarkMode ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-indigo-200/80',
        input: isDarkMode
          ? 'bg-slate-800 border-slate-700 text-white placeholder:text-slate-400 focus:border-indigo-600'
          : 'bg-white border-slate-300 text-slate-900 focus:border-indigo-600',
        accentBtn: 'bg-indigo-600 hover:bg-indigo-700 text-white',
        heading: isDarkMode ? 'text-indigo-300' : 'text-indigo-950',
        muted: isDarkMode ? 'text-slate-400' : 'text-slate-500',
        check: 'accent-indigo-600',
        row: isDarkMode
          ? 'bg-slate-800/70 border-slate-700 hover:bg-slate-800'
          : 'bg-white border-indigo-200/80 hover:bg-indigo-50/60',
        tip: isDarkMode
          ? 'border-amber-500/40 bg-amber-500/10 text-amber-300'
          : 'border-amber-300 bg-amber-50 text-amber-800',
        listBg: isDarkMode
          ? 'bg-slate-900/40 border-slate-700'
          : 'bg-indigo-50/40 border-indigo-200/70',
      }

  // Muat daftar kelas pada jenjang terpilih
  useEffect(() => {
    let mounted = true
    ;(async () => {
      setLoadingKelas(true)
      try {
        let q = supabase.from('kelas').select('id, nama_kelas, tingkat')
        if (isSmp) {
          q = q.or('jenjang.eq.SMP,jenjang.is.null')
        } else {
          q = q.eq('jenjang', 'SMK')
        }
        const { data, error } = await q.order('nama_kelas', { ascending: true })
        if (error) throw error
        const rows = (data || []) as KelasItem[]
        if (!mounted) return
        setKelasList(rows)
        if (rows.length > 0) {
          setAsalKelasId((prev) =>
            prev && rows.some((k) => String(k.id) === prev) ? prev : String(rows[0].id)
          )
        }
      } catch {
        if (mounted) setMsg({ type: 'err', text: 'Gagal memuat daftar kelas.' })
      } finally {
        if (mounted) setLoadingKelas(false)
      }
    })()
    return () => {
      mounted = false
    }
  }, [isSmp, supabase])

  // Untuk SMP kelas IX: muat rombel Kelas X SMK sebagai tujuan transfer
  useEffect(() => {
    if (!isSmp) return
    let mounted = true
    ;(async () => {
      const { data, error } = await supabase
        .from('kelas')
        .select('id, nama_kelas, tingkat')
        .eq('jenjang', 'SMK')
        .or('tingkat.eq.X,tingkat.eq.10')
        .order('nama_kelas', { ascending: true })
      if (error || !mounted) return
      setSmkXKelas(sortKelas(data || []))
    })()
    return () => {
      mounted = false
    }
  }, [isSmp, supabase])

  // Opsi aksi berdasarkan kelas asal terpilih
  const aksiOptions = useMemo(() => {
    if (loadingKelas || tingkatAsal === 99) return []
    if (!isSmp) {
      if (tingkatAsal <= 11) {
        const next = sortedKelas.find(
          (k) => getKelasGradeWeight(k.nama_kelas, k.tingkat) === tingkatAsal + 1
        )
        if (next) return [{ value: 'naik' as Aksi, label: `Naik ke Kelas ${next.nama_kelas}` }]
        return []
      }
      return [{ value: 'lulus' as Aksi, label: 'Luluskan Siswa (Alumni / Keluar)' }]
    }
    if (tingkatAsal <= 8) {
      const next = sortedKelas.find(
        (k) => getKelasGradeWeight(k.nama_kelas, k.tingkat) === tingkatAsal + 1
      )
      if (next) return [{ value: 'naik' as Aksi, label: `Naik ke Kelas ${next.nama_kelas}` }]
      return []
    }
    return [
      { value: 'lulus' as Aksi, label: 'Luluskan Siswa (Alumni / Keluar)' },
      { value: 'lulus_smk' as Aksi, label: 'Lulus & Lanjut ke SMK (Transfer ke Kelas X SMK)' },
    ]
  }, [loadingKelas, tingkatAsal, sortedKelas, isSmp])

  const tujuanNaikKelas = useMemo(() => {
    if (aksi !== 'naik') return null
    return (
      sortedKelas.find(
        (k) => getKelasGradeWeight(k.nama_kelas, k.tingkat) === tingkatAsal + 1
      ) || null
    )
  }, [aksi, sortedKelas, tingkatAsal])

  // Reset aksi & tujuan saat kelas asal berubah
  useEffect(() => {
    if (loadingKelas || tingkatAsal === 99) return
    if (aksiOptions.length > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAksi(aksiOptions[0].value)
    } else {
      setAksi('naik')
    }
    if (aksiOptions[0]?.value === 'naik') {
      setTujuanKelasId(tujuanNaikKelas ? String(tujuanNaikKelas.id) : '')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asalKelasId, tingkatAsal])

  // Muat siswa aktif di kelas asal (tercentang semua secara default)
  useEffect(() => {
    if (!asalKelasId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSiswaList([])
      setCheckedMap({})
      return
    }
    let mounted = true
    setLoadingSiswa(true)
    ;(async () => {
      const { data, error } = await supabase
        .from('siswa')
        .select('id, nisn, nama_lengkap, jenis_kelamin, kelas_id')
        .eq('kelas_id', Number(asalKelasId))
        .order('nama_lengkap', { ascending: true })
      if (error) {
        if (mounted) setMsg({ type: 'err', text: error.message })
      } else if (mounted) {
        const rows = (data || []) as SiswaItem[]
        setSiswaList(rows)
        const allChecked: Record<string, boolean> = {}
        rows.forEach((s) => {
          allChecked[String(s.id)] = true
        })
        setCheckedMap(allChecked)
      }
      if (mounted) setLoadingSiswa(false)
    })()
    return () => {
      mounted = false
    }
  }, [asalKelasId, supabase])

  const selectedCount = Object.values(checkedMap).filter(Boolean).length
  const allSelected = siswaList.length > 0 && selectedCount === siswaList.length

  const toggleAll = () => {
    const next: Record<string, boolean> = {}
    siswaList.forEach((s) => {
      next[String(s.id)] = !allSelected
    })
    setCheckedMap(next)
  }

  const toggleOne = (id: number) => {
    setCheckedMap((prev) => ({ ...prev, [String(id)]: !prev[String(id)] }))
  }

  // Tandai lulus: lepas dari rombel aktif (kelas_id -> null) namun data tetap tersimpan
  const markLulus = async (id: number) => {
    const { error } = await supabase
      .from('siswa')
      .update({ kelas_id: null })
      .eq('id', id)
    if (error) throw error
  }

  const execute = async () => {
    const ids = Object.keys(checkedMap).filter((k) => checkedMap[k])
    if (ids.length === 0) {
      setMsg({ type: 'err', text: 'Belum ada siswa yang dicentang.' })
      return
    }
    if (aksi === 'naik' && !tujuanNaikKelas) {
      setMsg({ type: 'err', text: 'Tidak ditemukan kelas tujuan untuk tingkat asal ini.' })
      return
    }
    if (aksi === 'lulus_smk' && !tujuanKelasId) {
      setMsg({ type: 'err', text: 'Pilih rombel Kelas X SMK tujuan terlebih dahulu.' })
      return
    }

    setExecuting(true)
    setMsg(null)
    let ok = 0
    let err = 0
    let skipped = 0
    try {
      if (aksi === 'naik') {
        const targetId = Number(tujuanNaikKelas!.id)
        for (const id of ids) {
          const { error } = await supabase
            .from('siswa')
            .update({ kelas_id: targetId })
            .eq('id', Number(id))
          if (error) err++
          else ok++
        }
      } else if (aksi === 'lulus') {
        for (const id of ids) {
          try {
            await markLulus(Number(id))
            ok++
          } catch {
            err++
          }
        }
      } else {
        // Lulus & Lanjut ke SMK: cek duplikat & salin biodata ke SMK DULU,
        // baru luluskan record SMP. Urutan ini penting: kalau salinan SMK
        // gagal (duplikat NISN / insert error), record SMP tetap utuh di
        // kelasnya dan tidak jadi yatim (kelas_id null tanpa salinan SMK).
        for (const id of ids) {
          const sid = Number(id)
          try {
            const src = siswaList.find((s) => s.id === sid)
            const nisn = src?.nisn?.trim() || null
            if (nisn) {
              const { data: dup } = await supabase
                .from('siswa')
                .select('id')
                .eq('nisn', nisn)
                .eq('jenjang', 'SMK')
                .limit(1)
              if (dup && dup.length > 0) {
                skipped++
                continue
              }
            }
            const { error } = await supabase.from('siswa').insert({
              nisn,
              nama_lengkap: src?.nama_lengkap?.toUpperCase(),
              jenis_kelamin: src?.jenis_kelamin || 'L',
              kelas_id: Number(tujuanKelasId),
              jenjang: 'SMK',
            })
            if (error) {
              err++
              continue
            }
            await markLulus(sid)
            ok++
          } catch {
            err++
          }
        }
      }
    } finally {
      setExecuting(false)
    }

    if (aksi === 'naik') {
      setMsg({
        type: ok > 0 ? 'ok' : 'err',
        text: `✅ ${ok} siswa dinaikkan ke Kelas ${tujuanNaikKelas!.nama_kelas}${err ? ` • ${err} gagal` : ''}.`,
      })
    } else if (aksi === 'lulus') {
      setMsg({
        type: ok > 0 ? 'ok' : 'err',
        text: `✅ ${ok} siswa diluluskan (Status: LULUS)${err ? ` • ${err} gagal` : ''}.`,
      })
    } else {
      setMsg({
        type: ok > 0 ? 'ok' : 'err',
        text: `✅ ${ok} siswa diluluskan & ditransfer ke SMK${skipped ? ` • ${skipped} duplikat NISN dilewati` : ''}${err ? ` • ${err} gagal` : ''}.`,
      })
    }
    onChanged?.()
  }

  return (
    <div className={`backdrop-blur-md border rounded-2xl p-3.5 sm:p-4 shadow-xs flex flex-col space-y-3 ${t.panel}`}>
      {/* PENGINGAT */}
      <div className={`flex items-start gap-2 border rounded-xl px-3 py-2 text-[11px] leading-relaxed ${t.tip}`}>
        <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
        <p>
          <strong>Tip:</strong> Proses secara berurutan dari tingkat tertinggi (IX/XII → VIII/XI → VII/X).
          Untuk kelas IX SMP, Anda bisa mencentang siswa yang melanjutkan ke SMK terlebih dahulu sebelum
          meluluskan sisanya.
        </p>
      </div>

      {/* KONTROL */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
        <div>
          <label className={`block text-[10px] font-extrabold uppercase tracking-wider mb-1 ${t.heading}`}>
            Kelas Asal
          </label>
          <select
            value={asalKelasId}
            onChange={(e) => {
              setAsalKelasId(e.target.value)
              setMsg(null)
            }}
            disabled={loadingKelas}
            className={`w-full border rounded-xl px-3 py-2 text-xs font-bold focus:outline-none cursor-pointer ${t.input}`}
          >
            {loadingKelas ? (
              <option value="">Memuat kelas...</option>
            ) : sortedKelas.length === 0 ? (
              <option value="">Belum ada kelas terdaftar</option>
            ) : (
              sortedKelas.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.nama_kelas}
                </option>
              ))
            )}
          </select>
        </div>

        <div>
          <label className={`block text-[10px] font-extrabold uppercase tracking-wider mb-1 ${t.heading}`}>
            Opsi Tujuan / Aksi
          </label>
          <select
            value={aksi}
            onChange={(e) => {
              const v = e.target.value as Aksi
              setAksi(v)
              if (v === 'lulus_smk' && smkXKelas.length > 0) {
                setTujuanKelasId(String(smkXKelas[0].id))
              } else if (v === 'naik' && tujuanNaikKelas) {
                setTujuanKelasId(String(tujuanNaikKelas.id))
              }
              setMsg(null)
            }}
            disabled={loadingKelas || aksiOptions.length === 0}
            className={`w-full border rounded-xl px-3 py-2 text-xs font-bold focus:outline-none cursor-pointer ${t.input}`}
          >
            {aksiOptions.length === 0 ? (
              <option value="">Tidak ada aksi tersedia</option>
            ) : (
              aksiOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))
            )}
          </select>
        </div>

        {aksi === 'lulus_smk' && (
          <div>
            <label className={`block text-[10px] font-extrabold uppercase tracking-wider mb-1 ${t.heading}`}>
              Rombel Kelas X SMK Tujuan
            </label>
            <select
              value={tujuanKelasId}
              onChange={(e) => setTujuanKelasId(e.target.value)}
              className={`w-full border rounded-xl px-3 py-2 text-xs font-bold focus:outline-none cursor-pointer ${t.input}`}
            >
              {smkXKelas.length === 0 ? (
                <option value="">Belum ada kelas X SMK</option>
              ) : (
                smkXKelas.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.nama_kelas}
                  </option>
                ))
              )}
            </select>
          </div>
        )}

        {aksi === 'naik' && tujuanNaikKelas && (
          <div className="flex items-end">
            <div className={`w-full border rounded-xl px-3 py-2 text-xs font-bold flex items-center gap-1.5 ${t.listBg}`}>
              <ArrowRight className="w-3.5 h-3.5" />
              <span>
                Tujuan otomatis: <strong>{tujuanNaikKelas.nama_kelas}</strong>
              </span>
            </div>
          </div>
        )}
      </div>

      {/* CHECKLIST SISWA */}
      <div className="flex items-center justify-between gap-2">
        <h3 className={`text-[11px] font-bold uppercase tracking-wider ${t.muted}`}>
          Checklist Siswa Kelas {asalObj?.nama_kelas || '-'} ({selectedCount}/{siswaList.length})
        </h3>
        {siswaList.length > 0 && (
          <button
            type="button"
            onClick={toggleAll}
            className={`text-[10px] font-black flex items-center gap-1 px-2 py-1 rounded-lg transition cursor-pointer ${t.accentBtn}`}
          >
            {allSelected ? <Square className="w-3 h-3" /> : <CheckSquare className="w-3 h-3" />}
            {allSelected ? 'Kosongkan Semua' : 'Centang Semua'}
          </button>
        )}
      </div>

      <div className={`flex-1 min-h-0 max-h-[45vh] overflow-y-auto pr-1 border rounded-xl ${t.listBg}`}>
        {loadingSiswa ? (
          <div className="p-6 text-center text-xs flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Memuat siswa...
          </div>
        ) : siswaList.length === 0 ? (
          <p className={`p-6 text-center text-xs font-medium ${t.muted}`}>
            Tidak ada siswa aktif di kelas ini atau belum ada kelas dipilih.
          </p>
        ) : (
          <div className="space-y-1.5 p-1.5">
            {siswaList.map((s) => {
              const isChecked = !!checkedMap[String(s.id)]
              return (
                <label
                  key={s.id}
                  className={`flex items-center gap-2.5 rounded-lg border px-2.5 py-2 cursor-pointer transition ${t.row}`}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggleOne(s.id)}
                    className={`w-4 h-4 rounded ${t.check}`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold truncate">{s.nama_lengkap}</p>
                    <p className={`text-[10px] truncate ${t.muted}`}>
                      NISN: {s.nisn || '-'} • {s.jenis_kelamin || '-'}
                    </p>
                  </div>
                </label>
              )
            })}
          </div>
        )}
      </div>

      {/* EKSEKUSI */}
      {msg && (
        <div
          className={`text-[11px] font-semibold rounded-xl border px-3 py-2 ${
            msg.type === 'ok'
              ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400'
              : 'border-rose-500/40 bg-rose-500/10 text-rose-400'
          }`}
        >
          {msg.text}
        </div>
      )}

      <button
        type="button"
        onClick={execute}
        disabled={
          executing ||
          siswaList.length === 0 ||
          selectedCount === 0 ||
          (aksi === 'lulus_smk' && !tujuanKelasId) ||
          (aksi === 'naik' && !tujuanNaikKelas)
        }
        className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-extrabold text-xs transition shadow-xs cursor-pointer disabled:opacity-50 ${t.accentBtn}`}
      >
        {executing ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" /> Memproses...
          </>
        ) : (
          <>
            <GraduationCap className="w-4 h-4" />
            {aksi === 'naik' && `Terapkan Kenaikan (${selectedCount})`}
            {aksi === 'lulus' && `Luluskan Siswa (${selectedCount})`}
            {aksi === 'lulus_smk' && `Lulus & Transfer ke SMK (${selectedCount})`}
          </>
        )}
      </button>
    </div>
  )
}

