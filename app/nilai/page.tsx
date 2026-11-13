'use client'

import { useState, useEffect } from 'react'
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

interface Siswa {
  id: number
  nisn: string
  nama_lengkap: string
  kelas_id?: number
}

interface OptionItem {
  id: number
  nama: string
}

interface NilaiRecord {
  id?: number | string
  created_at?: string
  siswa_id: number
  mata_pelajaran?: string
  mapel_id?: number
  nilai_tugas?: number
  nilai_uts?: number
  nilai_uas?: number
  semester?: string
  tahun_ajaran?: string
  guru_email?: string
  siswa?: {
    nama_lengkap?: string
    kelas?: {
      nama_kelas?: string
    }
  } | null
}

interface NilaiMap {
  [siswaId: string]: number | ''
}

export default function PenilaianPage() {
  const router = useRouter()
  const { isOperator, canAccessBimbingan } = useAuthRole()

  const [userDisplayName, setUserDisplayName] = useState('MEMUAT...')
  const [userNuptkDisplay, setUserNuptkDisplay] = useState('-')
  const [isStrictOperatorRole, setIsStrictOperatorRole] = useState(false)
  const [waliKelasAssignedId, setWaliKelasAssignedId] = useState<number | null>(null)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'input' | 'rekap'>('input')
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  // Helper format NUPTK agar bersih (jika kosong/null/EMPTY menjadi '-')
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

  // DETEKSI OTOMATIS TEMA DARK MODE DARI LOCAL STORAGE
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false)

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme')
    if (savedTheme === 'dark') {
      setIsDarkMode(true)
    }
  }, [])

  // Global Filter Periode Akademik
  const [selectedSemester, setSelectedSemester] = useState<'Ganjil' | 'Genap'>('Ganjil')
  const [selectedTahunAjaran, setSelectedTahunAjaran] = useState('2026/2027')

  // Dynamic Options
  const [kelasList, setKelasList] = useState<OptionItem[]>([])
  const [mapelList, setMapelList] = useState<OptionItem[]>([])

  // State Input Nilai
  const [selectedKelasId, setSelectedKelasId] = useState('')
  const [selectedMapelId, setSelectedMapelId] = useState('')
  const [jenisPenilaian, setJenisPenilaian] = useState<'nilai_tugas' | 'nilai_uts' | 'nilai_uas'>('nilai_tugas')
  const [siswaList, setSiswaList] = useState<Siswa[]>([])
  const [nilaiInputMap, setNilaiInputMap] = useState<NilaiMap>({})
  const [loadingSiswa, setLoadingSiswa] = useState(false)
  const [saving, setSaving] = useState(false)

  // State Rekapitulasi Nilai
  const [rekapList, setRekapList] = useState<NilaiRecord[]>([])
  const [filterKelasId, setFilterKelasId] = useState('')
  const [filterMapelId, setFilterMapelId] = useState('')
  const [searchNama, setSearchNama] = useState('')
  const [loadingRekap, setLoadingRekap] = useState(false)

  useEffect(() => {
    let isMounted = true

    async function getUserData() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        if (isMounted) router.replace('/login')
        return
      }

      const rawEmail = user.email || ''
      const cleanEmail = rawEmail.trim().toLowerCase()
      if (isMounted) setUserEmail(rawEmail)

      // Ambil identitas lengkap dari tabel master `guru`
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

      fetchOptions(rawEmail)
    }

    getUserData()

    return () => {
      isMounted = false
    }
  }, [isOperator, router])

  async function fetchOptions(email: string) {
    try {
      if (isOperator) {
        const { data: dataKelas } = await supabase.from('kelas').select('id, nama_kelas').order('nama_kelas', { ascending: true })
        const { data: dataMapel } = await supabase.from('mapel').select('id, nama_mapel').order('nama_mapel', { ascending: true })

        if (dataKelas) setKelasList(dataKelas.map((k: Record<string, any>) => ({ id: Number(k.id), nama: String(k.nama_kelas) })))
        if (dataMapel) setMapelList(dataMapel.map((m: Record<string, any>) => ({ id: Number(m.id), nama: String(m.nama_mapel) })))
      } else {
        const { data, error } = await supabase
          .from('jadwal')
          .select(`
            kelas_id,
            mapel_id,
            kelas:kelas_id(id, nama_kelas),
            mapel:mapel_id(id, nama_mapel)
          `)
          .eq('guru_email', email)

        if (!error && data) {
          const uniqueKelasMap = new Map<number, string>()
          const uniqueMapelMap = new Map<number, string>()

          data.forEach((item: Record<string, any>) => {
            if (item.kelas && item.kelas.id) {
              uniqueKelasMap.set(Number(item.kelas.id), String(item.kelas.nama_kelas))
            }
            if (item.mapel && item.mapel.id) {
              uniqueMapelMap.set(Number(item.mapel.id), String(item.mapel.nama_mapel))
            }
          })

          setKelasList(Array.from(uniqueKelasMap.entries()).map(([id, nama]) => ({ id, nama })))
          setMapelList(Array.from(uniqueMapelMap.entries()).map(([id, nama]) => ({ id, nama })))
        }
      }
    } catch (err) {
      console.error('Error fetching options:', err)
    }
  }

  // Fetch Siswa Berdasarkan Kelas ID
  useEffect(() => {
    async function fetchSiswa() {
      if (!selectedKelasId) {
        setSiswaList([])
        setNilaiInputMap({})
        return
      }

      setLoadingSiswa(true)
      try {
        const { data, error } = await supabase
          .from('siswa')
          .select('id, nisn, nama_lengkap, kelas_id')
          .eq('kelas_id', Number(selectedKelasId))
          .order('nama_lengkap', { ascending: true })

        if (!error && data) {
          setSiswaList(data)
          
          if (selectedMapelId) {
            const { data: existingNilai } = await supabase
              .from('nilai')
              .select('*')
              .eq('kelas_id', Number(selectedKelasId))
              .eq('mapel_id', Number(selectedMapelId))
              .eq('semester', selectedSemester)
              .eq('tahun_ajaran', selectedTahunAjaran)

            const initialMap: NilaiMap = {}
            data.forEach((s) => {
              const matched = (existingNilai || []).find((n: Record<string, any>) => Number(n.siswa_id) === Number(s.id))
              const val = matched ? (matched as Record<string, any>)[jenisPenilaian] : undefined
              initialMap[String(s.id)] = val !== undefined && val !== null ? Number(val) : ''
            })
            setNilaiInputMap(initialMap)
          } else {
            const initialMap: NilaiMap = {}
            data.forEach((s) => { initialMap[String(s.id)] = '' })
            setNilaiInputMap(initialMap)
          }
        } else {
          setSiswaList([])
        }
      } catch (err) {
        console.error('Error fetching siswa:', err)
      } finally {
        setLoadingSiswa(false)
      }
    }

    if (activeTab === 'input') {
      fetchSiswa()
    }
  }, [selectedKelasId, selectedMapelId, jenisPenilaian, selectedSemester, selectedTahunAjaran, activeTab])

  // Fetch Rekapitulasi Nilai
  const fetchRekap = async () => {
    setLoadingRekap(true)
    try {
      let query = supabase
        .from('nilai')
        .select('*, siswa:siswa_id(nama_lengkap, kelas:kelas_id(nama_kelas))')
        .eq('semester', selectedSemester)
        .eq('tahun_ajaran', selectedTahunAjaran)
        .order('created_at', { ascending: false })

      if (!isOperator && userEmail) {
        query = query.eq('guru_email', userEmail)
      }

      if (filterKelasId) query = query.eq('kelas_id', Number(filterKelasId))
      if (filterMapelId) query = query.eq('mapel_id', Number(filterMapelId))
      if (searchNama.trim()) query = query.ilike('siswa.nama_lengkap', `%${searchNama.trim()}%`)

      const { data, error } = await query

      if (!error && data) {
        setRekapList(data as unknown as NilaiRecord[])
      } else {
        setRekapList([])
      }
    } catch (err) {
      console.error('Error fetching rekap nilai:', err)
    } finally {
      setLoadingRekap(false)
    }
  }

  useEffect(() => {
    if (activeTab === 'rekap') {
      fetchRekap()
    }
  }, [activeTab, filterKelasId, filterMapelId, searchNama, selectedSemester, selectedTahunAjaran, userEmail, isOperator])

  const handleNilaiChange = (siswaId: string, value: string) => {
    const num = value === '' ? '' : Math.min(100, Math.max(0, Number(value)))
    setNilaiInputMap((prev) => ({
      ...prev,
      [siswaId]: num,
    }))
  }

  const handleSimpanNilai = async () => {
    if (!selectedKelasId || !selectedMapelId || !jenisPenilaian) {
      alert('Silakan pilih Kelas, Mata Pelajaran, dan Jenis Penilaian terlebih dahulu!')
      return
    }

    if (!userEmail) {
      alert('Sesi login tidak valid. Silakan login ulang.')
      return
    }

    if (siswaList.length === 0) {
      alert('Tidak ada siswa untuk disimpan.')
      return
    }

    setSaving(true)
    try {
      const selectedMapelObj = mapelList.find((m) => m.id === Number(selectedMapelId))

      const rowsToUpsert = siswaList
        .filter((siswa) => siswa.id && nilaiInputMap[String(siswa.id)] !== '')
        .map((siswa) => ({
          siswa_id: siswa.id,
          kelas_id: Number(selectedKelasId),
          mapel_id: Number(selectedMapelId),
          mata_pelajaran: selectedMapelObj?.nama || '',
          [jenisPenilaian]: Number(nilaiInputMap[String(siswa.id)]),
          semester: selectedSemester,
          tahun_ajaran: selectedTahunAjaran,
          guru_email: userEmail
        }))

      if (rowsToUpsert.length === 0) {
        alert('Silakan isi minimal satu nilai siswa!')
        setSaving(false)
        return
      }

      const { error } = await supabase.from('nilai').upsert(rowsToUpsert, { onConflict: 'siswa_id,mapel_id,semester,tahun_ajaran' })

      if (error) {
        const { error: insertErr } = await supabase.from('nilai').insert(rowsToUpsert)
        if (insertErr) {
          alert('Gagal menyimpan nilai: ' + insertErr.message)
        } else {
          alert('Data nilai akademik berhasil disimpan!')
        }
      } else {
        alert('Data nilai akademik berhasil disimpan!')
      }
    } catch (err: any) {
      alert('Terjadi kesalahan: ' + err.message)
    } finally {
      setSaving(false)
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

  const totalEntri = rekapList.length

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={`h-screen w-screen overflow-hidden font-sans flex flex-col justify-between selection:bg-indigo-500 selection:text-white relative transition-colors duration-300 ${
        isDarkMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-200 text-slate-800'
      }`}
    >
      {/* WATERMARK LOGO */}
      <div className={`fixed inset-0 pointer-events-none z-0 flex items-center justify-center select-none print:hidden transition-opacity duration-300 ${
        isDarkMode ? 'opacity-[0.04]' : 'opacity-[0.12]'
      }`}>
        <img src="/logo-smp.jpg" alt="Watermark" className="w-[600px] h-[600px] object-contain max-w-none" />
      </div>

      <div className="relative z-10 flex flex-col h-full overflow-hidden">
        
        {/* 1. SUPER-COMPACT HEADER TOPBAR */}
        <header className={`border-b px-3 py-1.5 flex items-center justify-between gap-2 shrink-0 shadow-xs print:hidden transition-colors duration-300 ${
          isDarkMode ? 'bg-slate-900/95 border-slate-800 backdrop-blur-md' : 'bg-slate-100/95 border-slate-300 backdrop-blur-md'
        }`}>
          <div className="flex items-center gap-2 shrink-0">
            <Link href="/" className={`p-1 rounded-lg transition ${isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'}`} title="Kembali">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </Link>
            <div className="flex items-center gap-1.5">
              <img src="/logo-smp.jpg" alt="Logo" className="w-5 h-5 rounded border p-0.5 object-contain" />
              <h1 className={`font-black text-xs leading-none ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                Penilaian Siswa
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {/* PERIODE SEMESTER & TAHUN AJARAN */}
            <div className={`border text-[10px] font-bold px-1.5 py-0.5 rounded-md flex items-center gap-0.5 shadow-xs ${
              isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-100' : 'bg-white border-slate-300 text-slate-800'
            }`}>
              <select value={selectedSemester} onChange={(e) => setSelectedSemester(e.target.value as 'Ganjil' | 'Genap')} className={`font-bold focus:outline-none ${
                isDarkMode ? 'bg-slate-800 text-indigo-300' : 'bg-white text-indigo-900'
              }`}>
                <option value="Ganjil">Ganjil</option>
                <option value="Genap">Genap</option>
              </select>
              <select value={selectedTahunAjaran} onChange={(e) => setSelectedTahunAjaran(e.target.value)} className={`font-bold focus:outline-none ${
                isDarkMode ? 'bg-slate-800 text-indigo-300' : 'bg-white text-indigo-900'
              }`}>
                {Array.from({ length: 5 }, (_, i) => {
                  const startYear = 2025 + i
                  const tahunOption = `${startYear}/${startYear + 1}`
                  return (
                    <option key={tahunOption} value={tahunOption}>
                      {tahunOption}
                    </option>
                  )
                })}
              </select>
            </div>

            {/* BADGE PROFIL POJOK KANAN ATAS: NAMA LENGKAP GURU + NUPTK + PERAN DINAMIS */}
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
                <span className="font-extrabold max-w-[90px] sm:max-w-none truncate">
                  {userDisplayName}
                </span>
                <span
                  className={`hidden md:inline text-[9px] font-mono mt-0.5 ${
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
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </header>

        {/* 2. SUB-NAVBAR AKADEMIK (PILLS HORIZONTAL SCROLL) */}
        <div className={`border-b px-3 py-1 shrink-0 overflow-x-auto print:hidden transition-colors duration-300 ${
          isDarkMode ? 'bg-slate-900/80 border-slate-800 backdrop-blur-md' : 'bg-slate-200/80 border-slate-300 backdrop-blur-md'
        }`}>
          <div className="max-w-6xl mx-auto flex items-center gap-1 min-w-max text-[10px] font-bold">
            <Link href="/jadwal" className={`px-2 py-0.5 rounded border transition flex items-center gap-1 ${
              isDarkMode ? 'bg-slate-800 text-slate-300 border-slate-700' : 'bg-white text-slate-700 border-slate-300'
            }`}>
              <span>🕒</span> Jadwal
            </Link>
            <Link href="/absensi" className={`px-2 py-0.5 rounded border transition flex items-center gap-1 ${
              isDarkMode ? 'bg-slate-800 text-slate-300 border-slate-700' : 'bg-white text-slate-700 border-slate-300'
            }`}>
              <span>📋</span> Absensi
            </Link>
            <Link href="/nilai" className="bg-indigo-600 text-white px-2 py-0.5 rounded shadow-xs font-extrabold flex items-center gap-1">
              <span>⭐</span> Penilaian
            </Link>
            <Link href="/jurnal" className={`px-2 py-0.5 rounded border transition flex items-center gap-1 ${
              isDarkMode ? 'bg-slate-800 text-slate-300 border-slate-700' : 'bg-white text-slate-700 border-slate-300'
            }`}>
              <span>📓</span> Jurnal
            </Link>
            {canAccessBimbingan && (
              <Link href="/bimbingan" className={`px-2 py-0.5 rounded border transition flex items-center gap-1 ${
                isDarkMode ? 'bg-slate-800 text-slate-300 border-slate-700' : 'bg-white text-slate-700 border-slate-300'
              }`}>
                <span>💖</span> Bimbingan
              </Link>
            )}
          </div>
        </div>

        {/* MAIN CONTENT CONTAINER (NO SCROLL CONTAINER) */}
        <main className="max-w-6xl w-full mx-auto p-2 flex-1 flex flex-col space-y-2 overflow-hidden mb-12">
          
          {/* TAB SWITCHER */}
          <div className={`grid grid-cols-2 p-0.5 rounded-lg border w-full text-[11px] font-extrabold shrink-0 shadow-xs ${
            isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-300'
          }`}>
            <button
              onClick={() => setActiveTab('input')}
              className={`py-1 rounded-md transition flex items-center justify-center gap-1 cursor-pointer ${
                activeTab === 'input' 
                  ? 'bg-indigo-600 text-white shadow-xs' 
                  : isDarkMode ? 'text-slate-400' : 'text-slate-700'
              }`}
            >
              <span>⭐</span> Input Nilai
            </button>
            <button
              onClick={() => setActiveTab('rekap')}
              className={`py-1 rounded-md transition flex items-center justify-center gap-1 cursor-pointer ${
                activeTab === 'rekap' 
                  ? 'bg-indigo-600 text-white shadow-xs' 
                  : isDarkMode ? 'text-slate-400' : 'text-slate-700'
              }`}
            >
              <span>📜</span> Riwayat Nilai
            </button>
          </div>

          {activeTab === 'input' && (
            <div className="flex flex-col h-full overflow-hidden space-y-2">
              
              {/* AREA 40% ATAS: FORM FILTER COMPACT (FIXED / NON-SCROLL) */}
              <div className={`border rounded-xl p-2 shrink-0 shadow-xs space-y-1.5 ${
                isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-indigo-200'
              }`}>
                <div className="grid grid-cols-12 gap-1.5">
                  <div className="col-span-4">
                    <select
                      value={selectedKelasId}
                      onChange={(e) => setSelectedKelasId(e.target.value)}
                      className={`w-full border rounded-lg px-2 py-1 text-xs font-bold focus:outline-none ${
                        isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                      }`}
                    >
                      <option value="">-- Kelas --</option>
                      {kelasList.map((k) => (
                        <option key={k.id} value={k.id}>{k.nama}</option>
                      ))}
                    </select>
                  </div>

                  <div className="col-span-4">
                    <select
                      value={selectedMapelId}
                      onChange={(e) => setSelectedMapelId(e.target.value)}
                      className={`w-full border rounded-lg px-2 py-1 text-xs font-bold focus:outline-none ${
                        isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                      }`}
                    >
                      <option value="">-- Mapel --</option>
                      {mapelList.map((m) => (
                        <option key={m.id} value={m.id}>{m.nama}</option>
                      ))}
                    </select>
                  </div>

                  <div className="col-span-4">
                    <select
                      value={jenisPenilaian}
                      onChange={(e: any) => setJenisPenilaian(e.target.value)}
                      className={`w-full border rounded-lg px-2 py-1 text-xs font-bold focus:outline-none ${
                        isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                      }`}
                    >
                      <option value="nilai_tugas">Nilai Tugas</option>
                      <option value="nilai_uts">Nilai UTS</option>
                      <option value="nilai_uas">Nilai UAS</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* AREA 60% BAWAH: LIST INPUT NILAI SISWA (INTERNAL SCROLL AREA) */}
              <div className={`border rounded-xl p-2 flex-1 flex flex-col overflow-hidden shadow-xs ${
                isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-indigo-200'
              }`}>
                {!selectedKelasId || !selectedMapelId ? (
                  <div className={`py-8 text-center text-xs font-semibold ${isDarkMode ? 'text-slate-500' : 'text-slate-500'}`}>
                    Silakan pilih Kelas, Mapel, dan Jenis Penilaian.
                  </div>
                ) : loadingSiswa ? (
                  <div className={`py-8 text-center text-xs font-semibold ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                    Memuat data siswa...
                  </div>
                ) : siswaList.length === 0 ? (
                  <div className={`py-8 text-center text-xs font-semibold ${isDarkMode ? 'text-slate-500' : 'text-slate-500'}`}>
                    Belum ada siswa terdaftar di kelas ini.
                  </div>
                ) : (
                  /* AREA SCROLL KHUSUS HANYA UNTUK INPUT NILAI */
                  <div className="flex-1 overflow-y-auto pr-1 divide-y divide-slate-100 dark:divide-slate-800">
                    {siswaList.map((siswa, index) => {
                      const sId = String(siswa.id)
                      return (
                        <div key={sId || index} className="py-1.5 flex items-center justify-between gap-1.5">
                          <div className="min-w-0 flex-1">
                            <h4 className={`text-[11px] font-extrabold truncate ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                              {index + 1}. {siswa.nama_lengkap}
                            </h4>
                            <p className={`text-[9px] font-mono ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                              NISN: {siswa.nisn || '-'}
                            </p>
                          </div>

                          <div className="shrink-0 flex items-center gap-1">
                            <input
                              type="number"
                              min={0}
                              max={100}
                              value={nilaiInputMap[sId] ?? ''}
                              onChange={(e) => handleNilaiChange(sId, e.target.value)}
                              placeholder="0-100"
                              className={`w-16 border rounded-lg px-1.5 py-1 text-center text-xs font-extrabold focus:outline-none ${
                                isDarkMode ? 'bg-slate-800 border-slate-700 text-indigo-300' : 'bg-slate-50 border-slate-300 text-indigo-900'
                              }`}
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* TOMBOL SIMPAN NILAI */}
              {selectedKelasId && selectedMapelId && siswaList.length > 0 && (
                <button
                  type="button"
                  onClick={handleSimpanNilai}
                  disabled={saving}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-600 text-white font-black py-1.5 rounded-lg text-xs transition shadow-xs flex items-center justify-center gap-1 cursor-pointer shrink-0"
                >
                  <span>💾</span>
                  <span>{saving ? 'Menyimpan...' : 'SIMPAN NILAI SISWA'}</span>
                </button>
              )}

            </div>
          )}

          {/* TAB 2: RIWAYAT & REKAPITULASI (INTERNAL SCROLL AREA) */}
          {activeTab === 'rekap' && (
            <div className="flex flex-col h-full overflow-hidden space-y-2">
              
              {/* STATISTIK RINGKAS */}
              <div className={`border rounded-lg p-1.5 shrink-0 shadow-xs text-center ${
                isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-300'
              }`}>
                <span className={`text-[9px] font-black uppercase ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  TOTAL ENTRI NILAI:{' '}
                </span>
                <span className={`text-xs font-black ${isDarkMode ? 'text-indigo-300' : 'text-indigo-900'}`}>
                  {totalEntri}
                </span>
              </div>

              {/* FILTER BAR REKAP */}
              <div className={`grid grid-cols-3 gap-1 border p-1 rounded-lg shrink-0 shadow-xs ${
                isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-indigo-200'
              }`}>
                <select
                  value={filterKelasId}
                  onChange={(e) => setFilterKelasId(e.target.value)}
                  className={`border rounded px-1.5 py-0.5 text-xs font-bold focus:outline-none ${
                    isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                >
                  <option value="">Semua Kelas</option>
                  {kelasList.map((k) => (
                    <option key={k.id} value={k.id}>{k.nama}</option>
                  ))}
                </select>

                <select
                  value={filterMapelId}
                  onChange={(e) => setFilterMapelId(e.target.value)}
                  className={`border rounded px-1.5 py-0.5 text-xs font-bold focus:outline-none ${
                    isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                >
                  <option value="">Semua Mapel</option>
                  {mapelList.map((m) => (
                    <option key={m.id} value={m.id}>{m.nama}</option>
                  ))}
                </select>

                <input
                  type="text"
                  value={searchNama}
                  onChange={(e) => setSearchNama(e.target.value)}
                  placeholder="Cari nama..."
                  className={`border rounded px-1.5 py-0.5 text-xs font-bold focus:outline-none ${
                    isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                />
              </div>

              {/* LIST REKAP (INTERNAL SCROLL AREA) */}
              <div className={`border rounded-xl p-2 flex-1 flex flex-col overflow-hidden shadow-xs ${
                isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-indigo-200'
              }`}>
                {loadingRekap ? (
                  <div className={`py-6 text-center text-xs font-medium ${isDarkMode ? 'text-slate-500' : 'text-slate-600'}`}>
                    Memuat riwayat nilai...
                  </div>
                ) : rekapList.length === 0 ? (
                  <div className={`py-6 text-center text-xs font-medium ${isDarkMode ? 'text-slate-500' : 'text-slate-600'}`}>
                    Tidak ada data nilai ditemukan.
                  </div>
                ) : (
                  <div className="flex-1 overflow-y-auto pr-1 space-y-1.5">
                    {rekapList.map((item, index) => (
                      <div
                        key={item.id || index}
                        className={`p-2 rounded-lg border transition shadow-xs flex flex-col gap-1 ${
                          isDarkMode ? 'bg-slate-800/80 border-slate-700' : 'bg-slate-50 border-slate-200'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className={`text-[11px] font-extrabold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                            {item.siswa?.nama_lengkap || '-'}
                          </span>
                          <span className={`px-1.5 py-0.2 rounded text-[9px] font-black border ${
                            isDarkMode ? 'bg-indigo-950 text-indigo-300 border-indigo-800' : 'bg-indigo-100 text-indigo-800 border-indigo-200'
                          }`}>
                            {item.siswa?.kelas?.nama_kelas || '-'}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-[10px]">
                          <span className={`font-bold ${isDarkMode ? 'text-indigo-300' : 'text-indigo-950'}`}>
                            📖 {item.mata_pelajaran}
                          </span>
                          <span className={`font-mono ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                            📅 {item.created_at ? new Date(item.created_at).toLocaleDateString('id-ID') : '-'}
                          </span>
                        </div>

                        <div className="grid grid-cols-3 gap-1 text-center py-1 bg-slate-950/20 rounded-md text-[10px]">
                          <div>
                            <span className="block text-[8px] font-bold text-amber-500">TUGAS</span>
                            <span className="font-black text-amber-500">{item.nilai_tugas ?? '-'}</span>
                          </div>
                          <div>
                            <span className="block text-[8px] font-bold text-indigo-400">UTS</span>
                            <span className="font-black text-indigo-400">{item.nilai_uts ?? '-'}</span>
                          </div>
                          <div>
                            <span className="block text-[8px] font-bold text-emerald-400">UAS</span>
                            <span className="font-black text-emerald-400">{item.nilai_uas ?? '-'}</span>
                          </div>
                        </div>

                        <div className="flex justify-end pt-0.5 border-t border-slate-700/20">
                          <button
                            onClick={async () => {
                              if (item.id && confirm('Hapus entri nilai ini?')) {
                                await supabase.from('nilai').delete().eq('id', item.id)
                                setRekapList((prev) => prev.filter((r) => r.id !== item.id))
                              }
                            }}
                            className="text-rose-500 hover:text-rose-700 font-bold text-[10px]"
                          >
                            🗑️ Hapus Nilai
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          )}

        </main>
      </div>

      {/* 3. FIXED BOTTOM NAVIGATION BAR */}
      <div className={`border-t fixed bottom-0 left-0 right-0 z-50 shadow-lg shrink-0 print:hidden transition-colors duration-300 ${
        isDarkMode ? 'bg-slate-900/95 border-slate-800 backdrop-blur-md' : 'bg-slate-100/95 border-slate-300 backdrop-blur-md'
      }`}>
        <div className="max-w-xl mx-auto px-4 py-1.5 flex items-center justify-between">
          <Link href="/" className={`flex flex-col items-center gap-0.5 text-[10px] font-semibold transition ${
            isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-950'
          }`}>
            <span className="text-base leading-none">🕒</span>
            <span>Dashboard</span>
          </Link>

          {isOperator && (
            <Link href="/siswa" className={`flex flex-col items-center gap-0.5 text-[10px] font-semibold transition ${
              isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-950'
            }`}>
              <span className="text-base leading-none">👥</span>
              <span>Siswa</span>
            </Link>
          )}

          {isOperator && (
            <Link href="/guru" className={`flex flex-col items-center gap-0.5 text-[10px] font-semibold transition ${
              isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-950'
            }`}>
              <span className="text-base leading-none">👨‍🏫</span>
              <span>Guru</span>
            </Link>
          )}

          <Link href="/nilai" className="flex flex-col items-center gap-0.5 text-[10px] font-bold text-indigo-500 transition">
            <span className="text-base leading-none">🎓</span>
            <span>Akademik</span>
          </Link>

          <Link href="/laporan" className={`flex flex-col items-center gap-0.5 text-[10px] font-semibold transition ${
            isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-950'
          }`}>
            <span className="text-base leading-none">🖨️</span>
            <span>Laporan</span>
          </Link>
        </div>
      </div>

    </motion.div>
  )
}