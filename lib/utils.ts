/**
 * Helper pengurut & utilitas kelas.
 * Dipakai untuk mengurutkan tingkat kelas secara benar:
 *   - SMP : VII → VIII → IX (7 → 8 → 9)
 *   - SMK : X  → XI  → XII (10 → 11 → 12)
 */

export interface SortableKelas {
  nama?: string
  nama_kelas?: string
}

/**
 * Menentukan bobot/grade tingkatan kelas (7–12) dari nama kelas
 * (angka Arab maupun Romawi) atau dari kolom `tingkat`.
 * Mengembalikan 99 bila tidak dikenali (diletakkan di bagian akhir).
 */
export function getKelasGradeWeight(
  namaKelas: string,
  tingkatDb?: string | null
): number {
  const t = String(tingkatDb || '').trim()
  if (['7', '8', '9', '10', '11', '12'].includes(t)) return Number(t)

  const upper = (namaKelas || '').trim().toUpperCase()
  if (/^(XII|12)\b/.test(upper)) return 12
  if (/^(XI|11)\b/.test(upper)) return 11
  if (/^(X|10)\b/.test(upper)) return 10
  if (/^(IX|9)\b/.test(upper)) return 9
  if (/^(VIII|8)\b/.test(upper)) return 8
  if (/^(VII|7)\b/.test(upper)) return 7
  return 99
}

/** Membandingkan dua nama kelas: tingkat dahulu (VII→XII), lalu alfabetis. */
export function compareKelasName(a: string, b: string): number {
  const wa = getKelasGradeWeight(a)
  const wb = getKelasGradeWeight(b)
  if (wa !== wb) return wa - wb
  return a.localeCompare(b, 'id', { numeric: true })
}

/**
 * Mengurutkan array item kelas (objek berproperti `nama` atau `nama_kelas`)
 * dari VII→IX (SMP) lalu X→XII (SMK).
 * Mengembalikan array baru tanpa memutasi input.
 */
export function sortKelas<T extends object>(list: T[]): T[] {
  const nameOf = (item: T) =>
    String(
      (item as SortableKelas).nama ?? (item as SortableKelas).nama_kelas ?? ''
    )
  return [...list].sort((a, b) => compareKelasName(nameOf(a), nameOf(b)))
}
