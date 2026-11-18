-- ============================================================================
-- SKEMA DATABASE HONORARIUM GURU & STAF
-- Aplikasi Guru AI — SMP & SMK Muna Mustofa
-- Cara pakai: Jalankan skrip ini di SQL Editor Supabase Dashboard.
-- (Pastikan tabel `guru` sudah ada lebih dulu).
-- ============================================================================

-- 1. PENGATURAN GLOBAL (satu baris; tarif umum)
CREATE TABLE IF NOT EXISTS public.honorarium_pengaturan (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tarif_jp                numeric NOT NULL DEFAULT 0,
  tarif_transport_harian  numeric NOT NULL DEFAULT 15000,
  tarif_piket             numeric NOT NULL DEFAULT 0,
  tunjangan_wali_kelas    numeric NOT NULL DEFAULT 50000,
  updated_by              text,
  updated_at              timestamptz NOT NULL DEFAULT now(),
  created_at              timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id)
);

INSERT INTO public.honorarium_pengaturan (id, tarif_jp, tarif_transport_harian, tarif_piket, tunjangan_wali_kelas)
VALUES (gen_random_uuid(), 0, 15000, 0, 50000)
ON CONFLICT DO NOTHING;

-- 2. JENIS POTONGAN DINAMIS
CREATE TABLE IF NOT EXISTS public.honorarium_potongan (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nama         text NOT NULL,
  aktif        boolean NOT NULL DEFAULT true,
  tipe        text NOT NULL DEFAULT 'nominal' CHECK (tipe IN ('nominal','persen')),
  nilai        numeric NOT NULL DEFAULT 0,
  urutan       integer NOT NULL DEFAULT 0,
  updated_by   text,
  updated_at   timestamptz NOT NULL DEFAULT now(),
  created_at   timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.honorarium_potongan (nama, aktif, tipe, nilai, urutan) VALUES
  ('Infaq', true, 'nominal', 0, 1),
  ('Efisiensi Anggaran', false, 'persen', 8.5, 2)
ON CONFLICT DO NOTHING;

-- 3. PENERIMA HONORARIUM
CREATE TABLE IF NOT EXISTS public.honorarium_penerima (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guru_id                  bigint NOT NULL REFERENCES public.guru(id) ON DELETE CASCADE,
  aktif                    boolean NOT NULL DEFAULT true,
  status                   text NOT NULL DEFAULT 'guru_mengajar' CHECK (status IN ('guru_mengajar','staf_piket')),
  tunjangan_jabatan        numeric NOT NULL DEFAULT 0,
  tunjangan_masa_kerja     numeric NOT NULL DEFAULT 0,
  pembina                  numeric NOT NULL DEFAULT 0,
  wali_kelas               boolean NOT NULL DEFAULT false,
  infaq_nominal            numeric NOT NULL DEFAULT 0,
  updated_by               text,
  updated_at               timestamptz NOT NULL DEFAULT now(),
  created_at               timestamptz NOT NULL DEFAULT now(),
  UNIQUE (guru_id)
);

-- 4. TUGAS TAMBAHAN
CREATE TABLE IF NOT EXISTS public.honorarium_tugas_tambahan (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  periode        text NOT NULL,
  tanggal        date NOT NULL,
  nama_kegiatan  text NOT NULL,
  guru_ids       bigint[] NOT NULL DEFAULT '{}',
  nominal        numeric NOT NULL DEFAULT 0,
  updated_by     text,
  updated_at     timestamptz NOT NULL DEFAULT now(),
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tugas_periode ON public.honorarium_tugas_tambahan (periode);

-- 5. REKAP HONORARIUM BULANAN
CREATE TABLE IF NOT EXISTS public.honorarium_rekap (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  periode                  text NOT NULL,
  guru_id                  bigint NOT NULL REFERENCES public.guru(id) ON DELETE CASCADE,
  jumlah_jp                integer NOT NULL DEFAULT 0,
  transport_hari           integer NOT NULL DEFAULT 0,
  tunjangan_jabatan        numeric NOT NULL DEFAULT 0,
  tunjangan_masa_kerja     numeric NOT NULL DEFAULT 0,
  pembina                  numeric NOT NULL DEFAULT 0,
  wali_kelas               numeric NOT NULL DEFAULT 0,
  tugas_tambahan           numeric NOT NULL DEFAULT 0,
  potongan                 jsonb NOT NULL DEFAULT '[]',
  total_potongan           numeric NOT NULL DEFAULT 0,
  total_bersih             numeric NOT NULL DEFAULT 0,
  status                   text NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','PAID')),
  confirmed_by             text,
  confirmed_at             timestamptz,
  catatan                  text,
  updated_by               text,
  updated_at               timestamptz NOT NULL DEFAULT now(),
  created_at               timestamptz NOT NULL DEFAULT now(),
  UNIQUE (periode, guru_id)
);

CREATE INDEX IF NOT EXISTS idx_rekap_periode ON public.honorarium_rekap (periode);

-- 6. RLS permisif (aplikasi memakai anon key di client)
ALTER TABLE public.honorarium_pengaturan ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.honorarium_potongan ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.honorarium_penerima ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.honorarium_tugas_tambahan ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.honorarium_rekap ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'honorarium_pengaturan' AND policyname = 'honorarium_all_pengaturan') THEN
    CREATE POLICY "honorarium_all_pengaturan" ON public.honorarium_pengaturan FOR ALL USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'honorarium_potongan' AND policyname = 'honorarium_all_potongan') THEN
    CREATE POLICY "honorarium_all_potongan" ON public.honorarium_potongan FOR ALL USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'honorarium_penerima' AND policyname = 'honorarium_all_penerima') THEN
    CREATE POLICY "honorarium_all_penerima" ON public.honorarium_penerima FOR ALL USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'honorarium_tugas_tambahan' AND policyname = 'honorarium_all_tugas' ) THEN
    CREATE POLICY "honorarium_all_tugas" ON public.honorarium_tugas_tambahan FOR ALL USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'honorarium_rekap' AND policyname = 'honorarium_all_rekap' ) THEN
    CREATE POLICY "honorarium_all_rekap" ON public.honorarium_rekap FOR ALL USING (true);
  END IF;
END $$;

-- ============================================================================
-- 7. LOG AKTIVITAS EDIT (5 CATATAN TERBARU PER KATEGORI/TAB)
--    kategori: 'master' | 'rekap' | 'riwayat'
--    Aplikasi otomatis menyimpan hanya 5 baris terbaru per kategori
--    (insert lalu hapus yang lebih lama).
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.honorarium_audit_log (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kategori      text NOT NULL CHECK (kategori IN ('master','rekap','riwayat')),
  nama_lengkap  text NOT NULL,
  aksi          text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_kategori_waktu
  ON public.honorarium_audit_log (kategori, created_at DESC);

ALTER TABLE public.honorarium_audit_log ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'honorarium_audit_log' AND policyname = 'honorarium_all_audit_log') THEN
    CREATE POLICY "honorarium_all_audit_log" ON public.honorarium_audit_log FOR ALL USING (true);
  END IF;
END $$;

