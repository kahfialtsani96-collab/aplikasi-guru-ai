-- =============================================================================
-- MIGRASI PEMBERSIHAN & REDESIGN DATA
-- Tabel: jadwal, absensi, jurnal_agenda
--
-- CARA JALANKAN:
--   1) Back up dulu:  pg_dump --table=jadwal ...  (atau snapshot manual)
--   2) Jalankan lewat Supabase SQL Editor ATAU psql (BUKAN koneksi read-only).
--   3) Skrip ini memakai transaksi; jika ada error, otomatis ROLLBACK.
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1) HAPUS DUPLIKAT JADWAL (pertahankan id terkecil)
--    Terkonfirmasi 1 grup duplikat: id 47 & 48 (Rabu, kelas 10, mapel 7,
--    jam_ke=1, guru iqohiqoh736@gmail.com). Baris id 48 akan terhapus.
-- ---------------------------------------------------------------------------
DELETE FROM jadwal a
USING jadwal b
WHERE a.id > b.id
  AND a.hari = b.hari
  AND COALESCE(a.kelas_id,0) = COALESCE(b.kelas_id,0)
  AND COALESCE(a.mapel_id,0) = COALESCE(b.mapel_id,0)
  AND COALESCE(a.jam_ke,'') = COALESCE(b.jam_ke,'')
  AND COALESCE(a.guru_email,'') = COALESCE(b.guru_email,'');

-- ---------------------------------------------------------------------------
-- 2) BACKFILL STATUS JURNAL NULL -> 'Terlaksana'
--    (58 baris lama ber-status NULL; via ini dianggap terlaksana)
-- ---------------------------------------------------------------------------
UPDATE jurnal_agenda SET status = 'Terlaksana' WHERE status IS NULL;

-- ---------------------------------------------------------------------------
-- 3) BACKFILL MAPEL_ID JURNAL id 64 (MATEMATIKA -> mapel id 4)
-- ---------------------------------------------------------------------------
UPDATE jurnal_agenda ja
SET mapel_id = m.id,
    mapel = m.nama_mapel
FROM mapel m
WHERE ja.id = 64
  AND ja.mapel_id IS NULL
  AND LOWER(m.nama_mapel) = LOWER(ja.mapel);

-- ---------------------------------------------------------------------------
-- 4) REDESIGN FORMAT JAM TERPADU (jangka panjang, opsional)
--     Tambah kolom numerik jam_ke_num agar konsisten dengan jadwal.jam_ke
--     (angka). Diisi dari teks yang sudah ada; baris NULL dibiarkan NULL
--     (tidak menebak jam yang tidak diketahui).
-- ---------------------------------------------------------------------------
ALTER TABLE absensi ADD COLUMN IF NOT EXISTS jam_ke_num integer;
ALTER TABLE jurnal_agenda ADD COLUMN IF NOT EXISTS jam_ke_num integer;

UPDATE absensi SET jam_ke_num =
  CASE
    WHEN jam_ke ~ 'Jam\s*Ke-\s*(\d+)'
      THEN (REGEXP_MATCH(jam_ke, 'Jam\s*Ke-\s*(\d+)'))[1]::int
    ELSE NULL
  END
WHERE jam_ke_num IS NULL AND jam_ke IS NOT NULL;

UPDATE jurnal_agenda SET jam_ke_num =
  CASE
    WHEN jam_ke ~ 'Jam\s*Ke-\s*(\d+)'
      THEN (REGEXP_MATCH(jam_ke, 'Jam\s*Ke-\s*(\d+)'))[1]::int
    WHEN jam_ke ~ '^\d+$' THEN jam_ke::int
    ELSE NULL
  END
WHERE jam_ke_num IS NULL AND jam_ke IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 5) CONSTRAINT UNIK (cegah duplikat ke depan)
--     Pastikan tidak ada duplikat tersisa (langkah 1 sudah membersihkan)
--     sebelum menambah index unik ini.
-- ---------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS uq_jadwal_hari_kelas_mapel_jam_guru
  ON jadwal (hari, kelas_id, mapel_id, jam_ke, guru_email);

COMMIT;

-- =============================================================================
-- VERIFIKASI SETELAH MIGRASI (jalankan terpisah, baca saja):
--
--   -- Duplikat jadwal harus 0 baris
--   SELECT hari, kelas_id, mapel_id, jam_ke, guru_email, count(*) n
--   FROM jadwal GROUP BY 1,2,3,4,5 HAVING count(*) > 1;
--
--   -- Status NULL jurnal harus 0
--   SELECT count(*) FROM jurnal_agenda WHERE status IS NULL;
--
--   -- Jurnal tanpa mapel_id harus hanya baris gabungan yang memang sengaja NULL
--   SELECT id, kelas, mapel, mapel_id FROM jurnal_agenda WHERE mapel_id IS NULL;
--
--   -- Isi kolom baru
--   SELECT count(*) FROM absensi WHERE jam_ke_num IS NULL AND jam_ke IS NOT NULL;
--   SELECT count(*) FROM jurnal_agenda WHERE jam_ke_num IS NULL AND jam_ke IS NOT NULL;
-- =============================================================================
