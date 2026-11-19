'use client'
import { useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import { Bot, Send, Trash2, School, Palette, Copy, Rocket } from 'lucide-react'

interface ChatAssistantProps {
  jenjang: 'SMP' | 'SMK'
  mapel: string
  faseKelas: string
  jurusan: string | null
  namaSekolah: string
  namaKepala: string
  nipKepala: string
  isDarkMode: boolean
  userName: string
  mapelOptions?: string[]
  onJenjangChange?: (j: 'SMP' | 'SMK') => void
  onMapelChange?: (m: string) => void
  onUsePrompt?: (content: string) => void

}

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}
const quickSuggestions = [
  'Strategi mengajar siswa yang sulit fokus',
  'Ide ice breaking pembuka kelas yang menarik',
  'Cara menangani siswa yang pasif di kelas',
  'Contoh narasi rapor untuk siswa kurang percaya diri',
  'Bantu saya merancang soal HOTS untuk mapel saya',
]
export default function ChatAssistant(props: ChatAssistantProps) {
  const {
    jenjang,
    mapel,
    faseKelas,
    jurusan,
    mapelOptions,
    onJenjangChange,
    onMapelChange,
    onUsePrompt,

    namaSekolah,
    namaKepala,
    nipKepala,
    isDarkMode,
    userName,
  } = props
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const endRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages, sending])
  const send = async (override?: string) => {
    const text = (override ?? input).trim()
    if (!text || sending) return
    const userMsg: ChatMessage = { role: 'user', content: text }
    const history = messages.slice(-20)
    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setSending(true)
    try {
      const payload = {
        tool: 'Asisten Guru AI',
        activeTool: 'chatbot',
        selectedDoc: null,
        jenjang,
        jurusan,
        satuanPendidikan: namaSekolah,
        namaKepala,
        nipKepala,
        mapel,
        faseKelas,
        materiTopik: text,
        chatHistory: history,
      }
      const res = await fetch('/api/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `HTTP Error ${res.status}`)
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: data.result || 'Tidak ada respons.' },
      ])
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `⚠️ Gagal terhubung ke AI: ${err.message}. Silakan coba lagi.`,
        },
      ])
    } finally {
      setSending(false)
    }
  }
  const clear = () => {
    setMessages([])
    setInput('')
  }

  return (
    <div className="flex flex-col h-full flex-1 min-h-0">
      {/* HEADER KOTAK PERCAKAPAN: Pemilih Jenjang + Mata Pelajaran */}
      <div className={`shrink-0 mb-2.5 px-2.5 py-2 rounded-xl border flex flex-wrap items-center gap-2 ${isDarkMode ? 'bg-slate-800/70 border-slate-700' : 'bg-indigo-50/60 border-indigo-200'}`}>
        <div className={`inline-flex p-0.5 rounded-lg border text-[10px] font-black ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-300'}`}>
          <button
            type="button"
            onClick={() => onJenjangChange?.('SMP')}
            className={`px-2.5 py-1 rounded-md transition cursor-pointer ${jenjang === 'SMP' ? 'bg-indigo-600 text-white shadow-xs' : isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'}`}
          >
            <School className="w-3.5 h-3.5 inline-block align-middle mr-0.5" /> SMP (Fase D)
          </button>
          <button
            type="button"
            onClick={() => onJenjangChange?.('SMK')}
            className={`px-2.5 py-1 rounded-md transition cursor-pointer ${jenjang === 'SMK' ? 'bg-amber-500 text-slate-950 shadow-xs' : isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'}`}
          >
            <Palette className="w-3.5 h-3.5 inline-block align-middle mr-0.5" /> SMK DKV
          </button>
        </div>
        <label className="flex items-center gap-1.5 min-w-0 flex-1">
          <span className={`text-[10px] font-bold shrink-0 ${isDarkMode ? 'text-indigo-300' : 'text-slate-600'}`}>Mapel:</span>
          {mapelOptions && mapelOptions.length > 0 ? (
            <select
              value={mapel}
              onChange={(e) => onMapelChange?.(e.target.value)}
              className={`w-full min-w-0 border rounded-lg px-2 py-1 text-[11px] font-bold cursor-pointer focus:outline-none ${isDarkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'}`}
            >
              {mapelOptions.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          ) : (
            <input
              value={mapel}
              onChange={(e) => onMapelChange?.(e.target.value)}
              className={`w-full min-w-0 border rounded-lg px-2 py-1 text-[11px] font-medium focus:outline-none ${isDarkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'}`}
            />
          )}
        </label>
      </div>


      <div className="flex-1 overflow-y-auto pr-1 space-y-3 custom-scrollbar">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center space-y-3">
            <div className={`w-12 h-12 rounded-2xl border flex items-center justify-center shadow-xs ${isDarkMode ? 'bg-slate-800 border-slate-700 text-indigo-400' : 'bg-indigo-50 border-indigo-200 text-indigo-700'}`}>
              <Bot className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h5 className={`font-extrabold text-sm tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                Asisten Guru AI
              </h5>
              <p className={`text-[11px] font-medium max-w-sm mx-auto ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                Halo {userName}, selamat datang! Saya siap membantu konsultasi pedagogi Kurikulum
                Merdeka {jenjang === 'SMK' ? ' SMK (DKV)' : ' SMP'}.
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-1.5 max-w-md">
              {quickSuggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  disabled={sending}
                  onClick={() => send(s)}
                  className={`text-[10px] font-semibold px-2.5 py-1 rounded-full border transition cursor-pointer disabled:opacity-40 ${isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-200 hover:border-indigo-500 hover:text-indigo-300' : 'bg-slate-50 border-slate-200 text-slate-700 hover:border-indigo-400 hover:text-indigo-700'}`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-3 py-2 text-xs leading-relaxed shadow-xs ${m.role === 'user' ? 'bg-indigo-600 text-white rounded-br-sm' : isDarkMode ? 'bg-slate-800 text-slate-100 rounded-bl-sm border border-slate-700' : 'bg-slate-100 text-slate-900 rounded-bl-sm border border-slate-200'}`}
                >
                  {m.role === 'assistant' ? (
                    <ReactMarkdown
                      rehypePlugins={[rehypeRaw]}
                      remarkPlugins={[remarkGfm]}
                      components={{
                        p: ({ children }) => <p className="my-1">{children}</p>,
                        ul: ({ children }) => <ul className="list-disc pl-4 my-1 space-y-0.5">{children}</ul>,
                        ol: ({ children }) => <ol className="list-decimal pl-4 my-1 space-y-0.5">{children}</ol>,
                        li: ({ children }) => <li className="my-0.5">{children}</li>,
                        strong: ({ children }) => <strong className="font-bold">{children}</strong>,
                        h1: ({ children }) => <h1 className="text-sm font-black my-1">{children}</h1>,
                        h2: ({ children }) => <h2 className="text-sm font-black my-1">{children}</h2>,
                        h3: ({ children }) => <h3 className="text-sm font-black my-1">{children}</h3>,
                      }}
                    >
                      {m.content}
                    </ReactMarkdown>
                  ) : (
                    <span className="whitespace-pre-wrap">{m.content}</span>
                  )}
                  {m.role === 'assistant' && (
                    <div className={`mt-2 pt-2 border-t flex flex-wrap gap-1.5 ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}`}>
                      <button
                        type="button"
                        onClick={() => navigator.clipboard?.writeText(m.content).catch(() => {})}
                        className="text-[10px] font-bold px-2 py-1 rounded-lg border inline-flex items-center gap-1 cursor-pointer bg-white/60 text-slate-700 border-slate-300 hover:bg-white"
                        title="Salin prompt ke clipboard"
                      >
                        <Copy className="w-3 h-3" /> Salin Prompt
                      </button>
                      <button
                        type="button"
                        onClick={() => onUsePrompt?.(m.content)}
                        className="text-[10px] font-black px-2 py-1 rounded-lg inline-flex items-center gap-1 cursor-pointer bg-emerald-600 hover:bg-emerald-700 text-white"
                        title="Tempel prompt ini ke kolom materi Bank Soal"
                      >
                        <Rocket className="w-3 h-3" /> Gunakan di Bank Soal
                      </button>
                    </div>
                  )}

                </div>
              </div>
            ))}
            {sending && (
              <div className="flex justify-start">
                <div
                  className={`flex items-center gap-1.5 rounded-2xl rounded-bl-sm px-3.5 py-2.5 border shadow-xs ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-100 border-slate-200'}`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-bounce" />
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-bounce [animation-delay:150ms]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-bounce [animation-delay:300ms]" />
                </div>
              </div>
            )}
          </>
        )}
        <div ref={endRef} />
      </div>
      <div className={`mt-3 pt-2.5 border-t flex items-end gap-2 ${isDarkMode ? 'border-slate-800' : 'border-slate-200'}`}>
        <textarea
          rows={2}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              send()
            }
          }}
          placeholder="Tulis pertanyaan Anda… (Enter = kirim)"
          className={`w-full border rounded-xl px-3 py-2 text-xs leading-relaxed resize-none focus:outline-none focus:ring-2 transition ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white focus:ring-indigo-600/40' : 'bg-slate-50 border-slate-300 text-slate-900 focus:ring-indigo-400/40'}`}
        />
        <button
          type="button"
          onClick={() => send()}
          disabled={!input.trim() || sending}
          className="shrink-0 w-9 h-9 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center transition shadow-xs disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
          title="Kirim pesan"
        >
          <Send className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={clear}
          disabled={messages.length === 0}
          title="Bersihkan percakapan"
          className="shrink-0 w-9 h-9 rounded-xl border flex items-center justify-center transition disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed text-rose-500 hover:bg-rose-500/10"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
