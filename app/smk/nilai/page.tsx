'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuthRole } from '@/hooks/useAuthRole'
import {
  ArrowLeft,
  LogOut,
  GraduationCap,
  Save,
  Trash2,
  Search,
  Award,
  CheckCircle2,
  Sparkles,
  History,
  BookOpen,
} from 'lucide-react'

const getSupabaseUrl = () => {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://kvrulbdvgxfrtmznpjnm.supabase.co'
  return url.replace(/['"]/g, '').trim()
}

const getSupabaseAnonKey = () => {
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder'
  return key.replace(/['"]/g, '').trim()
}

const supabase = createClient(getSupabaseUrl(), getSupabaseAnonKey())

interface Siswa {
  id: number
  nisn: string
  nama_lengkap: string
  kelas_id?: number
  jenjang?: string | null
}

interface OptionItem {
  id: number
  nama: string
}

interface NilaiRecord {
  id?: number | string
  created_at?: string
  siswa_id: number
  kelas_id?: number
  mata_pelajaran?: string
  mapel_id?: number
  nilai_tugas?: number
  nilai_uts?: number
  nilai_uas?: number
  semester?: string
  tahun_ajaran?: string
  guru_email?: string
  jenjang?: string | null
  siswa?: {
    nama_lengkap?: string
    nisn?: string
    kelas?: {
      nama_kelas?: string
    }
  } | null
}

interface NilaiMap {
  [siswaId: string]: number | ''
}

interface LampTheme {
  id: string
  name: string
  bulbCore: string
  bulbGlass: string
  filament: string
  glowRgba: string
  falloffNear: string
  falloffMid: string
  falloffFar: string
  cardTint: string
  borderGlow: string
  badgeBg: string
  badgeText: string
  accentSolid: string
}

const LAMP_THEMES: LampTheme[] = [
  {
    id: 'warm-gold',
    name: 'Warm Gold',
    bulbCore: '#fef08a',
    bulbGlass: '#fde047',
    filament: '#d97706',
    glowRgba: 'rgba(251, 191, 36, 0.44)',
    falloffNear: 'rgba(251, 191, 36, 0.26)',
    falloffMid: 'rgba(245, 158, 11, 0.08)',
    falloffFar: 'rgba(6, 8, 14, 0)',
    cardTint: 'rgba(251, 191, 36, 0.065)',
    borderGlow: 'rgba(251, 191, 36, 0.30)',
    badgeBg: 'rgba(251, 191, 36, 0.16)',
    badgeText: '#fcd34d',
    accentSolid: '#fbbf24',
  },
  {
    id: 'arctic-cyan',
    name: 'Studio Cyan',
    bulbCore: '#e0f2fe',
    bulbGlass: '#38bdf8',
    filament: '#0284c7',
    glowRgba: 'rgba(56, 189, 248, 0.44)',
    falloffNear: 'rgba(56, 189, 248, 0.26)',
    falloffMid: 'rgba(14, 165, 233, 0.08)',
    falloffFar: 'rgba(6, 8, 14, 0)',
    cardTint: 'rgba(56, 189, 248, 0.065)',
    borderGlow: 'rgba(56, 189, 248, 0.30)',
    badgeBg: 'rgba(56, 189, 248, 0.16)',
    badgeText: '#7dd3fc',
    accentSolid: '#38bdf8',
  },
  {
    id: 'coral-rose',
    name: 'Coral Sunset',
    bulbCore: '#ffe4e6',
    bulbGlass: '#fb7185',
    filament: '#e11d48',
    glowRgba: 'rgba(251, 113, 133, 0.42)',
    falloffNear: 'rgba(251, 113, 133, 0.24)',
    falloffMid: 'rgba(244, 63, 94, 0.07)',
    falloffFar: 'rgba(6, 8, 14, 0)',
    cardTint: 'rgba(251, 113, 133, 0.065)',
    borderGlow: 'rgba(251, 113, 133, 0.30)',
    badgeBg: 'rgba(251, 113, 133, 0.16)',
    badgeText: '#fda4af',
    accentSolid: '#fb7185',
  },
]

export default function SmkPenilaianPage() {
  const router = useRouter()
  const { isOperator } = useAuthRole()

  const [userDisplayName, setUserDisplayName] = useState('MEMUAT...')
  const [userNuptkDisplay, setUserNuptkDisplay] = useState('-')
  const [isStrictOperatorRole, setIsStrictOperatorRole] = useState(false)
  const [waliKelasAssignedId, setWaliKelasAssignedId] = useState<number | null>(null)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'input' | 'rekap'>('input')
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [logoFallbackIndex, setLogoFallbackIndex] = useState(0)

  // =========================================================================
  // STATE ANIMASI IMPOSSIBLE LIGHT BULB (PERSIS REFERENSI VIDEO)
  // =========================================================================
  const [isBulbOn, setIsBulbOn] = useState(true)
  const [themeIndex, setThemeIndex] = useState(0)
  const [cordStretch, setCordStretch] = useState(0)
  const [cordSwingAngle, setCordSwingAngle] = useState(0)
  const [doorCrackRatio, setDoorCrackRatio] = useState(0) // 0 = rapat, 0.22 = celah pintu
  const [bearHeadPeek, setBearHeadPeek] = useState(false)
  const [bearArmReach, setBearArmReach] = useState(false)
  const [pullCounter, setPullCounter] = useState(0)
  const [isAnimatingScene, setIsAnimatingScene] = useState(false)
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([])

  const currentTheme = LAMP_THEMES[themeIndex % LAMP_THEMES.length]

  // Global Filter Periode Akademik
  const [selectedSemester, setSelectedSemester] = useState<'Ganjil' | 'Genap'>('Ganjil')
  const [selectedTahunAjaran, setSelectedTahunAjaran] = useState('2026/2027')

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

  // Dynamic Options Khusus SMK
  const [kelasList, setKelasList] = useState<OptionItem[]>([])
  const [mapelList, setMapelList] = useState<OptionItem[]>([])

  // State Input Nilai SMK
  const [selectedKelasId, setSelectedKelasId] = useState('')
  const [selectedMapelId, setSelectedMapelId] = useState('')
  const [jenisPenilaian, setJenisPenilaian] = useState<
    'nilai_tugas' | 'nilai_uts' | 'nilai_uas'
  >('nilai_tugas')
  const [siswaList, setSiswaList] = useState<Siswa[]>([])
  const [nilaiInputMap, setNilaiInputMap] = useState<NilaiMap>({})
  const [searchInputSiswa, setSearchInputSiswa] = useState('')
  const [loadingSiswa, setLoadingSiswa] = useState(false)
  const [saving, setSaving] = useState(false)

  // State Rekapitulasi Nilai SMK
  const [rekapList, setRekapList] = useState<NilaiRecord[]>([])
  const [filterKelasId, setFilterKelasId] = useState('')
  const [filterMapelId, setFilterMapelId] = useState('')
  const [searchNama, setSearchNama] = useState('')
  const [loadingRekap, setLoadingRekap] = useState(false)

  const logoCandidates = ['/logo-smk.jpg', '/logo-smk.png', '/logo-smp.jpg']

  useEffect(() => {
    return () => {
      timersRef.current.forEach(clearTimeout)
    }
  }, [])

  // =========================================================================
  // KOREOGRAFI LEMBUT SESUAI VIDEO:
  // Klik lampu/tali -> celah pintu terbuka tipis -> beruang mengintip & lengan
  // menjulur menarik tali -> lampu ganti warna & menyinari kolom kiri!
  // =========================================================================
  const handleLampOrCordClick = useCallback(() => {
    if (isAnimatingScene) return
    setIsAnimatingScene(true)

    timersRef.current.forEach(clearTimeout)
    timersRef.current = []

    const nextTab = activeTab === 'input' ? 'rekap' : 'input'
    const showFacePeek = pullCounter % 2 === 1 // Bergantian: lengan saja vs kepala mengintip + lengan

    // 1. Sentuhan awal tali sedikit berayun lembut
    setCordSwingAngle(5)
    setCordStretch(8)

    // 2. Celah pintu terbuka sedikit (sekitar 22% lebar pintu, engsel di kanan)
    const t1 = setTimeout(() => {
      setCordSwingAngle(0)
      setCordStretch(0)
      setDoorCrackRatio(showFacePeek ? 0.25 : 0.19)
    }, 180)

    // 3. Kepala beruang mengintip dari balik celah kusen (pada variasi kedua) & lengan menjulur ke tali
    const t2 = setTimeout(() => {
      if (showFacePeek) setBearHeadPeek(true)
      setBearArmReach(true)
    }, 460)

    // 4. Telapak beruang menarik tali lampu ke bawah dengan pegas lembut
    const t3 = setTimeout(() => {
      setCordStretch(24)
      setCordSwingAngle(-3)
      setIsBulbOn(false)
    }, 820)

    // 5. Tali memantul kembali, lampu menyala dengan WARNA BARU & layout kiri berganti mulus
    const t4 = setTimeout(() => {
      setCordStretch(0)
      setCordSwingAngle(2)
      setThemeIndex((prev) => (prev + 1) % LAMP_THEMES.length)
      setIsBulbOn(true)
      setActiveTab(nextTab)
      setPullCounter((prev) => prev + 1)
    }, 1150)

    // 6. Beruang menarik lengan & kepala kembali ke dalam celah pintu
    const t5 = setTimeout(() => {
      setCordSwingAngle(0)
      setBearArmReach(false)
      setBearHeadPeek(false)
    }, 1380)

    // 7. Pintu menutup rapat kembali dengan lembut
    const t6 = setTimeout(() => {
      setDoorCrackRatio(0)
      setIsAnimatingScene(false)
    }, 1760)

    timersRef.current.push(t1, t2, t3, t4, t5, t6)
  }, [activeTab, isAnimatingScene, pullCounter])

  const fetchOptionsSmk = useCallback(
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
            .select('id, nama_mapel, jenjang')
            .eq('jenjang', 'SMK')
            .order('nama_mapel', { ascending: true }),
          supabase
            .from('jadwal')
            .select(
              `
              kelas_id,
              mapel_id,
              guru_email,
              jenjang,
              kelas:kelas_id(id, nama_kelas),
              mapel:mapel_id(id, nama_mapel)
            `
            )
            .eq('jenjang', 'SMK'),
        ])

        const allSmkKelas: OptionItem[] = (resKelas.data || []).map((k: any) => ({
          id: Number(k.id),
          nama: String(k.nama_kelas),
        }))
        const allSmkMapel: OptionItem[] = (resMapel.data || []).map((m: any) => ({
          id: Number(m.id),
          nama: String(m.nama_mapel),
        }))

        if (isOperator) {
          setKelasList(allSmkKelas)
          setMapelList(allSmkMapel)
          return
        }

        const cleanEmail = email.trim().toLowerCase()
        const myJadwal = (resJadwal.data || []).filter(
          (j: any) => (j.guru_email || '').trim().toLowerCase() === cleanEmail
        )

        const uniqueKelasMap = new Map<number, string>()
        const uniqueMapelMap = new Map<number, string>()
        let hasGabunganSemuaKelas = false

        myJadwal.forEach((item: any) => {
          const kObj = Array.isArray(item.kelas) ? item.kelas[0] : item.kelas
          const mObj = Array.isArray(item.mapel) ? item.mapel[0] : item.mapel

          if (kObj && kObj.id) {
            uniqueKelasMap.set(Number(kObj.id), String(kObj.nama_kelas))
          } else if (!item.kelas_id) {
            hasGabunganSemuaKelas = true
          }

          if (mObj && mObj.id) {
            uniqueMapelMap.set(Number(mObj.id), String(mObj.nama_mapel))
          }
        })

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
      } catch (err) {
        console.error('Error fetching options SMK:', err)
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

      await fetchOptionsSmk(rawEmail)
    }

    getUserData()

    return () => {
      isMounted = false
    }
  }, [isOperator, router, fetchOptionsSmk])

  // Fetch Siswa Berdasarkan Kelas ID (Khusus SMK)
  useEffect(() => {
    async function fetchSiswaSmk() {
      if (!selectedKelasId) {
        setSiswaList([])
        setNilaiInputMap({})
        return
      }

      setLoadingSiswa(true)
      try {
        const { data, error } = await supabase
          .from('siswa')
          .select('id, nisn, nama_lengkap, kelas_id, jenjang')
          .eq('kelas_id', Number(selectedKelasId))
          .eq('jenjang', 'SMK')
          .order('nama_lengkap', { ascending: true })

        if (!error && data) {
          setSiswaList(data)

          if (selectedMapelId) {
            const { data: existingNilai } = await supabase
              .from('nilai')
              .select('*')
              .eq('kelas_id', Number(selectedKelasId))
              .eq('mapel_id', Number(selectedMapelId))
              .eq('semester', selectedSemester)
              .eq('tahun_ajaran', selectedTahunAjaran)
              .eq('jenjang', 'SMK')

            const initialMap: NilaiMap = {}
            data.forEach((s) => {
              const matched = (existingNilai || []).find(
                (n: Record<string, any>) => Number(n.siswa_id) === Number(s.id)
              )
              const val = matched
                ? (matched as Record<string, any>)[jenisPenilaian]
                : undefined
              initialMap[String(s.id)] =
                val !== undefined && val !== null ? Number(val) : ''
            })
            setNilaiInputMap(initialMap)
          } else {
            const initialMap: NilaiMap = {}
            data.forEach((s) => {
              initialMap[String(s.id)] = ''
            })
            setNilaiInputMap(initialMap)
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
    jenisPenilaian,
    selectedSemester,
    selectedTahunAjaran,
    activeTab,
  ])

  // Fetch Rekapitulasi Nilai SMK
  const fetchRekapSmk = useCallback(async () => {
    setLoadingRekap(true)
    try {
      let query = supabase
        .from('nilai')
        .select('*, siswa:siswa_id(nama_lengkap, nisn, kelas:kelas_id(nama_kelas))')
        .eq('jenjang', 'SMK')
        .eq('semester', selectedSemester)
        .eq('tahun_ajaran', selectedTahunAjaran)
        .order('created_at', { ascending: false })

      if (!isOperator && userEmail) {
        query = query.ilike('guru_email', userEmail.trim())
      }

      if (filterKelasId) query = query.eq('kelas_id', Number(filterKelasId))
      if (filterMapelId) query = query.eq('mapel_id', Number(filterMapelId))

      const { data, error } = await query

      if (!error && data) {
        let rows = data as unknown as NilaiRecord[]
        if (searchNama.trim()) {
          const q = searchNama.trim().toLowerCase()
          rows = rows.filter((r) => {
            const sObj = Array.isArray(r.siswa) ? r.siswa[0] : r.siswa
            return (sObj?.nama_lengkap || '').toLowerCase().includes(q)
          })
        }
        setRekapList(rows)
      } else {
        setRekapList([])
      }
    } catch (err) {
      console.error('Error fetching rekap nilai SMK:', err)
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
    searchNama,
  ])

  useEffect(() => {
    if (activeTab === 'rekap') {
      fetchRekapSmk()
    }
  }, [activeTab, fetchRekapSmk])

  const handleNilaiChange = (siswaId: string, value: string) => {
    if (value === '') {
      setNilaiInputMap((prev) => ({ ...prev, [siswaId]: '' }))
      return
    }
    const parsed = Number(value)
    if (Number.isNaN(parsed)) return
    const clamped = Math.min(100, Math.max(0, parsed))
    setNilaiInputMap((prev) => ({
      ...prev,
      [siswaId]: clamped,
    }))
  }

  const handleSimpanNilaiSmk = async () => {
    if (!selectedKelasId || !selectedMapelId || !jenisPenilaian) {
      alert('Silakan pilih Kelas SMK, Mata Pelajaran, dan Jenis Penilaian terlebih dahulu!')
      return
    }

    if (!userEmail) {
      alert('Sesi login tidak valid. Silakan login ulang.')
      return
    }

    if (siswaList.length === 0) {
      alert('Tidak ada siswa SMK untuk disimpan.')
      return
    }

    setSaving(true)
    try {
      const selectedMapelObj = mapelList.find((m) => m.id === Number(selectedMapelId))
      const cleanEmail = userEmail.trim().toLowerCase()

      const rowsToUpsert = siswaList
        .filter((siswa) => siswa.id && nilaiInputMap[String(siswa.id)] !== '')
        .map((siswa) => ({
          siswa_id: siswa.id,
          kelas_id: Number(selectedKelasId),
          mapel_id: Number(selectedMapelId),
          mata_pelajaran: selectedMapelObj?.nama || '',
          [jenisPenilaian]: Number(nilaiInputMap[String(siswa.id)]),
          semester: selectedSemester,
          tahun_ajaran: selectedTahunAjaran,
          guru_email: cleanEmail,
          jenjang: 'SMK',
        }))

      if (rowsToUpsert.length === 0) {
        alert('Silakan isi minimal satu nilai siswa!')
        setSaving(false)
        return
      }

      const { error } = await supabase.from('nilai').upsert(rowsToUpsert, {
        onConflict: 'siswa_id,mapel_id,semester,tahun_ajaran',
      })

      if (error) {
        const { error: insertErr } = await supabase.from('nilai').insert(rowsToUpsert)
        if (insertErr) {
          alert('Gagal menyimpan nilai SMK: ' + insertErr.message)
        } else {
          alert('Data nilai akademik SMK berhasil disimpan!')
        }
      } else {
        alert('Data nilai akademik SMK berhasil disimpan!')
      }
    } catch (err: any) {
      alert('Terjadi kesalahan: ' + err.message)
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

  const filteredSiswaInput = siswaList.filter((s) => {
    if (!searchInputSiswa.trim()) return true
    const q = searchInputSiswa.trim().toLowerCase()
    return (
      s.nama_lengkap.toLowerCase().includes(q) ||
      (s.nisn || '').toLowerCase().includes(q)
    )
  })

  const filledCount = siswaList.filter(
    (s) => nilaiInputMap[String(s.id)] !== '' && nilaiInputMap[String(s.id)] !== undefined
  ).length

  const totalEntri = rekapList.length

  const hitungRataRata = (item: NilaiRecord): string => {
    const vals = [item.nilai_tugas, item.nilai_uts, item.nilai_uas].filter(
      (v): v is number => typeof v === 'number' && !Number.isNaN(v)
    )
    if (vals.length === 0) return '-'
    const avg = vals.reduce((acc, cur) => acc + cur, 0) / vals.length
    return avg.toFixed(1)
  }

  // Hitung lebar daun pintu (154px saat tertutup, mengecil mulus menyisakan celah hitam di sisi kiri kusen)
  const doorFullWidth = 154
  const currentDoorWidth = doorFullWidth * (1 - doorCrackRatio)
  const currentDoorX = 216 + doorFullWidth * doorCrackRatio

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="h-dvh max-h-dvh overflow-hidden font-sans flex flex-col justify-between bg-[#06080e] text-slate-100 selection:bg-amber-400 selection:text-slate-950 relative"
    >
      {/* =====================================================================
          PENCAHAYAAN RUANGAN DARI BOHLAM DI KANAN MENYEBAR KE KIRI:
          Terang di kanan (dekat lampu), semakin jauh ke kiri semakin meredup!
         ===================================================================== */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden select-none print:hidden">
        <motion.div
          animate={{
            opacity: isBulbOn ? 1 : 0.14,
          }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="absolute inset-0"
          style={{
            background: `radial-gradient(circle at 67% 32%, ${currentTheme.glowRgba} 0%, ${currentTheme.falloffNear} 28%, ${currentTheme.falloffMid} 54%, ${currentTheme.falloffFar} 84%)`,
          }}
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
        <header className="border-b border-white/10 bg-[#090d16]/85 backdrop-blur-xl px-3 py-2.5 shrink-0 print:hidden">
          <div className="max-w-5xl mx-auto flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 shrink-0">
              <Link
                href="/smk"
                className="p-1.5 rounded-lg bg-white/5 border border-white/10 text-slate-300 hover:text-white transition"
                title="Kembali ke Dashboard SMK"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
              </Link>
              <div className="flex items-center gap-2">
                {logoFallbackIndex < logoCandidates.length ? (
                  <img
                    src={logoCandidates[logoFallbackIndex]}
                    onError={() => setLogoFallbackIndex((prev) => prev + 1)}
                    alt="Logo SMK"
                    className="w-7 h-7 rounded-lg border border-white/20 bg-white/10 p-0.5 object-contain"
                  />
                ) : (
                  <div
                    className="w-7 h-7 rounded-lg border flex items-center justify-center transition-colors duration-700"
                    style={{
                      borderColor: currentTheme.borderGlow,
                      backgroundColor: currentTheme.badgeBg,
                      color: currentTheme.badgeText,
                    }}
                  >
                    <GraduationCap className="w-4 h-4" />
                  </div>
                )}
                <div className="flex items-center gap-1.5">
                  <h1 className="font-black text-xs sm:text-sm tracking-wider text-white uppercase">
                    Penilaian SMK
                  </h1>
                  <span
                    className="text-[9px] font-black px-1.5 py-0.5 rounded text-slate-950 transition-colors duration-700"
                    style={{ backgroundColor: currentTheme.accentSolid }}
                  >
                    DKV
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              {/* PERIODE SEMESTER & TAHUN AJARAN */}
              <div className="border border-white/10 bg-white/5 text-[10px] font-bold px-2 py-1 rounded-lg flex items-center gap-1">
                <select
                  value={selectedSemester}
                  onChange={(e) => setSelectedSemester(e.target.value as 'Ganjil' | 'Genap')}
                  className="bg-transparent font-extrabold focus:outline-none cursor-pointer transition-colors duration-700"
                  style={{ color: currentTheme.badgeText }}
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
                  className="bg-transparent font-extrabold focus:outline-none cursor-pointer transition-colors duration-700"
                  style={{ color: currentTheme.badgeText }}
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
                <span
                  className="w-4 h-4 rounded-full text-slate-950 flex items-center justify-center text-[9px] font-black shrink-0 transition-colors duration-700"
                  style={{ backgroundColor: currentTheme.accentSolid }}
                >
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
                <span
                  className="hidden sm:inline-block text-[9px] px-1.5 py-0.5 rounded font-extrabold uppercase border transition-colors duration-700"
                  style={{
                    backgroundColor: currentTheme.badgeBg,
                    color: currentTheme.badgeText,
                    borderColor: currentTheme.borderGlow,
                  }}
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
                className="p-1.5 rounded-lg border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition cursor-pointer disabled:opacity-50"
                title="Keluar"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </header>

        {/* 2. MAIN STAGE 2 KOLOM (UKURAN DISAMAKAN DENGAN MASTER PAGE: max-w-5xl p-3 gap-4) */}
        <main className="w-full max-w-5xl mx-auto p-3 flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-4 overflow-hidden">
          {/* ============================================================
              SEBELAH KIRI (7 KOLOM): KARTU NILAI DENGAN FALLOFF CAHAYA LAMPU
             ============================================================ */}
          <div className="lg:col-span-7 h-full min-h-0 flex flex-col overflow-hidden">
            {/* Tombol Switch Khusus Mobile */}
            <div className="flex lg:hidden justify-between items-center mb-2 px-1 shrink-0">
              <span
                className="text-[11px] font-bold"
                style={{ color: currentTheme.badgeText }}
              >
                {activeTab === 'input' ? 'Mode: Input Nilai SMK' : 'Mode: Riwayat Nilai SMK'}
              </span>
              <button
                type="button"
                onClick={handleLampOrCordClick}
                className="px-3 py-1 rounded-full text-slate-950 text-[10px] font-black"
                style={{ backgroundColor: currentTheme.accentSolid }}
              >
                {activeTab === 'input' ? 'Lihat Riwayat →' : '← Input Nilai'}
              </button>
            </div>

            {/* KARTU UTAMA: Sisi kanan dekat lampu bercahaya, semakin ke kiri semakin meredup */}
            <div
              className="flex-1 min-h-0 rounded-2xl p-3 flex flex-col overflow-hidden shadow-2xl relative transition-all duration-700"
              style={{
                background: isBulbOn
                  ? `linear-gradient(270deg, ${currentTheme.falloffNear} 0%, ${currentTheme.cardTint} 44%, rgba(9, 12, 20, 0.95) 100%)`
                  : 'rgba(8, 10, 17, 0.96)',
                borderWidth: '1px',
                borderStyle: 'solid',
                borderColor: isBulbOn
                  ? currentTheme.borderGlow
                  : 'rgba(255, 255, 255, 0.06)',
                boxShadow: isBulbOn
                  ? `inset -28px 0 68px -26px ${currentTheme.falloffNear}`
                  : 'none',
              }}
            >
              <AnimatePresence mode="wait" initial={false}>
                {activeTab === 'input' ? (
                  /* ====================================================
                     TAMPILAN 1: INPUT NILAI SISWA SMK
                     ==================================================== */
                  <motion.div
                    key="smk-nilai-input-view"
                    initial={{ opacity: 0, x: -16, scale: 0.988 }}
                    animate={{ opacity: 1, x: 0, scale: 1 }}
                    exit={{ opacity: 0, x: 16, scale: 0.988 }}
                    transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                    className="flex flex-col h-full min-h-0 overflow-hidden space-y-2.5"
                  >
                    {/* Header Kartu Input */}
                    <div className="flex items-center justify-between gap-2 pb-2 border-b border-white/10 shrink-0">
                      <div>
                        <span
                          className="text-[10px] font-black uppercase tracking-[0.18em] flex items-center gap-1 transition-colors duration-700"
                          style={{ color: currentTheme.badgeText }}
                        >
                          <Sparkles className="w-3 h-3" /> Input Penilaian SMK
                        </span>
                        <p className="text-[11px] text-slate-400">
                          Klik lampu atau tali di kanan — beruang akan menariknya &amp; mengganti warna lampu
                        </p>
                      </div>
                      <span
                        className="text-[10px] font-black px-2.5 py-1 rounded-full border shrink-0 transition-colors duration-700"
                        style={{
                          backgroundColor: currentTheme.badgeBg,
                          color: currentTheme.badgeText,
                          borderColor: currentTheme.borderGlow,
                        }}
                      >
                        {filledCount}/{siswaList.length} Terisi
                      </span>
                    </div>

                    {/* Bar Filter: Kelas SMK, Mapel SMK, Kategori Penilaian */}
                    <div className="grid grid-cols-12 gap-2 shrink-0">
                      <div className="col-span-12 sm:col-span-4">
                        <label className="text-[9px] font-bold uppercase text-slate-400 block mb-1">
                          Kelas SMK
                        </label>
                        <select
                          value={selectedKelasId}
                          onChange={(e) => setSelectedKelasId(e.target.value)}
                          className="w-full border border-white/10 bg-[#0b0f1b]/90 text-white rounded-xl px-2.5 py-1.5 text-xs font-bold focus:outline-none transition"
                        >
                          <option value="">-- Pilih Kelas --</option>
                          {kelasList.map((k) => (
                            <option key={k.id} value={k.id}>
                              {k.nama}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="col-span-12 sm:col-span-4">
                        <label className="text-[9px] font-bold uppercase text-slate-400 block mb-1">
                          Mata Pelajaran
                        </label>
                        <select
                          value={selectedMapelId}
                          onChange={(e) => setSelectedMapelId(e.target.value)}
                          className="w-full border border-white/10 bg-[#0b0f1b]/90 text-white rounded-xl px-2.5 py-1.5 text-xs font-bold focus:outline-none transition"
                        >
                          <option value="">-- Pilih Mapel --</option>
                          {mapelList.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.nama}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="col-span-12 sm:col-span-4">
                        <label className="text-[9px] font-bold uppercase text-slate-400 block mb-1">
                          Kategori Nilai
                        </label>
                        <div className="grid grid-cols-3 gap-1">
                          {[
                            { key: 'nilai_tugas', label: 'Tugas' },
                            { key: 'nilai_uts', label: 'UTS' },
                            { key: 'nilai_uas', label: 'UAS' },
                          ].map((cat) => {
                            const active = jenisPenilaian === cat.key
                            return (
                              <button
                                key={cat.key}
                                type="button"
                                onClick={() =>
                                  setJenisPenilaian(
                                    cat.key as 'nilai_tugas' | 'nilai_uts' | 'nilai_uas'
                                  )
                                }
                                style={
                                  active
                                    ? {
                                        backgroundColor: currentTheme.accentSolid,
                                        borderColor: currentTheme.badgeText,
                                      }
                                    : undefined
                                }
                                className={`py-1.5 rounded-xl border text-[10px] font-black transition-all duration-500 cursor-pointer ${
                                  active
                                    ? 'text-slate-950 shadow-sm'
                                    : 'bg-[#0b0f1b]/90 text-slate-300 border-white/10 hover:border-white/25'
                                }`}
                              >
                                {cat.label}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    </div>

                    {/* Pencarian Siswa Cepat */}
                    {selectedKelasId && siswaList.length > 0 && (
                      <div className="relative shrink-0">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={searchInputSiswa}
                          onChange={(e) => setSearchInputSiswa(e.target.value)}
                          placeholder="Cari nama atau NISN siswa SMK..."
                          className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-[#0b0f1b]/90 border border-white/10 text-xs font-semibold text-white placeholder:text-slate-500 focus:outline-none"
                        />
                      </div>
                    )}

                    {/* Daftar Siswa & Kolom Nilai (0-100) */}
                    <div className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-1.5">
                      {!selectedKelasId || !selectedMapelId ? (
                        <div className="h-full flex flex-col items-center justify-center text-center p-6">
                          <Award
                            className="w-8 h-8 mb-2 transition-colors duration-700"
                            style={{ color: currentTheme.badgeText }}
                          />
                          <p className="text-xs font-black text-white">
                            Pilih Kelas &amp; Mata Pelajaran SMK
                          </p>
                          <p className="text-[11px] text-slate-400 max-w-xs mt-1">
                            Daftar siswa SMK akan muncul otomatis untuk pengisian skor 0–100.
                          </p>
                        </div>
                      ) : loadingSiswa ? (
                        <div
                          className="h-full flex items-center justify-center text-xs font-medium"
                          style={{ color: currentTheme.badgeText }}
                        >
                          Memuat daftar siswa SMK...
                        </div>
                      ) : filteredSiswaInput.length === 0 ? (
                        <div className="h-full flex items-center justify-center text-xs font-medium text-slate-400">
                          Belum ada siswa SMK terdaftar pada kelas ini.
                        </div>
                      ) : (
                        filteredSiswaInput.map((siswa, index) => {
                          const sId = String(siswa.id)
                          const currentVal = nilaiInputMap[sId] ?? ''
                          const isHigh = typeof currentVal === 'number' && currentVal >= 75
                          const isLow = typeof currentVal === 'number' && currentVal < 75

                          return (
                            <div
                              key={sId || index}
                              style={{
                                background: isBulbOn
                                  ? `linear-gradient(270deg, ${currentTheme.cardTint} 0%, rgba(10, 14, 24, 0.85) 85%)`
                                  : 'rgba(10, 14, 24, 0.85)',
                              }}
                              className="px-3 py-2 rounded-xl border border-white/[0.07] hover:border-white/25 transition-all duration-500 flex items-center justify-between gap-2"
                            >
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[10px] font-mono text-slate-500 w-5 shrink-0">
                                    {index + 1}.
                                  </span>
                                  <h4 className="text-xs font-extrabold truncate text-white">
                                    {siswa.nama_lengkap}
                                  </h4>
                                </div>
                                <p className="text-[9px] font-mono text-slate-400 pl-6">
                                  NISN: {siswa.nisn || '-'}
                                </p>
                              </div>

                              <input
                                type="number"
                                min={0}
                                max={100}
                                step="1"
                                value={currentVal}
                                onChange={(e) => handleNilaiChange(sId, e.target.value)}
                                placeholder="0-100"
                                style={
                                  !isHigh && !isLow
                                    ? {
                                        color: currentTheme.badgeText,
                                        borderColor: currentTheme.borderGlow,
                                      }
                                    : undefined
                                }
                                className={`w-16 border rounded-lg px-2 py-1 text-center text-xs font-black focus:outline-none transition-colors duration-500 ${
                                  isHigh
                                    ? 'bg-emerald-500/15 border-emerald-400/40 text-emerald-300'
                                    : isLow
                                    ? 'bg-rose-500/15 border-rose-400/40 text-rose-300'
                                    : 'bg-[#090d18]'
                                }`}
                              />
                            </div>
                          )
                        })
                      )}
                    </div>

                    {/* Tombol Simpan Nilai */}
                    {selectedKelasId && selectedMapelId && siswaList.length > 0 && (
                      <motion.button
                        whileHover={{ scale: 1.005 }}
                        whileTap={{ scale: 0.985 }}
                        type="button"
                        onClick={handleSimpanNilaiSmk}
                        disabled={saving}
                        style={{ backgroundColor: currentTheme.accentSolid }}
                        className="w-full py-2.5 rounded-xl disabled:opacity-50 text-slate-950 font-black text-xs transition-colors duration-700 shadow-lg flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
                      >
                        <Save className="w-3.5 h-3.5" />
                        <span>{saving ? 'Menyimpan...' : 'SIMPAN NILAI SMK'}</span>
                      </motion.button>
                    )}
                  </motion.div>
                ) : (
                  /* ====================================================
                     TAMPILAN 2: RIWAYAT & REKAPITULASI NILAI SMK
                     ==================================================== */
                  <motion.div
                    key="smk-nilai-rekap-view"
                    initial={{ opacity: 0, x: 16, scale: 0.988 }}
                    animate={{ opacity: 1, x: 0, scale: 1 }}
                    exit={{ opacity: 0, x: -16, scale: 0.988 }}
                    transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                    className="flex flex-col h-full min-h-0 overflow-hidden space-y-2.5"
                  >
                    {/* Header Kartu Riwayat */}
                    <div className="flex items-center justify-between gap-2 pb-2 border-b border-white/10 shrink-0">
                      <div>
                        <span
                          className="text-[10px] font-black uppercase tracking-[0.18em] flex items-center gap-1 transition-colors duration-700"
                          style={{ color: currentTheme.badgeText }}
                        >
                          <History className="w-3 h-3" /> Riwayat &amp; Rekap Nilai SMK
                        </span>
                        <p className="text-[11px] text-slate-400">
                          Klik lampu atau tali lagi untuk kembali ke form input nilai
                        </p>
                      </div>
                      <span
                        className="text-[10px] font-black px-2.5 py-1 rounded-full border shrink-0 transition-colors duration-700"
                        style={{
                          backgroundColor: currentTheme.badgeBg,
                          color: currentTheme.badgeText,
                          borderColor: currentTheme.borderGlow,
                        }}
                      >
                        {totalEntri} Entri
                      </span>
                    </div>

                    {/* Filter Riwayat */}
                    <div className="grid grid-cols-3 gap-2 shrink-0">
                      <select
                        value={filterKelasId}
                        onChange={(e) => setFilterKelasId(e.target.value)}
                        className="border border-white/10 bg-[#0b0f1b]/90 text-white rounded-xl px-2.5 py-1.5 text-[11px] font-bold focus:outline-none"
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
                        className="border border-white/10 bg-[#0b0f1b]/90 text-white rounded-xl px-2.5 py-1.5 text-[11px] font-bold focus:outline-none"
                      >
                        <option value="">Semua Mapel SMK</option>
                        {mapelList.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.nama}
                          </option>
                        ))}
                      </select>

                      <input
                        type="text"
                        value={searchNama}
                        onChange={(e) => setSearchNama(e.target.value)}
                        placeholder="Cari nama siswa..."
                        className="border border-white/10 bg-[#0b0f1b]/90 text-white rounded-xl px-2.5 py-1.5 text-[11px] font-bold focus:outline-none placeholder:text-slate-500"
                      />
                    </div>

                    {/* List Rekap Nilai SMK */}
                    <div className="flex-1 min-h-0 overflow-y-auto pr-1 grid grid-cols-1 md:grid-cols-2 gap-2 content-start">
                      {loadingRekap ? (
                        <div
                          className="col-span-full h-48 flex items-center justify-center text-xs font-medium"
                          style={{ color: currentTheme.badgeText }}
                        >
                          Memuat riwayat nilai SMK...
                        </div>
                      ) : rekapList.length === 0 ? (
                        <div className="col-span-full h-48 flex items-center justify-center text-xs font-medium text-slate-400">
                          Tidak ada data nilai SMK ditemukan.
                        </div>
                      ) : (
                        rekapList.map((item, index) => {
                          const sObj = Array.isArray(item.siswa)
                            ? item.siswa[0]
                            : item.siswa
                          const kObj = sObj?.kelas
                            ? Array.isArray(sObj.kelas)
                              ? sObj.kelas[0]
                              : sObj.kelas
                            : null

                          return (
                            <div
                              key={item.id || index}
                              style={{
                                background: isBulbOn
                                  ? `linear-gradient(270deg, ${currentTheme.cardTint} 0%, rgba(10, 14, 24, 0.88) 90%)`
                                  : 'rgba(10, 14, 24, 0.88)',
                              }}
                              className="p-2.5 rounded-xl border border-white/10 hover:border-white/25 transition-all duration-500 flex flex-col justify-between gap-2"
                            >
                              <div>
                                <div className="flex items-center justify-between gap-2 mb-1">
                                  <span className="text-xs font-extrabold text-white truncate">
                                    {sObj?.nama_lengkap || '-'}
                                  </span>
                                  <span
                                    className="px-1.5 py-0.5 rounded text-[9px] font-black border shrink-0 transition-colors duration-700"
                                    style={{
                                      backgroundColor: currentTheme.badgeBg,
                                      color: currentTheme.badgeText,
                                      borderColor: currentTheme.borderGlow,
                                    }}
                                  >
                                    {kObj?.nama_kelas || '-'}
                                  </span>
                                </div>

                                <div className="flex items-center justify-between text-[10px] mb-2">
                                  <span className="font-bold text-slate-300 truncate">
                                    <BookOpen className="w-4 h-4 inline-block align-middle" /> {item.mata_pelajaran || '-'}
                                  </span>
                                  <span className="text-[9px] font-mono text-emerald-300 flex items-center gap-0.5 shrink-0">
                                    <CheckCircle2 className="w-2.5 h-2.5" /> Rata:{' '}
                                    {hitungRataRata(item)}
                                  </span>
                                </div>

                                <div className="grid grid-cols-3 gap-1 text-center py-1.5 bg-white/[0.03] border border-white/5 rounded-lg text-[10px]">
                                  <div>
                                    <span
                                      className="block text-[8px] font-bold"
                                      style={{ color: currentTheme.badgeText }}
                                    >
                                      TUGAS
                                    </span>
                                    <span className="font-black text-white">
                                      {item.nilai_tugas ?? '-'}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="block text-[8px] font-bold text-sky-300">
                                      UTS
                                    </span>
                                    <span className="font-black text-white">
                                      {item.nilai_uts ?? '-'}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="block text-[8px] font-bold text-emerald-300">
                                      UAS
                                    </span>
                                    <span className="font-black text-white">
                                      {item.nilai_uas ?? '-'}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center justify-between pt-1 border-t border-white/10 text-[9px]">
                                <span className="font-mono text-slate-500">
                                  {item.created_at
                                    ? new Date(item.created_at).toLocaleDateString('id-ID')
                                    : '-'}
                                </span>
                                <button
                                  onClick={async () => {
                                    if (item.id && confirm('Hapus entri nilai SMK ini?')) {
                                      await supabase
                                        .from('nilai')
                                        .delete()
                                        .eq('id', item.id)
                                      setRekapList((prev) =>
                                        prev.filter((r) => r.id !== item.id)
                                      )
                                    }
                                  }}
                                  className="text-rose-400 hover:text-rose-300 font-bold flex items-center gap-1 cursor-pointer"
                                >
                                  <Trash2 className="w-3 h-3" />
                                  <span>Hapus</span>
                                </button>
                              </div>
                            </div>
                          )
                        })
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* ============================================================
              SEBELAH KANAN (5 KOLOM): PANGGUNG IMPOSSIBLE LIGHT BULB
              - Bohlam & tali gantung di sebelah kiri pintu (jarak rapat)
              - Pintu membuka celah vertikal tipis di sisi kiri (engsel di kanan)
              - Beruang mengintip dari balik celah pintu & lengannya menggapai tali
             ============================================================ */}
          <div
            className="hidden lg:flex lg:col-span-5 h-full min-h-0 rounded-2xl border relative overflow-hidden flex-col items-center justify-between p-4 select-none shadow-2xl transition-all duration-700"
            style={{
              background: isBulbOn
                ? `radial-gradient(circle at 38% 36%, ${currentTheme.falloffNear} 0%, rgba(12, 17, 30, 0.94) 62%, #06080e 100%)`
                : 'linear-gradient(180deg, #070910 0%, #05070c 100%)',
              borderColor: isBulbOn
                ? currentTheme.borderGlow
                : 'rgba(255, 255, 255, 0.08)',
            }}
          >
            {/* Header Status Panggung */}
            <div className="w-full flex items-center justify-between z-30 shrink-0">
              <span
                className="text-[10px] font-black uppercase tracking-[0.2em] transition-colors duration-700"
                style={{ color: currentTheme.badgeText }}
              >
                {currentTheme.name}
              </span>
              <span className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full bg-white/[0.05] border border-white/10 text-slate-300">
                {isAnimatingScene
                  ? 'Beruang menarik tali...'
                  : activeTab === 'input'
                  ? 'Klik lampu untuk Riwayat'
                  : 'Klik lampu untuk Input'}
              </span>
            </div>

            {/* SVG PANGGUNG TERPADU (KOORDINAT PRESISI SEPERTI VIDEO REFERENSI) */}
            <div className="relative w-full flex-1 min-h-0 flex items-center justify-center overflow-hidden">
              <svg
                viewBox="0 0 420 440"
                className="w-full h-full max-h-[430px] overflow-visible"
              >
                <defs>
                  {/* Kerucut Cahaya Bohlam Mengikuti Warna Aktif */}
                  <linearGradient id="smkRefBulbCone" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="0%"
                      stopColor={currentTheme.bulbGlass}
                      stopOpacity={isBulbOn ? '0.42' : '0'}
                    />
                    <stop
                      offset="65%"
                      stopColor={currentTheme.accentSolid}
                      stopOpacity={isBulbOn ? '0.12' : '0'}
                    />
                    <stop
                      offset="100%"
                      stopColor={currentTheme.accentSolid}
                      stopOpacity="0"
                    />
                  </linearGradient>

                  {/* Gradien Daun Pintu */}
                  <linearGradient id="smkRefDoorSurface" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor={isBulbOn ? '#6e5849' : '#3a2b20'} />
                    <stop offset="60%" stopColor={isBulbOn ? '#5c4739' : '#2f2219'} />
                    <stop offset="100%" stopColor={isBulbOn ? '#4a382c' : '#241a13'} />
                  </linearGradient>

                  {/* Clipping Mask di dalam Kusen Pintu (x=216..370) sehingga kepala beruang
                      terpotong alami oleh tepi kusen saat mengintip dari celah! */}
                  <clipPath id="doorOpeningClip">
                    <rect x="216" y="106" width="154" height="304" />
                  </clipPath>
                </defs>

                {/* Lantai Horizontal Studio */}
                <line
                  x1="16"
                  y1="410"
                  x2="404"
                  y2="410"
                  stroke="rgba(255,255,255,0.16)"
                  strokeWidth="2"
                />

                {/* Sorotan Kerucut Cahaya Bohlam */}
                <polygon
                  points="132,162 184,162 246,410 70,410"
                  fill="url(#smkRefBulbCone)"
                />

                {/* ======================================================
                    1. KUSEN PINTU & RUANG GELAP DI BALIK PINTU (x=208..378)
                   ====================================================== */}
                {/* Kusen Luar Pintu */}
                <rect
                  x="208"
                  y="98"
                  width="170"
                  height="312"
                  fill={isBulbOn ? '#3b2e25' : '#211812'}
                  stroke="#120d0a"
                  strokeWidth="2"
                />

                {/* Lubang Ruangan Gelap di Dalam Kusen */}
                <rect x="216" y="106" width="154" height="304" fill="#050609" />

                {/* ======================================================
                    2. KEPALA BERUANG MENGINTIP DARI BALIK CELAH PINTU
                       (Ter-clip di x=216 sehingga tersembunyi di balik dinding kiri!)
                   ====================================================== */}
                <g clipPath="url(#doorOpeningClip)">
                  <motion.g
                    initial={false}
                    animate={{
                      x: bearHeadPeek ? 216 : 165,
                      y: bearHeadPeek ? 168 : 176,
                    }}
                    transition={{
                      type: 'spring',
                      stiffness: 185,
                      damping: 20,
                      mass: 0.85,
                    }}
                  >
                    {/* Telinga Beruang */}
                    <circle
                      cx="22"
                      cy="0"
                      r="12"
                      fill="#784421"
                      stroke="#1a0f08"
                      strokeWidth="2"
                    />
                    <circle cx="22" cy="0" r="6" fill="#deaa87" />

                    {/* Kepala Beruang */}
                    <circle
                      cx="6"
                      cy="24"
                      r="29"
                      fill="#784421"
                      stroke="#1a0f08"
                      strokeWidth="2.2"
                    />

                    {/* Moncong & Hidung */}
                    <ellipse cx="14" cy="31" rx="14" ry="11" fill="#deaa87" />
                    <ellipse cx="19" cy="27" rx="5" ry="3.5" fill="#1a0f08" />

                    {/* Mata Beruang Melirik ke Tali Lampu */}
                    <circle cx="15" cy="17" r="3.2" fill="#120a05" />
                    <circle cx="14" cy="16" r="1.1" fill="#ffffff" />
                  </motion.g>
                </g>

                {/* ======================================================
                    3. DAUN PINTU YANG BERGESER MEMBUKA CELAH TIPIS DARI KIRI
                       (Engsel di kanan x=370, sehingga celah hitam muncul di x=216)
                   ====================================================== */}
                <motion.g
                  initial={false}
                  animate={{
                    x: currentDoorX - 216,
                  }}
                  transition={{
                    type: 'spring',
                    stiffness: 170,
                    damping: 22,
                    mass: 0.9,
                  }}
                >
                  {/* Daun Pintu Utama (Lebar ikut menyempit halus seiring sudut buka) */}
                  <motion.rect
                    x="216"
                    y="106"
                    animate={{
                      width: currentDoorWidth,
                    }}
                    transition={{
                      type: 'spring',
                      stiffness: 170,
                      damping: 22,
                      mass: 0.9,
                    }}
                    height="304"
                    fill="url(#smkRefDoorSurface)"
                    stroke="#1c140f"
                    strokeWidth="2"
                  />

                  {/* Garis Sisi Tebal Daun Pintu saat Terbuka */}
                  <rect
                    x="216"
                    y="106"
                    width={doorCrackRatio > 0 ? 5 : 0}
                    height="304"
                    fill="#261b14"
                  />

                  {/* Panel Kotak Atas & Bawah Pintu */}
                  <motion.rect
                    x="232"
                    y="124"
                    animate={{
                      width: Math.max(0, currentDoorWidth - 32),
                      opacity: doorCrackRatio > 0.22 ? 0.55 : 0.85,
                    }}
                    transition={{ type: 'spring', stiffness: 170, damping: 22 }}
                    height="112"
                    fill="none"
                    stroke="#241a13"
                    strokeWidth="2.5"
                  />
                  <motion.rect
                    x="232"
                    y="264"
                    animate={{
                      width: Math.max(0, currentDoorWidth - 32),
                      opacity: doorCrackRatio > 0.22 ? 0.55 : 0.85,
                    }}
                    transition={{ type: 'spring', stiffness: 170, damping: 22 }}
                    height="126"
                    fill="none"
                    stroke="#241a13"
                    strokeWidth="2.5"
                  />

                  {/* Gagang / Kunci Kotak Kuningan di Sisi Kiri Pintu */}
                  <rect
                    x="224"
                    y="244"
                    width="9"
                    height="18"
                    rx="1.5"
                    fill="#eab308"
                    stroke="#713f12"
                    strokeWidth="1.2"
                  />
                </motion.g>

                {/* ======================================================
                    4. LENGAN BERUANG MENJULUR DARI CELAH PINTU (x=220) KE TALI (x=158)
                       (Jarak sangat dekat, persis seperti di video!)
                   ====================================================== */}
                <motion.g
                  initial={false}
                  animate={{
                    x: bearArmReach ? 0 : 72,
                    y: cordStretch * 0.85,
                    opacity: bearArmReach ? 1 : 0,
                  }}
                  transition={{
                    type: 'spring',
                    stiffness: 210,
                    damping: 18,
                    mass: 0.72,
                  }}
                >
                  {/* Lengan Bulu Cokelat Keluar dari Celah Kusen (x=222 -> x=156) */}
                  <rect
                    x="154"
                    y="246"
                    width="70"
                    height="24"
                    rx="12"
                    fill="#784421"
                    stroke="#1a0f08"
                    strokeWidth="2.2"
                  />
                  {/* Telapak & Bantalan Merah Muda Menggenggam Ujung Tali di x=158 */}
                  <circle
                    cx="158"
                    cy="258"
                    r="13"
                    fill="#784421"
                    stroke="#1a0f08"
                    strokeWidth="2.2"
                  />
                  <circle cx="157" cy="258" r="6.5" fill="#deaa87" />
                </motion.g>

                {/* ======================================================
                    5. LAMPU BOHLAM GANTUNG & TALI SAKELAR (TEPAT DI KIRI KUSEN)
                       Pusat Bohlam di x=158, Ujung Tali di (158, 258)
                   ====================================================== */}
                {/* Kabel Plafon */}
                <line
                  x1="158"
                  y1="0"
                  x2="158"
                  y2="98"
                  stroke="#1e293b"
                  strokeWidth="3.5"
                />

                {/* Fitting / Cap Bohlam */}
                <rect
                  x="146"
                  y="96"
                  width="24"
                  height="20"
                  rx="4"
                  fill="#64748b"
                  stroke="#0f172a"
                  strokeWidth="2"
                />
                <rect
                  x="149"
                  y="114"
                  width="18"
                  height="6"
                  rx="1.5"
                  fill="#475569"
                  stroke="#0f172a"
                  strokeWidth="1.5"
                />

                {/* TALI SAKELAR ELASTIS DI BAWAH BOHLAM (KLIKABLE) */}
                <motion.g
                  onClick={handleLampOrCordClick}
                  animate={{
                    rotate: cordSwingAngle,
                  }}
                  transition={{
                    type: 'spring',
                    stiffness: 240,
                    damping: 12,
                  }}
                  style={{ transformOrigin: '158px 168px' }}
                  className="cursor-pointer"
                >
                  {/* Area Klik Lebar Transparan */}
                  <rect x="134" y="166" width="48" height="125" fill="transparent" />

                  {/* Tali Vertikal */}
                  <motion.line
                    x1="158"
                    y1="168"
                    x2="158"
                    animate={{
                      y2: 254 + cordStretch,
                    }}
                    transition={{
                      type: 'spring',
                      stiffness: 260,
                      damping: 13,
                      mass: 0.6,
                    }}
                    stroke="#cbd5e1"
                    strokeWidth="2.5"
                  />

                  {/* Bandul Bulat di Ujung Tali (x=158, y=258) */}
                  <motion.circle
                    cx="158"
                    animate={{
                      cy: 258 + cordStretch,
                    }}
                    transition={{
                      type: 'spring',
                      stiffness: 260,
                      damping: 13,
                      mass: 0.6,
                    }}
                    r="5.5"
                    fill="#ffffff"
                    stroke="#0f172a"
                    strokeWidth="2"
                  />
                </motion.g>

                {/* BOHLAM LAMPU UTAMA (KLIKABLE & BERGANTI WARNA) */}
                <g onClick={handleLampOrCordClick} className="cursor-pointer">
                  {/* Halo Cahaya Lembut di Sekitar Bohlam */}
                  <motion.circle
                    cx="158"
                    cy="144"
                    r="46"
                    animate={{
                      opacity: isBulbOn ? 0.5 : 0,
                      scale: isBulbOn ? 1 : 0.72,
                    }}
                    transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                    fill={currentTheme.bulbGlass}
                  />

                  {/* Kaca Bohlam */}
                  <motion.path
                    d="M148 120 C134 128, 134 156, 148 166 C152 169, 164 169, 168 166 C182 156, 182 128, 168 120 Z"
                    animate={{
                      fill: isBulbOn ? currentTheme.bulbCore : '#1e293b',
                      stroke: isBulbOn ? '#0f172a' : '#475569',
                    }}
                    transition={{ duration: 0.45 }}
                    strokeWidth="2.2"
                  />

                  {/* Kilau Kaca Bohlam */}
                  <path
                    d="M145 130 C142 137, 142 146, 146 153"
                    fill="none"
                    stroke="#ffffff"
                    strokeOpacity={isBulbOn ? 0.85 : 0.25}
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />

                  {/* Filamen di Dalam Bohlam */}
                  <path
                    d="M153 122 L153 142 L158 136 L163 142 L163 122"
                    fill="none"
                    stroke={isBulbOn ? currentTheme.filament : '#475569'}
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </g>
              </svg>
            </div>

            {/* Tombol Interaktif Bawah Panggung */}
            <button
              type="button"
              onClick={handleLampOrCordClick}
              disabled={isAnimatingScene}
              style={{
                borderColor: currentTheme.borderGlow,
                backgroundColor: currentTheme.badgeBg,
                color: currentTheme.badgeText,
              }}
              className="z-30 px-4 py-1.5 rounded-full border disabled:opacity-60 text-[11px] font-bold transition-all duration-700 cursor-pointer shrink-0"
            >
              {activeTab === 'input'
                ? 'Klik Lampu / Tali → Riwayat Nilai'
                : 'Klik Lampu / Tali → Input Nilai'}
            </button>
          </div>
        </main>
      </div>
    </motion.div>
  )
}