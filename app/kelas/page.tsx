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

interface Guru {
  id: number
  nama_lengkap: string
  nip?: string
}

interface Kelas {
  id: number
  nama_kelas: string
  tingkat: string
  wali_kelas_id: number | null
  nama_wali?: string
}

export default function KelolaKelasPage() {
  const router = useRouter()
  const { isOperator, loading: loadingRole } = useAuthRole()

  const [userDisplayName, setUserDisplayName] = useState('OPERATOR')
  const [kelasList, setKelasList] = useState<Kelas[]>([])
  const [guruList, setGuruList] = useState<Guru[]>([])
  
  const [tingkat, setTingkat] = useState('7')
  const [namaKelas, setNamaKelas] = useState('')
  const [waliKelasId, setWaliKelasId] = useState<string>('')
  const [editingId, setEditingId] = useState<number | null>(null)
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
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)

    // 1. Fetch Master Guru
    const { data: dataGuru } = await supabase
      .from('guru')
      .select('id, nama_lengkap, nip')
      .order('nama_lengkap', { ascending: true })

    const guruMap = new Map<number, string>()
    if (dataGuru) {
      setGuruList(dataGuru)
      dataGuru.forEach((g) => guruMap.set(g.id, g.nama_lengkap))
    }

    // 2. Fetch Data Kelas (Tanpa join otomatis agar anti-fail)
    const { data: dataKelas, error } = await supabase
      .from('kelas')
      .select('*')
      .order('id', { ascending: true })

    if (error) {
      console.error('Error fetch kelas:', error.message)
    }

    if (dataKelas) {
      const formattedKelas: Kelas[] = dataKelas.map((k) => ({
        ...k,
        nama_wali: k.wali_kelas_id ? guruMap.get(k.wali_kelas_id) || 'Wali Kelas Tidak Ditemukan' : undefined,
      }))
      setKelasList(formattedKelas)
    }

    setLoading(false)
  }

  const resetForm = () => {
    setTingkat('7')
    setNamaKelas('')
    setWaliKelasId('')
    setEditingId(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!namaKelas.trim()) {
      alert('Nama kelas wajib diisi!')
      return
    }

    setLoading(true)
    const payload = {
      tingkat,
      nama_kelas: namaKelas.trim(),
      wali_kelas_id: waliKelasId ? Number(waliKelasId) : null,
    }

    try {
      if (editingId) {
        const { error } = await supabase.from('kelas').update(payload).eq('id', editingId)
        if (!error) {
          alert('Berhasil memperbarui data kelas!')
          resetForm()
          fetchData()
        } else {
          alert('Gagal update kelas: ' + error.message)
        }
      } else {
        const { error } = await supabase.from('kelas').insert([payload])
        if (!error) {
          alert('Berhasil menambah rombongan belajar baru!')
          resetForm()
          fetchData()
        } else {
          alert('Gagal menambah kelas: ' + error.message)
        }
      }
    } catch (err: any) {
      alert('Terjadi kesalahan: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (kelas: Kelas) => {
    setEditingId(kelas.id)
    setTingkat(kelas.tingkat || '7')
    setNamaKelas(kelas.nama_kelas || '')
    setWaliKelasId(kelas.wali_kelas_id ? String(kelas.wali_kelas_id) : '')
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Hapus kelas ini? Data siswa terkait kelas ini perlu disesuaikan kembali.')) return
    const { error } = await supabase.from('kelas').delete().eq('id', id)
    if (!error) {
      fetchData()
    } else {
      alert('Gagal menghapus kelas: ' + error.message)
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
      className={`h-screen font-sans flex flex-col justify-between selection:bg-emerald-500 selection:text-white overflow-hidden relative transition-colors duration-300 ${
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
        {/* 2. HEADER TOPBAR GLASSMORPHISM */}
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
                <p className={`text-[11px] font-bold mt-0.5 ${isDarkMode ? 'text-emerald-400' : 'text-emerald-800'}`}>Kelola Kelas &amp; Wali Kelas</p>
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
              <span className="w-5 h-5 rounded-full bg-emerald-700 text-white flex items-center justify-center text-[10px] font-bold">
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

        {/* 3. MAIN CONTENT AREA (FIXED CONTAINER) */}
        <main className="max-w-6xl w-full mx-auto p-4 sm:p-5 flex-1 flex flex-col min-h-0">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 flex-1 min-h-0">
            
            {/* FORM INPUT KELAS */}
            <form onSubmit={handleSubmit} className={`p-5 backdrop-blur-md border rounded-2xl flex flex-col justify-between shadow-xs h-full ${
              isDarkMode 
                ? 'bg-slate-900/90 border-slate-800' 
                : 'bg-gradient-to-br from-emerald-100/90 via-slate-100/90 to-emerald-50/90 border-emerald-300/80'
            }`}>
              <div className="space-y-4">
                <div className={`flex items-center gap-2 border-b pb-2.5 ${isDarkMode ? 'border-slate-800' : 'border-emerald-300/80'}`}>
                  <span className="text-emerald-500 text-base">🏫</span>
                  <h3 className={`font-extrabold text-sm ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                    {editingId ? 'Edit Data Rombel' : 'Tambah Rombel Kelas'}
                  </h3>
                </div>

                <div>
                  <label className={`block text-[10px] font-extrabold uppercase tracking-wider mb-1 ${isDarkMode ? 'text-emerald-400' : 'text-emerald-950'}`}>Tingkat Kelas *</label>
                  <select
                    value={tingkat}
                    onChange={(e) => setTingkat(e.target.value)}
                    className={`w-full border rounded-xl px-3 py-2 text-xs font-bold focus:outline-none focus:border-emerald-600 cursor-pointer ${
                      isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                    }`}
                  >
                    <option value="7">Kelas 7 (SMP)</option>
                    <option value="8">Kelas 8 (SMP)</option>
                    <option value="9">Kelas 9 (SMP)</option>
                  </select>
                </div>

                <div>
                  <label className={`block text-[10px] font-extrabold uppercase tracking-wider mb-1 ${isDarkMode ? 'text-emerald-400' : 'text-emerald-950'}`}>Nama Rombel / Kelas *</label>
                  <input
                    type="text"
                    value={namaKelas}
                    onChange={(e) => setNamaKelas(e.target.value)}
                    className={`w-full border rounded-xl px-3 py-2 text-xs font-bold focus:outline-none focus:border-emerald-600 ${
                      isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                    }`}
                    placeholder="Contoh: VII A, VIII B, IX C"
                    required
                  />
                </div>

                <div>
                  <label className={`block text-[10px] font-extrabold uppercase tracking-wider mb-1 ${isDarkMode ? 'text-emerald-400' : 'text-emerald-950'}`}>Tugaskan Wali Kelas</label>
                  <select
                    value={waliKelasId}
                    onChange={(e) => setWaliKelasId(e.target.value)}
                    className={`w-full border rounded-xl px-3 py-2 text-xs font-bold focus:outline-none focus:border-emerald-600 cursor-pointer ${
                      isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                    }`}
                  >
                    <option value="">-- Belum Ditentukan --</option>
                    {guruList.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.nama_lengkap} {g.nip ? `(${g.nip})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className={`flex gap-2 pt-3 mt-2 border-t ${isDarkMode ? 'border-slate-800' : 'border-emerald-300/50'}`}>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-emerald-800 hover:bg-emerald-700 text-white py-2.5 rounded-xl font-extrabold text-xs transition shadow-xs cursor-pointer"
                >
                  {loading ? 'Menyimpan...' : editingId ? 'Update Kelas' : '+ Simpan Rombel Kelas'}
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
            </form>

            {/* TABEL DAFTAR KELAS (SCROLLABLE MANDIRI) */}
            <div className={`lg:col-span-2 backdrop-blur-md border rounded-2xl p-5 flex flex-col shadow-xs h-full overflow-hidden ${
              isDarkMode 
                ? 'bg-slate-900/90 border-slate-800' 
                : 'bg-gradient-to-br from-emerald-100/90 via-slate-100/90 to-emerald-50/90 border-emerald-300/80'
            }`}>
              <div className={`flex items-center justify-between border-b pb-2.5 shrink-0 ${isDarkMode ? 'border-slate-800' : 'border-emerald-300/80'}`}>
                <div className="flex items-center gap-2">
                  <span className="text-emerald-500 text-base">📋</span>
                  <h3 className={`font-extrabold text-sm ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Daftar Rombel SMP Muna Mustofa</h3>
                </div>
                <button
                  onClick={fetchData}
                  className={`text-[11px] border px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
                    isDarkMode 
                      ? 'bg-slate-800 border-slate-700 hover:bg-slate-700 text-slate-200' 
                      : 'bg-white border-slate-300 hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  🔄 Refresh Data
                </button>
              </div>

              <div className={`mt-3 flex-1 overflow-y-auto rounded-xl border ${isDarkMode ? 'bg-slate-900/90 border-slate-800' : 'bg-white/90 border-emerald-300/80'}`}>
                <table className="w-full text-left border-collapse text-xs">
                  <thead className={`sticky top-0 z-10 shadow-xs ${isDarkMode ? 'bg-slate-800' : 'bg-emerald-100'}`}>
                    <tr className={`border-b font-extrabold uppercase tracking-wider text-[11px] ${isDarkMode ? 'text-emerald-400 border-slate-700' : 'text-emerald-950 border-emerald-200'}`}>
                      <th className="py-2.5 px-4">TINGKAT</th>
                      <th className="py-2.5 px-4">NAMA KELAS</th>
                      <th className="py-2.5 px-4">WALI KELAS TERPILIH</th>
                      <th className="py-2.5 px-4 text-center w-24">AKSI</th>
                    </tr>
                  </thead>
                  <tbody className={`divide-y ${isDarkMode ? 'divide-slate-800 text-slate-200' : 'divide-slate-200 text-slate-800'}`}>
                    {kelasList.length === 0 ? (
                      <tr>
                        <td colSpan={4} className={`py-12 text-center font-medium ${isDarkMode ? 'text-slate-500' : 'text-slate-600'}`}>
                          Belum ada rombel kelas terdaftar.
                        </td>
                      </tr>
                    ) : (
                      kelasList.map((k) => (
                        <tr key={k.id} className={`transition ${isDarkMode ? 'hover:bg-slate-800/60' : 'hover:bg-emerald-50/60'}`}>
                          <td className={`py-2.5 px-4 font-bold whitespace-nowrap ${isDarkMode ? 'text-slate-400' : 'text-slate-700'}`}>Kelas {k.tingkat}</td>
                          <td className="py-2.5 px-4 font-black text-emerald-400 text-sm whitespace-nowrap">{k.nama_kelas}</td>
                          <td className="py-2.5 px-4 font-semibold whitespace-nowrap">
                            {k.nama_wali ? (
                              <span className={`px-2.5 py-1 rounded-md text-[11px] font-extrabold border inline-block ${
                                isDarkMode 
                                  ? 'bg-emerald-950 text-emerald-300 border-emerald-800' 
                                  : 'bg-emerald-100 text-emerald-900 border-emerald-200'
                              }`}>
                                👤 {k.nama_wali}
                              </span>
                            ) : (
                              <span className={`italic text-[11px] ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>(Belum Ditentukan)</span>
                            )}
                          </td>
                          <td className="py-2.5 px-4 text-center space-x-1.5 whitespace-nowrap">
                            <button
                              onClick={() => handleEdit(k)}
                              className="bg-amber-50 text-amber-700 hover:bg-amber-100 p-1.5 rounded-lg border border-amber-200 transition cursor-pointer"
                              title="Edit Kelas"
                            >
                              ✏️
                            </button>
                            <button
                              onClick={() => handleDelete(k.id)}
                              className="bg-rose-50 text-rose-600 hover:bg-rose-100 p-1.5 rounded-lg border border-rose-200 transition cursor-pointer"
                              title="Hapus Kelas"
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
        </main>

        {/* FOOTER BADGE */}
        <div className="pb-16 pt-1 flex justify-center shrink-0">
          <div className={`border px-4 py-1 rounded-full text-center text-[10px] font-medium shadow-xs transition-colors duration-300 ${
            isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-400' : 'bg-slate-100/90 border-slate-300 text-slate-700'
          }`}>
            <span>Aplikasi Guru AI</span>
            <span className="mx-2">•</span>
            <span>Created by <strong className="text-emerald-500 font-bold">MUZAINI AL KAHFI</strong></span>
          </div>
        </div>
      </div>

      {/* 4. BOTTOM NAVIGATION DOCK */}
      <div className={`border-t fixed bottom-0 left-0 right-0 z-50 shadow-lg transition-colors duration-300 ${
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