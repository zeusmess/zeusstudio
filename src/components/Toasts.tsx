import { Icon, type IconName } from './Icon'
import { useToasts, type ToastTone } from './toastStore'
import styles from './Toasts.module.css'

const ICONS: Record<ToastTone, IconName> = {
  achievement: 'trophy',
  info: 'info',
  success: 'check',
  error: 'alert',
}

/** Non-blocking notifications (achievements, sign-in) in a polite live region. */
export function Toasts() {
  const toasts = useToasts((s) => s.toasts)
  const dismiss = useToasts((s) => s.dismiss)
  return (
    <div className={styles.region} role="status" aria-live="polite">
      {toasts.map((toast) => (
        <button
          key={toast.id}
          type="button"
          className={[styles.toast, styles[toast.tone]].join(' ')}
          onClick={() => dismiss(toast.id)}
          data-testid={`toast-${toast.tone}`}
        >
          <span className={styles.icon}>
            <Icon name={ICONS[toast.tone]} size={18} />
          </span>
          <span className={styles.text}>
            <span className={styles.title}>{toast.title}</span>
            {toast.body && <span className={styles.body}>{toast.body}</span>}
          </span>
        </button>
      ))}
    </div>
  )
}
