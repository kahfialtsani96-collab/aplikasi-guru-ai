'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { motion } from 'framer-motion'
import { useAuthRole } from '@/hooks/useAuthRole'
import { useSmkColor, SMK_COLOR_KEYS, type SmkColorKey } from '../smkTheme'
import {
  QrCode,
  Sparkles,
  CheckCircle2,
  Save,
  Trash2,
  Camera,
  RotateCw,
  CalendarDays,
  Users,
  UserCheck,
  FileWarning,
  HeartPulse,
  UserX,
  ArrowLeft,
  LogOut,
  Zap,
  Search,
  SlidersHorizontal,
  GraduationCap,
  Lightbulb,
  X,
} from 'lucide-react'

const getSupabaseClient = () => {
  const url = (
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://kvrulbdvgxfrtmznpjnm.supabase.co'
  )
    .replace(/['"]/g, '')
    .trim()
  const key = (
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder'
  )
    .replace(/['"]/g, '')
    .trim()
  return createClient(url, key)
}

const supabase = getSupabaseClient()

interface KelasRef {
  id?: number | null
  nama_kelas?: string | null
  jenjang?: string | null
}
interface MapelRef {
  id?: number | null
  nama_mapel?: string | null
  kode_mapel?: string | null
  jenjang?: string | null
}
interface JadwalRowSmk {
  id: number
  hari?: string | null
  jam_ke?: number | null
  kelas_id?: number | null
  mapel_id?: number | null
  guru_email?: string | null
  jenjang?: string | null
  kelas?: KelasRef | KelasRef[] | null
  mapel?: MapelRef | MapelRef[] | null
}
interface GuruDropdownRow {
  email?: string | null
  nama_lengkap?: string | null
  unit_mengajar?: string | null
}
interface SiswaRowAbsensi {
  id: number
  nisn: string
  nama_lengkap: string
  jenis_kelamin?: string | null
  kelas_id?: number
  jenjang?: string | null
  kelas?: KelasRef | KelasRef[] | null
}

interface Siswa {
  id: number
  nisn: string
  nama_lengkap: string
  kelas_id?: number
  jenjang?: string | null
  kelas?: KelasRef | KelasRef[] | null
}

interface OptionItem {
  id: number
  nama: string
}

interface SmkMapelRef {
  id: number
  nama: string
  kode?: string
}

interface MasterJamItem {
  id: number
  hari: string
  jam_ke: number
  waktu_mulai: string
  waktu_selesai: string
  keterangan: string
  jenjang?: string | null
}

interface JadwalSlotSmk {
  id: number
  hari: string
  jam_ke: number
  kelas_id: number | null
  mapel_id: number | null
  guru_email: string
  nama_kelas: string
  nama_mapel: string
  kode_mapel: string
}

interface AbsensiRecord {
  id?: number | string
  tanggal: string
  kelas: string
  mapel: string
  nama_siswa: string
  status: 'HADIR' | 'IZIN' | 'SAKIT' | 'ALPA'
  guru_email?: string
  semester?: string
  tahun_ajaran?: string
  jam_ke?: string
  jenjang?: string | null
}

interface StatusAbsensiMap {
  [siswaId: string]: 'HADIR' | 'IZIN' | 'SAKIT' | 'ALPA'
}

// Palet warna lampu per warna bersama (plus fallback merah saat alert ALPA)
const ABS_PALETTE: Record<
  SmkColorKey,
  {
    label: string
    shadeFill: string
    shadeStroke: string
    bulbGlowColor: string
    coneStopColor: string
    softGlow: string
    floorEllipse: string
    ringFill: string
    knobColor: string
  }
> = {
  white: {
    label: 'Studio White Glow',
    shadeFill: '#cfd6df',
    shadeStroke: '#f1f5f9',
    bulbGlowColor: 'rgba(255, 255, 255, 0.28)',
    coneStopColor: '#e2e8f0',
    softGlow: 'rgba(255, 255, 255, 0.22)',
    floorEllipse: 'rgba(255, 255, 255, 0.18)',
    ringFill: '#ffffff',
    knobColor: '#cbd5e1',
  },
  green: {
    label: 'Neon Green Glow',
    shadeFill: '#70c9a8',
    shadeStroke: '#a7f3d0',
    bulbGlowColor: 'rgba(52, 211, 153, 0.34)',
    coneStopColor: '#34d399',
    softGlow: 'rgba(52, 211, 153, 0.26)',
    floorEllipse: 'rgba(52, 211, 153, 0.16)',
    ringFill: '#a7f3d0',
    knobColor: '#34d399',
  },
  red: {
    label: 'Alert Mode (Coral)',
    shadeFill: '#be5b64',
    shadeStroke: '#fda4af',
    bulbGlowColor: 'rgba(244, 63, 94, 0.36)',
    coneStopColor: '#f43f5e',
    softGlow: 'rgba(244, 63, 94, 0.28)',
    floorEllipse: 'rgba(244, 63, 94, 0.16)',
    ringFill: '#fda4af',
    knobColor: '#fbbf24',
  },
  cyan: {
    label: 'Studio Cyan Glow',
    shadeFill: '#5fbdc9',
    shadeStroke: '#a5f3fc',
    bulbGlowColor: 'rgba(34, 211, 238, 0.34)',
    coneStopColor: '#22d3ee',
    softGlow: 'rgba(34, 211, 238, 0.26)',
    floorEllipse: 'rgba(34, 211, 238, 0.16)',
    ringFill: '#a5f3fc',
    knobColor: '#22d3ee',
  },
  amber: {
    label: 'Warm Studio Glow',
    shadeFill: '#e7c796',
    shadeStroke: '#fef3c7',
    bulbGlowColor: 'rgba(251, 191, 36, 0.34)',
    coneStopColor: '#fbbf24',
    softGlow: 'rgba(251, 191, 36, 0.28)',
    floorEllipse: 'rgba(251, 191, 36, 0.16)',
    ringFill: '#fef08a',
    knobColor: '#fbbf24',
  },
}

const HARI_INDONESIA_SMK_ABS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']

function getHariNama(tgl: string): string {
  const d = new Date(`${String(tgl).slice(0, 10)}T00:00:00`)
  if (Number.isNaN(d.getTime())) return ''
  return HARI_INDONESIA_SMK_ABS[d.getDay()]
}

interface GuruOption {
  email: string
  nama: string
}

function getTodayStrDefault(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function getHariTodayDefault(): string {
  const nama = HARI_INDONESIA_SMK_ABS[new Date().getDay()]
  return nama !== 'Jumat' ? nama : 'Sabtu'
}

export default function SmkAbsensiPage() {
  const router = useRouter()
  const { isOperator } = useAuthRole()

  const [userDisplayName, setUserDisplayName] = useState('MEMUAT...')
  const [userNuptkDisplay, setUserNuptkDisplay] = useState('-')
  const [isStrictOperatorRole, setIsStrictOperatorRole] = useState(false)
  const [waliKelasAssignedId, setWaliKelasAssignedId] = useState<number | null>(null)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [logoFallbackIndex, setLogoFallbackIndex] = useState(0)

  // State Lampu Tripod Interaktif
  const { color: lampColor, setColor: setLampColor } = useSmkColor()
  const [cordPulled, setCordPulled] = useState(false)

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

  const [activeTab, setActiveTab] = useState<'input' | 'rekap'>('input')
  const [deckFilter, setDeckFilter] = useState<'ALL' | 'BELUM' | 'HADIR' | 'NON_HADIR'>('ALL')
  const [deckSearch, setDeckSearch] = useState('')
  const [showQrModal, setShowQrModal] = useState<boolean>(false)
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment')

  // Periode Akademik
  const [selectedSemester, setSelectedSemester] = useState<'Ganjil' | 'Genap'>('Ganjil')
  const [selectedTahunAjaran, setSelectedTahunAjaran] = useState('2026/2027')

  const [tanggal, setTanggal] = useState('')
  const [todayStr, setTodayStr] = useState('')
  const [hari, setHari] = useState('Senin')
  const [jamMulai, setJamMulai] = useState('1')
  const [jamSelesai, setJamSelesai] = useState('1')

  // Options Khusus SMK
  const [kelasList, setKelasList] = useState<OptionItem[]>([])
  const [mapelList, setMapelList] = useState<OptionItem[]>([])
  const [masterJamList, setMasterJamList] = useState<MasterJamItem[]>([])
  const [jadwalSmkList, setJadwalSmkList] = useState<JadwalSlotSmk[]>([])

  // Daftar guru pengampu SMK (untuk dropdown saat operator menginput manual/insidental)
  const [guruList, setGuruList] = useState<GuruOption[]>([])
  const [selectedGuruEmail, setSelectedGuruEmail] = useState('')

  const [selectedKelasId, setSelectedKelasId] = useState('')
  const [selectedMapelId, setSelectedMapelId] = useState('')

  const [siswaList, setSiswaList] = useState<Siswa[]>([])
  const [absensiMap, setAbsensiMap] = useState<StatusAbsensiMap>({})
  const [loadingSiswa, setLoadingSiswa] = useState(false)
  const [saving, setSaving] = useState(false)

  // State Rekapitulasi SMK
  const [rekapList, setRekapList] = useState<AbsensiRecord[]>([])
  const [filterKelasId, setFilterKelasId] = useState('')
  const [filterMapelId, setFilterMapelId] = useState('')
  const [filterTanggal, setFilterTanggal] = useState('')
  const [searchNama, setSearchNama] = useState('')
  const [loadingRekap, setLoadingRekap] = useState(false)

  // Isi tanggal hari ini hanya di browser setelah mount (hindari SSR/hydration mismatch).
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setTanggal(getTodayStrDefault())
    setTodayStr(getTodayStrDefault())
    setFilterTanggal(getTodayStrDefault())
    setHari(getHariTodayDefault())
  }, [])
  /* eslint-enable react-hooks/set-state-in-effect */

  // QR Scanner
  const [scanStatus, setScanStatus] = useState<{
    type: 'success' | 'warning' | 'error'
    msg: string
  } | null>(null)
  const [isScanning, setIsScanning] = useState(false)
  const qrScannerRef = useRef<import('html5-qrcode').Html5Qrcode | null>(null)
  const isCooldownRef = useRef<boolean>(false)

  const siswaListRef = useRef<Siswa[]>([])
  const absensiMapRef = useRef<StatusAbsensiMap>({})
  useEffect(() => {
    siswaListRef.current = siswaList
  }, [siswaList])
  useEffect(() => {
    absensiMapRef.current = absensiMap
  }, [absensiMap])

  const logoCandidates = ['/logo-smk.png', '/logo-smp.jpg']

  const fetchMasterJamSmk = useCallback(async () => {
    const { data } = await supabase
      .from('master_jam')
      .select('*')
      .eq('jenjang', 'SMK')
      .order('jam_ke', { ascending: true })

    if (data && data.length > 0) {
      setMasterJamList(data)
    } else {
      const { data: fallbackData } = await supabase
        .from('master_jam')
        .select('*')
        .order('jam_ke', { ascending: true })
      if (fallbackData) setMasterJamList(fallbackData)
    }
  }, [])

  const fetchJadwalGuruSmk = useCallback(
    async (email: string) => {
      try {
        const [resKelas, resMapel, resJadwal] = await Promise.all([
          supabase
            .from('kelas')
            .select('id, nama_kelas, jenjang')
            .eq('jenjang', 'SMK')
            .order('nama_kelas', { ascending: true }),
          supabase
            .from('mapel')
            .select('id, nama_mapel, kode_mapel, jenjang')
            .eq('jenjang', 'SMK')
            .order('nama_mapel', { ascending: true }),
          supabase
            .from('jadwal')
            .select(
              `
              id,
              hari,
              jam_ke,
              kelas_id,
              mapel_id,
              guru_email,
              jenjang,
              kelas:kelas_id(id, nama_kelas),
              mapel:mapel_id(id, nama_mapel, kode_mapel)
            `
            )
            .eq('jenjang', 'SMK')
            .order('jam_ke', { ascending: true }),
        ])

        const allSmkKelas: OptionItem[] = (resKelas.data || []).map((k: { id: number; nama_kelas: string }) => ({
          id: k.id,
          nama: k.nama_kelas,
        }))
        const allSmkMapel: SmkMapelRef[] = (resMapel.data || []).map(
          (m: { id: number; nama_mapel: string; kode_mapel?: string | null }) => ({
            id: m.id,
            nama: m.nama_mapel,
            kode: (m.kode_mapel || '').trim().toUpperCase(),
          })
        )

        const rawJadwal = resJadwal.data || []
        const formattedJadwal: JadwalSlotSmk[] = rawJadwal.map((j: JadwalRowSmk) => {
          const kObj = Array.isArray(j.kelas) ? j.kelas[0] : j.kelas
          const mObj = Array.isArray(j.mapel) ? j.mapel[0] : j.mapel
          return {
            id: j.id,
            hari: j.hari || '',
            jam_ke: Number(j.jam_ke),
            kelas_id: j.kelas_id ?? null,
            mapel_id: j.mapel_id ?? null,
            guru_email: (j.guru_email || '').trim().toLowerCase(),
            nama_kelas: kObj?.nama_kelas || 'Semua Kelas DKV',
            nama_mapel: mObj?.nama_mapel || '-',
            kode_mapel: (mObj?.kode_mapel || '').trim().toUpperCase(),
          }
        })

        const cleanEmail = email.trim().toLowerCase()
        const myJadwal = isOperator
          ? formattedJadwal
          : formattedJadwal.filter((j) => j.guru_email === cleanEmail)

        setJadwalSmkList(myJadwal)

        if (isOperator) {
          setKelasList(allSmkKelas)
          setMapelList(allSmkMapel)
        } else {
          const uniqueKelasMap = new Map<number, string>()
          const uniqueMapelMap = new Map<number, string>()
          // Kunci pencocokan utama berbasis kode_mapel utk mapel jenjang SMK
          const smkMapelByKode = new Map<string, SmkMapelRef>()
          allSmkMapel.forEach((m) => {
            if (m.kode) smkMapelByKode.set(m.kode, m)
          })
          // kode_mapel mapel SMK yg benar-benar terdaftar pd jadwal guru ini
          const jadwalKodeSet = new Set<string>()
          let hasGabunganSemuaKelas = false

          myJadwal.forEach((slot) => {
            if (slot.kelas_id) {
              uniqueKelasMap.set(slot.kelas_id, slot.nama_kelas)
            } else {
              hasGabunganSemuaKelas = true
            }
            if (slot.mapel_id) {
              uniqueMapelMap.set(slot.mapel_id, slot.nama_mapel)
              if (slot.kode_mapel) jadwalKodeSet.add(slot.kode_mapel)
            }
          })

          // Gabungkan mapel ampuan guru dari profil (relasi `guru_mapel` & kolom
          // teks `mapel`), TETAPI hanya bila kode_mapel-nya terdaftar sbg mapel
          // jenjang SMK (validasi via kode_mapel & jadwal guru).
          try {
            const { data: guruProfile } = await supabase
              .from('guru')
              .select('id, mapel')
              .ilike('email', cleanEmail)
              .maybeSingle()

            if (guruProfile?.id) {
              // (a) Relasi guru_mapel -> validasi kode_mapel terhadap mapel SMK
              const { data: guruMapelRows } = await supabase
                .from('guru_mapel')
                .select('mapel_id, mapel:mapel_id(id, nama_mapel, kode_mapel)')
                .eq('guru_id', guruProfile.id)

              ;(guruMapelRows || []).forEach((row) => {
                const mObj = Array.isArray(row.mapel) ? row.mapel[0] : row.mapel
                const mId = Number(mObj?.id ?? row.mapel_id)
                if (!mId) return
                const kode = (mObj?.kode_mapel || '').trim().toUpperCase()
                const found = kode
                  ? smkMapelByKode.get(kode)
                  : allSmkMapel.find((m) => Number(m.id) === mId)
                if (found) uniqueMapelMap.set(found.id, found.nama)
              })

              // (b) Kolom teks `mapel` pd profil guru: HANYA dipakai jika kode_mapel
              //     mapel tsb terdaftar sbg mapel jenjang SMK pd jadwal guru ini
              //     (mencegah bocornya mapel SMP spt PJOK ke halaman SMK).
              const profileNames = (guruProfile.mapel || '')
                .split(/[,;]/)
                .map((s: string) => s.trim().toLowerCase())
                .filter(Boolean)
              if (profileNames.length > 0) {
                allSmkMapel.forEach((m) => {
                  if (!m.kode || !jadwalKodeSet.has(m.kode)) return
                  const mName = m.nama.toLowerCase()
                  const hit = profileNames.some((n: string) => mName === n)
                  if (hit) uniqueMapelMap.set(m.id, m.nama)
                })
              }
            }
          } catch (err) {
            console.error('Error fetching mapel profil guru SMK:', err)
          }

          if (hasGabunganSemuaKelas) {
            setKelasList(allSmkKelas)
          } else {
            setKelasList(
              Array.from(uniqueKelasMap.entries())
                .map(([id, nama]) => ({ id, nama }))
                .sort((a, b) => a.nama.localeCompare(b.nama))
            )
          }

          setMapelList(
            Array.from(uniqueMapelMap.entries())
              .map(([id, nama]) => ({ id, nama }))
              .sort((a, b) => a.nama.localeCompare(b.nama))
          )
        }
      } catch (err) {
        console.error('Error fetching jadwal SMK:', err)
      }
    },
    [isOperator]
  )

  useEffect(() => {
    let isMounted = true

    async function getUserData() {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        if (isMounted) router.replace('/login')
        return
      }

      const rawEmail = user.email || ''
      const cleanEmail = rawEmail.trim().toLowerCase()
      if (isMounted) setUserEmail(rawEmail)

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
              .eq('jenjang', 'SMK')
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

      await fetchJadwalGuruSmk(rawEmail)
      await fetchMasterJamSmk()
    }

    getUserData()

    return () => {
      isMounted = false
    }
  }, [router, isOperator, fetchJadwalGuruSmk, fetchMasterJamSmk])

  // Load Siswa SMK
  useEffect(() => {
    async function fetchSiswaSmk() {
      if (!selectedKelasId) {
        setSiswaList([])
        setAbsensiMap({})
        return
      }

      setLoadingSiswa(true)
      try {
        const smkKelasIds = kelasList.map((k) => Number(k.id))

        let query = supabase
          .from('siswa')
          .select('id, nisn, nama_lengkap, kelas_id, jenjang, kelas:kelas_id(nama_kelas, jenjang)')
          .order('nama_lengkap', { ascending: true })

        if (selectedKelasId !== 'ALL') {
          query = query.eq('kelas_id', Number(selectedKelasId))
        } else if (smkKelasIds.length > 0) {
          query = query.in('kelas_id', smkKelasIds)
        } else {
          query = query.eq('jenjang', 'SMK')
        }

        const { data, error } = await query

        if (!error && data) {
          const onlySmkSiswa = (data as SiswaRowAbsensi[]).filter((s) => {
            const kObj = Array.isArray(s.kelas) ? s.kelas[0] : s.kelas
            if ((s.jenjang || '').toUpperCase() === 'SMK') return true
            if ((kObj?.jenjang || '').toUpperCase() === 'SMK') return true
            if (smkKelasIds.includes(Number(s.kelas_id))) return true
            return false
          })

          setSiswaList(onlySmkSiswa)

          if (selectedMapelId && tanggal) {
            let absensiQuery = supabase
              .from('absensi')
              .select('siswa_id, status')
              .eq('jenjang', 'SMK')
              .eq('mapel_id', Number(selectedMapelId))
              .eq('tanggal', tanggal)
              .eq('semester', selectedSemester)
              .eq('tahun_ajaran', selectedTahunAjaran)

            if (selectedKelasId !== 'ALL') {
              absensiQuery = absensiQuery.eq('kelas_id', Number(selectedKelasId))
            }

            const { data: existingAbsensi } = await absensiQuery

            const initialMap: StatusAbsensiMap = {}
            if (existingAbsensi) {
              existingAbsensi.forEach((a) => {
                if (a.siswa_id) initialMap[String(a.siswa_id)] = a.status
              })
            }
            setAbsensiMap(initialMap)
          } else {
            setAbsensiMap({})
          }
        } else {
          setSiswaList([])
        }
      } catch (err) {
        console.error('Error fetching siswa SMK:', err)
      } finally {
        setLoadingSiswa(false)
      }
    }

    if (activeTab === 'input') {
      fetchSiswaSmk()
    }
  }, [
    selectedKelasId,
    selectedMapelId,
    tanggal,
    selectedSemester,
    selectedTahunAjaran,
    activeTab,
    kelasList,
  ])

  const handleSelectJadwalPreset = (slots: JadwalSlotSmk[]) => {
    if (!slots || slots.length === 0) return
    const sorted = [...slots].sort((a, b) => a.jam_ke - b.jam_ke)
    const first = sorted[0]
    const last = sorted[sorted.length - 1]

    setJamMulai(String(first.jam_ke))
    setJamSelesai(String(last.jam_ke))
    setSelectedKelasId(first.kelas_id ? String(first.kelas_id) : 'ALL')
    if (first.mapel_id) {
      setSelectedMapelId(String(first.mapel_id))
    }
  }

  const handleQRScanned = useCallback((scannedText: string) => {
    const textClean = scannedText.trim()
    if (isCooldownRef.current) return
    isCooldownRef.current = true
    setIsScanning(true)

    const targetSiswa = siswaListRef.current.find(
      (s) => s.nisn === textClean || String(s.id) === textClean
    )

    if (targetSiswa && targetSiswa.id) {
      const sId = String(targetSiswa.id)
      const currentStatus = absensiMapRef.current[sId]

      if (currentStatus === 'HADIR') {
        setScanStatus({
          type: 'warning',
          msg: `⚠️ ${targetSiswa.nama_lengkap} SUDAH HADIR!`,
        })
      } else {
        setAbsensiMap((prev) => ({
          ...prev,
          [sId]: 'HADIR',
        }))
        setScanStatus({
          type: 'success',
          msg: `✅ BERHASIL: ${targetSiswa.nama_lengkap} (HADIR)`,
        })
      }
    } else {
      setScanStatus({
        type: 'error',
        msg: `❌ NISN/ID: "${textClean}" Tidak Ditemukan di Kelas SMK!`,
      })
    }

    setTimeout(() => {
      setIsScanning(false)
    }, 300)

    setTimeout(() => {
      isCooldownRef.current = false
      setScanStatus(null)
    }, 2200)
  }, [])

  // QR Scanner Modal
  useEffect(() => {
    let html5QrCode: import('html5-qrcode').Html5Qrcode | null = null
    let isMounted = true

    if (showQrModal && activeTab === 'input') {
      import('html5-qrcode').then(({ Html5Qrcode }) => {
        if (!isMounted) return

        if (!qrScannerRef.current) {
          html5QrCode = new Html5Qrcode('reader-smk')
          qrScannerRef.current = html5QrCode
        } else {
          html5QrCode = qrScannerRef.current
        }

        if (!html5QrCode) return

        const startScanner = async () => {
          try {
            if (html5QrCode!.isScanning) {
              await html5QrCode!.stop()
            }

            await html5QrCode!.start(
              { facingMode: facingMode },
              { fps: 10, qrbox: { width: 200, height: 200 } },
              (decodedText: string) => {
                handleQRScanned(decodedText)
              },
              () => {}
            )
          } catch (err) {
            console.warn('Gagal memulai kamera:', err)
            setScanStatus({
              type: 'error',
              msg: '⚠️ Kamera tidak tersedia / izin ditolak.',
            })
          }
        }

        startScanner()
      })
    }

    return () => {
      isMounted = false
      if (qrScannerRef.current && qrScannerRef.current.isScanning) {
        qrScannerRef.current.stop().catch(() => {})
      }
    }
  }, [showQrModal, activeTab, facingMode, handleQRScanned])

  const toggleCameraFacing = async () => {
    const nextMode = facingMode === 'environment' ? 'user' : 'environment'
    if (qrScannerRef.current) {
      try {
        if (qrScannerRef.current.isScanning) {
          await qrScannerRef.current.stop()
        }
      } catch (e) {
        console.log('Menghentikan kamera...', e)
      }
    }
    setFacingMode(nextMode)
  }

  // Fetch Rekap SMK
  const fetchRekapSmk = useCallback(async () => {
    setLoadingRekap(true)
    try {
      let query = supabase
        .from('absensi')
        .select('*')
        .eq('jenjang', 'SMK')
        .eq('semester', selectedSemester)
        .eq('tahun_ajaran', selectedTahunAjaran)
        .order('tanggal', { ascending: false })

      if (!isOperator && userEmail) {
        query = query.ilike('guru_email', userEmail.trim())
      }

      if (filterKelasId) query = query.eq('kelas_id', Number(filterKelasId))
      if (filterMapelId) query = query.eq('mapel', filterMapelId)
      if (filterTanggal) query = query.eq('tanggal', filterTanggal)
      if (searchNama.trim()) query = query.ilike('nama_siswa', `%${searchNama.trim()}%`)

      const { data, error } = await query
      if (!error && data) {
        setRekapList(data)
      } else {
        setRekapList([])
      }
    } catch (err) {
      console.error('Error fetching rekap SMK:', err)
    } finally {
      setLoadingRekap(false)
    }
  }, [
    selectedSemester,
    selectedTahunAjaran,
    isOperator,
    userEmail,
    filterKelasId,
    filterMapelId,
    filterTanggal,
    searchNama,
  ])

  useEffect(() => {
    if (activeTab === 'rekap') {
      // Memuat rekap saat tab dibuka (sengaja sinkron agar loading langsung tampil)
      // eslint-disable-next-line react-hooks/set-state-in-effect
      fetchRekapSmk()
    }
  }, [activeTab, fetchRekapSmk])

  const handleToggleStatus = (
    siswaId: string,
    status: 'HADIR' | 'IZIN' | 'SAKIT' | 'ALPA'
  ) => {
    setAbsensiMap((prev) => {
      const next = { ...prev }
      if (next[siswaId] === status) {
        delete next[siswaId]
      } else {
        next[siswaId] = status
      }
      return next
    })
  }

  const handleAutoHadirAll = () => {
    if (siswaList.length === 0) return
    const newMap: StatusAbsensiMap = {}
    siswaList.forEach((s) => {
      newMap[String(s.id)] = 'HADIR'
    })
    setAbsensiMap(newMap)
  }

  const handleResetStatus = () => {
    setAbsensiMap({})
  }

  const jamOptionsForHari = masterJamList.filter((j) => j.hari === hari)

  // Ambil daftar guru pengampu jenjang SMK untuk dropdown operator
  async function fetchGuruListSmk() {
    const { data } = await supabase
      .from('guru')
      .select('email, nama_lengkap, unit_mengajar')
      .order('nama_lengkap', { ascending: true })
    if (!data) return
    const list = (data as GuruDropdownRow[])
      .map((r) => ({
        email: (r.email || '').trim(),
        nama: (r.nama_lengkap || '').trim(),
        unit: (r.unit_mengajar || '').trim().toLowerCase(),
      }))
      .filter((g) => g.email && g.nama)
      .filter((g) => !g.unit || g.unit.includes('smk'))
      .map(({ email, nama }) => ({ email, nama }))
    setGuruList(list)
  }

  // Resolusi guru pengampu ASLI dari tabel jadwal SMK untuk absensi.
  async function resolveGuruPengampuAbsensiSmk(
    kelasIdVal: number | string | null,
    mapelIdNum: number,
    dayName: string
  ): Promise<string | null> {
    try {
      let q = supabase
        .from('jadwal')
        .select('guru_email')
        .eq('jenjang', 'SMK')
        .eq('mapel_id', mapelIdNum)
        .eq('hari', dayName)
      if (kelasIdVal !== 'ALL' && kelasIdVal != null) q = q.eq('kelas_id', Number(kelasIdVal))
      const { data } = await q
      if (!data || data.length === 0) return null
      const uniq = Array.from(
        new Set((data as Array<{ guru_email?: string | null }>).map((r) => (r.guru_email || '').trim().toLowerCase()).filter(Boolean))
      )
      return uniq.length === 1 ? uniq[0] : null
    } catch {
      return null
    }
  }

  useEffect(() => {
    if (isOperator) {
      // Memuat daftar guru saat halaman dibuka
      // eslint-disable-next-line react-hooks/set-state-in-effect
      fetchGuruListSmk()
    }
  }, [isOperator])

  const handleSimpanAbsensiSmk = async () => {
    if (!selectedKelasId || !selectedMapelId || !tanggal) {
      alert('Silakan pilih Tanggal, Kelas SMK, dan Mata Pelajaran terlebih dahulu!')
      return
    }

    if (!userEmail) {
      alert('Sesi login tidak valid. Silakan login ulang.')
      return
    }

    if (siswaList.length === 0) {
      alert('Tidak ada siswa SMK pada kelas ini.')
      return
    }

    const processedSiswa = siswaList.filter((s) => absensiMap[String(s.id)])

    if (processedSiswa.length === 0) {
      alert('Belum ada siswa yang ditandai kehadirannya.')
      return
    }

    setSaving(true)
    try {
      const selectedMapelObj = mapelList.find((m) => m.id === Number(selectedMapelId))
      const startJamObj = masterJamList.find(
        (j) => j.hari === hari && j.jam_ke === Number(jamMulai)
      )
      const endJamObj = masterJamList.find(
        (j) => j.hari === hari && j.jam_ke === Number(jamSelesai)
      )

      let jamFormattedText =
        Number(jamMulai) === Number(jamSelesai)
          ? `Jam Ke-${jamMulai}`
          : `Jam Ke-${jamMulai} s/d ${jamSelesai}`

      if (startJamObj && endJamObj) {
        const wMulai = startJamObj.waktu_mulai.slice(0, 5)
        const wSelesai = endJamObj.waktu_selesai.slice(0, 5)

        if (Number(jamMulai) === Number(jamSelesai)) {
          jamFormattedText = `Jam Ke-${jamMulai} (${wMulai} - ${wSelesai})`
        } else {
          jamFormattedText = `Jam Ke-${jamMulai} s/d ${jamSelesai} (${wMulai} - ${wSelesai})`
        }
      }

      const cleanEmail = userEmail.trim().toLowerCase()

      // PEMUTUSAN GURU PENGAMPU: utamakan data asli dari `jadwal`.
      const hariNama = getHariNama(tanggal)
      const resolvedGuru = hariNama
        ? await resolveGuruPengampuAbsensiSmk(selectedKelasId, Number(selectedMapelId), hariNama)
        : null
      const guruEmailSimpan = resolvedGuru || (isOperator && selectedGuruEmail.trim() ? selectedGuruEmail.trim().toLowerCase() : cleanEmail)

      const rowsToInsert = processedSiswa.map((siswa) => {
        const kObj = Array.isArray(siswa.kelas) ? siswa.kelas[0] : siswa.kelas
        let namaKelasVal = kObj?.nama_kelas || ''
        if (!namaKelasVal && selectedKelasId !== 'ALL') {
          const foundK = kelasList.find((k) => k.id === Number(selectedKelasId))
          namaKelasVal = foundK?.nama || ''
        }

        return {
          tanggal,
          jam_ke: jamFormattedText,
          kelas_id:
            siswa.kelas_id || (selectedKelasId !== 'ALL' ? Number(selectedKelasId) : null),
          mapel_id: Number(selectedMapelId),
          siswa_id: String(siswa.id),
          kelas: namaKelasVal,
          mapel: selectedMapelObj?.nama || '',
          nama_siswa: siswa.nama_lengkap,
          nisn: siswa.nisn || '',
          status: absensiMap[String(siswa.id)],
          semester: selectedSemester,
          tahun_ajaran: selectedTahunAjaran,
          guru_email: guruEmailSimpan,
          jenjang: 'SMK',
        }
      })

      // Simpan lewat RPC simpan_absensi: DELETE sesi lama + INSERT baris
      // baru berjalan dalam SATU transaksi database. Kalau INSERT gagal,
      // DELETE ikut batal dan absensi lama tetap utuh (temuan audit #11).
      // Fungsi SQL-nya ada di docs/migrasi-rpc-simpan-absensi.sql dan
      // harus sudah dijalankan di Supabase SQL Editor sebelum kode ini
      // dipakai. p_guru_email dikirim null karena kode lama SMK tidak
      // memfilter guru_email saat menghapus.
      const { error } = await supabase.rpc('simpan_absensi', {
        p_jenjang: 'SMK',
        p_kelas_id: selectedKelasId === 'ALL' ? null : Number(selectedKelasId),
        p_siswa_ids:
          selectedKelasId === 'ALL' ? processedSiswa.map((s) => String(s.id)) : null,
        p_mapel_id: Number(selectedMapelId),
        p_tanggal: tanggal,
        p_semester: selectedSemester,
        p_tahun_ajaran: selectedTahunAjaran,
        p_guru_email: null,
        p_rows: rowsToInsert,
      })

      if (error) {
        alert('Gagal menyimpan absensi SMK: ' + error.message)
      } else {
        // Sinkronisasi ke jurnal_agenda agar indikator status di /smk/jadwal otomatis hijau
        try {
          const jMulai = Number(jamMulai)
          const jSelesai = Number(jamSelesai)
          const jpRange: number[] = []
          for (let jp = jMulai; jp <= jSelesai; jp++) jpRange.push(jp)

          const targetKelasIds =
            selectedKelasId === 'ALL'
              ? Array.from(
                  new Set(
                    processedSiswa
                      .map((s) => s.kelas_id)
                      .filter((id): id is number => Boolean(id))
                  )
                )
              : [Number(selectedKelasId)]

          for (const kId of targetKelasIds) {
            for (const jp of jpRange) {
              const { data: existJurnal } = await supabase
                .from('jurnal_agenda')
                .select('id')
                .eq('jenjang', 'SMK')
                .eq('tanggal', tanggal)
                .eq('kelas_id', kId)
                .eq('mapel_id', Number(selectedMapelId))
                .eq('jam_ke', jp)
                .limit(1)
                .maybeSingle()

              if (!existJurnal) {
                await supabase.from('jurnal_agenda').insert({
                  tanggal,
                  kelas_id: kId,
                  mapel_id: Number(selectedMapelId),
                  jam_ke: jp,
                  guru_email: guruEmailSimpan,
                  jenjang: 'SMK',
                  materi: `Presensi Kelas SMK (${processedSiswa.length} siswa tercatat)`,
                  semester: selectedSemester,
                  tahun_ajaran: selectedTahunAjaran,
                })
              }
            }
          }
        } catch {
          // Non-blocking sync
        }

        alert(`Berhasil menyimpan presensi SMK (${processedSiswa.length} siswa)!`)
        setFilterTanggal(tanggal)
        if (selectedKelasId !== 'ALL') {
          setFilterKelasId(selectedKelasId)
        }
        if (selectedMapelObj) {
          setFilterMapelId(selectedMapelObj.nama)
        }
        setActiveTab('rekap')
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error tidak diketahui'
      alert('Terjadi kesalahan: ' + message)
    } finally {
      setSaving(false)
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

  // Hitungan Live Sesi Input
  const sortedSiswaList = [...siswaList].sort((a, b) =>
    a.nama_lengkap.localeCompare(b.nama_lengkap)
  )
  const countInputHadir = sortedSiswaList.filter(
    (s) => absensiMap[String(s.id)] === 'HADIR'
  ).length
  const countInputIzin = sortedSiswaList.filter(
    (s) => absensiMap[String(s.id)] === 'IZIN'
  ).length
  const countInputSakit = sortedSiswaList.filter(
    (s) => absensiMap[String(s.id)] === 'SAKIT'
  ).length
  const countInputAlpa = sortedSiswaList.filter(
    (s) => absensiMap[String(s.id)] === 'ALPA'
  ).length
  const countInputBelum = sortedSiswaList.filter((s) => !absensiMap[String(s.id)]).length
  const countInputTotal = sortedSiswaList.length - countInputBelum

  // Filter Daftar Siswa di Kolom Tengah
  const filteredDeckSiswa = sortedSiswaList.filter((s) => {
    const st = absensiMap[String(s.id)]
    if (deckFilter === 'BELUM' && st) return false
    if (deckFilter === 'HADIR' && st !== 'HADIR') return false
    if (deckFilter === 'NON_HADIR' && (!st || st === 'HADIR')) return false
    if (deckSearch.trim()) {
      const q = deckSearch.trim().toLowerCase()
      const matchName = s.nama_lengkap.toLowerCase().includes(q)
      const matchNisn = (s.nisn || '').toLowerCase().includes(q)
      if (!matchName && !matchNisn) return false
    }
    return true
  })

  // Hitungan Rekap
  const totalData = rekapList.length
  const totalHadir = rekapList.filter((item) => item.status === 'HADIR').length
  const totalIzin = rekapList.filter((item) => item.status === 'IZIN').length
  const totalSakit = rekapList.filter((item) => item.status === 'SAKIT').length
  const totalAlpa = rekapList.filter((item) => item.status === 'ALPA').length

  // Grouping Jadwal SMK Hari Ini
  const jadwalHariIniGrouped = (() => {
    const slotsHariIni = jadwalSmkList.filter((j) => j.hari === hari)
    const mapGroup = new Map<string, JadwalSlotSmk[]>()
    slotsHariIni.forEach((slot) => {
      const key = `${slot.kelas_id ?? 'ALL'}-${slot.mapel_id ?? '0'}`
      const arr = mapGroup.get(key) || []
      arr.push(slot)
      mapGroup.set(key, arr)
    })
    return Array.from(mapGroup.values())
  })()

  // Tarik Tali Lampu Tripod: ubah warna lampu sekaligus ganti tampilan Input <-> Riwayat
  const handlePullLampCord = () => {
    setCordPulled(true)
    setTimeout(() => setCordPulled(false), 320)
    setLampColor(SMK_COLOR_KEYS[(SMK_COLOR_KEYS.indexOf(lampColor) + 1) % SMK_COLOR_KEYS.length])
    setActiveTab((prev) => (prev === 'input' ? 'rekap' : 'input'))
  }

  // Warna Dinamis Kap Lampu & Sorotan Cahaya (mengikuti warna bersama SMK)
  const activePalette = ABS_PALETTE[countInputAlpa > 0 ? 'red' : lampColor]

  const shadeFill = activePalette.shadeFill
  const shadeStroke = activePalette.shadeStroke
  const bulbGlowColor = activePalette.bulbGlowColor
  const coneStopColor = activePalette.coneStopColor

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="h-dvh max-h-dvh overflow-hidden font-sans flex flex-col justify-between bg-[#07090f] text-slate-100 selection:bg-amber-400 selection:text-slate-950 relative"
    >
      {/* AMBIENT STUDIO BACKDROP */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden select-none print:hidden">
        <div
          className="absolute -top-16 left-6 w-[540px] h-[540px] rounded-full blur-[130px] transition-colors duration-700"
          style={{ backgroundColor: bulbGlowColor }}
        />
        <div
          className="absolute inset-0 opacity-[0.025]"
          style={{
            backgroundImage:
              'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.6) 1px, transparent 0)',
            backgroundSize: '22px 22px',
          }}
        />
      </div>

      <div className="relative z-10 flex flex-col h-full min-h-0 overflow-hidden">
        {/* 1. CLEAN STUDIO HEADER (UKURAN DISAMAKAN DENGAN MASTER PAGE: max-w-5xl) */}
        <header className="border-b border-white/10 bg-[#0a0e18]/90 backdrop-blur-xl px-3 py-2.5 shrink-0 print:hidden">
          <div className="max-w-5xl mx-auto flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 shrink-0">
              <Link
                href="/smk"
                className="p-1.5 rounded-lg bg-white/5 border border-white/10 text-slate-300 hover:text-amber-300 hover:border-amber-400/40 transition"
                title="Kembali ke Dashboard SMK"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
              </Link>
              <div className="flex items-center gap-2">
                {logoFallbackIndex < logoCandidates.length ? (
                  <Image
                    src={logoCandidates[logoFallbackIndex]}
                    onError={() => setLogoFallbackIndex((prev) => prev + 1)}
                    alt="Logo SMK"
                    width={28}
                    height={28}
                    unoptimized
                    className="rounded-lg border border-amber-400/40 bg-white/10 object-contain"
                  />
                ) : (
                  <div className="w-7 h-7 rounded-lg border border-amber-400/40 bg-amber-400/15 text-amber-300 flex items-center justify-center">
                    <GraduationCap className="w-4 h-4" />
                  </div>
                )}
                <div className="flex items-center gap-1.5">
                  <h1 className="font-black text-xs sm:text-sm tracking-wider text-white uppercase">
                    Presensi SMK
                  </h1>
                  <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-amber-400 text-slate-950">
                    DKV
                  </span>
                </div>
              </div>
            </div>

            {/* MODE SWITCHER: INPUT VS RIWAYAT */}
            <div className="flex items-center p-0.5 rounded-xl border border-white/10 bg-black/40 text-[10px] sm:text-[11px] font-extrabold">
              <button
                onClick={() => setActiveTab('input')}
                className={`px-3 py-1 rounded-lg transition flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'input'
                    ? 'bg-amber-400 text-slate-950 shadow-sm font-black'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Input Presensi</span>
              </button>
              <button
                onClick={() => setActiveTab('rekap')}
                className={`px-3 py-1 rounded-lg transition flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'rekap'
                    ? 'bg-amber-400 text-slate-950 shadow-sm font-black'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <CalendarDays className="w-3.5 h-3.5" />
                <span>Riwayat ({totalData})</span>
              </button>
            </div>

            <div className="flex items-center gap-1.5">
              {/* PERIODE SEMESTER & TAHUN AJARAN */}
              <div className="border border-white/10 bg-white/5 text-[10px] font-bold px-2 py-1 rounded-lg flex items-center gap-1">
                <select
                  value={selectedSemester}
                  onChange={(e) => setSelectedSemester(e.target.value as 'Ganjil' | 'Genap')}
                  className="bg-transparent text-amber-300 font-extrabold focus:outline-none cursor-pointer"
                >
                  <option value="Ganjil" className="bg-slate-900 text-white">
                    Ganjil
                  </option>
                  <option value="Genap" className="bg-slate-900 text-white">
                    Genap
                  </option>
                </select>
                <span className="text-white/20">|</span>
                <select
                  value={selectedTahunAjaran}
                  onChange={(e) => setSelectedTahunAjaran(e.target.value)}
                  className="bg-transparent text-amber-300 font-extrabold focus:outline-none cursor-pointer"
                >
                  {Array.from({ length: 5 }, (_, i) => {
                    const startYear = 2025 + i
                    const tahunOption = `${startYear}/${startYear + 1}`
                    return (
                      <option
                        key={tahunOption}
                        value={tahunOption}
                        className="bg-slate-900 text-white"
                      >
                        {tahunOption}
                      </option>
                    )
                  })}
                </select>
              </div>

              {/* BADGE PROFIL */}
              <div className="border border-white/10 bg-white/5 text-[10px] font-bold px-2 py-0.5 rounded-lg flex items-center gap-1.5">
                <span className="w-4 h-4 rounded-full bg-amber-400 text-slate-950 flex items-center justify-center text-[9px] font-black shrink-0">
                  {userDisplayName.charAt(0)}
                </span>
                <div className="hidden md:flex flex-col leading-none">
                  <span className="font-extrabold max-w-[115px] truncate text-white">
                    {userDisplayName}
                  </span>
                  <span className="text-[8px] font-mono text-slate-400 mt-0.5">
                    NUPTK: {userNuptkDisplay}
                  </span>
                </div>
                <span className="hidden sm:inline-block text-[9px] px-1.5 py-0.5 rounded font-extrabold uppercase bg-amber-400/15 text-amber-300 border border-amber-400/30">
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
                className="p-1.5 rounded-lg border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition cursor-pointer disabled:opacity-50"
                title="Keluar"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </header>

        {/* 2. WORKSPACE UTAMA (UKURAN DISAMAKAN DENGAN MASTER PAGE: max-w-5xl p-3 gap-4) */}
        <main className="w-full max-w-5xl mx-auto p-3 flex-1 min-h-0 flex flex-col overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 h-full min-h-0 overflow-hidden">
            {/* ============================================================
                KOLOM KIRI (3 KOLOM): STANDING FLOOR LAMP V5 (TETAP ADA DI INPUT & RIWAYAT)
               ============================================================ */}
            <div className="hidden lg:flex lg:col-span-3 h-full min-h-0 flex-col items-center justify-between relative select-none overflow-hidden rounded-2xl border border-white/[0.06] bg-gradient-to-b from-[#0b0f19]/60 via-[#080b12]/80 to-[#06080d] py-3 px-2">
              {/* Label atas minimalis */}
              <div className="text-center z-10">
                <span className="text-[9px] font-black uppercase tracking-[0.25em] text-amber-300/70 block">
                  STUDIO LAMP V5
                </span>
                <span className="text-[10px] text-slate-400 font-medium">
                  {activePalette.label}
                </span>
              </div>

              {/* SVG STANDING TRIPOD FLOOR LAMP */}
              <div className="relative flex-1 min-h-0 w-full flex items-center justify-center my-1">
                <div
                  className="absolute top-[10%] w-56 h-56 rounded-full blur-[65px] transition-all duration-700 pointer-events-none"
                  style={{
                    backgroundColor: activePalette.softGlow,
                  }}
                />

                <svg
                  viewBox="0 0 260 520"
                  className="h-full max-h-[430px] w-auto overflow-visible relative z-10"
                >
                  <defs>
                    <linearGradient id="lampLightCone" x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="0%"
                        stopColor={coneStopColor}
                        stopOpacity="0.32"
                      />
                      <stop
                        offset="55%"
                        stopColor={coneStopColor}
                        stopOpacity="0.10"
                      />
                      <stop offset="100%" stopColor={coneStopColor} stopOpacity="0" />
                    </linearGradient>

                    <linearGradient id="pleatedShadeGrad" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor={shadeFill} stopOpacity="0.82" />
                      <stop offset="35%" stopColor={shadeFill} stopOpacity="1" />
                      <stop offset="70%" stopColor={shadeFill} stopOpacity="0.92" />
                      <stop offset="100%" stopColor={shadeFill} stopOpacity="0.72" />
                    </linearGradient>

                    <linearGradient id="tripodLegGrad" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#9a7b56" />
                      <stop offset="50%" stopColor="#d6b485" />
                      <stop offset="100%" stopColor="#6e5438" />
                    </linearGradient>
                  </defs>

                  <polygon
                    points="72,155 188,155 255,495 5,495"
                    fill="url(#lampLightCone)"
                    className="transition-all duration-700"
                  />

                  <ellipse
                    cx="130"
                    cy="495"
                    rx="82"
                    ry="11"
                    fill={activePalette.floorEllipse}
                  />

                  <line
                    x1="130"
                    y1="155"
                    x2="130"
                    y2="492"
                    stroke="#5c462e"
                    strokeWidth="4.5"
                    strokeLinecap="round"
                  />
                  <line
                    x1="122"
                    y1="155"
                    x2="66"
                    y2="496"
                    stroke="url(#tripodLegGrad)"
                    strokeWidth="5.5"
                    strokeLinecap="round"
                  />
                  <line
                    x1="138"
                    y1="155"
                    x2="194"
                    y2="496"
                    stroke="url(#tripodLegGrad)"
                    strokeWidth="5.5"
                    strokeLinecap="round"
                  />

                  <rect x="114" y="174" width="32" height="6" rx="3" fill="#b89468" />

                  <path
                    d="M130 158 Q138 280 128 380 T132 492"
                    fill="none"
                    stroke="#1e2430"
                    strokeWidth="2.2"
                  />

                  <ellipse
                    cx="130"
                    cy="156"
                    rx="56"
                    ry="9"
                    fill={activePalette.ringFill}
                    style={{
                      filter: `drop-shadow(0 0 14px ${coneStopColor})`,
                    }}
                  />

                  <path
                    d="M90 48 L170 48 L192 156 L68 156 Z"
                    fill="url(#pleatedShadeGrad)"
                    stroke={shadeStroke}
                    strokeWidth="1"
                    strokeOpacity="0.45"
                  />

                  {[82, 95, 108, 121, 134, 147, 160, 173].map((bottomX, i) => {
                    const topX = 96 + i * 9.5
                    return (
                      <line
                        key={i}
                        x1={topX}
                        y1="49"
                        x2={bottomX}
                        y2="155"
                        stroke="rgba(15, 23, 42, 0.24)"
                        strokeWidth="1.2"
                      />
                    )
                  })}

                  {/* TALI TARIK SAKELAR LAMPU (TARIK -> UBAH INPUT <-> RIWAYAT) */}
                  <g
                    onClick={handlePullLampCord}
                    className="cursor-pointer group"
                    style={{
                      transform: cordPulled ? 'translateY(12px)' : 'translateY(0px)',
                      transition: 'transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)',
                    }}
                  >
                    <rect x="152" y="155" width="28" height="105" fill="transparent" />
                    <line
                      x1="166"
                      y1="156"
                      x2="166"
                      y2="238"
                      stroke="#cbd5e1"
                      strokeWidth="1.8"
                      strokeDasharray="3 2"
                    />
                    <circle
                      cx="166"
                      cy="243"
                      r="5.5"
                      fill={activePalette.knobColor}
                      stroke="#ffffff"
                      strokeWidth="1.2"
                    />
                    <text
                      x="177"
                      y="222"
                      fill="#94a3b8"
                      fontSize="8.5"
                      fontFamily="monospace"
                      letterSpacing="1"
                    >
                      PULL CORD
                    </text>
                  </g>
                </svg>
              </div>

              {/* Tombol Sakelar Bawah untuk Ganti Input <-> Riwayat */}
              <button
                type="button"
                onClick={handlePullLampCord}
                className="z-10 px-3 py-1 rounded-full border border-white/10 bg-white/[0.04] hover:bg-white/[0.09] text-[10px] font-bold text-amber-200/90 transition cursor-pointer"
              >
                <Lightbulb className="w-4 h-4 inline-block align-middle" /> Tarik Tali → {activeTab === 'input' ? 'Riwayat' : 'Input'}
              </button>
            </div>

            {/* ============================================================
                AREA KONTEN KANAN (9 KOLOM): INPUT PRESENSI ATAU RIWAYAT
               ============================================================ */}
            {activeTab === 'input' ? (
              <div className="lg:col-span-9 grid grid-cols-1 lg:grid-cols-9 gap-3 h-full min-h-0 overflow-hidden">
                {/* KOLOM TENGAH (5 KOLOM): DATA SISWA COMPACT & BISA DI-SCROLL */}
                <div className="lg:col-span-5 rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-2 flex flex-col h-full min-h-0 overflow-hidden shadow-xl">
                  <div className="flex flex-col gap-1.5 pb-1.5 mb-1.5 border-b border-white/10 shrink-0">
                    <div className="flex items-center justify-between gap-1.5">
                      <div className="flex items-center gap-1 flex-wrap">
                        <button
                          type="button"
                          onClick={() => setDeckFilter('ALL')}
                          className={`px-1.5 py-0.5 rounded text-[9px] font-extrabold transition cursor-pointer ${
                            deckFilter === 'ALL'
                              ? 'bg-amber-400 text-slate-950'
                              : 'bg-white/5 text-slate-300 hover:bg-white/10'
                          }`}
                        >
                          Semua ({siswaList.length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeckFilter('BELUM')}
                          className={`px-1.5 py-0.5 rounded text-[9px] font-extrabold transition cursor-pointer ${
                            deckFilter === 'BELUM'
                              ? 'bg-amber-400 text-slate-950'
                              : 'bg-white/5 text-slate-300 hover:bg-white/10'
                          }`}
                        >
                          Belum ({countInputBelum})
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeckFilter('HADIR')}
                          className={`px-1.5 py-0.5 rounded text-[9px] font-extrabold transition cursor-pointer ${
                            deckFilter === 'HADIR'
                              ? 'bg-emerald-400 text-slate-950'
                              : 'bg-white/5 text-emerald-300 hover:bg-white/10'
                          }`}
                        >
                          Hadir ({countInputHadir})
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeckFilter('NON_HADIR')}
                          className={`px-1.5 py-0.5 rounded text-[9px] font-extrabold transition cursor-pointer ${
                            deckFilter === 'NON_HADIR'
                              ? 'bg-rose-500 text-white'
                              : 'bg-white/5 text-rose-300 hover:bg-white/10'
                          }`}
                        >
                          I/S/A ({countInputIzin + countInputSakit + countInputAlpa})
                        </button>
                      </div>

                      {siswaList.length > 0 && (
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={handleAutoHadirAll}
                            className="px-2 py-0.5 rounded bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/40 text-emerald-300 text-[9px] font-extrabold flex items-center gap-0.5 transition cursor-pointer"
                            title="Tandai Semua Hadir"
                          >
                            <Zap className="w-2.5 h-2.5" />
                            <span>Hadir Semua</span>
                          </button>
                          {countInputTotal > 0 && (
                            <button
                              type="button"
                              onClick={handleResetStatus}
                              className="px-1.5 py-0.5 rounded bg-white/5 hover:bg-rose-500/20 text-slate-400 hover:text-rose-300 text-[9px] font-bold transition cursor-pointer"
                            >
                              Reset
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="relative">
                      <Search className="w-3 h-3 text-slate-400 absolute left-2 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={deckSearch}
                        onChange={(e) => setDeckSearch(e.target.value)}
                        placeholder="Cari nama atau NISN siswa SMK..."
                        className="w-full pl-6 pr-2 py-1 rounded-lg border border-white/10 bg-[#0c111e] text-[10px] font-bold text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-400"
                      />
                    </div>
                  </div>

                  {!selectedKelasId || !selectedMapelId ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-center p-4">
                      <Users className="w-7 h-7 text-amber-300/70 mb-1.5" />
                      <h3 className="text-xs font-black text-white">
                        Pilih Sesi di Panel Kanan
                      </h3>
                      <p className="text-[11px] text-slate-400 max-w-xs mt-0.5">
                        Klik jadwal SMK atau pilih Kelas &amp; Mapel di kolom kanan untuk
                        memuat daftar siswa.
                      </p>
                    </div>
                  ) : loadingSiswa ? (
                    <div className="flex-1 flex items-center justify-center text-xs font-bold text-amber-300">
                      Memuat daftar siswa SMK...
                    </div>
                  ) : filteredDeckSiswa.length === 0 ? (
                    <div className="flex-1 flex items-center justify-center text-xs text-slate-400">
                      Tidak ada siswa pada filter ini.
                    </div>
                  ) : (
                    <div className="flex-1 min-h-0 overflow-y-auto pr-1 divide-y divide-white/[0.06]">
                      {filteredDeckSiswa.map((siswa, idx) => {
                        const sId = String(siswa.id)
                        const st = absensiMap[sId]
                        const kObj = Array.isArray(siswa.kelas)
                          ? siswa.kelas[0]
                          : siswa.kelas
                        const namaKelasSiswa = kObj?.nama_kelas || ''

                        const rowBg =
                          st === 'HADIR'
                            ? 'bg-emerald-500/[0.07]'
                            : st === 'IZIN'
                            ? 'bg-amber-400/[0.07]'
                            : st === 'SAKIT'
                            ? 'bg-cyan-500/[0.07]'
                            : st === 'ALPA'
                            ? 'bg-rose-500/[0.10]'
                            : 'hover:bg-white/[0.03]'

                        return (
                          <div
                            key={sId}
                            className={`py-1 px-1.5 flex items-center justify-between gap-1.5 transition-colors rounded-md ${rowBg}`}
                          >
                            <div className="min-w-0 flex-1 flex items-center gap-1.5">
                              <span className="text-[9px] font-mono text-slate-500 w-4 text-right shrink-0">
                                {idx + 1}.
                              </span>
                              <div className="min-w-0 flex-1">
                                <p className="text-[11px] font-extrabold text-white truncate leading-tight">
                                  {siswa.nama_lengkap}
                                </p>
                                <p className="text-[8.5px] font-mono text-slate-400 truncate leading-tight">
                                  {siswa.nisn || '-'}
                                  {selectedKelasId === 'ALL' && namaKelasSiswa
                                    ? ` • ${namaKelasSiswa}`
                                    : ''}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-0.5 shrink-0 bg-[#090d16] p-0.5 rounded-md border border-white/10">
                              <button
                                type="button"
                                onClick={() => handleToggleStatus(sId, 'HADIR')}
                                className={`w-5 h-5 rounded text-[9px] font-black transition cursor-pointer ${
                                  st === 'HADIR'
                                    ? 'bg-emerald-400 text-slate-950'
                                    : 'text-emerald-400 hover:bg-emerald-500/20'
                                }`}
                                title="Hadir"
                              >
                                H
                              </button>
                              <button
                                type="button"
                                onClick={() => handleToggleStatus(sId, 'IZIN')}
                                className={`w-5 h-5 rounded text-[9px] font-black transition cursor-pointer ${
                                  st === 'IZIN'
                                    ? 'bg-amber-400 text-slate-950'
                                    : 'text-amber-400 hover:bg-amber-400/20'
                                }`}
                                title="Izin"
                              >
                                I
                              </button>
                              <button
                                type="button"
                                onClick={() => handleToggleStatus(sId, 'SAKIT')}
                                className={`w-5 h-5 rounded text-[9px] font-black transition cursor-pointer ${
                                  st === 'SAKIT'
                                    ? 'bg-cyan-400 text-slate-950'
                                    : 'text-cyan-400 hover:bg-cyan-400/20'
                                }`}
                                title="Sakit"
                              >
                                S
                              </button>
                              <button
                                type="button"
                                onClick={() => handleToggleStatus(sId, 'ALPA')}
                                className={`w-5 h-5 rounded text-[9px] font-black transition cursor-pointer ${
                                  st === 'ALPA'
                                    ? 'bg-rose-500 text-white'
                                    : 'text-rose-400 hover:bg-rose-500/20'
                                }`}
                                title="Alpa"
                              >
                                A
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>

                {/* KOLOM KANAN (4 KOLOM): KONTROL SESI, JADWAL, SCAN QR & SIMPAN */}
                <div className="lg:col-span-4 flex flex-col h-full min-h-0 overflow-y-auto pl-0.5 space-y-2">
                  {/* BAR ATAS: SCAN QR DINAMIS */}
                  <div className="rounded-2xl border border-amber-400/25 bg-gradient-to-r from-amber-400/10 via-[#0b101d] to-[#0b101d] p-2.5 flex items-center justify-between gap-2 shrink-0">
                    <div>
                      <span className="text-[9px] font-black uppercase tracking-wider text-amber-300 block">
                        Presensi Cepat Kartu Pelajar
                      </span>
                      <p className="text-[10px] font-bold text-slate-300">
                        {selectedKelasId && selectedMapelId
                          ? 'Kamera siap memindai QR NISN'
                          : 'Pilih kelas & mapel lalu scan QR'}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowQrModal(true)}
                      className="px-2.5 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-[10px] flex items-center gap-1 shadow-lg shadow-amber-400/20 transition cursor-pointer shrink-0"
                      title="Buka Kamera Scan QR Siswa SMK"
                    >
                      <QrCode className="w-3.5 h-3.5" />
                      <span>SCAN QR</span>
                    </button>
                  </div>

                  {/* FORM PARAMETER SESI MENGAJAR */}
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-2.5 space-y-2 shrink-0">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase tracking-wider text-amber-300 flex items-center gap-1">
                        <SlidersHorizontal className="w-3 h-3" /> Parameter Sesi SMK
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-white/5 text-slate-300 border border-white/10">
                        Hari: {hari}
                      </span>
                    </div>

                    <div className="grid grid-cols-12 gap-1.5">
                      <div className="col-span-6">
                        <label className="text-[9px] font-bold text-slate-400 block mb-0.5">
                          Tanggal
                        </label>
                        <input
                          type="date"
                          value={tanggal}
                          max={todayStr}
                          onChange={(e) => {
                            const val = e.target.value
                            setTanggal(val)
                            if (val) {
                              const p = val.split('-').map(Number)
                              const d = new Date(p[0], p[1] - 1, p[2])
                              const nHari = [
                                'Minggu',
                                'Senin',
                                'Selasa',
                                'Rabu',
                                'Kamis',
                                'Jumat',
                                'Sabtu',
                              ][d.getDay()]
                              if (nHari !== 'Jumat') setHari(nHari)
                            }
                          }}
                          className="w-full border border-white/10 bg-[#0d1322] text-white rounded-lg px-2 py-1 text-[10px] font-bold focus:outline-none focus:border-amber-400"
                        />
                      </div>

                      <div className="col-span-3">
                        <label className="text-[9px] font-bold text-slate-400 block mb-0.5">
                          Mulai
                        </label>
                        <select
                          value={jamMulai}
                          onChange={(e) => {
                            const val = e.target.value
                            setJamMulai(val)
                            if (Number(val) > Number(jamSelesai)) setJamSelesai(val)
                          }}
                          className="w-full border border-white/10 bg-[#0d1322] text-white rounded-lg px-1 py-1 text-[10px] font-bold focus:outline-none focus:border-amber-400"
                        >
                          {jamOptionsForHari.length > 0
                            ? jamOptionsForHari.map((j) => (
                                <option key={j.id} value={j.jam_ke}>
                                  JP {j.jam_ke}
                                </option>
                              ))
                            : [1, 2, 3, 4, 5, 6, 7, 8].map((num) => (
                                <option key={num} value={num}>
                                  JP {num}
                                </option>
                              ))}
                        </select>
                      </div>

                      <div className="col-span-3">
                        <label className="text-[9px] font-bold text-slate-400 block mb-0.5">
                          Selesai
                        </label>
                        <select
                          value={jamSelesai}
                          onChange={(e) => setJamSelesai(e.target.value)}
                          className="w-full border border-white/10 bg-[#0d1322] text-white rounded-lg px-1 py-1 text-[10px] font-bold focus:outline-none focus:border-amber-400"
                        >
                          {jamOptionsForHari.length > 0
                            ? jamOptionsForHari
                                .filter((j) => j.jam_ke >= Number(jamMulai))
                                .map((j) => (
                                  <option key={j.id} value={j.jam_ke}>
                                    JP {j.jam_ke}
                                  </option>
                                ))
                            : [1, 2, 3, 4, 5, 6, 7, 8]
                                .filter((num) => num >= Number(jamMulai))
                                .map((num) => (
                                  <option key={num} value={num}>
                                    JP {num}
                                  </option>
                                ))}
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-1.5">
                      <div>
                        <label className="text-[9px] font-bold text-slate-400 block mb-0.5">
                          Kelas Jurusan
                        </label>
                        <select
                          value={selectedKelasId}
                          onChange={(e) => setSelectedKelasId(e.target.value)}
                          className="w-full border border-white/10 bg-[#0d1322] text-white rounded-lg px-2 py-1 text-[10px] font-bold focus:outline-none focus:border-amber-400"
                        >
                          <option value="">-- Pilih Kelas --</option>
                          {kelasList.length > 0 && (
                            <option value="ALL">Semua Kelas DKV ({kelasList.length})</option>
                          )}
                          {kelasList.map((k) => (
                            <option key={k.id} value={k.id}>
                              {k.nama}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="text-[9px] font-bold text-slate-400 block mb-0.5">
                          Mata Pelajaran
                        </label>
                        <select
                          value={selectedMapelId}
                          onChange={(e) => setSelectedMapelId(e.target.value)}
                          className="w-full border border-white/10 bg-[#0d1322] text-white rounded-lg px-2 py-1 text-[10px] font-bold focus:outline-none focus:border-amber-400"
                        >
                          <option value="">-- Pilih Mapel --</option>
                          {mapelList.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.nama}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {isOperator && (
                      <div className="mt-1.5">
                        <label className="text-[9px] font-bold text-slate-400 block mb-0.5">
                          Guru Pengampu (pilih bila input manual/insidental)
                        </label>
                        <select
                          value={selectedGuruEmail}
                          onChange={(e) => setSelectedGuruEmail(e.target.value)}
                          className="w-full border border-white/10 bg-[#0d1322] text-white rounded-lg px-2 py-1 text-[10px] font-bold focus:outline-none focus:border-amber-400"
                        >
                          <option value="">-- Pilih Guru Pengampu --</option>
                          {guruList.map((g) => (
                            <option key={g.email} value={g.email}>{g.nama}</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>

                  {/* JADWAL SMK HARI INI */}
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-2.5 flex-1 flex flex-col min-h-[100px] overflow-hidden">
                    <div className="flex items-center justify-between mb-1.5 shrink-0">
                      <span className="text-[10px] font-black uppercase tracking-wider text-amber-300 flex items-center gap-1">
                        <Sparkles className="w-3 h-3" /> Jadwal SMK ({hari})
                      </span>
                      <span className="text-[9px] text-slate-400">Klik pilih cepat</span>
                    </div>

                    {jadwalHariIniGrouped.length === 0 ? (
                      <div className="flex-1 flex items-center justify-center text-[11px] text-slate-500 text-center">
                        Tidak ada slot jadwal SMK tercatat pada hari {hari}.
                      </div>
                    ) : (
                      <div className="flex-1 min-h-0 overflow-y-auto space-y-1 pr-0.5">
                        {jadwalHariIniGrouped.map((group, idx) => {
                          const sorted = [...group].sort((a, b) => a.jam_ke - b.jam_ke)
                          const first = sorted[0]
                          const last = sorted[sorted.length - 1]
                          const jpLabel =
                            first.jam_ke === last.jam_ke
                              ? `JP ${first.jam_ke}`
                              : `JP ${first.jam_ke}–${last.jam_ke}`
                          const isSelected =
                            String(first.mapel_id || '') === selectedMapelId &&
                            (first.kelas_id ? String(first.kelas_id) : 'ALL') === selectedKelasId

                          return (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => handleSelectJadwalPreset(group)}
                              className={`w-full text-left px-2 py-1.5 rounded-xl border transition flex items-center justify-between gap-2 cursor-pointer ${
                                isSelected
                                  ? 'bg-amber-400 text-slate-950 border-amber-300 font-black shadow-sm'
                                  : 'bg-white/[0.03] hover:bg-white/[0.07] text-slate-200 border-white/10'
                              }`}
                            >
                              <div className="min-w-0">
                                <p className="text-[10px] font-extrabold truncate">
                                  {first.nama_mapel}
                                </p>
                                <p
                                  className={`text-[9px] font-mono ${
                                    isSelected ? 'text-slate-900 font-bold' : 'text-slate-400'
                                  }`}
                                >
                                  Kelas: {first.nama_kelas}
                                </p>
                              </div>
                              <span
                                className={`text-[9px] font-black px-1.5 py-0.5 rounded shrink-0 ${
                                  isSelected
                                    ? 'bg-slate-950 text-amber-300'
                                    : 'bg-amber-400/15 text-amber-300 border border-amber-400/30'
                                }`}
                              >
                                {jpLabel}
                              </span>
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>

                  {/* LIVE COUNTER & TOMBOL SIMPAN */}
                  <div className="rounded-2xl border border-white/10 bg-[#0b101d]/95 p-2.5 space-y-2 shrink-0">
                    <div className="grid grid-cols-4 gap-1 text-center">
                      <div className="rounded-lg bg-emerald-500/10 border border-emerald-400/25 py-1">
                        <span className="text-[8px] font-black text-emerald-300 block">HADIR</span>
                        <span className="text-xs font-black text-white">{countInputHadir}</span>
                      </div>
                      <div className="rounded-lg bg-amber-400/10 border border-amber-400/25 py-1">
                        <span className="text-[8px] font-black text-amber-300 block">IZIN</span>
                        <span className="text-xs font-black text-white">{countInputIzin}</span>
                      </div>
                      <div className="rounded-lg bg-cyan-500/10 border border-cyan-400/25 py-1">
                        <span className="text-[8px] font-black text-cyan-300 block">SAKIT</span>
                        <span className="text-xs font-black text-white">{countInputSakit}</span>
                      </div>
                      <div className="rounded-lg bg-rose-500/10 border border-rose-400/25 py-1">
                        <span className="text-[8px] font-black text-rose-300 block">ALPA</span>
                        <span className="text-xs font-black text-white">{countInputAlpa}</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleSimpanAbsensiSmk}
                      disabled={
                        saving ||
                        !selectedKelasId ||
                        !selectedMapelId ||
                        countInputTotal === 0
                      }
                      className="w-full py-2 rounded-xl bg-amber-400 hover:bg-amber-300 disabled:bg-white/5 disabled:text-slate-500 text-slate-950 font-black text-[11px] transition shadow-lg shadow-amber-400/20 disabled:shadow-none flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>
                        {saving
                          ? 'Menyimpan...'
                          : `SIMPAN PRESENSI SMK (${countInputTotal}/${siswaList.length})`}
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              /* ============================================================
                 TAB 2: RIWAYAT & REKAPITULASI PRESENSI SMK (9 KOLOM KANAN LAMPU)
                 ============================================================ */
              <div className="lg:col-span-9 flex flex-col h-full min-h-0 overflow-hidden space-y-2">
                <div className="grid grid-cols-5 gap-1.5 shrink-0 text-center">
                  <motion.div
                    whileHover={{ y: -2 }}
                    className="border border-white/10 bg-white/[0.04] backdrop-blur-md rounded-xl p-1.5"
                  >
                    <div className="flex items-center justify-center gap-1 text-[8px] font-black uppercase text-slate-400">
                      <Users className="w-2.5 h-2.5" />
                      <span>TOTAL</span>
                    </div>
                    <p className="text-xs font-black text-white mt-0.5">{totalData}</p>
                  </motion.div>

                  <motion.div
                    whileHover={{ y: -2 }}
                    className="border border-emerald-400/25 bg-emerald-500/10 backdrop-blur-md rounded-xl p-1.5"
                  >
                    <div className="flex items-center justify-center gap-1 text-[8px] font-black uppercase text-emerald-300">
                      <UserCheck className="w-2.5 h-2.5" />
                      <span>HADIR</span>
                    </div>
                    <p className="text-xs font-black text-emerald-200 mt-0.5">{totalHadir}</p>
                  </motion.div>

                  <motion.div
                    whileHover={{ y: -2 }}
                    className="border border-amber-400/25 bg-amber-400/10 backdrop-blur-md rounded-xl p-1.5"
                  >
                    <div className="flex items-center justify-center gap-1 text-[8px] font-black uppercase text-amber-300">
                      <FileWarning className="w-2.5 h-2.5" />
                      <span>IZIN</span>
                    </div>
                    <p className="text-xs font-black text-amber-200 mt-0.5">{totalIzin}</p>
                  </motion.div>

                  <motion.div
                    whileHover={{ y: -2 }}
                    className="border border-cyan-400/25 bg-cyan-500/10 backdrop-blur-md rounded-xl p-1.5"
                  >
                    <div className="flex items-center justify-center gap-1 text-[8px] font-black uppercase text-cyan-300">
                      <HeartPulse className="w-2.5 h-2.5" />
                      <span>SAKIT</span>
                    </div>
                    <p className="text-xs font-black text-cyan-200 mt-0.5">{totalSakit}</p>
                  </motion.div>

                  <motion.div
                    whileHover={{ y: -2 }}
                    className="border border-rose-400/25 bg-rose-500/10 backdrop-blur-md rounded-xl p-1.5"
                  >
                    <div className="flex items-center justify-center gap-1 text-[8px] font-black uppercase text-rose-300">
                      <UserX className="w-2.5 h-2.5" />
                      <span>ALPA</span>
                    </div>
                    <p className="text-xs font-black text-rose-200 mt-0.5">{totalAlpa}</p>
                  </motion.div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5 border border-white/10 bg-white/[0.04] backdrop-blur-md p-1.5 rounded-xl shrink-0">
                  <select
                    value={filterKelasId}
                    onChange={(e) => setFilterKelasId(e.target.value)}
                    className="border border-white/10 bg-[#0d1322] text-white rounded-lg px-2 py-1 text-[11px] font-bold focus:outline-none"
                  >
                    <option value="">Semua Kelas SMK</option>
                    {kelasList.map((k) => (
                      <option key={k.id} value={k.id}>
                        {k.nama}
                      </option>
                    ))}
                  </select>

                  <select
                    value={filterMapelId}
                    onChange={(e) => setFilterMapelId(e.target.value)}
                    className="border border-white/10 bg-[#0d1322] text-white rounded-lg px-2 py-1 text-[11px] font-bold focus:outline-none"
                  >
                    <option value="">Semua Mapel SMK</option>
                    {mapelList.map((m) => (
                      <option key={m.id} value={m.nama}>
                        {m.nama}
                      </option>
                    ))}
                  </select>

                  <input
                    type="date"
                    value={filterTanggal}
                    onChange={(e) => setFilterTanggal(e.target.value)}
                    className="border border-white/10 bg-[#0d1322] text-white rounded-lg px-2 py-1 text-[11px] font-bold focus:outline-none"
                  />

                  <input
                    type="text"
                    value={searchNama}
                    onChange={(e) => setSearchNama(e.target.value)}
                    placeholder="Cari nama siswa SMK..."
                    className="border border-white/10 bg-[#0d1322] text-white rounded-lg px-2 py-1 text-[11px] font-bold focus:outline-none placeholder:text-slate-500"
                  />
                </div>

                <div className="border border-white/10 bg-white/[0.04] backdrop-blur-xl rounded-2xl p-2 flex-1 min-h-0 flex flex-col overflow-hidden shadow-lg">
                  {loadingRekap ? (
                    <div className="flex-1 flex items-center justify-center text-xs font-medium text-amber-300">
                      Memuat riwayat presensi SMK...
                    </div>
                  ) : rekapList.length === 0 ? (
                    <div className="flex-1 flex items-center justify-center text-xs font-medium text-slate-400">
                      Tidak ada riwayat presensi SMK pada filter ini.
                    </div>
                  ) : (
                    <div className="flex-1 min-h-0 overflow-y-auto pr-1 grid grid-cols-1 md:grid-cols-2 gap-1.5 content-start">
                      {rekapList.map((item, index) => (
                        <div
                          key={item.id || index}
                          className="p-2 rounded-xl border border-white/10 bg-[#0b101d]/80 hover:border-amber-400/30 transition flex items-center justify-between gap-2"
                        >
                          <div className="min-w-0 flex-1">
                            <h4 className="text-[11px] font-extrabold truncate text-white">
                              {item.nama_siswa}
                            </h4>
                            <p className="text-[9px] font-mono text-slate-400 truncate">
                              <CalendarDays className="w-4 h-4 inline-block align-middle" /> {item.tanggal} • {item.kelas} • {item.mapel}
                            </p>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <span
                              className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase border ${
                                item.status === 'HADIR'
                                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-400/40'
                                  : item.status === 'IZIN'
                                  ? 'bg-amber-400/15 text-amber-300 border-amber-400/40'
                                  : item.status === 'SAKIT'
                                  ? 'bg-cyan-500/15 text-cyan-300 border-cyan-400/40'
                                  : 'bg-rose-500/15 text-rose-300 border-rose-400/40'
                              }`}
                            >
                              {item.status}
                            </span>
                            <button
                              onClick={async () => {
                                if (item.id && confirm('Hapus record absensi SMK ini?')) {
                                  await supabase.from('absensi').delete().eq('id', item.id)
                                  setRekapList((prev) => prev.filter((r) => r.id !== item.id))
                                }
                              }}
                              className="text-rose-400 hover:text-rose-300 p-1 cursor-pointer"
                              title="Hapus Record"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* QR SCANNER MODAL POPUP */}
      {showQrModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-2xl p-4 border border-amber-400/30 bg-[#0d121f] text-white shadow-2xl flex flex-col items-center space-y-3">
            <div className="w-full flex items-center justify-between">
              <h3 className="text-xs font-black uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                <Camera className="w-4 h-4" /> Scan QR Kartu Pelajar SMK
              </h3>
              <button
                onClick={() => {
                  if (qrScannerRef.current && qrScannerRef.current.isScanning) {
                    qrScannerRef.current.stop().catch(() => {})
                  }
                  setShowQrModal(false)
                }}
                className="text-slate-400 hover:text-rose-400 font-extrabold text-sm p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="w-full overflow-hidden rounded-xl border-2 border-amber-400/70 bg-black relative">
              <div id="reader-smk" className="w-full"></div>
              {isScanning && (
                <div className="absolute inset-0 bg-emerald-500/20 backdrop-blur-xs flex items-center justify-center">
                  <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between w-full pt-1">
              <button
                type="button"
                onClick={toggleCameraFacing}
                className="text-[11px] font-bold text-amber-300 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <RotateCw className="w-3 h-3" /> Putar Kamera (
                {facingMode === 'environment' ? 'Belakang' : 'Depan'})
              </button>
              <button
                onClick={() => setShowQrModal(false)}
                className="px-3 py-1 bg-white/10 hover:bg-white/15 text-white text-xs font-bold rounded-lg cursor-pointer"
              >
                Tutup
              </button>
            </div>

            {scanStatus && (
              <div
                className={`w-full text-center px-3 py-1.5 rounded-lg text-xs font-extrabold border ${
                  scanStatus.type === 'success'
                    ? 'bg-emerald-500/20 text-emerald-200 border-emerald-400/40'
                    : scanStatus.type === 'warning'
                    ? 'bg-amber-500/20 text-amber-200 border-amber-400/40'
                    : 'bg-rose-500/20 text-rose-200 border-rose-400/40'
                }`}
              >
                {scanStatus.msg}
              </div>
            )}
          </div>
        </div>
      )}
    </motion.div>
  )
}