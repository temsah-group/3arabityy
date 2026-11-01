import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

import { Button, TextField } from '@/components/ui';
import { ApiError } from '@/lib/api';
import { rememberPassword, useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';

import { AuthShell, fieldErr } from './AuthShell';

export default function Login() {
  const { tr } = useI18n();
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? '/';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await login(email.trim(), password, remember);
      navigate(from, { replace: true });
    } catch (err) {
      if (err instanceof ApiError && err.code === 'ACCOUNT_NOT_VERIFIED') {
        // The server just sent a fresh code.
        rememberPassword(password);
        navigate('/verify', { state: { email: email.trim(), purpose: 'register', from } });
        return;
      }
      setError(err instanceof ApiError ? err : new ApiError(0, 'UNKNOWN', tr('حصلت مشكلة، حاول تاني', 'Something went wrong')));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell title={tr('تسجيل الدخول', 'Sign in')} subtitle={tr('أهلاً بيك تاني', 'Welcome back')}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <TextField label={tr('الإيميل', 'Email')} type="email" autoComplete="email" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} error={fieldErr(error, 'identifier')} required />
        <TextField label={tr('كلمة السر', 'Password')} type="password" autoComplete="current-password" dir="ltr" value={password} onChange={(e) => setPassword(e.target.value)} error={fieldErr(error, 'password')} required />
        <div className="flex items-center justify-between text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="h-4 w-4 accent-navy" />
            {tr('افتكرني', 'Keep me signed in')}
          </label>
          <Link to="/forgot-password" className="font-bold text-orange-deep hover:underline">{tr('نسيت كلمة السر؟', 'Forgot password?')}</Link>
        </div>
        {error && !error.errors.length && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error.message}</p>}
        <Button type="submit" className="w-full" loading={loading}>{tr('ادخل', 'Sign in')}</Button>
      </form>
      <p className="mt-6 text-center text-sm text-ink-soft">
        {tr('معندكش حساب؟ ', "Don't have an account? ")}
        <Link to="/register" state={{ from }} className="font-bold text-orange-deep hover:underline">{tr('اعمل حساب', 'Create one')}</Link>
      </p>
    </AuthShell>
  );
}
