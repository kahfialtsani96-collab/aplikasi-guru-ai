-- ============================================================================
-- MIGRASI: TAMBAH KOLOM PIKET KE honorarium_rekap
-- ============================================================================
-- Latar belakang (temuan F12, analisa Honorarium 25 Nov 2026):
--   "Tarif Piket" di honorarium_pengaturan selama ini tidak pernah dipakai
--   menghitung honor. Semantik baru (keputusan Ketua, 25 Nov 2026):
--   staf piket dibayar per hari hadir — piket = hari transport x tarif_piket —
--   dan nominalnya masuk sebagai baris sendiri di rincian rekap.
--
--   - Page menghitung piket saat "Tarik & Hitung Otomatis" (hanya untuk
--     penerima status 'staf_piket'; guru mengajar = 0) dan menyimpannya
--     per baris rekap, sehingga nilai historis tidak berubah bila tarif
--     piket diubah kemudian.
--   - RPC honorarium_save_rekap di bawah ini MENYALIN definisi terakhir dari
--     docs/migrasi-yayasan-edit-rekap.sql (BUKAN dari
--     migrasi-rpc-otorisasi-honor.sql — file Yayasan itulah yang terakhir
--     mendefinisikan ulang fungsi ini, dengan jendela edit Yayasan) dengan
--     tambahan kolom piket. Semua logika lama dipertahankan: cek peran,
--     jendela edit Yayasan, dan kunci periode PAID/disahkan Yayasan.
--
--   - Page tetap backward-compatible: bila migrasi ini BELUM dijalankan,
--     RPC lama mengabaikan key jsonb 'piket' yang tak dikenal dan piket
--     terbaca 0.
--
-- Jalankan di SQL Editor Supabase Dashboard (boleh sebelum atau sesudah
-- merge PR fix/honorarium-batch-2).
-- ============================================================================

ALTER TABLE public.honorarium_rekap
  ADD COLUMN IF NOT EXISTS piket numeric NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.honorarium_save_rekap(
  p_rows jsonb
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  acc RECORD;
  v_now timestamptz := now();
  v_by text;
BEGIN
  SELECT * INTO acc FROM public.honorarium_current_access();

  -- Akses: Pengurus/Operator (can_manage) atau Yayasan pada tahap Yayasan.
  IF NOT acc.can_manage THEN
    IF acc.jabatan NOT LIKE '%yayasan%' THEN
      RAISE EXCEPTION 'Akses ditolak: hanya Pengurus/Operator atau Yayasan yang dapat menyimpan Rekap'
        USING ERRCODE = '42501';
    END IF;
    -- Yayasan hanya boleh mengedit periode yang SUDAH disahkan Kepala Sekolah.
    IF EXISTS (
      SELECT 1
      FROM public.honorarium_rekap r
      WHERE r.periode IN (SELECT x->>'periode' FROM jsonb_array_elements(p_rows) x)
        AND (r.disahkan_kepsek_at IS NULL AND r.confirmed_at IS NULL)
    ) THEN
      RAISE EXCEPTION 'Periode belum disahkan Kepala Sekolah — Yayasan belum dapat mengedit'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  v_by := acc.nama_txt;

  -- Kunci periode yang sudah bergerak ke tahap berikutnya / dibayar
  -- (termasuk setelah Yayasan menyetujui => terkunci kembali).
  IF EXISTS (
    SELECT 1
    FROM public.honorarium_rekap r
    WHERE r.periode IN (SELECT x->>'periode' FROM jsonb_array_elements(p_rows) x)
      AND (r.status = 'PAID' OR r.disahkan_yayasan_at IS NOT NULL)
  ) THEN
    RAISE EXCEPTION 'Periode ini sudah melewati persetujuan/dibayar (terkunci) — tidak dapat menyimpan Rekap';
  END IF;

  INSERT INTO public.honorarium_rekap
    (periode, guru_id, jumlah_jp, transport_hari,
     tunjangan_jabatan, tunjangan_masa_kerja, pembina, wali_kelas, tugas_tambahan,
     piket, potongan, total_potongan, total_bersih, status, catatan, updated_by, updated_at)
  SELECT
    x->>'periode',
    (x->>'guru_id')::bigint,
    (x->>'jumlah_jp')::integer,
    (x->>'transport_hari')::integer,
    (x->>'tunjangan_jabatan')::numeric,
    (x->>'tunjangan_masa_kerja')::numeric,
    (x->>'pembina')::numeric,
    (x->>'wali_kelas')::numeric,
    (x->>'tugas_tambahan')::numeric,
    coalesce((x->>'piket')::numeric, 0),
    coalesce(x->'potongan', '[]'::jsonb),
    (x->>'total_potongan')::numeric,
    (x->>'total_bersih')::numeric,
    coalesce(x->>'status', 'DRAFT'),
    x->>'catatan',
    v_by, v_now
  FROM jsonb_array_elements(p_rows) x
  ON CONFLICT (periode, guru_id) DO UPDATE SET
    jumlah_jp = EXCLUDED.jumlah_jp,
    transport_hari = EXCLUDED.transport_hari,
    tunjangan_jabatan = EXCLUDED.tunjangan_jabatan,
    tunjangan_masa_kerja = EXCLUDED.tunjangan_masa_kerja,
    pembina = EXCLUDED.pembina,
    wali_kelas = EXCLUDED.wali_kelas,
    tugas_tambahan = EXCLUDED.tugas_tambahan,
    piket = EXCLUDED.piket,
    potongan = EXCLUDED.potongan,
    total_potongan = EXCLUDED.total_potongan,
    total_bersih = EXCLUDED.total_bersih,
    status = EXCLUDED.status,
    catatan = EXCLUDED.catatan,
    updated_by = EXCLUDED.updated_by,
    updated_at = EXCLUDED.updated_at;
END $$;

GRANT EXECUTE ON FUNCTION public.honorarium_save_rekap(jsonb) TO authenticated;
