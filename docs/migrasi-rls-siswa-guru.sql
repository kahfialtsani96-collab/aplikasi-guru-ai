-- =============================================================================
-- MIGRASI: BATASI BACA TABEL siswa & guru HANYA UNTUK PENGGUNA LOGIN
-- Tabel: siswa, guru
--
-- MASALAH:
--   Kunci anon (publishable) aplikasi saat ini bisa membaca tabel siswa
--   (NISN, nama_lengkap, jenis_kelamin, kelas_id) dan tabel guru
--   (no_hp, email, NUPTK, jabatan) tanpa login sama sekali. Siapa pun
--   yang punya anon key — kunci itu ada di bundle JavaScript aplikasi —
--   bisa mengambil data pribadi siswa dan guru. Sementara tabel absensi,
--   nilai, jadwal, jurnal_agenda, bimbingan_wali, dan honorarium sudah
--   tertutup untuk anon, jadi kebijakannya tidak konsisten antar tabel.
--
-- PERBAIKAN:
--   Hapus SEMUA policy SELECT yang sekarang berlaku untuk peran anon di
--   kedua tabel (apa pun namanya), lalu buat policy SELECT yang hanya
--   berlaku untuk peran authenticated (pengguna yang sudah login).
--   Pola yang sama sudah dipakai tabel honorarium di
--   docs/migrasi-rpc-otorisasi-honor.sql:
--     FOR SELECT TO authenticated USING (true)
--
-- YANG SUDAH DIPERIKSA SEBELUM MIGRASI INI DIBUAT:
--   - Halaman login (app/login/page.tsx) TIDAK membaca tabel siswa/guru
--     langsung, jadi login tetap jalan setelah migrasi ini.
--   - Semua halaman yang membaca siswa/guru (absensi, nilai, jadwal,
--     jurnal, bimbingan, laporan, kartu, honorarium, master, dsb.)
--     dipakai setelah login sebagai operator/guru, jadi mereka membaca
--     sebagai authenticated dan tidak terpengaruh.
--   - Pendaftaran akun guru baru (app/guru/page.tsx) memakai Supabase
--     Auth signUp, bukan baca tabel, jadi tidak terpengaruh.
--
-- CARA JALANKAN:
--   1) Jalankan file ini di Supabase Dashboard > SQL Editor, sebagai
--      pemilik database / service role. JANGAN lewat anon key — anon key
--      tidak bisa mengubah policy.
--   2) Skrip ini memakai transaksi; jika ada error, otomatis ROLLBACK.
--   3) Setelah jalan, jalankan query verifikasi di bagian akhir file.
--   4) Uji dari aplikasi TANPA login: buka halaman yang membaca siswa/
--      guru seharusnya mengarah ke login, bukan menampilkan data.
--      Lalu login sebagai operator dan pastikan semua halaman tetap
--      menampilkan data seperti biasa.
--
-- JIKA ADA ALUR PUBLIK YANG TERNYATA BUTUH BACA ANON:
--   Jangan kembalikan policy lama untuk seluruh tabel. Buat policy
--   SELECT yang sempit (misalnya hanya kolom tertentu, atau hanya
--   baris tertentu) untuk alur itu saja, dan catat di .clinerules.
--   Query untuk mengembalikan keadaan semula ada di bagian akhir file.
-- =============================================================================

BEGIN;

-- Pastikan RLS menyala di kedua tabel (tidak berpengaruh bila sudah menyala).
ALTER TABLE public.siswa ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guru ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- 1) HAPUS SEMUA POLICY SELECT YANG BERLAKU UNTUK ANON DI KEDUA TABEL.
--    Nama policy-nya tidak ditebak: blok ini menghapus policy SELECT
--    apa pun namanya di public.siswa dan public.guru.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('siswa', 'guru')
      AND cmd = 'SELECT'
  LOOP
    EXECUTE format('DROP POLICY %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 2) BUAT POLICY SELECT HANYA UNTUK PENGGUNA LOGIN (authenticated).
--    Peran anon tidak lagi mendapat baris apa pun dari kedua tabel ini.
-- ---------------------------------------------------------------------------
CREATE POLICY siswa_select_authenticated
  ON public.siswa
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY guru_select_authenticated
  ON public.guru
  FOR SELECT TO authenticated
  USING (true);

COMMIT;

-- ---------------------------------------------------------------------------
-- VERIFIKASI (jalankan setelah migrasi, di luar transaksi):
--   1) Policy yang tersisa harus hanya yang authenticated:
--      SELECT tablename, policyname, cmd, roles
--        FROM pg_policies
--        WHERE schemaname = 'public'
--          AND tablename IN ('siswa', 'guru')
--        ORDER BY tablename, cmd;
--      Kolom roles harus berisi {authenticated} dan TIDAK berisi anon.
--   2) Uji tanpa login (misalnya curl dengan anon key saja):
--      curl -s "https://<ref>.supabase.co/rest/v1/siswa?select=id&limit=1" \
--        -H "apikey: <anon key>"
--      Harus mengembalikan [] (kosong), bukan baris data.
--      Uji yang sama untuk /rest/v1/guru.
--   3) Uji setelah login sebagai operator: halaman siswa, guru, absensi,
--      nilai, dan kartu tetap menampilkan data seperti biasa.
--
-- MENGEMBALIKAN KEADAAN SEMULA (hanya bila darurat, dan sadar risikonya:
-- data pribadi kembali bisa dibaca tanpa login):
--   DROP POLICY IF EXISTS siswa_select_authenticated ON public.siswa;
--   DROP POLICY IF EXISTS guru_select_authenticated ON public.guru;
--   CREATE POLICY siswa_select_all ON public.siswa
--     FOR SELECT USING (true);
--   CREATE POLICY guru_select_all ON public.guru
--     FOR SELECT USING (true);
-- ---------------------------------------------------------------------------
