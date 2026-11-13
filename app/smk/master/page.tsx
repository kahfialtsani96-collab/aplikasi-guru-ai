'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import PixelBatSwitcher from '@/app/components/PixelBatSwitcher'
import {
  ArrowLeft,
  GraduationCap,
  Users,
  BookOpen,
  UserCheck,
  Plus,
  Trash2,
  Search,
  ShieldAlert,
  CheckCircle2,
  Loader2,
  Sparkles,
  X,
} from 'lucide-react'

type TabKey = 'kelas' | 'siswa' | 'mapel' | 'guru'

interface KelasSmk {
  id: number
  nama_kelas: string
  tingkat: string | null
  jurusan: string | null
  wali_kelas_id: number | null
}

interface SiswaSmk {
  id: number
  nis: string | null
  nisn: string | null
  nama_lengkap: string
  jenis_kelamin: string | null
  kelas_id: number | null
}

interface MapelSmk {
  id: number
  kode_mapel: string | null
  nama_mapel: string
  kelompok: string | null
  tingkat: string | null
  jumlah_jp: number | null
  semester: string | null
  tahun_ajaran: string | null
  urutan: number | null
}

interface GuruMaster {
  id: number
  nama_lengkap: string
  email: string | null
  NUPTK: string | null
  role: string | null
  jabatan: string | null
  unit_mengajar: string | null
}

interface GuruMapelRow {
  id: number
  guru_id: number
  mapel_id: number
}

const TABS: { key: TabKey; label: string; shortLabel: string; icon: typeof GraduationCap }[] = [
  { key: 'kelas', label: 'Kelas DKV', shortLabel: 'Kelas', icon: GraduationCap },
  { key: 'siswa', label: 'Siswa DKV', shortLabel: 'Siswa', icon: Users },
  { key: 'mapel', label: 'Mapel DKV', shortLabel: 'Mapel', icon: BookOpen },
  { key: 'guru', label: 'Guru SMK', shortLabel: 'Guru', icon: UserCheck },
]

function parseSupabaseError(err: unknown, fallback: string): string {
  if (!err) return fallback
  if (typeof err === 'string') return err
  if (typeof err === 'object') {
    const e = err as { message?: string; details?: string; hint?: string }
    if (e.message && e.details) return `${e.message} (${e.details})`
    if (e.message) return e.message
    if (e.details) return e.details
  }
  return fallback
}

export default function SmkMasterOperatorPage() {
  const router = useRouter()

  // Proteksi Akses Khusus Operator
  const [authChecking, setAuthChecking] = useState(true)
  const [isOperatorVerified, setIsOperatorVerified] = useState(false)

  // Tab Aktif & Posisi Lentera Meluncur
  const [activeTab, setActiveTab] = useState<TabKey>('kelas')
  const activeTabIndex = TABS.findIndex((t) => t.key === activeTab)

  // Data Master
  const [loadingData, setLoadingData] = useState(false)
  const [saving, setSaving] = useState(false)
  const [toastMsg, setToastMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  const [listKelas, setListKelas] = useState<KelasSmk[]>([])
  const [listSiswa, setListSiswa] = useState<SiswaSmk[]>([])
  const [listMapel, setListMapel] = useState<MapelSmk[]>([])
  const [listGuru, setListGuru] = useState<GuruMaster[]>([])
  const [listGuruMapel, setListGuruMapel] = useState<GuruMapelRow[]>([])

  // Pilihan dropdown mapel sementara per guru_id
  const [selectedMapelPerGuru, setSelectedMapelPerGuru] = useState<Record<number, string>>({})
  const [assigningGuruId, setAssigningGuruId] = useState<number | null>(null)

  // Form Input Kelas SMK
  const [namaKelas, setNamaKelas] = useState('')
  const [tingkatKelas, setTingkatKelas] = useState('X')
  const [waliKelasId, setWaliKelasId] = useState('')

  // Form Input Siswa SMK
  const [nisSiswa, setNisSiswa] = useState('')
  const [nisnSiswa, setNisnSiswa] = useState('')
  const [namaSiswa, setNamaSiswa] = useState('')
  const [jkSiswa, setJkSiswa] = useState('L')
  const [kelasSiswaId, setKelasSiswaId] = useState('')

  // Form Input Mapel SMK (Default: Semua Tingkat agar 1 mapel berlaku gabungan X, XI, XII)
  const [kodeMapel, setKodeMapel] = useState('')
  const [namaMapel, setNamaMapel] = useState('')
  const [kelompokMapel, setKelompokMapel] = useState('Kejuruan DKV')
  const [tingkatMapel, setTingkatMapel] = useState('Semua Tingkat')
  const [jumlahJp, setJumlahJp] = useState('4')
  const [semesterMapel, setSemesterMapel] = useState('Ganjil & Genap')
  const [tahunAjaranMapel, setTahunAjaranMapel] = useState('2026/2027')
  const [urutanMapel, setUrutanMapel] = useState('1')

  // Form Input Guru Baru SMK
  const [namaGuruBaru, setNamaGuruBaru] = useState('')
  const [emailGuruBaru, setEmailGuruBaru] = useState('')
  const [nuptkGuruBaru, setNuptkGuruBaru] = useState('')
  const [jabatanGuruBaru, setJabatanGuruBaru] = useState('Guru Produktif DKV')

  const showToast = (type: 'ok' | 'err', text: string) => {
    setToastMsg({ type, text })
    setTimeout(() => setToastMsg(null), 4500)
  }

  // 1. Cek Sesi & Verifikasi Peran Operator
  useEffect(() => {
    let isMounted = true

    const verifyOperatorAccess = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession()

        if (!session || !session.user?.email) {
          router.replace('/login')
          return
        }

        const { data: guruRow } = await supabase
          .from('guru')
          .select('role')
          .ilike('email', session.user.email.trim())
          .maybeSingle()

        const isOp = (guruRow?.role || '').toLowerCase() === 'operator'

        if (isMounted) {
          setIsOperatorVerified(isOp)
          setAuthChecking(false)
        }
      } catch {
        if (isMounted) {
          setIsOperatorVerified(false)
          setAuthChecking(false)
        }
      }
    }

    verifyOperatorAccess()

    return () => {
      isMounted = false
    }
  }, [router])

  // 2. Muat Semua Data Master SMK + Relasi guru_mapel
  const fetchAllSmkMaster = useCallback(async () => {
    setLoadingData(true)
    try {
      const [resKelas, resSiswa, resMapel, resGuru, resGuruMapel] = await Promise.all([
        supabase
          .from('kelas')
          .select('id, nama_kelas, tingkat, jurusan, wali_kelas_id')
          .eq('jenjang', 'SMK')
          .order('nama_kelas', { ascending: true }),
        supabase
          .from('siswa')
          .select('id, nis, nisn, nama_lengkap, jenis_kelamin, kelas_id')
          .eq('jenjang', 'SMK')
          .order('nama_lengkap', { ascending: true }),
        supabase
          .from('mapel')
          .select(
            'id, kode_mapel, nama_mapel, kelompok, tingkat, jumlah_jp, semester, tahun_ajaran, urutan'
          )
          .eq('jenjang', 'SMK')
          .order('urutan', { ascending: true }),
        supabase
          .from('guru')
          .select('id, nama_lengkap, email, NUPTK, role, jabatan, unit_mengajar')
          .order('nama_lengkap', { ascending: true }),
        supabase.from('guru_mapel').select('id, guru_id, mapel_id'),
      ])

      if (resKelas.data) {
        setListKelas(resKelas.data)
        if (resKelas.data.length > 0 && !kelasSiswaId) {
          setKelasSiswaId(String(resKelas.data[0].id))
        }
      }
      if (resSiswa.data) setListSiswa(resSiswa.data)
      if (resMapel.data) {
        setListMapel(resMapel.data)
        setUrutanMapel(String(resMapel.data.length + 1))
      }
      if (resGuru.data) setListGuru(resGuru.data)
      if (resGuruMapel.data) setListGuruMapel(resGuruMapel.data)
    } catch (err) {
      console.error('Gagal memuat data master SMK:', err)
    } finally {
      setLoadingData(false)
    }
  }, [kelasSiswaId])

  useEffect(() => {
    if (isOperatorVerified) {
      fetchAllSmkMaster()
    }
  }, [isOperatorVerified, fetchAllSmkMaster])

  // =========================================================================
  // HANDLER SIMPAN & HAPUS DATA
  // =========================================================================
  const handleAddKelas = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!namaKelas.trim()) return
    setSaving(true)
    try {
      const { error } = await supabase.from('kelas').insert({
        nama_kelas: namaKelas.trim().toUpperCase(),
        tingkat: tingkatKelas,
        jurusan: 'DKV',
        jenjang: 'SMK',
        wali_kelas_id: waliKelasId ? Number(waliKelasId) : null,
      })
      if (error) throw error
      setNamaKelas('')
      setWaliKelasId('')
      showToast('ok', 'Kelas SMK berhasil ditambahkan!')
      await fetchAllSmkMaster()
    } catch (err) {
      showToast('err', parseSupabaseError(err, 'Gagal menambah kelas SMK'))
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteKelas = async (id: number, nama: string) => {
    if (!confirm(`Hapus kelas ${nama}?`)) return
    const { error } = await supabase.from('kelas').delete().eq('id', id)
    if (error) {
      showToast('err', parseSupabaseError(error, 'Gagal menghapus kelas'))
    } else {
      showToast('ok', `Kelas ${nama} dihapus`)
      fetchAllSmkMaster()
    }
  }

  const handleAddSiswa = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!namaSiswa.trim() || !kelasSiswaId) {
      showToast('err', 'Pilih kelas DKV & isi nama siswa terlebih dahulu')
      return
    }
    setSaving(true)
    try {
      const { error } = await supabase.from('siswa').insert({
        nis: nisSiswa.trim() || null,
        nisn: nisnSiswa.trim() || null,
        nama_lengkap: namaSiswa.trim().toUpperCase(),
        jenis_kelamin: jkSiswa,
        kelas_id: Number(kelasSiswaId),
        jenjang: 'SMK',
      })
      if (error) throw error
      setNisSiswa('')
      setNisnSiswa('')
      setNamaSiswa('')
      showToast('ok', 'Siswa SMK berhasil disimpan!')
      await fetchAllSmkMaster()
    } catch (err) {
      showToast('err', parseSupabaseError(err, 'Gagal menyimpan siswa SMK'))
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteSiswa = async (id: number, nama: string) => {
    if (!confirm(`Hapus data siswa ${nama}?`)) return
    const { error } = await supabase.from('siswa').delete().eq('id', id)
    if (error) {
      showToast('err', parseSupabaseError(error, 'Gagal menghapus data siswa'))
    } else {
      showToast('ok', `Siswa ${nama} dihapus`)
      fetchAllSmkMaster()
    }
  }

  const handleAddMapel = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!namaMapel.trim()) return
    setSaving(true)
    try {
      const { error } = await supabase.from('mapel').insert({
        kode_mapel: kodeMapel.trim().toUpperCase() || null,
        nama_mapel: namaMapel.trim().toUpperCase(),
        kelompok: kelompokMapel,
        tingkat: tingkatMapel,
        jumlah_jp: Number(jumlahJp) || 2,
        semester: semesterMapel,
        tahun_ajaran: tahunAjaranMapel.trim() || '2026/2027',
        urutan: Number(urutanMapel) || 1,
        jenjang: 'SMK',
      })
      if (error) throw error
      setKodeMapel('')
      setNamaMapel('')
      showToast('ok', 'Mata pelajaran SMK berhasil ditambahkan!')
      await fetchAllSmkMaster()
    } catch (err) {
      showToast('err', parseSupabaseError(err, 'Gagal menambah mapel SMK'))
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteMapel = async (id: number, nama: string) => {
    if (!confirm(`Hapus mapel ${nama}?`)) return
    const { error } = await supabase.from('mapel').delete().eq('id', id)
    if (error) {
      showToast('err', parseSupabaseError(error, 'Gagal menghapus mapel'))
    } else {
      showToast('ok', `Mapel ${nama} dihapus`)
      fetchAllSmkMaster()
    }
  }

  const handleToggleGuruUnit = async (guru: GuruMaster, nextUnit: string) => {
    const { error } = await supabase
      .from('guru')
      .update({ unit_mengajar: nextUnit })
      .eq('id', guru.id)

    if (error) {
      showToast('err', parseSupabaseError(error, 'Gagal memperbarui unit guru'))
    } else {
      showToast('ok', `${guru.nama_lengkap} → ${nextUnit}`)
      setListGuru((prev) =>
        prev.map((g) => (g.id === guru.id ? { ...g, unit_mengajar: nextUnit } : g))
      )
    }
  }

  const handleAddGuruSmk = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!namaGuruBaru.trim() || !emailGuruBaru.trim()) return
    setSaving(true)
    try {
      const { error } = await supabase.from('guru').insert({
        nama_lengkap: namaGuruBaru.trim(),
        email: emailGuruBaru.trim().toLowerCase(),
        NUPTK: nuptkGuruBaru.trim() || null,
        jabatan: jabatanGuruBaru.trim() || 'Guru SMK',
        role: 'guru',
        unit_mengajar: 'SMK',
      })
      if (error) throw error
      setNamaGuruBaru('')
      setEmailGuruBaru('')
      setNuptkGuruBaru('')
      showToast('ok', 'Guru SMK berhasil didaftarkan!')
      await fetchAllSmkMaster()
    } catch (err) {
      showToast('err', parseSupabaseError(err, 'Gagal mendaftarkan guru SMK'))
    } finally {
      setSaving(false)
    }
  }

  // Tambah Mapel SMK ke Guru (tabel guru_mapel)
  const handleAssignMapelToGuru = async (guru: GuruMaster) => {
    const pickedMapelId = Number(selectedMapelPerGuru[guru.id] || 0)
    if (!pickedMapelId) {
      showToast('err', 'Pilih mata pelajaran SMK terlebih dahulu')
      return
    }

    const alreadyAssigned = listGuruMapel.some(
      (gm) => gm.guru_id === guru.id && gm.mapel_id === pickedMapelId
    )
    if (alreadyAssigned) {
      showToast('err', 'Mapel tersebut sudah terpasang pada guru ini')
      return
    }

    setAssigningGuruId(guru.id)
    try {
      const { data, error } = await supabase
        .from('guru_mapel')
        .insert({
          guru_id: guru.id,
          mapel_id: pickedMapelId,
        })
        .select('id, guru_id, mapel_id')
        .single()

      if (error) throw error

      if (data) {
        setListGuruMapel((prev) => [...prev, data])
      } else {
        await fetchAllSmkMaster()
      }

      setSelectedMapelPerGuru((prev) => ({ ...prev, [guru.id]: '' }))
      const mapelObj = listMapel.find((m) => m.id === pickedMapelId)
      showToast('ok', `${mapelObj?.nama_mapel || 'Mapel'} ditambahkan ke ${guru.nama_lengkap}`)
    } catch (err) {
      console.error('Detail error guru_mapel:', err)
      showToast('err', parseSupabaseError(err, 'Gagal memasang mapel ke guru'))
    } finally {
      setAssigningGuruId(null)
    }
  }

  // Hapus Mapel SMK dari Guru
  const handleRemoveGuruMapel = async (gmId: number, mapelNama: string) => {
    const { error } = await supabase.from('guru_mapel').delete().eq('id', gmId)
    if (error) {
      showToast('err', parseSupabaseError(error, 'Gagal melepas mapel dari guru'))
    } else {
      setListGuruMapel((prev) => prev.filter((item) => item.id !== gmId))
      showToast('ok', `Mapel ${mapelNama} dilepas`)
    }
  }

  // =========================================================================
  // TAMPILAN LOADING & PENOLAKAN NON-OPERATOR
  // =========================================================================
  if (authChecking) {
    return (
      <div className="h-dvh bg-[#090b10] text-amber-300 flex flex-col items-center justify-center gap-2">
        <Loader2 className="w-7 h-7 animate-spin" />
        <p className="text-xs font-semibold text-slate-400">Memverifikasi akses Operator...</p>
      </div>
    )
  }

  if (!isOperatorVerified) {
    return (
      <div className="h-dvh bg-[#090b10] text-slate-100 flex flex-col items-center justify-center px-5 text-center">
        <div className="w-14 h-14 rounded-2xl bg-rose-500/15 border border-rose-500/40 flex items-center justify-center text-rose-400 mb-3">
          <ShieldAlert className="w-7 h-7" />
        </div>
        <h1 className="text-base font-black text-white">Akses Terbatas (Khusus Operator)</h1>
        <p className="text-xs text-slate-400 max-w-xs mt-1.5 leading-relaxed">
          Halaman Master Data SMK Muna Mustofa hanya dapat dibuka oleh akun dengan hak akses{' '}
          <strong className="text-amber-300">Operator</strong>.
        </p>
        <Link
          href="/smk"
          className="mt-5 px-4 py-2 rounded-xl bg-amber-400 text-slate-950 font-extrabold text-xs hover:bg-amber-300 transition"
        >
          Kembali ke Portal SMK
        </Link>
      </div>
    )
  }

  // Filter Pencarian Cepat & Urutan Abjad untuk Dropdown
  const q = searchQuery.toLowerCase()
  const filteredKelas = listKelas.filter((k) => k.nama_kelas.toLowerCase().includes(q))
  const filteredSiswa = listSiswa.filter(
    (s) =>
      s.nama_lengkap.toLowerCase().includes(q) ||
      (s.nisn || '').toLowerCase().includes(q) ||
      (s.nis || '').toLowerCase().includes(q)
  )
  const filteredMapel = listMapel.filter(
    (m) =>
      m.nama_mapel.toLowerCase().includes(q) || (m.kode_mapel || '').toLowerCase().includes(q)
  )
  const filteredGuru = listGuru.filter(
    (g) =>
      g.nama_lengkap.toLowerCase().includes(q) || (g.email || '').toLowerCase().includes(q)
  )
  const sortedMapelForDropdown = [...listMapel].sort((a, b) =>
    a.nama_mapel.localeCompare(b.nama_mapel)
  )

  return (
    <div className="h-dvh max-h-dvh overflow-hidden bg-[#080a0f] text-slate-100 flex flex-col relative selection:bg-amber-500/30">
      <style jsx global>{`
        @keyframes lanternSway {
          0%, 100% {
            transform: rotate(-2.5deg);
          }
          50% {
            transform: rotate(2.5deg);
          }
        }
        .lantern-pendulum {
          transform-origin: top center;
          animation: lanternSway 3.4s ease-in-out infinite;
        }
        .lantern-scroll::-webkit-scrollbar {
          width: 4px;
        }
        .lantern-scroll::-webkit-scrollbar-thumb {
          background: rgba(251, 191, 36, 0.25);
          border-radius: 9999px;
        }
      `}</style>

      {/* Notifikasi Toast Mengambang */}
      {toastMsg && (
        <div
          className={`fixed top-14 left-1/2 -translate-x-1/2 z-50 max-w-[92vw] px-3.5 py-2 rounded-2xl text-xs font-bold shadow-2xl border flex items-center gap-1.5 backdrop-blur-md ${
            toastMsg.type === 'ok'
              ? 'bg-emerald-950/95 border-emerald-500/50 text-emerald-200'
              : 'bg-rose-950/95 border-rose-500/50 text-rose-200'
          }`}
        >
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
          <span className="break-words">{toastMsg.text}</span>
        </div>
      )}

      {/* =====================================================================
          1. HEADER COMPACT MOBILE-FIRST
         ===================================================================== */}
      <header className="shrink-0 z-30 bg-[#0b0e16]/90 backdrop-blur-md border-b border-white/10 px-3 py-2.5">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Link
              href="/smk"
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 transition shrink-0"
              title="Kembali ke Dashboard SMK"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h1 className="text-xs sm:text-sm font-black tracking-tight text-white truncate">
                  MASTER DATA SMK
                </h1>
                <span className="px-1.5 py-0.5 rounded bg-amber-400/15 border border-amber-400/40 text-amber-300 text-[9px] font-black shrink-0">
                  OPERATOR
                </span>
              </div>
              <p className="text-[10px] text-slate-400 truncate">
                SMK Muna Mustofa • Kompetensi Keahlian DKV
              </p>
            </div>
          </div>

          <div className="text-[10px] font-bold text-amber-300/90 bg-amber-400/10 border border-amber-400/25 px-2.5 py-1 rounded-full shrink-0">
            {activeTab === 'kelas' && `${listKelas.length} Kelas`}
            {activeTab === 'siswa' && `${listSiswa.length} Siswa`}
            {activeTab === 'mapel' && `${listMapel.length} Mapel`}
            {activeTab === 'guru' && `${listGuru.length} Guru`}
          </div>
        </div>
      </header>

      {/* =====================================================================
          2. STRIP NAVIGASI LENTERA MELUNCUR (MOBILE HORIZONTAL LANTERN BAR)
         ===================================================================== */}
      <div className="lg:hidden shrink-0 z-20 bg-[#090c14] border-b border-white/10 px-2.5 pt-2 pb-2.5">
        <div className="relative grid grid-cols-4 gap-1 bg-black/40 p-1 rounded-2xl border border-white/5">
          <div
            className="pointer-events-none absolute top-0 bottom-0 w-1/4 transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] flex flex-col items-center"
            style={{
              transform: `translateX(${activeTabIndex * 100}%)`,
            }}
          >
            <div className="absolute inset-1 rounded-xl bg-amber-400/15 blur-sm border border-amber-400/40" />
            <div className="lantern-pendulum -mt-1.5 z-10">
              <svg width="20" height="24" viewBox="0 0 24 28" className="overflow-visible">
                <line x1="12" y1="0" x2="12" y2="5" stroke="#fbbf24" strokeWidth="1.5" />
                <path d="M7 7 L17 7 L19 10 L5 10 Z" fill="#1e293b" stroke="#fbbf24" strokeWidth="1.2" />
                <rect
                  x="7"
                  y="10"
                  width="10"
                  height="11"
                  rx="2"
                  fill="#fbbf24"
                  className="drop-shadow-[0_0_8px_rgba(251,191,36,0.95)]"
                />
                <circle cx="12" cy="15.5" r="2.5" fill="#ffffff" />
                <path d="M6 21 L18 21 L16 24 L8 24 Z" fill="#1e293b" stroke="#fbbf24" strokeWidth="1.2" />
              </svg>
            </div>
          </div>

          {TABS.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.key
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => {
                  setActiveTab(tab.key)
                  setSearchQuery('')
                }}
                className={`relative z-10 pt-4 pb-1.5 px-1 rounded-xl flex flex-col items-center justify-center gap-0.5 transition-all duration-300 cursor-pointer ${
                  isActive
                    ? 'text-amber-200 font-black [text-shadow:0_0_12px_rgba(251,191,36,0.85)]'
                    : 'text-slate-500 hover:text-slate-300 font-semibold opacity-55'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span className="text-[10px] tracking-wide">{tab.shortLabel}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* =====================================================================
          3. AREA UTAMA: SIDEBAR LENTERA DESKTOP + KOLOM SCROLL KONTEN
         ===================================================================== */}
      <div className="flex-1 min-h-0 max-w-5xl w-full mx-auto flex flex-col lg:flex-row gap-4 p-3">
        {/* SIDEBAR LENTERA VERTIKAL (DESKTOP) */}
        <aside className="hidden lg:flex w-64 shrink-0 rounded-2xl bg-[#0b0e17] border border-white/10 p-4 flex-col justify-between relative overflow-hidden">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-400/80 mb-5 px-2">
              LANTERN • MASTER SMK
            </p>

            <div className="relative space-y-2">
              <div
                className="pointer-events-none absolute left-0 right-0 h-14 transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] flex items-center"
                style={{
                  transform: `translateY(${activeTabIndex * 64}px)`,
                }}
              >
                <div className="w-full h-full rounded-xl bg-gradient-to-r from-amber-400/20 via-amber-400/10 to-transparent border-l-2 border-amber-400 shadow-[0_0_25px_rgba(251,191,36,0.18)]" />
                <div className="lantern-pendulum absolute left-3">
                  <svg width="26" height="34" viewBox="0 0 26 34" className="overflow-visible">
                    <line x1="13" y1="0" x2="13" y2="6" stroke="#fbbf24" strokeWidth="1.5" />
                    <path d="M7 8 L19 8 L21 12 L5 12 Z" fill="#1e293b" stroke="#fbbf24" strokeWidth="1.3" />
                    <rect
                      x="7"
                      y="12"
                      width="12"
                      height="14"
                      rx="2.5"
                      fill="#fbbf24"
                      className="drop-shadow-[0_0_12px_rgba(251,191,36,0.95)]"
                    />
                    <circle cx="13" cy="19" r="3" fill="#ffffff" />
                    <path d="M6 26 L20 26 L18 30 L8 30 Z" fill="#1e293b" stroke="#fbbf24" strokeWidth="1.3" />
                  </svg>
                </div>
              </div>

              {TABS.map((tab) => {
                const Icon = tab.icon
                const isActive = activeTab === tab.key
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => {
                      setActiveTab(tab.key)
                      setSearchQuery('')
                    }}
                    className={`relative z-10 w-full h-14 pl-12 pr-3 rounded-xl flex items-center justify-between transition-all duration-300 cursor-pointer ${
                      isActive
                        ? 'text-amber-200 font-extrabold [text-shadow:0_0_14px_rgba(251,191,36,0.85)]'
                        : 'text-slate-500 hover:text-slate-300 font-semibold opacity-50 hover:opacity-80'
                    }`}
                  >
                    <span className="text-xs tracking-wide">{tab.label}</span>
                    <Icon className="w-4 h-4" />
                  </button>
                )
              })}
            </div>
          </div>

          <div className="rounded-xl bg-amber-400/5 border border-amber-400/20 p-3 text-[11px] text-slate-400 leading-relaxed">
            <span className="text-amber-300 font-bold block mb-0.5">Info Isolasi Data:</span>
            Semua data yang diinput di sini otomatis berlabel{' '}
            <code className="text-amber-200">jenjang = &apos;SMK&apos;</code> dan terpisah dari SMP.
          </div>
        </aside>

        {/* ===================================================================
            PANEL KONTEN UTAMA (BISA DI-SCROLL DI DALAM KOLOM)
           =================================================================== */}
        <main className="flex-1 min-h-0 rounded-2xl bg-[#0e121c]/95 border border-white/10 flex flex-col overflow-hidden shadow-xl">
          <div className="shrink-0 p-3 border-b border-white/10 flex items-center justify-between gap-2 bg-black/20">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={`Cari data ${activeTab} SMK...`}
                className="w-full bg-white/5 border border-white/10 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-400/60"
              />
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto lantern-scroll p-3 pb-28 space-y-4">
            {/* ===============================================================
                TAB 1: KELOLA KELAS SMK (DKV)
               =============================================================== */}
            {activeTab === 'kelas' && (
              <>
                <form
                  onSubmit={handleAddKelas}
                  className="rounded-xl bg-amber-400/[0.04] border border-amber-400/25 p-3 space-y-2.5"
                >
                  <div className="flex items-center justify-between">
                    <h2 className="text-xs font-extrabold text-amber-300 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" /> Tambah Rombel / Kelas DKV
                    </h2>
                    <span className="text-[10px] text-slate-400">Jurusan: DKV</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <input
                      type="text"
                      required
                      value={namaKelas}
                      onChange={(e) => setNamaKelas(e.target.value)}
                      placeholder="Nama Kelas (cth: X DKV)"
                      className="bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-400"
                    />

                    <select
                      value={tingkatKelas}
                      onChange={(e) => setTingkatKelas(e.target.value)}
                      className="bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                    >
                      <option value="X">Tingkat X (Fase E)</option>
                      <option value="XI">Tingkat XI (Fase F)</option>
                      <option value="XII">Tingkat XII (Fase F)</option>
                    </select>

                    <select
                      value={waliKelasId}
                      onChange={(e) => setWaliKelasId(e.target.value)}
                      className="bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                    >
                      <option value="">-- Pilih Wali Kelas (Opsional) --</option>
                      {listGuru.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.nama_lengkap}
                        </option>
                      ))}
                    </select>
                  </div>

                  <button
                    type="submit"
                    disabled={saving}
                    className="w-full sm:w-auto px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs flex items-center justify-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{saving ? 'Menyimpan...' : 'Simpan Kelas DKV'}</span>
                  </button>
                </form>

                <div className="space-y-2">
                  <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Daftar Kelas Terdaftar ({filteredKelas.length})
                  </h3>

                  {loadingData ? (
                    <p className="text-xs text-slate-500 py-4 text-center">Memuat data kelas...</p>
                  ) : filteredKelas.length === 0 ? (
                    <p className="text-xs text-slate-500 py-6 text-center bg-white/[0.02] rounded-xl border border-white/5">
                      Belum ada kelas SMK. Silakan buat kelas X DKV, XI DKV, atau XII DKV di atas.
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {filteredKelas.map((k) => {
                        const wali = listGuru.find((g) => g.id === k.wali_kelas_id)
                        return (
                          <div
                            key={k.id}
                            className="rounded-xl bg-white/[0.03] border border-white/10 p-3 flex items-center justify-between gap-2"
                          >
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-black text-white">{k.nama_kelas}</span>
                                <span className="px-1.5 py-0.5 rounded bg-amber-400/15 text-amber-300 text-[9px] font-bold">
                                  Tingkat {k.tingkat || '-'}
                                </span>
                              </div>
                              <p className="text-[10px] text-slate-400 truncate mt-0.5">
                                Wali: {wali ? wali.nama_lengkap : 'Belum ditentukan'}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleDeleteKelas(k.id, k.nama_kelas)}
                              className="p-2 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition cursor-pointer shrink-0"
                              title="Hapus Kelas"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </>
            )}

            {/* ===============================================================
                TAB 2: KELOLA SISWA SMK (DKV)
               =============================================================== */}
            {activeTab === 'siswa' && (
              <>
                <form
                  onSubmit={handleAddSiswa}
                  className="rounded-xl bg-amber-400/[0.04] border border-amber-400/25 p-3 space-y-2.5"
                >
                  <h2 className="text-xs font-extrabold text-amber-300 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" /> Input Peserta Didik Baru (SMK DKV)
                  </h2>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <select
                      required
                      value={kelasSiswaId}
                      onChange={(e) => setKelasSiswaId(e.target.value)}
                      className="bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                    >
                      <option value="">-- Pilih Kelas DKV --</option>
                      {listKelas.map((k) => (
                        <option key={k.id} value={k.id}>
                          {k.nama_kelas}
                        </option>
                      ))}
                    </select>

                    <input
                      type="text"
                      required
                      value={namaSiswa}
                      onChange={(e) => setNamaSiswa(e.target.value)}
                      placeholder="Nama Lengkap Siswa"
                      className="bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-400"
                    />

                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={nisSiswa}
                        onChange={(e) => setNisSiswa(e.target.value)}
                        placeholder="NIS (Opsional)"
                        className="bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-400"
                      />
                      <input
                        type="text"
                        value={nisnSiswa}
                        onChange={(e) => setNisnSiswa(e.target.value)}
                        placeholder="NISN (Opsional)"
                        className="bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-400"
                      />
                    </div>

                    <select
                      value={jkSiswa}
                      onChange={(e) => setJkSiswa(e.target.value)}
                      className="bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                    >
                      <option value="L">Laki-laki (L)</option>
                      <option value="P">Perempuan (P)</option>
                    </select>
                  </div>

                  <button
                    type="submit"
                    disabled={saving}
                    className="w-full sm:w-auto px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs flex items-center justify-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{saving ? 'Menyimpan...' : 'Simpan Siswa SMK'}</span>
                  </button>
                </form>

                <div className="space-y-2">
                  <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Daftar Siswa SMK ({filteredSiswa.length})
                  </h3>

                  {filteredSiswa.length === 0 ? (
                    <p className="text-xs text-slate-500 py-6 text-center bg-white/[0.02] rounded-xl border border-white/5">
                      Belum ada data siswa SMK DKV.
                    </p>
                  ) : (
                    <div className="space-y-1.5">
                      {filteredSiswa.map((s) => {
                        const kelasObj = listKelas.find((k) => k.id === s.kelas_id)
                        return (
                          <div
                            key={s.id}
                            className="rounded-xl bg-white/[0.03] border border-white/10 p-2.5 flex items-center justify-between gap-2"
                          >
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-white truncate">
                                {s.nama_lengkap}
                              </p>
                              <p className="text-[10px] text-slate-400 truncate">
                                Kelas:{' '}
                                <span className="text-amber-300 font-semibold">
                                  {kelasObj?.nama_kelas || '-'}
                                </span>{' '}
                                • NISN: {s.nisn || '-'} • {s.jenis_kelamin || '-'}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleDeleteSiswa(s.id, s.nama_lengkap)}
                              className="p-2 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition cursor-pointer shrink-0"
                              title="Hapus Siswa"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </>
            )}

            {/* ===============================================================
                TAB 3: KELOLA MATA PELAJARAN SMK (GABUNGAN SEMUA TINGKAT)
               =============================================================== */}
            {activeTab === 'mapel' && (
              <>
                <form
                  onSubmit={handleAddMapel}
                  className="rounded-xl bg-amber-400/[0.04] border border-amber-400/25 p-3 space-y-2.5"
                >
                  <div className="flex items-center justify-between">
                    <h2 className="text-xs font-extrabold text-amber-300 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" /> Tambah Mata Pelajaran SMK (DKV)
                    </h2>
                    <span className="text-[10px] text-slate-400">1 Mapel berlaku untuk X, XI, XII</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input
                      type="text"
                      required
                      value={namaMapel}
                      onChange={(e) => setNamaMapel(e.target.value)}
                      placeholder="Nama Mapel (cth: Bahasa Indonesia)"
                      className="bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-400"
                    />

                    <div className="grid grid-cols-3 gap-2">
                      <input
                        type="text"
                        value={kodeMapel}
                        onChange={(e) => setKodeMapel(e.target.value)}
                        placeholder="Kode (BIND)"
                        className="bg-black/40 border border-white/10 rounded-xl px-2.5 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-400"
                      />
                      <div className="relative">
                        <input
                          type="number"
                          min="1"
                          max="24"
                          value={jumlahJp}
                          onChange={(e) => setJumlahJp(e.target.value)}
                          title="Jumlah Jam Pelajaran (JP) per Minggu"
                          className="w-full bg-black/40 border border-white/10 rounded-xl pl-2.5 pr-7 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                        />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] text-slate-400 font-bold">
                          JP
                        </span>
                      </div>
                      <div className="relative">
                        <input
                          type="number"
                          min="1"
                          max="99"
                          value={urutanMapel}
                          onChange={(e) => setUrutanMapel(e.target.value)}
                          title="Nomor Urut Rapor"
                          className="w-full bg-black/40 border border-white/10 rounded-xl pl-2.5 pr-8 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                        />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] text-slate-400 font-bold">
                          Urut
                        </span>
                      </div>
                    </div>

                    <select
                      value={kelompokMapel}
                      onChange={(e) => setKelompokMapel(e.target.value)}
                      className="bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                    >
                      <option value="Kejuruan DKV">Kelompok Kejuruan / Produktif DKV</option>
                      <option value="Muatan Umum">Kelompok Mata Pelajaran Umum</option>
                      <option value="Muatan Lokal / Pesantren">Muatan Lokal / Kepesantrenan</option>
                    </select>

                    <select
                      value={tingkatMapel}
                      onChange={(e) => setTingkatMapel(e.target.value)}
                      className="bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                    >
                      <option value="Semua Tingkat">Semua Tingkat (X, XI, XII)</option>
                      <option value="X">Khusus Kelas X (Fase E)</option>
                      <option value="XI">Khusus Kelas XI (Fase F)</option>
                      <option value="XII">Khusus Kelas XII (Fase F)</option>
                    </select>

                    <select
                      value={semesterMapel}
                      onChange={(e) => setSemesterMapel(e.target.value)}
                      className="bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                    >
                      <option value="Ganjil & Genap">Semester Ganjil &amp; Genap</option>
                      <option value="Ganjil">Semester Ganjil</option>
                      <option value="Genap">Semester Genap</option>
                    </select>

                    <input
                      type="text"
                      value={tahunAjaranMapel}
                      onChange={(e) => setTahunAjaranMapel(e.target.value)}
                      placeholder="Tahun Ajaran (cth: 2026/2027)"
                      className="bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-400"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={saving}
                    className="w-full sm:w-auto px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs flex items-center justify-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{saving ? 'Menyimpan...' : 'Simpan Mapel SMK'}</span>
                  </button>
                </form>

                <div className="space-y-2">
                  <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Daftar Mapel SMK ({filteredMapel.length})
                  </h3>

                  {filteredMapel.length === 0 ? (
                    <p className="text-xs text-slate-500 py-6 text-center bg-white/[0.02] rounded-xl border border-white/5">
                      Belum ada mata pelajaran SMK. Tambahkan mapel umum &amp; produktif DKV di atas.
                    </p>
                  ) : (
                    <div className="space-y-1.5">
                      {filteredMapel.map((m) => (
                        <div
                          key={m.id}
                          className="rounded-xl bg-white/[0.03] border border-white/10 p-2.5 flex items-center justify-between gap-2"
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="px-1.5 py-0.5 rounded bg-white/10 text-slate-300 text-[9px] font-bold">
                                #{m.urutan || '-'}
                              </span>
                              {m.kode_mapel && (
                                <span className="px-1.5 py-0.5 rounded bg-amber-400/15 text-amber-300 text-[9px] font-black">
                                  {m.kode_mapel}
                                </span>
                              )}
                              <p className="text-xs font-bold text-white truncate">{m.nama_mapel}</p>
                            </div>
                            <p className="text-[10px] text-slate-400 truncate mt-0.5">
                              {m.kelompok || 'Kejuruan DKV'} • {m.tingkat || 'Semua Tingkat'} •{' '}
                              {m.jumlah_jp || 2} JP • {m.semester || 'Ganjil & Genap'}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleDeleteMapel(m.id, m.nama_mapel)}
                            className="p-2 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition cursor-pointer shrink-0"
                            title="Hapus Mapel"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}

            {/* ===============================================================
                TAB 4: PENUGASAN UNIT & PEMETAAN MAPEL SMK PER GURU
               =============================================================== */}
            {activeTab === 'guru' && (
              <>
                <form
                  onSubmit={handleAddGuruSmk}
                  className="rounded-xl bg-amber-400/[0.04] border border-amber-400/25 p-3 space-y-2.5"
                >
                  <h2 className="text-xs font-extrabold text-amber-300 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" /> Daftarkan Guru Baru Khusus SMK
                  </h2>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input
                      type="text"
                      required
                      value={namaGuruBaru}
                      onChange={(e) => setNamaGuruBaru(e.target.value)}
                      placeholder="Nama Lengkap & Gelar Guru"
                      className="bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-400"
                    />
                    <input
                      type="email"
                      required
                      value={emailGuruBaru}
                      onChange={(e) => setEmailGuruBaru(e.target.value)}
                      placeholder="Email Login Guru"
                      className="bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-400"
                    />
                    <input
                      type="text"
                      value={nuptkGuruBaru}
                      onChange={(e) => setNuptkGuruBaru(e.target.value)}
                      placeholder="NUPTK (Opsional)"
                      className="bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-400"
                    />
                    <input
                      type="text"
                      value={jabatanGuruBaru}
                      onChange={(e) => setJabatanGuruBaru(e.target.value)}
                      placeholder="Jabatan (cth: Guru Produktif DKV)"
                      className="bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-400"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={saving}
                    className="w-full sm:w-auto px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs flex items-center justify-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{saving ? 'Menyimpan...' : 'Tambah Guru SMK'}</span>
                  </button>
                </form>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Unit &amp; Mapel Ampuan Guru ({filteredGuru.length})
                    </h3>
                    <span className="text-[9px] text-slate-500">Pilih unit lalu pasangkan mapel SMK</span>
                  </div>

                  <div className="space-y-2.5">
                    {filteredGuru.map((g) => {
                      const currentUnit = (g.unit_mengajar || 'SMP').toUpperCase()
                      const teachesSmk = currentUnit.includes('SMK')

                      const assignedSmkRows = listGuruMapel
                        .filter((gm) => gm.guru_id === g.id)
                        .map((gm) => ({
                          gmId: gm.id,
                          mapel: listMapel.find((m) => m.id === gm.mapel_id),
                        }))
                        .filter((item): item is { gmId: number; mapel: MapelSmk } => Boolean(item.mapel))

                      return (
                        <div
                          key={g.id}
                          className="rounded-xl bg-white/[0.03] border border-white/10 p-3 space-y-2.5"
                        >
                          {/* Baris Atas: Nama Guru & Sakelar Unit */}
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-white truncate">
                                {g.nama_lengkap}
                              </p>
                              <p className="text-[10px] text-slate-400 truncate">
                                {g.email || '-'} • Role: {(g.role || 'guru').toUpperCase()}
                              </p>
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              {(['SMP', 'SMK', 'SMP & SMK'] as const).map((unitOpt) => {
                                const active = currentUnit === unitOpt
                                return (
                                  <button
                                    key={unitOpt}
                                    type="button"
                                    onClick={() => handleToggleGuruUnit(g, unitOpt)}
                                    className={`px-2 py-1 rounded-lg text-[9px] font-black transition cursor-pointer ${
                                      active
                                        ? 'bg-amber-400 text-slate-950 shadow-sm'
                                        : 'bg-white/5 text-slate-400 hover:bg-white/10'
                                    }`}
                                  >
                                    {unitOpt}
                                  </button>
                                )
                              })}
                            </div>
                          </div>

                          {/* Bagian Pemilih Mapel SMK */}
                          {teachesSmk && (
                            <div className="pt-2 border-t border-white/10 space-y-2">
                              {assignedSmkRows.length > 0 ? (
                                <div className="flex flex-wrap gap-1.5">
                                  {assignedSmkRows.map(({ gmId, mapel }) => (
                                    <span
                                      key={gmId}
                                      className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-lg bg-amber-400/15 border border-amber-400/35 text-amber-200 text-[10px] font-bold"
                                    >
                                      <span>
                                        {mapel.kode_mapel ? `[${mapel.kode_mapel}] ` : ''}
                                        {mapel.nama_mapel}
                                        {mapel.tingkat && mapel.tingkat !== 'Semua Tingkat'
                                          ? ` • Tingkat ${mapel.tingkat}`
                                          : ''}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => handleRemoveGuruMapel(gmId, mapel.nama_mapel)}
                                        className="p-0.5 rounded hover:bg-rose-500/30 text-amber-300 hover:text-rose-200 transition cursor-pointer"
                                        title="Hapus mapel dari guru ini"
                                      >
                                        <X className="w-3 h-3" />
                                      </button>
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-[10px] text-slate-500 italic">
                                  Belum ada mapel SMK yang dipasangkan ke guru ini.
                                </p>
                              )}

                              {/* Dropdown Pilih Mapel SMK (Urut Abjad A-Z & Bersih) */}
                              <div className="flex items-center gap-1.5">
                                <select
                                  value={selectedMapelPerGuru[g.id] || ''}
                                  onChange={(e) =>
                                    setSelectedMapelPerGuru((prev) => ({
                                      ...prev,
                                      [g.id]: e.target.value,
                                    }))
                                  }
                                  className="flex-1 min-w-0 bg-black/50 border border-white/15 rounded-xl px-2.5 py-1.5 text-[11px] text-white focus:outline-none focus:border-amber-400"
                                >
                                  <option value="">+ Pilih Mapel SMK yang Diampu...</option>
                                  {sortedMapelForDropdown.map((m) => (
                                    <option key={m.id} value={m.id}>
                                      {m.kode_mapel ? `[${m.kode_mapel}] ` : ''}
                                      {m.nama_mapel}
                                      {m.tingkat && m.tingkat !== 'Semua Tingkat'
                                        ? ` — Khusus ${m.tingkat}`
                                        : ''}
                                    </option>
                                  ))}
                                </select>

                                <button
                                  type="button"
                                  disabled={assigningGuruId === g.id || !selectedMapelPerGuru[g.id]}
                                  onClick={() => handleAssignMapelToGuru(g)}
                                  className="px-3 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-[11px] flex items-center gap-1 transition cursor-pointer disabled:opacity-40 shrink-0"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                  <span>{assigningGuruId === g.id ? '...' : 'Pasang'}</span>
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              </>
            )}
          </div>
        </main>
      </div>

      {/* Kelelawar Piksel di Pojok Kiri Bawah */}
      <PixelBatSwitcher isDarkMode={true} variant="floating" />
    </div>
  )
}