'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthRole } from './useAuthRole'

/**
 * Hook terpusat untuk guard akses halaman khusus operator.
 *
 * Membungkus `useAuthRole` dan otomatis redirect ke `/` ketika user
 * bukan operator (setelah pengecekan role selesai). Mengembalikan
 * `{ isOperator, loading }` agar tetap bisa dipakai untuk render UI.
 */
export function useRequireOperator() {
  const router = useRouter()
  const { isOperator, loading } = useAuthRole()

  useEffect(() => {
    if (!loading && !isOperator) {
      router.push('/')
    }
  }, [loading, isOperator, router])

  return { isOperator, loading }
}
