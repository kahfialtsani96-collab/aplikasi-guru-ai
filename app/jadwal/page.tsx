'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { motion } from 'framer-motion'
import { useAuthRole } from '@/hooks/useAuthRole'
import { useDarkMode } from '@/hooks/useDarkMode'
import { canManageJadwal } from '@/lib/jadwalAccess'
import DarkModeToggle from '@/app/components/DarkModeToggle'
import { sortKelas } from '@/lib/utils'
import {
  Clock,
  ClipboardList,
  NotebookPen,
  HeartHandshake,
  Radio,
  History,
  Printer,
  Star,
  Hand,
  CalendarDays,
  School,
  Flame,
  CheckCircle2,
  BarChart3,
  Trash2,
  Users,
  GraduationCap,
  BookOpen,
  UserRound,
  Pencil,
  CopyPlus,
} from 'lucide-react'

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

interface MapelItem {
  id: number
  nama_mapel: string
  kode_mapel: string
  jenjang?: string | null
}

interface KelasItem {
  id: number
  nama_kelas: string
  jenjang?: string | null
}

interface GuruItem {
  id?: number
  nama_lengkap: string
  email: string
  unit_mengajar?: string | null
}

interface MasterJamItem {
  id: number
  hari: string
  jam_ke: number
  waktu_mulai: string
  waktu_selesai: string
  keterangan: string
}

interface Jadwal {
  id?: number
  hari: string
  jam: string
  jam_ke?: number | string
  kelas_id?: number
  mapel_id?: number
  guru_email?: string
  jenjang?: string | null
  semester?: string | null
  tahun_ajaran?: string | null
  kelas?: { nama_kelas: string; jenjang?: string | null } | string
  mapel?: { nama_mapel: string; kode_mapel: string; jenjang?: string | null } | string
}

// Hari aktif sekolah: Senin–Minggu (Libur Jumat)
const HARI_LIST = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Sabtu', 'Minggu']

const HARI_ORDER: Record<string, number> = {
  Senin: 1,
  Selasa: 2,
  Rabu: 3,
  Kamis: 4,
  Sabtu: 5,
  Minggu: 6,
}

const JS_DAY_TO_HARI: Record<number, string> = {
  0: 'Minggu',
  1: 'Senin',
  2: 'Selasa',
  3: 'Rabu',
  4: 'Kamis',
  5: 'Jumat',
  6: 'Sabtu',
}

// Periode Akademik (Tahun Ajaran & Semester)
const TAHUN_AJARAN_LIST = ['2026/2027', '2027/2028']
const SEMESTER_LIST = ['Ganjil', 'Genap'] as const
type SemesterType = (typeof SEMESTER_LIST)[number]

// Helper format tanggal lokal YYYY-MM-DD (dipanggil hanya di useEffect)
function getLocalTodayIso(): string {
  const now = new Date()
  const offsetMs = now.getTimezoneOffset() * 60 * 1000
  return new Date(now.getTime() - offsetMs).toISOString().split('T')[0]
}

// Helper hitung rentang jam mulai & selesai dari teks/angka jadwal
function parseJamRange(item: Jadwal): { start: number; end: number; jp: number } {
  let start = Number(item.jam_ke || 1)
  let end = start

  const jamStr = String(item.jam || '')
  if (jamStr) {
    const rangeMatch = jamStr.match(/Ke-\s*(\d+)(?:\s*s\/d\s*(\d+))?/i)
    if (rangeMatch) {
      start = Number(rangeMatch[1])
      const rawEnd = Number(rangeMatch[2])
      end = Number.isFinite(rawEnd) && rawEnd > start ? rawEnd : start
    }
  }

  return {
    start,
    end,
    jp: Math.max(1, end - start + 1),
  }
}

// Warna identitas berdasarkan tingkat kelas SMP (VII, VIII, IX)
function getKelasAccent(namaKelas: string, isDarkMode: boolean) {
  const upper = (namaKelas || '').toUpperCase()
  if (upper.startsWith('IX') || upper.startsWith('9')) {
    return {
      borderLeft: 'border-l-4 border-l-emerald-500',
      badge: isDarkMode
        ? 'bg-emerald-950/90 text-emerald-300 border-emerald-700/70'
        : 'bg-emerald-100 text-emerald-800 border-emerald-300',
    }
  }
  if (upper.startsWith('VIII') || upper.startsWith('8')) {
    return {
      borderLeft: 'border-l-4 border-l-purple-500',
      badge: isDarkMode
        ? 'bg-purple-950/90 text-purple-300 border-purple-700/70'
        : 'bg-purple-100 text-purple-800 border-purple-300',
    }
  }
  return {
    borderLeft: 'border-l-4 border-l-sky-500',
    badge: isDarkMode
      ? 'bg-sky-950/90 text-sky-300 border-sky-700/70'
      : 'bg-sky-100 text-sky-800 border-sky-300',
  }
}

export default function JadwalMengajarPage() {
  const router = useRouter()
  const { isOperator, canAccessBimbingan, loading: loadingRole } = useAuthRole()

  const [userDisplayName, setUserDisplayName] = useState('MEMUAT...')
  const [userNuptkDisplay, setUserNuptkDisplay] = useState('-')
  const [isStrictOperatorRole, setIsStrictOperatorRole] = useState(false)
  const [waliKelasAssignedId, setWaliKelasAssignedId] = useState<number | null>(null)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  // Hak kelola jadwal: operator ATAU manajer terdaftar (mis. TRI RATNO)
  const isJadwalManager = canManageJadwal(isOperator, userEmail)
  const [activeTab, setActiveTab] = useState<'kelola' | 'rekap'>('kelola')
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  // Tanggal hari ini & tanggal pengecekan status absensi (diisi via useEffect agar aman Next.js 16)
  const [todayIso, setTodayIso] = useState<string>('')
  const [tanggalCekAbsen, setTanggalCekAbsen] = useState<string>('')
  const [todayName, setTodayName] = useState<string>('Senin')
  const [absenStatusKeys, setAbsenStatusKeys] = useState<Set<string>>(new Set())

  const selectedDateHariName = useMemo(() => {
    if (!tanggalCekAbsen) return todayName
    const parts = tanggalCekAbsen.split('-').map(Number)
    if (parts.length !== 3) return todayName
    const dt = new Date(parts[0], parts[1] - 1, parts[2])
    return JS_DAY_TO_HARI[dt.getDay()] || todayName
  }, [tanggalCekAbsen, todayName])

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

  const { isDarkMode } = useDarkMode()

  // Master Data SMP
  const [mapelList, setMapelList] = useState<MapelItem[]>([])
  const [kelasList, setKelasList] = useState<KelasItem[]>([])
  const [guruList, setGuruList] = useState<GuruItem[]>([])
  const [masterJamList, setMasterJamList] = useState<MasterJamItem[]>([])

  // State Form Input & Edit (Khusus Operator)
  const [editingJadwalId, setEditingJadwalId] = useState<number | null>(null)
  const [hari, setHari] = useState('Senin')
  const [jamMulai, setJamMulai] = useState<string>('1')
  const [jamSelesai, setJamSelesai] = useState<string>('1')
  const [selectedKelasId, setSelectedKelasId] = useState<string>('') // 'ALL' = Semua Kelas (Serentak)
  const [selectedMapelId, setSelectedMapelId] = useState<string>('')
  const [selectedGuruEmail, setSelectedGuruEmail] = useState<string>('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Data Jadwal SMP
  const [allSmpJadwal, setAllSmpJadwal] = useState<Jadwal[]>([])
  const [loading, setLoading] = useState(false)

  // State Filter & Tampilan Daftar (Mode List vs Matriks & Accordion)
  const [viewMode, setViewMode] = useState<'list' | 'matrix'>('list')
  const [guruScope, setGuruScope] = useState<'mine' | 'all'>('mine')
  const [selectedHariFilter, setSelectedHariFilter] = useState<string>('') // '' = Semua Hari
  const [listFilterKelasId, setListFilterKelasId] = useState<string>('')
  const [listFilterGuruEmail, setListFilterGuruEmail] = useState<string>('')
  const [searchMapelQuery, setSearchMapelQuery] = useState<string>('')
  const [collapsedDays, setCollapsedDays] = useState<Record<string, boolean>>({})
  const [matrixHari, setMatrixHari] = useState<string>('Senin')

  // State Filter Tab Rekap
  const [filterHari, setFilterHari] = useState('')
  const [filterKelasId, setFilterKelasId] = useState('')
  const [filterMapelId, setFilterMapelId] = useState('')

  // Periode Akademik Aktif (Tahun Ajaran & Semester)
  const [selectedSemester, setSelectedSemester] = useState<SemesterType>('Ganjil')
  const [selectedTahunAjaran, setSelectedTahunAjaran] = useState('2026/2027')
  const [copyingPrevSemester, setCopyingPrevSemester] = useState(false)

  // Inisialisasi tanggal klien setelah mount (menghindari Blocking Route prerender)
  useEffect(() => {
    const iso = getLocalTodayIso()
    const dayStr = JS_DAY_TO_HARI[new Date().getDay()] || 'Senin'
    setTodayIso(iso)
    setTanggalCekAbsen(iso)
    setTodayName(dayStr)
    if (HARI_LIST.includes(dayStr)) {
      setMatrixHari(dayStr)
    } else {
      // Jika hari ini Jumat (libur), arahkan matriks ke Sabtu
      setMatrixHari('Sabtu')
    }
  }, [])

  // Sinkronisasi Status Absensi Real-Time dari Supabase (cocokkan Mapel+Kelas dan Jam+Kelas)
  const fetchAbsensiStatusByDate = useCallback(
    async (targetDate: string) => {
      if (!targetDate) return
      let query = supabase
        .from('absensi')
        .select('kelas_id, kelas, mapel_id, mapel, jam_ke')
        .eq('tanggal', targetDate)

      // Guru hanya melihat status presensi miliknya sendiri; operator/manajer melihat semuanya.
      if (!isJadwalManager && userEmail) {
        query = query.ilike('guru_email', userEmail.trim())
      }

      const { data, error } = await query

      if (error) {
        console.error('Error fetching absensi status:', error.message)
        return
      }

    const keys = new Set<string>()
    ;(data || []).forEach((row: any) => {
      const cleanKelas = String(row.kelas || '').trim().toUpperCase()
      const cleanMapel = String(row.mapel || '').trim().toUpperCase()

      // 1. Kunci berdasarkan Kelas + Mapel (agar tetap hijau meski jam di /absensi berbeda tipis)
      if (row.kelas_id && row.mapel_id) {
        keys.add(`kid_${row.kelas_id}_mid_${row.mapel_id}`)
      }
      if (cleanKelas && cleanMapel) {
        keys.add(`knama_${cleanKelas}_mnama_${cleanMapel}`)
      }

      // 2. Kunci berdasarkan Kelas + Jam Ke
      const jamText = String(row.jam_ke || '')
      const rangeMatch = jamText.match(/(\d+)\s*s\/d\s*(\d+)/i)
      const jamNums: number[] = []
      if (rangeMatch) {
        const s = Number(rangeMatch[1])
        const e = Number(rangeMatch[2])
        for (let j = s; j <= e; j++) jamNums.push(j)
      } else {
        const singleDigits = jamText.replace(/\D/g, '')
        if (singleDigits) jamNums.push(Number(singleDigits))
      }

      jamNums.forEach((jNum) => {
        if (row.kelas_id) keys.add(`id_${row.kelas_id}_jam_${jNum}`)
        if (cleanKelas) keys.add(`nama_${cleanKelas}_jam_${jNum}`)
      })
    })

    setAbsenStatusKeys(keys)
  }, [isOperator, userEmail])

  useEffect(() => {
    if (!tanggalCekAbsen) return
    fetchAbsensiStatusByDate(tanggalCekAbsen)

    const channel = supabase
      .channel(`realtime-absensi-jadwal-${tanggalCekAbsen}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'absensi' },
        () => {
          fetchAbsensiStatusByDate(tanggalCekAbsen)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [tanggalCekAbsen, fetchAbsensiStatusByDate])

  // Helper cek apakah slot (kelas + mapel / jam tertentu) sudah terabsen pada tanggalCekAbsen
  const isCellSudahAbsen = useCallback(
    (
      kelasId?: number,
      namaKelas?: string,
      jamKe?: number,
      mapelId?: number,
      namaMapel?: string
    ): boolean => {
      const cleanNama = (namaKelas || '').trim().toUpperCase()
      const cleanMapel = (namaMapel || '').trim().toUpperCase()

      if (kelasId && mapelId && absenStatusKeys.has(`kid_${kelasId}_mid_${mapelId}`)) return true
      if (cleanNama && cleanMapel && absenStatusKeys.has(`knama_${cleanNama}_mnama_${cleanMapel}`)) {
        return true
      }

      if (typeof jamKe === 'number') {
        if (kelasId && absenStatusKeys.has(`id_${kelasId}_jam_${jamKe}`)) return true
        if (cleanNama && absenStatusKeys.has(`nama_${cleanNama}_jam_${jamKe}`)) return true
      }
      return false
    },
    [absenStatusKeys]
  )

  // Helper cek apakah satu sesi jadwal sudah terabsen
  const isJadwalItemSudahAbsen = useCallback(
    (item: Jadwal): boolean => {
      if (item.hari !== selectedDateHariName) return false
      const namaKelas =
        typeof item.kelas === 'object' ? item.kelas?.nama_kelas || '' : String(item.kelas || '')
      const namaMapel =
        typeof item.mapel === 'object' ? item.mapel?.nama_mapel || '' : String(item.mapel || '')
      const { start, end } = parseJamRange(item)

      for (let j = start; j <= end; j++) {
        if (isCellSudahAbsen(item.kelas_id, namaKelas, j, item.mapel_id, namaMapel)) return true
      }
      return false
    },
    [selectedDateHariName, isCellSudahAbsen]
  )

  useEffect(() => {
    let isMounted = true

    async function init() {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        if (isMounted) router.replace('/login')
        return
      }

      const rawEmail = user.email || ''
      const cleanEmail = rawEmail.trim().toLowerCase()

      if (isMounted) {
        setUserEmail(rawEmail)
        setSelectedGuruEmail(rawEmail)
      }

      const { data: dataGuruLogin } = await supabase
        .from('guru')
        .select('id, nama_lengkap, role, NUPTK, email, jabatan')
        .ilike('email', cleanEmail)
        .maybeSingle()

      if (isMounted) {
        if (dataGuruLogin && dataGuruLogin.nama_lengkap) {
          const namaLengkapResmi = dataGuruLogin.nama_lengkap.trim()
          const cleanNuptk = formatNuptk(dataGuruLogin.NUPTK)
          const isUserStrictOperator =
            (dataGuruLogin.role || '').toLowerCase() === 'operator'

          setUserDisplayName(namaLengkapResmi.toUpperCase())
          setUserNuptkDisplay(cleanNuptk)
          setIsStrictOperatorRole(isUserStrictOperator)

          if (!isUserStrictOperator && dataGuruLogin.id) {
            const { data: kelasBinaan } = await supabase
              .from('kelas')
              .select('id')
              .eq('wali_kelas_id', dataGuruLogin.id)
              .limit(1)
              .maybeSingle()

            if (isMounted) {
              setWaliKelasAssignedId(kelasBinaan?.id || null)
            }
          }
        } else {
          const fallbackName =
            user.user_metadata?.full_name || cleanEmail.split('@')[0] || 'GURU'
          setUserDisplayName(fallbackName.toUpperCase())
          setUserNuptkDisplay('-')
          setIsStrictOperatorRole(isOperator)
        }
      }

      await fetchMasterData()
    }

    if (!loadingRole) {
      init()
    }

    return () => {
      isMounted = false
    }
  }, [isOperator, loadingRole, router])

  // Ambil Master Data Khusus SMP (Isolasi dari SMK)
  async function fetchMasterData() {
    const [resMapel, resKelas, resGuru, resJam] = await Promise.all([
      supabase
        .from('mapel')
        .select('id, nama_mapel, kode_mapel, jenjang')
        .or('jenjang.eq.SMP,jenjang.is.null')
        .order('urutan', { ascending: true }),
      supabase
        .from('kelas')
        .select('id, nama_kelas, jenjang')
        .or('jenjang.eq.SMP,jenjang.is.null')
        .order('nama_kelas', { ascending: true }),
      supabase
        .from('guru')
        .select('id, nama_lengkap, email, unit_mengajar')
        .order('nama_lengkap', { ascending: true }),
      supabase.from('master_jam').select('*').order('jam_ke', { ascending: true }),
    ])

    if (resMapel.data) setMapelList(resMapel.data)
    if (resKelas.data) setKelasList(sortKelas(resKelas.data))
    if (resGuru.data) {
      const smpTeachers = resGuru.data.filter(
        (g) => (g.unit_mengajar || 'SMP').toUpperCase() !== 'SMK'
      )
      setGuruList(smpTeachers)
    }
    if (resJam.data) setMasterJamList(resJam.data)
  }

  // Ambil Semua Jadwal Khusus SMP
  async function fetchJadwal() {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('jadwal')
        .select(
          `
          id,
          hari,
          jam,
          jam_ke,
          kelas_id,
          mapel_id,
          guru_email,
          semester,
          tahun_ajaran,
          kelas:kelas_id(nama_kelas, jenjang),
          mapel:mapel_id(nama_mapel, kode_mapel, jenjang)
        `
        )
        .eq('semester', selectedSemester)
        .eq('tahun_ajaran', selectedTahunAjaran)

      if (!error && data) {
        const onlySmp = (data as any[]).filter((row) => {
          const kelasJenjang =
            typeof row.kelas === 'object' && row.kelas !== null ? row.kelas.jenjang : null
          const mapelJenjang =
            typeof row.mapel === 'object' && row.mapel !== null ? row.mapel.jenjang : null
          const kelasName =
            typeof row.kelas === 'object' && row.kelas !== null
              ? row.kelas.nama_kelas || ''
              : String(row.kelas || '')

          if (kelasJenjang === 'SMK' || mapelJenjang === 'SMK') return false
          if (kelasName.toUpperCase().includes('DKV')) return false
          return true
        })

        const sortedData = onlySmp.sort((a, b) => {
          const orderHariA = HARI_ORDER[a.hari] || 99
          const orderHariB = HARI_ORDER[b.hari] || 99
          if (orderHariA !== orderHariB) return orderHariA - orderHariB
          return Number(a.jam_ke || 0) - Number(b.jam_ke || 0)
        })

        setAllSmpJadwal(sortedData)
      } else {
        setAllSmpJadwal([])
      }
    } catch (err) {
      console.error('Error fetching jadwal:', err)
    } finally {
      setLoading(false)
    }
  }

  // Muat ulang jadwal ketika periode akademik (semester/tahun ajaran) berubah
  useEffect(() => {
    if (!loadingRole) {
      fetchJadwal()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSemester, selectedTahunAjaran, loadingRole])

  // Map email -> Nama Lengkap Guru
  const guruNameMap = useMemo(() => {
    const map: Record<string, string> = {}
    guruList.forEach((g) => {
      if (g.email) {
        map[g.email.trim().toLowerCase()] = g.nama_lengkap
      }
    })
    return map
  }, [guruList])

  const getGuruDisplayName = (email?: string) => {
    if (!email) return '-'
    const found = guruNameMap[email.trim().toLowerCase()]
    return found || email
  }

  // Daftar Jadwal sesuai Peran
  const roleScopedJadwal = useMemo(() => {
    if (isJadwalManager) return allSmpJadwal
    if (guruScope === 'all') return allSmpJadwal
    const cleanMe = (userEmail || '').trim().toLowerCase()
    return allSmpJadwal.filter(
      (j) => (j.guru_email || '').trim().toLowerCase() === cleanMe
    )
  }, [allSmpJadwal, isJadwalManager, guruScope, userEmail])

  // Jadwal Pribadi Guru
  const myPersonalJadwal = useMemo(() => {
    const cleanMe = (userEmail || '').trim().toLowerCase()
    return allSmpJadwal.filter(
      (j) => (j.guru_email || '').trim().toLowerCase() === cleanMe
    )
  }, [allSmpJadwal, userEmail])

  const myTotalJp = useMemo(() => {
    return myPersonalJadwal.reduce((acc, item) => acc + parseJamRange(item).jp, 0)
  }, [myPersonalJadwal])

  const myTodayJadwal = useMemo(() => {
    return myPersonalJadwal.filter((j) => j.hari === selectedDateHariName)
  }, [myPersonalJadwal, selectedDateHariName])

  // 1. Data Matriks per Kelas untuk Hari Terpilih (dideklarasikan SEBELUM matrixAbsenSummary)
  const matrixJamRows = useMemo(() => {
    const jamFromMaster = masterJamList.filter((j) => j.hari === matrixHari)
    if (jamFromMaster.length > 0) {
      return jamFromMaster.map((j) => ({
        jamKe: j.jam_ke,
        waktu: `${j.waktu_mulai.slice(0, 5)} - ${j.waktu_selesai.slice(0, 5)}`,
      }))
    }
    return [1, 2, 3, 4, 5, 6, 7, 8].map((num) => ({
      jamKe: num,
      waktu: `Jam Ke-${num}`,
    }))
  }, [masterJamList, matrixHari])

  // 2. Ringkasan Progres Absensi pada Matriks Hari Terpilih
  const matrixAbsenSummary = useMemo(() => {
    if (matrixHari !== selectedDateHariName) return null
    let totalTerisi = 0
    let totalSudahAbsen = 0

    matrixJamRows.forEach((row) => {
      kelasList.forEach((k) => {
        const cell = allSmpJadwal.find((j) => {
          if (j.hari !== matrixHari) return false
          if (Number(j.kelas_id) !== Number(k.id)) return false
          const { start, end } = parseJamRange(j)
          return row.jamKe >= start && row.jamKe <= end
        })
        if (cell) {
          totalTerisi++
          const mName =
            typeof cell.mapel === 'object' ? cell.mapel?.nama_mapel : String(cell.mapel || '')
          if (isCellSudahAbsen(k.id, k.nama_kelas, row.jamKe, cell.mapel_id, mName)) {
            totalSudahAbsen++
          }
        }
      })
    })

    return { totalTerisi, totalSudahAbsen }
  }, [
    matrixHari,
    selectedDateHariName,
    kelasList,
    allSmpJadwal,
    isCellSudahAbsen,
    matrixJamRows,
  ])

  // Terapkan Filter Bar pada Daftar Jadwal
  const filteredDisplayJadwal = useMemo(() => {
    const q = searchMapelQuery.trim().toLowerCase()
    return roleScopedJadwal.filter((item) => {
      if (selectedHariFilter && item.hari !== selectedHariFilter) return false
      if (listFilterKelasId && Number(item.kelas_id) !== Number(listFilterKelasId)) return false
      if (
        listFilterGuruEmail &&
        (item.guru_email || '').trim().toLowerCase() !== listFilterGuruEmail.trim().toLowerCase()
      ) {
        return false
      }
      if (q) {
        const namaMapel =
          typeof item.mapel === 'object' ? item.mapel?.nama_mapel || '' : String(item.mapel || '')
        const namaKelas =
          typeof item.kelas === 'object' ? item.kelas?.nama_kelas || '' : String(item.kelas || '')
        const namaGuru = getGuruDisplayName(item.guru_email)
        const haystack = `${namaMapel} ${namaKelas} ${namaGuru}`.toLowerCase()
        if (!haystack.includes(q)) return false
      }
      return true
    })
  }, [
    roleScopedJadwal,
    selectedHariFilter,
    listFilterKelasId,
    listFilterGuruEmail,
    searchMapelQuery,
    guruNameMap,
  ])

  // Kelompokkan Daftar Jadwal per Hari
  const groupedByHari = useMemo(() => {
    const groups: { hari: string; items: Jadwal[]; totalJp: number }[] = []
    HARI_LIST.forEach((h) => {
      const items = filteredDisplayJadwal.filter((j) => j.hari === h)
      if (items.length > 0) {
        const totalJp = items.reduce((sum, it) => sum + parseJamRange(it).jp, 0)
        groups.push({ hari: h, items, totalJp })
      }
    })
    return groups
  }, [filteredDisplayJadwal])

  const jamOptionsForSelectedHari = masterJamList.filter((j) => j.hari === hari)

  // Reset Form Input / Batal Edit
  const resetFormInput = () => {
    setEditingJadwalId(null)
    setSelectedKelasId('')
    setSelectedMapelId('')
  }

  // Mulai Edit Jadwal yang Sudah Ada
  const handleStartEdit = (item: Jadwal) => {
    if (!isJadwalManager || !item.id) return
    const { start, end } = parseJamRange(item)
    setEditingJadwalId(item.id)
    setHari(HARI_LIST.includes(item.hari) ? item.hari : 'Senin')
    setJamMulai(String(start))
    setJamSelesai(String(end))
    setSelectedKelasId(item.kelas_id ? String(item.kelas_id) : '')
    setSelectedMapelId(item.mapel_id ? String(item.mapel_id) : '')
    setSelectedGuruEmail(item.guru_email || userEmail || '')
  }

  // Simpan Baru (Tunggal / Semua Kelas Serentak) atau Update Edit
  const handleSimpan = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isJadwalManager || isSubmitting) return

    if (!selectedKelasId || !selectedMapelId) {
      alert('Silakan pilih Kelas dan Mata Pelajaran!')
      return
    }

    if (!selectedGuruEmail) {
      alert('Guru pengampu wajib dipilih!')
      return
    }

    const startJamObj = masterJamList.find(
      (j) => j.hari === hari && j.jam_ke === Number(jamMulai)
    )
    const endJamObj = masterJamList.find(
      (j) => j.hari === hari && j.jam_ke === Number(jamSelesai)
    )

    let formattedJamText =
      Number(jamMulai) === Number(jamSelesai)
        ? `Jam Ke-${jamMulai}`
        : `Jam Ke-${jamMulai} s/d ${jamSelesai}`

    if (startJamObj && endJamObj) {
      const wMulai = startJamObj.waktu_mulai.slice(0, 5)
      const wSelesai = endJamObj.waktu_selesai.slice(0, 5)
      formattedJamText =
        Number(jamMulai) === Number(jamSelesai)
          ? `Jam Ke-${jamMulai} (${wMulai} - ${wSelesai})`
          : `Jam Ke-${jamMulai} s/d ${jamSelesai} (${wMulai} - ${wSelesai})`
    }

    const startInput = Number(jamMulai)
    const endInput = Number(jamSelesai)
    const isAllClassesSerentak = selectedKelasId === 'ALL' && !editingJadwalId

    if (!isAllClassesSerentak) {
      const bentrok = allSmpJadwal.find((j) => {
        if (editingJadwalId && j.id === editingJadwalId) return false
        if (j.hari !== hari) return false

        const { start: existingStart, end: existingEnd } = parseJamRange(j)
        const isTimeOverlap = startInput <= existingEnd && endInput >= existingStart
        if (!isTimeOverlap) return false

        const isSameKelas = Number(j.kelas_id) === Number(selectedKelasId)
        const isSameGuru =
          (j.guru_email || '').trim().toLowerCase() === selectedGuruEmail.trim().toLowerCase()

        return isSameKelas || isSameGuru
      })

      if (bentrok) {
        const isSameKelas = Number(bentrok.kelas_id) === Number(selectedKelasId)
        if (isSameKelas) {
          alert(
            `BENTROK KELAS! Kelas yang dipilih sudah memiliki jadwal mengajar pada ${hari} di jam tersebut.`
          )
        } else {
          alert(
            `BENTROK GURU! ${getGuruDisplayName(
              selectedGuruEmail
            )} sudah mengajar di kelas lain pada ${hari} di jam tersebut.`
          )
        }
        return
      }
    } else {
      if (kelasList.length === 0) {
        alert('Data kelas SMP masih kosong.')
        return
      }
      const bentrokSerentak = allSmpJadwal.find((j) => {
        if (j.hari !== hari) return false
        const { start: existingStart, end: existingEnd } = parseJamRange(j)
        const isTimeOverlap = startInput <= existingEnd && endInput >= existingStart
        return isTimeOverlap && Number(j.mapel_id) === Number(selectedMapelId)
      })
      if (bentrokSerentak) {
        const namaBentrok =
          typeof bentrokSerentak.mapel === 'object'
            ? bentrokSerentak.mapel?.nama_mapel
            : String(bentrokSerentak.mapel || '')
        alert(
          `BENTROK! Sudah ada jadwal ${getGuruDisplayName(
            bentrokSerentak.guru_email
          )} (${namaBentrok}) pada ${hari} di jam yang tumpang tindih. Periksa kembali data serentak.`
        )
        return
      }
      const okConfirm = confirm(
        `Simpan jadwal serentak untuk seluruh ${kelasList.length} kelas SMP pada hari ${hari} (${formattedJamText})?`
      )
      if (!okConfirm) return
    }

    setIsSubmitting(true)
    try {
      const selectedMapelObj = mapelList.find((m) => m.id === Number(selectedMapelId))

      if (editingJadwalId) {
        const selectedKelasObj = kelasList.find((k) => k.id === Number(selectedKelasId))
        const { error } = await supabase
          .from('jadwal')
          .update({
            hari,
            jam: formattedJamText,
            jam_ke: Number(jamMulai),
            kelas_id: Number(selectedKelasId),
            mapel_id: Number(selectedMapelId),
            guru_email: selectedGuruEmail,
            kelas: selectedKelasObj?.nama_kelas || '',
            mapel: selectedMapelObj?.nama_mapel || '',
            semester: selectedSemester,
            tahun_ajaran: selectedTahunAjaran,
          })
          .eq('id', editingJadwalId)

        if (error) {
          alert('Gagal memperbarui jadwal: ' + error.message)
        } else {
          resetFormInput()
          await fetchJadwal()
        }
      } else if (isAllClassesSerentak) {
        const rowsToInsert = kelasList.map((k) => ({
          hari,
          jam: formattedJamText,
          jam_ke: Number(jamMulai),
          kelas_id: k.id,
          mapel_id: Number(selectedMapelId),
          guru_email: selectedGuruEmail,
          kelas: k.nama_kelas,
          mapel: selectedMapelObj?.nama_mapel || '',
          semester: selectedSemester,
          tahun_ajaran: selectedTahunAjaran,
        }))

        const { error } = await supabase.from('jadwal').insert(rowsToInsert)
        if (error) {
          alert('Gagal menyimpan jadwal serentak: ' + error.message)
        } else {
          resetFormInput()
          await fetchJadwal()
        }
      } else {
        const selectedKelasObj = kelasList.find((k) => k.id === Number(selectedKelasId))
        const { error } = await supabase.from('jadwal').insert([
          {
            hari,
            jam: formattedJamText,
            jam_ke: Number(jamMulai),
            kelas_id: Number(selectedKelasId),
            mapel_id: Number(selectedMapelId),
            guru_email: selectedGuruEmail,
            kelas: selectedKelasObj?.nama_kelas || '',
            mapel: selectedMapelObj?.nama_mapel || '',
            semester: selectedSemester,
            tahun_ajaran: selectedTahunAjaran,
          },
        ])

        if (error) {
          alert('Gagal menyimpan jadwal: ' + error.message)
        } else {
          resetFormInput()
          await fetchJadwal()
        }
      }
    } catch (err: any) {
      alert('Error: ' + err.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (id?: number) => {
    if (!isJadwalManager) return
    if (!id || !confirm('Yakin ingin menghapus jadwal mengajar ini?')) return

    try {
      const { error } = await supabase.from('jadwal').delete().eq('id', id)
      if (!error) {
        if (editingJadwalId === id) resetFormInput()
        setAllSmpJadwal((prev) => prev.filter((item) => item.id !== id))
      }
    } catch (err) {
      console.error('Error deleting jadwal:', err)
    }
  }

  // Tentukan periode sumber "semester sebelumnya" dari periode yang aktif
  const getPrevPeriode = (): { semester: SemesterType; tahun: string } | null => {
    if (selectedSemester === 'Genap') {
      return { semester: 'Ganjil', tahun: selectedTahunAjaran }
    }
    const idx = TAHUN_AJARAN_LIST.indexOf(selectedTahunAjaran)
    if (idx > 0) {
      return { semester: 'Genap', tahun: TAHUN_AJARAN_LIST[idx - 1] }
    }
    return null
  }
  const prevPeriode = getPrevPeriode()
  const isPrevSemesterEmpty = allSmpJadwal.length === 0

  // Salin seluruh jadwal SMP dari periode (semester) sebelumnya ke periode aktif
  const handleSalinJadwalSebelumnya = async () => {
    if (!isJadwalManager || !prevPeriode || isPrevSemesterEmpty) return
    if (
      !confirm(
        `Salin seluruh jadwal SMP dari Semester ${prevPeriode.semester} ${prevPeriode.tahun} ke Semester ${selectedSemester} ${selectedTahunAjaran}?`
      )
    ) {
      return
    }
    setCopyingPrevSemester(true)
    try {
      const { data, error } = await supabase
        .from('jadwal')
        .select(
          'hari, jam, jam_ke, kelas_id, mapel_id, guru_email, kelas, mapel, jenjang'
        )
        .eq('semester', prevPeriode.semester)
        .eq('tahun_ajaran', prevPeriode.tahun)
      if (error) throw error

      const sourceRows = (data || []).filter((row: any) => {
        const kelasJenjang =
          typeof row.kelas === 'object' && row.kelas !== null ? row.kelas.jenjang : null
        const mapelJenjang =
          typeof row.mapel === 'object' && row.mapel !== null ? row.mapel.jenjang : null
        const kelasName =
          typeof row.kelas === 'object' && row.kelas !== null
            ? row.kelas.nama_kelas || ''
            : String(row.kelas || '')
        if (kelasJenjang === 'SMK' || mapelJenjang === 'SMK' || row.jenjang === 'SMK') return false
        if (kelasName.toUpperCase().includes('DKV')) return false
        return true
      })

      if (sourceRows.length === 0) {
        alert('Tidak ada jadwal SMP pada periode sebelumnya untuk disalin.')
        return
      }

      const rowsToInsert = sourceRows.map((r: any) => ({
        hari: r.hari,
        jam: r.jam,
        jam_ke: r.jam_ke,
        kelas_id: r.kelas_id,
        mapel_id: r.mapel_id,
        guru_email: r.guru_email,
        kelas: r.kelas,
        mapel: r.mapel,
        jenjang: r.jenjang || 'SMP',
        semester: selectedSemester,
        tahun_ajaran: selectedTahunAjaran,
      }))

      const { error: insErr } = await supabase.from('jadwal').insert(rowsToInsert)
      if (insErr) throw insErr

      alert(
        `Berhasil menyalin ${rowsToInsert.length} jadwal SMP dari Semester ${prevPeriode.semester} ${prevPeriode.tahun}.`
      )
      await fetchJadwal()
    } catch (err: any) {
      alert('Gagal menyalin jadwal: ' + err.message)
    } finally {
      setCopyingPrevSemester(false)
    }
  }

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

  const filteredRekapList = roleScopedJadwal.filter((item) => {
    const matchHari = !filterHari || item.hari === filterHari
    const matchKelas = !filterKelasId || Number(item.kelas_id) === Number(filterKelasId)
    const matchMapel = !filterMapelId || Number(item.mapel_id) === Number(filterMapelId)
    return matchHari && matchKelas && matchMapel
  })

  if (loadingRole) {
    return (
      <div
        className={`h-screen w-screen flex items-center justify-center font-sans ${
          isDarkMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-200 text-slate-800'
        }`}
      >
        <div
          className={`p-4 rounded-xl border text-center space-y-1 shadow-xs ${
            isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-300'
          }`}
        >
          <p className="font-bold text-xs">Memuat Data Jadwal SMP...</p>
        </div>
      </div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={`h-screen w-screen overflow-hidden font-sans flex flex-col justify-between selection:bg-indigo-500 selection:text-white relative transition-colors duration-300 ${
        isDarkMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-200 text-slate-800'
      }`}
    >
      {/* WATERMARK LOGO */}
      <div
        className={`fixed inset-0 pointer-events-none z-0 flex items-center justify-center select-none print:hidden transition-opacity duration-300 ${
          isDarkMode ? 'opacity-[0.04]' : 'opacity-[0.12]'
        }`}
      >
        <img
          src="/logo-smp.jpg"
          alt="Watermark"
          className="w-[600px] h-[600px] object-contain max-w-none"
        />
      </div>

      <div className="relative z-10 flex flex-col h-full overflow-hidden">
        {/* 1. SUPER-COMPACT HEADER TOPBAR */}
        <header
          className={`border-b px-3 py-1.5 flex items-center justify-between gap-2 shrink-0 shadow-xs print:hidden transition-colors duration-300 ${
            isDarkMode
              ? 'bg-slate-900/95 border-slate-800 backdrop-blur-md'
              : 'bg-slate-100/95 border-slate-300 backdrop-blur-md'
          }`}
        >
          <div className="flex items-center gap-2 shrink-0">
            <Link
              href="/"
              className={`p-1 rounded-lg transition ${
                isDarkMode
                  ? 'text-slate-400 hover:text-white'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Kembali"
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
                <h1
                  className={`font-black text-xs leading-none ${
                    isDarkMode ? 'text-white' : 'text-slate-900'
                  }`}
                >
                  Jadwal Mengajar SMP
                </h1>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <DarkModeToggle />
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
                <span className="font-extrabold max-w-[115px] sm:max-w-none truncate">
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

        {/* 2. SUB-NAVBAR AKADEMIK */}
        <div
          className={`border-b px-3 py-1 shrink-0 overflow-x-auto print:hidden transition-colors duration-300 ${
            isDarkMode
              ? 'bg-slate-900/80 border-slate-800 backdrop-blur-md'
              : 'bg-slate-200/80 border-slate-300 backdrop-blur-md'
          }`}
        >
          <div className="max-w-6xl mx-auto flex items-center justify-between gap-2 min-w-max text-[10px] font-bold">
            <div className="flex items-center gap-1">
              <Link
                href="/jadwal"
                className="bg-indigo-600 text-white px-2 py-0.5 rounded shadow-xs font-extrabold flex items-center gap-1"
              >
                <Clock className="w-4 h-4" /> Jadwal
              </Link>
              <Link
                href="/absensi"
                className={`px-2 py-0.5 rounded border transition flex items-center gap-1 ${
                  isDarkMode
                    ? 'bg-slate-800 text-slate-300 border-slate-700'
                    : 'bg-white text-slate-700 border-slate-300'
                }`}
              >
                <ClipboardList className="w-4 h-4" /> Absensi
              </Link>
              <Link
                href="/nilai"
                className={`px-2 py-0.5 rounded border transition flex items-center gap-1 ${
                  isDarkMode
                    ? 'bg-slate-800 text-slate-300 border-slate-700'
                    : 'bg-white text-slate-700 border-slate-300'
                }`}
              >
                <Star className="w-4 h-4" /> Penilaian
              </Link>
              <Link
                href="/jurnal"
                className={`px-2 py-0.5 rounded border transition flex items-center gap-1 ${
                  isDarkMode
                    ? 'bg-slate-800 text-slate-300 border-slate-700'
                    : 'bg-white text-slate-700 border-slate-300'
                }`}
              >
                <NotebookPen className="w-4 h-4" /> Jurnal
              </Link>
              {canAccessBimbingan && (
                <Link
                  href="/bimbingan"
                  className={`px-2 py-0.5 rounded border transition flex items-center gap-1 ${
                    isDarkMode
                      ? 'bg-slate-800 text-slate-300 border-slate-700'
                      : 'bg-white text-slate-700 border-slate-300'
                  }`}
                >
                  <HeartHandshake className="w-4 h-4" /> Bimbingan
                </Link>
              )}
            </div>

            {/* Periode Akademik: Tahun Ajaran & Semester */}
            <div className="flex items-center gap-1.5">
              <span
                className={`text-[9px] uppercase font-extrabold ${
                  isDarkMode ? 'text-indigo-300' : 'text-indigo-800'
                }`}
              >
                <CalendarDays className="w-4 h-4 inline-block align-middle" /> Periode:
              </span>
              <select
                value={selectedTahunAjaran}
                onChange={(e) => setSelectedTahunAjaran(e.target.value)}
                className={`border rounded px-1.5 py-0.5 text-[10px] font-bold focus:outline-none cursor-pointer ${
                  isDarkMode
                    ? 'bg-slate-800 border-slate-700 text-white'
                    : 'bg-white border-slate-300 text-slate-900'
                }`}
              >
                {TAHUN_AJARAN_LIST.map((ta) => (
                  <option key={ta} value={ta}>
                    {ta}
                  </option>
                ))}
              </select>
              <select
                value={selectedSemester}
                onChange={(e) => setSelectedSemester(e.target.value as SemesterType)}
                className={`border rounded px-1.5 py-0.5 text-[10px] font-bold focus:outline-none cursor-pointer ${
                  isDarkMode
                    ? 'bg-slate-800 border-slate-700 text-white'
                    : 'bg-white border-slate-300 text-slate-900'
                }`}
              >
                {SEMESTER_LIST.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              {isJadwalManager && prevPeriode && isPrevSemesterEmpty && (
                <button
                  type="button"
                  onClick={handleSalinJadwalSebelumnya}
                  disabled={copyingPrevSemester}
                  className={`px-1.5 py-0.5 rounded text-[9px] font-black flex items-center gap-1 cursor-pointer disabled:opacity-50 ${
                    isDarkMode
                      ? 'bg-indigo-950 text-indigo-300 border border-indigo-800 hover:bg-indigo-900'
                      : 'bg-indigo-100 text-indigo-800 border border-indigo-300 hover:bg-indigo-200'
                  }`}
                  title={`Salin jadwal dari Semester ${prevPeriode.semester} ${prevPeriode.tahun}`}
                >
                  <CopyPlus className="w-3 h-3" />
                  {copyingPrevSemester
                    ? 'Menyalin...'
                    : `Salin dari ${prevPeriode.semester} ${prevPeriode.tahun}`}
                </button>
              )}
            </div>

            {/* Kontrol Tanggal Pantau Status Absensi Real-Time */}
            <div className="flex items-center gap-1.5">
              <span
                className={`text-[9px] uppercase font-extrabold ${
                  isDarkMode ? 'text-emerald-400' : 'text-emerald-800'
                }`}
              >
                <Radio className="w-4 h-4 inline-block align-middle" /> Pantau Absen:
              </span>
              <input
                type="date"
                value={tanggalCekAbsen}
                onChange={(e) => {
                  const val = e.target.value
                  setTanggalCekAbsen(val)
                  if (val) {
                    const p = val.split('-').map(Number)
                    const dName = JS_DAY_TO_HARI[new Date(p[0], p[1] - 1, p[2]).getDay()]
                    if (dName && HARI_LIST.includes(dName)) {
                      setMatrixHari(dName)
                    }
                  }
                }}
                className={`border rounded px-1.5 py-0.5 text-[10px] font-bold focus:outline-none ${
                  isDarkMode
                    ? 'bg-slate-800 border-slate-700 text-emerald-300'
                    : 'bg-white border-slate-300 text-slate-900'
                }`}
              />
              {todayIso && tanggalCekAbsen !== todayIso && (
                <button
                  type="button"
                  onClick={() => {
                    setTanggalCekAbsen(todayIso)
                    if (HARI_LIST.includes(todayName)) {
                      setMatrixHari(todayName)
                    } else {
                      setMatrixHari('Sabtu')
                    }
                  }}
                  className="px-1.5 py-0.5 rounded bg-indigo-600 text-white text-[9px] font-black cursor-pointer"
                >
                  Hari Ini
                </button>
              )}
            </div>
          </div>
        </div>

        {/* MAIN CONTENT CONTAINER */}
        <main className="max-w-6xl w-full mx-auto p-2 flex-1 flex flex-col space-y-2 overflow-hidden mb-12">
          {/* TAB SWITCHER */}
          <div className="flex items-center justify-between gap-1.5 shrink-0 print:hidden">
            <div
              className={`grid grid-cols-2 p-0.5 rounded-lg border w-full text-[11px] font-extrabold shadow-xs ${
                isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-300'
              }`}
            >
              <button
                onClick={() => setActiveTab('kelola')}
                className={`py-1 rounded-md transition flex items-center justify-center gap-1 cursor-pointer ${
                  activeTab === 'kelola'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : isDarkMode
                    ? 'text-slate-400'
                    : 'text-slate-700'
                }`}
              >
                <Clock className="w-4 h-4" /> {isJadwalManager ? 'Input & Kelola' : 'Jadwal Mengajar'}
              </button>
              <button
                onClick={() => setActiveTab('rekap')}
                className={`py-1 rounded-md transition flex items-center justify-center gap-1 cursor-pointer ${
                  activeTab === 'rekap'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : isDarkMode
                    ? 'text-slate-400'
                    : 'text-slate-700'
                }`}
              >
                <History className="w-4 h-4" /> Rekap &amp; Cetak
              </button>
            </div>

            <button
              onClick={() => window.print()}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold px-2.5 py-1 rounded-lg text-[10px] flex items-center justify-center gap-1 transition shadow-xs cursor-pointer shrink-0"
              title="Cetak Jadwal PDF"
            >
              <Printer className="w-4 h-4" /> Cetak
            </button>
          </div>

          {activeTab === 'kelola' && (
            <div className="flex flex-col h-full overflow-hidden space-y-2">
              {/* ===================================================================
                  BAGIAN ATAS A: FORM INPUT / EDIT (KHUSUS OPERATOR)
                 =================================================================== */}
              {isJadwalManager && (
                <form
                  onSubmit={handleSimpan}
                  className={`border rounded-xl p-2 shrink-0 shadow-xs space-y-1.5 print:hidden ${
                    editingJadwalId
                      ? isDarkMode
                        ? 'bg-amber-950/30 border-amber-500/60'
                        : 'bg-amber-50 border-amber-400'
                      : isDarkMode
                      ? 'bg-slate-900 border-slate-800'
                      : 'bg-white border-indigo-200'
                  }`}
                >
                  {editingJadwalId && (
                    <div className="flex items-center justify-between text-[10px] font-black text-amber-500 px-0.5">
                      <span><Pencil className="w-4 h-4" /> MODE EDIT JADWAL #{editingJadwalId}</span>
                      <button
                        type="button"
                        onClick={resetFormInput}
                        className="underline hover:text-amber-400 cursor-pointer"
                      >
                        Batal Edit
                      </button>
                    </div>
                  )}

                  {/* ROW 1: GURU PENGAMPU */}
                  <div>
                    <select
                      value={selectedGuruEmail}
                      onChange={(e) => setSelectedGuruEmail(e.target.value)}
                      className={`w-full border rounded-lg px-2 py-1 text-xs font-bold focus:outline-none ${
                        isDarkMode
                          ? 'bg-slate-800 border-slate-700 text-white'
                          : 'bg-slate-50 border-slate-300 text-slate-900'
                      }`}
                      required
                    >
                      <option value="">-- Pilih Guru Pengampu --</option>
                      {guruList.map((g) => (
                        <option key={g.id} value={g.email}>
                          {g.nama_lengkap}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* ROW 2: HARI & JAM MENGAJAR */}
                  <div className="grid grid-cols-12 gap-1.5">
                    <div className="col-span-5">
                      <select
                        value={hari}
                        onChange={(e) => {
                          setHari(e.target.value)
                          setJamMulai('1')
                          setJamSelesai('1')
                        }}
                        className={`w-full border rounded-lg px-2 py-1 text-xs font-bold focus:outline-none ${
                          isDarkMode
                            ? 'bg-slate-800 border-slate-700 text-white'
                            : 'bg-slate-50 border-slate-300 text-slate-900'
                        }`}
                      >
                        {HARI_LIST.map((h) => (
                          <option key={h} value={h}>
                            {h}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="col-span-7 flex gap-1">
                      <select
                        value={jamMulai}
                        onChange={(e) => {
                          const val = e.target.value
                          setJamMulai(val)
                          if (Number(val) > Number(jamSelesai)) setJamSelesai(val)
                        }}
                        className={`w-full border rounded-lg px-1 py-1 text-xs font-bold focus:outline-none ${
                          isDarkMode
                            ? 'bg-slate-800 border-slate-700 text-white'
                            : 'bg-slate-50 border-slate-300 text-slate-900'
                        }`}
                      >
                        {jamOptionsForSelectedHari.length > 0
                          ? jamOptionsForSelectedHari.map((j) => (
                              <option key={j.id} value={j.jam_ke}>
                                Jam {j.jam_ke}
                              </option>
                            ))
                          : [1, 2, 3, 4, 5, 6, 7, 8].map((num) => (
                              <option key={num} value={num}>
                                Jam {num}
                              </option>
                            ))}
                      </select>

                      <select
                        value={jamSelesai}
                        onChange={(e) => setJamSelesai(e.target.value)}
                        className={`w-full border rounded-lg px-1 py-1 text-xs font-bold focus:outline-none ${
                          isDarkMode
                            ? 'bg-slate-800 border-slate-700 text-white'
                            : 'bg-slate-50 border-slate-300 text-slate-900'
                        }`}
                      >
                        {jamOptionsForSelectedHari.length > 0
                          ? jamOptionsForSelectedHari
                              .filter((j) => j.jam_ke >= Number(jamMulai))
                              .map((j) => (
                                <option key={j.id} value={j.jam_ke}>
                                  s/d {j.jam_ke}
                                </option>
                              ))
                          : [1, 2, 3, 4, 5, 6, 7, 8]
                              .filter((num) => num >= Number(jamMulai))
                              .map((num) => (
                                <option key={num} value={num}>
                                  s/d {num}
                                </option>
                              ))}
                      </select>
                    </div>
                  </div>

                  {/* ROW 3: KELAS (DENGAN OPSI SEMUA KELAS SERENTAK) & MAPEL */}
                  <div className="grid grid-cols-12 gap-1.5">
                    <div className="col-span-6">
                      <select
                        value={selectedKelasId}
                        onChange={(e) => setSelectedKelasId(e.target.value)}
                        className={`w-full border rounded-lg px-2 py-1 text-xs font-bold focus:outline-none ${
                          isDarkMode
                            ? 'bg-slate-800 border-slate-700 text-white'
                            : 'bg-slate-50 border-slate-300 text-slate-900'
                        }`}
                        required
                      >
                        <option value="">-- Pilih Kelas SMP --</option>
                        {!editingJadwalId && kelasList.length > 0 && (
                          <option value="ALL">
                            <Star className="w-4 h-4 inline-block align-middle" /> Semua Kelas Serentak ({kelasList.length} Kelas)
                          </option>
                        )}
                        {kelasList.map((k) => (
                          <option key={k.id} value={k.id}>
                            {k.nama_kelas}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="col-span-6">
                      <select
                        value={selectedMapelId}
                        onChange={(e) => setSelectedMapelId(e.target.value)}
                        className={`w-full border rounded-lg px-2 py-1 text-xs font-bold focus:outline-none ${
                          isDarkMode
                            ? 'bg-slate-800 border-slate-700 text-white'
                            : 'bg-slate-50 border-slate-300 text-slate-900'
                        }`}
                        required
                      >
                        <option value="">-- Pilih Mapel SMP --</option>
                        {mapelList.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.nama_mapel} {m.kode_mapel ? `(${m.kode_mapel})` : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* TOMBOL SIMPAN / UPDATE */}
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className={`w-full font-black py-1.5 rounded-lg text-xs transition shadow-xs flex items-center justify-center gap-1 cursor-pointer mt-1 disabled:opacity-50 ${
                      editingJadwalId
                        ? 'bg-amber-500 hover:bg-amber-600 text-slate-950'
                        : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    }`}
                  >
                    <span>
                      {isSubmitting
                        ? 'Menyimpan...'
                        : editingJadwalId
                        ? 'SIMPAN PERUBAHAN JADWAL'
                        : selectedKelasId === 'ALL'
                        ? `SIMPAN SERENTAK KE ${kelasList.length} KELAS`
                        : '+ SIMPAN JADWAL'}
                    </span>
                  </button>
                </form>
              )}

              {/* ===================================================================
                  BAGIAN ATAS B: DASHBOARD RINGKAS GURU BIASA (NON-OPERATOR)
                 =================================================================== */}
              {!isJadwalManager && (
                <div
                  className={`border rounded-xl p-2.5 shrink-0 shadow-xs space-y-2 print:hidden ${
                    isDarkMode
                      ? 'bg-slate-900 border-slate-800'
                      : 'bg-white border-indigo-200'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-[11px] font-black text-indigo-400">
                        <Hand className="w-4 h-4 inline-block align-middle" /> {userDisplayName}
                      </p>
                      <p
                        className={`text-[10px] font-semibold ${
                          isDarkMode ? 'text-slate-400' : 'text-slate-600'
                        }`}
                      >
                        Total Beban Mengajar SMP:{' '}
                        <strong className="text-emerald-500">{myTotalJp} JP / Minggu</strong> (
                        {myPersonalJadwal.length} Sesi)
                      </p>
                    </div>

                    <div
                      className={`inline-flex p-0.5 rounded-lg border text-[10px] font-extrabold ${
                        isDarkMode
                          ? 'bg-slate-800 border-slate-700'
                          : 'bg-slate-100 border-slate-300'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => setGuruScope('mine')}
                        className={`px-2 py-0.5 rounded-md cursor-pointer transition ${
                          guruScope === 'mine'
                            ? 'bg-indigo-600 text-white'
                            : isDarkMode
                            ? 'text-slate-400'
                            : 'text-slate-600'
                        }`}
                      >
                        <CalendarDays className="w-4 h-4" /> Jadwal Saya
                      </button>
                      <button
                        type="button"
                        onClick={() => setGuruScope('all')}
                        className={`px-2 py-0.5 rounded-md cursor-pointer transition ${
                          guruScope === 'all'
                            ? 'bg-indigo-600 text-white'
                            : isDarkMode
                            ? 'text-slate-400'
                            : 'text-slate-600'
                        }`}
                      >
                        <School className="w-4 h-4" /> Semua Kelas
                      </button>
                    </div>
                  </div>

                  {/* Sorotan Jadwal Hari Terpilih + Indikator Sudah/Belum Absen */}
                  {guruScope === 'mine' && (
                    <div
                      className={`rounded-lg p-2 border ${
                        isDarkMode
                          ? 'bg-indigo-950/30 border-indigo-800/60'
                          : 'bg-indigo-50/80 border-indigo-200'
                      }`}
                    >
                      <p className="text-[10px] font-black uppercase text-amber-500 mb-1">
                        <Flame className="w-4 h-4 inline-block align-middle" /> Jadwal {selectedDateHariName} ({tanggalCekAbsen}) •{' '}
                        {myTodayJadwal.length} Sesi
                      </p>
                      {myTodayJadwal.length === 0 ? (
                        <p
                          className={`text-[10px] italic ${
                            isDarkMode ? 'text-slate-400' : 'text-slate-600'
                          }`}
                        >
                          Tidak ada jadwal mengajar Anda pada hari {selectedDateHariName}.
                        </p>
                      ) : (
                        <div className="flex gap-1.5 overflow-x-auto pb-0.5">
                          {myTodayJadwal.map((tj, i) => {
                            const kName =
                              typeof tj.kelas === 'object' ? tj.kelas?.nama_kelas : tj.kelas
                            const mName =
                              typeof tj.mapel === 'object' ? tj.mapel?.nama_mapel : tj.mapel
                            const sudahAbsen = isJadwalItemSudahAbsen(tj)

                            return (
                              <div
                                key={tj.id || i}
                                className={`shrink-0 rounded-lg border px-2.5 py-1.5 flex items-center gap-3 transition ${
                                  sudahAbsen
                                    ? isDarkMode
                                      ? 'bg-emerald-950/50 border-emerald-500/70'
                                      : 'bg-emerald-50 border-emerald-400'
                                    : isDarkMode
                                    ? 'bg-slate-900 border-slate-700'
                                    : 'bg-white border-indigo-200'
                                }`}
                              >
                                <div>
                                  <div className="flex items-center gap-1.5">
                                    <span className="px-1.5 py-0.2 rounded bg-indigo-600 text-white text-[9px] font-black">
                                      {kName}
                                    </span>
                                    <span className="text-[11px] font-extrabold">{mName}</span>
                                    {sudahAbsen ? (
                                      <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-[8px] font-black">
                                        ✅ Terabsen
                                      </span>
                                    ) : (
                                      <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-400 border border-amber-500/40 text-[8px] font-black">
                                        ⏳ Belum Absen
                                      </span>
                                    )}
                                  </div>
                                  <p
                                    className={`text-[9px] mt-0.5 ${
                                      isDarkMode ? 'text-slate-400' : 'text-slate-500'
                                    }`}
                                  >
                                    ⏰ {tj.jam}
                                  </p>
                                </div>
                                <div className="flex items-center gap-1">
                                  <Link
                                    href="/absensi"
                                    className={`px-2 py-1 rounded text-white text-[9px] font-black ${
                                      sudahAbsen
                                        ? 'bg-emerald-700 hover:bg-emerald-800'
                                        : 'bg-amber-600 hover:bg-amber-700'
                                    }`}
                                  >
                                    {sudahAbsen ? (<><CheckCircle2 className="w-4 h-4" /> Lihat Absen</>) : (<><ClipboardList className="w-4 h-4" /> Absen</>)}
                                  </Link>
                                  <Link
                                    href="/jurnal"
                                    className="px-2 py-1 rounded bg-indigo-600 hover:bg-indigo-700 text-white text-[9px] font-black"
                                  >
                                    <NotebookPen className="w-4 h-4" /> Jurnal
                                  </Link>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* ===================================================================
                  AREA BAWAH: DAFTAR JADWAL RAPI (ACCORDION PER HARI + MODE MATRIKS)
                 =================================================================== */}
              <div
                className={`border rounded-xl p-2 flex-1 flex flex-col overflow-hidden shadow-xs ${
                  isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-indigo-200'
                }`}
              >
                {/* Header & Toggle Mode List / Matriks */}
                <div className="flex flex-wrap items-center justify-between gap-1.5 pb-1.5 border-b border-slate-700/30 shrink-0">
                  <div className="flex items-center gap-2">
                    <h3
                      className={`text-[11px] font-black uppercase flex items-center gap-1 ${
                        isDarkMode ? 'text-indigo-300' : 'text-indigo-900'
                      }`}
                    >
                      <Clock className="w-4 h-4" />{' '}
                      {isJadwalManager || guruScope === 'all'
                        ? 'Daftar Jadwal SMP'
                        : 'Jadwal Mingguan Saya'}{' '}
                      ({filteredDisplayJadwal.length})
                    </h3>

                    {matrixAbsenSummary && viewMode === 'matrix' && (
                      <span
                        className={`px-2 py-0.5 rounded-full text-[9px] font-black border ${
                          matrixAbsenSummary.totalSudahAbsen ===
                            matrixAbsenSummary.totalTerisi &&
                          matrixAbsenSummary.totalTerisi > 0
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                            : 'bg-sky-500/15 text-sky-300 border-sky-500/30'
                        }`}
                      >
                        ✅ {matrixAbsenSummary.totalSudahAbsen}/{matrixAbsenSummary.totalTerisi}{' '}
                        Jam Terabsen ({tanggalCekAbsen})
                      </span>
                    )}
                  </div>

                  {/* Mode Switcher: List vs Matriks Kelas */}
                  <div
                    className={`inline-flex p-0.5 rounded-lg border text-[10px] font-extrabold print:hidden ${
                      isDarkMode
                        ? 'bg-slate-800 border-slate-700'
                        : 'bg-slate-100 border-slate-300'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setViewMode('list')}
                      className={`px-2 py-0.5 rounded-md cursor-pointer transition ${
                        viewMode === 'list'
                          ? 'bg-indigo-600 text-white'
                          : isDarkMode
                          ? 'text-slate-400'
                          : 'text-slate-600'
                      }`}
                    >
                      <ClipboardList className="w-4 h-4" /> Mode List
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewMode('matrix')}
                      className={`px-2 py-0.5 rounded-md cursor-pointer transition ${
                        viewMode === 'matrix'
                          ? 'bg-indigo-600 text-white'
                          : isDarkMode
                          ? 'text-slate-400'
                          : 'text-slate-600'
                      }`}
                    >
                      <BarChart3 className="w-4 h-4" /> Matriks Kelas
                    </button>
                  </div>
                </div>

                {/* Bar Filter Cepat (Khusus Mode List) */}
                {viewMode === 'list' && (
                  <div className="pt-1.5 pb-1 space-y-1.5 shrink-0 print:hidden">
                    <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
                      <button
                        type="button"
                        onClick={() => setSelectedHariFilter('')}
                        className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold shrink-0 cursor-pointer transition ${
                          selectedHariFilter === ''
                            ? 'bg-indigo-600 text-white'
                            : isDarkMode
                            ? 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        Semua Hari
                      </button>
                      {HARI_LIST.map((h) => {
                        const isToday = h === selectedDateHariName
                        const active = selectedHariFilter === h
                        return (
                          <button
                            key={h}
                            type="button"
                            onClick={() => setSelectedHariFilter(active ? '' : h)}
                            className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold shrink-0 cursor-pointer transition flex items-center gap-1 ${
                              active
                                ? 'bg-indigo-600 text-white'
                                : isDarkMode
                                ? 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                            }`}
                          >
                            <span>{h}</span>
                            {isToday && (
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                            )}
                          </button>
                        )
                      })}
                    </div>

                    <div className="grid grid-cols-12 gap-1">
                      <div className="col-span-4 sm:col-span-3">
                        <select
                          value={listFilterKelasId}
                          onChange={(e) => setListFilterKelasId(e.target.value)}
                          className={`w-full border rounded-lg px-1.5 py-1 text-[10px] font-bold focus:outline-none ${
                            isDarkMode
                              ? 'bg-slate-800 border-slate-700 text-white'
                              : 'bg-slate-50 border-slate-300 text-slate-900'
                          }`}
                        >
                          <option value="">Semua Kelas</option>
                          {kelasList.map((k) => (
                            <option key={k.id} value={k.id}>
                              {k.nama_kelas}
                            </option>
                          ))}
                        </select>
                      </div>

                      {(isJadwalManager || guruScope === 'all') && (
                        <div className="col-span-4 sm:col-span-4">
                          <select
                            value={listFilterGuruEmail}
                            onChange={(e) => setListFilterGuruEmail(e.target.value)}
                            className={`w-full border rounded-lg px-1.5 py-1 text-[10px] font-bold focus:outline-none ${
                              isDarkMode
                                ? 'bg-slate-800 border-slate-700 text-white'
                                : 'bg-slate-50 border-slate-300 text-slate-900'
                            }`}
                          >
                            <option value="">Semua Guru</option>
                            {guruList.map((g) => (
                              <option key={g.id} value={g.email}>
                                {g.nama_lengkap}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      <div
                        className={
                          isJadwalManager || guruScope === 'all'
                            ? 'col-span-4 sm:col-span-5'
                            : 'col-span-8 sm:col-span-9'
                        }
                      >
                        <input
                          type="text"
                          value={searchMapelQuery}
                          onChange={(e) => setSearchMapelQuery(e.target.value)}
                          placeholder="Cari mapel / kelas..."
                          className={`w-full border rounded-lg px-2 py-1 text-[10px] font-semibold focus:outline-none ${
                            isDarkMode
                              ? 'bg-slate-800 border-slate-700 text-white placeholder:text-slate-500'
                              : 'bg-slate-50 border-slate-300 text-slate-900 placeholder:text-slate-400'
                          }`}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* ===============================================================
                    KONTEN 1: TAMPILAN LIST TERKELOMPOK PER HARI (ACCORDION)
                   =============================================================== */}
                {viewMode === 'list' && (
                  <div className="flex-1 overflow-y-auto pr-1 pt-1 space-y-2.5">
                    {loading ? (
                      <div
                        className={`py-6 text-center text-xs font-medium ${
                          isDarkMode ? 'text-slate-500' : 'text-slate-600'
                        }`}
                      >
                        Memuat jadwal SMP...
                      </div>
                    ) : groupedByHari.length === 0 ? (
                      <div
                        className={`py-6 text-center text-xs font-medium ${
                          isDarkMode ? 'text-slate-500' : 'text-slate-600'
                        }`}
                      >
                        Tidak ada jadwal mengajar yang sesuai filter.
                      </div>
                    ) : (
                      groupedByHari.map((group) => {
                        const isCollapsed = Boolean(collapsedDays[group.hari])
                        const isSelectedDateDay = group.hari === selectedDateHariName
                        return (
                          <div key={group.hari} className="space-y-1.5">
                            <button
                              type="button"
                              onClick={() =>
                                setCollapsedDays((prev) => ({
                                  ...prev,
                                  [group.hari]: !prev[group.hari],
                                }))
                              }
                              className={`w-full px-2.5 py-1.5 rounded-lg border flex items-center justify-between text-left cursor-pointer transition ${
                                isSelectedDateDay
                                  ? isDarkMode
                                    ? 'bg-indigo-950/60 border-indigo-700/70 text-indigo-200'
                                    : 'bg-indigo-100/90 border-indigo-300 text-indigo-950'
                                  : isDarkMode
                                  ? 'bg-slate-800/90 border-slate-700 text-slate-200'
                                  : 'bg-slate-100 border-slate-300 text-slate-800'
                              }`}
                            >
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px]">
                                  {isCollapsed ? '▶' : '▼'}
                                </span>
                                <span className="text-[11px] font-black uppercase tracking-wide">
                                  <CalendarDays className="w-4 h-4 inline-block align-middle" /> {group.hari}
                                </span>
                                {isSelectedDateDay && (
                                  <span className="px-1.5 py-0.2 rounded bg-emerald-500 text-slate-950 text-[8px] font-black">
                                    {tanggalCekAbsen === todayIso
                                      ? 'HARI INI'
                                      : tanggalCekAbsen}
                                  </span>
                                )}
                              </div>
                              <span
                                className={`text-[10px] font-bold ${
                                  isDarkMode ? 'text-slate-400' : 'text-slate-600'
                                }`}
                              >
                                {group.items.length} Sesi • {group.totalJp} JP
                              </span>
                            </button>

                            {!isCollapsed && (
                              <div className="space-y-1.5 pl-1">
                                {group.items.map((item, index) => {
                                  const namaKelas =
                                    typeof item.kelas === 'object'
                                      ? item.kelas?.nama_kelas
                                      : item.kelas
                                  const namaMapel =
                                    typeof item.mapel === 'object'
                                      ? item.mapel?.nama_mapel
                                      : item.mapel
                                  const { jp } = parseJamRange(item)
                                  const accent = getKelasAccent(namaKelas || '', isDarkMode)
                                  const sudahAbsen = isJadwalItemSudahAbsen(item)

                                  return (
                                    <div
                                      key={item.id || index}
                                      className={`p-2 rounded-lg border ${
                                        sudahAbsen
                                          ? 'border-l-4 border-l-emerald-400'
                                          : accent.borderLeft
                                      } transition shadow-xs flex flex-col gap-1 ${
                                        sudahAbsen
                                          ? isDarkMode
                                            ? 'bg-emerald-950/35 border-emerald-600/50'
                                            : 'bg-emerald-50/90 border-emerald-300'
                                          : isDarkMode
                                          ? 'bg-slate-800/70 border-slate-700/80'
                                          : 'bg-slate-50 border-slate-200'
                                      }`}
                                    >
                                      <div className="flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-1.5 min-w-0">
                                          <span
                                            className={`px-1.5 py-0.5 rounded text-[10px] font-black border shrink-0 ${accent.badge}`}
                                          >
                                            {namaKelas || '-'}
                                          </span>
                                          <h4
                                            className={`font-extrabold text-[11px] truncate ${
                                              isDarkMode
                                                ? 'text-slate-100'
                                                : 'text-slate-900'
                                            }`}
                                          >
                                            {namaMapel || '-'}
                                          </h4>
                                        </div>

                                        <div className="flex items-center gap-1 shrink-0">
                                          {isSelectedDateDay &&
                                            (sudahAbsen ? (
                                              <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-[9px] font-black">
                                                ✅ Terabsen
                                              </span>
                                            ) : (
                                              <span className="px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30 text-[9px] font-bold">
                                                ⏳ Belum Absen
                                              </span>
                                            ))}

                                          <span
                                            className={`px-1.5 py-0.2 rounded text-[9px] font-black ${
                                              isDarkMode
                                                ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                                                : 'bg-amber-100 text-amber-800 border border-amber-300'
                                            }`}
                                          >
                                            {jp} JP
                                          </span>
                                        </div>
                                      </div>

                                      <div className="flex items-center justify-between gap-2 text-[10px]">
                                        <span
                                          className={`font-semibold truncate ${
                                            isDarkMode ? 'text-slate-300' : 'text-slate-700'
                                          }`}
                                        >
                                          <UserRound className="w-4 h-4 inline-block align-middle" /> {getGuruDisplayName(item.guru_email)}
                                        </span>

                                        <div className="flex items-center gap-2 shrink-0">
                                          <span
                                            className={`font-bold ${
                                              isDarkMode
                                                ? 'text-slate-400'
                                                : 'text-slate-600'
                                            }`}
                                          >
                                            ⏰ {item.jam}
                                          </span>

                                          {isJadwalManager && (
                                            <div className="flex items-center gap-1 print:hidden">
                                              <button
                                                type="button"
                                                onClick={() => handleStartEdit(item)}
                                                className="px-1.5 py-0.5 rounded bg-amber-500/15 hover:bg-amber-500/25 text-amber-400 font-bold cursor-pointer"
                                                title="Edit Jadwal"
                                              >
                                                <Pencil className="w-4 h-4" />
                                              </button>
                                              <button
                                                type="button"
                                                onClick={() => handleDelete(item.id)}
                                                className="px-1.5 py-0.5 rounded bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 font-bold cursor-pointer"
                                                title="Hapus Jadwal"
                                              >
                                                <Trash2 className="w-4 h-4" />
                                              </button>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  )
                                })}
                              </div>
                            )}
                          </div>
                        )
                      })
                    )}
                  </div>
                )}

                {/* ===============================================================
                    KONTEN 2: TAMPILAN MATRIKS / GRID PER KELAS + STATUS ABSENSI
                   =============================================================== */}
                {viewMode === 'matrix' && (
                  <div className="flex-1 flex flex-col overflow-hidden pt-1.5 space-y-1.5">
                    {/* Pemilih Hari Matriks + Legenda Status Absensi */}
                    <div className="flex flex-wrap items-center justify-between gap-1.5 overflow-x-auto shrink-0 print:hidden">
                      <div className="flex items-center gap-1">
                        {HARI_LIST.map((h) => (
                          <button
                            key={h}
                            type="button"
                            onClick={() => setMatrixHari(h)}
                            className={`px-2.5 py-0.5 rounded-lg text-[10px] font-extrabold cursor-pointer transition ${
                              matrixHari === h
                                ? 'bg-indigo-600 text-white'
                                : isDarkMode
                                ? 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                            }`}
                          >
                            {h}
                          </button>
                        ))}
                      </div>

                      <div className="flex items-center gap-2.5 text-[9px] font-bold shrink-0">
                        {matrixHari === selectedDateHariName && (
                          <>
                            <span className="flex items-center gap-1 text-emerald-400">
                              <span className="w-2.5 h-2.5 rounded-xs bg-emerald-500/40 border border-emerald-400 inline-block" />
                              Sudah Absen ({tanggalCekAbsen})
                            </span>
                            <span className="flex items-center gap-1 text-slate-400">
                              <span className="w-2.5 h-2.5 rounded-xs bg-slate-700/60 border border-slate-500 inline-block" />
                              Belum Absen
                            </span>
                          </>
                        )}
                        <span className="text-amber-500">⚠️ Kosong = belum terisi jadwal</span>
                      </div>
                    </div>

                    {/* Tabel Matriks Scrollable Horizontal & Vertikal */}
                    <div className="flex-1 overflow-auto border rounded-lg border-slate-700/40">
                      <table className="w-full border-collapse text-[10px] min-w-[680px]">
                        <thead
                          className={`sticky top-0 z-10 ${
                            isDarkMode
                              ? 'bg-slate-800 text-slate-200'
                              : 'bg-indigo-50 text-indigo-950'
                          }`}
                        >
                          <tr>
                            <th className="border border-slate-700/30 px-2 py-1.5 text-left font-black w-24">
                              JAM ({matrixHari.toUpperCase()})
                            </th>
                            {kelasList.map((k) => (
                              <th
                                key={k.id}
                                className="border border-slate-700/30 px-2 py-1.5 text-center font-black min-w-[145px]"
                              >
                                {k.nama_kelas}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {matrixJamRows.map((row) => (
                            <tr key={row.jamKe}>
                              <td
                                className={`border border-slate-700/30 px-2 py-1.5 font-bold align-top ${
                                  isDarkMode ? 'bg-slate-900/90' : 'bg-slate-50'
                                }`}
                              >
                                <div className="font-black text-indigo-400">
                                  Jam {row.jamKe}
                                </div>
                                <div className="text-[9px] opacity-75">{row.waktu}</div>
                              </td>

                              {kelasList.map((k) => {
                                const cellJadwal = allSmpJadwal.find((j) => {
                                  if (j.hari !== matrixHari) return false
                                  if (Number(j.kelas_id) !== Number(k.id)) return false
                                  const { start, end } = parseJamRange(j)
                                  return row.jamKe >= start && row.jamKe <= end
                                })

                                if (!cellJadwal) {
                                  return (
                                    <td
                                      key={k.id}
                                      className={`border border-slate-700/30 px-2 py-1.5 text-center align-middle ${
                                        isDarkMode
                                          ? 'bg-amber-950/15 text-amber-400/70'
                                          : 'bg-amber-50/70 text-amber-700'
                                      }`}
                                    >
                                      <span className="text-[9px] font-bold">⚠️ KOSONG</span>
                                    </td>
                                  )
                                }

                                const mName =
                                  typeof cellJadwal.mapel === 'object'
                                    ? cellJadwal.mapel?.nama_mapel
                                    : cellJadwal.mapel

                                const isActiveCheckDay = matrixHari === selectedDateHariName
                                const sudahAbsen =
                                  isActiveCheckDay &&
                                  isCellSudahAbsen(
                                    k.id,
                                    k.nama_kelas,
                                    row.jamKe,
                                    cellJadwal.mapel_id,
                                    mName
                                  )

                                return (
                                  <td
                                    key={k.id}
                                    className={`border border-slate-700/30 px-2 py-1.5 align-top transition-colors duration-300 ${
                                      sudahAbsen
                                        ? isDarkMode
                                          ? 'bg-emerald-950/60 border-l-4 border-l-emerald-400 text-emerald-100'
                                          : 'bg-emerald-100/90 border-l-4 border-l-emerald-600 text-emerald-950'
                                        : isDarkMode
                                        ? 'bg-slate-800/50 text-slate-100'
                                        : 'bg-white text-slate-900'
                                    }`}
                                  >
                                    <div className="flex items-start justify-between gap-1">
                                      <div
                                        className={`font-extrabold text-[10px] leading-tight ${
                                          sudahAbsen
                                            ? isDarkMode
                                              ? 'text-emerald-300'
                                              : 'text-emerald-800'
                                            : 'text-indigo-400'
                                        }`}
                                      >
                                        {mName || '-'}
                                      </div>

                                      {isActiveCheckDay &&
                                        (sudahAbsen ? (
                                          <span
                                            className="shrink-0 px-1 py-0.2 rounded bg-emerald-500 text-slate-950 text-[8px] font-black leading-tight"
                                            title={`Absensi sudah masuk pada ${tanggalCekAbsen}`}
                                          >
                                            ✓ Absen
                                          </span>
                                        ) : (
                                          <Link
                                            href="/absensi"
                                            className={`shrink-0 px-1 py-0.2 rounded text-[8px] font-bold leading-tight border ${
                                              isDarkMode
                                                ? 'bg-amber-500/15 text-amber-300 border-amber-500/30 hover:bg-amber-500/30'
                                                : 'bg-amber-100 text-amber-800 border-amber-300 hover:bg-amber-200'
                                            }`}
                                            title="Klik untuk mengisi absensi kelas ini"
                                          >
                                            Belum
                                          </Link>
                                        ))}
                                    </div>

                                    <div className="text-[9px] opacity-85 mt-0.5 leading-tight">
                                      {getGuruDisplayName(cellJadwal.guru_email)}
                                    </div>
                                  </td>
                                )
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: REKAPITULASI & CETAK (DENGAN INDIKATOR SUDAH ABSEN) */}
          {activeTab === 'rekap' && (
            <div className="flex flex-col h-full overflow-hidden space-y-2">
              <div
                className={`grid grid-cols-3 gap-1 border p-1 rounded-lg shrink-0 shadow-xs print:hidden ${
                  isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-indigo-200'
                }`}
              >
                <select
                  value={filterHari}
                  onChange={(e) => setFilterHari(e.target.value)}
                  className={`border rounded px-1.5 py-0.5 text-xs font-bold focus:outline-none ${
                    isDarkMode
                      ? 'bg-slate-800 border-slate-700 text-white'
                      : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                >
                  <option value="">Semua Hari</option>
                  {HARI_LIST.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>

                <select
                  value={filterKelasId}
                  onChange={(e) => setFilterKelasId(e.target.value)}
                  className={`border rounded px-1.5 py-0.5 text-xs font-bold focus:outline-none ${
                    isDarkMode
                      ? 'bg-slate-800 border-slate-700 text-white'
                      : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                >
                  <option value="">Semua Kelas</option>
                  {kelasList.map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.nama_kelas}
                    </option>
                  ))}
                </select>

                <select
                  value={filterMapelId}
                  onChange={(e) => setFilterMapelId(e.target.value)}
                  className={`border rounded px-1.5 py-0.5 text-xs font-bold focus:outline-none ${
                    isDarkMode
                      ? 'bg-slate-800 border-slate-700 text-white'
                      : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                >
                  <option value="">Semua Mapel</option>
                  {mapelList.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.nama_mapel}
                    </option>
                  ))}
                </select>
              </div>

              <div
                className={`border rounded-xl p-2 flex-1 flex flex-col overflow-hidden shadow-xs ${
                  isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-indigo-200'
                }`}
              >
                {loading ? (
                  <div
                    className={`py-6 text-center text-xs font-medium ${
                      isDarkMode ? 'text-slate-500' : 'text-slate-600'
                    }`}
                  >
                    Memuat riwayat...
                  </div>
                ) : filteredRekapList.length === 0 ? (
                  <div
                    className={`py-6 text-center text-xs font-medium ${
                      isDarkMode ? 'text-slate-500' : 'text-slate-600'
                    }`}
                  >
                    Tidak ada jadwal ditemukan.
                  </div>
                ) : (
                  <div className="flex-1 overflow-y-auto pr-1 space-y-1.5">
                    {filteredRekapList.map((item, index) => {
                      const namaKelas =
                        typeof item.kelas === 'object' ? item.kelas?.nama_kelas : item.kelas
                      const namaMapel =
                        typeof item.mapel === 'object' ? item.mapel?.nama_mapel : item.mapel
                      const sudahAbsen = isJadwalItemSudahAbsen(item)

                      return (
                        <div
                          key={item.id || index}
                          className={`p-2 rounded-lg border transition shadow-xs flex flex-col gap-1 ${
                            sudahAbsen
                              ? isDarkMode
                                ? 'bg-emerald-950/45 border-l-4 border-l-emerald-400 border-emerald-600/60'
                                : 'bg-emerald-50 border-l-4 border-l-emerald-600 border-emerald-300'
                              : isDarkMode
                              ? 'bg-slate-800/80 border-slate-700'
                              : 'bg-slate-50 border-slate-200'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-extrabold text-[10px] text-amber-500 uppercase px-1.5 py-0.2 rounded bg-amber-500/10 border border-amber-500/20">
                              #{index + 1} - {item.hari}
                            </span>

                            <div className="flex items-center gap-1.5">
                              {item.hari === selectedDateHariName &&
                                (sudahAbsen ? (
                                  <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-[9px] font-black">
                                    ✅ Terabsen ({tanggalCekAbsen})
                                  </span>
                                ) : (
                                  <span className="px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30 text-[9px] font-bold">
                                    ⏳ Belum Absen
                                  </span>
                                ))}

                              <span
                                className={`px-1.5 py-0.2 rounded text-[10px] font-black border ${
                                  isDarkMode
                                    ? 'bg-indigo-950 text-indigo-300 border-indigo-800'
                                    : 'bg-indigo-100 text-indigo-800 border-indigo-200'
                                }`}
                              >
                                {namaKelas || '-'}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center justify-between">
                            <h4
                              className={`font-extrabold text-[11px] ${
                                sudahAbsen
                                  ? isDarkMode
                                    ? 'text-emerald-300'
                                    : 'text-emerald-800'
                                  : isDarkMode
                                  ? 'text-indigo-300'
                                  : 'text-indigo-950'
                              }`}
                            >
                              {namaMapel || '-'}
                            </h4>
                            <span
                              className={`text-[10px] font-bold ${
                                isDarkMode ? 'text-slate-300' : 'text-slate-700'
                              }`}
                            >
                              ⏰ {item.jam}
                            </span>
                          </div>

                          <div className="flex items-center justify-between pt-1 border-t border-slate-700/20 text-[10px]">
                            <span
                              className={`font-semibold ${
                                isDarkMode ? 'text-slate-400' : 'text-slate-600'
                              }`}
                            >
                              <UserRound className="w-4 h-4 inline-block align-middle" /> {getGuruDisplayName(item.guru_email)}
                            </span>
                            {isJadwalManager && (
                              <button
                                onClick={() => handleDelete(item.id)}
                                className="text-rose-500 hover:text-rose-700 font-bold text-[10px] cursor-pointer print:hidden"
                              >
                                <Trash2 className="w-4 h-4" /> Hapus
                              </button>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </main>
      </div>

    </motion.div>
  )
}
