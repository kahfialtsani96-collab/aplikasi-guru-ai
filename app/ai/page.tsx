'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import { createClient } from '@supabase/supabase-js'
import { motion } from 'framer-motion'
import { useAuthRole } from '@/hooks/useAuthRole'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://kvrulbdvgxfrtmznpjnm.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const supabase = createClient(supabaseUrl.replace(/['"]/g, '').trim(), supabaseAnonKey.replace(/['"]/g, '').trim())

interface MapelItem {
  id: number
  nama_mapel: string
  kode_mapel: string
}

interface KelasItem {
  id: number
  nama_kelas: string
}

export default function AiToolsPage() {
  const router = useRouter()
  const { isOperator } = useAuthRole()

  // STATE IDENTITAS GURU LOGIN (SINKRON DENGAN DASHBOARD, ABSENSI, NILAI, JURNAL, BIMBINGAN)
  const [userDisplayName, setUserDisplayName] = useState('MEMUAT...')
  const [userNuptkDisplay, setUserNuptkDisplay] = useState('-')
  const [isStrictOperatorRole, setIsStrictOperatorRole] = useState(false)
  const [waliKelasAssignedId, setWaliKelasAssignedId] = useState<number | null>(null)
  const [isLoggingOut, setIsLoggingOut] = useState(false)

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

  const [activeTool, setActiveTool] = useState('chatbot')
  const [activeTabSection, setActiveTabSection] = useState<'admin' | 'modul'>('admin')
  const [selectedDoc, setSelectedDoc] = useState('cp')

  const [isDarkMode, setIsDarkMode] = useState<boolean>(false)
  const [isSavingSoal, setIsSavingSoal] = useState(false)

  // MODAL SIMPAN SOAL SPESIFIK KELAS & MAPEL
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [saveTargetMapel, setSaveTargetMapel] = useState('')
  const [saveTargetKelas, setSaveTargetKelas] = useState('')
  const [saveNamaGuru, setSaveNamaGuru] = useState('')

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme')
    if (savedTheme === 'dark') {
      setIsDarkMode(true)
    }
  }, [])

  // MASTER DATA SUPABASE
  const [mapelList, setMapelList] = useState<MapelItem[]>([])
  const [kelasList, setKelasList] = useState<KelasItem[]>([])

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
    faseKelas: 'Fase D / Kelas VII A',
    materiTopik: '',
    jenisPerangkat: 'Modul Ajar / RPP Plus',
    dlPilar: 'Mindful Learning',
    dlAlokasi: '3 Pertemuan (6 JP)',
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
    faseKelas: 'Fase D / Kelas VII A',
    tahunPelajaran: '2026/2027',
    alokasiTotal: '72 JP / Tahun',
    jpMinggu: '2 JP/Minggu',
    modelPembelajaran: 'Discovery Learning',
    namaGuru: 'Guru Pengampu',
    nipGuru: '-',
    kotaTtd: 'Gisting',
    namaKepala: 'SULASTRI, S.Pd., Gr.',
    nipKepala: '6337763664131233',
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
    faseKelas: 'Fase D / Kelas VII A',
    tahunPelajaran: '2026/2027',
    namaGuru: 'Guru Pengampu',
    nipGuru: '-',
    kotaTtd: 'Gisting',
    namaKepala: 'SULASTRI, S.Pd., Gr.',
    nipKepala: '6337763664131233'
  })

  // INIT USER LOGIN REAL DARI TABEL GURU & MASTER DATA SUPABASE
  useEffect(() => {
    let isMounted = true

    async function initData() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        if (isMounted) router.replace('/login')
        return
      }

      let realFullName = 'Guru Pengampu'
      let cleanNuptk = '-'
      const cleanEmail = (user.email || '').trim().toLowerCase()

      if (cleanEmail) {
        const { data: dataGuru } = await supabase
          .from('guru')
          .select('id, nama_lengkap, role, NUPTK, email, jabatan')
          .ilike('email', cleanEmail)
          .maybeSingle()

        if (isMounted) {
          if (dataGuru && dataGuru.nama_lengkap) {
            realFullName = dataGuru.nama_lengkap.trim()
            cleanNuptk = formatNuptk(dataGuru.NUPTK)
            const isUserStrictOperator =
              (dataGuru.role || '').toLowerCase() === 'operator'

            setUserDisplayName(realFullName.toUpperCase())
            setUserNuptkDisplay(cleanNuptk)
            setIsStrictOperatorRole(isUserStrictOperator)

            if (!isUserStrictOperator && dataGuru.id) {
              const { data: kelasBinaan } = await supabase
                .from('kelas')
                .select('id')
                .eq('wali_kelas_id', dataGuru.id)
                .limit(1)
                .maybeSingle()

              if (isMounted) {
                setWaliKelasAssignedId(kelasBinaan?.id || null)
              }
            }
          } else {
            realFullName =
              user.user_metadata?.full_name || cleanEmail.split('@')[0] || 'GURU'
            setUserDisplayName(realFullName.toUpperCase())
            setUserNuptkDisplay('-')
            setIsStrictOperatorRole(isOperator)
          }
        }
      }

      if (isMounted) {
        setAdminForm(prev => ({ ...prev, namaGuru: realFullName, nipGuru: cleanNuptk }))
        setModulForm(prev => ({ ...prev, namaGuru: realFullName, nipGuru: cleanNuptk }))
        setSaveNamaGuru(realFullName)
      }

      // LOAD MASTER MAPEL & KELAS SUPABASE
      const { data: dMapel } = await supabase.from('mapel').select('id, nama_mapel, kode_mapel').order('nama_mapel', { ascending: true })
      if (dMapel && dMapel.length > 0 && isMounted) {
        setMapelList(dMapel)
        setFormData(prev => ({ ...prev, mapel: dMapel[0].nama_mapel }))
        setAdminForm(prev => ({ ...prev, mapel: dMapel[0].nama_mapel }))
        setModulForm(prev => ({ ...prev, mapel: dMapel[0].nama_mapel }))
        setSaveTargetMapel(dMapel[0].nama_mapel)
      }

      const { data: dKelas } = await supabase.from('kelas').select('id, nama_kelas').order('nama_kelas', { ascending: true })
      if (dKelas && dKelas.length > 0 && isMounted) {
        setKelasList(dKelas)
        const initialFaseKelas = `Fase D / ${dKelas[0].nama_kelas}`
        setFormData(prev => ({ ...prev, faseKelas: initialFaseKelas }))
        setAdminForm(prev => ({ ...prev, faseKelas: initialFaseKelas }))
        setModulForm(prev => ({ ...prev, faseKelas: initialFaseKelas }))
        setSaveTargetKelas(dKelas[0].nama_kelas)
      }
    }

    initData()

    return () => {
      isMounted = false
    }
  }, [isOperator, router])

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

  const handleMapelChange = (val: string) => {
    setFormData(prev => ({ ...prev, mapel: val }))
    setAdminForm(prev => ({ ...prev, mapel: val }))
    setModulForm(prev => ({ ...prev, mapel: val }))
    setSaveTargetMapel(val)
  }

  const handleFaseKelasChange = (val: string) => {
    setFormData(prev => ({ ...prev, faseKelas: val }))
    setAdminForm(prev => ({ ...prev, faseKelas: val }))
    setModulForm(prev => ({ ...prev, faseKelas: val }))
  }

  // BUKA MODAL KONFIRMASI SIMPAN SOAL
  const handleOpenSaveModal = () => {
    const hasilSoal = generatedResults['soal']
    if (!hasilSoal) {
      alert('Belum ada paket soal yang dihasilkan!')
      return
    }
    setShowSaveModal(true)
  }

  // EKSEKUSI SIMPAN SOAL KE DATABASE (OTOMATIS DENGAN NAMA GURU LOGIN & KELAS PILIHAN)
  const handleConfirmSaveBankSoal = async () => {
    const hasilSoal = generatedResults['soal']
    if (!hasilSoal) return

    setIsSavingSoal(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()

      let finalNamaGuru = saveNamaGuru
      if (user && user.email) {
        const { data: dbGuru } = await supabase
          .from('guru')
          .select('nama_lengkap')
          .ilike('email', user.email.trim().toLowerCase())
          .maybeSingle()

        if (dbGuru && dbGuru.nama_lengkap) {
          finalNamaGuru = dbGuru.nama_lengkap
        }
      }

      const payload = {
        nama_guru: finalNamaGuru,
        mapel: saveTargetMapel || formData.mapel,
        fase_kelas: `Fase D / ${saveTargetKelas}`,
        topik_materi: formData.materiTopik || 'Umum',
        bentuk_soal: formData.soalTipe,
        jumlah_soal: parseInt(formData.soalJumlah) || 10,
        tingkat_kesulitan: formData.soalLevel,
        isi_soal: hasilSoal,
        user_id: user?.id || null
      }

      const { error } = await supabase.from('bank_soal').insert([payload])

      if (error) {
        throw error
      }

      alert(`✅ Berhasil! Paket Soal ${saveTargetMapel} Kelas ${saveTargetKelas} tersimpan atas nama Guru: ${finalNamaGuru}`)
      setShowSaveModal(false)
    } catch (err: any) {
      console.error('Error saving bank soal:', err)
      alert(`Gagal menyimpan soal: ${err.message || 'Terjadi kesalahan'}`)
    } finally {
      setIsSavingSoal(false)
    }
  }

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
      subtitle: 'Susun skenario Modul Pembelajaran lengkap Rubrik Asesmen & Lembar Pengesahan Akreditasi.',
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
      .replace(/Sekolah\/Madrasah/gi, kopSekolah.namaSekolah)
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
      Dokumen ini dibuat secara otomatis menggunakan <strong>Aplikasi Guru AI</strong> - Created & Developed by <strong>MUZAINI AL KAHFI</strong> &copy; 2026
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
            satuanPendidikan: kopSekolah.namaSekolah,
            tool: currentConfig?.title || 'Asisten Guru AI',
            activeTool,
            selectedDoc: doc.id,
            mapel: formData.mapel,
            faseKelas: formData.faseKelas,
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
          ...adminForm,
          satuanPendidikan: kopSekolah.namaSekolah,
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
            <title>Dokumen Pembelajaran - ${kopSekolah.namaSekolah}</title>
            <style>
              @page { 
                margin: 1.5cm 2cm; 
                size: A4; 
              }
              body { 
                font-family: 'Times New Roman', Times, serif; 
                padding: 0; 
                line-height: 1.5; 
                color: #000; 
                font-size: 11pt;
              }
              h1, h2, h3, h4 { 
                color: #000; 
                margin-top: 14px; 
                margin-bottom: 6px; 
                page-break-after: avoid; 
              }
              p { 
                margin-bottom: 6px; 
                text-align: justify; 
              }
              table { 
                border-collapse: collapse; 
                width: 100%; 
                margin: 12px 0; 
                font-size: 10.5pt; 
                page-break-inside: auto; 
              }
              tr { 
                page-break-inside: auto !important; 
                page-break-after: auto; 
              }
              th, td { 
                border: 1px solid #000; 
                padding: 5px 7px; 
                text-align: left; 
                vertical-align: top; 
              }
              th { 
                background-color: #f2f2f2; 
                font-weight: bold; 
                text-align: center; 
              }
              ul, ol { 
                margin-bottom: 10px; 
                padding-left: 20px; 
              }
              li { 
                margin-bottom: 4px; 
                line-height: 1.4; 
                page-break-inside: auto !important; 
              }
              strong, b { 
                font-weight: bold; 
              }
              table.ttd-table, 
              table.ttd-table td, 
              table.ttd-table tr,
              table[style*="border: none"], 
              table[style*="border: none"] td {
                border: none !important;
              }
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

    const header = "<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>Export Word</title><style>body { font-family: 'Times New Roman', serif; font-size: 12pt; line-height: 1.5; } p { margin-bottom: 8pt; } table { border-collapse: collapse; width: 100%; } td, th { border: 1px solid #000; padding: 5pt; } table.ttd-table, table.ttd-table td { border: none !important; }</style></head><body>"
    const footer = copyrightFooterHTML + "</body></html>"
    const sourceHTML = header + (pakaiKop ? headerKopSekolahHTML : '') + printContents + footer

    const source = 'data:application/vnd.ms-word;charset=utf-8,' + encodeURIComponent(sourceHTML)
    const fileDownload = document.createElement("a")
    document.body.appendChild(fileDownload)
    fileDownload.href = source
    fileDownload.download = `Dokumen_Pembelajaran_${kopSekolah.namaSekolah}_${activeTool}.doc`
    fileDownload.click()
    document.body.removeChild(fileDownload)
  }

  const currentToolData = aiToolsConfig[activeTool] || aiToolsConfig['chatbot']

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className={`min-h-screen font-sans flex flex-col justify-between selection:bg-indigo-500 selection:text-white pb-16 relative overflow-x-hidden transition-colors duration-300 ${
        isDarkMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-200 text-slate-800'
      }`}
    >
      {/* WATERMARK LOGO */}
      <div className={`fixed inset-0 pointer-events-none z-0 flex items-center justify-center select-none transition-opacity duration-300 ${
        isDarkMode ? 'opacity-[0.04]' : 'opacity-[0.12]'
      }`}>
        <img
          src="/logo-smp.jpg"
          alt="Watermark SMP Muna Mustofa"
          className="w-[600px] h-[600px] object-contain max-w-none"
        />
      </div>

      <div className="relative z-10">
        {/* 1. SUPER-COMPACT HEADER TOPBAR (SINKRON DENGAN HALAMAN LAIN & NYAMAN DI HP) */}
        <header className={`border-b px-3 py-1.5 flex items-center justify-between gap-2 sticky top-0 z-40 shadow-xs transition-colors duration-300 ${
          isDarkMode ? 'bg-slate-900/95 border-slate-800 backdrop-blur-md' : 'bg-slate-100/95 border-slate-300 backdrop-blur-md'
        }`}>
          <div className="flex items-center gap-2 shrink-0">
            <Link href="/" className={`p-1 rounded-lg transition ${isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'}`} title="Kembali ke Dashboard">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </Link>
            <div className="flex items-center gap-1.5">
              <img src="/logo-smp.jpg" alt="Logo" className="w-5 h-5 rounded border p-0.5 object-contain" />
              <div>
                <h1 className={`font-black text-xs leading-none ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Guru AI</h1>
                <p className={`text-[9px] font-bold mt-0.5 hidden sm:block ${isDarkMode ? 'text-emerald-400' : 'text-emerald-800'}`}>Mercury AI Engine</p>
              </div>
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
                <span className="font-extrabold max-w-[105px] sm:max-w-none truncate">
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

        {/* 2. SUB-NAVBAR AI TOOLS (PILLS COMPACT HORIZONTAL SCROLL UNTUK HP) */}
        <div className={`border-b px-3 py-1 overflow-x-auto custom-scrollbar transition-colors duration-300 ${
          isDarkMode ? 'bg-slate-900/80 border-slate-800 backdrop-blur-md' : 'bg-slate-200/80 border-slate-300 backdrop-blur-md'
        }`}>
          <div className="max-w-6xl mx-auto flex items-center gap-1 min-w-max text-[10px] font-bold">
            {aiToolsNav.map((tool) => (
              <button
                key={tool.id}
                onClick={() => setActiveTool(tool.id)}
                className={`px-2 py-0.5 rounded transition flex items-center gap-1 border cursor-pointer ${
                  activeTool === tool.id
                    ? 'bg-indigo-600 text-white border-indigo-700 shadow-xs font-extrabold'
                    : isDarkMode 
                      ? 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700' 
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-indigo-50'
                }`}
              >
                <span>{tool.icon}</span>
                <span>{tool.title}</span>
              </button>
            ))}
          </div>
        </div>

        {/* MAIN CONTENT CONTAINER COMPACT */}
        <main className="max-w-6xl mx-auto p-2 sm:p-4 space-y-2.5">
          {/* BANNER TOOL COMPACT */}
          <div className={`${currentToolData.bgBanner} rounded-xl p-3 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 shadow-sm relative overflow-hidden text-white border transition-all duration-300`}>
            <div className="space-y-1 max-w-2xl">
              <div className="inline-flex items-center gap-1 bg-amber-400 text-slate-950 text-[9px] font-black uppercase px-2 py-0.5 rounded-full shadow-xs">
                <span>{currentToolData.badge}</span>
              </div>
              <h2 className="text-sm sm:text-base font-black text-white tracking-tight leading-tight">{currentToolData.title}</h2>
              <p className="text-[11px] text-slate-100 font-medium leading-snug">{currentToolData.subtitle}</p>
            </div>
            <button
              onClick={handleStartGenerate}
              disabled={isGenerating}
              className="w-full sm:w-auto bg-white hover:bg-slate-100 text-indigo-950 font-black px-3.5 py-2 rounded-lg text-xs transition shadow-sm flex items-center justify-center gap-1.5 whitespace-nowrap disabled:opacity-50 cursor-pointer shrink-0"
            >
              <span>✨</span>
              <span>{isGenerating ? 'AI Memproses...' : currentToolData.buttonText}</span>
            </button>
          </div>

          {/* ACCORDION KOP SURAT COMPACT */}
          {activeTool !== 'chatbot' && (
            <div className={`backdrop-blur-md border rounded-xl p-2.5 transition-all shadow-xs ${
              isDarkMode 
                ? 'bg-slate-900 border-slate-800' 
                : 'bg-white border-indigo-200'
            }`}>
              <button
                onClick={() => setShowKopAccordion(!showKopAccordion)}
                className={`w-full flex items-center justify-between text-[11px] font-extrabold transition cursor-pointer ${
                  isDarkMode ? 'text-indigo-300 hover:text-indigo-200' : 'text-indigo-950 hover:text-indigo-800'
                }`}
              >
                <div className="flex items-center gap-1.5 truncate">
                  <span>🏫</span>
                  <span className="truncate">Kop Surat ({kopSekolah.namaSekolah})</span>
                </div>
                <span className="shrink-0 text-[10px]">{showKopAccordion ? '🔼 Tutup' : '🔽 Ubah'}</span>
              </button>

              {showKopAccordion && (
                <div className={`mt-2.5 pt-2.5 border-t grid grid-cols-1 md:grid-cols-2 gap-2 text-xs ${
                  isDarkMode ? 'border-slate-800' : 'border-slate-200'
                }`}>
                  <div>
                    <label className={`block text-[10px] font-bold mb-0.5 ${isDarkMode ? 'text-indigo-300' : 'text-slate-700'}`}>Nama Yayasan / Instansi</label>
                    <input
                      type="text"
                      value={kopSekolah.yayasan}
                      onChange={(e) => setKopSekolah({ ...kopSekolah, yayasan: e.target.value })}
                      className={`w-full border rounded-lg px-2.5 py-1 text-xs font-medium ${
                        isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                      }`}
                    />
                  </div>
                  <div>
                    <label className={`block text-[10px] font-bold mb-0.5 ${isDarkMode ? 'text-indigo-300' : 'text-slate-700'}`}>Nama Satuan Pendidikan</label>
                    <input
                      type="text"
                      value={kopSekolah.namaSekolah}
                      onChange={(e) => setKopSekolah({ ...kopSekolah, namaSekolah: e.target.value })}
                      className={`w-full border rounded-lg px-2.5 py-1 text-xs font-bold ${
                        isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                      }`}
                    />
                  </div>
                  <div>
                    <label className={`block text-[10px] font-bold mb-0.5 ${isDarkMode ? 'text-indigo-300' : 'text-slate-700'}`}>NPSN &amp; Legalitas SK</label>
                    <input
                      type="text"
                      value={kopSekolah.legalitas}
                      onChange={(e) => setKopSekolah({ ...kopSekolah, legalitas: e.target.value })}
                      className={`w-full border rounded-lg px-2.5 py-1 text-xs font-medium ${
                        isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                      }`}
                    />
                  </div>
                  <div>
                    <label className={`block text-[10px] font-bold mb-0.5 ${isDarkMode ? 'text-indigo-300' : 'text-slate-700'}`}>Alamat Sekolah</label>
                    <input
                      type="text"
                      value={kopSekolah.alamat}
                      onChange={(e) => setKopSekolah({ ...kopSekolah, alamat: e.target.value })}
                      className={`w-full border rounded-lg px-2.5 py-1 text-xs font-medium ${
                        isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                      }`}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* PARAMETER INPUT AI COMPACT */}
          <div className={`backdrop-blur-md border rounded-xl p-2.5 sm:p-3.5 space-y-2.5 shadow-xs ${
            isDarkMode 
              ? 'bg-slate-900 border-slate-800' 
              : 'bg-white border-indigo-200'
          }`}>
            <h3 className={`font-black text-xs border-b pb-1.5 flex items-center gap-1.5 ${
              isDarkMode ? 'text-white border-slate-800' : 'text-slate-900 border-slate-200'
            }`}>
              <span>⚙️</span>
              <span>Parameter Input AI</span>
            </h3>

            {activeTool !== 'kbc' && activeTool !== 'chatbot' && (
              <div className="grid grid-cols-2 gap-1.5 text-xs">
                <div>
                  <label className={`block text-[10px] font-bold mb-0.5 ${isDarkMode ? 'text-indigo-300' : 'text-slate-700'}`}>Mata Pelajaran</label>
                  {mapelList.length > 0 ? (
                    <select
                      value={formData.mapel}
                      onChange={(e) => handleMapelChange(e.target.value)}
                      className={`w-full border rounded-lg px-2 py-1 text-xs font-bold cursor-pointer focus:outline-none ${
                        isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                      }`}
                    >
                      {mapelList.map((m) => (
                        <option key={m.id} value={m.nama_mapel}>{m.nama_mapel} ({m.kode_mapel})</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={formData.mapel}
                      onChange={(e) => handleMapelChange(e.target.value)}
                      placeholder="Contoh: IPA"
                      className={`w-full border rounded-lg px-2 py-1 text-xs font-medium focus:outline-none ${
                        isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                      }`}
                    />
                  )}
                </div>

                <div>
                  <label className={`block text-[10px] font-bold mb-0.5 ${isDarkMode ? 'text-indigo-300' : 'text-slate-700'}`}>Fase / Kelas</label>
                  {kelasList.length > 0 ? (
                    <select
                      value={formData.faseKelas}
                      onChange={(e) => handleFaseKelasChange(e.target.value)}
                      className={`w-full border rounded-lg px-2 py-1 text-xs font-bold cursor-pointer focus:outline-none ${
                        isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                      }`}
                    >
                      {kelasList.map((k) => (
                        <option key={k.id} value={`Fase D / ${k.nama_kelas}`}>Fase D / {k.nama_kelas}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={formData.faseKelas}
                      onChange={(e) => handleFaseKelasChange(e.target.value)}
                      placeholder="Contoh: Fase D / Kelas VII A"
                      className={`w-full border rounded-lg px-2 py-1 text-xs font-medium focus:outline-none ${
                        isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                      }`}
                    />
                  )}
                </div>
              </div>
            )}

            {/* 1. KBC FORM */}
            {activeTool === 'kbc' && (
              <div className="space-y-2.5">
                <div className={`grid grid-cols-2 p-0.5 rounded-lg border text-[11px] font-extrabold ${
                  isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-100 border-slate-300'
                }`}>
                  <button
                    onClick={() => setActiveTabSection('admin')}
                    className={`py-1 rounded-md transition cursor-pointer ${
                      activeTabSection === 'admin' 
                        ? 'bg-indigo-600 text-white shadow-xs' 
                        : isDarkMode ? 'text-slate-400' : 'text-slate-700'
                    }`}
                  >
                    1. Identitas &amp; Admin
                  </button>
                  <button
                    onClick={() => setActiveTabSection('modul')}
                    className={`py-1 rounded-md transition cursor-pointer ${
                      activeTabSection === 'modul' 
                        ? 'bg-indigo-600 text-white shadow-xs' 
                        : isDarkMode ? 'text-slate-400' : 'text-slate-700'
                    }`}
                  >
                    2. Modul &amp; Skenario
                  </button>
                </div>

                {activeTabSection === 'admin' ? (
                  <div className="space-y-2 text-xs">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
                      <div>
                        <label className={`block text-[10px] font-bold mb-0.5 ${isDarkMode ? 'text-indigo-300' : 'text-slate-700'}`}>Satuan Pendidikan</label>
                        <input type="text" value={adminForm.satuanPendidikan} onChange={(e)=>setAdminForm({...adminForm, satuanPendidikan:e.target.value})} className={`w-full border rounded-lg px-2 py-1 text-xs font-medium ${
                          isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                        }`} />
                      </div>
                      <div>
                        <label className={`block text-[10px] font-bold mb-0.5 ${isDarkMode ? 'text-indigo-300' : 'text-slate-700'}`}>Mata Pelajaran</label>
                        {mapelList.length > 0 ? (
                          <select value={adminForm.mapel} onChange={(e)=>handleMapelChange(e.target.value)} className={`w-full border rounded-lg px-2 py-1 text-xs font-bold cursor-pointer ${
                            isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                          }`}>
                            {mapelList.map((m) => (
                              <option key={m.id} value={m.nama_mapel}>{m.nama_mapel}</option>
                            ))}
                          </select>
                        ) : (
                          <input type="text" value={adminForm.mapel} onChange={(e)=>handleMapelChange(e.target.value)} className={`w-full border rounded-lg px-2 py-1 text-xs font-medium ${
                            isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                          }`} />
                        )}
                      </div>
                      <div>
                        <label className={`block text-[10px] font-bold mb-0.5 ${isDarkMode ? 'text-indigo-300' : 'text-slate-700'}`}>Fase / Kelas</label>
                        {kelasList.length > 0 ? (
                          <select value={adminForm.faseKelas} onChange={(e)=>handleFaseKelasChange(e.target.value)} className={`w-full border rounded-lg px-2 py-1 text-xs font-bold cursor-pointer ${
                            isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                          }`}>
                            {kelasList.map((k) => (
                              <option key={k.id} value={`Fase D / ${k.nama_kelas}`}>Fase D / {k.nama_kelas}</option>
                            ))}
                          </select>
                        ) : (
                          <input type="text" value={adminForm.faseKelas} onChange={(e)=>handleFaseKelasChange(e.target.value)} className={`w-full border rounded-lg px-2 py-1 text-xs font-medium ${
                            isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                          }`} />
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-1.5">
                      <div>
                        <label className={`block text-[10px] font-bold mb-0.5 ${isDarkMode ? 'text-indigo-300' : 'text-slate-700'}`}>Guru Pengampu</label>
                        <input type="text" value={adminForm.namaGuru} onChange={(e)=>setAdminForm({...adminForm, namaGuru:e.target.value})} className={`w-full border rounded-lg px-2 py-1 text-xs font-bold ${
                          isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                        }`} />
                      </div>
                      <div>
                        <label className={`block text-[10px] font-bold mb-0.5 ${isDarkMode ? 'text-indigo-300' : 'text-slate-700'}`}>Kepala Sekolah</label>
                        <input type="text" value={adminForm.namaKepala} onChange={(e)=>setAdminForm({...adminForm, namaKepala:e.target.value})} className={`w-full border rounded-lg px-2 py-1 text-xs font-bold ${
                          isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                        }`} />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-1.5">
                      <div>
                        <label className={`block text-[10px] font-bold mb-0.5 ${isDarkMode ? 'text-indigo-300' : 'text-slate-700'}`}>NIP / NUPTK Guru</label>
                        <input type="text" value={adminForm.nipGuru} onChange={(e)=>setAdminForm({...adminForm, nipGuru:e.target.value})} className={`w-full border rounded-lg px-2 py-1 text-xs font-mono ${
                          isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-slate-50 border-slate-300 text-slate-800'
                        }`} />
                      </div>
                      <div>
                        <label className={`block text-[10px] font-bold mb-0.5 ${isDarkMode ? 'text-indigo-300' : 'text-slate-700'}`}>NUPTK Kepala</label>
                        <input type="text" value={adminForm.nipKepala} onChange={(e)=>setAdminForm({...adminForm, nipKepala:e.target.value})} className={`w-full border rounded-lg px-2 py-1 text-xs font-mono ${
                          isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-slate-50 border-slate-300 text-slate-800'
                        }`} />
                      </div>
                    </div>

                    <textarea rows={2} placeholder="Capaian Pembelajaran (CP)..." value={adminForm.cpPerElemen} onChange={(e)=>setAdminForm({...adminForm, cpPerElemen:e.target.value})} className={`w-full border rounded-lg p-2 text-xs font-medium resize-none ${
                      isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`} />
                  </div>
                ) : (
                  <div className="space-y-2 text-xs">
                     <div className="grid grid-cols-2 gap-1.5">
                        <input type="text" placeholder="Kode TP" value={modulForm.kodeTp} onChange={(e)=>setModulForm({...modulForm, kodeTp:e.target.value})} className={`border rounded-lg px-2 py-1 text-xs font-bold ${
                          isDarkMode ? 'bg-slate-800 border-slate-700 text-indigo-300' : 'bg-slate-50 border-slate-300 text-indigo-900'
                        }`} />
                        <select value={modulForm.modelPembelajaran} onChange={(e)=>setModulForm({...modulForm, modelPembelajaran:e.target.value})} className={`border rounded-lg px-2 py-1 text-xs font-bold cursor-pointer ${
                          isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                        }`}>
                          <option>Problem Based Learning (PBL)</option><option>Discovery Learning</option><option>Project Based Learning</option>
                        </select>
                     </div>
                     <textarea rows={2} placeholder="Rumusan Tujuan Pembelajaran..." value={modulForm.rumusanTp} onChange={(e)=>setModulForm({...modulForm, rumusanTp:e.target.value})} className={`w-full border rounded-lg p-2 text-xs font-medium resize-none ${
                       isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                     }`} />
                  </div>
                )}

                <div className={`pt-2 border-t ${isDarkMode ? 'border-slate-800' : 'border-slate-200'}`}>
                  <span className={`text-[10px] font-extrabold mb-1.5 block ${isDarkMode ? 'text-indigo-300' : 'text-slate-700'}`}>Pilih Dokumen Target (Klik untuk melihat hasil):</span>
                  <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-9 gap-1">
                    {kbcDocsList.map(doc => (
                      <button key={doc.id} onClick={() => setSelectedDoc(doc.id)} className={`p-1.5 rounded-lg border text-[10px] flex flex-col items-center gap-0.5 cursor-pointer ${
                        selectedDoc === doc.id 
                          ? 'bg-indigo-600 text-white font-bold border-indigo-700 shadow-xs' 
                          : isDarkMode 
                            ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700' 
                            : 'bg-slate-50 border-slate-300 text-slate-700 hover:bg-slate-100'
                      }`}>
                        <span className="text-xs">{doc.icon}</span> 
                        <span className="truncate max-w-full">{doc.name.split(' ')[0]}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* 2. PERANGKAT AJAR PRO FORM */}
            {activeTool === 'perangkat' && (
              <div className="space-y-2 text-xs">
                <div>
                  <label className={`block text-[10px] font-bold mb-0.5 ${isDarkMode ? 'text-indigo-300' : 'text-slate-700'}`}>Jenis Dokumen Perangkat</label>
                  <select value={formData.jenisPerangkat} onChange={(e) => setFormData({...formData, jenisPerangkat: e.target.value})} className={`w-full border rounded-lg px-2 py-1 text-xs font-bold cursor-pointer ${
                    isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}>
                    <option>Modul Ajar / RPP Plus</option><option>Alur Tujuan Pembelajaran (ATP)</option><option>Program Tahunan (Prota)</option><option>Program Semester (Prosem)</option><option>Silabus Singkat</option>
                  </select>
                </div>
                <div>
                  <label className={`block text-[10px] font-bold mb-0.5 ${isDarkMode ? 'text-indigo-300' : 'text-slate-700'}`}>Materi Pokok / Deskripsi Singkat</label>
                  <textarea rows={2} value={formData.materiTopik} onChange={(e) => setFormData({...formData, materiTopik: e.target.value})} placeholder="Contoh: Pertumbuhan dan Perkembangan Makhluk Hidup..." className={`w-full border rounded-lg p-2 text-xs font-medium resize-none ${
                    isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`} />
                </div>
              </div>
            )}

            {/* 3. DEEP LEARNING FORM */}
            {activeTool === 'deep-learning' && (
              <div className="space-y-2 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
                  <div>
                    <label className={`block text-[10px] font-bold mb-0.5 ${isDarkMode ? 'text-indigo-300' : 'text-slate-700'}`}>Pilar Utama Skenario</label>
                    <select value={formData.dlPilar} onChange={(e) => setFormData({...formData, dlPilar: e.target.value})} className={`w-full border rounded-lg px-2 py-1 text-xs font-bold cursor-pointer ${
                      isDarkMode ? 'bg-slate-800 border-slate-700 text-indigo-300' : 'bg-slate-50 border-slate-300 text-indigo-900'
                    }`}>
                      <option>Mindful Learning (Kesadaran &amp; Fokus)</option>
                      <option>Meaningful Learning (Makna &amp; Kontekstual)</option>
                      <option>Joyful Learning (Eksplorasi Menyenangkan)</option>
                    </select>
                  </div>
                  <div>
                    <label className={`block text-[10px] font-bold mb-0.5 ${isDarkMode ? 'text-indigo-300' : 'text-slate-700'}`}>Strategi Kegiatan</label>
                    <input type="text" value={formData.dlStrategi} onChange={(e) => setFormData({...formData, dlStrategi: e.target.value})} placeholder="Diskusi &amp; Eksperimen" className={`w-full border rounded-lg px-2 py-1 text-xs font-medium ${
                      isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`} />
                  </div>
                  <div>
                    <label className={`block text-[10px] font-bold mb-0.5 ${isDarkMode ? 'text-indigo-300' : 'text-slate-700'}`}>Alokasi Waktu</label>
                    <input type="text" value={formData.dlAlokasi} onChange={(e) => setFormData({...formData, dlAlokasi: e.target.value})} placeholder="Contoh: 3 Pertemuan (6 JP)" className={`w-full border rounded-lg px-2 py-1 text-xs font-medium ${
                      isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`} />
                  </div>
                </div>
                <div>
                  <label className={`block text-[10px] font-bold mb-0.5 ${isDarkMode ? 'text-indigo-300' : 'text-slate-700'}`}>Topik Bahasan Skenario</label>
                  <textarea rows={2} value={formData.materiTopik} onChange={(e) => setFormData({...formData, materiTopik: e.target.value})} placeholder="Contoh: Pertumbuhan dan Perkembangan Makhluk Hidup..." className={`w-full border rounded-lg p-2 text-xs font-medium resize-none ${
                    isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`} />
                </div>
              </div>
            )}

            {/* 4. MODUL KOKURIKULER P5 / PPRA */}
            {activeTool === 'kokurikuler' && (
              <div className="space-y-2 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  <div>
                    <label className={`block text-[10px] font-bold mb-0.5 ${isDarkMode ? 'text-indigo-300' : 'text-slate-700'}`}>Tema Utama P5 / PPRA</label>
                    <select value={formData.kokuTema} onChange={(e) => setFormData({...formData, kokuTema: e.target.value})} className={`w-full border rounded-lg px-2 py-1 text-xs font-bold cursor-pointer ${
                      isDarkMode ? 'bg-slate-800 border-slate-700 text-indigo-300' : 'bg-slate-50 border-slate-300 text-indigo-900'
                    }`}>
                      <option>Kearifan Lokal</option><option>Gaya Hidup Berkelanjutan</option><option>Bhinneka Tunggal Ika</option><option>Kewirausahaan</option><option>Bangunlah Jiwa dan Raganya</option>
                    </select>
                  </div>
                  <div>
                    <label className={`block text-[10px] font-bold mb-0.5 ${isDarkMode ? 'text-indigo-300' : 'text-slate-700'}`}>Target Dimensi Profil Pelajar</label>
                    <input type="text" value={formData.kokuDimensi} onChange={(e) => setFormData({...formData, kokuDimensi: e.target.value})} placeholder="Contoh: Bernalar Kritis &amp; Kreatif" className={`w-full border rounded-lg px-2 py-1 text-xs font-medium ${
                      isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`} />
                  </div>
                </div>
                <div>
                  <label className={`block text-[10px] font-bold mb-0.5 ${isDarkMode ? 'text-indigo-300' : 'text-slate-700'}`}>Judul Spesifik Projek (Opsional)</label>
                  <input type="text" value={formData.materiTopik} onChange={(e) => setFormData({...formData, materiTopik: e.target.value})} placeholder="Contoh: Membuat ecobrick dari sampah plastik..." className={`w-full border rounded-lg px-2.5 py-1.5 text-xs font-medium ${
                    isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`} />
                </div>
              </div>
            )}

            {/* 5. ASISTEN GURU CHATBOT */}
            {activeTool === 'chatbot' && (
              <div className="space-y-2 text-xs">
                <div className={`border p-2 rounded-lg flex items-start gap-2 ${
                  isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-indigo-50/70 border-indigo-200'
                }`}>
                  <span className="text-sm">💬</span>
                  <p className={`text-[11px] font-medium leading-snug ${isDarkMode ? 'text-indigo-300' : 'text-indigo-950'}`}>
                    Konsultasikan strategi mengajar, penanganan siswa, ide pembuka kelas, atau narasi rapor siswa.
                  </p>
                </div>
                <div>
                  <textarea rows={3} value={formData.materiTopik} onChange={(e) => setFormData({...formData, materiTopik: e.target.value})} placeholder="Ketik pertanyaan atau studi kasus guru di sini..." className={`w-full border rounded-lg p-2.5 focus:outline-none text-xs leading-relaxed font-medium resize-none ${
                    isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`} />
                </div>
              </div>
            )}

            {/* 6. GENERATOR LKPD */}
            {activeTool === 'lkpd' && (
              <div className="space-y-2 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  <div>
                    <label className={`block text-[10px] font-bold mb-0.5 ${isDarkMode ? 'text-indigo-300' : 'text-slate-700'}`}>Jenis Aktivitas LKPD</label>
                    <select value={formData.lkpdAktivitas} onChange={(e) => setFormData({...formData, lkpdAktivitas: e.target.value})} className={`w-full border rounded-lg px-2 py-1 text-xs font-bold cursor-pointer ${
                      isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}>
                      <option>Studi Kasus &amp; Pemecahan Masalah</option><option>Eksperimen / Pengamatan Langsung</option><option>Diskusi Kelompok &amp; Presentasi</option><option>Projek Mini Individu</option>
                    </select>
                  </div>
                  <div className="flex items-center pt-1 sm:pt-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={formData.lkpdHots} onChange={(e) => setFormData({...formData, lkpdHots: e.target.checked})} className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-600 cursor-pointer" />
                      <span className={`text-[11px] font-extrabold ${isDarkMode ? 'text-white' : 'text-indigo-950'}`}>Pendekatan HOTS &amp; Konteks Lokal</span>
                    </label>
                  </div>
                </div>
                <div>
                  <label className={`block text-[10px] font-bold mb-0.5 ${isDarkMode ? 'text-indigo-300' : 'text-slate-700'}`}>Materi Pokok LKPD</label>
                  <input type="text" value={formData.materiTopik} onChange={(e) => setFormData({...formData, materiTopik: e.target.value})} className={`w-full border rounded-lg px-2.5 py-1.5 text-xs font-medium ${
                    isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`} />
                </div>
              </div>
            )}

            {/* 7. BANK SOAL & UJIAN */}
            {activeTool === 'soal' && (
              <div className="space-y-2 text-xs">
                <div className="grid grid-cols-3 gap-1.5">
                  <div>
                    <label className={`block text-[10px] font-bold mb-0.5 ${isDarkMode ? 'text-indigo-300' : 'text-slate-700'}`}>Jumlah</label>
                    <input type="number" value={formData.soalJumlah} onChange={(e) => setFormData({...formData, soalJumlah: e.target.value})} className={`w-full border rounded-lg px-2 py-1 text-xs font-extrabold text-center ${
                      isDarkMode ? 'bg-slate-800 border-slate-700 text-indigo-300' : 'bg-slate-50 border-slate-300 text-indigo-900'
                    }`} />
                  </div>
                  <div>
                    <label className={`block text-[10px] font-bold mb-0.5 ${isDarkMode ? 'text-indigo-300' : 'text-slate-700'}`}>Bentuk</label>
                    <select value={formData.soalTipe} onChange={(e) => setFormData({...formData, soalTipe: e.target.value})} className={`w-full border rounded-lg px-1.5 py-1 text-xs font-bold cursor-pointer ${
                      isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}>
                      <option>Pilihan Ganda</option><option>Uraian / Essay</option><option>Campuran (PG &amp; Uraian)</option>
                    </select>
                  </div>
                  <div>
                    <label className={`block text-[10px] font-bold mb-0.5 ${isDarkMode ? 'text-indigo-300' : 'text-slate-700'}`}>Level</label>
                    <select value={formData.soalLevel} onChange={(e) => setFormData({...formData, soalLevel: e.target.value})} className={`w-full border rounded-lg px-1.5 py-1 text-xs font-bold cursor-pointer ${
                      isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}>
                      <option>HOTS (C4-C6)</option><option>MOTS (C2-C3)</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className={`block text-[10px] font-bold mb-0.5 ${isDarkMode ? 'text-indigo-300' : 'text-slate-700'}`}>Topik Ujian / Indikator Materi</label>
                  <textarea rows={2} value={formData.materiTopik} onChange={(e) => setFormData({...formData, materiTopik: e.target.value})} placeholder="Contoh: Menghitung gaya gravitasi Newton..." className={`w-full border rounded-lg p-2 text-xs font-medium resize-none ${
                    isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`} />
                </div>
              </div>
            )}

            {/* 8. MULTI TOOL */}
            {activeTool === 'multi' && (
              <div className="space-y-2 text-xs">
                <label className={`block text-[10px] font-extrabold mb-1 ${isDarkMode ? 'text-white' : 'text-slate-700'}`}>Pilih Kebutuhan Cepat:</label>
                <div className="flex flex-wrap gap-1">
                  {multiSubToolsList.map(sub => (
                    <button key={sub} onClick={() => setFormData({...formData, multiSubTool: sub})} className={`px-2.5 py-1 rounded-full border transition text-[10px] font-bold cursor-pointer ${
                      formData.multiSubTool === sub 
                        ? 'bg-indigo-600 text-white border-indigo-700 shadow-xs' 
                        : isDarkMode 
                          ? 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700' 
                          : 'bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100'
                    }`}>
                      {sub}
                    </button>
                  ))}
                </div>
                <div>
                  <label className={`block text-[10px] font-bold mb-0.5 ${isDarkMode ? 'text-indigo-300' : 'text-slate-700'}`}>Catatan/Konteks Spesifik</label>
                  <input type="text" value={formData.materiTopik} onChange={(e) => setFormData({...formData, materiTopik: e.target.value})} placeholder="Ketik rincian tambahan di sini (Opsional)..." className={`w-full border rounded-lg px-2.5 py-1.5 text-xs font-medium ${
                    isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`} />
                </div>
              </div>
            )}
          </div>

          {/* HASIL OUTPUT AI COMPACT */}
          <div className={`backdrop-blur-md border rounded-xl p-2.5 sm:p-4 space-y-3 min-h-[260px] shadow-xs ${
            isDarkMode 
              ? 'bg-slate-900 border-slate-800' 
              : 'bg-white border-indigo-200'
          }`}>
            <div className={`flex flex-col sm:flex-row items-start sm:items-center justify-between border-b pb-2.5 gap-2 ${
              isDarkMode ? 'border-slate-800' : 'border-slate-200'
            }`}>
              <div className="flex items-center gap-1.5">
                <span className="text-indigo-500 text-sm">✨</span>
                <h4 className={`font-black text-xs uppercase ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Hasil - {currentToolData.title}</h4>
              </div>

              <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto">
                {activeTool !== 'chatbot' && (
                  <label className={`flex items-center gap-1.5 text-[10px] font-bold cursor-pointer px-2 py-1 rounded-lg border shadow-xs ${
                    isDarkMode ? 'bg-slate-800 border-slate-700 text-indigo-300' : 'bg-slate-50 border-slate-300 text-indigo-950'
                  }`}>
                    <input
                      type="checkbox"
                      checked={pakaiKop}
                      onChange={(e) => setPakaiKop(e.target.checked)}
                      className="w-3.5 h-3.5 rounded text-indigo-600 border-slate-300 focus:ring-indigo-600 cursor-pointer"
                    />
                    <span>Kop Surat</span>
                  </label>
                )}

                {activeTool === 'soal' && generatedResults['soal'] && (
                  <button 
                    onClick={handleOpenSaveModal} 
                    disabled={isSavingSoal} 
                    className="flex-1 sm:flex-none bg-amber-500 hover:bg-amber-600 text-slate-950 px-2.5 py-1 rounded-lg text-[10px] font-black disabled:opacity-40 transition shadow-xs flex items-center justify-center gap-1 cursor-pointer"
                  >
                    💾 Simpan Bank Soal
                  </button>
                )}

                <button onClick={handlePrintPDF} disabled={!generatedResults[currentResultKey]} className="flex-1 sm:flex-none bg-indigo-600 hover:bg-indigo-700 text-white px-2.5 py-1 rounded-lg text-[10px] font-extrabold disabled:opacity-40 transition shadow-xs flex items-center justify-center gap-1 cursor-pointer">
                  🖨️ Cetak PDF
                </button>
                <button onClick={handleDownloadWord} disabled={!generatedResults[currentResultKey]} className="flex-1 sm:flex-none bg-emerald-700 hover:bg-emerald-800 text-white px-2.5 py-1 rounded-lg text-[10px] font-extrabold disabled:opacity-40 transition shadow-xs flex items-center justify-center gap-1 cursor-pointer">
                  📥 Word
                </button>
              </div>
            </div>

            {isGenerating ? (
              <div className="py-12 flex flex-col items-center justify-center text-center space-y-2.5">
                <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                <p className={`text-xs font-extrabold animate-pulse ${isDarkMode ? 'text-indigo-300' : 'text-indigo-900'}`}>
                  {generateProgress || 'Menghubungkan ke Mercury AI Engine...'}
                </p>
              </div>
            ) : generatedResults[currentResultKey] ? (
              <div id="ai-document-result" className={`border rounded-lg p-3 sm:p-5 text-xs sm:text-sm leading-relaxed font-sans prose max-w-none shadow-xs overflow-x-auto ${
                isDarkMode 
                  ? 'bg-slate-950/60 border-slate-800 text-slate-100 prose-headings:text-indigo-300 prose-a:text-indigo-400 prose-strong:text-white' 
                  : 'bg-slate-50 border-slate-300 text-slate-900 prose-headings:text-indigo-900 prose-a:text-indigo-700'
              }`}>
                <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
                  {generatedResults[currentResultKey]}
                </ReactMarkdown>
              </div>
            ) : (
              <div className="py-10 flex flex-col items-center justify-center text-center space-y-2">
                <div className={`w-11 h-11 rounded-full border flex items-center justify-center text-xl shadow-xs ${
                  isDarkMode ? 'bg-slate-800 border-slate-700 text-indigo-400' : 'bg-slate-50 border-indigo-200 text-indigo-700'
                }`}>
                  🤖
                </div>
                <div className="space-y-0.5">
                  <h5 className={`font-extrabold text-sm tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Belum Ada Hasil Generasi</h5>
                  <p className={`text-[11px] font-medium max-w-md mx-auto ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                    Sesuaikan parameter di atas lalu klik <b>{currentToolData.buttonText}</b>.
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="pt-2 pb-2 flex justify-center">
            <div className={`border px-3 py-1 rounded-full text-center text-[10px] font-medium shadow-xs transition-colors duration-300 ${
              isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-400' : 'bg-slate-100 border-slate-300 text-slate-700'
            }`}>
              <span>Aplikasi Guru AI</span>
              <span className="mx-1.5">•</span>
              <span>Created by <strong className="text-emerald-500 font-bold">MUZAINI AL KAHFI</strong></span>
            </div>
          </div>
        </main>
      </div>

      {/* POP-UP (MODAL) KONFIRMASI SIMPAN SOAL SPESIFIK KELAS & MAPEL */}
      {showSaveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3">
          <div className={`max-w-sm w-full border rounded-2xl p-4 shadow-2xl space-y-3 ${
            isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            <div className="flex items-center justify-between border-b pb-2 dark:border-slate-800">
              <h3 className="font-extrabold text-xs flex items-center gap-1.5">
                <span>💾</span> Simpan Soal ke Database
              </h3>
              <button 
                onClick={() => setShowSaveModal(false)}
                className="text-slate-400 hover:text-rose-500 font-bold text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 leading-snug">
              Pilih Mata Pelajaran dan Kelas yang sesuai agar soal ini langsung sinkron di menu <b>Laporan</b>.
            </p>

            <div className="space-y-2.5 text-xs">
              <div>
                <label className="block text-[10px] font-bold mb-0.5">Mata Pelajaran</label>
                <select
                  value={saveTargetMapel}
                  onChange={(e) => setSaveTargetMapel(e.target.value)}
                  className="w-full border rounded-lg px-2.5 py-1.5 text-xs font-bold dark:bg-slate-800 dark:border-slate-700"
                >
                  {mapelList.map((m) => (
                    <option key={m.id} value={m.nama_mapel}>{m.nama_mapel}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold mb-0.5">Kelas Target Cetakan</label>
                <select
                  value={saveTargetKelas}
                  onChange={(e) => setSaveTargetKelas(e.target.value)}
                  className="w-full border rounded-lg px-2.5 py-1.5 text-xs font-bold dark:bg-slate-800 dark:border-slate-700"
                >
                  {kelasList.map((k) => (
                    <option key={k.id} value={k.nama_kelas}>{k.nama_kelas}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold mb-0.5">Tersimpan atas nama Guru (Akun Login)</label>
                <input
                  type="text"
                  value={saveNamaGuru}
                  readOnly
                  className="w-full border rounded-lg px-2.5 py-1.5 text-xs font-bold bg-slate-100 dark:bg-slate-800/60 dark:border-slate-700 cursor-not-allowed"
                />
              </div>
            </div>

            <div className="flex justify-end gap-1.5 pt-2 border-t dark:border-slate-800">
              <button
                onClick={() => setShowSaveModal(false)}
                className="px-3 py-1.5 rounded-lg text-xs font-bold border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={handleConfirmSaveBankSoal}
                disabled={isSavingSoal}
                className="px-4 py-1.5 rounded-lg text-xs font-extrabold bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer disabled:opacity-50"
              >
                {isSavingSoal ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. FIXED COMPACT BOTTOM NAVIGATION BAR (SINKRON DENGAN SELURUH HALAMAN) */}
      <div className={`border-t fixed bottom-0 left-0 right-0 z-40 shadow-lg transition-colors duration-300 ${
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

          <Link href="/jadwal" className={`flex flex-col items-center gap-0.5 text-[10px] font-semibold transition ${
            isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-950'
          }`}>
            <span className="text-base leading-none">🎓</span>
            <span>Akademik</span>
          </Link>

          <Link href="/ai" className="flex flex-col items-center gap-0.5 text-[10px] font-bold text-indigo-500 transition">
            <span className="text-base leading-none">✨</span>
            <span>AI Tools</span>
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