import { useEffect, useRef, type ComponentProps, type ReactNode } from 'react';
import { cx } from '../lib/utils';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'soft';

const variants: Record<Variant, string> = {
  primary:
    'bg-gradient-to-r from-blush-400 to-lilac-400 text-white shadow-[0_6px_16px_-6px_rgba(244,95,164,0.7)] hover:brightness-105 active:brightness-95',
  secondary: 'bg-white text-ink ring-1 ring-blush-200 hover:bg-blush-50 hover:ring-blush-300',
  soft: 'bg-blush-100/80 text-blush-700 hover:bg-blush-100',
  ghost: 'text-ink-soft hover:bg-blush-50 hover:text-blush-700',
  danger: 'bg-rose-500 text-white hover:bg-rose-600',
};

export function Button({
  variant = 'secondary',
  size = 'md',
  className,
  children,
  ...rest
}: ComponentProps<'button'> & { variant?: Variant; size?: 'sm' | 'md' | 'lg' }) {
  return (
    <button
      type="button"
      className={cx(
        'inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full font-semibold whitespace-nowrap transition outline-none touch-manipulation focus-visible:ring-4 focus-visible:ring-lilac-200 disabled:pointer-events-none disabled:opacity-45',
        size === 'sm' && 'h-8 px-3 text-xs',
        size === 'md' && 'h-10 px-4 text-sm',
        size === 'lg' && 'h-12 px-6 text-base',
        variants[variant],
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

export function Segmented<T extends string | number>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: ReactNode }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="grid auto-cols-fr grid-flow-col gap-1 rounded-full bg-blush-50 p-1 ring-1 ring-blush-100">
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          onClick={() => onChange(o.value)}
          className={cx(
            'h-9 rounded-full px-2 text-sm font-semibold whitespace-nowrap transition touch-manipulation',
            o.value === value ? 'bg-white text-blush-600 shadow-sm ring-1 ring-blush-200' : 'text-ink-soft hover:text-blush-600',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Panel({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <section className={cx('rounded-3xl bg-white/85 p-4 shadow-[0_8px_30px_-18px_rgba(150,80,160,0.45)] ring-1 ring-blush-100 backdrop-blur sm:p-6', className)}>
      {children}
    </section>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-blush-200 bg-white/70 px-6 py-14 text-center sm:py-20">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-blush-100 to-lilac-100 text-blush-500">
        {icon}
      </div>
      <h3 className="text-lg font-bold text-ink">{title}</h3>
      {description && <p className="mt-2 max-w-md text-sm leading-relaxed text-ink-soft">{description}</p>}
      {action && <div className="mt-6 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  );
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = '확인',
  danger,
  busy,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const confirmRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    confirmRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-4 backdrop-blur-[2px] sm:items-center" onClick={onCancel}>
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl ring-1 ring-blush-100"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="confirm-title" className="text-lg font-bold text-ink">
          {title}
        </h2>
        <div className="mt-2 text-sm leading-relaxed text-ink-soft">{message}</div>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel} disabled={busy}>
            취소
          </Button>
          <Button ref={confirmRef} variant={danger ? 'danger' : 'primary'} onClick={onConfirm} disabled={busy}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
