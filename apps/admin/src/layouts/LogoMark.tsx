/** The CMMS mark: a trend line with an accent dot. Same shape as the favicon. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <path d="M14 42l9-18 7 11 5-7 8 14" fill="none" stroke="currentColor" strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="49" cy="17" r="5.5" fill="var(--color-accent)" />
    </svg>
  )
}
