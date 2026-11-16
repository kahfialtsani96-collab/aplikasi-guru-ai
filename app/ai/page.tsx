'use client'

import { useState, useEffect, useMemo, useRef, type ClipboardEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import { createClient } from '@supabase/supabase-js'
import { motion } from 'framer-motion'
import { useAuthRole } from '@/hooks/useAuthRole'
import { useDarkMode } from '@/hooks/useDarkMode'

// Helper aman: mencegah error prerender/SSG Vercel & membersihkan tanda kutip env
const getSupabaseUrl = () =>
  (process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://kvrulbdvgxfrtmznpjnm.supabase.co')
    .replace(/['"]/g, '')
    .trim()
const getSupabaseAnonKey = () =>
  (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder')
    .replace(/['"]/g, '')
    .trim()
const supabase = createClient(getSupabaseUrl(), getSupabaseAnonKey())

interface MapelItem {
  id: number
  nama_mapel: string
  kode_mapel: string
  jenjang?: string | null
  urutan?: number | null
}

interface KelasItem {
  id: number
  nama_kelas: string
  tingkat?: number | string | null
  jenjang?: string | null
  jurusan?: string | null
}

interface BankSoalItem {
  id: number
  nama_guru?: string | null
  jenjang?: string | null
  mapel?: string | null
  fase_kelas?: string | null
  topik_materi?: string | null
  bentuk_soal?: string | null
  jumlah_soal?: number | null
  tingkat_kesulitan?: string | null
  isi_soal?: string | null
  user_id?: string | null
  created_at?: string | null
}

interface KepalaInfo {
  nama: string
  nuptk: string
}

export default function AiToolsPage() {
  const router = useRouter()
  const { isOperator } = useAuthRole()

  const [userDisplayName, setUserDisplayName] = useState('MEMUAT...')
  const [userNuptkDisplay, setUserNuptkDisplay] = useState('-')
  const [isStrictOperatorRole, setIsStrictOperatorRole] = useState(false)
  const [waliKelasAssignedId, setWaliKelasAssignedId] = useState<number | null>(null)
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  const [kepalaSmp, setKepalaSmp] = useState<KepalaInfo>({
    nama: 'SULASTRI, S.Pd., Gr.',
    nuptk: '6337763664131233',
  })
  const [kepalaSmk, setKepalaSmk] = useState<KepalaInfo>({
    nama: 'Kepala Sekolah SMK',
    nuptk: '-',
  })

  const [selectedJenjang, setSelectedJenjang] = useState<'SMP' | 'SMK'>('SMP')

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

  const getFaseLabel = (jenjang: 'SMP' | 'SMK', namaKelas: string): string => {
    const clean = (namaKelas || '').trim().toUpperCase()
    if (jenjang === 'SMP') {
      return `Fase D / ${namaKelas}`
    }
    if (
      clean.startsWith('XII') ||
      clean.startsWith('12') ||
      clean.startsWith('XI') ||
      clean.startsWith('11')
    ) {
      return `Fase F / ${namaKelas}`
    }
    return `Fase E / ${namaKelas}`
  }

  const [activeTool, setActiveTool] = useState('chatbot')
  const [activeTabSection, setActiveTabSection] = useState<'admin' | 'modul'>('admin')
  const [selectedDoc, setSelectedDoc] = useState('cp')

  const { isDarkMode } = useDarkMode()
  const [isSavingSoal, setIsSavingSoal] = useState(false)

  // State untuk Visual Preview & Direct Click-to-Edit
  const [isEditingVisual, setIsEditingVisual] = useState(false)
  const [editedHtmlMap, setEditedHtmlMap] = useState<Record<string, string>>({})
  const [editedPlainTextMap, setEditedPlainTextMap] = useState<Record<string, string>>({})
  const visualEditorRef = useRef<HTMLDivElement | null>(null)

  const [showSaveModal, setShowSaveModal] = useState(false)
  const [saveTargetJenjang, setSaveTargetJenjang] = useState<'SMP' | 'SMK'>('SMP')
  const [saveTargetMapel, setSaveTargetMapel] = useState('')
  const [saveTargetKelas, setSaveTargetKelas] = useState('')
  const [saveNamaGuru, setSaveNamaGuru] = useState('')

  // ====== PERSISTENSI BANK SOAL (Muat Lagi Setelah Refresh / Logout) ======
  const [savedBankSoal, setSavedBankSoal] = useState<BankSoalItem[]>([])
  const [editingBankSoalId, setEditingBankSoalId] = useState<number | null>(null)
  const [saveMode, setSaveMode] = useState<'create' | 'update'>('create')
  const [showBankList, setShowBankList] = useState(false)
  const [bankSoalLoading, setBankSoalLoading] = useState(false)
  const [bankFilterMapel, setBankFilterMapel] = useState('all')
  const [bankFilterKelas, setBankFilterKelas] = useState('all')



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
    website: 'https://smpmunamustofa.netlify.app',
    kopSmkImage: '/kop-smk.png',
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
    soalJumlah: '40',
    soalTipe: 'Pilihan Ganda',
    soalLevel: 'MOTS (C2-C3)',
    soalKunci: true,
    multiSubTool: 'Ide Ice Breaking & Game Kelas',
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
    cpPerElemen:
      'Menganalisis struktur dan fungsi organ tubuh makhluk hidup serta hubungannya dengan adaptasi lingkungan.',
  })

  const [modulForm, setModulForm] = useState({
    kodeTp: 'TP.IPA.01',
    elemenCp: 'Pemahaman IPA',
    rumusanTp: 'Peserta didik mampu menganalisis fungsi organ dalam hewan dan adaptasinya.',
    modelPembelajaran: 'Problem Based Learning (PBL)',
    jumlahPertemuan: '3',
    alokasiJp: '2',
    sintaksModel:
      '1. Orientasi Masalah, 2. Pengorganisasian, 3. Penyelidikan, 4. Pengembangan Karya, 5. Evaluasi',
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
    nipKepala: '6337763664131233',
  })

  const filteredMapelList = useMemo(() => {
    return mapelList.filter((m) => {
      const j = (m.jenjang || 'SMP').toUpperCase().trim()
      return j === selectedJenjang || j === 'SEMUA' || j === 'SMP & SMK'
    })
  }, [mapelList, selectedJenjang])

  const filteredKelasList = useMemo(() => {
    return kelasList.filter((k) => {
      const j = (k.jenjang || 'SMP').toUpperCase().trim()
      return j === selectedJenjang
    })
  }, [kelasList, selectedJenjang])

  const modalFilteredMapel = useMemo(() => {
    return mapelList.filter((m) => {
      const j = (m.jenjang || 'SMP').toUpperCase().trim()
      return j === saveTargetJenjang || j === 'SEMUA' || j === 'SMP & SMK'
    })
  }, [mapelList, saveTargetJenjang])

  const modalFilteredKelas = useMemo(() => {
    return kelasList.filter((k) => {
      const j = (k.jenjang || 'SMP').toUpperCase().trim()
      return j === saveTargetJenjang
    })
  }, [kelasList, saveTargetJenjang])

  const handleJenjangSwitch = (newJenjang: 'SMP' | 'SMK') => {
    setSelectedJenjang(newJenjang)
    setSaveTargetJenjang(newJenjang)

    const isSmk = newJenjang === 'SMK'
    const namaSatuan = isSmk ? 'SMK MUNA MUSTOFA' : 'SMP MUNA MUSTOFA'
    const kepalaAktif = isSmk ? kepalaSmk : kepalaSmp

    setKopSekolah((prev) => ({ ...prev, namaSekolah: namaSatuan }))

    const nextMapelList = mapelList.filter((m) => {
      const j = (m.jenjang || 'SMP').toUpperCase().trim()
      return j === newJenjang || j === 'SEMUA' || j === 'SMP & SMK'
    })
    const nextKelasList = kelasList.filter(
      (k) => (k.jenjang || 'SMP').toUpperCase().trim() === newJenjang
    )

    const defaultMapel = nextMapelList[0]?.nama_mapel || (isSmk ? 'Dasar-Dasar DKV' : 'IPA')
    const defaultKelasObj = nextKelasList[0]
    const defaultKelasName = defaultKelasObj?.nama_kelas || (isSmk ? 'X DKV' : 'Kelas VII A')
    const defaultFaseKelas = getFaseLabel(newJenjang, defaultKelasName)

    setFormData((prev) => ({
      ...prev,
      mapel: defaultMapel,
      faseKelas: defaultFaseKelas,
    }))

    setAdminForm((prev) => ({
      ...prev,
      satuanPendidikan: namaSatuan,
      mapel: defaultMapel,
      faseKelas: defaultFaseKelas,
      namaKepala: kepalaAktif.nama,
      nipKepala: kepalaAktif.nuptk,
    }))

    setModulForm((prev) => ({
      ...prev,
      namaMadrasah: namaSatuan,
      mapel: defaultMapel,
      faseKelas: defaultFaseKelas,
      namaKepala: kepalaAktif.nama,
      nipKepala: kepalaAktif.nuptk,
    }))

    setSaveTargetMapel(defaultMapel)
    setSaveTargetKelas(defaultKelasName)
  }

  useEffect(() => {
    let isMounted = true

    async function initData() {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        if (isMounted) router.replace('/login')
        return
      }

      let realFullName = 'Guru Pengampu'
      let cleanNuptk = '-'
      let defaultUnitFromGuru: 'SMP' | 'SMK' = 'SMP'
      const cleanEmail = (user.email || '').trim().toLowerCase()

      if (cleanEmail) {
        const { data: dataGuru } = await supabase
          .from('guru')
          .select('id, nama_lengkap, role, NUPTK, email, jabatan, unit_mengajar')
          .ilike('email', cleanEmail)
          .maybeSingle()

        if (isMounted) {
          if (dataGuru && dataGuru.nama_lengkap) {
            realFullName = dataGuru.nama_lengkap.trim()
            cleanNuptk = formatNuptk(dataGuru.NUPTK)
            const isUserStrictOperator = (dataGuru.role || '').toLowerCase() === 'operator'

            const unitMengajarUpper = (dataGuru.unit_mengajar || '').toUpperCase().trim()
            // Guru mengajar SMK SAJA dibuka langsung di mode SMK; guru dua-duanya
            // (SMP & SMK) tetap dibuka di SMP, namun paket SMKnya tetap termuat
            // (lihat fetchSavedBankSoal) dan bisa dilihat lewat toggle jenjang.
            if (unitMengajarUpper === 'SMK') {
              defaultUnitFromGuru = 'SMK'
            }

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
            realFullName = user.user_metadata?.full_name || cleanEmail.split('@')[0] || 'GURU'
            setUserDisplayName(realFullName.toUpperCase())
            setUserNuptkDisplay('-')
            setIsStrictOperatorRole(isOperator)
          }
        }
      }

      const { data: daftarKepala } = await supabase
        .from('guru')
        .select('nama_lengkap, NUPTK, jabatan')
        .ilike('jabatan', '%Kepala Sekolah%')

      let loadedKepalaSmp: KepalaInfo = {
        nama: 'SULASTRI, S.Pd., Gr.',
        nuptk: '6337763664131233',
      }
      let loadedKepalaSmk: KepalaInfo = { nama: 'Kepala Sekolah SMK', nuptk: '-' }

      if (daftarKepala && daftarKepala.length > 0 && isMounted) {
        const rowSmk = daftarKepala.find(
          (g) => (g.jabatan || '').trim().toLowerCase() === 'kepala sekolah smk'
        )
        const rowSmp = daftarKepala.find(
          (g) => (g.jabatan || '').trim().toLowerCase() === 'kepala sekolah'
        )

        if (rowSmp && rowSmp.nama_lengkap) {
          loadedKepalaSmp = {
            nama: rowSmp.nama_lengkap.trim(),
            nuptk: formatNuptk(rowSmp.NUPTK),
          }
          setKepalaSmp(loadedKepalaSmp)
        }
        if (rowSmk && rowSmk.nama_lengkap) {
          loadedKepalaSmk = {
            nama: rowSmk.nama_lengkap.trim(),
            nuptk: formatNuptk(rowSmk.NUPTK),
          }
          setKepalaSmk(loadedKepalaSmk)
        }
      }

      const { data: dMapel } = await supabase
        .from('mapel')
        .select('id, nama_mapel, kode_mapel, jenjang, urutan')
        .order('urutan', { ascending: true })
        .order('nama_mapel', { ascending: true })

      const { data: dKelas } = await supabase
        .from('kelas')
        .select('id, nama_kelas, tingkat, jenjang, jurusan')
        .order('tingkat', { ascending: true })
        .order('nama_kelas', { ascending: true })

      if (isMounted) {
        if (dMapel) setMapelList(dMapel)
        if (dKelas) setKelasList(dKelas)

        setSelectedJenjang(defaultUnitFromGuru)
        setSaveTargetJenjang(defaultUnitFromGuru)

        const isSmk = defaultUnitFromGuru === 'SMK'
        const namaSatuan = isSmk ? 'SMK MUNA MUSTOFA' : 'SMP MUNA MUSTOFA'
        const kepalaAktif = isSmk ? loadedKepalaSmk : loadedKepalaSmp

        setKopSekolah((prev) => ({ ...prev, namaSekolah: namaSatuan }))

        const initMapelList = (dMapel || []).filter((m) => {
          const j = (m.jenjang || 'SMP').toUpperCase().trim()
          return j === defaultUnitFromGuru || j === 'SEMUA' || j === 'SMP & SMK'
        })
        const initKelasList = (dKelas || []).filter(
          (k) => (k.jenjang || 'SMP').toUpperCase().trim() === defaultUnitFromGuru
        )

        const firstMapel = initMapelList[0]?.nama_mapel || (isSmk ? 'Dasar-Dasar DKV' : 'IPA')
        const firstKelas = initKelasList[0]?.nama_kelas || (isSmk ? 'X DKV' : 'Kelas VII A')
        const initialFaseKelas = getFaseLabel(defaultUnitFromGuru, firstKelas)

        setFormData((prev) => ({
          ...prev,
          mapel: firstMapel,
          faseKelas: initialFaseKelas,
        }))

        setAdminForm((prev) => ({
          ...prev,
          satuanPendidikan: namaSatuan,
          mapel: firstMapel,
          faseKelas: initialFaseKelas,
          namaGuru: realFullName,
          nipGuru: cleanNuptk,
          namaKepala: kepalaAktif.nama,
          nipKepala: kepalaAktif.nuptk,
        }))

        setModulForm((prev) => ({
          ...prev,
          namaMadrasah: namaSatuan,
          mapel: firstMapel,
          faseKelas: initialFaseKelas,
          namaGuru: realFullName,
          nipGuru: cleanNuptk,
          namaKepala: kepalaAktif.nama,
          nipKepala: kepalaAktif.nuptk,
        }))

        setSaveNamaGuru(realFullName)
        setSaveTargetMapel(firstMapel)
        setSaveTargetKelas(firstKelas)
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
    setFormData((prev) => ({ ...prev, mapel: val }))
    setAdminForm((prev) => ({ ...prev, mapel: val }))
    setModulForm((prev) => ({ ...prev, mapel: val }))
    setSaveTargetMapel(val)
  }

  const handleFaseKelasChange = (val: string) => {
    setFormData((prev) => ({ ...prev, faseKelas: val }))
    setAdminForm((prev) => ({ ...prev, faseKelas: val }))
    setModulForm((prev) => ({ ...prev, faseKelas: val }))
    const parts = val.split('/')
    if (parts.length > 1) {
      setSaveTargetKelas(parts[1].trim())
    }
  }

  const currentResultKey = activeTool === 'kbc' ? `kbc_${selectedDoc}` : activeTool

  // Serializer DOM Visual Editor agar nomor urut <ol><li> (1., 2., dst.) dan baris opsi A-E tetap utuh
  const serializeVisualEditorToPlainText = (container: HTMLElement): string => {
    const clone = container.cloneNode(true) as HTMLElement

    // Konversi setiap <ol> menjadi bernomor eksplisit (1., 2., dst.)
    const orderedLists = clone.querySelectorAll('ol')
    orderedLists.forEach((ol) => {
      const startAttr = parseInt(ol.getAttribute('start') || '1', 10)
      let counter = isNaN(startAttr) ? 1 : startAttr

      Array.from(ol.children).forEach((child) => {
        if (child.tagName === 'LI') {
          const li = child as HTMLElement
          const rawLiText = (li.innerText || li.textContent || '').trim()
          const hasExplicitNum = /^\d{1,3}[\.\)]\s+/.test(rawLiText)
          const formattedLi = hasExplicitNum ? rawLiText : `${counter}. ${rawLiText}`
          const p = document.createElement('p')
          p.textContent = formattedLi
          li.replaceWith(p)
          counter++
        }
      })
    })

    let extracted = (clone.innerText || clone.textContent || '').trim()

    // Pastikan setiap opsi A., B., C., D., E. dipisah ke baris baru agar parser Laporan selalu akurat
    extracted = extracted.replace(/([^\n])\s+([A-E][\.\)]\s+)/g, '$1\n$2')

    return extracted
  }

  // Sinkronisasi teks dari Visual Preview Editor sebelum disimpan / pindah tab
  const syncVisualEditsToState = (): string => {
    const rawFallback = generatedResults[currentResultKey] || ''
    if (!visualEditorRef.current) {
      return editedPlainTextMap[currentResultKey] || rawFallback
    }

    const updatedHtml = visualEditorRef.current.innerHTML
    const updatedText = serializeVisualEditorToPlainText(visualEditorRef.current)

    setEditedHtmlMap((prev) => ({ ...prev, [currentResultKey]: updatedHtml }))
    setEditedPlainTextMap((prev) => ({ ...prev, [currentResultKey]: updatedText }))
    return updatedText
  }

  const handleToggleVisualEdit = () => {
    if (isEditingVisual) {
      syncVisualEditsToState()
      setIsEditingVisual(false)
    } else {
      setIsEditingVisual(true)
    }
  }

  const applyExecCommand = (command: string) => {
    if (typeof document !== 'undefined') {
      document.execCommand(command, false)
      visualEditorRef.current?.focus()
    }
  }

  const handleOpenSaveModal = () => {
    let finalText = generatedResults['soal']
    if (isEditingVisual && activeTool === 'soal') {
      finalText = syncVisualEditsToState()
      setIsEditingVisual(false)
    } else if (editedPlainTextMap['soal']) {
      finalText = editedPlainTextMap['soal']
    }

    if (!finalText) {
      alert('Belum ada paket soal yang dihasilkan!')
      return
    }
    setSaveMode(editingBankSoalId ? 'update' : 'create')
    setSaveTargetJenjang(selectedJenjang)
    setSaveTargetMapel(formData.mapel)
    const parts = formData.faseKelas.split('/')
    if (parts.length > 1) {
      setSaveTargetKelas(parts[1].trim())
    }
    setShowSaveModal(true)
  }

  const handleModalJenjangChange = (newJenjang: 'SMP' | 'SMK') => {
    setSaveTargetJenjang(newJenjang)
    const mList = mapelList.filter((m) => {
      const j = (m.jenjang || 'SMP').toUpperCase().trim()
      return j === newJenjang || j === 'SEMUA' || j === 'SMP & SMK'
    })
    const kList = kelasList.filter((k) => (k.jenjang || 'SMP').toUpperCase().trim() === newJenjang)

    if (mList.length > 0) setSaveTargetMapel(mList[0].nama_mapel)
    if (kList.length > 0) setSaveTargetKelas(kList[0].nama_kelas)
  }

  const handleConfirmSaveBankSoal = async () => {
    const hasilSoal = editedPlainTextMap['soal'] || generatedResults['soal']
    if (!hasilSoal) return

    setIsSavingSoal(true)
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

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

      const finalFaseKelas = getFaseLabel(saveTargetJenjang, saveTargetKelas)

      // Pastikan setiap opsi A-E tetap terpisah baris baru saat masuk database
      const normalizedSoalText = hasilSoal
        .replace('[[KUNCI_JAWABAN_START]]', '\n\n---\n')
        .replace(/([^\n])\s+([A-E][\.\)]\s+)/g, '$1\n$2')

      const payload = {
        nama_guru: finalNamaGuru,
        jenjang: saveTargetJenjang,
        mapel: saveTargetMapel || formData.mapel,
        fase_kelas: finalFaseKelas,
        topik_materi: formData.materiTopik || 'Umum',
        bentuk_soal: formData.soalTipe,
        jumlah_soal: parseInt(formData.soalJumlah) || 10,
        tingkat_kesulitan: formData.soalLevel,
        isi_soal: normalizedSoalText,
        user_id: user?.id || null,
      }

      if (editingBankSoalId && saveMode === 'update') {
        const { error } = await supabase
          .from('bank_soal')
          .update(payload)
          .eq('id', editingBankSoalId)

        if (error) throw error

        alert(
          `✅ Perubahan disimpan! Paket Soal [${saveTargetJenjang}] ${saveTargetMapel} Kelas ${saveTargetKelas} telah diperbarui atas nama Guru: ${finalNamaGuru}`
        )
        setEditingBankSoalId(null)
        setSaveMode('create')
      } else {
        const { error } = await supabase.from('bank_soal').insert([payload])

        if (error) throw error

        alert(
          `✅ Berhasil! Paket Soal baru [${saveTargetJenjang}] ${saveTargetMapel} Kelas ${saveTargetKelas} tersimpan atas nama Guru: ${finalNamaGuru}`
        )
      }
      setShowSaveModal(false)
      fetchSavedBankSoal()
    } catch (err: any) {
      console.error('Error saving bank soal:', err)
      alert(`Gagal menyimpan soal: ${err.message || 'Terjadi kesalahan'}`)
    } finally {
      setIsSavingSoal(false)
    }
  }

  // =====================================================================
  // BANK SOAL SAYA — PERSISTENSI KE DATABASE (Muat Lagi Setelah Refresh)
  // =====================================================================
  const fetchSavedBankSoal = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return
      setBankSoalLoading(true)

      const cleanEmail = (user.email || '').trim().toLowerCase()
      const mapById = new Map<number, BankSoalItem>()
      const addRows = (rows: BankSoalItem[]) => {
        rows.forEach((r) => {
          if (r.id != null) mapById.set(r.id, r)
        })
      }

      // 1) Cocokkan via user_id (baris baru yang tersimpan saat login) — selalu dijalankan
      if (user.id) {
        const { data, error } = await supabase
          .from('bank_soal')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
        if (!error) addRows((data || []) as BankSoalItem[])
      }

      // 2) Cocokkan via nama_guru (baris lama sebelum kolom user_id terisi) — SELALU dijalankan,
      //    tidak lagi bergantung pada hasil query #1 agar paket SMK ikut termuat.
      if (cleanEmail) {
        const { data: dbGuru } = await supabase
          .from('guru')
          .select('nama_lengkap')
          .ilike('email', cleanEmail)
          .maybeSingle()
        if (dbGuru?.nama_lengkap) {
          const { data } = await supabase
            .from('bank_soal')
            .select('*')
            .ilike('nama_guru', `${dbGuru.nama_lengkap}%`)
            .order('created_at', { ascending: false })
          addRows((data || []) as BankSoalItem[])
        }
      }

      const fetched = Array.from(mapById.values())
      setSavedBankSoal(fetched)
    } catch (err: any) {
      console.error('Gagal memuat bank soal:', err)
    } finally {
      setBankSoalLoading(false)
    }
  }

  useEffect(() => {
    fetchSavedBankSoal()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const bankMapelOptions = useMemo(() => {
    const set = new Set<string>()
    savedBankSoal.forEach((s) => {
      const j = (s.jenjang || '').toUpperCase().trim()
      if ((!j || j === selectedJenjang.toUpperCase()) && s.mapel) set.add(s.mapel)
    })
    return Array.from(set).sort()
  }, [savedBankSoal, selectedJenjang])

  const bankKelasOptions = useMemo(() => {
    const set = new Set<string>()
    savedBankSoal.forEach((s) => {
      const j = (s.jenjang || '').toUpperCase().trim()
      if ((!j || j === selectedJenjang.toUpperCase()) && s.fase_kelas) set.add(s.fase_kelas)
    })
    return Array.from(set).sort()
  }, [savedBankSoal, selectedJenjang])

  const filteredSavedBankSoal = useMemo(() => {
    return savedBankSoal.filter((s) => {
      const j = (s.jenjang || '').toUpperCase().trim()
      if (j && j !== selectedJenjang.toUpperCase()) return false
      if (bankFilterMapel !== 'all' && s.mapel !== bankFilterMapel) return false
      if (bankFilterKelas !== 'all' && s.fase_kelas !== bankFilterKelas) return false
      return true
    })
  }, [savedBankSoal, selectedJenjang, bankFilterMapel, bankFilterKelas])

  const formatTanggal = (t?: string | null): string => {
    if (!t) return ''
    const d = new Date(t)
    if (Number.isNaN(d.getTime())) return String(t).slice(0, 10)
    return d.toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  }

  const handleLoadSavedSoal = (row: BankSoalItem) => {
    const content = row.isi_soal || ''
    const targetJenjang: 'SMP' | 'SMK' =
      (row.jenjang || '').toUpperCase() === 'SMK' ? 'SMK' : 'SMP'

    setSelectedJenjang(targetJenjang)
    setActiveTool('soal')
    setGeneratedResults((prev) => ({ ...prev, soal: content }))
    setEditedPlainTextMap((prev) => ({ ...prev, soal: content }))
    setEditedHtmlMap((prev) => {
      const copy = { ...prev }
      delete copy.soal
      return copy
    })
    setEditingBankSoalId(row.id ?? null)
    setSaveMode('update')

    if (row.mapel) {
      setFormData((prev) => ({ ...prev, mapel: row.mapel as string }))
      setSaveTargetMapel(row.mapel)
    }
    if (row.fase_kelas) {
      setFormData((prev) => ({ ...prev, faseKelas: row.fase_kelas as string }))
      const parts = row.fase_kelas.split('/')
      if (parts.length > 1) setSaveTargetKelas(parts[1].trim())
    }
    setSaveTargetJenjang(targetJenjang)

    setTimeout(() => {
      document
        .getElementById('ai-document-result')
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 80)
  }

  const handleDeleteSavedSoal = async (row: BankSoalItem) => {
    if (!window.confirm('Hapus paket bank soal ini dari database?')) return
    const { error } = await supabase.from('bank_soal').delete().eq('id', row.id)
    if (error) {
      alert(`Gagal menghapus: ${error.message}`)
      return
    }
    setSavedBankSoal((prev) => prev.filter((x) => x.id !== row.id))
    if (editingBankSoalId === row.id) {
      setEditingBankSoalId(null)
      setSaveMode('create')
    }
  }

  const handleEditorPaste = (e: ClipboardEvent<HTMLDivElement>) => {
    // Tempel sebagai teks polos agar markup Word (MSO) tidak mengotori dokumen
    e.preventDefault()
    const text = e.clipboardData.getData('text/plain')
    document.execCommand('insertText', false, text)
  }

  const aiToolsConfig: Record<
    string,
    {
      title: string
      subtitle: string
      badge: string
      buttonText: string
      bgBanner: string
    }
  > = {
    kbc: {
      title: 'Perangkat Ajar KBC AI',
      subtitle:
        'Generator 9 Paket Perangkat Administrasi Pembelajaran KBC terintegrasi Panca Cinta Kemenag & 10 Nilai PPRA!',
      badge: '💚 KURIKULUM BERBASIS CINTA (KBC)',
      buttonText: 'Generate 9 Dokumen KBC',
      bgBanner: 'bg-gradient-to-r from-emerald-800 via-teal-800 to-emerald-950 border-emerald-700/50',
    },
    perangkat: {
      title: 'Generator Perangkat Ajar AI Pro',
      subtitle:
        'Otomatisasi pembuatan RPP, Prota, Prosem, Silabus, dan ATP Kurikulum Merdeka secara praktis.',
      badge: '📄 AI PRO GENERATOR PERANGKAT',
      buttonText: 'Generate Dokumen Perangkat',
      bgBanner: 'bg-gradient-to-r from-amber-700 via-orange-800 to-amber-950 border-amber-600/50',
    },
    'deep-learning': {
      title: 'Modul Ajar Deep Learning AI',
      subtitle:
        'Susun skenario Modul Pembelajaran lengkap Rubrik Asesmen & Lembar Pengesahan Akreditasi.',
      badge: '🪄 DEEP LEARNING AI ENGINE',
      buttonText: 'Generate Modul Deep Learning',
      bgBanner: 'bg-gradient-to-r from-indigo-800 via-purple-800 to-indigo-950 border-indigo-600/50',
    },
    kokurikuler: {
      title: 'Modul Kokurikuler AI (P5 / PPRA)',
      subtitle:
        'Perancangan modul projek lintas mata pelajaran, tema P5/PPRA, dimensi profil, dan asesmen.',
      badge: '🧭 KOKURIKULER & PROJEK P5',
      buttonText: 'Generate Modul Projek',
      bgBanner: 'bg-gradient-to-r from-sky-800 via-blue-800 to-sky-950 border-sky-600/50',
    },
    chatbot: {
      title: 'Asisten Chatbot Pedagogy AI',
      subtitle:
        'Konsultan pedagogi pintar untuk konsultasi strategi mengajar, penanganan siswa, hingga narasi rapor.',
      badge: '🤖 ASISTEN GURU VIRTUAL 24/7',
      buttonText: 'Kirim Pesan Konsultasi',
      bgBanner: 'bg-gradient-to-r from-purple-800 via-fuchsia-800 to-purple-950 border-purple-600/50',
    },
    lkpd: {
      title: 'Generator LKPD Interaktif AI',
      subtitle:
        'Buat Lembar Kerja Siswa (LKPD) menarik berbasis studi kasus, kearifan lokal, dan HOTS.',
      badge: '✨ LEMBAR KERJA PESERTA DIDIK',
      buttonText: 'Generate LKPD Interaktif',
      bgBanner: 'bg-gradient-to-r from-amber-800 via-yellow-800 to-amber-950 border-amber-600/50',
    },
    soal: {
      title: 'Generator Bank Soal & Ujian AI',
      subtitle: 'Buat naskah ujian SMP & SMK (DKV) format 2 kolom resmi siap cetak.',
      badge: '❓ BANK SOAL & EVALUASI',
      buttonText: 'Generate Paket Ujian',
      bgBanner: 'bg-gradient-to-r from-rose-800 via-red-800 to-rose-950 border-rose-600/50',
    },
    multi: {
      title: 'Multi-Tool Generator AI Lainnya',
      subtitle:
        'Kumpulan generator serbaguna: Ide ice breaking, rubrik penilaian, surat wali murid, dll.',
      badge: '🌐 MULTI-PURPOSE PEDAGOGY',
      buttonText: 'Generate Media / Rubrik',
      bgBanner: 'bg-gradient-to-r from-teal-800 via-emerald-800 to-teal-950 border-teal-600/50',
    },
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
    'Draf Narasi Catatan Rapor Siswa',
  ]

  const formatAndCleanDocument = (text: string) => {
    if (!text) return ''
    return text
      .replace(/Sekolah\/Madrasah/gi, kopSekolah.namaSekolah)
      .replace(/Paket Naskah Ujian:\s*Generator Bank Soal\s*&\s*Ujian AI/gi, '')
      .replace(/Generator Bank Soal\s*&\s*Ujian AI/gi, '')
      .replace(/#+\s*.*Kisi-Kisi[\s\S]*?(?=#+\s*|\n\n\d+\.|\n\nKunci|$)/gi, '')
      .replace(/Dokumen ini dibuat secara otomatis menggunakan Aplikasi Guru AI[\s\S]*/gi, '')
      .replace(/Created & Developed by Muzaini Al Kahfi[\s\S]*/gi, '')
      .replace(/([^\n])\s+([A-E]\.\s+)/g, '$1\n$2')
  }

  // Lindungi tag kode HTML seperti <html>, <head>, <body>, <save> pada Markdown agar tidak tertelan rehypeRaw
  const escapeCodeTagsForMarkdown = (md: string) => {
    if (!md) return ''
    return md.replace(
      /<(\/?(?:html|head|body|title|meta|link|script|style|div|span|p|a|img|table|tr|td|th|ul|ol|li|form|input|button|br|hr|h[1-6]|save|load)[a-zA-Z0-9\s="'-]*)>/gi,
      '&lt;$1&gt;'
    )
  }

  const getActiveKopSuratHTML = () => {
    if (selectedJenjang === 'SMK') {
      const originUrl = typeof window !== 'undefined' ? window.location.origin : ''
      const fullImgSrc = kopSekolah.kopSmkImage.startsWith('http')
        ? kopSekolah.kopSmkImage
        : `${originUrl}${kopSekolah.kopSmkImage}`
      return `
        <div style="text-align: center; margin-bottom: 12px;">
          <img src="${fullImgSrc}" alt="Kop Surat SMK Muna Mustofa" style="width: 100%; max-height: 155px; object-fit: contain; display: block; margin: 0 auto;" />
        </div>
      `
    }

    return `
      <div style="text-align: center; margin-bottom: 12px; font-family: 'Times New Roman', serif; color: #000;">
        <div style="font-size: 16pt; font-weight: bold; font-family: 'Traditional Arabic', 'Amiri', serif; line-height: 1.15; margin-bottom: 2px;">
          ${kopSekolah.kaligrafi}
        </div>
        <h3 style="margin: 0; font-size: 10.5pt; text-transform: uppercase; font-weight: bold; letter-spacing: 0.4px;">
          ${kopSekolah.yayasan}
        </h3>
        <h1 style="margin: 1px 0; font-size: 15pt; text-transform: uppercase; font-weight: bold;">
          ${kopSekolah.namaSekolah}
        </h1>
        <h4 style="margin: 0; font-size: 10pt; text-transform: uppercase; font-weight: bold;">
          ${kopSekolah.lokasi}
        </h4>
        <p style="margin: 1px 0; font-size: 9pt; font-weight: bold;">
          ${kopSekolah.legalitas}
        </p>
        
        <div style="border-top: 1.5px solid #000; margin-top: 4px; padding-top: 3px; font-size: 9pt; font-style: italic;">
          <span><em>Address :</em> ${kopSekolah.alamat}</span><br/>
          <span><em>Email:</em> <a href="mailto:${kopSekolah.email}" style="color:#000; text-decoration:underline;">${kopSekolah.email}</a> &nbsp; <em>Website:</em> <a href="${kopSekolah.website}" style="color:#000; text-decoration:underline;">${kopSekolah.website}</a></span>
        </div>
        <div style="border-bottom: 1px solid #000; margin-top: 3px;"></div>
      </div>
    `
  }

  const getExamHeaderBoxHTML = () => {
    const jumlahSoal = parseInt(formData.soalJumlah) || 40
    const estimasiMenit = jumlahSoal >= 35 ? 90 : jumlahSoal >= 20 ? 60 : 45
    const tahunPelajaran = adminForm.tahunPelajaran || '2026/2027'
    const opsiHuruf =
      selectedJenjang === 'SMK'
        ? '<strong>A, B, C, D,</strong> atau <strong>E</strong>'
        : '<strong>A, B, C,</strong> atau <strong>D</strong>'

    return `
      <div style="font-family: 'Times New Roman', serif; color: #000; margin-bottom: 10px;">
        <div style="text-align: center; font-weight: bold; font-size: 11.5pt; text-transform: uppercase; margin: 6px 0 8px 0; letter-spacing: 0.3px;">
          NASKAH SOAL ASESMEN SUMATIF / ULANGAN SEMESTER TA ${tahunPelajaran}
        </div>

        <table style="width: 100%; border-collapse: collapse; font-size: 9.5pt; margin-bottom: 8px; border: 1px solid #000;">
          <tr>
            <td style="width: 15%; border: 1px solid #000; padding: 3px 6px; font-weight: bold;">Mata Pelajaran</td>
            <td style="width: 35%; border: 1px solid #000; padding: 3px 6px;">: <strong>${formData.mapel}</strong></td>
            <td style="width: 17%; border: 1px solid #000; padding: 3px 6px; font-weight: bold;">Nama Siswa</td>
            <td style="width: 33%; border: 1px solid #000; padding: 3px 6px;">: ..................................................</td>
          </tr>
          <tr>
            <td style="border: 1px solid #000; padding: 3px 6px; font-weight: bold;">Kelas / Fase</td>
            <td style="border: 1px solid #000; padding: 3px 6px;">: ${formData.faseKelas}</td>
            <td style="border: 1px solid #000; padding: 3px 6px; font-weight: bold;">No. Peserta / NIS</td>
            <td style="border: 1px solid #000; padding: 3px 6px;">: ..................................................</td>
          </tr>
          <tr>
            <td style="border: 1px solid #000; padding: 3px 6px; font-weight: bold;">Waktu / Soal</td>
            <td style="border: 1px solid #000; padding: 3px 6px;">: ${estimasiMenit} Menit (${jumlahSoal} Butir ${formData.soalTipe})</td>
            <td style="border: 1px solid #000; padding: 3px 6px; font-weight: bold;">Hari / Tanggal</td>
            <td style="border: 1px solid #000; padding: 3px 6px;">: ..................................................</td>
          </tr>
        </table>

        <div style="border: 1px solid #000; padding: 5px 8px; font-size: 9pt; background-color: #f9f9f9; margin-bottom: 8px; line-height: 1.35;">
          <strong>Petunjuk Umum:</strong>
          <ol style="margin: 2px 0 2px 18px; padding: 0;">
            <li>Berdoalah sebelum mengerjakan soal dan tulislah identitas pada lembar jawaban yang tersedia.</li>
            <li>Periksalah kelengkapan naskah soal sebelum mulai mengerjakan serta dahulukan soal yang dianggap paling mudah.</li>
            <li>Pilihlah satu jawaban yang paling tepat dengan memberi tanda silang (<strong>X</strong>) pada huruf ${opsiHuruf} pada lembar jawaban.</li>
          </ol>
        </div>
      </div>
    `
  }

  const copyrightFooterHTML = `
    <div style="text-align: center; margin-top: 24px; padding-top: 8px; border-top: 1px solid #000; font-size: 9pt; color: #000; font-family: 'Times New Roman', serif; page-break-inside: avoid;">
      Dokumen ini dibuat secara otomatis menggunakan <strong>Aplikasi Guru AI</strong> - Created & Developed by <strong>MUZAINI AL KAHFI</strong> &copy; 2026
    </div>
  `

  const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

  const handleStartGenerate = async () => {
    setIsGenerating(true)
    setIsEditingVisual(false)
    try {
      const currentConfig = aiToolsConfig[activeTool]
      const activeSatuan = selectedJenjang === 'SMK' ? 'SMK MUNA MUSTOFA' : kopSekolah.namaSekolah
      const activeKepala = selectedJenjang === 'SMK' ? kepalaSmk : kepalaSmp

      const kelasTerpilihObj = filteredKelasList.find((k) =>
        formData.faseKelas.includes(k.nama_kelas)
      )
      const activeJurusan =
        selectedJenjang === 'SMK'
          ? kelasTerpilihObj?.jurusan || 'Desain Komunikasi Visual (DKV)'
          : null

      if (activeTool === 'kbc') {
        for (let i = 0; i < kbcDocsList.length; i++) {
          const doc = kbcDocsList[i]
          setGenerateProgress(`Memproses (${i + 1}/9) ${doc.name}...`)
          setSelectedDoc(doc.id)

          const payloadBody = {
            ...adminForm,
            ...modulForm,
            jenjang: selectedJenjang,
            jurusan: activeJurusan,
            satuanPendidikan: activeSatuan,
            namaKepala: adminForm.namaKepala || activeKepala.nama,
            nipKepala: adminForm.nipKepala || activeKepala.nuptk,
            tool: currentConfig?.title || 'Asisten Guru AI',
            activeTool,
            selectedDoc: doc.id,
            mapel: formData.mapel,
            faseKelas: formData.faseKelas,
            materiTopik: adminForm.cpPerElemen || modulForm.rumusanTp,
            spesifikData: formData,
            tanpaKisiKisi: true,
          }

          const response = await fetch('/api/gemini', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payloadBody),
          })

          const data = await response.json()
          if (!response.ok) {
            throw new Error(data.error || `HTTP Error ${response.status} pada ${doc.name}`)
          }

          if (data.result) {
            const cleanedText = formatAndCleanDocument(data.result)
            const key = `kbc_${doc.id}`
            setGeneratedResults((prev) => ({ ...prev, [key]: cleanedText }))
            setEditedHtmlMap((prev) => {
              const copy = { ...prev }
              delete copy[key]
              return copy
            })
            setEditedPlainTextMap((prev) => {
              const copy = { ...prev }
              delete copy[key]
              return copy
            })
          }

          await delay(1500)
        }
        setGenerateProgress('Selesai!')
        setSelectedDoc('cp')
      } else {
        setGenerateProgress('Menghubungkan ke Mercury AI Engine...')
        const payloadBody = {
          ...adminForm,
          jenjang: selectedJenjang,
          jurusan: activeJurusan,
          satuanPendidikan: activeSatuan,
          namaKepala: adminForm.namaKepala || activeKepala.nama,
          nipKepala: adminForm.nipKepala || activeKepala.nuptk,
          tool: currentConfig?.title || 'Asisten Guru AI',
          activeTool,
          selectedDoc: null,
          mapel: formData.mapel,
          faseKelas: formData.faseKelas,
          materiTopik: formData.materiTopik,
          tanpaKisiKisi: true,
          spesifikData: formData,
        }

        const response = await fetch('/api/gemini', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payloadBody),
        })

        const data = await response.json()
        if (!response.ok) {
          throw new Error(data.error || `HTTP Error ${response.status}`)
        }

        if (data.result) {
          const cleanedText = formatAndCleanDocument(data.result)
          setGeneratedResults((prev) => ({ ...prev, [activeTool]: cleanedText }))
          setEditedHtmlMap((prev) => {
            const copy = { ...prev }
            delete copy[activeTool]
            return copy
          })
          setEditedPlainTextMap((prev) => {
            const copy = { ...prev }
            delete copy[activeTool]
            return copy
          })
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

  const buildFormattedPrintBody = (rawInnerHtml: string) => {
    if (activeTool !== 'soal') {
      return rawInnerHtml
    }

    const marker = '[[KUNCI_JAWABAN_START]]'
    let soalPart = rawInnerHtml
    let kunciPart = ''

    if (rawInnerHtml.includes(marker)) {
      const splitArr = rawInnerHtml.split(marker)
      soalPart = splitArr[0]
      kunciPart = splitArr.slice(1).join('')
    } else {
      const kunciRegex = /(<(?:h[1-4]|hr|p|strong|b)[^>]*>[\s\S]*?KUNCI JAWABAN[\s\S]*)/i
      const match = rawInnerHtml.match(kunciRegex)
      if (match && match.index !== undefined) {
        soalPart = rawInnerHtml.slice(0, match.index)
        kunciPart = rawInnerHtml.slice(match.index)
      }
    }

    return `
      ${getExamHeaderBoxHTML()}
      <div class="exam-two-columns">
        ${soalPart}
      </div>
      ${
        kunciPart
          ? `<div class="kunci-page-break">
              ${kunciPart}
            </div>`
          : ''
      }
    `
  }

  const handlePrintPDF = () => {
    if (isEditingVisual) {
      syncVisualEditsToState()
      setIsEditingVisual(false)
    }

    const resultElement = document.getElementById('ai-document-result')
    if (!resultElement) return

    const rawContents = resultElement.innerHTML
    const formattedContents = buildFormattedPrintBody(rawContents)
    const kopHTML = pakaiKop ? getActiveKopSuratHTML() : ''

    const printWindow = window.open('', '_blank')
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Naskah Dokumen - ${kopSekolah.namaSekolah}</title>
            <style>
              @page { 
                margin: 1.2cm 1.4cm; 
                size: A4; 
              }
              body { 
                font-family: 'Times New Roman', Times, serif; 
                padding: 0; 
                margin: 0;
                line-height: 1.38; 
                color: #000; 
                font-size: 10.5pt;
              }
              h1, h2, h3, h4 { 
                color: #000; 
                margin-top: 10px; 
                margin-bottom: 5px; 
                page-break-after: avoid; 
              }
              p { 
                margin-top: 0;
                margin-bottom: 5px; 
                text-align: justify; 
              }
              .exam-two-columns {
                column-count: 2;
                -webkit-column-count: 2;
                -moz-column-count: 2;
                column-gap: 22px;
                -webkit-column-gap: 22px;
                column-rule: 1px solid #94a3b8;
                -webkit-column-rule: 1px solid #94a3b8;
                font-size: 10pt;
                line-height: 1.32;
              }
              .exam-two-columns ol {
                margin: 0;
                padding-left: 18px;
              }
              .exam-two-columns li {
                margin-bottom: 7px;
                break-inside: avoid;
                page-break-inside: avoid;
                text-align: left;
              }
              .exam-two-columns p {
                margin-bottom: 4px;
                break-inside: avoid;
                page-break-inside: avoid;
                text-align: left;
              }
              .kunci-page-break {
                page-break-before: always;
                break-before: page;
                padding-top: 8px;
              }
              table { 
                border-collapse: collapse; 
                width: 100%; 
                margin: 8px 0; 
                font-size: 10pt; 
                page-break-inside: auto; 
              }
              tr { 
                page-break-inside: avoid; 
                page-break-after: auto; 
              }
              th, td { 
                border: 1px solid #000; 
                padding: 4px 6px; 
                text-align: left; 
                vertical-align: top; 
              }
              th { 
                background-color: #f2f2f2; 
                font-weight: bold; 
                text-align: center; 
              }
              ul, ol { 
                margin-bottom: 8px; 
                padding-left: 20px; 
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
            ${kopHTML}
            ${formattedContents}
            ${copyrightFooterHTML}
          </body>
        </html>
      `)
      printWindow.document.close()
      setTimeout(() => {
        printWindow.print()
      }, 500)
    }
  }

  const handleDownloadWord = () => {
    if (isEditingVisual) {
      syncVisualEditsToState()
      setIsEditingVisual(false)
    }

    const resultElement = document.getElementById('ai-document-result')
    if (!resultElement) return

    const rawContents = resultElement.innerHTML
    const formattedContents = buildFormattedPrintBody(rawContents)
    const kopHTML = pakaiKop ? getActiveKopSuratHTML() : ''

    const header =
      "<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>Export Word</title><style>body { font-family: 'Times New Roman', serif; font-size: 10pt; line-height: 1.25; } p { margin-bottom: 3pt; } .exam-two-columns { column-count: 2; column-gap: 16pt; column-rule: 1pt solid #999; font-size: 10pt; line-height: 1.2; } .kunci-page-break { page-break-before: always; } table { border-collapse: collapse; width: 100%; } td, th { border: 1px solid #000; padding: 3pt; } table.ttd-table, table.ttd-table td { border: none !important; }</style></head><body>"
    const footer = copyrightFooterHTML + '</body></html>'
    const sourceHTML = header + kopHTML + formattedContents + footer

    const source = 'data:application/vnd.ms-word;charset=utf-8,' + encodeURIComponent(sourceHTML)
    const fileDownload = document.createElement('a')
    document.body.appendChild(fileDownload)
    fileDownload.href = source
    fileDownload.download = `Naskah_${selectedJenjang}_${formData.mapel}_${activeTool}.doc`
    fileDownload.click()
    document.body.removeChild(fileDownload)
  }

  const currentToolData = aiToolsConfig[activeTool] || aiToolsConfig['chatbot']

  const displayPreviewMarkdown = useMemo(() => {
    const raw = generatedResults[currentResultKey] || ''
    const withSeparator = raw.replace('[[KUNCI_JAWABAN_START]]', '\n\n---\n\n')
    return escapeCodeTagsForMarkdown(withSeparator)
  }, [generatedResults, currentResultKey])

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
      <div
        className={`fixed inset-0 pointer-events-none z-0 flex items-center justify-center select-none transition-opacity duration-300 ${
          isDarkMode ? 'opacity-[0.04]' : 'opacity-[0.12]'
        }`}
      >
        <img
          src="/logo-smp.jpg"
          alt="Watermark Muna Mustofa"
          className="w-[600px] h-[600px] object-contain max-w-none"
        />
      </div>

      <div className="relative z-10">
        {/* 1. SUPER-COMPACT HEADER TOPBAR */}
        <header
          className={`border-b px-3 py-1.5 flex items-center justify-between gap-2 sticky top-0 z-40 shadow-xs transition-colors duration-300 ${
            isDarkMode
              ? 'bg-slate-900/95 border-slate-800 backdrop-blur-md'
              : 'bg-slate-100/95 border-slate-300 backdrop-blur-md'
          }`}
        >
          <div className="flex items-center gap-2 shrink-0">
            <Link
              href="/"
              title="Kembali ke Dashboard"
              className={`p-1 rounded-lg transition ${
                isDarkMode
                  ? 'text-slate-400 hover:text-white'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2.5}
                  d="M10 19l-7-7m0 0l7-7m-7 7h18"
                />
              </svg>
            </Link>
            <div className="flex items-center gap-1.5">
              <img
                src="/logo-smp.jpg"
                alt="Logo"
                className="w-5 h-5 rounded border p-0.5 object-contain"
              />
              <div>
                <div className="flex items-center gap-1">
                  <h1
                    className={`font-black text-xs leading-none ${
                      isDarkMode ? 'text-white' : 'text-slate-900'
                    }`}
                  >
                    Guru AI
                  </h1>
                  <span
                    className={`text-[8px] font-black px-1.5 py-0.5 rounded uppercase ${
                      selectedJenjang === 'SMK'
                        ? 'bg-amber-500 text-slate-950'
                        : 'bg-indigo-600 text-white'
                    }`}
                  >
                    {selectedJenjang === 'SMK' ? 'SMK DKV' : 'SMP'}
                  </span>
                </div>
                <p
                  className={`text-[9px] font-bold mt-0.5 hidden sm:block ${
                    isDarkMode ? 'text-emerald-400' : 'text-emerald-800'
                  }`}
                >
                  Mercury AI Engine
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
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
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                />
              </svg>
            </button>
          </div>
        </header>

        {/* 2. SUB-NAVBAR AI TOOLS */}
        <div
          className={`border-b px-3 py-1 overflow-x-auto custom-scrollbar transition-colors duration-300 ${
            isDarkMode
              ? 'bg-slate-900/80 border-slate-800 backdrop-blur-md'
              : 'bg-slate-200/80 border-slate-300 backdrop-blur-md'
          }`}
        >
          <div className="max-w-6xl mx-auto flex items-center gap-1 min-w-max text-[10px] font-bold">
            {aiToolsNav.map((tool) => (
              <button
                key={tool.id}
                onClick={() => {
                  if (isEditingVisual) {
                    syncVisualEditsToState()
                    setIsEditingVisual(false)
                  }
                  setActiveTool(tool.id)
                }}
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
          <div
            className={`${currentToolData.bgBanner} rounded-xl p-3 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 shadow-sm relative overflow-hidden text-white border transition-all duration-300`}
          >
            <div className="space-y-1 max-w-2xl">
              <div className="inline-flex items-center gap-1 bg-amber-400 text-slate-950 text-[9px] font-black uppercase px-2 py-0.5 rounded-full shadow-xs">
                <span>{currentToolData.badge}</span>
              </div>
              <h2 className="text-sm sm:text-base font-black text-white tracking-tight leading-tight">
                {currentToolData.title}
              </h2>
              <p className="text-[11px] text-slate-100 font-medium leading-snug">
                {currentToolData.subtitle}
              </p>
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
            <div
              className={`backdrop-blur-md border rounded-xl p-2.5 transition-all shadow-xs ${
                isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-indigo-200'
              }`}
            >
              <button
                onClick={() => setShowKopAccordion(!showKopAccordion)}
                className={`w-full flex items-center justify-between text-[11px] font-extrabold transition cursor-pointer ${
                  isDarkMode
                    ? 'text-indigo-300 hover:text-indigo-200'
                    : 'text-indigo-950 hover:text-indigo-800'
                }`}
              >
                <div className="flex items-center gap-1.5 truncate">
                  <span>🏫</span>
                  <span className="truncate">
                    Kop Surat ({kopSekolah.namaSekolah}{' '}
                    {selectedJenjang === 'SMK' ? '• Gambar PNG' : ''})
                  </span>
                </div>
                <span className="shrink-0 text-[10px]">
                  {showKopAccordion ? '🔼 Tutup' : '🔽 Ubah'}
                </span>
              </button>

              {showKopAccordion &&
                (selectedJenjang === 'SMK' ? (
                  <div
                    className={`mt-2.5 pt-2.5 border-t grid grid-cols-1 md:grid-cols-2 gap-2 text-xs ${
                      isDarkMode ? 'border-slate-800' : 'border-slate-200'
                    }`}
                  >
                    <div>
                      <label
                        className={`block text-[10px] font-bold mb-0.5 ${
                          isDarkMode ? 'text-indigo-300' : 'text-slate-700'
                        }`}
                      >
                        Nama Satuan Pendidikan SMK
                      </label>
                      <input
                        type="text"
                        value={kopSekolah.namaSekolah}
                        onChange={(e) =>
                          setKopSekolah({ ...kopSekolah, namaSekolah: e.target.value })
                        }
                        className={`w-full border rounded-lg px-2.5 py-1 text-xs font-bold ${
                          isDarkMode
                            ? 'bg-slate-800 border-slate-700 text-white'
                            : 'bg-slate-50 border-slate-300 text-slate-900'
                        }`}
                      />
                    </div>
                    <div>
                      <label
                        className={`block text-[10px] font-bold mb-0.5 ${
                          isDarkMode ? 'text-indigo-300' : 'text-slate-700'
                        }`}
                      >
                        Path Gambar Kop SMK (Folder public)
                      </label>
                      <input
                        type="text"
                        value={kopSekolah.kopSmkImage}
                        onChange={(e) =>
                          setKopSekolah({ ...kopSekolah, kopSmkImage: e.target.value })
                        }
                        placeholder="/kop-smk.png"
                        className={`w-full border rounded-lg px-2.5 py-1 text-xs font-mono ${
                          isDarkMode
                            ? 'bg-slate-800 border-slate-700 text-amber-300'
                            : 'bg-slate-50 border-slate-300 text-slate-900'
                        }`}
                      />
                    </div>
                  </div>
                ) : (
                  <div
                    className={`mt-2.5 pt-2.5 border-t grid grid-cols-1 md:grid-cols-2 gap-2 text-xs ${
                      isDarkMode ? 'border-slate-800' : 'border-slate-200'
                    }`}
                  >
                    <div>
                      <label
                        className={`block text-[10px] font-bold mb-0.5 ${
                          isDarkMode ? 'text-indigo-300' : 'text-slate-700'
                        }`}
                      >
                        Nama Yayasan / Instansi
                      </label>
                      <input
                        type="text"
                        value={kopSekolah.yayasan}
                        onChange={(e) => setKopSekolah({ ...kopSekolah, yayasan: e.target.value })}
                        className={`w-full border rounded-lg px-2.5 py-1 text-xs font-medium ${
                          isDarkMode
                            ? 'bg-slate-800 border-slate-700 text-white'
                            : 'bg-slate-50 border-slate-300 text-slate-900'
                        }`}
                      />
                    </div>
                    <div>
                      <label
                        className={`block text-[10px] font-bold mb-0.5 ${
                          isDarkMode ? 'text-indigo-300' : 'text-slate-700'
                        }`}
                      >
                        Nama Satuan Pendidikan
                      </label>
                      <input
                        type="text"
                        value={kopSekolah.namaSekolah}
                        onChange={(e) =>
                          setKopSekolah({ ...kopSekolah, namaSekolah: e.target.value })
                        }
                        className={`w-full border rounded-lg px-2.5 py-1 text-xs font-bold ${
                          isDarkMode
                            ? 'bg-slate-800 border-slate-700 text-white'
                            : 'bg-slate-50 border-slate-300 text-slate-900'
                        }`}
                      />
                    </div>
                    <div>
                      <label
                        className={`block text-[10px] font-bold mb-0.5 ${
                          isDarkMode ? 'text-indigo-300' : 'text-slate-700'
                        }`}
                      >
                        NPSN &amp; Legalitas SK
                      </label>
                      <input
                        type="text"
                        value={kopSekolah.legalitas}
                        onChange={(e) =>
                          setKopSekolah({ ...kopSekolah, legalitas: e.target.value })
                        }
                        className={`w-full border rounded-lg px-2.5 py-1 text-xs font-medium ${
                          isDarkMode
                            ? 'bg-slate-800 border-slate-700 text-white'
                            : 'bg-slate-50 border-slate-300 text-slate-900'
                        }`}
                      />
                    </div>
                    <div>
                      <label
                        className={`block text-[10px] font-bold mb-0.5 ${
                          isDarkMode ? 'text-indigo-300' : 'text-slate-700'
                        }`}
                      >
                        Alamat Sekolah
                      </label>
                      <input
                        type="text"
                        value={kopSekolah.alamat}
                        onChange={(e) => setKopSekolah({ ...kopSekolah, alamat: e.target.value })}
                        className={`w-full border rounded-lg px-2.5 py-1 text-xs font-medium ${
                          isDarkMode
                            ? 'bg-slate-800 border-slate-700 text-white'
                            : 'bg-slate-50 border-slate-300 text-slate-900'
                        }`}
                      />
                    </div>
                  </div>
                ))}
            </div>
          )}

          {/* PARAMETER INPUT AI COMPACT */}
          <div
            className={`backdrop-blur-md border rounded-xl p-2.5 sm:p-3.5 space-y-2.5 shadow-xs ${
              isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-indigo-200'
            }`}
          >
            <div
              className={`flex flex-wrap items-center justify-between gap-2 border-b pb-1.5 ${
                isDarkMode ? 'border-slate-800' : 'border-slate-200'
              }`}
            >
              <h3
                className={`font-black text-xs flex items-center gap-1.5 ${
                  isDarkMode ? 'text-white' : 'text-slate-900'
                }`}
              >
                <span>⚙️</span>
                <span>Parameter Input AI</span>
              </h3>

              {/* SELECTOR JENJANG TERPADU: SMP vs SMK (DKV) */}
              <div
                className={`inline-flex p-0.5 rounded-lg border text-[10px] font-black ${
                  isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-100 border-slate-300'
                }`}
              >
                <button
                  type="button"
                  onClick={() => handleJenjangSwitch('SMP')}
                  className={`px-2.5 py-0.5 rounded-md transition cursor-pointer ${
                    selectedJenjang === 'SMP'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : isDarkMode
                      ? 'text-slate-400 hover:text-white'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  🏫 SMP (Fase D)
                </button>
                <button
                  type="button"
                  onClick={() => handleJenjangSwitch('SMK')}
                  className={`px-2.5 py-0.5 rounded-md transition cursor-pointer ${
                    selectedJenjang === 'SMK'
                      ? 'bg-amber-500 text-slate-950 shadow-xs'
                      : isDarkMode
                      ? 'text-slate-400 hover:text-white'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  🎨 SMK DKV (Fase E/F)
                </button>
              </div>
            </div>

            {activeTool !== 'kbc' && activeTool !== 'chatbot' && (
              <div className="grid grid-cols-2 gap-1.5 text-xs">
                <div>
                  <label
                    className={`block text-[10px] font-bold mb-0.5 ${
                      isDarkMode ? 'text-indigo-300' : 'text-slate-700'
                    }`}
                  >
                    Mata Pelajaran ({selectedJenjang})
                  </label>
                  {filteredMapelList.length > 0 ? (
                    <select
                      value={formData.mapel}
                      onChange={(e) => handleMapelChange(e.target.value)}
                      className={`w-full border rounded-lg px-2 py-1 text-xs font-bold cursor-pointer focus:outline-none ${
                        isDarkMode
                          ? 'bg-slate-800 border-slate-700 text-white'
                          : 'bg-slate-50 border-slate-300 text-slate-900'
                      }`}
                    >
                      {filteredMapelList.map((m) => (
                        <option key={m.id} value={m.nama_mapel}>
                          {m.nama_mapel} {m.kode_mapel ? `(${m.kode_mapel})` : ''}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={formData.mapel}
                      onChange={(e) => handleMapelChange(e.target.value)}
                      placeholder={
                        selectedJenjang === 'SMK' ? 'Contoh: Dasar-Dasar DKV' : 'Contoh: IPA'
                      }
                      className={`w-full border rounded-lg px-2 py-1 text-xs font-medium focus:outline-none ${
                        isDarkMode
                          ? 'bg-slate-800 border-slate-700 text-white'
                          : 'bg-slate-50 border-slate-300 text-slate-900'
                      }`}
                    />
                  )}
                </div>

                <div>
                  <label
                    className={`block text-[10px] font-bold mb-0.5 ${
                      isDarkMode ? 'text-indigo-300' : 'text-slate-700'
                    }`}
                  >
                    Fase / Kelas ({selectedJenjang})
                  </label>
                  {filteredKelasList.length > 0 ? (
                    <select
                      value={formData.faseKelas}
                      onChange={(e) => handleFaseKelasChange(e.target.value)}
                      className={`w-full border rounded-lg px-2 py-1 text-xs font-bold cursor-pointer focus:outline-none ${
                        isDarkMode
                          ? 'bg-slate-800 border-slate-700 text-white'
                          : 'bg-slate-50 border-slate-300 text-slate-900'
                      }`}
                    >
                      {filteredKelasList.map((k) => {
                        const label = getFaseLabel(selectedJenjang, k.nama_kelas)
                        return (
                          <option key={k.id} value={label}>
                            {label}
                          </option>
                        )
                      })}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={formData.faseKelas}
                      onChange={(e) => handleFaseKelasChange(e.target.value)}
                      placeholder={
                        selectedJenjang === 'SMK'
                          ? 'Contoh: Fase E / X DKV'
                          : 'Contoh: Fase D / Kelas VII A'
                      }
                      className={`w-full border rounded-lg px-2 py-1 text-xs font-medium focus:outline-none ${
                        isDarkMode
                          ? 'bg-slate-800 border-slate-700 text-white'
                          : 'bg-slate-50 border-slate-300 text-slate-900'
                      }`}
                    />
                  )}
                </div>
              </div>
            )}

            {/* 1. KBC FORM */}
            {activeTool === 'kbc' && (
              <div className="space-y-2.5">
                <div
                  className={`grid grid-cols-2 p-0.5 rounded-lg border text-[11px] font-extrabold ${
                    isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-100 border-slate-300'
                  }`}
                >
                  <button
                    onClick={() => setActiveTabSection('admin')}
                    className={`py-1 rounded-md transition cursor-pointer ${
                      activeTabSection === 'admin'
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : isDarkMode
                        ? 'text-slate-400'
                        : 'text-slate-700'
                    }`}
                  >
                    1. Identitas &amp; Admin
                  </button>
                  <button
                    onClick={() => setActiveTabSection('modul')}
                    className={`py-1 rounded-md transition cursor-pointer ${
                      activeTabSection === 'modul'
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : isDarkMode
                        ? 'text-slate-400'
                        : 'text-slate-700'
                    }`}
                  >
                    2. Modul &amp; Skenario
                  </button>
                </div>

                {activeTabSection === 'admin' ? (
                  <div className="space-y-2 text-xs">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
                      <div>
                        <label
                          className={`block text-[10px] font-bold mb-0.5 ${
                            isDarkMode ? 'text-indigo-300' : 'text-slate-700'
                          }`}
                        >
                          Satuan Pendidikan
                        </label>
                        <input
                          type="text"
                          value={adminForm.satuanPendidikan}
                          onChange={(e) =>
                            setAdminForm({ ...adminForm, satuanPendidikan: e.target.value })
                          }
                          className={`w-full border rounded-lg px-2 py-1 text-xs font-medium ${
                            isDarkMode
                              ? 'bg-slate-800 border-slate-700 text-white'
                              : 'bg-slate-50 border-slate-300 text-slate-900'
                          }`}
                        />
                      </div>
                      <div>
                        <label
                          className={`block text-[10px] font-bold mb-0.5 ${
                            isDarkMode ? 'text-indigo-300' : 'text-slate-700'
                          }`}
                        >
                          Mata Pelajaran
                        </label>
                        {filteredMapelList.length > 0 ? (
                          <select
                            value={adminForm.mapel}
                            onChange={(e) => handleMapelChange(e.target.value)}
                            className={`w-full border rounded-lg px-2 py-1 text-xs font-bold cursor-pointer ${
                              isDarkMode
                                ? 'bg-slate-800 border-slate-700 text-white'
                                : 'bg-slate-50 border-slate-300 text-slate-900'
                            }`}
                          >
                            {filteredMapelList.map((m) => (
                              <option key={m.id} value={m.nama_mapel}>
                                {m.nama_mapel}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type="text"
                            value={adminForm.mapel}
                            onChange={(e) => handleMapelChange(e.target.value)}
                            className={`w-full border rounded-lg px-2 py-1 text-xs font-medium ${
                              isDarkMode
                                ? 'bg-slate-800 border-slate-700 text-white'
                                : 'bg-slate-50 border-slate-300 text-slate-900'
                            }`}
                          />
                        )}
                      </div>
                      <div>
                        <label
                          className={`block text-[10px] font-bold mb-0.5 ${
                            isDarkMode ? 'text-indigo-300' : 'text-slate-700'
                          }`}
                        >
                          Fase / Kelas
                        </label>
                        {filteredKelasList.length > 0 ? (
                          <select
                            value={adminForm.faseKelas}
                            onChange={(e) => handleFaseKelasChange(e.target.value)}
                            className={`w-full border rounded-lg px-2 py-1 text-xs font-bold cursor-pointer ${
                              isDarkMode
                                ? 'bg-slate-800 border-slate-700 text-white'
                                : 'bg-slate-50 border-slate-300 text-slate-900'
                            }`}
                          >
                            {filteredKelasList.map((k) => {
                              const label = getFaseLabel(selectedJenjang, k.nama_kelas)
                              return (
                                <option key={k.id} value={label}>
                                  {label}
                                </option>
                              )
                            })}
                          </select>
                        ) : (
                          <input
                            type="text"
                            value={adminForm.faseKelas}
                            onChange={(e) => handleFaseKelasChange(e.target.value)}
                            className={`w-full border rounded-lg px-2 py-1 text-xs font-medium ${
                              isDarkMode
                                ? 'bg-slate-800 border-slate-700 text-white'
                                : 'bg-slate-50 border-slate-300 text-slate-900'
                            }`}
                          />
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-1.5">
                      <div>
                        <label
                          className={`block text-[10px] font-bold mb-0.5 ${
                            isDarkMode ? 'text-indigo-300' : 'text-slate-700'
                          }`}
                        >
                          Guru Pengampu
                        </label>
                        <input
                          type="text"
                          value={adminForm.namaGuru}
                          onChange={(e) => setAdminForm({ ...adminForm, namaGuru: e.target.value })}
                          className={`w-full border rounded-lg px-2 py-1 text-xs font-bold ${
                            isDarkMode
                              ? 'bg-slate-800 border-slate-700 text-white'
                              : 'bg-slate-50 border-slate-300 text-slate-900'
                          }`}
                        />
                      </div>
                      <div>
                        <label
                          className={`block text-[10px] font-bold mb-0.5 ${
                            isDarkMode ? 'text-indigo-300' : 'text-slate-700'
                          }`}
                        >
                          Kepala Sekolah ({selectedJenjang})
                        </label>
                        <input
                          type="text"
                          value={adminForm.namaKepala}
                          onChange={(e) =>
                            setAdminForm({ ...adminForm, namaKepala: e.target.value })
                          }
                          className={`w-full border rounded-lg px-2 py-1 text-xs font-bold ${
                            isDarkMode
                              ? 'bg-slate-800 border-slate-700 text-white'
                              : 'bg-slate-50 border-slate-300 text-slate-900'
                          }`}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-1.5">
                      <div>
                        <label
                          className={`block text-[10px] font-bold mb-0.5 ${
                            isDarkMode ? 'text-indigo-300' : 'text-slate-700'
                          }`}
                        >
                          NIP / NUPTK Guru
                        </label>
                        <input
                          type="text"
                          value={adminForm.nipGuru}
                          onChange={(e) => setAdminForm({ ...adminForm, nipGuru: e.target.value })}
                          className={`w-full border rounded-lg px-2 py-1 text-xs font-mono ${
                            isDarkMode
                              ? 'bg-slate-800 border-slate-700 text-slate-200'
                              : 'bg-slate-50 border-slate-300 text-slate-800'
                          }`}
                        />
                      </div>
                      <div>
                        <label
                          className={`block text-[10px] font-bold mb-0.5 ${
                            isDarkMode ? 'text-indigo-300' : 'text-slate-700'
                          }`}
                        >
                          NUPTK Kepala ({selectedJenjang})
                        </label>
                        <input
                          type="text"
                          value={adminForm.nipKepala}
                          onChange={(e) =>
                            setAdminForm({ ...adminForm, nipKepala: e.target.value })
                          }
                          className={`w-full border rounded-lg px-2 py-1 text-xs font-mono ${
                            isDarkMode
                              ? 'bg-slate-800 border-slate-700 text-slate-200'
                              : 'bg-slate-50 border-slate-300 text-slate-800'
                          }`}
                        />
                      </div>
                    </div>

                    <textarea
                      rows={2}
                      placeholder="Capaian Pembelajaran (CP)..."
                      value={adminForm.cpPerElemen}
                      onChange={(e) => setAdminForm({ ...adminForm, cpPerElemen: e.target.value })}
                      className={`w-full border rounded-lg p-2 text-xs font-medium resize-none ${
                        isDarkMode
                          ? 'bg-slate-800 border-slate-700 text-white'
                          : 'bg-slate-50 border-slate-300 text-slate-900'
                      }`}
                    />
                  </div>
                ) : (
                  <div className="space-y-2 text-xs">
                    <div className="grid grid-cols-2 gap-1.5">
                      <input
                        type="text"
                        placeholder="Kode TP"
                        value={modulForm.kodeTp}
                        onChange={(e) => setModulForm({ ...modulForm, kodeTp: e.target.value })}
                        className={`border rounded-lg px-2 py-1 text-xs font-bold ${
                          isDarkMode
                            ? 'bg-slate-800 border-slate-700 text-indigo-300'
                            : 'bg-slate-50 border-slate-300 text-indigo-900'
                        }`}
                      />
                      <select
                        value={modulForm.modelPembelajaran}
                        onChange={(e) =>
                          setModulForm({ ...modulForm, modelPembelajaran: e.target.value })
                        }
                        className={`border rounded-lg px-2 py-1 text-xs font-bold cursor-pointer ${
                          isDarkMode
                            ? 'bg-slate-800 border-slate-700 text-white'
                            : 'bg-slate-50 border-slate-300 text-slate-900'
                        }`}
                      >
                        <option>Problem Based Learning (PBL)</option>
                        <option>Discovery Learning</option>
                        <option>Project Based Learning</option>
                      </select>
                    </div>
                    <textarea
                      rows={2}
                      placeholder="Rumusan Tujuan Pembelajaran..."
                      value={modulForm.rumusanTp}
                      onChange={(e) => setModulForm({ ...modulForm, rumusanTp: e.target.value })}
                      className={`w-full border rounded-lg p-2 text-xs font-medium resize-none ${
                        isDarkMode
                          ? 'bg-slate-800 border-slate-700 text-white'
                          : 'bg-slate-50 border-slate-300 text-slate-900'
                      }`}
                    />
                  </div>
                )}

                <div className={`pt-2 border-t ${isDarkMode ? 'border-slate-800' : 'border-slate-200'}`}>
                  <span
                    className={`text-[10px] font-extrabold mb-1.5 block ${
                      isDarkMode ? 'text-indigo-300' : 'text-slate-700'
                    }`}
                  >
                    Pilih Dokumen Target (Klik untuk melihat hasil):
                  </span>
                  <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-9 gap-1">
                    {kbcDocsList.map((doc) => (
                      <button
                        key={doc.id}
                        onClick={() => {
                          if (isEditingVisual) {
                            syncVisualEditsToState()
                            setIsEditingVisual(false)
                          }
                          setSelectedDoc(doc.id)
                        }}
                        className={`p-1.5 rounded-lg border text-[10px] flex flex-col items-center gap-0.5 cursor-pointer ${
                          selectedDoc === doc.id
                            ? 'bg-indigo-600 text-white font-bold border-indigo-700 shadow-xs'
                            : isDarkMode
                            ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                            : 'bg-slate-50 border-slate-300 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
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
                  <label
                    className={`block text-[10px] font-bold mb-0.5 ${
                      isDarkMode ? 'text-indigo-300' : 'text-slate-700'
                    }`}
                  >
                    Jenis Dokumen Perangkat
                  </label>
                  <select
                    value={formData.jenisPerangkat}
                    onChange={(e) => setFormData({ ...formData, jenisPerangkat: e.target.value })}
                    className={`w-full border rounded-lg px-2 py-1 text-xs font-bold cursor-pointer ${
                      isDarkMode
                        ? 'bg-slate-800 border-slate-700 text-white'
                        : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  >
                    <option>Modul Ajar / RPP Plus</option>
                    <option>Alur Tujuan Pembelajaran (ATP)</option>
                    <option>Program Tahunan (Prota)</option>
                    <option>Program Semester (Prosem)</option>
                    <option>Silabus Singkat</option>
                  </select>
                </div>
                <div>
                  <label
                    className={`block text-[10px] font-bold mb-0.5 ${
                      isDarkMode ? 'text-indigo-300' : 'text-slate-700'
                    }`}
                  >
                    Materi Pokok / Deskripsi Singkat
                  </label>
                  <textarea
                    rows={2}
                    value={formData.materiTopik}
                    onChange={(e) => setFormData({ ...formData, materiTopik: e.target.value })}
                    placeholder={
                      selectedJenjang === 'SMK'
                        ? 'Contoh: Prinsip Tata Letak & Tipografi dalam Desain Poster...'
                        : 'Contoh: Pertumbuhan dan Perkembangan Makhluk Hidup...'
                    }
                    className={`w-full border rounded-lg p-2 text-xs font-medium resize-none ${
                      isDarkMode
                        ? 'bg-slate-800 border-slate-700 text-white'
                        : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  />
                </div>
              </div>
            )}

            {/* 3. DEEP LEARNING FORM */}
            {activeTool === 'deep-learning' && (
              <div className="space-y-2 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
                  <div>
                    <label
                      className={`block text-[10px] font-bold mb-0.5 ${
                        isDarkMode ? 'text-indigo-300' : 'text-slate-700'
                      }`}
                    >
                      Pilar Utama Skenario
                    </label>
                    <select
                      value={formData.dlPilar}
                      onChange={(e) => setFormData({ ...formData, dlPilar: e.target.value })}
                      className={`w-full border rounded-lg px-2 py-1 text-xs font-bold cursor-pointer ${
                        isDarkMode
                          ? 'bg-slate-800 border-slate-700 text-indigo-300'
                          : 'bg-slate-50 border-slate-300 text-indigo-900'
                      }`}
                    >
                      <option>Mindful Learning (Kesadaran &amp; Fokus)</option>
                      <option>Meaningful Learning (Makna &amp; Kontekstual)</option>
                      <option>Joyful Learning (Eksplorasi Menyenangkan)</option>
                    </select>
                  </div>
                  <div>
                    <label
                      className={`block text-[10px] font-bold mb-0.5 ${
                        isDarkMode ? 'text-indigo-300' : 'text-slate-700'
                      }`}
                    >
                      Strategi Kegiatan
                    </label>
                    <input
                      type="text"
                      value={formData.dlStrategi}
                      onChange={(e) => setFormData({ ...formData, dlStrategi: e.target.value })}
                      placeholder="Diskusi &amp; Eksperimen"
                      className={`w-full border rounded-lg px-2 py-1 text-xs font-medium ${
                        isDarkMode
                          ? 'bg-slate-800 border-slate-700 text-white'
                          : 'bg-slate-50 border-slate-300 text-slate-900'
                      }`}
                    />
                  </div>
                  <div>
                    <label
                      className={`block text-[10px] font-bold mb-0.5 ${
                        isDarkMode ? 'text-indigo-300' : 'text-slate-700'
                      }`}
                    >
                      Alokasi Waktu
                    </label>
                    <input
                      type="text"
                      value={formData.dlAlokasi}
                      onChange={(e) => setFormData({ ...formData, dlAlokasi: e.target.value })}
                      placeholder="Contoh: 3 Pertemuan (6 JP)"
                      className={`w-full border rounded-lg px-2 py-1 text-xs font-medium ${
                        isDarkMode
                          ? 'bg-slate-800 border-slate-700 text-white'
                          : 'bg-slate-50 border-slate-300 text-slate-900'
                      }`}
                    />
                  </div>
                </div>
                <div>
                  <label
                    className={`block text-[10px] font-bold mb-0.5 ${
                      isDarkMode ? 'text-indigo-300' : 'text-slate-700'
                    }`}
                  >
                    Topik Bahasan Skenario
                  </label>
                  <textarea
                    rows={2}
                    value={formData.materiTopik}
                    onChange={(e) => setFormData({ ...formData, materiTopik: e.target.value })}
                    placeholder="Contoh: Pertumbuhan dan Perkembangan Makhluk Hidup..."
                    className={`w-full border rounded-lg p-2 text-xs font-medium resize-none ${
                      isDarkMode
                        ? 'bg-slate-800 border-slate-700 text-white'
                        : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  />
                </div>
              </div>
            )}

            {/* 4. MODUL KOKURIKULER P5 / PPRA */}
            {activeTool === 'kokurikuler' && (
              <div className="space-y-2 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  <div>
                    <label
                      className={`block text-[10px] font-bold mb-0.5 ${
                        isDarkMode ? 'text-indigo-300' : 'text-slate-700'
                      }`}
                    >
                      Tema Utama P5 / PPRA
                    </label>
                    <select
                      value={formData.kokuTema}
                      onChange={(e) => setFormData({ ...formData, kokuTema: e.target.value })}
                      className={`w-full border rounded-lg px-2 py-1 text-xs font-bold cursor-pointer ${
                        isDarkMode
                          ? 'bg-slate-800 border-slate-700 text-indigo-300'
                          : 'bg-slate-50 border-slate-300 text-indigo-900'
                      }`}
                    >
                      <option>Kearifan Lokal</option>
                      <option>Gaya Hidup Berkelanjutan</option>
                      <option>Bhinneka Tunggal Ika</option>
                      <option>Kewirausahaan</option>
                      <option>Bangunlah Jiwa dan Raganya</option>
                    </select>
                  </div>
                  <div>
                    <label
                      className={`block text-[10px] font-bold mb-0.5 ${
                        isDarkMode ? 'text-indigo-300' : 'text-slate-700'
                      }`}
                    >
                      Target Dimensi Profil Pelajar
                    </label>
                    <input
                      type="text"
                      value={formData.kokuDimensi}
                      onChange={(e) => setFormData({ ...formData, kokuDimensi: e.target.value })}
                      placeholder="Contoh: Bernalar Kritis &amp; Kreatif"
                      className={`w-full border rounded-lg px-2 py-1 text-xs font-medium ${
                        isDarkMode
                          ? 'bg-slate-800 border-slate-700 text-white'
                          : 'bg-slate-50 border-slate-300 text-slate-900'
                      }`}
                    />
                  </div>
                </div>
                <div>
                  <label
                    className={`block text-[10px] font-bold mb-0.5 ${
                      isDarkMode ? 'text-indigo-300' : 'text-slate-700'
                    }`}
                  >
                    Judul Spesifik Projek (Opsional)
                  </label>
                  <input
                    type="text"
                    value={formData.materiTopik}
                    onChange={(e) => setFormData({ ...formData, materiTopik: e.target.value })}
                    placeholder="Contoh: Membuat ecobrick dari sampah plastik..."
                    className={`w-full border rounded-lg px-2.5 py-1.5 text-xs font-medium ${
                      isDarkMode
                        ? 'bg-slate-800 border-slate-700 text-white'
                        : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  />
                </div>
              </div>
            )}

            {/* 5. ASISTEN GURU CHATBOT */}
            {activeTool === 'chatbot' && (
              <div className="space-y-2 text-xs">
                <div
                  className={`border p-2 rounded-lg flex items-start gap-2 ${
                    isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-indigo-50/70 border-indigo-200'
                  }`}
                >
                  <span className="text-sm">💬</span>
                  <p
                    className={`text-[11px] font-medium leading-snug ${
                      isDarkMode ? 'text-indigo-300' : 'text-indigo-950'
                    }`}
                  >
                    Konsultasikan strategi mengajar (
                    {selectedJenjang === 'SMK' ? 'SMK DKV' : 'SMP'}), penanganan siswa, ide pembuka
                    kelas, atau narasi rapor siswa.
                  </p>
                </div>
                <div>
                  <textarea
                    rows={3}
                    value={formData.materiTopik}
                    onChange={(e) => setFormData({ ...formData, materiTopik: e.target.value })}
                    placeholder="Ketik pertanyaan atau studi kasus guru di sini..."
                    className={`w-full border rounded-lg p-2.5 focus:outline-none text-xs leading-relaxed font-medium resize-none ${
                      isDarkMode
                        ? 'bg-slate-800 border-slate-700 text-white'
                        : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  />
                </div>
              </div>
            )}

            {/* 6. GENERATOR LKPD */}
            {activeTool === 'lkpd' && (
              <div className="space-y-2 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  <div>
                    <label
                      className={`block text-[10px] font-bold mb-0.5 ${
                        isDarkMode ? 'text-indigo-300' : 'text-slate-700'
                      }`}
                    >
                      Jenis Aktivitas LKPD
                    </label>
                    <select
                      value={formData.lkpdAktivitas}
                      onChange={(e) => setFormData({ ...formData, lkpdAktivitas: e.target.value })}
                      className={`w-full border rounded-lg px-2 py-1 text-xs font-bold cursor-pointer ${
                        isDarkMode
                          ? 'bg-slate-800 border-slate-700 text-white'
                          : 'bg-slate-50 border-slate-300 text-slate-900'
                      }`}
                    >
                      <option>Studi Kasus &amp; Pemecahan Masalah</option>
                      <option>Eksperimen / Pengamatan Langsung</option>
                      <option>Diskusi Kelompok &amp; Presentasi</option>
                      <option>Projek Mini Individu</option>
                    </select>
                  </div>
                  <div className="flex items-center pt-1 sm:pt-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.lkpdHots}
                        onChange={(e) => setFormData({ ...formData, lkpdHots: e.target.checked })}
                        className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-600 cursor-pointer"
                      />
                      <span
                        className={`text-[11px] font-extrabold ${
                          isDarkMode ? 'text-white' : 'text-indigo-950'
                        }`}
                      >
                        Pendekatan HOTS &amp; Konteks Lokal
                      </span>
                    </label>
                  </div>
                </div>
                <div>
                  <label
                    className={`block text-[10px] font-bold mb-0.5 ${
                      isDarkMode ? 'text-indigo-300' : 'text-slate-700'
                    }`}
                  >
                    Materi Pokok LKPD
                  </label>
                  <input
                    type="text"
                    value={formData.materiTopik}
                    onChange={(e) => setFormData({ ...formData, materiTopik: e.target.value })}
                    className={`w-full border rounded-lg px-2.5 py-1.5 text-xs font-medium ${
                      isDarkMode
                        ? 'bg-slate-800 border-slate-700 text-white'
                        : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  />
                </div>
              </div>
            )}

            {/* 7. BANK SOAL & UJIAN */}
            {activeTool === 'soal' && (
              <div className="space-y-2 text-xs">
                {selectedJenjang === 'SMK' && (
                  <div
                    className={`px-2.5 py-1.5 rounded-lg border text-[10px] font-bold flex items-center gap-1.5 ${
                      isDarkMode
                        ? 'bg-amber-950/40 border-amber-800 text-amber-300'
                        : 'bg-amber-50 border-amber-300 text-amber-900'
                    }`}
                  >
                    <span>🎨</span>
                    <span>
                      Mode SMK Jurusan DKV Aktif — AI otomatis menyesuaikan studi kasus desain
                      visual, teknis produksi media, &amp; client brief.
                    </span>
                  </div>
                )}

                <div className="grid grid-cols-3 gap-1.5">
                  <div>
                    <label
                      className={`block text-[10px] font-bold mb-0.5 ${
                        isDarkMode ? 'text-indigo-300' : 'text-slate-700'
                      }`}
                    >
                      Jumlah
                    </label>
                    <input
                      type="number"
                      value={formData.soalJumlah}
                      onChange={(e) => setFormData({ ...formData, soalJumlah: e.target.value })}
                      className={`w-full border rounded-lg px-2 py-1 text-xs font-extrabold text-center ${
                        isDarkMode
                          ? 'bg-slate-800 border-slate-700 text-indigo-300'
                          : 'bg-slate-50 border-slate-300 text-indigo-900'
                      }`}
                    />
                  </div>
                  <div>
                    <label
                      className={`block text-[10px] font-bold mb-0.5 ${
                        isDarkMode ? 'text-indigo-300' : 'text-slate-700'
                      }`}
                    >
                      Bentuk
                    </label>
                    <select
                      value={formData.soalTipe}
                      onChange={(e) => setFormData({ ...formData, soalTipe: e.target.value })}
                      className={`w-full border rounded-lg px-1.5 py-1 text-xs font-bold cursor-pointer ${
                        isDarkMode
                          ? 'bg-slate-800 border-slate-700 text-white'
                          : 'bg-slate-50 border-slate-300 text-slate-900'
                      }`}
                    >
                      <option>Pilihan Ganda</option>
                      <option>Uraian / Essay</option>
                      <option>Campuran (PG &amp; Uraian)</option>
                    </select>
                  </div>
                  <div>
                    <label
                      className={`block text-[10px] font-bold mb-0.5 ${
                        isDarkMode ? 'text-indigo-300' : 'text-slate-700'
                      }`}
                    >
                      Level
                    </label>
                    <select
                      value={formData.soalLevel}
                      onChange={(e) => setFormData({ ...formData, soalLevel: e.target.value })}
                      className={`w-full border rounded-lg px-1.5 py-1 text-xs font-bold cursor-pointer ${
                        isDarkMode
                          ? 'bg-slate-800 border-slate-700 text-white'
                          : 'bg-slate-50 border-slate-300 text-slate-900'
                      }`}
                    >
                      <option>HOTS (C4-C6)</option>
                      <option>MOTS (C2-C3)</option>
                      <option>Campuran (LOTS, MOTS, HOTS)</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label
                    className={`block text-[10px] font-bold mb-0.5 ${
                      isDarkMode ? 'text-indigo-300' : 'text-slate-700'
                    }`}
                  >
                    Topik Ujian / Indikator Materi
                  </label>
                  <textarea
                    rows={2}
                    value={formData.materiTopik}
                    onChange={(e) => setFormData({ ...formData, materiTopik: e.target.value })}
                    placeholder={
                      selectedJenjang === 'SMK'
                        ? 'Contoh: Komposisi fotografi, teori warna CMYK vs RGB, atau brief desain logo UMKM...'
                        : 'Contoh: Sel dan mikroskop, sel tumbuhan dan sel hewan, spesialisasi sel...'
                    }
                    className={`w-full border rounded-lg p-2 text-xs font-medium resize-none ${
                      isDarkMode
                        ? 'bg-slate-800 border-slate-700 text-white'
                        : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  />
                </div>
              </div>
            )}

            {/* 8. MULTI TOOL */}
            {activeTool === 'multi' && (
              <div className="space-y-2 text-xs">
                <label
                  className={`block text-[10px] font-extrabold mb-1 ${
                    isDarkMode ? 'text-white' : 'text-slate-700'
                  }`}
                >
                  Pilih Kebutuhan Cepat:
                </label>
                <div className="flex flex-wrap gap-1">
                  {multiSubToolsList.map((sub) => (
                    <button
                      key={sub}
                      onClick={() => setFormData({ ...formData, multiSubTool: sub })}
                      className={`px-2.5 py-1 rounded-full border transition text-[10px] font-bold cursor-pointer ${
                        formData.multiSubTool === sub
                          ? 'bg-indigo-600 text-white border-indigo-700 shadow-xs'
                          : isDarkMode
                          ? 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                          : 'bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100'
                      }`}
                    >
                      {sub}
                    </button>
                  ))}
                </div>
                <div>
                  <label
                    className={`block text-[10px] font-bold mb-0.5 ${
                      isDarkMode ? 'text-indigo-300' : 'text-slate-700'
                    }`}
                  >
                    Catatan/Konteks Spesifik
                  </label>
                  <input
                    type="text"
                    value={formData.materiTopik}
                    onChange={(e) => setFormData({ ...formData, materiTopik: e.target.value })}
                    placeholder="Ketik rincian tambahan di sini (Opsional)..."
                    className={`w-full border rounded-lg px-2.5 py-1.5 text-xs font-medium ${
                      isDarkMode
                        ? 'bg-slate-800 border-slate-700 text-white'
                        : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  />
                </div>
              </div>
            )}
          </div>

          {/* BANK SOAL SAYA — MUAT & LANJUTKAN EDIT */}
          {activeTool === 'soal' && (
            <div
              className={`backdrop-blur-md border rounded-xl p-3 sm:p-4 shadow-xs ${
                isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-indigo-200'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <button
                  onClick={() => setShowBankList(!showBankList)}
                  className="flex items-center gap-1.5 text-left cursor-pointer"
                >
                  <span>🗂️</span>
                  <span
                    className={`font-black text-xs uppercase ${
                      isDarkMode ? 'text-white' : 'text-slate-900'
                    }`}
                  >
                    Bank Soal Saya
                  </span>
                  <span className="text-[10px] text-slate-400">
                    ({filteredSavedBankSoal.length})
                  </span>
                </button>
                <button
                  onClick={fetchSavedBankSoal}
                  className={`text-[10px] font-bold px-2 py-1 rounded-lg border cursor-pointer ${
                    isDarkMode
                      ? 'bg-slate-800 border-slate-700 text-indigo-300'
                      : 'bg-slate-50 border-slate-300 text-indigo-950'
                  }`}
                >
                  ⟳ Muat Ulang
                </button>
              </div>

              {showBankList && (
                <div className="mt-2 space-y-2">
                  {bankSoalLoading ? (
                    <p className="text-[11px] text-slate-400 animate-pulse">
                      Memuat daftar paket soal...
                    </p>
                  ) : filteredSavedBankSoal.length === 0 ? (
                    <div className="space-y-1.5">
                      <p className="text-[11px] text-slate-400">
                        Belum ada paket soal{' '}
                        {selectedJenjang === 'SMK' ? 'SMK' : 'SMP'} tersimpan atas nama akun Anda.
                        Hasil generate yang Anda simpan akan muncul di sini sehingga bisa dimuat
                        kembali &amp; diedit.
                      </p>
                      {(savedBankSoal.some((s) => s.jenjang?.toUpperCase() === 'SMK') &&
                        selectedJenjang !== 'SMK') ||
                      (savedBankSoal.some((s) => s.jenjang?.toUpperCase() !== 'SMK') &&
                        selectedJenjang === 'SMK') ? (
                        <p className="text-[10px] font-bold text-amber-500">
                          💡 Anda punya paket{' '}
                          {selectedJenjang === 'SMK' ? 'SMP (klik 🏫 SMP)' : 'SMK (klik 🎨 SMK DKV)'}{' '}
                          — gunakan toggle jenjang di atas untuk menampilkannya.
                        </p>
                      ) : null}
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 gap-1.5">
                        <select
                          value={bankFilterMapel}
                          onChange={(e) => setBankFilterMapel(e.target.value)}
                          className={`w-full border rounded-lg px-1.5 py-1 text-[10px] font-bold cursor-pointer ${
                            isDarkMode
                              ? 'bg-slate-800 border-slate-700 text-white'
                              : 'bg-slate-50 border-slate-300 text-slate-900'
                          }`}
                        >
                          <option value="all">Semua Mapel</option>
                          {bankMapelOptions.map((m) => (
                            <option key={m} value={m}>
                              {m}
                            </option>
                          ))}
                        </select>
                        <select
                          value={bankFilterKelas}
                          onChange={(e) => setBankFilterKelas(e.target.value)}
                          className={`w-full border rounded-lg px-1.5 py-1 text-[10px] font-bold cursor-pointer ${
                            isDarkMode
                              ? 'bg-slate-800 border-slate-700 text-white'
                              : 'bg-slate-50 border-slate-300 text-slate-900'
                          }`}
                        >
                          <option value="all">Semua Kelas</option>
                          {bankKelasOptions.map((k) => (
                            <option key={k} value={k}>
                              {k}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                        {filteredSavedBankSoal.map((s) => (
                          <div
                            key={s.id}
                            className={`flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg border text-xs ${
                              editingBankSoalId === s.id
                                ? 'border-emerald-500 bg-emerald-500/10'
                                : isDarkMode
                                  ? 'border-slate-700 bg-slate-800/60'
                                  : 'border-slate-200 bg-slate-50'
                            }`}
                          >
                            <div className="min-w-0">
                              <p className="font-extrabold truncate">
                                {s.mapel} — {s.fase_kelas}
                              </p>
                              <p className="text-[10px] text-slate-400 truncate">
                                {s.jumlah_soal} butir {s.bentuk_soal} •{' '}
                                {formatTanggal(s.created_at)}
                              </p>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                onClick={() => handleLoadSavedSoal(s)}
                                className="text-[10px] font-bold px-2 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer"
                              >
                                {editingBankSoalId === s.id ? '✓ Dimuat' : 'Muat & Edit'}
                              </button>
                              <button
                                onClick={() => handleDeleteSavedSoal(s)}
                                title="Hapus paket"
                                className="text-[10px] font-bold px-2 py-1 rounded-lg border hover:bg-rose-500 hover:text-white cursor-pointer"
                              >
                                🗑️
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {/* HASIL OUTPUT AI DENGAN LIVE VISUAL PREVIEW & DIRECT CLICK-TO-EDIT */}
          <div
            className={`backdrop-blur-md border rounded-xl p-2.5 sm:p-4 space-y-3 min-h-[260px] shadow-xs ${
              isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-indigo-200'
            }`}
          >
            <div
              className={`flex flex-col sm:flex-row items-start sm:items-center justify-between border-b pb-2.5 gap-2 ${
                isDarkMode ? 'border-slate-800' : 'border-slate-200'
              }`}
            >
              <div className="flex items-center gap-1.5">
                <span className="text-indigo-500 text-sm">✨</span>
                <h4
                  className={`font-black text-xs uppercase ${
                    isDarkMode ? 'text-white' : 'text-slate-900'
                  }`}
                >
                  Hasil - {currentToolData.title} ({selectedJenjang})
                </h4>
                {editedPlainTextMap[currentResultKey] && !isEditingVisual && (
                  <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-500 border border-emerald-500/30">
                    ✓ Diedit
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto">
                {activeTool !== 'chatbot' && (
                  <label
                    className={`flex items-center gap-1.5 text-[10px] font-bold cursor-pointer px-2 py-1 rounded-lg border shadow-xs ${
                      isDarkMode
                        ? 'bg-slate-800 border-slate-700 text-indigo-300'
                        : 'bg-slate-50 border-slate-300 text-indigo-950'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={pakaiKop}
                      onChange={(e) => setPakaiKop(e.target.checked)}
                      className="w-3.5 h-3.5 rounded text-indigo-600 border-slate-300 focus:ring-indigo-600 cursor-pointer"
                    />
                    <span>Kop {selectedJenjang}</span>
                  </label>
                )}

                {generatedResults[currentResultKey] && (
                  <button
                    onClick={handleToggleVisualEdit}
                    className={`flex-1 sm:flex-none px-2.5 py-1 rounded-lg text-[10px] font-extrabold transition shadow-xs flex items-center justify-center gap-1 cursor-pointer border ${
                      isEditingVisual
                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-500'
                        : isDarkMode
                        ? 'bg-slate-800 hover:bg-slate-700 text-amber-300 border-slate-700'
                        : 'bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-300'
                    }`}
                  >
                    {isEditingVisual ? '✅ Selesai Edit' : '✏️ Edit Visual'}
                  </button>
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

                <button
                  onClick={handlePrintPDF}
                  disabled={!generatedResults[currentResultKey]}
                  className="flex-1 sm:flex-none bg-indigo-600 hover:bg-indigo-700 text-white px-2.5 py-1 rounded-lg text-[10px] font-extrabold disabled:opacity-40 transition shadow-xs flex items-center justify-center gap-1 cursor-pointer"
                >
                  🖨️ Cetak PDF {activeTool === 'soal' ? '(2 Kolom)' : ''}
                </button>
                <button
                  onClick={handleDownloadWord}
                  disabled={!generatedResults[currentResultKey]}
                  className="flex-1 sm:flex-none bg-emerald-700 hover:bg-emerald-800 text-white px-2.5 py-1 rounded-lg text-[10px] font-extrabold disabled:opacity-40 transition shadow-xs flex items-center justify-center gap-1 cursor-pointer"
                >
                  📥 Word
                </button>
              </div>
            </div>

            {/* FLOATING TOOLBAR SAAT MODE EDIT VISUAL AKTIF */}
            {isEditingVisual && generatedResults[currentResultKey] && (
              <div
                className={`sticky top-11 z-30 flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 rounded-lg border shadow-md ${
                  isDarkMode
                    ? 'bg-slate-800 border-amber-500/50 text-slate-100'
                    : 'bg-amber-50 border-amber-300 text-slate-900'
                }`}
              >
                <div className="flex items-center gap-1.5 text-[11px] font-bold">
                  <span>✍️</span>
                  <span>
                    Mode Edit Langsung di Kertas Aktif — Klik langsung pada teks soal atau opsi
                    untuk mengubahnya:
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => applyExecCommand('bold')}
                    title="Tebal (Bold)"
                    className="px-2 py-0.5 rounded text-xs font-black border bg-white text-slate-900 hover:bg-slate-100 cursor-pointer"
                  >
                    B
                  </button>
                  <button
                    type="button"
                    onClick={() => applyExecCommand('italic')}
                    title="Miring (Italic)"
                    className="px-2 py-0.5 rounded text-xs italic font-serif border bg-white text-slate-900 hover:bg-slate-100 cursor-pointer"
                  >
                    I
                  </button>
                  <button
                    type="button"
                    onClick={() => applyExecCommand('underline')}
                    title="Garis Bawah (Underline)"
                    className="px-2 py-0.5 rounded text-xs underline border bg-white text-slate-900 hover:bg-slate-100 cursor-pointer"
                  >
                    U
                  </button>
                  <button
                    type="button"
                    onClick={() => applyExecCommand('subscript')}
                    title="Subscript (Contoh: H₂O)"
                    className="px-2 py-0.5 rounded text-[10px] font-bold border bg-white text-slate-900 hover:bg-slate-100 cursor-pointer"
                  >
                    X₂
                  </button>
                  <button
                    type="button"
                    onClick={() => applyExecCommand('superscript')}
                    title="Superscript (Contoh: m²)"
                    className="px-2 py-0.5 rounded text-[10px] font-bold border bg-white text-slate-900 hover:bg-slate-100 cursor-pointer"
                  >
                    X²
                  </button>
                </div>
              </div>
            )}

            {isGenerating ? (
              <div className="py-12 flex flex-col items-center justify-center text-center space-y-2.5">
                <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                <p
                  className={`text-xs font-extrabold animate-pulse ${
                    isDarkMode ? 'text-indigo-300' : 'text-indigo-900'
                  }`}
                >
                  {generateProgress || 'Menghubungkan ke Mercury AI Engine...'}
                </p>
              </div>
            ) : generatedResults[currentResultKey] ? (
              <div className="bg-slate-300/70 dark:bg-slate-950/90 p-2 sm:p-5 rounded-xl border border-slate-300 dark:border-slate-800 overflow-x-auto">
                {/* SIMULASI LEMBAR KERTAS A4 VISUAL PREVIEW */}
                <div
                  className={`mx-auto max-w-[820px] bg-white text-slate-950 shadow-xl rounded-sm p-5 sm:p-9 transition-all ${
                    isEditingVisual
                      ? 'ring-2 ring-amber-400 cursor-text'
                      : 'ring-1 ring-slate-300'
                  }`}
                  style={{ fontFamily: "'Times New Roman', Times, serif" }}
                >
                  {/* HEADER KOP SURAT VISUAL DI PRATINJAU KERTAS */}
                  {activeTool !== 'chatbot' && pakaiKop && (
                    <div
                      className="select-none pointer-events-none"
                      dangerouslySetInnerHTML={{ __html: getActiveKopSuratHTML() }}
                    />
                  )}

                  {/* KOTAK IDENTITAS NASKAH UJIAN VISUAL KHUSUS BANK SOAL */}
                  {activeTool === 'soal' && (
                    <div
                      className="select-none pointer-events-none"
                      dangerouslySetInnerHTML={{ __html: getExamHeaderBoxHTML() }}
                    />
                  )}

                  {/* ISI DOKUMEN / SOAL (BISA DIKLIK & DIEDIT LANGSUNG) */}
                  <div
                    id="ai-document-result"
                    ref={visualEditorRef}
                    contentEditable={isEditingVisual}
                    suppressContentEditableWarning={true}
                    onPaste={handleEditorPaste}
                    onBlur={() => {
                      if (isEditingVisual) {
                        syncVisualEditsToState()
                      }
                    }}
                    className={`prose prose-sm max-w-none text-slate-950 prose-headings:text-slate-950 prose-strong:text-slate-950 focus:outline-none ${
                      activeTool === 'soal'
                        ? 'md:columns-2 md:gap-7 md:[column-rule:1px_solid_#cbd5e1] text-[13px] leading-snug'
                        : 'text-sm leading-relaxed'
                    } ${
                      isEditingVisual
                        ? '[&_p:hover]:bg-amber-50/90 [&_li:hover]:bg-amber-50/90 [&_td:hover]:bg-amber-50/90 [&_p]:rounded [&_li]:rounded'
                        : ''
                    }`}
                  >
                    {editedHtmlMap[currentResultKey] ? (
                      <div
                        dangerouslySetInnerHTML={{ __html: editedHtmlMap[currentResultKey] }}
                      />
                    ) : (
                      <ReactMarkdown rehypePlugins={[rehypeRaw]} remarkPlugins={[remarkGfm]}>
                        {displayPreviewMarkdown}
                      </ReactMarkdown>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-10 flex flex-col items-center justify-center text-center space-y-2">
                <div
                  className={`w-11 h-11 rounded-full border flex items-center justify-center text-xl shadow-xs ${
                    isDarkMode
                      ? 'bg-slate-800 border-slate-700 text-indigo-400'
                      : 'bg-slate-50 border-indigo-200 text-indigo-700'
                  }`}
                >
                  🤖
                </div>
                <div className="space-y-0.5">
                  <h5
                    className={`font-extrabold text-sm tracking-tight ${
                      isDarkMode ? 'text-white' : 'text-slate-900'
                    }`}
                  >
                    Belum Ada Hasil Generasi
                  </h5>
                  <p
                    className={`text-[11px] font-medium max-w-md mx-auto ${
                      isDarkMode ? 'text-slate-400' : 'text-slate-600'
                    }`}
                  >
                    Sesuaikan parameter di atas lalu klik <b>{currentToolData.buttonText}</b>.
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="pt-2 pb-2 flex justify-center">
            <div
              className={`border px-3 py-1 rounded-full text-center text-[10px] font-medium shadow-xs transition-colors duration-300 ${
                isDarkMode
                  ? 'bg-slate-900 border-slate-800 text-slate-400'
                  : 'bg-slate-100 border-slate-300 text-slate-700'
              }`}
            >
              <span>Aplikasi Guru AI</span>
              <span className="mx-1.5">•</span>
              <span>
                Created by <strong className="text-emerald-500 font-bold">MUZAINI AL KAHFI</strong>
              </span>
            </div>
          </div>
        </main>
      </div>

      {/* POP-UP (MODAL) KONFIRMASI SIMPAN SOAL SPESIFIK JENJANG, KELAS & MAPEL */}
      {showSaveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3">
          <div
            className={`max-w-sm w-full border rounded-2xl p-4 shadow-2xl space-y-3 ${
              isDarkMode
                ? 'bg-slate-900 border-slate-800 text-white'
                : 'bg-white border-slate-200 text-slate-900'
            }`}
          >
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
              Pilih Jenjang, Mata Pelajaran, dan Kelas yang sesuai agar soal ini langsung sinkron di
              menu <b>Laporan</b>.
            </p>

            <div className="space-y-2.5 text-xs">
              <div>
                <label className="block text-[10px] font-bold mb-0.5">
                  Jenjang / Satuan Pendidikan
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleModalJenjangChange('SMP')}
                    className={`py-1.5 rounded-lg text-xs font-extrabold border cursor-pointer transition ${
                      saveTargetJenjang === 'SMP'
                        ? 'bg-indigo-600 text-white border-indigo-700'
                        : 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700'
                    }`}
                  >
                    🏫 SMP
                  </button>
                  <button
                    type="button"
                    onClick={() => handleModalJenjangChange('SMK')}
                    className={`py-1.5 rounded-lg text-xs font-extrabold border cursor-pointer transition ${
                      saveTargetJenjang === 'SMK'
                        ? 'bg-amber-500 text-slate-950 border-amber-600'
                        : 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700'
                    }`}
                  >
                    🎨 SMK (DKV)
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold mb-0.5">
                  Mata Pelajaran ({saveTargetJenjang})
                </label>
                <select
                  value={saveTargetMapel}
                  onChange={(e) => setSaveTargetMapel(e.target.value)}
                  className="w-full border rounded-lg px-2.5 py-1.5 text-xs font-bold dark:bg-slate-800 dark:border-slate-700"
                >
                  {modalFilteredMapel.map((m) => (
                    <option key={m.id} value={m.nama_mapel}>
                      {m.nama_mapel}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold mb-0.5">
                  Kelas Target Cetakan ({saveTargetJenjang})
                </label>
                <select
                  value={saveTargetKelas}
                  onChange={(e) => setSaveTargetKelas(e.target.value)}
                  className="w-full border rounded-lg px-2.5 py-1.5 text-xs font-bold dark:bg-slate-800 dark:border-slate-700"
                >
                  {modalFilteredKelas.map((k) => (
                    <option key={k.id} value={k.nama_kelas}>
                      {k.nama_kelas}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold mb-0.5">
                  Tersimpan atas nama Guru (Akun Login)
                </label>
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
                {isSavingSoal ? 'Menyimpan...' : saveMode === 'update' ? 'Perbarui' : 'Simpan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. FIXED COMPACT BOTTOM NAVIGATION BAR */}
      <div
        className={`border-t fixed bottom-0 left-0 right-0 z-40 shadow-lg transition-colors duration-300 ${
          isDarkMode
            ? 'bg-slate-900/95 border-slate-800 backdrop-blur-md'
            : 'bg-slate-100/95 border-slate-300 backdrop-blur-md'
        }`}
      >
        <div className="max-w-xl mx-auto px-4 py-1.5 flex items-center justify-between">
          <Link
            href="/"
            className={`flex flex-col items-center gap-0.5 text-[10px] font-semibold transition ${
              isDarkMode
                ? 'text-slate-400 hover:text-white'
                : 'text-slate-600 hover:text-slate-950'
            }`}
          >
            <span className="text-base leading-none">🕒</span>
            <span>Dashboard</span>
          </Link>

          {isOperator && (
            <Link
              href="/siswa"
              className={`flex flex-col items-center gap-0.5 text-[10px] font-semibold transition ${
                isDarkMode
                  ? 'text-slate-400 hover:text-white'
                  : 'text-slate-600 hover:text-slate-950'
              }`}
            >
              <span className="text-base leading-none">👥</span>
              <span>Siswa</span>
            </Link>
          )}

          {isOperator && (
            <Link
              href="/guru"
              className={`flex flex-col items-center gap-0.5 text-[10px] font-semibold transition ${
                isDarkMode
                  ? 'text-slate-400 hover:text-white'
                  : 'text-slate-600 hover:text-slate-950'
              }`}
            >
              <span className="text-base leading-none">👨‍🏫</span>
              <span>Guru</span>
            </Link>
          )}

          <Link
            href="/jadwal"
            className={`flex flex-col items-center gap-0.5 text-[10px] font-semibold transition ${
              isDarkMode
                ? 'text-slate-400 hover:text-white'
                : 'text-slate-600 hover:text-slate-950'
            }`}
          >
            <span className="text-base leading-none">🎓</span>
            <span>Akademik</span>
          </Link>

          <Link
            href="/ai"
            className="flex flex-col items-center gap-0.5 text-[10px] font-bold text-indigo-500 transition"
          >
            <span className="text-base leading-none">✨</span>
            <span>AI Tools</span>
          </Link>

          <Link
            href="/laporan"
            className={`flex flex-col items-center gap-0.5 text-[10px] font-semibold transition ${
              isDarkMode
                ? 'text-slate-400 hover:text-white'
                : 'text-slate-600 hover:text-slate-950'
            }`}
          >
            <span className="text-base leading-none">🖨️</span>
            <span>Laporan</span>
          </Link>
        </div>
      </div>
    </motion.div>
  )
}