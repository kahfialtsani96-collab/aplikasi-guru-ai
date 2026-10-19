'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const supabase = createClient(supabaseUrl, supabaseAnonKey)

interface Siswa {
  id?: string
  nisn: string
  nama: string
  kelas: string
}

export default function CetakKartuPage() {
  const [userDisplayName, setUserDisplayName] = useState('GURU')
  const [selectedKelas, setSelectedKelas] = useState('')
  const [siswaList, setSiswaList] = useState<Siswa[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    // Ambil data akun user Supabase
    async function getUserData() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const nameFromMeta = user.user_metadata?.full_name || user.email?.split('@')[0] || 'GURU'
        setUserDisplayName(nameFromMeta.toUpperCase())
      }
    }
    getUserData()
  }, [])

  useEffect(() => {
    // Fetch data siswa berdasarkan kelas yang dipilih
    async function fetchSiswa() {
      if (!selectedKelas) {
        setSiswaList([])
        return
      }

      setLoading(true)
      try {
        const { data, error } = await supabase
          .from('siswa')
          .select('*')
          .eq('kelas', selectedKelas)

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
  }, [selectedKelas])

  // Fungsi untuk mencetak kartu ke PDF
  const handlePrint = () => {
    if (siswaList.length === 0) return

    const printWindow = window.open('', '_blank')
    if (!printWindow) return

    const cardsHtml = siswaList.map((siswa) => `
      <div class="card">
        <div class="card-header">
          <h2>SMP MUNA MUSTOFA</h2>
          <p>KARTU TANDA PELAJAR</p>
        </div>
        <div class="card-body">
          <div class="photo">FOTO</div>
          <div class="details">
            <p><strong>NAMA:</strong> ${siswa.nama}</p>
            <p><strong>NISN:</strong> ${siswa.nisn}</p>
            <p><strong>KELAS:</strong> ${siswa.kelas}</p>
          </div>
        </div>
        <div class="card-footer">
          <img src="https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${siswa.nisn}" alt="QR" class="qr-code" />
          <p class="qr-sub">Scan Presensi</p>
        </div>
      </div>
    `).join('')

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Kartu Pelajar Kelas ${selectedKelas} - SMP Muna Mustofa</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              padding: 20px;
              background: #fff;
            }
            .grid {
              display: grid;
              grid-template-columns: repeat(3, 1fr);
              gap: 15px;
            }
            .card {
              border: 2px solid #0f172a;
              border-radius: 12px;
              padding: 12px;
              width: 220px;
              background: #f8fafc;
              box-shadow: 0 2px 4px rgba(0,0,0,0.1);
              page-break-inside: avoid;
            }
            .card-header {
              text-align: center;
              border-bottom: 2px solid #0f172a;
              padding-bottom: 6px;
              margin-bottom: 10px;
            }
            .card-header h2 {
              margin: 0;
              font-size: 12px;
              font-weight: bold;
              color: #0f172a;
            }
            .card-header p {
              margin: 2px 0 0 0;
              font-size: 9px;
              color: #475569;
              letter-spacing: 1px;
            }
            .card-body {
              display: flex;
              gap: 10px;
              align-items: center;
            }
            .photo {
              width: 50px;
              height: 65px;
              background: #cbd5e1;
              border: 1px border #94a3b8;
              border-radius: 6px;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 8px;
              color: #475569;
              font-weight: bold;
            }
            .details {
              font-size: 10px;
              line-height: 1.4;
            }
            .details p {
              margin: 2px 0;
            }
            .card-footer {
              margin-top: 10px;
              border-top: 1px dashed #cbd5e1;
              padding-top: 6px;
              text-align: center;
            }
            .qr-code {
              width: 45px;
              height: 45px;
            }
            .qr-sub {
              margin: 2px 0 0 0;
              font-size: 8px;
              color: #64748b;
            }
            @media print {
              body { padding: 0; }
            }
          </style>
        </head>
        <body>
          <div class="grid">
            ${cardsHtml}
          </div>
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
    <div className="min-h-screen bg-[#0b0f19] text-slate-100 font-sans flex flex-col justify-between selection:bg-indigo-500 selection:text-white">
      <div>
        {/* TOPBAR / HEADER */}
        <header className="border-b border-slate-800/80 bg-[#0d1322]/90 backdrop-blur-md sticky top-0 z-50 px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-slate-400 hover:text-white p-2 rounded-lg transition">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </Link>
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 bg-amber-400 text-slate-950 rounded-xl flex items-center justify-center font-bold text-xl shadow-md shadow-amber-400/20">
                🎓
              </div>
              <div>
                <h1 className="font-bold text-base text-white leading-none">Aplikasi Guru AI</h1>
                <p className="text-[11px] text-sky-400 font-medium mt-1">Cetak Kartu Pelajar QR Code</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="bg-emerald-950/60 border border-emerald-500/30 text-emerald-400 text-xs font-medium px-3 py-1.5 rounded-full flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>Supabase Live</span>
            </div>

            <div className="bg-slate-800/80 border border-slate-700/60 px-3.5 py-1.5 rounded-xl flex items-center gap-2 text-xs font-semibold text-slate-200">
              <span className="w-5 h-5 bg-indigo-600 text-white rounded-full flex items-center justify-center text-[10px] font-bold">
                {userDisplayName.charAt(0)}
              </span>
              <span>{userDisplayName}</span>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-1 rounded-xl flex items-center gap-1">
              <button className="bg-amber-400 text-slate-950 p-1.5 rounded-lg text-xs font-bold shadow-sm">
                ☀️
              </button>
              <button className="text-slate-400 p-1.5 rounded-lg text-xs hover:text-white transition">
                🌙
              </button>
            </div>

            <button 
              onClick={async () => {
                await supabase.auth.signOut()
                window.location.href = '/login'
              }}
              className="bg-rose-950/40 border border-rose-800/50 hover:bg-rose-900/60 text-rose-400 p-2 rounded-xl transition"
              title="Keluar"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </header>

        {/* MAIN CONTENT */}
        <main className="max-w-6xl mx-auto p-6 space-y-6">
          
          {/* MAIN CARD SECTION */}
          <div className="bg-[#111827] border border-slate-800/80 rounded-2xl p-6 min-h-[480px] space-y-6 flex flex-col justify-between">
            
            {/* Header Action Row */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-950/80 text-emerald-400 rounded-xl flex items-center justify-center text-lg">
                  🎴
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">Cetak Kartu Pelajar QR Code (Presisi 3 Deret)</h2>
                  <p className="text-xs text-slate-400">
                    Kartu pelajar format Portrait Formal dengan QR Code presisi di depan &amp; Barcode di belakang. Siap dicetak langsung ke Kertas A4/PVC.
                  </p>
                </div>
              </div>

              {/* Controls: Dropdown Pilih Kelas & Tombol Cetak */}
              <div className="flex items-center gap-3">
                <select
                  value={selectedKelas}
                  onChange={(e) => setSelectedKelas(e.target.value)}
                  className="bg-[#0d1322] border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500 cursor-pointer font-medium"
                >
                  <option value="">Pilih Kelas</option>
                  <option value="VII A">Kelas VII A</option>
                  <option value="VII B">Kelas VII B</option>
                  <option value="VIII A">Kelas VIII A</option>
                  <option value="VIII B">Kelas VIII B</option>
                  <option value="IX A">Kelas IX A</option>
                  <option value="IX B">Kelas IX B</option>
                </select>

                <button
                  onClick={handlePrint}
                  disabled={siswaList.length === 0}
                  className="bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-bold px-4 py-2.5 rounded-xl text-xs transition shadow-lg shadow-blue-600/20 flex items-center gap-2"
                >
                  <span>📥</span> Cetak PDF ({siswaList.length} Kartu)
                </button>
              </div>
            </div>

            {/* Preview Container */}
            <div className="flex-1 flex flex-col items-center justify-center py-8">
              {!selectedKelas ? (
                <p className="text-xs text-slate-500 text-center">
                  Pilih kelas di atas untuk melihat pratinjau kartu pelajar.
                </p>
              ) : loading ? (
                <div className="flex flex-col items-center gap-2 text-slate-400 text-xs">
                  <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                  <p>Memuat kartu pelajar...</p>
                </div>
              ) : siswaList.length === 0 ? (
                <p className="text-xs text-slate-400 text-center">
                  Belum ada siswa di {selectedKelas}.
                </p>
              ) : (
                /* Grid Kartu Pelajar Presisi 3 Deret */
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 w-full">
                  {siswaList.map((siswa) => (
                    <div key={siswa.id || siswa.nisn} className="bg-slate-900 border border-slate-700/80 rounded-2xl p-4 space-y-3 shadow-xl hover:border-slate-600 transition">
                      
                      {/* Kop Kartu */}
                      <div className="text-center border-b border-slate-800 pb-2">
                        <h3 className="font-extrabold text-xs text-white uppercase tracking-wider">SMP MUNA MUSTOFA</h3>
                        <p className="text-[10px] text-sky-400 font-semibold tracking-widest uppercase">KARTU TANDA PELAJAR</p>
                      </div>

                      {/* Body Kartu */}
                      <div className="flex gap-3 items-center">
                        <div className="w-14 h-18 bg-slate-800 border border-slate-700 rounded-lg flex items-center justify-center text-[10px] text-slate-500 font-bold">
                          FOTO
                        </div>
                        <div className="space-y-1 text-xs">
                          <p className="text-slate-400 text-[10px]">NAMA:</p>
                          <p className="font-bold text-white text-xs leading-tight">{siswa.nama}</p>
                          <p className="text-slate-400 text-[10px] pt-1">NISN: <span className="text-slate-200 font-mono font-semibold">{siswa.nisn}</span></p>
                          <p className="text-slate-400 text-[10px]">KELAS: <span className="text-slate-200 font-semibold">{siswa.kelas}</span></p>
                        </div>
                      </div>

                      {/* QR Code Footer */}
                      <div className="border-t border-slate-800 pt-3 flex items-center justify-between">
                        <div className="text-[10px] text-slate-400">
                          <p className="font-semibold text-slate-300">QR Presensi</p>
                          <p className="text-[9px]">Sistem Otomatis</p>
                        </div>
                        <div className="bg-white p-1 rounded-lg">
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

      {/* BOTTOM NAVIGATION DOCK & FOOTER */}
      <div className="border-t border-slate-800/80 bg-[#0d1322]/95 backdrop-blur-md sticky bottom-0 z-50">
        <div className="max-w-md mx-auto px-6 py-2.5 flex items-center justify-between">
          <Link
            href="/"
            className="flex flex-col items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-300 transition"
          >
            <span className="text-lg">🕒</span>
            <span>Dashboard</span>
          </Link>

          <Link
            href="/siswa"
            className="flex flex-col items-center gap-1 text-xs font-medium text-sky-400 transition"
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
            className="flex flex-col items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-300 transition"
          >
            <span className="text-lg">🖨️</span>
            <span>Laporan</span>
          </Link>
        </div>

        {/* Developer Attribution Sub-Footer */}
        <div className="bg-[#070a12] py-2 text-center text-[11px] text-slate-500 border-t border-slate-900 flex items-center justify-center gap-2">
          <span>Aplikasi Guru AI</span>
          <span>•</span>
          <span>Created by <strong className="text-slate-300 font-semibold">MUZAINI AL KAHFI</strong></span>
        </div>
      </div>
    </div>
  )
}