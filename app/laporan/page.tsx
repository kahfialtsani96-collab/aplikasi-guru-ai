'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { useAuthRole } from '@/hooks/useAuthRole'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const supabase = createClient(supabaseUrl, supabaseAnonKey)

interface OptionItem {
  id: number
  nama: string
}

export default function LaporanPage() {
  const router = useRouter()
  const { isOperator } = useAuthRole()

  const [activeTab, setActiveTab] = useState<'pusat' | 'pengaturan'>('pusat')
  const [userDisplayName, setUserDisplayName] = useState('GURU')
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [currentDateStr, setCurrentDateStr] = useState('')

  // Master Options dari Database
  const [kelasList, setKelasList] = useState<OptionItem[]>([])
  const [mapelList, setMapelList] = useState<OptionItem[]>([])

  // State Identitas Penandatangan & Kop Surat
  const [namaGuru, setNamaGuru] = useState('Guru Pengampu')
  const [nipGuru, setNipGuru] = useState('-')
  const [namaKepsek, setNamaKepsek] = useState('SULASTRI, S.Pd., Gr.')
  const [nipKepsek, setNipKepsek] = useState('NUPTK. 6337763664131233')

  const [pemprov, setPemprov] = useState('YAYASAN PONDOK PESANTREN MUNA MUSTOFA LAMPUNG')
  const [namaSekolah, setNamaSekolah] = useState('SMP MUNA MUSTOFA')
  const [alamatSekolah, setAlamatSekolah] = useState('Jl. PPTQ Muna Mustofa Kecamatan Gisting Kabupaten Tanggamus 35376')
  const [kotaTtd, setKotaTtd] = useState('Gisting')

  // State Filter Cetak Laporan
  const [filterKelasAbsensi, setFilterKelasAbsensi] = useState('')
  const [filterKelasLeger, setFilterKelasLeger] = useState('')
  const [filterKelasJurnal, setFilterKelasJurnal] = useState('')
  const [filterKelasBimbingan, setFilterKelasBimbingan] = useState('')
  
  const [tanggalAbsensi, setTanggalAbsensi] = useState('')
  const [kelasRiwayatAbsensi, setKelasRiwayatAbsensi] = useState('')
  
  const [kelasNilai, setKelasNilai] = useState('')
  const [mapelNilai, setMapelNilai] = useState('')

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
      if (user) {
        const email = user.email || ''
        setUserEmail(email)
        const nameFromMeta = user.user_metadata?.full_name || email.split('@')[0] || 'GURU'
        setUserDisplayName(nameFromMeta.toUpperCase())

        // Fetch data profil guru dari tabel database 'guru'
        fetchProfilGuru(email, nameFromMeta)
        // Fetch Master Kelas & Mapel
        fetchMasterData(email)
      }
    }
    getUserData()
  }, [])

  // Auto-Fetch data resmi Guru dari database
  async function fetchProfilGuru(email: string, defaultName: string) {
    try {
      const { data } = await supabase
        .from('guru')
        .select('nama_lengkap, nip')
        .eq('email', email)
        .maybeSingle()

      if (data) {
        setNamaGuru(data.nama_lengkap || defaultName)
        setNipGuru(data.nip || '-')
      } else {
        setNamaGuru(defaultName)
      }
    } catch (err) {
      console.error('Error fetching profil guru:', err)
    }
  }

  // Fetch Master Kelas & Mapel dari DB
  async function fetchMasterData(email: string) {
    try {
      const { data: dataKelas } = await supabase.from('kelas').select('id, nama_kelas').order('nama_kelas', { ascending: true })
      const { data: dataMapel } = await supabase.from('mapel').select('id, nama_mapel').order('nama_mapel', { ascending: true })

      if (dataKelas) {
        setKelasList(dataKelas.map(k => ({ id: k.id, nama: k.nama_kelas })))
      }
      if (dataMapel) {
        setMapelList(dataMapel.map(m => ({ id: m.id, nama: m.nama_mapel })))
      }
    } catch (err) {
      console.error('Error fetching master data:', err)
    }
  }

  // TEMPLATE HTML KOP SURAT SEKOLAH
  const headerKopHTML = `
    <div style="text-align: center; margin-bottom: 20px; font-family: 'Times New Roman', serif; color: #000;">
      <div style="font-size: 18pt; font-weight: bold; font-family: 'Traditional Arabic', 'Amiri', serif; line-height: 1.2; margin-bottom: 4px;">
        المعهد الإسلامي منى مصطفى
      </div>
      <h3 style="margin: 0; font-size: 11pt; text-transform: uppercase; font-weight: bold; letter-spacing: 0.5px;">
        ${pemprov}
      </h3>
      <h1 style="margin: 2px 0; font-size: 16pt; text-transform: uppercase; font-weight: bold;">
        ${namaSekolah}
      </h1>
      <h4 style="margin: 0; font-size: 10.5pt; text-transform: uppercase; font-weight: bold;">
        CAMPANG KECAMATAN GISTING KAB. TANGGAMUS
      </h4>
      <p style="margin: 2px 0; font-size: 9.5pt; font-weight: bold;">
        NPSN: 71407877 SK IZIN OPERASIONAL : 503/029/IPO/VIII/36/2026
      </p>
      
      <div style="border-top: 1.5px solid #000; margin-top: 6px; padding-top: 4px; font-size: 9.5pt; font-style: italic;">
        <span><em>Address :</em> ${alamatSekolah}</span><br/>
        <span><em>Email:</em> munamustofa1922@gmail.com &nbsp; <em>Website:</em> https://smpmunamustofa.netlify.app/#sambutan</span>
      </div>
      <div style="border-bottom: 1px solid #000; margin-top: 4px;"></div>
    </div>
  `

  // TEMPLATE TANDA TANGAN PENGESAHAN
  const footerTtdHTML = `
    <div style="margin-top: 40px; font-family: 'Times New Roman', serif; font-size: 11pt; page-break-inside: avoid; color: #000;">
      <table style="width: 100%; border: none;">
        <tr>
          <td style="width: 50%; border: none; text-align: center; vertical-align: top;">
            Mengetahui,<br/>
            <strong>Kepala Sekolah</strong><br/><br/><br/><br/><br/>
            <u><strong>${namaKepsek}</strong></u><br/>
            ${nipKepsek}
          </td>
          <td style="width: 50%; border: none; text-align: center; vertical-align: top;">
            ${kotaTtd}, ${currentDateStr}<br/>
            <strong>Guru Pengampu / Wali Kelas</strong><br/><br/><br/><br/><br/>
            <u><strong>${namaGuru}</strong></u><br/>
            NIP/NUPTK: ${nipGuru}
          </td>
        </tr>
      </table>
    </div>
  `

  // FUNGSI PRINT UTAMA
  const handlePrintDocument = async (jenis: string) => {
    let judulDoc = 'LAPORAN AKADEMIK'
    let contentBody = ''

    if (jenis === 'absensi') {
      const selectedK = kelasList.find(k => k.id === Number(filterKelasAbsensi))
      judulDoc = `LAPORAN REKAPITULASI PRESENSI SISWA ${selectedK ? `(${selectedK.nama.toUpperCase()})` : '(SEMUA KELAS)'}`
      
      let querySiswa = supabase.from('siswa').select('*, kelas:kelas_id(nama_kelas)').order('nama_lengkap', { ascending: true })
      if (filterKelasAbsensi) querySiswa = querySiswa.eq('kelas_id', Number(filterKelasAbsensi))
      const { data: siswaData } = await querySiswa

      let queryAbsensi = supabase.from('absensi').select('*')
      if (!isOperator && userEmail) queryAbsensi = queryAbsensi.eq('guru_email', userEmail)
      const { data: absensiData } = await queryAbsensi

      const rekapSiswa = (siswaData || []).map(siswa => {
        const riwayat = (absensiData || []).filter(a => a.siswa_id === siswa.id)
        return {
          nisn: siswa.nisn || '-',
          nama: siswa.nama_lengkap,
          kelas: siswa.kelas?.nama_kelas || '-',
          hadir: riwayat.filter(a => a.status === 'HADIR').length,
          sakit: riwayat.filter(a => a.status === 'SAKIT').length,
          izin: riwayat.filter(a => a.status === 'IZIN').length,
          alpa: riwayat.filter(a => a.status === 'ALPA').length
        }
      })

      contentBody = `
        <h3 style="text-align: center; text-transform: uppercase; margin-bottom: 15px;">${judulDoc}</h3>
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
      judulDoc = `LEGER NILAI AKADEMIK SISWA ${selectedK ? `(${selectedK.nama.toUpperCase()})` : '(SEMUA KELAS)'}`

      let querySiswa = supabase.from('siswa').select('*, kelas:kelas_id(nama_kelas)').order('nama_lengkap', { ascending: true })
      if (filterKelasLeger) querySiswa = querySiswa.eq('kelas_id', Number(filterKelasLeger))
      const { data: siswaData } = await querySiswa

      let queryNilai = supabase.from('nilai').select('*')
      if (!isOperator && userEmail) queryNilai = queryNilai.eq('guru_email', userEmail)
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
          kelas: siswa.kelas?.nama_kelas || '-',
          tugas: n.nilai_tugas ?? '-',
          uts: n.nilai_uts ?? '-',
          uas: n.nilai_uas ?? '-',
          avg
        }
      })

      contentBody = `
        <h3 style="text-align: center; text-transform: uppercase; margin-bottom: 15px;">${judulDoc}</h3>
        <table style="width: 100%; border-collapse: collapse; font-size: 10pt;">
          <thead>
            <tr style="background-color: #f2f2f2;">
              <th style="border: 1px solid #000; padding: 6px;">No</th>
              <th style="border: 1px solid #000; padding: 6px;">Nama Siswa</th>
              <th style="border: 1px solid #000; padding: 6px;">Kelas</th>
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
                      <td style="border: 1px solid #000; padding: 5px; text-align: center;">${s.tugas}</td>
                      <td style="border: 1px solid #000; padding: 5px; text-align: center;">${s.uts}</td>
                      <td style="border: 1px solid #000; padding: 5px; text-align: center;">${s.uas}</td>
                      <td style="border: 1px solid #000; padding: 5px; text-align: center; font-weight: bold;">${s.avg}</td>
                    </tr>
                  `).join('')
                : `<tr><td colspan="7" style="border: 1px solid #000; padding: 10px; text-align: center;">Belum ada data nilai akademik.</td></tr>`
            }
          </tbody>
        </table>
      `
    } else if (jenis === 'jurnal') {
      const selectedK = kelasList.find(k => k.id === Number(filterKelasJurnal))
      judulDoc = `JURNAL AGENDA MENGAJAR HARIAN GURU ${selectedK ? `(${selectedK.nama.toUpperCase()})` : '(SEMUA KELAS)'}`

      let queryAgenda = supabase.from('jurnal_agenda').select('*').order('created_at', { ascending: false })
      if (!isOperator && userEmail) queryAgenda = queryAgenda.eq('guru_email', userEmail)
      if (filterKelasJurnal) queryAgenda = queryAgenda.eq('kelas_id', Number(filterKelasJurnal))

      const { data: agendaData } = await queryAgenda

      contentBody = `
        <h3 style="text-align: center; text-transform: uppercase; margin-bottom: 15px;">${judulDoc}</h3>
        <table style="width: 100%; border-collapse: collapse; font-size: 10pt;">
          <thead>
            <tr style="background-color: #f2f2f2;">
              <th style="border: 1px solid #000; padding: 6px;">No</th>
              <th style="border: 1px solid #000; padding: 6px;">Tanggal</th>
              <th style="border: 1px solid #000; padding: 6px;">Jam Mengajar</th>
              <th style="border: 1px solid #000; padding: 6px;">Kelas & Mapel</th>
              <th style="border: 1px solid #000; padding: 6px;">Materi Pembelajaran</th>
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
                      <td style="border: 1px solid #000; padding: 6px;"><b>${a.kelas}</b> -${a.mapel}</td>
                      <td style="border: 1px solid #000; padding: 6px;">${a.materi || '-'}</td>
                      <td style="border: 1px solid #000; padding: 6px; text-align: center; font-weight: bold;">${a.status}</td>
                    </tr>
                  `).join('')
                : `<tr><td colspan="6" style="border: 1px solid #000; padding: 10px; text-align: center;">Belum ada data agenda mengajar tersimpan.</td></tr>`
            }
          </tbody>
        </table>
      `
    } else if (jenis === 'bimbingan') {
      const selectedK = kelasList.find(k => k.id === Number(filterKelasBimbingan))
      judulDoc = `LAPORAN CATATAN BIMBINGAN GURU WALI ${selectedK ? `(${selectedK.nama.toUpperCase()})` : '(SEMUA KELAS)'}`

      let queryBimbingan = supabase.from('bimbingan_wali').select('*')
      if (filterKelasBimbingan) queryBimbingan = queryBimbingan.eq('kelas_id', Number(filterKelasBimbingan))
      const { data: bimbinganData } = await queryBimbingan

      contentBody = `
        <h3 style="text-align: center; text-transform: uppercase; margin-bottom: 15px;">${judulDoc}</h3>
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
                      <td style="border: 1px solid #000; padding: 5px;">${b.permasalahan || '-'}</td>
                      <td style="border: 1px solid #000; padding: 5px;">${b.tindak_lanjut || '-'}</td>
                    </tr>
                  `).join('')
                : `<tr><td colspan="5" style="border: 1px solid #000; padding: 10px; text-align: center;">Belum ada catatan bimbingan guru wali tersimpan.</td></tr>`
            }
          </tbody>
        </table>
      `
    }

    executePrint(judulDoc, contentBody)
  }

  // 1. CETAK RIWAYAT HARIAN ABSENSI
  const handlePrintRiwayatAbsensi = async () => {
    let query = supabase.from('absensi').select('*').order('tanggal', { ascending: false })
    if (!isOperator && userEmail) query = query.eq('guru_email', userEmail)
    if (tanggalAbsensi) query = query.eq('tanggal', tanggalAbsensi)
    if (kelasRiwayatAbsensi) query = query.eq('kelas_id', Number(kelasRiwayatAbsensi))

    const { data: absensiData } = await query
    const selectedK = kelasList.find(k => k.id === Number(kelasRiwayatAbsensi))
    const judulDoc = `LAPORAN RIWAYAT HARIAN PRESENSI SISWA ${tanggalAbsensi ? `TANGGAL ${tanggalAbsensi}` : ''} ${selectedK ? `(${selectedK.nama.toUpperCase()})` : '(SEMUA KELAS)'}`

    const contentBody = `
      <h3 style="text-align: center; text-transform: uppercase; margin-bottom: 15px;">${judulDoc}</h3>
      <table style="width: 100%; border-collapse: collapse; font-size: 10pt;">
        <thead>
          <tr style="background-color: #f2f2f2;">
            <th style="border: 1px solid #000; padding: 6px;">No</th>
            <th style="border: 1px solid #000; padding: 6px;">Tanggal</th>
            <th style="border: 1px solid #000; padding: 6px;">Nama Siswa</th>
            <th style="border: 1px solid #000; padding: 6px;">Kelas</th>
            <th style="border: 1px solid #000; padding: 6px;">Mata Pelajaran</th>
            <th style="border: 1px solid #000; padding: 6px;">Status</th>
          </tr>
        </thead>
        <tbody>
          ${
            (absensiData || []).length > 0
              ? absensiData!.map((a, idx) => `
                  <tr>
                    <td style="border: 1px solid #000; padding: 5px; text-align: center;">${idx + 1}</td>
                    <td style="border: 1px solid #000; padding: 5px; text-align: center;">${a.tanggal || '-'}</td>
                    <td style="border: 1px solid #000; padding: 5px;">${a.nama_siswa}</td>
                    <td style="border: 1px solid #000; padding: 5px; text-align: center;">${a.kelas || '-'}</td>
                    <td style="border: 1px solid #000; padding: 5px;">${a.mapel || '-'}</td>
                    <td style="border: 1px solid #000; padding: 5px; text-align: center; font-weight: bold;">${a.status}</td>
                  </tr>
                `).join('')
              : `<tr><td colspan="6" style="border: 1px solid #000; padding: 10px; text-align: center;">Belum ada riwayat absensi harian untuk filter ini.</td></tr>`
          }
        </tbody>
      </table>
    `

    executePrint(judulDoc, contentBody)
  }

  // 2. CETAK RIWAYAT INPUT NILAI AKADEMIK
  const handlePrintRiwayatNilai = async () => {
    let query = supabase.from('nilai').select('*, siswa:siswa_id(nama_lengkap, kelas:kelas_id(nama_kelas))').order('created_at', { ascending: false })
    if (!isOperator && userEmail) query = query.eq('guru_email', userEmail)
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
              ? nilaiData!.map((n: any, idx) => `
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

    executePrint(judulDoc, contentBody)
  }

  // HELPER BUKA WINDOW PRINT
  const executePrint = (judulDoc: string, contentBody: string) => {
    const printWindow = window.open('', '_blank')
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>${judulDoc} - ${namaSekolah}</title>
            <style>
              @page { margin: 2cm; size: A4; }
              body { font-family: 'Times New Roman', Times, serif; color: #000; line-height: 1.4; }
              th, td { border: 1px solid #000; padding: 6px; }
            </style>
          </head>
          <body>
            ${headerKopHTML}
            ${contentBody}
            ${footerTtdHTML}
          </body>
        </html>
      `)
      printWindow.document.close()
      setTimeout(() => { printWindow.print() }, 500)
    }
  }

  const handleSimpanPengaturan = () => {
    alert('Pengaturan profil guru & kop surat cetakan laporan berhasil diperbarui!')
  }

  return (
    <div className="h-screen bg-[#E2E8F0] text-slate-800 font-sans flex flex-col justify-between selection:bg-indigo-500 selection:text-white overflow-hidden relative">
      
      {/* WATERMARK LOGO */}
      <div className="fixed inset-0 pointer-events-none z-0 flex items-center justify-center opacity-[0.15] select-none print:hidden">
        <img src="/logo-smp.jpg" alt="Watermark" className="w-[850px] h-[850px] object-contain max-w-none" />
      </div>

      <div className="relative z-10 flex flex-col h-full overflow-hidden">
        
        {/* HEADER TOPBAR */}
        <header className="bg-slate-100/90 backdrop-blur-md border-b border-slate-300 px-6 py-2.5 flex items-center justify-between shrink-0 shadow-xs print:hidden">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-slate-600 hover:text-slate-900 p-1.5 rounded-lg transition" title="Kembali ke Dashboard">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </Link>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl overflow-hidden flex items-center justify-center bg-white border border-slate-300 p-0.5 shadow-xs shrink-0">
                <img src="/logo-smp.jpg" alt="Logo SMP" className="w-full h-full object-contain" />
              </div>
              <div>
                <h1 className="font-bold text-base text-slate-900 leading-none">Aplikasi Guru AI</h1>
                <p className="text-[11px] text-emerald-800 font-bold mt-0.5">Pusat Laporan &amp; Cetak PDF Dokumentasi</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="bg-white border border-slate-300 text-slate-800 text-xs font-bold px-3.5 py-1.5 rounded-xl flex items-center gap-2 shadow-xs">
              <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px] font-bold">
                {userDisplayName.charAt(0)}
              </span>
              <span>{userDisplayName}</span>
              <span className="bg-indigo-100 text-indigo-800 text-[10px] px-2 py-0.5 rounded-md font-extrabold uppercase ml-1 border border-indigo-200">
                {isOperator ? 'Operator' : 'Guru'}
              </span>
            </div>

            <button
              onClick={async () => {
                await supabase.auth.signOut()
                router.replace('/login')
              }}
              className="bg-rose-100 border border-rose-300 hover:bg-rose-200 text-rose-700 p-2 rounded-xl transition cursor-pointer"
              title="Keluar"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </header>

        {/* SUB-HEADER TAB SWITCHER */}
        <div className="bg-slate-200/80 backdrop-blur-md border-b border-slate-300 px-6 py-2 shrink-0 overflow-x-auto print:hidden">
          <div className="max-w-6xl mx-auto flex items-center gap-2 text-xs font-bold">
            <span className="text-indigo-900 font-black pr-2 border-r border-slate-300 flex items-center gap-1">
              🖨️ Laporan:
            </span>
            <button
              onClick={() => setActiveTab('pusat')}
              className={`px-3.5 py-1.5 rounded-xl transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'pusat' ? 'bg-indigo-600 text-white shadow-xs font-extrabold' : 'bg-white/80 text-slate-700 hover:bg-white border border-slate-300'
              }`}
            >
              <span>🖨️</span> Pusat Cetak Laporan
            </button>
            <button
              onClick={() => setActiveTab('pengaturan')}
              className={`px-3.5 py-1.5 rounded-xl transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'pengaturan' ? 'bg-indigo-600 text-white shadow-xs font-extrabold' : 'bg-white/80 text-slate-700 hover:bg-white border border-slate-300'
              }`}
            >
              <span>⚙️</span> Pengaturan Profil &amp; Kop
            </button>
          </div>
        </div>

        {/* MAIN CONTENT AREA */}
        <main className="max-w-6xl w-full mx-auto p-4 flex-1 flex flex-col min-h-0 overflow-y-auto space-y-4">

          {/* TAB 1: PUSAT LAPORAN */}
          {activeTab === 'pusat' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-12">
              
              {/* CARD 1: CETAK PDF ABSENSI */}
              <div className="bg-gradient-to-br from-indigo-100/90 via-slate-100/90 to-indigo-50/90 backdrop-blur-md border border-indigo-200/80 rounded-2xl p-4 shadow-xs flex flex-col justify-between space-y-3">
                <div>
                  <div className="flex items-center gap-2 text-indigo-950 font-extrabold text-sm mb-1">
                    <span>📄</span>
                    <h3>Cetak PDF Rekap Presensi</h3>
                  </div>
                  <p className="text-xs text-slate-600">Laporan rekapitulasi presensi siswa per kelas.</p>
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold text-indigo-950 uppercase mb-1">PILIH KELAS</label>
                  <select
                    value={filterKelasAbsensi}
                    onChange={(e) => setFilterKelasAbsensi(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs text-slate-900 font-bold focus:outline-none"
                  >
                    <option value="">Semua Kelas</option>
                    {kelasList.map((k) => (
                      <option key={k.id} value={k.id}>{k.nama}</option>
                    ))}
                  </select>
                </div>

                <button
                  onClick={() => handlePrintDocument('absensi')}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold py-2 rounded-xl text-xs transition shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <span>🖨️</span> Cetak PDF Absensi
                </button>
              </div>

              {/* CARD 2: CETAK PDF LEGER NILAI */}
              <div className="bg-gradient-to-br from-indigo-100/90 via-slate-100/90 to-indigo-50/90 backdrop-blur-md border border-indigo-200/80 rounded-2xl p-4 shadow-xs flex flex-col justify-between space-y-3">
                <div>
                  <div className="flex items-center gap-2 text-indigo-950 font-extrabold text-sm mb-1">
                    <span>📄</span>
                    <h3>Cetak PDF Leger Nilai Akademik</h3>
                  </div>
                  <p className="text-xs text-slate-600">Leger nilai akumulasi Tugas, UTS, UAS &amp; Rata-Rata.</p>
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold text-indigo-950 uppercase mb-1">PILIH KELAS</label>
                  <select
                    value={filterKelasLeger}
                    onChange={(e) => setFilterKelasLeger(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs text-slate-900 font-bold focus:outline-none"
                  >
                    <option value="">Semua Kelas</option>
                    {kelasList.map((k) => (
                      <option key={k.id} value={k.id}>{k.nama}</option>
                    ))}
                  </select>
                </div>

                <button
                  onClick={() => handlePrintDocument('leger')}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold py-2 rounded-xl text-xs transition shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <span>🖨️</span> Cetak PDF Leger Nilai
                </button>
              </div>

              {/* CARD 3: JURNAL AGENDA MENGAJAR */}
              <div className="bg-gradient-to-br from-indigo-100/90 via-slate-100/90 to-indigo-50/90 backdrop-blur-md border border-indigo-200/80 rounded-2xl p-4 shadow-xs flex flex-col justify-between space-y-3">
                <div>
                  <div className="flex items-center gap-2 text-indigo-950 font-extrabold text-sm mb-1">
                    <span>📄</span>
                    <h3>Jurnal Agenda Mengajar Harian</h3>
                  </div>
                  <p className="text-xs text-slate-600">Dokumen resmi jurnal mengajar harian guru pengampu.</p>
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold text-indigo-950 uppercase mb-1">PILIH KELAS</label>
                  <select
                    value={filterKelasJurnal}
                    onChange={(e) => setFilterKelasJurnal(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs text-slate-900 font-bold focus:outline-none"
                  >
                    <option value="">Semua Kelas</option>
                    {kelasList.map((k) => (
                      <option key={k.id} value={k.id}>{k.nama}</option>
                    ))}
                  </select>
                </div>

                <button
                  onClick={() => handlePrintDocument('jurnal')}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold py-2 rounded-xl text-xs transition shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <span>🖨️</span> Cetak PDF Jurnal Agenda
                </button>
              </div>

              {/* CARD 4: CATATAN BIMBINGAN WALI */}
              <div className="bg-gradient-to-br from-indigo-100/90 via-slate-100/90 to-indigo-50/90 backdrop-blur-md border border-indigo-200/80 rounded-2xl p-4 shadow-xs flex flex-col justify-between space-y-3">
                <div>
                  <div className="flex items-center gap-2 text-indigo-950 font-extrabold text-sm mb-1">
                    <span>📄</span>
                    <h3>Catatan Bimbingan Guru Wali</h3>
                  </div>
                  <p className="text-xs text-slate-600">Laporan penanganan siswa perwalian untuk arsip sekolah.</p>
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold text-indigo-950 uppercase mb-1">PILIH KELAS</label>
                  <select
                    value={filterKelasBimbingan}
                    onChange={(e) => setFilterKelasBimbingan(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs text-slate-900 font-bold focus:outline-none"
                  >
                    <option value="">Semua Kelas</option>
                    {kelasList.map((k) => (
                      <option key={k.id} value={k.id}>{k.nama}</option>
                    ))}
                  </select>
                </div>

                <button
                  onClick={() => handlePrintDocument('bimbingan')}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold py-2 rounded-xl text-xs transition shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <span>🖨️</span> Cetak PDF Bimbingan Wali
                </button>
              </div>

              {/* CARD 5: RIWAYAT HARIAN ABSENSI */}
              <div className="bg-gradient-to-br from-indigo-100/90 via-slate-100/90 to-indigo-50/90 backdrop-blur-md border border-indigo-200/80 rounded-2xl p-4 shadow-xs flex flex-col justify-between space-y-3">
                <div>
                  <div className="flex items-center gap-2 text-indigo-950 font-extrabold text-sm mb-1">
                    <span>📄</span>
                    <h3>Laporan Detail Riwayat Presensi</h3>
                  </div>
                  <p className="text-xs text-slate-600">Riwayat scan dan input absensi harian per tanggal.</p>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-extrabold text-indigo-950 uppercase mb-1">TANGGAL</label>
                    <input
                      type="date"
                      value={tanggalAbsensi}
                      onChange={(e) => setTanggalAbsensi(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl px-2 py-1 text-xs text-slate-900 font-bold focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-extrabold text-indigo-950 uppercase mb-1">KELAS</label>
                    <select
                      value={kelasRiwayatAbsensi}
                      onChange={(e) => setKelasRiwayatAbsensi(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl px-2 py-1 text-xs text-slate-900 font-bold focus:outline-none"
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
                  <span>🖨️</span> Cetak PDF Riwayat Presensi
                </button>
              </div>

              {/* CARD 6: RIWAYAT INPUT NILAI */}
              <div className="bg-gradient-to-br from-indigo-100/90 via-slate-100/90 to-indigo-50/90 backdrop-blur-md border border-indigo-200/80 rounded-2xl p-4 shadow-xs flex flex-col justify-between space-y-3">
                <div>
                  <div className="flex items-center gap-2 text-indigo-950 font-extrabold text-sm mb-1">
                    <span>📄</span>
                    <h3>Laporan Riwayat Input Nilai</h3>
                  </div>
                  <p className="text-xs text-slate-600">Daftar entri nilai Tugas, UTS, dan UAS per mata pelajaran.</p>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-extrabold text-indigo-950 uppercase mb-1">KELAS</label>
                    <select
                      value={kelasNilai}
                      onChange={(e) => setKelasNilai(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl px-2 py-1 text-xs text-slate-900 font-bold focus:outline-none"
                    >
                      <option value="">Semua Kelas</option>
                      {kelasList.map((k) => (
                        <option key={k.id} value={k.id}>{k.nama}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-extrabold text-indigo-950 uppercase mb-1">MAPEL</label>
                    <select
                      value={mapelNilai}
                      onChange={(e) => setMapelNilai(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl px-2 py-1 text-xs text-slate-900 font-bold focus:outline-none"
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

          {/* TAB 2: PENGATURAN PROFIL & KOP SEKOLAH */}
          {activeTab === 'pengaturan' && (
            <div className="space-y-4 pb-12">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* IDENTITAS GURU */}
                <div className="bg-white/90 backdrop-blur-md border border-slate-300 rounded-2xl p-4 space-y-3 shadow-xs">
                  <h3 className="font-extrabold text-indigo-950 text-xs uppercase border-b border-slate-200 pb-2">
                    IDENTITAS GURU PENGAMPU (TTD LAPORAN)
                  </h3>
                  <div className="space-y-2">
                    <div>
                      <label className="block text-[10px] font-extrabold text-slate-600 uppercase mb-1">NAMA LENGKAP & GELAR</label>
                      <input
                        type="text"
                        value={namaGuru}
                        onChange={(e) => setNamaGuru(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-900 font-bold focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-extrabold text-slate-600 uppercase mb-1">NIP / NUPTK</label>
                      <input
                        type="text"
                        value={nipGuru}
                        onChange={(e) => setNipGuru(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-900 font-bold focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* IDENTITAS KEPALA SEKOLAH */}
                <div className="bg-white/90 backdrop-blur-md border border-slate-300 rounded-2xl p-4 space-y-3 shadow-xs">
                  <h3 className="font-extrabold text-indigo-950 text-xs uppercase border-b border-slate-200 pb-2">
                    IDENTITAS KEPALA SEKOLAH
                  </h3>
                  <div className="space-y-2">
                    <div>
                      <label className="block text-[10px] font-extrabold text-slate-600 uppercase mb-1">NAMA KEPALA SEKOLAH</label>
                      <input
                        type="text"
                        value={namaKepsek}
                        onChange={(e) => setNamaKepsek(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-900 font-bold focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-extrabold text-slate-600 uppercase mb-1">NIP / NUPTK KEPALA SEKOLAH</label>
                      <input
                        type="text"
                        value={nipKepsek}
                        onChange={(e) => setNipKepsek(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-900 font-bold focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* IDENTITAS SEKOLAH & KOP SURAT */}
              <div className="bg-white/90 backdrop-blur-md border border-slate-300 rounded-2xl p-4 space-y-3 shadow-xs">
                <h3 className="font-extrabold text-indigo-950 text-xs uppercase border-b border-slate-200 pb-2">
                  IDENTITAS SEKOLAH &amp; KOP SURAT
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-extrabold text-slate-600 uppercase mb-1">YAYASAN / PEMPROV</label>
                    <input
                      type="text"
                      value={pemprov}
                      onChange={(e) => setPemprov(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-900 font-bold focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-extrabold text-slate-600 uppercase mb-1">NAMA SEKOLAH</label>
                    <input
                      type="text"
                      value={namaSekolah}
                      onChange={(e) => setNamaSekolah(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-900 font-bold focus:outline-none"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-[10px] font-extrabold text-slate-600 uppercase mb-1">ALAMAT SEKOLAH</label>
                    <input
                      type="text"
                      value={alamatSekolah}
                      onChange={(e) => setAlamatSekolah(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-900 font-bold focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-extrabold text-slate-600 uppercase mb-1">KOTA / TEMPAT TTD</label>
                    <input
                      type="text"
                      value={kotaTtd}
                      onChange={(e) => setKotaTtd(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-900 font-bold focus:outline-none"
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

        {/* FOOTER BADGE */}
        <div className="pb-16 pt-1 flex justify-center shrink-0 print:hidden">
          <div className="bg-slate-100/90 border border-slate-300 px-4 py-0.5 rounded-full text-center text-[10px] text-slate-700 font-medium shadow-xs">
            <span>Aplikasi Guru AI</span>
            <span className="mx-2">•</span>
            <span>Created by <strong className="text-emerald-900 font-bold">MUZAINI AL KAHFI</strong></span>
          </div>
        </div>

      </div>

      {/* BOTTOM NAVIGATION DOCK */}
      <div className="border-t border-slate-300 bg-slate-100/95 backdrop-blur-md fixed bottom-0 left-0 right-0 z-50 shadow-lg shrink-0 print:hidden">
        <div className="max-w-xl mx-auto px-4 py-2 flex items-center justify-between">
          <Link href="/" className="flex flex-col items-center gap-0.5 text-[11px] font-semibold text-slate-600 hover:text-slate-950 transition">
            <span className="text-base">🕒</span>
            <span>Dashboard</span>
          </Link>

          {isOperator && (
            <Link href="/siswa" className="flex flex-col items-center gap-0.5 text-[11px] font-semibold text-slate-600 hover:text-slate-950 transition">
              <span className="text-base">👥</span>
              <span>Siswa</span>
            </Link>
          )}

          {isOperator && (
            <Link href="/guru" className="flex flex-col items-center gap-0.5 text-[11px] font-semibold text-slate-600 hover:text-slate-950 transition">
              <span className="text-base">👨‍🏫</span>
              <span>Guru</span>
            </Link>
          )}

          <Link href="/jadwal" className="flex flex-col items-center gap-0.5 text-[11px] font-semibold text-slate-600 hover:text-slate-950 transition">
            <span className="text-base">🎓</span>
            <span>Akademik</span>
          </Link>

          <Link href="/laporan" className="flex flex-col items-center gap-0.5 text-[11px] font-bold text-indigo-600 transition">
            <span className="text-base">🖨️</span>
            <span>Laporan</span>
          </Link>
        </div>
      </div>

    </div>
  )
}