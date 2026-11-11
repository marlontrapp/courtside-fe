import type { ReactNode } from 'react'

import { cn } from '@/components/cn'

export type EmptyStateProps = {
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
  className?: string
}

export function EmptyState({ title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('border border-line/15 px-5 py-10 text-center', className)}>
      <h2 className="font-display text-2xl tracking-tight text-line">{title}</h2>
      {description ? (
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-mist">{description}</p>
      ) : null}
      {action ? <div className="mt-6 flex justify-center">{action}</div> : null}
    </div>
  )
}
