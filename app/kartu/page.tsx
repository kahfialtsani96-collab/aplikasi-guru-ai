'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { motion } from 'framer-motion'
import { useAuthRole } from '@/hooks/useAuthRole'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const supabase = createClient(supabaseUrl, supabaseAnonKey)

interface KelasOption {
  id: number
  nama_kelas: string
}

interface Siswa {
  id: number
  nisn: string
  nama_lengkap: string
  kelas_id: number
}

export default function CetakKartuPage() {
  const router = useRouter()
  const [userDisplayName, setUserDisplayName] = useState('GURU')
  const { isOperator } = useAuthRole()
  
  const [daftarKelas, setDaftarKelas] = useState<KelasOption[]>([])
  const [selectedKelasId, setSelectedKelasId] = useState<number | ''>('')
  const [selectedKelasNama, setSelectedKelasNama] = useState('')
  const [siswaList, setSiswaList] = useState<Siswa[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingKelas, setLoadingKelas] = useState(true)

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

  // 1. FETCH DAFTAR KELAS LANGSUNG DARI TABEL 'kelas'
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

  // 2. FETCH SISWA BERDASARKAN kelas_id
  useEffect(() => {
    async function fetchSiswa() {
      if (!selectedKelasId) {
        setSiswaList([])
        return
      }

      setLoading(true)
      try {
        const { data, error } = await supabase
          .from('siswa')
          .select('*')
          .eq('kelas_id', selectedKelasId)

        if (!error && data) {
          setSiswaList(data)
        }
      } catch (err) {
        console.error('Error fetching data siswa:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchSiswa()
  }, [selectedKelasId])

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
    if (foundKelas) {
      setSelectedKelasNama(foundKelas.nama_kelas)
    }
  }

  // Merapikan string kelas agar tidak ganda "Kelas Kelas VIII A"
  const cleanKelasNama = selectedKelasNama.replace(/^kelas\s+/i, '')

  const handlePrint = () => {
    if (siswaList.length === 0) return

    const printWindow = window.open('', '_blank')
    if (!printWindow) return

    const cardsHtml = siswaList.map((siswa) => `
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
            <p class="value-name">${siswa.nama_lengkap}</p>
            <div class="info-row">
              <span class="info-label">NISN</span>
              <span class="info-val">: ${siswa.nisn}</span>
            </div>
            <div class="info-row">
              <span class="info-label">KELAS</span>
              <span class="info-val">: ${cleanKelasNama}</span>
            </div>
          </div>
        </div>

        <div class="card-footer">
          <div class="footer-info">
            <p class="qr-title">QR Presensi</p>
            <p class="qr-sub">Sistem Otomatis KBM</p>
          </div>
          <img src="https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${siswa.nisn}" alt="QR" class="qr-code" />
        </div>
      </div>
    `).join('')

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Kartu Pelajar ${selectedKelasNama} - SMP Muna Mustofa</title>
          <style>
            @page {
              size: A4 portrait;
              margin: 10mm 12mm;
            }
            * {
              box-sizing: border-box;
            }
            body { 
              font-family: 'Segoe UI', Arial, sans-serif; 
              margin: 0;
              padding: 0;
              background: #ffffff; 
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .grid { 
              display: grid; 
              grid-template-columns: repeat(2, 85mm); 
              gap: 8mm 10mm; 
              justify-content: center;
            }
            .card { 
              width: 85mm;
              height: 54mm;
              border: 1.5px solid #065f46; 
              border-radius: 6mm; 
              padding: 2.5mm 3.5mm; 
              background: #ffffff; 
              page-break-inside: avoid;
              break-inside: avoid;
              display: flex;
              flex-direction: column;
              justify-content: space-between;
              overflow: hidden;
              position: relative;
            }
            .card-header { 
              display: flex;
              align-items: center;
              gap: 2.5mm;
              border-b: 1px solid #065f46; 
              padding-bottom: 1.5mm; 
            }
            .school-logo {
              width: 7mm;
              height: 7mm;
              object-fit: contain;
              flex-shrink: 0;
            }
            .header-text {
              flex: 1;
            }
            .header-text h2 { 
              margin: 0; 
              font-size: 8.5pt; 
              font-weight: 800; 
              color: #065f46; 
              line-height: 1;
              letter-spacing: 0.2px;
            }
            .header-text p { 
              margin: 0.8mm 0 0 0; 
              font-size: 6pt; 
              color: #047857; 
              letter-spacing: 0.5px; 
              font-weight: 700; 
            }
            .card-body { 
              display: flex; 
              gap: 3mm; 
              align-items: center; 
              margin-top: 1mm;
              flex: 1;
            }
            .photo { 
              width: 18mm; 
              height: 24mm; 
              background: #f1f5f9; 
              border: 1px solid #94a3b8; 
              border-radius: 2mm; 
              display: flex; 
              align-items: center; 
              justify-content: center; 
              font-size: 6.5pt; 
              color: #64748b; 
              font-weight: bold; 
              flex-shrink: 0;
            }
            .details { 
              font-size: 7.5pt; 
              color: #0f172a; 
              flex: 1;
              overflow: hidden;
            }
            .details .label {
              margin: 0;
              font-size: 5.5pt;
              color: #64748b;
              font-weight: 700;
              text-transform: uppercase;
            }
            .details .value-name {
              margin: 0.5mm 0 1.5mm 0;
              font-size: 8.5pt;
              font-weight: 800;
              color: #0f172a;
              line-height: 1.1;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
            }
            .info-row {
              display: flex;
              align-items: center;
              font-size: 7pt;
              margin-bottom: 0.8mm;
            }
            .info-label {
              width: 10mm;
              font-weight: 700;
              color: #475569;
            }
            .info-val {
              font-weight: 800;
              color: #0f172a;
            }
            .card-footer { 
              border-top: 1px dashed #a7f3d0; 
              padding-top: 1.5mm; 
              display: flex;
              align-items: center;
              justify-content: space-between;
            }
            .footer-info {
              font-size: 6.5pt;
            }
            .qr-title {
              margin: 0;
              font-weight: 800;
              color: #065f46;
              font-size: 6.5pt;
            }
            .qr-sub {
              margin: 0;
              font-size: 5.5pt;
              color: #64748b;
            }
            .qr-code { 
              width: 9mm; 
              height: 9mm; 
              flex-shrink: 0;
            }
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
      {/* WATERMARK LOGO */}
      <div className="fixed inset-0 pointer-events-none z-0 flex items-center justify-center opacity-[0.15] select-none">
        <img
          src="/logo-smp.jpg"
          alt="Watermark SMP Muna Mustofa"
          className="w-[850px] h-[850px] object-contain max-w-none"
        />
      </div>

      <div className="relative z-10">
        {/* HEADER */}
        <header className="bg-slate-100/90 backdrop-blur-md border-b border-slate-300 px-3 sm:px-6 py-2.5 flex items-center justify-between sticky top-0 z-50 shadow-xs gap-2">
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl overflow-hidden flex items-center justify-center bg-white border border-slate-300 p-0.5 shadow-xs shrink-0">
              <img src="/logo-smp.jpg" alt="Logo SMP Muna Mustofa" className="w-full h-full object-contain" />
            </div>
            <div>
              <h1 className="font-bold text-xs sm:text-base text-slate-900 leading-none">Aplikasi Guru AI</h1>
              <p className="text-[10px] sm:text-[11px] text-emerald-800 font-bold mt-0.5 sm:mt-1">Cetak Kartu Pelajar QR Code</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-3">
            <div className="hidden md:flex bg-emerald-100/80 border border-emerald-300 text-emerald-800 text-xs font-semibold px-3 py-1.5 rounded-full items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse"></span>
              <span>Supabase Live</span>
            </div>

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

        {/* MAIN CONTENT */}
        <main className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6">
          <div className="bg-slate-100/90 backdrop-blur-md border border-slate-300 rounded-3xl p-6 min-h-[480px] space-y-6 shadow-md flex flex-col justify-between">
            
            {/* Header Action Row */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-300 pb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-800 text-white rounded-2xl flex items-center justify-center text-lg shadow-sm">
                  🎴
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Cetak Kartu Pelajar QR Code</h2>
                  <p className="text-xs text-slate-600 font-medium">
                    Pilih kelas untuk mencetak kartu tanda pelajar beserta QR Code presensi.
                  </p>
                </div>
              </div>

              {/* Controls */}
              <div className="flex items-center gap-3">
                <select
                  value={selectedKelasId}
                  onChange={handleKelasChange}
                  disabled={loadingKelas}
                  className="bg-white border border-slate-300 rounded-xl px-4 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600 cursor-pointer font-bold shadow-xs disabled:opacity-50"
                >
                  <option value="">{loadingKelas ? 'Memuat Kelas...' : 'Pilih Kelas'}</option>
                  {daftarKelas.map((kls) => (
                    <option key={kls.id} value={kls.id}>
                      {kls.nama_kelas}
                    </option>
                  ))}
                </select>

                <button
                  onClick={handlePrint}
                  disabled={siswaList.length === 0}
                  className="bg-emerald-800 hover:bg-emerald-700 disabled:bg-slate-300 disabled:text-slate-500 text-white font-extrabold px-4 py-2 rounded-xl text-xs transition shadow-md flex items-center gap-2 cursor-pointer"
                >
                  <span>📥</span> Cetak PDF ({siswaList.length} Kartu)
                </button>
              </div>
            </div>

            {/* Preview Container */}
            <div className="flex-1 flex flex-col items-center justify-center py-8">
              {!selectedKelasId ? (
                <p className="text-xs text-slate-500 text-center font-medium">
                  Silakan pilih kelas di atas untuk melihat pratinjau kartu pelajar.
                </p>
              ) : loading ? (
                <div className="flex flex-col items-center gap-2 text-slate-600 text-xs font-bold">
                  <div className="w-6 h-6 border-2 border-emerald-700 border-t-transparent rounded-full animate-spin"></div>
                  <p>Memuat kartu pelajar...</p>
                </div>
              ) : siswaList.length === 0 ? (
                <p className="text-xs text-slate-500 text-center font-medium">
                  Belum ada siswa terdaftar di {selectedKelasNama}.
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 w-full">
                  {siswaList.map((siswa) => (
                    <div key={siswa.id || siswa.nisn} className="bg-white border border-slate-300 rounded-2xl p-4 space-y-3 shadow-sm hover:shadow-md transition">
                      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                        <img src="/logo-smp.jpg" alt="Logo" className="w-6 h-6 object-contain" />
                        <div>
                          <h3 className="font-extrabold text-xs text-emerald-900 uppercase leading-none">SMP MUNA MUSTOFA</h3>
                          <p className="text-[9px] text-emerald-700 font-bold tracking-wider uppercase mt-0.5">KARTU TANDA PELAJAR</p>
                        </div>
                      </div>

                      <div className="flex gap-3 items-center">
                        <div className="w-14 h-18 bg-slate-100 border border-slate-300 rounded-lg flex items-center justify-center text-[10px] text-slate-400 font-bold shrink-0">
                          FOTO
                        </div>
                        <div className="space-y-1 text-xs">
                          <p className="text-slate-500 text-[10px] font-medium">NAMA:</p>
                          <p className="font-bold text-slate-900 text-xs leading-tight">{siswa.nama_lengkap}</p>
                          <p className="text-slate-500 text-[10px] pt-1">NISN: <span className="text-slate-800 font-mono font-bold">{siswa.nisn}</span></p>
                          <p className="text-slate-500 text-[10px]">KELAS: <span className="text-slate-800 font-bold">{cleanKelasNama}</span></p>
                        </div>
                      </div>

                      <div className="border-t border-slate-200 pt-3 flex items-center justify-between">
                        <div className="text-[10px] text-slate-500 font-medium">
                          <p className="font-bold text-slate-700">QR Presensi</p>
                          <p className="text-[9px]">Sistem Otomatis</p>
                        </div>
                        <div className="bg-emerald-50 p-1 border border-emerald-200 rounded-lg">
                          <img
                            src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${siswa.nisn}`}
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

      {/* BOTTOM NAVIGATION DOCK */}
      <div className="border-t border-slate-300 bg-slate-100/95 backdrop-blur-md fixed bottom-0 left-0 right-0 z-50 shadow-lg">
        <div className="max-w-xl mx-auto px-4 py-2.5 flex items-center justify-between">
          <Link href="/" className="flex flex-col items-center gap-1 text-xs font-semibold text-slate-600 hover:text-slate-950 transition">
            <span className="text-lg">🕒</span>
            <span>Dashboard</span>
          </Link>
          {isOperator && (
            <Link href="/siswa" className="flex flex-col items-center gap-1 text-xs font-bold text-indigo-700 transition">
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