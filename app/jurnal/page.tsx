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

interface OptionItem {
  id: number
  nama: string
}

interface MasterJamItem {
  id: number
  hari: string
  jam_ke: number
  waktu_mulai: string
  waktu_selesai: string
  keterangan: string
}

interface JurnalRecord {
  id?: number | string
  created_at?: string
  tanggal: string
  jam_ke: string
  kelas_id?: number
  mapel_id?: number
  kelas?: string
  mapel?: string
  materi: string
  status: 'Terlaksana' | 'Tertunda'
  absen_siswa: string
  keterangan?: string
  guru_email?: string
}

export default function AgendaMengajarPage() {
  const router = useRouter()
  const { isOperator, canAccessBimbingan } = useAuthRole()

  const [userDisplayName, setUserDisplayName] = useState('GURU')
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'input' | 'rekap'>('input')

  // DETEKSI OTOMATIS TEMA DARK MODE DARI LOCAL STORAGE
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false)

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme')
    if (savedTheme === 'dark') {
      setIsDarkMode(true)
    }
  }, [])

  // Master Data Options
  const [kelasList, setKelasList] = useState<OptionItem[]>([])
  const [mapelList, setMapelList] = useState<OptionItem[]>([])
  const [masterJamList, setMasterJamList] = useState<MasterJamItem[]>([])

  // State Input Jurnal Agenda
  const [tanggal, setTanggal] = useState('')
  const [hari, setHari] = useState('Senin')
  const [jamMulai, setJamMulai] = useState('1')
  const [jamSelesai, setJamSelesai] = useState('1')
  const [selectedKelasId, setSelectedKelasId] = useState('')
  const [selectedMapelId, setSelectedMapelId] = useState('')
  const [materi, setMateri] = useState('')
  const [status, setStatus] = useState<'Terlaksana' | 'Tertunda'>('Terlaksana')
  const [absenSiswa, setAbsenSiswa] = useState('Nihil')
  const [keterangan, setKeterangan] = useState('')

  const [jurnalList, setJurnalList] = useState<JurnalRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  // State Rekapitulasi Agenda
  const [rekapList, setRekapList] = useState<JurnalRecord[]>([])
  const [filterKelasId, setFilterKelasId] = useState('')
  const [filterMapelId, setFilterMapelId] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [searchMateri, setSearchMateri] = useState('')
  const [loadingRekap, setLoadingRekap] = useState(false)

  useEffect(() => {
    async function initUser() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const email = user.email || ''
        setUserEmail(email)
        const nameFromMeta = user.user_metadata?.full_name || email.split('@')[0] || 'GURU'
        setUserDisplayName(nameFromMeta.toUpperCase())
        
        fetchJadwalGuru(email)
        fetchMasterJam()
        fetchJurnal(email)
      }
    }

    // Presisi Zona Waktu Indonesia (WIB)
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    const todayStr = `${year}-${month}-${day}`
    setTanggal(todayStr)

    // Deteksi Hari
    const namaHari = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'][now.getDay()]
    if (namaHari !== 'Jumat') {
      setHari(namaHari)
    }

    initUser()
  }, [])

  // Fetch Slot Waktu dari Master Jam
  async function fetchMasterJam() {
    const { data } = await supabase.from('master_jam').select('*').order('jam_ke', { ascending: true })
    if (data) setMasterJamList(data)
  }

  // Auto-Fetch Kelas & Mapel
  async function fetchJadwalGuru(email: string) {
    try {
      if (isOperator) {
        const { data: dataKelas } = await supabase.from('kelas').select('id, nama_kelas').order('nama_kelas', { ascending: true })
        const { data: dataMapel } = await supabase.from('mapel').select('id, nama_mapel').order('nama_mapel', { ascending: true })

        if (dataKelas) {
          setKelasList(dataKelas.map((k: any) => ({ id: k.id, nama: k.nama_kelas })))
        }
        if (dataMapel) {
          setMapelList(dataMapel.map((m: any) => ({ id: m.id, nama: m.nama_mapel })))
        }
        return
      }

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

        data.forEach((item: any) => {
          if (item.kelas && item.kelas.id) {
            uniqueKelasMap.set(item.kelas.id, item.kelas.nama_kelas)
          }
          if (item.mapel && item.mapel.id) {
            uniqueMapelMap.set(item.mapel.id, item.mapel.nama_mapel)
          }
        })

        setKelasList(Array.from(uniqueKelasMap.entries()).map(([id, nama]) => ({ id, nama })))
        setMapelList(Array.from(uniqueMapelMap.entries()).map(([id, nama]) => ({ id, nama })))
      }
    } catch (err) {
      console.error('Error fetching jadwal guru:', err)
    }
  }

  // Load Jurnal Agenda milik Guru
  async function fetchJurnal(emailParam?: string | null) {
    const activeEmail = emailParam || userEmail
    if (!activeEmail) return

    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('jurnal_agenda')
        .select('*')
        .eq('guru_email', activeEmail)
        .order('created_at', { ascending: false })

      if (!error && data) {
        setJurnalList(data as any)
      }
    } catch (err) {
      console.error('Error fetching jurnal:', err)
    } finally {
      setLoading(false)
    }
  }

  // Fetch Rekapitulasi Jurnal
  const fetchRekap = async () => {
    if (!userEmail) return

    setLoadingRekap(true)
    try {
      let query = supabase
        .from('jurnal_agenda')
        .select('*')
        .eq('guru_email', userEmail)
        .order('created_at', { ascending: false })

      if (filterKelasId) query = query.eq('kelas_id', Number(filterKelasId))
      if (filterMapelId) query = query.eq('mapel_id', Number(filterMapelId))
      if (filterStatus) query = query.eq('status', filterStatus)
      if (searchMateri.trim()) query = query.ilike('materi', `%${searchMateri.trim()}%`)

      const { data, error } = await query

      if (!error && data) {
        setRekapList(data as any)
      } else {
        setRekapList([])
      }
    } catch (err) {
      console.error('Error fetching rekap jurnal:', err)
    } finally {
      setLoadingRekap(false)
    }
  }

  useEffect(() => {
    if (activeTab === 'rekap' && userEmail) {
      fetchRekap()
    }
  }, [activeTab, filterKelasId, filterMapelId, filterStatus, searchMateri, userEmail])

  useEffect(() => {
    if (userEmail) {
      fetchJadwalGuru(userEmail)
    }
  }, [isOperator, userEmail])
  
  const jamOptionsForHari = masterJamList.filter((j) => j.hari === hari)

  const handleSimpanJurnal = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedKelasId || !selectedMapelId || !materi.trim() || !tanggal) {
      alert('Silakan lengkapi data Tanggal, Kelas, Mapel, dan Materi Pembelajaran!')
      return
    }

    if (!userEmail) {
      alert('Sesi login tidak valid. Silakan login ulang.')
      return
    }

    setSaving(true)
    try {
      const selectedKelasObj = kelasList.find((k) => k.id === Number(selectedKelasId))
      const selectedMapelObj = mapelList.find((m) => m.id === Number(selectedMapelId))

      const startJamObj = masterJamList.find((j) => j.hari === hari && j.jam_ke === Number(jamMulai))
      const endJamObj = masterJamList.find((j) => j.hari === hari && j.jam_ke === Number(jamSelesai))

      let jamFormattedText = `Jam Ke-${jamMulai}`
      if (startJamObj && endJamObj) {
        const wMulai = startJamObj.waktu_mulai.slice(0, 5)
        const wSelesai = endJamObj.waktu_selesai.slice(0, 5)
        
        if (Number(jamMulai) === Number(jamSelesai)) {
          jamFormattedText = `Jam Ke-${jamMulai} (${wMulai} - ${wSelesai})`
        } else {
          jamFormattedText = `Jam Ke-${jamMulai} s/d ${jamSelesai} (${wMulai} - ${wSelesai})`
        }
      }

      const { error } = await supabase.from('jurnal_agenda').insert([
        {
          tanggal,
          jam_ke: jamFormattedText,
          kelas_id: Number(selectedKelasId),
          mapel_id: Number(selectedMapelId),
          kelas: selectedKelasObj?.nama || '',
          mapel: selectedMapelObj?.nama || '',
          materi: materi.trim(),
          status,
          absen_siswa: absenSiswa.trim(),
          keterangan: keterangan.trim(),
          guru_email: userEmail
        },
      ])

      if (error) {
        alert('Gagal menyimpan jurnal: ' + error.message)
      } else {
        alert('Jurnal agenda mengajar berhasil disimpan!')
        setMateri('')
        setKeterangan('')
        setSelectedKelasId('')
        setSelectedMapelId('')
        setAbsenSiswa('Nihil')
        fetchJurnal(userEmail)
      }
    } catch (err: any) {
      alert('Terjadi kesalahan: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteJurnal = async (id?: number | string) => {
    if (!id || !confirm('Hapus jurnal agenda ini?')) return

    try {
      const { error } = await supabase.from('jurnal_agenda').delete().eq('id', id)
      if (!error) {
        setJurnalList((prev) => prev.filter((item) => item.id !== id))
        setRekapList((prev) => prev.filter((item) => item.id !== id))
      }
    } catch (err) {
      console.error('Error deleting jurnal:', err)
    }
  }

  const totalJurnal = rekapList.length
  const totalTerlaksana = rekapList.filter((item) => item.status === 'Terlaksana').length
  const totalTertunda = rekapList.filter((item) => item.status === 'Tertunda').length

  return (
    <motion.div
      initial={{ opacity: 0, x: -60 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className={`min-h-screen font-sans flex flex-col justify-between selection:bg-indigo-500 selection:text-white relative transition-colors duration-300 overflow-y-auto ${
        isDarkMode ? 'bg-slate-950 text-slate-100' : 'bg-[#E2E8F0] text-slate-800'
      }`}
    >
      
      {/* WATERMARK LOGO */}
      <div className={`fixed inset-0 pointer-events-none z-0 flex items-center justify-center select-none print:hidden transition-opacity duration-300 ${
        isDarkMode ? 'opacity-[0.05]' : 'opacity-[0.15]'
      }`}>
        <img src="/logo-smp.jpg" alt="Watermark" className="w-[850px] h-[850px] object-contain max-w-none" />
      </div>

      <div className="relative z-10 flex flex-col min-h-screen">
        
        {/* HEADER TOPBAR */}
        <header className={`border-b px-4 sm:px-6 py-2.5 flex flex-wrap sm:flex-nowrap items-center justify-between gap-3 shrink-0 shadow-xs print:hidden transition-colors duration-300 ${
          isDarkMode ? 'bg-slate-900/90 border-slate-800 backdrop-blur-md' : 'bg-slate-100/90 border-slate-300 backdrop-blur-md'
        }`}>
          <div className="flex items-center gap-2.5">
            <Link href="/" className={`p-1.5 rounded-lg transition ${isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'}`} title="Kembali ke Dashboard">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </Link>
            <div className="flex items-center gap-2.5">
              <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl overflow-hidden flex items-center justify-center border p-0.5 shadow-xs shrink-0 ${
                isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-300'
              }`}>
                <img src="/logo-smp.jpg" alt="Logo SMP" className="w-full h-full object-contain" />
              </div>
              <div>
                <h1 className={`font-bold text-sm sm:text-base leading-none ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Aplikasi Guru AI</h1>
                <p className={`text-[10px] sm:text-[11px] font-bold mt-0.5 ${isDarkMode ? 'text-emerald-400' : 'text-emerald-800'}`}>Jurnal Agenda Mengajar Harian</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 ml-auto sm:ml-0">
            <div className={`border text-xs font-bold px-3 py-1.5 rounded-xl flex items-center gap-2 shadow-xs ${
              isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-100' : 'bg-white border-slate-300 text-slate-800'
            }`}>
              <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px] font-bold">
                {userDisplayName.charAt(0)}
              </span>
              <span className="max-w-[80px] sm:max-w-none truncate">{userDisplayName}</span>
              <span className={`text-[9px] sm:text-[10px] px-1.5 py-0.5 rounded font-extrabold uppercase ml-0.5 border ${
                isDarkMode ? 'bg-indigo-950 text-indigo-300 border-indigo-800' : 'bg-indigo-100 text-indigo-800 border-indigo-200'
              }`}>
                {isOperator ? 'Operator' : 'Guru'}
              </span>
            </div>

            <button
              onClick={async () => {
                await supabase.auth.signOut()
                router.replace('/login')
              }}
              className={`border p-2 rounded-xl transition cursor-pointer ${
                isDarkMode 
                  ? 'bg-rose-950/50 border-rose-800 text-rose-400 hover:bg-rose-900/60' 
                  : 'bg-rose-100 border-rose-300 text-rose-700 hover:bg-rose-200'
              }`}
              title="Keluar"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </header>

        {/* SUB-NAVBAR AKADEMIK */}
        <div className={`border-b px-4 sm:px-6 py-2 shrink-0 overflow-x-auto print:hidden transition-colors duration-300 ${
          isDarkMode ? 'bg-slate-900/80 border-slate-800 backdrop-blur-md' : 'bg-slate-200/80 border-slate-300 backdrop-blur-md'
        }`}>
          <div className="max-w-6xl mx-auto flex items-center gap-2 min-w-max text-xs font-bold">
            <span className={`font-black pr-2 border-r flex items-center gap-1 ${
              isDarkMode ? 'text-indigo-300 border-slate-800' : 'text-indigo-900 border-slate-300'
            }`}>
              🎓 Akademik:
            </span>
            <Link href="/jadwal" className={`px-3 py-1.5 rounded-xl border transition flex items-center gap-1.5 ${
              isDarkMode ? 'bg-slate-800/80 text-slate-300 hover:bg-slate-800 border-slate-700' : 'bg-white/80 text-slate-700 hover:bg-white border-slate-300'
            }`}>
              <span>🕒</span> Jadwal Mengajar
            </Link>
            <Link href="/absensi" className={`px-3 py-1.5 rounded-xl border transition flex items-center gap-1.5 ${
              isDarkMode ? 'bg-slate-800/80 text-slate-300 hover:bg-slate-800 border-slate-700' : 'bg-white/80 text-slate-700 hover:bg-white border-slate-300'
            }`}>
              <span>📋</span> Input Absensi
            </Link>
            <Link href="/nilai" className={`px-3 py-1.5 rounded-xl border transition flex items-center gap-1.5 ${
              isDarkMode ? 'bg-slate-800/80 text-slate-300 hover:bg-slate-800 border-slate-700' : 'bg-white/80 text-slate-700 hover:bg-white border-slate-300'
            }`}>
              <span>⭐</span> Input Penilaian
            </Link>
            <Link href="/jurnal" className="bg-indigo-600 text-white px-3 py-1.5 rounded-xl shadow-xs font-extrabold flex items-center gap-1.5">
              <span>📓</span> Agenda Mengajar
            </Link>
            {canAccessBimbingan && (
              <Link href="/bimbingan" className={`px-3 py-1.5 rounded-xl border transition flex items-center gap-1.5 ${
                isDarkMode ? 'bg-slate-800/80 text-slate-300 hover:bg-slate-800 border-slate-700' : 'bg-white/80 text-slate-700 hover:bg-white border-slate-300'
              }`}>
                <span>💖</span> Bimbingan Guru Wali
              </Link>
            )}
          </div>
        </div>

        {/* MAIN CONTENT AREA */}
        <main className="max-w-6xl w-full mx-auto p-3.5 sm:p-4 flex-1 flex flex-col space-y-4 pb-28 sm:pb-16">
          
          {/* TAB MODE BAR */}
          <div className="flex items-center justify-between shrink-0 print:hidden">
            <div className={`grid grid-cols-2 p-1 rounded-xl border w-full sm:max-w-md text-xs font-extrabold ${
              isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-slate-200/90 border-slate-300'
            }`}>
              <button
                onClick={() => setActiveTab('input')}
                className={`py-2 sm:py-1.5 rounded-lg transition flex items-center justify-center gap-2 cursor-pointer ${
                  activeTab === 'input' 
                    ? 'bg-indigo-600 text-white shadow-xs' 
                    : isDarkMode 
                      ? 'text-slate-400 hover:text-white' 
                      : 'text-slate-700 hover:text-slate-900'
                }`}
              >
                <span>📅</span> Input Jurnal Agenda
              </button>
              <button
                onClick={() => setActiveTab('rekap')}
                className={`py-2 sm:py-1.5 rounded-lg transition flex items-center justify-center gap-2 cursor-pointer ${
                  activeTab === 'rekap' 
                    ? 'bg-indigo-600 text-white shadow-xs' 
                    : isDarkMode 
                      ? 'text-slate-400 hover:text-white' 
                      : 'text-slate-700 hover:text-slate-900'
                }`}
              >
                <span>📜</span> Riwayat &amp; Rekapitulasi
              </button>
            </div>
          </div>

          {/* TAB 1: INPUT JURNAL */}
          {activeTab === 'input' && (
            <div className="flex flex-col space-y-4">
              
              {/* FORM INPUT */}
              <form onSubmit={handleSimpanJurnal} className={`backdrop-blur-md border rounded-2xl p-4 shadow-xs shrink-0 print:hidden space-y-3 ${
                isDarkMode 
                  ? 'bg-slate-900/90 border-slate-800' 
                  : 'bg-gradient-to-br from-indigo-100/90 via-slate-100/90 to-indigo-50/90 border-indigo-200/80'
              }`}>
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                  <div className="sm:col-span-6 md:col-span-2">
                    <label className={`block text-[10px] font-extrabold uppercase mb-1 ${isDarkMode ? 'text-indigo-300' : 'text-indigo-950'}`}>TANGGAL *</label>
                    <input
                      type="date"
                      value={tanggal}
                      onChange={(e) => {
                        const val = e.target.value
                        setTanggal(val)
                        if (val) {
                          const d = new Date(val)
                          const nHari = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'][d.getDay()]
                          if (nHari !== 'Jumat') setHari(nHari)
                        }
                      }}
                      className={`w-full border rounded-xl px-3 py-2 text-xs font-bold focus:outline-none focus:border-indigo-600 ${
                        isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                      }`}
                      required
                    />
                  </div>

                  <div className="sm:col-span-6 md:col-span-2">
                    <label className={`block text-[10px] font-extrabold uppercase mb-1 ${isDarkMode ? 'text-indigo-300' : 'text-indigo-950'}`}>HARI *</label>
                    <select
                      value={hari}
                      onChange={(e) => {
                        setHari(e.target.value)
                        setJamMulai('1')
                        setJamSelesai('1')
                      }}
                      className={`w-full border rounded-xl px-3 py-2 text-xs font-bold focus:outline-none focus:border-indigo-600 ${
                        isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
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

                  {/* JAM BLOK */}
                  <div className="sm:col-span-12 md:col-span-3">
                    <label className={`block text-[10px] font-extrabold uppercase mb-1 ${isDarkMode ? 'text-indigo-300' : 'text-indigo-950'}`}>JAM MENGAJAR *</label>
                    <div className="grid grid-cols-2 gap-1.5">
                      <select
                        value={jamMulai}
                        onChange={(e) => {
                          const val = e.target.value
                          setJamMulai(val)
                          if (Number(val) > Number(jamSelesai)) setJamSelesai(val)
                        }}
                        className={`w-full border rounded-xl px-2 py-2 text-xs font-bold focus:outline-none focus:border-indigo-600 ${
                          isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                        }`}
                      >
                        {jamOptionsForHari.length > 0 ? (
                          jamOptionsForHari.map((j) => (
                            <option key={j.id} value={j.jam_ke}>Jam Ke-{j.jam_ke}</option>
                          ))
                        ) : (
                          [1, 2, 3, 4, 5, 6, 7, 8].map((num) => (
                            <option key={num} value={num}>Jam Ke-{num}</option>
                          ))
                        )}
                      </select>

                      <select
                        value={jamSelesai}
                        onChange={(e) => setJamSelesai(e.target.value)}
                        className={`w-full border rounded-xl px-2 py-2 text-xs font-bold focus:outline-none focus:border-indigo-600 ${
                          isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                        }`}
                      >
                        {jamOptionsForHari.length > 0 ? (
                          jamOptionsForHari
                            .filter((j) => j.jam_ke >= Number(jamMulai))
                            .map((j) => (
                              <option key={j.id} value={j.jam_ke}>s/d Ke-{j.jam_ke}</option>
                            ))
                        ) : (
                          [1, 2, 3, 4, 5, 6, 7, 8]
                            .filter((num) => num >= Number(jamMulai))
                            .map((num) => (
                              <option key={num} value={num}>s/d Ke-{num}</option>
                            ))
                        )}
                      </select>
                    </div>
                  </div>

                  <div className="sm:col-span-6 md:col-span-2">
                    <label className={`block text-[10px] font-extrabold uppercase mb-1 ${isDarkMode ? 'text-indigo-300' : 'text-indigo-950'}`}>KELAS DIAJAR *</label>
                    <select
                      value={selectedKelasId}
                      onChange={(e) => setSelectedKelasId(e.target.value)}
                      className={`w-full border rounded-xl px-3 py-2 text-xs font-bold focus:outline-none focus:border-indigo-600 ${
                        isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                      }`}
                      required
                    >
                      <option value="">-- Pilih Kelas --</option>
                      {kelasList.map((k) => (
                        <option key={k.id} value={k.id}>{k.nama}</option>
                      ))}
                    </select>
                  </div>

                  <div className="sm:col-span-6 md:col-span-3">
                    <label className={`block text-[10px] font-extrabold uppercase mb-1 ${isDarkMode ? 'text-indigo-300' : 'text-indigo-950'}`}>MAPEL DIAJAR *</label>
                    <select
                      value={selectedMapelId}
                      onChange={(e) => setSelectedMapelId(e.target.value)}
                      className={`w-full border rounded-xl px-3 py-2 text-xs font-bold focus:outline-none focus:border-indigo-600 ${
                        isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                      }`}
                      required
                    >
                      <option value="">-- Pilih Mapel --</option>
                      {mapelList.map((m) => (
                        <option key={m.id} value={m.id}>{m.nama}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                  <div className="sm:col-span-12 md:col-span-5">
                    <label className={`block text-[10px] font-extrabold uppercase mb-1 ${isDarkMode ? 'text-indigo-300' : 'text-indigo-950'}`}>MATERI PEMBELAJARAN *</label>
                    <input
                      type="text"
                      value={materi}
                      onChange={(e) => setMateri(e.target.value)}
                      placeholder="Detail materi atau modul yang diajarkan..."
                      className={`w-full border rounded-xl px-3 py-2 text-xs font-bold focus:outline-none focus:border-indigo-600 ${
                        isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                      }`}
                      required
                    />
                  </div>

                  <div className="sm:col-span-6 md:col-span-3">
                    <label className={`block text-[10px] font-extrabold uppercase mb-1 ${isDarkMode ? 'text-indigo-300' : 'text-indigo-950'}`}>STATUS</label>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value as 'Terlaksana' | 'Tertunda')}
                      className={`w-full border rounded-xl px-3 py-2 text-xs font-bold focus:outline-none focus:border-indigo-600 ${
                        isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                      }`}
                    >
                      <option value="Terlaksana">Terlaksana</option>
                      <option value="Tertunda">Tertunda</option>
                    </select>
                  </div>

                  <div className="sm:col-span-6 md:col-span-2">
                    <label className={`block text-[10px] font-extrabold uppercase mb-1 ${isDarkMode ? 'text-indigo-300' : 'text-indigo-950'}`}>ABSEN SISWA</label>
                    <input
                      type="text"
                      value={absenSiswa}
                      onChange={(e) => setAbsenSiswa(e.target.value)}
                      placeholder="Nihil"
                      className={`w-full border rounded-xl px-3 py-2 text-xs font-bold focus:outline-none focus:border-indigo-600 ${
                        isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                      }`}
                    />
                  </div>

                  <div className="sm:col-span-12 md:col-span-2">
                    <button
                      type="submit"
                      disabled={saving}
                      className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold py-2.5 rounded-xl text-xs transition shadow-xs cursor-pointer"
                    >
                      + Simpan Jurnal
                    </button>
                  </div>
                </div>
              </form>

              {/* LIST KARTU & TABEL DATA JURNAL */}
              <div className={`backdrop-blur-md border rounded-2xl p-4 shadow-xs ${
                isDarkMode 
                  ? 'bg-slate-900/90 border-slate-800' 
                  : 'bg-gradient-to-br from-indigo-100/90 via-slate-100/90 to-indigo-50/90 border-indigo-200/80'
              }`}>
                
                {/* 1. TAMPILAN MOBILE: KARTU AGENDA (md:hidden) */}
                <div className="block md:hidden space-y-3">
                  {loading ? (
                    <div className={`p-6 text-center text-xs font-medium ${isDarkMode ? 'text-slate-500' : 'text-slate-600'}`}>
                      Memuat data agenda...
                    </div>
                  ) : jurnalList.length === 0 ? (
                    <div className={`p-6 text-center text-xs font-medium ${isDarkMode ? 'text-slate-500' : 'text-slate-600'}`}>
                      Belum ada jurnal agenda tersimpan.
                    </div>
                  ) : (
                    jurnalList.map((item, index) => (
                      <div
                        key={item.id || index}
                        className={`p-3.5 rounded-xl border transition shadow-xs flex flex-col gap-2 ${
                          isDarkMode ? 'bg-slate-800/90 border-slate-700' : 'bg-white border-indigo-200/90'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className={`font-mono text-xs font-bold ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                            📅 {item.tanggal}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase border ${
                              item.status === 'Terlaksana'
                                ? isDarkMode ? 'bg-emerald-950 text-emerald-300 border-emerald-800' : 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                : isDarkMode ? 'bg-rose-950 text-rose-300 border-rose-800' : 'bg-rose-100 text-rose-800 border-rose-300'
                            }`}
                          >
                            {item.status}
                          </span>
                        </div>

                        <div className="flex flex-col gap-1 border-t border-b py-2 my-0.5 border-slate-700/40">
                          <div className="flex items-center justify-between text-xs">
                            <span className={`font-extrabold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                              🏫 {item.kelas} - {item.mapel}
                            </span>
                            <span className="font-bold text-indigo-400">{item.jam_ke}</span>
                          </div>
                          <p className={`text-xs font-bold mt-1 ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>
                            📖 {item.materi}
                          </p>
                          <p className={`text-[11px] font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                            👥 Absen Siswa: {item.absen_siswa}
                          </p>
                        </div>

                        <div className="flex justify-end pt-0.5">
                          <button
                            onClick={() => handleDeleteJurnal(item.id)}
                            className="px-3 py-1.5 bg-rose-50 border border-rose-200 text-rose-600 text-xs font-bold rounded-lg flex items-center gap-1 cursor-pointer hover:bg-rose-100"
                          >
                            🗑️ Hapus Jurnal
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* 2. TAMPILAN DESKTOP: TABEL HTML (hidden md:block) */}
                <div className={`hidden md:block overflow-x-auto rounded-xl border ${isDarkMode ? 'bg-slate-900/90 border-slate-800' : 'bg-white/90 border-indigo-200/80'}`}>
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className={`sticky top-0 z-10 shadow-xs ${isDarkMode ? 'bg-slate-800' : 'bg-indigo-100'}`}>
                      <tr className={`border-b font-extrabold uppercase text-[11px] ${isDarkMode ? 'text-indigo-300 border-slate-700' : 'text-indigo-950 border-indigo-200'}`}>
                        <th className="py-2.5 px-3">TANGGAL</th>
                        <th className="py-2.5 px-3">JAM MENGAJAR</th>
                        <th className="py-2.5 px-3">KELAS &amp; MAPEL</th>
                        <th className="py-2.5 px-3">MATERI PEMBELAJARAN</th>
                        <th className="py-2.5 px-3 text-center">STATUS</th>
                        <th className="py-2.5 px-3 text-center">ABSEN</th>
                        <th className="py-2.5 px-3 text-center w-20 print:hidden">AKSI</th>
                      </tr>
                    </thead>
                    <tbody className={`divide-y ${isDarkMode ? 'divide-slate-800 text-slate-200' : 'divide-slate-200 text-slate-800'}`}>
                      {loading ? (
                        <tr>
                          <td colSpan={7} className={`py-10 text-center font-medium ${isDarkMode ? 'text-slate-500' : 'text-slate-600'}`}>Memuat data agenda...</td>
                        </tr>
                      ) : jurnalList.length === 0 ? (
                        <tr>
                          <td colSpan={7} className={`py-10 text-center font-medium ${isDarkMode ? 'text-slate-500' : 'text-slate-600'}`}>Belum ada jurnal agenda tersimpan.</td>
                        </tr>
                      ) : (
                        jurnalList.map((item, index) => (
                          <tr key={item.id || index} className={`transition ${isDarkMode ? 'hover:bg-slate-800/60' : 'hover:bg-indigo-50/60'}`}>
                            <td className={`py-2 px-3 font-mono font-bold ${isDarkMode ? 'text-slate-400' : 'text-slate-700'}`}>{item.tanggal}</td>
                            <td className="py-2 px-3 font-bold text-indigo-400">{item.jam_ke}</td>
                            <td className="py-2 px-3">
                              <span className={`font-extrabold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{item.kelas}</span>
                              <span className={`block text-[10px] font-bold ${isDarkMode ? 'text-emerald-400' : 'text-emerald-800'}`}>{item.mapel}</span>
                            </td>
                            <td className={`py-2 px-3 font-bold ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>{item.materi}</td>
                            <td className="py-2 px-3 text-center">
                              <span
                                className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase border ${
                                  item.status === 'Terlaksana'
                                    ? isDarkMode ? 'bg-emerald-950 text-emerald-300 border-emerald-800' : 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                    : isDarkMode ? 'bg-rose-950 text-rose-300 border-rose-800' : 'bg-rose-100 text-rose-800 border-rose-300'
                                }`}
                              >
                                {item.status}
                              </span>
                            </td>
                            <td className={`py-2 px-3 text-center font-bold ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>{item.absen_siswa}</td>
                            <td className="py-2 px-3 text-center print:hidden">
                              <button
                                onClick={() => handleDeleteJurnal(item.id)}
                                className="bg-rose-50 text-rose-600 hover:bg-rose-100 p-1.5 rounded-lg border border-rose-200 transition cursor-pointer"
                                title="Hapus Jurnal"
                              >
                                🗑️
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}

          {/* TAB 2: REKAPITULASI */}
          {activeTab === 'rekap' && (
            <div className="flex flex-col space-y-4">
              
              {/* STAT CARDS */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 shrink-0 max-w-md">
                <div className={`backdrop-blur-md border rounded-xl p-3 shadow-xs ${
                  isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white/90 border-slate-300'
                }`}>
                  <p className={`text-[10px] font-extrabold uppercase ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>TOTAL JURNAL</p>
                  <p className={`text-lg font-black mt-0.5 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{totalJurnal}</p>
                </div>
                <div className={`backdrop-blur-md border rounded-xl p-3 shadow-xs ${
                  isDarkMode ? 'bg-emerald-950/40 border-emerald-800' : 'bg-white/90 border-emerald-200'
                }`}>
                  <p className={`text-[10px] font-extrabold uppercase ${isDarkMode ? 'text-emerald-400' : 'text-emerald-700'}`}>TERLAKSANA</p>
                  <p className={`text-lg font-black mt-0.5 ${isDarkMode ? 'text-emerald-300' : 'text-emerald-900'}`}>{totalTerlaksana}</p>
                </div>
                <div className={`backdrop-blur-md border rounded-xl p-3 shadow-xs ${
                  isDarkMode ? 'bg-rose-950/40 border-rose-800' : 'bg-white/90 border-rose-200'
                }`}>
                  <p className={`text-[10px] font-extrabold uppercase ${isDarkMode ? 'text-rose-400' : 'text-rose-700'}`}>TERTUNDA</p>
                  <p className={`text-lg font-black mt-0.5 ${isDarkMode ? 'text-rose-300' : 'text-rose-900'}`}>{totalTertunda}</p>
                </div>
              </div>

              {/* FILTER BAR REKAP */}
              <div className={`grid grid-cols-1 sm:grid-cols-4 gap-3 backdrop-blur-md border p-4 rounded-2xl shrink-0 shadow-xs ${
                isDarkMode 
                  ? 'bg-slate-900/90 border-slate-800' 
                  : 'bg-gradient-to-br from-indigo-100/90 via-slate-100/90 to-indigo-50/90 border-indigo-200/80'
              }`}>
                <div>
                  <label className={`block text-[10px] font-extrabold uppercase mb-1 ${isDarkMode ? 'text-indigo-300' : 'text-indigo-950'}`}>FILTER KELAS</label>
                  <select
                    value={filterKelasId}
                    onChange={(e) => setFilterKelasId(e.target.value)}
                    className={`w-full border rounded-xl px-3 py-2 text-xs font-bold focus:outline-none ${
                      isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                    }`}
                  >
                    <option value="">Semua Kelas</option>
                    {kelasList.map((k) => (
                      <option key={k.id} value={k.id}>{k.nama}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className={`block text-[10px] font-extrabold uppercase mb-1 ${isDarkMode ? 'text-indigo-300' : 'text-indigo-950'}`}>FILTER MAPEL</label>
                  <select
                    value={filterMapelId}
                    onChange={(e) => setFilterMapelId(e.target.value)}
                    className={`w-full border rounded-xl px-3 py-2 text-xs font-bold focus:outline-none ${
                      isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                    }`}
                  >
                    <option value="">Semua Mapel</option>
                    {mapelList.map((m) => (
                      <option key={m.id} value={m.id}>{m.nama}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className={`block text-[10px] font-extrabold uppercase mb-1 ${isDarkMode ? 'text-indigo-300' : 'text-indigo-950'}`}>FILTER STATUS</label>
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className={`w-full border rounded-xl px-3 py-2 text-xs font-bold focus:outline-none ${
                      isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                    }`}
                  >
                    <option value="">Semua Status</option>
                    <option value="Terlaksana">Terlaksana</option>
                    <option value="Tertunda">Tertunda</option>
                  </select>
                </div>

                <div>
                  <label className={`block text-[10px] font-extrabold uppercase mb-1 ${isDarkMode ? 'text-indigo-300' : 'text-indigo-950'}`}>CARI MATERI</label>
                  <input
                    type="text"
                    value={searchMateri}
                    onChange={(e) => setSearchMateri(e.target.value)}
                    placeholder="Materi..."
                    className={`w-full border rounded-xl px-3 py-2 text-xs font-bold focus:outline-none ${
                      isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                    }`}
                  />
                </div>
              </div>

              {/* REKAP CARD & TABEL */}
              <div className={`backdrop-blur-md border rounded-2xl p-4 shadow-xs ${
                isDarkMode 
                  ? 'bg-slate-900/90 border-slate-800' 
                  : 'bg-gradient-to-br from-indigo-100/90 via-slate-100/90 to-indigo-50/90 border-indigo-200/80'
              }`}>
                
                {/* 1. TAMPILAN MOBILE: KARTU REKAP (md:hidden) */}
                <div className="block md:hidden space-y-3">
                  {loadingRekap ? (
                    <div className={`p-6 text-center text-xs font-medium ${isDarkMode ? 'text-slate-500' : 'text-slate-600'}`}>
                      Memuat data rekap...
                    </div>
                  ) : rekapList.length === 0 ? (
                    <div className={`p-6 text-center text-xs font-medium ${isDarkMode ? 'text-slate-500' : 'text-slate-600'}`}>
                      Tidak ada data jurnal ditemukan.
                    </div>
                  ) : (
                    rekapList.map((item, index) => (
                      <div
                        key={item.id || index}
                        className={`p-3.5 rounded-xl border transition shadow-xs flex flex-col gap-2 ${
                          isDarkMode ? 'bg-slate-800/90 border-slate-700' : 'bg-white border-indigo-200/90'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className={`font-mono text-xs font-bold ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                            #{index + 1} - 📅 {item.tanggal}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase border ${
                              item.status === 'Terlaksana'
                                ? isDarkMode ? 'bg-emerald-950 text-emerald-300 border-emerald-800' : 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                : isDarkMode ? 'bg-rose-950 text-rose-300 border-rose-800' : 'bg-rose-100 text-rose-800 border-rose-300'
                            }`}
                          >
                            {item.status}
                          </span>
                        </div>

                        <div className="flex flex-col gap-1 border-t border-b py-2 my-0.5 border-slate-700/40">
                          <div className="flex items-center justify-between text-xs">
                            <span className={`font-extrabold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                              🏫 {item.kelas} - {item.mapel}
                            </span>
                            <span className="font-bold text-indigo-400">{item.jam_ke}</span>
                          </div>
                          <p className={`text-xs font-bold mt-1 ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>
                            📖 {item.materi}
                          </p>
                          <p className={`text-[11px] font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                            👥 Absen Siswa: {item.absen_siswa}
                          </p>
                        </div>

                        <div className="flex justify-end pt-0.5">
                          <button
                            onClick={() => handleDeleteJurnal(item.id)}
                            className="px-3 py-1.5 bg-rose-50 border border-rose-200 text-rose-600 text-xs font-bold rounded-lg flex items-center gap-1 cursor-pointer hover:bg-rose-100"
                          >
                            🗑️ Hapus Jurnal
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* 2. TAMPILAN DESKTOP: TABEL REKAP (hidden md:block) */}
                <div className={`hidden md:block overflow-x-auto rounded-xl border ${isDarkMode ? 'bg-slate-900/90 border-slate-800' : 'bg-white/90 border-indigo-200/80'}`}>
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className={`sticky top-0 z-10 shadow-xs ${isDarkMode ? 'bg-slate-800' : 'bg-indigo-100'}`}>
                      <tr className={`border-b font-extrabold uppercase text-[11px] ${isDarkMode ? 'text-indigo-300 border-slate-700' : 'text-indigo-950 border-indigo-200'}`}>
                        <th className="py-2.5 px-3 w-12 text-center">NO</th>
                        <th className="py-2.5 px-3">TANGGAL</th>
                        <th className="py-2.5 px-3">JAM MENGAJAR</th>
                        <th className="py-2.5 px-3">KELAS &amp; MAPEL</th>
                        <th className="py-2.5 px-3">MATERI PEMBELAJARAN</th>
                        <th className="py-2.5 px-3 text-center">STATUS</th>
                        <th className="py-2.5 px-3 text-center">ABSEN</th>
                        <th className="py-2.5 px-3 text-center w-20">AKSI</th>
                      </tr>
                    </thead>
                    <tbody className={`divide-y ${isDarkMode ? 'divide-slate-800 text-slate-200' : 'divide-slate-200 text-slate-800'}`}>
                      {loadingRekap ? (
                        <tr>
                          <td colSpan={8} className={`py-10 text-center font-medium ${isDarkMode ? 'text-slate-500' : 'text-slate-600'}`}>Memuat data rekap...</td>
                        </tr>
                      ) : rekapList.length === 0 ? (
                        <tr>
                          <td colSpan={8} className={`py-10 text-center font-medium ${isDarkMode ? 'text-slate-500' : 'text-slate-600'}`}>Tidak ada data jurnal ditemukan.</td>
                        </tr>
                      ) : (
                        rekapList.map((item, index) => (
                          <tr key={item.id || index} className={`transition ${isDarkMode ? 'hover:bg-slate-800/60' : 'hover:bg-indigo-50/60'}`}>
                            <td className={`py-2 px-3 text-center font-bold ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{index + 1}</td>
                            <td className={`py-2 px-3 font-mono font-bold ${isDarkMode ? 'text-slate-400' : 'text-slate-700'}`}>{item.tanggal}</td>
                            <td className="py-2 px-3 font-bold text-indigo-400">{item.jam_ke}</td>
                            <td className="py-2 px-3">
                              <span className={`font-extrabold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{item.kelas}</span>
                              <span className={`block text-[10px] font-bold ${isDarkMode ? 'text-emerald-400' : 'text-emerald-800'}`}>{item.mapel}</span>
                            </td>
                            <td className={`py-2 px-3 font-bold ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>{item.materi}</td>
                            <td className="py-2 px-3 text-center">
                              <span
                                className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase border ${
                                  item.status === 'Terlaksana'
                                    ? isDarkMode ? 'bg-emerald-950 text-emerald-300 border-emerald-800' : 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                    : isDarkMode ? 'bg-rose-950 text-rose-300 border-rose-800' : 'bg-rose-100 text-rose-800 border-rose-300'
                                }`}
                              >
                                {item.status}
                              </span>
                            </td>
                            <td className={`py-2 px-3 text-center font-bold ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>{item.absen_siswa}</td>
                            <td className="py-2 px-3 text-center">
                              <button
                                onClick={() => handleDeleteJurnal(item.id)}
                                className="bg-rose-50 text-rose-600 hover:bg-rose-100 p-1.5 rounded-lg border border-rose-200 transition cursor-pointer"
                                title="Hapus Jurnal"
                              >
                                🗑️
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}

        </main>

        {/* FOOTER BADGE */}
        <div className="pb-20 sm:pb-16 pt-2 flex justify-center shrink-0 print:hidden">
          <div className={`border px-4 py-0.5 rounded-full text-center text-[10px] font-medium shadow-xs transition-colors duration-300 ${
            isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-400' : 'bg-slate-100/90 border-slate-300 text-slate-700'
          }`}>
            <span>Aplikasi Guru AI</span>
            <span className="mx-2">•</span>
            <span>Created by <strong className="text-emerald-500 font-bold">MUZAINI AL KAHFI</strong></span>
          </div>
        </div>

      </div>

      {/* BOTTOM NAVIGATION DOCK */}
      <div className={`border-t fixed bottom-0 left-0 right-0 z-50 shadow-lg shrink-0 print:hidden transition-colors duration-300 ${
        isDarkMode ? 'bg-slate-900/95 border-slate-800 backdrop-blur-md' : 'bg-slate-100/95 border-slate-300 backdrop-blur-md'
      }`}>
        <div className="max-w-xl mx-auto px-4 py-2 flex items-center justify-between">
          <Link href="/" className={`flex flex-col items-center gap-0.5 text-[11px] font-semibold transition ${
            isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-950'
          }`}>
            <span className="text-base">🕒</span>
            <span>Dashboard</span>
          </Link>

          {isOperator && (
            <Link href="/siswa" className={`flex flex-col items-center gap-0.5 text-[11px] font-semibold transition ${
              isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-950'
            }`}>
              <span className="text-base">👥</span>
              <span>Siswa</span>
            </Link>
          )}

          {isOperator && (
            <Link href="/guru" className={`flex flex-col items-center gap-0.5 text-[11px] font-semibold transition ${
              isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-950'
            }`}>
              <span className="text-base">👨‍🏫</span>
              <span>Guru</span>
            </Link>
          )}

          <Link href="/jurnal" className="flex flex-col items-center gap-0.5 text-[11px] font-bold text-indigo-500 transition">
            <span className="text-base">🎓</span>
            <span>Akademik</span>
          </Link>

          <Link href="/laporan" className={`flex flex-col items-center gap-0.5 text-[11px] font-semibold transition ${
            isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-950'
          }`}>
            <span className="text-base">🖨️</span>
            <span>Laporan</span>
          </Link>
        </div>
      </div>

    </motion.div>
  )
}