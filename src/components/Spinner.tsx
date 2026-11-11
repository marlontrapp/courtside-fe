import { cn } from '@/components/cn'

export type SpinnerProps = {
  label?: string
  className?: string
}

export function Spinner({ label = 'Loading', className }: SpinnerProps) {
  return (
    <div
      role="status"
      className={cn('inline-flex items-center gap-3 text-sm text-mist', className)}
    >
      <span
        aria-hidden
        className="h-4 w-4 animate-spin border border-line/30 border-t-ball"
      />
      <span>{label}</span>
    </div>
  )
}
