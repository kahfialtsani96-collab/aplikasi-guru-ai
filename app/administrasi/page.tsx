'use client'

import { useState, useEffect } from 'react'
import Navbar from '../components/Navbar'
import { supabase } from '../../lib/supabase'

export default function AdministrasiTUPage() {
  const [suratList, setSuratList] = useState<any[]>([])
  const [nomorSurat, setNomorSurat] = useState('')
  const [jenisSurat, setJenisSurat] = useState('Surat Keterangan Aktif Siswa')
  const [penerima, setPenerima] = useState('')
  const [keterangan, setKeterangan] = useState('')

  const fetchSurat = async () => {
    const { data } = await supabase.from('surat_administrasi').select('*').order('id', { ascending: false })
    if (data) setSuratList(data)
  }

  useEffect(() => {
    fetchSurat()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const { error } = await supabase.from('surat_administrasi').insert([
      { nomor_surat: nomorSurat, jenis_surat: jenisSurat, penerima, keterangan }
    ])

    if (!error) {
      setNomorSurat('')
      setPenerima('')
      setKeterangan('')
      fetchSurat()
    } else {
      alert('Gagal menyimpan surat: ' + error.message)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <Navbar />
      <main className="max-w-7xl mx-auto p-6 space-y-6">
        <h2 className="text-2xl font-bold">Administrasi & Persuratan Tata Usaha</h2>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <form onSubmit={handleSubmit} className="p-6 bg-slate-900 border border-slate-800 rounded-2xl space-y-4 h-fit">
            <h3 className="font-bold text-blue-400">Buat Nomor / Arsip Surat</h3>
            <div>
              <label className="text-xs text-slate-400">Nomor Surat Resmi</label>
              <input
                type="text"
                value={nomorSurat}
                onChange={(e) => setNomorSurat(e.target.value)}
                placeholder="421/001/SMP-MM/2026"
                className="w-full p-2.5 rounded-lg bg-slate-800 border border-slate-700 text-sm text-white mt-1"
                required
              />
            </div>
            <div>
              <label className="text-xs text-slate-400">Jenis Surat</label>
              <select
                value={jenisSurat}
                onChange={(e) => setJenisSurat(e.target.value)}
                className="w-full p-2.5 rounded-lg bg-slate-800 border border-slate-700 text-sm text-white mt-1"
              >
                <option value="Surat Keterangan Aktif Siswa">Surat Keterangan Aktif Siswa</option>
                <option value="Surat Mutasi Siswa">Surat Mutasi Siswa</option>
                <option value="Surat Undangan Orang Tua/Wali">Surat Undangan Orang Tua/Wali</option>
                <option value="Surat Tugas Guru">Surat Tugas Guru</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-400">Penerima / Ditujukan Kepada</label>
              <input
                type="text"
                value={penerima}
                onChange={(e) => setPenerima(e.target.value)}
                placeholder="Nama Siswa / Guru / Lembaga"
                className="w-full p-2.5 rounded-lg bg-slate-800 border border-slate-700 text-sm text-white mt-1"
                required
              />
            </div>
            <div>
              <label className="text-xs text-slate-400">Keterangan Ringkas</label>
              <textarea
                value={keterangan}
                onChange={(e) => setKeterangan(e.target.value)}
                placeholder="Catatan keperluan surat..."
                className="w-full p-2.5 rounded-lg bg-slate-800 border border-slate-700 text-sm text-white mt-1 h-20"
              />
            </div>
            <button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 py-2.5 rounded-lg font-semibold text-sm transition"
            >
              Simpan Arsip Surat
            </button>
          </form>

          <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
            <h3 className="font-bold text-slate-200">Arsip Surat Keluar TU</h3>
            <div className="space-y-3">
              {suratList.map((s) => (
                <div key={s.id} className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-1">
                  <div className="flex justify-between items-start">
                    <span className="text-xs font-mono font-bold text-blue-400">{s.nomor_surat}</span>
                    <span className="text-[10px] text-slate-500">{s.tanggal_keluar}</span>
                  </div>
                  <h4 className="font-semibold text-sm text-white">{s.jenis_surat}</h4>
                  <p className="text-xs text-slate-400">Penerima: <span className="text-slate-200">{s.penerima}</span></p>
                  {s.keterangan && <p className="text-xs text-slate-500 italic mt-1">{s.keterangan}</p>}
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}