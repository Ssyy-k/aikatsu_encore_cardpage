import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { cx } from '../lib/utils';

type ToastKind = 'success' | 'error' | 'info';
interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
}

const ToastContext = createContext<(message: string, kind?: ToastKind) => void>(() => undefined);

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const seq = useRef(0);

  const show = useCallback((message: string, kind: ToastKind = 'success') => {
    const id = ++seq.current;
    setItems((prev) => [...prev.slice(-2), { id, kind, message }]);
    setTimeout(() => setItems((prev) => prev.filter((t) => t.id !== id)), kind === 'error' ? 5000 : 2600);
  }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-24 z-[60] flex flex-col items-center gap-2 px-4 sm:bottom-6"
      >
        {items.map((t) => (
          <div
            key={t.id}
            className={cx(
              'toast-in pointer-events-auto max-w-md rounded-full px-5 py-2.5 text-sm font-semibold shadow-lg ring-1',
              t.kind === 'success' && 'bg-white text-blush-700 ring-blush-200',
              t.kind === 'info' && 'bg-white text-lilac-600 ring-lilac-200',
              t.kind === 'error' && 'bg-rose-50 text-rose-700 ring-rose-200',
            )}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
