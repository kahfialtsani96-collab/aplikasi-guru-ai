'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { motion } from 'framer-motion'
import { useAuthRole } from '@/hooks/useAuthRole'

// Inisialisasi Supabase Client yang aman dari Prerender/SSG Vercel
const getSupabaseUrl = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://kvrulbdvgxfrtmznpjnm.supabase.co'
  return url.replace(/['"]/g, '').trim()
}

const getSupabaseAnonKey = () => {
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder'
  return key.replace(/['"]/g, '').trim()
}

const supabase = createClient(getSupabaseUrl(), getSupabaseAnonKey())

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
      jenis_kelamin: jenisKelamin,
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
    // Scroll otomatis ke form jika di layar HP
    window.scrollTo({ top: 0, behavior: 'smooth' })
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
      className={`min-h-screen font-sans flex flex-col justify-between selection:bg-indigo-500 selection:text-white relative transition-colors duration-300 ${
        isDarkMode ? 'bg-slate-950 text-slate-100' : 'bg-[#E2E8F0] text-slate-800'
      }`}
    >
      
      {/* WATERMARK LOGO */}
      <div className={`fixed inset-0 pointer-events-none z-0 flex items-center justify-center select-none transition-opacity duration-300 ${
        isDarkMode ? 'opacity-[0.05]' : 'opacity-[0.15]'
      }`}>
        <img src="/logo-smp.jpg" alt="Watermark SMP Muna Mustofa" className="w-[850px] h-[850px] object-contain max-w-none" />
      </div>

      <div className="relative z-10 flex flex-col h-full flex-1">
        
        {/* TOPBAR HEADER - RESPONSIVE */}
        <header className={`border-b px-4 sm:px-6 py-2.5 flex flex-wrap sm:flex-nowrap items-center justify-between gap-3 shrink-0 shadow-xs transition-colors duration-300 ${
          isDarkMode ? 'bg-slate-900/90 border-slate-800 backdrop-blur-md' : 'bg-slate-100/90 border-slate-300 backdrop-blur-md'
        }`}>
          <div className="flex items-center gap-2.5">
            <Link href="/" className={`p-1.5 rounded-lg transition ${isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'}`} title="Kembali ke Dashboard">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </Link>
            <div className="flex items-center gap-2.5">
              <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl overflow-hidden flex items-center justify-center border p-0.5 shadow-xs shrink-0 ${
                isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-300'
              }`}>
                <img src="/logo-smp.jpg" alt="Logo SMP Muna Mustofa" className="w-full h-full object-contain" />
              </div>
              <div>
                <h1 className={`font-bold text-sm sm:text-base leading-none ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Aplikasi Guru AI</h1>
                <p className={`text-[10px] sm:text-[11px] font-bold mt-0.5 ${isDarkMode ? 'text-emerald-400' : 'text-emerald-800'}`}>Kelola Master Data Siswa</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 ml-auto sm:ml-0">
            <div className={`hidden sm:flex border text-xs font-semibold px-3 py-1.5 rounded-full items-center gap-2 ${
              isDarkMode 
                ? 'bg-emerald-950/60 border-emerald-800 text-emerald-300' 
                : 'bg-emerald-100/80 border-emerald-300 text-emerald-800'
            }`}>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>Supabase Live</span>
            </div>

            <div className={`border text-xs font-bold px-3 py-1.5 rounded-xl flex items-center gap-2 shadow-xs ${
              isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-100' : 'bg-white border-slate-300 text-slate-800'
            }`}>
              <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px] font-bold">
                {userDisplayName.charAt(0)}
              </span>
              <span className="max-w-[80px] sm:max-w-none truncate">{userDisplayName}</span>
              <span className={`text-[9px] sm:text-[10px] px-1.5 py-0.5 rounded font-extrabold uppercase ml-0.5 border ${
                isDarkMode ? 'bg-indigo-950 text-indigo-300 border-indigo-800' : 'bg-indigo-100 text-indigo-800 border-indigo-200'
              }`}>
                Op
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

        {/* MAIN CONTENT AREA - EXTRA BOTTOM PADDING UTK DOCK HP */}
        <main className="max-w-6xl w-full mx-auto p-3 sm:p-4 flex-1 flex flex-col space-y-4 pb-28 sm:pb-16">
          
          {/* PANEL FORM INPUT */}
          <form onSubmit={handleSubmit} className={`backdrop-blur-md border rounded-2xl p-3.5 sm:p-4 shadow-xs shrink-0 ${
            isDarkMode 
              ? 'bg-slate-900/90 border-slate-800' 
              : 'bg-gradient-to-br from-indigo-100/90 via-slate-100/90 to-indigo-50/90 border-indigo-200/80'
          }`}>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-12 gap-3 items-end">
              
              <div className="md:col-span-3">
                <label className={`block text-[10px] font-extrabold uppercase tracking-wider mb-1 ${isDarkMode ? 'text-indigo-300' : 'text-indigo-950'}`}>NISN *</label>
                <input
                  type="text"
                  value={nisn}
                  onChange={(e) => setNisn(e.target.value)}
                  placeholder="Contoh: 0123456789"
                  className={`w-full border rounded-xl px-3 py-2 text-xs font-bold focus:outline-none focus:border-indigo-600 ${
                    isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                  }`}
                  required
                />
              </div>

              <div className="md:col-span-3">
                <label className={`block text-[10px] font-extrabold uppercase tracking-wider mb-1 ${isDarkMode ? 'text-indigo-300' : 'text-indigo-950'}`}>Nama Lengkap Siswa *</label>
                <input
                  type="text"
                  value={namaLengkap}
                  onChange={(e) => setNamaLengkap(e.target.value)}
                  placeholder="Masukkan nama siswa..."
                  className={`w-full border rounded-xl px-3 py-2 text-xs font-bold focus:outline-none focus:border-indigo-600 ${
                    isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                  }`}
                  required
                />
              </div>

              <div className="md:col-span-2">
                <label className={`block text-[10px] font-extrabold uppercase tracking-wider mb-1 ${isDarkMode ? 'text-indigo-300' : 'text-indigo-950'}`}>Jenis Kelamin *</label>
                <select
                  value={jenisKelamin}
                  onChange={(e) => setJenisKelamin(e.target.value as 'L' | 'P')}
                  className={`w-full border rounded-xl px-3 py-2 text-xs font-bold focus:outline-none focus:border-indigo-600 cursor-pointer ${
                    isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                  }`}
                  required
                >
                  <option value="L">Laki-laki (L)</option>
                  <option value="P">Perempuan (P)</option>
                </select>
              </div>

              <div className="md:col-span-2">
                <label className={`block text-[10px] font-extrabold uppercase tracking-wider mb-1 ${isDarkMode ? 'text-indigo-300' : 'text-indigo-950'}`}>Pilih Rombel / Kelas</label>
                <select
                  value={kelasId}
                  onChange={(e) => setKelasId(e.target.value)}
                  className={`w-full border rounded-xl px-3 py-2 text-xs font-bold focus:outline-none focus:border-indigo-600 cursor-pointer ${
                    isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                  }`}
                >
                  <option value="">-- Tanpa Kelas --</option>
                  {kelasList.map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.nama_kelas} (Kelas {k.tingkat})
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-2 flex gap-2 pt-1 sm:pt-0">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 sm:py-2 rounded-xl font-extrabold text-xs transition shadow-xs cursor-pointer"
                >
                  {loading ? '...' : editingId ? 'Update Data' : '+ Simpan Siswa'}
                </button>
                {editingId && (
                  <button
                    type="button"
                    onClick={resetForm}
                    className={`px-3 border text-xs font-bold rounded-xl transition cursor-pointer ${
                      isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700' : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    Batal
                  </button>
                )}
              </div>

            </div>
          </form>

          {/* PANEL DATA SISWA */}
          <div className={`backdrop-blur-md border rounded-2xl p-3.5 sm:p-4 flex-1 flex flex-col shadow-xs overflow-hidden ${
            isDarkMode 
              ? 'bg-slate-900/90 border-slate-800' 
              : 'bg-gradient-to-br from-indigo-100/90 via-slate-100/90 to-indigo-50/90 border-indigo-200/80'
          }`}>
            
            {/* FILTER & SEARCH BAR */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 mb-3 shrink-0">
              <div className="sm:col-span-6 relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="🔍 Cari NISN atau Nama Siswa..."
                  className={`w-full border rounded-xl px-3 py-2 text-xs font-bold focus:outline-none focus:border-indigo-600 ${
                    isDarkMode ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-400' : 'bg-white border-slate-300 text-slate-900'
                  }`}
                />
              </div>

              <div className="sm:col-span-6">
                <select
                  value={filterKelas}
                  onChange={(e) => setFilterKelas(e.target.value)}
                  className={`w-full border rounded-xl px-3 py-2 text-xs font-bold focus:outline-none focus:border-indigo-600 cursor-pointer ${
                    isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                  }`}
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

            {/* 1. TAMPILAN MOBILE: CARD SYSTEM (KHUSUS HP - md:hidden) */}
            <div className="block md:hidden space-y-2.5 overflow-y-auto pr-1 max-h-[60vh]">
              {loading ? (
                <div className={`p-6 text-center text-xs font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                  Memuat data siswa...
                </div>
              ) : filteredSiswa.length === 0 ? (
                <div className={`p-6 text-center text-xs font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                  Tidak ada data siswa ditemukan.
                </div>
              ) : (
                filteredSiswa.map((siswa, idx) => (
                  <div 
                    key={siswa.id} 
                    className={`p-3.5 rounded-xl border transition shadow-xs flex flex-col gap-2.5 ${
                      isDarkMode ? 'bg-slate-800/90 border-slate-700' : 'bg-white border-indigo-200/90'
                    }`}
                  >
                    {/* Header Card: Nama & Kelas */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded border ${
                          isDarkMode ? 'bg-indigo-950 text-indigo-300 border-indigo-800' : 'bg-indigo-100 text-indigo-900 border-indigo-200'
                        }`}>
                          #{idx + 1}
                        </span>
                        <h4 className={`font-extrabold text-xs sm:text-sm leading-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                          {siswa.nama_lengkap}
                        </h4>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap shrink-0 ${
                        isDarkMode ? 'bg-emerald-950 text-emerald-300 border-emerald-800' : 'bg-emerald-100 text-emerald-800 border-emerald-200'
                      }`}>
                        {siswa.nama_kelas}
                      </span>
                    </div>

                    {/* Middle Info: NISN & JK */}
                    <div className={`flex items-center justify-between text-xs border-t border-b py-2 my-0.5 ${
                      isDarkMode ? 'border-slate-700/80 text-slate-300' : 'border-slate-100 text-slate-700'
                    }`}>
                      <div>
                        <span className={`text-[9px] font-extrabold uppercase block ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                          NISN
                        </span>
                        <span className="font-mono font-bold">{siswa.nisn || '-'}</span>
                      </div>
                      <div className="text-right">
                        <span className={`text-[9px] font-extrabold uppercase block ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                          Jenis Kelamin
                        </span>
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-black inline-block mt-0.5 ${
                          siswa.jenis_kelamin === 'P' 
                            ? isDarkMode ? 'bg-pink-950/80 text-pink-300 border border-pink-800' : 'bg-pink-100 text-pink-700 border border-pink-200'
                            : isDarkMode ? 'bg-blue-950/80 text-blue-300 border border-blue-800' : 'bg-blue-100 text-blue-700 border border-blue-200'
                        }`}>
                          {siswa.jenis_kelamin === 'P' ? 'Perempuan (P)' : 'Laki-laki (L)'}
                        </span>
                      </div>
                    </div>

                    {/* Bottom Actions: Tombol Edit & Hapus */}
                    <div className="flex justify-end gap-2 pt-0.5">
                      <button
                        onClick={() => handleEdit(siswa)}
                        className={`px-3 py-1.5 border text-xs font-bold rounded-lg transition flex items-center gap-1 cursor-pointer ${
                          isDarkMode 
                            ? 'bg-amber-950/50 border-amber-800 text-amber-300 hover:bg-amber-900/60' 
                            : 'bg-amber-50 border-amber-300 text-amber-800 hover:bg-amber-100'
                        }`}
                      >
                        ✏️ Edit
                      </button>
                      <button
                        onClick={() => handleDelete(siswa.id)}
                        className={`px-3 py-1.5 border text-xs font-bold rounded-lg transition flex items-center gap-1 cursor-pointer ${
                          isDarkMode 
                            ? 'bg-rose-950/50 border-rose-800 text-rose-300 hover:bg-rose-900/60' 
                            : 'bg-rose-50 border-rose-300 text-rose-700 hover:bg-rose-100'
                        }`}
                      >
                        🗑️ Hapus
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* 2. TAMPILAN DESKTOP/TABLET: TABEL HTML (hidden md:block) */}
            <div className={`hidden md:block flex-1 overflow-y-auto rounded-xl border ${isDarkMode ? 'bg-slate-900/90 border-slate-800' : 'bg-white/90 border-indigo-200/80'}`}>
              <table className="w-full text-left border-collapse text-xs">
                <thead className={`sticky top-0 z-10 shadow-xs ${isDarkMode ? 'bg-slate-800' : 'bg-indigo-100'}`}>
                  <tr className={`border-b font-extrabold uppercase tracking-wider text-[11px] ${isDarkMode ? 'text-indigo-400 border-slate-700' : 'text-indigo-950 border-indigo-200'}`}>
                    <th className="py-2.5 px-3 w-12 text-center">NO</th>
                    <th className="py-2.5 px-3">NISN</th>
                    <th className="py-2.5 px-3">NAMA LENGKAP</th>
                    <th className="py-2.5 px-3 text-center">JK</th>
                    <th className="py-2.5 px-3">KELAS / ROMBEL</th>
                    <th className="py-2.5 px-3 text-center w-20">AKSI</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${isDarkMode ? 'divide-slate-800 text-slate-200' : 'divide-slate-200 text-slate-800'}`}>
                  {loading ? (
                    <tr>
                      <td colSpan={6} className={`py-10 text-center font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>Memuat data siswa...</td>
                    </tr>
                  ) : filteredSiswa.length === 0 ? (
                    <tr>
                      <td colSpan={6} className={`py-10 text-center font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>Tidak ada data siswa ditemukan.</td>
                    </tr>
                  ) : (
                    filteredSiswa.map((siswa, idx) => (
                      <tr key={siswa.id} className={`transition ${isDarkMode ? 'hover:bg-slate-800/60' : 'hover:bg-indigo-50/60'}`}>
                        <td className={`py-2 px-3 text-center font-bold ${isDarkMode ? 'text-slate-500' : 'text-slate-500'}`}>{idx + 1}</td>
                        <td className={`py-2 px-3 font-mono font-bold whitespace-nowrap ${isDarkMode ? 'text-slate-400' : 'text-slate-700'}`}>{siswa.nisn || '-'}</td>
                        <td className={`py-2 px-3 font-extrabold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{siswa.nama_lengkap}</td>
                        <td className="py-2 px-3 text-center font-bold">
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-black ${
                            siswa.jenis_kelamin === 'P' 
                              ? isDarkMode ? 'bg-pink-950/80 text-pink-300 border border-pink-800' : 'bg-pink-100 text-pink-700 border border-pink-200'
                              : isDarkMode ? 'bg-blue-950/80 text-blue-300 border border-blue-800' : 'bg-blue-100 text-blue-700 border border-blue-200'
                          }`}>
                            {siswa.jenis_kelamin || 'L'}
                          </span>
                        </td>
                        <td className="py-2 px-3 font-bold text-indigo-400 whitespace-nowrap">{siswa.nama_kelas}</td>
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
        <div className="pb-20 sm:pb-16 pt-1 flex justify-center shrink-0">
          <div className={`border px-4 py-0.5 rounded-full text-center text-[10px] font-medium shadow-xs transition-colors duration-300 ${
            isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-400' : 'bg-slate-100/90 border-slate-300 text-slate-700'
          }`}>
            <span>Aplikasi Guru AI</span>
            <span className="mx-2">•</span>
            <span>Created by <strong className="text-emerald-500 font-bold">MUZAINI AL KAHFI</strong></span>
          </div>
        </div>

      </div>

      {/* BOTTOM NAVIGATION DOCK */}
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
            <Link href="/siswa" className={`flex flex-col items-center gap-0.5 text-[11px] font-bold transition ${
              isDarkMode ? 'text-indigo-400' : 'text-indigo-600'
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
          <Link href="/jadwal" className={`flex flex-col items-center gap-0.5 text-[11px] font-semibold transition ${
            isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-950'
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