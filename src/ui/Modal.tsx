import { useEffect, useRef, type ReactNode } from 'react';

interface Props {
  titleId: string;
  onClose?: () => void;
  children: ReactNode;
}

export function Modal({ titleId, onClose, children }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ref.current?.querySelector<HTMLElement>('button')?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    if (!onClose) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div ref={ref} role="dialog" aria-modal="true" aria-labelledby={titleId} className="modal">
        {children}
      </div>
    </div>
  );
}
