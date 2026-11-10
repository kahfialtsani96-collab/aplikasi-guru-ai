'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { motion } from 'framer-motion'
import { useAuthRole } from '@/hooks/useAuthRole'

// Helper instansiasi Supabase aman untuk SSG Vercel
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
  kelas_id?: number | null
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
  const [todayStr, setTodayStr] = useState('')
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
  const [loadingAutoAbsen, setLoadingAutoAbsen] = useState(false)

  // State Rekapitulasi Agenda
  const [rekapList, setRekapList] = useState<JurnalRecord[]>([])
  const [filterKelasId, setFilterKelasId] = useState('')
  const [filterMapelId, setFilterMapelId] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterTanggal, setFilterTanggal] = useState('')
  const [searchMateri, setSearchMateri] = useState('')
  const [loadingRekap, setLoadingRekap] = useState(false)

  useEffect(() => {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    const currentDateStr = `${year}-${month}-${day}`
    
    setTodayStr(currentDateStr)
    setTanggal(currentDateStr)
    setFilterTanggal(currentDateStr)

    const namaHari = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'][now.getDay()]
    if (namaHari !== 'Jumat') {
      setHari(namaHari)
    }

    async function initUser() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const email = user.email || ''
        setUserEmail(email)
        const nameFromMeta = user.user_metadata?.full_name || email.split('@')[0] || 'GURU'
        setUserDisplayName(nameFromMeta.toUpperCase())
        
        fetchJadwalGuru(email)
        fetchMasterJam()
        fetchJurnal(email, currentDateStr)
      }
    }

    initUser()
  }, [])

  async function fetchMasterJam() {
    const { data } = await supabase.from('master_jam').select('*').order('jam_ke', { ascending: true })
    if (data) setMasterJamList(data)
  }

  async function fetchJadwalGuru(email: string) {
    try {
      if (isOperator) {
        const { data: dataKelas } = await supabase.from('kelas').select('id, nama_kelas').order('nama_kelas', { ascending: true })
        const { data: dataMapel } = await supabase.from('mapel').select('id, nama_mapel').order('nama_mapel', { ascending: true })

        if (dataKelas) setKelasList(dataKelas.map((k: any) => ({ id: k.id, nama: k.nama_kelas })))
        if (dataMapel) setMapelList(dataMapel.map((m: any) => ({ id: m.id, nama: m.nama_mapel })))
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

  // AUTO-FETCH ABSENSI SISWA
  const fetchAbsensiOtomatis = async (targetDate: string, targetKelasId: string, targetMapelId: string) => {
    if (!targetDate) return

    const selectedMapelObj = mapelList.find((m) => m.id === Number(targetMapelId))
    const namaMapelLower = selectedMapelObj?.nama?.toLowerCase() || ''
    const isEkskulGabungan = targetKelasId === 'GABUNGAN' || namaMapelLower.includes('pramuka') || namaMapelLower.includes('qiro')

    if (!isEkskulGabungan && !targetKelasId) return

    setLoadingAutoAbsen(true)
    try {
      let query = supabase
        .from('absensi')
        .select('nama_siswa, status, kelas, nisn')
        .eq('tanggal', targetDate)

      if (isEkskulGabungan) {
        if (targetMapelId) query = query.eq('mapel_id', Number(targetMapelId))
      } else {
        query = query.eq('kelas_id', Number(targetKelasId))
        if (targetMapelId) query = query.eq('mapel_id', Number(targetMapelId))
      }

      const { data: absensiData, error } = await query
      if (error) throw error

      if (!absensiData || absensiData.length === 0) {
        setAbsenSiswa('Nihil')
      } else {
        const tidakHadirList = absensiData.filter((a) => a.status && a.status.toUpperCase() !== 'HADIR')

        if (tidakHadirList.length === 0) {
          setAbsenSiswa('Nihil')
        } else {
          const dikelompokkan: Record<string, string[]> = {}
          tidakHadirList.forEach((item) => {
            const st = item.status.toUpperCase()
            const namaFormatted = isEkskulGabungan && item.kelas 
              ? `${item.nama_siswa || 'Siswa'} (${item.kelas})`
              : item.nama_siswa || 'Siswa'

            if (!dikelompokkan[st]) dikelompokkan[st] = []
            dikelompokkan[st].push(namaFormatted)
          })

          const resultString = Object.entries(dikelompokkan)
            .map(([stKey, names]) => `${stKey}: ${names.join(', ')}`)
            .join(' | ')

          setAbsenSiswa(resultString)
        }
      }
    } catch (err) {
      console.error('Gagal mengambil data absensi otomatis:', err)
    } finally {
      setLoadingAutoAbsen(false)
    }
  }

  useEffect(() => {
    if (tanggal && (selectedKelasId || selectedMapelId)) {
      fetchAbsensiOtomatis(tanggal, selectedKelasId, selectedMapelId)
    }
  }, [tanggal, selectedKelasId, selectedMapelId])

  const handleMapelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value
    setSelectedMapelId(val)
    const mapelObj = mapelList.find((m) => m.id === Number(val))
    const namaLower = mapelObj?.nama?.toLowerCase() || ''
    if (namaLower.includes('pramuka') || namaLower.includes('qiro')) {
      setSelectedKelasId('GABUNGAN')
    }
  }

  async function fetchJurnal(emailParam?: string | null, dateParam?: string) {
    const activeEmail = emailParam || userEmail
    const targetDate = dateParam || todayStr
    if (!activeEmail) return

    setLoading(true)
    try {
      let query = supabase
        .from('jurnal_agenda')
        .select('*')
        .eq('guru_email', activeEmail)
        .order('created_at', { ascending: false })

      if (targetDate) query = query.eq('tanggal', targetDate)

      const { data, error } = await query
      if (!error && data) {
        setJurnalList(data as any)
      } else {
        setJurnalList([])
      }
    } catch (err) {
      console.error('Error fetching jurnal:', err)
    } finally {
      setLoading(false)
    }
  }

  const fetchRekap = async () => {
    if (!userEmail) return
    setLoadingRekap(true)
    try {
      let query = supabase
        .from('jurnal_agenda')
        .select('*')
        .order('created_at', { ascending: false })

      if (!isOperator) query = query.eq('guru_email', userEmail)

      if (filterKelasId) {
        if (filterKelasId === 'GABUNGAN') {
          query = query.eq('kelas', 'Gabungan (Semua Kelas)')
        } else {
          query = query.eq('kelas_id', Number(filterKelasId))
        }
      }
      if (filterMapelId) query = query.eq('mapel_id', Number(filterMapelId))
      if (filterStatus) query = query.eq('status', filterStatus)
      if (filterTanggal) query = query.eq('tanggal', filterTanggal)
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
    if (activeTab === 'rekap' && userEmail) fetchRekap()
  }, [activeTab, filterKelasId, filterMapelId, filterStatus, filterTanggal, searchMateri, userEmail, isOperator])

  useEffect(() => {
    if (userEmail) fetchJadwalGuru(userEmail)
  }, [isOperator, userEmail])
  
  const jamOptionsForHari = masterJamList.filter((j) => j.hari === hari)

  const handleSimpanJurnal = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedKelasId || !selectedMapelId || !materi.trim() || !tanggal) {
      alert('Silakan lengkapi Tanggal, Kelas, Mapel, dan Materi!')
      return
    }

    if (!isOperator && tanggal < todayStr) {
      alert('Anda tidak dapat mengisi jurnal agenda untuk tanggal yang terlewat!')
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

      const namaKelasSimpan = selectedKelasId === 'GABUNGAN' 
        ? 'Gabungan (Semua Kelas)' 
        : selectedKelasObj?.nama || ''

      const { error } = await supabase.from('jurnal_agenda').insert([
        {
          tanggal,
          jam_ke: jamFormattedText,
          kelas_id: selectedKelasId === 'GABUNGAN' ? null : Number(selectedKelasId),
          mapel_id: Number(selectedMapelId),
          kelas: namaKelasSimpan,
          mapel: selectedMapelObj?.nama || '',
          materi: materi.trim(),
          status,
          absen_siswa: absenSiswa.trim() || 'Nihil',
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
        fetchJurnal(userEmail, todayStr)
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
          <div className="flex items-center gap-2">
            <Link href="/" className={`p-1 rounded-lg transition ${isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'}`} title="Kembali">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </Link>
            <div className="flex items-center gap-1.5">
              <img src="/logo-smp.jpg" alt="Logo" className="w-5 h-5 rounded border p-0.5 object-contain" />
              <h1 className={`font-black text-xs leading-none ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                Jurnal Agenda
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
              isDarkMode ? 'bg-slate-800 text-indigo-300 border-slate-700' : 'bg-white text-indigo-900 border-slate-300'
            }`}>
              {userDisplayName}
            </span>
            <button
              onClick={async () => {
                await supabase.auth.signOut()
                router.replace('/login')
              }}
              className={`p-1 rounded-md border transition cursor-pointer ${
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
            <Link href="/nilai" className={`px-2 py-0.5 rounded border transition flex items-center gap-1 ${
              isDarkMode ? 'bg-slate-800 text-slate-300 border-slate-700' : 'bg-white text-slate-700 border-slate-300'
            }`}>
              <span>⭐</span> Penilaian
            </Link>
            <Link href="/jurnal" className="bg-indigo-600 text-white px-2 py-0.5 rounded shadow-xs font-extrabold flex items-center gap-1">
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
              <span>📋</span> Input Agenda
            </button>
            <button
              onClick={() => setActiveTab('rekap')}
              className={`py-1 rounded-md transition flex items-center justify-center gap-1 cursor-pointer ${
                activeTab === 'rekap' 
                  ? 'bg-indigo-600 text-white shadow-xs' 
                  : isDarkMode ? 'text-slate-400' : 'text-slate-700'
              }`}
            >
              <span>📜</span> Riwayat &amp; Rekap
            </button>
          </div>

          {activeTab === 'input' && (
            <div className="flex flex-col h-full overflow-hidden space-y-2">
              
              {/* AREA 40% ATAS: FORM INPUT COMPACT (FIXED / NON-SCROLL) */}
              <form onSubmit={handleSimpanJurnal} className={`border rounded-xl p-2 shrink-0 shadow-xs space-y-1.5 ${
                isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-indigo-200'
              }`}>
                {/* ROW 1: TANGGAL & JAM MENGAJAR */}
                <div className="grid grid-cols-12 gap-1.5">
                  <div className="col-span-6">
                    <input
                      type="date"
                      value={tanggal}
                      max={!isOperator ? todayStr : undefined}
                      onChange={(e) => {
                        const val = e.target.value
                        setTanggal(val)
                        if (val) {
                          const d = new Date(val)
                          const nHari = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'][d.getDay()]
                          if (nHari !== 'Jumat') setHari(nHari)
                        }
                      }}
                      className={`w-full border rounded-lg px-2 py-1 text-xs font-bold focus:outline-none ${
                        isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                      }`}
                      required
                    />
                  </div>

                  <div className="col-span-6 flex gap-1">
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
                      {jamOptionsForHari.length > 0 ? (
                        jamOptionsForHari.map((j) => (
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
                      {jamOptionsForHari.length > 0 ? (
                        jamOptionsForHari
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

                {/* ROW 2: KELAS & MAPEL */}
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
                      <option value="GABUNGAN">⭐ Gabungan (Ekskul)</option>
                      {kelasList.map((k) => (
                        <option key={k.id} value={k.id}>{k.nama}</option>
                      ))}
                    </select>
                  </div>

                  <div className="col-span-6">
                    <select
                      value={selectedMapelId}
                      onChange={handleMapelChange}
                      className={`w-full border rounded-lg px-2 py-1 text-xs font-bold focus:outline-none ${
                        isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                      }`}
                      required
                    >
                      <option value="">-- Mapel --</option>
                      {mapelList.map((m) => (
                        <option key={m.id} value={m.id}>{m.nama}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* ROW 3: MATERI PEMBELAJARAN */}
                <div>
                  <input
                    type="text"
                    value={materi}
                    onChange={(e) => setMateri(e.target.value)}
                    placeholder="📖 Materi Pembelajaran..."
                    className={`w-full border rounded-lg px-2 py-1 text-xs font-bold focus:outline-none ${
                      isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                    required
                  />
                </div>

                {/* ROW 4: STATUS & ABSEN SISWA AUTO-FETCH */}
                <div className="grid grid-cols-12 gap-1.5 items-center">
                  <div className="col-span-5">
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value as 'Terlaksana' | 'Tertunda')}
                      className={`w-full border rounded-lg px-2 py-1 text-xs font-bold focus:outline-none ${
                        status === 'Terlaksana' 
                          ? 'bg-emerald-100 text-emerald-900 border-emerald-300' 
                          : 'bg-rose-100 text-rose-900 border-rose-300'
                      }`}
                    >
                      <option value="Terlaksana">🟢 Terlaksana</option>
                      <option value="Tertunda">🔴 Tertunda</option>
                    </select>
                  </div>

                  <div className="col-span-7 flex items-center gap-1">
                    <input
                      type="text"
                      value={absenSiswa}
                      onChange={(e) => setAbsenSiswa(e.target.value)}
                      placeholder="Absen Siswa..."
                      className={`w-full border rounded-lg px-2 py-1 text-[11px] font-bold focus:outline-none ${
                        isDarkMode ? 'bg-slate-800 border-slate-700 text-emerald-400' : 'bg-slate-50 border-slate-300 text-emerald-700'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => fetchAbsensiOtomatis(tanggal, selectedKelasId, selectedMapelId)}
                      className="px-2 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-bold shrink-0 cursor-pointer"
                      title="Refresh Absensi Supabase"
                    >
                      {loadingAutoAbsen ? '⏳' : '🔄'}
                    </button>
                  </div>
                </div>

                {/* TOMBOL SIMPAN AGENDA */}
                <button
                  type="submit"
                  disabled={saving}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-600 text-white font-black py-1.5 rounded-lg text-xs transition shadow-xs flex items-center justify-center gap-1 cursor-pointer mt-1"
                >
                  <span>💾</span>
                  <span>{saving ? 'Menyimpan...' : 'SIMPAN JURNAL AGENDA'}</span>
                </button>
              </form>

              {/* AREA 60% BAWAH: DAFTAR / RIWAYAT JURNAL HARI INI (INTERNAL SCROLL AREA) */}
              <div className={`border rounded-xl p-2 flex-1 flex flex-col overflow-hidden shadow-xs ${
                isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-indigo-200'
              }`}>
                <div className="flex items-center justify-between pb-1.5 border-b border-slate-700/30 shrink-0">
                  <h3 className={`text-[11px] font-black uppercase flex items-center gap-1 ${isDarkMode ? 'text-indigo-300' : 'text-indigo-900'}`}>
                    <span>📓</span> Agenda Hari Ini ({jurnalList.length})
                  </h3>
                  <span className="text-[10px] font-mono text-slate-400">{todayStr}</span>
                </div>

                {/* AREA SCROLL KHUSUS HANYA UNTUK RIWAYAT GURU */}
                <div className="flex-1 overflow-y-auto pr-1 pt-1.5 space-y-1.5">
                  {loading ? (
                    <div className={`py-6 text-center text-xs font-medium ${isDarkMode ? 'text-slate-500' : 'text-slate-600'}`}>
                      Memuat agenda...
                    </div>
                  ) : jurnalList.length === 0 ? (
                    <div className={`py-6 text-center text-xs font-medium ${isDarkMode ? 'text-slate-500' : 'text-slate-600'}`}>
                      Belum ada jurnal agenda tersimpan hari ini.
                    </div>
                  ) : (
                    jurnalList.map((item, index) => (
                      <div
                        key={item.id || index}
                        className={`p-2 rounded-lg border transition shadow-xs flex flex-col gap-1 ${
                          isDarkMode ? 'bg-slate-800/80 border-slate-700' : 'bg-slate-50 border-slate-200'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className={`text-[11px] font-extrabold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                            {item.kelas} • {item.mapel}
                          </span>
                          <span className="text-[10px] font-bold text-indigo-400">{item.jam_ke}</span>
                        </div>

                        <p className={`text-[11px] font-bold leading-tight ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>
                          📖 {item.materi}
                        </p>

                        <div className="flex items-center justify-between pt-1 border-t border-slate-700/20 text-[10px]">
                          <span className={`font-mono ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                            Absen: {item.absen_siswa}
                          </span>
                          
                          <div className="flex items-center gap-1.5">
                            <span className={`px-1.5 py-0.2 rounded font-black text-[9px] uppercase ${
                              item.status === 'Terlaksana'
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                : 'bg-rose-100 text-rose-800 border border-rose-300'
                            }`}>
                              {item.status}
                            </span>

                            <button
                              onClick={() => handleDeleteJurnal(item.id)}
                              className="text-rose-500 hover:text-rose-700 font-bold p-0.5 cursor-pointer"
                              title="Hapus"
                            >
                              🗑️
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

            </div>
          )}

          {/* TAB 2: RIWAYAT & REKAPITULASI (INTERNAL SCROLL AREA) */}
          {activeTab === 'rekap' && (
            <div className="flex flex-col h-full overflow-hidden space-y-2">
              
              {/* STATISTIK RINGKAS */}
              <div className="grid grid-cols-3 gap-1.5 shrink-0 text-center">
                <div className={`border rounded-lg p-1.5 shadow-xs ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-300'}`}>
                  <p className={`text-[9px] font-black uppercase ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>TOTAL</p>
                  <p className={`text-sm font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{totalJurnal}</p>
                </div>
                <div className={`border rounded-lg p-1.5 shadow-xs ${isDarkMode ? 'bg-slate-900 border-emerald-800' : 'bg-white border-emerald-200'}`}>
                  <p className={`text-[9px] font-black uppercase ${isDarkMode ? 'text-emerald-400' : 'text-emerald-700'}`}>TERLAKSANA</p>
                  <p className={`text-sm font-black ${isDarkMode ? 'text-emerald-300' : 'text-emerald-900'}`}>{totalTerlaksana}</p>
                </div>
                <div className={`border rounded-lg p-1.5 shadow-xs ${isDarkMode ? 'bg-slate-900 border-rose-800' : 'bg-white border-rose-200'}`}>
                  <p className={`text-[9px] font-black uppercase ${isDarkMode ? 'text-rose-400' : 'text-rose-700'}`}>TERTUNDA</p>
                  <p className={`text-sm font-black ${isDarkMode ? 'text-rose-300' : 'text-rose-900'}`}>{totalTertunda}</p>
                </div>
              </div>

              {/* FILTER BAR REKAP */}
              <div className={`grid grid-cols-2 gap-1 border p-1.5 rounded-lg shrink-0 shadow-xs ${
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
                  <option value="GABUNGAN">Gabungan (Ekskul)</option>
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
                  type="date"
                  value={filterTanggal}
                  onChange={(e) => setFilterTanggal(e.target.value)}
                  className={`border rounded px-1.5 py-0.5 text-xs font-bold focus:outline-none ${
                    isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                />

                <input
                  type="text"
                  value={searchMateri}
                  onChange={(e) => setSearchMateri(e.target.value)}
                  placeholder="Cari materi..."
                  className={`border rounded px-1.5 py-0.5 text-xs font-bold focus:outline-none ${
                    isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                />
              </div>

              {/* LIST REKAP (INTERNAL SCROLL) */}
              <div className={`border rounded-xl p-2 flex-1 flex flex-col overflow-hidden shadow-xs ${
                isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-indigo-200'
              }`}>
                {loadingRekap ? (
                  <div className={`py-6 text-center text-xs font-medium ${isDarkMode ? 'text-slate-500' : 'text-slate-600'}`}>
                    Memuat riwayat...
                  </div>
                ) : rekapList.length === 0 ? (
                  <div className={`py-6 text-center text-xs font-medium ${isDarkMode ? 'text-slate-500' : 'text-slate-600'}`}>
                    Tidak ada riwayat jurnal.
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
                        <div className="flex items-center justify-between text-[11px] font-bold">
                          <span className={isDarkMode ? 'text-slate-400' : 'text-slate-600'}>
                            📅 {item.tanggal} ({item.jam_ke})
                          </span>
                          <span className={`px-1.5 py-0.2 rounded font-black text-[9px] uppercase ${
                            item.status === 'Terlaksana'
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                              : 'bg-rose-100 text-rose-800 border border-rose-300'
                          }`}>
                            {item.status}
                          </span>
                        </div>

                        <div className={`text-xs font-extrabold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                          {item.kelas} - {item.mapel}
                        </div>

                        <p className={`text-[11px] font-bold ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>
                          📖 {item.materi}
                        </p>

                        <div className="flex items-center justify-between pt-1 border-t border-slate-700/20 text-[10px]">
                          <span className={`font-mono ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                            Absen: {item.absen_siswa}
                          </span>
                          <button
                            onClick={() => handleDeleteJurnal(item.id)}
                            className="text-rose-500 hover:text-rose-700 font-bold p-0.5 cursor-pointer"
                          >
                            🗑️
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

          <Link href="/jurnal" className="flex flex-col items-center gap-0.5 text-[10px] font-bold text-indigo-500 transition">
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