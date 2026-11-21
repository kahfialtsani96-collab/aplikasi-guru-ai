'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuthRole } from '@/hooks/useAuthRole'
import { useSmkColor, SMK_COLOR_KEYS, type SmkColorKey } from '../smkTheme'
import {
  ArrowLeft,
  Save,
  Trash2,
  RefreshCw,
  Sparkles,
  Clock,
  CheckCircle2,
  AlertCircle,
  Star,
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
  semester?: string
  tahun_ajaran?: string
}

// Palet warna lampu jurnal per warna bersama SMK
const JURNAL_PALETTE: Record<
  SmkColorKey,
  {
    glowGrad: string
    floorGrad: string
    haloBg: string
    coneTop: string
    coneMid: string
    shadeStop0: string
    shadeStop38: string
    shadeStop72: string
    shadeStop100: string
    woodStop0: string
    woodStop50: string
    woodStop100: string
    floorEllipseFill: string
    legStroke: string
    collarFill: string
    bulbInnerFill: string
    bulbFilter: string
    shadeStroke: string
    cordStroke: string
    knobFill: string
    labelFill: string
    cardBorder: string
    cardShadow: string
    cardGlow: string
  }
> = {
  white: {
    glowGrad: 'radial-gradient(circle at 32% 38%, rgba(226, 232, 240, 0.22) 0%, rgba(148, 163, 184, 0.08) 42%, rgba(10, 11, 13, 1) 78%)',
    floorGrad: 'linear-gradient(180deg, rgba(10,11,13,0) 0%, rgba(226, 232, 240, 0.06) 40%, rgba(13, 15, 18, 0.95) 100%)',
    haloBg: 'rgba(226, 232, 240, 0.28)',
    coneTop: '#f1f5f9',
    coneMid: '#cbd5e1',
    shadeStop0: '#e2e8f0',
    shadeStop38: '#f8fafc',
    shadeStop72: '#e2e8f0',
    shadeStop100: '#94a3b8',
    woodStop0: '#475569',
    woodStop50: '#94a3b8',
    woodStop100: '#334155',
    floorEllipseFill: 'rgba(226, 232, 240, 0.15)',
    legStroke: '#1e293b',
    collarFill: '#94a3b8',
    bulbInnerFill: '#ffffff',
    bulbFilter: 'drop-shadow(0 4px 16px rgba(255,255,255,0.8))',
    shadeStroke: '#f1f5f9',
    cordStroke: '#cbd5e1',
    knobFill: '#e2e8f0',
    labelFill: '#cbd5e1',
    cardBorder: 'rgba(226, 232, 240, 0.22)',
    cardShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.75), 0 0 40px -12px rgba(226, 232, 240, 0.14)',
    cardGlow: 'rgba(226, 232, 240, 0.10)',
  },
  green: {
    glowGrad: 'radial-gradient(circle at 32% 38%, rgba(52, 211, 153, 0.24) 0%, rgba(5, 150, 105, 0.08) 42%, rgba(7, 11, 10, 1) 78%)',
    floorGrad: 'linear-gradient(180deg, rgba(7,11,10,0) 0%, rgba(52, 211, 153, 0.07) 40%, rgba(9, 15, 13, 0.95) 100%)',
    haloBg: 'rgba(52, 211, 153, 0.30)',
    coneTop: '#a7f3d0',
    coneMid: '#34d399',
    shadeStop0: '#6ee7b7',
    shadeStop38: '#d1fae5',
    shadeStop72: '#a7f3d0',
    shadeStop100: '#059669',
    woodStop0: '#065f46',
    woodStop50: '#10b981',
    woodStop100: '#064e3b',
    floorEllipseFill: 'rgba(52, 211, 153, 0.16)',
    legStroke: '#022c22',
    collarFill: '#059669',
    bulbInnerFill: '#d1fae5',
    bulbFilter: 'drop-shadow(0 4px 16px rgba(52,211,153,0.85))',
    shadeStroke: '#a7f3d0',
    cordStroke: '#a7f3d0',
    knobFill: '#34d399',
    labelFill: '#6ee7b7',
    cardBorder: 'rgba(52, 211, 153, 0.25)',
    cardShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.75), 0 0 40px -12px rgba(52, 211, 153, 0.16)',
    cardGlow: 'rgba(52, 211, 153, 0.12)',
  },
  red: {
    glowGrad: 'radial-gradient(circle at 32% 38%, rgba(226, 112, 126, 0.25) 0%, rgba(158, 62, 78, 0.09) 42%, rgba(11, 9, 8, 1) 78%)',
    floorGrad: 'linear-gradient(180deg, rgba(11,9,8,0) 0%, rgba(196, 92, 108, 0.07) 40%, rgba(18, 12, 14, 0.95) 100%)',
    haloBg: 'rgba(235, 118, 132, 0.34)',
    coneTop: '#e57b88',
    coneMid: '#c45a68',
    shadeStop0: '#b85a66',
    shadeStop38: '#df8490',
    shadeStop72: '#cf6f7b',
    shadeStop100: '#96434e',
    woodStop0: '#7a5256',
    woodStop50: '#b88488',
    woodStop100: '#4f3336',
    floorEllipseFill: 'rgba(229, 123, 136, 0.16)',
    legStroke: '#4a3033',
    collarFill: '#9c666c',
    bulbInnerFill: '#ffd1d7',
    bulbFilter: 'drop-shadow(0 4px 16px rgba(229,123,136,0.85))',
    shadeStroke: '#f4a4ae',
    cordStroke: '#eab6bd',
    knobFill: '#e57b88',
    labelFill: '#cfa0a6',
    cardBorder: 'rgba(229, 123, 136, 0.25)',
    cardShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.75), 0 0 40px -12px rgba(229, 123, 136, 0.18)',
    cardGlow: 'rgba(229, 123, 136, 0.13)',
  },
  cyan: {
    glowGrad: 'radial-gradient(circle at 32% 38%, rgba(34, 211, 238, 0.24) 0%, rgba(8, 145, 178, 0.09) 42%, rgba(7, 10, 13, 1) 78%)',
    floorGrad: 'linear-gradient(180deg, rgba(7,10,13,0) 0%, rgba(34, 211, 238, 0.07) 40%, rgba(8, 14, 18, 0.95) 100%)',
    haloBg: 'rgba(34, 211, 238, 0.30)',
    coneTop: '#a5f3fc',
    coneMid: '#22d3ee',
    shadeStop0: '#67e8f9',
    shadeStop38: '#cffafe',
    shadeStop72: '#a5f3fc',
    shadeStop100: '#0891b2',
    woodStop0: '#155e75',
    woodStop50: '#06b6d4',
    woodStop100: '#164e63',
    floorEllipseFill: 'rgba(34, 211, 238, 0.16)',
    legStroke: '#083344',
    collarFill: '#0891b2',
    bulbInnerFill: '#cffafe',
    bulbFilter: 'drop-shadow(0 4px 16px rgba(34,211,238,0.85))',
    shadeStroke: '#a5f3fc',
    cordStroke: '#a5f3fc',
    knobFill: '#22d3ee',
    labelFill: '#67e8f9',
    cardBorder: 'rgba(34, 211, 238, 0.25)',
    cardShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.75), 0 0 40px -12px rgba(34, 211, 238, 0.16)',
    cardGlow: 'rgba(34, 211, 238, 0.12)',
  },
  amber: {
    glowGrad: 'radial-gradient(circle at 32% 38%, rgba(235, 178, 112, 0.24) 0%, rgba(168, 114, 58, 0.08) 42%, rgba(11, 9, 8, 1) 78%)',
    floorGrad: 'linear-gradient(180deg, rgba(11,9,8,0) 0%, rgba(196, 146, 92, 0.07) 40%, rgba(18, 14, 11, 0.95) 100%)',
    haloBg: 'rgba(246, 196, 134, 0.34)',
    coneTop: '#f5c78e',
    coneMid: '#d49b5c',
    shadeStop0: '#d8b48a',
    shadeStop38: '#f5dec0',
    shadeStop72: '#e8caa3',
    shadeStop100: '#b99368',
    woodStop0: '#8c6d4e',
    woodStop50: '#cfa97e',
    woodStop100: '#5c442e',
    floorEllipseFill: 'rgba(245, 199, 142, 0.16)',
    legStroke: '#5a432d',
    collarFill: '#b99368',
    bulbInnerFill: '#fff3d6',
    bulbFilter: 'drop-shadow(0 4px 16px rgba(245,199,142,0.85))',
    shadeStroke: '#fae6c8',
    cordStroke: '#e7d2b5',
    knobFill: '#f5c78e',
    labelFill: '#cbb79c',
    cardBorder: 'rgba(245, 199, 142, 0.22)',
    cardShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.75), 0 0 40px -12px rgba(245, 199, 142, 0.16)',
    cardGlow: 'rgba(245, 199, 142, 0.12)',
  },
}

const HARI_INDONESIA_SMK = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']

function getHariNama(tgl: string): string {
  const d = new Date(`${String(tgl).slice(0, 10)}T00:00:00`)
  if (Number.isNaN(d.getTime())) return ''
  return HARI_INDONESIA_SMK[d.getDay()]
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
  const nama = HARI_INDONESIA_SMK[new Date().getDay()]
  return nama !== 'Jumat' ? nama : 'Sabtu'
}

export default function SmkJurnalPage() {
  const router = useRouter()
  const { isOperator } = useAuthRole()

  const [userDisplayName, setUserDisplayName] = useState('MEMUAT...')
  const [userEmail, setUserEmail] = useState<string | null>(null)

  // Default langsung menyala Warm Gold (Input Agenda)
  const [showHistory, setShowHistory] = useState(false)
  const { color: lampColor, setColor: setLampColor } = useSmkColor()
  const [isPulling, setIsPulling] = useState(false)

  // Master Data SMK
  const [kelasList, setKelasList] = useState<OptionItem[]>([])
  const [mapelList, setMapelList] = useState<OptionItem[]>([])
  const [masterJamList, setMasterJamList] = useState<MasterJamItem[]>([])

  // Daftar guru pengampu SMK (untuk dropdown saat operator menginput manual/insidental)
  const [guruList, setGuruList] = useState<GuruOption[]>([])
  const [selectedGuruEmail, setSelectedGuruEmail] = useState('')
  const [jadwalSmkList, setJadwalSmkList] = useState<JadwalSlotSmk[]>([])

  // Form Input Agenda SMK
  const [tanggal, setTanggal] = useState('')
  const [todayStr, setTodayStr] = useState('')
  const [hari, setHari] = useState('Senin')
  const [jamMulai, setJamMulai] = useState('1')
  const [jamSelesai, setJamSelesai] = useState('1')
  const [selectedKelasId, setSelectedKelasId] = useState('')
  const [selectedMapelId, setSelectedMapelId] = useState('')
  const [materi, setMateri] = useState('')
  const [status, setStatus] = useState<'Terlaksana' | 'Tertunda'>('Terlaksana')
  const [absenSiswa, setAbsenSiswa] = useState('Nihil')
  const [keterangan, setKeterangan] = useState('')

  const [saving, setSaving] = useState(false)
  const [loadingAutoAbsen, setLoadingAutoAbsen] = useState(false)

  // State Riwayat Jurnal SMK
  const [rekapList, setRekapList] = useState<JurnalRecord[]>([])
  const [filterKelasId, setFilterKelasId] = useState('')
  const [filterTanggal] = useState('')
  const [searchMateri, setSearchMateri] = useState('')
  const [loadingRekap, setLoadingRekap] = useState(false)

  // Isi tanggal hari ini hanya di browser setelah mount (hindari SSR/hydration mismatch).
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setTanggal(getTodayStrDefault())
    setTodayStr(getTodayStrDefault())
    setHari(getHariTodayDefault())
  }, [])
  /* eslint-enable react-hooks/set-state-in-effect */

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
        const formattedJadwal: JadwalSlotSmk[] = rawJadwal.map((j: { id: number; hari?: string | null; jam_ke?: number | null; kelas_id?: number | null; mapel_id?: number | null; guru_email?: string | null; jenjang?: string | null; kelas?: { id?: number; nama_kelas?: string } | Array<{ id?: number; nama_kelas?: string }> | null; mapel?: { id?: number; nama_mapel?: string; kode_mapel?: string | null } | Array<{ id?: number; nama_mapel?: string; kode_mapel?: string | null }> | null }) => {
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
        console.error('Error fetching jadwal guru SMK:', err)
      }
    },
    [isOperator]
  )

  const fetchRekapSmk = useCallback(
    async (emailParam?: string | null) => {
      const activeEmail = (emailParam || userEmail || '').trim().toLowerCase()
      if (!activeEmail) return
      setLoadingRekap(true)
      try {
        let query = supabase
          .from('jurnal_agenda')
          .select('*')
          .eq('jenjang', 'SMK')
          .order('tanggal', { ascending: false })
          .order('created_at', { ascending: false })

        if (!isOperator) query = query.ilike('guru_email', activeEmail)
        if (filterKelasId) {
          if (filterKelasId === 'GABUNGAN') {
            query = query.eq('kelas', 'Gabungan (Semua Kelas DKV)')
          } else {
            query = query.eq('kelas_id', Number(filterKelasId))
          }
        }
        if (filterTanggal) query = query.eq('tanggal', filterTanggal)
        if (searchMateri.trim()) query = query.ilike('materi', `%${searchMateri.trim()}%`)

        const { data, error } = await query
        if (!error && data) {
          setRekapList(data as JurnalRecord[])
        } else {
          setRekapList([])
        }
      } catch (err) {
        console.error('Error fetching rekap jurnal SMK:', err)
      } finally {
        setLoadingRekap(false)
      }
    },
    [userEmail, isOperator, filterKelasId, filterTanggal, searchMateri]
  )

  useEffect(() => {
    let isMounted = true

    async function initUser() {
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
        .select('nama_lengkap')
        .ilike('email', cleanEmail)
        .maybeSingle()

      if (isMounted) {
        if (dataGuruLogin?.nama_lengkap) {
          setUserDisplayName(dataGuruLogin.nama_lengkap.trim())
        } else {
          setUserDisplayName(
            user.user_metadata?.full_name || cleanEmail.split('@')[0] || 'Guru SMK'
          )
        }
      }

      await fetchJadwalGuruSmk(rawEmail)
      await fetchMasterJamSmk()
      await fetchRekapSmk(rawEmail)
    }

    initUser()

    return () => {
      isMounted = false
    }
  }, [router, fetchJadwalGuruSmk, fetchMasterJamSmk, fetchRekapSmk])

  // Auto-fetch Absensi Siswa SMK
  const fetchAbsensiOtomatisSmk = useCallback(
    async (targetDate: string, targetKelasId: string, targetMapelId: string) => {
      if (!targetDate || !targetKelasId) return

      const isGabungan = targetKelasId === 'GABUNGAN'
      setLoadingAutoAbsen(true)
      try {
        let query = supabase
          .from('absensi')
          .select('nama_siswa, status, kelas')
          .eq('jenjang', 'SMK')
          .eq('tanggal', targetDate)

        if (isGabungan) {
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
          const tidakHadirList = absensiData.filter(
            (a) => a.status && a.status.toUpperCase() !== 'HADIR'
          )

          if (tidakHadirList.length === 0) {
            setAbsenSiswa(`Nihil (${absensiData.length} hadir)`)
          } else {
            const dikelompokkan: Record<string, string[]> = {}
            tidakHadirList.forEach((item) => {
              const st = item.status.toUpperCase()
              const namaFormatted =
                isGabungan && item.kelas
                  ? `${item.nama_siswa || 'Siswa'} (${item.kelas})`
                  : item.nama_siswa || 'Siswa'

              if (!dikelompokkan[st]) dikelompokkan[st] = []
              dikelompokkan[st].push(namaFormatted)
            })

            setAbsenSiswa(
              Object.entries(dikelompokkan)
                .map(([stKey, names]) => `${stKey}: ${names.join(', ')}`)
                .join(' | ')
            )
          }
        }
      } catch (err) {
        console.error('Gagal mengambil absensi otomatis SMK:', err)
      } finally {
        setLoadingAutoAbsen(false)
      }
    },
    []
  )

  useEffect(() => {
    if (tanggal && selectedKelasId) {
      // Memuat absensi otomatis saat jadwal dipilih
      // eslint-disable-next-line react-hooks/set-state-in-effect
      fetchAbsensiOtomatisSmk(tanggal, selectedKelasId, selectedMapelId)
    }
  }, [tanggal, selectedKelasId, selectedMapelId, fetchAbsensiOtomatisSmk])

  useEffect(() => {
    if (userEmail) {
      // Memuat rekap saat kondisi berubah
      // eslint-disable-next-line react-hooks/set-state-in-effect
      fetchRekapSmk(userEmail)
    }
  }, [filterKelasId, filterTanggal, searchMateri, userEmail, fetchRekapSmk])

  useEffect(() => {
    if (isOperator) {
      // fetchGuruListSmk dideklarasikan di bawah (function declaration di-hoist), jadi aman diakses
      // eslint-disable-next-line react-hooks/immutability
      fetchGuruListSmk()
    }
  }, [isOperator])

  const handleSelectJadwalPreset = (slots: JadwalSlotSmk[]) => {
    if (!slots || slots.length === 0) return
    const sorted = [...slots].sort((a, b) => a.jam_ke - b.jam_ke)
    const first = sorted[0]
    const last = sorted[sorted.length - 1]

    setJamMulai(String(first.jam_ke))
    setJamSelesai(String(last.jam_ke))
    setSelectedKelasId(first.kelas_id ? String(first.kelas_id) : 'GABUNGAN')
    if (first.mapel_id) {
      setSelectedMapelId(String(first.mapel_id))
    }
  }

  // Ambil daftar guru pengampu jenjang SMK untuk dropdown operator
  async function fetchGuruListSmk() {
    const { data } = await supabase
      .from('guru')
      .select('email, nama_lengkap, unit_mengajar')
      .order('nama_lengkap', { ascending: true })
    if (!data) return
    const list = (data as Array<{ email?: string | null; nama_lengkap?: string | null; unit_mengajar?: string | null }>)
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

  // Resolusi guru pengampu ASLI dari tabel jadwal SMK.
  async function resolveGuruPengampuFromJadwalSmk(
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
        .eq('jenjang', 'SMK')
        .eq('mapel_id', mapelIdNum)
        .eq('hari', dayName)
      q = kelasIdVal == null ? q.is('kelas_id', null) : q.eq('kelas_id', kelasIdVal)

      const { data } = await q
      if (!data || data.length === 0) return null

      const uniq = Array.from(
        new Set((data as Array<{ guru_email?: string | null }>).map((r) => (r.guru_email || '').trim().toLowerCase()).filter(Boolean))
      )
      if (uniq.length === 1) return uniq[0]

      const overlapped = (data as Array<{ guru_email?: string | null; jam?: string | number | null; jam_ke?: number | null }>).filter((r) => {
        const str = String(r.jam || r.jam_ke || '')
        const m = str.match(/jam\s*ke[-:\s]*(\d+)(?:[^0-9]+(\d+))?/i)
        const s = m ? parseInt(m[1], 10) || 1 : 1
        const rawE = m && m[2] ? parseInt(m[2], 10) : NaN
        const e = Number.isFinite(rawE) ? rawE : s
        const rng = { start: Math.min(s, e), end: Math.max(s, e) }
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

  const handleSimpanJurnalSmk = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedKelasId || !selectedMapelId || !materi.trim() || !tanggal) {
      alert('Lengkapi Tanggal, Kelas, Mata Pelajaran, dan Materi terlebih dahulu.')
      return
    }

    if (!isOperator && tanggal < todayStr) {
      alert('Anda tidak dapat mengisi jurnal untuk tanggal yang sudah terlewat.')
      return
    }

    if (!userEmail) return

    setSaving(true)
    try {
      const selectedKelasObj = kelasList.find((k) => k.id === Number(selectedKelasId))
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
        jamFormattedText =
          Number(jamMulai) === Number(jamSelesai)
            ? `Jam Ke-${jamMulai} (${wMulai} - ${wSelesai})`
            : `Jam Ke-${jamMulai} s/d ${jamSelesai} (${wMulai} - ${wSelesai})`
      }

      const namaKelasSimpan =
        selectedKelasId === 'GABUNGAN'
          ? 'Gabungan (Semua Kelas DKV)'
          : selectedKelasObj?.nama || ''

      const cleanEmail = userEmail.trim().toLowerCase()

      // PEMUTUSAN GURU PENGAMPU: utamakan data asli dari `jadwal` slot SMK.
      const hariNama = getHariNama(tanggal)
      const mapelIdNum = Number(selectedMapelId)
      const kelasIdSimpan = selectedKelasId === 'GABUNGAN' ? null : Number(selectedKelasId)
      const resolvedGuru = hariNama
        ? await resolveGuruPengampuFromJadwalSmk(
            kelasIdSimpan,
            mapelIdNum,
            hariNama,
            Number(jamMulai),
            Number(jamSelesai)
          )
        : null
      const guruEmailSimpan = resolvedGuru || (isOperator && selectedGuruEmail.trim() ? selectedGuruEmail.trim().toLowerCase() : cleanEmail)

      const { error } = await supabase.from('jurnal_agenda').insert([
        {
          tanggal,
          jam_ke: jamFormattedText,
          kelas_id: selectedKelasId === 'GABUNGAN' ? null : Number(selectedKelasId),
          mapel_id: Number(selectedMapelId),
          kelas: namaKelasSimpan,
          mapel: selectedMapelObj?.nama || '',
          materi: materi.trim(),
          status,
          absen_siswa: absenSiswa.trim() || 'Nihil',
          keterangan: keterangan.trim(),
          guru_email: guruEmailSimpan,
          jenjang: 'SMK',
        },
      ])

      if (error) {
        alert('Gagal menyimpan jurnal SMK: ' + error.message)
      } else {
        setMateri('')
        setKeterangan('')
        setSelectedKelasId('')
        setSelectedMapelId('')
        setAbsenSiswa('Nihil')
        await fetchRekapSmk(cleanEmail)
        // Otomatis tarik tali lampu lembut ke mode Coral (Riwayat) setelah tersimpan
        setShowHistory(true)
        setLampColor('red')
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error tidak diketahui'
      alert('Terjadi kesalahan: ' + message)
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteJurnal = async (id?: number | string) => {
    if (!id || !confirm('Hapus catatan jurnal SMK ini?')) return
    try {
      const { error } = await supabase.from('jurnal_agenda').delete().eq('id', id)
      if (!error) {
        setRekapList((prev) => prev.filter((item) => item.id !== id))
      }
    } catch (err) {
      console.error('Error deleting jurnal SMK:', err)
    }
  }

  // Tarik tali lampu dengan spring physics
  const handlePullCord = () => {
    if (isPulling) return
    setIsPulling(true)
    setShowHistory((prev) => !prev)
    setLampColor(SMK_COLOR_KEYS[(SMK_COLOR_KEYS.indexOf(lampColor) + 1) % SMK_COLOR_KEYS.length])
    setTimeout(() => setIsPulling(false), 450)
  }

  const jamOptionsForHari = masterJamList.filter((j) => j.hari === hari)

  const jadwalHariIniGrouped = (() => {
    const slotsHariIni = jadwalSmkList.filter((j) => j.hari === hari)
    const mapGroup = new Map<string, JadwalSlotSmk[]>()
    slotsHariIni.forEach((slot) => {
      const key = `${slot.kelas_id ?? 'GABUNGAN'}-${slot.mapel_id ?? '0'}`
      const arr = mapGroup.get(key) || []
      arr.push(slot)
      mapGroup.set(key, arr)
    })
    return Array.from(mapGroup.values())
  })()

  const isWarm = !showHistory
  const JP = JURNAL_PALETTE[lampColor]

  return (
    <div className="h-screen w-screen overflow-hidden bg-[#0b0908] text-stone-100 font-sans relative flex items-center justify-center select-none">
      {/* TOMBOL KEMBALI MINIMALIS MENGAMBANG (TANPA HEADER / NAVBAR / BOTTOM BAR) */}
      <Link
        href="/smk"
        className="fixed top-5 left-5 z-40 p-2.5 rounded-full bg-white/[0.04] hover:bg-white/[0.1] border border-white/10 text-stone-400 hover:text-white transition-all duration-300 backdrop-blur-md"
        title="Kembali ke Dashboard SMK"
      >
        <ArrowLeft className="w-4 h-4" />
      </Link>

      {/* AMBIENT STUDIO GLOW & FLOOR GRADIENT (BERUBAH HALUS SAAT TALI DITARIK) */}
      <motion.div
        animate={{
          background: JP.glowGrad,
        }}
        transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        className="fixed inset-0 pointer-events-none z-0"
      />

      {/* LANTAI STUDIO HALUS */}
      <motion.div
        animate={{
          background: JP.floorGrad,
        }}
        transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        className="fixed bottom-0 left-0 right-0 h-[34vh] pointer-events-none z-0 border-t border-white/[0.03]"
      />

      {/* MAIN STUDIO STAGE: LAMPU KIRI + KARTU KACA KANAN (PERSIS VIDEO LAMP V5) */}
      <div className="relative z-10 w-full max-w-[960px] px-4 sm:px-8 flex flex-col md:flex-row items-center justify-center gap-6 md:gap-14">
        {/* ============================================================
            SISI KIRI: STANDING TRIPOD FLOOR LAMP V5 (SUDAH MENYALA)
           ============================================================ */}
        <div className="hidden md:flex flex-col items-center justify-center relative shrink-0">
          {/* Cahaya Halo Lembut di Belakang Kap Lampu */}
          <motion.div
            animate={{
              backgroundColor: JP.haloBg,
              scale: isPulling ? 0.96 : 1,
            }}
            transition={{ duration: 0.85, ease: [0.22, 1, 0.36, 1] }}
            className="absolute top-6 w-60 h-60 rounded-full blur-[68px] pointer-events-none"
          />

          <svg
            viewBox="0 0 280 500"
            className="w-[245px] h-[440px] overflow-visible relative z-10"
          >
            <defs>
              {/* Kerucut Sorotan Cahaya ke Lantai */}
              <linearGradient id="lampV5Cone" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="0%"
                  stopColor={JP.coneTop}
                  stopOpacity="0.34"
                />
                <stop
                  offset="55%"
                  stopColor={JP.coneMid}
                  stopOpacity="0.11"
                />
                <stop
                  offset="100%"
                  stopColor={JP.coneMid}
                  stopOpacity="0"
                />
              </linearGradient>

              {/* Gradien Kap Lampu Lipit (Pleated Lampshade) */}
              <linearGradient id="lampV5Shade" x1="0" y1="0" x2="1" y2="0">
                <stop
                  offset="0%"
                  stopColor={JP.shadeStop0}
                />
                <stop
                  offset="38%"
                  stopColor={JP.shadeStop38}
                />
                <stop
                  offset="72%"
                  stopColor={JP.shadeStop72}
                />
                <stop
                  offset="100%"
                  stopColor={JP.shadeStop100}
                />
              </linearGradient>

              {/* Gradien Kaki Tripod Kayu Hangat */}
              <linearGradient id="lampV5WoodLeg" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor={JP.woodStop0} />
                <stop offset="50%" stopColor={JP.woodStop50} />
                <stop offset="100%" stopColor={JP.woodStop100} />
              </linearGradient>
            </defs>

            {/* SOROTAN CAHAYA KERUCUT LEBAR */}
            <polygon points="75,148 205,148 280,475 0,475" fill="url(#lampV5Cone)" />

            {/* PENDAR CAHAYA ELIPS DI LANTAI */}
            <ellipse
              cx="140"
              cy="474"
              rx="92"
              ry="13"
              fill={JP.floorEllipseFill}
            />

            {/* 3 KAKI TRIPOD TINGGI MENYILANG */}
            {/* Kaki Belakang Tengah */}
            <line
              x1="140"
              y1="148"
              x2="140"
              y2="470"
              stroke={JP.legStroke}
              strokeWidth="4.5"
              strokeLinecap="round"
            />
            {/* Kaki Kiri */}
            <line
              x1="131"
              y1="148"
              x2="72"
              y2="474"
              stroke="url(#lampV5WoodLeg)"
              strokeWidth="5.5"
              strokeLinecap="round"
            />
            {/* Kaki Kanan */}
            <line
              x1="149"
              y1="148"
              x2="208"
              y2="474"
              stroke="url(#lampV5WoodLeg)"
              strokeWidth="5.5"
              strokeLinecap="round"
            />

            {/* Cincin Penyambung Leher Tripod */}
            <rect
              x="122"
              y="168"
              width="36"
              height="6"
              rx="3"
              fill={JP.collarFill}
            />

            {/* Kabel Listrik Melengkung Halus ke Lantai */}
            <path
              d="M140 150 Q147 265 137 365 T141 471"
              fill="none"
              stroke="#1b1615"
              strokeWidth="2.3"
            />

            {/* Cahaya Bohlam di Bawah Kap Lampu */}
            <ellipse
              cx="140"
              cy="148"
              rx="62"
              ry="10"
              fill={JP.bulbInnerFill}
              style={{
                filter: JP.bulbFilter,
              }}
            />

            {/* KAP LAMPU LIPIT (PLEATED SHADE) */}
            <path
              d="M96 42 L184 42 L208 148 L72 148 Z"
              fill="url(#lampV5Shade)"
              stroke={JP.shadeStroke}
              strokeWidth="0.9"
              strokeOpacity="0.45"
            />

            {/* Garis Lipatan Vertikal Halus pada Kap Lampu */}
            {[86, 100, 114, 128, 142, 156, 170, 184, 196].map((bottomX, i) => {
              const topX = 103 + i * 9.2
              return (
                <line
                  key={i}
                  x1={topX}
                  y1="43"
                  x2={bottomX}
                  y2="147"
                  stroke="rgba(28, 18, 12, 0.22)"
                  strokeWidth="1.2"
                />
              )
            })}

            {/* TALI TARIK SAKELAR ELASTIS DENGAN SPRING ANIMATION */}
            <motion.g
              onClick={handlePullCord}
              animate={{
                y: isPulling ? 16 : 0,
              }}
              transition={{
                type: 'spring',
                stiffness: 280,
                damping: 14,
                mass: 0.7,
              }}
              whileHover={{ y: 4 }}
              whileTap={{ y: 18 }}
              className="cursor-pointer group"
            >
              {/* Hitbox transparan lebih lebar agar nyaman diklik */}
              <rect x="162" y="146" width="95" height="115" fill="transparent" />

              {/* Tali vertikal */}
              <line
                x1="178"
                y1="148"
                x2="178"
                y2="235"
                stroke={JP.cordStroke}
                strokeWidth="1.7"
              />

              {/* Bandul Ujung Tali */}
              <circle
                cx="178"
                cy="240"
                r="5.5"
                fill={JP.knobFill}
                stroke="#fff7ed"
                strokeWidth="1.3"
              />

              {/* Label Kecil Persis Seperti di Video */}
              <text
                x="190"
                y="222"
                fill={JP.labelFill}
                fontSize="8.5"
                fontFamily="monospace"
                letterSpacing="1.2"
                className="opacity-80 group-hover:opacity-100 transition-opacity"
              >
                PULL CORD TO SWITCH
              </text>
            </motion.g>
          </svg>
        </div>

        {/* ============================================================
            SISI KANAN: KARTU KACA MINIMALIS (BERUBAH HALUS ZOOM & SLIDE)
           ============================================================ */}
        <div className="w-full max-w-[430px] relative">
          {/* Tombol Switch Kecil Khusus Mobile (jika layar HP menyembunyikan lampu) */}
          <div className="flex md:hidden justify-end mb-2">
            <button
              type="button"
              onClick={handlePullCord}
              className="px-3 py-1 rounded-full bg-white/10 border border-white/15 text-[11px] font-semibold text-amber-200"
            >
              {isWarm ? 'Lihat Riwayat →' : '← Input Agenda'}
            </button>
          </div>

          <motion.div
            animate={{
              borderColor: JP.cardBorder,
              boxShadow: JP.cardShadow,
            }}
            transition={{ duration: 0.85, ease: [0.22, 1, 0.36, 1] }}
            className="w-full rounded-[26px] border bg-white/[0.045] backdrop-blur-2xl p-6 sm:p-7 overflow-hidden relative"
          >
            {/* Pendaran cahaya dalam kartu di pojok kiri atas */}
            <motion.div
              animate={{
                backgroundColor: JP.cardGlow,
              }}
              transition={{ duration: 0.85 }}
              className="absolute -top-20 -left-20 w-56 h-56 rounded-full blur-3xl pointer-events-none"
            />

            <AnimatePresence mode="wait" initial={false}>
              {isWarm ? (
                /* ====================================================
                   MODE 1 (WARM GOLD): FORM INPUT AGENDA JURNAL SMK
                   ==================================================== */
                <motion.div
                  key="mode-input-agenda"
                  initial={{ opacity: 0, scale: 0.94, y: 14 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.94, y: -14 }}
                  transition={{
                    duration: 0.48,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                  className="relative z-10"
                >
                  {/* Header Minimalis Seperti di Video */}
                  <div className="mb-4">
                    <div className="flex items-center gap-1.5 text-[10px] font-bold tracking-[0.2em] uppercase text-[#e7be8a] mb-1">
                      <Star className="w-3.5 h-3.5" />
                      <span>JURNAL SMK DKV</span>
                    </div>
                    <h1 className="text-xl font-bold text-white tracking-tight">
                      Agenda Mengajar.
                    </h1>
                    <p className="text-xs text-stone-400 mt-0.5 truncate">
                      {userDisplayName} • Tarik tali lampu untuk riwayat
                    </p>
                  </div>

                  {/* Preset Jadwal Cepat Hari Ini (jika ada) */}
                  {jadwalHariIniGrouped.length > 0 && (
                    <div className="mb-3 flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                      {jadwalHariIniGrouped.map((group, idx) => {
                        const sorted = [...group].sort((a, b) => a.jam_ke - b.jam_ke)
                        const first = sorted[0]
                        const last = sorted[sorted.length - 1]
                        const jpLabel =
                          first.jam_ke === last.jam_ke
                            ? `JP ${first.jam_ke}`
                            : `JP ${first.jam_ke}-${last.jam_ke}`
                        const isSelected =
                          String(first.mapel_id || '') === selectedMapelId &&
                          (first.kelas_id ? String(first.kelas_id) : 'GABUNGAN') ===
                            selectedKelasId

                        return (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => handleSelectJadwalPreset(group)}
                            className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold border transition-all duration-300 shrink-0 cursor-pointer flex items-center gap-1 ${
                              isSelected
                                ? 'bg-[#e8be88] text-stone-950 border-[#f5d5a8]'
                                : 'bg-white/[0.04] hover:bg-white/[0.09] text-stone-300 border-white/10'
                            }`}
                          >
                            <Sparkles className="w-2.5 h-2.5" />
                            <span>
                              {first.nama_kelas} ({jpLabel})
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  )}

                  {/* Form Input Jurnal Ringkas */}
                  <form onSubmit={handleSimpanJurnalSmk} className="space-y-3">
                    {/* Baris 1: Tanggal & Jam JP */}
                    <div className="grid grid-cols-12 gap-2">
                      <div className="col-span-6">
                        <label className="text-[10px] font-medium text-stone-400 block mb-1">
                          Tanggal ({hari})
                        </label>
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
                          className="w-full rounded-xl bg-black/35 border border-white/10 px-2.5 py-2 text-xs text-stone-100 focus:outline-none focus:border-[#e7be8a] transition"
                          required
                        />
                      </div>

                      <div className="col-span-3">
                        <label className="text-[10px] font-medium text-stone-400 block mb-1">
                          Mulai
                        </label>
                        <select
                          value={jamMulai}
                          onChange={(e) => {
                            const val = e.target.value
                            setJamMulai(val)
                            if (Number(val) > Number(jamSelesai)) setJamSelesai(val)
                          }}
                          className="w-full rounded-xl bg-black/35 border border-white/10 px-2 py-2 text-xs text-stone-100 focus:outline-none focus:border-[#e7be8a] transition"
                        >
                          {jamOptionsForHari.length > 0
                            ? jamOptionsForHari.map((j) => (
                                <option
                                  key={j.id}
                                  value={j.jam_ke}
                                  className="bg-stone-900 text-white"
                                >
                                  JP {j.jam_ke}
                                </option>
                              ))
                            : [1, 2, 3, 4, 5, 6, 7, 8].map((num) => (
                                <option
                                  key={num}
                                  value={num}
                                  className="bg-stone-900 text-white"
                                >
                                  JP {num}
                                </option>
                              ))}
                        </select>
                      </div>

                      <div className="col-span-3">
                        <label className="text-[10px] font-medium text-stone-400 block mb-1">
                          Selesai
                        </label>
                        <select
                          value={jamSelesai}
                          onChange={(e) => setJamSelesai(e.target.value)}
                          className="w-full rounded-xl bg-black/35 border border-white/10 px-2 py-2 text-xs text-stone-100 focus:outline-none focus:border-[#e7be8a] transition"
                        >
                          {jamOptionsForHari.length > 0
                            ? jamOptionsForHari
                                .filter((j) => j.jam_ke >= Number(jamMulai))
                                .map((j) => (
                                  <option
                                    key={j.id}
                                    value={j.jam_ke}
                                    className="bg-stone-900 text-white"
                                  >
                                    JP {j.jam_ke}
                                  </option>
                                ))
                            : [1, 2, 3, 4, 5, 6, 7, 8]
                                .filter((num) => num >= Number(jamMulai))
                                .map((num) => (
                                  <option
                                    key={num}
                                    value={num}
                                    className="bg-stone-900 text-white"
                                  >
                                    JP {num}
                                  </option>
                                ))}
                        </select>
                      </div>
                    </div>

                    {/* Baris 2: Kelas & Mata Pelajaran */}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] font-medium text-stone-400 block mb-1">
                          Kelas SMK
                        </label>
                        <select
                          value={selectedKelasId}
                          onChange={(e) => setSelectedKelasId(e.target.value)}
                          className="w-full rounded-xl bg-black/35 border border-white/10 px-2.5 py-2 text-xs text-stone-100 focus:outline-none focus:border-[#e7be8a] transition"
                          required
                        >
                          <option value="" className="bg-stone-900">
                            Pilih Kelas
                          </option>
                          <option value="GABUNGAN" className="bg-stone-900">
                            Gabungan DKV
                          </option>
                          {kelasList.map((k) => (
                            <option
                              key={k.id}
                              value={k.id}
                              className="bg-stone-900 text-white"
                            >
                              {k.nama}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="text-[10px] font-medium text-stone-400 block mb-1">
                          Mata Pelajaran
                        </label>
                        <select
                          value={selectedMapelId}
                          onChange={(e) => setSelectedMapelId(e.target.value)}
                          className="w-full rounded-xl bg-black/35 border border-white/10 px-2.5 py-2 text-xs text-stone-100 focus:outline-none focus:border-[#e7be8a] transition"
                          required
                        >
                          <option value="" className="bg-stone-900">
                            Pilih Mapel
                          </option>
                          {mapelList.map((m) => (
                            <option
                              key={m.id}
                              value={m.id}
                              className="bg-stone-900 text-white"
                            >
                              {m.nama}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {isOperator && (
                      <div className="mb-2">
                        <label className="text-[10px] font-medium text-stone-400 block mb-1">
                          Guru Pengampu (pilih bila input manual/insidental)
                        </label>
                        <select
                          value={selectedGuruEmail}
                          onChange={(e) => setSelectedGuruEmail(e.target.value)}
                          className="w-full rounded-xl bg-black/35 border border-white/10 px-2.5 py-2 text-xs text-stone-100 focus:outline-none focus:border-[#e7be8a] transition"
                        >
                          <option value="" className="bg-stone-900">
                            Pilih Guru Pengampu
                          </option>
                          {guruList.map((g) => (
                            <option key={g.email} value={g.email} className="bg-stone-900 text-white">
                              {g.nama}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {/* Baris 3: Materi Pembelajaran */}
                    <div>
                      <label className="text-[10px] font-medium text-stone-400 block mb-1">
                        Materi Pembelajaran
                      </label>
                      <input
                        type="text"
                        value={materi}
                        onChange={(e) => setMateri(e.target.value)}
                        placeholder="Contoh: Desain Tipografi & Layout Poster..."
                        className="w-full rounded-xl bg-black/35 border border-white/10 px-3 py-2 text-xs text-white placeholder:text-stone-500 focus:outline-none focus:border-[#e7be8a] transition"
                        required
                      />
                    </div>

                    {/* Baris 4: Status & Rekap Absensi Otomatis */}
                    <div className="grid grid-cols-12 gap-2">
                      <div className="col-span-5">
                        <label className="text-[10px] font-medium text-stone-400 block mb-1">
                          Status KBM
                        </label>
                        <select
                          value={status}
                          onChange={(e) =>
                            setStatus(e.target.value as 'Terlaksana' | 'Tertunda')
                          }
                          className="w-full rounded-xl bg-black/35 border border-white/10 px-2.5 py-2 text-xs text-stone-100 focus:outline-none focus:border-[#e7be8a] transition"
                        >
                          <option value="Terlaksana" className="bg-stone-900">
                            Terlaksana
                          </option>
                          <option value="Tertunda" className="bg-stone-900">
                            Tertunda
                          </option>
                        </select>
                      </div>

                      <div className="col-span-7">
                        <label className="text-[10px] font-medium text-stone-400 block mb-1">
                          Ketidakhadiran Siswa
                        </label>
                        <div className="flex items-center gap-1">
                          <input
                            type="text"
                            value={absenSiswa}
                            onChange={(e) => setAbsenSiswa(e.target.value)}
                            className="w-full rounded-xl bg-black/35 border border-white/10 px-2.5 py-2 text-xs text-[#e7be8a] focus:outline-none focus:border-[#e7be8a] transition"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              fetchAbsensiOtomatisSmk(
                                tanggal,
                                selectedKelasId,
                                selectedMapelId
                              )
                            }
                            className="p-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-stone-300 transition shrink-0 cursor-pointer"
                            title="Sinkronkan ulang dari Absensi SMK"
                          >
                            <RefreshCw
                              className={`w-3.5 h-3.5 ${
                                loadingAutoAbsen ? 'animate-spin' : ''
                              }`}
                            />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Tombol Submit Pill Hangat Persis Video */}
                    <motion.button
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.98 }}
                      type="submit"
                      disabled={saving}
                      className="w-full mt-2 py-2.5 rounded-full bg-gradient-to-r from-[#dfb17b] to-[#f1cfa4] hover:from-[#e6bc8a] hover:to-[#f6d9b4] disabled:opacity-50 text-stone-950 font-bold text-xs tracking-wide shadow-lg shadow-[#dfb17b]/20 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>{saving ? 'Menyimpan...' : 'Simpan Agenda →'}</span>
                    </motion.button>
                  </form>
                </motion.div>
              ) : (
                /* ====================================================
                   MODE 2 (CORAL ROSE): RIWAYAT & REKAP JURNAL SMK
                   ==================================================== */
                <motion.div
                  key="mode-riwayat-agenda"
                  initial={{ opacity: 0, scale: 0.94, y: 14 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.94, y: -14 }}
                  transition={{
                    duration: 0.48,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                  className="relative z-10 flex flex-col h-[410px]"
                >
                  {/* Header Mode Coral */}
                  <div className="mb-3 shrink-0">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-[10px] font-bold tracking-[0.2em] uppercase text-[#e68490] mb-1">
                        <Star className="w-3.5 h-3.5" />
                        <span>RIWAYAT STUDIO</span>
                      </div>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#e68490]/15 text-[#f2a2ac] border border-[#e68490]/30">
                        {rekapList.length} Catatan
                      </span>
                    </div>
                    <h2 className="text-xl font-bold text-white tracking-tight">
                      Riwayat Jurnal.
                    </h2>
                    <p className="text-xs text-stone-400 mt-0.5">
                      Tarik tali lampu lagi untuk kembali menulis agenda
                    </p>
                  </div>

                  {/* Filter Mini */}
                  <div className="grid grid-cols-2 gap-2 mb-3 shrink-0">
                    <select
                      value={filterKelasId}
                      onChange={(e) => setFilterKelasId(e.target.value)}
                      className="rounded-xl bg-black/35 border border-white/10 px-2.5 py-1.5 text-[11px] text-stone-200 focus:outline-none focus:border-[#e68490]"
                    >
                      <option value="" className="bg-stone-900">
                        Semua Kelas
                      </option>
                      {kelasList.map((k) => (
                        <option key={k.id} value={k.id} className="bg-stone-900">
                          {k.nama}
                        </option>
                      ))}
                    </select>

                    <input
                      type="text"
                      value={searchMateri}
                      onChange={(e) => setSearchMateri(e.target.value)}
                      placeholder="Cari materi..."
                      className="rounded-xl bg-black/35 border border-white/10 px-2.5 py-1.5 text-[11px] text-stone-200 placeholder:text-stone-500 focus:outline-none focus:border-[#e68490]"
                    />
                  </div>

                  {/* Daftar Riwayat Jurnal dengan Scroll Lembut */}
                  <div className="flex-1 overflow-y-auto pr-1 space-y-2">
                    {loadingRekap ? (
                      <div className="h-full flex items-center justify-center text-xs text-stone-400">
                        Memuat riwayat jurnal...
                      </div>
                    ) : rekapList.length === 0 ? (
                      <div className="h-full flex items-center justify-center text-xs text-stone-400 text-center px-4">
                        Belum ada catatan jurnal SMK tersimpan.
                      </div>
                    ) : (
                      rekapList.map((item, idx) => (
                        <div
                          key={item.id || idx}
                          className="p-3 rounded-2xl bg-black/35 border border-white/[0.08] hover:border-[#e68490]/40 transition-all duration-300"
                        >
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <span className="text-[11px] font-bold text-white truncate">
                              {item.kelas} •{' '}
                              <span className="text-[#f09aa5]">{item.mapel}</span>
                            </span>
                            <button
                              type="button"
                              onClick={() => handleDeleteJurnal(item.id)}
                              className="text-stone-500 hover:text-rose-400 transition cursor-pointer shrink-0"
                              title="Hapus"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          <p className="text-[11px] text-stone-300 leading-snug line-clamp-2 mb-1.5">
                            {item.materi}
                          </p>

                          <div className="flex items-center justify-between text-[10px] text-stone-400 pt-1.5 border-t border-white/[0.06]">
                            <span className="flex items-center gap-1">
                              <Clock className="w-2.5 h-2.5 text-[#e68490]" />
                              {item.tanggal} • {item.jam_ke}
                            </span>
                            <span className="flex items-center gap-1 font-medium text-stone-300">
                              {item.status === 'Terlaksana' ? (
                                <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400" />
                              ) : (
                                <AlertCircle className="w-2.5 h-2.5 text-rose-400" />
                              )}
                              {item.status}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      </div>
    </div>
  )
}