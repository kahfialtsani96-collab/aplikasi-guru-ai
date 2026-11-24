/**
 * Kontrol akses kelola jadwal (SMP & SMK).
 *
 * Secara default hanya operator yang boleh membuat/mengubah/menghapus jadwal.
 * Namun beberapa guru (mis. wali kelas) perlu diberi hak yang sama di halaman
 * jadwal SMP dan SMK tanpa harus mengubah role DB-nya menjadi operator.
 *
 * Tambahkan email guru terkait ke `JADWAL_MANAGER_EMAILS` agar guru tsb.
 * mendapat akses kelola jadwal di kedua portal.
 */

export const JADWAL_MANAGER_EMAILS: string[] = [
  'triratno29@gmail.com', // TRI RATNO — Wali Kelas VII A (SMP & SMK)
]

/** Cek apakah sebuah email termasuk daftar manajer jadwal. */
export function isJadwalManager(email?: string | null): boolean {
  const e = (email || '').trim().toLowerCase()
  return e.length > 0 && JADWAL_MANAGER_EMAILS.includes(e)
}

/** Cek apakah user boleh kelola jadwal: operator ATAU manajer. */
export function canManageJadwal(isOperator: boolean, email?: string | null): boolean {
  return isOperator || isJadwalManager(email)
}
