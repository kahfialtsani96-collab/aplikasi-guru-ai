'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const router = useRouter()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setErrorMsg('')

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setErrorMsg('Login gagal: ' + error.message)
      setLoading(false)
    } else {
      router.push('/')
      router.refresh()
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-8 space-y-6 shadow-2xl">
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center font-bold text-2xl text-white mx-auto shadow-lg shadow-blue-500/30">
            M
          </div>
          <h2 className="text-2xl font-extrabold text-white tracking-tight">SMP MUNA MUSTOFA</h2>
          <p className="text-xs text-slate-400">Masuk ke Portal Administrasi Sekolah</p>
        </div>

        {errorMsg && (
          <div className="p-3 bg-red-950/60 border border-red-800/80 rounded-xl text-xs text-red-400 text-center font-medium">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs text-slate-400 mb-1 font-medium">Email Akun</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nama@smpmunamustofa.sch.id"
              className="w-full p-3 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white focus:outline-none focus:border-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1 font-medium">Kata Sandi</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full p-3 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white focus:outline-none focus:border-blue-500"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 font-bold rounded-xl text-sm text-white transition shadow-lg shadow-blue-600/25"
          >
            {loading ? 'Memproses...' : 'Masuk Portal'}
          </button>
        </form>

        <p className="text-[11px] text-slate-500 text-center">
          Belum punya akun? Hubungi Operator / Admin TU Sekolah.
        </p>
      </div>
    </div>
  )
}