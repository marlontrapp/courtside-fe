import type { ReactNode } from 'react'

import { cn } from '@/components/cn'

export type PageHeaderProps = {
  eyebrow?: ReactNode
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  className?: string
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn('fade-up mx-auto w-full max-w-3xl', className)}>
      <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          {eyebrow ? (
            <p className="mb-4 text-sm font-medium tracking-[0.28em] text-ball uppercase">
              {eyebrow}
            </p>
          ) : null}
          <h1 className="font-display text-4xl tracking-tight text-line sm:text-5xl">{title}</h1>
          {description ? (
            <p className="mt-4 max-w-xl text-base leading-relaxed text-mist">{description}</p>
          ) : null}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap gap-3">{actions}</div> : null}
      </div>
    </div>
  )
}
