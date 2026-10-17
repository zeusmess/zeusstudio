import { useEffect, useId, useRef, type ReactNode } from 'react'
import styles from './Dialog.module.css'

interface DialogProps {
  open: boolean
  title: ReactNode
  children?: ReactNode
  actions?: ReactNode
  /** Escape and the backdrop call this; omit to make the dialog non-dismissable. */
  onClose?: () => void
  tone?: 'default' | 'danger' | 'celebrate'
  testId?: string
  description?: ReactNode
}

const FOCUSABLE = 'button:not(:disabled), [href], input:not(:disabled), select, textarea, [tabindex]:not([tabindex="-1"])'

/**
 * Modal dialog: focus moves inside on open (to [data-autofocus] or the first
 * control), Tab stays inside, Escape closes when dismissable, and focus
 * returns to where it was on close.
 */
export function Dialog({ open, title, children, actions, onClose, tone = 'default', testId, description }: DialogProps) {
  const ref = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const descriptionId = useId()
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  })

  useEffect(() => {
    if (!open) return
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const node = ref.current
    const target = node?.querySelector<HTMLElement>('[data-autofocus]') ?? node?.querySelector<HTMLElement>(FOCUSABLE)
    target?.focus()

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && onCloseRef.current) {
        event.preventDefault()
        event.stopPropagation()
        onCloseRef.current()
        return
      }
      if (event.key !== 'Tab' || !node) return
      const items = [...node.querySelectorAll<HTMLElement>(FOCUSABLE)]
      if (items.length === 0) return
      const first = items[0]
      const last = items[items.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown, true)
    return () => {
      document.removeEventListener('keydown', onKeyDown, true)
      previous?.focus?.()
    }
  }, [open])

  if (!open) return null

  return (
    <div
      className={styles.backdrop}
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onCloseRef.current?.()
      }}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        className={[styles.dialog, styles[tone]].join(' ')}
        data-testid={testId}
      >
        <h2 id={titleId} className={styles.title}>
          {title}
        </h2>
        {description && (
          <p id={descriptionId} className={styles.description}>
            {description}
          </p>
        )}
        {children}
        {actions && <div className={styles.actions}>{actions}</div>}
      </div>
    </div>
  )
}
