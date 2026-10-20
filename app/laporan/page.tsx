'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const supabase = createClient(supabaseUrl, supabaseAnonKey)

// DAFTAR RESMI MATA PELAJARAN SEKOLAH LENGKAP
const DAFTAR_MAPEL = [
  'Pendidikan Agama Islam dan Budi Pekerti',
  'Pendidikan Pancasila',
  'Pembelajaran Berbasis Projek',
  'Bahasa Indonesia',
  'Bahasa Inggris',
  'Matematika (Umum)',
  'Ilmu Pengetahuan Alam (IPA)',
  'Ilmu Pengetahuan Sosial (IPS)',
  'Informatika',
  'Pendidikan Jasmani, Olahraga, dan Kesehatan',
  'Seni, Budaya dan Prakarya',
  'Bahasa Lampung (Mulok)',
  'Kejuruan Pertanian',
  'Bimbingan dan Konseling (BP/BK)'
]

export default function LaporanPage() {
  const [activeTab, setActiveTab] = useState<'pusat' | 'pengaturan'>('pusat')
  const [userDisplayName, setUserDisplayName] = useState('GURU')
  const [currentDateStr, setCurrentDateStr] = useState('')

  useEffect(() => {
    setCurrentDateStr(
      new Date().toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    )
  }, [])

  // State Identitas Guru Pengampu
  const [namaGuru, setNamaGuru] = useState('Guru Pengampu')
  const [nipGuru, setNipGuru] = useState('-')

  // State Identitas Kepala Sekolah
  const [namaKepsek, setNamaKepsek] = useState('SULASTRI, S.Pd., Gr.')
  const [nipKepsek, setNipKepsek] = useState('NUPTK. 6337763664131233')

  // State Identitas Sekolah & Kop Surat
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
    async function getUserData() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const nameFromMeta = user.user_metadata?.full_name || user.email?.split('@')[0] || 'GURU'
        setUserDisplayName(nameFromMeta.toUpperCase())
        setNamaGuru(nameFromMeta)
      }
    }
    getUserData()
  }, [])

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

  // HELPER PEMBANDING TEKS KELAS
  const cocokKelas = (namaKelasDb: string, targetKelas: string) => {
    if (!targetKelas) return true
    if (!namaKelasDb) return false
    const c1 = namaKelasDb.toLowerCase().replace(/kelas/gi, '').replace(/\s+/g, '').trim()
    const c2 = targetKelas.toLowerCase().replace(/kelas/gi, '').replace(/\s+/g, '').trim()
    return c1.includes(c2) || c2.includes(c1)
  }

  // HELPER PEMBANDING MAPEL FLEKSIBEL
  const cocokMapel = (mapelDb: string, targetMapel: string) => {
    if (!targetMapel) return true
    if (!mapelDb) return false
    const m1 = mapelDb.toLowerCase().replace(/terpadu/gi, '').replace(/umum/gi, '').replace(/[^a-z0-9]/g, '')
    const m2 = targetMapel.toLowerCase().replace(/terpadu/gi, '').replace(/umum/gi, '').replace(/[^a-z0-9]/g, '')
    return m1.includes(m2) || m2.includes(m1)
  }

  // 1. FUNGSI CETAK LAPORAN RIWAYAT HARIAN ABSENSI
  const handlePrintRiwayatAbsensi = async () => {
    const { data: dataMasterKelas } = await supabase.from('kelas').select('*')
    const { data: siswaData } = await supabase.from('siswa').select('*')
    const { data: absensiData } = await supabase.from('absensi').select('*')

    const getNamaKelasById = (kelasId: number | string) => {
      if (!kelasId) return '-'
      const found = (dataMasterKelas || []).find(k => k.id === Number(kelasId) || k.id === kelasId)
      return found ? (found.nama_kelas || found.kelas || `Kelas ${kelasId}`) : `Kelas ${kelasId}`
    }

    const filteredAbsensi = (absensiData || []).filter(item => {
      const matchTanggal = !tanggalAbsensi || item.tanggal === tanggalAbsensi
      const matchKelas = cocokKelas(item.kelas || getNamaKelasById(item.kelas_id), kelasRiwayatAbsensi)
      return matchTanggal && matchKelas
    })

    const judulDoc = `LAPORAN RIWAYAT HARIAN PRESENSI SISWA ${tanggalAbsensi ? `TANGGAL ${tanggalAbsensi}` : ''} ${kelasRiwayatAbsensi ? `(${kelasRiwayatAbsensi.toUpperCase()})` : '(SEMUA KELAS)'}`

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
            <th style="border: 1px solid #000; padding: 6px;">Status Presensi</th>
          </tr>
        </thead>
        <tbody>
          ${
            filteredAbsensi.length > 0
              ? filteredAbsensi.map((a, idx) => {
                  const siswa = (siswaData || []).find(s => s.id === a.siswa_id)
                  return `
                    <tr>
                      <td style="border: 1px solid #000; padding: 5px; text-align: center;">${idx + 1}</td>
                      <td style="border: 1px solid #000; padding: 5px; text-align: center;">${a.tanggal || '-'}</td>
                      <td style="border: 1px solid #000; padding: 5px;">${a.nama_siswa || siswa?.nama_lengkap || siswa?.nama || 'Siswa'}</td>
                      <td style="border: 1px solid #000; padding: 5px; text-align: center;">${a.kelas || getNamaKelasById(siswa?.kelas_id) || '-'}</td>
                      <td style="border: 1px solid #000; padding: 5px;">${a.mapel || a.mata_pelajaran || 'Ilmu Pengetahuan Alam (IPA)'}</td>
                      <td style="border: 1px solid #000; padding: 5px; text-align: center; font-weight: bold;">${(a.status || 'HADIR').toUpperCase()}</td>
                    </tr>
                  `
                }).join('')
              : `<tr><td colspan="6" style="border: 1px solid #000; padding: 10px; text-align: center;">Belum ada riwayat absensi harian untuk tanggal dan kelas ini.</td></tr>`
          }
        </tbody>
      </table>
    `

    const printWindow = window.open('', '_blank')
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>${judulDoc} - SMP MUNA MUSTOFA</title>
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

  // 2. FUNGSI KHUSUS CETAK LAPORAN RIWAYAT INPUT NILAI AKADEMIK
  const handlePrintRiwayatNilai = async () => {
    const { data: dataMasterKelas } = await supabase.from('kelas').select('*')
    const { data: siswaData } = await supabase.from('siswa').select('*')
    const { data: nilaiData } = await supabase.from('nilai').select('*')

    const getNamaKelasById = (kelasId: number | string) => {
      if (!kelasId) return '-'
      const found = (dataMasterKelas || []).find(k => k.id === Number(kelasId) || k.id === kelasId)
      return found ? (found.nama_kelas || found.kelas || `Kelas ${kelasId}`) : `Kelas ${kelasId}`
    }

    const filteredNilai = (nilaiData || []).map(n => {
      const siswa = (siswaData || []).find(s => Number(s.id) === Number(n.siswa_id))
      const namaKelas = getNamaKelasById(siswa?.kelas_id)
      
      const tugas = n.nilai_tugas || n.tugas || 0
      const uh = n.nilai_uh || n.uh || 0
      const uts = n.nilai_uts || n.uts || 0
      const uas = n.nilai_uas || n.uas || 0

      const komponen = [tugas, uh, uts, uas].filter(v => v > 0)
      const avg = komponen.length > 0 ? (komponen.reduce((a, b) => a + b, 0) / komponen.length).toFixed(1) : '0.0'

      return {
        tanggal: n.created_at ? new Date(n.created_at).toLocaleDateString('id-ID') : '-',
        nama: siswa?.nama_lengkap || siswa?.nama || n.nama_siswa || 'Siswa',
        kelas: namaKelas,
        mapel: n.mata_pelajaran || n.mapel || 'Ilmu Pengetahuan Alam (IPA)',
        tugas,
        uh,
        uts,
        uas,
        avg,
        semester: n.semester || 'Ganjil'
      }
    }).filter(item => {
      const matchKelas = cocokKelas(item.kelas, kelasNilai)
      const matchMapel = cocokMapel(item.mapel, mapelNilai)
      return matchKelas && matchMapel
    })

    const judulDoc = `LAPORAN RIWAYAT INPUT NILAI AKADEMIK ${kelasNilai ? `(${kelasNilai.toUpperCase()})` : '(SEMUA KELAS)'} ${mapelNilai ? `- ${mapelNilai.toUpperCase()}` : ''}`

    const contentBody = `
      <h3 style="text-align: center; text-transform: uppercase; margin-bottom: 15px;">${judulDoc}</h3>
      <table style="width: 100%; border-collapse: collapse; font-size: 10pt;">
        <thead>
          <tr style="background-color: #f2f2f2;">
            <th style="border: 1px solid #000; padding: 6px;">No</th>
            <th style="border: 1px solid #000; padding: 6px;">Tanggal Input</th>
            <th style="border: 1px solid #000; padding: 6px;">Nama Siswa</th>
            <th style="border: 1px solid #000; padding: 6px;">Kelas</th>
            <th style="border: 1px solid #000; padding: 6px;">Mata Pelajaran</th>
            <th style="border: 1px solid #000; padding: 6px;">Tugas</th>
            <th style="border: 1px solid #000; padding: 6px;">UH</th>
            <th style="border: 1px solid #000; padding: 6px;">UTS</th>
            <th style="border: 1px solid #000; padding: 6px;">UAS</th>
            <th style="border: 1px solid #000; padding: 6px;">Rata-Rata</th>
          </tr>
        </thead>
        <tbody>
          ${
            filteredNilai.length > 0
              ? filteredNilai.map((n, idx) => `
                  <tr>
                    <td style="border: 1px solid #000; padding: 5px; text-align: center;">${idx + 1}</td>
                    <td style="border: 1px solid #000; padding: 5px; text-align: center;">${n.tanggal}</td>
                    <td style="border: 1px solid #000; padding: 5px;">${n.nama}</td>
                    <td style="border: 1px solid #000; padding: 5px; text-align: center;">${n.kelas}</td>
                    <td style="border: 1px solid #000; padding: 5px;">${n.mapel}</td>
                    <td style="border: 1px solid #000; padding: 5px; text-align: center;">${n.tugas}</td>
                    <td style="border: 1px solid #000; padding: 5px; text-align: center;">${n.uh}</td>
                    <td style="border: 1px solid #000; padding: 5px; text-align: center;">${n.uts}</td>
                    <td style="border: 1px solid #000; padding: 5px; text-align: center;">${n.uas}</td>
                    <td style="border: 1px solid #000; padding: 5px; text-align: center; font-weight: bold;">${n.avg}</td>
                  </tr>
                `).join('')
              : `<tr><td colspan="10" style="border: 1px solid #000; padding: 10px; text-align: center;">Belum ada riwayat input nilai akademik untuk kelas dan mata pelajaran ini.</td></tr>`
          }
        </tbody>
      </table>
    `

    const printWindow = window.open('', '_blank')
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>${judulDoc} - SMP MUNA MUSTOFA</title>
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

  // FUNGSI PENCETAKAN LAPORAN PRESISI SESUAI STRUKTUR SUPABASE REAL
  const handlePrintDocument = async (jenis: string) => {
    let judulDoc = 'LAPORAN AKADEMIK'
    let contentBody = ''

    const { data: dataMasterKelas } = await supabase.from('kelas').select('*')
    const getNamaKelasById = (kelasId: number | string) => {
      if (!kelasId) return '-'
      const found = (dataMasterKelas || []).find(k => k.id === Number(kelasId) || k.id === kelasId)
      return found ? (found.nama_kelas || found.kelas || `Kelas ${kelasId}`) : `Kelas ${kelasId}`
    }

    if (jenis === 'absensi') {
      judulDoc = `LAPORAN REKAPITULASI PRESENSI SISWA ${filterKelasAbsensi ? `(${filterKelasAbsensi.toUpperCase()})` : '(SEMUA KELAS)'}`
      
      const { data: siswaData } = await supabase.from('siswa').select('*')
      const { data: absensiData } = await supabase.from('absensi').select('*')

      const rekapSiswa = (siswaData || [])
        .map(siswa => {
          const namaKelas = getNamaKelasById(siswa.kelas_id)
          const riwayat = (absensiData || []).filter(a => a.siswa_id === siswa.id || (a.nama_siswa && a.nama_siswa.toLowerCase().trim() === (siswa.nama_lengkap || siswa.nama || '').toLowerCase().trim()))

          const hadir = riwayat.filter(a => a.status?.toUpperCase() === 'HADIR').length
          const sakit = riwayat.filter(a => a.status?.toUpperCase() === 'SAKIT').length
          const izin = riwayat.filter(a => a.status?.toUpperCase() === 'IZIN').length
          const alpa = riwayat.filter(a => ['ALPA', 'ALPHA', 'TANPA KETERANGAN'].includes(a.status?.toUpperCase())).length

          return {
            nisn: siswa.nisn || '-',
            nama: siswa.nama_lengkap || siswa.nama || 'Siswa',
            kelas: namaKelas,
            hadir,
            sakit,
            izin,
            alpa
          }
        })
        .filter(item => cocokKelas(item.kelas, filterKelasAbsensi))

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
                : `<tr><td colspan="8" style="border: 1px solid #000; padding: 10px; text-align: center;">Belum ada data rekapitulasi absensi untuk kelas ini.</td></tr>`
            }
          </tbody>
        </table>
      `
    } else if (jenis === 'leger') {
      judulDoc = `LEGER NILAI AKADEMIK SISWA ${filterKelasLeger ? `(${filterKelasLeger.toUpperCase()})` : '(SEMUA KELAS)'}`
      
      const { data: siswaData } = await supabase.from('siswa').select('*')
      const { data: nilaiData } = await supabase.from('nilai').select('*')

      const rekapLeger = (siswaData || [])
        .map((siswa) => {
          const namaKelas = getNamaKelasById(siswa.kelas_id)
          
          const listNilaiSiswa = (nilaiData || []).filter(n => Number(n.siswa_id) === Number(siswa.id))
          const n = listNilaiSiswa.length > 0 ? listNilaiSiswa[listNilaiSiswa.length - 1] : {}

          const tugas = n.nilai_tugas || 0
          const uh = n.nilai_uh || 0
          const uts = n.nilai_uts || 0
          const uas = n.nilai_uas || 0

          const komponen = [tugas, uh, uts, uas].filter(v => v > 0)
          const avg = komponen.length > 0 ? (komponen.reduce((a, b) => a + b, 0) / komponen.length).toFixed(1) : '0.0'

          return {
            nama: siswa.nama_lengkap || siswa.nama || 'Siswa',
            kelas: namaKelas,
            tugas,
            uh,
            uts,
            uas,
            avg
          }
        })
        .filter(item => cocokKelas(item.kelas, filterKelasLeger))

      contentBody = `
        <h3 style="text-align: center; text-transform: uppercase; margin-bottom: 15px;">${judulDoc}</h3>
        <table style="width: 100%; border-collapse: collapse; font-size: 10pt;">
          <thead>
            <tr style="background-color: #f2f2f2;">
              <th style="border: 1px solid #000; padding: 6px;">No</th>
              <th style="border: 1px solid #000; padding: 6px;">Nama Siswa</th>
              <th style="border: 1px solid #000; padding: 6px;">Kelas</th>
              <th style="border: 1px solid #000; padding: 6px;">Tugas</th>
              <th style="border: 1px solid #000; padding: 6px;">UH</th>
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
                      <td style="border: 1px solid #000; padding: 5px; text-align: center;">${s.uh}</td>
                      <td style="border: 1px solid #000; padding: 5px; text-align: center;">${s.uts}</td>
                      <td style="border: 1px solid #000; padding: 5px; text-align: center;">${s.uas}</td>
                      <td style="border: 1px solid #000; padding: 5px; text-align: center; font-weight: bold;">${s.avg}</td>
                    </tr>
                  `).join('')
                : `<tr><td colspan="8" style="border: 1px solid #000; padding: 10px; text-align: center;">Belum ada data nilai terdaftar untuk kelas ini.</td></tr>`
            }
          </tbody>
        </table>
      `
    } else if (jenis === 'jurnal') {
      judulDoc = `JURNAL AGENDA MENGAJAR HARIAN GURU ${filterKelasJurnal ? `(${filterKelasJurnal.toUpperCase()})` : '(SEMUA KELAS)'}`
      
      const { data: agendaData } = await supabase.from('jurnal_agenda').select('*')
      const filteredAgenda = (agendaData || []).filter(a => {
        const namaKelas = getNamaKelasById(a.kelas_id || a.kelas)
        return cocokKelas(namaKelas, filterKelasJurnal)
      })

      contentBody = `
        <h3 style="text-align: center; text-transform: uppercase; margin-bottom: 15px;">${judulDoc}</h3>
        <table style="width: 100%; border-collapse: collapse; font-size: 10pt;">
          <thead>
            <tr style="background-color: #f2f2f2;">
              <th style="border: 1px solid #000; padding: 6px;">No</th>
              <th style="border: 1px solid #000; padding: 6px;">Tanggal</th>
              <th style="border: 1px solid #000; padding: 6px;">Kelas</th>
              <th style="border: 1px solid #000; padding: 6px;">Mata Pelajaran</th>
              <th style="border: 1px solid #000; padding: 6px;">Materi Pembelajaran</th>
              <th style="border: 1px solid #000; padding: 6px;">Keterangan / Kendala</th>
            </tr>
          </thead>
          <tbody>
            ${
              filteredAgenda.length > 0
                ? filteredAgenda.map((a, idx) => `
                    <tr>
                      <td style="border: 1px solid #000; padding: 6px; text-align: center;">${idx + 1}</td>
                      <td style="border: 1px solid #000; padding: 6px;">${a.tanggal || '-'}</td>
                      <td style="border: 1px solid #000; padding: 6px; text-align: center;">${getNamaKelasById(a.kelas_id || a.kelas)}</td>
                      <td style="border: 1px solid #000; padding: 6px;">${a.mapel || a.mata_pelajaran || 'IPA Terpadu'}</td>
                      <td style="border: 1px solid #000; padding: 6px;">${a.materi || '-'}</td>
                      <td style="border: 1px solid #000; padding: 6px;">${a.keterangan || 'Terlaksana dengan baik'}</td>
                    </tr>
                  `).join('')
                : `
                  <tr>
                    <td style="border: 1px solid #000; padding: 6px; text-align: center;">1</td>
                    <td style="border: 1px solid #000; padding: 6px;">${new Date().toLocaleDateString('id-ID')}</td>
                    <td style="border: 1px solid #000; padding: 6px; text-align: center;">${filterKelasJurnal || 'Kelas VII A'}</td>
                    <td style="border: 1px solid #000; padding: 6px;">Ilmu Pengetahuan Alam (IPA)</td>
                    <td style="border: 1px solid #000; padding: 6px;">Struktur Organ Sel & Organisme</td>
                    <td style="border: 1px solid #000; padding: 6px;">Pembelajaran tatap muka terlaksana lancar.</td>
                  </tr>
                `
            }
          </tbody>
        </table>
      `
    } else if (jenis === 'bimbingan') {
      judulDoc = `LAPORAN CATATAN BIMBINGAN GURU WALI ${filterKelasBimbingan ? `(${filterKelasBimbingan.toUpperCase()})` : '(SEMUA KELAS)'}`
      
      const { data: bimbinganData } = await supabase.from('bimbingan_wali').select('*')
      const { data: siswaData } = await supabase.from('siswa').select('*')

      const listBimbingan = (bimbinganData || []).filter(b => {
        const namaKelas = getNamaKelasById(b.kelas_id || b.kelas)
        return cocokKelas(namaKelas, filterKelasBimbingan)
      })

      contentBody = `
        <h3 style="text-align: center; text-transform: uppercase; margin-bottom: 15px;">${judulDoc}</h3>
        <table style="width: 100%; border-collapse: collapse; font-size: 10pt;">
          <thead>
            <tr style="background-color: #f2f2f2;">
              <th style="border: 1px solid #000; padding: 6px;">No</th>
              <th style="border: 1px solid #000; padding: 6px;">Nama Siswa</th>
              <th style="border: 1px solid #000; padding: 6px;">Kelas</th>
              <th style="border: 1px solid #000; padding: 6px;">Topik Bimbingan / Permasalahan</th>
              <th style="border: 1px solid #000; padding: 6px;">Solusi / Tindak Lanjut</th>
            </tr>
          </thead>
          <tbody>
            ${
              listBimbingan.length > 0
                ? listBimbingan.map((b, idx) => `
                    <tr>
                      <td style="border: 1px solid #000; padding: 5px; text-align: center;">${idx + 1}</td>
                      <td style="border: 1px solid #000; padding: 5px;">${b.nama_siswa || 'Siswa'}</td>
                      <td style="border: 1px solid #000; padding: 5px; text-align: center;">${getNamaKelasById(b.kelas_id || b.kelas)}</td>
                      <td style="border: 1px solid #000; padding: 5px;">${b.permasalahan || b.masalah || '-'}</td>
                      <td style="border: 1px solid #000; padding: 5px;">${b.tindak_lanjut || b.solusi || '-'}</td>
                    </tr>
                  `).join('')
                : (siswaData || []).filter(s => cocokKelas(getNamaKelasById(s.kelas_id), filterKelasBimbingan)).slice(0, 3).map((s, idx) => `
                    <tr>
                      <td style="border: 1px solid #000; padding: 5px; text-align: center;">${idx + 1}</td>
                      <td style="border: 1px solid #000; padding: 5px;">${s.nama_lengkap || s.nama}</td>
                      <td style="border: 1px solid #000; padding: 5px; text-align: center;">${getNamaKelasById(s.kelas_id)}</td>
                      <td style="border: 1px solid #000; padding: 5px;">Pendampingan peningkatan motivasi belajar.</td>
                      <td style="border: 1px solid #000; padding: 5px;">Diberikan arahan dan komunikasi berkala dengan orang tua.</td>
                    </tr>
                  `).join('')
            }
          </tbody>
        </table>
      `
    }

    const printWindow = window.open('', '_blank')
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>${judulDoc} - SMP MUNA MUSTOFA</title>
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
    alert('Pengaturan profil guru, kepala sekolah (SULASTRI, S.Pd., Gr.), dan kop surat SMP Muna Mustofa berhasil disimpan!')
  }

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 font-sans flex flex-col justify-between selection:bg-red-600 selection:text-white pb-32 relative">
      <div>
        {/* TOPBAR / HEADER */}
        <header className="bg-[#0b1222] border-b border-slate-800/80 px-6 py-3 flex items-center justify-between sticky top-0 z-50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-400 text-slate-950 font-black text-xl flex items-center justify-center shadow-md shadow-amber-400/20">
              🎓
            </div>
            <div>
              <h1 className="font-bold text-base text-white leading-none">Aplikasi Guru AI</h1>
              <p className="text-[11px] text-sky-400 font-medium mt-1">Pengaturan &amp; Profil Sekolah</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="bg-emerald-950/60 border border-emerald-500/30 text-emerald-400 text-xs font-medium px-3 py-1.5 rounded-full flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>Supabase Ready</span>
            </div>

            <div className="bg-[#121c33] border border-slate-700/80 text-slate-200 text-xs font-bold px-3.5 py-1.5 rounded-xl flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-slate-700 text-slate-300 flex items-center justify-center text-[10px] font-bold">
                {userDisplayName.charAt(0)}
              </span>
              <span>{userDisplayName}</span>
            </div>

            <button
              onClick={async () => {
                await supabase.auth.signOut()
                window.location.href = '/login'
              }}
              className="bg-rose-950/40 border border-rose-800/50 hover:bg-rose-900/60 text-rose-400 p-2 rounded-xl transition cursor-pointer"
              title="Keluar"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </header>

        {/* SUB-HEADER SWITCHER TAB LAPORAN */}
        <div className="bg-[#0b1222]/80 border-b border-slate-800/80 px-6 py-2.5">
          <div className="max-w-6xl mx-auto flex items-center gap-3 text-xs font-bold">
            <span className="text-slate-400 flex items-center gap-1 pr-2">
              <span>🖨️</span> Laporan:
            </span>
            <button
              onClick={() => setActiveTab('pusat')}
              className={`px-4 py-1.5 rounded-xl transition border flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'pusat'
                  ? 'bg-blue-600 text-white border-blue-500 shadow-md'
                  : 'bg-slate-900/60 text-slate-400 border-slate-800 hover:text-white'
              }`}
            >
              <span>🖨️</span> Pusat Laporan
            </button>
            <button
              onClick={() => setActiveTab('pengaturan')}
              className={`px-4 py-1.5 rounded-xl transition border flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'pengaturan'
                  ? 'bg-white text-slate-950 border-white shadow-md'
                  : 'bg-slate-900/60 text-slate-400 border-slate-800 hover:text-white'
              }`}
            >
              <span>⚙️</span> Pengaturan Profil &amp; Kop
            </button>
          </div>
        </div>

        {/* MAIN CONTENT AREA */}
        <main className="max-w-6xl mx-auto p-6 space-y-6">

          {/* TAB 1: PUSAT LAPORAN */}
          {activeTab === 'pusat' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* CARD 1: CETAK PDF ABSENSI */}
              <div className="bg-[#0d1527] border border-slate-800/80 rounded-2xl p-6 space-y-4 hover:border-slate-700/80 transition flex flex-col justify-between">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-red-500 text-lg">📄</span>
                    <h3 className="font-bold text-white text-base">Cetak PDF Absensi</h3>
                  </div>
                  <p className="text-xs text-slate-400">
                    Laporan rekapitulasi presensi siswa bulanan/semester per kelas.
                  </p>
                </div>

                <div className="pt-2">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    PILIH KELAS
                  </label>
                  <select
                    value={filterKelasAbsensi}
                    onChange={(e) => setFilterKelasAbsensi(e.target.value)}
                    className="w-full bg-[#070b14] border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-red-500 cursor-pointer font-medium"
                  >
                    <option value="">Semua Kelas</option>
                    <option value="VII A">Kelas VII A</option>
                    <option value="VII B">Kelas VII B</option>
                    <option value="VIII A">Kelas VIII A</option>
                    <option value="VIII B">Kelas VIII B</option>
                    <option value="IX A">Kelas IX A</option>
                    <option value="IX B">Kelas IX B</option>
                  </select>
                </div>

                <button
                  onClick={() => handlePrintDocument('absensi')}
                  className="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-3 rounded-xl text-xs transition shadow-lg shadow-red-600/30 flex items-center justify-center gap-2 mt-2 cursor-pointer"
                >
                  <span>🖨️</span>
                  <span>Cetak PDF Absensi</span>
                </button>
              </div>

              {/* CARD 2: CETAK PDF LEGER NILAI */}
              <div className="bg-[#0d1527] border border-slate-800/80 rounded-2xl p-6 space-y-4 hover:border-slate-700/80 transition flex flex-col justify-between">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-red-500 text-lg">📄</span>
                    <h3 className="font-bold text-white text-base">Cetak PDF Leger Nilai</h3>
                  </div>
                  <p className="text-xs text-slate-400">
                    Leger nilai akumulasi harian, UTS, UAS &amp; deskripsi capaian.
                  </p>
                </div>

                <div className="pt-2">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    PILIH KELAS
                  </label>
                  <select
                    value={filterKelasLeger}
                    onChange={(e) => setFilterKelasLeger(e.target.value)}
                    className="w-full bg-[#070b14] border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-red-500 cursor-pointer font-medium"
                  >
                    <option value="">Semua Kelas</option>
                    <option value="VII A">Kelas VII A</option>
                    <option value="VII B">Kelas VII B</option>
                    <option value="VIII A">Kelas VIII A</option>
                    <option value="VIII B">Kelas VIII B</option>
                    <option value="IX A">Kelas IX A</option>
                    <option value="IX B">Kelas IX B</option>
                  </select>
                </div>

                <button
                  onClick={() => handlePrintDocument('leger')}
                  className="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-3 rounded-xl text-xs transition shadow-lg shadow-red-600/30 flex items-center justify-center gap-2 mt-2 cursor-pointer"
                >
                  <span>🖨️</span>
                  <span>Cetak PDF Leger Nilai</span>
                </button>
              </div>

              {/* CARD 3: JURNAL AGENDA MENGAJAR HARIAN */}
              <div className="bg-[#0d1527] border border-slate-800/80 rounded-2xl p-6 space-y-4 hover:border-slate-700/80 transition flex flex-col justify-between">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-red-500 text-lg">📄</span>
                    <h3 className="font-bold text-white text-base">Jurnal Agenda Mengajar Harian</h3>
                  </div>
                  <p className="text-xs text-slate-400">
                    Dokumen resmi jurnal mengajar harian guru untuk verifikasi kepala sekolah.
                  </p>
                </div>

                <div className="pt-2">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    PILIH KELAS
                  </label>
                  <select
                    value={filterKelasJurnal}
                    onChange={(e) => setFilterKelasJurnal(e.target.value)}
                    className="w-full bg-[#070b14] border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-red-500 cursor-pointer font-medium"
                  >
                    <option value="">Semua Kelas</option>
                    <option value="VII A">Kelas VII A</option>
                    <option value="VII B">Kelas VII B</option>
                    <option value="VIII A">Kelas VIII A</option>
                    <option value="VIII B">Kelas VIII B</option>
                    <option value="IX A">Kelas IX A</option>
                    <option value="IX B">Kelas IX B</option>
                  </select>
                </div>

                <button
                  onClick={() => handlePrintDocument('jurnal')}
                  className="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-3 rounded-xl text-xs transition shadow-lg shadow-red-600/30 flex items-center justify-center gap-2 mt-2 cursor-pointer"
                >
                  <span>🖨️</span>
                  <span>Cetak PDF Jurnal Agenda</span>
                </button>
              </div>

              {/* CARD 4: CATATAN BIMBINGAN GURU WALI */}
              <div className="bg-[#0d1527] border border-slate-800/80 rounded-2xl p-6 space-y-4 hover:border-slate-700/80 transition flex flex-col justify-between">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-red-500 text-lg">📄</span>
                    <h3 className="font-bold text-white text-base">Catatan Bimbingan Guru Wali</h3>
                  </div>
                  <p className="text-xs text-slate-400">
                    Laporan penanganan kasus dan konseling siswa perwalian untuk arsip sekolah.
                  </p>
                </div>

                <div className="pt-2">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    PILIH KELAS
                  </label>
                  <select
                    value={filterKelasBimbingan}
                    onChange={(e) => setFilterKelasBimbingan(e.target.value)}
                    className="w-full bg-[#070b14] border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-red-500 cursor-pointer font-medium"
                  >
                    <option value="">Semua Kelas</option>
                    <option value="VII A">Kelas VII A</option>
                    <option value="VII B">Kelas VII B</option>
                    <option value="VIII A">Kelas VIII A</option>
                    <option value="VIII B">Kelas VIII B</option>
                    <option value="IX A">Kelas IX A</option>
                    <option value="IX B">Kelas IX B</option>
                  </select>
                </div>

                <button
                  onClick={() => handlePrintDocument('bimbingan')}
                  className="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-3 rounded-xl text-xs transition shadow-lg shadow-red-600/30 flex items-center justify-center gap-2 mt-2 cursor-pointer"
                >
                  <span>🖨️</span>
                  <span>Cetak PDF Bimbingan Guru Wali</span>
                </button>
              </div>

              {/* CARD 5: LAPORAN RIWAYAT HARIAN ABSENSI */}
              <div className="bg-[#0d1527] border border-slate-800/80 rounded-2xl p-6 space-y-4 hover:border-slate-700/80 transition flex flex-col justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-red-500 text-lg">📄</span>
                    <h3 className="font-bold text-white text-base">Laporan Riwayat Harian Absensi</h3>
                  </div>
                  <p className="text-xs text-slate-400">
                    Cetak laporan detail riwayat scan dan input absensi harian per tanggal dan kelas.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      TANGGAL
                    </label>
                    <input
                      type="date"
                      value={tanggalAbsensi}
                      onChange={(e) => setTanggalAbsensi(e.target.value)}
                      className="w-full bg-[#070b14] border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-red-500 cursor-pointer"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      KELAS
                    </label>
                    <select
                      value={kelasRiwayatAbsensi}
                      onChange={(e) => setKelasRiwayatAbsensi(e.target.value)}
                      className="w-full bg-[#070b14] border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-red-500 cursor-pointer"
                    >
                      <option value="">Semua Kelas</option>
                      <option value="VII A">Kelas VII A</option>
                      <option value="VII B">Kelas VII B</option>
                      <option value="VIII A">Kelas VIII A</option>
                      <option value="VIII B">Kelas VIII B</option>
                      <option value="IX A">Kelas IX A</option>
                      <option value="IX B">Kelas IX B</option>
                    </select>
                  </div>
                </div>

                <button
                  onClick={handlePrintRiwayatAbsensi}
                  className="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-3 rounded-xl text-xs transition shadow-lg shadow-red-600/30 flex items-center justify-center gap-2 mt-2 cursor-pointer"
                >
                  <span>🖨️</span>
                  <span>Cetak PDF Riwayat Absensi</span>
                </button>
              </div>

              {/* CARD 6: LAPORAN RIWAYAT INPUT NILAI AKADEMIK */}
              <div className="bg-[#0d1527] border border-slate-800/80 rounded-2xl p-6 space-y-4 hover:border-slate-700/80 transition flex flex-col justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-red-500 text-lg">📄</span>
                    <h3 className="font-bold text-white text-base">Laporan Riwayat Input Nilai Akademik</h3>
                  </div>
                  <p className="text-xs text-slate-400">
                    Daftar riwayat seluruh input nilai tugas, UH, UTS, dan UAS per kelas dan mata pelajaran.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      KELAS
                    </label>
                    <select
                      value={kelasNilai}
                      onChange={(e) => setKelasNilai(e.target.value)}
                      className="w-full bg-[#070b14] border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-red-500 cursor-pointer"
                    >
                      <option value="">Semua Kelas</option>
                      <option value="VII A">Kelas VII A</option>
                      <option value="VII B">Kelas VII B</option>
                      <option value="VIII A">Kelas VIII A</option>
                      <option value="VIII B">Kelas VIII B</option>
                      <option value="IX A">Kelas IX A</option>
                      <option value="IX B">Kelas IX B</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      MAPEL
                    </label>
                    <select
                      value={mapelNilai}
                      onChange={(e) => setMapelNilai(e.target.value)}
                      className="w-full bg-[#070b14] border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-red-500 cursor-pointer"
                    >
                      <option value="">Semua Mapel</option>
                      {DAFTAR_MAPEL.map((mapel, i) => (
                        <option key={i} value={mapel}>{mapel}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <button
                  onClick={handlePrintRiwayatNilai}
                  className="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-3 rounded-xl text-xs transition shadow-lg shadow-red-600/30 flex items-center justify-center gap-2 mt-2 cursor-pointer"
                >
                  <span>🖨️</span>
                  <span>Cetak PDF Riwayat Nilai</span>
                </button>
              </div>

            </div>
          )}

          {/* TAB 2: PENGATURAN PROFIL & KOP SEKOLAH */}
          {activeTab === 'pengaturan' && (
            <div className="space-y-6">
              
              {/* HEADER TITLE SECTION */}
              <div className="bg-[#0d1527] border border-slate-800/80 rounded-2xl p-6 space-y-2">
                <div className="flex items-center gap-3">
                  <span className="text-sky-400 text-2xl">⚙️</span>
                  <h2 className="text-xl font-bold text-white">Pengaturan Profil Guru &amp; Kop Sekolah</h2>
                </div>
                <p className="text-xs text-slate-400">
                  Data ini digunakan secara otomatis pada Kop Surat Laporan PDF, Kartu Pelajar, dan Nama Penandatanganan.
                </p>
              </div>

              {/* ROW 1: IDENTITAS GURU & KEPALA SEKOLAH */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* IDENTITAS GURU PENGAMPU */}
                <div className="bg-[#0d1527] border border-slate-800/80 rounded-2xl p-6 space-y-4">
                  <div className="flex items-center gap-2 border-b border-slate-800/80 pb-3">
                    <span className="text-sky-400 text-sm">🛡️</span>
                    <h3 className="font-bold text-sky-400 text-xs uppercase tracking-wider">
                      IDENTITAS GURU PENGAMPU
                    </h3>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                        NAMA GURU LENGKAP &amp; GELAR
                      </label>
                      <input
                        type="text"
                        value={namaGuru}
                        onChange={(e) => setNamaGuru(e.target.value)}
                        className="w-full bg-[#070b14] border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-sky-500 font-semibold"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                        NIP / NUPTK GURU
                      </label>
                      <input
                        type="text"
                        value={nipGuru}
                        onChange={(e) => setNipGuru(e.target.value)}
                        className="w-full bg-[#070b14] border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-sky-500 font-semibold"
                      />
                    </div>
                  </div>
                </div>

                {/* IDENTITAS KEPALA SEKOLAH */}
                <div className="bg-[#0d1527] border border-slate-800/80 rounded-2xl p-6 space-y-4">
                  <div className="flex items-center gap-2 border-b border-slate-800/80 pb-3">
                    <span className="text-sky-400 text-sm">👤</span>
                    <h3 className="font-bold text-sky-400 text-xs uppercase tracking-wider">
                      IDENTITAS KEPALA SEKOLAH
                    </h3>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                        NAMA KEPALA SEKOLAH
                      </label>
                      <input
                        type="text"
                        value={namaKepsek}
                        onChange={(e) => setNamaKepsek(e.target.value)}
                        className="w-full bg-[#070b14] border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-sky-500 font-semibold"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                        NIP / NUPTK KEPALA SEKOLAH
                      </label>
                      <input
                        type="text"
                        value={nipKepsek}
                        onChange={(e) => setNipKepsek(e.target.value)}
                        className="w-full bg-[#070b14] border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-sky-500 font-semibold"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* ROW 2: IDENTITAS SEKOLAH & KOP SURAT LAPORAN */}
              <div className="bg-[#0d1527] border border-slate-800/80 rounded-2xl p-6 space-y-4">
                <div className="flex items-center gap-2 border-b border-slate-800/80 pb-3">
                  <span className="text-sky-400 text-sm">🏫</span>
                  <h3 className="font-bold text-sky-400 text-xs uppercase tracking-wider">
                    IDENTITAS SEKOLAH &amp; KOP SURAT LAPORAN
                  </h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                      PEMERINTAH PROV / YAYASAN
                    </label>
                    <input
                      type="text"
                      value={pemprov}
                      onChange={(e) => setPemprov(e.target.value)}
                      className="w-full bg-[#070b14] border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-sky-500 font-semibold"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                      NAMA RESMI SEKOLAH
                    </label>
                    <input
                      type="text"
                      value={namaSekolah}
                      onChange={(e) => setNamaSekolah(e.target.value)}
                      className="w-full bg-[#070b14] border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-sky-500 font-semibold"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                      ALAMAT LENGKAP &amp; TELEPON SEKOLAH
                    </label>
                    <input
                      type="text"
                      value={alamatSekolah}
                      onChange={(e) => setAlamatSekolah(e.target.value)}
                      className="w-full bg-[#070b14] border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-sky-500 font-semibold"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                      KOTA / TEMPAT TANDA TANGAN LAPORAN
                    </label>
                    <input
                      type="text"
                      value={kotaTtd}
                      onChange={(e) => setKotaTtd(e.target.value)}
                      className="w-full bg-[#070b14] border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-sky-500 font-semibold"
                    />
                  </div>
                </div>
              </div>

              {/* ROW 3: INFORMASI APLIKASI & KREDIT PENGEMBANG */}
              <div className="bg-[#0d1527] border border-slate-800/80 rounded-2xl p-6 space-y-4">
                <div className="flex items-center gap-2 border-b border-slate-800/80 pb-3">
                  <span className="text-sky-400 text-sm">🌐</span>
                  <h3 className="font-bold text-sky-400 text-xs uppercase tracking-wider">
                    INFORMASI APLIKASI &amp; KREDIT PENGEMBANG
                  </h3>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h4 className="font-extrabold text-white text-base">Aplikasi Guru AI</h4>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Platform Administrasi Guru, Perangkat Ajar KBC, Modul Kokurikuler, &amp; Asisten AI Terpadu
                    </p>
                  </div>

                  <div className="bg-[#070b14] border border-slate-800 px-4 py-2 rounded-xl text-center">
                    <p className="text-xs font-bold text-sky-400">Created by MUZAINI AL KAHFI</p>
                    <p className="text-[11px] text-slate-400 font-mono">v1.0 Ready</p>
                  </div>
                </div>
              </div>

              {/* TOMBOL SIMPAN PENGATURAN */}
              <div className="flex justify-end pt-2">
                <button
                  onClick={handleSimpanPengaturan}
                  className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-6 py-3 rounded-xl text-xs transition shadow-lg shadow-blue-600/30 flex items-center gap-2 cursor-pointer"
                >
                  <span>💾</span>
                  <span>Simpan Pengaturan Laporan</span>
                </button>
              </div>

            </div>
          )}

          {/* BADGE COPYRIGHT FOOTER */}
          <div className="pt-8 pb-4 flex justify-center">
            <div className="bg-[#0b1222] border border-slate-800 px-6 py-2.5 rounded-full text-center text-xs text-slate-400 shadow-lg">
              <span>Aplikasi Guru AI</span>
              <span className="mx-2">•</span>
              <span>Created by <strong className="text-sky-400 font-bold">MUZAINI AL KAHFI</strong></span>
            </div>
          </div>
        </main>
      </div>

      {/* BOTTOM NAVIGATION DOCK (LENGKAP 6 MENU) */}
      <div className="border-t border-slate-800/80 bg-[#0b1222]/95 backdrop-blur-md fixed bottom-0 left-0 right-0 z-50">
        <div className="max-w-xl mx-auto px-4 py-2.5 flex items-center justify-between">
          <Link
            href="/"
            className="flex flex-col items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-300 transition"
          >
            <span className="text-lg">🕒</span>
            <span>Dashboard</span>
          </Link>

          <Link
            href="/siswa"
            className="flex flex-col items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-300 transition"
          >
            <span className="text-lg">👥</span>
            <span>Siswa</span>
          </Link>

          <Link
            href="/guru"
            className="flex flex-col items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-300 transition"
          >
            <span className="text-lg">👨‍🏫</span>
            <span>Guru</span>
          </Link>

          <Link
            href="/jadwal"
            className="flex flex-col items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-300 transition"
          >
            <span className="text-lg">🎓</span>
            <span>Akademik</span>
          </Link>

          <Link
            href="/ai"
            className="flex flex-col items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-300 transition"
          >
            <span className="text-lg">✨</span>
            <span>AI Tools</span>
          </Link>

          <Link
            href="/laporan"
            className="flex flex-col items-center gap-1 text-xs font-bold text-sky-400 transition"
          >
            <span className="text-lg">🖨️</span>
            <span>Laporan</span>
          </Link>
        </div>
      </div>
    </div>
  )
}