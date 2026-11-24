'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import PixelBatSwitcher from '@/app/components/PixelBatSwitcher'
import { canManageJadwal } from '@/lib/jadwalAccess'
import { SMK_COLORS, useSmkColor } from '../smkTheme'
import {
  ArrowLeft,
  CalendarDays,
  Clock,
  Plus,
  Pencil,
  Trash2,
  Save,
  X,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  UserCheck,
  LayoutGrid,
  List,
  Sparkles,
  BookOpen,
  GraduationCap,
  Star,
  CopyPlus,
} from 'lucide-react'

const HARI_AKTIF = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Sabtu', 'Minggu'] as const
type HariAktifType = (typeof HARI_AKTIF)[number]

// Periode Akademik (Tahun Ajaran & Semester)
const TAHUN_AJARAN_LIST = ['2026/2027', '2027/2028']
const SEMESTER_LIST = ['Ganjil', 'Genap'] as const
type SemesterType = (typeof SEMESTER_LIST)[number]

interface KelasSmk {
  id: number
  nama_kelas: string
  tingkat: string | null
  jurusan: string | null
}

interface MapelSmk {
  id: number
  kode_mapel: string | null
  nama_mapel: string
  tingkat: string | null
  jumlah_jp: number | null
}

interface GuruRow {
  id: number
  nama_lengkap: string
  email: string | null
  role: string | null
  unit_mengajar: string | null
}

interface GuruMapelRow {
  id: number
  guru_id: number
  mapel_id: number
}

interface MasterJamRow {
  id: number
  hari: string | null
  jam_ke: number
  waktu_mulai: string | null
  waktu_selesai: string | null
  keterangan: string | null
  jenjang: string | null
}

interface JadwalRow {
  id: number
  hari: string
  jam: string | null
  kelas: string | null
  mapel: string | null
  guru_email: string | null
  mapel_id: number | null
  kelas_id: number | null
  jam_ke: number
  jenjang: string | null
  semester?: string | null
  tahun_ajaran?: string | null
}

interface JurnalHariIniRow {
  id: number
  kelas_id: number | null
  mapel_id: number | null
  jam_ke: number | null
  guru_email: string | null
}

interface GroupedJadwalCard {
  key: string
  hari: string
  jamStart: number
  jamEnd: number
  mapelId: number | null
  mapelName: string
  guruEmail: string
  kelasList: { id: number | null; name: string }[]
  rawRows: JadwalRow[]
  customJam: string | null
}

function parseSupabaseError(err: unknown, fallback: string): string {
  if (!err) return fallback
  if (typeof err === 'string') return err
  if (typeof err === 'object') {
    const e = err as { message?: string; details?: string }
    if (e.message && e.details) return `${e.message} (${e.details})`
    if (e.message) return e.message
  }
  return fallback
}

function getInitialDayInfo(): { day: HariAktifType; isFridayHoliday: boolean } {
  const jsDay = new Date().getDay()
  if (jsDay === 5) {
    return { day: 'Sabtu', isFridayHoliday: true }
  }
  const mapDay: Record<number, HariAktifType> = {
    0: 'Minggu',
    1: 'Senin',
    2: 'Selasa',
    3: 'Rabu',
    4: 'Kamis',
    6: 'Sabtu',
  }
  return { day: mapDay[jsDay] || 'Senin', isFridayHoliday: false }
}

function getTodayIsoDate(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export default function SmkJadwalPage() {
  const router = useRouter()
  const { color: activeSmkColor } = useSmkColor()

  // Auth & Role
  const [authChecking, setAuthChecking] = useState(true)
  const [userEmail, setUserEmail] = useState('')
  const [userName, setUserName] = useState('')
  const [isOperator, setIsOperator] = useState(false)
  const [isJadwalManager, setIsJadwalManager] = useState(false)

  // Hari & Filter UI (Inisialisasi statis aman untuk Next.js build, di-update di client via useEffect)
  const [todayDayName, setTodayDayName] = useState<HariAktifType>('Senin')
  const [selectedHari, setSelectedHari] = useState<HariAktifType>('Senin')
  const [isFridayToday, setIsFridayToday] = useState<boolean>(false)
  const [selectedKelasFilter, setSelectedKelasFilter] = useState<string>('ALL')
  const [scopeMode, setScopeMode] = useState<'ALL' | 'MINE'>('ALL')
  const [viewMode, setViewMode] = useState<'LIST' | 'MATRIX'>('LIST')

  // Data Master & Jadwal
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [toastMsg, setToastMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  const [listKelas, setListKelas] = useState<KelasSmk[]>([])
  const [listMapel, setListMapel] = useState<MapelSmk[]>([])
  const [listGuru, setListGuru] = useState<GuruRow[]>([])
  const [listGuruMapel, setListGuruMapel] = useState<GuruMapelRow[]>([])
  const [listMasterJam, setListMasterJam] = useState<MasterJamRow[]>([])
  const [listJadwalSmk, setListJadwalSmk] = useState<JadwalRow[]>([])
  const [listJadwalSmp, setListJadwalSmp] = useState<JadwalRow[]>([])
  const [jurnalHariIni, setJurnalHariIni] = useState<JurnalHariIniRow[]>([])

  // Periode Akademik Aktif (Tahun Ajaran & Semester)
  const [selectedSemester, setSelectedSemester] = useState<SemesterType>('Ganjil')
  const [selectedTahunAjaran, setSelectedTahunAjaran] = useState('2026/2027')
  const [copyingPrevSemester, setCopyingPrevSemester] = useState(false)

  // State Form Tambah / Edit (Khusus Operator)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingRowIds, setEditingRowIds] = useState<number[]>([])
  const [formHari, setFormHari] = useState<HariAktifType>('Senin')
  const [formJamMulai, setFormJamMulai] = useState<string>('1')
  const [formJamSampai, setFormJamSampai] = useState<string>('1')
  const [formKelasId, setFormKelasId] = useState<string>('')
  const [formGuruEmail, setFormGuruEmail] = useState<string>('')
  const [formMapelId, setFormMapelId] = useState<string>('')
  const [formJamCustom, setFormJamCustom] = useState<string>('')

  const showToast = useCallback((type: 'ok' | 'err', text: string) => {
    setToastMsg({ type, text })
    setTimeout(() => setToastMsg(null), 4500)
  }, [])

  // 0. Deteksi Hari Lokal Hanya di Browser Client (Mencegah Error Prerender Next.js)
  //    Ditunda lewat requestAnimationFrame agar setState tidak dipanggil sinkron di dalam
  //    body effect (aturan react-hooks/set-state-in-effect) sekaligus tetap aman dari
  //    hydration mismatch karena hanya berjalan setelah mount/hidrasi di sisi browser.
  useEffect(() => {
    const info = getInitialDayInfo()
    const frameId = requestAnimationFrame(() => {
      setTodayDayName(info.day)
      setSelectedHari(info.day)
      setFormHari(info.day)
      setIsFridayToday(info.isFridayHoliday)
    })
    return () => cancelAnimationFrame(frameId)
  }, [])

  // 1. Cek Sesi & Peran Pengguna (Operator vs Guru)
  useEffect(() => {
    let active = true
    const checkSession = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession()

        if (!session || !session.user?.email) {
          router.replace('/login')
          return
        }

        const email = session.user.email.trim().toLowerCase()
        const { data: guruRow } = await supabase
          .from('guru')
          .select('nama_lengkap, role')
          .ilike('email', email)
          .maybeSingle()

        if (active) {
          const op = (guruRow?.role || '').toLowerCase() === 'operator'
          setUserEmail(email)
          setUserName(guruRow?.nama_lengkap || email)
          setIsOperator(op)
          setIsJadwalManager(canManageJadwal(op, email))
          if (!op && !canManageJadwal(op, email)) {
            setScopeMode('MINE')
          }
          setAuthChecking(false)
        }
      } catch {
        if (active) {
          router.replace('/login')
        }
      }
    }
    checkSession()
    return () => {
      active = false
    }
  }, [router])

  // 2. Muat Seluruh Data Jadwal & Referensi SMK
  const fetchAllData = useCallback(async () => {
    setLoading(true)
    try {
      const todayIso = getTodayIsoDate()

      const [
        resKelas,
        resMapel,
        resGuru,
        resGuruMapel,
        resMasterJam,
        resJadwalAll,
        resJurnalToday,
      ] = await Promise.all([
        supabase
          .from('kelas')
          .select('id, nama_kelas, tingkat, jurusan')
          .eq('jenjang', 'SMK')
          .order('nama_kelas', { ascending: true }),
        supabase
          .from('mapel')
          .select('id, kode_mapel, nama_mapel, tingkat, jumlah_jp')
          .eq('jenjang', 'SMK')
          .order('urutan', { ascending: true }),
        supabase
          .from('guru')
          .select('id, nama_lengkap, email, role, unit_mengajar')
          .order('nama_lengkap', { ascending: true }),
        supabase.from('guru_mapel').select('id, guru_id, mapel_id'),
        supabase
          .from('master_jam')
          .select('id, hari, jam_ke, waktu_mulai, waktu_selesai, keterangan, jenjang')
          .order('jam_ke', { ascending: true }),
        supabase
          .from('jadwal')
          .select('id, hari, jam, kelas, mapel, guru_email, mapel_id, kelas_id, jam_ke, jenjang, semester, tahun_ajaran')
          .eq('semester', selectedSemester)
          .eq('tahun_ajaran', selectedTahunAjaran)
          .order('jam_ke', { ascending: true }),
        supabase
          .from('jurnal_agenda')
          .select('id, kelas_id, mapel_id, jam_ke, guru_email')
          .eq('jenjang', 'SMK')
          .eq('tanggal', todayIso),
      ])

      if (resKelas.error) throw resKelas.error
      if (resMapel.error) throw resMapel.error
      if (resGuru.error) throw resGuru.error
      if (resJadwalAll.error) throw resJadwalAll.error

      const kelasData = (resKelas.data || []).map((k) => ({
        ...k,
        id: Number(k.id),
      }))
      setListKelas(kelasData)
      if (kelasData.length > 0) {
        setFormKelasId((prev) =>
          prev === 'ALL_CLASSES' || (prev && kelasData.some((k) => String(k.id) === prev))
            ? prev
            : String(kelasData[0].id)
        )
      }

      setListMapel(
        (resMapel.data || []).map((m) => ({
          ...m,
          id: Number(m.id),
        }))
      )
      setListGuru(resGuru.data || [])
      setListGuruMapel(resGuruMapel.data || [])
      setListMasterJam(
        (resMasterJam.data || []).map((mj) => ({
          ...mj,
          jam_ke: Number(mj.jam_ke),
        }))
      )

      const allJadwal = (resJadwalAll.data || []).map((j) => ({
        ...j,
        id: Number(j.id),
        jam_ke: Number(j.jam_ke) || 1,
        kelas_id: j.kelas_id !== null && j.kelas_id !== undefined ? Number(j.kelas_id) : null,
        mapel_id: j.mapel_id !== null && j.mapel_id !== undefined ? Number(j.mapel_id) : null,
      }))
      const smkOnly = allJadwal.filter((j) => (j.jenjang || '').toUpperCase() === 'SMK')
      const smpOnly = allJadwal.filter((j) => (j.jenjang || '').toUpperCase() !== 'SMK')
      setListJadwalSmk(smkOnly)
      setListJadwalSmp(smpOnly)

      setJurnalHariIni(resJurnalToday.data || [])
    } catch (err) {
      console.error('Gagal memuat jadwal SMK:', err)
      showToast('err', parseSupabaseError(err, 'Gagal memuat jadwal pelajaran SMK'))
    } finally {
      setLoading(false)
    }
  }, [showToast, selectedSemester, selectedTahunAjaran])

  useEffect(() => {
    if (!authChecking) {
      // Ditunda satu tick agar setState (mis. setLoading) tidak sinkron di badan effect.
      const timerId = setTimeout(() => fetchAllData(), 0)
      return () => clearTimeout(timerId)
    }
  }, [authChecking, fetchAllData])

  const guruSmkList = useMemo(() => {
    const filtered = listGuru.filter((g) =>
      (g.unit_mengajar || '').toUpperCase().includes('SMK')
    )
    return filtered.length > 0 ? filtered : listGuru
  }, [listGuru])

  const availableMapelForSelectedGuru = useMemo(() => {
    if (!formGuruEmail) return listMapel
    const guruObj = listGuru.find(
      (g) => (g.email || '').toLowerCase() === formGuruEmail.toLowerCase()
    )
    if (!guruObj) return listMapel

    const mappedIds = listGuruMapel
      .filter((gm) => Number(gm.guru_id) === Number(guruObj.id))
      .map((gm) => Number(gm.mapel_id))

    if (mappedIds.length === 0) return listMapel
    const filtered = listMapel.filter((m) => mappedIds.includes(Number(m.id)))
    return filtered.length > 0 ? filtered : listMapel
  }, [formGuruEmail, listGuru, listGuruMapel, listMapel])

  const getTimeSlotLabel = useCallback(
    (hari: string, jamKe: number): string | null => {
      const smkJam = listMasterJam.find(
        (mj) =>
          (mj.jenjang || '').toUpperCase() === 'SMK' &&
          Number(mj.jam_ke) === Number(jamKe) &&
          (!mj.hari || mj.hari.toLowerCase() === hari.toLowerCase())
      )
      if (smkJam?.waktu_mulai && smkJam?.waktu_selesai) {
        return `${smkJam.waktu_mulai.slice(0, 5)} - ${smkJam.waktu_selesai.slice(0, 5)}`
      }
      return null
    },
    [listMasterJam]
  )

  const jadwalOnSelectedHari = useMemo(() => {
    return listJadwalSmk.filter(
      (j) => (j.hari || '').trim().toLowerCase() === selectedHari.toLowerCase()
    )
  }, [listJadwalSmk, selectedHari])

  const maxJpOnSelectedHari = useMemo(() => {
    if (jadwalOnSelectedHari.length === 0) return 0
    const highest = Math.max(...jadwalOnSelectedHari.map((j) => Number(j.jam_ke) || 1))
    return Math.min(Math.max(highest, 1), 8)
  }, [jadwalOnSelectedHari])

  const dynamicJamSlots = useMemo(() => {
    return Array.from({ length: maxJpOnSelectedHari }, (_, idx) => idx + 1)
  }, [maxJpOnSelectedHari])

  const displayedJadwal = useMemo(() => {
    return jadwalOnSelectedHari
      .filter((j) => {
        if (selectedKelasFilter !== 'ALL' && String(j.kelas_id) !== selectedKelasFilter) {
          return false
        }
        if (scopeMode === 'MINE' && userEmail) {
          return (j.guru_email || '').trim().toLowerCase() === userEmail.toLowerCase()
        }
        return true
      })
      .sort((a, b) => {
        if (Number(a.jam_ke) !== Number(b.jam_ke)) return Number(a.jam_ke) - Number(b.jam_ke)
        return (a.kelas || '').localeCompare(b.kelas || '')
      })
  }, [jadwalOnSelectedHari, selectedKelasFilter, scopeMode, userEmail])

  // =========================================================================
  // PENGGABUNGAN OTOMATIS SLOT BERURUTAN & KELAS GABUNGAN (MISAL JP 1-3 SEMUA KELAS)
  // =========================================================================
  const groupedJadwalList = useMemo<GroupedJadwalCard[]>(() => {
    if (displayedJadwal.length === 0) return []

    type Step1Slot = {
      jam_ke: number
      mapelId: number | null
      mapelName: string
      guruEmail: string
      kelasList: { id: number | null; name: string }[]
      rawRows: JadwalRow[]
      customJam: string | null
    }

    const byJamMapelGuru = new Map<string, Step1Slot>()
    for (const row of displayedJadwal) {
      const jamNum = Number(row.jam_ke) || 1
      const mapelClean = (row.mapel || 'Mata Pelajaran').trim()
      const guruClean = (row.guru_email || '').trim().toLowerCase()
      const mKey = `${jamNum}::${mapelClean.toLowerCase()}::${guruClean}`

      const existing = byJamMapelGuru.get(mKey)
      if (existing) {
        if (
          !existing.kelasList.some(
            (k) => Number(k.id) === Number(row.kelas_id) && k.name === (row.kelas || '')
          )
        ) {
          existing.kelasList.push({ id: row.kelas_id, name: row.kelas || 'Kelas' })
        }
        existing.rawRows.push(row)
      } else {
        byJamMapelGuru.set(mKey, {
          jam_ke: jamNum,
          mapelId: row.mapel_id,
          mapelName: mapelClean,
          guruEmail: guruClean,
          kelasList: [{ id: row.kelas_id, name: row.kelas || 'Kelas' }],
          rawRows: [row],
          customJam: row.jam,
        })
      }
    }

    const step1Sorted = Array.from(byJamMapelGuru.values()).sort(
      (a, b) => Number(a.jam_ke) - Number(b.jam_ke)
    )
    const mergedCards: GroupedJadwalCard[] = []

    for (const slot of step1Sorted) {
      const kelasSig = slot.kelasList
        .map((k) => `${k.id ?? ''}:${k.name.trim()}`)
        .sort()
        .join('|')

      const prevCard = mergedCards.find(
        (c) =>
          c.mapelName.toLowerCase() === slot.mapelName.toLowerCase() &&
          c.guruEmail === slot.guruEmail &&
          Number(c.jamEnd) + 1 === Number(slot.jam_ke) &&
          c.kelasList
            .map((k) => `${k.id ?? ''}:${k.name.trim()}`)
            .sort()
            .join('|') === kelasSig
      )

      if (prevCard) {
        prevCard.jamEnd = Number(slot.jam_ke)
        prevCard.rawRows.push(...slot.rawRows)
      } else {
        mergedCards.push({
          key: `${slot.jam_ke}-${slot.mapelName}-${slot.guruEmail}-${kelasSig}`,
          hari: selectedHari,
          jamStart: Number(slot.jam_ke),
          jamEnd: Number(slot.jam_ke),
          mapelId: slot.mapelId,
          mapelName: slot.mapelName,
          guruEmail: slot.guruEmail,
          kelasList: slot.kelasList,
          rawRows: [...slot.rawRows],
          customJam: slot.customJam,
        })
      }
    }

    return mergedCards.sort((a, b) => a.jamStart - b.jamStart)
  }, [displayedJadwal, selectedHari])

  // =========================================================================
  // KALKULASI PRESISI ARAH LAMPU SOROT FRESNEL KE KAPSUL HARI TERPILIH
  // =========================================================================
  const activeDayIndex = Math.max(0, HARI_AKTIF.indexOf(selectedHari))
  const spotlightPercent = ((activeDayIndex + 0.5) / HARI_AKTIF.length) * 100
  const spotlightAngle = useMemo(() => {
    const dxPercent = spotlightPercent - 50
    const aspectRatioFactor = 2.8
    const rad = Math.atan2(dxPercent * aspectRatioFactor, 100)
    const deg = -(rad * 180) / Math.PI
    return Number(deg.toFixed(2))
  }, [spotlightPercent])

  // =========================================================================
  // HANDLER KHUSUS OPERATOR
  // =========================================================================
  const openCreateForm = (presetJamKe?: number, presetKelasId?: number) => {
    if (!isJadwalManager) return
    const startJp = String(presetJamKe || 1)
    setEditingRowIds([])
    setFormHari(selectedHari)
    setFormJamMulai(startJp)
    setFormJamSampai(startJp)
    setFormKelasId(
      presetKelasId
        ? String(presetKelasId)
        : selectedKelasFilter !== 'ALL'
          ? selectedKelasFilter
          : listKelas[0]?.id
            ? String(listKelas[0].id)
            : ''
    )
    const defaultGuru = guruSmkList[0]?.email || ''
    setFormGuruEmail(defaultGuru)
    setFormMapelId('')
    setFormJamCustom('')
    setIsFormOpen(true)
  }

  const openEditSingleRow = (item: JadwalRow) => {
    if (!isJadwalManager) return
    setEditingRowIds([Number(item.id)])
    const validHari = HARI_AKTIF.find(
      (h) => h.toLowerCase() === (item.hari || '').toLowerCase()
    )
    const jpStr = String(item.jam_ke || 1)
    setFormHari(validHari || selectedHari)
    setFormJamMulai(jpStr)
    setFormJamSampai(jpStr)
    setFormKelasId(item.kelas_id ? String(item.kelas_id) : '')
    setFormGuruEmail((item.guru_email || '').toLowerCase())
    setFormMapelId(item.mapel_id ? String(item.mapel_id) : '')
    setFormJamCustom(item.jam || '')
    setIsFormOpen(true)
  }

  const openEditGroup = (group: GroupedJadwalCard) => {
    if (!isJadwalManager) return
    const rowIds = group.rawRows.map((r) => Number(r.id))
    setEditingRowIds(rowIds)
    const validHari = HARI_AKTIF.find(
      (h) => h.toLowerCase() === (group.hari || '').toLowerCase()
    )
    setFormHari(validHari || selectedHari)
    setFormJamMulai(String(group.jamStart))
    setFormJamSampai(String(group.jamEnd))

    const isAllClassesGroup =
      listKelas.length > 1 && group.kelasList.length >= listKelas.length
    setFormKelasId(
      isAllClassesGroup
        ? 'ALL_CLASSES'
        : group.kelasList[0]?.id
          ? String(group.kelasList[0].id)
          : ''
    )
    setFormGuruEmail(group.guruEmail)
    setFormMapelId(group.mapelId ? String(group.mapelId) : '')
    setFormJamCustom(group.customJam || '')
    setIsFormOpen(true)
  }

  const handleSaveJadwal = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isJadwalManager) return

    const jamStart = Number(formJamMulai)
    const jamEnd = Number(formJamSampai)
    const isAllClasses = formKelasId === 'ALL_CLASSES'
    const mapelIdNum = Number(formMapelId)
    const cleanEmail = formGuruEmail.trim().toLowerCase()

    const targetClasses: KelasSmk[] = isAllClasses
      ? listKelas
      : listKelas.filter((k) => String(k.id) === formKelasId)

    if (
      targetClasses.length === 0 ||
      !mapelIdNum ||
      !cleanEmail ||
      jamStart < 1 ||
      jamStart > 8 ||
      jamEnd < jamStart ||
      jamEnd > 8
    ) {
      showToast('err', 'Periksa kembali Hari, Rentang Jam Ke (1–8), Kelas DKV, Guru, dan Mapel')
      return
    }

    const targetJamList: number[] = []
    for (let jp = jamStart; jp <= jamEnd; jp++) {
      targetJamList.push(jp)
    }

    const editingSet = new Set(editingRowIds.map((id) => Number(id)))

    for (const jp of targetJamList) {
      for (const kelasTarget of targetClasses) {
        const classConflict = listJadwalSmk.find(
          (j) =>
            !editingSet.has(Number(j.id)) &&
            j.hari.toLowerCase() === formHari.toLowerCase() &&
            Number(j.jam_ke) === jp &&
            Number(j.kelas_id) === Number(kelasTarget.id)
        )
        if (classConflict) {
          showToast(
            'err',
            `Bentrok Kelas! ${kelasTarget.nama_kelas} sudah ada mapel ${classConflict.mapel || ''} di ${formHari} Jam Ke-${jp}`
          )
          return
        }
      }

      const teacherSmkConflict = listJadwalSmk.find(
        (j) =>
          !editingSet.has(Number(j.id)) &&
          j.hari.toLowerCase() === formHari.toLowerCase() &&
          Number(j.jam_ke) === jp &&
          (j.guru_email || '').toLowerCase() === cleanEmail
      )
      if (teacherSmkConflict) {
        showToast(
          'err',
          `Bentrok Guru! Guru tersebut sudah mengajar di kelas ${teacherSmkConflict.kelas || 'SMK'} pada ${formHari} Jam Ke-${jp}`
        )
        return
      }

      const teacherSmpConflict = listJadwalSmp.find(
        (j) =>
          j.hari.toLowerCase() === formHari.toLowerCase() &&
          Number(j.jam_ke) === jp &&
          (j.guru_email || '').toLowerCase() === cleanEmail
      )
      if (teacherSmpConflict) {
        showToast(
          'err',
          `Bentrok Lintas Unit! Guru tersebut sedang mengajar di SMP (${teacherSmpConflict.kelas || 'SMP'}) pada ${formHari} Jam Ke-${jp}`
        )
        return
      }
    }

    const mapelObj = listMapel.find((m) => Number(m.id) === mapelIdNum)

    setSaving(true)
    try {
      if (editingRowIds.length > 0) {
        const { error: delErr } = await supabase
          .from('jadwal')
          .delete()
          .in('id', editingRowIds)
        if (delErr) throw delErr
      }

      const rowsToInsert = targetJamList.flatMap((jp) => {
        const autoTime = getTimeSlotLabel(formHari, jp)
        const finalJamText = formJamCustom.trim() || autoTime || `Jam Ke-${jp}`
        return targetClasses.map((kelasTarget) => ({
          hari: formHari,
          jam_ke: jp,
          jam: finalJamText,
          kelas_id: Number(kelasTarget.id),
          kelas: kelasTarget.nama_kelas,
          mapel_id: mapelIdNum,
          mapel: mapelObj?.nama_mapel || null,
          guru_email: cleanEmail,
          jenjang: 'SMK',
          semester: selectedSemester,
          tahun_ajaran: selectedTahunAjaran,
        }))
      })

      const { error } = await supabase.from('jadwal').insert(rowsToInsert)
      if (error) throw error

      const labelRange =
        jamStart === jamEnd
          ? `Jam Ke-${jamStart}`
          : `Jam Ke-${jamStart} s/d Jam Ke-${jamEnd}`
      const labelKelas = isAllClasses ? 'Semua Kelas' : targetClasses[0].nama_kelas
      showToast(
        'ok',
        editingRowIds.length > 0
          ? `Jadwal ${formHari} (${labelRange} • ${labelKelas}) berhasil diperbarui!`
          : `Jadwal ${formHari} (${labelRange} • ${labelKelas}) berhasil ditambahkan!`
      )

      setSelectedHari(formHari)
      setIsFormOpen(false)
      setEditingRowIds([])
      await fetchAllData()
    } catch (err) {
      showToast('err', parseSupabaseError(err, 'Gagal menyimpan jadwal SMK'))
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteGroup = async (group: GroupedJadwalCard) => {
    if (!isJadwalManager) return
    const jpText =
      group.jamStart === group.jamEnd
        ? `Jam Ke-${group.jamStart}`
        : `Jam Ke-${group.jamStart}–${group.jamEnd}`
    const kelasText = group.kelasList.map((k) => k.name).join(', ')

    if (!confirm(`Hapus jadwal ${group.mapelName} (${kelasText}) pada ${group.hari} ${jpText}?`)) {
      return
    }

    const ids = group.rawRows.map((r) => Number(r.id))
    const { error } = await supabase.from('jadwal').delete().in('id', ids)
    if (error) {
      showToast('err', parseSupabaseError(error, 'Gagal menghapus jadwal'))
    } else {
      showToast('ok', 'Blok jadwal berhasil dihapus')
      await fetchAllData()
    }
  }

  const handleDeleteSingleRow = async (item: JadwalRow) => {
    if (!isJadwalManager) return
    if (
      !confirm(
        `Hapus jadwal ${item.mapel || 'Mapel'} (${item.kelas || 'Kelas'}) pada ${item.hari} Jam Ke-${item.jam_ke}?`
      )
    ) {
      return
    }

    const { error } = await supabase.from('jadwal').delete().eq('id', Number(item.id))
    if (error) {
      showToast('err', parseSupabaseError(error, 'Gagal menghapus jadwal'))
    } else {
      showToast('ok', 'Slot jadwal berhasil dihapus')
      await fetchAllData()
    }
  }

  // Periode akademik kosong? Sediakan tombol salin dari semester sebelumnya.
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
  const isPrevSemesterEmpty = listJadwalSmk.length === 0

  // Salin seluruh jadwal SMK dari periode (semester) sebelumnya ke periode aktif
  const handleSalinJadwalSebelumnya = async () => {
    if (!isJadwalManager || !prevPeriode || isPrevSemesterEmpty) return
    if (
      !confirm(
        `Salin seluruh jadwal SMK dari Semester ${prevPeriode.semester} ${prevPeriode.tahun} ke Semester ${selectedSemester} ${selectedTahunAjaran}?`
      )
    ) {
      return
    }
    setCopyingPrevSemester(true)
    try {
      const { data, error } = await supabase
        .from('jadwal')
        .select('hari, jam, jam_ke, kelas_id, mapel_id, guru_email, kelas, mapel, jenjang')
        .eq('semester', prevPeriode.semester)
        .eq('tahun_ajaran', prevPeriode.tahun)
        .eq('jenjang', 'SMK')
      if (error) throw error

      const sourceRows = data || []
      if (sourceRows.length === 0) {
        showToast('err', 'Tidak ada jadwal SMK pada periode sebelumnya untuk disalin.')
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
        jenjang: 'SMK',
        semester: selectedSemester,
        tahun_ajaran: selectedTahunAjaran,
      }))

      const { error: insErr } = await supabase.from('jadwal').insert(rowsToInsert)
      if (insErr) throw insErr

      showToast(
        'ok',
        `Berhasil menyalin ${rowsToInsert.length} jadwal SMK dari Semester ${prevPeriode.semester} ${prevPeriode.tahun}.`
      )
      await fetchAllData()
    } catch (err) {
      showToast('err', parseSupabaseError(err, 'Gagal menyalin jadwal SMK'))
    } finally {
      setCopyingPrevSemester(false)
    }
  }

  if (authChecking) {
    return (
      <div className="h-dvh bg-[#07090e] text-amber-300 flex flex-col items-center justify-center gap-2">
        <Loader2 className="w-7 h-7 animate-spin" />
        <p className="text-xs font-semibold text-slate-400">Menyiapkan Studio Jadwal SMK...</p>
      </div>
    )
  }

  const isSelectedHariToday =
    !isFridayToday && selectedHari.toLowerCase() === todayDayName.toLowerCase()

  return (
    <div className="h-dvh max-h-dvh overflow-hidden bg-[#07090e] text-slate-100 flex flex-col relative selection:bg-amber-400/30">
      <style jsx global>{`
        @keyframes dustFloat {
          0%,
          100% {
            transform: translateY(0px) translateX(0px);
            opacity: 0.35;
          }
          50% {
            transform: translateY(-6px) translateX(3px);
            opacity: 0.85;
          }
        }
        .studio-dust-1 {
          animation: dustFloat 3.6s ease-in-out infinite;
        }
        .studio-dust-2 {
          animation: dustFloat 4.4s ease-in-out 0.8s infinite;
        }
        .studio-dust-3 {
          animation: dustFloat 3.9s ease-in-out 1.5s infinite;
        }
        .studio-scroll::-webkit-scrollbar {
          width: 5px;
          height: 5px;
        }
        .studio-scroll::-webkit-scrollbar-thumb {
          background: rgba(251, 191, 36, 0.25);
          border-radius: 9999px;
        }
      `}</style>

      {/* Notifikasi Toast */}
      {toastMsg && (
        <div
          className={`fixed top-14 left-1/2 -translate-x-1/2 z-50 max-w-[92vw] px-4 py-2.5 rounded-2xl text-xs font-bold shadow-2xl border flex items-center gap-2 backdrop-blur-md ${
            toastMsg.type === 'ok'
              ? 'bg-emerald-950/95 border-emerald-500/50 text-emerald-200'
              : 'bg-rose-950/95 border-rose-500/50 text-rose-200'
          }`}
        >
          {toastMsg.type === 'ok' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
          ) : (
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
          )}
          <span className="break-words">{toastMsg.text}</span>
        </div>
      )}

      {/* =====================================================================
          1. TOP BAR COMPACT (TERKUNCI DI ATAS)
         ===================================================================== */}
      <header
        className="shrink-0 z-30 bg-[#090c13]/95 backdrop-blur-md border-b border-white/10 px-3 py-2.5"
        style={{ borderBottomColor: `rgba(${SMK_COLORS[activeSmkColor].rgb}, 0.35)` }}
      >
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <Link
              href="/smk"
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 transition shrink-0"
              title="Kembali ke Dashboard SMK"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h1 className="text-xs sm:text-sm font-black tracking-tight text-white truncate">
                  JADWAL PELAJARAN SMK
                </h1>
                <span
                  className={`px-1.5 py-0.5 rounded text-[9px] font-black shrink-0 border ${
                    isOperator
                      ? 'bg-amber-400/15 border-amber-400/40 text-amber-300'
                      : 'bg-sky-400/15 border-sky-400/40 text-sky-300'
                  }`}
                >
                  {isOperator ? 'OPERATOR' : 'MODE GURU'}
                </span>
              </div>
              <p className="text-[10px] text-slate-400 truncate">
                SMK Muna Mustofa • DKV (Senin–Minggu, Libur Jumat)
              </p>
            </div>
          </div>

          {isJadwalManager ? (
            <button
              type="button"
              onClick={() => openCreateForm()}
              className="px-3 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-[0_0_20px_rgba(251,191,36,0.35)] transition active:scale-95 cursor-pointer shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Tambah Jadwal</span>
            </button>
          ) : (
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-[10px] text-slate-300 font-semibold">
              <UserCheck className="w-3 h-3 text-amber-300" />
              <span className="truncate max-w-[140px]">{userName}</span>
            </div>
          )}
        </div>
      </header>

      {/* BAR PERIODE AKADEMIK (Tahun Ajaran & Semester + Salin dari Semester Sebelumnya) */}
      <div className="shrink-0 z-20 bg-[#090c13]/90 border-b border-white/10 px-3 py-1.5">
        <div className="max-w-5xl mx-auto flex items-center gap-2 flex-wrap">
          <span className="flex items-center gap-1 text-[9px] uppercase font-black tracking-wider text-amber-300/90 shrink-0">
            <CalendarDays className="w-3.5 h-3.5" /> Periode:
          </span>
          <div className="flex items-center gap-1.5">
            <select
              value={selectedTahunAjaran}
              onChange={(e) => setSelectedTahunAjaran(e.target.value)}
              className="bg-black/50 border border-white/15 rounded-lg px-2 py-1 text-[10px] font-bold text-white focus:outline-none focus:border-amber-400 cursor-pointer"
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
              className="bg-black/50 border border-white/15 rounded-lg px-2 py-1 text-[10px] font-bold text-white focus:outline-none focus:border-amber-400 cursor-pointer"
            >
              {SEMESTER_LIST.map((s) => (
                <option key={s} value={s}>
                  Semester {s}
                </option>
              ))}
            </select>
          </div>
          {isJadwalManager && prevPeriode && isPrevSemesterEmpty && (
            <button
              type="button"
              onClick={handleSalinJadwalSebelumnya}
              disabled={copyingPrevSemester}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-400/15 hover:bg-amber-400/25 border border-amber-400/35 text-amber-200 text-[10px] font-black transition cursor-pointer disabled:opacity-50"
              title={`Salin jadwal dari Semester ${prevPeriode.semester} ${prevPeriode.tahun}`}
            >
              <CopyPlus className="w-3.5 h-3.5" />
              {copyingPrevSemester
                ? 'Menyalin...'
                : `Salin dari ${prevPeriode.semester} ${prevPeriode.tahun}`}
            </button>
          )}
          {!prevPeriode && isPrevSemesterEmpty && isJadwalManager && (
            <span className="text-[9px] text-slate-500 font-semibold">
              (Tidak ada periode sebelumnya untuk disalin)
            </span>
          )}
        </div>
      </div>

      {/* =====================================================================
          2. AREA UTAMA TERKUNCI (NO PAGE SCROLL -> KOLOM SCROLL INTERNAL DI BAWAH)
         ===================================================================== */}
      <div className="flex-1 min-h-0 max-w-5xl w-full mx-auto px-3 pt-2.5 pb-3 flex flex-col gap-2.5 overflow-hidden">
        {isFridayToday && (
          <div className="shrink-0 rounded-2xl bg-amber-400/10 border border-amber-400/35 px-3.5 py-2 flex items-center gap-2 text-[11px] text-amber-200">
            <Sparkles className="w-3.5 h-3.5 text-amber-300 shrink-0" />
            <span>
              Hari ini <strong>Jumat (Libur Sekolah)</strong>. Sorotan otomatis ke hari masuk
              berikutnya (<strong>Sabtu</strong>).
            </span>
          </div>
        )}

        {/* FRESNEL STUDIO SPOTLIGHT STAGE (COMPACT & FIXED DI ATAS) */}
        <section className="shrink-0 relative rounded-3xl bg-gradient-to-b from-[#131722] via-[#0c0f17] to-[#080a0f] border border-white/10 pt-3.5 pb-3 px-2.5 sm:px-5 overflow-hidden shadow-2xl">
          <div className="relative z-10 text-center">
            <p className="text-[9px] font-black uppercase tracking-[0.22em] text-amber-400/80">
              FRESNEL SCHEDULE STAGE • MAX 8 JP
            </p>
            <h2 className="text-base sm:text-lg font-black text-white tracking-tight flex items-center justify-center gap-2">
              <span>Hari {selectedHari}</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-400/15 border border-amber-400/35 text-amber-300">
                {maxJpOnSelectedHari > 0
                  ? `1 – ${maxJpOnSelectedHari} JP Aktif`
                  : 'Belum Ada Jadwal'}
              </span>
            </h2>
          </div>

          <div className="relative max-w-2xl mx-auto">
            <div
              className="pointer-events-none absolute top-10 w-44 h-32 rounded-full bg-amber-400/20 blur-2xl transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
              style={{
                left: `calc(${spotlightPercent}% - 5.5rem)`,
              }}
            />

            <div className="relative h-20 sm:h-24 w-full select-none pointer-events-none">
              <div className="absolute top-1.5 left-4 right-4 h-[2px] bg-gradient-to-r from-transparent via-slate-600/70 to-transparent" />

              <div
                className="absolute top-0.5 left-1/2 flex flex-col items-center transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
                style={{
                  transform: `translateX(-50%) rotate(${spotlightAngle}deg)`,
                  transformOrigin: '50% 6px',
                }}
              >
                <div className="w-2.5 h-1.5 bg-slate-500 rounded-t-sm" />
                <div className="w-9 h-6 rounded-md bg-gradient-to-b from-slate-700 via-slate-800 to-slate-950 border border-slate-500/60 shadow-lg flex flex-col items-center justify-between p-1 relative">
                  <div className="w-5 h-[1.5px] bg-slate-500/60 rounded-full" />
                  <div className="w-6 h-1.5 rounded-full bg-amber-200 shadow-[0_0_14px_#fbbf24]" />
                  <div className="absolute -bottom-1 -left-1.5 w-2.5 h-1 bg-slate-700 border border-slate-500/60 rotate-[28deg] rounded-xs" />
                  <div className="absolute -bottom-1 -right-1.5 w-2.5 h-1 bg-slate-700 border border-slate-500/60 -rotate-[28deg] rounded-xs" />
                </div>

                <div
                  className="w-36 sm:w-48 h-24 sm:h-28 -mt-0.5 opacity-95"
                  style={{
                    background:
                      'linear-gradient(180deg, rgba(251,191,36,0.48) 0%, rgba(251,191,36,0.18) 55%, rgba(251,191,36,0) 100%)',
                    clipPath: 'polygon(43% 0%, 57% 0%, 100% 100%, 0% 100%)',
                  }}
                />

                <span className="studio-dust-1 absolute top-11 left-1/2 -ml-3 w-1 h-1 rounded-full bg-amber-200/90 shadow-[0_0_6px_#fde68a]" />
                <span className="studio-dust-2 absolute top-16 left-1/2 ml-2.5 w-1 h-1 rounded-full bg-amber-100/80 shadow-[0_0_6px_#fde68a]" />
                <span className="studio-dust-3 absolute top-20 left-1/2 -ml-1 w-0.5 h-0.5 rounded-full bg-white/90" />
              </div>
            </div>

            <div className="relative z-10 grid grid-cols-6 gap-1 sm:gap-2 bg-black/55 p-1 rounded-2xl border border-white/10 backdrop-blur-md">
              {HARI_AKTIF.map((hari) => {
                const isSelected = selectedHari === hari
                const countInDay = listJadwalSmk.filter(
                  (j) => (j.hari || '').trim().toLowerCase() === hari.toLowerCase()
                ).length

                return (
                  <button
                    key={hari}
                    type="button"
                    onClick={() => setSelectedHari(hari)}
                    className={`relative py-1.5 px-1 rounded-xl flex flex-col items-center justify-center transition-all duration-300 cursor-pointer ${
                      isSelected
                        ? 'bg-gradient-to-b from-amber-300/25 to-amber-500/15 border border-amber-300/75 text-amber-100 shadow-[0_0_24px_rgba(251,191,36,0.5)] scale-[1.03]'
                        : 'border border-transparent text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'
                    }`}
                  >
                    {isSelected && (
                      <span className="pointer-events-none absolute -top-1 left-1/2 -translate-x-1/2 w-8 h-1 rounded-full bg-amber-200 shadow-[0_0_10px_#fbbf24]" />
                    )}
                    <span className="text-[11px] sm:text-xs font-black tracking-wide">
                      {hari.slice(0, 3)}
                      <span className="hidden sm:inline">{hari.slice(3)}</span>
                    </span>
                    <span
                      className={`text-[9px] font-bold ${
                        isSelected ? 'text-amber-300' : 'text-slate-500'
                      }`}
                    >
                      {countInDay} slot
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        </section>

        {/* BAR KONTROL FILTER (FIXED DI ATAS KOLOM SCROLL) */}
        <section className="shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-[#0c0f17] border border-white/10 rounded-2xl p-2">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 sm:pb-0">
            <button
              type="button"
              onClick={() => setSelectedKelasFilter('ALL')}
              className={`px-3 py-1 rounded-xl text-[11px] font-extrabold transition cursor-pointer shrink-0 ${
                selectedKelasFilter === 'ALL'
                  ? 'bg-amber-400 text-slate-950 shadow-sm'
                  : 'bg-white/5 text-slate-400 hover:text-white'
              }`}
            >
              Semua Kelas
            </button>
            {listKelas.map((k) => (
              <button
                key={k.id}
                type="button"
                onClick={() => setSelectedKelasFilter(String(k.id))}
                className={`px-3 py-1 rounded-xl text-[11px] font-extrabold transition cursor-pointer shrink-0 ${
                  selectedKelasFilter === String(k.id)
                    ? 'bg-amber-400 text-slate-950 shadow-sm'
                    : 'bg-white/5 text-slate-400 hover:text-white'
                }`}
              >
                {k.nama_kelas}
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between sm:justify-end gap-1.5">
            <div className="flex items-center bg-black/40 p-0.5 rounded-xl border border-white/10">
              <button
                type="button"
                onClick={() => setScopeMode('MINE')}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-black transition cursor-pointer ${
                  scopeMode === 'MINE'
                    ? 'bg-amber-400/20 text-amber-200 border border-amber-400/40'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Jadwal Saya
              </button>
              <button
                type="button"
                onClick={() => setScopeMode('ALL')}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-black transition cursor-pointer ${
                  scopeMode === 'ALL'
                    ? 'bg-amber-400/20 text-amber-200 border border-amber-400/40'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Semua Jadwal
              </button>
            </div>

            <div className="flex items-center bg-black/40 p-0.5 rounded-xl border border-white/10">
              <button
                type="button"
                onClick={() => setViewMode('LIST')}
                title="Tampilan Kartu Ringkas"
                className={`p-1.5 rounded-lg transition cursor-pointer ${
                  viewMode === 'LIST'
                    ? 'bg-amber-400 text-slate-950'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <List className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('MATRIX')}
                title="Tampilan Matriks Kelas"
                className={`p-1.5 rounded-lg transition cursor-pointer ${
                  viewMode === 'MATRIX'
                    ? 'bg-amber-400 text-slate-950'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </section>

        {/* ===================================================================
            3. KOLOM DALAM KOLOM (INTERNAL SCROLLABLE CONTAINER)
           =================================================================== */}
        <div className="flex-1 min-h-0 rounded-2xl bg-[#0b0e16]/90 border border-white/10 flex flex-col overflow-hidden shadow-xl">
          <div className="flex-1 min-h-0 overflow-y-auto studio-scroll p-3 pb-24 space-y-2.5">
            {loading ? (
              <div className="h-full flex flex-col items-center justify-center gap-2 text-slate-400 py-10">
                <Loader2 className="w-6 h-6 animate-spin text-amber-400" />
                <p className="text-xs font-semibold">Memuat jadwal hari {selectedHari}...</p>
              </div>
            ) : maxJpOnSelectedHari === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-amber-400/10 border border-amber-400/30 text-amber-300 flex items-center justify-center">
                  <CalendarDays className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white">
                    Belum Ada Jadwal pada Hari {selectedHari}
                  </h3>
                  <p className="text-xs text-slate-400 max-w-md mx-auto mt-1">
                    {isJadwalManager
                      ? `Klik tombol "Tambah Jadwal" untuk menyusun slot jam pelajaran (1–8 JP) di hari ${selectedHari}.`
                      : `Belum ada jadwal pelajaran SMK yang terdaftar untuk hari ${selectedHari}.`}
                  </p>
                </div>
                {isJadwalManager && (
                  <button
                    type="button"
                    onClick={() => openCreateForm(1)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs transition cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Susun Jadwal {selectedHari}</span>
                  </button>
                )}
              </div>
            ) : viewMode === 'LIST' ? (
              /* -------------------- MODE A: KARTU GABUNGAN RINGKAS -------------------- */
              groupedJadwalList.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400">
                  Tidak ada jadwal yang sesuai dengan filter{' '}
                  <strong className="text-amber-300">
                    {scopeMode === 'MINE' ? 'Jadwal Saya' : 'Kelas Terpilih'}
                  </strong>{' '}
                  pada hari {selectedHari}.
                </div>
              ) : (
                groupedJadwalList.map((group) => {
                  const guruObj = listGuru.find(
                    (g) => (g.email || '').trim().toLowerCase() === group.guruEmail
                  )
                  const isMine =
                    Boolean(userEmail) && group.guruEmail === userEmail.toLowerCase()

                  const isAllClassesCombined =
                    listKelas.length > 1 && group.kelasList.length >= listKelas.length

                  const kelasBadgeLabel = isAllClassesCombined
                    ? `Semua Kelas (${group.kelasList.map((k) => k.name).join(', ')})`
                    : group.kelasList.map((k) => k.name).join(', ')

                  const jpRangeLabel =
                    group.jamStart === group.jamEnd
                      ? `${group.jamStart}`
                      : `${group.jamStart}–${group.jamEnd}`

                  const totalJp = group.jamEnd - group.jamStart + 1

                  const isSudahAbsenToday =
                    isSelectedHariToday &&
                    group.rawRows.some((r) =>
                      jurnalHariIni.some(
                        (jr) =>
                          Number(jr.kelas_id) === Number(r.kelas_id) &&
                          (Number(jr.jam_ke) === Number(r.jam_ke) ||
                            Number(jr.mapel_id) === Number(r.mapel_id))
                      )
                    )

                  const timeStart = getTimeSlotLabel(group.hari, group.jamStart)
                  const timeEnd = getTimeSlotLabel(group.hari, group.jamEnd)
                  const combinedTimeLabel =
                    timeStart && timeEnd
                      ? `${timeStart.split(' - ')[0]} - ${timeEnd.split(' - ')[1]}`
                      : group.customJam && !group.customJam.startsWith('Jam Ke-')
                        ? group.customJam
                        : null

                  return (
                    <div
                      key={group.key}
                      className={`rounded-2xl border p-3.5 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                        isMine
                          ? 'bg-gradient-to-r from-amber-400/[0.09] via-[#10141f] to-[#0c0f17] border-amber-400/40 shadow-[0_0_24px_rgba(251,191,36,0.08)]'
                          : 'bg-[#0e121b] border-white/10 hover:border-white/20'
                      }`}
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <div
                          className={`min-w-[3.25rem] px-2 h-12 rounded-2xl flex flex-col items-center justify-center shrink-0 border ${
                            isMine
                              ? 'bg-amber-400 text-slate-950 border-amber-300 shadow-[0_0_15px_rgba(251,191,36,0.35)]'
                              : 'bg-white/[0.04] text-amber-300 border-white/10'
                          }`}
                        >
                          <span className="text-[9px] font-black uppercase leading-none opacity-80">
                            JP
                          </span>
                          <span className="text-base font-black leading-tight tracking-tight">
                            {jpRangeLabel}
                          </span>
                        </div>

                        <div className="min-w-0 space-y-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="px-2 py-0.5 rounded-md bg-amber-400/15 border border-amber-400/35 text-amber-300 text-[10px] font-black">
                              {kelasBadgeLabel}
                            </span>

                            <span className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-slate-300 text-[9px] font-bold">
                              {totalJp} JP
                            </span>

                            {combinedTimeLabel && (
                              <span className="inline-flex items-center gap-1 text-[10px] text-slate-400 font-semibold">
                                <Clock className="w-3 h-3 text-amber-400/70" />
                                {combinedTimeLabel}
                              </span>
                            )}

                            {isMine && (
                              <span className="px-1.5 py-0.5 rounded bg-sky-400/15 border border-sky-400/35 text-sky-300 text-[9px] font-black">
                                JADWAL ANDA
                              </span>
                            )}

                            {isSelectedHariToday && (
                              <span
                                className={`px-1.5 py-0.5 rounded text-[9px] font-black border ${
                                  isSudahAbsenToday
                                    ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                                    : 'bg-white/5 border-white/10 text-slate-400'
                                }`}
                              >
                                {isSudahAbsenToday ? 'Sudah Absen' : 'Belum Absen'}
                              </span>
                            )}
                          </div>

                          <h3 className="text-sm font-black text-white truncate flex items-center gap-1.5">
                            <BookOpen className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                            <span>{group.mapelName}</span>
                          </h3>

                          <p className="text-xs text-slate-400 truncate">
                            Pengampu:{' '}
                            <strong className="text-slate-200 font-semibold">
                              {guruObj?.nama_lengkap || group.guruEmail || '-'}
                            </strong>
                          </p>
                        </div>
                      </div>

                      {isJadwalManager && (
                        <div className="flex items-center justify-end gap-1.5 pt-2 sm:pt-0 border-t sm:border-t-0 border-white/5 shrink-0">
                          <button
                            type="button"
                            onClick={() => openEditGroup(group)}
                            className="px-2.5 py-1.5 rounded-xl bg-amber-400/10 hover:bg-amber-400/20 border border-amber-400/30 text-amber-300 text-[11px] font-bold flex items-center gap-1 transition cursor-pointer"
                            title="Edit Blok Jadwal"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                            <span>Edit</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteGroup(group)}
                            className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/25 text-rose-400 transition cursor-pointer"
                            title="Hapus Blok Jadwal"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })
              )
            ) : (
              /* -------------------- MODE B: MATRIKS KELAS DKV (FIXED MATCHING) -------------------- */
              <div className="rounded-xl border border-white/10 overflow-x-auto studio-scroll">
                <table className="w-full text-left border-collapse min-w-[540px]">
                  <thead>
                    <tr className="bg-black/50 border-b border-white/10 text-[11px] uppercase tracking-wider text-amber-300">
                      <th className="p-3 font-black w-24">Jam</th>
                      {listKelas
                        .filter(
                          (k) =>
                            selectedKelasFilter === 'ALL' || String(k.id) === selectedKelasFilter
                        )
                        .map((k) => (
                          <th key={k.id} className="p-3 font-black">
                            <div className="flex items-center gap-1.5">
                              <GraduationCap className="w-3.5 h-3.5 text-amber-400" />
                              <span>{k.nama_kelas}</span>
                            </div>
                          </th>
                        ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10 text-xs">
                    {dynamicJamSlots.map((jamKe) => {
                      const timeSlot = getTimeSlotLabel(selectedHari, jamKe)
                      return (
                        <tr key={jamKe} className="hover:bg-white/[0.02]">
                          <td className="p-3 align-top bg-black/25">
                            <span className="font-black text-amber-300 block">
                              Jam Ke-{jamKe}
                            </span>
                            {timeSlot && (
                              <span className="text-[10px] text-slate-400 block mt-0.5">
                                {timeSlot}
                              </span>
                            )}
                          </td>

                          {listKelas
                            .filter(
                              (k) =>
                                selectedKelasFilter === 'ALL' ||
                                String(k.id) === selectedKelasFilter
                            )
                            .map((k) => {
                              // Pencocokan presisi berdasarkan kelas_id (Number) atau nama_kelas
                              const cell = jadwalOnSelectedHari.find(
                                (j) =>
                                  Number(j.jam_ke) === Number(jamKe) &&
                                  (Number(j.kelas_id) === Number(k.id) ||
                                    (j.kelas || '').trim().toLowerCase() ===
                                      k.nama_kelas.trim().toLowerCase())
                              )
                              const guruObj = cell
                                ? listGuru.find(
                                    (g) =>
                                      (g.email || '').trim().toLowerCase() ===
                                      (cell.guru_email || '').trim().toLowerCase()
                                  )
                                : null
                              const isMine =
                                cell &&
                                Boolean(userEmail) &&
                                (cell.guru_email || '').trim().toLowerCase() ===
                                  userEmail.toLowerCase()

                              return (
                                <td key={k.id} className="p-2.5 align-top">
                                  {cell ? (
                                    <div
                                      className={`rounded-xl p-2.5 border space-y-1 ${
                                        isMine
                                          ? 'bg-amber-400/15 border-amber-400/50'
                                          : 'bg-white/[0.03] border-white/10'
                                      }`}
                                    >
                                      <div className="flex items-start justify-between gap-1.5">
                                        <p className="font-black text-white text-xs leading-snug">
                                          {cell.mapel}
                                        </p>
                                        {isJadwalManager && (
                                          <div className="flex items-center gap-0.5 shrink-0">
                                            <button
                                              type="button"
                                              onClick={() => openEditSingleRow(cell)}
                                              className="p-1 rounded hover:bg-amber-400/20 text-amber-300 cursor-pointer"
                                              title="Edit"
                                            >
                                              <Pencil className="w-3 h-3" />
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => handleDeleteSingleRow(cell)}
                                              className="p-1 rounded hover:bg-rose-500/20 text-rose-400 cursor-pointer"
                                              title="Hapus"
                                            >
                                              <Trash2 className="w-3 h-3" />
                                            </button>
                                          </div>
                                        )}
                                      </div>
                                      <p className="text-[10px] text-slate-400 truncate">
                                        {guruObj?.nama_lengkap || cell.guru_email || '-'}
                                      </p>
                                    </div>
                                  ) : isJadwalManager ? (
                                    <button
                                      type="button"
                                      onClick={() => openCreateForm(jamKe, k.id)}
                                      className="w-full py-3 rounded-xl border border-dashed border-white/10 hover:border-amber-400/40 text-[10px] font-bold text-slate-500 hover:text-amber-300 transition cursor-pointer"
                                    >
                                      + Isi Slot
                                    </button>
                                  ) : (
                                    <div className="py-2.5 px-2 text-[10px] text-slate-600 italic">
                                      —
                                    </div>
                                  )}
                                </td>
                              )
                            })}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* =====================================================================
          4. MODAL TAMBAH / EDIT JADWAL (DENGAN RENTANG JP & SEMUA KELAS)
         ===================================================================== */}
      {isJadwalManager && isFormOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <form
            onSubmit={handleSaveJadwal}
            className="w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl bg-[#10141f] border border-amber-400/35 p-4 sm:p-5 space-y-3.5 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
              <div>
                <h3 className="text-sm font-black text-white flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <span>
                    {editingRowIds.length > 0 ? 'Edit Jadwal Pelajaran SMK' : 'Tambah Jadwal SMK'}
                  </span>
                </h3>
                <p className="text-[10px] text-slate-400">
                  Otomatis berlabel <code className="text-amber-300">jenjang = &apos;SMK&apos;</code>{' '}
                  &amp; mengecek bentrok guru/kelas
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                Hari Aktif
              </label>
              <select
                value={formHari}
                onChange={(e) => setFormHari(e.target.value as HariAktifType)}
                className="w-full bg-black/50 border border-white/15 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
              >
                {HARI_AKTIF.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Dari Jam Ke-
                </label>
                <select
                  value={formJamMulai}
                  onChange={(e) => {
                    const val = e.target.value
                    setFormJamMulai(val)
                    if (Number(formJamSampai) < Number(val)) {
                      setFormJamSampai(val)
                    }
                  }}
                  className="w-full bg-black/50 border border-white/15 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((jp) => (
                    <option key={jp} value={jp}>
                      Jam Ke-{jp}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Sampai Jam Ke-
                </label>
                <select
                  value={formJamSampai}
                  onChange={(e) => setFormJamSampai(e.target.value)}
                  className="w-full bg-black/50 border border-white/15 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8]
                    .filter((jp) => jp >= Number(formJamMulai))
                    .map((jp) => (
                      <option key={jp} value={jp}>
                        Jam Ke-{jp}{' '}
                        {jp > Number(formJamMulai)
                          ? `(${jp - Number(formJamMulai) + 1} JP)`
                          : '(1 JP)'}
                      </option>
                    ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Kelas DKV
                </label>
                <select
                  required
                  value={formKelasId}
                  onChange={(e) => setFormKelasId(e.target.value)}
                  className="w-full bg-black/50 border border-white/15 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                >
                  <option value="">-- Pilih Kelas SMK --</option>
                  {listKelas.length > 0 && (
                    <option value="ALL_CLASSES">
                      <Star className="w-4 h-4" /> Semua Kelas ({listKelas.map((k) => k.nama_kelas).join(', ')})
                    </option>
                  )}
                  {listKelas.map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.nama_kelas}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Guru Pengampu SMK
                </label>
                <select
                  required
                  value={formGuruEmail}
                  onChange={(e) => {
                    setFormGuruEmail(e.target.value)
                    setFormMapelId('')
                  }}
                  className="w-full bg-black/50 border border-white/15 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                >
                  <option value="">-- Pilih Guru SMK --</option>
                  {guruSmkList.map((g) => (
                    <option key={g.id} value={(g.email || '').toLowerCase()}>
                      {g.nama_lengkap}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                Mata Pelajaran SMK
              </label>
              <select
                required
                value={formMapelId}
                onChange={(e) => setFormMapelId(e.target.value)}
                className="w-full bg-black/50 border border-white/15 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
              >
                <option value="">-- Pilih Mata Pelajaran --</option>
                {availableMapelForSelectedGuru.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.kode_mapel ? `[${m.kode_mapel}] ` : ''}
                    {m.nama_mapel}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                Keterangan Pukul / Waktu (Opsional)
              </label>
              <input
                type="text"
                value={formJamCustom}
                onChange={(e) => setFormJamCustom(e.target.value)}
                placeholder="Kosongkan jika jam belum baku (otomatis Jam Ke-X)"
                className="w-full bg-black/50 border border-white/15 rounded-xl px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-400"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-bold text-slate-300 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                <span>
                  {saving
                    ? 'Menyimpan...'
                    : editingRowIds.length > 0
                      ? 'Simpan Perubahan'
                      : 'Simpan Jadwal'}
                </span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Kelelawar Piksel di Pojok Kiri Bawah -> Kembali ke Dashboard SMP */}
      <PixelBatSwitcher isDarkMode={true} variant="floating" targetHref="/" />
    </div>
  )
}