import { useId, useRef, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react'
import { useI18n } from '../locales/i18n'
import styles from './Controls.module.css'

interface ToggleProps {
  label: ReactNode
  hint?: ReactNode
  checked: boolean
  onChange: (checked: boolean) => void
  testId?: string
}

/** An on/off setting: a native button with role="switch". */
export function Toggle({ label, hint, checked, onChange, testId }: ToggleProps) {
  const labelId = useId()
  const hintId = useId()
  return (
    <div className={styles.row}>
      <div className={styles.text}>
        <span id={labelId} className={styles.label}>
          {label}
        </span>
        {hint && (
          <span id={hintId} className={styles.hint}>
            {hint}
          </span>
        )}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={labelId}
        aria-describedby={hint ? hintId : undefined}
        className={styles.switch}
        onClick={() => onChange(!checked)}
        data-testid={testId}
      >
        <span className={styles.thumb} />
      </button>
    </div>
  )
}

interface SliderProps {
  label: ReactNode
  value: number
  onChange: (value: number) => void
  disabled?: boolean
  testId?: string
}

/** A 0–1 value shown as a percentage, built on <input type="range">. */
export function Slider({ label, value, onChange, disabled, testId }: SliderProps) {
  const id = useId()
  const { num } = useI18n()
  const percent = Math.round(value * 100)
  return (
    <div className={styles.slider}>
      <div className={styles.sliderTop}>
        <label htmlFor={id} className={styles.label}>
          {label}
        </label>
        <output htmlFor={id} className={`${styles.value} num`}>
          {num(percent)}%
        </output>
      </div>
      <input
        id={id}
        type="range"
        min={0}
        max={100}
        step={5}
        value={percent}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value) / 100)}
        className={styles.range}
        style={{ '--fill': `${percent}%` } as CSSProperties}
        data-testid={testId}
      />
    </div>
  )
}

interface SegmentedOption<T extends string> {
  value: T
  label: ReactNode
  hint?: ReactNode
  testId?: string
}

interface SegmentedProps<T extends string> {
  label: ReactNode
  value: T
  options: SegmentedOption<T>[]
  onChange: (value: T) => void
  hideLabel?: boolean
}

/** One-of-several choice as a radiogroup; arrow keys follow the reading direction. */
export function Segmented<T extends string>({ label, value, options, onChange, hideLabel }: SegmentedProps<T>) {
  const labelId = useId()
  const { dir } = useI18n()
  const refs = useRef<Array<HTMLButtonElement | null>>([])
  const index = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  )

  const move = (next: number) => {
    const wrapped = (next + options.length) % options.length
    onChange(options[wrapped].value)
    refs.current[wrapped]?.focus()
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const forward = dir === 'rtl' ? 'ArrowLeft' : 'ArrowRight'
    const backward = dir === 'rtl' ? 'ArrowRight' : 'ArrowLeft'
    if (event.key === forward || event.key === 'ArrowDown') move(index + 1)
    else if (event.key === backward || event.key === 'ArrowUp') move(index - 1)
    else if (event.key === 'Home') move(0)
    else if (event.key === 'End') move(options.length - 1)
    else return
    event.preventDefault()
  }

  return (
    <div className={styles.segmentedWrap}>
      <span id={labelId} className={hideLabel ? 'visually-hidden' : styles.label}>
        {label}
      </span>
      <div role="radiogroup" aria-labelledby={labelId} className={styles.segmented} onKeyDown={onKeyDown}>
        {options.map((option, i) => (
          <button
            key={option.value}
            ref={(node) => {
              refs.current[i] = node
            }}
            type="button"
            role="radio"
            aria-checked={option.value === value}
            tabIndex={option.value === value ? 0 : -1}
            className={styles.segment}
            onClick={() => onChange(option.value)}
            data-testid={option.testId}
          >
            <span>{option.label}</span>
            {option.hint && <span className={styles.segmentHint}>{option.hint}</span>}
          </button>
        ))}
      </div>
    </div>
  )
}
