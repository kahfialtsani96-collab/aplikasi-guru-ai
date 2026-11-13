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

interface MapelItem {
  id: number
  nama_mapel: string
  kode_mapel: string
}

interface KelasItem {
  id: number
  nama_kelas: string
}

interface GuruItem {
  id?: number
  nama_lengkap: string
  email: string
}

interface MasterJamItem {
  id: number
  hari: string
  jam_ke: number
  waktu_mulai: string
  waktu_selesai: string
  keterangan: string
}

interface Jadwal {
  id?: number
  hari: string
  jam: string
  jam_ke?: number | string
  kelas_id?: number
  mapel_id?: number
  guru_email?: string
  kelas?: { nama_kelas: string } | string
  mapel?: { nama_mapel: string; kode_mapel: string } | string
}

// Map Urutan Hari untuk Sorting Presisi
const HARI_ORDER: Record<string, number> = {
  'Senin': 1,
  'Selasa': 2,
  'Rabu': 3,
  'Kamis': 4,
  'Jumat': 5,
  'Sabtu': 6,
  'Minggu': 7,
}

export default function JadwalMengajarPage() {
  const router = useRouter()
  const { isOperator, canAccessBimbingan, loading: loadingRole } = useAuthRole()

  const [userDisplayName, setUserDisplayName] = useState('MEMUAT...')
  const [userNuptkDisplay, setUserNuptkDisplay] = useState('-')
  const [isStrictOperatorRole, setIsStrictOperatorRole] = useState(false)
  const [waliKelasAssignedId, setWaliKelasAssignedId] = useState<number | null>(null)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'kelola' | 'rekap'>('kelola')
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

  // Options dari DB
  const [mapelList, setMapelList] = useState<MapelItem[]>([])
  const [kelasList, setKelasList] = useState<KelasItem[]>([])
  const [guruList, setGuruList] = useState<GuruItem[]>([])
  const [masterJamList, setMasterJamList] = useState<MasterJamItem[]>([])

  // State Form Input (Khusus Operator)
  const [hari, setHari] = useState('Senin')
  const [jamMulai, setJamMulai] = useState<string>('1')
  const [jamSelesai, setJamSelesai] = useState<string>('1')
  const [selectedKelasId, setSelectedKelasId] = useState<string>('')
  const [selectedMapelId, setSelectedMapelId] = useState<string>('')
  const [selectedGuruEmail, setSelectedGuruEmail] = useState<string>('')

  const [jadwalList, setJadwalList] = useState<Jadwal[]>([])
  const [loading, setLoading] = useState(false)

  // State Filter Rekap
  const [filterHari, setFilterHari] = useState('')
  const [filterKelasId, setFilterKelasId] = useState('')
  const [filterMapelId, setFilterMapelId] = useState('')

  useEffect(() => {
    let isMounted = true

    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        if (isMounted) router.replace('/login')
        return
      }

      const rawEmail = user.email || ''
      const cleanEmail = rawEmail.trim().toLowerCase()

      if (isMounted) {
        setUserEmail(rawEmail)
        setSelectedGuruEmail(rawEmail)
      }

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

      fetchMasterData()
      fetchJadwal(rawEmail, isOperator)
    }

    if (!loadingRole) {
      init()
    }

    return () => {
      isMounted = false
    }
  }, [isOperator, loadingRole, router])

  async function fetchMasterData() {
    const { data: dMapel } = await supabase.from('mapel').select('id, nama_mapel, kode_mapel').order('urutan', { ascending: true })
    if (dMapel) setMapelList(dMapel)

    const { data: dKelas } = await supabase.from('kelas').select('id, nama_kelas').order('nama_kelas', { ascending: true })
    if (dKelas) setKelasList(dKelas)

    const { data: dGuru } = await supabase.from('guru').select('id, nama_lengkap, email').order('nama_lengkap', { ascending: true })
    if (dGuru) setGuruList(dGuru)

    const { data: dJam } = await supabase.from('master_jam').select('*').order('jam_ke', { ascending: true })
    if (dJam) setMasterJamList(dJam)
  }

  async function fetchJadwal(emailParam?: string | null, operatorMode?: boolean) {
    setLoading(true)
    try {
      let query = supabase
        .from('jadwal')
        .select(`
          id,
          hari,
          jam,
          jam_ke,
          kelas_id,
          mapel_id,
          guru_email,
          kelas:kelas_id(nama_kelas),
          mapel:mapel_id(nama_mapel, kode_mapel)
        `)

      if (!operatorMode && emailParam) {
        query = query.eq('guru_email', emailParam)
      }

      const { data, error } = await query

      if (!error && data) {
        const sortedData = (data as any[]).sort((a, b) => {
          const orderHariA = HARI_ORDER[a.hari] || 99
          const orderHariB = HARI_ORDER[b.hari] || 99

          if (orderHariA !== orderHariB) {
            return orderHariA - orderHariB
          }

          const jamA = Number(a.jam_ke || 0)
          const jamB = Number(b.jam_ke || 0)
          return jamA - jamB
        })

        setJadwalList(sortedData)
      } else {
        setJadwalList([])
      }
    } catch (err) {
      console.error('Error fetching jadwal:', err)
    } finally {
      setLoading(false)
    }
  }

  const jamOptionsForSelectedHari = masterJamList.filter((j) => j.hari === hari)

  const handleSimpan = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isOperator) return

    if (!selectedKelasId || !selectedMapelId) {
      alert('Silakan pilih Kelas dan Mata Pelajaran!')
      return
    }

    if (!selectedGuruEmail) {
      alert('Email guru pengampu wajib dipilih!')
      return
    }

    const startJamObj = masterJamList.find((j) => j.hari === hari && j.jam_ke === Number(jamMulai))
    const endJamObj = masterJamList.find((j) => j.hari === hari && j.jam_ke === Number(jamSelesai))

    let formattedJamText = `Jam Ke-${jamMulai}`
    if (startJamObj && endJamObj) {
      const wMulai = startJamObj.waktu_mulai.slice(0, 5)
      const wSelesai = endJamObj.waktu_selesai.slice(0, 5)
      
      if (Number(jamMulai) === Number(jamSelesai)) {
        formattedJamText = `Jam Ke-${jamMulai} (${wMulai} - ${wSelesai})`
      } else {
        formattedJamText = `Jam Ke-${jamMulai} s/d ${jamSelesai} (${wMulai} - ${wSelesai})`
      }
    }

    const startInput = Number(jamMulai)
    const endInput = Number(jamSelesai)

    const bentrok = jadwalList.find((j) => {
      if (j.hari !== hari) return false

      let existingStart = Number(j.jam_ke || 1)
      let existingEnd = existingStart

      if (j.jam && j.jam.includes('s/d')) {
        const match = j.jam.match(/Ke-(\d+)\s+s\/d\s+(\d+)/)
        if (match) {
          existingStart = Number(match[1])
          existingEnd = Number(match[2])
        }
      }

      const isTimeOverlap = startInput <= existingEnd && endInput >= existingStart
      if (!isTimeOverlap) return false

      const isSameKelas = Number(j.kelas_id) === Number(selectedKelasId)
      const isSameGuru = j.guru_email === selectedGuruEmail

      return isSameKelas || isSameGuru
    })

    if (bentrok) {
      const isSameKelas = Number(bentrok.kelas_id) === Number(selectedKelasId)
      if (isSameKelas) {
        alert(`BENTROK KELAS! Kelas yang dipilih sudah memiliki jadwal mengajar pada ${hari} di jam tersebut.`)
      } else {
        alert(`BENTROK GURU! Guru yang dipilih (${selectedGuruEmail}) sudah mengajar di kelas lain pada ${hari} di jam tersebut.`)
      }
      return
    }

    try {
      const selectedMapelObj = mapelList.find((m) => m.id === Number(selectedMapelId))
      const selectedKelasObj = kelasList.find((k) => k.id === Number(selectedKelasId))

      const { error } = await supabase.from('jadwal').insert([
        {
          hari,
          jam: formattedJamText,
          jam_ke: Number(jamMulai),
          kelas_id: Number(selectedKelasId),
          mapel_id: Number(selectedMapelId),
          guru_email: selectedGuruEmail,
          kelas: selectedKelasObj?.nama_kelas || '',
          mapel: selectedMapelObj?.nama_mapel || '',
        },
      ])

      if (error) {
        alert('Gagal menyimpan jadwal: ' + error.message)
      } else {
        alert('Jadwal berhasil ditambahkan!')
        setSelectedKelasId('')
        setSelectedMapelId('')
        fetchJadwal(userEmail, isOperator)
      }
    } catch (err: any) {
      alert('Error: ' + err.message)
    }
  }

  const handleDelete = async (id?: number) => {
    if (!isOperator) return
    if (!id || !confirm('Yakin ingin menghapus jadwal mengajar ini?')) return

    try {
      const { error } = await supabase.from('jadwal').delete().eq('id', id)
      if (!error) {
        setJadwalList((prev) => prev.filter((item) => item.id !== id))
      }
    } catch (err) {
      console.error('Error deleting jadwal:', err)
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

  const filteredRekapList = jadwalList.filter((item) => {
    const matchHari = !filterHari || item.hari === filterHari
    const matchKelas = !filterKelasId || Number(item.kelas_id) === Number(filterKelasId)
    const matchMapel = !filterMapelId || Number(item.mapel_id) === Number(filterMapelId)
    return matchHari && matchKelas && matchMapel
  })

  if (loadingRole) {
    return (
      <div className={`h-screen w-screen flex items-center justify-center font-sans ${isDarkMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-200 text-slate-800'}`}>
        <div className={`p-4 rounded-xl border text-center space-y-1 shadow-xs ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-300'}`}>
          <p className="font-bold text-xs">Memuat Data Jadwal...</p>
        </div>
      </div>
    )
  }

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
                Jadwal Mengajar
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
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
            <Link href="/jadwal" className="bg-indigo-600 text-white px-2 py-0.5 rounded shadow-xs font-extrabold flex items-center gap-1">
              <span>🕒</span> Jadwal
            </Link>
            <Link href="/absensi" className={`px-2 py-0.5 rounded border transition flex items-center gap-1 ${
              isDarkMode ? 'bg-slate-800 text-slate-300 border-slate-700' : 'bg-white text-slate-700 border-slate-300'
            }`}>
              <span>📋</span> Absensi
            </Link>
            <Link href="/nilai" className={`px-2 py-0.5 rounded border transition flex items-center gap-1 ${
              isDarkMode ? 'bg-slate-800 text-slate-300 border-slate-700' : 'bg-white text-slate-700 border-slate-300'
            }`}>
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
          <div className="flex items-center justify-between gap-1.5 shrink-0">
            <div className={`grid grid-cols-2 p-0.5 rounded-lg border w-full text-[11px] font-extrabold shadow-xs ${
              isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-300'
            }`}>
              <button
                onClick={() => setActiveTab('kelola')}
                className={`py-1 rounded-md transition flex items-center justify-center gap-1 cursor-pointer ${
                  activeTab === 'kelola' 
                    ? 'bg-indigo-600 text-white shadow-xs' 
                    : isDarkMode ? 'text-slate-400' : 'text-slate-700'
                }`}
              >
                <span>🕒</span> {isOperator ? 'Input & Kelola' : 'Jadwal Saya'}
              </button>
              <button
                onClick={() => setActiveTab('rekap')}
                className={`py-1 rounded-md transition flex items-center justify-center gap-1 cursor-pointer ${
                  activeTab === 'rekap' 
                    ? 'bg-indigo-600 text-white shadow-xs' 
                    : isDarkMode ? 'text-slate-400' : 'text-slate-700'
                }`}
              >
                <span>📜</span> Rekap &amp; Cetak
              </button>
            </div>

            <button
              onClick={() => window.print()}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold px-2.5 py-1 rounded-lg text-[10px] flex items-center justify-center gap-1 transition shadow-xs cursor-pointer shrink-0"
              title="Cetak Jadwal PDF"
            >
              <span>🖨️</span> Cetak
            </button>
          </div>

          {activeTab === 'kelola' && (
            <div className="flex flex-col h-full overflow-hidden space-y-2">
              
              {/* AREA 40% ATAS: FORM INPUT COMPACT (KHUSUS OPERATOR - FIXED / NON-SCROLL) */}
              {isOperator && (
                <form onSubmit={handleSimpan} className={`border rounded-xl p-2 shrink-0 shadow-xs space-y-1.5 ${
                  isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-indigo-200'
                }`}>
                  {/* ROW 1: GURU PENGAMPU */}
                  <div>
                    <select
                      value={selectedGuruEmail}
                      onChange={(e) => setSelectedGuruEmail(e.target.value)}
                      className={`w-full border rounded-lg px-2 py-1 text-xs font-bold focus:outline-none ${
                        isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                      }`}
                      required
                    >
                      <option value="">-- Pilih Guru Pengampu --</option>
                      {guruList.map((g) => (
                        <option key={g.id} value={g.email}>{g.nama_lengkap}</option>
                      ))}
                    </select>
                  </div>

                  {/* ROW 2: HARI & JAM MENGAJAR */}
                  <div className="grid grid-cols-12 gap-1.5">
                    <div className="col-span-5">
                      <select
                        value={hari}
                        onChange={(e) => {
                          setHari(e.target.value)
                          setJamMulai('1')
                          setJamSelesai('1')
                        }}
                        className={`w-full border rounded-lg px-2 py-1 text-xs font-bold focus:outline-none ${
                          isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                        }`}
                      >
                        <option value="Senin">Senin</option>
                        <option value="Selasa">Selasa</option>
                        <option value="Rabu">Rabu</option>
                        <option value="Kamis">Kamis</option>
                        <option value="Sabtu">Sabtu</option>
                        <option value="Minggu">Minggu</option>
                      </select>
                    </div>

                    <div className="col-span-7 flex gap-1">
                      <select
                        value={jamMulai}
                        onChange={(e) => {
                          const val = e.target.value
                          setJamMulai(val)
                          if (Number(val) > Number(jamSelesai)) setJamSelesai(val)
                        }}
                        className={`w-full border rounded-lg px-1 py-1 text-xs font-bold focus:outline-none ${
                          isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                        }`}
                      >
                        {jamOptionsForSelectedHari.length > 0 ? (
                          jamOptionsForSelectedHari.map((j) => (
                            <option key={j.id} value={j.jam_ke}>Jam {j.jam_ke}</option>
                          ))
                        ) : (
                          [1, 2, 3, 4, 5, 6, 7, 8].map((num) => (
                            <option key={num} value={num}>Jam {num}</option>
                          ))
                        )}
                      </select>

                      <select
                        value={jamSelesai}
                        onChange={(e) => setJamSelesai(e.target.value)}
                        className={`w-full border rounded-lg px-1 py-1 text-xs font-bold focus:outline-none ${
                          isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                        }`}
                      >
                        {jamOptionsForSelectedHari.length > 0 ? (
                          jamOptionsForSelectedHari
                            .filter((j) => j.jam_ke >= Number(jamMulai))
                            .map((j) => (
                              <option key={j.id} value={j.jam_ke}>s/d {j.jam_ke}</option>
                            ))
                        ) : (
                          [1, 2, 3, 4, 5, 6, 7, 8]
                            .filter((num) => num >= Number(jamMulai))
                            .map((num) => (
                              <option key={num} value={num}>s/d {num}</option>
                            ))
                        )}
                      </select>
                    </div>
                  </div>

                  {/* ROW 3: KELAS & MAPEL */}
                  <div className="grid grid-cols-12 gap-1.5">
                    <div className="col-span-6">
                      <select
                        value={selectedKelasId}
                        onChange={(e) => setSelectedKelasId(e.target.value)}
                        className={`w-full border rounded-lg px-2 py-1 text-xs font-bold focus:outline-none ${
                          isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                        }`}
                        required
                      >
                        <option value="">-- Kelas --</option>
                        {kelasList.map((k) => (
                          <option key={k.id} value={k.id}>{k.nama_kelas}</option>
                        ))}
                      </select>
                    </div>

                    <div className="col-span-6">
                      <select
                        value={selectedMapelId}
                        onChange={(e) => setSelectedMapelId(e.target.value)}
                        className={`w-full border rounded-lg px-2 py-1 text-xs font-bold focus:outline-none ${
                          isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                        }`}
                        required
                      >
                        <option value="">-- Mapel --</option>
                        {mapelList.map((m) => (
                          <option key={m.id} value={m.id}>{m.nama_mapel} ({m.kode_mapel})</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* TOMBOL SIMPAN */}
                  <button
                    type="submit"
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black py-1.5 rounded-lg text-xs transition shadow-xs flex items-center justify-center gap-1 cursor-pointer mt-1"
                  >
                    <span>+ SIMPAN JADWAL</span>
                  </button>
                </form>
              )}

              {/* AREA 60% BAWAH: DAFTAR JADWAL (INTERNAL SCROLL AREA) */}
              <div className={`border rounded-xl p-2 flex-1 flex flex-col overflow-hidden shadow-xs ${
                isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-indigo-200'
              }`}>
                <div className="flex items-center justify-between pb-1.5 border-b border-slate-700/30 shrink-0">
                  <h3 className={`text-[11px] font-black uppercase flex items-center gap-1 ${isDarkMode ? 'text-indigo-300' : 'text-indigo-900'}`}>
                    <span>🕒</span> {isOperator ? 'Daftar Semua Jadwal' : 'Jadwal Mengajar Saya'} ({jadwalList.length})
                  </h3>
                </div>

                {/* AREA SCROLL KHUSUS HANYA UNTUK JADWAL */}
                <div className="flex-1 overflow-y-auto pr-1 pt-1.5 space-y-1.5">
                  {loading ? (
                    <div className={`py-6 text-center text-xs font-medium ${isDarkMode ? 'text-slate-500' : 'text-slate-600'}`}>
                      Memuat jadwal...
                    </div>
                  ) : jadwalList.length === 0 ? (
                    <div className={`py-6 text-center text-xs font-medium ${isDarkMode ? 'text-slate-500' : 'text-slate-600'}`}>
                      Belum ada jadwal mengajar tersimpan.
                    </div>
                  ) : (
                    jadwalList.map((item, index) => {
                      const namaKelas = typeof item.kelas === 'object' ? item.kelas?.nama_kelas : item.kelas
                      const namaMapel = typeof item.mapel === 'object' ? item.mapel?.nama_mapel : item.mapel
                      return (
                        <div
                          key={item.id || index}
                          className={`p-2 rounded-lg border transition shadow-xs flex flex-col gap-1 ${
                            isDarkMode ? 'bg-slate-800/80 border-slate-700' : 'bg-slate-50 border-slate-200'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-extrabold text-[10px] text-amber-500 uppercase px-1.5 py-0.2 rounded bg-amber-500/10 border border-amber-500/20">
                              {item.hari}
                            </span>
                            <span className={`px-1.5 py-0.2 rounded text-[10px] font-black border ${
                              isDarkMode ? 'bg-indigo-950 text-indigo-300 border-indigo-800' : 'bg-indigo-100 text-indigo-800 border-indigo-200'
                            }`}>
                              {namaKelas || '-'}
                            </span>
                          </div>

                          <div className="flex items-center justify-between">
                            <h4 className={`font-extrabold text-[11px] ${isDarkMode ? 'text-indigo-300' : 'text-indigo-950'}`}>
                              {namaMapel || '-'}
                            </h4>
                            <span className={`text-[10px] font-bold ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                              ⏰ {item.jam}
                            </span>
                          </div>

                          {isOperator && (
                            <div className="flex items-center justify-between pt-1 border-t border-slate-700/20 text-[10px]">
                              <span className={`font-mono truncate max-w-[180px] ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                                👤 {item.guru_email}
                              </span>
                              <button
                                onClick={() => handleDelete(item.id)}
                                className="text-rose-500 hover:text-rose-700 font-bold p-0.5 cursor-pointer"
                                title="Hapus"
                              >
                                🗑️
                              </button>
                            </div>
                          )}
                        </div>
                      )
                    })
                  )}
                </div>
              </div>

            </div>
          )}

          {/* TAB 2: REKAPITULASI & CETAK (INTERNAL SCROLL AREA) */}
          {activeTab === 'rekap' && (
            <div className="flex flex-col h-full overflow-hidden space-y-2">
              
              {/* FILTER BAR REKAP */}
              <div className={`grid grid-cols-3 gap-1 border p-1 rounded-lg shrink-0 shadow-xs ${
                isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-indigo-200'
              }`}>
                <select
                  value={filterHari}
                  onChange={(e) => setFilterHari(e.target.value)}
                  className={`border rounded px-1.5 py-0.5 text-xs font-bold focus:outline-none ${
                    isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                >
                  <option value="">Semua Hari</option>
                  <option value="Senin">Senin</option>
                  <option value="Selasa">Selasa</option>
                  <option value="Rabu">Rabu</option>
                  <option value="Kamis">Kamis</option>
                  <option value="Sabtu">Sabtu</option>
                  <option value="Minggu">Minggu</option>
                </select>

                <select
                  value={filterKelasId}
                  onChange={(e) => setFilterKelasId(e.target.value)}
                  className={`border rounded px-1.5 py-0.5 text-xs font-bold focus:outline-none ${
                    isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                >
                  <option value="">Semua Kelas</option>
                  {kelasList.map((k) => (
                    <option key={k.id} value={k.id}>{k.nama_kelas}</option>
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
                    <option key={m.id} value={m.id}>{m.nama_mapel}</option>
                  ))}
                </select>
              </div>

              {/* LIST REKAP (INTERNAL SCROLL) */}
              <div className={`border rounded-xl p-2 flex-1 flex flex-col overflow-hidden shadow-xs ${
                isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-indigo-200'
              }`}>
                {loading ? (
                  <div className={`py-6 text-center text-xs font-medium ${isDarkMode ? 'text-slate-500' : 'text-slate-600'}`}>
                    Memuat riwayat...
                  </div>
                ) : filteredRekapList.length === 0 ? (
                  <div className={`py-6 text-center text-xs font-medium ${isDarkMode ? 'text-slate-500' : 'text-slate-600'}`}>
                    Tidak ada jadwal ditemukan.
                  </div>
                ) : (
                  <div className="flex-1 overflow-y-auto pr-1 space-y-1.5">
                    {filteredRekapList.map((item, index) => {
                      const namaKelas = typeof item.kelas === 'object' ? item.kelas?.nama_kelas : item.kelas
                      const namaMapel = typeof item.mapel === 'object' ? item.mapel?.nama_mapel : item.mapel
                      return (
                        <div
                          key={item.id || index}
                          className={`p-2 rounded-lg border transition shadow-xs flex flex-col gap-1 ${
                            isDarkMode ? 'bg-slate-800/80 border-slate-700' : 'bg-slate-50 border-slate-200'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-extrabold text-[10px] text-amber-500 uppercase px-1.5 py-0.2 rounded bg-amber-500/10 border border-amber-500/20">
                              #{index + 1} - {item.hari}
                            </span>
                            <span className={`px-1.5 py-0.2 rounded text-[10px] font-black border ${
                              isDarkMode ? 'bg-indigo-950 text-indigo-300 border-indigo-800' : 'bg-indigo-100 text-indigo-800 border-indigo-200'
                            }`}>
                              {namaKelas || '-'}
                            </span>
                          </div>

                          <div className="flex items-center justify-between">
                            <h4 className={`font-extrabold text-[11px] ${isDarkMode ? 'text-indigo-300' : 'text-indigo-950'}`}>
                              {namaMapel || '-'}
                            </h4>
                            <span className={`text-[10px] font-bold ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                              ⏰ {item.jam}
                            </span>
                          </div>

                          {isOperator && (
                            <div className="flex justify-end pt-1 border-t border-slate-700/20">
                              <button
                                onClick={() => handleDelete(item.id)}
                                className="text-rose-500 hover:text-rose-700 font-bold text-[10px]"
                              >
                                🗑️ Hapus
                              </button>
                            </div>
                          )}
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

          <Link href="/jadwal" className="flex flex-col items-center gap-0.5 text-[10px] font-bold text-indigo-500 transition">
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