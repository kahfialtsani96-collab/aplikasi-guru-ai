'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { useAuthRole } from '@/hooks/useAuthRole'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const supabase = createClient(supabaseUrl, supabaseAnonKey)

export default function DataGuruPage() {
  const router = useRouter()
  const { isOperator, loading: loadingRole } = useAuthRole()

  // Guard Akses Khusus Operator
  useEffect(() => {
    if (!loadingRole && !isOperator) {
      router.push('/')
    }
  }, [loadingRole, isOperator, router])

  const [userDisplayName, setUserDisplayName] = useState('OPERATOR')
  const [guruList, setGuruList] = useState<any[]>([])
  const [nama, setNama] = useState('')
  const [nip, setNip] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('Guru123456!')
  const [jabatan, setJabatan] = useState('Guru Mata Pelajaran')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    async function getUserData() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const nameFromMeta = user.user_metadata?.full_name || user.email?.split('@')[0] || 'OPERATOR'
        setUserDisplayName(nameFromMeta.toUpperCase())
      }
    }
    getUserData()
    fetchGuru()
  }, [])

  const fetchGuru = async () => {
    const { data } = await supabase.from('guru').select('*').order('id', { ascending: false })
    if (data) setGuruList(data)
  }

  const resetForm = () => {
    setNama('')
    setNip('')
    setEmail('')
    setPassword('Guru123456!')
    setJabatan('Guru Mata Pelajaran')
    setEditingId(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      if (editingId) {
        // UPDATE PROFIL GURU DI DATABASE
        const { error } = await supabase
          .from('guru')
          .update({ 
            nama_lengkap: nama.trim(), 
            nip: nip.trim() ? nip.trim() : null, 
            email: email.trim(), 
            jabatan 
          })
          .eq('id', editingId)

        if (!error) {
          alert('Berhasil memperbarui data guru!')
          resetForm()
          fetchGuru()
        } else {
          alert('Gagal memperbarui guru: ' + error.message)
        }
      } else {
        // 1. BUAT AKUN SUPABASE AUTH
        if (!email.trim()) {
          alert('Email wajib diisi untuk pendaftaran akun login guru!')
          setLoading(false)
          return
        }

        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: email.trim(),
          password: password,
          options: {
            data: {
              full_name: nama.trim(),
              role: 'guru'
            }
          }
        })

        if (authError) {
          alert('Gagal membuat akun login: ' + authError.message)
          setLoading(false)
          return
        }

        // 2. SIMPAN DATA PROFIL KE TABEL GURU
        const { error: dbError } = await supabase.from('guru').insert([
          {
            nama_lengkap: nama.trim(),
            nip: nip.trim() ? nip.trim() : null,
            email: email.trim(),
            jabatan,
          }
        ])

        if (!dbError) {
          alert(`Berhasil menambah Guru baru dan Akun Auth!\n\nEmail: ${email}\nPassword Default: ${password}`)
          resetForm()
          fetchGuru()
        } else {
          alert('Akun auth terbuat tetapi gagal menyimpan ke tabel guru: ' + dbError.message)
        }
      }
    } catch (err: any) {
      alert('Terjadi kesalahan: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (guru: any) => {
    setEditingId(guru.id)
    setNama(guru.nama_lengkap || '')
    setNip(guru.nip || '')
    setEmail(guru.email || '')
    setJabatan(guru.jabatan || 'Guru Mata Pelajaran')
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Yakin ingin menghapus data guru ini? (Catatan: Akun auth perlu dihapus via Supabase Dashboard)')) return
    const { error } = await supabase.from('guru').delete().eq('id', id)
    if (!error) {
      fetchGuru()
    } else {
      alert('Gagal menghapus data guru: ' + error.message)
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
      
      {/* 1. FIXED BACKGROUND WATERMARK LOGO SCHOOL */}
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
                <img
                  src="/logo-smp.jpg"
                  alt="Logo SMP Muna Mustofa"
                  className="w-full h-full object-contain"
                />
              </div>
              <div>
                <h1 className="font-bold text-base text-slate-900 leading-none">Aplikasi Guru AI</h1>
                <p className="text-[11px] text-emerald-800 font-bold mt-0.5">Data Guru &amp; Tenaga Pendidik</p>
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

        {/* 3. MAIN CONTENT AREA (FIXED HEIGHT) */}
        <main className="max-w-6xl w-full mx-auto p-4 sm:p-5 flex-1 flex flex-col min-h-0">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 flex-1 min-h-0">
            
            {/* FORM INPUT GURU (FIXED NON-SCROLLABLE) */}
            <form onSubmit={handleSubmit} className="p-5 bg-gradient-to-br from-[#c7d2fe]/90 via-[#dbe2fe]/90 to-[#edf2ff]/90 backdrop-blur-md border border-indigo-200/80 rounded-2xl flex flex-col justify-between shadow-sm h-full">
              <div className="space-y-3">
                <div className="flex items-center gap-2 border-b border-indigo-200/80 pb-2.5">
                  <span className="text-indigo-700 text-base">👨‍🏫</span>
                  <h3 className="font-extrabold text-slate-900 text-sm">
                    {editingId ? 'Edit Data Guru' : 'Tambah Guru & Akun Login'}
                  </h3>
                </div>
                
                <div>
                  <label className="block text-[10px] font-extrabold text-indigo-900/80 uppercase tracking-wider mb-1">NIP / NUPTK</label>
                  <input
                    type="text"
                    value={nip}
                    onChange={(e) => setNip(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-900 font-mono focus:outline-none focus:border-indigo-600 font-medium"
                    placeholder="Nomor Induk Pegawai"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold text-indigo-900/80 uppercase tracking-wider mb-1">Nama Lengkap &amp; Gelar *</label>
                  <input
                    type="text"
                    value={nama}
                    onChange={(e) => setNama(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-indigo-600 font-bold"
                    placeholder="Nama Lengkap Guru"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold text-indigo-900/80 uppercase tracking-wider mb-1">Email Login *</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-indigo-600 font-medium"
                    placeholder="guru@smpmunamustofa.sch.id"
                    required
                  />
                </div>

                {!editingId && (
                  <div>
                    <label className="block text-[10px] font-extrabold text-indigo-900/80 uppercase tracking-wider mb-1">Password Default Login *</label>
                    <input
                      type="text"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-emerald-800 font-mono font-bold focus:outline-none focus:border-indigo-600"
                      required
                    />
                  </div>
                )}

                <div>
                  <label className="block text-[10px] font-extrabold text-indigo-900/80 uppercase tracking-wider mb-1">Jabatan / Peran</label>
                  <select
                    value={jabatan}
                    onChange={(e) => setJabatan(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-indigo-600 font-bold cursor-pointer"
                  >
                    <option value="Guru Mata Pelajaran">Guru Mata Pelajaran</option>
                    <option value="Guru BK">Guru BK</option>
                    <option value="Staf Tata Usaha">Staf Tata Usaha</option>
                    <option value="Kepala Sekolah">Kepala Sekolah</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-2 pt-3 mt-2 border-t border-indigo-200/50">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded-xl font-extrabold text-xs transition shadow-sm cursor-pointer"
                >
                  {loading ? 'Menyimpan...' : editingId ? 'Update Data' : '+ Simpan & Buat Akun'}
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

            {/* TABEL DAFTAR GURU (HANYA TABEL DI-SCROLL MANDIRI) */}
            <div className="lg:col-span-2 bg-gradient-to-br from-[#c7d2fe]/90 via-[#dbe2fe]/90 to-[#edf2ff]/90 backdrop-blur-md border border-indigo-200/80 rounded-2xl p-5 flex flex-col shadow-sm h-full overflow-hidden">
              <div className="flex items-center gap-2 border-b border-indigo-200/80 pb-2.5 shrink-0">
                <span className="text-indigo-700 text-base">📋</span>
                <h3 className="font-extrabold text-slate-900 text-sm">Daftar Guru SMP Muna Mustofa</h3>
              </div>

              <div className="mt-3 flex-1 overflow-y-auto rounded-xl border border-indigo-200/80 bg-white/90">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="sticky top-0 bg-indigo-100 z-10 shadow-xs">
                    <tr className="text-indigo-950 border-b border-indigo-200 font-extrabold uppercase tracking-wider text-[11px]">
                      <th className="py-2.5 px-3">NIP / NUPTK</th>
                      <th className="py-2.5 px-3">NAMA LENGKAP</th>
                      <th className="py-2.5 px-3">EMAIL LOGIN</th>
                      <th className="py-2.5 px-3">JABATAN</th>
                      <th className="py-2.5 px-3 text-center w-24">AKSI</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-slate-800">
                    {guruList.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-12 text-center text-slate-600 font-medium">
                          Belum ada data guru terdaftar.
                        </td>
                      </tr>
                    ) : (
                      guruList.map((g) => (
                        <tr key={g.id} className="hover:bg-indigo-50/60 transition">
                          <td className="py-2.5 px-3 font-mono font-bold text-slate-700 whitespace-nowrap">{g.nip || '-'}</td>
                          <td className="py-2.5 px-3 font-extrabold text-slate-900">{g.nama_lengkap}</td>
                          <td className="py-2.5 px-3 font-bold text-indigo-700">{g.email || '-'}</td>
                          <td className="py-2.5 px-3 font-semibold text-slate-800 whitespace-nowrap">
                            <span className="bg-indigo-100 text-indigo-900 px-2 py-1 rounded-md text-[10px] font-extrabold border border-indigo-200 inline-block">
                              {g.jabatan || 'Guru'}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-center space-x-1.5 whitespace-nowrap">
                            <button
                              onClick={() => handleEdit(g)}
                              className="bg-amber-50 text-amber-700 hover:bg-amber-100 p-1.5 rounded-lg border border-amber-200 transition cursor-pointer"
                              title="Edit Guru"
                            >
                              ✏️
                            </button>
                            <button
                              onClick={() => handleDelete(g.id)}
                              className="bg-rose-50 text-rose-600 hover:bg-rose-100 p-1.5 rounded-lg border border-rose-200 transition cursor-pointer"
                              title="Hapus Guru"
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
            <Link href="/guru" className="flex flex-col items-center gap-0.5 text-[11px] font-bold text-indigo-700 transition">
              <span className="text-base">👨‍🏫</span>
              <span>Guru</span>
            </Link>
          )}

          <Link href="/jadwal" className="flex flex-col items-center gap-0.5 text-[11px] font-semibold text-slate-600 hover:text-slate-950 transition">
            <span className="text-base">🎓</span>
            <span>Akademik</span>
          </Link>

          <Link href="/ai" className="flex flex-col items-center gap-0.5 text-[11px] font-semibold text-slate-600 hover:text-slate-950 transition">
            <span className="text-base">✨</span>
            <span>AI Tools</span>
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