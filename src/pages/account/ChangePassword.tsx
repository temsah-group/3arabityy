import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';

import { PageShell } from '@/components/Layout';
import { Button, TextField, useToast } from '@/components/ui';
import { ApiError, patch } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { usePageMeta } from '@/lib/seo';

export default function ChangePassword() {
  const { tr } = useI18n();
  usePageMeta(tr('تغيير كلمة السر', 'Change password'));
  const { user, setUser } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<ApiError | null>(null);
  const [saving, setSaving] = useState(false);
  if (!user) return null;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await patch('/users/me/password', {
        currentPassword: user.hasPassword ? current : undefined,
        newPassword: next,
        confirmPassword: confirm,
      });
      setUser({ ...user, hasPassword: true });
      toast(tr('اتغيرت كلمة السر، وخرجت من الأجهزة التانية', 'Password changed. Other devices were signed out'));
      navigate('/account');
    } catch (err) {
      setError(err instanceof ApiError ? err : null);
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageShell title={user.hasPassword ? tr('غيّر كلمة السر', 'Change password') : tr('اعمل كلمة سر', 'Set a password')}>
      <form onSubmit={submit} className="space-y-4 rounded-2xl bg-white p-5 ring-1 ring-line md:p-6" noValidate>
        {user.hasPassword && (
          <TextField label={tr('كلمة السر الحالية', 'Current password')} type="password" autoComplete="current-password" dir="ltr" value={current} onChange={(e) => setCurrent(e.target.value)} error={error?.fieldError('currentPassword') ?? (error?.code === 'WRONG_PASSWORD' ? error.message : undefined)} />
        )}
        <TextField label={tr('كلمة السر الجديدة', 'New password')} type="password" autoComplete="new-password" dir="ltr" value={next} onChange={(e) => setNext(e.target.value)} error={error?.fieldError('newPassword')} hint={tr('8 حروف على الأقل', 'At least 8 characters')} />
        <TextField label={tr('أكد كلمة السر', 'Confirm password')} type="password" autoComplete="new-password" dir="ltr" value={confirm} onChange={(e) => setConfirm(e.target.value)} error={error?.fieldError('confirmPassword')} />
        {error && !error.errors.length && error.code !== 'WRONG_PASSWORD' && <p role="alert" className="text-sm text-red-600">{error.message}</p>}
        <Button type="submit" loading={saving}>{tr('احفظ كلمة السر', 'Save password')}</Button>
      </form>
    </PageShell>
  );
}
