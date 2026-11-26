-- ============================================================
-- Migrasi: RPC simpan_absensi — simpan absensi dalam 1 transaksi
-- PR #5 (temuan audit #11)
-- ============================================================
-- MASALAH:
--   Halaman absensi SMP & SMK menyimpan dengan 2 langkah terpisah:
--   1) DELETE baris absensi sesi lama (kelas+mapel+tanggal+semester+TA)
--   2) INSERT baris absensi baru
--   Kalau langkah 2 gagal (internet putus / error server), langkah 1
--   sudah terlanjur jalan: absensi sesi itu hilang total.
--
-- PERBAIKAN:
--   Fungsi ini menjalankan DELETE + INSERT dalam SATU transaksi
--   database. Kalau INSERT gagal, DELETE ikut dibatalkan otomatis,
--   jadi absensi lama tetap utuh dan guru tinggal tekan Simpan lagi.
--
-- PERBAIKAN 2026-11-26 (bug: simpan absensi gagal total):
--   Kolom absensi.tanggal ternyata TEXT, bukan DATE — jadi perbandingan
--   `tanggal = p_tanggal` (date) ditolak Postgres dengan error
--   "operator does not exist: text = date". DELETE di bawah sekarang
--   membandingkan `tanggal = p_tanggal::text`. Tanda tangan fungsi
--   tidak berubah, jadi CREATE OR REPLACE ini cukup dijalankan ulang;
--   tidak ada perubahan kode aplikasi dan tidak perlu deploy ulang.
--   Bug ini baru muncul 26 Nov 2026 karena PR #5 merge 24 Nov sore dan
--   25 Nov tidak ada KBM (Hari Guru) — 26 Nov adalah simpan pertama
--   sejak fungsi ini dipakai. Absensi SMK ikut rusak dan ikut sembuh,
--   karena memakai fungsi yang sama.
--
-- CARA PAKAI:
--   1. Jalankan file ini di Supabase Dashboard > SQL Editor > Run.
--      LAKUKAN INI SEBELUM merge PR #5, supaya fungsi sudah ada saat
--      kode baru deploy. (Kalau PR merge duluan, tombol Simpan akan
--      gagal dengan pesan error, tapi TIDAK ada data yang hilang,
--      karena DELETE-nya ada di dalam fungsi yang belum ada itu.)
--   2. Verifikasi dengan query di bawah (harus mengembalikan 1 baris).
-- ============================================================

CREATE OR REPLACE FUNCTION public.simpan_absensi(
  p_jenjang text,
  p_kelas_id integer,
  p_siswa_ids text[],
  p_mapel_id integer,
  p_tanggal date,
  p_semester text,
  p_tahun_ajaran text,
  p_guru_email text,
  p_rows jsonb
)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  v_inserted integer := 0;
BEGIN
  -- 1) Hapus absensi sesi lama. Predikatnya SAMA PERSIS dengan DELETE
  --    di kode lama (app/absensi & app/smk/absensi):
  --    - mode ALL (p_kelas_id NULL): berdasarkan daftar siswa
  --    - mode satu kelas: berdasarkan kelas_id
  --    - SMP: jenjang SMP atau NULL; SMK: jenjang SMK
  --    - guru_email hanya difilter kalau diisi (SMP); SMK kirim NULL.
  IF p_kelas_id IS NULL THEN
    DELETE FROM public.absensi
    WHERE siswa_id = ANY(p_siswa_ids)
      AND mapel_id = p_mapel_id
      AND tanggal = p_tanggal::text
      AND semester = p_semester
      AND tahun_ajaran = p_tahun_ajaran
      AND (p_guru_email IS NULL OR guru_email = p_guru_email)
      AND (
        (p_jenjang = 'SMK' AND jenjang = 'SMK')
        OR (p_jenjang = 'SMP' AND (jenjang = 'SMP' OR jenjang IS NULL))
      );
  ELSE
    DELETE FROM public.absensi
    WHERE kelas_id = p_kelas_id
      AND mapel_id = p_mapel_id
      AND tanggal = p_tanggal::text
      AND semester = p_semester
      AND tahun_ajaran = p_tahun_ajaran
      AND (p_guru_email IS NULL OR guru_email = p_guru_email)
      AND (
        (p_jenjang = 'SMK' AND jenjang = 'SMK')
        OR (p_jenjang = 'SMP' AND (jenjang = 'SMP' OR jenjang IS NULL))
      );
  END IF;

  -- 2) Simpan baris baru. Kalau ada satu baris yang gagal, SELURUH
  --    fungsi gagal dan DELETE di atas ikut dibatalkan (rollback) —
  --    absensi lama tetap utuh.
  INSERT INTO public.absensi (
    tanggal, jam_ke, jam_ke_num, kelas_id, mapel_id, siswa_id,
    kelas, mapel, nama_siswa, nisn, status,
    semester, tahun_ajaran, guru_email, jenjang
  )
  SELECT
    (r ->> 'tanggal')::date,
    r ->> 'jam_ke',
    (r ->> 'jam_ke_num')::integer,
    (r ->> 'kelas_id')::integer,
    (r ->> 'mapel_id')::integer,
    r ->> 'siswa_id',
    r ->> 'kelas',
    r ->> 'mapel',
    r ->> 'nama_siswa',
    r ->> 'nisn',
    r ->> 'status',
    r ->> 'semester',
    r ->> 'tahun_ajaran',
    r ->> 'guru_email',
    r ->> 'jenjang'
  FROM jsonb_to_recordset(p_rows) AS r (
    tanggal text, jam_ke text, jam_ke_num text, kelas_id text,
    mapel_id text, siswa_id text, kelas text, mapel text,
    nama_siswa text, nisn text, status text, semester text,
    tahun_ajaran text, guru_email text, jenjang text
  );

  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  RETURN v_inserted;
END;
$$;

-- Hanya pengguna login yang boleh memanggil fungsi ini.
REVOKE EXECUTE ON FUNCTION public.simpan_absensi(text, integer, text[], integer, date, text, text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.simpan_absensi(text, integer, text[], integer, date, text, text, text, jsonb) TO authenticated;

-- Verifikasi: harus mengembalikan 1 baris.
-- SELECT proname, pg_get_function_arguments(oid) FROM pg_proc WHERE proname = 'simpan_absensi';
