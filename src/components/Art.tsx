import { useMemo } from 'react'
import { avatarSvg } from '../game/art/badges'
import { basketSvg } from '../game/art/basket'
import { svgDataUrl } from '../game/art/svg'
import type { AvatarId, BasketSkinId } from '../types'
import styles from './Art.module.css'

interface AvatarProps {
  id: AvatarId
  size?: number
  /** Accessible description; decorative when omitted. */
  label?: string
  className?: string
}

export function Avatar({ id, size = 48, label, className }: AvatarProps) {
  const src = useMemo(() => svgDataUrl(avatarSvg(id)), [id])
  return (
    <img
      src={src}
      width={size}
      height={size}
      alt={label ?? ''}
      draggable={false}
      className={[styles.avatar, className].filter(Boolean).join(' ')}
    />
  )
}

interface BasketImageProps {
  skin: BasketSkinId
  width?: number
  label?: string
  className?: string
}

export function BasketImage({ skin, width = 120, label, className }: BasketImageProps) {
  const src = useMemo(() => svgDataUrl(basketSvg(skin, 'full')), [skin])
  return (
    <img
      src={src}
      width={width}
      height={Math.round(width * 0.625)}
      alt={label ?? ''}
      draggable={false}
      className={className}
    />
  )
}
