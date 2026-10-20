'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { useAuthRole } from '@/hooks/useAuthRole'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const supabase = createClient(supabaseUrl, supabaseAnonKey)

interface KelasOption {
  id: number
  nama_kelas: string
  tingkat: string
}

interface Siswa {
  id: number
  nisn: string
  nama_lengkap: string
  jenis_kelamin: 'L' | 'P'
  kelas_id: number | null
  nama_kelas?: string
}

export default function MasterSiswaPage() {
  const router = useRouter()
  const { isOperator, loading: loadingRole } = useAuthRole()

  const [userDisplayName, setUserDisplayName] = useState('OPERATOR')
  const [kelasList, setKelasList] = useState<KelasOption[]>([])
  const [siswaList, setSiswaList] = useState<Siswa[]>([])
  const [filteredSiswa, setFilteredSiswa] = useState<Siswa[]>([])

  // Form State
  const [nisn, setNisn] = useState('')
  const [namaLengkap, setNamaLengkap] = useState('')
  const [jenisKelamin, setJenisKelamin] = useState<'L' | 'P'>('L')
  const [kelasId, setKelasId] = useState<string>('')
  const [editingId, setEditingId] = useState<number | null>(null)

  // Filter State
  const [filterKelas, setFilterKelas] = useState<string>('')
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(false)

  // Guard Akses Operator
  useEffect(() => {
    if (!loadingRole && !isOperator) {
      router.push('/')
    }
  }, [loadingRole, isOperator, router])

  useEffect(() => {
    async function getUserData() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const nameFromMeta = user.user_metadata?.full_name || user.email?.split('@')[0] || 'OPERATOR'
        setUserDisplayName(nameFromMeta.toUpperCase())
      }
    }
    getUserData()
    fetchInitialData()
  }, [])

  const fetchInitialData = async () => {
    setLoading(true)

    // 1. Fetch Kelas Options
    const { data: dataKelas } = await supabase
      .from('kelas')
      .select('id, nama_kelas, tingkat')
      .order('nama_kelas', { ascending: true })

    const kelasMap = new Map<number, string>()
    if (dataKelas) {
      setKelasList(dataKelas)
      dataKelas.forEach((k) => kelasMap.set(k.id, k.nama_kelas))
    }

    // 2. Fetch All Siswa
    const { data: dataSiswa, error } = await supabase
      .from('siswa')
      .select('*')
      .order('nama_lengkap', { ascending: true })

    if (error) {
      console.error('Error fetch siswa:', error.message)
    }

    if (dataSiswa) {
      const formatted: Siswa[] = dataSiswa.map((s) => ({
        ...s,
        nama_kelas: s.kelas_id ? kelasMap.get(s.kelas_id) || 'Tanpa Kelas' : 'Tanpa Kelas',
      }))
      setSiswaList(formatted)
      setFilteredSiswa(formatted)
    }

    setLoading(false)
  }

  // Filter Logic
  useEffect(() => {
    let result = [...siswaList]

    if (filterKelas) {
      result = result.filter((s) => String(s.kelas_id) === filterKelas)
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      result = result.filter(
        (s) => s.nama_lengkap.toLowerCase().includes(q) || (s.nisn && s.nisn.toLowerCase().includes(q))
      )
    }

    setFilteredSiswa(result)
  }, [filterKelas, searchQuery, siswaList])

  const resetForm = () => {
    setNisn('')
    setNamaLengkap('')
    setJenisKelamin('L')
    setKelasId('')
    setEditingId(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nisn.trim() || !namaLengkap.trim()) {
      alert('NISN dan Nama Lengkap wajib diisi!')
      return
    }

    setLoading(true)
    const payload = {
      nisn: nisn.trim(),
      nama_lengkap: namaLengkap.trim(),
      jenis_kelamin: jenisKelamin, // Terjamin terisi 'L' atau 'P'
      kelas_id: kelasId ? Number(kelasId) : null,
    }

    try {
      if (editingId) {
        const { error } = await supabase.from('siswa').update(payload).eq('id', editingId)
        if (!error) {
          alert('Berhasil memperbarui data siswa!')
          resetForm()
          fetchInitialData()
        } else {
          alert('Gagal update siswa: ' + error.message)
        }
      } else {
        const { error } = await supabase.from('siswa').insert([payload])
        if (!error) {
          alert('Berhasil menambah siswa baru!')
          resetForm()
          fetchInitialData()
        } else {
          alert('Gagal menyimpan siswa: ' + error.message)
        }
      }
    } catch (err: any) {
      alert('Terjadi kesalahan: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (siswa: Siswa) => {
    setEditingId(siswa.id)
    setNisn(siswa.nisn || '')
    setNamaLengkap(siswa.nama_lengkap || '')
    setJenisKelamin(siswa.jenis_kelamin || 'L')
    setKelasId(siswa.kelas_id ? String(siswa.kelas_id) : '')
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Hapus data siswa ini?')) return
    const { error } = await supabase.from('siswa').delete().eq('id', id)
    if (!error) {
      fetchInitialData()
    } else {
      alert('Gagal menghapus siswa: ' + error.message)
    }
  }

  if (loadingRole || !isOperator) {
    return (
      <div className="h-screen bg-[#E2E8F0] text-slate-700 p-8 flex items-center justify-center font-sans">
        <div className="bg-white/90 backdrop-blur-md border border-slate-300 p-6 rounded-2xl text-center space-y-2 shadow-md">
          <p className="text-slate-900 font-bold text-sm">Memeriksa Hak Akses Operator...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen bg-[#E2E8F0] text-slate-800 font-sans flex flex-col justify-between selection:bg-indigo-500 selection:text-white overflow-hidden relative">
      
      {/* WATERMARK LOGO */}
      <div className="fixed inset-0 pointer-events-none z-0 flex items-center justify-center opacity-[0.15] select-none">
        <img src="/logo-smp.jpg" alt="Watermark SMP Muna Mustofa" className="w-[850px] h-[850px] object-contain max-w-none" />
      </div>

      <div className="relative z-10 flex flex-col h-full overflow-hidden">
        
        {/* TOPBAR HEADER */}
        <header className="bg-slate-100/90 backdrop-blur-md border-b border-slate-300 px-6 py-2.5 flex items-center justify-between shrink-0 shadow-xs">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-slate-600 hover:text-slate-900 p-1.5 rounded-lg transition" title="Kembali ke Dashboard">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </Link>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl overflow-hidden flex items-center justify-center bg-white border border-slate-300 p-0.5 shadow-xs shrink-0">
                <img src="/logo-smp.jpg" alt="Logo SMP Muna Mustofa" className="w-full h-full object-contain" />
              </div>
              <div>
                <h1 className="font-bold text-base text-slate-900 leading-none">Aplikasi Guru AI</h1>
                <p className="text-[11px] text-emerald-800 font-bold mt-0.5">Kelola Master Data Siswa</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="bg-emerald-100/80 border border-emerald-300 text-emerald-800 text-xs font-semibold px-3 py-1.5 rounded-full flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse"></span>
              <span>Supabase Live</span>
            </div>

            <div className="bg-white border border-slate-300 text-slate-800 text-xs font-bold px-3.5 py-1.5 rounded-xl flex items-center gap-2 shadow-xs">
              <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px] font-bold">
                {userDisplayName.charAt(0)}
              </span>
              <span>{userDisplayName}</span>
              <span className="bg-indigo-100 text-indigo-800 text-[10px] px-2 py-0.5 rounded-md font-extrabold uppercase ml-1 border border-indigo-200">
                Operator
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

        {/* MAIN CONTENT AREA */}
        <main className="max-w-6xl w-full mx-auto p-4 flex-1 flex flex-col min-h-0 space-y-4">
          
          {/* PANEL FORM INPUT (LENGKAP DENGAN JENIS KELAMIN) */}
          <form onSubmit={handleSubmit} className="bg-gradient-to-br from-indigo-100/90 via-slate-100/90 to-indigo-50/90 backdrop-blur-md border border-indigo-200/80 rounded-2xl p-4 shadow-xs shrink-0">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-12 gap-3 items-end">
              
              <div className="md:col-span-3">
                <label className="block text-[10px] font-extrabold text-indigo-950 uppercase tracking-wider mb-1">NISN *</label>
                <input
                  type="text"
                  value={nisn}
                  onChange={(e) => setNisn(e.target.value)}
                  placeholder="Contoh: 0123456789"
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 font-bold focus:outline-none focus:border-indigo-600"
                  required
                />
              </div>

              <div className="md:col-span-3">
                <label className="block text-[10px] font-extrabold text-indigo-950 uppercase tracking-wider mb-1">Nama Lengkap Siswa *</label>
                <input
                  type="text"
                  value={namaLengkap}
                  onChange={(e) => setNamaLengkap(e.target.value)}
                  placeholder="Masukkan nama siswa..."
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 font-bold focus:outline-none focus:border-indigo-600"
                  required
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-[10px] font-extrabold text-indigo-950 uppercase tracking-wider mb-1">Jenis Kelamin *</label>
                <select
                  value={jenisKelamin}
                  onChange={(e) => setJenisKelamin(e.target.value as 'L' | 'P')}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 font-bold focus:outline-none focus:border-indigo-600 cursor-pointer"
                  required
                >
                  <option value="L">Laki-laki (L)</option>
                  <option value="P">Perempuan (P)</option>
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="block text-[10px] font-extrabold text-indigo-950 uppercase tracking-wider mb-1">Pilih Rombel / Kelas</label>
                <select
                  value={kelasId}
                  onChange={(e) => setKelasId(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 font-bold focus:outline-none focus:border-indigo-600 cursor-pointer"
                >
                  <option value="">-- Tanpa Kelas --</option>
                  {kelasList.map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.nama_kelas} (Kelas {k.tingkat})
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-2 flex gap-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded-xl font-extrabold text-xs transition shadow-xs cursor-pointer"
                >
                  {loading ? '...' : editingId ? 'Update' : '+ Simpan'}
                </button>
                {editingId && (
                  <button
                    type="button"
                    onClick={resetForm}
                    className="px-2.5 bg-white border border-slate-300 hover:bg-slate-100 text-xs text-slate-700 font-bold rounded-xl transition cursor-pointer"
                  >
                    Batal
                  </button>
                )}
              </div>

            </div>
          </form>

          {/* PANEL TABEL REKAP SISWA */}
          <div className="bg-gradient-to-br from-indigo-100/90 via-slate-100/90 to-indigo-50/90 backdrop-blur-md border border-indigo-200/80 rounded-2xl p-4 flex-1 flex flex-col min-h-0 shadow-sm overflow-hidden">
            
            {/* FILTER & SEARCH BAR */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 mb-3 shrink-0">
              <div className="sm:col-span-6 relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="🔍 Cari NISN atau Nama Siswa..."
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 font-bold focus:outline-none focus:border-indigo-600"
                />
              </div>

              <div className="sm:col-span-6">
                <select
                  value={filterKelas}
                  onChange={(e) => setFilterKelas(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 font-bold focus:outline-none focus:border-indigo-600 cursor-pointer"
                >
                  <option value="">-- Tampilkan Semua Kelas --</option>
                  {kelasList.map((k) => (
                    <option key={k.id} value={k.id}>
                      Filter: {k.nama_kelas}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* TABEL DATA SISWA */}
            <div className="flex-1 overflow-y-auto rounded-xl border border-indigo-200/80 bg-white/90">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="sticky top-0 bg-indigo-100 z-10 shadow-xs">
                  <tr className="text-indigo-950 border-b border-indigo-200 font-extrabold uppercase tracking-wider text-[11px]">
                    <th className="py-2.5 px-3 w-12 text-center">NO</th>
                    <th className="py-2.5 px-3">NISN</th>
                    <th className="py-2.5 px-3">NAMA LENGKAP</th>
                    <th className="py-2.5 px-3 text-center">JK</th>
                    <th className="py-2.5 px-3">KELAS / ROMBEL</th>
                    <th className="py-2.5 px-3 text-center w-20">AKSI</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-slate-800">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="py-10 text-center text-slate-600 font-medium">Memuat data siswa...</td>
                    </tr>
                  ) : filteredSiswa.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-10 text-center text-slate-600 font-medium">Tidak ada data siswa ditemukan.</td>
                    </tr>
                  ) : (
                    filteredSiswa.map((siswa, idx) => (
                      <tr key={siswa.id} className="hover:bg-indigo-50/60 transition">
                        <td className="py-2 px-3 text-center font-bold text-slate-500">{idx + 1}</td>
                        <td className="py-2 px-3 font-mono font-bold text-slate-700 whitespace-nowrap">{siswa.nisn || '-'}</td>
                        <td className="py-2 px-3 font-extrabold text-slate-900">{siswa.nama_lengkap}</td>
                        <td className="py-2 px-3 text-center font-bold">
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-black ${
                            siswa.jenis_kelamin === 'P' ? 'bg-pink-100 text-pink-700 border border-pink-200' : 'bg-blue-100 text-blue-700 border border-blue-200'
                          }`}>
                            {siswa.jenis_kelamin || 'L'}
                          </span>
                        </td>
                        <td className="py-2 px-3 font-bold text-indigo-800 whitespace-nowrap">{siswa.nama_kelas}</td>
                        <td className="py-2 px-3 text-center space-x-1 whitespace-nowrap">
                          <button
                            onClick={() => handleEdit(siswa)}
                            className="bg-amber-50 text-amber-700 hover:bg-amber-100 p-1 rounded-lg border border-amber-200 transition cursor-pointer"
                            title="Edit Siswa"
                          >
                            ✏️
                          </button>
                          <button
                            onClick={() => handleDelete(siswa.id)}
                            className="bg-rose-50 text-rose-600 hover:bg-rose-100 p-1 rounded-lg border border-rose-200 transition cursor-pointer"
                            title="Hapus Siswa"
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

        </main>

        {/* FOOTER BADGE */}
        <div className="pb-16 pt-1 flex justify-center shrink-0">
          <div className="bg-slate-100/90 border border-slate-300 px-4 py-0.5 rounded-full text-center text-[10px] text-slate-700 font-medium shadow-xs">
            <span>Aplikasi Guru AI</span>
            <span className="mx-2">•</span>
            <span>Created by <strong className="text-emerald-900 font-bold">MUZAINI AL KAHFI</strong></span>
          </div>
        </div>

      </div>

      {/* BOTTOM NAVIGATION DOCK */}
      <div className="border-t border-slate-300 bg-slate-100/95 backdrop-blur-md fixed bottom-0 left-0 right-0 z-50 shadow-lg shrink-0">
        <div className="max-w-xl mx-auto px-4 py-2 flex items-center justify-between">
          <Link href="/" className="flex flex-col items-center gap-0.5 text-[11px] font-semibold text-slate-600 hover:text-slate-950 transition">
            <span className="text-base">🕒</span>
            <span>Dashboard</span>
          </Link>
          {isOperator && (
            <Link href="/siswa" className="flex flex-col items-center gap-0.5 text-[11px] font-bold text-indigo-600 transition">
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
          <Link href="/jadwal" className="flex flex-col items-center gap-0.5 text-[11px] font-semibold text-slate-600 hover:text-slate-950 transition">
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