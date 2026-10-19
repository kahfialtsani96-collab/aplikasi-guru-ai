'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'
import { useAuthRole } from '@/hooks/useAuthRole'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const supabase = createClient(supabaseUrl, supabaseAnonKey)

interface JurnalRecord {
  id?: string
  created_at?: string
  tanggal: string
  jam_ke: string
  kelas: string
  mapel: string
  materi: string
  status: 'Terlaksana' | 'Tertunda'
  absen_siswa: string
  keterangan?: string
  guru_email?: string
}

export default function AgendaMengajarPage() {
  const [userDisplayName, setUserDisplayName] = useState('GURU')
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'input' | 'rekap'>('input')

  // Custom Hook Hak Akses
  const { isOperator, canAccessBimbingan } = useAuthRole()

  // State Input Jurnal Agenda
  const [tanggal, setTanggal] = useState('')
  const [jamKe, setJamKe] = useState('1-2')
  const [selectedKelas, setSelectedKelas] = useState('')
  const [selectedMapel, setSelectedMapel] = useState('')
  const [materi, setMateri] = useState('')
  const [status, setStatus] = useState<'Terlaksana' | 'Tertunda'>('Terlaksana')
  const [absenSiswa, setAbsenSiswa] = useState('Nihil')
  const [keterangan, setKeterangan] = useState('')

  const [jurnalList, setJurnalList] = useState<JurnalRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  // State Riwayat & Rekapitulasi Agenda
  const [rekapList, setRekapList] = useState<JurnalRecord[]>([])
  const [filterKelas, setFilterKelas] = useState('')
  const [filterMapel, setFilterMapel] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [searchMateri, setSearchMateri] = useState('')
  const [loadingRekap, setLoadingRekap] = useState(false)

  useEffect(() => {
    async function initUser() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setUserEmail(user.email || null)
        const nameFromMeta = user.user_metadata?.full_name || user.email?.split('@')[0] || 'GURU'
        setUserDisplayName(nameFromMeta.toUpperCase())
        
        // Load data awal dengan email user
        fetchJurnal(user.email)
      }
    }

    const todayStr = new Date().toISOString().split('T')[0]
    setTanggal(todayStr)

    initUser()
  }, [])

  // Load Jurnal Agenda (DIFILTER BERDASARKAN GURU_EMAIL)
  async function fetchJurnal(emailParam?: string | null) {
    const activeEmail = emailParam || userEmail
    if (!activeEmail) return

    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('jurnal_agenda')
        .select('*')
        .eq('guru_email', activeEmail) // <-- Filter email guru
        .order('created_at', { ascending: false })

      if (!error && data) {
        setJurnalList(data)
      }
    } catch (err) {
      console.error('Error fetching jurnal:', err)
    } finally {
      setLoading(false)
    }
  }

  // Load & Realtime Listener Rekapitulasi Jurnal (DIFILTER BERDASARKAN GURU_EMAIL)
  const fetchRekap = async () => {
    if (!userEmail) return

    setLoadingRekap(true)
    try {
      let query = supabase
        .from('jurnal_agenda')
        .select('*')
        .eq('guru_email', userEmail) // <-- Filter email guru
        .order('created_at', { ascending: false })

      if (filterKelas) query = query.eq('kelas', filterKelas)
      if (filterMapel) query = query.eq('mapel', filterMapel)
      if (filterStatus) query = query.eq('status', filterStatus)
      if (searchMateri.trim()) query = query.ilike('materi', `%${searchMateri.trim()}%`)

      const { data, error } = await query

      if (!error && data) {
        setRekapList(data)
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

      const channel = supabase
        .channel('realtime_jurnal_agenda')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'jurnal_agenda' }, () => {
          fetchRekap()
        })
        .subscribe()

      return () => {
        supabase.removeChannel(channel)
      }
    }
  }, [activeTab, filterKelas, filterMapel, filterStatus, searchMateri, userEmail])

  // Simpan Jurnal Agenda Baru
  const handleSimpanJurnal = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedKelas || !selectedMapel || !materi.trim() || !tanggal) {
      alert('Silakan lengkapi data Tanggal, Kelas, Mapel, dan Materi Pembelajaran!')
      return
    }

    if (!userEmail) {
      alert('Sesi login tidak valid. Silakan login ulang.')
      return
    }

    setSaving(true)
    try {
      const { error } = await supabase.from('jurnal_agenda').insert([
        {
          tanggal,
          jam_ke: jamKe.trim(),
          kelas: selectedKelas,
          mapel: selectedMapel,
          materi: materi.trim(),
          status,
          absen_siswa: absenSiswa.trim(),
          keterangan: keterangan.trim(),
          guru_email: userEmail // <-- Menyimpan email guru penginput
        },
      ])

      if (error) {
        alert('Gagal menyimpan jurnal: ' + error.message)
      } else {
        alert('Jurnal agenda mengajar berhasil disimpan!')
        setMateri('')
        setKeterangan('')
        fetchJurnal(userEmail)
      }
    } catch (err: any) {
      alert('Terjadi kesalahan: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteJurnal = async (id?: string) => {
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

  // Akumulasi Statistik Rekapitulasi Jurnal
  const totalJurnal = rekapList.length
  const totalTerlaksana = rekapList.filter((item) => item.status === 'Terlaksana').length
  const totalTertunda = rekapList.filter((item) => item.status === 'Tertunda').length

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
                <p className="text-[11px] text-sky-400 font-medium mt-1">Jurnal Agenda Mengajar</p>
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
            <Link href="/nilai" className="bg-slate-800/60 text-slate-400 hover:text-white px-3.5 py-1.5 rounded-xl border border-slate-700/60 transition flex items-center gap-1.5">
              <span>⭐</span> Input Penilaian
            </Link>
            <Link href="/jurnal" className="bg-blue-600 text-white px-3.5 py-1.5 rounded-xl shadow-md font-semibold flex items-center gap-1.5">
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
              <span>📅</span> Input Jurnal Agenda
            </button>
            <button
              onClick={() => setActiveTab('rekap')}
              className={`py-2.5 rounded-xl transition flex items-center justify-center gap-2 cursor-pointer ${
                activeTab === 'rekap' ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30' : 'text-slate-400 hover:text-white'
              }`}
            >
              <span>📜</span> Riwayat &amp; Rekapitulasi Agenda
            </button>
          </div>

          {/* TAB CONTENT 1: INPUT JURNAL AGENDA */}
          {activeTab === 'input' && (
            <div className="bg-[#111827] border border-slate-800/80 rounded-2xl p-6 min-h-[460px] space-y-6">
              <div className="space-y-6">
                <div className="flex items-center gap-3 border-b border-slate-800/80 pb-5">
                  <div className="w-10 h-10 bg-blue-950/80 text-blue-400 rounded-xl flex items-center justify-center text-lg">
                    📅
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white">Jurnal Agenda Mengajar Harian</h2>
                    <p className="text-xs text-slate-400">
                      Catat keterlaksanaan materi harian, jam ke, dan kendala siswa.
                    </p>
                  </div>
                </div>

                {/* Form Input Jurnal Agenda */}
                <form onSubmit={handleSimpanJurnal} className="bg-[#0d1322]/80 border border-slate-800/80 p-5 rounded-xl space-y-4">
                  {/* Row 1 */}
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                    <div className="md:col-span-3">
                      <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                        TANGGAL *
                      </label>
                      <input
                        type="date"
                        value={tanggal}
                        onChange={(e) => setTanggal(e.target.value)}
                        className="w-full bg-[#111827] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500 cursor-pointer"
                        required
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                        JAM KE *
                      </label>
                      <input
                        type="text"
                        value={jamKe}
                        onChange={(e) => setJamKe(e.target.value)}
                        placeholder="1-2"
                        className="w-full bg-[#111827] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                        required
                      />
                    </div>

                    <div className="md:col-span-3">
                      <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                        KELAS *
                      </label>
                      <select
                        value={selectedKelas}
                        onChange={(e) => setSelectedKelas(e.target.value)}
                        className="w-full bg-[#111827] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500 cursor-pointer"
                        required
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
                        MATA PELAJARAN *
                      </label>
                      <select
                        value={selectedMapel}
                        onChange={(e) => setSelectedMapel(e.target.value)}
                        className="w-full bg-[#111827] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500 cursor-pointer"
                        required
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

                  {/* Row 2 */}
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                    <div className="md:col-span-6">
                      <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                        MATERI PEMBELAJARAN *
                      </label>
                      <input
                        type="text"
                        value={materi}
                        onChange={(e) => setMateri(e.target.value)}
                        placeholder="Detail materi atau modul yang diajarkan"
                        className="w-full bg-[#111827] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                        required
                      />
                    </div>

                    <div className="md:col-span-3">
                      <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                        STATUS KETERLAKSANAAN
                      </label>
                      <select
                        value={status}
                        onChange={(e) => setStatus(e.target.value as 'Terlaksana' | 'Tertunda')}
                        className="w-full bg-[#111827] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500 cursor-pointer"
                      >
                        <option value="Terlaksana">Terlaksana</option>
                        <option value="Tertunda">Tertunda</option>
                      </select>
                    </div>

                    <div className="md:col-span-3">
                      <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                        ABSEN SISWA
                      </label>
                      <input
                        type="text"
                        value={absenSiswa}
                        onChange={(e) => setAbsenSiswa(e.target.value)}
                        placeholder="Nihil"
                        className="w-full bg-[#111827] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>

                  {/* Row 3 */}
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                    <div className="md:col-span-9">
                      <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                        KETERANGAN / CATATAN TAMBAHAN
                      </label>
                      <input
                        type="text"
                        value={keterangan}
                        onChange={(e) => setKeterangan(e.target.value)}
                        placeholder="Opsional (misal: diskusi kelompok lancar)"
                        className="w-full bg-[#111827] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                      />
                    </div>

                    <div className="md:col-span-3">
                      <button
                        type="submit"
                        disabled={saving}
                        className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-2.5 rounded-xl text-xs transition shadow-lg shadow-blue-600/20 flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <span>+ Simpan Jurnal</span>
                      </button>
                    </div>
                  </div>
                </form>

                {/* Tabel Data Jurnal Agenda */}
                <div className="overflow-x-auto rounded-xl border border-slate-800/80">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-[#0d1322] text-slate-400 border-b border-slate-800 font-bold uppercase tracking-wider">
                        <th className="py-3 px-4">TANGGAL</th>
                        <th className="py-3 px-4">JAM</th>
                        <th className="py-3 px-4">KELAS &amp; MAPEL</th>
                        <th className="py-3 px-4">MATERI PEMBELAJARAN</th>
                        <th className="py-3 px-4 text-center">STATUS</th>
                        <th className="py-3 px-4 text-center">ABSEN</th>
                        <th className="py-3 px-4 text-center w-24">AKSI</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-slate-300">
                      {loading ? (
                        <tr>
                          <td colSpan={7} className="py-12 text-center text-slate-400">
                            Memuat daftar agenda mengajar...
                          </td>
                        </tr>
                      ) : jurnalList.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-16 text-center text-slate-500">
                            Belum ada jurnal agenda mengajar.
                          </td>
                        </tr>
                      ) : (
                        jurnalList.map((item, index) => (
                          <tr key={item.id || index} className="hover:bg-slate-800/40 transition">
                            <td className="py-3 px-4 font-mono text-slate-300">{item.tanggal}</td>
                            <td className="py-3 px-4 font-mono text-slate-400">{item.jam_ke}</td>
                            <td className="py-3 px-4">
                              <span className="font-semibold text-white">{item.kelas}</span>
                              <span className="block text-[10px] text-sky-400">{item.mapel}</span>
                            </td>
                            <td className="py-3 px-4 font-medium text-slate-200">{item.materi}</td>
                            <td className="py-3 px-4 text-center">
                              <span
                                className={`px-2.5 py-1 rounded-md text-[10px] font-extrabold uppercase ${
                                  item.status === 'Terlaksana'
                                    ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/50'
                                    : 'bg-rose-950/80 text-rose-400 border border-rose-800/50'
                                }`}
                              >
                                {item.status}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-center text-slate-400">{item.absen_siswa}</td>
                            <td className="py-3 px-4 text-center">
                              <button
                                onClick={() => handleDeleteJurnal(item.id)}
                                className="bg-rose-950/60 text-rose-400 hover:bg-rose-900/80 p-1.5 rounded-lg border border-rose-800/50 transition cursor-pointer"
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

          {/* TAB CONTENT 2: RIWAYAT & REKAPITULASI JURNAL AGENDA */}
          {activeTab === 'rekap' && (
            <div className="bg-[#111827] border border-slate-800/80 rounded-2xl p-6 min-h-[480px] space-y-6">
              
              {/* Header Title Section */}
              <div className="flex items-center gap-3 border-b border-slate-800/80 pb-5">
                <div className="w-10 h-10 bg-indigo-950/80 text-indigo-400 rounded-xl flex items-center justify-center text-lg">
                  📜
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">Riwayat &amp; Rekapitulasi Jurnal Agenda</h2>
                  <p className="text-xs text-slate-400">
                    Rekapitulasi lengkap seluruh jurnal mengajar. Anda dapat mengedit, menyimpan pembaruan, atau menghapus entri.
                  </p>
                </div>
              </div>

              {/* STAT CARDS REKAPITULASI JURNAL */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-[#0d1322] border border-slate-800/80 rounded-xl p-4">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">TOTAL JURNAL</p>
                  <p className="text-2xl font-extrabold text-white mt-1">{totalJurnal}</p>
                </div>
                <div className="bg-[#0d1322] border border-emerald-900/40 rounded-xl p-4">
                  <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">TERLAKSANA</p>
                  <p className="text-2xl font-extrabold text-emerald-400 mt-1">{totalTerlaksana}</p>
                </div>
                <div className="bg-[#0d1322] border border-amber-900/40 rounded-xl p-4">
                  <p className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">TERTUNDA</p>
                  <p className="text-2xl font-extrabold text-amber-400 mt-1">{totalTertunda}</p>
                </div>
              </div>

              {/* FILTER BAR REKAPITULASI */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-12 gap-3 bg-[#0d1322]/80 border border-slate-800/80 p-4 rounded-xl">
                <div className="md:col-span-3">
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

                <div className="md:col-span-3">
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

                <div className="md:col-span-3">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                    FILTER STATUS
                  </label>
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="w-full bg-[#111827] border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500 cursor-pointer"
                  >
                    <option value="">Semua Status</option>
                    <option value="Terlaksana">Terlaksana</option>
                    <option value="Tertunda">Tertunda</option>
                  </select>
                </div>

                <div className="md:col-span-3">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                    CARI MATERI
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500 text-xs">
                      🔍
                    </span>
                    <input
                      type="text"
                      value={searchMateri}
                      onChange={(e) => setSearchMateri(e.target.value)}
                      placeholder="Ketik materi..."
                      className="w-full bg-[#111827] border border-slate-800 rounded-xl pl-8 pr-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* TABEL DATA REKAPITULASI JURNAL */}
              <div className="overflow-x-auto rounded-xl border border-slate-800/80">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-[#0d1322] text-slate-400 border-b border-slate-800 font-bold uppercase tracking-wider">
                      <th className="py-3 px-4 w-12 text-center">NO</th>
                      <th className="py-3 px-4">TANGGAL</th>
                      <th className="py-3 px-4">JAM</th>
                      <th className="py-3 px-4">KELAS &amp; MAPEL</th>
                      <th className="py-3 px-4">MATERI PEMBELAJARAN</th>
                      <th className="py-3 px-4 text-center">STATUS</th>
                      <th className="py-3 px-4 text-center">ABSEN</th>
                      <th className="py-3 px-4 text-center w-24">AKSI</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-300">
                    {loadingRekap ? (
                      <tr>
                        <td colSpan={8} className="py-12 text-center text-slate-400">
                          Memuat data riwayat agenda...
                        </td>
                      </tr>
                    ) : rekapList.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-20 text-center text-slate-500">
                          Tidak ada data jurnal agenda ditemukan.
                        </td>
                      </tr>
                    ) : (
                      rekapList.map((item, index) => (
                        <tr key={item.id || index} className="hover:bg-slate-800/40 transition">
                          <td className="py-3 px-4 text-center font-medium text-slate-400">{index + 1}</td>
                          <td className="py-3 px-4 font-mono text-slate-300">{item.tanggal}</td>
                          <td className="py-3 px-4 font-mono text-slate-400">{item.jam_ke}</td>
                          <td className="py-3 px-4">
                            <span className="font-semibold text-white">{item.kelas}</span>
                            <span className="block text-[10px] text-sky-400">{item.mapel}</span>
                          </td>
                          <td className="py-3 px-4 font-medium text-slate-200">{item.materi}</td>
                          <td className="py-3 px-4 text-center">
                            <span
                              className={`px-2.5 py-1 rounded-md text-[10px] font-extrabold uppercase ${
                                item.status === 'Terlaksana'
                                  ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/50'
                                  : 'bg-rose-950/80 text-rose-400 border border-rose-800/50'
                              }`}
                            >
                              {item.status}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center text-slate-400">{item.absen_siswa}</td>
                          <td className="py-3 px-4 text-center">
                            <button
                              onClick={() => handleDeleteJurnal(item.id)}
                              className="bg-rose-950/60 text-rose-400 hover:bg-rose-900/80 p-1.5 rounded-lg border border-rose-800/50 transition cursor-pointer"
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
          )}

          {/* BADGE COPYRIGHT TEKS NAMA MUZAINI AL KAHFI PERSIS DI BAWAH APLIKASI */}
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
            href="/jurnal"
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