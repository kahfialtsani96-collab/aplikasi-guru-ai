-- ============================================================================
-- MIGRASI: TABEL PRESENSI PIKET / KEHADIRAN NON-MENGAJAR
-- Aplikasi Guru AI — SMP & SMK Muna Mustofa
--
-- Fitur: "Presensi Guru Piket / Kehadiran Non-Mengajar (Opsi 1)"
--   Guru yang bertugas piket atau hadir untuk tugas sekolah non-KBM tetap
--   terhitung hak TRANSPORT (HARI) di halaman /honorarium TANPA menambah JP
--   mengajar.
--
-- Cara pakai: Jalankan SELURUH skrip ini di SQL Editor Supabase Dashboard.
--   Aman dijalankan berulang (idempotent) karena memakai IF NOT EXISTS.
-- ============================================================================
BEGIN;

-- 1. TABEL PRESENSI PIKET
CREATE TABLE IF NOT EXISTS public.presensi_piket (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tanggal         date NOT NULL,
  guru_email      text NOT NULL,
  nama_guru       text,
  jenis_tugas     text NOT NULL DEFAULT 'Piket Harian'
                  CHECK (jenis_tugas IN (
                    'Piket Harian',
                    'Tugas Administrasi / Rapat',
                    'Guru Pengganti / Pendamping'
                  )),
  keterangan      text,
  created_by      text,        -- email penginput (diisi operator bila mencatatkan guru lain
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- 2. UNIQUE INDEX: satu guru hanya boleh tercatat satu kali per tanggal.
--    Pakai lower(guru_email) agar pencocokan email case-insensitive.
CREATE UNIQUE INDEX IF NOT EXISTS uq_presensi_piket_tanggal_guru
  ON public.presensi_piket (tanggal, lower(guru_email));

-- 3. INDEX pendukung untuk filter bulan/tahun dan lookup email.
CREATE INDEX IF NOT EXISTS idx_presensi_piket_tanggal
  ON public.presensi_piket (tanggal);
CREATE INDEX IF NOT EXISTS idx_presensi_piket_guru_email
  ON public.presensi_piket (lower(guru_email));

-- 4. ROW LEVEL SECURITY — permisif, selaras dengan tabel lain
--    (jurnal_agenda, absensi, dll.) karena aplikasi memakai anon key di client.
ALTER TABLE public.presensi_piket ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'presensi_piket'
      AND policyname = 'presensi_piket_all'
  ) THEN
    CREATE POLICY "presensi_piket_all"
      ON public.presensi_piket
      FOR ALL USING (true);
  END IF;
END $$;

COMMIT;
