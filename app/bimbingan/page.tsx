'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { useAuthRole } from '@/hooks/useAuthRole'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const supabase = createClient(supabaseUrl, supabaseAnonKey)

interface SiswaPerwalian {
  id?: string | number
  nama_lengkap: string
  nisn?: string
  jenis_kelamin?: string
  kelas_id?: number
}

interface BimbinganRecord {
  id?: string
  created_at?: string
  tanggal: string
  nama_siswa: string
  kelas: string
  jenis_masalah: string
  masalah: string
  solusi: string
  keterangan_hukuman?: string
  is_penanganan_selesai?: boolean
}

export default function BimbinganWaliPage() {
  const router = useRouter()
  const [userDisplayName, setUserDisplayName] = useState('GURU WALI')
  const [activeTab, setActiveTab] = useState<'input' | 'rekap'>('rekap')

  const [assignedKelas, setAssignedKelas] = useState<string>('')
  const [assignedKelasId, setAssignedKelasId] = useState<number | null>(null)

  const { isOperator, canAccessBimbingan, loading: loadingRole } = useAuthRole()

  useEffect(() => {
    if (!loadingRole && !canAccessBimbingan) {
      router.push('/jadwal')
    }
  }, [loadingRole, canAccessBimbingan, router])

  const [listPerwalian, setListPerwalian] = useState<SiswaPerwalian[]>([])

  // State Input Catatan Bimbingan
  const [selectedSiswaNama, setSelectedSiswaNama] = useState('')
  const [tanggal, setTanggal] = useState('')
  const [jenisMasalah, setJenisMasalah] = useState('Akademik')
  const [masalah, setMasalah] = useState('')
  const [solusi, setSolusi] = useState('')

  const [bimbinganList, setBimbinganList] = useState<BimbinganRecord[]>([])
  const [saving, setSaving] = useState(false)

  // State Rekapitulasi
  const [rekapList, setRekapList] = useState<BimbinganRecord[]>([])
  const [filterJenis, setFilterJenis] = useState('')
  const [searchKataKunci, setSearchKataKunci] = useState('')
  const [loadingRekap, setLoadingRekap] = useState(false)

  useEffect(() => {
    async function initWaliPage() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const nameFromMeta = user.user_metadata?.full_name || user.email?.split('@')[0] || 'PENGGUNA'
        setUserDisplayName(nameFromMeta.toUpperCase())

        // 1. Jika OPERATOR -> Load Seluruh Data
        if (isOperator) {
          setAssignedKelas('SEMUA KELAS (OPERATOR)')
          fetchDataForOperator()
          return
        }

        // 2. Jika GURU WALI -> Cari Kelas Binaannya
        if (user.email) {
          const { data: guruData } = await supabase
            .from('guru')
            .select('id')
            .eq('email', user.email)
            .maybeSingle()

          if (guruData) {
            const { data: kelasData } = await supabase
              .from('kelas')
              .select('id, nama_kelas')
              .eq('wali_kelas_id', guruData.id)
              .maybeSingle()

            if (kelasData) {
              setAssignedKelas(kelasData.nama_kelas)
              setAssignedKelasId(kelasData.id)
              fetchPerwalianAndBimbingan(kelasData.id, kelasData.nama_kelas)
            } else {
              setAssignedKelas('BELUM DIPETAKAN KELAS')
            }
          }
        }
      }
    }

    const todayStr = new Date().toISOString().split('T')[0]
    setTanggal(todayStr)

    if (!loadingRole) {
      initWaliPage()
    }
  }, [isOperator, loadingRole])

  // Load Seluruh Data untuk Operator
  async function fetchDataForOperator() {
    setLoadingRekap(true)
    try {
      const { data: dataSiswa } = await supabase
        .from('siswa')
        .select('id, nama_lengkap, nisn, jenis_kelamin, kelas_id')
        .order('nama_lengkap', { ascending: true })
      if (dataSiswa) setListPerwalian(dataSiswa)

      let query = supabase.from('bimbingan_wali').select('*').order('created_at', { ascending: false })
      if (filterJenis) query = query.eq('jenis_masalah', filterJenis)
      if (searchKataKunci.trim()) {
        query = query.or(`nama_siswa.ilike.%${searchKataKunci.trim()}%,masalah.ilike.%${searchKataKunci.trim()}%`)
      }

      const { data: dataBimbingan } = await query
      if (dataBimbingan) {
        setBimbinganList(dataBimbingan)
        setRekapList(dataBimbingan)
      }
    } catch (err) {
      console.error('Error operator fetch:', err)
    } finally {
      setLoadingRekap(false)
    }
  }

  // Load Data Spesifik Kelas untuk Wali Kelas
  async function fetchPerwalianAndBimbingan(kelasId: number, namaKelas: string) {
    setLoadingRekap(true)
    try {
      const { data: dataSiswa } = await supabase
        .from('siswa')
        .select('id, nama_lengkap, nisn, jenis_kelamin, kelas_id')
        .eq('kelas_id', kelasId)
        .order('nama_lengkap', { ascending: true })
      if (dataSiswa) setListPerwalian(dataSiswa)

      let query = supabase.from('bimbingan_wali').select('*').eq('kelas', namaKelas).order('created_at', { ascending: false })
      if (filterJenis) query = query.eq('jenis_masalah', filterJenis)
      if (searchKataKunci.trim()) {
        query = query.or(`nama_siswa.ilike.%${searchKataKunci.trim()}%,masalah.ilike.%${searchKataKunci.trim()}%`)
      }

      const { data: dataBimbingan } = await query
      if (dataBimbingan) {
        setBimbinganList(dataBimbingan)
        setRekapList(dataBimbingan)
      }
    } catch (err) {
      console.error('Error wali fetch:', err)
    } finally {
      setLoadingRekap(false)
    }
  }

  useEffect(() => {
    if (isOperator) {
      fetchDataForOperator()
    } else if (assignedKelasId && assignedKelas) {
      fetchPerwalianAndBimbingan(assignedKelasId, assignedKelas)
    }
  }, [activeTab, filterJenis, searchKataKunci])

  const handleSimpanBimbingan = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedSiswaNama || !masalah.trim() || !tanggal) {
      alert('Silakan pilih Siswa dan isi Detail Permasalahan!')
      return
    }

    setSaving(true)
    try {
      const targetKelas = isOperator ? 'UMUM' : assignedKelas
      const { error } = await supabase.from('bimbingan_wali').insert([
        {
          tanggal,
          nama_siswa: selectedSiswaNama,
          kelas: targetKelas,
          jenis_masalah: jenisMasalah,
          masalah: masalah.trim(),
          solusi: solusi.trim(),
          is_penanganan_selesai: false,
        },
      ])

      if (!error) {
        alert('Catatan kasus bimbingan berhasil disimpan!')
        setMasalah('')
        setSolusi('')
        setSelectedSiswaNama('')
        if (isOperator) fetchDataForOperator()
        else if (assignedKelasId && assignedKelas) fetchPerwalianAndBimbingan(assignedKelasId, assignedKelas)
      } else {
        alert('Gagal menyimpan: ' + error.message)
      }
    } catch (err: any) {
      alert('Error: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  // Fungsi Khusus Operator: Konfirmasi & Catat Tindak Lanjut Hukuman
  const handleTindakLanjutiOperator = async (item: BimbinganRecord) => {
    const defaultKeterangan = item.keterangan_hukuman || 'Anak tersebut sudah dihukum sesuai tata tertib sekolah.'
    const inputKeterangan = prompt(
      `Konfirmasi Penanganan untuk ${item.nama_siswa}:\nMasukkan keterangan tindak lanjut hukuman:`,
      defaultKeterangan
    )

    if (inputKeterangan === null) return // Batal

    try {
      const { error } = await supabase
        .from('bimbingan_wali')
        .update({
          keterangan_hukuman: inputKeterangan.trim(),
          is_penanganan_selesai: true,
        })
        .eq('id', item.id)

      if (!error) {
        alert('Status penanganan & hukuman berhasil dikonfirmasi!')
        if (isOperator) fetchDataForOperator()
        else if (assignedKelasId && assignedKelas) fetchPerwalianAndBimbingan(assignedKelasId, assignedKelas)
      } else {
        alert('Gagal mengupdate penanganan: ' + error.message)
      }
    } catch (err: any) {
      alert('Error: ' + err.message)
    }
  }

  const handleDeleteBimbingan = async (id?: string) => {
    if (!id || !confirm('Hapus catatan bimbingan ini?')) return
    const { error } = await supabase.from('bimbingan_wali').delete().eq('id', id)
    if (!error) {
      if (isOperator) fetchDataForOperator()
      else if (assignedKelasId && assignedKelas) fetchPerwalianAndBimbingan(assignedKelasId, assignedKelas)
    }
  }

  if (loadingRole || !canAccessBimbingan) {
    return (
      <div className="h-screen bg-[#E2E8F0] text-slate-700 p-8 flex items-center justify-center font-sans">
        <div className="bg-white/90 backdrop-blur-md border border-slate-300 p-6 rounded-2xl text-center space-y-2 shadow-md">
          <p className="text-slate-900 font-bold text-sm">Memeriksa Hak Akses...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen bg-[#E2E8F0] text-slate-800 font-sans flex flex-col justify-between selection:bg-indigo-500 selection:text-white overflow-hidden relative">
      <div className="fixed inset-0 pointer-events-none z-0 flex items-center justify-center opacity-[0.15] select-none">
        <img src="/logo-smp.jpg" alt="Watermark SMP Muna Mustofa" className="w-[850px] h-[850px] object-contain max-w-none" />
      </div>

      <div className="relative z-10 flex flex-col h-full overflow-hidden">
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
                <p className="text-[11px] text-emerald-800 font-bold mt-0.5">
                  Pencatatan Bimbingan Siswa ({assignedKelas})
                </p>
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
                {isOperator ? 'Operator' : 'Guru Wali'}
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

        <main className="max-w-6xl w-full mx-auto p-4 flex-1 flex flex-col min-h-0 space-y-3">
          <div className="flex items-center justify-between shrink-0">
            <div className="grid grid-cols-2 bg-white/80 p-1 rounded-xl border border-slate-300 w-full max-w-md text-xs font-bold shadow-xs">
              <button
                onClick={() => setActiveTab('input')}
                className={`py-1.5 rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer ${
                  activeTab === 'input' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>💖</span> Catat Kasus / Bimbingan
              </button>
              <button
                onClick={() => setActiveTab('rekap')}
                className={`py-1.5 rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer ${
                  activeTab === 'rekap' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-950'
                }`}
              >
                <span>📜</span> Rekapitulasi Kasus
              </button>
            </div>
          </div>

          {/* TAB 1: FORM INPUT */}
          {activeTab === 'input' && (
            <div className="bg-gradient-to-br from-[#c7d2fe]/90 via-[#dbe2fe]/90 to-[#edf2ff]/90 backdrop-blur-md border border-indigo-200/80 rounded-2xl p-4 flex-1 flex flex-col min-h-0 shadow-sm overflow-hidden">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 flex-1 min-h-0 overflow-y-auto pr-1">
                <div className="lg:col-span-4 bg-white/80 border border-indigo-200/80 p-3.5 rounded-xl space-y-2.5 h-fit shadow-xs">
                  <h3 className="text-[11px] font-extrabold text-indigo-950 uppercase tracking-wider border-b border-indigo-200/80 pb-2">
                    👥 DAFTAR SISWA ({listPerwalian.length})
                  </h3>
                  <div className="max-h-72 overflow-y-auto space-y-1.5 pr-1">
                    {listPerwalian.length === 0 ? (
                      <p className="text-xs text-slate-500 text-center py-4">Belum ada siswa terdaftar.</p>
                    ) : (
                      listPerwalian.map((siswa, i) => (
                        <div
                          key={siswa.id || i}
                          onClick={() => setSelectedSiswaNama(siswa.nama_lengkap)}
                          className={`bg-white border p-2 rounded-xl flex items-center justify-between text-xs cursor-pointer transition ${
                            selectedSiswaNama === siswa.nama_lengkap
                              ? 'border-indigo-600 bg-indigo-50/80 text-indigo-950 font-black'
                              : 'border-slate-200 hover:border-indigo-300 font-bold text-slate-800'
                          }`}
                        >
                          <span className="truncate">{siswa.nama_lengkap}</span>
                          <span className="text-[10px] text-slate-500 font-mono">{siswa.nisn || '-'}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="lg:col-span-8 bg-white/80 border border-indigo-200/80 p-3.5 rounded-xl space-y-3 h-fit shadow-xs">
                  <h3 className="text-[11px] font-extrabold text-indigo-950 uppercase tracking-wider border-b border-indigo-200/80 pb-2">
                    ✍️ INPUT MASALAH &amp; SOLUSI BIMBINGAN
                  </h3>

                  <form onSubmit={handleSimpanBimbingan} className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-extrabold text-slate-700 uppercase mb-1">
                          PILIH SISWA BERMASALAH *
                        </label>
                        <select
                          value={selectedSiswaNama}
                          onChange={(e) => setSelectedSiswaNama(e.target.value)}
                          className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-900 font-bold focus:outline-none focus:border-indigo-600 cursor-pointer"
                          required
                        >
                          <option value="">-- Pilih Siswa --</option>
                          {listPerwalian.map((siswa, i) => (
                            <option key={siswa.id || i} value={siswa.nama_lengkap}>
                              {siswa.nama_lengkap} ({siswa.nisn || 'No NISN'})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] font-extrabold text-slate-700 uppercase mb-1">
                          TANGGAL KEJADIAN *
                        </label>
                        <input
                          type="date"
                          value={tanggal}
                          onChange={(e) => setTanggal(e.target.value)}
                          className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-900 font-bold focus:outline-none focus:border-indigo-600"
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-extrabold text-slate-700 uppercase mb-1">
                        JENIS MASALAH / KATEGORI *
                      </label>
                      <select
                        value={jenisMasalah}
                        onChange={(e) => setJenisMasalah(e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-900 font-bold focus:outline-none focus:border-indigo-600 cursor-pointer"
                      >
                        <option value="Akademik">Akademik (Nilai / Keterlambatan Tugas)</option>
                        <option value="Karakter/Sikap">Karakter / Sikap / Etika</option>
                        <option value="Kedisiplinan">Kedisiplinan (Absensi / Seragam)</option>
                        <option value="Pribadi/Sosial">Pribadi / Sosial / Perundungan</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-extrabold text-slate-700 uppercase mb-1">
                        DESKRIPSI MASALAH / KASUS *
                      </label>
                      <textarea
                        rows={3}
                        value={masalah}
                        onChange={(e) => setMasalah(e.target.value)}
                        placeholder="Jelaskan secara ringkas permasalahan siswa..."
                        className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-xs text-slate-900 font-medium focus:outline-none focus:border-indigo-600 resize-none"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-extrabold text-slate-700 uppercase mb-1">
                        SOLUSI / TINDAK LANJUT WALI KELAS
                      </label>
                      <textarea
                        rows={3}
                        value={solusi}
                        onChange={(e) => setSolusi(e.target.value)}
                        placeholder="Hasil pembinaan, konseling, atau panggilan orang tua..."
                        className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-xs text-slate-900 font-medium focus:outline-none focus:border-indigo-600 resize-none"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={saving}
                      className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold py-2 rounded-xl text-xs transition shadow-xs cursor-pointer"
                    >
                      {saving ? 'Menyimpan...' : '+ Simpan Catatan Bimbingan'}
                    </button>
                  </form>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: REKAPITULASI DENGAN KOLOM KETERANGAN HUKUMAN & TOMBOL CENTANG */}
          {activeTab === 'rekap' && (
            <div className="bg-gradient-to-br from-[#c7d2fe]/90 via-[#dbe2fe]/90 to-[#edf2ff]/90 backdrop-blur-md border border-indigo-200/80 rounded-2xl p-4 flex-1 flex flex-col min-h-0 shadow-sm overflow-hidden">
              <div className="flex-1 overflow-y-auto rounded-xl border border-indigo-200/80 bg-white/90">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="sticky top-0 bg-indigo-100 z-10 shadow-xs">
                    <tr className="text-indigo-950 border-b border-indigo-200 font-extrabold uppercase tracking-wider text-[11px]">
                      <th className="py-2.5 px-3">TANGGAL</th>
                      <th className="py-2.5 px-3">KELAS</th>
                      <th className="py-2.5 px-3">NAMA SISWA</th>
                      <th className="py-2.5 px-3">JENIS MASALAH</th>
                      <th className="py-2.5 px-3">DESKRIPSI KASUS</th>
                      <th className="py-2.5 px-3">SOLUSI WALI KELAS</th>
                      <th className="py-2.5 px-3">PENANGANAN HUKUMAN</th>
                      <th className="py-2.5 px-3 text-center w-20">AKSI</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-slate-800">
                    {loadingRekap ? (
                      <tr>
                        <td colSpan={8} className="py-10 text-center text-slate-600 font-medium">Memuat data...</td>
                      </tr>
                    ) : rekapList.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-10 text-center text-slate-600 font-medium">Belum ada catatan kasus bimbingan.</td>
                      </tr>
                    ) : (
                      rekapList.map((item, index) => (
                        <tr key={item.id || index} className="hover:bg-indigo-50/60 transition">
                          <td className="py-2.5 px-3 font-mono font-bold text-slate-700 whitespace-nowrap">{item.tanggal}</td>
                          <td className="py-2.5 px-3 font-bold text-indigo-800 whitespace-nowrap">{item.kelas}</td>
                          <td className="py-2.5 px-3 font-extrabold text-slate-900">{item.nama_siswa}</td>
                          <td className="py-2.5 px-3 font-bold text-indigo-700 whitespace-nowrap">{item.jenis_masalah}</td>
                          <td className="py-2.5 px-3 font-medium text-slate-800">{item.masalah}</td>
                          <td className="py-2.5 px-3 font-medium text-slate-600">{item.solusi || '-'}</td>
                          
                          {/* KOLOM KETERANGAN HUKUMAN / PENANGANAN */}
                          <td className="py-2.5 px-3 font-medium">
                            {item.is_penanganan_selesai ? (
                              <div className="space-y-0.5">
                                <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 text-[10px] font-extrabold px-2 py-0.5 rounded-md inline-flex items-center gap-1">
                                  <span>✅</span> Selesai Ditindak
                                </span>
                                <p className="text-[11px] text-slate-700 italic font-semibold mt-0.5">
                                  "{item.keterangan_hukuman || 'Sudah dihukum sesuai tata tertib sekolah.'}"
                                </p>
                              </div>
                            ) : (
                              <span className="bg-amber-100 text-amber-800 border border-amber-300 text-[10px] font-bold px-2 py-0.5 rounded-md inline-block">
                                ⏳ Menunggu Tindak Lanjut
                              </span>
                            )}
                          </td>

                          {/* KOLOM AKSI (CENTANG HIJAU KHUSUS OPERATOR) */}
                          <td className="py-2.5 px-3 text-center whitespace-nowrap space-x-1">
                            {isOperator && (
                              <button
                                onClick={() => handleTindakLanjutiOperator(item)}
                                className="bg-emerald-100 hover:bg-emerald-200 text-emerald-700 p-1.5 rounded-lg border border-emerald-300 transition cursor-pointer"
                                title="Konfirmasi &amp; Isikan Keterangan Hukuman"
                              >
                                ✅
                              </button>
                            )}

                            <button
                              onClick={() => handleDeleteBimbingan(item.id)}
                              className="bg-rose-50 text-rose-600 hover:bg-rose-100 p-1.5 rounded-lg border border-rose-200 transition cursor-pointer"
                              title="Hapus"
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
          )}
        </main>

        <div className="pb-16 pt-1 flex justify-center shrink-0">
          <div className="bg-slate-100/90 border border-slate-300 px-4 py-0.5 rounded-full text-center text-[10px] text-slate-700 font-medium shadow-xs">
            <span>Aplikasi Guru AI</span>
            <span className="mx-2">•</span>
            <span>Created by <strong className="text-emerald-900 font-bold">MUZAINI AL KAHFI</strong></span>
          </div>
        </div>
      </div>

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