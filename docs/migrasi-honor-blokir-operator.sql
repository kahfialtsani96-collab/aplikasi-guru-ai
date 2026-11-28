-- ============================================================================
-- MIGRASI: HANYA PENGURUS UTAMA YANG DAPAT MENGELOLA HONORARIUM
-- (Blokir operator biasa — kebijakan: "hanya operator pengurus, bukan operator")
-- ============================================================================
-- Perubahan:
--   Sebelumnya `honorarium_current_access().can_manage = true` untuk SEMUA guru
--   dengan `role='operator'` MAUPUN 2 nama Pengurus (MUZAINI AL KAHFI &
--   RIZIEQ NIZAR). Akibatnya operator biasa (mis. APRELIA / FADIAH) tetap bisa
--   menulis lewat API/RPC.
--   Sekarang `can_manage` hanya true untuk 2 nama Pengurus Utama. Guru/operator
--   lain TIDAK dapat menyimpan Master, Rekap, maupun Tugas Tambahan.
-- Jalankan di SQL Editor Supabase Dashboard.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.honorarium_current_access()
 RETURNS TABLE(email text, nama text, nama_txt text, jabatan text, guru_role text, is_pengurus boolean, can_manage boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH me AS (
    SELECT g.*
    FROM auth.users u
    LEFT JOIN public.guru g ON lower(g.email) = lower(u.email)
    WHERE u.id = auth.uid()
  ),
  norm AS (
    SELECT
      me.email,
      me.nama_lengkap,
      btrim(regexp_replace(coalesce(me.nama_lengkap, ''), '[[:space:]]+', ' ', 'g')) AS nama_norm,
      me.jabatan,
      me.role
    FROM me
  )
  SELECT
    lower(coalesce(n.email, '')),
    upper(n.nama_norm),
    n.nama_norm,
    lower(coalesce(n.jabatan, '')),
    coalesce(n.role, ''),
    upper(n.nama_norm) IN ('MUZAINI AL KAHFI','RIZIEQ NIZAR'),
    upper(n.nama_norm) IN ('MUZAINI AL KAHFI','RIZIEQ NIZAR')
  FROM norm n
$function$;

GRANT EXECUTE ON FUNCTION public.honorarium_current_access() TO authenticated;
