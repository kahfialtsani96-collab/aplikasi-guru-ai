import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { tool, activeTool, selectedDoc, mapel, faseKelas, materiTopik, spesifikData, ...kbcData } = body

    // Membaca API Key dari .env.local
    const apiKey = process.env.MERCURY_API_KEY

    if (!apiKey) {
      return NextResponse.json(
        { error: 'API Key Mercury tidak terkonfigurasi di backend (.env.local)' },
        { status: 400 }
      )
    }

    // Pembersihan input
    const sanitize = (str: any) => (typeof str === 'string' && str.trim() !== '' ? str.trim() : null)

    const namaSekolahResmi = sanitize(kbcData.satuanPendidikan) || 'SMP MUNA MUSTOFA'
    const namaGuruResmi = sanitize(kbcData.namaGuru) || 'Muzaini Al Kahfi'
    const nipGuruResmi = sanitize(kbcData.nipGuru) || '-'
    const namaKepalaResmi = sanitize(kbcData.namaKepala) || 'SULASTRI, S.Pd., Gr.'
    const nipKepalaResmi = sanitize(kbcData.nipKepala) || '6337763664131233'
    const kotaTtdResmi = sanitize(kbcData.kotaTtd) || 'Gisting'

    // Helper Pembersih Teks NUPTK agar tidak tercetak ganda
    const formatNuptk = (val: string) => {
      if (!val || val === '-' || val.trim() === '') return 'NUPTK: -'
      const cleanNumber = val.replace(/^(NIP\/NUPTK|NUPTK|NIP)\.?:?\s*/i, '').trim()
      return `NUPTK: ${cleanNumber}`
    }

    let systemPrompt = ''
    let userPrompt = ''

    // 1. LOGIKA CHATBOT VS GENERATOR DOKUMEN RESMI
    if (activeTool === 'chatbot') {
      systemPrompt = `Anda adalah Asisten Guru AI dan Konsultan Pedagogi Kurikulum Merdeka & KBC Kemenag RI yang ramah, komunikatif, solutif, dan praktis.`

      userPrompt = `Pertanyaan / Diskusi Guru:
${materiTopik}

(Konteks Pembelajaran: Satuan Pendidikan: ${namaSekolahResmi}, Mapel: ${mapel || '-'}, Fase/Kelas: ${faseKelas || '-'})

Instruksi Penjawab Chatbot:
1. Jawablah pertanyaan guru secara langsung pada inti masalah, lugas, dan praktis.
2. DILARANG MEMBUAT struktur dokumen formal seperti "1. Identitas Dokumen", "2. Latar Belakang", atau bagian tanda tangan di akhir.
3. Gunakan format Markdown yang rapi (bullet points, bold, dan paragraf singkat) agar mudah dibaca.`

    } else {
      systemPrompt = `Anda adalah Asisten Guru AI dan Pakar Pedagogi Kurikulum Merdeka & KBC Kemenag RI yang cerdas, terstruktur, mendalam, dan profesional.`

      let detailInstruksi = ''

      switch (activeTool) {
        case 'kbc':
          detailInstruksi = `Buatlah dokumen [${selectedDoc?.toUpperCase()}] untuk Perangkat Ajar Kurikulum Berbasis Cinta (KBC). Satuan Pendidikan: ${namaSekolahResmi}, Mapel: ${mapel}, Fase/Kelas: ${faseKelas}. Data: ${JSON.stringify(kbcData)}.`
          break
        case 'perangkat':
          detailInstruksi = `Buat dokumen ${spesifikData?.jenisPerangkat || 'Perangkat Pembelajaran'}. Mapel: ${mapel}, Fase/Kelas: ${faseKelas}. Materi Pokok: ${materiTopik}.`
          break
        case 'deep-learning':
          detailInstruksi = `Susun Modul Ajar LENGKAP SIAP AKREDITASI dengan pendekatan Deep Learning. 
Fokus Pilar: ${spesifikData?.dlPilar}, Alokasi Waktu: ${spesifikData?.dlAlokasi}, Strategi: ${spesifikData?.dlStrategi}. 
Materi Topik: ${materiTopik}. 
WAJIB ikuti struktur berikut secara berurutan:
1. Informasi Umum
2. Kompetensi Inti & Tujuan Pembelajaran
3. Skenario Kegiatan Pembelajaran (Pendahuluan, Inti, Penutup)
4. Lampiran (Rubrik Sikap, Rubrik Diskusi, dan Soal Evaluasi).`
          break
        case 'kokurikuler':
          detailInstruksi = `Rancang Modul Projek Kokurikuler P5/PPRA. Tema Utama: ${spesifikData?.kokuTema}, Dimensi Profil: ${spesifikData?.kokuDimensi}. Topik Projek: ${materiTopik}. Sertakan Alur Aktivitas, Rubrik Penilaian, dan Lembar Asesmen.`
          break
        case 'lkpd':
          detailInstruksi = `Buat Lembar Kerja Peserta Didik (LKPD). Jenis Aktivitas: ${spesifikData?.lkpdAktivitas}. Materi: ${materiTopik}. ${spesifikData?.lkpdHots ? 'Gunakan soal HOTS dan konteks kearifan lokal.' : ''}`
          break
        case 'soal':
          detailInstruksi = `Buat Paket Naskah Ujian. Jumlah Soal: ${spesifikData?.soalJumlah}, Bentuk: ${spesifikData?.soalTipe}, Tingkat Kesulitan: ${spesifikData?.soalLevel}. Topik: ${materiTopik}. ${spesifikData?.soalKunci ? 'Sertakan Kunci Jawaban di akhir.' : ''}`
          break
        case 'multi':
          detailInstruksi = `Bantu saya membuat: ${spesifikData?.multiSubTool}. Catatan/Konteks: ${materiTopik}.`
          break
        default:
          detailInstruksi = `Buat dokumen pedagogi untuk: ${materiTopik}`
          break
      }

      userPrompt = `Tugas Utama Anda: Susunlah dokumen pedagogi guru secara LENGKAP, MENDALAM, dan TERSTRUKTUR.
- Modul/Tool AI: ${tool || 'Generator Perangkat Ajar'}
- Satuan Pendidikan: ${namaSekolahResmi} (DILARANG menggunakan kata 'Sekolah/Madrasah', wajib gunakan nama resmi ini)
- Mata Pelajaran: ${mapel || '-'}
- Fase/Kelas: ${faseKelas || '-'}
- Instruksi Spesifik: ${detailInstruksi}

Instruksi Format WAJIB:
1. Gunakan format Markdown murni (tanpa tag HTML).
2. Tuliskan semua bagian materi hingga tuntas tanpa terpotong.
3. DILARANG KERAS membuat teks tanda tangan, penutup 'Disetujui Oleh', 'Penyusun', atau blok pengesahan di akhir teks, karena Lembar Pengesahan resmi akan diinjeksi secara otomatis oleh sistem.`
    }

    // 2. PEMANGGILAN INCEPTION LABS MERCURY AI
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

    const aiAnswer = data.choices?.[0]?.message?.content || 'Tidak ada respons yang dihasilkan oleh AI.'

    // 3. LEMBAR PENGESAHAN HTML STATIS
    const lembarPengesahanHTML = `\n\n<br><hr><br>
### VI. LEMBAR PENGESAHAN MODUL AJAR
Diverifikasi dan disahkan untuk digunakan dalam kegiatan pembelajaran Kurikulum Merdeka di **${namaSekolahResmi}**.

<table class="ttd-table" style="width: 100%; border: none; margin-top: 30px; font-family: 'Times New Roman', serif;">
  <tr style="border: none;">
    <td style="width: 50%; text-align: left; border: none; vertical-align: top;">
      Mengetahui,<br/>
      <strong>Kepala Sekolah ${namaSekolahResmi}</strong>
      <br/><br/><br/><br/><br/>
      <strong><u>${namaKepalaResmi}</u></strong><br/>
      ${formatNuptk(nipKepalaResmi)}
    </td>
    <td style="width: 50%; text-align: left; border: none; vertical-align: top;">
      ${kotaTtdResmi}, 2026<br/>
      <strong>Guru Pengampu Mata Pelajaran</strong>
      <br/><br/><br/><br/><br/>
      <strong><u>${namaGuruResmi}</u></strong><br/>
      ${formatNuptk(nipGuruResmi)}
    </td>
  </tr>
</table>\n\n---\n*Dokumen ini dibuat secara otomatis menggunakan Aplikasi Guru AI — Created & Developed by **Muzaini Al Kahfi***`

    const finalResult = activeTool !== 'chatbot' ? aiAnswer + lembarPengesahanHTML : aiAnswer

    return NextResponse.json({ result: finalResult })

  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Terjadi kesalahan internal pada backend route' },
      { status: 500 }
    )
  }
}