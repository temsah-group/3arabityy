import { AlertCircle, BadgeCheck, Loader2, RefreshCw, Star, WifiOff, X } from 'lucide-react';
import { createContext, forwardRef, useCallback, useContext, useEffect, useId, useRef, useState } from 'react';
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { Link } from 'react-router-dom';

import { ApiError, mediaUrl } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import type { Condition } from '@/lib/types';

export const cx = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(' ');

// ---- Buttons ----

type Variant = 'primary' | 'accent' | 'outline' | 'ghost' | 'danger';
const variants: Record<Variant, string> = {
  primary: 'bg-navy text-white hover:bg-navy-deep',
  accent: 'bg-orange text-white hover:bg-orange-deep',
  outline: 'border border-line bg-white text-navy hover:border-navy',
  ghost: 'text-navy hover:bg-navy-mist',
  danger: 'bg-red-600 text-white hover:bg-red-700',
};

export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; loading?: boolean; size?: 'md' | 'sm' }
>(function Button({ variant = 'primary', loading, size = 'md', className, children, disabled, ...rest }, ref) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-xl font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-60',
        size === 'md' ? 'h-12 px-5 text-[15px]' : 'h-9 px-3 text-sm',
        variants[variant],
        className,
      )}
      {...rest}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
});

// ---- Form fields ----

export function Field({
  label,
  error,
  hint,
  children,
  htmlFor,
}: {
  label: string;
  error?: string;
  hint?: string;
  children: ReactNode;
  htmlFor?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-sm font-bold text-navy">
        {label}
      </label>
      {children}
      {error ? (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-ink-soft">{hint}</p>
      ) : null}
    </div>
  );
}

const inputClass =
  'w-full rounded-xl border border-line bg-white px-4 text-[15px] text-navy placeholder:text-ink-muted focus:border-navy focus:outline-none focus:ring-2 focus:ring-navy/15 disabled:bg-canvas';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }>(
  function Input({ className, invalid, ...rest }, ref) {
    return <input ref={ref} className={cx(inputClass, 'h-12', invalid && 'border-red-500', className)} {...rest} />;
  },
);

export function Textarea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cx(inputClass, 'min-h-28 py-3 leading-7', className)} {...rest} />;
}

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cx(inputClass, 'h-12 appearance-none bg-white', className)} {...rest}>
      {children}
    </select>
  );
}

/** A labelled input with its error from an ApiError. */
export function TextField({
  label,
  error,
  hint,
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string; hint?: string }) {
  const id = useId();
  return (
    <Field label={label} error={error} hint={hint} htmlFor={id}>
      <Input id={id} invalid={Boolean(error)} {...rest} />
    </Field>
  );
}

// ---- States ----

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cx('h-6 w-6 animate-spin text-navy', className)} aria-label="loading" />;
}

export function PageSpinner() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <Spinner />
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const { tr } = useI18n();
  const offline = error instanceof ApiError && error.code === 'OFFLINE';
  const message =
    error instanceof ApiError ? error.message : tr('حصلت مشكلة في التحميل', 'Something went wrong while loading');
  return (
    <div className="flex flex-col items-center gap-3 py-14 text-center">
      {offline ? <WifiOff className="h-9 w-9 text-ink-muted" /> : <AlertCircle className="h-9 w-9 text-ink-muted" />}
      <p className="max-w-sm text-ink-soft">{message}</p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RefreshCw className="h-4 w-4" />
          {tr('حاول تاني', 'Try again')}
        </Button>
      )}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon?: ReactNode;
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 py-14 text-center">
      {icon && <div className="text-ink-muted">{icon}</div>}
      <p className="text-lg font-bold text-navy">{title}</p>
      {body && <p className="max-w-sm text-ink-soft">{body}</p>}
      {action}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx('animate-pulse rounded-xl bg-navy-mist', className)} />;
}

// ---- Bits ----

export function Img({ src, alt, className }: { src: string | null | undefined; alt: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  const url = mediaUrl(src);
  if (!url || failed) {
    return (
      <div className={cx('flex items-center justify-center bg-navy-mist text-navy-soft', className)} aria-label={alt}>
        <svg viewBox="0 0 48 48" className="h-1/3 max-h-12 w-1/3 max-w-12 opacity-40" aria-hidden>
          <circle cx="24" cy="24" r="18" fill="none" stroke="currentColor" strokeWidth="4" />
          <circle cx="24" cy="24" r="6" fill="currentColor" />
        </svg>
      </div>
    );
  }
  return <img src={url} alt={alt} loading="lazy" className={cx('object-cover', className)} onError={() => setFailed(true)} />;
}

export function Avatar({ src, name, size = 40 }: { src: string | null | undefined; name: string; size?: number }) {
  const url = mediaUrl(src);
  return url ? (
    <img src={url} alt="" width={size} height={size} className="shrink-0 rounded-full object-cover" style={{ width: size, height: size }} />
  ) : (
    <span
      className="flex shrink-0 items-center justify-center rounded-full bg-navy-mist font-bold text-navy"
      style={{ width: size, height: size, fontSize: size * 0.42 }}
      aria-hidden
    >
      {name.trim().charAt(0)}
    </span>
  );
}

export function Verified({ className }: { className?: string }) {
  const { tr } = useI18n();
  return <BadgeCheck className={cx('h-4 w-4 shrink-0 text-plate', className)} aria-label={tr('موثّق', 'Verified')} />;
}

const conditionStyle: Record<Condition, string> = {
  NEW: 'bg-emerald-50 text-emerald-700',
  USED: 'bg-amber-50 text-amber-700',
  IMPORTED: 'bg-sky-50 text-sky-700',
};

export function ConditionBadge({ condition, label }: { condition: Condition; label: string }) {
  return <span className={cx('rounded-md px-2 py-0.5 text-xs font-bold', conditionStyle[condition])}>{label}</span>;
}

export function Stars({ value, size = 14 }: { value: number; size?: number }) {
  return (
    <span className="inline-flex" aria-label={`${value.toFixed(1)} / 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          style={{ width: size, height: size }}
          className={i <= Math.round(value) ? 'fill-orange text-orange' : 'fill-line text-line'}
          aria-hidden
        />
      ))}
    </span>
  );
}

export function TextLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className="font-bold text-orange-deep hover:underline">
      {children}
    </Link>
  );
}

// ---- Dialog ----

export function Dialog({
  open,
  onClose,
  title,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className={cx(
        'w-[calc(100%-2rem)] rounded-2xl p-0 text-navy backdrop:bg-navy-deep/60 open:animate-[pop_.18s_ease-out]',
        wide ? 'max-w-2xl' : 'max-w-md',
      )}
    >
      {open && (
        <div className="flex max-h-[85vh] flex-col">
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <h2 className="text-lg font-extrabold">{title}</h2>
            <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-canvas" aria-label="close">
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="overflow-y-auto p-5">{children}</div>
        </div>
      )}
    </dialog>
  );
}

// ---- Toasts ----

const ToastContext = createContext<(message: string) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<number>();
  const show = useCallback((text: string) => {
    setMessage(text);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setMessage(null), 3200);
  }, []);
  return (
    <ToastContext.Provider value={show}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-20 z-50 flex justify-center px-4 md:bottom-8">
        {message && (
          <div className="pointer-events-auto rounded-xl bg-navy-deep px-5 py-3 text-sm font-semibold text-white shadow-lg">
            {message}
          </div>
        )}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);

/** The message to show for any thrown error. */
export function errorMessage(error: unknown, fallback: string) {
  return error instanceof ApiError ? error.message : fallback;
}
