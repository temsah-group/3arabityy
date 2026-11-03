import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';

import { Button, useToast } from '@/components/ui';
import { ApiError, post } from '@/lib/api';
import { takePassword, useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { usePageMeta } from '@/lib/seo';

import { AuthShell } from './AuthShell';

interface VerifyState {
  email: string;
  purpose: 'register' | 'password_reset';
  from?: string;
}

const LENGTH = 6;

export default function Verify() {
  const { tr } = useI18n();
  usePageMeta(tr('تأكيد الإيميل', 'Confirm your email'));
  const { login } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const state = useLocation().state as VerifyState | null;
  const [digits, setDigits] = useState<string[]>(Array(LENGTH).fill(''));
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [wait, setWait] = useState(60);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (wait <= 0) return;
    const t = window.setTimeout(() => setWait(wait - 1), 1000);
    return () => window.clearTimeout(t);
  }, [wait]);

  if (!state?.email) return <Navigate to="/login" replace />;

  const setDigit = (i: number, value: string) => {
    const clean = value.replace(/\D/g, '');
    if (clean.length > 1) {
      // Pasted the whole code.
      const next = clean.slice(0, LENGTH).split('');
      setDigits([...next, ...Array(LENGTH - next.length).fill('')]);
      inputs.current[Math.min(next.length, LENGTH - 1)]?.focus();
      return;
    }
    const next = [...digits];
    next[i] = clean;
    setDigits(next);
    if (clean && i < LENGTH - 1) inputs.current[i + 1]?.focus();
  };

  const submit = async (e?: FormEvent) => {
    e?.preventDefault();
    const otp = digits.join('');
    if (otp.length !== LENGTH) return;
    setLoading(true);
    setError(undefined);
    try {
      const result = await post<{ resetToken?: string } | null>('/auth/verify-otp', { identifier: state.email, otp, purpose: state.purpose });
      if (state.purpose === 'password_reset') {
        navigate('/reset-password', { replace: true, state: { resetToken: result?.resetToken } });
        return;
      }
      toast(tr('اتأكد الإيميل', 'Email confirmed'));
      const password = takePassword();
      if (password) {
        await login(state.email, password, true);
        navigate(state.from ?? '/', { replace: true });
      } else {
        navigate('/login', { replace: true });
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : tr('الكود مش صحيح', 'Wrong code'));
      setDigits(Array(LENGTH).fill(''));
      inputs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    try {
      await post('/auth/resend-otp', { identifier: state.email, purpose: state.purpose });
      setWait(60);
      toast(tr('بعتنالك كود جديد', 'A new code is on its way'));
    } catch (err) {
      if (err instanceof ApiError && typeof err.details.retryAfterSeconds === 'number') setWait(err.details.retryAfterSeconds);
      setError(err instanceof ApiError ? err.message : undefined);
    }
  };

  return (
    <AuthShell
      title={tr('اكتب الكود', 'Enter the code')}
      subtitle={<>{tr('بعتنا كود من 6 أرقام على ', 'We sent a 6-digit code to ')}<b dir="ltr">{state.email}</b></>}
    >
      <form onSubmit={submit}>
        <div className="flex justify-center gap-2" dir="ltr">
          {digits.map((d, i) => (
            <input
              key={i}
              ref={(el) => (inputs.current[i] = el)}
              value={d}
              onChange={(e) => setDigit(i, e.target.value)}
              onKeyDown={(e) => e.key === 'Backspace' && !d && i > 0 && inputs.current[i - 1]?.focus()}
              inputMode="numeric"
              autoComplete={i === 0 ? 'one-time-code' : 'off'}
              aria-label={`${i + 1}`}
              autoFocus={i === 0}
              className="h-14 w-12 rounded-xl border border-line text-center text-2xl font-extrabold focus:border-navy focus:outline-none focus:ring-2 focus:ring-navy/15"
            />
          ))}
        </div>
        {error && <p role="alert" className="mt-4 text-center text-sm text-red-600">{error}</p>}
        <Button type="submit" className="mt-6 w-full" loading={loading} disabled={digits.join('').length !== LENGTH}>
          {tr('تأكيد', 'Confirm')}
        </Button>
      </form>
      <p className="mt-5 text-center text-sm text-ink-soft">
        {wait > 0 ? (
          tr(`ممكن تطلب كود جديد بعد ${wait} ثانية`, `You can ask for a new code in ${wait}s`)
        ) : (
          <button onClick={resend} className="font-bold text-orange-deep hover:underline">{tr('ابعت كود جديد', 'Send a new code')}</button>
        )}
      </p>
    </AuthShell>
  );
}
