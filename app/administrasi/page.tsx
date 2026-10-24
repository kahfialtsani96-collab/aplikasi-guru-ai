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

interface SuratAdministrasi {
  id: number
  created_at?: string
  nomor_surat: string
  jenis_surat: string
  penerima: string
  keterangan: string
  semester?: string
  tahun_ajaran?: string
}

interface OptionItem {
  id: number
  nama: string
  extraInfo?: string
}

const KODE_SURAT_MAP: Record<string, string> = {
  'Surat Keterangan Aktif Siswa': '421',
  'Surat Mutasi Siswa': '422',
  'Surat Undangan Orang Tua/Wali': '005',
  'Surat Tugas Guru': '800',
  'Surat Keputusan Kepala Sekolah': '188',
}

export default function AdministrasiTUPage() {
  const router = useRouter()
  const { isOperator, loading: loadingRole } = useAuthRole()

  const [userDisplayName, setUserDisplayName] = useState('OPERATOR')
  const [suratList, setSuratList] = useState<SuratAdministrasi[]>([])

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
  
  // State Form
  const [jenisSurat, setJenisSurat] = useState('Surat Keterangan Aktif Siswa')
  const [penerima, setPenerima] = useState('')
  const [keterangan, setKeterangan] = useState('')
  const [nomorSurat, setNomorSurat] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  // Modal Editor Narasi AI
  const [isModalEditorOpen, setIsModalEditorOpen] = useState(false)

  // Toggle Opsi Cetak
  const [includeTTD, setIncludeTTD] = useState(true)
  const [includeStempel, setIncludeStempel] = useState(true)

  // Smart Form Options
  const [siswaOptions, setSiswaOptions] = useState<OptionItem[]>([])
  const [guruOptions, setGuruOptions] = useState<OptionItem[]>([])
  const [selectedEntityId, setSelectedEntityId] = useState('')

  // AI Generator State
  const [isAiGenerating, setIsAiGenerating] = useState(false)

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
        setUserDisplayName(String(nameFromMeta).toUpperCase())
      }
    }
    getUserData()
    fetchSmartOptions()
  }, [])

  useEffect(() => {
    fetchSurat()
  }, [selectedSemester, selectedTahunAjaran])

  useEffect(() => {
    if (!editingId && jenisSurat) {
      generateAutoNomorSurat(jenisSurat)
    }
  }, [jenisSurat, selectedTahunAjaran, editingId])

  const generateAutoNomorSurat = async (jenis: string) => {
    const kodeKlasifikasi = KODE_SURAT_MAP[jenis] || '421'
    const tahun = selectedTahunAjaran.split('/')[0] || '2026'

    const { count, error } = await supabase
      .from('surat_administrasi')
      .select('id', { count: 'exact', head: true })
      .eq('jenis_surat', jenis)
      .eq('tahun_ajaran', selectedTahunAjaran)

    if (!error) {
      const nextIndex = (count || 0) + 1
      const formattedIndex = String(nextIndex).padStart(3, '0')
      const autoNomor = `${kodeKlasifikasi}/${formattedIndex}/SMP-MM/${tahun}`
      setNomorSurat(autoNomor)
    }
  }

  const fetchSmartOptions = async () => {
    const { data: dataSiswa } = await supabase.from('siswa').select('id, nama_lengkap, nisn').order('nama_lengkap')
    if (dataSiswa) {
      setSiswaOptions(dataSiswa.map((s: Record<string, any>) => ({ 
        id: Number(s.id), 
        nama: String(s.nama_lengkap || ''), 
        extraInfo: `NISN: ${s.nisn || '-'}` 
      })))
    }

    const { data: dataGuru } = await supabase.from('guru').select('id, nama_guru').order('nama_guru')
    if (dataGuru) {
      setGuruOptions(dataGuru.map((g: Record<string, any>) => ({ 
        id: Number(g.id), 
        nama: String(g.nama_guru || g.nama_lengkap || '') 
      })))
    }
  }

  const fetchSurat = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('surat_administrasi')
      .select('*')
      .eq('semester', selectedSemester)
      .eq('tahun_ajaran', selectedTahunAjaran)
      .order('id', { ascending: false })

    if (error) console.error('Error fetch surat:', error.message)
    if (data) setSuratList(data)
    setLoading(false)
  }

  const resetForm = () => {
    setJenisSurat('Surat Keterangan Aktif Siswa')
    setPenerima('')
    setKeterangan('')
    setSelectedEntityId('')
    setEditingId(null)
    generateAutoNomorSurat('Surat Keterangan Aktif Siswa')
  }

  const handleGenerateAiNarasi = async () => {
    if (!keterangan.trim()) {
      alert('Ketik poin/maksud singkat pada kolom Keterangan terlebih dahulu agar AI dapat merangkai narasi!')
      return
    }

    setIsAiGenerating(true)
    try {
      const promptText = `Buatkan narasi formal dan santun untuk ${jenisSurat} yang ditujukan kepada ${penerima || 'Penerima'}. Keperluan / Poin Maksud: ${keterangan}. Buat dalam 1-2 paragraf resmi tanpa salam pembuka berlebihan, dan murni hanya isi narasi surat saja.`
      
      const response = await fetch('/api/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tool: 'Asisten AI Persuratan TU',
          materiTopik: promptText
        })
      })

      if (response.ok) {
        const resData = await response.json()
        if (resData.result) {
          setKeterangan(String(resData.result).trim())
        }
      } else {
        alert('Gagal menghubungi AI Server.')
      }
    } catch (err: any) {
      alert('Terjadi kesalahan AI: ' + err.message)
    } finally {
      setIsAiGenerating(false)
    }
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
      semester: selectedSemester,
      tahun_ajaran: selectedTahunAjaran,
    }

    try {
      if (editingId) {
        const { error } = await supabase.from('surat_administrasi').update(payload).eq('id', editingId)
        if (!error) {
          alert('Berhasil memperbarui arsip surat!')
          resetForm()
          fetchSurat()
        } else alert('Gagal mengupdate surat: ' + error.message)
      } else {
        const { error } = await supabase.from('surat_administrasi').insert([payload])
        if (!error) {
          alert('Berhasil menyimpan arsip surat!')
          resetForm()
          fetchSurat()
        } else alert('Gagal menyimpan surat: ' + error.message)
      }
    } catch (err: any) {
      alert('Terjadi kesalahan: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (surat: SuratAdministrasi) => {
    setEditingId(surat.id)
    setJenisSurat(surat.jenis_surat)
    setPenerima(surat.penerima)
    setKeterangan(surat.keterangan || '')
    setNomorSurat(surat.nomor_surat)
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Hapus arsip surat ini?')) return
    const { error } = await supabase.from('surat_administrasi').delete().eq('id', id)
    if (!error) fetchSurat()
    else alert('Gagal menghapus surat: ' + error.message)
  }

  const handlePrintSurat = (surat: SuratAdministrasi) => {
    let rawNarasi = surat.keterangan || ''
    
    if (rawNarasi.includes('### 💡 Catatan') || rawNarasi.includes('Catatan Pedagogi') || rawNarasi.includes('Catatan Praktis') || rawNarasi.includes('Dokumen ini dibuat secara otomatis')) {
      rawNarasi = rawNarasi.split(/### 💡 Catatan|Catatan Pedagogi|Catatan Praktis|Dokumen ini dibuat secara otomatis/i)[0]
    }

    const cleanNarasi = rawNarasi
      .replace(/#{1,6}\s?/g, '')
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/---/g, '')
      .replace(/Paragraf \d+:\s?[^\n]+/gi, '')
      .replace(/\*Dokumen ini dibuat secara otomatis.*?\*/gi, '')
      .trim()

    let namaPenerima = surat.penerima
    let nisnPenerima = '-'
    const nisnMatch = surat.penerima.match(/(.*?)\s*\(NISN:\s*([\d-]+)\)/i)
    if (nisnMatch) {
      namaPenerima = nisnMatch[1].trim()
      nisnPenerima = nisnMatch[2].trim()
    }

    const printWindow = window.open('', '_blank')
    if (!printWindow) return

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${surat.jenis_surat} - ${surat.nomor_surat}</title>
          <style>
            @page { size: A4 portrait; margin: 15mm 20mm; }
            * { box-sizing: border-box; }
            body { font-family: 'Times New Roman', Times, serif; font-size: 11pt; line-height: 1.5; color: #000; margin: 0; padding: 0; }
            
            .kop-header { text-align: center; border-bottom: 3px double #000; padding-bottom: 2mm; margin-bottom: 5mm; position: relative; }
            .kop-logo { position: absolute; left: 0; top: 0; width: 22mm; height: 22mm; object-fit: contain; }
            .kop-arab { font-size: 14pt; margin: 0; font-family: 'Traditional Arabic', 'Amiri', serif; font-weight: bold; }
            .kop-yayasan { font-size: 10.5pt; font-weight: bold; margin: 0; text-transform: uppercase; }
            .kop-sekolah { font-size: 16pt; font-weight: bold; margin: 1mm 0; text-transform: uppercase; }
            .kop-alamat { font-size: 9pt; margin: 0; font-style: italic; }

            .title-area { text-align: center; margin: 5mm 0 4mm 0; }
            .title-area h2 { font-size: 12.5pt; font-weight: bold; text-decoration: underline; margin: 0; text-transform: uppercase; }
            .title-area p { font-size: 10.5pt; margin: 1mm 0 0 0; }

            .content-area { margin-top: 4mm; text-align: justify; }
            .identity-table { margin: 3mm 0 3mm 6mm; width: 95%; font-size: 11pt; }
            .identity-table td { padding: 1mm 0; vertical-align: top; }

            .ttd-container { margin-top: 8mm; float: right; width: 70mm; text-align: left; page-break-inside: avoid; }
            .signature-box { height: 20mm; position: relative; display: flex; align-items: center; margin: 1mm 0; }
            .stamp-img { height: 22mm; position: absolute; left: -8mm; top: -2mm; z-index: 1; opacity: 0.85; }
            .signature-img { height: 18mm; z-index: 2; position: relative; }
            .clear { clear: both; }
          </style>
        </head>
        <body>
          <div class="kop-header">
            <img src="/logo-smp.jpg" alt="Logo" class="kop-logo" />
            <p class="kop-arab">المعهد الإسلامي منى مصطفى</p>
            <p class="kop-yayasan">YAYASAN PONDOK PESANTREN MUNA MUSTOFA LAMPUNG</p>
            <p class="kop-sekolah">SMP MUNA MUSTOFA</p>
            <p class="kop-alamat">CAMPANG KECAMATAN GISTING KABUPATEN TANGGAMUS</p>
            <p class="kop-alamat">NPSN: 71407877 | SK IZIN OPERASIONAL: 503/029/IPO/VIII/36/2026</p>
            <p class="kop-alamat">Jl. PPTQ Muna Mustofa Kecamatan Gisting Kabupaten Tanggamus 35376</p>
          </div>

          <div class="title-area">
            <h2>${surat.jenis_surat.toUpperCase()}</h2>
            <p>Nomor: ${surat.nomor_surat}</p>
          </div>

          <div class="content-area">
            <p>Yang bertanda tangan di bawah ini Kepala SMP Muna Mustofa Gisting Tanggamus, menerangkan bahwa:</p>
            
            <table class="identity-table">
              <tr>
                <td width="30%">Nama / Ditujukan</td>
                <td width="3%">:</td>
                <td><b>${namaPenerima}</b></td>
              </tr>
              ${nisnPenerima !== '-' ? `
                <tr>
                  <td>NISN</td>
                  <td>:</td>
                  <td>${nisnPenerima}</td>
                </tr>
              ` : ''}
              <tr>
                <td>Periode Akademik</td>
                <td>:</td>
                <td>Semester ${surat.semester || selectedSemester} / TA ${surat.tahun_ajaran || selectedTahunAjaran}</td>
              </tr>
            </table>

            <p style="margin-top: 4mm; white-space: pre-line;">${cleanNarasi}</p>

            <p style="margin-top: 4mm;">Demikian surat keterangan ini dibuat dengan sebenarnya untuk dapat dipergunakan sebagaimana mestinya.</p>
          </div>

          <div class="ttd-container">
            <p style="margin:0;">Gisting, ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}<br/>
            Kepala SMP Muna Mustofa,</p>
            
            <div class="signature-box">
              ${includeStempel ? `<img src="/stempel-sekolah.png" alt="Stempel" class="stamp-img" />` : ''}
              ${includeTTD ? `<img src="/ttd-kepsek.png" alt="TTD" class="signature-img" />` : ''}
            </div>

            <p style="margin:0;"><b><u>SULASTRI, S.Pd., Gr.</u></b><br/>
            NUPTK. 6337763664131233</p>
          </div>
          <div class="clear"></div>
        </body>
      </html>
    `)

    printWindow.document.close()
    printWindow.focus()
    setTimeout(() => {
      printWindow.print()
      printWindow.close()
    }, 300)
  }

  const filteredSurat = suratList.filter(
    (s) =>
      s.nomor_surat.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.penerima.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.jenis_surat.toLowerCase().includes(searchQuery.toLowerCase())
  )

  if (loadingRole || !isOperator) {
    return (
      <div className={`min-h-screen p-8 flex items-center justify-center font-sans ${isDarkMode ? 'bg-slate-950 text-slate-100' : 'bg-[#E2E8F0] text-slate-700'}`}>
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
      className={`min-h-screen font-sans flex flex-col justify-between selection:bg-indigo-500 selection:text-white relative transition-colors duration-300 overflow-y-auto ${
        isDarkMode ? 'bg-slate-950 text-slate-100' : 'bg-[#E2E8F0] text-slate-800'
      }`}
    >
      
      {/* WATERMARK LOGO */}
      <div className={`fixed inset-0 pointer-events-none z-0 flex items-center justify-center select-none transition-opacity duration-300 ${
        isDarkMode ? 'opacity-[0.05]' : 'opacity-[0.15]'
      }`}>
        <img src="/logo-smp.jpg" alt="Watermark SMP Muna Mustofa" className="w-[850px] h-[850px] object-contain max-w-none" />
      </div>

      <div className="relative z-10 flex flex-col min-h-screen">
        
        {/* HEADER TOPBAR */}
        <header className={`border-b px-4 sm:px-6 py-2.5 flex flex-wrap sm:flex-nowrap items-center justify-between gap-3 shrink-0 shadow-xs transition-colors duration-300 ${
          isDarkMode ? 'bg-slate-900/90 border-slate-800 backdrop-blur-md' : 'bg-slate-100/90 border-slate-300 backdrop-blur-md'
        }`}>
          <div className="flex items-center gap-2.5">
            <Link href="/" className={`p-1.5 rounded-lg transition ${isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'}`} title="Kembali ke Dashboard">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </Link>
            <div className="flex items-center gap-2.5">
              <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl overflow-hidden flex items-center justify-center border p-0.5 shadow-xs shrink-0 ${
                isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-300'
              }`}>
                <img src="/logo-smp.jpg" alt="Logo SMP Muna Mustofa" className="w-full h-full object-contain" />
              </div>
              <div>
                <h1 className={`font-bold text-sm sm:text-base leading-none ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Aplikasi Guru AI</h1>
                <p className={`text-[10px] sm:text-[11px] font-bold mt-0.5 ${isDarkMode ? 'text-emerald-400' : 'text-emerald-800'}`}>Administrasi &amp; Persuratan TU</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 ml-auto sm:ml-0">
            <div className={`border text-xs font-bold px-2.5 py-1 rounded-xl flex items-center gap-1.5 shadow-xs ${
              isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-100' : 'bg-white border-slate-300 text-slate-800'
            }`}>
              <span className={`text-[9px] sm:text-[10px] uppercase ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Periode:</span>
              <select value={selectedSemester} onChange={(e) => setSelectedSemester(e.target.value as 'Ganjil' | 'Genap')} className={`font-bold rounded px-1 py-0.5 focus:outline-none ${
                isDarkMode ? 'bg-slate-900 text-indigo-300' : 'bg-slate-100 text-indigo-900'
              }`}>
                <option value="Ganjil">Ganjil</option>
                <option value="Genap">Genap</option>
              </select>
              <select value={selectedTahunAjaran} onChange={(e) => setSelectedTahunAjaran(e.target.value)} className={`font-bold rounded px-1 py-0.5 focus:outline-none ${
                isDarkMode ? 'bg-slate-900 text-indigo-300' : 'bg-slate-100 text-indigo-900'
              }`}>
                {Array.from({ length: 10 }, (_, i) => {
                  const startYear = 2024 + i
                  const tahunOption = `${startYear}/${startYear + 1}`
                  return <option key={tahunOption} value={tahunOption}>{tahunOption}</option>
                })}
              </select>
            </div>

            <div className={`border text-xs font-bold px-3 py-1.5 rounded-xl flex items-center gap-2 shadow-xs ${
              isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-100' : 'bg-white border-slate-300 text-slate-800'
            }`}>
              <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px] font-bold">
                {userDisplayName.charAt(0)}
              </span>
              <span className="max-w-[80px] sm:max-w-none truncate">{userDisplayName}</span>
              <span className={`text-[9px] sm:text-[10px] px-1.5 py-0.5 rounded font-extrabold uppercase ml-0.5 border ${
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

        {/* MAIN CONTAINER */}
        <main className="max-w-7xl w-full mx-auto p-3.5 sm:p-4 flex-1 flex flex-col space-y-4 pb-28 sm:pb-16">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 flex-1">
            
            {/* FORM INPUT SURAT */}
            <form onSubmit={handleSubmit} className={`lg:col-span-5 p-4 sm:p-5 backdrop-blur-md border rounded-2xl flex flex-col justify-between shadow-xs space-y-4 ${
              isDarkMode 
                ? 'bg-slate-900/90 border-slate-800' 
                : 'bg-gradient-to-br from-indigo-100/90 via-slate-100/90 to-indigo-50/90 border-indigo-200/80'
            }`}>
              <div className="space-y-3">
                <div className={`flex items-center gap-2 border-b pb-2 ${isDarkMode ? 'border-slate-800' : 'border-indigo-200/80'}`}>
                  <span className="text-indigo-500 text-base">📑</span>
                  <h3 className={`font-extrabold text-sm ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                    {editingId ? 'Edit Arsip Surat' : 'Buat / Registrasi Surat TU'}
                  </h3>
                </div>

                <div>
                  <label className={`block text-[10px] font-extrabold uppercase tracking-wider mb-1 ${isDarkMode ? 'text-indigo-300' : 'text-indigo-950'}`}>1. Jenis Surat *</label>
                  <select
                    value={jenisSurat}
                    onChange={(e) => {
                      setJenisSurat(e.target.value)
                      setPenerima('')
                    }}
                    className={`w-full border rounded-xl px-3 py-2 text-xs font-bold focus:outline-none focus:border-indigo-600 cursor-pointer ${
                      isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                    }`}
                  >
                    <option value="Surat Keterangan Aktif Siswa">Surat Keterangan Aktif Siswa</option>
                    <option value="Surat Mutasi Siswa">Surat Mutasi Siswa</option>
                    <option value="Surat Undangan Orang Tua/Wali">Surat Undangan Orang Tua/Wali</option>
                    <option value="Surat Tugas Guru">Surat Tugas Guru</option>
                    <option value="Surat Keputusan Kepala Sekolah">Surat Keputusan Kepala Sekolah</option>
                  </select>
                </div>

                {jenisSurat.includes('Siswa') ? (
                  <div>
                    <label className={`block text-[10px] font-extrabold uppercase tracking-wider mb-1 ${isDarkMode ? 'text-indigo-300' : 'text-indigo-950'}`}>2. Pilih Siswa *</label>
                    <select
                      value={selectedEntityId}
                      onChange={(e) => {
                        setSelectedEntityId(e.target.value)
                        const found = siswaOptions.find(s => String(s.id) === e.target.value)
                        if (found) setPenerima(`${found.nama} (${found.extraInfo})`)
                      }}
                      className={`w-full border rounded-xl px-3 py-2 text-xs font-bold focus:outline-none focus:border-indigo-600 cursor-pointer mb-1 ${
                        isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                      }`}
                    >
                      <option value="">-- Pilih Nama Siswa --</option>
                      {siswaOptions.map(s => (
                        <option key={s.id} value={s.id}>{s.nama} - {s.extraInfo}</option>
                      ))}
                    </select>
                  </div>
                ) : jenisSurat.includes('Guru') ? (
                  <div>
                    <label className={`block text-[10px] font-extrabold uppercase tracking-wider mb-1 ${isDarkMode ? 'text-indigo-300' : 'text-indigo-950'}`}>2. Pilih Guru *</label>
                    <select
                      value={selectedEntityId}
                      onChange={(e) => {
                        setSelectedEntityId(e.target.value)
                        const found = guruOptions.find(g => String(g.id) === e.target.value)
                        if (found) setPenerima(found.nama)
                      }}
                      className={`w-full border rounded-xl px-3 py-2 text-xs font-bold focus:outline-none focus:border-indigo-600 cursor-pointer mb-1 ${
                        isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                      }`}
                    >
                      <option value="">-- Pilih Nama Guru --</option>
                      {guruOptions.map(g => (
                        <option key={g.id} value={g.id}>{g.nama}</option>
                      ))}
                    </select>
                  </div>
                ) : null}

                <div>
                  <label className={`block text-[10px] font-extrabold uppercase tracking-wider mb-1 ${isDarkMode ? 'text-indigo-300' : 'text-indigo-950'}`}>3. Penerima / Ditujukan Kepada *</label>
                  <input
                    type="text"
                    value={penerima}
                    onChange={(e) => setPenerima(e.target.value)}
                    placeholder="Nama Siswa / Guru / Instansi"
                    className={`w-full border rounded-xl px-3 py-2 text-xs font-bold focus:outline-none focus:border-indigo-600 ${
                      isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                    }`}
                    required
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className={`block text-[10px] font-extrabold uppercase tracking-wider ${isDarkMode ? 'text-indigo-300' : 'text-indigo-950'}`}>4. Keterangan / Narasi Surat</label>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setIsModalEditorOpen(true)}
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-md transition shadow-xs cursor-pointer ${
                          isDarkMode ? 'bg-slate-800 hover:bg-slate-700 text-slate-200' : 'bg-slate-200 hover:bg-slate-300 text-slate-800'
                        }`}
                        title="Buka Editor Layar Penuh"
                      >
                        🔍 Layar Penuh
                      </button>
                      <button
                        type="button"
                        onClick={handleGenerateAiNarasi}
                        disabled={isAiGenerating}
                        className="text-[10px] bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-black px-2.5 py-0.5 rounded-md transition shadow-xs flex items-center gap-1 cursor-pointer disabled:opacity-50"
                      >
                        <span>✨</span>
                        <span>{isAiGenerating ? 'AI Menyusun...' : 'Buat via AI'}</span>
                      </button>
                    </div>
                  </div>
                  <textarea
                    rows={6}
                    value={keterangan}
                    onChange={(e) => setKeterangan(e.target.value)}
                    placeholder="Tulis maksud singkat lalu klik 'Buat via AI' untuk merangkai narasi..."
                    className={`w-full border rounded-xl p-3 text-xs font-medium focus:outline-none focus:border-indigo-600 leading-relaxed resize-y ${
                      isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                    }`}
                  />
                </div>

                <div className={`p-2.5 rounded-xl border ${isDarkMode ? 'bg-slate-800/80 border-slate-700' : 'bg-indigo-50/80 border-indigo-200/80'}`}>
                  <div className="flex items-center justify-between mb-1">
                    <label className={`block text-[10px] font-extrabold uppercase tracking-wider ${isDarkMode ? 'text-indigo-300' : 'text-indigo-950'}`}>5. Nomor Surat Resmi *</label>
                    <span className={`text-[9px] font-black px-1.5 py-0.2 rounded ${isDarkMode ? 'bg-indigo-950 text-indigo-300' : 'bg-indigo-200 text-indigo-900'}`}>Auto / Editable</span>
                  </div>
                  <input
                    type="text"
                    value={nomorSurat}
                    onChange={(e) => setNomorSurat(e.target.value)}
                    placeholder="Contoh: 421/001/SMP-MM/2026"
                    className={`w-full border rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold focus:outline-none focus:border-indigo-600 ${
                      isDarkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                    }`}
                    required
                  />
                </div>
              </div>

              <div className={`flex gap-2 pt-2 border-t shrink-0 ${isDarkMode ? 'border-slate-800' : 'border-indigo-200/60'}`}>
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
                    className={`px-3 border text-xs font-bold rounded-xl transition cursor-pointer ${
                      isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700' : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    Batal
                  </button>
                )}
              </div>
            </form>

            {/* ARSIP SURAT: CARD LIST (MOBILE) & TABEL (DESKTOP) */}
            <div className={`lg:col-span-7 backdrop-blur-md border rounded-2xl p-4 sm:p-5 flex flex-col shadow-xs ${
              isDarkMode 
                ? 'bg-slate-900/90 border-slate-800' 
                : 'bg-gradient-to-br from-indigo-100/90 via-slate-100/90 to-indigo-50/90 border-indigo-200/80'
            }`}>
              <div className={`flex items-center justify-between border-b pb-2.5 shrink-0 gap-3 flex-wrap ${isDarkMode ? 'border-slate-800' : 'border-indigo-200/80'}`}>
                <div className="flex items-center gap-2">
                  <span className="text-indigo-500 text-base">📂</span>
                  <h3 className={`font-extrabold text-sm ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Arsip Surat Keluar TU</h3>
                </div>

                <div className={`flex items-center gap-3 border px-3 py-1 rounded-xl text-xs font-bold shadow-xs ${
                  isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-white border-slate-300 text-slate-700'
                }`}>
                  <span className={`text-[10px] uppercase ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Cetak:</span>
                  <label className="flex items-center gap-1 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={includeTTD}
                      onChange={(e) => setIncludeTTD(e.target.checked)}
                      className="rounded accent-indigo-600"
                    />
                    <span>TTD</span>
                  </label>
                  <label className="flex items-center gap-1 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={includeStempel}
                      onChange={(e) => setIncludeStempel(e.target.checked)}
                      className="rounded accent-indigo-600"
                    />
                    <span>Stempel</span>
                  </label>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="🔍 Cari No. / Penerima..."
                    className={`border rounded-lg px-2.5 py-1 text-xs font-bold focus:outline-none focus:border-indigo-600 flex-1 sm:w-40 ${
                      isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                    }`}
                  />
                  <button
                    onClick={fetchSurat}
                    className={`text-[11px] border px-2.5 py-1 rounded-lg font-bold transition cursor-pointer whitespace-nowrap ${
                      isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700' : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    🔄 Refresh
                  </button>
                </div>
              </div>

              {/* 1. MOBILE CARD VIEW (md:hidden) */}
              <div className="block md:hidden mt-3 space-y-3">
                {loading ? (
                  <div className={`p-6 text-center text-xs font-medium ${isDarkMode ? 'text-slate-500' : 'text-slate-600'}`}>
                    Memuat arsip surat...
                  </div>
                ) : filteredSurat.length === 0 ? (
                  <div className={`p-6 text-center text-xs font-medium ${isDarkMode ? 'text-slate-500' : 'text-slate-600'}`}>
                    Belum ada arsip surat tercatat di periode ini.
                  </div>
                ) : (
                  filteredSurat.map((s) => (
                    <div
                      key={s.id}
                      className={`p-3.5 rounded-xl border transition shadow-xs flex flex-col gap-2 ${
                        isDarkMode ? 'bg-slate-800/90 border-slate-700' : 'bg-white border-indigo-200/90'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-xs font-bold text-indigo-400">
                          {s.nomor_surat}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold border ${
                          isDarkMode ? 'bg-indigo-950 text-indigo-300 border-indigo-800' : 'bg-indigo-100 text-indigo-800 border-indigo-200'
                        }`}>
                          {s.jenis_surat}
                        </span>
                      </div>

                      <div className="flex flex-col gap-1 border-t border-b py-2 my-0.5 border-slate-700/40">
                        <span className={`font-extrabold text-xs ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                          👤 Penerima: {s.penerima}
                        </span>
                        <p className={`text-[11px] font-medium line-clamp-3 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                          📖 {s.keterangan || '-'}
                        </p>
                      </div>

                      <div className="flex items-center justify-end gap-1.5 pt-0.5">
                        <button
                          onClick={() => handlePrintSurat(s)}
                          className="px-3 py-1.5 bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-bold rounded-lg flex items-center gap-1 cursor-pointer hover:bg-indigo-100"
                        >
                          🖨️ Cetak
                        </button>
                        <button
                          onClick={() => handleEdit(s)}
                          className="px-3 py-1.5 bg-amber-50 border border-amber-200 text-amber-700 text-xs font-bold rounded-lg flex items-center gap-1 cursor-pointer hover:bg-amber-100"
                        >
                          ✏️ Edit
                        </button>
                        <button
                          onClick={() => handleDelete(s.id)}
                          className="px-3 py-1.5 bg-rose-50 border border-rose-200 text-rose-600 text-xs font-bold rounded-lg flex items-center gap-1 cursor-pointer hover:bg-rose-100"
                        >
                          🗑️ Hapus
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* 2. DESKTOP TABEL HTML (hidden md:block) */}
              <div className={`hidden md:block mt-3 overflow-x-auto rounded-xl border ${isDarkMode ? 'bg-slate-900/90 border-slate-800' : 'bg-white/90 border-indigo-200/80'}`}>
                <table className="w-full text-left border-collapse text-xs">
                  <thead className={`sticky top-0 z-10 shadow-xs ${isDarkMode ? 'bg-slate-800' : 'bg-indigo-100'}`}>
                    <tr className={`border-b font-extrabold uppercase tracking-wider text-[11px] ${isDarkMode ? 'text-indigo-300 border-slate-700' : 'text-indigo-950 border-indigo-200'}`}>
                      <th className="py-2.5 px-3">NO. SURAT</th>
                      <th className="py-2.5 px-3">JENIS SURAT</th>
                      <th className="py-2.5 px-3">PENERIMA</th>
                      <th className="py-2.5 px-3">KEPERLUAN / NARASI</th>
                      <th className="py-2.5 px-3 text-center w-28">AKSI</th>
                    </tr>
                  </thead>
                  <tbody className={`divide-y ${isDarkMode ? 'divide-slate-800 text-slate-200' : 'divide-slate-200 text-slate-800'}`}>
                    {loading ? (
                      <tr>
                        <td colSpan={5} className={`py-10 text-center font-medium ${isDarkMode ? 'text-slate-500' : 'text-slate-600'}`}>
                          Memuat arsip surat...
                        </td>
                      </tr>
                    ) : filteredSurat.length === 0 ? (
                      <tr>
                        <td colSpan={5} className={`py-10 text-center font-medium ${isDarkMode ? 'text-slate-500' : 'text-slate-600'}`}>
                          Belum ada arsip surat tercatat di periode ini.
                        </td>
                      </tr>
                    ) : (
                      filteredSurat.map((s) => (
                        <tr key={s.id} className={`transition ${isDarkMode ? 'hover:bg-slate-800/60' : 'hover:bg-indigo-50/60'}`}>
                          <td className="py-2.5 px-3 font-mono font-bold text-indigo-400 whitespace-nowrap">{s.nomor_surat}</td>
                          <td className={`py-2.5 px-3 font-extrabold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{s.jenis_surat}</td>
                          <td className={`py-2.5 px-3 font-bold ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>{s.penerima}</td>
                          <td className={`py-2.5 px-3 font-medium line-clamp-2 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>{s.keterangan || '-'}</td>
                          <td className="py-2.5 px-3 text-center space-x-1 whitespace-nowrap">
                            <button
                              onClick={() => handlePrintSurat(s)}
                              className="bg-indigo-50 text-indigo-700 hover:bg-indigo-100 p-1.5 rounded-lg border border-indigo-200 transition cursor-pointer"
                              title="Cetak Surat Resmi"
                            >
                              🖨️
                            </button>
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

        {/* MODAL EDITOR NARASI LAYAR PENUH */}
        {isModalEditorOpen && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className={`w-full max-w-3xl rounded-2xl shadow-2xl border flex flex-col max-h-[85vh] overflow-hidden ${
              isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
            }`}>
              <div className="px-5 py-3.5 bg-indigo-900 text-white flex items-center justify-between">
                <h3 className="font-extrabold text-sm flex items-center gap-2">
                  <span>📝</span> Editor Fokus Narasi Surat
                </h3>
                <button
                  onClick={() => setIsModalEditorOpen(false)}
                  className="text-white hover:bg-white/20 rounded-lg p-1 transition cursor-pointer"
                >
                  ✕
                </button>
              </div>
              <div className="p-5 flex-1 flex flex-col space-y-3">
                <p className={`text-xs font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                  Sunting dan sesuaikan teks narasi surat resmi di bawah ini dengan nyaman.
                </p>
                <textarea
                  value={keterangan}
                  onChange={(e) => setKeterangan(e.target.value)}
                  className={`w-full flex-1 min-h-[300px] border rounded-xl p-4 text-sm font-medium leading-relaxed focus:outline-none focus:border-indigo-600 resize-none font-serif ${
                    isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                  }`}
                  placeholder="Ketik atau edit narasi surat..."
                />
              </div>
              <div className={`px-5 py-3 border-t flex justify-end gap-2 ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-100 border-slate-200'}`}>
                <button
                  onClick={() => setIsModalEditorOpen(false)}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs px-4 py-2 rounded-xl transition cursor-pointer"
                >
                  Selesai Menyunting
                </button>
              </div>
            </div>
          </div>
        )}

        {/* FOOTER BADGE */}
        <div className="pb-20 sm:pb-16 pt-2 flex justify-center shrink-0">
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
      <div className={`border-t fixed bottom-0 left-0 right-0 z-50 shadow-lg shrink-0 transition-colors duration-300 ${
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