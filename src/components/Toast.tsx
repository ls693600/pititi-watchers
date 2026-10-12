import { t } from '../i18n'
import type { ToastState } from '../hooks/useToast'
import { Icon } from './Icon'

/** The message at the bottom, with its action button (Undo, Open) when it has one. */
export function Toast({ toast, onDismiss }: { toast: ToastState; onDismiss: () => void }) {
  return (
    <div className={`toast ${toast.undo ? 'has-undo' : ''}`} role="status" key={toast.id}>
      <Icon name="check" size={18} stroke={2.6} /> <span className="toast-msg">{toast.msg}</span>
      {toast.undo && (
        <button
          className="toast-undo"
          onClick={() => {
            const action = toast.undo!
            onDismiss()
            action()
          }}
        >
          {t(toast.label ?? 'Undo')}
        </button>
      )}
    </div>
  )
}
