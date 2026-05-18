import { motion } from 'framer-motion'

interface Props { onDismiss: () => void }

export function OnboardingTooltip({ onDismiss }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 4 }}
      transition={{ type: 'spring', stiffness: 280, damping: 24 }}
      className="absolute bottom-14 left-1/2 -translate-x-1/2 z-20 pointer-events-auto"
    >
      <div className="flex items-center gap-3 px-5 py-3.5 rounded-2xl max-w-xs" style={{
        background: 'rgba(5, 10, 21, 0.92)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: '1px solid rgba(212, 175, 55, 0.15)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04)',
      }}>
        <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{
          background: 'rgba(212, 175, 55, 0.1)',
          border: '1px solid rgba(212, 175, 55, 0.2)',
        }}>
          <span className="text-[var(--gold)] text-sm">✦</span>
        </div>
        <p className="text-sm text-[var(--text-primary)] leading-snug flex-1">
          Click any glowing verse to explore its scholarly connections
        </p>
        <button
          onClick={onDismiss}
          className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors text-lg leading-none flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full hover:bg-white/10"
        >
          ×
        </button>
      </div>
    </motion.div>
  )
}
