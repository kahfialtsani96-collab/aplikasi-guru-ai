'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { useAuthRole } from '@/hooks/useAuthRole'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const supabase = createClient(supabaseUrl, supabaseAnonKey)

interface Mapel {
  id?: string | number
  kode_mapel: string
  nama_mapel: string
  kelompok: string
  tingkat: string
  jumlah_jp: number
  semester: string
  tahun_ajaran: string
  urutan: number
}

export default function KelolaMapelPage() {
  const router = useRouter()
  const { isOperator, loading: loadingRole } = useAuthRole()

  const [userDisplayName, setUserDisplayName] = useState('OPERATOR')
  
  // State Form Lengkap
  const [kodeMapel, setKodeMapel] = useState('')
  const [namaMapel, setNamaMapel] = useState('')
  const [kelompok, setKelompok] = useState('Umum')
  const [tingkat, setTingkat] = useState('VII')
  const [jumlahJp, setJumlahJp] = useState<number>(2)
  const [semester, setSemester] = useState('Ganjil')
  const [tahunAjaran, setTahunAjaran] = useState('2026/2027')
  const [urutan, setUrutan] = useState<number>(1)
  
  const [editingId, setEditingId] = useState<string | number | null>(null)
  const [mapelList, setMapelList] = useState<Mapel[]>([])
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

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
    fetchMapel()
  }, [])

  // Fetch Daftar Mapel
  async function fetchMapel() {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('mapel')
        .select('*')
        .order('urutan', { ascending: true })

      if (!error && data) {
        setMapelList(data)
      }
    } catch (err) {
      console.error('Error fetching mapel:', err)
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setKodeMapel('')
    setNamaMapel('')
    setKelompok('Umum')
    setTingkat('VII')
    setJumlahJp(2)
    setSemester('Ganjil')
    setTahunAjaran('2026/2027')
    setUrutan(mapelList.length + 1)
    setEditingId(null)
  }

  // Simpan / Update Mapel
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!kodeMapel.trim() || !namaMapel.trim()) {
      alert('Kode dan Nama Mata Pelajaran wajib diisi!')
      return
    }

    setLoading(true)
    const payload = {
      kode_mapel: kodeMapel.trim().toUpperCase(),
      nama_mapel: namaMapel.trim(),
      kelompok: kelompok,
      tingkat: tingkat,
      jumlah_jp: Number(jumlahJp) || 2,
      semester: semester,
      tahun_ajaran: tahunAjaran.trim(),
      urutan: Number(urutan) || 1,
    }

    try {
      if (editingId) {
        const { error } = await supabase.from('mapel').update(payload).eq('id', editingId)
        if (!error) {
          alert('Mata pelajaran berhasil diperbarui!')
          resetForm()
          fetchMapel()
        } else {
          alert('Gagal mengupdate mapel: ' + error.message)
        }
      } else {
        const { error } = await supabase.from('mapel').insert([payload])
        if (!error) {
          alert('Mata pelajaran berhasil ditambahkan!')
          resetForm()
          fetchMapel()
        } else {
          alert('Gagal menambah mapel: ' + error.message)
        }
      }
    } catch (err: any) {
      alert('Error: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (item: Mapel) => {
    if (!item.id) return
    setEditingId(item.id)
    setKodeMapel(item.kode_mapel || '')
    setNamaMapel(item.nama_mapel || '')
    setKelompok(item.kelompok || 'Umum')
    setTingkat(item.tingkat || 'VII')
    setJumlahJp(item.jumlah_jp || 2)
    setSemester(item.semester || 'Ganjil')
    setTahunAjaran(item.tahun_ajaran || '2026/2027')
    setUrutan(item.urutan || 1)
  }

  const handleDelete = async (id?: string | number) => {
    if (!id || !confirm('Yakin ingin menghapus mata pelajaran ini?')) return

    try {
      const { error } = await supabase.from('mapel').delete().eq('id', id)
      if (!error) {
        setMapelList((prev) => prev.filter((item) => item.id !== id))
      } else {
        alert('Gagal menghapus mapel: ' + error.message)
      }
    } catch (err) {
      console.error('Error deleting mapel:', err)
    }
  }

  const filteredMapel = mapelList.filter((m) =>
    m.nama_mapel.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.kode_mapel.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.kelompok.toLowerCase().includes(searchQuery.toLowerCase())
  )

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
      
      {/* 1. WATERMARK LOGO */}
      <div className="fixed inset-0 pointer-events-none z-0 flex items-center justify-center opacity-[0.15] select-none">
        <img
          src="/logo-smp.jpg"
          alt="Watermark SMP Muna Mustofa"
          className="w-[850px] h-[850px] object-contain max-w-none"
        />
      </div>

      <div className="relative z-10 flex flex-col h-full overflow-hidden">
        
        {/* 2. HEADER TOPBAR */}
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
                <p className="text-[11px] text-emerald-800 font-bold mt-0.5">Kelola Master Mata Pelajaran</p>
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

        {/* 3. MAIN CONTENT CONTAINER */}
        <main className="max-w-6xl w-full mx-auto p-4 flex-1 flex flex-col min-h-0 space-y-3">
          
          {/* PANEL FORM INPUT MAPEL LENGKAP */}
          <form onSubmit={handleSubmit} className="bg-gradient-to-br from-indigo-100/90 via-slate-100/90 to-indigo-50/90 backdrop-blur-md border border-indigo-200/80 rounded-2xl p-3.5 shadow-xs shrink-0 space-y-2.5">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-12 gap-2.5 items-end">
              
              <div className="md:col-span-2">
                <label className="block text-[10px] font-extrabold text-indigo-950 uppercase tracking-wider mb-1">
                  KODE MAPEL *
                </label>
                <input
                  type="text"
                  value={kodeMapel}
                  onChange={(e) => setKodeMapel(e.target.value)}
                  placeholder="MAT-VII"
                  className="w-full bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs text-slate-900 font-bold focus:outline-none focus:border-indigo-600 uppercase"
                  required
                />
              </div>

              <div className="md:col-span-4">
                <label className="block text-[10px] font-extrabold text-indigo-950 uppercase tracking-wider mb-1">
                  NAMA MATA PELAJARAN *
                </label>
                <input
                  type="text"
                  value={namaMapel}
                  onChange={(e) => setNamaMapel(e.target.value)}
                  placeholder="Matematika / Bahasa Indonesia"
                  className="w-full bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs text-slate-900 font-bold focus:outline-none focus:border-indigo-600"
                  required
                />
              </div>

              <div className="md:col-span-3">
                <label className="block text-[10px] font-extrabold text-indigo-950 uppercase tracking-wider mb-1">
                  KELOMPOK / KATEGORI
                </label>
                <select
                  value={kelompok}
                  onChange={(e) => setKelompok(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs text-slate-900 font-bold focus:outline-none focus:border-indigo-600 cursor-pointer"
                >
                  <option value="Umum">Umum (Muatan Nasional)</option>
                  <option value="Muatan Lokal">Muatan Lokal (Mulok)</option>
                  <option value="Ekstrakulikuler">Ekstrakulikuler</option>
                  <option value="Bimbingan">Bimbingan Konseling</option>
                </select>
              </div>

              <div className="md:col-span-3">
                <label className="block text-[10px] font-extrabold text-indigo-950 uppercase tracking-wider mb-1">
                  TINGKAT / KELAS TARGET
                </label>
                <select
                  value={tingkat}
                  onChange={(e) => setTingkat(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs text-slate-900 font-bold focus:outline-none focus:border-indigo-600 cursor-pointer"
                >
                  <option value="VII">Kelas VII (Fase D)</option>
                  <option value="VIII">Kelas VIII (Fase D)</option>
                  <option value="IX">Kelas IX (Fase D)</option>
                  <option value="Semua Tingkat">Semua Tingkat (VII-IX)</option>
                </select>
              </div>

            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-12 gap-2.5 items-end pt-1">
              
              <div className="md:col-span-2">
                <label className="block text-[10px] font-extrabold text-indigo-950 uppercase tracking-wider mb-1">
                  BEBAN (JP/MINGGU)
                </label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={jumlahJp}
                  onChange={(e) => setJumlahJp(Number(e.target.value))}
                  className="w-full bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs text-slate-900 font-bold focus:outline-none focus:border-indigo-600"
                  required
                />
              </div>

              <div className="md:col-span-3">
                <label className="block text-[10px] font-extrabold text-indigo-950 uppercase tracking-wider mb-1">
                  SEMESTER
                </label>
                <select
                  value={semester}
                  onChange={(e) => setSemester(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs text-slate-900 font-bold focus:outline-none focus:border-indigo-600 cursor-pointer"
                >
                  <option value="Ganjil">Semester Ganjil</option>
                  <option value="Genap">Semester Genap</option>
                </select>
              </div>

              <div className="md:col-span-3">
                <label className="block text-[10px] font-extrabold text-indigo-950 uppercase tracking-wider mb-1">
                  TAHUN AJARAN
                </label>
                <input
                  type="text"
                  value={tahunAjaran}
                  onChange={(e) => setTahunAjaran(e.target.value)}
                  placeholder="2026/2027"
                  className="w-full bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs text-slate-900 font-bold focus:outline-none focus:border-indigo-600"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-[10px] font-extrabold text-indigo-950 uppercase tracking-wider mb-1">
                  URUTAN RAPOR
                </label>
                <input
                  type="number"
                  min={1}
                  value={urutan}
                  onChange={(e) => setUrutan(Number(e.target.value))}
                  className="w-full bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs text-slate-900 font-bold focus:outline-none focus:border-indigo-600"
                />
              </div>

              <div className="md:col-span-2 flex gap-1.5">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold py-1.5 rounded-xl text-xs transition shadow-xs cursor-pointer"
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

          {/* PANEL TABEL REKAP MAPEL */}
          <div className="bg-gradient-to-br from-indigo-100/90 via-slate-100/90 to-indigo-50/90 backdrop-blur-md border border-indigo-200/80 rounded-2xl p-3.5 flex-1 flex flex-col min-h-0 shadow-sm overflow-hidden">
            
            {/* SEARCH BAR */}
            <div className="flex items-center justify-between mb-2.5 shrink-0 gap-3">
              <div className="relative flex-1 max-w-md">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="🔍 Cari Kode, Nama Mapel, atau Kelompok..."
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-900 font-bold focus:outline-none focus:border-indigo-600"
                />
              </div>

              <button
                onClick={fetchMapel}
                className="text-xs bg-white border border-slate-300 hover:bg-slate-50 px-3 py-1.5 rounded-xl font-bold text-slate-700 transition cursor-pointer shrink-0"
              >
                🔄 Refresh Data
              </button>
            </div>

            {/* TABEL DATA PRO */}
            <div className="flex-1 overflow-y-auto rounded-xl border border-indigo-200/80 bg-white/90">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="sticky top-0 bg-indigo-100 z-10 shadow-xs">
                  <tr className="text-indigo-950 border-b border-indigo-200 font-extrabold uppercase tracking-wider text-[11px]">
                    <th className="py-2.5 px-3 w-12 text-center">URUT</th>
                    <th className="py-2.5 px-3">KODE</th>
                    <th className="py-2.5 px-3">MATA PELAJARAN</th>
                    <th className="py-2.5 px-3">KELOMPOK</th>
                    <th className="py-2.5 px-3 text-center">TINGKAT</th>
                    <th className="py-2.5 px-3 text-center">JP/MINGGU</th>
                    <th className="py-2.5 px-3 text-center">PERIODE</th>
                    <th className="py-2.5 px-3 text-center w-20">AKSI</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-slate-800">
                  {loading ? (
                    <tr>
                      <td colSpan={8} className="py-10 text-center text-slate-600 font-medium">
                        Memuat data mata pelajaran...
                      </td>
                    </tr>
                  ) : filteredMapel.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-10 text-center text-slate-600 font-medium">
                        Belum ada mata pelajaran terdaftar.
                      </td>
                    </tr>
                  ) : (
                    filteredMapel.map((item, index) => (
                      <tr key={item.id || index} className="hover:bg-indigo-50/60 transition">
                        <td className="py-2 px-3 text-center font-bold text-slate-500">{item.urutan || index + 1}</td>
                        <td className="py-2 px-3 font-mono font-bold text-indigo-900 whitespace-nowrap">{item.kode_mapel}</td>
                        <td className="py-2 px-3 font-extrabold text-slate-900">{item.nama_mapel}</td>
                        <td className="py-2 px-3 font-bold text-slate-700">{item.kelompok}</td>
                        <td className="py-2 px-3 text-center font-bold text-indigo-800">{item.tingkat}</td>
                        <td className="py-2 px-3 text-center font-extrabold text-emerald-800">{item.jumlah_jp} JP</td>
                        <td className="py-2 px-3 text-center whitespace-nowrap">
                          <span className="bg-indigo-100 text-indigo-800 border border-indigo-200 px-2 py-0.5 rounded-md text-[10px] font-extrabold">
                            {item.semester} ({item.tahun_ajaran})
                          </span>
                        </td>
                        <td className="py-2 px-3 text-center space-x-1 whitespace-nowrap">
                          <button
                            onClick={() => handleEdit(item)}
                            className="bg-amber-50 text-amber-700 hover:bg-amber-100 p-1.5 rounded-lg border border-amber-200 transition cursor-pointer"
                            title="Edit Mapel"
                          >
                            ✏️
                          </button>
                          <button
                            onClick={() => handleDelete(item.id)}
                            className="bg-rose-50 text-rose-600 hover:bg-rose-100 p-1.5 rounded-lg border border-rose-200 transition cursor-pointer"
                            title="Hapus Mapel"
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

        {/* 4. FOOTER BADGE */}
        <div className="pb-16 pt-1 flex justify-center shrink-0">
          <div className="bg-slate-100/90 border border-slate-300 px-4 py-0.5 rounded-full text-center text-[10px] text-slate-700 font-medium shadow-xs">
            <span>Aplikasi Guru AI</span>
            <span className="mx-2">•</span>
            <span>Created by <strong className="text-emerald-900 font-bold">MUZAINI AL KAHFI</strong></span>
          </div>
        </div>

      </div>

      {/* 5. BOTTOM NAVIGATION DOCK */}
      <div className="border-t border-slate-300 bg-slate-100/95 backdrop-blur-md fixed bottom-0 left-0 right-0 z-50 shadow-lg shrink-0">
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

          <Link href="/jadwal" className="flex flex-col items-center gap-0.5 text-[11px] font-bold text-indigo-600 transition">
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