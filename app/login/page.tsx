'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { motion, AnimatePresence } from 'framer-motion'
import { Eye, EyeOff, LogIn, AlertCircle, Loader2, Sparkles, UserCheck, ShieldCheck, ArrowRight, ArrowLeft, ArrowDown, ArrowUp } from 'lucide-react'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const supabase = createClient(supabaseUrl, supabaseAnonKey)

export default function LoginPage() {
  const router = useRouter()
  
  const [isSlid, setIsSlid] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const [isDarkMode, setIsDarkMode] = useState<boolean>(false)

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme')
    if (savedTheme === 'light') {
      setIsDarkMode(false)
      document.documentElement.classList.remove('dark')
    } else if (savedTheme === 'dark') {
      setIsDarkMode(true)
      document.documentElement.classList.add('dark')
    } else {
      const isHtmlDark = document.documentElement.classList.contains('dark')
      setIsDarkMode(isHtmlDark)
    }
  }, [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setErrorMsg('')

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setErrorMsg('Email atau kata sandi salah. Silakan periksa kembali.')
      setIsLoading(false)
    } else {
      setIsSuccess(true)
      setTimeout(() => {
        router.replace('/')
        router.refresh()
      }, 600)
    }
  }

  return (
    <div className={`h-[100dvh] w-full flex items-center justify-center p-3 sm:p-4 relative overflow-hidden select-none selection:bg-indigo-500 selection:text-white transition-colors duration-300 ${
      isDarkMode ? 'bg-slate-950 text-slate-100' : 'bg-[#E2E8F0] text-slate-800'
    }`}>
      
      {/* WATERMARK LOGO SEKOLAH */}
      <div className={`fixed inset-0 pointer-events-none z-0 flex items-center justify-center select-none transition-opacity duration-300 ${
        isDarkMode ? 'opacity-[0.05]' : 'opacity-[0.12]'
      }`}>
        <img
          src="/logo-smp.jpg"
          alt="Watermark SMP Muna Mustofa"
          className="w-[450px] sm:w-[850px] h-[450px] sm:h-[850px] object-contain max-w-none"
        />
      </div>

      <AnimatePresence mode="wait">
        {!isSuccess && (
          <motion.div
            key="login-container-card"
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20, filter: 'blur(10px)' }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className={`w-full max-w-4xl h-[560px] sm:h-[600px] md:h-[540px] rounded-3xl border shadow-2xl relative z-10 overflow-hidden transition-colors duration-300 ${
              isDarkMode 
                ? 'bg-slate-900 border-slate-800' 
                : 'bg-white border-slate-300'
            }`}
          >

            {/* BASE LAYER 1: FORM LOGIN (DESKTOP: KANAN | MOBILE: SISI ATAS - TERBUKA SAAT OVERLAY SLIDE KE BAWAH) */}
            <div className="absolute top-0 right-0 md:top-0 md:right-0 w-full md:w-1/2 h-1/2 md:h-full p-5 sm:p-6 md:p-10 flex flex-col justify-center z-10">
              <div className="max-w-sm mx-auto w-full space-y-2.5 md:space-y-4">
                <div className="flex items-center justify-between md:block">
                  <div>
                    <h2 className={`text-base sm:text-lg md:text-xl font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Account Login</h2>
                    <p className={`text-[10px] sm:text-[11px] md:text-xs mt-0.5 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>Enter your email and password to access the system.</p>
                  </div>
                  <div className="w-8 h-8 rounded-lg overflow-hidden bg-white border p-0.5 md:hidden shrink-0">
                    <img src="/logo-smp.jpg" alt="Logo SMP" className="w-full h-full object-contain" />
                  </div>
                </div>

                {/* ERROR ALERT */}
                <AnimatePresence>
                  {errorMsg && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="p-2 bg-rose-50 border border-rose-200 text-rose-700 text-[11px] rounded-xl flex items-center gap-2 font-medium"
                    >
                      <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-600" />
                      <span>{errorMsg}</span>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* FORM INPUT LOGIN */}
                <form onSubmit={handleLogin} className="space-y-2 md:space-y-3.5">
                  <div>
                    <label className={`block text-[9px] md:text-[11px] font-extrabold uppercase mb-1 ${isDarkMode ? 'text-indigo-300' : 'text-indigo-950'}`}>
                      Email Address
                    </label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="nama@smpmunamustofa.sch.id"
                      className={`w-full px-3 py-1.5 sm:py-2 md:py-2.5 border rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-600 transition ${
                        isDarkMode 
                          ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' 
                          : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400'
                      }`}
                    />
                  </div>

                  <div>
                    <label className={`block text-[9px] md:text-[11px] font-extrabold uppercase mb-1 ${isDarkMode ? 'text-indigo-300' : 'text-indigo-950'}`}>
                      Password
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className={`w-full px-3 py-1.5 sm:py-2 md:py-2.5 border rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-600 transition pr-10 ${
                          isDarkMode 
                            ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' 
                            : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400'
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className={`absolute right-3 top-1/2 -translate-y-1/2 transition p-1 ${
                          isDarkMode ? 'text-slate-400 hover:text-slate-200' : 'text-slate-400 hover:text-slate-600'
                        }`}
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-2 sm:py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold rounded-xl text-xs shadow-md transition duration-200 flex items-center justify-center gap-2 disabled:opacity-70 cursor-pointer"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-white" />
                        <span>Logging In...</span>
                      </>
                    ) : (
                      <>
                        <LogIn className="w-4 h-4" />
                        <span>Sign In</span>
                      </>
                    )}
                  </button>
                </form>
              </div>
            </div>

            {/* BASE LAYER 2: PENJELASAN APLIKASI (DESKTOP: SISI KIRI | MOBILE: SISI BAWAH) */}
            <div className="absolute bottom-0 left-0 md:top-0 md:left-0 w-full md:w-1/2 h-1/2 md:h-full p-5 sm:p-6 md:p-10 flex flex-col justify-between z-10 pt-4 sm:pt-6">
              <div className="space-y-2 md:space-y-4 my-auto">
                <div className="flex items-center gap-2.5 sm:gap-3">
                  <div className="w-8 h-8 md:w-10 md:h-10 rounded-xl overflow-hidden bg-white border border-slate-200 p-0.5 shadow-xs shrink-0">
                    <img src="/logo-smp.jpg" alt="Logo SMP Muna Mustofa" className="w-full h-full object-contain" />
                  </div>
                  <div>
                    <h2 className={`font-black text-xs md:text-sm leading-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>SMP MUNA MUSTOFA</h2>
                    <p className="text-[9px] md:text-[10px] font-extrabold text-emerald-500 uppercase tracking-wider">Aplikasi Guru AI</p>
                  </div>
                </div>

                <div className="pt-1 md:pt-3 space-y-2">
                  <div className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 md:px-3 md:py-1 rounded-full text-[9px] md:text-[10px] font-bold border ${
                    isDarkMode ? 'bg-slate-800 text-emerald-400 border-slate-700' : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  }`}>
                    <Sparkles className="w-3 h-3 md:w-3.5 md:h-3.5" />
                    <span>Portal Akademik &amp; Administrasi Guru</span>
                  </div>
                  
                  <h1 className={`text-base sm:text-lg md:text-2xl font-black tracking-tight leading-snug ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                    Selamat Datang di Portal Sekolah
                  </h1>
                  
                  <p className={`text-[10px] sm:text-[11px] md:text-xs leading-relaxed ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                    Sistem terpadu untuk pengelolaan agenda mengajar harian, rekap nilai akademik, absensi siswa, hingga bimbingan konseling di SMP Muna Mustofa.
                  </p>
                </div>
              </div>

              <div className={`p-2 sm:p-2.5 md:p-3 border rounded-xl text-[9px] sm:text-[10px] md:text-[11px] font-medium flex items-center gap-2 mb-1 md:mb-0 ${
                isDarkMode ? 'bg-slate-800/60 border-slate-700 text-slate-300' : 'bg-slate-100 border-slate-200 text-slate-700'
              }`}>
                <UserCheck className="w-3.5 h-3.5 md:w-4 md:h-4 shrink-0 text-emerald-500" />
                <span>Registrasi akun hanya dilakukan oleh Operator.</span>
              </div>
            </div>

            {/* OVERLAY PANEL SLIDING (POSISI AWAL: ATAS DI MOBILE, KANAN DI DESKTOP) */}
            <motion.div
              initial={false}
              animate={{
                x: typeof window !== 'undefined' && window.innerWidth >= 768 ? (isSlid ? '-100%' : '0%') : '0%',
                y: typeof window !== 'undefined' && window.innerWidth < 768 ? (isSlid ? '100%' : '0%') : '0%',
              }}
              transition={{
                type: 'spring',
                stiffness: 110,
                damping: 18,
                mass: 0.8,
              }}
              className={`absolute top-0 right-0 w-full md:w-1/2 h-1/2 md:h-full z-30 p-5 sm:p-6 md:p-10 flex flex-col justify-between text-white shadow-2xl overflow-hidden rounded-b-[40px] md:rounded-b-none ${
                isDarkMode 
                  ? 'bg-gradient-to-br from-indigo-900 via-slate-900 to-emerald-950' 
                  : 'bg-gradient-to-br from-indigo-600 via-indigo-700 to-emerald-700'
              }`}
            >
              <AnimatePresence mode="wait">
                {!isSlid ? (
                  /* KONTEN A: WELCOME OVERLAY (TAMPIL DI AWAL) */
                  <motion.div 
                    key="welcome-content"
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -15 }}
                    transition={{ duration: 0.35, delay: 0.1 }}
                    className="h-full flex flex-col justify-between items-center text-center py-1 sm:py-2 md:py-4"
                  >
                    <div className="w-9 h-9 md:w-12 md:h-12 rounded-2xl overflow-hidden bg-white p-0.5 shadow-md">
                      <img src="/logo-smp.jpg" alt="Logo SMP" className="w-full h-full object-contain" />
                    </div>

                    <div className="space-y-1 md:space-y-3">
                      <h2 className="text-xl sm:text-2xl md:text-3xl font-black tracking-tight leading-none uppercase">
                        Welcome Back!
                      </h2>
                      <p className="text-[10px] sm:text-[11px] md:text-xs text-indigo-100/90 leading-relaxed max-w-xs mx-auto">
                        Are you ready to manage your class schedule, student grades, and teaching journals today?
                      </p>
                    </div>

                    <div className="w-full space-y-2 md:space-y-4">
                      <button
                        onClick={() => setIsSlid(true)}
                        className="w-full py-2 sm:py-2.5 md:py-3 px-6 bg-white text-indigo-950 font-black rounded-xl text-xs transition hover:bg-emerald-300 shadow-xl flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <span>Get Started</span>
                        <ArrowDown className="w-4 h-4 md:hidden" />
                        <ArrowRight className="w-4 h-4 hidden md:block" />
                      </button>
                      <div className="flex items-center justify-center gap-1.5 text-[9px] md:text-[10px] text-indigo-200/70">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                        <span>SMP Muna Mustofa AI Application</span>
                      </div>
                    </div>
                  </motion.div>
                ) : (
                  /* KONTEN B: OVERLAY SAAT FORM TERBUKA */
                  <motion.div 
                    key="login-content"
                    initial={{ opacity: 0, y: -15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 15 }}
                    transition={{ duration: 0.35, delay: 0.1 }}
                    className="h-full flex flex-col justify-between items-center text-center py-1 sm:py-2 md:py-4"
                  >
                    <div className="space-y-1 md:space-y-2 pt-1 md:pt-4">
                      <span className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-emerald-300">Authentication Mode</span>
                      <h2 className="text-lg sm:text-xl md:text-2xl font-black tracking-tight">
                        Portal Login Active
                      </h2>
                      <p className="text-[10px] sm:text-[11px] md:text-xs text-indigo-100/80 leading-relaxed max-w-xs mx-auto">
                        Fill in your registered credentials on the form to proceed into the application dashboard.
                      </p>
                    </div>

                    <div className="w-full space-y-2 md:space-y-4 pb-1 md:pb-2">
                      <button
                        onClick={() => setIsSlid(false)}
                        className="w-full py-2 md:py-2.5 px-5 bg-white/10 hover:bg-white/20 text-white font-extrabold rounded-xl text-xs transition border border-white/20 flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <ArrowUp className="w-4 h-4 md:hidden" />
                        <ArrowLeft className="w-4 h-4 hidden md:block" />
                        <span>Back to Welcome Screen</span>
                      </button>
                      <div className="text-[9px] md:text-[10px] text-indigo-200/70">
                        <span>Secure Login System v2.0</span>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>

          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}