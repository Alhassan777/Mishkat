import { useState } from 'react'
import { useStore } from '../../store'

interface Props { recordId: string }

export function FeedbackWidget({ recordId }: Props) {
  const { feedback, setFeedback } = useStore()
  const existing = feedback.get(recordId)
  const [note, setNote] = useState(existing?.note ?? '')
  const [showNote, setShowNote] = useState(!!existing?.vote)

  function vote(v: 'up' | 'down') {
    setShowNote(true)
    setFeedback({ recordId, vote: v, note, timestamp: new Date().toISOString() })
  }

  function saveNote() {
    if (!existing) return
    setFeedback({ ...existing, note, timestamp: new Date().toISOString() })
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="text-xs text-slate-500 uppercase tracking-wider">Research feedback</div>

      {/* Thumbs — always visible first */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => vote('up')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border transition-all ${
            existing?.vote === 'up'
              ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
              : 'border-white/10 text-slate-500 hover:text-slate-300 hover:border-white/20'
          }`}
        >
          👍 Accurate
        </button>
        <button
          onClick={() => vote('down')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border transition-all ${
            existing?.vote === 'down'
              ? 'bg-red-500/20 border-red-500/50 text-red-400'
              : 'border-white/10 text-slate-500 hover:text-slate-300 hover:border-white/20'
          }`}
        >
          👎 Incorrect
        </button>
      </div>

      {/* Note — revealed after voting */}
      {showNote && (
        <div className="flex flex-col gap-1.5">
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            onBlur={saveNote}
            placeholder="Was this connection accurate? Add a note for the research team…"
            rows={2}
            className="w-full text-sm bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-slate-300 placeholder-slate-600 resize-none focus:outline-none focus:border-[rgba(212,175,55,0.5)] transition-colors"
          />
          {note && (
            <button
              onClick={saveNote}
              className="self-end text-xs text-[var(--gold)] hover:text-[var(--gold-warm)] transition-colors"
            >
              Save note
            </button>
          )}
        </div>
      )}
    </div>
  )
}
