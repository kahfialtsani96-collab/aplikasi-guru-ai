import { SupabaseClient } from '@supabase/supabase-js'

export interface RaporKelasItem {
  id: number
  nama: string
  tingkat?: string
  jenjang?: string | null
  urutan?: number | null
  wali_kelas_id?: number | null
}

export interface RaporSiswaItem {
  id: number
  nama_lengkap: string
  nis?: string
  nisn?: string
  jenis_kelamin?: string
  tempat_lahir?: string
  tanggal_lahir?: string
  agama?: string
  alamat?: string
  sekolah_asal?: string
  nama_ayah?: string
  nama_ibu?: string
  nama_wali?: string
  kelas_id?: number
}

export interface RaporGuruInfo {
  nama: string
  nuptk: string
  jabatanLabel: string
}

export interface RaporMapelContextItem {
  id: number
  nama: string
  nilaiAkhir: number | null
  materiJurnal: string
}

export interface BuiltRaporResult {
  targetSiswa: RaporSiswaItem
  namaKelasStr: string
  unitSiswa: 'SMP' | 'SMK'
  faseKurikulum: string
  htmlRaporLengkap: string
  mapelContexts: RaporMapelContextItem[]
}

export interface BuildRaporParams {
  supabase: SupabaseClient
  targetSiswa: RaporSiswaItem
  kelasList: RaporKelasItem[]
  selectedSemester: 'Ganjil' | 'Genap'
  selectedTahunAjaran: string
  waliKelasInfo: RaporGuruInfo
  namaKepsek: string
  nipKepsek: string
  kotaTtd: string
  currentDateStr: string
  pakaiTtdCapKepsek: boolean
  originUrl: string
  aiDescriptions?: Record<string, string>
}

// Bobot tingkat kelas kronologis 7 -> 12
export function getKelasGradeWeight(namaKelas: string, tingkatDb?: string | null): number {
  const t = String(tingkatDb || '').trim()
  if (['7', '8', '9', '10', '11', '12'].includes(t)) return Number(t)

  const upper = (namaKelas || '').trim().toUpperCase()
  if (/^(XII|12)\b/.test(upper)) return 12
  if (/^(XI|11)\b/.test(upper)) return 11
  if (/^(X|10)\b/.test(upper)) return 10
  if (/^(IX|9)\b/.test(upper)) return 9
  if (/^(VIII|8)\b/.test(upper)) return 8
  if (/^(VII|7)\b/.test(upper)) return 7
  return 99
}

// Deteksi unit SMP vs SMK
export function detectUnitByKelas(
  namaKelas: string,
  jenjangDb?: string | null,
  tingkatDb?: string | null
): 'SMP' | 'SMK' {
  const j = String(jenjangDb || '').trim().toUpperCase()
  if (j === 'SMK') return 'SMK'
  if (j === 'SMP') return 'SMP'

  const w = getKelasGradeWeight(namaKelas, tingkatDb)
  if (w >= 10 && w <= 12) return 'SMK'
  if ((namaKelas || '').toUpperCase().includes('DKV')) return 'SMK'
  return 'SMP'
}

// Predikat & Capaian Kompetensi Bawaan (KKM = 75)
export function getPredikatRapor(nilai: number, namaMapel: string) {
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

// Pengaman pemotong teks AI agar tetap ringkas dan rapi di tabel A4
export function clampCapaianText(text: string, unit: 'SMP' | 'SMK'): string {
  const clean = (text || '').replace(/\s+/g, ' ').trim()
  const maxChars = unit === 'SMP' ? 130 : 165
  if (clean.length <= maxChars) return clean

  const sliced = clean.slice(0, maxChars)
  const lastPeriod = sliced.lastIndexOf('.')
  if (lastPeriod > maxChars * 0.6) {
    return sliced.slice(0, lastPeriod + 1)
  }
  const lastSpace = sliced.lastIndexOf(' ')
  return (lastSpace > 0 ? sliced.slice(0, lastSpace) : sliced).replace(/[,;:\-]+$/, '') + '.'
}

// Normalisasi label kelompok mata pelajaran resmi Kurikulum Merdeka
function normalizeKelompokMapel(kelompokRaw: string | null | undefined, unit: 'SMP' | 'SMK'): string {
  const k = String(kelompokRaw || '').trim()
  const upper = k.toUpperCase()

  if (unit === 'SMK') {
    if (upper.includes('KEJURUAN') || upper.includes('PRODUKTIF') || upper === 'B') {
      return 'B. Kelompok Mata Pelajaran Kejuruan'
    }
    if (
      upper.includes('MULOK') ||
      upper.includes('MUATAN LOKAL') ||
      upper.includes('KEAGAMAAN') ||
      upper.includes('PESANTREN')
    ) {
      return 'C. Muatan Lokal & Kepesantrenan'
    }
    return 'A. Kelompok Mata Pelajaran Umum'
  } else {
    if (upper.includes('MULOK') || upper.includes('MUATAN LOKAL') || upper.includes('KEAGAMAAN') || upper === 'B') {
      return 'B. Muatan Lokal & Kekhasan Pondok'
    }
    return 'A. Kelompok Mata Pelajaran Umum'
  }
}

// Helper memeriksa kecocokan tingkat mapel SMK (termasuk "Semua Tingkat")
function isMapelMatchGrade(tingkatMapel: string | null | undefined, gradeWeight: number): boolean {
  const raw = String(tingkatMapel || '').trim().toUpperCase()
  if (!raw || raw.includes('SEMUA') || raw === 'ALL' || raw === '-') return true

  const tokens = raw.split(/[,;/\-\s]+/).filter(Boolean)
  if (gradeWeight === 10) return tokens.includes('X') || tokens.includes('10')
  if (gradeWeight === 11) return tokens.includes('XI') || tokens.includes('11')
  if (gradeWeight === 12) return tokens.includes('XII') || tokens.includes('12')
  return true
}

// Helper memeriksa kecocokan semester mapel
function isMapelMatchSemester(semesterMapel: string | null | undefined, selectedSem: 'Ganjil' | 'Genap'): boolean {
  const raw = String(semesterMapel || '').trim().toLowerCase()
  if (!raw || raw.includes('&') || raw.includes('semua') || raw === '-') return true
  return raw === selectedSem.toLowerCase()
}

export async function buildRaporDocument(params: BuildRaporParams): Promise<BuiltRaporResult> {
  const {
    supabase,
    targetSiswa,
    kelasList,
    selectedSemester,
    selectedTahunAjaran,
    waliKelasInfo,
    namaKepsek,
    nipKepsek,
    kotaTtd,
    currentDateStr,
    pakaiTtdCapKepsek,
    originUrl,
    aiDescriptions = {},
  } = params

  const kelasObj = kelasList.find((k) => Number(k.id) === Number(targetSiswa.kelas_id))
  let namaKelasStr = kelasObj?.nama || '-'
  let tingkatStr = kelasObj?.tingkat || ''
  let jenjangKelas = kelasObj?.jenjang || null

  if (targetSiswa.kelas_id && !kelasObj) {
    const { data: kelasSiswa } = await supabase
      .from('kelas')
      .select('nama_kelas, tingkat, jenjang')
      .eq('id', targetSiswa.kelas_id)
      .maybeSingle()
    if (kelasSiswa) {
      namaKelasStr = kelasSiswa.nama_kelas
      tingkatStr = kelasSiswa.tingkat || ''
      jenjangKelas = kelasSiswa.jenjang || null
    }
  }

  const unitSiswa: 'SMP' | 'SMK' = detectUnitByKelas(namaKelasStr, jenjangKelas, tingkatStr)
  const isSmk = unitSiswa === 'SMK'
  const gradeWeight = getKelasGradeWeight(namaKelasStr, tingkatStr)
  const faseKurikulum = !isSmk ? 'D' : gradeWeight === 10 ? 'E' : 'F'

  // Deteksi Kepala Sekolah otomatis sesuai jenjang (SMK vs SMP) dari tabel guru
  let finalNamaKepsek = namaKepsek
  let finalNipKepsek = nipKepsek

  if (isSmk) {
    const { data: kepsekSmkRow } = await supabase
      .from('guru')
      .select('nama_lengkap, NUPTK')
      .ilike('jabatan', '%Kepala Sekolah SMK%')
      .maybeSingle()

    if (kepsekSmkRow?.nama_lengkap) {
      finalNamaKepsek = kepsekSmkRow.nama_lengkap.trim()
      const nuptkRaw = String(kepsekSmkRow.NUPTK || '').trim()
      finalNipKepsek =
        nuptkRaw && nuptkRaw.toUpperCase() !== 'NULL' && nuptkRaw.toUpperCase() !== 'EMPTY'
          ? `NUPTK. ${nuptkRaw}`
          : 'NUPTK. -'
    } else {
      finalNamaKepsek = 'RIZIEQ NIZAR'
      finalNipKepsek = 'NUPTK. -'
    }
  }

  const namaSatuanPendidikan = isSmk ? 'SMK MUNA MUSTOFA' : 'SMP MUNA MUSTOFA'
  const namaSatuanTitle = isSmk ? 'SMK Muna Mustofa' : 'SMP Muna Mustofa'
  const npsnSekolah = isSmk ? '- (Menginduk)' : '71407877'
  const alamatResmi = 'Jl. PPTQ Muna Mustofa Kecamatan Gisting Kabupaten Tanggamus'
  const sekolahAsalDefault =
    targetSiswa.sekolah_asal ||
    (!isSmk
      ? 'SD / MI ........................................'
      : 'SMP / MTs ........................................')

  // 1. Ambil seluruh master mapel
  const { data: allMapelDb } = await supabase
    .from('mapel')
    .select('id, nama_mapel, kelompok, tingkat, jenjang, semester, urutan')
    .order('urutan', { ascending: true })
    .order('nama_mapel', { ascending: true })

  const allRows = allMapelDb || []

  const filteredAcademicMapel = allRows
    .filter((m: any) => {
      const nama = String(m.nama_mapel || '').trim()
      if (!nama || /qiro|pramuka|ekstra/i.test(nama)) return false

      const mJenjang = String(m.jenjang || 'SMP').trim().toUpperCase()
      if (!isSmk) {
        return mJenjang === 'SMP' || mJenjang === 'SEMUA' || mJenjang === 'SMP & SMK'
      } else {
        const matchUnit = mJenjang === 'SMK' || mJenjang === 'SEMUA' || mJenjang === 'SMP & SMK'
        if (!matchUnit) return false
        if (!isMapelMatchGrade(m.tingkat, gradeWeight)) return false
        if (!isMapelMatchSemester(m.semester, selectedSemester)) return false
        return true
      }
    })
    .map((m: any) => ({
      id: m.id,
      nama: String(m.nama_mapel).trim(),
      kelompok: normalizeKelompokMapel(m.kelompok, unitSiswa),
      urutan: m.urutan ?? 999,
    }))
    .sort((a, b) => {
      if (a.kelompok !== b.kelompok) return a.kelompok.localeCompare(b.kelompok)
      if (a.urutan !== b.urutan) return a.urutan - b.urutan
      return a.nama.localeCompare(b.nama)
    })

  // Ekstrakurikuler Pramuka & Qiro'ah
  const mapelEkskul = allRows
    .filter((m: any) => /qiro|pramuka|ekstra/i.test(String(m.nama_mapel || '')))
    .reduce((acc: { id: number; nama: string }[], curr: any) => {
      const cleanName = String(curr.nama_mapel || '').trim()
      if (!acc.some((item) => item.nama.toLowerCase() === cleanName.toLowerCase())) {
        acc.push({ id: curr.id, nama: cleanName })
      }
      return acc
    }, [])

  // 2. Ambil nilai siswa pada semester & tahun ajaran terpilih
  const { data: nilaiSiswa } = await supabase
    .from('nilai')
    .select('*')
    .eq('siswa_id', targetSiswa.id)
    .eq('semester', selectedSemester)
    .eq('tahun_ajaran', selectedTahunAjaran)

  // 3. Ambil ringkasan materi jurnal kelas
  let materiPerMapelMap = new Map<string, string>()
  if (targetSiswa.kelas_id) {
    const { data: jurnalKelas } = await supabase
      .from('jurnal_agenda')
      .select('mapel, materi')
      .eq('kelas_id', targetSiswa.kelas_id)
      .eq('semester', selectedSemester)
      .eq('tahun_ajaran', selectedTahunAjaran)
      .order('created_at', { ascending: false })
      .limit(60)

    ;(jurnalKelas || []).forEach((j: any) => {
      const mKey = String(j.mapel || '').trim().toLowerCase()
      const matText = String(j.materi || '').trim()
      if (mKey && matText) {
        const existing = materiPerMapelMap.get(mKey) || ''
        if (!existing.includes(matText) && existing.length < 180) {
          materiPerMapelMap.set(mKey, existing ? `${existing}; ${matText}` : matText)
        }
      }
    })
  }

  // 4. Ambil rekap ketidakhadiran siswa
  const { data: absensiSiswa } = await supabase
    .from('absensi')
    .select('tanggal, status, jam_ke')
    .eq('siswa_id', targetSiswa.id)
    .eq('semester', selectedSemester)
    .eq('tahun_ajaran', selectedTahunAjaran)

  const presensiHarianMap = new Map<string, string>()
  ;(absensiSiswa || []).forEach((a) => {
    const tgl = a.tanggal
    const jamStr = a.jam_ke || ''
    const isJam1 = jamStr.includes('Jam Ke-1') || jamStr.includes('Ke-1')
    if (!presensiHarianMap.has(tgl) || isJam1) {
      presensiHarianMap.set(tgl, a.status)
    }
  })

  const statusList = Array.from(presensiHarianMap.values())
  const sakit = statusList.filter((st) => st === 'SAKIT').length
  const izin = statusList.filter((st) => st === 'IZIN').length
  const alpa = statusList.filter((st) => st === 'ALPA').length

  const findNilaiRow = (mapelId: number, mapelNama: string) => {
    const rows = nilaiSiswa || []
    return (
      rows.find((n: any) => Number(n.mapel_id) === Number(mapelId)) ||
      rows.find(
        (n: any) =>
          String(n.mata_pelajaran || '').trim().toLowerCase() === mapelNama.trim().toLowerCase()
      ) ||
      null
    )
  }

  const rowQiroah = (nilaiSiswa || []).find((n: any) => /qiro/i.test(n.mata_pelajaran || ''))
  const nilaiQiroahNum = rowQiroah
    ? Math.round(
        [rowQiroah.nilai_tugas, rowQiroah.nilai_uts, rowQiroah.nilai_uas]
          .filter((v): v is number => typeof v === 'number' && v > 0)
          .reduce((a, b, _, arr) => a + b / arr.length, 0)
      ) || 85
    : 85
  const predikatQiroah = getPredikatRapor(nilaiQiroahNum, "Qiro'ah & Tahfidz")

  const mapelContexts: RaporMapelContextItem[] = []
  const groupedSections = new Map<string, typeof filteredAcademicMapel>()

  filteredAcademicMapel.forEach((m) => {
    const list = groupedSections.get(m.kelompok) || []
    list.push(m)
    groupedSections.set(m.kelompok, list)
  })

  let academicTableRowsHtml = ''
  if (groupedSections.size === 0) {
    academicTableRowsHtml = `<tr><td colspan="6" style="text-align: center;">Belum ada mata pelajaran ${unitSiswa} terdaftar di database.</td></tr>`
  } else {
    Array.from(groupedSections.entries()).forEach(([kelompokTitle, items]) => {
      academicTableRowsHtml += `
        <tr>
          <td colspan="6" style="background-color: #e2e8f0; font-weight: bold; font-size: 9.2pt; padding: 5px 6px;">
            ${kelompokTitle}
          </td>
        </tr>
      `

      items.forEach((mapel, idx) => {
        const rowN = findNilaiRow(mapel.id, mapel.nama) || {}
        const t = rowN.nilai_tugas ?? 0
        const u = rowN.nilai_uts ?? 0
        const a = rowN.nilai_uas ?? 0
        const komps = [t, u, a].filter((v) => v > 0)
        const hasNilai = komps.length > 0
        const avgNum = hasNilai
          ? Math.round(komps.reduce((x, y) => x + y, 0) / komps.length)
          : 0
        const predObj = hasNilai ? getPredikatRapor(avgNum, mapel.nama) : null

        const materiJurnal = materiPerMapelMap.get(mapel.nama.toLowerCase()) || ''
        mapelContexts.push({
          id: mapel.id,
          nama: mapel.nama,
          nilaiAkhir: hasNilai ? avgNum : null,
          materiJurnal,
        })

        const aiTextRaw =
          aiDescriptions[String(mapel.id)] || aiDescriptions[mapel.nama] || ''
        const finalDeskripsi = aiTextRaw
          ? clampCapaianText(aiTextRaw, unitSiswa)
          : predObj
          ? predObj.deskripsi
          : `Capaian kompetensi mata pelajaran ${mapel.nama} sedang dalam proses penilaian semester.`

        const cellPadding = '5px 6px'

        academicTableRowsHtml += `
          <tr>
            <td style="text-align: center; padding: ${cellPadding};">${idx + 1}</td>
            <td style="padding: ${cellPadding};"><b>${mapel.nama}</b></td>
            <td style="text-align: center; padding: ${cellPadding};">75</td>
            <td style="text-align: center; font-weight: bold; font-size: 10pt; padding: ${cellPadding};">
              ${hasNilai ? avgNum : '-'}
            </td>
            <td style="text-align: center; font-weight: bold; padding: ${cellPadding};">
              ${predObj ? `${predObj.huruf} (${predObj.keterangan})` : '-'}
            </td>
            <td data-mapel-desc-id="${mapel.id}" data-mapel-desc-name="${mapel.nama}" style="font-size: 8.6pt; text-align: justify; padding: ${cellPadding};">
              ${finalDeskripsi}
            </td>
          </tr>
        `
      })
    })
  }

  // Keputusan Kenaikan / Kelulusan
  let teksKeputusan = ''
  if (selectedSemester === 'Genap') {
    if (!isSmk) {
      if (gradeWeight === 7) teksKeputusan = 'NAIK KE KELAS VIII (DELAPAN)'
      else if (gradeWeight === 8) teksKeputusan = 'NAIK KE KELAS IX (SEMBILAN)'
      else teksKeputusan = `LULUS DARI SATUAN PENDIDIKAN ${namaSatuanPendidikan}`
    } else {
      if (gradeWeight === 10) teksKeputusan = 'NAIK KE KELAS XI (SEBELAS)'
      else if (gradeWeight === 11) teksKeputusan = 'NAIK KE KELAS XII (DUA BELAS)'
      else teksKeputusan = `LULUS DARI SATUAN PENDIDIKAN ${namaSatuanPendidikan}`
    }
  }

  const ttlText =
    targetSiswa.tempat_lahir || targetSiswa.tanggal_lahir
      ? `${targetSiswa.tempat_lahir || '................'}, ${targetSiswa.tanggal_lahir || '................'}`
      : '........................................................'

  // Logo & Watermark dinamis SMP vs SMK (khusus Halaman 2, 3, & 4; fallback ke logo-smp.jpg)
  const logoUnitUrl = isSmk ? `${originUrl}/logo-smk.png` : `${originUrl}/logo-smp.jpg`
  const pageWatermarkHtml = `
    <div class="page-watermark" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); opacity: 0.06; z-index: 0; pointer-events: none;">
      <img src="${logoUnitUrl}" onerror="this.onerror=null;this.src='${originUrl}/logo-smp.jpg'" alt="Watermark Unit" style="width: 360px; height: 360px; object-fit: contain;" />
    </div>
  `

  // Kop Surat Halaman 3 (SMK fallback ke header teks resmi jika kop-smk.png belum tersedia)
  const kopRaporHtml = !isSmk
    ? `<img src="${originUrl}/kop-surat.png" alt="Kop Surat SMP" style="width: 100%; max-height: 110px; object-fit: contain;" />`
    : `
      <div style="border-bottom: 3px double #000; padding-bottom: 6px; margin-bottom: 4px; text-align: center;">
        <p style="margin: 0; font-size: 10pt; font-weight: bold; letter-spacing: 0.5px;">YAYASAN PONDOK PESANTREN MUNA MUSTOFA LAMPUNG</p>
        <h2 style="margin: 2px 0; font-size: 14pt; font-weight: bold; letter-spacing: 0.8px;">SMK MUNA MUSTOFA</h2>
        <p style="margin: 0; font-size: 9pt; font-weight: bold;">Kompetensi Keahlian: Desain Komunikasi Visual (DKV)</p>
        <p style="margin: 2px 0 0 0; font-size: 8.5pt;">Alamat: Jl. PPTQ Muna Mustofa Kecamatan Gisting Kabupaten Tanggamus 35376</p>
      </div>
    `

  // Blok TTD Kepala Sekolah
  const renderTtdKepsekVisual = (leftStempel: string, leftTtd: string, heightBox: string) => {
    if (!isSmk && pakaiTtdCapKepsek) {
      return `
        <div style="position: relative; height: ${heightBox}; display: flex; align-items: center; justify-content: center;">
          <img src="${originUrl}/stempel-sekolah.png" alt="Stempel" style="position: absolute; left: ${leftStempel}; top: 0px; height: 72px; opacity: 0.9; z-index: 1;" />
          <img src="${originUrl}/ttd-kepsek.png" alt="TTD Kepsek" style="position: absolute; left: ${leftTtd}; top: 4px; height: 58px; z-index: 2;" />
        </div>
      `
    }
    return `<div style="height: ${heightBox};"></div>`
  }

  const htmlRaporLengkap = `
    <!-- ==================== HALAMAN 1: COVER RAPOR (BERSIH TANPA WATERMARK) ==================== -->
    <div class="page-section cover-box">
      <div style="text-align: center; margin-top: 24px;">
        <img src="${logoUnitUrl}" onerror="this.onerror=null;this.src='${originUrl}/logo-smp.jpg'" alt="Logo Sekolah" style="width: 115px; height: 115px; object-fit: contain; margin: 0 auto;" />
        <h2 style="margin: 18px 0 4px 0; font-size: 16pt; letter-spacing: 1px; text-transform: uppercase;">
          LAPORAN HASIL BELAJAR
        </h2>
        <h3 style="margin: 0 0 6px 0; font-size: 14pt; letter-spacing: 0.8px; text-transform: uppercase;">
          (RAPOR PESERTA DIDIK)
        </h3>
        <p style="margin: 0; font-size: 12pt; font-weight: bold; text-transform: uppercase;">
          ${namaSatuanPendidikan}
        </p>
        ${
          isSmk
            ? `<p style="margin: 4px 0 0 0; font-size: 10.5pt; font-weight: bold;">Program Keahlian: Desain Komunikasi Visual (DKV)</p>`
            : ''
        }
      </div>

      <div style="margin: 70px auto 60px auto; width: 82%; text-align: center;">
        <p style="margin: 0 0 8px 0; font-size: 11pt; font-weight: bold;">NAMA PESERTA DIDIK :</p>
        <div style="border: 2px solid #000; padding: 12px 16px; font-size: 14pt; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 24px;">
          ${targetSiswa.nama_lengkap.toUpperCase()}
        </div>

        <p style="margin: 0 0 8px 0; font-size: 11pt; font-weight: bold;">NIS / NISN :</p>
        <div style="border: 2px solid #000; padding: 10px 16px; font-size: 12.5pt; font-weight: bold; letter-spacing: 1px;">
          ${targetSiswa.nis || '-'} / ${targetSiswa.nisn || '-'}
        </div>
      </div>

      <div style="text-align: center; margin-top: 80px; font-size: 11pt; font-weight: bold; line-height: 1.5; text-transform: uppercase;">
        <p style="margin: 0;">YAYASAN PONDOK PESANTREN MUNA MUSTOFA LAMPUNG</p>
        <p style="margin: 0;">${namaSatuanPendidikan}</p>
        <p style="margin: 4px 0 0 0; font-size: 9.5pt; font-weight: normal; text-transform: none;">
          ${alamatResmi}
        </p>
        <p style="margin: 14px 0 0 0; font-size: 10.5pt;">
          KEMENTERIAN PENDIDIKAN DASAR DAN MENENGAH<br/>REPUBLIK INDONESIA
        </p>
      </div>
    </div>

    <div class="page-break"></div>

    <!-- ==================== HALAMAN 2: IDENTITAS SEKOLAH & PESERTA DIDIK ==================== -->
    <div class="page-section" style="position: relative;">
      ${pageWatermarkHtml}
      <div style="position: relative; z-index: 1;">
        <div style="text-align: center; margin-bottom: 14px;">
          <h3 style="margin: 0; font-size: 12.5pt; text-transform: uppercase; text-decoration: underline;">
            IDENTITAS SATUAN PENDIDIKAN &amp; PESERTA DIDIK
          </h3>
        </div>

        <h4 class="section-title">I. IDENTITAS SATUAN PENDIDIKAN</h4>
        <table class="table-identitas" style="margin-bottom: 14px;">
          <tr><td style="width: 34%;">1. Nama Satuan Pendidikan</td><td style="width: 3%;">:</td><td><b>${namaSatuanPendidikan}</b></td></tr>
          <tr><td>2. NPSN</td><td>:</td><td><b>${npsnSekolah}</b></td></tr>
          <tr><td>3. Alamat Sekolah</td><td>:</td><td>${alamatResmi}</td></tr>
          <tr><td>4. Kabupaten / Provinsi</td><td>:</td><td>Kabupaten Tanggamus / Provinsi Lampung</td></tr>
          ${
            isSmk
              ? `<tr><td>5. Program / Konsentrasi Keahlian</td><td>:</td><td>Desain Komunikasi Visual (DKV)</td></tr>`
              : ''
          }
        </table>

        <h4 class="section-title">II. KETERANGAN TENTANG DIRI PESERTA DIDIK</h4>
        <table class="table-identitas">
          <tr><td style="width: 34%;">1. Nama Peserta Didik (Lengkap)</td><td style="width: 3%;">:</td><td><b>${targetSiswa.nama_lengkap.toUpperCase()}</b></td></tr>
          <tr><td>2. Nomor Induk / NISN</td><td>:</td><td>${targetSiswa.nis || '-'} / ${targetSiswa.nisn || '-'}</td></tr>
          <tr><td>3. Tempat, Tanggal Lahir</td><td>:</td><td>${ttlText}</td></tr>
          <tr><td>4. Jenis Kelamin</td><td>:</td><td>${targetSiswa.jenis_kelamin || 'Laki-laki / Perempuan'}</td></tr>
          <tr><td>5. Agama</td><td>:</td><td>${targetSiswa.agama || 'Islam'}</td></tr>
          <tr><td>6. Status dalam Keluarga</td><td>:</td><td>Anak Kandung</td></tr>
          <tr><td>7. Anak ke</td><td>:</td><td>........</td></tr>
          <tr><td>8. Alamat Peserta Didik</td><td>:</td><td>${targetSiswa.alamat || '........................................................'}</td></tr>
          <tr><td>9. Nomor Telepon Rumah / HP</td><td>:</td><td>........................................................</td></tr>
          <tr><td>10. Sekolah Asal</td><td>:</td><td>${sekolahAsalDefault}</td></tr>
          <tr><td>11. Diterima di Sekolah Ini</td><td></td><td></td></tr>
          <tr><td style="padding-left: 16px;">a. Di Kelas</td><td>:</td><td><b>${namaKelasStr}</b></td></tr>
          <tr><td style="padding-left: 16px;">b. Pada Tanggal</td><td>:</td><td>Juli ${selectedTahunAjaran.split('/')[0]}</td></tr>
          <tr><td>12. Nama Orang Tua</td><td></td><td></td></tr>
          <tr><td style="padding-left: 16px;">a. Ayah</td><td>:</td><td>${targetSiswa.nama_ayah || '........................................................'}</td></tr>
          <tr><td style="padding-left: 16px;">b. Ibu</td><td>:</td><td>${targetSiswa.nama_ibu || '........................................................'}</td></tr>
          <tr><td>13. Alamat Orang Tua</td><td>:</td><td>${targetSiswa.alamat || '........................................................'}</td></tr>
          <tr><td>14. Pekerjaan Orang Tua (Ayah / Ibu)</td><td>:</td><td>.................................... / ....................................</td></tr>
          <tr><td>15. Nama Wali Peserta Didik</td><td>:</td><td>${targetSiswa.nama_wali || '-'}</td></tr>
          <tr><td>16. Pekerjaan Wali Peserta Didik</td><td>:</td><td>-</td></tr>
        </table>

        <!-- KOTAK PAS FOTO 3X4 & TTD KEPALA SEKOLAH -->
        <table style="width: 100%; border: none; margin-top: 24px; font-size: 9.5pt;">
          <tr>
            <td style="width: 45%; border: none; text-align: center; vertical-align: middle;">
              <div style="width: 85px; height: 112px; border: 1px solid #000; margin: 0 auto; display: flex; align-items: center; justify-content: center; font-size: 8.5pt; color: #555;">
                Pas Foto<br/>3 x 4 cm
              </div>
            </td>
            <td style="width: 55%; border: none; text-align: left; vertical-align: top; padding-left: 20px;">
              ${kotaTtd}, Juli ${selectedTahunAjaran.split('/')[0]}<br/>
              <strong>Kepala ${namaSatuanTitle},</strong>
              ${renderTtdKepsekVisual('-10px', '10px', '68px')}
              <u><strong>${finalNamaKepsek}</strong></u><br/>
              ${finalNipKepsek}
            </td>
          </tr>
        </table>
      </div>
    </div>

    <div class="page-break"></div>

    <!-- ==================== HALAMAN 3: CAPAIAN KOMPETENSI AKADEMIK (NILAI & DESKRIPSI) ==================== -->
    <div class="page-section" style="position: relative;">
      ${pageWatermarkHtml}
      <div style="position: relative; z-index: 1;">
        <div style="text-align: center; margin-bottom: 10px;">
          ${kopRaporHtml}
        </div>

        <div style="text-align: center; margin-bottom: 12px;">
          <h2 style="margin: 0; font-size: 12pt; letter-spacing: 0.6px; text-transform: uppercase;">
            LAPORAN HASIL BELAJAR PESERTA DIDIK (${unitSiswa})
          </h2>
        </div>

        <table class="table-identitas" style="margin-bottom: 12px; font-size: 9.5pt;">
          <tr>
            <td style="width: 18%;">Nama Peserta Didik</td>
            <td style="width: 36%;">: <b>${targetSiswa.nama_lengkap.toUpperCase()}</b></td>
            <td style="width: 18%;">Kelas / Fase</td>
            <td style="width: 28%;">: <b>${namaKelasStr} / Fase ${faseKurikulum}</b></td>
          </tr>
          <tr>
            <td>NIS / NISN</td>
            <td>: ${targetSiswa.nis || '-'} / ${targetSiswa.nisn || '-'}</td>
            <td>Semester</td>
            <td>: ${selectedSemester}</td>
          </tr>
          <tr>
            <td>Nama Sekolah</td>
            <td>: ${namaSatuanTitle}</td>
            <td>Tahun Pelajaran</td>
            <td>: ${selectedTahunAjaran}</td>
          </tr>
        </table>

        <h4 class="section-title">A. CAPAIAN KOMPETENSI AKADEMIK</h4>
        <table class="table-data" style="margin-bottom: 10px;">
          <thead>
            <tr>
              <th style="width: 5%; text-align: center;">No</th>
              <th style="width: 26%; text-align: left;">Mata Pelajaran</th>
              <th style="width: 7%; text-align: center;">KKM</th>
              <th style="width: 10%; text-align: center;">Nilai Akhir</th>
              <th style="width: 13%; text-align: center;">Predikat</th>
              <th style="width: 39%; text-align: left;">Capaian Kompetensi</th>
            </tr>
          </thead>
          <tbody>
            ${academicTableRowsHtml}
          </tbody>
        </table>
      </div>
    </div>

    <div class="page-break"></div>

    <!-- ==================== HALAMAN 4: PEMBIASAAN, EKSKUL, ABSENSI & PENGESAHAN ==================== -->
    <div class="page-section" style="position: relative;">
      ${pageWatermarkHtml}
      <div style="position: relative; z-index: 1;">
        <!-- Header Mini Identitas Siswa agar lembar ke-4 tetap jelas kepemilikannya -->
        <table class="table-identitas" style="margin-bottom: 14px; font-size: 9.5pt; border-bottom: 1.5px solid #000; padding-bottom: 6px;">
          <tr>
            <td style="width: 18%;">Nama Peserta Didik</td>
            <td style="width: 36%;">: <b>${targetSiswa.nama_lengkap.toUpperCase()}</b></td>
            <td style="width: 18%;">Kelas / Fase</td>
            <td style="width: 28%;">: <b>${namaKelasStr} / Fase ${faseKurikulum}</b></td>
          </tr>
          <tr>
            <td>NIS / NISN</td>
            <td>: ${targetSiswa.nis || '-'} / ${targetSiswa.nisn || '-'}</td>
            <td>Semester / TA</td>
            <td>: ${selectedSemester} / ${selectedTahunAjaran}</td>
          </tr>
        </table>

        <h4 class="section-title">B. PEMBIASAAN KEAGAMAAN &amp; QIRO&apos;AH</h4>
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
              <td style="font-size: 8.8pt;">Mampu membaca Al-Qur&apos;an sesuai kaidah tajwid dan makharijul huruf dengan ${predikatQiroah.keterangan.toLowerCase()}.</td>
            </tr>
            <tr>
              <td style="text-align: center;">2</td>
              <td><b>Shalat Berjamaah &amp; Adab Islami</b></td>
              <td style="text-align: center; font-weight: bold;">A (Sangat Baik)</td>
              <td style="font-size: 8.8pt;">Membiasakan shalat berjamaah di sekolah, berakhlak santun kepada guru, serta menghormati sesama teman.</td>
            </tr>
          </tbody>
        </table>

        ${
          isSmk
            ? `
              <h4 class="section-title">C. PRAKTIK KERJA LAPANGAN (PKL)</h4>
              <table class="table-data" style="margin-bottom: 14px;">
                <thead>
                  <tr>
                    <th style="width: 5%; text-align: center;">No</th>
                    <th style="width: 30%; text-align: left;">Mitra DU/DI</th>
                    <th style="width: 25%; text-align: left;">Lokasi</th>
                    <th style="width: 15%; text-align: center;">Lamanya</th>
                    <th style="width: 25%; text-align: left;">Keterangan</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style="text-align: center;">1</td>
                    <td>-</td>
                    <td>-</td>
                    <td style="text-align: center;">-</td>
                    <td>Belum melaksanakan PKL pada semester ini.</td>
                  </tr>
                </tbody>
              </table>
            `
            : ''
        }

        <h4 class="section-title">${isSmk ? 'D' : 'C'}. KEGIATAN EKSTRAKURIKULER</h4>
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
                ? mapelEkskul
                    .map((m, idx) => {
                      const rowN = findNilaiRow(m.id, m.nama) || {}
                      const avg = rowN.nilai_uas ?? rowN.nilai_tugas ?? 85
                      const predObj = getPredikatRapor(avg, m.nama)
                      return `
                      <tr>
                        <td style="text-align: center;">${idx + 1}</td>
                        <td><b>${m.nama}</b></td>
                        <td style="text-align: center; font-weight: bold;">${predObj.huruf} (${predObj.keterangan})</td>
                        <td style="font-size: 8.8pt;">Aktif dan disiplin mengikuti kegiatan ${m.nama} dengan capaian ${predObj.keterangan.toLowerCase()}.</td>
                      </tr>
                    `
                    })
                    .join('')
                : `
                  <tr>
                    <td style="text-align: center;">1</td>
                    <td><b>Pramuka</b></td>
                    <td style="text-align: center; font-weight: bold;">B (Baik)</td>
                    <td style="font-size: 8.8pt;">Aktif mengikuti kegiatan kepramukaan, kerja sama tim, dan kedisiplinan di sekolah.</td>
                  </tr>
                `
            }
          </tbody>
        </table>

        <!-- KETIDAKHADIRAN & CATATAN WALI KELAS -->
        <table style="width: 100%; border: none; border-collapse: collapse; margin-bottom: 16px;">
          <tr>
            <td style="width: 38%; vertical-align: top; padding-right: 12px; border: none;">
              <h4 class="section-title">${isSmk ? 'E' : 'D'}. KETIDAKHADIRAN</h4>
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
              <h4 class="section-title">${isSmk ? 'F' : 'E'}. CATATAN WALI KELAS</h4>
              <div style="border: 1px solid #000; padding: 9px 11px; min-height: 76px; font-size: 9pt; font-style: italic; background-color: rgba(250, 250, 250, 0.75);">
                &ldquo;Pertahankan semangat belajar, kedisiplinan, dan akhlak mulia baik di lingkungan sekolah maupun di rumah. Terus tingkatkan prestasi pada semester berikutnya.&rdquo;
              </div>
            </td>
          </tr>
        </table>

        ${
          selectedSemester === 'Genap'
            ? `
              <div style="border: 1.5px solid #000; padding: 9px 14px; margin-bottom: 16px; background-color: rgba(248, 250, 252, 0.8);">
                <p style="margin: 0; font-size: 9.5pt;">
                  <b>KEPUTUSAN:</b> Berdasarkan pencapaian seluruh kompetensi pada Semester Ganjil dan Genap Tahun Pelajaran ${selectedTahunAjaran}, peserta didik dinyatakan:
                </p>
                <p style="margin: 5px 0 0 0; font-size: 10.5pt; font-weight: bold; text-align: center; letter-spacing: 0.5px;">
                  ${teksKeputusan}
                </p>
              </div>
            `
            : ''
        }

        <!-- TANDA TANGAN 3 PIHAK -->
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
              <td colspan="3" style="border: none; text-align: center; padding-top: 16px; vertical-align: top;">
                Mengetahui,<br/>
                <strong>Kepala ${namaSatuanTitle}</strong><br/>
                ${renderTtdKepsekVisual('41%', '46%', '68px')}
                <u><strong>${finalNamaKepsek}</strong></u><br/>
                ${finalNipKepsek}
              </td>
            </tr>
          </table>
        </div>
      </div>
    </div>
  `

  return {
    targetSiswa,
    namaKelasStr,
    unitSiswa,
    faseKurikulum,
    htmlRaporLengkap,
    mapelContexts,
  }
}

// =========================================================================
// GENERATOR CAPAIAN KOMPETENSI RAPOR OTOMATIS VIA AI
// =========================================================================
export async function generateAiCapaianRapor(params: {
  namaSiswa: string
  unit: 'SMP' | 'SMK'
  faseKelas: string
  mapelContexts: RaporMapelContextItem[]
}): Promise<Record<string, string>> {
  const { namaSiswa, unit, faseKelas, mapelContexts } = params

  const daftarMapelPayload = mapelContexts.map((m) => ({
    id: String(m.id),
    namaMapel: m.nama,
    nilaiAkhir: m.nilaiAkhir !== null ? m.nilaiAkhir : '-',
    materiJurnal: m.materiJurnal || '',
  }))

  const response = await fetch('/api/gemini', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      activeTool: 'rapor-deskripsi',
      jenjang: unit,
      faseKelas,
      spesifikData: {
        namaSiswa,
        daftarMapel: daftarMapelPayload,
      },
    }),
  })

  const data = await response.json()
  if (!response.ok || data.error) {
    throw new Error(data.error || 'Gagal menghasilkan capaian kompetensi AI')
  }

  const rawDescriptions: Record<string, string> = data.descriptions || {}
  const clampedDescriptions: Record<string, string> = {}

  Object.entries(rawDescriptions).forEach(([key, val]) => {
    clampedDescriptions[key] = clampCapaianText(String(val || ''), unit)
  })

  return clampedDescriptions
}