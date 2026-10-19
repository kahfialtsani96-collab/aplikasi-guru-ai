'use client'

import { useState, useEffect } from 'react'
import Navbar from '../components/Navbar'
import { supabase } from '../../lib/supabase'

export default function DataKelasPage() {
  const [kelasList, setKelasList] = useState<any[]>([])
  const [guruList, setGuruList] = useState<any[]>([])
  const [namaKelas, setNamaKelas] = useState('')
  const [tingkat, setTingkat] = useState('7')
  const [waliKelasId, setWaliKelasId] = useState('')

  const fetchData = async () => {
    const { data: dataKelas } = await supabase
      .from('kelas')
      .select('*, guru(nama_lengkap)')
      .order('id', { ascending: true })
    const { data: dataGuru } = await supabase.from('guru').select('*')

    if (dataKelas) setKelasList(dataKelas)
    if (dataGuru) setGuruList(dataGuru)
  }

  useEffect(() => {
    fetchData()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const { error } = await supabase.from('kelas').insert([
      { nama_kelas: namaKelas, tingkat, wali_kelas_id: waliKelasId ? Number(waliKelasId) : null }
    ])

    if (!error) {
      setNamaKelas('')
      setWaliKelasId('')
      fetchData()
    } else {
      alert('Gagal menambah kelas: ' + error.message)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <Navbar />
      <main className="max-w-7xl mx-auto p-6 space-y-6">
        <h2 className="text-2xl font-bold">Data Rombongan Belajar (Kelas)</h2>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <form onSubmit={handleSubmit} className="p-6 bg-slate-900 border border-slate-800 rounded-2xl space-y-4 h-fit">
            <h3 className="font-bold text-blue-400">Tambah Kelas Baru</h3>
            <div>
              <label className="text-xs text-slate-400">Tingkat Kelas</label>
              <select
                value={tingkat}
                onChange={(e) => setTingkat(e.target.value)}
                className="w-full p-2.5 rounded-lg bg-slate-800 border border-slate-700 text-sm text-white mt-1"
              >
                <option value="7">Kelas 7 (SMP)</option>
                <option value="8">Kelas 8 (SMP)</option>
                <option value="9">Kelas 9 (SMP)</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-400">Nama Kelas</label>
              <input
                type="text"
                value={namaKelas}
                onChange={(e) => setNamaKelas(e.target.value)}
                className="w-full p-2.5 rounded-lg bg-slate-800 border border-slate-700 text-sm text-white mt-1"
                placeholder="Contoh: VII A, VIII B, IX C"
                required
              />
            </div>
            <div>
              <label className="text-xs text-slate-400">Pilih Wali Kelas</label>
              <select
                value={waliKelasId}
                onChange={(e) => setWaliKelasId(e.target.value)}
                className="w-full p-2.5 rounded-lg bg-slate-800 border border-slate-700 text-sm text-white mt-1"
              >
                <option value="">-- Belum Ditentukan --</option>
                {guruList.map((g) => (
                  <option key={g.id} value={g.id}>{g.nama_lengkap}</option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 py-2.5 rounded-lg font-semibold text-sm transition"
            >
              Simpan Rombel Kelas
            </button>
          </form>

          <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
            <h3 className="font-bold text-slate-200">Daftar Rombel SMP Muna Mustofa</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {kelasList.map((k) => (
                <div key={k.id} className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-lg text-white">{k.nama_kelas}</span>
                    <span className="px-2.5 py-0.5 text-xs font-semibold bg-emerald-950 text-emerald-400 border border-emerald-800 rounded-md">
                      Tingkat {k.tingkat}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">
                    Wali Kelas: <span className="text-slate-200 font-medium">{k.guru?.nama_lengkap || 'Belum Diatur'}</span>
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}