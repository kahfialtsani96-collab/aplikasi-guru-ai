'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { useAuthRole } from '@/hooks/useAuthRole'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const supabase = createClient(supabaseUrl, supabaseAnonKey)

interface SiswaPerwalian {
  id?: string
  nama_lengkap: string
  nisn?: string
  jenis_kelamin?: string
  kelas_id?: number
  kelas?: {
    nama_kelas: string
  }
}

interface BimbinganRecord {
  id?: string
  created_at?: string
  tanggal: string
  nama_siswa: string
  kelas: string
  jenis_masalah: string
  masalah: string
  solusi: string
}

export default function BimbinganWaliPage() {
  const router = useRouter()
  const [userDisplayName, setUserDisplayName] = useState('GURU WALI')
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'input' | 'rekap'>('input')

  // State Kelas Binaan Khusus Wali Kelas
  const [assignedKelas, setAssignedKelas] = useState<string>('')
  const [assignedKelasId, setAssignedKelasId] = useState<number | null>(null)

  // Custom Hook Hak Akses
  const { isOperator, canAccessBimbingan, loading: loadingRole } = useAuthRole()

  // Redirect jika bukan Operator / Wali Kelas
  useEffect(() => {
    if (!loadingRole && !canAccessBimbingan) {
      router.push('/jadwal')
    }
  }, [loadingRole, canAccessBimbingan, router])

  // State Input Pendaftaran Perwalian
  const [namaPerwalian, setNamaPerwalian] = useState('')
  const [jenisKelaminPerwalian, setJenisKelaminPerwalian] = useState<'L' | 'P'>('L')
  const [listPerwalian, setListPerwalian] = useState<SiswaPerwalian[]>([])

  // State Input Catatan Bimbingan
  const [selectedSiswaId, setSelectedSiswaId] = useState('')
  const [selectedSiswaNama, setSelectedSiswaNama] = useState('')
  const [tanggal, setTanggal] = useState('')
  const [jenisMasalah, setJenisMasalah] = useState('Akademik')
  const [masalah, setMasalah] = useState('')
  const [solusi, setSolusi] = useState('')

  const [bimbinganList, setBimbinganList] = useState<BimbinganRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  // State Riwayat & Rekapitulasi Bimbingan
  const [rekapList, setRekapList] = useState<BimbinganRecord[]>([])
  const [filterJenis, setFilterJenis] = useState('')
  const [searchKataKunci, setSearchKataKunci] = useState('')
  const [loadingRekap, setLoadingRekap] = useState(false)

  useEffect(() => {
    async function initWaliPage() {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (user && user.email) {
        setUserEmail(user.email)
        const nameFromMeta = user.user_metadata?.full_name || user.email.split('@')[0]
        setUserDisplayName(nameFromMeta.toUpperCase())

        // 1. Cari ID Guru berdasarkan Email
        const { data: guruData } = await supabase
          .from('guru')
          .select('id')
          .eq('email', user.email)
          .single()

        if (guruData) {
          // 2. Cari Kelas binaannya dari tabel kelas
          const { data: kelasData } = await supabase
            .from('kelas')
            .select('id, nama_kelas')
            .eq('wali_kelas_id', guruData.id)
            .single()

          if (kelasData) {
            setAssignedKelas(kelasData.nama_kelas)
            setAssignedKelasId(kelasData.id)

            // 3. Load Siswa & Catatan Bimbingan KHUSUS Kelas Binaan ini
            fetchPerwalianAndBimbingan(kelasData.id, kelasData.nama_kelas)
          }
        }
      }
      setLoading(false)
    }

    const todayStr = new Date().toISOString().split('T')[0]
    setTanggal(todayStr)

    initWaliPage()
  }, [])

  // Fetch Siswa & Bimbingan Hanya untuk Kelas Binaan
  async function fetchPerwalianAndBimbingan(kelasId: number, namaKelas: string) {
    try {
      // Ambil Siswa yang terikat ke kelas_id milik Wali Kelas
      const { data: dataSiswa } = await supabase
        .from('siswa')
        .select('*, kelas(nama_kelas)')
        .eq('kelas_id', kelasId)
        .order('nama_lengkap', { ascending: true })

      if (dataSiswa) {
        setListPerwalian(dataSiswa)
      }

      // Ambil Bimbingan yang terikat ke nama_kelas milik Wali Kelas
      const { data: dataBimbingan } = await supabase
        .from('bimbingan_wali')
        .select('*')
        .eq('kelas', namaKelas)
        .order('created_at', { ascending: false })

      if (dataBimbingan) {
        setBimbinganList(dataBimbingan)
      }
    } catch (err) {
      console.error('Error fetching data bimbingan:', err)
    }
  }

  // Handle Pilih Siswa Dropdown
  const handleSelectSiswa = (siswaId: string) => {
    setSelectedSiswaId(siswaId)
    const target = listPerwalian.find((s) => String(s.id) === siswaId || s.nama_lengkap === siswaId)
    if (target) {
      setSelectedSiswaNama(target.nama_lengkap)
    } else {
      setSelectedSiswaNama('')
    }
  }

  // Tambahkan Siswa Perwalian Baru ke Kelas Binaan
  const handleTambahPerwalian = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!namaPerwalian.trim()) return

    if (!assignedKelasId) {
      alert('Sistem tidak menemukan kelas binaan Anda.')
      return
    }

    try {
      const { error } = await supabase.from('siswa').insert([
        {
          nama_lengkap: namaPerwalian.trim(),
          jenis_kelamin: jenisKelaminPerwalian,
          kelas_id: assignedKelasId, // Otomatis mengunci ke kelas binaan wali kelas
          nisn: 'PERWALIAN-' + Math.floor(1000 + Math.random() * 9000),
        },
      ])

      if (error) {
        alert('Gagal menambah perwalian: ' + error.message)
      } else {
        alert(`Siswa perwalian berhasil ditambahkan ke ${assignedKelas}!`)
        setNamaPerwalian('')
        if (assignedKelasId && assignedKelas) {
          fetchPerwalianAndBimbingan(assignedKelasId, assignedKelas)
        }
      }
    } catch (err: any) {
      alert('Error: ' + err.message)
    }
  }

  // Hapus Siswa Perwalian
  const handleDeleteSiswaPerwalian = async (id?: string) => {
    if (!id || !confirm('Hapus siswa ini dari daftar perwalian?')) return

    try {
      const { error } = await supabase.from('siswa').delete().eq('id', id)
      if (!error) {
        setListPerwalian((prev) => prev.filter((item) => String(item.id) !== String(id)))
        alert('Siswa berhasil dihapus!')
      } else {
        alert('Gagal menghapus siswa: ' + error.message)
      }
    } catch (err) {
      console.error('Error deleting siswa:', err)
    }
  }

  // Simpan Catatan Bimbingan
  const handleSimpanBimbingan = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedSiswaNama || !masalah.trim() || !tanggal) {
      alert('Silakan pilih Siswa dan isi Detail Masalah!')
      return
    }

    setSaving(true)
    try {
      const { error } = await supabase.from('bimbingan_wali').insert([
        {
          tanggal,
          nama_siswa: selectedSiswaNama,
          kelas: assignedKelas, // Otomatis tersimpan sebagai kelas binaan
          jenis_masalah: jenisMasalah,
          masalah: masalah.trim(),
          solusi: solusi.trim(),
        },
      ])

      if (error) {
        alert('Gagal menyimpan bimbingan: ' + error.message)
      } else {
        alert('Catatan bimbingan wali kelas berhasil disimpan!')
        setMasalah('')
        setSolusi('')
        setSelectedSiswaId('')
        setSelectedSiswaNama('')
        if (assignedKelasId && assignedKelas) {
          fetchPerwalianAndBimbingan(assignedKelasId, assignedKelas)
        }
      }
    } catch (err: any) {
      alert('Terjadi kesalahan: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  // Fetch Rekap Bimbingan Khusus Kelas Binaan
  const fetchRekap = async () => {
    if (!assignedKelas) return

    setLoadingRekap(true)
    try {
      let query = supabase
        .from('bimbingan_wali')
        .select('*')
        .eq('kelas', assignedKelas) // Hanya memuat rekap kelas binaan
        .order('created_at', { ascending: false })

      if (filterJenis) query = query.eq('jenis_masalah', filterJenis)
      if (searchKataKunci.trim()) {
        query = query.or(`nama_siswa.ilike.%${searchKataKunci.trim()}%,masalah.ilike.%${searchKataKunci.trim()}%`)
      }

      const { data, error } = await query

      if (!error && data) {
        setRekapList(data)
      } else {
        setRekapList([])
      }
    } catch (err) {
      console.error('Error fetching rekap bimbingan:', err)
    } finally {
      setLoadingRekap(false)
    }
  }

  useEffect(() => {
    if (activeTab === 'rekap' && assignedKelas) {
      fetchRekap()

      const channel = supabase
        .channel('realtime_bimbingan_wali')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'bimbingan_wali' }, () => {
          fetchRekap()
        })
        .subscribe()

      return () => {
        supabase.removeChannel(channel)
      }
    }
  }, [activeTab, filterJenis, searchKataKunci, assignedKelas])

  const handleDeleteBimbingan = async (id?: string) => {
    if (!id || !confirm('Hapus catatan bimbingan ini?')) return

    try {
      const { error } = await supabase.from('bimbingan_wali').delete().eq('id', id)
      if (!error) {
        setBimbinganList((prev) => prev.filter((item) => item.id !== id))
        setRekapList((prev) => prev.filter((item) => item.id !== id))
      }
    } catch (err) {
      console.error('Error deleting bimbingan:', err)
    }
  }

  // Tampilan Memuat / Ditolak Hak Akses
  if (loadingRole || !canAccessBimbingan) {
    return (
      <div className="min-h-screen bg-[#0b0f19] text-slate-400 p-8 flex items-center justify-center font-sans">
        <div className="bg-[#0d1322] border border-slate-800 p-6 rounded-2xl text-center space-y-2">
          <p className="text-white font-bold text-sm">Memeriksa Hak Akses Wali Kelas...</p>
          <p className="text-xs text-slate-500">Anda akan dialihkan jika tidak memiliki kewenangan.</p>
        </div>
      </div>
    )
  }

  // Akumulasi Statistik Rekapitulasi Bimbingan
  const totalBimbingan = rekapList.length
  const kasusAkademik = rekapList.filter((item) => item.jenis_masalah === 'Akademik').length
  const kasusPribadiKarakter = rekapList.filter((item) => item.jenis_masalah !== 'Akademik').length

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
                <p className="text-[11px] text-sky-400 font-medium mt-1">
                  Catatan Bimbingan Wali Kelas ({assignedKelas || 'Memuat...'})
                </p>
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
            <Link href="/jurnal" className="bg-slate-800/60 text-slate-400 hover:text-white px-3.5 py-1.5 rounded-xl border border-slate-700/60 transition flex items-center gap-1.5">
              <span>📓</span> Agenda Mengajar
            </Link>
            <Link href="/bimbingan" className="bg-blue-600 text-white px-3.5 py-1.5 rounded-xl shadow-md font-semibold flex items-center gap-1.5">
              <span>💖</span> Bimbingan Guru Wali
            </Link>
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
              <span>💖</span> Input Bimbingan Wali
            </button>
            <button
              onClick={() => setActiveTab('rekap')}
              className={`py-2.5 rounded-xl transition flex items-center justify-center gap-2 cursor-pointer ${
                activeTab === 'rekap' ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30' : 'text-slate-400 hover:text-white'
              }`}
            >
              <span>📜</span> Riwayat &amp; Rekapitulasi Bimbingan
            </button>
          </div>

          {/* TAB CONTENT 1: INPUT BIMBINGAN WALI */}
          {activeTab === 'input' && (
            <div className="bg-[#111827] border border-slate-800/80 rounded-2xl p-6 min-h-[480px] space-y-6">
              <div className="space-y-6">
                <div className="flex items-center gap-3 border-b border-slate-800/80 pb-5">
                  <div className="w-10 h-10 bg-rose-950/80 text-rose-400 rounded-xl flex items-center justify-center text-lg">
                    💖
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white">
                      Bimbingan Guru Wali {assignedKelas ? `- ${assignedKelas}` : ''}
                    </h2>
                    <p className="text-xs text-slate-400">
                      Pencatatan perkembangan karakter, akademik, dan penanganan khusus siswa perwalian {assignedKelas}.
                    </p>
                  </div>
                </div>

                {/* GRID DUA PANEL INPUT */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  
                  {/* PANEL KIRI: 1. DAFTAR SISWA PERWALIAN */}
                  <div className="lg:col-span-5 bg-[#0d1322]/80 border border-slate-800/80 p-5 rounded-xl space-y-4">
                    <h3 className="text-xs font-extrabold text-white uppercase tracking-wider">
                      1. DAFTAR SISWA PERWALIAN ({assignedKelas || '...'})
                    </h3>
                    
                    <form onSubmit={handleTambahPerwalian} className="space-y-3">
                      <div>
                        <input
                          type="text"
                          value={namaPerwalian}
                          onChange={(e) => setNamaPerwalian(e.target.value)}
                          placeholder="Nama Lengkap Siswa"
                          className="w-full bg-[#111827] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                          required
                        />
                      </div>
                      <div>
                        <select
                          value={jenisKelaminPerwalian}
                          onChange={(e) => setJenisKelaminPerwalian(e.target.value as 'L' | 'P')}
                          className="w-full bg-[#111827] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500 cursor-pointer"
                        >
                          <option value="L">Laki-laki (L)</option>
                          <option value="P">Perempuan (P)</option>
                        </select>
                      </div>
                      <div>
                        {/* INPUT KELAS TERKUNCI KHUSUS KELAS BINAAN */}
                        <input
                          type="text"
                          value={assignedKelas || 'Memuat Kelas...'}
                          disabled
                          className="w-full bg-[#111827]/60 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-sky-400 font-bold focus:outline-none cursor-not-allowed"
                        />
                      </div>
                      <button
                        type="submit"
                        className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 rounded-xl text-xs transition shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <span>+ Tambahkan Perwalian</span>
                      </button>
                    </form>

                    {/* LIST DAN TOMBOL HAPUS SISWA PERWALIAN */}
                    <div className="pt-2 border-t border-slate-800/80">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                        DAFTAR SISWA {assignedKelas} ({listPerwalian.length})
                      </p>
                      <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                        {listPerwalian.length === 0 ? (
                          <p className="text-xs text-slate-500 text-center py-3">Belum ada siswa di kelas {assignedKelas}.</p>
                        ) : (
                          listPerwalian.map((siswa, i) => (
                            <div
                              key={siswa.id || i}
                              className="bg-[#111827] border border-slate-800/80 px-3 py-2 rounded-xl flex items-center justify-between text-xs"
                            >
                              <div className="truncate pr-2">
                                <p className="font-semibold text-slate-200 truncate">{siswa.nama_lengkap}</p>
                                <p className="text-[10px] text-sky-400">
                                  {assignedKelas} ({siswa.jenis_kelamin || 'L'})
                                </p>
                              </div>
                              <button
                                onClick={() => handleDeleteSiswaPerwalian(siswa.id)}
                                className="bg-rose-950/60 text-rose-400 hover:bg-rose-900/80 p-1.5 rounded-lg border border-rose-800/50 transition shrink-0 cursor-pointer"
                                title="Hapus Siswa ini"
                              >
                                🗑️
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                  </div>

                  {/* PANEL KANAN: 2. CATATAN KASUS & SOLUSI BIMBINGAN */}
                  <div className="lg:col-span-7 bg-[#0d1322]/80 border border-slate-800/80 p-5 rounded-xl space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-extrabold text-white uppercase tracking-wider">
                        2. CATATAN KASUS &amp; SOLUSI BIMBINGAN
                      </h3>
                      <button
                        onClick={() => {
                          const customName = prompt('Masukkan Nama Siswa secara manual:')
                          if (customName) {
                            setSelectedSiswaNama(customName)
                          }
                        }}
                        className="text-[11px] text-sky-400 font-semibold hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <span>👤+</span> Input Manual Nama
                      </button>
                    </div>

                    <form onSubmit={handleSimpanBimbingan} className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                            PILIH SISWA ({assignedKelas}) *
                          </label>
                          <select
                            value={selectedSiswaId}
                            onChange={(e) => handleSelectSiswa(e.target.value)}
                            className="w-full bg-[#111827] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500 cursor-pointer"
                          >
                            <option value="">-- Pilih Siswa {assignedKelas} --</option>
                            {listPerwalian.map((siswa, i) => (
                              <option key={siswa.id || i} value={String(siswa.id || siswa.nama_lengkap)}>
                                {siswa.nama_lengkap} ({assignedKelas})
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                            KELAS (OTOMATIS TERKUNCI)
                          </label>
                          <input
                            type="text"
                            value={assignedKelas || 'Terisi otomatis'}
                            disabled
                            className="w-full bg-[#111827]/60 border border-slate-800/80 rounded-xl px-3.5 py-2.5 text-xs text-sky-400 font-bold cursor-not-allowed"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
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

                        <div>
                          <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                            JENIS MASALAH *
                          </label>
                          <select
                            value={jenisMasalah}
                            onChange={(e) => setJenisMasalah(e.target.value)}
                            className="w-full bg-[#111827] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500 cursor-pointer font-medium"
                          >
                            <option value="Akademik">Akademik</option>
                            <option value="Karakter/Sikap">Karakter / Sikap</option>
                            <option value="Kedisiplinan">Kedisiplinan</option>
                            <option value="Pribadi/Sosial">Pribadi / Sosial</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                          MASALAH / DESKRIPSI KASUS *
                        </label>
                        <textarea
                          rows={2}
                          value={masalah}
                          onChange={(e) => setMasalah(e.target.value)}
                          placeholder="Detail permasalahan siswa"
                          className="w-full bg-[#111827] border border-slate-800 rounded-xl p-3 text-xs text-slate-200 focus:outline-none focus:border-blue-500 resize-none"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                          SOLUSI / TINDAK LANJUT *
                        </label>
                        <textarea
                          rows={2}
                          value={solusi}
                          onChange={(e) => setSolusi(e.target.value)}
                          placeholder="Solusi, konseling, atau pemanggilan orang tua"
                          className="w-full bg-[#111827] border border-slate-800 rounded-xl p-3 text-xs text-slate-200 focus:outline-none focus:border-blue-500 resize-none"
                        />
                      </div>

                      <div className="flex justify-end pt-1">
                        <button
                          type="submit"
                          disabled={saving}
                          className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-6 py-2.5 rounded-xl text-xs transition shadow-lg shadow-blue-600/20 flex items-center gap-1.5 cursor-pointer"
                        >
                          <span>+ Simpan Catatan Bimbingan</span>
                        </button>
                      </div>
                    </form>
                  </div>

                </div>

                {/* TABEL PRATINJAU CATATAN BIMBINGAN */}
                <div className="overflow-x-auto rounded-xl border border-slate-800/80">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-[#0d1322] text-slate-400 border-b border-slate-800 font-bold uppercase tracking-wider">
                        <th className="py-3 px-4">TANGGAL</th>
                        <th className="py-3 px-4">NAMA SISWA</th>
                        <th className="py-3 px-4">KELAS</th>
                        <th className="py-3 px-4">JENIS</th>
                        <th className="py-3 px-4">MASALAH / KASUS</th>
                        <th className="py-3 px-4">SOLUSI &amp; TINDAK LANJUT</th>
                        <th className="py-3 px-4 text-center w-24">AKSI</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-slate-300">
                      {loading ? (
                        <tr>
                          <td colSpan={7} className="py-12 text-center text-slate-400">
                            Memuat data bimbingan...
                          </td>
                        </tr>
                      ) : bimbinganList.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-16 text-center text-slate-500">
                            Belum ada catatan bimbingan untuk siswa {assignedKelas}.
                          </td>
                        </tr>
                      ) : (
                        bimbinganList.map((item, index) => (
                          <tr key={item.id || index} className="hover:bg-slate-800/40 transition">
                            <td className="py-3 px-4 font-mono text-slate-300">{item.tanggal}</td>
                            <td className="py-3 px-4 font-bold text-white">{item.nama_siswa}</td>
                            <td className="py-3 px-4 font-semibold text-slate-300">{item.kelas}</td>
                            <td className="py-3 px-4">
                              <span className="bg-slate-800 text-sky-300 px-2.5 py-1 rounded-md text-[10px] font-bold border border-slate-700/60">
                                {item.jenis_masalah}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-slate-200">{item.masalah}</td>
                            <td className="py-3 px-4 text-slate-400">{item.solusi || '-'}</td>
                            <td className="py-3 px-4 text-center">
                              <button
                                onClick={() => handleDeleteBimbingan(item.id)}
                                className="bg-rose-950/60 text-rose-400 hover:bg-rose-900/80 p-1.5 rounded-lg border border-rose-800/50 transition cursor-pointer"
                                title="Hapus Bimbingan"
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

          {/* TAB CONTENT 2: RIWAYAT & REKAPITULASI BIMBINGAN WALI */}
          {activeTab === 'rekap' && (
            <div className="bg-[#111827] border border-slate-800/80 rounded-2xl p-6 min-h-[480px] space-y-6">
              
              {/* Header Title Section */}
              <div className="flex items-center gap-3 border-b border-slate-800/80 pb-5">
                <div className="w-10 h-10 bg-indigo-950/80 text-indigo-400 rounded-xl flex items-center justify-center text-lg">
                  📜
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">
                    Riwayat &amp; Rekapitulasi Bimbingan {assignedKelas}
                  </h2>
                  <p className="text-xs text-slate-400">
                    Rekapitulasi lengkap catatan bimbingan siswa perwalian {assignedKelas}.
                  </p>
                </div>
              </div>

              {/* STAT CARDS REKAPITULASI BIMBINGAN */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-[#0d1322] border border-slate-800/80 rounded-xl p-4">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">TOTAL BIMBINGAN</p>
                  <p className="text-2xl font-extrabold text-white mt-1">{totalBimbingan}</p>
                </div>
                <div className="bg-[#0d1322] border border-blue-900/40 rounded-xl p-4">
                  <p className="text-[10px] font-bold text-blue-400 uppercase tracking-wider">KASUS AKADEMIK</p>
                  <p className="text-2xl font-extrabold text-blue-400 mt-1">{kasusAkademik}</p>
                </div>
                <div className="bg-[#0d1322] border border-purple-900/40 rounded-xl p-4">
                  <p className="text-[10px] font-bold text-purple-400 uppercase tracking-wider">PRIBADI/KARAKTER/LAINNYA</p>
                  <p className="text-2xl font-extrabold text-purple-400 mt-1">{kasusPribadiKarakter}</p>
                </div>
              </div>

              {/* FILTER BAR REKAPITULASI */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-12 gap-3 bg-[#0d1322]/80 border border-slate-800/80 p-4 rounded-xl">
                <div className="md:col-span-6">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                    FILTER JENIS MASALAH
                  </label>
                  <select
                    value={filterJenis}
                    onChange={(e) => setFilterJenis(e.target.value)}
                    className="w-full bg-[#111827] border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500 cursor-pointer"
                  >
                    <option value="">Semua Jenis</option>
                    <option value="Akademik">Akademik</option>
                    <option value="Karakter/Sikap">Karakter / Sikap</option>
                    <option value="Kedisiplinan">Kedisiplinan</option>
                    <option value="Pribadi/Sosial">Pribadi / Sosial</option>
                  </select>
                </div>

                <div className="md:col-span-6">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                    CARI SISWA / KASUS
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500 text-xs">
                      🔍
                    </span>
                    <input
                      type="text"
                      value={searchKataKunci}
                      onChange={(e) => setSearchKataKunci(e.target.value)}
                      placeholder="Ketik kata kunci..."
                      className="w-full bg-[#111827] border border-slate-800 rounded-xl pl-8 pr-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* TABEL DATA REKAPITULASI BIMBINGAN */}
              <div className="overflow-x-auto rounded-xl border border-slate-800/80">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-[#0d1322] text-slate-400 border-b border-slate-800 font-bold uppercase tracking-wider">
                      <th className="py-3 px-4 w-12 text-center">NO</th>
                      <th className="py-3 px-4">TANGGAL</th>
                      <th className="py-3 px-4">NAMA SISWA</th>
                      <th className="py-3 px-4">KELAS</th>
                      <th className="py-3 px-4">JENIS</th>
                      <th className="py-3 px-4">MASALAH / KASUS</th>
                      <th className="py-3 px-4">SOLUSI &amp; TINDAK LANJUT</th>
                      <th className="py-3 px-4 text-center w-24">AKSI</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-300">
                    {loadingRekap ? (
                      <tr>
                        <td colSpan={8} className="py-12 text-center text-slate-400">
                          Memuat riwayat bimbingan...
                        </td>
                      </tr>
                    ) : rekapList.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-20 text-center text-slate-500">
                          Tidak ada catatan bimbingan ditemukan di {assignedKelas}.
                        </td>
                      </tr>
                    ) : (
                      rekapList.map((item, index) => (
                        <tr key={item.id || index} className="hover:bg-slate-800/40 transition">
                          <td className="py-3 px-4 text-center font-medium text-slate-400">{index + 1}</td>
                          <td className="py-3 px-4 font-mono text-slate-300">{item.tanggal}</td>
                          <td className="py-3 px-4 font-bold text-white">{item.nama_siswa}</td>
                          <td className="py-3 px-4 font-semibold text-slate-300">{item.kelas}</td>
                          <td className="py-3 px-4">
                            <span className="bg-slate-800 text-sky-300 px-2.5 py-1 rounded-md text-[10px] font-bold border border-slate-700/60">
                              {item.jenis_masalah}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-slate-200">{item.masalah}</td>
                          <td className="py-3 px-4 text-slate-400">{item.solusi || '-'}</td>
                          <td className="py-3 px-4 text-center">
                            <button
                              onClick={() => handleDeleteBimbingan(item.id)}
                              className="bg-rose-950/60 text-rose-400 hover:bg-rose-900/80 p-1.5 rounded-lg border border-rose-800/50 transition cursor-pointer"
                              title="Hapus Catatan"
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
            href="/bimbingan"
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