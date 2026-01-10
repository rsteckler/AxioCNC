import React from 'react'

interface DiagonalArrowProps {
  className?: string
}

/**
 * Diagonal arrow pointing up-left
 */
export function DiagonalArrowUpLeft({ className = 'w-5 h-5' }: DiagonalArrowProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17 17L7 7M7 7v8M7 7h8" />
    </svg>
  )
}

/**
 * Diagonal arrow pointing up-right
 */
export function DiagonalArrowUpRight({ className = 'w-5 h-5' }: DiagonalArrowProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M7 17L17 7M17 7v8M17 7H9" />
    </svg>
  )
}

/**
 * Diagonal arrow pointing down-left
 */
export function DiagonalArrowDownLeft({ className = 'w-5 h-5' }: DiagonalArrowProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17 7L7 17M7 17v-8M7 17h8" />
    </svg>
  )
}

/**
 * Diagonal arrow pointing down-right
 */
export function DiagonalArrowDownRight({ className = 'w-5 h-5' }: DiagonalArrowProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M7 7L17 17M17 17v-8M17 17H9" />
    </svg>
  )
}
