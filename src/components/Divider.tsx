import { cn } from '@/components/cn'

export type DividerProps = {
  className?: string
  label?: string
}

export function Divider({ className, label }: DividerProps) {
  if (!label) {
    return <hr className={cn('border-0 border-t border-line/15', className)} />
  }

  return (
    <div className={cn('flex items-center gap-4', className)} role="separator">
      <div className="h-px flex-1 bg-line/15" />
      <span className="text-xs font-medium tracking-wide text-fog uppercase">{label}</span>
      <div className="h-px flex-1 bg-line/15" />
    </div>
  )
}
