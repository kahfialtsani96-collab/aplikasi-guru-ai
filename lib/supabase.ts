import { createClient } from '@supabase/supabase-js'

// Helper aman: mencegah error prerender/SSG Vercel, membersihkan tanda kutip
// yang mungkin terbawa dari env, dan menyediakan URL cadangan.
const getSupabaseUrl = () =>
  (process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://kvrulbdvgxfrtmznpjnm.supabase.co')
    .replace(/['"]/g, '')
    .trim()

const getSupabaseAnonKey = () =>
  (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder')
    .replace(/['"]/g, '')
    .trim()

export const supabase = createClient(getSupabaseUrl(), getSupabaseAnonKey())