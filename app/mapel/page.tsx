'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { motion } from 'framer-motion'
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

  // DETEKSI OTOMATIS TEMA DARK MODE DARI LOCAL STORAGE
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false)

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme')
    if (savedTheme === 'dark') {
      setIsDarkMode(true)
    }
  }, [])

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
      <div className={`h-screen p-8 flex items-center justify-center font-sans ${isDarkMode ? 'bg-slate-950 text-slate-100' : 'bg-[#E2E8F0] text-slate-700'}`}>
        <div className={`backdrop-blur-md border p-6 rounded-2xl text-center space-y-2 shadow-md ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white/90 border-slate-300'}`}>
          <p className={`font-bold text-sm ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Memeriksa Hak Akses Operator...</p>
        </div>
      </div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: -60 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className={`h-screen font-sans flex flex-col justify-between selection:bg-indigo-500 selection:text-white overflow-hidden relative transition-colors duration-300 ${
        isDarkMode ? 'bg-slate-950 text-slate-100' : 'bg-[#E2E8F0] text-slate-800'
      }`}
    >
      
      {/* 1. WATERMARK LOGO */}
      <div className={`fixed inset-0 pointer-events-none z-0 flex items-center justify-center select-none transition-opacity duration-300 ${
        isDarkMode ? 'opacity-[0.05]' : 'opacity-[0.15]'
      }`}>
        <img
          src="/logo-smp.jpg"
          alt="Watermark SMP Muna Mustofa"
          className="w-[850px] h-[850px] object-contain max-w-none"
        />
      </div>

      <div className="relative z-10 flex flex-col h-full overflow-hidden">
        
        {/* 2. HEADER TOPBAR */}
        <header className={`border-b px-6 py-2.5 flex items-center justify-between shrink-0 shadow-xs transition-colors duration-300 ${
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
                <img src="/logo-smp.jpg" alt="Logo SMP Muna Mustofa" className="w-full h-full object-contain" />
              </div>
              <div>
                <h1 className={`font-bold text-base leading-none ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Aplikasi Guru AI</h1>
                <p className={`text-[11px] font-bold mt-0.5 ${isDarkMode ? 'text-emerald-400' : 'text-emerald-800'}`}>Kelola Master Mata Pelajaran</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className={`border text-xs font-semibold px-3 py-1.5 rounded-full flex items-center gap-2 ${
              isDarkMode 
                ? 'bg-emerald-950/60 border-emerald-800 text-emerald-300' 
                : 'bg-emerald-100/80 border-emerald-300 text-emerald-800'
            }`}>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>Supabase Live</span>
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
                Operator
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

        {/* 3. MAIN CONTENT CONTAINER */}
        <main className="max-w-6xl w-full mx-auto p-4 flex-1 flex flex-col min-h-0 space-y-3">
          
          {/* PANEL FORM INPUT MAPEL LENGKAP */}
          <form onSubmit={handleSubmit} className={`backdrop-blur-md border rounded-2xl p-3.5 shadow-xs shrink-0 space-y-2.5 ${
            isDarkMode 
              ? 'bg-slate-900/90 border-slate-800' 
              : 'bg-gradient-to-br from-indigo-100/90 via-slate-100/90 to-indigo-50/90 border-indigo-200/80'
          }`}>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-12 gap-2.5 items-end">
              
              <div className="md:col-span-2">
                <label className={`block text-[10px] font-extrabold uppercase tracking-wider mb-1 ${isDarkMode ? 'text-indigo-300' : 'text-indigo-950'}`}>
                  KODE MAPEL *
                </label>
                <input
                  type="text"
                  value={kodeMapel}
                  onChange={(e) => setKodeMapel(e.target.value)}
                  placeholder="MAT-VII"
                  className={`w-full border rounded-xl px-2.5 py-1.5 text-xs font-bold focus:outline-none focus:border-indigo-600 uppercase ${
                    isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                  }`}
                  required
                />
              </div>

              <div className="md:col-span-4">
                <label className={`block text-[10px] font-extrabold uppercase tracking-wider mb-1 ${isDarkMode ? 'text-indigo-300' : 'text-indigo-950'}`}>
                  NAMA MATA PELAJARAN *
                </label>
                <input
                  type="text"
                  value={namaMapel}
                  onChange={(e) => setNamaMapel(e.target.value)}
                  placeholder="Matematika / Bahasa Indonesia"
                  className={`w-full border rounded-xl px-2.5 py-1.5 text-xs font-bold focus:outline-none focus:border-indigo-600 ${
                    isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                  }`}
                  required
                />
              </div>

              <div className="md:col-span-3">
                <label className={`block text-[10px] font-extrabold uppercase tracking-wider mb-1 ${isDarkMode ? 'text-indigo-300' : 'text-indigo-950'}`}>
                  KELOMPOK / KATEGORI
                </label>
                <select
                  value={kelompok}
                  onChange={(e) => setKelompok(e.target.value)}
                  className={`w-full border rounded-xl px-2.5 py-1.5 text-xs font-bold focus:outline-none focus:border-indigo-600 cursor-pointer ${
                    isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                  }`}
                >
                  <option value="Umum">Umum (Muatan Nasional)</option>
                  <option value="Muatan Lokal">Muatan Lokal (Mulok)</option>
                  <option value="Ekstrakulikuler">Ekstrakulikuler</option>
                  <option value="Bimbingan">Bimbingan Konseling</option>
                </select>
              </div>

              <div className="md:col-span-3">
                <label className={`block text-[10px] font-extrabold uppercase tracking-wider mb-1 ${isDarkMode ? 'text-indigo-300' : 'text-indigo-950'}`}>
                  TINGKAT / KELAS TARGET
                </label>
                <select
                  value={tingkat}
                  onChange={(e) => setTingkat(e.target.value)}
                  className={`w-full border rounded-xl px-2.5 py-1.5 text-xs font-bold focus:outline-none focus:border-indigo-600 cursor-pointer ${
                    isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                  }`}
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
                <label className={`block text-[10px] font-extrabold uppercase tracking-wider mb-1 ${isDarkMode ? 'text-indigo-300' : 'text-indigo-950'}`}>
                  BEBAN (JP/MINGGU)
                </label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={jumlahJp}
                  onChange={(e) => setJumlahJp(Number(e.target.value))}
                  className={`w-full border rounded-xl px-2.5 py-1.5 text-xs font-bold focus:outline-none focus:border-indigo-600 ${
                    isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                  }`}
                  required
                />
              </div>

              <div className="md:col-span-3">
                <label className={`block text-[10px] font-extrabold uppercase tracking-wider mb-1 ${isDarkMode ? 'text-indigo-300' : 'text-indigo-950'}`}>
                  SEMESTER
                </label>
                <select
                  value={semester}
                  onChange={(e) => setSemester(e.target.value)}
                  className={`w-full border rounded-xl px-2.5 py-1.5 text-xs font-bold focus:outline-none focus:border-indigo-600 cursor-pointer ${
                    isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                  }`}
                >
                  <option value="Ganjil">Semester Ganjil</option>
                  <option value="Genap">Semester Genap</option>
                </select>
              </div>

              <div className="md:col-span-3">
                <label className={`block text-[10px] font-extrabold uppercase tracking-wider mb-1 ${isDarkMode ? 'text-indigo-300' : 'text-indigo-950'}`}>
                  TAHUN AJARAN
                </label>
                <input
                  type="text"
                  value={tahunAjaran}
                  onChange={(e) => setTahunAjaran(e.target.value)}
                  placeholder="2026/2027"
                  className={`w-full border rounded-xl px-2.5 py-1.5 text-xs font-bold focus:outline-none focus:border-indigo-600 ${
                    isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                  }`}
                />
              </div>

              <div className="md:col-span-2">
                <label className={`block text-[10px] font-extrabold uppercase tracking-wider mb-1 ${isDarkMode ? 'text-indigo-300' : 'text-indigo-950'}`}>
                  URUTAN RAPOR
                </label>
                <input
                  type="number"
                  min={1}
                  value={urutan}
                  onChange={(e) => setUrutan(Number(e.target.value))}
                  className={`w-full border rounded-xl px-2.5 py-1.5 text-xs font-bold focus:outline-none focus:border-indigo-600 ${
                    isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                  }`}
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
                    className={`px-2.5 border text-xs font-bold rounded-xl transition cursor-pointer ${
                      isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700' : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    Batal
                  </button>
                )}
              </div>

            </div>
          </form>

          {/* PANEL TABEL REKAP MAPEL */}
          <div className={`backdrop-blur-md border rounded-2xl p-3.5 flex-1 flex flex-col min-h-0 shadow-xs overflow-hidden ${
            isDarkMode 
              ? 'bg-slate-900/90 border-slate-800' 
              : 'bg-gradient-to-br from-indigo-100/90 via-slate-100/90 to-indigo-50/90 border-indigo-200/80'
          }`}>
            
            {/* SEARCH BAR */}
            <div className="flex items-center justify-between mb-2.5 shrink-0 gap-3">
              <div className="relative flex-1 max-w-md">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="🔍 Cari Kode, Nama Mapel, atau Kelompok..."
                  className={`w-full border rounded-xl px-3 py-1.5 text-xs font-bold focus:outline-none focus:border-indigo-600 ${
                    isDarkMode ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-400' : 'bg-white border-slate-300 text-slate-900'
                  }`}
                />
              </div>

              <button
                onClick={fetchMapel}
                className={`text-xs border px-3 py-1.5 rounded-xl font-bold transition cursor-pointer shrink-0 ${
                  isDarkMode 
                    ? 'bg-slate-800 border-slate-700 hover:bg-slate-700 text-slate-200' 
                    : 'bg-white border-slate-300 hover:bg-slate-50 text-slate-700'
                }`}
              >
                🔄 Refresh Data
              </button>
            </div>

            {/* TABEL DATA PRO */}
            <div className={`flex-1 overflow-y-auto rounded-xl border ${isDarkMode ? 'bg-slate-900/90 border-slate-800' : 'bg-white/90 border-indigo-200/80'}`}>
              <table className="w-full text-left border-collapse text-xs">
                <thead className={`sticky top-0 z-10 shadow-xs ${isDarkMode ? 'bg-slate-800' : 'bg-indigo-100'}`}>
                  <tr className={`border-b font-extrabold uppercase tracking-wider text-[11px] ${isDarkMode ? 'text-indigo-400 border-slate-700' : 'text-indigo-950 border-indigo-200'}`}>
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
                <tbody className={`divide-y ${isDarkMode ? 'divide-slate-800 text-slate-200' : 'divide-slate-200 text-slate-800'}`}>
                  {loading ? (
                    <tr>
                      <td colSpan={8} className={`py-10 text-center font-medium ${isDarkMode ? 'text-slate-500' : 'text-slate-600'}`}>
                        Memuat data mata pelajaran...
                      </td>
                    </tr>
                  ) : filteredMapel.length === 0 ? (
                    <tr>
                      <td colSpan={8} className={`py-10 text-center font-medium ${isDarkMode ? 'text-slate-500' : 'text-slate-600'}`}>
                        Belum ada mata pelajaran terdaftar.
                      </td>
                    </tr>
                  ) : (
                    filteredMapel.map((item, index) => (
                      <tr key={item.id || index} className={`transition ${isDarkMode ? 'hover:bg-slate-800/60' : 'hover:bg-indigo-50/60'}`}>
                        <td className={`py-2 px-3 text-center font-bold ${isDarkMode ? 'text-slate-500' : 'text-slate-500'}`}>{item.urutan || index + 1}</td>
                        <td className={`py-2 px-3 font-mono font-bold whitespace-nowrap ${isDarkMode ? 'text-indigo-400' : 'text-indigo-900'}`}>{item.kode_mapel}</td>
                        <td className={`py-2 px-3 font-extrabold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{item.nama_mapel}</td>
                        <td className={`py-2 px-3 font-bold ${isDarkMode ? 'text-slate-400' : 'text-slate-700'}`}>{item.kelompok}</td>
                        <td className="py-2 px-3 text-center font-bold text-indigo-400">{item.tingkat}</td>
                        <td className="py-2 px-3 text-center font-extrabold text-emerald-400">{item.jumlah_jp} JP</td>
                        <td className="py-2 px-3 text-center whitespace-nowrap">
                          <span className={`border px-2 py-0.5 rounded-md text-[10px] font-extrabold ${
                            isDarkMode 
                              ? 'bg-indigo-950 text-indigo-300 border-indigo-800' 
                              : 'bg-indigo-100 text-indigo-800 border-indigo-200'
                          }`}>
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
          <div className={`border px-4 py-0.5 rounded-full text-center text-[10px] font-medium shadow-xs transition-colors duration-300 ${
            isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-400' : 'bg-slate-100/90 border-slate-300 text-slate-700'
          }`}>
            <span>Aplikasi Guru AI</span>
            <span className="mx-2">•</span>
            <span>Created by <strong className="text-emerald-500 font-bold">MUZAINI AL KAHFI</strong></span>
          </div>
        </div>

      </div>

      {/* 5. BOTTOM NAVIGATION DOCK */}
      <div className={`border-t fixed bottom-0 left-0 right-0 z-50 shadow-lg shrink-0 transition-colors duration-300 ${
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

          <Link href="/jadwal" className={`flex flex-col items-center gap-0.5 text-[11px] font-bold transition ${
            isDarkMode ? 'text-indigo-400' : 'text-indigo-600'
          }`}>
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