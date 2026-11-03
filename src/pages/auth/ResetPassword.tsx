import { useState } from 'react';
import type { FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';

import { Button, TextField, useToast } from '@/components/ui';
import { ApiError, post } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { usePageMeta } from '@/lib/seo';

import { AuthShell, fieldErr } from './AuthShell';

export default function ResetPassword() {
  const { tr } = useI18n();
  usePageMeta(tr('كلمة سر جديدة', 'New password'));
  const toast = useToast();
  const navigate = useNavigate();
  const resetToken = (useLocation().state as { resetToken?: string } | null)?.resetToken;
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(false);
  if (!resetToken) return <Navigate to="/forgot-password" replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await post('/auth/reset-password', { resetToken, newPassword: password, confirmPassword: confirm });
      toast(tr('اتغيرت كلمة السر، ادخل بيها', 'Password changed. Sign in with it'));
      navigate('/login', { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err : null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell title={tr('كلمة سر جديدة', 'New password')} subtitle={tr('هتخرج من حسابك على كل الأجهزة.', "You'll be signed out on every device.")}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <TextField label={tr('كلمة السر الجديدة', 'New password')} type="password" autoComplete="new-password" dir="ltr" value={password} onChange={(e) => setPassword(e.target.value)} error={fieldErr(error, 'newPassword')} hint={tr('8 حروف على الأقل', 'At least 8 characters')} />
        <TextField label={tr('أكد كلمة السر', 'Confirm password')} type="password" autoComplete="new-password" dir="ltr" value={confirm} onChange={(e) => setConfirm(e.target.value)} error={fieldErr(error, 'confirmPassword')} />
        {error && !error.errors.length && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error.message}</p>}
        <Button type="submit" className="w-full" loading={loading}>{tr('غيّر كلمة السر', 'Change password')}</Button>
      </form>
    </AuthShell>
  );
}
