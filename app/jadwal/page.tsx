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

interface MapelItem {
  id: number
  nama_mapel: string
  kode_mapel: string
}

interface KelasItem {
  id: number
  nama_kelas: string
}

interface GuruItem {
  id?: number
  nama_lengkap: string
  email: string
}

interface MasterJamItem {
  id: number
  hari: string
  jam_ke: number
  waktu_mulai: string
  waktu_selesai: string
  keterangan: string
}

interface Jadwal {
  id?: number
  hari: string
  jam: string
  jam_ke?: number | string
  kelas_id?: number
  mapel_id?: number
  guru_email?: string
  kelas?: { nama_kelas: string } | string
  mapel?: { nama_mapel: string; kode_mapel: string } | string
}

export default function JadwalMengajarPage() {
  const router = useRouter()
  const { isOperator, canAccessBimbingan } = useAuthRole()

  const [userDisplayName, setUserDisplayName] = useState('GURU')
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'kelola' | 'rekap'>('kelola')

  // DETEKSI OTOMATIS TEMA DARK MODE DARI LOCAL STORAGE
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false)

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme')
    if (savedTheme === 'dark') {
      setIsDarkMode(true)
    }
  }, [])

  // Options dari DB
  const [mapelList, setMapelList] = useState<MapelItem[]>([])
  const [kelasList, setKelasList] = useState<KelasItem[]>([])
  const [guruList, setGuruList] = useState<GuruItem[]>([])
  const [masterJamList, setMasterJamList] = useState<MasterJamItem[]>([])

  // State Form Input
  const [hari, setHari] = useState('Senin')
  const [jamMulai, setJamMulai] = useState<string>('1')
  const [jamSelesai, setJamSelesai] = useState<string>('1')
  const [selectedKelasId, setSelectedKelasId] = useState<string>('')
  const [selectedMapelId, setSelectedMapelId] = useState<string>('')
  const [selectedGuruEmail, setSelectedGuruEmail] = useState<string>('')

  const [jadwalList, setJadwalList] = useState<Jadwal[]>([])
  const [loading, setLoading] = useState(false)

  // State Filter Rekap
  const [filterHari, setFilterHari] = useState('')
  const [filterKelasId, setFilterKelasId] = useState('')
  const [filterMapelId, setFilterMapelId] = useState('')

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const email = user.email || ''
        setUserEmail(email)
        setSelectedGuruEmail(email)
        const nameFromMeta = user.user_metadata?.full_name || email.split('@')[0] || 'GURU'
        setUserDisplayName(nameFromMeta.toUpperCase())

        fetchMasterData()
        fetchJadwal(email, isOperator)
      }
    }
    init()
  }, [isOperator])

  async function fetchMasterData() {
    const { data: dMapel } = await supabase.from('mapel').select('id, nama_mapel, kode_mapel').order('urutan', { ascending: true })
    if (dMapel) setMapelList(dMapel)

    const { data: dKelas } = await supabase.from('kelas').select('id, nama_kelas').order('nama_kelas', { ascending: true })
    if (dKelas) setKelasList(dKelas)

    const { data: dGuru } = await supabase.from('guru').select('id, nama_lengkap, email').order('nama_lengkap', { ascending: true })
    if (dGuru) setGuruList(dGuru)

    const { data: dJam } = await supabase.from('master_jam').select('*').order('jam_ke', { ascending: true })
    if (dJam) setMasterJamList(dJam)
  }

  async function fetchJadwal(emailParam?: string | null, operatorMode?: boolean) {
    setLoading(true)
    try {
      let query = supabase
        .from('jadwal')
        .select(`
          id,
          hari,
          jam,
          jam_ke,
          kelas_id,
          mapel_id,
          guru_email,
          kelas:kelas_id(nama_kelas),
          mapel:mapel_id(nama_mapel, kode_mapel)
        `)
        .order('id', { ascending: true })

      if (!operatorMode && emailParam) {
        query = query.eq('guru_email', emailParam)
      }

      const { data, error } = await query
      if (!error && data) {
        setJadwalList(data as any)
      }
    } catch (err) {
      console.error('Error fetching jadwal:', err)
    } finally {
      setLoading(false)
    }
  }

  // Opsi jam dinamis sesuai hari
  const jamOptionsForSelectedHari = masterJamList.filter((j) => j.hari === hari)

  const handleSimpan = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedKelasId || !selectedMapelId) {
      alert('Silakan pilih Kelas dan Mata Pelajaran!')
      return
    }

    const targetEmail = isOperator ? selectedGuruEmail : userEmail
    if (!targetEmail) {
      alert('Email guru pengampu wajib dipilih/diisi!')
      return
    }

    // Format jam blok/berlanjut
    const startJamObj = masterJamList.find((j) => j.hari === hari && j.jam_ke === Number(jamMulai))
    const endJamObj = masterJamList.find((j) => j.hari === hari && j.jam_ke === Number(jamSelesai))

    let formattedJamText = `Jam Ke-${jamMulai}`
    if (startJamObj && endJamObj) {
      const wMulai = startJamObj.waktu_mulai.slice(0, 5)
      const wSelesai = endJamObj.waktu_selesai.slice(0, 5)
      
      if (Number(jamMulai) === Number(jamSelesai)) {
        formattedJamText = `Jam Ke-${jamMulai} (${wMulai} - ${wSelesai})`
      } else {
        formattedJamText = `Jam Ke-${jamMulai} s/d ${jamSelesai} (${wMulai} - ${wSelesai})`
      }
    }

    // Validasi Bentrok Jadwal
    const bentrok = jadwalList.find(
      (j) =>
        j.hari === hari &&
        Number(j.jam_ke) === Number(jamMulai) &&
        Number(typeof j.kelas_id === 'number' ? j.kelas_id : 0) === Number(selectedKelasId)
    )

    if (bentrok) {
      alert(`BENTROK JADWAL! Kelas tersebut sudah terisi pada ${hari}, Jam Ke-${jamMulai}.`)
      return
    }

    try {
      const selectedMapelObj = mapelList.find((m) => m.id === Number(selectedMapelId))
      const selectedKelasObj = kelasList.find((k) => k.id === Number(selectedKelasId))

      const { error } = await supabase.from('jadwal').insert([
        {
          hari,
          jam: formattedJamText,
          jam_ke: Number(jamMulai),
          kelas_id: Number(selectedKelasId),
          mapel_id: Number(selectedMapelId),
          guru_email: targetEmail,
          kelas: selectedKelasObj?.nama_kelas || '',
          mapel: selectedMapelObj?.nama_mapel || '',
        },
      ])

      if (error) {
        alert('Gagal menyimpan jadwal: ' + error.message)
      } else {
        alert('Jadwal berhasil ditambahkan!')
        setSelectedKelasId('')
        setSelectedMapelId('')
        fetchJadwal(userEmail, isOperator)
      }
    } catch (err: any) {
      alert('Error: ' + err.message)
    }
  }

  const handleDelete = async (id?: number) => {
    if (!id || !confirm('Yakin ingin menghapus jadwal mengajar ini?')) return

    try {
      const { error } = await supabase.from('jadwal').delete().eq('id', id)
      if (!error) {
        setJadwalList((prev) => prev.filter((item) => item.id !== id))
      }
    } catch (err) {
      console.error('Error deleting jadwal:', err)
    }
  }

  const filteredRekapList = jadwalList.filter((item) => {
    const matchHari = !filterHari || item.hari === filterHari
    const matchKelas = !filterKelasId || Number(item.kelas_id) === Number(filterKelasId)
    const matchMapel = !filterMapelId || Number(item.mapel_id) === Number(filterMapelId)
    return matchHari && matchKelas && matchMapel
  })

  return (
    <motion.div
      initial={{ opacity: 0, x: -60 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className={`h-screen font-sans flex flex-col justify-between selection:bg-indigo-500 selection:text-white overflow-hidden relative transition-colors duration-300 ${
        isDarkMode ? 'bg-slate-950 text-slate-100' : 'bg-[#E2E8F0] text-slate-800'
      }`}
    >
      
      {/* WATERMARK LOGO */}
      <div className={`fixed inset-0 pointer-events-none z-0 flex items-center justify-center select-none print:hidden transition-opacity duration-300 ${
        isDarkMode ? 'opacity-[0.05]' : 'opacity-[0.15]'
      }`}>
        <img src="/logo-smp.jpg" alt="Watermark" className="w-[850px] h-[850px] object-contain max-w-none" />
      </div>

      <div className="relative z-10 flex flex-col h-full overflow-hidden">
        
        {/* HEADER TOPBAR */}
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
                <p className={`text-[11px] font-bold mt-0.5 ${isDarkMode ? 'text-emerald-400' : 'text-emerald-800'}`}>Penjadwalan KBM Terintegrasi</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
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

        {/* SUB-NAVBAR AKADEMIK */}
        <div className={`border-b px-6 py-2 shrink-0 overflow-x-auto print:hidden transition-colors duration-300 ${
          isDarkMode ? 'bg-slate-900/80 border-slate-800 backdrop-blur-md' : 'bg-slate-200/80 border-slate-300 backdrop-blur-md'
        }`}>
          <div className="max-w-6xl mx-auto flex items-center gap-2 min-w-max text-xs font-bold">
            <span className={`font-black pr-2 border-r flex items-center gap-1 ${
              isDarkMode ? 'text-indigo-300 border-slate-800' : 'text-indigo-900 border-slate-300'
            }`}>
              🎓 Akademik:
            </span>
            <Link href="/jadwal" className="bg-indigo-600 text-white px-3 py-1.5 rounded-xl shadow-xs font-extrabold flex items-center gap-1.5">
              <span>🕒</span> Jadwal Mengajar
            </Link>
            <Link href="/absensi" className={`px-3 py-1.5 rounded-xl border transition flex items-center gap-1.5 ${
              isDarkMode ? 'bg-slate-800/80 text-slate-300 hover:bg-slate-800 border-slate-700' : 'bg-white/80 text-slate-700 hover:bg-white border-slate-300'
            }`}>
              <span>📋</span> Input Absensi
            </Link>
            <Link href="/nilai" className={`px-3 py-1.5 rounded-xl border transition flex items-center gap-1.5 ${
              isDarkMode ? 'bg-slate-800/80 text-slate-300 hover:bg-slate-800 border-slate-700' : 'bg-white/80 text-slate-700 hover:bg-white border-slate-300'
            }`}>
              <span>⭐</span> Input Penilaian
            </Link>
            <Link href="/jurnal" className={`px-3 py-1.5 rounded-xl border transition flex items-center gap-1.5 ${
              isDarkMode ? 'bg-slate-800/80 text-slate-300 hover:bg-slate-800 border-slate-700' : 'bg-white/80 text-slate-700 hover:bg-white border-slate-300'
            }`}>
              <span>📓</span> Agenda Mengajar
            </Link>
            {canAccessBimbingan && (
              <Link href="/bimbingan" className={`px-3 py-1.5 rounded-xl border transition flex items-center gap-1.5 ${
                isDarkMode ? 'bg-slate-800/80 text-slate-300 hover:bg-slate-800 border-slate-700' : 'bg-white/80 text-slate-700 hover:bg-white border-slate-300'
              }`}>
                <span>💖</span> Bimbingan Guru Wali
              </Link>
            )}
          </div>
        </div>

        {/* MAIN CONTENT AREA */}
        <main className="max-w-6xl w-full mx-auto p-4 flex-1 flex flex-col min-h-0 space-y-3">
          
          {/* TAB MODE BAR */}
          <div className="flex items-center justify-between shrink-0 print:hidden">
            <div className={`grid grid-cols-2 p-1 rounded-xl border max-w-md text-xs font-extrabold flex-1 ${
              isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-slate-200/90 border-slate-300'
            }`}>
              <button
                onClick={() => setActiveTab('kelola')}
                className={`py-1.5 rounded-lg transition flex items-center justify-center gap-2 cursor-pointer ${
                  activeTab === 'kelola' 
                    ? 'bg-indigo-600 text-white shadow-xs' 
                    : isDarkMode 
                      ? 'text-slate-400 hover:text-white' 
                      : 'text-slate-700 hover:text-slate-900'
                }`}
              >
                <span>🕒</span> Input &amp; Kelola Jadwal
              </button>
              <button
                onClick={() => setActiveTab('rekap')}
                className={`py-1.5 rounded-lg transition flex items-center justify-center gap-2 cursor-pointer ${
                  activeTab === 'rekap' 
                    ? 'bg-indigo-600 text-white shadow-xs' 
                    : isDarkMode 
                      ? 'text-slate-400 hover:text-white' 
                      : 'text-slate-700 hover:text-slate-900'
                }`}
              >
                <span>📜</span> Rekap &amp; Cetak
              </button>
            </div>

            <button
              onClick={() => window.print()}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold px-3 py-1.5 rounded-xl text-xs flex items-center gap-1.5 transition shadow-xs cursor-pointer ml-3"
            >
              <span>🖨️</span> Cetak PDF
            </button>
          </div>

          {/* TAB 1: FORM INPUT & JADWAL SAYA */}
          {activeTab === 'kelola' && (
            <div className="flex-1 flex flex-col min-h-0 space-y-3">
              
              {/* FORM INPUT JADWAL */}
              <form onSubmit={handleSimpan} className={`backdrop-blur-md border rounded-2xl p-3.5 shadow-xs shrink-0 print:hidden ${
                isDarkMode 
                  ? 'bg-slate-900/90 border-slate-800' 
                  : 'bg-gradient-to-br from-indigo-100/90 via-slate-100/90 to-indigo-50/90 border-indigo-200/80'
              }`}>
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
                  
                  {isOperator && (
                    <div className="sm:col-span-3">
                      <label className={`block text-[10px] font-extrabold uppercase mb-1 ${isDarkMode ? 'text-indigo-300' : 'text-indigo-950'}`}>
                        GURU PENGAMPU *
                      </label>
                      <select
                        value={selectedGuruEmail}
                        onChange={(e) => setSelectedGuruEmail(e.target.value)}
                        className={`w-full border rounded-xl px-2.5 py-1.5 text-xs font-bold focus:outline-none focus:border-indigo-600 ${
                          isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                        }`}
                        required
                      >
                        <option value="">-- Pilih Guru --</option>
                        {guruList.map((g) => (
                          <option key={g.id} value={g.email}>{g.nama_lengkap}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className={isOperator ? 'sm:col-span-2' : 'sm:col-span-2'}>
                    <label className={`block text-[10px] font-extrabold uppercase mb-1 ${isDarkMode ? 'text-indigo-300' : 'text-indigo-950'}`}>
                      HARI *
                    </label>
                    <select
                      value={hari}
                      onChange={(e) => {
                        setHari(e.target.value)
                        setJamMulai('1')
                        setJamSelesai('1')
                      }}
                      className={`w-full border rounded-xl px-2.5 py-1.5 text-xs font-bold focus:outline-none focus:border-indigo-600 ${
                        isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                      }`}
                    >
                      <option value="Senin">Senin</option>
                      <option value="Selasa">Selasa</option>
                      <option value="Rabu">Rabu</option>
                      <option value="Kamis">Kamis</option>
                      <option value="Sabtu">Sabtu</option>
                      <option value="Minggu">Minggu</option>
                    </select>
                  </div>

                  {/* OPSI JAM BLOK BERLANJUT */}
                  <div className={isOperator ? 'sm:col-span-3' : 'sm:col-span-3'}>
                    <label className={`block text-[10px] font-extrabold uppercase mb-1 ${isDarkMode ? 'text-indigo-300' : 'text-indigo-950'}`}>
                      JAM PELAJARAN *
                    </label>
                    <div className="grid grid-cols-2 gap-1.5">
                      <select
                        value={jamMulai}
                        onChange={(e) => {
                          const val = e.target.value
                          setJamMulai(val)
                          if (Number(val) > Number(jamSelesai)) setJamSelesai(val)
                        }}
                        className={`w-full border rounded-xl px-2 py-1.5 text-xs font-bold focus:outline-none focus:border-indigo-600 ${
                          isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                        }`}
                      >
                        {jamOptionsForSelectedHari.length > 0 ? (
                          jamOptionsForSelectedHari.map((j) => (
                            <option key={j.id} value={j.jam_ke}>Jam Ke-{j.jam_ke}</option>
                          ))
                        ) : (
                          [1, 2, 3, 4, 5, 6, 7, 8].map((num) => (
                            <option key={num} value={num}>Jam Ke-{num}</option>
                          ))
                        )}
                      </select>

                      <select
                        value={jamSelesai}
                        onChange={(e) => setJamSelesai(e.target.value)}
                        className={`w-full border rounded-xl px-2 py-1.5 text-xs font-bold focus:outline-none focus:border-indigo-600 ${
                          isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                        }`}
                      >
                        {jamOptionsForSelectedHari.length > 0 ? (
                          jamOptionsForSelectedHari
                            .filter((j) => j.jam_ke >= Number(jamMulai))
                            .map((j) => (
                              <option key={j.id} value={j.jam_ke}>s/d Ke-{j.jam_ke}</option>
                            ))
                        ) : (
                          [1, 2, 3, 4, 5, 6, 7, 8]
                            .filter((num) => num >= Number(jamMulai))
                            .map((num) => (
                              <option key={num} value={num}>s/d Ke-{num}</option>
                            ))
                        )}
                      </select>
                    </div>
                  </div>

                  <div className={isOperator ? 'sm:col-span-2' : 'sm:col-span-3'}>
                    <label className={`block text-[10px] font-extrabold uppercase mb-1 ${isDarkMode ? 'text-indigo-300' : 'text-indigo-950'}`}>
                      KELAS *
                    </label>
                    <select
                      value={selectedKelasId}
                      onChange={(e) => setSelectedKelasId(e.target.value)}
                      className={`w-full border rounded-xl px-2.5 py-1.5 text-xs font-bold focus:outline-none focus:border-indigo-600 ${
                        isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                      }`}
                      required
                    >
                      <option value="">-- Pilih Kelas --</option>
                      {kelasList.map((k) => (
                        <option key={k.id} value={k.id}>{k.nama_kelas}</option>
                      ))}
                    </select>
                  </div>

                  <div className={isOperator ? 'sm:col-span-2' : 'sm:col-span-3'}>
                    <label className={`block text-[10px] font-extrabold uppercase mb-1 ${isDarkMode ? 'text-indigo-300' : 'text-indigo-950'}`}>
                      MATA PELAJARAN *
                    </label>
                    <select
                      value={selectedMapelId}
                      onChange={(e) => setSelectedMapelId(e.target.value)}
                      className={`w-full border rounded-xl px-2.5 py-1.5 text-xs font-bold focus:outline-none focus:border-indigo-600 ${
                        isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                      }`}
                      required
                    >
                      <option value="">-- Pilih Mapel --</option>
                      {mapelList.map((m) => (
                        <option key={m.id} value={m.id}>{m.nama_mapel} ({m.kode_mapel})</option>
                      ))}
                    </select>
                  </div>

                  <div className="sm:col-span-1">
                    <button
                      type="submit"
                      className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold py-1.5 rounded-xl text-xs transition shadow-xs cursor-pointer"
                    >
                      + Simpan
                    </button>
                  </div>

                </div>
              </form>

              {/* TABEL JADWAL SAYA */}
              <div className={`backdrop-blur-md border rounded-2xl p-3.5 flex-1 flex flex-col min-h-0 shadow-xs overflow-hidden ${
                isDarkMode 
                  ? 'bg-slate-900/90 border-slate-800' 
                  : 'bg-gradient-to-br from-indigo-100/90 via-slate-100/90 to-indigo-50/90 border-indigo-200/80'
              }`}>
                <div className={`flex-1 overflow-y-auto rounded-xl border ${isDarkMode ? 'bg-slate-900/90 border-slate-800' : 'bg-white/90 border-indigo-200/80'}`}>
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className={`sticky top-0 z-10 shadow-xs ${isDarkMode ? 'bg-slate-800' : 'bg-indigo-100'}`}>
                      <tr className={`border-b font-extrabold uppercase text-[11px] ${isDarkMode ? 'text-indigo-300 border-slate-700' : 'text-indigo-950 border-indigo-200'}`}>
                        <th className="py-2.5 px-3">HARI</th>
                        <th className="py-2.5 px-3">JAM MENGAJAR</th>
                        <th className="py-2.5 px-3">KELAS</th>
                        <th className="py-2.5 px-3">MATA PELAJARAN</th>
                        {isOperator && <th className="py-2.5 px-3">GURU PENGAMPU</th>}
                        <th className="py-2.5 px-3 text-center w-20 print:hidden">AKSI</th>
                      </tr>
                    </thead>
                    <tbody className={`divide-y ${isDarkMode ? 'divide-slate-800 text-slate-200' : 'divide-slate-200 text-slate-800'}`}>
                      {loading ? (
                        <tr>
                          <td colSpan={6} className={`py-10 text-center font-medium ${isDarkMode ? 'text-slate-500' : 'text-slate-600'}`}>Memuat data jadwal...</td>
                        </tr>
                      ) : jadwalList.length === 0 ? (
                        <tr>
                          <td colSpan={6} className={`py-10 text-center font-medium ${isDarkMode ? 'text-slate-500' : 'text-slate-600'}`}>Belum ada jadwal mengajar tersimpan.</td>
                        </tr>
                      ) : (
                        jadwalList.map((item, index) => {
                          const namaKelas = typeof item.kelas === 'object' ? item.kelas?.nama_kelas : item.kelas
                          const namaMapel = typeof item.mapel === 'object' ? item.mapel?.nama_mapel : item.mapel
                          return (
                            <tr key={item.id || index} className={`transition ${isDarkMode ? 'hover:bg-slate-800/60' : 'hover:bg-indigo-50/60'}`}>
                              <td className="py-2 px-3 font-extrabold text-amber-500">{item.hari}</td>
                              <td className={`py-2 px-3 font-bold ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>{item.jam}</td>
                              <td className={`py-2 px-3 font-extrabold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                                <span className={`px-2 py-0.5 rounded-md text-[11px] border ${
                                  isDarkMode ? 'bg-indigo-950 text-indigo-300 border-indigo-800' : 'bg-indigo-100 text-indigo-800 border-indigo-200'
                                }`}>
                                  {namaKelas || '-'}
                                </span>
                              </td>
                              <td className={`py-2 px-3 font-extrabold ${isDarkMode ? 'text-indigo-300' : 'text-indigo-950'}`}>{namaMapel || '-'}</td>
                              {isOperator && (
                                <td className={`py-2 px-3 font-bold ${isDarkMode ? 'text-slate-400' : 'text-slate-700'}`}>{item.guru_email}</td>
                              )}
                              <td className="py-2 px-3 text-center print:hidden">
                                <button
                                  onClick={() => handleDelete(item.id)}
                                  className="bg-rose-50 text-rose-600 hover:bg-rose-100 p-1.5 rounded-lg border border-rose-200 transition cursor-pointer"
                                  title="Hapus Jadwal"
                                >
                                  🗑️
                                </button>
                              </td>
                            </tr>
                          )
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}

          {/* TAB 2: REKAPITULASI & CETAK */}
          {activeTab === 'rekap' && (
            <div className="flex-1 flex flex-col min-h-0 space-y-3">
              
              {/* FILTER BAR */}
              <div className={`grid grid-cols-1 md:grid-cols-3 gap-2.5 backdrop-blur-md border p-3 rounded-2xl shrink-0 shadow-xs print:hidden ${
                isDarkMode 
                  ? 'bg-slate-900/90 border-slate-800' 
                  : 'bg-gradient-to-br from-indigo-100/90 via-slate-100/90 to-indigo-50/90 border-indigo-200/80'
              }`}>
                <div>
                  <label className={`block text-[10px] font-extrabold uppercase mb-1 ${isDarkMode ? 'text-indigo-300' : 'text-indigo-950'}`}>FILTER HARI</label>
                  <select
                    value={filterHari}
                    onChange={(e) => setFilterHari(e.target.value)}
                    className={`w-full border rounded-xl px-2.5 py-1 text-xs font-bold focus:outline-none ${
                      isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                    }`}
                  >
                    <option value="">Semua Hari</option>
                    <option value="Senin">Senin</option>
                    <option value="Selasa">Selasa</option>
                    <option value="Rabu">Rabu</option>
                    <option value="Kamis">Kamis</option>
                    <option value="Sabtu">Sabtu</option>
                    <option value="Minggu">Minggu</option>
                  </select>
                </div>

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
                      <option key={k.id} value={k.id}>{k.nama_kelas}</option>
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
                      <option key={m.id} value={m.id}>{m.nama_mapel}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* TABEL REKAP */}
              <div className={`backdrop-blur-md border rounded-2xl p-3.5 flex-1 flex flex-col min-h-0 shadow-xs overflow-hidden ${
                isDarkMode 
                  ? 'bg-slate-900/90 border-slate-800' 
                  : 'bg-gradient-to-br from-indigo-100/90 via-slate-100/90 to-indigo-50/90 border-indigo-200/80'
              }`}>
                <div className={`flex-1 overflow-y-auto rounded-xl border ${isDarkMode ? 'bg-slate-900/90 border-slate-800' : 'bg-white/90 border-indigo-200/80'}`}>
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className={`sticky top-0 z-10 shadow-xs ${isDarkMode ? 'bg-slate-800' : 'bg-indigo-100'}`}>
                      <tr className={`border-b font-extrabold uppercase text-[11px] ${isDarkMode ? 'text-indigo-300 border-slate-700' : 'text-indigo-950 border-indigo-200'}`}>
                        <th className="py-2.5 px-3 w-12 text-center">NO</th>
                        <th className="py-2.5 px-3">HARI</th>
                        <th className="py-2.5 px-3">JAM MENGAJAR</th>
                        <th className="py-2.5 px-3">KELAS</th>
                        <th className="py-2.5 px-3">MATA PELAJARAN</th>
                        <th className="py-2.5 px-3 text-center w-20 print:hidden">AKSI</th>
                      </tr>
                    </thead>
                    <tbody className={`divide-y ${isDarkMode ? 'divide-slate-800 text-slate-200' : 'divide-slate-200 text-slate-800'}`}>
                      {loading ? (
                        <tr>
                          <td colSpan={6} className={`py-10 text-center font-medium ${isDarkMode ? 'text-slate-500' : 'text-slate-600'}`}>Memuat data jadwal...</td>
                        </tr>
                      ) : filteredRekapList.length === 0 ? (
                        <tr>
                          <td colSpan={6} className={`py-10 text-center font-medium ${isDarkMode ? 'text-slate-500' : 'text-slate-600'}`}>Tidak ada data jadwal ditemukan.</td>
                        </tr>
                      ) : (
                        filteredRekapList.map((item, index) => {
                          const namaKelas = typeof item.kelas === 'object' ? item.kelas?.nama_kelas : item.kelas
                          const namaMapel = typeof item.mapel === 'object' ? item.mapel?.nama_mapel : item.mapel
                          return (
                            <tr key={item.id || index} className={`transition ${isDarkMode ? 'hover:bg-slate-800/60' : 'hover:bg-indigo-50/60'}`}>
                              <td className={`py-2 px-3 text-center font-bold ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{index + 1}</td>
                              <td className="py-2 px-3 font-extrabold text-amber-500">{item.hari}</td>
                              <td className={`py-2 px-3 font-bold ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>{item.jam}</td>
                              <td className={`py-2 px-3 font-extrabold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                                <span className={`px-2 py-0.5 rounded-md text-[11px] border ${
                                  isDarkMode ? 'bg-indigo-950 text-indigo-300 border-indigo-800' : 'bg-indigo-100 text-indigo-800 border-indigo-200'
                                }`}>
                                  {namaKelas || '-'}
                                </span>
                              </td>
                              <td className={`py-2 px-3 font-extrabold ${isDarkMode ? 'text-indigo-300' : 'text-indigo-950'}`}>{namaMapel || '-'}</td>
                              <td className="py-2 px-3 text-center print:hidden">
                                <button
                                  onClick={() => handleDelete(item.id)}
                                  className="bg-rose-50 text-rose-600 hover:bg-rose-100 p-1.5 rounded-lg border border-rose-200 transition cursor-pointer"
                                  title="Hapus Jadwal"
                                >
                                  🗑️
                                </button>
                              </td>
                            </tr>
                          )
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}

        </main>

        {/* FOOTER BADGE */}
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

      {/* BOTTOM NAVIGATION DOCK */}
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

          <Link href="/jadwal" className="flex flex-col items-center gap-0.5 text-[11px] font-bold text-indigo-500 transition">
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