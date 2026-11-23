'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuthRole } from '@/hooks/useAuthRole'
import { useDarkMode } from '@/hooks/useDarkMode'
import DarkModeToggle from '@/app/components/DarkModeToggle'
import { sortKelas, getKelasGradeWeight, compareKelasName } from '@/lib/utils'
import {
  CreditCard,
  FileText,
  Download,
  Search,
  Save,
  UserRound,
  History,
  Printer,
  Plus,
  Pencil,
  X,
} from 'lucide-react'

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
// Helper: bangun nomor peserta ujian tanpa strip (-) dari prefix kode ujian
const buildNomorPeserta = (prefix: string, noUrut: string): string =>
  `${(prefix || '').replace(/[^0-9]/g, '')}${noUrut}`

// NIS::Generate Otomatis — Prefix Tahun Ajaran (4 digit) dari tanggal sistem
// Bulan ≥ 7 (Jul–Des) → YY tahun ini + YY tahun depan (contoh: 2627)
// Bulan < 7 (Jan–Jun) → YY tahun lalu + YY tahun ini (contoh: 2526)
const getTahunAjaranPrefix = (): string => {
  const now = new Date()
  const month = now.getMonth() + 1 // 1–12
  const yySekarang = now.getFullYear() % 100
  const fmt = (n: number) => String(n).padStart(2, '0')
  if (month >= 7) {
    return fmt(yySekarang) + fmt((yySekarang + 1) % 100)
  }
  return fmt((yySekarang - 1 + 100) % 100) + fmt(yySekarang)
}

// Kode 2 digit tingkat kelas (VII→07 … XII→12); jatuh ke fallback bila tidak dikenali.
const getTingkatCode = (
  namaKelas: string,
  tingkatDb?: string | null,
  fallback = 7
): string => {
  const w = getKelasGradeWeight(namaKelas, tingkatDb)
  const valid = w >= 7 && w <= 12 ? w : fallback
  return String(valid).padStart(2, '0')
}

type JenisKartu = 'pelajar' | 'ujian' | 'guru'

interface KelasOption {
  id: number
  nama_kelas: string
  jenjang?: string
  tingkat?: string | null
}

interface ItemKartu {
  id: number | string
  nama: string
  nomorId: string
  subInfo: string
  nomorUjian?: string
  customField?: string
  isKepalaSekolah?: boolean
  fotoUrl?: string
  tipe: 'siswa' | 'guru'
}

// Tipe baris hasil query Supabase untuk kartu (menghindari `any`)
interface GuruRowUntukKartu {
  id: number
  nama_lengkap?: string | null
  nama_guru?: string | null
  nama?: string | null
  NUPTK?: string | null
  nuptk?: string | null
  nip?: string | null
  jabatan?: string | null
  mapel?: string | null
  unit_mengajar?: string | null
}

interface SiswaRowUntukKartu {
  id: number
  nisn?: string | null
  nama_lengkap?: string | null
  nama?: string | null
  kelas_id?: number | null
  jenjang?: string | null
}

export function CetakKartu({ jenjang = 'SMP' }: { jenjang?: 'SMP' | 'SMK' }) {
  const router = useRouter()
  const [userDisplayName, setUserDisplayName] = useState('GURU')
  useAuthRole()

  const { isDarkMode } = useDarkMode()

  // KONTEKS JENJANG AKTIF HALAMAN (SMP/SMK)
  const isSmk = jenjang === 'SMK'
  const sekolahNama = isSmk ? 'SMK MUNA MUSTOFA' : 'SMP MUNA MUSTOFA'
  const sekolahNamaIndo = isSmk ? 'SMK Muna Mustofa' : 'SMP Muna Mustofa'

  // STATE JENIS KARTU & UJIAN
  const [jenisKartu, setJenisKartu] = useState<JenisKartu>('pelajar')
  const [namaUjian, setNamaUjian] = useState('ASESMEN SUMATIF AKHIR SEMESTER (SAS)')
  const [prefixNoUjian, setPrefixNoUjian] = useState('')
  // Prefix Tahun Ajaran dihitung di client-side via useEffect agar aman saat
  // static prerendering (menghindari `new Date()` di server render/SSG).
  const [tahunAjaranPrefix, setTahunAjaranPrefix] = useState('')
  useEffect(() => {
    setTahunAjaranPrefix(getTahunAjaranPrefix())
  }, [])
  useEffect(() => {
    // Set prefix awal setelah prefix tahun ajaran tersedia (client-side), hanya sekali.
    if (tahunAjaranPrefix && !prefixNoUjian) {
      setPrefixNoUjian(tahunAjaranPrefix + (isSmk ? '10' : '07'))
    }
  }, [tahunAjaranPrefix, prefixNoUjian, isSmk])

  // DATA KEPALA SEKOLAH DARI DATABASE SUPABASE (dipisah per jenjang SMP/SMK)
  const [kepsekSmp, setKepsekSmp] = useState({
    nama: 'SULASTRI, S.Pd., Gr.',
    nuptk: '6337763664131233'
  })
  const [kepsekSmk, setKepsekSmk] = useState({
    nama: 'RIZIEQ NIZAR',
    nuptk: '-'
  })

  // Kepala Sekolah & jabatan mengikuti jenjang aktif halaman (SMP/SMK)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const kepsekFor = (_item?: ItemKartu) => (isSmk ? kepsekSmk : kepsekSmp)

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const kepsekJabatanLabel = (_item?: ItemKartu) =>
    isSmk ? 'Kepala SMK Muna Mustofa' : 'Kepala SMP Muna Mustofa'

  // Sumber gambar TTD Kepsek: jenjang SMK memakai ttd-yayasan.png (Rizieq Nizar
  // merangkap Ketua Yayasan), jenjang SMP tetap memakai ttd-kepsek.png (Sulastri).
  const kepsekSignatureSrc = isSmk ? '/ttd-yayasan.png' : '/ttd-kepsek.png'

  // OPSI PENGATURAN CETAK
  const [includeBackSide, setIncludeBackSide] = useState(true)
  const [includeDigitalSignature, setIncludeDigitalSignature] = useState(true)
  const [includeStamp, setIncludeStamp] = useState(true)

  // DATA KELAS & KARTU
  const [daftarKelas, setDaftarKelas] = useState<KelasOption[]>([])
  const [selectedKelasId, setSelectedKelasId] = useState<number | ''>('')
  const [selectedKelasNama, setSelectedKelasNama] = useState('')

  const [cardItems, setCardItems] = useState<ItemKartu[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingKelas, setLoadingKelas] = useState(true)

  // STATE MODAL DETAIL & EDIT
  const [selectedModalItem, setSelectedModalItem] = useState<ItemKartu | null>(null)
  const [modalActiveTab, setModalActiveTab] = useState<'front' | 'back'>('front')
  const [editingItem, setEditingItem] = useState<ItemKartu | null>(null)

  // CHECK AUTH USER
  useEffect(() => {
    async function checkAuthAndUser() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.replace('/login')
        return
      }
      const user = session.user
      if (user) {
        const nameFromMeta = user.user_metadata?.full_name || user.email?.split('@')[0] || 'GURU'
        setUserDisplayName(nameFromMeta.toUpperCase())
      }
    }
    checkAuthAndUser()
  }, [router])

  // FETCH DATA KEPALA SEKOLAH DARI DATABASE SUPABASE (SMP & SMK terpisah)
  useEffect(() => {
    async function fetchKepsekFromDB() {
      try {
        // KEPALA SEKOLAH SMP (jabatan "Kepala Sekolah" tanpa kata SMK)
        const { data: smpData } = await supabase
          .from('guru')
          .select('*')
          .ilike('jabatan', '%Kepala Sekolah%')
          .limit(20)

        if (smpData && smpData.length > 0) {
          const smpKepsek =
            smpData.find((g: GuruRowUntukKartu) => {
              const jab = String(g.jabatan || '').toLowerCase()
              return jab.includes('kepala sekolah') && !jab.includes('smk')
            }) || smpData.find((g: GuruRowUntukKartu) => String(g.nama_lengkap || '').toLowerCase().includes('sulastri')) || smpData[0]

          const rawNuptk = smpKepsek.NUPTK || smpKepsek.nuptk || smpKepsek.nip
          const cleanNuptk = rawNuptk && rawNuptk !== 'EMPTY' && rawNuptk !== 'NULL' ? rawNuptk : '6337763664131233'
          setKepsekSmp({
            nama: (smpKepsek.nama_lengkap || smpKepsek.nama || 'SULASTRI, S.Pd., Gr.').toUpperCase(),
            nuptk: cleanNuptk
          })
        }

        // KEPALA SEKOLAH SMK (jabatan mengandung kata "SMK")
        const { data: smkData } = await supabase
          .from('guru')
          .select('*')
          .ilike('jabatan', '%Kepala Sekolah SMK%')
          .maybeSingle()

        if (smkData?.nama_lengkap) {
          const nuptkRaw = String(smkData.NUPTK || smkData.nip || '').trim()
          setKepsekSmk({
            nama: smkData.nama_lengkap.trim().toUpperCase(),
            nuptk:
              nuptkRaw && nuptkRaw.toUpperCase() !== 'NULL' && nuptkRaw.toUpperCase() !== 'EMPTY'
                ? nuptkRaw
                : '-'
          })
        }
      } catch (err) {
        console.error('Error fetching kepsek from DB:', err)
      }
    }
    fetchKepsekFromDB()
  }, [])

  // FETCH DAFTAR KELAS
  useEffect(() => {
    async function fetchKelasFromDB() {
      setLoadingKelas(true)
      try {
        const { data, error } = await supabase
          .from('kelas')
          .select('id, nama_kelas, jenjang, tingkat')
          .eq('jenjang', jenjang)
          .order('id', { ascending: true })

        if (!error && data) {
          // Filter definitif: hanya tampilkan kelas sesuai jenjang aktif (SMP/SMK)
          const rawKelas = data as KelasOption[]
          const filteredKelas = rawKelas.filter((k) => {
            const kj = (k.jenjang || '').toUpperCase()
            return jenjang === 'SMK' ? kj === 'SMK' : kj !== 'SMK'
          })
          setDaftarKelas(sortKelas(filteredKelas))
        }
      } catch (err) {
        console.error('Error fetching kelas:', err)
      } finally {
        setLoadingKelas(false)
      }
    }
    fetchKelasFromDB()
  }, [jenjang])

  // RESET & SINKRONISASI SAAT SWITCHER JENJANG (SMP ↔ SMK) DIKLIK
  // Memastikan: saat jenjang aktif berubah (switcher diklik), kelas terpilih
  // di-reset ke kosong, daftar siswa/kartu dibersihkan, dan prefix nomor peserta
  // otomatis menyesuaikan jenjang aktif (262707 SMP / 262710 SMK).
  const prevJenjangRef = useRef(jenjang)
  useEffect(() => {
    if (prevJenjangRef.current === jenjang) return
    prevJenjangRef.current = jenjang
    setSelectedKelasId('')
    setSelectedKelasNama('')
    setSearchQuery('')
    setCardItems([])
    setPrefixNoUjian((tahunAjaranPrefix || getTahunAjaranPrefix()) + (jenjang === 'SMK' ? '10' : '07'))
  }, [jenjang])

  // FETCH DATA KARTU DINAMIS (GURU/SISWA) DENGAN SAFE FALLBACK
  useEffect(() => {
    async function loadCardData() {
      setLoading(true)
      try {
        if (jenisKartu === 'guru') {
          // MEMANGGIL SEMUA KOLOM DARI TABEL GURU
          const { data, error } = await supabase
            .from('guru')
            .select('*')

          if (error) {
            console.error('Supabase Error Fetching Guru:', error)
          }

          if (data && data.length > 0) {
            // Filter guru sesuai jenjang halaman (SMP/SMK) via unit_mengajar
            const guruRows = data as GuruRowUntukKartu[]
            const filteredGuru = guruRows.filter((g: GuruRowUntukKartu) => {
              const unit = String(g.unit_mengajar || '').toUpperCase().trim()
              return isSmk ? unit.includes('SMK') : unit !== 'SMK'
            })
            const sumberGuru = filteredGuru.length > 0 ? filteredGuru : guruRows

            const mapped: ItemKartu[] = sumberGuru.map((g: GuruRowUntukKartu) => {
              const rawNuptk = g.NUPTK || g.nuptk || g.nip
              const cleanNuptk = rawNuptk && rawNuptk !== 'EMPTY' && rawNuptk !== 'NULL' ? String(rawNuptk) : '-'
              
              const namaGuru = g.nama_lengkap || g.nama_guru || g.nama || 'GURU'
              const isKepsek = (g.jabatan && String(g.jabatan).toLowerCase().includes('kepala sekolah')) || 
                               String(namaGuru).toLowerCase().includes('sulastri')

              return {
                id: g.id,
                nama: String(namaGuru),
                nomorId: cleanNuptk,
                subInfo: g.jabatan || g.mapel || 'Guru / Staf TU',
                isKepalaSekolah: isKepsek,
                tipe: 'guru'
              }
            })
            setCardItems(mapped)
          } else {
            setCardItems([])
          }
        } else {
          if (!selectedKelasId) {
            setCardItems([])
            setLoading(false)
            return
          }

          if (!selectedKelasId) {
            setCardItems([])
            setLoading(false)
            return
          }

          // Tentukan tingkat (7–12) dari kelas terpilih
          const targetKelas = daftarKelas.find((k) => k.id === Number(selectedKelasId))
          const tingkatWeight = targetKelas
            ? getKelasGradeWeight(targetKelas.nama_kelas, targetKelas.tingkat)
            : 99
          if (tingkatWeight < 7 || tingkatWeight > 12) {
            setCardItems([])
            setLoading(false)
            return
          }

          // 1) Ambil SEMUA kelas pada jenjang aktif yang tingkatnya sama (lintas rombel)
          const { data: kelasLintas, error: errKelas } = await supabase
            .from('kelas')
            .select('id, nama_kelas, tingkat')
            .eq('jenjang', jenjang)

          if (errKelas || !kelasLintas) {
            setCardItems([])
            setLoading(false)
            return
          }

          const kelasSamaTingkat = (kelasLintas as KelasOption[]).filter(
            (k) => getKelasGradeWeight(k.nama_kelas, k.tingkat) === tingkatWeight
          )
          const kelasIds = kelasSamaTingkat.map((k) => k.id)

          // 2) Ambil semua siswa pada seluruh kelas di tingkat tersebut
          const { data, error } = await supabase
            .from('siswa')
            .select('*')
            .in('kelas_id', kelasIds)
            .eq('jenjang', jenjang)

          if (!error && data && data.length > 0) {
            // Filter definitif: hanya tampilkan siswa sesuai jenjang aktif
            const hanyaSiswaJenjang = (data as SiswaRowUntukKartu[]).filter(
              (s: SiswaRowUntukKartu) => {
                const sj = (s.jenjang || '').toUpperCase()
                return jenjang === 'SMK' ? sj === 'SMK' : sj !== 'SMK'
              }
            )

            // 3) Urutkan kelas dulu (abjad pada tingkat sama), lalu abjad nama siswa
            const kelasTerurut = [...kelasSamaTingkat].sort((a, b) =>
              compareKelasName(a.nama_kelas, b.nama_kelas)
            )
            const urutanKelas = new Map<number, number>()
            kelasTerurut.forEach((k, i) => urutanKelas.set(Number(k.id), i))

            const siswaTerurut = [...hanyaSiswaJenjang].sort((a, b) => {
              const idxA = urutanKelas.get(Number(a.kelas_id)) ?? 999
              const idxB = urutanKelas.get(Number(b.kelas_id)) ?? 999
              if (idxA !== idxB) return idxA - idxB
              return (a.nama_lengkap || '').localeCompare(b.nama_lengkap || '', 'id')
            })

            // 4) Nomor urut GLOBAL 3 digit (berlanjut antar rombel)
            const siswaBernomor = siswaTerurut.map((s, idx) => ({
              s,
              noUrut: String(idx + 1).padStart(3, '0'),
            }))

            // 5) Tampilkan hanya siswa pada kelas terpilih (nomor tetap global)
            const cleanKelas = selectedKelasNama.replace(/^kelas\s+/i, '')
            const mapped: ItemKartu[] = siswaBernomor
              .filter(({ s }) => Number(s.kelas_id) === Number(selectedKelasId))
              .map(({ s, noUrut }) => ({
                id: s.id,
                nama: s.nama_lengkap || s.nama || 'SISWA',
                nomorId: s.nisn || '-',
                subInfo: cleanKelas,
                nomorUjian: jenisKartu === 'ujian'
                  ? buildNomorPeserta(prefixNoUjian, noUrut)
                  : undefined,
                customField: jenisKartu === 'ujian' ? 'Ruang 01 / Sesi 1' : undefined,
                tipe: 'siswa',
              }))
            setCardItems(mapped)
          } else {
            setCardItems([])
          }
        }
      } catch (err) {
        console.error('Error fetching card data:', err)
      } finally {
        setLoading(false)
      }
    }

    loadCardData()
  }, [jenisKartu, selectedKelasId, selectedKelasNama, prefixNoUjian, isSmk, jenjang])

  const handleKelasChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value
    if (!val) {
      setSelectedKelasId('')
      setSelectedKelasNama('')
      return
    }
    const classId = Number(val)
    setSelectedKelasId(classId)
    const foundKelas = daftarKelas.find((k) => k.id === classId)
    if (foundKelas) {
      setSelectedKelasNama(foundKelas.nama_kelas)
      // NIS::Generate Otomatis 6 Digit Prefix (TahunAjaran + KodeTingkat)
      setPrefixNoUjian(
        (tahunAjaranPrefix || getTahunAjaranPrefix()) +
          getTingkatCode(foundKelas.nama_kelas, foundKelas.tingkat, isSmk ? 10 : 7)
      )
    }
  }

  // HANDLER EDIT & TAMBAH KARTU
  const handleSaveEdit = (updatedItem: ItemKartu) => {
    setCardItems((prev) =>
      prev.map((item) => (item.id === updatedItem.id ? updatedItem : item))
    )
    setEditingItem(null)
  }

  const handleAddCustomCard = () => {
    const newId = `custom-${Date.now()}`
    const noUrut = String(cardItems.length + 1).padStart(3, '0')
    const newItem: ItemKartu = {
      id: newId,
      nama: 'NAMA PESERTA BARU',
      nomorId: '1234567890',
      subInfo: selectedKelasNama ? selectedKelasNama.replace(/^kelas\s+/i, '') : 'VII-A',
      nomorUjian: jenisKartu === 'ujian' ? buildNomorPeserta(prefixNoUjian, noUrut) : undefined,
      customField: jenisKartu === 'ujian' ? 'Ruang 01 / Sesi 1' : undefined,
      tipe: jenisKartu === 'guru' ? 'guru' : 'siswa'
    }
    setCardItems((prev) => [newItem, ...prev])
    setEditingItem(newItem)
  }

  const filteredItems = cardItems.filter(
    (item) =>
      item.nama.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.nomorId.includes(searchQuery) ||
      (item.nomorUjian && item.nomorUjian.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  // EXPORT WORD (.DOC)
  const handleExportWord = (targetList: ItemKartu[] = filteredItems) => {
    if (targetList.length === 0) return

    const cardsHtml = targetList.map((item, index) => {
      const noUrut = String(index + 1).padStart(3, '0')
      const noUjianFinal = item.nomorUjian || buildNomorPeserta(prefixNoUjian, noUrut)

      return `
        <td style="width: 8.5cm; height: 5.4cm; border: 1.5pt solid ${jenisKartu === 'guru' ? '#1e3a8a' : '#065f46'}; padding: 4pt; vertical-align: top; background: #ffffff;">
          <table style="width: 100%; border-collapse: collapse; font-family: Arial, sans-serif;">
            <tr style="border-bottom: 1pt solid ${jenisKartu === 'guru' ? '#1e3a8a' : '#065f46'};">
              <td style="padding-bottom: 2pt;">
                <b style="font-size: 8.5pt; color: ${jenisKartu === 'guru' ? '#1e3a8a' : '#065f46'};">${sekolahNama}</b><br/>
                <span style="font-size: 6pt; color: ${jenisKartu === 'guru' ? '#2563eb' : '#047857'}; font-weight: bold;">
                  ${jenisKartu === 'guru' ? 'KTA PTK / PEGAWAI' : jenisKartu === 'ujian' ? namaUjian.toUpperCase() : 'KARTU TANDA PELAJAR'}
                </span>
              </td>
            </tr>
            <tr>
              <td style="padding-top: 4pt;">
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    ${jenisKartu !== 'ujian' ? `
                    <td style="width: 1.8cm; height: 2.3cm; border: 1pt solid #94a3b8; text-align: center; font-size: 6pt; color: #64748b; background: #f1f5f9; font-weight: bold;">
                      FOTO
                    </td>
                    ` : ''}
                    <td style="${jenisKartu === 'ujian' ? '' : 'padding-left: 5pt; '}vertical-align: top; font-size: 6.5pt; color: #0f172a;">
                      <span style="font-size: 5pt; color: #64748b; font-weight: bold;">NAMA:</span><br/>
                      <b style="font-size: 7.5pt;">${item.nama}</b><br/>
                      <table style="width: 100%; margin-top: 2pt; font-size: 6.5pt;">
                        ${jenisKartu !== 'ujian' ? `<tr><td style="width: 1.4cm; color: #475569; font-weight: bold;">${jenisKartu === 'guru' ? 'NUPTK' : 'NISN'}</td><td>: <b>${item.nomorId}</b></td></tr>` : ''}
                        <tr><td style="color: #475569; font-weight: bold;">${jenisKartu === 'guru' ? 'JABATAN' : 'KELAS'}</td><td>: <b>${item.subInfo}</b></td></tr>
                        ${jenisKartu === 'ujian' ? `<tr><td style="color: #047857; font-weight: bold;">NIS</td><td>: <b style="color: #047857;">${noUjianFinal}</b></td></tr>` : ''}
                        ${jenisKartu === 'ujian' && item.customField ? `<tr><td style="color: #475569; font-weight: bold;">RUANG/SESI</td><td>: <b>${item.customField}</b></td></tr>` : ''}
                      </table>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            ${
              jenisKartu === 'ujian'
                ? `
                <tr style="border-top: 1pt dashed #a7f3d0;">
                  <td style="padding-top: 3pt;">
                    <table style="width: 100%;">
                      <tr>
                        <td style="text-align: right; vertical-align: bottom; font-size: 4.5pt; color: #0f172a;">
                          Kepala Sekolah,<br/><br/>
                          <b><u>${kepsekFor(item).nama}</u></b><br/>
                          NUPTK. ${kepsekFor(item).nuptk}
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              `
                : ''
            }
          </table>
        </td>
      `
    })

    let tableRowsHtml = ''
    for (let i = 0; i < cardsHtml.length; i += 2) {
      tableRowsHtml += `<tr>${cardsHtml[i]}${cardsHtml[i + 1] || '<td style="width: 8.5cm;"></td>'}</tr>`
    }

    const fileContent = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
        <head>
          <meta charset='utf-8'>
          <title>Kartu ${sekolahNama}</title>
          <style>
            @page { size: A4 portrait; margin: 1cm; }
            table { border-collapse: separate; border-spacing: 0.4cm 0.4cm; }
          </style>
        </head>
        <body>
          <table>
            ${tableRowsHtml}
          </table>
        </body>
      </html>
    `

    const blob = new Blob(['\ufeff', fileContent], { type: 'application/msword' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `Kartu_${jenisKartu}_${new Date().toISOString().slice(0, 10)}.doc`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  // PRINT GENERATOR (PDF PRINT)
  const handlePrint = (targetList: ItemKartu[] = filteredItems) => {
    if (targetList.length === 0) return

    const printWindow = window.open('', '_blank')
    if (!printWindow) return

    const cardsHtml = targetList.map((item, index) => {
      const noUrut = String(index + 1).padStart(3, '0')
      const noUjianFinal = item.nomorUjian || buildNomorPeserta(prefixNoUjian, noUrut)

      // SISI DEPAN
      let frontCardHtml = ''
      if (jenisKartu === 'ujian') {
        frontCardHtml = `
          <div class="card card-ujian">
            <div class="card-header">
              <img src="/logo-smp.jpg" alt="Logo" class="school-logo" />
              <div class="header-text">
                <h2>${sekolahNama}</h2>
                <p>${namaUjian.toUpperCase()}</p>
              </div>
            </div>
            <div class="card-body">
              <div class="details">
                <p class="label">NAMA PESERTA</p>
                <p class="value-name">${item.nama}</p>
                <div class="info-container">
                  <div class="info-row"><span class="info-label">KELAS</span><span class="info-val">: ${item.subInfo}</span></div>
                  <div class="info-row info-highlight"><span class="info-label">NIS</span><span class="info-val">: ${noUjianFinal}</span></div>
                  ${item.customField ? `<div class="info-row"><span class="info-label">RUANG/SESI</span><span class="info-val">: ${item.customField}</span></div>` : ''}
                </div>
              </div>
            </div>
            
            <div class="card-footer footer-ujian">
              <div class="footer-right" style="width: 100%;">
                <p class="sign-title">Kepala Sekolah,</p>
                <div class="signature-area">
                  ${includeStamp ? `<img src="/stempel-sekolah.png" alt="Stempel" class="stamp-img-ujian" />` : ''}
                  ${includeDigitalSignature ? `<img src="${kepsekSignatureSrc}" alt="TTD" class="signature-img-ujian" />` : ''}
                </div>
                <p class="sign-name"><b><u>${kepsekFor(item).nama}</u></b></p>
                <p class="sign-nip">NUPTK. ${kepsekFor(item).nuptk}</p>
              </div>
            </div>
          </div>
        `
      } else if (jenisKartu === 'guru') {
        frontCardHtml = `
          <div class="card card-guru">
            <div class="card-header">
              <img src="/logo-smp.jpg" alt="Logo" class="school-logo" />
              <div class="header-text">
                <h2>${sekolahNama}</h2>
                <p>KARTU TANDA ANGGOTA (KTA) PTK</p>
              </div>
            </div>
            <div class="card-body">
              <div class="photo">FOTO</div>
              <div class="details">
                <p class="label">NAMA GURU / PEGAWAI</p>
                <p class="value-name">${item.nama}</p>
                <div class="info-container">
                  <div class="info-row"><span class="info-label">NUPTK</span><span class="info-val">: ${item.nomorId}</span></div>
                  <div class="info-row"><span class="info-label">JABATAN</span><span class="info-val">: ${item.subInfo}</span></div>
                </div>
              </div>
            </div>
            <div class="card-footer">
              <div class="footer-info">
                <p class="qr-title">ID Presensi Guru</p>
                <p class="qr-sub">Sistem Otomatis KBM</p>
              </div>
              <img src="https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${item.nomorId !== '-' ? item.nomorId : item.id}" alt="QR" class="qr-code" />
            </div>
          </div>
        `
      } else {
        frontCardHtml = `
          <div class="card">
            <div class="card-header">
              <img src="/logo-smp.jpg" alt="Logo" class="school-logo" />
              <div class="header-text">
                <h2>${sekolahNama}</h2>
                <p>KARTU TANDA PELAJAR</p>
              </div>
            </div>
            <div class="card-body">
              <div class="photo">FOTO</div>
              <div class="details">
                <p class="label">NAMA SISWA</p>
                <p class="value-name">${item.nama}</p>
                <div class="info-container">
                  <div class="info-row"><span class="info-label">NISN</span><span class="info-val">: ${item.nomorId}</span></div>
                  <div class="info-row"><span class="info-label">KELAS</span><span class="info-val">: ${item.subInfo}</span></div>
                </div>
              </div>
            </div>
            <div class="card-footer">
              <div class="footer-info">
                <p class="qr-title">QR Presensi Akademik</p>
                <p class="qr-sub">${sekolahNamaIndo}</p>
              </div>
              <img src="https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${item.nomorId}" alt="QR" class="qr-code" />
            </div>
          </div>
        `
      }

      // SISI BELAKANG (HANYA UNTUK KARTU PELAJAR & GURU)
      let backCardHtml = ''
      if (includeBackSide && jenisKartu !== 'ujian') {
        const penandatanganJabatan = item.isKepalaSekolah 
          ? 'Ketua Yayasan PPTQ Muna Mustofa' 
          : kepsekJabatanLabel(item)
        
        const penandatanganNama = item.isKepalaSekolah 
          ? 'PENGURUS YAYASAN' 
          : kepsekFor(item).nama

        const penandatanganNip = item.isKepalaSekolah 
          ? 'Yayasan Muna Mustofa Lampung' 
          : `NUPTK. ${kepsekFor(item).nuptk}`

        const rulesContent = jenisKartu === 'guru' ? `
          <ol class="rules-list">
            <li>Kartu Tanda Anggota (KTA) ini merupakan bukti identitas resmi PTK ${sekolahNamaIndo}.</li>
            <li>Wajib dikenakan/dibawa selama menjalankan tugas kedinasan dan presensi harian.</li>
            <li>Jika kartu ini hilang, harap melapor ke bagian Tata Usaha (TU).</li>
          </ol>
        ` : `
          <ol class="rules-list">
            <li>Kartu ini berlaku selama yang bersangkutan terdaftar sebagai siswa aktif ${sekolahNamaIndo}.</li>
            <li>Wajib dibawa selama berada di lingkungan sekolah dan saat mengikuti presensi KBM.</li>
            <li>Apabila menemukan kartu ini, harap mengembalikan ke Tata Usaha ${sekolahNamaIndo}.</li>
          </ol>
        `

        backCardHtml = `
          <div class="card card-back ${jenisKartu === 'guru' ? 'card-guru' : ''}">
            <div class="back-header">
              <h3>KETENTUAN PENGGUNAAN</h3>
            </div>
            <div class="back-body">
              ${rulesContent}
            </div>
            <div class="back-footer">
              <p class="sign-date">Gisting, ${new Date().toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}</p>
              <p class="sign-title">${penandatanganJabatan},</p>
              
              <div class="signature-area">
                ${includeStamp ? `<img src="/stempel-sekolah.png" alt="Stempel" class="stamp-img" />` : ''}
                ${includeDigitalSignature ? `<img src="${kepsekSignatureSrc}" alt="TTD" class="signature-img" />` : ''}
              </div>

              <p class="sign-name"><b><u>${penandatanganNama}</u></b></p>
              <p class="sign-nip">${penandatanganNip}</p>
            </div>
          </div>
        `
      }

      return frontCardHtml + backCardHtml
    }).join('')

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Cetak Kartu - ${sekolahNamaIndo}</title>
          <style>
            @page { size: A4 portrait; margin: 10mm 12mm; }
            * { box-sizing: border-box; }
            body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 0; background: #ffffff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .grid { display: grid; grid-template-columns: repeat(2, 85mm); gap: 8mm 10mm; justify-content: center; }
            .card { width: 85mm; height: 54mm; border: 1.5px solid #065f46; border-radius: 6mm; padding: 2.5mm 3.5mm; background: #ffffff; page-break-inside: avoid; break-inside: avoid; display: flex; flex-direction: column; justify-content: space-between; overflow: hidden; position: relative; }
            .card-guru { border-color: #1e3a8a; }
            .card-guru .header-text h2 { color: #1e3a8a; }
            .card-guru .header-text p { color: #2563eb; }
            .card-header { display: flex; align-items: center; gap: 2.5mm; border-bottom: 1px solid #065f46; padding-bottom: 1.5mm; }
            .card-guru .card-header { border-bottom-color: #1e3a8a; }
            .school-logo { width: 7mm; height: 7mm; object-fit: contain; flex-shrink: 0; }
            .header-text { flex: 1; }
            .header-text h2 { margin: 0; font-size: 8.5pt; font-weight: 800; color: #065f46; line-height: 1; }
            .header-text p { margin: 0.8mm 0 0 0; font-size: 6pt; color: #047857; font-weight: 700; letter-spacing: 0.5px; }
            
            .card-body { display: flex; gap: 3mm; align-items: center; margin-top: 1mm; flex: 1; overflow: hidden; }
            .photo { width: 18mm; height: 23mm; background: #f1f5f9; border: 1px solid #94a3b8; border-radius: 2mm; display: flex; align-items: center; justify-content: center; font-size: 6.5pt; color: #64748b; font-weight: bold; flex-shrink: 0; }
            .details { display: flex; flex-direction: column; justify-content: center; font-size: 7.5pt; color: #0f172a; flex: 1; overflow: hidden; }
            .details .label { margin: 0; font-size: 5pt; color: #64748b; font-weight: 700; text-transform: uppercase; }
            .details .value-name { margin: 0.5mm 0 1mm 0; font-size: 8pt; font-weight: 800; color: #0f172a; line-height: 1.1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
            
            .info-container { display: flex; flex-direction: column; gap: 0.5mm; margin-top: 0.5mm; }
            .info-row { display: flex; align-items: center; font-size: 6.5pt; line-height: 1.1; }
            .info-label { width: 18mm; font-weight: 700; color: #475569; flex-shrink: 0; }
            .info-val { font-weight: 800; color: #0f172a; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
            .info-highlight .info-val { color: #047857; font-weight: 900; }

            .card-footer { border-top: 1px dashed #a7f3d0; padding-top: 1mm; display: flex; align-items: center; justify-content: space-between; }
            .card-guru .card-footer { border-top-color: #bfdbfe; }
            .footer-info { font-size: 6.5pt; }
            .qr-title { margin: 0; font-weight: 800; color: #065f46; font-size: 6pt; }
            .card-guru .qr-title { color: #1e3a8a; }
            .qr-sub { margin: 0; font-size: 4.5pt; color: #64748b; }
            .qr-code { width: 9mm; height: 9mm; flex-shrink: 0; }

            /* LAYOUT KHUSUS FOOTER KARTU UJIAN 1 SISI */
            .footer-ujian { align-items: flex-end; padding-top: 1mm; }
            .footer-left { display: flex; align-items: center; gap: 1.5mm; }
            .qr-text { display: flex; flex-direction: column; }
            .footer-right { text-align: right; font-size: 5pt; line-height: 1.1; }
            .footer-right .sign-title { margin: 0; font-weight: 700; color: #0f172a; font-size: 5pt; }
            .footer-right .signature-area { height: 6.5mm; position: relative; display: flex; align-items: center; justify-content: flex-end; }
            .footer-right .signature-img-ujian { height: 100%; object-fit: contain; z-index: 2; position: relative; }
            .footer-right .stamp-img-ujian { height: 8.5mm; position: absolute; right: 4mm; top: -1mm; z-index: 1; opacity: 0.85; }
            .footer-right .sign-name { margin: 0; font-size: 5.5pt; color: #0f172a; }
            .footer-right .sign-nip { margin: 0; font-size: 4.5pt; color: #475569; }

            /* SISI BELAKANG */
            .card-back { background: #fafafa; }
            .back-header { border-bottom: 1px solid #065f46; text-align: center; padding-bottom: 1mm; }
            .card-guru .back-header { border-bottom-color: #1e3a8a; }
            .back-header h3 { margin: 0; font-size: 7.5pt; font-weight: 800; color: #065f46; }
            .card-guru .back-header h3 { color: #1e3a8a; }
            .back-body { flex: 1; padding: 1mm 0; }
            .rules-list { margin: 0; padding-left: 4mm; font-size: 5.5pt; color: #334155; line-height: 1.3; font-weight: 600; }
            .rules-list li { margin-bottom: 0.8mm; }
            .back-footer { text-align: right; border-top: 1px solid #e2e8f0; padding-top: 0.8mm; font-size: 6pt; position: relative; }
            .sign-date { margin: 0; font-size: 5pt; color: #64748b; }
            .sign-title { margin: 0; font-weight: 700; color: #0f172a; font-size: 5.5pt; }
            
            .signature-area { height: 9mm; position: relative; display: flex; align-items: center; justify-content: flex-end; }
            .signature-img { height: 100%; object-fit: contain; z-index: 2; position: relative; }
            .stamp-img { height: 12mm; position: absolute; right: 12mm; top: -2mm; z-index: 1; opacity: 0.85; }

            .sign-name { margin: 0; font-size: 6pt; color: #0f172a; }
            .sign-nip { margin: 0; font-size: 5pt; color: #475569; }
          </style>
        <style>
          @page { margin: 0; }
          body { padding: 10mm 12mm !important; }
        </style>
        </head>
        <body>
          <div class="grid">${cardsHtml}</div>
        </body>
      </html>
    `)

    printWindow.document.close()
    printWindow.focus()
    printWindow.onload = () => {
      printWindow.print()
      printWindow.close()
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: -60 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className={`min-h-screen font-sans flex flex-col justify-between selection:bg-indigo-500 selection:text-white pb-32 relative overflow-x-hidden transition-colors duration-300 ${
        isDarkMode ? 'bg-slate-950 text-slate-100' : 'bg-[#E2E8F0] text-slate-800'
      }`}
    >
      <div className={`fixed inset-0 pointer-events-none z-0 flex items-center justify-center select-none transition-opacity duration-300 ${
        isDarkMode ? 'opacity-[0.05]' : 'opacity-[0.15]'
      }`}>
        <img src="/logo-smp.jpg" alt={`Watermark ${sekolahNamaIndo}`} className="w-[850px] h-[850px] object-contain max-w-none" />
      </div>

      <div className="relative z-10">
        <header className={`border-b px-3 sm:px-6 py-2.5 flex items-center justify-between sticky top-0 z-50 shadow-xs gap-2 transition-colors duration-300 ${
          isDarkMode ? 'bg-slate-900/90 border-slate-800 backdrop-blur-md' : 'bg-slate-100/90 border-slate-300 backdrop-blur-md'
        }`}>
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <Link href={isSmk ? '/smk' : '/'} className={`p-1 rounded-lg transition ${isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'}`} title="Kembali ke Dashboard">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </Link>
            <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-xl overflow-hidden flex items-center justify-center border p-0.5 shadow-xs shrink-0 ${
              isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-300'
            }`}>
              <img src="/logo-smp.jpg" alt={`Logo ${sekolahNamaIndo}`} className="w-full h-full object-contain" />
            </div>
            <div>
              <h1 className={`font-bold text-xs sm:text-base leading-none ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Aplikasi Guru AI</h1>
              <p className={`text-[10px] sm:text-[11px] font-bold mt-0.5 sm:mt-1 ${isDarkMode ? 'text-emerald-400' : 'text-emerald-800'}`}>Pusat Cetak Kartu Sekolah</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-3">
            <DarkModeToggle />
            <Link
              href={isSmk ? '/kartu' : '/smk/kartu'}
              className={`border text-[10px] sm:text-xs font-extrabold px-2 sm:px-3 py-1 sm:py-1.5 rounded-xl transition flex items-center gap-1 shadow-xs cursor-pointer ${
                isDarkMode
                  ? 'bg-indigo-600/30 border-indigo-500/50 text-indigo-200 hover:bg-indigo-600/50'
                  : 'bg-indigo-600 text-white border-indigo-700 hover:bg-indigo-500'
              }`}
              title={isSmk ? 'Buka Portal Cetak Kartu SMP' : 'Buka Portal Cetak Kartu SMK'}
            >
              {isSmk ? 'SMP' : 'SMK'} <span className="hidden sm:inline">Muna Mustofa</span>
            </Link>
            <div className={`border text-xs font-bold px-2 sm:px-3.5 py-1 sm:py-1.5 rounded-xl flex items-center gap-1.5 shadow-xs ${
              isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-100' : 'bg-white border-slate-300 text-slate-800'
            }`}>
              <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px] font-bold shrink-0">
                {userDisplayName.charAt(0)}
              </span>
              <span className="max-w-[70px] sm:max-w-none truncate">{userDisplayName}</span>
            </div>

            <button
              onClick={async () => {
                await supabase.auth.signOut()
                router.replace('/login')
              }}
              className={`border p-1.5 sm:p-2 rounded-xl transition cursor-pointer shrink-0 ${
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

        <main className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6">
          <div className={`backdrop-blur-md border rounded-3xl p-6 min-h-[480px] space-y-6 shadow-xs flex flex-col justify-between ${
            isDarkMode 
              ? 'bg-slate-900/90 border-slate-800' 
              : 'bg-slate-100/90 border-slate-300'
          }`}>
            
            {/* ACTION & FILTER ROW */}
            <div className={`space-y-4 border-b pb-5 ${isDarkMode ? 'border-slate-800' : 'border-slate-300'}`}>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-emerald-800 text-white rounded-2xl flex items-center justify-center text-lg shadow-xs">
                    <CreditCard className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Pusat Cetak Kartu Digital</h2>
                    <p className={`text-xs font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                      Pilih jenis kartu resmi, edit data bila perlu, lalu cetak atau ekspor ke Word.
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={jenisKartu}
                    onChange={(e) => {
                      const val = e.target.value as JenisKartu
                      setJenisKartu(val)
                      setSearchQuery('')
                      if (val === 'guru') {
                        setSelectedKelasId('')
                        setSelectedKelasNama('')
                      }
                    }}
                    className="bg-indigo-600 text-white font-extrabold border border-indigo-700 rounded-xl px-3.5 py-2 text-xs focus:outline-none cursor-pointer shadow-xs"
                  >
                    <option value="pelajar">Kartu Tanda Pelajar</option>
                    <option value="ujian">Kartu Peserta Ujian</option>
                    <option value="guru">Kartu Pegawai / Guru</option>
                  </select>

                  {jenisKartu === 'ujian' && (
                    <>
                      <select
                        value={namaUjian}
                        onChange={(e) => setNamaUjian(e.target.value)}
                        className={`border rounded-xl px-3 py-2 text-xs font-bold focus:outline-none cursor-pointer ${
                          isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                        }`}
                      >
                        <option value="ASESMEN SUMATIF TENGAH SEMESTER (STS)">STS (Tengah Semester)</option>
                        <option value="ASESMEN SUMATIF AKHIR SEMESTER (SAS)">SAS (Akhir Semester)</option>
                        <option value="ASESMEN SUMATIF AKHIR TAHUN (SAT)">SAT (Akhir Tahun)</option>
                        <option value={`UJIAN CCT / US ${sekolahNama}`}>Ujian Sekolah / CCT</option>
                      </select>

                      <input
                        type="text"
                        value={prefixNoUjian}
                        onChange={(e) => setPrefixNoUjian(e.target.value)}
                        placeholder="Prefix No. (ex: 262707)"
                        className={`border rounded-xl px-3 py-2 text-xs font-bold focus:outline-none w-32 ${
                          isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                        }`}
                        title="Prefix Nomor Peserta Ujian"
                      />
                    </>
                  )}

                  {jenisKartu !== 'guru' && (
                    <select
                      value={selectedKelasId}
                      onChange={handleKelasChange}
                      disabled={loadingKelas}
                      className={`border rounded-xl px-3.5 py-2 text-xs focus:outline-none cursor-pointer font-bold shadow-xs disabled:opacity-50 ${
                        isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                      }`}
                    >
                      <option value="">{loadingKelas ? 'Memuat Kelas...' : 'Pilih Kelas'}</option>
                      {daftarKelas.map((kls) => (
                        <option key={kls.id} value={kls.id}>{kls.nama_kelas}</option>
                      ))}
                    </select>
                  )}

                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Cari..."
                    className={`border rounded-xl px-3 py-2 text-xs font-bold focus:outline-none focus:border-emerald-600 w-28 ${
                      isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                    }`}
                  />

                  <button
                    onClick={handleAddCustomCard}
                    className="bg-amber-600 hover:bg-amber-500 text-white font-extrabold px-3 py-2 rounded-xl text-xs transition shadow-xs flex items-center gap-1 cursor-pointer"
                    title="Tambah Kartu Susulan Manual"
                  >
                    <Plus className="w-4 h-4" /> Kartu
                  </button>

                  <button
                    onClick={() => handleExportWord(filteredItems)}
                    disabled={filteredItems.length === 0}
                    className="bg-blue-700 hover:bg-blue-600 disabled:bg-slate-300 disabled:text-slate-500 text-white font-extrabold px-3.5 py-2 rounded-xl text-xs transition shadow-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <FileText className="w-4 h-4" /> Word ({filteredItems.length})
                  </button>

                  <button
                    onClick={() => handlePrint(filteredItems)}
                    disabled={filteredItems.length === 0}
                    className="bg-emerald-800 hover:bg-emerald-700 disabled:bg-slate-300 disabled:text-slate-500 text-white font-extrabold px-4 py-2 rounded-xl text-xs transition shadow-xs flex items-center gap-2 cursor-pointer"
                  >
                    <Download className="w-4 h-4" /> Cetak ({filteredItems.length})
                  </button>
                </div>
              </div>

              {/* CHECKBOX OPSI LAYOUT CETAK */}
              <div className={`flex flex-wrap items-center gap-5 p-3 rounded-2xl border text-xs font-bold ${
                isDarkMode ? 'bg-slate-800/80 border-slate-700 text-slate-200' : 'bg-white/80 border-slate-300 text-slate-800'
              }`}>
                <span className={`text-[11px] uppercase tracking-wider font-extrabold ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Opsi Pengesahan Kartu:</span>
                
                {jenisKartu !== 'ujian' && (
                  <label className="flex items-center gap-2 cursor-pointer hover:text-indigo-400">
                    <input
                      type="checkbox"
                      checked={includeBackSide}
                      onChange={(e) => setIncludeBackSide(e.target.checked)}
                      className="w-4 h-4 text-emerald-700 rounded focus:ring-emerald-600 cursor-pointer"
                    />
                    <span>Sertakan Sisi Belakang</span>
                  </label>
                )}

                <label className="flex items-center gap-2 cursor-pointer hover:text-indigo-400">
                  <input
                    type="checkbox"
                    checked={includeDigitalSignature}
                    onChange={(e) => setIncludeDigitalSignature(e.target.checked)}
                    className="w-4 h-4 text-emerald-700 rounded focus:ring-emerald-600 cursor-pointer"
                  />
                  <span>TTD Digital Kepsek</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer hover:text-indigo-400">
                  <input
                    type="checkbox"
                    checked={includeStamp}
                    onChange={(e) => setIncludeStamp(e.target.checked)}
                    className="w-4 h-4 text-emerald-700 rounded focus:ring-emerald-600 cursor-pointer"
                  />
                  <span>Stempel Sekolah</span>
                </label>
              </div>
            </div>

            {/* PREVIEW CONTAINER GRID */}
            <div className="flex-1 flex flex-col items-center justify-center py-4">
              {jenisKartu !== 'guru' && !selectedKelasId && cardItems.length === 0 ? (
                <p className={`text-xs text-center font-medium ${isDarkMode ? 'text-slate-500' : 'text-slate-500'}`}>
                  Silakan pilih kelas di atas atau klik tombol <b>Kartu</b> untuk menambah manual.
                </p>
              ) : loading ? (
                <div className={`flex flex-col items-center gap-2 text-xs font-bold ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                  <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                  <p>Memuat data kartu...</p>
                </div>
              ) : filteredItems.length === 0 ? (
                <p className={`text-xs text-center font-medium ${isDarkMode ? 'text-slate-500' : 'text-slate-500'}`}>
                  Tidak ada data ditemukan. (Pastikan RLS tabel <b>guru</b> di Supabase sudah diizinkan untuk dibaca)
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 w-full">
                  {filteredItems.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => {
                        setSelectedModalItem(item)
                        setModalActiveTab('front')
                      }}
                      className={`border rounded-2xl p-4 space-y-3 shadow-xs hover:shadow-md transition cursor-pointer relative group ${
                        isDarkMode
                          ? jenisKartu === 'guru' 
                            ? 'bg-slate-800/90 border-slate-700 hover:border-blue-500' 
                            : 'bg-slate-800/90 border-slate-700 hover:border-emerald-500'
                          : jenisKartu === 'guru' 
                            ? 'bg-white border-slate-300 hover:border-blue-600' 
                            : 'bg-white border-slate-300 hover:border-emerald-500'
                      }`}
                    >
                      <div className={`flex items-center justify-between border-b pb-2 ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}`}>
                        <div className="flex items-center gap-2">
                          <img src="/logo-smp.jpg" alt="Logo" className="w-6 h-6 object-contain" />
                          <div>
                            <h3 className={`font-extrabold text-xs uppercase leading-none ${jenisKartu === 'guru' ? 'text-blue-400' : 'text-emerald-400'}`}>{sekolahNama}</h3>
                            <p className={`text-[9px] font-bold tracking-wider uppercase mt-0.5 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                              {jenisKartu === 'guru' ? 'KTA PTK / PEGAWAI' : jenisKartu === 'ujian' ? 'KARTU PESERTA UJIAN' : 'KARTU TANDA PELAJAR'}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setEditingItem(item)
                            }}
                            className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-500 text-white hover:bg-amber-600 transition"
                            title="Edit Kartu Ini"
                          >
                            <Pencil className="w-4 h-4" /> Edit
                          </button>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md transition ${
                            isDarkMode ? 'bg-slate-900 text-slate-300 group-hover:bg-indigo-600 group-hover:text-white' : 'bg-slate-100 text-slate-700 group-hover:bg-indigo-600 group-hover:text-white'
                          }`}>
                            <Search className="w-4 h-4" /> Detail
                          </span>
                        </div>
                      </div>

                      <div className="flex gap-3 items-center">
                        {jenisKartu !== 'ujian' && (
                          <div className={`w-14 h-20 border rounded-lg flex items-center justify-center text-[10px] font-bold shrink-0 overflow-hidden ${
                            isDarkMode ? 'bg-slate-900 border-slate-700 text-slate-500' : 'bg-slate-100 border-slate-300 text-slate-400'
                          }`}>
                            FOTO
                          </div>
                        )}
                        <div className="space-y-1 text-xs overflow-hidden flex-1">
                          <p className={`text-[10px] font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>NAMA:</p>
                          <p className={`font-bold text-xs leading-tight truncate ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{item.nama}</p>
                          
                          {jenisKartu !== 'ujian' && (
                            <p className={`text-[10px] pt-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                              {jenisKartu === 'guru' ? 'NUPTK: ' : 'NISN: '}
                              <span className={`font-mono font-bold ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>{item.nomorId}</span>
                            </p>
                          )}
                          <p className={`text-[10px] ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                            {jenisKartu === 'guru' ? 'JABATAN: ' : 'KELAS: '}
                            <span className={`font-bold ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>{item.subInfo}</span>
                          </p>

                          {jenisKartu === 'ujian' && (
                            <p className="text-[10px] text-emerald-400 font-bold">
                              NIS: <span className="font-mono">{item.nomorUjian || '-'}</span>
                            </p>
                          )}

                          {jenisKartu === 'ujian' && item.customField && (
                            <p className="text-[10px] text-indigo-400 font-bold">
                              RUANG/SESI: <span>{item.customField}</span>
                            </p>
                          )}
                        </div>
                      </div>

                      {/* FOOTER GRID CARD */}
                      {jenisKartu === 'ujian' ? (
                        <div className={`border-t pt-2 flex items-center justify-end text-[9px] ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}`}>
                          <div className="text-right w-full">
                            <p className="font-bold text-slate-300">Kepala Sekolah</p>
                            <p className="font-extrabold text-slate-100 underline leading-tight">{kepsekFor(item).nama}</p>
                            <p className="text-[8px] text-slate-400 font-mono">NUPTK. {kepsekFor(item).nuptk}</p>
                          </div>
                        </div>
                      ) : (
                        <div className={`border-t pt-2 flex items-center justify-between ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}`}>
                          <div className={`text-[10px] font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                            <p className={`font-bold ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>QR Code ID</p>
                            <p className="text-[9px]">Sistem Presensi</p>
                          </div>
                          <div className={`p-1 border rounded-lg ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                            <img
                              src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${item.nomorId !== '-' ? item.nomorId : item.id}`}
                              alt="QR Code"
                              className="w-9 h-9"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        </main>
      </div>

      {/* MODAL EDIT DATA KARTU */}
      <AnimatePresence>
        {editingItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className={`border rounded-3xl max-w-md w-full p-6 shadow-2xl relative space-y-4 ${
                isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-300 text-slate-900'
              }`}
            >
              <div className="flex justify-between items-center border-b pb-3 border-slate-700">
                <h3 className="font-extrabold text-sm"><Pencil className="w-4 h-4 inline-block align-middle" /> Edit Data Kartu</h3>
                <button
                  onClick={() => setEditingItem(null)}
                  className="text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="font-bold block mb-1">Nama Lengkap:</label>
                  <input
                    type="text"
                    value={editingItem.nama}
                    onChange={(e) => setEditingItem({ ...editingItem, nama: e.target.value })}
                    className={`w-full p-2.5 rounded-xl border font-bold ${
                      isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-300'
                    }`}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold block mb-1">{jenisKartu === 'guru' ? 'NUPTK:' : 'NISN:'}</label>
                    <input
                      type="text"
                      value={editingItem.nomorId}
                      onChange={(e) => setEditingItem({ ...editingItem, nomorId: e.target.value })}
                      className={`w-full p-2.5 rounded-xl border font-bold ${
                        isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-300'
                      }`}
                    />
                  </div>
                  <div>
                    <label className="font-bold block mb-1">{jenisKartu === 'guru' ? 'Jabatan:' : 'Kelas:'}</label>
                    <input
                      type="text"
                      value={editingItem.subInfo}
                      onChange={(e) => setEditingItem({ ...editingItem, subInfo: e.target.value })}
                      className={`w-full p-2.5 rounded-xl border font-bold ${
                        isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-300'
                      }`}
                    />
                  </div>
                </div>

                {jenisKartu === 'ujian' && (
                  <>
                    <div>
                      <label className="font-bold block mb-1 text-emerald-400">NIS:</label>
                      <input
                        type="text"
                        value={editingItem.nomorUjian || ''}
                        placeholder="Contoh: 262707001"
                        onChange={(e) => setEditingItem({ ...editingItem, nomorUjian: e.target.value })}
                        className={`w-full p-2.5 rounded-xl border font-bold ${
                          isDarkMode ? 'bg-slate-800 border-slate-700 text-emerald-400' : 'bg-slate-50 border-slate-300 text-emerald-700'
                        }`}
                      />
                    </div>

                    <div>
                      <label className="font-bold block mb-1 text-indigo-400">Ruang / Sesi:</label>
                      <input
                        type="text"
                        value={editingItem.customField || ''}
                        placeholder="Contoh: Ruang 02 / Sesi 1"
                        onChange={(e) => setEditingItem({ ...editingItem, customField: e.target.value })}
                        className={`w-full p-2.5 rounded-xl border font-bold ${
                          isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-300'
                        }`}
                      />
                    </div>
                  </>
                )}
              </div>

              <div className="flex gap-2 pt-3">
                <button
                  onClick={() => handleSaveEdit(editingItem)}
                  className="flex-1 bg-emerald-700 hover:bg-emerald-600 text-white font-extrabold py-2.5 rounded-xl text-xs transition cursor-pointer"
                >
                  <Save className="w-4 h-4" /> Simpan Perubahan
                </button>
                <button
                  onClick={() => setEditingItem(null)}
                  className="px-4 bg-slate-700 hover:bg-slate-600 text-white font-bold py-2.5 rounded-xl text-xs cursor-pointer"
                >
                  Batal
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* POPUP MODAL PRATINJAU DETAIL */}
      <AnimatePresence>
        {selectedModalItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className={`border rounded-3xl max-w-md w-full p-6 shadow-2xl relative space-y-4 ${
                isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-300 text-slate-900'
              }`}
            >
              <button
                onClick={() => setSelectedModalItem(null)}
                className={`absolute top-4 right-4 rounded-full p-1.5 transition cursor-pointer ${
                  isDarkMode ? 'text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700' : 'text-slate-400 hover:text-slate-700 bg-slate-100 hover:bg-slate-200'
                }`}
              >
                <X className="w-4 h-4" />
              </button>

              <div className={`flex items-center gap-3 border-b pb-3 ${isDarkMode ? 'border-slate-800' : 'border-slate-200'}`}>
                <div className={`w-10 h-10 rounded-xl overflow-hidden border p-0.5 shadow-xs ${
                  isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-300'
                }`}>
                  <img src="/logo-smp.jpg" alt="Logo" className="w-full h-full object-contain" />
                </div>
                <div>
                  <h3 className={`font-extrabold text-sm ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Pratinjau Kartu Resmi</h3>
                  <p className={`text-xs font-bold ${isDarkMode ? 'text-emerald-400' : 'text-emerald-800'}`}>{sekolahNamaIndo} Gisting</p>
                </div>
              </div>

              {/* TAB SWITCHER */}
              {jenisKartu !== 'ujian' && (
                <div className={`flex p-1 rounded-xl gap-1 text-xs font-extrabold ${isDarkMode ? 'bg-slate-800' : 'bg-slate-100'}`}>
                  <button
                    onClick={() => setModalActiveTab('front')}
                    className={`flex-1 py-1.5 rounded-lg transition cursor-pointer ${
                      modalActiveTab === 'front'
                        ? isDarkMode ? 'bg-slate-700 text-white shadow-xs' : 'bg-white text-indigo-900 shadow-xs'
                        : isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    <UserRound className="w-4 h-4" /> Sisi Depan
                  </button>
                  <button
                    onClick={() => setModalActiveTab('back')}
                    className={`flex-1 py-1.5 rounded-lg transition cursor-pointer ${
                      modalActiveTab === 'back'
                        ? isDarkMode ? 'bg-slate-700 text-white shadow-xs' : 'bg-white text-indigo-900 shadow-xs'
                        : isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    <History className="w-4 h-4" /> Sisi Belakang
                  </button>
                </div>
              )}

              {/* TAB SISI DEPAN */}
              {modalActiveTab === 'front' || jenisKartu === 'ujian' ? (
                <div className={`border-2 rounded-2xl p-4 space-y-4 shadow-xs ${
                  jenisKartu === 'guru' 
                    ? isDarkMode ? 'bg-blue-950/30 border-blue-800' : 'bg-blue-50 border-blue-700'
                    : isDarkMode ? 'bg-emerald-950/30 border-emerald-800' : 'bg-emerald-50 border-emerald-700'
                }`}>
                  <div className={`flex items-center justify-between border-b pb-2 ${isDarkMode ? 'border-slate-800' : 'border-slate-300'}`}>
                    <div className="flex items-center gap-2">
                      <img src="/logo-smp.jpg" alt="Logo" className="w-7 h-7 object-contain" />
                      <div>
                        <h4 className={`font-black text-xs uppercase leading-none ${isDarkMode ? 'text-white' : 'text-slate-950'}`}>{sekolahNama}</h4>
                        <p className={`text-[9px] font-bold tracking-wider uppercase mt-0.5 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                          {jenisKartu === 'guru' ? 'KTA PTK / PEGAWAI' : jenisKartu === 'ujian' ? namaUjian : 'KARTU TANDA PELAJAR'}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-4 items-center">
                    {jenisKartu !== 'ujian' && (
                      <div className={`w-20 h-24 border rounded-xl flex items-center justify-center text-xs font-bold shrink-0 overflow-hidden shadow-xs ${
                        isDarkMode ? 'bg-slate-900 border-slate-700 text-slate-500' : 'bg-white border-slate-300 text-slate-400'
                      }`}>
                        FOTO
                      </div>
                    )}
                    <div className="space-y-1 text-xs flex-1 overflow-hidden">
                      <div>
                        <p className={`text-[10px] font-bold uppercase ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Nama Lengkap:</p>
                        <p className={`font-black text-sm leading-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{selectedModalItem.nama}</p>
                      </div>
                      <div className="space-y-0.5 pt-1">
                        {jenisKartu !== 'ujian' && (
                          <p className={`text-[10px] ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                            <b>{jenisKartu === 'guru' ? 'NUPTK' : 'NISN'}:</b> {selectedModalItem.nomorId}
                          </p>
                        )}
                        <p className={`text-[10px] ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                          <b>{jenisKartu === 'guru' ? 'Jabatan' : 'Kelas'}:</b> {selectedModalItem.subInfo}
                        </p>
                        {jenisKartu === 'ujian' && (
                          <p className="text-[10px] text-emerald-400 font-extrabold">
                            <b>NIS:</b> {selectedModalItem.nomorUjian || '-'}
                          </p>
                        )}
                        {jenisKartu === 'ujian' && selectedModalItem.customField && (
                          <p className="text-[10px] text-indigo-400 font-bold">
                            <b>RUANG/SESI:</b> {selectedModalItem.customField}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* FOOTER PREVIEW MODAL */}
                  {jenisKartu === 'ujian' ? (
                    <div className={`border-t pt-2.5 flex items-center justify-end p-2 rounded-xl text-xs ${
                      isDarkMode ? 'bg-slate-900/80 border-slate-800' : 'bg-white/80 border-slate-300'
                    }`}>
                      <div className="text-right w-full">
                        <p className={`text-[10px] font-bold ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>Kepala Sekolah,</p>
                        <p className={`font-black text-xs underline ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{kepsekFor(selectedModalItem).nama}</p>
                        <p className={`text-[9px] font-mono ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>NUPTK. {kepsekFor(selectedModalItem).nuptk}</p>
                      </div>
                    </div>
                  ) : (
                    <div className={`border pt-2.5 flex items-center justify-between p-2 rounded-xl ${
                      isDarkMode ? 'bg-slate-900/80 border-slate-800' : 'bg-white/80 border-slate-300'
                    }`}>
                      <div>
                        <p className={`font-extrabold text-xs ${isDarkMode ? 'text-white' : 'text-slate-950'}`}>QR Code Identitas Resmi</p>
                        <p className={`text-[10px] ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>Terintegrasi dengan sistem presensi</p>
                      </div>
                      <img
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${selectedModalItem.nomorId !== '-' ? selectedModalItem.nomorId : selectedModalItem.id}`}
                        alt="QR Code"
                        className="w-12 h-12 bg-white p-1 rounded-lg border border-slate-300 shadow-xs"
                      />
                    </div>
                  )}
                </div>
              ) : (
                /* TAB SISI BELAKANG */
                <div className={`border-2 rounded-2xl p-4 space-y-3 shadow-xs text-xs ${
                  isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-400'
                }`}>
                  <div className={`border-b pb-1.5 text-center ${isDarkMode ? 'border-slate-800' : 'border-slate-300'}`}>
                    <h4 className={`font-extrabold text-xs uppercase ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>KETENTUAN PENGGUNAAN</h4>
                  </div>
                  
                  {jenisKartu === 'guru' ? (
                    <ol className={`list-decimal pl-4 space-y-1 text-[11px] font-medium ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                      <li>Kartu Tanda Anggota (KTA) ini merupakan bukti identitas resmi PTK.</li>
                      <li>Wajib dikenakan/dibawa selama menjalankan tugas kedinasan.</li>
                      <li>Jika kartu hilang, melapor ke Tata Usaha (TU) ${sekolahNamaIndo}.</li>
                    </ol>
                  ) : (
                    <ol className={`list-decimal pl-4 space-y-1 text-[11px] font-medium ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                      <li>Kartu ini berlaku selama terdaftar sebagai siswa aktif ${sekolahNamaIndo}.</li>
                      <li>Wajib dibawa selama berada di sekolah dan saat presensi KBM.</li>
                      <li>Jika menemukan kartu ini, harap mengembalikan ke Tata Usaha.</li>
                    </ol>
                  )}

                  <div className={`border-t pt-2 text-right space-y-1 relative ${isDarkMode ? 'border-slate-800' : 'border-slate-300'}`}>
                    <p className={`text-[10px] ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                      Gisting, {new Date().toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}
                    </p>
                    <p className={`font-bold text-xs ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                      {selectedModalItem.isKepalaSekolah ? 'Ketua Yayasan PPTQ Muna Mustofa,' : kepsekJabatanLabel(selectedModalItem)}
                    </p>

                    <div className="h-12 relative flex items-center justify-end my-1">
                      {includeStamp && (
                        <img src="/stempel-sekolah.png" alt="Stempel" className="h-14 absolute right-10 -top-1 opacity-80 pointer-events-none" />
                      )}
                      {includeDigitalSignature && (
                        <img src={kepsekSignatureSrc} alt="TTD" className="h-12 relative z-10 pointer-events-none" />
                      )}
                    </div>

                    <p className={`font-extrabold text-xs ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                      <u>{selectedModalItem.isKepalaSekolah ? 'PENGURUS YAYASAN' : kepsekFor(selectedModalItem).nama}</u>
                    </p>
                    <p className={`text-[10px] font-mono ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                      {selectedModalItem.isKepalaSekolah ? 'Yayasan Muna Mustofa' : `NUPTK. ${kepsekFor(selectedModalItem).nuptk}`}
                    </p>
                  </div>
                </div>
              )}

              {/* ACTION BUTTONS PRATINJAU */}
              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => {
                    handleExportWord([selectedModalItem])
                    setSelectedModalItem(null)
                  }}
                  className="flex-1 bg-blue-700 hover:bg-blue-600 text-white font-extrabold py-2.5 rounded-xl text-xs transition shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <FileText className="w-4 h-4" /> Export Word
                </button>
                <button
                  onClick={() => {
                    handlePrint([selectedModalItem])
                    setSelectedModalItem(null)
                  }}
                  className="flex-1 bg-emerald-800 hover:bg-emerald-700 text-white font-extrabold py-2.5 rounded-xl text-xs transition shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-4 h-4" /> Cetak Kartu Ini
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </motion.div>
  )
}
