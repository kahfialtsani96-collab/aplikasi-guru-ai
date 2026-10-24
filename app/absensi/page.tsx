'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { motion } from 'framer-motion'
import { useAuthRole } from '@/hooks/useAuthRole'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://kvrulbdvgxfrtmznpjnm.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder'
const supabase = createClient(supabaseUrl, supabaseAnonKey)

interface Siswa {
  id: number
  nisn: string
  nama_lengkap: string
  kelas_id?: number
  kelas?: {
    nama_kelas: string
  }
}

interface OptionItem {
  id: number
  nama: string
}

interface AbsensiRecord {
  id?: number | string
  tanggal: string
  kelas: string
  mapel: string
  nama_siswa: string
  status: 'HADIR' | 'IZIN' | 'SAKIT' | 'ALPA'
  guru_email?: string
  semester?: string
  tahun_ajaran?: string
}

interface StatusAbsensiMap {
  [siswaId: string]: 'HADIR' | 'IZIN' | 'SAKIT' | 'ALPA'
}

export default function AbsensiPage() {
  const router = useRouter()
  const { isOperator, canAccessBimbingan } = useAuthRole()

  const [userDisplayName, setUserDisplayName] = useState('GURU')
  const [userEmail, setUserEmail] = useState<string | null>(null)

  // DETEKSI OTOMATIS TEMA DARK MODE DARI LOCAL STORAGE
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false)

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme')
    if (savedTheme === 'dark') {
      setIsDarkMode(true)
    }
  }, [])

  const [activeTab, setActiveTab] = useState<'input' | 'rekap'>('input')
  const [modeInput, setModeInput] = useState<'manual' | 'qr'>('manual')

  // Global Filter Periode Akademik
  const [selectedSemester, setSelectedSemester] = useState<'Ganjil' | 'Genap'>('Ganjil')
  const [selectedTahunAjaran, setSelectedTahunAjaran] = useState('2026/2027')

  const [tanggal, setTanggal] = useState('')
  const [todayStr, setTodayStr] = useState('')

  // Dynamic Options
  const [kelasList, setKelasList] = useState<OptionItem[]>([])
  const [mapelList, setMapelList] = useState<OptionItem[]>([])

  const [selectedKelasId, setSelectedKelasId] = useState('')
  const [selectedMapelId, setSelectedMapelId] = useState('')

  const [siswaList, setSiswaList] = useState<Siswa[]>([])
  const [absensiMap, setAbsensiMap] = useState<StatusAbsensiMap>({})
  const [loadingSiswa, setLoadingSiswa] = useState(false)
  const [saving, setSaving] = useState(false)

  // State Rekapitulasi
  const [rekapList, setRekapList] = useState<AbsensiRecord[]>([])
  const [filterKelasId, setFilterKelasId] = useState('')
  const [filterMapelId, setFilterMapelId] = useState('')
  const [filterTanggal, setFilterTanggal] = useState('')
  const [searchNama, setSearchNama] = useState('')
  const [loadingRekap, setLoadingRekap] = useState(false)

  // QR Scanner Ref, Anti-Spam & Feedback State
  const [scanStatus, setScanStatus] = useState<{ type: 'success' | 'warning' | 'error'; msg: string } | null>(null)
  const [isScanning, setIsScanning] = useState(false)
  const qrScannerRef = useRef<any>(null)
  const isCooldownRef = useRef<boolean>(false)

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0]
    setTodayStr(today)
    setTanggal(today)

    async function getUserData() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const email = user.email || ''
        setUserEmail(email)
        const nameFromMeta = user.user_metadata?.full_name || email.split('@')[0] || 'GURU'
        setUserDisplayName(nameFromMeta.toUpperCase())

        fetchJadwalGuru(email)
      }
    }

    getUserData()
  }, [])

  // Fetch Jadwal Guru
  async function fetchJadwalGuru(email: string) {
    try {
      if (isOperator) {
        const { data: dataKelas } = await supabase
          .from('kelas')
          .select('id, nama_kelas')
          .order('nama_kelas', { ascending: true })
        const { data: dataMapel } = await supabase
          .from('mapel')
          .select('id, nama_mapel')
          .order('nama_mapel', { ascending: true })

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

  // Load Siswa
  useEffect(() => {
    async function fetchSiswa() {
      if (!selectedKelasId) {
        setSiswaList([])
        setAbsensiMap({})
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

          if (selectedMapelId && tanggal) {
            const { data: existingAbsensi } = await supabase
              .from('absensi')
              .select('siswa_id, status')
              .eq('kelas_id', Number(selectedKelasId))
              .eq('mapel_id', Number(selectedMapelId))
              .eq('tanggal', tanggal)
              .eq('semester', selectedSemester)
              .eq('tahun_ajaran', selectedTahunAjaran)

            const initialMap: StatusAbsensiMap = {}
            if (existingAbsensi) {
              existingAbsensi.forEach((a) => {
                if (a.siswa_id) initialMap[String(a.siswa_id)] = a.status
              })
            }
            setAbsensiMap(initialMap)
          } else {
            setAbsensiMap({})
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
  }, [selectedKelasId, selectedMapelId, tanggal, selectedSemester, selectedTahunAjaran, activeTab])

  // QR Scanner Implementation
  useEffect(() => {
    let html5QrCode: any = null

    if (modeInput === 'qr' && activeTab === 'input') {
      import('html5-qrcode').then(({ Html5Qrcode }) => {
        html5QrCode = new Html5Qrcode('reader')
        qrScannerRef.current = html5QrCode

        html5QrCode.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          (decodedText: string) => {
            handleQRScanned(decodedText)
          },
          () => {}
        ).catch((err: any) => {
          console.error('Gagal membuka kamera:', err)
        })
      })
    }

    return () => {
      if (qrScannerRef.current) {
        qrScannerRef.current.stop().then(() => {
          qrScannerRef.current.clear()
        }).catch(() => {})
      }
    }
  }, [modeInput, activeTab, siswaList, absensiMap])

  // Logika Pemindaian QR
  const handleQRScanned = (scannedText: string) => {
    const textClean = scannedText.trim()

    if (isCooldownRef.current) return
    isCooldownRef.current = true

    setIsScanning(true)

    const targetSiswa = siswaList.find(
      (s) => s.nisn === textClean || String(s.id) === textClean
    )

    if (targetSiswa && targetSiswa.id) {
      const sId = String(targetSiswa.id)
      const currentStatus = absensiMap[sId]

      if (currentStatus === 'HADIR') {
        setScanStatus({
          type: 'warning',
          msg: `⚠️ ${targetSiswa.nama_lengkap} SUDAH TERDATA HADIR!`
        })
      } else {
        setAbsensiMap((prev) => ({
          ...prev,
          [sId]: 'HADIR',
        }))
        setScanStatus({
          type: 'success',
          msg: `✅ BERHASIL: ${targetSiswa.nama_lengkap} (HADIR)`
        })
      }
    } else {
      setScanStatus({
        type: 'error',
        msg: `❌ NISN/ID: "${textClean}" Tidak Ditemukan di Kelas Ini!`
      })
    }

    setTimeout(() => {
      setIsScanning(false)
    }, 300)

    setTimeout(() => {
      isCooldownRef.current = false
      setScanStatus(null)
    }, 2200)
  }

  // Fetch Rekap
  const fetchRekap = async () => {
    setLoadingRekap(true)
    try {
      let query = supabase
        .from('absensi')
        .select('*')
        .eq('semester', selectedSemester)
        .eq('tahun_ajaran', selectedTahunAjaran)
        .order('tanggal', { ascending: false })

      if (!isOperator && userEmail) {
        query = query.eq('guru_email', userEmail)
      }

      if (filterKelasId) query = query.eq('kelas_id', Number(filterKelasId))
      if (filterMapelId) query = query.eq('mapel_id', Number(filterMapelId))
      if (filterTanggal) query = query.eq('tanggal', filterTanggal)
      if (searchNama.trim()) query = query.ilike('nama_siswa', `%${searchNama.trim()}%`)

      const { data, error } = await query

      if (!error && data) {
        setRekapList(data)
      } else {
        setRekapList([])
      }
    } catch (err) {
      console.error('Error fetching rekap:', err)
    } finally {
      setLoadingRekap(false)
    }
  }

  useEffect(() => {
    if (activeTab === 'rekap') {
      fetchRekap()
    }
  }, [activeTab, filterKelasId, filterMapelId, filterTanggal, searchNama, selectedSemester, selectedTahunAjaran, userEmail, isOperator])

  useEffect(() => {
    if (userEmail) {
      fetchJadwalGuru(userEmail)
    }
  }, [isOperator, userEmail])
  
  const handleStatusChange = (siswaId: string, status: 'HADIR' | 'IZIN' | 'SAKIT' | 'ALPA' | '') => {
    setAbsensiMap((prev) => {
      const next = { ...prev }
      if (status === '') {
        delete next[siswaId]
      } else {
        next[siswaId] = status
      }
      return next
    })
  }

  // Simpan Absensi ke Supabase
  const handleSimpanAbsensi = async () => {
    if (!selectedKelasId || !selectedMapelId || !tanggal) {
      alert('Silakan pilih Tanggal, Kelas, dan Mata Pelajaran terlebih dahulu!')
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

    const processedSiswa = siswaList.filter((s) => absensiMap[String(s.id)])

    if (processedSiswa.length === 0) {
      alert('Belum ada siswa yang di-absen (QR maupun Manual).')
      return
    }

    setSaving(true)
    try {
      const selectedKelasObj = kelasList.find((k) => k.id === Number(selectedKelasId))
      const selectedMapelObj = mapelList.find((m) => m.id === Number(selectedMapelId))

      const rowsToUpsert = processedSiswa.map((siswa) => ({
        tanggal,
        kelas_id: Number(selectedKelasId),
        mapel_id: Number(selectedMapelId),
        siswa_id: siswa.id,
        kelas: selectedKelasObj?.nama || '',
        mapel: selectedMapelObj?.nama || '',
        nama_siswa: siswa.nama_lengkap,
        nisn: siswa.nisn || '',
        status: absensiMap[String(siswa.id)],
        semester: selectedSemester,
        tahun_ajaran: selectedTahunAjaran,
        guru_email: userEmail
      }))

      const { error } = await supabase
        .from('absensi')
        .upsert(rowsToUpsert, { onConflict: 'siswa_id,tanggal,mapel_id' })

      if (error) {
        alert('Gagal menyimpan absensi: ' + error.message)
      } else {
        alert(`Berhasil menyimpan presensi ${processedSiswa.length} siswa!`)
        setActiveTab('rekap')
      }
    } catch (err: any) {
      alert('Terjadi kesalahan: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  const siswaBelumAbsen = siswaList.filter((s) => !absensiMap[String(s.id)])
  const siswaSudahAbsen = siswaList.filter((s) => absensiMap[String(s.id)])

  const totalData = rekapList.length
  const totalHadir = rekapList.filter(item => item.status === 'HADIR').length
  const totalIzin = rekapList.filter(item => item.status === 'IZIN').length
  const totalSakit = rekapList.filter(item => item.status === 'SAKIT').length
  const totalAlpa = rekapList.filter(item => item.status === 'ALPA').length

  return (
    <motion.div
      initial={{ opacity: 0, x: -60 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className={`h-screen font-sans flex flex-col justify-between selection:bg-indigo-500 selection:text-white overflow-hidden relative transition-colors duration-300 ${
        isDarkMode ? 'bg-slate-950 text-slate-100' : 'bg-[#E2E8F0] text-slate-800'
      }`}
    >
      <div className={`fixed inset-0 pointer-events-none z-0 flex items-center justify-center select-none print:hidden transition-opacity duration-300 ${
        isDarkMode ? 'opacity-[0.05]' : 'opacity-[0.15]'
      }`}>
        <img src="/logo-smp.jpg" alt="Watermark" className="w-[850px] h-[850px] object-contain max-w-none" />
      </div>

      <div className="relative z-10 flex flex-col h-full overflow-hidden">
        
        {/* HEADER TOPBAR */}
        <header className={`border-b px-6 py-2.5 flex items-center justify-between shrink-0 shadow-xs print:hidden transition-colors duration-300 ${
          isDarkMode ? 'bg-slate-900/90 border-slate-800 backdrop-blur-md' : 'bg-slate-100/90 border-slate-300 backdrop-blur-md'
        }`}>
          <div className="flex items-center gap-3">
            <Link href="/" className={`p-1.5 rounded-lg transition ${isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'}`} title="Kembali ke Dashboard">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </Link>
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-xl overflow-hidden flex items-center justify-center border p-0.5 shadow-xs shrink-0 ${
                isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-300'
              }`}>
                <img src="/logo-smp.jpg" alt="Logo SMP" className="w-full h-full object-contain" />
              </div>
              <div>
                <h1 className={`font-bold text-base leading-none ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Aplikasi Guru AI</h1>
                <p className={`text-[11px] font-bold mt-0.5 ${isDarkMode ? 'text-emerald-400' : 'text-emerald-800'}`}>Input Presensi Harian Siswa</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className={`border text-xs font-bold px-3 py-1 rounded-xl flex items-center gap-2 shadow-xs ${
              isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-100' : 'bg-white border-slate-300 text-slate-800'
            }`}>
              <span className={`text-[10px] uppercase ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Periode:</span>
              <select value={selectedSemester} onChange={(e) => setSelectedSemester(e.target.value as 'Ganjil' | 'Genap')} className={`font-bold rounded px-1 py-0.5 focus:outline-none ${
                isDarkMode ? 'bg-slate-900 text-indigo-300' : 'bg-slate-100 text-indigo-900'
              }`}>
                <option value="Ganjil">Ganjil</option>
                <option value="Genap">Genap</option>
              </select>
              <select value={selectedTahunAjaran} onChange={(e) => setSelectedTahunAjaran(e.target.value)} className={`font-bold rounded px-1 py-0.5 focus:outline-none ${
                isDarkMode ? 'bg-slate-900 text-indigo-300' : 'bg-slate-100 text-indigo-900'
              }`}>
                {Array.from({ length: 10 }, (_, i) => {
                  const startYear = 2024 + i
                  const tahunOption = `${startYear}/${startYear + 1}`
                  return (
                    <option key={tahunOption} value={tahunOption}>
                      {tahunOption}
                    </option>
                  )
                })}
              </select>
            </div>

            <div className={`border text-xs font-bold px-3.5 py-1.5 rounded-xl flex items-center gap-2 shadow-xs ${
              isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-100' : 'bg-white border-slate-300 text-slate-800'
            }`}>
              <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px] font-bold">
                {userDisplayName.charAt(0)}
              </span>
              <span>{userDisplayName}</span>
              <span className={`text-[10px] px-2 py-0.5 rounded-md font-extrabold uppercase ml-1 border ${
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
        <div className={`border-b px-6 py-2 shrink-0 overflow-x-auto print:hidden transition-colors duration-300 ${
          isDarkMode ? 'bg-slate-900/80 border-slate-800 backdrop-blur-md' : 'bg-slate-200/80 border-slate-300 backdrop-blur-md'
        }`}>
          <div className="max-w-6xl mx-auto flex items-center gap-2 min-w-max text-xs font-bold">
            <span className={`font-black pr-2 border-r flex items-center gap-1 ${
              isDarkMode ? 'text-indigo-400 border-slate-700' : 'text-indigo-900 border-slate-300'
            }`}>
              🎓 Akademik:
            </span>
            <Link href="/jadwal" className={`px-3 py-1.5 rounded-xl border transition flex items-center gap-1.5 ${
              isDarkMode ? 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700' : 'bg-white/80 text-slate-700 border-slate-300 hover:bg-white'
            }`}>
              <span>🕒</span> Jadwal Mengajar
            </Link>
            <Link href="/absensi" className="bg-indigo-600 text-white px-3 py-1.5 rounded-xl shadow-xs font-extrabold flex items-center gap-1.5">
              <span>📋</span> Input Absensi
            </Link>
            <Link href="/nilai" className={`px-3 py-1.5 rounded-xl border transition flex items-center gap-1.5 ${
              isDarkMode ? 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700' : 'bg-white/80 text-slate-700 border-slate-300 hover:bg-white'
            }`}>
              <span>⭐</span> Input Penilaian
            </Link>
            <Link href="/jurnal" className={`px-3 py-1.5 rounded-xl border transition flex items-center gap-1.5 ${
              isDarkMode ? 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700' : 'bg-white/80 text-slate-700 border-slate-300 hover:bg-white'
            }`}>
              <span>📓</span> Agenda Mengajar
            </Link>
            {canAccessBimbingan && (
              <Link href="/bimbingan" className={`px-3 py-1.5 rounded-xl border transition flex items-center gap-1.5 ${
                isDarkMode ? 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700' : 'bg-white/80 text-slate-700 border-slate-300 hover:bg-white'
              }`}>
                <span>💖</span> Bimbingan Guru Wali
              </Link>
            )}
          </div>
        </div>

        {/* MAIN CONTENT AREA */}
        <main className="max-w-6xl w-full mx-auto p-4 flex-1 flex flex-col min-h-0 space-y-3">
          
          <div className="flex items-center justify-between shrink-0 print:hidden">
            <div className={`grid grid-cols-2 p-1 rounded-xl border max-w-md text-xs font-extrabold flex-1 ${
              isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-slate-200/90 border-slate-300'
            }`}>
              <button
                onClick={() => setActiveTab('input')}
                className={`py-1.5 rounded-lg transition flex items-center justify-center gap-2 cursor-pointer ${
                  activeTab === 'input' 
                    ? 'bg-indigo-600 text-white shadow-xs' 
                    : isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-700 hover:text-slate-900'
                }`}
              >
                <span>📋</span> Input Absensi Harian
              </button>
              <button
                onClick={() => setActiveTab('rekap')}
                className={`py-1.5 rounded-lg transition flex items-center justify-center gap-2 cursor-pointer ${
                  activeTab === 'rekap' 
                    ? 'bg-indigo-600 text-white shadow-xs' 
                    : isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-700 hover:text-slate-900'
                }`}
              >
                <span>📜</span> Riwayat &amp; Rekapitulasi
              </button>
            </div>
          </div>

          {activeTab === 'input' && (
            <div className="flex-1 flex flex-col min-h-0 space-y-3">
              
              <div className={`backdrop-blur-md border rounded-2xl p-3.5 shadow-xs shrink-0 print:hidden ${
                isDarkMode 
                  ? 'bg-slate-900/90 border-slate-800' 
                  : 'bg-gradient-to-br from-indigo-100/90 via-slate-100/90 to-indigo-50/90 border-indigo-200/80'
              }`}>
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
                  
                  <div className="sm:col-span-2">
                    <label className={`block text-[10px] font-extrabold uppercase mb-1 ${isDarkMode ? 'text-indigo-300' : 'text-indigo-950'}`}>TANGGAL *</label>
                    <input
                      type="date"
                      value={tanggal}
                      max={todayStr}
                      onChange={(e) => setTanggal(e.target.value)}
                      className={`w-full border rounded-xl px-2.5 py-1.5 text-xs font-bold focus:outline-none focus:border-indigo-600 ${
                        isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                      }`}
                    />
                  </div>

                  <div className="sm:col-span-3">
                    <label className={`block text-[10px] font-extrabold uppercase mb-1 ${isDarkMode ? 'text-indigo-300' : 'text-indigo-950'}`}>KELAS DIAJAR *</label>
                    <select
                      value={selectedKelasId}
                      onChange={(e) => setSelectedKelasId(e.target.value)}
                      className={`w-full border rounded-xl px-2.5 py-1.5 text-xs font-bold focus:outline-none focus:border-indigo-600 ${
                        isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                      }`}
                    >
                      <option value="">-- Pilih Kelas --</option>
                      {kelasList.map((k) => (
                        <option key={k.id} value={k.id}>{k.nama}</option>
                      ))}
                    </select>
                  </div>

                  <div className="sm:col-span-3">
                    <label className={`block text-[10px] font-extrabold uppercase mb-1 ${isDarkMode ? 'text-indigo-300' : 'text-indigo-950'}`}>MAPEL DIAJAR *</label>
                    <select
                      value={selectedMapelId}
                      onChange={(e) => setSelectedMapelId(e.target.value)}
                      className={`w-full border rounded-xl px-2.5 py-1.5 text-xs font-bold focus:outline-none focus:border-indigo-600 ${
                        isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                      }`}
                    >
                      <option value="">-- Pilih Mapel --</option>
                      {mapelList.map((m) => (
                        <option key={m.id} value={m.id}>{m.nama}</option>
                      ))}
                    </select>
                  </div>

                  <div className="sm:col-span-2">
                    <button
                      type="button"
                      onClick={() => setModeInput(modeInput === 'manual' ? 'qr' : 'manual')}
                      className="w-full bg-slate-800 hover:bg-slate-900 text-white font-extrabold py-1.5 px-2 rounded-xl text-xs transition shadow-xs flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <span>{modeInput === 'manual' ? '📷 Mode QR' : '✍️ Mode Manual'}</span>
                    </button>
                  </div>

                  <div className="sm:col-span-2">
                    <button
                      type="button"
                      onClick={handleSimpanAbsensi}
                      disabled={saving || !selectedKelasId || !selectedMapelId}
                      className="w-full bg-emerald-700 hover:bg-emerald-800 disabled:bg-slate-700 text-white font-black py-1.5 px-3 rounded-xl text-xs transition shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <span>💾</span> {saving ? 'Simpan...' : 'Simpan Presensi'}
                    </button>
                  </div>

                </div>
              </div>

              {modeInput === 'qr' && (
                <div className={`backdrop-blur-md border rounded-2xl p-4 flex flex-col items-center justify-center space-y-3 shrink-0 shadow-xs relative ${
                  isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white/90 border-indigo-200'
                }`}>
                  <h3 className={`text-xs font-extrabold uppercase flex items-center gap-2 ${isDarkMode ? 'text-indigo-300' : 'text-indigo-900'}`}>
                    <span>📷</span> Arahkan QR Code Kartu Pelajar ke Kamera
                  </h3>
                  
                  <div className="w-full max-w-xs overflow-hidden rounded-2xl border-2 border-indigo-600 shadow-md bg-black relative">
                    <div id="reader" className="w-full"></div>
                    {isScanning && (
                      <div className="absolute inset-0 bg-emerald-500/20 backdrop-blur-xs flex items-center justify-center">
                        <div className="w-8 h-8 border-3 border-white border-t-transparent rounded-full animate-spin"></div>
                      </div>
                    )}
                  </div>

                  {scanStatus && (
                    <div
                      className={`px-4 py-2 rounded-xl text-xs font-extrabold border shadow-sm transition-all animate-bounce ${
                        scanStatus.type === 'success'
                          ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                          : scanStatus.type === 'warning'
                          ? 'bg-amber-100 text-amber-900 border-amber-300'
                          : 'bg-rose-100 text-rose-900 border-rose-300'
                      }`}
                    >
                      {scanStatus.msg}
                    </div>
                  )}
                </div>
              )}

              <div className="flex-1 flex flex-col sm:flex-row gap-3 min-h-0">
                
                <div className={`backdrop-blur-md border rounded-2xl p-3 flex-1 flex flex-col min-h-0 shadow-xs ${
                  isDarkMode 
                    ? 'bg-slate-900/90 border-slate-800' 
                    : 'bg-gradient-to-br from-indigo-100/90 via-slate-100/90 to-indigo-50/90 border-indigo-200/80'
                }`}>
                  <div className="flex items-center justify-between pb-2">
                    <span className={`text-xs font-extrabold uppercase flex items-center gap-1.5 ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse"></span>
                      1. Belum Absen ({siswaBelumAbsen.length} Orang)
                    </span>
                    <span className={`text-[10px] font-bold ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Urut A–Z</span>
                  </div>

                  <div className={`flex-1 overflow-y-auto rounded-xl border ${isDarkMode ? 'bg-slate-900/90 border-slate-800' : 'bg-white/90 border-indigo-200/80'}`}>
                    <table className="w-full text-left border-collapse text-xs">
                      <thead className={`sticky top-0 z-10 shadow-xs ${isDarkMode ? 'bg-slate-800' : 'bg-indigo-100'}`}>
                        <tr className={`border-b font-extrabold uppercase text-[10px] ${isDarkMode ? 'text-indigo-300 border-slate-700' : 'text-indigo-950 border-indigo-200'}`}>
                          <th className="py-2 px-2.5 w-8 text-center">NO</th>
                          <th className="py-2 px-2.5">NAMA LENGKAP SISWA</th>
                          <th className="py-2 px-2.5 text-center w-36">INPUT MANUAL</th>
                        </tr>
                      </thead>
                      <tbody className={`divide-y ${isDarkMode ? 'divide-slate-800 text-slate-200' : 'divide-slate-200 text-slate-800'}`}>
                        {!selectedKelasId || !selectedMapelId ? (
                          <tr>
                            <td colSpan={3} className={`py-10 text-center font-medium ${isDarkMode ? 'text-slate-500' : 'text-slate-500'}`}>
                              Silakan pilih Tanggal, Kelas, dan Mapel.
                            </td>
                          </tr>
                        ) : loadingSiswa ? (
                          <tr>
                            <td colSpan={3} className={`py-10 text-center font-medium ${isDarkMode ? 'text-slate-500' : 'text-slate-500'}`}>Memuat daftar siswa...</td>
                          </tr>
                        ) : siswaBelumAbsen.length === 0 ? (
                          <tr>
                            <td colSpan={3} className="py-10 text-center text-emerald-400 font-extrabold">
                              🎉 Semua siswa sudah terabsen!
                            </td>
                          </tr>
                        ) : (
                          siswaBelumAbsen.map((siswa, index) => {
                            const sId = String(siswa.id)
                            return (
                              <tr key={sId} className={`transition ${isDarkMode ? 'hover:bg-slate-800/60' : 'hover:bg-indigo-50/60'}`}>
                                <td className={`py-1.5 px-2.5 text-center font-bold ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>{index + 1}</td>
                                <td className={`py-1.5 px-2.5 font-extrabold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                                  {siswa.nama_lengkap}
                                  <span className={`block text-[9px] font-mono font-normal ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                                    NISN: {siswa.nisn || '-'}
                                  </span>
                                </td>
                                <td className="py-1.5 px-2.5 text-center">
                                  <div className="flex items-center justify-center gap-1 text-[10px] font-bold">
                                    <button
                                      onClick={() => handleStatusChange(sId, 'HADIR')}
                                      className="px-1.5 py-0.5 rounded bg-emerald-100 hover:bg-emerald-200 text-emerald-800 border border-emerald-300"
                                    >
                                      H
                                    </button>
                                    <button
                                      onClick={() => handleStatusChange(sId, 'IZIN')}
                                      className="px-1.5 py-0.5 rounded bg-amber-100 hover:bg-amber-200 text-amber-800 border border-amber-300"
                                    >
                                      I
                                    </button>
                                    <button
                                      onClick={() => handleStatusChange(sId, 'SAKIT')}
                                      className="px-1.5 py-0.5 rounded bg-indigo-100 hover:bg-indigo-200 text-indigo-800 border border-indigo-300"
                                    >
                                      S
                                    </button>
                                    <button
                                      onClick={() => handleStatusChange(sId, 'ALPA')}
                                      className="px-1.5 py-0.5 rounded bg-rose-100 hover:bg-rose-200 text-rose-800 border border-rose-300"
                                    >
                                      A
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            )
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className={`backdrop-blur-md border rounded-2xl p-3 flex-1 flex flex-col min-h-0 shadow-xs ${
                  isDarkMode 
                    ? 'bg-slate-900/90 border-slate-800' 
                    : 'bg-gradient-to-br from-indigo-100/90 via-slate-100/90 to-indigo-50/90 border-indigo-200/80'
                }`}>
                  <div className="flex items-center justify-between pb-2">
                    <span className={`text-xs font-extrabold uppercase flex items-center gap-1.5 ${isDarkMode ? 'text-emerald-400' : 'text-emerald-900'}`}>
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-600"></span>
                      2. Sudah Terabsen ({siswaSudahAbsen.length} Orang)
                    </span>
                    <span className={`text-[10px] font-bold ${isDarkMode ? 'text-emerald-400' : 'text-emerald-800'}`}>Siap Disimpan</span>
                  </div>

                  <div className={`flex-1 overflow-y-auto rounded-xl border ${isDarkMode ? 'bg-slate-900/90 border-slate-800' : 'bg-white/90 border-indigo-200/80'}`}>
                    <table className="w-full text-left border-collapse text-xs">
                      <thead className={`sticky top-0 z-10 shadow-xs ${isDarkMode ? 'bg-slate-800' : 'bg-indigo-100'}`}>
                        <tr className={`border-b font-extrabold uppercase text-[10px] ${isDarkMode ? 'text-indigo-300 border-slate-700' : 'text-indigo-950 border-indigo-200'}`}>
                          <th className="py-2 px-2.5 w-8 text-center">NO</th>
                          <th className="py-2 px-2.5">NAMA LENGKAP SISWA</th>
                          <th className="py-2 px-2.5 text-center w-24">STATUS</th>
                          <th className="py-2 px-2.5 text-center w-10">BATAL</th>
                        </tr>
                      </thead>
                      <tbody className={`divide-y ${isDarkMode ? 'divide-slate-800 text-slate-200' : 'divide-slate-200 text-slate-800'}`}>
                        {siswaSudahAbsen.length === 0 ? (
                          <tr>
                            <td colSpan={4} className={`py-10 text-center font-medium ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                              Belum ada siswa yang di-scan QR atau diisi manual.
                            </td>
                          </tr>
                        ) : (
                          siswaSudahAbsen.map((siswa, index) => {
                            const sId = String(siswa.id)
                            const st = absensiMap[sId]
                            return (
                              <tr key={sId} className={`transition ${isDarkMode ? 'hover:bg-slate-800/60' : 'hover:bg-indigo-50/60'}`}>
                                <td className={`py-1.5 px-2.5 text-center font-bold ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>{index + 1}</td>
                                <td className={`py-1.5 px-2.5 font-extrabold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                                  {siswa.nama_lengkap}
                                </td>
                                <td className="py-1.5 px-2.5 text-center">
                                  <span
                                    className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                                      st === 'HADIR'
                                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                        : st === 'IZIN'
                                        ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                        : st === 'SAKIT'
                                        ? 'bg-indigo-100 text-indigo-800 border border-indigo-300'
                                        : 'bg-rose-100 text-rose-800 border border-rose-300'
                                    }`}
                                  >
                                    {st}
                                  </span>
                                </td>
                                <td className="py-1.5 px-2.5 text-center">
                                  <button
                                    onClick={() => handleStatusChange(sId, '')}
                                    className="text-rose-500 hover:text-rose-700 font-bold p-0.5"
                                    title="Batalkan & Kembalikan ke Belum Absen"
                                  >
                                    ✕
                                  </button>
                                </td>
                              </tr>
                            )
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>

            </div>
          )}

          {activeTab === 'rekap' && (
            <div className="flex-1 flex flex-col min-h-0 space-y-3">
              
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 shrink-0">
                <div className={`border rounded-xl p-2.5 shadow-xs ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white/90 border-slate-300'}`}>
                  <p className={`text-[10px] font-extrabold uppercase ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>TOTAL DATA</p>
                  <p className={`text-lg font-black mt-0.5 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{totalData}</p>
                </div>
                <div className={`border rounded-xl p-2.5 shadow-xs ${isDarkMode ? 'bg-slate-900 border-emerald-800/60' : 'bg-white/90 border-emerald-200'}`}>
                  <p className={`text-[10px] font-extrabold uppercase ${isDarkMode ? 'text-emerald-400' : 'text-emerald-700'}`}>HADIR</p>
                  <p className={`text-lg font-black mt-0.5 ${isDarkMode ? 'text-emerald-300' : 'text-emerald-900'}`}>{totalHadir}</p>
                </div>
                <div className={`border rounded-xl p-2.5 shadow-xs ${isDarkMode ? 'bg-slate-900 border-amber-800/60' : 'bg-white/90 border-amber-200'}`}>
                  <p className={`text-[10px] font-extrabold uppercase ${isDarkMode ? 'text-amber-400' : 'text-amber-700'}`}>IZIN</p>
                  <p className={`text-lg font-black mt-0.5 ${isDarkMode ? 'text-amber-300' : 'text-amber-900'}`}>{totalIzin}</p>
                </div>
                <div className={`border rounded-xl p-2.5 shadow-xs ${isDarkMode ? 'bg-slate-900 border-indigo-800/60' : 'bg-white/90 border-indigo-200'}`}>
                  <p className={`text-[10px] font-extrabold uppercase ${isDarkMode ? 'text-indigo-400' : 'text-indigo-700'}`}>SAKIT</p>
                  <p className={`text-lg font-black mt-0.5 ${isDarkMode ? 'text-indigo-300' : 'text-indigo-900'}`}>{totalSakit}</p>
                </div>
                <div className={`border rounded-xl p-2.5 shadow-xs ${isDarkMode ? 'bg-slate-900 border-rose-800/60' : 'bg-white/90 border-rose-200'}`}>
                  <p className={`text-[10px] font-extrabold uppercase ${isDarkMode ? 'text-rose-400' : 'text-rose-700'}`}>ALPA</p>
                  <p className={`text-lg font-black mt-0.5 ${isDarkMode ? 'text-rose-300' : 'text-rose-900'}`}>{totalAlpa}</p>
                </div>
              </div>

              <div className={`grid grid-cols-1 sm:grid-cols-4 gap-2.5 border p-3 rounded-2xl shrink-0 shadow-xs ${
                isDarkMode ? 'bg-slate-900/90 border-slate-800' : 'bg-gradient-to-br from-indigo-100/90 via-slate-100/90 to-indigo-50/90 border-indigo-200/80'
              }`}>
                <div>
                  <label className={`block text-[10px] font-extrabold uppercase mb-1 ${isDarkMode ? 'text-indigo-300' : 'text-indigo-950'}`}>FILTER KELAS</label>
                  <select
                    value={filterKelasId}
                    onChange={(e) => setFilterKelasId(e.target.value)}
                    className={`w-full border rounded-xl px-2.5 py-1 text-xs font-bold focus:outline-none ${
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
                    className={`w-full border rounded-xl px-2.5 py-1 text-xs font-bold focus:outline-none ${
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
                  <label className={`block text-[10px] font-extrabold uppercase mb-1 ${isDarkMode ? 'text-indigo-300' : 'text-indigo-950'}`}>FILTER TANGGAL</label>
                  <input
                    type="date"
                    value={filterTanggal}
                    onChange={(e) => setFilterTanggal(e.target.value)}
                    className={`w-full border rounded-xl px-2.5 py-1 text-xs font-bold focus:outline-none ${
                      isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                    }`}
                  />
                </div>

                <div>
                  <label className={`block text-[10px] font-extrabold uppercase mb-1 ${isDarkMode ? 'text-indigo-300' : 'text-indigo-950'}`}>CARI SISWA</label>
                  <input
                    type="text"
                    value={searchNama}
                    onChange={(e) => setSearchNama(e.target.value)}
                    placeholder="Nama siswa..."
                    className={`w-full border rounded-xl px-2.5 py-1 text-xs font-bold focus:outline-none ${
                      isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                    }`}
                  />
                </div>
              </div>

              <div className={`border rounded-2xl p-3.5 flex-1 flex flex-col min-h-0 shadow-sm overflow-hidden ${
                isDarkMode ? 'bg-slate-900/90 border-slate-800' : 'bg-gradient-to-br from-indigo-100/90 via-slate-100/90 to-indigo-50/90 border-indigo-200/80'
              }`}>
                <div className={`flex-1 overflow-y-auto rounded-xl border ${isDarkMode ? 'bg-slate-900/90 border-slate-800' : 'bg-white/90 border-indigo-200/80'}`}>
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className={`sticky top-0 z-10 shadow-xs ${isDarkMode ? 'bg-slate-800' : 'bg-indigo-100'}`}>
                      <tr className={`border-b font-extrabold uppercase text-[11px] ${isDarkMode ? 'text-indigo-300 border-slate-700' : 'text-indigo-950 border-indigo-200'}`}>
                        <th className="py-2.5 px-3 w-12 text-center">NO</th>
                        <th className="py-2.5 px-3">TANGGAL</th>
                        <th className="py-2.5 px-3">KELAS</th>
                        <th className="py-2.5 px-3">MATA PELAJARAN</th>
                        <th className="py-2.5 px-3">NAMA SISWA</th>
                        <th className="py-2.5 px-3 text-center">STATUS</th>
                        <th className="py-2.5 px-3 text-center w-20">AKSI</th>
                      </tr>
                    </thead>
                    <tbody className={`divide-y ${isDarkMode ? 'divide-slate-800 text-slate-200' : 'divide-slate-200 text-slate-800'}`}>
                      {loadingRekap ? (
                        <tr>
                          <td colSpan={7} className={`py-10 text-center font-medium ${isDarkMode ? 'text-slate-500' : 'text-slate-600'}`}>Memuat riwayat presensi...</td>
                        </tr>
                      ) : rekapList.length === 0 ? (
                        <tr>
                          <td colSpan={7} className={`py-10 text-center font-medium ${isDarkMode ? 'text-slate-500' : 'text-slate-600'}`}>Tidak ada riwayat presensi ditemukan.</td>
                        </tr>
                      ) : (
                        rekapList.map((item, index) => (
                          <tr key={item.id || index} className={`transition ${isDarkMode ? 'hover:bg-slate-800/60' : 'hover:bg-indigo-50/60'}`}>
                            <td className={`py-2 px-3 text-center font-bold ${isDarkMode ? 'text-slate-500' : 'text-slate-500'}`}>{index + 1}</td>
                            <td className={`py-2 px-3 font-mono font-bold ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>{item.tanggal}</td>
                            <td className={`py-2 px-3 font-extrabold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{item.kelas}</td>
                            <td className={`py-2 px-3 font-extrabold ${isDarkMode ? 'text-indigo-300' : 'text-indigo-950'}`}>{item.mapel}</td>
                            <td className={`py-2 px-3 font-extrabold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{item.nama_siswa}</td>
                            <td className="py-2 px-3 text-center">
                              <span
                                className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase ${
                                  item.status === 'HADIR'
                                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                    : item.status === 'IZIN'
                                    ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                    : item.status === 'SAKIT'
                                    ? 'bg-indigo-100 text-indigo-800 border border-indigo-300'
                                    : 'bg-rose-100 text-rose-800 border border-rose-300'
                                }`}
                              >
                                {item.status}
                              </span>
                            </td>
                            <td className="py-2 px-3 text-center">
                              <button
                                onClick={async () => {
                                  if (item.id && confirm('Hapus record presensi ini?')) {
                                    await supabase.from('absensi').delete().eq('id', item.id)
                                    setRekapList(prev => prev.filter(r => r.id !== item.id))
                                  }
                                }}
                                className="bg-rose-50 text-rose-600 hover:bg-rose-100 p-1.5 rounded-lg border border-rose-200 transition cursor-pointer"
                                title="Hapus Record"
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

        <div className="pb-16 pt-1 flex justify-center shrink-0 print:hidden">
          <div className={`border px-4 py-0.5 rounded-full text-center text-[10px] font-medium shadow-xs transition-colors duration-300 ${
            isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-400' : 'bg-slate-100/90 border-slate-300 text-slate-700'
          }`}>
            <span>Aplikasi Guru AI</span>
            <span className="mx-2">•</span>
            <span>Created by <strong className="text-emerald-500 font-bold">MUZAINI AL KAHFI</strong></span>
          </div>
        </div>

      </div>

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

          <Link href="/absensi" className="flex flex-col items-center gap-0.5 text-[11px] font-bold text-indigo-500 transition">
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