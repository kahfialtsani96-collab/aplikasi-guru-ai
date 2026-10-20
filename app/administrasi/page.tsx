'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { useAuthRole } from '@/hooks/useAuthRole'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const supabase = createClient(supabaseUrl, supabaseAnonKey)

interface SuratAdministrasi {
  id: number
  created_at?: string
  nomor_surat: string
  jenis_surat: string
  penerima: string
  keterangan: string
}

export default function AdministrasiTUPage() {
  const router = useRouter()
  const { isOperator, loading: loadingRole } = useAuthRole()

  const [userDisplayName, setUserDisplayName] = useState('OPERATOR')
  const [suratList, setSuratList] = useState<SuratAdministrasi[]>([])
  
  // State Form
  const [nomorSurat, setNomorSurat] = useState('')
  const [jenisSurat, setJenisSurat] = useState('Surat Keterangan Aktif Siswa')
  const [penerima, setPenerima] = useState('')
  const [keterangan, setKeterangan] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  // Guard Hak Akses Operator
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
    fetchSurat()
  }, [])

  const fetchSurat = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('surat_administrasi')
      .select('*')
      .order('id', { ascending: false })

    if (error) {
      console.error('Error fetch surat:', error.message)
    }

    if (data) {
      setSuratList(data)
    }
    setLoading(false)
  }

  const resetForm = () => {
    setNomorSurat('')
    setJenisSurat('Surat Keterangan Aktif Siswa')
    setPenerima('')
    setKeterangan('')
    setEditingId(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nomorSurat.trim() || !penerima.trim()) {
      alert('Nomor Surat dan Penerima wajib diisi!')
      return
    }

    setLoading(true)
    const payload = {
      nomor_surat: nomorSurat.trim(),
      jenis_surat: jenisSurat,
      penerima: penerima.trim(),
      keterangan: keterangan.trim(),
    }

    try {
      if (editingId) {
        const { error } = await supabase.from('surat_administrasi').update(payload).eq('id', editingId)
        if (!error) {
          alert('Berhasil memperbarui arsip surat!')
          resetForm()
          fetchSurat()
        } else {
          alert('Gagal mengupdate surat: ' + error.message)
        }
      } else {
        const { error } = await supabase.from('surat_administrasi').insert([payload])
        if (!error) {
          alert('Berhasil menyimpan arsip surat!')
          resetForm()
          fetchSurat()
        } else {
          alert('Gagal menyimpan surat: ' + error.message)
        }
      }
    } catch (err: any) {
      alert('Terjadi kesalahan: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (surat: SuratAdministrasi) => {
    setEditingId(surat.id)
    setNomorSurat(surat.nomor_surat)
    setJenisSurat(surat.jenis_surat)
    setPenerima(surat.penerima)
    setKeterangan(surat.keterangan || '')
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Hapus arsip surat ini?')) return
    const { error } = await supabase.from('surat_administrasi').delete().eq('id', id)
    if (!error) {
      fetchSurat()
    } else {
      alert('Gagal menghapus surat: ' + error.message)
    }
  }

  const filteredSurat = suratList.filter(
    (s) =>
      s.nomor_surat.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.penerima.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.jenis_surat.toLowerCase().includes(searchQuery.toLowerCase())
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
                <p className="text-[11px] text-emerald-800 font-bold mt-0.5">Administrasi &amp; Persuratan TU</p>
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

        {/* 3. MAIN CONTENT (FIXED CONTAINER) */}
        <main className="max-w-6xl w-full mx-auto p-4 flex-1 flex flex-col min-h-0">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 flex-1 min-h-0">
            
            {/* FORM INPUT SURAT */}
            <form onSubmit={handleSubmit} className="p-5 bg-gradient-to-br from-indigo-100/90 via-slate-100/90 to-indigo-50/90 backdrop-blur-md border border-indigo-200/80 rounded-2xl flex flex-col justify-between shadow-xs h-full">
              <div className="space-y-3.5 overflow-y-auto pr-1">
                <div className="flex items-center gap-2 border-b border-indigo-200/80 pb-2.5">
                  <span className="text-indigo-800 text-base">📑</span>
                  <h3 className="font-extrabold text-slate-900 text-sm">
                    {editingId ? 'Edit Arsip Surat' : 'Buat / Registrasi Surat TU'}
                  </h3>
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold text-indigo-950 uppercase tracking-wider mb-1">Nomor Surat Resmi *</label>
                  <input
                    type="text"
                    value={nomorSurat}
                    onChange={(e) => setNomorSurat(e.target.value)}
                    placeholder="Contoh: 421/001/SMP-MM/2026"
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 font-bold focus:outline-none focus:border-indigo-600"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold text-indigo-950 uppercase tracking-wider mb-1">Jenis Surat *</label>
                  <select
                    value={jenisSurat}
                    onChange={(e) => setJenisSurat(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 font-bold focus:outline-none focus:border-indigo-600 cursor-pointer"
                  >
                    <option value="Surat Keterangan Aktif Siswa">Surat Keterangan Aktif Siswa</option>
                    <option value="Surat Mutasi Siswa">Surat Mutasi Siswa</option>
                    <option value="Surat Undangan Orang Tua/Wali">Surat Undangan Orang Tua/Wali</option>
                    <option value="Surat Tugas Guru">Surat Tugas Guru</option>
                    <option value="Surat Keputusan Kepala Sekolah">Surat Keputusan Kepala Sekolah</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold text-indigo-950 uppercase tracking-wider mb-1">Penerima / Ditujukan Kepada *</label>
                  <input
                    type="text"
                    value={penerima}
                    onChange={(e) => setPenerima(e.target.value)}
                    placeholder="Nama Siswa / Guru / Instansi"
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 font-bold focus:outline-none focus:border-indigo-600"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold text-indigo-950 uppercase tracking-wider mb-1">Keterangan Ringkas / Keperluan</label>
                  <textarea
                    rows={3}
                    value={keterangan}
                    onChange={(e) => setKeterangan(e.target.value)}
                    placeholder="Catatan keperluan pembuatan surat..."
                    className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-xs text-slate-900 font-medium focus:outline-none focus:border-indigo-600 resize-none"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-3 mt-2 border-t border-indigo-200/60">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-xl font-extrabold text-xs transition shadow-xs cursor-pointer"
                >
                  {loading ? 'Menyimpan...' : editingId ? 'Update Surat' : '+ Simpan Arsip Surat'}
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

            {/* TABEL DAFTAR ARSIP SURAT */}
            <div className="lg:col-span-2 bg-gradient-to-br from-indigo-100/90 via-slate-100/90 to-indigo-50/90 backdrop-blur-md border border-indigo-200/80 rounded-2xl p-5 flex flex-col shadow-xs h-full overflow-hidden">
              <div className="flex items-center justify-between border-b border-indigo-200/80 pb-2.5 shrink-0 gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-indigo-800 text-base">📂</span>
                  <h3 className="font-extrabold text-slate-900 text-sm">Arsip Surat Keluar TU</h3>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="🔍 Cari No. / Penerima..."
                    className="bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs text-slate-900 font-bold focus:outline-none focus:border-indigo-600 w-44"
                  />
                  <button
                    onClick={fetchSurat}
                    className="text-[11px] bg-white border border-slate-300 hover:bg-slate-50 px-2.5 py-1 rounded-lg font-bold text-slate-700 transition cursor-pointer whitespace-nowrap"
                  >
                    🔄 Refresh
                  </button>
                </div>
              </div>

              <div className="mt-3 flex-1 overflow-y-auto rounded-xl border border-indigo-200/80 bg-white/90">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="sticky top-0 bg-indigo-100 z-10 shadow-xs">
                    <tr className="text-indigo-950 border-b border-indigo-200 font-extrabold uppercase tracking-wider text-[11px]">
                      <th className="py-2.5 px-3">NO. SURAT</th>
                      <th className="py-2.5 px-3">JENIS SURAT</th>
                      <th className="py-2.5 px-3">PENERIMA</th>
                      <th className="py-2.5 px-3">KEPERLUAN / KETERANGAN</th>
                      <th className="py-2.5 px-3 text-center w-20">AKSI</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-slate-800">
                    {loading ? (
                      <tr>
                        <td colSpan={5} className="py-10 text-center text-slate-600 font-medium">
                          Memuat arsip surat...
                        </td>
                      </tr>
                    ) : filteredSurat.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-10 text-center text-slate-600 font-medium">
                          Belum ada arsip surat tercatat.
                        </td>
                      </tr>
                    ) : (
                      filteredSurat.map((s) => (
                        <tr key={s.id} className="hover:bg-indigo-50/60 transition">
                          <td className="py-2.5 px-3 font-mono font-bold text-indigo-900 whitespace-nowrap">{s.nomor_surat}</td>
                          <td className="py-2.5 px-3 font-extrabold text-slate-900">{s.jenis_surat}</td>
                          <td className="py-2.5 px-3 font-bold text-slate-700">{s.penerima}</td>
                          <td className="py-2.5 px-3 font-medium text-slate-600">{s.keterangan || '-'}</td>
                          <td className="py-2.5 px-3 text-center space-x-1 whitespace-nowrap">
                            <button
                              onClick={() => handleEdit(s)}
                              className="bg-amber-50 text-amber-700 hover:bg-amber-100 p-1.5 rounded-lg border border-amber-200 transition cursor-pointer"
                              title="Edit Surat"
                            >
                              ✏️
                            </button>
                            <button
                              onClick={() => handleDelete(s.id)}
                              className="bg-rose-50 text-rose-600 hover:bg-rose-100 p-1.5 rounded-lg border border-rose-200 transition cursor-pointer"
                              title="Hapus Surat"
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