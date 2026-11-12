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

interface OptionItem {
  id: number
  nama: string
  tingkat?: string
  wali_kelas_id?: number | null
}

interface SiswaItem {
  id: number
  nama_lengkap: string
  nisn?: string
  kelas_id?: number
  kelas?: any
}

interface GuruInfo {
  nama: string
  nuptk: string
  jabatanLabel: string
}

export default function LaporanPage() {
  const router = useRouter()
  const { isOperator } = useAuthRole()

  const [activeTab, setActiveTab] = useState<'pusat' | 'pengaturan'>('pusat')
  const [userDisplayName, setUserDisplayName] = useState('MEMUAT...')
  const [userNuptkDisplay, setUserNuptkDisplay] = useState('-')
  const [isStrictOperatorRole, setIsStrictOperatorRole] = useState(false)
  const [, setCurrentGuruId] = useState<number | null>(null)
  const [waliKelasAssignedId, setWaliKelasAssignedId] = useState<number | null>(null)
  const [, setUserEmail] = useState<string | null>(null)
  const [currentDateStr, setCurrentDateStr] = useState('')

  // DETEKSI OTOMATIS TEMA DARK MODE DARI LOCAL STORAGE
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false)

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme')
    if (savedTheme === 'dark') {
      setIsDarkMode(true)
    }
  }, [])

  // Master Options
  const [kelasList, setKelasList] = useState<OptionItem[]>([])
  const [mapelList, setMapelList] = useState<OptionItem[]>([])
  const [siswaList, setSiswaList] = useState<SiswaItem[]>([])

  // Global Filter Periode Akademik & Opsi 5 Tahun Ke Depan
  const [selectedSemester, setSelectedSemester] = useState<'Ganjil' | 'Genap'>('Ganjil')
  const [selectedTahunAjaran, setSelectedTahunAjaran] = useState('2026/2027')
  const [tahunAjaranOptions, setTahunAjaranOptions] = useState<string[]>([])

  // Identitas TTD & Otomatisasi Profil Guru Login
  const [namaGuru, setNamaGuru] = useState('Guru Pengampu')
  const [nuptkGuru, setNuptkGuru] = useState('-')
  const [jabatanGuru, setJabatanGuru] = useState('Guru')
  const [namaKepsek, setNamaKepsek] = useState('SULASTRI, S.Pd., Gr.')
  const [nipKepsek, setNipKepsek] = useState('NUPTK. 6337763664131233')
  const [kotaTtd, setKotaTtd] = useState('Gisting')

  // FITUR CEKLIS TTD & STEMPEL KEPSEK
  const [pakaiTtdCapKepsek, setPakaiTtdCapKepsek] = useState<boolean>(true)

  // Filter Cetak Laporan
  const [filterKelasAbsensi, setFilterKelasAbsensi] = useState('')
  const [filterBulanAbsensi, setFilterBulanAbsensi] = useState('')
  
  const [filterKelasLeger, setFilterKelasLeger] = useState('')
  const [filterMapelLeger, setFilterMapelLeger] = useState('')

  const [filterKelasJurnal, setFilterKelasJurnal] = useState('')
  const [filterTanggalJurnal, setFilterTanggalJurnal] = useState('')
  const [filterBulanJurnal, setFilterBulanJurnal] = useState('')

  const [filterKelasBimbingan, setFilterKelasBimbingan] = useState('')
  const [filterBulanBimbingan, setFilterBulanBimbingan] = useState('')
  
  // FILTER CETAK BANK SOAL
  const [filterMapelBankSoal, setFilterMapelBankSoal] = useState('')
  const [filterKelasBankSoal, setFilterKelasBankSoal] = useState('')

  // Rapor Per Siswa
  const [filterKelasRapor, setFilterKelasRapor] = useState('')
  const [selectedSiswaRapor, setSelectedSiswaRapor] = useState('')

  // Riwayat Presensi Detail BK
  const [tanggalAbsensi, setTanggalAbsensi] = useState('')
  const [bulanAbsensiDetail, setBulanAbsensiDetail] = useState('')
  const [kelasRiwayatAbsensi, setKelasRiwayatAbsensi] = useState('')
  const [kelasNilai, setKelasNilai] = useState('')
  const [mapelNilai, setMapelNilai] = useState('')

  // Helper format NUPTK agar bersih (jika kosong/null/EMPTY menjadi '-')
  const formatNuptk = (val: any): string => {
    if (!val) return '-'
    const str = String(val).trim()
    if (str === '' || str.toUpperCase() === 'EMPTY' || str.toUpperCase() === 'NULL' || str === '-') {
      return '-'
    }
    return str
  }

  // Helper format Title Case untuk Jabatan (misal "Wali kelas" -> "Wali Kelas")
  const formatTitleCase = (str: string): string => {
    if (!str) return 'Wali Kelas'
    return str
      .trim()
      .split(/\s+/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ')
  }

  // Helper Predikat & Capaian Kompetensi Rapor (KKM = 75)
  const getPredikatRapor = (nilai: number, namaMapel: string) => {
    if (nilai >= 86) {
      return {
        huruf: 'A',
        keterangan: 'Sangat Baik',
        deskripsi: `Menunjukkan penguasaan yang sangat baik dalam memahami seluruh materi dan kompetensi dasar pada mata pelajaran ${namaMapel}.`,
      }
    }
    if (nilai >= 79) {
      return {
        huruf: 'B',
        keterangan: 'Baik',
        deskripsi: `Menunjukkan penguasaan yang baik dalam memahami sebagian besar materi dan kompetensi dasar pada mata pelajaran ${namaMapel}.`,
      }
    }
    return {
      huruf: 'C',
      keterangan: 'Cukup Baik',
      deskripsi: `Menunjukkan penguasaan yang cukup baik dalam memahami kompetensi dasar esensial pada mata pelajaran ${namaMapel}.`,
    }
  }

  // Generate 5 Tahun Ajaran ke Depan
  useEffect(() => {
    const currentYear = new Date().getFullYear()
    const options: string[] = []
    for (let i = 0; i < 6; i++) {
      const start = currentYear + i - 1
      options.push(`${start}/${start + 1}`)
    }
    setTahunAjaranOptions(options)
  }, [])

  // LOAD PENGATURAN DARI LOCALSTORAGE
  useEffect(() => {
    const savedPengaturan = localStorage.getItem('pengaturan_laporan')
    if (savedPengaturan) {
      try {
        const parsed = JSON.parse(savedPengaturan)
        if (parsed.namaKepsek) setNamaKepsek(parsed.namaKepsek)
        if (parsed.nipKepsek) setNipKepsek(parsed.nipKepsek)
        if (parsed.kotaTtd) setKotaTtd(parsed.kotaTtd)
        if (typeof parsed.pakaiTtdCapKepsek === 'boolean') setPakaiTtdCapKepsek(parsed.pakaiTtdCapKepsek)
      } catch (e) {
        console.error('Error parsing local storage settings:', e)
      }
    }
  }, [])

  useEffect(() => {
    setCurrentDateStr(
      new Date().toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    )

    async function getUserData() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || !user.email) return

      const cleanEmail = user.email.trim().toLowerCase()
      setUserEmail(cleanEmail)

      const { data: dataGuruLogin, error } = await supabase
        .from('guru')
        .select('id, nama_lengkap, role, NUPTK, email, jabatan')
        .ilike('email', cleanEmail)
        .maybeSingle()

      if (error) {
        console.error('Error fetching guru:', error.message)
      }

      if (dataGuruLogin && dataGuruLogin.nama_lengkap) {
        const namaLengkapResmi = dataGuruLogin.nama_lengkap.trim()
        const cleanNuptk = formatNuptk(dataGuruLogin.NUPTK)
        const cleanJabatan = formatTitleCase(dataGuruLogin.jabatan || 'Guru')
        const isUserStrictOperator = (dataGuruLogin.role || '').toLowerCase() === 'operator'

        setCurrentGuruId(dataGuruLogin.id)
        setIsStrictOperatorRole(isUserStrictOperator)
        setUserDisplayName(namaLengkapResmi.toUpperCase())
        setUserNuptkDisplay(cleanNuptk)
        setNamaGuru(namaLengkapResmi)
        setNuptkGuru(cleanNuptk)
        setJabatanGuru(cleanJabatan)

        fetchMasterData(dataGuruLogin.id, isUserStrictOperator)
      } else {
        const fallbackName = user.user_metadata?.full_name || cleanEmail.split('@')[0]
        setCurrentGuruId(null)
        setIsStrictOperatorRole(isOperator)
        setUserDisplayName(fallbackName.toUpperCase())
        setUserNuptkDisplay('-')
        setNamaGuru(fallbackName)
        setNuptkGuru('-')
        setJabatanGuru('Guru')
        fetchMasterData(null, isOperator)
      }
    }

    getUserData()
  }, [isOperator])

  // AMBIL MASTER DATA MAPEL & KELAS (GURU HANYA MENDAPATKAN MAPEL YANG DIAMPU & KELAS WALI JIKA ADA)
  async function fetchMasterData(guruId: number | null, isStrictOperator: boolean) {
    try {
      if (!isStrictOperator && guruId) {
        const { data: listGuruMapel, error: errGuruMapel } = await supabase
          .from('guru_mapel')
          .select(`
            mapel_id,
            mapel:mapel_id (
              id,
              nama_mapel
            )
          `)
          .eq('guru_id', guruId)

        if (!errGuruMapel && listGuruMapel && listGuruMapel.length > 0) {
          const formattedMapel = listGuruMapel
            .map((item: any) => item.mapel)
            .filter(Boolean)
            .map((m: any) => ({ id: m.id, nama: m.nama_mapel }))
            .sort((a: any, b: any) => a.nama.localeCompare(b.nama))

          setMapelList(formattedMapel)

          if (formattedMapel.length > 0) {
            setFilterMapelBankSoal(formattedMapel[0].nama)
            setFilterMapelLeger(String(formattedMapel[0].id))
            setMapelNilai(String(formattedMapel[0].id))
          }
        } else {
          setMapelList([])
        }
      } else {
        const { data: dataMapel } = await supabase
          .from('mapel')
          .select('id, nama_mapel')
          .order('nama_mapel', { ascending: true })

        if (dataMapel) {
          const formatted = dataMapel.map(m => ({ id: m.id, nama: m.nama_mapel }))
          setMapelList(formatted)
          if (formatted.length > 0) {
            setFilterMapelBankSoal(formatted[0].nama)
          }
        }
      }

      const { data: dataKelas } = await supabase
        .from('kelas')
        .select('id, nama_kelas, tingkat, wali_kelas_id')
        .order('nama_kelas', { ascending: true })

      const { data: dataSiswa } = await supabase
        .from('siswa')
        .select('id, nama_lengkap, nisn, kelas_id')
        .order('nama_lengkap', { ascending: true })

      if (dataKelas) {
        const mappedKelas = dataKelas.map(k => ({
          id: k.id,
          nama: k.nama_kelas,
          tingkat: k.tingkat,
          wali_kelas_id: k.wali_kelas_id,
        }))
        setKelasList(mappedKelas)

        if (!isStrictOperator && guruId) {
          const kelasBinaan = mappedKelas.find(k => Number(k.wali_kelas_id) === Number(guruId))
          if (kelasBinaan) {
            setWaliKelasAssignedId(kelasBinaan.id)
            setFilterKelasRapor(String(kelasBinaan.id))
            setFilterKelasBimbingan(String(kelasBinaan.id))
          } else {
            setWaliKelasAssignedId(null)
            setFilterKelasRapor('')
          }
        }
      }

      if (dataSiswa) setSiswaList(dataSiswa as any)

    } catch (err) {
      console.error('Error fetching master data:', err)
    }
  }

  // HELPER KHUSUS MENGAMBIL WALI KELAS BERDASARKAN `kelas.wali_kelas_id`
  const resolveWaliKelasByKelasId = async (kelasId: number | string | null): Promise<GuruInfo> => {
    if (kelasId) {
      const kelasObj = kelasList.find(k => Number(k.id) === Number(kelasId))
      let waliId = kelasObj?.wali_kelas_id

      if (!waliId) {
        const { data: kDb } = await supabase
          .from('kelas')
          .select('wali_kelas_id')
          .eq('id', Number(kelasId))
          .maybeSingle()
        waliId = kDb?.wali_kelas_id
      }

      if (waliId) {
        const { data: gData } = await supabase
          .from('guru')
          .select('nama_lengkap, NUPTK, jabatan')
          .eq('id', Number(waliId))
          .maybeSingle()

        if (gData && gData.nama_lengkap) {
          return {
            nama: gData.nama_lengkap.trim(),
            nuptk: formatNuptk(gData.NUPTK),
            jabatanLabel: 'Wali Kelas',
          }
        }
      }
    }

    return {
      nama: namaGuru,
      nuptk: nuptkGuru,
      jabatanLabel: 'Wali Kelas',
    }
  }

  // HELPER PENCARI IDENTITAS & JABATAN PENANDATANGAN PDF
  const resolvePenandatanganPDF = async (options: {
    mode: 'mapel' | 'wali' | 'umum'
    mapelId?: number | string | null
    mapelNama?: string | null
    kelasId?: number | string | null
    guruEmail?: string | null
    namaGuruFallback?: string | null
  }): Promise<GuruInfo> => {
    if (options.mode === 'wali') {
      return await resolveWaliKelasByKelasId(options.kelasId || waliKelasAssignedId || null)
    }

    let namaMapelTerpilih = ''
    if (options.mapelId) {
      const mObj = mapelList.find((m) => String(m.id) === String(options.mapelId))
      if (mObj) namaMapelTerpilih = mObj.nama
    } else if (options.mapelNama) {
      namaMapelTerpilih = options.mapelNama.trim()
    }

    const buildJabatanLabel = (): string => {
      if (options.mode === 'mapel') {
        return namaMapelTerpilih
          ? `Guru Mata Pelajaran ${namaMapelTerpilih}`
          : 'Guru Mata Pelajaran'
      }
      if (namaMapelTerpilih) {
        return `Guru Mata Pelajaran ${namaMapelTerpilih}`
      }
      return 'Guru Mata Pelajaran'
    }

    if (!isStrictOperatorRole && namaGuru && namaGuru !== 'Guru Pengampu') {
      return {
        nama: namaGuru,
        nuptk: nuptkGuru,
        jabatanLabel: buildJabatanLabel(),
      }
    }

    if (options.guruEmail) {
      const { data: gByEmail } = await supabase
        .from('guru')
        .select('nama_lengkap, NUPTK')
        .ilike('email', options.guruEmail.trim())
        .maybeSingle()

      if (gByEmail && gByEmail.nama_lengkap) {
        return {
          nama: gByEmail.nama_lengkap.trim(),
          nuptk: formatNuptk(gByEmail.NUPTK),
          jabatanLabel: buildJabatanLabel(),
        }
      }
    }

    if (options.mapelId) {
      const { data: gmData } = await supabase
        .from('guru_mapel')
        .select('guru:guru_id(nama_lengkap, NUPTK)')
        .eq('mapel_id', Number(options.mapelId))
        .limit(1)
        .maybeSingle()

      const guruObj: any = gmData?.guru
      if (guruObj && guruObj.nama_lengkap) {
        return {
          nama: guruObj.nama_lengkap.trim(),
          nuptk: formatNuptk(guruObj.NUPTK),
          jabatanLabel: buildJabatanLabel(),
        }
      }
    }

    if (namaMapelTerpilih) {
      const targetMapel = mapelList.find(
        (m) => m.nama.toLowerCase() === namaMapelTerpilih.toLowerCase()
      )
      if (targetMapel) {
        const { data: gmData } = await supabase
          .from('guru_mapel')
          .select('guru:guru_id(nama_lengkap, NUPTK)')
          .eq('mapel_id', targetMapel.id)
          .limit(1)
          .maybeSingle()

        const guruObj: any = gmData?.guru
        if (guruObj && guruObj.nama_lengkap) {
          return {
            nama: guruObj.nama_lengkap.trim(),
            nuptk: formatNuptk(guruObj.NUPTK),
            jabatanLabel: buildJabatanLabel(),
          }
        }
      }
    }

    if (options.namaGuruFallback) {
      const { data: gByName } = await supabase
        .from('guru')
        .select('nama_lengkap, NUPTK')
        .ilike('nama_lengkap', `%${options.namaGuruFallback.trim()}%`)
        .limit(1)
        .maybeSingle()

      if (gByName && gByName.nama_lengkap) {
        return {
          nama: gByName.nama_lengkap.trim(),
          nuptk: formatNuptk(gByName.NUPTK),
          jabatanLabel: buildJabatanLabel(),
        }
      }
      return {
        nama: options.namaGuruFallback,
        nuptk: '-',
        jabatanLabel: buildJabatanLabel(),
      }
    }

    return {
      nama: namaGuru,
      nuptk: nuptkGuru,
      jabatanLabel: buildJabatanLabel(),
    }
  }

  // KOP SURAT GAMBAR PNG
  const headerKopHTML = `
    <div style="text-align: center; margin-bottom: 12px;">
      <img src="/kop-surat.png" alt="Kop Surat" style="width: 100%; max-height: 140px; object-fit: contain;" />
    </div>
  `

  // FOOTER TTD GENERATOR DINAMIS (2 PIHAK - LAPORAN UMUM)
  const getFooterTtdHTML = (guruInfo: GuruInfo) => `
    <div style="margin-top: 25px; font-family: 'Times New Roman', serif; font-size: 9.5pt; page-break-inside: avoid; color: #000;">
      <table style="width: 100%; border: none;">
        <tr>
          <td style="width: 50%; border: none; text-align: center; vertical-align: top;">
            ${kotaTtd}, ${currentDateStr}<br/>
            <strong>${guruInfo.jabatanLabel}</strong><br/><br/><br/><br/>
            <u><strong>${guruInfo.nama}</strong></u><br/>
            NUPTK: ${guruInfo.nuptk}
          </td>
          <td style="width: 50%; border: none; text-align: center; vertical-align: top;">
            Mengetahui,<br/>
            <strong>Kepala Sekolah</strong><br/>
            <div style="position: relative; height: 70px; display: flex; align-items: center; justify-content: center;">
              ${
                pakaiTtdCapKepsek
                  ? `
                    <img src="/stempel-sekolah.png" alt="Stempel" style="position: absolute; left: 25%; top: 0px; height: 75px; opacity: 0.9; z-index: 1;" />
                    <img src="/ttd-kepsek.png" alt="TTD Kepsek" style="position: absolute; left: 35%; top: 5px; height: 60px; z-index: 2;" />
                  `
                  : '<br/><br/>'
              }
            </div>
            <u><strong>${namaKepsek}</strong></u><br/>
            ${nipKepsek}
          </td>
        </tr>
      </table>
    </div>
  `

  const downloadCSV = (filename: string, headers: string[], rows: (string | number)[][]) => {
    const csvContent = 'data:text/csv;charset=utf-8,' 
      + [headers.join(','), ...rows.map(e => e.map(val => `"${val}"`).join(','))].join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `${filename}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // PARSER & PEMBERSIH OTOMATIS NASKAH SOAL (MEMBUANG KUNCI JAWABAN, DUPLIKASI HEADER, & MERAPIKAN 2 KOLOM)
  const formatNaskahSoalHematKertas = (rawText: string): string => {
    if (!rawText) return '<p><i>Isi naskah soal kosong di database.</i></p>'

    // 1. Potong semua teks mulai dari bagian KUNCI JAWABAN atau LEMBAR PENGESAHAN ke bawah
    let cleanText = rawText
      .split(/\n\s*#{0,4}\s*(?:KUNCI\s*JAWABAN|PEDOMAN\s*PENSKORAN|LEMBAR\s*PENGESAHAN)/i)[0]
      .trim()

    // 2. Ubah format bold **teks** menjadi <b>teks</b>
    cleanText = cleanText.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')

    const lines = cleanText.split('\n')
    const soalItems: { num: string; question: string; options: { letter: string; text: string }[] }[] = []
    let currentSoal: { num: string; question: string; options: { letter: string; text: string }[] } | null = null
    let startedSoal = false

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line) continue

      // Deteksi nomor soal (misal: "1. Ayat Alquran..." atau "1) ...")
      const qMatch = line.match(/^(\d{1,2})[\.\)]\s+(.+)$/)
      if (qMatch) {
        startedSoal = true
        if (currentSoal) {
          soalItems.push(currentSoal)
        }
        currentSoal = {
          num: qMatch[1],
          question: qMatch[2].trim(),
          options: [],
        }
        continue
      }

      // Abaikan semua header identitas/petunjuk sebelum soal nomor 1 dimulai
      if (!startedSoal) continue

      // Abaikan sub-judul topik (misal "### Topik 1: ..." atau "A. TOPIK: ...") agar hemat kertas
      if (
        /^#{1,4}\s*/.test(line) ||
        /^[A-Z]\.\s*TOPIK\b/i.test(line) ||
        /^TOPIK\s*\d+/i.test(line)
      ) {
        continue
      }

      // Deteksi pilihan jawaban a/b/c/d atau A/B/C/D
      const optMatch = line.match(/^([a-dA-D])[\.\)]\s*(.+)$/)
      if (optMatch && currentSoal) {
        currentSoal.options.push({
          letter: optMatch[1].toUpperCase(),
          text: optMatch[2].trim(),
        })
        continue
      }

      // Jika baris lanjutan dari pertanyaan atau opsi terakhir
      if (currentSoal) {
        if (currentSoal.options.length > 0) {
          const lastOpt = currentSoal.options[currentSoal.options.length - 1]
          lastOpt.text += ' ' + line
        } else {
          currentSoal.question += ' ' + line
        }
      }
    }

    if (currentSoal) {
      soalItems.push(currentSoal)
    }

    // Jika berhasil ter-parse sebagai daftar butir soal, render dengan struktur kompak anti-terpotong
    if (soalItems.length > 0) {
      return soalItems
        .map((item) => {
          // Cek apakah semua opsi pendek (<= 22 karakter) -> tampilkan 2 baris (A & C kiri, B & D kanan) agar makin hemat
          const isShortOptions =
            item.options.length === 4 && item.options.every((o) => o.text.length <= 22)

          const optionsHtml = isShortOptions
            ? `
              <table class="opt-grid">
                <tr>
                  <td><b>${item.options[0].letter}.</b> ${item.options[0].text}</td>
                  <td><b>${item.options[2].letter}.</b> ${item.options[2].text}</td>
                </tr>
                <tr>
                  <td><b>${item.options[1].letter}.</b> ${item.options[1].text}</td>
                  <td><b>${item.options[3].letter}.</b> ${item.options[3].text}</td>
                </tr>
              </table>
            `
            : `
              <div class="opt-list">
                ${item.options
                  .map((o) => `<div class="opt-row"><b>${o.letter}.</b> ${o.text}</div>`)
                  .join('')}
              </div>
            `

          return `
            <div class="soal-item">
              <div class="soal-q">
                <span class="soal-num">${item.num}.</span>
                <span class="soal-text">${item.question}</span>
              </div>
              ${optionsHtml}
            </div>
          `
        })
        .join('')
    }

    // Fallback jika format soal berupa esai/uraian bebas
    const cleanedLines = lines
      .filter((l) => !/^#{1,4}\s*/.test(l.trim()))
      .map((l) => l.trim())
      .filter(Boolean)
    return cleanedLines.map((l) => `<p style="margin: 0 0 4px 0;">${l}</p>`).join('')
  }

  // HELPER FILTER KELAS PRESISI UNTUK BANK SOAL (MENCEGAH VIII A DAN IX A TERCAMPUR)
  const filterSoalByKelasExact = (soalList: any[], selectedKelasNama: string) => {
    if (!selectedKelasNama) return soalList
    const targetClean = selectedKelasNama.trim().toUpperCase()
    const targetNoSpace = targetClean.replace(/\s+/g, '')

    return soalList.filter((s) => {
      const fk = String(s.fase_kelas || '').toUpperCase()
      const fkNoSpace = fk.replace(/\s+/g, '')
      const regexWord = new RegExp(`(^|[^A-Z0-9])${targetClean.replace(/\s+/g, '\\s*')}([^A-Z0-9]|$)`, 'i')
      return regexWord.test(fk) || fkNoSpace.includes(targetNoSpace)
    })
  }

  // HELPER UNDUH FILE MICROSOFT WORD (.DOC) UNTUK SOAL & KUNCI JAWABAN
  const triggerDownloadWord = (filename: string, htmlBody: string) => {
    const originUrl = typeof window !== 'undefined' ? window.location.origin : ''
    const wordHtml = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
        <head>
          <meta charset="utf-8" />
          <title>${filename}</title>
          <!--[if gte mso 9]>
          <xml>
            <w:WordDocument>
              <w:View>Print</w:View>
              <w:Zoom>100</w:Zoom>
              <w:DoNotOptimizeForBrowser/>
            </w:WordDocument>
          </xml>
          <![endif]-->
          <style>
            @page WordSectionHeader {
              size: 21cm 29.7cm;
              margin: 0.7cm 0.9cm 0.7cm 0.9cm;
              mso-header-margin: 0.5cm;
              mso-footer-margin: 0.5cm;
            }
            @page WordSectionSoal {
              size: 21cm 29.7cm;
              margin: 0.7cm 0.9cm 0.7cm 0.9cm;
              mso-columns: 2 even 0.4cm;
              mso-column-separator: single;
            }
            @page WordSectionSingle {
              size: 21cm 29.7cm;
              margin: 1.3cm 1.5cm 1.3cm 1.5cm;
            }
            div.WordSectionHeader { page: WordSectionHeader; }
            div.WordSectionSoal {
              page: WordSectionSoal;
              column-count: 2;
              column-gap: 14px;
              column-rule: 0.5pt solid #888;
            }
            div.WordSectionSingle { page: WordSectionSingle; }
            body {
              font-family: 'Times New Roman', Times, serif;
              color: #000;
              line-height: 1.15;
              font-size: 8.5pt;
              margin: 0;
              padding: 0;
            }
            .judul-ujian {
              text-align: center;
              text-transform: uppercase;
              margin: 2px 0 4px 0;
              font-size: 9.5pt;
              font-weight: bold;
            }
            .header-identitas {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 4px;
              font-size: 8pt;
            }
            .header-identitas td {
              border: 1px solid #000;
              padding: 2px 5px;
            }
            .petunjuk-singkat {
              font-size: 7.8pt;
              font-style: italic;
              margin: 0 0 6px 0;
              border-bottom: 1.5pt solid #000;
              padding-bottom: 3px;
            }
            .soal-item {
              break-inside: avoid;
              page-break-inside: avoid;
              margin-bottom: 4.5pt;
            }
            .soal-q {
              margin-bottom: 1pt;
              text-align: justify;
            }
            .soal-num {
              font-weight: bold;
            }
            .opt-list {
              padding-left: 14pt;
            }
            .opt-row {
              margin-bottom: 0.5pt;
            }
            .opt-grid {
              width: 94%;
              margin-left: 14pt;
              border-collapse: collapse;
              font-size: 8.3pt;
            }
            .opt-grid td {
              width: 50%;
              padding: 0 4pt 0 0;
              border: none;
              vertical-align: top;
            }
          </style>
        </head>
        <body>
          ${htmlBody.replace(/src="\//g, `src="${originUrl}/`)}
        </body>
      </html>
    `

    const blob = new Blob(['\ufeff', wordHtml], {
      type: 'application/msword',
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${filename}.doc`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  // DOWNLOAD WORD (.DOC) NASKAH SOAL SISWA (2 KOLOM HEMAT KERTAS, TANPA KUNCI JAWABAN, SIAP EDIT)
  const handlePrintBankSoal = async () => {
    let query = supabase.from('bank_soal').select('*').order('created_at', { ascending: false })
    if (filterMapelBankSoal) {
      query = query.eq('mapel', filterMapelBankSoal)
    }

    const { data: rawSoalData, error } = await query
    const soalData = filterSoalByKelasExact(rawSoalData || [], filterKelasBankSoal)

    if (error || !soalData || soalData.length === 0) {
      alert(`Tidak ada naskah bank soal tersimpan ${filterMapelBankSoal ? `untuk mata pelajaran ${filterMapelBankSoal}` : ''} ${filterKelasBankSoal ? `kelas ${filterKelasBankSoal}` : ''}.`)
      return
    }

    const htmlSections = soalData
      .map((s, idx) => `
        ${idx > 0 ? '<br clear="all" style="page-break-before:always; mso-break-type:section-break" />' : ''}
        <div class="WordSectionHeader">
          <div style="text-align: center; margin-bottom: 4px;">
            <img src="/kop-surat.png" alt="Kop Surat" width="680" style="width: 100%; max-height: 82px; object-fit: contain;" />
          </div>
          <div class="judul-ujian">
            NASKAH SOAL ASESMEN SUMATIF / ULANGAN SEMESTER ${selectedSemester.toUpperCase()} TA ${selectedTahunAjaran}
          </div>
          <table class="header-identitas">
            <tr>
              <td style="width: 15%;"><b>Mata Pelajaran</b></td>
              <td style="width: 35%;">: ${s.mapel}</td>
              <td style="width: 15%;"><b>Nama Siswa</b></td>
              <td style="width: 35%;">: ........................................................</td>
            </tr>
            <tr>
              <td><b>Kelas / Fase</b></td>
              <td>: ${s.fase_kelas}</td>
              <td><b>No. Peserta / NIS</b></td>
              <td>: ........................................................</td>
            </tr>
            <tr>
              <td><b>Waktu / Soal</b></td>
              <td>: 90 Menit (${s.jumlah_soal} Butir ${s.bentuk_soal})</td>
              <td><b>Hari / Tanggal</b></td>
              <td>: ........................................................</td>
            </tr>
          </table>
          <p class="petunjuk-singkat">
            <b>Petunjuk:</b> Berdoalah sebelum mengerjakan. Pilihlah satu jawaban yang paling tepat dengan memberi tanda silang (X) pada huruf A, B, C, atau D pada lembar jawaban!
          </p>
        </div>

        <br clear="all" style="mso-special-character:line-break; page-break-before:auto; mso-break-type:section-break" />

        <div class="WordSectionSoal">
          ${formatNaskahSoalHematKertas(s.isi_soal)}
        </div>
      `)
      .join('')

    const safeMapel = (filterMapelBankSoal || 'Semua_Mapel').replace(/[^a-zA-Z0-9]/g, '_')
    const safeKelas = (filterKelasBankSoal || 'Semua_Kelas').replace(/[^a-zA-Z0-9]/g, '_')
    triggerDownloadWord(`Naskah_Soal_${safeMapel}_${safeKelas}`, htmlSections)
  }

  // DOWNLOAD WORD (.DOC) KUNCI JAWABAN & PEDOMAN PENILAIAN (SIAP EDIT)
  const handlePrintKunciJawaban = async () => {
    let query = supabase.from('bank_soal').select('*').order('created_at', { ascending: false })
    if (filterMapelBankSoal) {
      query = query.eq('mapel', filterMapelBankSoal)
    }

    const { data: rawSoalData } = await query
    const soalData = filterSoalByKelasExact(rawSoalData || [], filterKelasBankSoal)

    if (!soalData || soalData.length === 0) {
      alert('Tidak ada data bank soal untuk melihat kunci jawaban.')
      return
    }

    const extractKunciOnly = (rawText: string) => {
      if (!rawText) return '<p><i>Data kosong.</i></p>'
      const parts = rawText.split(/\n\s*#{0,4}\s*KUNCI\s*JAWABAN/i)
      let targetPart = parts.length > 1 ? parts[1] : rawText
      targetPart = targetPart.split(/\n\s*#{0,4}\s*LEMBAR\s*PENGESAHAN/i)[0]
      return targetPart
        .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
        .trim()
        .replace(/\n/g, '<br/>')
    }

    const guruPengampu = await resolvePenandatanganPDF({
      mode: 'mapel',
      mapelNama: filterMapelBankSoal || soalData[0]?.mapel,
      namaGuruFallback: soalData[0]?.nama_guru,
    })

    const htmlKunci = `
      <div class="WordSectionSingle" style="font-size: 10pt; line-height: 1.4;">
        <div style="text-align: center; margin-bottom: 10px;">
          <img src="/kop-surat.png" alt="Kop Surat" width="650" style="width: 100%; max-height: 120px; object-fit: contain;" />
        </div>
        <h2 style="text-align: center; text-transform: uppercase; font-size: 12pt; margin-bottom: 12px;">
          LEMBAR KUNCI JAWABAN &amp; PEDOMAN PENILAIAN GURU
        </h2>
        ${soalData
          .map(
            (s) => `
              <div style="border: 1px solid #000; padding: 10px; margin-bottom: 14px;">
                <h3 style="margin: 0 0 4px 0; text-transform: uppercase; text-align: center; font-size: 11pt;">
                  MAPEL: ${s.mapel} (Fase / Kelas: ${s.fase_kelas})
                </h3>
                <p style="font-size: 9pt; margin: 0 0 8px 0; text-align: center;">
                  Guru Pengampu: <b>${s.nama_guru || guruPengampu.nama}</b> | Jumlah Soal: ${s.jumlah_soal} (${s.bentuk_soal})
                </p>
                <hr/>
                <div style="font-weight: bold; font-size: 10pt;">
                  ${extractKunciOnly(s.isi_soal)}
                </div>
              </div>
            `
          )
          .join('')}
        ${getFooterTtdHTML(guruPengampu)}
      </div>
    `

    const safeMapel = (filterMapelBankSoal || 'Semua_Mapel').replace(/[^a-zA-Z0-9]/g, '_')
    const safeKelas = (filterKelasBankSoal || 'Semua_Kelas').replace(/[^a-zA-Z0-9]/g, '_')
    triggerDownloadWord(`Kunci_Jawaban_${safeMapel}_${safeKelas}`, htmlKunci)
  }

  const handlePrintDocument = async (jenis: string) => {
    let judulDoc = 'LAPORAN AKADEMIK'
    let contentBody = ''
    let guruCetak: GuruInfo = {
      nama: namaGuru,
      nuptk: nuptkGuru,
      jabatanLabel: 'Guru Mata Pelajaran',
    }

    if (jenis === 'absensi') {
      const selectedK = kelasList.find(k => k.id === Number(filterKelasAbsensi))
      judulDoc = `LAPORAN REKAPITULASI PRESENSI HARIAN SISWA ${selectedK ? `(${selectedK.nama.toUpperCase()})` : '(SEMUA KELAS)'} - SEMESTER ${selectedSemester.toUpperCase()} TA ${selectedTahunAjaran}`
      
      let querySiswa = supabase.from('siswa').select('*, kelas:kelas_id(nama_kelas)').order('nama_lengkap', { ascending: true })
      if (filterKelasAbsensi) querySiswa = querySiswa.eq('kelas_id', Number(filterKelasAbsensi))
      const { data: siswaData } = await querySiswa

      let queryAbsensi = supabase.from('absensi').select('*').eq('semester', selectedSemester).eq('tahun_ajaran', selectedTahunAjaran)
      if (filterKelasAbsensi) queryAbsensi = queryAbsensi.eq('kelas_id', Number(filterKelasAbsensi))
      if (filterBulanAbsensi) queryAbsensi = queryAbsensi.ilike('tanggal', `${filterBulanAbsensi}%`)

      const { data: absensiData } = await queryAbsensi

      guruCetak = await resolvePenandatanganPDF({
        mode: 'umum',
      })

      const rekapSiswa = (siswaData || []).map(siswa => {
        const riwayatAll = (absensiData || []).filter(a => Number(a.siswa_id) === Number(siswa.id))
        
        const presensiHarianMap = new Map<string, string>()
        riwayatAll.forEach(a => {
          const tgl = a.tanggal
          const jamStr = a.jam_ke || ''
          const isJam1 = jamStr.includes('Jam Ke-1') || jamStr.includes('Ke-1')

          if (!presensiHarianMap.has(tgl) || isJam1) {
            presensiHarianMap.set(tgl, a.status)
          }
        })

        const statusList = Array.from(presensiHarianMap.values())

        return {
          nisn: siswa.nisn || '-',
          nama: siswa.nama_lengkap,
          kelas: (siswa as any).kelas?.nama_kelas || (Array.isArray((siswa as any).kelas) ? (siswa as any).kelas[0]?.nama_kelas : '-'),
          hadir: statusList.filter(st => st === 'HADIR').length,
          sakit: statusList.filter(st => st === 'SAKIT').length,
          izin: statusList.filter(st => st === 'IZIN').length,
          alpa: statusList.filter(st => st === 'ALPA').length
        }
      })

      contentBody = `
        <h3 style="text-align: center; text-transform: uppercase; margin-bottom: 5px;">${judulDoc}</h3>
        <p style="text-align: center; font-size: 10pt; margin-bottom: 15px;">
          Semester: <b>${selectedSemester}</b> | Tahun Ajaran: <b>${selectedTahunAjaran}</b>
          ${filterBulanAbsensi ? ` | Bulan: <b>${filterBulanAbsensi}</b>` : ''}
        </p>
        <p style="font-size: 8.5pt; font-style: italic; margin-bottom: 8px;">* Catatan: Rekapitulasi harian dihitung berdasarkan presensi jam pertama per hari (satuan HARI).</p>
        <table style="width: 100%; border-collapse: collapse; font-size: 10pt;">
          <thead>
            <tr style="background-color: #f2f2f2;">
              <th style="border: 1px solid #000; padding: 6px;">No</th>
              <th style="border: 1px solid #000; padding: 6px;">NISN</th>
              <th style="border: 1px solid #000; padding: 6px;">Nama Siswa</th>
              <th style="border: 1px solid #000; padding: 6px;">Kelas</th>
              <th style="border: 1px solid #000; padding: 6px;">Hadir (H)</th>
              <th style="border: 1px solid #000; padding: 6px;">Sakit (S)</th>
              <th style="border: 1px solid #000; padding: 6px;">Izin (I)</th>
              <th style="border: 1px solid #000; padding: 6px;">Alpa (A)</th>
            </tr>
          </thead>
          <tbody>
            ${
              rekapSiswa.length > 0
                ? rekapSiswa.map((s, idx) => `
                    <tr>
                      <td style="border: 1px solid #000; padding: 5px; text-align: center;">${idx + 1}</td>
                      <td style="border: 1px solid #000; padding: 5px; text-align: center;">${s.nisn}</td>
                      <td style="border: 1px solid #000; padding: 5px;">${s.nama}</td>
                      <td style="border: 1px solid #000; padding: 5px; text-align: center;">${s.kelas}</td>
                      <td style="border: 1px solid #000; padding: 5px; text-align: center; font-weight: bold;">${s.hadir}</td>
                      <td style="border: 1px solid #000; padding: 5px; text-align: center;">${s.sakit}</td>
                      <td style="border: 1px solid #000; padding: 5px; text-align: center;">${s.izin}</td>
                      <td style="border: 1px solid #000; padding: 5px; text-align: center;">${s.alpa}</td>
                    </tr>
                  `).join('')
                : `<tr><td colspan="8" style="border: 1px solid #000; padding: 10px; text-align: center;">Belum ada data rekapitulasi absensi.</td></tr>`
            }
          </tbody>
        </table>
      `
    } else if (jenis === 'leger') {
      const selectedK = kelasList.find(k => k.id === Number(filterKelasLeger))
      const selectedM = mapelList.find(m => m.id === Number(filterMapelLeger))

      judulDoc = `LEGER NILAI AKADEMIK SISWA ${selectedK ? `(${selectedK.nama.toUpperCase()})` : '(SEMUA KELAS)'} ${selectedM ? `- MAPEL: ${selectedM.nama.toUpperCase()}` : ''}`

      guruCetak = await resolvePenandatanganPDF({
        mode: 'mapel',
        mapelId: filterMapelLeger || null,
      })

      let querySiswa = supabase.from('siswa').select('*, kelas:kelas_id(nama_kelas)').order('nama_lengkap', { ascending: true })
      if (filterKelasLeger) querySiswa = querySiswa.eq('kelas_id', Number(filterKelasLeger))
      const { data: siswaData } = await querySiswa

      let queryNilai = supabase.from('nilai').select('*').eq('semester', selectedSemester).eq('tahun_ajaran', selectedTahunAjaran)
      if (filterKelasLeger) queryNilai = queryNilai.eq('kelas_id', Number(filterKelasLeger))
      if (filterMapelLeger) queryNilai = queryNilai.eq('mapel_id', Number(filterMapelLeger))

      const { data: nilaiData } = await queryNilai

      const rekapLeger = (siswaData || []).map(siswa => {
        const listN = (nilaiData || []).filter(n => Number(n.siswa_id) === Number(siswa.id))
        const n = listN.length > 0 ? listN[listN.length - 1] : {}

        const tugas = n.nilai_tugas ?? 0
        const uts = n.nilai_uts ?? 0
        const uas = n.nilai_uas ?? 0
        const komps = [tugas, uts, uas].filter(v => v > 0)
        const avg = komps.length > 0 ? (komps.reduce((a, b) => a + b, 0) / komps.length).toFixed(1) : '0.0'

        return {
          nama: siswa.nama_lengkap,
          kelas: (siswa as any).kelas?.nama_kelas || (Array.isArray((siswa as any).kelas) ? (siswa as any).kelas[0]?.nama_kelas : '-'),
          mapel: n.mata_pelajaran || selectedM?.nama || '-',
          tugas: n.nilai_tugas ?? '-',
          uts: n.nilai_uts ?? '-',
          uas: n.nilai_uas ?? '-',
          avg
        }
      })

      contentBody = `
        <h3 style="text-align: center; text-transform: uppercase; margin-bottom: 5px;">${judulDoc}</h3>
        <p style="text-align: center; font-size: 10pt; margin-bottom: 15px;">Semester: <b>${selectedSemester}</b> | Tahun Ajaran: <b>${selectedTahunAjaran}</b></p>
        <table style="width: 100%; border-collapse: collapse; font-size: 10pt;">
          <thead>
            <tr style="background-color: #f2f2f2;">
              <th style="border: 1px solid #000; padding: 6px;">No</th>
              <th style="border: 1px solid #000; padding: 6px;">Nama Siswa</th>
              <th style="border: 1px solid #000; padding: 6px;">Kelas</th>
              <th style="border: 1px solid #000; padding: 6px;">Mapel</th>
              <th style="border: 1px solid #000; padding: 6px;">Tugas</th>
              <th style="border: 1px solid #000; padding: 6px;">UTS</th>
              <th style="border: 1px solid #000; padding: 6px;">UAS</th>
              <th style="border: 1px solid #000; padding: 6px;">Rata-Rata</th>
            </tr>
          </thead>
          <tbody>
            ${
              rekapLeger.length > 0
                ? rekapLeger.map((s, idx) => `
                    <tr>
                      <td style="border: 1px solid #000; padding: 5px; text-align: center;">${idx + 1}</td>
                      <td style="border: 1px solid #000; padding: 5px;">${s.nama}</td>
                      <td style="border: 1px solid #000; padding: 5px; text-align: center;">${s.kelas}</td>
                      <td style="border: 1px solid #000; padding: 5px;">${s.mapel}</td>
                      <td style="border: 1px solid #000; padding: 5px; text-align: center;">${s.tugas}</td>
                      <td style="border: 1px solid #000; padding: 5px; text-align: center;">${s.uts}</td>
                      <td style="border: 1px solid #000; padding: 5px; text-align: center;">${s.uas}</td>
                      <td style="border: 1px solid #000; padding: 5px; text-align: center; font-weight: bold;">${s.avg}</td>
                    </tr>
                  `).join('')
                : `<tr><td colspan="8" style="border: 1px solid #000; padding: 10px; text-align: center;">Belum ada data nilai akademik.</td></tr>`
            }
          </tbody>
        </table>
      `
    } else if (jenis === 'jurnal') {
      const selectedK = kelasList.find(k => k.id === Number(filterKelasJurnal))
      judulDoc = `JURNAL AGENDA MENGAJAR HARIAN GURU ${selectedK ? `(${selectedK.nama.toUpperCase()})` : '(SEMUA KELAS)'}`

      let queryAgenda = supabase.from('jurnal_agenda').select('*').eq('semester', selectedSemester).eq('tahun_ajaran', selectedTahunAjaran).order('created_at', { ascending: false })
      if (filterKelasJurnal) queryAgenda = queryAgenda.eq('kelas_id', Number(filterKelasJurnal))
      
      if (filterTanggalJurnal) {
        queryAgenda = queryAgenda.eq('tanggal', filterTanggalJurnal)
      } else if (filterBulanJurnal) {
        queryAgenda = queryAgenda.ilike('tanggal', `${filterBulanJurnal}%`)
      }

      const { data: agendaData } = await queryAgenda

      const uniqueMapels = Array.from(new Set((agendaData || []).map((a: any) => a.mapel).filter(Boolean)))
      const singleMapelJurnal = uniqueMapels.length === 1 ? String(uniqueMapels[0]) : null
      const firstAgenda = (agendaData || [])[0]

      guruCetak = await resolvePenandatanganPDF({
        mode: 'umum',
        guruEmail: firstAgenda?.guru_email,
        mapelId: firstAgenda?.mapel_id,
        mapelNama: singleMapelJurnal,
      })

      contentBody = `
        <h3 style="text-align: center; text-transform: uppercase; margin-bottom: 5px;">${judulDoc}</h3>
        <p style="text-align: center; font-size: 10pt; margin-bottom: 15px;">
          Semester: <b>${selectedSemester}</b> | Tahun Ajaran: <b>${selectedTahunAjaran}</b>
          ${filterTanggalJurnal ? ` | Tanggal: <b>${filterTanggalJurnal}</b>` : filterBulanJurnal ? ` | Bulan: <b>${filterBulanJurnal}</b>` : ''}
        </p>
        <table style="width: 100%; border-collapse: collapse; font-size: 10pt;">
          <thead>
            <tr style="background-color: #f2f2f2;">
              <th style="border: 1px solid #000; padding: 6px;">No</th>
              <th style="border: 1px solid #000; padding: 6px;">Tanggal</th>
              <th style="border: 1px solid #000; padding: 6px;">Jam Mengajar</th>
              <th style="border: 1px solid #000; padding: 6px;">Kelas & Mapel</th>
              <th style="border: 1px solid #000; padding: 6px;">Materi Pembelajaran</th>
              <th style="border: 1px solid #000; padding: 6px;">Absen Siswa</th>
              <th style="border: 1px solid #000; padding: 6px;">Status</th>
            </tr>
          </thead>
          <tbody>
            ${
              (agendaData || []).length > 0
                ? agendaData!.map((a, idx) => `
                    <tr>
                      <td style="border: 1px solid #000; padding: 6px; text-align: center;">${idx + 1}</td>
                      <td style="border: 1px solid #000; padding: 6px; text-align: center;">${a.tanggal || '-'}</td>
                      <td style="border: 1px solid #000; padding: 6px; text-align: center;">${a.jam_ke || '-'}</td>
                      <td style="border: 1px solid #000; padding: 6px;"><b>${a.kelas || ''}</b> ${a.mapel ? `- ${a.mapel}` : ''}</td>
                      <td style="border: 1px solid #000; padding: 6px;">${a.materi || '-'}</td>
                      <td style="border: 1px solid #000; padding: 6px; font-family: monospace; font-size: 9pt;">${a.absen_siswa || 'Nihil'}</td>
                      <td style="border: 1px solid #000; padding: 6px; text-align: center; font-weight: bold;">${a.status || 'SELESAI'}</td>
                    </tr>
                  `).join('')
                : `<tr><td colspan="7" style="border: 1px solid #000; padding: 10px; text-align: center;">Belum ada data agenda mengajar tersimpan.</td></tr>`
            }
          </tbody>
        </table>
      `
    } else if (jenis === 'bimbingan') {
      const selectedK = kelasList.find(k => k.id === Number(filterKelasBimbingan))
      judulDoc = `LAPORAN CATATAN BIMBINGAN GURU WALI ${selectedK ? `(${selectedK.nama.toUpperCase()})` : '(SEMUA KELAS)'}`

      let queryBimbingan = supabase.from('bimbingan_wali').select('*')
      if (selectedK) queryBimbingan = queryBimbingan.eq('kelas', selectedK.nama)
      if (filterBulanBimbingan) queryBimbingan = queryBimbingan.ilike('tanggal', `${filterBulanBimbingan}%`)

      const { data: bimbinganData } = await queryBimbingan

      guruCetak = await resolvePenandatanganPDF({
        mode: 'wali',
        kelasId: filterKelasBimbingan || waliKelasAssignedId || null,
      })

      contentBody = `
        <h3 style="text-align: center; text-transform: uppercase; margin-bottom: 5px;">${judulDoc}</h3>
        ${filterBulanBimbingan ? `<p style="text-align: center; font-size: 10pt; margin-bottom: 15px;">Filter Bulan: <b>${filterBulanBimbingan}</b></p>` : ''}
        <table style="width: 100%; border-collapse: collapse; font-size: 10pt;">
          <thead>
            <tr style="background-color: #f2f2f2;">
              <th style="border: 1px solid #000; padding: 6px;">No</th>
              <th style="border: 1px solid #000; padding: 6px;">Nama Siswa</th>
              <th style="border: 1px solid #000; padding: 6px;">Kelas</th>
              <th style="border: 1px solid #000; padding: 6px;">Topik / Masalah</th>
              <th style="border: 1px solid #000; padding: 6px;">Solusi / Tindak Lanjut</th>
            </tr>
          </thead>
          <tbody>
            ${
              (bimbinganData || []).length > 0
                ? bimbinganData!.map((b, idx) => `
                    <tr>
                      <td style="border: 1px solid #000; padding: 5px; text-align: center;">${idx + 1}</td>
                      <td style="border: 1px solid #000; padding: 5px;">${b.nama_siswa || 'Siswa'}</td>
                      <td style="border: 1px solid #000; padding: 5px; text-align: center;">${b.kelas || '-'}</td>
                      <td style="border: 1px solid #000; padding: 5px;">${b.masalah || '-'}</td>
                      <td style="border: 1px solid #000; padding: 5px;">${b.solusi || b.keterangan_hukuman || '-'}</td>
                    </tr>
                  `).join('')
                : `<tr><td colspan="5" style="border: 1px solid #000; padding: 10px; text-align: center;">Belum ada catatan bimbingan guru wali tersimpan.</td></tr>`
            }
          </tbody>
        </table>
      `
    }

    executePrint(judulDoc, contentBody, guruCetak)
  }

  // GENERATOR DOKUMEN RAPOR PROFESIONAL 2 HALAMAN (UNTUK PDF & MICROSOFT WORD)
  const buildRaporDocumentData = async () => {
    if (!selectedSiswaRapor) {
      alert('Pilih siswa terlebih dahulu untuk mencetak Lembar Rapor!')
      return null
    }

    const targetSiswa = siswaList.find(s => s.id === Number(selectedSiswaRapor))
    if (!targetSiswa) return null

    const kelasObj = kelasList.find(k => Number(k.id) === Number(targetSiswa.kelas_id))
    let namaKelasStr = kelasObj?.nama || '-'
    let tingkatStr = kelasObj?.tingkat || ''

    if (targetSiswa.kelas_id && !kelasObj) {
      const { data: kelasSiswa } = await supabase
        .from('kelas')
        .select('nama_kelas, tingkat')
        .eq('id', targetSiswa.kelas_id)
        .maybeSingle()
      if (kelasSiswa) {
        namaKelasStr = kelasSiswa.nama_kelas
        tingkatStr = kelasSiswa.tingkat || ''
      }
    }

    const { data: allMapelDb } = await supabase
      .from('mapel')
      .select('id, nama_mapel')
      .order('nama_mapel', { ascending: true })

    const semuaMapel = (allMapelDb || []).map(m => ({ id: m.id, nama: m.nama_mapel }))

    const { data: nilaiSiswa } = await supabase
      .from('nilai')
      .select('*')
      .eq('siswa_id', targetSiswa.id)
      .eq('semester', selectedSemester)
      .eq('tahun_ajaran', selectedTahunAjaran)

    const { data: absensiSiswa } = await supabase
      .from('absensi')
      .select('tanggal, status, jam_ke')
      .eq('siswa_id', targetSiswa.id)
      .eq('semester', selectedSemester)
      .eq('tahun_ajaran', selectedTahunAjaran)

    const waliKelasInfo = await resolveWaliKelasByKelasId(targetSiswa.kelas_id || filterKelasRapor)

    const presensiHarianMap = new Map<string, string>()
    ;(absensiSiswa || []).forEach(a => {
      const tgl = a.tanggal
      const jamStr = a.jam_ke || ''
      const isJam1 = jamStr.includes('Jam Ke-1') || jamStr.includes('Ke-1')

      if (!presensiHarianMap.has(tgl) || isJam1) {
        presensiHarianMap.set(tgl, a.status)
      }
    })

    const statusList = Array.from(presensiHarianMap.values())
    const sakit = statusList.filter(st => st === 'SAKIT').length
    const izin = statusList.filter(st => st === 'IZIN').length
    const alpa = statusList.filter(st => st === 'ALPA').length

    const mapelUtama = semuaMapel.filter(m => !/qiro|pramuka|ekstra/i.test(m.nama))
    const mapelEkskul = semuaMapel.filter(m => /qiro|pramuka|ekstra/i.test(m.nama))

    const rowQiroah = (nilaiSiswa || []).find(n => /qiro/i.test(n.mata_pelajaran || ''))
    const nilaiQiroahNum = rowQiroah
      ? Math.round(
          [rowQiroah.nilai_tugas, rowQiroah.nilai_uts, rowQiroah.nilai_uas]
            .filter((v): v is number => typeof v === 'number' && v > 0)
            .reduce((a, b, _, arr) => a + b / arr.length, 0)
        ) || 85
      : 85
    const predikatQiroah = getPredikatRapor(nilaiQiroahNum, "Qiro'ah & Tahfidz")

    let teksKeputusan = ''
    if (selectedSemester === 'Genap') {
      const upperKelas = namaKelasStr.toUpperCase()
      if (tingkatStr === '7' || upperKelas.startsWith('VII ')) {
        teksKeputusan = 'NAIK KE KELAS VIII (DELAPAN)'
      } else if (tingkatStr === '8' || upperKelas.startsWith('VIII ')) {
        teksKeputusan = 'NAIK KE KELAS IX (SEMBILAN)'
      } else {
        teksKeputusan = 'LULUS DARI SATUAN PENDIDIKAN'
      }
    }

    const originUrl = typeof window !== 'undefined' ? window.location.origin : ''

    const htmlRaporLengkap = `
      <!-- WATERMARK LOGO HALUS -->
      <div class="watermark">
        <img src="${originUrl}/logo-smp.jpg" alt="Watermark SMP" />
      </div>

      <!-- ==================== HALAMAN 1: IDENTITAS & CAPAIAN AKADEMIK ==================== -->
      <div class="page-section">
        <div style="text-align: center; margin-bottom: 10px;">
          <img src="${originUrl}/kop-surat.png" alt="Kop Surat" style="width: 100%; max-height: 130px; object-fit: contain;" />
        </div>

        <div style="text-align: center; margin-bottom: 14px;">
          <h2 style="margin: 0; font-size: 13pt; letter-spacing: 0.8px; text-transform: uppercase;">LAPORAN HASIL BELAJAR PESERTA DIDIK</h2>
          <p style="margin: 2px 0 0 0; font-size: 10pt; font-weight: bold;">(RAPOR AKADEMIK SEMESTER ${selectedSemester.toUpperCase()})</p>
        </div>

        <table class="table-identitas">
          <tr>
            <td style="width: 18%;">Nama Peserta Didik</td>
            <td style="width: 36%;">: <b>${targetSiswa.nama_lengkap.toUpperCase()}</b></td>
            <td style="width: 18%;">Kelas</td>
            <td style="width: 28%;">: <b>${namaKelasStr}</b></td>
          </tr>
          <tr>
            <td>NISN</td>
            <td>: ${targetSiswa.nisn || '-'}</td>
            <td>Semester</td>
            <td>: ${selectedSemester}</td>
          </tr>
          <tr>
            <td>Nama Sekolah</td>
            <td>: SMP Muna Mustofa</td>
            <td>Tahun Pelajaran</td>
            <td>: ${selectedTahunAjaran}</td>
          </tr>
        </table>

        <h4 class="section-title">A. CAPAIAN KOMPETENSI AKADEMIK</h4>
        <table class="table-data">
          <thead>
            <tr>
              <th style="width: 5%; text-align: center;">No</th>
              <th style="width: 25%; text-align: left;">Mata Pelajaran</th>
              <th style="width: 7%; text-align: center;">KKM</th>
              <th style="width: 10%; text-align: center;">Nilai Akhir</th>
              <th style="width: 13%; text-align: center;">Predikat</th>
              <th style="width: 40%; text-align: left;">Capaian Kompetensi</th>
            </tr>
          </thead>
          <tbody>
            ${
              mapelUtama.map((mapel, idx) => {
                const rowN = (nilaiSiswa || []).find(n => n.mata_pelajaran === mapel.nama) || {}
                const t = rowN.nilai_tugas ?? 0
                const u = rowN.nilai_uts ?? 0
                const a = rowN.nilai_uas ?? 0
                const komps = [t, u, a].filter(v => v > 0)
                const hasNilai = komps.length > 0
                const avgNum = hasNilai ? Math.round(komps.reduce((x, y) => x + y, 0) / komps.length) : 0
                const predObj = hasNilai ? getPredikatRapor(avgNum, mapel.nama) : null

                return `
                  <tr>
                    <td style="text-align: center;">${idx + 1}</td>
                    <td><b>${mapel.nama}</b></td>
                    <td style="text-align: center;">75</td>
                    <td style="text-align: center; font-weight: bold; font-size: 10.5pt;">${hasNilai ? avgNum : '-'}</td>
                    <td style="text-align: center; font-weight: bold;">
                      ${predObj ? `${predObj.huruf} (${predObj.keterangan})` : '-'}
                    </td>
                    <td style="font-size: 8.8pt; text-align: justify;">
                      ${predObj ? predObj.deskripsi : `Capaian kompetensi mata pelajaran ${mapel.nama} sedang dalam proses penilaian semester.`}
                    </td>
                  </tr>
                `
              }).join('')
            }
          </tbody>
        </table>
      </div>

      <!-- ==================== HALAMAN 2: KEAGAMAAN, EKSKUL, KEHADIRAN & PENGESAHAN ==================== -->
      <div class="page-break"></div>

      <div class="page-section">
        <div style="border-bottom: 1.5px solid #000; padding-bottom: 4px; margin-bottom: 12px; display: flex; justify-content: space-between; font-size: 9pt;">
          <span>Nama Peserta Didik: <b>${targetSiswa.nama_lengkap.toUpperCase()}</b> (${targetSiswa.nisn || '-'})</span>
          <span>Kelas: <b>${namaKelasStr}</b> | Semester ${selectedSemester} TA ${selectedTahunAjaran}</span>
        </div>

        <h4 class="section-title">B. PEMBIASAAN KEAGAMAAN &amp; QIRO&apos;AH (CIRI KHAS SEKOLAH)</h4>
        <table class="table-data" style="margin-bottom: 14px;">
          <thead>
            <tr>
              <th style="width: 5%; text-align: center;">No</th>
              <th style="width: 28%; text-align: left;">Aspek Pembiasaan</th>
              <th style="width: 15%; text-align: center;">Predikat</th>
              <th style="width: 52%; text-align: left;">Keterangan Capaian</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="text-align: center;">1</td>
              <td><b>Qiro&apos;ah &amp; Tahsin Al-Qur&apos;an</b></td>
              <td style="text-align: center; font-weight: bold;">${predikatQiroah.huruf} (${predikatQiroah.keterangan})</td>
              <td style="font-size: 9pt;">Mampu membaca Al-Qur&apos;an sesuai kaidah tajwid dan makharijul huruf dengan ${predikatQiroah.keterangan.toLowerCase()}.</td>
            </tr>
            <tr>
              <td style="text-align: center;">2</td>
              <td><b>Shalat Berjamaah &amp; Adab Islami</b></td>
              <td style="text-align: center; font-weight: bold;">A (Sangat Baik)</td>
              <td style="font-size: 9pt;">Membiasakan shalat berjamaah di sekolah, berakhlak santun kepada guru, serta menghormati sesama teman.</td>
            </tr>
          </tbody>
        </table>

        <h4 class="section-title">C. KEGIATAN EKSTRAKURIKULER</h4>
        <table class="table-data" style="margin-bottom: 14px;">
          <thead>
            <tr>
              <th style="width: 5%; text-align: center;">No</th>
              <th style="width: 28%; text-align: left;">Kegiatan Ekstrakurikuler</th>
              <th style="width: 15%; text-align: center;">Predikat</th>
              <th style="width: 52%; text-align: left;">Keterangan</th>
            </tr>
          </thead>
          <tbody>
            ${
              mapelEkskul.length > 0
                ? mapelEkskul.map((m, idx) => {
                    const rowN = (nilaiSiswa || []).find(n => n.mata_pelajaran === m.nama) || {}
                    const avg = rowN.nilai_uas ?? rowN.nilai_tugas ?? 85
                    const predObj = getPredikatRapor(avg, m.nama)
                    return `
                      <tr>
                        <td style="text-align: center;">${idx + 1}</td>
                        <td><b>${m.nama}</b></td>
                        <td style="text-align: center; font-weight: bold;">${predObj.huruf} (${predObj.keterangan})</td>
                        <td style="font-size: 9pt;">Aktif dan disiplin mengikuti kegiatan ${m.nama} dengan capaian ${predObj.keterangan.toLowerCase()}.</td>
                      </tr>
                    `
                  }).join('')
                : `
                  <tr>
                    <td style="text-align: center;">1</td>
                    <td><b>Pramuka</b></td>
                    <td style="text-align: center; font-weight: bold;">B (Baik)</td>
                    <td style="font-size: 9pt;">Aktif mengikuti kegiatan kepramukaan, kerja sama tim, dan kedisiplinan di sekolah.</td>
                  </tr>
                `
            }
          </tbody>
        </table>

        <!-- D. KETIDAKHADIRAN & E. CATATAN WALI KELAS (2 KOLOM BERDAMPINGAN) -->
        <table style="width: 100%; border: none; border-collapse: collapse; margin-bottom: 14px;">
          <tr>
            <td style="width: 38%; vertical-align: top; padding-right: 12px; border: none;">
              <h4 class="section-title">D. KETIDAKHADIRAN</h4>
              <table class="table-data">
                <tr>
                  <td style="width: 65%;">1. Sakit</td>
                  <td style="width: 35%; text-align: center;"><b>${sakit}</b> hari</td>
                </tr>
                <tr>
                  <td>2. Izin</td>
                  <td style="text-align: center;"><b>${izin}</b> hari</td>
                </tr>
                <tr>
                  <td>3. Tanpa Keterangan</td>
                  <td style="text-align: center;"><b>${alpa}</b> hari</td>
                </tr>
              </table>
            </td>
            <td style="width: 62%; vertical-align: top; border: none;">
              <h4 class="section-title">E. CATATAN WALI KELAS</h4>
              <div style="border: 1px solid #000; padding: 10px; min-height: 76px; font-size: 9.5pt; font-style: italic; background-color: #fafafa;">
                &ldquo;Pertahankan semangat belajar, kedisiplinan, dan akhlak mulia baik di lingkungan sekolah maupun di rumah. Terus tingkatkan prestasi pada semester berikutnya.&rdquo;
              </div>
            </td>
          </tr>
        </table>

        ${
          selectedSemester === 'Genap'
            ? `
              <div style="border: 1.5px solid #000; padding: 10px 14px; margin-bottom: 16px; background-color: #f8fafc;">
                <p style="margin: 0; font-size: 10pt;">
                  <b>KEPUTUSAN:</b> Berdasarkan pencapaian seluruh kompetensi pada Semester Ganjil dan Genap Tahun Pelajaran ${selectedTahunAjaran}, peserta didik dinyatakan:
                </p>
                <p style="margin: 6px 0 0 0; font-size: 11pt; font-weight: bold; text-align: center; letter-spacing: 0.5px;">
                  ${teksKeputusan}
                </p>
              </div>
            `
            : ''
        }

        <!-- TANDA TANGAN 3 PIHAK (ORANG TUA, WALI KELAS, KEPALA SEKOLAH) -->
        <div style="margin-top: 18px; page-break-inside: avoid;">
          <table style="width: 100%; border: none; font-size: 9.5pt;">
            <tr>
              <td style="width: 45%; border: none; text-align: center; vertical-align: top;">
                Mengetahui,<br/>
                <strong>Orang Tua / Wali Peserta Didik</strong><br/><br/><br/><br/>
                ( .................................................... )
              </td>
              <td style="width: 10%; border: none;"></td>
              <td style="width: 45%; border: none; text-align: center; vertical-align: top;">
                ${kotaTtd}, ${currentDateStr}<br/>
                <strong>${waliKelasInfo.jabatanLabel}</strong><br/><br/><br/><br/>
                <u><strong>${waliKelasInfo.nama}</strong></u><br/>
                NUPTK: ${waliKelasInfo.nuptk}
              </td>
            </tr>
            <tr>
              <td colspan="3" style="border: none; text-align: center; padding-top: 14px; vertical-align: top;">
                Mengetahui,<br/>
                <strong>Kepala Sekolah</strong><br/>
                <div style="position: relative; height: 68px; display: flex; align-items: center; justify-content: center;">
                  ${
                    pakaiTtdCapKepsek
                      ? `
                        <img src="${originUrl}/stempel-sekolah.png" alt="Stempel" style="position: absolute; left: 41%; top: 0px; height: 72px; opacity: 0.9; z-index: 1;" />
                        <img src="${originUrl}/ttd-kepsek.png" alt="TTD Kepsek" style="position: absolute; left: 46%; top: 4px; height: 58px; z-index: 2;" />
                      `
                      : '<br/><br/>'
                  }
                </div>
                <u><strong>${namaKepsek}</strong></u><br/>
                ${nipKepsek}
              </td>
            </tr>
          </table>
        </div>
      </div>
    `

    return {
      targetSiswa,
      namaKelasStr,
      htmlRaporLengkap,
    }
  }

  // CETAK PDF RAPOR SISWA (2 HALAMAN STANDAR PROFESIONAL)
  const handlePrintRaporSiswa = async () => {
    const docData = await buildRaporDocumentData()
    if (!docData) return

    const printWindow = window.open('', '_blank')
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>RAPOR SISWA - ${docData.targetSiswa.nama_lengkap.toUpperCase()} (${docData.namaKelasStr})</title>
            <style>
              @page { margin: 1.3cm 1.5cm; size: A4; }
              body { font-family: 'Times New Roman', Times, serif; color: #000; line-height: 1.35; font-size: 10pt; margin: 0; padding: 0; }
              .watermark {
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                opacity: 0.06;
                z-index: -1;
                pointer-events: none;
              }
              .watermark img { width: 420px; height: 420px; object-fit: contain; }
              .table-identitas { width: 100%; border: none; border-collapse: collapse; margin-bottom: 12px; font-size: 10pt; }
              .table-identitas td { border: none; padding: 2px 4px; vertical-align: top; }
              .section-title { margin: 0 0 6px 0; font-size: 10pt; text-transform: uppercase; letter-spacing: 0.3px; }
              .table-data { width: 100%; border-collapse: collapse; font-size: 9.5pt; }
              .table-data th { background-color: #f1f5f9; border: 1px solid #000; padding: 6px; font-weight: bold; }
              .table-data td { border: 1px solid #000; padding: 5px 6px; vertical-align: middle; }
              .page-break { page-break-before: always; }
            </style>
          </head>
          <body>
            ${docData.htmlRaporLengkap}
          </body>
        </html>
      `)
      printWindow.document.close()
      setTimeout(() => { printWindow.print() }, 500)
    }
  }

  // DOWNLOAD WORD (.DOC) RAPOR SISWA AGAR BISA DIEDIT MANUAL
  const handleDownloadRaporWord = async () => {
    const docData = await buildRaporDocumentData()
    if (!docData) return

    const wordHtml = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
        <head>
          <meta charset="utf-8" />
          <title>Rapor_${docData.targetSiswa.nama_lengkap}</title>
          <style>
            @page WordSection1 {
              size: 21cm 29.7cm;
              margin: 1.3cm 1.5cm 1.3cm 1.5cm;
            }
            div.WordSection1 { page: WordSection1; }
            body { font-family: 'Times New Roman', Times, serif; font-size: 10pt; line-height: 1.35; color: #000; }
            .watermark { display: none; }
            .table-identitas { width: 100%; border: none; border-collapse: collapse; margin-bottom: 12px; font-size: 10pt; }
            .table-identitas td { border: none; padding: 2px 4px; vertical-align: top; }
            .section-title { margin: 0 0 6px 0; font-size: 10pt; text-transform: uppercase; }
            .table-data { width: 100%; border-collapse: collapse; font-size: 9.5pt; }
            .table-data th { background-color: #f1f5f9; border: 1px solid #000; padding: 6px; font-weight: bold; }
            .table-data td { border: 1px solid #000; padding: 5px 6px; vertical-align: middle; }
            .page-break { page-break-before: always; mso-break-type: section-break; }
          </style>
        </head>
        <body>
          <div class="WordSection1">
            ${docData.htmlRaporLengkap}
          </div>
        </body>
      </html>
    `

    const blob = new Blob(['\ufeff', wordHtml], {
      type: 'application/msword',
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    const safeName = docData.targetSiswa.nama_lengkap.replace(/[^a-zA-Z0-9]/g, '_')
    link.href = url
    link.download = `Rapor_${safeName}_${docData.namaKelasStr.replace(/\s+/g, '')}_${selectedSemester}.doc`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const handleExportLegerExcel = async () => {
    let querySiswa = supabase.from('siswa').select('*, kelas:kelas_id(nama_kelas)').order('nama_lengkap', { ascending: true })
    if (filterKelasLeger) querySiswa = querySiswa.eq('kelas_id', Number(filterKelasLeger))
    const { data: siswaData } = await querySiswa

    let queryNilai = supabase.from('nilai').select('*').eq('semester', selectedSemester).eq('tahun_ajaran', selectedTahunAjaran)
    if (filterKelasLeger) queryNilai = queryNilai.eq('kelas_id', Number(filterKelasLeger))
    if (filterMapelLeger) queryNilai = queryNilai.eq('mapel_id', Number(filterMapelLeger))
    const { data: nilaiData } = await queryNilai

    const rows = (siswaData || []).map((s, idx) => {
      const listN = (nilaiData || []).filter(n => Number(n.siswa_id) === Number(s.id))
      const n = listN.length > 0 ? listN[listN.length - 1] : {}
      const tugas = n.nilai_tugas ?? 0
      const uts = n.nilai_uts ?? 0
      const uas = n.nilai_uas ?? 0
      const komps = [tugas, uts, uas].filter(v => v > 0)
      const avg = komps.length > 0 ? (komps.reduce((a, b) => a + b, 0) / komps.length).toFixed(1) : '0.0'

      const namaKelas = (s as any).kelas?.nama_kelas || (Array.isArray((s as any).kelas) ? (s as any).kelas[0]?.nama_kelas : '-')

      return [idx + 1, s.nama_lengkap, namaKelas, n.mata_pelajaran || '-', n.nilai_tugas ?? 0, n.nilai_uts ?? 0, n.nilai_uas ?? 0, avg]
    })

    downloadCSV(`Leger_Nilai_${selectedSemester}_${selectedTahunAjaran.replace('/', '-')}`, ['No', 'Nama Siswa', 'Kelas', 'Mapel', 'Tugas', 'UTS', 'UAS', 'Rata-Rata'], rows)
  }

  // RIWAYAT PRESENSI DETAIL BK LENGKAP JAM 1 S/D JAM 8
  const handlePrintRiwayatAbsensi = async () => {
    let query = supabase.from('absensi').select('*').eq('semester', selectedSemester).eq('tahun_ajaran', selectedTahunAjaran).order('tanggal', { ascending: false })

    if (tanggalAbsensi && tanggalAbsensi.trim() !== '') query = query.eq('tanggal', tanggalAbsensi.trim())
    if (bulanAbsensiDetail) query = query.ilike('tanggal', `${bulanAbsensiDetail}%`)
    if (kelasRiwayatAbsensi) query = query.eq('kelas_id', Number(kelasRiwayatAbsensi))

    const { data: absensiData } = await query
    const selectedK = kelasList.find(k => k.id === Number(kelasRiwayatAbsensi))
    const judulDoc = `LAPORAN DETAIL PRESENSI SISWA BK (JAM KE-1 S/D JAM KE-8) ${selectedK ? `(${selectedK.nama.toUpperCase()})` : '(SEMUA KELAS)'}`

    const guruCetak = await resolvePenandatanganPDF({
      mode: 'umum',
    })

    const matrixMap = new Map<string, { nama: string; kelas: string; tanggal: string; jam: { [key: number]: string } }>()

    ;(absensiData || []).forEach(a => {
      const key = `${a.siswa_id}_${a.tanggal}`
      if (!matrixMap.has(key)) {
        matrixMap.set(key, {
          nama: a.nama_siswa,
          kelas: a.kelas || '-',
          tanggal: a.tanggal,
          jam: {}
        })
      }
      
      const record = matrixMap.get(key)!
      const jamMatch = (a.jam_ke || '').match(/Jam Ke-(\d+)/i) || (a.jam_ke || '').match(/Ke-(\d+)/i)
      const jamNum = jamMatch ? parseInt(jamMatch[1]) : 1
      record.jam[jamNum] = a.status
    })

    const matrixRows = Array.from(matrixMap.values())

    const contentBody = `
      <h3 style="text-align: center; text-transform: uppercase; margin-bottom: 5px;">${judulDoc}</h3>
      <p style="text-align: center; font-size: 9.5pt; margin-bottom: 15px;">
        Semester: <b>${selectedSemester}</b> | Tahun Ajaran: <b>${selectedTahunAjaran}</b>
        ${tanggalAbsensi ? ` | Tanggal: <b>${tanggalAbsensi}</b>` : ''}
        ${bulanAbsensiDetail ? ` | Bulan: <b>${bulanAbsensiDetail}</b>` : ''}
      </p>

      <table style="width: 100%; border-collapse: collapse; font-size: 8.5pt;">
        <thead>
          <tr style="background-color: #f2f2f2;">
            <th style="border: 1px solid #000; padding: 4px;">No</th>
            <th style="border: 1px solid #000; padding: 4px;">Tanggal</th>
            <th style="border: 1px solid #000; padding: 4px;">Nama Siswa</th>
            <th style="border: 1px solid #000; padding: 4px;">Kelas</th>
            <th style="border: 1px solid #000; padding: 4px;">J-1</th>
            <th style="border: 1px solid #000; padding: 4px;">J-2</th>
            <th style="border: 1px solid #000; padding: 4px;">J-3</th>
            <th style="border: 1px solid #000; padding: 4px;">J-4</th>
            <th style="border: 1px solid #000; padding: 4px;">J-5</th>
            <th style="border: 1px solid #000; padding: 4px;">J-6</th>
            <th style="border: 1px solid #000; padding: 4px;">J-7</th>
            <th style="border: 1px solid #000; padding: 4px;">J-8</th>
            <th style="border: 1px solid #000; padding: 4px;">Catatan BK</th>
          </tr>
        </thead>
        <tbody>
          ${
            matrixRows.length > 0
              ? matrixRows.map((r, idx) => {
                  let statusBolos = false
                  if (r.jam[1] === 'HADIR') {
                    for (let j = 2; j <= 8; j++) {
                      if (r.jam[j] === 'ALPA') statusBolos = true
                    }
                  }

                  return `
                    <tr>
                      <td style="border: 1px solid #000; padding: 4px; text-align: center;">${idx + 1}</td>
                      <td style="border: 1px solid #000; padding: 4px; text-align: center;">${r.tanggal}</td>
                      <td style="border: 1px solid #000; padding: 4px;">${r.nama}</td>
                      <td style="border: 1px solid #000; padding: 4px; text-align: center;">${r.kelas}</td>
                      ${[1, 2, 3, 4, 5, 6, 7, 8].map(j => {
                        const st = r.jam[j] || '-'
                        const color = st === 'HADIR' ? '#d1fae5' : st === 'ALPA' ? '#ffe4e6' : st === 'IZIN' || st === 'SAKIT' ? '#fef3c7' : '#ffffff'
                        return `<td style="border: 1px solid #000; padding: 4px; text-align: center; background-color: ${color}; font-weight: bold;">${st.charAt(0)}</td>`
                      }).join('')}
                      <td style="border: 1px solid #000; padding: 4px; text-align: center; font-weight: bold; color: ${statusBolos ? 'red' : 'green'};">
                        ${statusBolos ? '⚠️ Terindikasi Bolos KBM' : 'Nihil'}
                      </td>
                    </tr>
                  `
                }).join('')
              : `<tr><td colspan="13" style="border: 1px solid #000; padding: 10px; text-align: center;">Belum ada riwayat presensi detail untuk filter ini.</td></tr>`
          }
        </tbody>
      </table>
    `

    executePrint(judulDoc, contentBody, guruCetak)
  }

  const handlePrintRiwayatNilai = async () => {
    let query = supabase.from('nilai').select('*, siswa:siswa_id(nama_lengkap, kelas:kelas_id(nama_kelas))').eq('semester', selectedSemester).eq('tahun_ajaran', selectedTahunAjaran).order('created_at', { ascending: false })
    if (kelasNilai) query = query.eq('kelas_id', Number(kelasNilai))
    if (mapelNilai) query = query.eq('mapel_id', Number(mapelNilai))

    const { data: nilaiData } = await query
    const selectedK = kelasList.find(k => k.id === Number(kelasNilai))
    const selectedM = mapelList.find(m => m.id === Number(mapelNilai))

    const guruCetak = await resolvePenandatanganPDF({
      mode: 'mapel',
      mapelId: mapelNilai || null,
    })

    const judulDoc = `LAPORAN RIWAYAT INPUT NILAI AKADEMIK ${selectedK ? `(${selectedK.nama.toUpperCase()})` : '(SEMUA KELAS)'} ${selectedM ? `- ${selectedM.nama.toUpperCase()}` : ''}`

    const contentBody = `
      <h3 style="text-align: center; text-transform: uppercase; margin-bottom: 15px;">${judulDoc}</h3>
      <table style="width: 100%; border-collapse: collapse; font-size: 10pt;">
        <thead>
          <tr style="background-color: #f2f2f2;">
            <th style="border: 1px solid #000; padding: 6px;">No</th>
            <th style="border: 1px solid #000; padding: 6px;">Tanggal Input</th>
            <th style="border: 1px solid #000; padding: 6px;">Nama Siswa</th>
            <th style="border: 1px solid #000; padding: 6px;">Mata Pelajaran</th>
            <th style="border: 1px solid #000; padding: 6px;">Tugas</th>
            <th style="border: 1px solid #000; padding: 6px;">UTS</th>
            <th style="border: 1px solid #000; padding: 6px;">UAS</th>
          </tr>
        </thead>
        <tbody>
          ${
            (nilaiData || []).length > 0
              ? nilaiData!.map((n: { created_at?: string; siswa?: { nama_lengkap?: string }; mata_pelajaran?: string; nilai_tugas?: number; nilai_uts?: number; nilai_uas?: number }, idx: number) => `
                  <tr>
                    <td style="border: 1px solid #000; padding: 5px; text-align: center;">${idx + 1}</td>
                    <td style="border: 1px solid #000; padding: 5px; text-align: center;">${n.created_at ? new Date(n.created_at).toLocaleDateString('id-ID') : '-'}</td>
                    <td style="border: 1px solid #000; padding: 5px;">${n.siswa?.nama_lengkap || '-'}</td>
                    <td style="border: 1px solid #000; padding: 5px;">${n.mata_pelajaran || '-'}</td>
                    <td style="border: 1px solid #000; padding: 5px; text-align: center;">${n.nilai_tugas ?? '-'}</td>
                    <td style="border: 1px solid #000; padding: 5px; text-align: center;">${n.nilai_uts ?? '-'}</td>
                    <td style="border: 1px solid #000; padding: 5px; text-align: center;">${n.nilai_uas ?? '-'}</td>
                  </tr>
                `).join('')
              : `<tr><td colspan="7" style="border: 1px solid #000; padding: 10px; text-align: center;">Belum ada riwayat input nilai akademik untuk filter ini.</td></tr>`
          }
        </tbody>
      </table>
    `

    executePrint(judulDoc, contentBody, guruCetak)
  }

  const executePrint = (
    judulDoc: string,
    contentBody: string,
    guruInfo: GuruInfo = {
      nama: namaGuru,
      nuptk: nuptkGuru,
      jabatanLabel: 'Guru Mata Pelajaran',
    }
  ) => {
    const printWindow = window.open('', '_blank')
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>${judulDoc} - SMP MUNA MUSTOFA</title>
            <style>
              @page { margin: 1.5cm; size: A4; }
              body { font-family: 'Times New Roman', Times, serif; color: #000; line-height: 1.4; }
              th, td { border: 1px solid #000; padding: 6px; }
            </style>
          </head>
          <body>
            ${headerKopHTML}
            ${contentBody}
            ${getFooterTtdHTML(guruInfo)}
          </body>
        </html>
      `)
      printWindow.document.close()
      setTimeout(() => { printWindow.print() }, 500)
    }
  }

  const handleSimpanPengaturan = () => {
    const dataToSave = {
      namaKepsek,
      nipKepsek,
      kotaTtd,
      pakaiTtdCapKepsek
    }
    localStorage.setItem('pengaturan_laporan', JSON.stringify(dataToSave))
    alert('✅ Pengaturan profil kepsek & stempel cetakan berhasil disimpan secara permanen!')
  }

  // Kelas yang tersedia di dropdown Rapor: Operator melihat semua kelas, Wali Kelas hanya kelas binaan
  const kelasRaporOptions = isStrictOperatorRole
    ? kelasList
    : waliKelasAssignedId
      ? kelasList.filter(k => Number(k.id) === Number(waliKelasAssignedId))
      : []

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
                <p className={`text-[11px] font-bold mt-0.5 ${isDarkMode ? 'text-emerald-400' : 'text-emerald-800'}`}>Pusat Laporan &amp; Cetak Dokumen</p>
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
                {tahunAjaranOptions.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            {/* BADGE PROFIL POJOK KANAN ATAS: NAMA LENGKAP GURU + NUPTK */}
            <div className={`border text-xs font-bold px-3.5 py-1.5 rounded-xl flex items-center gap-2.5 shadow-xs ${
              isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-100' : 'bg-white border-slate-300 text-slate-800'
            }`}>
              <span className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[11px] font-bold shrink-0">
                {userDisplayName.charAt(0)}
              </span>
              <div className="flex flex-col leading-tight">
                <span className="font-extrabold">{userDisplayName}</span>
                <span className={`text-[10px] font-mono ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  NUPTK: {userNuptkDisplay}
                </span>
              </div>
              <span className={`text-[10px] px-2 py-0.5 rounded-md font-extrabold uppercase ml-1 border ${
                isDarkMode ? 'bg-indigo-950 text-indigo-300 border-indigo-800' : 'bg-indigo-100 text-indigo-800 border-indigo-200'
              }`}>
                {isStrictOperatorRole ? 'Operator' : waliKelasAssignedId ? 'Wali Kelas' : 'Guru'}
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
          <div className="max-w-6xl mx-auto flex items-center justify-between text-xs font-bold">
            <div className="flex items-center gap-2">
              <span className={`font-black pr-2 border-r flex items-center gap-1 ${isDarkMode ? 'text-indigo-400 border-slate-800' : 'text-indigo-900 border-slate-300'}`}>
                🖨️ Laporan:
              </span>
              <button
                onClick={() => setActiveTab('pusat')}
                className={`px-3.5 py-1.5 rounded-xl transition flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'pusat' 
                    ? 'bg-indigo-600 text-white shadow-xs font-extrabold' 
                    : isDarkMode ? 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700' : 'bg-white/80 text-slate-700 hover:bg-white border border-slate-300'
                }`}
              >
                <span>🖨️</span> Pusat Cetak Laporan
              </button>
              <button
                onClick={() => setActiveTab('pengaturan')}
                className={`px-3.5 py-1.5 rounded-xl transition flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'pengaturan' 
                    ? 'bg-indigo-600 text-white shadow-xs font-extrabold' 
                    : isDarkMode ? 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700' : 'bg-white/80 text-slate-700 hover:bg-white border border-slate-300'
                }`}
              >
                <span>⚙️</span> Pengaturan TTD Kepsek
              </button>
            </div>

            <label className="flex items-center gap-2 text-xs font-bold cursor-pointer select-none bg-indigo-100 text-indigo-900 px-3 py-1.5 rounded-xl border border-indigo-300 shadow-xs">
              <input
                type="checkbox"
                checked={pakaiTtdCapKepsek}
                onChange={(e) => setPakaiTtdCapKepsek(e.target.checked)}
                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
              />
              <span>🔏 Sertakan TTD &amp; Stempel Resmi Kepsek pada Cetakan</span>
            </label>
          </div>
        </div>

        <main className="max-w-6xl w-full mx-auto p-4 flex-1 flex flex-col min-h-0 overflow-y-auto space-y-4">
          {activeTab === 'pusat' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-12">
              
              {/* DOWNLOAD WORD NASKAH SOAL & KUNCI JAWABAN (FORMAT 2 KOLOM HEMAT KERTAS, SIAP EDIT) */}
              <div className="md:col-span-2 bg-gradient-to-r from-amber-700 via-orange-800 to-amber-950 text-white rounded-2xl p-4 shadow-md space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-extrabold text-sm">
                    <span>📝</span>
                    <h3>Download Naskah Soal Ulangan (.DOC Word — 2 Kolom Hemat Kertas)</h3>
                  </div>
                  <span className="text-[10px] bg-amber-950/80 border border-amber-400/40 px-2.5 py-0.5 rounded-full font-bold text-amber-200">
                    Format Word (.doc) Siap Edit • Tanpa Kunci Jawaban
                  </span>
                </div>
                <p className="text-xs text-amber-100 font-medium">
                  Naskah otomatis diunduh dalam format Microsoft Word (.doc) 2 kolom koran (maksimal 2 lembar A4) tanpa kunci jawaban sehingga guru bebas mengedit teks sebelum dicetak.
                </p>
                
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[10px] font-extrabold uppercase mb-1 text-amber-200">
                      1. MAPEL
                    </label>
                    <select
                      value={filterMapelBankSoal}
                      onChange={(e) => setFilterMapelBankSoal(e.target.value)}
                      className="w-full bg-white text-slate-900 border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs font-bold focus:outline-none"
                    >
                      {mapelList.length === 0 ? (
                        <option value="">(Belum Ada Mapel Terdaftar)</option>
                      ) : (
                        mapelList.map((m) => (
                          <option key={m.id} value={m.nama}>{m.nama}</option>
                        ))
                      )}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-extrabold uppercase mb-1 text-amber-200">
                      2. FILTER KELAS
                    </label>
                    <select
                      value={filterKelasBankSoal}
                      onChange={(e) => setFilterKelasBankSoal(e.target.value)}
                      className="w-full bg-white text-slate-900 border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs font-bold focus:outline-none"
                    >
                      <option value="">Semua Kelas</option>
                      {kelasList.map((k) => (
                        <option key={k.id} value={k.nama}>{k.nama}</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-end">
                    <button
                      onClick={handlePrintBankSoal}
                      className="w-full bg-amber-400 hover:bg-amber-500 text-slate-950 font-black py-1.5 rounded-xl text-xs transition shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <span>📝</span> Word Naskah Soal
                    </button>
                  </div>

                  <div className="flex items-end">
                    <button
                      onClick={handlePrintKunciJawaban}
                      className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-black py-1.5 rounded-xl text-xs transition shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <span>🔑</span> Word Kunci Jawaban
                    </button>
                  </div>
                </div>
              </div>

              {/* CETAK RAPOR INDIVIDU SISWA (STANDAR 2 HALAMAN PDF & WORD) */}
              <div className="md:col-span-2 bg-gradient-to-r from-emerald-800 via-teal-800 to-emerald-950 text-white rounded-2xl p-4 shadow-md space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-extrabold text-sm">
                    <span>🎓</span>
                    <h3>Cetak Lembar Rapor Hasil Belajar Peserta Didik (Standar 2 Halaman)</h3>
                  </div>
                  <span className="text-[10px] bg-emerald-950/80 border border-emerald-500/40 px-2.5 py-0.5 rounded-full font-bold text-emerald-200">
                    KKM: 75 (C: 75–78 | B: 79–85 | A: ≥86)
                  </span>
                </div>
                <p className="text-xs text-emerald-100 font-medium">
                  Format rapor resmi lengkap dengan Capaian Kompetensi, Pembiasaan Qiro&apos;ah, Ekstrakurikuler, Catatan Wali Kelas, &amp; TTD 3 Pihak (PDF / Word).
                </p>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-extrabold uppercase mb-1 text-emerald-200">
                      1. KELAS PERWALIAN {(!isStrictOperatorRole && waliKelasAssignedId) ? '(TERKUNCI SESUAI TUGAS)' : ''}
                    </label>
                    <select
                      value={filterKelasRapor}
                      onChange={(e) => {
                        setFilterKelasRapor(e.target.value)
                        setSelectedSiswaRapor('')
                      }}
                      disabled={!isStrictOperatorRole}
                      className="w-full bg-white text-slate-900 border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs font-bold focus:outline-none disabled:bg-emerald-100 disabled:text-emerald-950 disabled:cursor-not-allowed"
                    >
                      {isStrictOperatorRole && <option value="">Pilih Kelas</option>}
                      {kelasRaporOptions.length === 0 ? (
                        <option value="">(Khusus Wali Kelas / Operator)</option>
                      ) : (
                        kelasRaporOptions.map((k) => (
                          <option key={k.id} value={k.id}>{k.nama}</option>
                        ))
                      )}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-extrabold uppercase mb-1 text-emerald-200">2. PILIH PESERTA DIDIK</label>
                    <select
                      value={selectedSiswaRapor}
                      onChange={(e) => setSelectedSiswaRapor(e.target.value)}
                      disabled={!filterKelasRapor}
                      className="w-full bg-white text-slate-900 border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs font-bold focus:outline-none disabled:bg-slate-200"
                    >
                      <option value="">Pilih Siswa</option>
                      {siswaList
                        .filter(s => Number(s.kelas_id) === Number(filterKelasRapor))
                        .map((s) => (
                          <option key={s.id} value={s.id}>{s.nama_lengkap} (NISN: {s.nisn || '-'})</option>
                        ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <button
                    onClick={handlePrintRaporSiswa}
                    disabled={!selectedSiswaRapor}
                    className="w-full bg-amber-400 hover:bg-amber-500 disabled:bg-slate-400 text-slate-950 font-black py-2 rounded-xl text-xs transition shadow-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:cursor-not-allowed"
                  >
                    <span>🖨️</span> Cetak PDF Rapor Resmi
                  </button>

                  <button
                    onClick={handleDownloadRaporWord}
                    disabled={!selectedSiswaRapor}
                    className="w-full bg-sky-500 hover:bg-sky-600 disabled:bg-slate-400 text-white font-black py-2 rounded-xl text-xs transition shadow-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:cursor-not-allowed"
                  >
                    <span>📝</span> Download Word (.doc) untuk Edit Manual
                  </button>
                </div>
              </div>

              {/* ABSENSI */}
              <div className={`backdrop-blur-md border rounded-2xl p-4 shadow-xs flex flex-col justify-between space-y-3 ${
                isDarkMode 
                  ? 'bg-slate-900/90 border-slate-800' 
                  : 'bg-gradient-to-br from-indigo-100/90 via-slate-100/90 to-indigo-50/90 border-indigo-200/80'
              }`}>
                <div>
                  <div className={`flex items-center gap-2 font-extrabold text-sm mb-1 ${isDarkMode ? 'text-indigo-400' : 'text-indigo-950'}`}>
                    <span>📄</span>
                    <h3>Cetak PDF Rekap Presensi Harian</h3>
                  </div>
                  <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>Laporan rekapitulasi presensi siswa per kelas (dihitung per hari dari jam 1).</p>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className={`block text-[10px] font-extrabold uppercase mb-1 ${isDarkMode ? 'text-indigo-300' : 'text-indigo-950'}`}>KELAS</label>
                    <select
                      value={filterKelasAbsensi}
                      onChange={(e) => setFilterKelasAbsensi(e.target.value)}
                      className={`w-full border rounded-xl px-2 py-1 text-xs font-bold focus:outline-none ${
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
                    <label className={`block text-[10px] font-extrabold uppercase mb-1 ${isDarkMode ? 'text-indigo-300' : 'text-indigo-950'}`}>BULAN</label>
                    <input
                      type="month"
                      value={filterBulanAbsensi}
                      onChange={(e) => setFilterBulanAbsensi(e.target.value)}
                      className={`w-full border rounded-xl px-2 py-1 text-xs font-bold focus:outline-none ${
                        isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                      }`}
                    />
                  </div>
                </div>

                <button
                  onClick={() => handlePrintDocument('absensi')}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold py-2 rounded-xl text-xs transition shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <span>🖨️</span> Cetak PDF Absensi
                </button>
              </div>

              {/* LEGER NILAI */}
              <div className={`backdrop-blur-md border rounded-2xl p-4 shadow-xs flex flex-col justify-between space-y-3 ${
                isDarkMode 
                  ? 'bg-slate-900/90 border-slate-800' 
                  : 'bg-gradient-to-br from-indigo-100/90 via-slate-100/90 to-indigo-50/90 border-indigo-200/80'
              }`}>
                <div>
                  <div className={`flex items-center gap-2 font-extrabold text-sm mb-1 ${isDarkMode ? 'text-indigo-400' : 'text-indigo-950'}`}>
                    <span>📄</span>
                    <h3>Cetak PDF Leger Nilai Akademik</h3>
                  </div>
                  <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>Leger nilai akumulasi Tugas, UTS, UAS &amp; Rata-Rata per Mapel.</p>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className={`block text-[10px] font-extrabold uppercase mb-1 ${isDarkMode ? 'text-indigo-300' : 'text-indigo-950'}`}>KELAS</label>
                    <select
                      value={filterKelasLeger}
                      onChange={(e) => setFilterKelasLeger(e.target.value)}
                      className={`w-full border rounded-xl px-2 py-1 text-xs font-bold focus:outline-none ${
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
                    <label className={`block text-[10px] font-extrabold uppercase mb-1 ${isDarkMode ? 'text-indigo-300' : 'text-indigo-950'}`}>MAPEL</label>
                    <select
                      value={filterMapelLeger}
                      onChange={(e) => setFilterMapelLeger(e.target.value)}
                      className={`w-full border rounded-xl px-2 py-1 text-xs font-bold focus:outline-none ${
                        isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                      }`}
                    >
                      {isStrictOperatorRole && <option value="">Semua Mapel</option>}
                      {mapelList.length === 0 ? (
                        <option value="">(Belum Ada Mapel)</option>
                      ) : (
                        mapelList.map((m) => (
                          <option key={m.id} value={m.id}>{m.nama}</option>
                        ))
                      )}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handlePrintDocument('leger')}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold py-2 rounded-xl text-xs transition shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <span>🖨️</span> Cetak PDF
                  </button>
                  <button
                    onClick={handleExportLegerExcel}
                    className="bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold py-2 rounded-xl text-xs transition shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <span>📊</span> Export Excel
                  </button>
                </div>
              </div>

              {/* JURNAL AGENDA HARIAN / BULANAN */}
              <div className={`backdrop-blur-md border rounded-2xl p-4 shadow-xs flex flex-col justify-between space-y-3 ${
                isDarkMode 
                  ? 'bg-slate-900/90 border-slate-800' 
                  : 'bg-gradient-to-br from-indigo-100/90 via-slate-100/90 to-indigo-50/90 border-indigo-200/80'
              }`}>
                <div>
                  <div className={`flex items-center gap-2 font-extrabold text-sm mb-1 ${isDarkMode ? 'text-indigo-400' : 'text-indigo-950'}`}>
                    <span>📄</span>
                    <h3>Jurnal Agenda Mengajar Harian / Bulanan</h3>
                  </div>
                  <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>Dokumen resmi jurnal mengajar harian/bulanan guru pengampu.</p>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className={`block text-[9px] font-extrabold uppercase mb-1 ${isDarkMode ? 'text-indigo-300' : 'text-indigo-950'}`}>KELAS</label>
                    <select
                      value={filterKelasJurnal}
                      onChange={(e) => setFilterKelasJurnal(e.target.value)}
                      className={`w-full border rounded-xl px-2 py-1 text-xs font-bold focus:outline-none ${
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
                    <label className={`block text-[9px] font-extrabold uppercase mb-1 ${isDarkMode ? 'text-indigo-300' : 'text-indigo-950'}`}>TANGGAL (HARIAN)</label>
                    <input
                      type="date"
                      value={filterTanggalJurnal}
                      onChange={(e) => {
                        setFilterTanggalJurnal(e.target.value)
                        if (e.target.value) setFilterBulanJurnal('')
                      }}
                      className={`w-full border rounded-xl px-2 py-1 text-xs font-bold focus:outline-none ${
                        isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                      }`}
                    />
                  </div>

                  <div>
                    <label className={`block text-[9px] font-extrabold uppercase mb-1 ${isDarkMode ? 'text-indigo-300' : 'text-indigo-950'}`}>BULAN (BULANAN)</label>
                    <input
                      type="month"
                      value={filterBulanJurnal}
                      onChange={(e) => {
                        setFilterBulanJurnal(e.target.value)
                        if (e.target.value) setFilterTanggalJurnal('')
                      }}
                      className={`w-full border rounded-xl px-2 py-1 text-xs font-bold focus:outline-none ${
                        isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                      }`}
                    />
                  </div>
                </div>

                <button
                  onClick={() => handlePrintDocument('jurnal')}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold py-2 rounded-xl text-xs transition shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <span>🖨️</span> Cetak PDF Jurnal Agenda
                </button>
              </div>

              {/* BIMBINGAN WALI */}
              <div className={`backdrop-blur-md border rounded-2xl p-4 shadow-xs flex flex-col justify-between space-y-3 ${
                isDarkMode 
                  ? 'bg-slate-900/90 border-slate-800' 
                  : 'bg-gradient-to-br from-indigo-100/90 via-slate-100/90 to-indigo-50/90 border-indigo-200/80'
              }`}>
                <div>
                  <div className={`flex items-center gap-2 font-extrabold text-sm mb-1 ${isDarkMode ? 'text-indigo-400' : 'text-indigo-950'}`}>
                    <span>📄</span>
                    <h3>Catatan Bimbingan Guru Wali</h3>
                  </div>
                  <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>Laporan penanganan siswa perwalian untuk arsip sekolah.</p>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className={`block text-[10px] font-extrabold uppercase mb-1 ${isDarkMode ? 'text-indigo-300' : 'text-indigo-950'}`}>KELAS</label>
                    <select
                      value={filterKelasBimbingan}
                      onChange={(e) => setFilterKelasBimbingan(e.target.value)}
                      className={`w-full border rounded-xl px-2 py-1 text-xs font-bold focus:outline-none ${
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
                    <label className={`block text-[10px] font-extrabold uppercase mb-1 ${isDarkMode ? 'text-indigo-300' : 'text-indigo-950'}`}>BULAN</label>
                    <input
                      type="month"
                      value={filterBulanBimbingan}
                      onChange={(e) => setFilterBulanBimbingan(e.target.value)}
                      className={`w-full border rounded-xl px-2 py-1 text-xs font-bold focus:outline-none ${
                        isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                      }`}
                    />
                  </div>
                </div>

                <button
                  onClick={() => handlePrintDocument('bimbingan')}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold py-2 rounded-xl text-xs transition shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <span>🖨️</span> Cetak PDF Bimbingan Wali
                </button>
              </div>

              {/* RIWAYAT PRESENSI DETAIL BK JAM 1-8 */}
              <div className={`backdrop-blur-md border rounded-2xl p-4 shadow-xs flex flex-col justify-between space-y-3 ${
                isDarkMode 
                  ? 'bg-slate-900/90 border-slate-800' 
                  : 'bg-gradient-to-br from-indigo-100/90 via-slate-100/90 to-indigo-50/90 border-indigo-200/80'
              }`}>
                <div>
                  <div className={`flex items-center gap-2 font-extrabold text-sm mb-1 ${isDarkMode ? 'text-indigo-400' : 'text-indigo-950'}`}>
                    <span>📄</span>
                    <h3>Laporan Detail Presensi BK (Jam Ke-1 s/d 8)</h3>
                  </div>
                  <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>Matriks presensi jam ke-1 hingga ke-8 untuk mendeteksi siswa bolos KBM.</p>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className={`block text-[9px] font-extrabold uppercase mb-1 ${isDarkMode ? 'text-indigo-300' : 'text-indigo-950'}`}>TANGGAL</label>
                    <input
                      type="date"
                      value={tanggalAbsensi}
                      onChange={(e) => setTanggalAbsensi(e.target.value)}
                      className={`w-full border rounded-xl px-2 py-1 text-xs font-bold focus:outline-none ${
                        isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                      }`}
                    />
                  </div>
                  <div>
                    <label className={`block text-[9px] font-extrabold uppercase mb-1 ${isDarkMode ? 'text-indigo-300' : 'text-indigo-950'}`}>BULAN</label>
                    <input
                      type="month"
                      value={bulanAbsensiDetail}
                      onChange={(e) => setBulanAbsensiDetail(e.target.value)}
                      className={`w-full border rounded-xl px-2 py-1 text-xs font-bold focus:outline-none ${
                        isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                      }`}
                    />
                  </div>
                  <div>
                    <label className={`block text-[9px] font-extrabold uppercase mb-1 ${isDarkMode ? 'text-indigo-300' : 'text-indigo-950'}`}>KELAS</label>
                    <select
                      value={kelasRiwayatAbsensi}
                      onChange={(e) => setKelasRiwayatAbsensi(e.target.value)}
                      className={`w-full border rounded-xl px-2 py-1 text-xs font-bold focus:outline-none ${
                        isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                      }`}
                    >
                      <option value="">Semua Kelas</option>
                      {kelasList.map((k) => (
                        <option key={k.id} value={k.id}>{k.nama}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <button
                  onClick={handlePrintRiwayatAbsensi}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold py-2 rounded-xl text-xs transition shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <span>🖨️</span> Cetak Presensi Detail (Jam 1 - 8)
                </button>
              </div>

              {/* RIWAYAT NILAI */}
              <div className={`backdrop-blur-md border rounded-2xl p-4 shadow-xs flex flex-col justify-between space-y-3 ${
                isDarkMode 
                  ? 'bg-slate-900/90 border-slate-800' 
                  : 'bg-gradient-to-br from-indigo-100/90 via-slate-100/90 to-indigo-50/90 border-indigo-200/80'
              }`}>
                <div>
                  <div className={`flex items-center gap-2 font-extrabold text-sm mb-1 ${isDarkMode ? 'text-indigo-400' : 'text-indigo-950'}`}>
                    <span>📄</span>
                    <h3>Laporan Riwayat Input Nilai</h3>
                  </div>
                  <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>Daftar entri nilai Tugas, UTS, dan UAS per mata pelajaran.</p>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className={`block text-[10px] font-extrabold uppercase mb-1 ${isDarkMode ? 'text-indigo-300' : 'text-indigo-950'}`}>KELAS</label>
                    <select
                      value={kelasNilai}
                      onChange={(e) => setKelasNilai(e.target.value)}
                      className={`w-full border rounded-xl px-2 py-1 text-xs font-bold focus:outline-none ${
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
                    <label className={`block text-[10px] font-extrabold uppercase mb-1 ${isDarkMode ? 'text-indigo-300' : 'text-indigo-950'}`}>MAPEL</label>
                    <select
                      value={mapelNilai}
                      onChange={(e) => setMapelNilai(e.target.value)}
                      className={`w-full border rounded-xl px-2 py-1 text-xs font-bold focus:outline-none ${
                        isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                      }`}
                    >
                      {isStrictOperatorRole && <option value="">Semua Mapel</option>}
                      {mapelList.length === 0 ? (
                        <option value="">(Belum Ada Mapel)</option>
                      ) : (
                        mapelList.map((m) => (
                          <option key={m.id} value={m.id}>{m.nama}</option>
                        ))
                      )}
                    </select>
                  </div>
                </div>

                <button
                  onClick={handlePrintRiwayatNilai}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold py-2 rounded-xl text-xs transition shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <span>🖨️</span> Cetak PDF Riwayat Nilai
                </button>
              </div>

            </div>
          )}

          {activeTab === 'pengaturan' && (
            <div className="space-y-4 pb-12">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className={`backdrop-blur-md border rounded-2xl p-4 space-y-3 shadow-xs ${
                  isDarkMode ? 'bg-slate-900/90 border-slate-800' : 'bg-white/90 border-slate-300'
                }`}>
                  <h3 className={`font-extrabold text-xs uppercase border-b pb-2 ${isDarkMode ? 'text-indigo-400 border-slate-800' : 'text-indigo-950 border-slate-200'}`}>
                    IDENTITAS GURU PENGAMPU (OTOMATIS DARI TABEL GURU)
                  </h3>
                  <div className="space-y-2">
                    <div>
                      <label className={`block text-[10px] font-extrabold uppercase mb-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>NAMA LENGKAP &amp; GELAR (LOGIN AKUN)</label>
                      <input
                        type="text"
                        value={namaGuru}
                        readOnly
                        className={`w-full border rounded-xl px-3 py-1.5 text-xs font-bold focus:outline-none cursor-not-allowed ${
                          isDarkMode ? 'bg-slate-800/60 border-slate-700 text-slate-300' : 'bg-slate-200/70 border-slate-300 text-slate-700'
                        }`}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className={`block text-[10px] font-extrabold uppercase mb-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>NUPTK</label>
                        <input
                          type="text"
                          value={nuptkGuru}
                          readOnly
                          className={`w-full border rounded-xl px-3 py-1.5 text-xs font-bold focus:outline-none cursor-not-allowed ${
                            isDarkMode ? 'bg-slate-800/60 border-slate-700 text-slate-300' : 'bg-slate-200/70 border-slate-300 text-slate-700'
                          }`}
                        />
                      </div>
                      <div>
                        <label className={`block text-[10px] font-extrabold uppercase mb-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>JABATAN</label>
                        <input
                          type="text"
                          value={jabatanGuru}
                          readOnly
                          className={`w-full border rounded-xl px-3 py-1.5 text-xs font-bold focus:outline-none cursor-not-allowed ${
                            isDarkMode ? 'bg-slate-800/60 border-slate-700 text-slate-300' : 'bg-slate-200/70 border-slate-300 text-slate-700'
                          }`}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className={`backdrop-blur-md border rounded-2xl p-4 space-y-3 shadow-xs ${
                  isDarkMode ? 'bg-slate-900/90 border-slate-800' : 'bg-white/90 border-slate-300'
                }`}>
                  <h3 className={`font-extrabold text-xs uppercase border-b pb-2 ${isDarkMode ? 'text-indigo-400 border-slate-800' : 'text-indigo-950 border-slate-200'}`}>
                    IDENTITAS KEPALA SEKOLAH (TTD SEBELAH KANAN)
                  </h3>
                  <div className="space-y-2">
                    <div>
                      <label className={`block text-[10px] font-extrabold uppercase mb-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>NAMA KEPALA SEKOLAH</label>
                      <input
                        type="text"
                        value={namaKepsek}
                        onChange={(e) => setNamaKepsek(e.target.value)}
                        className={`w-full border rounded-xl px-3 py-1.5 text-xs font-bold focus:outline-none ${
                          isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                        }`}
                      />
                    </div>
                    <div>
                      <label className={`block text-[10px] font-extrabold uppercase mb-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>NIP / NUPTK KEPALA SEKOLAH</label>
                      <input
                        type="text"
                        value={nipKepsek}
                        onChange={(e) => setNipKepsek(e.target.value)}
                        className={`w-full border rounded-xl px-3 py-1.5 text-xs font-bold focus:outline-none ${
                          isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                        }`}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className={`backdrop-blur-md border rounded-2xl p-4 space-y-3 shadow-xs ${
                isDarkMode ? 'bg-slate-900/90 border-slate-800' : 'bg-white/90 border-slate-300'
              }`}>
                <h3 className={`font-extrabold text-xs uppercase border-b pb-2 ${isDarkMode ? 'text-indigo-400 border-slate-800' : 'text-indigo-950 border-slate-200'}`}>
                  IDENTITAS LOKASI SURAT
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className={`block text-[10px] font-extrabold uppercase mb-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>KOTA / TEMPAT TTD</label>
                    <input
                      type="text"
                      value={kotaTtd}
                      onChange={(e) => setKotaTtd(e.target.value)}
                      className={`w-full border rounded-xl px-3 py-1.5 text-xs font-bold focus:outline-none ${
                        isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                      }`}
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-1">
                <button
                  onClick={handleSimpanPengaturan}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold px-5 py-2 rounded-xl text-xs transition shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <span>💾</span> Simpan Pengaturan
                </button>
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

          <Link href="/jadwal" className={`flex flex-col items-center gap-0.5 text-[11px] font-semibold transition ${
            isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-950'
          }`}>
            <span className="text-base">🎓</span>
            <span>Akademik</span>
          </Link>

          <Link href="/laporan" className={`flex flex-col items-center gap-0.5 text-[11px] font-bold transition ${
            isDarkMode ? 'text-indigo-400' : 'text-indigo-600'
          }`}>
            <span className="text-base">🖨️</span>
            <span>Laporan</span>
          </Link>
        </div>
      </div>
    </motion.div>
  )
}