import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { tool, activeTool, selectedDoc, mapel, faseKelas, materiTopik, spesifikData, ...kbcData } = body

    // API Key Inception Labs Mercury AI
    const apiKey = process.env.INCEPTION_API_KEY || 'sk_4d03f2b6eeb34ad7c94fea973d1d312c'

    if (!apiKey) {
      return NextResponse.json(
        { error: 'API Key Mercury tidak terkonfigurasi di backend' },
        { status: 400 }
      )
    }

    const systemPrompt = `Anda adalah Asisten Guru AI dan Pakar Pedagogi Kurikulum Merdeka & KBC Kemenag RI yang cerdas, terstruktur, mendalam, dan profesional.`

    // Penanganan Koreksi Fase & Satuan Pendidikan Otomatis
    const namaSekolahResmi = kbcData.satuanPendidikan || 'SMP MUNA MUSTOFA'
    const namaGuruResmi = kbcData.namaGuru || 'Muzaini Al Kahfi'
    const nipGuruResmi = kbcData.nipGuru || '-'
    const namaKepalaResmi = kbcData.namaKepala || 'SULASTRI, S.Pd., Gr.'
    const nipKepalaResmi = kbcData.nipKepala || 'NUPTK. 6337763664131233'
    const kotaTtdResmi = kbcData.kotaTtd || 'Gisting'

    let detailInstruksi = ''

    // Logika Pemilihan Prompt Khusus Berdasarkan Tool yang Dipakai
    switch (activeTool) {
      case 'kbc':
        detailInstruksi = `Buatlah dokumen [${selectedDoc?.toUpperCase()}] untuk Perangkat Ajar Kurikulum Berbasis Cinta (KBC). Satuan Pendidikan: ${namaSekolahResmi}, Mapel: ${mapel}, Fase/Kelas: ${faseKelas}. Data administrasi: ${JSON.stringify(kbcData)}. Pastikan formatnya terstruktur, tidak ada kata 'Sekolah/Madrasah' tapi gunakan '${namaSekolahResmi}'.`
        break
      case 'perangkat':
        detailInstruksi = `Buat dokumen ${spesifikData?.jenisPerangkat}. Satuan Pendidikan: ${namaSekolahResmi}, Mapel: ${mapel}, Fase/Kelas: ${faseKelas}. Materi Pokok: ${materiTopik}.`
        break
      case 'deep-learning':
        detailInstruksi = `Susun skenario Modul Ajar LENGKAP SIAP AKREDITASI (semua pertemuan dari Pendahuluan, Inti, hingga Penutup) dengan pendekatan Deep Learning. 
Satuan Pendidikan: ${namaSekolahResmi}
Mata Pelajaran: ${mapel}
Fase & Kelas: ${faseKelas} (Pastikan penulisan Fase sesuai standar: Kelas 7/8/9 = Fase D, Kelas 10 = Fase E)
Fokus Pilar: ${spesifikData?.dlPilar}, Alokasi Waktu: ${spesifikData?.dlAlokasi}, Strategi: ${spesifikData?.dlStrategi}. 
Materi Topik: ${materiTopik}. 

PERSYARATAN WAJIB AKREDITASI:
1. Cantumkan LAMPIRAN RUBRIK PENILAIAN & INSTRUMEN ASESMEN lengkap (Rubrik Sikap, Rubrik Diskusi/Praktikum, dan Soal Evaluasi/Kunci Jawaban).
2. Tuliskan skenario secara tuntas tanpa terpotong di tengah kalimat.`
        break
      case 'kokurikuler':
        detailInstruksi = `Rancang Modul Projek Kokurikuler P5/PPRA. Satuan Pendidikan: ${namaSekolahResmi}. Tema Utama: ${spesifikData?.kokuTema}, Dimensi Profil: ${spesifikData?.kokuDimensi}. Topik Projek: ${materiTopik}. Sertakan Alur Aktivitas, Rubrik Penilaian, dan Lembar Asesmen.`
        break
      case 'lkpd':
        detailInstruksi = `Buat Lembar Kerja Peserta Didik (LKPD). Satuan Pendidikan: ${namaSekolahResmi}. Jenis Aktivitas: ${spesifikData?.lkpdAktivitas}. Materi: ${materiTopik}. ${spesifikData?.lkpdHots ? 'Terapkan soal HOTS dan konteks kearifan lokal.' : ''}`
        break
      case 'soal':
        detailInstruksi = `Buat Paket Naskah Ujian. Satuan Pendidikan: ${namaSekolahResmi}. Jumlah Soal: ${spesifikData?.soalJumlah}, Bentuk: ${spesifikData?.soalTipe}, Tingkat Kesulitan: ${spesifikData?.soalLevel}. Topik: ${materiTopik}. ${spesifikData?.soalKunci ? 'Sertakan Kunci Jawaban, Pedoman Penskoran, & Kisi-Kisi di bagian bawah.' : ''}`
        break
      case 'multi':
        detailInstruksi = `Bantu saya membuat: ${spesifikData?.multiSubTool}. Satuan Pendidikan: ${namaSekolahResmi}. Catatan/Konteks: ${materiTopik}.`
        break
      case 'chatbot':
      default:
        detailInstruksi = `Pertanyaan / Diskusi: ${materiTopik}`
        break
    }

    // LEMBAR PENGESAHAN KIRI-KANAN DENGAN TABEL HTML KELAS TTD-TABLE
    const lembarPengesahanHTML = `\n\n
### VI. LEMBAR PENGESAHAN MODUL AJAR
Diverifikasi dan disahkan untuk digunakan dalam kegiatan pembelajaran Kurikulum Merdeka di **${namaSekolahResmi}**.

<table class="ttd-table" style="width: 100%; border: none; margin-top: 30px; font-family: 'Times New Roman', serif;">
  <tr style="border: none;">
    <td style="width: 50%; text-align: left; border: none; vertical-align: top;">
      Mengetahui,<br/>
      <strong>Kepala Sekolah ${namaSekolahResmi}</strong>
      <br/><br/><br/><br/><br/>
      <strong><u>${namaKepalaResmi}</u></strong><br/>
      NIP/NUPTK: ${nipKepalaResmi}
    </td>
    <td style="width: 50%; text-align: left; border: none; vertical-align: top;">
      ${kotaTtdResmi}, 2026<br/>
      <strong>Guru Pengampu Mata Pelajaran</strong>
      <br/><br/><br/><br/><br/>
      <strong><u>${namaGuruResmi}</u></strong><br/>
      NIP/NUPTK: ${nipGuruResmi}
    </td>
  </tr>
</table>
`

    const copyrightFooter = `\n\n---\n*Dokumen ini dibuat secara otomatis menggunakan Aplikasi Guru AI — Created & Developed by **Muzaini Al Kahfi***`

    const userPrompt = `Tugas Utama Anda: Susunlah materi/dokumen/jawaban pedagogi guru secara LENGKAP, MENDALAM, UTUH, dan TERSTRUKTUR sesuai parameter berikut:
- Modul/Tool AI: ${tool || 'Asisten Chatbot Pedagogy AI'}
- Satuan Pendidikan: ${namaSekolahResmi} (DILARANG menggunakan tulisan 'Sekolah/Madrasah', wajib sebutkan '${namaSekolahResmi}')
- Mata Pelajaran: ${mapel || '-'}
- Fase/Kelas: ${faseKelas || '-'}
- Instruksi Spesifik: ${detailInstruksi}

Instruksi Penting Format & Akreditasi:
1. Susun balasan secara sangat mendalam, akurat, praktis, dan langsung siap pakai untuk akreditasi sekolah.
2. Gunakan format Markdown yang rapi (bold, penomoran, tabel, dan poin-poin).
3. Pastikan penulisan FASE & KELAS konsisten (Contoh: Kelas VII/VIII/IX = Fase D, Kelas X = Fase E).
4. DILARANG KERAS memotong dokumen di tengah jalan! Tuliskan semua bab, skenario pertemuan, hingga Lampiran Rubrik Asesmen sampai tuntas.
5. Pada bagian paling bawah dokumen (sebelum copyright), sertakan Lembar Pengesahan berikut:
${lembarPengesahanHTML}
6. Tambahkan copyright di baris paling akhir:
${copyrightFooter}`

    // Panggil Endpoint Resmi Inception Labs Mercury AI
    const response = await fetch('https://api.inceptionlabs.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'mercury-2.5',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_tokens: 8192,
        temperature: 0.7
      })
    })

    const rawText = await response.text()

    let data
    try {
      data = JSON.parse(rawText)
    } catch {
      return NextResponse.json(
        { error: `Inception Labs merespons non-JSON: ${rawText.substring(0, 150)}` },
        { status: 500 }
      )
    }

    if (!response.ok) {
      return NextResponse.json(
        { error: data.error?.message || data.message || 'Gagal memproses permintaan ke Mercury AI' },
        { status: response.status }
      )
    }

    const aiAnswer = data.choices?.[0]?.message?.content || 'Tidak ada respons yang dihasilkan oleh Mercury AI.'

    return NextResponse.json({ result: aiAnswer })
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Terjadi kesalahan internal pada backend route' },
      { status: 500 }
    )
  }
}