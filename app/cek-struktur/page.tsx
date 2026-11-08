'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://kvrulbdvgxfrtmznpjnm.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Daftar seluruh tabel di Supabase Anda
const ALL_TABLES = [
  'absensi',
  'bank_soal',
  'bimbingan_wali',
  'guru',
  'guru_mapel',
  'jadwal',
  'jurnal_agenda',
  'kelas',
  'mapel',
  'master_jam',
  'nilai',
  'profiles',
  'siswa',
  'surat_administrasi'
]

interface TableSchemaInfo {
  tableName: string
  columns: string[]
  sampleRow: Record<string, any> | null
  error: string | null
}

export default function CekStrukturPage() {
  const [schemaList, setSchemaList] = useState<TableSchemaInfo[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function inspectAllTables() {
      setLoading(true)
      const results: TableSchemaInfo[] = []

      for (const table of ALL_TABLES) {
        try {
          // Mengambil 1 baris sampel untuk mendeteksi kunci/nama kolomnya
          const { data, error } = await supabase
            .from(table)
            .select('*')
            .limit(1)

          if (error) {
            results.push({
              tableName: table,
              columns: [],
              sampleRow: null,
              error: error.message
            })
          } else if (data && data.length > 0) {
            results.push({
              tableName: table,
              columns: Object.keys(data[0]),
              sampleRow: data[0],
              error: null
            })
          } else {
            results.push({
              tableName: table,
              columns: ['(Tabel Kosong - Isi minimal 1 baris data di Supabase untuk melihat nama kolom)'],
              sampleRow: null,
              error: null
            })
          }
        } catch (err: any) {
          results.push({
            tableName: table,
            columns: [],
            sampleRow: null,
            error: err.message
          })
        }
      }

      setSchemaList(results)
      setLoading(false)
    }

    inspectAllTables()
  }, [])

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-6 font-sans">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="border-b border-slate-700 pb-4">
          <h1 className="text-xl font-bold text-emerald-400">🔍 Inspektur Kolom Database Supabase</h1>
          <p className="text-xs text-slate-400 mt-1">
            Halaman ini menampilkan seluruh nama tabel dan struktur kolom yang tersimpan di Supabase Anda.
          </p>
        </div>

        {loading ? (
          <div className="text-center py-12 text-sm font-bold text-slate-400 animate-pulse">
            Sedang memeriksa seluruh struktur tabel database...
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {schemaList.map((item) => (
              <div 
                key={item.tableName}
                className="bg-slate-800 border border-slate-700 rounded-2xl p-4 space-y-3 shadow-md"
              >
                <div className="flex items-center justify-between border-b border-slate-700 pb-2">
                  <h3 className="font-extrabold text-sm text-indigo-400">
                    📋 Tabel: <span className="text-white font-mono">{item.tableName}</span>
                  </h3>
                  <span className="text-[10px] bg-slate-700 text-slate-300 font-extrabold px-2 py-0.5 rounded-md">
                    {item.columns.length} Kolom
                  </span>
                </div>

                {item.error ? (
                  <p className="text-xs text-rose-400 font-semibold bg-rose-950/40 p-2 rounded-lg border border-rose-800">
                    ⚠️ Error: {item.error}
                  </p>
                ) : (
                  <div className="space-y-2">
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Daftar Kolom:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {item.columns.map((col) => (
                        <span 
                          key={col} 
                          className="text-xs font-mono font-bold bg-slate-900 text-emerald-300 px-2.5 py-1 rounded-lg border border-slate-700"
                        >
                          {col}
                        </span>
                      ))}
                    </div>

                    {item.sampleRow && (
                      <details className="mt-2 text-xs">
                        <summary className="cursor-pointer text-slate-400 hover:text-white font-bold select-none">
                          🔍 Lihat Contoh Data (JSON)
                        </summary>
                        <pre className="mt-2 p-2.5 bg-slate-950 rounded-xl font-mono text-[11px] text-slate-300 overflow-x-auto border border-slate-800">
                          {JSON.stringify(item.sampleRow, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}