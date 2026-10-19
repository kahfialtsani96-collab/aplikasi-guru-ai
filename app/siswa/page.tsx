'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { useAuthRole } from '@/hooks/useAuthRole'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const supabase = createClient(supabaseUrl, supabaseAnonKey)

interface Siswa {
  id?: string
  nisn: string
  nama_lengkap: string
  kelas_id?: number
  kelas?: {
    nama_kelas: string
  }
}

export default function MasterSiswaPage() {
  const router = useRouter()
  const { isOperator, loading: loadingRole } = useAuthRole()

  // Guard Operator Access
  useEffect(() => {
    if (!loadingRole && !isOperator) {
      router.push('/')
    }
  }, [loadingRole, isOperator, router])

  const [userDisplayName, setUserDisplayName] = useState('OPERATOR')
  const [nisn, setNisn] = useState('')
  const [namaLengkap, setNamaLengkap] = useState('')
  const [selectedKelasId, setSelectedKelasId] = useState('')
  const [kelasList, setKelasList] = useState<{ id: number; nama_kelas: string }[]>([])

  const [selectedFilterKelasId, setSelectedFilterKelasId] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [siswaList, setSiswaList] = useState<Siswa[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    async function initPage() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const nameFromMeta = user.user_metadata?.full_name || user.email?.split('@')[0] || 'OPERATOR'
        setUserDisplayName(nameFromMeta.toUpperCase())
      }

      // Load Master Kelas untuk Dropdown
      const { data: dataKelas } = await supabase
        .from('kelas')
        .select('id, nama_kelas')
        .order('id', { ascending: true })

      if (dataKelas) {
        setKelasList(dataKelas)
      }
    }
    initPage()
  }, [])

  // Load Siswa Berdasarkan Filter Kelas
  useEffect(() => {
    async function fetchSiswa() {
      if (!selectedFilterKelasId) {
        setSiswaList([])
        return
      }

      setLoading(true)
      try {
        let query = supabase
          .from('siswa')
          .select('*, kelas(nama_kelas)')
          .eq('kelas_id', selectedFilterKelasId)

        if (searchQuery.trim()) {
          query = query.or(`nama_lengkap.ilike.%${searchQuery.trim()}%,nisn.ilike.%${searchQuery.trim()}%`)
        }

        const { data, error } = await query

        if (!error && data) {
          setSiswaList(data)
        } else {
          setSiswaList([])
        }
      } catch (err) {
        console.error('Error fetching siswa:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchSiswa()
  }, [selectedFilterKelasId, searchQuery])

  // Simpan Siswa Baru
  const handleSimpanSiswa = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nisn.trim() || !namaLengkap.trim() || !selectedKelasId) {
      alert('Silakan lengkapi NISN, Nama Lengkap, dan Pilih Kelas!')
      return
    }

    setSaving(true)
    try {
      const { error } = await supabase.from('siswa').insert([
        {
          nisn: nisn.trim(),
          nama_lengkap: namaLengkap.trim(),
          kelas_id: parseInt(selectedKelasId),
        },
      ])

      if (error) {
        alert('Gagal menyimpan siswa: ' + error.message)
      } else {
        alert('Data siswa berhasil disimpan!')
        setNisn('')
        setNamaLengkap('')
        setSelectedKelasId('')
        
        if (selectedFilterKelasId === selectedKelasId) {
          const currentFilter = selectedFilterKelasId
          setSelectedFilterKelasId('')
          setTimeout(() => setSelectedFilterKelasId(currentFilter), 100)
        }
      }
    } catch (err: any) {
      alert('Error: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  // Hapus Siswa
  const handleDeleteSiswa = async (id?: string) => {
    if (!id || !confirm('Yakin ingin menghapus data siswa ini?')) return

    try {
      const { error } = await supabase.from('siswa').delete().eq('id', id)
      if (!error) {
        setSiswaList((prev) => prev.filter((item) => item.id !== id))
      }
    } catch (err) {
      console.error('Error deleting siswa:', err)
    }
  }

  if (loadingRole || !isOperator) {
    return (
      <div className="min-h-screen bg-[#E2E8F0] text-slate-700 p-8 flex items-center justify-center font-sans">
        <div className="bg-white/90 backdrop-blur-md border border-slate-300 p-6 rounded-2xl text-center space-y-2 shadow-md">
          <p className="text-slate-900 font-bold text-sm">Memeriksa Hak Akses Operator...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#E2E8F0] text-slate-800 font-sans flex flex-col justify-between selection:bg-indigo-500 selection:text-white pb-32 relative overflow-x-hidden">
      
      {/* 1. FIXED BACKGROUND WATERMARK LOGO SCHOOL */}
      <div className="fixed inset-0 pointer-events-none z-0 flex items-center justify-center opacity-[0.15] select-none">
        <img
          src="/logo-smp.jpg"
          alt="Watermark SMP Muna Mustofa"
          className="w-[850px] h-[850px] object-contain max-w-none"
        />
      </div>

      <div className="relative z-10">
        {/* 2. HEADER TOPBAR GLASSMORPHISM */}
        <header className="bg-slate-100/90 backdrop-blur-md border-b border-slate-300 px-6 py-3 flex items-center justify-between sticky top-0 z-50 shadow-xs">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-slate-600 hover:text-slate-900 p-1.5 rounded-lg transition" title="Kembali ke Dashboard">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </Link>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl overflow-hidden flex items-center justify-center bg-white border border-slate-300 p-0.5 shadow-xs shrink-0">
                <img
                  src="/logo-smp.jpg"
                  alt="Logo SMP Muna Mustofa"
                  className="w-full h-full object-contain"
                />
              </div>
              <div>
                <h1 className="font-bold text-base text-slate-900 leading-none">Aplikasi Guru AI</h1>
                <p className="text-[11px] text-emerald-800 font-bold mt-1">Kelola Master Data Siswa</p>
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
                window.location.href = '/login'
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

        {/* 3. MAIN CONTENT AREA */}
        <main className="max-w-6xl mx-auto p-6 space-y-6">
          <div className="bg-gradient-to-br from-[#c7d2fe]/90 via-[#dbe2fe]/90 to-[#edf2ff]/90 backdrop-blur-md border border-indigo-200/80 rounded-2xl p-6 space-y-6 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-indigo-200/80 pb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/80 border border-indigo-200 text-indigo-700 flex items-center justify-center text-xl shadow-xs">
                  👥
                </div>
                <div>
                  <h2 className="text-xl font-extrabold text-slate-900">Kelola Master Data Siswa</h2>
                  <p className="text-xs text-slate-700 font-medium mt-0.5">
                    Kelola daftar seluruh siswa, NISN, dan alokasi kelas terpusat.
                  </p>
                </div>
              </div>
            </div>

            {/* FORM INPUT SISWA BARU */}
            <form onSubmit={handleSimpanSiswa} className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end bg-white/80 border border-indigo-200/80 p-4.5 rounded-xl shadow-xs">
              <div className="md:col-span-3">
                <label className="block text-[11px] font-extrabold text-indigo-900/80 uppercase tracking-wider mb-2">
                  NISN *
                </label>
                <input
                  type="text"
                  value={nisn}
                  onChange={(e) => setNisn(e.target.value)}
                  placeholder="Contoh: 0012345678"
                  className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 font-medium focus:outline-none focus:border-indigo-600"
                  required
                />
              </div>

              <div className="md:col-span-4">
                <label className="block text-[11px] font-extrabold text-indigo-900/80 uppercase tracking-wider mb-2">
                  NAMA LENGKAP *
                </label>
                <input
                  type="text"
                  value={namaLengkap}
                  onChange={(e) => setNamaLengkap(e.target.value)}
                  placeholder="Nama lengkap siswa"
                  className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 font-medium focus:outline-none focus:border-indigo-600"
                  required
                />
              </div>

              <div className="md:col-span-3">
                <label className="block text-[11px] font-extrabold text-indigo-900/80 uppercase tracking-wider mb-2">
                  KELAS *
                </label>
                <select
                  value={selectedKelasId}
                  onChange={(e) => setSelectedKelasId(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 font-medium focus:outline-none focus:border-indigo-600 cursor-pointer"
                  required
                >
                  <option value="">-- Pilih Kelas --</option>
                  {kelasList.map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.nama_kelas}
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold py-2.5 rounded-xl text-xs transition shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <span>+ Simpan</span>
                </button>
              </div>
            </form>
          </div>

          {/* TABEL DATA SISWA */}
          <div className="bg-gradient-to-br from-[#c7d2fe]/90 via-[#dbe2fe]/90 to-[#edf2ff]/90 backdrop-blur-md border border-indigo-200/80 rounded-2xl p-6 space-y-6 min-h-[360px] shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="relative w-full sm:w-72">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500 text-xs">
                  🔍
                </span>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari NISN atau Nama..."
                  className="w-full bg-white border border-slate-300 rounded-xl pl-8 pr-3 py-2 text-xs text-slate-900 font-medium focus:outline-none focus:border-indigo-600"
                />
              </div>

              <div className="w-full sm:w-72">
                <select
                  value={selectedFilterKelasId}
                  onChange={(e) => setSelectedFilterKelasId(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs text-slate-900 font-bold focus:outline-none focus:border-indigo-600 cursor-pointer"
                >
                  <option value="">-- Pilih Kelas untuk Melihat Siswa --</option>
                  {kelasList.map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.nama_kelas}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-indigo-200/80 bg-white/90">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-indigo-100/80 text-indigo-950 border-b border-indigo-200 font-extrabold uppercase tracking-wider">
                    <th className="py-3 px-4 w-12 text-center">NO</th>
                    <th className="py-3 px-4">NISN</th>
                    <th className="py-3 px-4">NAMA LENGKAP</th>
                    <th className="py-3 px-4">KELAS</th>
                    <th className="py-3 px-4 text-center w-24">AKSI</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-slate-800">
                  {!selectedFilterKelasId ? (
                    <tr>
                      <td colSpan={5} className="py-20 text-center text-slate-600 font-medium">
                        Silakan pilih kelas pada dropdown filter di atas untuk menampilkan daftar siswa.
                      </td>
                    </tr>
                  ) : loading ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-slate-600 font-medium">
                        Memuat data siswa...
                      </td>
                    </tr>
                  ) : siswaList.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-16 text-center text-slate-600 font-medium">
                        Tidak ada data siswa ditemukan di kelas ini.
                      </td>
                    </tr>
                  ) : (
                    siswaList.map((item, index) => (
                      <tr key={item.id || index} className="hover:bg-indigo-50/60 transition">
                        <td className="py-3 px-4 text-center font-bold text-slate-500">{index + 1}</td>
                        <td className="py-3 px-4 font-mono font-bold text-slate-700">{item.nisn}</td>
                        <td className="py-3 px-4 font-extrabold text-slate-900">{item.nama_lengkap}</td>
                        <td className="py-3 px-4 font-semibold text-slate-800">
                          <span className="bg-indigo-100 text-indigo-900 px-2.5 py-1 rounded-md text-[11px] font-extrabold border border-indigo-200">
                            {item.kelas?.nama_kelas || '-'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <button
                            onClick={() => handleDeleteSiswa(item.id)}
                            className="bg-rose-50 text-rose-600 hover:bg-rose-100 p-1.5 rounded-lg border border-rose-200 transition cursor-pointer"
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
      </div>

      {/* 4. BOTTOM NAVIGATION DOCK */}
      <div className="border-t border-slate-300 bg-slate-100/95 backdrop-blur-md fixed bottom-0 left-0 right-0 z-50 shadow-lg">
        <div className="max-w-xl mx-auto px-4 py-2.5 flex items-center justify-between">
          <Link href="/" className="flex flex-col items-center gap-1 text-xs font-semibold text-slate-600 hover:text-slate-950 transition">
            <span className="text-lg">🕒</span>
            <span>Dashboard</span>
          </Link>
          <Link href="/siswa" className="flex flex-col items-center gap-1 text-xs font-bold text-indigo-700 transition">
            <span className="text-lg">👥</span>
            <span>Siswa</span>
          </Link>
          <Link href="/guru" className="flex flex-col items-center gap-1 text-xs font-semibold text-slate-600 hover:text-slate-950 transition">
            <span className="text-lg">👨‍🏫</span>
            <span>Guru</span>
          </Link>
          <Link href="/jadwal" className="flex flex-col items-center gap-1 text-xs font-semibold text-slate-600 hover:text-slate-950 transition">
            <span className="text-lg">🎓</span>
            <span>Akademik</span>
          </Link>
          <Link href="/ai" className="flex flex-col items-center gap-1 text-xs font-semibold text-slate-600 hover:text-slate-950 transition">
            <span className="text-lg">✨</span>
            <span>AI Tools</span>
          </Link>
          <Link href="/laporan" className="flex flex-col items-center gap-1 text-xs font-semibold text-slate-600 hover:text-slate-950 transition">
            <span className="text-lg">🖨️</span>
            <span>Laporan</span>
          </Link>
        </div>
      </div>
    </div>
  )
}