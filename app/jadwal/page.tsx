'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'
import { useAuthRole } from '@/hooks/useAuthRole'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const supabase = createClient(supabaseUrl, supabaseAnonKey)

interface Jadwal {
  id?: string
  hari: string
  jam: string
  kelas: string
  mapel: string
  guru_email?: string
}

export default function JadwalMengajarPage() {
  const [userDisplayName, setUserDisplayName] = useState('GURU')
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'kelola' | 'rekap'>('kelola')
  
  // Custom Hook Hak Akses
  const { isOperator, canAccessBimbingan } = useAuthRole()
  
  // State Input & Kelola Jadwal
  const [hari, setHari] = useState('Senin')
  const [jam, setJam] = useState('07:30 - 09:00')
  const [kelas, setKelas] = useState('')
  const [mapel, setMapel] = useState('')
  const [jadwalList, setJadwalList] = useState<Jadwal[]>([])
  const [loading, setLoading] = useState(false)

  // State Filter Rekapitulasi Jadwal
  const [filterHari, setFilterHari] = useState('')
  const [filterKelas, setFilterKelas] = useState('')
  const [filterMapel, setFilterMapel] = useState('')

  useEffect(() => {
    async function initUser() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setUserEmail(user.email || null)
        const nameFromMeta = user.user_metadata?.full_name || user.email?.split('@')[0] || 'GURU'
        setUserDisplayName(nameFromMeta.toUpperCase())
        
        // Panggil fetchJadwal dengan email user
        fetchJadwal(user.email)
      }
    }
    
    initUser()

    // Realtime Listener
    const channel = supabase
      .channel('realtime_jadwal')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'jadwal' }, () => {
        supabase.auth.getUser().then(({ data: { user } }) => {
          if (user?.email) fetchJadwal(user.email)
        })
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  async function fetchJadwal(emailParam?: string | null) {
    const activeEmail = emailParam || userEmail
    if (!activeEmail) return

    setLoading(true)
    try {
      // HANYA AMBIL DATA JADWAL SESUAI EMAIL GURU YANG LOGIN
      const { data, error } = await supabase
        .from('jadwal')
        .select('*')
        .eq('guru_email', activeEmail)
        .order('id', { ascending: true })

      if (!error && data) {
        setJadwalList(data)
      }
    } catch (err) {
      console.error('Error fetching jadwal:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleSimpan = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!kelas || !mapel) {
      alert('Silakan pilih Kelas dan Mata Pelajaran!')
      return
    }

    if (!userEmail) {
      alert('Sesi login tidak valid. Silakan login ulang.')
      return
    }

    try {
      // SIMPAN JADWAL DENGAN MENYERTAKAN GURU_EMAIL
      const { error } = await supabase.from('jadwal').insert([
        {
          hari,
          jam: jam.trim(),
          kelas,
          mapel,
          guru_email: userEmail // <-- Menyimpan email penginput
        },
      ])

      if (error) {
        alert('Gagal menyimpan jadwal: ' + error.message)
      } else {
        setKelas('')
        setMapel('')
        fetchJadwal(userEmail)
      }
    } catch (err: any) {
      alert('Error: ' + err.message)
    }
  }

  const handleDelete = async (id?: string) => {
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

  // Filter List untuk Rekapitulasi
  const filteredRekapList = jadwalList.filter((item) => {
    const matchHari = !filterHari || item.hari === filterHari
    const matchKelas = !filterKelas || item.kelas === filterKelas
    const matchMapel = !filterMapel || item.mapel === filterMapel
    return matchHari && matchKelas && matchMapel
  })

  // Hitung Akumulasi Statistik Rekapitulasi
  const totalJadwal = filteredRekapList.length
  const totalKelasDiajar = new Set(filteredRekapList.map(item => item.kelas)).size
  const totalMapelDiajar = new Set(filteredRekapList.map(item => item.mapel)).size
  const hariAktifMengajar = new Set(filteredRekapList.map(item => item.hari)).size

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 font-sans flex flex-col justify-between selection:bg-indigo-500 selection:text-white pb-32 relative">
      <div>
        {/* TOPBAR / HEADER */}
        <header className="bg-[#0b1222] border-b border-slate-800/80 px-6 py-3 flex items-center justify-between sticky top-0 z-50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-amber-400 text-slate-950 rounded-xl flex items-center justify-center font-black text-xl shadow-md shadow-amber-400/20">
              🎓
            </div>
            <div>
              <h1 className="font-bold text-base text-white leading-none">Aplikasi Guru AI</h1>
              <p className="text-[11px] text-sky-400 font-medium mt-1">Jadwal Mengajar Guru</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="bg-emerald-950/60 border border-emerald-500/30 text-emerald-400 text-xs font-medium px-3 py-1.5 rounded-full flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>Supabase Live</span>
            </div>

            <div className="bg-[#121c33] border border-slate-700/80 text-slate-200 text-xs font-bold px-3.5 py-1.5 rounded-xl flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-slate-700 text-slate-300 flex items-center justify-center text-[10px] font-bold">
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
            <Link href="/jadwal" className="bg-blue-600 text-white px-3.5 py-1.5 rounded-xl shadow-md font-semibold flex items-center gap-1.5">
              <span>🕒</span> Jadwal Mengajar
            </Link>
            <Link href="/absensi" className="bg-slate-800/60 text-slate-400 hover:text-white px-3.5 py-1.5 rounded-xl border border-slate-700/60 transition flex items-center gap-1.5">
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
          
          {/* TAB MODE BAR */}
          <div className="grid grid-cols-2 bg-[#0d1527] p-1.5 rounded-2xl border border-slate-800 max-w-2xl text-xs font-bold">
            <button
              onClick={() => setActiveTab('kelola')}
              className={`py-2.5 rounded-xl transition flex items-center justify-center gap-2 cursor-pointer ${
                activeTab === 'kelola' ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30' : 'text-slate-400 hover:text-white'
              }`}
            >
              <span>🕒</span> Tambah &amp; Kelola Jadwal
            </button>
            <button
              onClick={() => setActiveTab('rekap')}
              className={`py-2.5 rounded-xl transition flex items-center justify-center gap-2 cursor-pointer ${
                activeTab === 'rekap' ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30' : 'text-slate-400 hover:text-white'
              }`}
            >
              <span>📜</span> Riwayat &amp; Rekapitulasi Jadwal
            </button>
          </div>

          {/* TAB CONTENT 1: TAMBAH & KELOLA JADWAL */}
          {activeTab === 'kelola' && (
            <div className="bg-[#0d1527] border border-slate-800/80 rounded-2xl p-6 min-h-[420px] space-y-6">
              <div className="space-y-6">
                <div className="flex items-center gap-3 border-b border-slate-800/80 pb-5">
                  <div className="w-10 h-10 bg-amber-950/80 text-amber-400 rounded-xl flex items-center justify-center text-lg">
                    🕒
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white">Jadwal Mengajar Anda</h2>
                    <p className="text-xs text-slate-400">
                      Atur jam tatap muka harian per kelas dan mata pelajaran.
                    </p>
                  </div>
                </div>

                <form
                  onSubmit={handleSimpan}
                  className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end bg-[#070b14] border border-slate-800/80 p-4 rounded-xl"
                >
                  <div className="md:col-span-2">
                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                      HARI *
                    </label>
                    <select
                      value={hari}
                      onChange={(e) => setHari(e.target.value)}
                      className="w-full bg-[#0d1527] border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500 cursor-pointer"
                    >
                      <option value="Senin">Senin</option>
                      <option value="Selasa">Selasa</option>
                      <option value="Rabu">Rabu</option>
                      <option value="Kamis">Kamis</option>
                      <option value="Sabtu">Sabtu</option>
                      <option value="Minggu">Minggu</option>
                    </select>
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                      JAM (WIB) *
                    </label>
                    <input
                      type="text"
                      value={jam}
                      onChange={(e) => setJam(e.target.value)}
                      placeholder="07:30 - 09:00"
                      className="w-full bg-[#0d1527] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500 font-mono"
                      required
                    />
                  </div>

                  <div className="md:col-span-3">
                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                      KELAS *
                    </label>
                    <select
                      value={kelas}
                      onChange={(e) => setKelas(e.target.value)}
                      className="w-full bg-[#0d1527] border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500 cursor-pointer"
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

                  <div className="md:col-span-3">
                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                      MATA PELAJARAN *
                    </label>
                    <select
                      value={mapel}
                      onChange={(e) => setMapel(e.target.value)}
                      className="w-full bg-[#0d1527] border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500 cursor-pointer"
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

                  <div className="md:col-span-2">
                    <button
                      type="submit"
                      className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-2.5 rounded-xl text-xs transition shadow-lg shadow-blue-600/20 flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <span>+ Simpan</span>
                    </button>
                  </div>
                </form>

                <div className="overflow-x-auto rounded-xl border border-slate-800/80">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-[#070b14] text-slate-400 border-b border-slate-800 font-bold uppercase tracking-wider">
                        <th className="py-3 px-4">HARI</th>
                        <th className="py-3 px-4">JAM MENGAJAR</th>
                        <th className="py-3 px-4">KELAS</th>
                        <th className="py-3 px-4">MATA PELAJARAN</th>
                        <th className="py-3 px-4 text-center w-24">AKSI</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-slate-300">
                      {loading ? (
                        <tr>
                          <td colSpan={5} className="py-12 text-center text-slate-400">
                            Memuat data jadwal mengajar...
                          </td>
                        </tr>
                      ) : jadwalList.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-16 text-center text-slate-500">
                            Belum ada jadwal mengajar.
                          </td>
                        </tr>
                      ) : (
                        jadwalList.map((item, index) => (
                          <tr key={item.id || index} className="hover:bg-slate-800/40 transition">
                            <td className="py-3 px-4 font-bold text-amber-400">{item.hari}</td>
                            <td className="py-3 px-4 font-mono text-slate-300">{item.jam}</td>
                            <td className="py-3 px-4 font-semibold text-white">
                              <span className="bg-slate-900 text-slate-200 px-2.5 py-1 rounded-md text-[11px] font-medium border border-slate-800">
                                {item.kelas}
                              </span>
                            </td>
                            <td className="py-3 px-4 font-medium text-sky-300">{item.mapel}</td>
                            <td className="py-3 px-4 text-center">
                              <button
                                onClick={() => handleDelete(item.id)}
                                className="bg-rose-950/60 text-rose-400 hover:bg-rose-900/80 p-1.5 rounded-lg border border-rose-800/50 transition cursor-pointer"
                                title="Hapus Jadwal"
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

          {/* TAB CONTENT 2: RIWAYAT & REKAPITULASI JADWAL */}
          {activeTab === 'rekap' && (
            <div className="bg-[#0d1527] border border-slate-800/80 rounded-2xl p-6 min-h-[480px] space-y-6">
              
              {/* Header Title Section */}
              <div className="flex items-center gap-3 border-b border-slate-800/80 pb-5">
                <div className="w-10 h-10 bg-indigo-950/80 text-indigo-400 rounded-xl flex items-center justify-center text-lg">
                  📜
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">Riwayat &amp; Rekapitulasi Jadwal Mengajar</h2>
                  <p className="text-xs text-slate-400">
                    Rekapitulasi lengkap jadwal tatap muka. Anda dapat mengedit, menyimpan pembaruan, atau menghapus entri jadwal.
                  </p>
                </div>
              </div>

              {/* STAT CARDS REKAPITULASI JADWAL */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-[#070b14] border border-slate-800/80 rounded-xl p-4">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">TOTAL JADWAL</p>
                  <p className="text-2xl font-extrabold text-white mt-1">{totalJadwal}</p>
                </div>
                <div className="bg-[#070b14] border border-blue-900/40 rounded-xl p-4">
                  <p className="text-[10px] font-bold text-blue-400 uppercase tracking-wider">TOTAL KELAS DIAJAR</p>
                  <p className="text-2xl font-extrabold text-blue-400 mt-1">{totalKelasDiajar}</p>
                </div>
                <div className="bg-[#070b14] border border-indigo-900/40 rounded-xl p-4">
                  <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">TOTAL MAPEL DIAJAR</p>
                  <p className="text-2xl font-extrabold text-indigo-400 mt-1">{totalMapelDiajar}</p>
                </div>
                <div className="bg-[#070b14] border border-amber-900/40 rounded-xl p-4">
                  <p className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">HARI AKTIF MENGAJAR</p>
                  <p className="text-2xl font-extrabold text-amber-400 mt-1">{hariAktifMengajar}</p>
                </div>
              </div>

              {/* FILTER BAR 3 DROPDOWN */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-[#070b14] border border-slate-800/80 p-4 rounded-xl">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                    FILTER HARI
                  </label>
                  <select
                    value={filterHari}
                    onChange={(e) => setFilterHari(e.target.value)}
                    className="w-full bg-[#0d1527] border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500 cursor-pointer"
                  >
                    <option value="">Semua Hari</option>
                    <option value="Senin">Senin</option>
                    <option value="Selasa">Selasa</option>
                    <option value="Rabu">Rabu</option>
                    <option value="Kamis">Kamis</option>
                    <option value="Sabtu">Sabtu</option>
                    <option value="Minggu">Minggu</option>
                  </select>
                </div>

                <div>
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

                <div>
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
              </div>

              {/* TABEL DATA REKAPITULASI JADWAL */}
              <div className="overflow-x-auto rounded-xl border border-slate-800/80">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-[#070b14] text-slate-400 border-b border-slate-800 font-bold uppercase tracking-wider">
                      <th className="py-3 px-4 w-12 text-center">NO</th>
                      <th className="py-3 px-4">HARI</th>
                      <th className="py-3 px-4">JAM MENGAJAR</th>
                      <th className="py-3 px-4">KELAS</th>
                      <th className="py-3 px-4">MATA PELAJARAN</th>
                      <th className="py-3 px-4 text-center w-24">AKSI</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-300">
                    {loading ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-slate-400">
                          Memuat data jadwal...
                        </td>
                      </tr>
                    ) : filteredRekapList.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-20 text-center text-slate-500">
                          Tidak ada data jadwal ditemukan.
                        </td>
                      </tr>
                    ) : (
                      filteredRekapList.map((item, index) => (
                        <tr key={item.id || index} className="hover:bg-slate-800/40 transition">
                          <td className="py-3 px-4 text-center font-medium text-slate-400">{index + 1}</td>
                          <td className="py-3 px-4 font-bold text-amber-400">{item.hari}</td>
                          <td className="py-3 px-4 font-mono text-slate-300">{item.jam}</td>
                          <td className="py-3 px-4 font-semibold text-white">
                            <span className="bg-slate-900 text-slate-200 px-2.5 py-1 rounded-md text-[11px] font-medium border border-slate-800">
                              {item.kelas}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-medium text-sky-300">{item.mapel}</td>
                          <td className="py-3 px-4 text-center">
                            <button
                              onClick={() => handleDelete(item.id)}
                              className="bg-rose-950/60 text-rose-400 hover:bg-rose-900/80 p-1.5 rounded-lg border border-rose-800/50 transition cursor-pointer"
                              title="Hapus Jadwal"
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
          <Link href="/" className="flex flex-col items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-300 transition">
            <span className="text-lg">🕒</span>
            <span>Dashboard</span>
          </Link>

          {isOperator && (
            <Link href="/siswa" className="flex flex-col items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-300 transition">
              <span className="text-lg">👥</span>
              <span>Siswa</span>
            </Link>
          )}

          {isOperator && (
            <Link href="/guru" className="flex flex-col items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-300 transition">
              <span className="text-lg">👨‍🏫</span>
              <span>Guru</span>
            </Link>
          )}

          <Link href="/jadwal" className="flex flex-col items-center gap-1 text-xs font-bold text-sky-400 transition">
            <span className="text-lg">🎓</span>
            <span>Akademik</span>
          </Link>

          <Link href="/ai" className="flex flex-col items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-300 transition">
            <span className="text-lg">✨</span>
            <span>AI Tools</span>
          </Link>

          <Link href="/laporan" className="flex flex-col items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-300 transition">
            <span className="text-lg">🖨️</span>
            <span>Laporan</span>
          </Link>
        </div>
      </div>
    </div>
  )
}