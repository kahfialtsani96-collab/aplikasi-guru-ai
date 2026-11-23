'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { motion } from 'framer-motion'
import { useAuthRole } from '@/hooks/useAuthRole'
import { useDarkMode } from '@/hooks/useDarkMode'
import DarkModeToggle from '@/app/components/DarkModeToggle'
import DynamicIslandNotification from '@/app/components/DynamicIslandNotification'
import { sortKelas, parseJamKeNum } from '@/lib/utils'
import {
  AlertTriangle,
  Clock,
  ClipboardList,
  NotebookPen,
  HeartHandshake,
  History,
  Timer,
  RefreshCw,
  Save,
  CalendarDays,
  Users,
  GraduationCap,
  Printer,
  BookOpen,
  Trash2,
  Star,
} from 'lucide-react'

// Helper instansiasi Supabase aman untuk SSG Vercel
const getSupabaseUrl = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://kvrulbdvgxfrtmznpjnm.supabase.co'
  return url.replace(/['"]/g, '').trim()
}

const getSupabaseAnonKey = () => {
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder'
  return key.replace(/['"]/g, '').trim()
}

const supabase = createClient(getSupabaseUrl(), getSupabaseAnonKey())

interface OptionItem {
  id: number
  nama: string
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

interface JurnalRecord {
  id?: number | string
  created_at?: string
  tanggal: string
  jam_ke: string
  kelas_id?: number | null
  mapel_id?: number
  kelas?: string
  mapel?: string
  materi: string
  status: 'Terlaksana' | 'Tertunda'
  absen_siswa: string
  keterangan?: string
  guru_email?: string
  jenjang?: string | null
}

// Parse rentang angka jam dari teks jadwal (mis. "Jam Ke-1 s/d 2" atau "Jam Ke-3 s/d 4")
function parseJadwalJamRangeText(item: { jam?: string | null; jam_ke?: number | string | null }): { start: number; end: number } {
  const str = String(item?.jam || '')
  const m = str.match(/jam\s*ke[-:\s]*(\d+)(?:[^0-9]+(\d+))?/i)
  if (m) {
    const s = parseInt(m[1], 10) || 1
    const rawE = m[2] ? parseInt(m[2], 10) : NaN
    const e = Number.isFinite(rawE) ? rawE : s
    return { start: Math.min(s, e), end: Math.max(s, e) }
  }
  const num = Number(item?.jam_ke ?? 1)
  const v = Number.isFinite(num) && num > 0 ? Math.floor(num) : 1
  return { start: v, end: v }
}

// Nama hari Indonesia untuk lookup jadwal dari tanggal
const HARI_INDONESIA_JURNAL = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']

function getHariNama(tgl: string): string {
  const d = new Date(`${String(tgl).slice(0, 10)}T00:00:00`)
  if (Number.isNaN(d.getTime())) return ''
  return HARI_INDONESIA_JURNAL[d.getDay()]
}

interface GuruOption {
  email: string
  nama: string
}

export default function AgendaMengajarPage() {
  const router = useRouter()
  const { isOperator, canAccessBimbingan } = useAuthRole()

  const [userDisplayName, setUserDisplayName] = useState('MEMUAT...')
  const [userNuptkDisplay, setUserNuptkDisplay] = useState('-')
  const [isStrictOperatorRole, setIsStrictOperatorRole] = useState(false)
  const [waliKelasAssignedId, setWaliKelasAssignedId] = useState<number | null>(null)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'input' | 'rekap'>('input')
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  // Helper format NUPTK agar bersih (jika kosong/null/EMPTY menjadi '-')
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

  // DETEKSI OTOMATIS TEMA DARK MODE DARI LOCAL STORAGE
  const { isDarkMode } = useDarkMode()

  // Master Data Options (Khusus SMP)
  const [kelasList, setKelasList] = useState<OptionItem[]>([])
  const [mapelList, setMapelList] = useState<OptionItem[]>([])
  const [masterJamList, setMasterJamList] = useState<MasterJamItem[]>([])

  // Daftar guru pengampu (untuk dropdown saat operator menginput manual/insidental)
  const [guruList, setGuruList] = useState<GuruOption[]>([])
  const [selectedGuruEmail, setSelectedGuruEmail] = useState('')

  // State Input Jurnal Agenda
  const [tanggal, setTanggal] = useState('')
  const [todayStr, setTodayStr] = useState('')
  const [hari, setHari] = useState('Senin')
  const [jamMulai, setJamMulai] = useState('1')
  const [jamSelesai, setJamSelesai] = useState('1')
  const [selectedKelasId, setSelectedKelasId] = useState('')
  const [selectedMapelId, setSelectedMapelId] = useState('')
  const [materi, setMateri] = useState('')
  const [status, setStatus] = useState<'Terlaksana' | 'Tertunda' | 'Digantikan'>('Terlaksana')
  const [replacementGuruEmail, setReplacementGuruEmail] = useState('')
  const [absenSiswa, setAbsenSiswa] = useState('Nihil')
  const [keterangan, setKeterangan] = useState('')

  const [jurnalList, setJurnalList] = useState<JurnalRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [loadingAutoAbsen, setLoadingAutoAbsen] = useState(false)

  // State Rekapitulasi Agenda
  const [rekapList, setRekapList] = useState<JurnalRecord[]>([])
  const [filterKelasId, setFilterKelasId] = useState('')
  const [filterMapelId, setFilterMapelId] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterTanggal, setFilterTanggal] = useState('')
  const [searchMateri, setSearchMateri] = useState('')
  const [loadingRekap, setLoadingRekap] = useState(false)
  const [jadwalAutoList, setJadwalAutoList] = useState<any[]>([])
  const [replaceMode, setReplaceMode] = useState(false)
  const [hariWarning, setHariWarning] = useState('')

  // State deteksi sesi belum absen (SMP)
  const [isAbsenMissing, setIsAbsenMissing] = useState(false)
  const [absenBlockSave, setAbsenBlockSave] = useState(false)
  const [absenSessionInfo, setAbsenSessionInfo] = useState<{ kelas: string; mapel: string; jam: string } | null>(null)

  useEffect(() => {
    let isMounted = true

    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    const currentDateStr = `${year}-${month}-${day}`

    setTodayStr(currentDateStr)
    setTanggal(currentDateStr)
    setFilterTanggal(currentDateStr)

    const namaHari = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'][now.getDay()]
    if (namaHari !== 'Jumat') {
      setHari(namaHari)
    }

    async function initUser() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        if (isMounted) router.replace('/login')
        return
      }

      const rawEmail = user.email || ''
      const cleanEmail = rawEmail.trim().toLowerCase()
      if (isMounted) setUserEmail(rawEmail)

      // Ambil identitas lengkap dari tabel master `guru`
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
              .or('jenjang.eq.SMP,jenjang.is.null')
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

      if (isOperator) fetchGuruList()
      fetchJadwalGuru(rawEmail)
      fetchMasterJam()
      fetchJurnal(rawEmail, currentDateStr)
    }

    initUser()

    return () => {
      isMounted = false
    }
  }, [router, isOperator])

  async function fetchMasterJam() {
    const { data } = await supabase
      .from('master_jam')
      .select('*')
      .or('jenjang.eq.SMP,jenjang.is.null')
      .order('jam_ke', { ascending: true })
    if (data) setMasterJamList(data)
  }

  async function fetchJadwalGuru(email: string) {
    try {
      if (isOperator) {
        const { data: dataKelas } = await supabase
          .from('kelas')
          .select('id, nama_kelas')
          .or('jenjang.eq.SMP,jenjang.is.null')
          .order('nama_kelas', { ascending: true })
        const { data: dataMapel } = await supabase
          .from('mapel')
          .select('id, nama_mapel')
          .or('jenjang.eq.SMP,jenjang.is.null')
          .order('nama_mapel', { ascending: true })

        if (dataKelas) setKelasList(sortKelas(dataKelas.map((k: any) => ({ id: k.id, nama: k.nama_kelas }))))
        if (dataMapel) setMapelList(dataMapel.map((m: any) => ({ id: m.id, nama: m.nama_mapel })))
        return
      }

      const { data, error } = await supabase
        .from('jadwal')
        .select(`
          kelas_id,
          mapel_id,
          kelas:kelas_id(id, nama_kelas),
          mapel:mapel_id(id, nama_mapel)
        `)
        .or('jenjang.eq.SMP,jenjang.is.null')
        .ilike('guru_email', email.trim())

      if (!error && data) {
        const uniqueKelasMap = new Map<number, string>()
        const uniqueMapelMap = new Map<number, string>()

        data.forEach((item: any) => {
          const kObj = Array.isArray(item.kelas) ? item.kelas[0] : item.kelas
          const mObj = Array.isArray(item.mapel) ? item.mapel[0] : item.mapel
          if (kObj && kObj.id) {
            uniqueKelasMap.set(kObj.id, kObj.nama_kelas)
          }
          if (mObj && mObj.id) {
            uniqueMapelMap.set(mObj.id, mObj.nama_mapel)
          }
        })

        // Gabungkan mapel ampuan guru dari profil (kolom `mapel` & relasi `guru_mapel`)
        // agar dropdown menampilkan SEMUA mapel (termasuk mapel ekstrakurikuler/Pramuka),
        // bukan hanya yang tercatat di tabel jadwal.
        try {
          const { data: smpMapelData } = await supabase
            .from('mapel')
            .select('id, nama_mapel, kode_mapel, jenjang')
            .or('jenjang.eq.SMP,jenjang.is.null')

          const smpMapelRef: (OptionItem & { kode?: string })[] = (smpMapelData || [])
            .filter(
              (m) =>
                (m.jenjang || 'SMP').toUpperCase() !== 'SMK' &&
                !(m.nama_mapel || '').toUpperCase().includes('(SMK)') &&
                !(m.nama_mapel || '').toUpperCase().includes('DKV')
            )
            .map((m) => ({
              id: m.id,
              nama: m.nama_mapel,
              kode: (m.kode_mapel || '').trim().toUpperCase(),
            }))

          const { data: guruProfile } = await supabase
            .from('guru')
            .select('id, mapel')
            .ilike('email', email.trim())
            .maybeSingle()

          if (guruProfile?.id) {
            const smpMapelByKode = new Map<string, OptionItem>()
            smpMapelRef.forEach((m) => {
              if (m.kode && !smpMapelByKode.has(m.kode)) smpMapelByKode.set(m.kode, m)
            })

            const { data: guruMapelRows } = await supabase
              .from('guru_mapel')
              .select('mapel_id, mapel:mapel_id(id, nama_mapel, jenjang, kode_mapel)')
              .eq('guru_id', guruProfile.id)

            ;(guruMapelRows || []).forEach((row) => {
              const mObj = Array.isArray(row.mapel) ? row.mapel[0] : row.mapel
              const mId = Number(mObj?.id ?? row.mapel_id)
              if (!mId) return
              const jenjang = (mObj?.jenjang || '').toUpperCase()
              const mName = String(mObj?.nama_mapel || '')
              if (jenjang === 'SMK' || mName.toUpperCase().includes('(SMK)')) return
              if (mName.toUpperCase().includes('DKV')) return
              const kode = (mObj?.kode_mapel || '').trim().toUpperCase()
              const found = kode
                ? smpMapelByKode.get(kode)
                : smpMapelRef.find((m) => Number(m.id) === mId)
              if (found) uniqueMapelMap.set(found.id, found.nama)
            })

            const profileNames = (guruProfile.mapel || '')
              .split(/[,;]/)
              .map((s: string) => s.trim().toLowerCase())
              .filter(Boolean)
            if (profileNames.length > 0) {
              smpMapelRef.forEach((m) => {
                // Hanya mapel yg memang terdaftar sbg mapel SMP (via kode_mapel).
                // Cocokkan secara ketat utk mencegah salah ambil mapel SMK.
                if (!m.kode) return
                const mName = m.nama.toLowerCase()
                const hit = profileNames.some((n: string) => mName === n)
                if (hit) uniqueMapelMap.set(m.id, m.nama)
              })
            }
          }
        } catch (err) {
          console.error('Error fetching mapel profil guru SMP:', err)
        }

        setKelasList(sortKelas(Array.from(uniqueKelasMap.entries()).map(([id, nama]) => ({ id, nama }))))
        setMapelList(Array.from(uniqueMapelMap.entries()).map(([id, nama]) => ({ id, nama })))
      }
    } catch (err) {
      console.error('Error fetching jadwal guru SMP:', err)
    }
  }

  // AUTO-FETCH ABSENSI SISWA (KHUSUS SMP)
  const fetchAbsensiOtomatis = async (targetDate: string, targetKelasId: string, targetMapelId: string) => {
    if (!targetDate) return

    const selectedMapelObj = mapelList.find((m) => m.id === Number(targetMapelId))
    const namaMapelLower = selectedMapelObj?.nama?.toLowerCase() || ''
    const isEkskulGabungan = targetKelasId === 'GABUNGAN' || namaMapelLower.includes('pramuka') || namaMapelLower.includes('qiro')

    if (!isEkskulGabungan && !targetKelasId) return

    setLoadingAutoAbsen(true)
    try {
      let query = supabase
        .from('absensi')
        .select('nama_siswa, status, kelas, nisn')
        .or('jenjang.eq.SMP,jenjang.is.null')
        .eq('tanggal', targetDate)

      // Guru hanya mengambil presensi miliknya sendiri; operator lihat semua.
      if (!isOperator && userEmail) {
        query = query.ilike('guru_email', userEmail.trim())
      }

      if (isEkskulGabungan) {
        if (targetMapelId) query = query.eq('mapel_id', Number(targetMapelId))
      } else {
        query = query.eq('kelas_id', Number(targetKelasId))
        if (targetMapelId) query = query.eq('mapel_id', Number(targetMapelId))
      }

      const { data: absensiData, error } = await query
      if (error) throw error

      if (!absensiData || absensiData.length === 0) {
        setAbsenSiswa('Nihil')
      } else {
        const tidakHadirList = absensiData.filter((a) => a.status && a.status.toUpperCase() !== 'HADIR')

        if (tidakHadirList.length === 0) {
          setAbsenSiswa('Nihil')
        } else {
          const dikelompokkan: Record<string, string[]> = {}
          tidakHadirList.forEach((item) => {
            const st = item.status.toUpperCase()
            const namaFormatted = isEkskulGabungan && item.kelas 
              ? `${item.nama_siswa || 'Siswa'} (${item.kelas})`
              : item.nama_siswa || 'Siswa'

            if (!dikelompokkan[st]) dikelompokkan[st] = []
            dikelompokkan[st].push(namaFormatted)
          })

          const resultString = Object.entries(dikelompokkan)
            .map(([stKey, names]) => `${stKey}: ${names.join(', ')}`)
            .join(' | ')

          setAbsenSiswa(resultString)
        }
      }
    } catch (err) {
      console.error('Gagal mengambil data absensi otomatis SMP:', err)
    } finally {
      setLoadingAutoAbsen(false)
    }
  }

  useEffect(() => {
    if (tanggal && (selectedKelasId || selectedMapelId)) {
      fetchAbsensiOtomatis(tanggal, selectedKelasId, selectedMapelId)
    }
  }, [tanggal, selectedKelasId, selectedMapelId])

  // DETEKSI SESI BELUM ABSEN (SMP): cek tabel `absensi` untuk kombinasi Tanggal+Kelas+Mapel.
  useEffect(() => {
    let cancelled = false
    async function checkAbsen() {
      // Reset jika belum ada kombinasi lengkap.
      if (!tanggal || !selectedMapelId) {
        setIsAbsenMissing(false)
        setAbsenBlockSave(false)
        setAbsenSessionInfo(null)
        return
      }
      const selectedMapelObj = mapelList.find((m) => m.id === Number(selectedMapelId))
      const selectedKelasObj = kelasList.find((k) => k.id === Number(selectedKelasId))
      const namaMapelLower = selectedMapelObj?.nama?.toLowerCase() || ''
      const isEkskulGabungan =
        selectedKelasId === 'GABUNGAN' ||
        namaMapelLower.includes('pramuka') ||
        namaMapelLower.includes('qiro')

      // Sesi kelas non-ekskul wajib memiliki kelas untuk validasi absensi.
      if (!isEkskulGabungan && !selectedKelasId) {
        setIsAbsenMissing(false)
        setAbsenBlockSave(false)
        setAbsenSessionInfo(null)
        return
      }

      // Apakah sesi ini berasal dari jadwal resmi?
      // Jika bukan (manual/insidental), pengecekan hanya jadi peringatan, tidak memblokir simpan.
      let fromResmi = false
      if (!cancelled) {
        try {
          const hariNama = getHariNama(tanggal)
          if (!isEkskulGabungan && hariNama) {
            const { data } = await supabase
              .from('jadwal')
              .select('id')
              .or('jenjang.eq.SMP,jenjang.is.null')
              .eq('kelas_id', Number(selectedKelasId))
              .eq('mapel_id', Number(selectedMapelId))
              .eq('hari', hariNama)
              .ilike('guru_email', (userEmail || '').trim())
              .limit(1)
            fromResmi = !!data && data.length > 0
          }
        } catch {
          fromResmi = false
        }
      }

      // Cek apakah catatan absensi sudah ada untuk sesi ini.
      let exists = false
      if (!cancelled) {
        try {
          let q = supabase
            .from('absensi')
            .select('id')
            .or('jenjang.eq.SMP,jenjang.is.null')
            .eq('tanggal', tanggal)
            .eq('mapel_id', Number(selectedMapelId))
          if (!isOperator && userEmail) q = q.ilike('guru_email', userEmail.trim())
          // Ekskul/Gabungan disimpan hanya dengan mapel_id (tanpa kelas_id).
          if (!isEkskulGabungan) q = q.eq('kelas_id', Number(selectedKelasId))
          const { data } = await q.limit(1)
          exists = !!data && data.length > 0
        } catch {
          exists = false
        }
      }

      if (cancelled) return

      if (!exists) {
        const jamText = `Jam Ke-${jamMulai}${Number(jamSelesai) !== Number(jamMulai) ? ` s/d ${jamSelesai}` : ''}`
        const kelasLabel = isEkskulGabungan ? 'Gabungan (Ekskul)' : selectedKelasObj?.nama || `Kelas ${selectedKelasId}`
        const mapelLabel = selectedMapelObj?.nama || ''
        setIsAbsenMissing(true)
        setAbsenSessionInfo({ kelas: kelasLabel, mapel: mapelLabel, jam: jamText })
        // Blokir simpan hanya untuk sesi jadwal resmi; sesi manual/insidental & operator hanya peringatan.
        setAbsenBlockSave(!isOperator && fromResmi)
      } else {
        setIsAbsenMissing(false)
        setAbsenBlockSave(false)
        setAbsenSessionInfo(null)
      }
    }
    checkAbsen()
    return () => {
      cancelled = true
    }
  }, [tanggal, selectedKelasId, selectedMapelId, jamMulai, jamSelesai, userEmail, isOperator, mapelList, kelasList])

  // Peringatan libur Jumat (Pondok Pesantren)
  useEffect(() => {
    if (tanggal) {
      const p = tanggal.split('-').map(Number)
      const d = new Date(p[0], p[1] - 1, p[2])
      const nHari = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'][d.getDay()]
      if (nHari === 'Jumat') {
        setHariWarning('⚠ Hari Jumat adalah libur Pondok Pesantren — tidak ada kegiatan belajar mengajar.')
      } else {
        setHariWarning('')
      }
    } else {
      setHariWarning('')
    }
  }, [tanggal])

  // OTOMATISASI Jam & Mapel berdasarkan Jadwal Mengajar resmi
  useEffect(() => {
    let isMounted = true
    async function detectJadwal() {
      setJadwalAutoList([])
      if (!tanggal || !selectedKelasId || selectedKelasId === 'GABUNGAN' || isOperator || !userEmail) return
      const p = tanggal.split('-').map(Number)
      const d = new Date(p[0], p[1] - 1, p[2])
      const nHari = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'][d.getDay()]
      if (nHari === 'Jumat') return
      try {
        const { data, error } = await supabase
          .from('jadwal')
          .select('id, mapel_id, jam, jam_ke, guru_email, hari')
          .or('jenjang.eq.SMP,jenjang.is.null')
          .eq('kelas_id', Number(selectedKelasId))
          .ilike('guru_email', userEmail.trim())
        if (error) return
        const matched = (data || []).filter((j: any) =>
          String(j.hari || '').trim().toLowerCase() === nHari.toLowerCase()
        )
        if (!isMounted) return
        setJadwalAutoList(matched)
        if (matched.length === 1 && !replaceMode) {
          const item = matched[0]
          if (item.mapel_id != null) setSelectedMapelId(String(item.mapel_id))
          const range = parseJadwalJamRangeText(item)
          setJamMulai(String(range.start))
          setJamSelesai(String(range.end))
        }
      } catch (err) {
        console.error('Error deteksi otomatis jadwal:', err)
      }
    }
    detectJadwal()
    return () => {
      isMounted = false
    }
  }, [tanggal, selectedKelasId, userEmail, isOperator, replaceMode])

  const handleMapelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value
    setSelectedMapelId(val)
    const mapelObj = mapelList.find((m) => m.id === Number(val))
    const namaLower = mapelObj?.nama?.toLowerCase() || ''
    if (namaLower.includes('pramuka') || namaLower.includes('qiro')) {
      setSelectedKelasId('GABUNGAN')
    }
  }

  async function fetchJurnal(emailParam?: string | null, dateParam?: string) {
    const activeEmail = (emailParam || userEmail || '').trim()
    const targetDate = dateParam || todayStr
    if (!activeEmail) return

    setLoading(true)
    try {
      let query = supabase
        .from('jurnal_agenda')
        .select('*')
        .or('jenjang.eq.SMP,jenjang.is.null')
        .ilike('guru_email', activeEmail)
        .order('created_at', { ascending: false })

      if (targetDate) query = query.eq('tanggal', targetDate)

      const { data, error } = await query
      if (!error && data) {
        setJurnalList(data as any)
      } else {
        setJurnalList([])
      }
    } catch (err) {
      console.error('Error fetching jurnal SMP:', err)
    } finally {
      setLoading(false)
    }
  }

  const fetchRekap = async () => {
    if (!userEmail) return
    setLoadingRekap(true)
    try {
      let query = supabase
        .from('jurnal_agenda')
        .select('*')
        .or('jenjang.eq.SMP,jenjang.is.null')
        .order('created_at', { ascending: false })

      if (!isOperator) query = query.ilike('guru_email', userEmail.trim())

      if (filterKelasId) {
        if (filterKelasId === 'GABUNGAN') {
          query = query.eq('kelas', 'Gabungan (Semua Kelas)')
        } else {
          query = query.eq('kelas_id', Number(filterKelasId))
        }
      }
      if (filterMapelId) query = query.eq('mapel_id', Number(filterMapelId))
      if (filterStatus) query = query.eq('status', filterStatus)
      if (filterTanggal) query = query.eq('tanggal', filterTanggal)
      if (searchMateri.trim()) query = query.ilike('materi', `%${searchMateri.trim()}%`)

      const { data, error } = await query
      if (!error && data) {
        setRekapList(data as any)
      } else {
        setRekapList([])
      }
    } catch (err) {
      console.error('Error fetching rekap jurnal SMP:', err)
    } finally {
      setLoadingRekap(false)
    }
  }

  useEffect(() => {
    if (activeTab === 'rekap' && userEmail) fetchRekap()
  }, [activeTab, filterKelasId, filterMapelId, filterStatus, filterTanggal, searchMateri, userEmail, isOperator])

  useEffect(() => {
    if (userEmail) fetchJadwalGuru(userEmail)
  }, [isOperator, userEmail])

  const jamOptionsForHari = masterJamList.filter((j) => j.hari === hari)
  const isPenerapanOtomatis = !isOperator && !replaceMode && jadwalAutoList.length === 1

  // Ambil daftar guru pengampu jenjang SMP untuk dropdown operator
  async function fetchGuruList() {
    const { data } = await supabase
      .from('guru')
      .select('email, nama_lengkap, unit_mengajar')
      .order('nama_lengkap', { ascending: true })
    if (!data) return
    const list = (data as any[])
      .map((r) => ({
        email: (r.email || '').trim(),
        nama: (r.nama_lengkap || '').trim(),
        unit: (r.unit_mengajar || '').trim().toLowerCase(),
      }))
      .filter((g) => g.email && g.nama)
      .filter((g) => !g.unit || g.unit.includes('smp'))
      .map(({ email, nama }) => ({ email, nama }))
    setGuruList(list)
  }

  // Resolusi guru pengampu ASLI dari tabel jadwal (SMP). Mengembalikan null
  // jika tidak ada slot jadwal yang cocok / ambigu (butuh pilihan manual).
  async function resolveGuruPengampuFromJadwal(
    kelasIdVal: number | null,
    mapelIdNum: number,
    dayName: string,
    jamStart: number,
    jamEnd: number
  ): Promise<string | null> {
    try {
      let q = supabase
        .from('jadwal')
        .select('guru_email, jam, jam_ke')
        .or('jenjang.eq.SMP,jenjang.is.null')
        .eq('mapel_id', mapelIdNum)
        .eq('hari', dayName)
      q = kelasIdVal == null ? q.is('kelas_id', null) : q.eq('kelas_id', kelasIdVal)

      const { data } = await q
      if (!data || data.length === 0) return null

      const uniq = Array.from(
        new Set((data as any[]).map((r) => (r.guru_email || '').trim().toLowerCase()).filter(Boolean))
      )
      if (uniq.length === 1) return uniq[0]

      const overlapped = (data as any[]).filter((r) => {
        const rng = parseJadwalJamRangeText({ jam: r.jam, jam_ke: r.jam_ke })
        return rng.start <= jamEnd && rng.end >= jamStart
      })
      const uniq2 = Array.from(
        new Set(overlapped.map((r) => (r.guru_email || '').trim().toLowerCase()).filter(Boolean))
      )
      return uniq2.length === 1 ? uniq2[0] : null
    } catch {
      return null
    }
  }

  const handleSimpanJurnal = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedKelasId || !selectedMapelId || !materi.trim() || !tanggal) {
      alert('Silakan lengkapi Tanggal, Kelas, Mapel, dan Materi!')
      return
    }

    if (!isOperator && tanggal < todayStr) {
      alert('Anda tidak dapat mengisi jurnal agenda untuk tanggal yang terlewat!')
      return
    }

    if (!userEmail) {
      alert('Sesi login tidak valid. Silakan login ulang.')
      return
    }

    if (isAbsenMissing && absenBlockSave) {
      alert('Absensi sesi ini belum diisi. Silakan isi absensi siswa terlebih dahulu sebelum menyimpan jurnal.')
      return
    }

    setSaving(true)
    try {
      const selectedKelasObj = kelasList.find((k) => k.id === Number(selectedKelasId))
      const selectedMapelObj = mapelList.find((m) => m.id === Number(selectedMapelId))

      const startJamObj = masterJamList.find((j) => j.hari === hari && j.jam_ke === Number(jamMulai))
      const endJamObj = masterJamList.find((j) => j.hari === hari && j.jam_ke === Number(jamSelesai))

      let jamFormattedText = `Jam Ke-${jamMulai}`
      if (startJamObj && endJamObj) {
        const wMulai = startJamObj.waktu_mulai.slice(0, 5)
        const wSelesai = endJamObj.waktu_selesai.slice(0, 5)

        if (Number(jamMulai) === Number(jamSelesai)) {
          jamFormattedText = `Jam Ke-${jamMulai} (${wMulai} - ${wSelesai})`
        } else {
          jamFormattedText = `Jam Ke-${jamMulai} s/d ${jamSelesai} (${wMulai} - ${wSelesai})`
        }
      }

      const namaKelasSimpan = selectedKelasId === 'GABUNGAN' 
        ? 'Gabungan (Semua Kelas)' 
        : selectedKelasObj?.nama || ''

      const mapelIdNum = Number(selectedMapelId)
      const kelaskIdSimpan = selectedKelasId === 'GABUNGAN' ? null : Number(selectedKelasId)

      // PEMUTUSAN GURU PENGAMPU: utamakan data asli dari `jadwal` slot tersebut.
      // Bila tidak ada slot jadwal yang cocok (manual/insidental), operator memilih
      // guru pengampu dari dropdown — JANGAN pernah jatuh ke email akun operator.
      // Kondisi kehadiran menentukan siapa pemilik JP & Transport:
      //   - Terlaksana / Tertunda → guru pengampu asli tetap tercatat sebagai pemilik.
      //   - Digantikan (operator) → guru_email atas nama guru pengganti, status Terlaksana.
      const hariNama = getHariNama(tanggal)
      const resolvedGuru = hariNama
        ? await resolveGuruPengampuFromJadwal(
            kelaskIdSimpan,
            mapelIdNum,
            hariNama,
            Number(jamMulai),
            Number(jamSelesai)
          )
        : null

      let finalStatus: 'Terlaksana' | 'Tertunda'
      let guruEmailSimpan: string

      if (status === 'Digantikan') {
        finalStatus = 'Terlaksana'
        if (!replacementGuruEmail.trim()) {
          alert('Untuk kondisi "Digantikan Guru Lain", pilih Guru Pengganti terlebih dahulu.')
          setSaving(false)
          return
        }
        guruEmailSimpan = replacementGuruEmail.trim().toLowerCase()
      } else {
        finalStatus = status as 'Terlaksana' | 'Tertunda'
        const pengampuAsli =
          resolvedGuru ||
          (isOperator ? selectedGuruEmail.trim().toLowerCase() : userEmail.trim().toLowerCase())
        if (!pengampuAsli) {
          alert('Pilih Guru Pengampu terlebih dahulu (atau lengkapi kelas/jadwal agar cocok dengan slot resmi).')
          setSaving(false)
          return
        }
        guruEmailSimpan = pengampuAsli
      }

      // CEGAH DUPLIKASI: cek apakah sudah ada entri (tanggal + kelas_id + mapel_id)
      let queryDup = supabase
        .from('jurnal_agenda')
        .select('id')
        .eq('tanggal', tanggal)
        .eq('mapel_id', mapelIdNum)
      queryDup = kelaskIdSimpan == null ? queryDup.is('kelas_id', null) : queryDup.eq('kelas_id', kelaskIdSimpan)
      const { data: dupRows, error: dupErr } = await queryDup.maybeSingle()

      if (dupErr) throw dupErr
      if (dupRows?.id) {
        const okUpdate = confirm(
          `Sudah ada jurnal "${selectedMapelObj?.nama || ''}" untuk tanggal ${tanggal}. Perbarui catatan yang sudah ada? (OK = perbarui, Batal = batalkan simpan)`
        )
        if (!okUpdate) {
          setSaving(false)
          return
        }
        const payload = {
          jam_ke: jamFormattedText,
          jam_ke_num: parseJamKeNum(jamFormattedText),
          kelas_id: kelaskIdSimpan,
          mapel_id: mapelIdNum,
          kelas: namaKelasSimpan,
          mapel: selectedMapelObj?.nama || '',
          materi: materi.trim(),
          status: finalStatus,
          absen_siswa: absenSiswa.trim() || 'Nihil',
          keterangan: keterangan.trim(),
          guru_email: guruEmailSimpan,
          jenjang: 'SMP',
        }
        const { error: updErr } = await supabase
          .from('jurnal_agenda')
          .update(payload)
          .eq('id', dupRows.id)
        if (updErr) {
          alert('Gagal memperbarui jurnal: ' + updErr.message)
        } else {
          alert('Jurnal berhasil diperbarui (entri untuk tanggal tersebut ternyata sudah ada).')
          setMateri('')
          setKeterangan('')
          setSelectedKelasId('')
          setSelectedMapelId('')
          setAbsenSiswa('Nihil')
          fetchJurnal(userEmail, todayStr)
        }
        setSaving(false)
        return
      }

      const { error } = await supabase.from('jurnal_agenda').insert([
        {
          tanggal,
          jam_ke: jamFormattedText,
          jam_ke_num: parseJamKeNum(jamFormattedText),
          kelas_id: kelaskIdSimpan,
          mapel_id: mapelIdNum,
          kelas: namaKelasSimpan,
          mapel: selectedMapelObj?.nama || '',
          materi: materi.trim(),
          status: finalStatus,
          absen_siswa: absenSiswa.trim() || 'Nihil',
          keterangan: keterangan.trim(),
          guru_email: guruEmailSimpan,
          jenjang: 'SMP',
        },
      ])

      if (error) {
        alert('Gagal menyimpan jurnal: ' + error.message)
      } else {
        alert('Jurnal agenda mengajar berhasil disimpan!')
        setMateri('')
        setKeterangan('')
        setSelectedKelasId('')
        setSelectedMapelId('')
        setAbsenSiswa('Nihil')
        fetchJurnal(userEmail, todayStr)
      }
    } catch (err: any) {
      alert('Terjadi kesalahan: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteJurnal = async (id?: number | string) => {
    if (!id || !confirm('Hapus jurnal agenda ini?')) return
    try {
      const { error } = await supabase.from('jurnal_agenda').delete().eq('id', id)
      if (!error) {
        setJurnalList((prev) => prev.filter((item) => item.id !== id))
        setRekapList((prev) => prev.filter((item) => item.id !== id))
      }
    } catch (err) {
      console.error('Error deleting jurnal:', err)
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

  const totalJurnal = rekapList.length
  const totalTerlaksana = rekapList.filter((item) => item.status === 'Terlaksana').length
  const totalTertunda = rekapList.filter((item) => item.status === 'Tertunda').length

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={`h-screen w-screen overflow-hidden font-sans flex flex-col justify-between selection:bg-indigo-500 selection:text-white relative transition-colors duration-300 ${
        isDarkMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-200 text-slate-800'
      }`}
    >
      {/* WATERMARK LOGO */}
      <div className={`fixed inset-0 pointer-events-none z-0 flex items-center justify-center select-none print:hidden transition-opacity duration-300 ${
        isDarkMode ? 'opacity-[0.04]' : 'opacity-[0.12]'
      }`}>
        <img src="/logo-smp.jpg" alt="Watermark" className="w-[600px] h-[600px] object-contain max-w-none" />
      </div>

      <div className="relative z-10 flex flex-col h-full overflow-hidden">
        
        {/* 1. SUPER-COMPACT HEADER TOPBAR */}
        <header className={`border-b px-3 py-1.5 flex items-center justify-between gap-2 shrink-0 shadow-xs print:hidden transition-colors duration-300 ${
          isDarkMode ? 'bg-slate-900/95 border-slate-800 backdrop-blur-md' : 'bg-slate-100/95 border-slate-300 backdrop-blur-md'
        }`}>
          <div className="flex items-center gap-2 shrink-0">
            <Link href="/" className={`p-1 rounded-lg transition ${isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'}`} title="Kembali">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </Link>
            <div className="flex items-center gap-1.5">
              <img src="/logo-smp.jpg" alt="Logo" className="w-5 h-5 rounded border p-0.5 object-contain" />
              <h1 className={`font-black text-xs leading-none ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                Jurnal Agenda
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <DarkModeToggle />
            {/* BADGE PROFIL POJOK KANAN ATAS: NAMA LENGKAP GURU + NUPTK + PERAN DINAMIS */}
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
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </header>

        {/* 2. SUB-NAVBAR AKADEMIK (PILLS HORIZONTAL SCROLL) */}
        <div className={`border-b px-3 py-1 shrink-0 overflow-x-auto print:hidden transition-colors duration-300 ${
          isDarkMode ? 'bg-slate-900/80 border-slate-800 backdrop-blur-md' : 'bg-slate-200/80 border-slate-300 backdrop-blur-md'
        }`}>
          <div className="max-w-6xl mx-auto flex items-center gap-1 min-w-max text-[10px] font-bold">
            <Link href="/jadwal" className={`px-2 py-0.5 rounded border transition flex items-center gap-1 ${
              isDarkMode ? 'bg-slate-800 text-slate-300 border-slate-700' : 'bg-white text-slate-700 border-slate-300'
            }`}>
              <Clock className="w-4 h-4" /> Jadwal
            </Link>
            <Link href="/absensi" className={`px-2 py-0.5 rounded border transition flex items-center gap-1 ${
              isDarkMode ? 'bg-slate-800 text-slate-300 border-slate-700' : 'bg-white text-slate-700 border-slate-300'
            }`}>
              <ClipboardList className="w-4 h-4" /> Absensi
            </Link>
            <Link href="/nilai" className={`px-2 py-0.5 rounded border transition flex items-center gap-1 ${
              isDarkMode ? 'bg-slate-800 text-slate-300 border-slate-700' : 'bg-white text-slate-700 border-slate-300'
            }`}>
              <Star className="w-4 h-4" /> Penilaian
            </Link>
            <Link href="/jurnal" className="bg-indigo-600 text-white px-2 py-0.5 rounded shadow-xs font-extrabold flex items-center gap-1">
              <NotebookPen className="w-4 h-4" /> Jurnal
            </Link>
            {canAccessBimbingan && (
              <Link href="/bimbingan" className={`px-2 py-0.5 rounded border transition flex items-center gap-1 ${
                isDarkMode ? 'bg-slate-800 text-slate-300 border-slate-700' : 'bg-white text-slate-700 border-slate-300'
              }`}>
                <HeartHandshake className="w-4 h-4" /> Bimbingan
              </Link>
            )}
          </div>
        </div>

        {/* MAIN CONTENT CONTAINER (NO SCROLL CONTAINER) */}
        <main className="max-w-6xl w-full mx-auto p-2 flex-1 flex flex-col space-y-2 overflow-hidden mb-12">
          {isAbsenMissing && absenBlockSave && absenSessionInfo && (
            <DynamicIslandNotification
              title="Absensi Belum Diisi"
              subtitle={`Sesi ${absenSessionInfo.kelas} • ${absenSessionInfo.mapel} • ${absenSessionInfo.jam} belum di-absen. Isi absensi dahulu sebelum menyimpan jurnal.`}
              badge={1}
              accent="amber"
              link="/absensi"
              ctaLabel="Ke Absensi"
              ctaIcon={ClipboardList}
              centered
              secondaryCtaLabel="Ganti Mapel/Sesi"
              onSecondaryCta={() => {
                setSelectedKelasId('')
                setSelectedMapelId('')
              }}
            />
          )}
          
          {/* TAB SWITCHER */}
          <div className={`grid grid-cols-2 p-0.5 rounded-lg border w-full text-[11px] font-extrabold shrink-0 shadow-xs ${
            isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-300'
          }`}>
            <button
              onClick={() => setActiveTab('input')}
              className={`py-1 rounded-md transition flex items-center justify-center gap-1 cursor-pointer ${
                activeTab === 'input' 
                  ? 'bg-indigo-600 text-white shadow-xs' 
                  : isDarkMode ? 'text-slate-400' : 'text-slate-700'
              }`}
            >
              <ClipboardList className="w-4 h-4" /> Input Agenda
            </button>
            <button
              onClick={() => setActiveTab('rekap')}
              className={`py-1 rounded-md transition flex items-center justify-center gap-1 cursor-pointer ${
                activeTab === 'rekap' 
                  ? 'bg-indigo-600 text-white shadow-xs' 
                  : isDarkMode ? 'text-slate-400' : 'text-slate-700'
              }`}
            >
              <History className="w-4 h-4" /> Riwayat &amp; Rekap
            </button>
          </div>

          {activeTab === 'input' && (
            <div className="flex flex-col h-full overflow-hidden space-y-2">
              
              <div className="relative">
              <form onSubmit={handleSimpanJurnal} className={`border rounded-xl p-2 shrink-0 shadow-xs space-y-1.5 ${
                isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-indigo-200'
              }`}>
                {/* ROW 1: TANGGAL & JAM MENGAJAR */}
                <div className="grid grid-cols-12 gap-1.5">
                  <div className="col-span-6">
                    <input
                      type="date"
                      value={tanggal}
                      max={!isOperator ? todayStr : undefined}
                      onChange={(e) => {
                        const val = e.target.value
                        setTanggal(val)
                        if (val) {
                          const p = val.split('-').map(Number)
                          const d = new Date(p[0], p[1] - 1, p[2])
                          const nHari = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'][d.getDay()]
                          if (nHari !== 'Jumat') setHari(nHari)
                        }
                      }}
                      className={`w-full border rounded-lg px-2 py-1 text-xs font-bold focus:outline-none ${
                        isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                      }`}
                      required
                    />
                  </div>

                  <div className="col-span-6 flex gap-1">
                    <select
                      value={jamMulai}
                      disabled={isPenerapanOtomatis}
                      onChange={(e) => {
                        const val = e.target.value
                        setJamMulai(val)
                        if (Number(val) > Number(jamSelesai)) setJamSelesai(val)
                      }}
                      className={`w-full border rounded-lg px-1 py-1 text-xs font-bold focus:outline-none ${
                        isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                      }`}
                    >
                      {jamOptionsForHari.length > 0 ? (
                        jamOptionsForHari.map((j) => (
                          <option key={j.id} value={j.jam_ke}>Jam {j.jam_ke}</option>
                        ))
                      ) : (
                        [1, 2, 3, 4, 5, 6, 7, 8].map((num) => (
                          <option key={num} value={num}>Jam {num}</option>
                        ))
                      )}
                    </select>

                    <select
                      value={jamSelesai}
                      disabled={isPenerapanOtomatis}
                      onChange={(e) => setJamSelesai(e.target.value)}
                      className={`w-full border rounded-lg px-1 py-1 text-xs font-bold focus:outline-none ${
                        isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                      }`}
                    >
                      {jamOptionsForHari.length > 0 ? (
                        jamOptionsForHari
                          .filter((j) => j.jam_ke >= Number(jamMulai))
                          .map((j) => (
                            <option key={j.id} value={j.jam_ke}>s/d {j.jam_ke}</option>
                          ))
                      ) : (
                        [1, 2, 3, 4, 5, 6, 7, 8]
                          .filter((num) => num >= Number(jamMulai))
                          .map((num) => (
                            <option key={num} value={num}>s/d {num}</option>
                          ))
                      )}
                    </select>
                  </div>
                </div>

                {hariWarning && (
                  <div className="text-[10px] font-black text-rose-500 bg-rose-950/10 border border-rose-400/40 rounded-lg px-2 py-1">
                    {hariWarning}
                  </div>
                )}

                {/* ROW 2: KELAS & MAPEL */}
                <div className="grid grid-cols-12 gap-1.5">
                  <div className="col-span-6">
                    <select
                      value={selectedKelasId}
                      onChange={(e) => setSelectedKelasId(e.target.value)}
                      className={`w-full border rounded-lg px-2 py-1 text-xs font-bold focus:outline-none ${
                        isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                      }`}
                      required
                    >
                      <option value="">-- Kelas --</option>
                      <option value="GABUNGAN">Gabungan (Ekskul)</option>
                      {kelasList.map((k) => (
                        <option key={k.id} value={k.id}>{k.nama}</option>
                      ))}
                    </select>
                  </div>

                  <div className="col-span-6">
                    <select
                      value={selectedMapelId}
                      disabled={isPenerapanOtomatis}
                      onChange={handleMapelChange}
                      className={`w-full border rounded-lg px-2 py-1 text-xs font-bold focus:outline-none ${
                        isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                      }`}
                      required
                    >
                      <option value="">-- Mapel --</option>
                      {mapelList.map((m) => (
                        <option key={m.id} value={m.id}>{m.nama}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {isOperator && (
                  <div className="grid grid-cols-12 gap-1.5">
                    <div className="col-span-12">
                      <select
                        value={selectedGuruEmail}
                        onChange={(e) => setSelectedGuruEmail(e.target.value)}
                        className={`w-full border rounded-lg px-2 py-1 text-xs font-bold focus:outline-none ${
                          isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                        }`}
                      >
                        <option value="">-- Guru Pengampu (pilih bila input manual/insidental) --</option>
                        {guruList.map((g) => (
                          <option key={g.email} value={g.email}>{g.nama}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                {/* ROW 2.b: INDIKATOR OTOMATISASI JADWAL MENGAJAR */}
                {(isPenerapanOtomatis || jadwalAutoList.length > 0) && (
                  <div
                    className={`flex flex-wrap items-center gap-2 rounded-lg px-2 py-1 border text-[10px] font-bold ${
                      isPenerapanOtomatis
                        ? isDarkMode
                          ? 'bg-emerald-950/40 border-emerald-700 text-emerald-300'
                          : 'bg-emerald-50 border-emerald-300 text-emerald-800'
                        : isDarkMode
                        ? 'bg-slate-800 border-slate-700 text-slate-300'
                        : 'bg-slate-50 border-slate-200 text-slate-600'
                    }`}
                  >
                    {isPenerapanOtomatis ? (
                      <span className="flex items-center gap-1">
                        <Star className="w-3 h-3" /> Terkunci sesuai Jadwal resmi (Jam {jamMulai}-{jamSelesai})
                      </span>
                    ) : (
                      <span>Jadwal resmi terdeteksi ({jadwalAutoList.length}) — pilih kelas & biarkan terkunci.</span>
                    )}
                    <label className="flex items-center gap-1 cursor-pointer select-none">
                      <input type="checkbox" checked={replaceMode} onChange={(e) => setReplaceMode(e.target.checked)} />
                      Mode Jadwal Pengganti / Tukar Jam
                    </label>
                  </div>
                )}

                {/* ROW 3: MATERI PEMBELAJARAN */}
                <div>
                  <input
                    type="text"
                    value={materi}
                    onChange={(e) => setMateri(e.target.value)}
                    placeholder="Materi Pembelajaran..."
                    className={`w-full border rounded-lg px-2 py-1 text-xs font-bold focus:outline-none ${
                      isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                    required
                  />
                </div>

                {/* ROW 4: STATUS & ABSEN SISWA AUTO-FETCH */}
                <div className="grid grid-cols-12 gap-1.5 items-center">
                  <div className="col-span-5">
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value as 'Terlaksana' | 'Tertunda' | 'Digantikan')}
                      className={`w-full border rounded-lg px-2 py-1 text-xs font-bold focus:outline-none ${
                        status === 'Terlaksana' 
                          ? 'bg-emerald-100 text-emerald-900 border-emerald-300' 
                          : 'bg-rose-100 text-rose-900 border-rose-300'
                      }`}
                    >
                      <option value="Terlaksana">Terlaksana — Guru Hadir (JP + Transport dihitung)</option>
                      <option value="Tertunda">Tertunda — Guru Tidak Hadir / Tugas Mandiri (JP & Transport TIDAK dihitung)</option>
                      {isOperator && (
                        <option value="Digantikan">Digantikan Guru Lain (JP & Transport masuk ke guru pengganti)</option>
                      )}
                    </select>
                  </div>

                  <div className="col-span-7 flex items-center gap-1">
                    <input
                      type="text"
                      value={absenSiswa}
                      onChange={(e) => setAbsenSiswa(e.target.value)}
                      placeholder="Absen Siswa..."
                      className={`w-full border rounded-lg px-2 py-1 text-[11px] font-bold focus:outline-none ${
                        isDarkMode ? 'bg-slate-800 border-slate-700 text-emerald-400' : 'bg-slate-50 border-slate-300 text-emerald-700'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => fetchAbsensiOtomatis(tanggal, selectedKelasId, selectedMapelId)}
                      className="px-2 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-bold shrink-0 cursor-pointer"
                      title="Refresh Absensi Supabase"
                    >
                      {loadingAutoAbsen ? <Timer className="w-4 h-4" /> : <RefreshCw className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {isOperator && status === 'Digantikan' && (
                  <div className="grid grid-cols-12 gap-1.5">
                    <div className="col-span-12">
                      <select
                        value={replacementGuruEmail}
                        onChange={(e) => setReplacementGuruEmail(e.target.value)}
                        className={`w-full border rounded-lg px-2 py-1 text-xs font-bold focus:outline-none ${
                          isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                        }`}
                      >
                        <option value="">-- Guru Pengganti --</option>
                        {guruList.map((g) => (
                          <option key={g.email} value={g.email}>{g.nama}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                {/* TOMBOL SIMPAN AGENDA */}
                <button
                  type="submit"
                  disabled={saving || (isAbsenMissing && absenBlockSave)}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-600 text-white font-black py-1.5 rounded-lg text-xs transition shadow-xs flex items-center justify-center gap-1 cursor-pointer mt-1"
                >
                  <Save className="w-4 h-4" />
                  <span>{saving ? 'Menyimpan...' : isAbsenMissing && absenBlockSave ? 'ISI ABSENSI DULU' : 'SIMPAN JURNAL AGENDA'}</span>
                </button>
                {isAbsenMissing && !absenBlockSave && absenSessionInfo && (
                  <div className="mt-1 flex items-center gap-1 text-[10px] font-black text-amber-600 bg-amber-950/10 border border-amber-400/40 rounded-lg px-2 py-1">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>
                      Absensi sesi {absenSessionInfo.kelas} • {absenSessionInfo.mapel} • {absenSessionInfo.jam} belum diisi.
                      {absenBlockSave
                        ? ' Sesi ini dari jadwal resmi — simpan diblokir hingga absensi diisi.'
                        : ' Ini bukan sesi dari jadwal resmi — Anda tetap dapat menyimpan jurnal (disarankan isi absensi dahulu).'}
                    </span>
                  </div>
                )}
              </form>
              {isAbsenMissing && absenBlockSave && (
                <div className="absolute inset-0 z-20 bg-black/75 backdrop-blur-sm rounded-xl cursor-not-allowed" />
              )}
              </div>

              {/* AREA 60% BAWAH: DAFTAR / RIWAYAT JURNAL HARI INI (INTERNAL SCROLL AREA) */}
              <div className={`border rounded-xl p-2 flex-1 flex flex-col overflow-hidden shadow-xs ${
                isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-indigo-200'
              }`}>
                <div className="flex items-center justify-between pb-1.5 border-b border-slate-700/30 shrink-0">
                  <h3 className={`text-[11px] font-black uppercase flex items-center gap-1 ${isDarkMode ? 'text-indigo-300' : 'text-indigo-900'}`}>
                    <NotebookPen className="w-4 h-4" /> Agenda Hari Ini ({jurnalList.length})
                  </h3>
                  <span className="text-[10px] font-mono text-slate-400">{todayStr}</span>
                </div>

                {/* AREA SCROLL KHUSUS HANYA UNTUK RIWAYAT GURU */}
                <div className="flex-1 overflow-y-auto pr-1 pt-1.5 space-y-1.5">
                  {loading ? (
                    <div className={`py-6 text-center text-xs font-medium ${isDarkMode ? 'text-slate-500' : 'text-slate-600'}`}>
                      Memuat agenda...
                    </div>
                  ) : jurnalList.length === 0 ? (
                    <div className={`py-6 text-center text-xs font-medium ${isDarkMode ? 'text-slate-500' : 'text-slate-600'}`}>
                      Belum ada jurnal agenda tersimpan hari ini.
                    </div>
                  ) : (
                    jurnalList.map((item, index) => (
                      <div
                        key={item.id || index}
                        className={`p-2 rounded-lg border transition shadow-xs flex flex-col gap-1 ${
                          isDarkMode ? 'bg-slate-800/80 border-slate-700' : 'bg-slate-50 border-slate-200'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className={`text-[11px] font-extrabold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                            {item.kelas} • {item.mapel}
                          </span>
                          <span className="text-[10px] font-bold text-indigo-400">{item.jam_ke}</span>
                        </div>

                        <p className={`text-[11px] font-bold leading-tight ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>
                          <BookOpen className="w-4 h-4 inline-block align-middle" /> {item.materi}
                        </p>

                        <div className="flex items-center justify-between pt-1 border-t border-slate-700/20 text-[10px]">
                          <span className={`font-mono ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                            Absen: {item.absen_siswa}
                          </span>
                          
                          <div className="flex items-center gap-1.5">
                            <span className={`px-1.5 py-0.2 rounded font-black text-[9px] uppercase ${
                              item.status === 'Terlaksana'
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                : 'bg-rose-100 text-rose-800 border border-rose-300'
                            }`}>
                              {item.status}
                            </span>

                            <button
                              onClick={() => handleDeleteJurnal(item.id)}
                              className="text-rose-500 hover:text-rose-700 font-bold p-0.5 cursor-pointer"
                              title="Hapus"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

            </div>
          )}

          {/* TAB 2: RIWAYAT & REKAPITULASI (INTERNAL SCROLL AREA) */}
          {activeTab === 'rekap' && (
            <div className="flex flex-col h-full overflow-hidden space-y-2">
              
              {/* STATISTIK RINGKAS */}
              <div className="grid grid-cols-3 gap-1.5 shrink-0 text-center">
                <div className={`border rounded-lg p-1.5 shadow-xs ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-300'}`}>
                  <p className={`text-[9px] font-black uppercase ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>TOTAL</p>
                  <p className={`text-sm font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{totalJurnal}</p>
                </div>
                <div className={`border rounded-lg p-1.5 shadow-xs ${isDarkMode ? 'bg-slate-900 border-emerald-800' : 'bg-white border-emerald-200'}`}>
                  <p className={`text-[9px] font-black uppercase ${isDarkMode ? 'text-emerald-400' : 'text-emerald-700'}`}>TERLAKSANA</p>
                  <p className={`text-sm font-black ${isDarkMode ? 'text-emerald-300' : 'text-emerald-900'}`}>{totalTerlaksana}</p>
                </div>
                <div className={`border rounded-lg p-1.5 shadow-xs ${isDarkMode ? 'bg-slate-900 border-rose-800' : 'bg-white border-rose-200'}`}>
                  <p className={`text-[9px] font-black uppercase ${isDarkMode ? 'text-rose-400' : 'text-rose-700'}`}>TERTUNDA</p>
                  <p className={`text-sm font-black ${isDarkMode ? 'text-rose-300' : 'text-rose-900'}`}>{totalTertunda}</p>
                </div>
              </div>

              {/* FILTER BAR REKAP */}
              <div className={`grid grid-cols-2 gap-1 border p-1.5 rounded-lg shrink-0 shadow-xs ${
                isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-indigo-200'
              }`}>
                <select
                  value={filterKelasId}
                  onChange={(e) => setFilterKelasId(e.target.value)}
                  className={`border rounded px-1.5 py-0.5 text-xs font-bold focus:outline-none ${
                    isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                >
                  <option value="">Semua Kelas</option>
                  <option value="GABUNGAN">Gabungan (Ekskul)</option>
                  {kelasList.map((k) => (
                    <option key={k.id} value={k.id}>{k.nama}</option>
                  ))}
                </select>

                <select
                  value={filterMapelId}
                  onChange={(e) => setFilterMapelId(e.target.value)}
                  className={`border rounded px-1.5 py-0.5 text-xs font-bold focus:outline-none ${
                    isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                >
                  <option value="">Semua Mapel</option>
                  {mapelList.map((m) => (
                    <option key={m.id} value={m.id}>{m.nama}</option>
                  ))}
                </select>

                <input
                  type="date"
                  value={filterTanggal}
                  onChange={(e) => setFilterTanggal(e.target.value)}
                  className={`border rounded px-1.5 py-0.5 text-xs font-bold focus:outline-none ${
                    isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                />

                <input
                  type="text"
                  value={searchMateri}
                  onChange={(e) => setSearchMateri(e.target.value)}
                  placeholder="Cari materi..."
                  className={`border rounded px-1.5 py-0.5 text-xs font-bold focus:outline-none ${
                    isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                />
              </div>

              {/* LIST REKAP (INTERNAL SCROLL) */}
              <div className={`border rounded-xl p-2 flex-1 flex flex-col overflow-hidden shadow-xs ${
                isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-indigo-200'
              }`}>
                {loadingRekap ? (
                  <div className={`py-6 text-center text-xs font-medium ${isDarkMode ? 'text-slate-500' : 'text-slate-600'}`}>
                    Memuat riwayat...
                  </div>
                ) : rekapList.length === 0 ? (
                  <div className={`py-6 text-center text-xs font-medium ${isDarkMode ? 'text-slate-500' : 'text-slate-600'}`}>
                    Tidak ada riwayat jurnal.
                  </div>
                ) : (
                  <div className="flex-1 overflow-y-auto pr-1 space-y-1.5">
                    {rekapList.map((item, index) => (
                      <div
                        key={item.id || index}
                        className={`p-2 rounded-lg border transition shadow-xs flex flex-col gap-1 ${
                          isDarkMode ? 'bg-slate-800/80 border-slate-700' : 'bg-slate-50 border-slate-200'
                        }`}
                      >
                        <div className="flex items-center justify-between text-[11px] font-bold">
                          <span className={isDarkMode ? 'text-slate-400' : 'text-slate-600'}>
                            <CalendarDays className="w-4 h-4 inline-block align-middle" /> {item.tanggal} ({item.jam_ke})
                          </span>
                          <span className={`px-1.5 py-0.2 rounded font-black text-[9px] uppercase ${
                            item.status === 'Terlaksana'
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                              : 'bg-rose-100 text-rose-800 border border-rose-300'
                          }`}>
                            {item.status}
                          </span>
                        </div>

                        <div className={`text-xs font-extrabold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                          {item.kelas} - {item.mapel}
                        </div>

                        <p className={`text-[11px] font-bold ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>
                          <BookOpen className="w-4 h-4 inline-block align-middle" /> {item.materi}
                        </p>

                        <div className="flex items-center justify-between pt-1 border-t border-slate-700/20 text-[10px]">
                          <span className={`font-mono ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                            Absen: {item.absen_siswa}
                          </span>
                          <button
                            onClick={() => handleDeleteJurnal(item.id)}
                            className="text-rose-500 hover:text-rose-700 font-bold p-0.5 cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
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
