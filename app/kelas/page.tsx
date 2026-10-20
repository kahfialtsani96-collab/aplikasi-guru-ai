'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
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
      <div className="h-screen bg-[#E2E8F0] text-slate-700 p-8 flex items-center justify-center font-sans">
        <div className="bg-white/90 backdrop-blur-md border border-slate-300 p-6 rounded-2xl text-center space-y-2 shadow-md">
          <p className="text-slate-900 font-bold text-sm">Memeriksa Hak Akses Operator...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen bg-[#E2E8F0] text-slate-800 font-sans flex flex-col justify-between selection:bg-emerald-500 selection:text-white overflow-hidden relative">
      
      {/* 1. WATERMARK LOGO */}
      <div className="fixed inset-0 pointer-events-none z-0 flex items-center justify-center opacity-[0.15] select-none">
        <img
          src="/logo-smp.jpg"
          alt="Watermark SMP Muna Mustofa"
          className="w-[850px] h-[850px] object-contain max-w-none"
        />
      </div>

      <div className="relative z-10 flex flex-col h-full overflow-hidden">
        {/* 2. HEADER TOPBAR GLASSMORPHISM */}
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
                <p className="text-[11px] text-emerald-800 font-bold mt-0.5">Kelola Kelas &amp; Wali Kelas</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="bg-emerald-100/80 border border-emerald-300 text-emerald-800 text-xs font-semibold px-3 py-1.5 rounded-full flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse"></span>
              <span>Supabase Live</span>
            </div>

            <div className="bg-white border border-slate-300 text-slate-800 text-xs font-bold px-3.5 py-1.5 rounded-xl flex items-center gap-2 shadow-xs">
              <span className="w-5 h-5 rounded-full bg-emerald-700 text-white flex items-center justify-center text-[10px] font-bold">
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

        {/* 3. MAIN CONTENT AREA (FIXED CONTAINER) */}
        <main className="max-w-6xl w-full mx-auto p-4 sm:p-5 flex-1 flex flex-col min-h-0">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 flex-1 min-h-0">
            
            {/* FORM INPUT KELAS */}
            <form onSubmit={handleSubmit} className="p-5 bg-gradient-to-br from-emerald-100/90 via-slate-100/90 to-emerald-50/90 backdrop-blur-md border border-emerald-300/80 rounded-2xl flex flex-col justify-between shadow-sm h-full">
              <div className="space-y-4">
                <div className="flex items-center gap-2 border-b border-emerald-300/80 pb-2.5">
                  <span className="text-emerald-800 text-base">🏫</span>
                  <h3 className="font-extrabold text-slate-900 text-sm">
                    {editingId ? 'Edit Data Rombel' : 'Tambah Rombel Kelas'}
                  </h3>
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold text-emerald-950 uppercase tracking-wider mb-1">Tingkat Kelas *</label>
                  <select
                    value={tingkat}
                    onChange={(e) => setTingkat(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-600 font-bold cursor-pointer"
                  >
                    <option value="7">Kelas 7 (SMP)</option>
                    <option value="8">Kelas 8 (SMP)</option>
                    <option value="9">Kelas 9 (SMP)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold text-emerald-950 uppercase tracking-wider mb-1">Nama Rombel / Kelas *</label>
                  <input
                    type="text"
                    value={namaKelas}
                    onChange={(e) => setNamaKelas(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-600 font-bold"
                    placeholder="Contoh: VII A, VIII B, IX C"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold text-emerald-950 uppercase tracking-wider mb-1">Tugaskan Wali Kelas</label>
                  <select
                    value={waliKelasId}
                    onChange={(e) => setWaliKelasId(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-600 font-bold cursor-pointer"
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

              <div className="flex gap-2 pt-3 mt-2 border-t border-emerald-300/50">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-emerald-800 hover:bg-emerald-700 text-white py-2.5 rounded-xl font-extrabold text-xs transition shadow-sm cursor-pointer"
                >
                  {loading ? 'Menyimpan...' : editingId ? 'Update Kelas' : '+ Simpan Rombel Kelas'}
                </button>

                {editingId && (
                  <button
                    type="button"
                    onClick={resetForm}
                    className="px-3 bg-white border border-slate-300 hover:bg-slate-100 text-xs text-slate-700 font-bold rounded-xl transition cursor-pointer"
                  >
                    Batal
                  </button>
                )}
              </div>
            </form>

            {/* TABEL DAFTAR KELAS (SCROLLABLE MANDIRI) */}
            <div className="lg:col-span-2 bg-gradient-to-br from-emerald-100/90 via-slate-100/90 to-emerald-50/90 backdrop-blur-md border border-emerald-300/80 rounded-2xl p-5 flex flex-col shadow-sm h-full overflow-hidden">
              <div className="flex items-center justify-between border-b border-emerald-300/80 pb-2.5 shrink-0">
                <div className="flex items-center gap-2">
                  <span className="text-emerald-800 text-base">📋</span>
                  <h3 className="font-extrabold text-slate-900 text-sm">Daftar Rombel SMP Muna Mustofa</h3>
                </div>
                <button
                  onClick={fetchData}
                  className="text-[11px] bg-white border border-slate-300 hover:bg-slate-50 px-2.5 py-1 rounded-lg font-bold text-slate-700 transition cursor-pointer"
                >
                  🔄 Refresh Data
                </button>
              </div>

              <div className="mt-3 flex-1 overflow-y-auto rounded-xl border border-emerald-300/80 bg-white/90">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="sticky top-0 bg-emerald-100 z-10 shadow-xs">
                    <tr className="text-emerald-950 border-b border-emerald-200 font-extrabold uppercase tracking-wider text-[11px]">
                      <th className="py-2.5 px-4">TINGKAT</th>
                      <th className="py-2.5 px-4">NAMA KELAS</th>
                      <th className="py-2.5 px-4">WALI KELAS TERPILIH</th>
                      <th className="py-2.5 px-4 text-center w-24">AKSI</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-slate-800">
                    {kelasList.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-12 text-center text-slate-600 font-medium">
                          Belum ada rombel kelas terdaftar.
                        </td>
                      </tr>
                    ) : (
                      kelasList.map((k) => (
                        <tr key={k.id} className="hover:bg-emerald-50/60 transition">
                          <td className="py-2.5 px-4 font-bold text-slate-700 whitespace-nowrap">Kelas {k.tingkat}</td>
                          <td className="py-2.5 px-4 font-black text-emerald-900 text-sm whitespace-nowrap">{k.nama_kelas}</td>
                          <td className="py-2.5 px-4 font-semibold text-slate-800 whitespace-nowrap">
                            {k.nama_wali ? (
                              <span className="bg-emerald-100 text-emerald-900 px-2.5 py-1 rounded-md text-[11px] font-extrabold border border-emerald-200 inline-block">
                                👤 {k.nama_wali}
                              </span>
                            ) : (
                              <span className="text-slate-400 italic text-[11px]">(Belum Ditentukan)</span>
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
          <div className="bg-slate-100/90 border border-slate-300 px-4 py-1 rounded-full text-center text-[10px] text-slate-700 font-medium shadow-xs">
            <span>Aplikasi Guru AI</span>
            <span className="mx-2">•</span>
            <span>Created by <strong className="text-emerald-900 font-bold">MUZAINI AL KAHFI</strong></span>
          </div>
        </div>
      </div>

      {/* 4. BOTTOM NAVIGATION DOCK */}
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