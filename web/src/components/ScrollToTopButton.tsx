import type { ReactElement, RefObject } from 'react'
import { useEffect, useState } from 'react'
import { ChevronUp } from '../lib/icons'
import { cn } from '../lib/utils'

const SHOW_AFTER_PX = 240

interface ScrollToTopButtonProps {
  scrollContainerRef: RefObject<HTMLElement | null>
  className?: string
}

export function ScrollToTopButton({
  scrollContainerRef,
  className,
}: ScrollToTopButtonProps): ReactElement {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = scrollContainerRef.current
    if (!el) return
    const onScroll = (): void => {
      setVisible(el.scrollTop > SHOW_AFTER_PX)
    }
    onScroll()
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [scrollContainerRef])

  return (
    <button
      type="button"
      tabIndex={visible ? 0 : -1}
      aria-label="Наверх"
      aria-hidden={!visible}
      className={cn(
        'fixed bottom-5 right-5 z-40 inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground transition-[opacity,transform] duration-200 ease-[var(--ease-out)]',
        visible ? 'pointer-events-auto opacity-100' : 'pointer-events-none translate-y-2 opacity-0',
        className,
      )}
      onClick={() => {
        scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
      }}
    >
      <ChevronUp size={18} strokeWidth={1.5} />
    </button>
  )
}
