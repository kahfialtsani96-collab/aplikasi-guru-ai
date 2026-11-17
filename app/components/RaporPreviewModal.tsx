'use client'

import { useRef, useState } from 'react'
import { FileEdit, X, Printer, Sparkles, Pencil } from 'lucide-react'
import {
  generateAiCapaianRapor,
  RaporMapelContextItem,
} from '../utils/raporBuilder'

export interface RaporPreviewMeta {
  namaSiswa: string
  kelasStr: string
  unit: 'SMP' | 'SMK'
  faseKurikulum: string
  mapelContexts: RaporMapelContextItem[]
}

interface RaporPreviewModalProps {
  isOpen: boolean
  isDarkMode: boolean
  htmlContent: string
  meta: RaporPreviewMeta | null
  selectedSemester: 'Ganjil' | 'Genap'
  onClose: () => void
  onPrintHtml: (titleText: string, innerHtml: string) => void
  onDownloadWordHtml: (filename: string, innerHtml: string) => void
}

export default function RaporPreviewModal({
  isOpen,
  isDarkMode,
  htmlContent,
  meta,
  selectedSemester,
  onClose,
  onPrintHtml,
  onDownloadWordHtml,
}: RaporPreviewModalProps) {
  const raporPreviewRef = useRef<HTMLDivElement>(null)
  const [isGeneratingAi, setIsGeneratingAi] = useState(false)
  const [aiStatusMsg, setAiStatusMsg] = useState('')

  if (!isOpen) return null

  const handleGenerateAiDescriptions = async () => {
    if (!meta || !raporPreviewRef.current) return
    if (!meta.mapelContexts || meta.mapelContexts.length === 0) {
      alert('Daftar mata pelajaran tidak ditemukan pada rapor ini.')
      return
    }

    setIsGeneratingAi(true)
    setAiStatusMsg('Menyusun deskripsi AI...')
    try {
      const descriptions = await generateAiCapaianRapor({
        namaSiswa: meta.namaSiswa,
        unit: meta.unit,
        faseKelas: `${meta.kelasStr} / Fase ${meta.faseKurikulum}`,
        mapelContexts: meta.mapelContexts,
      })

      const cells = raporPreviewRef.current.querySelectorAll<HTMLElement>(
        '[data-mapel-desc-id]'
      )
      let updatedCount = 0

      cells.forEach((cell) => {
        const mId = cell.getAttribute('data-mapel-desc-id') || ''
        const mName = cell.getAttribute('data-mapel-desc-name') || ''
        const newText = descriptions[mId] || descriptions[mName]
        if (newText) {
          cell.textContent = newText
          updatedCount++
        }
      })

      setAiStatusMsg(`✅ ${updatedCount} capaian diperbarui!`)
      setTimeout(() => setAiStatusMsg(''), 4000)
    } catch (err: any) {
      console.error('Error generating AI rapor descriptions:', err)
      alert(`Gagal mengisi capaian kompetensi AI: ${err.message || 'Terjadi kesalahan'}`)
      setAiStatusMsg('')
    } finally {
      setIsGeneratingAi(false)
    }
  }

  const handlePrintClick = () => {
    const editedHtml = raporPreviewRef.current
      ? raporPreviewRef.current.innerHTML
      : htmlContent
    const titleText = meta
      ? `RAPOR_${meta.unit}_${meta.namaSiswa.toUpperCase()}`
      : 'RAPOR_PESERTA_DIDIK'
    onPrintHtml(titleText, editedHtml)
  }

  const handleDownloadWordClick = () => {
    const editedHtml = raporPreviewRef.current
      ? raporPreviewRef.current.innerHTML
      : htmlContent
    const safeName = (meta?.namaSiswa || 'Siswa').replace(/[^a-zA-Z0-9]/g, '_')
    const safeKelas = (meta?.kelasStr || '').replace(/\s+/g, '')
    onDownloadWordHtml(
      `Rapor_${meta?.unit || 'SMP'}_${safeName}_${safeKelas}_${selectedSemester}`,
      editedHtml
    )
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 print:hidden">
      <div
        className={`w-full max-w-5xl h-[92vh] rounded-2xl border shadow-2xl flex flex-col overflow-hidden ${
          isDarkMode
            ? 'bg-slate-900 border-slate-700 text-slate-100'
            : 'bg-slate-100 border-slate-300 text-slate-900'
        }`}
      >
        {/* Header Modal Editor */}
        <div
          className={`px-4 py-3 border-b flex flex-wrap items-center justify-between gap-2 shrink-0 ${
            isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-white border-slate-300'
          }`}
        >
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-indigo-600 text-white text-[10px] font-black">
                LIVE EDITOR RAPOR ({meta?.unit || 'SMP'})
              </span>
              <h3 className="font-extrabold text-sm">
                {meta?.namaSiswa.toUpperCase()} — Kelas {meta?.kelasStr}
              </h3>
              {aiStatusMsg && (
                <span className="text-[11px] font-extrabold text-emerald-500">
                  {aiStatusMsg}
                </span>
              )}
            </div>
            <p className="text-[11px] text-amber-500 font-bold mt-0.5">
              <Pencil className="w-3.5 h-3.5 inline-block align-middle" /> Klik langsung pada teks mana saja di dalam kertas rapor untuk mengedit manual,
              atau gunakan tombol AI untuk mengisi capaian kompetensi otomatis.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleGenerateAiDescriptions}
              disabled={isGeneratingAi}
              className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-500 text-white font-black px-3.5 py-1.5 rounded-xl text-xs transition shadow-xs flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed"
            >
              <Sparkles className="w-4 h-4" />
              <span>
                {isGeneratingAi
                  ? 'AI Menyusun Capaian...'
                  : 'Isi Capaian Kompetensi AI'}
              </span>
            </button>

            <button
              type="button"
              onClick={handlePrintClick}
              className="bg-amber-400 hover:bg-amber-500 text-slate-950 font-black px-3.5 py-1.5 rounded-xl text-xs transition shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-4 h-4" /> Cetak PDF (4 Halaman)
            </button>

            <button
              type="button"
              onClick={handleDownloadWordClick}
              className="bg-sky-600 hover:bg-sky-700 text-white font-black px-3.5 py-1.5 rounded-xl text-xs transition shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <FileEdit className="w-4 h-4" /> Unduh Word
            </button>

            <button
              type="button"
              onClick={onClose}
              className="bg-rose-600 hover:bg-rose-700 text-white font-black px-3 py-1.5 rounded-xl text-xs transition cursor-pointer"
            >
              <X className="w-4 h-4 inline-block align-middle" /> Tutup
            </button>
          </div>
        </div>

        {/* Area Kertas A4 Editable */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-500/30">
          <style>{`
            .rapor-paper-canvas {
              font-family: 'Times New Roman', Times, serif;
              color: #000;
              line-height: 1.35;
              font-size: 10pt;
            }
            .rapor-paper-canvas .cover-box {
              border: 3px double #000;
              padding: 28px 24px;
              margin-bottom: 24px;
            }
            .rapor-paper-canvas .page-section {
              position: relative;
              background: #fff;
              padding: 24px 28px;
              margin-bottom: 24px;
              box-shadow: 0 4px 16px rgba(0,0,0,0.18);
              overflow: hidden;
            }
            .rapor-paper-canvas .page-watermark {
              position: absolute;
              top: 50%;
              left: 50%;
              transform: translate(-50%, -50%);
              opacity: 0.06;
              z-index: 0;
              pointer-events: none;
            }
            .rapor-paper-canvas .page-watermark img {
              width: 360px;
              height: 360px;
              object-fit: contain;
            }
            .rapor-paper-canvas .table-identitas {
              width: 100%;
              border: none;
              border-collapse: collapse;
              margin-bottom: 10px;
              font-size: 10pt;
            }
            .rapor-paper-canvas .table-identitas td {
              border: none;
              padding: 2.5px 4px;
              vertical-align: top;
            }
            .rapor-paper-canvas .section-title {
              margin: 0 0 5px 0;
              font-size: 9.8pt;
              text-transform: uppercase;
              letter-spacing: 0.3px;
            }
            .rapor-paper-canvas .table-data {
              width: 100%;
              border-collapse: collapse;
              font-size: 9.2pt;
            }
            .rapor-paper-canvas .table-data th {
              background-color: #f1f5f9;
              border: 1px solid #000;
              padding: 5px 6px;
              font-weight: bold;
            }
            .rapor-paper-canvas .table-data td {
              border: 1px solid #000;
              padding: 4.5px 6px;
              vertical-align: middle;
            }
          `}</style>

          <div
            ref={raporPreviewRef}
            contentEditable={true}
            suppressContentEditableWarning={true}
            className="rapor-paper-canvas max-w-[21cm] mx-auto focus:outline-none"
            dangerouslySetInnerHTML={{ __html: htmlContent }}
          />
        </div>
      </div>
    </div>
  )
}