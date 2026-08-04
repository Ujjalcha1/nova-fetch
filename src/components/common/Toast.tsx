import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle2, Info, AlertCircle, X } from 'lucide-react'
import { useToastStore, type ToastType } from '../../store/toast-store'

// ---------------------------------------------------------------------------
// Icon + colour per toast type
// ---------------------------------------------------------------------------

const CONFIG: Record<ToastType, { icon: React.ElementType; accent: string; bar: string }> = {
  success: { icon: CheckCircle2, accent: 'text-green-400',  bar: 'bg-green-500'  },
  info:    { icon: Info,         accent: 'text-violet-400', bar: 'bg-violet-500' },
  error:   { icon: AlertCircle,  accent: 'text-red-400',    bar: 'bg-red-500'    },
}

// ---------------------------------------------------------------------------
// Toast
// ---------------------------------------------------------------------------

export default function Toast() {
  const toasts = useToastStore((s) => s.toasts)
  const removeToast = useToastStore((s) => s.removeToast)

  return (
    <div className="fixed bottom-20 right-6 z-[9998] flex flex-col gap-2">
      <AnimatePresence>
        {toasts.map((toast) => {
          const cfg = CONFIG[toast.type]
          const Icon = cfg.icon

          return (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 24, scale: 0.94 }}
              animate={{ opacity: 1, y: 0,  scale: 1     }}
              exit={{    opacity: 0, y: -8,  scale: 0.94  }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="relative flex w-80 overflow-hidden rounded-xl border border-white/[0.09] bg-[#1C2537] shadow-lg shadow-black/50"
            >
              {/* Left accent bar */}
              <div className={`w-1 shrink-0 ${cfg.bar}`} />

              {/* Body */}
              <div className="flex min-w-0 flex-1 items-start gap-3 px-4 py-3">
                <Icon size={18} className={`mt-0.5 shrink-0 ${cfg.accent}`} />

                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-white">{toast.message}</p>
                  {toast.subtitle && (
                    <p className="mt-0.5 truncate text-xs text-gray-400">{toast.subtitle}</p>
                  )}
                </div>

                <button
                  onClick={() => removeToast(toast.id)}
                  className="mt-0.5 shrink-0 rounded p-0.5 text-gray-500 transition hover:bg-white/10 hover:text-white"
                >
                  <X size={13} />
                </button>
              </div>

              {/* Auto-dismiss progress bar */}
              <motion.div
                className={`absolute bottom-0 left-1 right-0 h-[2px] origin-left ${cfg.bar} opacity-40`}
                initial={{ scaleX: 1 }}
                animate={{ scaleX: 0 }}
                transition={{ duration: 5, ease: 'linear' }}
              />
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}
