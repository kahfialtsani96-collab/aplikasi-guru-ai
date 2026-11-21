-- ============================================================================
-- MIGRASI: ALUR PERSETUJUAN HONORARIUM 4 TAHAP
-- Pengurus -> Kepala Sekolah -> Yayasan -> Bendahara (PAID)
-- Jalankan di SQL Editor Supabase Dashboard.
-- ============================================================================
ALTER TABLE public.honorarium_rekap
  ADD COLUMN IF NOT EXISTS disahkan_kepsek_by text,
  ADD COLUMN IF NOT EXISTS disahkan_kepsek_at timestamptz,
  ADD COLUMN IF NOT EXISTS disahkan_yayasan_by text,
  ADD COLUMN IF NOT EXISTS disahkan_yayasan_at timestamptz,
  ADD COLUMN IF NOT EXISTS dibayar_bendahara_by text,
  ADD COLUMN IF NOT EXISTS dibayar_bendahara_at timestamptz,
  ADD COLUMN IF NOT EXISTS alur text NOT NULL DEFAULT 'kepsek'
    CHECK (alur IN ('kepsek','yayasan','bendahara','selesai'));
