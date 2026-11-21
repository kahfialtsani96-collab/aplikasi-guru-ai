-- ============================================================================
-- MIGRASI: BACKFILL JURNAL OKTOBER 2026 DARI JADWAL
-- Aplikasi Guru AI — SMP & SMK Muna Mustofa
-- ----------------------------------------------------------------------------
-- Tujuan: Mengisi jurnal_agenda bulan Oktober 2026 agar semua guru tampil
--         KBM sesuai jadwal (termasuk Sabtu & Minggu), sehingga perhitungan
--         honorarium (JP & transport) periode Oktober dapat dihitung.
-- Sumber : tabel `jadwal` (SMP + SMK) di-mirror ke tiap tanggal Oktober yang
--          nama hari-nya cocok.
-- Perkiraan hasil: 872 baris (SMP 522, SMK 350).
-- Cara pakai: Jalankan di SQL Editor Supabase Dashboard (semua blok).
-- Catatan  : Data ini bersifat sintetis (status 'Terlaksana' sesuai jadwal).
--            Setelah migrasi, buka Honorarium > periode Oktober > "Hitung
--            Otomatis" agar rekap terisi.
-- ============================================================================

-- 1) (Opsional, idempoten) Hapus jurnal Oktober bila pernah ada
-- ============================================================================
DELETE FROM public.jurnal_agenda
WHERE tanggal >= '2026-10-01' AND tanggal <= '2026-10-31';

-- 2) Generasi jurnal Oktober dari jadwal (semua hari, termasuk Sabtu & Minggu)
-- ============================================================================
INSERT INTO public.jurnal_agenda
  (tanggal, jam_ke, kelas, mapel, materi, status, absen_siswa, keterangan,
   guru_email, mapel_id, kelas_id, semester, tahun_ajaran, jenjang, jam_ke_num)
SELECT
  to_char(d.day, 'YYYY-MM-DD')               AS tanggal,
  jd.jam                                     AS jam_ke,
  jd.kelas,
  jd.mapel,
  ''                                         AS materi,
  'Terlaksana'                               AS status,
  NULL                                       AS absen_siswa,
  ''                                         AS keterangan,
  jd.guru_email,
  jd.mapel_id,
  jd.kelas_id,
  'Ganjil'                                   AS semester,
  '2026/2027'                                AS tahun_ajaran,
  jd.jenjang,
  COALESCE(((regexp_match(jd.jam_ke, '[0-9]+'))[1])::int, 1) AS jam_ke_num
FROM public.jadwal jd
CROSS JOIN LATERAL (
  SELECT gs::date AS day
  FROM generate_series(date '2026-10-01', date '2026-10-31', interval '1 day') AS gs
) d
WHERE CASE extract(dow FROM d.day)
        WHEN 0 THEN 'Minggu'
        WHEN 1 THEN 'Senin'
        WHEN 2 THEN 'Selasa'
        WHEN 3 THEN 'Rabu'
        WHEN 4 THEN 'Kamis'
        WHEN 5 THEN 'Jumat'
        WHEN 6 THEN 'Sabtu'
      END = jd.hari;

-- 3) Verifikasi: jumlah baris Oktober per jenjang
-- ============================================================================
SELECT jenjang, count(*) AS jml_baris
FROM public.jurnal_agenda
WHERE tanggal >= '2026-10-01' AND tanggal <= '2026-10-31'
GROUP BY 1
ORDER BY 1;
