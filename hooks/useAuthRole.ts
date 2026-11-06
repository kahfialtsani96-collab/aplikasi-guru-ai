import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

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
        const supabase = getSupabaseClient()

        // 1. Ambil data user login
        const { data: { user } } = await supabase.auth.getUser()
        if (!user || !user.email) {
          setLoading(false)
          return
        }

        const cleanEmail = user.email.trim().toLowerCase()

        // 2. Cek role di tabel guru menggunakan .ilike() (TIDAK MEMBEDAKAN HURUF BESAR/KECIL)
        const { data: guruData } = await supabase
          .from('guru')
          .select('id, role')
          .ilike('email', cleanEmail)
          .maybeSingle()

        if (guruData) {
          const rawRole = (guruData.role || '').toLowerCase()
          const userRole: 'operator' | 'guru' = rawRole === 'operator' ? 'operator' : 'guru'
          setRole(userRole)

          // 3. Cek status wali kelas
          const { data: kelasData } = await supabase
            .from('kelas')
            .select('id')
            .eq('wali_kelas_id', guruData.id)

          if (kelasData && kelasData.length > 0) {
            setIsWaliKelas(true)
          }
        } else {
          // Jika tidak ada di tabel guru, tetapkan role default
          setRole('guru')
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