'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { motion } from 'framer-motion'
import { useAuthRole } from '@/hooks/useAuthRole'

const getSupabaseUrl = () => (process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://kvrulbdvgxfrtmznpjnm.supabase.co').replace(/['"]/g, '').trim()
const getSupabaseAnonKey = () => (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder').replace(/['"]/g, '').trim()
const supabase = createClient(getSupabaseUrl(), getSupabaseAnonKey())

interface SuratAdministrasi {
  id: number
  created_at?: string
  nomor_surat: string
  jenis_surat: string
  penerima: string
  keterangan: string
  semester?: string
  tahun_ajaran?: string
}

interface OptionItem {
  id: number
  nama: string
  extraInfo?: string
  nisn?: string
  ttl?: string
  jk?: string
  sekolahAsal?: string
  ortu?: string
  alamat?: string
  jabatan?: string
  nuptk?: string
}

const KODE_SURAT_MAP: Record<string, string> = {
  'Surat Keterangan Bersedia Menerima': '421',
  'Surat Keterangan Aktif Siswa': '421',
  'Surat Mutasi Siswa': '422',
  'Surat Undangan Orang Tua/Wali': '005',
  'Surat Tugas Guru': '800',
  'Surat Keputusan Kepala Sekolah': '188',
}

export default function AdministrasiTUPage() {
  const router = useRouter()
  const { isOperator, loading: loadingRole } = useAuthRole()
  const previewRef = useRef<HTMLDivElement>(null)

  const [userDisplayName, setUserDisplayName] = useState('OPERATOR')
  const [suratList, setSuratList] = useState<SuratAdministrasi[]>([])
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false)

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme')
    if (savedTheme === 'dark') setIsDarkMode(true)
  }, [])

  const [selectedSemester, setSelectedSemester] = useState<'Ganjil' | 'Genap'>('Ganjil')
  const [selectedTahunAjaran, setSelectedTahunAjaran] = useState('2026/2027')
  
  // State Form Utama
  const [jenisSurat, setJenisSurat] = useState('Surat Keterangan Bersedia Menerima')
  const [penerima, setPenerima] = useState('')
  const [nomorSurat, setNomorSurat] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  // State Detail Parameter Spesifik Surat
  const [nisn, setNisn] = useState('')
  const [ttl, setTtl] = useState('')
  const [jenisKelamin, setJenisKelamin] = useState('Laki-laki')
  const [sekolahAsal, setSekolahAsal] = useState('')
  const [namaOrtu, setNamaOrtu] = useState('')
  const [alamatSiswa, setAlamatSiswa] = useState('')
  const [tingkatKelas, setTingkatKelas] = useState('Kelas VII (Tujuh)')
  const [rombel, setRombel] = useState('7B')

  // Parameter Khusus Guru / SK / Undangan
  const [jabatanGuru, setJabatanGuru] = useState('Guru Mata Pelajaran')
  const [nuptkGuru, setNuptkGuru] = useState('-')
  const [sekolahTujuan, setSekolahTujuan] = useState('')
  const [keperluanAktif, setKeperluanAktif] = useState('')
  const [hariTanggal, setHariTanggal] = useState('')
  const [waktuAcara, setWaktuAcara] = useState('')
  const [tempatAcara, setTempatAcara] = useState('')
  const [namaAcara, setNamaAcara] = useState('')
  const [tugasLokasi, setTugasLokasi] = useState('')
  const [perihalSk, setPerihalSk] = useState('')
  const [diktumSk, setDiktumSk] = useState('')

  // Toggle Cetak TTD & Stempel
  const [includeTTD, setIncludeTTD] = useState(true)
  const [includeStempel, setIncludeStempel] = useState(true)

  // Smart Options dari Supabase
  const [siswaOptions, setSiswaOptions] = useState<OptionItem[]>([])
  const [guruOptions, setGuruOptions] = useState<OptionItem[]>([])
  const [selectedEntityId, setSelectedEntityId] = useState('')

  useEffect(() => {
    if (!loadingRole && !isOperator) router.push('/')
  }, [loadingRole, isOperator, router])

  useEffect(() => {
    async function getUserData() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const nameFromMeta = user.user_metadata?.full_name || user.email?.split('@')[0] || 'OPERATOR'
        setUserDisplayName(String(nameFromMeta).toUpperCase())
      }
    }
    getUserData()
    fetchSmartOptions()
  }, [])

  useEffect(() => {
    fetchSurat()
  }, [selectedSemester, selectedTahunAjaran])

  useEffect(() => {
    if (!editingId && jenisSurat) generateAutoNomorSurat(jenisSurat)
  }, [jenisSurat, selectedTahunAjaran, editingId])

  const generateAutoNomorSurat = async (jenis: string) => {
    const kodeKlasifikasi = KODE_SURAT_MAP[jenis] || '421'
    const tahun = selectedTahunAjaran.split('/')[0] || '2026'
    const bulanRomawi = ['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII'][new Date().getMonth()]

    const { count, error } = await supabase
      .from('surat_administrasi')
      .select('id', { count: 'exact', head: true })
      .eq('jenis_surat', jenis)
      .eq('tahun_ajaran', selectedTahunAjaran)

    if (!error) {
      const nextIndex = (count || 0) + 1
      const formattedIndex = String(nextIndex).padStart(3, '0')
      setNomorSurat(`${kodeKlasifikasi}/${formattedIndex}/SMP.MM/${bulanRomawi}/${tahun}`)
    }
  }

  // ACCURATE FETCH DARI STRUKTUR TABEL SUPABASE
  const fetchSmartOptions = async () => {
    // 1. Fetch Siswa
    const { data: dataSiswa } = await supabase.from('siswa').select('*').order('id')
    if (dataSiswa) {
      setSiswaOptions(dataSiswa.map((s: Record<string, any>) => {
        const namaReal = s.nama_lengkap || s.nama || ''
        return {
          id: Number(s.id), 
          nama: String(namaReal), 
          extraInfo: `NISN: ${s.nisn || '-'}`,
          nisn: s.nisn || '',
          ttl: `${s.tempat_lahir || ''}, ${s.tanggal_lahir || ''}`,
          jk: s.jenis_kelamin || 'Laki-laki',
          sekolahAsal: s.sekolah_asal || '',
          ortu: s.nama_ayah || s.nama_ibu || s.nama_wali || '',
          alamat: s.alamat || ''
        }
      }))
    }

    // 2. Fetch Guru (Menggunakan Kolom: nama_lengkap, jabatan, mapel, NUPTK)
    const { data: dataGuru } = await supabase.from('guru').select('*').order('id')
    if (dataGuru) {
      setGuruOptions(dataGuru.map((g: Record<string, any>) => {
        const namaReal = g.nama_lengkap || g.nama_guru || g.nama || ''
        const jabatan = g.jabatan || g.mapel || 'Guru Mata Pelajaran'
        const nuptkVal = g.NUPTK || g.nuptk || g.nip || '-'
        return {
          id: Number(g.id), 
          nama: String(namaReal),
          jabatan: String(jabatan),
          nuptk: String(nuptkVal),
          extraInfo: `Jabatan: ${jabatan} | NUPTK: ${nuptkVal}`
        }
      }))
    }
  }

  const fetchSurat = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('surat_administrasi')
      .select('*')
      .eq('semester', selectedSemester)
      .eq('tahun_ajaran', selectedTahunAjaran)
      .order('id', { ascending: false })

    if (!error && data) setSuratList(data)
    setLoading(false)
  }

  const resetForm = () => {
    setJenisSurat('Surat Keterangan Bersedia Menerima')
    setPenerima('')
    setSelectedEntityId('')
    setNisn('')
    setTtl('')
    setSekolahAsal('')
    setNamaOrtu('')
    setAlamatSiswa('')
    setTingkatKelas('Kelas VII (Tujuh)')
    setRombel('7B')
    setJabatanGuru('Guru Mata Pelajaran')
    setNuptkGuru('-')
    setSekolahTujuan('')
    setKeperluanAktif('')
    setHariTanggal('')
    setWaktuAcara('')
    setTempatAcara('')
    setNamaAcara('')
    setTugasLokasi('')
    setPerihalSk('')
    setDiktumSk('')
    setEditingId(null)
    generateAutoNomorSurat('Surat Keterangan Bersedia Menerima')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nomorSurat.trim() || !penerima.trim()) {
      alert('Nomor Surat dan Nama Penerima wajib diisi!')
      return
    }

    setLoading(true)
    
    // Ambil isi teks langsung dari preview yang mungkin disunting pengguna secara manual
    const liveEditableHtml = previewRef.current ? previewRef.current.innerHTML : ''

    const jsonPayload = {
      nisn, ttl, jenisKelamin, sekolahAsal, namaOrtu, alamatSiswa, tingkatKelas, rombel,
      jabatanGuru, nuptkGuru, sekolahTujuan, keperluanAktif, hariTanggal, waktuAcara, tempatAcara, namaAcara, tugasLokasi, perihalSk, diktumSk,
      customHtml: liveEditableHtml
    }

    const payload = {
      nomor_surat: nomorSurat.trim(),
      jenis_surat: jenisSurat,
      penerima: penerima.trim(),
      keterangan: JSON.stringify(jsonPayload),
      semester: selectedSemester,
      tahun_ajaran: selectedTahunAjaran,
    }

    try {
      if (editingId) {
        const { error } = await supabase.from('surat_administrasi').update(payload).eq('id', editingId)
        if (!error) {
          alert('Berhasil memperbarui arsip surat!')
          resetForm()
          fetchSurat()
        } else alert('Gagal update: ' + error.message)
      } else {
        const { error } = await supabase.from('surat_administrasi').insert([payload])
        if (!error) {
          alert('Berhasil menyimpan arsip surat!')
          resetForm()
          fetchSurat()
        } else alert('Gagal simpan: ' + error.message)
      }
    } catch (err: any) {
      alert('Error: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (surat: SuratAdministrasi) => {
    setEditingId(surat.id)
    setJenisSurat(surat.jenis_surat)
    setPenerima(surat.penerima)
    setNomorSurat(surat.nomor_surat)

    try {
      if (surat.keterangan && surat.keterangan.startsWith('{')) {
        const p = JSON.parse(surat.keterangan)
        setNisn(p.nisn || '')
        setTtl(p.ttl || '')
        setJenisKelamin(p.jenisKelamin || 'Laki-laki')
        setSekolahAsal(p.sekolahAsal || '')
        setNamaOrtu(p.namaOrtu || '')
        setAlamatSiswa(p.alamatSiswa || '')
        setTingkatKelas(p.tingkatKelas || 'Kelas VII (Tujuh)')
        setRombel(p.rombel || '7B')
        setJabatanGuru(p.jabatanGuru || 'Guru Mata Pelajaran')
        setNuptkGuru(p.nuptkGuru || '-')
        setSekolahTujuan(p.sekolahTujuan || '')
        setKeperluanAktif(p.keperluanAktif || '')
        setHariTanggal(p.hariTanggal || '')
        setWaktuAcara(p.waktuAcara || '')
        setTempatAcara(p.tempatAcara || '')
        setNamaAcara(p.namaAcara || '')
        setTugasLokasi(p.tugasLokasi || '')
        setPerihalSk(p.perihalSk || '')
        setDiktumSk(p.diktumSk || '')
      }
    } catch (e) {
      console.error(e)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Hapus arsip surat ini?')) return
    const { error } = await supabase.from('surat_administrasi').delete().eq('id', id)
    if (!error) fetchSurat()
  }

  // GENERATOR HTML PREVIEW REAL-TIME
  const renderSuratHtmlBody = (suratData?: SuratAdministrasi) => {
    const jns = suratData ? suratData.jenis_surat : jenisSurat
    const noSurat = suratData ? suratData.nomor_surat : nomorSurat
    const pnama = (suratData ? suratData.penerima : penerima) || '................................'
    const sem = suratData ? (suratData.semester || selectedSemester) : selectedSemester
    const ta = suratData ? (suratData.tahun_ajaran || selectedTahunAjaran) : selectedTahunAjaran

    let dataObj = {
      nisn: nisn || '................',
      ttl: ttl || '................',
      jenisKelamin: jenisKelamin || 'Laki-laki',
      sekolahAsal: sekolahAsal || '................',
      namaOrtu: namaOrtu || '................',
      alamatSiswa: alamatSiswa || '................',
      tingkatKelas: tingkatKelas || 'Kelas VII (Tujuh)',
      rombel: rombel || '7B',
      jabatanGuru: jabatanGuru || 'Guru Mata Pelajaran',
      nuptkGuru: nuptkGuru || '-',
      sekolahTujuan: sekolahTujuan || '................',
      keperluanAktif: keperluanAktif || 'Keperluan Administrasi Sekolah',
      hariTanggal: hariTanggal || 'Sabtu, 14 November 2026',
      waktuAcara: waktuAcara || '08.00 WIB s.d. Selesai',
      tempatAcara: tempatAcara || 'Aula SMP Muna Mustofa',
      namaAcara: namaAcara || 'Rapat Evaluasi Capaian Pembelajaran & Penerimaan Rapor',
      tugasLokasi: tugasLokasi || 'Dinas Pendidikan Kabupaten Tanggamus',
      perihalSk: perihalSk || 'PENETAPAN TIM PENGEMBANG KURIKULUM SEKOLAH',
      diktumSk: diktumSk || 'Menetapkan nama yang tercantum dalam lampiran keputusan ini sebagai Tim Pengembang Kurikulum SMP Muna Mustofa.'
    }

    if (suratData && suratData.keterangan && suratData.keterangan.startsWith('{')) {
      try {
        dataObj = { ...dataObj, ...JSON.parse(suratData.keterangan) }
      } catch (e) { console.error(e) }
    }

    // 1. SURAT KETERANGAN BERSEDIA MENERIMA
    if (jns === 'Surat Keterangan Bersedia Menerima') {
      return `
        <div style="font-family: 'Times New Roman', serif; font-size: 11pt; line-height: 1.4; color: #000;">
          <img src="/kop-surat.png" alt="Kop Surat" style="width: 100%; height: auto; display: block; margin-bottom: 12px;" onError="this.style.display='none'" />
          <div style="text-align: center; margin: 10px 0;">
            <h2 style="font-size: 12pt; font-weight: bold; text-decoration: underline; margin: 0; text-transform: uppercase;">SURAT KETERANGAN BERSEDIA MENERIMA</h2>
            <p style="font-size: 10.5pt; margin: 2px 0 0 0;">Nomor: ${noSurat}</p>
          </div>
          <div style="margin-top: 10px; text-align: justify;">
            <p style="margin: 0 0 6px 0;">Yang bertanda tangan di bawah ini Kepala SMP Muna Mustofa, Kecamatan Gisting, Kabupaten Tanggamus, Provinsi Lampung, menerangkan bahwa:</p>
            <table style="margin: 4px 0 4px 15px; width: 95%; font-size: 11pt; border-collapse: collapse;">
              <tr><td width="35%" style="padding: 2px 0;">Nama Siswa</td><td width="3%">:</td><td><b>${pnama.toUpperCase()}</b></td></tr>
              <tr><td style="padding: 2px 0;">NISN</td><td>:</td><td>${dataObj.nisn}</td></tr>
              <tr><td style="padding: 2px 0;">Tempat, Tanggal Lahir</td><td>:</td><td>${dataObj.ttl}</td></tr>
              <tr><td style="padding: 2px 0;">Jenis Kelamin</td><td>:</td><td>${dataObj.jenisKelamin}</td></tr>
              <tr><td style="padding: 2px 0;">Sekolah Asal</td><td>:</td><td>${dataObj.sekolahAsal}</td></tr>
              <tr><td style="padding: 2px 0;">Nama Orang Tua / Wali</td><td>:</td><td>${dataObj.namaOrtu}</td></tr>
              <tr><td style="padding: 2px 0;">Alamat Siswa</td><td>:</td><td>${dataObj.alamatSiswa}</td></tr>
            </table>
            <p style="margin: 8px 0 4px 0;">Berdasarkan permohonan dari pihak orang tua/wali siswa yang bersangkutan serta mempertimbangkan ketersediaan daya tampung pada sekolah kami, menyatakan <b>BERSEDIA MENERIMA</b> siswa tersebut untuk pindah/masuk menjadi siswa SMP Muna Mustofa pada:</p>
            <table style="margin: 4px 0 4px 15px; width: 95%; font-size: 11pt; border-collapse: collapse;">
              <tr><td width="35%" style="padding: 2px 0;">Tingkat / Kelas</td><td width="3%">:</td><td><b>${dataObj.tingkatKelas}</b></td></tr>
              <tr><td style="padding: 2px 0;">Rombongan Belajar (Rombel)</td><td>:</td><td><b>${dataObj.rombel}</b></td></tr>
            </table>
            <p style="margin: 8px 0 0 0;">Surat keterangan ini diterbitkan sebagai dasar bagi sekolah asal untuk mengeluarkan Surat Keterangan Pindah/Keluar resmi dan memproses mutasi siswa pada sistem Dapodik. Demikian surat keterangan ini dibuat untuk dipergunakan sebagaimana mestinya.</p>
          </div>
          ${renderTTDArea()}
        </div>
      `
    }

    // 2. SURAT MUTASI SISWA (KELUAR)
    if (jns === 'Surat Mutasi Siswa') {
      return `
        <div style="font-family: 'Times New Roman', serif; font-size: 11pt; line-height: 1.45; color: #000;">
          <img src="/kop-surat.png" alt="Kop Surat" style="width: 100%; height: auto; display: block; margin-bottom: 12px;" onError="this.style.display='none'" />
          <div style="text-align: center; margin: 10px 0;">
            <h2 style="font-size: 12.5pt; font-weight: bold; text-decoration: underline; margin: 0; text-transform: uppercase;">SURAT KETERANGAN MUTASI SISWA</h2>
            <p style="font-size: 10.5pt; margin: 2px 0 0 0;">Nomor: ${noSurat}</p>
          </div>
          <div style="margin-top: 10px; text-align: justify;">
            <p style="margin: 0 0 6px 0;">Yang bertanda tangan di bawah ini Kepala SMP Muna Mustofa, Kecamatan Gisting, Kabupaten Tanggamus, Provinsi Lampung menerangkan bahwa:</p>
            <table style="margin: 6px 0 10px 15px; width: 95%; font-size: 11pt; border-collapse: collapse;">
              <tr><td width="30%" style="padding: 2px 0;">Nama Siswa</td><td width="3%">:</td><td><b>${pnama.toUpperCase()}</b></td></tr>
              <tr><td style="padding: 2px 0;">NISN</td><td>:</td><td>${dataObj.nisn}</td></tr>
              <tr><td style="padding: 2px 0;">Kelas / Rombel Terakhir</td><td>:</td><td>${dataObj.tingkatKelas} (${dataObj.rombel})</td></tr>
              <tr><td style="padding: 2px 0;">Periode Akademik</td><td>:</td><td>Semester ${sem} / TA ${ta}</td></tr>
            </table>
            <p style="margin: 8px 0;">Berdasarkan permohonan resmi dari Orang Tua/Wali siswa serta persetujuan pihak sekolah, dengan ini menerangkan bahwa siswa tersebut di atas telah <b>RESMI DISETUJUI MUTASI / PINDAH KELUAR</b> dari SMP Muna Mustofa ke <b>${dataObj.sekolahTujuan.toUpperCase()}</b>.</p>
            <p style="margin: 8px 0 0 0;">Surat mutasi ini diterbitkan untuk dipergunakan sebagai kelengkapan berkas administrasi dan pengurusan mutasi siswa pada sistem Dapodik di sekolah tujuan. Demikian surat ini dibuat untuk dapat dipergunakan sebagaimana mestinya.</p>
          </div>
          ${renderTTDArea()}
        </div>
      `
    }

    // 3. SURAT KETERANGAN AKTIF SISWA
    if (jns === 'Surat Keterangan Aktif Siswa') {
      return `
        <div style="font-family: 'Times New Roman', serif; font-size: 11pt; line-height: 1.45; color: #000;">
          <img src="/kop-surat.png" alt="Kop Surat" style="width: 100%; height: auto; display: block; margin-bottom: 12px;" onError="this.style.display='none'" />
          <div style="text-align: center; margin: 10px 0;">
            <h2 style="font-size: 12.5pt; font-weight: bold; text-decoration: underline; margin: 0; text-transform: uppercase;">SURAT KETERANGAN AKTIF BELAJAR</h2>
            <p style="font-size: 10.5pt; margin: 2px 0 0 0;">Nomor: ${noSurat}</p>
          </div>
          <div style="margin-top: 10px; text-align: justify;">
            <p style="margin: 0 0 6px 0;">Yang bertanda tangan di bawah ini Kepala SMP Muna Mustofa, Kecamatan Gisting, Kabupaten Tanggamus, Provinsi Lampung menerangkan bahwa:</p>
            <table style="margin: 6px 0 10px 15px; width: 95%; font-size: 11pt; border-collapse: collapse;">
              <tr><td width="30%" style="padding: 2px 0;">Nama Siswa</td><td width="3%">:</td><td><b>${pnama.toUpperCase()}</b></td></tr>
              <tr><td style="padding: 2px 0;">NISN</td><td>:</td><td>${dataObj.nisn}</td></tr>
              <tr><td style="padding: 2px 0;">Tempat, Tanggal Lahir</td><td>:</td><td>${dataObj.ttl}</td></tr>
              <tr><td style="padding: 2px 0;">Tingkat / Rombel</td><td>:</td><td>${dataObj.tingkatKelas} / ${dataObj.rombel}</td></tr>
            </table>
            <p style="margin: 8px 0;">Adalah benar nama yang tercantum di atas merupakan siswa terdaftar dan <b>AKTIF</b> mengikuti kegiatan pembelajaran di SMP Muna Mustofa pada Semester ${sem} Tahun Ajaran ${ta}.</p>
            <p style="margin: 8px 0 0 0;">Surat keterangan ini dibuat untuk keperluan: <b>${dataObj.keperluanAktif}</b>. Demikian surat keterangan ini dibuat dengan sebenarnya untuk dapat dipergunakan sebagaimana mestinya.</p>
          </div>
          ${renderTTDArea()}
        </div>
      `
    }

    // 4. SURAT UNDANGAN ORANG TUA / WALI
    if (jns.includes('Undangan')) {
      return `
        <div style="font-family: 'Times New Roman', serif; font-size: 11pt; line-height: 1.45; color: #000;">
          <img src="/kop-surat.png" alt="Kop Surat" style="width: 100%; height: auto; display: block; margin-bottom: 12px;" onError="this.style.display='none'" />
          <div style="text-align: center; margin: 10px 0;">
            <h2 style="font-size: 12.5pt; font-weight: bold; text-decoration: underline; margin: 0; text-transform: uppercase;">SURAT UNDANGAN</h2>
            <p style="font-size: 10.5pt; margin: 2px 0 0 0;">Nomor: ${noSurat}</p>
          </div>
          <div style="margin-top: 10px; text-align: justify;">
            <p style="margin: 0 0 10px 0;">Kepada Yth.<br/><b>Bapak/Ibu Orang Tua / Wali Murid dari: ${pnama.toUpperCase()}</b><br/>Di Tempat</p>
            <p style="margin: 0 0 6px 0;">Dengan hormat,</p>
            <p style="margin: 0 0 8px 0;">Sehubungan dengan pelaksanaan kegiatan sekolah, kami dari SMP Muna Mustofa mengharapkan kehadiran Bapak/Ibu Orang Tua/Wali Murid pada pertemuan yang akan dilaksanakan pada:</p>
            <table style="margin: 6px 0 10px 20px; width: 90%; font-size: 11pt; border-collapse: collapse;">
              <tr><td width="30%" style="padding: 2px 0;">Hari / Tanggal</td><td width="3%">:</td><td><b>${dataObj.hariTanggal}</b></td></tr>
              <tr><td style="padding: 2px 0;">Waktu</td><td>:</td><td>${dataObj.waktuAcara}</td></tr>
              <tr><td style="padding: 2px 0;">Tempat</td><td>:</td><td>${dataObj.tempatAcara}</td></tr>
              <tr><td style="padding: 2px 0;">Acara / Agenda</td><td>:</td><td><b>${dataObj.namaAcara}</b></td></tr>
            </table>
            <p style="margin: 10px 0 0 0;">Mengingat pentingnya acara tersebut, kami sangat mengharapkan kehadiran Bapak/Ibu tepat pada waktunya. Demikian surat undangan ini kami sampaikan. Atas perhatian dan kerjasamanya, kami ucapkan terima kasih.</p>
          </div>
          ${renderTTDArea()}
        </div>
      `
    }

    // 5. SURAT TUGAS GURU / PEGAWAI
    if (jns.includes('Tugas')) {
      return `
        <div style="font-family: 'Times New Roman', serif; font-size: 11pt; line-height: 1.45; color: #000;">
          <img src="/kop-surat.png" alt="Kop Surat" style="width: 100%; height: auto; display: block; margin-bottom: 12px;" onError="this.style.display='none'" />
          <div style="text-align: center; margin: 10px 0;">
            <h2 style="font-size: 12.5pt; font-weight: bold; text-decoration: underline; margin: 0; text-transform: uppercase;">SURAT TUGAS</h2>
            <p style="font-size: 10.5pt; margin: 2px 0 0 0;">Nomor: ${noSurat}</p>
          </div>
          <div style="margin-top: 10px; text-align: justify;">
            <p style="margin: 0 0 6px 0;">Yang bertanda tangan di bawah ini Kepala SMP Muna Mustofa, Kecamatan Gisting, Kabupaten Tanggamus, Provinsi Lampung <b>MENUGASKAN KEPADA:</b></p>
            <table style="margin: 6px 0 10px 15px; width: 95%; font-size: 11pt; border-collapse: collapse;">
              <tr><td width="30%" style="padding: 2px 0;">Nama Guru / Pegawai</td><td width="3%">:</td><td><b>${pnama.toUpperCase()}</b></td></tr>
              <tr><td style="padding: 2px 0;">Jabatan / Mapel</td><td style="padding: 2px 0;">:</td><td>${dataObj.jabatanGuru}</td></tr>
              <tr><td style="padding: 2px 0;">NUPTK / NIP</td><td style="padding: 2px 0;">:</td><td>${dataObj.nuptkGuru}</td></tr>
              <tr><td style="padding: 2px 0;">Instansi / Unit Kerja</td><td style="padding: 2px 0;">:</td><td>SMP Muna Mustofa</td></tr>
            </table>
            <p style="margin: 8px 0 4px 0;">Untuk melaksanakan tugas kedinasan / kegiatan di <b>${dataObj.tugasLokasi}</b> pada Semester ${sem} Tahun Ajaran ${ta}.</p>
            <p style="margin: 8px 0 0 0;">Demikian surat tugas ini diterbitkan agar dapat dilaksanakan dengan penuh rasa tanggung jawab dan setelah selesai melaksanakan tugas harap menyampaikan laporan kepada Kepala Sekolah.</p>
          </div>
          ${renderTTDArea()}
        </div>
      `
    }

    // 6. SURAT KEPUTUSAN KEPALA SEKOLAH (SK)
    return `
      <div style="font-family: 'Times New Roman', serif; font-size: 11pt; line-height: 1.4; color: #000;">
        <img src="/kop-surat.png" alt="Kop Surat" style="width: 100%; height: auto; display: block; margin-bottom: 12px;" onError="this.style.display='none'" />
        <div style="text-align: center; margin: 10px 0;">
          <h2 style="font-size: 12pt; font-weight: bold; margin: 0; text-transform: uppercase;">SURAT KEPUTUSAN KEPALA SMP MUNA MUSTOFA</h2>
          <p style="font-size: 10.5pt; margin: 2px 0 0 0;">Nomor: ${noSurat}</p>
          <p style="font-size: 11pt; font-weight: bold; margin: 4px 0 0 0; text-transform: uppercase;">TENTANG:<br/>${dataObj.perihalSk}</p>
        </div>
        <div style="margin-top: 10px; text-align: justify;">
          <p style="margin: 0 0 4px 0;"><b>Menimbang :</b> Bahwa demi kelancaran kegiatan administrasi dan pembelajaran di SMP Muna Mustofa, dipandang perlu menerbitkan Keputusan Kepala Sekolah.</p>
          <p style="margin: 0 0 6px 0;"><b>Mengingat :</b> Undang-Undang No. 20 Tahun 2003 tentang Sistem Pendidikan Nasional dan Peraturan Satuan Pendidikan SMP Muna Mustofa.</p>
          <div style="text-align: center; font-weight: bold; margin: 8px 0 4px 0;">MEMUTUSKAN:</div>
          <p style="margin: 0 0 4px 0;"><b>Menetapkan :</b></p>
          <p style="margin: 0 0 4px 0;"><b>KESATU :</b> ${dataObj.diktumSk}</p>
          <p style="margin: 0 0 4px 0;"><b>KEDUA :</b> Menugaskan saudara/i <b>${pnama.toUpperCase()}</b> untuk melaksanakan keputusan ini dengan penuh tanggung jawab.</p>
          <p style="margin: 0 0 0 0;"><b>KETIGA :</b> Keputusan ini mulai berlaku sejak tanggal ditetapkan dan apabila terdapat kekeliruan akan diperbaiki sebagaimana mestinya.</p>
        </div>
        ${renderTTDArea()}
      </div>
    `
  }

  const renderTTDArea = () => `
    <div style="margin-top: 25px; float: right; width: 250px; text-align: left; page-break-inside: avoid;">
      <p style="margin:0;">Gisting, ${new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}<br/>
      Kepala SMP Muna Mustofa,</p>
      
      <div style="height: 65px; margin: 4px 0; position: relative; display: flex; align-items: center;">
        ${includeStempel ? `<img src="/stempel-sekolah.png" style="height: 70px; position: absolute; left: -20px; top: -5px; opacity: 0.85;" alt="Stempel" onError="this.style.display='none'" />` : ''}
        ${includeTTD ? `<img src="/ttd-kepsek.png" style="height: 55px; position: relative; z-index: 2;" alt="TTD" onError="this.style.display='none'" />` : ''}
      </div>

      <p style="margin:0;"><b><u>SULASTRI, S.Pd., Gr.</u></b><br/>
      NUPTK. 6337763664131233</p>
    </div>
    <div style="clear: both;"></div>
  `

  // CETAK PDF LANGSUNG DARI CONTENT PREVIEW EDITABLE
  const handlePrintSurat = (suratData?: SuratAdministrasi) => {
    const printWindow = window.open('', '_blank')
    if (!printWindow) return

    // Mengambil HTML dari Live Preview (Termasuk suntingan bebas pengguna)
    let htmlContent = ''
    if (!suratData && previewRef.current) {
      htmlContent = previewRef.current.innerHTML
    } else {
      htmlContent = renderSuratHtmlBody(suratData)
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title></title>
          <style>
            @page { 
              size: A4 portrait; 
              margin: 8mm 15mm; 
            }
            @media print { 
              html, body { 
                margin: 0 !important; 
                padding: 0 !important; 
              } 
            }
            * { box-sizing: border-box; }
            body { font-family: 'Times New Roman', Times, serif; font-size: 11pt; line-height: 1.4; color: #000; margin: 0; padding: 0; }
          </style>
        </head>
        <body>
          ${htmlContent}
        </body>
      </html>
    `)

    printWindow.document.close()
    printWindow.focus()
    setTimeout(() => {
      printWindow.print()
      printWindow.close()
    }, 300)
  }

  const filteredSurat = suratList.filter(
    (s) =>
      s.nomor_surat.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.penerima.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.jenis_surat.toLowerCase().includes(searchQuery.toLowerCase())
  )

  if (loadingRole || !isOperator) {
    return (
      <div className={`min-h-screen p-8 flex items-center justify-center font-sans ${isDarkMode ? 'bg-slate-950 text-slate-100' : 'bg-[#E2E8F0] text-slate-700'}`}>
        <div className={`backdrop-blur-md border p-6 rounded-2xl text-center space-y-2 shadow-md ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white/90 border-slate-300'}`}>
          <p className={`font-bold text-sm ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Memeriksa Hak Akses Operator...</p>
        </div>
      </div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: -60 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4 }}
      className={`min-h-screen font-sans flex flex-col justify-between selection:bg-indigo-500 selection:text-white relative transition-colors duration-300 overflow-y-auto ${
        isDarkMode ? 'bg-slate-950 text-slate-100' : 'bg-[#E2E8F0] text-slate-800'
      }`}
    >
      <div className="relative z-10 flex flex-col min-h-screen">
        
        {/* HEADER TOPBAR */}
        <header className={`border-b px-4 sm:px-6 py-2.5 flex items-center justify-between gap-3 shrink-0 shadow-xs ${
          isDarkMode ? 'bg-slate-900/90 border-slate-800 backdrop-blur-md' : 'bg-slate-100/90 border-slate-300 backdrop-blur-md'
        }`}>
          <div className="flex items-center gap-2.5">
            <Link href="/" className={`p-1.5 rounded-lg transition ${isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'}`}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </Link>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl overflow-hidden border p-0.5 shadow-xs bg-white">
                <img src="/logo-smp.jpg" alt="Logo" className="w-full h-full object-contain" />
              </div>
              <div>
                <h1 className={`font-bold text-sm sm:text-base leading-none ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Aplikasi Guru AI</h1>
                <p className="text-[10px] sm:text-[11px] font-bold text-emerald-500 mt-0.5">Administrasi Persuratan TU (Live Editor)</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className={`border text-xs font-bold px-2.5 py-1 rounded-xl flex items-center gap-1.5 ${
              isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-100' : 'bg-white border-slate-300 text-slate-800'
            }`}>
              <span className="text-[9px] uppercase text-slate-400">Periode:</span>
              <select value={selectedSemester} onChange={(e) => setSelectedSemester(e.target.value as 'Ganjil' | 'Genap')} className="bg-transparent font-bold">
                <option value="Ganjil">Ganjil</option>
                <option value="Genap">Genap</option>
              </select>
              <select value={selectedTahunAjaran} onChange={(e) => setSelectedTahunAjaran(e.target.value)} className="bg-transparent font-bold">
                {Array.from({ length: 10 }, (_, i) => {
                  const y = 2024 + i
                  return <option key={y} value={`${y}/${y + 1}`}>{y}/{y + 1}</option>
                })}
              </select>
            </div>
            <span className="text-xs font-extrabold px-2.5 py-1 rounded-xl bg-indigo-600 text-white">{userDisplayName}</span>
          </div>
        </header>

        {/* MAIN CONTAINER */}
        <main className="max-w-7xl w-full mx-auto p-4 flex-1 flex flex-col space-y-4 pb-20">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 flex-1">
            
            {/* PANEL KIRI: FORM INPUT PARAMETER SURAT */}
            <form onSubmit={handleSubmit} className={`lg:col-span-5 p-5 border rounded-2xl flex flex-col justify-between space-y-4 ${
              isDarkMode ? 'bg-slate-900/90 border-slate-800' : 'bg-gradient-to-br from-indigo-100/90 via-slate-100/90 to-indigo-50/90 border-indigo-200'
            }`}>
              <div className="space-y-3 max-h-[75vh] overflow-y-auto pr-1">
                <div className="flex items-center justify-between border-b pb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-indigo-500 text-base">📑</span>
                    <h3 className={`font-extrabold text-sm ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                      {editingId ? 'Edit Arsip Surat' : 'Form Parameter Surat'}
                    </h3>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold uppercase mb-1">1. Jenis Surat Baku *</label>
                  <select
                    value={jenisSurat}
                    onChange={(e) => {
                      setJenisSurat(e.target.value)
                      setPenerima('')
                    }}
                    className={`w-full border rounded-xl px-3 py-2 text-xs font-bold focus:outline-none focus:border-indigo-600 ${
                      isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                    }`}
                  >
                    <option value="Surat Keterangan Bersedia Menerima">1. Surat Keterangan Bersedia Menerima</option>
                    <option value="Surat Mutasi Siswa">2. Surat Mutasi Siswa (Keluar)</option>
                    <option value="Surat Keterangan Aktif Siswa">3. Surat Keterangan Aktif Siswa</option>
                    <option value="Surat Undangan Orang Tua/Wali">4. Surat Undangan Orang Tua/Wali</option>
                    <option value="Surat Tugas Guru">5. Surat Tugas Guru / Pegawai</option>
                    <option value="Surat Keputusan Kepala Sekolah">6. Surat Keputusan (SK) Kepala Sekolah</option>
                  </select>
                </div>

                {/* DROPDOWN ENTITAS SUPABASE */}
                {jenisSurat.includes('Siswa') || jenisSurat.includes('Menerima') || jenisSurat.includes('Undangan') ? (
                  <div>
                    <label className="block text-[10px] font-extrabold uppercase mb-1">2. Pilih Siswa (Database Supabase)</label>
                    <select
                      value={selectedEntityId}
                      onChange={(e) => {
                        setSelectedEntityId(e.target.value)
                        const found = siswaOptions.find(s => String(s.id) === e.target.value)
                        if (found) {
                          setPenerima(found.nama)
                          setNisn(found.nisn || '')
                          setTtl(found.ttl || '')
                          setJenisKelamin(found.jk || 'Laki-laki')
                          setSekolahAsal(found.sekolahAsal || '')
                          setNamaOrtu(found.ortu || '')
                          setAlamatSiswa(found.alamat || '')
                        }
                      }}
                      className={`w-full border rounded-xl px-3 py-2 text-xs font-bold focus:outline-none ${
                        isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                      }`}
                    >
                      <option value="">-- Pilih Siswa Terdaftar / Atau Isi Manual --</option>
                      {siswaOptions.map(s => (
                        <option key={s.id} value={s.id}>{s.nama} ({s.extraInfo})</option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div>
                    <label className="block text-[10px] font-extrabold uppercase mb-1">2. Pilih Guru / Pegawai (Database Supabase)</label>
                    <select
                      value={selectedEntityId}
                      onChange={(e) => {
                        setSelectedEntityId(e.target.value)
                        const found = guruOptions.find(g => String(g.id) === e.target.value)
                        if (found) {
                          setPenerima(found.nama)
                          setJabatanGuru(found.jabatan || 'Guru Mata Pelajaran')
                          setNuptkGuru(found.nuptk || '-')
                        }
                      }}
                      className={`w-full border rounded-xl px-3 py-2 text-xs font-bold focus:outline-none ${
                        isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                      }`}
                    >
                      <option value="">-- Pilih Guru Terdaftar / Atau Isi Manual --</option>
                      {guruOptions.map(g => (
                        <option key={g.id} value={g.id}>{g.nama} ({g.extraInfo})</option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-[10px] font-extrabold uppercase mb-1">3. Nama Lengkap Subjek / Penerima *</label>
                  <input
                    type="text"
                    value={penerima}
                    onChange={(e) => setPenerima(e.target.value)}
                    placeholder="Nama Siswa / Guru / Ortu Wali"
                    className={`w-full border rounded-xl px-3 py-2 text-xs font-bold ${
                      isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                    }`}
                    required
                  />
                </div>

                {/* FORM SPESIFIK PARAMETER SURAT */}
                {jenisSurat === 'Surat Keterangan Bersedia Menerima' && (
                  <div className="p-3 border rounded-xl space-y-2 bg-indigo-50/50 dark:bg-slate-800/50 border-indigo-200 dark:border-slate-700">
                    <p className="text-[10px] font-extrabold uppercase text-indigo-600 dark:text-indigo-400">Parameter Bersedia Menerima:</p>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <input type="text" value={nisn} onChange={e => setNisn(e.target.value)} placeholder="NISN Siswa" className="p-1.5 rounded border text-xs bg-white dark:bg-slate-900" />
                      <select value={jenisKelamin} onChange={e => setJenisKelamin(e.target.value)} className="p-1.5 rounded border text-xs bg-white dark:bg-slate-900">
                        <option value="Laki-laki">Laki-laki</option>
                        <option value="Perempuan">Perempuan</option>
                      </select>
                    </div>
                    <input type="text" value={ttl} onChange={e => setTtl(e.target.value)} placeholder="Tempat, Tanggal Lahir" className="w-full p-1.5 rounded border text-xs bg-white dark:bg-slate-900" />
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <input type="text" value={sekolahAsal} onChange={e => setSekolahAsal(e.target.value)} placeholder="Sekolah Asal" className="p-1.5 rounded border text-xs bg-white dark:bg-slate-900" />
                      <input type="text" value={namaOrtu} onChange={e => setNamaOrtu(e.target.value)} placeholder="Nama Ortu / Wali" className="p-1.5 rounded border text-xs bg-white dark:bg-slate-900" />
                    </div>
                    <input type="text" value={alamatSiswa} onChange={e => setAlamatSiswa(e.target.value)} placeholder="Alamat Lengkap Siswa" className="w-full p-1.5 rounded border text-xs bg-white dark:bg-slate-900" />
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <input type="text" value={tingkatKelas} onChange={e => setTingkatKelas(e.target.value)} placeholder="Tingkat/Kelas" className="p-1.5 rounded border text-xs bg-white dark:bg-slate-900" />
                      <input type="text" value={rombel} onChange={e => setRombel(e.target.value)} placeholder="Rombel" className="p-1.5 rounded border text-xs bg-white dark:bg-slate-900" />
                    </div>
                  </div>
                )}

                {jenisSurat === 'Surat Mutasi Siswa' && (
                  <div className="p-3 border rounded-xl space-y-2 bg-indigo-50/50 dark:bg-slate-800/50 border-indigo-200 dark:border-slate-700">
                    <p className="text-[10px] font-extrabold uppercase text-indigo-600 dark:text-indigo-400">Parameter Mutasi Keluar:</p>
                    <input type="text" value={nisn} onChange={e => setNisn(e.target.value)} placeholder="NISN Siswa" className="w-full p-1.5 rounded border text-xs bg-white dark:bg-slate-900" />
                    <input type="text" value={sekolahTujuan} onChange={e => setSekolahTujuan(e.target.value)} placeholder="Nama Sekolah Tujuan (Misal: MTsS Pelita)" className="w-full p-1.5 rounded border text-xs bg-white dark:bg-slate-900" />
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <input type="text" value={tingkatKelas} onChange={e => setTingkatKelas(e.target.value)} placeholder="Kelas Terakhir" className="p-1.5 rounded border text-xs bg-white dark:bg-slate-900" />
                      <input type="text" value={rombel} onChange={e => setRombel(e.target.value)} placeholder="Rombel" className="p-1.5 rounded border text-xs bg-white dark:bg-slate-900" />
                    </div>
                  </div>
                )}

                {jenisSurat === 'Surat Keterangan Aktif Siswa' && (
                  <div className="p-3 border rounded-xl space-y-2 bg-indigo-50/50 dark:bg-slate-800/50 border-indigo-200 dark:border-slate-700">
                    <p className="text-[10px] font-extrabold uppercase text-indigo-600 dark:text-indigo-400">Parameter Aktif Siswa:</p>
                    <input type="text" value={nisn} onChange={e => setNisn(e.target.value)} placeholder="NISN Siswa" className="w-full p-1.5 rounded border text-xs bg-white dark:bg-slate-900" />
                    <input type="text" value={ttl} onChange={e => setTtl(e.target.value)} placeholder="Tempat, Tanggal Lahir" className="w-full p-1.5 rounded border text-xs bg-white dark:bg-slate-900" />
                    <input type="text" value={keperluanAktif} onChange={e => setKeperluanAktif(e.target.value)} placeholder="Keperluan Surat (Misal: Persyaratan KIP)" className="w-full p-1.5 rounded border text-xs bg-white dark:bg-slate-900" />
                  </div>
                )}

                {jenisSurat.includes('Undangan') && (
                  <div className="p-3 border rounded-xl space-y-2 bg-indigo-50/50 dark:bg-slate-800/50 border-indigo-200 dark:border-slate-700">
                    <p className="text-[10px] font-extrabold uppercase text-indigo-600 dark:text-indigo-400">Parameter Surat Undangan:</p>
                    <input type="text" value={hariTanggal} onChange={e => setHariTanggal(e.target.value)} placeholder="Hari, Tanggal (Sabtu, 14 Nov 2026)" className="w-full p-1.5 rounded border text-xs bg-white dark:bg-slate-900" />
                    <input type="text" value={waktuAcara} onChange={e => setWaktuAcara(e.target.value)} placeholder="Waktu (08.00 WIB s.d. Selesai)" className="w-full p-1.5 rounded border text-xs bg-white dark:bg-slate-900" />
                    <input type="text" value={tempatAcara} onChange={e => setTempatAcara(e.target.value)} placeholder="Tempat (Aula SMP Muna Mustofa)" className="w-full p-1.5 rounded border text-xs bg-white dark:bg-slate-900" />
                    <input type="text" value={namaAcara} onChange={e => setNamaAcara(e.target.value)} placeholder="Nama Acara (Rapat Evaluasi Rapor)" className="w-full p-1.5 rounded border text-xs bg-white dark:bg-slate-900" />
                  </div>
                )}

                {jenisSurat.includes('Tugas') && (
                  <div className="p-3 border rounded-xl space-y-2 bg-indigo-50/50 dark:bg-slate-800/50 border-indigo-200 dark:border-slate-700">
                    <p className="text-[10px] font-extrabold uppercase text-indigo-600 dark:text-indigo-400">Parameter Surat Tugas Guru:</p>
                    <input type="text" value={jabatanGuru} onChange={e => setJabatanGuru(e.target.value)} placeholder="Jabatan / Mapel" className="w-full p-1.5 rounded border text-xs bg-white dark:bg-slate-900" />
                    <input type="text" value={nuptkGuru} onChange={e => setNuptkGuru(e.target.value)} placeholder="NUPTK / NIP" className="w-full p-1.5 rounded border text-xs bg-white dark:bg-slate-900" />
                    <input type="text" value={tugasLokasi} onChange={e => setTugasLokasi(e.target.value)} placeholder="Lokasi Penugasan (Dinas Pendidikan Tanggamus)" className="w-full p-1.5 rounded border text-xs bg-white dark:bg-slate-900" />
                  </div>
                )}

                {jenisSurat.includes('Keputusan') && (
                  <div className="p-3 border rounded-xl space-y-2 bg-indigo-50/50 dark:bg-slate-800/50 border-indigo-200 dark:border-slate-700">
                    <p className="text-[10px] font-extrabold uppercase text-indigo-600 dark:text-indigo-400">Parameter SK Kepala Sekolah:</p>
                    <input type="text" value={perihalSk} onChange={e => setPerihalSk(e.target.value)} placeholder="Perihal SK (Penetapan Tim Pengembang Kurikulum)" className="w-full p-1.5 rounded border text-xs bg-white dark:bg-slate-900" />
                    <textarea rows={2} value={diktumSk} onChange={e => setDiktumSk(e.target.value)} placeholder="Isi Poin Keputusan Utama..." className="w-full p-1.5 rounded border text-xs bg-white dark:bg-slate-900" />
                  </div>
                )}

                <div className="p-2.5 rounded-xl border bg-indigo-50/80 dark:bg-slate-800/80 border-indigo-200 dark:border-slate-700">
                  <label className="block text-[10px] font-extrabold uppercase mb-1">Nomor Surat Resmi *</label>
                  <input
                    type="text"
                    value={nomorSurat}
                    onChange={(e) => setNomorSurat(e.target.value)}
                    placeholder="421/001/SMP.MM/XI/2026"
                    className={`w-full border rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold ${
                      isDarkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                    }`}
                    required
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2 border-t">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-xl font-extrabold text-xs shadow-md transition"
                >
                  {loading ? 'Menyimpan...' : editingId ? 'Update Arsip' : '+ Simpan Arsip Surat'}
                </button>
                <button
                  type="button"
                  onClick={() => handlePrintSurat()}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl font-extrabold text-xs shadow-md transition flex items-center gap-1"
                >
                  <span>🖨️</span>
                  <span>Cetak PDF</span>
                </button>
                {editingId && (
                  <button type="button" onClick={resetForm} className="px-3 border text-xs font-bold rounded-xl bg-white text-slate-700">
                    Batal
                  </button>
                )}
              </div>
            </form>

            {/* PANEL KANAN: LIVE PREVIEW DOKUMEN A4 & EDITABLE */}
            <div className={`lg:col-span-7 backdrop-blur-md border rounded-2xl p-5 flex flex-col space-y-4 ${
              isDarkMode ? 'bg-slate-900/90 border-slate-800' : 'bg-white/90 border-indigo-200'
            }`}>
              
              {/* LIVE PREVIEW CONTAINER DENGAN ATRIBUT CONTENTEDITABLE */}
              <div className="flex-1 border rounded-xl p-4 bg-white text-black shadow-inner overflow-y-auto max-h-[60vh]">
                <div className="flex items-center justify-between border-b pb-2 mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">📄 Live Preview (Dapat Di-edit Langsung)</span>
                    <span className="text-[9px] text-amber-600 font-bold">✏️ Klik teks di bawah untuk edit manual!</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs font-bold">
                    <label className="flex items-center gap-1 cursor-pointer select-none">
                      <input type="checkbox" checked={includeTTD} onChange={e => setIncludeTTD(e.target.checked)} className="rounded accent-indigo-600" />
                      <span>TTD</span>
                    </label>
                    <label className="flex items-center gap-1 cursor-pointer select-none">
                      <input type="checkbox" checked={includeStempel} onChange={e => setIncludeStempel(e.target.checked)} className="rounded accent-indigo-600" />
                      <span>Stempel</span>
                    </label>
                  </div>
                </div>

                {/* AREA EDITABLE: DIJAMIN BISA DIKETIK LANGSUNG */}
                <div
                  ref={previewRef}
                  contentEditable={true}
                  suppressContentEditableWarning={true}
                  className="focus:outline-none focus:ring-1 focus:ring-indigo-300 p-2 rounded transition"
                  dangerouslySetInnerHTML={{ __html: renderSuratHtmlBody() }}
                />
              </div>

              {/* TABEL ARSIP RINGKAS DI BAWAH PREVIEW */}
              <div className="border-t pt-3">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-extrabold uppercase">Arsip Surat Keluar ({filteredSurat.length})</h4>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="🔍 Cari Arsip..."
                    className="border rounded-lg px-2 py-0.5 text-xs font-bold bg-white dark:bg-slate-800"
                  />
                </div>

                <div className="max-h-36 overflow-y-auto border rounded-lg">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-100 dark:bg-slate-800 font-bold text-[10px]">
                      <tr>
                        <th className="p-2">NO. SURAT</th>
                        <th className="p-2">JENIS</th>
                        <th className="p-2">PENERIMA</th>
                        <th className="p-2 text-center">AKSI</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {filteredSurat.map(s => (
                        <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-slate-800">
                          <td className="p-2 font-mono font-bold text-indigo-600">{s.nomor_surat}</td>
                          <td className="p-2 font-semibold">{s.jenis_surat}</td>
                          <td className="p-2 font-bold">{s.penerima}</td>
                          <td className="p-2 text-center space-x-1 whitespace-nowrap">
                            <button onClick={() => handlePrintSurat(s)} className="px-2 py-0.5 text-[10px] bg-indigo-50 border border-indigo-200 text-indigo-700 font-bold rounded">🖨️ Cetak</button>
                            <button onClick={() => handleEdit(s)} className="px-2 py-0.5 text-[10px] bg-amber-50 border border-amber-200 text-amber-700 font-bold rounded">✏️ Edit</button>
                            <button onClick={() => handleDelete(s.id)} className="px-2 py-0.5 text-[10px] bg-rose-50 border border-rose-200 text-rose-600 font-bold rounded">🗑️</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>

          </div>
        </main>
      </div>
    </motion.div>
  )
}