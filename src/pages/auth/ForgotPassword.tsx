import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';

import { Button, TextField } from '@/components/ui';
import { ApiError, post } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { usePageMeta } from '@/lib/seo';

import { AuthShell, fieldErr } from './AuthShell';

export default function ForgotPassword() {
  const { tr } = useI18n();
  usePageMeta(tr('نسيت كلمة السر', 'Forgot password'));
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await post('/auth/forgot-password', { identifier: email.trim() });
      navigate('/verify', { state: { email: email.trim(), purpose: 'password_reset' } });
    } catch (err) {
      setError(err instanceof ApiError ? err : null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell title={tr('نسيت كلمة السر', 'Forgot your password')} subtitle={tr('اكتب إيميلك وهنبعتلك كود تغيّر بيه كلمة السر.', "Enter your email and we'll send a code to reset it.")}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <TextField label={tr('الإيميل', 'Email')} type="email" autoComplete="email" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} error={fieldErr(error, 'identifier') ?? (error && !error.errors.length ? error.message : undefined)} />
        <Button type="submit" className="w-full" loading={loading}>{tr('ابعت الكود', 'Send code')}</Button>
      </form>
    </AuthShell>
  );
}
