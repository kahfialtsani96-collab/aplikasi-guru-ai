-- ============================================================================
-- MIGRASI PERIODE AKADEMIK TABEL `jadwal`
-- Menambahkan kolom `semester` dan `tahun_ajaran` beserta backfill data lama.
--
-- Cara pakai: jalankan di SQL Editor Supabase Dashboard (atau via migration tool).
-- ============================================================================

ALTER TABLE public.jadwal
  ADD COLUMN IF NOT EXISTS semester text NOT NULL DEFAULT 'Ganjil',
  ADD COLUMN IF NOT EXISTS tahun_ajaran text NOT NULL DEFAULT '2026/2027';

-- Backfill seluruh data jadwal yang sudah tersimpan agar masuk periode Ganjil 2026/2027
UPDATE public.jadwal
  SET semester = 'Ganjil',
      tahun_ajaran = '2026/2027'
  WHERE semester IS NULL OR tahun_ajaran IS NULL;

-- Indeks untuk mempercepat filter per periode
CREATE INDEX IF NOT EXISTS idx_jadwal_periode
  ON public.jadwal (tahun_ajaran, semester);
