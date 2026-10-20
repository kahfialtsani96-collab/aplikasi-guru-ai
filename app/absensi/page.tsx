'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { useAuthRole } from '@/hooks/useAuthRole'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
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
}

interface StatusAbsensiMap {
  [siswaId: string]: 'HADIR' | 'IZIN' | 'SAKIT' | 'ALPA'
}

export default function AbsensiPage() {
  const router = useRouter()
  const { isOperator, canAccessBimbingan } = useAuthRole()

  const [userDisplayName, setUserDisplayName] = useState('GURU')
  const [userEmail, setUserEmail] = useState<string | null>(null)

  const [activeTab, setActiveTab] = useState<'input' | 'rekap'>('input')
  const [modeInput, setModeInput] = useState<'manual' | 'qr'>('manual')

  const [tanggal, setTanggal] = useState('')
  const [todayStr, setTodayStr] = useState('')

  // Dynamic Options (Diampu oleh Guru yang Login)
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

  // QR Scanner Ref
  const [scanMessage, setScanMessage] = useState<string | null>(null)
  const qrScannerRef = useRef<any>(null)

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

        // Fetch Kelas & Mapel yang diampu oleh Guru ini
        fetchJadwalGuru(email)
      }
    }

    getUserData()
  }, [])

  // Mengambil daftar Kelas & Mapel yang diampu guru dari tabel jadwal
  async function fetchJadwalGuru(email: string) {
    try {
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
        // Extract unique kelas
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

        const kArr: OptionItem[] = Array.from(uniqueKelasMap.entries()).map(([id, nama]) => ({ id, nama }))
        const mArr: OptionItem[] = Array.from(uniqueMapelMap.entries()).map(([id, nama]) => ({ id, nama }))

        setKelasList(kArr)
        setMapelList(mArr)
      }
    } catch (err) {
      console.error('Error fetching jadwal guru:', err)
    }
  }

  // Load Siswa berdasarkan Kelas ID terpilih
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
          const initialMap: StatusAbsensiMap = {}
          data.forEach((s) => {
            if (s.id) initialMap[String(s.id)] = 'HADIR'
          })
          setAbsensiMap(initialMap)
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
  }, [selectedKelasId, activeTab])

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
  }, [modeInput, activeTab, siswaList])

  const handleQRScanned = (scannedText: string) => {
    const textClean = scannedText.trim()
    const targetSiswa = siswaList.find(
      (s) => s.nisn === textClean || String(s.id) === textClean
    )

    if (targetSiswa && targetSiswa.id) {
      setAbsensiMap((prev) => ({
        ...prev,
        [String(targetSiswa.id)]: 'HADIR',
      }))
      setScanMessage(`✅ Berhasil: ${targetSiswa.nama_lengkap} (HADIR)`)
    } else {
      setScanMessage(`⚠️ Siswa dengan NISN/ID: "${textClean}" tidak ditemukan di kelas ini.`)
    }

    setTimeout(() => setScanMessage(null), 3500)
  }

  // Load Rekapitulasi Absensi
  const fetchRekap = async () => {
    if (!userEmail) return

    setLoadingRekap(true)
    try {
      let query = supabase
        .from('absensi')
        .select('*')
        .eq('guru_email', userEmail)
        .order('tanggal', { ascending: false })

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
    if (activeTab === 'rekap' && userEmail) {
      fetchRekap()
    }
  }, [activeTab, filterKelasId, filterMapelId, filterTanggal, searchNama, userEmail])

  const handleHadirSemua = () => {
    const updatedMap: StatusAbsensiMap = {}
    siswaList.forEach((s) => {
      if (s.id) updatedMap[String(s.id)] = 'HADIR'
    })
    setAbsensiMap(updatedMap)
  }

  const handleStatusChange = (siswaId: string, status: 'HADIR' | 'IZIN' | 'SAKIT' | 'ALPA') => {
    setAbsensiMap((prev) => ({
      ...prev,
      [siswaId]: status,
    }))
  }

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

    setSaving(true)
    try {
      const selectedKelasObj = kelasList.find((k) => k.id === Number(selectedKelasId))
      const selectedMapelObj = mapelList.find((m) => m.id === Number(selectedMapelId))

      const rowsToInsert = siswaList.map((siswa) => ({
        tanggal,
        kelas_id: Number(selectedKelasId),
        mapel_id: Number(selectedMapelId),
        siswa_id: siswa.id,
        kelas: selectedKelasObj?.nama || '',
        mapel: selectedMapelObj?.nama || '',
        nama_siswa: siswa.nama_lengkap,
        nisn: siswa.nisn || '',
        status: absensiMap[String(siswa.id)] || 'HADIR',
        guru_email: userEmail
      }))

      const { error } = await supabase
        .from('absensi')
        .upsert(rowsToInsert, { onConflict: 'siswa_id,tanggal,mapel_id' })

      if (error) {
        alert('Gagal menyimpan absensi: ' + error.message)
      } else {
        alert('Data absensi harian berhasil disimpan!')
      }
    } catch (err: any) {
      alert('Terjadi kesalahan: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  // Statistik Rekapitulasi
  const totalData = rekapList.length
  const totalHadir = rekapList.filter(item => item.status === 'HADIR').length
  const totalIzin = rekapList.filter(item => item.status === 'IZIN').length
  const totalSakit = rekapList.filter(item => item.status === 'SAKIT').length
  const totalAlpa = rekapList.filter(item => item.status === 'ALPA').length

  return (
    <div className="h-screen bg-[#E2E8F0] text-slate-800 font-sans flex flex-col justify-between selection:bg-indigo-500 selection:text-white overflow-hidden relative">
      
      {/* WATERMARK LOGO */}
      <div className="fixed inset-0 pointer-events-none z-0 flex items-center justify-center opacity-[0.15] select-none print:hidden">
        <img src="/logo-smp.jpg" alt="Watermark" className="w-[850px] h-[850px] object-contain max-w-none" />
      </div>

      <div className="relative z-10 flex flex-col h-full overflow-hidden">
        
        {/* HEADER TOPBAR */}
        <header className="bg-slate-100/90 backdrop-blur-md border-b border-slate-300 px-6 py-2.5 flex items-center justify-between shrink-0 shadow-xs print:hidden">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-slate-600 hover:text-slate-900 p-1.5 rounded-lg transition" title="Kembali ke Dashboard">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </Link>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl overflow-hidden flex items-center justify-center bg-white border border-slate-300 p-0.5 shadow-xs shrink-0">
                <img src="/logo-smp.jpg" alt="Logo SMP" className="w-full h-full object-contain" />
              </div>
              <div>
                <h1 className="font-bold text-base text-slate-900 leading-none">Aplikasi Guru AI</h1>
                <p className="text-[11px] text-emerald-800 font-bold mt-0.5">Input Presensi Harian Siswa</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="bg-white border border-slate-300 text-slate-800 text-xs font-bold px-3.5 py-1.5 rounded-xl flex items-center gap-2 shadow-xs">
              <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px] font-bold">
                {userDisplayName.charAt(0)}
              </span>
              <span>{userDisplayName}</span>
              <span className="bg-indigo-100 text-indigo-800 text-[10px] px-2 py-0.5 rounded-md font-extrabold uppercase ml-1 border border-indigo-200">
                {isOperator ? 'Operator' : 'Guru'}
              </span>
            </div>

            <button
              onClick={async () => {
                await supabase.auth.signOut()
                router.replace('/login')
              }}
              className="bg-rose-100 border border-rose-300 hover:bg-rose-200 text-rose-700 p-2 rounded-xl transition cursor-pointer"
              title="Keluar"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </header>

        {/* SUB-NAVBAR AKADEMIK */}
        <div className="bg-slate-200/80 backdrop-blur-md border-b border-slate-300 px-6 py-2 shrink-0 overflow-x-auto print:hidden">
          <div className="max-w-6xl mx-auto flex items-center gap-2 min-w-max text-xs font-bold">
            <span className="text-indigo-900 font-black pr-2 border-r border-slate-300 flex items-center gap-1">
              🎓 Akademik:
            </span>
            <Link href="/jadwal" className="bg-white/80 text-slate-700 hover:bg-white px-3 py-1.5 rounded-xl border border-slate-300 transition flex items-center gap-1.5">
              <span>🕒</span> Jadwal Mengajar
            </Link>
            <Link href="/absensi" className="bg-indigo-600 text-white px-3 py-1.5 rounded-xl shadow-xs font-extrabold flex items-center gap-1.5">
              <span>📋</span> Input Absensi
            </Link>
            <Link href="/nilai" className="bg-white/80 text-slate-700 hover:bg-white px-3 py-1.5 rounded-xl border border-slate-300 transition flex items-center gap-1.5">
              <span>⭐</span> Input Penilaian
            </Link>
            <Link href="/jurnal" className="bg-white/80 text-slate-700 hover:bg-white px-3 py-1.5 rounded-xl border border-slate-300 transition flex items-center gap-1.5">
              <span>📓</span> Agenda Mengajar
            </Link>
            {canAccessBimbingan && (
              <Link href="/bimbingan" className="bg-white/80 text-slate-700 hover:bg-white px-3 py-1.5 rounded-xl border border-slate-300 transition flex items-center gap-1.5">
                <span>💖</span> Bimbingan Guru Wali
              </Link>
            )}
          </div>
        </div>

        {/* MAIN CONTENT AREA */}
        <main className="max-w-6xl w-full mx-auto p-4 flex-1 flex flex-col min-h-0 space-y-3">
          
          {/* TAB MODE BAR */}
          <div className="flex items-center justify-between shrink-0 print:hidden">
            <div className="grid grid-cols-2 bg-slate-200/90 p-1 rounded-xl border border-slate-300 max-w-md text-xs font-extrabold flex-1">
              <button
                onClick={() => setActiveTab('input')}
                className={`py-1.5 rounded-lg transition flex items-center justify-center gap-2 cursor-pointer ${
                  activeTab === 'input' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-700 hover:text-slate-900'
                }`}
              >
                <span>📋</span> Input Absensi Harian
              </button>
              <button
                onClick={() => setActiveTab('rekap')}
                className={`py-1.5 rounded-lg transition flex items-center justify-center gap-2 cursor-pointer ${
                  activeTab === 'rekap' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-700 hover:text-slate-900'
                }`}
              >
                <span>📜</span> Riwayat &amp; Rekapitulasi
              </button>
            </div>
          </div>

          {/* TAB 1: INPUT ABSENSI */}
          {activeTab === 'input' && (
            <div className="flex-1 flex flex-col min-h-0 space-y-3">
              
              {/* FILTER BAR INPUT */}
              <div className="bg-gradient-to-br from-indigo-100/90 via-slate-100/90 to-indigo-50/90 backdrop-blur-md border border-indigo-200/80 rounded-2xl p-3.5 shadow-xs shrink-0 print:hidden">
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
                  
                  <div className="sm:col-span-3">
                    <label className="block text-[10px] font-extrabold text-indigo-950 uppercase mb-1">TANGGAL *</label>
                    <input
                      type="date"
                      value={tanggal}
                      max={todayStr}
                      onChange={(e) => setTanggal(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs text-slate-900 font-bold focus:outline-none focus:border-indigo-600"
                    />
                  </div>

                  <div className="sm:col-span-3">
                    <label className="block text-[10px] font-extrabold text-indigo-950 uppercase mb-1">KELAS DIAJAR *</label>
                    <select
                      value={selectedKelasId}
                      onChange={(e) => setSelectedKelasId(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs text-slate-900 font-bold focus:outline-none focus:border-indigo-600"
                    >
                      <option value="">-- Pilih Kelas --</option>
                      {kelasList.map((k) => (
                        <option key={k.id} value={k.id}>{k.nama}</option>
                      ))}
                    </select>
                  </div>

                  <div className="sm:col-span-4">
                    <label className="block text-[10px] font-extrabold text-indigo-950 uppercase mb-1">MAPEL DIAJAR *</label>
                    <select
                      value={selectedMapelId}
                      onChange={(e) => setSelectedMapelId(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs text-slate-900 font-bold focus:outline-none focus:border-indigo-600"
                    >
                      <option value="">-- Pilih Mapel --</option>
                      {mapelList.map((m) => (
                        <option key={m.id} value={m.id}>{m.nama}</option>
                      ))}
                    </select>
                  </div>

                  <div className="sm:col-span-2 flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setModeInput(modeInput === 'manual' ? 'qr' : 'manual')}
                      className="w-full bg-slate-800 hover:bg-slate-900 text-white font-extrabold py-1.5 px-2 rounded-xl text-xs transition shadow-xs flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <span>{modeInput === 'manual' ? '📷 QR' : '✍️ Manual'}</span>
                    </button>
                  </div>

                </div>
              </div>

              {/* PANEL QR SCANNER KAMERA */}
              {modeInput === 'qr' && (
                <div className="bg-white/90 backdrop-blur-md border border-indigo-200 rounded-2xl p-4 flex flex-col items-center justify-center space-y-3 shrink-0 shadow-xs">
                  <h3 className="text-xs font-extrabold text-indigo-900 uppercase flex items-center gap-2">
                    <span>📷</span> Arahkan QR Code Kartu Pelajar ke Kamera
                  </h3>
                  <div className="w-full max-w-xs overflow-hidden rounded-2xl border-2 border-indigo-600 shadow-md bg-black">
                    <div id="reader" className="w-full"></div>
                  </div>
                  {scanMessage && (
                    <div className="bg-indigo-50 border border-indigo-200 px-3 py-1.5 rounded-xl text-xs font-bold text-indigo-900">
                      {scanMessage}
                    </div>
                  )}
                </div>
              )}

              {/* TABEL INPUT SISWA */}
              <div className="bg-gradient-to-br from-indigo-100/90 via-slate-100/90 to-indigo-50/90 backdrop-blur-md border border-indigo-200/80 rounded-2xl p-3.5 flex-1 flex flex-col min-h-0 shadow-sm overflow-hidden">
                <div className="flex items-center justify-between pb-2">
                  <span className="text-xs font-extrabold text-indigo-950">
                    Daftar Siswa ({siswaList.length} orang)
                  </span>
                  {selectedKelasId && selectedMapelId && siswaList.length > 0 && (
                    <button
                      onClick={handleHadirSemua}
                      className="bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold px-3 py-1 rounded-xl text-xs transition shadow-xs cursor-pointer"
                    >
                      👤 Hadir Semua
                    </button>
                  )}
                </div>

                <div className="flex-1 overflow-y-auto rounded-xl border border-indigo-200/80 bg-white/90">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className="sticky top-0 bg-indigo-100 z-10 shadow-xs">
                      <tr className="text-indigo-950 border-b border-indigo-200 font-extrabold uppercase text-[11px]">
                        <th className="py-2.5 px-3 w-12 text-center">NO</th>
                        <th className="py-2.5 px-3">NAMA LENGKAP SISWA</th>
                        <th className="py-2.5 px-3 text-center w-20">HADIR</th>
                        <th className="py-2.5 px-3 text-center w-20">IZIN</th>
                        <th className="py-2.5 px-3 text-center w-20">SAKIT</th>
                        <th className="py-2.5 px-3 text-center w-20">ALPA</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-slate-800">
                      {!selectedKelasId || !selectedMapelId ? (
                        <tr>
                          <td colSpan={6} className="py-10 text-center text-slate-600 font-medium">
                            Silakan pilih Tanggal, Kelas, dan Mata Pelajaran di atas.
                          </td>
                        </tr>
                      ) : loadingSiswa ? (
                        <tr>
                          <td colSpan={6} className="py-10 text-center text-slate-600 font-medium">Memuat data siswa...</td>
                        </tr>
                      ) : siswaList.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-10 text-center text-slate-600 font-medium">Belum ada siswa terdaftar di kelas ini.</td>
                        </tr>
                      ) : (
                        siswaList.map((siswa, index) => {
                          const sId = String(siswa.id)
                          const currentStatus = absensiMap[sId] || 'HADIR'
                          return (
                            <tr key={sId || index} className="hover:bg-indigo-50/60 transition">
                              <td className="py-2 px-3 text-center font-bold text-slate-500">{index + 1}</td>
                              <td className="py-2 px-3 font-extrabold text-slate-900">
                                {siswa.nama_lengkap}
                                <span className="block text-[10px] text-slate-500 font-mono font-normal">
                                  NISN: {siswa.nisn || '-'}
                                </span>
                              </td>
                              <td className="py-2 px-3 text-center">
                                <input
                                  type="radio"
                                  name={`status-${sId}`}
                                  checked={currentStatus === 'HADIR'}
                                  onChange={() => handleStatusChange(sId, 'HADIR')}
                                  className="w-4 h-4 accent-emerald-600 cursor-pointer"
                                />
                              </td>
                              <td className="py-2 px-3 text-center">
                                <input
                                  type="radio"
                                  name={`status-${sId}`}
                                  checked={currentStatus === 'IZIN'}
                                  onChange={() => handleStatusChange(sId, 'IZIN')}
                                  className="w-4 h-4 accent-amber-600 cursor-pointer"
                                />
                              </td>
                              <td className="py-2 px-3 text-center">
                                <input
                                  type="radio"
                                  name={`status-${sId}`}
                                  checked={currentStatus === 'SAKIT'}
                                  onChange={() => handleStatusChange(sId, 'SAKIT')}
                                  className="w-4 h-4 accent-indigo-600 cursor-pointer"
                                />
                              </td>
                              <td className="py-2 px-3 text-center">
                                <input
                                  type="radio"
                                  name={`status-${sId}`}
                                  checked={currentStatus === 'ALPA'}
                                  onChange={() => handleStatusChange(sId, 'ALPA')}
                                  className="w-4 h-4 accent-rose-600 cursor-pointer"
                                />
                              </td>
                            </tr>
                          )
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {selectedKelasId && selectedMapelId && siswaList.length > 0 && (
                  <div className="flex justify-end pt-2 shrink-0">
                    <button
                      onClick={handleSimpanAbsensi}
                      disabled={saving}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold px-5 py-2 rounded-xl text-xs transition shadow-xs flex items-center gap-1.5 cursor-pointer"
                    >
                      <span>💾</span> {saving ? 'Menyimpan...' : 'Simpan Presensi'}
                    </button>
                  </div>
                )}
              </div>

            </div>
          )}

          {/* TAB 2: REKAPITULASI */}
          {activeTab === 'rekap' && (
            <div className="flex-1 flex flex-col min-h-0 space-y-3">
              
              {/* STAT CARDS */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 shrink-0">
                <div className="bg-white/90 backdrop-blur-md border border-slate-300 rounded-xl p-2.5 shadow-xs">
                  <p className="text-[10px] font-extrabold text-slate-500 uppercase">TOTAL DATA</p>
                  <p className="text-lg font-black text-slate-900 mt-0.5">{totalData}</p>
                </div>
                <div className="bg-white/90 backdrop-blur-md border border-emerald-200 rounded-xl p-2.5 shadow-xs">
                  <p className="text-[10px] font-extrabold text-emerald-700 uppercase">HADIR</p>
                  <p className="text-lg font-black text-emerald-900 mt-0.5">{totalHadir}</p>
                </div>
                <div className="bg-white/90 backdrop-blur-md border border-amber-200 rounded-xl p-2.5 shadow-xs">
                  <p className="text-[10px] font-extrabold text-amber-700 uppercase">IZIN</p>
                  <p className="text-lg font-black text-amber-900 mt-0.5">{totalIzin}</p>
                </div>
                <div className="bg-white/90 backdrop-blur-md border border-indigo-200 rounded-xl p-2.5 shadow-xs">
                  <p className="text-[10px] font-extrabold text-indigo-700 uppercase">SAKIT</p>
                  <p className="text-lg font-black text-indigo-900 mt-0.5">{totalSakit}</p>
                </div>
                <div className="bg-white/90 backdrop-blur-md border border-rose-200 rounded-xl p-2.5 shadow-xs">
                  <p className="text-[10px] font-extrabold text-rose-700 uppercase">ALPA</p>
                  <p className="text-lg font-black text-rose-900 mt-0.5">{totalAlpa}</p>
                </div>
              </div>

              {/* FILTER BAR REKAP */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 bg-gradient-to-br from-indigo-100/90 via-slate-100/90 to-indigo-50/90 backdrop-blur-md border border-indigo-200/80 p-3 rounded-2xl shrink-0 shadow-xs">
                <div>
                  <label className="block text-[10px] font-extrabold text-indigo-950 uppercase mb-1">FILTER KELAS</label>
                  <select
                    value={filterKelasId}
                    onChange={(e) => setFilterKelasId(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-2.5 py-1 text-xs text-slate-900 font-bold focus:outline-none"
                  >
                    <option value="">Semua Kelas</option>
                    {kelasList.map((k) => (
                      <option key={k.id} value={k.id}>{k.nama}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold text-indigo-950 uppercase mb-1">FILTER MAPEL</label>
                  <select
                    value={filterMapelId}
                    onChange={(e) => setFilterMapelId(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-2.5 py-1 text-xs text-slate-900 font-bold focus:outline-none"
                  >
                    <option value="">Semua Mapel</option>
                    {mapelList.map((m) => (
                      <option key={m.id} value={m.id}>{m.nama}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold text-indigo-950 uppercase mb-1">FILTER TANGGAL</label>
                  <input
                    type="date"
                    value={filterTanggal}
                    onChange={(e) => setFilterTanggal(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-2.5 py-1 text-xs text-slate-900 font-bold focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold text-indigo-950 uppercase mb-1">CARI SISWA</label>
                  <input
                    type="text"
                    value={searchNama}
                    onChange={(e) => setSearchNama(e.target.value)}
                    placeholder="Nama siswa..."
                    className="w-full bg-white border border-slate-300 rounded-xl px-2.5 py-1 text-xs text-slate-900 font-bold focus:outline-none"
                  />
                </div>
              </div>

              {/* TABEL REKAP */}
              <div className="bg-gradient-to-br from-indigo-100/90 via-slate-100/90 to-indigo-50/90 backdrop-blur-md border border-indigo-200/80 rounded-2xl p-3.5 flex-1 flex flex-col min-h-0 shadow-sm overflow-hidden">
                <div className="flex-1 overflow-y-auto rounded-xl border border-indigo-200/80 bg-white/90">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className="sticky top-0 bg-indigo-100 z-10 shadow-xs">
                      <tr className="text-indigo-950 border-b border-indigo-200 font-extrabold uppercase text-[11px]">
                        <th className="py-2.5 px-3 w-12 text-center">NO</th>
                        <th className="py-2.5 px-3">TANGGAL</th>
                        <th className="py-2.5 px-3">KELAS</th>
                        <th className="py-2.5 px-3">MATA PELAJARAN</th>
                        <th className="py-2.5 px-3">NAMA SISWA</th>
                        <th className="py-2.5 px-3 text-center">STATUS</th>
                        <th className="py-2.5 px-3 text-center w-20">AKSI</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-slate-800">
                      {loadingRekap ? (
                        <tr>
                          <td colSpan={7} className="py-10 text-center text-slate-600 font-medium">Memuat riwayat presensi...</td>
                        </tr>
                      ) : rekapList.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-10 text-center text-slate-600 font-medium">Tidak ada riwayat presensi ditemukan.</td>
                        </tr>
                      ) : (
                        rekapList.map((item, index) => (
                          <tr key={item.id || index} className="hover:bg-indigo-50/60 transition">
                            <td className="py-2 px-3 text-center font-bold text-slate-500">{index + 1}</td>
                            <td className="py-2 px-3 font-mono font-bold text-slate-700">{item.tanggal}</td>
                            <td className="py-2 px-3 font-extrabold text-slate-900">{item.kelas}</td>
                            <td className="py-2 px-3 font-extrabold text-indigo-950">{item.mapel}</td>
                            <td className="py-2 px-3 font-extrabold text-slate-900">{item.nama_siswa}</td>
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

        {/* FOOTER BADGE */}
        <div className="pb-16 pt-1 flex justify-center shrink-0 print:hidden">
          <div className="bg-slate-100/90 border border-slate-300 px-4 py-0.5 rounded-full text-center text-[10px] text-slate-700 font-medium shadow-xs">
            <span>Aplikasi Guru AI</span>
            <span className="mx-2">•</span>
            <span>Created by <strong className="text-emerald-900 font-bold">MUZAINI AL KAHFI</strong></span>
          </div>
        </div>

      </div>

      {/* BOTTOM NAVIGATION DOCK */}
      <div className="border-t border-slate-300 bg-slate-100/95 backdrop-blur-md fixed bottom-0 left-0 right-0 z-50 shadow-lg shrink-0 print:hidden">
        <div className="max-w-xl mx-auto px-4 py-2 flex items-center justify-between">
          <Link href="/" className="flex flex-col items-center gap-0.5 text-[11px] font-semibold text-slate-600 hover:text-slate-950 transition">
            <span className="text-base">🕒</span>
            <span>Dashboard</span>
          </Link>

          {isOperator && (
            <Link href="/siswa" className="flex flex-col items-center gap-0.5 text-[11px] font-semibold text-slate-600 hover:text-slate-950 transition">
              <span className="text-base">👥</span>
              <span>Siswa</span>
            </Link>
          )}

          {isOperator && (
            <Link href="/guru" className="flex flex-col items-center gap-0.5 text-[11px] font-semibold text-slate-600 hover:text-slate-950 transition">
              <span className="text-base">👨‍🏫</span>
              <span>Guru</span>
            </Link>
          )}

          <Link href="/absensi" className="flex flex-col items-center gap-0.5 text-[11px] font-bold text-indigo-600 transition">
            <span className="text-base">🎓</span>
            <span>Akademik</span>
          </Link>

          <Link href="/laporan" className="flex flex-col items-center gap-0.5 text-[11px] font-semibold text-slate-600 hover:text-slate-950 transition">
            <span className="text-base">🖨️</span>
            <span>Laporan</span>
          </Link>
        </div>
      </div>

    </div>
  )
}