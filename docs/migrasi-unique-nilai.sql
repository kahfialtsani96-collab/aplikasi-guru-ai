-- =============================================================================
-- MIGRASI: CEGAH DUPLIKAT NILAI + BUAT UNIQUE INDEX
-- Tabel: nilai
--
-- MASALAH:
--   Simpan nilai di app/nilai/page.tsx dan app/smk/nilai/page.tsx memakai
--   upsert(..., { onConflict: 'siswa_id,mapel_id,semester,tahun_ajaran' }).
--   Upsert itu HANYA bekerja bila ada unique index atas 4 kolom tersebut.
--   Selama ini index itu tidak ada, jadi upsert selalu gagal, lalu kode
--   jatuh ke insert biasa dan tetap menampilkan "berhasil disimpan" —
--   sehingga tercipta baris ganda untuk siswa + mapel + semester +
--   tahun ajaran yang sama. Akibatnya Leger membaca baris TERAKHIR
--   (app/laporan/page.tsx) sementara Rapor membaca baris PERTAMA
--   (app/utils/raporBuilder.ts), dan keduanya bisa menampilkan nilai
--   yang berbeda untuk siswa yang sama.
--
-- PERBAIKAN KODE (sudah dilakukan di PR ini):
--   Fallback insert di kedua halaman nilai sudah dihapus. Kalau upsert
--   gagal, aplikasi sekarang menampilkan pesan gagal, bukan "berhasil".
--   Tapi itu saja belum cukup: tanpa unique index, upsert akan SELALU
--   gagal. Jadi migrasi ini WAJIB dijalankan, kalau tidak simpan nilai
--   akan selalu gagal setelah PR ini di-merge.
--
-- CARA JALANKAN:
--   1) Cadangkan dulu tabel nilai (Supabase Dashboard > Table Editor >
--      nilai > ... > Export, atau pg_dump).
--   2) Jalankan file ini di Supabase Dashboard > SQL Editor, sebagai
--      pemilik database / service role. JANGAN lewat anon key dan jangan
--      lewat aplikasi — anon key tidak bisa menjalankan DDL.
--   3) Skrip ini memakai transaksi; jika ada error, otomatis ROLLBACK.
--   4) Setelah jalan, cek hasil query verifikasi di bagian akhir file:
--      jumlah grup duplikat harus 0 dan index harus muncul di daftar.
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 0) CEK DULU: berapa grup duplikat yang ada saat ini.
--    (Hanya tampil di output SQL Editor; tidak mengubah data.)
-- ---------------------------------------------------------------------------
-- SELECT siswa_id, mapel_id, semester, tahun_ajaran, COUNT(*) AS jumlah
--   FROM public.nilai
--   GROUP BY siswa_id, mapel_id, semester, tahun_ajaran
--   HAVING COUNT(*) > 1
--   ORDER BY jumlah DESC;

-- ---------------------------------------------------------------------------
-- 1) HAPUS DUPLIKAT NILAI (pertahankan baris terbaru per grup)
--    Satu grup = satu siswa + satu mapel + satu semester + satu tahun ajaran.
--    Baris yang dipertahankan adalah yang created_at-nya paling baru
--    (id terbesar bila created_at sama) — karena input terbaru biasanya
--    adalah koreksi atas input sebelumnya.
-- ---------------------------------------------------------------------------
DELETE FROM public.nilai
WHERE id IN (
  SELECT id
  FROM (
    SELECT
      id,
      ROW_NUMBER() OVER (
        PARTITION BY siswa_id, mapel_id, semester, tahun_ajaran
        ORDER BY created_at DESC NULLS LAST, id DESC
      ) AS rn
    FROM public.nilai
  ) d
  WHERE d.rn > 1
);

-- ---------------------------------------------------------------------------
-- 2) BUAT UNIQUE INDEX — inilah yang membuat upsert(onConflict=...) bekerja.
--    Setelah index ini ada, satu siswa hanya bisa punya SATU baris nilai
--    per mapel per semester per tahun ajaran. Upsert akan memperbarui
--    baris yang sudah ada, bukan menambah baris baru.
-- ---------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS idx_nilai_unique_siswa_mapel_periode
  ON public.nilai (siswa_id, mapel_id, semester, tahun_ajaran);

COMMIT;

-- ---------------------------------------------------------------------------
-- VERIFIKASI (jalankan setelah migrasi, di luar transaksi):
--   1) Grup duplikat harus 0 baris:
--      SELECT siswa_id, mapel_id, semester, tahun_ajaran, COUNT(*)
--        FROM public.nilai
--        GROUP BY siswa_id, mapel_id, semester, tahun_ajaran
--        HAVING COUNT(*) > 1;
--   2) Index harus ada:
--      SELECT indexname FROM pg_indexes
--        WHERE tablename = 'nilai'
--          AND indexname = 'idx_nilai_unique_siswa_mapel_periode';
--   3) Uji simpan nilai dari aplikasi (SMP dan SMK): simpan nilai yang
--      sama dua kali untuk siswa yang sama — baris di tabel nilai harus
--      tetap 1, dan nilainya adalah yang terakhir disimpan.
-- ---------------------------------------------------------------------------
