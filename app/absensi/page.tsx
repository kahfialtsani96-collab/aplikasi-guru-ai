'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { motion } from 'framer-motion'
import { useAuthRole } from '@/hooks/useAuthRole'

// Helper Instansiasi Aman Supabase Client untuk Vercel SSG Build
const getSupabaseClient = () => {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://kvrulbdvgxfrtmznpjnm.supabase.co').replace(/['"]/g, '').trim()
  const key = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder').replace(/['"]/g, '').trim()
  return createClient(url, key)
}

const supabase = getSupabaseClient()

interface Siswa {
  id: number
  nisn: string
  nama_lengkap: string
  kelas_id?: number
  kelas?: any
}

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
  jam_ke?: string
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
  const [subTabAbsen, setSubTabAbsen] = useState<'belum' | 'sudah'>('belum')
  const [showQrModal, setShowQrModal] = useState<boolean>(false)

  // State untuk Ganti Kamera ('environment' = Belakang, 'user' = Depan/Selfie)
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment')

  // Global Filter Periode Akademik
  const [selectedSemester, setSelectedSemester] = useState<'Ganjil' | 'Genap'>('Ganjil')
  const [selectedTahunAjaran, setSelectedTahunAjaran] = useState('2026/2027')

  const [tanggal, setTanggal] = useState('')
  const [todayStr, setTodayStr] = useState('')
  const [hari, setHari] = useState('Senin')
  const [jamMulai, setJamMulai] = useState('1')
  const [jamSelesai, setJamSelesai] = useState('1')

  // Dynamic Options
  const [kelasList, setKelasList] = useState<OptionItem[]>([])
  const [mapelList, setMapelList] = useState<OptionItem[]>([])
  const [masterJamList, setMasterJamList] = useState<MasterJamItem[]>([])

  const [selectedKelasId, setSelectedKelasId] = useState('')
  const [selectedMapelId, setSelectedMapelId] = useState('')

  const [siswaList, setSiswaList] = useState<Siswa[]>([])
  const [absensiMap, setAbsensiMap] = useState<StatusAbsensiMap>({})
  const [loadingSiswa, setLoadingSiswa] = useState(false)
  const [saving, setSaving] = useState(false)

  // State Rekapitulasi (Default Tanggal Hari Ini Agar Ringan)
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
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    const today = `${year}-${month}-${day}`
    
    setTodayStr(today)
    setTanggal(today)
    setFilterTanggal(today)

    const namaHari = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'][now.getDay()]
    if (namaHari !== 'Jumat') {
      setHari(namaHari)
    }

    async function getUserData() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const email = user.email || ''
        setUserEmail(email)
        const nameFromMeta = user.user_metadata?.full_name || email.split('@')[0] || 'GURU'
        setUserDisplayName(nameFromMeta.toUpperCase())

        fetchJadwalGuru(email)
        fetchMasterJam()
      }
    }

    getUserData()
  }, [])

  // Fetch Slot Waktu dari Master Jam
  async function fetchMasterJam() {
    const { data } = await supabase.from('master_jam').select('*').order('jam_ke', { ascending: true })
    if (data) setMasterJamList(data)
  }

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
        let query = supabase
          .from('siswa')
          .select('id, nisn, nama_lengkap, kelas_id, kelas:kelas_id(nama_kelas)')
          .order('nama_lengkap', { ascending: true })

        if (selectedKelasId !== 'ALL') {
          query = query.eq('kelas_id', Number(selectedKelasId))
        }

        const { data, error } = await query

        if (!error && data) {
          setSiswaList(data as any)

          if (selectedMapelId && tanggal) {
            let absensiQuery = supabase
              .from('absensi')
              .select('siswa_id, status')
              .eq('mapel_id', Number(selectedMapelId))
              .eq('tanggal', tanggal)
              .eq('semester', selectedSemester)
              .eq('tahun_ajaran', selectedTahunAjaran)

            if (selectedKelasId !== 'ALL') {
              absensiQuery = absensiQuery.eq('kelas_id', Number(selectedKelasId))
            }

            const { data: existingAbsensi } = await absensiQuery

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

  // QR Scanner Modal Implementation
  useEffect(() => {
    let html5QrCode: any = null
    let isMounted = true

    if (showQrModal && activeTab === 'input') {
      import('html5-qrcode').then(({ Html5Qrcode }) => {
        if (!isMounted) return

        if (!qrScannerRef.current) {
          html5QrCode = new Html5Qrcode('reader')
          qrScannerRef.current = html5QrCode
        } else {
          html5QrCode = qrScannerRef.current
        }

        const startScanner = async () => {
          try {
            if (html5QrCode.isScanning) {
              await html5QrCode.stop()
            }

            await html5QrCode.start(
              { facingMode: facingMode },
              { fps: 10, qrbox: { width: 200, height: 200 } },
              (decodedText: string) => {
                handleQRScanned(decodedText)
              },
              () => {}
            )
          } catch (err: any) {
            console.warn('Gagal memulai kamera:', err)
            setScanStatus({
              type: 'error',
              msg: '⚠️ Kamera tidak tersedia / izin ditolak.'
            })
          }
        }

        startScanner()
      })
    }

    return () => {
      isMounted = false
      if (qrScannerRef.current && qrScannerRef.current.isScanning) {
        qrScannerRef.current.stop().catch(() => {})
      }
    }
  }, [showQrModal, activeTab, facingMode, siswaList, absensiMap])

  const toggleCameraFacing = async () => {
    const nextMode = facingMode === 'environment' ? 'user' : 'environment'
    if (qrScannerRef.current) {
      try {
        if (qrScannerRef.current.isScanning) {
          await qrScannerRef.current.stop()
        }
      } catch (e) {
        console.log('Proses penghentian kamera...', e)
      }
    }
    setFacingMode(nextMode)
  }

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
          msg: `⚠️ ${targetSiswa.nama_lengkap} SUDAH HADIR!`
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
        msg: `❌ NISN/ID: "${textClean}" Tidak Ditemukan!`
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
      if (filterMapelId) query = query.eq('mapel', filterMapelId)
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

  // Action Tandai Semua Hadir
  const handleAutoHadirAll = () => {
    if (siswaList.length === 0) return
    const newMap: StatusAbsensiMap = { ...absensiMap }
    siswaList.forEach((s) => {
      newMap[String(s.id)] = 'HADIR'
    })
    setAbsensiMap(newMap)
  }

  const jamOptionsForHari = masterJamList.filter((j) => j.hari === hari)

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

      const rowsToInsert = processedSiswa.map((siswa) => {
        let namaKelasVal = (siswa.kelas?.nama_kelas) || (Array.isArray(siswa.kelas) ? siswa.kelas[0]?.nama_kelas : '') || ''
        if (!namaKelasVal && selectedKelasId !== 'ALL') {
          const kObj = kelasList.find((k) => k.id === Number(selectedKelasId))
          namaKelasVal = kObj?.nama || ''
        }

        return {
          tanggal,
          jam_ke: jamFormattedText,
          kelas_id: siswa.kelas_id || (selectedKelasId !== 'ALL' ? Number(selectedKelasId) : null),
          mapel_id: Number(selectedMapelId),
          siswa_id: siswa.id,
          kelas: namaKelasVal,
          mapel: selectedMapelObj?.nama || '',
          nama_siswa: siswa.nama_lengkap,
          nisn: siswa.nisn || '',
          status: absensiMap[String(siswa.id)],
          semester: selectedSemester,
          tahun_ajaran: selectedTahunAjaran,
          guru_email: userEmail
        }
      })

      if (selectedKelasId === 'ALL') {
        const studentIds = processedSiswa.map((s) => s.id)
        await supabase
          .from('absensi')
          .delete()
          .in('siswa_id', studentIds)
          .eq('mapel_id', Number(selectedMapelId))
          .eq('tanggal', tanggal)
          .eq('semester', selectedSemester)
          .eq('tahun_ajaran', selectedTahunAjaran)
      } else {
        await supabase
          .from('absensi')
          .delete()
          .eq('kelas_id', Number(selectedKelasId))
          .eq('mapel_id', Number(selectedMapelId))
          .eq('tanggal', tanggal)
          .eq('semester', selectedSemester)
          .eq('tahun_ajaran', selectedTahunAjaran)
      }

      const { error } = await supabase
        .from('absensi')
        .insert(rowsToInsert)

      if (error) {
        alert('Gagal menyimpan absensi: ' + error.message)
      } else {
        alert(`Berhasil menyimpan presensi ${processedSiswa.length} siswa!`)
        setFilterTanggal(tanggal)
        if (selectedKelasId !== 'ALL') {
          setFilterKelasId(selectedKelasId)
        }
        if (selectedMapelObj) {
          setFilterMapelId(selectedMapelObj.nama)
        }
        setActiveTab('rekap')
      }
    } catch (err: any) {
      alert('Terjadi kesalahan: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  // Siswa terurut A-Z
  const sortedSiswaList = [...siswaList].sort((a, b) => a.nama_lengkap.localeCompare(b.nama_lengkap))
  const siswaBelumAbsen = sortedSiswaList.filter((s) => !absensiMap[String(s.id)])
  const siswaSudahAbsen = sortedSiswaList.filter((s) => absensiMap[String(s.id)])

  const totalData = rekapList.length
  const totalHadir = rekapList.filter(item => item.status === 'HADIR').length
  const totalIzin = rekapList.filter(item => item.status === 'IZIN').length
  const totalSakit = rekapList.filter(item => item.status === 'SAKIT').length
  const totalAlpa = rekapList.filter(item => item.status === 'ALPA').length

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
                Presensi Siswa
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
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
            <Link href="/absensi" className="bg-indigo-600 text-white px-2 py-0.5 rounded shadow-xs font-extrabold flex items-center gap-1">
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
          
          {/* TAB SWITCHER: INPUT VS RIWAYAT */}
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
              <span>📋</span> Input Presensi
            </button>
            <button
              onClick={() => setActiveTab('rekap')}
              className={`py-1 rounded-md transition flex items-center justify-center gap-1 cursor-pointer ${
                activeTab === 'rekap' 
                  ? 'bg-indigo-600 text-white shadow-xs' 
                  : isDarkMode ? 'text-slate-400' : 'text-slate-700'
              }`}
            >
              <span>📜</span> Riwayat Presensi
            </button>
          </div>

          {activeTab === 'input' && (
            <div className="flex flex-col h-full overflow-hidden space-y-2">
              
              {/* AREA 40% ATAS: FORM FILTER COMPACT (FIXED / NON-SCROLL) */}
              <div className={`border rounded-xl p-2 shrink-0 shadow-xs space-y-1.5 ${
                isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-indigo-200'
              }`}>
                {/* ROW 1: TANGGAL & JAM MENGAJAR */}
                <div className="grid grid-cols-12 gap-1.5">
                  <div className="col-span-6">
                    <input
                      type="date"
                      value={tanggal}
                      max={todayStr}
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

                {/* ROW 2: KELAS, MAPEL & TOMBOL QR MINIMALIS */}
                <div className="grid grid-cols-12 gap-1.5">
                  <div className="col-span-5">
                    <select
                      value={selectedKelasId}
                      onChange={(e) => setSelectedKelasId(e.target.value)}
                      className={`w-full border rounded-lg px-2 py-1 text-xs font-bold focus:outline-none ${
                        isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                      }`}
                    >
                      <option value="">-- Kelas --</option>
                      <option value="ALL">✨ Semua Kelas</option>
                      {kelasList.map((k) => (
                        <option key={k.id} value={k.id}>{k.nama}</option>
                      ))}
                    </select>
                  </div>

                  <div className="col-span-5">
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

                  <div className="col-span-2">
                    <button
                      type="button"
                      onClick={() => setShowQrModal(true)}
                      className="w-full h-full bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-bold transition flex items-center justify-center cursor-pointer shadow-xs"
                      title="Scan QR Code Siswa"
                    >
                      📷 QR
                    </button>
                  </div>
                </div>
              </div>

              {/* QR SCANNER MODAL POPUP */}
              {showQrModal && (
                <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
                  <div className={`w-full max-w-sm rounded-2xl p-4 border shadow-2xl flex flex-col items-center space-y-3 ${
                    isDarkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                  }`}>
                    <div className="w-full flex items-center justify-between">
                      <h3 className="text-xs font-black uppercase flex items-center gap-1.5">
                        <span>📷</span> Scan QR Kartu Pelajar
                      </h3>
                      <button
                        onClick={() => {
                          if (qrScannerRef.current && qrScannerRef.current.isScanning) {
                            qrScannerRef.current.stop().catch(() => {})
                          }
                          setShowQrModal(false)
                        }}
                        className="text-slate-400 hover:text-rose-500 font-extrabold text-sm p-1"
                      >
                        ✕
                      </button>
                    </div>

                    <div className="w-full overflow-hidden rounded-xl border-2 border-indigo-600 bg-black relative">
                      <div id="reader" className="w-full"></div>
                      {isScanning && (
                        <div className="absolute inset-0 bg-emerald-500/20 backdrop-blur-xs flex items-center justify-center">
                          <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between w-full pt-1">
                      <button
                        type="button"
                        onClick={toggleCameraFacing}
                        className="text-[11px] font-bold text-indigo-400 hover:underline"
                      >
                        🔄 Putar Kamera ({facingMode === 'environment' ? 'Belakang' : 'Depan'})
                      </button>
                      <button
                        onClick={() => setShowQrModal(false)}
                        className="px-3 py-1 bg-slate-700 text-white text-xs font-bold rounded-lg"
                      >
                        Tutup
                      </button>
                    </div>

                    {scanStatus && (
                      <div className={`w-full text-center px-3 py-1.5 rounded-lg text-xs font-extrabold border ${
                        scanStatus.type === 'success' ? 'bg-emerald-100 text-emerald-900 border-emerald-300' :
                        scanStatus.type === 'warning' ? 'bg-amber-100 text-amber-900 border-amber-300' :
                        'bg-rose-100 text-rose-900 border-rose-300'
                      }`}>
                        {scanStatus.msg}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* SUB-TAB TOGGLE (BELUM VS SUDAH ABSEN) + QUICK BATCH ACTION */}
              <div className="flex items-center justify-between gap-1.5 shrink-0">
                <div className={`grid grid-cols-2 p-0.5 rounded-lg border text-[10px] font-extrabold flex-1 ${
                  isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-300'
                }`}>
                  <button
                    onClick={() => setSubTabAbsen('belum')}
                    className={`py-1 rounded-md transition flex items-center justify-center gap-1 cursor-pointer ${
                      subTabAbsen === 'belum' 
                        ? 'bg-amber-500 text-white shadow-xs' 
                        : isDarkMode ? 'text-slate-400' : 'text-slate-600'
                    }`}
                  >
                    <span>⏳ Belum ({siswaBelumAbsen.length})</span>
                  </button>
                  <button
                    onClick={() => setSubTabAbsen('sudah')}
                    className={`py-1 rounded-md transition flex items-center justify-center gap-1 cursor-pointer ${
                      subTabAbsen === 'sudah' 
                        ? 'bg-emerald-600 text-white shadow-xs' 
                        : isDarkMode ? 'text-slate-400' : 'text-slate-600'
                    }`}
                  >
                    <span>✅ Sudah ({siswaSudahAbsen.length})</span>
                  </button>
                </div>

                {subTabAbsen === 'belum' && siswaBelumAbsen.length > 0 && (
                  <button
                    type="button"
                    onClick={handleAutoHadirAll}
                    className="px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-extrabold shadow-xs transition shrink-0 flex items-center gap-1 cursor-pointer"
                    title="Tandai Semua Hadir"
                  >
                    <span>⚡ Auto-Hadir</span>
                  </button>
                )}
              </div>

              {/* AREA 60% BAWAH: LIST SISWA (INTERNAL SCROLL AREA) */}
              <div className={`border rounded-xl p-2 flex-1 flex flex-col overflow-hidden shadow-xs ${
                isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-indigo-200'
              }`}>
                {!selectedKelasId || !selectedMapelId ? (
                  <div className={`py-8 text-center text-xs font-semibold ${isDarkMode ? 'text-slate-500' : 'text-slate-500'}`}>
                    Pilih Kelas dan Mapel diajar terlebih dahulu.
                  </div>
                ) : loadingSiswa ? (
                  <div className={`py-8 text-center text-xs font-semibold ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                    Memuat daftar siswa...
                  </div>
                ) : subTabAbsen === 'belum' ? (
                  siswaBelumAbsen.length === 0 ? (
                    <div className="py-8 text-center text-xs text-emerald-500 font-extrabold">
                      🎉 Semua siswa di kelas ini sudah terabsen!
                    </div>
                  ) : (
                    /* AREA SCROLL KHUSUS UNTUK DAFTAR SISWA BELUM ABSEN */
                    <div className="flex-1 overflow-y-auto pr-1 divide-y divide-slate-100 dark:divide-slate-800">
                      {siswaBelumAbsen.map((siswa, idx) => {
                        const sId = String(siswa.id)
                        const namaKelasSiswa = (siswa.kelas?.nama_kelas) || (Array.isArray(siswa.kelas) ? siswa.kelas[0]?.nama_kelas : '-') || '-'
                        return (
                          <div key={sId} className="py-1.5 flex items-center justify-between gap-1.5">
                            <div className="min-w-0 flex-1">
                              <h4 className={`text-[11px] font-extrabold truncate ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                                {idx + 1}. {siswa.nama_lengkap}
                              </h4>
                              <p className={`text-[9px] font-mono ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                                NISN: {siswa.nisn || '-'} {selectedKelasId === 'ALL' && `• ${namaKelasSiswa}`}
                              </p>
                            </div>

                            {/* TOGGLE SEGMENTED BUTTON GROUPS */}
                            <div className="flex items-center rounded-md border p-0.5 shadow-xs overflow-hidden shrink-0 bg-slate-100 border-slate-300">
                              <button
                                onClick={() => handleStatusChange(sId, 'HADIR')}
                                className="px-1.5 py-0.5 text-[10px] font-black hover:bg-emerald-600 hover:text-white text-emerald-800 transition cursor-pointer"
                                title="Hadir"
                              >
                                H
                              </button>
                              <button
                                onClick={() => handleStatusChange(sId, 'IZIN')}
                                className="px-1.5 py-0.5 text-[10px] font-black hover:bg-amber-600 hover:text-white text-amber-800 border-l border-r border-slate-300 transition cursor-pointer"
                                title="Izin"
                              >
                                I
                              </button>
                              <button
                                onClick={() => handleStatusChange(sId, 'SAKIT')}
                                className="px-1.5 py-0.5 text-[10px] font-black hover:bg-indigo-600 hover:text-white text-indigo-800 border-r border-slate-300 transition cursor-pointer"
                                title="Sakit"
                              >
                                S
                              </button>
                              <button
                                onClick={() => handleStatusChange(sId, 'ALPA')}
                                className="px-1.5 py-0.5 text-[10px] font-black hover:bg-rose-600 hover:text-white text-rose-800 transition cursor-pointer"
                                title="Alpa"
                              >
                                A
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )
                ) : (
                  siswaSudahAbsen.length === 0 ? (
                    <div className={`py-8 text-center text-xs font-medium ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                      Belum ada siswa yang di-absen.
                    </div>
                  ) : (
                    /* AREA SCROLL KHUSUS UNTUK DAFTAR SISWA SUDAH ABSEN */
                    <div className="flex-1 overflow-y-auto pr-1 divide-y divide-slate-100 dark:divide-slate-800">
                      {siswaSudahAbsen.map((siswa, idx) => {
                        const sId = String(siswa.id)
                        const st = absensiMap[sId]
                        return (
                          <div key={sId} className="py-1.5 flex items-center justify-between gap-1.5">
                            <div className="min-w-0 flex-1">
                              <h4 className={`text-[11px] font-extrabold truncate ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                                {idx + 1}. {siswa.nama_lengkap}
                              </h4>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className={`px-1.5 py-0.2 rounded text-[9px] font-black uppercase ${
                                st === 'HADIR' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' :
                                st === 'IZIN' ? 'bg-amber-100 text-amber-800 border border-amber-300' :
                                st === 'SAKIT' ? 'bg-indigo-100 text-indigo-800 border border-indigo-300' :
                                'bg-rose-100 text-rose-800 border border-rose-300'
                              }`}>
                                {st}
                              </span>
                              <button
                                onClick={() => handleStatusChange(sId, '')}
                                className="text-rose-500 hover:text-rose-700 font-bold p-0.5 text-xs"
                                title="Batalkan"
                              >
                                ✕
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )
                )}
              </div>

              {/* TOMBOL SIMPAN PRESENSI */}
              {selectedKelasId && (
                <button
                  type="button"
                  onClick={handleSimpanAbsensi}
                  disabled={saving || !selectedKelasId || !selectedMapelId || siswaSudahAbsen.length === 0}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-600 text-white font-black py-1.5 rounded-lg text-xs transition shadow-xs flex items-center justify-center gap-1 cursor-pointer shrink-0"
                >
                  <span>💾</span>
                  <span>
                    {saving ? 'Menyimpan...' : `SIMPAN PRESENSI (${siswaSudahAbsen.length} SISWA)`}
                  </span>
                </button>
              )}

            </div>
          )}

          {/* TAB 2: RIWAYAT & REKAPITULASI (INTERNAL SCROLL AREA) */}
          {activeTab === 'rekap' && (
            <div className="flex flex-col h-full overflow-hidden space-y-2">
              
              {/* STATISTIK RINGKAS */}
              <div className="grid grid-cols-5 gap-1 shrink-0 text-center">
                <div className={`border rounded-lg p-1 shadow-xs ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-300'}`}>
                  <p className={`text-[8px] font-black uppercase ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>TOTAL</p>
                  <p className={`text-xs font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{totalData}</p>
                </div>
                <div className={`border rounded-lg p-1 shadow-xs ${isDarkMode ? 'bg-slate-900 border-emerald-800' : 'bg-white border-emerald-200'}`}>
                  <p className={`text-[8px] font-black uppercase ${isDarkMode ? 'text-emerald-400' : 'text-emerald-700'}`}>HADIR</p>
                  <p className={`text-xs font-black ${isDarkMode ? 'text-emerald-300' : 'text-emerald-900'}`}>{totalHadir}</p>
                </div>
                <div className={`border rounded-lg p-1 shadow-xs ${isDarkMode ? 'bg-slate-900 border-amber-800' : 'bg-white border-amber-200'}`}>
                  <p className={`text-[8px] font-black uppercase ${isDarkMode ? 'text-amber-400' : 'text-amber-700'}`}>IZIN</p>
                  <p className={`text-xs font-black ${isDarkMode ? 'text-amber-300' : 'text-amber-900'}`}>{totalIzin}</p>
                </div>
                <div className={`border rounded-lg p-1 shadow-xs ${isDarkMode ? 'bg-slate-900 border-indigo-800' : 'bg-white border-indigo-200'}`}>
                  <p className={`text-[8px] font-black uppercase ${isDarkMode ? 'text-indigo-400' : 'text-indigo-700'}`}>SAKIT</p>
                  <p className={`text-xs font-black ${isDarkMode ? 'text-indigo-300' : 'text-indigo-900'}`}>{totalSakit}</p>
                </div>
                <div className={`border rounded-lg p-1 shadow-xs ${isDarkMode ? 'bg-slate-900 border-rose-800' : 'bg-white border-rose-200'}`}>
                  <p className={`text-[8px] font-black uppercase ${isDarkMode ? 'text-rose-400' : 'text-rose-700'}`}>ALPA</p>
                  <p className={`text-xs font-black ${isDarkMode ? 'text-rose-300' : 'text-rose-900'}`}>{totalAlpa}</p>
                </div>
              </div>

              {/* FILTER BAR REKAP */}
              <div className={`grid grid-cols-2 gap-1 border p-1 rounded-lg shrink-0 shadow-xs ${
                isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-indigo-200'
              }`}>
                <select
                  value={filterKelasId}
                  onChange={(e) => setFilterKelasId(e.target.value)}
                  className={`border rounded px-1 py-0.5 text-[11px] font-bold focus:outline-none ${
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
                  className={`border rounded px-1 py-0.5 text-[11px] font-bold focus:outline-none ${
                    isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                >
                  <option value="">Semua Mapel</option>
                  {mapelList.map((m) => (
                    <option key={m.id} value={m.nama}>{m.nama}</option>
                  ))}
                </select>

                <input
                  type="date"
                  value={filterTanggal}
                  onChange={(e) => setFilterTanggal(e.target.value)}
                  className={`border rounded px-1 py-0.5 text-[11px] font-bold focus:outline-none ${
                    isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                />

                <input
                  type="text"
                  value={searchNama}
                  onChange={(e) => setSearchNama(e.target.value)}
                  placeholder="Cari siswa..."
                  className={`border rounded px-1 py-0.5 text-[11px] font-bold focus:outline-none ${
                    isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                />
              </div>

              {/* LIST REKAP (INTERNAL SCROLL) */}
              <div className={`border rounded-xl p-2 flex-1 flex flex-col overflow-hidden shadow-xs ${
                isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-indigo-200'
              }`}>
                {loadingRekap ? (
                  <div className={`py-6 text-center text-xs font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                    Memuat riwayat...
                  </div>
                ) : rekapList.length === 0 ? (
                  <div className={`py-6 text-center text-xs font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                    Tidak ada riwayat presensi.
                  </div>
                ) : (
                  <div className="flex-1 overflow-y-auto pr-1 space-y-1.5">
                    {rekapList.map((item, index) => (
                      <div
                        key={item.id || index}
                        className={`p-1.5 rounded-lg border transition shadow-xs flex items-center justify-between gap-1.5 ${
                          isDarkMode ? 'bg-slate-800/80 border-slate-700' : 'bg-slate-50 border-slate-200'
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <h4 className={`text-[11px] font-extrabold truncate ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                            {item.nama_siswa}
                          </h4>
                          <p className={`text-[9px] font-mono ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                            📅 {item.tanggal} • {item.kelas} • {item.mapel}
                          </p>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <span className={`px-1.5 py-0.2 rounded text-[9px] font-black uppercase ${
                            item.status === 'HADIR' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' :
                            item.status === 'IZIN' ? 'bg-amber-100 text-amber-800 border border-amber-300' :
                            item.status === 'SAKIT' ? 'bg-indigo-100 text-indigo-800 border border-indigo-300' :
                            'bg-rose-100 text-rose-800 border border-rose-300'
                          }`}>
                            {item.status}
                          </span>
                          <button
                            onClick={async () => {
                              if (item.id && confirm('Hapus record ini?')) {
                                await supabase.from('absensi').delete().eq('id', item.id)
                                setRekapList(prev => prev.filter(r => r.id !== item.id))
                              }
                            }}
                            className="text-rose-500 hover:text-rose-700 font-bold p-0.5 text-xs"
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

          <Link href="/absensi" className="flex flex-col items-center gap-0.5 text-[10px] font-bold text-indigo-500 transition">
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