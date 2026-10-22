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
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="min-h-screen bg-[#E2E8F0] text-slate-800 font-sans flex flex-col justify-between selection:bg-indigo-500 selection:text-white pb-32 relative overflow-x-hidden"
    >
      <div className="fixed inset-0 pointer-events-none z-0 flex items-center justify-center opacity-[0.15] select-none">
        <img src="/logo-smp.jpg" alt="Watermark SMP Muna Mustofa" className="w-[850px] h-[850px] object-contain max-w-none" />
      </div>

      <div className="relative z-10">
        <header className="bg-slate-100/90 backdrop-blur-md border-b border-slate-300 px-3 sm:px-6 py-2.5 flex items-center justify-between sticky top-0 z-50 shadow-xs gap-2">
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <Link href="/" className="text-slate-600 hover:text-slate-900 p-1 rounded-lg transition" title="Kembali ke Dashboard">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </Link>
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl overflow-hidden flex items-center justify-center bg-white border border-slate-300 p-0.5 shadow-xs shrink-0">
              <img src="/logo-smp.jpg" alt="Logo SMP Muna Mustofa" className="w-full h-full object-contain" />
            </div>
            <div>
              <h1 className="font-bold text-xs sm:text-base text-slate-900 leading-none">Aplikasi Guru AI</h1>
              <p className="text-[10px] sm:text-[11px] text-emerald-800 font-bold mt-0.5 sm:mt-1">Pusat Cetak Kartu Sekolah</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-3">
            <div className="bg-white border border-slate-300 text-slate-800 text-xs font-bold px-2 sm:px-3.5 py-1 sm:py-1.5 rounded-xl flex items-center gap-1.5 shadow-xs">
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
              className="bg-rose-100 border border-rose-300 hover:bg-rose-200 text-rose-700 p-1.5 sm:p-2 rounded-xl transition cursor-pointer shrink-0"
              title="Keluar"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </header>

        <main className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6">
          <div className="bg-slate-100/90 backdrop-blur-md border border-slate-300 rounded-3xl p-6 min-h-[480px] space-y-6 shadow-md flex flex-col justify-between">
            
            {/* ACTION & FILTER ROW */}
            <div className="space-y-4 border-b border-slate-300 pb-5">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-emerald-800 text-white rounded-2xl flex items-center justify-center text-lg shadow-sm">
                    🎴
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">Pusat Cetak Kartu Digital</h2>
                    <p className="text-xs text-slate-600 font-medium">
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
                      className="bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs text-slate-900 focus:outline-none cursor-pointer font-bold shadow-xs disabled:opacity-50"
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
                    className="bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 font-bold focus:outline-none focus:border-emerald-600 w-36"
                  />

                  <button
                    onClick={() => handlePrint(filteredItems)}
                    disabled={filteredItems.length === 0}
                    className="bg-emerald-800 hover:bg-emerald-700 disabled:bg-slate-300 disabled:text-slate-500 text-white font-extrabold px-4 py-2 rounded-xl text-xs transition shadow-md flex items-center gap-2 cursor-pointer"
                  >
                    <span>📥</span> Cetak ({filteredItems.length})
                  </button>
                </div>
              </div>

              {/* CHECKBOX OPSI LAYOUT CETAK DENGAN PILIHAN TERPISAH */}
              <div className="flex flex-wrap items-center gap-5 bg-white/80 p-3 rounded-2xl border border-slate-300 text-xs font-bold text-slate-800">
                <span className="text-slate-500 text-[11px] uppercase tracking-wider font-extrabold">Opsi Pengesahan Kartu:</span>
                
                <label className="flex items-center gap-2 cursor-pointer hover:text-indigo-900">
                  <input
                    type="checkbox"
                    checked={includeBackSide}
                    onChange={(e) => setIncludeBackSide(e.target.checked)}
                    className="w-4 h-4 text-emerald-700 rounded focus:ring-emerald-600 cursor-pointer"
                  />
                  <span>Sertakan Sisi Belakang</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer hover:text-indigo-900">
                  <input
                    type="checkbox"
                    checked={includeDigitalSignature}
                    onChange={(e) => setIncludeDigitalSignature(e.target.checked)}
                    disabled={!includeBackSide}
                    className="w-4 h-4 text-emerald-700 rounded focus:ring-emerald-600 cursor-pointer disabled:opacity-40"
                  />
                  <span>TTD Digital Kepsek</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer hover:text-indigo-900">
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
                <p className="text-xs text-slate-500 text-center font-medium">
                  Silakan pilih kelas di atas untuk melihat pratinjau kartu.
                </p>
              ) : loading ? (
                <div className="flex flex-col items-center gap-2 text-slate-600 text-xs font-bold">
                  <div className="w-6 h-6 border-2 border-emerald-700 border-t-transparent rounded-full animate-spin"></div>
                  <p>Memuat data kartu...</p>
                </div>
              ) : filteredItems.length === 0 ? (
                <p className="text-xs text-slate-500 text-center font-medium">
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
                      className={`bg-white border rounded-2xl p-4 space-y-3 shadow-sm hover:shadow-md transition cursor-pointer relative group ${
                        jenisKartu === 'guru' ? 'border-blue-300 hover:border-blue-600' : 'border-slate-300 hover:border-emerald-500'
                      }`}
                    >
                      <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                        <div className="flex items-center gap-2">
                          <img src="/logo-smp.jpg" alt="Logo" className="w-6 h-6 object-contain" />
                          <div>
                            <h3 className={`font-extrabold text-xs uppercase leading-none ${jenisKartu === 'guru' ? 'text-blue-900' : 'text-emerald-900'}`}>SMP MUNA MUSTOFA</h3>
                            <p className="text-[9px] text-slate-600 font-bold tracking-wider uppercase mt-0.5">
                              {jenisKartu === 'guru' ? 'KTA PTK / PEGAWAI' : jenisKartu === 'ujian' ? 'KARTU PESERTA UJIAN' : 'KARTU TANDA PELAJAR'}
                            </p>
                          </div>
                        </div>
                        <span className="text-[10px] bg-slate-100 text-slate-700 font-bold px-2 py-0.5 rounded-md group-hover:bg-indigo-600 group-hover:text-white transition">
                          🔍 Detail
                        </span>
                      </div>

                      <div className="flex gap-3 items-center">
                        <div className="w-14 h-18 bg-slate-100 border border-slate-300 rounded-lg flex items-center justify-center text-[10px] text-slate-400 font-bold shrink-0 overflow-hidden">
                          FOTO
                        </div>
                        <div className="space-y-1 text-xs overflow-hidden">
                          <p className="text-slate-500 text-[10px] font-medium">NAMA:</p>
                          <p className="font-bold text-slate-900 text-xs leading-tight truncate">{item.nama}</p>
                          <p className="text-slate-500 text-[10px] pt-1">
                            {jenisKartu === 'guru' ? 'NIP/NUPTK: ' : 'NISN: '}
                            <span className="text-slate-800 font-mono font-bold">{item.nomorId}</span>
                          </p>
                          <p className="text-slate-500 text-[10px]">
                            {jenisKartu === 'guru' ? 'JABATAN: ' : 'KELAS: '}
                            <span className="text-slate-800 font-bold">{item.subInfo}</span>
                          </p>
                        </div>
                      </div>

                      <div className="border-t border-slate-200 pt-3 flex items-center justify-between">
                        <div className="text-[10px] text-slate-500 font-medium">
                          <p className="font-bold text-slate-700">QR Code ID</p>
                          <p className="text-[9px]">Sistem Presensi</p>
                        </div>
                        <div className="bg-slate-50 p-1 border border-slate-200 rounded-lg">
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
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white border border-slate-300 rounded-3xl max-w-md w-full p-6 shadow-2xl relative space-y-4"
            >
              <button
                onClick={() => setSelectedModalItem(null)}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-full p-1.5 transition cursor-pointer"
              >
                ✕
              </button>

              <div className="flex items-center gap-3 border-b border-slate-200 pb-3">
                <div className="w-10 h-10 rounded-xl overflow-hidden bg-white border border-slate-300 p-0.5 shadow-xs">
                  <img src="/logo-smp.jpg" alt="Logo" className="w-full h-full object-contain" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-slate-900">Pratinjau Kartu Resmi</h3>
                  <p className="text-xs text-emerald-800 font-bold">SMP Muna Mustofa Gisting</p>
                </div>
              </div>

              {/* TAB SWITCHER DUA SISI */}
              <div className="flex bg-slate-100 p-1 rounded-xl gap-1 text-xs font-extrabold">
                <button
                  onClick={() => setModalActiveTab('front')}
                  className={`flex-1 py-1.5 rounded-lg transition ${
                    modalActiveTab === 'front'
                      ? 'bg-white text-indigo-900 shadow-xs'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  🪪 Sisi Depan
                </button>
                <button
                  onClick={() => setModalActiveTab('back')}
                  className={`flex-1 py-1.5 rounded-lg transition ${
                    modalActiveTab === 'back'
                      ? 'bg-white text-indigo-900 shadow-xs'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  📜 Sisi Belakang
                </button>
              </div>

              {/* VIEW CARD DEPAN ATAU BELAKANG */}
              {modalActiveTab === 'front' ? (
                <div className={`border-2 rounded-2xl p-4 space-y-4 shadow-md ${jenisKartu === 'guru' ? 'bg-blue-50 border-blue-700' : 'bg-emerald-50 border-emerald-700'}`}>
                  <div className="flex items-center justify-between border-b border-slate-300 pb-2">
                    <div className="flex items-center gap-2">
                      <img src="/logo-smp.jpg" alt="Logo" className="w-7 h-7 object-contain" />
                      <div>
                        <h4 className="font-black text-xs text-slate-950 uppercase leading-none">SMP MUNA MUSTOFA</h4>
                        <p className="text-[9px] text-slate-700 font-bold tracking-wider uppercase mt-0.5">
                          {jenisKartu === 'guru' ? 'KTA PTK / PEGAWAI' : jenisKartu === 'ujian' ? 'KARTU PESERTA UJIAN' : 'KARTU TANDA PELAJAR'}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-4 items-center">
                    <div className="w-20 h-24 bg-white border border-slate-300 rounded-xl flex items-center justify-center text-xs text-slate-400 font-bold shrink-0 overflow-hidden shadow-xs">
                      FOTO
                    </div>
                    <div className="space-y-1.5 text-xs">
                      <div>
                        <p className="text-slate-500 text-[10px] font-bold uppercase">Nama Lengkap:</p>
                        <p className="font-black text-slate-900 text-sm leading-tight">{selectedModalItem.nama}</p>
                      </div>
                      <div className="flex gap-4 pt-1">
                        <div>
                          <p className="text-slate-500 text-[10px] font-bold uppercase">{jenisKartu === 'guru' ? 'NIP/NUPTK:' : 'NISN:'}</p>
                          <p className="font-mono font-bold text-slate-900 text-xs">{selectedModalItem.nomorId}</p>
                        </div>
                        <div>
                          <p className="text-slate-500 text-[10px] font-bold uppercase">{jenisKartu === 'guru' ? 'Jabatan:' : 'Kelas:'}</p>
                          <p className="font-bold text-slate-900 text-xs">{selectedModalItem.subInfo}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-slate-300 pt-3 flex items-center justify-between bg-white/80 p-2.5 rounded-xl border">
                    <div>
                      <p className="font-extrabold text-xs text-slate-950">QR Code Identitas Resmi</p>
                      <p className="text-[10px] text-slate-600">Terintegrasi dengan sistem presensi</p>
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
                <div className="bg-slate-50 border-2 border-slate-400 rounded-2xl p-4 space-y-3 shadow-md text-xs">
                  <div className="border-b border-slate-300 pb-1.5 text-center">
                    <h4 className="font-extrabold text-slate-900 text-xs uppercase">KETENTUAN PENGGUNAAN</h4>
                  </div>
                  
                  {jenisKartu === 'guru' ? (
                    <ol className="list-decimal pl-4 space-y-1 text-[11px] text-slate-700 font-medium">
                      <li>Kartu Tanda Anggota (KTA) ini merupakan bukti identitas resmi PTK.</li>
                      <li>Wajib dikenakan/dibawa selama menjalankan tugas kedinasan.</li>
                      <li>Jika kartu hilang, melapor ke Tata Usaha (TU) SMP Muna Mustofa.</li>
                    </ol>
                  ) : (
                    <ol className="list-decimal pl-4 space-y-1 text-[11px] text-slate-700 font-medium">
                      <li>Kartu ini berlaku selama terdaftar sebagai siswa aktif SMP Muna Mustofa.</li>
                      <li>Wajib dibawa selama berada di sekolah dan saat presensi KBM.</li>
                      <li>Jika menemukan kartu ini, harap mengembalikan ke Tata Usaha.</li>
                    </ol>
                  )}

                  <div className="border-t border-slate-300 pt-2 text-right space-y-1 relative">
                    <p className="text-[10px] text-slate-500">
                      Gisting, {new Date().toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}
                    </p>
                    <p className="font-bold text-slate-900 text-xs">
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

                    <p className="font-extrabold text-slate-900 text-xs">
                      <u>{selectedModalItem.isKepalaSekolah ? 'PENGURUS YAYASAN' : 'SULASTRI, S.Pd., Gr.'}</u>
                    </p>
                    <p className="text-[10px] text-slate-600 font-mono">
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
                  className="flex-1 bg-emerald-800 hover:bg-emerald-700 text-white font-extrabold py-2.5 rounded-xl text-xs transition shadow-md flex items-center justify-center gap-2 cursor-pointer"
                >
                  🖨️ Cetak Kartu Ini
                </button>
                <button
                  onClick={() => setSelectedModalItem(null)}
                  className="px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 rounded-xl text-xs transition cursor-pointer"
                >
                  Tutup
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="border-t border-slate-300 bg-slate-100/95 backdrop-blur-md fixed bottom-0 left-0 right-0 z-50 shadow-lg">
        <div className="max-w-xl mx-auto px-4 py-2.5 flex items-center justify-between">
          <Link href="/" className="flex flex-col items-center gap-1 text-xs font-semibold text-slate-600 hover:text-slate-950 transition">
            <span className="text-lg">🕒</span>
            <span>Dashboard</span>
          </Link>
          {isOperator && (
            <Link href="/siswa" className="flex flex-col items-center gap-1 text-xs font-semibold text-slate-600 hover:text-slate-950 transition">
              <span className="text-lg">👥</span>
              <span>Siswa</span>
            </Link>
          )}
          <Link href="/jadwal" className="flex flex-col items-center gap-1 text-xs font-semibold text-slate-600 hover:text-slate-950 transition">
            <span className="text-lg">🎓</span>
            <span>Akademik</span>
          </Link>
          <Link href="/ai" className="flex flex-col items-center gap-1 text-xs font-semibold text-slate-600 hover:text-slate-950 transition">
            <span className="text-lg">✨</span>
            <span>AI Tools</span>
          </Link>
          <Link href="/laporan" className="flex flex-col items-center gap-1 text-xs font-semibold text-slate-600 hover:text-slate-950 transition">
            <span className="text-lg">🖨️</span>
            <span>Laporan</span>
          </Link>
        </div>
      </div>
    </motion.div>
  )
}