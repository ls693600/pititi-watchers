import { useRef, type HTMLAttributes, type PointerEvent } from 'react'

const HOLD_MS = 450
const SLOP = 10

/**
 * Press and hold (or right-click) to open quick actions. A tap still works as a normal tap,
 * and moving the finger (scrolling, swiping the banner) cancels the hold.
 */
export function LongPress({ onLong, children, className = '', ...rest }: { onLong: () => void } & HTMLAttributes<HTMLDivElement>) {
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const start = useRef<{ x: number; y: number } | null>(null)
  const fired = useRef(false)
  // The click the browser sends when the finger lifts after a hold must not also open the show
  const swallowUntil = useRef(0)

  const cancel = () => {
    clearTimeout(timer.current)
    start.current = null
  }
  const fire = () => {
    cancel()
    fired.current = true
    navigator.vibrate?.(10)
    onLong()
  }

  return (
    <div
      {...rest}
      className={`hold ${className}`}
      onPointerDown={(e: PointerEvent) => {
        if (e.pointerType === 'mouse' && e.button !== 0) return
        fired.current = false
        start.current = { x: e.clientX, y: e.clientY }
        timer.current = setTimeout(fire, HOLD_MS)
      }}
      onPointerMove={(e) => {
        if (start.current && Math.hypot(e.clientX - start.current.x, e.clientY - start.current.y) > SLOP) cancel()
      }}
      onPointerUp={() => {
        if (fired.current) swallowUntil.current = Date.now() + 500
        fired.current = false
        cancel()
      }}
      onPointerCancel={cancel}
      onPointerLeave={cancel}
      onClickCapture={(e) => {
        if (Date.now() < swallowUntil.current) {
          e.preventDefault()
          e.stopPropagation()
        }
        swallowUntil.current = 0
      }}
      onContextMenu={(e) => {
        e.preventDefault()
        // Android also fires this during a hold; don't open twice
        if (!fired.current) fire()
      }}
    >
      {children}
    </div>
  )
}
