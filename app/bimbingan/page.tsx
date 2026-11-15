'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { motion } from 'framer-motion'
import { useAuthRole } from '@/hooks/useAuthRole'

// Helper instansiasi Supabase aman untuk mencegah error prerender SSG Vercel
const getSupabaseUrl = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://kvrulbdvgxfrtmznpjnm.supabase.co'
  return url.replace(/['"]/g, '').trim()
}

const getSupabaseAnonKey = () => {
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder'
  return key.replace(/['"]/g, '').trim()
}

const supabase = createClient(getSupabaseUrl(), getSupabaseAnonKey())

interface SiswaPerwalian {
  id?: string | number
  nama_lengkap: string
  nisn?: string
  jenis_kelamin?: string
  kelas_id?: number
}

interface OptionItem {
  id: number
  nama: string
  jenjang: string
}

interface BimbinganRecord {
  id?: string
  created_at?: string
  tanggal: string
  nama_siswa: string
  kelas: string
  jenis_masalah: string
  masalah: string
  solusi: string
  keterangan_hukuman?: string
  is_penanganan_selesai?: boolean
}

// Helper untuk mengekstrak tingkat kelas (7 - 12) baik format angka (7, 10) maupun Romawi (VII, X, XII)
function getGradeOrder(namaKelas: string): number {
  const clean = (namaKelas || '').trim().toUpperCase()
  const numMatch = clean.match(/^(1[0-2]|[7-9])\b/)
  if (numMatch) {
    return parseInt(numMatch[1], 10)
  }
  if (/^XII\b/.test(clean) || clean.startsWith('XII ') || clean.startsWith('XII-')) return 12
  if (/^XI\b/.test(clean) || clean.startsWith('XI ') || clean.startsWith('XI-')) return 11
  if (/^X\b/.test(clean) || clean.startsWith('X ') || clean.startsWith('X-')) return 10
  if (/^IX\b/.test(clean) || clean.startsWith('IX ') || clean.startsWith('IX-')) return 9
  if (/^VIII\b/.test(clean) || clean.startsWith('VIII ') || clean.startsWith('VIII-')) return 8
  if (/^VII\b/.test(clean) || clean.startsWith('VII ') || clean.startsWith('VII-')) return 7
  return 99
}

function sortKelas7to12(a: OptionItem, b: OptionItem): number {
  const gradeA = getGradeOrder(a.nama)
  const gradeB = getGradeOrder(b.nama)
  if (gradeA !== gradeB) return gradeA - gradeB
  return a.nama.localeCompare(b.nama, 'id', { numeric: true, sensitivity: 'base' })
}

export default function BimbinganWaliPage() {
  const router = useRouter()
  const dropdownContainerRef = useRef<HTMLDivElement>(null)

  const [userDisplayName, setUserDisplayName] = useState('MEMUAT...')
  const [userNuptkDisplay, setUserNuptkDisplay] = useState('-')
  const [isStrictOperatorRole, setIsStrictOperatorRole] = useState(false)
  const [waliKelasAssignedId, setWaliKelasAssignedId] = useState<number | null>(null)
  const [activeTab, setActiveTab] = useState<'input' | 'rekap'>('rekap')
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  const { isOperator, loading: loadingRole } = useAuthRole()

  const formatNuptk = (val: unknown): string => {
    if (!val) return '-'
    const str = String(val).trim()
    if (
      str === '' ||
      str.toUpperCase() === 'EMPTY' ||
      str.toUpperCase() === 'NULL' ||
      str === '-'
    ) {
      return '-'
    }
    return str
  }

  const [isDarkMode, setIsDarkMode] = useState<boolean>(false)

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme')
    if (savedTheme === 'dark') {
      setIsDarkMode(true)
    }
  }, [])

  // Tutup popover siswa saat klik di luar area
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownContainerRef.current &&
        !dropdownContainerRef.current.contains(e.target as Node)
      ) {
        setIsDropdownSiswaOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Options Kelas (Terurut dari Kelas 7 - 12)
  const [kelasList, setKelasList] = useState<OptionItem[]>([])
  const [selectedJenjangInput, setSelectedJenjangInput] = useState<'ALL' | 'SMP' | 'SMK'>('ALL')
  const [selectedKelasIdInput, setSelectedKelasIdInput] = useState<string>('')

  // State Siswa & Multi-Select Lintas Jenjang
  const [allSiswaList, setAllSiswaList] = useState<SiswaPerwalian[]>([])
  const [selectedSiswaList, setSelectedSiswaList] = useState<SiswaPerwalian[]>([])
  const [searchSiswaInput, setSearchSiswaInput] = useState('')
  const [isDropdownSiswaOpen, setIsDropdownSiswaOpen] = useState(false)

  // State Input Catatan Bimbingan
  const [tanggal, setTanggal] = useState('')
  const [jenisMasalah, setJenisMasalah] = useState('Kedisiplinan')
  const [masalah, setMasalah] = useState('')
  const [solusi, setSolusi] = useState('')

  const [saving, setSaving] = useState(false)

  // State Rekapitulasi & Bulk Action Operator (Selesai Massal + Hapus Massal)
  const [rekapList, setRekapList] = useState<BimbinganRecord[]>([])
  const [filterJenjangRekap, setFilterJenjangRekap] = useState<'ALL' | 'SMP' | 'SMK'>('ALL')
  const [filterKelasIdRekap, setFilterKelasIdRekap] = useState('')
  const [filterJenis, setFilterJenis] = useState('')
  const [filterStatusRekap, setFilterStatusRekap] = useState<'ALL' | 'PROSES' | 'SELESAI'>('ALL')
  const [searchKataKunci, setSearchKataKunci] = useState('')
  const [loadingRekap, setLoadingRekap] = useState(false)
  const [selectedRekapIds, setSelectedRekapIds] = useState<string[]>([])
  const [bulkProcessing, setBulkProcessing] = useState(false)

  useEffect(() => {
    let isMounted = true

    async function initPage() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        if (isMounted) router.replace('/login')
        return
      }

      const rawEmail = user.email || ''
      const cleanEmail = rawEmail.trim().toLowerCase()

      const { data: dataGuruLogin } = await supabase
        .from('guru')
        .select('id, nama_lengkap, role, NUPTK, email, jabatan')
        .ilike('email', cleanEmail)
        .maybeSingle()

      if (isMounted) {
        if (dataGuruLogin && dataGuruLogin.nama_lengkap) {
          const namaLengkapResmi = dataGuruLogin.nama_lengkap.trim()
          const cleanNuptk = formatNuptk(dataGuruLogin.NUPTK)
          const isUserStrictOperator =
            (dataGuruLogin.role || '').toLowerCase() === 'operator'

          setUserDisplayName(namaLengkapResmi.toUpperCase())
          setUserNuptkDisplay(cleanNuptk)
          setIsStrictOperatorRole(isUserStrictOperator)

          if (!isUserStrictOperator && dataGuruLogin.id) {
            const { data: kelasBinaan } = await supabase
              .from('kelas')
              .select('id')
              .eq('wali_kelas_id', dataGuruLogin.id)
              .limit(1)
              .maybeSingle()

            if (isMounted) {
              setWaliKelasAssignedId(kelasBinaan?.id || null)
            }
          }
        } else {
          const fallbackName =
            user.user_metadata?.full_name || cleanEmail.split('@')[0] || 'GURU'
          setUserDisplayName(fallbackName.toUpperCase())
          setUserNuptkDisplay('-')
          setIsStrictOperatorRole(isOperator)
        }
      }

      const { data: dataKelas } = await supabase
        .from('kelas')
        .select('id, nama_kelas, jenjang')

      if (dataKelas && isMounted) {
        const mappedKelas: OptionItem[] = dataKelas.map((k: any) => ({
          id: Number(k.id),
          nama: k.nama_kelas,
          jenjang: (k.jenjang || 'SMP').toUpperCase(),
        }))
        // Urutkan otomatis dari kelas 7 hingga kelas 12
        mappedKelas.sort(sortKelas7to12)
        setKelasList(mappedKelas)
      }

      fetchAllSiswa()
    }

    const todayStr = new Date().toISOString().split('T')[0]
    setTanggal(todayStr)

    if (!loadingRole) {
      initPage()
    }

    return () => {
      isMounted = false
    }
  }, [loadingRole, isOperator, router])

  async function fetchAllSiswa() {
    try {
      const { data } = await supabase
        .from('siswa')
        .select('id, nama_lengkap, nisn, jenis_kelamin, kelas_id')
        .order('nama_lengkap', { ascending: true })

      if (data) setAllSiswaList(data)
    } catch (err) {
      console.error('Error fetching siswa:', err)
    }
  }

  const getKelasInfoById = (kelasId?: number): { nama: string; jenjang: string } => {
    if (!kelasId) return { nama: 'UMUM', jenjang: 'SMP' }
    const found = kelasList.find((k) => Number(k.id) === Number(kelasId))
    if (!found) return { nama: 'UMUM', jenjang: 'SMP' }
    return { nama: found.nama, jenjang: found.jenjang }
  }

  const getJenjangByKelasNama = (namaKelas: string): 'SMP' | 'SMK' => {
    const clean = (namaKelas || '').trim().toLowerCase()
    const matched = kelasList.find((k) => k.nama.trim().toLowerCase() === clean)
    if (matched) {
      return matched.jenjang === 'SMK' ? 'SMK' : 'SMP'
    }
    const grade = getGradeOrder(namaKelas)
    if (grade >= 10 && grade <= 12) return 'SMK'
    if (clean.includes('smk') || clean.includes('dkv')) return 'SMK'
    return 'SMP'
  }

  const kelasOptionsInput = useMemo(() => {
    const filtered =
      selectedJenjangInput === 'ALL'
        ? kelasList
        : kelasList.filter((k) => k.jenjang === selectedJenjangInput)
    return [...filtered].sort(sortKelas7to12)
  }, [kelasList, selectedJenjangInput])

  const filteredSiswaOptions = useMemo(() => {
    return allSiswaList.filter((s) => {
      const info = getKelasInfoById(s.kelas_id)
      if (selectedJenjangInput !== 'ALL' && info.jenjang !== selectedJenjangInput) {
        return false
      }
      if (selectedKelasIdInput && String(s.kelas_id) !== selectedKelasIdInput) {
        return false
      }
      if (searchSiswaInput.trim()) {
        const kw = searchSiswaInput.trim().toLowerCase()
        const matchNama = s.nama_lengkap.toLowerCase().includes(kw)
        const matchNisn = (s.nisn || '').toLowerCase().includes(kw)
        const matchKelas = info.nama.toLowerCase().includes(kw)
        return matchNama || matchNisn || matchKelas
      }
      return true
    })
  }, [allSiswaList, selectedJenjangInput, selectedKelasIdInput, searchSiswaInput, kelasList])

  const isSiswaSelected = (siswa: SiswaPerwalian): boolean => {
    return selectedSiswaList.some((item) =>
      siswa.id !== undefined && item.id !== undefined
        ? String(item.id) === String(siswa.id)
        : item.nama_lengkap === siswa.nama_lengkap
    )
  }

  const toggleSelectSiswa = (siswa: SiswaPerwalian) => {
    setSelectedSiswaList((prev) => {
      const exists = prev.some((item) =>
        siswa.id !== undefined && item.id !== undefined
          ? String(item.id) === String(siswa.id)
          : item.nama_lengkap === siswa.nama_lengkap
      )
      if (exists) {
        return prev.filter((item) =>
          siswa.id !== undefined && item.id !== undefined
            ? String(item.id) !== String(siswa.id)
            : item.nama_lengkap !== siswa.nama_lengkap
        )
      }
      return [...prev, siswa]
    })
  }

  const handleSelectAllFiltered = () => {
    setSelectedSiswaList((prev) => {
      const merged = [...prev]
      for (const s of filteredSiswaOptions) {
        const exists = merged.some((item) =>
          s.id !== undefined && item.id !== undefined
            ? String(item.id) === String(s.id)
            : item.nama_lengkap === s.nama_lengkap
        )
        if (!exists) merged.push(s)
      }
      return merged
    })
  }

  const selectedSummary = useMemo(() => {
    let smpCount = 0
    let smkCount = 0
    for (const s of selectedSiswaList) {
      const info = getKelasInfoById(s.kelas_id)
      if (info.jenjang === 'SMK') smkCount++
      else smpCount++
    }
    return { smpCount, smkCount }
  }, [selectedSiswaList, kelasList])

  async function fetchRekapBimbingan() {
    setLoadingRekap(true)
    try {
      let query = supabase
        .from('bimbingan_wali')
        .select('*')
        .order('created_at', { ascending: false })

      if (filterKelasIdRekap) {
        const kelasObj = kelasList.find((k) => String(k.id) === filterKelasIdRekap)
        if (kelasObj) {
          query = query.eq('kelas', kelasObj.nama)
        }
      }

      if (filterJenis) query = query.eq('jenis_masalah', filterJenis)

      if (filterStatusRekap === 'PROSES') {
        query = query.eq('is_penanganan_selesai', false)
      } else if (filterStatusRekap === 'SELESAI') {
        query = query.eq('is_penanganan_selesai', true)
      }

      if (searchKataKunci.trim()) {
        query = query.or(
          `nama_siswa.ilike.%${searchKataKunci.trim()}%,masalah.ilike.%${searchKataKunci.trim()}%`
        )
      }

      const { data } = await query
      if (data) {
        setRekapList(data)
      } else {
        setRekapList([])
      }
    } catch (err) {
      console.error('Error rekap fetch:', err)
    } finally {
      setLoadingRekap(false)
    }
  }

  useEffect(() => {
    if (activeTab === 'rekap') {
      fetchRekapBimbingan()
    }
  }, [activeTab, filterKelasIdRekap, filterJenis, filterStatusRekap, searchKataKunci, kelasList])

  const displayedRekapList = useMemo(() => {
    if (filterJenjangRekap === 'ALL') return rekapList
    return rekapList.filter((item) => getJenjangByKelasNama(item.kelas) === filterJenjangRekap)
  }, [rekapList, filterJenjangRekap, kelasList])

  // Sinkronkan selectedRekapIds jika filter berubah
  useEffect(() => {
    const visibleIds = new Set(
      displayedRekapList.filter((item) => item.id).map((item) => String(item.id))
    )
    setSelectedRekapIds((prev) => prev.filter((id) => visibleIds.has(id)))
  }, [displayedRekapList])

  const handleSimpanBimbingan = async (e: React.FormEvent) => {
    e.preventDefault()
    if (selectedSiswaList.length === 0 || !masalah.trim() || !tanggal) {
      alert('Silakan pilih minimal 1 Siswa dan isi Detail Permasalahan!')
      return
    }

    setSaving(true)
    try {
      const payload = selectedSiswaList.map((siswa) => {
        const info = getKelasInfoById(siswa.kelas_id)
        return {
          tanggal,
          nama_siswa: siswa.nama_lengkap,
          kelas: info.nama,
          jenis_masalah: jenisMasalah,
          masalah: masalah.trim(),
          solusi: solusi.trim(),
          is_penanganan_selesai: false,
        }
      })

      const { error } = await supabase.from('bimbingan_wali').insert(payload)

      if (!error) {
        alert(
          `Catatan kasus bimbingan untuk ${payload.length} siswa (${selectedSummary.smpCount} SMP, ${selectedSummary.smkCount} SMK) berhasil disimpan!`
        )
        setMasalah('')
        setSolusi('')
        setSelectedSiswaList([])
        setSearchSiswaInput('')
        setIsDropdownSiswaOpen(false)
        setActiveTab('rekap')
        fetchRekapBimbingan()
      } else {
        alert('Gagal menyimpan: ' + error.message)
      }
    } catch (err: any) {
      alert('Error: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  const toggleSelectRekapId = (id?: string) => {
    if (!id) return
    const strId = String(id)
    setSelectedRekapIds((prev) =>
      prev.includes(strId) ? prev.filter((item) => item !== strId) : [...prev, strId]
    )
  }

  const allDisplayedIds = useMemo(() => {
    return displayedRekapList.filter((item) => item.id).map((item) => String(item.id))
  }, [displayedRekapList])

  const prosesRekapIds = useMemo(() => {
    return displayedRekapList
      .filter((item) => !item.is_penanganan_selesai && item.id)
      .map((item) => String(item.id))
  }, [displayedRekapList])

  const handleSelectAllDisplayed = () => {
    if (allDisplayedIds.length === 0) return
    const isAllSelected = allDisplayedIds.every((id) => selectedRekapIds.includes(id))
    if (isAllSelected) {
      setSelectedRekapIds([])
    } else {
      setSelectedRekapIds(allDisplayedIds)
    }
  }

  const handleSelectAllProses = () => {
    if (prosesRekapIds.length === 0) return
    const isAllProsesSelected =
      prosesRekapIds.length === selectedRekapIds.length &&
      prosesRekapIds.every((id) => selectedRekapIds.includes(id))
    if (isAllProsesSelected) {
      setSelectedRekapIds([])
    } else {
      setSelectedRekapIds(prosesRekapIds)
    }
  }

  // Konfirmasi Tindak Lanjut MASSAL
  const handleBulkTindakLanjutiOperator = async () => {
    if (!isOperator || selectedRekapIds.length === 0 || bulkProcessing) return

    const defaultKeterangan = 'Anak tersebut sudah dihukum sesuai tata tertib sekolah.'
    const inputKeterangan = prompt(
      `Konfirmasi Penanganan Massal untuk ${selectedRekapIds.length} catatan terpilih:\nMasukkan keterangan tindak lanjut hukuman:`,
      defaultKeterangan
    )

    if (inputKeterangan === null) return

    setBulkProcessing(true)
    try {
      const { error } = await supabase
        .from('bimbingan_wali')
        .update({
          keterangan_hukuman: inputKeterangan.trim(),
          is_penanganan_selesai: true,
        })
        .in('id', selectedRekapIds)

      if (!error) {
        alert(
          `Status penanganan untuk ${selectedRekapIds.length} catatan berhasil dikonfirmasi selesai!`
        )
        setSelectedRekapIds([])
        fetchRekapBimbingan()
      } else {
        alert('Gagal mengupdate penanganan massal: ' + error.message)
      }
    } catch (err: any) {
      alert('Error: ' + err.message)
    } finally {
      setBulkProcessing(false)
    }
  }

  // Hapus MASSAL
  const handleBulkDeleteOperator = async () => {
    if (!isOperator || selectedRekapIds.length === 0 || bulkProcessing) return

    if (
      !confirm(
        `Apakah Anda yakin ingin MENGHAPUS ${selectedRekapIds.length} catatan bimbingan terpilih secara permanen?`
      )
    ) {
      return
    }

    setBulkProcessing(true)
    try {
      const { error } = await supabase
        .from('bimbingan_wali')
        .delete()
        .in('id', selectedRekapIds)

      if (!error) {
        alert(`${selectedRekapIds.length} catatan bimbingan berhasil dihapus!`)
        setSelectedRekapIds([])
        fetchRekapBimbingan()
      } else {
        alert('Gagal menghapus massal: ' + error.message)
      }
    } catch (err: any) {
      alert('Error: ' + err.message)
    } finally {
      setBulkProcessing(false)
    }
  }

  const handleTindakLanjutiOperator = async (item: BimbinganRecord) => {
    if (!isOperator) return

    const defaultKeterangan =
      item.keterangan_hukuman || 'Anak tersebut sudah dihukum sesuai tata tertib sekolah.'
    const inputKeterangan = prompt(
      `Konfirmasi Penanganan untuk ${item.nama_siswa}:\nMasukkan keterangan tindak lanjut hukuman:`,
      defaultKeterangan
    )

    if (inputKeterangan === null) return

    try {
      const { error } = await supabase
        .from('bimbingan_wali')
        .update({
          keterangan_hukuman: inputKeterangan.trim(),
          is_penanganan_selesai: true,
        })
        .eq('id', item.id)

      if (!error) {
        alert('Status penanganan & hukuman berhasil dikonfirmasi!')
        setSelectedRekapIds((prev) => prev.filter((id) => id !== String(item.id)))
        fetchRekapBimbingan()
      } else {
        alert('Gagal mengupdate penanganan: ' + error.message)
      }
    } catch (err: any) {
      alert('Error: ' + err.message)
    }
  }

  const handleDeleteBimbingan = async (id?: string) => {
    if (!isOperator) return
    if (!id || !confirm('Apakah Anda yakin ingin menghapus catatan bimbingan ini?')) return

    const { error } = await supabase.from('bimbingan_wali').delete().eq('id', id)
    if (!error) {
      setSelectedRekapIds((prev) => prev.filter((item) => item !== String(id)))
      fetchRekapBimbingan()
    } else {
      alert('Gagal menghapus: ' + error.message)
    }
  }

  const handleLogout = async () => {
    if (isLoggingOut) return
    setIsLoggingOut(true)

    try {
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('just_logged_in')
      }
      await supabase.auth.signOut({ scope: 'local' })
      router.replace('/login')
    } catch (err) {
      console.error('Logout error:', err)
      router.replace('/login')
    }
  }

  if (loadingRole) {
    return (
      <div
        className={`h-screen w-screen flex items-center justify-center font-sans ${
          isDarkMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-200 text-slate-800'
        }`}
      >
        <div
          className={`p-4 rounded-xl border text-center space-y-1 shadow-xs ${
            isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-300'
          }`}
        >
          <p className="font-bold text-xs">Memuat Halaman Bimbingan...</p>
        </div>
      </div>
    )
  }

  const isAllDisplayedChecked =
    allDisplayedIds.length > 0 && allDisplayedIds.every((id) => selectedRekapIds.includes(id))

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={`h-screen w-screen overflow-hidden font-sans flex flex-col justify-between selection:bg-indigo-500 selection:text-white relative transition-colors duration-300 ${
        isDarkMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-200 text-slate-800'
      }`}
    >
      {/* WATERMARK LOGO */}
      <div
        className={`fixed inset-0 pointer-events-none z-0 flex items-center justify-center select-none print:hidden transition-opacity duration-300 ${
          isDarkMode ? 'opacity-[0.04]' : 'opacity-[0.12]'
        }`}
      >
        <img
          src="/logo-smp.jpg"
          alt="Watermark"
          className="w-[600px] h-[600px] object-contain max-w-none"
        />
      </div>

      <div className="relative z-10 flex flex-col h-full overflow-hidden">
        {/* 1. SUPER-COMPACT HEADER TOPBAR */}
        <header
          className={`border-b px-3 py-1.5 flex items-center justify-between gap-2 shrink-0 shadow-xs print:hidden transition-colors duration-300 ${
            isDarkMode
              ? 'bg-slate-900/95 border-slate-800 backdrop-blur-md'
              : 'bg-slate-100/95 border-slate-300 backdrop-blur-md'
          }`}
        >
          <div className="flex items-center gap-2 shrink-0">
            <Link
              href="/"
              className={`p-1 rounded-lg transition ${
                isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Kembali"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2.5}
                  d="M10 19l-7-7m0 0l7-7m-7 7h18"
                />
              </svg>
            </Link>
            <div className="flex items-center gap-1.5">
              <img
                src="/logo-smp.jpg"
                alt="Logo"
                className="w-5 h-5 rounded border p-0.5 object-contain"
              />
              <div>
                <h1
                  className={`font-black text-xs leading-none ${
                    isDarkMode ? 'text-white' : 'text-slate-900'
                  }`}
                >
                  Bimbingan Siswa (SMP &amp; SMK)
                </h1>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <div
              className={`border text-[10px] font-bold px-2 py-0.5 rounded-lg flex items-center gap-1.5 shadow-xs ${
                isDarkMode
                  ? 'bg-slate-800 border-slate-700 text-slate-100'
                  : 'bg-white border-slate-300 text-slate-800'
              }`}
            >
              <span className="w-4 h-4 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[9px] font-bold shrink-0">
                {userDisplayName.charAt(0)}
              </span>
              <div className="flex flex-col leading-none">
                <span className="font-extrabold max-w-[115px] sm:max-w-none truncate">
                  {userDisplayName}
                </span>
                <span
                  className={`hidden sm:inline text-[9px] font-mono mt-0.5 ${
                    isDarkMode ? 'text-slate-400' : 'text-slate-500'
                  }`}
                >
                  NUPTK: {userNuptkDisplay}
                </span>
              </div>
              <span
                className={`hidden sm:inline-block text-[9px] px-1.5 py-0.5 rounded font-extrabold uppercase ml-0.5 border ${
                  isDarkMode
                    ? 'bg-indigo-950 text-indigo-300 border-indigo-800'
                    : 'bg-indigo-100 text-indigo-800 border-indigo-200'
                }`}
              >
                {isStrictOperatorRole
                  ? 'Operator'
                  : waliKelasAssignedId
                  ? 'Wali Kelas'
                  : 'Guru'}
              </span>
            </div>

            <button
              onClick={handleLogout}
              disabled={isLoggingOut}
              className={`p-1 rounded-md border transition cursor-pointer disabled:opacity-50 ${
                isDarkMode
                  ? 'bg-rose-950/40 border-rose-800 text-rose-400'
                  : 'bg-rose-50 border-rose-300 text-rose-700'
              }`}
              title="Keluar"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                />
              </svg>
            </button>
          </div>
        </header>

        {/* 2. SUB-NAVBAR AKADEMIK */}
        <div
          className={`border-b px-3 py-1 shrink-0 overflow-x-auto print:hidden transition-colors duration-300 ${
            isDarkMode
              ? 'bg-slate-900/80 border-slate-800 backdrop-blur-md'
              : 'bg-slate-200/80 border-slate-300 backdrop-blur-md'
          }`}
        >
          <div className="max-w-6xl mx-auto flex items-center gap-1 min-w-max text-[10px] font-bold">
            <Link
              href="/jadwal"
              className={`px-2 py-0.5 rounded border transition flex items-center gap-1 ${
                isDarkMode
                  ? 'bg-slate-800 text-slate-300 border-slate-700'
                  : 'bg-white text-slate-700 border-slate-300'
              }`}
            >
              <span>🕒</span> Jadwal
            </Link>
            <Link
              href="/absensi"
              className={`px-2 py-0.5 rounded border transition flex items-center gap-1 ${
                isDarkMode
                  ? 'bg-slate-800 text-slate-300 border-slate-700'
                  : 'bg-white text-slate-700 border-slate-300'
              }`}
            >
              <span>📋</span> Absensi
            </Link>
            <Link
              href="/nilai"
              className={`px-2 py-0.5 rounded border transition flex items-center gap-1 ${
                isDarkMode
                  ? 'bg-slate-800 text-slate-300 border-slate-700'
                  : 'bg-white text-slate-700 border-slate-300'
              }`}
            >
              <span>⭐</span> Penilaian
            </Link>
            <Link
              href="/jurnal"
              className={`px-2 py-0.5 rounded border transition flex items-center gap-1 ${
                isDarkMode
                  ? 'bg-slate-800 text-slate-300 border-slate-700'
                  : 'bg-white text-slate-700 border-slate-300'
              }`}
            >
              <span>📓</span> Jurnal
            </Link>
            <Link
              href="/bimbingan"
              className="bg-indigo-600 text-white px-2 py-0.5 rounded shadow-xs font-extrabold flex items-center gap-1"
            >
              <span>💖</span> Bimbingan
            </Link>
          </div>
        </div>

        {/* MAIN CONTENT CONTAINER */}
        <main className="max-w-6xl w-full mx-auto p-2 flex-1 flex flex-col space-y-2 overflow-hidden mb-12">
          {/* TAB SWITCHER */}
          <div
            className={`grid grid-cols-2 p-0.5 rounded-lg border w-full text-[11px] font-extrabold shrink-0 shadow-xs ${
              isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-300'
            }`}
          >
            <button
              onClick={() => setActiveTab('input')}
              className={`py-1 rounded-md transition flex items-center justify-center gap-1 cursor-pointer ${
                activeTab === 'input'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : isDarkMode
                  ? 'text-slate-400'
                  : 'text-slate-700'
              }`}
            >
              <span>💖</span> Catat Kasus
            </button>
            <button
              onClick={() => setActiveTab('rekap')}
              className={`py-1 rounded-md transition flex items-center justify-center gap-1 cursor-pointer ${
                activeTab === 'rekap'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : isDarkMode
                  ? 'text-slate-400'
                  : 'text-slate-700'
              }`}
            >
              <span>📜</span> Rekap Kasus
            </button>
          </div>

          {activeTab === 'input' && (
            <div className="flex flex-col flex-1 overflow-y-auto pr-0.5">
              {/* FORM INPUT ULTRA-COMPACT: FLOATING GRID + 1-LINE HORIZONTAL CHIP BAR */}
              <form
                onSubmit={handleSimpanBimbingan}
                className={`border rounded-xl p-2.5 shrink-0 shadow-xs space-y-2 ${
                  isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-indigo-200'
                }`}
              >
                {/* BARIS 1: UNIT | KELAS (URUT 7-12) | TANGGAL | JENIS MASALAH */}
                <div className="grid grid-cols-12 gap-1.5">
                  <div className="col-span-3 sm:col-span-2">
                    <select
                      value={selectedJenjangInput}
                      onChange={(e) => {
                        setSelectedJenjangInput(e.target.value as 'ALL' | 'SMP' | 'SMK')
                        setSelectedKelasIdInput('')
                      }}
                      className={`w-full border rounded-lg px-1.5 py-1.5 text-xs font-extrabold focus:outline-none ${
                        isDarkMode
                          ? 'bg-slate-800 border-slate-700 text-amber-300'
                          : 'bg-indigo-50 border-indigo-200 text-indigo-900'
                      }`}
                    >
                      <option value="ALL">All Unit</option>
                      <option value="SMP">SMP</option>
                      <option value="SMK">SMK</option>
                    </select>
                  </div>

                  <div className="col-span-4 sm:col-span-3">
                    <select
                      value={selectedKelasIdInput}
                      onChange={(e) => setSelectedKelasIdInput(e.target.value)}
                      className={`w-full border rounded-lg px-2 py-1.5 text-xs font-bold focus:outline-none ${
                        isDarkMode
                          ? 'bg-slate-800 border-slate-700 text-white'
                          : 'bg-slate-50 border-slate-300 text-slate-900'
                      }`}
                    >
                      <option value="">Semua Kelas (7–12)</option>
                      {kelasOptionsInput.map((k) => (
                        <option key={k.id} value={k.id}>
                          {k.nama} ({k.jenjang})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="col-span-5 sm:col-span-3">
                    <input
                      type="date"
                      value={tanggal}
                      onChange={(e) => setTanggal(e.target.value)}
                      className={`w-full border rounded-lg px-2 py-1.5 text-xs font-bold focus:outline-none ${
                        isDarkMode
                          ? 'bg-slate-800 border-slate-700 text-white'
                          : 'bg-slate-50 border-slate-300 text-slate-900'
                      }`}
                      required
                    />
                  </div>

                  <div className="col-span-12 sm:col-span-4">
                    <select
                      value={jenisMasalah}
                      onChange={(e) => setJenisMasalah(e.target.value)}
                      className={`w-full border rounded-lg px-2 py-1.5 text-xs font-bold focus:outline-none ${
                        isDarkMode
                          ? 'bg-slate-800 border-slate-700 text-white'
                          : 'bg-slate-50 border-slate-300 text-slate-900'
                      }`}
                    >
                      <option value="Akademik">Akademik (Tugas / Nilai)</option>
                      <option value="Karakter/Sikap">Karakter / Sikap / Etika</option>
                      <option value="Kedisiplinan">Kedisiplinan / Tata Tertib</option>
                      <option value="Pribadi/Sosial">Pribadi / Sosial</option>
                    </select>
                  </div>
                </div>

                {/* BARIS 2: INPUT CARI + FLOATING POPOVER GRID 3 KOLOM */}
                <div ref={dropdownContainerRef} className="relative">
                  <div className="flex items-center gap-1.5">
                    <div className="relative flex-1">
                      <input
                        type="text"
                        value={searchSiswaInput}
                        onFocus={() => setIsDropdownSiswaOpen(true)}
                        onChange={(e) => {
                          setSearchSiswaInput(e.target.value)
                          setIsDropdownSiswaOpen(true)
                        }}
                        placeholder={
                          selectedSiswaList.length > 0
                            ? `🔍 Tambah siswa lain... (${selectedSiswaList.length} terpilih: ${selectedSummary.smpCount} SMP, ${selectedSummary.smkCount} SMK)`
                            : '🔍 Klik untuk pilih 1 atau banyak siswa (SMP / SMK)...'
                        }
                        className={`w-full border rounded-lg px-2.5 py-1.5 text-xs font-bold focus:outline-none ${
                          isDarkMode
                            ? 'bg-slate-800 border-slate-700 text-white placeholder:text-slate-400 focus:border-indigo-500'
                            : 'bg-slate-50 border-slate-300 text-slate-900 placeholder:text-slate-500 focus:border-indigo-500'
                        }`}
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => setIsDropdownSiswaOpen((prev) => !prev)}
                      className={`px-3 py-1.5 rounded-lg border text-xs font-extrabold shrink-0 cursor-pointer transition ${
                        isDropdownSiswaOpen
                          ? 'bg-indigo-600 border-indigo-600 text-white'
                          : isDarkMode
                          ? 'bg-slate-800 border-slate-700 text-indigo-300 hover:bg-slate-700'
                          : 'bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100'
                      }`}
                    >
                      {isDropdownSiswaOpen ? 'Selesai ✓' : `Pilih Siswa (${selectedSiswaList.length})`}
                    </button>
                  </div>

                  {/* POPOVER FLOATING GRID */}
                  {isDropdownSiswaOpen && (
                    <div
                      className={`absolute left-0 right-0 top-full mt-1 z-40 rounded-xl border shadow-2xl overflow-hidden ${
                        isDarkMode
                          ? 'bg-slate-900 border-slate-700'
                          : 'bg-white border-slate-300'
                      }`}
                    >
                      <div
                        className={`px-2.5 py-1.5 border-b flex items-center justify-between text-[11px] font-extrabold ${
                          isDarkMode
                            ? 'bg-slate-800 border-slate-700 text-slate-200'
                            : 'bg-slate-100 border-slate-200 text-slate-700'
                        }`}
                      >
                        <span>
                          {filteredSiswaOptions.length} siswa tersedia • Dipilih:{' '}
                          <strong className="text-indigo-500">{selectedSiswaList.length}</strong>
                        </span>
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={handleSelectAllFiltered}
                            className="text-emerald-500 hover:underline cursor-pointer"
                          >
                            + Pilih Semua
                          </button>
                          {selectedSiswaList.length > 0 && (
                            <button
                              type="button"
                              onClick={() => setSelectedSiswaList([])}
                              className="text-rose-500 hover:underline cursor-pointer"
                            >
                              Reset
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setIsDropdownSiswaOpen(false)}
                            className="text-slate-400 hover:text-slate-200 cursor-pointer"
                          >
                            ✕
                          </button>
                        </div>
                      </div>

                      <div className="max-h-48 overflow-y-auto p-1.5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1">
                        {filteredSiswaOptions.length === 0 ? (
                          <p className="col-span-full py-4 text-center text-xs text-slate-500">
                            Siswa tidak ditemukan.
                          </p>
                        ) : (
                          filteredSiswaOptions.map((siswa, idx) => {
                            const checked = isSiswaSelected(siswa)
                            const info = getKelasInfoById(siswa.kelas_id)
                            const isSmk = info.jenjang === 'SMK'
                            return (
                              <label
                                key={siswa.id || idx}
                                className={`flex items-center justify-between px-2 py-1.5 rounded-lg border text-xs cursor-pointer transition select-none ${
                                  checked
                                    ? isDarkMode
                                      ? 'bg-indigo-950/80 border-indigo-500 text-indigo-100'
                                      : 'bg-indigo-50 border-indigo-400 text-indigo-950'
                                    : isDarkMode
                                    ? 'bg-slate-800/50 border-slate-800 hover:border-slate-700 text-slate-200'
                                    : 'bg-slate-50/70 border-slate-200 hover:bg-slate-100 text-slate-800'
                                }`}
                              >
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => toggleSelectSiswa(siswa)}
                                    className="w-3.5 h-3.5 accent-indigo-600 rounded cursor-pointer shrink-0"
                                  />
                                  <span className="font-bold truncate">{siswa.nama_lengkap}</span>
                                </div>
                                <span
                                  className={`text-[9px] font-black px-1.5 py-0.5 rounded shrink-0 ml-1.5 ${
                                    isSmk
                                      ? isDarkMode
                                        ? 'bg-amber-950 text-amber-300'
                                        : 'bg-amber-100 text-amber-800'
                                      : isDarkMode
                                      ? 'bg-sky-950 text-sky-300'
                                      : 'bg-sky-100 text-sky-800'
                                  }`}
                                >
                                  {info.nama}
                                </span>
                              </label>
                            )
                          })
                        )}
                      </div>
                    </div>
                  )}

                  {/* 1-LINE HORIZONTAL SCROLL CHIP BAR */}
                  {selectedSiswaList.length > 0 && (
                    <div className="flex items-center gap-1.5 overflow-x-auto pt-1.5 pb-0.5">
                      {selectedSiswaList.map((s, idx) => {
                        const info = getKelasInfoById(s.kelas_id)
                        const isSmk = info.jenjang === 'SMK'
                        return (
                          <span
                            key={s.id || idx}
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold border shrink-0 ${
                              isSmk
                                ? isDarkMode
                                  ? 'bg-amber-950/90 border-amber-700 text-amber-200'
                                  : 'bg-amber-100 border-amber-300 text-amber-900'
                                : isDarkMode
                                ? 'bg-indigo-950/90 border-indigo-700 text-indigo-200'
                                : 'bg-indigo-100 border-indigo-300 text-indigo-900'
                            }`}
                          >
                            <span>
                              {s.nama_lengkap} • {info.nama}
                            </span>
                            <button
                              type="button"
                              onClick={() => toggleSelectSiswa(s)}
                              className="text-rose-500 hover:text-rose-700 font-black ml-0.5 cursor-pointer"
                              title="Hapus"
                            >
                              ×
                            </button>
                          </span>
                        )
                      })}
                    </div>
                  )}
                </div>

                {/* BARIS 3: DESKRIPSI MASALAH & SOLUSI */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  <textarea
                    rows={2}
                    value={masalah}
                    onChange={(e) => setMasalah(e.target.value)}
                    placeholder="📝 Deskripsi Permasalahan Siswa..."
                    className={`w-full border rounded-lg px-2.5 py-1.5 text-xs font-bold focus:outline-none resize-none ${
                      isDarkMode
                        ? 'bg-slate-800 border-slate-700 text-white'
                        : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                    required
                  />

                  <textarea
                    rows={2}
                    value={solusi}
                    onChange={(e) => setSolusi(e.target.value)}
                    placeholder="💡 Solusi / Tindak Lanjut Guru..."
                    className={`w-full border rounded-lg px-2.5 py-1.5 text-xs font-bold focus:outline-none resize-none ${
                      isDarkMode
                        ? 'bg-slate-800 border-slate-700 text-white'
                        : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  />
                </div>

                {/* BARIS 4: TOMBOL SIMPAN */}
                <button
                  type="submit"
                  disabled={saving || selectedSiswaList.length === 0}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-black py-1.5 rounded-lg text-xs transition shadow-xs flex items-center justify-center gap-1 cursor-pointer"
                >
                  <span>💾</span>
                  <span>
                    {saving
                      ? 'Menyimpan...'
                      : selectedSiswaList.length > 0
                      ? `SIMPAN CATATAN BIMBINGAN (${selectedSiswaList.length} SISWA)`
                      : 'PILIH SISWA TERLEBIH DAHULU'}
                  </span>
                </button>
              </form>
            </div>
          )}

          {/* TAB 2: REKAPITULASI (DROPDOWN KELAS URUT 7-12 + MULTI KONFIRMASI SELESAI & MULTI HAPUS) */}
          {activeTab === 'rekap' && (
            <div className="flex flex-col h-full overflow-hidden space-y-1.5">
              {/* FILTER BAR REKAP */}
              <div
                className={`grid grid-cols-5 gap-1 border p-1 rounded-lg shrink-0 shadow-xs ${
                  isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-indigo-200'
                }`}
              >
                <select
                  value={filterJenjangRekap}
                  onChange={(e) => {
                    setFilterJenjangRekap(e.target.value as 'ALL' | 'SMP' | 'SMK')
                    setFilterKelasIdRekap('')
                  }}
                  className={`border rounded px-1 py-0.5 text-xs font-extrabold focus:outline-none ${
                    isDarkMode
                      ? 'bg-slate-800 border-slate-700 text-amber-300'
                      : 'bg-indigo-50 border-indigo-200 text-indigo-900'
                  }`}
                >
                  <option value="ALL">All Unit</option>
                  <option value="SMP">SMP</option>
                  <option value="SMK">SMK</option>
                </select>

                <select
                  value={filterKelasIdRekap}
                  onChange={(e) => setFilterKelasIdRekap(e.target.value)}
                  className={`border rounded px-1 py-0.5 text-xs font-bold focus:outline-none ${
                    isDarkMode
                      ? 'bg-slate-800 border-slate-700 text-white'
                      : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                >
                  <option value="">Kelas (7–12)</option>
                  {[...kelasList]
                    .filter((k) => filterJenjangRekap === 'ALL' || k.jenjang === filterJenjangRekap)
                    .sort(sortKelas7to12)
                    .map((k) => (
                      <option key={k.id} value={k.id}>
                        {k.nama}
                      </option>
                    ))}
                </select>

                <select
                  value={filterJenis}
                  onChange={(e) => setFilterJenis(e.target.value)}
                  className={`border rounded px-1 py-0.5 text-xs font-bold focus:outline-none ${
                    isDarkMode
                      ? 'bg-slate-800 border-slate-700 text-white'
                      : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                >
                  <option value="">Jenis</option>
                  <option value="Akademik">Akademik</option>
                  <option value="Karakter/Sikap">Karakter</option>
                  <option value="Kedisiplinan">Disiplin</option>
                  <option value="Pribadi/Sosial">Pribadi</option>
                </select>

                <select
                  value={filterStatusRekap}
                  onChange={(e) =>
                    setFilterStatusRekap(e.target.value as 'ALL' | 'PROSES' | 'SELESAI')
                  }
                  className={`border rounded px-1 py-0.5 text-xs font-bold focus:outline-none ${
                    isDarkMode
                      ? 'bg-slate-800 border-slate-700 text-white'
                      : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                >
                  <option value="ALL">Status</option>
                  <option value="PROSES">⏳ Proses</option>
                  <option value="SELESAI">✅ Selesai</option>
                </select>

                <input
                  type="text"
                  value={searchKataKunci}
                  onChange={(e) => setSearchKataKunci(e.target.value)}
                  placeholder="Cari..."
                  className={`border rounded px-1.5 py-0.5 text-xs font-bold focus:outline-none ${
                    isDarkMode
                      ? 'bg-slate-800 border-slate-700 text-white'
                      : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                />
              </div>

              {/* BAR AKSI MASSAL KHUSUS OPERATOR: PILIH SEMUA / PILIH PROSES + KONFIRMASI SELESAI MASSAL + HAPUS MASSAL */}
              {isOperator && allDisplayedIds.length > 0 && (
                <div
                  className={`border rounded-lg px-2 py-1.5 shrink-0 flex flex-wrap items-center justify-between gap-1.5 shadow-xs ${
                    isDarkMode
                      ? 'bg-indigo-950/50 border-indigo-800/80 text-indigo-200'
                      : 'bg-indigo-50 border-indigo-200 text-indigo-900'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={handleSelectAllDisplayed}
                      className={`px-2 py-1 rounded text-[10px] font-extrabold border transition cursor-pointer flex items-center gap-1 ${
                        isAllDisplayedChecked
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : isDarkMode
                          ? 'bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700'
                          : 'bg-white text-indigo-800 border-indigo-300 hover:bg-indigo-100'
                      }`}
                    >
                      <span>☑️</span>
                      <span>
                        {isAllDisplayedChecked
                          ? `Batal Semua (${selectedRekapIds.length})`
                          : `Pilih Semua (${allDisplayedIds.length})`}
                      </span>
                    </button>

                    {prosesRekapIds.length > 0 && (
                      <button
                        type="button"
                        onClick={handleSelectAllProses}
                        className={`px-2 py-1 rounded text-[10px] font-extrabold border transition cursor-pointer ${
                          isDarkMode
                            ? 'bg-amber-950/60 text-amber-300 border-amber-800 hover:bg-amber-900/60'
                            : 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100'
                        }`}
                      >
                        ⏳ Pilih Proses ({prosesRekapIds.length})
                      </button>
                    )}
                  </div>

                  {selectedRekapIds.length > 0 ? (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={handleBulkTindakLanjutiOperator}
                        disabled={bulkProcessing}
                        className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-[10px] font-black transition shadow-xs cursor-pointer flex items-center gap-1"
                      >
                        <span>✅</span>
                        <span>
                          {bulkProcessing
                            ? 'Memproses...'
                            : `Selesai (${selectedRekapIds.length})`}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={handleBulkDeleteOperator}
                        disabled={bulkProcessing}
                        className="px-2.5 py-1 rounded bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-[10px] font-black transition shadow-xs cursor-pointer flex items-center gap-1"
                      >
                        <span>🗑️</span>
                        <span>
                          {bulkProcessing
                            ? 'Menghapus...'
                            : `Hapus (${selectedRekapIds.length})`}
                        </span>
                      </button>
                    </div>
                  ) : (
                    <span className="text-[10px] font-semibold opacity-75">
                      Centang item untuk selesai / hapus massal
                    </span>
                  )}
                </div>
              )}

              {/* LIST REKAP (INTERNAL SCROLL AREA) */}
              <div
                className={`border rounded-xl p-2 flex-1 flex flex-col overflow-hidden shadow-xs ${
                  isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-indigo-200'
                }`}
              >
                {loadingRekap ? (
                  <div
                    className={`py-6 text-center text-xs font-medium ${
                      isDarkMode ? 'text-slate-500' : 'text-slate-600'
                    }`}
                  >
                    Memuat riwayat bimbingan...
                  </div>
                ) : displayedRekapList.length === 0 ? (
                  <div
                    className={`py-6 text-center text-xs font-medium ${
                      isDarkMode ? 'text-slate-500' : 'text-slate-600'
                    }`}
                  >
                    Belum ada catatan kasus bimbingan.
                  </div>
                ) : (
                  <div className="flex-1 overflow-y-auto pr-1 space-y-1.5">
                    {displayedRekapList.map((item, index) => {
                      const isChecked =
                        Boolean(item.id) && selectedRekapIds.includes(String(item.id))
                      const jenjangUnit = getJenjangByKelasNama(item.kelas)
                      const isSmk = jenjangUnit === 'SMK'

                      return (
                        <div
                          key={item.id || index}
                          className={`p-2 rounded-lg border transition shadow-xs flex flex-col gap-1 ${
                            isChecked
                              ? isDarkMode
                                ? 'bg-indigo-950/50 border-indigo-500'
                                : 'bg-indigo-50/90 border-indigo-400'
                              : isDarkMode
                              ? 'bg-slate-800/80 border-slate-700'
                              : 'bg-slate-50 border-slate-200'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 min-w-0">
                              {isOperator && item.id && (
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => toggleSelectRekapId(item.id)}
                                  className="w-3.5 h-3.5 accent-indigo-600 rounded cursor-pointer shrink-0"
                                  title="Pilih untuk konfirmasi selesai atau hapus massal"
                                />
                              )}
                              <span
                                className={`text-[9px] font-black px-1.5 py-0.5 rounded uppercase border shrink-0 ${
                                  isSmk
                                    ? isDarkMode
                                      ? 'bg-amber-950 text-amber-300 border-amber-800'
                                      : 'bg-amber-100 text-amber-800 border-amber-300'
                                    : isDarkMode
                                    ? 'bg-sky-950 text-sky-300 border-sky-800'
                                    : 'bg-sky-100 text-sky-800 border-sky-300'
                                }`}
                              >
                                {jenjangUnit}
                              </span>
                              <span
                                className={`text-[11px] font-extrabold truncate ${
                                  isDarkMode ? 'text-white' : 'text-slate-900'
                                }`}
                              >
                                {item.nama_siswa} ({item.kelas})
                              </span>
                            </div>
                            <span className="text-[10px] font-bold text-indigo-400 shrink-0">
                              {item.jenis_masalah}
                            </span>
                          </div>

                          <p
                            className={`text-[11px] font-bold leading-tight ${
                              isDarkMode ? 'text-slate-200' : 'text-slate-800'
                            }`}
                          >
                            🚨 {item.masalah}
                          </p>

                          {item.solusi && (
                            <p
                              className={`text-[10px] font-medium leading-tight ${
                                isDarkMode ? 'text-emerald-400' : 'text-emerald-700'
                              }`}
                            >
                              💡 {item.solusi}
                            </p>
                          )}

                          {item.is_penanganan_selesai && item.keterangan_hukuman && (
                            <p
                              className={`text-[10px] font-semibold leading-tight ${
                                isDarkMode ? 'text-sky-300' : 'text-sky-800'
                              }`}
                            >
                              ⚖️ Tindak Lanjut: {item.keterangan_hukuman}
                            </p>
                          )}

                          <div className="flex items-center justify-between pt-1 border-t border-slate-700/20 text-[10px]">
                            <span
                              className={`font-mono ${
                                isDarkMode ? 'text-slate-400' : 'text-slate-500'
                              }`}
                            >
                              📅 {item.tanggal}
                            </span>

                            <div className="flex items-center gap-1">
                              {item.is_penanganan_selesai ? (
                                <span
                                  className={`px-1.5 py-0.2 rounded font-black text-[9px] uppercase ${
                                    isDarkMode
                                      ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                                      : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                  }`}
                                >
                                  ✅ Selesai
                                </span>
                              ) : (
                                <span
                                  className={`px-1.5 py-0.2 rounded font-black text-[9px] uppercase ${
                                    isDarkMode
                                      ? 'bg-amber-950 text-amber-300 border border-amber-800'
                                      : 'bg-amber-100 text-amber-800 border border-amber-300'
                                  }`}
                                >
                                  ⏳ Proses
                                </span>
                              )}

                              {isOperator && (
                                <button
                                  onClick={() => handleTindakLanjutiOperator(item)}
                                  className="text-emerald-500 hover:text-emerald-700 font-bold p-0.5 cursor-pointer"
                                  title="Konfirmasi Tindak Lanjut Satuan"
                                >
                                  ✅
                                </button>
                              )}

                              {isOperator && (
                                <button
                                  onClick={() => handleDeleteBimbingan(item.id)}
                                  className="text-rose-500 hover:text-rose-700 font-bold p-0.5 cursor-pointer"
                                  title="Hapus Satuan"
                                >
                                  🗑️
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </main>
      </div>

      {/* 3. FIXED BOTTOM NAVIGATION BAR */}
      <div
        className={`border-t fixed bottom-0 left-0 right-0 z-50 shadow-lg shrink-0 print:hidden transition-colors duration-300 ${
          isDarkMode
            ? 'bg-slate-900/95 border-slate-800 backdrop-blur-md'
            : 'bg-slate-100/95 border-slate-300 backdrop-blur-md'
        }`}
      >
        <div className="max-w-xl mx-auto px-4 py-1.5 flex items-center justify-between">
          <Link
            href="/"
            className={`flex flex-col items-center gap-0.5 text-[10px] font-semibold transition ${
              isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-950'
            }`}
          >
            <span className="text-base leading-none">🕒</span>
            <span>Dashboard</span>
          </Link>

          {isOperator && (
            <Link
              href="/siswa"
              className={`flex flex-col items-center gap-0.5 text-[10px] font-semibold transition ${
                isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-950'
              }`}
            >
              <span className="text-base leading-none">👥</span>
              <span>Siswa</span>
            </Link>
          )}

          {isOperator && (
            <Link
              href="/guru"
              className={`flex flex-col items-center gap-0.5 text-[10px] font-semibold transition ${
                isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-950'
              }`}
            >
              <span className="text-base leading-none">👨‍🏫</span>
              <span>Guru</span>
            </Link>
          )}

          <Link
            href="/bimbingan"
            className="flex flex-col items-center gap-0.5 text-[10px] font-bold text-indigo-500 transition"
          >
            <span className="text-base leading-none">🎓</span>
            <span>Akademik</span>
          </Link>

          <Link
            href="/laporan"
            className={`flex flex-col items-center gap-0.5 text-[10px] font-semibold transition ${
              isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-950'
            }`}
          >
            <span className="text-base leading-none">🖨️</span>
            <span>Laporan</span>
          </Link>
        </div>
      </div>
    </motion.div>
  )
}