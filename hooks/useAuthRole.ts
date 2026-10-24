import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

// Helper fungsi instansiasi aman agar lolos build SSG Vercel
function getSupabaseClient() {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://kvrulbdvgxfrtmznpjnm.supabase.co'
  const rawKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder'
  
  const url = rawUrl.replace(/['"]/g, '').trim()
  const key = rawKey.replace(/['"]/g, '').trim()

  return createClient(url, key)
}

export interface AuthRoleState {
  role: 'operator' | 'guru' | null
  isOperator: boolean
  isWaliKelas: boolean
  canAccessBimbingan: boolean
  loading: boolean
}

export function useAuthRole(): AuthRoleState {
  const [role, setRole] = useState<'operator' | 'guru' | null>(null)
  const [isWaliKelas, setIsWaliKelas] = useState<boolean>(false)
  const [loading, setLoading] = useState<boolean>(true)

  useEffect(() => {
    async function checkRole() {
      try {
        // Buat client Supabase di dalam useEffect
        const supabase = getSupabaseClient()

        // 1. Ambil data user yang sedang login dari Supabase Auth
        const { data: { user } } = await supabase.auth.getUser()
        if (!user || !user.email) {
          setLoading(false)
          return
        }

        // 2. Cek role pengguna di tabel public.guru berdasarkan email
        const { data: guruData } = await supabase
          .from('guru')
          .select('id, role')
          .eq('email', user.email)
          .single()

        if (guruData) {
          const userRole = (guruData.role as 'operator' | 'guru') || 'guru'
          setRole(userRole)

          // 3. Cek apakah guru ini terdaftar sebagai wali kelas di tabel public.kelas
          const { data: kelasData } = await supabase
            .from('kelas')
            .select('id')
            .eq('wali_kelas_id', guruData.id)

          if (kelasData && kelasData.length > 0) {
            setIsWaliKelas(true)
          }
        }
      } catch (err) {
        console.error('Gagal mengambil data role:', err)
      } finally {
        setLoading(false)
      }
    }

    checkRole()
  }, [])

  return {
    role,
    isOperator: role === 'operator',
    isWaliKelas,
    canAccessBimbingan: role === 'operator' || isWaliKelas,
    loading
  }
}