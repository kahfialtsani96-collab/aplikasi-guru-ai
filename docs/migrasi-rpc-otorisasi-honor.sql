-- ============================================================================
-- MIGRASI: OTORISASI SERVER-SIDE (RPC) + PERKETAT RLS HONORARIUM
-- Ganti pola lama (mutasi lewat client, RLS permisif `FOR ALL USING (true)`)
-- menjadi RPC SECURITY DEFINER yang memverifikasi peran dari `guru.jabatan`/`guru.role`.
-- Jalankan di SQL Editor Supabase Dashboard.
--
-- HASIL:
--   * Semua tabel honorarium hanya boleh dibaca (SELECT) oleh user authenticated.
--   * INSERT/UPDATE/DELETE hanya lewat fungsi RPC (definer, mem-bypass RLS)
--     yang menegakkan otorisasi per peran.
--   * Alur persetujuan (KS -> Yayasan -> Bendahara/PAID) dijamin di sisi server.
-- ============================================================================
BEGIN;

-- ============================================================================
-- 0. HELPER: BACA AKSES USER SAAT INI (cocokkan email login dgn tabel guru)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.honorarium_current_access()
RETURNS TABLE(
  email text, nama text, nama_txt text, jabatan text,
  guru_role text, is_pengurus boolean, can_manage boolean
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    lower(coalesce(u.email, '')),
    upper(btrim(regexp_replace(coalesce(g.nama_lengkap, ''), '[[:space:]]+', ' ', 'g'))),
    btrim(regexp_replace(coalesce(g.nama_lengkap, ''), '[[:space:]]+', ' ', 'g')),
    lower(coalesce(g.jabatan, '')),
    coalesce(g.role, ''),
    upper(btrim(regexp_replace(coalesce(g.nama_lengkap, ''), '[[:space:]]+', ' ', 'g')))
      IN ('MUZAINI AL KAHFI','RIZIEQ NIZAR'),
    upper(btrim(regexp_replace(coalesce(g.nama_lengkap, ''), '[[:space:]]+', ' ', 'g'))))
      IN ('MUZAINI AL KAHFI','RIZIEQ NIZAR')
  FROM auth.users u
  LEFT JOIN public.guru g ON lower(g.email) = lower(u.email)
  WHERE u.id = auth.uid()
$$;

GRANT EXECUTE ON FUNCTION public.honorarium_current_access() TO authenticated;

-- ============================================================================
-- 1. LOG AUDIT (dipanggil klien; non-blocking)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.honorarium_log_audit(
  p_kategori text,
  p_aksi text
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  acc RECORD;
BEGIN
  SELECT * INTO acc FROM public.honorarium_current_access();
  INSERT INTO public.honorarium_audit_log (kategori, nama_lengkap, aksi)
  VALUES (p_kategori, coalesce(nullif(acc.nama_txt, ''), 'Anonim'), p_aksi);

  -- Simpan hanya 5 catatan terbaru per kategori
  DELETE FROM public.honorarium_audit_log
  WHERE kategori = p_kategori
    AND id NOT IN (
      SELECT id
      FROM public.honorarium_audit_log
      WHERE kategori = p_kategori
      ORDER BY created_at DESC
      LIMIT 5
    );
END $$;

GRANT EXECUTE ON FUNCTION public.honorarium_log_audit(text, text) TO authenticated;

-- ============================================================================
-- 2. SIMPAN MASTER (tarif + potongan + penerima) — Pengurus Utama
-- ============================================================================
CREATE OR REPLACE FUNCTION public.honorarium_save_master(
  p_pengaturan jsonb DEFAULT '[]'::jsonb,
  p_potongan jsonb DEFAULT '[]'::jsonb,
  p_penerima jsonb DEFAULT '[]'::jsonb
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
  IF NOT acc.can_manage THEN
    RAISE EXCEPTION 'Akses ditolak: hanya Pengurus Utama yang dapat menyimpan Master'
      USING ERRCODE = '42501';
  END IF;
  v_by := acc.nama_txt;

  -- Tarif global (satu baris)
  INSERT INTO public.honorarium_pengaturan
    (id, tarif_jp, tarif_transport_harian, tarif_piket, tunjangan_wali_kelas, updated_by, updated_at)
  SELECT
    coalesce((x->>'id')::uuid, gen_random_uuid()),
    (x->>'tarif_jp')::numeric,
    (x->>'tarif_transport_harian')::numeric,
    (x->>'tarif_piket')::numeric,
    (x->>'tunjangan_wali_kelas')::numeric,
    v_by, v_now
  FROM jsonb_array_elements(p_pengaturan) x
  ON CONFLICT (id) DO UPDATE SET
    tarif_jp = EXCLUDED.tarif_jp,
    tarif_transport_harian = EXCLUDED.tarif_transport_harian,
    tarif_piket = EXCLUDED.tarif_piket,
    tunjangan_wali_kelas = EXCLUDED.tunjangan_wali_kelas,
    updated_by = EXCLUDED.updated_by,
    updated_at = EXCLUDED.updated_at;

  -- Potongan dinamis
  INSERT INTO public.honorarium_potongan
    (id, nama, aktif, tipe, nilai, urutan, updated_by, updated_at)
  SELECT
    coalesce((x->>'id')::uuid, gen_random_uuid()),
    x->>'nama',
    coalesce((x->>'aktif')::boolean, true),
    x->>'tipe',
    (x->>'nilai')::numeric,
    (x->>'urutan')::integer,
    v_by, v_now
  FROM jsonb_array_elements(p_potongan) x
  ON CONFLICT (id) DO UPDATE SET
    nama = EXCLUDED.nama,
    aktif = EXCLUDED.aktif,
    tipe = EXCLUDED.tipe,
    nilai = EXCLUDED.nilai,
    urutan = EXCLUDED.urutan,
    updated_by = EXCLUDED.updated_by,
    updated_at = EXCLUDED.updated_at;

  -- Penerima (unik per guru_id)
  INSERT INTO public.honorarium_penerima
    (id, guru_id, aktif, status, tunjangan_jabatan, tunjangan_masa_kerja,
     pembina, wali_kelas, infaq_nominal, updated_by, updated_at)
  SELECT
    coalesce((x->>'id')::uuid, gen_random_uuid()),
    (x->>'guru_id')::bigint,
    coalesce((x->>'aktif')::boolean, true),
    x->>'status',
    (x->>'tunjangan_jabatan')::numeric,
    (x->>'tunjangan_masa_kerja')::numeric,
    (x->>'pembina')::numeric,
    coalesce((x->>'wali_kelas')::boolean, false),
    (x->>'infaq_nominal')::numeric,
    v_by, v_now
  FROM jsonb_array_elements(p_penerima) x
  ON CONFLICT (guru_id) DO UPDATE SET
    aktif = EXCLUDED.aktif,
    status = EXCLUDED.status,
    tunjangan_jabatan = EXCLUDED.tunjangan_jabatan,
    tunjangan_masa_kerja = EXCLUDED.tunjangan_masa_kerja,
    pembina = EXCLUDED.pembina,
    wali_kelas = EXCLUDED.wali_kelas,
    infaq_nominal = EXCLUDED.infaq_nominal,
    updated_by = EXCLUDED.updated_by,
    updated_at = EXCLUDED.updated_at;
END $$;

GRANT EXECUTE ON FUNCTION public.honorarium_save_master(jsonb, jsonb, jsonb) TO authenticated;

-- ============================================================================
-- 3. SIMPAN REKAP BULANAN — Pengurus Utama atau Yayasan (tahap Yayasan)
--    Pengurus Utama: selalu boleh menyimpan.
--    Yayasan: boleh menyimpan HANYA untuk periode yang sudah disahkan Kepsek dan
--    belum disahkan Yayasan. Menolak jika periode sudah melewati persetujuan
--    Yayasan / PAID (terkunci).
-- ============================================================================
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
  IF NOT acc.can_manage THEN
    IF acc.jabatan NOT LIKE '%yayasan%' THEN
      RAISE EXCEPTION 'Akses ditolak: hanya Pengurus Utama atau Yayasan yang dapat menyimpan Rekap'
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

  -- Kunci periode yang sudah bergerak ke tahap persetujuan/pembayaran
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
     potongan, total_potongan, total_bersih, status, catatan, updated_by, updated_at)
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
    potongan = EXCLUDED.potongan,
    total_potongan = EXCLUDED.total_potongan,
    total_bersih = EXCLUDED.total_bersih,
    status = EXCLUDED.status,
    catatan = EXCLUDED.catatan,
    updated_by = EXCLUDED.updated_by,
    updated_at = EXCLUDED.updated_at;
END $$;

GRANT EXECUTE ON FUNCTION public.honorarium_save_rekap(jsonb) TO authenticated;

-- ============================================================================
-- 4. PERSETUJUAN KEPALA SEKOLAH — KS SMP
-- ============================================================================
CREATE OR REPLACE FUNCTION public.honorarium_approve_kepsek(
  p_periode text
)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  acc RECORD;
  v_now timestamptz := now();
  n integer;
BEGIN
  SELECT * INTO acc FROM public.honorarium_current_access();
  IF NOT (acc.jabatan LIKE '%kepala%' AND acc.jabatan NOT LIKE '%smk%') THEN
    RAISE EXCEPTION 'Akses ditolak: hanya Kepala Sekolah yang dapat menyetujui'
      USING ERRCODE = '42501';
  END IF;

  IF EXISTS (SELECT 1 FROM public.honorarium_rekap WHERE periode = p_periode AND status = 'PAID') THEN
    RAISE EXCEPTION 'Periode sudah dibayar & terkunci (PAID)';
  END IF;
  IF EXISTS (SELECT 1 FROM public.honorarium_rekap
             WHERE periode = p_periode AND (disahkan_kepsek_at IS NOT NULL OR confirmed_at IS NOT NULL)) THEN
    RAISE EXCEPTION 'Periode ini sudah disetujui Kepala Sekolah';
  END IF;

  UPDATE public.honorarium_rekap SET
    confirmed_by = acc.nama_txt,
    confirmed_at = v_now,
    disahkan_kepsek_by = acc.nama_txt,
    disahkan_kepsek_at = v_now,
    alur = 'yayasan',
    updated_by = acc.nama_txt,
    updated_at = v_now
  WHERE periode = p_periode;

  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;

GRANT EXECUTE ON FUNCTION public.honorarium_approve_kepsek(text) TO authenticated;

-- ============================================================================
-- 5. PERSETUJUAN YAYASAN
-- ============================================================================
CREATE OR REPLACE FUNCTION public.honorarium_approve_yayasan(
  p_periode text
)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  acc RECORD;
  v_now timestamptz := now();
  n integer;
BEGIN
  SELECT * INTO acc FROM public.honorarium_current_access();
  IF acc.jabatan NOT LIKE '%yayasan%' THEN
    RAISE EXCEPTION 'Akses ditolak: hanya Yayasan yang dapat menyetujui tahap ini'
      USING ERRCODE = '42501';
  END IF;

  IF EXISTS (SELECT 1 FROM public.honorarium_rekap WHERE periode = p_periode AND status = 'PAID') THEN
    RAISE EXCEPTION 'Periode sudah dibayar & terkunci (PAID)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.honorarium_rekap
                 WHERE periode = p_periode AND (disahkan_kepsek_at IS NOT NULL OR confirmed_at IS NOT NULL)) THEN
    RAISE EXCEPTION 'Belum disetujui Kepala Sekolah';
  END IF;
  IF EXISTS (SELECT 1 FROM public.honorarium_rekap
             WHERE periode = p_periode AND disahkan_yayasan_at IS NOT NULL) THEN
    RAISE EXCEPTION 'Periode ini sudah disetujui Yayasan';
  END IF;

  UPDATE public.honorarium_rekap SET
    disahkan_yayasan_by = acc.nama_txt,
    disahkan_yayasan_at = v_now,
    alur = 'bendahara',
    updated_by = acc.nama_txt,
    updated_at = v_now
  WHERE periode = p_periode;

  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;

GRANT EXECUTE ON FUNCTION public.honorarium_approve_yayasan(text) TO authenticated;

-- ============================================================================
-- 6. KONFIRMASI PEMBAYARAN BENDAHARA — Bendahara (PAID)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.honorarium_pay_bendahara(
  p_periode text
)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  acc RECORD;
  v_now timestamptz := now();
  n integer;
BEGIN
  SELECT * INTO acc FROM public.honorarium_current_access();
  IF acc.jabatan NOT LIKE '%bendahara%' THEN
    RAISE EXCEPTION 'Akses ditolak: hanya Bendahara yang dapat menandai dibayar'
      USING ERRCODE = '42501';
  END IF;

  IF EXISTS (SELECT 1 FROM public.honorarium_rekap WHERE periode = p_periode AND status = 'PAID') THEN
    RAISE EXCEPTION 'Periode sudah dibayar & terkunci (PAID)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.honorarium_rekap
                 WHERE periode = p_periode AND disahkan_yayasan_at IS NOT NULL) THEN
    RAISE EXCEPTION 'Belum disetujui Yayasan';
  END IF;

  UPDATE public.honorarium_rekap SET
    status = 'PAID',
    alur = 'selesai',
    dibayar_bendahara_by = acc.nama_txt,
    dibayar_bendahara_at = v_now,
    updated_by = acc.nama_txt,
    updated_at = v_now
  WHERE periode = p_periode;

  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;

GRANT EXECUTE ON FUNCTION public.honorarium_pay_bendahara(text) TO authenticated;

-- ============================================================================
-- 7. TUGAS TAMBAHAN (insert / delete) — Pengurus Utama
-- ============================================================================
CREATE OR REPLACE FUNCTION public.honorarium_save_tugas(
  p_periode text,
  p_tanggal date,
  p_nama_kegiatan text,
  p_guru_ids bigint[],
  p_nominal numeric
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  acc RECORD;
  v_now timestamptz := now();
BEGIN
  SELECT * INTO acc FROM public.honorarium_current_access();
  IF NOT acc.can_manage THEN
    RAISE EXCEPTION 'Akses ditolak: hanya Pengurus Utama yang dapat mencatat tugas'
      USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.honorarium_tugas_tambahan
    (periode, tanggal, nama_kegiatan, guru_ids, nominal, updated_by, updated_at)
  VALUES (p_periode, p_tanggal, p_nama_kegiatan, p_guru_ids, p_nominal, acc.nama_txt, v_now);
END $$;

GRANT EXECUTE ON FUNCTION public.honorarium_save_tugas(text, date, text, bigint[], numeric) TO authenticated;

CREATE OR REPLACE FUNCTION public.honorarium_delete_tugas(
  p_id uuid
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  acc RECORD;
BEGIN
  SELECT * INTO acc FROM public.honorarium_current_access();
  IF NOT acc.can_manage THEN
    RAISE EXCEPTION 'Akses ditolak: hanya Pengurus Utama yang dapat menghapus tugas'
      USING ERRCODE = '42501';
  END IF;

  DELETE FROM public.honorarium_tugas_tambahan WHERE id = p_id;
END $$;

GRANT EXECUTE ON FUNCTION public.honorarium_delete_tugas(uuid) TO authenticated;

-- ============================================================================
-- 8. PERKETAT RLS — hapus kebijakan permisif, ganti dengan SELECT-only
-- ============================================================================
DROP POLICY IF EXISTS "honorarium_all_pengaturan" ON public.honorarium_pengaturan;
DROP POLICY IF EXISTS "honorarium_all_potongan"  ON public.honorarium_potongan;
DROP POLICY IF EXISTS "honorarium_all_penerima"  ON public.honorarium_penerima;
DROP POLICY IF EXISTS "honorarium_all_tugas"     ON public.honorarium_tugas_tambahan;
DROP POLICY IF EXISTS "honorarium_all_rekap"     ON public.honorarium_rekap;
DROP POLICY IF EXISTS "honorarium_all_audit_log" ON public.honorarium_audit_log;

CREATE POLICY "honorarium_read_pengaturan" ON public.honorarium_pengaturan
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "honorarium_read_potongan" ON public.honorarium_potongan
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "honorarium_read_penerima" ON public.honorarium_penerima
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "honorarium_read_tugas" ON public.honorarium_tugas_tambahan
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "honorarium_read_rekap" ON public.honorarium_rekap
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "honorarium_read_audit_log" ON public.honorarium_audit_log
  FOR SELECT TO authenticated USING (true);

-- ============================================================================
-- 9. INTEGRITAS: PAID harus punya jejak persetujuan & pembayaran lengkap
--    (backfill data lama agar constraint tidak gagal)
-- ============================================================================
UPDATE public.honorarium_rekap SET
  disahkan_kepsek_by     = coalesce(disahkan_kepsek_by, confirmed_by, updated_by),
  disahkan_kepsek_at     = coalesce(disahkan_kepsek_at, confirmed_at, updated_at),
  disahkan_yayasan_by    = coalesce(disahkan_yayasan_by, confirmed_by, updated_by),
  disahkan_yayasan_at    = coalesce(disahkan_yayasan_at, confirmed_at, updated_at),
  dibayar_bendahara_by   = coalesce(dibayar_bendahara_by, confirmed_by, updated_by),
  dibayar_bendahara_at   = coalesce(dibayar_bendahara_at, confirmed_at, updated_at)
WHERE status = 'PAID'
  AND (disahkan_kepsek_at IS NULL OR disahkan_yayasan_at IS NULL OR dibayar_bendahara_at IS NULL);

ALTER TABLE public.honorarium_rekap
  DROP CONSTRAINT IF EXISTS chk_rekap_paid_consistency;
ALTER TABLE public.honorarium_rekap
  ADD CONSTRAINT chk_rekap_paid_consistency CHECK (
    NOT (status = 'PAID' AND (dibayar_bendahara_at IS NULL OR disahkan_yayasan_at IS NULL))
  );

COMMIT;
