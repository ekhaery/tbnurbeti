// Small green check that pops in and then draws its tick. `delay` (ms) lets a
// list of checks animate one after another. Styles live in globals.css
// (.check-pop / .check-draw) and are disabled under prefers-reduced-motion.
export default function AnimatedCheck({ delay = 0, title }: { delay?: number; title?: string }) {
  return (
    <span
      className="check-pop inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-green-500 shrink-0"
      style={{ animationDelay: `${delay}ms` }}
      title={title}
      aria-label={title}
      role={title ? 'img' : undefined}
    >
      <svg viewBox="0 0 16 16" className="w-2.5 h-2.5" fill="none" aria-hidden="true">
        <polyline
          points="4,8 7,11 12,5"
          className="check-draw"
          style={{ animationDelay: `${delay + 200}ms` }}
          stroke="white"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  )
}
