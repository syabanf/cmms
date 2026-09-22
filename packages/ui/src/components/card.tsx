import type { ComponentProps, ReactNode } from 'react'
import { cva } from 'class-variance-authority'
import { cn } from '../lib/cn'

const cardVariants = cva('', {
  variants: {
    variant: {
      default: 'rounded-card bg-card shadow-card',
      // `isolate` lets the blob sit at -z-10: behind the content, above the ink fill.
      ink: 'relative isolate overflow-hidden rounded-hero bg-ink text-on-ink shadow-float',
      accent: 'rounded-card bg-accent text-white shadow-glow',
      soft: 'rounded-2xl bg-surface-2',
    },
  },
  defaultVariants: { variant: 'default' },
})

export type CardProps = ComponentProps<'div'> & { variant?: 'default' | 'ink' | 'accent' | 'soft' }

export function Card({ variant = 'default', className, children, ...props }: CardProps) {
  return (
    <div data-variant={variant} className={cn(cardVariants({ variant }), className)} {...props}>
      {variant === 'ink' && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 -top-24 -z-10 size-72 rounded-full bg-accent/30 blur-3xl"
        />
      )}
      {children}
    </div>
  )
}

export type CardHeaderProps = ComponentProps<'div'> & { action?: ReactNode }

export function CardHeader({ action, className, children, ...props }: CardHeaderProps) {
  if (action === undefined || action === null) {
    return (
      <div className={cn('flex flex-col gap-1 p-5', className)} {...props}>
        {children}
      </div>
    )
  }
  return (
    <div className={cn('flex flex-wrap items-start justify-between gap-2 p-5', className)} {...props}>
      <div className="flex min-w-0 flex-1 flex-col gap-1">{children}</div>
      <div className="flex shrink-0 items-center gap-2">{action}</div>
    </div>
  )
}

export function CardTitle({ className, ...props }: ComponentProps<'h3'>) {
  return <h3 className={cn('text-base font-semibold leading-tight', className)} {...props} />
}

export function CardDescription({ className, ...props }: ComponentProps<'p'>) {
  return <p className={cn('text-sm text-muted', className)} {...props} />
}

export function CardContent({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('p-5 pt-0', className)} {...props} />
}

export function CardFooter({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('flex items-center p-5 pt-0', className)} {...props} />
}
