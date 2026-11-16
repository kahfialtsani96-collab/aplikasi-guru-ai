import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const {
      tool,
      activeTool,
      selectedDoc,
      jenjang,
      jurusan,
      mapel,
      faseKelas,
      materiTopik,
      spesifikData,
      ...kbcData
    } = body

    const apiKey = (process.env.MERCURY_API_KEY || '').replace(/['"]/g, '').trim()

    if (!apiKey) {
      return NextResponse.json(
        { error: 'API Key Mercury (MERCURY_API_KEY) tidak terkonfigurasi di backend (.env.local / Vercel)' },
        { status: 400 }
      )
    }

    const sanitize = (str: any) => (typeof str === 'string' && str.trim() !== '' ? str.trim() : null)

    const jenjangResmi = (sanitize(jenjang) || 'SMP').toUpperCase()
    const isSmk = jenjangResmi === 'SMK'
    const jurusanResmi = sanitize(jurusan) || (isSmk ? 'Desain Komunikasi Visual (DKV)' : null)

    const namaSekolahResmi =
      sanitize(kbcData.satuanPendidikan) || (isSmk ? 'SMK MUNA MUSTOFA' : 'SMP MUNA MUSTOFA')
    const namaGuruResmi = sanitize(kbcData.namaGuru) || 'Muzaini Al Kahfi'
    const nipGuruResmi = sanitize(kbcData.nipGuru) || '-'
    const namaKepalaResmi =
      sanitize(kbcData.namaKepala) || (isSmk ? 'Kepala Sekolah SMK' : 'SULASTRI, S.Pd., Gr.')
    const nipKepalaResmi =
      sanitize(kbcData.nipKepala) || (isSmk ? '-' : '6337763664131233')
    const kotaTtdResmi = sanitize(kbcData.kotaTtd) || 'Gisting'

    const formatNuptk = (val: string) => {
      if (!val || val === '-' || val.trim() === '') return 'NUPTK: -'
      const cleanNumber = val.replace(/^(NIP\/NUPTK|NUPTK|NIP)\.?:?\s*/i, '').trim()
      return `NUPTK: ${cleanNumber}`
    }

    const konteksJenjangPrompt = isSmk
      ? `Jenjang: SMK (Sekolah Menengah Kejuruan) — Kompetensi Keahlian: ${jurusanResmi}. Gunakan pendekatan vokasi/industri kreatif, studi kasus proyek klien (client brief), standar teknis produksi media visual, tipografi, tata letak, fotografi/videografi, dan kesiapan kerja dunia industri (DUDI) sesuai Kurikulum Merdeka SMK Fase E/F.`
      : `Jenjang: SMP (Sekolah Menengah Pertama) Kurikulum Merdeka Fase D.`

    // Helper pemanggil API Inception Labs Mercury (URL bersih tanpa format Markdown)
    const callMercuryAPI = async (
      systemPrompt: string,
      userPrompt: string,
      maxTokens: number,
      temperature: number
    ) => {
      const endpointUrl = 'https://api.inceptionlabs.ai/v1/chat/completions'
      const modelsToTry = ['mercury-2', 'mercury-coder-small']
      let lastErrorMsg = 'Gagal menghubungi server Inception Labs AI'
      let lastStatus = 500

      for (const modelName of modelsToTry) {
        const res = await fetch(endpointUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: modelName,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt },
            ],
            max_tokens: maxTokens,
            temperature,
          }),
        })

        const rawText = await res.text()
        let parsed: any = null
        try {
          parsed = JSON.parse(rawText)
        } catch {
          lastErrorMsg = `Inception Labs merespons non-JSON (${res.status}):${rawText.substring(0, 150)}`
          lastStatus = res.status || 500
          continue
        }

        if (res.ok) {
          return { ok: true, data: parsed }
        }

        lastStatus = res.status
        lastErrorMsg =
          parsed?.error?.message ||
          parsed?.message ||
          `HTTP ${res.status} pada model ${modelName}`

        if (res.status === 401 || res.status === 403 || res.status === 429) {
          break
        }
      }

      return { ok: false, status: lastStatus, error: lastErrorMsg }
    }

    let systemPrompt = ''
    let userPrompt = ''

    // =========================================================================
    // KHUSUS GENERATOR DESKRIPSI CAPAIAN KOMPETENSI RAPOR (BATCH JSON)
    // =========================================================================
    if (activeTool === 'rapor-deskripsi') {
      const daftarMapelNilai = Array.isArray(spesifikData?.daftarMapel)
        ? spesifikData.daftarMapel
        : []
      const namaSiswa = sanitize(spesifikData?.namaSiswa) || 'Peserta Didik'
      const batasKata = isSmk
        ? 'maksimal 18-22 kata (1-2 kalimat singkat, padat, maksimal 145 karakter)'
        : 'ekstra ringkas maksimal 12-15 kata (1 kalimat padat saja, maksimal 105 karakter)'

      systemPrompt = `Anda adalah Asisten Wali Kelas Kurikulum Merdeka (${jenjangResmi}). Anda wajib membalas HANYA dengan objek JSON murni yang valid tanpa teks pengantar, tanpa blok markdown \`\`\`json, dan tanpa penutup.`

      userPrompt = `Susun deskripsi Capaian Kompetensi Rapor untuk siswa bernama "${namaSiswa}" (${jenjangResmi}, ${faseKelas || '-'}).

Daftar mata pelajaran, nilai akhir, dan ringkasan materi jurnal kelas:
${JSON.stringify(daftarMapelNilai, null, 2)}

Aturan Penulisan WAJIB:
1. Untuk setiap item pada daftar di atas, buat narasi capaian kompetensi dalam Bahasa Indonesia baku rapor Kurikulum Merdeka.
2. Panjang setiap deskripsi WAJIB ${batasKata} agar cetakan rapor tidak meluber halaman.
3. Sesuaikan nada kalimat dengan nilai:
   - Nilai >= 86: "Menunjukkan penguasaan yang sangat baik dalam..."
   - Nilai 79-85: "Menunjukkan penguasaan yang baik dalam..."
   - Nilai 75-78: "Menunjukkan penguasaan yang cukup baik dalam..."
   - Nilai < 75 atau belum ada nilai ("-"): "Perlu bimbingan lebih lanjut dalam memahami..."
4. Integrasikan topik materi dari kolom "materiJurnal" jika tersedia. Jika "materiJurnal" kosong, sebutkan kompetensi esensial mata pelajaran tersebut secara ringkas.
5. Output WAJIB berupa JSON Object dengan format persis seperti ini:
{
  "descriptions": {
    "<id_atau_nama_mapel>": "<teks_deskripsi_singkat>"
  }
}`

      const apiRes = await callMercuryAPI(systemPrompt, userPrompt, 4096, 0.4)
      if (!apiRes.ok) {
        return NextResponse.json({ error: apiRes.error }, { status: apiRes.status || 500 })
      }

      const aiContent = (apiRes.data.choices?.[0]?.message?.content || '').trim()
      const cleanedJsonStr = aiContent
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim()

      try {
        const parsedObj = JSON.parse(cleanedJsonStr)
        return NextResponse.json({
          descriptions: parsedObj.descriptions || parsedObj,
        })
      } catch {
        return NextResponse.json(
          { error: 'Format respons AI untuk deskripsi rapor tidak valid', raw: cleanedJsonStr },
          { status: 500 }
        )
      }
    }

    // =========================================================================
    // LOGIKA CHATBOT VS GENERATOR DOKUMEN RESMI (AI TOOLS)
    // =========================================================================
    if (activeTool === 'chatbot') {
      systemPrompt = `Anda adalah Asisten Guru AI dan Konsultan Pedagogi Kurikulum Merdeka (SMP & SMK Kejuruan) serta KBC Kemenag RI yang ramah, komunikatif, solutif, dan praktis.`

      userPrompt = `Pertanyaan / Diskusi Guru:
${materiTopik}

(Konteks Pembelajaran: Satuan Pendidikan: ${namaSekolahResmi}, ${konteksJenjangPrompt}, Mapel: ${mapel || '-'}, Fase/Kelas: ${faseKelas || '-'})

Instruksi Penjawab Chatbot:
1. Jawablah pertanyaan guru secara langsung pada inti masalah, lugas, dan praktis.
2. DILARANG MEMBUAT struktur dokumen formal seperti "1. Identitas Dokumen", "2. Latar Belakang", atau bagian tanda tangan di akhir.
3. Gunakan format Markdown yang rapi (bullet points, bold, dan paragraf singkat) agar mudah dibaca.`
    } else {
      systemPrompt = `Anda adalah Asisten Guru AI dan Pakar Pedagogi Kurikulum Merdeka (SMP Fase D & SMK Kejuruan Fase E/F) serta KBC Kemenag RI yang cerdas, terstruktur, mendalam, dan profesional.`

      let detailInstruksi = ''

      switch (activeTool) {
        case 'kbc':
          detailInstruksi = `Buatlah dokumen [${selectedDoc?.toUpperCase()}] untuk Perangkat Ajar Kurikulum Berbasis Cinta (KBC). Satuan Pendidikan: ${namaSekolahResmi}, ${konteksJenjangPrompt}, Mapel: ${mapel}, Fase/Kelas: ${faseKelas}. Data: ${JSON.stringify(kbcData)}.`
          break
        case 'perangkat':
          detailInstruksi = `Buat dokumen ${spesifikData?.jenisPerangkat || 'Perangkat Pembelajaran'}. ${konteksJenjangPrompt} Mapel: ${mapel}, Fase/Kelas: ${faseKelas}. Materi Pokok: ${materiTopik}.`
          break
        case 'deep-learning':
          detailInstruksi = `Susun Modul Ajar LENGKAP SIAP AKREDITASI dengan pendekatan Deep Learning. 
${konteksJenjangPrompt}
Fokus Pilar: ${spesifikData?.dlPilar}, Alokasi Waktu: ${spesifikData?.dlAlokasi}, Strategi: ${spesifikData?.dlStrategi}. 
Materi Topik: ${materiTopik}. 
WAJIB ikuti struktur berikut secara berurutan:
1. Informasi Umum
2. Kompetensi Inti & Tujuan Pembelajaran
3. Skenario Kegiatan Pembelajaran (Pendahuluan, Inti, Penutup)
4. Lampiran (Rubrik Sikap, Rubrik Diskusi, dan Soal Evaluasi).`
          break
        case 'kokurikuler':
          detailInstruksi = `Rancang Modul Projek Kokurikuler P5/PPRA. ${konteksJenjangPrompt} Tema Utama: ${spesifikData?.kokuTema}, Dimensi Profil: ${spesifikData?.kokuDimensi}. Topik Projek: ${materiTopik}. Sertakan Alur Aktivitas, Rubrik Penilaian, dan Lembar Asesmen.`
          break
        case 'lkpd':
          detailInstruksi = `Buat Lembar Kerja Peserta Didik (LKPD). ${konteksJenjangPrompt} Jenis Aktivitas: ${spesifikData?.lkpdAktivitas}. Materi: ${materiTopik}. ${spesifikData?.lkpdHots ? 'Gunakan soal HOTS dan konteks kearifan lokal / studi kasus industri.' : ''}`
          break
        case 'soal':
          detailInstruksi = `Buat Paket Naskah Ujian Resmi. ${konteksJenjangPrompt}
- Jumlah Soal: ${spesifikData?.soalJumlah}
- Bentuk Soal: ${spesifikData?.soalTipe}
- Tingkat Kesulitan: ${spesifikData?.soalLevel}
- Topik/Indikator Materi: ${materiTopik}
${isSmk ? '- Khususan SMK DKV: Jika mata pelajaran termasuk produktif/kejuruan DKV, wajib gunakan studi kasus nyata (client brief, komposisi desain, manajemen warna RGB/CMYK, resolusi DPI/PPI, tipografi, atau alur produksi multimedia) serta tambahkan keterangan [Ilustrasi Visual: ...] pada soal yang membutuhkan stimulus gambar.' : ''}
- DILARANG membuat tabel kisi-kisi soal.
${spesifikData?.soalKunci ? '- Sertakan Kunci Jawaban lengkap beserta pembahasan singkat di bagian paling akhir.' : ''}`
          break
        case 'multi':
          detailInstruksi = `Bantu saya membuat: ${spesifikData?.multiSubTool}. ${konteksJenjangPrompt} Catatan/Konteks: ${materiTopik}.`
          break
        default:
          detailInstruksi = `Buat dokumen pedagogi untuk: ${materiTopik}`
          break
      }

      userPrompt = `Tugas Utama Anda: Susunlah dokumen pedagogi guru secara LENGKAP, MENDALAM, dan TERSTRUKTUR.
- Modul/Tool AI: ${tool || 'Generator Perangkat Ajar'}
- Satuan Pendidikan: ${namaSekolahResmi} (DILARANG menggunakan kata 'Sekolah/Madrasah', wajib gunakan nama resmi ini)
- Jenjang Pendidikan: ${jenjangResmi}${jurusanResmi ? ` (${jurusanResmi})` : ''}
- Mata Pelajaran: ${mapel || '-'}
- Fase/Kelas: ${faseKelas || '-'}
- Instruksi Spesifik: ${detailInstruksi}

Instruksi Format WAJIB:
1. Gunakan format Markdown murni (tanpa tag HTML).
2. Tuliskan semua bagian materi hingga tuntas tanpa terpotong.
3. DILARANG KERAS membuat teks tanda tangan, penutup 'Disetujui Oleh', 'Penyusun', atau blok pengesahan di akhir teks, karena Lembar Pengesahan resmi akan diinjeksi secara otomatis oleh sistem.`
    }

    const apiRes = await callMercuryAPI(systemPrompt, userPrompt, 8192, 0.7)

    if (!apiRes.ok) {
      return NextResponse.json(
        { error: apiRes.error || 'Gagal memproses permintaan ke Mercury AI' },
        { status: apiRes.status || 500 }
      )
    }

    const aiAnswer =
      apiRes.data.choices?.[0]?.message?.content || 'Tidak ada respons yang dihasilkan oleh AI.'

    const lembarPengesahanHTML = `\n\n<br><hr><br>
### LEMBAR PENGESAHAN
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
    console.error('Error /api/gemini:', err)
    return NextResponse.json(
      { error: err.message || 'Terjadi kesalahan internal pada backend route' },
      { status: 500 }
    )
  }
}