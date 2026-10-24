'use client'

import { useEffect, useRef } from 'react'
import { createClient } from '@supabase/supabase-js'

const getSupabaseUrl = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://kvrulbdvgxfrtmznpjnm.supabase.co'
  return url.replace(/['"]/g, '').trim()
}

const getSupabaseAnonKey = () => {
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder'
  return key.replace(/['"]/g, '').trim()
}

const supabase = createClient(getSupabaseUrl(), getSupabaseAnonKey())

// Ubah sesuai kebutuhan (misal 60 * 60 * 1000 untuk 1 Jam)
const INACTIVITY_LIMIT = 60 * 60 * 1000 

export default function InactivityHandler() {
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut()
      
      // JANGAN hapus 'theme' di localStorage agar pilihan Dark Mode tetap tersimpan
      alert('Sesi Anda telah berakhir karena tidak ada aktivitas. Silakan login kembali.')
      
      // Gunakan window.location.href agar halaman melakukan hard refresh ke /login secara bersih
      window.location.href = '/login'
    } catch (err) {
      console.error('Error saat auto-logout:', err)
    }
  }

  const resetTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
    }

    timerRef.current = setTimeout(() => {
      handleLogout()
    }, INACTIVITY_LIMIT)
  }

  useEffect(() => {
    // Jalankan timer saat pertama kali aplikasi dimuat
    resetTimer()

    // Daftar event aktivitas pengguna
    const events = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart']

    const handleUserActivity = () => {
      resetTimer()
    }

    events.forEach((event) => {
      window.addEventListener(event, handleUserActivity)
    })

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
      }
      events.forEach((event) => {
        window.removeEventListener(event, handleUserActivity)
      })
    }
  }, [])

  return null
}