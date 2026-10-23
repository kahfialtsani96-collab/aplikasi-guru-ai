'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuthRole } from '@/hooks/useAuthRole'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const supabase = createClient(supabaseUrl, supabaseAnonKey)

type JenisKartu = 'pelajar' | 'ujian' | 'guru'

interface KelasOption {
  id: number
  nama_kelas: string
}

interface ItemKartu {
  id: number
  nama: string
  nomorId: string
  subInfo: string
  isKepalaSekolah?: boolean
  fotoUrl?: string
  tipe: 'siswa' | 'guru'
}

export default function CetakKartuPage() {
  const router = useRouter()
  const [userDisplayName, setUserDisplayName] = useState('GURU')
  const { isOperator } = useAuthRole()

  // DETEKSI OTOMATIS TEMA DARK MODE DARI LOCAL STORAGE
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false)

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme')
    if (savedTheme === 'dark') {
      setIsDarkMode(true)
    }
  }, [])

  const [jenisKartu, setJenisKartu] = useState<JenisKartu>('pelajar')
  const [namaUjian, setNamaUjian] = useState('ASESMEN SUMATIF AKHIR SEMESTER (SAS)')
  
  // Opsi Pengaturan Cetak Terpisah
  const [includeBackSide, setIncludeBackSide] = useState(true)
  const [includeDigitalSignature, setIncludeDigitalSignature] = useState(true)
  const [includeStamp, setIncludeStamp] = useState(true)

  const [daftarKelas, setDaftarKelas] = useState<KelasOption[]>([])
  const [selectedKelasId, setSelectedKelasId] = useState<number | ''>('')
  const [selectedKelasNama, setSelectedKelasNama] = useState('')
  
  const [cardItems, setCardItems] = useState<ItemKartu[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingKelas, setLoadingKelas] = useState(true)

  // State Modal Detail & Tab View (Depan / Belakang)
  const [selectedModalItem, setSelectedModalItem] = useState<ItemKartu | null>(null)
  const [modalActiveTab, setModalActiveTab] = useState<'front' | 'back'>('front')

  useEffect(() => {
    async function checkAuthAndUser() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.replace('/login')
        return
      }
      const user = session.user
      if (user) {
        const nameFromMeta = user.user_metadata?.full_name || user.email?.split('@')[0] || 'GURU'
        setUserDisplayName(nameFromMeta.toUpperCase())
      }
    }
    checkAuthAndUser()
  }, [router])

  // Fetch Daftar Kelas
  useEffect(() => {
    async function fetchKelasFromDB() {
      setLoadingKelas(true)
      try {
        const { data, error } = await supabase
          .from('kelas')
          .select('id, nama_kelas')
          .order('id', { ascending: true })

        if (!error && data) {
          setDaftarKelas(data)
        }
      } catch (err) {
        console.error('Error fetching kelas:', err)
      } finally {
        setLoadingKelas(false)
      }
    }
    fetchKelasFromDB()
  }, [])

  // Dynamic Fetching berdasarkan Jenis Kartu
  useEffect(() => {
    async function loadCardData() {
      setLoading(true)
      try {
        if (jenisKartu === 'guru') {
          const { data, error } = await supabase
            .from('guru')
            .select('id, nip, nama_lengkap, mapel, jabatan')
            .order('nama_lengkap', { ascending: true })

          if (!error && data) {
            const mapped: ItemKartu[] = data.map((g: any) => {
              const cleanNip = g.nip && g.nip !== 'EMPTY' && g.nip !== 'NULL' ? g.nip : '-'
              const isKepsek = g.jabatan?.toLowerCase().includes('kepala sekolah') || g.nama_lengkap?.toLowerCase().includes('sulastri')
              return {
                id: g.id,
                nama: g.nama_lengkap || 'GURU',
                nomorId: cleanNip,
                subInfo: g.jabatan || g.mapel || 'Guru / Staf TU',
                isKepalaSekolah: isKepsek,
                tipe: 'guru'
              }
            })
            setCardItems(mapped)
          }
        } else {
          if (!selectedKelasId) {
            setCardItems([])
            setLoading(false)
            return
          }

          const { data, error } = await supabase
            .from('siswa')
            .select('id, nisn, nama_lengkap, kelas_id')
            .eq('kelas_id', selectedKelasId)
            .order('nama_lengkap', { ascending: true })

          if (!error && data) {
            const cleanKelas = selectedKelasNama.replace(/^kelas\s+/i, '')
            const mapped: ItemKartu[] = data.map((s: any) => ({
              id: s.id,
              nama: s.nama_lengkap,
              nomorId: s.nisn || '-',
              subInfo: cleanKelas,
              tipe: 'siswa'
            }))
            setCardItems(mapped)
          }
        }
      } catch (err) {
        console.error('Error fetching card data:', err)
      } finally {
        setLoading(false)
      }
    }

    loadCardData()
  }, [jenisKartu, selectedKelasId, selectedKelasNama])

  const handleKelasChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value
    if (!val) {
      setSelectedKelasId('')
      setSelectedKelasNama('')
      return
    }
    const classId = Number(val)
    setSelectedKelasId(classId)
    const foundKelas = daftarKelas.find((k) => k.id === classId)
    if (foundKelas) setSelectedKelasNama(foundKelas.nama_kelas)
  }

  const filteredItems = cardItems.filter(
    (item) =>
      item.nama.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.nomorId.includes(searchQuery)
  )

  // PRINT GENERATOR BERDASARKAN OPSI DUPLEX, TTD, DAN STEMPEL
  const handlePrint = (targetList: ItemKartu[] = filteredItems) => {
    if (targetList.length === 0) return

    const printWindow = window.open('', '_blank')
    if (!printWindow) return

    const cardsHtml = targetList.map((item) => {
      // 1. SISI DEPAN
      let frontCardHtml = ''
      if (jenisKartu === 'ujian') {
        frontCardHtml = `
          <div class="card card-ujian">
            <div class="card-header">
              <img src="/logo-smp.jpg" alt="Logo" class="school-logo" />
              <div class="header-text">
                <h2>SMP MUNA MUSTOFA</h2>
                <p>${namaUjian.toUpperCase()}</p>
              </div>
            </div>
            <div class="card-body">
              <div class="photo">FOTO</div>
              <div class="details">
                <p class="label">NAMA PESERTA</p>
                <p class="value-name">${item.nama}</p>
                <div class="info-row"><span class="info-label">NISN</span><span class="info-val">: ${item.nomorId}</span></div>
                <div class="info-row"><span class="info-label">KELAS</span><span class="info-val">: ${item.subInfo}</span></div>
                <div class="info-row"><span class="info-label">NO. UJIAN</span><span class="info-val">: UJ-${item.nomorId}</span></div>
              </div>
            </div>
            <div class="card-footer">
              <div class="footer-info">
                <p class="qr-title">Verifikasi Peserta Ujian</p>
                <p class="qr-sub">SMP Muna Mustofa</p>
              </div>
              <img src="https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${item.nomorId}" alt="QR" class="qr-code" />
            </div>
          </div>
        `
      } else if (jenisKartu === 'guru') {
        frontCardHtml = `
          <div class="card card-guru">
            <div class="card-header">
              <img src="/logo-smp.jpg" alt="Logo" class="school-logo" />
              <div class="header-text">
                <h2>SMP MUNA MUSTOFA</h2>
                <p>KARTU TANDA ANGGOTA (KTA) PTK</p>
              </div>
            </div>
            <div class="card-body">
              <div class="photo">FOTO</div>
              <div class="details">
                <p class="label">NAMA GURU / PEGAWAI</p>
                <p class="value-name">${item.nama}</p>
                <div class="info-row"><span class="info-label">NIP/NUPTK</span><span class="info-val">: ${item.nomorId}</span></div>
                <div class="info-row"><span class="info-label">JABATAN</span><span class="info-val">: ${item.subInfo}</span></div>
              </div>
            </div>
            <div class="card-footer">
              <div class="footer-info">
                <p class="qr-title">ID Presensi Guru</p>
                <p class="qr-sub">Sistem Otomatis KBM</p>
              </div>
              <img src="https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${item.nomorId !== '-' ? item.nomorId : item.id}" alt="QR" class="qr-code" />
            </div>
          </div>
        `
      } else {
        frontCardHtml = `
          <div class="card">
            <div class="card-header">
              <img src="/logo-smp.jpg" alt="Logo" class="school-logo" />
              <div class="header-text">
                <h2>SMP MUNA MUSTOFA</h2>
                <p>KARTU TANDA PELAJAR</p>
              </div>
            </div>
            <div class="card-body">
              <div class="photo">FOTO</div>
              <div class="details">
                <p class="label">NAMA SISWA</p>
                <p class="value-name">${item.nama}</p>
                <div class="info-row"><span class="info-label">NISN</span><span class="info-val">: ${item.nomorId}</span></div>
                <div class="info-row"><span class="info-label">KELAS</span><span class="info-val">: ${item.subInfo}</span></div>
              </div>
            </div>
            <div class="card-footer">
              <div class="footer-info">
                <p class="qr-title">QR Presensi Akademik</p>
                <p class="qr-sub">SMP Muna Mustofa</p>
              </div>
              <img src="https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${item.nomorId}" alt="QR" class="qr-code" />
            </div>
          </div>
        `
      }

      // 2. SISI BELAKANG (DENGAN ELEMEN TTD & STEMPEL DIPALINGKAN)
      let backCardHtml = ''
      if (includeBackSide) {
        const penandatanganJabatan = item.isKepalaSekolah 
          ? 'Ketua Yayasan PPTQ Muna Mustofa' 
          : 'Kepala SMP Muna Mustofa'
        
        const penandatanganNama = item.isKepalaSekolah 
          ? 'PENGURUS YAYASAN' 
          : 'SULASTRI, S.Pd., Gr.'

        const penandatanganNip = item.isKepalaSekolah 
          ? 'Yayasan Muna Mustofa Lampung' 
          : 'NUPTK. 6337763664131233'

        const rulesContent = jenisKartu === 'guru' ? `
          <ol class="rules-list">
            <li>Kartu Tanda Anggota (KTA) ini merupakan bukti identitas resmi PTK SMP Muna Mustofa.</li>
            <li>Wajib dikenakan/dibawa selama menjalankan tugas kedinasan dan presensi harian.</li>
            <li>Jika kartu ini hilang, harap melapor ke bagian Tata Usaha (TU).</li>
          </ol>
        ` : `
          <ol class="rules-list">
            <li>Kartu ini berlaku selama yang bersangkutan terdaftar sebagai siswa aktif SMP Muna Mustofa.</li>
            <li>Wajib dibawa selama berada di lingkungan sekolah dan saat mengikuti presensi KBM.</li>
            <li>Apabila menemukan kartu ini, harap mengembalikan ke Tata Usaha SMP Muna Mustofa.</li>
          </ol>
        `

        backCardHtml = `
          <div class="card card-back ${jenisKartu === 'guru' ? 'card-guru' : ''}">
            <div class="back-header">
              <h3>KETENTUAN PENGGUNAAN</h3>
            </div>
            <div class="back-body">
              ${rulesContent}
            </div>
            <div class="back-footer">
              <p class="sign-date">Gisting, ${new Date().toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}</p>
              <p class="sign-title">${penandatanganJabatan},</p>
              
              <div class="signature-area">
                ${includeStamp ? `<img src="/stempel-sekolah.png" alt="Stempel" class="stamp-img" />` : ''}
                ${includeDigitalSignature ? `<img src="/ttd-kepsek.png" alt="TTD" class="signature-img" />` : ''}
              </div>

              <p class="sign-name"><b><u>${penandatanganNama}</u></b></p>
              <p class="sign-nip">${penandatanganNip}</p>
            </div>
          </div>
        `
      }

      return frontCardHtml + backCardHtml
    }).join('')

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Cetak Kartu - SMP Muna Mustofa</title>
          <style>
            @page { size: A4 portrait; margin: 10mm 12mm; }
            * { box-sizing: border-box; }
            body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 0; background: #ffffff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .grid { display: grid; grid-template-columns: repeat(2, 85mm); gap: 8mm 10mm; justify-content: center; }
            .card { width: 85mm; height: 54mm; border: 1.5px solid #065f46; border-radius: 6mm; padding: 2.5mm 3.5mm; background: #ffffff; page-break-inside: avoid; break-inside: avoid; display: flex; flex-direction: column; justify-content: space-between; overflow: hidden; position: relative; }
            .card-guru { border-color: #1e3a8a; }
            .card-guru .header-text h2 { color: #1e3a8a; }
            .card-guru .header-text p { color: #2563eb; }
            .card-header { display: flex; align-items: center; gap: 2.5mm; border-bottom: 1px solid #065f46; padding-bottom: 1.5mm; }
            .card-guru .card-header { border-bottom-color: #1e3a8a; }
            .school-logo { width: 7mm; height: 7mm; object-fit: contain; flex-shrink: 0; }
            .header-text { flex: 1; }
            .header-text h2 { margin: 0; font-size: 8.5pt; font-weight: 800; color: #065f46; line-height: 1; }
            .header-text p { margin: 0.8mm 0 0 0; font-size: 6pt; color: #047857; font-weight: 700; letter-spacing: 0.5px; }
            .card-body { display: flex; gap: 3mm; align-items: center; margin-top: 1mm; flex: 1; }
            .photo { width: 18mm; height: 24mm; background: #f1f5f9; border: 1px solid #94a3b8; border-radius: 2mm; display: flex; align-items: center; justify-content: center; font-size: 6.5pt; color: #64748b; font-weight: bold; flex-shrink: 0; }
            .details { font-size: 7.5pt; color: #0f172a; flex: 1; overflow: hidden; }
            .details .label { margin: 0; font-size: 5.5pt; color: #64748b; font-weight: 700; text-transform: uppercase; }
            .details .value-name { margin: 0.5mm 0 1.5mm 0; font-size: 8.5pt; font-weight: 800; color: #0f172a; line-height: 1.1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
            .info-row { display: flex; align-items: center; font-size: 7pt; margin-bottom: 0.8mm; }
            .info-label { width: 14mm; font-weight: 700; color: #475569; }
            .info-val { font-weight: 800; color: #0f172a; }
            .card-footer { border-top: 1px dashed #a7f3d0; padding-top: 1.5mm; display: flex; align-items: center; justify-content: space-between; }
            .card-guru .card-footer { border-top-color: #bfdbfe; }
            .footer-info { font-size: 6.5pt; }
            .qr-title { margin: 0; font-weight: 800; color: #065f46; font-size: 6.5pt; }
            .card-guru .qr-title { color: #1e3a8a; }
            .qr-sub { margin: 0; font-size: 5.5pt; color: #64748b; }
            .qr-code { width: 9mm; height: 9mm; flex-shrink: 0; }

            /* SISI BELAKANG */
            .card-back { background: #fafafa; }
            .back-header { border-bottom: 1px solid #065f46; text-align: center; padding-bottom: 1mm; }
            .card-guru .back-header { border-bottom-color: #1e3a8a; }
            .back-header h3 { margin: 0; font-size: 7.5pt; font-weight: 800; color: #065f46; }
            .card-guru .back-header h3 { color: #1e3a8a; }
            .back-body { flex: 1; padding: 1mm 0; }
            .rules-list { margin: 0; padding-left: 4mm; font-size: 5.5pt; color: #334155; line-height: 1.3; font-weight: 600; }
            .rules-list li { margin-bottom: 0.8mm; }
            .back-footer { text-align: right; border-top: 1px solid #e2e8f0; padding-top: 0.8mm; font-size: 6pt; position: relative; }
            .sign-date { margin: 0; font-size: 5pt; color: #64748b; }
            .sign-title { margin: 0; font-weight: 700; color: #0f172a; font-size: 5.5pt; }
            
            /* AREA STEMPEL & TTD OVERLAY */
            .signature-area { height: 9mm; position: relative; display: flex; align-items: center; justify-content: flex-end; }
            .signature-img { height: 100%; object-fit: contain; z-index: 2; position: relative; }
            .stamp-img { height: 12mm; position: absolute; right: 12mm; top: -2mm; z-index: 1; opacity: 0.85; }

            .sign-name { margin: 0; font-size: 6pt; color: #0f172a; }
            .sign-nip { margin: 0; font-size: 5pt; color: #475569; }
          </style>
        </head>
        <body>
          <div class="grid">${cardsHtml}</div>
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

  return (
    <motion.div
      initial={{ opacity: 0, x: -60 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className={`min-h-screen font-sans flex flex-col justify-between selection:bg-indigo-500 selection:text-white pb-32 relative overflow-x-hidden transition-colors duration-300 ${
        isDarkMode ? 'bg-slate-950 text-slate-100' : 'bg-[#E2E8F0] text-slate-800'
      }`}
    >
      <div className={`fixed inset-0 pointer-events-none z-0 flex items-center justify-center select-none transition-opacity duration-300 ${
        isDarkMode ? 'opacity-[0.05]' : 'opacity-[0.15]'
      }`}>
        <img src="/logo-smp.jpg" alt="Watermark SMP Muna Mustofa" className="w-[850px] h-[850px] object-contain max-w-none" />
      </div>

      <div className="relative z-10">
        <header className={`border-b px-3 sm:px-6 py-2.5 flex items-center justify-between sticky top-0 z-50 shadow-xs gap-2 transition-colors duration-300 ${
          isDarkMode ? 'bg-slate-900/90 border-slate-800 backdrop-blur-md' : 'bg-slate-100/90 border-slate-300 backdrop-blur-md'
        }`}>
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <Link href="/" className={`p-1 rounded-lg transition ${isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'}`} title="Kembali ke Dashboard">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </Link>
            <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-xl overflow-hidden flex items-center justify-center border p-0.5 shadow-xs shrink-0 ${
              isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-300'
            }`}>
              <img src="/logo-smp.jpg" alt="Logo SMP Muna Mustofa" className="w-full h-full object-contain" />
            </div>
            <div>
              <h1 className={`font-bold text-xs sm:text-base leading-none ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Aplikasi Guru AI</h1>
              <p className={`text-[10px] sm:text-[11px] font-bold mt-0.5 sm:mt-1 ${isDarkMode ? 'text-emerald-400' : 'text-emerald-800'}`}>Pusat Cetak Kartu Sekolah</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-3">
            <div className={`border text-xs font-bold px-2 sm:px-3.5 py-1 sm:py-1.5 rounded-xl flex items-center gap-1.5 shadow-xs ${
              isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-100' : 'bg-white border-slate-300 text-slate-800'
            }`}>
              <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px] font-bold shrink-0">
                {userDisplayName.charAt(0)}
              </span>
              <span className="max-w-[70px] sm:max-w-none truncate">{userDisplayName}</span>
            </div>

            <button
              onClick={async () => {
                await supabase.auth.signOut()
                router.replace('/login')
              }}
              className={`border p-1.5 sm:p-2 rounded-xl transition cursor-pointer shrink-0 ${
                isDarkMode 
                  ? 'bg-rose-950/50 border-rose-800 text-rose-400 hover:bg-rose-900/60' 
                  : 'bg-rose-100 border-rose-300 text-rose-700 hover:bg-rose-200'
              }`}
              title="Keluar"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </header>

        <main className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6">
          <div className={`backdrop-blur-md border rounded-3xl p-6 min-h-[480px] space-y-6 shadow-xs flex flex-col justify-between ${
            isDarkMode 
              ? 'bg-slate-900/90 border-slate-800' 
              : 'bg-slate-100/90 border-slate-300'
          }`}>
            
            {/* ACTION & FILTER ROW */}
            <div className={`space-y-4 border-b pb-5 ${isDarkMode ? 'border-slate-800' : 'border-slate-300'}`}>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-emerald-800 text-white rounded-2xl flex items-center justify-center text-lg shadow-xs">
                    🎴
                  </div>
                  <div>
                    <h2 className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Pusat Cetak Kartu Digital</h2>
                    <p className={`text-xs font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                      Pilih jenis kartu resmi lalu klik kartu untuk pratinjau Sisi Depan &amp; Belakang.
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={jenisKartu}
                    onChange={(e) => {
                      setJenisKartu(e.target.value as JenisKartu)
                      setSearchQuery('')
                    }}
                    className="bg-indigo-600 text-white font-extrabold border border-indigo-700 rounded-xl px-3.5 py-2 text-xs focus:outline-none cursor-pointer shadow-xs"
                  >
                    <option value="pelajar">🪪 Kartu Tanda Pelajar</option>
                    <option value="ujian">📝 Kartu Peserta Ujian</option>
                    <option value="guru">👨‍🏫 Kartu Pegawai / Guru</option>
                  </select>

                  {jenisKartu !== 'guru' && (
                    <select
                      value={selectedKelasId}
                      onChange={handleKelasChange}
                      disabled={loadingKelas}
                      className={`border rounded-xl px-3.5 py-2 text-xs focus:outline-none cursor-pointer font-bold shadow-xs disabled:opacity-50 ${
                        isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                      }`}
                    >
                      <option value="">{loadingKelas ? 'Memuat Kelas...' : 'Pilih Kelas'}</option>
                      {daftarKelas.map((kls) => (
                        <option key={kls.id} value={kls.id}>{kls.nama_kelas}</option>
                      ))}
                    </select>
                  )}

                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="🔍 Cari Nama / ID..."
                    className={`border rounded-xl px-3 py-2 text-xs font-bold focus:outline-none focus:border-emerald-600 w-36 ${
                      isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                    }`}
                  />

                  <button
                    onClick={() => handlePrint(filteredItems)}
                    disabled={filteredItems.length === 0}
                    className="bg-emerald-800 hover:bg-emerald-700 disabled:bg-slate-300 disabled:text-slate-500 text-white font-extrabold px-4 py-2 rounded-xl text-xs transition shadow-xs flex items-center gap-2 cursor-pointer"
                  >
                    <span>📥</span> Cetak ({filteredItems.length})
                  </button>
                </div>
              </div>

              {/* CHECKBOX OPSI LAYOUT CETAK DENGAN PILIHAN TERPISAH */}
              <div className={`flex flex-wrap items-center gap-5 p-3 rounded-2xl border text-xs font-bold ${
                isDarkMode ? 'bg-slate-800/80 border-slate-700 text-slate-200' : 'bg-white/80 border-slate-300 text-slate-800'
              }`}>
                <span className={`text-[11px] uppercase tracking-wider font-extrabold ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Opsi Pengesahan Kartu:</span>
                
                <label className="flex items-center gap-2 cursor-pointer hover:text-indigo-400">
                  <input
                    type="checkbox"
                    checked={includeBackSide}
                    onChange={(e) => setIncludeBackSide(e.target.checked)}
                    className="w-4 h-4 text-emerald-700 rounded focus:ring-emerald-600 cursor-pointer"
                  />
                  <span>Sertakan Sisi Belakang</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer hover:text-indigo-400">
                  <input
                    type="checkbox"
                    checked={includeDigitalSignature}
                    onChange={(e) => setIncludeDigitalSignature(e.target.checked)}
                    disabled={!includeBackSide}
                    className="w-4 h-4 text-emerald-700 rounded focus:ring-emerald-600 cursor-pointer disabled:opacity-40"
                  />
                  <span>TTD Digital Kepsek</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer hover:text-indigo-400">
                  <input
                    type="checkbox"
                    checked={includeStamp}
                    onChange={(e) => setIncludeStamp(e.target.checked)}
                    disabled={!includeBackSide}
                    className="w-4 h-4 text-emerald-700 rounded focus:ring-emerald-600 cursor-pointer disabled:opacity-40"
                  />
                  <span>Stempel Sekolah</span>
                </label>
              </div>
            </div>

            {/* PREVIEW CONTAINER */}
            <div className="flex-1 flex flex-col items-center justify-center py-4">
              {jenisKartu !== 'guru' && !selectedKelasId ? (
                <p className={`text-xs text-center font-medium ${isDarkMode ? 'text-slate-500' : 'text-slate-500'}`}>
                  Silakan pilih kelas di atas untuk melihat pratinjau kartu.
                </p>
              ) : loading ? (
                <div className={`flex flex-col items-center gap-2 text-xs font-bold ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                  <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                  <p>Memuat data kartu...</p>
                </div>
              ) : filteredItems.length === 0 ? (
                <p className={`text-xs text-center font-medium ${isDarkMode ? 'text-slate-500' : 'text-slate-500'}`}>
                  Tidak ada data ditemukan.
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 w-full">
                  {filteredItems.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => {
                        setSelectedModalItem(item)
                        setModalActiveTab('front')
                      }}
                      className={`border rounded-2xl p-4 space-y-3 shadow-xs hover:shadow-md transition cursor-pointer relative group ${
                        isDarkMode
                          ? jenisKartu === 'guru' 
                            ? 'bg-slate-800/90 border-slate-700 hover:border-blue-500' 
                            : 'bg-slate-800/90 border-slate-700 hover:border-emerald-500'
                          : jenisKartu === 'guru' 
                            ? 'bg-white border-slate-300 hover:border-blue-600' 
                            : 'bg-white border-slate-300 hover:border-emerald-500'
                      }`}
                    >
                      <div className={`flex items-center justify-between border-b pb-2 ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}`}>
                        <div className="flex items-center gap-2">
                          <img src="/logo-smp.jpg" alt="Logo" className="w-6 h-6 object-contain" />
                          <div>
                            <h3 className={`font-extrabold text-xs uppercase leading-none ${jenisKartu === 'guru' ? 'text-blue-400' : 'text-emerald-400'}`}>SMP MUNA MUSTOFA</h3>
                            <p className={`text-[9px] font-bold tracking-wider uppercase mt-0.5 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                              {jenisKartu === 'guru' ? 'KTA PTK / PEGAWAI' : jenisKartu === 'ujian' ? 'KARTU PESERTA UJIAN' : 'KARTU TANDA PELAJAR'}
                            </p>
                          </div>
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md transition ${
                          isDarkMode ? 'bg-slate-900 text-slate-300 group-hover:bg-indigo-600 group-hover:text-white' : 'bg-slate-100 text-slate-700 group-hover:bg-indigo-600 group-hover:text-white'
                        }`}>
                          🔍 Detail
                        </span>
                      </div>

                      <div className="flex gap-3 items-center">
                        <div className={`w-14 h-18 border rounded-lg flex items-center justify-center text-[10px] font-bold shrink-0 overflow-hidden ${
                          isDarkMode ? 'bg-slate-900 border-slate-700 text-slate-500' : 'bg-slate-100 border-slate-300 text-slate-400'
                        }`}>
                          FOTO
                        </div>
                        <div className="space-y-1 text-xs overflow-hidden">
                          <p className={`text-[10px] font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>NAMA:</p>
                          <p className={`font-bold text-xs leading-tight truncate ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{item.nama}</p>
                          <p className={`text-[10px] pt-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                            {jenisKartu === 'guru' ? 'NIP/NUPTK: ' : 'NISN: '}
                            <span className={`font-mono font-bold ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>{item.nomorId}</span>
                          </p>
                          <p className={`text-[10px] ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                            {jenisKartu === 'guru' ? 'JABATAN: ' : 'KELAS: '}
                            <span className={`font-bold ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>{item.subInfo}</span>
                          </p>
                        </div>
                      </div>

                      <div className={`border-t pt-3 flex items-center justify-between ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}`}>
                        <div className={`text-[10px] font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                          <p className={`font-bold ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>QR Code ID</p>
                          <p className="text-[9px]">Sistem Presensi</p>
                        </div>
                        <div className={`p-1 border rounded-lg ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                          <img
                            src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${item.nomorId !== '-' ? item.nomorId : item.id}`}
                            alt="QR Code"
                            className="w-10 h-10"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        </main>
      </div>

      {/* POPUP MODAL DETAIL DENGAN TOGGLE PRATINJAU SISI DEPAN & BELAKANG */}
      <AnimatePresence>
        {selectedModalItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className={`border rounded-3xl max-w-md w-full p-6 shadow-2xl relative space-y-4 ${
                isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-300 text-slate-900'
              }`}
            >
              <button
                onClick={() => setSelectedModalItem(null)}
                className={`absolute top-4 right-4 rounded-full p-1.5 transition cursor-pointer ${
                  isDarkMode ? 'text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700' : 'text-slate-400 hover:text-slate-700 bg-slate-100 hover:bg-slate-200'
                }`}
              >
                ✕
              </button>

              <div className={`flex items-center gap-3 border-b pb-3 ${isDarkMode ? 'border-slate-800' : 'border-slate-200'}`}>
                <div className={`w-10 h-10 rounded-xl overflow-hidden border p-0.5 shadow-xs ${
                  isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-300'
                }`}>
                  <img src="/logo-smp.jpg" alt="Logo" className="w-full h-full object-contain" />
                </div>
                <div>
                  <h3 className={`font-extrabold text-sm ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Pratinjau Kartu Resmi</h3>
                  <p className={`text-xs font-bold ${isDarkMode ? 'text-emerald-400' : 'text-emerald-800'}`}>SMP Muna Mustofa Gisting</p>
                </div>
              </div>

              {/* TAB SWITCHER DUA SISI */}
              <div className={`flex p-1 rounded-xl gap-1 text-xs font-extrabold ${isDarkMode ? 'bg-slate-800' : 'bg-slate-100'}`}>
                <button
                  onClick={() => setModalActiveTab('front')}
                  className={`flex-1 py-1.5 rounded-lg transition ${
                    modalActiveTab === 'front'
                      ? isDarkMode ? 'bg-slate-700 text-white shadow-xs' : 'bg-white text-indigo-900 shadow-xs'
                      : isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  🪪 Sisi Depan
                </button>
                <button
                  onClick={() => setModalActiveTab('back')}
                  className={`flex-1 py-1.5 rounded-lg transition ${
                    modalActiveTab === 'back'
                      ? isDarkMode ? 'bg-slate-700 text-white shadow-xs' : 'bg-white text-indigo-900 shadow-xs'
                      : isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  📜 Sisi Belakang
                </button>
              </div>

              {/* VIEW CARD DEPAN ATAU BELAKANG */}
              {modalActiveTab === 'front' ? (
                <div className={`border-2 rounded-2xl p-4 space-y-4 shadow-xs ${
                  jenisKartu === 'guru' 
                    ? isDarkMode ? 'bg-blue-950/30 border-blue-800' : 'bg-blue-50 border-blue-700'
                    : isDarkMode ? 'bg-emerald-950/30 border-emerald-800' : 'bg-emerald-50 border-emerald-700'
                }`}>
                  <div className={`flex items-center justify-between border-b pb-2 ${isDarkMode ? 'border-slate-800' : 'border-slate-300'}`}>
                    <div className="flex items-center gap-2">
                      <img src="/logo-smp.jpg" alt="Logo" className="w-7 h-7 object-contain" />
                      <div>
                        <h4 className={`font-black text-xs uppercase leading-none ${isDarkMode ? 'text-white' : 'text-slate-950'}`}>SMP MUNA MUSTOFA</h4>
                        <p className={`text-[9px] font-bold tracking-wider uppercase mt-0.5 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                          {jenisKartu === 'guru' ? 'KTA PTK / PEGAWAI' : jenisKartu === 'ujian' ? 'KARTU PESERTA UJIAN' : 'KARTU TANDA PELAJAR'}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-4 items-center">
                    <div className={`w-20 h-24 border rounded-xl flex items-center justify-center text-xs font-bold shrink-0 overflow-hidden shadow-xs ${
                      isDarkMode ? 'bg-slate-900 border-slate-700 text-slate-500' : 'bg-white border-slate-300 text-slate-400'
                    }`}>
                      FOTO
                    </div>
                    <div className="space-y-1.5 text-xs">
                      <div>
                        <p className={`text-[10px] font-bold uppercase ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Nama Lengkap:</p>
                        <p className={`font-black text-sm leading-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{selectedModalItem.nama}</p>
                      </div>
                      <div className="flex gap-4 pt-1">
                        <div>
                          <p className={`text-[10px] font-bold uppercase ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{jenisKartu === 'guru' ? 'NIP/NUPTK:' : 'NISN:'}</p>
                          <p className={`font-mono font-bold text-xs ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{selectedModalItem.nomorId}</p>
                        </div>
                        <div>
                          <p className={`text-[10px] font-bold uppercase ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{jenisKartu === 'guru' ? 'Jabatan:' : 'Kelas:'}</p>
                          <p className={`font-bold text-xs ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{selectedModalItem.subInfo}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className={`border pt-3 flex items-center justify-between p-2.5 rounded-xl ${
                    isDarkMode ? 'bg-slate-900/80 border-slate-800' : 'bg-white/80 border-slate-300'
                  }`}>
                    <div>
                      <p className={`font-extrabold text-xs ${isDarkMode ? 'text-white' : 'text-slate-950'}`}>QR Code Identitas Resmi</p>
                      <p className={`text-[10px] ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>Terintegrasi dengan sistem presensi</p>
                    </div>
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${selectedModalItem.nomorId !== '-' ? selectedModalItem.nomorId : selectedModalItem.id}`}
                      alt="QR Code"
                      className="w-14 h-14 bg-white p-1 rounded-lg border border-slate-300 shadow-xs"
                    />
                  </div>
                </div>
              ) : (
                /* PRATINJAU SISI BELAKANG */
                <div className={`border-2 rounded-2xl p-4 space-y-3 shadow-xs text-xs ${
                  isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-400'
                }`}>
                  <div className={`border-b pb-1.5 text-center ${isDarkMode ? 'border-slate-800' : 'border-slate-300'}`}>
                    <h4 className={`font-extrabold text-xs uppercase ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>KETENTUAN PENGGUNAAN</h4>
                  </div>
                  
                  {jenisKartu === 'guru' ? (
                    <ol className={`list-decimal pl-4 space-y-1 text-[11px] font-medium ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                      <li>Kartu Tanda Anggota (KTA) ini merupakan bukti identitas resmi PTK.</li>
                      <li>Wajib dikenakan/dibawa selama menjalankan tugas kedinasan.</li>
                      <li>Jika kartu hilang, melapor ke Tata Usaha (TU) SMP Muna Mustofa.</li>
                    </ol>
                  ) : (
                    <ol className={`list-decimal pl-4 space-y-1 text-[11px] font-medium ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                      <li>Kartu ini berlaku selama terdaftar sebagai siswa aktif SMP Muna Mustofa.</li>
                      <li>Wajib dibawa selama berada di sekolah dan saat presensi KBM.</li>
                      <li>Jika menemukan kartu ini, harap mengembalikan ke Tata Usaha.</li>
                    </ol>
                  )}

                  <div className={`border-t pt-2 text-right space-y-1 relative ${isDarkMode ? 'border-slate-800' : 'border-slate-300'}`}>
                    <p className={`text-[10px] ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                      Gisting, {new Date().toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}
                    </p>
                    <p className={`font-bold text-xs ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                      {selectedModalItem.isKepalaSekolah ? 'Ketua Yayasan PPTQ Muna Mustofa,' : 'Kepala SMP Muna Mustofa,'}
                    </p>

                    {/* OVERLAY TTD & STEMPEL DI MODAL */}
                    <div className="h-12 relative flex items-center justify-end my-1">
                      {includeStamp && (
                        <img src="/stempel-sekolah.png" alt="Stempel" className="h-14 absolute right-10 -top-1 opacity-80 pointer-events-none" />
                      )}
                      {includeDigitalSignature && (
                        <img src="/ttd-kepsek.png" alt="TTD" className="h-12 relative z-10 pointer-events-none" />
                      )}
                    </div>

                    <p className={`font-extrabold text-xs ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                      <u>{selectedModalItem.isKepalaSekolah ? 'PENGURUS YAYASAN' : 'SULASTRI, S.Pd., Gr.'}</u>
                    </p>
                    <p className={`text-[10px] font-mono ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                      {selectedModalItem.isKepalaSekolah ? 'Yayasan Muna Mustofa' : 'NUPTK. 6337763664131233'}
                    </p>
                  </div>
                </div>
              )}

              {/* ACTION BUTTONS */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => {
                    handlePrint([selectedModalItem])
                    setSelectedModalItem(null)
                  }}
                  className="flex-1 bg-emerald-800 hover:bg-emerald-700 text-white font-extrabold py-2.5 rounded-xl text-xs transition shadow-xs flex items-center justify-center gap-2 cursor-pointer"
                >
                  🖨️ Cetak Kartu Ini
                </button>
                <button
                  onClick={() => setSelectedModalItem(null)}
                  className={`px-4 font-bold py-2.5 rounded-xl text-xs transition cursor-pointer ${
                    isDarkMode ? 'bg-slate-800 hover:bg-slate-700 text-slate-300' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  Tutup
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className={`border-t fixed bottom-0 left-0 right-0 z-50 shadow-lg transition-colors duration-300 ${
        isDarkMode ? 'bg-slate-900/95 border-slate-800 backdrop-blur-md' : 'bg-slate-100/95 border-slate-300 backdrop-blur-md'
      }`}>
        <div className="max-w-xl mx-auto px-4 py-2.5 flex items-center justify-between">
          <Link href="/" className={`flex flex-col items-center gap-1 text-xs font-semibold transition ${
            isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-950'
          }`}>
            <span className="text-lg">🕒</span>
            <span>Dashboard</span>
          </Link>
          {isOperator && (
            <Link href="/siswa" className={`flex flex-col items-center gap-1 text-xs font-semibold transition ${
              isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-950'
            }`}>
              <span className="text-lg">👥</span>
              <span>Siswa</span>
            </Link>
          )}
          <Link href="/jadwal" className={`flex flex-col items-center gap-1 text-xs font-semibold transition ${
            isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-950'
          }`}>
            <span className="text-lg">🎓</span>
            <span>Akademik</span>
          </Link>
          <Link href="/ai" className={`flex flex-col items-center gap-1 text-xs font-semibold transition ${
            isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-950'
          }`}>
            <span className="text-lg">✨</span>
            <span>AI Tools</span>
          </Link>
          <Link href="/laporan" className={`flex flex-col items-center gap-1 text-xs font-semibold transition ${
            isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-950'
          }`}>
            <span className="text-lg">🖨️</span>
            <span>Laporan</span>
          </Link>
        </div>
      </div>
    </motion.div>
  )
}