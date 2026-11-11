import { cn } from '@/components/cn'

export type SpinnerVariant = 'court' | 'ball' | 'racket'

export type SpinnerProps = {
  label?: string
  /** Visual mark: court lines (default), tennis ball, or racket. */
  variant?: SpinnerVariant
  className?: string
}

function CourtMark({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 32 48"
      className={cn('h-5 w-3.5 origin-center animate-spin', className)}
      fill="none"
    >
      {/* Doubles outline */}
      <rect x="2" y="2" width="28" height="44" className="stroke-line/25" strokeWidth="1.5" />
      {/* Singles sidelines */}
      <path d="M7 2v44M25 2v44" className="stroke-line/25" strokeWidth="1.25" />
      {/* Service lines + net + center service */}
      <path d="M7 14h18M2 24h28M7 34h18M16 14v20" className="stroke-line/25" strokeWidth="1.25" />
      {/* Accent sweep — reads as a moving court line while the mark spins */}
      <path
        d="M2 24h28"
        className="stroke-ball"
        strokeWidth="2"
        strokeLinecap="square"
      />
    </svg>
  )
}

function BallMark({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 32 32"
      className={cn('h-5 w-5 origin-center animate-spin', className)}
      fill="none"
    >
      <circle cx="16" cy="16" r="12" className="fill-ball/90 stroke-ball" strokeWidth="1" />
      {/* Classic tennis-ball seams */}
      <path
        d="M8 8c4 4 4 12 0 16"
        className="stroke-ink/70"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      <path
        d="M24 8c-4 4-4 12 0 16"
        className="stroke-ink/70"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  )
}

function RacketMark({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 32 32"
      className={cn('h-5 w-5 origin-[50%_78%] animate-racket-swing', className)}
      fill="none"
    >
      {/* Head */}
      <ellipse
        cx="14"
        cy="11"
        rx="9"
        ry="10"
        className="stroke-ball"
        strokeWidth="1.75"
      />
      {/* Strings */}
      <path
        d="M8 7.5h12M8 11h12M8 14.5h12M10 4.5v13M14 3.5v15M18 4.5v13"
        className="stroke-line/35"
        strokeWidth="1"
      />
      {/* Throat + handle */}
      <path d="M14 21v7" className="stroke-mist" strokeWidth="2.25" strokeLinecap="round" />
      <path d="M11.5 28.5h5" className="stroke-fog" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

const marks = {
  court: CourtMark,
  ball: BallMark,
  racket: RacketMark,
} as const

export function Spinner({
  label = 'Loading',
  variant = 'court',
  className,
}: SpinnerProps) {
  const Mark = marks[variant]

  return (
    <div
      role="status"
      className={cn('inline-flex items-center gap-3 text-sm text-mist', className)}
    >
      <Mark />
      <span>{label}</span>
    </div>
  )
}
