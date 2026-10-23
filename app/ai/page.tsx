'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { createClient } from '@supabase/supabase-js'
import { motion } from 'framer-motion'
import { useAuthRole } from '@/hooks/useAuthRole'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const supabase = createClient(supabaseUrl, supabaseAnonKey)

export default function AiToolsPage() {
  const { isOperator } = useAuthRole()

  const [activeTool, setActiveTool] = useState('chatbot')
  const [activeTabSection, setActiveTabSection] = useState<'admin' | 'modul'>('admin')
  const [selectedDoc, setSelectedDoc] = useState('cp')

  // DETEKSI OTOMATIS TEMA DARK MODE DARI LOCAL STORAGE
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false)

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme')
    if (savedTheme === 'dark') {
      setIsDarkMode(true)
    }
  }, [])

  const [showKopAccordion, setShowKopAccordion] = useState(false)
  const [pakaiKop, setPakaiKop] = useState(true)

  const [isGenerating, setIsGenerating] = useState(false)
  const [generateProgress, setGenerateProgress] = useState('')
  const [generatedResults, setGeneratedResults] = useState<Record<string, string>>({})

  const [kopSekolah, setKopSekolah] = useState({
    kaligrafi: 'المعهد الإسلامي منى مصطفى',
    yayasan: 'YAYASAN PONDOK PESANTREN MUNA MUSTOFA LAMPUNG',
    namaSekolah: 'SMP MUNA MUSTOFA',
    lokasi: 'CAMPANG KECAMATAN GISTING KAB. TANGGAMUS',
    legalitas: 'NPSN: 71407877 SK IZIN OPERASIONAL : 503/029/IPO/VIII/36/2026',
    alamat: 'Jl. PPTQ Muna Mustofa Kecamatan Gisting Kabupaten Tanggamus 35376',
    email: 'munamustofa1922@gmail.com',
    website: 'https://smpmunamustofa.netlify.app/#sambutan'
  })

  const [formData, setFormData] = useState({
    mapel: 'IPA',
    faseKelas: '7',
    materiTopik: '',
    jenisPerangkat: 'Modul Ajar / RPP Plus',
    dlPilar: 'Mindful Learning',
    dlAlokasi: '2 JP (1 Pertemuan)',
    dlStrategi: 'Diskusi & Eksperimen',
    kokuTema: 'Kearifan Lokal',
    kokuDimensi: 'Beriman, Bertakwa & Berakhlak Mulia',
    lkpdAktivitas: 'Studi Kasus & Pemecahan Masalah',
    lkpdHots: true,
    soalJumlah: '10',
    soalTipe: 'Pilihan Ganda',
    soalLevel: 'HOTS (C4-C6)',
    soalKunci: true,
    multiSubTool: 'Ide Ice Breaking & Game Kelas'
  })

  const [adminForm, setAdminForm] = useState({
    kantorYayasan: 'YAYASAN PONDOK PESANTREN MUNA MUSTOFA LAMPUNG',
    satuanPendidikan: 'SMP MUNA MUSTOFA',
    mapel: 'IPA',
    kodeTp: 'IPA.7.1',
    faseKelas: 'Fase D / Kelas VII',
    tahunPelajaran: '2026/2027',
    alokasiTotal: '72 JP / Tahun',
    jpMinggu: '2 JP/Minggu',
    modelPembelajaran: 'Discovery Learning',
    namaGuru: '',
    nipGuru: '-',
    kotaTtd: 'Gisting',
    namaKepala: 'SULASTRI, S.Pd., Gr.',
    nipKepala: 'NUPTK. 6337763664131233',
    cpRasional: 'Kurikulum Berbasis Cinta (KBC) mengintegrasikan Panca Cinta Kemenag & 10 Nilai PPRA.',
    cpPerElemen: 'Menganalisis struktur dan fungsi organ tubuh makhluk hidup serta hubungannya dengan adaptasi lingkungan.'
  })

  const [modulForm, setModulForm] = useState({
    kodeTp: 'TP.IPA.01',
    elemenCp: 'Pemahaman IPA',
    rumusanTp: 'Peserta didik mampu menganalisis fungsi organ dalam hewan dan adaptasinya.',
    modelPembelajaran: 'Problem Based Learning (PBL)',
    jumlahPertemuan: '3',
    alokasiJp: '2',
    sintaksModel: '1. Orientasi Masalah, 2. Pengorganisasian, 3. Penyelidikan, 4. Pengembangan Karya, 5. Evaluasi',
    topikKearifanLokal: 'Pelestarian Lingkungan Gisting & Budaya Lokal Tanggamus',
    kantorKemenag: 'KANTOR KEMENTERIAN AGAMA KABUPATEN TANGGAMUS',
    namaMadrasah: 'SMP MUNA MUSTOFA',
    alamatMadrasah: 'Jl. PPTQ Muna Mustofa Kecamatan Gisting Kabupaten Tanggamus 35376',
    mapel: 'IPA',
    faseKelas: 'Fase D / Kelas VII',
    tahunPelajaran: '2026/2027',
    namaGuru: '',
    nipGuru: '-',
    kotaTtd: 'Gisting',
    namaKepala: 'SULASTRI, S.Pd., Gr.',
    nipKepala: 'NUPTK. 6337763664131233'
  })

  useEffect(() => {
    async function loadActiveUser() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const fullName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'Guru Pengampu'
        setAdminForm(prev => ({ ...prev, namaGuru: fullName }))
        setModulForm(prev => ({ ...prev, namaGuru: fullName }))
      }
    }
    loadActiveUser()
  }, [])

  const aiToolsConfig: Record<string, {
    title: string
    subtitle: string
    badge: string
    buttonText: string
    bgBanner: string
  }> = {
    'kbc': {
      title: 'Perangkat Ajar KBC AI',
      subtitle: 'Generator 9 Paket Perangkat Administrasi Pembelajaran KBC terintegrasi Panca Cinta Kemenag & 10 Nilai PPRA!',
      badge: '💚 KURIKULUM BERBASIS CINTA (KBC)',
      buttonText: 'Generate 9 Dokumen KBC',
      bgBanner: 'bg-gradient-to-r from-emerald-800 via-teal-800 to-emerald-950 border-emerald-700/50'
    },
    'perangkat': {
      title: 'Generator Perangkat Ajar AI Pro',
      subtitle: 'Otomatisasi pembuatan RPP, Prota, Prosem, Silabus, dan ATP Kurikulum Merdeka secara praktis.',
      badge: '📄 AI PRO GENERATOR PERANGKAT',
      buttonText: 'Generate Dokumen Perangkat',
      bgBanner: 'bg-gradient-to-r from-amber-700 via-orange-800 to-amber-950 border-amber-600/50'
    },
    'deep-learning': {
      title: 'Modul Ajar Deep Learning AI',
      subtitle: 'Susun skenario Modul Pembelajaran dengan 3 pilar: Mindful, Meaningful, & Joyful Learning.',
      badge: '🪄 DEEP LEARNING AI ENGINE',
      buttonText: 'Generate Modul Deep Learning',
      bgBanner: 'bg-gradient-to-r from-indigo-800 via-purple-800 to-indigo-950 border-indigo-600/50'
    },
    'kokurikuler': {
      title: 'Modul Kokurikuler AI (P5 / PPRA)',
      subtitle: 'Perancangan modul projek lintas mata pelajaran, tema P5/PPRA, dimensi profil, dan asesmen.',
      badge: '🧭 KOKURIKULER & PROJEK P5',
      buttonText: 'Generate Modul Projek',
      bgBanner: 'bg-gradient-to-r from-sky-800 via-blue-800 to-sky-950 border-sky-600/50'
    },
    'chatbot': {
      title: 'Asisten Chatbot Pedagogy AI',
      subtitle: 'Konsultan pedagogi pintar untuk konsultasi strategi mengajar, penanganan siswa, hingga narasi rapor.',
      badge: '🤖 ASISTEN GURU VIRTUAL 24/7',
      buttonText: 'Kirim Pesan Konsultasi',
      bgBanner: 'bg-gradient-to-r from-purple-800 via-fuchsia-800 to-purple-950 border-purple-600/50'
    },
    'lkpd': {
      title: 'Generator LKPD Interaktif AI',
      subtitle: 'Buat Lembar Kerja Siswa (LKPD) menarik berbasis studi kasus, kearifan lokal, dan HOTS.',
      badge: '✨ LEMBAR KERJA PESERTA DIDIK',
      buttonText: 'Generate LKPD Interaktif',
      bgBanner: 'bg-gradient-to-r from-amber-800 via-yellow-800 to-amber-950 border-amber-600/50'
    },
    'soal': {
      title: 'Generator Bank Soal & Ujian AI',
      subtitle: 'Buat naskah ujian dan kunci jawaban siap cetak tanpa kisi-kisi.',
      badge: '❓ BANK SOAL & EVALUASI',
      buttonText: 'Generate Paket Ujian',
      bgBanner: 'bg-gradient-to-r from-rose-800 via-red-800 to-rose-950 border-rose-600/50'
    },
    'multi': {
      title: 'Multi-Tool Generator AI Lainnya',
      subtitle: 'Kumpulan generator serbaguna: Ide ice breaking, rubrik penilaian, surat wali murid, dll.',
      badge: '🌐 MULTI-PURPOSE PEDAGOGY',
      buttonText: 'Generate Media / Rubrik',
      bgBanner: 'bg-gradient-to-r from-teal-800 via-emerald-800 to-teal-950 border-teal-600/50'
    }
  }

  const aiToolsNav = [
    { id: 'kbc', title: 'Perangkat KBC', icon: '💖' },
    { id: 'perangkat', title: 'Perangkat Umum', icon: '📄' },
    { id: 'deep-learning', title: 'Deep Learning', icon: '🪄' },
    { id: 'kokurikuler', title: 'P5 / PPRA', icon: '🧭' },
    { id: 'chatbot', title: 'Asisten Guru', icon: '🤖' },
    { id: 'lkpd', title: 'Generator LKPD', icon: '✨' },
    { id: 'soal', title: 'Bank Soal', icon: '❓' },
    { id: 'multi', title: 'Multi-Tool AI', icon: '🌐' },
  ]

  const kbcDocsList = [
    { id: 'cp', name: '1. Analisis CP', icon: '📖' },
    { id: 'tp', name: '2. Tujuan Pembelaj...', icon: '📋' },
    { id: 'atp', name: '3. Alur TP (ATP)', icon: '📚' },
    { id: 'prota', name: '4. Program Tahunan', icon: '📅' },
    { id: 'prosem', name: '5. Program Semester', icon: '📑' },
    { id: 'kktp', name: '6. KKTP KBC', icon: '🏅' },
    { id: 'modul', name: '7. Modul Ajar KBC', icon: '💖' },
    { id: 'lkpd', name: '8. LKPD KBC', icon: '📄' },
    { id: 'rubrik', name: '9. Rubrik Formatif ...', icon: '☑️' },
  ]

  const multiSubToolsList = [
    'Ide Ice Breaking & Game Kelas',
    'Rubrik Penilaian Sikap / Observasi',
    'Draf Surat Pemberitahuan Wali Murid',
    'Ide Media Pembelajaran Kreatif',
    'Draf Narasi Catatan Rapor Siswa'
  ]

  const currentResultKey = activeTool === 'kbc' ? `kbc_${selectedDoc}` : activeTool

  const formatAndCleanDocument = (text: string) => {
    if (!text) return ''
    return text
      .replace(/Paket Naskah Ujian:\s*Generator Bank Soal\s*&\s*Ujian AI/gi, '')
      .replace(/Generator Bank Soal\s*&\s*Ujian AI/gi, '')
      .replace(/#+\s*.*Kisi-Kisi[\s\S]*?(?=#+\s*|\n\n\d+\.|\n\nKunci|$)/gi, '')
      .replace(/Dokumen ini dibuat secara otomatis menggunakan Aplikasi Guru AI[\s\S]*/gi, '')
      .replace(/Created & Developed by Muzaini Al Kahfi[\s\S]*/gi, '')
      .replace(/([^\n])\s+([a-eA-E]\.\s+)/g, '$1\n\n$2')
      .replace(/\n([a-eA-E]\.\s+)/g, '\n\n$1')
  }

  const headerKopSekolahHTML = `
    <div style="text-align: center; margin-bottom: 20px; font-family: 'Times New Roman', serif; color: #000;">
      <div style="font-size: 18pt; font-weight: bold; font-family: 'Traditional Arabic', 'Amiri', serif; line-height: 1.2; margin-bottom: 4px;">
        ${kopSekolah.kaligrafi}
      </div>
      <h3 style="margin: 0; font-size: 11pt; text-transform: uppercase; font-weight: bold; letter-spacing: 0.5px;">
        ${kopSekolah.yayasan}
      </h3>
      <h1 style="margin: 2px 0; font-size: 16pt; text-transform: uppercase; font-weight: bold;">
        ${kopSekolah.namaSekolah}
      </h1>
      <h4 style="margin: 0; font-size: 10.5pt; text-transform: uppercase; font-weight: bold;">
        ${kopSekolah.lokasi}
      </h4>
      <p style="margin: 2px 0; font-size: 9.5pt; font-weight: bold;">
        ${kopSekolah.legalitas}
      </p>
      
      <div style="border-top: 1.5px solid #000; margin-top: 6px; padding-top: 4px; font-size: 9.5pt; font-style: italic;">
        <span><em>Address :</em> ${kopSekolah.alamat}</span><br/>
        <span><em>Email:</em> <a href="mailto:${kopSekolah.email}" style="color:#000; text-decoration:underline;">${kopSekolah.email}</a> &nbsp; <em>Website:</em> <a href="${kopSekolah.website}" style="color:#000; text-decoration:underline;">${kopSekolah.website}</a></span>
      </div>
      <div style="border-bottom: 1px solid #000; margin-top: 4px;"></div>
    </div>
  `

  const copyrightFooterHTML = `
    <div style="text-align: center; margin-top: 35px; padding-top: 12px; border-top: 1px solid #000; font-size: 9.5pt; color: #000; font-family: 'Times New Roman', serif; page-break-inside: avoid;">
      Dokumen ini dibuat secara otomatis menggunakan <strong>Aplikasi Guru AI</strong> - Created & Developed by <strong>Muzaini Al Kahfi</strong> &copy; 2026
    </div>
  `

  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

  const handleStartGenerate = async () => {
    setIsGenerating(true)
    try {
      const currentConfig = aiToolsConfig[activeTool]

      if (activeTool === 'kbc') {
        for (let i = 0; i < kbcDocsList.length; i++) {
          const doc = kbcDocsList[i]
          setGenerateProgress(`Memproses (${i + 1}/9) ${doc.name}...`)
          setSelectedDoc(doc.id)

          const payloadBody = {
            ...adminForm,
            ...modulForm,
            tool: currentConfig?.title || 'Asisten Guru AI',
            activeTool,
            selectedDoc: doc.id,
            mapel: adminForm.mapel || 'IPA',
            faseKelas: adminForm.faseKelas || 'Fase D / Kelas VII',
            materiTopik: adminForm.cpPerElemen || modulForm.rumusanTp,
            spesifikData: formData,
            tanpaKisiKisi: true
          }

          const response = await fetch('/api/gemini', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payloadBody)
          })

          if (response.ok) {
            const data = await response.json()
            if (data.result) {
              const cleanedText = formatAndCleanDocument(data.result)
              setGeneratedResults(prev => ({ ...prev, [`kbc_${doc.id}`]: cleanedText }))
            }
          }

          await delay(1500)
        }
        setGenerateProgress('Selesai!')
        setSelectedDoc('cp')

      } else {
        setGenerateProgress('Menghubungkan ke Mercury AI Engine...')
        const payloadBody = {
          tool: currentConfig?.title || 'Asisten Guru AI',
          activeTool,
          selectedDoc: null,
          mapel: formData.mapel,
          faseKelas: formData.faseKelas,
          materiTopik: formData.materiTopik,
          tanpaKisiKisi: true,
          spesifikData: formData
        }

        const response = await fetch('/api/gemini', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payloadBody)
        })

        if (!response.ok) throw new Error(`HTTP Error ${response.status}`)
        const data = await response.json()

        if (data.result) {
          const cleanedText = formatAndCleanDocument(data.result)
          setGeneratedResults(prev => ({ ...prev, [activeTool]: cleanedText }))
        } else {
          alert('Gagal: Respon dari Mercury AI kosong.')
        }
      }
    } catch (err: any) {
      alert(`Gagal memproses permintaan: ${err.message}`)
    } finally {
      setIsGenerating(false)
      setGenerateProgress('')
    }
  }

  const handlePrintPDF = () => {
    const resultElement = document.getElementById('ai-document-result')
    if (!resultElement) return

    const printContents = resultElement.innerHTML

    const printWindow = window.open('', '_blank')
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Dokumen Pembelajaran - SMP MUNA MUSTOFA</title>
            <style>
              @page { margin: 2cm; size: A4; }
              body { 
                font-family: 'Times New Roman', Times, serif; 
                padding: 0; 
                line-height: 1.5; 
                color: #000; 
                font-size: 12pt;
              }
              h1, h2, h3, h4 { color: #000; margin-top: 16px; margin-bottom: 8px; page-break-after: avoid; }
              p { margin-bottom: 8px; text-align: justify; }
              table { border-collapse: collapse; width: 100%; margin: 15px 0; font-size: 11pt; page-break-inside: auto; }
              tr { page-break-inside: avoid; page-break-after: auto; }
              th, td { border: 1px solid #000; padding: 6px 8px; text-align: left; vertical-align: top; }
              th { background-color: #f2f2f2; font-weight: bold; text-align: center; }
              ul, ol { margin-bottom: 12px; padding-left: 24px; }
              li { margin-bottom: 6px; line-height: 1.5; page-break-inside: avoid; }
              strong, b { font-weight: bold; }
            </style>
          </head>
          <body>
            ${pakaiKop ? headerKopSekolahHTML : ''}
            ${printContents}
            ${copyrightFooterHTML}
          </body>
        </html>
      `)
      printWindow.document.close()
      setTimeout(() => { printWindow.print() }, 500)
    }
  }

  const handleDownloadWord = () => {
    const resultElement = document.getElementById('ai-document-result')
    if (!resultElement) return

    const printContents = resultElement.innerHTML

    const header = "<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>Export Word</title><style>body { font-family: 'Times New Roman', serif; font-size: 12pt; line-height: 1.5; } p { margin-bottom: 8pt; } table { border-collapse: collapse; width: 100%; } td, th { border: 1px solid #000; padding: 5pt; }</style></head><body>"
    const footer = copyrightFooterHTML + "</body></html>"
    const sourceHTML = header + (pakaiKop ? headerKopSekolahHTML : '') + printContents + footer

    const source = 'data:application/vnd.ms-word;charset=utf-8,' + encodeURIComponent(sourceHTML)
    const fileDownload = document.createElement("a")
    document.body.appendChild(fileDownload)
    fileDownload.href = source
    fileDownload.download = `Dokumen_Pembelajaran_${activeTool}.doc`
    fileDownload.click()
    document.body.removeChild(fileDownload)
  }

  const currentToolData = aiToolsConfig[activeTool] || aiToolsConfig['chatbot']

  return (
    <motion.div
      initial={{ opacity: 0, x: -60 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className={`min-h-screen font-sans flex flex-col justify-between selection:bg-indigo-500 selection:text-white pb-32 relative overflow-x-hidden transition-colors duration-300 ${
        isDarkMode ? 'bg-slate-950 text-slate-100' : 'bg-[#E2E8F0] text-slate-800'
      }`}
    >
      
      {/* 1. FIXED BACKGROUND WATERMARK LOGO SCHOOL */}
      <div className={`fixed inset-0 pointer-events-none z-0 flex items-center justify-center select-none transition-opacity duration-300 ${
        isDarkMode ? 'opacity-[0.05]' : 'opacity-[0.15]'
      }`}>
        <img
          src="/logo-smp.jpg"
          alt="Watermark SMP Muna Mustofa"
          className="w-[850px] h-[850px] object-contain max-w-none"
        />
      </div>

      <div className="relative z-10">
        {/* 2. HEADER TOPBAR GLASSMORPHISM */}
        <header className={`border-b px-6 py-3 flex items-center justify-between sticky top-0 z-40 shadow-xs transition-colors duration-300 ${
          isDarkMode ? 'bg-slate-900/90 border-slate-800 backdrop-blur-md' : 'bg-slate-100/90 border-slate-300 backdrop-blur-md'
        }`}>
          <div className="flex items-center gap-3">
            <Link href="/" className={`p-1.5 rounded-lg transition ${isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'}`} title="Kembali ke Dashboard">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </Link>
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl overflow-hidden flex items-center justify-center border p-0.5 shadow-xs shrink-0 ${
                isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-300'
              }`}>
                <img
                  src="/logo-smp.jpg"
                  alt="Logo SMP Muna Mustofa"
                  className="w-full h-full object-contain"
                />
              </div>
              <div>
                <h1 className={`font-bold text-base leading-none ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Aplikasi Guru AI</h1>
                <p className={`text-[11px] font-bold mt-1 ${isDarkMode ? 'text-emerald-400' : 'text-emerald-800'}`}>AI Tools &amp; Generator Perangkat</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className={`border text-xs font-semibold px-3 py-1.5 rounded-full flex items-center gap-2 hidden sm:flex ${
              isDarkMode 
                ? 'bg-emerald-950/60 border-emerald-800 text-emerald-300' 
                : 'bg-emerald-100/80 border-emerald-300 text-emerald-800'
            }`}>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>Mercury AI Ready</span>
            </div>
          </div>
        </header>

        {/* 3. TOOL NAVIGATOR */}
        <div className={`border-b px-6 py-3 overflow-x-auto custom-scrollbar transition-colors duration-300 ${
          isDarkMode ? 'bg-slate-900/80 border-slate-800 backdrop-blur-md' : 'bg-slate-100/80 border-slate-300 backdrop-blur-md'
        }`}>
          <div className="flex items-center gap-2 min-w-max">
            {aiToolsNav.map((tool) => (
              <button
                key={tool.id}
                onClick={() => setActiveTool(tool.id)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 border cursor-pointer ${
                  activeTool === tool.id
                    ? 'bg-indigo-600 text-white border-indigo-700 shadow-xs'
                    : isDarkMode 
                      ? 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700 hover:text-white' 
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-indigo-50 hover:text-indigo-900'
                }`}
              >
                <span>{tool.icon}</span>
                <span>{tool.title}</span>
              </button>
            ))}
          </div>
        </div>

        {/* 4. MAIN CONTAINER */}
        <main className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6">

          {/* DYNAMIC HERO BANNER */}
          <div className={`${currentToolData.bgBanner} rounded-3xl p-6 sm:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-xl relative overflow-hidden text-white border transition-all duration-300`}>
            <div className="space-y-3 max-w-2xl">
              <div className="inline-flex items-center gap-2 bg-amber-400 text-slate-950 text-[11px] font-black uppercase px-3 py-1 rounded-full shadow-md">
                <span>{currentToolData.badge}</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight leading-tight">{currentToolData.title}</h2>
              <p className="text-xs sm:text-sm text-slate-100 font-medium leading-relaxed">{currentToolData.subtitle}</p>
            </div>
            <button
              onClick={handleStartGenerate}
              disabled={isGenerating}
              className="bg-white hover:bg-slate-100 text-indigo-950 font-extrabold px-6 py-3.5 rounded-2xl text-xs transition shadow-lg flex items-center gap-2 whitespace-nowrap disabled:opacity-50 cursor-pointer shrink-0"
            >
              <span>✨</span>
              <span>{isGenerating ? 'AI Memproses...' : currentToolData.buttonText}</span>
            </button>
          </div>

          {/* FORM SETUP KOP SEKOLAH MODE ACCORDION */}
          {activeTool !== 'chatbot' && (
            <div className={`backdrop-blur-md border rounded-2xl p-4 transition-all shadow-xs ${
              isDarkMode 
                ? 'bg-slate-900/90 border-slate-800' 
                : 'bg-gradient-to-br from-[#c7d2fe]/90 via-[#dbe2fe]/90 to-[#edf2ff]/90 border-indigo-200/80'
            }`}>
              <button
                onClick={() => setShowKopAccordion(!showKopAccordion)}
                className={`w-full flex items-center justify-between text-xs font-bold transition cursor-pointer ${
                  isDarkMode ? 'text-indigo-300 hover:text-indigo-200' : 'text-indigo-950 hover:text-indigo-800'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span>🏫</span>
                  <span>Pengaturan Data Kop Surat Sekolah (SMP MUNA MUSTOFA)</span>
                </div>
                <span>{showKopAccordion ? '🔼 Sembunyikan' : '🔽 Ubah Data Kop Surat'}</span>
              </button>

              {showKopAccordion && (
                <div className={`mt-4 pt-4 border-t grid grid-cols-1 md:grid-cols-2 gap-4 text-xs ${
                  isDarkMode ? 'border-slate-800' : 'border-indigo-200/80'
                }`}>
                  <div>
                    <label className={`block font-bold mb-1 ${isDarkMode ? 'text-indigo-300' : 'text-indigo-900/80'}`}>Nama Yayasan / Instansi</label>
                    <input
                      type="text"
                      value={kopSekolah.yayasan}
                      onChange={(e) => setKopSekolah({ ...kopSekolah, yayasan: e.target.value })}
                      className={`w-full border rounded-xl px-3.5 py-2 font-medium ${
                        isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                      }`}
                    />
                  </div>
                  <div>
                    <label className={`block font-bold mb-1 ${isDarkMode ? 'text-indigo-300' : 'text-indigo-900/80'}`}>Nama Satuan Pendidikan / Sekolah</label>
                    <input
                      type="text"
                      value={kopSekolah.namaSekolah}
                      onChange={(e) => setKopSekolah({ ...kopSekolah, namaSekolah: e.target.value })}
                      className={`w-full border rounded-xl px-3.5 py-2 font-bold ${
                        isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                      }`}
                    />
                  </div>
                  <div>
                    <label className={`block font-bold mb-1 ${isDarkMode ? 'text-indigo-300' : 'text-indigo-900/80'}`}>NPSN &amp; Legalitas SK</label>
                    <input
                      type="text"
                      value={kopSekolah.legalitas}
                      onChange={(e) => setKopSekolah({ ...kopSekolah, legalitas: e.target.value })}
                      className={`w-full border rounded-xl px-3.5 py-2 font-medium ${
                        isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                      }`}
                    />
                  </div>
                  <div>
                    <label className={`block font-bold mb-1 ${isDarkMode ? 'text-indigo-300' : 'text-indigo-900/80'}`}>Alamat Sekolah</label>
                    <input
                      type="text"
                      value={kopSekolah.alamat}
                      onChange={(e) => setKopSekolah({ ...kopSekolah, alamat: e.target.value })}
                      className={`w-full border rounded-xl px-3.5 py-2 font-medium ${
                        isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                      }`}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* DYNAMIC FORM PARAMETER AI */}
          <div className={`backdrop-blur-md border rounded-2xl p-6 space-y-4 shadow-xs ${
            isDarkMode 
              ? 'bg-slate-900/90 border-slate-800' 
              : 'bg-gradient-to-br from-[#c7d2fe]/90 via-[#dbe2fe]/90 to-[#edf2ff]/90 border-indigo-200/80'
          }`}>
            <h3 className={`font-extrabold text-base border-b pb-3 ${
              isDarkMode ? 'text-white border-slate-800' : 'text-slate-900 border-indigo-200/80'
            }`}>Parameter Input AI</h3>

            {/* KOMPONEN INPUT UMUM */}
            {activeTool !== 'kbc' && activeTool !== 'chatbot' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs mb-4">
                <div>
                  <label className={`block font-bold mb-1.5 ${isDarkMode ? 'text-indigo-300' : 'text-indigo-900/80'}`}>Mata Pelajaran / Bidang Studi</label>
                  <input type="text" value={formData.mapel} onChange={(e) => setFormData({ ...formData, mapel: e.target.value })} className={`w-full border rounded-xl px-3.5 py-2.5 font-medium focus:outline-none focus:border-indigo-600 ${
                    isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                  }`} />
                </div>
                <div>
                  <label className={`block font-bold mb-1.5 ${isDarkMode ? 'text-indigo-300' : 'text-indigo-900/80'}`}>Fase / Kelas</label>
                  <input type="text" value={formData.faseKelas} onChange={(e) => setFormData({ ...formData, faseKelas: e.target.value })} className={`w-full border rounded-xl px-3.5 py-2.5 font-medium focus:outline-none focus:border-indigo-600 ${
                    isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                  }`} />
                </div>
              </div>
            )}

            {/* 1. KBC FORM */}
            {activeTool === 'kbc' && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <button onClick={() => setActiveTabSection('admin')} className={`p-3 rounded-xl border text-xs font-bold transition cursor-pointer ${
                    activeTabSection === 'admin' 
                      ? 'bg-indigo-600 border-indigo-700 text-white shadow-xs' 
                      : isDarkMode 
                        ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700' 
                        : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                  }`}>1. Input Identitas &amp; Administrasi</button>
                  <button onClick={() => setActiveTabSection('modul')} className={`p-3 rounded-xl border text-xs font-bold transition cursor-pointer ${
                    activeTabSection === 'modul' 
                      ? 'bg-indigo-600 border-indigo-700 text-white shadow-xs' 
                      : isDarkMode 
                        ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700' 
                        : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                  }`}>2. Input Modul &amp; Skenario</button>
                </div>
                {activeTabSection === 'admin' ? (
                  <div className="space-y-4 text-xs">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className={`block font-bold mb-1 ${isDarkMode ? 'text-indigo-300' : 'text-indigo-900/80'}`}>Satuan Pendidikan</label>
                        <input type="text" value={adminForm.satuanPendidikan} onChange={(e)=>setAdminForm({...adminForm, satuanPendidikan:e.target.value})} className={`w-full border rounded-xl p-2.5 font-medium ${
                          isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                        }`} />
                      </div>
                      <div>
                        <label className={`block font-bold mb-1 ${isDarkMode ? 'text-indigo-300' : 'text-indigo-900/80'}`}>Mata Pelajaran</label>
                        <input type="text" value={adminForm.mapel} onChange={(e)=>setAdminForm({...adminForm, mapel:e.target.value})} className={`w-full border rounded-xl p-2.5 font-medium ${
                          isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                        }`} />
                      </div>
                      <div>
                        <label className={`block font-bold mb-1 ${isDarkMode ? 'text-indigo-300' : 'text-indigo-900/80'}`}>Fase / Kelas</label>
                        <input type="text" value={adminForm.faseKelas} onChange={(e)=>setAdminForm({...adminForm, faseKelas:e.target.value})} className={`w-full border rounded-xl p-2.5 font-medium ${
                          isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                        }`} />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className={`block font-bold mb-1 ${isDarkMode ? 'text-indigo-300' : 'text-indigo-900/80'}`}>Nama Guru Pengampu</label>
                        <input type="text" value={adminForm.namaGuru} onChange={(e)=>setAdminForm({...adminForm, namaGuru:e.target.value})} className={`w-full border rounded-xl p-2.5 font-bold ${
                          isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                        }`} />
                      </div>
                      <div>
                        <label className={`block font-bold mb-1 ${isDarkMode ? 'text-indigo-300' : 'text-indigo-900/80'}`}>Nama Kepala Sekolah</label>
                        <input type="text" value={adminForm.namaKepala} onChange={(e)=>setAdminForm({...adminForm, namaKepala:e.target.value})} className={`w-full border rounded-xl p-2.5 font-bold ${
                          isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                        }`} />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className={`block font-bold mb-1 ${isDarkMode ? 'text-indigo-300' : 'text-indigo-900/80'}`}>NIP / NUPTK Guru</label>
                        <input type="text" value={adminForm.nipGuru} onChange={(e)=>setAdminForm({...adminForm, nipGuru:e.target.value})} className={`w-full border rounded-xl p-2.5 font-mono font-medium ${
                          isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-white border-slate-300 text-slate-800'
                        }`} />
                      </div>
                      <div>
                        <label className={`block font-bold mb-1 ${isDarkMode ? 'text-indigo-300' : 'text-indigo-900/80'}`}>NIP / NUPTK Kepala Sekolah</label>
                        <input type="text" value={adminForm.nipKepala} onChange={(e)=>setAdminForm({...adminForm, nipKepala:e.target.value})} className={`w-full border rounded-xl p-2.5 font-mono font-medium ${
                          isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-white border-slate-300 text-slate-800'
                        }`} />
                      </div>
                    </div>
                    <textarea rows={2} placeholder="Capaian Pembelajaran (CP)" value={adminForm.cpPerElemen} onChange={(e)=>setAdminForm({...adminForm, cpPerElemen:e.target.value})} className={`w-full border rounded-xl p-3 text-xs font-medium ${
                      isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                    }`} />
                  </div>
                ) : (
                  <div className="space-y-4 text-xs">
                     <div className="grid grid-cols-2 gap-4">
                        <input type="text" placeholder="Kode TP" value={modulForm.kodeTp} onChange={(e)=>setModulForm({...modulForm, kodeTp:e.target.value})} className={`border rounded-xl p-2.5 font-bold ${
                          isDarkMode ? 'bg-slate-800 border-slate-700 text-indigo-300' : 'bg-white border-slate-300 text-indigo-900'
                        }`} />
                        <select value={modulForm.modelPembelajaran} onChange={(e)=>setModulForm({...modulForm, modelPembelajaran:e.target.value})} className={`border rounded-xl p-2.5 font-bold cursor-pointer ${
                          isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                        }`}>
                          <option>Problem Based Learning (PBL)</option><option>Discovery Learning</option><option>Project Based Learning</option>
                        </select>
                     </div>
                     <textarea rows={2} placeholder="Rumusan Tujuan Pembelajaran" value={modulForm.rumusanTp} onChange={(e)=>setModulForm({...modulForm, rumusanTp:e.target.value})} className={`w-full border rounded-xl p-3 text-xs font-medium ${
                       isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                     }`} />
                  </div>
                )}
                <div className={`pt-4 border-t ${isDarkMode ? 'border-slate-800' : 'border-indigo-200/80'}`}>
                  <span className={`text-xs font-extrabold mb-2 block ${isDarkMode ? 'text-indigo-300' : 'text-indigo-950'}`}>Pilih Dokumen Target (Klik untuk melihat hasil):</span>
                  <div className="grid grid-cols-3 md:grid-cols-5 lg:grid-cols-9 gap-2">
                    {kbcDocsList.map(doc => (
                      <button key={doc.id} onClick={() => setSelectedDoc(doc.id)} className={`p-2 rounded-lg border text-[10px] flex flex-col items-center gap-1 cursor-pointer ${
                        selectedDoc === doc.id 
                          ? 'bg-indigo-600 text-white font-bold border-indigo-700 shadow-xs' 
                          : isDarkMode 
                            ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700' 
                            : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                      }`}>
                        <span className="text-sm">{doc.icon}</span> <span>{doc.name.split(' ')[0]}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* 2. PERANGKAT AJAR PRO FORM */}
            {activeTool === 'perangkat' && (
              <div className="space-y-4 text-xs">
                <div>
                  <label className={`block font-bold mb-2 ${isDarkMode ? 'text-indigo-300' : 'text-indigo-900/80'}`}>Jenis Dokumen Perangkat</label>
                  <select value={formData.jenisPerangkat} onChange={(e) => setFormData({...formData, jenisPerangkat: e.target.value})} className={`w-full border rounded-xl p-2.5 font-bold cursor-pointer ${
                    isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                  }`}>
                    <option>Modul Ajar / RPP Plus</option><option>Alur Tujuan Pembelajaran (ATP)</option><option>Program Tahunan (Prota)</option><option>Program Semester (Prosem)</option><option>Silabus Singkat</option>
                  </select>
                </div>
                <div>
                  <label className={`block font-bold mb-2 ${isDarkMode ? 'text-indigo-300' : 'text-indigo-900/80'}`}>Materi Pokok / Deskripsi Singkat</label>
                  <textarea rows={2} value={formData.materiTopik} onChange={(e) => setFormData({...formData, materiTopik: e.target.value})} placeholder="Contoh: Sistem Reproduksi Manusia..." className={`w-full border rounded-xl p-3 font-medium ${
                    isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                  }`} />
                </div>
              </div>
            )}

            {/* 3. DEEP LEARNING FORM */}
            {activeTool === 'deep-learning' && (
              <div className="space-y-4 text-xs">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className={`block font-bold mb-2 ${isDarkMode ? 'text-indigo-300' : 'text-indigo-900/80'}`}>Pilar Utama Skenario</label>
                    <select value={formData.dlPilar} onChange={(e) => setFormData({...formData, dlPilar: e.target.value})} className={`w-full border rounded-xl p-2.5 font-bold cursor-pointer ${
                      isDarkMode ? 'bg-slate-800 border-slate-700 text-indigo-300' : 'bg-white border-slate-300 text-indigo-900'
                    }`}>
                      <option>Mindful Learning (Kesadaran &amp; Fokus)</option>
                      <option>Meaningful Learning (Makna &amp; Kontekstual)</option>
                      <option>Joyful Learning (Eksplorasi Menyenangkan)</option>
                    </select>
                  </div>
                  <div>
                    <label className={`block font-bold mb-2 ${isDarkMode ? 'text-indigo-300' : 'text-indigo-900/80'}`}>Strategi Kegiatan</label>
                    <input type="text" value={formData.dlStrategi} onChange={(e) => setFormData({...formData, dlStrategi: e.target.value})} placeholder="Diskusi / Roleplay / Eksperimen" className={`w-full border rounded-xl p-2.5 font-medium ${
                      isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                    }`} />
                  </div>
                  <div>
                    <label className={`block font-bold mb-2 ${isDarkMode ? 'text-indigo-300' : 'text-indigo-900/80'}`}>Alokasi Waktu</label>
                    <input type="text" value={formData.dlAlokasi} onChange={(e) => setFormData({...formData, dlAlokasi: e.target.value})} placeholder="Contoh: 2 JP (90 Menit)" className={`w-full border rounded-xl p-2.5 font-medium ${
                      isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                    }`} />
                  </div>
                </div>
                <div>
                  <label className={`block font-bold mb-2 ${isDarkMode ? 'text-indigo-300' : 'text-indigo-900/80'}`}>Topik Bahasan Skenario</label>
                  <textarea rows={2} value={formData.materiTopik} onChange={(e) => setFormData({...formData, materiTopik: e.target.value})} className={`w-full border rounded-xl p-3 font-medium ${
                    isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                  }`} />
                </div>
              </div>
            )}

            {/* 4. MODUL KOKURIKULER P5 / PPRA */}
            {activeTool === 'kokurikuler' && (
              <div className="space-y-4 text-xs">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className={`block font-bold mb-2 ${isDarkMode ? 'text-indigo-300' : 'text-indigo-900/80'}`}>Tema Utama P5 / PPRA</label>
                    <select value={formData.kokuTema} onChange={(e) => setFormData({...formData, kokuTema: e.target.value})} className={`w-full border rounded-xl p-2.5 font-bold cursor-pointer ${
                      isDarkMode ? 'bg-slate-800 border-slate-700 text-indigo-300' : 'bg-white border-slate-300 text-indigo-900'
                    }`}>
                      <option>Kearifan Lokal</option><option>Gaya Hidup Berkelanjutan</option><option>Bhinneka Tunggal Ika</option><option>Kewirausahaan</option><option>Bangunlah Jiwa dan Raganya</option>
                    </select>
                  </div>
                  <div>
                    <label className={`block font-bold mb-2 ${isDarkMode ? 'text-indigo-300' : 'text-indigo-900/80'}`}>Target Dimensi Profil Pelajar</label>
                    <input type="text" value={formData.kokuDimensi} onChange={(e) => setFormData({...formData, kokuDimensi: e.target.value})} placeholder="Contoh: Bernalar Kritis &amp; Kreatif" className={`w-full border rounded-xl p-2.5 font-medium ${
                      isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                    }`} />
                  </div>
                </div>
                <div>
                  <label className={`block font-bold mb-2 ${isDarkMode ? 'text-indigo-300' : 'text-indigo-900/80'}`}>Judul Spesifik Projek (Opsional)</label>
                  <input type="text" value={formData.materiTopik} onChange={(e) => setFormData({...formData, materiTopik: e.target.value})} placeholder="Contoh: Membuat ecobrick dari sampah plastik..." className={`w-full border rounded-xl p-3 font-medium ${
                    isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                  }`} />
                </div>
              </div>
            )}

            {/* 5. ASISTEN GURU CHATBOT */}
            {activeTool === 'chatbot' && (
              <div className="space-y-4 text-xs">
                <div className={`border p-4 rounded-xl flex items-start gap-3 ${
                  isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-indigo-50 border-indigo-200'
                }`}>
                  <span className="text-xl">💬</span>
                  <p className={`font-medium mt-0.5 leading-relaxed ${isDarkMode ? 'text-indigo-300' : 'text-indigo-900'}`}>Gunakan asisten ini untuk mendiskusikan strategi menangani siswa yang sulit fokus, meminta saran ide pembuka kelas, atau sekadar memperbaiki tata bahasa untuk narasi rapor siswa.</p>
                </div>
                <div>
                  <label className={`block font-extrabold mb-2 text-sm ${isDarkMode ? 'text-white' : 'text-indigo-950'}`}>Apa yang ingin Anda tanyakan atau diskusikan?</label>
                  <textarea rows={4} value={formData.materiTopik} onChange={(e) => setFormData({...formData, materiTopik: e.target.value})} placeholder="Ketik pertanyaan atau studi kasus guru di sini..." className={`w-full border rounded-xl p-4 focus:outline-none focus:border-indigo-600 text-sm leading-relaxed font-medium shadow-xs ${
                    isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                  }`} />
                </div>
              </div>
            )}

            {/* 6. GENERATOR LKPD */}
            {activeTool === 'lkpd' && (
              <div className="space-y-4 text-xs">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className={`block font-bold mb-2 ${isDarkMode ? 'text-indigo-300' : 'text-indigo-900/80'}`}>Jenis Aktivitas LKPD</label>
                    <select value={formData.lkpdAktivitas} onChange={(e) => setFormData({...formData, lkpdAktivitas: e.target.value})} className={`w-full border rounded-xl p-2.5 font-bold cursor-pointer ${
                      isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                    }`}>
                      <option>Studi Kasus &amp; Pemecahan Masalah</option><option>Eksperimen / Pengamatan Langsung</option><option>Diskusi Kelompok &amp; Presentasi</option><option>Projek Mini Individu</option>
                    </select>
                  </div>
                  <div className="flex items-end pb-2">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input type="checkbox" checked={formData.lkpdHots} onChange={(e) => setFormData({...formData, lkpdHots: e.target.checked})} className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-600 cursor-pointer" />
                      <span className={`font-extrabold ${isDarkMode ? 'text-white' : 'text-indigo-950'}`}>Terapkan Pendekatan HOTS &amp; Konteks Lokal</span>
                    </label>
                  </div>
                </div>
                <div>
                  <label className={`block font-bold mb-2 ${isDarkMode ? 'text-indigo-300' : 'text-indigo-900/80'}`}>Materi Pokok LKPD</label>
                  <input type="text" value={formData.materiTopik} onChange={(e) => setFormData({...formData, materiTopik: e.target.value})} className={`w-full border rounded-xl p-3 font-medium ${
                    isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                  }`} />
                </div>
              </div>
            )}

            {/* 7. BANK SOAL & UJIAN */}
            {activeTool === 'soal' && (
              <div className="space-y-4 text-xs">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div>
                    <label className={`block font-bold mb-2 ${isDarkMode ? 'text-indigo-300' : 'text-indigo-900/80'}`}>Jumlah Soal</label>
                    <input type="number" value={formData.soalJumlah} onChange={(e) => setFormData({...formData, soalJumlah: e.target.value})} className={`w-full border rounded-xl p-2.5 font-extrabold text-center ${
                      isDarkMode ? 'bg-slate-800 border-slate-700 text-indigo-300' : 'bg-white border-slate-300 text-indigo-900'
                    }`} />
                  </div>
                  <div>
                    <label className={`block font-bold mb-2 ${isDarkMode ? 'text-indigo-300' : 'text-indigo-900/80'}`}>Bentuk Soal</label>
                    <select value={formData.soalTipe} onChange={(e) => setFormData({...formData, soalTipe: e.target.value})} className={`w-full border rounded-xl p-2.5 font-bold cursor-pointer ${
                      isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                    }`}>
                      <option>Pilihan Ganda</option><option>Uraian / Essay</option><option>Campuran (PG &amp; Uraian)</option>
                    </select>
                  </div>
                  <div>
                    <label className={`block font-bold mb-2 ${isDarkMode ? 'text-indigo-300' : 'text-indigo-900/80'}`}>Tingkat Kesulitan</label>
                    <select value={formData.soalLevel} onChange={(e) => setFormData({...formData, soalLevel: e.target.value})} className={`w-full border rounded-xl p-2.5 font-bold cursor-pointer ${
                      isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                    }`}>
                      <option>HOTS (C4-C6) - Analisis &amp; Evaluasi</option><option>MOTS (C2-C3) - Pemahaman Dasar</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className={`block font-bold mb-2 ${isDarkMode ? 'text-indigo-300' : 'text-indigo-900/80'}`}>Topik Ujian / Indikator Materi</label>
                  <textarea rows={2} value={formData.materiTopik} onChange={(e) => setFormData({...formData, materiTopik: e.target.value})} placeholder="Contoh: Menghitung gaya gravitasi Newton..." className={`w-full border rounded-xl p-3 font-medium ${
                    isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                  }`} />
                </div>
              </div>
            )}

            {/* 8. MULTI TOOL */}
            {activeTool === 'multi' && (
              <div className="space-y-4 text-xs">
                <label className={`block font-extrabold mb-2 ${isDarkMode ? 'text-white' : 'text-indigo-950'}`}>Pilih Kebutuhan Darurat (Sub-Tool Cepat):</label>
                <div className="flex flex-wrap gap-2 mb-4">
                  {multiSubToolsList.map(sub => (
                    <button key={sub} onClick={() => setFormData({...formData, multiSubTool: sub})} className={`px-4 py-2 rounded-full border transition font-bold cursor-pointer ${
                      formData.multiSubTool === sub 
                        ? 'bg-indigo-600 text-white border-indigo-700 shadow-xs' 
                        : isDarkMode 
                          ? 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700' 
                          : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                    }`}>
                      {sub}
                    </button>
                  ))}
                </div>
                <div>
                  <label className={`block font-bold mb-2 ${isDarkMode ? 'text-indigo-300' : 'text-indigo-900/80'}`}>Catatan/Konteks Spesifik</label>
                  <input type="text" value={formData.materiTopik} onChange={(e) => setFormData({...formData, materiTopik: e.target.value})} placeholder="Ketik rincian tambahan di sini (Opsional)..." className={`w-full border rounded-xl p-3 font-medium ${
                    isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                  }`} />
                </div>
              </div>
            )}
          </div>

          {/* AREA OUTPUT HASIL GENERASI AI */}
          <div className={`backdrop-blur-md border rounded-2xl p-6 space-y-6 min-h-[400px] shadow-xs ${
            isDarkMode 
              ? 'bg-slate-900/90 border-slate-800' 
              : 'bg-gradient-to-br from-[#c7d2fe]/90 via-[#dbe2fe]/90 to-[#edf2ff]/90 border-indigo-200/80'
          }`}>
            <div className={`flex flex-col sm:flex-row items-start sm:items-center justify-between border-b pb-4 gap-4 ${
              isDarkMode ? 'border-slate-800' : 'border-indigo-200/80'
            }`}>
              <div className="flex items-center gap-2">
                <span className="text-indigo-500 text-lg">✨</span>
                <h4 className={`font-extrabold text-base uppercase ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Hasil Output - {currentToolData.title}</h4>
              </div>

              {/* SAKELAR CENTANG KOP SEKOLAH & TOMBOL CETAK */}
              <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
                {activeTool !== 'chatbot' && (
                  <label className={`flex items-center gap-2 text-xs font-bold cursor-pointer px-3 py-2 rounded-xl border shadow-xs ${
                    isDarkMode ? 'bg-slate-800 border-slate-700 text-indigo-300' : 'bg-white border-slate-300 text-indigo-950'
                  }`}>
                    <input
                      type="checkbox"
                      checked={pakaiKop}
                      onChange={(e) => setPakaiKop(e.target.checked)}
                      className="w-4 h-4 rounded text-indigo-600 border-slate-300 focus:ring-indigo-600 cursor-pointer"
                    />
                    <span>Gunakan Kop Surat Sekolah</span>
                  </label>
                )}

                <button onClick={handlePrintPDF} disabled={!generatedResults[currentResultKey]} className="flex-1 sm:flex-none bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-xs font-extrabold disabled:opacity-40 transition shadow-xs flex items-center justify-center gap-2 cursor-pointer">
                  🖨️ Cetak PDF
                </button>
                <button onClick={handleDownloadWord} disabled={!generatedResults[currentResultKey]} className="flex-1 sm:flex-none bg-emerald-700 hover:bg-emerald-800 text-white px-4 py-2 rounded-xl text-xs font-extrabold disabled:opacity-40 transition shadow-xs flex items-center justify-center gap-2 cursor-pointer">
                  📥 Unduh Word
                </button>
              </div>
            </div>

            {isGenerating ? (
              <div className="py-20 flex flex-col items-center justify-center text-center space-y-4">
                <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                <p className={`text-sm font-extrabold animate-pulse ${isDarkMode ? 'text-indigo-300' : 'text-indigo-900'}`}>
                  {generateProgress || 'Menghubungkan ke Mercury AI Engine...'}
                </p>
              </div>
            ) : generatedResults[currentResultKey] ? (
              <div id="ai-document-result" className={`border rounded-xl p-6 text-sm leading-relaxed font-sans prose max-w-none shadow-xs ${
                isDarkMode 
                  ? 'bg-slate-900 border-slate-800 text-slate-100 prose-headings:text-indigo-300 prose-a:text-indigo-400 prose-strong:text-white' 
                  : 'bg-white border-slate-300 text-slate-900 prose-headings:text-indigo-900 prose-a:text-indigo-700'
              }`}>
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {generatedResults[currentResultKey]}
                </ReactMarkdown>
              </div>
            ) : (
              <div className="py-20 flex flex-col items-center justify-center text-center space-y-4">
                <div className={`w-16 h-16 rounded-full border flex items-center justify-center text-3xl shadow-xs ${
                  isDarkMode ? 'bg-slate-800 border-slate-700 text-indigo-400' : 'bg-white border-indigo-200 text-indigo-700'
                }`}>
                  🤖
                </div>
                <div className="space-y-1">
                  <h5 className={`font-extrabold text-lg tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Belum Ada Hasil Generasi</h5>
                  <p className={`text-xs font-medium max-w-md mx-auto ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                    Sesuaikan parameter di atas lalu klik tombol <b>{currentToolData.buttonText}</b> untuk memulai pembuatan dokumen otomatis.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* BADGE COPYRIGHT FOOTER */}
          <div className="pt-8 pb-4 flex justify-center">
            <div className={`border px-6 py-2.5 rounded-full text-center text-xs font-medium shadow-xs transition-colors duration-300 ${
              isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-400' : 'bg-slate-100 border-slate-300 text-slate-700'
            }`}>
              <span>Aplikasi Guru AI</span>
              <span className="mx-2">•</span>
              <span>Created by <strong className="text-emerald-500 font-bold">MUZAINI AL KAHFI</strong></span>
            </div>
          </div>

        </main>
      </div>

      {/* 5. BOTTOM NAVIGATION DOCK */}
      <div className={`border-t fixed bottom-0 left-0 right-0 z-50 shadow-lg transition-colors duration-300 ${
        isDarkMode ? 'bg-slate-900/95 border-slate-800 backdrop-blur-md' : 'bg-slate-100/95 border-slate-300 backdrop-blur-md'
      }`}>
        <div className="max-w-xl mx-auto px-4 py-2.5 flex items-center justify-between">
          <Link href="/" className={`flex flex-col items-center gap-1 text-xs font-semibold transition ${
            isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-950'
          }`}>
            <span className="text-lg">🕒</span>
            <span>Dashboard</span>
          </Link>

          {isOperator && (
            <Link href="/siswa" className={`flex flex-col items-center gap-1 text-xs font-semibold transition ${
              isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-950'
            }`}>
              <span className="text-lg">👥</span>
              <span>Siswa</span>
            </Link>
          )}

          {isOperator && (
            <Link href="/guru" className={`flex flex-col items-center gap-1 text-xs font-semibold transition ${
              isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-950'
            }`}>
              <span className="text-lg">👨‍🏫</span>
              <span>Guru</span>
            </Link>
          )}

          <Link href="/jadwal" className={`flex flex-col items-center gap-1 text-xs font-semibold transition ${
            isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-950'
          }`}>
            <span className="text-lg">🎓</span>
            <span>Akademik</span>
          </Link>

          <Link href="/ai" className="flex flex-col items-center gap-1 text-xs font-bold text-indigo-500 transition">
            <span className="text-lg">✨</span>
            <span>AI Tools</span>
          </Link>

          <Link href="/laporan" className={`flex flex-col items-center gap-1 text-xs font-semibold transition ${
            isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-950'
          }`}>
            <span className="text-lg">🖨️</span>
            <span>Laporan</span>
          </Link>
        </div>
      </div>
    </motion.div>
  )
}