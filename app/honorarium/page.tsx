'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'
import { motion } from 'framer-motion'
import { animated, useSpring } from '@react-spring/web'
import HonorBulanCards, { type BulanCardData, type StatusKartu } from '@/app/components/HonorBulanCards'
import { useDarkMode } from '@/hooks/useDarkMode'
import DarkModeToggle from '@/app/components/DarkModeToggle'
import { useAuthRole } from '@/hooks/useAuthRole'
import {
  Wallet, Settings2, Users, RefreshCw, Plus, Save, CheckCircle2, Trash2,
  CalendarDays, FileCheck2, BadgeCheck, ShieldCheck, X, Landmark,
  Banknote, Info, History, Lock,
} from 'lucide-react'

// CLIENT SUPABASE AMAN (mencegah error prerender/SSG Vercel)
const getSupabaseUrl = () =>
  (process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://kvrulbdvgxfrtmznpjnm.supabase.co')
    .replace(/['"]/g, '').trim()

const getSupabaseAnonKey = () =>
  (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder')
    .replace(/['"]/g, '').trim()

const supabase = createClient(getSupabaseUrl(), getSupabaseAnonKey())

// 2 Pengurus Utama (akses penuh). Pencocokan case-insensitive + trim spasi.
const PENGURUS_NAMES = ['MUZAINI AL KAHFI', 'RIZIEQ NIZAR']

const normalizeName = (s: string) => (s || '').trim().replace(/\s+/g, ' ').toLowerCase()
const isPengurusName = (nama: string) => PENGURUS_NAMES.some((p) => normalizeName(p) === normalizeName(nama))

// Garis kosong untuk area tanda tangan cetak bila pejabat belum terdaftar di database.
const BLANK_TTD = '....................................'

function formatRupiah(n: number) {
  const v = Number.isFinite(n) ? n : 0
  return 'Rp ' + Math.round(v).toLocaleString('id-ID')
}

type DiffParts = string[]
// Tambahkan rincian hanya jika nilainya berubah (bandingkan lama vs baru).
function diffNum(parts: DiffParts, label: string, oldV: unknown, newV: unknown) {
  const o = Number(oldV) || 0
  const n = Number(newV) || 0
  if (o !== n) parts.push(`${label} (${o} → ${n})`)
}
function diffRupiah(parts: DiffParts, label: string, oldV: unknown, newV: unknown) {
  const o = Number(oldV) || 0
  const n = Number(newV) || 0
  if (o !== n) parts.push(`${label} (${formatRupiah(o)} → ${formatRupiah(n)})`)
}

function formatTanggal(iso?: string | null) {
  if (!iso) return '-'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '-'
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })
}

// Ekstrak nomor-nomor jam pelajaran menjadi himpunan slot unik (anti-dobel kelas gabungan).
// CARA KERJA:
//  1) Buang lebih dulu SELURUH teks di dalam tanda kurung (mis. keterangan waktu),
//     agar angka jam waktu (08, 15, 30, dsb.) tidak ikut terbaca.
//  2) Setelah bersih (mis. "Jam Ke-7 s/d 8" atau "Jam Ke-2"), ekstrak setiap nomor
//     jam (1..12) menjadi anggota himpunan slot:
//       - Rentang "Jam Ke-7 s/d 8" -> {7,8} = 2 slot (2 JP)
//       - Tunggal "Jam Ke-2"       -> {2}   = 1 slot (1 JP)
//     Jika ada baris kelas lain pada tanggal sama dengan slot yang sama, mereka menyatu
//     dalam Set harian guru (deduplikasi), sehingga tetap terhitung sekali (bukan dikali
//     jumlah kelas dan bukan 1 JP).
function extractSlots(jamKe: unknown): number[] {
  const raw = String(jamKe ?? '')
  // 1) Buang seluruh teks dalam tanda kurung (berpasangan); kurung buka yang
  //    tidak tertutup beserta seluruh teks sesudahnya juga dibuang, supaya angka
  //    jam waktu (mis. "08" dari "(08.00") tidak ikut terbaca sebagai slot.
  const cleanStr = raw.replace(/\(.*?\)/g, '').replace(/\(.*$/, '').trim()
  if (!cleanStr) return []

  const slots = new Set<number>()

  // 2a) Rentang dua angka: "Jam Ke-7 s/d 8" -> 7..8 => {7,8}
  const rangeRe = /(\d{1,2})\s*(?:s\.?\/?d\.?|sampai|hingga|\bto\b|[-–—])\s*(\d{1,2})/gi
  let m: RegExpExecArray | null
  while ((m = rangeRe.exec(cleanStr)) !== null) {
    const a = Number(m[1])
    const b = Number(m[2])
    if (a >= 1 && a <= 12 && b >= 1 && b <= 12) {
      // Rentang terbalik (mis. "12 s/d 1") dilewati: bukan rentang yang sah.
      // Kedua ujungnya tetap terbaca sebagai slot tunggal di pass 2b.
      if (a > b) continue
      for (let i = a; i <= b; i++) slots.add(i)
    }
  }

  // 2b) Angka tunggal: "Jam Ke-2" -> {2}
  const singleRe = /(\d{1,2})/g
  while ((m = singleRe.exec(cleanStr)) !== null) {
    const v = Number(m[1])
    if (v >= 1 && v <= 12) slots.add(v)
  }

  return Array.from(slots).sort((a, b) => a - b)
}

// Normalisasi nama mapel untuk pencocokan kata kunci gabungan (huruf kecil + angka saja).
const normalizeMapelKey = (s: string) =>
  String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '')

// Mapel pembina / kegiatan gabungan (Pramuka, Qiro'ah, Presentasi): 0 JP, karena
// sudah ada tunjangan pembina (keputusan Ketua, 25 Nov 2026). Pencocokan berbasis
// substring setelah normalisasi, supaya varian nama ("Pramuka Gabungan",
// "Ekstrakurikuler Pramuka", "Qiroah Gabungan") ikut 0 JP. PJOK SMK juga 0 JP.
// Dedup slot per tanggal tetap berlaku untuk sesi gabungan lain, agar satu sesi
// yang tercatat di beberapa baris jurnal tidak dihitung berulang kali.
const PEMBINA_MAPEL_KEYWORDS = ['pramuka', 'qiroah', 'presentasi']

const bulanAkhir = (tahun: number, bulan: number) => new Date(tahun, bulan, 0).getDate()

// Cek apakah string tanggal termasuk dalam bulan/tahun terpilih (defense-in-depth
// terhadap variasi format kolom tanggal asli di jurnal_agenda).
function tanggalMasukBulan(iso: string | null | undefined, tahun: string, bulan: string): boolean {
  const t = iso ? String(iso).trim() : ''
  if (!t) return false
  const isoM = t.match(/^(\d{4})-(\d{2})/)
  if (isoM) return isoM[1] === tahun && isoM[2] === bulan
  const dm = t.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/)
  if (dm) return dm[3] === tahun && String(Number(dm[2])).padStart(2, '0') === bulan
  const d = new Date(t)
  if (!Number.isNaN(d.getTime())) {
    return String(d.getFullYear()) === tahun && String(d.getMonth() + 1).padStart(2, '0') === bulan
  }
  return false
}

function formatTanggalSingkat(iso?: string | null): string {
  const t = iso ? String(iso).trim() : ''
  if (!t) return '-'
  const isoM = t.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (isoM) return `${isoM[3]}/${isoM[2]}/${isoM[1].slice(-2)}`
  const d = new Date(t)
  if (!Number.isNaN(d.getTime())) {
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getFullYear()).slice(-2)}`
  }
  return t
}

function formatWaktuAudit(iso?: string | null): string {
  const t = iso ? String(iso) : ''
  if (!t) return '-'
  const d = new Date(t)
  if (Number.isNaN(d.getTime())) return t
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yy = String(d.getFullYear()).slice(-2)
  const hh = String(d.getHours()).padStart(2, '0')
  const mi = String(d.getMinutes()).padStart(2, '0')
  return `${dd}/${mm}/${yy} ${hh}:${mi}`
}

const BLN_NAMES = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']

const STATUS_BADGE = 'SAH & SUDAH DIBAYARKAN — Disahkan oleh Kepala Sekolah, Bendahara, dan Ketua Yayasan SMP/SMK Muna Mustofa Lampung'

// Nama pejabat penandatangan (Kepala Sekolah / Bendahara / Ketua Yayasan) kini
// diambil LANGSUNG dari kolom `jabatan` tabel public.guru (lihat resolver
// `findSignatoryNama` di dalam komponen), bukan dari daftar 3 pengurus editor /
// hardcode. Jika belum ada baris guru dengan jabatan tsb., area TTD cetak
// menampilkan garis kosong '....................................' agar siap diisi
// manual / otomatis terisi begitu kolom jabatan di database dilengkapi.

interface GuruRow {
  id: number
  nama_lengkap: string
  email?: string | null
  jabatan?: string | null
  unit_mengajar?: string | null
  role?: string | null
  NUPTK?: string | null
}

interface PengaturanRow {
  id?: string
  tarif_jp: number
  tarif_transport_harian: number
  tarif_piket: number
  tunjangan_wali_kelas: number
  updated_by?: string | null
  updated_at?: string | null
}

interface PotonganRow {
  id?: string
  nama: string
  aktif: boolean
  tipe: 'nominal' | 'persen'
  nilai: number
  urutan?: number
  updated_by?: string | null
  updated_at?: string | null
}

interface PenerimaRow {
  id?: string
  guru_id: number
  aktif: boolean
  status: 'guru_mengajar' | 'staf_piket'
  tunjangan_jabatan: number
  tunjangan_masa_kerja: number
  pembina: number
  wali_kelas: boolean
  infaq_nominal: number
  updated_by?: string | null
  updated_at?: string | null
}

interface TugasRow {
  id?: string
  periode: string
  tanggal: string
  nama_kegiatan: string
  guru_ids: number[]
  nominal: number
  updated_by?: string | null
  updated_at?: string | null
}

interface PotonganTerapan {
  nama: string
  tipe: 'nominal' | 'persen'
  nilai: number
  hasil: number
}

interface RekapRow {
  id?: string
  periode: string
  guru_id: number
  guru_nama?: string
  jumlah_jp: number
  transport_hari: number
  tunjangan_jabatan: number
  tunjangan_masa_kerja: number
  pembina: number
  wali_kelas: number
  tugas_tambahan: number
  piket: number
  potongan: PotonganTerapan[]
  total_potongan: number
  total_bersih: number
  status: 'DRAFT' | 'PAID'
  confirmed_by?: string | null
  confirmed_at?: string | null
  disahkan_kepsek_by?: string | null
  disahkan_kepsek_at?: string | null
  disahkan_yayasan_by?: string | null
  disahkan_yayasan_at?: string | null
  dibayar_bendahara_by?: string | null
  dibayar_bendahara_at?: string | null
  alur?: string | null
  catatan?: string | null
  updated_by?: string | null
  updated_at?: string | null
  detailJp?: JpDetail[]
  detailTransport?: string[]
  detailTugas?: TugasDetail[]
}

// Status kartu bulanan dari baris rekap tersimpan (dipakai grid kartu bulanan).
// Wording sama dengan statusPeriode: PAID / DISAHKAN YAYASAN / DISAHKAN KEPSEK / DRAFT.
// Tanpa baris tersimpan = 'BELUM DIHITUNG'.
function statusDariRows(rows: RekapRow[]): StatusKartu {
  if (rows.length === 0) return 'BELUM DIHITUNG'
  if (rows.some((r) => r.status === 'PAID')) return 'PAID'
  const r0 = rows[0]
  if (r0?.disahkan_yayasan_at) return 'DISAHKAN YAYASAN'
  if (r0?.disahkan_kepsek_at || r0?.confirmed_at) return 'DISAHKAN KEPSEK'
  return 'DRAFT'
}

interface JpDetail {
  tanggal: string
  jam: string
  jp: number
  mapel?: string
  slots?: number[]
}

interface TugasDetail {
  tanggal: string
  nama_kegiatan: string
  nominal: number
}

// =====================================================================
// MUAT PETA JURNAL (dipakai Tarik & Hitung + rincian otomatis saat Detail dibuka)
// =====================================================================
// Mengambil entri jurnal_agenda 'Terlaksana' untuk daftar email pada periode
// tertentu, lengkap dengan validasi mapel resmi guru (guru_mapel), filter
// baris presensi/piket/kegiatan luar kelas, dan deduplikasi slot gabungan.
// Mengembalikan peta per email (slot jam + nama mapel per tanggal) serta
// jumlah entri jurnal sah yang dipakai perhitungan JP.
async function muatPetaJurnal(
  emails: string[],
  targetPeriode: string,
  guruList: GuruRow[]
): Promise<{
  jurnalMap: Map<string, { dateSlots: Map<string, Set<number>>; dateMapel: Map<string, Set<string>> }>
  validJurnal: number
}> {
  const jurnalMap = new Map<string, { dateSlots: Map<string, Set<number>>; dateMapel: Map<string, Set<string>> }>()
  let validJurnal = 0
  if (emails.length > 0) {
    const [tahunStr, bulanStr] = targetPeriode.split('-')
    const tahun = Number(tahunStr)
    const bulan = Number(bulanStr)
    const startIso = `${targetPeriode}-01`
    const endIso = `${targetPeriode}-${String(bulanAkhir(tahun, bulan)).padStart(2, '0')}`
    const { data } = await supabase
      .from('jurnal_agenda')
      .select('tanggal, jam_ke, guru_email, mapel, kelas, materi, jenjang, status')
      .in('guru_email', emails)
      .eq('status', 'Terlaksana')
      .gte('tanggal', startIso)
      .lte('tanggal', endIso)
    if (data) {
      // --- Muat mapel resmi per guru (guru_mapel + mapel) untuk validasi JP riil ---
      // Daftar mata pelajaran resmi yang diampu masing-masing guru diperoleh dari
      // tabel relasi `guru_mapel` (guru_id → mapel_id) yang digabung dengan tabel
      // `mapel` untuk mendapatkan nama mapel-nya.
      const [guruMapelRes, mapelRes] = await Promise.all([
        supabase.from('guru_mapel').select('guru_id, mapel_id'),
        supabase.from('mapel').select('id, nama_mapel'),
      ])

      const mapelNameById = new Map<number, string>()
      ;(mapelRes.data || []).forEach((m: any) => {
        if (m.id != null && m.nama_mapel) {
          mapelNameById.set(Number(m.id), String(m.nama_mapel))
        }
      })

      // guru_id → himpunan nama mapel resmi (ternormalisasi: huruf kecil + rapatkan spasi).
      const guruMapelByGuru = new Map<number, Set<string>>()
      ;(guruMapelRes.data || []).forEach((gm: any) => {
        const gid = Number(gm.guru_id)
        const namaMapel = mapelNameById.get(Number(gm.mapel_id))
        if (!gid || !namaMapel) return
        const norm = String(namaMapel).trim().toLowerCase().replace(/\s+/g, ' ')
        if (!norm) return
        if (!guruMapelByGuru.has(gid)) guruMapelByGuru.set(gid, new Set())
        guruMapelByGuru.get(gid)!.add(norm)
      })

      // email → guru_id agar bisa mencocokkan mapel jurnal ke guru pemiliknya.
      const emailToGuruId = new Map<string, number>()
      guruList.forEach((g) => {
        if (g.email) emailToGuruId.set(String(g.email).trim().toLowerCase(), g.id)
      })

      // Kegiatan gabungan resmi yang selalu sah walaupun di luar mapel guru.
      const COMBINED_KEYWORDS = ['pramuka', 'qiroah', 'qiro ah', 'presentasi']

      data.forEach((row) => {
        const em = (row.guru_email || '').trim().toLowerCase()
        if (!em) return
        // Filter ulang di sisi client agar hanya baris bulan/tahun terpilih yang dihitung
        if (!tanggalMasukBulan(row.tanggal, tahunStr, bulanStr)) return

        // FILTER CERDAS: lewati baris log otomatis presensi / piket / kegiatan luar kelas
        const mapelTxt = String(row.mapel ?? '').trim().toLowerCase()
        const kelasTxt = String(row.kelas ?? '').trim().toLowerCase()
        const materiTxt = String(row.materi ?? '').trim().toLowerCase()

        // 1) mapel atau kelas kosong (null/string kosong) → abaikan
        if (!mapelTxt || !kelasTxt) return

        // 2) Baris log otomatis presensi / piket: hanya bila materi DIAWALI kata
        //    kunci 'TIDAK HADIR', 'IZIN', 'IJIN', atau 'PRESENSI KELAS' -> abaikan.
        //    Uji berjangkar di awal (bukan di sembarang posisi) supaya sesi mengajar
        //    sah yang hanya MENYEBUT absen di tengah kalimat - mis. "Ulangan harian,
        //    2 siswa tidak hadir" - tetap dihitung JP-nya.
        if (/^(tidak hadir|izin|ijin|presensi kelas)\b/i.test(materiTxt)) return

        // 3) kegiatan luar kelas / ekskul penuh 'Tadabur Alam' (materi atau mapel) → abaikan
        if (materiTxt.includes('tadabur alam') || mapelTxt.includes('tadabur alam')) return

        const jenjangTxt = String(row.jenjang ?? '').trim().toUpperCase();
        const mapelKey = normalizeMapelKey(mapelTxt)
        const isPembina = PEMBINA_MAPEL_KEYWORDS.some((k) => mapelKey.includes(k)) || (jenjangTxt === 'SMK' && /^pjok/.test(mapelKey));
        if (isPembina) return;

        // 4) VALIDASI MAPEL RESMI GURU (fail-closed):
        //    Jika jurnal mencatat mapel yang BUKAN milik guru tsb. -> itu inputan guru
        //    piket menggantikan guru lain (mis. PJOK/PKn/Bahasa Arab/Matematika saat
        //    menjaga ujian/piket) -> jangan dihitung ke JP mengajar.
        //    Fail-closed: bila guru TIDAK PUNYA baris guru_mapel sama sekali (atau
        //    email jurnal tidak ditemukan di tabel guru), baris juga dibuang - guru
        //    tanpa link mapel tidak mendapat JP sampai link mapelnya dilengkapi di
        //    master guru_mapel. Sebelumnya validasi dilewati dalam kondisi ini
        //    (fail-open), sehingga semua jurnal guru tsb. ikut terhitung.
        //    Pengecualian: kegiatan gabungan resmi (Pramuka/Qiro'ah/Presentasi).
        const mapelTxtClean = mapelTxt.replace(/['’‘`]/g, '')
        const isKegiatanGabungan = COMBINED_KEYWORDS.some((k) => mapelTxtClean.includes(k))
        if (!isKegiatanGabungan) {
          const guruId = emailToGuruId.get(em)
          const officialSet = guruId != null ? guruMapelByGuru.get(guruId) : undefined
          if (!officialSet || officialSet.size === 0) return // guru tanpa link mapel -> tidak dihitung
          const matchResmi =
            officialSet.has(mapelTxt) ||
            Array.from(officialSet).some(
              (off) => off.includes(mapelTxt) || mapelTxt.includes(off)
            )
          if (!matchResmi) return // inputan guru piket -> tidak dihitung
        }

        const slots = extractSlots(row.jam_ke)
        if (slots.length === 0) return
        const tgl = row.tanggal ? String(row.tanggal) : ''
        if (!tgl) return

        // Entri jurnal sah yang benar-benar dipakai perhitungan JP
        validJurnal++

        if (!jurnalMap.has(em)) jurnalMap.set(em, { dateSlots: new Map(), dateMapel: new Map() })
        const rec = jurnalMap.get(em)!
        if (!rec.dateSlots.has(tgl)) rec.dateSlots.set(tgl, new Set())
        const daySet = rec.dateSlots.get(tgl)!
        slots.forEach((s) => daySet.add(s))
        // Simpan nama mapel per tanggal untuk Rincian JP (nama distinct, digabung saat tampil).
        const mapelDisplay = String(row.mapel ?? '').trim()
        if (mapelDisplay) {
          if (!rec.dateMapel.has(tgl)) rec.dateMapel.set(tgl, new Set())
          rec.dateMapel.get(tgl)!.add(mapelDisplay)
        }
      })
    }
  }
  return { jurnalMap, validJurnal }
}

// =====================================================================
// MUAT ABSENSI GURU (dipakai Tarik & Hitung + rincian otomatis)
// =====================================================================
// Kehadiran 'Hadir' dari tabel absensi_guru menjadi sumber utama hari
// transport. Tanggal unik (tanggal,guru_email) digabung ke himpunan hari
// transport yang sama dengan jurnal → anti double-count otomatis
// (1 hari tetap 1 hari). Jika tabel absensi_guru belum dibuat, dimuat aman
// (graceful fallback).
async function muatAbsensiGuru(
  emails: string[],
  targetPeriode: string
): Promise<Map<string, Set<string>>> {
  const absensiGuruByEmail = new Map<string, Set<string>>()
  if (emails.length === 0) return absensiGuruByEmail
  const [pkTahunStr, pkBulanStr] = targetPeriode.split('-')
  const pkTahun = Number(pkTahunStr)
  const pkBulan = Number(pkBulanStr)
  if (!Number.isFinite(pkTahun) || !Number.isFinite(pkBulan)) return absensiGuruByEmail
  const startIso = `${targetPeriode}-01`
  const endIso = `${targetPeriode}-${String(bulanAkhir(pkTahun, pkBulan)).padStart(2, '0')}`
  try {
    const { data: absensiData, error: absensiError } = await supabase
      .from('absensi_guru')
      .select('tanggal, guru_email')
      .eq('status', 'Hadir')
      .in('guru_email', emails)
      .gte('tanggal', startIso)
      .lte('tanggal', endIso)
    if (absensiData && !absensiError) {
      absensiData.forEach((r: any) => {
        const em = (r.guru_email || '').trim().toLowerCase()
        if (!em) return
        const tgl = r.tanggal ? String(r.tanggal).slice(0, 10) : ''
        if (!tgl) return
        if (!absensiGuruByEmail.has(em)) absensiGuruByEmail.set(em, new Set())
        absensiGuruByEmail.get(em)!.add(tgl)
      })
    }
  } catch {
    /* tabel absensi_guru belum dibuat → abaikan */
  }
  return absensiGuruByEmail
}

// =====================================================================
// SUSUN RINCIAN DETAIL SATU GURU (dipakai Tarik & Hitung + rincian otomatis)
// =====================================================================
// Menyusun rincian detail (JP per tanggal + tanggal transport + tugas
// tambahan) dari sumber yang sudah dimuat. TIDAK menghitung uang — hanya
// detail; angka uang tetap berasal dari baris rekap yang sudah tersimpan.
function susunDetailGuru(args: {
  isStafPiket: boolean
  jurnalRec?: { dateSlots: Map<string, Set<number>>; dateMapel: Map<string, Set<string>> }
  absensiDates?: Set<string>
  tugasItems: TugasRow[]
}): {
  jumlahJp: number
  detailJp: JpDetail[]
  detailTransport: string[]
  detailTugas: TugasDetail[]
  transportDates: Set<string>
} {
  let jumlahJp = 0
  const transportDates = new Set<string>()
  const detailJp: JpDetail[] = []
  const jurnalRec = args.jurnalRec

  if (!args.isStafPiket && jurnalRec) {
    // Agregasi per tanggal: total JP = jumlah slot unik hari itu (deduplikasi gabungan)
    jurnalRec.dateSlots.forEach((daySet, tgl) => {
      const arr = Array.from(daySet).sort((a, b) => a - b)
      transportDates.add(tgl)
      jumlahJp += arr.length
      detailJp.push({
        tanggal: tgl,
        jam: arr.length ? arr.join('-') : '-',
        jp: arr.length,
        mapel: Array.from(jurnalRec.dateMapel.get(tgl) || []).join(', '),
        slots: arr,
      })
    })
  }

  // Tugas tambahan: tanggalnya ikut hari transport (anti dobel via Set yang sama).
  const detailTugas: TugasDetail[] = []
  args.tugasItems.forEach((t) => {
    if (t.tanggal) transportDates.add(t.tanggal)
    detailTugas.push({
      tanggal: t.tanggal || '',
      nama_kegiatan: t.nama_kegiatan || '',
      nominal: Number(t.nominal) || 0,
    })
  })
  detailTugas.sort((a, b) => String(a.tanggal).localeCompare(String(b.tanggal)))

  // Kehadiran 'Hadir' absensi_guru → tambah ke hari transport (TIDAK menambah JP).
  // Nilai Set `transportDates` yang sama dipakai jurnal/tugas → anti double-count.
  if (args.absensiDates && args.absensiDates.size > 0) {
    args.absensiDates.forEach((tgl) => transportDates.add(tgl))
  }

  return {
    jumlahJp,
    detailJp,
    detailTransport: Array.from(transportDates),
    detailTugas,
    transportDates,
  }
}

interface AuditLogRow {
  id: string
  kategori: string
  nama_lengkap: string
  aksi: string
  created_at: string
}

function AuditLogBox({ logs, isDarkMode }: { logs: AuditLogRow[]; isDarkMode: boolean }) {
  return (
    <div className={`border rounded-2xl p-3 space-y-2 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-300'}`}>
      <h4 className="text-[10px] font-extrabold uppercase tracking-wider flex items-center gap-1.5 text-indigo-400">
        <History className="w-3.5 h-3.5" /> 5 Catatan Pengubah Terakhir
      </h4>
      {logs.length === 0 ? (
        <p className="text-[10px] font-medium text-slate-500">Belum ada aktivitas edit tercatat di tab ini.</p>
      ) : (
        <ul className="space-y-1.5">
          {logs.map((lg) => (
            <li key={lg.id} className="flex items-start gap-2 text-[10px] leading-snug">
              <span className="font-black text-emerald-400 whitespace-nowrap shrink-0">{formatWaktuAudit(lg.created_at)}</span>
              <span className="text-slate-500 shrink-0">—</span>
              <span className="flex-1 font-medium text-slate-300">
                {lg.nama_lengkap}: <span className="text-slate-400">{lg.aksi}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// Komponen TTD digital dengan fallback: menampilkan gambar bila file tersedia;
// jika belum ada, tampilkan placeholder garis putus-putus. Otomatis beralih ke
// TTD asli begitu file diunggah ke /public (tanpa mengubah kode).
function TtdImage({
  src,
  alt,
  className,
  placeholderClassName,
}: {
  src: string
  alt: string
  className?: string
  placeholderClassName?: string
}) {
  const [failed, setFailed] = useState(false)
  return (
    <div className="relative flex items-center justify-center h-full w-full">
      {!failed ? (
        <img
          src={src}
          alt={alt}
          className={className}
          onError={() => setFailed(true)}
        />
      ) : (
        <div className={placeholderClassName} />
      )}
    </div>
  )
}

function PrintDocument({ mode, paperSize, rows, tarifJp, tarifTransport, isPaid, bulanLabel, periodeTahun, ketuaYayasan, kepalaSekolah, bendahara, kepalaSekolahNuptk, showKepsekTtd, showYayasanTtd, showBendaharaTtd }: {
  mode: 'none' | 'daftar' | 'slip'
  paperSize: 'f4' | 'a4'
  rows: RekapRow[]
  tarifJp: number
  tarifTransport: number
  isPaid: boolean
  showKepsekTtd: boolean
  showYayasanTtd: boolean
  showBendaharaTtd: boolean
  bulanLabel: string
  periodeTahun: string
  ketuaYayasan: string
  kepalaSekolah: string
  kepalaSekolahNuptk: string
  bendahara: string
}) {
  if (mode === 'none') return null

  const toNum = (v: unknown) => Number(v) || 0
  const judulPeriode = `${bulanLabel} ${periodeTahun}`
  const paperCss = paperSize === 'f4' ? '330mm 215mm' : '297mm 210mm'

  const kotorOf = (r: RekapRow) => toNum(r.total_bersih) + toNum(r.total_potongan)
  const adaPiket = rows.some((r) => toNum(r.piket) > 0)
  const totalKotor = rows.reduce((a, r) => a + kotorOf(r), 0)
  const totalPotongan = rows.reduce((a, r) => a + toNum(r.total_potongan), 0)
  const totalBersih = rows.reduce((a, r) => a + toNum(r.total_bersih), 0)

  const Kop = ({ keterangan }: { keterangan: string }) => (
    <div className="text-center border-b-4 border-double border-black pb-2 mb-3">
      <div className="text-[10px] font-black tracking-[0.18em] text-black">YAYASAN MUNA MUSTOFA</div>
      <div className="text-sm font-black uppercase text-black leading-tight">SMP &amp; SMK MUNA MUSTOFA LAMPUNG</div>
      <div className="text-[9px] text-black">Campang, Kec. Gisting, Kab. Tanggamus, Provinsi Lampung</div>
      <div className="text-xs font-black uppercase mt-2 text-black">{keterangan}</div>
      <div className="text-[9px] text-black">Periode: {judulPeriode}</div>
    </div>
  )

  const Stamp = () => (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      <div className="border-[3px] border-emerald-700 text-emerald-700 bg-white/60 rounded-xl px-5 py-3 -rotate-12 text-base font-black tracking-wider">
        SAH &amp; SUDAH DIBAYARKAN
      </div>
    </div>
  )

  // TTD/stempel digital: menampilkan gambar asli bila file tersedia; jika belum,
  // TtdImage otomatis menampilkan placeholder garis putus-putus (ganti ke TTD
  // asli begitu file diunggah ke /public, tanpa mengubah kode).
  const renderSignatureVisual = ({
    stempelSrc,
    ttdSrc,
  }: {
    stempelSrc?: string
    ttdSrc?: string
  }) => (
    <div className="relative flex items-center justify-center h-16">
      {stempelSrc && (
        <img
          src={stempelSrc}
          alt="Stempel"
          className="absolute inset-0 m-auto h-[115%] max-w-none object-contain opacity-85"
          onError={(e) => { e.currentTarget.style.display = 'none' }}
        />
      )}
      {ttdSrc && (
        <TtdImage
          src={ttdSrc}
          alt="TTD"
          className="relative z-10 h-[88%] max-w-none object-contain"
          placeholderClassName="absolute inset-0 rounded-md border-2 border-dashed border-slate-400"
        />
      )}
    </div>
  )

  const SignatureBlock = () => (
    <div className="pt-8 no-break">
      {/* Baris atas: Ketua Yayasan & Bendahara berdampingan */}
      <div className="flex justify-between items-end">
        <div className="text-center w-1/2">
          <div className="text-[9px] font-medium text-black">Mengetahui, Ketua/Wakil Ketua Yayasan</div>
          {showYayasanTtd ? renderSignatureVisual({ ttdSrc: '/ttd-yayasan.png' }) : <div className="h-16" />}
          <div className="text-[10px] font-black underline text-black">{ketuaYayasan || BLANK_TTD}</div>
          <div className="text-[8px] text-black">Yayasan Muna Mustofa</div>
        </div>
        <div className="text-center w-1/2">
          <div className="text-[9px] font-medium text-black">Bendahara,</div>
          {showBendaharaTtd ? renderSignatureVisual({ ttdSrc: '/ttd-bendahara.png' }) : <div className="h-16" />}
          <div className="text-[10px] font-black underline text-black">{bendahara || BLANK_TTD}</div>
          <div className="text-[8px] text-black">Honorarium Guru & Staf</div>
        </div>
      </div>
      {/* Baris bawah: Kepala Sekolah di tengah (tidak sejajar) */}
      <div className="flex justify-center pt-12">
        <div className="text-center">
          <div className="text-[9px] font-medium text-black">Mengetahui, Kepala SMP Muna Mustofa</div>
          {showKepsekTtd ? renderSignatureVisual({ stempelSrc: '/stempel-sekolah.png', ttdSrc: '/ttd-kepsek.png' }) : <div className="h-16" />}
          <div className="text-[10px] font-black underline text-black">{kepalaSekolah || BLANK_TTD}</div>
          <div className="text-[8px] text-black">
            {kepalaSekolahNuptk ? `NUPTK. ${kepalaSekolahNuptk}` : ''}
          </div>
        </div>
      </div>
    </div>
  )

  const thCls = 'border border-black px-1.5 py-1 text-left font-black'
  const tdCls = 'border border-black px-1.5 py-1'

  if (mode === 'daftar') {
    return (
      <div className="hidden print:block bg-white text-black p-2" style={{ fontFamily: "'Times New Roman', serif" }}>
        <style>{`@media print { @page { size: ${paperCss} !important; margin: 8mm !important; } .no-break { break-inside: avoid; } }`}</style>
        <div className="relative">
          <Kop keterangan="DAFTAR HONORARIUM GURU & STAF" />
          {isPaid && <Stamp />}
          <table className="w-full border-collapse text-[9px]">
            <thead>
              <tr>
                <th className={thCls}>No</th>
                <th className={thCls}>Nama Penerima</th>
                <th className={`${thCls} text-center`}>JP</th>
                <th className={`${thCls} text-center`}>Transport</th>
                <th className={`${thCls} text-right`}>Tunj. Jabatan</th>
                <th className={`${thCls} text-right`}>Tunj. Masa Kerja</th>
                <th className={`${thCls} text-right`}>Pembina</th>
                <th className={`${thCls} text-right`}>Wali Kelas</th>
                <th className={`${thCls} text-right`}>Tugas Tambahan</th>
                {adaPiket && <th className={`${thCls} text-right`}>Piket</th>}
                <th className={`${thCls} text-right`}>Total Kotor</th>
                <th className={`${thCls} text-right`}>Potongan</th>
                <th className={`${thCls} text-right`}>Total Bersih</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.guru_id}>
                  <td className={`${tdCls} text-center`}>{i + 1}</td>
                  <td className={`${tdCls} font-bold`}>{r.guru_nama}</td>
                  <td className={`${tdCls} text-center`}>{r.jumlah_jp}</td>
                  <td className={`${tdCls} text-center`}>{r.transport_hari}</td>
                  <td className={`${tdCls} text-right`}>{formatRupiah(r.tunjangan_jabatan)}</td>
                  <td className={`${tdCls} text-right`}>{formatRupiah(r.tunjangan_masa_kerja)}</td>
                  <td className={`${tdCls} text-right`}>{formatRupiah(r.pembina)}</td>
                  <td className={`${tdCls} text-right`}>{formatRupiah(r.wali_kelas)}</td>
                  <td className={`${tdCls} text-right`}>{formatRupiah(r.tugas_tambahan)}</td>
                  {adaPiket && <td className={`${tdCls} text-right`}>{formatRupiah(r.piket)}</td>}
                  <td className={`${tdCls} text-right font-bold`}>{formatRupiah(kotorOf(r))}</td>
                  <td className={`${tdCls} text-right`}>
                    {r.potongan.length > 0
                      ? r.potongan.map((p) => `${p.nama}: ${formatRupiah(p.hasil)}`).map((ln, k) => <div key={k}>{ln}</div>)
                      : '–'}
                  </td>
                  <td className={`${tdCls} text-right font-black`}>{formatRupiah(r.total_bersih)}</td>
                </tr>
              ))}
              <tr>
                <td colSpan={adaPiket ? 10 : 9} className={`${tdCls} text-right font-black uppercase`}>Total Keseluruhan</td>
                <td className={`${tdCls} text-right font-black`}>{formatRupiah(totalKotor)}</td>
                <td className={`${tdCls} text-right font-black`}>{formatRupiah(totalPotongan)}</td>
                <td className={`${tdCls} text-right font-black`}>{formatRupiah(totalBersih)}</td>
              </tr>
            </tbody>
          </table>
          <SignatureBlock />
        </div>
      </div>
    )
  }

  // mode === 'slip' — slip tanda terima per penerima
  return (
    <div className="hidden print:block bg-white text-black p-2" style={{ fontFamily: "'Times New Roman', serif" }}>
      <style>{`@media print { @page { size: ${paperCss} !important; margin: 8mm !important; } .no-break { break-inside: avoid; } }`}</style>
      {rows.map((r, idx) => (
        <div key={r.guru_id} className="no-break" style={idx < rows.length - 1 ? { breakAfter: 'page' } : {}}>
          <div className="relative">
            <Kop keterangan="SLIP TANDA TERIMA HONORARIUM" />
            {isPaid && <Stamp />}
            <div className="text-[10px] mb-2 font-bold text-black">
              Nama Penerima: {r.guru_nama}
            </div>
            <table className="w-full border-collapse text-[9px]">
              <tbody>
                {(() => {
                  const rowsL = (label: string, sub: string, val: string) => (
                    <tr key={label}>
                      <td className={`${tdCls} w-2/5 font-bold`}>{label}</td>
                      <td className={`${tdCls} text-right`}>{sub}</td>
                      <td className={`${tdCls} text-right font-black`}>{val}</td>
                    </tr>
                  )
                  const jpAmt = toNum(r.jumlah_jp) * toNum(tarifJp)
                  const trAmt = toNum(r.transport_hari) * toNum(tarifTransport)
                  return (
                    <>
                      {rowsL('Jam Mengajar (JP)', `${r.jumlah_jp} JP × ${formatRupiah(tarifJp)}`, formatRupiah(jpAmt))}
                      {rowsL('Transport Harian', `${r.transport_hari} hari × ${formatRupiah(tarifTransport)}`, formatRupiah(trAmt))}
                      {rowsL('Tunjangan Jabatan', '', formatRupiah(r.tunjangan_jabatan))}
                      {rowsL('Tunjangan Masa Kerja', '', formatRupiah(r.tunjangan_masa_kerja))}
                      {rowsL('Pembina', '', formatRupiah(r.pembina))}
                      {rowsL('Wali Kelas', '', formatRupiah(r.wali_kelas))}
                      {rowsL('Tugas Tambahan', '', formatRupiah(r.tugas_tambahan))}
                      {toNum(r.piket) > 0 && rowsL('Piket', '', formatRupiah(r.piket))}
                      {rowsL('Total Kotor', '', formatRupiah(kotorOf(r)))}
                      {r.potongan.map((p) => rowsL(`Potongan ${p.nama}`, p.tipe === 'persen' ? p.nilai + '%' : formatRupiah(p.nilai), '- ' + formatRupiah(p.hasil)))}
                      {rowsL('Total Potongan', '', formatRupiah(r.total_potongan))}
                      {rowsL('Total Bersih (Diterima)', '', formatRupiah(r.total_bersih))}
                    </>
                  )
                })()}
              </tbody>
            </table>
            {(() => {
              const nPenerima = (r.guru_nama || '').trim().toLowerCase()
              const nBendahara = (bendahara || '').trim().toLowerCase()
              const nKepsek = (kepalaSekolah || '').trim().toLowerCase()
              const sameBendahara = !!nBendahara && nPenerima === nBendahara
              const sameKepsek = !!nKepsek && nPenerima === nKepsek

              // Kasus sangat jarang: penerima merangkap Bendahara & Kepala Sekolah sekaligus.
              if (sameBendahara && sameKepsek) {
                return (
                  <div className="text-center mt-10 no-break">
                    <div className="text-[9px] font-medium text-black">Penerima & Mengetahui, Bendahara & Kepala SMP Muna Mustofa</div>
                    {showKepsekTtd
                      ? renderSignatureVisual({ stempelSrc: '/stempel-sekolah.png', ttdSrc: '/ttd-kepsek.png' })
                      : <div className="h-14" />}
                    <div className="text-[10px] font-black underline text-black">{r.guru_nama}</div>
                    {kepalaSekolahNuptk ? <div className="text-[8px] text-black">NUPTK. {kepalaSekolahNuptk}</div> : null}
                  </div>
                )
              }

              // Penerima = Kepala Sekolah → gabung jadi satu blok (pakai stempel), Bendahara tersendiri.
              if (sameKepsek) {
                return (
                  <div className="flex justify-between items-end pt-8 mt-4 no-break">
                    <div className="text-center w-1/2">
                      <div className="text-[9px] font-medium text-black">Penerima & Mengetahui, Kepala SMP Muna Mustofa</div>
                      {showKepsekTtd
                        ? renderSignatureVisual({ stempelSrc: '/stempel-sekolah.png', ttdSrc: '/ttd-kepsek.png' })
                        : <div className="h-14" />}
                      <div className="text-[10px] font-black underline text-black">{r.guru_nama}</div>
                      {kepalaSekolahNuptk ? <div className="text-[8px] text-black">NUPTK. {kepalaSekolahNuptk}</div> : null}
                    </div>
                    <div className="text-center w-1/2">
                      <div className="text-[9px] font-medium text-black">Mengetahui, Bendahara</div>
                      {showBendaharaTtd ? renderSignatureVisual({ ttdSrc: '/ttd-bendahara.png' }) : <div className="h-14" />}
                      <div className="text-[10px] font-black underline text-black">{bendahara || BLANK_TTD}</div>
                    </div>
                  </div>
                )
              }

              // Penerima = Bendahara → gabung jadi satu blok, Kepala Sekolah tersendiri (tetap pakai stempel).
              if (sameBendahara) {
                return (
                  <div className="flex justify-between items-end pt-8 mt-4 no-break">
                    <div className="text-center w-1/2">
                      <div className="text-[9px] font-medium text-black">Penerima & Mengetahui, Bendahara</div>
                      {showBendaharaTtd ? renderSignatureVisual({ ttdSrc: '/ttd-bendahara.png' }) : <div className="h-14" />}
                      <div className="text-[10px] font-black underline text-black">{r.guru_nama}</div>
                    </div>
                    <div className="text-center w-1/2">
                      <div className="text-[9px] font-medium text-black">Mengetahui, Kepala SMP Muna Mustofa</div>
                      {showKepsekTtd
                        ? renderSignatureVisual({ stempelSrc: '/stempel-sekolah.png', ttdSrc: '/ttd-kepsek.png' })
                        : <div className="h-14" />}
                      <div className="text-[10px] font-black underline text-black">{kepalaSekolah || BLANK_TTD}</div>
                      {kepalaSekolahNuptk ? <div className="text-[8px] text-black">NUPTK. {kepalaSekolahNuptk}</div> : null}
                    </div>
                  </div>
                )
              }

              // Normal: semua orang berbeda.
              return (
                <>
                  <div className="flex justify-between items-end pt-8 mt-4 no-break">
                    <div className="text-center w-1/2">
                      <div className="text-[9px] font-medium text-black">Penerima / Guru,</div>
                      <div className="h-14" />
                      <div className="text-[10px] font-black underline text-black">{r.guru_nama}</div>
                    </div>
                    <div className="text-center w-1/2">
                      <div className="text-[9px] font-medium text-black">Mengetahui, Bendahara</div>
                      {showBendaharaTtd ? renderSignatureVisual({ ttdSrc: '/ttd-bendahara.png' }) : <div className="h-14" />}
                      <div className="text-[10px] font-black underline text-black">{bendahara || BLANK_TTD}</div>
                    </div>
                  </div>
                  <div className="text-center mt-10 no-break">
                    <div className="text-[9px] font-medium text-black">Mengetahui, Kepala SMP Muna Mustofa</div>
                    {showKepsekTtd
                      ? renderSignatureVisual({ stempelSrc: '/stempel-sekolah.png', ttdSrc: '/ttd-kepsek.png' })
                      : <div className="h-14" />}
                    <div className="text-[10px] font-black underline text-black">{kepalaSekolah || BLANK_TTD}</div>
                    {kepalaSekolahNuptk ? <div className="text-[8px] text-black">NUPTK. {kepalaSekolahNuptk}</div> : null}
                  </div>
                </>
              )
            })()}
          </div>
        </div>
      ))}
    </div>
  )
}

export default function HonorariumPage() {
  const { isDarkMode } = useDarkMode()
  const { isOperator } = useAuthRole()

  const [currentName, setCurrentName] = useState('')
  const [currentGuruId, setCurrentGuruId] = useState<number | null>(null)
  const [currentEmail, setCurrentEmail] = useState<string | null>(null)
  // Identitas guru hasil pencocokan email akun yang login pada tabel public.guru
  // (id + nama_lengkap). Dipakai untuk memfilter slip tanda terima agar hanya
  // merender slip milik pemilik akun yang sedang login.
  const [loginGuru, setLoginGuru] = useState<{ id: number; nama_lengkap: string } | null>(null)
  const [loading, setLoading] = useState(true)

  // Identitas 3 Pengurus Utama ditentukan via pencocokan nama (case-insensitive, trim +
  // rapatkan spasi) terhadap whitelist tetap PENGURUS_NAMES — BUKAN berdasarkan role akun.
  // Pattern sama dengan server-side public.honorarium_current_access() (docs/migrasi-
  // rpc-otorisasi-honor.sql). Operator biasa TIDAK otomatis menjadi Pengurus Utama.
  const isPengurusUtama = isPengurusName(currentName)

  const [periodeBulan, setPeriodeBulan] = useState('01')
  const [periodeTahun, setPeriodeTahun] = useState('2026')
  const [tahunOptions, setTahunOptions] = useState<number[]>(() =>
    Array.from({ length: 6 }, (_, i) => 2026 - 2 + i)
  )
  const periode = `${periodeTahun}-${periodeBulan}`

  // Batas tanggal 27 untuk persetujuan Kepala Sekolah (dihitung setelah hydration,
  // bukan saat prerender — menghindari "unstable value new Date()" di Next.js 16).
  const [canKirimKepsek, setCanKirimKepsek] = useState(false)
  useEffect(() => {
    const [cY, cM] = periode.split('-').map(Number)
    const cutoff27 = new Date(cY, (cM || 1) - 1, 27)
    const t0 = new Date()
    t0.setHours(0, 0, 0, 0)
    setCanKirimKepsek(t0 >= cutoff27)
  }, [periode])

  // Inisialisasi periode ke bulan/tahun saat ini SETELAH hydration (menghindari
  // warning Next.js 16 "unstable value new Date()" pada Client Component).
  useEffect(() => {
    const d = new Date()
    let bulanAwal = String(d.getMonth() + 1).padStart(2, '0')
    let tahunAwal = String(d.getFullYear())

    try {
      const params = new URLSearchParams(window.location.search)
      const mPeriode = (params.get('periode') || '').match(/^(\d{4})-(\d{2})$/)
      if (mPeriode) {
        const mo = Number(mPeriode[2])
        if (mo >= 1 && mo <= 12) {
          tahunAwal = mPeriode[1]
          bulanAwal = mPeriode[2]
        }
      }
    } catch {
      // abaikan, fallback ke bulan/tahun saat ini
    }

    setPeriodeBulan(bulanAwal)
    setPeriodeTahun(tahunAwal)
    // setPeriodeTahun sudah ditangani di atas (prioritas dari query ?periode=)
    setTahunOptions(Array.from({ length: 6 }, (_, i) => Number(tahunAwal) - 2 + i))
  }, [])

  const [activeTab, setActiveTab] = useState<'master' | 'rekap' | 'riwayat'>('rekap')
  const [riwayatPeriode, setRiwayatPeriode] = useState('')
  const [detailGuruId, setDetailGuruId] = useState<number | null>(null)

  // Rincian detail (JP/transport/tugas) untuk baris tersimpan: dihitung saat
  // dibutuhkan (buka Detail / tampilan pribadi) dari jurnal + absensi + tugas
  // — TANPA mengubah angka uang yang sudah tersimpan/diedit manual.
  const detailSiapRef = useRef<Set<string>>(new Set())
  const detailHitungRef = useRef<Set<string>>(new Set())
  const [detailMemuat, setDetailMemuat] = useState(false)

  const [guruList, setGuruList] = useState<GuruRow[]>([])

  // Deteksi peran berbasis jabatan (transparansi & alur persetujuan)
  const currentJabatanLower = (() => {
    const em = (currentEmail || '').trim().toLowerCase()
    const g = guruList.find((x) => (x.email || '').trim().toLowerCase() === em)
    return String(g?.jabatan ?? '').trim().toLowerCase()
  })()
  const isKepalaSekolah = currentJabatanLower.includes('kepala') && !currentJabatanLower.includes('smk')
  const isBendahara = currentJabatanLower.includes('bendahara')
  const isYayasan = currentJabatanLower.includes('yayasan')
  const canManageRekap = isPengurusUtama
  const showFullRekap = canManageRekap || isKepalaSekolah || isBendahara || isYayasan
  const [pengaturan, setPengaturan] = useState<PengaturanRow | null>(null)
  const [potonganList, setPotonganList] = useState<PotonganRow[]>([])
  const [penerimaList, setPenerimaList] = useState<PenerimaRow[]>([])
  const [tugasList, setTugasList] = useState<TugasRow[]>([])
  const [rekapList, setRekapList] = useState<RekapRow[]>([])
  // Rekap mentah (tersimpan) setahun penuh untuk grid kartu bulanan.
  const [rekapTahun, setRekapTahun] = useState<RekapRow[]>([])
  // Pemantik muat ulang tahun setelah simpan/hitung otomatis (baris baru belum punya id).
  const [tahunRefreshKey, setTahunRefreshKey] = useState(0)
  const [riwayatList, setRiwayatList] = useState<RekapRow[]>([])
  const [riwayatPeriods, setRiwayatPeriods] = useState<string[]>([])
  const [auditLogs, setAuditLogs] = useState<AuditLogRow[]>([])

  // Baseline untuk log audit rincian (nilai lama sebelum diubah)
  const prevPengaturanRef = useRef<PengaturanRow | null>(null)
  const prevPotonganRef = useRef<PotonganRow[]>([])
  const prevPenerimaRef = useRef<PenerimaRow[]>([])
  const prevRekapRef = useRef<RekapRow[]>([])

  const [showTugasModal, setShowTugasModal] = useState(false)
  const [tugasTanggal, setTugasTanggal] = useState('')
  const [tugasKegiatan, setTugasKegiatan] = useState('')
  const [tugasGuruIds, setTugasGuruIds] = useState<number[]>([])
  const [tugasNominal, setTugasNominal] = useState(0)


  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ tipe: 'ok' | 'err'; pesan: string } | null>(null)

  // Jumlah entri jurnal sah dari penarikan otomatis + status cetak dokumen
  const [jurnalSahCount, setJurnalSahCount] = useState(0)
  const [printMode, setPrintMode] = useState<'none' | 'daftar' | 'slip'>('none')
  const [paperSize, setPaperSize] = useState<'f4' | 'a4'>('f4')
  // Jika diisi, cetak hanya slip satu guru tertentu; null = cetak semua (admin/pejabat).
  const [slipGuruId, setSlipGuruId] = useState<number | null>(null)

  const triggerPrint = (mode: 'daftar' | 'slip', guruId?: number | null) => {
    setSlipGuruId(guruId ?? null)
    setPrintMode(mode)
    window.setTimeout(() => window.print(), 300)
  }

  useEffect(() => {
    const onAfter = () => { setPrintMode('none'); setSlipGuruId(null) }
    window.addEventListener('afterprint', onAfter)
    return () => window.removeEventListener('afterprint', onAfter)
  }, [])

  const n = (v: unknown) => Number(v) || 0
  const guruById = (gid: number) => guruList.find((g) => g.id === gid)
  const getGuruEmail = (gid: number) => (guruById(gid)?.email || '').trim().toLowerCase()

  // Nama & NUPTK pejabat TTD diambil DINAMIS dari kolom `jabatan` tabel public.guru.
  // Pencocokan case-insensitive dengan prioritas EXACT-FIRST agar label "mirip"
  // (mis. "Wakil Kepala Sekolah") tidak salah terpilih sebagai pejabat asli.
  // Jika pengguna yang login adalah pejabat tsb., gunakan identitas dirinya (currentName)
  // sehingga TTD sesuai akun yang sedang mencetak.
  const findSignatoryGuru = (
    predicates: Array<(jabatanLower: string) => boolean>,
  ): GuruRow | null => {
    for (const pred of predicates) {
      const hit = guruList.find((g) => {
        const j = String(g.jabatan ?? '').trim().toLowerCase()
        return j.length > 0 && pred(j)
      })
      if (hit) return hit
    }
    return null
  }

  const useLoginIdentityIf = (
    isSelf: boolean,
    resolvedName: string,
    resolvedNuptk: string,
  ): { nama: string; nuptk: string } => {
    if (isSelf && currentName.trim()) {
      const self = guruById(currentGuruId ?? -1)
      return {
        nama: currentName.trim(),
        nuptk: self?.NUPTK ? String(self.NUPTK).trim() : '',
      }
    }
    return { nama: resolvedName, nuptk: resolvedNuptk }
  }

  const ksGuru = findSignatoryGuru([
    (j) => j === 'kepala sekolah',
    (j) => j.includes('kepala sekolah') && !j.includes('smk'),
    (j) => j.includes('kepala sekolah'),
  ])
  const bendaharaGuru = findSignatoryGuru([
    (j) => j === 'bendahara',
    (j) => j.includes('bendahara'),
  ])
  const yayasanGuru = findSignatoryGuru([
    (j) => j === 'ketua yayasan',
    (j) => j.includes('ketua yayasan'),
    (j) => j.includes('yayasan'),
  ])

  const ksIdentity = useLoginIdentityIf(
    isKepalaSekolah,
    (ksGuru?.nama_lengkap || '').trim(),
    ksGuru?.NUPTK ? String(ksGuru.NUPTK).trim() : '',
  )
  const bendaharaIdentity = useLoginIdentityIf(
    isBendahara,
    (bendaharaGuru?.nama_lengkap || '').trim(),
    bendaharaGuru?.NUPTK ? String(bendaharaGuru.NUPTK).trim() : '',
  )
  const yayasanIdentity = useLoginIdentityIf(
    isYayasan,
    (yayasanGuru?.nama_lengkap || '').trim(),
    yayasanGuru?.NUPTK ? String(yayasanGuru.NUPTK).trim() : '',
  )

  const namaKepalaSekolah = ksIdentity.nama
  const nuptkKepalaSekolah = ksIdentity.nuptk
  const namaBendahara = bendaharaIdentity.nama
  const namaKetuaYayasan = yayasanIdentity.nama

  // =====================================================================
  // IDENTITAS LOGIN + MASTER DATA (mount sekali)
  // =====================================================================
  useEffect(() => {
    let mounted = true
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user?.email) {
        if (mounted) setLoading(false)
        return
      }
      const cleanEmail = user.email.trim().toLowerCase()
      setCurrentEmail(cleanEmail)

      const { data: guruRow } = await supabase
        .from('guru')
        .select('id, nama_lengkap, email')
        .ilike('email', cleanEmail)
        .maybeSingle()

      const nama = (guruRow?.nama_lengkap || '').trim() || user.user_metadata?.full_name || ''

      if (mounted) {
        setCurrentName(nama)
        setCurrentGuruId(guruRow?.id ?? null)
        // Simpan id + nama_lengkap guru yang cocok dengan email akun login
        // (pencocokan case-insensitive via .ilike + cleanEmail trim/lower).
        setLoginGuru(
          guruRow?.id != null && (guruRow.nama_lengkap || '').trim()
            ? { id: Number(guruRow.id), nama_lengkap: String(guruRow.nama_lengkap).trim() }
            : null
        )
      }

      // Master data
      const fetchGuru = supabase.from('guru').select('id, nama_lengkap, email, jabatan, unit_mengajar, NUPTK').order('nama_lengkap')
      const fetchPengaturan = supabase.from('honorarium_pengaturan').select('*').limit(1).maybeSingle()
      const fetchPotongan = supabase.from('honorarium_potongan').select('*').order('urutan')
      const fetchPenerima = supabase.from('honorarium_penerima').select('*')

      const [guruRes, pengRes, potRes, penRes] = await Promise.all([
        fetchGuru, fetchPengaturan, fetchPotongan, fetchPenerima,
      ])

      if (mounted) {
        setGuruList(guruRes.data || [])
        setPengaturan(pengRes.data || null)
        setPotonganList(potRes.data || [])
        setPenerimaList(penRes.data || [])
        prevPengaturanRef.current = pengRes.data || null
        prevPotonganRef.current = potRes.data || []
        prevPenerimaRef.current = penRes.data || []
        setLoading(false)
      }
    }
    init()
    return () => { mounted = false }
  }, [])

  // =====================================================================
  // MUAT DATA PERIODE (tugas tambahan + rekap) saat periode berubah
  // =====================================================================
  useEffect(() => {
    if (!currentEmail) return
    let mounted = true

    async function loadPeriode() {
      const tugasRes = await supabase
        .from('honorarium_tugas_tambahan')
        .select('*')
        .eq('periode', periode)
        .order('tanggal')

      let rekapQuery = supabase.from('honorarium_rekap').select('*').eq('periode', periode)
      if (!showFullRekap && currentGuruId) {
        rekapQuery = rekapQuery.eq('guru_id', currentGuruId)
      }
      const rekapRes = await rekapQuery

      if (!mounted) return
      if (tugasRes.data) setTugasList(tugasRes.data)
      if (rekapRes.data) {
        const hydrated = hydrateRekap(rekapRes.data)
        setRekapList(hydrated)
        prevRekapRef.current = hydrated
        // Baris segar dari database tidak membawa rincian detail → rincian
        // otomatis harus dihitung ulang saat Detail dibuka.
        detailSiapRef.current = new Set(
          [...detailSiapRef.current].filter((k) => !k.startsWith(`${periode}:`))
        )
      }
    }

    loadPeriode()
    return () => { mounted = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periode, currentEmail, penerimaList, guruList, pengaturan, potonganList, showFullRekap, currentGuruId])

  // =====================================================================
  // MUAT REKAP SETAHUN (untuk grid kartu bulanan). Baris MENTAH tersimpan saja
  // (bukan hasil hydrate) supaya bulan tanpa rekap tampil 'BELUM DIHITUNG'.
  // =====================================================================
  useEffect(() => {
    if (!currentEmail) return
    let mounted = true

    async function loadTahun() {
      let q = supabase
        .from('honorarium_rekap')
        .select('*')
        .gte('periode', `${periodeTahun}-01`)
        .lte('periode', `${periodeTahun}-12`)
      if (!showFullRekap && currentGuruId) {
        q = q.eq('guru_id', currentGuruId)
      }
      const res = await q.order('periode')
      if (mounted && res.data) setRekapTahun(res.data as RekapRow[])
    }

    loadTahun()
    return () => { mounted = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodeTahun, currentEmail, showFullRekap, currentGuruId, tahunRefreshKey])

  // Sinkronkan kartu bulan berjalan dengan baris tersimpan di rekapList
  // (mis. setelah persetujuan / pembayaran) tanpa menunggu muat ulang tahun.
  // Hanya baris ber-id (tersimpan) yang dipakai; baris hydrate bernilai nol
  // (id undefined) tidak mengubah status 'BELUM DIHITUNG'.
  useEffect(() => {
    const saved = rekapList.filter((r) => r.id && r.periode === periode)
    setRekapTahun((prev) => {
      const merged = [...prev.filter((r) => r.periode !== periode), ...saved]
      if (merged.length === prev.length && merged.every((r, i) => r === prev[i])) {
        return prev
      }
      return merged
    })
  }, [rekapList, periode])

  // =====================================================================
  // MEMASTIKAN SEMUA PENERIMA AKTIF MUNCUL DI REKAP
  // =====================================================================
  function hydrateRekap(savedRows: RekapRow[]): RekapRow[] {
    const activePenerima = showFullRekap
      ? penerimaList.filter((p) => p.aktif)
      : penerimaList.filter((p) => p.aktif && p.guru_id === currentGuruId)
    const savedMap = new Map(savedRows.map((r) => [r.guru_id, r]))

    const rows = activePenerima.map((p) => {
      const existing = savedMap.get(p.guru_id)
      // Selalu utamakan nama dari master guru (sumber kebenaran), bukan nilai
      // guru_nama yang mungkin basi/keliru dari state baris rekap.
      const nama = guruById(p.guru_id)?.nama_lengkap || existing?.guru_nama || ''
      if (existing) {
        return computeTotalsRow({ ...existing, periode, guru_nama: nama })
      }
      return computeTotalsRow({
        id: undefined,
        periode,
        guru_id: p.guru_id,
        guru_nama: nama,
        jumlah_jp: 0,
        transport_hari: 0,
        tunjangan_jabatan: n(p.tunjangan_jabatan),
        tunjangan_masa_kerja: n(p.tunjangan_masa_kerja),
        pembina: n(p.pembina),
        wali_kelas: p.wali_kelas ? n(pengaturan?.tunjangan_wali_kelas) : 0,
        tugas_tambahan: 0,
        piket: 0,
        potongan: [],
        total_potongan: 0,
        total_bersih: 0,
        status: 'DRAFT',
      })
    })
    return rows
  }

  // =====================================================================
  // MENGHITUNG TOTAL REKAP (kotor / potongan / bersih)
  // =====================================================================
  function computeTotalsRow(r: RekapRow): RekapRow {
    const tarifJp = n(pengaturan?.tarif_jp)
    const tarifTransport = n(pengaturan?.tarif_transport_harian)
    const kotor =
      r.jumlah_jp * tarifJp +
      r.transport_hari * tarifTransport +
      r.tunjangan_jabatan +
      r.tunjangan_masa_kerja +
      r.pembina +
      r.wali_kelas +
      r.tugas_tambahan +
      n(r.piket)

    const penerima = penerimaList.find((p) => p.guru_id === r.guru_id)
    const potongan: PotonganTerapan[] = potonganList
      .filter((p) => p.aktif)
      .sort((a, b) => n(a.urutan) - n(b.urutan))
      .map((p) => {
        let nilai = n(p.nilai)
        if (p.nama.trim().toLowerCase() === 'infaq') {
          const infaq = n(penerima?.infaq_nominal)
          if (infaq > 0) nilai = infaq
        }
        const hasil = p.tipe === 'persen' ? (kotor * nilai) / 100 : nilai
        return { nama: p.nama, tipe: p.tipe, nilai, hasil }
      })

    const totalPotongan = potongan.reduce((s, x) => s + x.hasil, 0)
    return { ...r, potongan, total_potongan: totalPotongan, total_bersih: Math.max(0, kotor - totalPotongan) }
  }

  // =====================================================================
  // TARIK & HITUNG OTOMATIS (dari jurnal + tugas tambahan)
  // =====================================================================
  const buildAutoRekap = useCallback(async (targetPeriode: string): Promise<{ rows: RekapRow[]; validJurnal: number }> => {
    const activePenerima = penerimaList.filter((p) => p.aktif)
    const mengajarPenerima = activePenerima.filter((p) => p.status !== 'staf_piket')
    const emails: string[] = Array.from(
      new Set(mengajarPenerima.map((p) => getGuruEmail(p.guru_id)).filter((e) => e.length > 0))
    )

    // Deduplikasi anti-dobel kelas gabungan: himpunan slot jam per tanggal per guru.
    // Satu kegiatan gabungan (ekskul Pramuka/Qiroah VII–XII, Presentasi X–XII) tercatat
    // di beberapa baris kelas sekaligus pada jam yang sama; slot jam digabung lewat Set
    // sehingga tetap dihitung 1x (mis. {7,8} = 2 JP), bukan dikali jumlah kelas/bukan 1 JP.
    const { jurnalMap, validJurnal } = await muatPetaJurnal(emails, targetPeriode, guruList)

    // --- ABSENSI GURU (SUMBER UTAMA TRANSPORT HARI) -------------------------
    // Kehadiran 'Hadir' dari tabel absensi_guru menjadi sumber utama hari
    // transport (lihat muatAbsensiGuru di atas).
    const allActiveEmails: string[] = Array.from(
      new Set(activePenerima.map((p) => getGuruEmail(p.guru_id)).filter((e) => e.length > 0))
    )
    const absensiGuruByEmail = await muatAbsensiGuru(allActiveEmails, targetPeriode)

    const tugasPeriode = tugasList.filter((t) => t.periode === targetPeriode)

    let rowsBuilt: RekapRow[] = []
    rowsBuilt = activePenerima.map((p) => {
      const guru = guruById(p.guru_id)
      const email = getGuruEmail(p.guru_id)
      const jurnalRec = jurnalMap.get(email)

      // Rincian detail (JP/transport/tugas) disusun dari sumber yang sama
      // dengan Tarik & Hitung — angka uang TIDAK dihitung di sini.
      const det = susunDetailGuru({
        isStafPiket: p.status === 'staf_piket',
        jurnalRec,
        absensiDates: absensiGuruByEmail.get(email),
        tugasItems: tugasPeriode.filter((t) => t.guru_ids.includes(p.guru_id)),
      })
      const jumlahJp = det.jumlahJp
      const transportDates = det.transportDates
      const detailJp = det.detailJp
      const tugasNominal = det.detailTugas.reduce((s, t) => s + t.nominal, 0)
      const piket = p.status === 'staf_piket' ? transportDates.size * n(pengaturan?.tarif_piket) : 0

      return computeTotalsRow({
        id: undefined,
        periode: targetPeriode,
        guru_id: p.guru_id,
        guru_nama: guru?.nama_lengkap || '',
        jumlah_jp: jumlahJp,
        transport_hari: transportDates.size,
        detailJp: det.detailJp,
        detailTransport: det.detailTransport,
        detailTugas: det.detailTugas,
        tunjangan_jabatan: n(p.tunjangan_jabatan),
        tunjangan_masa_kerja: n(p.tunjangan_masa_kerja),
        pembina: n(p.pembina),
        wali_kelas: p.wali_kelas ? n(pengaturan?.tunjangan_wali_kelas) : 0,
        tugas_tambahan: tugasNominal,
        piket,
        potongan: [],
        total_potongan: 0,
        total_bersih: 0,
        status: 'DRAFT',
      })
    })
    return { rows: rowsBuilt, validJurnal }
  }, [penerimaList, guruList, potonganList, pengaturan, tugasList])

  // Hitung rincian detail SATU guru untuk satu periode (dipakai saat Detail
  // dibuka / tampilan pribadi dimuat). Memakai helper yang sama dengan
  // Tarik & Hitung sehingga hasil detailnya identik — hanya field detail
  // yang dipakai, angka uang tidak disentuh.
  const hitungDetailGuru = useCallback(async (guruId: number, targetPeriode: string) => {
    const email = getGuruEmail(guruId)
    if (!email) return null
    const penerima = penerimaList.find((p) => p.guru_id === guruId)
    const isStafPiket = penerima?.status === 'staf_piket'
    const { jurnalMap } = isStafPiket
      ? { jurnalMap: new Map<string, { dateSlots: Map<string, Set<number>>; dateMapel: Map<string, Set<string>> }>() }
      : await muatPetaJurnal([email], targetPeriode, guruList)
    const absensiMap = await muatAbsensiGuru([email], targetPeriode)
    const tugasItems = tugasList.filter((t) => t.periode === targetPeriode && t.guru_ids.includes(guruId))
    const det = susunDetailGuru({
      isStafPiket,
      jurnalRec: jurnalMap.get(email),
      absensiDates: absensiMap.get(email),
      tugasItems,
    })
    return { detailJp: det.detailJp, detailTransport: det.detailTransport, detailTugas: det.detailTugas }
  }, [guruList, penerimaList, tugasList])

  // Lengkapi field detail (detailJp/detailTransport/detailTugas) pada baris
  // rekap yang sudah ada — HANYA field detail yang digabung, semua angka
  // uang (JP, transport, tunjangan, potongan, bersih) dibiarkan apa adanya.
  const lengkapiDetailGuru = useCallback(async (guruId: number) => {
    const key = `${periode}:${guruId}`
    if (detailSiapRef.current.has(key) || detailHitungRef.current.has(key)) return
    detailHitungRef.current.add(key)
    setDetailMemuat(true)
    try {
      const det = await hitungDetailGuru(guruId, periode)
      if (det) {
        setRekapList((prev) =>
          prev.map((r) =>
            r.guru_id === guruId && r.periode === periode
              ? { ...r, detailJp: det.detailJp, detailTransport: det.detailTransport, detailTugas: det.detailTugas }
              : r
          )
        )
      }
    } catch {
      // Gagal memuat rincian: angka uang tetap tampil, bagian rincian kosong.
    } finally {
      detailHitungRef.current.delete(key)
      detailSiapRef.current.add(key)
      setDetailMemuat(false)
    }
  }, [periode, hitungDetailGuru])

  // Saat modal Detail dibuka: lengkapi rincian guru tsb. bila barisnya belum
  // punya rincian (mis. bulan tersimpan). Bila rincian sudah ada (habis
  // Tarik & Hitung), tidak dihitung ulang.
  useEffect(() => {
    if (detailGuruId == null) return
    const row = rekapList.find((r) => r.guru_id === detailGuruId && r.periode === periode)
    if (!row) return
    const sudahAda =
      (row.detailJp?.length || 0) > 0 ||
      (row.detailTransport?.length || 0) > 0 ||
      (row.detailTugas?.length || 0) > 0
    if (sudahAda) {
      detailSiapRef.current.add(`${periode}:${detailGuruId}`)
      return
    }
    lengkapiDetailGuru(detailGuruId)
  }, [detailGuruId, periode, rekapList, lengkapiDetailGuru])

  // Tampilan pribadi guru: lengkapi rincian miliknya sendiri otomatis saat
  // barisnya dimuat, supaya bagian Rincian Tugas Tambahan + tombol Detail
  // langsung menampilkan data tanpa Tarik & Hitung.
  useEffect(() => {
    if (showFullRekap || currentGuruId == null) return
    const row = rekapList.find((r) => r.guru_id === currentGuruId && r.periode === periode)
    if (!row) return
    const sudahAda =
      (row.detailJp?.length || 0) > 0 ||
      (row.detailTransport?.length || 0) > 0 ||
      (row.detailTugas?.length || 0) > 0
    if (sudahAda) return
    lengkapiDetailGuru(currentGuruId)
  }, [showFullRekap, currentGuruId, periode, rekapList, lengkapiDetailGuru])

  const handleAutoCalc = async () => {
    setSaving(true)
    try {
      const { rows, validJurnal } = await buildAutoRekap(periode)
      setJurnalSahCount(validJurnal)
      setRekapList(rows)
      await persistRekap(rows)
      setTahunRefreshKey((k) => k + 1)
      showToast('ok', `Berhasil menarik ${validJurnal} entri jurnal sah & menghitung otomatis, lalu tersimpan ke database.`)

      // Log rincian spesifik: bandingkan nilai lama vs nilai baru per guru
      const oldRows = rekapList.filter((r) => r.periode === periode)
      const oldMap = new Map(oldRows.map((r) => [r.guru_id, r]))
      const parts: string[] = []
      rows.forEach((r) => {
        const old = oldMap.get(r.guru_id)
        if (old) {
          if (old.jumlah_jp !== r.jumlah_jp) parts.push(`JP ${guruNama(r.guru_id)} (${old.jumlah_jp} → ${r.jumlah_jp})`)
          if (old.transport_hari !== r.transport_hari) parts.push(`Transport ${guruNama(r.guru_id)} (${old.transport_hari} → ${r.transport_hari})`)
        } else if (r.jumlah_jp > 0 || r.transport_hari > 0) {
          parts.push(`JP ${guruNama(r.guru_id)} (baru ${r.jumlah_jp}, transport ${r.transport_hari})`)
        }
      })
      const aksi = parts.length
        ? 'Menarik & Menghitung Otomatis: ' + parts.slice(0, 10).join('; ')
        : 'Menarik & Menghitung Otomatis (tanpa perubahan)'
      await logAudit('rekap', aksi)
    } catch (e: any) {
      showToast('err', 'Gagal menghitung otomatis: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  // =====================================================================
  // SIMPAN REKAP KE DATABASE
  // =====================================================================
  const persistRekap = async (rows?: RekapRow[]) => {
    const target = (rows ?? rekapList).filter((r) => r.periode === periode)
    const payload = target.map((r) => ({
      periode,
      guru_id: r.guru_id,
      jumlah_jp: r.jumlah_jp,
      transport_hari: r.transport_hari,
      tunjangan_jabatan: r.tunjangan_jabatan,
      tunjangan_masa_kerja: r.tunjangan_masa_kerja,
      pembina: r.pembina,
      wali_kelas: r.wali_kelas,
      tugas_tambahan: r.tugas_tambahan,
      piket: n(r.piket),
      potongan: r.potongan,
      total_potongan: r.total_potongan,
      total_bersih: r.total_bersih,
      status: r.status,
      catatan: r.catatan || null,
      updated_by: currentName,
      updated_at: new Date().toISOString(),
    }))
    const { error } = await supabase.rpc('honorarium_save_rekap', { p_rows: payload })
    return error
  }

  const handleSaveRekap = async () => {
    if (!pengaturan) {
      showToast('err', 'Atur dulu Tarif di tab Master Penerima & Tarif.')
      return
    }
    setSaving(true)
    try {
      const error = await persistRekap()
      if (error) throw error
      setTahunRefreshKey((k) => k + 1)
      showToast('ok', `Rekap ${BLN_NAMES[Number(periodeBulan) - 1]} ${periodeTahun} berhasil disimpan.`)

      const base = prevRekapRef.current || []
      const baseMap = new Map(base.map((r) => [r.guru_id, r]))
      const targetRows = rekapList.filter((r) => r.periode === periode)
      const parts: string[] = []
      targetRows.forEach((r) => {
        const old = baseMap.get(r.guru_id)
        if (old) {
          if (old.jumlah_jp !== r.jumlah_jp) parts.push(`JP ${guruNama(r.guru_id)} (${old.jumlah_jp} → ${r.jumlah_jp})`)
          if (old.transport_hari !== r.transport_hari) parts.push(`Transport ${guruNama(r.guru_id)} (${old.transport_hari} → ${r.transport_hari})`)
        }
      })
      const aksi = parts.length
        ? 'Menyimpan Rekap: ' + parts.slice(0, 10).join('; ')
        : `Menyimpan Rekap (${targetRows.length} penerima, tanpa perubahan nilai)`
      await logAudit('rekap', aksi)
    } catch (e: any) {
      showToast('err', 'Gagal menyimpan rekap: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  // =====================================================================
  // KONFIRMASI SUDAH DIBAYARKAN (kunci permanen PAID)
  // =====================================================================
  // =====================================================================
  // TAB MASTER — PENGATURAN, POTONGAN, PENERIMA
  // =====================================================================
  const setPengaturanField = (key: keyof PengaturanRow, value: number) => {
    setPengaturan((prev) => ({ ...(prev as PengaturanRow), [key]: value }))
  }

  const updatePotongan = (idx: number, patch: Partial<PotonganRow>) => {
    setPotonganList((prev) => prev.map((p, i) => (i === idx ? { ...p, ...patch } : p)))
  }

  const addPotongan = () => {
    setPotonganList((prev) => [
      ...prev,
      { nama: '', aktif: true, tipe: 'nominal', nilai: 0, urutan: prev.length + 1 },
    ])
  }

  const removePotongan = (idx: number) => {
    setPotonganList((prev) => prev.filter((_, i) => i !== idx))
  }

  const updatePenerima = (guruId: number, patch: Partial<PenerimaRow>) => {
    setPenerimaList((prev) =>
      prev.map((p) => (p.guru_id === guruId ? { ...p, ...patch } : p))
    )
  }

  const ensurePenerima = (guruId: number) => {
    if (!penerimaList.some((p) => p.guru_id === guruId)) {
      setPenerimaList((prev) => [
        ...prev,
        {
          guru_id: guruId,
          aktif: true,
          status: 'guru_mengajar',
          tunjangan_jabatan: 0,
          tunjangan_masa_kerja: 0,
          pembina: 0,
          wali_kelas: false,
          infaq_nominal: 0,
        },
      ])
    }
  }

  // =====================================================================
  // TAB REKAP — TUGAS TAMBAHAN
  // =====================================================================
  const reloadTugas = async () => {
    const { data } = await supabase
      .from('honorarium_tugas_tambahan')
      .select('*')
      .eq('periode', periode)
      .order('tanggal')
    if (data) setTugasList(data)
  }

  const toggleTugasGuru = (guruId: number) => {
    setTugasGuruIds((prev) =>
      prev.includes(guruId) ? prev.filter((g) => g !== guruId) : [...prev, guruId]
    )
  }

  const handleTugasSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!tugasTanggal || !tugasKegiatan.trim()) {
      showToast('err', 'Lengkapi Tanggal dan Nama Kegiatan terlebih dahulu.')
      return
    }
    setSaving(true)
    try {
      const { error } = await supabase.rpc('honorarium_save_tugas', {
        p_periode: periode,
        p_tanggal: tugasTanggal,
        p_nama_kegiatan: tugasKegiatan.trim(),
        p_guru_ids: tugasGuruIds,
        p_nominal: n(tugasNominal),
      })
      if (error) throw error
      setShowTugasModal(false)
      setTugasTanggal('')
      setTugasKegiatan('')
      setTugasGuruIds([])
      setTugasNominal(0)
      await reloadTugas()
      showToast('ok', 'Tugas tambahan berhasil dicatat.')
      await logAudit('rekap', 'Mencatat Tugas Tambahan')
    } catch (e: any) {
      showToast('err', 'Gagal mencatat tugas: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteTugas = async (id: string) => {
    if (!confirm('Hapus catatan tugas tambahan ini?')) return
    const { error } = await supabase.rpc('honorarium_delete_tugas', { p_id: id })
    if (!error) {
      await reloadTugas()
      showToast('ok', 'Tugas tambahan dihapus.')
      await logAudit('rekap', 'Menghapus Tugas Tambahan')
    } else {
      showToast('err', error.message)
    }
  }

  // =====================================================================
  // TAB RIWAYAT PEMBAYARAN GAJI
  // =====================================================================
  const loadRiwayat = useCallback(async (periode?: string) => {
    const { data } = await supabase
      .from('honorarium_rekap')
      .select('periode')
      .eq('status', 'PAID')
    const periods = Array.from(new Set((data || []).map((r) => r.periode))).sort().reverse()
    setRiwayatPeriods(periods)
    const diminta = periode ?? riwayatPeriode
    const defaultP =
      diminta && periods.includes(diminta)
        ? diminta
        : periods[0] || ''
    setRiwayatPeriode(defaultP)

    if (defaultP) {
      let q = supabase.from('honorarium_rekap').select('*').eq('periode', defaultP).eq('status', 'PAID')
      if (!showFullRekap && currentGuruId) q = q.eq('guru_id', currentGuruId)
      const { data: rows } = await q
      setRiwayatList(rows || [])
    } else {
      setRiwayatList([])
    }
  }, [riwayatPeriode, showFullRekap, currentGuruId])

  useEffect(() => {
    if (activeTab === 'riwayat') loadRiwayat()
    loadAuditLogs(activeTab)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab])

  const guruNama = (guruId: number) => guruById(guruId)?.nama_lengkap || '-'

  // =====================================================================
  // TOAST + HELPER EDIT REKAP
  // =====================================================================
  const showToast = (tipe: 'ok' | 'err', pesan: string) => {
    setToast({ tipe, pesan })
    window.setTimeout(() => setToast(null), 4000)
  }

  // =====================================================================
  // LOG AKTIVITAS EDIT (5 CATATAN TERBARU PER KATEGORI/TAB)
  // =====================================================================
  const loadAuditLogs = useCallback(async (kategori: string) => {
    const { data } = await supabase
      .from('honorarium_audit_log')
      .select('id, kategori, nama_lengkap, aksi, created_at')
      .eq('kategori', kategori)
      .order('created_at', { ascending: false })
      .limit(5)
    setAuditLogs(data || [])
  }, [])

  const logAudit = async (kategori: string, aksi: string) => {
    try {
      await supabase.rpc('honorarium_log_audit', { p_kategori: kategori, p_aksi: aksi })
      if (activeTab === kategori) await loadAuditLogs(kategori)
    } catch {
      /* non-blocking: jangan gagalkan aksi utama saat log gagal */
    }
  }

  const updateRekapRow = (guruId: number, patch: Partial<RekapRow>) => {
    setRekapList((prev) =>
      prev.map((r) => (r.guru_id === guruId ? computeTotalsRow({ ...r, ...patch }) : r))
    )
  }

  // =====================================================================
  // KONFIRMASI SUDAH DIBAYARKAN (kunci permanen PAID)
  // =====================================================================
  const handleApprove = async () => {
    if (!isKepalaSekolah) return showToast('err', 'Hanya Kepala Sekolah yang dapat menyetujui.')
    if (!canKirimKepsek) return showToast('err', 'Rekap baru dapat disahkan Kepala Sekolah mulai tanggal 27 bulan periode.')
    if (isPaidPeriode) return showToast('err', 'Periode sudah dibayar & terkunci.')
    if (stageKepsek) return showToast('err', 'Periode ini sudah disetujui Kepala Sekolah.')
    if (rekapRows.length === 0) return showToast('err', 'Tidak ada data penerima untuk periode ini.')
    if (!confirm('Setujui honorarium bulan ini sebagai KEPALA SEKOLAH?')) return
    setSaving(true)
    try {
      const nowIso = new Date().toISOString()
      const { error } = await supabase.rpc('honorarium_approve_kepsek', { p_periode: periode })
      if (error) throw error
      setRekapList((prev) =>
        prev.map((r) =>
          r.periode === periode
            ? { ...r, confirmed_by: currentName, confirmed_at: nowIso, disahkan_kepsek_by: currentName, disahkan_kepsek_at: nowIso, alur: 'yayasan' }
            : r
        )
      )
      showToast('ok', 'Rekap disetujui Kepala Sekolah. Terkirim ke Yayasan.')
      await logAudit('riwayat', 'Disetujui Kepala Sekolah')
    } catch (e: any) {
      showToast('err', 'Gagal setujui: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  const handleApproveYayasan = async () => {
    if (!isYayasan) return showToast('err', 'Hanya Yayasan yang dapat menyetujui tahap ini.')
    if (isPaidPeriode) return showToast('err', 'Periode sudah dibayar & terkunci.')
    if (!stageKepsek) return showToast('err', 'Belum disetujui Kepala Sekolah.')
    if (stageYayasan) return showToast('err', 'Periode ini sudah disetujui Yayasan.')
    if (!confirm('Setujui honorarium bulan ini sebagai YAYASAN?')) return
    setSaving(true)
    try {
      const nowIso = new Date().toISOString()
      const { error } = await supabase.rpc('honorarium_approve_yayasan', { p_periode: periode })
      if (error) throw error
      setRekapList((prev) =>
        prev.map((r) =>
          r.periode === periode
            ? { ...r, disahkan_yayasan_by: currentName, disahkan_yayasan_at: nowIso, alur: 'bendahara' }
            : r
        )
      )
      showToast('ok', 'Rekap disetujui Yayasan. Terkirim ke Bendahara.')
      await logAudit('riwayat', 'Disetujui Yayasan')
    } catch (e: any) {
      showToast('err', 'Gagal setujui Yayasan: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  const handlePay = async () => {
    if (!isBendahara) return showToast('err', 'Hanya Bendahara yang dapat menandai dibayar.')
    if (isPaidPeriode) return showToast('err', 'Periode sudah dibayar & terkunci.')
    if (!stageYayasan) return showToast('err', 'Belum disetujui Yayasan.')
    if (!confirm('Konfirmasi pembayaran honorarium bulan ini sebagai BENDAHARA? Data akan terkunci (PAID).')) return
    setSaving(true)
    try {
      const nowIso = new Date().toISOString()
      const { error } = await supabase.rpc('honorarium_pay_bendahara', { p_periode: periode })
      if (error) throw error
      setRekapList((prev) =>
        prev.map((r) => (r.periode === periode ? { ...r, status: 'PAID', alur: 'selesai' } : r))
      )
      showToast('ok', 'Pembayaran dikonfirmasi Bendahara. Periode terkunci (PAID).')
      await logAudit('riwayat', 'Dibayar Bendahara')
    } catch (e: any) {
      showToast('err', 'Gagal bayar: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  // =====================================================================
  // SIMPAN MASTER (tarif + potongan + penerima)
  // =====================================================================
  const handleSaveMaster = async () => {
    setSaving(true)
    try {
      const nowIso = new Date().toISOString()

      const pengPayload = {
        id: pengaturan?.id || crypto.randomUUID(),
        tarif_jp: n(pengaturan?.tarif_jp),
        tarif_transport_harian: n(pengaturan?.tarif_transport_harian),
        tarif_piket: n(pengaturan?.tarif_piket),
        tunjangan_wali_kelas: n(pengaturan?.tunjangan_wali_kelas),
        updated_by: currentName,
        updated_at: nowIso,
      }
      const potPayload = potonganList.map((p) => ({
        id: p.id || crypto.randomUUID(),
        nama: p.nama,
        aktif: p.aktif,
        tipe: p.tipe,
        nilai: n(p.nilai),
        urutan: n(p.urutan),
        updated_by: currentName,
        updated_at: nowIso,
      }))
      const penPayload = penerimaList.map((p) => ({
        id: p.id || crypto.randomUUID(),
        guru_id: p.guru_id,
        aktif: p.aktif,
        status: p.status,
        tunjangan_jabatan: n(p.tunjangan_jabatan),
        tunjangan_masa_kerja: n(p.tunjangan_masa_kerja),
        pembina: n(p.pembina),
        wali_kelas: p.wali_kelas,
        infaq_nominal: n(p.infaq_nominal),
        updated_by: currentName,
        updated_at: nowIso,
      }))

      const { error: eSave } = await supabase.rpc('honorarium_save_master', {
        p_pengaturan: [pengPayload],
        p_potongan: potPayload,
        p_penerima: penPayload,
      })

      if (eSave) throw eSave
      showToast('ok', 'Pengaturan Master (Tarif, Potongan, Penerima) berhasil disimpan.')

      // Log rincian spesifik: bandingkan nilai lama vs nilai baru
      const parts: string[] = []
      const oldPeng = prevPengaturanRef.current
      if (oldPeng) {
        diffRupiah(parts, 'Tarif JP', oldPeng.tarif_jp, pengPayload.tarif_jp)
        diffRupiah(parts, 'Tarif Transport Harian', oldPeng.tarif_transport_harian, pengPayload.tarif_transport_harian)
        diffRupiah(parts, 'Tarif Piket', oldPeng.tarif_piket, pengPayload.tarif_piket)
        diffRupiah(parts, 'Tunjangan Wali Kelas', oldPeng.tunjangan_wali_kelas, pengPayload.tunjangan_wali_kelas)
      }
      prevPotonganRef.current.forEach((op) => {
        const np = potonganList.find((p) => p.id === op.id || p.nama === op.nama)
        if (!np) {
          parts.push(`Hapus Potongan "${op.nama}"`)
        } else {
          if (op.nama !== np.nama) parts.push(`Ubah Nama Potongan "${op.nama}" → "${np.nama}"`)
          diffRupiah(parts, `Potongan ${np.nama}: Nilai`, op.nilai, np.nilai)
          if (op.tipe !== np.tipe) parts.push(`Potongan ${np.nama}: Tipe (${op.tipe} → ${np.tipe})`)
          if (op.aktif !== np.aktif) parts.push(`Potongan ${np.nama}: Aktif (${op.aktif ? 'YA' : 'TIDAK'} → ${np.aktif ? 'YA' : 'TIDAK'})`)
        }
      })
      potonganList.forEach((np) => {
        if (!prevPotonganRef.current.some((p) => p.id === np.id || p.nama === np.nama)) {
          parts.push(`Tambah Potongan "${np.nama}" (${np.tipe === 'persen' ? np.nilai + '%' : formatRupiah(np.nilai)})`)
        }
      })
      prevPenerimaRef.current.forEach((op) => {
        const np = penerimaList.find((p) => p.guru_id === op.guru_id)
        if (!np) {
          parts.push(`Hapus Penerima ${guruNama(op.guru_id)}`)
        } else {
          const gm = guruNama(op.guru_id)
          diffRupiah(parts, `${gm}: Tunjangan Jabatan`, op.tunjangan_jabatan, np.tunjangan_jabatan)
          diffRupiah(parts, `${gm}: Tunjangan Masa Kerja`, op.tunjangan_masa_kerja, np.tunjangan_masa_kerja)
          diffRupiah(parts, `${gm}: Pembina`, op.pembina, np.pembina)
          diffRupiah(parts, `${gm}: Infaq`, op.infaq_nominal, np.infaq_nominal)
          if (op.wali_kelas !== np.wali_kelas) parts.push(`${gm}: Wali Kelas (${op.wali_kelas ? 'YA' : 'TIDAK'} → ${np.wali_kelas ? 'YA' : 'TIDAK'})`)
          if (op.status !== np.status) parts.push(`${gm}: Status (${op.status} → ${np.status})`)
          if (op.aktif !== np.aktif) parts.push(`${gm}: Aktif (${op.aktif ? 'YA' : 'TIDAK'} → ${np.aktif ? 'YA' : 'TIDAK'})`)
        }
      })
      const aksi = parts.length
        ? 'Mengubah ' + parts.slice(0, 10).join(', ')
        : 'Menyimpan Master Tarif (tanpa perubahan nilai)'
      await logAudit('master', aksi)

      // Perbarui baseline untuk log berikutnya
      prevPengaturanRef.current = pengPayload
      prevPotonganRef.current = potonganList
      prevPenerimaRef.current = penerimaList
    } catch (e: any) {
      showToast('err', 'Gagal menyimpan Master: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  const bulanLabel = BLN_NAMES[Number(periodeBulan) - 1] || periodeBulan
  // Rekap yang dipakai untuk tampilan & cetak: nama penerima SELALU diselesaikan
  // dari master guru via guru_id, sehingga slip/daftar tidak pernah menampilkan
  // nama yang basi/keliru (mis. selalu nama pengurus) walau state baris berubah.
  const rekapRows = rekapList
    .filter((r) => r.periode === periode)
    .map((r) => {
      const guru = guruById(r.guru_id)
      if (!guru && process.env.NODE_ENV !== 'production') {
        console.warn(`Honorarium: guru_id ${r.guru_id} tidak ditemukan di master guru.`)
      }
      return { ...r, guru_nama: guru?.nama_lengkap || r.guru_nama || '' }
    })

  // Kolom Piket hanya tampil bila ada penerima dengan nominal piket > 0.
  const adaPiketRekap = rekapRows.some((r) => n(r.piket) > 0)

  // Baris yang dicetak pada slip tanda terima.
  // - Admin/Pengurus/Kepala Sekolah/Bendahara/Yayasan (showFullRekap): semua penerima
  //   (bisa dipersempit ke satu guru via tombol cetak per baris → slipGuruId).
  // - Guru biasa: HANYA slip miliknya sendiri (dicocokkan via guru_id / nama akun login),
  //   sehingga tidak pernah ikut merender slip guru lain.
  const slipRows = showFullRekap
    ? (slipGuruId != null ? rekapRows.filter((r) => r.guru_id === slipGuruId) : rekapRows)
    : rekapRows.filter((r) => {
        const matchId = currentGuruId != null && r.guru_id === currentGuruId
        const matchName =
          !!currentName.trim() &&
          String(r.guru_nama || '').trim().toLowerCase() === currentName.trim().toLowerCase()
        return matchId || matchName
      })
  const isPaidPeriode = rekapRows.some((r) => r.status === 'PAID')
  const stageKepsek = rekapRows[0]?.disahkan_kepsek_at || rekapRows[0]?.confirmed_at
  const stageYayasan = rekapRows[0]?.disahkan_yayasan_at
  const showKepsekTtd = !!stageKepsek
  const showYayasanTtd = !!stageYayasan
  const showBendaharaTtd = isPaidPeriode
  const statusPeriode = isPaidPeriode ? 'PAID' : stageYayasan ? 'DISAHKAN YAYASAN' : stageKepsek ? 'DISAHKAN KEPSEK' : 'DRAFT'
  const statusPeriodeCls = isPaidPeriode ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/40' : stageYayasan ? 'bg-violet-500/15 text-violet-400 border border-violet-500/40' : stageKepsek ? 'bg-sky-500/15 text-sky-400 border border-sky-500/40' : isDarkMode ? 'bg-slate-800 text-slate-300 border border-slate-700' : 'bg-slate-100 text-slate-600 border border-slate-300'
  const personalRow = rekapRows.find((r) => r.guru_id === currentGuruId)

  // Data grid kartu bulanan: 12 bulan pada tahun terpilih, dari rekap tersimpan.
  const kartuBulan: BulanCardData[] = useMemo(() => {
    return BLN_NAMES.map((label, i) => {
      const bln = String(i + 1).padStart(2, '0')
      const rows = rekapTahun.filter((r) => r.periode === `${periodeTahun}-${bln}`)
      const ada = rows.length > 0
      return {
        bulan: bln,
        label,
        status: statusDariRows(rows),
        totalJp: ada ? rows.reduce((a, r) => a + n(r.jumlah_jp), 0) : null,
        totalTransport: ada ? rows.reduce((a, r) => a + n(r.transport_hari), 0) : null,
        totalBersih: ada ? rows.reduce((a, r) => a + n(r.total_bersih), 0) : null,
        totalKotor: ada ? rows.reduce((a, r) => a + n(r.total_bersih) + n(r.total_potongan), 0) : null,
        jumlahGuru: rows.length,
      }
    })
  }, [rekapTahun, periodeTahun])

  // Transisi halus (React Spring) saat isi rekap berganti bulan.
  const [rekapSpring, rekapSpringApi] = useSpring(() => ({ opacity: 1, y: 0 }))
  useEffect(() => {
    rekapSpringApi.start({
      from: { opacity: 0, y: 14 },
      to: { opacity: 1, y: 0 },
      config: { tension: 300, friction: 26 },
    })
  }, [periode, rekapSpringApi])

  // Cetak slip tanda terima milik PEMILIK akun yang login saja (bukan slip guru
  // lain). Pencocokan via guru_id / nama_lengkap dari tabel guru untuk email akun
  // login. Jika email belum terdaftar di tabel guru atau tidak ada data honorarium,
  // tampilkan notifikasi dan batalkan cetak (fallback aman).
  const printOwnSlip = () => {
    if (!stageKepsek) return showToast('err', 'Cetak hanya bisa dilakukan setelah periode disetujui Kepala Sekolah.')
    const owner = rekapRows.find((r) =>
      (loginGuru?.id != null && r.guru_id === loginGuru.id) ||
      (!!loginGuru?.nama_lengkap &&
        String(r.guru_nama || '').trim().toLowerCase() === loginGuru.nama_lengkap.trim().toLowerCase())
    )
    if (!owner) {
      const em = (currentEmail || '').trim()
      return showToast(
        'err',
        `Data honorarium untuk email akun yang login (${em}) tidak ditemukan pada periode ${bulanLabel} ${periodeTahun}. Tidak ada slip yang dapat dicetak.`
      )
    }
    triggerPrint('slip', owner.guru_id)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0b0f19] text-slate-100 flex items-center justify-center">
        <div className="text-sm font-bold text-indigo-300 animate-pulse flex items-center gap-2">
          <Wallet className="w-5 h-5" /> Memuat data honorarium...
        </div>
      </div>
    )
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className={`min-h-screen font-sans flex flex-col transition-colors duration-300 print:hidden ${
          isDarkMode ? 'bg-[#0b0f19] text-slate-100' : 'bg-slate-200 text-slate-800'
        }`}
      >
      <div className={`fixed inset-0 pointer-events-none z-0 flex items-center justify-center select-none ${isDarkMode ? 'opacity-[0.04]' : 'opacity-[0.10]'}`}>
        <img src="/logo-smp.jpg" alt="" className="w-[520px] h-[520px] object-contain max-w-none" />
      </div>

      <div className="relative z-10 flex flex-col flex-1 w-full">
        <header className={`border-b px-3 py-2 flex items-center justify-between gap-2 shrink-0 ${isDarkMode ? 'bg-slate-900/95 border-slate-800' : 'bg-slate-100/95 border-slate-300'}`}>
          <div className="flex items-center gap-2.5">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${isDarkMode ? 'bg-slate-800 text-indigo-400' : 'bg-white text-indigo-700 border border-indigo-200'}`}>
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-sm font-extrabold leading-tight">HONORARIUM GURU &amp; STAF</h1>
              <p className={`text-[10px] font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                Rekap gabungan SMP &amp; SMK Muna Mustofa — {bulanLabel} {periodeTahun}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <DarkModeToggle />
            <span className={`hidden sm:flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg border ${isDarkMode ? 'bg-slate-800 border-slate-700 text-emerald-300' : 'bg-white border-slate-300 text-emerald-700'}`}>
              <ShieldCheck className="w-3.5 h-3.5" />
              {isPengurusUtama ? 'PENGURUS UTAMA' : isOperator ? 'OPERATOR · VIEW ONLY' : 'GURU / STAF'}
            </span>
            <Link href="/" className={`text-[10px] font-black px-2.5 py-1 rounded-lg border ${isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white' : 'bg-white border-slate-300 text-slate-700 hover:text-slate-950'}`}>
              ← Dashboard
            </Link>
          </div>
        </header>

        {/* FILTER BULAN & TAHUN - disembunyikan di tab Rekap (diganti grid kartu bulan) */}
        {activeTab !== 'rekap' && (
        <div className="px-3 pt-3 flex flex-wrap items-center gap-2">
          <div className={`flex items-center gap-1.5 border rounded-xl px-2.5 py-1.5 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-300'}`}>
            <CalendarDays className={`w-4 h-4 ${isDarkMode ? 'text-indigo-400' : 'text-indigo-700'}`} />
            <select
              value={periodeBulan}
              onChange={(e) => setPeriodeBulan(e.target.value)}
              className={`text-xs font-bold focus:outline-none cursor-pointer ${isDarkMode ? 'bg-slate-800 text-white border border-slate-700 rounded px-1.5 py-0.5' : 'bg-transparent text-slate-900'}`}
            >
              {BLN_NAMES.map((b, i) => (
                <option key={b} value={String(i + 1).padStart(2, '0')}>{b}</option>
              ))}
            </select>
            <select
              value={periodeTahun}
              onChange={(e) => setPeriodeTahun(e.target.value)}
              className={`text-xs font-bold focus:outline-none cursor-pointer ${isDarkMode ? 'bg-slate-800 text-white border border-slate-700 rounded px-1.5 py-0.5' : 'bg-transparent text-slate-900'}`}
            >
              {tahunOptions.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          {isPaidPeriode && (
            <span className="flex items-center gap-1 text-[10px] font-black px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/40 text-emerald-400">
              <CheckCircle2 className="w-3.5 h-3.5" /> TERKUNCI PAID
            </span>
          )}
        </div>
        )}

        {/* TAB SWITCHER */}
        <div className="px-3 pt-3">
          <div className={`grid ${isPengurusUtama ? 'grid-cols-3' : 'grid-cols-2'} p-0.5 rounded-xl border text-[11px] font-extrabold ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-300'}`}>
            {isPengurusUtama && (
              <button
                onClick={() => setActiveTab('master')}
                className={`py-2 rounded-lg flex items-center justify-center gap-1.5 transition cursor-pointer ${activeTab === 'master' ? 'bg-indigo-600 text-white' : isDarkMode ? 'text-slate-400' : 'text-slate-700'}`}
              >
                <Settings2 className="w-4 h-4" /> Master Penerima &amp; Tarif
              </button>
            )}
            <button
              onClick={() => setActiveTab('rekap')}
              className={`py-2 rounded-lg flex items-center justify-center gap-1.5 transition cursor-pointer ${activeTab === 'rekap' ? 'bg-indigo-600 text-white' : isDarkMode ? 'text-slate-400' : 'text-slate-700'}`}
            >
              <Banknote className="w-4 h-4" /> Rekap Honorarium
            </button>
            <button
              onClick={() => setActiveTab('riwayat')}
              className={`py-2 rounded-lg flex items-center justify-center gap-1.5 transition cursor-pointer ${activeTab === 'riwayat' ? 'bg-indigo-600 text-white' : isDarkMode ? 'text-slate-400' : 'text-slate-700'}`}
            >
              <FileCheck2 className="w-4 h-4" /> Riwayat Pembayaran
            </button>
          </div>
        </div>

        <main className="px-3 pb-28 pt-3 flex-1 w-full space-y-3">
          {activeTab === 'master' && isPengurusUtama && (
            <>
              <AuditLogBox logs={auditLogs} isDarkMode={isDarkMode} />
              {/* TARIF GLOBAL */}
              <div className={`border rounded-2xl p-4 space-y-3 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-300'}`}>
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-extrabold flex items-center gap-1.5 text-indigo-400">
                    <Landmark className="w-4 h-4" /> Tarif Global
                  </h3>
                  <button
                    onClick={handleSaveMaster}
                    disabled={saving}
                    className="text-[10px] font-black px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-40 cursor-pointer"
                  >
                    <Save className="w-3.5 h-3.5 inline-block align-middle mr-1" /> Simpan Master
                  </button>
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                  {([
                    ['tarif_jp', 'Tarif per Jam Pelajaran (JP)'],
                    ['tarif_transport_harian', 'Tarif Transport Harian'],
                    ['tarif_piket', 'Tarif Piket'],
                    ['tunjangan_wali_kelas', 'Tunjangan Wali Kelas'],
                  ] as [keyof PengaturanRow, string][]).map(([key, label]) => (
                    <label key={key} className="flex flex-col gap-1">
                      <span className={`text-[10px] font-bold ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>{label}</span>
                      <input
                        type="number"
                        value={n(pengaturan?.[key])}
                        onChange={(e) => setPengaturanField(key, Number(e.target.value))}
                        className={`border rounded-lg px-2 py-1.5 text-sm font-bold focus:outline-none ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'}`}
                      />
                    </label>
                  ))}
                </div>
                {pengaturan?.updated_by && (
                  <p className={`text-[9px] font-medium ${isDarkMode ? 'text-slate-500' : 'text-slate-500'}`}>
                    <Info className="w-3 h-3 inline-block align-middle mr-1" />
                    Terakhir diubah oleh {pengaturan.updated_by} · {formatTanggal(pengaturan.updated_at)}
                  </p>
                )}
              </div>

              <div className={`border rounded-2xl p-4 space-y-3 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-300'}`}>
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-extrabold flex items-center gap-1.5 text-indigo-400">
                    <Settings2 className="w-4 h-4" /> Manajemen Potongan Dinamis
                  </h3>
                  <button onClick={addPotongan} className="text-[10px] font-black px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-white cursor-pointer">
                    <Plus className="w-3.5 h-3.5 inline-block align-middle mr-1" /> Tambah Potongan
                  </button>
                </div>
                <div className="space-y-2">
                  {potonganList.map((p, idx) => (
                    <div key={idx} className={`flex flex-wrap items-center gap-2 border rounded-xl p-2 ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                      <button
                        onClick={() => updatePotongan(idx, { aktif: !p.aktif })}
                        className={`relative w-10 h-5 rounded-full transition ${p.aktif ? 'bg-emerald-500' : 'bg-slate-500'}`}
                        title={p.aktif ? 'Aktif' : 'Nonaktif'}
                      >
                        <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${p.aktif ? 'left-5' : 'left-0.5'}`} />
                      </button>
                      <input value={p.nama} onChange={(e) => updatePotongan(idx, { nama: e.target.value })} placeholder="Nama potongan"
                        className={`flex-1 min-w-[120px] border rounded-lg px-2 py-1 text-xs font-bold focus:outline-none ${isDarkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'}`} />
                      <select value={p.tipe} onChange={(e) => updatePotongan(idx, { tipe: e.target.value as 'nominal' | 'persen' })}
                        className={`border rounded-lg px-2 py-1 text-[11px] font-bold focus:outline-none ${isDarkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'}`}>
                        <option value="nominal">Nominal Tetap</option>
                        <option value="persen">Persentase %</option>
                      </select>
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] font-black">{p.tipe === 'persen' ? '%' : 'Rp'}</span>
                        <input type="number" value={n(p.nilai)} onChange={(e) => updatePotongan(idx, { nilai: Number(e.target.value) })}
                          className={`w-24 border rounded-lg px-2 py-1 text-xs font-bold focus:outline-none ${isDarkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'}`} />
                      </div>
                      <button onClick={() => removePotongan(idx)} className="text-rose-400 hover:text-rose-300 cursor-pointer" title="Hapus">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  {potonganList.length === 0 && (
                    <p className={`text-xs font-medium ${isDarkMode ? 'text-slate-500' : 'text-slate-500'}`}>Belum ada jenis potongan.</p>
                  )}
                </div>
              </div>

              <div className={`border rounded-2xl p-4 space-y-3 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-300'}`}>
                <h3 className="text-xs font-extrabold flex items-center gap-1.5 text-indigo-400">
                  <Users className="w-4 h-4" /> Daftar Penerima Honorarium ({guruList.length})
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-[11px] min-w-[760px]">
                    <thead>
                      <tr className={`text-[9px] uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                        <th className="p-1.5">Aktif</th>
                        <th className="p-1.5">Nama</th>
                        <th className="p-1.5">Status</th>
                        <th className="p-1.5">Tunjangan Jabatan</th>
                        <th className="p-1.5">Masa Kerja</th>
                        <th className="p-1.5">Pembina</th>
                        <th className="p-1.5">Wali Kelas</th>
                        <th className="p-1.5">Infaq</th>
                      </tr>
                    </thead>
                    <tbody>

                      {guruList.map((g) => {
                        const p = penerimaList.find((x) => x.guru_id === g.id)
                        if (!p) {
                          return (
                            <tr key={g.id} className={`border-t ${isDarkMode ? 'border-slate-800' : 'border-slate-200'}`}>
                              <td className="p-1.5">
                                <button onClick={() => ensurePenerima(g.id)} className="text-[9px] font-black px-2 py-1 rounded bg-indigo-600 text-white cursor-pointer">
                                  <Plus className="w-3 h-3 inline-block align-middle" /> Tambah
                                </button>
                              </td>
                              <td className="p-1.5 font-bold">{g.nama_lengkap}</td>
                              <td className="p-1.5 text-slate-500">Belum diatur</td>
                              <td className="p-1.5" colSpan={4}></td>
                            </tr>
                          )
                        }
                        return (
                          <tr key={g.id} className={`border-t ${isDarkMode ? 'border-slate-800' : 'border-slate-200'}`}>
                            <td className="p-1.5">
                              <button onClick={() => updatePenerima(g.id, { aktif: !p.aktif })}
                                className={`relative w-9 h-4.5 rounded-full transition ${p.aktif ? 'bg-emerald-500' : 'bg-slate-500'}`}>
                                <span className={`absolute top-0.5 w-3.5 h-3.5 bg-white rounded-full transition-all ${p.aktif ? 'left-4.5' : 'left-0.5'}`} />
                              </button>
                            </td>
                            <td className="p-1.5 font-bold">{g.nama_lengkap}</td>
                            <td className="p-1.5">
                              <select value={p.status} onChange={(e) => updatePenerima(g.id, { status: e.target.value as 'guru_mengajar' | 'staf_piket' })}
                                className={`border rounded px-1.5 py-0.5 text-[10px] font-bold focus:outline-none ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'}`}>
                                <option value="guru_mengajar">Guru Mengajar</option>
                                <option value="staf_piket">Staf/Piket Saja</option>
                              </select>
                            </td>
                            <td className="p-1.5"><input type="number" value={n(p.tunjangan_jabatan)} onChange={(e) => updatePenerima(g.id, { tunjangan_jabatan: Number(e.target.value) })}
                              className={`w-24 border rounded px-1.5 py-0.5 text-[10px] font-bold focus:outline-none ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'}`} /></td>
                            <td className="p-1.5"><input type="number" value={n(p.tunjangan_masa_kerja)} onChange={(e) => updatePenerima(g.id, { tunjangan_masa_kerja: Number(e.target.value) })}
                              className={`w-20 border rounded px-1.5 py-0.5 text-[10px] font-bold focus:outline-none ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'}`} /></td>
                            <td className="p-1.5"><input type="number" value={n(p.pembina)} onChange={(e) => updatePenerima(g.id, { pembina: Number(e.target.value) })}
                              className={`w-20 border rounded px-1.5 py-0.5 text-[10px] font-bold focus:outline-none ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'}`} /></td>
                            <td className="p-1.5 text-center">
                              <button onClick={() => updatePenerima(g.id, { wali_kelas: !p.wali_kelas })}
                                className={`w-8 h-5 rounded-md text-[9px] font-black border cursor-pointer ${p.wali_kelas ? 'bg-emerald-500 text-white border-emerald-500' : isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-400' : 'bg-slate-100 border-slate-300 text-slate-500'}`}>
                                {p.wali_kelas ? 'YA' : 'TIDAK'}
                              </button>
                            </td>
                            <td className="p-1.5"><input type="number" value={n(p.infaq_nominal)} onChange={(e) => updatePenerima(g.id, { infaq_nominal: Number(e.target.value) })}
                              className={`w-24 border rounded px-1.5 py-0.5 text-[10px] font-bold focus:outline-none ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'}`} /></td>
                          </tr>

                        )
                      })}

                    </tbody>
                  </table>
                </div>
              </div>

              <p className={`text-[9px] font-medium ${isDarkMode ? 'text-slate-500' : 'text-slate-500'}`}>
                <Info className="w-3 h-3 inline-block align-middle mr-1" />
                Klik "Simpan Master" di kartu Tarif Global untuk menyimpan seluruh perubahan di tab ini.
              </p>
            </>
          )}

          {activeTab === 'rekap' && (
            <>
              {/* GRID KARTU BULANAN (gaya Info GTK) - menggantikan dropdown bulan */}
              <HonorBulanCards
                tahun={periodeTahun}
                tahunOptions={tahunOptions}
                onTahunChange={(t) => setPeriodeTahun(t)}
                cards={kartuBulan}
                selectedBulan={periodeBulan}
                onSelect={(b) => setPeriodeBulan(b)}
                isDarkMode={isDarkMode}
                isPersonal={!showFullRekap}
              />
              <animated.div style={rekapSpring} className="space-y-3">
              {isPengurusUtama && (
                <AuditLogBox logs={auditLogs} isDarkMode={isDarkMode} />
              )}

              {(isKepalaSekolah || isBendahara || isYayasan) && (
                <div className={`border rounded-2xl p-4 space-y-3 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-300'}`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-xs font-extrabold text-indigo-400">Alur Persetujuan — {bulanLabel} {periodeTahun}</h3>
                    <span className={`text-[10px] font-black px-2 py-1 rounded-full ${statusPeriodeCls}`}>
                      {statusPeriode}
                    </span>
                  </div>

                  {/* STEPPER ALUR PERSETUJUAN */}
                  <div className="flex items-center gap-1 overflow-x-auto pb-1">
                    {[
                      { label: 'Pengurus', done: true },
                      { label: 'Kepala Sekolah', done: !!stageKepsek },
                      { label: 'Yayasan', done: !!stageYayasan },
                      { label: 'Bendahara / PAID', done: isPaidPeriode },
                    ].map((s, i, arr) => {
                      const isActive = !s.done && (i === 0 ? true : arr[i - 1].done)
                      return (
                        <div key={s.label} className="flex items-center gap-1 shrink-0">
                          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[9px] font-black ${
                            s.done
                              ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400'
                              : isActive
                                ? 'bg-amber-500/15 border-amber-500/40 text-amber-400 animate-pulse'
                                : isDarkMode
                                  ? 'bg-slate-800 border-slate-700 text-slate-500'
                                  : 'bg-slate-100 border-slate-300 text-slate-500'
                          }`}>
                            {s.done ? <CheckCircle2 className="w-3 h-3" /> : <span className="w-1.5 h-1.5 rounded-full bg-current" />}
                            {s.label}
                          </div>
                          {i < arr.length - 1 && <div className={`h-px w-3 ${isDarkMode ? 'bg-slate-700' : 'bg-slate-300'}`} />}
                        </div>
                      )
                    })}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {[
                      ['Total Honor', formatRupiah(rekapRows.reduce((a, r) => a + n(r.total_bersih), 0))],
                      ['Total JP', String(rekapRows.reduce((a, r) => a + n(r.jumlah_jp), 0))],
                      ['Total Transport', String(rekapRows.reduce((a, r) => a + n(r.transport_hari), 0)) + ' hari'],
                      ['Jml Guru', String(rekapRows.length)],
                    ].map(([label, val]) => (
                      <div key={label} className={`rounded-lg border px-3 py-2 ${isDarkMode ? 'bg-slate-800/60 border-slate-700' : 'bg-white/60 border-slate-200'}`}>
                        <div className={`text-[9px] uppercase font-black ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{label}</div>
                        <div className={`text-sm font-black ${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>{val}</div>
                      </div>
                    ))}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-800/60">
                    {!showKepsekTtd && !showBendaharaTtd && isKepalaSekolah && (
                      <>
                        <button onClick={handleApprove} disabled={saving || !canKirimKepsek}
                          className="inline-flex items-center gap-1.5 text-[11px] font-black px-4 py-2.5 rounded-full bg-gradient-to-r from-sky-500 to-indigo-600 hover:brightness-110 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-lg shadow-indigo-500/30 text-white cursor-pointer">
                          <CheckCircle2 className="w-4 h-4" /> Setujui (Disahkan)
                        </button>
                        {!canKirimKepsek && (
                          <span className="inline-flex items-center gap-1 text-[9px] font-bold text-amber-400">
                            <Lock className="w-3 h-3" /> Tersedia mulai tanggal 27 bulan periode
                          </span>
                        )}
                      </>
                    )}
                    {showKepsekTtd && !showYayasanTtd && !showBendaharaTtd && isYayasan && (
                      <button onClick={handleApproveYayasan} disabled={saving}
                        className="inline-flex items-center gap-1.5 text-[11px] font-black px-4 py-2.5 rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-600 hover:brightness-110 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-lg shadow-violet-500/30 text-white cursor-pointer">
                        <BadgeCheck className="w-4 h-4" /> Setujui Yayasan
                      </button>
                    )}
                    {showYayasanTtd && !showBendaharaTtd && isBendahara && (
                      <button onClick={handlePay} disabled={saving}
                        className="inline-flex items-center gap-1.5 text-[11px] font-black px-4 py-2.5 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 hover:brightness-110 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-lg shadow-amber-500/30 text-slate-950 cursor-pointer">
                        <Landmark className="w-4 h-4" /> Tandai Dibayar
                      </button>
                    )}
                    {!showBendaharaTtd && (
                      <span className={`text-[9px] font-bold ml-auto ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                        {!showKepsekTtd ? '• Menunggu Kepala Sekolah' : !showYayasanTtd ? `• Disahkan K.S. ${rekapRows[0]?.disahkan_kepsek_by || rekapRows[0]?.confirmed_by || '-'} ${formatTanggal(rekapRows[0]?.disahkan_kepsek_at || rekapRows[0]?.confirmed_at)}` : `• Disahkan Yayasan ${rekapRows[0]?.disahkan_yayasan_by || '-'} ${formatTanggal(rekapRows[0]?.disahkan_yayasan_at)}`}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {showFullRekap && (
                <>
                  {/* AKSI INPUT & REKAP (disembunyikan untuk Kepala Sekolah & Bendahara) */}
                  {!isKepalaSekolah && !isBendahara && (
                  <div className={`border rounded-2xl p-3 flex flex-wrap items-center gap-2 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-300'}`}>
                    <button onClick={() => setShowTugasModal(true)} disabled={isPaidPeriode || !canManageRekap}
                      className="text-[10px] font-black px-3 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white disabled:opacity-40 cursor-pointer">
                      <Plus className="w-3.5 h-3.5 inline-block align-middle mr-1" /> Catat Tugas Tambahan
                    </button>
                    <Link
                      href="/absensi?tab=guru"
                      className="inline-flex items-center text-[10px] font-black px-3 py-2 rounded-lg bg-teal-700 hover:bg-teal-600 text-white cursor-pointer"
                    >
                      <CalendarDays className="w-3.5 h-3.5 inline-block align-middle mr-1" /> Buka Absensi Guru
                    </Link>
                    <button onClick={handleAutoCalc} disabled={saving || isPaidPeriode || !!stageYayasan || (!canManageRekap && !(isYayasan && !!stageKepsek))}
                      className="text-[10px] font-black px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-40 cursor-pointer">
                      <RefreshCw className={`w-3.5 h-3.5 inline-block align-middle mr-1 ${saving ? 'animate-spin' : ''}`} /> Tarik &amp; Hitung Otomatis
                    </button>
                    <span className={`text-[10px] font-bold ${isDarkMode ? 'text-indigo-300' : 'text-indigo-700'}`}>
                      {jurnalSahCount > 0 ? `${jurnalSahCount} entri jurnal sah ditarik` : 'Belum ada penarikan jurnal'}
                    </span>
                    <button onClick={handleSaveRekap} disabled={saving || isPaidPeriode || !!stageYayasan || (!canManageRekap && !(isYayasan && !!stageKepsek))}
                      className="text-[10px] font-black px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-40 cursor-pointer">
                      <Save className="w-3.5 h-3.5 inline-block align-middle mr-1" /> Simpan Rekap
                    </button>

                    {isPaidPeriode && (
                      <span className="text-[10px] font-black px-2.5 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 ml-auto">
                        <BadgeCheck className="w-3.5 h-3.5 inline-block align-middle mr-1" /> PERIODE TERKUNCI (PAID)
                      </span>
                    )}
                  </div>
                  )}

                  {/* CETAK DOKUMEN RESMI */}
                  <div className={`border rounded-2xl p-3 flex flex-wrap items-center gap-2 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-300'}`}>
                    <span className={`text-[10px] font-black ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>Ukuran Kertas:</span>
                    <select value={paperSize} onChange={(e) => setPaperSize(e.target.value as 'f4' | 'a4')}
                      className={`border rounded-lg px-2 py-1 text-xs font-bold focus:outline-none ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'}`}>
                      <option value="f4">F4 / Folio Landscape (330×215mm)</option>
                      <option value="a4">A4 Landscape (297×210mm)</option>
                    </select>
                    <button onClick={() => { if (!stageKepsek) return showToast('err', 'Cetak hanya bisa dilakukan setelah periode disetujui Kepala Sekolah.'); triggerPrint('daftar') }}
                      className="text-[10px] font-black px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white cursor-pointer">
                      <FileCheck2 className="w-3.5 h-3.5 inline-block align-middle mr-1" /> Cetak Daftar Honorarium (PDF)
                    </button>
                    <button onClick={printOwnSlip}
                      className="text-[10px] font-black px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white cursor-pointer">
                      <Landmark className="w-3.5 h-3.5 inline-block align-middle mr-1" /> Cetak Slip Tanda Terima
                    </button>
                  </div>

                  <div className={`border rounded-2xl p-4 space-y-3 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-300'}`}>
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-extrabold flex items-center gap-1.5 text-indigo-400">
                        <Banknote className="w-4 h-4" /> Rekap Honorarium {bulanLabel} {periodeTahun}
                      </h3>
                      <span className={`text-[10px] font-black px-2 py-1 rounded-lg ${statusPeriodeCls}`}>
                        {statusPeriode}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {[
                        ['Total Honor', formatRupiah(rekapRows.reduce((a, r) => a + n(r.total_bersih), 0))],
                        ['Total JP', String(rekapRows.reduce((a, r) => a + n(r.jumlah_jp), 0))],
                        ['Total Transport', String(rekapRows.reduce((a, r) => a + n(r.transport_hari), 0)) + ' hari'],
                        ['Jml Guru', String(rekapRows.length)],
                      ].map(([label, val]) => (
                        <div key={label} className={`rounded-lg border px-3 py-2 ${isDarkMode ? 'bg-slate-800/60 border-slate-700' : 'bg-white/60 border-slate-200'}`}>
                          <div className={`text-[9px] uppercase font-black ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{label}</div>
                          <div className={`text-sm font-black ${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>{val}</div>
                        </div>
                      ))}
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-[11px] min-w-[1100px]">
                        <thead>
                          <tr className={`text-[9px] uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                            <th className="p-1.5">Nama</th>
                            <th className="p-1.5 text-center">JP</th>
                            <th className="p-1.5 text-center">Transport<br/>(Hari)</th>
                            <th className="p-1.5">Tunj. Jabatan</th>
                            <th className="p-1.5">Masa Kerja</th>
                            <th className="p-1.5">Pembina</th>
                            <th className="p-1.5">Wali Kelas</th>
                            <th className="p-1.5">Tugas Tambahan</th>
                            {adaPiketRekap && <th className="p-1.5">Piket</th>}
                            <th className="p-1.5">Potongan</th>
                            <th className="p-1.5 text-right">Total Potongan</th>
                            <th className="p-1.5 text-right">Total Bersih</th>
                            <th className="p-1.5 text-center">Status</th>
                          </tr>
                        </thead>
                        <tbody>

                          {rekapRows.length === 0 && (
                            <tr>
                              <td colSpan={12} className="p-4 text-center text-xs font-medium text-slate-500">
                                Belum ada penerima aktif. Atur di tab Master, lalu klik "Tarik &amp; Hitung Otomatis".
                              </td>
                            </tr>
                          )}
                          {rekapRows.map((r) => {
                            const disabled = isPaidPeriode || !!stageYayasan || (!canManageRekap && !(isYayasan && !!stageKepsek))
                            const cellCls = `w-20 border rounded px-1.5 py-0.5 text-[10px] font-bold focus:outline-none ${disabled ? 'opacity-50' : ''} ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'}`
                            const nama = r.guru_nama || guruNama(r.guru_id)
                            return (
                              <tr key={r.guru_id} className={`border-t ${isDarkMode ? 'border-slate-800' : 'border-slate-200'}`}>
                                <td className="p-1.5 font-bold whitespace-nowrap">
                                  <button onClick={() => setDetailGuruId(r.guru_id)}
                                    className="mr-1.5 align-middle text-[9px] font-black px-1.5 py-0.5 rounded border border-indigo-400 text-indigo-500 hover:bg-indigo-50 cursor-pointer">
                                    Detail
                                  </button>
                                  <button onClick={() => { if (!stageKepsek) return showToast('err', 'Cetak hanya bisa dilakukan setelah periode disetujui Kepala Sekolah.'); triggerPrint('slip', r.guru_id) }}
                                    className="mr-1.5 align-middle text-[9px] font-black px-1.5 py-0.5 rounded border border-emerald-400 text-emerald-500 hover:bg-emerald-50 cursor-pointer">
                                    Slip
                                  </button>
                                  {nama}
                                </td>
                                <td className="p-1.5 text-center">
                                  <div className="relative inline-block group">
                                    <input type="number" value={r.jumlah_jp} disabled={disabled}
                                      onChange={(e) => updateRekapRow(r.guru_id, { jumlah_jp: Number(e.target.value) })}
                                      className={cellCls} />
                                    {r.detailJp && r.detailJp.length > 0 && (
                                      <div className="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-full mb-1.5 z-40 hidden group-hover:block w-60 rounded-lg border border-white/10 bg-black/95 text-[9px] leading-relaxed text-slate-100 p-2 shadow-2xl text-left whitespace-pre-wrap">
                                        <div className="font-black text-emerald-400 mb-1">Rincian JP ditarik ({r.detailJp.length} hari, slot digabung)</div>
                                        {r.detailJp.map((d, i) => (
                                          <div key={i} className="flex justify-between gap-2 py-0.5 border-b border-white/5">
                                            <span className="font-bold">{formatTanggalSingkat(d.tanggal)}</span>
                                            <span className="flex-1 text-slate-300 truncate max-w-[160px]">Slot {d.jam || '-'}</span>
                                            <span className="font-black text-emerald-400">{d.jp} JP</span>
                                          </div>
                                        ))}
                                        <div className="font-black mt-1 text-right">Total: {r.jumlah_jp} JP</div>
                                      </div>
                                    )}
                                  </div>
                                </td>
                                <td className="p-1.5 text-center">
                                  <div className="relative inline-block group">
                                    <input type="number" value={r.transport_hari} disabled={disabled}
                                      onChange={(e) => updateRekapRow(r.guru_id, { transport_hari: Number(e.target.value) })}
                                      className={cellCls} />
                                    {r.detailTransport && r.detailTransport.length > 0 && (
                                      <div className="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-full mb-1.5 z-40 hidden group-hover:block w-52 rounded-lg border border-white/10 bg-black/95 text-[9px] leading-relaxed text-slate-100 p-2 shadow-2xl text-left">
                                        <div className="font-black text-emerald-400 mb-1">Tanggal hadir (mengajar + absensi guru)</div>
                                        {r.detailTransport.map((d, i) => (
                                          <div key={i} className="py-0.5 border-b border-white/5"><span className="font-bold">{formatTanggalSingkat(d)}</span></div>
                                        ))}
                                        <div className="font-black mt-1 text-right">Total: {r.transport_hari} hari</div>
                                      </div>
                                    )}
                                  </div>
                                </td>
                                <td className="p-1.5">
                                  <input type="number" value={r.tunjangan_jabatan} disabled={disabled}
                                    onChange={(e) => updateRekapRow(r.guru_id, { tunjangan_jabatan: Number(e.target.value) })}
                                    className={cellCls} />
                                </td>
                                <td className="p-1.5">
                                  <input type="number" value={r.tunjangan_masa_kerja} disabled={disabled}
                                    onChange={(e) => updateRekapRow(r.guru_id, { tunjangan_masa_kerja: Number(e.target.value) })}
                                    className={cellCls} />
                                </td>
                                <td className="p-1.5">
                                  <input type="number" value={r.pembina} disabled={disabled}
                                    onChange={(e) => updateRekapRow(r.guru_id, { pembina: Number(e.target.value) })}
                                    className={cellCls} />
                                </td>
                                <td className="p-1.5">
                                  <input type="number" value={r.wali_kelas} disabled={disabled}
                                    onChange={(e) => updateRekapRow(r.guru_id, { wali_kelas: Number(e.target.value) })}
                                    className={cellCls} />
                                </td>
                                <td className="p-1.5">
                                  <input type="number" value={r.tugas_tambahan} disabled={disabled}
                                    onChange={(e) => updateRekapRow(r.guru_id, { tugas_tambahan: Number(e.target.value) })}
                                    className={cellCls} />
                                </td>
                                {adaPiketRekap && (
                                  <td className="p-1.5 text-right font-bold">{formatRupiah(n(r.piket))}</td>
                                )}

                                <td className="p-1.5 max-w-[180px]">
                                  <div className="space-y-0.5 text-[9px]">
                                    {r.potongan.map((p, i) => (
                                      <div key={i} className="flex justify-between gap-2">
                                        <span>{p.nama}</span>
                                        <span className="font-bold">{p.tipe === 'persen' ? p.nilai + '%' : formatRupiah(p.nilai)}</span>
                                      </div>
                                    ))}
                                    {r.potongan.length === 0 && <span className="text-slate-500">—</span>}
                                  </div>
                                </td>
                                <td className="p-1.5 text-right font-black text-rose-400 whitespace-nowrap">{formatRupiah(r.total_potongan)}</td>
                                <td className="p-1.5 text-right font-black text-emerald-400 whitespace-nowrap">{formatRupiah(r.total_bersih)}</td>
                                <td className="p-1.5 text-center">
                                  {isPaidPeriode ? (
                                    <span className="inline-flex items-center gap-0.5 text-[8px] font-black px-1.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/40 text-emerald-400">
                                      <CheckCircle2 className="w-2.5 h-2.5" /> PAID
                                    </span>
                                  ) : stageYayasan ? (
                                    <span className="inline-flex items-center gap-0.5 text-[8px] font-black px-1.5 py-0.5 rounded-full bg-violet-500/15 border border-violet-500/40 text-violet-400">
                                      <ShieldCheck className="w-2.5 h-2.5" /> Yayasan
                                    </span>
                                  ) : stageKepsek ? (
                                    <span className="inline-flex items-center gap-0.5 text-[8px] font-black px-1.5 py-0.5 rounded-full bg-sky-500/15 border border-sky-500/40 text-sky-400">
                                      <BadgeCheck className="w-2.5 h-2.5" /> K.S.
                                    </span>
                                  ) : (
                                    <span className={`inline-flex items-center gap-0.5 text-[8px] font-black px-1.5 py-0.5 rounded-full border ${isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-400' : 'bg-slate-100 border-slate-300 text-slate-500'}`}>
                                      <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" /> Menunggu
                                    </span>
                                  )}
                                </td>

                              </tr>
                            )
                          })}

                        </tbody>
                      </table>
                    </div>
                  </div>

                </>
              )}
              {!showFullRekap && (
                <>

                  <div className={`border rounded-2xl p-4 space-y-3 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-300'}`}>
                    <div className="flex items-center gap-2.5">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isDarkMode ? 'bg-slate-800 text-indigo-400' : 'bg-white border border-indigo-200 text-indigo-700'}`}>
                        <Users className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-sm font-extrabold">{guruNama(currentGuruId ?? 0)}</h3>
                        <p className={`text-[10px] font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                          Rincian Honorarium Pribadi — {bulanLabel} {periodeTahun}
                        </p>
                      </div>
                      {personalRow?.status === 'PAID' && (
                        <span className="ml-auto flex items-center gap-1 text-[10px] font-black px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/40 text-emerald-400">
                          <BadgeCheck className="w-3.5 h-3.5" /> PAID
                        </span>
                      )}
                    </div>

                    {!personalRow ? (
                      <div className={`text-center py-6 text-xs font-medium rounded-xl border border-dashed ${isDarkMode ? 'text-slate-500 border-slate-700' : 'text-slate-500 border-slate-300'}`}>
                        Data honorarium Anda belum tersedia untuk periode ini. Silakan hubungi Pengurus Utama.
                      </div>
                    ) : (
                      <>
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-[11px]">
                            <tbody>
                              {(() => {
                                const tj = n(pengaturan?.tarif_jp)
                                const tt = n(pengaturan?.tarif_transport_harian)
                                const rowL = (label: string, sub: string, val: string, cls = '') => (
                                  <tr key={label} className={`border-t ${isDarkMode ? 'border-slate-800' : 'border-slate-200'}`}>
                                    <td className={`p-1.5 font-bold ${cls}`}>{label}</td>
                                    <td className={`p-1.5 text-right ${cls}`}>{sub}</td>
                                    <td className={`p-1.5 text-right font-black ${cls}`}>{val}</td>
                                  </tr>
                                )
                                return (
                                  <>
                                    {rowL('Jam Mengajar (JP)', `${personalRow.jumlah_jp} JP × ${formatRupiah(tj)}`, formatRupiah(personalRow.jumlah_jp * tj))}
                                    {rowL('Transport Harian', `${personalRow.transport_hari} hari × ${formatRupiah(tt)}`, formatRupiah(personalRow.transport_hari * tt))}
                                    {rowL('Tunjangan Jabatan', '', formatRupiah(personalRow.tunjangan_jabatan))}
                                    {rowL('Tunjangan Masa Kerja', '', formatRupiah(personalRow.tunjangan_masa_kerja))}
                                    {rowL('Pembina', '', formatRupiah(personalRow.pembina))}
                                    {rowL('Wali Kelas', '', formatRupiah(personalRow.wali_kelas))}
                                    {rowL('Tugas Tambahan', '', formatRupiah(personalRow.tugas_tambahan))}
                                    {n(personalRow.piket) > 0 && rowL('Piket', '', formatRupiah(personalRow.piket))}
                                    {rowL('Total Kotor', '', formatRupiah(n(personalRow.total_bersih) + n(personalRow.total_potongan)), 'text-indigo-400')}
                                    {personalRow.potongan.map((p) => rowL(`Potongan ${p.nama}`, p.tipe === 'persen' ? p.nilai + '%' : formatRupiah(p.nilai), '- ' + formatRupiah(p.hasil), 'text-rose-400'))}
                                    <tr className={`border-t-2 ${isDarkMode ? 'border-slate-700' : 'border-slate-400'}`}>
                                      <td className="p-2 font-black text-emerald-400">Total Bersih</td>
                                      <td className="p-2 text-right"></td>
                                      <td className="p-2 text-right font-black text-emerald-400 text-base">{formatRupiah(personalRow.total_bersih)}</td>
                                    </tr>
                                  </>
                                )
                              })()}
                            </tbody>
                          </table>
                        </div>
                        {personalRow.detailTugas && personalRow.detailTugas.length > 0 && (
                          <div>
                            <div className="text-[10px] font-black uppercase text-slate-400 mb-1">Rincian Tugas Tambahan</div>
                            <div className="space-y-1 text-[11px]">
                              {[...personalRow.detailTugas].sort((a, b) => String(a.tanggal).localeCompare(String(b.tanggal))).map((t, i) => (
                                <div key={i} className="flex justify-between border-b border-slate-100 py-0.5">
                                  <span>{formatTanggalSingkat(t.tanggal)} — {t.nama_kegiatan}</span><span className="font-bold">{formatRupiah(Number(t.nominal) || 0)}</span>
                                </div>
                              ))}
                            </div>
                            <div className="text-right text-[11px] font-black mt-1">Total: {formatRupiah(personalRow.tugas_tambahan)}</div>
                          </div>
                        )}
                        {personalRow.updated_by && (
                          <p className={`text-[9px] font-medium ${isDarkMode ? 'text-slate-500' : 'text-slate-500'}`}>
                            <Info className="w-3 h-3 inline-block align-middle mr-1" />
                            Terakhir diperbarui oleh {personalRow.updated_by} · {formatTanggal(personalRow.updated_at)}
                          </p>
                        )}
                        <div className={`flex flex-wrap items-center gap-2 pt-2 border-t ${isDarkMode ? 'border-slate-800' : 'border-slate-200'}`}>
                          <span className={`text-[10px] font-black ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>Ukuran Kertas:</span>
                          <select value={paperSize} onChange={(e) => setPaperSize(e.target.value as 'f4' | 'a4')}
                            className={`border rounded-lg px-2 py-1 text-xs font-bold focus:outline-none ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'}`}>
                            <option value="f4">F4 / Folio Landscape (330×215mm)</option>
                            <option value="a4">A4 Landscape (297×210mm)</option>
                          </select>
                          <button onClick={printOwnSlip} className="text-[10px] font-black px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white cursor-pointer">
                            <FileCheck2 className="w-3.5 h-3.5 inline-block align-middle mr-1" /> Cetak Slip Pribadi
                          </button>
                          {currentGuruId != null && (
                            <button onClick={() => setDetailGuruId(currentGuruId)} className="text-[10px] font-black px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer">
                              Lihat Rincian
                            </button>
                          )}
                        </div>
                      </>
                    )}
                  </div>

                </>
              )}
              </animated.div>
            </>
          )}

          {activeTab === 'riwayat' && (
            <div className={`border rounded-2xl p-4 space-y-3 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-300'}`}>
              {isPengurusUtama && (
                <AuditLogBox logs={auditLogs} isDarkMode={isDarkMode} />
              )}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-xs font-extrabold flex items-center gap-1.5 text-indigo-400">
                  <FileCheck2 className="w-4 h-4" /> Riwayat Pembayaran Gaji (Arsip SAH)
                </h3>
                <select
                  value={riwayatPeriode}
                  onChange={(e) => {
                    setRiwayatPeriode(e.target.value)
                    loadRiwayat(e.target.value)
                  }}
                  className={`border rounded-lg px-2 py-1 text-xs font-bold focus:outline-none ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'}`}
                >
                  <option value="">Pilih bulan PAID</option>
                  {riwayatPeriods.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>

              {!riwayatPeriode ? (
                <div className={`text-center py-8 text-xs font-medium rounded-xl border border-dashed ${isDarkMode ? 'text-slate-500 border-slate-700' : 'text-slate-500 border-slate-300'}`}>
                  Belum ada bulan yang terkonfirmasi PAID. Arsip sah akan tampil setelah Pengurus menekan "Konfirmasi Sudah Dibayarkan".
                </div>
              ) : (
                <>
                  {/* STEMPEL PENGESAHAN DIGITAL */}
                  <div className="flex justify-center">
                    <div className={`max-w-md w-full text-center border-2 border-dashed rounded-xl px-4 py-3 ${isDarkMode ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-emerald-400 bg-emerald-50'}`}>
                      <div className="flex items-center justify-center gap-2 text-emerald-500">
                        <BadgeCheck className="w-6 h-6" />
                        <span className="text-[11px] font-black tracking-wide text-emerald-600">{STATUS_BADGE}</span>
                      </div>
                      <p className={`text-[10px] font-bold mt-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                        Periode {riwayatPeriode} · KS {formatTanggal(riwayatList[0]?.disahkan_kepsek_at)} · Yayasan {formatTanggal(riwayatList[0]?.disahkan_yayasan_at)} · Dibayar {formatTanggal(riwayatList[0]?.dibayar_bendahara_at)}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {[
                      ['Total Honor', formatRupiah(riwayatList.reduce((a, r) => a + n(r.total_bersih), 0))],
                      ['Total JP', String(riwayatList.reduce((a, r) => a + n(r.jumlah_jp), 0))],
                      ['Total Transport', String(riwayatList.reduce((a, r) => a + n(r.transport_hari), 0)) + ' hari'],
                      ['Jml Guru', String(riwayatList.length)],
                    ].map(([label, val]) => (
                      <div key={label} className={`rounded-lg border px-3 py-2 ${isDarkMode ? 'bg-slate-800/60 border-slate-700' : 'bg-white/60 border-slate-200'}`}>
                        <div className={`text-[9px] uppercase font-black ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{label}</div>
                        <div className={`text-sm font-black ${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>{val}</div>
                      </div>
                    ))}
                  </div>

                  {showFullRekap && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-[11px] min-w-[760px]">
                        <thead>
                          <tr className={`text-[9px] uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                            <th className="p-1.5">Nama</th>
                            <th className="p-1.5 text-center">JP</th>
                            <th className="p-1.5 text-center">Transport</th>
                            <th className="p-1.5 text-right">Total Kotor</th>
                            <th className="p-1.5 text-right">Potongan</th>
                            <th className="p-1.5 text-right">Total Bersih</th>
                            <th className="p-1.5">Alur Persetujuan</th>
                          </tr>
                        </thead>
                        <tbody>
                          {riwayatList.map((r) => (
                            <tr key={r.guru_id} className={`border-t ${isDarkMode ? 'border-slate-800' : 'border-slate-200'}`}>
                              <td className="p-1.5 font-bold">{r.guru_nama || guruNama(r.guru_id)}</td>
                              <td className="p-1.5 text-center">{r.jumlah_jp}</td>
                              <td className="p-1.5 text-center">{r.transport_hari}</td>
                              <td className="p-1.5 text-right">{formatRupiah(n(r.total_bersih) + n(r.total_potongan))}</td>
                              <td className="p-1.5 text-right text-rose-400">{formatRupiah(r.total_potongan)}</td>
                              <td className="p-1.5 text-right font-black text-emerald-400">{formatRupiah(r.total_bersih)}</td>
                              <td className="p-1.5 text-[10px] text-slate-400 space-y-0.5">
                                <div><span className="font-bold">KS:</span> {r.disahkan_kepsek_by || '-'} — {formatTanggal(r.disahkan_kepsek_at)}</div>
                                <div><span className="font-bold">Yayasan:</span> {r.disahkan_yayasan_by || '-'} — {formatTanggal(r.disahkan_yayasan_at)}</div>
                                <div><span className="font-bold">Bendahara:</span> {r.dibayar_bendahara_by || '-'} — {formatTanggal(r.dibayar_bendahara_at)}</div>
                              </td>
                            </tr>
                          ))}
                          {riwayatList.length === 0 && (
                            <tr><td colSpan={7} className="p-4 text-center text-xs text-slate-500">Tidak ada data untuk periode ini.</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {!showFullRekap && (
                    <div className={`rounded-xl border p-4 space-y-2 ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                      {riwayatList.filter((r) => r.guru_id === currentGuruId).map((r) => (
                        <div key={r.guru_id} className="space-y-1">
                          <p className="text-xs font-extrabold">{guruNama(r.guru_id)}</p>
                          <p className="text-[11px] text-slate-400">JP: {r.jumlah_jp} · Transport: {r.transport_hari} hari</p>
                          <p className="text-[11px] text-slate-400">Total Kotor: {formatRupiah(n(r.total_bersih) + n(r.total_potongan))}</p>
                          <p className="text-[11px] text-rose-400">Potongan: {formatRupiah(r.total_potongan)}</p>
                          <p className="text-sm font-black text-emerald-400">Total Bersih: {formatRupiah(r.total_bersih)}</p>
                        </div>
                      ))}
                      {riwayatList.filter((r) => r.guru_id === currentGuruId).length === 0 && (
                        <p className="text-xs text-slate-500">Belum ada slip pribadi untuk periode ini.</p>
                      )}
                    </div>
                  )}

                </>
              )}
            </div>
          )}
        </main>
      </div>

      {/* MODAL CATAT TUGAS TAMBAHAN */}
      {showTugasModal && (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setShowTugasModal(false)}
        >
          <div
            className={`w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl border p-5 space-y-4 ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-300'}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-extrabold flex items-center gap-2 text-indigo-400">
                <Plus className="w-4 h-4" /> Catat Tugas Tambahan
              </h3>
              <button onClick={() => setShowTugasModal(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleTugasSubmit} className="space-y-3">
              <label className="flex flex-col gap-1">
                <span className={`text-[10px] font-bold ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>Tanggal</span>
                <input type="date" value={tugasTanggal} onChange={(e) => setTugasTanggal(e.target.value)}
                  className={`border rounded-lg px-2 py-1.5 text-sm font-bold focus:outline-none ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'}`} />
              </label>
              <label className="flex flex-col gap-1">
                <span className={`text-[10px] font-bold ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>Nama Kegiatan</span>
                <input value={tugasKegiatan} onChange={(e) => setTugasKegiatan(e.target.value)} placeholder="cth. Pengawas TKA / Panitia Lomba"
                  className={`border rounded-lg px-2 py-1.5 text-sm font-bold focus:outline-none ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'}`} />
              </label>
              <label className="flex flex-col gap-1">
                <span className={`text-[10px] font-bold ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>Nominal Tambahan (Rp)</span>
                <input type="number" value={tugasNominal} onChange={(e) => setTugasNominal(Number(e.target.value))}
                  className={`border rounded-lg px-2 py-1.5 text-sm font-bold focus:outline-none ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'}`} />
              </label>
              <div>
                <span className={`text-[10px] font-bold ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>Guru Bertugas</span>
                <div className="mt-1.5 grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-52 overflow-y-auto">
                  {guruList.map((g) => {
                    const on = tugasGuruIds.includes(g.id)
                    return (
                      <button
                        key={g.id}
                        type="button"
                        onClick={() => toggleTugasGuru(g.id)}
                        className={`text-left text-[11px] font-bold px-2.5 py-1.5 rounded-lg border transition ${on ? 'bg-indigo-600 text-white border-indigo-600' : isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-slate-50 border-slate-300 text-slate-700'}`}
                      >
                        {on ? '✓ ' : ''}{g.nama_lengkap}
                      </button>
                    )
                  })}
                </div>
              </div>
              <button type="submit" disabled={saving}
                className="w-full text-xs font-black py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-40 cursor-pointer">
                {saving ? 'Menyimpan...' : 'Simpan Tugas Tambahan'}
              </button>
            </form>
          </div>
        </div>
      )}


      {detailGuruId !== null && (() => {
        const drow = rekapRows.find((r) => r.guru_id === detailGuruId)
        if (!drow) return null
        return (
          <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 backdrop-blur-sm p-3" onClick={() => setDetailGuruId(null)}>
            <div className={`w-full max-w-lg rounded-2xl border shadow-2xl max-h-[85vh] overflow-y-auto p-4 space-y-3 ${isDarkMode ? 'bg-slate-900 text-slate-100 border-slate-700' : 'bg-white text-slate-900 border-slate-200'}`} onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-extrabold">Detail Honor — {guruNama(detailGuruId)}</h3>
                <button onClick={() => setDetailGuruId(null)} className="text-slate-500 hover:text-slate-900 cursor-pointer"><X className="w-4 h-4" /></button>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className={`rounded-lg border p-2 ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}`}><div className="text-[9px] uppercase text-slate-400">JP</div><div className={`font-black text-lg ${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>{drow.jumlah_jp}</div></div>
                <div className={`rounded-lg border p-2 ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}`}><div className="text-[9px] uppercase text-slate-400">Transport</div><div className={`font-black text-lg ${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>{drow.transport_hari} hr</div></div>
                <div className={`rounded-lg border p-2 ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}`}><div className="text-[9px] uppercase text-slate-400">Potongan</div><div className={`font-black text-${isDarkMode ? 'rose-400' : 'rose-500'}`}>-{formatRupiah(drow.total_potongan)}</div></div>
                <div className={`rounded-lg border p-2 ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}`}><div className="text-[9px] uppercase text-slate-400">Bersih</div><div className={`font-black text-${isDarkMode ? 'emerald-400' : 'emerald-600'}`}>{formatRupiah(drow.total_bersih)}</div></div>
              </div>
              <div className="space-y-1 text-[11px]">
                {[
                  ['Jam Mengajar', formatRupiah(n(drow.jumlah_jp) * n(pengaturan?.tarif_jp))],
                  ['Transport', formatRupiah(n(drow.transport_hari) * n(pengaturan?.tarif_transport_harian))],
                  ['Tunjangan Jabatan', formatRupiah(drow.tunjangan_jabatan)],
                  ['Masa Kerja', formatRupiah(drow.tunjangan_masa_kerja)],
                  ['Pembina', formatRupiah(drow.pembina)],
                  ['Wali Kelas', formatRupiah(drow.wali_kelas)],
                  ['Tugas Tambahan', formatRupiah(drow.tugas_tambahan)],
                  ...(n(drow.piket) > 0 ? [['Piket', formatRupiah(drow.piket)]] : []),
                  ['Total Kotor', formatRupiah(n(drow.total_bersih) + n(drow.total_potongan))],
                ].map(([l, v]) => (
                  <div key={l} className="flex justify-between border-b border-slate-100 py-1"><span>{l}</span><span className="font-bold">{v}</span></div>
                ))}
              </div>
              {(drow.potongan || []).length > 0 && (
                <div>
                  <div className="text-[10px] font-black uppercase text-slate-400 mb-1">Potongan</div>
                  <div className="space-y-1 text-[11px]">
                    {(drow.potongan || []).map((po: any, i) => (
                      <div key={i} className="flex justify-between border-b border-slate-100 py-1">
                        <span>{po.nama || 'Potongan'}{po.tipe === 'persen' ? ` (${po.nilai}%)` : ''}</span>
                        <span className="font-bold text-rose-500">-{formatRupiah(Number(po.hasil) || 0)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {drow.detailJp && drow.detailJp.length > 0 && (
                <div>
                  <div className="text-[10px] font-black uppercase text-slate-400 mb-1">Rincian JP</div>
                  <div className="max-h-40 overflow-y-auto space-y-1 text-[11px]">
                    {drow.detailJp.map((d, i) => (
                      <div key={i} className="flex justify-between border-b border-slate-100 py-0.5">
                        <span>{formatTanggalSingkat(d.tanggal)}{d.mapel ? ` — ${d.mapel}` : ''} — Slot {d.jam || '-'}</span><span className="font-bold">{d.jp} JP</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {drow.detailTransport && drow.detailTransport.length > 0 && (
                <div>
                  <div className="text-[10px] font-black uppercase text-slate-400 mb-1">Rincian Transport</div>
                  <div className="max-h-40 overflow-y-auto space-y-1 text-[11px]">
                    {[...drow.detailTransport].sort().map((d, i) => (
                      <div key={i} className="flex justify-between border-b border-slate-100 py-0.5">
                        <span>{formatTanggalSingkat(d)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="text-right text-[11px] font-black mt-1">Total: {drow.transport_hari} hari</div>
                </div>
              )}
              {drow.detailTugas && drow.detailTugas.length > 0 && (
                <div>
                  <div className="text-[10px] font-black uppercase text-slate-400 mb-1">Rincian Tugas Tambahan</div>
                  <div className="max-h-40 overflow-y-auto space-y-1 text-[11px]">
                    {[...drow.detailTugas].sort((a, b) => String(a.tanggal).localeCompare(String(b.tanggal))).map((t, i) => (
                      <div key={i} className="flex justify-between border-b border-slate-100 py-0.5">
                        <span>{formatTanggalSingkat(t.tanggal)} — {t.nama_kegiatan}</span><span className="font-bold">{formatRupiah(Number(t.nominal) || 0)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="text-right text-[11px] font-black mt-1">Total: {formatRupiah(drow.tugas_tambahan)}</div>
                </div>
              )}
              {detailMemuat && !drow.detailJp?.length && !drow.detailTransport?.length && !drow.detailTugas?.length && (
                <p className="text-[11px] text-slate-400">Memuat rincian…</p>
              )}
            </div>
          </div>
        )
      })()}

      {/* TOAST */}
      {toast && (
        <div className={`fixed bottom-20 left-1/2 -translate-x-1/2 z-[95] px-4 py-2.5 rounded-xl text-xs font-bold shadow-lg ${toast.tipe === 'ok' ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'}`}>
          {toast.pesan}
        </div>
      )}
      </motion.div>

      {/* DOKUMEN CETAK RESMI (tersembunyi di layar, hanya tampil saat print) */}
      <PrintDocument
        mode={printMode}
        paperSize={paperSize}
        rows={slipRows}
        tarifJp={n(pengaturan?.tarif_jp)}
        tarifTransport={n(pengaturan?.tarif_transport_harian)}
        isPaid={isPaidPeriode}
        showKepsekTtd={showKepsekTtd}
        showYayasanTtd={showYayasanTtd}
        showBendaharaTtd={showBendaharaTtd}
        bulanLabel={bulanLabel}
        periodeTahun={periodeTahun}
        ketuaYayasan={namaKetuaYayasan}
        kepalaSekolah={namaKepalaSekolah}
        kepalaSekolahNuptk={nuptkKepalaSekolah}
        bendahara={namaBendahara}
      />
    </>
  )
}














