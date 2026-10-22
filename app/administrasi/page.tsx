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
        setUserDisplayName(nameFromMeta.toUpperCase())
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
      setSiswaOptions(dataSiswa.map((s: any) => ({ id: s.id, nama: s.nama_lengkap, extraInfo: `NISN: ${s.nisn || '-'}` })))
    }

    const { data: dataGuru } = await supabase.from('guru').select('id, nama_lengkap').order('nama_lengkap')
    if (dataGuru) {
      setGuruOptions(dataGuru.map((g: any) => ({ id: g.id, nama: g.nama_lengkap })))
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
          setKeterangan(resData.result.trim())
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
      <div className="h-screen bg-[#E2E8F0] text-slate-700 p-8 flex items-center justify-center font-sans">
        <div className="bg-white/90 backdrop-blur-md border border-slate-300 p-6 rounded-2xl text-center space-y-2 shadow-md">
          <p className="text-slate-900 font-bold text-sm">Memeriksa Hak Akses Operator...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen bg-[#E2E8F0] text-slate-800 font-sans flex flex-col justify-between selection:bg-indigo-500 selection:text-white overflow-hidden relative">
      
      {/* WATERMARK LOGO */}
      <div className="fixed inset-0 pointer-events-none z-0 flex items-center justify-center opacity-[0.15] select-none">
        <img src="/logo-smp.jpg" alt="Watermark SMP Muna Mustofa" className="w-[850px] h-[850px] object-contain max-w-none" />
      </div>

      <div className="relative z-10 flex flex-col h-full overflow-hidden">
        
        {/* HEADER TOPBAR */}
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
            <div className="bg-white border border-slate-300 text-slate-800 text-xs font-bold px-3 py-1 rounded-xl flex items-center gap-2 shadow-xs">
              <span className="text-slate-500 text-[10px] uppercase">Periode:</span>
              <select value={selectedSemester} onChange={(e) => setSelectedSemester(e.target.value as 'Ganjil' | 'Genap')} className="bg-slate-100 font-bold text-indigo-900 rounded px-1 py-0.5 focus:outline-none">
                <option value="Ganjil">Ganjil</option>
                <option value="Genap">Genap</option>
              </select>
              <select value={selectedTahunAjaran} onChange={(e) => setSelectedTahunAjaran(e.target.value)} className="bg-slate-100 font-bold text-indigo-900 rounded px-1 py-0.5 focus:outline-none">
                {Array.from({ length: 10 }, (_, i) => {
                  const startYear = 2024 + i
                  const tahunOption = `${startYear}/${startYear + 1}`
                  return <option key={tahunOption} value={tahunOption}>{tahunOption}</option>
                })}
              </select>
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

        {/* MAIN CONTAINER */}
        <main className="max-w-7xl w-full mx-auto p-4 flex-1 flex flex-col min-h-0">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 flex-1 min-h-0">
            
            {/* FORM INPUT SURAT - EXPANDED FIELD (5 COLUMNS) */}
            <form onSubmit={handleSubmit} className="lg:col-span-5 p-5 bg-gradient-to-br from-indigo-100/90 via-slate-100/90 to-indigo-50/90 backdrop-blur-md border border-indigo-200/80 rounded-2xl flex flex-col justify-between shadow-xs h-full overflow-hidden">
              <div className="space-y-3 overflow-y-auto pr-1 flex-1">
                <div className="flex items-center gap-2 border-b border-indigo-200/80 pb-2">
                  <span className="text-indigo-800 text-base">📑</span>
                  <h3 className="font-extrabold text-slate-900 text-sm">
                    {editingId ? 'Edit Arsip Surat' : 'Buat / Registrasi Surat TU'}
                  </h3>
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold text-indigo-950 uppercase tracking-wider mb-1">1. Jenis Surat *</label>
                  <select
                    value={jenisSurat}
                    onChange={(e) => {
                      setJenisSurat(e.target.value)
                      setPenerima('')
                    }}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 font-bold focus:outline-none focus:border-indigo-600 cursor-pointer"
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
                    <label className="block text-[10px] font-extrabold text-indigo-950 uppercase tracking-wider mb-1">2. Pilih Siswa *</label>
                    <select
                      value={selectedEntityId}
                      onChange={(e) => {
                        setSelectedEntityId(e.target.value)
                        const found = siswaOptions.find(s => String(s.id) === e.target.value)
                        if (found) setPenerima(`${found.nama} (${found.extraInfo})`)
                      }}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 font-bold focus:outline-none focus:border-indigo-600 cursor-pointer mb-1"
                    >
                      <option value="">-- Pilih Nama Siswa --</option>
                      {siswaOptions.map(s => (
                        <option key={s.id} value={s.id}>{s.nama} - {s.extraInfo}</option>
                      ))}
                    </select>
                  </div>
                ) : jenisSurat.includes('Guru') ? (
                  <div>
                    <label className="block text-[10px] font-extrabold text-indigo-950 uppercase tracking-wider mb-1">2. Pilih Guru *</label>
                    <select
                      value={selectedEntityId}
                      onChange={(e) => {
                        setSelectedEntityId(e.target.value)
                        const found = guruOptions.find(g => String(g.id) === e.target.value)
                        if (found) setPenerima(found.nama)
                      }}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 font-bold focus:outline-none focus:border-indigo-600 cursor-pointer mb-1"
                    >
                      <option value="">-- Pilih Nama Guru --</option>
                      {guruOptions.map(g => (
                        <option key={g.id} value={g.id}>{g.nama}</option>
                      ))}
                    </select>
                  </div>
                ) : null}

                <div>
                  <label className="block text-[10px] font-extrabold text-indigo-950 uppercase tracking-wider mb-1">3. Penerima / Ditujukan Kepada *</label>
                  <input
                    type="text"
                    value={penerima}
                    onChange={(e) => setPenerima(e.target.value)}
                    placeholder="Nama Siswa / Guru / Instansi"
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 font-bold focus:outline-none focus:border-indigo-600"
                    required
                  />
                </div>

                {/* KOTAK NARASI AI LEBIH TINGGI DENGAN TOMBOL EDIT FOKUS */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[10px] font-extrabold text-indigo-950 uppercase tracking-wider">4. Keterangan / Narasi Surat</label>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setIsModalEditorOpen(true)}
                        className="text-[10px] bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold px-2 py-0.5 rounded-md transition shadow-xs cursor-pointer"
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
                    rows={8}
                    value={keterangan}
                    onChange={(e) => setKeterangan(e.target.value)}
                    placeholder="Tulis maksud singkat lalu klik 'Buat via AI' untuk merangkai narasi..."
                    className="w-full bg-white border border-slate-300 rounded-xl p-3 text-xs text-slate-900 font-medium focus:outline-none focus:border-indigo-600 leading-relaxed resize-y"
                  />
                </div>

                <div className="bg-indigo-50/80 p-2.5 rounded-xl border border-indigo-200/80">
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[10px] font-extrabold text-indigo-950 uppercase tracking-wider">5. Nomor Surat Resmi *</label>
                    <span className="text-[9px] bg-indigo-200 text-indigo-900 font-black px-1.5 py-0.2 rounded">Auto / Editable</span>
                  </div>
                  <input
                    type="text"
                    value={nomorSurat}
                    onChange={(e) => setNomorSurat(e.target.value)}
                    placeholder="Contoh: 421/001/SMP-MM/2026"
                    className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 font-mono font-bold focus:outline-none focus:border-indigo-600"
                    required
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2 mt-2 border-t border-indigo-200/60 shrink-0">
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

            {/* TABEL ARSIP SURAT (7 COLUMNS) */}
            <div className="lg:col-span-7 bg-gradient-to-br from-indigo-100/90 via-slate-100/90 to-indigo-50/90 backdrop-blur-md border border-indigo-200/80 rounded-2xl p-5 flex flex-col shadow-xs h-full overflow-hidden">
              <div className="flex items-center justify-between border-b border-indigo-200/80 pb-2.5 shrink-0 gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="text-indigo-800 text-base">📂</span>
                  <h3 className="font-extrabold text-slate-900 text-sm">Arsip Surat Keluar TU</h3>
                </div>

                <div className="flex items-center gap-3 bg-white border border-slate-300 px-3 py-1 rounded-xl text-xs font-bold text-slate-700 shadow-xs">
                  <span className="text-[10px] text-slate-500 uppercase">Cetak:</span>
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

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="🔍 Cari No. / Penerima..."
                    className="bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs text-slate-900 font-bold focus:outline-none focus:border-indigo-600 w-40"
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
                      <th className="py-2.5 px-3">KEPERLUAN / NARASI</th>
                      <th className="py-2.5 px-3 text-center w-28">AKSI</th>
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
                          Belum ada arsip surat tercatat di periode ini.
                        </td>
                      </tr>
                    ) : (
                      filteredSurat.map((s) => (
                        <tr key={s.id} className="hover:bg-indigo-50/60 transition">
                          <td className="py-2.5 px-3 font-mono font-bold text-indigo-900 whitespace-nowrap">{s.nomor_surat}</td>
                          <td className="py-2.5 px-3 font-extrabold text-slate-900">{s.jenis_surat}</td>
                          <td className="py-2.5 px-3 font-bold text-slate-700">{s.penerima}</td>
                          <td className="py-2.5 px-3 font-medium text-slate-600 line-clamp-2">{s.keterangan || '-'}</td>
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
            <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl border border-slate-200 flex flex-col max-h-[85vh] overflow-hidden">
              <div className="px-5 py-3.5 bg-indigo-900 text-white flex items-center justify-between">
                <h3 className="font-extrabold text-sm flex items-center gap-2">
                  <span>📝</span> Editor Fokus Narasi Surat
                </h3>
                <button
                  onClick={() => setIsModalEditorOpen(false)}
                  className="text-white hover:bg-white/20 rounded-lg p-1 transition"
                >
                  ✕
                </button>
              </div>
              <div className="p-5 flex-1 flex flex-col space-y-3">
                <p className="text-xs text-slate-600 font-medium">
                  Sunting dan sesuaikan teks narasi surat resmi di bawah ini dengan nyaman.
                </p>
                <textarea
                  value={keterangan}
                  onChange={(e) => setKeterangan(e.target.value)}
                  className="w-full flex-1 min-h-[300px] border border-slate-300 rounded-xl p-4 text-sm text-slate-900 font-medium leading-relaxed focus:outline-none focus:border-indigo-600 resize-none font-serif"
                  placeholder="Ketik atau edit narasi surat..."
                />
              </div>
              <div className="px-5 py-3 bg-slate-100 border-t border-slate-200 flex justify-end gap-2">
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
        <div className="pb-16 pt-1 flex justify-center shrink-0">
          <div className="bg-slate-100/90 border border-slate-300 px-4 py-0.5 rounded-full text-center text-[10px] text-slate-700 font-medium shadow-xs">
            <span>Aplikasi Guru AI</span>
            <span className="mx-2">•</span>
            <span>Created by <strong className="text-emerald-900 font-bold">MUZAINI AL KAHFI</strong></span>
          </div>
        </div>
      </div>

      {/* BOTTOM NAVIGATION DOCK */}
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