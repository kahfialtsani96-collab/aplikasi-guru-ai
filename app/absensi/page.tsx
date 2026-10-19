'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'
import { useAuthRole } from '@/hooks/useAuthRole'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const supabase = createClient(supabaseUrl, supabaseAnonKey)

interface Siswa {
  id?: string
  nisn: string
  nama_lengkap: string
  kelas_id?: number
  kelas?: {
    nama_kelas: string
  }
}

interface AbsensiRecord {
  id?: string
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
  // Ubah 'input' | 'riwayat' menjadi tambahkan 'rekap'
  const [activeTab, setActiveTab] = useState<'input' | 'riwayat' | 'rekap'>('input')
  const [modeInput, setModeInput] = useState<'manual' | 'qr'>('manual')

  // Custom Hook Hak Akses
  const { isOperator, canAccessBimbingan } = useAuthRole()

  // Sediakan todayStr dan state tanggal
  const [tanggal, setTanggal] = useState('')
  const [todayStr, setTodayStr] = useState('')

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0]
    setTodayStr(today)
    setTanggal(today)
  }, [])
  const [selectedKelas, setSelectedKelas] = useState('')
  const [selectedMapel, setSelectedMapel] = useState('')
  const [siswaList, setSiswaList] = useState<Siswa[]>([])
  const [absensiMap, setAbsensiMap] = useState<StatusAbsensiMap>({})
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  // State Riwayat & Rekapitulasi Absensi
  const [rekapList, setRekapList] = useState<AbsensiRecord[]>([])
  const [filterKelas, setFilterKelas] = useState('')
  const [filterMapel, setFilterMapel] = useState('')
  const [filterTanggal, setFilterTanggal] = useState('')
  const [searchNama, setSearchNama] = useState('')
  const [loadingRekap, setLoadingRekap] = useState(false)

  // State & Ref QR Scanner
  const [scanMessage, setScanMessage] = useState<string | null>(null)
  const qrScannerRef = useRef<any>(null)

  useEffect(() => {
    async function getUserData() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setUserEmail(user.email || null)
        const nameFromMeta = user.user_metadata?.full_name || user.email?.split('@')[0] || 'GURU'
        setUserDisplayName(nameFromMeta.toUpperCase())
      }
    }

    getUserData()
  }, [])

  // Load Siswa JOIN Tabel Kelas
  useEffect(() => {
    async function fetchSiswa() {
      if (!selectedKelas) {
        setSiswaList([])
        setAbsensiMap({})
        return
      }

      setLoading(true)
      try {
        const { data, error } = await supabase
          .from('siswa')
          .select('*, kelas!inner(nama_kelas)')
          .eq('kelas.nama_kelas', selectedKelas)

        if (!error && data) {
          setSiswaList(data)
          const initialMap: StatusAbsensiMap = {}
          data.forEach((s) => {
            if (s.id) initialMap[s.id] = 'HADIR'
          })
          setAbsensiMap(initialMap)
        } else {
          console.error('Error query siswa:', error?.message)
          setSiswaList([])
        }
      } catch (err) {
        console.error('Error fetching siswa:', err)
      } finally {
        setLoading(false)
      }
    }

    if (activeTab === 'input') {
      fetchSiswa()
    }
  }, [selectedKelas, activeTab])

  // Inisialisasi Kamera QR Scanner saat Mode QR Aktif
  useEffect(() => {
    let html5QrCode: any = null

    if (modeInput === 'qr' && activeTab === 'input') {
      import('html5-qrcode').then(({ Html5Qrcode }) => {
        html5QrCode = new Html5Qrcode("reader")
        qrScannerRef.current = html5QrCode

        html5QrCode.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          (decodedText: string) => {
            handleQRScanned(decodedText)
          },
          () => {}
        ).catch((err: any) => {
          console.error("Gagal membuka kamera:", err)
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

  // Logika Pencocokan Hasil Scan QR (berdasarkan NISN atau ID)
  const handleQRScanned = (scannedText: string) => {
    const textClean = scannedText.trim()
    const targetSiswa = siswaList.find(
      (s) => s.nisn === textClean || String(s.id) === textClean
    )

    if (targetSiswa && targetSiswa.id) {
      setAbsensiMap((prev) => ({
        ...prev,
        [targetSiswa.id as string]: 'HADIR',
      }))
      setScanMessage(`✅ Berhasil: ${targetSiswa.nama_lengkap} (HADIR)`)
    } else {
      setScanMessage(`⚠️ Siswa dengan Kode/NISN: "${textClean}" tidak ditemukan di kelas ini.`)
    }

    setTimeout(() => setScanMessage(null), 3500)
  }

  // Function Load Riwayat Absensi (DIFILTER BERDASARKAN GURU_EMAIL)
  const fetchRekap = async () => {
    if (!userEmail) return

    setLoadingRekap(true)
    try {
      let query = supabase
        .from('absensi')
        .select('*')
        .eq('guru_email', userEmail) // <-- Menyaring hanya absensi milik guru yang login
        .order('created_at', { ascending: false })

      if (filterKelas) query = query.eq('kelas', filterKelas)
      if (filterMapel) query = query.eq('mapel', filterMapel)
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

  // Realtime Listener Rekap Absensi
  useEffect(() => {
    if (activeTab === 'rekap' && userEmail) {
      fetchRekap()

      const channel = supabase
        .channel('realtime_absensi')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'absensi' }, () => {
          fetchRekap()
        })
        .subscribe()

      return () => {
        supabase.removeChannel(channel)
      }
    }
  }, [activeTab, filterKelas, filterMapel, filterTanggal, searchNama, userEmail])

  const handleHadirSemua = () => {
    const updatedMap: StatusAbsensiMap = {}
    siswaList.forEach((s) => {
      if (s.id) updatedMap[s.id] = 'HADIR'
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
    if (!selectedKelas || !selectedMapel || !tanggal) {
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
      const rowsToInsert = siswaList.map((siswa) => ({
        tanggal,
        kelas: selectedKelas,
        mapel: selectedMapel,
        siswa_id: siswa.id,
        nama_siswa: siswa.nama_lengkap,
        nisn: siswa.nisn || '',
        status: absensiMap[siswa.id || ''] || 'HADIR',
        guru_email: userEmail // <-- Menyimpan email guru penginput
      }))

      // MENGGUNAKAN UPSERT AGAR ABSENSI SUSULAN/UPDATE PADA TANGGAL YANG SAMA TIDAK BENTROK
      const { error } = await supabase
        .from('absensi')
        .upsert(rowsToInsert, { onConflict: 'siswa_id,tanggal,mapel' })

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

  // Akumulasi Statistik Rekapitulasi
  const totalData = rekapList.length
  const totalHadir = rekapList.filter(item => item.status === 'HADIR').length
  const totalIzin = rekapList.filter(item => item.status === 'IZIN').length
  const totalSakit = rekapList.filter(item => item.status === 'SAKIT').length
  const totalAlpa = rekapList.filter(item => item.status === 'ALPA').length

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 font-sans flex flex-col justify-between selection:bg-indigo-500 selection:text-white pb-32 relative">
      <div>
        {/* TOPBAR / HEADER */}
        <header className="bg-[#0b1222] border-b border-slate-800/80 px-6 py-3 flex items-center justify-between sticky top-0 z-50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-amber-400 text-slate-950 rounded-xl flex items-center justify-center font-bold text-xl shadow-md shadow-amber-400/20">
              🎓
            </div>
            <div>
              <h1 className="font-bold text-base text-white leading-none">Aplikasi Guru AI</h1>
              <p className="text-[11px] text-sky-400 font-medium mt-1">Input Absensi Harian &amp; QR Scanner</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="bg-emerald-950/60 border border-emerald-500/30 text-emerald-400 text-xs font-medium px-3 py-1.5 rounded-full flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>Supabase Live</span>
            </div>

            <div className="bg-[#121c33] border border-slate-700/80 text-slate-200 text-xs font-bold px-3.5 py-1.5 rounded-xl flex items-center gap-2">
              <span className="w-5 h-5 bg-slate-700 text-slate-300 rounded-full flex items-center justify-center text-[10px] font-bold">
                {userDisplayName.charAt(0)}
              </span>
              <span>{userDisplayName}</span>
            </div>

            <button
              onClick={async () => {
                await supabase.auth.signOut()
                window.location.href = '/login'
              }}
              className="bg-rose-950/40 border border-rose-800/50 hover:bg-rose-900/60 text-rose-400 p-2 rounded-xl transition cursor-pointer"
              title="Keluar"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </header>

        {/* SUB-NAVBAR AKADEMIK */}
        <div className="bg-[#0b1222]/80 border-b border-slate-800/80 px-6 py-2.5 overflow-x-auto">
          <div className="max-w-6xl mx-auto flex items-center gap-2 min-w-max text-xs font-medium">
            <span className="text-sky-400 font-bold flex items-center gap-1 pr-2 border-r border-slate-800">
              🎓 Akademik:
            </span>
            <Link href="/jadwal" className="bg-slate-800/60 text-slate-400 hover:text-white px-3.5 py-1.5 rounded-xl border border-slate-700/60 transition flex items-center gap-1.5">
              <span>🕒</span> Jadwal Mengajar
            </Link>
            <Link href="/absensi" className="bg-blue-600 text-white px-3.5 py-1.5 rounded-xl shadow-md font-semibold flex items-center gap-1.5">
              <span>📋</span> Input Absensi
            </Link>
            <Link href="/nilai" className="bg-slate-800/60 text-slate-400 hover:text-white px-3.5 py-1.5 rounded-xl border border-slate-700/60 transition flex items-center gap-1.5">
              <span>⭐</span> Input Penilaian
            </Link>
            <Link href="/jurnal" className="bg-slate-800/60 text-slate-400 hover:text-white px-3.5 py-1.5 rounded-xl border border-slate-700/60 transition flex items-center gap-1.5">
              <span>📓</span> Agenda Mengajar
            </Link>

            {/* TAB BIMBINGAN HANYA MUNCUL JIKA WALI KELAS / OPERATOR */}
            {canAccessBimbingan && (
              <Link href="/bimbingan" className="bg-slate-800/60 text-slate-400 hover:text-white px-3.5 py-1.5 rounded-xl border border-slate-700/60 transition flex items-center gap-1.5">
                <span>💖</span> Bimbingan Guru Wali
              </Link>
            )}
          </div>
        </div>

        {/* MAIN CONTENT */}
        <main className="max-w-6xl mx-auto p-6 space-y-6">
          
          {/* TAB MODE SWITCHER */}
          <div className="grid grid-cols-2 bg-[#0d1527] p-1.5 rounded-2xl border border-slate-800 max-w-2xl text-xs font-bold">
            <button
              onClick={() => setActiveTab('input')}
              className={`py-2.5 rounded-xl transition flex items-center justify-center gap-2 cursor-pointer ${
                activeTab === 'input' ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30' : 'text-slate-400 hover:text-white'
              }`}
            >
              <span>📋</span> Input Absensi Harian
            </button>
            <button
              onClick={() => setActiveTab('rekap')}
              className={`py-2.5 rounded-xl transition flex items-center justify-center gap-2 cursor-pointer ${
                activeTab === 'rekap' ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30' : 'text-slate-400 hover:text-white'
              }`}
            >
              <span>📜</span> Riwayat &amp; Rekapitulasi Absensi
            </button>
          </div>

          {/* TAB CONTENT 1: INPUT ABSENSI HARIAN */}
          {activeTab === 'input' && (
            <div className="bg-[#0d1527] border border-slate-800/80 rounded-2xl p-6 min-h-[460px] space-y-6">
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-950/80 text-blue-400 rounded-xl flex items-center justify-center text-lg">
                      📋
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-white">Input Absensi Harian Siswa</h2>
                      <p className="text-xs text-slate-400">
                        Catat presensi harian secara manual atau otomatis menggunakan QR Scanner Kamera.
                      </p>
                    </div>
                  </div>

                  <div className="bg-[#070b14] p-1 rounded-xl border border-slate-800 flex items-center text-xs font-semibold">
                    <button
                      onClick={() => setModeInput('manual')}
                      className={`px-3.5 py-1.5 rounded-lg transition cursor-pointer ${
                        modeInput === 'manual' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Input Manual
                    </button>
                    <button
                      onClick={() => setModeInput('qr')}
                      className={`px-3.5 py-1.5 rounded-lg transition flex items-center gap-1.5 cursor-pointer ${
                        modeInput === 'qr' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <span>📷</span> Scan QR Kamera
                    </button>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end bg-[#070b14] border border-slate-800/80 p-4 rounded-xl">
                    <div className="md:col-span-4">
                      <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                        TANGGAL *
                      </label>
                      <input
                        type="date"
                        value={tanggal}
                        max={todayStr}
                        onChange={(e) => setTanggal(e.target.value)}
                        className="w-full bg-[#0d1527] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500 cursor-pointer"
                      />
                    </div>

                    <div className="md:col-span-4">
                      <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                        PILIH KELAS *
                      </label>
                      <select
                        value={selectedKelas}
                        onChange={(e) => setSelectedKelas(e.target.value)}
                        className="w-full bg-[#0d1527] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500 cursor-pointer"
                      >
                        <option value="">Pilih Kelas</option>
                        <option value="Kelas VII A">Kelas VII A</option>
                        <option value="Kelas VII B">Kelas VII B</option>
                        <option value="Kelas VIII A">Kelas VIII A</option>
                        <option value="Kelas VIII B">Kelas VIII B</option>
                        <option value="Kelas IX A">Kelas IX A</option>
                        <option value="Kelas IX B">Kelas IX B</option>
                      </select>
                    </div>

                    <div className="md:col-span-4">
                      <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                        PILIH MATA PELAJARAN *
                      </label>
                      <select
                        value={selectedMapel}
                        onChange={(e) => setSelectedMapel(e.target.value)}
                        className="w-full bg-[#0d1527] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500 cursor-pointer"
                      >
                        <option value="">Pilih Mapel</option>
                        <option value="Pendidikan Agama Islam dan Budi Pekerti">Pendidikan Agama Islam dan Budi Pekerti</option>
                        <option value="Pendidikan Pancasila">Pendidikan Pancasila</option>
                        <option value="Pembelajaran Berbasis Projek">Pembelajaran Berbasis Projek</option>
                        <option value="Bahasa Indonesia">Bahasa Indonesia</option>
                        <option value="Bahasa Inggris">Bahasa Inggris</option>
                        <option value="Matematika (Umum)">Matematika (Umum)</option>
                        <option value="Ilmu Pengetahuan Alam (IPA)">Ilmu Pengetahuan Alam (IPA)</option>
                        <option value="Ilmu Pengetahuan Sosial (IPS)">Ilmu Pengetahuan Sosial (IPS)</option>
                        <option value="Informatika">Informatika</option>
                        <option value="Pendidikan Jasmani, Olahraga, dan Kesehatan">Pendidikan Jasmani, Olahraga, dan Kesehatan</option>
                        <option value="Seni, Budaya dan Prakarya">Seni, Budaya dan Prakarya</option>
                        <option value="Bahasa Lampung (Mulok)">Bahasa Lampung (Mulok)</option>
                        <option value="Kejuruan Pertanian">Kejuruan Pertanian</option>
                        <option value="Bimbingan dan Konseling (BP/BK)">Bimbingan dan Konseling (BP/BK)</option>
                      </select>
                    </div>
                  </div>

                  {/* PANEL SCANNER QR KAMERA */}
                  {modeInput === 'qr' && (
                    <div className="bg-[#070b14] border border-blue-900/50 rounded-2xl p-6 flex flex-col items-center justify-center space-y-4">
                      <h3 className="text-xs font-bold text-sky-400 uppercase tracking-wider flex items-center gap-2">
                        <span>📷</span> Arahkan QR Code Kartu Pelajar Siswa ke Kamera
                      </h3>
                      
                      <div className="w-full max-w-sm overflow-hidden rounded-2xl border-2 border-blue-500/50 shadow-lg bg-black">
                        <div id="reader" className="w-full"></div>
                      </div>

                      {scanMessage && (
                        <div className="bg-slate-900 border border-slate-700 px-4 py-2 rounded-xl text-xs font-bold text-center">
                          {scanMessage}
                        </div>
                      )}
                    </div>
                  )}

                  {selectedKelas && selectedMapel && siswaList.length > 0 && (
                    <div className="flex justify-end pt-1">
                      <button
                        onClick={handleHadirSemua}
                        className="bg-emerald-900/60 border border-emerald-600/50 hover:bg-emerald-800/80 text-emerald-300 font-bold px-4 py-2 rounded-xl text-xs transition flex items-center gap-1.5 shadow-md cursor-pointer"
                      >
                        <span>👤</span> Hadir Semua
                      </button>
                    </div>
                  )}
                </div>

                <div className="overflow-x-auto rounded-xl border border-slate-800/80">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-[#070b14] text-slate-400 border-b border-slate-800 font-bold uppercase tracking-wider">
                        <th className="py-3 px-4 w-12 text-center">NO</th>
                        <th className="py-3 px-4">NAMA SISWA</th>
                        <th className="py-3 px-4 text-center w-24">HADIR</th>
                        <th className="py-3 px-4 text-center w-24">IZIN</th>
                        <th className="py-3 px-4 text-center w-24">SAKIT</th>
                        <th className="py-3 px-4 text-center w-24">ALPA</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-slate-300">
                      {!selectedKelas || !selectedMapel ? (
                        <tr>
                          <td colSpan={6} className="py-20 text-center text-slate-500">
                            Silakan pilih Tanggal, Kelas, dan Mata Pelajaran terlebih dahulu.
                          </td>
                        </tr>
                      ) : loading ? (
                        <tr>
                          <td colSpan={6} className="py-12 text-center text-slate-400">
                            Memuat daftar siswa...
                          </td>
                        </tr>
                      ) : siswaList.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-16 text-center text-slate-500">
                            Belum ada siswa terdaftar di {selectedKelas}.
                          </td>
                        </tr>
                      ) : (
                        siswaList.map((siswa, index) => {
                          const sId = String(siswa.id || '')
                          const currentStatus = absensiMap[sId] || 'HADIR'

                          return (
                            <tr key={sId || index} className="hover:bg-slate-800/40 transition">
                              <td className="py-3 px-4 text-center font-medium text-slate-400">{index + 1}</td>
                              <td className="py-3 px-4 font-semibold text-white">
                                {siswa.nama_lengkap}
                                <span className="block text-[10px] text-slate-500 font-mono font-normal">
                                  NISN: {siswa.nisn || '-'}
                                </span>
                              </td>
                              
                              <td className="py-3 px-4 text-center">
                                <input
                                  type="radio"
                                  name={`status-${sId}`}
                                  checked={currentStatus === 'HADIR'}
                                  onChange={() => handleStatusChange(sId, 'HADIR')}
                                  className="w-4 h-4 accent-emerald-500 cursor-pointer"
                                />
                              </td>

                              <td className="py-3 px-4 text-center">
                                <input
                                  type="radio"
                                  name={`status-${sId}`}
                                  checked={currentStatus === 'IZIN'}
                                  onChange={() => handleStatusChange(sId, 'IZIN')}
                                  className="w-4 h-4 accent-amber-500 cursor-pointer"
                                />
                              </td>

                              <td className="py-3 px-4 text-center">
                                <input
                                  type="radio"
                                  name={`status-${sId}`}
                                  checked={currentStatus === 'SAKIT'}
                                  onChange={() => handleStatusChange(sId, 'SAKIT')}
                                  className="w-4 h-4 accent-blue-500 cursor-pointer"
                                />
                              </td>

                              <td className="py-3 px-4 text-center">
                                <input
                                  type="radio"
                                  name={`status-${sId}`}
                                  checked={currentStatus === 'ALPA'}
                                  onChange={() => handleStatusChange(sId, 'ALPA')}
                                  className="w-4 h-4 accent-rose-500 cursor-pointer"
                                />
                              </td>
                            </tr>
                          )
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {selectedKelas && selectedMapel && siswaList.length > 0 && (
                  <div className="flex justify-end pt-2">
                    <button
                      onClick={handleSimpanAbsensi}
                      disabled={saving}
                      className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-6 py-3 rounded-xl text-xs transition shadow-lg shadow-blue-600/20 flex items-center gap-2 cursor-pointer"
                    >
                      <span>💾</span> {saving ? 'Menyimpan...' : 'Simpan Absensi ke Supabase'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB CONTENT 2: RIWAYAT & REKAPITULASI ABSENSI */}
          {activeTab === 'rekap' && (
            <div className="bg-[#0d1527] border border-slate-800/80 rounded-2xl p-6 min-h-[480px] space-y-6">
              
              {/* Title Section */}
              <div className="flex items-center gap-3 border-b border-slate-800/80 pb-5">
                <div className="w-10 h-10 bg-indigo-950/80 text-indigo-400 rounded-xl flex items-center justify-center text-lg">
                  📜
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">Riwayat &amp; Rekapitulasi Presensi Siswa</h2>
                  <p className="text-xs text-slate-400">
                    Kelola, edit, dan rekap seluruh data presensi harian siswa yang tersimpan di database.
                  </p>
                </div>
              </div>

              {/* STAT CARDS REKAPITULASI */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <div className="bg-[#070b14] border border-slate-800/80 rounded-xl p-4">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">TOTAL DATA</p>
                  <p className="text-xl font-extrabold text-white mt-1">{totalData}</p>
                </div>
                <div className="bg-[#070b14] border border-emerald-900/40 rounded-xl p-4">
                  <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">HADIR</p>
                  <p className="text-xl font-extrabold text-emerald-400 mt-1">{totalHadir}</p>
                </div>
                <div className="bg-[#070b14] border border-amber-900/40 rounded-xl p-4">
                  <p className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">IZIN</p>
                  <p className="text-xl font-extrabold text-amber-400 mt-1">{totalIzin}</p>
                </div>
                <div className="bg-[#070b14] border border-blue-900/40 rounded-xl p-4">
                  <p className="text-[10px] font-bold text-blue-400 uppercase tracking-wider">SAKIT</p>
                  <p className="text-xl font-extrabold text-blue-400 mt-1">{totalSakit}</p>
                </div>
                <div className="bg-[#070b14] border border-rose-900/40 rounded-xl p-4">
                  <p className="text-[10px] font-bold text-rose-400 uppercase tracking-wider">ALPA</p>
                  <p className="text-xl font-extrabold text-rose-400 mt-1">{totalAlpa}</p>
                </div>
              </div>

              {/* FILTER BAR REKAPITULASI */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-12 gap-3 bg-[#070b14] border border-slate-800/80 p-4 rounded-xl">
                <div className="md:col-span-3">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                    FILTER KELAS
                  </label>
                  <select
                    value={filterKelas}
                    onChange={(e) => setFilterKelas(e.target.value)}
                    className="w-full bg-[#0d1527] border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500 cursor-pointer"
                  >
                    <option value="">Semua Kelas</option>
                    <option value="Kelas VII A">Kelas VII A</option>
                    <option value="Kelas VII B">Kelas VII B</option>
                    <option value="Kelas VIII A">Kelas VIII A</option>
                    <option value="Kelas VIII B">Kelas VIII B</option>
                    <option value="Kelas IX A">Kelas IX A</option>
                    <option value="Kelas IX B">Kelas IX B</option>
                  </select>
                </div>

                <div className="md:col-span-3">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                    FILTER MAPEL
                  </label>
                  <select
                    value={filterMapel}
                    onChange={(e) => setFilterMapel(e.target.value)}
                    className="w-full bg-[#0d1527] border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500 cursor-pointer"
                  >
                    <option value="">Semua Mapel</option>
                    <option value="Pendidikan Agama Islam dan Budi Pekerti">Pendidikan Agama Islam dan Budi Pekerti</option>
                    <option value="Pendidikan Pancasila">Pendidikan Pancasila</option>
                    <option value="Pembelajaran Berbasis Projek">Pembelajaran Berbasis Projek</option>
                    <option value="Bahasa Indonesia">Bahasa Indonesia</option>
                    <option value="Bahasa Inggris">Bahasa Inggris</option>
                    <option value="Matematika (Umum)">Matematika (Umum)</option>
                    <option value="Ilmu Pengetahuan Alam (IPA)">Ilmu Pengetahuan Alam (IPA)</option>
                    <option value="Ilmu Pengetahuan Sosial (IPS)">Ilmu Pengetahuan Sosial (IPS)</option>
                    <option value="Informatika">Informatika</option>
                    <option value="Pendidikan Jasmani, Olahraga, dan Kesehatan">Pendidikan Jasmani, Olahraga, dan Kesehatan</option>
                    <option value="Seni, Budaya dan Prakarya">Seni, Budaya dan Prakarya</option>
                    <option value="Bahasa Lampung (Mulok)">Bahasa Lampung (Mulok)</option>
                    <option value="Kejuruan Pertanian">Kejuruan Pertanian</option>
                    <option value="Bimbingan dan Konseling (BP/BK)">Bimbingan dan Konseling (BP/BK)</option>
                  </select>
                </div>

                <div className="md:col-span-3">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                    FILTER TANGGAL
                  </label>
                  <input
                    type="date"
                    value={filterTanggal}
                    onChange={(e) => setFilterTanggal(e.target.value)}
                    className="w-full bg-[#0d1527] border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500 cursor-pointer"
                  />
                </div>

                <div className="md:col-span-3">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                    CARI NAMA SISWA
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500 text-xs">
                      🔍
                    </span>
                    <input
                      type="text"
                      value={searchNama}
                      onChange={(e) => setSearchNama(e.target.value)}
                      placeholder="Ketik nama..."
                      className="w-full bg-[#0d1527] border border-slate-800 rounded-xl pl-8 pr-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* TABEL DATA REKAPITULASI */}
              <div className="overflow-x-auto rounded-xl border border-slate-800/80">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-[#070b14] text-slate-400 border-b border-slate-800 font-bold uppercase tracking-wider">
                      <th className="py-3 px-4 w-12 text-center">NO</th>
                      <th className="py-3 px-4">TANGGAL</th>
                      <th className="py-3 px-4">KELAS</th>
                      <th className="py-3 px-4">MATA PELAJARAN</th>
                      <th className="py-3 px-4">NAMA SISWA</th>
                      <th className="py-3 px-4 text-center">STATUS</th>
                      <th className="py-3 px-4 text-center w-24">AKSI</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-300">
                    {loadingRekap ? (
                      <tr>
                        <td colSpan={7} className="py-12 text-center text-slate-400">
                          Memuat riwayat absensi...
                        </td>
                      </tr>
                    ) : rekapList.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-16 text-center text-slate-500">
                          Tidak ada riwayat absensi ditemukan.
                        </td>
                      </tr>
                    ) : (
                      rekapList.map((item, index) => (
                        <tr key={item.id || index} className="hover:bg-slate-800/40 transition">
                          <td className="py-3 px-4 text-center font-medium text-slate-400">{index + 1}</td>
                          <td className="py-3 px-4 font-mono text-slate-300">{item.tanggal}</td>
                          <td className="py-3 px-4 font-semibold text-white">{item.kelas}</td>
                          <td className="py-3 px-4 text-slate-300">{item.mapel}</td>
                          <td className="py-3 px-4 font-bold text-white">{item.nama_siswa}</td>
                          <td className="py-3 px-4 text-center">
                            <span
                              className={`px-2.5 py-1 rounded-md text-[10px] font-extrabold uppercase ${
                                item.status === 'HADIR'
                                  ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/50'
                                  : item.status === 'IZIN'
                                  ? 'bg-amber-950/80 text-amber-400 border border-amber-800/50'
                                  : item.status === 'SAKIT'
                                  ? 'bg-blue-950/80 text-blue-400 border border-blue-800/50'
                                  : 'bg-rose-950/80 text-rose-400 border border-rose-800/50'
                              }`}
                            >
                              {item.status}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <button
                              onClick={async () => {
                                if (item.id && confirm('Hapus record presensi ini?')) {
                                  await supabase.from('absensi').delete().eq('id', item.id)
                                  setRekapList(prev => prev.filter(r => r.id !== item.id))
                                }
                              }}
                              className="bg-rose-950/60 text-rose-400 hover:bg-rose-900/80 p-1.5 rounded-lg border border-rose-800/50 transition cursor-pointer"
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
          )}

          {/* BADGE COPYRIGHT FOOTER */}
          <div className="pt-8 pb-4 flex justify-center">
            <div className="bg-[#0b1222] border border-slate-800 px-6 py-2.5 rounded-full text-center text-xs text-slate-400 shadow-lg">
              <span>Aplikasi Guru AI</span>
              <span className="mx-2">•</span>
              <span>Created by <strong className="text-sky-400 font-bold">MUZAINI AL KAHFI</strong></span>
            </div>
          </div>

        </main>
      </div>

      {/* BOTTOM NAVIGATION DOCK (KONDISIONAL ROLE) */}
      <div className="border-t border-slate-800/80 bg-[#0b1222]/95 backdrop-blur-md fixed bottom-0 left-0 right-0 z-50">
        <div className="max-w-xl mx-auto px-4 py-2.5 flex items-center justify-between">
          <Link
            href="/"
            className="flex flex-col items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-300 transition"
          >
            <span className="text-lg">🕒</span>
            <span>Dashboard</span>
          </Link>

          {isOperator && (
            <Link
              href="/siswa"
              className="flex flex-col items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-300 transition"
            >
              <span className="text-lg">👥</span>
              <span>Siswa</span>
            </Link>
          )}

          {isOperator && (
            <Link
              href="/guru"
              className="flex flex-col items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-300 transition"
            >
              <span className="text-lg">👨‍🏫</span>
              <span>Guru</span>
            </Link>
          )}

          <Link
            href="/absensi"
            className="flex flex-col items-center gap-1 text-xs font-bold text-sky-400 transition"
          >
            <span className="text-lg">🎓</span>
            <span>Akademik</span>
          </Link>

          <Link
            href="/ai"
            className="flex flex-col items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-300 transition"
          >
            <span className="text-lg">✨</span>
            <span>AI Tools</span>
          </Link>

          <Link
            href="/laporan"
            className="flex flex-col items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-300 transition"
          >
            <span className="text-lg">🖨️</span>
            <span>Laporan</span>
          </Link>
        </div>
      </div>
    </div>
  )
}