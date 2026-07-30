import { useEffect, useRef, useState } from 'react'

type Phase = 'idle' | 'waiting' | 'go' | 'too-soon' | 'done'

interface Props {
  onComplete: (reactionMs: number) => void
}

export function ReactionGame({ onComplete }: Props) {
  const [phase, setPhase] = useState<Phase>('idle')
  const goAtRef = useRef<number>(0)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (timeoutRef.current)
        clearTimeout(timeoutRef.current)
    }
  }, [])

  function start() {
    setPhase('waiting')
    const delay = 1200 + Math.random() * 2800
    timeoutRef.current = setTimeout(() => {
      goAtRef.current = performance.now()
      setPhase('go')
    }, delay)
  }

  function tap() {
    if (phase === 'idle') {
      start()
      return
    }
    if (phase === 'waiting') {
      if (timeoutRef.current)
        clearTimeout(timeoutRef.current)
      setPhase('too-soon')
      return
    }
    if (phase === 'go') {
      const reactionMs = Math.round(performance.now() - goAtRef.current)
      setPhase('done')
      onComplete(reactionMs)
    }
  }

  function retry() {
    setPhase('idle')
  }

  const label
    = phase === 'idle'
      ? 'Tap to start'
      : phase === 'waiting'
        ? 'Wait for it...'
        : phase === 'go'
          ? 'TAP NOW'
          : phase === 'too-soon'
            ? 'Too soon!'
            : 'Nice'

  return (
    <div className="reaction-game">
      <button
        type="button"
        className={`reaction-pad reaction-pad--${phase}`}
        onClick={phase === 'too-soon' ? retry : tap}
      >
        {label}
      </button>
      {phase === 'too-soon' && <p className="reaction-hint">You tapped before GO. Tap again to retry.</p>}
    </div>
  )
}
