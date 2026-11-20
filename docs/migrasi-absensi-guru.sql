-- ============================================================================
-- MIGRASI: TABEL ABSENSI HARIAN GURU
-- Aplikasi Guru AI — SMP & SMK Muna Mustofa
--
-- Fitur: "Absensi Harian Guru" di halaman /absensi (tab Absensi Guru).
--   Tabel ini menjadi SUMBER UTAMA perhitungan kolom TRANSPORT (HARI) di
--   halaman /honorarium (status 'Hadir' → dihitung sebagai hari transport),
--   terpisah dari absensi siswa.
--
-- Cara pakai: Jalankan SELURUH skrip ini di SQL Editor Supabase Dashboard.
--   Aman dijalankan berulang (idempotent) karena memakai IF NOT EXISTS.
-- ============================================================================
BEGIN;

-- 1. TABEL ABSENSI GURU
CREATE TABLE IF NOT EXISTS public.absensi_guru (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tanggal       date NOT NULL,
  guru_email    text NOT NULL,
  nama_lengkap  text,
  status        text NOT NULL DEFAULT 'Hadir' CHECK (status IN (
                  'Hadir', 'Izin', 'Sakit', 'Tanpa Keterangan'
                )),
  keterangan    text,
  input_by      text,          -- email operator yang menginput
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  -- Satu guru hanya boleh memiliki 1 data absensi per tanggal.
  UNIQUE (tanggal, guru_email)
);

-- 2. INDEX pendukung untuk filter bulan/tahun dan lookup email.
CREATE INDEX IF NOT EXISTS idx_absensi_guru_tanggal
  ON public.absensi_guru (tanggal);
CREATE INDEX IF NOT EXISTS idx_absensi_guru_guru_email
  ON public.absensi_guru (lower(guru_email));
CREATE INDEX IF NOT EXISTS idx_absensi_guru_status
  ON public.absensi_guru (status);

-- 3. ROW LEVEL SECURITY — permisif, selaras dengan tabel lain
--    (absensi, jurnal_agenda, presensi_piket, dll.) karena aplikasi
--    memakai anon key di client.
ALTER TABLE public.absensi_guru ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'absensi_guru'
      AND policyname = 'absensi_guru_all'
  ) THEN
    CREATE POLICY "absensi_guru_all"
      ON public.absensi_guru
      FOR ALL USING (true);
  END IF;
END $$;

-- ============================================================================
-- BACKFILL NOVEMBER 2026
-- Mengisi kehadiran tanggal 1–20 November 2026 otomatis dengan status 'Hadir'
-- dari gabungan tanggal unik:
--   (a) `jurnal_agenda` ber-status 'Terlaksana' → keterangan 'KBM'
--   (b) `presensi_piket`                               → keterangan 'Piket Harian'
-- Email dinormalisasi ke huruf kecil agar selaras dengan penulisan aplikasi
-- (pencocokan case-insensitive). `git` dipakai untuk mengisi nama_lengkap.
-- ============================================================================

-- (a) BACKFILL DARI JURNAL AGENDA (tabel dijamin ada)
-- Catatan penting: kolom `jurnal_agenda.tanggal` bertipe **text**, sedangkan
-- kolom target `absensi_guru.tanggal` bertipe **date**. Oleh karena itu sumber
-- tanggal di-cast eksplisit menjadi `date` (`j.tanggal::date`) di bagian SELECT
-- (melalui subquery) dan WHERE. `SELECT DISTINCT` dipakai agar pasangan unik
-- (tanggal, guru_email) dihasilkan hanya sekali (idempotent + mencegah kerja
-- redundant pada ON CONFLICT).
INSERT INTO public.absensi_guru (tanggal, guru_email, nama_lengkap, status, keterangan, input_by)
SELECT d.tanggal,
       d.guru_email,
       COALESCE(g.nama_lengkap, ''),
       'Hadir',
       'KBM',
       'seed-backfill-nov-2026'
FROM (
  SELECT DISTINCT
         j.tanggal::date AS tanggal,
         LOWER(BTRIM(j.guru_email)) AS guru_email
  FROM public.jurnal_agenda j
  WHERE j.status = 'Terlaksana'
    AND j.tanggal::date BETWEEN '2026-11-01' AND '2026-11-20'
    AND LOWER(BTRIM(j.guru_email)) <> ''
) d
LEFT JOIN public.guru g
       ON LOWER(BTRIM(g.email)) = d.guru_email
ON CONFLICT (tanggal, guru_email) DO NOTHING;

-- (b) BACKFILL DARI PRESENSI PIKET (jika tabel ada; aman lewat to_regclass)
DO $$
BEGIN
  IF to_regclass('public.presensi_piket') IS NOT NULL THEN
    EXECUTE $q$
      INSERT INTO public.absensi_guru (tanggal, guru_email, nama_lengkap, status, keterangan, input_by)
      SELECT p.tanggal,
             LOWER(BTRIM(p.guru_email)),
             COALESCE(g.nama_lengkap, p.nama_guru, ''),
             'Hadir',
             'Piket Harian',
             'seed-backfill-nov-2026'
      FROM public.presensi_piket p
      LEFT JOIN public.guru g
             ON LOWER(BTRIM(g.email)) = LOWER(BTRIM(p.guru_email))
      WHERE p.tanggal BETWEEN '2026-11-01' AND '2026-11-20'
        AND LOWER(BTRIM(p.guru_email)) <> ''
      ON CONFLICT (tanggal, guru_email) DO NOTHING;
    $q$;
  END IF;
END $$;

COMMIT;
