'use client'

import { useState, useEffect } from 'react'
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

interface NilaiRecord {
  id?: string
  created_at?: string
  siswa_id: string
  mata_pelajaran: string
  nilai_tugas?: number
  nilai_uts?: number
  nilai_uas?: number
  semester?: string
  tahun_ajaran?: string
  guru_email?: string
  siswa?: {
    nama_lengkap: string
    kelas?: {
      nama_kelas: string
    }
  }
}

interface NilaiMap {
  [siswaId: string]: number | ''
}

export default function PenilaianPage() {
  const [userDisplayName, setUserDisplayName] = useState('GURU')
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'input' | 'rekap'>('input')

  // Custom Hook Hak Akses
  const { isOperator, canAccessBimbingan } = useAuthRole()

  // State Input Nilai
  const [selectedKelas, setSelectedKelas] = useState('')
  const [selectedMapel, setSelectedMapel] = useState('')
  const [jenisPenilaian, setJenisPenilaian] = useState<'nilai_tugas' | 'nilai_uts' | 'nilai_uas'>('nilai_tugas')
  const [siswaList, setSiswaList] = useState<Siswa[]>([])
  const [nilaiInputMap, setNilaiInputMap] = useState<NilaiMap>({})
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  // State Riwayat & Rekapitulasi Nilai
  const [rekapList, setRekapList] = useState<NilaiRecord[]>([])
  const [filterKelas, setFilterKelas] = useState('')
  const [filterMapel, setFilterMapel] = useState('')
  const [searchNama, setSearchNama] = useState('')
  const [loadingRekap, setLoadingRekap] = useState(false)

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
        setNilaiInputMap({})
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
          const initialMap: NilaiMap = {}
          data.forEach((s) => {
            if (s.id) initialMap[s.id] = ''
          })
          setNilaiInputMap(initialMap)
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

  // Function Load Riwayat Nilai (DIFILTER BERDASARKAN GURU_EMAIL)
  const fetchRekap = async () => {
    if (!userEmail) return

    setLoadingRekap(true)
    try {
      let query = supabase
        .from('nilai')
        .select('*, siswa!inner(nama_lengkap, kelas!inner(nama_kelas))')
        .eq('guru_email', userEmail) // <-- Filter hanya milik guru yang login
        .order('created_at', { ascending: false })

      if (filterKelas) query = query.eq('siswa.kelas.nama_kelas', filterKelas)
      if (filterMapel) query = query.eq('mata_pelajaran', filterMapel)
      if (searchNama.trim()) query = query.ilike('siswa.nama_lengkap', `%${searchNama.trim()}%`)

      const { data, error } = await query

      if (!error && data) {
        setRekapList(data)
      } else {
        setRekapList([])
      }
    } catch (err) {
      console.error('Error fetching rekap nilai:', err)
    } finally {
      setLoadingRekap(false)
    }
  }

  // Realtime Listener Rekap Nilai
  useEffect(() => {
    if (activeTab === 'rekap' && userEmail) {
      fetchRekap()

      const channel = supabase
        .channel('realtime_nilai')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'nilai' }, () => {
          fetchRekap()
        })
        .subscribe()

      return () => {
        supabase.removeChannel(channel)
      }
    }
  }, [activeTab, filterKelas, filterMapel, searchNama, userEmail])

  const handleNilaiChange = (siswaId: string, value: string) => {
    const num = value === '' ? '' : Math.min(100, Math.max(0, Number(value)))
    setNilaiInputMap((prev) => ({
      ...prev,
      [siswaId]: num,
    }))
  }

  const handleSimpanNilai = async () => {
    if (!selectedKelas || !selectedMapel || !jenisPenilaian) {
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
      const rowsToInsert = siswaList
        .filter((siswa) => siswa.id && nilaiInputMap[String(siswa.id)] !== '')
        .map((siswa) => ({
          siswa_id: siswa.id,
          mata_pelajaran: selectedMapel,
          [jenisPenilaian]: Number(nilaiInputMap[String(siswa.id || '')]),
          semester: 'Ganjil',
          tahun_ajaran: '2026/2027',
          guru_email: userEmail // <-- Menyimpan email guru penginput
        }))

      if (rowsToInsert.length === 0) {
        alert('Silakan isi minimal satu nilai siswa!')
        setSaving(false)
        return
      }

      const { error } = await supabase.from('nilai').insert(rowsToInsert)

      if (error) {
        alert('Gagal menyimpan nilai: ' + error.message)
      } else {
        alert('Data nilai akademik berhasil disimpan!')
      }
    } catch (err: any) {
      alert('Terjadi kesalahan: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  // Akumulasi Statistik Rekapitulasi Nilai
  const totalEntri = rekapList.length

  return (
    <div className="min-h-screen bg-[#0b0f19] text-slate-100 font-sans flex flex-col justify-between selection:bg-indigo-500 selection:text-white pb-32 relative">
      <div>
        {/* TOPBAR / HEADER */}
        <header className="border-b border-slate-800/80 bg-[#0d1322]/90 backdrop-blur-md sticky top-0 z-50 px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-slate-400 hover:text-white p-2 rounded-lg transition">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </Link>
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 bg-amber-400 text-slate-950 rounded-xl flex items-center justify-center font-bold text-xl shadow-md shadow-amber-400/20">
                🎓
              </div>
              <div>
                <h1 className="font-bold text-base text-white leading-none">Aplikasi Guru AI</h1>
                <p className="text-[11px] text-sky-400 font-medium mt-1">Input Nilai Akademik Siswa</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="bg-emerald-950/60 border border-emerald-500/30 text-emerald-400 text-xs font-medium px-3 py-1.5 rounded-full flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>Supabase Live</span>
            </div>

            <div className="bg-slate-800/80 border border-slate-700/60 px-3.5 py-1.5 rounded-xl flex items-center gap-2 text-xs font-semibold text-slate-200">
              <span className="w-5 h-5 bg-indigo-600 text-white rounded-full flex items-center justify-center text-[10px] font-bold">
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
        <div className="bg-[#0d1322] border-b border-slate-800/80 px-6 py-2.5 overflow-x-auto">
          <div className="max-w-6xl mx-auto flex items-center gap-2 min-w-max text-xs font-medium">
            <span className="text-sky-400 font-bold flex items-center gap-1 pr-2 border-r border-slate-800">
              🎓 Akademik:
            </span>
            <Link href="/jadwal" className="bg-slate-800/60 text-slate-400 hover:text-white px-3.5 py-1.5 rounded-xl border border-slate-700/60 transition flex items-center gap-1.5">
              <span>🕒</span> Jadwal Mengajar
            </Link>
            <Link href="/absensi" className="bg-slate-800/60 text-slate-400 hover:text-white px-3.5 py-1.5 rounded-xl border border-slate-700/60 transition flex items-center gap-1.5">
              <span>📋</span> Input Absensi
            </Link>
            <Link href="/nilai" className="bg-blue-600 text-white px-3.5 py-1.5 rounded-xl shadow-md font-semibold flex items-center gap-1.5">
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
          <div className="grid grid-cols-2 bg-[#0d1322] p-1.5 rounded-2xl border border-slate-800 max-w-2xl text-xs font-bold">
            <button
              onClick={() => setActiveTab('input')}
              className={`py-2.5 rounded-xl transition flex items-center justify-center gap-2 cursor-pointer ${
                activeTab === 'input' ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30' : 'text-slate-400 hover:text-white'
              }`}
            >
              <span>⭐</span> Input Nilai Akademik
            </button>
            <button
              onClick={() => setActiveTab('rekap')}
              className={`py-2.5 rounded-xl transition flex items-center justify-center gap-2 cursor-pointer ${
                activeTab === 'rekap' ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30' : 'text-slate-400 hover:text-white'
              }`}
            >
              <span>📜</span> Riwayat &amp; Rekapitulasi Nilai
            </button>
          </div>

          {/* TAB CONTENT 1: INPUT NILAI AKADEMIK */}
          {activeTab === 'input' && (
            <div className="bg-[#111827] border border-slate-800/80 rounded-2xl p-6 min-h-[460px] space-y-6">
              <div className="space-y-6">
                <div className="flex items-center gap-3 border-b border-slate-800/80 pb-5">
                  <div className="w-10 h-10 bg-amber-950/80 text-amber-400 rounded-xl flex items-center justify-center text-lg">
                    ⭐
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white">Input Nilai Akademik Siswa</h2>
                    <p className="text-xs text-slate-400">
                      Kelola nilai Tugas, UTS, dan UAS per mata pelajaran.
                    </p>
                  </div>
                </div>

                {/* Form Parameter Filter */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end bg-[#0d1322]/80 border border-slate-800/80 p-4 rounded-xl">
                  <div className="md:col-span-4">
                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                      PILIH KELAS *
                    </label>
                    <select
                      value={selectedKelas}
                      onChange={(e) => setSelectedKelas(e.target.value)}
                      className="w-full bg-[#111827] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500 cursor-pointer"
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
                      className="w-full bg-[#111827] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500 cursor-pointer"
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

                  <div className="md:col-span-4">
                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                      JENIS PENILAIAN *
                    </label>
                    <select
                      value={jenisPenilaian}
                      onChange={(e: any) => setJenisPenilaian(e.target.value)}
                      className="w-full bg-[#111827] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500 cursor-pointer font-medium"
                    >
                      <option value="nilai_tugas">Nilai Tugas</option>
                      <option value="nilai_uts">Nilai UTS</option>
                      <option value="nilai_uas">Nilai UAS</option>
                    </select>
                  </div>
                </div>

                {/* Tabel Input Nilai Siswa */}
                <div className="overflow-x-auto rounded-xl border border-slate-800/80">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-[#0d1322] text-slate-400 border-b border-slate-800 font-bold uppercase tracking-wider">
                        <th className="py-3 px-4 w-12 text-center">NO</th>
                        <th className="py-3 px-4">NAMA LENGKAP SISWA</th>
                        <th className="py-3 px-4 text-right pr-8 w-48">INPUT NILAI (0-100)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-slate-300">
                      {!selectedKelas || !selectedMapel ? (
                        <tr>
                          <td colSpan={3} className="py-20 text-center text-slate-500">
                            Silakan pilih Kelas, Mapel, dan Jenis Penilaian terlebih dahulu.
                          </td>
                        </tr>
                      ) : loading ? (
                        <tr>
                          <td colSpan={3} className="py-12 text-center text-slate-400">
                            Memuat daftar siswa...
                          </td>
                        </tr>
                      ) : siswaList.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="py-16 text-center text-slate-500">
                            Belum ada siswa terdaftar di {selectedKelas}.
                          </td>
                        </tr>
                      ) : (
                        siswaList.map((siswa, index) => {
                          const sId = String(siswa.id || '')
                          return (
                            <tr key={sId || index} className="hover:bg-slate-800/40 transition">
                              <td className="py-3 px-4 text-center font-medium text-slate-400">{index + 1}</td>
                              <td className="py-3 px-4 font-semibold text-white">
                                {siswa.nama_lengkap}
                                <span className="block text-[10px] text-slate-500 font-mono font-normal">
                                  NISN: {siswa.nisn || '-'}
                                </span>
                              </td>
                              <td className="py-2 px-4 text-right pr-8">
                                <input
                                  type="number"
                                  min={0}
                                  max={100}
                                  value={nilaiInputMap[sId] ?? ''}
                                  onChange={(e) => handleNilaiChange(sId, e.target.value)}
                                  placeholder="0-100"
                                  className="w-28 bg-[#0d1322] border border-slate-800 rounded-xl px-3 py-2 text-right text-xs text-amber-400 font-bold focus:outline-none focus:border-amber-500"
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
                      onClick={handleSimpanNilai}
                      disabled={saving}
                      className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-6 py-3 rounded-xl text-xs transition shadow-lg shadow-blue-600/20 flex items-center gap-2 cursor-pointer"
                    >
                      <span>💾</span> {saving ? 'Menyimpan...' : 'Simpan Nilai ke Supabase'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB CONTENT 2: RIWAYAT & REKAPITULASI NILAI AKADEMIK */}
          {activeTab === 'rekap' && (
            <div className="bg-[#111827] border border-slate-800/80 rounded-2xl p-6 min-h-[480px] space-y-6">
              
              {/* Title Section */}
              <div className="flex items-center gap-3 border-b border-slate-800/80 pb-5">
                <div className="w-10 h-10 bg-indigo-950/80 text-indigo-400 rounded-xl flex items-center justify-center text-lg">
                  📜
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">Riwayat &amp; Rekapitulasi Nilai Akademik</h2>
                  <p className="text-xs text-slate-400">
                    Kelola, edit, dan rekap seluruh rekaman nilai siswa yang tersimpan di database.
                  </p>
                </div>
              </div>

              {/* STAT CARDS REKAPITULASI NILAI */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-sm">
                <div className="bg-[#0d1322] border border-slate-800/80 rounded-xl p-4">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">TOTAL ENTRI NILAI</p>
                  <p className="text-2xl font-extrabold text-white mt-1">{totalEntri}</p>
                </div>
              </div>

              {/* FILTER BAR REKAPITULASI */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-12 gap-3 bg-[#0d1322]/80 border border-slate-800/80 p-4 rounded-xl">
                <div className="md:col-span-4">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                    FILTER KELAS
                  </label>
                  <select
                    value={filterKelas}
                    onChange={(e) => setFilterKelas(e.target.value)}
                    className="w-full bg-[#111827] border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500 cursor-pointer"
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

                <div className="md:col-span-4">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                    FILTER MAPEL
                  </label>
                  <select
                    value={filterMapel}
                    onChange={(e) => setFilterMapel(e.target.value)}
                    className="w-full bg-[#111827] border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500 cursor-pointer"
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

                <div className="md:col-span-4">
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
                      className="w-full bg-[#111827] border border-slate-800 rounded-xl pl-8 pr-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* TABEL DATA REKAPITULASI NILAI */}
              <div className="overflow-x-auto rounded-xl border border-slate-800/80">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-[#0d1322] text-slate-400 border-b border-slate-800 font-bold uppercase tracking-wider">
                      <th className="py-3 px-4 w-12 text-center">NO</th>
                      <th className="py-3 px-4">TANGGAL</th>
                      <th className="py-3 px-4">NAMA SISWA</th>
                      <th className="py-3 px-4">MATA PELAJARAN</th>
                      <th className="py-3 px-4 text-center">NILAI TUGAS</th>
                      <th className="py-3 px-4 text-center">NILAI UTS</th>
                      <th className="py-3 px-4 text-center">NILAI UAS</th>
                      <th className="py-3 px-4 text-center w-24">AKSI</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-300">
                    {loadingRekap ? (
                      <tr>
                        <td colSpan={8} className="py-12 text-center text-slate-400">
                          Memuat riwayat nilai...
                        </td>
                      </tr>
                    ) : rekapList.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-20 text-center text-slate-500">
                          Tidak ada data nilai ditemukan.
                        </td>
                      </tr>
                    ) : (
                      rekapList.map((item, index) => (
                        <tr key={item.id || index} className="hover:bg-slate-800/40 transition">
                          <td className="py-3 px-4 text-center font-medium text-slate-400">{index + 1}</td>
                          <td className="py-3 px-4 font-mono text-slate-400 text-[11px]">
                            {item.created_at ? new Date(item.created_at).toLocaleDateString('id-ID') : '-'}
                          </td>
                          <td className="py-3 px-4 font-bold text-white">
                            {item.siswa?.nama_lengkap || '-'}
                            <span className="block text-[10px] text-slate-500 font-normal">
                              {item.siswa?.kelas?.nama_kelas}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-slate-300">{item.mata_pelajaran}</td>
                          <td className="py-3 px-4 text-center font-bold text-amber-400">
                            {item.nilai_tugas ?? '-'}
                          </td>
                          <td className="py-3 px-4 text-center font-bold text-sky-400">
                            {item.nilai_uts ?? '-'}
                          </td>
                          <td className="py-3 px-4 text-center font-bold text-emerald-400">
                            {item.nilai_uas ?? '-'}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <button
                              onClick={async () => {
                                if (item.id && confirm('Hapus entri nilai ini?')) {
                                  await supabase.from('nilai').delete().eq('id', item.id)
                                  setRekapList((prev) => prev.filter((r) => r.id !== item.id))
                                }
                              }}
                              className="bg-rose-950/60 text-rose-400 hover:bg-rose-900/80 p-1.5 rounded-lg border border-rose-800/50 transition cursor-pointer"
                              title="Hapus Nilai"
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
          <div className="pt-6 pb-2 flex justify-center">
            <div className="bg-[#10192e] border border-slate-800/80 px-5 py-2 rounded-full text-center text-xs text-slate-400 shadow-md">
              <span>Aplikasi Guru AI</span>
              <span className="mx-2">•</span>
              <span>Created by <strong className="text-sky-400 font-bold">MUZAINI AL KAHFI</strong></span>
            </div>
          </div>

        </main>
      </div>

      {/* BOTTOM NAVIGATION DOCK & FOOTER (KONDISIONAL ROLE) */}
      <div className="border-t border-slate-800/80 bg-[#0d1322]/95 backdrop-blur-md fixed bottom-0 left-0 right-0 z-50">
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
            href="/nilai"
            className="flex flex-col items-center gap-1 text-xs text-sky-400 font-bold transition"
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

        {/* Developer Attribution Sub-Footer */}
        <div className="bg-[#070a12] py-2 text-center text-[11px] text-slate-500 border-t border-slate-900 flex items-center justify-center gap-2">
          <span>Aplikasi Guru AI</span>
          <span>•</span>
          <span>Created by <strong className="text-slate-300 font-semibold">MUZAINI AL KAHFI</strong></span>
        </div>
      </div>
    </div>
  )
}