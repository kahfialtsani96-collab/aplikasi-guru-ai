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

interface Siswa {
  id: number
  nisn: string
  nama_lengkap: string
  kelas_id?: number
}

interface OptionItem {
  id: number
  nama: string
}

interface NilaiRecord {
  id?: number | string
  created_at?: string
  siswa_id: number
  mata_pelajaran?: string
  mapel_id?: number
  nilai_tugas?: number
  nilai_uts?: number
  nilai_uas?: number
  semester?: string
  tahun_ajaran?: string
  guru_email?: string
  siswa?: {
    nama_lengkap?: string
    kelas?: {
      nama_kelas?: string
    }
  } | null
}

interface NilaiMap {
  [siswaId: string]: number | ''
}

export default function PenilaianPage() {
  const router = useRouter()
  const { isOperator, canAccessBimbingan } = useAuthRole()

  const [userDisplayName, setUserDisplayName] = useState('GURU')
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'input' | 'rekap'>('input')

  // DETEKSI OTOMATIS TEMA DARK MODE DARI LOCAL STORAGE
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false)

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme')
    if (savedTheme === 'dark') {
      setIsDarkMode(true)
    }
  }, [])

  // Global Filter Periode Akademik
  const [selectedSemester, setSelectedSemester] = useState<'Ganjil' | 'Genap'>('Ganjil')
  const [selectedTahunAjaran, setSelectedTahunAjaran] = useState('2026/2027')

  // Dynamic Options
  const [kelasList, setKelasList] = useState<OptionItem[]>([])
  const [mapelList, setMapelList] = useState<OptionItem[]>([])

  // State Input Nilai
  const [selectedKelasId, setSelectedKelasId] = useState('')
  const [selectedMapelId, setSelectedMapelId] = useState('')
  const [jenisPenilaian, setJenisPenilaian] = useState<'nilai_tugas' | 'nilai_uts' | 'nilai_uas'>('nilai_tugas')
  const [siswaList, setSiswaList] = useState<Siswa[]>([])
  const [nilaiInputMap, setNilaiInputMap] = useState<NilaiMap>({})
  const [loadingSiswa, setLoadingSiswa] = useState(false)
  const [saving, setSaving] = useState(false)

  // State Rekapitulasi Nilai
  const [rekapList, setRekapList] = useState<NilaiRecord[]>([])
  const [filterKelasId, setFilterKelasId] = useState('')
  const [filterMapelId, setFilterMapelId] = useState('')
  const [searchNama, setSearchNama] = useState('')
  const [loadingRekap, setLoadingRekap] = useState(false)

  useEffect(() => {
    async function getUserData() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const email = user.email || ''
        setUserEmail(email)
        const nameFromMeta = user.user_metadata?.full_name || email.split('@')[0] || 'GURU'
        setUserDisplayName(String(nameFromMeta).toUpperCase())

        fetchOptions(email)
      }
    }
    getUserData()
  }, [isOperator])

  async function fetchOptions(email: string) {
    try {
      if (isOperator) {
        const { data: dataKelas } = await supabase.from('kelas').select('id, nama_kelas').order('nama_kelas', { ascending: true })
        const { data: dataMapel } = await supabase.from('mapel').select('id, nama_mapel').order('nama_mapel', { ascending: true })

        if (dataKelas) setKelasList(dataKelas.map((k: Record<string, any>) => ({ id: Number(k.id), nama: String(k.nama_kelas) })))
        if (dataMapel) setMapelList(dataMapel.map((m: Record<string, any>) => ({ id: Number(m.id), nama: String(m.nama_mapel) })))
      } else {
        const { data, error } = await supabase
          .from('jadwal')
          .select(`
            kelas_id,
            mapel_id,
            kelas:kelas_id(id, nama_kelas),
            mapel:mapel_id(id, nama_mapel)
          `)
          .eq('guru_email', email)

        if (!error && data) {
          const uniqueKelasMap = new Map<number, string>()
          const uniqueMapelMap = new Map<number, string>()

          data.forEach((item: Record<string, any>) => {
            if (item.kelas && item.kelas.id) {
              uniqueKelasMap.set(Number(item.kelas.id), String(item.kelas.nama_kelas))
            }
            if (item.mapel && item.mapel.id) {
              uniqueMapelMap.set(Number(item.mapel.id), String(item.mapel.nama_mapel))
            }
          })

          setKelasList(Array.from(uniqueKelasMap.entries()).map(([id, nama]) => ({ id, nama })))
          setMapelList(Array.from(uniqueMapelMap.entries()).map(([id, nama]) => ({ id, nama })))
        }
      }
    } catch (err) {
      console.error('Error fetching options:', err)
    }
  }

  // Fetch Siswa Berdasarkan Kelas ID
  useEffect(() => {
    async function fetchSiswa() {
      if (!selectedKelasId) {
        setSiswaList([])
        setNilaiInputMap({})
        return
      }

      setLoadingSiswa(true)
      try {
        const { data, error } = await supabase
          .from('siswa')
          .select('id, nisn, nama_lengkap, kelas_id')
          .eq('kelas_id', Number(selectedKelasId))
          .order('nama_lengkap', { ascending: true })

        if (!error && data) {
          setSiswaList(data)
          
          if (selectedMapelId) {
            const { data: existingNilai } = await supabase
              .from('nilai')
              .select('*')
              .eq('kelas_id', Number(selectedKelasId))
              .eq('mapel_id', Number(selectedMapelId))
              .eq('semester', selectedSemester)
              .eq('tahun_ajaran', selectedTahunAjaran)

            const initialMap: NilaiMap = {}
            data.forEach((s) => {
              const matched = (existingNilai || []).find((n: Record<string, any>) => Number(n.siswa_id) === Number(s.id))
              const val = matched ? (matched as Record<string, any>)[jenisPenilaian] : undefined
              initialMap[String(s.id)] = val !== undefined && val !== null ? Number(val) : ''
            })
            setNilaiInputMap(initialMap)
          } else {
            const initialMap: NilaiMap = {}
            data.forEach((s) => { initialMap[String(s.id)] = '' })
            setNilaiInputMap(initialMap)
          }
        } else {
          setSiswaList([])
        }
      } catch (err) {
        console.error('Error fetching siswa:', err)
      } finally {
        setLoadingSiswa(false)
      }
    }

    if (activeTab === 'input') {
      fetchSiswa()
    }
  }, [selectedKelasId, selectedMapelId, jenisPenilaian, selectedSemester, selectedTahunAjaran, activeTab])

  // Fetch Rekapitulasi Nilai
  const fetchRekap = async () => {
    setLoadingRekap(true)
    try {
      let query = supabase
        .from('nilai')
        .select('*, siswa:siswa_id(nama_lengkap, kelas:kelas_id(nama_kelas))')
        .eq('semester', selectedSemester)
        .eq('tahun_ajaran', selectedTahunAjaran)
        .order('created_at', { ascending: false })

      if (!isOperator && userEmail) {
        query = query.eq('guru_email', userEmail)
      }

      if (filterKelasId) query = query.eq('kelas_id', Number(filterKelasId))
      if (filterMapelId) query = query.eq('mapel_id', Number(filterMapelId))
      if (searchNama.trim()) query = query.ilike('siswa.nama_lengkap', `%${searchNama.trim()}%`)

      const { data, error } = await query

      if (!error && data) {
        setRekapList(data as unknown as NilaiRecord[])
      } else {
        setRekapList([])
      }
    } catch (err) {
      console.error('Error fetching rekap nilai:', err)
    } finally {
      setLoadingRekap(false)
    }
  }

  useEffect(() => {
    if (activeTab === 'rekap') {
      fetchRekap()
    }
  }, [activeTab, filterKelasId, filterMapelId, searchNama, selectedSemester, selectedTahunAjaran, userEmail, isOperator])

  const handleNilaiChange = (siswaId: string, value: string) => {
    const num = value === '' ? '' : Math.min(100, Math.max(0, Number(value)))
    setNilaiInputMap((prev) => ({
      ...prev,
      [siswaId]: num,
    }))
  }

  const handleSimpanNilai = async () => {
    if (!selectedKelasId || !selectedMapelId || !jenisPenilaian) {
      alert('Silakan pilih Kelas, Mata Pelajaran, dan Jenis Penilaian terlebih dahulu!')
      return
    }

    if (!userEmail) {
      alert('Sesi login tidak valid. Silakan login ulang.')
      return
    }

    if (siswaList.length === 0) {
      alert('Tidak ada siswa untuk disimpan.')
      return
    }

    setSaving(true)
    try {
      const selectedMapelObj = mapelList.find((m) => m.id === Number(selectedMapelId))

      const rowsToUpsert = siswaList
        .filter((siswa) => siswa.id && nilaiInputMap[String(siswa.id)] !== '')
        .map((siswa) => ({
          siswa_id: siswa.id,
          kelas_id: Number(selectedKelasId),
          mapel_id: Number(selectedMapelId),
          mata_pelajaran: selectedMapelObj?.nama || '',
          [jenisPenilaian]: Number(nilaiInputMap[String(siswa.id)]),
          semester: selectedSemester,
          tahun_ajaran: selectedTahunAjaran,
          guru_email: userEmail
        }))

      if (rowsToUpsert.length === 0) {
        alert('Silakan isi minimal satu nilai siswa!')
        setSaving(false)
        return
      }

      const { error } = await supabase.from('nilai').upsert(rowsToUpsert, { onConflict: 'siswa_id,mapel_id,semester,tahun_ajaran' })

      if (error) {
        const { error: insertErr } = await supabase.from('nilai').insert(rowsToUpsert)
        if (insertErr) {
          alert('Gagal menyimpan nilai: ' + insertErr.message)
        } else {
          alert('Data nilai akademik berhasil disimpan!')
        }
      } else {
        alert('Data nilai akademik berhasil disimpan!')
      }
    } catch (err: any) {
      alert('Terjadi kesalahan: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  const totalEntri = rekapList.length

  return (
    <motion.div
      initial={{ opacity: 0, x: -60 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className={`h-screen font-sans flex flex-col justify-between selection:bg-indigo-500 selection:text-white overflow-hidden relative transition-colors duration-300 ${
        isDarkMode ? 'bg-slate-950 text-slate-100' : 'bg-[#E2E8F0] text-slate-800'
      }`}
    >
      
      <div className={`fixed inset-0 pointer-events-none z-0 flex items-center justify-center select-none print:hidden transition-opacity duration-300 ${
        isDarkMode ? 'opacity-[0.05]' : 'opacity-[0.15]'
      }`}>
        <img src="/logo-smp.jpg" alt="Watermark" className="w-[850px] h-[850px] object-contain max-w-none" />
      </div>

      <div className="relative z-10 flex flex-col h-full overflow-hidden">
        
        <header className={`border-b px-6 py-2.5 flex items-center justify-between shrink-0 shadow-xs print:hidden transition-colors duration-300 ${
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
                <img src="/logo-smp.jpg" alt="Logo SMP" className="w-full h-full object-contain" />
              </div>
              <div>
                <h1 className={`font-bold text-base leading-none ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Aplikasi Guru AI</h1>
                <p className={`text-[11px] font-bold mt-0.5 ${isDarkMode ? 'text-emerald-400' : 'text-emerald-800'}`}>Input Penilaian Akademik Siswa</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className={`border text-xs font-bold px-3 py-1 rounded-xl flex items-center gap-2 shadow-xs ${
              isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-100' : 'bg-white border-slate-300 text-slate-800'
            }`}>
              <span className={`text-[10px] uppercase ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Periode:</span>
              <select value={selectedSemester} onChange={(e) => setSelectedSemester(e.target.value as 'Ganjil' | 'Genap')} className={`font-bold rounded px-1 py-0.5 focus:outline-none ${
                isDarkMode ? 'bg-slate-700 text-indigo-300' : 'bg-slate-100 text-indigo-900'
              }`}>
                <option value="Ganjil">Ganjil</option>
                <option value="Genap">Genap</option>
              </select>
              <select value={selectedTahunAjaran} onChange={(e) => setSelectedTahunAjaran(e.target.value)} className={`font-bold rounded px-1 py-0.5 focus:outline-none ${
                isDarkMode ? 'bg-slate-700 text-indigo-300' : 'bg-slate-100 text-indigo-900'
              }`}>
                <option value="2025/2026">2025/2026</option>
                <option value="2026/2027">2026/2027</option>
                <option value="2027/2028">2027/2028</option>
              </select>
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
                {isOperator ? 'Operator' : 'Guru'}
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

        <div className={`border-b px-6 py-2 shrink-0 overflow-x-auto print:hidden transition-colors duration-300 ${
          isDarkMode ? 'bg-slate-900/80 border-slate-800 backdrop-blur-md' : 'bg-slate-200/80 border-slate-300 backdrop-blur-md'
        }`}>
          <div className="max-w-6xl mx-auto flex items-center gap-2 min-w-max text-xs font-bold">
            <span className={`font-black pr-2 border-r flex items-center gap-1 ${isDarkMode ? 'text-indigo-400 border-slate-800' : 'text-indigo-900 border-slate-300'}`}>
              🎓 Akademik:
            </span>
            <Link href="/jadwal" className={`px-3 py-1.5 rounded-xl border transition flex items-center gap-1.5 ${
              isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700' : 'bg-white/80 border-slate-300 text-slate-700 hover:bg-white'
            }`}>
              <span>🕒</span> Jadwal Mengajar
            </Link>
            <Link href="/absensi" className={`px-3 py-1.5 rounded-xl border transition flex items-center gap-1.5 ${
              isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700' : 'bg-white/80 border-slate-300 text-slate-700 hover:bg-white'
            }`}>
              <span>📋</span> Input Absensi
            </Link>
            <Link href="/nilai" className="bg-indigo-600 text-white px-3 py-1.5 rounded-xl shadow-xs font-extrabold flex items-center gap-1.5">
              <span>⭐</span> Input Penilaian
            </Link>
            <Link href="/jurnal" className={`px-3 py-1.5 rounded-xl border transition flex items-center gap-1.5 ${
              isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700' : 'bg-white/80 border-slate-300 text-slate-700 hover:bg-white'
            }`}>
              <span>📓</span> Agenda Mengajar
            </Link>
            {canAccessBimbingan && (
              <Link href="/bimbingan" className={`px-3 py-1.5 rounded-xl border transition flex items-center gap-1.5 ${
                isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700' : 'bg-white/80 border-slate-300 text-slate-700 hover:bg-white'
              }`}>
                <span>💖</span> Bimbingan Guru Wali
              </Link>
            )}
          </div>
        </div>

        <main className="max-w-6xl w-full mx-auto p-4 flex-1 flex flex-col min-h-0 space-y-3">
          
          <div className="flex items-center justify-between shrink-0 print:hidden">
            <div className={`grid grid-cols-2 p-1 rounded-xl border max-w-md text-xs font-extrabold flex-1 ${
              isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-slate-200/90 border-slate-300'
            }`}>
              <button
                onClick={() => setActiveTab('input')}
                className={`py-1.5 rounded-lg transition flex items-center justify-center gap-2 cursor-pointer ${
                  activeTab === 'input' 
                    ? 'bg-indigo-600 text-white shadow-xs' 
                    : isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-700 hover:text-slate-900'
                }`}
              >
                <span>⭐</span> Input Nilai Akademik
              </button>
              <button
                onClick={() => setActiveTab('rekap')}
                className={`py-1.5 rounded-lg transition flex items-center justify-center gap-2 cursor-pointer ${
                  activeTab === 'rekap' 
                    ? 'bg-indigo-600 text-white shadow-xs' 
                    : isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-700 hover:text-slate-900'
                }`}
              >
                <span>📜</span> Riwayat &amp; Rekapitulasi
              </button>
            </div>
          </div>

          {activeTab === 'input' && (
            <div className="flex-1 flex flex-col min-h-0 space-y-3">
              
              <div className={`backdrop-blur-md border rounded-2xl p-3.5 shadow-xs shrink-0 print:hidden ${
                isDarkMode 
                  ? 'bg-slate-900/90 border-slate-800' 
                  : 'bg-gradient-to-br from-indigo-100/90 via-slate-100/90 to-indigo-50/90 border-indigo-200/80'
              }`}>
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
                  
                  <div className="sm:col-span-4">
                    <label className={`block text-[10px] font-extrabold uppercase mb-1 ${isDarkMode ? 'text-indigo-300' : 'text-indigo-950'}`}>KELAS DIAJAR *</label>
                    <select
                      value={selectedKelasId}
                      onChange={(e) => setSelectedKelasId(e.target.value)}
                      className={`w-full border rounded-xl px-2.5 py-1.5 text-xs font-bold focus:outline-none focus:border-indigo-600 ${
                        isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                      }`}
                    >
                      <option value="">-- Pilih Kelas --</option>
                      {kelasList.map((k) => (
                        <option key={k.id} value={k.id}>{k.nama}</option>
                      ))}
                    </select>
                  </div>

                  <div className="sm:col-span-4">
                    <label className={`block text-[10px] font-extrabold uppercase mb-1 ${isDarkMode ? 'text-indigo-300' : 'text-indigo-950'}`}>MAPEL DIAJAR *</label>
                    <select
                      value={selectedMapelId}
                      onChange={(e) => setSelectedMapelId(e.target.value)}
                      className={`w-full border rounded-xl px-2.5 py-1.5 text-xs font-bold focus:outline-none focus:border-indigo-600 ${
                        isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                      }`}
                    >
                      <option value="">-- Pilih Mapel --</option>
                      {mapelList.map((m) => (
                        <option key={m.id} value={m.id}>{m.nama}</option>
                      ))}
                    </select>
                  </div>

                  <div className="sm:col-span-4">
                    <label className={`block text-[10px] font-extrabold uppercase mb-1 ${isDarkMode ? 'text-indigo-300' : 'text-indigo-950'}`}>JENIS PENILAIAN *</label>
                    <select
                      value={jenisPenilaian}
                      onChange={(e: any) => setJenisPenilaian(e.target.value)}
                      className={`w-full border rounded-xl px-2.5 py-1.5 text-xs font-bold focus:outline-none focus:border-indigo-600 ${
                        isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                      }`}
                    >
                      <option value="nilai_tugas">Nilai Tugas</option>
                      <option value="nilai_uts">Nilai UTS</option>
                      <option value="nilai_uas">Nilai UAS</option>
                    </select>
                  </div>

                </div>
              </div>

              <div className={`backdrop-blur-md border rounded-2xl p-3.5 flex-1 flex flex-col min-h-0 shadow-xs overflow-hidden ${
                isDarkMode 
                  ? 'bg-slate-900/90 border-slate-800' 
                  : 'bg-gradient-to-br from-indigo-100/90 via-slate-100/90 to-indigo-50/90 border-indigo-200/80'
              }`}>
                <div className={`flex-1 overflow-y-auto rounded-xl border ${isDarkMode ? 'bg-slate-900/90 border-slate-800' : 'bg-white/90 border-indigo-200/80'}`}>
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className={`sticky top-0 z-10 shadow-xs ${isDarkMode ? 'bg-slate-800' : 'bg-indigo-100'}`}>
                      <tr className={`border-b font-extrabold uppercase text-[11px] ${isDarkMode ? 'text-indigo-400 border-slate-700' : 'text-indigo-950 border-indigo-200'}`}>
                        <th className="py-2.5 px-3 w-12 text-center">NO</th>
                        <th className="py-2.5 px-3">NAMA LENGKAP SISWA</th>
                        <th className="py-2.5 px-3 text-right pr-6 w-44">INPUT NILAI (0-100)</th>
                      </tr>
                    </thead>
                    <tbody className={`divide-y ${isDarkMode ? 'divide-slate-800 text-slate-200' : 'divide-slate-200 text-slate-800'}`}>
                      {!selectedKelasId || !selectedMapelId ? (
                        <tr>
                          <td colSpan={3} className={`py-10 text-center font-medium ${isDarkMode ? 'text-slate-500' : 'text-slate-600'}`}>
                            Silakan pilih Kelas, Mapel, dan Jenis Penilaian di atas.
                          </td>
                        </tr>
                      ) : loadingSiswa ? (
                        <tr>
                          <td colSpan={3} className={`py-10 text-center font-medium ${isDarkMode ? 'text-slate-500' : 'text-slate-600'}`}>Memuat data siswa...</td>
                        </tr>
                      ) : siswaList.length === 0 ? (
                        <tr>
                          <td colSpan={3} className={`py-10 text-center font-medium ${isDarkMode ? 'text-slate-500' : 'text-slate-600'}`}>Belum ada siswa terdaftar di kelas ini.</td>
                        </tr>
                      ) : (
                        siswaList.map((siswa, index) => {
                          const sId = String(siswa.id)
                          return (
                            <tr key={sId || index} className={`transition ${isDarkMode ? 'hover:bg-slate-800/60' : 'hover:bg-indigo-50/60'}`}>
                              <td className={`py-2 px-3 text-center font-bold ${isDarkMode ? 'text-slate-500' : 'text-slate-500'}`}>{index + 1}</td>
                              <td className={`py-2 px-3 font-extrabold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                                {siswa.nama_lengkap}
                                <span className={`block text-[10px] font-mono font-normal ${isDarkMode ? 'text-slate-500' : 'text-slate-500'}`}>
                                  NISN: {siswa.nisn || '-'}
                                </span>
                              </td>
                              <td className="py-2 px-3 text-right pr-6">
                                <input
                                  type="number"
                                  min={0}
                                  max={100}
                                  value={nilaiInputMap[sId] ?? ''}
                                  onChange={(e) => handleNilaiChange(sId, e.target.value)}
                                  placeholder="0-100"
                                  className={`w-24 border rounded-xl px-2.5 py-1 text-right text-xs font-extrabold focus:outline-none focus:border-indigo-600 ${
                                    isDarkMode ? 'bg-slate-800 border-slate-700 text-indigo-300' : 'bg-white border-slate-300 text-indigo-950'
                                  }`}
                                />
                              </td>
                            </tr>
                          )
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {selectedKelasId && selectedMapelId && siswaList.length > 0 && (
                  <div className="flex justify-end pt-2 shrink-0">
                    <button
                      onClick={handleSimpanNilai}
                      disabled={saving}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold px-5 py-2 rounded-xl text-xs transition shadow-xs flex items-center gap-1.5 cursor-pointer"
                    >
                      <span>💾</span> {saving ? 'Menyimpan...' : 'Simpan Nilai'}
                    </button>
                  </div>
                )}
              </div>

            </div>
          )}

          {activeTab === 'rekap' && (
            <div className="flex-1 flex flex-col min-h-0 space-y-3">
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 shrink-0 max-w-sm">
                <div className={`backdrop-blur-md border rounded-xl p-2.5 shadow-xs ${
                  isDarkMode ? 'bg-slate-900/90 border-slate-800' : 'bg-white/90 border-slate-300'
                }`}>
                  <p className={`text-[10px] font-extrabold uppercase ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>TOTAL ENTRI NILAI</p>
                  <p className={`text-lg font-black mt-0.5 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{totalEntri}</p>
                </div>
              </div>

              <div className={`grid grid-cols-1 sm:grid-cols-3 gap-2.5 backdrop-blur-md border p-3 rounded-2xl shrink-0 shadow-xs ${
                isDarkMode 
                  ? 'bg-slate-900/90 border-slate-800' 
                  : 'bg-gradient-to-br from-indigo-100/90 via-slate-100/90 to-indigo-50/90 border-indigo-200/80'
              }`}>
                <div>
                  <label className={`block text-[10px] font-extrabold uppercase mb-1 ${isDarkMode ? 'text-indigo-300' : 'text-indigo-950'}`}>FILTER KELAS</label>
                  <select
                    value={filterKelasId}
                    onChange={(e) => setFilterKelasId(e.target.value)}
                    className={`w-full border rounded-xl px-2.5 py-1 text-xs font-bold focus:outline-none ${
                      isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                    }`}
                  >
                    <option value="">Semua Kelas</option>
                    {kelasList.map((k) => (
                      <option key={k.id} value={k.id}>{k.nama}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className={`block text-[10px] font-extrabold uppercase mb-1 ${isDarkMode ? 'text-indigo-300' : 'text-indigo-950'}`}>FILTER MAPEL</label>
                  <select
                    value={filterMapelId}
                    onChange={(e) => setFilterMapelId(e.target.value)}
                    className={`w-full border rounded-xl px-2.5 py-1 text-xs font-bold focus:outline-none ${
                      isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                    }`}
                  >
                    <option value="">Semua Mapel</option>
                    {mapelList.map((m) => (
                      <option key={m.id} value={m.id}>{m.nama}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className={`block text-[10px] font-extrabold uppercase mb-1 ${isDarkMode ? 'text-indigo-300' : 'text-indigo-950'}`}>CARI SISWA</label>
                  <input
                    type="text"
                    value={searchNama}
                    onChange={(e) => setSearchNama(e.target.value)}
                    placeholder="Nama siswa..."
                    className={`w-full border rounded-xl px-2.5 py-1 text-xs font-bold focus:outline-none ${
                      isDarkMode ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-white border-slate-300 text-slate-900'
                    }`}
                  />
                </div>
              </div>

              <div className={`backdrop-blur-md border rounded-2xl p-3.5 flex-1 flex flex-col min-h-0 shadow-xs overflow-hidden ${
                isDarkMode 
                  ? 'bg-slate-900/90 border-slate-800' 
                  : 'bg-gradient-to-br from-indigo-100/90 via-slate-100/90 to-indigo-50/90 border-indigo-200/80'
              }`}>
                <div className={`flex-1 overflow-y-auto rounded-xl border ${isDarkMode ? 'bg-slate-900/90 border-slate-800' : 'bg-white/90 border-indigo-200/80'}`}>
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className={`sticky top-0 z-10 shadow-xs ${isDarkMode ? 'bg-slate-800' : 'bg-indigo-100'}`}>
                      <tr className={`border-b font-extrabold uppercase text-[11px] ${isDarkMode ? 'text-indigo-400 border-slate-700' : 'text-indigo-950 border-indigo-200'}`}>
                        <th className="py-2.5 px-3 w-12 text-center">NO</th>
                        <th className="py-2.5 px-3">TANGGAL</th>
                        <th className="py-2.5 px-3">NAMA SISWA</th>
                        <th className="py-2.5 px-3">MATA PELAJARAN</th>
                        <th className="py-2.5 px-3 text-center">NILAI TUGAS</th>
                        <th className="py-2.5 px-3 text-center">NILAI UTS</th>
                        <th className="py-2.5 px-3 text-center">NILAI UAS</th>
                        <th className="py-2.5 px-3 text-center w-20">AKSI</th>
                      </tr>
                    </thead>
                    <tbody className={`divide-y ${isDarkMode ? 'divide-slate-800 text-slate-200' : 'divide-slate-200 text-slate-800'}`}>
                      {loadingRekap ? (
                        <tr>
                          <td colSpan={8} className={`py-10 text-center font-medium ${isDarkMode ? 'text-slate-500' : 'text-slate-600'}`}>Memuat riwayat nilai...</td>
                        </tr>
                      ) : rekapList.length === 0 ? (
                        <tr>
                          <td colSpan={8} className={`py-10 text-center font-medium ${isDarkMode ? 'text-slate-500' : 'text-slate-600'}`}>Tidak ada data nilai ditemukan.</td>
                        </tr>
                      ) : (
                        rekapList.map((item, index) => (
                          <tr key={item.id || index} className={`transition ${isDarkMode ? 'hover:bg-slate-800/60' : 'hover:bg-indigo-50/60'}`}>
                            <td className={`py-2 px-3 text-center font-bold ${isDarkMode ? 'text-slate-500' : 'text-slate-500'}`}>{index + 1}</td>
                            <td className={`py-2 px-3 font-mono font-bold ${isDarkMode ? 'text-slate-400' : 'text-slate-700'}`}>
                              {item.created_at ? new Date(item.created_at).toLocaleDateString('id-ID') : '-'}
                            </td>
                            <td className={`py-2 px-3 font-extrabold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                              {item.siswa?.nama_lengkap || '-'}
                              <span className={`block text-[10px] font-normal ${isDarkMode ? 'text-slate-500' : 'text-slate-500'}`}>
                                {item.siswa?.kelas?.nama_kelas}
                              </span>
                            </td>
                            <td className={`py-2 px-3 font-extrabold ${isDarkMode ? 'text-indigo-300' : 'text-indigo-950'}`}>{item.mata_pelajaran}</td>
                            <td className="py-2 px-3 text-center font-black text-amber-500">{item.nilai_tugas ?? '-'}</td>
                            <td className="py-2 px-3 text-center font-black text-indigo-400">{item.nilai_uts ?? '-'}</td>
                            <td className="py-2 px-3 text-center font-black text-emerald-400">{item.nilai_uas ?? '-'}</td>
                            <td className="py-2 px-3 text-center">
                              <button
                                onClick={async () => {
                                  if (item.id && confirm('Hapus entri nilai ini?')) {
                                    await supabase.from('nilai').delete().eq('id', item.id)
                                    setRekapList((prev) => prev.filter((r) => r.id !== item.id))
                                  }
                                }}
                                className="bg-rose-50 text-rose-600 hover:bg-rose-100 p-1.5 rounded-lg border border-rose-200 transition cursor-pointer"
                                title="Hapus Nilai"
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
          )}

        </main>

        <div className="pb-16 pt-1 flex justify-center shrink-0 print:hidden">
          <div className={`border px-4 py-0.5 rounded-full text-center text-[10px] font-medium shadow-xs transition-colors duration-300 ${
            isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-400' : 'bg-slate-100/90 border-slate-300 text-slate-700'
          }`}>
            <span>Aplikasi Guru AI</span>
            <span className="mx-2">•</span>
            <span>Created by <strong className="text-emerald-500 font-bold">MUZAINI AL KAHFI</strong></span>
          </div>
        </div>

      </div>

      <div className={`border-t fixed bottom-0 left-0 right-0 z-50 shadow-lg shrink-0 print:hidden transition-colors duration-300 ${
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

          <Link href="/nilai" className={`flex flex-col items-center gap-0.5 text-[11px] font-bold transition ${
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