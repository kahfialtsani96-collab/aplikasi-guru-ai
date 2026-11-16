'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { motion } from 'framer-motion'
import { useAuthRole } from '@/hooks/useAuthRole'
import { useDarkMode } from '@/hooks/useDarkMode'
import {
  buildRaporDocument,
  detectUnitByKelas,
  getKelasGradeWeight,
  RaporGuruInfo,
  RaporKelasItem,
  RaporSiswaItem,
} from '../utils/raporBuilder'
import RaporPreviewModal, { RaporPreviewMeta } from '../components/RaporPreviewModal'

const getSupabaseUrl = () =>
  (process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://kvrulbdvgxfrtmznpjnm.supabase.co')
    .replace(/['"]/g, '')
    .trim()
const getSupabaseAnonKey = () =>
  (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder').replace(/['"]/g, '').trim()

const supabase = createClient(getSupabaseUrl(), getSupabaseAnonKey())

interface OptionItem {
  id: number
  nama: string
  tingkat?: string
  jenjang?: string | null
  urutan?: number | null
  wali_kelas_id?: number | null
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

  // DETEKSI OTOMATIS TEMA DARK MODE
  const { isDarkMode } = useDarkMode()

  // Master Options
  const [kelasList, setKelasList] = useState<OptionItem[]>([])
  const [mapelList, setMapelList] = useState<OptionItem[]>([])
  const [siswaList, setSiswaList] = useState<RaporSiswaItem[]>([])

  // Global Filter Periode Akademik
  const [selectedSemester, setSelectedSemester] = useState<'Ganjil' | 'Genap'>('Ganjil')
  const [selectedTahunAjaran, setSelectedTahunAjaran] = useState('2026/2027')
  const [tahunAjaranOptions, setTahunAjaranOptions] = useState<string[]>([])

  // Identitas TTD
  const [namaGuru, setNamaGuru] = useState('Guru Pengampu')
  const [nuptkGuru, setNuptkGuru] = useState('-')
  const [jabatanGuru, setJabatanGuru] = useState('Guru')
  const [namaKepsek, setNamaKepsek] = useState('SULASTRI, S.Pd., Gr.')
  const [nipKepsek, setNipKepsek] = useState('NUPTK. 6337763664131233')
  const [kotaTtd, setKotaTtd] = useState('Gisting')

  // Ceklis TTD & Stempel Kepsek (dipisah, masing-masing punya centang sendiri)
  const [pakaiTtdKepsek, setPakaiTtdKepsek] = useState<boolean>(true)
  const [pakaiCapKepsek, setPakaiCapKepsek] = useState<boolean>(true)
  const [sertakanPengesahanSoal, setSertakanPengesahanSoal] = useState<boolean>(true)

  // Filter Cetak Laporan (Semua 8 Kartu)
  const [filterKelasAbsensi, setFilterKelasAbsensi] = useState('')
  const [filterBulanAbsensi, setFilterBulanAbsensi] = useState('')

  const [filterKelasLeger, setFilterKelasLeger] = useState('')
  const [filterMapelLeger, setFilterMapelLeger] = useState('')

  const [filterKelasJurnal, setFilterKelasJurnal] = useState('')
  const [filterTanggalJurnal, setFilterTanggalJurnal] = useState('')
  const [filterBulanJurnal, setFilterBulanJurnal] = useState('')

  const [filterKelasBimbingan, setFilterKelasBimbingan] = useState('')
  const [filterBulanBimbingan, setFilterBulanBimbingan] = useState('')

  // Filter Cetak Bank Soal
  const [filterMapelBankSoal, setFilterMapelBankSoal] = useState('')
  const [filterKelasBankSoal, setFilterKelasBankSoal] = useState('')

  // Rapor Per Siswa & Modal Live Preview Editor
  const [filterKelasRapor, setFilterKelasRapor] = useState('')
  const [selectedSiswaRapor, setSelectedSiswaRapor] = useState('')
  const [isRaporPreviewOpen, setIsRaporPreviewOpen] = useState(false)
  const [raporPreviewHtml, setRaporPreviewHtml] = useState('')
  const [raporPreviewMeta, setRaporPreviewMeta] = useState<RaporPreviewMeta | null>(null)
  const [isBuildingRapor, setIsBuildingRapor] = useState(false)

  // Riwayat Presensi Detail BK & Riwayat Nilai
  const [tanggalAbsensi, setTanggalAbsensi] = useState('')
  const [bulanAbsensiDetail, setBulanAbsensiDetail] = useState('')
  const [kelasRiwayatAbsensi, setKelasRiwayatAbsensi] = useState('')
  const [kelasNilai, setKelasNilai] = useState('')
  const [mapelNilai, setMapelNilai] = useState('')

  const formatNuptk = (val: any): string => {
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

  const formatTitleCase = (str: string): string => {
    if (!str) return 'Wali Kelas'
    return str
      .trim()
      .split(/\s+/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ')
  }

  useEffect(() => {
    const currentYear = new Date().getFullYear()
    const options: string[] = []
    for (let i = 0; i < 6; i++) {
      const start = currentYear + i - 1
      options.push(`${start}/${start + 1}`)
    }
    setTahunAjaranOptions(options)
  }, [])

  useEffect(() => {
    const savedPengaturan = localStorage.getItem('pengaturan_laporan')
    if (savedPengaturan) {
      try {
        const parsed = JSON.parse(savedPengaturan)
        if (parsed.namaKepsek) setNamaKepsek(parsed.namaKepsek)
        if (parsed.nipKepsek) setNipKepsek(parsed.nipKepsek)
        if (parsed.kotaTtd) setKotaTtd(parsed.kotaTtd)
        // Kompatibilitas dengan pengaturan lama (gabungan) + dua field baru yang terpisah
        if (typeof parsed.pakaiTtdCapKepsek === 'boolean' && typeof parsed.pakaiTtdKepsek !== 'boolean') {
          setPakaiTtdKepsek(parsed.pakaiTtdCapKepsek)
          setPakaiCapKepsek(parsed.pakaiTtdCapKepsek)
        }
        if (typeof parsed.pakaiTtdKepsek === 'boolean') setPakaiTtdKepsek(parsed.pakaiTtdKepsek)
        if (typeof parsed.pakaiCapKepsek === 'boolean') setPakaiCapKepsek(parsed.pakaiCapKepsek)
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
      const {
        data: { user },
      } = await supabase.auth.getUser()
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

  // AMBIL MASTER DATA MAPEL, KELAS (URUT 7-12), & SISWA (URUT A-Z)
  async function fetchMasterData(guruId: number | null, isStrictOperator: boolean) {
    try {
      if (!isStrictOperator && guruId) {
        const { data: listGuruMapel, error: errGuruMapel } = await supabase
          .from('guru_mapel')
          .select(
            `
            mapel_id,
            mapel:mapel_id (
              id,
              nama_mapel,
              jenjang,
              urutan
            )
          `
          )
          .eq('guru_id', guruId)

        if (!errGuruMapel && listGuruMapel && listGuruMapel.length > 0) {
          const formattedMapel = listGuruMapel
            .map((item: any) => item.mapel)
            .filter(Boolean)
            .map((m: any) => ({
              id: m.id,
              nama: m.nama_mapel,
              jenjang: m.jenjang || 'SMP',
              urutan: m.urutan ?? 999,
            }))
            .sort((a: any, b: any) => {
              if (a.urutan !== b.urutan) return a.urutan - b.urutan
              return a.nama.localeCompare(b.nama)
            })

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
          .select('id, nama_mapel, jenjang, urutan')
          .order('urutan', { ascending: true })
          .order('nama_mapel', { ascending: true })

        if (dataMapel) {
          const formatted = dataMapel
            .map((m: any) => ({
              id: m.id,
              nama: m.nama_mapel,
              jenjang: m.jenjang || 'SMP',
              urutan: m.urutan ?? 999,
            }))
            .sort((a, b) => {
              if ((a.urutan ?? 999) !== (b.urutan ?? 999)) {
                return (a.urutan ?? 999) - (b.urutan ?? 999)
              }
              return a.nama.localeCompare(b.nama)
            })

          setMapelList(formatted)
          if (formatted.length > 0) {
            setFilterMapelBankSoal(formatted[0].nama)
          }
        }
      }

      const { data: dataKelas } = await supabase
        .from('kelas')
        .select('id, nama_kelas, tingkat, jenjang, wali_kelas_id')

      const { data: dataSiswa } = await supabase
        .from('siswa')
        .select('*')
        .order('nama_lengkap', { ascending: true })

      if (dataKelas) {
        const mappedKelas = dataKelas
          .map((k: any) => ({
            id: k.id,
            nama: k.nama_kelas,
            tingkat: k.tingkat,
            jenjang: k.jenjang,
            wali_kelas_id: k.wali_kelas_id,
          }))
          .sort((a, b) => {
            const weightA = getKelasGradeWeight(a.nama, a.tingkat)
            const weightB = getKelasGradeWeight(b.nama, b.tingkat)
            if (weightA !== weightB) return weightA - weightB
            return a.nama.localeCompare(b.nama, 'id', { numeric: true })
          })

        setKelasList(mappedKelas)

        if (!isStrictOperator && guruId) {
          const kelasBinaan = mappedKelas.find(
            (k) => Number(k.wali_kelas_id) === Number(guruId)
          )
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

      if (dataSiswa) {
        const sortedSiswa = [...dataSiswa].sort((a: any, b: any) =>
          (a.nama_lengkap || '').localeCompare(b.nama_lengkap || '', 'id')
        )
        setSiswaList(sortedSiswa as any)
      }
    } catch (err) {
      console.error('Error fetching master data:', err)
    }
  }

  // PENGELOMPOKAN DROPDOWN (SMP 7-9 & SMK 10-12)
  const groupedKelasOptions = useMemo(() => {
    const smp = kelasList.filter(
      (k) => detectUnitByKelas(k.nama, k.jenjang, k.tingkat) === 'SMP'
    )
    const smk = kelasList.filter(
      (k) => detectUnitByKelas(k.nama, k.jenjang, k.tingkat) === 'SMK'
    )
    return { smp, smk }
  }, [kelasList])

  const groupedMapelOptions = useMemo(() => {
    const smp = mapelList.filter(
      (m) => (m.jenjang || 'SMP').toUpperCase() !== 'SMK'
    )
    const smk = mapelList.filter(
      (m) => (m.jenjang || '').toUpperCase() === 'SMK'
    )
    return { smp, smk }
  }, [mapelList])

  const renderKelasOptGroups = (useNameAsValue = false) => (
    <>
      {groupedKelasOptions.smp.length > 0 && (
        <optgroup label="── SMP MUNA MUSTOFA (Kelas 7–9) ──">
          {groupedKelasOptions.smp.map((k) => (
            <option key={k.id} value={useNameAsValue ? k.nama : k.id}>
              {k.nama}
            </option>
          ))}
        </optgroup>
      )}
      {groupedKelasOptions.smk.length > 0 && (
        <optgroup label="── SMK MUNA MUSTOFA (Kelas 10–12) ──">
          {groupedKelasOptions.smk.map((k) => (
            <option key={k.id} value={useNameAsValue ? k.nama : k.id}>
              {k.nama}
            </option>
          ))}
        </optgroup>
      )}
    </>
  )

  const renderMapelOptGroups = (useNameAsValue = false) => (
    <>
      {groupedMapelOptions.smp.length > 0 && (
        <optgroup label="── MAPEL SMP MUNA MUSTOFA ──">
          {groupedMapelOptions.smp.map((m) => (
            <option key={m.id} value={useNameAsValue ? m.nama : m.id}>
              {m.nama}
            </option>
          ))}
        </optgroup>
      )}
      {groupedMapelOptions.smk.length > 0 && (
        <optgroup label="── MAPEL SMK MUNA MUSTOFA ──">
          {groupedMapelOptions.smk.map((m) => (
            <option key={m.id} value={useNameAsValue ? m.nama : m.id}>
              {m.nama}
            </option>
          ))}
        </optgroup>
      )}
    </>
  )

  // HELPER MENGAMBIL WALI KELAS
  const resolveWaliKelasByKelasId = async (
    kelasId: number | string | null
  ): Promise<RaporGuruInfo> => {
    if (kelasId) {
      const kelasObj = kelasList.find((k) => Number(k.id) === Number(kelasId))
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

  const resolvePenandatanganPDF = async (options: {
    mode: 'mapel' | 'wali' | 'umum'
    mapelId?: number | string | null
    mapelNama?: string | null
    kelasId?: number | string | null
    guruEmail?: string | null
    namaGuruFallback?: string | null
  }): Promise<RaporGuruInfo> => {
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

  const headerKopHTML = `
    <div style="text-align: center; margin-bottom: 12px;">
      <img src="/kop-surat.png" alt="Kop Surat" style="width: 100%; max-height: 140px; object-fit: contain;" />
    </div>
  `

  const getFooterTtdHTML = (guruInfo: RaporGuruInfo) => `
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
                pakaiCapKepsek
                  ? '<img src="/stempel-sekolah.png" alt="Stempel" style="position: absolute; left: 25%; top: 0px; height: 75px; opacity: 0.9; z-index: 1;" />'
                  : ''
              }
              ${
                pakaiTtdKepsek
                  ? '<img src="/ttd-kepsek.png" alt="TTD Kepsek" style="position: absolute; left: 35%; top: 5px; height: 60px; z-index: 2;" />'
                  : ''
              }
              ${!pakaiCapKepsek && !pakaiTtdKepsek ? '<br/><br/>' : ''}
            </div>
            <u><strong>${namaKepsek}</strong></u><br/>
            ${nipKepsek}
          </td>
        </tr>
      </table>
    </div>
  `

  const downloadCSV = (filename: string, headers: string[], rows: (string | number)[][]) => {
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.map((val) => `"${val}"`).join(','))].join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `${filename}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Helper escape karakter HTML (<, >, &) & bersihkan simbol LaTeX mentah agar teks seperti <html> tampil utuh di Word
  const escapeHtmlAndCleanLatex = (str: string): string => {
    if (!str) return ''
    let cleaned = str
      // Konversi simbol panah & matematika LaTeX umum
      .replace(/\\rightarrow/g, '→')
      .replace(/\\leftarrow/g, '←')
      .replace(/\\leftrightarrow/g, '↔')
      .replace(/\\geq/g, '≥')
      .replace(/\\leq/g, '≤')
      .replace(/\\neq/g, '≠')
      .replace(/\\times/g, '×')
      .replace(/\\div/g, '÷')
      // Hilangkan pembungkus $...$ pada rumus inline
      .replace(/\$([^$]+)\$/g, '$1')

    // Escape tag HTML (< dan >) menjadi entitas aman agar tulisan seperti <html> tidak dianggap tag HTML kosong
    cleaned = cleaned
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')

    // Kembalikan tag bold internal hasil konversi Markdown (**teks** -> <b>teks</b>)
    cleaned = cleaned.replace(/&lt;b&gt;(.*?)&lt;\/b&gt;/g, '<b>$1</b>')

    return cleaned
  }

  // PARSER NASKAH SOAL 2 KOLOM (NOMOR URUT OTOMATIS, OPSI VERTIKAL RAPI, & PROTEKSI TAG HTML)
  const formatNaskahSoalHematKertas = (rawText: string): string => {
    if (!rawText) return '<p><i>Isi naskah soal kosong di database.</i></p>'

    // 1. Potong bagian Kunci Jawaban / Pedoman Penskoran / Lembar Pengesahan
    let cleanText = rawText
      .split(/\n\s*#{0,4}\s*(?:KUNCI\s*JAWABAN|PEDOMAN\s*PENSKORAN|LEMBAR\s*PENGESAHAN)/i)[0]
      .trim()

    // 2. Buang blok "PETUNJUK UMUM / PETUNJUK PENGERJAAN" bawaan AI sebelum masuk ke bagian soal
    const sectionHeaderMatch = cleanText.match(
      /(?:^|\n)\s*#{0,4}\s*(?:[A-Z0-9I]+[\.\)]\s*)?(?:SOAL\s+)?(?:PILIHAN\s+GANDA|ISIAN|URAIAN|ESSAY)\b[^\n]*/i
    )
    if (sectionHeaderMatch && sectionHeaderMatch.index !== undefined) {
      cleanText = cleanText.slice(sectionHeaderMatch.index + sectionHeaderMatch[0].length).trim()
    } else {
      const pilihlahMatch = cleanText.match(/Pilihlah\s+(?:satu\s+)?jawaban[^\n]*\n/i)
      if (pilihlahMatch && pilihlahMatch.index !== undefined) {
        cleanText = cleanText.slice(pilihlahMatch.index + pilihlahMatch[0].length).trim()
      }
    }

    // 3. Paksa opsi A., B., C., D., E. yang menempel di satu baris agar pecah menjadi baris baru
    cleanText = cleanText.replace(/([^\n])\s+([A-E][\.\)]\s+)/g, '$1\n$2')

    // 4. Konversi Markdown **bold** menjadi <b>...</b>
    cleanText = cleanText.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')

    const lines = cleanText.split('\n')
    const soalItems: {
      num: string
      question: string
      options: { letter: string; text: string }[]
    }[] = []
    let currentSoal: {
      num: string
      question: string
      options: { letter: string; text: string }[]
    } | null = null
    let autoCounter = 1

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
        .trim()
        .replace(/^[-_*]{3,}\s*/, '')
        .replace(/\s*[-_*]{3,}$/, '')
        .trim()

      if (!line) continue

      if (
        /^#{1,4}\s*/.test(line) ||
        /^[A-Z]\.\s*TOPIK\b/i.test(line) ||
        /^TOPIK\s*\d+/i.test(line) ||
        /^PETUNJUK\b/i.test(line)
      ) {
        continue
      }

      // Cek apakah baris diawali nomor soal eksplisit (misal: "1. ..." atau "1) ...")
      const qMatch = line.match(/^(\d{1,3})[\.\)]\s+(.+)$/)
      if (qMatch) {
        if (currentSoal) soalItems.push(currentSoal)
        currentSoal = {
          num: qMatch[1],
          question: qMatch[2].trim(),
          options: [],
        }
        autoCounter = parseInt(qMatch[1], 10) + 1
        continue
      }

      // Cek apakah baris adalah opsi jawaban A-E (mendukung "A. teks" maupun opsi kosong hasil edit "C.")
      const optMatch = line.match(/^([a-eA-E])[\.\)]\s*(.*)$/)
      if (optMatch && currentSoal) {
        currentSoal.options.push({
          letter: optMatch[1].toUpperCase(),
          text: (optMatch[2] || '').trim(),
        })
        continue
      }

      // Jika belum ada nomor eksplisit (misal dari hasil Edit Visual lama yang kehilangan <ol> nomor),
      // otomatis mulai soal baru jika sebelumnya belum ada soal atau soal sebelumnya sudah memiliki opsi jawaban
      if (!currentSoal || currentSoal.options.length >= 2) {
        if (currentSoal) soalItems.push(currentSoal)
        currentSoal = {
          num: String(autoCounter++),
          question: line,
          options: [],
        }
        continue
      }

      // Lanjutan teks dari pertanyaan atau opsi terakhir
      if (currentSoal.options.length > 0) {
        const lastOpt = currentSoal.options[currentSoal.options.length - 1]
        lastOpt.text = lastOpt.text ? `${lastOpt.text} ${line}` : line
      } else {
        currentSoal.question += ' ' + line
      }
    }

    if (currentSoal) soalItems.push(currentSoal)

    if (soalItems.length > 0) {
      return soalItems
        .map((item, idx) => {
          const displayNum = item.num || String(idx + 1)
          const safeQuestion = escapeHtmlAndCleanLatex(item.question)

          const isShortOptions =
            item.options.length === 4 &&
            item.options.every((o) => o.text.length > 0 && o.text.length <= 20)

          const optionsHtml =
            item.options.length === 0
              ? ''
              : isShortOptions
              ? `
                <table class="opt-grid">
                  <tr>
                    <td><b>${item.options[0].letter}.</b> ${escapeHtmlAndCleanLatex(item.options[0].text)}</td>
                    <td><b>${item.options[2].letter}.</b> ${escapeHtmlAndCleanLatex(item.options[2].text)}</td>
                  </tr>
                  <tr>
                    <td><b>${item.options[1].letter}.</b> ${escapeHtmlAndCleanLatex(item.options[1].text)}</td>
                    <td><b>${item.options[3].letter}.</b> ${escapeHtmlAndCleanLatex(item.options[3].text)}</td>
                  </tr>
                </table>
              `
              : `
                <div class="opt-list">
                  ${item.options
                    .map(
                      (o) =>
                        `<div class="opt-row"><b>${o.letter}.</b> ${
                          o.text ? escapeHtmlAndCleanLatex(o.text) : '<i>(Opsi kosong)</i>'
                        }</div>`
                    )
                    .join('')}
                </div>
              `

          return `
            <div class="soal-item">
              <div class="soal-q">
                <span class="soal-num">${displayNum}.</span>
                <span class="soal-text">${safeQuestion}</span>
              </div>
              ${optionsHtml}
            </div>
          `
        })
        .join('')
    }

    const cleanedLines = lines
      .filter((l) => !/^#{1,4}\s*/.test(l.trim()) && !/^[-_*]{3,}$/.test(l.trim()))
      .map((l) => l.trim())
      .filter(Boolean)
    return cleanedLines
      .map((l) => `<p style="margin: 0 0 6px 0;">${escapeHtmlAndCleanLatex(l)}</p>`)
      .join('')
  }

  const filterSoalByKelasExact = (soalList: any[], selectedKelasNama: string) => {
    if (!selectedKelasNama) return soalList
    const targetClean = selectedKelasNama.trim().toUpperCase()
    const targetNoSpace = targetClean.replace(/\s+/g, '')

    return soalList.filter((s) => {
      const fk = String(s.fase_kelas || '').toUpperCase()
      const fkNoSpace = fk.replace(/\s+/g, '')
      const regexWord = new RegExp(
        `(^|[^A-Z0-9])${targetClean.replace(/\s+/g, '\\s*')}([^A-Z0-9]|$)`,
        'i'
      )
      return regexWord.test(fk) || fkNoSpace.includes(targetNoSpace)
    })
  }

  // DOWNLOAD WORD STANDAR UJIAN (FONT 10PT LEGA UNTUK 30-40+ SOAL HINGGA ±4 HALAMAN A4)
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
              margin: 1.0cm 1.2cm 1.0cm 1.2cm;
              mso-header-margin: 0.5cm;
              mso-footer-margin: 0.5cm;
            }
            @page WordSectionSoal {
              size: 21cm 29.7cm;
              margin: 1.0cm 1.2cm 1.0cm 1.2cm;
              mso-columns: 2 even 0.6cm;
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
              column-gap: 18px;
              column-rule: 0.5pt solid #888;
            }
            div.WordSectionSingle { page: WordSectionSingle; }
            body {
              font-family: 'Times New Roman', Times, serif;
              color: #000;
              line-height: 1.3;
              font-size: 10pt;
              margin: 0;
              padding: 0;
            }
            .judul-ujian {
              text-align: center;
              text-transform: uppercase;
              margin: 4px 0 6px 0;
              font-size: 10.5pt;
              font-weight: bold;
            }
            .header-identitas {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 6px;
              font-size: 9pt;
            }
            .header-identitas td {
              border: 1px solid #000;
              padding: 3px 6px;
            }
            .petunjuk-singkat {
              font-size: 8.5pt;
              font-style: italic;
              margin: 0 0 8px 0;
              border-bottom: 1.5pt solid #000;
              padding-bottom: 4px;
            }
            .soal-item {
              break-inside: avoid;
              page-break-inside: avoid;
              margin-bottom: 8pt;
            }
            .soal-q {
              margin-bottom: 2.5pt;
              text-align: justify;
            }
            .soal-num { font-weight: bold; }
            .opt-list { padding-left: 14pt; }
            .opt-row { margin-bottom: 1.5pt; }
            .opt-grid {
              width: 94%;
              margin-left: 14pt;
              border-collapse: collapse;
              font-size: 9.5pt;
            }
            .opt-grid td {
              width: 50%;
              padding: 1pt 4pt 1pt 0;
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

  // Deteksi jenjang soal (prioritas dari Fase/Kelas terlebih dahulu agar mapel lintas jenjang seperti Informatika tidak tertukar)
  const detectIsSmkSoal = (faseOrKelasStr: string, mapelStr: string): boolean => {
    const cleanFase = (faseOrKelasStr || '').trim()
    if (/\b(VII|VIII|IX|7|8|9|FASE\s*D)\b/i.test(cleanFase)) {
      return false
    }
    if (/\b(X|XI|XII|10|11|12|DKV|FASE\s*E|FASE\s*F)\b/i.test(cleanFase)) {
      return true
    }
    const mapelObj = mapelList.find(
      (m) => m.nama.trim().toLowerCase() === (mapelStr || '').trim().toLowerCase()
    )
    return (mapelObj?.jenjang || '').toUpperCase() === 'SMK'
  }

  // Helper Kop Surat Ujian dinamis SMP vs SMK
  const buildKopUjianWordHtml = (faseOrKelasStr: string, mapelStr: string, maxImgHeight: string) => {
    const isSmkSoal = detectIsSmkSoal(faseOrKelasStr, mapelStr)

    if (isSmkSoal) {
      return `
        <div style="border-bottom: 3px double #000; padding-bottom: 4px; margin-bottom: 4px; text-align: center;">
          <p style="margin: 0; font-size: 9.5pt; font-weight: bold;">YAYASAN PONDOK PESANTREN MUNA MUSTOFA LAMPUNG</p>
          <h2 style="margin: 1px 0; font-size: 13.5pt; font-weight: bold;">SMK MUNA MUSTOFA</h2>
          <p style="margin: 0; font-size: 9pt; font-weight: bold;">Kompetensi Keahlian: Desain Komunikasi Visual (DKV)</p>
          <p style="margin: 1px 0 0 0; font-size: 8.5pt;">Jl. PPTQ Muna Mustofa Kecamatan Gisting Kabupaten Tanggamus 35376</p>
        </div>
      `
    }

    return `
      <div style="text-align: center; margin-bottom: 4px;">
        <img src="/kop-surat.png" alt="Kop Surat" style="width: 100%; height: auto; max-height: ${maxImgHeight}; object-fit: contain;" />
      </div>
    `
  }

  const handlePrintBankSoal = async () => {
    let query = supabase.from('bank_soal').select('*').order('created_at', { ascending: false })
    if (filterMapelBankSoal) {
      query = query.eq('mapel', filterMapelBankSoal)
    }

    const { data: rawSoalData, error } = await query
    const soalData = filterSoalByKelasExact(rawSoalData || [], filterKelasBankSoal)

    if (error || !soalData || soalData.length === 0) {
      alert(
        `Tidak ada naskah bank soal tersimpan ${
          filterMapelBankSoal ? `untuk mata pelajaran ${filterMapelBankSoal}` : ''
        } ${filterKelasBankSoal ? `kelas ${filterKelasBankSoal}` : ''}.`
      )
      return
    }

    const htmlSections = soalData
      .map((s, idx) => {
        const isSmkSoal = detectIsSmkSoal(s.fase_kelas, s.mapel)
        const opsiHurufLabel = isSmkSoal ? 'A, B, C, D, atau E' : 'A, B, C, atau D'
        const estimasiMenit = Number(s.jumlah_soal) > 30 ? 90 : 60

        return `
          ${
            idx > 0
              ? '<br clear="all" style="page-break-before:always; mso-break-type:section-break" />'
              : ''
          }
          <div class="WordSectionHeader">
            ${buildKopUjianWordHtml(s.fase_kelas, s.mapel, '88px')}
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
                <td>: ${estimasiMenit} Menit (${s.jumlah_soal} Butir ${s.bentuk_soal})</td>
                <td><b>Hari / Tanggal</b></td>
                <td>: ........................................................</td>
              </tr>
            </table>
            <p class="petunjuk-singkat">
              <b>Petunjuk:</b> Berdoalah sebelum mengerjakan. Pilihlah satu jawaban yang paling tepat dengan memberi tanda silang (X) pada huruf ${opsiHurufLabel} pada lembar jawaban!
            </p>
          </div>

          <br clear="all" style="mso-special-character:line-break; page-break-before:auto; mso-break-type:section-break" />

          <div class="WordSectionSoal">
            ${formatNaskahSoalHematKertas(s.isi_soal)}
          </div>
        `
      })
      .join('')

    const safeMapel = (filterMapelBankSoal || 'Semua_Mapel').replace(/[^a-zA-Z0-9]/g, '_')
    const safeKelas = (filterKelasBankSoal || 'Semua_Kelas').replace(/[^a-zA-Z0-9]/g, '_')
    triggerDownloadWord(`Naskah_Soal_${safeMapel}_${safeKelas}`, htmlSections)
  }

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
      const cleaned = targetPart
        .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
        .replace(/^[-_*]{3,}$/gm, '')
        .trim()
      return escapeHtmlAndCleanLatex(cleaned).replace(/\n/g, '<br/>')
    }

    const firstSoal = soalData[0]
    const isSmkSoal = detectIsSmkSoal(
      firstSoal?.fase_kelas || filterKelasBankSoal || '',
      firstSoal?.mapel || filterMapelBankSoal || ''
    )

    const guruPengampu = await resolvePenandatanganPDF({
      mode: 'mapel',
      mapelNama: filterMapelBankSoal || firstSoal?.mapel,
      namaGuruFallback: firstSoal?.nama_guru,
    })

    // Tentukan Kepala Sekolah sesuai jenjang soal (SMK vs SMP)
    let kepsekNamaDoc = namaKepsek
    let kepsekNipDoc = nipKepsek
    if (isSmkSoal) {
      const { data: kepsekSmk } = await supabase
        .from('guru')
        .select('nama_lengkap, NUPTK')
        .ilike('jabatan', '%Kepala Sekolah SMK%')
        .maybeSingle()
      kepsekNamaDoc = kepsekSmk?.nama_lengkap?.trim() || 'RIZIEQ NIZAR'
      kepsekNipDoc = kepsekSmk?.NUPTK ? `NUPTK. ${kepsekSmk.NUPTK}` : 'NUPTK. -'
    }

    const footerTtdKunci = `
      <div style="margin-top: 25px; font-family: 'Times New Roman', serif; font-size: 9.5pt; page-break-inside: avoid; color: #000;">
        <table style="width: 100%; border: none;">
          <tr>
            <td style="width: 50%; border: none; text-align: center; vertical-align: top;">
              ${kotaTtd}, ${currentDateStr}<br/>
              <strong>${guruPengampu.jabatanLabel}</strong><br/><br/><br/><br/>
              <u><strong>${guruPengampu.nama}</strong></u><br/>
              NUPTK: ${guruPengampu.nuptk}
            </td>
            <td style="width: 50%; border: none; text-align: center; vertical-align: top;">
              Mengetahui,<br/>
              <strong>Kepala ${isSmkSoal ? 'SMK Muna Mustofa' : 'SMP Muna Mustofa'}</strong><br/>
              <div style="position: relative; height: 70px; display: flex; align-items: center; justify-content: center;">
                ${
                  !isSmkSoal && pakaiCapKepsek
                    ? '<img src="/stempel-sekolah.png" alt="Stempel" style="position: absolute; left: 25%; top: 0px; height: 75px; opacity: 0.9; z-index: 1;" />'
                    : ''
                }
                ${
                  !isSmkSoal && pakaiTtdKepsek
                    ? '<img src="/ttd-kepsek.png" alt="TTD Kepsek" style="position: absolute; left: 35%; top: 5px; height: 60px; z-index: 2;" />'
                    : ''
                }
                ${!isSmkSoal && !pakaiCapKepsek && !pakaiTtdKepsek ? '<br/><br/>' : ''}
              </div>
              <u><strong>${kepsekNamaDoc}</strong></u><br/>
              ${kepsekNipDoc}
            </td>
          </tr>
        </table>
      </div>
    `

    const htmlKunci = `
      <div class="WordSectionSingle" style="font-size: 10pt; line-height: 1.4;">
        ${buildKopUjianWordHtml(
          firstSoal?.fase_kelas || filterKelasBankSoal,
          firstSoal?.mapel || filterMapelBankSoal,
          '110px'
        )}
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
        ${footerTtdKunci}
      </div>
    `

    const safeMapel = (filterMapelBankSoal || 'Semua_Mapel').replace(/[^a-zA-Z0-9]/g, '_')
    const safeKelas = (filterKelasBankSoal || 'Semua_Kelas').replace(/[^a-zA-Z0-9]/g, '_')
    triggerDownloadWord(`Kunci_Jawaban_${safeMapel}_${safeKelas}`, htmlKunci)
  }

  const handlePrintBankSoalPdf = async () => {
    let query = supabase.from('bank_soal').select('*').order('created_at', { ascending: false })
    if (filterMapelBankSoal) {
      query = query.eq('mapel', filterMapelBankSoal)
    }

    const { data: rawSoalData } = await query
    const soalData = filterSoalByKelasExact(rawSoalData || [], filterKelasBankSoal)

    if (!soalData || soalData.length === 0) {
      alert(
        `Tidak ada data bank soal untuk dicetak PDF${
          filterMapelBankSoal ? ` (${filterMapelBankSoal})` : ''
        }${filterKelasBankSoal ? ` kelas ${filterKelasBankSoal}` : ''}.`
      )
      return
    }

    const htmlSections = soalData
      .map((s, idx) => {
        const isSmkSoal = detectIsSmkSoal(s.fase_kelas, s.mapel)
        const opsiHurufLabel = isSmkSoal ? 'A, B, C, D, atau E' : 'A, B, C, atau D'
        const estimasiMenit = Number(s.jumlah_soal) > 30 ? 90 : 60

        return `
          ${idx > 0 ? '<div class="soal-page-break"></div>' : ''}
          <div class="kop-ujian">
            ${buildKopUjianWordHtml(s.fase_kelas, s.mapel, '105px')}
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
                <td>: ${estimasiMenit} Menit (${s.jumlah_soal} Butir ${s.bentuk_soal})</td>
                <td><b>Hari / Tanggal</b></td>
                <td>: ........................................................</td>
              </tr>
            </table>
            <p class="petunjuk-singkat">
              <b>Petunjuk:</b> Berdoalah sebelum mengerjakan. Pilihlah satu jawaban yang paling tepat dengan memberi tanda silang (X) pada huruf ${opsiHurufLabel} pada lembar jawaban!
            </p>
          </div>

          <div class="kolom-soal">
            ${formatNaskahSoalHematKertas(s.isi_soal)}
          </div>
        `
      })
      .join('')

    const guruPengampu = await resolvePenandatanganPDF({
      mode: 'mapel',
      mapelNama: filterMapelBankSoal || soalData[0]?.mapel,
    })

    // Tentukan Kepala Sekolah sesuai jenjang soal (SMK vs SMP)
    let kepsekNamaDoc = namaKepsek
    let kepsekNipDoc = nipKepsek
    const isSmkSoal = detectIsSmkSoal(soalData[0].fase_kelas, soalData[0].mapel)
    if (isSmkSoal) {
      const { data: kepsekSmk } = await supabase
        .from('guru')
        .select('nama_lengkap, NUPTK')
        .ilike('jabatan', '%Kepala Sekolah SMK%')
        .maybeSingle()
      kepsekNamaDoc = kepsekSmk?.nama_lengkap?.trim() || 'RIZIEQ NIZAR'
      kepsekNipDoc = kepsekSmk?.NUPTK ? `NUPTK. ${kepsekSmk.NUPTK}` : 'NUPTK. -'
    }

    const footerTtdPdf = `
      <div style="margin-top: 25px; font-family: 'Times New Roman', serif; font-size: 9.5pt; page-break-inside: avoid; color: #000;">
        <table style="width: 100%; border: none;">
          <tr>
            <td style="width: 50%; border: none; text-align: center; vertical-align: top;">
              ${kotaTtd}, ${currentDateStr}<br/>
              <strong>${guruPengampu.jabatanLabel}</strong><br/><br/><br/><br/>
              <u><strong>${guruPengampu.nama}</strong></u><br/>
              NUPTK: ${guruPengampu.nuptk}
            </td>
            <td style="width: 50%; border: none; text-align: center; vertical-align: top;">
              Mengetahui,<br/>
              <strong>Kepala ${isSmkSoal ? 'SMK Muna Mustofa' : 'SMP Muna Mustofa'}</strong><br/>
              <div style="position: relative; height: 70px; display: flex; align-items: center; justify-content: center;">
                ${
                  !isSmkSoal && pakaiCapKepsek
                    ? '<img src="/stempel-sekolah.png" alt="Stempel" style="position: absolute; left: 25%; top: 0px; height: 75px; opacity: 0.9; z-index: 1;" />'
                    : ''
                }
                ${
                  !isSmkSoal && pakaiTtdKepsek
                    ? '<img src="/ttd-kepsek.png" alt="TTD Kepsek" style="position: absolute; left: 35%; top: 5px; height: 60px; z-index: 2;" />'
                    : ''
                }
                ${!isSmkSoal && !pakaiCapKepsek && !pakaiTtdKepsek ? '<br/><br/>' : ''}
              </div>
              <u><strong>${kepsekNamaDoc}</strong></u><br/>
              ${kepsekNipDoc}
            </td>
          </tr>
        </table>
      </div>
    `

    const safeMapel = (filterMapelBankSoal || 'Semua_Mapel').replace(/[^a-zA-Z0-9]/g, '_')
    const safeKelas = (filterKelasBankSoal || 'Semua_Kelas').replace(/[^a-zA-Z0-9]/g, '_')
    const originUrl = typeof window !== 'undefined' ? window.location.origin : ''

    const printWindow = window.open('', '_blank')
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Naskah Soal ${safeMapel} - ${safeKelas}</title>
            <style>
              @page { size: A4 portrait; margin: 12mm 14mm 12mm 14mm; }
              body {
                font-family: 'Times New Roman', Times, serif;
                color: #000;
                line-height: 1.3;
                font-size: 10pt;
                margin: 0;
                padding: 0;
              }
              .soal-page-break { page-break-before: always; }
              .judul-ujian {
                text-align: center;
                text-transform: uppercase;
                margin: 4px 0 6px 0;
                font-size: 10.5pt;
                font-weight: bold;
              }
              .header-identitas {
                width: 100%;
                border-collapse: collapse;
                margin-bottom: 6px;
                font-size: 9pt;
              }
              .header-identitas td {
                border: 1px solid #000;
                padding: 3px 6px;
              }
              .petunjuk-singkat {
                font-size: 8.5pt;
                font-style: italic;
                margin: 0 0 8px 0;
                border-bottom: 1.5pt solid #000;
                padding-bottom: 4px;
              }
              .kolom-soal {
                column-count: 2;
                column-gap: 20px;
                column-rule: 0.5pt solid #888;
              }
              .soal-item {
                break-inside: avoid;
                page-break-inside: avoid;
                margin-bottom: 8pt;
              }
              .soal-q { margin-bottom: 2.5pt; text-align: justify; }
              .soal-num { font-weight: bold; }
              .opt-list { padding-left: 14pt; }
              .opt-row { margin-bottom: 1.5pt; }
              .opt-grid {
                width: 94%;
                margin-left: 14pt;
                border-collapse: collapse;
                font-size: 9.5pt;
              }
              .opt-grid td {
                width: 50%;
                padding: 1pt 4pt 1pt 0;
                border: none;
                vertical-align: top;
              }
            </style>
          </head>
          <body>
            ${htmlSections.replace(/src="\//g, `src="${originUrl}/`)}
            ${sertakanPengesahanSoal ? footerTtdPdf.replace(/src="\//g, `src="${originUrl}/`) : ''}
          </body>
        </html>
      `)
      printWindow.document.close()
      setTimeout(() => printWindow.print(), 500)
    }
  }


  const handlePrintDocument = async (jenis: string) => {
    let judulDoc = 'LAPORAN AKADEMIK'
    let contentBody = ''
    let guruCetak: RaporGuruInfo = {
      nama: namaGuru,
      nuptk: nuptkGuru,
      jabatanLabel: 'Guru Mata Pelajaran',
    }

    if (jenis === 'absensi') {
      const selectedK = kelasList.find((k) => k.id === Number(filterKelasAbsensi))
      judulDoc = `LAPORAN REKAPITULASI PRESENSI HARIAN SISWA ${
        selectedK ? `(${selectedK.nama.toUpperCase()})` : '(SEMUA KELAS)'
      } - SEMESTER ${selectedSemester.toUpperCase()} TA ${selectedTahunAjaran}`

      let querySiswa = supabase
        .from('siswa')
        .select('*, kelas:kelas_id(nama_kelas)')
        .order('nama_lengkap', { ascending: true })
      if (filterKelasAbsensi) querySiswa = querySiswa.eq('kelas_id', Number(filterKelasAbsensi))
      const { data: siswaData } = await querySiswa

      let queryAbsensi = supabase
        .from('absensi')
        .select('*')
        .eq('semester', selectedSemester)
        .eq('tahun_ajaran', selectedTahunAjaran)
      if (filterKelasAbsensi)
        queryAbsensi = queryAbsensi.eq('kelas_id', Number(filterKelasAbsensi))
      if (filterBulanAbsensi)
        queryAbsensi = queryAbsensi.ilike('tanggal', `${filterBulanAbsensi}%`)

      const { data: absensiData } = await queryAbsensi

      guruCetak = await resolvePenandatanganPDF({ mode: 'umum' })

      const rekapSiswa = (siswaData || []).map((siswa) => {
        const riwayatAll = (absensiData || []).filter(
          (a) => Number(a.siswa_id) === Number(siswa.id)
        )

        const presensiHarianMap = new Map<string, string>()
        riwayatAll.forEach((a) => {
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
          kelas:
            (siswa as any).kelas?.nama_kelas ||
            (Array.isArray((siswa as any).kelas) ? (siswa as any).kelas[0]?.nama_kelas : '-'),
          hadir: statusList.filter((st) => st === 'HADIR').length,
          sakit: statusList.filter((st) => st === 'SAKIT').length,
          izin: statusList.filter((st) => st === 'IZIN').length,
          alpa: statusList.filter((st) => st === 'ALPA').length,
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
                ? rekapSiswa
                    .map(
                      (s, idx) => `
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
                  `
                    )
                    .join('')
                : `<tr><td colspan="8" style="border: 1px solid #000; padding: 10px; text-align: center;">Belum ada data rekapitulasi absensi.</td></tr>`
            }
          </tbody>
        </table>
      `
    } else if (jenis === 'leger') {
      const selectedK = kelasList.find((k) => k.id === Number(filterKelasLeger))
      const selectedM = mapelList.find((m) => m.id === Number(filterMapelLeger))

      judulDoc = `LEGER NILAI AKADEMIK SISWA ${
        selectedK ? `(${selectedK.nama.toUpperCase()})` : '(SEMUA KELAS)'
      } ${selectedM ? `- MAPEL: ${selectedM.nama.toUpperCase()}` : ''}`

      guruCetak = await resolvePenandatanganPDF({
        mode: 'mapel',
        mapelId: filterMapelLeger || null,
      })

      let querySiswa = supabase
        .from('siswa')
        .select('*, kelas:kelas_id(nama_kelas)')
        .order('nama_lengkap', { ascending: true })
      if (filterKelasLeger) querySiswa = querySiswa.eq('kelas_id', Number(filterKelasLeger))
      const { data: siswaData } = await querySiswa

      let queryNilai = supabase
        .from('nilai')
        .select('*')
        .eq('semester', selectedSemester)
        .eq('tahun_ajaran', selectedTahunAjaran)
      if (filterKelasLeger) queryNilai = queryNilai.eq('kelas_id', Number(filterKelasLeger))
      if (filterMapelLeger) queryNilai = queryNilai.eq('mapel_id', Number(filterMapelLeger))

      const { data: nilaiData } = await queryNilai

      const rekapLeger = (siswaData || []).map((siswa) => {
        const listN = (nilaiData || []).filter((n) => Number(n.siswa_id) === Number(siswa.id))
        const n = listN.length > 0 ? listN[listN.length - 1] : {}

        const tugas = n.nilai_tugas ?? 0
        const uts = n.nilai_uts ?? 0
        const uas = n.nilai_uas ?? 0
        const komps = [tugas, uts, uas].filter((v) => v > 0)
        const avg =
          komps.length > 0 ? (komps.reduce((a, b) => a + b, 0) / komps.length).toFixed(1) : '0.0'

        return {
          nama: siswa.nama_lengkap,
          kelas:
            (siswa as any).kelas?.nama_kelas ||
            (Array.isArray((siswa as any).kelas) ? (siswa as any).kelas[0]?.nama_kelas : '-'),
          mapel: n.mata_pelajaran || selectedM?.nama || '-',
          tugas: n.nilai_tugas ?? '-',
          uts: n.nilai_uts ?? '-',
          uas: n.nilai_uas ?? '-',
          avg,
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
                ? rekapLeger
                    .map(
                      (s, idx) => `
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
                  `
                    )
                    .join('')
                : `<tr><td colspan="8" style="border: 1px solid #000; padding: 10px; text-align: center;">Belum ada data nilai akademik.</td></tr>`
            }
          </tbody>
        </table>
      `
    } else if (jenis === 'jurnal') {
      const selectedK = kelasList.find((k) => k.id === Number(filterKelasJurnal))
      judulDoc = `JURNAL AGENDA MENGAJAR HARIAN GURU ${
        selectedK ? `(${selectedK.nama.toUpperCase()})` : '(SEMUA KELAS)'
      }`

      let queryAgenda = supabase
        .from('jurnal_agenda')
        .select('*')
        .eq('semester', selectedSemester)
        .eq('tahun_ajaran', selectedTahunAjaran)
        .order('created_at', { ascending: false })
      if (filterKelasJurnal) queryAgenda = queryAgenda.eq('kelas_id', Number(filterKelasJurnal))

      if (filterTanggalJurnal) {
        queryAgenda = queryAgenda.eq('tanggal', filterTanggalJurnal)
      } else if (filterBulanJurnal) {
        queryAgenda = queryAgenda.ilike('tanggal', `${filterBulanJurnal}%`)
      }

      const { data: agendaData } = await queryAgenda

      const uniqueMapels = Array.from(
        new Set((agendaData || []).map((a: any) => a.mapel).filter(Boolean))
      )
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
          ${
            filterTanggalJurnal
              ? ` | Tanggal: <b>${filterTanggalJurnal}</b>`
              : filterBulanJurnal
              ? ` | Bulan: <b>${filterBulanJurnal}</b>`
              : ''
          }
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
                ? agendaData!
                    .map(
                      (a, idx) => `
                    <tr>
                      <td style="border: 1px solid #000; padding: 6px; text-align: center;">${idx + 1}</td>
                      <td style="border: 1px solid #000; padding: 6px; text-align: center;">${a.tanggal || '-'}</td>
                      <td style="border: 1px solid #000; padding: 6px; text-align: center;">${a.jam_ke || '-'}</td>
                      <td style="border: 1px solid #000; padding: 6px;"><b>${a.kelas || ''}</b> ${a.mapel ? `- ${a.mapel}` : ''}</td>
                      <td style="border: 1px solid #000; padding: 6px;">${a.materi || '-'}</td>
                      <td style="border: 1px solid #000; padding: 6px; font-family: monospace; font-size: 9pt;">${a.absen_siswa || 'Nihil'}</td>
                      <td style="border: 1px solid #000; padding: 6px; text-align: center; font-weight: bold;">${a.status || 'SELESAI'}</td>
                    </tr>
                  `
                    )
                    .join('')
                : `<tr><td colspan="7" style="border: 1px solid #000; padding: 10px; text-align: center;">Belum ada data agenda mengajar tersimpan.</td></tr>`
            }
          </tbody>
        </table>
      `
    } else if (jenis === 'bimbingan') {
      const selectedK = kelasList.find((k) => k.id === Number(filterKelasBimbingan))
      judulDoc = `LAPORAN CATATAN BIMBINGAN GURU WALI ${
        selectedK ? `(${selectedK.nama.toUpperCase()})` : '(SEMUA KELAS)'
      }`

      let queryBimbingan = supabase.from('bimbingan_wali').select('*')
      if (selectedK) queryBimbingan = queryBimbingan.eq('kelas', selectedK.nama)
      if (filterBulanBimbingan)
        queryBimbingan = queryBimbingan.ilike('tanggal', `${filterBulanBimbingan}%`)

      const { data: bimbinganData } = await queryBimbingan

      guruCetak = await resolvePenandatanganPDF({
        mode: 'wali',
        kelasId: filterKelasBimbingan || waliKelasAssignedId || null,
      })

      contentBody = `
        <h3 style="text-align: center; text-transform: uppercase; margin-bottom: 5px;">${judulDoc}</h3>
        ${
          filterBulanBimbingan
            ? `<p style="text-align: center; font-size: 10pt; margin-bottom: 15px;">Filter Bulan: <b>${filterBulanBimbingan}</b></p>`
            : ''
        }
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
                ? bimbinganData!
                    .map(
                      (b, idx) => `
                    <tr>
                      <td style="border: 1px solid #000; padding: 5px; text-align: center;">${idx + 1}</td>
                      <td style="border: 1px solid #000; padding: 5px;">${b.nama_siswa || 'Siswa'}</td>
                      <td style="border: 1px solid #000; padding: 5px; text-align: center;">${b.kelas || '-'}</td>
                      <td style="border: 1px solid #000; padding: 5px;">${b.masalah || '-'}</td>
                      <td style="border: 1px solid #000; padding: 5px;">${b.solusi || b.keterangan_hukuman || '-'}</td>
                    </tr>
                  `
                    )
                    .join('')
                : `<tr><td colspan="5" style="border: 1px solid #000; padding: 10px; text-align: center;">Belum ada catatan bimbingan guru wali tersimpan.</td></tr>`
            }
          </tbody>
        </table>
      `
    }

    executePrint(judulDoc, contentBody, guruCetak)
  }

  // =========================================================================
  // WRAPPER RAPOR 3 HALAMAN MENGGUNAKAN MODUL raporBuilder.ts
  // =========================================================================
  const prepareRaporData = async () => {
    if (!selectedSiswaRapor) {
      alert('Pilih siswa terlebih dahulu untuk mencetak atau mengedit Lembar Rapor!')
      return null
    }
    const targetSiswa = siswaList.find((s) => s.id === Number(selectedSiswaRapor))
    if (!targetSiswa) return null

    const waliKelasInfo = await resolveWaliKelasByKelasId(
      targetSiswa.kelas_id || filterKelasRapor
    )
    const originUrl = typeof window !== 'undefined' ? window.location.origin : ''

    return await buildRaporDocument({
      supabase,
      targetSiswa,
      kelasList: kelasList as RaporKelasItem[],
      selectedSemester,
      selectedTahunAjaran,
      waliKelasInfo,
      namaKepsek,
      nipKepsek,
      kotaTtd,
      currentDateStr,
      pakaiTtdKepsek,
      pakaiCapKepsek,
      originUrl,
    })
  }

  const handleOpenRaporLivePreview = async () => {
    setIsBuildingRapor(true)
    try {
      const docData = await prepareRaporData()
      if (!docData) return
      setRaporPreviewHtml(docData.htmlRaporLengkap)
      setRaporPreviewMeta({
        namaSiswa: docData.targetSiswa.nama_lengkap,
        kelasStr: docData.namaKelasStr,
        unit: docData.unitSiswa,
        faseKurikulum: docData.faseKurikulum,
        mapelContexts: docData.mapelContexts,
      })
      setIsRaporPreviewOpen(true)
    } finally {
      setIsBuildingRapor(false)
    }
  }

  const openRaporPrintWindow = (titleText: string, innerHtml: string) => {
    const printWindow = window.open('', '_blank')
    if (!printWindow) return

    printWindow.document.write(`
      <html>
        <head>
          <title>${titleText}</title>
          <style>
            @page { margin: 1.2cm 1.4cm; size: A4 portrait; }
            body { font-family: 'Times New Roman', Times, serif; color: #000; line-height: 1.35; font-size: 10pt; margin: 0; padding: 0; }
            .page-section {
              position: relative;
            }
            .page-watermark {
              position: absolute;
              top: 50%;
              left: 50%;
              transform: translate(-50%, -50%);
              opacity: 0.06;
              z-index: 0;
              pointer-events: none;
            }
            .page-watermark img { width: 380px; height: 380px; object-fit: contain; }
            .cover-box {
              border: 3px double #000;
              padding: 28px 24px;
              min-height: 25.5cm;
              box-sizing: border-box;
            }
            .table-identitas { width: 100%; border: none; border-collapse: collapse; margin-bottom: 10px; font-size: 10pt; }
            .table-identitas td { border: none; padding: 2.5px 4px; vertical-align: top; }
            .section-title { margin: 0 0 5px 0; font-size: 9.8pt; text-transform: uppercase; letter-spacing: 0.3px; }
            .table-data { width: 100%; border-collapse: collapse; font-size: 9.2pt; }
            .table-data th { background-color: #f1f5f9; border: 1px solid #000; padding: 5px 6px; font-weight: bold; }
            .table-data td { border: 1px solid #000; padding: 4.5px 6px; vertical-align: middle; }
            .page-break { page-break-before: always; }
          </style>
        </head>
        <body>
          ${innerHtml}
        </body>
      </html>
    `)
    printWindow.document.close()
    setTimeout(() => {
      printWindow.print()
    }, 500)
  }

  const downloadRaporWordBlob = (filename: string, innerHtml: string) => {
    const wordHtml = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
        <head>
          <meta charset="utf-8" />
          <title>${filename}</title>
          <style>
            @page WordSection1 {
              size: 21cm 29.7cm;
              margin: 1.2cm 1.4cm 1.2cm 1.4cm;
            }
            div.WordSection1 { page: WordSection1; }
            body { font-family: 'Times New Roman', Times, serif; font-size: 10pt; line-height: 1.35; color: #000; }
            .page-watermark { display: none; }
            .cover-box { border: 3px double #000; padding: 24px; }
            .table-identitas { width: 100%; border: none; border-collapse: collapse; margin-bottom: 10px; font-size: 10pt; }
            .table-identitas td { border: none; padding: 2.5px 4px; vertical-align: top; }
            .section-title { margin: 0 0 5px 0; font-size: 9.8pt; text-transform: uppercase; }
            .table-data { width: 100%; border-collapse: collapse; font-size: 9.2pt; }
            .table-data th { background-color: #f1f5f9; border: 1px solid #000; padding: 5px 6px; font-weight: bold; }
            .table-data td { border: 1px solid #000; padding: 4.5px 6px; vertical-align: middle; }
            .page-break { page-break-before: always; mso-break-type: section-break; }
          </style>
        </head>
        <body>
          <div class="WordSection1">
            ${innerHtml}
          </div>
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

  const handlePrintRaporSiswa = async () => {
    const docData = await prepareRaporData()
    if (!docData) return
    openRaporPrintWindow(
      `RAPOR ${docData.unitSiswa} - ${docData.targetSiswa.nama_lengkap.toUpperCase()} (${docData.namaKelasStr})`,
      docData.htmlRaporLengkap
    )
  }

  const handleDownloadRaporWord = async () => {
    const docData = await prepareRaporData()
    if (!docData) return
    const safeName = docData.targetSiswa.nama_lengkap.replace(/[^a-zA-Z0-9]/g, '_')
    downloadRaporWordBlob(
      `Rapor_${docData.unitSiswa}_${safeName}_${docData.namaKelasStr.replace(/\s+/g, '')}_${selectedSemester}`,
      docData.htmlRaporLengkap
    )
  }

  const handleExportLegerExcel = async () => {
    let querySiswa = supabase
      .from('siswa')
      .select('*, kelas:kelas_id(nama_kelas)')
      .order('nama_lengkap', { ascending: true })
    if (filterKelasLeger) querySiswa = querySiswa.eq('kelas_id', Number(filterKelasLeger))
    const { data: siswaData } = await querySiswa

    let queryNilai = supabase
      .from('nilai')
      .select('*')
      .eq('semester', selectedSemester)
      .eq('tahun_ajaran', selectedTahunAjaran)
    if (filterKelasLeger) queryNilai = queryNilai.eq('kelas_id', Number(filterKelasLeger))
    if (filterMapelLeger) queryNilai = queryNilai.eq('mapel_id', Number(filterMapelLeger))
    const { data: nilaiData } = await queryNilai

    const rows = (siswaData || []).map((s, idx) => {
      const listN = (nilaiData || []).filter((n) => Number(n.siswa_id) === Number(s.id))
      const n = listN.length > 0 ? listN[listN.length - 1] : {}
      const tugas = n.nilai_tugas ?? 0
      const uts = n.nilai_uts ?? 0
      const uas = n.nilai_uas ?? 0
      const komps = [tugas, uts, uas].filter((v) => v > 0)
      const avg =
        komps.length > 0 ? (komps.reduce((a, b) => a + b, 0) / komps.length).toFixed(1) : '0.0'

      const namaKelas =
        (s as any).kelas?.nama_kelas ||
        (Array.isArray((s as any).kelas) ? (s as any).kelas[0]?.nama_kelas : '-')

      return [
        idx + 1,
        s.nama_lengkap,
        namaKelas,
        n.mata_pelajaran || '-',
        n.nilai_tugas ?? 0,
        n.nilai_uts ?? 0,
        n.nilai_uas ?? 0,
        avg,
      ]
    })

    downloadCSV(
      `Leger_Nilai_${selectedSemester}_${selectedTahunAjaran.replace('/', '-')}`,
      ['No', 'Nama Siswa', 'Kelas', 'Mapel', 'Tugas', 'UTS', 'UAS', 'Rata-Rata'],
      rows
    )
  }

  const handlePrintRiwayatAbsensi = async () => {
    let query = supabase
      .from('absensi')
      .select('*')
      .eq('semester', selectedSemester)
      .eq('tahun_ajaran', selectedTahunAjaran)
      .order('tanggal', { ascending: false })

    if (tanggalAbsensi && tanggalAbsensi.trim() !== '')
      query = query.eq('tanggal', tanggalAbsensi.trim())
    if (bulanAbsensiDetail) query = query.ilike('tanggal', `${bulanAbsensiDetail}%`)
    if (kelasRiwayatAbsensi) query = query.eq('kelas_id', Number(kelasRiwayatAbsensi))

    const { data: absensiData } = await query
    const selectedK = kelasList.find((k) => k.id === Number(kelasRiwayatAbsensi))
    const judulDoc = `LAPORAN DETAIL PRESENSI SISWA BK (JAM KE-1 S/D JAM KE-8) ${
      selectedK ? `(${selectedK.nama.toUpperCase()})` : '(SEMUA KELAS)'
    }`

    const guruCetak = await resolvePenandatanganPDF({ mode: 'umum' })

    const matrixMap = new Map<
      string,
      { nama: string; kelas: string; tanggal: string; jam: { [key: number]: string } }
    >()

    ;(absensiData || []).forEach((a) => {
      const key = `${a.siswa_id}_${a.tanggal}`
      if (!matrixMap.has(key)) {
        matrixMap.set(key, {
          nama: a.nama_siswa,
          kelas: a.kelas || '-',
          tanggal: a.tanggal,
          jam: {},
        })
      }

      const record = matrixMap.get(key)!
      const jamMatch =
        (a.jam_ke || '').match(/Jam Ke-(\d+)/i) || (a.jam_ke || '').match(/Ke-(\d+)/i)
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
              ? matrixRows
                  .map((r, idx) => {
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
                      ${[1, 2, 3, 4, 5, 6, 7, 8]
                        .map((j) => {
                          const st = r.jam[j] || '-'
                          const color =
                            st === 'HADIR'
                              ? '#d1fae5'
                              : st === 'ALPA'
                              ? '#ffe4e6'
                              : st === 'IZIN' || st === 'SAKIT'
                              ? '#fef3c7'
                              : '#ffffff'
                          return `<td style="border: 1px solid #000; padding: 4px; text-align: center; background-color: ${color}; font-weight: bold;">${st.charAt(0)}</td>`
                        })
                        .join('')}
                      <td style="border: 1px solid #000; padding: 4px; text-align: center; font-weight: bold; color: ${
                        statusBolos ? 'red' : 'green'
                      };">
                        ${statusBolos ? '⚠️ Terindikasi Bolos KBM' : 'Nihil'}
                      </td>
                    </tr>
                  `
                  })
                  .join('')
              : `<tr><td colspan="13" style="border: 1px solid #000; padding: 10px; text-align: center;">Belum ada riwayat presensi detail untuk filter ini.</td></tr>`
          }
        </tbody>
      </table>
    `

    executePrint(judulDoc, contentBody, guruCetak)
  }

  const handlePrintRiwayatNilai = async () => {
    let query = supabase
      .from('nilai')
      .select('*, siswa:siswa_id(nama_lengkap, kelas:kelas_id(nama_kelas))')
      .eq('semester', selectedSemester)
      .eq('tahun_ajaran', selectedTahunAjaran)
      .order('created_at', { ascending: false })
    if (kelasNilai) query = query.eq('kelas_id', Number(kelasNilai))
    if (mapelNilai) query = query.eq('mapel_id', Number(mapelNilai))

    const { data: nilaiData } = await query
    const selectedK = kelasList.find((k) => k.id === Number(kelasNilai))
    const selectedM = mapelList.find((m) => m.id === Number(mapelNilai))

    const guruCetak = await resolvePenandatanganPDF({
      mode: 'mapel',
      mapelId: mapelNilai || null,
    })

    const judulDoc = `LAPORAN RIWAYAT INPUT NILAI AKADEMIK ${
      selectedK ? `(${selectedK.nama.toUpperCase()})` : '(SEMUA KELAS)'
    } ${selectedM ? `- ${selectedM.nama.toUpperCase()}` : ''}`

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
              ? nilaiData!
                  .map(
                    (
                      n: {
                        created_at?: string
                        siswa?: { nama_lengkap?: string }
                        mata_pelajaran?: string
                        nilai_tugas?: number
                        nilai_uts?: number
                        nilai_uas?: number
                      },
                      idx: number
                    ) => `
                  <tr>
                    <td style="border: 1px solid #000; padding: 5px; text-align: center;">${idx + 1}</td>
                    <td style="border: 1px solid #000; padding: 5px; text-align: center;">${
                      n.created_at ? new Date(n.created_at).toLocaleDateString('id-ID') : '-'
                    }</td>
                    <td style="border: 1px solid #000; padding: 5px;">${n.siswa?.nama_lengkap || '-'}</td>
                    <td style="border: 1px solid #000; padding: 5px;">${n.mata_pelajaran || '-'}</td>
                    <td style="border: 1px solid #000; padding: 5px; text-align: center;">${n.nilai_tugas ?? '-'}</td>
                    <td style="border: 1px solid #000; padding: 5px; text-align: center;">${n.nilai_uts ?? '-'}</td>
                    <td style="border: 1px solid #000; padding: 5px; text-align: center;">${n.nilai_uas ?? '-'}</td>
                  </tr>
                `
                  )
                  .join('')
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
    guruInfo: RaporGuruInfo = {
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
            <title>${judulDoc} - MUNA MUSTOFA</title>
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
      setTimeout(() => {
        printWindow.print()
      }, 500)
    }
  }

  const handleSimpanPengaturan = () => {
    const dataToSave = {
      namaKepsek,
      nipKepsek,
      kotaTtd,
      pakaiTtdKepsek,
      pakaiCapKepsek,
    }
    localStorage.setItem('pengaturan_laporan', JSON.stringify(dataToSave))
    alert('✅ Pengaturan profil kepsek & stempel cetakan berhasil disimpan secara permanen!')
  }

  const kelasRaporOptions = isStrictOperatorRole
    ? kelasList
    : waliKelasAssignedId
    ? kelasList.filter((k) => Number(k.id) === Number(waliKelasAssignedId))
    : []

  const siswaRaporOptions = useMemo(() => {
    if (!filterKelasRapor) return []
    return siswaList
      .filter((s) => Number(s.kelas_id) === Number(filterKelasRapor))
      .sort((a, b) => (a.nama_lengkap || '').localeCompare(b.nama_lengkap || '', 'id'))
  }, [siswaList, filterKelasRapor])

  const selectedKelasRaporInfo = useMemo(() => {
    if (!filterKelasRapor) return null
    const k = kelasList.find((item) => Number(item.id) === Number(filterKelasRapor))
    if (!k) return null
    const unit = detectUnitByKelas(k.nama, k.jenjang, k.tingkat)
    const w = getKelasGradeWeight(k.nama, k.tingkat)
    const fase = unit === 'SMP' ? 'D' : w === 10 ? 'E' : 'F'
    return { nama: k.nama, unit, fase }
  }, [filterKelasRapor, kelasList])

  return (
    <motion.div
      initial={{ opacity: 0, x: -60 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className={`h-screen font-sans flex flex-col justify-between selection:bg-indigo-500 selection:text-white overflow-hidden relative transition-colors duration-300 ${
        isDarkMode ? 'bg-slate-950 text-slate-100' : 'bg-[#E2E8F0] text-slate-800'
      }`}
    >
      <div
        className={`fixed inset-0 pointer-events-none z-0 flex items-center justify-center select-none print:hidden transition-opacity duration-300 ${
          isDarkMode ? 'opacity-[0.05]' : 'opacity-[0.15]'
        }`}
      >
        <img
          src="/logo-smp.jpg"
          alt="Watermark"
          className="w-[850px] h-[850px] object-contain max-w-none"
        />
      </div>

      <div className="relative z-10 flex flex-col h-full overflow-hidden">
        <header
          className={`border-b px-6 py-2.5 flex items-center justify-between shrink-0 shadow-xs print:hidden transition-colors duration-300 ${
            isDarkMode
              ? 'bg-slate-900/90 border-slate-800 backdrop-blur-md'
              : 'bg-slate-100/90 border-slate-300 backdrop-blur-md'
          }`}
        >
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className={`p-1.5 rounded-lg transition ${
                isDarkMode
                  ? 'text-slate-400 hover:text-white'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Kembali ke Dashboard"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 19l-7-7m0 0l7-7m-7 7h18"
                />
              </svg>
            </Link>
            <div className="flex items-center gap-3">
              <div
                className={`w-9 h-9 rounded-xl overflow-hidden flex items-center justify-center border p-0.5 shadow-xs shrink-0 ${
                  isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-300'
                }`}
              >
                <img src="/logo-smp.jpg" alt="Logo SMP" className="w-full h-full object-contain" />
              </div>
              <div>
                <h1
                  className={`font-bold text-base leading-none ${
                    isDarkMode ? 'text-white' : 'text-slate-900'
                  }`}
                >
                  Aplikasi Guru AI
                </h1>
                <p
                  className={`text-[11px] font-bold mt-0.5 ${
                    isDarkMode ? 'text-emerald-400' : 'text-emerald-800'
                  }`}
                >
                  Pusat Laporan &amp; Cetak Dokumen
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div
              className={`border text-xs font-bold px-3 py-1 rounded-xl flex items-center gap-2 shadow-xs ${
                isDarkMode
                  ? 'bg-slate-800 border-slate-700 text-slate-100'
                  : 'bg-white border-slate-300 text-slate-800'
              }`}
            >
              <span
                className={`text-[10px] uppercase ${
                  isDarkMode ? 'text-slate-400' : 'text-slate-500'
                }`}
              >
                Periode:
              </span>
              <select
                value={selectedSemester}
                onChange={(e) => setSelectedSemester(e.target.value as 'Ganjil' | 'Genap')}
                className={`font-bold rounded px-1 py-0.5 focus:outline-none ${
                  isDarkMode ? 'bg-slate-700 text-indigo-300' : 'bg-slate-100 text-indigo-900'
                }`}
              >
                <option value="Ganjil">Ganjil</option>
                <option value="Genap">Genap</option>
              </select>
              <select
                value={selectedTahunAjaran}
                onChange={(e) => setSelectedTahunAjaran(e.target.value)}
                className={`font-bold rounded px-1 py-0.5 focus:outline-none ${
                  isDarkMode ? 'bg-slate-700 text-indigo-300' : 'bg-slate-100 text-indigo-900'
                }`}
              >
                {tahunAjaranOptions.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <div
              className={`border text-xs font-bold px-3.5 py-1.5 rounded-xl flex items-center gap-2.5 shadow-xs ${
                isDarkMode
                  ? 'bg-slate-800 border-slate-700 text-slate-100'
                  : 'bg-white border-slate-300 text-slate-800'
              }`}
            >
              <span className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[11px] font-bold shrink-0">
                {userDisplayName.charAt(0)}
              </span>
              <div className="flex flex-col leading-tight">
                <span className="font-extrabold">{userDisplayName}</span>
                <span
                  className={`text-[10px] font-mono ${
                    isDarkMode ? 'text-slate-400' : 'text-slate-500'
                  }`}
                >
                  NUPTK: {userNuptkDisplay}
                </span>
              </div>
              <span
                className={`text-[10px] px-2 py-0.5 rounded-md font-extrabold uppercase ml-1 border ${
                  isDarkMode
                    ? 'bg-indigo-950 text-indigo-300 border-indigo-800'
                    : 'bg-indigo-100 text-indigo-800 border-indigo-200'
                }`}
              >
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

        <div
          className={`border-b px-6 py-2 shrink-0 overflow-x-auto print:hidden transition-colors duration-300 ${
            isDarkMode
              ? 'bg-slate-900/80 border-slate-800 backdrop-blur-md'
              : 'bg-slate-200/80 border-slate-300 backdrop-blur-md'
          }`}
        >
          <div className="max-w-6xl mx-auto flex items-center justify-between text-xs font-bold">
            <div className="flex items-center gap-2">
              <span
                className={`font-black pr-2 border-r flex items-center gap-1 ${
                  isDarkMode
                    ? 'text-indigo-400 border-slate-800'
                    : 'text-indigo-900 border-slate-300'
                }`}
              >
                🖨️ Laporan:
              </span>
              <button
                onClick={() => setActiveTab('pusat')}
                className={`px-3.5 py-1.5 rounded-xl transition flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'pusat'
                    ? 'bg-indigo-600 text-white shadow-xs font-extrabold'
                    : isDarkMode
                    ? 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700'
                    : 'bg-white/80 text-slate-700 hover:bg-white border border-slate-300'
                }`}
              >
                <span>🖨️</span> Pusat Cetak Laporan
              </button>
              <button
                onClick={() => setActiveTab('pengaturan')}
                className={`px-3.5 py-1.5 rounded-xl transition flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'pengaturan'
                    ? 'bg-indigo-600 text-white shadow-xs font-extrabold'
                    : isDarkMode
                    ? 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700'
                    : 'bg-white/80 text-slate-700 hover:bg-white border border-slate-300'
                }`}
              >
                <span>⚙️</span> Pengaturan TTD Kepsek
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-1.5 text-xs font-bold cursor-pointer select-none bg-indigo-100 text-indigo-900 px-3 py-1.5 rounded-xl border border-indigo-300 shadow-xs">
                <input
                  type="checkbox"
                  checked={pakaiTtdKepsek}
                  onChange={(e) => setPakaiTtdKepsek(e.target.checked)}
                  className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                />
                <span>✍️ TTD Kepsek</span>
              </label>
              <label className="flex items-center gap-1.5 text-xs font-bold cursor-pointer select-none bg-indigo-100 text-indigo-900 px-3 py-1.5 rounded-xl border border-indigo-300 shadow-xs">
                <input
                  type="checkbox"
                  checked={pakaiCapKepsek}
                  onChange={(e) => setPakaiCapKepsek(e.target.checked)}
                  className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                />
                <span>🖇️ Cap Sekolah</span>
              </label>
            </div>
          </div>
        </div>

        <main className="max-w-6xl w-full mx-auto p-4 flex-1 flex flex-col min-h-0 overflow-y-auto space-y-4">
          {activeTab === 'pusat' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-12">
              {/* 1. DOWNLOAD WORD NASKAH SOAL & KUNCI JAWABAN */}
              <div className="md:col-span-2 bg-gradient-to-r from-amber-700 via-orange-800 to-amber-950 text-white rounded-2xl p-4 shadow-md space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 font-extrabold text-sm">
                    <span>📝</span>
                    <h3>Download Naskah Soal Ulangan</h3>
                  </div>
                  <span className="text-[10px] bg-amber-950/80 border border-amber-400/40 px-2.5 py-0.5 rounded-full font-bold text-amber-200">
                    Unduh Word &amp; Cetak PDF
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                        renderMapelOptGroups(true)
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
                      {renderKelasOptGroups(true)}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <button
                    onClick={handlePrintBankSoal}
                    className="w-full bg-amber-400 hover:bg-amber-500 text-slate-950 font-black py-2 rounded-xl text-xs transition shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <span>📝</span> Word Naskah Soal
                  </button>
                  <button
                    onClick={handlePrintBankSoalPdf}
                    className="w-full bg-white hover:bg-amber-100 text-amber-900 font-black py-2 rounded-xl text-xs transition shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <span>🖨️</span> Cetak PDF Naskah Soal
                  </button>
                  <button
                    onClick={handlePrintKunciJawaban}
                    className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-black py-2 rounded-xl text-xs transition shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <span>🔑</span> Word Kunci Jawaban
                  </button>
                </div>

                <label className="flex items-center gap-2 text-[10px] font-bold text-amber-100 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={sertakanPengesahanSoal}
                    onChange={(e) => setSertakanPengesahanSoal(e.target.checked)}
                    className="accent-amber-400 size-3.5"
                  />
                  Sertakan Lembar Pengesahan (TTD Kepsek &amp; Guru)
                </label>
              </div>

              {/* 2. CETAK RAPOR INDIVIDU SISWA (3 HALAMAN + AI GENERATOR) */}
              <div className="md:col-span-2 bg-gradient-to-r from-emerald-800 via-teal-800 to-emerald-950 text-white rounded-2xl p-4 shadow-md space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 font-extrabold text-sm">
                    <span>🎓</span>
                    <h3>
                      Cetak Lembar Rapor Hasil Belajar Peserta Didik (Cover + Biodata + Nilai + AI)
                    </h3>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {selectedKelasRaporInfo && (
                      <span className="text-[10px] bg-amber-400 text-slate-950 px-2.5 py-0.5 rounded-full font-black">
                        Unit Terdeteksi: {selectedKelasRaporInfo.unit} • Fase{' '}
                        {selectedKelasRaporInfo.fase}
                      </span>
                    )}
                    <span className="text-[10px] bg-emerald-950/80 border border-emerald-500/40 px-2.5 py-0.5 rounded-full font-bold text-emerald-200">
                      KKM: 75 (C: 75–78 | B: 79–85 | A: ≥86)
                    </span>
                  </div>
                </div>
                <p className="text-xs text-emerald-100 font-medium">
                  Format resmi 3 halaman — siap cetak per kelas.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-extrabold uppercase mb-1 text-emerald-200">
                      1. KELAS PERWALIAN (URUT 7–12){' '}
                      {!isStrictOperatorRole && waliKelasAssignedId
                        ? '(TERKUNCI SESUAI TUGAS)'
                        : ''}
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
                      {isStrictOperatorRole && <option value="">Pilih Kelas (7–12)</option>}
                      {kelasRaporOptions.length === 0 ? (
                        <option value="">(Khusus Wali Kelas / Operator)</option>
                      ) : isStrictOperatorRole ? (
                        renderKelasOptGroups(false)
                      ) : (
                        kelasRaporOptions.map((k) => (
                          <option key={k.id} value={k.id}>
                            {k.nama}
                          </option>
                        ))
                      )}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-extrabold uppercase mb-1 text-emerald-200">
                      2. PILIH PESERTA DIDIK (URUT A–Z)
                    </label>
                    <select
                      value={selectedSiswaRapor}
                      onChange={(e) => setSelectedSiswaRapor(e.target.value)}
                      disabled={!filterKelasRapor}
                      className="w-full bg-white text-slate-900 border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs font-bold focus:outline-none disabled:bg-slate-200"
                    >
                      <option value="">Pilih Siswa ({siswaRaporOptions.length} Siswa)</option>
                      {siswaRaporOptions.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.nama_lengkap} (NISN: {s.nisn || '-'})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                  <button
                    onClick={handleOpenRaporLivePreview}
                    disabled={!selectedSiswaRapor || isBuildingRapor}
                    className="w-full bg-indigo-500 hover:bg-indigo-600 disabled:bg-slate-400 text-white font-black py-2 rounded-xl text-xs transition shadow-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:cursor-not-allowed"
                  >
                    <span>👁️</span>{' '}
                    {isBuildingRapor ? 'Menyiapkan...' : 'Preview & Edit Rapor (AI)'}
                  </button>

                  <button
                    onClick={handlePrintRaporSiswa}
                    disabled={!selectedSiswaRapor}
                    className="w-full bg-amber-400 hover:bg-amber-500 disabled:bg-slate-400 text-slate-950 font-black py-2 rounded-xl text-xs transition shadow-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:cursor-not-allowed"
                  >
                    <span>🖨️</span> Cetak PDF Langsung
                  </button>

                  <button
                    onClick={handleDownloadRaporWord}
                    disabled={!selectedSiswaRapor}
                    className="w-full bg-sky-500 hover:bg-sky-600 disabled:bg-slate-400 text-white font-black py-2 rounded-xl text-xs transition shadow-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:cursor-not-allowed"
                  >
                    <span>📝</span> Download Word (.doc)
                  </button>
                </div>
              </div>

              {/* 3. ABSENSI */}
              <div
                className={`backdrop-blur-md border rounded-2xl p-4 shadow-xs flex flex-col justify-between space-y-3 ${
                  isDarkMode
                    ? 'bg-slate-900/90 border-slate-800'
                    : 'bg-gradient-to-br from-indigo-100/90 via-slate-100/90 to-indigo-50/90 border-indigo-200/80'
                }`}
              >
                <div>
                  <div
                    className={`flex items-center gap-2 font-extrabold text-sm mb-1 ${
                      isDarkMode ? 'text-indigo-400' : 'text-indigo-950'
                    }`}
                  >
                    <span>📄</span>
                    <h3>Cetak PDF Rekap Presensi Harian</h3>
                  </div>
                  <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                    Rekap presensi harian per kelas.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label
                      className={`block text-[10px] font-extrabold uppercase mb-1 ${
                        isDarkMode ? 'text-indigo-300' : 'text-indigo-950'
                      }`}
                    >
                      KELAS (7–12)
                    </label>
                    <select
                      value={filterKelasAbsensi}
                      onChange={(e) => setFilterKelasAbsensi(e.target.value)}
                      className={`w-full border rounded-xl px-2 py-1 text-xs font-bold focus:outline-none ${
                        isDarkMode
                          ? 'bg-slate-800 border-slate-700 text-white'
                          : 'bg-white border-slate-300 text-slate-900'
                      }`}
                    >
                      <option value="">Semua Kelas</option>
                      {renderKelasOptGroups(false)}
                    </select>
                  </div>
                  <div>
                    <label
                      className={`block text-[10px] font-extrabold uppercase mb-1 ${
                        isDarkMode ? 'text-indigo-300' : 'text-indigo-950'
                      }`}
                    >
                      BULAN
                    </label>
                    <input
                      type="month"
                      value={filterBulanAbsensi}
                      onChange={(e) => setFilterBulanAbsensi(e.target.value)}
                      className={`w-full border rounded-xl px-2 py-1 text-xs font-bold focus:outline-none ${
                        isDarkMode
                          ? 'bg-slate-800 border-slate-700 text-white'
                          : 'bg-white border-slate-300 text-slate-900'
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

              {/* 4. LEGER NILAI */}
              <div
                className={`backdrop-blur-md border rounded-2xl p-4 shadow-xs flex flex-col justify-between space-y-3 ${
                  isDarkMode
                    ? 'bg-slate-900/90 border-slate-800'
                    : 'bg-gradient-to-br from-indigo-100/90 via-slate-100/90 to-indigo-50/90 border-indigo-200/80'
                }`}
              >
                <div>
                  <div
                    className={`flex items-center gap-2 font-extrabold text-sm mb-1 ${
                      isDarkMode ? 'text-indigo-400' : 'text-indigo-950'
                    }`}
                  >
                    <span>📄</span>
                    <h3>Cetak PDF Leger Nilai Akademik</h3>
                  </div>
                  <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                    Leger nilai per mapel (Tugas, UTS, UAS).
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label
                      className={`block text-[10px] font-extrabold uppercase mb-1 ${
                        isDarkMode ? 'text-indigo-300' : 'text-indigo-950'
                      }`}
                    >
                      KELAS (7–12)
                    </label>
                    <select
                      value={filterKelasLeger}
                      onChange={(e) => setFilterKelasLeger(e.target.value)}
                      className={`w-full border rounded-xl px-2 py-1 text-xs font-bold focus:outline-none ${
                        isDarkMode
                          ? 'bg-slate-800 border-slate-700 text-white'
                          : 'bg-white border-slate-300 text-slate-900'
                      }`}
                    >
                      <option value="">Semua Kelas</option>
                      {renderKelasOptGroups(false)}
                    </select>
                  </div>

                  <div>
                    <label
                      className={`block text-[10px] font-extrabold uppercase mb-1 ${
                        isDarkMode ? 'text-indigo-300' : 'text-indigo-950'
                      }`}
                    >
                      MAPEL
                    </label>
                    <select
                      value={filterMapelLeger}
                      onChange={(e) => setFilterMapelLeger(e.target.value)}
                      className={`w-full border rounded-xl px-2 py-1 text-xs font-bold focus:outline-none ${
                        isDarkMode
                          ? 'bg-slate-800 border-slate-700 text-white'
                          : 'bg-white border-slate-300 text-slate-900'
                      }`}
                    >
                      {isStrictOperatorRole && <option value="">Semua Mapel</option>}
                      {mapelList.length === 0 ? (
                        <option value="">(Belum Ada Mapel)</option>
                      ) : (
                        renderMapelOptGroups(false)
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

              {/* 5. JURNAL AGENDA HARIAN / BULANAN */}
              <div
                className={`backdrop-blur-md border rounded-2xl p-4 shadow-xs flex flex-col justify-between space-y-3 ${
                  isDarkMode
                    ? 'bg-slate-900/90 border-slate-800'
                    : 'bg-gradient-to-br from-indigo-100/90 via-slate-100/90 to-indigo-50/90 border-indigo-200/80'
                }`}
              >
                <div>
                  <div
                    className={`flex items-center gap-2 font-extrabold text-sm mb-1 ${
                      isDarkMode ? 'text-indigo-400' : 'text-indigo-950'
                    }`}
                  >
                    <span>📄</span>
                    <h3>Jurnal Agenda Mengajar Harian / Bulanan</h3>
                  </div>
                  <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                    Jurnal mengajar harian/bulanan.
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label
                      className={`block text-[9px] font-extrabold uppercase mb-1 ${
                        isDarkMode ? 'text-indigo-300' : 'text-indigo-950'
                      }`}
                    >
                      KELAS (7–12)
                    </label>
                    <select
                      value={filterKelasJurnal}
                      onChange={(e) => setFilterKelasJurnal(e.target.value)}
                      className={`w-full border rounded-xl px-2 py-1 text-xs font-bold focus:outline-none ${
                        isDarkMode
                          ? 'bg-slate-800 border-slate-700 text-white'
                          : 'bg-white border-slate-300 text-slate-900'
                      }`}
                    >
                      <option value="">Semua Kelas</option>
                      {renderKelasOptGroups(false)}
                    </select>
                  </div>

                  <div>
                    <label
                      className={`block text-[9px] font-extrabold uppercase mb-1 ${
                        isDarkMode ? 'text-indigo-300' : 'text-indigo-950'
                      }`}
                    >
                      TANGGAL (HARIAN)
                    </label>
                    <input
                      type="date"
                      value={filterTanggalJurnal}
                      onChange={(e) => {
                        setFilterTanggalJurnal(e.target.value)
                        if (e.target.value) setFilterBulanJurnal('')
                      }}
                      className={`w-full border rounded-xl px-2 py-1 text-xs font-bold focus:outline-none ${
                        isDarkMode
                          ? 'bg-slate-800 border-slate-700 text-white'
                          : 'bg-white border-slate-300 text-slate-900'
                      }`}
                    />
                  </div>

                  <div>
                    <label
                      className={`block text-[9px] font-extrabold uppercase mb-1 ${
                        isDarkMode ? 'text-indigo-300' : 'text-indigo-950'
                      }`}
                    >
                      BULAN (BULANAN)
                    </label>
                    <input
                      type="month"
                      value={filterBulanJurnal}
                      onChange={(e) => {
                        setFilterBulanJurnal(e.target.value)
                        if (e.target.value) setFilterTanggalJurnal('')
                      }}
                      className={`w-full border rounded-xl px-2 py-1 text-xs font-bold focus:outline-none ${
                        isDarkMode
                          ? 'bg-slate-800 border-slate-700 text-white'
                          : 'bg-white border-slate-300 text-slate-900'
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

              {/* 6. BIMBINGAN WALI */}
              <div
                className={`backdrop-blur-md border rounded-2xl p-4 shadow-xs flex flex-col justify-between space-y-3 ${
                  isDarkMode
                    ? 'bg-slate-900/90 border-slate-800'
                    : 'bg-gradient-to-br from-indigo-100/90 via-slate-100/90 to-indigo-50/90 border-indigo-200/80'
                }`}
              >
                <div>
                  <div
                    className={`flex items-center gap-2 font-extrabold text-sm mb-1 ${
                      isDarkMode ? 'text-indigo-400' : 'text-indigo-950'
                    }`}
                  >
                    <span>📄</span>
                    <h3>Catatan Bimbingan Guru Wali</h3>
                  </div>
                  <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                    Catatan bimbingan wali kelas.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label
                      className={`block text-[10px] font-extrabold uppercase mb-1 ${
                        isDarkMode ? 'text-indigo-300' : 'text-indigo-950'
                      }`}
                    >
                      KELAS (7–12)
                    </label>
                    <select
                      value={filterKelasBimbingan}
                      onChange={(e) => setFilterKelasBimbingan(e.target.value)}
                      className={`w-full border rounded-xl px-2 py-1 text-xs font-bold focus:outline-none ${
                        isDarkMode
                          ? 'bg-slate-800 border-slate-700 text-white'
                          : 'bg-white border-slate-300 text-slate-900'
                      }`}
                    >
                      <option value="">Semua Kelas</option>
                      {renderKelasOptGroups(false)}
                    </select>
                  </div>

                  <div>
                    <label
                      className={`block text-[10px] font-extrabold uppercase mb-1 ${
                        isDarkMode ? 'text-indigo-300' : 'text-indigo-950'
                      }`}
                    >
                      BULAN
                    </label>
                    <input
                      type="month"
                      value={filterBulanBimbingan}
                      onChange={(e) => setFilterBulanBimbingan(e.target.value)}
                      className={`w-full border rounded-xl px-2 py-1 text-xs font-bold focus:outline-none ${
                        isDarkMode
                          ? 'bg-slate-800 border-slate-700 text-white'
                          : 'bg-white border-slate-300 text-slate-900'
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

              {/* 7. RIWAYAT PRESENSI DETAIL BK JAM 1-8 */}
              <div
                className={`backdrop-blur-md border rounded-2xl p-4 shadow-xs flex flex-col justify-between space-y-3 ${
                  isDarkMode
                    ? 'bg-slate-900/90 border-slate-800'
                    : 'bg-gradient-to-br from-indigo-100/90 via-slate-100/90 to-indigo-50/90 border-indigo-200/80'
                }`}
              >
                <div>
                  <div
                    className={`flex items-center gap-2 font-extrabold text-sm mb-1 ${
                      isDarkMode ? 'text-indigo-400' : 'text-indigo-950'
                    }`}
                  >
                    <span>📄</span>
                    <h3>Laporan Detail Presensi BK (Jam Ke-1 s/d 8)</h3>
                  </div>
                  <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                    Matriks presensi jam 1–8.
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label
                      className={`block text-[9px] font-extrabold uppercase mb-1 ${
                        isDarkMode ? 'text-indigo-300' : 'text-indigo-950'
                      }`}
                    >
                      TANGGAL
                    </label>
                    <input
                      type="date"
                      value={tanggalAbsensi}
                      onChange={(e) => setTanggalAbsensi(e.target.value)}
                      className={`w-full border rounded-xl px-2 py-1 text-xs font-bold focus:outline-none ${
                        isDarkMode
                          ? 'bg-slate-800 border-slate-700 text-white'
                          : 'bg-white border-slate-300 text-slate-900'
                      }`}
                    />
                  </div>
                  <div>
                    <label
                      className={`block text-[9px] font-extrabold uppercase mb-1 ${
                        isDarkMode ? 'text-indigo-300' : 'text-indigo-950'
                      }`}
                    >
                      BULAN
                    </label>
                    <input
                      type="month"
                      value={bulanAbsensiDetail}
                      onChange={(e) => setBulanAbsensiDetail(e.target.value)}
                      className={`w-full border rounded-xl px-2 py-1 text-xs font-bold focus:outline-none ${
                        isDarkMode
                          ? 'bg-slate-800 border-slate-700 text-white'
                          : 'bg-white border-slate-300 text-slate-900'
                      }`}
                    />
                  </div>
                  <div>
                    <label
                      className={`block text-[9px] font-extrabold uppercase mb-1 ${
                        isDarkMode ? 'text-indigo-300' : 'text-indigo-950'
                      }`}
                    >
                      KELAS (7–12)
                    </label>
                    <select
                      value={kelasRiwayatAbsensi}
                      onChange={(e) => setKelasRiwayatAbsensi(e.target.value)}
                      className={`w-full border rounded-xl px-2 py-1 text-xs font-bold focus:outline-none ${
                        isDarkMode
                          ? 'bg-slate-800 border-slate-700 text-white'
                          : 'bg-white border-slate-300 text-slate-900'
                      }`}
                    >
                      <option value="">Semua Kelas</option>
                      {renderKelasOptGroups(false)}
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

              {/* 8. RIWAYAT NILAI */}
              <div
                className={`backdrop-blur-md border rounded-2xl p-4 shadow-xs flex flex-col justify-between space-y-3 ${
                  isDarkMode
                    ? 'bg-slate-900/90 border-slate-800'
                    : 'bg-gradient-to-br from-indigo-100/90 via-slate-100/90 to-indigo-50/90 border-indigo-200/80'
                }`}
              >
                <div>
                  <div
                    className={`flex items-center gap-2 font-extrabold text-sm mb-1 ${
                      isDarkMode ? 'text-indigo-400' : 'text-indigo-950'
                    }`}
                  >
                    <span>📄</span>
                    <h3>Laporan Riwayat Input Nilai</h3>
                  </div>
                  <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                    Riwayat input nilai per mapel.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label
                      className={`block text-[10px] font-extrabold uppercase mb-1 ${
                        isDarkMode ? 'text-indigo-300' : 'text-indigo-950'
                      }`}
                    >
                      KELAS (7–12)
                    </label>
                    <select
                      value={kelasNilai}
                      onChange={(e) => setKelasNilai(e.target.value)}
                      className={`w-full border rounded-xl px-2 py-1 text-xs font-bold focus:outline-none ${
                        isDarkMode
                          ? 'bg-slate-800 border-slate-700 text-white'
                          : 'bg-white border-slate-300 text-slate-900'
                      }`}
                    >
                      <option value="">Semua Kelas</option>
                      {renderKelasOptGroups(false)}
                    </select>
                  </div>
                  <div>
                    <label
                      className={`block text-[10px] font-extrabold uppercase mb-1 ${
                        isDarkMode ? 'text-indigo-300' : 'text-indigo-950'
                      }`}
                    >
                      MAPEL
                    </label>
                    <select
                      value={mapelNilai}
                      onChange={(e) => setMapelNilai(e.target.value)}
                      className={`w-full border rounded-xl px-2 py-1 text-xs font-bold focus:outline-none ${
                        isDarkMode
                          ? 'bg-slate-800 border-slate-700 text-white'
                          : 'bg-white border-slate-300 text-slate-900'
                      }`}
                    >
                      {isStrictOperatorRole && <option value="">Semua Mapel</option>}
                      {mapelList.length === 0 ? (
                        <option value="">(Belum Ada Mapel)</option>
                      ) : (
                        renderMapelOptGroups(false)
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
                <div
                  className={`backdrop-blur-md border rounded-2xl p-4 space-y-3 shadow-xs ${
                    isDarkMode ? 'bg-slate-900/90 border-slate-800' : 'bg-white/90 border-slate-300'
                  }`}
                >
                  <h3
                    className={`font-extrabold text-xs uppercase border-b pb-2 ${
                      isDarkMode
                        ? 'text-indigo-400 border-slate-800'
                        : 'text-indigo-950 border-slate-200'
                    }`}
                  >
                    IDENTITAS GURU PENGAMPU (OTOMATIS DARI TABEL GURU)
                  </h3>
                  <div className="space-y-2">
                    <div>
                      <label
                        className={`block text-[10px] font-extrabold uppercase mb-1 ${
                          isDarkMode ? 'text-slate-400' : 'text-slate-600'
                        }`}
                      >
                        NAMA LENGKAP &amp; GELAR (LOGIN AKUN)
                      </label>
                      <input
                        type="text"
                        value={namaGuru}
                        readOnly
                        className={`w-full border rounded-xl px-3 py-1.5 text-xs font-bold focus:outline-none cursor-not-allowed ${
                          isDarkMode
                            ? 'bg-slate-800/60 border-slate-700 text-slate-300'
                            : 'bg-slate-200/70 border-slate-300 text-slate-700'
                        }`}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label
                          className={`block text-[10px] font-extrabold uppercase mb-1 ${
                            isDarkMode ? 'text-slate-400' : 'text-slate-600'
                          }`}
                        >
                          NUPTK
                        </label>
                        <input
                          type="text"
                          value={nuptkGuru}
                          readOnly
                          className={`w-full border rounded-xl px-3 py-1.5 text-xs font-bold focus:outline-none cursor-not-allowed ${
                            isDarkMode
                              ? 'bg-slate-800/60 border-slate-700 text-slate-300'
                              : 'bg-slate-200/70 border-slate-300 text-slate-700'
                          }`}
                        />
                      </div>
                      <div>
                        <label
                          className={`block text-[10px] font-extrabold uppercase mb-1 ${
                            isDarkMode ? 'text-slate-400' : 'text-slate-600'
                          }`}
                        >
                          JABATAN
                        </label>
                        <input
                          type="text"
                          value={jabatanGuru}
                          readOnly
                          className={`w-full border rounded-xl px-3 py-1.5 text-xs font-bold focus:outline-none cursor-not-allowed ${
                            isDarkMode
                              ? 'bg-slate-800/60 border-slate-700 text-slate-300'
                              : 'bg-slate-200/70 border-slate-300 text-slate-700'
                          }`}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div
                  className={`backdrop-blur-md border rounded-2xl p-4 space-y-3 shadow-xs ${
                    isDarkMode ? 'bg-slate-900/90 border-slate-800' : 'bg-white/90 border-slate-300'
                  }`}
                >
                  <h3
                    className={`font-extrabold text-xs uppercase border-b pb-2 ${
                      isDarkMode
                        ? 'text-indigo-400 border-slate-800'
                        : 'text-indigo-950 border-slate-200'
                    }`}
                  >
                    IDENTITAS KEPALA SEKOLAH (TTD SEBELAH KANAN)
                  </h3>
                  <div className="space-y-2">
                    <div>
                      <label
                        className={`block text-[10px] font-extrabold uppercase mb-1 ${
                          isDarkMode ? 'text-slate-400' : 'text-slate-600'
                        }`}
                      >
                        NAMA KEPALA SEKOLAH
                      </label>
                      <input
                        type="text"
                        value={namaKepsek}
                        onChange={(e) => setNamaKepsek(e.target.value)}
                        className={`w-full border rounded-xl px-3 py-1.5 text-xs font-bold focus:outline-none ${
                          isDarkMode
                            ? 'bg-slate-800 border-slate-700 text-white'
                            : 'bg-slate-50 border-slate-300 text-slate-900'
                        }`}
                      />
                    </div>
                    <div>
                      <label
                        className={`block text-[10px] font-extrabold uppercase mb-1 ${
                          isDarkMode ? 'text-slate-400' : 'text-slate-600'
                        }`}
                      >
                        NIP / NUPTK KEPALA SEKOLAH
                      </label>
                      <input
                        type="text"
                        value={nipKepsek}
                        onChange={(e) => setNipKepsek(e.target.value)}
                        className={`w-full border rounded-xl px-3 py-1.5 text-xs font-bold focus:outline-none ${
                          isDarkMode
                            ? 'bg-slate-800 border-slate-700 text-white'
                            : 'bg-slate-50 border-slate-300 text-slate-900'
                        }`}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div
                className={`backdrop-blur-md border rounded-2xl p-4 space-y-3 shadow-xs ${
                  isDarkMode ? 'bg-slate-900/90 border-slate-800' : 'bg-white/90 border-slate-300'
                }`}
              >
                <h3
                  className={`font-extrabold text-xs uppercase border-b pb-2 ${
                    isDarkMode
                      ? 'text-indigo-400 border-slate-800'
                      : 'text-indigo-950 border-slate-200'
                  }`}
                >
                  IDENTITAS LOKASI SURAT
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label
                      className={`block text-[10px] font-extrabold uppercase mb-1 ${
                        isDarkMode ? 'text-slate-400' : 'text-slate-600'
                      }`}
                    >
                      KOTA / TEMPAT TTD
                    </label>
                    <input
                      type="text"
                      value={kotaTtd}
                      onChange={(e) => setKotaTtd(e.target.value)}
                      className={`w-full border rounded-xl px-3 py-1.5 text-xs font-bold focus:outline-none ${
                        isDarkMode
                          ? 'bg-slate-800 border-slate-700 text-white'
                          : 'bg-slate-50 border-slate-300 text-slate-900'
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
          <div
            className={`border px-4 py-0.5 rounded-full text-center text-[10px] font-medium shadow-xs transition-colors duration-300 ${
              isDarkMode
                ? 'bg-slate-900 border-slate-800 text-slate-400'
                : 'bg-slate-100/90 border-slate-300 text-slate-700'
            }`}
          >
            <span>Aplikasi Guru AI</span>
            <span className="mx-2">•</span>
            <span>
              Created by <strong className="text-emerald-500 font-bold">MUZAINI AL KAHFI</strong>
            </span>
          </div>
        </div>
      </div>

      {/* MODAL LIVE PREVIEW & EDITOR RAPOR (3 HALAMAN + AI GENERATOR) */}
      <RaporPreviewModal
        isOpen={isRaporPreviewOpen}
        isDarkMode={isDarkMode}
        htmlContent={raporPreviewHtml}
        meta={raporPreviewMeta}
        selectedSemester={selectedSemester}
        onClose={() => setIsRaporPreviewOpen(false)}
        onPrintHtml={openRaporPrintWindow}
        onDownloadWordHtml={downloadRaporWordBlob}
      />

      {/* FIXED BOTTOM NAVIGATION BAR */}
      <div
        className={`border-t fixed bottom-0 left-0 right-0 z-40 shadow-lg shrink-0 print:hidden transition-colors duration-300 ${
          isDarkMode
            ? 'bg-slate-900/95 border-slate-800 backdrop-blur-md'
            : 'bg-slate-100/95 border-slate-300 backdrop-blur-md'
        }`}
      >
        <div className="max-w-xl mx-auto px-4 py-2 flex items-center justify-between">
          <Link
            href="/"
            className={`flex flex-col items-center gap-0.5 text-[11px] font-semibold transition ${
              isDarkMode
                ? 'text-slate-400 hover:text-white'
                : 'text-slate-600 hover:text-slate-950'
            }`}
          >
            <span className="text-base">🕒</span>
            <span>Dashboard</span>
          </Link>

          {isOperator && (
            <Link
              href="/siswa"
              className={`flex flex-col items-center gap-0.5 text-[11px] font-semibold transition ${
                isDarkMode
                  ? 'text-slate-400 hover:text-white'
                  : 'text-slate-600 hover:text-slate-950'
              }`}
            >
              <span className="text-base">👥</span>
              <span>Siswa</span>
            </Link>
          )}

          {isOperator && (
            <Link
              href="/guru"
              className={`flex flex-col items-center gap-0.5 text-[11px] font-semibold transition ${
                isDarkMode
                  ? 'text-slate-400 hover:text-white'
                  : 'text-slate-600 hover:text-slate-950'
              }`}
            >
              <span className="text-base">👨‍🏫</span>
              <span>Guru</span>
            </Link>
          )}

          <Link
            href="/jadwal"
            className={`flex flex-col items-center gap-0.5 text-[11px] font-semibold transition ${
              isDarkMode
                ? 'text-slate-400 hover:text-white'
                : 'text-slate-600 hover:text-slate-950'
            }`}
          >
            <span className="text-base">🎓</span>
            <span>Akademik</span>
          </Link>

          <Link
            href="/laporan"
            className={`flex flex-col items-center gap-0.5 text-[11px] font-bold transition ${
              isDarkMode ? 'text-indigo-400' : 'text-indigo-600'
            }`}
          >
            <span className="text-base">🖨️</span>
            <span>Laporan</span>
          </Link>
        </div>
      </div>
    </motion.div>
  )
}