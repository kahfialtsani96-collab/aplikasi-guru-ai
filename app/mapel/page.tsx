'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const supabase = createClient(supabaseUrl, supabaseAnonKey)

interface Mapel {
  id?: string
  nama_mapel: string
  semester: string
  tahun_ajaran: string
}

export default function KelolaMapelPage() {
  const [userDisplayName, setUserDisplayName] = useState('GURU')
  const [namaMapel, setNamaMapel] = useState('')
  const [semester, setSemester] = useState('Ganjil')
  const [tahunAjaran, setTahunAjaran] = useState('2026/2027')
  const [mapelList, setMapelList] = useState<Mapel[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    // Ambil data akun user dari Supabase Auth
    async function getUserData() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const nameFromMeta = user.user_metadata?.full_name || user.email?.split('@')[0] || 'GURU'
        setUserDisplayName(nameFromMeta.toUpperCase())
      }
    }
    getUserData()
    fetchMapel()
  }, [])

  // Ambil daftar mata pelajaran dari Supabase
  async function fetchMapel() {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('mapel')
        .select('*')
        .order('created_at', { ascending: false })

      if (!error && data) {
        setMapelList(data)
      }
    } catch (err) {
      console.error('Error fetching mapel:', err)
    } finally {
      setLoading(false)
    }
  }

  // Tambah Mata Pelajaran Baru
  const handleTambahMapel = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!namaMapel.trim()) return

    try {
      const { error } = await supabase.from('mapel').insert([
        {
          nama_mapel: namaMapel.trim(),
          semester: semester,
          tahun_ajaran: tahunAjaran.trim(),
        },
      ])

      if (error) {
        alert('Gagal menambah mata pelajaran: ' + error.message)
      } else {
        setNamaMapel('')
        fetchMapel()
      }
    } catch (err: any) {
      alert('Error: ' + err.message)
    }
  }

  // Hapus Mata Pelajaran
  const handleDelete = async (id?: string) => {
    if (!id || !confirm('Yakin ingin menghapus mata pelajaran ini?')) return

    try {
      const { error } = await supabase.from('mapel').delete().eq('id', id)
      if (!error) {
        setMapelList((prev) => prev.filter((item) => item.id !== id))
      }
    } catch (err) {
      console.error('Error deleting mapel:', err)
    }
  }

  return (
    <div className="min-h-screen bg-[#0b0f19] text-slate-100 font-sans flex flex-col justify-between selection:bg-indigo-500 selection:text-white">
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
                <p className="text-[11px] text-sky-400 font-medium mt-1">Kelola Mata Pelajaran</p>
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

            <div className="bg-slate-900 border border-slate-800 p-1 rounded-xl flex items-center gap-1">
              <button className="bg-amber-400 text-slate-950 p-1.5 rounded-lg text-xs font-bold shadow-sm">
                ☀️
              </button>
              <button className="text-slate-400 p-1.5 rounded-lg text-xs hover:text-white transition">
                🌙
              </button>
            </div>

            <button
              onClick={async () => {
                await supabase.auth.signOut()
                window.location.href = '/login'
              }}
              className="bg-rose-950/40 border border-rose-800/50 hover:bg-rose-900/60 text-rose-400 p-2 rounded-xl transition"
              title="Keluar"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </header>

        {/* MAIN CONTENT */}
        <main className="max-w-6xl mx-auto p-6 space-y-6">
          
          {/* MAIN CARD SECTION */}
          <div className="bg-[#111827] border border-slate-800/80 rounded-2xl p-6 min-h-[480px] space-y-6 flex flex-col justify-between">
            
            <div className="space-y-6">
              {/* Header Title */}
              <div className="flex items-center gap-3 border-b border-slate-800/80 pb-5">
                <div className="w-10 h-10 bg-purple-950/80 text-purple-400 rounded-xl flex items-center justify-center text-lg">
                  📖
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">Kelola Mata Pelajaran</h2>
                  <p className="text-xs text-slate-400">
                    Tambah dan kelola mata pelajaran yang diampu untuk semester berjalan.
                  </p>
                </div>
              </div>

              {/* Form Input Bar */}
              <form
                onSubmit={handleTambahMapel}
                className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end bg-[#0d1322]/80 border border-slate-800/80 p-4 rounded-xl"
              >
                <div className="md:col-span-5">
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                    NAMA MATA PELAJARAN *
                  </label>
                  <input
                    type="text"
                    value={namaMapel}
                    onChange={(e) => setNamaMapel(e.target.value)}
                    placeholder="Contoh: Matematika / Bahasa Indonesia"
                    className="w-full bg-[#111827] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                    required
                  />
                </div>

                <div className="md:col-span-3">
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                    SEMESTER
                  </label>
                  <select
                    value={semester}
                    onChange={(e) => setSemester(e.target.value)}
                    className="w-full bg-[#111827] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500 cursor-pointer"
                  >
                    <option value="Ganjil">Ganjil</option>
                    <option value="Genap">Genap</option>
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                    TAHUN AJARAN
                  </label>
                  <input
                    type="text"
                    value={tahunAjaran}
                    onChange={(e) => setTahunAjaran(e.target.value)}
                    placeholder="2026/2027"
                    className="w-full bg-[#111827] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="md:col-span-2">
                  <button
                    type="submit"
                    className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-2.5 rounded-xl text-xs transition shadow-lg shadow-blue-600/20 flex items-center justify-center gap-1.5"
                  >
                    <span>+ Tambah</span>
                  </button>
                </div>
              </form>

              {/* Table Data Mapel */}
              <div className="overflow-x-auto rounded-xl border border-slate-800/80">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-[#0d1322] text-slate-400 border-b border-slate-800 font-bold uppercase tracking-wider">
                      <th className="py-3 px-4 w-12 text-center">NO</th>
                      <th className="py-3 px-4">MATA PELAJARAN</th>
                      <th className="py-3 px-4 text-center">SEMESTER</th>
                      <th className="py-3 px-4 text-center">TAHUN AJARAN</th>
                      <th className="py-3 px-4 text-center w-24">AKSI</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-300">
                    {loading ? (
                      <tr>
                        <td colSpan={5} className="py-12 text-center text-slate-400">
                          Memuat data mata pelajaran...
                        </td>
                      </tr>
                    ) : mapelList.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-16 text-center text-slate-500">
                          Belum ada mata pelajaran terdaftar.
                        </td>
                      </tr>
                    ) : (
                      mapelList.map((item, index) => (
                        <tr key={item.id || index} className="hover:bg-slate-800/40 transition">
                          <td className="py-3 px-4 text-center font-medium text-slate-400">{index + 1}</td>
                          <td className="py-3 px-4 font-semibold text-white">{item.nama_mapel}</td>
                          <td className="py-3 px-4 text-center">
                            <span className="bg-slate-800 text-purple-300 px-2.5 py-1 rounded-md text-[11px] font-medium border border-slate-700/60">
                              {item.semester}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center font-mono text-slate-300">{item.tahun_ajaran}</td>
                          <td className="py-3 px-4 text-center">
                            <button
                              onClick={() => handleDelete(item.id)}
                              className="bg-rose-950/60 text-rose-400 hover:bg-rose-900/80 p-1.5 rounded-lg border border-rose-800/50 transition"
                              title="Hapus Mata Pelajaran"
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
      </div>

      {/* BOTTOM NAVIGATION DOCK & FOOTER */}
      <div className="border-t border-slate-800/80 bg-[#0d1322]/95 backdrop-blur-md sticky bottom-0 z-50">
        <div className="max-w-md mx-auto px-6 py-2.5 flex items-center justify-between">
          <Link
            href="/"
            className="flex flex-col items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-300 transition"
          >
            <span className="text-lg">🕒</span>
            <span>Dashboard</span>
          </Link>

          <Link
            href="/siswa"
            className="flex flex-col items-center gap-1 text-xs font-medium text-sky-400 transition"
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