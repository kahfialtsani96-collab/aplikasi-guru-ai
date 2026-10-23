import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import InactivityHandler from './components/InactivityHandler'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'APLIKASI GURU AI | SMP Muna Mustofa',
  description: 'Sistem Informasi Administrasi Guru SMP Muna Mustofa',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="id" className="dark">
      <body className={`${inter.className} bg-[#0b0f19] text-slate-100 antialiased`}>
        {/* Handler Logout Otomatis 1 Jam */}
        <InactivityHandler />

        {/* Konten utama halaman */}
        {children}
      </body>
    </html>
  )
}