import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { tool, activeTool, selectedDoc, mapel, faseKelas, materiTopik, spesifikData, ...kbcData } = body

    // API Key Inception Labs Mercury AI milik Anda
    const apiKey = process.env.INCEPTION_API_KEY || 'sk_4d03f2b6eeb34ad7c94fea973d1d312c'

    if (!apiKey) {
      return NextResponse.json(
        { error: 'API Key Mercury tidak terkonfigurasi di backend' },
        { status: 400 }
      )
    }

    const systemPrompt = `Anda adalah Asisten Guru AI dan Pakar Pedagogi Kurikulum Merdeka & KBC Kemenag RI yang cerdas, terstruktur, mendalam, dan profesional.`

    let detailInstruksi = ''

    // Logika Pemilihan Prompt Khusus Berdasarkan Tool yang Dipakai
    switch (activeTool) {
      case 'kbc':
        detailInstruksi = `Buatlah dokumen [${selectedDoc?.toUpperCase()}] untuk Perangkat Ajar Kurikulum Berbasis Cinta (KBC). Data administrasi: ${JSON.stringify(kbcData)}. Pastikan formatnya sangat terstruktur dan siap pakai.`
        break
      case 'perangkat':
        detailInstruksi = `Buat dokumen ${spesifikData?.jenisPerangkat}. Materi Pokok: ${materiTopik}.`
        break
      case 'deep-learning':
        detailInstruksi = `Susun skenario Modul Ajar dengan pendekatan Deep Learning. Fokus Pilar: ${spesifikData?.dlPilar}, Alokasi Waktu: ${spesifikData?.dlAlokasi}, Strategi: ${spesifikData?.dlStrategi}. Materi Topik: ${materiTopik}.`
        break
      case 'kokurikuler':
        detailInstruksi = `Rancang Modul Projek Kokurikuler P5/PPRA. Tema Utama: ${spesifikData?.kokuTema}, Dimensi Profil: ${spesifikData?.kokuDimensi}. Topik Projek: ${materiTopik}. Sertakan Alur Aktivitas dan Rubrik.`
        break
      case 'lkpd':
        detailInstruksi = `Buat Lembar Kerja Peserta Didik (LKPD). Jenis Aktivitas: ${spesifikData?.lkpdAktivitas}. Materi: ${materiTopik}. ${spesifikData?.lkpdHots ? 'Terapkan soal HOTS dan konteks kearifan lokal.' : ''}`
        break
      case 'soal':
        detailInstruksi = `Buat Paket Naskah Ujian. Jumlah Soal: ${spesifikData?.soalJumlah}, Bentuk: ${spesifikData?.soalTipe}, Tingkat Kesulitan: ${spesifikData?.soalLevel}. Topik: ${materiTopik}. ${spesifikData?.soalKunci ? 'Sertakan Kunci Jawaban & Kisi-Kisi di bagian bawah.' : ''}`
        break
      case 'multi':
        detailInstruksi = `Bantu saya membuat: ${spesifikData?.multiSubTool}. Catatan/Konteks: ${materiTopik}.`
        break
      case 'chatbot':
      default:
        detailInstruksi = `Pertanyaan / Diskusi: ${materiTopik}`
        break
    }

    const copyrightFooter = `\n\n---\n*Dokumen ini dibuat secara otomatis menggunakan Aplikasi Guru AI — Created & Developed by **Muzaini Al Kahfi***`

    const userPrompt = `Tugas Utama Anda: Susunlah materi/dokumen/jawaban pedagogi guru secara lengkap dan terstruktur sesuai parameter berikut:
- Modul/Tool AI: ${tool || 'Asisten Chatbot Pedagogy AI'}
- Mata Pelajaran: ${mapel || '-'}
- Fase/Kelas: ${faseKelas || '-'}
- Instruksi Spesifik: ${detailInstruksi}

Instruksi Output:
Mohon susun balasan secara sangat mendalam, akurat, praktis, dan langsung siap pakai untuk guru. Gunakan format Markdown yang rapi (gunakan bold, penomoran, dan poin-poin).

PENTING: Anda WAJIB menambahkan teks berikut persis di baris paling akhir dari output yang Anda hasilkan, tanpa terkecuali:${copyrightFooter}`

    // Panggil Endpoint Resmi Inception Labs Mercury AI (Model: mercury-2.5)
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
        max_tokens: 4096
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