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
}

interface SiswaItem {
  id: number
  nama_lengkap: string
  nisn?: string
  kelas_id?: number
  kelas?: any
}

interface BankSoalItem {
  id: number
  mapel: string
  fase_kelas: string
  bentuk_soal: string
  jumlah_soal: number
  isi_soal: string
  nama_guru?: string
  created_at?: string
}

export default function LaporanPage() {
  const router = useRouter()
  const { isOperator } = useAuthRole()

  const [activeTab, setActiveTab] = useState<'pusat' | 'pengaturan'>('pusat')
  const [userDisplayName, setUserDisplayName] = useState('GURU')
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

  // Identitas TTD & Otomatisasi Profil Guru
  const [namaGuru, setNamaGuru] = useState('Guru Pengampu')
  const [nuptkGuru, setNuptkGuru] = useState('-')
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
        .select('id, nama_lengkap, role, NUPTK, nuptk, nip')
        .ilike('email', cleanEmail)
        .maybeSingle()

      if (error) {
        console.error('Error fetching guru:', error)
      }

      if (dataGuruLogin) {
        setUserDisplayName(dataGuruLogin.nama_lengkap.toUpperCase())
        const isUserStrictOperator = (dataGuruLogin.role || '').toLowerCase() === 'operator'
        
        const rawNuptk = dataGuruLogin.NUPTK || dataGuruLogin.nuptk || dataGuruLogin.nip
        const cleanNuptk = rawNuptk && rawNuptk !== 'EMPTY' && rawNuptk !== 'NULL' ? String(rawNuptk) : '-'

        setNamaGuru(dataGuruLogin.nama_lengkap)
        setNuptkGuru(cleanNuptk)

        fetchMasterData(dataGuruLogin.id, isUserStrictOperator)
      } else {
        const fallbackName = user.user_metadata?.full_name || cleanEmail.split('@')[0]
        setUserDisplayName(fallbackName.toUpperCase())
        fetchMasterData(null, isOperator)
      }
    }

    getUserData()
  }, [isOperator])

  // AMBIL MASTER DATA MAPEL & KELAS
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
        .select('id, nama_kelas')
        .order('nama_kelas', { ascending: true })

      const { data: dataSiswa } = await supabase
        .from('siswa')
        .select('id, nama_lengkap, nisn, kelas_id')
        .order('nama_lengkap', { ascending: true })

      if (dataKelas) setKelasList(dataKelas.map(k => ({ id: k.id, nama: k.nama_kelas })))
      if (dataSiswa) setSiswaList(dataSiswa as any)

    } catch (err) {
      console.error('Error fetching master data:', err)
    }
  }

  // KOP SURAT GAMBAR PNG
  const headerKopHTML = `
    <div style="text-align: center; margin-bottom: 12px;">
      <img src="/kop-surat.png" alt="Kop Surat" style="width: 100%; max-height: 140px; object-fit: contain;" />
    </div>
  `

  // FOOTER TTD GENERATOR
  const getFooterTtdHTML = (namaGuruPengampu: string, nuptkGuruPengampu: string = '-') => `
    <div style="margin-top: 25px; font-family: 'Times New Roman', serif; font-size: 9.5pt; page-break-inside: avoid; color: #000;">
      <table style="width: 100%; border: none;">
        <tr>
          <td style="width: 50%; border: none; text-align: center; vertical-align: top;">
            ${kotaTtd}, ${currentDateStr}<br/>
            <strong>Guru Pengampu Mata Pelajaran</strong><br/><br/><br/><br/>
            <u><strong>${namaGuruPengampu}</strong></u><br/>
            NUPTK: ${nuptkGuruPengampu}
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

  // CETAK BANK SOAL POLOS (MENAMPILKAN 100% DATA ASLI SUPABASE TANPA PEMOTONGAN REGEX)
  const handlePrintBankSoal = async () => {
    let query = supabase.from('bank_soal').select('*').order('created_at', { ascending: false })
    if (filterMapelBankSoal) {
      query = query.eq('mapel', filterMapelBankSoal)
    }
    if (filterKelasBankSoal) {
      query = query.ilike('fase_kelas', `%${filterKelasBankSoal}%`)
    }

    const { data: soalData, error } = await query

    if (error || !soalData || soalData.length === 0) {
      alert(`Tidak ada naskah bank soal tersimpan ${filterMapelBankSoal ? `untuk mata pelajaran ${filterMapelBankSoal}` : ''} ${filterKelasBankSoal ? `kelas ${filterKelasBankSoal}` : ''}.`)
      return
    }

    // Mengubah pindah baris (\n) menjadi <br/> tanpa memotong karakter apa pun
    const renderTeksPolos = (text: string) => {
      if (!text) return '<p><i>Isi naskah soal kosong di database.</i></p>'
      return text.replace(/\n/g, '<br/>')
    }

    const printWindow = window.open('', '_blank')
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>NASKAH SOAL ULANGAN - SMP MUNA MUSTOFA</title>
            <style>
              @page { margin: 1cm 1.5cm; size: A4; }
              body { font-family: 'Times New Roman', Times, serif; color: #000; line-height: 1.4; font-size: 10pt; }
              .header-identitas { width: 100%; border-collapse: collapse; margin-bottom: 10px; font-size: 9pt; }
              .header-identitas td { border: 1px solid #000; padding: 4px 6px; }
              .naskah-container { page-break-after: always; }
              .naskah-container:last-child { page-break-after: avoid; }
              .soal-body { text-align: justify; margin-top: 10px; }
            </style>
          </head>
          <body>
            ${
              soalData.map((s) => `
                <div class="naskah-container">
                  ${headerKopHTML}
                  <h3 style="text-align: center; text-transform: uppercase; margin: 0 0 8px 0; font-size: 11pt; letter-spacing: 0.5px;">
                    NASKAH SOAL ULANGAN / ASESMEN SUMATIF
                  </h3>
                  <table class="header-identitas">
                    <tr>
                      <td style="width: 16%;"><b>Mata Pelajaran</b></td>
                      <td style="width: 34%;">: ${s.mapel}</td>
                      <td style="width: 16%;"><b>Nama Siswa</b></td>
                      <td style="width: 34%;">: ...........................................................</td>
                    </tr>
                    <tr>
                      <td><b>Kelas / Fase</b></td>
                      <td>: ${s.fase_kelas}</td>
                      <td><b>No. Absen / NIS</b></td>
                      <td>: ...........................................................</td>
                    </tr>
                    <tr>
                      <td><b>Bentuk Soal</b></td>
                      <td>: ${s.bentuk_soal} (${s.jumlah_soal} Soal)</td>
                      <td><b>Hari / Tanggal</b></td>
                      <td>: ...........................................................</td>
                    </tr>
                    <tr>
                      <td><b>Waktu Pengerjaan</b></td>
                      <td>: 90 - 120 Menit</td>
                      <td><b>Nilai / Paraf</b></td>
                      <td>: </td>
                    </tr>
                  </table>
                  <p style="font-size: 8.5pt; font-style: italic; margin-bottom: 10px; border-bottom: 1px solid #000; padding-bottom: 4px;">
                    <b>Petunjuk Pengerjaan:</b> Periksalah lembar naskah soal sebelum mengerjakan. Pilihlah satu jawaban yang paling tepat dengan memberi tanda silang (X) pada huruf A, B, C, atau D pada lembar jawaban!
                  </p>
                  
                  <div class="soal-body">
                    ${renderTeksPolos(s.isi_soal)}
                  </div>
                </div>
              `).join('')
            }
          </body>
        </html>
      `)
      printWindow.document.close()
      setTimeout(() => { printWindow.print() }, 500)
    }
  }

  // CETAK LEMBAR KUNCI JAWABAN & TTD PEMBUAT SOAL
  const handlePrintKunciJawaban = async () => {
    let query = supabase.from('bank_soal').select('*').order('created_at', { ascending: false })
    if (filterMapelBankSoal) {
      query = query.eq('mapel', filterMapelBankSoal)
    }
    if (filterKelasBankSoal) {
      query = query.ilike('fase_kelas', `%${filterKelasBankSoal}%`)
    }

    const { data: soalData } = await query
    if (!soalData || soalData.length === 0) {
      alert('Tidak ada data bank soal untuk melihat kunci jawaban.')
      return
    }

    const renderTeksPolos = (text: string) => {
      if (!text) return '<p><i>Isi naskah soal kosong.</i></p>'
      return text.replace(/\n/g, '<br/>')
    }

    const namaGuruPembuat = soalData[0]?.nama_guru || namaGuru

    const printWindow = window.open('', '_blank')
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>KUNCI JAWABAN SOAL - ${filterMapelBankSoal || 'SEMUA MAPEL'}</title>
            <style>
              @page { margin: 1.5cm; size: A4; }
              body { font-family: 'Times New Roman', serif; font-size: 10pt; line-height: 1.4; color: #000; }
              .card { border: 1px solid #000; padding: 12px; margin-bottom: 15px; page-break-inside: avoid; }
              h3 { margin: 0 0 6px 0; text-transform: uppercase; text-align: center; }
            </style>
          </head>
          <body>
            ${headerKopHTML}
            <h2 style="text-align: center; text-transform: uppercase; margin-bottom: 15px;">LEMBAR KUNCI JAWABAN & PEDOMAN PENILAIAN GURU</h2>
            ${
              soalData.map(s => `
                <div class="card">
                  <h3>MAPEL: ${s.mapel} (Fase / Kelas: ${s.fase_kelas})</h3>
                  <p style="font-size: 9pt; margin-top: 0; text-align: center;">
                    Guru Pengampu: <b>${s.nama_guru || namaGuruPembuat}</b> | Jumlah Soal: ${s.jumlah_soal} (${s.bentuk_soal})
                  </p>
                  <hr/>
                  <div>${renderTeksPolos(s.isi_soal)}</div>
                </div>
              `).join('')
            }
            ${getFooterTtdHTML(namaGuruPembuat)}
          </body>
        </html>
      `)
      printWindow.document.close()
      setTimeout(() => { printWindow.print() }, 500)
    }
  }

  const handlePrintDocument = async (jenis: string) => {
    let judulDoc = 'LAPORAN AKADEMIK'
    let contentBody = ''

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
      if (filterKelasBimbingan) queryBimbingan = queryBimbingan.eq('kelas_id', Number(filterKelasBimbingan))
      if (filterBulanBimbingan) queryBimbingan = queryBimbingan.ilike('created_at', `${filterBulanBimbingan}%`)

      const { data: bimbinganData } = await queryBimbingan

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

    executePrint(judulDoc, contentBody, namaGuru)
  }

  // CETAK LEMBAR RAPOR SISWA
  const handlePrintRaporSiswa = async () => {
    if (!selectedSiswaRapor) {
      alert('Pilih siswa terlebih dahulu untuk mencetak Lembar Rapor!')
      return
    }

    const targetSiswa = siswaList.find(s => s.id === Number(selectedSiswaRapor))
    if (!targetSiswa) return

    let namaKelasStr = '-'
    if (targetSiswa.kelas_id) {
      const { data: kelasSiswa } = await supabase.from('kelas').select('nama_kelas').eq('id', targetSiswa.kelas_id).maybeSingle()
      if (kelasSiswa) namaKelasStr = kelasSiswa.nama_kelas
    }

    const { data: nilaiSiswa } = await supabase.from('nilai').select('*').eq('siswa_id', targetSiswa.id).eq('semester', selectedSemester).eq('tahun_ajaran', selectedTahunAjaran)
    const { data: absensiSiswa } = await supabase.from('absensi').select('tanggal, status, jam_ke').eq('siswa_id', targetSiswa.id).eq('semester', selectedSemester).eq('tahun_ajaran', selectedTahunAjaran)

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

    const hadir = statusList.filter(st => st === 'HADIR').length
    const sakit = statusList.filter(st => st === 'SAKIT').length
    const izin = statusList.filter(st => st === 'IZIN').length
    const alpa = statusList.filter(st => st === 'ALPA').length

    const mapelUtama = mapelList.filter(m => !/qiro|pramuka|ekstra/i.test(m.nama))
    const mapelEkskul = mapelList.filter(m => /qiro|pramuka|ekstra/i.test(m.nama))

    const judulDoc = `LAPORAN HASIL BELAJAR (RAPOR) SISWA - ${targetSiswa.nama_lengkap.toUpperCase()}`

    const contentBody = `
      <h2 style="text-align: center; text-transform: uppercase; margin-bottom: 20px; font-size: 14pt;">LAPORAN HASIL BELAJAR SISWA (RAPOR)</h2>
      
      <table style="width: 100%; border: none; font-size: 10.5pt; margin-bottom: 20px;">
        <tr>
          <td style="width: 15%; border: none;"><b>Nama Siswa</b></td>
          <td style="width: 35%; border: none;">: ${targetSiswa.nama_lengkap}</td>
          <td style="width: 15%; border: none;"><b>Kelas</b></td>
          <td style="width: 35%; border: none;">: ${namaKelasStr}</td>
        </tr>
        <tr>
          <td style="border: none;"><b>NISN</b></td>
          <td style="border: none;">: ${targetSiswa.nisn || '-'}</td>
          <td style="border: none;"><b>Semester</b></td>
          <td style="border: none;">: ${selectedSemester} / ${selectedTahunAjaran}</td>
        </tr>
      </table>

      <h4 style="margin-bottom: 8px;">A. CAPAIAN AKADEMIK MATA PELAJARAN UTAMA</h4>
      <table style="width: 100%; border-collapse: collapse; font-size: 10pt; margin-bottom: 20px;">
        <thead>
          <tr style="background-color: #f2f2f2;">
            <th style="border: 1px solid #000; padding: 6px;">No</th>
            <th style="border: 1px solid #000; padding: 6px;">Mata Pelajaran</th>
            <th style="border: 1px solid #000; padding: 6px;">Tugas</th>
            <th style="border: 1px solid #000; padding: 6px;">UTS</th>
            <th style="border: 1px solid #000; padding: 6px;">UAS</th>
            <th style="border: 1px solid #000; padding: 6px;">Nilai Akhir</th>
            <th style="border: 1px solid #000; padding: 6px;">Predikat</th>
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
              const avg = komps.length > 0 ? (komps.reduce((x, y) => x + y, 0) / komps.length).toFixed(1) : '-'
              const predikat = avg !== '-' ? (Number(avg) >= 85 ? 'Sangat Baik (A)' : Number(avg) >= 75 ? 'Baik (B)' : 'Cukup (C)') : '-'

              return `
                <tr>
                  <td style="border: 1px solid #000; padding: 5px; text-align: center;">${idx + 1}</td>
                  <td style="border: 1px solid #000; padding: 5px;">${mapel.nama}</td>
                  <td style="border: 1px solid #000; padding: 5px; text-align: center;">${rowN.nilai_tugas ?? '-'}</td>
                  <td style="border: 1px solid #000; padding: 5px; text-align: center;">${rowN.nilai_uts ?? '-'}</td>
                  <td style="border: 1px solid #000; padding: 5px; text-align: center;">${rowN.nilai_uas ?? '-'}</td>
                  <td style="border: 1px solid #000; padding: 5px; text-align: center; font-weight: bold;">${avg}</td>
                  <td style="border: 1px solid #000; padding: 5px; text-align: center;">${predikat}</td>
                </tr>
              `
            }).join('')
          }
        </tbody>
      </table>

      <h4 style="margin-bottom: 8px;">B. KEGIATAN EKSTRAKURIKULER (QIRO'AH & PRAMUKA)</h4>
      <table style="width: 100%; border-collapse: collapse; font-size: 10pt; margin-bottom: 20px;">
        <thead>
          <tr style="background-color: #f2f2f2;">
            <th style="border: 1px solid #000; padding: 6px; width: 8%;">No</th>
            <th style="border: 1px solid #000; padding: 6px;">Kegiatan Ekstrakulikuler</th>
            <th style="border: 1px solid #000; padding: 6px; text-align: center;">Nilai Capaian</th>
            <th style="border: 1px solid #000; padding: 6px;">Keterangan / Predikat</th>
          </tr>
        </thead>
        <tbody>
          ${
            mapelEkskul.length > 0
              ? mapelEkskul.map((m, idx) => {
                  const rowN = (nilaiSiswa || []).find(n => n.mata_pelajaran === m.nama) || {}
                  const avg = rowN.nilai_uas ?? rowN.nilai_tugas ?? 80
                  const predikat = avg >= 85 ? 'Sangat Baik (A)' : avg >= 75 ? 'Baik (B)' : 'Cukup (C)'
                  return `
                    <tr>
                      <td style="border: 1px solid #000; padding: 5px; text-align: center;">${idx + 1}</td>
                      <td style="border: 1px solid #000; padding: 5px;"><b>${m.nama}</b></td>
                      <td style="border: 1px solid #000; padding: 5px; text-align: center; font-weight: bold;">${avg}</td>
                      <td style="border: 1px solid #000; padding: 5px;">${predikat}</td>
                    </tr>
                  `
                }).join('')
              : `
                <tr>
                  <td style="border: 1px solid #000; padding: 5px; text-align: center;">1</td>
                  <td style="border: 1px solid #000; padding: 5px;">Pramuka / Qiro'ah</td>
                  <td style="border: 1px solid #000; padding: 5px; text-align: center; font-weight: bold;">Baik (B)</td>
                  <td style="border: 1px solid #000; padding: 5px;">Aktif mengikuti kegiatan ekstrakulikuler sekolah</td>
                </tr>
              `
          }
        </tbody>
      </table>

      <h4 style="margin-bottom: 8px;">C. REKAPITULASI KEHADIRAN SISWA (HARIAN)</h4>
      <table style="width: 50%; border-collapse: collapse; font-size: 10pt;">
        <tr><td style="border: 1px solid #000; padding: 5px;">Hadir (H)</td><td style="border: 1px solid #000; padding: 5px; text-align: center; font-weight: bold;">${hadir} Hari</td></tr>
        <tr><td style="border: 1px solid #000; padding: 5px;">Sakit (S)</td><td style="border: 1px solid #000; padding: 5px; text-align: center;">${sakit} Hari</td></tr>
        <tr><td style="border: 1px solid #000; padding: 5px;">Izin (I)</td><td style="border: 1px solid #000; padding: 5px; text-align: center;">${izin} Hari</td></tr>
        <tr><td style="border: 1px solid #000; padding: 5px;">Alpa (A)</td><td style="border: 1px solid #000; padding: 5px; text-align: center;">${alpa} Hari</td></tr>
      </table>
    `

    executePrint(judulDoc, contentBody, namaGuru)
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

    executePrint(judulDoc, contentBody, namaGuru)
  }

  const handlePrintRiwayatNilai = async () => {
    let query = supabase.from('nilai').select('*, siswa:siswa_id(nama_lengkap, kelas:kelas_id(nama_kelas))').eq('semester', selectedSemester).eq('tahun_ajaran', selectedTahunAjaran).order('created_at', { ascending: false })
    if (kelasNilai) query = query.eq('kelas_id', Number(kelasNilai))
    if (mapelNilai) query = query.eq('mapel_id', Number(mapelNilai))

    const { data: nilaiData } = await query
    const selectedK = kelasList.find(k => k.id === Number(kelasNilai))
    const selectedM = mapelList.find(m => m.id === Number(mapelNilai))

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

    executePrint(judulDoc, contentBody, namaGuru)
  }

  const executePrint = (judulDoc: string, contentBody: string, namaGuruCetak: string = namaGuru) => {
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
            ${getFooterTtdHTML(namaGuruCetak, nuptkGuru)}
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
                <p className={`text-[11px] font-bold mt-0.5 ${isDarkMode ? 'text-emerald-400' : 'text-emerald-800'}`}>Pusat Laporan &amp; Cetak PDF Dokumentasi</p>
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
              <span>🔏 Sertakan TTD &amp; Stempel Resmi Kepsek pada Cetakan PDF</span>
            </label>
          </div>
        </div>

        <main className="max-w-6xl w-full mx-auto p-4 flex-1 flex flex-col min-h-0 overflow-y-auto space-y-4">
          {activeTab === 'pusat' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-12">
              
              {/* CETAK BANK SOAL BERDASARKAN MAPEL & KELAS */}
              <div className="md:col-span-2 bg-gradient-to-r from-amber-700 via-orange-800 to-amber-950 text-white rounded-2xl p-4 shadow-md space-y-3">
                <div className="flex items-center gap-2 font-extrabold text-sm">
                  <span>❓</span>
                  <h3>Cetak Naskah Soal Ulangan (Murni Soal &amp; Hemat Kertas)</h3>
                </div>
                <p className="text-xs text-amber-100 font-medium">Cetak naskah soal ulangan yang 100% utuh dari database Supabase.</p>
                
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
                      <span>🖨️</span> Cetak Naskah Soal Siswa
                    </button>
                  </div>

                  <div className="flex items-end">
                    <button
                      onClick={handlePrintKunciJawaban}
                      className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-black py-1.5 rounded-xl text-xs transition shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <span>🔑</span> Cetak Kunci Jawaban
                    </button>
                  </div>
                </div>
              </div>

              {/* CETAK RAPOR INDIVIDU SISWA */}
              <div className="md:col-span-2 bg-gradient-to-r from-emerald-800 via-teal-800 to-emerald-950 text-white rounded-2xl p-4 shadow-md space-y-3">
                <div className="flex items-center gap-2 font-extrabold text-sm">
                  <span>🎓</span>
                  <h3>Cetak Lembar Rapor Hasil Belajar (Per Siswa)</h3>
                </div>
                <p className="text-xs text-emerald-100 font-medium">Cetak lembar Rapor resmi individu siswa lengkap dengan pemisahan Ekstrakulikuler (Qiro'ah &amp; Pramuka).</p>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-extrabold uppercase mb-1 text-emerald-200">1. PILIH KELAS</label>
                    <select
                      value={filterKelasRapor}
                      onChange={(e) => {
                        setFilterKelasRapor(e.target.value)
                        setSelectedSiswaRapor('')
                      }}
                      className="w-full bg-white text-slate-900 border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs font-bold focus:outline-none"
                    >
                      <option value="">Pilih Kelas</option>
                      {kelasList.map((k) => (
                        <option key={k.id} value={k.id}>{k.nama}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-extrabold uppercase mb-1 text-emerald-200">2. PILIH SISWA</label>
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

                <button
                  onClick={handlePrintRaporSiswa}
                  disabled={!selectedSiswaRapor}
                  className="w-full bg-amber-400 hover:bg-amber-500 disabled:bg-slate-400 text-slate-950 font-black py-2 rounded-xl text-xs transition shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <span>🖨️</span> Cetak Lembar Rapor Siswa
                </button>
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
                      <option value="">Semua Mapel</option>
                      {mapelList.map((m) => (
                        <option key={m.id} value={m.id}>{m.nama}</option>
                      ))}
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
                      <option value="">Semua Mapel</option>
                      {mapelList.map((m) => (
                        <option key={m.id} value={m.id}>{m.nama}</option>
                      ))}
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
                    IDENTITAS GURU PENGAMPU (OTOMATIS BERDASARKAN HASIL QUERY PEMBUAT MAPEL)
                  </h3>
                  <div className="space-y-2">
                    <div>
                      <label className={`block text-[10px] font-extrabold uppercase mb-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>NAMA LENGKAP & GELAR (LOGIN AKUN)</label>
                      <input
                        type="text"
                        value={namaGuru}
                        readOnly
                        className={`w-full border rounded-xl px-3 py-1.5 text-xs font-bold focus:outline-none cursor-not-allowed ${
                          isDarkMode ? 'bg-slate-800/60 border-slate-700 text-slate-300' : 'bg-slate-200/70 border-slate-300 text-slate-700'
                        }`}
                      />
                    </div>
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