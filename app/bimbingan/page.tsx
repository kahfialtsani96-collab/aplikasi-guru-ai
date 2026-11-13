'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { motion } from 'framer-motion'
import { useAuthRole } from '@/hooks/useAuthRole'

// Helper instansiasi Supabase aman untuk mencegah error prerender SSG Vercel
const getSupabaseUrl = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://kvrulbdvgxfrtmznpjnm.supabase.co'
  return url.replace(/['"]/g, '').trim()
}

const getSupabaseAnonKey = () => {
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder'
  return key.replace(/['"]/g, '').trim()
}

const supabase = createClient(getSupabaseUrl(), getSupabaseAnonKey())

interface SiswaPerwalian {
  id?: string | number
  nama_lengkap: string
  nisn?: string
  jenis_kelamin?: string
  kelas_id?: number
  kelas?: {
    nama_kelas: string
  }
}

interface OptionItem {
  id: number
  nama: string
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
  const [userDisplayName, setUserDisplayName] = useState('MEMUAT...')
  const [userNuptkDisplay, setUserNuptkDisplay] = useState('-')
  const [isStrictOperatorRole, setIsStrictOperatorRole] = useState(false)
  const [waliKelasAssignedId, setWaliKelasAssignedId] = useState<number | null>(null)
  const [activeTab, setActiveTab] = useState<'input' | 'rekap'>('rekap')
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  const { isOperator, loading: loadingRole } = useAuthRole()

  // Helper format NUPTK agar bersih (jika kosong/null/EMPTY menjadi '-')
  const formatNuptk = (val: unknown): string => {
    if (!val) return '-'
    const str = String(val).trim()
    if (
      str === '' ||
      str.toUpperCase() === 'EMPTY' ||
      str.toUpperCase() === 'NULL' ||
      str === '-'
    ) {
      return '-'
    }
    return str
  }

  // DETEKSI OTOMATIS TEMA DARK MODE DARI LOCAL STORAGE
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false)

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme')
    if (savedTheme === 'dark') {
      setIsDarkMode(true)
    }
  }, [])

  // Options Kelas
  const [kelasList, setKelasList] = useState<OptionItem[]>([])
  const [selectedKelasIdInput, setSelectedKelasIdInput] = useState<string>('')

  // State Siswa
  const [allSiswaList, setAllSiswaList] = useState<SiswaPerwalian[]>([])

  // State Input Catatan Bimbingan
  const [selectedSiswaNama, setSelectedSiswaNama] = useState('')
  const [tanggal, setTanggal] = useState('')
  const [jenisMasalah, setJenisMasalah] = useState('Akademik')
  const [masalah, setMasalah] = useState('')
  const [solusi, setSolusi] = useState('')

  const [saving, setSaving] = useState(false)

  // State Rekapitulasi
  const [rekapList, setRekapList] = useState<BimbinganRecord[]>([])
  const [filterKelasIdRekap, setFilterKelasIdRekap] = useState('')
  const [filterJenis, setFilterJenis] = useState('')
  const [searchKataKunci, setSearchKataKunci] = useState('')
  const [loadingRekap, setLoadingRekap] = useState(false)

  useEffect(() => {
    let isMounted = true

    async function initPage() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        if (isMounted) router.replace('/login')
        return
      }

      const rawEmail = user.email || ''
      const cleanEmail = rawEmail.trim().toLowerCase()

      // Ambil identitas lengkap dari tabel master `guru`
      const { data: dataGuruLogin } = await supabase
        .from('guru')
        .select('id, nama_lengkap, role, NUPTK, email, jabatan')
        .ilike('email', cleanEmail)
        .maybeSingle()

      if (isMounted) {
        if (dataGuruLogin && dataGuruLogin.nama_lengkap) {
          const namaLengkapResmi = dataGuruLogin.nama_lengkap.trim()
          const cleanNuptk = formatNuptk(dataGuruLogin.NUPTK)
          const isUserStrictOperator =
            (dataGuruLogin.role || '').toLowerCase() === 'operator'

          setUserDisplayName(namaLengkapResmi.toUpperCase())
          setUserNuptkDisplay(cleanNuptk)
          setIsStrictOperatorRole(isUserStrictOperator)

          if (!isUserStrictOperator && dataGuruLogin.id) {
            const { data: kelasBinaan } = await supabase
              .from('kelas')
              .select('id')
              .eq('wali_kelas_id', dataGuruLogin.id)
              .limit(1)
              .maybeSingle()

            if (isMounted) {
              setWaliKelasAssignedId(kelasBinaan?.id || null)
            }
          }
        } else {
          const fallbackName =
            user.user_metadata?.full_name || cleanEmail.split('@')[0] || 'GURU'
          setUserDisplayName(fallbackName.toUpperCase())
          setUserNuptkDisplay('-')
          setIsStrictOperatorRole(isOperator)
        }
      }

      // Load Master Kelas
      const { data: dataKelas } = await supabase
        .from('kelas')
        .select('id, nama_kelas')
        .order('nama_kelas', { ascending: true })
      if (dataKelas && isMounted) {
        setKelasList(dataKelas.map((k: any) => ({ id: k.id, nama: k.nama_kelas })))
      }

      // Load Seluruh Data Siswa
      fetchSiswaList()
    }

    const todayStr = new Date().toISOString().split('T')[0]
    setTanggal(todayStr)

    if (!loadingRole) {
      initPage()
    }

    return () => {
      isMounted = false
    }
  }, [loadingRole, isOperator, router])

  // Fetch Siswa (Bisa Difilter Kelas di Tab Input)
  async function fetchSiswaList(kelasId?: string) {
    try {
      let query = supabase
        .from('siswa')
        .select('id, nama_lengkap, nisn, jenis_kelamin, kelas_id')
        .order('nama_lengkap', { ascending: true })

      if (kelasId) {
        query = query.eq('kelas_id', Number(kelasId))
      }

      const { data } = await query
      if (data) setAllSiswaList(data)
    } catch (err) {
      console.error('Error fetching siswa:', err)
    }
  }

  useEffect(() => {
    fetchSiswaList(selectedKelasIdInput)
  }, [selectedKelasIdInput])

  // Fetch Rekapitulasi Bimbingan
  async function fetchRekapBimbingan() {
    setLoadingRekap(true)
    try {
      let query = supabase
        .from('bimbingan_wali')
        .select('*')
        .order('created_at', { ascending: false })

      if (filterKelasIdRekap) {
        const kelasObj = kelasList.find((k) => String(k.id) === filterKelasIdRekap)
        if (kelasObj) {
          query = query.eq('kelas', kelasObj.nama)
        }
      }

      if (filterJenis) query = query.eq('jenis_masalah', filterJenis)

      if (searchKataKunci.trim()) {
        query = query.or(`nama_siswa.ilike.%${searchKataKunci.trim()}%,masalah.ilike.%${searchKataKunci.trim()}%`)
      }

      const { data } = await query
      if (data) {
        setRekapList(data)
      } else {
        setRekapList([])
      }
    } catch (err) {
      console.error('Error rekap fetch:', err)
    } finally {
      setLoadingRekap(false)
    }
  }

  useEffect(() => {
    if (activeTab === 'rekap') {
      fetchRekapBimbingan()
    }
  }, [activeTab, filterKelasIdRekap, filterJenis, searchKataKunci, kelasList])

  // Simpan Bimbingan
  const handleSimpanBimbingan = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedSiswaNama || !masalah.trim() || !tanggal) {
      alert('Silakan pilih Siswa dan isi Detail Permasalahan!')
      return
    }

    setSaving(true)
    try {
      const targetSiswa = allSiswaList.find((s) => s.nama_lengkap === selectedSiswaNama)
      let namaKelas = 'UMUM'

      if (targetSiswa && targetSiswa.kelas_id) {
        const kObj = kelasList.find((k) => k.id === targetSiswa.kelas_id)
        if (kObj) namaKelas = kObj.nama
      }

      const { error } = await supabase.from('bimbingan_wali').insert([
        {
          tanggal,
          nama_siswa: selectedSiswaNama,
          kelas: namaKelas,
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
        setActiveTab('rekap')
        fetchRekapBimbingan()
      } else {
        alert('Gagal menyimpan: ' + error.message)
      }
    } catch (err: any) {
      alert('Error: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  // Operator: Konfirmasi Tindak Lanjut
  const handleTindakLanjutiOperator = async (item: BimbinganRecord) => {
    if (!isOperator) return

    const defaultKeterangan = item.keterangan_hukuman || 'Anak tersebut sudah dihukum sesuai tata tertib sekolah.'
    const inputKeterangan = prompt(
      `Konfirmasi Penanganan untuk ${item.nama_siswa}:\nMasukkan keterangan tindak lanjut hukuman:`,
      defaultKeterangan
    )

    if (inputKeterangan === null) return

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
        fetchRekapBimbingan()
      } else {
        alert('Gagal mengupdate penanganan: ' + error.message)
      }
    } catch (err: any) {
      alert('Error: ' + err.message)
    }
  }

  // Operator: Hapus Bimbingan
  const handleDeleteBimbingan = async (id?: string) => {
    if (!isOperator) return
    if (!id || !confirm('Apakah Anda yakin ingin menghapus catatan bimbingan ini?')) return

    const { error } = await supabase.from('bimbingan_wali').delete().eq('id', id)
    if (!error) {
      fetchRekapBimbingan()
    } else {
      alert('Gagal menghapus: ' + error.message)
    }
  }

  const handleLogout = async () => {
    if (isLoggingOut) return
    setIsLoggingOut(true)

    try {
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('just_logged_in')
      }
      await supabase.auth.signOut({ scope: 'local' })
      router.replace('/login')
    } catch (err) {
      console.error('Logout error:', err)
      router.replace('/login')
    }
  }

  if (loadingRole) {
    return (
      <div className={`h-screen w-screen flex items-center justify-center font-sans ${isDarkMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-200 text-slate-800'}`}>
        <div className={`p-4 rounded-xl border text-center space-y-1 shadow-xs ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-300'}`}>
          <p className="font-bold text-xs">Memuat Halaman Bimbingan...</p>
        </div>
      </div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={`h-screen w-screen overflow-hidden font-sans flex flex-col justify-between selection:bg-indigo-500 selection:text-white relative transition-colors duration-300 ${
        isDarkMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-200 text-slate-800'
      }`}
    >
      {/* WATERMARK LOGO */}
      <div className={`fixed inset-0 pointer-events-none z-0 flex items-center justify-center select-none print:hidden transition-opacity duration-300 ${
        isDarkMode ? 'opacity-[0.04]' : 'opacity-[0.12]'
      }`}>
        <img src="/logo-smp.jpg" alt="Watermark" className="w-[600px] h-[600px] object-contain max-w-none" />
      </div>

      <div className="relative z-10 flex flex-col h-full overflow-hidden">
        
        {/* 1. SUPER-COMPACT HEADER TOPBAR */}
        <header className={`border-b px-3 py-1.5 flex items-center justify-between gap-2 shrink-0 shadow-xs print:hidden transition-colors duration-300 ${
          isDarkMode ? 'bg-slate-900/95 border-slate-800 backdrop-blur-md' : 'bg-slate-100/95 border-slate-300 backdrop-blur-md'
        }`}>
          <div className="flex items-center gap-2 shrink-0">
            <Link href="/" className={`p-1 rounded-lg transition ${isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'}`} title="Kembali">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </Link>
            <div className="flex items-center gap-1.5">
              <img src="/logo-smp.jpg" alt="Logo" className="w-5 h-5 rounded border p-0.5 object-contain" />
              <h1 className={`font-black text-xs leading-none ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                Bimbingan Siswa
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {/* BADGE PROFIL POJOK KANAN ATAS: NAMA LENGKAP GURU + NUPTK + PERAN DINAMIS */}
            <div
              className={`border text-[10px] font-bold px-2 py-0.5 rounded-lg flex items-center gap-1.5 shadow-xs ${
                isDarkMode
                  ? 'bg-slate-800 border-slate-700 text-slate-100'
                  : 'bg-white border-slate-300 text-slate-800'
              }`}
            >
              <span className="w-4 h-4 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[9px] font-bold shrink-0">
                {userDisplayName.charAt(0)}
              </span>
              <div className="flex flex-col leading-none">
                <span className="font-extrabold max-w-[115px] sm:max-w-none truncate">
                  {userDisplayName}
                </span>
                <span
                  className={`hidden sm:inline text-[9px] font-mono mt-0.5 ${
                    isDarkMode ? 'text-slate-400' : 'text-slate-500'
                  }`}
                >
                  NUPTK: {userNuptkDisplay}
                </span>
              </div>
              <span
                className={`hidden sm:inline-block text-[9px] px-1.5 py-0.5 rounded font-extrabold uppercase ml-0.5 border ${
                  isDarkMode
                    ? 'bg-indigo-950 text-indigo-300 border-indigo-800'
                    : 'bg-indigo-100 text-indigo-800 border-indigo-200'
                }`}
              >
                {isStrictOperatorRole
                  ? 'Operator'
                  : waliKelasAssignedId
                  ? 'Wali Kelas'
                  : 'Guru'}
              </span>
            </div>

            <button
              onClick={handleLogout}
              disabled={isLoggingOut}
              className={`p-1 rounded-md border transition cursor-pointer disabled:opacity-50 ${
                isDarkMode 
                  ? 'bg-rose-950/40 border-rose-800 text-rose-400' 
                  : 'bg-rose-50 border-rose-300 text-rose-700'
              }`}
              title="Keluar"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </header>

        {/* 2. SUB-NAVBAR AKADEMIK (PILLS HORIZONTAL SCROLL) */}
        <div className={`border-b px-3 py-1 shrink-0 overflow-x-auto print:hidden transition-colors duration-300 ${
          isDarkMode ? 'bg-slate-900/80 border-slate-800 backdrop-blur-md' : 'bg-slate-200/80 border-slate-300 backdrop-blur-md'
        }`}>
          <div className="max-w-6xl mx-auto flex items-center gap-1 min-w-max text-[10px] font-bold">
            <Link href="/jadwal" className={`px-2 py-0.5 rounded border transition flex items-center gap-1 ${
              isDarkMode ? 'bg-slate-800 text-slate-300 border-slate-700' : 'bg-white text-slate-700 border-slate-300'
            }`}>
              <span>🕒</span> Jadwal
            </Link>
            <Link href="/absensi" className={`px-2 py-0.5 rounded border transition flex items-center gap-1 ${
              isDarkMode ? 'bg-slate-800 text-slate-300 border-slate-700' : 'bg-white text-slate-700 border-slate-300'
            }`}>
              <span>📋</span> Absensi
            </Link>
            <Link href="/nilai" className={`px-2 py-0.5 rounded border transition flex items-center gap-1 ${
              isDarkMode ? 'bg-slate-800 text-slate-300 border-slate-700' : 'bg-white text-slate-700 border-slate-300'
            }`}>
              <span>⭐</span> Penilaian
            </Link>
            <Link href="/jurnal" className={`px-2 py-0.5 rounded border transition flex items-center gap-1 ${
              isDarkMode ? 'bg-slate-800 text-slate-300 border-slate-700' : 'bg-white text-slate-700 border-slate-300'
            }`}>
              <span>📓</span> Jurnal
            </Link>
            <Link href="/bimbingan" className="bg-indigo-600 text-white px-2 py-0.5 rounded shadow-xs font-extrabold flex items-center gap-1">
              <span>💖</span> Bimbingan
            </Link>
          </div>
        </div>

        {/* MAIN CONTENT CONTAINER (NO SCROLL CONTAINER) */}
        <main className="max-w-6xl w-full mx-auto p-2 flex-1 flex flex-col space-y-2 overflow-hidden mb-12">
          
          {/* TAB SWITCHER */}
          <div className={`grid grid-cols-2 p-0.5 rounded-lg border w-full text-[11px] font-extrabold shrink-0 shadow-xs ${
            isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-300'
          }`}>
            <button
              onClick={() => setActiveTab('input')}
              className={`py-1 rounded-md transition flex items-center justify-center gap-1 cursor-pointer ${
                activeTab === 'input' 
                  ? 'bg-indigo-600 text-white shadow-xs' 
                  : isDarkMode ? 'text-slate-400' : 'text-slate-700'
              }`}
            >
              <span>💖</span> Catat Kasus
            </button>
            <button
              onClick={() => setActiveTab('rekap')}
              className={`py-1 rounded-md transition flex items-center justify-center gap-1 cursor-pointer ${
                activeTab === 'rekap' 
                  ? 'bg-indigo-600 text-white shadow-xs' 
                  : isDarkMode ? 'text-slate-400' : 'text-slate-700'
              }`}
            >
              <span>📜</span> Rekap Kasus
            </button>
          </div>

          {activeTab === 'input' && (
            <div className="flex flex-col h-full overflow-hidden space-y-2">
              
              {/* FORM INPUT COMPACT */}
              <form onSubmit={handleSimpanBimbingan} className={`border rounded-xl p-2 shrink-0 shadow-xs space-y-1.5 ${
                isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-indigo-200'
              }`}>
                {/* ROW 1: SISWA & TANGGAL */}
                <div className="grid grid-cols-12 gap-1.5">
                  <div className="col-span-7">
                    <select
                      value={selectedSiswaNama}
                      onChange={(e) => setSelectedSiswaNama(e.target.value)}
                      className={`w-full border rounded-lg px-2 py-1 text-xs font-bold focus:outline-none ${
                        isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                      }`}
                      required
                    >
                      <option value="">-- Pilih Siswa --</option>
                      {allSiswaList.map((siswa, i) => (
                        <option key={siswa.id || i} value={siswa.nama_lengkap}>
                          {siswa.nama_lengkap} ({siswa.nisn || 'No NISN'})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="col-span-5">
                    <input
                      type="date"
                      value={tanggal}
                      onChange={(e) => setTanggal(e.target.value)}
                      className={`w-full border rounded-lg px-2 py-1 text-xs font-bold focus:outline-none ${
                        isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                      }`}
                      required
                    />
                  </div>
                </div>

                {/* ROW 2: JENIS MASALAH */}
                <div>
                  <select
                    value={jenisMasalah}
                    onChange={(e) => setJenisMasalah(e.target.value)}
                    className={`w-full border rounded-lg px-2 py-1 text-xs font-bold focus:outline-none ${
                      isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  >
                    <option value="Akademik">Akademik (Nilai / Keterlambatan Tugas)</option>
                    <option value="Karakter/Sikap">Karakter / Sikap / Etika</option>
                    <option value="Kedisiplinan">Kedisiplinan (Absensi / Seragam)</option>
                    <option value="Pribadi/Sosial">Pribadi / Sosial / Perundungan</option>
                  </select>
                </div>

                {/* ROW 3: DESKRIPSI MASALAH */}
                <div>
                  <textarea
                    rows={2}
                    value={masalah}
                    onChange={(e) => setMasalah(e.target.value)}
                    placeholder="📝 Deskripsi Permasalahan Siswa..."
                    className={`w-full border rounded-lg px-2 py-1 text-xs font-bold focus:outline-none resize-none ${
                      isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                    required
                  />
                </div>

                {/* ROW 4: SOLUSI GURU */}
                <div>
                  <textarea
                    rows={2}
                    value={solusi}
                    onChange={(e) => setSolusi(e.target.value)}
                    placeholder="💡 Solusi / Tindak Lanjut Guru..."
                    className={`w-full border rounded-lg px-2 py-1 text-xs font-bold focus:outline-none resize-none ${
                      isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  />
                </div>

                {/* TOMBOL SIMPAN */}
                <button
                  type="submit"
                  disabled={saving}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black py-1.5 rounded-lg text-xs transition shadow-xs flex items-center justify-center gap-1 cursor-pointer mt-1"
                >
                  <span>💾</span>
                  <span>{saving ? 'Menyimpan...' : 'SIMPAN CATATAN BIMBINGAN'}</span>
                </button>
              </form>

            </div>
          )}

          {/* TAB 2: REKAPITULASI (INTERNAL SCROLL AREA) */}
          {activeTab === 'rekap' && (
            <div className="flex flex-col h-full overflow-hidden space-y-2">
              
              {/* FILTER BAR REKAP */}
              <div className={`grid grid-cols-3 gap-1 border p-1 rounded-lg shrink-0 shadow-xs ${
                isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-indigo-200'
              }`}>
                <select
                  value={filterKelasIdRekap}
                  onChange={(e) => setFilterKelasIdRekap(e.target.value)}
                  className={`border rounded px-1.5 py-0.5 text-xs font-bold focus:outline-none ${
                    isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                >
                  <option value="">Semua Kelas</option>
                  {kelasList.map((k) => (
                    <option key={k.id} value={k.id}>{k.nama}</option>
                  ))}
                </select>

                <select
                  value={filterJenis}
                  onChange={(e) => setFilterJenis(e.target.value)}
                  className={`border rounded px-1.5 py-0.5 text-xs font-bold focus:outline-none ${
                    isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                >
                  <option value="">Semua Jenis</option>
                  <option value="Akademik">Akademik</option>
                  <option value="Karakter/Sikap">Karakter</option>
                  <option value="Kedisiplinan">Kedisiplinan</option>
                  <option value="Pribadi/Sosial">Pribadi</option>
                </select>

                <input
                  type="text"
                  value={searchKataKunci}
                  onChange={(e) => setSearchKataKunci(e.target.value)}
                  placeholder="Cari..."
                  className={`border rounded px-1.5 py-0.5 text-xs font-bold focus:outline-none ${
                    isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                />
              </div>

              {/* LIST REKAP (INTERNAL SCROLL AREA) */}
              <div className={`border rounded-xl p-2 flex-1 flex flex-col overflow-hidden shadow-xs ${
                isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-indigo-200'
              }`}>
                {loadingRekap ? (
                  <div className={`py-6 text-center text-xs font-medium ${isDarkMode ? 'text-slate-500' : 'text-slate-600'}`}>
                    Memuat riwayat bimbingan...
                  </div>
                ) : rekapList.length === 0 ? (
                  <div className={`py-6 text-center text-xs font-medium ${isDarkMode ? 'text-slate-500' : 'text-slate-600'}`}>
                    Belum ada catatan kasus bimbingan.
                  </div>
                ) : (
                  <div className="flex-1 overflow-y-auto pr-1 space-y-1.5">
                    {rekapList.map((item, index) => (
                      <div
                        key={item.id || index}
                        className={`p-2 rounded-lg border transition shadow-xs flex flex-col gap-1 ${
                          isDarkMode ? 'bg-slate-800/80 border-slate-700' : 'bg-slate-50 border-slate-200'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className={`text-[11px] font-extrabold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                            {item.nama_siswa} ({item.kelas})
                          </span>
                          <span className="text-[10px] font-bold text-indigo-400">{item.jenis_masalah}</span>
                        </div>

                        <p className={`text-[11px] font-bold leading-tight ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>
                          🚨 {item.masalah}
                        </p>

                        {item.solusi && (
                          <p className={`text-[10px] font-medium leading-tight ${isDarkMode ? 'text-emerald-400' : 'text-emerald-700'}`}>
                            💡 {item.solusi}
                          </p>
                        )}

                        <div className="flex items-center justify-between pt-1 border-t border-slate-700/20 text-[10px]">
                          <span className={`font-mono ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                            📅 {item.tanggal}
                          </span>

                          <div className="flex items-center gap-1">
                            {item.is_penanganan_selesai ? (
                              <span className={`px-1.5 py-0.2 rounded font-black text-[9px] uppercase ${
                                isDarkMode ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                              }`}>
                                ✅ Selesai
                              </span>
                            ) : (
                              <span className={`px-1.5 py-0.2 rounded font-black text-[9px] uppercase ${
                                isDarkMode ? 'bg-amber-950 text-amber-300 border border-amber-800' : 'bg-amber-100 text-amber-800 border border-amber-300'
                              }`}>
                                ⏳ Proses
                              </span>
                            )}

                            {isOperator && (
                              <button
                                onClick={() => handleTindakLanjutiOperator(item)}
                                className="text-emerald-500 hover:text-emerald-700 font-bold p-0.5"
                                title="Konfirmasi Tindak Lanjut"
                              >
                                ✅
                              </button>
                            )}

                            {isOperator && (
                              <button
                                onClick={() => handleDeleteBimbingan(item.id)}
                                className="text-rose-500 hover:text-rose-700 font-bold p-0.5"
                                title="Hapus"
                              >
                                🗑️
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          )}

        </main>
      </div>

      {/* 3. FIXED BOTTOM NAVIGATION BAR */}
      <div className={`border-t fixed bottom-0 left-0 right-0 z-50 shadow-lg shrink-0 print:hidden transition-colors duration-300 ${
        isDarkMode ? 'bg-slate-900/95 border-slate-800 backdrop-blur-md' : 'bg-slate-100/95 border-slate-300 backdrop-blur-md'
      }`}>
        <div className="max-w-xl mx-auto px-4 py-1.5 flex items-center justify-between">
          <Link href="/" className={`flex flex-col items-center gap-0.5 text-[10px] font-semibold transition ${
            isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-950'
          }`}>
            <span className="text-base leading-none">🕒</span>
            <span>Dashboard</span>
          </Link>

          {isOperator && (
            <Link href="/siswa" className={`flex flex-col items-center gap-0.5 text-[10px] font-semibold transition ${
              isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-950'
            }`}>
              <span className="text-base leading-none">👥</span>
              <span>Siswa</span>
            </Link>
          )}

          {isOperator && (
            <Link href="/guru" className={`flex flex-col items-center gap-0.5 text-[10px] font-semibold transition ${
              isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-950'
            }`}>
              <span className="text-base leading-none">👨‍🏫</span>
              <span>Guru</span>
            </Link>
          )}

          <Link href="/bimbingan" className="flex flex-col items-center gap-0.5 text-[10px] font-bold text-indigo-500 transition">
            <span className="text-base leading-none">🎓</span>
            <span>Akademik</span>
          </Link>

          <Link href="/laporan" className={`flex flex-col items-center gap-0.5 text-[10px] font-semibold transition ${
            isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-950'
          }`}>
            <span className="text-base leading-none">🖨️</span>
            <span>Laporan</span>
          </Link>
        </div>
      </div>

    </motion.div>
  )
}